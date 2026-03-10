/**
 * =============================================================
 *  services/googleSheetsService.js - Google Sheets integration
 * =============================================================
 *  Commercial events are appended to a Google Sheet asynchronously.
 *
 *  Supports two modes:
 *   1) Existing sheet: set GOOGLE_SHEETS_ID in .env
 *   2) Auto-create: leave GOOGLE_SHEETS_ID empty and set
 *      GOOGLE_SHEETS_AUTO_CREATE=true
 *
 *  Notes:
 *   - Bot keeps running even if Sheets fails.
 *   - Errors are logged to data/sheets-errors.log.
 *   - If auto-created, spreadsheetId is cached in
 *     data/google-sheets-config.json.
 * =============================================================
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const LOG_FILE = path.join(DATA_DIR, 'sheets-errors.log');
const CACHE_FILE = path.join(DATA_DIR, 'google-sheets-config.json');

const HEADER_ROW = [
  'data_evento',
  'nome_lead',
  'numero_whatsapp',
  'curso_interesse',
  'status_atual',
  'responsavel',
  'tempo_primeira_resposta',
  'tipo_evento',
  'mensagem_resumo',
];

let contextPromise = null;
let warnedMissingConfig = false;

function _ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function _logError(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  try {
    _ensureDataDir();
    fs.appendFileSync(LOG_FILE, line);
  } catch (_) {}
  console.error('[SHEETS] ERROR', message);
}

function _logInfo(message) {
  console.log('[SHEETS]', message);
}

function _hasCredentials() {
  return !!(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY
  );
}

function _autoCreateEnabled() {
  return String(process.env.GOOGLE_SHEETS_AUTO_CREATE || '').toLowerCase() === 'true';
}

function _getTabName() {
  return (process.env.GOOGLE_SHEETS_TAB || 'Leads').trim() || 'Leads';
}

function _getEnvSpreadsheetId() {
  const id = String(process.env.GOOGLE_SHEETS_ID || '').trim();
  return id || null;
}

function _loadCachedSpreadsheetId() {
  try {
    const raw = fs.readFileSync(CACHE_FILE, 'utf8');
    const json = JSON.parse(raw);
    if (typeof json.spreadsheetId === 'string' && json.spreadsheetId.trim()) {
      return json.spreadsheetId.trim();
    }
  } catch (_) {}
  return null;
}

function _saveCachedSpreadsheetId(spreadsheetId, tabName) {
  try {
    _ensureDataDir();
    fs.writeFileSync(
      CACHE_FILE,
      JSON.stringify(
        {
          spreadsheetId,
          tabName,
          createdAt: new Date().toISOString(),
        },
        null,
        2
      )
    );
  } catch (err) {
    _logError(`Failed to save sheets cache: ${err.message}`);
  }
}

function _formatDateBR() {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date()).replace(',', '');
}

async function _createSpreadsheet(sheets, tabName) {
  const titleBase = (process.env.GOOGLE_SHEETS_TITLE || 'Integra Leads').trim() || 'Integra Leads';
  const title = `${titleBase} ${new Date().toISOString().slice(0, 10)}`;

  const res = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title },
      sheets: [{ properties: { title: tabName } }],
    },
  });

  const spreadsheetId = res?.data?.spreadsheetId;
  if (!spreadsheetId) {
    throw new Error('Spreadsheet created without spreadsheetId.');
  }

  _saveCachedSpreadsheetId(spreadsheetId, tabName);
  _logInfo(`Spreadsheet auto-created: ${spreadsheetId} (title: ${title})`);
  return spreadsheetId;
}

async function _loadSpreadsheetMeta(sheets, spreadsheetId) {
  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'spreadsheetId,sheets(properties(title))',
  });
  return res.data || {};
}

async function _ensureTabExists(sheets, spreadsheetId, tabName) {
  const meta = await _loadSpreadsheetMeta(sheets, spreadsheetId);
  const tabs = Array.isArray(meta.sheets) ? meta.sheets : [];
  const hasTab = tabs.some((s) => s?.properties?.title === tabName);

  if (hasTab) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title: tabName } } }],
    },
  });

  _logInfo(`Tab created: ${tabName} (spreadsheet: ${spreadsheetId})`);
}

async function _ensureHeaderRow(sheets, spreadsheetId, tabName) {
  const range = `${tabName}!A1:I1`;
  const current = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const row = current?.data?.values?.[0] || [];

  if (row.length > 0) return;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    requestBody: { values: [HEADER_ROW] },
  });

  _logInfo(`Header row initialized on ${tabName}.`);
}

async function _initContext() {
  if (!_hasCredentials()) return null;

  const { google } = require('googleapis');

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const tabName = _getTabName();

  let spreadsheetId = _getEnvSpreadsheetId() || _loadCachedSpreadsheetId();

  if (!spreadsheetId && _autoCreateEnabled()) {
    spreadsheetId = await _createSpreadsheet(sheets, tabName);
  }

  if (!spreadsheetId) {
    if (!warnedMissingConfig) {
      warnedMissingConfig = true;
      _logInfo(
        'Google Sheets disabled: set GOOGLE_SHEETS_ID or enable GOOGLE_SHEETS_AUTO_CREATE=true.'
      );
    }
    return null;
  }

  await _ensureTabExists(sheets, spreadsheetId, tabName);
  await _ensureHeaderRow(sheets, spreadsheetId, tabName);

  return { sheets, spreadsheetId, tabName };
}

async function _getContext() {
  if (!contextPromise) contextPromise = _initContext();

  try {
    return await contextPromise;
  } catch (err) {
    contextPromise = null;
    throw err;
  }
}

function _buildRow(data) {
  return [[
    _formatDateBR(),
    data.nome_lead || '',
    data.numero_whatsapp || '',
    data.curso_interesse || '',
    data.status_atual || '',
    data.responsavel || '',
    data.tempo_primeira_resposta || '',
    data.tipo_evento || '',
    data.mensagem_resumo || '',
  ]];
}

/**
 * Appends one event row to Google Sheets.
 * Never throws to caller.
 *
 * @param {object} data
 * @param {number} [_attempt=1]
 */
async function appendToSheet(data, _attempt = 1) {
  if (!_hasCredentials()) return;

  try {
    const ctx = await _getContext();
    if (!ctx) return;

    const { sheets, spreadsheetId, tabName } = ctx;

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${tabName}!A:I`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: _buildRow(data) },
    });
  } catch (err) {
    _logError(`appendToSheet attempt ${_attempt}: ${err.message}`);
    contextPromise = null;

    if (_attempt < 3) {
      await new Promise((r) => setTimeout(r, 3_000));
      return appendToSheet(data, _attempt + 1);
    }

    _logError(`appendToSheet failed permanently after 3 attempts. Lost row: ${JSON.stringify(data)}`);
  }
}

module.exports = { appendToSheet };

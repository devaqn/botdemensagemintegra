/**
 * =============================================================
 *  services/googleSheetsService.js — Integração Google Sheets
 * =============================================================
 *  Registra eventos comerciais em uma planilha Google Sheets
 *  em tempo real, de forma assíncrona e não-bloqueante.
 *
 *  Configuração no .env:
 *    GOOGLE_SHEETS_ID=1abc...xyz
 *    GOOGLE_SHEETS_TAB=Leads
 *    GOOGLE_SERVICE_ACCOUNT_EMAIL=bot@projeto.iam.gserviceaccount.com
 *    GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
 *
 *  Como configurar a conta de serviço:
 *    1. Acesse console.cloud.google.com → APIs & Services → Credentials
 *    2. Create Credentials → Service Account
 *    3. Baixe o JSON da chave → copie client_email e private_key para o .env
 *    4. No Google Sheets → Compartilhar → adicione o client_email com permissão de Editor
 *    5. Ative a API "Google Sheets API" no Console
 *
 *  Estrutura da planilha (9 colunas, linha 1 = cabeçalho):
 *    A: data_evento | B: nome_lead | C: numero_whatsapp | D: curso_interesse
 *    E: status_atual | F: responsavel | G: tempo_primeira_resposta
 *    H: tipo_evento | I: mensagem_resumo
 *
 *  Robustez:
 *   - Retry automático (até 3 tentativas, intervalo de 3s)
 *   - Erros são logados em data/sheets-errors.log
 *   - Falha na planilha NUNCA derruba o bot
 *   - Se credenciais não configuradas → ignora silenciosamente
 * =============================================================
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '..', 'data', 'sheets-errors.log');

// ────────────────────────────────────────────────────────────
//  Utilitários internos
// ────────────────────────────────────────────────────────────

/**
 * Registra erro de integração em arquivo local.
 * Não lança exceção.
 */
function _logError(mensagem) {
  const linha = `[${new Date().toISOString()}] ${mensagem}\n`;
  try {
    const dir = path.dirname(LOG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(LOG_FILE, linha);
  } catch (_) {}
  console.error('[SHEETS] ❌', mensagem);
}

/**
 * Verifica se as credenciais do Google estão configuradas no .env.
 * @returns {boolean}
 */
function _isConfigured() {
  return !!(
    process.env.GOOGLE_SHEETS_ID             &&
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY
  );
}

/**
 * Formata data/hora atual no padrão brasileiro (horário de Brasília).
 * @returns {string} Ex: '03/03/2026 14:35:22'
 */
function _formatarDataBR() {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day:      '2-digit',
    month:    '2-digit',
    year:     'numeric',
    hour:     '2-digit',
    minute:   '2-digit',
    second:   '2-digit',
    hour12:   false,
  }).format(new Date()).replace(',', '');
}

// ────────────────────────────────────────────────────────────
//  API pública
// ────────────────────────────────────────────────────────────

/**
 * Adiciona uma linha ao final da aba configurada em GOOGLE_SHEETS_TAB.
 *
 * Sempre usa append (nunca sobrescreve linhas existentes).
 * Tem retry automático (até 3 tentativas).
 * Nunca lança exceção para o chamador.
 *
 * @param {object} data
 * @param {string} data.tipo_evento             - Ex: 'novo_lead', 'lead_atribuido'
 * @param {string} data.nome_lead
 * @param {string} data.numero_whatsapp
 * @param {string} data.curso_interesse
 * @param {string} data.status_atual
 * @param {string} data.responsavel
 * @param {string} data.tempo_primeira_resposta - Ex: '5 min'
 * @param {string} data.mensagem_resumo
 * @param {number} [_tentativa=1]               - Uso interno para retry
 */
async function appendToSheet(data, _tentativa = 1) {
  if (!_isConfigured()) return; // credenciais não configuradas → ignora

  try {
    const { google } = require('googleapis');

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        // O .env armazena \n literal — precisa converter para newline real
        private_key:  (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets  = google.sheets({ version: 'v4', auth });
    const tabName = process.env.GOOGLE_SHEETS_TAB || 'Leads';
    const sheetId = process.env.GOOGLE_SHEETS_ID;

    const linha = [[
      _formatarDataBR(),                       // A: data_evento
      data.nome_lead               || '',      // B: nome_lead
      data.numero_whatsapp         || '',      // C: numero_whatsapp
      data.curso_interesse         || '',      // D: curso_interesse
      data.status_atual            || '',      // E: status_atual
      data.responsavel             || '',      // F: responsavel
      data.tempo_primeira_resposta || '',      // G: tempo_primeira_resposta
      data.tipo_evento             || '',      // H: tipo_evento
      data.mensagem_resumo         || '',      // I: mensagem_resumo
    ]];

    await sheets.spreadsheets.values.append({
      spreadsheetId:    sheetId,
      range:            `${tabName}!A:I`,
      valueInputOption: 'USER_ENTERED',
      requestBody:      { values: linha },
    });

  } catch (err) {
    _logError(`appendToSheet tentativa ${_tentativa}: ${err.message}`);

    // Retry simples: até 3 tentativas com 3s de intervalo
    if (_tentativa < 3) {
      await new Promise((r) => setTimeout(r, 3_000));
      return appendToSheet(data, _tentativa + 1);
    }

    _logError(`appendToSheet falhou definitivamente após 3 tentativas. Dado perdido: ${JSON.stringify(data)}`);
  }
}

module.exports = { appendToSheet };

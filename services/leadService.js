/**
 * =============================================================
 *  services/leadService.js — Gestão de Leads
 * =============================================================
 *  Fonte da verdade: banco SQLite (services/db.js).
 *  Google Sheets é atualizado de forma assíncrona e não bloqueia.
 *
 *  Status possíveis de um lead:
 *   NOVO           → primeiro contato via WhatsApp
 *   EM_ATENDIMENTO → consultor foi acionado e atribuído
 *   CONVERTIDO     → lead se matriculou (atualizado manualmente ou via API)
 *   PERDIDO        → lead encerrou sem conversão
 *
 *  API pública:
 *   upsertLead(numero, nome)             → cria ou atualiza lead
 *   updateInteresse(numero, interesse)   → salva o curso de interesse
 *   qualificarLead(numero, responsavel)  → EM_ATENDIMENTO + first_response_at
 *   atualizarStatus(numero, status)      → muda status manualmente
 * =============================================================
 */

'use strict';

const db = require('./db');

// ────────────────────────────────────────────────────────────
//  Prepared statements reutilizáveis
// ────────────────────────────────────────────────────────────

// Colunas necessárias para montar o objeto Google Sheets
const SHEET_SELECT = `
  SELECT nome, numero, curso_interesse, status, responsavel, first_response_at, created_at
  FROM leads WHERE numero = ?
`;

const stmtInsert = db.prepare(
  'INSERT INTO leads (numero, nome, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
);
const stmtSelectIdNome    = db.prepare('SELECT id, nome FROM leads WHERE numero = ?');
const stmtSelectInteresse = db.prepare('SELECT id, curso_interesse FROM leads WHERE numero = ?');
const stmtSelectFirstResp = db.prepare('SELECT id, first_response_at FROM leads WHERE numero = ?');
const stmtSelectSheet     = db.prepare(SHEET_SELECT);
const stmtUpdateNome      = db.prepare('UPDATE leads SET nome = ?, updated_at = ? WHERE numero = ?');
const stmtUpdateInteresse = db.prepare('UPDATE leads SET curso_interesse = ?, updated_at = ? WHERE numero = ?');
const stmtUpdateQualifica = db.prepare(`
  UPDATE leads
  SET status = 'EM_ATENDIMENTO', responsavel = ?, first_response_at = ?, updated_at = ?
  WHERE numero = ?
`);
const stmtUpdateStatus    = db.prepare('UPDATE leads SET status = ?, updated_at = ? WHERE numero = ?');
const stmtInsertLog       = db.prepare(
  'INSERT INTO logs (tipo_evento, descricao, numero_lead, created_at) VALUES (?, ?, ?, ?)'
);

// ────────────────────────────────────────────────────────────
//  Utilitários internos
// ────────────────────────────────────────────────────────────

function _now() {
  return new Date().toISOString();
}

function _logEvento(tipoEvento, descricao, numero) {
  try {
    stmtInsertLog.run(tipoEvento, descricao || null, numero || null, _now());
  } catch (err) {
    console.error('[DB] ❌ Erro ao registrar log:', err.message);
  }
}

/**
 * Dispara sync com Google Sheets de forma não-bloqueante.
 */
function _sheetsAsync(data) {
  setImmediate(() => {
    try {
      const { appendToSheet } = require('./googleSheetsService');
      appendToSheet(data).catch(() => {});
    } catch (_) {}
  });
}

/**
 * Monta o objeto de linha para o Google Sheets a partir de um registro de lead.
 * @param {object} lead - Linha do banco (colunas explícitas do SHEET_SELECT)
 * @returns {object}
 */
function _buildSheetRow(lead) {
  if (!lead) return {};

  let tempoResp = '';
  if (lead.first_response_at && lead.created_at) {
    const diffMs = new Date(lead.first_response_at) - new Date(lead.created_at);
    const mins   = Math.round(diffMs / 60_000);
    tempoResp    = mins >= 0 ? `${mins} min` : '';
  }

  return {
    nome_lead:               lead.nome           || '',
    numero_whatsapp:         lead.numero         || '',
    curso_interesse:         lead.curso_interesse || '',
    status_atual:            lead.status         || '',
    responsavel:             lead.responsavel    || '',
    tempo_primeira_resposta: tempoResp,
  };
}

// ────────────────────────────────────────────────────────────
//  API pública
// ────────────────────────────────────────────────────────────

/**
 * Cria o lead se não existir. Se já existir, atualiza o nome caso estivesse vazio.
 * Usa db.transaction() para garantir atomicidade — elimina race condition TOCTOU.
 *
 * @param {string} numero - JID prefix (ex: '5581999999999') — identificador único
 * @param {string|null} nome - Nome do usuário (pushName do WhatsApp)
 * @returns {'created'|'existing'}
 */
function upsertLead(numero, nome) {
  const now = _now();

  const doUpsert = db.transaction(() => {
    const existing = stmtSelectIdNome.get(numero);

    if (!existing) {
      stmtInsert.run(numero, nome || null, 'NOVO', now, now);
      return 'created';
    }

    if (!existing.nome && nome) {
      stmtUpdateNome.run(nome, now, numero);
    }

    return 'existing';
  });

  const result = doUpsert();

  if (result === 'created') {
    _logEvento('novo_lead', `Novo lead criado: ${nome || numero}`, numero);
    _sheetsAsync({
      tipo_evento:             'novo_lead',
      nome_lead:               nome    || '',
      numero_whatsapp:         numero,
      curso_interesse:         '',
      status_atual:            'NOVO',
      responsavel:             '',
      tempo_primeira_resposta: '',
      mensagem_resumo:         'Novo lead criado via WhatsApp',
    });
    console.log(`[LEADS] 🆕 Novo lead: ${nome || numero} (${numero})`);
  }

  return result;
}

/**
 * Atualiza o curso de interesse do lead quando ele acessa um tópico do menu.
 * Usa transaction para garantir que leitura e escrita sejam atômicas.
 *
 * @param {string} numero        - Identificador do lead
 * @param {string} cursoInteresse - Contexto/tópico acessado
 */
function updateInteresse(numero, cursoInteresse) {
  const doUpdate = db.transaction(() => {
    const lead = stmtSelectInteresse.get(numero);
    if (!lead || lead.curso_interesse === cursoInteresse) return null;

    stmtUpdateInteresse.run(cursoInteresse, _now(), numero);
    return stmtSelectSheet.get(numero);
  });

  const updated = doUpdate();
  if (!updated) return;

  _logEvento('interesse_atualizado', `Interesse: ${cursoInteresse}`, numero);
  _sheetsAsync({
    ..._buildSheetRow(updated),
    tipo_evento:     'lead_qualificado',
    mensagem_resumo: `Interesse registrado: ${cursoInteresse}`,
  });
}

/**
 * Marca o lead como EM_ATENDIMENTO, registra o consultor atribuído
 * e seta first_response_at (apenas se ainda não tinha sido setado).
 * Usa transaction para garantir consistência entre as duas queries.
 *
 * @param {string}      numero      - Identificador do lead
 * @param {string|null} responsavel - Número do consultor atribuído
 */
function qualificarLead(numero, responsavel) {
  const doQualify = db.transaction(() => {
    const lead = stmtSelectFirstResp.get(numero);
    if (!lead) return null;

    const now       = _now();
    const firstResp = lead.first_response_at || now;

    stmtUpdateQualifica.run(responsavel || null, firstResp, now, numero);
    return stmtSelectSheet.get(numero);
  });

  const updated = doQualify();
  if (!updated) return;

  _logEvento('lead_atribuido', `Atribuído a: ${responsavel || 'admin'}`, numero);
  _sheetsAsync({
    ..._buildSheetRow(updated),
    tipo_evento:     'lead_atribuido',
    mensagem_resumo: `Lead atribuído a ${responsavel || 'admin'}`,
  });

  console.log(`[LEADS] 📋 Lead ${numero} → EM_ATENDIMENTO (responsável: ${responsavel || 'admin'})`);
}

/**
 * Atualiza o status do lead manualmente.
 * Usado para marcar como CONVERTIDO ou PERDIDO.
 *
 * @param {string} numero - Identificador do lead
 * @param {'NOVO'|'EM_ATENDIMENTO'|'CONVERTIDO'|'PERDIDO'} status
 */
function atualizarStatus(numero, status) {
  const statusValidos = ['NOVO', 'EM_ATENDIMENTO', 'CONVERTIDO', 'PERDIDO'];
  if (!statusValidos.includes(status)) {
    console.error(`[LEADS] ❌ Status inválido: ${status}`);
    return;
  }

  const doUpdate = db.transaction(() => {
    stmtUpdateStatus.run(status, _now(), numero);
    return stmtSelectSheet.get(numero);
  });

  const updated = doUpdate();
  if (!updated) return;

  _logEvento('status_atualizado', `Status → ${status}`, numero);
  _sheetsAsync({
    ..._buildSheetRow(updated),
    tipo_evento:     status === 'CONVERTIDO' ? 'conversao' : 'mudanca_status',
    mensagem_resumo: `Status atualizado para ${status}`,
  });

  console.log(`[LEADS] 🔄 Lead ${numero} → ${status}`);
}

module.exports = { upsertLead, updateInteresse, qualificarLead, atualizarStatus };

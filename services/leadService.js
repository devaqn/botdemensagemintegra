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
//  Utilitários internos
// ────────────────────────────────────────────────────────────

/** Retorna timestamp ISO atual */
function _now() {
  return new Date().toISOString();
}

/** Registra evento na tabela logs */
function _logEvento(tipoEvento, descricao, numero) {
  try {
    db.prepare(
      'INSERT INTO logs (tipo_evento, descricao, numero_lead, created_at) VALUES (?, ?, ?, ?)'
    ).run(tipoEvento, descricao || null, numero || null, _now());
  } catch (err) {
    console.error('[DB] ❌ Erro ao registrar log:', err.message);
  }
}

/**
 * Dispara sync com Google Sheets de forma não-bloqueante.
 * Usa setImmediate para não travar o loop de eventos do bot.
 */
function _sheetsAsync(data) {
  setImmediate(() => {
    try {
      const { appendToSheet } = require('./googleSheetsService');
      appendToSheet(data).catch(() => {}); // falha silenciosa
    } catch (_) {
      // googleSheetsService pode não estar configurado
    }
  });
}

/**
 * Monta o objeto de linha para o Google Sheets a partir de um registro de lead.
 * @param {object} lead - Linha do banco
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
 *
 * @param {string} numero - JID prefix (ex: '5581999999999') — identificador único
 * @param {string|null} nome - Nome do usuário (pushName do WhatsApp)
 * @returns {'created'|'existing'}
 */
function upsertLead(numero, nome) {
  const existing = db.prepare('SELECT id, nome FROM leads WHERE numero = ?').get(numero);

  if (!existing) {
    const now = _now();
    db.prepare(
      'INSERT INTO leads (numero, nome, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run(numero, nome || null, 'NOVO', now, now);

    _logEvento('novo_lead', `Novo lead criado: ${nome || numero}`, numero);

    _sheetsAsync({
      tipo_evento:             'novo_lead',
      nome_lead:               nome            || '',
      numero_whatsapp:         numero,
      curso_interesse:         '',
      status_atual:            'NOVO',
      responsavel:             '',
      tempo_primeira_resposta: '',
      mensagem_resumo:         'Novo lead criado via WhatsApp',
    });

    console.log(`[LEADS] 🆕 Novo lead: ${nome || numero} (${numero})`);
    return 'created';
  }

  // Atualiza nome se estava vazio
  if (!existing.nome && nome) {
    db.prepare('UPDATE leads SET nome = ?, updated_at = ? WHERE numero = ?')
      .run(nome, _now(), numero);
  }

  return 'existing';
}

/**
 * Atualiza o curso de interesse do lead quando ele acessa um tópico do menu.
 * Não atualiza se o interesse já é o mesmo (evita logs desnecessários).
 *
 * @param {string} numero        - Identificador do lead
 * @param {string} cursoInteresse - Contexto/tópico acessado
 */
function updateInteresse(numero, cursoInteresse) {
  const lead = db.prepare('SELECT * FROM leads WHERE numero = ?').get(numero);
  if (!lead)                              return;
  if (lead.curso_interesse === cursoInteresse) return; // sem mudança

  db.prepare(
    'UPDATE leads SET curso_interesse = ?, updated_at = ? WHERE numero = ?'
  ).run(cursoInteresse, _now(), numero);

  _logEvento('interesse_atualizado', `Interesse: ${cursoInteresse}`, numero);

  const updated = db.prepare('SELECT * FROM leads WHERE numero = ?').get(numero);
  _sheetsAsync({
    ..._buildSheetRow(updated),
    tipo_evento:     'lead_qualificado',
    mensagem_resumo: `Interesse registrado: ${cursoInteresse}`,
  });
}

/**
 * Marca o lead como EM_ATENDIMENTO, registra o consultor atribuído
 * e seta first_response_at (apenas se ainda não tinha sido setado).
 *
 * @param {string}      numero      - Identificador do lead
 * @param {string|null} responsavel - Número do consultor atribuído
 */
function qualificarLead(numero, responsavel) {
  const lead = db.prepare('SELECT * FROM leads WHERE numero = ?').get(numero);
  if (!lead) return;

  const now       = _now();
  const firstResp = lead.first_response_at || now;

  db.prepare(`
    UPDATE leads
    SET status            = 'EM_ATENDIMENTO',
        responsavel       = ?,
        first_response_at = ?,
        updated_at        = ?
    WHERE numero = ?
  `).run(responsavel || null, firstResp, now, numero);

  _logEvento('lead_atribuido', `Atribuído a: ${responsavel || 'admin'}`, numero);

  const updated = db.prepare('SELECT * FROM leads WHERE numero = ?').get(numero);
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

  db.prepare('UPDATE leads SET status = ?, updated_at = ? WHERE numero = ?')
    .run(status, _now(), numero);

  _logEvento('status_atualizado', `Status → ${status}`, numero);

  const updated = db.prepare('SELECT * FROM leads WHERE numero = ?').get(numero);
  if (!updated) return;

  _sheetsAsync({
    ..._buildSheetRow(updated),
    tipo_evento:     status === 'CONVERTIDO' ? 'conversao' : 'mudanca_status',
    mensagem_resumo: `Status atualizado para ${status}`,
  });

  console.log(`[LEADS] 🔄 Lead ${numero} → ${status}`);
}

module.exports = { upsertLead, updateInteresse, qualificarLead, atualizarStatus };

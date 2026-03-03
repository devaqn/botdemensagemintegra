/**
 * =============================================================
 *  services/roundRobin.js — Distribuição Round-Robin de Leads
 * =============================================================
 *  Distribui leads automaticamente entre os consultores definidos
 *  na variável de ambiente CONSULTORES do .env.
 *
 *  Configuração no .env:
 *    CONSULTORES=5581999999999,5511888888888,5521777777777
 *
 *  Comportamento:
 *   - Se CONSULTORES não estiver configurado → retorna null
 *     (messageHandler usa ADMIN_WHATSAPP como fallback)
 *   - O índice atual é persistido em data/round-robin.json
 *     para sobreviver reinicializações do bot
 *   - Cada chamada a proximoConsultor() avança o ponteiro
 *
 *  Exemplo com 3 consultores:
 *    1ª chamada → consultor[0]
 *    2ª chamada → consultor[1]
 *    3ª chamada → consultor[2]
 *    4ª chamada → consultor[0] (rotação)
 * =============================================================
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '..', 'data', 'round-robin.json');

// ────────────────────────────────────────────────────────────
//  Funções internas
// ────────────────────────────────────────────────────────────

/**
 * Lê a lista de consultores do .env.
 * @returns {string[]} Array de números de telefone
 */
function _getConsultores() {
  const raw = process.env.CONSULTORES || '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Carrega o índice atual do disco.
 * @returns {number}
 */
function _loadIndex() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const obj = JSON.parse(raw);
    return typeof obj.index === 'number' ? obj.index : 0;
  } catch (_) {
    return 0; // arquivo inexistente na primeira execução
  }
}

/**
 * Salva o índice atual no disco.
 * @param {number} index
 */
function _saveIndex(index) {
  try {
    // Garante que data/ existe (criado pelo db.js, mas pode ser chamado antes)
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify({ index }, null, 2));
  } catch (err) {
    console.error('[ROUND-ROBIN] ❌ Erro ao salvar estado:', err.message);
  }
}

// ────────────────────────────────────────────────────────────
//  API pública
// ────────────────────────────────────────────────────────────

/**
 * Retorna o próximo consultor em round-robin e avança o ponteiro.
 *
 * @returns {string|null}
 *   Número de telefone do consultor (ex: '5581999999999')
 *   ou null se CONSULTORES não estiver configurado no .env
 */
function proximoConsultor() {
  const consultores = _getConsultores();

  if (!consultores.length) return null; // sem consultores → usa admin como fallback

  const index     = _loadIndex();
  const total     = consultores.length;
  const idx       = index % total;
  const consultor = consultores[idx];

  // Avança o ponteiro (volta para 0 ao chegar no final)
  _saveIndex((idx + 1) % total);

  console.log(
    `[ROUND-ROBIN] 🔄 Atribuindo consultor ${idx + 1}/${total}: ${consultor}`
  );

  return consultor;
}

/**
 * Retorna a lista completa de consultores configurados.
 * Útil para logs e depuração.
 * @returns {string[]}
 */
function listarConsultores() {
  return _getConsultores();
}

module.exports = { proximoConsultor, listarConsultores };

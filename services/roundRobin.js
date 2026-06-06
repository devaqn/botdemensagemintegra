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
 *  CORREÇÕES:
 *   [FIX-RR1] Race condition eliminada: índice mantido em memória
 *             (variável de módulo). Em Node.js single-thread, incremento
 *             de variável em memória é genuinamente atômico — não existe
 *             janela entre leitura e escrita como havia com I/O de disco.
 *   [FIX-RR2] I/O síncrono eliminado: persistência em disco agora é
 *             assíncrona com debounce de 2s para não bloquear o event loop.
 * =============================================================
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '..', 'data', 'round-robin.json');

// ────────────────────────────────────────────────────────────
//  [FIX-RR1] Índice em memória — carregado do disco UMA única vez
// ────────────────────────────────────────────────────────────

function _loadIndexOnce() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const obj = JSON.parse(raw);
    return typeof obj.index === 'number' && obj.index >= 0 ? obj.index : 0;
  } catch (_) {
    return 0;
  }
}

let _currentIndex = _loadIndexOnce(); // lido do disco apenas na inicialização

// ────────────────────────────────────────────────────────────
//  [FIX-RR2] Persistência assíncrona com debounce (2s)
// ────────────────────────────────────────────────────────────

let _saveTimer = null;

function _scheduleSave(index) {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) {
      try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
    }
    fs.writeFile(STATE_FILE, JSON.stringify({ index }, null, 2), (err) => {
      if (err) console.error('[ROUND-ROBIN] ❌ Erro ao persistir estado:', err.message);
    });
  }, 2_000);
}

// ────────────────────────────────────────────────────────────
//  Funções internas
// ────────────────────────────────────────────────────────────

function _getConsultores() {
  const raw = process.env.CONSULTORES || '';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

// ────────────────────────────────────────────────────────────
//  API pública
// ────────────────────────────────────────────────────────────

/**
 * Retorna o próximo consultor em round-robin e avança o ponteiro.
 *
 * Thread-safety: Node.js é single-threaded. O incremento de `_currentIndex`
 * é uma operação síncrona que não pode ser interrompida por outro callback.
 * Isso elimina completamente a race condition que existia com leitura de disco.
 *
 * @returns {string|null} Número do consultor ou null se não configurado
 */
function proximoConsultor() {
  const consultores = _getConsultores();
  if (!consultores.length) return null;

  const total     = consultores.length;
  const idx       = _currentIndex % total;
  const consultor = consultores[idx];

  // Incremento atômico em memória — sem race condition
  _currentIndex = (idx + 1) % total;

  // Persiste de forma assíncrona e com debounce
  _scheduleSave(_currentIndex);

  console.log(`[ROUND-ROBIN] 🔄 Atribuindo consultor ${idx + 1}/${total}: ${consultor}`);
  return consultor;
}

function listarConsultores() {
  return _getConsultores();
}

module.exports = { proximoConsultor, listarConsultores };

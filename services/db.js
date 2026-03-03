/**
 * =============================================================
 *  services/db.js — Banco de Dados SQLite
 * =============================================================
 *  Inicializa o banco de dados SQLite usando better-sqlite3.
 *  Cria as tabelas 'leads' e 'logs' se não existirem.
 *
 *  Tabelas:
 *   leads  → cada lead/prospect captado pelo bot
 *   logs   → histórico de eventos por lead
 *
 *  O banco é a fonte da verdade. Google Sheets é sincronização.
 * =============================================================
 */

'use strict';

const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

// ── Garante que a pasta data/ existe ──────────────────────────
const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'leads.db');
const db      = new Database(DB_PATH);

// WAL mode: melhor performance em leituras concorrentes
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Criação das tabelas ───────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    nome              TEXT,
    numero            TEXT    UNIQUE NOT NULL,
    curso_interesse   TEXT,
    status            TEXT    NOT NULL DEFAULT 'NOVO',
    responsavel       TEXT,
    created_at        TEXT    NOT NULL,
    first_response_at TEXT,
    updated_at        TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo_evento TEXT NOT NULL,
    descricao   TEXT,
    numero_lead TEXT,
    created_at  TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_leads_numero ON leads (numero);
  CREATE INDEX IF NOT EXISTS idx_leads_status ON leads (status);
  CREATE INDEX IF NOT EXISTS idx_logs_numero  ON logs  (numero_lead);
`);

console.log(`[DB] ✅ SQLite inicializado: ${DB_PATH}`);

module.exports = db;

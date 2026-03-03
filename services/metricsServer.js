/**
 * =============================================================
 *  services/metricsServer.js — Endpoint de Métricas
 * =============================================================
 *  Servidor Express que expõe métricas comerciais do bot.
 *  Consulta o banco SQLite diretamente (sem cache).
 *
 *  Configuração no .env:
 *    METRICS_PORT=4000  (padrão: 4000)
 *
 *  Endpoint disponível:
 *    GET http://localhost:4000/metrics
 *
 *  Retorno (JSON):
 *    {
 *      "total_leads": 50,
 *      "leads_mes_atual": 10,
 *      "total_convertidos": 5,
 *      "taxa_conversao_pct": 10.0,
 *      "tempo_medio_primeira_resposta_min": 3.2,
 *      "leads_por_status": {
 *        "NOVO": 30,
 *        "EM_ATENDIMENTO": 15,
 *        "CONVERTIDO": 5,
 *        "PERDIDO": 0
 *      },
 *      "top_interesses": [
 *        { "curso": "Sobre a Integra Psicanálise", "total": 12 }
 *      ],
 *      "gerado_em": "2026-03-03T14:35:22.000Z"
 *    }
 *
 *  Segurança:
 *   - Apenas métricas agregadas (sem dados pessoais expostos)
 *   - Use um proxy reverso (nginx) para restringir acesso externo
 * =============================================================
 */

'use strict';

const express = require('express');
const db      = require('./db');

// ────────────────────────────────────────────────────────────
//  Queries reutilizáveis (compiladas uma vez → mais rápidas)
// ────────────────────────────────────────────────────────────

const stmtTotal       = db.prepare("SELECT COUNT(*) AS n FROM leads");
const stmtConvertidos = db.prepare("SELECT COUNT(*) AS n FROM leads WHERE status = 'CONVERTIDO'");
const stmtPorStatus   = db.prepare("SELECT status, COUNT(*) AS n FROM leads GROUP BY status");
const stmtTempoMedio  = db.prepare(`
  SELECT AVG(
    (julianday(first_response_at) - julianday(created_at)) * 24 * 60
  ) AS media_min
  FROM leads
  WHERE first_response_at IS NOT NULL AND created_at IS NOT NULL
`);
const stmtTopInteresses = db.prepare(`
  SELECT curso_interesse AS curso, COUNT(*) AS total
  FROM leads
  WHERE curso_interesse IS NOT NULL AND curso_interesse != ''
  GROUP BY curso_interesse
  ORDER BY total DESC
  LIMIT 10
`);

// ────────────────────────────────────────────────────────────
//  Handler do endpoint /metrics
// ────────────────────────────────────────────────────────────

function buildMetrics() {
  // Total geral
  const totalLeads = stmtTotal.get().n;

  // Leads do mês atual (comparação por prefixo ISO: YYYY-MM)
  const agora       = new Date();
  const mesInicio   = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
  const leadsMes    = db.prepare(
    'SELECT COUNT(*) AS n FROM leads WHERE created_at >= ?'
  ).get(mesInicio).n;

  // Convertidos e taxa
  const totalConvertidos = stmtConvertidos.get().n;
  const taxaConversao    = totalLeads > 0
    ? parseFloat(((totalConvertidos / totalLeads) * 100).toFixed(1))
    : 0;

  // Tempo médio de primeira resposta (em minutos)
  const tempoRow    = stmtTempoMedio.get();
  const tempoMedio  = tempoRow.media_min != null
    ? parseFloat(tempoRow.media_min.toFixed(1))
    : null;

  // Distribuição por status
  const porStatus = { NOVO: 0, EM_ATENDIMENTO: 0, CONVERTIDO: 0, PERDIDO: 0 };
  for (const row of stmtPorStatus.all()) {
    if (Object.prototype.hasOwnProperty.call(porStatus, row.status)) {
      porStatus[row.status] = row.n;
    }
  }

  // Top cursos de interesse
  const topInteresses = stmtTopInteresses.all();

  return {
    total_leads:                        totalLeads,
    leads_mes_atual:                    leadsMes,
    total_convertidos:                  totalConvertidos,
    taxa_conversao_pct:                 taxaConversao,
    tempo_medio_primeira_resposta_min:  tempoMedio,
    leads_por_status:                   porStatus,
    top_interesses:                     topInteresses,
    gerado_em:                          new Date().toISOString(),
  };
}

// ────────────────────────────────────────────────────────────
//  Inicialização do servidor
// ────────────────────────────────────────────────────────────

function startMetricsServer() {
  const port = parseInt(process.env.METRICS_PORT || '4000', 10);
  const app  = express();

  // Remove header X-Powered-By (boa prática de segurança)
  app.disable('x-powered-by');

  // ── GET /metrics ──────────────────────────────────────────
  app.get('/metrics', (_req, res) => {
    try {
      const metricas = buildMetrics();
      res.json(metricas);
    } catch (err) {
      console.error('[METRICS] ❌ Erro ao gerar métricas:', err.message);
      res.status(500).json({ error: 'Erro interno ao calcular métricas.' });
    }
  });

  // ── GET /health ────────────────────────────────────────────
  // Endpoint simples para health check (PM2, Docker, etc.)
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime_s: Math.floor(process.uptime()) });
  });

  // ── Rota não encontrada ────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ error: 'Endpoint não encontrado.' });
  });

  app.listen(port, () => {
    console.log(`[METRICS] 📊 Endpoint de métricas: http://localhost:${port}/metrics`);
    console.log(`[METRICS] 🏥 Health check:         http://localhost:${port}/health`);
  });
}

module.exports = { startMetricsServer };

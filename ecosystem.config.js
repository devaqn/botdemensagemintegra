/**
 * =============================================================
 *  ecosystem.config.js — Configuração PM2 para VPS
 * =============================================================
 *  Gerenciador de processos para manter o bot rodando 24/7.
 *
 *  Comandos essenciais:
 *    npm install -g pm2          → instala o PM2 globalmente
 *    pm2 start ecosystem.config.js  → inicia o bot
 *    pm2 stop integra-bot            → para o bot
 *    pm2 restart integra-bot         → reinicia
 *    pm2 logs integra-bot            → ver logs em tempo real
 *    pm2 status                      → ver status de todos os apps
 *    pm2 save                        → salva lista de apps
 *    pm2 startup                     → auto-iniciar no boot do servidor
 * =============================================================
 */

module.exports = {
  apps: [
    {
      // ── Identificação ──────────────────────────────────
      name: 'integra-bot',
      script: './index.js',

      // ── Ambiente ───────────────────────────────────────
      env: {
        NODE_ENV: 'production',
      },

      // ── Reinicialização automática ─────────────────────
      autorestart: true,          // reinicia se o processo morrer
      watch: false,               // NÃO usa watch (causa problemas com auth_info)
      max_memory_restart: '400M', // reinicia se usar mais de 400MB de RAM

      // Aguarda 5s antes de cada tentativa de reinício
      restart_delay: 5000,
      // Backoff exponencial entre reinícios (evita loop rápido)
      exp_backoff_restart_delay: 100,
      // Máximo de reinícios em janela de tempo (evita crash loop)
      max_restarts: 10,

      // ── Logs ───────────────────────────────────────────
      // Cria a pasta logs/ automaticamente se não existir
      error_file: './logs/error.log',
      out_file:   './logs/out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',

      // ── Desempenho ─────────────────────────────────────
      // Single instance para WhatsApp (não pode ter 2 conexões)
      instances: 1,
      exec_mode: 'fork',

      // ── Graceful shutdown ──────────────────────────────
      // Tempo máximo para o bot fechar antes do PM2 forçar
      kill_timeout: 5000,
      // Tempo para considerar o app "estável" após iniciar
      min_uptime: '10s',
    },
  ],
};

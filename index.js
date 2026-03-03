/**
 * =============================================================
 *  index.js — Ponto de Entrada da Aplicação
 * =============================================================
 *  Este arquivo tem responsabilidade única: iniciar o bot.
 *  Toda a lógica de negócio fica dentro de src/.
 *
 *  Dois modos de operação:
 *
 *  ── Modo Baileys (padrão, USE_CLOUD_API=false) ──────────────
 *    index.js
 *      └─ src/connection.js       → conexão WebSocket com WhatsApp
 *           ├─ src/messageHandler.js → roteia e responde mensagens
 *           │    ├─ src/menus.js      → textos formatados
 *           │    └─ src/content.js    → dados da instituição
 *           └─ auth_info_integra/    → credenciais de sessão
 *
 *  ── Modo Cloud API (USE_CLOUD_API=true) ─────────────────────
 *    index.js
 *      └─ src/webhookServer.js    → servidor HTTP + sockCloud
 *           ├─ src/cloudApi.js    → chamadas à Meta Graph API
 *           └─ src/messageHandler.js → mesma lógica de negócio
 *
 *  Como rodar (Baileys):
 *    1. cp .env.example .env  →  edite ADMIN_WHATSAPP
 *    2. npm install
 *    3. npm run dev           →  escaneie o QR code
 *
 *  Como rodar (Cloud API):
 *    1. cp .env.example .env  →  edite ADMIN_WHATSAPP + tokens Cloud
 *    2. USE_CLOUD_API=true no .env
 *    3. npm install
 *    4. npm run dev
 *    5. Configure o webhook no Meta Developer Console
 * =============================================================
 */

'use strict';

// Carrega .env ANTES de qualquer require de módulo de negócio,
// para que USE_CLOUD_API e demais variáveis já estejam disponíveis.
require('dotenv').config();

// ── Banner de inicialização ───────────────────────────────────
console.log('\n' + '═'.repeat(52));
console.log('   🧠  INTEGRA PSICANÁLISE — BOT WHATSAPP  🧠');
console.log('═'.repeat(52));
console.log('   Desenvolvido por: Pedro Miguel');
console.log('─'.repeat(52));

// ── Servidor de métricas (sempre ativo, independente do modo) ─
// Disponível em http://localhost:METRICS_PORT/metrics (padrão: 4000)
const { startMetricsServer } = require('./services/metricsServer');
startMetricsServer();

// ── Escolha do modo de operação ───────────────────────────────
const USE_CLOUD_API = process.env.USE_CLOUD_API === 'true';

if (USE_CLOUD_API) {
  // ── Modo WhatsApp Business Cloud API (Meta) ─────────────────
  // Inicia servidor HTTP que recebe mensagens pelo webhook.
  // Suporta botões interativos e listas clicáveis reais.
  console.log('   Modo: 🌐 WhatsApp Business Cloud API\n');

  const { startWebhookServer } = require('./src/webhookServer');
  const { handleMessage }      = require('./src/messageHandler');

  startWebhookServer(handleMessage);

} else {
  // ── Modo Baileys (WhatsApp Web, padrão) ─────────────────────
  // Conexão via QR code, sem necessidade de conta Business.
  console.log('   Modo: 📱 Baileys (WhatsApp Web)\n');
  console.log('   Iniciando servidor...\n');

  const { startConnection } = require('./src/connection');

  // startConnection() vai:
  //  1. Carregar credenciais salvas (pasta auth_info_integra/)
  //  2. Se não houver → exibir QR code no terminal para primeiro login
  //  3. Ao conectar → registrar listener de mensagens
  //  4. Reconectar automaticamente se a conexão cair
  startConnection();
}

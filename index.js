/**
 * =============================================================
 *  index.js — Ponto de Entrada da Aplicação
 * =============================================================
 *  Este arquivo tem responsabilidade única: iniciar o bot.
 *  Toda a lógica de negócio fica dentro de src/.
 *
 *  Árvore de dependências:
 *
 *    index.js
 *      └─ src/connection.js       → gerencia conexão WebSocket com WhatsApp
 *           ├─ src/messageHandler.js → roteia e responde cada mensagem
 *           │    ├─ src/menus.js      → monta os textos formatados de resposta
 *           │    └─ src/content.js    → dados da instituição (editável)
 *           └─ auth_info_integra/    → credenciais de sessão (gerado em runtime)
 *
 *  Como rodar:
 *    Desenvolvimento:  npm run dev       (reinicia ao salvar arquivos)
 *    Produção (PM2):   npm run pm2:start (processo persistente em background)
 *
 *  Primeiro uso:
 *    1. cp .env.example .env
 *    2. Edite o .env com o número do admin
 *    3. npm install
 *    4. npm run dev
 *    5. Escaneie o QR code com o WhatsApp
 * =============================================================
 */

'use strict';

const { startConnection } = require('./src/connection');

// ── Banner de inicialização no console ────────────────────────
console.log('\n' + '═'.repeat(52));
console.log('   🧠  INTEGRA PSICANÁLISE — BOT WHATSAPP  🧠');
console.log('═'.repeat(52));
console.log('   Desenvolvido por: Pedro Miguel');
console.log('   GitHub: github.com/devaqn');
console.log('─'.repeat(52));
console.log('   Iniciando servidor...\n');

// ── Inicia a conexão WhatsApp ─────────────────────────────────
// startConnection() vai:
//  1. Carregar credenciais salvas (pasta auth_info_integra/)
//  2. Se não houver → exibir QR code no terminal para primeiro login
//  3. Ao conectar → registrar listener de mensagens
//  4. Reconectar automaticamente se a conexão cair
startConnection();

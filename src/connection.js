/**
 * =============================================================
 *  connection.js — Gerenciamento de Conexão WhatsApp
 * =============================================================
 *  Responsabilidades:
 *   1. Criar e configurar o socket WebSocket com o WhatsApp
 *   2. Exibir QR code no terminal (primeiro login)
 *   3. Persistir sessão em disco (pasta auth_info_integra/)
 *   4. Reconectar automaticamente com backoff linear ao cair
 *   5. Encerrar de forma limpa ao receber SIGTERM/SIGINT (PM2)
 *
 *  Fluxo de conexão:
 *    startConnection()
 *      ├─ carrega credenciais (useMultiFileAuthState)
 *      ├─ cria socket (makeWASocket)
 *      └─ escuta eventos:
 *           ├─ connection.update → QR / conectado / desconectado
 *           ├─ creds.update      → salva credenciais atualizadas
 *           └─ messages.upsert   → novas mensagens → handleMessage()
 *
 *  BUGs corrigidos nesta versão:
 *   [FIX 1] fetchLatestBaileysVersion sem try/catch → bot travava se
 *           não houvesse internet na inicialização. Adicionado fallback.
 *   [FIX 2] setTimeout de reconexão não armazenado → não era possível
 *           cancelar o timer no gracefulShutdown. Adicionado timerId.
 *   [FIX 3] Flag 'encerrando' ausente → race condition entre
 *           connection.update e gracefulShutdown podia causar
 *           tentativa de reconexão após shutdown intencional.
 * =============================================================
 */

'use strict';

const fs = require('fs');

const {
  default: makeWASocket,        // função principal: cria o socket WhatsApp
  useMultiFileAuthState,        // carrega/salva sessão em múltiplos arquivos
  DisconnectReason,             // enum com códigos de desconexão (ex: 401 = logout)
  fetchLatestBaileysVersion,    // busca versão mais recente do protocolo WA Web
  makeCacheableSignalKeyStore,  // adiciona cache em memória ao store de chaves Signal
} = require('@whiskeysockets/baileys');

const pino   = require('pino');            // logger de alta performance (usado internamente)
const qrcode = require('qrcode-terminal'); // renderiza QR code ASCII no terminal
const { handleMessage, verificarAdmin, atualizarCacheContatos } = require('./messageHandler'); // lógica de resposta

// ────────────────────────────────────────────────────────────
//  Configurações de produção
// ────────────────────────────────────────────────────────────

const AUTH_FOLDER     = './auth_info_integra'; // pasta onde as credenciais são persistidas
const MAX_RECONEXOES  = 10;                    // máximo de reconexões antes de reiniciar processo
const DELAY_RECONEXAO = 5_000;                 // ms de espera base entre reconexões (backoff linear)

// ────────────────────────────────────────────────────────────
//  Estado de reconexão (variáveis de módulo — persistem entre chamadas)
// ────────────────────────────────────────────────────────────

let tentativasReconexao = 0;     // contador de tentativas na sessão atual
let sockAtivo           = null;  // referência ao socket ativo (usado no gracefulShutdown)
let timerId             = null;  // [FIX 2] referência ao timer de reconexão agendado
let encerrando          = false; // [FIX 3] flag: impede nova reconexão após shutdown intencional

// ────────────────────────────────────────────────────────────
//  Logger com timestamp em horário de Brasília
// ────────────────────────────────────────────────────────────

/**
 * Imprime mensagem formatada no console com timestamp PT-BR.
 * @param {'info'|'ok'|'warn'|'erro'|'bot'} nivel - Nível visual do log
 * @param {string} msg - Mensagem a exibir
 */
function log(nivel, msg) {
  // Formata data/hora no fuso de Brasília (UTC-3)
  const ts = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  // Mapa de ícones por nível
  const ícones = { info: 'ℹ️ ', ok: '✅', warn: '⚠️ ', erro: '❌', bot: '🤖' };

  console.log(`[${ts}] ${ícones[nivel] || ''} ${msg}`);
}

// ────────────────────────────────────────────────────────────
//  Graceful Shutdown — encerramento seguro
// ────────────────────────────────────────────────────────────

/**
 * Encerra o bot de forma limpa ao receber SIGTERM (PM2 stop/restart)
 * ou SIGINT (Ctrl+C no terminal).
 *
 * Sequência de encerramento:
 *  1. Seta flag 'encerrando' → impede reconexão automática em eventos concorrentes
 *  2. Cancela timer de reconexão pendente (se o bot estava aguardando para tentar novamente)
 *  3. Fecha o socket WebSocket graciosamente
 *  4. Sai com código 0 (sucesso — PM2 não conta como falha)
 *
 * @param {string} sinal - Nome do sinal recebido ('SIGTERM' ou 'SIGINT')
 */
async function gracefulShutdown(sinal) {
  // Evita dupla execução se dois sinais chegarem simultaneamente
  if (encerrando) return;
  encerrando = true;

  log('warn', `Sinal ${sinal} recebido. Encerrando bot com segurança...`);

  // [FIX 2] Cancela reconexão agendada para não disparar após o shutdown
  if (timerId) {
    clearTimeout(timerId);
    timerId = null;
  }

  // Fecha o socket WebSocket do WhatsApp graciosamente
  if (sockAtivo) {
    try {
      sockAtivo.end(undefined); // instrui o Baileys a encerrar a conexão WS
    } catch (_) {
      // Ignora erros no fechamento — o processo vai terminar de qualquer forma
    }
  }

  log('ok', 'Bot encerrado com segurança.');
  process.exit(0);
}

// Registra handlers para sinais de encerramento do sistema operacional
process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // enviado pelo PM2 ao parar/reiniciar
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));  // gerado pelo Ctrl+C no terminal

// ────────────────────────────────────────────────────────────
//  Tratamento de erros não capturados
// ────────────────────────────────────────────────────────────

/**
 * Captura exceções JavaScript não tratadas (bugs inesperados no código).
 * Loga o erro completo sem derrubar o processo imediatamente.
 * O PM2 reiniciará o processo se ele travar via max_restarts/autorestart.
 */
process.on('uncaughtException', (err) => {
  log('erro', `Exceção não capturada: ${err.message}`);
  console.error(err.stack); // stack trace completo para diagnóstico
});

/**
 * Captura Promises rejeitadas sem um .catch() correspondente.
 * Evita que erros silenciosos passem despercebidos em operações assíncronas.
 */
process.on('unhandledRejection', (reason) => {
  log('warn', `Promise rejeitada sem handler: ${reason}`);
});

// ────────────────────────────────────────────────────────────
//  Inicialização da conexão WhatsApp
// ────────────────────────────────────────────────────────────

/**
 * Cria e inicializa o socket WhatsApp com todas as configurações.
 * É chamada uma vez no startup e novamente em cada reconexão automática.
 *
 * Não retorna nada — opera via eventos (connection.update, messages.upsert).
 */
async function startConnection() {

  // [FIX 3] Impede inicialização se já estamos em processo de shutdown
  if (encerrando) return;

  // ── Carrega (ou cria) as credenciais de sessão salvas em disco ────────────
  // useMultiFileAuthState salva cada tipo de dado (keys, creds) em arquivos
  // separados, o que é mais robusto que um arquivo JSON único (evita corrupção).
  // Na primeira execução, cria a pasta e credenciais zeradas → QR code será gerado.
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);

  // ── [FIX 1] Busca versão mais recente do protocolo WhatsApp Web ──────────
  // fetchLatestBaileysVersion faz uma requisição HTTP externa. Se a rede estiver
  // indisponível no momento do startup, o bot travava com UnhandledRejection.
  // Solução: try/catch com versão fallback conhecida como estável.
  let version = [2, 3000, 1015901307]; // versão fallback (última conhecida estável)
  try {
    const result = await fetchLatestBaileysVersion();
    version = result.version;
    log('info', `Protocolo WA: v${version.join('.')} ${result.isLatest ? '(latest ✅)' : '(desatualizado — considere atualizar o Baileys)'}`);
  } catch (err) {
    log('warn', `Não foi possível buscar versão do protocolo WA (${err.message}). Usando fallback: v${version.join('.')}`);
  }

  // ── Cria o socket WebSocket com configurações de produção ────────────────
  const sock = makeWASocket({
    version, // versão do protocolo WA Web negociada

    // Autenticação: credenciais de login + chaves criptográficas do Signal Protocol
    auth: {
      creds: state.creds, // identidade do dispositivo (chave pública/privada, registro, etc.)
      keys:  makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
      // makeCacheableSignalKeyStore: envolve o store de disco com um cache em memória,
      // reduzindo I/O ao decriptar mensagens (especialmente útil em alto volume)
    },

    logger: pino({ level: 'silent' }), // silencia o logger interno do Baileys em produção
    printQRInTerminal: false,           // desativado: gerenciamos o QR manualmente abaixo
    markOnlineOnConnect: false,         // não exibe o bot como "online" ao conectar

    // Identificador do "browser" enviado ao WhatsApp (aparece em "Dispositivos Vinculados")
    browser: ['Integra Psicanálise Bot', 'Chrome', '1.0.0'],

    // Desativa geração de preview de links (economiza banda e processamento no servidor)
    generateHighQualityLinkPreview: false,

    // Timeouts para estabilidade em VPS com conexão variável ou latência alta
    connectTimeoutMs:    60_000, // 60s para estabelecer a conexão inicial
    keepAliveIntervalMs: 30_000, // ping a cada 30s para manter a conexão ativa (evita timeout)
  });

  sockAtivo = sock; // [FIX 2] salva referência global para uso no gracefulShutdown

  // ────────────────────────────────────────────────────────────
  //  Evento: atualização de status da conexão
  // ────────────────────────────────────────────────────────────

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    // ── QR code recebido ────────────────────────────────────────────────────
    // Ocorre quando não há credenciais salvas ou a sessão expirou.
    // O usuário deve escanear o código com: WhatsApp > Dispositivos Vinculados > Vincular.
    if (qr) {
      console.clear();
      console.log('\n' + '═'.repeat(54));
      console.log('   🧠  INTEGRA PSICANÁLISE — BOT WHATSAPP  🧠');
      console.log('═'.repeat(54));
      console.log('\n   📱 Abra o WhatsApp > Dispositivos Vinculados > Vincular:\n');
      qrcode.generate(qr, { small: true }); // small: true → QR menor e mais legível no terminal
      console.log('\n   ⏳ Aguardando leitura do QR code...\n');
      tentativasReconexao = 0; // reseta contador: usuário está interagindo ativamente
    }

    // ── Conexão encerrada ───────────────────────────────────────────────────
    // Pode ocorrer por: logout manual, rede instável, sessão expirada, ban, etc.
    if (connection === 'close') {

      // Extrai o código HTTP de status do erro de desconexão (pode ser undefined)
      const statusCode = lastDisconnect?.error?.output?.statusCode;

      // Código 401 = logout intencional (usuário removeu o dispositivo no celular)
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      if (loggedOut) {
        log('erro', 'Sessao expirada ou removida pelo usuario no celular.');
        log('info', 'Apagando pasta de autenticacao automaticamente...');
        try {
          fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
          log('ok', `Pasta "${AUTH_FOLDER}" removida. Reiniciando para novo QR code...`);
        } catch (e) {
          log('warn', `Nao foi possivel remover "${AUTH_FOLDER}": ${e.message}`);
        }
        process.exit(1); // PM2 reinicia → QR code novo gerado automaticamente
      }

      // [FIX 3] Não tenta reconectar se estamos em processo de shutdown intencional
      if (encerrando) return;

      // Limite de tentativas atingido → reinicia o processo
      // O PM2 cuidará do restart com o backoff configurado no ecosystem.config.js
      if (tentativasReconexao >= MAX_RECONEXOES) {
        log('erro', `Limite de ${MAX_RECONEXOES} reconexões atingido. PM2 reiniciará o processo...`);
        process.exit(1);
      }

      // Incrementa contador e agenda reconexão com backoff linear:
      // 1ª tentativa: 5s | 2ª: 10s | 3ª: 15s | ... | 10ª: 50s
      tentativasReconexao++;
      const delay = DELAY_RECONEXAO * tentativasReconexao;
      log('warn', `Conexão perdida (código: ${statusCode ?? 'desconhecido'}). Tentativa ${tentativasReconexao}/${MAX_RECONEXOES} em ${delay / 1000}s...`);

      // [FIX 2] Armazena referência do timer para poder cancelar no gracefulShutdown
      timerId = setTimeout(startConnection, delay);
    }

    // ── Conexão estabelecida com sucesso ────────────────────────────────────
    if (connection === 'open') {
      tentativasReconexao = 0; // reseta contador: conexão saudável
      timerId = null;          // timer não está mais ativo
      console.clear();
      console.log('\n' + '═'.repeat(54));
      console.log('   ✅  BOT CONECTADO COM SUCESSO!');
      console.log('   🧠  Integra Psicanálise — A Nova Escola');
      console.log('─'.repeat(54));
      console.log('   👨‍💻 Desenvolvido por: Pedro Miguel');
      console.log('   🔗 github.com/devaqn');
      console.log('═'.repeat(54));
      log('ok',  'Bot online e pronto para atender.');
      log('bot', 'Aguardando mensagens... (use "npm run pm2:stop" para encerrar)');
      console.log();

      // Verifica se o número do admin (ADMIN_WHATSAPP no .env) está ativo no WhatsApp.
      // Aguarda 3s para a conexão estabilizar antes de fazer a consulta.
      // Se o número estiver errado, exibe aviso claro no console.
      setTimeout(() => verificarAdmin(sock), 3_000);
    }
  });

  // ────────────────────────────────────────────────────────────
  //  Evento: salva credenciais ao atualizar
  // ────────────────────────────────────────────────────────────
  sock.ev.on('creds.update', saveCreds);

  // ────────────────────────────────────────────────────────────
  //  Evento: atualização de contatos (popula cache LID → telefone)
  // ────────────────────────────────────────────────────────────
  // O WhatsApp usa LIDs (Linked IDs) para contatos salvos no dispositivo.
  // Quando o Baileys recebe informações de contatos, registramos o mapeamento
  // LID → número de telefone para que as notificações ao admin tenham o link wa.me correto.
  // contacts.upsert → sincronização inicial e novos contatos
  sock.ev.on('contacts.upsert', (contacts) => {
    atualizarCacheContatos(contacts);
  });

  // contacts.update → contatos já existentes que tiveram dados atualizados
  // (inclui o momento em que o WhatsApp atribui/atualiza o LID de um contato)
  sock.ev.on('contacts.update', (updates) => {
    atualizarCacheContatos(updates);
  });

  // ────────────────────────────────────────────────────────────
  //  Evento: novas mensagens recebidas
  // ────────────────────────────────────────────────────────────
  sock.ev.on('messages.upsert', async ({ messages, type }) => {

    // 'notify' = mensagem nova em tempo real → processar
    // 'append' = histórico sendo sincronizado ao conectar → ignorar
    if (type !== 'notify') return;

    for (const message of messages) {
      // Ignora mensagens enviadas pelo próprio bot (evita loop de auto-resposta)
      if (message.key.fromMe) continue;

      // Ignora atualizações de status/story do WhatsApp (broadcast especial)
      if (message.key.remoteJid === 'status@broadcast') continue;

      // Processa cada mensagem com tratamento de erro individual.
      // Assim, um erro em uma mensagem não interrompe o processamento das demais.
      try {
        await handleMessage(sock, message);
      } catch (err) {
        log('erro', `Erro ao processar mensagem de ${message.key.remoteJid}: ${err.message}`);
        console.error(err.stack); // stack trace para diagnóstico detalhado
      }
    }
  });
}

module.exports = { startConnection };

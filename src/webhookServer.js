/**
 * =============================================================
 *  webhookServer.js — Servidor Webhook para Cloud API
 * =============================================================
 *  Este arquivo faz dois trabalhos:
 *
 *  1. SERVIDOR HTTP:
 *     Recebe eventos do Meta (GET /webhook = verificação,
 *     POST /webhook = mensagens recebidas) e repassa cada
 *     mensagem para o messageHandler.js.
 *
 *  2. OBJETO sockCloud:
 *     Emula a interface do Baileys (sock) para que o
 *     messageHandler.js funcione SEM nenhuma modificação
 *     nos métodos de envio — apenas troca o transporte.
 *
 *  Variáveis necessárias no .env:
 *    WHATSAPP_WEBHOOK_VERIFY_TOKEN  → Token para verificação inicial
 *    PORT                           → Porta HTTP (padrão: 3000)
 *
 *  Como funciona a verificação do Meta:
 *    1. Você configura https://seu-dominio.com/webhook no Meta
 *    2. Meta envia GET /webhook?hub.mode=subscribe&hub.verify_token=XXX&hub.challenge=YYY
 *    3. Se o token bater, respondemos com o challenge → webhook verificado
 *    4. Dali em diante, o Meta envia POST /webhook com cada mensagem
 * =============================================================
 */

'use strict';

require('dotenv').config();

const http     = require('http');  // módulo nativo
const cloudApi = require('./cloudApi');

// ── Configuração ──────────────────────────────────────────────────────────────

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'integra_bot_webhook';
const PORT         = parseInt(process.env.PORT || '3000', 10);

// ── Adaptador de mensagem ─────────────────────────────────────────────────────

/**
 * Converte o formato de mensagem da Cloud API para o formato Baileys-like
 * que o messageHandler.js espera.
 *
 * Formato Cloud API (entrada):
 *  {
 *    from: '5581999999999',
 *    id: 'wamid.xxx',
 *    type: 'text' | 'interactive' | 'image' | ...,
 *    text?: { body: 'texto' },
 *    interactive?: {
 *      type: 'button_reply' | 'list_reply',
 *      button_reply?: { id: 'btn_x', title: 'Texto' },
 *      list_reply?:   { id: 'btn_x', title: 'Texto' },
 *    }
 *  }
 *
 * Formato Baileys-like (saída) — o que messageHandler.js consome:
 *  {
 *    key: { remoteJid: '5581...@s.whatsapp.net', id: 'wamid.xxx', fromMe: false },
 *    pushName: 'Nome do contato',
 *    message: {
 *      conversation?: 'texto',
 *      buttonsResponseMessage?: { selectedButtonId: 'btn_x' },
 *      listResponseMessage?: { singleSelectReply: { selectedRowId: 'btn_x' } },
 *    }
 *  }
 *
 * Por que adaptar em vez de alterar o messageHandler?
 *  Porque o messageHandler.js já tem toda a lógica de roteamento correta.
 *  A adaptação permite trocar o transporte (Baileys ↔ Cloud API) sem
 *  reescrever a lógica de negócio.
 *
 * @param {object} msgCloud  - Objeto de mensagem no formato da Cloud API
 * @param {object} [contato] - Objeto de contato (contém o nome do usuário)
 * @returns {object} Mensagem no formato Baileys-like
 */
function adaptarMensagem(msgCloud, contato) {
  const jid      = `${msgCloud.from}@s.whatsapp.net`;
  const pushName = contato?.profile?.name || null;

  const baileys = {
    key: {
      remoteJid: jid,
      id:        msgCloud.id,
      fromMe:    false,
    },
    pushName,
    message: {},
  };

  // ── Mensagem de texto simples ──────────────────────────────────────────────
  if (msgCloud.type === 'text') {
    baileys.message.conversation = msgCloud.text?.body || '';
    return baileys;
  }

  // ── Resposta interativa (botão ou lista) ───────────────────────────────────
  if (msgCloud.type === 'interactive') {
    const inter = msgCloud.interactive;

    // Botão clicado → traduz para buttonsResponseMessage (Baileys)
    if (inter?.type === 'button_reply') {
      baileys.message.buttonsResponseMessage = {
        selectedButtonId:    inter.button_reply.id,
        selectedDisplayText: inter.button_reply.title,
      };
      return baileys;
    }

    // Item de lista selecionado → traduz para listResponseMessage (Baileys)
    if (inter?.type === 'list_reply') {
      baileys.message.listResponseMessage = {
        singleSelectReply: {
          selectedRowId: inter.list_reply.id,
        },
        title: inter.list_reply.title,
      };
      return baileys;
    }
  }

  // ── Outros tipos (imagem, áudio, sticker, etc.) ───────────────────────────
  // Retorna mensagem sem content → messageHandler vai pedir texto + menu
  return baileys;
}

// ── Objeto sockCloud ──────────────────────────────────────────────────────────

/**
 * Cria e retorna um objeto que emula a interface do Baileys `sock`.
 *
 * O messageHandler.js usa estes métodos do sock:
 *  - sendMessage(jid, payload)      → envia texto simples
 *  - readMessages([key])            → marca como lida
 *  - sendPresenceUpdate(state, jid) → indicador de digitação (no-op na Cloud API)
 *  - onWhatsApp(phone)              → verifica se número existe (sempre true na Cloud API)
 *
 * @returns {object} Objeto compatível com a interface do Baileys sock
 */
function criarSockCloud() {
  return {

    /**
     * Extrai o número de telefone de um JID do WhatsApp.
     * Ex: '5581999999999@s.whatsapp.net' → '5581999999999'
     *     '5581999999999@lid'             → '5581999999999'
     */
    _extrairNumero(jid) {
      return jid.split('@')[0];
    },

    /** Envia mensagem de texto simples. */
    async sendMessage(jid, payload) {
      const para = this._extrairNumero(jid);
      if (payload.text) return cloudApi.enviarTexto(para, payload.text);
      console.warn('[CLOUD] sendMessage: payload nao reconhecido →',
        JSON.stringify(payload).slice(0, 100));
    },

    /**
     * Marca mensagens como lidas (✓✓ azul).
     * @param {Array} keys - Array de { id, ... } (chave da mensagem)
     */
    async readMessages(keys) {
      try {
        for (const key of keys) {
          if (key?.id) await cloudApi.marcarLida(key.id);
        }
      } catch (_) {
        // Falha silenciosa — não interrompe o fluxo de atendimento
      }
    },

    /**
     * Indicador de "digitando..." — no-op na Cloud API.
     * A Cloud API não suporta presença/digitando. O bot ainda aguarda
     * o delay calculado em simularDigitando() para parecer humano.
     */
    async sendPresenceUpdate() {},

    /**
     * Verifica se um número existe no WhatsApp.
     *
     * Na Cloud API não há equivalente ao onWhatsApp() do Baileys.
     * Retorna sempre exists:true com o JID construído manualmente.
     * O risco é baixo: se o admin configurou um número errado,
     * a mensagem simplesmente não chegará e o console mostrará erro.
     *
     * @param {string} phone - Número de telefone
     * @returns {Array<{exists: boolean, jid: string}>}
     */
    async onWhatsApp(phone) {
      const num = Array.isArray(phone) ? phone[0] : phone;
      return [{ exists: true, jid: `${num}@s.whatsapp.net` }];
    },

  };
}

// ── Servidor HTTP ─────────────────────────────────────────────────────────────

/**
 * Inicia o servidor HTTP que recebe eventos da Meta Webhook.
 *
 * Fluxo completo:
 *  1. Meta faz GET /webhook para verificar o endpoint (once)
 *  2. Meta faz POST /webhook para cada mensagem recebida
 *  3. Cada mensagem é adaptada para o formato Baileys e repassada ao handler
 *  4. O handler processa e envia a resposta usando o sockCloud
 *
 * @param {function} onMensagem - Callback: async (sock, msgBaileys) => void
 * @returns {object} sockCloud - O objeto que emula o sock do Baileys
 */
function startWebhookServer(onMensagem) {
  const sock = criarSockCloud();

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    // ── GET /webhook → verificação do Meta (feita uma única vez) ────────────
    if (req.method === 'GET' && url.pathname === '/webhook') {
      const mode      = url.searchParams.get('hub.mode');
      const token     = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('[CLOUD] ✅ Webhook verificado pelo Meta!');
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(challenge); // o Meta espera receber o challenge de volta
      } else {
        console.warn('[CLOUD] ❌ Falha na verificação do webhook — token incorreto.');
        console.warn(`[CLOUD]    Esperado: ${VERIFY_TOKEN} | Recebido: ${token}`);
        res.writeHead(403);
        res.end('Forbidden');
      }
      return;
    }

    // ── POST /webhook → mensagens e notificações recebidas ──────────────────
    if (req.method === 'POST' && url.pathname === '/webhook') {
      let corpo = '';
      req.on('data', (chunk) => { corpo += chunk; });
      req.on('end',  async () => {
        // Sempre responde 200 imediatamente ao Meta
        // (Meta considera falha se não receber 200 em 20s e vai reenviar)
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"status":"ok"}');

        try {
          const evento = JSON.parse(corpo);

          // A Cloud API aninha os dados: entry[] → changes[] → value → messages[]
          for (const entry of (evento.entry || [])) {
            for (const change of (entry.changes || [])) {
              const value = change?.value;

              // Ignora eventos que não são mensagens (ex: status de entrega)
              if (!value?.messages?.length) continue;

              const contatos  = value.contacts || [];
              const mensagens = value.messages;

              for (const msg of mensagens) {
                // Encontra o contato correspondente à mensagem (para ter o nome)
                const contatoMsg = contatos.find((c) => c.wa_id === msg.from);

                // Adapta para o formato Baileys que o messageHandler entende
                const msgBaileys = adaptarMensagem(msg, contatoMsg);

                // Processa em background com setImmediate para não bloquear o loop
                // e garantir que a resposta 200 já foi enviada ao Meta
                setImmediate(() => {
                  onMensagem(sock, msgBaileys).catch((err) => {
                    console.error('[CLOUD] ❌ Erro ao processar mensagem:', err.message);
                  });
                });
              }
            }
          }
        } catch (err) {
          console.error('[CLOUD] ❌ Erro ao parsear evento do webhook:', err.message);
        }
      });
      return;
    }

    // ── Qualquer outra rota ──────────────────────────────────────────────────
    res.writeHead(404);
    res.end('Not Found');
  });

  server.listen(PORT, () => {
    console.log(`[CLOUD] 🌐 Servidor webhook rodando na porta ${PORT}`);
    console.log(`[CLOUD] 📋 Configure no Meta Developer Console:`);
    console.log(`[CLOUD]    URL do webhook:  https://SEU_DOMINIO/webhook`);
    console.log(`[CLOUD]    Verify Token:    ${VERIFY_TOKEN}`);
    console.log(`[CLOUD]    Campos:          messages`);
    console.log(`[CLOUD] ✅ Bot aguardando mensagens...\n`);
  });

  // ── Encerramento gracioso ──────────────────────────────────────────────────
  process.on('SIGTERM', () => {
    console.log('[CLOUD] SIGTERM recebido — encerrando servidor...');
    server.close(() => process.exit(0));
  });
  process.on('SIGINT', () => {
    console.log('[CLOUD] SIGINT recebido — encerrando servidor...');
    server.close(() => process.exit(0));
  });

  return sock;
}

module.exports = { startWebhookServer };

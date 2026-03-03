/**
 * =============================================================
 *  cloudApi.js — Wrapper HTTP para Meta WhatsApp Cloud API
 * =============================================================
 *  Envia mensagens usando a API oficial do WhatsApp (Meta).
 *  Esta API suporta botões interativos e listas clicáveis,
 *  algo que o Baileys (modo WhatsApp Web) não renderiza mais.
 *
 *  Variáveis necessárias no .env:
 *    WHATSAPP_CLOUD_TOKEN       → Token de acesso permanente (Meta)
 *    WHATSAPP_PHONE_NUMBER_ID   → ID do número de telefone cadastrado
 *
 *  Referência:
 *    https://developers.facebook.com/docs/whatsapp/cloud-api/messages
 * =============================================================
 */

'use strict';

const https = require('https'); // módulo nativo — sem dependência extra

// ── Configuração ──────────────────────────────────────────────────────────────

const CLOUD_TOKEN = process.env.WHATSAPP_CLOUD_TOKEN;
const PHONE_ID    = process.env.WHATSAPP_PHONE_NUMBER_ID;
const API_VERSION = 'v20.0';

// ── Utilitário HTTP ───────────────────────────────────────────────────────────

/**
 * Faz uma requisição POST autenticada para a Cloud API.
 * Usa o módulo `https` nativo — sem axios, sem fetch, sem dependência extra.
 *
 * @param {object} payload - Corpo da requisição (será serializado como JSON)
 * @returns {Promise<object>} Resposta JSON da API
 * @throws {Error} Se a API retornar status >= 400 ou corpo inválido
 */
function postApi(payload) {
  return new Promise((resolve, reject) => {
    if (!CLOUD_TOKEN || !PHONE_ID) {
      return reject(new Error(
        '[CLOUD] WHATSAPP_CLOUD_TOKEN ou WHATSAPP_PHONE_NUMBER_ID não configurados no .env'
      ));
    }

    const corpo = JSON.stringify(payload);

    const opts = {
      hostname: 'graph.facebook.com',
      path:     `/${API_VERSION}/${PHONE_ID}/messages`,
      method:   'POST',
      headers: {
        'Authorization':  `Bearer ${CLOUD_TOKEN}`,
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(corpo),
      },
    };

    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end',  () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(json);
          } else {
            // Loga detalhe do erro da API para facilitar debug
            const erroMeta = json?.error?.message || JSON.stringify(json);
            reject(new Error(`[CLOUD] API ${res.statusCode}: ${erroMeta}`));
          }
        } catch (_) {
          reject(new Error(`[CLOUD] Resposta inválida da API: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', (err) => reject(new Error(`[CLOUD] Falha na requisição: ${err.message}`)));
    req.write(corpo);
    req.end();
  });
}

// ── Funções públicas ──────────────────────────────────────────────────────────

/**
 * Envia uma mensagem de texto simples.
 *
 * @param {string} para   - Número do destinatário (ex: '5581999999999')
 * @param {string} texto  - Texto da mensagem (suporta *negrito* e _itálico_)
 */
async function enviarTexto(para, texto) {
  return postApi({
    messaging_product: 'whatsapp',
    recipient_type:    'individual',
    to:                para,
    type:              'text',
    text:              { body: texto, preview_url: false },
  });
}

/**
 * Envia uma mensagem interativa com botões de resposta rápida.
 *
 * Limite da API: máximo 3 botões por mensagem. Botões além do terceiro são ignorados.
 * Limite de caracteres: título do botão = 20 chars.
 *
 * @param {string} para        - Número do destinatário
 * @param {string} textoCorpo  - Texto principal (obrigatório)
 * @param {Array}  botoes      - Array de { id, title } (máx 3)
 * @param {string} [rodape]    - Texto do rodapé (opcional)
 * @param {string} [cabecalho] - Texto do cabeçalho (opcional)
 */
async function enviarBotoes(para, textoCorpo, botoes, rodape, cabecalho) {
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type:    'individual',
    to:                para,
    type:              'interactive',
    interactive: {
      type: 'button',
      body: { text: textoCorpo || ' ' }, // body não pode ser vazio
      action: {
        buttons: botoes.slice(0, 3).map((b) => ({
          type:  'reply',
          reply: {
            id:    b.id.slice(0, 256),         // máx 256 chars no id
            title: b.title.slice(0, 20),        // máx 20 chars no título
          },
        })),
      },
    },
  };

  if (rodape)    payload.interactive.footer = { text: rodape.slice(0, 60) };
  if (cabecalho) payload.interactive.header = { type: 'text', text: cabecalho.slice(0, 60) };

  return postApi(payload);
}

/**
 * Envia uma mensagem interativa do tipo lista (menu).
 *
 * Ideal para menus com muitas opções (até 10 seções × 10 linhas).
 * O usuário toca no botão para abrir a lista e seleciona uma opção.
 *
 * Limites:
 *  - Título do botão da lista:   20 chars
 *  - Título de cada linha (row): 24 chars
 *  - Descrição de cada linha:    72 chars
 *  - Máximo de seções:           10
 *  - Máximo de linhas por seção: 10
 *
 * @param {string} para          - Número do destinatário
 * @param {string} textoCorpo    - Texto principal da mensagem
 * @param {string} textoBotao    - Texto do botão que abre a lista (ex: 'Ver opções')
 * @param {Array}  secoes        - Array de { title, rows: [{id, title, description}] }
 * @param {string} [rodape]      - Texto do rodapé (opcional)
 * @param {string} [cabecalho]   - Texto do cabeçalho (opcional)
 */
async function enviarLista(para, textoCorpo, textoBotao, secoes, rodape, cabecalho) {
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type:    'individual',
    to:                para,
    type:              'interactive',
    interactive: {
      type: 'list',
      body: { text: textoCorpo || ' ' },
      action: {
        button:   textoBotao.slice(0, 20),
        sections: secoes.map((s) => ({
          title: (s.title || '').slice(0, 24),
          rows:  s.rows.map((r) => ({
            id:          r.id.slice(0, 200),
            title:       r.title.slice(0, 24),
            description: (r.description || '').slice(0, 72),
          })),
        })),
      },
    },
  };

  if (rodape)    payload.interactive.footer = { text: rodape.slice(0, 60) };
  if (cabecalho) payload.interactive.header = { type: 'text', text: cabecalho.slice(0, 60) };

  return postApi(payload);
}

/**
 * Marca uma mensagem como lida (✓✓ azul no WhatsApp do usuário).
 *
 * @param {string} messageId - ID da mensagem recebida (ex: 'wamid.xxx...')
 */
async function marcarLida(messageId) {
  return postApi({
    messaging_product: 'whatsapp',
    status:            'read',
    message_id:        messageId,
  });
}

module.exports = { enviarTexto, enviarBotoes, enviarLista, marcarLida };

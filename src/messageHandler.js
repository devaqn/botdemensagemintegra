/**
 * =============================================================
 *  messageHandler.js — Lógica Central de Atendimento
 * =============================================================
 *  Este arquivo é o coração do bot. Ele:
 *   1. Recebe cada mensagem bruta do WhatsApp
 *   2. Identifica o tipo (texto, clique em botão, seleção de lista)
 *   3. Roteia para a resposta correta
 *   4. Envia a resposta formatada ao usuário
 *
 *  Modo de interface (controlado pelo .env):
 *   MODO_BOTOES=false (padrão) → menu em TEXTO numerado (WhatsApp pessoal)
 *   MODO_BOTOES=true           → botões clicáveis reais (WhatsApp Business)
 *
 *  ⚠️  Por que não há mais detecção automática?
 *  WhatsApp pessoal ACEITA buttonsMessage sem dar erro — ele só não
 *  renderiza os botões visualmente. O try/catch nunca caia no catch,
 *  então o bot sempre achava que era Business. A solução correta é
 *  configurar manualmente via MODO_BOTOES no .env.
 *
 *  Navegação por número (modo texto):
 *    1 → Sobre a Integra    4 → Condições e Benefícios
 *    2 → Formação e Módulos 5 → Unidade e Localização
 *    3 → Equipe Docente     6 → Contato / Agendamento
 *    7 → Falar com Consultor
 *    0 → Voltar ao menu
 * =============================================================
 */

'use strict';

require('dotenv').config(); // carrega variáveis do .env

const CONTENT = require('./content');
const {
  mensagemBoasVindas,
  saudacaoCurta,
  menuPrincipal,
  textoSobre,
  textoFormacao,
  textoDocente,
  textoCondicoes,
  textoUnidade,
  textoContato,
  textoConsultor,
  textoForaDeHorario,
  textoFallback,
} = require('./menus');

// ────────────────────────────────────────────────────────────
//  Configuração de modo (lida UMA vez ao iniciar o processo)
// ────────────────────────────────────────────────────────────

/**
 * Define se o bot usa botões reais (WhatsApp Business) ou menu em texto (pessoal).
 * Controlado pela variável de ambiente MODO_BOTOES no arquivo .env.
 *   MODO_BOTOES=false → texto numerado (padrão — funciona em qualquer WhatsApp)
 *   MODO_BOTOES=true  → botões clicáveis (apenas WhatsApp Business)
 */
const MODO_BOTOES = process.env.MODO_BOTOES === 'true';

// Loga o modo ativo ao iniciar para confirmar a configuração
console.log(`[BOT] Modo de interface: ${MODO_BOTOES ? '✅ BOTÕES (Business)' : '📝 TEXTO (Pessoal)'}`);

// ────────────────────────────────────────────────────────────
//  Definição dos botões (usado apenas se MODO_BOTOES=true)
//  buttonsMessage suporta no máximo 3 botões por mensagem.
//  Por isso o menu é dividido em 2 mensagens (grupo 1 + grupo 2).
// ────────────────────────────────────────────────────────────

/**
 * Primeiro grupo de botões do menu principal (opções 1, 2, 3).
 * @returns {object} Payload de buttonsMessage para o Baileys
 */
function menuBotoesGrupo1() {
  return {
    buttons: [
      { buttonId: 'btn_sobre',    buttonText: { displayText: '🏛️ Sobre a Integra'    }, type: 1 },
      { buttonId: 'btn_formacao', buttonText: { displayText: '📚 Formação e Módulos' }, type: 1 },
      { buttonId: 'btn_docente',  buttonText: { displayText: '👨‍🏫 Equipe Docente'     }, type: 1 },
    ],
    text:       '🧠 *Integra Psicanálise — A Nova Escola*\n\nSelecione o que deseja saber:',
    footer:     'Formação Psicanalítica Plural',
    headerType: 1,
  };
}

/**
 * Segundo grupo de botões do menu principal (opções 4, 5, 6).
 * @returns {object} Payload de buttonsMessage para o Baileys
 */
function menuBotoesGrupo2() {
  return {
    buttons: [
      { buttonId: 'btn_condicoes', buttonText: { displayText: '💰 Condições e Benefícios' }, type: 1 },
      { buttonId: 'btn_unidade',   buttonText: { displayText: '📍 Unidade e Localização'  }, type: 1 },
      { buttonId: 'btn_contato',   buttonText: { displayText: '📞 Contato / Agendamento'  }, type: 1 },
    ],
    text:       'Ou se preferir:',
    footer:     'Integra Psicanálise',
    headerType: 1,
  };
}

/**
 * Terceiro grupo de botões do menu principal — opção "Falar com Consultor".
 *
 * Por que um grupo separado?
 *  - buttonsMessage suporta no MÁXIMO 3 botões por mensagem.
 *  - Grupos 1 e 2 já estão cheios (3+3 = 6 opções de informação).
 *  - O consultor precisa estar visível no menu principal para que o
 *    usuário Business não precise navegar por conteúdo antes de encontrá-lo.
 *
 * @returns {object} Payload de buttonsMessage para o Baileys
 */
function menuBotoesGrupo3() {
  return {
    buttons: [
      { buttonId: 'btn_consultor', buttonText: { displayText: '👩‍💼 Falar com Consultor' }, type: 1 },
    ],
    text:       'Ou prefere falar diretamente com um de nossos consultores?',
    footer:     'Integra Psicanálise',
    headerType: 1,
  };
}

/**
 * Botões de retorno após resposta de conteúdo (modo Business).
 * @returns {object} Payload de buttonsMessage para o Baileys
 */
function botoesRetorno() {
  return {
    buttons: [
      { buttonId: 'btn_menu',      buttonText: { displayText: '↩️ Ver outras opções'   }, type: 1 },
      { buttonId: 'btn_consultor', buttonText: { displayText: '👩‍💼 Falar com consultor' }, type: 1 },
    ],
    text:       'O que gostaria de fazer agora?',
    footer:     'Integra Psicanálise',
    headerType: 1,
  };
}

/**
 * Botão único "Voltar ao menu" após acionar consultor (modo Business).
 * @returns {object} Payload de buttonsMessage para o Baileys
 */
function botaoVoltarMenu() {
  return {
    buttons: [
      { buttonId: 'btn_menu', buttonText: { displayText: '↩️ Voltar ao menu' }, type: 1 },
    ],
    text:       'Posso ajudar com mais alguma coisa?',
    footer:     'Integra Psicanálise',
    headerType: 1,
  };
}

// ────────────────────────────────────────────────────────────
//  Estado em memória
// ────────────────────────────────────────────────────────────

/** JIDs que já receberam boas-vindas nesta sessão */
const usuariosConhecidos = new Set();

/** Último tópico acessado por JID — enviado na notificação ao consultor */
const ultimoContexto = new Map();

/** Primeiro nome do usuário por JID (do pushName do WhatsApp) */
const nomeUsuario = new Map();

/** IDs de mensagens já processadas — evita processamento duplicado */
const processedIds = new Set();

/**
 * JIDs que foram transferidos para o consultor humano.
 * Após entrar neste Set, o bot silencia COMPLETAMENTE para este número:
 *  - Não responde nenhuma mensagem
 *  - Não marca como lida (não aparece como "visto")
 *  - O consultor assume a conversa diretamente pelo WhatsApp
 * O Set é limpo apenas ao reiniciar o bot (comportamento intencional).
 */
const consultorAtivado = new Set();

/**
 * JIDs que já receberam o aviso de "fora do horário" nesta sessão.
 * Evita enviar a mesma mensagem repetidamente para quem manda várias
 * mensagens fora do horário. Ao reiniciar o bot, o Set é zerado.
 */
const avisadoForaHorario = new Set();

/**
 * Lock por JID — previne race condition quando o usuário envia várias mensagens
 * muito rapidamente (ex: "oi" seguido imediatamente de outra mensagem).
 *
 * Problema sem o lock:
 *  - Mensagem 1 chega → handleMessage inicia → verifica !usuariosConhecidos → TRUE
 *  - Mensagem 2 chega em paralelo → handleMessage inicia → verifica !usuariosConhecidos → ainda TRUE
 *  - Resultado: boas-vindas enviadas duas vezes
 *
 * Com o lock:
 *  - Mensagem 1 adiciona jid ao lock → processa normalmente
 *  - Mensagem 2 encontra o lock ativo → descarta silenciosamente
 *  - Resultado: apenas uma boas-vindas, sem duplicação
 */
const processingLock = new Set();

/**
 * Timers de encerramento de sessão por JID.
 * Cada entrada mapeia um JID para o seu NodeJS.Timeout de inatividade.
 * Quando o timer dispara, a sessão do usuário é encerrada:
 *  1. Uma mensagem de despedida é enviada ao usuário
 *  2. Todo o estado daquele JID é removido da memória
 *  3. Próxima mensagem será tratada como primeiro contato (boas-vindas novamente)
 */
const sessionTimers = new Map();

/**
 * Tempo de inatividade (em ms) antes de encerrar automaticamente a sessão.
 * Padrão: 5 minutos (300.000 ms).
 * Pode ser ajustado via SESSION_TIMEOUT_MIN no .env futuramente.
 */
const SESSION_TIMEOUT = 5 * 60 * 1_000; // 5 minutos

// ────────────────────────────────────────────────────────────
//  Tabelas de roteamento
// ────────────────────────────────────────────────────────────

/**
 * Mapeamento: número digitado → { contexto, função de conteúdo }
 * Usado quando o usuário digita 1–6 no modo texto.
 */
const ROTAS_TEXTO = {
  '1': { ctx: 'Sobre a Integra Psicanálise', fn: textoSobre     },
  '2': { ctx: 'Formação e Módulos',          fn: textoFormacao  },
  '3': { ctx: 'Equipe Docente',              fn: textoDocente   },
  '4': { ctx: 'Condições e Benefícios',      fn: textoCondicoes },
  '5': { ctx: 'Unidade e Localização',       fn: textoUnidade   },
  '6': { ctx: 'Contato / Agendamento',       fn: textoContato   },
};

/**
 * Mapeamento: buttonId clicado → { contexto, função de conteúdo }
 * Usado no modo Business quando o usuário clica em botão.
 * Inclui IDs legados de versões anteriores para retrocompatibilidade.
 */
const ROTAS_BOTAO = {
  btn_sobre:     { ctx: 'Sobre a Integra Psicanálise', fn: textoSobre     },
  btn_formacao:  { ctx: 'Formação e Módulos',          fn: textoFormacao  },
  btn_docente:   { ctx: 'Equipe Docente',              fn: textoDocente   },
  btn_condicoes: { ctx: 'Condições e Benefícios',      fn: textoCondicoes },
  btn_unidade:   { ctx: 'Unidade e Localização',       fn: textoUnidade   },
  btn_contato:   { ctx: 'Contato / Agendamento',       fn: textoContato   },
  // IDs legados (versões anteriores — mantidos para não quebrar sessões em curso)
  btn_sedes:     { ctx: 'Unidade e Localização',       fn: textoUnidade   },
  btn_horarios:  { ctx: 'Formação e Módulos',          fn: textoFormacao  },
  btn_valores:   { ctx: 'Condições e Benefícios',      fn: textoCondicoes },
  btn_inscricao: { ctx: 'Contato / Agendamento',       fn: textoContato   },
};

// ────────────────────────────────────────────────────────────
//  Utilitários
// ────────────────────────────────────────────────────────────

/** Pausa assíncrona simples */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Verifica se o horário atual está dentro do horário de atendimento do bot.
 *
 * Regras:
 *  - Dias: Segunda-feira a Sábado (domingo = fora do horário)
 *  - Horas: 8h às 20h (horário de Brasília / São Paulo — BRT, UTC-3)
 *
 * Técnica: usa Intl.DateTimeFormat com formatToParts — método mais confiável
 * em qualquer sistema operacional (Windows, Linux, VPS, Docker, etc.).
 * Evita o bug da abordagem anterior (new Date(toLocaleString())) que podia
 * falhar em Windows dependendo da configuração regional do servidor.
 *
 * Nota: America/Sao_Paulo e America/Brasilia são o mesmo fuso (UTC-3).
 * O Brasil aboliu o horário de verão em 2019, então é sempre UTC-3.
 *
 * @returns {boolean} true se dentro do horário, false se fora
 */
function dentroDoHorario() {
  const agora = new Date();
  const TZ    = 'America/Sao_Paulo'; // fuso de Brasília — UTC-3 fixo desde 2019

  // formatToParts extrai os componentes diretamente no fuso correto,
  // sem depender da interpretação do construtor new Date() sobre strings localizadas
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday:  'short',   // 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'
    hour:     'numeric',
    hour12:   false,     // formato 24h (0–23)
  }).formatToParts(agora);

  // Extrai hora numérica (Intl pode retornar '24' no lugar de '0' — corrigido abaixo)
  let hora = parseInt(partes.find(p => p.type === 'hour').value, 10);
  if (hora === 24) hora = 0; // quirk do Intl: meia-noite pode vir como 24

  // Extrai dia da semana abreviado em inglês
  const diaSemana = partes.find(p => p.type === 'weekday').value; // 'Sun', 'Mon', ...

  if (diaSemana === 'Sun') return false; // domingo: fechado
  return hora >= 8 && hora < 20;        // 8h às 19:59 (até 20h)
}

/**
 * Simula digitação humana antes de enviar uma mensagem.
 *
 * Fluxo:
 *  1. Mostra "digitando..." no WhatsApp do usuário (sendPresenceUpdate)
 *  2. Aguarda um tempo proporcional ao tamanho do texto a ser enviado
 *  3. Para o indicador de digitação
 *
 * O delay é calculado como:
 *   base (600ms) + 7ms por caractere, limitado a 2500ms no máximo
 *   + variação aleatória de ±200ms (evita parecer mecânico)
 *
 * Exemplos:
 *   50  chars → ~950ms   (saudações curtas)
 *   200 chars → ~2000ms  (respostas médias)
 *   500 chars → ~2500ms  (textos longos — limitado pelo teto)
 *
 * @param {object} sock   - Socket do Baileys
 * @param {string} jid    - JID do destinatário
 * @param {string} texto  - Texto que SERÁ enviado (apenas para calcular o delay)
 */
async function simularDigitando(sock, jid, texto = '') {
  const base  = Math.min(600 + texto.length * 7, 2_500); // delay proporcional ao texto
  const noise = Math.floor(Math.random() * 400);          // variação aleatória 0–400ms
  const delay = base + noise;

  try {
    await sock.sendPresenceUpdate('composing', jid); // mostra "digitando..." no WhatsApp
    await sleep(delay);
    await sock.sendPresenceUpdate('paused', jid);    // apaga o "digitando..."
  } catch (_) {
    // sendPresenceUpdate pode falhar em alguns casos — apenas aguarda o delay mesmo assim
    await sleep(delay);
  }
}

/**
 * Marca a mensagem como lida (✓✓ azul) no WhatsApp do usuário.
 * Falha silenciosa — não interrompe o fluxo se der erro.
 */
async function marcarComoLida(sock, message) {
  try {
    await sock.readMessages([message.key]);
  } catch (_) {}
}

/**
 * Detecta se o texto é uma saudação e qual o período do dia.
 * Suporta saudações simples ("oi") E compostas ("oi tudo bem?", "bom dia pessoal!").
 *
 * @param {string} texto - Texto da mensagem em minúsculas
 * @returns {'bom_dia'|'boa_tarde'|'boa_noite'|'geral'|null}
 */
function detectarSaudacao(texto) {
  if (!texto) return null;
  const t = texto.toLowerCase().trim();

  // Saudações de período (detecta mesmo composto: "bom dia, tudo bem?")
  if (t.includes('bom dia'))   return 'bom_dia';
  if (t.includes('boa tarde')) return 'boa_tarde';
  if (t.includes('boa noite')) return 'boa_noite';

  // Saudações genéricas: verifica a mensagem inteira OU apenas a primeira palavra
  // Permite reconhecer: "oi", "oi tudo bem?", "olá como vai?", etc.
  const palavrasGeral = ['oi', 'olá', 'ola', 'oii', 'oiii', 'hello', 'hey', 'opa', 'eai', 'e aí', 'e ai'];
  const primeiraWord  = t.split(/[\s,!?.]+/)[0];
  if (palavrasGeral.includes(t) || palavrasGeral.includes(primeiraWord)) {
    return 'geral';
  }

  return null;
}

/**
 * Extrai o texto puro de uma mensagem do WhatsApp.
 * Suporta mensagens simples (conversation) e estendidas (com preview de link, etc.).
 */
function extractTexto(message) {
  return (
    message.message?.conversation ||
    message.message?.extendedTextMessage?.text ||
    ''
  );
}

/**
 * Extrai o ID do botão clicado (modo Business).
 * Suporta buttonsResponseMessage e templateButtonReplyMessage.
 */
function extractButtonId(message) {
  return (
    message.message?.buttonsResponseMessage?.selectedButtonId ||
    message.message?.templateButtonReplyMessage?.selectedId ||
    null
  );
}

/**
 * Extrai o ID de seleção em listMessage (legado).
 */
function extractListRowId(message) {
  return message.message?.listResponseMessage?.singleSelectReply?.selectedRowId || null;
}

/**
 * Remove as entradas mais antigas de um Map ou Set quando atinge o tamanho máximo.
 * Previne memory leak em bots de longa duração.
 *
 * @param {Map|Set} colecao   - Coleção a verificar
 * @param {number}  maxSize   - Tamanho máximo permitido (padrão: 5000)
 * @param {number}  batchDelete - Quantas entradas remover por vez (padrão: 100)
 */
function limparColecaoSeNecessario(colecao, maxSize = 5_000, batchDelete = 100) {
  if (colecao.size < maxSize) return;
  let count = 0;
  for (const key of colecao.keys()) {
    colecao.delete(key);
    if (++count >= batchDelete) break;
  }
}

// ────────────────────────────────────────────────────────────
//  Envio de mensagens
// ────────────────────────────────────────────────────────────

/**
 * Envia o menu principal ao usuário.
 * Modo texto (MODO_BOTOES=false): envia o menu numerado formatado.
 * Modo botões (MODO_BOTOES=true): envia três grupos de buttonsMessage.
 *
 * Estrutura Business (3 mensagens):
 *   Grupo 1 → Sobre | Formação | Docente        (3 botões)
 *   Grupo 2 → Condições | Unidade | Contato      (3 botões)
 *   Grupo 3 → Falar com Consultor                (1 botão)
 *
 * Por que três mensagens separadas?
 *  - buttonsMessage suporta no máximo 3 botões por mensagem.
 *  - Sem o grupo 3, o usuário Business não teria acesso ao consultor
 *    diretamente pelo menu principal.
 *
 * @param {object} sock - Socket do Baileys
 * @param {string} jid  - JID do destinatário
 */
async function enviarMenuPrincipal(sock, jid) {
  if (!MODO_BOTOES) {
    // Modo texto: simples e compatível com qualquer WhatsApp
    return await sock.sendMessage(jid, { text: menuPrincipal() });
  }

  // Modo botões: envia os três grupos (3 + 3 + 1 botões)
  try {
    await sock.sendMessage(jid, menuBotoesGrupo1());
    await sleep(350); // pausa para garantir ordem de entrega das mensagens
    await sock.sendMessage(jid, menuBotoesGrupo2());
    await sleep(350);
    await sock.sendMessage(jid, menuBotoesGrupo3()); // consultor
  } catch (_) {
    // Fallback: se botões falharem por algum motivo, envia texto numerado
    await sock.sendMessage(jid, { text: menuPrincipal() });
  }
}

/**
 * Envia uma resposta de conteúdo longo ao usuário.
 * No modo texto o rodapé de navegação já vem embutido no texto (menus.js).
 * No modo botões adiciona os botoesRetorno() após o conteúdo.
 *
 * @param {object} sock          - Socket do Baileys
 * @param {string} jid           - JID do destinatário
 * @param {string} textoCompleto - Texto formatado do menus.js
 */
async function enviarConteudo(sock, jid, textoCompleto) {
  // Simula digitação proporcional ao tamanho do conteúdo antes de enviar
  await simularDigitando(sock, jid, textoCompleto);
  await sock.sendMessage(jid, { text: textoCompleto });

  if (MODO_BOTOES) {
    try {
      await sleep(300); // pequena pausa antes dos botões de retorno
      await sock.sendMessage(jid, botoesRetorno());
    } catch (_) {
      // Silencioso: rodapé de texto "0 = menu | 7 = consultor" já está no conteúdo
    }
  }
}

/**
 * Envia mensagem de fallback (não entendeu) seguida do menu principal.
 */
async function enviarFallback(sock, jid) {
  const txtFallback = textoFallback();
  await simularDigitando(sock, jid, txtFallback);
  await sock.sendMessage(jid, { text: txtFallback });
  await sleep(600); // pausa antes do menu aparecer
  await enviarMenuPrincipal(sock, jid);
}

// ────────────────────────────────────────────────────────────
//  Notificação ao consultor / admin
// ────────────────────────────────────────────────────────────

/**
 * Verifica ao vivo se o número do admin existe no WhatsApp e retorna o JID real.
 *
 * Por que usar onWhatsApp() em vez de construir o JID manualmente?
 *  - O Baileys aceita sendMessage para JIDs inválidos SEM lançar erro.
 *  - A mensagem simplesmente não chega, e nenhum erro aparece no console.
 *  - onWhatsApp() consulta os servidores do WhatsApp e confirma se o número
 *    está ativo, retornando o JID correto (que pode diferir do número digitado).
 *
 * @param {object} sock        - Socket do Baileys
 * @param {string} adminPhone  - Número do admin (ex: '5581998191625')
 * @returns {string|null} JID real do admin ou null se não encontrado
 */
async function resolverJidAdmin(sock, adminPhone) {
  try {
    // onWhatsApp aceita array de números e retorna array de resultados
    const [resultado] = await sock.onWhatsApp(adminPhone);

    if (!resultado?.exists) {
      console.error(`[BOT] ❌ Admin (${adminPhone}) NÃO encontrado no WhatsApp!`);
      console.error(`[BOT] ❌ Verifique se ADMIN_WHATSAPP no .env está correto.`);
      return null;
    }

    // resultado.jid é o JID exato retornado pelo servidor do WhatsApp
    console.log(`[BOT] ✅ Admin verificado: ${resultado.jid}`);
    return resultado.jid;

  } catch (err) {
    // Se onWhatsApp falhar (ex: timeout), usa o JID construído manualmente como fallback
    const fallback = `${adminPhone}@s.whatsapp.net`;
    console.warn(`[BOT] ⚠️  onWhatsApp falhou (${err.message}). Usando fallback: ${fallback}`);
    return fallback;
  }
}

/**
 * Verifica a configuração do admin ao iniciar o bot.
 * Chamada pelo connection.js logo após conectar ao WhatsApp.
 * Exibe aviso claro no console se o número estiver errado/inativo.
 *
 * @param {object} sock - Socket do Baileys (já conectado)
 */
async function verificarAdmin(sock) {
  const adminPhone = CONTENT.adminWhatsapp;
  console.log(`[BOT] 🔍 Verificando número do admin: ${adminPhone}...`);

  const jidReal = await resolverJidAdmin(sock, adminPhone);
  if (jidReal) {
    console.log(`[BOT] ✅ Admin OK — notificações serão enviadas para ${jidReal}`);
  } else {
    console.error(`[BOT] ══════════════════════════════════════════`);
    console.error(`[BOT] ❌  ATENÇÃO: admin não encontrado no WhatsApp!`);
    console.error(`[BOT] ❌  Número configurado: ${adminPhone}`);
    console.error(`[BOT] ❌  Corrija ADMIN_WHATSAPP no arquivo .env`);
    console.error(`[BOT] ══════════════════════════════════════════`);
  }
}

/**
 * Verifica se um número extraído do JID é um telefone real no WhatsApp.
 *
 * Problema: o WhatsApp está migrando contas para um sistema de LID (Linked ID).
 * O LID é um número interno (ex: 14272293818523) que NÃO é o telefone do usuário.
 * O Baileys retorna esse LID no remoteJid, então não podemos usar direto no wa.me.
 *
 * Solução: consultar onWhatsApp() passando o número extraído.
 *  - Se retornar exists: true  → é um telefone real → gera link wa.me
 *  - Se retornar exists: false → é LID → orienta admin a buscar pelo nome
 *
 * @param {object} sock       - Socket do Baileys
 * @param {string} rawNumber  - Número extraído do JID (pode ser phone ou LID)
 * @returns {{ isPhone: boolean, phone: string|null }} resultado da verificação
 */
async function verificarNumeroCliente(sock, rawNumber) {
  try {
    const [check] = await sock.onWhatsApp(rawNumber);
    if (check?.exists) {
      console.log(`[BOT] ✅ Número do cliente confirmado: ${rawNumber}`);
      return { isPhone: true, phone: rawNumber };
    }
    // onWhatsApp retornou exists: false → é LID ou número inválido
    console.warn(`[BOT] ⚠️  JID "${rawNumber}" é um LID (ID interno), não um telefone.`);
    return { isPhone: false, phone: null };
  } catch (err) {
    // Se a verificação falhar por timeout/rede, assume que é telefone e tenta o link mesmo assim
    console.warn(`[BOT] ⚠️  Não foi possível verificar número do cliente (${err.message}). Usando direto.`);
    return { isPhone: true, phone: rawNumber };
  }
}

/**
 * Envia notificação ao número admin quando usuário solicita consultor.
 *
 * Valida se o JID do cliente contém um telefone real (via onWhatsApp) ou um LID
 * antes de montar o link wa.me, evitando links inválidos na notificação.
 *
 * @param {object} sock    - Socket do Baileys
 * @param {string} jid     - JID do usuário (ex: '5511999999999@s.whatsapp.net')
 * @param {string} nome    - Primeiro nome do usuário (pushName)
 * @param {string} assunto - Último tópico acessado pelo usuário
 */
async function notificarConsultor(sock, jid, nome, assunto) {
  const adminPhone = CONTENT.adminWhatsapp;
  const rawNumber  = jid.split('@')[0]; // pode ser telefone real ou LID interno

  console.log(`[BOT] 📤 Enviando notificação para admin (${adminPhone})...`);

  // 1. Resolve o JID real do admin antes de enviar
  const adminJid = await resolverJidAdmin(sock, adminPhone);
  if (!adminJid) {
    console.error(`[BOT] ❌ Notificação NÃO enviada: admin não encontrado no WhatsApp.`);
    return;
  }

  // 2. Verifica se o JID do cliente é um número de telefone real ou LID interno
  const { isPhone, phone } = await verificarNumeroCliente(sock, rawNumber);

  // 3. Monta a linha de contato do cliente dependendo do resultado
  //    - Telefone real → link wa.me clicável
  //    - LID → orienta admin a buscar pelo nome no WhatsApp
  const linhaContato = isPhone
    ? `📱 *WhatsApp:* https://wa.me/${phone}`
    : `📱 *Nome no WhatsApp:* ${nome}\n` +
      `_⚠️ Link direto indisponível (conta usa ID interno)._\n` +
      `_Pesquise por "${nome}" ou peça o número diretamente._`;

  const notificacao =
    `🔔 *NOVO CONTATO SOLICITADO VIA BOT*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `👤 *Nome:* ${nome}\n` +
    `${linhaContato}\n` +
    `🗂️  *Interesse:* ${assunto}\n\n` +
    `💬 O cliente deseja falar com um consultor.`;

  try {
    await sock.sendMessage(adminJid, { text: notificacao });
    console.log(`[BOT] 📣 Notificação enviada → ${nome} | ${isPhone ? `wa.me/${phone}` : 'LID (sem link)'} | ${assunto}`);
  } catch (err) {
    console.error(`[BOT] ❌ Falha ao enviar notificação ao admin: ${err.message}`);
  }
}

/**
 * Ação completa de "falar com consultor":
 *  1. Envia confirmação ao usuário
 *  2. Notifica o admin com link wa.me do usuário
 *  3. No modo botões, exibe botão para voltar ao menu
 */
async function acionarConsultor(sock, jid) {
  const nome    = nomeUsuario.get(jid) || 'Não informado';
  const assunto = ultimoContexto.get(jid) || 'Não especificado (menu geral)';

  await enviarConteudo(sock, jid, textoConsultor());
  await notificarConsultor(sock, jid, nome, assunto);

  if (MODO_BOTOES) {
    try { await sock.sendMessage(jid, botaoVoltarMenu()); } catch (_) {}
  }

  // Silencia o bot completamente para este JID a partir de agora.
  // O consultor humano assume a conversa — o bot não deve interferir.
  // Mensagens futuras deste número serão ignoradas (sem leitura, sem resposta).
  consultorAtivado.add(jid);

  // Cancela o timer de inatividade: o consultor conduz a conversa,
  // não faz sentido o bot enviar mensagem de "sessão encerrada" enquanto
  // o atendimento humano está em andamento.
  if (sessionTimers.has(jid)) {
    clearTimeout(sessionTimers.get(jid));
    sessionTimers.delete(jid);
  }

  console.log(`[BOT] 🔇 Bot silenciado para ${jid.split('@')[0]} — consultor assumiu.`);
}

// ────────────────────────────────────────────────────────────
//  Gerenciamento de sessão por inatividade
// ────────────────────────────────────────────────────────────

/**
 * Agenda (ou reinicia) o timer de encerramento de sessão para um JID.
 *
 * Comportamento:
 *  - Se já existir um timer ativo para este JID, ele é cancelado e recriado
 *    (cada nova mensagem "reseta o relógio")
 *  - Após SESSION_TIMEOUT ms sem mensagens, a sessão é encerrada:
 *      1. Limpa todo o estado do usuário (usuariosConhecidos, contexto, nome, etc.)
 *      2. Se o usuário tinha uma sessão ativa (já tinha recebido boas-vindas),
 *         envia uma mensagem de encerramento cordial
 *      3. Loga o encerramento no console
 *
 * Por que limpar o estado ANTES de enviar a mensagem?
 *  - Evita que o `sendMessage` de encerramento acione o processamento
 *    de novas mensagens com estado inconsistente.
 *  - Se o envio falhar (ex: usuário bloqueou o bot), o estado já foi limpo.
 *
 * @param {object} sock - Socket do Baileys (necessário para enviar msg de encerramento)
 * @param {string} jid  - JID do usuário
 */
function agendarEncerramentoSessao(sock, jid) {
  // Cancela timer anterior se existir (novo reset do relógio)
  if (sessionTimers.has(jid)) clearTimeout(sessionTimers.get(jid));

  const timer = setTimeout(async () => {
    sessionTimers.delete(jid); // remove referência ao timer expirado

    // Captura o nome ANTES de limpar o estado
    const nome        = nomeUsuario.get(jid);
    const usuarioAtivo = usuariosConhecidos.has(jid) && !consultorAtivado.has(jid);

    // ── Limpa TODO o estado deste JID ───────────────────────────────────────
    // Feito ANTES do sendMessage para evitar inconsistências caso o envio
    // dispare novos eventos no Baileys
    usuariosConhecidos.delete(jid);
    ultimoContexto.delete(jid);
    nomeUsuario.delete(jid);
    avisadoForaHorario.delete(jid);
    // (consultorAtivado NÃO é limpo: o consultor pode continuar a conversa)

    // ── Envia mensagem de encerramento (apenas se a sessão estava ativa) ────
    if (usuarioAtivo) {
      try {
        const despedida =
          `_Sua sessão foi encerrada por inatividade${nome ? `, *${nome}*` : ''}._\n\n` +
          `Quando precisar de mais informações sobre a *Integra Psicanálise*, é só chamar! 😊`;
        await sock.sendMessage(jid, { text: despedida });
      } catch (_) {
        // Falha silenciosa — o usuário pode ter bloqueado ou desconectado
      }
    }

    console.log(`[BOT] ⏱️  Sessão encerrada por inatividade: ${jid.split('@')[0]}`);
  }, SESSION_TIMEOUT);

  sessionTimers.set(jid, timer); // armazena referência para poder cancelar depois
}

// ────────────────────────────────────────────────────────────
//  Handler principal
// ────────────────────────────────────────────────────────────

/**
 * Processa uma mensagem recebida do WhatsApp.
 * Chamado pelo connection.js para cada mensagem nova (type === 'notify').
 *
 * Fluxo de decisão:
 *  1. Deduplicação por ID
 *  2. Marca como lida
 *  3. Extrai nome do usuário
 *  4. Clique em botão → processarBotao()
 *  5. Seleção de lista (legado) → processarBotao()
 *  6. Sem texto (foto/áudio/etc.) → pede texto + menu
 *  7. Primeira mensagem → boas-vindas + menu
 *  8. Saudação de período → saudação curta + menu
 *  9. Saudação genérica → menu direto
 * 10. Outro texto → processarTexto()
 */
async function handleMessage(sock, message) {
  const jid   = message.key.remoteJid;
  const msgId = message.key.id;

  // ── Deduplicação ────────────────────────────────────────────────────────────
  // Evita processar a mesma mensagem duas vezes (ex: reconexão que re-entrega eventos)
  if (processedIds.has(msgId)) return;
  processedIds.add(msgId);

  if (processedIds.size > 2_000) {
    let count = 0;
    for (const id of processedIds) {
      processedIds.delete(id);
      if (++count >= 200) break;
    }
  }

  // ── Consultor ativado: silêncio total ────────────────────────────────────────
  // Após transferir para consultor, o bot ignora TUDO deste JID:
  //  - Não marca como lida (o usuário não vê o "visto" do bot)
  //  - Não responde nada
  //  - O consultor humano conduz a conversa livremente
  if (consultorAtivado.has(jid)) return;

  // ── Lock por JID: previne race condition de boas-vindas duplas ───────────────
  // Se duas mensagens chegam rápido (eventos simultâneos), a segunda é descartada
  // silenciosamente enquanto a primeira está sendo processada.
  // Sem este lock, ambas passariam pelo check !usuariosConhecidos ao mesmo tempo,
  // resultando em duas mensagens de boas-vindas.
  if (processingLock.has(jid)) return;
  processingLock.add(jid);

  try {

    await marcarComoLida(sock, message);

    // Pausa de "leitura" — simula o bot lendo a mensagem antes de começar a responder
    await sleep(400 + Math.floor(Math.random() * 300));

    // ── Verificação de horário de atendimento ──────────────────────────────────
    // ⚠️  TEMPORARIAMENTE DESATIVADO — bot responde 24h por enquanto.
    // Para reativar: descomente o bloco abaixo e remova esta linha de comentário.
    //
    // if (!dentroDoHorario()) {
    //   if (!avisadoForaHorario.has(jid)) {
    //     avisadoForaHorario.add(jid);
    //     const txtFora = textoForaDeHorario();
    //     await simularDigitando(sock, jid, txtFora);
    //     await sock.sendMessage(jid, { text: txtFora });
    //     console.log(`[BOT] ⏰ Fora do horário — aviso enviado para ${jid.split('@')[0]}`);
    //   }
    //   return;
    // }
    // avisadoForaHorario.delete(jid);

    // ── Extrai e armazena nome do usuário ──────────────────────────────────────
    if (message.pushName) {
      nomeUsuario.set(jid, message.pushName.split(' ')[0]); // apenas o primeiro nome
      limparColecaoSeNecessario(nomeUsuario);
      limparColecaoSeNecessario(ultimoContexto);
      limparColecaoSeNecessario(usuariosConhecidos);
    }
    const nome = nomeUsuario.get(jid) || null;

    // ── Clique em botão (modo Business) ───────────────────────────────────────
    const buttonId = extractButtonId(message);
    if (buttonId) {
      if (!usuariosConhecidos.has(jid)) usuariosConhecidos.add(jid);
      return await processarBotao(sock, jid, buttonId);
    }

    // ── Seleção em lista (legado) ──────────────────────────────────────────────
    const rowId = extractListRowId(message);
    if (rowId) {
      if (!usuariosConhecidos.has(jid)) usuariosConhecidos.add(jid);
      return await processarBotao(sock, jid, rowId);
    }

    // ── Extrai texto ───────────────────────────────────────────────────────────
    const textoRaw = extractTexto(message).trim();
    const texto    = textoRaw.toLowerCase();

    // Mensagem sem texto (foto, áudio, sticker, documento, etc.)
    if (!textoRaw) {
      const txtMidia = '📎 _Só consigo processar mensagens de texto._\nUse o menu abaixo 👇';
      await simularDigitando(sock, jid, txtMidia);
      await sock.sendMessage(jid, { text: txtMidia });
      await sleep(400);
      return await enviarMenuPrincipal(sock, jid);
    }

    const tipoSaudacao = detectarSaudacao(texto);

    // ── Primeira mensagem do usuário → boas-vindas + menu ─────────────────────
    if (!usuariosConhecidos.has(jid)) {
      usuariosConhecidos.add(jid);
      const txtBV = mensagemBoasVindas(nome, tipoSaudacao || 'geral');
      await simularDigitando(sock, jid, txtBV);
      await sock.sendMessage(jid, { text: txtBV });
      await sleep(700); // pausa humanizante entre boas-vindas e menu
      return await enviarMenuPrincipal(sock, jid);
    }

    // ── Usuário recorrente + saudação de período → saudação curta + menu ──────
    if (tipoSaudacao === 'bom_dia' || tipoSaudacao === 'boa_tarde' || tipoSaudacao === 'boa_noite') {
      const txtSaud = saudacaoCurta(nome, tipoSaudacao);
      await simularDigitando(sock, jid, txtSaud);
      await sock.sendMessage(jid, { text: txtSaud });
      await sleep(500);
      return await enviarMenuPrincipal(sock, jid);
    }

    // ── Usuário recorrente + saudação genérica → menu direto ──────────────────
    if (tipoSaudacao === 'geral') {
      return await enviarMenuPrincipal(sock, jid);
    }

    // ── Qualquer outro texto → roteamento por número/keyword ──────────────────
    return await processarTexto(sock, jid, texto);

  } finally {
    // ── Libera o lock e (re)inicia o timer de inatividade ─────────────────────
    // O finally garante execução mesmo em caso de erro ou return antecipado.
    //
    // Lock: liberado SEMPRE, independente do caminho de retorno.
    // Timer: reiniciado a cada mensagem recebida (contagem regressiva de 5 min).
    //        Se o usuário ficar inativo, a sessão será encerrada e uma
    //        mensagem de despedida será enviada automaticamente.
    processingLock.delete(jid);
    agendarEncerramentoSessao(sock, jid);
  }
}

// ────────────────────────────────────────────────────────────
//  Processador de botões (modo Business + legado)
// ────────────────────────────────────────────────────────────

/**
 * Roteia clique em botão ou seleção de lista para a ação correta.
 * @param {string} id - buttonId ou rowId
 */
async function processarBotao(sock, jid, id) {
  if (id === 'btn_menu')      return await enviarMenuPrincipal(sock, jid);
  if (id === 'btn_consultor') return await acionarConsultor(sock, jid);

  const rota = ROTAS_BOTAO[id];
  if (rota) {
    ultimoContexto.set(jid, rota.ctx);
    return await enviarConteudo(sock, jid, rota.fn());
  }

  await enviarFallback(sock, jid);
}

// ────────────────────────────────────────────────────────────
//  Processador de texto (modo pessoal + palavras-chave)
// ────────────────────────────────────────────────────────────

/**
 * Processa mensagens de texto livre.
 * Tenta reconhecer números (1–7), comandos, agradecimentos e palavras-chave.
 * @param {string} texto - Texto em minúsculas
 */
async function processarTexto(sock, jid, texto) {

  // ── Comandos de retorno ao menu ────────────────────────────────────────────
  const comandosMenu = ['0', 'menu', 'inicio', 'início', 'voltar', 'start', 'opcoes', 'opções', 'ajuda'];
  if (comandosMenu.includes(texto)) {
    return await enviarMenuPrincipal(sock, jid);
  }

  // ── Seleção por número (1–6) ───────────────────────────────────────────────
  if (ROTAS_TEXTO[texto]) {
    const { ctx, fn } = ROTAS_TEXTO[texto];
    ultimoContexto.set(jid, ctx);
    return await enviarConteudo(sock, jid, fn());
  }

  // ── Opção 7 → consultor ────────────────────────────────────────────────────
  if (texto === '7') return await acionarConsultor(sock, jid);

  // ── Agradecimentos ─────────────────────────────────────────────────────────
  const termosAgradecimento = [
    'obrigado', 'obrigada', 'valeu', 'ok', 'certo', 'entendi',
    'perfeito', 'ótimo', 'otimo', 'legal', 'show', 'beleza', 'excelente', 'tá bom', 'ta bom',
  ];
  if (termosAgradecimento.some(k => texto.includes(k))) {
    const n      = nomeUsuario.get(jid);
    const txtAck = `Fico feliz em ajudar${n ? `, *${n}*` : ''}! 😊\n\nSe precisar de mais alguma informação, use o menu abaixo. 👇`;
    await simularDigitando(sock, jid, txtAck);
    await sock.sendMessage(jid, { text: txtAck });
    await sleep(500);
    return await enviarMenuPrincipal(sock, jid);
  }

  // ── Palavras-chave por tema ────────────────────────────────────────────────

  // Sobre a Integra
  if (['sobre', 'história', 'historia', 'missão', 'missao', 'proposta',
       'diferencial', 'escola', 'o que é', 'quem são', 'o que e'].some(k => texto.includes(k))) {
    ultimoContexto.set(jid, 'Sobre a Integra Psicanálise');
    return await enviarConteudo(sock, jid, textoSobre());
  }

  // Formação e Módulos
  if (['módulo', 'modulo', 'formação', 'formacao', 'disciplina', 'curso',
       'grade', 'aula', 'conteúdo', 'conteudo', 'aprender', 'duração', 'duracao'].some(k => texto.includes(k))) {
    ultimoContexto.set(jid, 'Formação e Módulos');
    return await enviarConteudo(sock, jid, textoFormacao());
  }

  // Equipe Docente
  if (['professor', 'docente', 'equipe', 'instrutor', 'quem ensina', 'corpo docente'].some(k => texto.includes(k))) {
    ultimoContexto.set(jid, 'Equipe Docente');
    return await enviarConteudo(sock, jid, textoDocente());
  }

  // Condições e Benefícios
  if (['valor', 'preço', 'preco', 'custo', 'mensalidade', 'matrícula', 'matricula',
       'pagamento', 'boleto', 'pix', 'quanto', 'desconto', 'benefício', 'beneficio', 'parcela'].some(k => texto.includes(k))) {
    ultimoContexto.set(jid, 'Condições e Benefícios');
    return await enviarConteudo(sock, jid, textoCondicoes());
  }

  // Unidade e Localização
  if (['endereço', 'endereco', 'onde fica', 'unidade', 'sede', 'recife',
       'como chegar', 'mapa', 'rua', 'localização', 'localizacao', 'fica'].some(k => texto.includes(k))) {
    ultimoContexto.set(jid, 'Unidade e Localização');
    return await enviarConteudo(sock, jid, textoUnidade());
  }

  // Contato e Agendamento
  if (['contato', 'ligar', 'email', 'instagram', 'agendar', 'visita',
       'inscrever', 'inscrição', 'inscricao', 'telefone', 'site'].some(k => texto.includes(k))) {
    ultimoContexto.set(jid, 'Contato / Agendamento');
    return await enviarConteudo(sock, jid, textoContato());
  }

  // Consultor por palavra-chave
  if (['consultor', 'atendente', 'humano', 'quero falar', 'falar com algu',
       'representante', 'pessoa', 'atendimento humano'].some(k => texto.includes(k))) {
    return await acionarConsultor(sock, jid);
  }

  // ── Fallback: não reconheceu nada ────────────────────────────────────────
  await enviarFallback(sock, jid);
}

module.exports = { handleMessage, verificarAdmin };

/**
 * =============================================================
 *  menus.js — Construtores de Mensagens e Textos do Bot
 * =============================================================
 *  Este arquivo contém APENAS funções que montam strings de texto.
 *  Não há lógica de negócio aqui — só formatação de mensagens.
 *
 *  ⚠️  Por que não usamos buttonsMessage/listMessage aqui?
 *  Porque esses tipos NÃO renderizam botões em contas pessoais do
 *  WhatsApp. Apenas contas Business API oficial suportam botões com
 *  confiabilidade. Os botões são gerenciados pelo messageHandler.js,
 *  que detecta automaticamente se o número é Business ou pessoal.
 *
 *  Formatação WhatsApp suportada nas strings:
 *    *texto*    → negrito
 *    _texto_    → itálico
 *    ~texto~    → tachado  (~~duplo~~ também funciona)
 *    \n         → quebra de linha
 *
 *  Navegação (modo texto pessoal):
 *    Usuário digita 1–6 → messageHandler detecta e roteia
 *    Usuário digita 0   → volta ao menu principal
 *    Usuário digita 7   → falar com consultor
 * =============================================================
 */

'use strict';

const CONTENT = require('./content'); // todos os dados da instituição

// ────────────────────────────────────────────────────────────
//  SAUDAÇÕES
// ────────────────────────────────────────────────────────────

/**
 * Mensagem de boas-vindas completa — exibida na PRIMEIRA mensagem do usuário.
 * Apresenta a escola e convida para ver o menu.
 *
 * @param {string|null} nome - Primeiro nome do usuário (do pushName do WhatsApp)
 *                            Se null, omite o nome pessoal da saudação
 * @param {'bom_dia'|'boa_tarde'|'boa_noite'|'geral'} tipo - Período do dia detectado
 * @returns {string} Mensagem de boas-vindas formatada para WhatsApp
 */
function mensagemBoasVindas(nome, tipo = 'geral') {
  // Mapeamento de tipo → saudação em português
  const MAP = {
    bom_dia:   'Bom dia',
    boa_tarde: 'Boa tarde',
    boa_noite: 'Boa noite',
    geral:     'Olá',
  };

  const saud     = MAP[tipo] || MAP.geral; // saudação baseada no período do dia
  const nomePart = nome ? `, *${nome}*` : ''; // ex: ", *Maria*" ou "" (sem nome)

  return (
    `${saud}${nomePart}! 👋 Seja muito bem-vindo(a) à\n` +
    `*Integra Psicanálise — A Nova Escola*! 🌱\n\n` +
    `Formamos psicanalistas com *rigor teórico*, *sensibilidade clínica* ` +
    `e *visão plural*, integrando as grandes escolas da psicanálise.\n\n` +
    `Como posso ajudá-lo(a) hoje?`
  );
}

/**
 * Saudação curta — para usuários RECORRENTES que enviam "Bom dia/Boa tarde/Boa noite".
 * Mais concisa que a boas-vindas completa (evita repetição para quem já conhece o bot).
 *
 * @param {string|null} nome - Primeiro nome do usuário
 * @param {'bom_dia'|'boa_tarde'|'boa_noite'} tipo - Período do dia detectado
 * @returns {string} Saudação curta formatada
 */
function saudacaoCurta(nome, tipo) {
  const MAP = {
    bom_dia:   'Bom dia',
    boa_tarde: 'Boa tarde',
    boa_noite: 'Boa noite',
  };
  const saud     = MAP[tipo] || 'Olá';
  const nomePart = nome ? `, *${nome}*` : '';
  return `${saud}${nomePart}! 😊 Como posso ajudá-lo(a)?`;
}

// ────────────────────────────────────────────────────────────
//  MENU PRINCIPAL — Navegação por número
// ────────────────────────────────────────────────────────────

/**
 * Menu principal em texto formatado.
 * Usado no modo pessoal (WhatsApp não-Business) onde botões não funcionam.
 * O usuário navega digitando o número da opção desejada (1–7) ou 0 para voltar.
 *
 * @returns {string} Menu completo formatado com todas as opções
 */
function menuPrincipal() {
  return (
    `╔══════════════════════════════╗\n` +
    `   🧠 *INTEGRA PSICANÁLISE*\n` +
    `   _A Nova Escola_\n` +
    `╚══════════════════════════════╝\n\n` +
    `Selecione uma opção *digitando o número*:\n\n` +
    `*1* 🏛️  Sobre a Integra\n` +
    `*2* 📚  Formação e Módulos\n` +
    `*3* 👨‍🏫  Equipe Docente\n` +
    `*4* 💰  Condições e Benefícios\n` +
    `*5* 📍  Unidade e Localização\n` +
    `*6* 📞  Contato / Agendamento\n\n` +
    `*7* 👩‍💼  Falar com Consultor\n\n` +
    `_Digite o número da opção desejada_ 👆`
  );
}

/**
 * Rodapé de navegação — acrescentado ao final de cada resposta de conteúdo.
 * Fornece atalhos rápidos para o usuário continuar navegando sem precisar
 * lembrar os números do menu.
 *
 * @returns {string} Rodapé formatado com separador visual
 */
function rodapeNavegacao() {
  return (
    `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `O que mais posso fazer por você?\n\n` +
    `*0*  ↩️  Voltar ao menu\n` +
    `*7*  👩‍💼  Falar com consultor`
  );
}

// ────────────────────────────────────────────────────────────
//  TEXTOS DE CONTEÚDO — As 6 seções informativas da escola
// ────────────────────────────────────────────────────────────

/**
 * Seção 1 — Sobre a Integra Psicanálise
 * Apresenta a missão, diferencial, pilares e abordagens psicanalíticas da escola.
 * Os dados são lidos dinamicamente do content.js.
 *
 * @returns {string} Texto formatado sobre a instituição + rodapé de navegação
 */
function textoSobre() {
  // Monta lista de abordagens: "  • *Nome:* _descrição_"
  const abord = CONTENT.sobre.abordagens
    .map(a => `  • *${a.nome}:* _${a.desc}_`)
    .join('\n');

  // Monta lista de pilares: "✅ pilar"
  const pilares = CONTENT.sobre.pilares
    .map(p => `✅ ${p}`)
    .join('\n');

  return (
    `🏛️  *SOBRE A INTEGRA PSICANÁLISE*\n` +
    `_A Nova Escola_\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `_"${CONTENT.instituicao.diferencial}"_\n\n` + // citação do diferencial em itálico
    `${CONTENT.instituicao.missao}\n\n` +
    `*Nossos pilares:*\n${pilares}\n\n` +
    `*Abordagens integradas:*\n${abord}` +
    rodapeNavegacao()
  );
}

/**
 * Seção 2 — Formação e Módulos
 * Lista os 5 módulos progressivos com todas as 25 disciplinas.
 * Os dados são lidos dinamicamente do content.js (array de módulos).
 *
 * @returns {string} Texto formatado da grade curricular + rodapé de navegação
 */
function textoFormacao() {
  // Para cada módulo, monta: "📘 *Módulo N — Nome*\n    • disciplina1\n    • disciplina2..."
  const modulosTxt = CONTENT.modulos.map(mod => {
    const discs = mod.disciplinas.map(d => `    • ${d}`).join('\n');
    return `📘 *Módulo ${mod.numero} — ${mod.nome}*\n${discs}`;
  }).join('\n\n');

  return (
    `📚 *FORMAÇÃO E MÓDULOS*\n` +
    `_25 Disciplinas em 5 Módulos Progressivos_\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    modulosTxt +
    `\n\n_Cada módulo inclui material didático e práticas terapêuticas._` +
    rodapeNavegacao()
  );
}

/**
 * Seção 3 — Equipe Docente
 * Informa sobre o corpo docente. Como o site ainda não lista os professores
 * individualmente, direciona ao site/contato para mais informações.
 *
 * @returns {string} Texto formatado sobre a equipe + rodapé de navegação
 */
function textoDocente() {
  return (
    `👨‍🏫 *EQUIPE DOCENTE*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Nossa equipe é composta por *${CONTENT.docentes.quantidade} professores* com:\n\n` +
    `✅ Sólida formação acadêmica\n` +
    `✅ Ampla experiência clínica\n` +
    `✅ Vocação genuína para o ensino\n\n` +
    `Integramos especialistas nas principais correntes:\n` +
    `_Freudiana, Lacaniana, Kleiniana,\nWinnicottiana, Bioniana e Reichiana_\n\n` +
    `📲 Para conhecer o currículo completo de cada professor,\n` +
    `entre em contato ou acesse nosso site:\n` +
    `🌐 ${CONTENT.instituicao.site}` +
    rodapeNavegacao()
  );
}

/**
 * Seção 4 — Condições e Benefícios
 * Exibe os 3 perfis de aluno com suas condições de matrícula e mensalidade.
 * Os dados de preços são lidos do content.js (editável sem tocar neste arquivo).
 *
 * @returns {string} Texto formatado com preços e condições + rodapé de navegação
 */
function textoCondicoes() {
  const { iniciantes, avancados, formados } = CONTENT.condicoes;

  /**
   * Monta o bloco de informações de um perfil de aluno.
   * @param {object} c - Objeto de condição do content.js
   * @returns {string} Bloco formatado para aquele perfil
   */
  const bloco = (c) => (
    `👤 *${c.perfil}*\n` +
    // ~~tachado~~ exibe o preço original riscado, destacando o desconto
    `💳 Matrícula: ~~${c.matricula_original}~~ *${c.matricula_com_desconto}* (${c.desconto_matricula} desc.)\n` +
    `📆 Mensalidade: *${c.mensalidade}*\n` +
    `    _${c.obs_mensalidade}_\n` +
    (c.materiais       ? `📦 Materiais: ${c.materiais}\n`      : '') + // campo opcional
    (c.beneficio_extra ? `${c.beneficio_extra}\n` : '') +               // campo opcional
    c.nota
  );

  return (
    `💰 *CONDIÇÕES E BENEFÍCIOS*\n` +
    `_Condições especiais por tempo limitado_\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    bloco(iniciantes) + `\n\n─────────────────────\n\n` +
    bloco(avancados)  + `\n\n─────────────────────\n\n` +
    bloco(formados)   + `\n\n` +
    `📲 _Para garantir sua vaga, entre em contato pelo WhatsApp._` +
    rodapeNavegacao()
  );
}

/**
 * Seção 5 — Unidade e Localização
 * Exibe o endereço físico, link do Google Maps e informações de contato da sede.
 *
 * @returns {string} Texto formatado com localização + rodapé de navegação
 */
function textoUnidade() {
  const u = CONTENT.unidade; // objeto com dados da sede (content.js)
  return (
    `📍 *UNIDADE E LOCALIZAÇÃO*\n` +
    `_${u.nome}_\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🏢 *Endereço:*\n${u.endereco}\n${u.cidade}\n\n` +
    `🏛️  *Estrutura:*\n_${u.estrutura}_\n\n` +
    `📞 *Telefone / WhatsApp:*\n${u.telefone}\n` +
    `📱 https://wa.me/${u.whatsapp}\n\n` +   // link clicável para abrir chat
    `🗺️  *Como chegar:*\n${u.maps}\n\n` +    // link do Google Maps
    `_Visitas podem ser agendadas pelo WhatsApp._` +
    rodapeNavegacao()
  );
}

/**
 * Seção 6 — Contato e Agendamento
 * Lista todos os canais de atendimento: WhatsApp, telefone, e-mail, Instagram, site.
 *
 * @returns {string} Texto formatado com contatos + rodapé de navegação
 */
function textoContato() {
  const c = CONTENT.contato; // objeto com dados de contato (content.js)
  return (
    `📞 *CONTATO E AGENDAMENTO*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `💬 *WhatsApp:*\nhttps://wa.me/${c.whatsapp}\n\n` +   // link clicável
    `📞 *Telefone:* ${c.telefone}\n\n` +
    `📧 *E-mail:* ${c.email}\n\n` +
    `📸 *Instagram:* ${c.instagram}\n\n` +
    `🌐 *Site:* ${c.site}\n\n` +
    `⏰ *Atendimento:*\n${c.horario_atendimento}\n\n` +
    `_${c.agendamento_msg}_` +
    rodapeNavegacao()
  );
}

/**
 * Seção 7 — Confirmação de solicitação de consultor
 * Exibida ao usuário quando ele solicita falar com um humano.
 * O messageHandler.js envia a notificação ao admin em paralelo (wa.me link).
 *
 * @returns {string} Mensagem de confirmação ao usuário
 */
function textoConsultor() {
  return (
    `👩‍💼 *FALAR COM UM CONSULTOR*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `✅ Sua solicitação foi registrada!\n\n` +
    `Um representante da *Integra Psicanálise* entrará em contato com você em breve. 🙂\n\n` +
    `📱 Se preferir falar agora:\nhttps://wa.me/${CONTENT.contato.whatsapp}\n\n` + // link direto
    `⏰ _Atendimento:_ ${CONTENT.contato.horario_atendimento}\n` +
    `📸 _Instagram:_ ${CONTENT.instituicao.instagram}\n\n` +
    `_Digite *0* para voltar ao menu principal._`
  );
}

/**
 * Mensagem de fora do horário de atendimento.
 * Exibida UMA VEZ por sessão quando o usuário envia mensagem fora do horário.
 * Horário de funcionamento: Segunda a Sábado, 8h às 20h (Horário de Brasília).
 *
 * @returns {string} Mensagem informando horário de atendimento
 */
function textoForaDeHorario() {
  return (
    `⏰ *Fora do horário de atendimento*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Olá! Obrigado por entrar em contato com a\n` +
    `*Integra Psicanálise*. 🧠\n\n` +
    `Nosso atendimento automático funciona:\n` +
    `📅 *Segunda a Sábado*\n` +
    `🕗 *Das 8h às 20h* (horário de Brasília)\n\n` +
    `Sua mensagem foi registrada!\n` +
    `Estaremos aqui para atendê-lo(a) assim que\n` +
    `o horário de atendimento reiniciar. 😊\n\n` +
    `Se precisar de atendimento urgente:\n` +
    `📧 ${CONTENT.contato.email}\n` +
    `📸 ${CONTENT.instituicao.instagram}`
  );
}

/**
 * Mensagem de fallback — exibida quando o bot não entende a mensagem do usuário.
 * Oferece 4 sugestões de perguntas comuns para guiar o usuário.
 * O messageHandler.js exibe o menu logo após este texto (veja enviarFallback()).
 *
 * @returns {string} Mensagem de fallback com sugestões
 */
function textoFallback() {
  return (
    `🤖 Desculpe, não consegui compreender sua solicitação.\n\n` +
    `Talvez você queira saber:\n\n` +
    `1️⃣  _Quais são os módulos e disciplinas da formação?_\n` +
    `2️⃣  _Quais são os valores e condições de matrícula?_\n` +
    `3️⃣  _Onde fica a unidade da Integra Psicanálise?_\n` +
    `4️⃣  _Como entrar em contato ou agendar uma visita?_`
  );
}

// ────────────────────────────────────────────────────────────
//  Exportações — disponibiliza todas as funções para o messageHandler
// ────────────────────────────────────────────────────────────
module.exports = {
  mensagemBoasVindas,  // 1ª mensagem (boas-vindas completas)
  saudacaoCurta,       // saudação curta (usuário recorrente)
  menuPrincipal,       // menu numerado em texto (modo pessoal)
  rodapeNavegacao,     // rodapé "0 = menu | 7 = consultor"
  textoSobre,          // seção 1 — Sobre a Integra
  textoFormacao,       // seção 2 — Formação e Módulos
  textoDocente,        // seção 3 — Equipe Docente
  textoCondicoes,      // seção 4 — Condições e Benefícios
  textoUnidade,        // seção 5 — Unidade e Localização
  textoContato,        // seção 6 — Contato e Agendamento
  textoConsultor,      // seção 7 — Solicitar Consultor
  textoForaDeHorario,  // aviso de fora do horário de atendimento
  textoFallback,       // fallback (não entendeu a mensagem)
};

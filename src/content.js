/**
 * =============================================================
 *  content.js — Conteúdo Real da Integra Psicanálise
 * =============================================================
 *  Fonte dos dados: https://integrapsicanalise.com
 *
 *  ✏️  Este é o ÚNICO arquivo que você precisa editar para
 *  atualizar informações do bot (preços, horários, endereço, etc.).
 *  Nenhum outro arquivo precisa ser modificado para mudanças de conteúdo.
 *
 *  ⚙️  Configuração sensível:
 *   - Número do admin: defina ADMIN_WHATSAPP no arquivo .env
 *   - Se .env não existir, usa o fallback hardcoded abaixo
 *   - NUNCA commite o .env no Git (já está no .gitignore)
 *
 *  Estrutura:
 *   adminWhatsapp  → número que recebe alertas de consultor
 *   instituicao    → dados gerais da escola
 *   sobre          → pilares e abordagens (seção "Sobre")
 *   modulos        → grade curricular (5 módulos × 25 disciplinas)
 *   docentes       → informações do corpo docente
 *   condicoes      → preços e benefícios (3 perfis de aluno)
 *   unidade        → endereço e localização da sede
 *   contato        → canais de atendimento
 * =============================================================
 */

require('dotenv').config(); // carrega variáveis do arquivo .env

const CONTENT = {

  // ──────────────────────────────────────────────────────────
  //  Admin — número que recebe notificações quando usuário pede consultor
  //  ⚠️  Configure ADMIN_WHATSAPP no .env com o número do consultor real.
  //  Formato: DDI + DDD + número, sem + ou espaços. Ex: 5581999999999
  // ──────────────────────────────────────────────────────────
  adminWhatsapp: process.env.ADMIN_WHATSAPP || '5581985761616',

  // ──────────────────────────────────────────────────────────
  //  Dados Institucionais — aparece em várias seções do bot
  // ──────────────────────────────────────────────────────────
  instituicao: {
    nome:        'Integra Psicanálise — A Nova Escola',
    slogan:      'Formamos psicanalistas com rigor teórico, sensibilidade clínica e visão plural.',
    missao:      'Inovar a formação psicanalítica no Brasil, integrando as principais escolas e abordagens do pensamento clássico e contemporâneo.',
    diferencial: 'A única escola que integra todas as correntes psicanalíticas.',
    site:        'https://integrapsicanalise.com',
    email:       'integrapsicanalise@gmail.com',
    instagram:   '@integrapsicanalise_',
    whatsapp:    '5581985761616', // formato internacional sem + (para links wa.me)
    telefone:    '(81) 98576-1616',
  },

  // ──────────────────────────────────────────────────────────
  //  Sobre a Escola — pilares e abordagens integradas
  //  Usado na seção 1 do menu (textoSobre em menus.js)
  // ──────────────────────────────────────────────────────────
  sobre: {
    // Pilares institucionais — aparecem com ✅ na resposta
    pilares: [
      'Formação completa em 5 módulos progressivos com material didático e práticas terapêuticas complementares',
      'Abordagem plural integrando Freud, Lacan, Klein, Winnicott, Bion e outras correntes',
      'Corpo docente qualificado com sólida formação acadêmica e ampla experiência clínica',
    ],
    // Correntes psicanalíticas integradas — nome + descrição curta
    abordagens: [
      { nome: 'Freudiana',     desc: 'Inconsciente, pulsões sexuais e agressivas, estrutura id/ego/superego' },
      { nome: 'Lacaniana',     desc: 'Linguagem, estádio do espelho, real/imaginário/simbólico' },
      { nome: 'Kleiniana',     desc: 'Relações objetais precoces, posições esquizo-paranoide e depressiva' },
      { nome: 'Winnicottiana', desc: 'Relações mãe-bebê, conceito de holding e ambiente facilitador' },
      { nome: 'Bioniana',      desc: 'Processos mentais, função continente, dinâmica de grupos' },
      { nome: 'Reichiana',     desc: 'Conexão mente-corpo, couraça caracterial, energia orgônica' },
    ],
  },

  // ──────────────────────────────────────────────────────────
  //  Formação: 5 Módulos | 25 Disciplinas
  //  Usado na seção 2 do menu (textoFormacao em menus.js)
  //  Para adicionar/remover disciplinas, edite o array 'disciplinas' do módulo.
  // ──────────────────────────────────────────────────────────
  modulos: [
    {
      numero: 1,
      nome: 'Fundamentos da Psicanálise',
      disciplinas: [
        'Introdução à Psicanálise e Conceitos Básicos',
        'Legislação e Ética em Psicanálise',
        'Escola Psicanalítica Clássica e Contemporaneidade',
        'As Sete Escolas da Psicanálise',
        'Epigenética e Trauma Transgeracional',
      ],
    },
    {
      numero: 2,
      nome: 'Estruturas Clínicas',
      disciplinas: [
        'Neurociência e Psicanálise',
        'Estrutura Clínica das Neuroses',
        'Estrutura Clínica das Psicoses',
        'Estrutura Clínica das Perversões',
        'Autismo como Quarta Estrutura Psicanalítica',
        'Borderline e Transtornos de Personalidade',
      ],
    },
    {
      numero: 3,
      nome: 'Clínica Psicanalítica',
      disciplinas: [
        'Clínica com Crianças',
        'Clínica com Adolescentes',
        'Bebês e Gerontologia',
        'Técnicas Clínicas e Condução de Casos',
        'Psicanálise em Grupos, Instituições e Empresas',
      ],
    },
    {
      numero: 4,
      nome: 'Especialidades e Práticas',
      disciplinas: [
        'Atuação e Teoria da Expressão Criativa',
        'Terapêutica Farmacológica e Impactos Clínicos',
        'Psicossomática',
        'Práticas Integrativas I — Wilhelm Reich',
        'Bases Afetivas e Adoecimento Contemporâneo',
        'Práticas Integrativas II — Bioenergética e Rebirthing',
      ],
    },
    {
      numero: 5,
      nome: 'Formação e Carreira',
      disciplinas: [
        'Estudos de Casos Psicanalíticos',
        'Sexologia em Psicanálise',
        'Interpretação de Sonhos',
        'Saúde do Profissional e Autocuidado',
        'Construção de Carreira e Empreendedorismo',
      ],
    },
  ],

  // ──────────────────────────────────────────────────────────
  //  Equipe Docente
  //  ⚠️  O site ainda exibe placeholders para os professores.
  //  Atualize 'quantidade' quando a lista oficial for publicada.
  //  Usado na seção 3 do menu (textoDocente em menus.js)
  // ──────────────────────────────────────────────────────────
  docentes: {
    quantidade: 15,   // número total de professores do corpo docente
  },

  // ──────────────────────────────────────────────────────────
  //  Condições e Benefícios — 3 perfis de aluno
  //  Usado na seção 4 do menu (textoCondicoes em menus.js)
  //  ✏️  Para atualizar preços, edite os campos abaixo.
  //  Campos opcionais: 'materiais' e 'beneficio_extra' (remova a linha se não quiser exibir)
  // ──────────────────────────────────────────────────────────
  condicoes: {

    // Perfil 1: quem está começando agora na psicanálise
    iniciantes: {
      perfil:                 'Iniciantes',
      matricula_original:     'R$ 350,00',   // preço cheio (exibido tachado)
      matricula_com_desconto: 'R$ 315,00',   // preço com desconto (exibido em negrito)
      desconto_matricula:     '10%',
      mensalidade:            'R$ 300,00',
      obs_mensalidade:        'válida até dezembro de 2026 (se paga em dia)',
      beneficio_extra:        '✅ Materiais do 1º módulo GRATUITOS', // campo opcional
      nota:                   '⏳ Oferta por tempo limitado',
    },

    // Perfil 2: quem já está em formação em outra escola
    avancados: {
      perfil:                 'Estudantes Avançados',
      matricula_original:     'R$ 350,00',
      matricula_com_desconto: 'R$ 300,00',
      desconto_matricula:     '14%',
      mensalidade:            'R$ 300,00',
      obs_mensalidade:        'válida até dezembro de 2026 (se paga em dia)',
      materiais:              'R$ 120,00 por módulo (a cada 5–6 meses)', // campo opcional
      nota:                   '⏳ Oferta por tempo limitado',
    },

    // Perfil 3: psicanalistas já formados que querem se aprimorar
    formados: {
      perfil:                 'Psicanalistas Formados',
      matricula_original:     'R$ 350,00',
      matricula_com_desconto: 'R$ 300,00',
      desconto_matricula:     '14%',
      mensalidade:            'R$ 300,00',
      obs_mensalidade:        'válida até dezembro de 2026 (se paga em dia)',
      beneficio_extra:        '✅ Credenciamento 2026 GRATUITO (após conclusão)', // campo opcional
      nota:                   '⏳ Oferta por tempo limitado',
    },
  },

  // ──────────────────────────────────────────────────────────
  //  Unidade e Localização — sede física da escola
  //  Usado na seção 5 do menu (textoUnidade em menus.js)
  // ──────────────────────────────────────────────────────────
  unidade: {
    nome:      'Sede — Recife',
    endereco:  'R. Sete de Setembro, 454',
    cidade:    'Recife — PE',
    telefone:  '(81) 98576-1616',
    whatsapp:  '5581985761616', // formato internacional sem + (para links wa.me)
    estrutura: 'Salas modernas e confortáveis, biblioteca especializada em psicologia, sala de supervisão e espaço de convivência.',
    maps:      'https://maps.app.goo.gl/uhXwc2n26qb1tP6fA', // link encurtado do Google Maps
  },

  // ──────────────────────────────────────────────────────────
  //  Contato e Agendamento — todos os canais de atendimento
  //  Usado na seção 6 do menu (textoContato em menus.js)
  //  Também usado em textoConsultor e textoUnidade
  // ──────────────────────────────────────────────────────────
  contato: {
    whatsapp:            '5581985761616',             // para links wa.me (sem + e sem espaços)
    telefone:            '(81) 98576-1616',           // exibido para o usuário
    email:               'integrapsicanalise@gmail.com',
    instagram:           '@integrapsicanalise_',
    site:                'https://integrapsicanalise.com',
    horario_atendimento: 'Segunda a Sábado, das 8h às 18h',
    agendamento_msg:     'Agendamentos de visita e inscrições são realizados pelo WhatsApp.',
  },
};

module.exports = CONTENT;

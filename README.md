# 🧠 Integra Psicanálise — Bot WhatsApp

Bot de atendimento automático para a **Integra Psicanálise**, construído com [Baileys](https://github.com/WhiskeySockets/Baileys) (WhatsApp Web). Responde perguntas sobre a escola, formação, equipe, condições e agendamento — e notifica um consultor humano quando necessário.

---

## Funcionalidades

- Menu de atendimento numerado (1–8) via WhatsApp pessoal ou Business
- Conteúdo completo: sobre a escola, formação, docentes, condições, unidade e contato
- Notificação automática ao consultor com nome e link direto do usuário
- Modo consultor: bot silencia e entrega a conversa para atendimento humano
- Sessão com encerramento automático por inatividade
- Cache LID persistido para resolver contatos salvos (`lid-cache.json`)
- Reconexão automática com backoff em caso de queda

---

## Pré-requisitos

- **Node.js 18+** (recomendado 22+)
- **npm** (vem com o Node)
- Conta **WhatsApp** (pessoal ou Business) para escanear o QR code

---

## Instalação rápida

```bash
# 1. Clone o repositório
git clone https://github.com/seu-usuario/integra-bot.git
cd integra-bot

# 2. Instale as dependências
npm install

# 3. Configure o ambiente
cp .env.example .env
# Edite o .env com seu número de admin
```

---

## Configuração (`.env`)

```env
# Número que recebe alertas de consultor (DDI + DDD + número, só dígitos)
ADMIN_WHATSAPP=5581999999999

# false = Baileys/WhatsApp Web (padrão, conecta via QR code)
# true  = WhatsApp Business Cloud API (Meta) — requer token
USE_CLOUD_API=false

# Ambiente
NODE_ENV=production
```

---

## Google Sheets (Leads)

O projeto ja envia eventos de lead para Google Sheets via `services/googleSheetsService.js`.

### Configuracao rapida
```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=bot@projeto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# Opcao 1: usar planilha existente
GOOGLE_SHEETS_ID=1abc...xyz
GOOGLE_SHEETS_TAB=Leads

# Opcao 2: auto-criar planilha (se GOOGLE_SHEETS_ID vazio)
GOOGLE_SHEETS_AUTO_CREATE=true
GOOGLE_SHEETS_TITLE=Integra Leads
```

### Importante
- Compartilhe a planilha com o `GOOGLE_SERVICE_ACCOUNT_EMAIL` como Editor.
- Ative a API Google Sheets no projeto GCP da conta de servico.
- Quando `GOOGLE_SHEETS_AUTO_CREATE=true`, o bot salva o ID criado em `data/google-sheets-config.json`.

---

## Como rodar

### Modo desenvolvimento (reinicia ao salvar)
```bash
npm run dev
```

### Modo produção (simples)
```bash
npm start
```

### Modo produção com PM2 (recomendado — reinicia em caso de crash)
```bash
# Instalar PM2 globalmente (só precisa fazer uma vez)
npm install -g pm2

# Iniciar o bot
npm run pm2:start

# Ver logs em tempo real
npm run pm2:logs

# Parar
npm run pm2:stop
```

Na primeira execução, um **QR code** aparece no terminal. Escaneie com o WhatsApp no celular em **Dispositivos Vinculados → Vincular dispositivo**.

---

## Estrutura do projeto

```
├── index.js                  # Ponto de entrada
├── ecosystem.config.js       # Configuração PM2
├── .env.example              # Template de variáveis de ambiente
├── src/
│   ├── connection.js         # Gerenciamento da conexão Baileys
│   ├── messageHandler.js     # Lógica de atendimento e roteamento
│   ├── menus.js              # Textos formatados do menu
│   ├── content.js            # Conteúdo da instituição (edite aqui!)
│   ├── cloudApi.js           # Integração Meta Cloud API
│   └── webhookServer.js      # Servidor webhook (modo Cloud API)
└── auth_info_integra/        # Sessão WhatsApp (gerada automaticamente)
```

---

## Personalizar conteúdo

Edite **apenas** o arquivo `src/content.js` para atualizar:
- Preços e condições
- Endereço e horários
- Informações dos docentes
- Canais de contato

---

## Navegação do menu

```
1 → Sobre a Integra
2 → Formação e Módulos
3 → Equipe Docente
4 → Condições e Benefícios
5 → Unidades e Localização
6 → Contato / Agendamento
7 → Falar com Consultor
8 → Finalizar atendimento
0 → Voltar ao menu
```

---

## Arquivos ignorados pelo Git

O `.gitignore` já exclui automaticamente:
- `.env` (credenciais)
- `auth_info_integra/` (sessão WhatsApp)
- `lid-cache.json` (cache interno)
- `node_modules/`
- `logs/`

---

## Licença

MIT — Desenvolvido por **Pedro Miguel**

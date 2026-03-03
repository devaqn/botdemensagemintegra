#!/usr/bin/env bash
# ================================================
#  Bot WhatsApp - Integra Psicanalise
#  Script de configuracao inicial (Linux / macOS)
# ================================================

set -e

echo ""
echo "================================================"
echo "  BOT WHATSAPP - INTEGRA PSICANALISE"
echo "  Configuracao Inicial"
echo "================================================"
echo ""

# Verifica Node.js
if ! command -v node &>/dev/null; then
  echo "[ERRO] Node.js nao encontrado!"
  echo ""
  echo "Instale via: https://nodejs.org"
  echo "Ou use nvm:  https://github.com/nvm-sh/nvm"
  echo ""
  exit 1
fi

NODE_VER=$(node -v)
echo "[OK] Node.js: $NODE_VER"

# Instala dependencias
echo ""
echo "Instalando dependencias (npm install)..."
npm install
echo "[OK] Dependencias instaladas com sucesso."
echo ""

# Cria .env se nao existir
if [ ! -f ".env" ]; then
  if [ ! -f ".env.example" ]; then
    echo "[ERRO] Arquivo .env.example nao encontrado."
    echo "Verifique se esta na pasta correta do projeto."
    exit 1
  fi
  cp ".env.example" ".env"
  echo "[OK] Arquivo .env criado a partir do .env.example"
  echo ""
  echo "================================================"
  echo "  IMPORTANTE: Configure o .env antes de iniciar!"
  echo ""
  echo "  Edite o arquivo .env e defina:"
  echo "    ADMIN_WHATSAPP=5511999999999"
  echo "================================================"
  echo ""
  read -rp "Abrir .env no editor agora? (s/n): " ABRIR
  if [ "$ABRIR" = "s" ] || [ "$ABRIR" = "S" ]; then
    ${EDITOR:-nano} .env
  fi
else
  echo "[OK] .env ja existe -- nao foi sobrescrito."
fi

echo ""
echo "================================================"
echo "  Setup concluido com sucesso!"
echo ""
echo "  Para iniciar o bot execute:"
echo "    bash iniciar.sh"
echo "    ou: npm start"
echo "================================================"
echo ""

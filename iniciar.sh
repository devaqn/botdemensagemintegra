#!/usr/bin/env bash
# ================================================
#  Bot WhatsApp - Integra Psicanalise
#  Script de inicializacao interativo (Linux / macOS)
# ================================================

check_prereqs() {
  if [ ! -f ".env" ]; then
    echo ""
    echo "[AVISO] Arquivo .env nao encontrado."
    echo "Execute a opcao 3 para instalar e configurar."
    echo ""
    read -rp "Pressione Enter para continuar..."
    return 1
  fi
  if [ ! -d "node_modules" ]; then
    echo ""
    echo "[AVISO] Dependencias nao instaladas."
    echo "Execute a opcao 3 para instalar."
    echo ""
    read -rp "Pressione Enter para continuar..."
    return 1
  fi
  return 0
}

show_menu() {
  clear
  echo ""
  echo "================================================"
  echo "  BOT WHATSAPP - INTEGRA PSICANALISE"
  echo "================================================"
  echo ""
  echo "  1. Iniciar Bot    (modo normal / producao)"
  echo "  2. Iniciar Bot    (modo dev - reinicia ao salvar)"
  echo "  3. Instalar / Configurar (rodar setup)"
  echo "  4. Editar .env"
  echo "  5. Sair"
  echo ""
  echo "================================================"
  echo ""
}

while true; do
  show_menu
  read -rp "Escolha uma opcao (1-5): " OPCAO

  case "$OPCAO" in
    1)
      check_prereqs || continue
      clear
      echo ""
      echo "================================================"
      echo "  BOT INICIANDO - MODO NORMAL"
      echo "  Pressione CTRL+C para encerrar."
      echo "================================================"
      echo ""
      node index.js
      echo ""
      read -rp "Bot encerrado. Pressione Enter para voltar ao menu..."
      ;;
    2)
      check_prereqs || continue
      clear
      echo ""
      echo "================================================"
      echo "  BOT INICIANDO - MODO DESENVOLVIMENTO"
      echo "  O bot reinicia automaticamente ao salvar arquivos."
      echo "  Pressione CTRL+C para encerrar."
      echo "================================================"
      echo ""
      node --watch index.js
      echo ""
      read -rp "Bot encerrado. Pressione Enter para voltar ao menu..."
      ;;
    3)
      bash setup.sh
      ;;
    4)
      if [ ! -f ".env" ]; then
        echo ""
        echo "[AVISO] .env nao encontrado."
        echo "Execute a opcao 3 para criar o .env primeiro."
        echo ""
        read -rp "Pressione Enter para continuar..."
        continue
      fi
      ${EDITOR:-nano} .env
      ;;
    5)
      clear
      echo ""
      echo "Ate logo!"
      sleep 1
      exit 0
      ;;
    *)
      echo ""
      echo "Opcao invalida. Tente novamente."
      sleep 1
      ;;
  esac
done

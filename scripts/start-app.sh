#!/bin/bash

# Script para iniciar automaticamente a aplicação Qmentum
# Versão: Atualizada para rodar a partir de App/

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║              🚀 Iniciando Aplicação Qmentum 🚀                ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Diretório da aplicação (pasta pai de scripts/)
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Verificar se o diretório existe
if [ ! -d "$APP_DIR" ]; then
    echo "❌ Erro: Diretório App/ não encontrado!"
    exit 1
fi

# Ir para o diretório da aplicação
cd "$APP_DIR"

echo "📂 Diretório: $APP_DIR"
echo "🌐 Servidor: http://localhost:8000"
echo ""
echo "✅ Aplicação iniciando..."
echo "   (Pressione Ctrl+C para parar)"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""

# Iniciar servidor HTTP
python3 -m http.server 8000










#!/bin/bash

# Script para iniciar a aplicação Qmentum em background
# Versão: Atualizada para rodar a partir de App/

echo "🚀 Iniciando Aplicação Qmentum em background..."

# Diretório da aplicação (pasta pai de scripts/)
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Verificar se já está rodando
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Servidor já está rodando na porta 8000"
    echo "   PID: $(lsof -Pi :8000 -sTCP:LISTEN -t)"
    exit 1
fi

# Iniciar servidor em background
cd "$APP_DIR"
nohup python3 -m http.server 8000 > /tmp/qmentum-server.log 2>&1 &

# Pegar PID
SERVER_PID=$!

echo "✅ Servidor iniciado!"
echo "   PID: $SERVER_PID"
echo "   URL: http://localhost:8000"
echo "   Log: /tmp/qmentum-server.log"
echo ""
echo "Para parar:"
echo "   kill $SERVER_PID"
echo "   ou use: pkill -f 'python3 -m http.server 8000'"

# Salvar PID
echo $SERVER_PID > /tmp/qmentum-server.pid










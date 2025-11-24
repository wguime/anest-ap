#!/bin/bash

# Script para parar a aplicação Qmentum
# Versão: Atualizada para rodar a partir de App/

echo "🛑 Parando Aplicação Qmentum..."

# Verificar se está rodando
if ! lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Nenhum servidor rodando na porta 8000"
    exit 1
fi

# Pegar PID
SERVER_PID=$(lsof -Pi :8000 -sTCP:LISTEN -t)

echo "   Matando processo PID: $SERVER_PID"
kill $SERVER_PID 2>/dev/null

# Aguardar 2 segundos
sleep 2

# Verificar se parou
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Processo ainda rodando. Forçando..."
    kill -9 $SERVER_PID 2>/dev/null
fi

# Limpar arquivo PID
rm -f /tmp/qmentum-server.pid

echo "✅ Servidor parado com sucesso!"




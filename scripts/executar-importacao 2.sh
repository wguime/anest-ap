#!/bin/bash

# Script para executar importação automática de documentos
# Uso: ./executar-importacao.sh

echo "🚀 Iniciando importação automática de documentos..."
echo ""

# Verificar se está na pasta correta
if [ ! -d "Documentos" ]; then
    echo "❌ Erro: Pasta Documentos não encontrada."
    echo "Execute este script da pasta App/"
    exit 1
fi

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Erro: Node.js não está instalado."
    echo "Instale Node.js primeiro: https://nodejs.org/"
    exit 1
fi

# Verificar se serviceAccountKey.json existe
if [ ! -f "serviceAccountKey.json" ]; then
    echo "❌ Erro: Arquivo serviceAccountKey.json não encontrado."
    echo ""
    echo "Para criar o arquivo:"
    echo "1. Acesse: https://console.firebase.google.com/project/anest-ap/settings/serviceaccounts/adminsdk"
    echo "2. Clique em 'Gerar nova chave privada'"
    echo "3. Salve o arquivo como 'serviceAccountKey.json' na pasta App/"
    exit 1
fi

# Verificar se node_modules existe
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install firebase-admin mime-types
fi

# Executar script
echo "📄 Executando script de importação..."
echo ""
node scripts/importar-documentos.js

echo ""
echo "✅ Importação concluída!"









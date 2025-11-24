#!/bin/bash

# Script de Deploy - Sistema Qmentum
# Versão: Atualizada para rodar a partir de App/

echo "🚀 Iniciando deploy do Sistema Qmentum..."
echo ""

# Ir para o diretório da aplicação (pasta pai de scripts/)
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

# Verificar se Firebase CLI está instalado
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI não está instalado!"
    echo "📦 Instalando Firebase CLI..."
    npm install -g firebase-tools
fi

echo "✅ Firebase CLI encontrado"
echo ""

# Fazer login no Firebase (se necessário)
echo "🔐 Verificando autenticação Firebase..."
firebase login --reauth

echo ""
echo "📦 Fazendo build e preparando arquivos..."
echo ""

# Deploy para o Firebase Hosting
echo "🚀 Fazendo deploy para Firebase Hosting..."
firebase deploy --only hosting

echo ""
echo "✅ Deploy concluído com sucesso!"
echo "🌐 Seu site está atualizado em: https://anest-ap.web.app/"
echo ""
echo "💡 Dica: Limpe o cache do navegador (Ctrl+Shift+Delete) após o deploy"
echo "💡 ou use modo anônimo para ver as mudanças imediatamente."
echo ""



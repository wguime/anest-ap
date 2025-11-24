#!/bin/bash
# Script para abrir a pasta dos Comitês no Finder e o Firebase Console no navegador

echo "🏛️  Abrindo pasta dos Comitês e Firebase Console..."
echo ""

# Abrir pasta no Finder
open "/Users/guilherme/Documents/Qmentum/App/Documentos/12 - Comitês "

# Aguardar 2 segundos
sleep 2

# Abrir Firebase Console Storage
open "https://console.firebase.google.com/project/anest-ap/storage/anest-ap.appspot.com/files"

echo "✅ Pasta aberta no Finder"
echo "✅ Firebase Console aberto no navegador"
echo ""
echo "📋 Passos para fazer upload:"
echo "   1. No Firebase Console, navegue até: Documentos/"
echo "   2. Crie a pasta: 12 - Comitês  (COM ESPAÇO NO FINAL)"
echo "   3. Entre na pasta criada"
echo "   4. Clique em 'Upload file' ou 'Fazer upload de arquivo'"
echo "   5. Selecione todos os 9 PDFs da pasta do Finder (use Cmd+A)"
echo "   6. Aguarde o upload completar"
echo ""
echo "🎉 Após o upload, teste em: https://anest-ap.web.app → Painel → Comitês"

#!/usr/bin/env python3
"""
Script para fazer upload dos documentos dos Comitês para o Firebase Storage
usando credenciais do Firebase CLI

Uso:
    python3 upload-comites-simple.py
"""

import os
import subprocess
import json
from pathlib import Path

# Configurações
PROJECT_ID = "anest-ap"
BUCKET_NAME = "anest-ap.appspot.com"
BASE_LOCAL = Path(__file__).parent.parent / "Documentos" / "12 - Comitês "
STORAGE_PREFIX = "Documentos/12 - Comitês /"

# Lista dos 9 documentos
DOCUMENTOS = [
    "REG.ANEST.0001-01 REGIMENTO INTERNO.pdf",
    "REG.ANEST.0002-00 REGIMENTO INTERNO DO COMITÊ FINANCEIRO.pdf",
    "REG.ANEST.0003-00 REGIMENTO INTERNO DO COMITÊ DE GESTÃO DE PESSOAS.pdf",
    "REG.ANEST.0004-00 REGIMENTO INTERNO DO COMITÊ DE QUALIDADE.pdf",
    "REG.ANEST.0005-00 REGIMENTO INTERNO DO COMITÊ DE EDUCAÇÃO CONTINUADA E DE RESIDÊNCIA MÉDICA (REVISADO).pdf",
    "REG.ANEST.0006-00 REGIMENTO INTERNO DO COMITÊ DE ESCALAS.pdf",
    "REG.ANEST.0007-00 REGIMENTO INTERNO DO COMITÊ DE TECNOLOGIA E MATERIAIS.pdf",
    "REG.ANEST.0008-00 REGIMENTO INTERNO DO COMITÊ DE ÉTICA E CONDUTA.pdf",
    "REG.ANEST.0009-00 REGIMENTO INTERNO DO COMITÊ EXECUTIVO DE GESTÃO.pdf"
]

def get_access_token():
    """Obtém o token de acesso do Firebase CLI"""
    try:
        result = subprocess.run(
            ["firebase", "login:ci"],
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode == 0:
            # O token vem na saída
            for line in result.stdout.split('\n'):
                if line.strip() and not line.startswith('✔'):
                    return line.strip()
        return None
    except Exception as e:
        print(f"❌ Erro ao obter token: {e}")
        return None

def upload_file_curl(local_path, storage_path):
    """Faz upload de um arquivo usando curl e Firebase Storage REST API"""
    try:
        # Obter token de acesso
        result = subprocess.run(
            ["firebase", "--project", PROJECT_ID, "login:ci", "--no-localhost"],
            capture_output=True,
            text=True,
            input="y\n"
        )

        # URL da API do Firebase Storage
        url = f"https://firebasestorage.googleapis.com/v0/b/{BUCKET_NAME}/o?name={storage_path.replace(' ', '%20')}"

        # Fazer upload usando curl
        curl_cmd = [
            "curl",
            "-X", "POST",
            "-H", "Content-Type: application/pdf",
            "--data-binary", f"@{local_path}",
            url
        ]

        result = subprocess.run(curl_cmd, capture_output=True, text=True)

        if result.returncode == 0:
            return True
        else:
            print(f"   Erro: {result.stderr}")
            return False

    except Exception as e:
        print(f"   Erro: {e}")
        return False

def main():
    print("🏛️  UPLOAD DE DOCUMENTOS DOS COMITÊS\n")
    print(f"📁 Pasta local: {BASE_LOCAL}")
    print(f"☁️  Firebase Storage: gs://{BUCKET_NAME}\n")
    print(f"📊 Total de documentos: {len(DOCUMENTOS)}\n")
    print("═" * 60 + "\n")

    # Verificar se a pasta local existe
    if not BASE_LOCAL.exists():
        print(f"❌ Pasta não encontrada: {BASE_LOCAL}")
        return 1

    sucessos = 0
    erros = 0

    print("⚠️  ATENÇÃO: Como não temos o service account key,")
    print("   você precisará fazer o upload manual pelo Firebase Console.\n")
    print("📋 Por favor, siga estas instruções:\n")
    print("1. Acesse: https://console.firebase.google.com/project/anest-ap/storage")
    print("2. Navegue até: Documentos/")
    print("3. Crie a pasta: 12 - Comitês  (COM ESPAÇO NO FINAL)")
    print("4. Faça upload dos seguintes arquivos:\n")

    for i, doc in enumerate(DOCUMENTOS, 1):
        local_path = BASE_LOCAL / doc
        exists = "✅" if local_path.exists() else "❌"
        print(f"   {i:2d}. {exists} {doc}")

    print("\n" + "═" * 60)
    print("\n💡 Arquivo de origem:")
    print(f"   {BASE_LOCAL}\n")
    print("💡 Destino no Firebase Storage:")
    print(f"   gs://{BUCKET_NAME}/{STORAGE_PREFIX}\n")

    print("📝 Após o upload, teste em: https://anest-ap.web.app")
    print("   Navegue para: Painel → Comitês\n")

    return 0

if __name__ == "__main__":
    exit(main())

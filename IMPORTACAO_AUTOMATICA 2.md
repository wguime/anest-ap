# 🚀 Importação Automática de Documentos

Este guia explica como importar automaticamente todos os arquivos da pasta `Documentos` para a biblioteca.

## ⚡ Método Rápido (Recomendado)

### Passo 1: Preparar Credenciais

1. Acesse: https://console.firebase.google.com/project/anest-ap/settings/serviceaccounts/adminsdk
2. Clique em **"Gerar nova chave privada"**
3. Salve o arquivo JSON como `serviceAccountKey.json` na pasta `App/`

### Passo 2: Instalar Dependências

```bash
cd App
npm install firebase-admin mime-types
```

### Passo 3: Executar Importação

```bash
node scripts/importar-documentos.js
```

Ou use o script shell:

```bash
./scripts/executar-importacao.sh
```

## 📋 O que o Script Faz

1. **Escaneia** a pasta `Documentos` recursivamente
2. **Encontra** todos os arquivos `.pdf`, `.docx` e `.odt`
3. **Determina** a categoria baseada na subpasta
4. **Verifica** duplicatas e prefere PDFs
5. **Faz upload** para Firebase Storage
6. **Cria** documentos no Firestore com metadados

## 🎯 Funcionalidades

### ✅ Detecção Automática de Categorias

O script mapeia automaticamente as pastas para categorias:

- `1 - Protocolos` → 📋 Protocolos
- `2 - Políticas` → 📜 Políticas  
- `3 - Formulários` → 📝 Formulários
- `4 - Manuais` → 📚 Manuais
- `4 - Relatórios de Segurança` → 📊 Relatórios de Segurança
- `5 - Mapeamento de Processos` → 🗺️ Mapeamento de Processos
- `6 - Termos` → 📑 Termos
- `7 - Ficha Técnica Indicadores` → 📋 Protocolos
- `8 - Mapeamento dos Riscos` → ⚠️ Mapeamento dos Riscos
- `9 - Plano de Segurança do Paciente` → 🛡️ Plano de Segurança do Paciente

### ✅ Preferência por PDFs

Quando há arquivos duplicados (mesmo título):
- Se existir DOCX/DOC e novo for PDF → **substitui pelo PDF**
- Se ambos forem PDF → **mantém o primeiro**
- Se ambos não forem PDF → **mantém o primeiro**

### ✅ Extração de Códigos

Extrai automaticamente códigos de documentos no formato:
- `PRO.ANEST.0001-00` → Código: `PRO.ANEST.0001-00`
- `FOR.RPA.0011-00` → Código: `FOR.RPA.0011-00`

## 📊 Exemplo de Saída

```
🚀 Iniciando importação de documentos...

📁 Encontrados 43 arquivos para importar

[1/43]
📄 Processando: PRO.ANEST.0001-00 avaliacao pre anestesica.pdf
   Caminho: 1 - Protocolos/PRO.ANEST.0001-00 avaliacao pre anestesica.pdf
   Tipo: pdf
   Categoria: Protocolos
   Código: PRO.ANEST.0001-00
   📤 Fazendo upload para Storage...
   ✅ Upload concluído
   ✅ Documento adicionado ao Firestore

...

==================================================
📊 RESUMO DA IMPORTAÇÃO
==================================================
✅ Importados: 40
🔄 Substituídos (PDF preferido): 2
⏭️  Pulados (duplicatas): 1
❌ Erros: 0
📄 Total processado: 43
==================================================
```

## ⚠️ Requisitos

- Node.js 20 ou superior
- Arquivo `serviceAccountKey.json` na pasta `App/`
- Pasta `Documentos/` com arquivos para importar
- Conexão com internet (para upload)

## 🐛 Solução de Problemas

### Erro: "serviceAccountKey.json não encontrado"
- Verifique se o arquivo está na pasta `App/`
- Verifique se o nome está correto (case-sensitive)

### Erro: "Cannot find module 'firebase-admin'"
- Execute: `npm install firebase-admin mime-types`

### Erro: "Pasta Documentos não encontrada"
- Execute o script da pasta `App/`
- Verifique se a pasta `Documentos/` existe

### Erro de permissões no Firebase
- Verifique se as credenciais do serviceAccountKey.json estão corretas
- Verifique se o projeto Firebase está correto (`anest-ap`)

## 📝 Notas

- O script processa arquivos sequencialmente com delay de 300ms entre cada um
- Arquivos grandes podem demorar mais para fazer upload
- O script não sobrescreve documentos existentes (exceto quando substitui não-PDF por PDF)
- Todos os arquivos são tornados públicos no Storage

---

**Última atualização**: Novembro 2025









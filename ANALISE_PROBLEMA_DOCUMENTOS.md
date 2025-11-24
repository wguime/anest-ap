# 🔍 Análise do Problema: Documentos Faltantes

**Data:** Janeiro 2025  
**Status:** Problema identificado e correção implementada

---

## 🐛 Problema Identificado

### 1. Query Ineficiente no `documento-manager.js`

**Problema:** O código estava tentando ordenar por `data` sem filtrar por `ativo === true` primeiro, causando:

- ❌ Queries que podem falhar por falta de índice composto
- ❌ Carregamento de documentos inativos desnecessariamente
- ❌ Filtragem sendo feita no cliente ao invés do servidor
- ❌ Performance ruim em collections grandes

**Código Antigo:**
```javascript
docs = await db.collection(this.config.colecao)
    .orderBy('data', 'desc')
    .limit(50)
    .get();
// Depois filtrava no cliente: if (data.ativo === false) return;
```

**Problemas:**
1. Não filtra por `ativo === true` no servidor
2. Pode falhar se não houver índice para `data`
3. Carrega documentos inativos desnecessariamente

---

## ✅ Correção Implementada

### Nova Query com Fallback em 3 Níveis

**Código Novo:**
```javascript
try {
    // Nível 1: Filtro + Ordenação (mais eficiente)
    docs = await db.collection(this.config.colecao)
        .where('ativo', '==', true)
        .orderBy('data', 'desc')
        .limit(50)
        .get();
} catch (orderError) {
    try {
        // Nível 2: Apenas filtro (sem ordenação)
        docs = await db.collection(this.config.colecao)
            .where('ativo', '==', true)
            .limit(50)
            .get();
    } catch (filterError) {
        // Nível 3: Sem filtro (fallback total)
        docs = await db.collection(this.config.colecao)
            .limit(50)
            .get();
    }
}
```

**Benefícios:**
- ✅ Filtra por `ativo === true` no servidor (mais eficiente)
- ✅ Fallback inteligente se faltar índice
- ✅ Não carrega documentos inativos desnecessariamente
- ✅ Melhor performance

---

## 🔧 Outros Problemas Identificados

### 2. Falta de Índices Compostos no Firestore

**Problema:** Para fazer `where('ativo', '==', true).orderBy('data', 'desc')`, é necessário um índice composto.

**Solução:** Criar índices compostos no Firebase Console:
1. Acesse: https://console.firebase.google.com/project/anest-ap/firestore/indexes
2. Clique em "Create Index"
3. Para cada collection, criar índice:
   - Collection: `nome_da_collection`
   - Fields: 
     - `ativo` (Ascending)
     - `data` (Descending)
   - Query scope: Collection

**Collections que precisam de índice:**
- `politica_gestao_qualidade`
- `politica_disclosure`
- `relatorio_trimestral`
- `relatorio_incidentes`
- `relatorio_auditorias`
- `relatorio_indicadores`
- `doc_mav`
- `doc_eletrolitos`
- `doc_heparina`
- `doc_narcoticos`
- `doc_lista_abreviaturas`
- `doc_intoxicacao_anestesicos`
- `doc_manejo_glicemia`
- `protocolo_higiene_maos`
- `protocolo_prevencao_isc`
- `protocolo_prevencao_ics`
- `protocolo_prevencao_pav`
- `protocolo_prevencao_itu`
- `protocolo_prevencao_broncoaspiracao`
- `protocolo_prevencao_alergia_latex`
- `conciliacao_admissao`
- `conciliacao_transferencia`
- `conciliacao_alta`
- `protocolo_institucional`
- `checklist_cirurgia`
- `biblioteca_documentos`

**Total:** ~27 collections

---

### 3. Documentos Não Estão Sendo Criados com Campo `ativo`

**Problema:** Se documentos forem criados sem o campo `ativo`, a query `where('ativo', '==', true)` não os encontrará.

**Solução:** Garantir que todos os documentos sejam criados com `ativo: true`:

```javascript
const docData = {
    titulo: config.titulo,
    descricao: config.descricao,
    autor: 'sistema@importacao',
    autorNome: 'Sistema de Importação',
    data: admin.firestore.FieldValue.serverTimestamp(),
    ativo: true,  // ← SEMPRE incluir este campo
    arquivoURL: downloadURL,
    arquivoNome: fileName
};
```

**Verificação:** O script `vincular-documentos-cards.js` já inclui `ativo: true` ✅

---

## 📊 Scripts de Verificação Criados

### 1. `verificar-documentos-producao.js`

Verifica quais documentos existem em produção:

```bash
node scripts/verificar-documentos-producao.js
```

**Saída:**
- Lista todas as collections
- Conta documentos em cada collection
- Identifica collections sem documentos
- Mostra documentos faltantes prioritários

### 2. `verificar-documentos-faltantes.js`

Verifica documentos faltantes baseado na documentação esperada.

---

## 🚀 Soluções Implementadas

### ✅ Correção 1: Query Otimizada
- Arquivo: `App/documento-manager.js`
- Linha: ~425-490
- Status: ✅ Corrigido

### ✅ Correção 2: Script de Verificação
- Arquivo: `App/scripts/verificar-documentos-producao.js`
- Status: ✅ Criado

### ⏳ Pendente: Criar Índices Compostos
- Local: Firebase Console
- Status: ⏳ Requer ação manual

---

## 📝 Próximos Passos

### 1. Criar Índices Compostos (Alta Prioridade)

**Opção A: Manual (Firebase Console)**
1. Acesse: https://console.firebase.google.com/project/anest-ap/firestore/indexes
2. Para cada collection, criar índice composto:
   - Campo 1: `ativo` (Ascending)
   - Campo 2: `data` (Descending)

**Opção B: Arquivo `firestore.indexes.json`**
Criar arquivo na raiz do projeto:

```json
{
  "indexes": [
    {
      "collectionGroup": "politica_gestao_qualidade",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "ativo", "order": "ASCENDING" },
        { "fieldPath": "data", "order": "DESCENDING" }
      ]
    }
    // ... repetir para todas as collections
  ],
  "fieldOverrides": []
}
```

Depois executar:
```bash
firebase deploy --only firestore:indexes
```

### 2. Verificar Documentos em Produção

```bash
cd App
node scripts/verificar-documentos-producao.js
```

### 3. Adicionar Documentos Faltantes

```bash
cd App
node scripts/vincular-documentos-cards.js
```

### 4. Verificar Novamente

Após adicionar documentos e criar índices, verificar novamente se tudo está funcionando.

---

## 🔍 Como Verificar se Está Funcionando

1. **Abrir console do navegador (F12)**
2. **Navegar até uma página de documentos**
3. **Verificar se há erros no console:**
   - Se aparecer "Erro ao ordenar por data", significa que falta índice
   - Se não aparecer erro, está funcionando ✅

4. **Verificar se documentos aparecem:**
   - Se aparecerem, está OK ✅
   - Se não aparecerem mas existem no Firestore, pode ser problema de query

---

## 📊 Resumo das Correções

| Item | Status | Prioridade |
|------|--------|------------|
| Query otimizada | ✅ Corrigido | Alta |
| Script de verificação | ✅ Criado | Média |
| Índices compostos | ⏳ Pendente | Alta |
| Documentos faltantes | ⏳ Pendente | Média |

---

**Última atualização:** Janeiro 2025


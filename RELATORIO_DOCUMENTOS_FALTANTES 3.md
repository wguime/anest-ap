# 📊 Relatório de Documentos Faltantes

**Data:** Janeiro 2025  
**Status:** Verificação baseada na documentação do sistema

---

## 📋 Resumo Executivo

- **Total de Cards:** 30
- **Cards com Documentos Vinculados:** 9 ✅
- **Cards sem Documentos:** 21 ❌
- **Taxa de Cobertura:** 30%

---

## ✅ Documentos Presentes (9)

### 📋 Auditorias e Conformidades (2)

1. **Política de Gestão da Qualidade**
   - Collection: `politica_gestao_qualidade`
   - Arquivo esperado: `PLI.ANEST.0001-00 Politica de gestao da qualidade.pdf`
   - Localização: `Documentos/2 - Politicas/`

2. **Política de Disclosure**
   - Collection: `politica_disclosure`
   - Arquivo esperado: `PLI.ANEST.0007-00 Politica de disclosure.docx`
   - Localização: `Documentos/2 - Politicas/`

### 📊 Relatórios de Segurança (2)

3. **Relatório Trimestral**
   - Collection: `relatorio_trimestral`
   - Arquivo esperado: `RELATORIO DE SEGURANCA 3° TRIMESTRE 2024.pdf`
   - Localização: `Documentos/4 - Relatorios de Seguranca/`

4. **Indicadores de Qualidade**
   - Collection: `relatorio_indicadores`
   - Arquivo esperado: `DIVISAO INDICADORES.pdf`
   - Localização: `Documentos/7 - Ficha Tecnica Indicadores/`

### 📚 Biblioteca de Documentos - Medicamentos (2)

5. **Intoxicação por Anestésicos Locais**
   - Collection: `doc_intoxicacao_anestesicos`
   - Arquivo esperado: `PRO.CCG.0020-00 Prevencao e manejo de intoxicacao por anestesicos locais.pdf`
   - Localização: `Documentos/1 - Protocolos/`

6. **Manejo da Glicemia**
   - Collection: `doc_manejo_glicemia`
   - Arquivo esperado: `PRO.INSH.0094_00 Manejo glicemia.pdf`
   - Localização: `Documentos/1 - Protocolos/`

### 🛡️ Protocolos de Prevenção (3)

7. **Protocolo de Higiene das Mãos**
   - Collection: `protocolo_higiene_maos`
   - Arquivo esperado: `PT 03 Higiene de Maos.pdf`
   - Localização: `Documentos/1 - Protocolos/`

8. **Prevenção da Broncoaspiração**
   - Collection: `protocolo_prevencao_broncoaspiracao`
   - Arquivo esperado: `PRO.INSH.0007-16 Protocolo de prevencao da broncoaspiracao..pdf`
   - Localização: `Documentos/1 - Protocolos/`

9. **Prevenção de Alergia ao Látex**
   - Collection: `protocolo_prevencao_alergia_latex`
   - Arquivo esperado: `PRO.INSH.0009-04 Prevencao de Alergia ao latex(AG. Anest 15.02.24).pdf`
   - Localização: `Documentos/1 - Protocolos/`

---

## ❌ Documentos Faltantes (21)

### 📋 Auditorias e Conformidades (3)

| Card | Collection | Status |
|------|------------|--------|
| 🧼 Higiene das Mãos | `auditoria_higiene_maos` | ❌ Sem documento |
| 💊 Uso de Medicamentos | `auditoria_uso_medicamentos` | ❌ Sem documento |
| ❌ Abreviaturas Perigosas | `auditoria_abreviaturas` | ❌ Sem documento |

**Ação:** Criar documentos de auditoria ou vincular documentos existentes relacionados.

### 📊 Relatórios de Segurança (2)

| Card | Collection | Status |
|------|------------|--------|
| ⚠️ Consolidado de Incidentes | `relatorio_incidentes` | ❌ Sem documento |
| 🔍 Relatório de Auditorias | `relatorio_auditorias` | ❌ Sem documento |

**Ação:** Criar relatórios ou vincular documentos existentes da pasta `Documentos/4 - Relatorios de Seguranca/`.

### 📚 Biblioteca de Documentos - Medicamentos (5)

| Card | Collection | Status |
|------|------------|--------|
| 💊 Medicamentos de Alta Vigilância | `doc_mav` | ❌ Sem documento |
| ⚡ Eletrólitos Concentrados | `doc_eletrolitos` | ❌ Sem documento |
| 💉 Segurança no Uso da Heparina | `doc_heparina` | ❌ Sem documento |
| 🔒 Segurança dos Narcóticos | `doc_narcoticos` | ❌ Sem documento |
| ⚠️ Lista de Abreviaturas Perigosas | `doc_lista_abreviaturas` | ❌ Sem documento |

**Nota:** Existe um arquivo relacionado em `Documentos/1 - Protocolos/`:
- `PRO.INSH.0080-13 Gestao de Medicamentos de Alta Vigilancia (AG. Iara 30.04.24).docx.pdf` → pode ser vinculado a `doc_mav`

**Ação:** Verificar se há documentos relacionados na pasta `Documentos/1 - Protocolos/` e vinculá-los.

### 🛡️ Protocolos de Prevenção (4)

| Card | Collection | Status |
|------|------------|--------|
| 🦠 Prevenção de Infecção de Sítio Cirúrgico | `protocolo_prevencao_isc` | ❌ Sem documento |
| 💉 Prevenção de Infecção de Corrente Sanguínea | `protocolo_prevencao_ics` | ❌ Sem documento |
| 🫁 Prevenção de Pneumonia Associada à Ventilação | `protocolo_prevencao_pav` | ❌ Sem documento |
| 🚽 Prevenção de Infecção do Trato Urinário | `protocolo_prevencao_itu` | ❌ Sem documento |

**Ação:** Verificar se há protocolos relacionados na pasta `Documentos/1 - Protocolos/` e criar/vincular documentos.

### 🔄 Conciliação Medicamentosa (4)

| Card | Collection | Status |
|------|------------|--------|
| 📥 Conciliação na Admissão | `conciliacao_admissao` | ❌ Sem documento |
| 🔄 Conciliação na Transferência | `conciliacao_transferencia` | ❌ Sem documento |
| 📤 Conciliação na Alta | `conciliacao_alta` | ❌ Sem documento |
| 📋 Protocolo Institucional | `protocolo_institucional` | ❌ Sem documento |

**Ação:** Criar documentos de conciliação medicamentosa ou vincular documentos existentes.

### 📈 KPIs - Indicadores de Qualidade (2)

| Card | Collection | Status |
|------|------------|--------|
| 📊 KPI - Adesão aos Protocolos | `kpi_adesao_protocolos` | ❌ Sem documento |
| 🦠 KPI - Taxa de Infecção | `kpi_taxa_infeccao` | ❌ Sem documento |

**Ação:** Criar documentos de KPIs ou vincular documentos existentes da pasta `Documentos/7 - Ficha Tecnica Indicadores/`.

### ✅ Outros (2)

| Card | Collection | Status |
|------|------------|--------|
| ✅ Checklist de Cirurgia Segura | `checklist_cirurgia` | ❌ Sem documento |
| 📚 Biblioteca de Documentos (geral) | `biblioteca_documentos` | ❌ Sem documento |

**Ação:** Criar documentos ou vincular documentos existentes relacionados.

---

## 📁 Documentos Disponíveis Localmente (Não Vinculados)

### Documentos na Pasta `Documentos/1 - Protocolos/` que podem ser vinculados:

1. **PRO.INSH.0080-13 Gestao de Medicamentos de Alta Vigilancia**
   - Pode ser vinculado a: `doc_mav` (Medicamentos de Alta Vigilância)

2. **PRO.ANEST.0001-00 avaliacao pre anestesica**
   - Pode ser vinculado a: `protocolo_institucional` ou nova collection

3. **PRO.ANEST.0002-00 Manejo da cefaleira pos puncao dural**
   - Pode ser vinculado a: Nova collection ou `biblioteca_documentos`

4. **PRO.CCG.0011-01 Manutencao da normotermia**
   - Pode ser vinculado a: Nova collection ou `biblioteca_documentos`

5. **PRO.INSH.0008-12 Prevencao de Deterioracao Clinica no Adulto - MEWS**
   - Pode ser vinculado a: Nova collection ou `biblioteca_documentos`

6. **PRO.INSH.0053-05 Prevencao de TEV**
   - Pode ser vinculado a: Nova collection ou `biblioteca_documentos`

7. **PRO.NUT.0002-19 Abreviacao de jejum prolongado**
   - Pode ser vinculado a: `doc_lista_abreviaturas` ou nova collection

8. **PRO.RPA.0003-00 Recuperacao pos anestesica**
   - Pode ser vinculado a: Nova collection ou `biblioteca_documentos`

9. **PRO.RPA.0004-00 Prevencao de nausea e vomito no pos-operatorio**
   - Pode ser vinculado a: Nova collection ou `biblioteca_documentos`

10. **PRO.SCI.0007-14 Antibioticoprofilaxia cirurgica**
    - Pode ser vinculado a: `protocolo_prevencao_isc` (Prevenção de Infecção de Sítio Cirúrgico)

11. **PT 02 Identificacao do cliente**
    - Pode ser vinculado a: Nova collection ou `biblioteca_documentos`

---

## 🚀 Como Adicionar Documentos Faltantes

### Opção 1: Interface Web (Recomendado)

1. Faça login como administrador
2. Navegue até a seção desejada (ex: Qualidade > Auditorias)
3. Clique no card correspondente
4. Clique no botão **"Novo Documento"** ou **"+"**
5. Preencha os dados e faça upload do arquivo

### Opção 2: Script de Vinculação

1. Edite o arquivo `App/scripts/vincular-documentos-cards.js`
2. Adicione uma nova entrada no array `documentosParaVincular`:

```javascript
{
    arquivo: 'Documentos/caminho/arquivo.pdf',
    collection: 'nome_da_collection',
    storagePath: 'nome_da_pasta',
    titulo: 'Título do Documento',
    descricao: 'Descrição do documento'
}
```

3. Execute o script:
```bash
cd App
node scripts/vincular-documentos-cards.js
```

### Opção 3: Firebase Console

1. Acesse: https://console.firebase.google.com/project/anest-ap/firestore
2. Navegue até a collection desejada
3. Clique em "Add document"
4. Preencha os campos:
   - `titulo`: Título do documento
   - `descricao`: Descrição
   - `ativo`: `true`
   - `arquivoURL`: URL do arquivo no Storage (se já estiver no Storage)
   - `arquivoNome`: Nome do arquivo
   - `autor`: Email do autor
   - `autorNome`: Nome do autor
   - `data`: Timestamp atual

---

## 📊 Prioridades Sugeridas

### 🔴 Alta Prioridade (Documentos Essenciais)

1. **Medicamentos de Alta Vigilância** (`doc_mav`)
   - Arquivo disponível: `PRO.INSH.0080-13 Gestao de Medicamentos de Alta Vigilancia`
   - Impacto: Alto - Segurança de medicamentos

2. **Antibioticoprofilaxia Cirúrgica** (`protocolo_prevencao_isc`)
   - Arquivo disponível: `PRO.SCI.0007-14 Antibioticoprofilaxia cirurgica`
   - Impacto: Alto - Prevenção de infecções

3. **Consolidado de Incidentes** (`relatorio_incidentes`)
   - Impacto: Alto - Relatório de segurança

### 🟡 Média Prioridade

4. **Relatório de Auditorias** (`relatorio_auditorias`)
5. **Checklist de Cirurgia Segura** (`checklist_cirurgia`)
6. **Conciliação Medicamentosa** (todas as 3 collections)

### 🟢 Baixa Prioridade (Opcional)

7. KPIs (podem ser criados conforme necessário)
8. Protocolos de prevenção específicos (se houver documentos relacionados)
9. Biblioteca de Documentos geral

---

## ✅ Checklist de Verificação

- [ ] Verificar se todos os documentos esperados estão no Firestore
- [ ] Vincular documentos disponíveis localmente às collections corretas
- [ ] Criar documentos faltantes através da interface web
- [ ] Verificar se os documentos aparecem corretamente nas páginas
- [ ] Testar acesso aos documentos por diferentes usuários
- [ ] Verificar permissões de leitura/escrita

---

**Última atualização:** Janeiro 2025  
**Próxima revisão:** Após adicionar documentos faltantes


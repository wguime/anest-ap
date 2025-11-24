# 📝 Instruções para Adicionar Documentos Faltantes

**Data:** Janeiro 2025  
**Status:** Script atualizado com 12 novos documentos

---

## ✅ O que foi feito

O script `scripts/vincular-documentos-cards.js` foi atualizado com **12 novos documentos** que estavam faltando:

### Documentos de Alta Prioridade (3)

1. **Medicamentos de Alta Vigilância** → `doc_mav`
   - Arquivo: `PRO.INSH.0080-13 Gestao de Medicamentos de Alta Vigilancia (AG. Iara 30.04.24).docx.pdf`

2. **Antibioticoprofilaxia Cirúrgica** → `protocolo_prevencao_isc`
   - Arquivo: `PRO.SCI.0007-14 Antibioticoprofilaxia cirurgica.pdf`

3. **Abreviação de Jejum Prolongado** → `doc_lista_abreviaturas`
   - Arquivo: `PRO.NUT.0002-19 Abreviacao de jejum prolongado(AG. Anest 15.02.24).pdf`

### Documentos Adicionais (9)

4. **Identificação do Cliente** → `biblioteca_documentos`
5. **Avaliação Pré-Anestésica** → `protocolo_institucional`
6. **Manejo da Cefaleia Pós-Punção Dural** → `biblioteca_documentos`
7. **Manutenção da Normotermia** → `biblioteca_documentos`
8. **Profilaxia, Tratamento e Resgate de Dor Aguda Pós-Operatória** → `biblioteca_documentos`
9. **Prevenção de Deterioração Clínica no Adulto - MEWS** → `biblioteca_documentos`
10. **Prevenção de Tromboembolismo Venoso (TEV)** → `biblioteca_documentos`
11. **Recuperação Pós-Anestésica** → `biblioteca_documentos`
12. **Prevenção de Náusea e Vômito no Pós-Operatório** → `biblioteca_documentos`

---

## 🚀 Como Adicionar os Documentos

### Opção 1: Executar o Script (Recomendado)

**Pré-requisitos:**
1. Node.js instalado
2. Arquivo `serviceAccountKey.json` na pasta `App/`

**Passos:**

1. **Obter serviceAccountKey.json:**
   - Acesse: https://console.firebase.google.com/project/anest-ap/settings/serviceaccounts/adminsdk
   - Clique em "Generate new private key"
   - Salve o arquivo como `serviceAccountKey.json` na pasta `App/`

2. **Instalar dependências (se necessário):**
   ```bash
   cd App
   npm install firebase-admin mime-types
   ```

3. **Executar o script:**
   ```bash
   node scripts/vincular-documentos-cards.js
   ```

O script irá:
- ✅ Verificar se os arquivos existem
- ✅ Fazer upload para Firebase Storage
- ✅ Criar documentos no Firestore
- ✅ Tornar os arquivos públicos
- ✅ Evitar duplicatas

---

### Opção 2: Interface Web (Manual)

Se você não tiver acesso ao `serviceAccountKey.json`, pode adicionar os documentos manualmente através da interface web:

**Para cada documento:**

1. **Faça login como administrador**
   - Email: `wguime@yahoo.com.br` ou outro admin

2. **Navegue até a seção correspondente:**
   - **Medicamentos de Alta Vigilância:** Qualidade > Biblioteca de Documentos > Medicamentos de Alta Vigilância
   - **Antibioticoprofilaxia:** Qualidade > Protocolos > Prevenção de Infecção de Sítio Cirúrgico
   - **Abreviação de Jejum:** Qualidade > Biblioteca de Documentos > Lista de Abreviaturas Perigosas
   - **Outros:** Qualidade > Biblioteca de Documentos > Biblioteca de Documentos (geral)

3. **Clique no botão "Novo Documento" ou "+"**

4. **Preencha o formulário:**
   - **Título:** Use o título do script (ex: "Gestão de Medicamentos de Alta Vigilância")
   - **Descrição:** Use a descrição do script
   - **Arquivo:** Faça upload do arquivo correspondente da pasta `Documentos/1 - Protocolos/`

5. **Salve o documento**

---

## 📋 Mapeamento Completo de Documentos

| # | Título | Collection | Arquivo | Prioridade |
|---|--------|------------|---------|------------|
| 1 | Gestão de Medicamentos de Alta Vigilância | `doc_mav` | `PRO.INSH.0080-13 Gestao de Medicamentos de Alta Vigilancia (AG. Iara 30.04.24).docx.pdf` | 🔴 Alta |
| 2 | Antibioticoprofilaxia Cirúrgica | `protocolo_prevencao_isc` | `PRO.SCI.0007-14 Antibioticoprofilaxia cirurgica.pdf` | 🔴 Alta |
| 3 | Abreviação de Jejum Prolongado | `doc_lista_abreviaturas` | `PRO.NUT.0002-19 Abreviacao de jejum prolongado(AG. Anest 15.02.24).pdf` | 🟡 Média |
| 4 | Protocolo de Identificação do Cliente | `biblioteca_documentos` | `PT 02 Identificacao do cliente.pdf` | 🟡 Média |
| 5 | Avaliação Pré-Anestésica | `protocolo_institucional` | `PRO.ANEST.0001-00 avaliacao pre anestesica.pdf` | 🟡 Média |
| 6 | Manejo da Cefaleia Pós-Punção Dural | `biblioteca_documentos` | `PRO.ANEST.0002-00 Manejo da cefaleira pos puncao dural.pdf` | 🟢 Baixa |
| 7 | Manutenção da Normotermia | `biblioteca_documentos` | `PRO.CCG.0011-01 Manutencao da normotermia.pdf` | 🟢 Baixa |
| 8 | Profilaxia, Tratamento e Resgate de Dor Aguda Pós-Operatória na SRPA | `biblioteca_documentos` | `PRO.CCG.0018-00 Profilaxia tratamento e resgate de dor aguda pos operatoria na SRPA..pdf` | 🟢 Baixa |
| 9 | Prevenção de Deterioração Clínica no Adulto - MEWS | `biblioteca_documentos` | `PRO.INSH.0008-12 Prevencao de Deterioracao Clinica no Adulto - MEWS.pdf` | 🟡 Média |
| 10 | Prevenção de Tromboembolismo Venoso (TEV) | `biblioteca_documentos` | `PRO.INSH.0053-05 Prevencao de TEV (AG. ANALICE 22.04) (2).docx.pdf` | 🟡 Média |
| 11 | Recuperação Pós-Anestésica | `biblioteca_documentos` | `PRO.RPA.0003-00 Recuperacao pos anestesica.pdf` | 🟢 Baixa |
| 12 | Prevenção de Náusea e Vômito no Pós-Operatório | `biblioteca_documentos` | `PRO.RPA.0004-00 Prevencao de nausea e vomito no pos-operatorio.pdf` | 🟢 Baixa |

---

## ✅ Verificação Após Adicionar

Após adicionar os documentos, verifique:

1. **No Firebase Console:**
   - Acesse: https://console.firebase.google.com/project/anest-ap/firestore
   - Verifique se os documentos foram criados nas collections corretas
   - Confirme que o campo `ativo` está como `true`

2. **Na Interface Web:**
   - Navegue até as seções correspondentes
   - Verifique se os documentos aparecem na lista
   - Teste o download/visualização dos documentos

3. **Permissões:**
   - Confirme que usuários autenticados podem visualizar
   - Confirme que apenas admins podem editar/deletar

---

## 📊 Status Atual

- **Documentos no script:** 21 (9 existentes + 12 novos)
- **Documentos já vinculados:** 9 ✅
- **Documentos pendentes:** 12 ⏳
- **Taxa de cobertura esperada:** ~70% (após adicionar os 12)

---

## 🔍 Documentos que Ainda Faltam

Após adicionar estes 12 documentos, ainda faltarão:

### Relatórios (2)
- Consolidado de Incidentes (`relatorio_incidentes`)
- Relatório de Auditorias (`relatorio_auditorias`)

### Medicamentos (3)
- Eletrólitos Concentrados (`doc_eletrolitos`)
- Segurança no Uso da Heparina (`doc_heparina`)
- Segurança dos Narcóticos (`doc_narcoticos`)

### Protocolos de Prevenção (3)
- Prevenção de Infecção de Corrente Sanguínea (`protocolo_prevencao_ics`)
- Prevenção de Pneumonia Associada à Ventilação (`protocolo_prevencao_pav`)
- Prevenção de Infecção do Trato Urinário (`protocolo_prevencao_itu`)

### Conciliação (3)
- Conciliação na Admissão (`conciliacao_admissao`)
- Conciliação na Transferência (`conciliacao_transferencia`)
- Conciliação na Alta (`conciliacao_alta`)

### KPIs (2)
- KPI - Adesão aos Protocolos (`kpi_adesao_protocolos`)
- KPI - Taxa de Infecção (`kpi_taxa_infeccao`)

### Outros (2)
- Checklist de Cirurgia Segura (`checklist_cirurgia`)
- Auditorias específicas (3 collections)

**Total restante:** ~15 documentos (que podem ser criados conforme necessário)

---

## 📞 Suporte

Se encontrar problemas:

1. Verifique os logs do script no terminal
2. Confira o console do navegador (F12) para erros
3. Verifique as regras do Firestore em `App/firestore.rules`
4. Confirme que você tem permissões de admin

---

**Última atualização:** Janeiro 2025


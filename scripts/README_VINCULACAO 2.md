# 📋 Guia de Vinculação de Documentos aos Cards

Este guia explica como vincular documentos específicos aos cards reconfigurados no sistema.

## 🎯 Documentos Vinculados

O script `vincular-documentos-cards.js` vincula os seguintes documentos:

### Políticas (Conformidade e Políticas)
1. **Política de Gestão da Qualidade**
   - Arquivo: `Documentos/2 - Politicas/PLI.ANEST.0001-00 Politica de gestao da qualidade.pdf`
   - Collection: `politica_gestao_qualidade`

2. **Política de Disclosure**
   - Arquivo: `Documentos/2 - Politicas/PLI.ANEST.0007-00 Politica de disclosure.docx`
   - Collection: `politica_disclosure`

### Relatórios (Relatórios de Segurança)
3. **Indicadores de Qualidade**
   - Arquivo: `Documentos/7 - Ficha Tecnica Indicadores/DIVISAO INDICADORES.pdf`
   - Collection: `relatorio_indicadores`

4. **Relatório Trimestral** (adicional encontrado)
   - Arquivo: `Documentos/4 - Relatorios de Seguranca/RELATORIO DE SEGURANCA 3° TRIMESTRE 2024.pdf`
   - Collection: `relatorio_trimestral`

### Biblioteca de Documentos (Medicamentos de Alta Vigilância)
5. **Intoxicação por Anestésicos Locais**
   - Arquivo: `Documentos/1 - Protocolos/PRO.CCG.0020-00 Prevencao e manejo de intoxicacao por anestesicos locais.pdf`
   - Collection: `doc_intoxicacao_anestesicos`

6. **Manejo da Glicemia**
   - Arquivo: `Documentos/1 - Protocolos/PRO.INSH.0094_00 Manejo glicemia.pdf`
   - Collection: `doc_manejo_glicemia`

### Protocolos de Prevenção
7. **Prevenção da Broncoaspiração**
   - Arquivo: `Documentos/1 - Protocolos/PRO.INSH.0007-16 Protocolo de prevencao da broncoaspiracao..pdf`
   - Collection: `protocolo_prevencao_broncoaspiracao`

8. **Prevenção de Alergia ao Látex**
   - Arquivo: `Documentos/1 - Protocolos/PRO.INSH.0009-04 Prevencao de Alergia ao latex(AG. Anest 15.02.24).pdf`
   - Collection: `protocolo_prevencao_alergia_latex`

9. **Protocolo de Higiene das Mãos** (adicional encontrado)
   - Arquivo: `Documentos/1 - Protocolos/PT 03 Higiene de Maos.pdf`
   - Collection: `protocolo_higiene_maos`

## 🚀 Como Executar

### Pré-requisitos
1. Node.js instalado
2. Arquivo `serviceAccountKey.json` na pasta `App/`
3. Dependências instaladas: `firebase-admin` e `mime-types`

### Passo 1: Instalar Dependências
```bash
cd App
npm install firebase-admin mime-types
```

### Passo 2: Executar Script
```bash
node scripts/vincular-documentos-cards.js
```

Ou tornar executável e rodar diretamente:
```bash
chmod +x scripts/vincular-documentos-cards.js
./scripts/vincular-documentos-cards.js
```

## 📊 O que o Script Faz

1. **Verifica duplicatas**: Checa se o documento já existe na collection
2. **Faz upload**: Envia o arquivo para Firebase Storage na pasta correta
3. **Torna público**: Configura permissões para acesso público
4. **Cria documento**: Adiciona registro no Firestore com metadados:
   - Título
   - Descrição
   - URL do arquivo
   - Nome do arquivo
   - Data de criação
   - Autor (Sistema de Importação)

## ⚠️ Comportamento com Duplicatas

- Se o documento já existe, o script **não substitui** automaticamente
- Para substituir, exclua o documento existente manualmente primeiro
- O script informa quais documentos foram pulados por já existirem

## 📝 Estrutura de Dados no Firestore

Cada documento criado segue esta estrutura:

```javascript
{
  titulo: "Nome do documento",
  descricao: "Descrição do documento",
  autor: "sistema@importacao",
  autorNome: "Sistema de Importação",
  data: serverTimestamp(),
  ativo: true,
  arquivoURL: "https://storage.googleapis.com/...",
  arquivoNome: "nome_arquivo.pdf"
}
```

## 🔍 Verificação de Outros Documentos

O script também identifica automaticamente outros documentos que podem ser vinculados:
- Relatórios trimestrais
- Protocolos de prevenção
- Documentos de políticas

## 📍 Onde os Documentos Aparecem

Após a vinculação, os documentos estarão disponíveis nos seguintes cards:

- **Políticas**: Qualidade → Auditorias → Conformidade e Políticas
- **Relatórios**: Qualidade → Relatórios de Segurança
- **Biblioteca**: Protocolos → Biblioteca de Documentos → Medicamentos de Alta Vigilância
- **Protocolos**: Protocolos → Protocolos de Prevenção → Protocolos Básicos de Prevenção

## 🐛 Solução de Problemas

### Erro: "serviceAccountKey.json não encontrado"
- Verifique se o arquivo está na pasta `App/`
- Verifique se o nome está correto (case-sensitive)

### Erro: "Arquivo não encontrado"
- Verifique se os caminhos dos arquivos estão corretos
- Certifique-se de que os arquivos existem nas pastas especificadas

### Erro: "Documento já existe"
- Isso não é um erro crítico
- O script informa quais documentos já existem
- Para substituir, exclua manualmente primeiro

## 📚 Documentação Relacionada

- `IMPORTACAO_AUTOMATICA.md` - Guia de importação geral de documentos
- `documento-manager.js` - Sistema de gerenciamento de documentos
- `biblioteca-protocolos-pages.js` - Páginas de biblioteca e protocolos

---

**Última atualização**: Novembro 2025








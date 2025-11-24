# 📚 Instruções para Importar Documentos para Biblioteca

Este guia explica como importar todos os documentos da pasta `Documentos` para a biblioteca de documentos do sistema.

## 🎯 Método Recomendado: Interface Web

### Passo 1: Acessar a Página de Importação

1. Abra o aplicativo no navegador
2. Faça login com uma conta de administrador
3. Acesse: `importar-documentos.html`

### Passo 2: Selecionar a Pasta Documentos

1. Na página de importação, clique no botão "Escolher arquivos"
2. **IMPORTANTE**: Selecione a pasta `Documentos` inteira (não os arquivos individuais)
3. O navegador permitirá selecionar a pasta completa com todos os subdiretórios

### Passo 3: Verificar Mapeamento de Categorias

A página mostra o mapeamento automático de pastas para categorias:
- `1 - Protocolos` → 📋 Protocolos
- `2 - Políticas` → 📜 Políticas
- `3 - Formulários` → 📝 Formulários
- `4 - Manuais` → 📚 Manuais
- `4 - Relatórios de Segurança` → 📊 Relatórios de Segurança
- `5 - Mapeamento de Processos` → 🗺️ Mapeamento de Processos
- `6 - Termos` → 📑 Termos
- `7 - Ficha Técnica Indicadores` → (configurável)
- `8 - Mapeamento dos Riscos` → ⚠️ Mapeamento dos Riscos
- `9 - Plano de Segurança do Paciente` → 🛡️ Plano de Segurança do Paciente

Você pode ajustar a categoria da "Ficha Técnica Indicadores" se necessário.

### Passo 4: Iniciar Importação

1. Clique no botão "🚀 Iniciar Importação"
2. Aguarde o processo concluir
3. Acompanhe o progresso na barra de progresso e no log

### Passo 5: Verificar Resultados

Após a importação, você verá:
- ✅ Quantidade de arquivos importados com sucesso
- ❌ Quantidade de erros (se houver)
- 📄 Lista detalhada no log

## 🔧 Método Alternativo: Script Node.js

Se preferir usar um script automatizado via terminal:

### Pré-requisitos

1. Node.js instalado (versão 20 ou superior)
2. Credenciais do Firebase Admin SDK

### Configuração

1. Vá ao Firebase Console > Project Settings > Service Accounts
2. Clique em "Generate new private key"
3. Salve o arquivo JSON como `serviceAccountKey.json` na pasta `App/`

### Instalação de Dependências

```bash
cd App
npm install firebase-admin mime-types
```

### Execução

```bash
node scripts/importar-documentos.js
```

## 📋 O que o Script Faz

Para cada arquivo encontrado na pasta `Documentos`:

1. **Detecta a categoria** baseada na subpasta onde está localizado
2. **Extrai o código** do documento (se presente no nome do arquivo)
3. **Cria um título** limpo a partir do nome do arquivo
4. **Faz upload** do arquivo para Firebase Storage na pasta `biblioteca_documentos/`
5. **Cria um documento** na collection `biblioteca_documentos` do Firestore com:
   - Título
   - Categoria
   - Código (se encontrado)
   - Descrição automática
   - URL do arquivo no Storage
   - Metadados (tamanho, nome, caminho)
   - Timestamp de criação
   - Informações do usuário que importou

## ⚠️ Observações Importantes

1. **Arquivos Duplicados**: O script não verifica se um documento já existe. Se executar múltiplas vezes, criará documentos duplicados.

2. **Tamanho dos Arquivos**: Arquivos maiores que 10MB podem falhar no upload (limite do Firebase Storage).

3. **Formatos Suportados**: Apenas arquivos `.pdf`, `.docx` e `.odt` são processados.

4. **Autenticação**: É necessário estar autenticado como administrador para usar a interface web.

5. **Backup**: Recomenda-se fazer backup dos dados antes de executar importações em massa.

## 🐛 Solução de Problemas

### Erro: "Por favor, faça login primeiro"
- Certifique-se de estar autenticado no aplicativo
- Verifique se sua conta tem permissões de administrador

### Erro: "Arquivo muito grande"
- Arquivos maiores que 10MB não podem ser importados
- Considere dividir ou comprimir arquivos grandes

### Erro: "serviceAccountKey.json não encontrado"
- Certifique-se de ter baixado as credenciais do Firebase Admin SDK
- Verifique se o arquivo está na pasta `App/`

### Arquivos não aparecem após importação
- Verifique o console do navegador para erros
- Confirme que os arquivos foram criados no Firestore
- Verifique as regras de segurança do Firestore

## 📊 Estrutura de Pastas Esperada

```
Documentos/
├── 1 - Protocolos/
│   └── *.pdf, *.docx
├── 2 - Políticas/
│   └── *.pdf, *.docx
├── 3 - Formulários/
│   └── *.pdf, *.docx, *.odt
├── 4 - Manuais/
│   └── *.pdf
├── 4 - Relatórios de Segurança/
│   └── *.pdf
├── 5 - Mapeamento de Processos/
│   └── *.pdf
├── 6 - Termos/
│   └── *.pdf, *.docx
├── 7 - Ficha Técnica Indicadores/
│   └── *.pdf
├── 8 - Mapeamento dos Riscos/
│   └── *.pdf
└── 9 - Plano de Segurança do Paciente/
    └── *.pdf
```

## ✅ Após a Importação

1. Verifique os documentos na interface da biblioteca
2. Confirme que as categorias estão corretas
3. Ajuste manualmente qualquer documento que precise de correção
4. Teste o acesso aos documentos pelos usuários

---

**Última atualização**: Novembro 2025









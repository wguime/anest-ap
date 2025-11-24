# Script de População de Usuários Autorizados

Este script automatiza a criação dos usuários autorizados no sistema ANEST.

## O que o script faz

1. ✅ Adiciona 43 emails à coleção `authorized_emails` no Firestore
2. ✅ Cria 43 usuários no Firebase Authentication com senha padrão "123456"
3. ✅ Cria perfis iniciais nas coleções `users` e `userProfiles`

## Pré-requisitos

### 1. Chave de Serviço do Firebase

Você precisa da chave de serviço do Firebase Admin SDK:

1. Acesse o [Firebase Console](https://console.firebase.google.com/)
2. Selecione seu projeto (`anest-ap`)
3. Vá em **Configurações do Projeto** (ícone de engrenagem) > **Contas de Serviço**
4. Clique em **Gerar nova chave privada**
5. Salve o arquivo JSON como `firebase-service-account.json`
6. Coloque-o na raiz do projeto (diretório `Qmentum/`)

### 2. Instalação das Dependências

```bash
cd App/scripts
npm install
```

## Como Executar

### Opção 1: Usando npm script

```bash
cd App/scripts
npm run populate-users
```

### Opção 2: Diretamente com Node.js

```bash
cd App/scripts
node populate-authorized-users.js
```

## Saída Esperada

O script mostrará o progresso de cada usuário:

```
========================================
  POPULAR USUÁRIOS AUTORIZADOS - ANEST
========================================

Total de usuários a processar: 43

[1/43] Processando: ADRIANO DALL MAGRO
  Email: dallmagro@hotmail.com
  ✓ Email autorizado adicionado
  ✓ Usuário criado no Authentication (UID: abc123...)
  ✓ Perfil criado (users)
  ✓ Perfil detalhado criado (userProfiles)

...

========================================
  RESUMO DA EXECUÇÃO
========================================
✓ Emails autorizados adicionados: 43
⊘ Emails já existentes: 0
✓ Usuários criados (Auth): 43
⊘ Usuários já existentes (Auth): 0
✓ Perfis criados (Firestore): 43
❌ Erros: 0
========================================

✅ Script concluído com sucesso!

Senha padrão para todos os usuários: 123456
Os usuários podem alterar a senha voluntariamente após o login.
```

## Segurança

- ⚠️ **IMPORTANTE**: A chave de serviço (`firebase-service-account.json`) é CONFIDENCIAL
- ⚠️ Nunca compartilhe ou commite este arquivo no Git
- ⚠️ O arquivo já está no `.gitignore`

## Troubleshooting

### Erro: "Chave de serviço não encontrada"

Certifique-se de que o arquivo `firebase-service-account.json` está em um dos seguintes locais:
- `Qmentum/firebase-service-account.json` (recomendado)
- `Qmentum/App/firebase-service-account.json`
- Ou defina a variável de ambiente: `export GOOGLE_APPLICATION_CREDENTIALS="/caminho/para/firebase-service-account.json"`

### Erro: "Email already exists"

O script detecta automaticamente emails já cadastrados e pula a criação, usando o usuário existente. Isso não é um erro.

### Permissões insuficientes

Certifique-se de que a conta de serviço tem as seguintes permissões:
- Firebase Authentication Admin
- Cloud Firestore Write Access

## Lista de Usuários

O script popula 43 usuários com os seguintes dados:

| Nome | Email |
|------|-------|
| ADRIANO DALL MAGRO | dallmagro@hotmail.com |
| ALEXANDRE SCHMIDT | alexandre.schmidt82@gmail.com |
| ALEXANDRE SILVA DANIELI | alexandre_danieli@yahoo.com.br |
| ... | ... |

Todos os usuários recebem a senha padrão: **123456**

Os usuários podem alterar a senha voluntariamente através do perfil após fazer login.








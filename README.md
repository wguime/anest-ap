# ANEST App - Sistema de Gestão Qmentum

Sistema profissional de gestão, treinamento e quiz para equipe ANEST.

**Live URL**: https://anest-ap.web.app

## 📋 Sobre o Projeto

ANEST é uma aplicação web de gestão de qualidade e treinamento gamificado para serviços de anestesiologia, construída com Firebase. Integra documentação, sistema de quiz ROPs (Práticas Organizacionais Obrigatórias) da acreditação Qmentum, podcasts, gestão de residência médica e indicadores de qualidade.

## 🚀 Estrutura do Projeto

### Arquivos Principais
- `index.html` - Arquivo principal da aplicação
- `app.js` - Lógica principal da aplicação (~1,187 linhas)
- `styles.css` - Folha de estilos principal
- `firebase-config.js` - Configuração do Firebase
- `service-worker.js` - Service Worker para PWA
- `manifest.json` - Configuração PWA

### Pastas de Recursos
- `Documentos/` - Documentos da aplicação (protocolos, políticas, formulários)
- `Podcasts/` - Arquivos de áudio para treinamento
- `Calculadoras/` - Calculadoras médicas e clínicas
- `Comunicados/` - Documentos e backups de comunicados
- `Comunicação interna/` - Documentos de comunicação interna
- `Banco de questões/` - Banco de questões do sistema
- `audio/` - Áudios adicionais
- `icons/` - Ícones PWA

### Arquivos de Configuração
- `firebase.json` - Configuração Firebase Hosting
- `firestore.rules` - Regras de segurança do Firestore
- `storage.rules` - Regras de segurança do Storage

## ⚙️ Configuração Inicial

### 1. Configurar Firebase

1. Edite o arquivo `firebase-config.js` com suas credenciais do Firebase:
```javascript
const firebaseConfig = {
  apiKey: "sua-api-key",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto-id",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "seu-sender-id",
  appId: "seu-app-id"
};
```

### 2. Configurar Regras de Segurança

- Atualize `firestore.rules` conforme necessário
- Atualize `storage.rules` conforme necessário
- Faça o deploy das regras:
```bash
firebase deploy --only firestore:rules
firebase deploy --only storage:rules
```

## 🛠️ Desenvolvimento Local

### Servidor HTTP Local

**Opção 1: Usando os scripts incluídos (recomendado)**

```bash
# Dentro da pasta App/
./scripts/start-app.sh
```

**Opção 2: Manualmente**

```bash
# Python 3
python3 -m http.server 8000

# Ou usando Node.js (se tiver http-server instalado)
npx http-server -p 8000
```

Acesse: http://localhost:8000

### Scripts de Desenvolvimento

O projeto inclui scripts úteis na pasta `scripts/`:

```bash
# Iniciar servidor local (foreground)
./scripts/start-app.sh

# Iniciar servidor local (background)
./scripts/start-app-background.sh

# Parar servidor em background
./scripts/stop-app.sh

# Fazer deploy para Firebase
./scripts/deploy.sh
```

### Estrutura de Pastas para Desenvolvimento

O projeto está configurado para usar a pasta `App` como diretório público. Certifique-se de que o `firebase.json` está configurado corretamente:

```json
{
  "hosting": {
    "public": "App",
    ...
  }
}
```

## 📦 Deploy

### Deploy Completo

```bash
firebase deploy
```

### Deploy Apenas Hosting

```bash
firebase deploy --only hosting
```

### Deploy Apenas Regras

```bash
firebase deploy --only firestore:rules
firebase deploy --only storage:rules
```

## 📚 Documentação Técnica

Para documentação técnica completa, consulte o arquivo `CLAUDE.md` que contém:
- Arquitetura do projeto
- Estrutura de dados do Firestore
- Sistema de permissões
- Guias de desenvolvimento
- Padrões de código

## 🔐 Segurança

- Todas as operações de leitura requerem autenticação
- Operações de escrita requerem permissões de administrador
- Regras de segurança configuradas em `firestore.rules` e `storage.rules`

## 📱 PWA (Progressive Web App)

O projeto é uma PWA instalável:
- Funciona offline (com Service Worker)
- Pode ser instalado no dispositivo
- Suporta notificações push (se configurado)

## 🧪 Testes

Para testar localmente:
1. Inicie o servidor HTTP local
2. Acesse http://localhost:8000
3. Faça login com credenciais de teste
4. Teste as funcionalidades principais

## 📝 Notas Importantes

- **Cache Busting**: Os arquivos JS/CSS usam versionamento (`?v=timestamp`) para evitar problemas de cache
- **Firebase SDK**: Usa Firebase SDK v10.7.1 (compat mode)
- **Navegadores Suportados**: Chrome, Firefox, Safari, Edge (versões recentes)

## 🤝 Suporte

Para suporte técnico ou dúvidas:
- Consulte `CLAUDE.md` para documentação detalhada
- Verifique os logs do console do navegador para erros
- Verifique o Firebase Console para problemas de autenticação/permissões

## 📄 Licença

Projeto proprietário - ANEST

---

**Última atualização**: Novembro 2025


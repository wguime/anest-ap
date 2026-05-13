# LGPD — Push Notifications (Web Push via FCM)

> Sprint 21 Wave 2.2 — v5.0.0
> Base regulatória: Lei 13.709/2018 (LGPD), artigos 7º, 8º, 9º, 18.

## 1. Resumo executivo

ANEST envia notificações push para o navegador/PWA do usuário com o objetivo
de alertar sobre eventos operacionais (plantões, aprovações pendentes, prazos
de revisão, comunicados urgentes). O canal é **estritamente opt-in**: o usuário
só recebe push após (1) consentir no prompt do browser e (2) o app conseguir
registrar um token FCM via `getFcmToken()`.

## 2. Base legal

| Categoria | Base legal LGPD | Justificativa |
|-----------|-----------------|---------------|
| FCM device token | Art. 7º, I — **consentimento** | Usuário aciona explicitamente em banner opt-in (PushNotificationOptIn). Sem consentimento, nada é coletado. |
| Mapeamento token → userId | Art. 7º, I — **consentimento** + Art. 7º, V — **execução de contrato** | Necessário para endereçar push ao destinatário correto. |
| Conteúdo da push (title/body) | Art. 7º, V — execução de contrato | Mesmo conteúdo da notificação in-app que o usuário já recebe (operacional). |

Não há tratamento de dados sensíveis de saúde (Art. 11) neste canal — push
carrega apenas título + corpo + URL de deep-link.

## 3. Dados pessoais processados

| Campo | Onde fica armazenado | Por quanto tempo |
|-------|---------------------|------------------|
| `fcmToken` (string opaca emitida pelo FCM) | Firestore `userProfiles/{uid}.fcmToken` | Até o usuário desativar via `unsubscribe()` ou limpar permissão do site. |
| `fcmTokenUpdatedAt` (timestamp) | Firestore `userProfiles/{uid}.fcmTokenUpdatedAt` | Mesmo TTL que o token. Usado para refresh aos 7 dias. |
| Histórico de envios | **NÃO PERSISTIDO** | Apenas log de runtime na edge function `send-fcm-push` (Supabase logs, retenção padrão). |

Sem coleta de IP, user-agent, geolocalização, ou device fingerprint específicos
para push. O token FCM é gerado pelo Google e tratado como identificador opaco.

## 4. Direitos do titular implementados

| Direito (Art. 18) | Como exercer no app |
|-------------------|---------------------|
| **Confirmação** da existência de tratamento | Tela de Configurações → seção "Notificações Push" (status: ativo/inativo). |
| **Acesso** aos dados | `userProfiles/{uid}` é exportado pelo painel de Solicitações LGPD (Centro de Gestão). |
| **Correção** | N/A — token é gerado automaticamente, não tem dado a corrigir. |
| **Anonimização / eliminação** | Botão "Desativar notificações" chama `unsubscribe()` → `deleteToken()` no FCM + limpa `fcmToken` no Firestore. |
| **Portabilidade** | Token FCM é específico do par {device, projeto Firebase}; não é portável fora do app — informação documentada na resposta da solicitação. |
| **Oposição** | Equivalente ao direito de eliminação acima. Adicionalmente, revogar a permissão do site nas configurações do browser interrompe o canal imediatamente. |
| **Revogação do consentimento** | Mesmo botão "Desativar notificações". Operação é IRREVERSÍVEL no token atual (precisa novo opt-in para reativar). |

## 5. Compartilhamento com terceiros

O serviço FCM é operado pela Google (Google LLC). Token + payload trafegam
pelos servidores do FCM (EUA, Frankfurt, Tóquio etc., depending on closest
region). Base contratual: termos do Firebase + adesão da Google ao GDPR/LGPD.
Não há venda de dados ou compartilhamento com outros parceiros.

A edge function `send-fcm-push` autentica via service account Google (RS256 OAuth2)
para emitir os tokens de acesso ao FCM HTTP v1 API. O `FCM_SERVICE_ACCOUNT_JSON`
vive **apenas em Supabase Edge Secrets** (não em código, não em commits).

## 6. Medidas de segurança

- **Consentimento explícito**: nunca registra token sem prompt afirmativo.
- **Re-prompt window**: banner dispensado não reaparece por 7 dias.
- **TTL de token**: refresh automático a cada 7 dias para reduzir risco de tokens
  obsoletos compartilhados entre devices.
- **Auth obrigatório na edge**: `send-fcm-push` valida JWT HS256 do caller antes
  de qualquer lookup ou envio.
- **Sem fan-out anônimo**: só envia para usuários com token persistido (opt-in).
- **Logs sem PII**: edge function loga apenas `caller`, `target` (Firebase UID
  opaco), `messageId` — não loga título nem corpo.

## 7. DPO / contato

Em caso de dúvidas ou exercício de direitos relativos a este canal:
`anestlgpd@gmail.com` (mesmo canal LGPD do app — gerenciado pelo Centro de Gestão).

## 8. Histórico de revisões

| Data | Versão | Autor | Mudança |
|------|--------|-------|---------|
| 2026-05-13 | v1.0 | Sprint 21 W2.2 | Documento inicial, criação do canal push. |

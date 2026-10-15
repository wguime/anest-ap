---
paths:
  - "src/config/**"
  - "src/services/supabase*"
  - "src/contexts/**/*.jsx"
  - "src/App.jsx"
  - "supabase/**"
description: Arquitetura híbrida Firebase Auth + Supabase. JWT flow, RLS, field mapping, pooler config
---

# Supabase + Firebase — Arquitetura Híbrida

## JWT Flow (caminho duplo — `getSupabaseToken` em `src/config/supabase.js`)
1. User login → Firebase Auth → Firebase ID Token
2. Preferencial (desde 10/06/2026): o próprio ID Token (RS256) vai ao Supabase pelo `accessToken` do
   client e o Third-Party Auth valida no gateway. Exige o claim `role: 'authenticated'` (Cloud Function
   `setRoleClaimOnCreate` + backfill `functions/set-role-claims.js`).
3. Fallback legado, até o descomissionamento: usuário sem o claim cai na Edge `get-supabase-token`, que
   valida o ID Token e emite JWT HS256 (`sub` = Firebase UID, `role` = 'authenticated'); cache de 50 min
   para token de 60.
4. As Edge Functions aceitam os dois formatos (`_shared/verify-auth.ts`).
5. Token error: custom event `supabase-token-error` → toast

## _authReady Promise
Cold start guard — toda operação Supabase aguarda `_authReady` resolver antes de executar queries.
Exceção (15/10/2026): antes de ele resolver, `getSupabaseToken` usa o ID token que o Firebase já guardou
(`src/lib/tokenPersistido.js`) se for do usuário da sessão salva, tiver o claim `role` e valer por ≥2 min.

## Sessão otimista — o app abre antes de o Firebase confirmar (15/10/2026)
Com `anest-sessao-v1` (`src/lib/sessaoSalva.js`: perfil do último login CONFIRMADO, sem token de push), o
`UserContext` nasce autenticado e a Home sai na hora; o Firebase confirma em segundo plano (antes: 1,6–2,3 s
de spinner por abertura). Consequências para código novo:
- `firebaseUser` fica `null` até a confirmação e `auth.currentUser` também — quem lê o Firebase direto na
  abertura faz `await authPronto()` (de `@/config/firebase`) antes; sem isso a leitura dá null e desiste
  (era o caso do refresh do token de push e do lote de notificações).
- Escrita do perfil usa `uidConfirmado()` do contexto, nunca `firebaseUser.uid` direto.
- Papel/permissões da sessão salva valem só até a 1ª reconciliação desta abertura — o doc do Firestore pode
  estar atrás do Supabase (o card da escala piscava, caso de 27/08).
- `createReliableSubscription` espera o realtime ter token antes de entrar no canal privado: sem token o join
  é recusado (`CHANNEL_ERROR`) e a reconexão dispara `onRefetch`.
- O supabase-js entrega ao realtime o 1º token com `setAuth(token)` — o realtime-js trata como "manual" e
  NUNCA renova (nem no heartbeat). `config/supabase.js` escuta `onIdTokenChanged` e chama `setAuth()` SEM
  argumento (modo callback). Não remover: sem ela o canal fica com o token da abertura, vencido após 1 h.
- Escritas da janela otimista: `uidConfirmado()` (confere o uid da tela); audit trail nunca `'system'` —
  sem uid confirmado, não grava (ex.: `useInfraStatus`).
- Firestore e o caminho legado HS256 continuam esperando a confirmação (o SDK enfileira até o 1º usuário).

## Field Mapping
camelCase (JavaScript) ↔ snake_case (PostgreSQL). Sempre converter nos services.
```javascript
// JS → DB
const dbData = { first_name: data.firstName, updated_at: new Date() };
// DB → JS
const jsData = { firstName: row.first_name, updatedAt: row.updated_at };
```

## Pooler Connection
- Host: `aws-0-us-west-2.pooler.supabase.com`
- IPv6 direto INDISPONÍVEL — sempre usar pooler
- User: `postgres.vjzrahruvjffyyqyhjny`

## Chamada de edge PARA edge (06/09/2026)
Autenticar pela chave de serviço comparada por **IGUALDADE**, nunca por `jwtVerify`: as chaves novas
do Supabase (`sb_secret_…`, `sb_publishable_…`) não são JWT, então a verificação de assinatura
devolve 401. Foi assim que o e-mail do canal público de denúncias sumiu em silêncio — o disparo é
fire-and-forget e ninguém percebeu até o teste ponta a ponta. Exemplo: `relato-publico` →
`notify-incident`. Quando quem chama é o BANCO (trigger), o token vem do vault
(`edge_fn_service_role`) via `net.http_post` — padrão dos crons.

## Restrições
- Schema `auth` NÃO é writable via pooler → funções customizadas no schema `public`
- `to_tsvector('portuguese', ...)` NÃO é immutable → usar TRIGGER, não GENERATED ALWAYS AS

## reconcileFromSupabase
Sync Firestore ↔ Supabase profiles. Firestore é source of truth para perfis, Supabase para dados de negócio.

## Real-time — Broadcast (sinal + busca por chave), NÃO `postgres_changes` (16/09/2026)
`postgres_changes` faz o Realtime consultar o WAL a cada ~100 ms enquanto houver UM assinante em
qualquer tabela (foi 59 % do tempo de CPU do banco; 10–39 s por rodada no dia em que o Nano do plano
free saturou). O trigger `public.rt_sinal` (migration `20260916203000`) emite por `realtime.send` só um
SINAL `{ table, op, pk, chaves, antes }` — nunca a linha, porque o canal entrega a mesma mensagem a
todo assinante e a RLS da tabela não vale dentro dele. O helper busca a linha pela PK via PostgREST
(RLS vale; linha invisível = evento descartado).
```javascript
const { cleanup } = createReliableSubscription({
  table: 'notifications',
  filter: 'recipient_id=eq.<uid>',   // coluna de escopo pessoal → tópico u:<tabela>:<uid>
  callback: ({ eventType, new: novo, old: velho }) => …,
  onRefetch: recarregar,             // reconexão
  conteudo: false,                   // opcional: só pk + chaves, sem buscar a linha (escala)
})
```
- Tabela nova com tela ao vivo: acrescentar o trigger `tr_rt_sinal` (com as colunas da PK como
  argumentos) na migration; sem trigger, a assinatura nunca dispara.
- Escopo pessoal (`u:`) só existe para notifications, messages e incident_notification_settings —
  a lista vive em `ESCOPO_PESSOAL` do helper, no `rt_sinal()` e na policy de `realtime.messages`;
  os três têm de bater.
- Um canal por tópico por cliente (o realtime-js devolve o mesmo canal e `subscribe()` é único):
  o helper compartilha ouvintes. Nunca chamar `supabase.channel(...).on('postgres_changes', …)`.
- A publication `supabase_realtime` está SEM tabelas desde 17/09 (migration `20260917003000`,
  aplicada com `realtime.subscription` = 0). Tabela nova NÃO entra na publication — entra com o
  trigger `tr_rt_sinal`. Se alguém voltar a `add table`, o polling do WAL volta junto.

## Referências
- Config: `src/config/supabase.js`
- JWT: `jose` library (SignJWT)
- Service canônico: `src/services/supabaseIncidentsService.js`
- Context canônico: `src/contexts/ComunicadosContext.jsx`

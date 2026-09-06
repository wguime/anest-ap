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

## JWT Flow
1. User login → Firebase Auth → Firebase ID Token
2. Edge Function recebe ID Token → valida → emite Supabase JWT (HS256)
3. JWT inclui: `sub` = Firebase UID, `role` = 'authenticated'
4. Cache: 50 minutos, refresh: 10 minutos antes de expirar
5. Token error: custom event `supabase-token-error` → toast

## _authReady Promise
Cold start guard — toda operação Supabase aguarda `_authReady` resolver antes de executar queries.

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

## Real-time
```javascript
createReliableSubscription(tableName, callback, {
  retryDelay: 1000,        // Exponential backoff
  maxRetries: 10,
  onError: handleError
});
```

## Referências
- Config: `src/config/supabase.js`
- JWT: `jose` library (SignJWT)
- Service canônico: `src/services/supabaseIncidentsService.js`
- Context canônico: `src/contexts/ComunicadosContext.jsx`

---
globs: ["src/config/**", "src/services/supabase*", "src/contexts/UserContext*", "supabase/**"]
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

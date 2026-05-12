# Arquitetura — ANEST

## Stack híbrido Firebase + Supabase

ANEST opera com 2 backends:
- **Firebase:** Auth (Google + email/password) + Firestore (perfis user + algumas coleções legadas) + Storage (certificados PDF).
- **Supabase:** Postgres com RLS (documentos, comunicados, incidentes, denúncias, planos de ação, conflitos, audit logs). JWT customizado HS256 emitido por Edge Function.

### JWT flow
1. User login → Firebase Auth → Firebase ID Token.
2. Edge Function `mint-supabase-token` recebe ID Token, valida via Firebase Admin SDK, emite JWT HS256 com `sub = Firebase UID`, `role = 'authenticated'`.
3. Cliente cacheia 50 min, refresh 10 min antes de expirar.
4. Frontend usa o JWT no header `Authorization: Bearer <jwt>` para Supabase REST/RLS.

### Providers (src/main.jsx)
```
<UserProvider>                    // Firebase Auth + Firestore profile
  <AuthGatedProviders>            // só após login
    <DocumentsContext>
    <MessagesContext>
    <ComunicadosContext>
    ...
    <DeferredProviders>           // 2s delay (não-críticos)
      <UpToDateContext>
      ...
    </DeferredProviders>
  </AuthGatedProviders>
</UserProvider>
```

### Edge Functions (Deno)
- `mint-supabase-token` — Firebase ID Token → Supabase JWT
- `generate-api-token` — admin gera token de API externa (scopes granulares Wave 1.1)
- `api-v1` — endpoint público read-only: `/v1/docs`, `/v1/planos-acao`, `/v1/comunicados`
- `sign-cert` / `verify-cert-public` — HMAC V2 para certificados de educação
- `verify-doc-public` — verificação de hash de documento via UUID

### Design System
- 92 componentes em `src/design-system/components/{ui,anest,charts,...}`
- Tokens em `src/design-system/Tokens.json` (fonte da verdade)
- Showcase em `src/design-system/showcase/` (dev-only)

### Roteamento
Switch-based em `src/App.jsx` (NÃO react-router). `renderAppPage()` retorna o componente correto por `currentPage`. Cada case usa `key={pageName}` para forçar remount.

### Offline / PWA / Sync
- `vite-plugin-pwa` + Workbox: shell precache + runtime caching para chunks/images/Supabase REST/storage.
- F6.2 offline queue: mutations não-idempotentes (`comunicado.*`, `documento.recordAcknowledgement`, F6.2 rollout em Wave 3.5) entram em fila IndexedDB → replay quando online.
- F6.3 conflict queue: 23505/409/412 → `documento_conflict_queue` (Supabase) → admin resolve no Centro de Gestão.

### Categorias de compliance
- LGPD: consentimento, anonimização, retenção (`.claude/rules/lgpd.md`).
- Qmentum: workflow aprovação + 6 categorias ponderadas (`.claude/rules/qmentum-compliance.md`).

## Detalhes por subsistema
Veja `docs/`:
- `escalas-plantoes.md`
- `organograma.md`
- `formularios-publicos.md`
- ...

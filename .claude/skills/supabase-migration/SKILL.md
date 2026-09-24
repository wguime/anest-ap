---
name: supabase-migration
description: Padrão para adicionar nova tabela Supabase. Migration SQL, RLS, service, context, field mapping.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
user-invocable: true
disable-model-invocation: true
---

# Nova Tabela Supabase — ANEST

## Passo a Passo

### 1. Criar Migration SQL
Criar arquivo em `supabase/migrations/` com:
- CREATE TABLE com campos snake_case
- RLS policies (enable RLS + policies por role)
- Indexes para queries frequentes
- Trigger para updated_at automático

```sql
CREATE TABLE public.minha_tabela (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.minha_tabela ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.minha_tabela FORCE ROW LEVEL SECURITY;

-- Uma policy por verbo que o app usa: verbo sem policy devolve 0 linhas sem erro
-- (UPDATE vira PGRST116). Verbo que fica sem policy de propósito vai comentado aqui.
-- Quem pode = helper SECURITY DEFINER do módulo, no padrão firebase_uid()/is_admin().
CREATE POLICY "minha_tabela_select" ON public.minha_tabela
  FOR SELECT TO authenticated USING ((select public.can_write_minha_tabela()));
CREATE POLICY "minha_tabela_insert" ON public.minha_tabela
  FOR INSERT TO authenticated WITH CHECK ((select public.can_write_minha_tabela()));
CREATE POLICY "minha_tabela_update" ON public.minha_tabela
  FOR UPDATE TO authenticated
  USING ((select public.can_write_minha_tabela()))
  WITH CHECK ((select public.can_write_minha_tabela()));
CREATE POLICY "minha_tabela_delete" ON public.minha_tabela
  FOR DELETE TO authenticated USING ((select public.can_write_minha_tabela()));
```

Antes de aplicar, o agente `migration-validator` revisa o SQL (CLAUDE.md). Aplicar com `node scripts/deploy-sp21-mgmt-api.mjs apply-migration <path>` (o CLI do Supabase não está instalado) ou `mcp__supabase__apply_migration`.

### 2. Criar Service
`src/services/supabase[Nome]Service.js`

```javascript
import { getSupabaseToken } from '../config/supabase';

// Field mapping camelCase ↔ snake_case
const toDb = (data) => ({
  titulo: data.titulo,
  created_by: data.createdBy,
});
const fromDb = (row) => ({
  id: row.id,
  titulo: row.titulo,
  createdBy: row.created_by,
  createdAt: row.created_at,
});

export async function fetchItems() {
  const token = await getSupabaseToken();
  // ... query com token
}
```

Service canônico: `src/services/supabaseIncidentsService.js`

### 3. Criar Context
`src/contexts/[Nome]Context.jsx`

```jsx
import { createReliableSubscription } from '../services/supabaseSubscriptionHelper';

// Provider com:
// - loading/error states
// - CRUD functions
// - Real-time subscription
```

Context canônico: `src/contexts/ComunicadosContext.jsx`

Tela ao vivo exige, na migration, o trigger `tr_rt_sinal` com as colunas da PK como argumentos — sem ele a assinatura nunca dispara (o Realtime daqui é Broadcast de sinal, não `postgres_changes`; rule `supabase-firebase`).

### 4. Registrar Provider
Adicionar no `src/main.jsx`:
- Se leve → `AuthGatedProviders`
- Se pesado → `DeferredProviders`: monta junto com a árvore e adia só o primeiro fetch, lendo `useDeferredReady()` como os outros providers Tier 2. Condicionar a montagem remonta o App inteiro aos 2s.

### 5. Audit Trail
Toda mutation deve incluir `changedBy: currentUserId` (NUNCA hardcoded).

## Gotchas

### Pooler Connection
IPv6 direto indisponível. Sempre usar pooler: `aws-0-us-west-2.pooler.supabase.com`

### Auth Schema
Schema `auth` NÃO writable via pooler → funções customizadas no schema `public`.

### to_tsvector
`to_tsvector('portuguese', ...)` NÃO é immutable → usar TRIGGER, não GENERATED ALWAYS AS.

## Referências
- Migration canônica: `supabase/migrations/019_comunicados.sql`
- Service canônico: `src/services/supabaseIncidentsService.js`
- Context canônico: `src/contexts/ComunicadosContext.jsx`
- Config: `src/config/supabase.js`

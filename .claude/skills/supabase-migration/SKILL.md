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
Criar arquivo em `supabase/` com:
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

CREATE POLICY "Users can read" ON public.minha_tabela
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert" ON public.minha_tabela
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
```

Executar via: `mcp__claude_ai_Supabase__apply_migration`

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
import { createReliableSubscription } from '../services/supabaseRealtimeService';

// Provider com:
// - loading/error states
// - CRUD functions
// - Real-time subscription
```

Context canônico: `src/contexts/ComunicadosContext.jsx`

### 4. Registrar Provider
Adicionar no `src/main.jsx`:
- Se leve → `AuthGatedProviders`
- Se pesado → `DeferredProviders` (2s delay)

### 5. Audit Trail
Toda mutation deve incluir `changedBy: currentUserId` (NUNCA hardcoded).

## Gotchas

### Pooler Connection
IPv6 direto indisponível. Sempre usar pooler: `aws-0-us-west-2.pooler.supabase.com`

### Auth Schema
Schema `auth` NÃO writable via pooler → funções customizadas no schema `public`.

### to_tsvector
`to_tsvector('portuguese', ...)` NÃO é immutable → usar TRIGGER, não GENERATED ALWAYS AS.

### DeferredProviders
Contexts pesados (com real-time) vão em DeferredProviders (2s delay após mount).

## Referências
- Migration canônica: `src/sql/infra_health_history.sql`
- Service canônico: `src/services/supabaseIncidentsService.js`
- Context canônico: `src/contexts/ComunicadosContext.jsx`
- Config: `src/config/supabase.js`

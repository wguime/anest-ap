# Seed Data — ANEST DEV

> Sprint 21 Wave 2.1 — Dados mock para desenvolvimento, screenshot testing e onboarding de novos devs.

## Overview

O sistema de seed cria um dataset minimalista mas representativo em **dois backends**:

- **Supabase** (Postgres) — documentos, incidentes, planos de ação, comunicados, auditorias.
- **Firebase** (Auth + Firestore) — usuários (admin + staff), reuniões e atas (metadata).

Tudo é **idempotente** (`INSERT ... ON CONFLICT DO NOTHING` + `set({merge:true})`), então pode rodar várias vezes sem efeito colateral.

> **DEV-only.** Os UIDs (`seed-admin-001`, `seed-staff-001..003`), emails (`@seed.local`) e senha (`Seed@2026!`) são fictícios e **NÃO** devem ser usados em produção.

## Arquivos

| Arquivo | Função |
|---|---|
| `supabase/seed.sql` | INSERTs idempotentes em Supabase. |
| `scripts/seed-firebase.mjs` | Cria users Firebase Auth + Firestore (userProfiles, reunioes, reuniao_documentos). |
| `scripts/seed-all.mjs` | Orquestrador (Supabase + Firebase). |

## How to Run

### Prereqs

1. **`.env.local`** com:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_JWT_SECRET`
   - `VITE_SUPABASE_PROJECT_REF` (opcional, default `vjzrahruvjffyyqyhjny`)
2. **Service account JSON do Firebase Admin** (gerado em Firebase Console → Project Settings → Service Accounts):
   - Coloque em `~/.config/firebase-anest-admin.json` (qualquer caminho serve).
   - Exporte: `export GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase-anest-admin.json`

### Comandos

```bash
# Dry-run (mostra o que faria, não muda nada)
GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase-anest-admin.json \
  node scripts/seed-all.mjs

# Aplicar de verdade
GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase-anest-admin.json \
  node scripts/seed-all.mjs --apply

# Apenas Firebase (Auth + Firestore)
GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase-anest-admin.json \
  node scripts/seed-firebase.mjs --apply

# Apenas Supabase (cole o conteúdo no Dashboard → SQL Editor, ou via psql)
psql "postgresql://postgres.<REF>:<SENHA>@aws-0-us-west-2.pooler.supabase.com:5432/postgres" \
  -f supabase/seed.sql
```

> Se o `seed-all.mjs` falhar ao aplicar `seed.sql` via RPC (a maioria dos projetos Supabase não expõe um `exec_sql` por motivo de segurança), aplique manualmente via **Dashboard → SQL Editor** ou **psql** como mostrado acima. O subscript Firebase continua normalmente.

## What's Created

### Supabase (`supabase/seed.sql`)

| Tabela | Quantidade | IDs |
|---|---|---|
| `admin_users` | 1 | `seed-admin-001` |
| `documentos` | 10 | `doc-seed-001` … `doc-seed-010` |
| `incidentes` | 5 | UUIDs `11111111-1111-4111-8111-000000000001..005` (protocolos `INC-SEED-0001..0005`) |
| `planos_acao` | 4 | UUIDs `22222222-…-001..004` (3 vinculados a incidentes + 1 não-conformidade) |
| `comunicados` | 5 | `com-seed01..05` (Geral, Urgente, Importante, Evento, Informativo) |
| `auditoria_execucoes` | 2 | UUIDs `33333333-…-001..002` (1 concluída + 1 em andamento) |
| `documento_changelog` | 2 | Entradas de audit-trail mínimas |

**Total: ~29 linhas** distribuídas em 7 tabelas.

Status / categorias cobertos:
- **documentos**: `ativo`, `rascunho`, `arquivado`, `revisao_pendente`, `pendente` × categorias `etica`, `infeccoes`, `medicamentos`, `biblioteca`, `desastres`, `comites`.
- **incidentes**: `pendente`, `em_analise`, `em_andamento`, `resolvido`; categorias `medication`, `technical`, `communication`.
- **planos_acao**: `planejamento`, `execucao`, `concluido`.
- **comunicados**: `rascunho`, `aprovado`, `publicado`; todos os 5 `tipos`.

### Firebase (`scripts/seed-firebase.mjs`)

| Recurso | Quantidade | IDs |
|---|---|---|
| Firebase Auth users | 4 | `seed-admin-001` + `seed-staff-001..003` |
| `userProfiles/{uid}` | 4 | Mesmo conjunto |
| `reunioes/{id}` | 3 | `reuniao-seed-001..003` (agendada, em_andamento, concluída) |
| `reuniao_documentos/{id}` | 1 | `reuniao-doc-seed-001` (ata da reunião concluída) |

**Credenciais DEV (não-produção):**
- Email: `admin@seed.local` / `staff1@seed.local` / `staff2@seed.local` / `staff3@seed.local`
- Senha: `Seed@2026!` (idêntica para todos os usuários seed)

## Customization

Para adicionar mais dados:

1. **Supabase**: edite `supabase/seed.sql` e adicione linhas. Mantenha `ON CONFLICT (id) DO NOTHING` para idempotência.
2. **Firebase**: edite as constantes `SEED_USERS`, `SEED_REUNIOES`, `SEED_REUNIAO_DOCS` em `scripts/seed-firebase.mjs`.

> **Sempre use UIDs com prefixo `seed-`** para isolar do dataset real e facilitar o `--reset`.

## Reset Mode (DEV ONLY)

O flag `--reset` apaga TODOS os docs seed (Auth users + Firestore profiles + reunioes + reuniao_documentos) **antes** de criá-los. Útil para garantir um estado limpo entre testes.

### Guardrail

Para evitar acidentes em produção:

- `seed-firebase.mjs --reset` exige que o `project_id` esteja em `SEED_DEV_PROJECTS` (variável em `.env.local`).
- Sem isso, o script aborta com erro claro.

Exemplo (`.env.local`):

```bash
# Allowlist de projetos Firebase onde --reset é permitido
SEED_DEV_PROJECTS=anest-dev,anest-staging
```

> **NUNCA** adicione `anest-ap` (projeto de produção) a essa allowlist.

> **Supabase** não suporta `--reset` neste seed — para limpar o Supabase use o Dashboard manualmente (`DELETE FROM documentos WHERE id LIKE 'doc-seed-%';` etc.).

## Use Cases

### 1. Onboarding de novos devs

Um novo dev clona o repo, configura `.env.local` + service account JSON, roda `node scripts/seed-all.mjs --apply` e tem instantaneamente:
- 10 documentos com diferentes status para navegar pela Gestão Documental.
- 5 incidentes para ver o fluxo de Análise de Causa Raiz.
- 4 planos de ação em diferentes fases PDCA.
- 5 comunicados (Geral → Urgente → Evento) para o ComunicadosMonitor.
- 3 reuniões em estados distintos para o módulo Reuniões.
- 4 contas de usuário para testar permissões (admin vs colaborador).

### 2. Screenshot testing

Datasets determinísticos permitem screenshots reprodutíveis (Playwright/visual regression). IDs estáveis garantem que `goto('/documento/doc-seed-001')` sempre renderiza o mesmo conteúdo.

### 3. E2E tests

Os flags `--reset --apply` no início da suite garantem um estado limpo. Cenários como "novo dev cria primeiro incidente" podem assumir que existem 5 incidentes pré-existentes para testar listagens, filtros e busca.

## Conformidade

- **LGPD**: dados 100% fictícios (`@seed.local`). Nenhum dado pessoal real.
- **Audit trail**: `created_by` / `user_id` sempre apontam para um UID seed real (`seed-admin-001` etc.), **NUNCA** `'admin'` ou `'system'` — segue regra `.claude/rules/audit-trail.md`.
- **Qmentum**: categorias e pesos de score refletem a hierarquia real, então scores calculados em DEV são coerentes com produção.

## Troubleshooting

| Sintoma | Causa provável | Fix |
|---|---|---|
| `auth/uid-already-exists` | User já criado em rodada anterior | Esperado — script trata como skip idempotente. |
| `column "storage_provider" does not exist` | Migration de Sprint 21 Wave 1.1 ainda não aplicada | Aplique a migration `20260513150000_storage_migration_buckets.sql` primeiro. |
| RPC `exec_sql` retorna 404 | Projeto Supabase não expõe `exec_sql` (padrão) | Aplique `supabase/seed.sql` manualmente via Dashboard ou `psql`. |
| `INSERT ... violates check constraint documentos_categoria_check` | Migration `017` ou `024` não aplicada | Aplique todas as migrations primeiro (`supabase db push`). |
| Firebase service account JSON inválido | Arquivo corrompido ou sem permissões | Re-gere em Firebase Console → Project Settings → Service Accounts → Generate new private key. |

## Referências

- `.claude/rules/audit-trail.md` — convenção `changedBy` / `created_by`.
- `.claude/rules/supabase-firebase.md` — JWT HS256, pooler connection.
- `.claude/rules/secrets.md` — `Seed@2026!` é DEV-only, OK em docs.
- `scripts/migrate-storage-firebase-to-supabase.mjs` — padrão de JWT signing reaproveitado.

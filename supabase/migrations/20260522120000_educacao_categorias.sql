-- ==========================================================================
-- 20260522120000_educacao_categorias.sql
-- Sprint 1 Wave 1.7 T1.7.10 — CategoriasManager (Supabase-backed)
--
-- Objetivo: substituir o `mockCategorias` (hard-coded em educacaoUtils.js)
-- por tabela CRUD-able no Supabase, gerenciável via CategoriasManagerPage.
--
-- Notas arquiteturais:
--   - Cursos vivem em FIRESTORE (educacao_cursos/{cursoId}). Esta tabela
--     guarda APENAS o catálogo de categorias (slug + nome + cor + ordem).
--     A contagem "quantidade" é computada dinamicamente no client a partir
--     dos cursos Firestore (NÃO armazenada aqui — evita stale data).
--   - cor_token: valor semântico DS (`category-*` em tailwind.config.js).
--   - Audit trail via firebase_uid() (não 'system' literal).
-- ==========================================================================

-- ──────────────────────────────────────────────
-- 1. Tabela: educacao_categorias
-- ──────────────────────────────────────────────

create table if not exists public.educacao_categorias (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  nome        text not null,
  icone       text,
  cor_token   text check (cor_token in (
                'green', 'purple', 'blue', 'cyan', 'pink',
                'indigo', 'orange', 'teal', 'red'
              )),
  ordem       int not null default 0,
  ativa       boolean not null default true,
  created_by  text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  text
);

comment on table public.educacao_categorias is
  'Catálogo de categorias para cursos do módulo educação. Substitui mockCategorias hard-coded. T1.7.10.';

comment on column public.educacao_categorias.cor_token is
  'Token DS category-* (green|purple|blue|cyan|pink|indigo|orange|teal|red). Usado em tailwind classes bg-category-{token}-bg etc.';

comment on column public.educacao_categorias.ordem is
  'Ordem de exibição (asc). Permite reordenar sem alterar slug/id.';

-- ──────────────────────────────────────────────
-- 2. Índices
-- ──────────────────────────────────────────────

create index if not exists idx_educacao_categorias_ordem
  on public.educacao_categorias (ordem)
  where ativa = true;

create index if not exists idx_educacao_categorias_slug
  on public.educacao_categorias (slug);

-- ──────────────────────────────────────────────
-- 3. RLS
-- ──────────────────────────────────────────────

alter table public.educacao_categorias enable row level security;

-- SELECT: qualquer authenticated (categorias são lookup público para users)
drop policy if exists ec_select_authenticated on public.educacao_categorias;
create policy ec_select_authenticated on public.educacao_categorias
  for select
  to authenticated
  using (true);

-- INSERT/UPDATE/DELETE: apenas admin
drop policy if exists ec_insert_admin on public.educacao_categorias;
create policy ec_insert_admin on public.educacao_categorias
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists ec_update_admin on public.educacao_categorias;
create policy ec_update_admin on public.educacao_categorias
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists ec_delete_admin on public.educacao_categorias;
create policy ec_delete_admin on public.educacao_categorias
  for delete
  to authenticated
  using (public.is_admin());

-- ──────────────────────────────────────────────
-- 4. Trigger updated_at
-- ──────────────────────────────────────────────

create or replace function public.educacao_categorias_set_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tr_educacao_categorias_updated_at on public.educacao_categorias;
create trigger tr_educacao_categorias_updated_at
  before update on public.educacao_categorias
  for each row execute function public.educacao_categorias_set_updated_at();

-- ──────────────────────────────────────────────
-- 5. Seed (idempotente) — 6 categorias canônicas que vinham de mockCategorias
-- ──────────────────────────────────────────────

insert into public.educacao_categorias (slug, nome, cor_token, ordem, ativa, created_by) values
  ('sem-categoria',       'Sem categoria',           'green',  0, true, 'system-seed'),
  ('seguranca-paciente',  'Segurança do Paciente',   'red',    1, true, 'system-seed'),
  ('controle-infeccao',   'Controle de Infecção',    'cyan',   2, true, 'system-seed'),
  ('anestesiologia',      'Anestesiologia',          'blue',   3, true, 'system-seed'),
  ('qualidade',           'Qualidade',               'teal',   4, true, 'system-seed'),
  ('obrigatorio',         'Obrigatório',             'orange', 5, true, 'system-seed')
on conflict (slug) do nothing;

-- ──────────────────────────────────────────────
-- 6. Grant
-- ──────────────────────────────────────────────

grant select on public.educacao_categorias to authenticated;
grant insert, update, delete on public.educacao_categorias to authenticated;

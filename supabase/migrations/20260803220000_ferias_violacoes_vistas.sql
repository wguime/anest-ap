-- ════════════════════════════════════════════════════════════════════════
-- 20260803220000_ferias_violacoes_vistas.sql
-- Extrato de Férias — memória de violações de regra JÁ NOTIFICADAS.
--
-- O motor de regras roda no client quando alguém abre o extrato; violações
-- cujo id determinístico ainda não está aqui são "novas" → geram UMA
-- notificação agregada aos coordenadores (dedup 1/dia via índice único de
-- notifications) e são registradas nesta tabela para não re-notificar.
--
-- Conteúdo LGPD-ok: só ids determinísticos de violação (ex.
-- 'cota:joao-ricardo-moreira:2026') — dado operacional interno do grupo.
-- Sem UPDATE/DELETE: a tabela é append-only (auditável); repovoar um ano
-- exige migração deliberada.
--
-- Idempotente: create if not exists / or replace + drop policy if exists.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

create table if not exists public.ferias_violacoes_vistas (
  ano integer not null,
  violacao_id text not null,
  regra text not null,
  detected_by text not null,
  detected_at timestamptz not null default now(),
  primary key (ano, violacao_id)
);

comment on table public.ferias_violacoes_vistas is
  'Violações de regra de férias já notificadas ao coordenador (ids determinísticos do motor extratoFeriasRegras). Append-only; detected_by = firebase uid real de quem abriu o extrato quando a violação foi detectada.';

-- Mesmo público da página do extrato: anestesiologista OU admin
-- (decisão do dono 2026-08-03 — extrato é interno ao corpo de anestesiologistas)
create or replace function public.can_access_extrato_ferias()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = public.firebase_uid()
      and lower(coalesce(p.role, '')) = 'anestesiologista'
  ) or public.is_admin();
$$;

revoke execute on function public.can_access_extrato_ferias() from public, anon;
grant execute on function public.can_access_extrato_ferias() to authenticated, service_role;

comment on function public.can_access_extrato_ferias() is
  'true se o usuário corrente pode ver o Extrato de Férias (anestesiologista OU admin). Espelha o gate do front (src/pages/ferias/gate.js).';

alter table public.ferias_violacoes_vistas enable row level security;
alter table public.ferias_violacoes_vistas force row level security;

drop policy if exists ferias_violacoes_vistas_select on public.ferias_violacoes_vistas;
create policy ferias_violacoes_vistas_select
  on public.ferias_violacoes_vistas
  for select
  to authenticated
  using ((select public.can_access_extrato_ferias()));

-- INSERT amarra detected_by ao uid real (audit-trail: nunca 'system')
drop policy if exists ferias_violacoes_vistas_insert on public.ferias_violacoes_vistas;
create policy ferias_violacoes_vistas_insert
  on public.ferias_violacoes_vistas
  for insert
  to authenticated
  with check (
    (select public.can_access_extrato_ferias())
    and detected_by = public.firebase_uid()
  );

-- Sem policy de UPDATE/DELETE (append-only). Revoke ALL: default privileges
-- do Supabase concedem tudo a authenticated em tabela nova — o grant abaixo
-- restaura só o necessário.
revoke all on public.ferias_violacoes_vistas from authenticated;
revoke all on public.ferias_violacoes_vistas from anon;
grant select, insert on public.ferias_violacoes_vistas to authenticated;
grant all on public.ferias_violacoes_vistas to service_role;

COMMIT;

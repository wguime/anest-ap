-- ════════════════════════════════════════════════════════════════════════
-- 20260804100000_ferias_marcacoes_vistas.sql
-- Extrato de Férias — memória de QUANDO cada marcação foi vista pela 1ª vez.
--
-- A API do Pega Plantão não expõe o timestamp da marcação; para aplicar a
-- regra da 7ª vaga ("quem marcou por último paga 3 dias") o app registra o
-- first-seen de cada CodigoPlantao de férias sempre que alguém abre o
-- extrato. Dias com 7+ marcações mostram o último a aparecer — marcações
-- anteriores ao início do acompanhamento (baseline) são declaradas como
-- ordem desconhecida (mesmo lote de first_seen).
--
-- Append-only; mesmo público do extrato (allowlist can_access_extrato_ferias,
-- migration 20260803233000). Conteúdo: nome de médico + data (operacional).
--
-- Idempotente: create if not exists / drop policy if exists.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

create table if not exists public.ferias_marcacoes_vistas (
  codigo text primary key,
  ano integer not null,
  nome text not null,
  data date not null,
  seen_by text not null,
  first_seen_at timestamptz not null default now()
);

comment on table public.ferias_marcacoes_vistas is
  'First-seen de cada marcação de férias do Pega Plantão (CodigoPlantao). Proxy da ordem de marcação p/ a regra da 7ª vaga; baseline (1ª varredura) tem ordem desconhecida. Append-only; seen_by = firebase uid real.';

create index if not exists idx_ferias_marcacoes_vistas_ano_data
  on public.ferias_marcacoes_vistas (ano, data);

alter table public.ferias_marcacoes_vistas enable row level security;
alter table public.ferias_marcacoes_vistas force row level security;

drop policy if exists ferias_marcacoes_vistas_select on public.ferias_marcacoes_vistas;
create policy ferias_marcacoes_vistas_select
  on public.ferias_marcacoes_vistas
  for select
  to authenticated
  using ((select public.can_access_extrato_ferias()));

drop policy if exists ferias_marcacoes_vistas_insert on public.ferias_marcacoes_vistas;
create policy ferias_marcacoes_vistas_insert
  on public.ferias_marcacoes_vistas
  for insert
  to authenticated
  with check (
    (select public.can_access_extrato_ferias())
    and seen_by = public.firebase_uid()
  );

-- Append-only (sem UPDATE/DELETE); revoke ALL antes do grant mínimo
revoke all on public.ferias_marcacoes_vistas from authenticated;
revoke all on public.ferias_marcacoes_vistas from anon;
grant select, insert on public.ferias_marcacoes_vistas to authenticated;
grant all on public.ferias_marcacoes_vistas to service_role;

COMMIT;

-- ==========================================================================
-- 20260504_never_events.sql — Never Events / Sentinel Events flag
-- Task B9: adiciona suporte a classificacao Never Event em incidentes
-- Frameworks: NQF SRE 2025 + NHS Never Events 2018 + JCAHO Sentinel Events
-- Documentacao: docs/never-events-design-2026-05-04.md
-- ==========================================================================

-- ──────────────────────────────────────────────
-- 1. Colunas
-- ──────────────────────────────────────────────

alter table public.incidentes
  add column if not exists is_never_event boolean not null default false,
  add column if not exists never_event_code text;

comment on column public.incidentes.is_never_event is
  'Flag indicando que o caso e um Never Event / Sentinel Event. Quando true, requer RCA obrigatoria, prazo 45d (JCAHO), notificacao imediata ao Comite de Seguranca.';

comment on column public.incidentes.never_event_code is
  'Codigo da lista canonica ANEST (ver src/data/incidentesConfig.js NEVER_EVENTS). Formato: NE-XXX-NN. Espelha NQF SRE numbering quando aplicavel.';

-- ──────────────────────────────────────────────
-- 2. Constraint de consistencia
-- ──────────────────────────────────────────────

alter table public.incidentes
  add constraint chk_never_event_code_when_flagged
  check (
    (is_never_event = false and never_event_code is null)
    or
    (is_never_event = true and never_event_code is not null and length(never_event_code) > 0)
  );

-- Constraint de formato do codigo (NE-XXX-NN)
alter table public.incidentes
  add constraint chk_never_event_code_format
  check (
    never_event_code is null
    or never_event_code ~ '^NE-[A-Z]{3}-[0-9]{2}$'
  );

-- ──────────────────────────────────────────────
-- 3. Indices parciais para filtro "Apenas Never Events"
-- ──────────────────────────────────────────────

create index if not exists idx_incidentes_never_event
  on public.incidentes (created_at desc)
  where is_never_event = true;

create index if not exists idx_incidentes_never_event_code
  on public.incidentes (never_event_code)
  where is_never_event = true;

-- ──────────────────────────────────────────────
-- 4. RLS: nenhuma mudanca necessaria
-- Politicas existentes (inc_select_admin, inc_select_own, inc_select_anon_tracking)
-- ja cobrem as colunas novas. Anonimizacao via rpc_anonimizar_incidente
-- preserva is_never_event e never_event_code (LGPD: classificacao tecnica
-- NAO e dado pessoal — ela permanece para fins estatisticos/auditoria).
-- ──────────────────────────────────────────────

-- ──────────────────────────────────────────────
-- 5. Audit log via trigger
-- Registra mudancas em is_never_event para rastreabilidade ONA/Qmentum
-- ──────────────────────────────────────────────

create or replace function log_never_event_change()
returns trigger as $$
begin
  if (tg_op = 'UPDATE' and old.is_never_event is distinct from new.is_never_event) then
    raise notice 'never_event_change: incidente=% old=% new=% code=% at=%',
      new.id, old.is_never_event, new.is_never_event, new.never_event_code, now();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists tr_incidentes_never_event_audit on public.incidentes;
create trigger tr_incidentes_never_event_audit
  after update on public.incidentes
  for each row
  execute function log_never_event_change();

-- ──────────────────────────────────────────────
-- 6. Backfill: detectar Never Events em incidentes existentes
-- Heuristica conservadora — apenas casos COM CERTEZA. Comite revisa o resto.
-- ──────────────────────────────────────────────

-- Cirurgia em local errado / paciente errado / corpo retido
update public.incidentes
set
  is_never_event = true,
  never_event_code = case incidente_data->>'subtipo'
    when 'local_errado' then 'NE-SUR-01'
    when 'paciente_errado_cir' then 'NE-SUR-02'
    when 'procedimento_errado' then 'NE-SUR-03'
    when 'corpo_estranho' then 'NE-SUR-04'
    when 'lateralidade' then 'NE-SUR-01'
  end
where
  is_never_event = false
  and incidente_data->>'tipo' = 'cirurgia'
  and incidente_data->>'subtipo' in ('local_errado', 'paciente_errado_cir', 'procedimento_errado', 'corpo_estranho', 'lateralidade')
  and impacto->>'danoAoPaciente' in ('moderado', 'grave', 'obito');

-- Alergia nao verificada com dano
update public.incidentes
set
  is_never_event = true,
  never_event_code = 'NE-MED-02'
where
  is_never_event = false
  and incidente_data->>'tipo' = 'medicacao'
  and incidente_data->>'subtipo' = 'alergia_nao_verificada'
  and impacto->>'danoAoPaciente' in ('grave', 'obito');

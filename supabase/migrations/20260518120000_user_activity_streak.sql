-- ==========================================================================
-- 20260518120000_user_activity_streak.sql
-- Sprint 1 Wave 1.1 T1.1.2-T1.1.4 — Streak server-authoritative (UTC)
--
-- Objetivo: fix do "streak fantasma" — gamificação sempre zerada porque
--   - registrarAtividadeDiaria só era chamada em PontosPage (não em aula/quiz)
--   - cálculo client-side com timezone local (vulnerável a relógio errado)
--   - badge streak_7 em educacaoService.js:717 era hardcoded unlocked=false
--
-- Design:
--   - Tabela user_activity_day registra dia por user (chave composta idempotente)
--   - Funções SECURITY INVOKER usam public.firebase_uid() (JWT custom HS256 ANEST)
--   - Datas sempre em UTC (now() AT TIME ZONE 'UTC')::date
--   - ON CONFLICT DO NOTHING garante idempotência total (mesma chamada N vezes/dia = 1 row)
--   - Plan: ver docs/planejamento-melhorias-2026-05-16.md (Wave 1.1 T1.1.2-T1.1.4)
--
-- Trade-off UTC: streak rola à 00:00 UTC (21:00 BRT no inverno, 22:00 BRT no verão).
-- User brasileiro que faz aula 23:30 BRT já registra o "dia seguinte" UTC. Aceito:
--   (a) consistência cross-timezone (médico em viagem mantém streak);
--   (b) impl simples sem table de tz per-user. Documentar em help educação.
-- ==========================================================================

-- ──────────────────────────────────────────────
-- 1. Tabela: user_activity_day
-- ──────────────────────────────────────────────

create table if not exists public.user_activity_day (
  user_id    text not null,
  date_utc   date not null,
  source     text not null default 'unknown'
    check (source in ('aula','quiz','desafio_rop','pontos_page','backfill','unknown')),
  created_at timestamptz not null default now(),
  primary key (user_id, date_utc)
);

comment on table public.user_activity_day is
  'Registra dias UTC em que cada user teve atividade educacional. Fonte única de verdade para streak server-authoritative. Sprint 1 Wave 1.1.';

create index if not exists idx_user_activity_day_user_date
  on public.user_activity_day (user_id, date_utc desc);

-- ──────────────────────────────────────────────
-- 2. RLS
-- ──────────────────────────────────────────────

alter table public.user_activity_day enable row level security;

-- SELECT: user vê próprios dias; admin vê todos
drop policy if exists uad_select_own on public.user_activity_day;
create policy uad_select_own on public.user_activity_day
  for select
  to authenticated
  using (user_id = public.firebase_uid() or public.is_admin());

-- INSERT: user insere apenas próprios dias (funções abaixo usam firebase_uid internamente)
drop policy if exists uad_insert_own on public.user_activity_day;
create policy uad_insert_own on public.user_activity_day
  for insert
  to authenticated
  with check (user_id = public.firebase_uid());

-- UPDATE: bloqueado (registro é append-only)
-- DELETE: só admin (limpeza retenção LGPD futura)
drop policy if exists uad_delete_admin on public.user_activity_day;
create policy uad_delete_admin on public.user_activity_day
  for delete
  to authenticated
  using (public.is_admin());

-- ──────────────────────────────────────────────
-- 3. Função: record_user_activity_day
-- ──────────────────────────────────────────────
-- Idempotente: chamar N vezes no mesmo dia = 1 row.
-- Retorna jsonb com {recorded_today: bool, streak: int, longest_streak: int, today_utc: date}
-- ──────────────────────────────────────────────

create or replace function public.record_user_activity_day(p_source text default 'unknown')
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_user_id text;
  v_today_utc date := (now() at time zone 'UTC')::date;
  v_rowcount bigint;
  v_was_recorded boolean;
  v_streak int;
  v_longest int;
  v_valid_sources text[] := array['aula','quiz','desafio_rop','pontos_page','backfill','unknown'];
begin
  v_user_id := public.firebase_uid();
  if v_user_id is null then
    raise exception 'record_user_activity_day: user not authenticated';
  end if;

  -- Validar source: fallback silencioso para 'unknown' se inválido (evita CHECK constraint stourar)
  if p_source is null or p_source = '' or not (p_source = any(v_valid_sources)) then
    p_source := 'unknown';
  end if;

  -- Insert idempotente
  insert into public.user_activity_day (user_id, date_utc, source)
  values (v_user_id, v_today_utc, p_source)
  on conflict (user_id, date_utc) do nothing;

  -- Detecta se inseriu hoje (rowcount > 0). ROW_COUNT retorna bigint.
  get diagnostics v_rowcount = row_count;
  v_was_recorded := v_rowcount > 0;

  -- Calcula streak atual e melhor histórico
  v_streak := public.get_user_streak(v_user_id);
  v_longest := public.get_user_longest_streak(v_user_id);

  return jsonb_build_object(
    'recorded_today', v_was_recorded,
    'streak', v_streak,
    'longest_streak', v_longest,
    'today_utc', v_today_utc,
    'source', p_source
  );
end;
$$;

comment on function public.record_user_activity_day(text) is
  'Registra atividade do usuário hoje (UTC). Idempotente. Retorna jsonb com streak atual e melhor histórico. T1.1.2.';

-- ──────────────────────────────────────────────
-- 4. Função: get_user_streak (consecutivos até hoje UTC)
-- ──────────────────────────────────────────────

create or replace function public.get_user_streak(p_user_id text default null)
returns int
language plpgsql
security invoker
stable
as $$
declare
  v_user_id text;
  v_streak int := 0;
  v_today_utc date := (now() at time zone 'UTC')::date;
  v_check_date date;
begin
  v_user_id := coalesce(p_user_id, public.firebase_uid());
  if v_user_id is null then
    return 0;
  end if;

  -- Permite query de outro user só se admin
  if v_user_id <> public.firebase_uid() and not public.is_admin() then
    return 0;
  end if;

  -- Conta dias consecutivos retrocedendo de hoje (ou ontem se hoje não registrado)
  v_check_date := v_today_utc;

  -- Se hoje não tem registro, começa de ontem (streak não quebra mid-day)
  if not exists (select 1 from public.user_activity_day where user_id = v_user_id and date_utc = v_today_utc) then
    v_check_date := v_today_utc - interval '1 day';
  end if;

  loop
    if exists (select 1 from public.user_activity_day where user_id = v_user_id and date_utc = v_check_date) then
      v_streak := v_streak + 1;
      v_check_date := v_check_date - interval '1 day';
    else
      exit;
    end if;
  end loop;

  return v_streak;
end;
$$;

comment on function public.get_user_streak(text) is
  'Calcula streak (dias consecutivos com atividade) do user até hoje UTC. Tolerante a gap de hoje (não quebra mid-day). T1.1.2.';

-- ──────────────────────────────────────────────
-- 5. Função: get_user_longest_streak (melhor sequência histórica)
-- ──────────────────────────────────────────────

create or replace function public.get_user_longest_streak(p_user_id text default null)
returns int
language plpgsql
security invoker
stable
as $$
declare
  v_user_id text;
  v_longest int;
begin
  v_user_id := coalesce(p_user_id, public.firebase_uid());
  if v_user_id is null then
    return 0;
  end if;

  if v_user_id <> public.firebase_uid() and not public.is_admin() then
    return 0;
  end if;

  -- Window function: numera dias e calcula grupo = date - row_number
  -- Datas consecutivas geram mesmo grupo. Count por grupo dá streaks.
  with grouped as (
    select
      date_utc,
      date_utc - (row_number() over (order by date_utc))::int * interval '1 day' as grp
    from public.user_activity_day
    where user_id = v_user_id
  ),
  streaks as (
    select count(*) as len
    from grouped
    group by grp
  )
  select coalesce(max(len), 0) into v_longest from streaks;

  return v_longest;
end;
$$;

comment on function public.get_user_longest_streak(text) is
  'Calcula melhor sequência histórica de dias consecutivos. T1.1.2.';

-- ──────────────────────────────────────────────
-- 6. Grants
-- ──────────────────────────────────────────────

grant select on public.user_activity_day to authenticated;
grant execute on function public.record_user_activity_day(text) to authenticated;
grant execute on function public.get_user_streak(text) to authenticated;
grant execute on function public.get_user_longest_streak(text) to authenticated;

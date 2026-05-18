-- ==========================================================================
-- 20260518130000_streak_with_freeze.sql
-- Wave 1.5 T1.5.20 — Streak freeze 1/semana (anti-coerção)
--
-- Objetivo: aluno que perde 1 dia numa semana ISO não quebra streak.
-- Regra: até 1 dia "freezado" por semana ISO durante o cálculo do streak atual.
--
-- Sem tabela nova — derivado puramente da ausência de atividade naquela data.
-- Idempotente via create or replace.
-- ==========================================================================

create or replace function public.get_user_streak_with_freeze(p_user_id text default null)
returns table(streak int, freeze_used boolean, freeze_last_date date)
language plpgsql
security invoker
stable
as $$
declare
  v_user_id text;
  v_streak int := 0;
  v_today_utc date := (now() at time zone 'UTC')::date;
  v_check_date date;
  v_freeze_weeks int[] := '{}';
  v_check_week int;
  v_check_year int;
  v_week_key int;
  v_freeze_last date := null;
begin
  v_user_id := coalesce(p_user_id, public.firebase_uid());
  if v_user_id is null then
    return query select 0, false, null::date;
    return;
  end if;

  -- Permite query de outro user só se admin
  if v_user_id <> public.firebase_uid() and not public.is_admin() then
    return query select 0, false, null::date;
    return;
  end if;

  v_check_date := v_today_utc;

  -- Tolerância "hoje" não registrado (mid-day, igual get_user_streak)
  if not exists (
    select 1 from public.user_activity_day
    where user_id = v_user_id and date_utc = v_today_utc
  ) then
    v_check_date := v_today_utc - interval '1 day';
  end if;

  loop
    if exists (
      select 1 from public.user_activity_day
      where user_id = v_user_id and date_utc = v_check_date
    ) then
      v_streak := v_streak + 1;
      v_check_date := v_check_date - interval '1 day';
    else
      -- Gap detectado. Verifica se há freeze disponível nesta semana ISO.
      v_check_year := extract(isoyear from v_check_date)::int;
      v_check_week := extract(isoweek from v_check_date)::int;
      -- Combina year+week num único int (year*100 + week) para chave única.
      v_week_key := v_check_year * 100 + v_check_week;

      if not (v_week_key = any(v_freeze_weeks)) then
        -- Aplica freeze: marca a semana e pula UM dia
        v_freeze_weeks := array_append(v_freeze_weeks, v_week_key);
        if v_freeze_last is null then
          v_freeze_last := v_check_date;
        end if;
        v_check_date := v_check_date - interval '1 day';
      else
        -- Já usou freeze nesta semana ISO — streak quebra aqui
        exit;
      end if;
    end if;

    -- Guard-rail: nunca passar de 730 dias (2 anos) — defensivo
    if v_streak >= 730 then
      exit;
    end if;
  end loop;

  return query select v_streak, (v_freeze_last is not null), v_freeze_last;
end;
$$;

comment on function public.get_user_streak_with_freeze(text) is
  'Calcula streak com 1 freeze por semana ISO (até 1 dia perdido/semana não quebra). Wave 1.5 T1.5.20.';

grant execute on function public.get_user_streak_with_freeze(text) to authenticated;

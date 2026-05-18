-- ==========================================================================
-- 20260609130000_rops_hardening.sql
-- Sprint 1 Wave 1.6 — Hardening pós-auditoria (LGPD HIGH + Security MED + Qmentum HIGH)
--
-- Aplicar APÓS 20260609120000_rops_schema.sql. Idempotente.
--
-- Mudanças:
--   1. profiles.ranking_opt_in boolean (LGPD T1.6.12 explícito)
--      → user só aparece em get_rops_ranking se ranking_opt_in = true
--   2. rop_changelog SELECT restrita (security MED): só admin ou dono
--   3. rop_user_attempts: policies explícitas UPDATE/DELETE bloqueadas
--      (Qmentum: garante append-only real, não apenas convenção)
--   4. get_rops_ranking: mascara roles privilegiadas (LGPD MED)
--      + filtra por profiles.ranking_opt_in = true
-- ==========================================================================

-- 1. Coluna opt-in LGPD em profiles (idempotente)
alter table if exists public.profiles
  add column if not exists ranking_opt_in boolean not null default false;

comment on column public.profiles.ranking_opt_in is
  'LGPD T1.6.12: user consentiu aparecer no ranking público de ROPs. Default false (anti-pattern leaderboard forçado).';

-- 2. rop_changelog SELECT restrita
drop policy if exists rop_cl_select on public.rop_changelog;
create policy rop_cl_select
  on public.rop_changelog for select to authenticated
  using (user_id = public.firebase_uid() or public.is_admin());

-- 3. rop_user_attempts: bloqueia UPDATE e DELETE (append-only real)
drop policy if exists rop_att_no_update on public.rop_user_attempts;
create policy rop_att_no_update
  on public.rop_user_attempts for update to authenticated
  using (false) with check (false);

drop policy if exists rop_att_no_delete on public.rop_user_attempts;
create policy rop_att_no_delete
  on public.rop_user_attempts for delete to authenticated
  using (public.is_admin());  -- só admin pode purge (retenção LGPD futura)

-- 4. get_rops_ranking: mascara roles privilegiadas + filtra por opt-in
drop function if exists public.get_rops_ranking(text);
create or replace function public.get_rops_ranking(p_period text default 'all')
returns table (
  id          text,
  name        text,
  subtitle    text,
  score       numeric,
  quiz_count  bigint,
  rank        bigint
)
language sql
security invoker
stable
as $$
  with windowed as (
    select
      a.user_id,
      a.is_correct,
      a.created_at
    from public.rop_user_attempts a
    where case p_period
      when 'week'  then a.created_at >= now() - interval '7 days'
      when 'month' then a.created_at >= now() - interval '30 days'
      else true
    end
  ),
  agg as (
    select
      w.user_id,
      count(*) filter (where w.is_correct) as correct_count,
      count(*) as total_count
    from windowed w
    group by w.user_id
  )
  select
    a.user_id::text                                                 as id,
    coalesce(p.nome, 'Anestesiologista')                            as name,
    case
      -- mascara roles privilegiadas (anti-enumeração de admins)
      when p.is_admin = true then 'colaborador'
      else coalesce(p.role, 'colaborador')
    end                                                             as subtitle,
    a.correct_count::numeric                                        as score,
    a.total_count                                                   as quiz_count,
    rank() over (order by a.correct_count desc, a.total_count desc) as rank
  from agg a
  join public.profiles p
    on p.id = a.user_id
   and coalesce(p.ranking_opt_in, false) = true  -- LGPD: só users opt-in aparecem
  order by rank asc, score desc
  limit 50;
$$;

comment on function public.get_rops_ranking(text) is
  'Ranking ROPs por período. Filtra apenas users com profiles.ranking_opt_in=true (LGPD). Mascara roles privilegiadas (anti-enumeração admins). Wave 1.6 hardening.';

grant execute on function public.get_rops_ranking(text) to authenticated;

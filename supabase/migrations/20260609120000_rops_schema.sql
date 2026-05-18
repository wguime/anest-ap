-- ==========================================================================
-- 20260609120000_rops_schema.sql
-- Sprint 1 Wave 1.6 T1.6.1 — Schema ROPs no Supabase
--
-- Objetivo:
--   - Migrar 6 áreas × 32 subdivisões × 640 questões de src/data/rops-data.js
--     (7295 LOC mock) para Supabase.
--   - Implementar "Desafio do dia" (5-10 questões aleatórias por user/dia).
--   - Audit trail completo (rop_changelog) seguindo padrão
--     supabaseDocumentService.js → rpc_log_document_action.
--   - Question versioning próprio (separado de qualquer question_bank futuro)
--     porque ROPs são engessadas pelo Qmentum — alterações geram nova versão
--     + snapshot em rop_user_attempts.
--
-- Tabelas (5 + 1 changelog):
--   rop_areas              — 6 macro-áreas (Cultura, Comunicação, ...)
--   rop_subdivisoes        — 32 ROPs (ROP 1.1, 1.2, 2.1, ...)
--   rop_questions          — 640 questões (versionadas via version_num + is_current)
--   rop_user_attempts      — 1 row por tentativa do user (snapshot da versão)
--   rop_daily_challenges   — desafio diário (1 row por user×dia, idempotente)
--   rop_changelog          — audit append-only (igual documento_changelog)
--
-- RLS:
--   - SELECT em areas/subdivisoes/questions: todo authenticated (catálogo aberto)
--   - INSERT/UPDATE/DELETE em areas/subdivisoes/questions: só is_admin()
--   - SELECT/INSERT em rop_user_attempts: só user dono (firebase_uid())
--   - SELECT/INSERT/UPDATE em rop_daily_challenges: só user dono
--   - SELECT em rop_changelog: todo authenticated; INSERT: user_id = firebase_uid()
--
-- RPCs:
--   get_or_create_daily_challenge(p_date_utc date default current_date) returns jsonb
--   submit_daily_challenge_answer(p_challenge_id uuid, p_question_id uuid,
--                                  p_selected int, p_time_sec int) returns jsonb
--   get_rops_ranking(p_period text default 'all') returns table(...)
--   rpc_log_rop_action(p_action text, p_target_id uuid, p_target_kind text, p_payload jsonb)
--
-- Plan: docs/planejamento-melhorias-2026-05-16.md Wave 1.6 (linhas 282-339)
-- Pre-flight: questão_bank/_versions de Wave 1.3 NÃO existem (zero matches).
-- Streak share: chama record_user_activity_day('desafio_rop') já existente
--   (migration 20260518120000_user_activity_streak.sql:77).
-- ==========================================================================

-- Extensão necessária para gen_random_uuid()
create extension if not exists pgcrypto;

-- ==========================================================================
-- 1. rop_areas — 6 macro-áreas
-- ==========================================================================

create table if not exists public.rop_areas (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  title           text not null,
  description     text,
  category_token  text not null
    check (category_token in (
      'category-purple','category-blue','category-cyan','category-pink',
      'category-indigo','category-orange','category-teal','category-green','category-red'
    )),
  icon            text,
  display_order   int  not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.rop_areas is
  'Macro-áreas ROP Qmentum (6 áreas: Cultura, Comunicação, Uso de Medicamentos, Vida Profissional, Prevenção de Infecções, Avaliação de Risco). Wave 1.6 T1.6.1.';
comment on column public.rop_areas.category_token is
  'Token DS para visual (substitui hex hardcoded em MACRO_AREAS:17-60). Validado contra paleta semântica.';

create index if not exists idx_rop_areas_slug on public.rop_areas (slug);
create index if not exists idx_rop_areas_order on public.rop_areas (display_order);

-- ==========================================================================
-- 2. rop_subdivisoes — ~32 ROPs (cada área tem 4-9 subdivisões)
-- ==========================================================================

create table if not exists public.rop_subdivisoes (
  id              uuid primary key default gen_random_uuid(),
  area_id         uuid not null references public.rop_areas(id) on delete cascade,
  slug            text not null,
  title           text not null,
  description     text,
  audio_url       text,
  display_order   int  not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (area_id, slug)
);

comment on table public.rop_subdivisoes is
  'Subdivisões de cada área ROP (ex: ROP 1.1, ROP 2.3). Slug único por área. Wave 1.6 T1.6.1.';

create index if not exists idx_rop_sub_area on public.rop_subdivisoes (area_id, display_order);
create index if not exists idx_rop_sub_slug on public.rop_subdivisoes (slug);

-- ==========================================================================
-- 3. rop_questions — 640 questões versionadas
--    Estratégia: append-only por versão. Atualizar = INSERT nova row com
--    version_num + 1 e UPDATE is_current=false nas versões antigas.
--    rop_user_attempts faz snapshot do question_id (uuid da versão usada).
-- ==========================================================================

create table if not exists public.rop_questions (
  id                    uuid primary key default gen_random_uuid(),
  subdivisao_id         uuid not null references public.rop_subdivisoes(id) on delete cascade,
  question_key          text not null,
  version_num           int  not null default 1,
  is_current            boolean not null default true,
  question_text         text not null,
  options               jsonb not null,
  correct_answer_index  int  not null,
  explanation           text,
  difficulty            text default 'medium'
    check (difficulty in ('easy','medium','hard')),
  source_citation       text,
  created_at            timestamptz not null default now(),
  created_by            text,
  unique (subdivisao_id, question_key, version_num)
);

comment on table public.rop_questions is
  'Questões ROP versionadas. Padrão append-only: edit gera nova versão + UPDATE is_current. rop_user_attempts referencia question_id (snapshot da versão usada na tentativa). Wave 1.6 T1.6.1+T1.6.6.';
comment on column public.rop_questions.options is
  'Array JSON de 4 strings: ["opção A","opção B","opção C","opção D"].';
comment on column public.rop_questions.correct_answer_index is
  'Index 0-3 da resposta correta no array options.';

create index if not exists idx_rop_q_sub_current on public.rop_questions (subdivisao_id, is_current);
create index if not exists idx_rop_q_key on public.rop_questions (question_key);

-- Garante apenas 1 versão "current" por (subdivisao_id, question_key)
create unique index if not exists uniq_rop_q_current
  on public.rop_questions (subdivisao_id, question_key)
  where is_current = true;

-- ==========================================================================
-- 4. rop_user_attempts — append-only, snapshot do question_id
-- ==========================================================================

create table if not exists public.rop_user_attempts (
  id                    uuid primary key default gen_random_uuid(),
  user_id               text not null,
  question_id           uuid not null references public.rop_questions(id),
  selected_option       int  not null,
  is_correct            boolean not null,
  time_seconds          int,
  context               text default 'quiz'
    check (context in ('quiz','desafio_diario','review')),
  challenge_id          uuid,
  created_at            timestamptz not null default now()
);

comment on table public.rop_user_attempts is
  'Append-only log de tentativas. question_id é snapshot da versão respondida (ROPs versionadas). challenge_id preenchido se contexto=desafio_diario. Wave 1.6 T1.6.1.';

create index if not exists idx_rop_attempts_user on public.rop_user_attempts (user_id, created_at desc);
create index if not exists idx_rop_attempts_question on public.rop_user_attempts (question_id);
create index if not exists idx_rop_attempts_challenge on public.rop_user_attempts (challenge_id);

-- Anti-duplicate atômico: garante 1 resposta por (user, challenge, question)
-- mesmo sob race-condition. Auditoria recomendou este index.
create unique index if not exists uniq_rop_attempt_per_challenge_q
  on public.rop_user_attempts (user_id, challenge_id, question_id)
  where challenge_id is not null;

-- ==========================================================================
-- 5. rop_daily_challenges — idempotente por (user, date_utc)
-- ==========================================================================

create table if not exists public.rop_daily_challenges (
  id              uuid primary key default gen_random_uuid(),
  user_id         text not null,
  date_utc        date not null,
  question_ids    uuid[] not null,
  started_at      timestamptz not null default now(),
  completed_at    timestamptz,
  score_correct   int default 0,
  score_total     int not null,
  score_pct       numeric(5,2),
  unique (user_id, date_utc)
);

comment on table public.rop_daily_challenges is
  'Desafio do dia: 5-10 questões aleatórias estratificadas por área. Idempotente: mesmo (user,date) retorna mesma row. Wave 1.6 T1.6.10.';

create index if not exists idx_rop_daily_user on public.rop_daily_challenges (user_id, date_utc desc);

-- ==========================================================================
-- 6. rop_changelog — audit append-only (padrão documento_changelog)
-- ==========================================================================

create table if not exists public.rop_changelog (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null,
  user_name     text,
  user_email    text,
  action        text not null,
  target_kind   text not null
    check (target_kind in ('area','subdivisao','question','attempt','daily_challenge')),
  target_id     uuid,
  payload       jsonb,
  created_at    timestamptz not null default now()
);

comment on table public.rop_changelog is
  'Audit append-only para mutations ROP. user_id = firebase_uid() (NUNCA system/admin). Wave 1.6 T1.6.14.';

create index if not exists idx_rop_changelog_user on public.rop_changelog (user_id, created_at desc);
create index if not exists idx_rop_changelog_target on public.rop_changelog (target_kind, target_id);

-- ==========================================================================
-- 7. RLS
-- ==========================================================================

alter table public.rop_areas             enable row level security;
alter table public.rop_subdivisoes       enable row level security;
alter table public.rop_questions         enable row level security;
alter table public.rop_user_attempts     enable row level security;
alter table public.rop_daily_challenges  enable row level security;
alter table public.rop_changelog         enable row level security;

-- ── rop_areas / subdivisoes / questions: leitura aberta, escrita admin
drop policy if exists rop_areas_select        on public.rop_areas;
drop policy if exists rop_areas_admin_write   on public.rop_areas;
create policy rop_areas_select
  on public.rop_areas for select to authenticated using (true);
create policy rop_areas_admin_write
  on public.rop_areas for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists rop_sub_select          on public.rop_subdivisoes;
drop policy if exists rop_sub_admin_write     on public.rop_subdivisoes;
create policy rop_sub_select
  on public.rop_subdivisoes for select to authenticated using (true);
create policy rop_sub_admin_write
  on public.rop_subdivisoes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists rop_q_select            on public.rop_questions;
drop policy if exists rop_q_admin_write       on public.rop_questions;
create policy rop_q_select
  on public.rop_questions for select to authenticated using (true);
create policy rop_q_admin_write
  on public.rop_questions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── rop_user_attempts: user vê e escreve só os próprios; admin vê todos
drop policy if exists rop_att_select_own      on public.rop_user_attempts;
drop policy if exists rop_att_insert_own      on public.rop_user_attempts;
create policy rop_att_select_own
  on public.rop_user_attempts for select to authenticated
  using (user_id = public.firebase_uid() or public.is_admin());
create policy rop_att_insert_own
  on public.rop_user_attempts for insert to authenticated
  with check (user_id = public.firebase_uid());

-- ── rop_daily_challenges: idem
drop policy if exists rop_dc_select_own       on public.rop_daily_challenges;
drop policy if exists rop_dc_insert_own       on public.rop_daily_challenges;
drop policy if exists rop_dc_update_own       on public.rop_daily_challenges;
create policy rop_dc_select_own
  on public.rop_daily_challenges for select to authenticated
  using (user_id = public.firebase_uid() or public.is_admin());
create policy rop_dc_insert_own
  on public.rop_daily_challenges for insert to authenticated
  with check (user_id = public.firebase_uid());
create policy rop_dc_update_own
  on public.rop_daily_challenges for update to authenticated
  using (user_id = public.firebase_uid())
  with check (user_id = public.firebase_uid());

-- ── rop_changelog: leitura aberta (relatórios), INSERT só do próprio user
drop policy if exists rop_cl_select           on public.rop_changelog;
drop policy if exists rop_cl_insert_own       on public.rop_changelog;
create policy rop_cl_select
  on public.rop_changelog for select to authenticated using (true);
create policy rop_cl_insert_own
  on public.rop_changelog for insert to authenticated
  with check (user_id = public.firebase_uid());

-- ==========================================================================
-- 8. RPCs
-- ==========================================================================

-- ── 8.1 rpc_log_rop_action — append em rop_changelog
create or replace function public.rpc_log_rop_action(
  p_action      text,
  p_target_kind text,
  p_target_id   uuid,
  p_payload     jsonb default '{}'::jsonb,
  p_user_name   text default null,
  p_user_email  text default null
) returns uuid
language plpgsql
security invoker
as $$
declare
  v_user_id text;
  v_id uuid;
begin
  v_user_id := public.firebase_uid();
  if v_user_id is null then
    raise exception 'rpc_log_rop_action: user not authenticated';
  end if;

  insert into public.rop_changelog (user_id, user_name, user_email, action, target_kind, target_id, payload)
  values (v_user_id, p_user_name, p_user_email, p_action, p_target_kind, p_target_id, coalesce(p_payload, '{}'::jsonb))
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.rpc_log_rop_action(text,text,uuid,jsonb,text,text) is
  'Append-only log de ações ROP. NUNCA permite user_id falso (sempre firebase_uid()). Wave 1.6 T1.6.14.';

-- ── 8.2 get_or_create_daily_challenge — idempotente por (user, date)
--      Estratégia: ORDER BY random() LIMIT N. Com ~640 questões e índice
--      simples, custo <5ms. TABLESAMPLE BERNOULLI seria para dataset >1M rows.
create or replace function public.get_or_create_daily_challenge(
  p_date_utc date default null,
  p_size     int  default 10
) returns jsonb
language plpgsql
security invoker
as $$
declare
  v_user_id text;
  v_date date;
  v_existing public.rop_daily_challenges%rowtype;
  v_question_ids uuid[];
  v_size int := greatest(5, least(coalesce(p_size, 10), 10));
begin
  v_user_id := public.firebase_uid();
  if v_user_id is null then
    raise exception 'get_or_create_daily_challenge: user not authenticated';
  end if;

  v_date := coalesce(p_date_utc, (now() at time zone 'UTC')::date);

  -- Idempotente: retorna existing se já criado hoje
  select * into v_existing
  from public.rop_daily_challenges
  where user_id = v_user_id and date_utc = v_date;

  if found then
    return jsonb_build_object(
      'id', v_existing.id,
      'user_id', v_existing.user_id,
      'date_utc', v_existing.date_utc,
      'question_ids', to_jsonb(v_existing.question_ids),
      'started_at', v_existing.started_at,
      'completed_at', v_existing.completed_at,
      'score_correct', v_existing.score_correct,
      'score_total', v_existing.score_total,
      'score_pct', v_existing.score_pct,
      'created', false
    );
  end if;

  -- Estratificação por área: 1-2 questões aleatórias de cada área ativa
  -- Distribuição: 6 áreas × ceil(size/6) ≈ 1-2 por área, depois corta no size
  with picks as (
    select q.id, a.id as area_id,
           row_number() over (partition by a.id order by random()) as rn
    from public.rop_questions q
    join public.rop_subdivisoes s on s.id = q.subdivisao_id and s.is_active = true
    join public.rop_areas a       on a.id = s.area_id and a.is_active = true
    where q.is_current = true
  ),
  stratified as (
    select id from picks where rn <= ceil(v_size::numeric / 6)
    order by random()
    limit v_size
  )
  select array_agg(id) into v_question_ids from stratified;

  if v_question_ids is null or array_length(v_question_ids, 1) < 5 then
    raise exception 'get_or_create_daily_challenge: pool insuficiente de questões (got %, need >=5)',
      coalesce(array_length(v_question_ids, 1), 0);
  end if;

  insert into public.rop_daily_challenges (user_id, date_utc, question_ids, score_total)
  values (v_user_id, v_date, v_question_ids, array_length(v_question_ids, 1))
  on conflict (user_id, date_utc) do nothing
  returning * into v_existing;

  -- Race-condition guard: outro request pode ter criado entre o select e o insert
  if not found then
    select * into v_existing
    from public.rop_daily_challenges
    where user_id = v_user_id and date_utc = v_date;
  end if;

  return jsonb_build_object(
    'id', v_existing.id,
    'user_id', v_existing.user_id,
    'date_utc', v_existing.date_utc,
    'question_ids', to_jsonb(v_existing.question_ids),
    'started_at', v_existing.started_at,
    'completed_at', v_existing.completed_at,
    'score_correct', v_existing.score_correct,
    'score_total', v_existing.score_total,
    'score_pct', v_existing.score_pct,
    'created', true
  );
end;
$$;

comment on function public.get_or_create_daily_challenge(date,int) is
  'Retorna desafio do dia. Idempotente. 5-10 questões aleatórias estratificadas por área. Wave 1.6 T1.6.10.';

-- ── 8.3 submit_daily_challenge_answer — registra attempt + atualiza score
create or replace function public.submit_daily_challenge_answer(
  p_challenge_id uuid,
  p_question_id  uuid,
  p_selected     int,
  p_time_sec     int default null
) returns jsonb
language plpgsql
security invoker
as $$
declare
  v_user_id text;
  v_challenge public.rop_daily_challenges%rowtype;
  v_question public.rop_questions%rowtype;
  v_is_correct boolean;
  v_already_answered boolean;
  v_new_correct int;
  v_new_pct numeric(5,2);
  v_done boolean := false;
begin
  v_user_id := public.firebase_uid();
  if v_user_id is null then
    raise exception 'submit_daily_challenge_answer: user not authenticated';
  end if;

  select * into v_challenge
  from public.rop_daily_challenges
  where id = p_challenge_id and user_id = v_user_id;
  if not found then
    raise exception 'submit_daily_challenge_answer: challenge não encontrado ou não pertence ao user';
  end if;

  if not (p_question_id = any(v_challenge.question_ids)) then
    raise exception 'submit_daily_challenge_answer: question_id não está no challenge';
  end if;

  select * into v_question from public.rop_questions where id = p_question_id;
  if not found then
    raise exception 'submit_daily_challenge_answer: question não encontrada';
  end if;

  -- Anti-duplicate: bloqueia 2ª resposta para mesma question no mesmo challenge
  select exists (
    select 1 from public.rop_user_attempts
    where user_id = v_user_id
      and challenge_id = p_challenge_id
      and question_id = p_question_id
  ) into v_already_answered;

  if v_already_answered then
    raise exception 'submit_daily_challenge_answer: questão já respondida neste desafio';
  end if;

  v_is_correct := (p_selected = v_question.correct_answer_index);

  insert into public.rop_user_attempts
    (user_id, question_id, selected_option, is_correct, time_seconds, context, challenge_id)
  values
    (v_user_id, p_question_id, p_selected, v_is_correct, p_time_sec, 'desafio_diario', p_challenge_id);

  v_new_correct := v_challenge.score_correct + (case when v_is_correct then 1 else 0 end);
  v_new_pct := round((v_new_correct::numeric / v_challenge.score_total::numeric) * 100, 2);

  -- Conta quantas questões já foram respondidas (após esse insert)
  select (
    select count(*) from public.rop_user_attempts
    where user_id = v_user_id and challenge_id = p_challenge_id
  ) >= v_challenge.score_total into v_done;

  update public.rop_daily_challenges
  set score_correct = v_new_correct,
      score_pct     = v_new_pct,
      completed_at  = case when v_done then now() else completed_at end
  where id = p_challenge_id;

  -- Streak: registra atividade no primeiro submit do dia (idempotente UTC)
  perform public.record_user_activity_day('desafio_rop');

  return jsonb_build_object(
    'is_correct', v_is_correct,
    'correct_answer_index', v_question.correct_answer_index,
    'explanation', v_question.explanation,
    'score_correct', v_new_correct,
    'score_total', v_challenge.score_total,
    'score_pct', v_new_pct,
    'completed', v_done
  );
end;
$$;

comment on function public.submit_daily_challenge_answer(uuid,uuid,int,int) is
  'Submete resposta do desafio do dia. Atualiza score. Dispara record_user_activity_day(desafio_rop). Idempotente. Wave 1.6 T1.6.10+T1.6.11.';

-- ── 8.4 get_rops_ranking — substituí dependência de get_rops_ranking velho
--      Sé existe noutra migration: drop+create.
--      Período: 'week' | 'month' | 'all'
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
    coalesce(p.role, 'colaborador')                                 as subtitle,
    a.correct_count::numeric                                        as score,
    a.total_count                                                   as quiz_count,
    rank() over (order by a.correct_count desc, a.total_count desc) as rank
  from agg a
  left join public.profiles p on p.id = a.user_id
  order by rank asc, score desc
  limit 50;
$$;

comment on function public.get_rops_ranking(text) is
  'Ranking ROPs por período. Junta user_profiles para nome+role. LGPD: caller decide exposição (anti-pattern leaderboard forçado). Wave 1.6 T1.6.12.';

-- ==========================================================================
-- 9. Grants
-- ==========================================================================

grant select on public.rop_areas             to authenticated;
grant select on public.rop_subdivisoes       to authenticated;
grant select on public.rop_questions         to authenticated;
grant select, insert on public.rop_user_attempts to authenticated;
grant select, insert, update on public.rop_daily_challenges to authenticated;
grant select, insert on public.rop_changelog to authenticated;

grant execute on function public.rpc_log_rop_action(text,text,uuid,jsonb,text,text) to authenticated;
grant execute on function public.get_or_create_daily_challenge(date,int) to authenticated;
grant execute on function public.submit_daily_challenge_answer(uuid,uuid,int,int) to authenticated;
grant execute on function public.get_rops_ranking(text) to authenticated;

-- Admin write é via RLS (is_admin()), não via grant — authenticated já tem
-- INSERT/UPDATE/DELETE mas RLS bloqueia se não-admin.
grant insert, update, delete on public.rop_areas       to authenticated;
grant insert, update, delete on public.rop_subdivisoes to authenticated;
grant insert, update, delete on public.rop_questions   to authenticated;

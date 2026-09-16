-- ============================================================================
-- Performance no plano FREE (compute Nano) — alavancas sem custo
-- ============================================================================
-- Contexto: em 16/09/2026 às 11h15 o banco saturou na troca de turno (60–75 %
-- das chamadas REST em timeout por 2 h). Medido em pg_stat_statements desde
-- 08/02: 92 % do tempo de CPU do banco estava em 3 consumidores. Esta migration
-- cobre o que é schema/config; o que é operacional fica fora dela:
--   • VACUUM (FULL) net._http_response — NÃO roda em transação; 146 MB para
--     363 linhas, autovacuum rodou UMA vez (05/08). Passo manual, documentado
--     na memória do incidente.
--   • Migração das assinaturas Realtime para Broadcast (59 % do tempo) — é
--     código do app, onda própria.
-- Cada bloco é idempotente e reversível (rollback no fim do arquivo, comentado).
-- ============================================================================

-- ── 0. Teto de espera por lock e de duração por statement ───────────────────
-- O apply-migration manda o arquivo inteiro numa chamada = transação única, e
-- cada lock vale até o COMMIT. CREATE INDEX (SHARE) segura os INSERTs de
-- escala_cirurgica_evento/user_activity_log e DROP INDEX (ACCESS EXCLUSIVE)
-- espera toda consulta em curso — numa Nano é o pile-up de 16/09 de novo.
-- SET LOCAL morre no COMMIT (não vaza para a conexão pooled do pg-meta);
-- statement_timeout < 100 s aborta ANTES do 524 do Cloudflare. Estourou?
-- Rerodar: o arquivo é idempotente. Aplicar fora das trocas de turno.
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- ── 1. Índices que faltavam nas consultas quentes ───────────────────────────
-- fetchEscala (a cada abertura/revalidação da escala) busca o histórico de trocas
-- por escala_id + tipo: 170 k chamadas em seq scan de 8,8 k linhas (38 ms; 320 ms
-- sob carga). Índice composto cobre filtro e ordenação.
create index if not exists idx_esc_evento_escala_tipo_em
  on public.escala_cirurgica_evento (escala_id, tipo, em desc);

-- useActivityTracking: "created_at >= (30 dias) order by created_at desc limit
-- 5000" 91 k vezes a 290 ms — nenhum índice servia (os existentes começam por
-- event_type/user_id).
create index if not exists idx_activity_log_created
  on public.user_activity_log (created_at desc);

-- ── 2. Índices duplicados / nunca usados (advisor 16/09, idx_scan = 0 desde 02/2026) ──
drop index if exists public.idx_notifications_created;    -- idêntico a idx_notif_created (600 scans)
drop index if exists public.idx_notifications_recipient;  -- idêntico a idx_notif_recipient (47 k scans)
drop index if exists public.idx_activity_log_type_date;   -- 6,5 MB, 0 scans
drop index if exists public.idx_activity_log_user;        -- 9,5 MB, 0 scans

-- ── 3. Publication do Realtime: tabela sem assinante ────────────────────────
-- trocas_cirurgicas: a troca da escala foi aposentada em 29/07 e nenhum
-- .channel()/postgres_changes no app assina a tabela. Cada mudança numa tabela
-- publicada é avaliada pelo Realtime contra os assinantes (RLS por assinante).
do $$
begin
  if exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trocas_cirurgicas'
  ) then
    alter publication supabase_realtime drop table public.trocas_cirurgicas;
  end if;
end $$;

-- ── 4. Sessão ociosa em transação (Management API / pg-meta) morre sozinha ──
-- Cada chamada da Management API que estoura por timeout deixa uma sessão
-- "idle in transaction" (prelúdio set_config) segurando conexão e snapshot.
-- Em 16/09 sobraram 4 por 18 min. O role só altera o próprio default.
alter role postgres set idle_in_transaction_session_timeout = '5min';

-- ── 5. Crons de tradução de notícias ────────────────────────────────────────
-- translate-pending rodava a cada MINUTO (pg_net → edge → RPC), dia e noite:
-- 173 k http_post + 265 k linhas em cron.job_run_details + a tabela do pg_net.
-- Notícias entram 1×/dia (06:00 UTC); 10 min de latência na tradução é invisível.
select cron.alter_job(jobid, schedule := '*/10 * * * *')
  from cron.job where jobname = 'translate-pending' and schedule <> '*/10 * * * *';
select cron.alter_job(jobid, schedule := '*/30 * * * *')
  from cron.job where jobname = 'reap-stale-translations' and schedule <> '*/30 * * * *';

-- ── 6. RLS: auth/current_setting em initplan (advisor auth_rls_initplan) ────
-- Sem o (select …) o Postgres reavalia a função a cada linha. Semântica idêntica.
alter policy "Users and admins can create notifications" on public.notifications
  with check (
    (select public.is_admin())
    or exists (
      select 1 from public.profiles p
       where p.id = (select public.firebase_uid()) and p.active is not false
    )
    or (((select current_setting('request.jwt.claims', true))::json ->> 'role') = 'service_role')
  );

alter policy "Users can view own LGPD requests" on public.lgpd_solicitacoes
  using (user_id = ((select current_setting('request.jwt.claims', true))::json ->> 'sub'));

-- rops_quiz_results e esta policy existem em produção mas em nenhuma migration
-- do repo (drift): guardado para não derrubar a transação num banco de dev.
do $$
begin
  if exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'rops_quiz_results' and policyname = 'Insert own results'
  ) then
    alter policy "Insert own results" on public.rops_quiz_results
      with check (user_id = ((select current_setting('request.jwt.claims', true))::json ->> 'sub'));
  end if;
end $$;

-- ============================================================================
-- ROLLBACK (manual, se precisar)
-- ============================================================================
-- drop index if exists public.idx_esc_evento_escala_tipo_em;
-- drop index if exists public.idx_activity_log_created;
-- (definições capturadas por pg_get_indexdef em produção, 16/09 — não existem em migration do repo)
-- create index if not exists idx_notifications_created on public.notifications (created_at desc);
-- create index if not exists idx_notifications_recipient on public.notifications (recipient_id);
-- create index if not exists idx_activity_log_type_date on public.user_activity_log (event_type, created_at desc);
-- create index if not exists idx_activity_log_user on public.user_activity_log (user_id, created_at desc);
-- alter publication supabase_realtime add table public.trocas_cirurgicas;
-- alter role postgres reset idle_in_transaction_session_timeout;
-- select cron.alter_job(jobid, schedule := '* * * * *') from cron.job where jobname = 'translate-pending';
-- select cron.alter_job(jobid, schedule := '*/2 * * * *') from cron.job where jobname = 'reap-stale-translations';
-- alter policy "Users and admins can create notifications" on public.notifications
--   with check (public.is_admin() or exists (select 1 from public.profiles p where p.id = public.firebase_uid() and p.active is not false)
--               or ((current_setting('request.jwt.claims', true))::json ->> 'role') = 'service_role');
-- alter policy "Users can view own LGPD requests" on public.lgpd_solicitacoes
--   using (user_id = ((current_setting('request.jwt.claims', true))::json ->> 'sub'));
-- alter policy "Insert own results" on public.rops_quiz_results
--   with check (user_id = ((current_setting('request.jwt.claims', true))::json ->> 'sub'));

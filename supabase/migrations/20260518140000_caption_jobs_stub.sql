-- ==========================================================================
-- 20260518140000_caption_jobs_stub.sql
-- Sprint 1 Wave 1.7 T1.1.14 — Stub para futuro pipeline Whisper (Sprint 5)
--
-- Objetivo: criar schema completo da tabela caption_jobs SEM trigger ativo.
-- Wave 1.7 entrega upload manual + YouTube auto-captions; pipeline Whisper
-- para uploads próprios fica para Sprint 5 (Groq Whisper Turbo $0.04/h).
--
-- Esta migration prepara o terreno para:
--   - Upload vídeo Supabase → trigger insere job em caption_jobs (futuro)
--   - pg_cron 1min lê fila → Edge Function 'process-caption-job' (futuro)
--   - Worker faz ffmpeg WASM chunk + Silero VAD + Groq Whisper Turbo (futuro)
--   - Salva VTT em Storage + atualiza aulas_captions (T1.1.9)
--
-- Pesquisa que embasou (2026-05-17):
--   - OpenAI Whisper API: 25MB hard limit + hallucination clínica documentada
--   - Groq Whisper Turbo: 18x mais barato ($0.04/h vs $0.36/h OpenAI), mesmo modelo
--   - AssemblyAI Universal-3 Pro: $0 nos primeiros 185h/mês + PT-BR nativo
--   - GitHub Actions/Vercel Cron/Lambda: anti-patterns confirmados
--   - Cloudflare Workers AI Whisper-large-v3-turbo: $0.77/mês (1500 min)
-- ==========================================================================

create table if not exists public.caption_jobs (
  id              uuid primary key default gen_random_uuid(),
  aula_id         text not null,
  requested_by    text not null, -- Firebase UID
  source_type     text not null
    check (source_type in ('upload_video','upload_audio','youtube','vimeo','external_url')),
  source_url      text not null,
  language        text not null default 'pt',
  status          text not null default 'queued'
    check (status in ('queued','processing','done','failed','cancelled')),

  -- Resultado
  captions_url    text, -- storage path para .vtt resultante (preenchido em status=done)
  duration_sec    integer,
  word_count      integer,

  -- Provider info (para auditoria + custo tracking)
  provider        text, -- 'groq_whisper'|'assemblyai'|'deepgram'|'cloudflare_ai'
  provider_job_id text,

  -- Erro
  error_detail    text,
  retry_count     integer default 0,
  max_retries     integer default 3,
  next_retry_at   timestamptz, -- backoff exponencial calculado por worker

  -- Prioridade (futuro: admin marcar aulas críticas com priority alta)
  priority        integer default 0,

  -- Custo tracking (preencher por worker para budget LGPD/audit)
  cost_cents      integer,

  -- Timestamps
  created_at      timestamptz not null default now(),
  started_at      timestamptz,
  completed_at    timestamptz
);

comment on table public.caption_jobs is
  'Fila de jobs de transcrição automática. STUB criado em T1.1.14 (Wave 1.7), pipeline ativo em Sprint 5.';

create index if not exists idx_caption_jobs_status
  on public.caption_jobs (status, created_at)
  where status in ('queued','processing');

create index if not exists idx_caption_jobs_aula
  on public.caption_jobs (aula_id, created_at desc);

-- ──────────────────────────────────────────────
-- RLS
-- ──────────────────────────────────────────────

alter table public.caption_jobs enable row level security;

-- SELECT: admin lê todos; user comum lê só os próprios (futuro caso aluno solicite)
drop policy if exists cj_select on public.caption_jobs;
create policy cj_select on public.caption_jobs
  for select
  to authenticated
  using (requested_by = public.firebase_uid() or public.is_admin());

-- INSERT: admin (manualmente pediu) ou service_role (trigger futuro)
drop policy if exists cj_insert_admin on public.caption_jobs;
create policy cj_insert_admin on public.caption_jobs
  for insert
  to authenticated
  with check (public.is_admin() and requested_by = public.firebase_uid());

-- UPDATE: só admin (cancelar) ou service_role (worker atualiza status)
drop policy if exists cj_update_admin on public.caption_jobs;
create policy cj_update_admin on public.caption_jobs
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- DELETE: só admin
drop policy if exists cj_delete_admin on public.caption_jobs;
create policy cj_delete_admin on public.caption_jobs
  for delete
  to authenticated
  using (public.is_admin());

-- ──────────────────────────────────────────────
-- Grants
-- ──────────────────────────────────────────────

grant select on public.caption_jobs to authenticated;

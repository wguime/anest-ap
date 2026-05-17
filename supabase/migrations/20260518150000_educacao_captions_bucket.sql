-- ==========================================================================
-- 20260518150000_educacao_captions_bucket.sql
-- Sprint 1 Wave 1.7 T1.1.8/T1.1.13 — Bucket Storage para captions VTT/SRT
--
-- Objetivo: bucket dedicado para arquivos .vtt/.srt:
--   - YouTube auto-captions (fetched pela Edge Function fetch-yt-captions)
--   - Upload manual VTT/SRT do admin (T1.1.13)
--   - Whisper output futuro (Sprint 5)
--
-- Path scheme:
--   - youtube/{videoId}-{lang}.vtt        (auto-fetched)
--   - manual/{aulaId}/{lang}.vtt|.srt     (admin upload)
--   - whisper/{aulaId}/{lang}.vtt         (futuro)
--
-- Acesso: SELECT público authenticated (alunos consomem); INSERT/UPDATE/DELETE
-- só admin. Tamanho máximo 5MB (vídeo de 2h gera ~200KB VTT).
-- ==========================================================================

-- ──────────────────────────────────────────────
-- 1. Criar bucket
-- ──────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'educacao-captions',
  'educacao-captions',
  false, -- privado (acesso via signed URL ou authenticated SELECT)
  5 * 1024 * 1024, -- 5 MB
  array['text/vtt', 'application/x-subrip', 'text/srt', 'text/plain']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ──────────────────────────────────────────────
-- 2. RLS: SELECT authenticated (alunos baixam captions na hora de tocar aula)
-- ──────────────────────────────────────────────

drop policy if exists storage_captions_select on storage.objects;
create policy storage_captions_select
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'educacao-captions'
  );

-- ──────────────────────────────────────────────
-- 3. RLS: INSERT/UPDATE/DELETE só admin
-- ──────────────────────────────────────────────

drop policy if exists storage_captions_insert on storage.objects;
create policy storage_captions_insert
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'educacao-captions'
    and public.is_admin()
    and name not like '%..%' -- anti path traversal
  );

drop policy if exists storage_captions_update on storage.objects;
create policy storage_captions_update
  on storage.objects for update
  to authenticated
  using (bucket_id = 'educacao-captions' and public.is_admin())
  with check (bucket_id = 'educacao-captions' and public.is_admin());

drop policy if exists storage_captions_delete on storage.objects;
create policy storage_captions_delete
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'educacao-captions' and public.is_admin());

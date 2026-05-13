-- ============================================================================
-- 20260513150000_storage_migration_buckets.sql — Sprint 21 (v5.0.0)
--
-- Cria 3 novos buckets em Supabase Storage para substituir Firebase Storage:
--   - profile-photos      (substitui Firebase 'avatars/{uid}')
--   - reuniao-documentos  (substitui Firebase 'reunioes/{reuniaoId}/{tipo}/')
--   - reuniao-atas        (substitui Firebase 'reunioes/{reuniaoId}/ata/')
--
-- Estrutura de path canônica:
--   profile-photos:     {uid}/{filename}
--   reuniao-documentos: {reuniaoId}/{tipoDocumento}/{filename}
--   reuniao-atas:       {reuniaoId}/{filename}
--
-- RLS policies espelham 003_storage.sql:
--   - profile-photos: owner-only via public.firebase_uid() = (storage.foldername(name))[1]
--   - reuniao-documentos: authenticated select/insert, admin update/delete
--   - reuniao-atas: authenticated select, admin insert/update/delete
--
-- IMPORTANTE: usar public.firebase_uid() (definido em 002_rls.sql), NUNCA
-- auth.uid()::text — o projeto usa JWT custom HS256 onde `sub` = Firebase UID
-- (string), não UUID. auth.uid() falha o parse e a policy deny silenciosa.
--
-- Idempotente: ON CONFLICT em buckets; DROP POLICY IF EXISTS antes do CREATE.
--
-- Também adiciona coluna `storage_provider` em `documentos` (Postgres).
-- Firestore collections (reuniao_documentos, userProfiles) não precisam SQL —
-- a flag vive no documento Firestore como campo opcional.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Buckets
-- ----------------------------------------------------------------------------
-- NOTA: storage.buckets INSERT pode falhar em alguns Supabase projects
-- (precisa privilégios do schema storage). Se falhar, o user cria via
-- Dashboard: Project → Storage → New bucket. RLS policies abaixo funcionam
-- igual independente de onde o bucket foi criado.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('profile-photos', 'profile-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('reuniao-documentos', 'reuniao-documentos', false, 15728640, array['application/pdf']),
  ('reuniao-atas', 'reuniao-atas', false, 15728640, array['application/pdf'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- 2. profile-photos RLS — owner-only
-- ----------------------------------------------------------------------------
-- Path: {firebase_uid}/{filename}  → (storage.foldername(name))[1] = firebase_uid

drop policy if exists storage_profile_select on storage.objects;
create policy storage_profile_select
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and (
      public.firebase_uid() = (storage.foldername(name))[1]
      or public.is_admin()
    )
  );

drop policy if exists storage_profile_insert on storage.objects;
create policy storage_profile_insert
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'profile-photos'
    and public.firebase_uid() = (storage.foldername(name))[1]
    and name not like '%..%'
  );

drop policy if exists storage_profile_update on storage.objects;
create policy storage_profile_update
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and public.firebase_uid() = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'profile-photos'
    and public.firebase_uid() = (storage.foldername(name))[1]
  );

drop policy if exists storage_profile_delete on storage.objects;
create policy storage_profile_delete
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and (
      public.firebase_uid() = (storage.foldername(name))[1]
      or public.is_admin()
    )
  );

-- ----------------------------------------------------------------------------
-- 3. reuniao-documentos RLS — authenticated read/write, admin manages
-- ----------------------------------------------------------------------------
-- Path: {reuniaoId}/{tipoDocumento}/{filename}
-- Tipos válidos: subsidio, pauta, ata, outros

drop policy if exists storage_reuniao_doc_select on storage.objects;
create policy storage_reuniao_doc_select
  on storage.objects for select
  to authenticated
  using (bucket_id = 'reuniao-documentos');

drop policy if exists storage_reuniao_doc_insert on storage.objects;
create policy storage_reuniao_doc_insert
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'reuniao-documentos'
    and (storage.foldername(name))[2] in ('subsidio', 'pauta', 'ata', 'outros')
    and name not like '%..%'
  );

drop policy if exists storage_reuniao_doc_update on storage.objects;
create policy storage_reuniao_doc_update
  on storage.objects for update
  to authenticated
  using (bucket_id = 'reuniao-documentos' and public.is_admin())
  with check (bucket_id = 'reuniao-documentos' and public.is_admin());

drop policy if exists storage_reuniao_doc_delete on storage.objects;
create policy storage_reuniao_doc_delete
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'reuniao-documentos' and public.is_admin());

-- ----------------------------------------------------------------------------
-- 4. reuniao-atas RLS — authenticated read, admin manages
-- ----------------------------------------------------------------------------
-- Path: {reuniaoId}/{filename}

drop policy if exists storage_reuniao_ata_select on storage.objects;
create policy storage_reuniao_ata_select
  on storage.objects for select
  to authenticated
  using (bucket_id = 'reuniao-atas');

drop policy if exists storage_reuniao_ata_insert on storage.objects;
create policy storage_reuniao_ata_insert
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'reuniao-atas'
    and public.is_admin()
    and name not like '%..%'
  );

drop policy if exists storage_reuniao_ata_update on storage.objects;
create policy storage_reuniao_ata_update
  on storage.objects for update
  to authenticated
  using (bucket_id = 'reuniao-atas' and public.is_admin())
  with check (bucket_id = 'reuniao-atas' and public.is_admin());

drop policy if exists storage_reuniao_ata_delete on storage.objects;
create policy storage_reuniao_ata_delete
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'reuniao-atas' and public.is_admin());

-- ----------------------------------------------------------------------------
-- 5. Coluna storage_provider em documentos (Postgres)
-- ----------------------------------------------------------------------------
-- Identifica qual storage é dono do arquivo durante transição.
-- 'firebase' = legado (URL firebasestorage.googleapis.com)
-- 'supabase' = novo (URL vjzrahruvjffyyqyhjny.supabase.co/storage/v1/object/...)

alter table documentos
  add column if not exists storage_provider text not null default 'firebase'
    check (storage_provider in ('firebase', 'supabase'));

comment on column documentos.storage_provider is
  'Identifica origem do arquivo em documentos.url. firebase=legado, supabase=migrado em Sprint 21+';

create index if not exists idx_documentos_storage_provider
  on documentos(storage_provider);

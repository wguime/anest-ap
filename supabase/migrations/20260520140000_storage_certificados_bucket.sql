-- ============================================================================
-- 20260520140000_storage_certificados_bucket.sql — Wave 1.8 (v5.3.0)
--
-- Cria bucket privado `certificados` em Supabase Storage para hospedar PDFs
-- de certificados de Educação Continuada (substitui Firebase Storage path
-- `certificados/{certId}.pdf`).
--
-- Estrutura de path canônica:
--   certificados: {firebase_uid}/{certificadoId}.pdf
--
-- RLS policies:
--   - storage_cert_owner_select: usuário lê apenas certificados em seu folder
--   - storage_cert_admin_select: admin lê qualquer certificado (auditoria)
--   - storage_cert_owner_insert: usuário pode fazer upload no seu folder
--                                (caso de dual-write client-side)
--   - storage_cert_service_write: service_role tem full access (Edge fns,
--                                 backfill, LGPD delete)
--
-- IMPORTANTE: usa public.firebase_uid() (definido em 002_rls.sql) — o projeto
-- usa JWT custom HS256 onde `sub` = Firebase UID (string), não UUID.
-- auth.uid()::text falha o parse e a policy deny silenciosa.
--
-- O JWT custom NÃO contém claim `is_admin`; portanto a checagem admin
-- usa public.is_admin() que consulta admin_users via SECURITY DEFINER.
--
-- Idempotente: ON CONFLICT em buckets; DROP POLICY IF EXISTS antes do CREATE.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Bucket: certificados (privado, 5MB, application/pdf)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('certificados', 'certificados', false, 5242880, array['application/pdf'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public = excluded.public;

-- ----------------------------------------------------------------------------
-- 2. RLS: storage_cert_owner_select — owner lê seu próprio cert
-- ----------------------------------------------------------------------------
drop policy if exists storage_cert_owner_select on storage.objects;
create policy storage_cert_owner_select
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'certificados'
    and public.firebase_uid() = (storage.foldername(name))[1]
  );

-- ----------------------------------------------------------------------------
-- 3. RLS: storage_cert_admin_select — admin lê qualquer cert (auditoria)
-- ----------------------------------------------------------------------------
drop policy if exists storage_cert_admin_select on storage.objects;
create policy storage_cert_admin_select
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'certificados'
    and public.is_admin()
  );

-- ----------------------------------------------------------------------------
-- 4. RLS: storage_cert_owner_insert — owner pode fazer upload no seu folder
-- ----------------------------------------------------------------------------
-- Path TEM que começar com firebase_uid do JWT. Bloqueia path traversal e
-- escrita em folder de outro user. Path validation `name not like '%..%'`
-- protege contra traversal explícita.
drop policy if exists storage_cert_owner_insert on storage.objects;
create policy storage_cert_owner_insert
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'certificados'
    and public.firebase_uid() = (storage.foldername(name))[1]
    and name not like '%..%'
  );

-- ----------------------------------------------------------------------------
-- 5. RLS: storage_cert_service_write — service_role full access
-- ----------------------------------------------------------------------------
-- Necessário para Edge functions (get-cert-download-url, backfill server-side
-- futuro) e operações LGPD via service-role (deletion request).
drop policy if exists storage_cert_service_write on storage.objects;
create policy storage_cert_service_write
  on storage.objects for all
  to service_role
  using (bucket_id = 'certificados')
  with check (bucket_id = 'certificados');

-- ==========================================================================
-- 003_storage.sql — Bucket e políticas de storage para documentos
--
-- NOTA: O bucket deve ser criado via Supabase Dashboard ou CLI:
--   supabase storage create documentos --public=false
--
-- Estrutura de arquivos:
--   documentos/{categoria}/{document_id}/v{versao}/{filename}
--
-- As políticas abaixo são executadas via SQL no Supabase Dashboard
-- (SQL Editor > New Query) pois storage.objects é gerenciado pelo Supabase.
-- ==========================================================================

-- Autenticados podem ler arquivos do bucket 'documentos'
create policy "storage_doc_select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'documentos');

-- Admins podem fazer upload no bucket 'documentos'
create policy "storage_doc_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'documentos' and public.is_admin());

-- Admins podem atualizar arquivos no bucket 'documentos'
create policy "storage_doc_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'documentos' and public.is_admin());

-- Admins podem deletar arquivos no bucket 'documentos'
create policy "storage_doc_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'documentos' and public.is_admin());

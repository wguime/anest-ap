-- ============================================================================
-- Wave 1.8 fix — Admin DELETE policy para bucket certificados
-- ============================================================================
-- Motivo: audit security identificou que lgpdService.processSolicitacao chama
-- supabase.storage.from('certificados').remove(...) com client anon-key + JWT
-- do admin (não service_role). A migration 20260520140000 só permite DELETE
-- para service_role (storage_cert_service_write FOR ALL), resultando em falha
-- silenciosa (RLS deny) ao apagar PDFs Supabase em deletion request LGPD.
-- Sem este fix, Art. 18 LGPD (direito ao apagamento) não é cumprido para
-- PDFs no Supabase Storage.
--
-- Solução: policy explícita storage_cert_admin_delete para authenticated
-- usuários onde public.is_admin() = true.
--
-- Idempotente. Rollback safe (drop policy if exists).
-- ============================================================================

drop policy if exists storage_cert_admin_delete on storage.objects;
create policy storage_cert_admin_delete
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'certificados'
    and public.is_admin()
  );

-- Defesa em profundidade: também permitir owner deletar seu próprio cert
-- (cenário: re-emissão sobrescreve, mas o PDF antigo do path determinístico
-- pode ficar órfão se houver mudança de naming no futuro).
drop policy if exists storage_cert_owner_delete on storage.objects;
create policy storage_cert_owner_delete
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'certificados'
    and (storage.foldername(name))[1] = public.firebase_uid()
    and name not like '%..%'
  );

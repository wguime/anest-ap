-- =============================================================================
-- 20260508600000_storage_path_scoping.sql — issue #13 (audit P2-2)
--
-- Substitui a policy storage_doc_insert_authenticated (que permitia INSERT
-- em qualquer path do bucket 'documentos') por uma versão path-scoped:
--
--   - Admins (is_admin()): qualquer path no bucket 'documentos'
--   - Authenticated não-admin: apenas paths com formato canônico
--     <categoria>/<docId>/v<versao>/<filename> onde categoria é da
--     whitelist e docId começa com 'doc-' (padrão UUID prefixado).
--
-- Não impede que user A sobrescreva path de user B (precisaria FK ao
-- created_by no docId, mas docId não existe quando o upload acontece —
-- ele precede o INSERT em documentos). Defesa em profundidade: confidentiality
-- RLS na linha de documentos protege leitura; path-scoping evita escapes
-- triviais como `../../etc/passwd` ou `random/path/foo.pdf`.
-- =============================================================================

DROP POLICY IF EXISTS storage_doc_insert_authenticated ON storage.objects;

-- Admins podem fazer upload em qualquer path do bucket
CREATE POLICY storage_doc_insert_admin ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documentos'
    AND public.is_admin()
  );

-- Non-admin authenticated: path scoped para <categoria-whitelist>/doc-*/v*/*.pdf
CREATE POLICY storage_doc_insert_user_scoped ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documentos'
    AND NOT public.is_admin()
    AND (storage.foldername(name))[1] IN (
      'biblioteca','etica','comites','auditorias','relatorios',
      'financeiro','desastres','medicamentos','infeccoes','obsoletos'
    )
    AND (storage.foldername(name))[2] LIKE 'doc-%'
    AND (storage.foldername(name))[3] LIKE 'v%'
    AND name NOT LIKE '%..%'
  );

-- UPDATE policy: igual restrição
DROP POLICY IF EXISTS storage_doc_update_authenticated ON storage.objects;

CREATE POLICY storage_doc_update_admin ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'documentos' AND public.is_admin())
  WITH CHECK (bucket_id = 'documentos' AND public.is_admin());

-- DELETE: apenas admin
DROP POLICY IF EXISTS storage_doc_delete_admin ON storage.objects;
CREATE POLICY storage_doc_delete_admin ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documentos' AND public.is_admin());

-- COMMENT ON POLICY skipped: ownership de storage.objects é system-managed.

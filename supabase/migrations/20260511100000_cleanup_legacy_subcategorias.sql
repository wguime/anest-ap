-- =============================================================================
-- 20260511100000_cleanup_legacy_subcategorias.sql — Hotfix Biblioteca
--
-- Soft-delete dos docs cuja `subcategoria` está em formato legacy (pré-SSOT
-- atual de SUBCATEGORIA_CONFIG). A Biblioteca filtra por bucket-slug
-- ('modelos','governanca',…,'obsoletos'); docs com `subcategoria` em valores
-- antigos ('comites_documentos','protocolo_higiene_maos','politica_disclosure'
-- etc, ou NULL) não aparecem em accordion nenhum e geram a regressão de
-- "documentos sumiram" reportada em 2026-05-10.
--
-- Decisão do user (2026-05-11): excluir todos os docs legacy, manter apenas
-- os com subcategoria no formato bucket-slug atual.
--
-- Estratégia: soft-delete (`deleted_at = now()`, `deleted_by = 'sistema-cleanup'`).
-- Reversível via UPDATE deleted_at = NULL. Não toca documento_aprovacoes,
-- documento_changelog, etc — referências FK preservadas para auditoria.
-- =============================================================================

DO $$
DECLARE
  v_legacy_count integer;
  v_keep_count   integer;
BEGIN
  -- Buckets válidos (espelha SUBCATEGORIA_CONFIG em src/types/documents.js).
  -- Qualquer subcategoria fora dessa lista (ou NULL) é considerada legacy.

  SELECT COUNT(*) INTO v_legacy_count
  FROM public.documentos
  WHERE deleted_at IS NULL
    AND (
      subcategoria IS NULL
      OR subcategoria NOT IN (
        'modelos','governanca','institucional','assistencial',
        'gestao_pessoas','residencia','financeiro','qualidade',
        'tecnologia_mat','relatorios_gerais','obsoletos'
      )
    );

  SELECT COUNT(*) INTO v_keep_count
  FROM public.documentos
  WHERE deleted_at IS NULL
    AND subcategoria IN (
      'modelos','governanca','institucional','assistencial',
      'gestao_pessoas','residencia','financeiro','qualidade',
      'tecnologia_mat','relatorios_gerais','obsoletos'
    );

  RAISE NOTICE 'Legacy cleanup: marcando % docs como soft-deleted; mantendo % docs',
    v_legacy_count, v_keep_count;
END $$;

UPDATE public.documentos
SET
  deleted_at = now(),
  deleted_by = 'sistema-cleanup-legacy-20260511',
  updated_at = now(),
  updated_by = 'sistema-cleanup-legacy-20260511'
WHERE deleted_at IS NULL
  AND (
    subcategoria IS NULL
    OR subcategoria NOT IN (
      'modelos','governanca','institucional','assistencial',
      'gestao_pessoas','residencia','financeiro','qualidade',
      'tecnologia_mat','relatorios_gerais','obsoletos'
    )
  );

-- Log de auditoria global no documento_changelog (uma linha por doc afetado)
INSERT INTO public.documento_changelog (
  documento_id, action, user_id, user_name, comment, created_at
)
SELECT
  id, 'deleted', 'sistema-cleanup-legacy-20260511',
  'Sistema (cleanup legacy)',
  'Soft-delete automatizado: subcategoria em formato legacy não compatível com SUBCATEGORIA_CONFIG atual',
  now()
FROM public.documentos
WHERE deleted_by = 'sistema-cleanup-legacy-20260511'
  AND deleted_at >= now() - interval '5 seconds';

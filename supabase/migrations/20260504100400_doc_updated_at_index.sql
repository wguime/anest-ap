-- ============================================================================
-- Wave 0a — Sprint 0 — Índice em documentos.updated_at
-- ----------------------------------------------------------------------------
-- Problema (auditoria 2026-05-04, Agente 1):
-- Várias queries em supabaseDocumentService.js usam ORDER BY updated_at DESC
-- (fetchAllDocuments, fetchByCategory, fetchPendingApproval, fetchRecentActivity)
-- mas não há índice dedicado em `updated_at`. Postgres precisa fazer sort em
-- memória após sequential scan. Custo cresce linearmente.
--
-- Correção: adicionar índice descendente.
-- ============================================================================

create index if not exists idx_doc_updated_at
  on public.documentos(updated_at desc);

-- Adicionar também índice em setor_id (também sem índice — auditoria DB)
create index if not exists idx_doc_setor
  on public.documentos(setor_id)
  where setor_id is not null;

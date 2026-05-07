-- ============================================================================
-- Wave 0a — Sprint 0 — Estender CHECK constraint de documento_changelog.action
-- ----------------------------------------------------------------------------
-- Problema (auditoria 2026-05-04, Agente 1):
-- O serviço `supabaseDocumentService.js` chama `logAction` com três valores
-- que não existem no CHECK original (001_schema.sql:139-145):
--   • 'distributed' (linha 816)
--   • 'reminder_sent' (linha 858)
--   • 'approval_workflow_set' (linha 958)
-- Como `logAction` captura erros com try/catch + console.warn, todos esses
-- INSERTs falham silenciosamente, corrompendo o audit trail.
--
-- Correção: ampliar o CHECK constraint para 18 valores, incluindo os 3
-- atuais + 'legal_hold_set' e 'legal_hold_released' (preparados para Onda 1).
-- ============================================================================

alter table public.documento_changelog
  drop constraint if exists documento_changelog_action_check;

alter table public.documento_changelog
  add constraint documento_changelog_action_check
  check (action in (
    'created','status_changed','updated','version_added',
    'approved','rejected','archived','restored','deleted',
    'viewed','downloaded','acknowledged','review_scheduled',
    'signature_added','comment_added',
    -- Wave 0a additions:
    'distributed','reminder_sent','approval_workflow_set',
    -- Onda 1 forward-compat:
    'legal_hold_set','legal_hold_released'
  ));

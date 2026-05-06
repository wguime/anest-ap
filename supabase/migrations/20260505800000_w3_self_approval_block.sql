-- ============================================================================
-- Wave 3 / W3-5b — Server-side block para self-approval
-- ----------------------------------------------------------------------------
-- W3-5 (commit 52e7766) implementou bloqueio de auto-aprovação na UI + 2
-- guardas em JS (handleApprove, handleConfirm) + isSelfApproval helper.
-- Faltava enforcement no banco — esta migration fecha o gap via trigger
-- BEFORE INSERT/UPDATE em documento_aprovacoes.
--
-- Defesa em profundidade: cliente, mutation site e DB.
--
-- Idempotente. Sem DROP destrutivo (apenas DROP TRIGGER IF EXISTS para
-- permitir re-aplicação da function logic).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_self_approval()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_creator text;
BEGIN
  -- Só aplica para ações de decisão. 'signed' e outros estados administrativos
  -- (eg. registro de assinatura digital) não exigem essa restrição.
  IF NEW.action NOT IN ('approved', 'rejected') THEN
    RETURN NEW;
  END IF;

  SELECT created_by INTO v_creator
    FROM public.documentos
    WHERE id = NEW.documento_id;

  IF v_creator IS NOT NULL AND NEW.approver_id = v_creator THEN
    RAISE EXCEPTION
      'Self-approval blocked: approver_id (%) cannot equal documento.created_by (%)',
      NEW.approver_id, v_creator
      USING
        ERRCODE = 'check_violation',
        HINT    = 'O autor do documento não pode aprovar nem rejeitar a própria submissão.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_approval ON public.documento_aprovacoes;

CREATE TRIGGER trg_prevent_self_approval
  BEFORE INSERT OR UPDATE OF approver_id, action, documento_id
  ON public.documento_aprovacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_self_approval();

COMMENT ON FUNCTION public.prevent_self_approval() IS
  'W3-5b: bloqueia auto-aprovação ao nível DB. Cliente já bloqueia em UI/handler/mutation; isto é a 4ª camada (defesa em profundidade).';

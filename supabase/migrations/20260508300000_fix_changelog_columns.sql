-- =============================================================================
-- 20260508300000_fix_changelog_columns.sql — fix smoke test failure
--
-- As RPCs criadas em 20260508000000 e 20260508100000 inseriam em
-- documento_changelog usando coluna `changed_by`, mas o schema real
-- (001_schema.sql:145) tem `user_id` / `user_name` / `user_email`.
-- Erro detectado em smoke test: 42703 column "changed_by" does not exist.
--
-- Corrige as 2 funções com nomes de colunas corretos.
-- =============================================================================

-- 1. advance_approval_step — corrige nomes de colunas no INSERT
DROP FUNCTION IF EXISTS public.advance_approval_step(text);

CREATE OR REPLACE FUNCTION public.advance_approval_step(p_documento_id text)
RETURNS jsonb AS $$
DECLARE
  v_current documento_approval_steps;
  v_next documento_approval_steps;
  v_pending_count int;
  v_approved_count int;
  v_caller text;
  v_caller_name text;
BEGIN
  v_caller := public.firebase_uid();
  -- Best-effort fetch do nome do caller via profiles
  SELECT COALESCE(p.display_name, p.email, v_caller) INTO v_caller_name
    FROM public.profiles p WHERE p.id = v_caller;
  IF v_caller_name IS NULL THEN
    v_caller_name := COALESCE(v_caller, 'system');
  END IF;

  SELECT * INTO v_current FROM documento_approval_steps
    WHERE documento_id = p_documento_id AND status = 'active'
    ORDER BY step_order LIMIT 1;

  IF NOT FOUND THEN
    SELECT * INTO v_next FROM documento_approval_steps
      WHERE documento_id = p_documento_id AND status = 'pending'
      ORDER BY step_order LIMIT 1;
    IF FOUND THEN
      UPDATE documento_approval_steps
        SET status = 'active', activated_at = now()
        WHERE id = v_next.id;
      RETURN jsonb_build_object('activated', v_next.id, 'order', v_next.step_order);
    END IF;
    RETURN jsonb_build_object('completed', true);
  END IF;

  IF NOT public.is_admin()
     AND NOT (v_caller = ANY(v_current.approver_ids)) THEN
    RAISE EXCEPTION 'Caller (%) não é approver do step % nem admin', v_caller, v_current.id;
  END IF;

  IF v_current.mode IN ('sequential', 'parallel') THEN
    SELECT COUNT(*) INTO v_pending_count FROM documento_aprovacoes
      WHERE documento_id = p_documento_id
        AND step_id = v_current.id
        AND action = 'pending';
    IF v_pending_count = 0 THEN
      UPDATE documento_approval_steps
        SET status = 'approved', completed_at = now()
        WHERE id = v_current.id;

      INSERT INTO documento_changelog (documento_id, action, user_id, user_name, changes)
      VALUES (
        p_documento_id,
        'approved',
        v_caller,
        v_caller_name,
        jsonb_build_object('step_id', v_current.id, 'step_order', v_current.step_order)
      );

      RETURN public.advance_approval_step(p_documento_id);
    END IF;

  ELSIF v_current.mode = 'any_one' THEN
    SELECT COUNT(*) INTO v_approved_count FROM documento_aprovacoes
      WHERE documento_id = p_documento_id
        AND step_id = v_current.id
        AND action = 'approved';
    IF v_approved_count > 0 THEN
      UPDATE documento_approval_steps
        SET status = 'approved', completed_at = now()
        WHERE id = v_current.id;

      INSERT INTO documento_changelog (documento_id, action, user_id, user_name, changes)
      VALUES (
        p_documento_id,
        'approved',
        v_caller,
        v_caller_name,
        jsonb_build_object('step_id', v_current.id, 'step_order', v_current.step_order, 'mode', 'any_one')
      );

      RETURN public.advance_approval_step(p_documento_id);
    END IF;
  END IF;

  RETURN jsonb_build_object('current', v_current.id, 'order', v_current.step_order);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.advance_approval_step(text) TO authenticated;

-- 2. rpc_request_pdfa_conversion — corrige nomes de colunas no INSERT
CREATE OR REPLACE FUNCTION public.rpc_request_pdfa_conversion(
  p_documento_id text,
  p_user_id text
) RETURNS void AS $$
DECLARE
  v_user_name text;
BEGIN
  SELECT COALESCE(p.display_name, p.email, p_user_id) INTO v_user_name
    FROM public.profiles p WHERE p.id = p_user_id;
  IF v_user_name IS NULL THEN
    v_user_name := COALESCE(p_user_id, 'system');
  END IF;

  UPDATE public.documentos
    SET pdfa_status = 'pending'
    WHERE id = p_documento_id AND status = 'arquivado'
      AND (pdfa_status IS NULL OR pdfa_status IN ('failed','not_needed'));

  INSERT INTO public.documento_changelog (documento_id, action, user_id, user_name, changes)
  VALUES (p_documento_id, 'pdfa_started', p_user_id, v_user_name, jsonb_build_object('queued_at', now()));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.rpc_request_pdfa_conversion(text, text) TO authenticated;

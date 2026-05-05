-- ============================================================================
-- 20260505600000: Multi-step approval workflow + temporal review notifications
--
-- Cada documento pode ter N steps. Cada step tem ordem (step_order) e modo
-- (sequential | parallel | any_one). Aprovações continuam sendo persistidas em
-- documento_aprovacoes (uma linha por aprovador), agora vinculadas ao step
-- via step_id e com prazo (deadline) e marcação de notificação (notified_at).
--
-- Também cria 2 funções de notificação temporal (review_approaching e
-- review_overdue) e deixa schedules pg_cron comentados para ativação manual.
-- ============================================================================

-- ──────────────────────────────────────────────
-- 1. Extend documento_aprovacoes for multi-step
-- ──────────────────────────────────────────────

ALTER TABLE documento_aprovacoes ADD COLUMN IF NOT EXISTS step_id uuid;
ALTER TABLE documento_aprovacoes ADD COLUMN IF NOT EXISTS deadline timestamptz;
ALTER TABLE documento_aprovacoes ADD COLUMN IF NOT EXISTS notified_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_aprovacoes_step ON documento_aprovacoes(step_id);
CREATE INDEX IF NOT EXISTS idx_aprovacoes_deadline ON documento_aprovacoes(deadline)
  WHERE action = 'pending';

-- ──────────────────────────────────────────────
-- 2. Template table: documento_approval_steps
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS documento_approval_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
  step_order integer NOT NULL,
  mode text NOT NULL CHECK (mode IN ('sequential', 'parallel', 'any_one')),
  approver_ids text[] NOT NULL DEFAULT '{}',  -- firebase_uids dos aprovadores
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'approved', 'rejected', 'skipped')),
  deadline_days integer,  -- prazo em dias após o step ficar 'active'
  activated_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (documento_id, step_order)
);

CREATE INDEX IF NOT EXISTS idx_approval_steps_doc ON documento_approval_steps(documento_id);
CREATE INDEX IF NOT EXISTS idx_approval_steps_active ON documento_approval_steps(status)
  WHERE status = 'active';

-- ──────────────────────────────────────────────
-- 3. RLS — leitura por authenticated, mutação só admin
-- ──────────────────────────────────────────────

ALTER TABLE documento_approval_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS approval_steps_select ON documento_approval_steps;
CREATE POLICY approval_steps_select ON documento_approval_steps
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS approval_steps_insert ON documento_approval_steps;
CREATE POLICY approval_steps_insert ON documento_approval_steps
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS approval_steps_update ON documento_approval_steps;
CREATE POLICY approval_steps_update ON documento_approval_steps
  FOR UPDATE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS approval_steps_delete ON documento_approval_steps;
CREATE POLICY approval_steps_delete ON documento_approval_steps
  FOR DELETE TO authenticated USING (public.is_admin());

-- ──────────────────────────────────────────────
-- 4. RPC: advance_approval_step
-- ──────────────────────────────────────────────
-- Avança o workflow: marca o step ativo como 'approved' (se concluído pelo
-- modo) e ativa o próximo step pendente. Retorna jsonb descrevendo a ação.

CREATE OR REPLACE FUNCTION advance_approval_step(p_documento_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_current documento_approval_steps;
  v_next documento_approval_steps;
  v_pending_count int;
  v_approved_count int;
BEGIN
  SELECT * INTO v_current FROM documento_approval_steps
    WHERE documento_id = p_documento_id AND status = 'active'
    ORDER BY step_order LIMIT 1;

  IF NOT FOUND THEN
    -- Nenhum step ativo: ativa o primeiro pendente, se houver
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

  -- sequential e parallel: completa quando NÃO há mais pendentes para o step
  IF v_current.mode IN ('sequential', 'parallel') THEN
    SELECT COUNT(*) INTO v_pending_count FROM documento_aprovacoes
      WHERE documento_id = p_documento_id
        AND step_id = v_current.id
        AND action = 'pending';
    IF v_pending_count = 0 THEN
      UPDATE documento_approval_steps
        SET status = 'approved', completed_at = now()
        WHERE id = v_current.id;
      -- recursivo: ativa próximo
      RETURN advance_approval_step(p_documento_id);
    END IF;

  -- any_one: completa assim que pelo menos 1 aprovador aprovou
  ELSIF v_current.mode = 'any_one' THEN
    SELECT COUNT(*) INTO v_approved_count FROM documento_aprovacoes
      WHERE documento_id = p_documento_id
        AND step_id = v_current.id
        AND action = 'approved';
    IF v_approved_count > 0 THEN
      UPDATE documento_approval_steps
        SET status = 'approved', completed_at = now()
        WHERE id = v_current.id;
      RETURN advance_approval_step(p_documento_id);
    END IF;
  END IF;

  RETURN jsonb_build_object('current', v_current.id, 'order', v_current.step_order);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION advance_approval_step(uuid) TO authenticated;

-- ──────────────────────────────────────────────
-- 5. Notificações temporais (review_approaching / review_overdue)
-- ──────────────────────────────────────────────
-- AJUSTAR PARA SCHEMA REAL DE notifications:
-- Esquema confirmado em 029_fix_messages_notifications_rls.sql:
--   recipient_id, category, subject, content, sender_name, priority,
--   related_entity_type, related_entity_id, dismissable, created_at.

CREATE OR REPLACE FUNCTION notify_pending_review_approachers()
RETURNS integer AS $$
DECLARE inserted int := 0;
BEGIN
  -- Dispara em T-30, T-7 e T-0 (uma notificação por dia, idempotente)
  INSERT INTO notifications (
    recipient_id, category, subject, content, sender_name,
    priority, related_entity_type, related_entity_id, dismissable, created_at
  )
  SELECT
    d.responsavel_revisao,
    'qualidade',
    'Revisão de documento aproximando',
    d.titulo || ' — revisão em ' ||
      EXTRACT(DAY FROM (d.proxima_revisao::timestamptz - now()))::text || ' dia(s)',
    'Gestão Documental',
    CASE
      WHEN d.proxima_revisao::date = now()::date THEN 'urgente'
      WHEN d.proxima_revisao::date = (now() + interval '7 days')::date THEN 'alta'
      ELSE 'normal'
    END,
    'documento',
    d.id::text,
    true,
    now()
  FROM documentos d
  WHERE d.responsavel_revisao IS NOT NULL
    AND d.deleted_at IS NULL
    AND d.proxima_revisao IS NOT NULL
    AND d.proxima_revisao::date IN (
      (now() + interval '30 days')::date,
      (now() + interval '7 days')::date,
      now()::date
    )
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.related_entity_id = d.id::text
        AND n.related_entity_type = 'documento'
        AND n.subject = 'Revisão de documento aproximando'
        AND n.created_at::date = now()::date
    );
  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION notify_pending_review_approachers() TO authenticated;

CREATE OR REPLACE FUNCTION notify_overdue_reviews()
RETURNS integer AS $$
DECLARE inserted int := 0;
BEGIN
  -- Dispara em T+1, T+7 e T+30
  INSERT INTO notifications (
    recipient_id, category, subject, content, sender_name,
    priority, related_entity_type, related_entity_id, dismissable, created_at
  )
  SELECT
    d.responsavel_revisao,
    'qualidade',
    'Revisão atrasada',
    d.titulo || ' — atrasada há ' ||
      EXTRACT(DAY FROM (now() - d.proxima_revisao::timestamptz))::text || ' dia(s)',
    'Gestão Documental',
    'urgente',
    'documento',
    d.id::text,
    true,
    now()
  FROM documentos d
  WHERE d.responsavel_revisao IS NOT NULL
    AND d.deleted_at IS NULL
    AND d.proxima_revisao IS NOT NULL
    AND d.proxima_revisao::date IN (
      (now() - interval '1 day')::date,
      (now() - interval '7 days')::date,
      (now() - interval '30 days')::date
    )
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.related_entity_id = d.id::text
        AND n.related_entity_type = 'documento'
        AND n.subject = 'Revisão atrasada'
        AND n.created_at::date = now()::date
    );
  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION notify_overdue_reviews() TO authenticated;

-- ──────────────────────────────────────────────
-- 6. pg_cron schedules (COMENTADOS — ativar manualmente após validação)
-- ──────────────────────────────────────────────
-- SELECT cron.schedule('notify-review-approaching', '0 8 * * *',
--   'SELECT notify_pending_review_approachers();');
-- SELECT cron.schedule('notify-review-overdue', '15 8 * * *',
--   'SELECT notify_overdue_reviews();');

COMMENT ON TABLE documento_approval_steps IS
  'Multi-step approval workflow template. Cada doc pode ter N steps com modo sequential/parallel/any_one.';
COMMENT ON FUNCTION advance_approval_step(uuid) IS
  'Avança o workflow de aprovação para o próximo step quando o atual está completo.';
COMMENT ON FUNCTION notify_pending_review_approachers() IS
  'Cria notifications para revisões próximas (T-30, T-7, T-0). Idempotente por dia/documento.';
COMMENT ON FUNCTION notify_overdue_reviews() IS
  'Cria notifications para revisões atrasadas (T+1, T+7, T+30). Idempotente por dia/documento.';

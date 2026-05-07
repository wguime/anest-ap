-- =============================================================================
-- 20260508000000_audit_v3_72_fixes.sql — Audit v3.72.0 P0/P1 fixes
--
-- Corrige problemas detectados na auditoria de regressão pós-PR #5:
-- 1. firebase_uid() em policies de 018_profiles + 019_comunicados (eram auth.uid())
-- 2. WORM bypass via current_setting('role') ao invés de claim JWT forjável
-- 3. retention_policies com RLS habilitado (era acessível a anon após auth)
-- 4. advance_approval_step com p_documento_id text (era uuid, incompat. com schema)
-- 5. rpc_compliance_score_qmentum INNER JOIN (era LEFT JOIN com COALESCE 1.0)
-- 6. bulk_import_jobs DELETE policy (admin-only)
-- 7. Seed retention_policies para 'prontuarios' (CFM 1.821/2007)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. profiles / authorized_emails / incident_notification_settings
--    Substitui auth.uid()::text por public.firebase_uid()
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS profiles_insert ON public.profiles;
CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    public.firebase_uid() = id
    OR public.is_admin()
  );

DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    public.firebase_uid() = id
    OR public.is_admin()
  );

DROP POLICY IF EXISTS profiles_delete ON public.profiles;
CREATE POLICY profiles_delete ON public.profiles
  FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS auth_emails_insert ON public.authorized_emails;
CREATE POLICY auth_emails_insert ON public.authorized_emails
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS auth_emails_delete ON public.authorized_emails;
CREATE POLICY auth_emails_delete ON public.authorized_emails
  FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS inc_notif_insert ON public.incident_notification_settings;
CREATE POLICY inc_notif_insert ON public.incident_notification_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.firebase_uid() = user_id
    OR public.is_admin()
  );

DROP POLICY IF EXISTS inc_notif_update ON public.incident_notification_settings;
CREATE POLICY inc_notif_update ON public.incident_notification_settings
  FOR UPDATE TO authenticated
  USING (
    public.firebase_uid() = user_id
    OR public.is_admin()
  );

DROP POLICY IF EXISTS inc_notif_delete ON public.incident_notification_settings;
CREATE POLICY inc_notif_delete ON public.incident_notification_settings
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. comunicado_confirmacoes / comunicado_acoes
--    Eram auth.uid()::text = user_id, sempre falso com JWT customizado.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS com_conf_insert ON public.comunicado_confirmacoes;
CREATE POLICY com_conf_insert ON public.comunicado_confirmacoes
  FOR INSERT TO authenticated
  WITH CHECK (public.firebase_uid() = user_id);

DROP POLICY IF EXISTS com_acoes_insert ON public.comunicado_acoes;
CREATE POLICY com_acoes_insert ON public.comunicado_acoes
  FOR INSERT TO authenticated
  WITH CHECK (public.firebase_uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. WORM changelog: bypass via current_setting('role'), não claim JWT
--    Claim 'role' do JWT é forjável; a setting de sessão Postgres não é.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.prevent_changelog_modification()
RETURNS trigger AS $$
DECLARE
  session_role text;
BEGIN
  -- current_setting('role', true) reflete o role real da sessão Postgres,
  -- definido pelo Supabase ao authenticar (não vem do payload JWT).
  session_role := COALESCE(current_setting('role', true), '');

  IF (TG_OP = 'UPDATE') AND session_role <> 'service_role' THEN
    RAISE EXCEPTION 'documento_changelog é WORM (append-only). UPDATE bloqueado.';
  END IF;

  IF (TG_OP = 'DELETE') AND session_role <> 'service_role' THEN
    RAISE EXCEPTION 'documento_changelog é WORM (append-only). DELETE bloqueado.';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. retention_policies: habilitar RLS + policies
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.retention_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS retention_policies_select ON public.retention_policies;
CREATE POLICY retention_policies_select ON public.retention_policies
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS retention_policies_admin_write ON public.retention_policies;
CREATE POLICY retention_policies_admin_write ON public.retention_policies
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- documento_changelog_archive: idem
ALTER TABLE public.documento_changelog_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS doc_changelog_archive_select ON public.documento_changelog_archive;
CREATE POLICY doc_changelog_archive_select ON public.documento_changelog_archive
  FOR SELECT TO authenticated USING (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. advance_approval_step: parâmetro text (não uuid)
--    documento_approval_steps.documento_id é text REFERENCES documentos(id).
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.advance_approval_step(uuid);

CREATE OR REPLACE FUNCTION public.advance_approval_step(p_documento_id text)
RETURNS jsonb AS $$
DECLARE
  v_current documento_approval_steps;
  v_next documento_approval_steps;
  v_pending_count int;
  v_approved_count int;
  v_caller text;
BEGIN
  v_caller := public.firebase_uid();

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

  -- Guard: caller deve ser approver do step ativo, ou admin
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

      INSERT INTO documento_changelog (documento_id, action, changed_by, changes)
      VALUES (
        p_documento_id,
        'approved',
        v_caller,
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

      INSERT INTO documento_changelog (documento_id, action, changed_by, changes)
      VALUES (
        p_documento_id,
        'approved',
        v_caller,
        jsonb_build_object('step_id', v_current.id, 'step_order', v_current.step_order, 'mode', 'any_one')
      );

      RETURN public.advance_approval_step(p_documento_id);
    END IF;
  END IF;

  RETURN jsonb_build_object('current', v_current.id, 'order', v_current.step_order);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.advance_approval_step(text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. rpc_compliance_score_qmentum: INNER JOIN para alinhar com JS
--    JS ignora categorias sem peso; SQL aplicava 1.0 (drift silencioso).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_compliance_score_qmentum()
RETURNS json AS $$
  SELECT json_build_object(
    'score', COALESCE(ROUND(
      SUM(cat_score * w.weight)
      / NULLIF(SUM(w.weight), 0)
    ), NULL),
    'categories', COALESCE(json_agg(json_build_object(
      'categoria', sub.categoria,
      'score',     cat_score,
      'weight',    w.weight,
      'rop_area',  COALESCE(w.rop_area, ''),
      'total',     total,
      'ativos',    ativos,
      'vencidos',  overdue,
      'pendentes', pending
    )), '[]'::json)
  )
  FROM (
    SELECT categoria,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'ativo')::int AS ativos,
      COUNT(*) FILTER (WHERE status = 'ativo' AND proxima_revisao < now())::int AS overdue,
      COUNT(*) FILTER (WHERE status = 'pendente')::int AS pending,
      CASE
        WHEN COUNT(*) = 0 THEN NULL
        ELSE GREATEST(0, LEAST(100,
          100 - (COUNT(*) FILTER (WHERE status = 'ativo' AND proxima_revisao < now()) * 10)
              - (COUNT(*) FILTER (WHERE status = 'pendente') * 5)
        ))
      END AS cat_score
    FROM documentos
    WHERE deleted_at IS NULL
    GROUP BY categoria
  ) sub
  INNER JOIN public.qmentum_category_weights w ON w.categoria = sub.categoria;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.rpc_compliance_score_qmentum() IS
  'Score QMENTUM ponderado. v3.72.1: INNER JOIN para descartar categorias
   desconhecidas (alinhado com computeQmentumScore JS).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. bulk_import_jobs: DELETE policy admin-only
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS bulk_import_jobs_admin_delete ON public.bulk_import_jobs;
CREATE POLICY bulk_import_jobs_admin_delete
  ON public.bulk_import_jobs
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. retention_policies: seed prontuarios (CFM 1.821/2007 — permanente)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.retention_policies (categoria, retention_years, base_legal, descricao)
VALUES (
  'prontuarios',
  -1,  -- -1 = retenção indefinida (não arquiva)
  'CFM 1.821/2007',
  'Prontuários médicos digitais — retenção permanente.'
)
ON CONFLICT (categoria) DO NOTHING;

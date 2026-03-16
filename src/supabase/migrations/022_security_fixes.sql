-- ==========================================================================
-- 022_security_fixes.sql — Security hardening for production
-- Consolidates: B4, R1, R2, R3, R4, R7, R8, and updated_by columns
-- ==========================================================================

-- ──────────────────────────────────────────────
-- B4: Enable RLS on saesp_pdf (if table exists)
-- ──────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'saesp_pdf') THEN
    ALTER TABLE saesp_pdf ENABLE ROW LEVEL SECURITY;
    -- Drop policy if exists, then create
    BEGIN
      DROP POLICY IF EXISTS "saesp_select_auth" ON saesp_pdf;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    CREATE POLICY "saesp_select_auth" ON saesp_pdf
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- ──────────────────────────────────────────────
-- R1: Remove anon SELECT policy on incidentes
-- (Use rpc_fetch_by_tracking_code instead)
-- ──────────────────────────────────────────────

DROP POLICY IF EXISTS "inc_select_anon_tracking" ON incidentes;

-- ──────────────────────────────────────────────
-- R2: Add SET search_path = '' to all SECURITY DEFINER functions
-- ──────────────────────────────────────────────

-- 1. firebase_uid()
CREATE OR REPLACE FUNCTION public.firebase_uid() RETURNS text AS $$
BEGIN
  RETURN coalesce(
    current_setting('request.jwt.claims', true)::json->>'sub',
    current_setting('request.jwt.claims', true)::json->>'user_id'
  );
END;
$$ LANGUAGE plpgsql STABLE SET search_path = '';

-- 2. is_admin()
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.admin_users WHERE firebase_uid = public.firebase_uid());
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

-- 3. rpc_compliance_score_qmentum()
CREATE OR REPLACE FUNCTION rpc_compliance_score_qmentum()
RETURNS json AS $$
  select json_build_object(
    'score', coalesce(round(
      sum(cat_score * weight) / nullif(sum(weight), 0)
    ), 100),
    'categories', coalesce(json_agg(json_build_object(
      'categoria', categoria, 'score', cat_score,
      'weight', weight, 'total', total,
      'ativos', ativos, 'vencidos', overdue, 'pendentes', pending
    )), '[]'::json)
  )
  from (
    select categoria,
      count(*) as total,
      count(*) filter (where status='ativo') as ativos,
      count(*) filter (where status='ativo' and proxima_revisao < now()) as overdue,
      count(*) filter (where status='pendente') as pending,
      case categoria
        when 'auditorias' then 1.5 when 'etica' then 1.2
        when 'comites' then 1.0 when 'biblioteca' then 1.0
        when 'relatorios' then 0.8 when 'financeiro' then 0.8 else 1.0
      end as weight,
      greatest(0, least(100,
        100 - (count(*) filter (where status='ativo' and proxima_revisao < now()) * 10)
            - (count(*) filter (where status='pendente') * 5)
      )) as cat_score
    from public.documentos group by categoria
  ) sub;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '';

-- 4. rpc_search_documentos()
CREATE OR REPLACE FUNCTION rpc_search_documentos(
  search_query text,
  filter_categoria text default null,
  filter_status text default null,
  result_limit integer default 50
) RETURNS setof documentos AS $$
  select d.* from public.documentos d
  where (filter_categoria is null or d.categoria = filter_categoria)
    and (filter_status is null or d.status = filter_status)
    and (d.fts @@ plainto_tsquery('portuguese', search_query)
      or d.titulo ilike '%' || search_query || '%'
      or d.codigo ilike '%' || search_query || '%')
  order by ts_rank(d.fts, plainto_tsquery('portuguese', search_query)) desc,
    d.updated_at desc
  limit result_limit;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '';

-- 5. rpc_log_document_action()
CREATE OR REPLACE FUNCTION rpc_log_document_action(
  p_documento_id text,
  p_action text,
  p_user_id text,
  p_user_name text,
  p_user_email text default null,
  p_changes jsonb default '{}',
  p_comment text default ''
) RETURNS uuid AS $$
DECLARE log_id uuid;
BEGIN
  INSERT INTO public.documento_changelog
    (documento_id, action, user_id, user_name, user_email, changes, comment)
  VALUES (p_documento_id, p_action, p_user_id, p_user_name, p_user_email, p_changes, p_comment)
  RETURNING id INTO log_id;
  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 6. rpc_fetch_by_tracking_code()
CREATE OR REPLACE FUNCTION rpc_fetch_by_tracking_code(p_tracking_code text)
RETURNS json AS $$
  select row_to_json(t) from (
    select
      id, protocolo, tracking_code, status, tipo,
      incidente_data, impacto, created_at, updated_at,
      admin_data->>'parecer' as parecer,
      gestao_interna->>'acaoCorretiva' as acao_corretiva
    from public.incidentes
    where tracking_code = p_tracking_code
  ) t;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '';

-- 7. rpc_anonimizar_incidente()
CREATE OR REPLACE FUNCTION rpc_anonimizar_incidente(p_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.incidentes SET
    user_id = null,
    notificante = '{"tipoIdentificacao":"anonimo"}'::jsonb,
    denunciante = '{"tipoIdentificacao":"anonimo"}'::jsonb,
    anonymized_at = now()
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ──────────────────────────────────────────────
-- R3: Restrict relatorios_qualidade INSERT to admins
-- ──────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'relatorios_qualidade') THEN
    DROP POLICY IF EXISTS "auth_insert_relatorios" ON relatorios_qualidade;
    CREATE POLICY "admin_insert_relatorios" ON relatorios_qualidade
      FOR INSERT TO authenticated WITH CHECK (public.is_admin());
  END IF;
END $$;

-- ──────────────────────────────────────────────
-- R4: RPC for authorized email check (signup gate)
-- ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_is_email_authorized(p_email text)
RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM public.authorized_emails WHERE email = lower(p_email));
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '';

GRANT EXECUTE ON FUNCTION public.rpc_is_email_authorized(text) TO anon;
GRANT EXECUTE ON FUNCTION public.rpc_is_email_authorized(text) TO authenticated;

-- ──────────────────────────────────────────────
-- R7: Standardize policies to use firebase_uid()
-- Replace auth.uid()::text with public.firebase_uid()
-- ──────────────────────────────────────────────

-- profiles
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.firebase_uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE TO authenticated
  USING (public.firebase_uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "profiles_delete" ON profiles;
CREATE POLICY "profiles_delete" ON profiles
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- authorized_emails
DROP POLICY IF EXISTS "auth_emails_insert" ON authorized_emails;
CREATE POLICY "auth_emails_insert" ON authorized_emails
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "auth_emails_delete" ON authorized_emails;
CREATE POLICY "auth_emails_delete" ON authorized_emails
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- incident_notification_settings
DROP POLICY IF EXISTS "inc_notif_insert" ON incident_notification_settings;
CREATE POLICY "inc_notif_insert" ON incident_notification_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.firebase_uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "inc_notif_update" ON incident_notification_settings;
CREATE POLICY "inc_notif_update" ON incident_notification_settings
  FOR UPDATE TO authenticated
  USING (public.firebase_uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "inc_notif_delete" ON incident_notification_settings;
CREATE POLICY "inc_notif_delete" ON incident_notification_settings
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- comunicados
DROP POLICY IF EXISTS "comunicados_insert" ON comunicados;
CREATE POLICY "comunicados_insert" ON comunicados
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "comunicados_update" ON comunicados;
CREATE POLICY "comunicados_update" ON comunicados
  FOR UPDATE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "comunicados_delete" ON comunicados;
CREATE POLICY "comunicados_delete" ON comunicados
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- comunicado_confirmacoes
DROP POLICY IF EXISTS "com_conf_insert" ON comunicado_confirmacoes;
CREATE POLICY "com_conf_insert" ON comunicado_confirmacoes
  FOR INSERT TO authenticated
  WITH CHECK (public.firebase_uid() = user_id);

-- comunicado_acoes_completadas
DROP POLICY IF EXISTS "com_acoes_insert" ON comunicado_acoes_completadas;
CREATE POLICY "com_acoes_insert" ON comunicado_acoes_completadas
  FOR INSERT TO authenticated
  WITH CHECK (public.firebase_uid() = user_id);

-- ──────────────────────────────────────────────
-- R8: Restrict auditoria_templates INSERT to admins
-- ──────────────────────────────────────────────

DROP POLICY IF EXISTS "at_insert_auth" ON auditoria_templates;
CREATE POLICY "at_insert_admin" ON auditoria_templates
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

-- ──────────────────────────────────────────────
-- Add updated_by columns to incidentes (for R5)
-- ──────────────────────────────────────────────

ALTER TABLE incidentes ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE incidentes ADD COLUMN IF NOT EXISTS updated_by_name TEXT;

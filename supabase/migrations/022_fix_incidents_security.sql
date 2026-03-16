-- ==========================================================================
-- 022_fix_incidents_security.sql — Security fixes and RPC update
-- Fixes: CRITICAL 1 (RLS), CRITICAL 2 (columns), ALTO 7 + BAIXO 12 (RPC)
-- ==========================================================================

-- CRITICAL 1: Drop policy that exposes all incidents to anon users.
-- The trigger generate_tracking_code() sets tracking_code for ALL records,
-- so this policy allows ANY anon user to read ALL incidents via direct query.
-- The RPC rpc_fetch_by_tracking_code is SECURITY DEFINER and bypasses RLS,
-- making it the only safe path for anonymous tracking lookups.
DROP POLICY IF EXISTS "inc_select_anon_tracking" ON incidentes;

-- CRITICAL 2: Add missing columns used by updateStatus/updateAdminData/updateGestaoInterna.
-- Without these, all update operations that set updated_by fail with column-not-found.
ALTER TABLE incidentes ADD COLUMN IF NOT EXISTS updated_by text;
ALTER TABLE incidentes ADD COLUMN IF NOT EXISTS updated_by_name text;

-- FIX: Status constraint mismatch — DB had Portuguese values, UI uses English.
-- Accept both sets during transition, then migrate existing data to English.
ALTER TABLE incidentes DROP CONSTRAINT IF EXISTS incidentes_status_check;
ALTER TABLE incidentes ADD CONSTRAINT incidentes_status_check
  CHECK (status IN (
    'pendente','em_analise','em_andamento','resolvido','encerrado','arquivado',
    'pending','in_review','investigating','action_required','resolved','closed'
  ));

-- Migrate existing Portuguese status values to English keys matching STATUS_CONFIG
UPDATE incidentes SET status = CASE status
  WHEN 'pendente' THEN 'pending'
  WHEN 'em_analise' THEN 'in_review'
  WHEN 'em_andamento' THEN 'investigating'
  WHEN 'resolvido' THEN 'resolved'
  WHEN 'encerrado' THEN 'closed'
  WHEN 'arquivado' THEN 'closed'
  ELSE status
END WHERE status IN ('pendente','em_analise','em_andamento','resolvido','encerrado','arquivado');

-- Update default to English
ALTER TABLE incidentes ALTER COLUMN status SET DEFAULT 'pending';

-- ALTO 7 + BAIXO 12: Replace RPC to return only specific fields for anonymous tracking.
-- Old version returned full incidente_data and impacto JSONB, exposing internal details.
-- New version returns only what the anonymous relator needs: status, feedback, history.
CREATE OR REPLACE FUNCTION rpc_fetch_by_tracking_code(p_tracking_code text)
RETURNS json AS $$
  SELECT row_to_json(t) FROM (
    SELECT
      id, protocolo, tracking_code, status, tipo,
      created_at, updated_at,
      incidente_data->>'tipo' as incidente_tipo,
      incidente_data->>'descricao' as incidente_resumo,
      denuncia_data->>'titulo' as denuncia_titulo,
      denuncia_data->>'tipo' as denuncia_tipo,
      gestao_interna->>'feedbackAoRelator' as feedback_ao_relator,
      gestao_interna->'historicoStatus' as historico_status,
      gestao_interna->>'ultimaAtualizacao' as ultima_atualizacao,
      admin_data->>'parecer' as parecer
    FROM incidentes
    WHERE tracking_code = p_tracking_code
  ) t;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

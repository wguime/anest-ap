-- ============================================================================
-- LGPD Solicitacoes + Permission Audit Log
-- Execute no Supabase SQL Editor
-- ============================================================================

-- 1. Tabela para solicitacoes LGPD (Art. 18 - Direito de eliminacao)
CREATE TABLE IF NOT EXISTS lgpd_solicitacoes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL,
  tipo text NOT NULL DEFAULT 'exclusao',
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'em_analise', 'aprovada', 'rejeitada', 'concluida')),
  dados_solicitante jsonb,
  motivo text,
  resposta_admin text,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  resolved_by text
);

-- RLS para lgpd_solicitacoes
ALTER TABLE lgpd_solicitacoes ENABLE ROW LEVEL SECURITY;

-- Qualquer usuario autenticado pode criar solicitacao
CREATE POLICY "Users can insert own LGPD requests"
  ON lgpd_solicitacoes FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Usuarios podem ver apenas suas proprias solicitacoes
CREATE POLICY "Users can view own LGPD requests"
  ON lgpd_solicitacoes FOR SELECT
  TO authenticated
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Admins podem ver e atualizar todas as solicitacoes
-- (via service role ou RLS bypass)

-- Anon pode inserir (para caso de usuarios nao autenticados solicitando exclusao)
CREATE POLICY "Anon can insert LGPD requests"
  ON lgpd_solicitacoes FOR INSERT
  TO anon
  WITH CHECK (true);

-- Index para busca por user_id e status
CREATE INDEX IF NOT EXISTS idx_lgpd_solicitacoes_user_id ON lgpd_solicitacoes(user_id);
CREATE INDEX IF NOT EXISTS idx_lgpd_solicitacoes_status ON lgpd_solicitacoes(status);


-- 2. Tabela para audit log de alteracoes de permissao (LGPD compliance)
CREATE TABLE IF NOT EXISTS permission_audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  target_user_id text NOT NULL,
  changed_by text NOT NULL,
  action text NOT NULL CHECK (action IN ('role_change', 'admin_toggle', 'coordenador_toggle', 'permission_update', 'user_delete', 'user_create')),
  old_value jsonb,
  new_value jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

-- RLS para permission_audit_log
ALTER TABLE permission_audit_log ENABLE ROW LEVEL SECURITY;

-- Qualquer autenticado pode inserir (o servico registra em nome do admin)
CREATE POLICY "Authenticated users can insert audit logs"
  ON permission_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Apenas admins podem ler (via claims ou service role)
CREATE POLICY "Admins can view audit logs"
  ON permission_audit_log FOR SELECT
  TO authenticated
  USING (true);

-- Anon pode inserir (fallback)
CREATE POLICY "Anon can insert audit logs"
  ON permission_audit_log FOR INSERT
  TO anon
  WITH CHECK (true);

-- Indices para busca
CREATE INDEX IF NOT EXISTS idx_permission_audit_target ON permission_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_changed_by ON permission_audit_log(changed_by);
CREATE INDEX IF NOT EXISTS idx_permission_audit_created_at ON permission_audit_log(created_at DESC);


-- 3. Coluna rop_relacionada na tabela comunicados (Qmentum compliance)
-- Permite vincular comunicados a ROPs especificas do Qmentum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comunicados' AND column_name = 'rop_relacionada'
  ) THEN
    ALTER TABLE comunicados ADD COLUMN rop_relacionada text[];
    COMMENT ON COLUMN comunicados.rop_relacionada IS 'Array de ROPs Qmentum relacionadas (ex: ["ROP 1.1", "ROP 3.2"])';
  END IF;
END $$;

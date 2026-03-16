-- Migration 013: Autoavaliacao ROP table
-- Autoavaliacao trimestral de ROPs (Praticas Organizacionais Obrigatorias) Qmentum

CREATE TABLE autoavaliacao_rop (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rop_id TEXT NOT NULL,
  rop_area TEXT NOT NULL,
  ciclo TEXT NOT NULL,
  status TEXT DEFAULT 'nao_avaliado',
  evidencias JSONB DEFAULT '[]',
  observacoes TEXT,
  responsavel_id TEXT,
  responsavel_nome TEXT,
  avaliado_em TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(rop_id, ciclo)
);

-- Trigger updated_at (function exists from 001_schema.sql)
CREATE TRIGGER tr_autoavaliacao_rop_updated_at
  BEFORE UPDATE ON autoavaliacao_rop
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_autoavaliacao_rop_area ON autoavaliacao_rop(rop_area);
CREATE INDEX idx_autoavaliacao_rop_ciclo ON autoavaliacao_rop(ciclo);
CREATE INDEX idx_autoavaliacao_rop_status ON autoavaliacao_rop(status);
CREATE INDEX idx_autoavaliacao_rop_created_by ON autoavaliacao_rop(created_by);

-- RLS
ALTER TABLE autoavaliacao_rop ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autoav_select_auth" ON autoavaliacao_rop
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "autoav_insert_auth" ON autoavaliacao_rop
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "autoav_update_admin_owner" ON autoavaliacao_rop
  FOR UPDATE TO authenticated
  USING (is_admin() OR created_by = firebase_uid());

CREATE POLICY "autoav_delete_admin" ON autoavaliacao_rop
  FOR DELETE TO authenticated USING (is_admin());

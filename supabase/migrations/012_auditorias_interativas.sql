-- Migration 012: Auditorias Interativas (Templates + Execucoes)
-- Sistema de auditorias interativas com checklist, scoring e vinculacao a planos de acao

-- ============================================================================
-- TABELA: auditoria_templates
-- ============================================================================

CREATE TABLE auditoria_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  versao INT DEFAULT 1,
  items JSONB NOT NULL DEFAULT '[]',
  ativo BOOLEAN DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger updated_at (function exists from 001_schema.sql)
CREATE TRIGGER tr_auditoria_templates_updated_at
  BEFORE UPDATE ON auditoria_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_auditoria_templates_tipo ON auditoria_templates(tipo);

-- RLS
ALTER TABLE auditoria_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "at_select_auth" ON auditoria_templates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "at_insert_auth" ON auditoria_templates
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "at_update_admin_owner" ON auditoria_templates
  FOR UPDATE TO authenticated
  USING (is_admin() OR created_by = firebase_uid());

CREATE POLICY "at_delete_admin" ON auditoria_templates
  FOR DELETE TO authenticated USING (is_admin());

-- ============================================================================
-- TABELA: auditoria_execucoes
-- ============================================================================

CREATE TABLE auditoria_execucoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES auditoria_templates(id),
  template_tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  auditor_id TEXT,
  auditor_nome TEXT,
  setor_id TEXT,
  setor_nome TEXT,
  data_auditoria DATE,
  status TEXT DEFAULT 'rascunho',
  respostas JSONB DEFAULT '{}',
  score_conformidade NUMERIC,
  observacoes_gerais TEXT,
  evidencias JSONB DEFAULT '[]',
  planos_acao_ids TEXT[] DEFAULT '{}',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  concluido_em TIMESTAMPTZ
);

-- Trigger updated_at (function exists from 001_schema.sql)
CREATE TRIGGER tr_auditoria_execucoes_updated_at
  BEFORE UPDATE ON auditoria_execucoes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_auditoria_execucoes_template_tipo ON auditoria_execucoes(template_tipo);
CREATE INDEX idx_auditoria_execucoes_status ON auditoria_execucoes(status);
CREATE INDEX idx_auditoria_execucoes_data ON auditoria_execucoes(data_auditoria);
CREATE INDEX idx_auditoria_execucoes_created_by ON auditoria_execucoes(created_by);

-- RLS
ALTER TABLE auditoria_execucoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ae_select_auth" ON auditoria_execucoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ae_insert_auth" ON auditoria_execucoes
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "ae_update_admin_owner" ON auditoria_execucoes
  FOR UPDATE TO authenticated
  USING (is_admin() OR created_by = firebase_uid());

CREATE POLICY "ae_delete_admin" ON auditoria_execucoes
  FOR DELETE TO authenticated USING (is_admin());

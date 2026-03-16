-- Migration 010: Planos de Acao (PDCA) table
-- Gestao de acoes corretivas vinculadas a incidentes, auditorias e nao-conformidades

CREATE TABLE planos_acao (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo_origem TEXT NOT NULL,        -- 'incidente','auditoria','nao_conformidade','manual'
  origem_id TEXT,                    -- FK logica
  origem_descricao TEXT,
  status TEXT DEFAULT 'planejamento', -- planejamento, execucao, verificacao, padronizacao, concluido, cancelado
  fase_pdca TEXT DEFAULT 'plan',     -- plan, do, check, act
  responsavel_id TEXT,
  responsavel_nome TEXT,
  prazo DATE,
  prioridade TEXT DEFAULT 'media',   -- baixa, media, alta, urgente
  eficacia TEXT,                     -- eficaz, parcialmente_eficaz, ineficaz
  evidencias JSONB DEFAULT '[]',
  historico JSONB DEFAULT '[]',
  tags TEXT[],
  created_by TEXT NOT NULL,
  created_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger updated_at (function exists from 001_schema.sql)
CREATE TRIGGER tr_planos_acao_updated_at
  BEFORE UPDATE ON planos_acao
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_planos_acao_origem ON planos_acao(tipo_origem, origem_id);
CREATE INDEX idx_planos_acao_status ON planos_acao(status);
CREATE INDEX idx_planos_acao_prazo ON planos_acao(prazo);
CREATE INDEX idx_planos_acao_created_by ON planos_acao(created_by);

-- RLS
ALTER TABLE planos_acao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pa_select_auth" ON planos_acao
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "pa_insert_auth" ON planos_acao
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "pa_update_admin_owner" ON planos_acao
  FOR UPDATE TO authenticated
  USING (is_admin() OR created_by = firebase_uid());

CREATE POLICY "pa_delete_admin" ON planos_acao
  FOR DELETE TO authenticated USING (is_admin());

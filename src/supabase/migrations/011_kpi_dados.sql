-- Migration 011: KPI Dados Mensais
-- Alimentacao real dos 21 indicadores de qualidade com validacao

CREATE TABLE kpi_dados_mensais (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  indicador_id TEXT NOT NULL,         -- match com indicadores-2025.js IDs
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
  valor NUMERIC,
  numerador INTEGER,
  denominador INTEGER,
  observacao TEXT,
  fonte TEXT,
  coletado_por TEXT,
  coletado_por_nome TEXT,
  validado BOOLEAN DEFAULT false,
  validado_por TEXT,
  validado_por_nome TEXT,
  validado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(indicador_id, ano, mes)
);

-- Trigger
CREATE TRIGGER tr_kpi_dados_updated_at
  BEFORE UPDATE ON kpi_dados_mensais
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_kpi_dados_indicador ON kpi_dados_mensais(indicador_id);
CREATE INDEX idx_kpi_dados_periodo ON kpi_dados_mensais(ano, mes);

-- RLS
ALTER TABLE kpi_dados_mensais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kpi_select_auth" ON kpi_dados_mensais
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "kpi_insert_admin" ON kpi_dados_mensais
  FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY "kpi_update_admin" ON kpi_dados_mensais
  FOR UPDATE TO authenticated USING (is_admin());

CREATE POLICY "kpi_delete_admin" ON kpi_dados_mensais
  FOR DELETE TO authenticated USING (is_admin());

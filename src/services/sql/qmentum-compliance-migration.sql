-- Qmentum Compliance Migration
-- Issues 19, 20, 21

-- Issue 20: Dimension-KPI reference table
CREATE TABLE IF NOT EXISTS public.dimensao_kpi (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  cor TEXT NOT NULL
);

INSERT INTO public.dimensao_kpi (id, label, cor) VALUES
  ('seguranca', 'Segurança do Paciente', '#DC2626'),
  ('efetividade', 'Efetividade Clínica', '#3B82F6'),
  ('eficiencia', 'Eficiência Operacional', '#059669'),
  ('atencao_centrada', 'Atenção Centrada no Paciente', '#8B5CF6'),
  ('vida_profissional', 'Vida Profissional', '#F59E0B')
ON CONFLICT (id) DO NOTHING;

-- Issue 19: Quality reports audit table
CREATE TABLE IF NOT EXISTS public.relatorios_qualidade (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL DEFAULT 'qualidade_report',
  ciclo TEXT NOT NULL,
  score_geral INTEGER,
  nivel_maturidade TEXT,
  sub_scores JSONB,
  gerado_por TEXT,
  gerado_por_uid TEXT,
  gerado_em TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.relatorios_qualidade ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_relatorios" ON public.relatorios_qualidade
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_relatorios" ON public.relatorios_qualidade
  FOR INSERT TO authenticated WITH CHECK (true);

-- Issue 21: Add dimensao column to KPI monthly data
ALTER TABLE public.kpi_dados_mensais ADD COLUMN IF NOT EXISTS dimensao TEXT;

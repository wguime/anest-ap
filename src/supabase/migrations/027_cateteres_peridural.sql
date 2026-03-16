-- ============================================================================
-- 027: Cateteres Peridural (Epidural Catheter Control)
-- ============================================================================

-- Main table: catheter registration
CREATE TABLE IF NOT EXISTS cateteres_peridural (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Patient/Admin
  paciente TEXT NOT NULL,
  leito TEXT,
  cirurgia TEXT,
  data_cirurgia DATE,
  cirurgiao TEXT,
  anestesista TEXT,
  -- Technical data
  nivel_puncao TEXT,
  tamanho_cpd TEXT,
  marca_cpd TEXT,
  marca_cpd_pele NUMERIC,
  marca_cpd_dentro NUMERIC,
  -- Intraoperative
  doses_transoperatorias TEXT,
  repique_srpa TEXT,
  -- Complications
  complicacoes TEXT,
  -- Status
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'retirado')),
  data_retirada TIMESTAMPTZ,
  motivo_retirada TEXT,
  data_insercao TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Audit
  created_by TEXT,
  created_by_name TEXT,
  updated_by TEXT,
  updated_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Follow-up table: daily PO evaluations
CREATE TABLE IF NOT EXISTS cateteres_peridural_followup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cateter_id UUID NOT NULL REFERENCES cateteres_peridural(id) ON DELETE CASCADE,
  dia_po INTEGER NOT NULL,
  plano_dia TEXT,
  sitio_insercao TEXT,
  bromage_score INTEGER CHECK (bromage_score >= 0 AND bromage_score <= 3),
  nivel_sensitivo TEXT,
  marca_pele_atual NUMERIC,
  taxa_infusao TEXT,
  complicacoes TEXT,
  observacoes TEXT,
  -- Audit
  avaliado_por TEXT,
  avaliado_por_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Unique constraint: one evaluation per PO day per catheter
  UNIQUE(cateter_id, dia_po)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cateteres_peridural_status ON cateteres_peridural(status);
CREATE INDEX IF NOT EXISTS idx_cateteres_peridural_created_at ON cateteres_peridural(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cateteres_followup_cateter ON cateteres_peridural_followup(cateter_id);

-- RLS
ALTER TABLE cateteres_peridural ENABLE ROW LEVEL SECURITY;
ALTER TABLE cateteres_peridural_followup ENABLE ROW LEVEL SECURITY;

-- Policies for cateteres_peridural
CREATE POLICY "cateteres_peridural_select" ON cateteres_peridural
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "cateteres_peridural_insert" ON cateteres_peridural
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "cateteres_peridural_update" ON cateteres_peridural
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Policies for followup
CREATE POLICY "cateteres_followup_select" ON cateteres_peridural_followup
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "cateteres_followup_insert" ON cateteres_peridural_followup
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "cateteres_followup_update" ON cateteres_peridural_followup
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

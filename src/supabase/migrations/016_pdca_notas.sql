-- Migration 016: PDCA phase-specific notes columns
-- Campos para documentacao de cada fase do ciclo PDCA nos planos de acao

ALTER TABLE planos_acao ADD COLUMN IF NOT EXISTS plan_analise TEXT;
ALTER TABLE planos_acao ADD COLUMN IF NOT EXISTS plan_acoes TEXT;
ALTER TABLE planos_acao ADD COLUMN IF NOT EXISTS do_notas TEXT;
ALTER TABLE planos_acao ADD COLUMN IF NOT EXISTS check_resultados TEXT;
ALTER TABLE planos_acao ADD COLUMN IF NOT EXISTS act_padronizacao TEXT;

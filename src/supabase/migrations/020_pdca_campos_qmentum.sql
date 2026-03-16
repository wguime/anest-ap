-- 020: Campos PDCA Qmentum (5W2H, percentual, meta atingida, decisao, licoes)
ALTER TABLE planos_acao ADD COLUMN IF NOT EXISTS plan_o_que TEXT;
ALTER TABLE planos_acao ADD COLUMN IF NOT EXISTS plan_porque TEXT;
ALTER TABLE planos_acao ADD COLUMN IF NOT EXISTS plan_onde TEXT;
ALTER TABLE planos_acao ADD COLUMN IF NOT EXISTS plan_como TEXT;
ALTER TABLE planos_acao ADD COLUMN IF NOT EXISTS plan_quanto TEXT;
ALTER TABLE planos_acao ADD COLUMN IF NOT EXISTS plan_meta TEXT;
ALTER TABLE planos_acao ADD COLUMN IF NOT EXISTS plan_indicador TEXT;
ALTER TABLE planos_acao ADD COLUMN IF NOT EXISTS do_percentual TEXT;
ALTER TABLE planos_acao ADD COLUMN IF NOT EXISTS do_dificuldades TEXT;
ALTER TABLE planos_acao ADD COLUMN IF NOT EXISTS check_meta_atingida TEXT;
ALTER TABLE planos_acao ADD COLUMN IF NOT EXISTS check_analise TEXT;
ALTER TABLE planos_acao ADD COLUMN IF NOT EXISTS act_decisao TEXT;
ALTER TABLE planos_acao ADD COLUMN IF NOT EXISTS act_licoes_aprendidas TEXT;

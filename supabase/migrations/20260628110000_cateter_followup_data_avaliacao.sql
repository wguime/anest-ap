-- ════════════════════════════════════════════════════════════════════════
-- 20260628110000_cateter_followup_data_avaliacao.sql
-- Cateter Peridural — evolução PO por DATA (não mais sequencial cega)
--
-- Motivo: o mesmo cateter pode ser avaliado mais de uma vez no mesmo dia, e
-- dias podem ser pulados. dia_po deixa de ser max+1 (contagem de avaliações)
-- e passa a ser DERIVADO da data da avaliação no app (lib src/lib/cateterPo.js).
--
-- Mudanças:
--   1. data_avaliacao TIMESTAMPTZ — data clínica da avaliação (backfill de
--      created_at nas linhas existentes; NOT NULL com default now()).
--   2. DROP da UNIQUE(cateter_id, dia_po) — agora N avaliações podem compartilhar
--      o mesmo dia_po (mesmo dia / dias repetidos por correção). A unicidade
--      lógica deixa de existir; a ordenação cronológica é por data_avaliacao.
--   3. updated_by / updated_by_name — audit trail de quem editou uma evolução
--      (updateFollowup passa a registrar o editor; antes não rastreava).
--   4. Índice (cateter_id, data_avaliacao) para a listagem ordenada.
--
-- Idempotente (IF EXISTS / IF NOT EXISTS). Rollback: recriar a UNIQUE só é
-- seguro se não houver dia_po repetido — após o uso da feature pode haver, então
-- o rollback real é manter a coluna e a ausência da constraint.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. data_avaliacao
ALTER TABLE public.cateteres_peridural_followup
  ADD COLUMN IF NOT EXISTS data_avaliacao TIMESTAMPTZ;

UPDATE public.cateteres_peridural_followup
  SET data_avaliacao = created_at
  WHERE data_avaliacao IS NULL;

ALTER TABLE public.cateteres_peridural_followup
  ALTER COLUMN data_avaliacao SET DEFAULT now();

ALTER TABLE public.cateteres_peridural_followup
  ALTER COLUMN data_avaliacao SET NOT NULL;

-- 2. Remover a UNIQUE(cateter_id, dia_po) — múltiplas avaliações por dia
ALTER TABLE public.cateteres_peridural_followup
  DROP CONSTRAINT IF EXISTS cateteres_peridural_followup_cateter_id_dia_po_key;

-- 3. Audit do editor da evolução
ALTER TABLE public.cateteres_peridural_followup
  ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE public.cateteres_peridural_followup
  ADD COLUMN IF NOT EXISTS updated_by_name TEXT;

-- 4. Índice para ordenação cronológica da listagem de evoluções
CREATE INDEX IF NOT EXISTS idx_cateteres_followup_data_avaliacao
  ON public.cateteres_peridural_followup(cateter_id, data_avaliacao);

COMMIT;

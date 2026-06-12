-- ════════════════════════════════════════════════════════════════════════
-- 20260628120000_cateter_residente_consolidacao.sql
-- Consolidação de drift — espelha src/supabase/migrations/029_cateter_residente.sql
-- no diretório canônico supabase/migrations/.
--
-- A 029 do cateter vivia apenas em src/supabase/migrations/ (o número 029 em
-- supabase/migrations/ é outro assunto). Estas colunas JÁ ESTÃO em produção;
-- este arquivo só passa a refletir o estado no diretório canônico. Por isso
-- todo ADD usa IF NOT EXISTS — re-rodar é no-op, nada é reaplicado de forma
-- destrutiva. NÃO precisa ser aplicado se a 029 já rodou (é o caso).
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- Coluna residente na tabela principal (quem inseriu como residente, apenas HRO)
ALTER TABLE public.cateteres_peridural
  ADD COLUMN IF NOT EXISTS residente TEXT;

-- Colunas anestesista/residente na tabela de followup (evolução PO)
ALTER TABLE public.cateteres_peridural_followup
  ADD COLUMN IF NOT EXISTS anestesista_nome TEXT;
ALTER TABLE public.cateteres_peridural_followup
  ADD COLUMN IF NOT EXISTS residente_nome TEXT;

COMMIT;

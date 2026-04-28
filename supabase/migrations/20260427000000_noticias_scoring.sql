-- ============================================================================
-- Schema gap fix + scoring heurístico semanal para Publicações.
--
-- O service `supabaseNoticiasService.js` faz query de colunas que não existem
-- na tabela `noticias` (titulo_pt, category, final_score, is_featured, oa_pdf_url
-- etc.). PostgREST devolve null para todos. Esta migration:
--   • adiciona as colunas
--   • implementa `categorize_noticia()` (12 temas de anestesiologia por keywords)
--   • implementa `recompute_noticias_scores()` (heurística semanal de destaques)
--   • registra cron semanal que executa o recompute toda segunda 04:00 BRT
-- ============================================================================

-- 1. Colunas que o service espera (NULLABLE, sem default destrutivo)
--    NB: a tabela já tem coluna `categoria` (origem editorial: pesquisa/sociedade).
--    Adicionamos `category` separado para os 12 temas de anestesiologia
--    (Via Aérea, Dor, Cardiovascular etc.) — campo populado por keyword
--    matching automático no fetch + backfill SQL.
ALTER TABLE public.noticias
  ADD COLUMN IF NOT EXISTS titulo_pt         text,
  ADD COLUMN IF NOT EXISTS resumo_pt         text,
  ADD COLUMN IF NOT EXISTS article_type      text,
  ADD COLUMN IF NOT EXISTS category          text,
  ADD COLUMN IF NOT EXISTS is_open_access    boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS oa_pdf_url        text,
  ADD COLUMN IF NOT EXISTS pmc_id            text,
  ADD COLUMN IF NOT EXISTS pmid              text,
  ADD COLUMN IF NOT EXISTS journal_issn      text,
  ADD COLUMN IF NOT EXISTS mesh_terms        text[],
  ADD COLUMN IF NOT EXISTS final_score       numeric(6,4),
  ADD COLUMN IF NOT EXISTS is_featured       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS scores_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS noticias_category_idx
  ON public.noticias (category);

CREATE INDEX IF NOT EXISTS noticias_final_score_idx
  ON public.noticias (final_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS noticias_is_featured_idx
  ON public.noticias (is_featured) WHERE is_featured;

-- 2. Categorização automática por keywords (12 temas de anestesiologia)
--    Aplicada no backfill (artigos existentes) e via Edge Function (novos).
--    Estratégia: match no titulo+resumo, prioriza tema mais específico,
--    fallback "Perioperatório" para artigos genéricos não-classificados
--    (mantém categoria viva e garante volume mínimo de 15 artigos).
CREATE OR REPLACE FUNCTION public.categorize_noticia(p_titulo text, p_resumo text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_text text := lower(coalesce(p_titulo, '') || ' ' || coalesce(p_resumo, ''));
BEGIN
  -- Ordem importa: temas específicos antes de gerais.
  IF v_text ~ '(via.?a[ée]rea|airway|intubat|laringoscop|laryngoscop|supraglott|extubat|ventila[çc][ãa]o.{0,15}via)' THEN
    RETURN 'Via Aérea';
  ELSIF v_text ~ '(neuroanestes|neurosurg|neurocir|craniotom|brain.{0,20}(surg|anesth)|cerebral|spinal.{0,15}cord|n[eê]rvo.{0,15}central)' THEN
    RETURN 'Neuroanestesia';
  ELSIF v_text ~ '(obstetr[ií]c|labor analges|cesarean|ces[áa]rea|parturient|parto|gestant|pregnan)' THEN
    RETURN 'Obstetrícia';
  ELSIF v_text ~ '(pediatr|neonat|infant|child|criança|crianças|rec[ée]m.?nascido|p[ée]dia|peadiatric)' THEN
    RETURN 'Pediatria';
  ELSIF v_text ~ '(intensive care|terapia intensiva|UTI\W|ICU\W|critical care|sepsis|sepse|mechanical ventil|ventila[çc][ãa]o mec)' THEN
    RETURN 'Terapia Intensiva';
  ELSIF v_text ~ '(cardiac.{0,15}(anesth|surg)|cardiovascul|cardiopul|hemodyn|hemodin[âa]m|coronar|valvul|ecocardiograf|echocardiograph)' THEN
    RETURN 'Cardiovascular';
  ELSIF v_text ~ '(regional anesth|peripheral.{0,15}block|nerve block|bloqueio.{0,15}(perif[ée]r|nervo)|ultrasound.?guided|raqui|epidural|peridural|neuraxial|spinal anesth)' THEN
    RETURN 'Anestesia Regional';
  ELSIF v_text ~ '(\Wpain\W|analges|opioid|opi[óo]ide|nocicep|hyperalges|chronic pain|dor cr[ôo]n|dor aguda|dor p[óo]s.?op)' THEN
    RETURN 'Dor';
  ELSIF v_text ~ '(propofol|sevoflur|isoflur|desflur|remifentanil|sufentanil|fentanyl|fentanil|rocuron|cisatrac|ketamin|cetamin|dexmedetomidin|midazolam|pharmacolog|farmacolog|pharmacokinet|farmacocin)' THEN
    RETURN 'Farmacologia';
  ELSIF v_text ~ '(artificial intelligen|machine learning|deep learning|\WAI\W|\WIA\W|neural network|algorithm.{0,30}(predict|diagnos)|automated.{0,15}(monitor|detect)|wearable|tecnologia)' THEN
    RETURN 'Tecnologia e IA';
  ELSIF v_text ~ '(patient safety|seguran[çc]a do paciente|adverse event|evento adverso|medication error|erro de medicac|wrong.?site|near miss|incident report|root cause|complication.{0,15}rate|qualidade.{0,15}assist|quality improvement)' THEN
    RETURN 'Segurança do Paciente';
  ELSIF v_text ~ '(perioperative|perioperat[óo]r|postoperative|p[óo]s.?operat|preoperative|pr[ée].?operat|recovery|enhanced recovery|ERAS|outcomes after|outcome.{0,15}surgery|surgery|cirurgia|cir[úu]rgic)' THEN
    RETURN 'Perioperatório';
  ELSE
    RETURN 'Perioperatório';  -- fallback: a maioria dos artigos cabe aqui
  END IF;
END;
$$;

-- Backfill: classifica todos os artigos existentes
UPDATE public.noticias
SET category = public.categorize_noticia(titulo, resumo)
WHERE category IS NULL;

-- Trigger: classifica automaticamente novos inserts (Edge Function não precisa mudar)
CREATE OR REPLACE FUNCTION public.set_noticia_category()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.category IS NULL THEN
    NEW.category := public.categorize_noticia(NEW.titulo, NEW.resumo);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_noticias_categorize ON public.noticias;
CREATE TRIGGER trg_noticias_categorize
BEFORE INSERT ON public.noticias
FOR EACH ROW
EXECUTE FUNCTION public.set_noticia_category();

-- 3. Função de scoring heurístico (padrão Read by QxMD/DynaMed)
--    final_score ∈ [0, 1]
--      0.40 × recency      (decaimento exponencial, half-life 14 dias)
--      0.25 × article_type (RCT/Meta=1.0, Original=0.8, Review=0.6, Editorial=0.3)
--      0.20 × abstract_qty (resumo > 500 chars = 1.0; 200-500 = 0.5; <200 = 0.2)
--      0.15 × language     (pt-BR = 1.0, en = 0.85)
CREATE OR REPLACE FUNCTION public.recompute_noticias_scores()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now timestamptz := now();
BEGIN
  UPDATE public.noticias n SET
    final_score =
      0.40 * exp(-ln(2) * GREATEST(0, EXTRACT(epoch FROM (v_now - n.publicado_em)) / 86400.0) / 14.0)
    + 0.25 * COALESCE(
        CASE
          WHEN n.article_type ILIKE ANY (ARRAY['%randomized%','%meta-analysis%','%systematic review%']) THEN 1.0
          WHEN n.article_type ILIKE ANY (ARRAY['%original%','%research%','%clinical trial%'])           THEN 0.8
          WHEN n.article_type ILIKE ANY (ARRAY['%review%','%narrative%'])                                THEN 0.6
          WHEN n.article_type ILIKE ANY (ARRAY['%editorial%','%commentary%','%letter%'])                 THEN 0.3
          ELSE 0.5
        END, 0.5)
    + 0.20 * CASE
        WHEN length(COALESCE(n.resumo, '')) >= 500 THEN 1.0
        WHEN length(COALESCE(n.resumo, '')) >= 200 THEN 0.5
        ELSE 0.2
      END
    + 0.15 * CASE WHEN n.idioma = 'pt-BR' THEN 1.0 ELSE 0.85 END,
    scores_updated_at = v_now
  WHERE n.publicado_em > (v_now - interval '90 days');

  -- Reseta destaques anteriores
  UPDATE public.noticias SET is_featured = false
  WHERE is_featured = true;

  -- Marca top 10 da semana como featured
  WITH top10 AS (
    SELECT id FROM public.noticias
    WHERE publicado_em > (v_now - interval '30 days')
    ORDER BY final_score DESC NULLS LAST, publicado_em DESC
    LIMIT 10
  )
  UPDATE public.noticias SET is_featured = true
  WHERE id IN (SELECT id FROM top10);
END;
$$;

GRANT EXECUTE ON FUNCTION public.recompute_noticias_scores() TO service_role;

-- 4. Cron semanal — segunda 07:00 UTC = 04:00 BRT
SELECT cron.schedule(
  'recompute-noticias-weekly',
  '0 7 * * 1',
  $$ SELECT public.recompute_noticias_scores(); $$
);

-- 5. Backfill imediato — popula final_score e is_featured nos artigos atuais
SELECT public.recompute_noticias_scores();

-- Inspeção:
--   SELECT jobid, jobname, schedule, active FROM cron.job
--     WHERE jobname IN ('fetch-noticias-daily', 'recompute-noticias-weekly');
--   SELECT titulo, fonte, category, final_score, is_featured
--     FROM public.noticias ORDER BY final_score DESC NULLS LAST LIMIT 15;
--   SELECT category, count(*) FROM public.noticias GROUP BY category ORDER BY 2 DESC;
--
-- Trigger manual:
--   SELECT public.recompute_noticias_scores();
--
-- Desabilitar cron:
--   SELECT cron.unschedule('recompute-noticias-weekly');

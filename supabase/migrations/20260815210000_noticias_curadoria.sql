-- ============================================================================
-- Curadoria de destaques científicos (pedido do dono 15/08/2026).
--
-- Artigos indicados por um curador ganham destaque FIXO por um período
-- (curadoria_destaque_ate): o carrossel "Destaques Científicos" da Home e os
-- heros "Em destaque" exibem curadoria ativa à frente do ranking heurístico,
-- e o card mostra badge "Curadoria <nome>". O recompute semanal
-- (recompute_noticias_scores, cron seg 04:00 BRT) resetava is_featured de
-- TODOS — sem este patch a curadoria caía do destaque na primeira segunda.
--
-- Também registra a curadoria de 14/08 do Dr. Humberto Hepp (3 artigos,
-- destaque até 14/09/2026):
--   1. POISE-3 TXA em urologia (Eur Urol)   — INSERT (fora dos 4 journals do cron)
--   2. Hipotensão intraop meta-análise (BJA) — já existe via cron, só UPDATE
--   3. Cateter DPIP pós-esternotomia (A&A)   — INSERT
-- ============================================================================

-- 1. Colunas de curadoria
ALTER TABLE public.noticias
  ADD COLUMN IF NOT EXISTS curadoria_por          text,
  ADD COLUMN IF NOT EXISTS curadoria_destaque_ate timestamptz;

CREATE INDEX IF NOT EXISTS noticias_curadoria_ativa_idx
  ON public.noticias (curadoria_destaque_ate)
  WHERE curadoria_destaque_ate IS NOT NULL;

-- 2. Recompute preserva curadoria ativa (corpo idêntico ao de
--    20260427000000 + passo final de re-marcação)
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

  -- Curadoria ativa nunca perde o destaque enquanto o prazo não vence
  UPDATE public.noticias SET is_featured = true
  WHERE curadoria_destaque_ate > v_now AND NOT is_featured;
END;
$$;

-- 3. Artigos da curadoria — INSERT idempotente (guard por DOI; o índice único
--    parcial noticias_doi_uidx garante que rerun não duplica)

-- 3a. POISE-3 TXA em cirurgia urológica (European Urology, fora do cron PubMed)
INSERT INTO public.noticias (
  titulo, titulo_pt, resumo, resumo_pt, autores, idioma,
  fonte, fonte_url, raw_url, categoria,
  doi, pmid, journal_issn, article_type, is_open_access,
  dedup_hash, titulo_norm, publicado_em
)
SELECT
  'Safety and Efficacy of Tranexamic Acid in Urologic Surgery: Results from the International, Randomized, Placebo-Controlled POISE-3 Trial',
  'Segurança e eficácia do ácido tranexâmico em cirurgia urológica: resultados do ensaio internacional, randomizado e placebo-controlado POISE-3',
  E'BACKGROUND: Perioperative bleeding is common. Evidence for tranexamic acid (TXA) in urology remains limited and conflicting, and major urologic guidelines provide no recommendations. In an a priori planned analysis, we evaluated TXA among patients undergoing urologic surgery in POISE-3.\nMETHODS: POISE-3 was an international randomized trial of patients undergoing surgery with bleeding and cardiovascular risk factors. Participants received TXA (1 g intravenous bolus at surgery start and end) or placebo. The primary efficacy outcome was a 30-day bleeding composite (life-threatening/major/critical organ bleeding), and the primary safety outcome was a 30-day thrombosis composite (myocardial injury after noncardiac surgery [MINS], nonhemorrhagic stroke, peripheral arterial thrombosis, or symptomatic proximal venous thromboembolism [VTE]).\nRESULTS: Among 1124 urologic participants (556 TXA and 568 placebo), 489 had laparoscopic/robotic, 360 open, 244 transurethral, and 31 percutaneous surgery. The composite bleeding outcome occurred in 45 (8.1%) with TXA and in 62 (10.9%) with placebo (hazard ratio [HR] 0.73, 95% confidence interval [CI] 0.50-1.07). Major bleeding occurred in 34 (6.1%) with TXA and in 54 (9.5%) with placebo (HR 0.63, 95% CI 0.41-0.97). The composite safety outcome occurred in 67 (12.1%) with TXA and in 62 (10.9%) with placebo (HR 1.12, 95% CI 0.79-1.58; MINS: 62 vs 58; strokes: 2 vs 2; VTEs: 3 vs 3).\nCONCLUSIONS: TXA reduced major bleeding and supports perioperative use in urologic surgery, especially when the bleeding risk is high.',
  E'INTRODUÇÃO: Sangramento perioperatório é comum. A evidência para o ácido tranexâmico (TXA) em urologia permanece limitada e conflitante, e as principais diretrizes urológicas não fazem recomendações. Em análise planejada a priori, avaliamos o TXA em pacientes submetidos a cirurgia urológica no POISE-3.\nMÉTODOS: O POISE-3 foi um ensaio randomizado internacional com pacientes cirúrgicos com fatores de risco hemorrágico e cardiovascular. Os participantes receberam TXA (bolus intravenoso de 1 g no início e no fim da cirurgia) ou placebo. O desfecho primário de eficácia foi um composto de sangramento em 30 dias (sangramento ameaçador à vida/maior/em órgão crítico) e o desfecho primário de segurança foi um composto de trombose em 30 dias (lesão miocárdica após cirurgia não cardíaca [MINS], AVC não hemorrágico, trombose arterial periférica ou tromboembolismo venoso proximal sintomático [TEV]).\nRESULTADOS: Entre 1.124 participantes urológicos (556 TXA e 568 placebo), 489 foram submetidos a cirurgia laparoscópica/robótica, 360 aberta, 244 transuretral e 31 percutânea. O desfecho composto de sangramento ocorreu em 45 (8,1%) com TXA e em 62 (10,9%) com placebo (hazard ratio [HR] 0,73; IC 95% 0,50-1,07). Sangramento maior ocorreu em 34 (6,1%) com TXA e em 54 (9,5%) com placebo (HR 0,63; IC 95% 0,41-0,97). O desfecho composto de segurança ocorreu em 67 (12,1%) com TXA e em 62 (10,9%) com placebo (HR 1,12; IC 95% 0,79-1,58; MINS: 62 vs 58; AVC: 2 vs 2; TEV: 3 vs 3).\nCONCLUSÕES: O TXA reduziu sangramento maior e respalda o uso perioperatório em cirurgia urológica, especialmente quando o risco de sangramento é alto.',
  'Tikkinen KAO, Marcucci M, Halme ALE, Ofori SN, Borges FK, Kanstrup CTB',
  'en',
  'Eur Urol',
  'https://pubmed.ncbi.nlm.nih.gov/42020258',
  'https://doi.org/10.1016/j.eururo.2026.03.019',
  'pesquisa',
  '10.1016/j.eururo.2026.03.019',
  '42020258',
  '0302-2838',
  'Randomized Controlled Trial',
  true,
  encode(digest('https://pubmed.ncbi.nlm.nih.gov/42020258|safety and efficacy of tranexamic acid in urologic surgery', 'sha256'), 'hex'),
  'safety and efficacy of tranexamic acid in urologic surgery results from the international randomized placebo controlled poise 3 trial',
  timestamptz '2026-08-01 00:00:00-03'
WHERE NOT EXISTS (
  SELECT 1 FROM public.noticias WHERE doi = '10.1016/j.eururo.2026.03.019'
);

-- 3b. Cateter DPIP bilateral pós-esternotomia (Anesthesia & Analgesia,
--     journal fora do cron PubMed)
INSERT INTO public.noticias (
  titulo, titulo_pt, resumo, resumo_pt, autores, idioma,
  fonte, fonte_url, raw_url, categoria,
  doi, pmid, journal_issn, article_type, is_open_access,
  dedup_hash, titulo_norm, publicado_em
)
SELECT
  'The Effect of Repeated Bilateral Deep Parasternal Intercostal Plane Catheter Boluses on Analgesia After Cardiac Surgery: A Randomized Controlled Trial',
  'Efeito de boluses repetidos em cateteres bilaterais no plano intercostal paraesternal profundo na analgesia após cirurgia cardíaca: ensaio clínico randomizado',
  E'BACKGROUND: Median sternotomy for cardiac surgery is associated with significant postoperative pain. We evaluated whether repeated ropivacaine boluses via bilateral deep parasternal intercostal plane (DPIP) catheters improve analgesia after cardiac surgery.\nMETHODS: In this randomized, placebo-controlled trial, 120 adult patients undergoing elective coronary artery bypass grafting or heart valve replacement were allocated to receive repeated boluses of either ropivacaine or saline via bilateral DPIP catheters for 72 hours postoperatively. Patients, researchers, and clinical staff were blinded to group allocation. The primary endpoint was postoperative pain intensity, assessed by the visual analog scale or, in sedated patients, the behavioral pain scale. Secondary endpoints included cumulative oxycodone consumption, adverse events, postoperative sedation, and mechanical ventilation.\nRESULTS: Pain trajectories over the 72-hour postoperative period did not differ between groups (group x time interaction P = .77 at rest; P = 1.00 with movement). No statistically significant differences were observed between groups in cumulative opioid consumption. Postoperative nausea and vomiting was the most common adverse event, occurring in 38% overall, with a higher incidence among ropivacaine-treated valve surgery patients. Five patients had symptoms suggestive of local anesthetic systemic toxicity; all cases were self-limiting. Four pneumothoraces occurred, one of which was clearly surgically related. The catheter became dislodged in nine patients.\nCONCLUSIONS: Repeated ropivacaine boluses via DPIP catheters did not improve postoperative pain control or reduce opioid consumption compared with placebo after median sternotomy. Routine use of DPIP catheters after cardiac surgery should therefore be avoided.',
  E'INTRODUÇÃO: A esternotomia mediana em cirurgia cardíaca está associada a dor pós-operatória significativa. Avaliamos se boluses repetidos de ropivacaína via cateteres bilaterais no plano intercostal paraesternal profundo (DPIP) melhoram a analgesia após cirurgia cardíaca.\nMÉTODOS: Neste ensaio randomizado e placebo-controlado, 120 pacientes adultos submetidos a revascularização miocárdica ou troca valvar eletiva foram alocados para receber boluses repetidos de ropivacaína ou soro fisiológico via cateteres DPIP bilaterais por 72 horas de pós-operatório. Pacientes, pesquisadores e equipe clínica eram cegos para a alocação. O desfecho primário foi a intensidade da dor pós-operatória, avaliada pela escala visual analógica ou, em pacientes sedados, pela escala comportamental de dor. Desfechos secundários incluíram consumo cumulativo de oxicodona, eventos adversos, sedação pós-operatória e ventilação mecânica.\nRESULTADOS: As trajetórias de dor ao longo das 72 horas de pós-operatório não diferiram entre os grupos (interação grupo x tempo P = 0,77 em repouso; P = 1,00 em movimento). Não houve diferenças estatisticamente significativas no consumo cumulativo de opioides. Náusea e vômito pós-operatórios foram o evento adverso mais comum (38% no total), com incidência maior nos pacientes valvares tratados com ropivacaína. Cinco pacientes tiveram sintomas sugestivos de toxicidade sistêmica por anestésico local; todos autolimitados. Ocorreram quatro pneumotóraces, um deles claramente relacionado à cirurgia. O cateter deslocou-se em nove pacientes.\nCONCLUSÕES: Boluses repetidos de ropivacaína via cateteres DPIP não melhoraram o controle da dor pós-operatória nem reduziram o consumo de opioides em comparação com placebo após esternotomia mediana. O uso rotineiro de cateteres DPIP após cirurgia cardíaca deve, portanto, ser evitado.',
  'Kuuskoski RA, Saari TI, Karvonen SI, Singh B, Tiainen SM, Rantanen MJM',
  'en',
  'A&A',
  'https://pubmed.ncbi.nlm.nih.gov/42579389',
  'https://doi.org/10.1213/ane.0000000000008211',
  'pesquisa',
  '10.1213/ane.0000000000008211',
  '42579389',
  '0003-2999',
  'Randomized Controlled Trial',
  true,
  encode(digest('https://pubmed.ncbi.nlm.nih.gov/42579389|the effect of repeated bilateral deep parasternal intercostal plane catheter boluses', 'sha256'), 'hex'),
  'the effect of repeated bilateral deep parasternal intercostal plane catheter boluses on analgesia after cardiac surgery a randomized controlled trial',
  timestamptz '2026-08-11 00:00:00-03'
WHERE NOT EXISTS (
  SELECT 1 FROM public.noticias WHERE doi = '10.1213/ane.0000000000008211'
);

-- 4. Marca a curadoria nos 3 artigos (o da BJA já existia via cron).
--    Prazo fixo (14/09/2026) e não now()+30d: rerun da migration não estende.
UPDATE public.noticias
SET curadoria_por          = 'Dr. Humberto Hepp',
    curadoria_destaque_ate = timestamptz '2026-09-14 23:59:59-03',
    is_featured            = true
WHERE doi IN (
  '10.1016/j.eururo.2026.03.019',
  '10.1016/j.bja.2026.05.061',
  '10.1213/ane.0000000000008211'
);

-- 5. Recomputa scores agora (o artigo da BJA estava com final_score 0 à espera
--    do cron de segunda; os inseridos ganham score real de imediato)
SELECT public.recompute_noticias_scores();

-- Inspeção:
--   SELECT titulo, fonte, curadoria_por, curadoria_destaque_ate, is_featured,
--          final_score
--     FROM public.noticias
--    WHERE curadoria_por IS NOT NULL
--    ORDER BY publicado_em DESC;

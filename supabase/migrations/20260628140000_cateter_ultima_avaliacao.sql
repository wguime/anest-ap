-- ════════════════════════════════════════════════════════════════════════
-- 20260628140000_cateter_ultima_avaliacao.sql
-- Coluna denormalizada ultima_avaliacao_at em cateteres_peridural, mantida por
-- trigger no insert/update de followup. Base do alerta de "cateter não evoluído"
-- (card + lembrete server-side). O card já recebe a coluna via select('*').
-- GREATEST evita regredir o timestamp quando uma evolução antiga é editada.
-- Idempotente.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.cateteres_peridural
  ADD COLUMN IF NOT EXISTS ultima_avaliacao_at TIMESTAMPTZ;

-- Backfill: última data_avaliacao por cateter (NULL se nunca evoluído).
UPDATE public.cateteres_peridural c
SET ultima_avaliacao_at = sub.max_av
FROM (
  SELECT cateter_id, MAX(data_avaliacao) AS max_av
  FROM public.cateteres_peridural_followup
  GROUP BY cateter_id
) sub
WHERE sub.cateter_id = c.id
  AND c.ultima_avaliacao_at IS DISTINCT FROM sub.max_av;

CREATE OR REPLACE FUNCTION public.tg_cateter_touch_ultima_avaliacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.cateteres_peridural
  SET ultima_avaliacao_at = GREATEST(
        coalesce(ultima_avaliacao_at, '-infinity'::timestamptz),
        NEW.data_avaliacao
      )
  WHERE id = NEW.cateter_id;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca bloquear a evolução clínica por falha no denormalizado.
  RAISE WARNING '[tg_cateter_touch_ultima_avaliacao] followup % : %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_cateter_touch_ultima_avaliacao ON public.cateteres_peridural_followup;
CREATE TRIGGER tr_cateter_touch_ultima_avaliacao
  AFTER INSERT OR UPDATE ON public.cateteres_peridural_followup
  FOR EACH ROW EXECUTE FUNCTION public.tg_cateter_touch_ultima_avaliacao();

COMMIT;

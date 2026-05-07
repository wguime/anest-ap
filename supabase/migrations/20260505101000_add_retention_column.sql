-- ==========================================================================
-- 20260505101000_add_retention_column.sql
-- LGPD Art. 15 — política de retenção explícita
-- Endereça gap A6.5 (sem retenção formal) e A6.3 (Decreto 10.153/2019, CFM 1.821).
-- ==========================================================================
--
-- Adiciona coluna retain_until (date) calculada conforme:
--   - Denúncia (qualquer): 100 anos (Decreto 10.153/2019 — proteção do denunciante)
--   - Incidente com dano grave/óbito: 20 anos (CFM Resolução 1.821/2007 — prontuário)
--   - Incidente sem dano grave: 5 anos (Lei 13.964/2019 — apuração admin)
--
-- O cron diário (a configurar fora deste arquivo) deve chamar
-- rpc_anonimizar_incidente para registros com retain_until < now() — anonimiza
-- após o prazo, preservando indicadores agregados.
-- ==========================================================================

ALTER TABLE public.incidentes
  ADD COLUMN IF NOT EXISTS retain_until date;

-- Backfill para registros existentes
UPDATE public.incidentes SET retain_until = (
  CASE
    WHEN tipo = 'denuncia'
      THEN (created_at + interval '100 years')::date
    WHEN tipo = 'incidente'
         AND COALESCE(impacto->>'danoAoPaciente', '') IN ('grave', 'obito')
      THEN (created_at + interval '20 years')::date
    ELSE
      (created_at + interval '5 years')::date
  END
) WHERE retain_until IS NULL;

-- Trigger BEFORE INSERT para preencher automaticamente
CREATE OR REPLACE FUNCTION public.set_retain_until()
RETURNS trigger AS $$
BEGIN
  IF new.retain_until IS NULL THEN
    new.retain_until := CASE
      WHEN new.tipo = 'denuncia'
        THEN (COALESCE(new.created_at, now()) + interval '100 years')::date
      WHEN new.tipo = 'incidente'
           AND COALESCE(new.impacto->>'danoAoPaciente', '') IN ('grave', 'obito')
        THEN (COALESCE(new.created_at, now()) + interval '20 years')::date
      ELSE
        (COALESCE(new.created_at, now()) + interval '5 years')::date
    END;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

DROP TRIGGER IF EXISTS tr_incidentes_set_retain_until ON public.incidentes;
CREATE TRIGGER tr_incidentes_set_retain_until
  BEFORE INSERT ON public.incidentes
  FOR EACH ROW EXECUTE FUNCTION public.set_retain_until();

COMMENT ON COLUMN public.incidentes.retain_until IS
  'LGPD Art. 15 — data limite de retenção. Após esta data, registro deve ser anonimizado '
  'via rpc_anonimizar_incidente. Calculada na inserção: 100a denúncias, 20a incidentes graves, 5a demais.';

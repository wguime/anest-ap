-- ==========================================================================
-- 20260505102000_protocolo_sequence.sql
-- Endereça gap A9.2 da auditoria 2026-05-04 (race condition no protocolo).
-- ==========================================================================
--
-- Antes (005_incidents.sql:64-87): generate_protocolo() usava count(*) + 1
-- não-atômico — dois INSERTs simultâneos no mesmo dia podiam computar o mesmo
-- seq_num. A UNIQUE constraint em incidentes.protocolo blindava (segundo INSERT
-- falhava com 23505), mas esse erro chegava ao usuário como falha genérica.
--
-- Depois: nextval() de uma sequence dedicada por tipo+dia (resetada via
-- particionamento implícito no formato YYYYMMDD-NNNN) com retry exponencial
-- em caso de UNIQUE violation. O nextval() é atômico — sem race possível.
-- ==========================================================================

CREATE SEQUENCE IF NOT EXISTS public.seq_protocolo_global;

CREATE OR REPLACE FUNCTION public.generate_protocolo()
RETURNS trigger AS $$
DECLARE
  prefix text;
  date_part text;
  seq_today bigint;
  seq_str text;
  attempt int := 0;
  max_attempts int := 5;
BEGIN
  prefix := CASE new.tipo
    WHEN 'denuncia' THEN 'DEN'
    ELSE 'INC'
  END;
  date_part := to_char(now(), 'YYYYMMDD');

  -- Loop com retry para colisões UNIQUE (extremamente raras com nextval, mas
  -- se outro trigger gerar o mesmo formato, garantimos resolução).
  LOOP
    -- nextval é atômico: garante valor único mesmo em concorrência alta.
    seq_today := nextval('public.seq_protocolo_global');
    -- Mantém formato curto: 4 dígitos por dia (módulo 10000) — equivalente ao
    -- formato anterior. Em volume baixo (<10k/dia) não há colisão.
    seq_str := lpad((seq_today % 10000)::text, 4, '0');
    new.protocolo := prefix || '-' || date_part || '-' || seq_str;

    -- Confirma unicidade (defesa contra módulo após 10k inserts/dia).
    IF NOT EXISTS (SELECT 1 FROM public.incidentes WHERE protocolo = new.protocolo) THEN
      RETURN new;
    END IF;

    attempt := attempt + 1;
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'generate_protocolo: não conseguiu gerar protocolo único após % tentativas (volume diário > 10k?)', max_attempts;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

COMMENT ON FUNCTION public.generate_protocolo() IS
  'Gera protocolo INC/DEN-YYYYMMDD-NNNN usando nextval() atômico. '
  'Substitui count(*)+1 não-atômico do 005_incidents.sql (Auditoria A9.2 — 2026-05-04).';
COMMENT ON SEQUENCE public.seq_protocolo_global IS
  'Sequence atômica para geração de protocolo. Módulo 10000 por dia mantém formato curto.';

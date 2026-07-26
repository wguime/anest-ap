-- ════════════════════════════════════════════════════════════════════════
-- 20260726100000_escala_caso_turno.sql
-- Turno EXPLÍCITO do caso cirúrgico (matutino | vespertino).
--
-- Problema (relatado pelo dono 2026-07-26): o SRPA publicado na escala da MANHÃ
-- aparecia também no VESPERTINO. Caso sem hora não tinha turno — o front
-- adivinhava, e adivinhava DIFERENTE em dois lugares:
--   • mergeCasosPorTurno (publicação) tratava "sem hora" como MATUTINO;
--   • filtrarPorTurno (exibição) mostrava "sem hora" nos DOIS turnos.
-- Além do sintoma visual, isso é caminho de PERDA: um bloco sem hora publicado
-- na tarde era classificado como matutino e seria apagado ao publicar a manhã
-- (publicar é DELETE+reinsert do turno).
--
-- Com a coluna, o turno é o que foi PUBLICADO — nada de adivinhar pela hora.
-- Legado (NULL) continua caindo na regra antiga de hora, então escala já
-- publicada não muda de lugar sozinha.
--
-- Sem impacto em RLS (mesma tabela, mesmas policies) nem em realtime.
-- Idempotente: ADD COLUMN IF NOT EXISTS.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.escala_cirurgica_caso
  ADD COLUMN IF NOT EXISTS turno TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.escala_cirurgica_caso'::regclass
      AND conname = 'escala_cirurgica_caso_turno_check'
  ) THEN
    ALTER TABLE public.escala_cirurgica_caso
      ADD CONSTRAINT escala_cirurgica_caso_turno_check
      CHECK (turno IS NULL OR turno IN ('matutino', 'vespertino'));
  END IF;
END $$;

COMMENT ON COLUMN public.escala_cirurgica_caso.turno IS
  'Turno em que o caso foi PUBLICADO (matutino|vespertino). NULL = escala legada, o front deduz pela hora. Existe porque caso sem hora não tinha turno e aparecia nos dois (SRPA da manhã na tarde, 2026-07-26).';

COMMIT;

-- ROLLBACK (manual):
--   ALTER TABLE public.escala_cirurgica_caso DROP CONSTRAINT IF EXISTS escala_cirurgica_caso_turno_check;
--   ALTER TABLE public.escala_cirurgica_caso DROP COLUMN IF EXISTS turno;

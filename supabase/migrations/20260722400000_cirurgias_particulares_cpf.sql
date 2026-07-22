-- ════════════════════════════════════════════════════════════════════════
-- 20260722400000_cirurgias_particulares_cpf.sql
-- CPF do paciente em cirurgias_particulares (pedido do dono 2026-07-22):
-- obrigatório NO FORMULÁRIO ao lançar a guia; a coluna é nullable porque os
-- rascunhos do auto-import (trigger/backfill) nascem sem CPF — a escala/
-- imagem não traz CPF — e ficam com badge "Completar dados" até preencher.
--
-- LGPD: CPF = dado pessoal (não sensível) necessário à finalidade de
-- cobrança/recibo do honorário (identificação do pagador — art. 7º V/VI,
-- mesma base do registro; ver header da 20260722100000). Mesma RLS
-- restrita; NUNCA logar em console/notificação.
--
-- Armazenamento: SÓ DÍGITOS (11) — máscara é responsabilidade da UI.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.cirurgias_particulares
  ADD COLUMN IF NOT EXISTS paciente_cpf TEXT;

-- CHECK guardado (ADD CONSTRAINT não tem IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cirurgias_particulares_cpf_digits'
      AND conrelid = 'public.cirurgias_particulares'::regclass
  ) THEN
    ALTER TABLE public.cirurgias_particulares
      ADD CONSTRAINT cirurgias_particulares_cpf_digits
      CHECK (paciente_cpf IS NULL OR paciente_cpf ~ '^[0-9]{11}$');
  END IF;
END $$;

COMMENT ON COLUMN public.cirurgias_particulares.paciente_cpf IS
  'CPF do paciente (só dígitos). Obrigatório no form da guia; NULL nos rascunhos do auto-import até completar. LGPD: identificação do pagador p/ cobrança/recibo.';

COMMIT;

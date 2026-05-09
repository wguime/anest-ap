-- =============================================================================
-- 20260508500000_ocr_fail_count.sql — issue #12 (audit P1-3)
--
-- Sem retry-cap, user pode resubmeter OCR infinitamente. Adiciona contador
-- de falhas consecutivas em documentos.ocr_fail_count e helper para incrementar.
--
-- Frontend (useOcrPipeline) checa ocr_fail_count >= 3 antes de iniciar.
-- Reset implícito quando OCR completa com sucesso (persistOcrResult zera).
-- =============================================================================

ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS ocr_fail_count int NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.documentos.ocr_fail_count IS
  'Contador de falhas consecutivas do OCR (resetado a 0 em persistOcrResult).
   useOcrPipeline bloqueia retry quando >= 3.';

-- Helper RPC: incrementa atomicamente (chamado pelo markOcrFailed)
CREATE OR REPLACE FUNCTION public.rpc_increment_ocr_fail_count(p_documento_id text)
RETURNS int AS $$
DECLARE
  new_count int;
BEGIN
  UPDATE public.documentos
    SET ocr_fail_count = ocr_fail_count + 1
    WHERE id = p_documento_id
  RETURNING ocr_fail_count INTO new_count;
  RETURN COALESCE(new_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.rpc_increment_ocr_fail_count(text) TO authenticated;

-- Helper RPC: zera count (chamado em persistOcrResult)
CREATE OR REPLACE FUNCTION public.rpc_reset_ocr_fail_count(p_documento_id text)
RETURNS void AS $$
BEGIN
  UPDATE public.documentos
    SET ocr_fail_count = 0
    WHERE id = p_documento_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.rpc_reset_ocr_fail_count(text) TO authenticated;

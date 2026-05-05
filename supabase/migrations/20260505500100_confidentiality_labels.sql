-- =============================================================================
-- 20260505500100_confidentiality_labels.sql — Onda1-4
-- 4 níveis de confidencialidade para documentos:
--   publico < interno < restrito < sigiloso
--
-- RLS de leitura: usuário precisa ter clearance >= nível do documento.
-- O clearance vem de claim do JWT (`clearance_level`), populada pela edge
-- function get-supabase-token a partir de profiles.clearance_level.
-- =============================================================================

-- ──────────────────────────────────────────────────────────────────────────
-- 1. ENUM
-- ──────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.confidentiality_level AS ENUM (
    'publico','interno','restrito','sigiloso'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Coluna em documentos
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS confidentiality_level public.confidentiality_level
  NOT NULL DEFAULT 'interno';

CREATE INDEX IF NOT EXISTS idx_doc_confidentiality
  ON public.documentos(confidentiality_level);

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Helpers de comparação numérica
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.user_clearance_level()
RETURNS int AS $$
DECLARE
  level text;
BEGIN
  level := COALESCE(
    current_setting('request.jwt.claims', true)::jsonb->>'clearance_level',
    'interno'
  );
  RETURN CASE level
    WHEN 'publico'  THEN 0
    WHEN 'interno'  THEN 1
    WHEN 'restrito' THEN 2
    WHEN 'sigiloso' THEN 3
    ELSE 1
  END;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.doc_confidentiality_numeric(
  level public.confidentiality_level
)
RETURNS int AS $$
BEGIN
  RETURN CASE level
    WHEN 'publico'  THEN 0
    WHEN 'interno'  THEN 1
    WHEN 'restrito' THEN 2
    WHEN 'sigiloso' THEN 3
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ──────────────────────────────────────────────────────────────────────────
-- 4. Política RLS de leitura — compõe (PERMISSIVE) com policies existentes.
--    Usuário lê documento se:
--      • for admin, OU
--      • tiver clearance >= nível do documento, OU
--      • for o autor.
-- ──────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS doc_confidentiality_select ON public.documentos;
CREATE POLICY doc_confidentiality_select ON public.documentos
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.doc_confidentiality_numeric(confidentiality_level)
       <= public.user_clearance_level()
    OR created_by = public.firebase_uid()
  );

-- ──────────────────────────────────────────────────────────────────────────
-- 5. Coluna clearance em profiles (populado pelo admin; default 'interno').
--    NOTE: tabela é `profiles` (não `usuarios`); ver 018_profiles.sql.
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS clearance_level public.confidentiality_level
  NOT NULL DEFAULT 'interno';

CREATE INDEX IF NOT EXISTS idx_profiles_clearance
  ON public.profiles(clearance_level);

COMMENT ON COLUMN public.profiles.clearance_level IS
  'Nível de acesso máximo do usuário a documentos confidenciais. Lido pela edge function get-supabase-token e injetado como claim `clearance_level` no JWT.';

COMMENT ON COLUMN public.documentos.confidentiality_level IS
  'Nível de confidencialidade do documento (publico/interno/restrito/sigiloso). Apenas usuários com clearance_level >= podem ler. Aplicado via policy doc_confidentiality_select.';

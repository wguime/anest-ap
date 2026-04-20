-- Migration 031: Permitir anestesiologistas criarem comunicados
-- Anestesiologistas, coordenadores e admins podem INSERT em comunicados.
-- UPDATE/DELETE continuam restritos a admins (so admin edita/arquiva
-- comunicados alheios; anestesiologista apenas publica diretamente).

-- ──────────────────────────────────────────────
-- 1. Funcao auxiliar: can_send_comunicado()
--    true se admin OU se o profile tem role anestesiologista/coordenador
--    ou flag is_admin / is_coordenador.
-- ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.can_send_comunicado() RETURNS boolean AS $$
BEGIN
  RETURN public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = public.firebase_uid()
          AND (
            is_admin = true
            OR is_coordenador = true
            OR lower(role) IN ('anestesiologista','coordenador','administrador')
          )
      );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '';

GRANT EXECUTE ON FUNCTION public.can_send_comunicado() TO authenticated;

-- ──────────────────────────────────────────────
-- 2. Relax insert policy em comunicados
-- ──────────────────────────────────────────────

DROP POLICY IF EXISTS "comunicados_insert" ON public.comunicados;
CREATE POLICY "comunicados_insert" ON public.comunicados
  FOR INSERT TO authenticated
  WITH CHECK (public.can_send_comunicado());

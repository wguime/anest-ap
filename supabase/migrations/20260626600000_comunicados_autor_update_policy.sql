-- Comunicados: autor pode UPDATE o próprio comunicado; admin pode tudo.
--
-- Bug (auditoria 2026-05-27): migration 031 liberou INSERT para
-- anestesiologistas/coordenadores via can_send_comunicado(), mas a policy
-- de UPDATE (migration 019) continuou exigindo admin_users. Resultado:
-- autor não-admin edita o próprio comunicado e recebe 0 rows / PGRST116
-- silencioso (parece bug do app).
--
-- Espírito da policy de INSERT (031): quem pode enviar comunicado
-- (can_send_comunicado) pode editar o que é seu; admin continua podendo tudo.
-- Idempotente: DROP POLICY IF EXISTS + CREATE.

BEGIN;

-- Garante a função gate (mesma definição da migration 031 — CREATE OR REPLACE
-- é idempotente; redefinida aqui porque 031 vive em src/supabase/migrations/,
-- fora do tracking do diretório supabase/migrations/).
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

DROP POLICY IF EXISTS comunicados_update ON public.comunicados;

CREATE POLICY comunicados_update ON public.comunicados
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (
      autor_id = (SELECT public.firebase_uid())
      AND public.can_send_comunicado()
    )
  )
  WITH CHECK (
    public.is_admin()
    OR (
      -- autor não pode transferir ownership no UPDATE
      autor_id = (SELECT public.firebase_uid())
      AND public.can_send_comunicado()
    )
  );

-- Complemento (ressalva do migration-validator): UPDATE via PostgREST usa
-- RETURNING, que também passa pela policy SELECT. A comunicados_select
-- (20260626100000) não mostrava RASCUNHO ao próprio autor não-admin → editar
-- o próprio draft continuaria dando 0 rows. Recria a SELECT idêntica
-- + ramo `autor_id = firebase_uid()` (autor sempre vê o que é seu).
DROP POLICY IF EXISTS comunicados_select ON public.comunicados;

CREATE POLICY comunicados_select ON public.comunicados
  FOR SELECT TO authenticated
  USING (
    autor_id = (SELECT public.firebase_uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (select public.firebase_uid())
        AND (
          p.is_admin IS TRUE
          OR p.role IN ('administrador', 'Administrador', 'coordenador', 'Coordenador')
        )
    )
    OR (
      status = 'publicado'
      AND arquivado IS NOT TRUE
      AND (
        destinatarios = '{}'
        OR destinatarios IS NULL
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = (select public.firebase_uid())
            AND p.role = ANY(destinatarios)
        )
      )
    )
  );

COMMIT;

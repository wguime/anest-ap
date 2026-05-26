-- S0.2: Restringir comunicados SELECT — usuários comuns só veem publicados dentro do targeting
-- Antes: USING (true) permitia todos lerem tudo, incluindo rascunhos admin

BEGIN;

DROP POLICY IF EXISTS comunicados_select ON comunicados;

CREATE POLICY comunicados_select ON comunicados
  FOR SELECT TO authenticated
  USING (
    EXISTS (
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

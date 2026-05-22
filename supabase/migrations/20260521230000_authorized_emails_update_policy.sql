-- Migration: add UPDATE policy on authorized_emails
-- Incident 2026-05-21: admin tentou alterar `role` em authorized_emails via
-- Centro de Gestão → aba Emails. UI mostrava toast "Não foi possível atualizar
-- o cargo." porque:
--   1) Tabela authorized_emails tem RLS habilitado (migration 018).
--   2) Migration 018 criou policies para SELECT, INSERT, DELETE — mas
--      OMITIU a policy de UPDATE.
--   3) Sem policy UPDATE, todo .update() do client com role `authenticated`
--      retorna 0 rows afetadas (RLS bloqueia silenciosamente).
--   4) supabaseUsersService.updateAuthorizedEmailRole faz .update().select().single()
--      → 0 rows → PostgREST PGRST116 ("JSON object requested, multiple (or no)
--      rows returned") → catch → toast erro.
--
-- Esta migration adiciona a policy ausente, restrita a admins (is_admin()),
-- consistente com auth_emails_insert e auth_emails_delete.

DROP POLICY IF EXISTS auth_emails_update ON public.authorized_emails;
CREATE POLICY auth_emails_update ON public.authorized_emails
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Smoke: rodar com Authorization de um admin
--   UPDATE authorized_emails SET role = 'anestesiologista'
--   WHERE email = 'algum@email.com' RETURNING email, role;
-- Esperado: 1 row afetada (antes desta migration: 0 rows).

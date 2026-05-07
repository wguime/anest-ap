-- ============================================================================
-- Wave 0a — Sprint 0 — Fix RLS de permission_audit_log
-- ----------------------------------------------------------------------------
-- Problema (auditoria 2026-05-04, Agente 8 — CRÍTICO segurança):
-- A policy "Admins can view audit logs" (20260221194522_lgpd_and_audit.sql:
-- linhas 72-75) usa `USING (true)`, permitindo que QUALQUER usuário
-- autenticado leia o log completo de alterações de permissão de todos os
-- usuários — incluindo histórico de quem virou admin, quando, e por quem.
--
-- Correção: restringir SELECT a `public.is_admin()`. Mantém INSERT
-- to authenticated (o serviço escreve em nome do admin).
-- ============================================================================

drop policy if exists "Admins can view audit logs" on public.permission_audit_log;

create policy "Only admins can view audit logs"
  on public.permission_audit_log for select
  to authenticated
  using (public.is_admin());

-- Garantir que anon não consiga inserir logs forjados.
drop policy if exists "Anon can insert audit logs" on public.permission_audit_log;

-- INSERT continua liberado para authenticated (o backend valida o `changed_by`).
-- Reforço: o `changed_by` deve ser igual ao firebase_uid() do JWT.
drop policy if exists "Authenticated users can insert audit logs"
  on public.permission_audit_log;

create policy "Authenticated users can insert own audit logs"
  on public.permission_audit_log for insert
  to authenticated
  with check (changed_by = public.firebase_uid());

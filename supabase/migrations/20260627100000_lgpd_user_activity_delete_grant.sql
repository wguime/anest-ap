-- ════════════════════════════════════════════════════════════════════════
-- 20260627100000_lgpd_user_activity_delete_grant.sql
-- Hardening Fase 2 — Stream B (pendência LGPD Educação, auditoria 2026-05-13)
--
-- Contexto: lgpdService.processSolicitacao agora deleta as linhas de
-- public.user_activity_day (streak/atividade diária de educação) do titular
-- ao processar solicitação de exclusão (LGPD Art. 18).
--
-- A policy RLS `uad_delete_admin` (migration 20260518120000) já restringe
-- DELETE a admins (public.is_admin()), MAS o privilégio de tabela DELETE
-- nunca foi concedido ao role `authenticated` — só SELECT. Sem o grant, o
-- DELETE do admin falha com 42501 (permission denied) ANTES de o RLS ser
-- avaliado.
--
-- Segurança: o grant por si só NÃO abre deleção para usuários comuns —
-- a RLS (ENABLED, não FORCE) continua aplicando `using (public.is_admin())`
-- no DELETE para o role authenticated.
-- ════════════════════════════════════════════════════════════════════════

grant delete on public.user_activity_day to authenticated;

comment on policy uad_delete_admin on public.user_activity_day is
  'DELETE restrito a admin. Usado por lgpdService.processSolicitacao (exclusão LGPD Art. 18) e limpeza de retenção.';

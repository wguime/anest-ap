-- ════════════════════════════════════════════════════════════════════════
-- 20260627200000_cateter_rls_por_papel.sql
-- Hardening Fase 2 — Stream A (RLS do módulo Cateter Peridural)
--
-- Antes (migration 027): as 6 policies eram `TO authenticated` com
-- USING/CHECK true — qualquer usuário logado (secretária, técnica,
-- colaborador) lia e escrevia dados de PACIENTE (nome, leito, cirurgia).
--
-- Modelo acordado com o usuário (2026-06-10):
--   • anestesiologista + medico-residente → leitura e escrita
--   • admin (admin_users/is_admin)        → somente leitura
--     (cobre useCateterReminders, que é admin-only e só lê)
--   • demais papéis (secretaria, tec-enfermagem, colaborador, enfermeiro,
--     visitante) → nenhum acesso
--   • DELETE: segue inexistente (módulo arquiva via status='retirado')
--
-- Papéis validados contra produção em 2026-06-10:
--   anestesiologista(46) medico-residente(8) tec-enfermagem(6)
--   secretaria(3) colaborador(1) enfermeiro(1)
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- Helper: quem pode ESCREVER em cateteres (clínicos do módulo).
-- SECURITY DEFINER no padrão firebase_uid()/user_clearance_level():
-- bypassa RLS de profiles para o lookup pontual, search_path fixo.
create or replace function public.can_write_cateter()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = public.firebase_uid()
      and lower(coalesce(p.role, '')) in ('anestesiologista', 'medico-residente')
  );
$$;

grant execute on function public.can_write_cateter() to authenticated, service_role;

comment on function public.can_write_cateter() is
  'true se o usuário corrente tem papel clínico do módulo cateter (anestesiologista/medico-residente). Leitura do módulo = can_write_cateter() OR is_admin().';

-- ── cateteres_peridural ────────────────────────────────────────────────
DROP POLICY IF EXISTS "cateteres_peridural_select" ON public.cateteres_peridural;
CREATE POLICY "cateteres_peridural_select" ON public.cateteres_peridural
  FOR SELECT TO authenticated
  USING ((select public.can_write_cateter()) OR (select public.is_admin()));

DROP POLICY IF EXISTS "cateteres_peridural_insert" ON public.cateteres_peridural;
CREATE POLICY "cateteres_peridural_insert" ON public.cateteres_peridural
  FOR INSERT TO authenticated
  WITH CHECK ((select public.can_write_cateter()));

DROP POLICY IF EXISTS "cateteres_peridural_update" ON public.cateteres_peridural;
CREATE POLICY "cateteres_peridural_update" ON public.cateteres_peridural
  FOR UPDATE TO authenticated
  USING ((select public.can_write_cateter()))
  WITH CHECK ((select public.can_write_cateter()));

-- ── cateteres_peridural_followup ───────────────────────────────────────
DROP POLICY IF EXISTS "cateteres_followup_select" ON public.cateteres_peridural_followup;
CREATE POLICY "cateteres_followup_select" ON public.cateteres_peridural_followup
  FOR SELECT TO authenticated
  USING ((select public.can_write_cateter()) OR (select public.is_admin()));

DROP POLICY IF EXISTS "cateteres_followup_insert" ON public.cateteres_peridural_followup;
CREATE POLICY "cateteres_followup_insert" ON public.cateteres_peridural_followup
  FOR INSERT TO authenticated
  WITH CHECK ((select public.can_write_cateter()));

DROP POLICY IF EXISTS "cateteres_followup_update" ON public.cateteres_peridural_followup;
CREATE POLICY "cateteres_followup_update" ON public.cateteres_peridural_followup
  FOR UPDATE TO authenticated
  USING ((select public.can_write_cateter()))
  WITH CHECK ((select public.can_write_cateter()));

COMMIT;

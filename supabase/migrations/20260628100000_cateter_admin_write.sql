-- ════════════════════════════════════════════════════════════════════════
-- 20260628100000_cateter_admin_write.sql
-- Cateter Peridural — admin passa a poder ESCREVER (não só ler)
--
-- Contexto: migration 20260627200000 deu ao admin (is_admin) somente leitura,
-- partindo do uso conhecido na época (useCateterReminders, admin-only e read).
-- Na prática o admin/dono precisa criar e evoluir cateteres (evolução PO).
-- Sintoma: "new row violates row-level security policy" ao salvar followup
-- com conta admin de papel não-clínico (ex.: 'colaborador').
--
-- Decisão do dono (2026-06-12): admin pode escrever também.
--   • escrita = can_write_cateter() OR is_admin()
--     (anestesiologista, medico-residente OU admin)
--   • leitura segue can_write_cateter() OR is_admin() (inalterada)
--   • DELETE segue inexistente (módulo arquiva via status='retirado')
--
-- can_write_cateter() mantém o significado clínico (não embutimos is_admin
-- nele) — as policies de escrita combinam os dois predicados explicitamente.
-- Idempotente (DROP POLICY IF EXISTS + CREATE). Rollback = reaplicar
-- 20260627200000.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── cateteres_peridural ────────────────────────────────────────────────
DROP POLICY IF EXISTS "cateteres_peridural_insert" ON public.cateteres_peridural;
CREATE POLICY "cateteres_peridural_insert" ON public.cateteres_peridural
  FOR INSERT TO authenticated
  WITH CHECK ((select public.can_write_cateter()) OR (select public.is_admin()));

DROP POLICY IF EXISTS "cateteres_peridural_update" ON public.cateteres_peridural;
CREATE POLICY "cateteres_peridural_update" ON public.cateteres_peridural
  FOR UPDATE TO authenticated
  USING ((select public.can_write_cateter()) OR (select public.is_admin()))
  WITH CHECK ((select public.can_write_cateter()) OR (select public.is_admin()));

-- ── cateteres_peridural_followup ───────────────────────────────────────
DROP POLICY IF EXISTS "cateteres_followup_insert" ON public.cateteres_peridural_followup;
CREATE POLICY "cateteres_followup_insert" ON public.cateteres_peridural_followup
  FOR INSERT TO authenticated
  WITH CHECK ((select public.can_write_cateter()) OR (select public.is_admin()));

DROP POLICY IF EXISTS "cateteres_followup_update" ON public.cateteres_peridural_followup;
CREATE POLICY "cateteres_followup_update" ON public.cateteres_peridural_followup
  FOR UPDATE TO authenticated
  USING ((select public.can_write_cateter()) OR (select public.is_admin()))
  WITH CHECK ((select public.can_write_cateter()) OR (select public.is_admin()));

COMMIT;

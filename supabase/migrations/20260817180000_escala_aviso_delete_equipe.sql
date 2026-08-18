-- ════════════════════════════════════════════════════════════════════════
-- 20260817180000_escala_aviso_delete_equipe.sql
-- Quem apaga um recado do plantonista (dono 2026-08-17, 2ª rodada).
--
-- "o plantonista manda os recados e adiciona e/ou exclui quando quiser".
--
-- A policy de 20260817140000 permitia DELETE só ao AUTOR. Isso trava justamente
-- o caso que interessa: virou o turno, o plantonista é outro, e o recado do
-- anterior fica pendurado sem ninguém poder tirar. "Plantonista" é derivado do
-- rodapé no cliente (o banco não sabe quem é), então o predicado aqui é o do
-- resto do módulo — quem edita a escala — e a UI mostra a lixeira só ao
-- plantonista, como já faz com todo o resto (a RLS do módulo é por PAPEL).
--
-- Idempotente: DROP ... IF EXISTS antes de criar.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

DROP POLICY IF EXISTS "escala_aviso_delete_autor" ON public.escala_cirurgica_aviso;
DROP POLICY IF EXISTS "escala_aviso_delete" ON public.escala_cirurgica_aviso;
CREATE POLICY "escala_aviso_delete" ON public.escala_cirurgica_aviso
  FOR DELETE TO authenticated
  USING ((select public.can_write_escala_cirurgica()));

COMMIT;

-- ROLLBACK:
--   DROP POLICY IF EXISTS "escala_aviso_delete" ON public.escala_cirurgica_aviso;
--   CREATE POLICY "escala_aviso_delete_autor" ON public.escala_cirurgica_aviso
--     FOR DELETE TO authenticated USING (autor_user_id = public.firebase_uid());

-- Correção do rodapé VESPERTINO da fila única de sábado 15/08 (ordem do dono,
-- 15/08 à noite): o documento trazia 7 posições ("P11, P10, P9, P5, P6, P4, P3")
-- e a ordem correta tem 9 — P1 (GUILHERME DIDOMENICO) e P2 (JOAO HENRIQUE) no
-- FIM do rodapé (= PRIMEIROS a serem liberados: pegam o plantão noturno 19-07
-- e saem antes para descansar; o documento os omitia como implícitos).
--
-- Do último ao primeiro a ser liberado (= convenção do rodapé):
--   P3, P4, P6, P5, P9, P10, P11, P1, P2
--
-- UPDATE cirúrgico (não republicação): preserva liberacoes/linha_overrides do
-- turno — conferido vazio antes de aplicar, mas o caminho não zera nada.
-- As demais 5 ordens ditadas pelo dono conferem com o publicado/derivado:
--   sáb manhã = rodapé publicado; sáb/dom noite = grade 19-07 (fase noturna);
--   dom manhã/tarde = sugestões publicadas.

begin;

update public.escala_cirurgica
   set ordem_liberacao = jsonb_set(
         ordem_liberacao,
         '{vespertino}',
         '["CRISTINA","MATHEUS","ERLEI","GABRIELA","ROBERTA","STAUB","GABRIEL","GUILHERME DIDOMENICO","JOAO HENRIQUE"]'::jsonb
       ),
       updated_at = now()
 where data = '2026-08-15'
   and hospital = 'fds';

commit;

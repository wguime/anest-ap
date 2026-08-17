-- Fila de liberação da NOITE no fim de semana 15–16/08 (ordem ditada pelo dono
-- em 16/08: "apenas adicione os P's faltantes").
--
--   Sábado 15/08 · noite:  P2, P1, P4, P3, P11, P8, P7
--   Domingo 16/08 · noite: P3, P4, P1, P2, P11, P6, P5
--
-- Convenção do RODAPÉ (a mesma de `ordem_liberacao`): a 1ª posição sai por
-- ÚLTIMO e a liberação corre de baixo para cima — o dono ditou nesse sentido
-- ("do último ao primeiro a serem liberados"), então a lista entra na ordem
-- falada, sem inversão.
--
-- Os quatro primeiros de cada noite são a linha 19-07 da grade (já publicada) e
-- continuam ganhando "Plantão Unimed/HRO" e o `foraDaFila` pela grade; o que
-- esta migration acrescenta são os Pn da lista numerada que também ficam à
-- noite e liberam PRIMEIRO. Por isso a fila vai em `fds_meta.ordemNoite`
-- (nomes): 'noturno' não é turno de publicação no banco — o CHECK de
-- `escala_cirurgica_caso.turno` só aceita matutino/vespertino — e o meta é
-- reenviado inteiro a cada republicação da conferência.
--
-- Nomes conferidos contra `fds_meta.posicoes` da própria linha. No domingo a
-- vaga do P3 está coberta por JOAO RICARDO (é o nome que está na grade 19-07),
-- e é ele quem entra na fila — a cobertura já aparece no card como "cobre
-- Cristina".
--
-- Idempotente: reescreve a chave com o valor final; rodar 2× dá o mesmo estado.

begin;

update public.escala_cirurgica
   set fds_meta = jsonb_set(
         coalesce(fds_meta, '{}'::jsonb), array['ordemNoite'],
         '["JOAO HENRIQUE","GUILHERME DIDOMENICO","MATHEUS","CRISTINA","GABRIEL","RAFAEL","MARILIO"]'::jsonb,
         true),
       updated_at = now()
 where data = '2026-08-15' and hospital = 'fds';

update public.escala_cirurgica
   set fds_meta = jsonb_set(
         coalesce(fds_meta, '{}'::jsonb), array['ordemNoite'],
         '["JOAO RICARDO","MATHEUS","GUILHERME DIDOMENICO","JOAO HENRIQUE","GABRIEL","ERLEI","GABRIELA"]'::jsonb,
         true),
       updated_at = now()
 where data = '2026-08-16' and hospital = 'fds';

commit;

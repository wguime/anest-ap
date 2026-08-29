-- Correção das filas de liberação do fim de semana 29–30/08 (reportado pelo
-- dono em 29/08, ~17h30: "a escala de hoje a tarde saiu com o badge e plantão
-- da Unimed de forma errada" + "hoje e amanhã a noite não saíram todos os
-- usuários de plantão na ordem estabelecida — faltam P5, P6, P7 e P8").
--
-- Convenção do RODAPÉ (a mesma de `ordem_liberacao` e de `fds_meta.ordemNoite`):
-- a 1ª posição sai por ÚLTIMO e a liberação corre de trás para frente.
--
-- Posições deste FDS (`fds_meta.posicoes`, iguais nos dois dias):
--   P1 NATHALIA · P2 GIOVANA · P3 ROMULO · P4 KARINE · P5 OSCAR · P6 RAQUEL
--   P7 KLISMAN · P8 GABRIEL · P9 GABRIELA · P10 ALEXANDRE D · P11 DANIELA
--   P12 HUMBERTO
--
-- ── 1) SÁBADO À TARDE — DANIELA cobre a vaga da KARINE ────────────────────
-- A leitura publicou a fila da tarde como P3,P4,P6,P5,P9,P10,P11: KARINE (P4)
-- na 2ª posição e DANIELA (P11) na ÚLTIMA. Mas a grade 13-19 põe DANIELA no
-- posto da Unimed — ela ganhava o badge "Plantão Unimed" sendo, ao mesmo
-- tempo, a PRIMEIRA a ser liberada. O dono confirmou o sentido: "Daniela está
-- no lugar de Karine (Daniela deve ocupar a segunda posição da escala de
-- liberações)". É o mesmo caso de SUBSTITUTO NA VAGA que a noite já trata
-- (JOAO RICARDO cobrindo a Cristina em 16/08), só que num turno de dia:
-- quem cobre assume o SLOT de quem foi coberto, e o coberto sai da fila.
--
-- Entram também NATHALIA (P1) e GIOVANA (P2), a retaguarda da faixa 13-19 que
-- a leitura perdeu do fim da linha — nos dois sábados anteriores (15/08 e
-- 22/08) a linha da tarde do documento termina exatamente em P1,P2, e vale a
-- regra de 22/08: quem está escalado no turno e não foi citado nunca some.
--
-- Fila final da tarde de sábado (rodapé):
--   P3 ROMULO · P4→DANIELA · P6 RAQUEL · P5 OSCAR · P9 GABRIELA ·
--   P10 ALEXANDRE D · P1 NATHALIA · P2 GIOVANA
--
-- `matutino` fica intocado (saiu correto) e `fds_meta.posicoes` também: DANIELA
-- continua sendo P11 no roster do fim de semana — o que muda é o SLOT que ela
-- ocupa na tarde. Mexer em `posicoes` quebraria a fila da noite, que chama P11
-- pelo número.
--
-- ── 2) AS DUAS NOITES — os P's da lista numerada que faltavam ──────────────
-- Ordem estabelecida em 16/08 e registrada em `.claude/rules/escala-fds-feriado.md`
-- ("A FILA DA NOITE É MAIOR QUE A GRADE"):
--   sábado:  P2, P1, P4, P3, P11, P8, P7
--   domingo: P3, P4, P1, P2, P11, P6, P5
-- As duas filas saíram só com os 4 primeiros (a linha 19-07 da grade), porque
-- a leitura do documento não extrai lista nem ordem da noite — `listas` e
-- `ordemLiberacaoDoc` da edge só existem para matutino/vespertino. Os quatro
-- da grade já casam com a ordem estabelecida nos dois dias, então esta
-- migration só ACRESCENTA os numerados que liberam primeiro.
--
-- Domingo: a vaga do P4 na faixa 19-07 está coberta por EDUARDO (é o nome que
-- está na grade), e é ele quem entra na fila — a cobertura já aparece no card
-- como "cobre Karine", pelo mesmo caminho do JOAO RICARDO em 16/08.
--
-- Idempotente: reescreve as chaves com o valor final; rodar 2× dá o mesmo
-- estado. Não toca em `liberacoes` nem em `linha_overrides` (ambos vazios
-- quando esta correção foi escrita).

begin;

-- Sábado 29/08 — fila da TARDE
update public.escala_cirurgica
   set ordem_liberacao = jsonb_set(
         coalesce(ordem_liberacao, '{}'::jsonb), array['vespertino'],
         '["ROMULO","DANIELA","RAQUEL","OSCAR","GABRIELA","ALEXANDRE D","NATHALIA","GIOVANA"]'::jsonb,
         true),
       updated_at = now()
 where data = '2026-08-29' and hospital = 'fds';

-- Sábado 29/08 — fila da NOITE (P2, P1, P4, P3, P11, P8, P7)
update public.escala_cirurgica
   set fds_meta = jsonb_set(
         coalesce(fds_meta, '{}'::jsonb), array['ordemNoite'],
         '["GIOVANA","NATHALIA","KARINE","ROMULO","DANIELA","GABRIEL","KLISMAN"]'::jsonb,
         true),
       updated_at = now()
 where data = '2026-08-29' and hospital = 'fds';

-- Domingo 30/08 — fila da NOITE (P3, P4→EDUARDO, P1, P2, P11, P6, P5)
update public.escala_cirurgica
   set fds_meta = jsonb_set(
         coalesce(fds_meta, '{}'::jsonb), array['ordemNoite'],
         '["ROMULO","EDUARDO","NATHALIA","GIOVANA","DANIELA","RAQUEL","OSCAR"]'::jsonb,
         true),
       updated_at = now()
 where data = '2026-08-30' and hospital = 'fds';

commit;

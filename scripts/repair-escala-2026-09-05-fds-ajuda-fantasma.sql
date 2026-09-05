-- REPAIR 2026-09-05 (sábado) — fila única do FDS: resíduo da "ajuda fantasma".
--
-- O defeito: a página passava `presencaOutros` para a fila única SEM o gate de
-- `modoFds`. No fim de semana o "hospital atual" da página segue sendo um dos
-- três, e os casos dos outros dois entravam como presença "de fora" — todo
-- mundo com cirurgia no HRO nasceu com o badge Ajuda (emprestado) na manhã de
-- 05/09, sem ninguém ter marcado nada. Ao tentar DESMARCAR, o toggle do painel
-- não achou o nome em `ajuda_externa` e o ADICIONOU (12:03, 45s depois de
-- publicar), e a origem "hro" foi gravada no override na mesma tentativa.
--
-- Estado errado (gravado às 15:03:31–33 UTC por quem publicou):
--   ajuda_externa.matutino = ["GUILHERME D"]
--   linha_overrides["matutino:LeFdhA2yKzaRujiU9diLhqa0dbB3"] = { origem: "hro", ... }
--
-- Sem este reparo, com o código corrigido o "GUILHERME D" deixaria de ser
-- "emprestado" e passaria a ser AJUDA declarada — a linha dele cairia da 1ª
-- posição do rodapé para o bloco do fim da fila.
--
-- A liberação "noite:GUILHERME D" (card da NOITE, 15:03:19) fica como está:
-- é um toque na aba Noturno, não faz parte da marcação de ajuda, e um toque
-- desfaz.
--
-- Idempotente: só age enquanto o estado errado estiver lá; ajuda_externa e
-- linha_overrides não disparam trigger de evento.

UPDATE escala_cirurgica
SET ajuda_externa = jsonb_set(coalesce(ajuda_externa, '{}'::jsonb), '{matutino}', '[]'::jsonb),
    linha_overrides = coalesce(linha_overrides, '{}'::jsonb) - 'matutino:LeFdhA2yKzaRujiU9diLhqa0dbB3'
WHERE data = '2026-09-05' AND hospital = 'fds'
  AND ajuda_externa -> 'matutino' = '["GUILHERME D"]'::jsonb;

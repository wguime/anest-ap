-- REPAIR 2026-09-01 vespertino — a ajuda do Eduardo Savoldi mora no MATERNO,
-- não no HRO (pedido do dono, 01/09: "Eduardo Savoldi é ajuda no materno e
-- mantém a posição dele no HRO conforme rodapé").
--
-- Estado errado: 'EDUARDO' na ajuda_externa do HRO vespertino — azul AQUI
-- significa "gente de fora ajudando NO HRO" e joga a linha dele para o bloco
-- do fim da fila do HRO (sai primeiro), fora da 9ª posição do rodapé. O certo
-- é o desenho que o matutino já tem: ajuda declarada NA ESCALA DO MATERNO
-- (onde estão os casos dele: Sala 3 HC à tarde) — com isso o HRO o mantém na
-- posição do rodapé com o badge derivado de Ajuda + destino (regra 30/07 +
-- ajuda declarada 31/08).
--
-- Idempotente: valores fixos; ajuda_externa não dispara trigger de evento.

UPDATE escala_cirurgica
SET ajuda_externa = jsonb_set(coalesce(ajuda_externa, '{}'::jsonb), '{vespertino}', '[]'::jsonb)
WHERE data = '2026-09-01' AND hospital = 'hro';

UPDATE escala_cirurgica
SET ajuda_externa = jsonb_set(coalesce(ajuda_externa, '{}'::jsonb), '{vespertino}', '["EDUARDO"]'::jsonb)
WHERE data = '2026-09-01' AND hospital = 'materno';

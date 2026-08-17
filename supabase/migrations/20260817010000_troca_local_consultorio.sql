-- Repõe o LOCAL informado nas trocas de 17/08 (HRO, matutino).
--
-- O dono informou "Consultório" para Gustavo Biesdorf e Janaína Favorito no
-- TrocaSheet, mas o `marcarTroca` do context montava o registro só com
-- uid/nome/tipo/motivo e DESCARTAVA o campo `local` — o dado nunca chegou ao
-- banco (corrigido no commit 76a332f; daqui em diante grava sozinho).
-- Esta migration recupera os dois registros já existentes para que a fila
-- mostre "Trocado com X (Consultório)" sem refazer a declaração à mão.
--
-- Idempotente: só escreve onde há trocaCom sem local.

begin;

-- ⚠️ sem o operador `?` do jsonb: a API de management trata "?" como
-- placeholder de parâmetro e a instrução não escreve nada (0 rows, silencioso).
-- `jsonb_exists`/`is not null` fazem o mesmo teste sem esse caractere.
-- Um UPDATE por chave: `update ... from (values ...)` casa a linha uma única
-- vez e a segunda chave ficaria de fora.

update public.escala_cirurgica
   set linha_overrides = jsonb_set(
         linha_overrides,
         array['matutino:HdyTIyiT1fSnGvsFJHcd2YLzJqt1', 'trocaCom', 'local'],
         '"Consultório"'::jsonb, true),
       updated_at = now()
 where data = '2026-08-17' and hospital = 'hro'
   and linha_overrides -> 'matutino:HdyTIyiT1fSnGvsFJHcd2YLzJqt1' -> 'trocaCom' is not null;  -- JANAÍNA FAVORITO

update public.escala_cirurgica
   set linha_overrides = jsonb_set(
         linha_overrides,
         array['matutino:JrmikQ5Ct9OXHmihdNxKTrYXtFJ3', 'trocaCom', 'local'],
         '"Consultório"'::jsonb, true),
       updated_at = now()
 where data = '2026-08-17' and hospital = 'hro'
   and linha_overrides -> 'matutino:JrmikQ5Ct9OXHmihdNxKTrYXtFJ3' -> 'trocaCom' is not null;  -- GUSTAVO BIESDORF

commit;

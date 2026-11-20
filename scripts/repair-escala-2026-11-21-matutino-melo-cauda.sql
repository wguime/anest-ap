-- Sábado 21/11/2026, manhã (fila única): "quero que a escala de amanhã Guilherme Melo não nasça livre,
-- ele tem que nascer liberado e é o próximo a ser chamado na lista após Raquel e antes de Guilherme
-- Xavier" (dono, 20/11 às 20h44).
--
-- Publicado: GUILHERME MELO em 7º da ordem da manhã, sem cirurgia, com Raul/Rose/Raquel trabalhando
-- abaixo → "Livre". A ordem passa a ter o Melo logo depois da RAQUEL e antes do GUILHERME D (=
-- Guilherme Xavier). Raquel é a última com cirurgia, então Melo, Xavier e Nathalia formam a cauda e
-- nascem LIBERADOS; convocar desce de cima para baixo, logo o Melo é o primeiro a ser chamado, e o
-- Xavier o seguinte. Só `ordem_liberacao.matutino` muda (posições Pn, tarde e noite intactas).
-- Idempotente: só aplica se a manhã ainda estiver como publicada. Assinado como o dono.
--
-- Uso: node scripts/deploy-sp21-mgmt-api.mjs apply-migration scripts/repair-escala-2026-11-21-matutino-melo-cauda.sql

begin;
set local lock_timeout = '3s';

do $$
declare v_n int;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', 'pPdKZ75E9zNdPnLz50qisPiHfJw1', 'role', 'authenticated')::text, true);

  update public.escala_cirurgica e
     set ordem_liberacao = jsonb_set(e.ordem_liberacao, '{matutino}',
           '["DANIELA","ROMULO","LEONARDO","GIOVANA","GUSTAVO","KLISMAN","RAUL","ROSE","RAQUEL","GUILHERME MELO","GUILHERME D","NATHALIA"]'::jsonb)
   where e.data = date '2026-11-21' and e.hospital = 'fds'
     and e.ordem_liberacao->'matutino' =
           '["DANIELA","ROMULO","LEONARDO","GIOVANA","GUSTAVO","KLISMAN","GUILHERME MELO","RAUL","ROSE","RAQUEL","GUILHERME D","NATHALIA"]'::jsonb;
  get diagnostics v_n = row_count;
  raise notice 'manhã de 21/11: ordem refeita em % linha(s)', v_n;
end $$;

commit;

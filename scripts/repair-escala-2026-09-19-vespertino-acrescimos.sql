-- Sábado 19/09/2026, tarde (fila única): acréscimos ditados pelo dono às 12h30 —
-- "adicione os procedimentos e/ou cirurgiões aos anestesistas: Escalas da tarde
--   Tiago - Unimed piekela / pagani
--   Nathy - hro
--   Ale d - Unimed robótica continuação
--   Gui dido - hro - captação - urgência
--   Aline - Unimed zeni / frigeri
--   Leandro - Unimed aymone continuação / baroncelo"
--
-- O que JÁ estava no banco (definido na tela antes do pedido, conferido às 12h40):
--   Tiago  → CC - Sala 1 13:30 Piekala + 16:45 Cavanus Pagani
--   Nathy  → HRO Sala 4 13:00 + AS + AS (Geovan Oliveira)
--   Aline  → CC - Sala 6 15:00 Frigeri
-- O que este reparo ACRESCENTA (5 casos, origem 'manual', turno vespertino):
--   Alexandre D → CC - Sala 10 13:00 CONTINUAÇÃO (Ivanor Alba — a robótica das 12:30, 4h45)
--   Aline       → CC - Sala 6  13:00 CONTINUAÇÃO (Marcelo Zeni — a RTU das 12:45, 2h)
--   Leandro     → CC          13:00 CONTINUAÇÃO (Aymone) — sem sala no recado, fica "CC"
--   Leandro     → CC          AS    (João Batista Baroncello) — sem hora/sala no recado
--   G. Didomenico → HRO Sala 5 13:00 CAPTAÇÃO DE ÓRGÃOS, tipo urgência (é a sala das
--                   captações anteriores do HRO)
-- Sem paciente, convênio e tempo: o recado não traz — a cobrança não abre (nenhum é
-- particular). Assinado como o dono via request.jwt.claims, como a publicação por
-- script. Sem republicar: o turno está em uso (liberações e acionamentos gravados).
--
-- Uso: node scripts/deploy-sp21-mgmt-api.mjs apply-migration scripts/repair-escala-2026-09-19-vespertino-acrescimos.sql
--      (ensaio: trocar o `commit;` final por `rollback;`)

begin;
set local lock_timeout = '3s';
select set_config('request.jwt.claims',
  json_build_object('sub', 'pPdKZ75E9zNdPnLz50qisPiHfJw1', 'role', 'authenticated')::text, true);

do $$
declare
  v_unimed uuid;
  v_hro uuid;
  v_n int;
begin
  select id into v_unimed from public.escala_cirurgica where data = date '2026-09-19' and hospital = 'unimed';
  select id into v_hro    from public.escala_cirurgica where data = date '2026-09-19' and hospital = 'hro';
  if v_unimed is null or v_hro is null then
    raise exception 'escalas de 19/09 (unimed/hro) não encontradas — nada gravado';
  end if;

  -- pré-condição 1: o que o recado dá como já definido está mesmo no banco
  select count(*) into v_n from public.escala_cirurgica_caso
   where escala_id = v_unimed and turno = 'vespertino' and sala = 'CC - Sala 1' and anestesista_user_id = 'BMPF3saZ7QZYqgHptZjFJYn7GxT2';
  if v_n <> 2 then raise exception 'esperava as 2 cirurgias da Sala 1 com TIAGO, achei % — nada gravado', v_n; end if;
  select count(*) into v_n from public.escala_cirurgica_caso
   where escala_id = v_hro and turno = 'vespertino' and sala = 'Sala 4' and anestesista_user_id = 'aBU1Aju6cIME4qdLSbDsGC3w6cy1';
  if v_n <> 3 then raise exception 'esperava as 3 cirurgias da Sala 4 do HRO com NATHALIA, achei % — nada gravado', v_n; end if;
  select count(*) into v_n from public.escala_cirurgica_caso
   where escala_id = v_unimed and turno = 'vespertino' and sala = 'CC - Sala 6' and anestesista_user_id = 'EiBqBh5P79Vo0pJNjvm0NEiMyW53';
  if v_n <> 1 then raise exception 'esperava a Sala 6 15:00 com ALINE, achei % — nada gravado', v_n; end if;

  -- pré-condição 2: idempotência — nenhum dos acréscimos já existe
  select count(*) into v_n from public.escala_cirurgica_caso
   where escala_id in (v_unimed, v_hro) and turno = 'vespertino' and origem = 'manual'
     and (procedimento ilike 'CONTINUA%' or procedimento ilike 'CAPTA%' or cirurgiao ilike '%BARONCELLO%');
  if v_n <> 0 then raise exception 'já existem % acréscimo(s) manual(is) na tarde de 19/09 — nada gravado', v_n; end if;

  insert into public.escala_cirurgica_caso
    (escala_id, turno, sala, ordem, hora, procedimento, cirurgiao, anestesista, anestesista_user_id,
     is_continuacao, sem_anestesista, tipo, origem, bloco, status_cirurgia, paciente_iniciais, idade, convenio)
  values
    (v_unimed, 'vespertino', 'CC - Sala 10', 0, '13:00', 'CONTINUAÇÃO', 'IVANOR ALBA',
       'ALEXANDRE D', 'aEOzX1qmPWc8695fwDJolfPWVtP2', true, false, 'eletiva', 'manual', 'normal', 'agendada', '', '', ''),
    (v_unimed, 'vespertino', 'CC - Sala 6', 0, '13:00', 'CONTINUAÇÃO', 'MARCELO ZENI',
       'ALINE', 'EiBqBh5P79Vo0pJNjvm0NEiMyW53', true, false, 'eletiva', 'manual', 'normal', 'agendada', '', '', ''),
    (v_unimed, 'vespertino', 'CC', 0, '13:00', 'CONTINUAÇÃO', 'AYMONE',
       'LEANDRO', 'n6wY96vUUVejOrcUulYesfhhCkI2', true, false, 'eletiva', 'manual', 'normal', 'agendada', '', '', ''),
    (v_unimed, 'vespertino', 'CC', 1, 'AS', 'CIRURGIA (RECADO DO DONO)', 'JOAO BATISTA BARONCELLO',
       'LEANDRO', 'n6wY96vUUVejOrcUulYesfhhCkI2', false, false, 'eletiva', 'manual', 'normal', 'agendada', '', '', ''),
    (v_hro, 'vespertino', 'Sala 5', 0, '13:00', 'CAPTAÇÃO DE ÓRGÃOS', '',
       'GUILHERME DIDOMENICO', 'LeFdhA2yKzaRujiU9diLhqa0dbB3', false, false, 'urgencia', 'manual', 'normal', 'agendada', '', '', '');
  get diagnostics v_n = row_count;
  raise notice 'tarde de 19/09: % caso(s) acrescentado(s)', v_n;

  -- a Sala 6 da tarde já tinha a linha das 15:00 em ordem 2 (publicação); a continuação
  -- das 13:00 entra em ordem 0 e fica antes dela na Completa, sem mexer na existente
end $$;

-- verificação (vai junto na resposta)
select e.hospital, c.sala, c.ordem, c.hora, c.procedimento, c.cirurgiao, c.anestesista, c.tipo, c.origem
  from public.escala_cirurgica_caso c
  join public.escala_cirurgica e on e.id = c.escala_id
 where e.data = date '2026-09-19' and e.hospital in ('unimed', 'hro') and c.turno = 'vespertino'
 order by e.hospital, c.sala, c.ordem, c.hora;

commit;

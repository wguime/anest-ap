-- Reparo da escala cirúrgica de 08/09/2026 (matutino) — leitura da Vision saiu torta
-- depois da Onda 4 e o dono pediu as escalas corretas NO AR antes da correção do código.
--
-- Por que reparo em vez de republicar: às 09:50 o turno já estava em uso (8 status
-- marcados, 2 liberações, 1 remanejamento de sala e 2 observações). Republicar é
-- DELETE+reinsert e zeraria tudo isso. Aqui só o que a leitura errou muda, linha a linha,
-- casando por (sala, ordem, iniciais) e abortando se qualquer contagem divergir.
--
-- Fonte: as três fotos do dia (Unimed 1600×1180, HRO 897×635, Materno 1239×467), lidas
-- à mão. Materno estava certo (7 casos da manhã) e não é tocado.
--
-- Uso: node scripts/deploy-sp21-mgmt-api.mjs apply-migration scripts/repair-escala-2026-09-08-matutino-leitura.sql
--      (ensaio: trocar o `commit;` final por `rollback;`)

begin;
set local lock_timeout = '3s';

do $$
declare
  v_unimed uuid := 'c2d4ab17-a4a5-4d37-afad-a7d9fe2c7f85';
  v_hro    uuid := 'a864155b-a41f-4e2e-a671-9239e2e77d3d';
  v_dono   text := 'pPdKZ75E9zNdPnLz50qisPiHfJw1';
  n int;
begin
  -- guarda: as duas escalas são as de 08/09 e ainda estão como vimos
  if (select count(*) from public.escala_cirurgica where id in (v_unimed, v_hro) and data = '2026-09-08') <> 2 then
    raise exception 'reparo: escalas de 08/09 não são as esperadas';
  end if;
  if (select count(*) from public.escala_cirurgica_caso where escala_id = v_hro and turno = 'matutino') <> 15 then
    raise exception 'reparo: HRO não tem mais 15 casos — estado mudou, revisar';
  end if;
  if (select count(*) from public.escala_cirurgica_caso where escala_id = v_unimed and turno = 'matutino') <> 37 then
    raise exception 'reparo: Unimed não tem mais 37 casos — estado mudou, revisar';
  end if;

  ------------------------------------------------------------------
  -- UNIMED — a coluna SALA da planilha traz "08/09/2026 07:30"; a hora ficou
  -- nula (ou "07"/"11"/"0730") em 30 cirurgias. Valor da foto, uma a uma.
  ------------------------------------------------------------------
  update public.escala_cirurgica_caso c
     set hora = v.hora
    from (values
      ('CO - Cesárea',  0, 'J.T.T.',    '07:30'),
      ('CO - Cesárea',  1, 'J.B.M.',    '11:00'),
      ('CO - Sala 3',   2, 'D.L.G.',    '07:30'),
      ('CO - Sala 3',   3, 'M.D.S.',    '08:15'),
      ('CO - Sala 3',   4, 'I.T.',      '09:00'),
      ('CO - Sala 3',   5, 'I.P.',      '09:45'),
      ('Hemodinâmica',  6, 'F.L.D.S.',  '07:30'),
      ('CC - Sala 1',   7, 'C.F.D.O.',  '07:30'),
      ('CC - Sala 1',   8, 'J.P.',      '09:15'),
      ('CC - Sala 1',   9, 'T.B.D.C.',  '11:00'),
      ('CC - Sala 2',  10, 'C.L.P.',    '07:30'),
      ('CC - Sala 2',  11, 'A.S.D.S.',  '09:00'),
      ('CC - Sala 2',  12, 'H.J.M.',    '10:30'),
      ('CC - Sala 2',  13, 'J.V.F.',    '11:45'),
      ('CC - Sala 3',  14, 'Z.C.M.',    '07:30'),
      ('CC - Sala 3',  15, 'C.M.R.B.',  '08:45'),
      ('CC - Sala 3',  16, 'C.V.',      '10:00'),
      ('CC - Sala 3',  17, 'C.A.G.',    '12:15'),
      ('CC - Sala 4',  18, 'I.R.R.',    '07:30'),
      ('CC - Sala 5',  19, 'C.D.M.',    '07:30'),
      ('CC - Sala 5',  20, 'K.C.L.',    '09:00'),
      ('CC - Sala 5',  21, 'E.W.',      '10:15'),
      ('CC - Sala 6',  22, 'J.P.D.S.',  '07:30'),
      ('CC - Sala 6',  23, 'C.A.R.S.',  '08:30'),
      ('CC - Sala 7',  24, 'M.C.B.',    '07:30'),
      ('CC - Sala 7',  25, 'M.R.D.R.',  '09:00'),
      ('CC - Sala 7',  26, 'L.H.D.',    '10:30'),
      ('CC - Sala 7',  27, 'L.C.T.',    '12:00'),
      ('CC - Sala 10', 28, 'C.M.',      '07:00'),
      ('CC - Sala 10', 29, 'S.D.M.D.O.','12:15')
    ) as v(sala, ordem, ini, hora)
   where c.escala_id = v_unimed and c.turno = 'matutino'
     and c.sala = v.sala and c.ordem = v.ordem and c.paciente_iniciais = v.ini;
  get diagnostics n = row_count;
  if n <> 30 then raise exception 'reparo unimed: esperava 30 horas, atualizou %', n; end if;

  -- cesariana das 11:00 está com "?" na foto — nunca foi do Klisman
  update public.escala_cirurgica_caso
     set anestesista = '?', anestesista_user_id = null, sem_anestesista = true
   where escala_id = v_unimed and turno = 'matutino' and sala = 'CO - Cesárea' and ordem = 1
     and paciente_iniciais = 'J.B.M.' and anestesista_user_id = '51f8weKjQIeuqCifNlULFTz0zax2';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'reparo unimed: cesariana 11:00 não casou (%)', n; end if;

  -- miudezas de leitura (texto), sem efeito operacional
  update public.escala_cirurgica_caso set procedimento = replace(procedimento, 'E U PLASTIA', 'E OU PLASTIA')
   where escala_id = v_unimed and turno = 'matutino' and procedimento like '%E U PLASTIA%';
  get diagnostics n = row_count;
  if n <> 2 then raise exception 'reparo unimed: "E U PLASTIA" esperava 2, achou %', n; end if;
  update public.escala_cirurgica_caso set idade = '44a 11m 28d' where escala_id = v_unimed and turno = 'matutino' and paciente_iniciais = 'E.W.' and idade = '44a 11m 28';
  update public.escala_cirurgica_caso set idade = '71a 10m 14d' where escala_id = v_unimed and turno = 'matutino' and paciente_iniciais = 'I.T.' and idade = '71a 10m 14';
  update public.escala_cirurgica_caso set idade = '4a 10m 12d'  where escala_id = v_unimed and turno = 'matutino' and paciente_iniciais = 'L.H.D.' and idade = '4a 10m 24d';

  ------------------------------------------------------------------
  -- HRO — a leitura parou no Bloco A/M/Hemo: faltaram EXAMES, IOSC (5), 04 EDA,
  -- HO (2), AMBULAT. e SIMONE, e o rodapé veio VAZIO (sem ordem de liberação).
  ------------------------------------------------------------------
  insert into public.escala_cirurgica_caso
    (escala_id, sala, ordem, hora, tempo_estimado, paciente_iniciais, idade, procedimento, convenio,
     cirurgiao, anestesista, anestesista_user_id, bloco, sem_anestesista, tipo, turno, origem)
  values
    (v_hro, 'Exames',            15, '07:30', null, null,   null, '03 EDA C/ COLO + 01 EDA',                 null,   'Maridiane',         'DANIELA',     'Dcbb3U7D1cWIeRrIEQNTMySDcDp2', 'exames', false, 'eletiva', 'matutino', 'importacao'),
    (v_hro, 'IOSC',              16, '07:30', null, 'S.C.', null, 'LIPOENXERTIA GLÚTEA + LIPOASPIRAÇÃO',      'PART', 'Cassiano Beller',   'EDUARDO',     'kT5DXggGZnc15mfGAYuAhOW4J5w1', 'iosc',   false, 'eletiva', 'matutino', 'importacao'),
    (v_hro, 'IOSC',              17, '07:30', null, 'F.D.', null, 'ADENOIDECTOMIA POR VIDEOENDOSCOPIA',       'SC',   'Larissa Marchi',    'ERLEI',       'zgiKSWgcRcYnfanHzC5QVcvkmDJ3', 'iosc',   false, 'eletiva', 'matutino', 'importacao'),
    (v_hro, 'IOSC',              18, 'AS',    null, 'S.T.', null, 'SEPTOPLASTIA + SINUSECTOMIA MAXILAR',      'BRF',  'Larissa Marchi',    'ERLEI',       'zgiKSWgcRcYnfanHzC5QVcvkmDJ3', 'iosc',   false, 'eletiva', 'matutino', 'importacao'),
    (v_hro, 'IOSC',              19, '07:30', null, 'D.L.', null, 'PRÓTESE DE GLÚTEO',                        'PART', 'Jorge Valentini',   'MAURICIO',    'jU6vO24WxJXTrqVTTdAoSiRXRyg1', 'iosc',   false, 'eletiva', 'matutino', 'importacao'),
    (v_hro, 'IOSC',              20, 'AS',    null, 'T.L.', null, 'RETOQUE DE LIPOASPIRAÇÃO + BLEFAROPLASTIA','PART', 'Jorge Valentini',   'MAURICIO',    'jU6vO24WxJXTrqVTTdAoSiRXRyg1', 'iosc',   false, 'eletiva', 'matutino', 'importacao'),
    (v_hro, 'Exames',            21, '08:00', null, null,   null, '04 EDA',                                  null,   'Fernanda Annes',    'GUILHERME D', 'LeFdhA2yKzaRujiU9diLhqa0dbB3', 'exames', false, 'eletiva', 'matutino', 'importacao'),
    (v_hro, 'Hospital de Olhos', 22, '08:00', null, null,   null, '02 FACO c/ tópica',                       null,   'Luiggi',            'RAUL',        'ARHMFkzl0ebfWWnEzha1QtNdvMo1', 'ho',     false, 'eletiva', 'matutino', 'importacao'),
    (v_hro, 'Hospital de Olhos', 23, '11:00', null, null,   null, '01 FACO c/ bloqueio',                     null,   'Vinicius',          '?',           null,                           'ho',     true,  'eletiva', 'matutino', 'importacao'),
    (v_hro, 'AMBULAT.',          24, '08:00', '8H', null,   null, 'TRANSPLANTE CAPILAR – 8H',                null,   'Clínica do Cabelo', 'COSTA',       'B7ccb01iPSeHuIdSe5z0XRbCF4z2', 'normal', false, 'eletiva', 'matutino', 'importacao'),
    (v_hro, 'SIMONE',            25, '08:00', null, null,   null, '01 PROCEDIMENTO',                         null,   null,                'VICENTE',     'w8Cf3Y3YxPTBToQOjUFsO8RAmvp2', 'simone', false, 'eletiva', 'matutino', 'importacao');
  get diagnostics n = row_count;
  if n <> 11 then raise exception 'reparo hro: esperava 11 casos novos, inseriu %', n; end if;

  update public.escala_cirurgica
     set ordem_liberacao = jsonb_set(coalesce(ordem_liberacao, '{}'::jsonb), '{matutino}',
           '["ALINE","ROMULO","MAURICIO","COSTA","STAUB","JANAINA","FERNANDO","TIAGO","EDUARDO","ERLEI","RAFAEL","DANIELA","MATHEUS (CONSULT)","GUILHERME DIDOMENICO","VICENTE","RAUL","HUMBERTO"]'::jsonb, true),
         publicacao_turnos = jsonb_set(coalesce(publicacao_turnos, '{}'::jsonb), '{matutino,casos}', '26'::jsonb, true)
   where id = v_hro and jsonb_array_length(coalesce(ordem_liberacao->'matutino', '[]'::jsonb)) = 0;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'reparo hro: rodapé já não estava vazio (%)', n; end if;

  -- rastro: o mesmo evento que a RPC grava ao publicar, marcado como reparo
  insert into public.escala_cirurgica_evento (tipo, escala_id, data, hospital, por, em, detalhe)
  values
    ('publicacao', v_hro,    '2026-09-08', 'hro',    v_dono, now(), '{"turno":"matutino","status":"publicada","casos":26,"reparo":"leitura-vision-2026-09-08","script":"scripts/repair-escala-2026-09-08-matutino-leitura.sql"}'::jsonb),
    ('publicacao', v_unimed, '2026-09-08', 'unimed', v_dono, now(), '{"turno":"matutino","status":"publicada","casos":37,"reparo":"leitura-vision-2026-09-08","script":"scripts/repair-escala-2026-09-08-matutino-leitura.sql"}'::jsonb);
end $$;

commit;

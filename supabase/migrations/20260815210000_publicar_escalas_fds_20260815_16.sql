-- Publicação das escalas do FIM DE SEMANA 15–16/08/2026 (ordem do dono, 15/08
-- ~20h, via chat): Unimed + HRO (sáb/dom, matutino+vespertino) + fila única
-- 'fds' dos dois dias, transcritas dos documentos enviados por ele.
--
-- Caminho: a PRÓPRIA rpc_publicar_escala_turno (transacional, com namespacing,
-- publicacao_turnos e evento de auditoria), executada com o uid REAL do dono
-- via request.jwt.claims (mesmo mecanismo do PostgREST) — nunca 'admin'/'system'.
-- Precedente de operação de dados via migration: 20260804235000 / 20260805002000.
--
-- Acréscimos ditados pelo dono (inferência de dia reportada no chat):
--   · Unimed DOM 07:30 CC - Sala 10 Robótica — anastomose coloanal (Vendrame),
--     RAFAEL, antes da robótica das 09:00;
--   · HRO DOM 07:30 Hemodinâmica — embolização (paciente C.), THAYNA.
--
-- LGPD: paciente SÓ por iniciais (CHECK da tabela). Exceção legal: os 2 casos
-- PARTICULARES (PART sáb HRO · PARTICULAR dom Unimed) têm o nome completo
-- gravado APENAS no rascunho de cobrança em cirurgias_particulares (base
-- art. 11 II "d" — header da migration 20260722100000), espelhando o
-- completarPacienteDoCaso do fluxo Vision.
--
-- Ordem de liberação da linha 'fds': INVERSA da linha do documento ("1º→último
-- a ser LIBERADO") — convenção do rodapé (1ª posição sai por último). Domingo
-- não traz a linha → ordem SUGERIDA (= ordem de escalação), ordemFonte
-- 'sugerida' (decisão do dono 15/08: sugerir + ajustar).

begin;

-- Identidade do executor (dono, conta principal wguime) para firebase_uid()
-- e can_write_escala_cirurgica() — vale só nesta transação.
select set_config(
  'request.jwt.claims',
  '{"sub":"pPdKZ75E9zNdPnLz50qisPiHfJw1","role":"authenticated"}',
  true
);

-- ════════════════════════════════ SÁBADO 15/08 ══════════════════════════════

-- UNIMED · matutino
select public.rpc_publicar_escala_turno(
  '2026-08-15'::date, 'unimed', 'matutino',
  '{"status":"publicada","ordem_liberacao":[],"ajuda_externa":[],"published_by_name":"GUILHERME MELO"}'::jsonb,
  $$[
    {"sala":"CO - Sala 3","ordem":0,"hora":"07:30","tempo_estimado":"01:15","paciente_iniciais":"I.S.R.","idade":"26a","procedimento":"Cesariana","convenio":"Unimed Intercâmbio Estadual","cirurgiao":"Taissa Seminate","anestesista":"STAUB"},
    {"sala":"CC - Sala 1","ordem":1,"hora":"07:30","tempo_estimado":"03:00","paciente_iniciais":"L.R.A.","idade":"82a","procedimento":"Revisão de artroplastia de quadril com retirada de componentes e implantes de prótese (Porte 7)","convenio":"Intercâmbio Mercosul - PR/RS","cirurgiao":"Airton Luiz Pagani","anestesista":"MARILIO + GABRIEL"},
    {"sala":"CC - Sala 1","ordem":2,"hora":"10:45","tempo_estimado":"02:45","paciente_iniciais":"C.D.A.","idade":"58a","procedimento":"Artroplastia (qualquer técnica ou versão de quadril) - tratamento cirúrgico","convenio":"Unimed Chapecó - VD","cirurgiao":"Airton Luiz Pagani","anestesista":"MARILIO"},
    {"sala":"CC - Sala 2","ordem":3,"hora":"07:30","tempo_estimado":"01:15","paciente_iniciais":"C.S.","idade":"3a","procedimento":"Himenotomia","convenio":"Unimed Intercâmbio Estadual","cirurgiao":"Ricardo Filipak","anestesista":"GABRIELA"},
    {"sala":"CC - Sala 2","ordem":4,"hora":"09:00","tempo_estimado":"01:45","paciente_iniciais":"M.V.C.H.","idade":"5a","procedimento":"Hérnia inguinal em criança - unilateral","convenio":"Unimed Chapecó - VD","cirurgiao":"Ricardo Filipak","anestesista":"//"},
    {"sala":"CC - Sala 2","ordem":5,"hora":"11:00","tempo_estimado":"01:15","paciente_iniciais":"B.E.C.H.","idade":"6a","procedimento":"Hérnia inguinal em criança - unilateral","convenio":"Unimed Chapecó - VD","cirurgiao":"Ricardo Filipak","anestesista":"//"},
    {"sala":"CC - Sala 6","ordem":6,"hora":"07:30","tempo_estimado":"01:30","paciente_iniciais":"S.M.G.","idade":"45a","procedimento":"Varizes - tratamento cirúrgico de um membro","convenio":"Unimed Intercâmbio Estadual","cirurgiao":"Fernando Bonetto Schinko","anestesista":"GUILHERME DIDOMENICO"},
    {"sala":"CC - Sala 6","ordem":7,"hora":"09:15","tempo_estimado":"01:30","paciente_iniciais":"P.S.","idade":"27a","procedimento":"Varizes - tratamento cirúrgico bilateral","convenio":"Unimed Intercâmbio Estadual","cirurgiao":"Fernando Bonetto Schinko","anestesista":"//"}
  ]$$::jsonb
);

-- UNIMED · vespertino (documento SEM anestesista — quem assume vem da fila única)
select public.rpc_publicar_escala_turno(
  '2026-08-15'::date, 'unimed', 'vespertino',
  '{"status":"publicada","ordem_liberacao":[],"ajuda_externa":[],"published_by_name":"GUILHERME MELO"}'::jsonb,
  $$[
    {"sala":"CC - Sala 1","ordem":0,"hora":"13:45","tempo_estimado":"01:30","paciente_iniciais":"L.M.L.V.","idade":"34a","procedimento":"Reconstrução, retencionamento ou reforço do ligamento cruzado anterior ou posterior","convenio":"Unimed Chapecó - VD","cirurgiao":"Rodolfo Cavanus Pagani","anestesista":"","sem_anestesista":"true"},
    {"sala":"CC - Sala 1","ordem":1,"hora":"15:30","tempo_estimado":"01:30","paciente_iniciais":"J.N.S.","idade":"62a","procedimento":"Meniscectomia - um menisco","convenio":"Unimed Intercâmbio Estadual","cirurgiao":"Rodolfo Cavanus Pagani","anestesista":"","sem_anestesista":"true"},
    {"sala":"CC - Sala 1","ordem":2,"hora":"17:15","tempo_estimado":"01:00","paciente_iniciais":"M.F.","idade":"33a","procedimento":"Hallux valgus (um pé) - tratamento cirúrgico","convenio":"Unimed Intercâmbio Estadual","cirurgiao":"Airton Luiz Pagani","anestesista":"","sem_anestesista":"true"},
    {"sala":"CC - Sala 2","ordem":3,"hora":"13:30","tempo_estimado":"03:00","paciente_iniciais":"D.F.M.V.","idade":"34a","procedimento":"Artrodese da coluna com instrumentação por segmento","convenio":"Unimed Chapecó - VD","cirurgiao":"Eduardo Felipe Martinelli Baldissera","anestesista":"","sem_anestesista":"true"},
    {"sala":"CC - Sala 2","ordem":4,"hora":"16:45","tempo_estimado":"02:00","paciente_iniciais":"D.C.S.Z.","idade":"40a","procedimento":"Artrodese da coluna vertebral via anterior ou póstero-lateral - tratamento cirúrgico","convenio":"Unimed Intercâmbio Estadual","cirurgiao":"Eduardo Felipe Martinelli Baldissera","anestesista":"","sem_anestesista":"true"}
  ]$$::jsonb
);

-- HRO · matutino (último caso da Sala 4 veio com a célula ANEST em branco no
-- documento — publicado como "sem anestesista", fiel à imagem; regra da casa:
-- nunca chutar identidade. Reportado ao dono.)
select public.rpc_publicar_escala_turno(
  '2026-08-15'::date, 'hro', 'matutino',
  '{"status":"publicada","ordem_liberacao":[],"ajuda_externa":[],"published_by_name":"GUILHERME MELO"}'::jsonb,
  $$[
    {"sala":"Sala 1","ordem":0,"hora":"07:00","paciente_iniciais":"C.J.R.","idade":"41a","procedimento":"Reconstrução, retencionamento ou reforço do ligamento","convenio":"SC","cirurgiao":"Carlos Mendonca","anestesista":"ERLEI"},
    {"sala":"Sala 2","ordem":1,"hora":"07:00","paciente_iniciais":"C.J.A.","idade":"51a","procedimento":"Hérnia de disco - tratamento cirúrgico","convenio":"PART","cirurgiao":"Guilherme Martins","anestesista":"RAFAEL"},
    {"sala":"Sala 4","ordem":2,"hora":"07:00","paciente_iniciais":"C.B.M.","idade":"50a","procedimento":"Fratura diafisária única do rádio/ulna + luxação do cotovelo","convenio":"SUS","cirurgiao":"Gracieli Paludo","anestesista":"JOAO HENRIQUE"},
    {"sala":"Sala 4","ordem":3,"hora":"AS","paciente_iniciais":"D.C.C.","idade":"12a","procedimento":"Fratura da extremidade/metáfise distal dos ossos do antebraço","convenio":"SUS","cirurgiao":"Gracieli Paludo","anestesista":"//"},
    {"sala":"Sala 4","ordem":4,"hora":"AS","paciente_iniciais":"N.M.J.F.","idade":"67a","procedimento":"Tratamento cirúrgico de fratura diafisária única do rádio/ulna","convenio":"SUS","cirurgiao":"Gracieli Paludo","anestesista":"//"},
    {"sala":"Sala 4","ordem":5,"hora":"AS","paciente_iniciais":"I.C.","idade":"45a","procedimento":"Tenorrafia única em túnel osteo-fibroso","convenio":"SUS","cirurgiao":"Gracieli Paludo","anestesista":"","sem_anestesista":"true"}
  ]$$::jsonb
);

-- HRO · vespertino (sem anestesista no documento — fila única decide)
select public.rpc_publicar_escala_turno(
  '2026-08-15'::date, 'hro', 'vespertino',
  '{"status":"publicada","ordem_liberacao":[],"ajuda_externa":[],"published_by_name":"GUILHERME MELO"}'::jsonb,
  $$[
    {"sala":"Sala 4","ordem":0,"hora":"13:00","paciente_iniciais":"L.A.H.M.","idade":"55a","procedimento":"Tratamento cirúrgico de fratura diafisária única do rádio/ulna","convenio":"SUS","cirurgiao":"Diego Nascimento","anestesista":"","sem_anestesista":"true"},
    {"sala":"Sala 4","ordem":1,"hora":"AS","paciente_iniciais":"G.A.S.","idade":"64a","procedimento":"Fratura-luxação metacarpofalangiana","convenio":"SUS","cirurgiao":"Gracieli Paludo","anestesista":"","sem_anestesista":"true"},
    {"sala":"Sala 4","ordem":2,"hora":"AS","paciente_iniciais":"M.P.F.","idade":"45a","procedimento":"Fratura/lesão fisária das falanges da mão","convenio":"SUS","cirurgiao":"Diego Nascimento","anestesista":"","sem_anestesista":"true"}
  ]$$::jsonb
);

-- FILA ÚNICA 'fds' · sábado (ordens EXPLÍCITAS do documento, invertidas p/ o rodapé)
select public.rpc_publicar_escala_turno(
  '2026-08-15'::date, 'fds', 'matutino',
  $$
  {"status":"publicada","published_by_name":"GUILHERME MELO",
   "ordem_liberacao":["GUILHERME DIDOMENICO","JOAO HENRIQUE","MARILIO","RAFAEL","GABRIELA","ERLEI","GABRIEL","STAUB","ROBERTA","VICENTE","CRISTINA","MATHEUS"],
   "ajuda_externa":[],
   "fds_meta":{
     "grade":{
       "7-13":{"unimed":"GUILHERME DIDOMENICO","hro":"JOAO HENRIQUE","ret1":"CRISTINA","ret2":"MATHEUS"},
       "13-19":{"unimed":"CRISTINA","hro":"MATHEUS","ret1":"GUILHERME DIDOMENICO","ret2":"JOAO HENRIQUE"},
       "19-07":{"unimed":"JOAO HENRIQUE","hro":"GUILHERME DIDOMENICO","ret1":"MATHEUS","ret2":"CRISTINA"}},
     "posicoes":{"P1":"GUILHERME DIDOMENICO","P2":"JOAO HENRIQUE","P3":"CRISTINA","P4":"MATHEUS","P5":"GABRIELA","P6":"ERLEI","P7":"MARILIO","P8":"RAFAEL","P9":"ROBERTA","P10":"STAUB","P11":"GABRIEL","P12":"VICENTE"},
     "escalacao":{"matutino":["P5","P6","P7","P8","P9","P10","P11","P12"],"vespertino":["P6","P5","P9","P10","P11"]},
     "ordemFonte":{"matutino":"documento","vespertino":"documento"}}}
  $$::jsonb,
  '[]'::jsonb
);
select public.rpc_publicar_escala_turno(
  '2026-08-15'::date, 'fds', 'vespertino',
  $$
  {"status":"publicada","published_by_name":"GUILHERME MELO",
   "ordem_liberacao":["CRISTINA","MATHEUS","ERLEI","GABRIELA","ROBERTA","STAUB","GABRIEL"],
   "ajuda_externa":[],
   "fds_meta":{
     "grade":{
       "7-13":{"unimed":"GUILHERME DIDOMENICO","hro":"JOAO HENRIQUE","ret1":"CRISTINA","ret2":"MATHEUS"},
       "13-19":{"unimed":"CRISTINA","hro":"MATHEUS","ret1":"GUILHERME DIDOMENICO","ret2":"JOAO HENRIQUE"},
       "19-07":{"unimed":"JOAO HENRIQUE","hro":"GUILHERME DIDOMENICO","ret1":"MATHEUS","ret2":"CRISTINA"}},
     "posicoes":{"P1":"GUILHERME DIDOMENICO","P2":"JOAO HENRIQUE","P3":"CRISTINA","P4":"MATHEUS","P5":"GABRIELA","P6":"ERLEI","P7":"MARILIO","P8":"RAFAEL","P9":"ROBERTA","P10":"STAUB","P11":"GABRIEL","P12":"VICENTE"},
     "escalacao":{"matutino":["P5","P6","P7","P8","P9","P10","P11","P12"],"vespertino":["P6","P5","P9","P10","P11"]},
     "ordemFonte":{"matutino":"documento","vespertino":"documento"}}}
  $$::jsonb,
  '[]'::jsonb
);

-- ═══════════════════════════════ DOMINGO 16/08 ══════════════════════════════

-- UNIMED · matutino (+ acréscimo: anastomose coloanal 07:30, antes da robótica — RAFAEL)
select public.rpc_publicar_escala_turno(
  '2026-08-16'::date, 'unimed', 'matutino',
  '{"status":"publicada","ordem_liberacao":[],"ajuda_externa":[],"published_by_name":"GUILHERME MELO"}'::jsonb,
  $$[
    {"sala":"CC - Sala 2","ordem":0,"hora":"07:30","tempo_estimado":"01:30","paciente_iniciais":"J.B.W.","idade":"6a","procedimento":"Estrabismo horizontal - monocular","convenio":"Unimed Intercâmbio Estadual","cirurgiao":"Luiza Moschetta Zimmermann","anestesista":"CRISTINA"},
    {"sala":"CC - Sala 2","ordem":1,"hora":"09:15","tempo_estimado":"02:15","paciente_iniciais":"S.S.W.F.","idade":"45a","procedimento":"Artrodese da coluna com instrumentação por segmento","convenio":"Unimed Chapecó - VD","cirurgiao":"Cleiton Piekala","anestesista":"//"},
    {"sala":"CC - Sala 10 Robótica","ordem":2,"hora":"07:30","procedimento":"Anastomose coloanal","cirurgiao":"Vendrame","anestesista":"RAFAEL"},
    {"sala":"CC - Sala 10 Robótica","ordem":3,"hora":"09:00","tempo_estimado":"03:00","paciente_iniciais":"D.R.S.","idade":"48a","procedimento":"Herniorrafia umbilical","convenio":"Unimed Intercâmbio Estadual","cirurgiao":"Paulo Caldas","anestesista":"RAFAEL"}
  ]$$::jsonb
);

-- UNIMED · vespertino
select public.rpc_publicar_escala_turno(
  '2026-08-16'::date, 'unimed', 'vespertino',
  '{"status":"publicada","ordem_liberacao":[],"ajuda_externa":[],"published_by_name":"GUILHERME MELO"}'::jsonb,
  $$[
    {"sala":"CC - Sala 4","ordem":0,"hora":"13:30","tempo_estimado":"00:30","paciente_iniciais":"I.A.R.","idade":"52a","procedimento":"Coluna vertebral: infiltração foraminal ou facetária ou articular","convenio":"Unimed Chapecó - VD","cirurgiao":"Eduardo Felipe Martinelli Baldissera","anestesista":"THAYNA"},
    {"sala":"CC - Sala 4","ordem":1,"hora":"14:15","tempo_estimado":"00:30","paciente_iniciais":"D.U.","idade":"74a","procedimento":"Coluna vertebral: infiltração foraminal ou facetária ou articular","convenio":"Unimed Chapecó - VD","cirurgiao":"Eduardo Felipe Martinelli Baldissera","anestesista":"//"},
    {"sala":"CC - Sala 10 Robótica","ordem":2,"hora":"13:00","tempo_estimado":"03:00","paciente_iniciais":"J.B.","idade":"62a","procedimento":"Prostatovesiculectomia radical robótica","convenio":"PARTICULAR","cirurgiao":"Paulo Caldas","anestesista":"GUILHERME DIDOMENICO"}
  ]$$::jsonb
);

-- HRO · matutino (+ acréscimo: embolização 07:30 Hemodinâmica — THAYNA)
select public.rpc_publicar_escala_turno(
  '2026-08-16'::date, 'hro', 'matutino',
  '{"status":"publicada","ordem_liberacao":[],"ajuda_externa":[],"published_by_name":"GUILHERME MELO"}'::jsonb,
  $$[
    {"sala":"Sala 1","ordem":0,"hora":"07:00","procedimento":"Emergência/CO","convenio":"BRF","anestesista":"MATHEUS","tipo":"emergencia"},
    {"sala":"Hemodinâmica","ordem":1,"hora":"07:30","paciente_iniciais":"C.","procedimento":"Embolização","anestesista":"THAYNA","bloco":"hemodinamica"}
  ]$$::jsonb
);

-- HRO · vespertino
select public.rpc_publicar_escala_turno(
  '2026-08-16'::date, 'hro', 'vespertino',
  '{"status":"publicada","ordem_liberacao":[],"ajuda_externa":[],"published_by_name":"GUILHERME MELO"}'::jsonb,
  $$[
    {"sala":"Sala 4","ordem":0,"hora":"13:00","paciente_iniciais":"A.M.B.F.","idade":"59a","procedimento":"Artroplastia de quadril - tratamento cirúrgico + tenotomia","convenio":"SUS","cirurgiao":"Rodolfo Pagani","anestesista":"JOAO HENRIQUE"},
    {"sala":"Sala 4","ordem":1,"hora":"AS","paciente_iniciais":"R.W.","idade":"63a","procedimento":"Artroplastia total de joelho com implantes","convenio":"SUS","cirurgiao":"Airton Pagani","anestesista":"//"},
    {"sala":"Sala 4","ordem":2,"hora":"AS","paciente_iniciais":"T.B.","idade":"61a","procedimento":"Meniscectomia de um menisco + osteocondroplastia","convenio":"SUS","cirurgiao":"Airton Pagani","anestesista":"//"}
  ]$$::jsonb
);

-- FILA ÚNICA 'fds' · domingo — sem linha de liberação no documento: ordem
-- SUGERIDA (= escalação: col1, col2 → P8,P7,P11 manhã / P7,P8,P11 tarde →
-- col3, col4), ordemFonte 'sugerida'. Pn→pessoa herdado do sábado; a TROCA
-- PESSOAL do dia vence: P7 = THAYNA (doc: "8º RAFAEL 7º THAYNA").
select public.rpc_publicar_escala_turno(
  '2026-08-16'::date, 'fds', 'matutino',
  $$
  {"status":"publicada","published_by_name":"GUILHERME MELO",
   "ordem_liberacao":["CRISTINA","MATHEUS","RAFAEL","THAYNA","GABRIEL","JOAO HENRIQUE","GUILHERME DIDOMENICO"],
   "ajuda_externa":[],
   "fds_meta":{
     "grade":{
       "7-13":{"unimed":"CRISTINA","hro":"MATHEUS","ret1":"JOAO HENRIQUE","ret2":"GUILHERME DIDOMENICO"},
       "13-19":{"unimed":"GUILHERME DIDOMENICO","hro":"JOAO HENRIQUE","ret1":"MATHEUS","ret2":"CRISTINA"},
       "19-07":{"unimed":"JOAO RICARDO","hro":"MATHEUS","ret1":"GUILHERME DIDOMENICO","ret2":"JOAO HENRIQUE"}},
     "posicoes":{"P1":"GUILHERME DIDOMENICO","P2":"JOAO HENRIQUE","P3":"CRISTINA","P4":"MATHEUS","P5":"GABRIELA","P6":"ERLEI","P7":"THAYNA","P8":"RAFAEL","P9":"ROBERTA","P10":"STAUB","P11":"GABRIEL","P12":"VICENTE"},
     "escalacao":{"matutino":["P8","P7","P11"],"vespertino":["P7","P8","P11"]},
     "ordemFonte":{"matutino":"sugerida","vespertino":"sugerida"}}}
  $$::jsonb,
  '[]'::jsonb
);
select public.rpc_publicar_escala_turno(
  '2026-08-16'::date, 'fds', 'vespertino',
  $$
  {"status":"publicada","published_by_name":"GUILHERME MELO",
   "ordem_liberacao":["GUILHERME DIDOMENICO","JOAO HENRIQUE","THAYNA","RAFAEL","GABRIEL","MATHEUS","CRISTINA"],
   "ajuda_externa":[],
   "fds_meta":{
     "grade":{
       "7-13":{"unimed":"CRISTINA","hro":"MATHEUS","ret1":"JOAO HENRIQUE","ret2":"GUILHERME DIDOMENICO"},
       "13-19":{"unimed":"GUILHERME DIDOMENICO","hro":"JOAO HENRIQUE","ret1":"MATHEUS","ret2":"CRISTINA"},
       "19-07":{"unimed":"JOAO RICARDO","hro":"MATHEUS","ret1":"GUILHERME DIDOMENICO","ret2":"JOAO HENRIQUE"}},
     "posicoes":{"P1":"GUILHERME DIDOMENICO","P2":"JOAO HENRIQUE","P3":"CRISTINA","P4":"MATHEUS","P5":"GABRIELA","P6":"ERLEI","P7":"THAYNA","P8":"RAFAEL","P9":"ROBERTA","P10":"STAUB","P11":"GABRIEL","P12":"VICENTE"},
     "escalacao":{"matutino":["P8","P7","P11"],"vespertino":["P7","P8","P11"]},
     "ordemFonte":{"matutino":"sugerida","vespertino":"sugerida"}}}
  $$::jsonb,
  '[]'::jsonb
);

-- ── Rascunhos de cobrança (auto-import do trigger): completa o NOME COMPLETO
-- dos 2 particulares, espelhando completarPacienteDoCaso do fluxo Vision
-- (base legal art. 11 II "d"; nome NUNCA entra na escala).
update public.cirurgias_particulares cp
   set paciente = 'CLAUDIOMIRO JOAO ANDOLFATTO', updated_at = now()
  from public.escala_cirurgica_caso c
 where cp.escala_caso_id = c.id
   and c.paciente_iniciais = 'C.J.A.'
   and c.turno = 'matutino'
   and cp.data_cirurgia = '2026-08-15'
   and cp.cancelada_em is null;

update public.cirurgias_particulares cp
   set paciente = 'JOSÉ BORTOLINI', updated_at = now()
  from public.escala_cirurgica_caso c
 where cp.escala_caso_id = c.id
   and c.paciente_iniciais = 'J.B.'
   and c.turno = 'vespertino'
   and cp.data_cirurgia = '2026-08-16'
   and cp.cancelada_em is null;

commit;

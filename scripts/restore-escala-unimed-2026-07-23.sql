-- Restauração da escala Unimed matutina 23/07/2026 (escala fb401c04).
-- Incidente: uma REPUBLICAÇÃO (publicar/importar é DELETE+reinsert) com 1 caso
-- apagou os 32 originais às 12:37Z. Fonte autoritativa: imagem oficial enviada
-- pelo dono. LGPD: paciente só por INICIAIS (nomes completos NUNCA entram).
-- O caso NOVO (sala "3", Curativo craniano, Thayna) é PRESERVADO — não tocamos nele.
-- uid resolvido pelo dicionário (escala_anestesista_alias); null quando não houver
-- alias (linha aparece pelo nome; criar o alias depois em Vínculos).

with novos(sala, ordem, hora, ini, idade, tempo, proc, conv, cir, anest, bloco) as (values
  ('CO - Cesárea',0,'07:30','F.R.P.','30a','01:15','CESARIANA','INTERCAMBIO MERCOSUL - PR/RS','VENILTON CESAR VIEIRA','STAUB','normal'),
  ('CO - Cesárea',1,'09:30','R.C.F.C.','34a','01:15','CESARIANA','UNIMED INTERCAMBIO ESTADUAL','CRISTIANE PETRI ZANARDO DE MELO','PAULO','normal'),
  ('CO - Sala 3',0,'07:30','U.W.','67a','02:30','DERMATOCALAZE OU BLEFAROCLAZE UNILATERAL','UNIMED INTERCAMBIO ESTADUAL','LUIGGI FERRONATO GIORDANI','VICENTE','normal'),
  ('CO - Sala 3',1,'10:15','D.A.','61a','00:45','FACECTOMIA COM LENTE INTRA-OCULAR COM FACOEMULSIFICACAO','UNIMED CHAPECO - VD','LUIGGI FERRONATO GIORDANI','VICENTE','normal'),
  ('Hemodinâmica',0,'07:30','A.M.','77a','01:00','HEMO IMPLANTE MARCAPASSO DEFINITIVO BICA','UNIMED INTERCAMBIO ESTADUAL','CLAUDIO DA CRUZ FERREIRA','RAQUEL','hemodinamica'),
  ('Hemodinâmica',1,'08:45','G.F.','35a','01:00','HEMO IMPLANTE MARCAPASSO DEFINITIVO BICA','UNIMED CHAPECO - VD','CLAUDIO DA CRUZ FERREIRA','RAQUEL','hemodinamica'),
  ('Hemodinâmica',2,'10:00','N.D.A.','37a','01:00','MAPEAMENTO DE GATILHOS OU SUBSTRATOS ARRITMOGENICOS POR TECNICA ELETROFISIOLOGICA','UNIMED INTERCAMBIO ESTADUAL','CLAUDIO DA CRUZ FERREIRA','RAQUEL','hemodinamica'),
  ('Hemodinâmica',3,'11:15','M.E.R.M.','21a','01:00','ABLAÇÃO PERCUTÂNEA POR CATETER PARA TRATAMENTO DE ARRITMIAS CARDÍACAS COMPLEXAS','UNIMED CHAPECO - VD','CLAUDIO DA CRUZ FERREIRA','RAQUEL','hemodinamica'),
  ('CC - Sala 1',0,'07:30','M.S.S.','0a7m','03:00','HISPOSPADIA DISTAL - TRATAMENTO EM 1 TEMPO','UNIMED INTERCAMBIO ESTADUAL','LEANDRO TREVIZAN','TIAGO','normal'),
  ('CC - Sala 2',0,'07:30','I.P.C.','17a','01:30','SIMPATECTOMIA POR VIDEOTORACOSCOPIA','UNIMED INTERCAMBIO ESTADUAL','ROVANI JOSE RINALDI CAMARGO','LEANDRO','normal'),
  ('CC - Sala 2',1,'09:15','L.O.B.V.','31a','03:00','TRATAMENTO DA SINDROME DO DESFILADEIRO CERVICO TORACICO','UNIMED INTERCAMBIO ESTADUAL','ROVANI JOSE RINALDI CAMARGO','LEANDRO','normal'),
  ('CC - Sala 3',0,'07:30','M.I.L.O.','68a','02:45','OOFORECTOMIA UNI OU BILATERAL OU OOFOROP','PARTICULAR','MARCELO MORENO','THAYNA','normal'),
  ('CC - Sala 4',0,'07:30','P.O.F.','3a10m','01:00','AMIGDALECTOMIA','UNIMED CHAPECO - VD','ELLEN CRISTINE AGNE ANTONIOLLI','DIEGO','normal'),
  ('CC - Sala 4',1,'08:45','H.F.','7a4m','00:30','ADENOIDECTOMIA POR VIDEOENDOSCOPIA','UNIMED INTERCAMBIO ESTADUAL','ELLEN CRISTINE AGNE ANTONIOLLI','DIEGO','normal'),
  ('CC - Sala 4',2,'09:30','J.K.F.C.','32a','01:00','SEPTOPLASTIA','UNIMED INTERCAMBIO NACIONAL','ELLEN CRISTINE AGNE ANTONIOLLI','DIEGO','normal'),
  ('CC - Sala 5',0,'07:30','L.E.M.Z.','48a','01:30','VARIZES - TRATAMENTO CIRURGICO DE UM MEMBRO','UNIMED INTERCAMBIO ESTADUAL','ALEX LAZZARI DORNELLES','JANAINA','normal'),
  ('CC - Sala 5',1,'09:15','J.A.P.','34a','01:30','VARIZES - TRATAMENTO CIRURGICO BILATERAL','UNIMED INTERCAMBIO ESTADUAL','HELIO AUGUSTO SANTOS MACHADO','JANAINA','normal'),
  ('CC - Sala 5',2,'11:00','M.C.H.K.','61a','01:30','VARIZES - TRATAMENTO CIRURGICO BILATERAL','UNIMED FUNDACAO','HELIO AUGUSTO SANTOS MACHADO','JANAINA','normal'),
  ('CC - Sala 5',3,'12:45','M.C.B.','68a','01:30','VARIZES - TRATAMENTO CIRURGICO BILATERAL','UNIMED FUNDACAO','HELIO AUGUSTO SANTOS MACHADO','JANAINA','normal'),
  ('CC - Sala 6',0,'07:30','H.C.H.','18a','01:00','VARICOCELE UNILATERAL - CORRECAO CIRURGICA','UNIMED INTERCAMBIO ESTADUAL','JULIANO FERNEDA','RAUL','normal'),
  ('CC - Sala 6',1,'08:45','J.T.B.','90a','01:30','TUMOR VESICAL - RESSECCAO ENDOSCOPICA','UNIMED INTERCAMBIO ESTADUAL','HARDY GOLDSCHMIDT','RAUL','normal'),
  ('CC - Sala 6',2,'10:30','J.C.C.','61a','00:45','RETIRADA ENDOSCOPICA DE DUPLO J','INTERCAMBIO MERCOSUL - PR/RS','HARDY FRANZ GOLDSCHMIDT','RAUL','normal'),
  ('CC - Sala 7',0,'07:30','E.B.P.','18a','01:30','RECONSTRUCAO RETENCIONAMENTO OU REFORCO DE LIGAMENTO OU REPARO DE CARTILAGEM TRIANGULAR','UNIMED CHAPECO - VD','LUIZ EDUARDO CEZAR DA SILVA','HUMBERTO','normal'),
  ('CC - Sala 7',1,'09:15','C.R.T.B.','54a','01:30','RUPTURA DO MANGUITO ROTADOR','UNIMED INTERCAMBIO ESTADUAL','LUIZ EDUARDO CEZAR DA SILVA','HUMBERTO','normal'),
  ('CC - Sala 10',0,'07:30','E.R.F.','35a','02:00','VARIZES - TRATAMENTO CIRURGICO BILATERAL','UNIMED CHAPECO - VD','MARIO GOTO','MAURICIO','normal'),
  ('SRPA',0,'',null,null,'','',null,null,'STAUB','srpa'),
  ('Exames',0,'08:00',null,null,'','02 EDA (02 PCTES)','','VALDIR','PAULO','exames'),
  ('Exames',1,'08:00',null,null,'','02 COLO + 02 EDA (04 PCTS)','','PAULO','COSTA','exames'),
  ('Exames',2,'10:00',null,null,'','02 EDA (02 PCTES)','','MILTON','MAURICIO','exames'),
  ('Imagem',0,'08:00',null,null,'','06 RM (03 PCTES)','','','FERNANDO','imagem'),
  ('Umanitá',0,'07:30',null,null,'','RINOSEPTOPLASTIA - 04HS','','MOSCHETTA','RAFAEL','umanita'),
  ('Umanitá',1,'08:00',null,null,'','MASTOPEXIA C/ PROTESE - 04HS','','LUCAS','ERLEI','umanita')
)
insert into escala_cirurgica_caso
  (escala_id, sala, ordem, hora, paciente_iniciais, idade, tempo_estimado, procedimento, convenio, cirurgiao, anestesista, anestesista_user_id, bloco, is_continuacao, sem_anestesista, tipo, status_cirurgia)
select 'fb401c04-0637-4b2c-ae99-8cf5596fb3e9', n.sala, n.ordem, n.hora, n.ini, n.idade, n.tempo, n.proc, n.conv, n.cir,
       n.anest, (select a.user_id from escala_anestesista_alias a where upper(a.apelido)=n.anest limit 1),
       n.bloco, false, false, 'eletiva', 'agendada'
from novos n;

-- Rodapé (ordem de liberação, última linha vermelha da imagem) + carimbo de reparo.
update escala_cirurgica set
  ordem_liberacao = '["JANAINA","STAUB","FERNANDO","LEANDRO","ERLEI","RAQUEL","TIAGO","RAFAEL","DIEGO","THAYNA","VICENTE","RAUL","HUMBERTO","MAURICIO","COSTA","PAULO","GUSTAVO"]'::jsonb
where id = 'fb401c04-0637-4b2c-ae99-8cf5596fb3e9';

-- =====================================================================================
-- 2026-W45-aprendizado-queries.sql — base do relatório 2026-W45-aprendizado.md (09/11/2026)
-- Banco de PRODUÇÃO, somente SELECT. Recorte: data 22/07–08/11/2026 (09/11 em curso, fora).
-- Diferença para o W39: desde 02/10 a duração vem de `inicio_real`/`termino_real` do CASO
-- (sobrevivem à republicação), não mais do par de eventos. A análise pesada roda LOCAL, em
-- node, sobre 5 exports (bloco EXPORT) — uma ida por tabela, sem varredura repetida no Nano.
-- O que é LIDO de paciente: nenhuma query lê paciente_iniciais. Uma única (ped.json, 2ª rodada, fim do arquivo)
-- lê c.idade DENTRO do banco para calcular a flag "pediátrico (≤ 12 anos)" — a idade não é exportada, só o
-- booleano por caso — e exporta c.gravidade por caso (classificação da urgência, sem identificar o paciente).
-- Os JSON exportados têm nomes de profissionais (anestesistas, residentes, cirurgiões): ficam FORA do repo.
-- =====================================================================================

-- Q1. Captura por tipo e semana (está enchendo? algum tipo parado?)
select tipo, to_char(date_trunc('week', data),'IYYY-"W"IW') sem, count(*) n,
  count(*) filter (where (detalhe->>'publicacao')::boolean) pub, count(distinct data) dias, min(em) mn, max(em) mx
from escala_cirurgica_captura where data >= '2026-09-21' group by 1,2 order by 1,2;

-- Q2. Inventário semanal pelo CASO (volume, cobertura por hospital, par de horário real)
with c as (
 select e.data, e.hospital, c.*,
  case when c.inicio_real is not null and c.termino_real is not null then
    ((extract(epoch from c.termino_real::time - c.inicio_real::time)/60)::int + 1440) % 1440 end dur,
  to_char(c.status_atualizado_em at time zone 'America/Sao_Paulo','HH24:MI') toque
 from escala_cirurgica_caso c join escala_cirurgica e on e.id=c.escala_id
 where e.hospital<>'fds' and e.data between '2026-07-22' and '2026-11-08')
select to_char(data,'IYYY-"W"IW') sem, min(data) de, count(*) casos,
 count(*) filter (where hospital='unimed') uni, count(*) filter (where hospital='hro') hro, count(*) filter (where hospital='materno') mat,
 count(*) filter (where origem='manual') manual, count(*) filter (where is_continuacao) contin,
 count(*) filter (where status_cirurgia='terminada') term,
 count(*) filter (where inicio_real is not null and termino_real is not null) par,
 count(*) filter (where dur between 5 and 720) par_plaus,
 count(*) filter (where status_cirurgia='terminada' and termino_real is null) term_sem_horario,
 count(*) filter (where dur between 5 and 720 and termino_real is distinct from toque) term_dif_toque,
 count(*) filter (where dur between 5 and 720 and termino_real_por = anestesista_user_id) term_pelo_proprio,
 count(*) filter (where dur between 5 and 720 and inicio_real_por = anestesista_user_id) ini_pelo_proprio,
 count(*) filter (where dur is not null and dur<5) dur_lt5
from c group by 1 order by 1;

-- Q3. De onde veio cada ponta do par (toque isolado · toque em LOTE · digitado à mão), por período.
-- LOTE = 3+ marcações da mesma pessoa, mesmo status, com <= 60 s entre consecutivas (convenção W39).
-- 'mao' = o horário gravado no caso difere de todo toque daquele status no caso.
with ev as (
  select e.caso_id, e.status_para, e.por, e.em, to_char(e.em at time zone 'America/Sao_Paulo','HH24:MI') hm,
    case when e.em - lag(e.em) over (partition by e.por, e.status_para order by e.em) <= interval '60 seconds' then 0 else 1 end novo
  from escala_cirurgica_evento e
  where e.tipo='status' and e.status_de is distinct from e.status_para and e.status_para in ('iniciada','terminada')
    and e.data between '2026-10-02' and '2026-11-08'),
cl as (select *, sum(novo) over (partition by por, status_para order by em rows unbounded preceding) cid from ev),
cl2 as (select *, count(*) over (partition by por, status_para, cid) tam from cl),
c as (
 select c.id, e.data, e.hospital, c.inicio_real, c.termino_real, c.anestesista_user_id uid, c.inicio_real_por, c.termino_real_por,
  ((extract(epoch from c.termino_real::time - c.inicio_real::time)/60)::int + 1440) % 1440 dur
 from escala_cirurgica_caso c join escala_cirurgica e on e.id=c.escala_id
 where e.hospital<>'fds' and e.data between '2026-10-02' and '2026-11-08' and c.inicio_real is not null and c.termino_real is not null),
k as (select c.*,
  (select case when count(*)=0 then 'sem_evento' when bool_or(x.hm=c.inicio_real and x.tam<3) then 'toque' when bool_or(x.hm=c.inicio_real) then 'toque_lote' else 'mao' end from cl2 x where x.caso_id=c.id and x.status_para='iniciada') ini_src,
  (select case when count(*)=0 then 'sem_evento' when bool_or(x.hm=c.termino_real and x.tam<3) then 'toque' when bool_or(x.hm=c.termino_real) then 'toque_lote' else 'mao' end from cl2 x where x.caso_id=c.id and x.status_para='terminada') ter_src
 from c where dur between 5 and 720)
select case when data<'2026-10-14' then '1: 02-13/10' when data<'2026-10-27' then '2: 14-26/10' else '3: 27/10-08/11' end periodo,
 ini_src, ter_src, count(*) n, round(percentile_cont(0.5) within group (order by dur)) med_dur,
 round(100.0*avg((inicio_real_por=uid)::int)) pct_ini_proprio, round(100.0*avg((termino_real_por=uid)::int)) pct_ter_proprio,
 round(100.0*avg((right(inicio_real,1) in ('0','5'))::int)) pct_ini_redondo, round(100.0*avg((right(termino_real,1) in ('0','5'))::int)) pct_ter_redondo
from k group by 1,2,3 order by 1,4 desc;

-- Q4. O que roda: triggers vivos, crons da escala, objetos de aprendizado, tamanho das tabelas
select 'trigger' k, tgname::text || ' on ' || tgrelid::regclass::text || ' enabled=' || tgenabled::text v from pg_trigger where not tgisinternal and tgrelid in ('public.escala_cirurgica'::regclass,'public.escala_cirurgica_caso'::regclass)
union all select 'cron', jobname || ' | ' || schedule || ' | active=' || active::text from cron.job where jobname ilike '%escala%' or command ilike '%escala%'
union all select 'cirurgiao_display_preenchido', count(*)::text from escala_cirurgica_caso where cirurgiao_display is not null
union all select 'captura_total', count(*)::text || ' | ' || pg_size_pretty(pg_total_relation_size('public.escala_cirurgica_captura')) from escala_cirurgica_captura
union all select 'evento_total', count(*)::text || ' | ' || pg_size_pretty(pg_total_relation_size('public.escala_cirurgica_evento')) from escala_cirurgica_evento;

-- =====================================================================================
-- EXPORT (uma ida por tabela) → pasta fora do repo, depois:
--   DADOS=<pasta> node docs/escala-cirurgica-metricas/2026-W45-aprendizado-scripts/a_dur.mjs   (backtest de duração)
--   DADOS=<pasta> node .../b_est.mjs    (estimativas da equipe e conteúdo da captura)
--   DADOS=<pasta> node .../c_aloc.mjs   (rodapé × numérica, correlações, afinidades, simulador sobre o FINAL)
--   DADOS=<pasta> node .../d_pub.mjs    (simulador sobre o PLANO PUBLICADO — o critério nº 2)
-- Exportar com o wrapper SELECT-only:
--   node .claude/skills/escala-cirurgica/scripts/query-ro.mjs "<select>" > <pasta>/<nome>.json
-- Para reexecutar noutra janela: trocar as datas aqui e os cortes de treino/teste nos scripts.
-- =====================================================================================
-- casos.json
select c.id, e.data, e.hospital, c.turno, c.sala, c.ordem, c.hora, c.tempo_estimado, c.procedimento, c.convenio, c.cirurgiao,
  c.anestesista, c.anestesista_user_id uid, c.bloco, c.is_continuacao cont, c.sem_anestesista sem, c.tipo, c.origem,
  c.status_cirurgia st, c.status_extra ex, c.inicio_real ini, c.termino_real ter, c.inicio_real_por ini_por, c.termino_real_por ter_por,
  c.residente_user_id res, c.status_atualizado_em st_em, c.status_atualizado_por st_por, c.created_at
from escala_cirurgica_caso c join escala_cirurgica e on e.id=c.escala_id where e.data between '2026-07-22' and '2026-11-08';
-- escalas.json
select id, data, hospital, ordem_liberacao, ajuda_externa, liberacoes, linha_overrides, publicacao_turnos, (fds_meta is not null) tem_fds
from escala_cirurgica where data between '2026-07-22' and '2026-11-08';
-- eventos.json
select caso_id, escala_id, data, hospital, tipo, status_de de, status_para para, por, em, anestesista, anestesista_user_id uid, sala, hora, cirurgiao, procedimento
from escala_cirurgica_evento where tipo in ('status','liberacao') and data between '2026-07-22' and '2026-11-08';
-- captura.json
select seq, tipo, caso_id, escala_id, data, hospital, turno, sala, hora, cirurgiao, procedimento, tempo_estimado, anestesista, anestesista_user_id uid, valor_de, valor_para, detalhe, por, em
from escala_cirurgica_captura where data between '2026-09-25' and '2026-11-08';
-- alias.json
select apelido, user_id from escala_anestesista_alias;

-- =====================================================================================
-- 2ª RODADA (relações da escalação) — dois exports a mais, mesma pasta DADOS:
--   DADOS=<pasta> node .../f_relacoes.mjs    (todas as relações, contra permutação dentro do turno)
--   DADOS=<pasta> node .../g_simulador.mjs   (simulador mapa + rodapé; aprende até 18/10, testa 19/10–06/11)
-- blocos.mjs reconstrói rodapé, papéis e blocos (sala × anestesista) do plano publicado.
-- =====================================================================================
-- ped.json — LÊ c.idade no banco; SAI só a flag de pediátrico (≤ 12 anos), tem_res (há residente) e c.gravidade,
-- uma linha por caso (id do caso). A idade em si não é exportada.
select c.id, (case when c.idade ~* '(m|mes|meses|d|dias)\s*$' and c.idade !~* 'a' then true when c.idade ~ '^\s*\d+' then (regexp_match(c.idade,'\d+'))[1]::int <= 12 else null end) ped,
  (c.residente is not null and c.residente<>'') tem_res, c.gravidade
from escala_cirurgica_caso c join escala_cirurgica e on e.id=c.escala_id where e.data between '2026-07-22' and '2026-11-08';
-- perfis.json — nome de quem aparece na escala (anestesistas e residentes)
select p.id, p.nome, p.role from profiles p where p.id in (
  select user_id from escala_anestesista_alias
  union select distinct anestesista_user_id from escala_cirurgica_caso where anestesista_user_id is not null
  union select distinct residente_user_id from escala_cirurgica_caso where residente_user_id is not null);

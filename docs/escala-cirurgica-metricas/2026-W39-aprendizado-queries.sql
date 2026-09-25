-- =====================================================================================
-- analise-aprendizado-queries.sql — queries que sustentam o relatório
-- "Quanto os dados da Escala Cirúrgica sustentam a sugestão de alocação" (25/09/2026)
-- Banco de PRODUÇÃO, somente SELECT/WITH (mcp__supabase__execute_sql).
-- Recorte: data 22/07–24/09/2026 (hoje, 25/09, parcial, fica fora); eventos com em < 25/09 00:00 BRT;
-- hospital 'fds' fora. Nenhuma query lê paciente_iniciais/idade.
-- Convenções usadas em todas:
--   * transição real = tipo='status' e status_de <> status_para (status_de = status_para são toggles
--     do aviso atrasada/suspensa/passa_tarde — migration 20260721100000);
--   * LOTE = marcações da MESMA pessoa (por), MESMO status, com <= 60 s entre marcações consecutivas;
--     "lote>=3" = grupo de 3+;
--   * PAR = 1º 'iniciada' do caso + 1º 'terminada' posterior (lição W30, Achado 2);
--     plausível = 5 a 720 min;
--   * caso "atual" = linha viva de escala_cirurgica_caso; evento de caso apagado pela republicação
--     (órfão) é religado ao caso atual pela chave (data, hospital, sala, hora, cirurgião, procedimento)
--     quando a chave é única.
-- =====================================================================================

-- Q0a. Triggers vivos (confirma o que é e o que não é registrado)
select tgname, tgrelid::regclass, pg_get_triggerdef(t.oid) from pg_trigger t
where not tgisinternal and tgrelid in ('public.escala_cirurgica'::regclass,'public.escala_cirurgica_caso'::regclass);
select p.proname, pg_get_functiondef(p.oid) from pg_proc p
where p.pronamespace='public'::regnamespace and p.proname in ('log_escala_caso_status','log_escala_liberacao');

-- Q0b. Escalas publicadas e seed (resultado: 0 linhas seed; tudo >= 22/07)
select hospital, status, count(*) n, min(data), max(data),
 count(*) filter (where created_by like 'seed-teste-claude%') seed
from escala_cirurgica group by 1,2 order by 1,2;

-- Q0c. Tipos de evento
select tipo, status_de, status_para, count(*) n, min(em), max(em)
from escala_cirurgica_evento group by 1,2,3 order by 1,2,3;

-- Q1a. Casos reais por semana ISO e hospital (5.700 casos atuais)
with cur as (
  select c.id, e.data, e.hospital from escala_cirurgica_caso c join escala_cirurgica e on e.id=c.escala_id
  where e.hospital<>'fds' and e.data between '2026-07-22' and '2026-09-24')
select to_char(data,'IYYY-"W"IW') semana, min(data) de, max(data) ate,
  count(*) filter (where hospital='unimed') unimed, count(*) filter (where hospital='hro') hro,
  count(*) filter (where hospital='materno') materno, count(*) total, count(distinct data) dias,
  count(*) filter (where extract(isodow from data) >= 6) fds
from cur group by 1 order by 1;

-- Q1b. Por hospital: marcação, só terminada, só iniciada, par válido, plausível, sem lote, isolado
with ev as (
  select e.* from escala_cirurgica_evento e
  where tipo='status' and status_de is distinct from status_para and hospital<>'fds'
    and data between '2026-07-22' and '2026-09-24' and em < '2026-09-25 03:00:00+00'),
cl_src as (select ev.*, case when em - lag(em) over (partition by por, status_para order by em) <= interval '60 seconds' then 0 else 1 end novo
  from ev where status_para in ('iniciada','terminada')),
cl as (select *, sum(novo) over (partition by por, status_para order by em rows unbounded preceding) cid from cl_src),
cl2 as (select *, count(*) over (partition by por, status_para, cid) tam from cl),
cur as (
  select c.id, e.data, e.hospital,
    lower(btrim(c.sala)) sala_k, coalesce(btrim(c.hora),'') hora_k, upper(btrim(coalesce(c.cirurgiao,''))) cir_k, upper(btrim(coalesce(c.procedimento,''))) proc_k,
    count(*) over (partition by e.data, e.hospital, lower(btrim(c.sala)), coalesce(btrim(c.hora),''), upper(btrim(coalesce(c.cirurgiao,''))), upper(btrim(coalesce(c.procedimento,'')))) nk
  from escala_cirurgica_caso c join escala_cirurgica e on e.id=c.escala_id
  where e.hospital<>'fds' and e.data between '2026-07-22' and '2026-09-24'),
casos_ev as (select distinct on (ev.caso_id) ev.caso_id, ev.data, ev.hospital, lower(btrim(ev.sala)) sala_k, coalesce(btrim(ev.hora),'') hora_k,
    upper(btrim(coalesce(ev.cirurgiao,''))) cir_k, upper(btrim(coalesce(ev.procedimento,''))) proc_k from ev order by ev.caso_id, ev.em),
mapa as (select ce.caso_id, coalesce(c1.id, c2.id) cur_id from casos_ev ce
  left join cur c1 on c1.id = ce.caso_id
  left join cur c2 on c1.id is null and c2.nk = 1 and c2.data=ce.data and c2.hospital=ce.hospital and c2.sala_k=ce.sala_k and c2.hora_k=ce.hora_k and c2.cir_k=ce.cir_k and c2.proc_k=ce.proc_k),
ini as (select distinct on (caso_id) caso_id, em ini_em, tam ini_tam from cl2 where status_para='iniciada' order by caso_id, em),
par as (select i.caso_id, i.ini_em, i.ini_tam, t.em ter_em, t.tam ter_tam, extract(epoch from t.em - i.ini_em)/60.0 dur
  from ini i join lateral (select em, tam from cl2 where cl2.caso_id=i.caso_id and status_para='terminada' and em > i.ini_em order by em limit 1) t on true),
cur_par as (select cur.*, p.dur, p.ini_tam, p.ter_tam,
    exists (select 1 from mapa m join ev on ev.caso_id=m.caso_id where m.cur_id=cur.id) tem_evento,
    exists (select 1 from mapa m join ev on ev.caso_id=m.caso_id where m.cur_id=cur.id and ev.status_para='terminada') tem_ter,
    exists (select 1 from mapa m join ev on ev.caso_id=m.caso_id where m.cur_id=cur.id and ev.status_para='iniciada') tem_ini
  from cur left join lateral (select p.* from mapa m join par p on p.caso_id=m.caso_id where m.cur_id=cur.id order by p.ini_em limit 1) p on true)
select hospital, count(*) casos, count(*) filter (where tem_evento) com_marcacao,
  count(*) filter (where tem_ter and not tem_ini) so_terminada, count(*) filter (where tem_ini and not tem_ter) so_iniciada,
  count(*) filter (where dur is not null) par_valido,
  count(*) filter (where dur between 5 and 720) par_plausivel,
  count(*) filter (where dur between 5 and 720 and ini_tam < 3 and ter_tam < 3) par_plausivel_sem_lote,
  count(*) filter (where dur between 5 and 720 and ini_tam = 1 and ter_tam = 1) par_plausivel_isolado
from cur_par group by rollup(hospital) order by 1;
-- (Q1i, evolução semanal, é a mesma cadeia agrupada por to_char(data,'IYYY-"W"IW') + % de terminadas em lote na semana)

-- Q1c. Lotes: tamanho, salas por lote, % marcado pelo próprio anestesista, fim de turno, junto de liberação
with ev as (select e.* from escala_cirurgica_evento e where tipo='status' and status_de is distinct from status_para and hospital<>'fds'
    and data between '2026-07-22' and '2026-09-24' and em < '2026-09-25 03:00:00+00'),
cl_src as (select ev.*, case when em - lag(em) over (partition by por, status_para order by em) <= interval '60 seconds' then 0 else 1 end novo
  from ev where status_para in ('iniciada','terminada')),
cl as (select *, sum(novo) over (partition by por, status_para order by em rows unbounded preceding) cid from cl_src),
b as (select por, status_para, cid, count(*) n, count(distinct lower(btrim(sala))) salas, min(em) t0, max(em) t1,
    count(*) filter (where anestesista_user_id = por) proprios from cl group by 1,2,3),
lib as (select por, em from escala_cirurgica_evento where tipo='liberacao' and status_para='liberado' and data between '2026-07-22' and '2026-09-24')
select status_para, case when n>=3 then 'lote>=3' when n=2 then 'par' else 'isolado' end tipo, count(*) grupos, sum(n) eventos,
  round(avg(salas)::numeric,1) salas_medias, round(100.0*sum(proprios)/sum(n),1) pct_marcado_pelo_proprio_anest,
  sum(n) filter (where extract(hour from t0 at time zone 'America/Sao_Paulo')*60+extract(minute from t0 at time zone 'America/Sao_Paulo') between 12*60+30 and 13*60+59
                   or extract(hour from t0 at time zone 'America/Sao_Paulo') >= 18) eventos_fim_turno,
  sum(n) filter (where exists (select 1 from lib where lib.por=b.por and lib.em between b.t0 - interval '5 min' and b.t1 + interval '5 min')) eventos_junto_liberacao
from b group by 1,2 order by 1,2;

-- Q1d. % em lote por hospital e % de 'iniciada' colada (±60 s) na 'terminada' da mesma sala pela mesma pessoa
with ev as (select e.* from escala_cirurgica_evento e where tipo='status' and status_de is distinct from status_para and hospital<>'fds'
    and data between '2026-07-22' and '2026-09-24' and em < '2026-09-25 03:00:00+00'),
cl_src as (select ev.*, case when em - lag(em) over (partition by por, status_para order by em) <= interval '60 seconds' then 0 else 1 end novo
  from ev where status_para in ('iniciada','terminada')),
cl as (select *, sum(novo) over (partition by por, status_para order by em rows unbounded preceding) cid from cl_src),
cl2 as (select *, count(*) over (partition by por, status_para, cid) tam from cl),
fl as (select cl2.*, (status_para = 'iniciada' and exists (select 1 from ev t where t.por = cl2.por and t.status_para='terminada'
     and lower(btrim(t.sala)) = lower(btrim(cl2.sala)) and t.data = cl2.data and t.em between cl2.em - interval '60 seconds' and cl2.em + interval '60 seconds')) colada from cl2)
select hospital, status_para, count(*) eventos, round(100.0*count(*) filter (where tam >= 3)/count(*),1) pct_lote3,
  round(100.0*count(*) filter (where tam >= 2)/count(*),1) pct_lote2, round(100.0*count(*) filter (where colada)/count(*),1) pct_iniciada_colada
from fl group by rollup(hospital), status_para order by 1,2;

-- Q1e. Faixas de duração dos pares (e quantos têm ponta em lote)
-- (mesma cadeia ev/cl/cl2/ini/par da Q1b, sem o religamento ao caso atual)
--   select faixa, count(*), count(*) filter (where ini_tam>=3 or ter_tam>=3), count(*) filter (where ini_tam=1 and ter_tam=1) from par ...

-- Q1f. Atraso do 1º 'iniciada' vs hora marcada no mapa; turnover na mesma sala (lote x não lote)
with ev as (select e.* from escala_cirurgica_evento e where tipo='status' and status_de is distinct from status_para and hospital<>'fds'
    and data between '2026-07-22' and '2026-09-24' and em < '2026-09-25 03:00:00+00'),
cl_src as (select ev.*, case when em - lag(em) over (partition by por, status_para order by em) <= interval '60 seconds' then 0 else 1 end novo
  from ev where status_para in ('iniciada','terminada')),
cl as (select *, sum(novo) over (partition by por, status_para order by em rows unbounded preceding) cid from cl_src),
cl2 as (select *, count(*) over (partition by por, status_para, cid) tam from cl),
ini as (select distinct on (caso_id) caso_id, data, hospital, lower(btrim(sala)) sala_k, hora, em ini_em, tam ini_tam from cl2 where status_para='iniciada' order by caso_id, em),
par as (select i.*, t.em ter_em, t.tam ter_tam, extract(epoch from t.em - i.ini_em)/60.0 dur
  from ini i join lateral (select em, tam from cl2 where cl2.caso_id=i.caso_id and status_para='terminada' and em > i.ini_em order by em limit 1) t on true),
atraso as (select *, case when hora ~ '^\d{1,2}:\d{2}$' then extract(epoch from (ini_em at time zone 'America/Sao_Paulo') - (data + hora::time))/60.0 end atraso_ini from par),
seq as (select *, lead(ini_em) over (partition by data, hospital, sala_k order by ini_em) prox_ini from par where dur between 5 and 720)
select 'atraso_inicio_vs_hora_marcada' metrica, case when ini_tam>=3 then 'lote' else 'nao_lote' end grupo, count(*) n,
  percentile_cont(0.25) within group (order by atraso_ini) p25, percentile_cont(0.5) within group (order by atraso_ini) p50, percentile_cont(0.75) within group (order by atraso_ini) p75
from atraso where atraso_ini is not null and dur between 5 and 720 group by 1,2
union all
select 'turnover_mesma_sala', case when ter_tam>=3 then 'lote' else 'nao_lote' end, count(*),
  percentile_cont(0.25) within group (order by extract(epoch from prox_ini - ter_em)/60.0),
  percentile_cont(0.5) within group (order by extract(epoch from prox_ini - ter_em)/60.0),
  percentile_cont(0.75) within group (order by extract(epoch from prox_ini - ter_em)/60.0)
from seq where prox_ini is not null group by 1,2 order by 1,2;

-- Q1g. Vai-e-volta por caso (nível caso_id)
with ev as (select * from escala_cirurgica_evento where tipo='status' and status_de is distinct from status_para and hospital<>'fds'
    and data between '2026-07-22' and '2026-09-24'),
c as (select caso_id, hospital, min(em) filter (where status_para='iniciada') ini, min(em) filter (where status_para='terminada') ter_any,
    bool_or(status_de='terminada') reverteu_ter, bool_or(status_de='iniciada' and status_para='agendada') reverteu_ini from ev group by 1,2),
p as (select c.*, (select min(em) from ev where ev.caso_id=c.caso_id and ev.status_para='terminada' and ev.em > c.ini) ter_pos from c)
select hospital, count(*) casos_com_transicao, count(*) filter (where ini is not null and ter_pos is not null) par_valido,
  count(*) filter (where ini is null and ter_any is not null) so_terminada, count(*) filter (where ini is not null and ter_pos is null) so_iniciada,
  count(*) filter (where reverteu_ter) reverteu_terminada, count(*) filter (where reverteu_ini) reverteu_iniciada
from p group by rollup(hospital) order by 1;

-- Q1h. Órfãos da republicação (eventos de caso apagado) e se o caso atual equivalente tem evento próprio
with ev as (select * from escala_cirurgica_evento where tipo='status' and status_de is distinct from status_para and hospital<>'fds'
    and data between '2026-07-22' and '2026-09-24'),
orf as (select distinct ev.caso_id, ev.data, ev.hospital, lower(btrim(ev.sala)) sala, coalesce(btrim(ev.hora),'') hora,
     upper(btrim(coalesce(ev.cirurgiao,''))) cir, upper(btrim(coalesce(ev.procedimento,''))) proc
  from ev left join escala_cirurgica_caso c on c.id=ev.caso_id where c.id is null),
cur as (select c.id, e.data, e.hospital, lower(btrim(c.sala)) sala, coalesce(btrim(c.hora),'') hora,
     upper(btrim(coalesce(c.cirurgiao,''))) cir, upper(btrim(coalesce(c.procedimento,''))) proc
  from escala_cirurgica_caso c join escala_cirurgica e on e.id=c.escala_id)
select count(distinct orf.caso_id) orfaos,
  count(distinct orf.caso_id) filter (where exists (select 1 from cur where cur.data=orf.data and cur.hospital=orf.hospital and cur.sala=orf.sala and cur.hora=orf.hora and cur.cir=orf.cir and cur.proc=orf.proc)) casam_com_caso_atual,
  count(distinct orf.caso_id) filter (where exists (select 1 from ev e2 join cur on cur.id=e2.caso_id where cur.data=orf.data and cur.hospital=orf.hospital and cur.sala=orf.sala and cur.hora=orf.hora and cur.cir=orf.cir and cur.proc=orf.proc)) caso_atual_tem_evento
from orf;
-- turnos republicados (desde 05/08, quando nasceu o evento 'publicacao')
with p as (select escala_id, detalhe->>'turno' turno, count(*) n from escala_cirurgica_evento
  where tipo='publicacao' and hospital in ('unimed','hro','materno') and data between '2026-08-05' and '2026-09-24' group by 1,2)
select count(*) turnos, count(*) filter (where n>1) republicados, round(100.0*count(*) filter (where n>1)/count(*),1) pct from p;

-- Q1j. Liberações em lote (dia útil, Unimed/HRO)
with l as (select * from escala_cirurgica_evento where tipo='liberacao' and status_para='liberado' and hospital in ('unimed','hro')
    and data between '2026-07-22' and '2026-09-24' and extract(isodow from data) between 1 and 5),
g as (select *, case when em - lag(em) over (partition by por order by em) <= interval '60 seconds' then 0 else 1 end novo from l),
c as (select *, sum(novo) over (partition by por order by em rows unbounded preceding) cid from g),
c2 as (select *, count(*) over (partition by por, cid) tam from c)
select count(*) eventos_liberado, round(100.0*count(*) filter (where tam>=3)/count(*),1) pct_lote3,
  round(100.0*count(*) filter (where por = split_part(anestesista, ':', 2))/count(*),1) pct_autoliberacao from c2;

-- =====================================================================================
-- Q2. Famílias + backtest. As famílias vêm de nomeCurtoProcedimento (src/lib/escalaProcedimentoCurto.js,
-- versão de produção em ~/dev/anest-wt-tempos), EXECUTADA em node sobre os 1.655 textos distintos
-- exportados (scratchpad/procedimentos.json, md5 da lista = 1def041cb5f1841afb9724b616f588ae, igual ao
-- md5 calculado no banco); scripts: scratchpad/familias.mjs (agrupamento: rótulo sem acento/caixa;
-- linha contada "8 EDA + 2 COLO" perde as contagens) e scratchpad/lista.mjs (flag de lista multi-paciente).
-- O mapa texto→família volta ao SQL como string RLE base36 (md5 travado na própria query).
-- Nomes das famílias: scratchpad/familias_nomes.json (fid = posição 1-based).
-- =====================================================================================
-- Q2 (uma query só): tabela por família + backtest (treino < 14/09; teste 14–24/09) nas
-- variantes A (todos os pares plausíveis) e B (sem nenhuma ponta em lote >= 3)
with
-- MAPA DE FAMÍLIAS: nomeCurtoProcedimento (src/lib/escalaProcedimentoCurto.js) rodado em node sobre os
-- 1.655 textos distintos (normalizados: caixa alta, sem acento, espaços colapsados), ordenados em
-- collate "C". Cada item = id da família (+600 se a linha é LISTA contada de 2+ pacientes/exames),
-- em base36 de 2 dígitos, com run-length ("jl*3"). O md5 trava a transcrição.
fam_str as (select '01,mx,0r*3,1m,ie,1q,1u,1x*2,1y,27,28,j0,2d*2,jb,2r,jl*2,jm,jh,jg,jh*6,jg,jh*3,jg,jh*3,jy,4l,4o,4q*2,4t,jl*2,jm,li,jm*3,54,5e*3,5j,69,if,mz,69*3,vq,7m,87,dk,bd,bz,kb,q1,jn,js*2,cy,tn*5,dt,sp,sq,vr,f2,uh,hf*4,hg,ia,id,ie*2,im,j1,j2,jf,jl*2,jg,jh*2,jy,jh,jy,jh,k1,k2,le*2,lh*3,jl*3,jm,li,jm*2,li,jm,ju,m8,m9,mx,my,n2,mx*4,vq,nj,pi,ql,s2*2,s5,jt,tm,tn,uh,vm,vq*4,gr,gs,i5,ia,ix,iy,j2,jf,jl*4,jh,jy,iu,ku,lh*2,jl*6,jj,li,jm,mx*3,n0,mx*2,s2,tm*2,gs,ia,j2,jf,jl,jv,jl*4,jy,ku,lh,jl*5,jj,jl*3,lh,mx*5,s2*4,tm,jf*2,jl,jw,jl,k0,k1,lh,jl*4,ji,jk,jq,jl*2,jo,jp,jl*5,jj,jl*2,mx*3,s2*2,tm,jf,jl*2,lh,jl*15,mx*3,tm,tn,jf,jl*8,jr,jl,mx*4,n1,s2,tm*2,tn*2,jf,jx,jo,jl*9,mx*4,tm,tn*2,jf,jl*3,mx*2,s2,1y,jl*2,s2,jl,tm*2,jl,s2,tm,k8,s2*2,lh,s2,4l,9d,02*9,dt,05*8,06,07,9j,08,09*2,0a,09,0a*5,9m,0b*3,0c*3,09*3,3x*2,0d,0e,0f,0g,0d,54*2,0e,0g,0d*2,0f,0g,ar,0h*2,0i,0j,0k,0l,0m,0n,0o,0r,0p,0q*2,0p*2,0r*13,0s*6,1b,0t,0u,0v,0w,0x*7,0y*6,0w,0y,0w*2,10*2,0z,0y*10,11*2,0z*2,0y*2,12*7,0y*3,16*2,13,14,16*2,13*2,16*2,13,15*2,13*2,15,14*5,16,14,16*4,1a,3x,1c,1d,1e,1f,1g,1h*4,1i,9q,1o,1i,88,1n,1j*2,1i,1o*2,1l,1i*5,2n*3,dt,1i,1k,1q*2,9o,1q,a4,1q*3,1t,1s,1v,1w*2,54,1z,9j,20,21,22,25,2d,27*9,3m,2b,2d,2e*3,54,2d*6,81,7z,54*2,3i*2,f0*5,2f,2g,2i,96,2j,2k,3n,2l*2,2m,3t*2,2n*13,2o,2p*5,53,2p*2,2q,26,dl,dn,3b,54,3f*2,3g,3h*3,85,8m*2,17*2,18,6i,54,3k,3l*2,3m*39,3n*4,1i,3o,58,3p,9i,3q,3r,3s,3t*2,3u,3v,3w,3x*4,54,3x,3y,74,3z*4,40*7,3z,7q,41*3,42,45,46*5,47*2,48,1q,02*2,3z*2,49,4a,4b,4c,6q,4c,4d,4e,7u,4f,7o,4h,4j,4k,4l,4m,4l*5,4n,4o,4p,4q,4r,4s,4q,4v*3,4w*2,4x,4y,4z,50,51,0s,8t*2,4o,51,2d,52,85,53*6,54*4,55*2,56,57,59,5a,5b,5c*2,5d,54,5f,5g,5h,5i,5j,5m,5n,5o,e3,eo,5q,5p*2,5r,5t,5u,d6*2,5v,5w,5x,5u,5z,60,62,63,9o,63,64,65,eo,66*2,5s*3,3n,67,3n,68,69*6,92,6f,6g,6n*4,6h*2,6j,em,6l,6m,6o,6p,6q,6x,6r,71,6s*2,70,6w,72*2,6r,72,6w,6q,70*2,6r*2,6x,6w,6s,72,6r*4,70,6r*2,6v*3,70,71,72,6r,73,6x*2,71,6q*3,6w,6x*4,6r,6v,6q,74,72,6z,6q,71,6x*5,72,6z,6v,6w*2,6x*3,6t,75,76,77,78,79*2,7a,7b*3,7c,54,7c,7d,7e,7f*2,7g,7i,7k,7l,0r,9l*2,7m*3,7n*2,7o*4,7r,7v,7t,7u,7v*2,a9*2,7v,7x,7s,7t*2,7u,7v*2,a9,7v*4,7w,7x,bc,7y,80,a4,83,84,85*11,86*12,87,26*2,89,26*2,8a,8b,8c,26,6i,8d,4i*2,8e*2,8f,8g,8h,9l*3,dm,0r*2,8i,2h,8j,8k*2,dj*2,8m,8n,17,8u*2,8o*2,8p*2,8q,88*3,4o,8r*2,8s*2,8t*13,1i,8u*2,8v,19,8z,91,90,8x,8y,1q*2,93,d6,93*2,94*3,95*3,92,96*2,93,95,54,97*4,92*2,99,98*2,d6,9d,02,bh,9d*3,9a*6,9b,bh,9c,9d,02,9d*2,bh,9d,bh,9d,02,1q,9i,9d,7x,9e,9f*2,6u,9g,6y,9h*3,9i*3,9k*3,9m*10,9n*3,9d,9n*2,9o*13,9i*2,9p,d6,92*2,1b,9q,8u,9q*2,9r,en,3m,0a*2,em*4,9s,9t,dy,9u,9v,9w,9y*6,9z,a0,eo*2,a2,a4*2,a5*2,a6*4,a7,a8*3,a9*3,aa*2,ab,ac*2,7o,ad*2,ae,af*3,am,al*3,an,ah,ak,ag,al,aj,ao,1q,a4,ap,bc,aq,as,at,av,ax,ay,az,b0,2h,b1,bc*2,b2,b3,b4,2h*2,b5*3,b6*3,b7,b8,b9,ba,bb,bc*2,18,19,bf*3,bg,bh*6,9o,bh*2,bi*2,bj,a6,bk,ai,bl,8l,bm,d6*4,bn,bo,bp,bq,br,bs,bt*2,bu,bx*2,bv,bw,bx*2,8u*2,bx*2,by*3,bx,8u*3,bx,8u*2,72,7p*4,c0,02*2,9q*2,c8,c3,c4,d6,c5,c6,c7,c9,99,cb,d3*2,d2,ca,cb*2,cy,cc,26*2,cd,26,3n,86,cg*4,cf,cg*2,ch,cg*3,ci,cj,ce,ck,9d,cl,1q,cl,cm,9d,cn,54*3,co,2h*2,3m,cp*2,0e,0x,cq,cr,cs,7h,ct*2,cv,ct*7,cu,cv*2,cw,1q,cw,cx,cy*2,d0,du*2,d1*2,d4,9j*2,d6*10,d5,cv*2,ep,d5*3,d6*2,d7*3,d9,da,db,dc,d5*2,df*2,dg,dh,di,dj,do,dp,dq,dr,ds,dt,dv,dw*3,dx*3,dy*3,dz,e0*3,e1,e2*3,e3*4,e4,e5,e6,4l,e7,e8,e9,bl,ea*2,eb,ec,ed,3j*2,ee*2,8w,24,43,44,6k,6r,6s,70,6w,72,6w,6z,6y,70*2,6y,6q,74*2,6x,7h,9g,au,aw,0e,d8,dd,4g*2,7j,82,de,6r,71,a3,ef,43,9f,eg,23,a6,9l,eh,9o*3,2h,ei,ej,5y,61*3,ek,el,a1,d2*2,eo*3,0a,09,ep,0a,09,eq,er,es,et,eu*8,2l,ev*3,ew,ex,ey*2,ez*7,02*3,9o,8r,a9,1i*2,f1,f2*3,f4,f5,f6'::text s),
guard as (select 1/(md5(s) = '831a1eb15b29d64a77ce168813ee9f3f')::int ok from fam_str),
toks as (
  select u.t, u.ord from fam_str, guard, unnest(string_to_array(fam_str.s, ',')) with ordinality u(t, ord) where guard.ok = 1
),
expd as (
  select toks.ord, g, x.v from toks,
  lateral (select (position(substr(toks.t,1,1) in '0123456789abcdefghijklmnopqrstuvwxyz')-1)*36
                + (position(substr(toks.t,2,1) in '0123456789abcdefghijklmnopqrstuvwxyz')-1) v,
                  coalesce(nullif(split_part(toks.t,'*',2),'')::int, 1) cnt) x,
  lateral generate_series(1, x.cnt) g
),
famrn as (select row_number() over (order by ord, g) rn, v from expd),
pkmap as (
  select pk, row_number() over (order by pk collate "C") rn
  from (select distinct regexp_replace(upper(public.unaccent(btrim(coalesce(procedimento,'')))), '\s+', ' ', 'g') pk
        from escala_cirurgica_evento
        where tipo='status' and hospital<>'fds' and data between '2026-07-22' and '2026-09-24'
          and em < '2026-09-25 03:00:00+00') x
),
fam as (select p.pk, f.v % 600 fid, f.v >= 600 lista from pkmap p join famrn f using (rn)),
-- EVENTOS: só transições do eixo principal (status_de <> status_para; os toggles de aviso ficam fora)
ev as (
  select e.*, regexp_replace(upper(public.unaccent(btrim(coalesce(e.procedimento,'')))), '\s+', ' ', 'g') pk,
    nullif(regexp_replace(regexp_replace(upper(public.unaccent(btrim(coalesce(e.cirurgiao,'')))), '^(DRA?\.?\s+)', ''), '\s+', ' ', 'g'), '') cir
  from escala_cirurgica_evento e
  where e.tipo='status' and e.status_de is distinct from e.status_para and e.hospital<>'fds'
    and e.data between '2026-07-22' and '2026-09-24' and e.em < '2026-09-25 03:00:00+00'
),
-- LOTE: mesma pessoa, mesmo status, intervalos <= 60 s entre marcações consecutivas
cl_src as (
  select ev.*, case when em - lag(em) over (partition by por, status_para order by em) <= interval '60 seconds' then 0 else 1 end novo
  from ev where status_para in ('iniciada','terminada')
),
cl as (select *, sum(novo) over (partition by por, status_para order by em rows unbounded preceding) cid from cl_src),
cl2 as (select *, count(*) over (partition by por, status_para, cid) tam from cl),
-- PAR: 1º iniciada do caso + 1º terminada posterior (lição W30, Achado 2)
ini as (
  select distinct on (caso_id) caso_id, data, hospital, pk, cir, tempo_estimado, anestesista_user_id, em ini_em, tam ini_tam
  from cl2 where status_para='iniciada' order by caso_id, em
),
par as (
  select i.*, t.em ter_em, t.tam ter_tam, extract(epoch from t.em - i.ini_em)/60.0 dur
  from ini i join lateral (
    select em, tam from cl2 where cl2.caso_id=i.caso_id and status_para='terminada' and em > i.ini_em order by em limit 1
  ) t on true
),
d as (
  select par.*, f.fid, f.lista, (par.ini_tam < 3 and par.ter_tam < 3) limpo,
    case when tempo_estimado ~ '^\s*\d{1,2}:\d{2}\s*,
var as (select * from (values ('A'), ('B')) v(variante)),
dv as (select var.variante, d.* from d cross join var where var.variante = 'A' or d.limpo),
tr as (select * from dv where data < '2026-09-14'),
te as (select * from dv where data >= '2026-09-14'),
m_h as (select variante, hospital, percentile_cont(0.5) within group (order by dur) med, count(*) n from tr group by 1,2),
m_f as (select variante, fid, percentile_cont(0.5) within group (order by dur) med, count(*) n from tr group by 1,2),
m_c as (select variante, cir, percentile_cont(0.5) within group (order by dur) med, count(*) n from tr where cir is not null group by 1,2),
m_fc as (select variante, fid, cir, percentile_cont(0.5) within group (order by dur) med, count(*) n from tr where cir is not null group by 1,2,3),
pr as (
  select te.variante, te.hospital, te.dur, te.te_min, te.lista,
    h.med p_h,
    case when f.n >= 5 then f.med when c.n >= 5 then c.med else h.med end p_f,
    case when fc.n >= 5 then fc.med when f.n >= 5 then f.med when c.n >= 5 then c.med else h.med end p_fc,
    case when c.n >= 5 then c.med else h.med end p_c,
    coalesce(te.te_min, h.med) p_te,
    coalesce(f.n,0) >= 5 tem_f, coalesce(fc.n,0) >= 5 tem_fc, coalesce(c.n,0) >= 5 tem_c
  from te join m_h h on h.variante=te.variante and h.hospital=te.hospital
  left join m_f f on f.variante=te.variante and f.fid=te.fid
  left join m_c c on c.variante=te.variante and c.cir=te.cir
  left join m_fc fc on fc.variante=te.variante and fc.fid=te.fid and fc.cir=te.cir
),
prs as (
  select 'todos' subconj, * from pr
  union all select 'familia_n5_no_treino', * from pr where tem_f
  union all select 'fam_x_cirurgiao_n5', * from pr where tem_fc
  union all select 'com_tempo_estimado', * from pr where te_min is not null
  union all select 'sem_listas', * from pr where not lista
),
bt as (
  select variante, subconj, count(*) n,
    round(percentile_cont(0.5) within group (order by abs(dur-p_h))::numeric,1) mdae_hosp,
    round(percentile_cont(0.5) within group (order by abs(dur-p_f))::numeric,1) mdae_fam_cir_hosp,
    round(percentile_cont(0.5) within group (order by abs(dur-p_fc))::numeric,1) mdae_famxcir_fam_cir_hosp,
    round(percentile_cont(0.5) within group (order by abs(dur-p_c))::numeric,1) mdae_cir_hosp,
    round(percentile_cont(0.5) within group (order by abs(dur-p_te))::numeric,1) mdae_tempo_estimado_hosp,
    round(avg((abs(dur-p_h) <= 30)::int)::numeric,3) ate30_hosp,
    round(avg((abs(dur-p_f) <= 30)::int)::numeric,3) ate30_fam,
    round(avg((abs(dur-p_f) < abs(dur-p_h))::int)::numeric,3) fam_ganha_do_hosp,
    round(avg((abs(dur-p_fc) < abs(dur-p_f))::int)::numeric,3) famxcir_ganha_da_fam,
    round(avg((abs(dur-p_fc) > abs(dur-p_f))::int)::numeric,3) famxcir_perde_da_fam,
    round(avg(tem_f::int)::numeric,3) cobertura_fam, round(avg(tem_fc::int)::numeric,3) cobertura_famxcir,
    round(percentile_cont(0.5) within group (order by dur)::numeric) mediana_real
  from prs group by 1,2
),
fam_tab as (
  select fid, bool_or(lista) lista,
    count(*) n_a, round(percentile_cont(0.25) within group (order by dur)::numeric) p25_a,
    round(percentile_cont(0.5) within group (order by dur)::numeric) med_a, round(percentile_cont(0.75) within group (order by dur)::numeric) p75_a,
    count(*) filter (where limpo) n_b,
    round((percentile_cont(0.5) within group (order by dur) filter (where limpo))::numeric) med_b,
    round((percentile_cont(0.75) within group (order by dur) filter (where limpo))::numeric) p75_b,
    count(distinct cir) cirurgioes, count(distinct hospital) hosp
  from d group by fid having count(*) >= 10
),
tot as (
  select count(*) pares_plausiveis_nao_genericos, count(*) filter (where limpo) limpos, count(distinct fid) familias,
    count(*) filter (where lista) em_listas, count(*) filter (where te_min is not null) com_tempo_estimado,
    count(*) filter (where data < '2026-09-14') treino_a, count(*) filter (where data >= '2026-09-14') teste_a,
    count(*) filter (where data < '2026-09-14' and limpo) treino_b, count(*) filter (where data >= '2026-09-14' and limpo) teste_b,
    count(distinct cir) cirurgioes
  from d
)
select json_build_object(
  'check_rn', (select count(*) from famrn), 'check_pk', (select count(*) from pkmap),
  'tot', (select row_to_json(tot) from tot),
  'bt', (select json_agg(bt order by variante, subconj) from bt),
  'fam', (select json_agg(fam_tab order by n_a desc) from fam_tab)
) r

           then split_part(btrim(tempo_estimado),':',1)::int*60 + split_part(btrim(tempo_estimado),':',2)::int
         when tempo_estimado ~* '^\s*\d{1,2}\s*h\s*(\d{1,2})?\s*,
var as (select * from (values ('A'), ('B')) v(variante)),
dv as (select var.variante, d.* from d cross join var where var.variante = 'A' or d.limpo),
tr as (select * from dv where data < '2026-09-14'),
te as (select * from dv where data >= '2026-09-14'),
m_h as (select variante, hospital, percentile_cont(0.5) within group (order by dur) med, count(*) n from tr group by 1,2),
m_f as (select variante, fid, percentile_cont(0.5) within group (order by dur) med, count(*) n from tr group by 1,2),
m_c as (select variante, cir, percentile_cont(0.5) within group (order by dur) med, count(*) n from tr where cir is not null group by 1,2),
m_fc as (select variante, fid, cir, percentile_cont(0.5) within group (order by dur) med, count(*) n from tr where cir is not null group by 1,2,3),
pr as (
  select te.variante, te.hospital, te.dur, te.te_min, te.lista,
    h.med p_h,
    case when f.n >= 5 then f.med when c.n >= 5 then c.med else h.med end p_f,
    case when fc.n >= 5 then fc.med when f.n >= 5 then f.med when c.n >= 5 then c.med else h.med end p_fc,
    case when c.n >= 5 then c.med else h.med end p_c,
    coalesce(te.te_min, h.med) p_te,
    coalesce(f.n,0) >= 5 tem_f, coalesce(fc.n,0) >= 5 tem_fc, coalesce(c.n,0) >= 5 tem_c
  from te join m_h h on h.variante=te.variante and h.hospital=te.hospital
  left join m_f f on f.variante=te.variante and f.fid=te.fid
  left join m_c c on c.variante=te.variante and c.cir=te.cir
  left join m_fc fc on fc.variante=te.variante and fc.fid=te.fid and fc.cir=te.cir
),
prs as (
  select 'todos' subconj, * from pr
  union all select 'familia_n5_no_treino', * from pr where tem_f
  union all select 'fam_x_cirurgiao_n5', * from pr where tem_fc
  union all select 'com_tempo_estimado', * from pr where te_min is not null
  union all select 'sem_listas', * from pr where not lista
),
bt as (
  select variante, subconj, count(*) n,
    round(percentile_cont(0.5) within group (order by abs(dur-p_h))::numeric,1) mdae_hosp,
    round(percentile_cont(0.5) within group (order by abs(dur-p_f))::numeric,1) mdae_fam_cir_hosp,
    round(percentile_cont(0.5) within group (order by abs(dur-p_fc))::numeric,1) mdae_famxcir_fam_cir_hosp,
    round(percentile_cont(0.5) within group (order by abs(dur-p_c))::numeric,1) mdae_cir_hosp,
    round(percentile_cont(0.5) within group (order by abs(dur-p_te))::numeric,1) mdae_tempo_estimado_hosp,
    round(avg((abs(dur-p_h) <= 30)::int)::numeric,3) ate30_hosp,
    round(avg((abs(dur-p_f) <= 30)::int)::numeric,3) ate30_fam,
    round(avg((abs(dur-p_f) < abs(dur-p_h))::int)::numeric,3) fam_ganha_do_hosp,
    round(avg((abs(dur-p_fc) < abs(dur-p_f))::int)::numeric,3) famxcir_ganha_da_fam,
    round(avg((abs(dur-p_fc) > abs(dur-p_f))::int)::numeric,3) famxcir_perde_da_fam,
    round(avg(tem_f::int)::numeric,3) cobertura_fam, round(avg(tem_fc::int)::numeric,3) cobertura_famxcir,
    round(percentile_cont(0.5) within group (order by dur)::numeric) mediana_real
  from prs group by 1,2
),
fam_tab as (
  select fid, bool_or(lista) lista,
    count(*) n_a, round(percentile_cont(0.25) within group (order by dur)::numeric) p25_a,
    round(percentile_cont(0.5) within group (order by dur)::numeric) med_a, round(percentile_cont(0.75) within group (order by dur)::numeric) p75_a,
    count(*) filter (where limpo) n_b,
    round((percentile_cont(0.5) within group (order by dur) filter (where limpo))::numeric) med_b,
    round((percentile_cont(0.75) within group (order by dur) filter (where limpo))::numeric) p75_b,
    count(distinct cir) cirurgioes, count(distinct hospital) hosp
  from d group by fid having count(*) >= 10
),
tot as (
  select count(*) pares_plausiveis_nao_genericos, count(*) filter (where limpo) limpos, count(distinct fid) familias,
    count(*) filter (where lista) em_listas, count(*) filter (where te_min is not null) com_tempo_estimado,
    count(*) filter (where data < '2026-09-14') treino_a, count(*) filter (where data >= '2026-09-14') teste_a,
    count(*) filter (where data < '2026-09-14' and limpo) treino_b, count(*) filter (where data >= '2026-09-14' and limpo) teste_b,
    count(distinct cir) cirurgioes
  from d
)
select json_build_object(
  'check_rn', (select count(*) from famrn), 'check_pk', (select count(*) from pkmap),
  'tot', (select row_to_json(tot) from tot),
  'bt', (select json_agg(bt order by variante, subconj) from bt),
  'fam', (select json_agg(fam_tab order by n_a desc) from fam_tab)
) r

           then (regexp_match(tempo_estimado, '(\d{1,2})\s*[hH]'))[1]::int*60
                + coalesce((regexp_match(tempo_estimado, '[hH]\s*(\d{1,2})'))[1]::int, 0)
    end te_min
  from par join fam f using (pk)
  -- plausível: 5 min a 12 h; famílias genéricas fora (vazio, consultório, continuação,
  -- "procedimentos", emergência/urgência, materno, dia todo, centro obstétrico, ortopedia, "anestesia realizada")
  where par.dur between 5 and 720
    and f.fid not in (1,20,83,128,129,130,158,181,349,371,409,410,536)
)
,
var as (select * from (values ('A'), ('B')) v(variante)),
dv as (select var.variante, d.* from d cross join var where var.variante = 'A' or d.limpo),
tr as (select * from dv where data < '2026-09-14'),
te as (select * from dv where data >= '2026-09-14'),
m_h as (select variante, hospital, percentile_cont(0.5) within group (order by dur) med, count(*) n from tr group by 1,2),
m_f as (select variante, fid, percentile_cont(0.5) within group (order by dur) med, count(*) n from tr group by 1,2),
m_c as (select variante, cir, percentile_cont(0.5) within group (order by dur) med, count(*) n from tr where cir is not null group by 1,2),
m_fc as (select variante, fid, cir, percentile_cont(0.5) within group (order by dur) med, count(*) n from tr where cir is not null group by 1,2,3),
pr as (
  select te.variante, te.hospital, te.dur, te.te_min, te.lista,
    h.med p_h,
    case when f.n >= 5 then f.med when c.n >= 5 then c.med else h.med end p_f,
    case when fc.n >= 5 then fc.med when f.n >= 5 then f.med when c.n >= 5 then c.med else h.med end p_fc,
    case when c.n >= 5 then c.med else h.med end p_c,
    coalesce(te.te_min, h.med) p_te,
    coalesce(f.n,0) >= 5 tem_f, coalesce(fc.n,0) >= 5 tem_fc, coalesce(c.n,0) >= 5 tem_c
  from te join m_h h on h.variante=te.variante and h.hospital=te.hospital
  left join m_f f on f.variante=te.variante and f.fid=te.fid
  left join m_c c on c.variante=te.variante and c.cir=te.cir
  left join m_fc fc on fc.variante=te.variante and fc.fid=te.fid and fc.cir=te.cir
),
prs as (
  select 'todos' subconj, * from pr
  union all select 'familia_n5_no_treino', * from pr where tem_f
  union all select 'fam_x_cirurgiao_n5', * from pr where tem_fc
  union all select 'com_tempo_estimado', * from pr where te_min is not null
  union all select 'sem_listas', * from pr where not lista
),
bt as (
  select variante, subconj, count(*) n,
    round(percentile_cont(0.5) within group (order by abs(dur-p_h))::numeric,1) mdae_hosp,
    round(percentile_cont(0.5) within group (order by abs(dur-p_f))::numeric,1) mdae_fam_cir_hosp,
    round(percentile_cont(0.5) within group (order by abs(dur-p_fc))::numeric,1) mdae_famxcir_fam_cir_hosp,
    round(percentile_cont(0.5) within group (order by abs(dur-p_c))::numeric,1) mdae_cir_hosp,
    round(percentile_cont(0.5) within group (order by abs(dur-p_te))::numeric,1) mdae_tempo_estimado_hosp,
    round(avg((abs(dur-p_h) <= 30)::int)::numeric,3) ate30_hosp,
    round(avg((abs(dur-p_f) <= 30)::int)::numeric,3) ate30_fam,
    round(avg((abs(dur-p_f) < abs(dur-p_h))::int)::numeric,3) fam_ganha_do_hosp,
    round(avg((abs(dur-p_fc) < abs(dur-p_f))::int)::numeric,3) famxcir_ganha_da_fam,
    round(avg((abs(dur-p_fc) > abs(dur-p_f))::int)::numeric,3) famxcir_perde_da_fam,
    round(avg(tem_f::int)::numeric,3) cobertura_fam, round(avg(tem_fc::int)::numeric,3) cobertura_famxcir,
    round(percentile_cont(0.5) within group (order by dur)::numeric) mediana_real
  from prs group by 1,2
),
fam_tab as (
  select fid, bool_or(lista) lista,
    count(*) n_a, round(percentile_cont(0.25) within group (order by dur)::numeric) p25_a,
    round(percentile_cont(0.5) within group (order by dur)::numeric) med_a, round(percentile_cont(0.75) within group (order by dur)::numeric) p75_a,
    count(*) filter (where limpo) n_b,
    round((percentile_cont(0.5) within group (order by dur) filter (where limpo))::numeric) med_b,
    round((percentile_cont(0.75) within group (order by dur) filter (where limpo))::numeric) p75_b,
    count(distinct cir) cirurgioes, count(distinct hospital) hosp
  from d group by fid having count(*) >= 10
),
tot as (
  select count(*) pares_plausiveis_nao_genericos, count(*) filter (where limpo) limpos, count(distinct fid) familias,
    count(*) filter (where lista) em_listas, count(*) filter (where te_min is not null) com_tempo_estimado,
    count(*) filter (where data < '2026-09-14') treino_a, count(*) filter (where data >= '2026-09-14') teste_a,
    count(*) filter (where data < '2026-09-14' and limpo) treino_b, count(*) filter (where data >= '2026-09-14' and limpo) teste_b,
    count(distinct cir) cirurgioes
  from d
)
select json_build_object(
  'check_rn', (select count(*) from famrn), 'check_pk', (select count(*) from pkmap),
  'tot', (select row_to_json(tot) from tot),
  'bt', (select json_agg(bt order by variante, subconj) from bt),
  'fam', (select json_agg(fam_tab order by n_a desc) from fam_tab)
) r

-- =====================================================================================
-- Q3. Rodapé x fim real da última cirurgia x liberação (dia útil, Unimed e HRO; Materno quase
-- não usa rodapé: 3 turnos/4 posições). ordem_saida = n_ordem-1-pos (0 = último da lista = 1º a sair).
-- ρ de Spearman por turno = corr() dos postos médios (empates), só turnos com >= 4 pessoas.
-- ρ > 0  <=>  quem sai antes terminou antes.
-- =====================================================================================
-- CTE comum (Q3a–Q3f): ev, cl_src, cl, cl2 como na Q1b; mais:
--   cur (casos atuais Unimed/HRO com turno, uid, status_extra, origem, hora e chave), casos_ev, mapa (órfão→atual),
--   ter_caso (1ª terminada por caso atual + tamanho do lote),
--   o (rodapé explodido: ordem_liberacao->turno, array legado = matutino), al (apelido→user_id),
--   pos (posição→uid; 2.922 posições, 100% mapeadas), pessoa (casos válidos = não suspensos;
--   fim = maior 1ª-terminada entre os casos da pessoa, só quando TODOS têm terminada;
--   lib_em = liberacoes->(turno||':'||uid)->>'liberadoEm').
with ev as (
  select e.* from escala_cirurgica_evento e
  where tipo='status' and status_de is distinct from status_para and hospital<>'fds'
    and data between '2026-07-22' and '2026-09-24' and em < '2026-09-25 03:00:00+00'),
cl_src as (select ev.*, case when em - lag(em) over (partition by por, status_para order by em) <= interval '60 seconds' then 0 else 1 end novo
  from ev where status_para in ('iniciada','terminada')),
cl as (select *, sum(novo) over (partition by por, status_para order by em rows unbounded preceding) cid from cl_src),
cl2 as (select *, count(*) over (partition by por, status_para, cid) tam from cl),
cur as (
  select c.id, e.id escala_id, e.data, e.hospital, c.turno, c.anestesista_user_id uid, c.status_extra, c.origem, c.hora,
    lower(btrim(c.sala)) sala_k, coalesce(btrim(c.hora),'') hora_k, upper(btrim(coalesce(c.cirurgiao,''))) cir_k, upper(btrim(coalesce(c.procedimento,''))) proc_k,
    count(*) over (partition by e.data, e.hospital, lower(btrim(c.sala)), coalesce(btrim(c.hora),''), upper(btrim(coalesce(c.cirurgiao,''))), upper(btrim(coalesce(c.procedimento,'')))) nk
  from escala_cirurgica_caso c join escala_cirurgica e on e.id=c.escala_id
  where e.hospital in ('unimed','hro') and e.data between '2026-07-22' and '2026-09-24'),
casos_ev as (select distinct on (caso_id) caso_id, data, hospital, lower(btrim(sala)) sala_k, coalesce(btrim(hora),'') hora_k,
    upper(btrim(coalesce(cirurgiao,''))) cir_k, upper(btrim(coalesce(procedimento,''))) proc_k, anestesista_user_id a0 from ev order by caso_id, em),
mapa as (select ce.caso_id, ce.a0, coalesce(c1.id, c2.id) cur_id from casos_ev ce
  left join cur c1 on c1.id = ce.caso_id
  left join cur c2 on c1.id is null and c2.nk = 1 and c2.data=ce.data and c2.hospital=ce.hospital and c2.sala_k=ce.sala_k
    and c2.hora_k=ce.hora_k and c2.cir_k=ce.cir_k and c2.proc_k=ce.proc_k),
ter_caso as (
  select m.cur_id, min(cl2.em) ter_em, (array_agg(cl2.tam order by cl2.em))[1] ter_tam, (array_agg(cl2.por order by cl2.em))[1] ter_por,
    bool_or(m.a0 is distinct from cu.uid) mudou_anest
  from mapa m join cl2 on cl2.caso_id = m.caso_id and cl2.status_para = 'terminada' join cur cu on cu.id = m.cur_id
  where m.cur_id is not null group by m.cur_id),
o as (
  select e.id escala_id, e.data, e.hospital, t.turno, e.liberacoes, x.nome, (x.idx - 1)::int pos, jsonb_array_length(t.arr) n_ordem
  from escala_cirurgica e
  cross join lateral (select 'matutino' turno, case when jsonb_typeof(e.ordem_liberacao)='array' then e.ordem_liberacao else e.ordem_liberacao->'matutino' end arr
                      union all select 'vespertino', case when jsonb_typeof(e.ordem_liberacao)='object' then e.ordem_liberacao->'vespertino' end) t
  cross join lateral jsonb_array_elements_text(case when jsonb_typeof(t.arr)='array' then t.arr else '[]'::jsonb end) with ordinality x(nome, idx)
  where e.hospital in ('unimed','hro') and e.data between '2026-07-22' and '2026-09-24' and extract(isodow from e.data) between 1 and 5),
al as (select distinct on (upper(public.unaccent(btrim(apelido)))) upper(public.unaccent(btrim(apelido))) ap, user_id from escala_anestesista_alias),
pos as (select distinct on (o.escala_id, o.turno, al.user_id) o.*, al.user_id uid
  from o join al on al.ap = btrim(regexp_replace(upper(public.unaccent(regexp_replace(o.nome, '\(.*?\)|\(.*$', '', 'g'))), '\s+', ' ', 'g'))
  order by o.escala_id, o.turno, al.user_id, o.pos),
pessoa as (
  select p.escala_id, p.data, p.hospital, p.turno, p.pos, p.n_ordem, p.uid, (p.n_ordem - 1 - p.pos) ordem_saida,
    count(c.id) filter (where coalesce(c.status_extra,'') <> 'suspensa') casos_validos,
    count(tc.cur_id) filter (where coalesce(c.status_extra,'') <> 'suspensa') casos_com_ter,
    max(tc.ter_em) fim, (array_agg(tc.ter_tam order by tc.ter_em desc nulls last))[1] fim_tam,
    (array_agg(tc.ter_por order by tc.ter_em desc nulls last))[1] fim_por,
    max(case when c.hora ~ '^\d{1,2}:\d{2}$' then c.hora::time end) ultima_hora_marcada,
    ((p.liberacoes -> (p.turno || ':' || p.uid)) ->> 'liberadoEm')::timestamptz lib_em,
    ((p.liberacoes -> (p.turno || ':' || p.uid)) ->> 'por') lib_por
  from pos p left join cur c on c.escala_id = p.escala_id and c.turno = p.turno and c.uid = p.uid
  left join ter_caso tc on tc.cur_id = c.id
  group by 1,2,3,4,5,6,7,p.liberacoes),
ok as (select * from pessoa where casos_validos > 0 and casos_com_ter = casos_validos),
-- Q3b. variantes do ρ(ordem de saída, fim da última cirurgia)
vars as (
  select 'todos' v, * from ok
  union all select 'sem_plantonista', * from ok where pos > 0
  union all select 'fim_sem_lote', * from ok where fim_tam < 3),
rk as (select v, escala_id, turno, hospital,
    rank() over w1 + (count(*) over (partition by v, escala_id, turno, ordem_saida) - 1) / 2.0 r_saida,
    rank() over w2 + (count(*) over (partition by v, escala_id, turno, fim) - 1) / 2.0 r_fim
  from vars window w1 as (partition by v, escala_id, turno order by ordem_saida), w2 as (partition by v, escala_id, turno order by fim)),
rho as (select v, escala_id, turno, hospital, count(*) n, corr(r_saida, r_fim) rho from rk group by 1,2,3,4 having count(*) >= 4)
select v, count(*) turnos_n4, round(avg(n),1) n_medio,
  round(percentile_cont(0.25) within group (order by rho)::numeric,2) p25, round(percentile_cont(0.5) within group (order by rho)::numeric,2) mediana,
  round(percentile_cont(0.75) within group (order by rho)::numeric,2) p75, round(avg(rho)::numeric,2) media,
  count(*) filter (where rho > 0) positivos, count(*) filter (where rho < 0) negativos,
  count(*) filter (where rho >= 0.5) forte_pos, count(*) filter (where rho <= -0.5) forte_neg
from rho group by 1 order by 1;
-- Q3a (disponibilidade) = mesma cadeia até "pessoa", agregando por hospital/turno:
--   posicoes, com_casos (casos_validos>0), fim_conhecido (casos_com_ter=casos_validos), fim_conhecido_sem_lote (fim_tam<3),
--   com_liberacao (lib_em not null), fim_e_liberacao.
-- Q3c (só casos IMPORTADOS e sem troca de anestesista depois do 1º evento) = mesma cadeia, trocando "pessoa" por:
--   join cur c ... and c.origem = 'importacao' and coalesce(c.status_extra,'') <> 'suspensa'; variante extra: not bool_or(tc.mudou_anest)
--   (resultado: 130 turnos, ρ mediano 0,59; Unimed 0,67; HRO 0,45; 117 positivos / 13 negativos)
-- Q3d (ρ com nº de casos do mapa, última hora marcada no mapa, hora da liberação; inversões de liberação):
--   vars = ('ultima_hora_marcada_no_mapa', extract(epoch from ultima_hora)) | ('n_casos_no_mapa', casos_validos) | ('hora_da_liberacao', lib_em)
--   inv = pares (a.pos < b.pos) com as duas liberações: invertido se b.lib_em > a.lib_em + 1 min
-- Q3e (pares discordantes: a sai antes de b, mas a.fim > b.fim; >30 e >60 min), só casos importados:
--   pares as (select extract(epoch from a.fim - b.fim)/60.0 dif from ok a join ok b on mesmo turno and a.pos > b.pos)
-- Q3f (ocioso = lib_em - fim): mediana, p25, p75, |.|<=2 min, liberado antes do fim (< -2 min), > 30, > 60 min.

-- =====================================================================================
-- Q4. Lacunas de captura
-- =====================================================================================
-- Q4a. Preenchimento hoje
select
  (select count(*) from escala_cirurgica_caso c join escala_cirurgica e on e.id=c.escala_id where e.hospital<>'fds' and e.data between '2026-07-22' and '2026-09-24') casos,
  (select count(*) from escala_cirurgica_caso c join escala_cirurgica e on e.id=c.escala_id where e.hospital<>'fds' and e.data between '2026-07-22' and '2026-09-24' and coalesce(c.termino_previsto,'')<>'') casos_com_termino_previsto,
  (select count(*) from escala_cirurgica_caso c join escala_cirurgica e on e.id=c.escala_id where e.hospital<>'fds' and e.data between '2026-07-22' and '2026-09-24' and coalesce(c.tempo_estimado,'')<>'') com_tempo_estimado,
  (select count(*) from escala_cirurgica_caso c join escala_cirurgica e on e.id=c.escala_id where e.hospital<>'fds' and e.data between '2026-07-22' and '2026-09-24' and coalesce(c.cirurgiao_display,'')<>'') com_cirurgiao_display,
  (select count(*) from escala_cirurgica_caso c join escala_cirurgica e on e.id=c.escala_id where e.hospital<>'fds' and e.data between '2026-07-22' and '2026-09-24' and coalesce(c.gravidade,'')<>'') com_gravidade,
  (select count(*) from escala_cirurgica e, jsonb_each(case when jsonb_typeof(e.linha_overrides)='object' then e.linha_overrides else '{}'::jsonb end) x(k,v)
     where e.hospital in ('unimed','hro','materno') and e.data between '2026-07-22' and '2026-09-24' and coalesce(v->>'termino','')<>'') overrides_com_termino;
-- Q4b. termino_previsto antes/depois do zeramento na terminada (15/09)
select case when e.data < '2026-09-15' then 'ate_14_09' else 'desde_15_09' end periodo, count(*) casos,
  count(*) filter (where c.status_cirurgia='terminada') terminadas,
  count(*) filter (where coalesce(c.termino_previsto,'')<>'' and c.status_cirurgia='terminada') terminadas_com_tp
from escala_cirurgica_caso c join escala_cirurgica e on e.id=c.escala_id
where e.hospital<>'fds' and e.data between '2026-07-22' and '2026-09-24' group by 1 order by 1;
-- Q4c. Estimativa humana sobrevivente (termino_previsto) x 'terminada' marcada — sem saber QUANDO foi informada
with ev as (select e.* from escala_cirurgica_evento e where tipo='status' and status_de is distinct from status_para and hospital<>'fds'
    and data between '2026-07-22' and '2026-09-24' and em < '2026-09-25 03:00:00+00'),
cur as (select c.id, e.data, e.hospital, c.termino_previsto,
    lower(btrim(c.sala)) sala_k, coalesce(btrim(c.hora),'') hora_k, upper(btrim(coalesce(c.cirurgiao,''))) cir_k, upper(btrim(coalesce(c.procedimento,''))) proc_k,
    count(*) over (partition by e.data, e.hospital, lower(btrim(c.sala)), coalesce(btrim(c.hora),''), upper(btrim(coalesce(c.cirurgiao,''))), upper(btrim(coalesce(c.procedimento,'')))) nk
  from escala_cirurgica_caso c join escala_cirurgica e on e.id=c.escala_id
  where e.hospital<>'fds' and e.data between '2026-07-22' and '2026-09-24' and c.status_cirurgia='terminada' and coalesce(c.termino_previsto,'')<>''),
ter as (select cur.id, cur.data, cur.termino_previsto, min(ev.em) ter_em
  from cur join ev on ev.status_para='terminada' and (ev.caso_id = cur.id or (cur.nk=1 and ev.data=cur.data and ev.hospital=cur.hospital and lower(btrim(ev.sala))=cur.sala_k
       and coalesce(btrim(ev.hora),'')=cur.hora_k and upper(btrim(coalesce(ev.cirurgiao,'')))=cur.cir_k and upper(btrim(coalesce(ev.procedimento,'')))=cur.proc_k))
  group by 1,2,3)
select count(*) n,
  round(percentile_cont(0.5) within group (order by abs(extract(epoch from (ter_em at time zone 'America/Sao_Paulo') - (data + termino_previsto::time))/60.0))::numeric,1) mdae_min,
  round(percentile_cont(0.5) within group (order by extract(epoch from (ter_em at time zone 'America/Sao_Paulo') - (data + termino_previsto::time))/60.0)::numeric,1) vies_mediano_min,
  round(avg((abs(extract(epoch from (ter_em at time zone 'America/Sao_Paulo') - (data + termino_previsto::time))/60.0) <= 15)::int)::numeric,2) ate15
from ter;
-- Q4d. Anestesista do caso mudou depois do 1º evento (troca de alocação sem histórico próprio)
with ev as (select e.* from escala_cirurgica_evento e where tipo='status' and hospital in ('unimed','hro') and data between '2026-07-22' and '2026-09-24' and em < '2026-09-25 03:00:00+00'),
prim as (select distinct on (caso_id) caso_id, anestesista_user_id a0 from ev order by caso_id, em)
select count(*) casos_com_evento, count(*) filter (where p.a0 is distinct from c.anestesista_user_id) anest_mudou
from escala_cirurgica_caso c join prim p on p.caso_id = c.id;
-- Q4e. Campos que existem em linha_overrides / liberacoes (nenhum além de trocaCom/assumidaPor tem log)
select k2, count(*) from escala_cirurgica e, jsonb_each(case when jsonb_typeof(e.linha_overrides)='object' then e.linha_overrides else '{}'::jsonb end) x(k,v),
  jsonb_object_keys(case when jsonb_typeof(v)='object' then v else '{}'::jsonb end) k2 where e.data between '2026-07-22' and '2026-09-24' group by 1 order by 2 desc;

-- =====================================================================================
-- ANEXO — texto integral das variações citadas acima por descrição
-- =====================================================================================

-- Q1e. Faixas de duração dos pares (nível caso_id) e ponta em lote
with ev as (select id, caso_id, hospital, data, por, em, status_para, status_de from escala_cirurgica_evento
  where tipo='status' and status_de is distinct from status_para and hospital<>'fds' and data between '2026-07-22' and '2026-09-24'),
g as (select *, case when em - lag(em) over (partition by por, status_para order by em) <= interval '60 seconds' then 0 else 1 end novo
  from ev where status_para in ('iniciada','terminada')),
cl as (select *, sum(novo) over (partition by por, status_para order by em) cid from g),
cl2 as (select *, count(*) over (partition by por, status_para, cid) tam from cl),
ini as (select distinct on (caso_id) caso_id, em ini_em, tam ini_tam from cl2 where status_para='iniciada' order by caso_id, em),
par as (select i.caso_id, i.ini_em, i.ini_tam, t.em ter_em, t.tam ter_tam, extract(epoch from t.em - i.ini_em)/60.0 dur
  from ini i join lateral (select em, tam from cl2 where cl2.caso_id=i.caso_id and status_para='terminada' and em > i.ini_em order by em limit 1) t on true)
select case when dur<2 then 'a <2' when dur<5 then 'b 2-5' when dur<10 then 'c 5-10' when dur<30 then 'd 10-30' when dur<60 then 'e 30-60'
  when dur<120 then 'f 60-120' when dur<240 then 'g 120-240' when dur<360 then 'h 240-360' when dur<600 then 'i 360-600' else 'j 600+' end faixa,
 count(*) n, count(*) filter (where ini_tam>=3 or ter_tam>=3) em_lote3, count(*) filter (where ini_tam=1 and ter_tam=1) ambos_isolados
from par group by 1 order by 1;

-- Q1i. Evolução semanal (casos, pares plausíveis, sem lote, % de terminadas em lote)
with ev as (select e.* from escala_cirurgica_evento e where tipo='status' and status_de is distinct from status_para and hospital<>'fds'
    and data between '2026-07-22' and '2026-09-24' and em < '2026-09-25 03:00:00+00'),
cl_src as (select ev.*, case when em - lag(em) over (partition by por, status_para order by em) <= interval '60 seconds' then 0 else 1 end novo
  from ev where status_para in ('iniciada','terminada')),
cl as (select *, sum(novo) over (partition by por, status_para order by em rows unbounded preceding) cid from cl_src),
cl2 as (select *, count(*) over (partition by por, status_para, cid) tam from cl),
cur as (select c.id, e.data, e.hospital,
    lower(btrim(c.sala)) sala_k, coalesce(btrim(c.hora),'') hora_k, upper(btrim(coalesce(c.cirurgiao,''))) cir_k, upper(btrim(coalesce(c.procedimento,''))) proc_k,
    count(*) over (partition by e.data, e.hospital, lower(btrim(c.sala)), coalesce(btrim(c.hora),''), upper(btrim(coalesce(c.cirurgiao,''))), upper(btrim(coalesce(c.procedimento,'')))) nk
  from escala_cirurgica_caso c join escala_cirurgica e on e.id=c.escala_id where e.hospital<>'fds' and e.data between '2026-07-22' and '2026-09-24'),
casos_ev as (select distinct on (caso_id) caso_id, data, hospital, lower(btrim(sala)) sala_k, coalesce(btrim(hora),'') hora_k,
    upper(btrim(coalesce(cirurgiao,''))) cir_k, upper(btrim(coalesce(procedimento,''))) proc_k from ev order by caso_id, em),
mapa as (select ce.caso_id, coalesce(c1.id, c2.id) cur_id from casos_ev ce left join cur c1 on c1.id = ce.caso_id
  left join cur c2 on c1.id is null and c2.nk = 1 and c2.data=ce.data and c2.hospital=ce.hospital and c2.sala_k=ce.sala_k and c2.hora_k=ce.hora_k and c2.cir_k=ce.cir_k and c2.proc_k=ce.proc_k),
ini as (select distinct on (caso_id) caso_id, em ini_em, tam ini_tam from cl2 where status_para='iniciada' order by caso_id, em),
par as (select i.caso_id, i.ini_tam, t.tam ter_tam, extract(epoch from t.em - i.ini_em)/60.0 dur
  from ini i join lateral (select em, tam from cl2 where cl2.caso_id=i.caso_id and status_para='terminada' and em > i.ini_em order by em limit 1) t on true),
cur_par as (select cur.id, cur.data, cur.hospital, p.dur, p.ini_tam, p.ter_tam
  from cur left join lateral (select p.* from mapa m join par p on p.caso_id=m.caso_id where m.cur_id=cur.id order by p.dur limit 1) p on true),
ter_sem as (select to_char(data,'IYYY-"W"IW') semana, count(*) ter, count(*) filter (where tam >= 3) ter_lote from cl2 where status_para='terminada' group by 1)
select to_char(cp.data,'IYYY-"W"IW') semana, count(*) casos, count(*) filter (where dur between 5 and 720) pares_plausiveis,
  count(*) filter (where dur between 5 and 720 and ini_tam < 3 and ter_tam < 3) pares_sem_lote,
  round(100.0*count(*) filter (where dur between 5 and 720)/count(*),1) pct_plaus, max(ts.ter) terminadas, round(100.0*max(ts.ter_lote)/max(ts.ter),1) pct_terminada_em_lote
from cur_par cp left join ter_sem ts on ts.semana = to_char(cp.data,'IYYY-"W"IW') group by 1 order by 1;

-- Q3a/Q3c/Q3d/Q3e/Q3f usam a MESMA cadeia de CTEs da Q3b (ev … pessoa). Troque o SELECT final por:

-- Q3a. Disponibilidade por hospital/turno (inclua 'materno' em cur/o para ver os 3 turnos do Materno)
--   select hospital, turno, count(distinct (escala_id, turno)) turnos_com_rodape, count(*) posicoes,
--     count(*) filter (where casos_validos > 0) com_casos,
--     count(*) filter (where casos_validos > 0 and casos_com_ter = casos_validos) fim_conhecido,
--     count(*) filter (where casos_validos > 0 and casos_com_ter = casos_validos and fim_tam < 3) fim_conhecido_sem_lote,
--     count(*) filter (where lib_em is not null) com_liberacao,
--     count(*) filter (where lib_em is not null and casos_validos > 0 and casos_com_ter = casos_validos) fim_e_liberacao
--   from pessoa group by rollup(hospital, turno) order by 1,2;

-- Q3c. Só casos importados; variante sem troca de anestesista depois do 1º evento
--   pessoa2 as (select p.escala_id, p.hospital, p.turno, p.pos, (p.n_ordem - 1 - p.pos) ordem_saida,
--       count(c.id) validos, count(tc.cur_id) com_ter, max(tc.ter_em) fim, bool_or(coalesce(tc.mudou_anest,false)) algum_mudou
--     from pos p join cur c on c.escala_id = p.escala_id and c.turno = p.turno and c.uid = p.uid
--       and c.origem = 'importacao' and coalesce(c.status_extra,'') <> 'suspensa'
--     left join ter_caso tc on tc.cur_id = c.id group by 1,2,3,4,5),
--   vars as (select 'so_casos_importados' v, * from pessoa2 where validos = com_ter
--            union all select 'importados_sem_troca_de_anest', * from pessoa2 where validos = com_ter and not algum_mudou)
--   … rk/rho iguais à Q3b, agrupando por rollup(v, hospital).

-- Q3d. ρ da ordem de saída com nº de casos do mapa / última hora marcada no mapa / hora da liberação; inversões
--   vars as (
--     select 'ultima_hora_marcada_no_mapa' v, escala_id, turno, ordem_saida, extract(epoch from ultima_hora_marcada)::float8 x from pessoa where ultima_hora_marcada is not null and casos_validos > 0
--     union all select 'n_casos_no_mapa', escala_id, turno, ordem_saida, casos_validos::float8 from pessoa where casos_validos > 0
--     union all select 'hora_da_liberacao', escala_id, turno, ordem_saida, extract(epoch from lib_em)::float8 from pessoa where lib_em is not null),
--   rk as (… postos médios de ordem_saida e x por v/escala/turno …), rho as (… having count(*) >= 4),
--   inv as (select a.escala_id, a.turno, count(*) pares, count(*) filter (where b.lib_em > a.lib_em + interval '1 minute') invertidos
--           from pessoa a join pessoa b on a.escala_id=b.escala_id and a.turno=b.turno and a.pos < b.pos
--           where a.lib_em is not null and b.lib_em is not null group by 1,2)
--   select count(*) turnos_inv, count(*) filter (where invertidos = 0) sem_inversao, round(100.0*sum(invertidos)/sum(pares),1) pct_pares_invertidos from inv;

-- Q3e. Pares discordantes (só casos importados; a sai antes de b <=> a.pos > b.pos)
--   ok2 as (select * from pessoa2 where validos = com_ter),
--   pares as (select a.escala_id, a.turno, extract(epoch from a.fim - b.fim)/60.0 dif
--             from ok2 a join ok2 b on a.escala_id=b.escala_id and a.turno=b.turno and a.pos > b.pos),
--   t as (select escala_id, turno, count(*) pares, count(*) filter (where dif > 0) disc, count(*) filter (where dif > 30) disc30, count(*) filter (where dif > 60) disc60 from pares group by 1,2)
--   select count(*) turnos, sum(pares), round(100.0*sum(disc)/sum(pares),1), round(100.0*sum(disc30)/sum(pares),1), round(100.0*sum(disc60)/sum(pares),1),
--          round(avg(disc30),1), count(*) filter (where disc30 = 0) from t;

-- Q3f. Ocioso = liberação − fim da última cirurgia
--   ok as (select *, extract(epoch from lib_em - fim)/60.0 ocioso from pessoa where casos_validos > 0 and casos_com_ter = casos_validos)
--   select count(*) filter (where lib_em is not null),
--     percentile_cont(0.5) within group (order by ocioso) filter (where lib_em is not null), -- p25 e p75 idem
--     count(*) filter (where abs(ocioso) <= 2), count(*) filter (where abs(ocioso) <= 2 and fim_por = lib_por),
--     count(*) filter (where ocioso < -2), count(*) filter (where ocioso > 30), count(*) filter (where ocioso > 60) from ok;

-- =====================================================================================
-- Q3g. Teste do viés "término marcado na hora da liberação" (revisão 25/09): a fila só libera
-- na ordem, e muita "terminada" é marcada junto da liberação — o fim herdaria a ordem do rodapé.
-- Resultado: todos 0,60 (131) · fim a >15 min da liberação 0,48 (68) · fim marcado pelo próprio 0,80 (23).
-- =====================================================================================
with ev as (
  select e.* from escala_cirurgica_evento e
  where tipo='status' and status_de is distinct from status_para and hospital<>'fds'
    and data between '2026-07-22' and '2026-09-24' and em < '2026-09-25 03:00:00+00'),
cl_src as (select ev.*, case when em - lag(em) over (partition by por, status_para order by em) <= interval '60 seconds' then 0 else 1 end novo
  from ev where status_para in ('iniciada','terminada')),
cl as (select *, sum(novo) over (partition by por, status_para order by em rows unbounded preceding) cid from cl_src),
cl2 as (select *, count(*) over (partition by por, status_para, cid) tam from cl),
cur as (
  select c.id, e.id escala_id, e.data, e.hospital, c.turno, c.anestesista_user_id uid, c.status_extra, c.origem, c.hora,
    lower(btrim(c.sala)) sala_k, coalesce(btrim(c.hora),'') hora_k, upper(btrim(coalesce(c.cirurgiao,''))) cir_k, upper(btrim(coalesce(c.procedimento,''))) proc_k,
    count(*) over (partition by e.data, e.hospital, lower(btrim(c.sala)), coalesce(btrim(c.hora),''), upper(btrim(coalesce(c.cirurgiao,''))), upper(btrim(coalesce(c.procedimento,'')))) nk
  from escala_cirurgica_caso c join escala_cirurgica e on e.id=c.escala_id
  where e.hospital in ('unimed','hro') and e.data between '2026-07-22' and '2026-09-24'),
casos_ev as (select distinct on (caso_id) caso_id, data, hospital, lower(btrim(sala)) sala_k, coalesce(btrim(hora),'') hora_k,
    upper(btrim(coalesce(cirurgiao,''))) cir_k, upper(btrim(coalesce(procedimento,''))) proc_k, anestesista_user_id a0 from ev order by caso_id, em),
mapa as (select ce.caso_id, ce.a0, coalesce(c1.id, c2.id) cur_id from casos_ev ce
  left join cur c1 on c1.id = ce.caso_id
  left join cur c2 on c1.id is null and c2.nk = 1 and c2.data=ce.data and c2.hospital=ce.hospital and c2.sala_k=ce.sala_k
    and c2.hora_k=ce.hora_k and c2.cir_k=ce.cir_k and c2.proc_k=ce.proc_k),
ter_caso as (
  select m.cur_id, min(cl2.em) ter_em, (array_agg(cl2.tam order by cl2.em))[1] ter_tam, (array_agg(cl2.por order by cl2.em))[1] ter_por,
    bool_or(m.a0 is distinct from cu.uid) mudou_anest
  from mapa m join cl2 on cl2.caso_id = m.caso_id and cl2.status_para = 'terminada' join cur cu on cu.id = m.cur_id
  where m.cur_id is not null group by m.cur_id),
o as (
  select e.id escala_id, e.data, e.hospital, t.turno, e.liberacoes, x.nome, (x.idx - 1)::int pos, jsonb_array_length(t.arr) n_ordem
  from escala_cirurgica e
  cross join lateral (select 'matutino' turno, case when jsonb_typeof(e.ordem_liberacao)='array' then e.ordem_liberacao else e.ordem_liberacao->'matutino' end arr
                      union all select 'vespertino', case when jsonb_typeof(e.ordem_liberacao)='object' then e.ordem_liberacao->'vespertino' end) t
  cross join lateral jsonb_array_elements_text(case when jsonb_typeof(t.arr)='array' then t.arr else '[]'::jsonb end) with ordinality x(nome, idx)
  where e.hospital in ('unimed','hro') and e.data between '2026-07-22' and '2026-09-24' and extract(isodow from e.data) between 1 and 5),
al as (select distinct on (upper(public.unaccent(btrim(apelido)))) upper(public.unaccent(btrim(apelido))) ap, user_id from escala_anestesista_alias),
pos as (select distinct on (o.escala_id, o.turno, al.user_id) o.*, al.user_id uid
  from o join al on al.ap = btrim(regexp_replace(upper(public.unaccent(regexp_replace(o.nome, '\(.*?\)|\(.*$', '', 'g'))), '\s+', ' ', 'g'))
  order by o.escala_id, o.turno, al.user_id, o.pos),
pessoa as (
  select p.escala_id, p.data, p.hospital, p.turno, p.pos, p.n_ordem, p.uid, (p.n_ordem - 1 - p.pos) ordem_saida,
    count(c.id) filter (where coalesce(c.status_extra,'') <> 'suspensa') casos_validos,
    count(tc.cur_id) filter (where coalesce(c.status_extra,'') <> 'suspensa') casos_com_ter,
    max(tc.ter_em) fim, (array_agg(tc.ter_tam order by tc.ter_em desc nulls last))[1] fim_tam,
    (array_agg(tc.ter_por order by tc.ter_em desc nulls last))[1] fim_por,
    max(case when c.hora ~ '^\d{1,2}:\d{2}$' then c.hora::time end) ultima_hora_marcada,
    ((p.liberacoes -> (p.turno || ':' || p.uid)) ->> 'liberadoEm')::timestamptz lib_em,
    ((p.liberacoes -> (p.turno || ':' || p.uid)) ->> 'por') lib_por
  from pos p left join cur c on c.escala_id = p.escala_id and c.turno = p.turno and c.uid = p.uid
  left join ter_caso tc on tc.cur_id = c.id
  group by 1,2,3,4,5,6,7,p.liberacoes),
ok as (select * from pessoa where casos_validos > 0 and casos_com_ter = casos_validos),
vars as (
  select 'todos' v, * from ok
  union all select 'fim_longe_da_liberacao_15min', * from ok where lib_em is not null and abs(extract(epoch from (lib_em - fim))) > 900
  union all select 'fim_marcado_pelo_proprio', * from ok where fim_por = uid
  union all select 'fim_longe_lib_e_sem_lote', * from ok where fim_tam < 3 and lib_em is not null and abs(extract(epoch from (lib_em - fim))) > 900),
rk as (select v, escala_id, turno, hospital,
    rank() over w1 + (count(*) over (partition by v, escala_id, turno, ordem_saida) - 1) / 2.0 r_saida,
    rank() over w2 + (count(*) over (partition by v, escala_id, turno, fim) - 1) / 2.0 r_fim
  from vars window w1 as (partition by v, escala_id, turno order by ordem_saida), w2 as (partition by v, escala_id, turno order by fim)),
rho as (select v, escala_id, turno, hospital, count(*) n, corr(r_saida, r_fim) rho from rk group by 1,2,3,4 having count(*) >= 4)
select v, count(*) turnos_n4, round(avg(n),1) n_medio,
  round(percentile_cont(0.25) within group (order by rho)::numeric,2) p25, round(percentile_cont(0.5) within group (order by rho)::numeric,2) mediana,
  round(percentile_cont(0.75) within group (order by rho)::numeric,2) p75,
  count(*) filter (where rho > 0) positivos, count(*) filter (where rho < 0) negativos
from rho group by 1 order by 1;

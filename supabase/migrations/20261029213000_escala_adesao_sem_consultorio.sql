-- ============================================================================
-- Adesão à Escala — consultório não é cirurgia a marcar (dono 2026-10-29)
-- ============================================================================
-- Pedido do dono (29/10): "quem está no consultório e SRPA não contenha débitos de preenchimento
-- já que esses horários são fixos. SRPA 09:00 às 13:00, 13:00 às 19:00 e 19:00–22:00, consultório
-- 07:45 às 11:30 e 13:30 às 17:00".
--
-- Revisão em produção (29/10, só SELECT): a caixa "Cirurgias sem horário", o pop-up, o "Seu
-- preenchimento", o relatório de horário e a trava da liberação já deixavam os dois de fora — o
-- consultório pelo procedimento (`!~* 'consult'`, 20261016150000) e a SRPA porque a linha dela não
-- tem procedimento (41 linhas em outubro, todas sem). Faltava o RELATÓRIO DE ADESÃO: ele contava o
-- consultório como cirurgia (início, término e tempo da cirurgia marcados pela própria pessoa) e o
-- turno só de consultório como turno que pede tempo total — 49 casos e 47 turnos de 22 pessoas em
-- 30 dias. Desde a v5.12.88/89 (29/10) o consultório nem abre opções: esses números só caíam.
--
-- Mudança: o MESMO corte da conta do horário (`escala_horario_conta`) nos casos do relatório ao vivo
-- (`escala_adesao_relatorio`) e do histórico diário (`escala_adesao_gravar_dia`, por pessoa e por
-- hospital) — uma linha em cada um dos três lugares, nada mais. Os dias até 30 atrás são regravados
-- pelo caminho do cron (recalculados com os dados de hoje, como o cron faz com os últimos 7). Os
-- congelados (mais de 30 dias) ficam como foram gravados, como nas mudanças de 24/09: o consultório
-- como caso existe desde 22/07, e de 22/07 a 28/09 são 109 casos (~2% dos casos do período) que as abas
-- de julho a setembro seguem contando. Dias na escala ("abre a escala") não mudam: em 30 dias nenhum
-- dia de ninguém contava só por consultório ou SRPA (a pessoa está no rodapé ou tem outra cirurgia).
-- Nenhum procedimento com "consult" é cirurgia: todos estão na sala Consultório (conferido em 29/10).
--
-- Base: as definições VIVAS de 20260924180000 (md5 do corpo conferido contra produção em 29/10).
-- Rollback: scripts/rollback-20261029213000-adesao-sem-consultorio.sql (as definições de
-- 20260924180000 e os mesmos 30 dias regravados).
-- Idempotente.

begin;
-- teto: a Management API devolve 524 depois de ~100 s e a transação podia seguir sozinha (20260916170000)
set local lock_timeout = '3s';
set local statement_timeout = '60s';

-- ── Relatório ao vivo ───────────────────────────────────────────────────────
create or replace function public.escala_adesao_relatorio(p_dias integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_dias integer := least(greatest(coalesce(p_dias, 30), 7), 90);
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_desde timestamptz := now() - make_interval(days => least(greatest(coalesce(p_dias, 30), 7), 90));
  v_ate date := public.escala_adesao_ultimo_dia();
  v_ini_dias timestamptz;
  v_result jsonb;
begin
  -- Qualquer usuário ATIVO logado (decisão do dono: todos veem tudo).
  if public.firebase_uid() is null
     or not exists (select 1 from public.profiles p where p.id = public.firebase_uid() and p.active) then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  -- começo do 1º dia da janela de DIAS (meia-noite de Brasília) — um pouco antes de v_desde
  v_ini_dias := ((v_ate - v_dias + 1)::timestamp at time zone 'America/Sao_Paulo');

  with u as (
    select p.id, p.nome, p.role,
      case when p.role in ('tec-enfermagem', 'enfermeiro') then 'enf'
           when p.role like 'func-%' then 'hosp'
           when p.role = 'anestesiologista' then 'anest'
           when p.role = 'medico-residente' then 'res'
           when p.role = 'secretaria' then 'sec' end as cargo
    from public.profiles p
    where p.active
      and coalesce(p.email, '') not like '%+e2e%'
      and p.conta_duplicada_de is null
      and p.id <> '567JGBfHyfQB9RG2jESJFQtwcQ23' -- Iara Grasel: fora da análise (dono 23/09)
      and (p.role in ('anestesiologista', 'tec-enfermagem', 'enfermeiro', 'medico-residente', 'secretaria')
           or p.role like 'func-%')
  ),
  pv as (
    select l.user_id, l.created_at, (l.created_at at time zone 'America/Sao_Paulo') as lt
    from public.user_activity_log l
    where l.event_type = 'page_view'
      and l.event_data->>'page' = 'escalaCirurgica'
      and l.created_at >= v_ini_dias
  ),
  vistos as (
    -- UMA varredura (não há índice por user_id no log): quem abriu a escala nos últimos 90 dias.
    -- O log tem retenção de 90 dias, então "nunca abriu" = "não abriu dentro da retenção".
    select distinct l.user_id as id
    from public.user_activity_log l
    where l.event_type = 'page_view' and l.event_data->>'page' = 'escalaCirurgica'
      and l.created_at >= now() - interval '90 days'
  ),
  pu as (
    -- campos ANTIGOS (dias corridos desde now()-p_dias): inalterados
    select pv.user_id as id,
      count(distinct pv.lt::date) filter (where pv.created_at >= v_desde and pv.lt >= (now() at time zone 'America/Sao_Paulo') - interval '7 days') as d7,
      count(distinct pv.lt::date) filter (where pv.created_at >= v_desde) as dn,
      count(*) filter (where pv.created_at >= v_desde) as aberturas
    from pv group by pv.user_id
  ),
  pdia as (
    select distinct pv.user_id, pv.lt::date as d from pv
    where pv.lt::date between v_ate - v_dias + 1 and v_ate
  ),
  esc as (select * from public.escala_adesao_escalados(v_ate - v_dias + 1, v_ate)),
  eu as (
    select esc.user_id as id,
      count(*) as de,
      count(*) filter (where esc.data > v_ate - 7) as de7,
      count(pdia.d) as dne,
      count(pdia.d) filter (where esc.data > v_ate - 7) as d7e
    from esc left join pdia on pdia.user_id = esc.user_id and pdia.d = esc.data
    group by esc.user_id
  ),
  uu as (
    -- dias ÚTEIS (seg–sex) em que abriu; feriado conta como dia útil (dono 24/09)
    select user_id as id,
      count(*) filter (where extract(isodow from d) <= 5) as dnu,
      count(*) filter (where extract(isodow from d) <= 5 and d > v_ate - 7) as d7u
    from pdia group by user_id
  ),
  ac as (
    select por as uid, tipo, status_para from public.escala_cirurgica_evento
      where por is not null and em >= v_desde
    union all select autor_user_id, 'recado', null from public.escala_cirurgica_aviso where criado_em >= v_desde
    union all select user_id, 'ciente', null from public.escala_cirurgica_aviso_confirmacao where confirmado_em >= v_desde
    union all select enviado_por, 'tempo', null from public.escala_cirurgica_aviso_tempo where enviado_em >= v_desde
  ),
  au as (
    select uid as id, count(*) as acoes,
      count(*) filter (where tipo = 'troca') as trocas,
      count(*) filter (where tipo = 'status' and status_para = 'iniciada') as ini_n,
      count(*) filter (where tipo = 'status' and status_para = 'terminada') as ter_n
    from ac group by uid
  ),
  casos as (
    select c.id, c.escala_id, c.turno, e.hospital, c.anestesista_user_id as uid,
           c.status_cirurgia as st, c.termino_previsto as tp,
           e.linha_overrides -> (c.turno || ':' || c.anestesista_user_id) as ov
    from public.escala_cirurgica_caso c
    join public.escala_cirurgica e on e.id = c.escala_id
    where e.status = 'publicada'
      and e.data between v_ate - v_dias + 1 and v_ate
      and not c.sem_anestesista
      and coalesce(c.procedimento, '') <> ''
      and coalesce(c.procedimento, '') !~* 'consult'  -- consultório: horário fixo (dono 16/10 e 29/10)
      and c.status_extra is null
      and c.anestesista_user_id is not null
  ),
  evc as (
    select ev.caso_id,
      bool_or(ev.status_para = 'iniciada') as ini_qq,
      bool_or(ev.status_para = 'iniciada' and ev.por = k.uid) as ini_eu,
      bool_or(ev.status_para = 'terminada' and ev.por = k.uid) as ter_eu
    from public.escala_cirurgica_evento ev
    join casos k on k.id = ev.caso_id
    where ev.tipo = 'status'
    group by ev.caso_id
  ),
  kc as (
    select k.*, coalesce(evc.ini_qq, false) as ini_qq, coalesce(evc.ini_eu, false) as ini_eu, coalesce(evc.ter_eu, false) as ter_eu
    from casos k left join evc on evc.caso_id = k.id
  ),
  cu as (
    select uid as id, count(*) as casos,
      count(*) filter (where ini_eu) as ini_eu,
      count(*) filter (where ter_eu) as ter_eu,
      -- "marcada por qualquer um": as MESMAS regras do quadro por hospital
      count(*) filter (where ini_qq) as ini_qq,
      count(*) filter (where st = 'terminada') as ter_qq,
      count(*) filter (where coalesce(tp, '') <> '') as tp_inf
    from kc group by uid
  ),
  turnos as (select distinct escala_id, turno, uid, hospital, ov from casos),
  tu as (
    select uid as id, count(*) as turnos,
      count(*) filter (where coalesce(ov->>'termino', '') <> '' and ov->>'por' = uid) as tot_eu
    from turnos group by uid
  ),
  -- quem PREENCHEU (qualquer cargo, qualquer linha): tempo da cirurgia pelo autor gravado no
  -- caso (desde 24/09), tempo total pelo `por` do override
  tpn as (
    select c.termino_previsto_por as id, count(*) as n
    from public.escala_cirurgica_caso c
    join public.escala_cirurgica e on e.id = c.escala_id
    where e.status = 'publicada' and e.data between v_ate - v_dias + 1 and v_ate
      and coalesce(c.termino_previsto, '') <> '' and c.termino_previsto_por is not null
    group by 1
  ),
  totn as (
    select o.value->>'por' as id, count(*) as n
    from public.escala_cirurgica e
    cross join lateral jsonb_each(case when jsonb_typeof(e.linha_overrides) = 'object' then e.linha_overrides else '{}'::jsonb end) o
    where e.status = 'publicada' and e.data between v_ate - v_dias + 1 and v_ate
      and jsonb_typeof(o.value) = 'object' and coalesce(o.value->>'termino', '') <> '' and o.value->>'por' is not null
    group by 1
  ),
  pessoas as (
    select jsonb_agg(jsonb_build_object(
      'cargo', u.cargo, 'role', u.role, 'nome', u.nome,
      'd7', coalesce(pu.d7, 0), 'dn', coalesce(pu.dn, 0), 'aberturas', coalesce(pu.aberturas, 0),
      'de', coalesce(eu.de, 0), 'de7', coalesce(eu.de7, 0), 'dne', coalesce(eu.dne, 0), 'd7e', coalesce(eu.d7e, 0),
      'dnu', coalesce(uu.dnu, 0), 'd7u', coalesce(uu.d7u, 0),
      'acoes', coalesce(au.acoes, 0), 'trocas', coalesce(au.trocas, 0),
      'ini_n', coalesce(au.ini_n, 0), 'ter_n', coalesce(au.ter_n, 0),
      'casos', coalesce(cu.casos, 0), 'ini_eu', coalesce(cu.ini_eu, 0), 'ter_eu', coalesce(cu.ter_eu, 0),
      'ini_qq', coalesce(cu.ini_qq, 0), 'ter_qq', coalesce(cu.ter_qq, 0),
      'tp_inf', coalesce(cu.tp_inf, 0), 'turnos', coalesce(tu.turnos, 0), 'tot_eu', coalesce(tu.tot_eu, 0),
      'tp_n', coalesce(tpn.n, 0), 'tot_n', coalesce(totn.n, 0),
      'nunca', vistos.id is null
    ) order by u.cargo, u.nome) as j
    from u
    left join pu on pu.id = u.id
    left join eu on eu.id = u.id
    left join uu on uu.id = u.id
    left join au on au.id = u.id
    left join cu on cu.id = u.id
    left join tu on tu.id = u.id
    left join tpn on tpn.id = u.id
    left join totn on totn.id = u.id
    left join vistos on vistos.id = u.id
  ),
  hosp as (
    select jsonb_agg(jsonb_build_object(
      'hospital', h.hospital, 'casos', h.casos, 'com_ini', h.com_ini, 'com_ter', h.com_ter,
      'com_tp', h.com_tp, 'turnos', t.turnos, 'com_total', t.com_total)) as j
    from (
      select coalesce(hospital, 'total') as hospital, count(*) as casos,
        count(*) filter (where ini_qq) as com_ini,
        count(*) filter (where st = 'terminada') as com_ter,
        count(*) filter (where coalesce(tp, '') <> '') as com_tp
      from kc group by rollup(hospital)
    ) h
    join (
      select coalesce(hospital, 'total') as hospital, count(*) as turnos,
        count(*) filter (where coalesce(ov->>'termino', '') <> '') as com_total
      from turnos group by rollup(hospital)
    ) t using (hospital)
  )
  select jsonb_build_object(
    'dias', v_dias,
    'desde', v_ate - v_dias + 1,
    'ate', v_ate,
    'uteis', (select count(*) from generate_series(v_ate - v_dias + 1, v_ate, interval '1 day') g where extract(isodow from g) <= 5),
    'uteis7', (select count(*) from generate_series(v_ate - 6, v_ate, interval '1 day') g where extract(isodow from g) <= 5),
    'gerado_em', now(),
    'pessoas', coalesce((select j from pessoas), '[]'::jsonb),
    'hospitais', coalesce((select j from hosp), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$;

comment on function public.escala_adesao_relatorio(integer) is
  'Relatório de adesão à Escala Cirúrgica (30/60 dias): agregados por pessoa e por hospital. Uso do anestesista medido nos dias em que estava na escala (dono 2026-09-24). Qualquer usuário ativo lê tudo (dono 2026-09-23). Não expõe e-mail nem linhas cruas do log.';

revoke execute on function public.escala_adesao_relatorio(integer) from public, anon;
grant execute on function public.escala_adesao_relatorio(integer) to authenticated, service_role;

-- ── Histórico diário (por pessoa e por hospital) ─────────────────────────────
create or replace function public.escala_adesao_gravar_dia(p_data date)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_ini timestamptz := (p_data::timestamp at time zone 'America/Sao_Paulo');
  v_fim timestamptz := ((p_data + 1)::timestamp at time zone 'America/Sao_Paulo');
begin
  -- Dia com mais de 30 dias que JÁ foi gravado fica congelado (ver 20260923160000).
  if p_data < (now() at time zone 'America/Sao_Paulo')::date - 30
     and (exists (select 1 from public.escala_adesao_dia where data = p_data)
          or exists (select 1 from public.escala_adesao_hospital_dia where data = p_data)) then
    raise exception 'dia % já gravado e congelado (mais de 30 dias)', p_data using errcode = '22023';
  end if;

  delete from public.escala_adesao_dia where data = p_data;
  delete from public.escala_adesao_hospital_dia where data = p_data;

  with pv as (
    select l.user_id as id, count(*) as aberturas
    from public.user_activity_log l
    where l.event_type = 'page_view' and l.event_data->>'page' = 'escalaCirurgica'
      and l.created_at >= v_ini and l.created_at < v_fim
    group by l.user_id
  ),
  ac as (
    select por as uid, tipo, status_para from public.escala_cirurgica_evento
      where por is not null and em >= v_ini and em < v_fim
    union all select autor_user_id, 'recado', null from public.escala_cirurgica_aviso where criado_em >= v_ini and criado_em < v_fim
    union all select user_id, 'ciente', null from public.escala_cirurgica_aviso_confirmacao where confirmado_em >= v_ini and confirmado_em < v_fim
    union all select enviado_por, 'tempo', null from public.escala_cirurgica_aviso_tempo where enviado_em >= v_ini and enviado_em < v_fim
  ),
  au as (
    select uid as id, count(*) as acoes,
      count(*) filter (where tipo = 'troca') as trocas,
      count(*) filter (where tipo = 'status' and status_para = 'iniciada') as ini_n,
      count(*) filter (where tipo = 'status' and status_para = 'terminada') as ter_n
    from ac group by uid
  ),
  casos as (
    select c.id, c.escala_id, c.turno, e.hospital, c.anestesista_user_id as uid,
           c.status_cirurgia as st, c.termino_previsto as tp,
           e.linha_overrides -> (c.turno || ':' || c.anestesista_user_id) as ov
    from public.escala_cirurgica_caso c
    join public.escala_cirurgica e on e.id = c.escala_id
    where e.status = 'publicada' and e.data = p_data
      and not c.sem_anestesista
      and coalesce(c.procedimento, '') <> ''
      and coalesce(c.procedimento, '') !~* 'consult'  -- consultório: horário fixo (dono 16/10 e 29/10)
      and c.status_extra is null
      and c.anestesista_user_id is not null
  ),
  evc as (
    select ev.caso_id,
      bool_or(ev.status_para = 'iniciada') as ini_qq,
      bool_or(ev.status_para = 'iniciada' and ev.por = k.uid) as ini_eu,
      bool_or(ev.status_para = 'terminada' and ev.por = k.uid) as ter_eu
    from public.escala_cirurgica_evento ev
    join casos k on k.id = ev.caso_id
    where ev.tipo = 'status'
    group by ev.caso_id
  ),
  kc as (
    select k.*, coalesce(evc.ini_qq, false) as ini_qq, coalesce(evc.ini_eu, false) as ini_eu, coalesce(evc.ter_eu, false) as ter_eu
    from casos k left join evc on evc.caso_id = k.id
  ),
  cu as (
    select uid as id, count(*) as casos,
      count(*) filter (where ini_eu) as ini_eu,
      count(*) filter (where ter_eu) as ter_eu,
      count(*) filter (where ini_qq) as ini_qq,
      count(*) filter (where st = 'terminada') as ter_qq,
      count(*) filter (where coalesce(tp, '') <> '') as tp_inf
    from kc group by uid
  ),
  turnos as (select distinct escala_id, turno, uid, hospital, ov from casos),
  tu as (
    select uid as id, count(*) as turnos,
      count(*) filter (where coalesce(ov->>'termino', '') <> '' and ov->>'por' = uid) as tot_eu
    from turnos group by uid
  ),
  esc as (select distinct user_id as id from public.escala_adesao_escalados(p_data, p_data)),
  tpn as (
    select c.termino_previsto_por as id, count(*) as n
    from public.escala_cirurgica_caso c
    join public.escala_cirurgica e on e.id = c.escala_id
    where e.status = 'publicada' and e.data = p_data
      and coalesce(c.termino_previsto, '') <> '' and c.termino_previsto_por is not null
    group by 1
  ),
  totn as (
    select o.value->>'por' as id, count(*) as n
    from public.escala_cirurgica e
    cross join lateral jsonb_each(case when jsonb_typeof(e.linha_overrides) = 'object' then e.linha_overrides else '{}'::jsonb end) o
    where e.status = 'publicada' and e.data = p_data
      and jsonb_typeof(o.value) = 'object' and coalesce(o.value->>'termino', '') <> '' and o.value->>'por' is not null
    group by 1
  ),
  ids as (select id from pv union select id from au union select id from cu union select id from esc
          union select id from tpn union select id from totn)
  insert into public.escala_adesao_dia
    (data, user_id, aberturas, acoes, trocas, ini_n, ter_n, casos, ini_eu, ter_eu, tp_inf, turnos, tot_eu,
     escalado, ini_qq, ter_qq, tp_n, tot_n)
  select p_data, ids.id,
    coalesce(pv.aberturas, 0), coalesce(au.acoes, 0), coalesce(au.trocas, 0),
    coalesce(au.ini_n, 0), coalesce(au.ter_n, 0),
    coalesce(cu.casos, 0), coalesce(cu.ini_eu, 0), coalesce(cu.ter_eu, 0), coalesce(cu.tp_inf, 0),
    coalesce(tu.turnos, 0), coalesce(tu.tot_eu, 0),
    esc.id is not null, coalesce(cu.ini_qq, 0), coalesce(cu.ter_qq, 0),
    coalesce(tpn.n, 0), coalesce(totn.n, 0)
  from ids
  left join pv on pv.id = ids.id
  left join au on au.id = ids.id
  left join cu on cu.id = ids.id
  left join tu on tu.id = ids.id
  left join esc on esc.id = ids.id
  left join tpn on tpn.id = ids.id
  left join totn on totn.id = ids.id
  where ids.id is not null;

  with casos as (
    select c.id, c.escala_id, c.turno, e.hospital, c.anestesista_user_id as uid,
           c.status_cirurgia as st, c.termino_previsto as tp,
           e.linha_overrides -> (c.turno || ':' || c.anestesista_user_id) ->> 'termino' as tt
    from public.escala_cirurgica_caso c
    join public.escala_cirurgica e on e.id = c.escala_id
    where e.status = 'publicada' and e.data = p_data
      and not c.sem_anestesista
      and coalesce(c.procedimento, '') <> ''
      and coalesce(c.procedimento, '') !~* 'consult'  -- consultório: horário fixo (dono 16/10 e 29/10)
      and c.status_extra is null
      and c.anestesista_user_id is not null
  ),
  ini as (
    select distinct ev.caso_id from public.escala_cirurgica_evento ev
    join casos k on k.id = ev.caso_id
    where ev.tipo = 'status' and ev.status_para = 'iniciada'
  ),
  h as (
    select hospital, count(*) as casos,
      count(*) filter (where id in (select caso_id from ini)) as com_ini,
      count(*) filter (where st = 'terminada') as com_ter,
      count(*) filter (where coalesce(tp, '') <> '') as com_tp
    from casos group by hospital
  ),
  t as (
    select hospital, count(*) as turnos, count(*) filter (where coalesce(tt, '') <> '') as com_total
    from (select distinct hospital, escala_id, turno, uid, tt from casos) x group by hospital
  )
  insert into public.escala_adesao_hospital_dia (data, hospital, casos, com_ini, com_ter, com_tp, turnos, com_total)
  select p_data, h.hospital, h.casos, h.com_ini, h.com_ter, h.com_tp, coalesce(t.turnos, 0), coalesce(t.com_total, 0)
  from h left join t using (hospital);
end;
$function$;

revoke execute on function public.escala_adesao_gravar_dia(date) from public, anon, authenticated;
grant execute on function public.escala_adesao_gravar_dia(date) to service_role;

-- ── Os 30 dias que o cron ainda regrava, já com o corte ──────────────────────
do $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_min date := (select min(data) from public.escala_adesao_dia);
  d date;
begin
  if v_min is null then return; end if;
  for d in select g::date from generate_series(greatest(v_min, v_hoje - 30), v_hoje - 1, interval '1 day') g loop
    perform public.escala_adesao_gravar_dia(d);
  end loop;
end $$;

commit;

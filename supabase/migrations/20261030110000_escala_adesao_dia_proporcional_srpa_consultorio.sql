-- ============================================================================
-- Adesão à Escala — o turno de SRPA ou consultório não conta: o dia vale a fração (dono 2026-10-29/30)
-- ============================================================================
-- Pedidos do dono. 29/10: "nos turnos em que o colega estiver escalado na srpa e/ou consultório esse
-- dia não conta? [...] pode ser descontado desde que o usuário não volte a fazer outros procedimentos
-- (o que é uma possibilidade, já que ele pode estar escalado no consultório e voltar ao hospital, ou
-- estar em um turno na SRPA e no seguinte estar escalado em uma cirurgia)". 30/10: "quero que revise
-- para que nesses casos de SRPA e/ou consultório sejam contados os turnos de forma proporcional para
-- contagem de 'dia de escala'".
--
-- "Dias na escala" é a base da coluna "abre a escala" (em quantos dias trabalhados a pessoa abriu o
-- app). Até aqui o dia contava inteiro pela linha da SRPA ou do consultório no nome dela, e também pelo
-- nome no rodapé daquele turno. Regra nova, POR TURNO:
--   • o turno é de horário fixo quando, num hospital, todas as linhas da pessoa são de consultório
--     (procedimento com "consult", ou a posição sem procedimento na sala/bloco Consultório) ou da SRPA,
--     ou quando o nome dela no rodapé vem anotado "(CONSULT…)";
--   • o dia vale a fração dos turnos dela na escala que não foram de horário fixo: SRPA de manhã e
--     cirurgia ou fila à tarde = meio dia; o dia só de horário fixo não entra;
--   • "abriu a escala" usa o mesmo peso: abrir num meio dia conta meio dia (a porcentagem nunca passa
--     de 100% e o turno fixo some dos dois lados);
--   • o resto é o de 24/09: fila sem cirurgia conta, a fila 'fds' não conta sozinha.
-- O histórico guarda a fração em `escala_adesao_dia.escalado_peso` (nula = dia inteiro, como foi gravado
-- antes desta regra) e `escala_adesao_periodo` (abas de mês) soma a fração.
-- Medido em produção (30/09–29/10, só SELECT): 870 dias na escala viram 831 — saem 12 dias só de
-- SRPA/consultório e 54 dias, de 25 pessoas, viram meio dia (6 deles pelo rodapé "(CONSULT)"). Entre os
-- anestesistas, "abre a escala" muda para 22 (no máximo 6,2 pontos); ninguém cruza 40% nem 70%.
--
-- Os dias até 30 atrás são regravados; os congelados ficam como foram gravados, como em 20261029213000
-- (escolha do dono). Base: as definições VIVAS de 20260924160000 (escalados), 20261029213000 (relatório e
-- gravação do dia) e 20260924180000 (período) — md5 dos corpos conferido contra produção em 30/10.
-- Rollback: scripts/rollback-20261030110000-adesao-dia-proporcional.sql. Idempotente.

begin;
-- teto: a Management API devolve 524 depois de ~100 s e a transação podia seguir sozinha (20260916170000)
set local lock_timeout = '3s';
set local statement_timeout = '60s';

-- ── Histórico: a fração do dia ──────────────────────────────────────────────
alter table public.escala_adesao_dia
  add column if not exists escalado_peso numeric(3,2) check (escalado_peso > 0 and escalado_peso <= 1);
comment on column public.escala_adesao_dia.escalado_peso is
  'Fração do dia na escala (turnos que contam / turnos na escala; turno de SRPA ou consultório não conta — dono 2026-10-30). Nula com escalado = dia inteiro (gravado antes da regra).';

-- ── Dias na escala, com a fração de cada dia ────────────────────────────────
-- o retorno ganha `peso`: drop + create (create or replace não muda as colunas de saída); só o
-- relatório e a gravação do dia chamam esta função, e os dois são trocados abaixo
drop function if exists public.escala_adesao_escalados(date, date);
create function public.escala_adesao_escalados(p_desde date, p_ate date)
returns table (data date, user_id text, peso numeric)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  with casos as (
    -- quem está no nome de cada linha publicada, por hospital e turno; `fixo` = horário fixo
    select e.data, e.hospital, c.turno, c.anestesista_user_id as uid,
           (coalesce(c.procedimento, '') ~* 'consult'
            or (btrim(coalesce(c.procedimento, '')) = ''
                and (coalesce(c.bloco, '') in ('srpa', 'consultorio')
                     or coalesce(c.sala, '') ~* '\mSRPA\M'
                     or coalesce(c.sala, '') ~* 'consult'))) as fixo
    from public.escala_cirurgica_caso c
    join public.escala_cirurgica e on e.id = c.escala_id
    where e.status = 'publicada' and e.data between p_desde and p_ate
      and c.anestesista_user_id is not null and not c.sem_anestesista
  ),
  rodape as (
    -- nome no rodapé de unimed/hro/materno, por turno ({matutino, vespertino} desde 20260804180000; a
    -- lista única de antes fica sem turno); anotado "(CONSULT)", "(CONSULT.)", "(CONSULTORIO)",
    -- "(CONSULT DOR)" = no consultório naquele turno
    select e.data, e.hospital, r.turno, a.user_id as uid, r.n ~* '\(\s*consult' as fixo
    from public.escala_cirurgica e
    cross join lateral (
      select case when jsonb_typeof(e.ordem_liberacao) = 'array' then null else 'matutino' end as turno, x.n
      from jsonb_array_elements_text(case when jsonb_typeof(e.ordem_liberacao) = 'array' then e.ordem_liberacao
                                          when jsonb_typeof(e.ordem_liberacao -> 'matutino') = 'array'
                                          then e.ordem_liberacao -> 'matutino' else '[]'::jsonb end) as x(n)
      union all
      select 'vespertino', y.n
      from jsonb_array_elements_text(case when jsonb_typeof(e.ordem_liberacao -> 'vespertino') = 'array'
                                          then e.ordem_liberacao -> 'vespertino' else '[]'::jsonb end) as y(n)
    ) r
    join public.escala_anestesista_alias a
      on translate(upper(trim(a.apelido)), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC')
       = translate(upper(trim(regexp_replace(r.n, '\s*\(.*$', ''))), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC')
    where e.status = 'publicada' and e.data between p_desde and p_ate
      and e.hospital <> 'fds'                 -- fila do FDS não conta sozinha
      and jsonb_typeof(e.ordem_liberacao) in ('object', 'array')
  ),
  postos as (
    -- cada hospital e turno da pessoa: conta com cirurgia no nome, ou com o nome na fila sem linha de
    -- horário fixo; só a linha da SRPA/consultório ou o rodapé "(CONSULT…)" = turno de horário fixo
    select x.data, x.hospital, x.turno, x.uid,
           bool_or(x.caso and not x.fixo)
             or (bool_or(not x.caso and not x.fixo) and not bool_or(x.caso and x.fixo)) as conta
    from (select k.data, k.hospital, k.turno, k.uid, k.fixo, true as caso from casos k
          union all
          select r.data, r.hospital, r.turno, r.uid, r.fixo, false from rodape r) x
    where x.uid is not null
    group by x.data, x.hospital, x.turno, x.uid
  ),
  turnos as (
    select t.data, t.uid, t.turno, bool_or(t.conta) as conta
    from postos t
    group by t.data, t.uid, t.turno
  )
  -- o dia vale a fração dos turnos da pessoa na escala que não foram de horário fixo (SRPA de manhã e
  -- cirurgia ou fila à tarde = meio dia); o dia só de horário fixo não entra
  select t.data, t.uid, round(count(*) filter (where t.conta)::numeric / count(*), 2)
  from turnos t
  group by t.data, t.uid
  having bool_or(t.conta)
$function$;

revoke execute on function public.escala_adesao_escalados(date, date) from public, anon, authenticated;
grant execute on function public.escala_adesao_escalados(date, date) to service_role;

-- ── Relatório ao vivo (definição de 20261029213000; muda só o bloco `eu`) ────
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
    -- cada dia vale a fração `peso` (o turno de SRPA/consultório não conta, dono 30/10), também
    -- para "abriu": abrir num meio dia conta meio dia
    select esc.user_id as id,
      sum(esc.peso) as de,
      coalesce(sum(esc.peso) filter (where esc.data > v_ate - 7), 0) as de7,
      coalesce(sum(esc.peso) filter (where pdia.d is not null), 0) as dne,
      coalesce(sum(esc.peso) filter (where pdia.d is not null and esc.data > v_ate - 7), 0) as d7e
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

-- ── Gravação do dia (definição de 20261029213000; grava `escalado_peso`) ─────
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
  esc as (select user_id as id, peso from public.escala_adesao_escalados(p_data, p_data)),
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
     escalado, escalado_peso, ini_qq, ter_qq, tp_n, tot_n)
  select p_data, ids.id,
    coalesce(pv.aberturas, 0), coalesce(au.acoes, 0), coalesce(au.trocas, 0),
    coalesce(au.ini_n, 0), coalesce(au.ter_n, 0),
    coalesce(cu.casos, 0), coalesce(cu.ini_eu, 0), coalesce(cu.ter_eu, 0), coalesce(cu.tp_inf, 0),
    coalesce(tu.turnos, 0), coalesce(tu.tot_eu, 0),
    esc.id is not null, esc.peso, coalesce(cu.ini_qq, 0), coalesce(cu.ter_qq, 0),
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

-- ── Período, abas de mês (definição de 20260924180000; muda só o bloco `d`) ──
create or replace function public.escala_adesao_periodo(p_desde date, p_ate date)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_result jsonb;
begin
  if public.firebase_uid() is null
     or not exists (select 1 from public.profiles p where p.id = public.firebase_uid() and p.active) then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  if p_desde is null or p_ate is null or p_ate < p_desde or p_ate - p_desde > 92 then
    raise exception 'período inválido' using errcode = '22023';
  end if;

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
  d as (
    select user_id as id,
      count(*) filter (where aberturas > 0) as dn,
      count(*) filter (where aberturas > 0 and data > p_ate - 7) as d7,
      -- o dia na escala vale a fração gravada (dono 30/10); sem fração = gravado antes = dia inteiro
      coalesce(sum(coalesce(escalado_peso, 1)) filter (where escalado), 0) as de,
      coalesce(sum(coalesce(escalado_peso, 1)) filter (where escalado and data > p_ate - 7), 0) as de7,
      coalesce(sum(coalesce(escalado_peso, 1)) filter (where escalado and aberturas > 0), 0) as dne,
      coalesce(sum(coalesce(escalado_peso, 1)) filter (where escalado and aberturas > 0 and data > p_ate - 7), 0) as d7e,
      count(*) filter (where aberturas > 0 and extract(isodow from data) <= 5) as dnu,
      count(*) filter (where aberturas > 0 and extract(isodow from data) <= 5 and data > p_ate - 7) as d7u,
      sum(aberturas) as aberturas, sum(acoes) as acoes, sum(trocas) as trocas,
      sum(ini_n) as ini_n, sum(ter_n) as ter_n, sum(casos) as casos,
      sum(ini_eu) as ini_eu, sum(ter_eu) as ter_eu, sum(ini_qq) as ini_qq, sum(ter_qq) as ter_qq,
      sum(tp_inf) as tp_inf, sum(turnos) as turnos, sum(tot_eu) as tot_eu,
      sum(tp_n) as tp_n, sum(tot_n) as tot_n
    from public.escala_adesao_dia
    where data between p_desde and p_ate
    group by user_id
  ),
  vistos as (
    select distinct user_id as id from public.escala_adesao_dia where aberturas > 0 and data <= p_ate
  ),
  pessoas as (
    select jsonb_agg(jsonb_build_object(
      'cargo', u.cargo, 'role', u.role, 'nome', u.nome,
      'd7', coalesce(d.d7, 0), 'dn', coalesce(d.dn, 0), 'aberturas', coalesce(d.aberturas, 0),
      'de', coalesce(d.de, 0), 'de7', coalesce(d.de7, 0), 'dne', coalesce(d.dne, 0), 'd7e', coalesce(d.d7e, 0),
      'dnu', coalesce(d.dnu, 0), 'd7u', coalesce(d.d7u, 0),
      'acoes', coalesce(d.acoes, 0), 'trocas', coalesce(d.trocas, 0),
      'ini_n', coalesce(d.ini_n, 0), 'ter_n', coalesce(d.ter_n, 0),
      'casos', coalesce(d.casos, 0), 'ini_eu', coalesce(d.ini_eu, 0), 'ter_eu', coalesce(d.ter_eu, 0),
      'ini_qq', coalesce(d.ini_qq, 0), 'ter_qq', coalesce(d.ter_qq, 0),
      'tp_inf', coalesce(d.tp_inf, 0), 'turnos', coalesce(d.turnos, 0), 'tot_eu', coalesce(d.tot_eu, 0),
      'tp_n', coalesce(d.tp_n, 0), 'tot_n', coalesce(d.tot_n, 0),
      'nunca', vistos.id is null
    ) order by u.cargo, u.nome) as j
    from u left join d on d.id = u.id left join vistos on vistos.id = u.id
  ),
  hosp as (
    select jsonb_agg(jsonb_build_object(
      'hospital', hospital, 'casos', casos, 'com_ini', com_ini, 'com_ter', com_ter,
      'com_tp', com_tp, 'turnos', turnos, 'com_total', com_total)) as j
    from (
      select coalesce(hospital, 'total') as hospital,
        sum(casos) as casos, sum(com_ini) as com_ini, sum(com_ter) as com_ter,
        sum(com_tp) as com_tp, sum(turnos) as turnos, sum(com_total) as com_total
      from public.escala_adesao_hospital_dia
      where data between p_desde and p_ate
      group by rollup(hospital)
    ) x
  )
  select jsonb_build_object(
    'desde', p_desde,
    'ate', p_ate,
    -- dias úteis só a partir do 1º dia gravado (julho/26 começa em 22/07)
    'uteis', (select count(*) from generate_series(greatest(p_desde, coalesce((select min(data) from public.escala_adesao_hospital_dia), p_desde)), p_ate, interval '1 day') g where extract(isodow from g) <= 5),
    'uteis7', (select count(*) from generate_series(greatest(p_desde, p_ate - 6), p_ate, interval '1 day') g where extract(isodow from g) <= 5),
    'gravado_ate', (select max(data) from public.escala_adesao_hospital_dia),
    'pessoas', coalesce((select j from pessoas), '[]'::jsonb),
    'hospitais', coalesce((select j from hosp), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$function$;

revoke execute on function public.escala_adesao_periodo(date, date) from public, anon;
grant execute on function public.escala_adesao_periodo(date, date) to authenticated, service_role;

-- ── Os 30 dias que o cron ainda regrava, já com a fração ─────────
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

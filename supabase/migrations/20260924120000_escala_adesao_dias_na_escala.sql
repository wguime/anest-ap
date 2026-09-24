-- ============================================================================
-- Adesão à Escala — uso medido nos DIAS EM QUE A PESSOA ESTAVA NA ESCALA (dono 2026-09-24)
-- ============================================================================
-- Pedido do dono: "leve em consideração dias de férias, atestado, dias de consultório em que o
-- usuário não preenche escala cirúrgica" + "conte os dias de feriados". A medição de 24/09
-- mostrou a distorção: com a régua "15 dias em 30 corridos", quem estava de férias saía como
-- baixo uso (Matheus: 9 dias na escala, abriu em 7 → 78%) ao lado de quem trabalhou e não abriu
-- (Klisman: 21 dias na escala, abriu em 6 → 29%).
--
-- Decisões do dono (24/09, por pergunta):
--   • ANESTESISTAS: a base do uso = dias em que a pessoa estava NA ESCALA PUBLICADA — anestesista
--     de algum caso OU nome no rodapé (ordem de liberação, casado pelo dicionário de apelidos).
--     Férias, atestado, consultório, pós-plantão e meio período ficam fora sozinhos; feriado e
--     fim de semana entram quando a pessoa está escalada. Meta 70% (≈ os 15 dias de ~21 úteis).
--   • MARCAÇÃO: a meta passa a ser a cirurgia MARCADA, por qualquer pessoa (ini_qq/ter_qq); o
--     que a própria pessoa tocou continua ao lado (ini_eu/ter_eu). Em 30 dias, 963 de 2.471
--     cirurgias tiveram o término marcado só por OUTRA pessoa (551 por outro anestesista, 486
--     deles do mesmo turno; 340 pela técnica) — a régua antiga os contava como "não marca".
--   • DEMAIS CARGOS (enfermagem, residência, secretaria, contas dos hospitais): a escala deles
--     mora no Firestore, sem histórico — a base é DIAS ÚTEIS (seg–sex), com os FERIADOS contando
--     como dia de trabalho (pedido do dono). Férias/atestado deles = etapa 2.
--
-- Campos NOVOS (os antigos seguem iguais, para a tela atual não quebrar):
--   pessoa: de/de7 (dias na escala: janela/últimos 7), dne/d7e (desses, em quantos abriu),
--           dnu/d7u (dias úteis em que abriu), ini_qq/ter_qq (casos da pessoa marcados por
--           qualquer um)
--   topo:   uteis/uteis7 (dias seg–sex da janela / dos últimos 7)
-- Janela dos dias: de hoje-p_dias a ONTEM, a mesma dos casos.
--
-- escala_adesao_dia ganha `escalado`, `ini_qq`, `ter_qq`. Carga: dias até 30 atrás são
-- regravados inteiros; os mais velhos (congelados — o log de telas não os tem mais) recebem só
-- as colunas novas, calculadas das tabelas da escala, que não expiram.
--
-- Rollback: reaplicar 20260923140000 (relatorio) e 20260923160000 (gravar_dia/periodo); drop
-- function escala_adesao_escalados(date, date); alter table escala_adesao_dia drop column
-- escalado, drop column ini_qq, drop column ter_qq.
--
-- Idempotente.

alter table public.escala_adesao_dia add column if not exists escalado boolean not null default false;
alter table public.escala_adesao_dia add column if not exists ini_qq integer not null default 0;
alter table public.escala_adesao_dia add column if not exists ter_qq integer not null default 0;

-- ── Quem estava na escala em cada dia ───────────────────────────────────────
-- Caso publicado com anestesista (inclusive suspenso: a pessoa estava escalada) + nome do
-- rodapé de manhã ou de tarde, sem o parêntese ("ADRIANO (REUNIAO 10H30)") e sem acento
-- ("João Ricardo" × "JOAO RICARDO"). Todas as linhas: unimed, hro, materno e fds.
create or replace function public.escala_adesao_escalados(p_desde date, p_ate date)
returns table (data date, user_id text)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  select e.data, c.anestesista_user_id
  from public.escala_cirurgica_caso c
  join public.escala_cirurgica e on e.id = c.escala_id
  where e.status = 'publicada' and e.data between p_desde and p_ate
    and c.anestesista_user_id is not null and not c.sem_anestesista
  union
  select e.data, a.user_id
  from public.escala_cirurgica e
  cross join lateral (
    -- rodapé por turno ({matutino, vespertino}, desde 20260804180000) ou lista única (antes)
    select jsonb_array_elements_text(case when jsonb_typeof(e.ordem_liberacao) = 'array' then e.ordem_liberacao
                                          when jsonb_typeof(e.ordem_liberacao -> 'matutino') = 'array'
                                          then e.ordem_liberacao -> 'matutino' else '[]'::jsonb end)
    union all
    select jsonb_array_elements_text(case when jsonb_typeof(e.ordem_liberacao -> 'vespertino') = 'array'
                                          then e.ordem_liberacao -> 'vespertino' else '[]'::jsonb end)
  ) r(n)
  join public.escala_anestesista_alias a
    on translate(upper(trim(a.apelido)), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC')
     = translate(upper(trim(regexp_replace(r.n, '\s*\(.*$', ''))), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC')
  where e.status = 'publicada' and e.data between p_desde and p_ate
    and jsonb_typeof(e.ordem_liberacao) in ('object', 'array')
$function$;

revoke execute on function public.escala_adesao_escalados(date, date) from public, anon, authenticated;
grant execute on function public.escala_adesao_escalados(date, date) to service_role;

-- ── Relatório ao vivo (30/60 dias) ──────────────────────────────────────────
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
  v_ini_dias timestamptz;
  v_result jsonb;
begin
  -- Qualquer usuário ATIVO logado (decisão do dono: todos veem tudo).
  if public.firebase_uid() is null
     or not exists (select 1 from public.profiles p where p.id = public.firebase_uid() and p.active) then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  -- começo do 1º dia da janela de DIAS (hoje-p_dias, meia-noite de Brasília) — um pouco antes de v_desde
  v_ini_dias := ((v_hoje - v_dias)::timestamp at time zone 'America/Sao_Paulo');

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
    where pv.lt::date between v_hoje - v_dias and v_hoje - 1
  ),
  esc as (select * from public.escala_adesao_escalados(v_hoje - v_dias, v_hoje - 1)),
  eu as (
    select esc.user_id as id,
      count(*) as de,
      count(*) filter (where esc.data >= v_hoje - 7) as de7,
      count(pdia.d) as dne,
      count(pdia.d) filter (where esc.data >= v_hoje - 7) as d7e
    from esc left join pdia on pdia.user_id = esc.user_id and pdia.d = esc.data
    group by esc.user_id
  ),
  uu as (
    -- dias ÚTEIS (seg–sex) em que abriu; feriado conta como dia útil (dono 24/09)
    select user_id as id,
      count(*) filter (where extract(isodow from d) <= 5) as dnu,
      count(*) filter (where extract(isodow from d) <= 5 and d >= v_hoje - 7) as d7u
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
      and e.data between v_hoje - v_dias and v_hoje - 1
      and not c.sem_anestesista
      and coalesce(c.procedimento, '') <> ''
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
      'nunca', vistos.id is null
    ) order by u.cargo, u.nome) as j
    from u
    left join pu on pu.id = u.id
    left join eu on eu.id = u.id
    left join uu on uu.id = u.id
    left join au on au.id = u.id
    left join cu on cu.id = u.id
    left join tu on tu.id = u.id
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
    'desde', v_hoje - v_dias,
    'ate', v_hoje - 1,
    'uteis', (select count(*) from generate_series(v_hoje - v_dias, v_hoje - 1, interval '1 day') g where extract(isodow from g) <= 5),
    'uteis7', (select count(*) from generate_series(v_hoje - 7, v_hoje - 1, interval '1 day') g where extract(isodow from g) <= 5),
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

-- ── Gravar UM dia (cron) — agora com escalado e marcação por qualquer um ────
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
  ids as (select id from pv union select id from au union select id from cu union select id from esc)
  insert into public.escala_adesao_dia
    (data, user_id, aberturas, acoes, trocas, ini_n, ter_n, casos, ini_eu, ter_eu, tp_inf, turnos, tot_eu,
     escalado, ini_qq, ter_qq)
  select p_data, ids.id,
    coalesce(pv.aberturas, 0), coalesce(au.acoes, 0), coalesce(au.trocas, 0),
    coalesce(au.ini_n, 0), coalesce(au.ter_n, 0),
    coalesce(cu.casos, 0), coalesce(cu.ini_eu, 0), coalesce(cu.ter_eu, 0), coalesce(cu.tp_inf, 0),
    coalesce(tu.turnos, 0), coalesce(tu.tot_eu, 0),
    esc.id is not null, coalesce(cu.ini_qq, 0), coalesce(cu.ter_qq, 0)
  from ids
  left join pv on pv.id = ids.id
  left join au on au.id = ids.id
  left join cu on cu.id = ids.id
  left join tu on tu.id = ids.id
  left join esc on esc.id = ids.id
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

-- ── Ler um PERÍODO (aba de mês) — mesmo JSON do relatório ao vivo ───────────
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
      count(*) filter (where escalado) as de,
      count(*) filter (where escalado and data > p_ate - 7) as de7,
      count(*) filter (where escalado and aberturas > 0) as dne,
      count(*) filter (where escalado and aberturas > 0 and data > p_ate - 7) as d7e,
      count(*) filter (where aberturas > 0 and extract(isodow from data) <= 5) as dnu,
      count(*) filter (where aberturas > 0 and extract(isodow from data) <= 5 and data > p_ate - 7) as d7u,
      sum(aberturas) as aberturas, sum(acoes) as acoes, sum(trocas) as trocas,
      sum(ini_n) as ini_n, sum(ter_n) as ter_n, sum(casos) as casos,
      sum(ini_eu) as ini_eu, sum(ter_eu) as ter_eu, sum(ini_qq) as ini_qq, sum(ter_qq) as ter_qq,
      sum(tp_inf) as tp_inf, sum(turnos) as turnos, sum(tot_eu) as tot_eu
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

-- ── Carga das colunas novas ─────────────────────────────────────────────────
do $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_min date := (select min(data) from public.escala_adesao_dia);
  d date;
begin
  if v_min is null then return; end if;

  -- (a) dias ainda regraváveis (até 30 atrás): regravação inteira, pelo mesmo caminho do cron
  for d in select g::date from generate_series(greatest(v_min, v_hoje - 30), v_hoje - 1, interval '1 day') g loop
    perform public.escala_adesao_gravar_dia(d);
  end loop;

  -- (b) dias congelados: só as colunas novas. Aberturas e contagens antigas NÃO mudam (o log de
  -- telas desses dias já expirou). Quem estava na escala e não tinha linha ganha uma linha zerada.
  -- roda UMA vez: reaplicar a migration não pode recalcular o histórico congelado com a escala
  -- de hoje (republicação recria casos e solta eventos → os números cairiam)
  if v_min < v_hoje - 30
     and not exists (select 1 from public.escala_adesao_dia
                     where data < v_hoje - 30 and (escalado or ini_qq > 0 or ter_qq > 0)) then
    insert into public.escala_adesao_dia (data, user_id, escalado)
    select e.data, e.user_id, true
    from public.escala_adesao_escalados(v_min, v_hoje - 31) e
    on conflict (data, user_id) do update set escalado = true;

    with casos as (
      select e.data, c.id, c.anestesista_user_id as uid, c.status_cirurgia as st
      from public.escala_cirurgica_caso c
      join public.escala_cirurgica e on e.id = c.escala_id
      where e.status = 'publicada' and e.data between v_min and v_hoje - 31
        and not c.sem_anestesista
        and coalesce(c.procedimento, '') <> ''
        and c.status_extra is null
        and c.anestesista_user_id is not null
    ),
    q as (
      select k.data, k.uid,
        count(*) filter (where exists (select 1 from public.escala_cirurgica_evento ev
                                       where ev.caso_id = k.id and ev.tipo = 'status' and ev.status_para = 'iniciada')) as ini_qq,
        count(*) filter (where k.st = 'terminada') as ter_qq
      from casos k group by k.data, k.uid
    )
    update public.escala_adesao_dia a
       -- nunca acima dos casos gravados no dia (republicação posterior pode ter mudado os casos)
       set ini_qq = least(q.ini_qq, a.casos), ter_qq = least(q.ter_qq, a.casos)
      from q
     where a.data = q.data and a.user_id = q.uid;
  end if;
end $$;

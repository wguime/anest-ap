-- ============================================================================
-- Adesão à Escala — HISTÓRICO diário, abas por mês e evolução (dono 2026-09-23)
-- ============================================================================
-- Pedido do dono: "atualize as informações no aplicativo diariamente", "uma nova aba para
-- cada novo mês (out/26, nov/26…)" e "um gráfico evolutivo para acompanhamento".
--
-- Por que gravar: o relatório ao vivo (`escala_adesao_relatorio`) lê `user_activity_log`,
-- que tem retenção de 90 dias — um mês fechado perderia os dias de uso. Aqui cada DIA vira
-- uma linha de agregados por pessoa e por hospital, gravada toda madrugada, e os meses e a
-- evolução somam essas linhas.
--
--   escala_adesao_dia           (data, user_id)  → aberturas, ações, marcações, casos…
--   escala_adesao_hospital_dia  (data, hospital) → cirurgias, com início/término/tempo…
--
-- Definições IDÊNTICAS às de `escala_adesao_relatorio` (migration 20260923120000), só que
-- recortadas por dia (America/Sao_Paulo): casos = do dia da escala; início/término = evento
-- da própria pessoa no próprio caso; tempo total = override `<turno>:<uid>` com por = uid.
--
-- Cron `escala-adesao-diario` 06:15 UTC (03:15 BRT) regrava os ÚLTIMOS 7 DIAS — marcação
-- feita depois (término tocado no dia seguinte) entra na regravação. Mais velho que isso
-- fica congelado.
--
-- Leitura só por RPC SECURITY DEFINER (tabelas com RLS e sem policy): qualquer usuário
-- ativo lê tudo (decisão do dono). Iara Grasel fora da análise (dono 23/09) — filtro na
-- leitura, igual ao da função ao vivo.
--
-- Rollback: select cron.unschedule('escala-adesao-diario'); drop function
-- escala_adesao_evolucao(), escala_adesao_periodo(date,date), escala_adesao_gravar_recentes(),
-- escala_adesao_gravar_dia(date); drop table escala_adesao_hospital_dia, escala_adesao_dia.
--
-- Retenção: agregados de uso (não clínicos) guardados enquanto o relatório existir — é o que
-- permite comparar meses. Os meses e a evolução cruzam com o cadastro ATUAL (perfil ativo e
-- papel de hoje): quem for desativado sai também dos meses passados; os totais por hospital não
-- mudam. Anonimização LGPD: estas tabelas guardam só user_id + contagens (mesma natureza do
-- user_activity_log); um pedido de exclusão deve apagar as linhas do user_id aqui também.
--
-- Idempotente.

create table if not exists public.escala_adesao_dia (
  data       date not null,
  user_id    text not null,
  aberturas  integer not null default 0,
  acoes      integer not null default 0,
  trocas     integer not null default 0,
  ini_n      integer not null default 0,
  ter_n      integer not null default 0,
  casos      integer not null default 0,
  ini_eu     integer not null default 0,
  ter_eu     integer not null default 0,
  tp_inf     integer not null default 0,
  turnos     integer not null default 0,
  tot_eu     integer not null default 0,
  gravado_em timestamptz not null default now(),
  primary key (data, user_id)
);
comment on table public.escala_adesao_dia is
  'Adesão à Escala Cirúrgica: agregados por pessoa e por DIA (America/Sao_Paulo). Gravado pelo cron escala-adesao-diario; lido só pelas RPCs escala_adesao_periodo/escala_adesao_evolucao.';

create table if not exists public.escala_adesao_hospital_dia (
  data       date not null,
  hospital   text not null,
  casos      integer not null default 0,
  com_ini    integer not null default 0,
  com_ter    integer not null default 0,
  com_tp     integer not null default 0,
  turnos     integer not null default 0,
  com_total  integer not null default 0,
  gravado_em timestamptz not null default now(),
  primary key (data, hospital)
);
comment on table public.escala_adesao_hospital_dia is
  'Adesão à Escala Cirúrgica: agregados por hospital e por DIA. Mesmo cron e mesmas RPCs de escala_adesao_dia.';

alter table public.escala_adesao_dia enable row level security;
alter table public.escala_adesao_hospital_dia enable row level security;
-- sem policy: ninguém lê direto; só as RPCs SECURITY DEFINER abaixo
revoke all on public.escala_adesao_dia from anon, authenticated;
revoke all on public.escala_adesao_hospital_dia from anon, authenticated;

-- ── Gravar UM dia ───────────────────────────────────────────────────────────
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
  -- Dia com mais de 30 dias que JÁ foi gravado fica congelado: o log de telas tem retenção de
  -- 90 dias e a republicação de escala antiga solta os eventos (caso_id fraco) — regravar o
  -- passado apagaria o histórico que esta tabela existe para guardar (validação 23/09).
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
      count(*) filter (where coalesce(tp, '') <> '') as tp_inf
    from kc group by uid
  ),
  turnos as (select distinct escala_id, turno, uid, hospital, ov from casos),
  tu as (
    select uid as id, count(*) as turnos,
      count(*) filter (where coalesce(ov->>'termino', '') <> '' and ov->>'por' = uid) as tot_eu
    from turnos group by uid
  ),
  ids as (select id from pv union select id from au union select id from cu)
  insert into public.escala_adesao_dia
    (data, user_id, aberturas, acoes, trocas, ini_n, ter_n, casos, ini_eu, ter_eu, tp_inf, turnos, tot_eu)
  select p_data, ids.id,
    coalesce(pv.aberturas, 0), coalesce(au.acoes, 0), coalesce(au.trocas, 0),
    coalesce(au.ini_n, 0), coalesce(au.ter_n, 0),
    coalesce(cu.casos, 0), coalesce(cu.ini_eu, 0), coalesce(cu.ter_eu, 0), coalesce(cu.tp_inf, 0),
    coalesce(tu.turnos, 0), coalesce(tu.tot_eu, 0)
  from ids
  left join pv on pv.id = ids.id
  left join au on au.id = ids.id
  left join cu on cu.id = ids.id
  left join tu on tu.id = ids.id
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

-- ── Regravar os últimos 7 dias (o que o cron chama) ─────────────────────────
create or replace function public.escala_adesao_gravar_recentes()
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  d date;
  n integer := 0;
begin
  for d in select generate_series(v_hoje - 7, v_hoje - 1, interval '1 day')::date loop
    perform public.escala_adesao_gravar_dia(d);
    n := n + 1;
  end loop;
  return n;
end;
$function$;

revoke execute on function public.escala_adesao_gravar_recentes() from public, anon, authenticated;
grant execute on function public.escala_adesao_gravar_recentes() to service_role;

-- ── Ler um PERÍODO (aba de mês) — mesmo JSON de escala_adesao_relatorio ─────
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
      sum(aberturas) as aberturas, sum(acoes) as acoes, sum(trocas) as trocas,
      sum(ini_n) as ini_n, sum(ter_n) as ter_n, sum(casos) as casos,
      sum(ini_eu) as ini_eu, sum(ter_eu) as ter_eu, sum(tp_inf) as tp_inf,
      sum(turnos) as turnos, sum(tot_eu) as tot_eu
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
      'acoes', coalesce(d.acoes, 0), 'trocas', coalesce(d.trocas, 0),
      'ini_n', coalesce(d.ini_n, 0), 'ter_n', coalesce(d.ter_n, 0),
      'casos', coalesce(d.casos, 0), 'ini_eu', coalesce(d.ini_eu, 0), 'ter_eu', coalesce(d.ter_eu, 0),
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
    'gravado_ate', (select max(data) from public.escala_adesao_hospital_dia),
    'pessoas', coalesce((select j from pessoas), '[]'::jsonb),
    'hospitais', coalesce((select j from hosp), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$function$;

revoke execute on function public.escala_adesao_periodo(date, date) from public, anon;
grant execute on function public.escala_adesao_periodo(date, date) to authenticated, service_role;

-- ── Evolução semanal + meses disponíveis ────────────────────────────────────
create or replace function public.escala_adesao_evolucao()
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

  with u as (
    select p.id,
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
  h as (
    select date_trunc('week', data)::date as semana,
      min(data) as de, max(data) as ate,
      sum(casos) as casos, sum(com_ini) as com_ini, sum(com_ter) as com_ter,
      sum(com_tp) as com_tp, sum(turnos) as turnos, sum(com_total) as com_total
    from public.escala_adesao_hospital_dia
    group by 1
  ),
  p as (
    select date_trunc('week', d.data)::date as semana,
      count(distinct d.user_id) filter (where d.aberturas > 0) as pessoas,
      count(distinct d.user_id) filter (where d.aberturas > 0 and u.cargo = 'anest') as anest,
      count(distinct d.user_id) filter (where d.aberturas > 0 and u.cargo = 'enf') as enf,
      count(distinct d.user_id) filter (where d.aberturas > 0 and u.cargo = 'res') as res,
      count(distinct d.user_id) filter (where d.aberturas > 0 and u.cargo in ('sec', 'hosp')) as outros,
      sum(d.ter_eu) as ter_eu, sum(d.ini_eu) as ini_eu, sum(d.tot_eu) as tot_eu,
      sum(d.casos) filter (where u.cargo = 'anest') as casos_anest,
      sum(d.turnos) filter (where u.cargo = 'anest') as turnos_anest
    from public.escala_adesao_dia d join u on u.id = d.user_id
    group by 1
  )
  select jsonb_build_object(
    'gravado_ate', (select max(data) from public.escala_adesao_hospital_dia),
    'meses', coalesce((select jsonb_agg(m order by m desc) from (
        select distinct to_char(data, 'YYYY-MM') as m from public.escala_adesao_hospital_dia) x), '[]'::jsonb),
    'semanas', coalesce((select jsonb_agg(jsonb_build_object(
        'semana', h.semana, 'de', h.de, 'ate', h.ate,
        'casos', h.casos, 'com_ini', h.com_ini, 'com_ter', h.com_ter, 'com_tp', h.com_tp,
        'turnos', h.turnos, 'com_total', h.com_total,
        'pessoas', coalesce(p.pessoas, 0), 'anest', coalesce(p.anest, 0), 'enf', coalesce(p.enf, 0),
        'res', coalesce(p.res, 0), 'outros', coalesce(p.outros, 0),
        'ini_eu', coalesce(p.ini_eu, 0), 'ter_eu', coalesce(p.ter_eu, 0), 'tot_eu', coalesce(p.tot_eu, 0),
        'casos_anest', coalesce(p.casos_anest, 0), 'turnos_anest', coalesce(p.turnos_anest, 0)
      ) order by h.semana) from h left join p using (semana)), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$function$;

revoke execute on function public.escala_adesao_evolucao() from public, anon;
grant execute on function public.escala_adesao_evolucao() to authenticated, service_role;

-- ── Cron diário 03:15 BRT ───────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('escala-adesao-diario')
      from cron.job where jobname = 'escala-adesao-diario';
    -- 06:15 UTC = 03:15 BRT: depois da virada das 19h e antes do 1º turno
    perform cron.schedule(
      'escala-adesao-diario', '15 6 * * *',
      $cron$select public.escala_adesao_gravar_recentes();$cron$
    );
  else
    raise warning 'pg_cron ausente: o histórico de adesão NÃO será gravado diariamente';
  end if;
end $$;

-- ── Carga inicial: desde o 1º dia da escala em produção (22/07/2026) ────────
do $$
declare
  d date;
begin
  -- só os dias que faltam: reaplicar a migration nunca regrava o passado
  for d in select g::date from generate_series('2026-07-22'::date, (now() at time zone 'America/Sao_Paulo')::date - 1, interval '1 day') g
           where not exists (select 1 from public.escala_adesao_hospital_dia h where h.data = g::date)
             and not exists (select 1 from public.escala_adesao_dia a where a.data = g::date) loop
    perform public.escala_adesao_gravar_dia(d);
  end loop;
end $$;

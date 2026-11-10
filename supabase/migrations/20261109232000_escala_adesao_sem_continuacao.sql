-- ============================================================================
-- Adesão à Escala — a continuação não é outra cirurgia (dono 2026-11-09)
-- ============================================================================
-- A cirurgia que começa de manhã e continua à tarde é UM cartão no app: a linha "CONTINUAÇÃO" da tarde
-- dá lugar ao caso da manhã quando é a mesma pessoa (`fundirContinuacoesNaOrigem`, 26/10), e os toques
-- vão para o cartão da manhã. O relatório de adesão seguia contando a linha da tarde como outra
-- cirurgia — sem início e sem término, porque ninguém tem onde marcar — e baixava o percentual de quem
-- teve cirurgia longa. A conta do horário (`escala_horario_conta`, 20261028130000) já tratava o par; a
-- adesão não. Decisão do dono (09/11): corrigir e refazer os 30 dias.
--
-- Regra: a continuação da MESMA pessoa não conta à parte. A cirurgia conta uma vez, com o que foi
-- marcado em qualquer um dos dois cartões (início de manhã + término na continuação = completa; 27/10).
-- Continuação com OUTRA pessoa, ou sem cirurgia da manhã que case, segue contando como cirurgia de
-- quem continuou. Dupla só funde com a mesma dupla.
--
-- Colega começa de manhã e OUTRO continua (dono 09/11: "não cobrar o término dele"): com a manhã ainda
-- aberta, vale a regra da conta do horário (`herda` de `escala_pares_continuacao`, 27/10) — quem
-- começou responde só pelo início, quem continuou só pelo término. Como a adesão divide início e
-- término pelo mesmo total de cirurgias, o que não é cobrado entra como feito: o término no cartão de
-- quem começou e o início no cartão de quem continuou. O horário de qualquer um dos dois cartões vale
-- para a cirurgia. Cada um segue com a sua cirurgia na conta (são dois cartões).
--
-- Mesma SALA é exigência (dono 09/11: "continuação pode ser em outra sala, mas uma cirurgia que
-- começou em uma sala não termina em outra; apenas quando são procedimentos distintos"): sala
-- diferente = procedimento distinto = duas cirurgias.
--
-- O par é o da conta do horário: `escala_pares_continuacao` (mesma escala, mesma sala, cirurgião
-- compatível; mesma pessoa pelo login, ou pelos nomes na dupla). Aquela função só casa a manhã ainda
-- ABERTA — no horário, a continuação de manhã já terminada simplesmente não entra. Aqui ela precisa
-- de resposta (some ou conta?), então `escala_adesao_continuacoes` aplica o MESMO casamento também
-- sobre a manhã terminada, como a tela faz (`origemDaContinuacao`: "o caso da manhã pode já estar
-- terminado"). Com par aberto, vale o par aberto.
--
-- O que muda: as três contas de cirurgia (relatório ao vivo, histórico por pessoa e por hospital)
-- passam a ler uma função só, `escala_adesao_casos`, em vez de repetir o corpo. O que NÃO muda: o
-- corte do consultório/SRPA (29–30/10), os dias na escala, e os TURNOS que pedem tempo total — a
-- pessoa da continuação segue na linha da tarde.
--
-- Medido em produção (10/10–08/11, só SELECT): 42 linhas de continuação; 11 da mesma pessoa
-- (hro e unimed), das quais 4 nunca tocadas — as que hoje pesam como cirurgia sem início e sem
-- término; as outras 7 foram tocadas nos dois cartões e contavam em dobro. 24 são de outra pessoa (13
-- com a manhã ainda aberta: o término deixa de pesar em quem começou) e 7 não têm cirurgia da manhã
-- que case: seguem contando. `escala_pares_continuacao` em 60 dias: 0,22 s.
--
-- Os dias até 30 atrás são regravados pelo caminho do cron; os congelados ficam como foram gravados,
-- como em 20261029213000 e 20261030110000.
--
-- ORDEM com 20261109233000 (cópia pronta do relatório): esta vem ANTES, mas funciona nas duas ordens —
-- o cálculo ao vivo é gravado na função que o tem (`escala_adesao_relatorio`, ou
-- `escala_adesao_relatorio_calc` se a cópia pronta já existir; a função pública que lê a cópia nunca
-- recebe o corpo do cálculo) e, se a cópia existir, ela é regravada no fim.
--
-- Base: as definições VIVAS de 20261030110000 (relatório e gravação do dia) — md5 do corpo conferido
-- contra produção em 09/11 (relatório 720fd3a0…, gravação 8d48e617…; `escala_pares_continuacao`
-- c8f05fc8… = 20261027220000; a cópia pronta ainda não aplicada).
-- Rollback: scripts/rollback-20261109232000-adesao-sem-continuacao.sql. Idempotente.

begin;
-- teto: a Management API devolve 524 depois de ~100 s e a transação podia seguir sozinha (20260916170000)
set local lock_timeout = '3s';
set local statement_timeout = '60s';

-- ── Os pares manhã × continuação que mudam a conta ──────────────────────────
-- `herda` falso = mesma pessoa: a continuação é a cirurgia da manhã. Par aberto: o de
-- `escala_pares_continuacao`; manhã já terminada: o mesmo casamento daquela função (sala, cirurgião,
-- desempate, mesma gente), que ela não faz porque o horário não precisa.
-- `herda` verdadeiro = outra pessoa continuou a manhã ainda aberta (só o par de
-- `escala_pares_continuacao`): o término é de quem continuou.
create or replace function public.escala_adesao_continuacoes(p_desde date, p_ate date)
returns table (continuacao_id uuid, origem_id uuid, herda boolean)
language sql
stable
set search_path = pg_catalog, public
as $$
  with abertos as (
    select p.continuacao_id, p.origem_id, p.herda from public.escala_pares_continuacao(p_desde, p_ate) p
  ),
  casos as (
    -- as mesmas colunas e os mesmos cortes de escala_pares_continuacao; só o que ela deixa de fora:
    -- a continuação e a manhã já terminada, nas escalas que têm continuação
    select c.id, c.escala_id, c.ordem,
           coalesce(c.status_extra, '') as extra,
           coalesce(c.is_continuacao, false) as is_cont,
           upper(btrim(coalesce(c.sala, ''))) as sala,
           public.escala_nomes_cirurgiao(c.cirurgiao) as nomes,
           public.escala_pessoas_caso(c.anestesista) as pessoas,
           nullif(btrim(coalesce(c.anestesista_user_id, '')), '') as uid,
           case when c.turno in ('matutino', 'vespertino') then c.turno
                when substring(c.hora from '^\s*([0-9]{1,2}):[0-9]{2}') is null then 'matutino'
                when substring(c.hora from '^\s*([0-9]{1,2}):[0-9]{2}')::int * 60
                     + substring(c.hora from '^\s*[0-9]{1,2}:([0-9]{2})')::int < 13 * 60 then 'matutino'
                else 'vespertino' end as turno
      from public.escala_cirurgica_caso c
      join public.escala_cirurgica e on e.id = c.escala_id
     where e.status = 'publicada'
       and e.hospital in ('unimed', 'hro', 'materno')
       and e.data between p_desde and p_ate
       and btrim(coalesce(c.procedimento, '')) <> ''
       and coalesce(c.procedimento, '') !~* 'consult'
       and not coalesce(c.sem_anestesista, false)
       and coalesce(c.status_extra, '') <> 'suspensa'
       and coalesce(c.status_cirurgia, '') <> 'suspensa'
       and (coalesce(c.is_continuacao, false) or coalesce(c.status_cirurgia, 'agendada') = 'terminada')
       and exists (select 1 from public.escala_cirurgica_caso x
                    where x.escala_id = c.escala_id and x.is_continuacao)
  )
  select a.continuacao_id, a.origem_id, a.herda from abertos a
  union all
  select k.id, o.id, false
    from casos k
    cross join lateral (
      select m.id, m.pessoas, m.uid
        from casos m
       where m.escala_id = k.escala_id
         and not m.is_cont and m.turno = 'matutino'
         and cardinality(m.pessoas) > 0
         and m.sala = k.sala
         and (cardinality(k.nomes) = 0 or cardinality(m.nomes) = 0 or k.nomes && m.nomes)
       order by cardinality(array(select unnest(k.nomes) intersect select unnest(m.nomes))) desc,
                (m.extra = 'passa_tarde') desc,
                m.ordem desc nulls last,
                m.id
       limit 1
    ) o
   where k.is_cont and k.turno = 'vespertino' and cardinality(k.pessoas) > 0
     -- com par aberto (da mesma pessoa ou de outra), vale o par aberto
     and not exists (select 1 from abertos a where a.continuacao_id = k.id)
     and (case when cardinality(k.pessoas) = 1 and cardinality(o.pessoas) = 1
                    and k.uid is not null and o.uid is not null
               then k.uid = o.uid
               else k.pessoas = o.pessoas end)
$$;

revoke execute on function public.escala_adesao_continuacoes(date, date) from public, anon, authenticated;
grant execute on function public.escala_adesao_continuacoes(date, date) to service_role;

-- ── As cirurgias da conta de adesão, uma vez cada ───────────────────────────
-- Uma linha por caso que a adesão sempre leu (mesmos cortes de 20261029213000). `conta` = falso só na
-- continuação fundida na cirurgia da manhã; a cirurgia fundida traz o que foi marcado em qualquer um
-- dos dois cartões. No par em que OUTRA pessoa continuou a manhã aberta, quem começou sai com o
-- término feito e quem continuou com o início feito (não são cobrados, como na conta do horário).
-- Caso sem continuação sai exatamente como saía.
-- SECURITY INVOKER: só o relatório e a gravação do dia a chamam (como dono).
create or replace function public.escala_adesao_casos(p_desde date, p_ate date)
returns table (id uuid, escala_id uuid, turno text, hospital text, uid text, conta boolean,
               st text, tp text, ini_qq boolean, ini_eu boolean, ter_eu boolean)
language sql
stable
set search_path = pg_catalog, public
as $$
  with base as (
    select c.id, c.escala_id, c.turno, e.hospital, c.anestesista_user_id as uid,
           c.status_cirurgia as st, c.termino_previsto as tp
    from public.escala_cirurgica_caso c
    join public.escala_cirurgica e on e.id = c.escala_id
    where e.status = 'publicada'
      and e.data between p_desde and p_ate
      and not c.sem_anestesista
      and coalesce(c.procedimento, '') <> ''
      and coalesce(c.procedimento, '') !~* 'consult'  -- consultório: horário fixo (dono 16/10 e 29/10)
      and c.status_extra is null
      and c.anestesista_user_id is not null
  ),
  pares as (select f.continuacao_id, f.origem_id, f.herda from public.escala_adesao_continuacoes(p_desde, p_ate) f),
  fus as (
    -- a continuação da mesma pessoa; `origem_conta` = a cirurgia da manhã está na conta (se não está
    -- — "passa para tarde" ainda marcado —, quem representa a cirurgia segue sendo a continuação)
    select f.continuacao_id, f.origem_id, (o.id is not null) as origem_conta
    from pares f
    join base k on k.id = f.continuacao_id
    left join base o on o.id = f.origem_id
    where not f.herda
  ),
  cartoes as (
    -- os cartões de cada cirurgia: o próprio; na fundida, o outro do par; e, quando outra pessoa
    -- continuou a manhã aberta, o cartão do colega (o horário de qualquer um vale para a cirurgia)
    select b.id as cirurgia, b.id as cartao, false as do_colega from base b
    union all
    select case when f.origem_conta then f.origem_id else f.continuacao_id end,
           case when f.origem_conta then f.continuacao_id else f.origem_id end, false
    from fus f
    union all
    select h.origem_id, h.continuacao_id, true from pares h where h.herda
    union all
    select h.continuacao_id, h.origem_id, true from pares h where h.herda
  ),
  marcas as (
    select ct.cirurgia,
           bool_or(x.status_cirurgia = 'terminada') as terminada,
           -- o tempo da cirurgia informado no cartão do colega é dele
           max(nullif(x.termino_previsto, '')) filter (where not ct.do_colega) as tp
    from cartoes ct
    join public.escala_cirurgica_caso x on x.id = ct.cartao
    group by ct.cirurgia
  ),
  evc as (
    select ct.cirurgia,
      bool_or(ev.status_para = 'iniciada') as ini_qq,
      bool_or(ev.status_para = 'iniciada' and ev.por = b.uid) as ini_eu,
      bool_or(ev.status_para = 'terminada' and ev.por = b.uid) as ter_eu
    from cartoes ct
    join base b on b.id = ct.cirurgia
    join public.escala_cirurgica_evento ev on ev.caso_id = ct.cartao
    where ev.tipo = 'status'
    group by ct.cirurgia
  )
  select b.id, b.escala_id, b.turno, b.hospital, b.uid,
         not exists (select 1 from fus f where f.continuacao_id = b.id and f.origem_conta),
         -- quem começou e passou a cirurgia a outra pessoa não é cobrado pelo término
         case when m.terminada or hp.passou then 'terminada' else b.st end,
         case when coalesce(b.tp, '') <> '' then b.tp else coalesce(m.tp, b.tp) end,
         -- quem continuou a cirurgia de outra pessoa não é cobrado pelo início
         coalesce(evc.ini_qq, false) or hp.continuou,
         coalesce(evc.ini_eu, false) or hp.continuou,
         coalesce(evc.ter_eu, false) or hp.passou
  from base b
  left join marcas m on m.cirurgia = b.id
  left join evc on evc.cirurgia = b.id
  cross join lateral (
    select exists (select 1 from pares h where h.herda and h.origem_id = b.id) as passou,
           exists (select 1 from pares h where h.herda and h.continuacao_id = b.id) as continuou
  ) hp
$$;

revoke execute on function public.escala_adesao_casos(date, date) from public, anon, authenticated;
grant execute on function public.escala_adesao_casos(date, date) to service_role;

-- ── Relatório ao vivo (definição de 20261030110000; mudam só `casos`/`kc`) ────
do $mig$
declare
  v_def text := $def$create or replace function public.escala_adesao_relatorio(p_dias integer default 30)
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
    -- a conta das cirurgias mora em escala_adesao_casos: a continuação da mesma pessoa é a cirurgia da
    -- manhã (dono 09/11). `conta` = cirurgia que entra na conta; a linha fundida segue só no turno
    select k.id, k.escala_id, k.turno, k.hospital, k.uid, k.conta, k.st, k.tp,
           k.ini_qq, k.ini_eu, k.ter_eu,
           e.linha_overrides -> (k.turno || ':' || k.uid) as ov
    from public.escala_adesao_casos(v_ate - v_dias + 1, v_ate) k
    join public.escala_cirurgica e on e.id = k.escala_id
  ),
  kc as (select * from casos where conta),
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
$function$;$def$;
  v_publica text := pg_get_functiondef('public.escala_adesao_relatorio(integer)'::regprocedure);
  v_tem_calc boolean := to_regprocedure('public.escala_adesao_relatorio_calc(integer)') is not null;
begin
  if not v_tem_calc then
    -- antes da cópia pronta: o cálculo é a própria função pública
    if position('escala_adesao_snapshot' in v_publica) > 0 then
      raise exception 'escala_adesao_relatorio lê a cópia pronta e o _calc não existe — estado inesperado';
    end if;
    execute v_def;
    return;
  end if;

  -- depois da cópia pronta: a pública só lê a cópia e NÃO pode receber o corpo do cálculo
  if position('escala_adesao_snapshot' in v_publica) = 0 then
    raise exception 'o _calc existe, mas escala_adesao_relatorio não lê a cópia pronta — estado inesperado';
  end if;
  v_def := replace(v_def, 'function public.escala_adesao_relatorio(', 'function public.escala_adesao_relatorio_calc(');
  -- o bloco de acesso sai: o _calc só é chamado pelo cron e pela função pública, que confere
  v_def := regexp_replace(v_def, 'if public\.firebase_uid\(\) is null.*?end if;', '');
  if position('escala_adesao_relatorio_calc(' in v_def) = 0 or position('acesso negado' in v_def) > 0 then
    raise exception 'o corpo para o _calc não saiu como esperado';
  end if;
  execute v_def;
  revoke all on function public.escala_adesao_relatorio_calc(integer) from public, anon, authenticated;
end
$mig$;

-- os direitos da função pública (create or replace os mantém; aqui ficam declarados, como em 20261030110000)
revoke execute on function public.escala_adesao_relatorio(integer) from public, anon;
grant execute on function public.escala_adesao_relatorio(integer) to authenticated, service_role;

-- ── Gravação do dia (definição de 20261030110000; mudam só os dois `casos`) ──
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
    -- a conta das cirurgias mora em escala_adesao_casos: a continuação da mesma pessoa é a cirurgia da
    -- manhã (dono 09/11). `conta` = cirurgia que entra na conta; a linha fundida segue só no turno
    select k.id, k.escala_id, k.turno, k.hospital, k.uid, k.conta, k.st, k.tp,
           k.ini_qq, k.ini_eu, k.ter_eu,
           e.linha_overrides -> (k.turno || ':' || k.uid) as ov
    from public.escala_adesao_casos(p_data, p_data) k
    join public.escala_cirurgica e on e.id = k.escala_id
  ),
  kc as (select * from casos where conta),
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
    select k.id, k.escala_id, k.turno, k.hospital, k.uid, k.conta, k.st, k.tp, k.ini_qq,
           e.linha_overrides -> (k.turno || ':' || k.uid) ->> 'termino' as tt
    from public.escala_adesao_casos(p_data, p_data) k
    join public.escala_cirurgica e on e.id = k.escala_id
  ),
  h as (
    select hospital, count(*) as casos,
      count(*) filter (where ini_qq) as com_ini,
      count(*) filter (where st = 'terminada') as com_ter,
      count(*) filter (where coalesce(tp, '') <> '') as com_tp
    from casos where conta group by hospital
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

-- ── Os 30 dias que o cron ainda regrava, já sem a continuação em dobro ──────
do $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_min date := (select min(data) from public.escala_adesao_dia);
  d date;
begin
  if v_min is not null then
    for d in select g::date from generate_series(greatest(v_min, v_hoje - 30), v_hoje - 1, interval '1 day') g loop
      perform public.escala_adesao_gravar_dia(d);
    end loop;
  end if;
  -- aplicada depois de 20261109233000: a cópia pronta do relatório ao vivo é regravada já
  if to_regprocedure('public.escala_adesao_snapshot_atualizar()') is not null then
    perform public.escala_adesao_snapshot_atualizar();
  end if;
end $$;

commit;

-- Conferência (a Management API não devolve raise notice): as duas contas leem a função única, a
-- função pública não perdeu a cópia pronta (se ela existir) e o histórico recente foi regravado agora.
select position('escala_adesao_casos' in pg_get_functiondef(coalesce(
         to_regprocedure('public.escala_adesao_relatorio_calc(integer)'),
         to_regprocedure('public.escala_adesao_relatorio(integer)')))) > 0 as relatorio_le_a_conta,
       position('escala_adesao_casos' in pg_get_functiondef('public.escala_adesao_gravar_dia(date)'::regprocedure)) > 0 as gravacao_le_a_conta,
       to_regprocedure('public.escala_adesao_relatorio_calc(integer)') is null
         or position('escala_adesao_snapshot' in pg_get_functiondef('public.escala_adesao_relatorio(integer)'::regprocedure)) > 0 as publica_intacta,
       has_function_privilege('authenticated', 'public.escala_adesao_casos(date, date)', 'execute') as auth_conta,
       (select count(distinct data) from public.escala_adesao_dia
         where gravado_em > now() - interval '5 minutes') as dias_regravados;

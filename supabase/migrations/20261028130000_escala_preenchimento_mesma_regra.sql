-- ════════════════════════════════════════════════════════════════════════════
-- Escala cirúrgica — "SEU PREENCHIMENTO" COM A MESMA REGRA DO AVISO (dono 2026-10-28).
--
-- O dono: "estão inconsistentes. eventualmente aparece que tenho 100% de cirurgias marcadas
-- mas falta 1?". A auditoria de outubro achou o "Seu preenchimento" contando um conjunto de
-- cirurgias diferente do aviso "sem horário" e do relatório de adesão:
--   - "Passa para a tarde" sem ninguém que continuasse: saía da porcentagem e seguia cobrada
--     de quem começou (17 cirurgias em outubro);
--   - a continuação que herdou o término (27/10) não entrava na conta de quem continuou, e a
--     manhã que passou o término saía da conta de quem começou, que ainda deve o início;
--   - a dupla "A + B" (sem login no caso) ficava fora da conta dos dois;
--   - o dia virava à meia-noite, e o app vira às 07:00.
-- E hoje ficava de fora: "100%" ao lado de "1 cirurgia de hoje sem horário". O dono escolheu
-- que hoje entre na conta; essa parte a TELA soma (`preenchimentoDoDia`, a regra com a hora e a
-- fila de hoje mora no app), e o banco devolve só os dias encerrados.
--
-- Agora há UMA conta no banco, `escala_horario_conta`: cada cirurgia que pede horário, com o
-- que falta (null = completa) — a mesma de `pendenciasDoDia` com o dia virado
-- (src/lib/escalaHorarioPendente.js). O relatório lista as que têm falta; o "Seu
-- preenchimento" conta as da pessoa e quantas não devem nada. 100% = nada pendente.
--
-- Quem responde pela cirurgia no "Seu preenchimento": o login gravado no caso; sem ele (a
-- dupla), cada nome pelo dicionário de apelidos, como a aba Minhas (`anestesistaDoCasoEh`).
-- O apelido gravado na conta secundária responde pela principal (o resolvedor da tela faz o
-- mesmo); o login gravado no caso vale como está, como o `meuUid` da tela.
--
-- O relatório devolve exatamente o que devolvia (conferido em produção antes de aplicar).
-- Rollback: scripts/rollback-20261028130000-preenchimento-mesma-regra.sql
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- Cada cirurgia dos dias do período que pede horário, com o que falta: 'ini' | 'ter' |
-- 'ambos' | null (completa). Lib: casoEntraNaConta + herdaTermino + faltaNoPar, a partir da
-- tarde de 05/10 (INICIO_ALERTA_HORARIO). SECURITY INVOKER: só as duas RPCs abaixo a chamam
-- (como postgres); um GRANT por engano não abriria a escala inteira a quem está logado.
create or replace function public.escala_horario_conta(p_desde date, p_ate date)
returns table (
  id uuid, data date, turno text, hospital text, sala text, ordem integer, hora text, minutos integer,
  procedimento text, anestesista text, anestesista_user_id text, falta text
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  with pares as (
    select * from public.escala_pares_continuacao(p_desde, p_ate)
  ),
  -- o par conta como UMA cirurgia: o horário de qualquer card vale para ela
  par_horario as (
    select pc.origem_id,
           bool_or(nullif(btrim(coalesce(x.inicio_real, '')), '') is not null) as tem_ini,
           bool_or(nullif(btrim(coalesce(x.termino_real, '')), '') is not null) as tem_ter,
           bool_or(pc.herda) as passou
      from (select origem_id, origem_id as card_id, herda from pares
            union all
            select origem_id, continuacao_id, herda from pares) pc
      join public.escala_cirurgica_caso x on x.id = pc.card_id
     group by pc.origem_id
  ),
  base as (
    select e.data, e.hospital, c.id, c.sala, c.ordem, c.hora, c.procedimento,
           c.anestesista, c.anestesista_user_id,
           nullif(btrim(coalesce(c.inicio_real, '')), '') as ini,
           nullif(btrim(coalesce(c.termino_real, '')), '') as ter,
           -- só dígitos ASCII na captura: o cast nunca falha (banco em ICU, \d aceita outros)
           substring(c.hora from '^\s*([0-9]{1,2}):[0-9]{2}')::int as hh,
           substring(c.hora from '^\s*[0-9]{1,2}:([0-9]{2})')::int as mm,
           c.turno as turno_publicado
    from public.escala_cirurgica_caso c
    join public.escala_cirurgica e on e.id = c.escala_id
    where e.status = 'publicada'
      and e.hospital in ('unimed', 'hro', 'materno')
      and e.data between p_desde and p_ate
      and btrim(coalesce(c.procedimento, '')) <> ''
      and coalesce(c.procedimento, '') !~* 'consult'  -- consultório tem horário definido (16/10)
      and not coalesce(c.sem_anestesista, false)
      and coalesce(c.status_extra, '') <> 'suspensa'
      and coalesce(c.status_cirurgia, '') <> 'suspensa'
      -- continuação só a que herdou o término de outra pessoa (27/10)
      and (not coalesce(c.is_continuacao, false)
           or c.id in (select p.continuacao_id from pares p where p.herda))
      -- alguma parte da dupla é pessoa: nem vazia, nem "//", nem só "?" (lib: anestesistasDoCaso)
      and exists (
        select 1 from regexp_split_to_table(coalesce(c.anestesista, ''), '\s*\+\s*') s
        where btrim(s) not in ('', '//') and btrim(s) !~ '^\?+$'
      )
  ),
  comturno as (
    select b.*,
           case when b.turno_publicado in ('matutino', 'vespertino') then b.turno_publicado
                when b.hh is null then 'matutino'
                when b.hh * 60 + b.mm < 13 * 60 then 'matutino'
                else 'vespertino' end as turno
    from base b
  )
  select t.id, t.data, t.turno, t.hospital, t.sala, t.ordem, t.hora, t.hh * 60 + t.mm,
         t.procedimento, t.anestesista, t.anestesista_user_id, f.falta
    from comturno t
    left join pares pc on pc.continuacao_id = t.id and pc.herda
    left join par_horario hc on hc.origem_id = pc.origem_id
    left join par_horario ho on ho.origem_id = t.id
    cross join lateral (
      select case
        -- a continuação de outra pessoa deve só o término (lib: faltaNoPar)
        when pc.continuacao_id is not null then case when hc.tem_ter then null else 'ter' end
        -- a manhã que passou o término adiante deve só o início
        when ho.origem_id is not null and ho.passou then case when ho.tem_ini then null else 'ini' end
        when ho.origem_id is not null then case
          when ho.tem_ini and ho.tem_ter then null
          when not ho.tem_ini and not ho.tem_ter then 'ambos'
          when not ho.tem_ini then 'ini'
          else 'ter' end
        when t.ini is null and t.ter is null then 'ambos'
        when t.ini is null then 'ini'
        when t.ter is null then 'ter'
      end as falta
    ) f
   where t.data > date '2026-10-05' or t.turno = 'vespertino'
$$;

revoke execute on function public.escala_horario_conta(date, date) from public, anon, authenticated;
grant execute on function public.escala_horario_conta(date, date) to service_role;

create or replace function public.escala_horario_pendente_relatorio(
  p_desde date default null,
  p_ate date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  -- dia operacional de agora: antes das 07:00 ainda é o dia anterior
  v_hoje_op date := ((now() at time zone 'America/Sao_Paulo') - interval '7 hours')::date;
  v_inicio constant date := date '2026-10-05';
  v_ate date;
  v_desde date;
  v_result jsonb;
begin
  if coalesce(public.firebase_uid(), '') = ''
     or not exists (select 1 from public.profiles p where p.id = public.firebase_uid() and p.active)
     or not public.can_write_escala_cirurgica() then
    raise exception 'acesso negado' using errcode = '42501';
  end if;

  v_ate := least(coalesce(p_ate, v_hoje_op - 1), v_hoje_op - 1);
  v_desde := greatest(coalesce(p_desde, v_ate - 29), v_inicio, v_ate - 61);

  select jsonb_build_object(
    'desde', v_desde,
    'ate', v_ate,
    'inicio', v_inicio,
    'casos', coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'data', p.data,
      'turno', p.turno,
      'hospital', p.hospital,
      'sala', p.sala,
      'hora', p.hora,
      'procedimento', p.procedimento,
      'anestesista', p.anestesista,
      'anestesista_user_id', p.anestesista_user_id,
      'falta', p.falta
    ) order by p.data desc, p.turno, coalesce(p.minutos, 1440), p.hospital, p.sala, p.ordem), '[]'::jsonb)
  )
  into v_result
  from public.escala_horario_conta(v_desde, v_ate) p
  where p.falta is not null;

  return v_result;
end;
$function$;

comment on function public.escala_horario_pendente_relatorio(date, date) is
  'Cirurgias dos dias operacionais já encerrados (vira às 07:00) que ficaram sem início ou sem término — o "Horário não preenchido no dia" do relatório de adesão (dono 2026-10-05). Conta a partir da tarde de 05/10/2026. Sem dado de paciente. Acesso = quem opera a escala (can_write_escala_cirurgica).';

revoke execute on function public.escala_horario_pendente_relatorio(date, date) from public, anon;
grant execute on function public.escala_horario_pendente_relatorio(date, date) to authenticated, service_role;

create or replace function public.escala_meu_preenchimento(p_dias integer default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid   text := public.firebase_uid();
  v_dias  integer := least(greatest(coalesce(p_dias, 7), 1), 30);
  -- dias operacionais encerrados (vira às 07:00, como a tela e o relatório); hoje a tela soma
  v_ate   date := ((now() at time zone 'America/Sao_Paulo') - interval '7 hours')::date - 1;
  v_desde date;
  v_res   jsonb;
begin
  if v_uid is null or v_uid = ''
     or not exists (select 1 from public.profiles p where p.id = v_uid and p.active) then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  v_desde := greatest(v_ate - (v_dias - 1), date '2026-10-05');

  with conta as (
    select * from public.escala_horario_conta(v_desde, v_ate)
  ),
  -- dicionário apelido → login na chave da tela (normApelido: sem acento, sem "PED", em
  -- maiúsculas); o apelido que normaliza igual para dois logins não resolve ninguém
  apelidos as (
    select regexp_replace(k, '^PED ', '') as chave, min(coalesce(p.conta_duplicada_de, a.user_id)) as uid
      from public.escala_anestesista_alias a
      left join public.profiles p on p.id = a.user_id
      cross join lateral unnest(public.escala_pessoas_caso(a.apelido)) as k
     group by 1
    having count(distinct coalesce(p.conta_duplicada_de, a.user_id)) = 1
  ),
  -- quem responde por cada cirurgia: o login gravado no caso; sem ele (a dupla "A + B"),
  -- cada nome pelo dicionário (aba Minhas: anestesistaDoCasoEh)
  casos as (
    select c.anestesista_user_id as uid, c.falta is null as ok
      from conta c
     where c.anestesista_user_id is not null
    union all
    select distinct on (c.id, ap.uid) ap.uid, c.falta is null
      from conta c
      cross join lateral unnest(public.escala_pessoas_caso(c.anestesista)) as n
      join apelidos ap on ap.chave = regexp_replace(n, '^PED ', '')
     where c.anestesista_user_id is null
  ), por_pessoa as (
    select uid, count(*) as n, count(*) filter (where ok) as completos,
           100.0 * count(*) filter (where ok) / count(*) as pct
      from casos group by uid
  ), top as (
    -- mesmas exclusões do relatório de adesão (conta de teste, duplicada, Iara)
    select pp.pct from por_pessoa pp
      join public.profiles p on p.id = pp.uid
     where pp.n >= 5 and p.active
       and coalesce(p.email, '') not like '%+e2e%'
       and p.conta_duplicada_de is null
       and p.id <> '567JGBfHyfQB9RG2jESJFQtwcQ23'
     order by pp.pct desc limit 5
  )
  select jsonb_build_object(
    'desde', v_desde,
    'ate', v_ate,
    'casos', coalesce((select n from por_pessoa where uid = v_uid), 0),
    'completos', coalesce((select completos from por_pessoa where uid = v_uid), 0),
    'pct', (select round(pct, 1) from por_pessoa where uid = v_uid),
    -- com menos de 3 no topo a "média dos melhores" seria o número de uma pessoa só
    'top', (select case when count(*) >= 3 then round(avg(pct), 1) end from top),
    'top_n', (select count(*) from top)
  ) into v_res;
  return v_res;
end;
$$;

revoke execute on function public.escala_meu_preenchimento(integer) from public, anon;
grant execute on function public.escala_meu_preenchimento(integer) to authenticated, service_role;

commit;

-- conferência: as duas RPCs leem a conta única; ninguém de fora chama a conta direto
select position('escala_horario_conta' in pg_get_functiondef('public.escala_horario_pendente_relatorio'::regproc)) > 0 as relatorio,
       position('escala_horario_conta' in pg_get_functiondef('public.escala_meu_preenchimento'::regproc)) > 0 as meu,
       has_function_privilege('authenticated', 'public.escala_horario_conta(date, date)', 'execute') as auth_conta,
       has_function_privilege('authenticated', 'public.escala_meu_preenchimento(integer)', 'execute') as auth_meu;

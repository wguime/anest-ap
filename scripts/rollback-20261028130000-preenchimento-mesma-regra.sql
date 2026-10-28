-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK de 20261028130000_escala_preenchimento_mesma_regra.sql
--
-- Volta o relatório de adesão e o "Seu preenchimento" aos corpos de 20261027220000 (a
-- continuação herda o término) e tira a conta única `escala_horario_conta`. Ordem: o app
-- primeiro (o de antes pede 7 dias e não soma hoje), depois este script.
-- ════════════════════════════════════════════════════════════════════════════

begin;

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

  with pares as (
    select * from public.escala_pares_continuacao(v_desde, v_ate)
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
      and e.data between v_desde and v_ate
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
  ),
  pend as (
    select t.*, f.falta
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
    where f.falta is not null
      and (t.data > v_inicio or t.turno = 'vespertino')
  )
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
    ) order by p.data desc, p.turno, coalesce(p.hh * 60 + p.mm, 1440), p.hospital, p.sala, p.ordem), '[]'::jsonb)
  )
  into v_result
  from pend p;

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
  v_ate   date := (now() at time zone 'America/Sao_Paulo')::date - 1;
  v_desde date;
  v_res   jsonb;
begin
  if v_uid is null or v_uid = ''
     or not exists (select 1 from public.profiles p where p.id = v_uid and p.active) then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  -- as colunas inicio_real/termino_real nasceram em 02/10: antes disso ninguém tinha como preencher
  v_desde := greatest(v_ate - (v_dias - 1), date '2026-10-02');

  with pares as (
    select * from public.escala_pares_continuacao(v_desde, v_ate)
  ),
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
  casos as (
    select c.anestesista_user_id as uid,
           -- com continuação da mesma pessoa, o horário de qualquer card do par vale
           case when ph.origem_id is not null then ph.tem_ini and ph.tem_ter
                else (c.inicio_real is not null and c.termino_real is not null) end as ok
      from public.escala_cirurgica_caso c
      join public.escala_cirurgica e on e.id = c.escala_id
      left join par_horario ph on ph.origem_id = c.id
     where e.data between v_desde and v_ate
       and e.hospital <> 'fds'
       and e.status = 'publicada'
       and c.anestesista_user_id is not null
       and btrim(coalesce(c.procedimento, '')) <> ''
       and coalesce(c.procedimento, '') !~* 'consult'  -- consultório tem horário definido (16/10)
       and coalesce(c.anestesista, '') not like '%+%'
       and not coalesce(c.sem_anestesista, false)
       and not coalesce(c.is_continuacao, false)
       and coalesce(c.status_cirurgia, 'agendada') <> 'suspensa'
       and coalesce(c.status_extra, '') <> 'suspensa'
       -- "passa para a tarde" ainda aberto é de quem ficou com a continuação (como na trava)
       and not (coalesce(c.status_extra, '') = 'passa_tarde' and coalesce(c.status_cirurgia, 'agendada') <> 'terminada')
       -- o término que a continuação de OUTRA pessoa herdou também (27/10)
       and not coalesce(ph.passou, false)
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

drop function if exists public.escala_horario_conta(date, date);

commit;

-- conferência: as duas RPCs voltaram a não usar a conta única, e ela não existe mais
select not exists (select 1 from pg_proc where proname = 'escala_horario_conta') as conta_fora,
       position('escala_horario_conta' in pg_get_functiondef('public.escala_horario_pendente_relatorio'::regproc)) = 0 as relatorio_antigo,
       position('escala_horario_conta' in pg_get_functiondef('public.escala_meu_preenchimento'::regproc)) = 0 as meu_antigo;

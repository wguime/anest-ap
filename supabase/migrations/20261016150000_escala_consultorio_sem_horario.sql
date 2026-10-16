-- ════════════════════════════════════════════════════════════════════════════
-- Escala cirúrgica — CONSULTÓRIO NÃO PEDE HORÁRIO (dono 2026-10-16).
--
-- "quem estiver escalado no consultório não seja necessário colocar horário de início e
-- término, já que consultório tem horário definido. manhã das 7:45 às 11:30 e à tarde das
-- 13:30 às 17:00". O corte é o PROCEDIMENTO com "consult" (CONSULTORIO, CONSULTÓRIO – AJUDA,
-- 11 CONSULTAS), não a sala: uma blefaroplastia lançada na sala "Consultório" continua pedindo
-- horário. Em toda a base, todo procedimento com "consult" estava na sala Consultório.
--
-- Três funções ganham a mesma linha, o resto do corpo é idêntico às migrations de origem:
--   escala_caso_trava_liberacao   (20261014200000) — a trava da liberação
--   escala_horario_pendente_relatorio (20261005150000) — o relatório de adesão
--   escala_meu_preenchimento      (20261015120000) — o "Seu preenchimento" da aba Minhas
-- A tela faz o mesmo corte (`ehConsultorio`, src/lib/escalaHorarioPendente.js).
--
-- Rollback: scripts/rollback-20261016150000-consultorio-sem-horario.sql
-- ════════════════════════════════════════════════════════════════════════════

begin;

create or replace function public.escala_caso_trava_liberacao(
  p_procedimento text, p_anestesista text, p_sem_anestesista boolean, p_is_continuacao boolean,
  p_status text, p_extra text, p_inicio text, p_termino text
)
returns boolean
language sql
immutable
set search_path = pg_catalog, public
as $$
  select btrim(coalesce(p_procedimento, '')) <> ''
     and coalesce(p_procedimento, '') !~* 'consult'  -- consultório tem horário definido (16/10)
     and coalesce(p_anestesista, '') not like '%+%'
     and not coalesce(p_sem_anestesista, false)
     and not coalesce(p_is_continuacao, false)
     and coalesce(p_status, 'agendada') <> 'suspensa'
     and coalesce(p_extra, '') <> 'suspensa'
     and (
       (coalesce(p_status, 'agendada') <> 'terminada' and coalesce(p_extra, '') <> 'passa_tarde')
       or (p_status = 'terminada' and (p_inicio is null or p_termino is null))
     )
$$;

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

  with base as (
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
      and not coalesce(c.is_continuacao, false)
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
    select t.*,
           case when t.ini is null and t.ter is null then 'ambos'
                when t.ini is null then 'ini'
                else 'ter' end as falta
    from comturno t
    where (t.ini is null or t.ter is null)
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

  with casos as (
    select c.anestesista_user_id as uid,
           (c.inicio_real is not null and c.termino_real is not null) as ok
      from public.escala_cirurgica_caso c
      join public.escala_cirurgica e on e.id = c.escala_id
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

-- Conferência visível para quem aplica:
select position('consult' in pg_get_functiondef('public.escala_caso_trava_liberacao'::regproc)) > 0 as trava,
       position('consultório tem horário definido' in pg_get_functiondef('public.escala_horario_pendente_relatorio'::regproc)) > 0 as relatorio,
       position('consultório tem horário definido' in pg_get_functiondef('public.escala_meu_preenchimento'::regproc)) > 0 as meu;

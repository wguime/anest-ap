-- ════════════════════════════════════════════════════════════════════════════
-- Escala cirúrgica — A CONTINUAÇÃO HERDA O TÉRMINO (dono 2026-10-27, 19:52).
--
-- No HRO, a microcirurgia da Sala 1 estava com o Guilherme Melo, "Iniciada · Passa para
-- tarde". A escala da tarde pôs a continuação com a Fernanda, que marcou o card dela
-- 13:00→13:32. Mesmo assim, o "Falta término" seguia no nome dele. O dono: "quero que essa
-- herança de não ter marcado o término fique com quem realmente estava com a cirurgia [...]
-- nos casos de continuação o procedimento será 'passado' com a publicação da nova escala".
--
-- O card da manhã ainda ABERTO e a linha "CONTINUAÇÃO" da tarde são UMA cirurgia em dois
-- cards: o horário de qualquer um vale para ela. Com OUTRA pessoa na continuação, o início é
-- de quem começou e o término de quem continuou. Com a mesma pessoa, nada passa (a tela já
-- mostra um card só). A tela faz a mesma conta (`paresDeContinuacao`/`faltaNoPar`,
-- src/lib/escalaHorarioPendente.js), com o mesmo par:
--   mesma escala, MESMA SALA, cirurgião compatível (um em branco ou um nome em comum);
--   entre vários: mais nomes em comum, depois "Passa para tarde", depois o último da sala.
--
-- Três funções novas, duas reescritas (o resto do corpo é idêntico a 20261016150000):
--   escala_nomes_cirurgiao / escala_pessoas_caso / escala_pares_continuacao  (novas)
--   escala_horario_pendente_relatorio — o relatório de adesão
--   escala_meu_preenchimento          — o "Seu preenchimento" da aba Minhas
-- A trava da liberação NÃO muda (continuação segue fora dela).
--
-- Rollback: scripts/rollback-20261027220000-continuacao-herda-termino.sql
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- Os nomes de um cirurgião para o casamento: sem acento, em maiúsculas, só letras, com 3+
-- letras e sem "DAS/DOS/DEL" (lib: nomesDoCirurgiao). Independe do locale do banco; o NFC
-- junta o acento decomposto antes do translate (o JS tira o acento de qualquer forma).
create or replace function public.escala_nomes_cirurgiao(p text)
returns text[]
language sql
immutable
set search_path = pg_catalog, public
as $$
  select coalesce(array_agg(distinct t order by t), '{}'::text[])
    from regexp_split_to_table(
           btrim(regexp_replace(
             upper(translate(normalize(coalesce(p, ''), NFC), 'áàâãäåéèêëíìîïóòôõöúùûüçñýÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑÝ', 'aaaaaaeeeeiiiiooooouuuucnyAAAAAAEEEEIIIIOOOOOUUUUCNY')),
             '[^ABCDEFGHIJKLMNOPQRSTUVWXYZ]+', ' ', 'g')),
           ' ') as t
   where length(t) >= 3 and t not in ('DAS', 'DOS', 'DEL')
$$;

-- As pessoas do caso ("A + B" = duas; "//", vazio e "?" não são pessoa), sem acento, em
-- maiúsculas e em ordem de código (lib: mesmaGente).
create or replace function public.escala_pessoas_caso(p text)
returns text[]
language sql
immutable
set search_path = pg_catalog, public
as $$
  select coalesce(array_agg(n order by n collate "C"), '{}'::text[])
    from (
      select btrim(regexp_replace(upper(translate(normalize(btrim(s), NFC), 'áàâãäåéèêëíìîïóòôõöúùûüçñýÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑÝ', 'aaaaaaeeeeiiiiooooouuuucnyAAAAAAEEEEIIIIOOOOOUUUUCNY')), '\s+', ' ', 'g')) as n
        from regexp_split_to_table(coalesce(p, ''), '\s*\+\s*') as s
       where btrim(s) not in ('', '//') and btrim(s) !~ '^\?+$'
    ) x
$$;

-- Os pares manhã × continuação das escalas publicadas do período (lib: paresDeContinuacao).
-- `herda` = outra pessoa na continuação: ela leva o término.
create or replace function public.escala_pares_continuacao(p_desde date, p_ate date)
returns table (continuacao_id uuid, origem_id uuid, herda boolean)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with casos as (
    select c.id, c.escala_id, c.ordem,
           coalesce(c.status_extra, '') as extra,
           coalesce(c.is_continuacao, false) as is_cont,
           coalesce(c.status_cirurgia, 'agendada') as status,
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
       -- a terminada que não é continuação não entra no par por nenhum dos lados
       and (coalesce(c.is_continuacao, false) or coalesce(c.status_cirurgia, 'agendada') <> 'terminada')
  )
  select k.id, o.id,
         not (case when cardinality(k.pessoas) = 1 and cardinality(o.pessoas) = 1
                        and k.uid is not null and o.uid is not null
                   then k.uid = o.uid
                   else k.pessoas = o.pessoas end)
    from casos k
    cross join lateral (
      select m.id, m.pessoas, m.uid
        from casos m
       where m.escala_id = k.escala_id
         and not m.is_cont and m.turno = 'matutino' and m.status <> 'terminada'
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
$$;

revoke execute on function public.escala_pares_continuacao(date, date) from public, anon, authenticated;
grant execute on function public.escala_pares_continuacao(date, date) to service_role;
-- os dois de normalizar não leem dado nenhum, mas não precisam ficar em /rest/v1/rpc
revoke execute on function public.escala_nomes_cirurgiao(text) from public, anon, authenticated;
revoke execute on function public.escala_pessoas_caso(text) from public, anon, authenticated;

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

commit;

-- Conferência visível para quem aplica:
select position('escala_pares_continuacao' in pg_get_functiondef('public.escala_horario_pendente_relatorio'::regproc)) > 0 as relatorio,
       position('escala_pares_continuacao' in pg_get_functiondef('public.escala_meu_preenchimento'::regproc)) > 0 as meu,
       public.escala_nomes_cirurgiao('Marcelo da Cunha Vieira') = array['CUNHA', 'MARCELO', 'VIEIRA'] as nomes,
       public.escala_pessoas_caso('erlei + Alexandre D') = array['ALEXANDRE D', 'ERLEI'] as pessoas;

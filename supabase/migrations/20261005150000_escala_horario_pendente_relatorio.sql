-- ============================================================================
-- Horário NÃO preenchido no dia — dados do relatório de adesão (dono 2026-10-05)
-- ============================================================================
-- Pedido do dono: o alerta público da cirurgia sem início/término "deve durar o dia todo;
-- se não for preenchido durante o dia, quero que crie um relatório e incorpore ao
-- relatório de adesão à escala cirúrgica na página home".
--
-- O alerta da tela (src/lib/escalaHorarioPendente.js) vale para o DIA OPERACIONAL — que
-- vira às 07:00 (dono 23/09). Esta função devolve o que ficou para trás: as cirurgias dos
-- dias JÁ ENCERRADOS que seguem sem início ou sem término. Mesmos cortes da lib
-- (`casoEntraNaConta`, `faltaHorario`, `turnoDoCasoHorario`, `dentroDoInicioDoAlerta`):
--   • escala publicada de hospital (a linha 'fds' da fila única não tem cirurgias);
--   • com procedimento, com anestesista de verdade ("?" e "//" não são pessoa; na dupla
--     "A + B" basta uma parte real);
--   • não suspensa (não aconteceu), não continuação (a da tarde herda o caso da manhã —
--     a mesma cirurgia não conta duas vezes, como na cobrança);
--   • a partir da TARDE de 05/10/2026 (dono: "comece a contar a partir de hoje à tarde").
--
-- Calculado AO VIVO, sem tabela: depois da virada não há caminho no app para preencher o
-- horário de um dia anterior (a tela só mostra hoje/amanhã e o alerta só o dia), então o
-- que está vazio agora é o que ficou vazio no dia.
--
-- Janela: `p_desde`/`p_ate` (as abas do relatório: 30 dias, 60 dias, mês). Sem eles,
-- os últimos 30 dias encerrados. O fim nunca passa do último dia ENCERRADO (o de hoje
-- ainda está no alerta) e a janela tem no máximo 62 dias. ⚠️ O "dia encerrado" daqui
-- vira às 07:00 — NÃO é o `escala_adesao_ultimo_dia()` (17h com a escala de amanhã
-- publicada); os dois períodos não se somam.
--
-- Sem dado de paciente (nem iniciais, nem idade). Devolve o procedimento por caso, então o
-- acesso é o MESMO da escala (`can_write_escala_cirurgica()`, a RLS de
-- escala_cirurgica_caso) — não o "todos os ativos" dos agregados de adesão. A identidade
-- do anestesista volta crua (apelido + uid) e o cliente resolve o nome pelo mesmo
-- dicionário do alerta — uma regra só para tela e relatório.
--
-- Validada pelo migration-validator em 05/10 (sem bloqueante; gate, cast da hora e o
-- corte do "?"/"//" ajustados conforme o parecer).
-- Rollback: drop function if exists public.escala_horario_pendente_relatorio(date, date);
--   (reverter o cliente ANTES — sem a função, a seção recebe PGRST202). Não grava nada.
-- Idempotente.

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

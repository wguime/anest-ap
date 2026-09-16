-- ============================================================================
-- Realtime por BROADCAST (sinal + busca por chave) no lugar de postgres_changes
-- ============================================================================
-- Por quê: `postgres_changes` faz o Realtime CONSULTAR o WAL a cada ~100 ms
-- enquanto houver um assinante em qualquer tabela (realtime.list_changes, RLS
-- avaliada por assinante). Medido em pg_stat_statements desde 08/02/2026: 59 %
-- de todo o tempo de CPU do banco; 10–39 s por rodada em 16/09, quando o
-- compute Nano (plano free) saturou na troca de turno. Broadcast "do banco" é
-- push: este trigger insere em realtime.messages e o Realtime entrega.
--
-- O que sai no sinal: { table, op, pk, chaves, antes } — NUNCA a linha. O canal
-- entrega a mesma mensagem a todo assinante do tópico, e a RLS da tabela
-- (notificação só do destinatário, incidente só do responsável, documento por
-- sigilo) não vale dentro dele. O cliente busca a linha pela PK via PostgREST,
-- onde a RLS vale (src/services/supabaseSubscriptionHelper.js).
--   pk     = colunas da chave primária (argumentos do trigger)
--   chaves = escala_id, data, hospital, turno, status quando existirem (o que a
--            escala usa para saber se o evento é da tela; nada pessoal)
--   antes  = status anterior em UPDATE (fila de aprovação de documentos)
--
-- Tópicos: t:<tabela> para todos os autenticados; u:<tabela>:<uid> nas tabelas
-- de escopo pessoal (notifications, messages — dois lados —,
-- incident_notification_settings). A policy de realtime.messages abaixo é a
-- única que existe na tabela (RLS ligada, zero policies antes).
--
-- Transição: as tabelas CONTINUAM na publication supabase_realtime até o
-- bundle novo estar em todos os clientes (o antigo ainda assina
-- postgres_changes). Tirar da publication é migration posterior.
-- ============================================================================

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- ── 1. Função de sinal ──────────────────────────────────────────────────────
-- SECURITY DEFINER: realtime.send NÃO é definer e engole erro de RLS como
-- WARNING (falharia em silêncio rodando como `authenticated`); como `postgres`
-- (BYPASSRLS) o insert em realtime.messages sempre entra.
create or replace function public.rt_sinal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  linha    jsonb;
  pk       jsonb := '{}'::jsonb;
  chaves   jsonb;
  antes    jsonb := null;
  destinos text[];
  topico   text;
  col      text;
begin
  -- Tudo dentro de um bloco próprio: o sinal NUNCA derruba a escrita clínica.
  -- realtime.send já engole o próprio erro; isto cobre o resto (função
  -- renomeada por atualização do Realtime, grant revogado, …): WARNING e segue.
  begin
  linha := case when TG_OP = 'DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end;

  -- colunas da PK vêm como argumentos do CREATE TRIGGER (tabelas sem `id`)
  if TG_NARGS > 0 then
    foreach col in array TG_ARGV loop
      pk := pk || jsonb_build_object(col, linha -> col);
    end loop;
  else
    pk := jsonb_build_object('id', linha -> 'id');
  end if;

  chaves := jsonb_strip_nulls(jsonb_build_object(
    'escala_id', linha -> 'escala_id',
    'data',      linha -> 'data',
    'hospital',  linha -> 'hospital',
    'turno',     linha -> 'turno',
    'status',    linha -> 'status'
  ));
  if TG_OP = 'UPDATE' then
    -- nullif: tabela sem coluna status → antes = null, não '{}'
    antes := nullif(jsonb_strip_nulls(jsonb_build_object('status', to_jsonb(OLD) -> 'status')), '{}'::jsonb);
  end if;

  -- tópico: pessoal nas tabelas de escopo pessoal, senão o da tabela
  destinos := case TG_TABLE_NAME
    when 'notifications' then array['u:notifications:' || coalesce(linha ->> 'recipient_id', '')]
    when 'messages' then array[
      'u:messages:' || coalesce(linha ->> 'sender_id', ''),
      'u:messages:' || coalesce(linha ->> 'recipient_id', '')
    ]
    when 'incident_notification_settings' then array['u:incident_notification_settings:' || coalesce(linha ->> 'user_id', '')]
    -- incidentes: o canal t: é só de responsáveis (policy abaixo); o autor de um
    -- relato identificado acompanha o seu pelo tópico pessoal (anônimo: user_id
    -- nulo → tópico vazio, descartado no filtro `:$`)
    when 'incidentes' then array['t:incidentes', 'u:incidentes:' || coalesce(linha ->> 'user_id', '')]
    else array['t:' || TG_TABLE_NAME]
  end;

  for topico in select distinct t from unnest(destinos) as t where t !~ ':$' loop
    perform realtime.send(
      jsonb_build_object('table', TG_TABLE_NAME, 'op', TG_OP, 'pk', pk, 'chaves', chaves, 'antes', antes),
      'sinal',
      topico,
      true
    );
  end loop;
  exception when others then
    raise warning 'rt_sinal %.% %: % (%)', TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP, sqlerrm, sqlstate;
  end;
  return null;
end;
$$;

comment on function public.rt_sinal() is
  'Trigger AFTER de linha: emite um SINAL de mudança (sem a linha) por Broadcast do Realtime. Ver supabaseSubscriptionHelper.js.';

-- ── 2. Triggers nas tabelas hoje na publication (paridade com postgres_changes) ──
-- As 9 tabelas que o app assina mas NUNCA estiveram na publication (documentos,
-- comunicados, planos_acao, autoavaliacao_rop, auditoria_execucoes,
-- kpi_dados_mensais, documento_conflict_queue, lgpd_solicitacoes,
-- documento_changelog) ficam de fora de propósito: ligá-las agora ativaria
-- caminhos de código que nunca rodaram em produção. Decisão à parte.
do $$
declare
  alvo record;
begin
  for alvo in
    select * from (values
      ('escala_cirurgica',                   array['id']),
      ('escala_cirurgica_caso',              array['id']),
      ('escala_plantao_p4_diario',           array['data']),
      ('escala_cirurgica_aviso',             array['id']),
      ('escala_cirurgica_aviso_confirmacao', array['aviso_id', 'user_id']),
      ('cateteres_peridural',                array['id']),
      ('cirurgias_particulares',             array['id']),
      ('incidentes',                         array['id']),
      ('incident_notification_settings',     array['user_id']),
      ('notifications',                      array['id']),
      ('messages',                           array['id']),
      ('profiles',                           array['id']),
      ('authorized_emails',                  array['email'])
    ) as t(tabela, pk)
  loop
    if to_regclass('public.' || alvo.tabela) is null then
      raise notice 'rt_sinal: tabela public.% não existe — pulada', alvo.tabela;
      continue;
    end if;
    execute format('drop trigger if exists tr_rt_sinal on public.%I', alvo.tabela);
    execute format(
      'create trigger tr_rt_sinal after insert or update or delete on public.%I for each row execute function public.rt_sinal(%s)',
      alvo.tabela,
      (select string_agg(quote_literal(c), ', ') from unnest(alvo.pk) as c)
    );
  end loop;
end $$;

-- ── 3. Quem pode entrar em cada tópico (RLS de realtime.messages) ──────────
-- O Realtime autoriza o JOIN de canal privado rodando esta policy com as
-- claims do JWT do usuário e realtime.topic() = tópico pedido. t:* é de todo
-- autenticado (o sinal não tem dado pessoal), EXCETO t:incidentes: existência
-- e status de um relato/denúncia só chegam a quem a RLS da tabela já deixa ver
-- (responsável por incidente ou denúncia); u:* só do próprio uid.
drop policy if exists rt_sinal_select on realtime.messages;
create policy rt_sinal_select on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (
      ((select realtime.topic()) like 't:%' and (select realtime.topic()) <> 't:incidentes')
      or ((select realtime.topic()) = 't:incidentes'
          and ((select public.is_incident_responsible('incidente'))
            or (select public.is_incident_responsible('denuncia'))))
      or (select realtime.topic()) = any (array[
        'u:notifications:'                  || (select public.firebase_uid()),
        'u:messages:'                       || (select public.firebase_uid()),
        'u:incident_notification_settings:' || (select public.firebase_uid()),
        'u:incidentes:'                     || (select public.firebase_uid())
      ])
    )
  );

-- ============================================================================
-- ROLLBACK (manual, se precisar)
-- ============================================================================
-- drop policy if exists rt_sinal_select on realtime.messages;
-- do $$ declare t text; begin
--   foreach t in array array['escala_cirurgica','escala_cirurgica_caso','escala_plantao_p4_diario',
--     'escala_cirurgica_aviso','escala_cirurgica_aviso_confirmacao','cateteres_peridural',
--     'cirurgias_particulares','incidentes','incident_notification_settings','notifications',
--     'messages','profiles','authorized_emails'] loop
--     execute format('drop trigger if exists tr_rt_sinal on public.%I', t);
--   end loop; end $$;
-- drop function if exists public.rt_sinal();

-- ============================================================================
-- Realtime: tirar as 13 tabelas da publication supabase_realtime
-- ============================================================================
-- Fecha a transição iniciada em 20260916203000_realtime_broadcast_sinal.sql:
-- o app assina Broadcast (trigger tr_rt_sinal → realtime.send) e NÃO usa mais
-- postgres_changes. Enquanto uma tabela estiver na publication e houver UM
-- assinante postgres_changes em qualquer cliente, o Realtime consulta o WAL a
-- cada ~100 ms (realtime.list_changes = 59 % do tempo de CPU do banco desde
-- 08/02, medido em pg_stat_statements). Sem tabelas na publication, um cliente
-- antigo que ainda assine não custa mais o `apply_rls` por assinante e por
-- linha (era esse o custo real): o wal2json filtra tudo por `add-tables` vazio.
--
-- Condição do dono (16/09): só depois de as assinaturas antigas zerarem.
-- Conferido em 16/09 21h30 local: `select count(*) from realtime.subscription`
-- = 0 (o bundle novo está em todos os clientes conectados). O bloco abaixo
-- RECUSA rodar se ainda houver assinante — a condição vira código.
--
-- A publication em si FICA (o Realtime do Supabase espera que exista; o
-- `supabase_realtime_admin` a usa como raiz). Só as tabelas saem. Idempotente:
-- cada tabela só é retirada se ainda estiver lá.
-- ============================================================================

-- Tetos de espera (mesmo padrão das migrations de 16/09): o DROP TABLE pega
-- SHARE UPDATE EXCLUSIVE em cada tabela e esperaria um autovacuum em curso.
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
declare
  assinantes int;
  t text;
begin
  select count(*) into assinantes from realtime.subscription;
  if assinantes > 0 then
    raise exception 'realtime.subscription ainda tem % assinante(s) postgres_changes — tirar as tabelas agora deixaria esses clientes sem evento. Repetir quando zerar.', assinantes;
  end if;

  foreach t in array array[
    'authorized_emails', 'cateteres_peridural', 'cirurgias_particulares',
    'escala_cirurgica', 'escala_cirurgica_aviso', 'escala_cirurgica_aviso_confirmacao',
    'escala_cirurgica_caso', 'escala_plantao_p4_diario', 'incident_notification_settings',
    'incidentes', 'messages', 'notifications', 'profiles'
  ] loop
    if exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime drop table public.%I', t);
    end if;
  end loop;
end $$;

-- ── Rollback (manual, idempotente) ─────────────────────────────────────────
-- Devolve a membresia; NÃO devolve evento ao vivo (o app não assina
-- postgres_changes desde 20260916203000).
-- do $$
-- declare t text;
-- begin
--   foreach t in array array['authorized_emails','cateteres_peridural','cirurgias_particulares',
--     'escala_cirurgica','escala_cirurgica_aviso','escala_cirurgica_aviso_confirmacao',
--     'escala_cirurgica_caso','escala_plantao_p4_diario','incident_notification_settings',
--     'incidentes','messages','notifications','profiles'] loop
--     if not exists (select 1 from pg_publication_tables
--                    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
--       execute format('alter publication supabase_realtime add table public.%I', t);
--     end if;
--   end loop;
-- end $$;

-- ============================================================================
-- incident_notification_settings: replica identity volta ao padrão (PK)
-- ============================================================================
-- `REPLICA IDENTITY FULL` foi posto em 20260512200000_incident_settings_realtime
-- para o DELETE do postgres_changes trazer a linha antiga. Desde 20260916203000
-- o app recebe Broadcast do trigger tr_rt_sinal (que usa o OLD do trigger, não
-- a replica identity) e, desde 20260917003000, a tabela nem está mais na
-- publication. Com FULL, cada UPDATE/DELETE grava a linha antiga inteira no WAL
-- (wal_level = logical) sem ninguém consumir. Apontado pelo migration-validator
-- em 17/09 como peso morto — único caso em `public` (conferido: relreplident='f').
-- Idempotente: só altera se ainda estiver em FULL. A PK (user_id) passa a ser a
-- identidade, como nas demais tabelas.
-- ============================================================================

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
begin
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'incident_notification_settings' and c.relreplident = 'f'
  ) then
    alter table public.incident_notification_settings replica identity default;
  end if;
end $$;

-- ── Rollback (manual) ───────────────────────────────────────────────────────
-- alter table public.incident_notification_settings replica identity full;

-- ============================================================================
-- Migration: LGPD Art. 15 — Política de retenção para incidentes/denúncias
-- Data: 2026-05-04
-- Documento: docs/lgpd-retencao.md
-- DEPENDÊNCIA 1: Comitê de Ética deve ratificar prazos (TODO) antes de aplicar
-- DEPENDÊNCIA 2: aplicar 20260504_lgpd_art12_full_anonimization.sql ANTES
--                (caso contrário, o cron marca anonymized_at mas deixa PII)
-- ============================================================================
--
-- Esta migration:
--   1. Adiciona coluna retain_until em incidentes
--   2. Trigger BEFORE INSERT calcula retain_until por tipo
--   3. Backfill para registros existentes
--   4. Cria função rpc_aplicar_retencao_incidentes()
--   5. Schedule pg_cron (comentado — habilitar manualmente após validação)
--
-- ============================================================================

-- ──────────────────────────────────────────────
-- 1. Coluna de controle
-- ──────────────────────────────────────────────

alter table public.incidentes
  add column if not exists retain_until date;

comment on column public.incidentes.retain_until is
  'Data limite de retenção LGPD Art. 15. Após este prazo, registro é anonimizado por job pg_cron diário (rpc_aplicar_retencao_incidentes). Calculado por tipo: incidente=20a, denuncia=100a (Decreto 10.153/2019).';

create index if not exists idx_incidentes_retain_until
  on public.incidentes(retain_until)
  where anonymized_at is null;

-- ──────────────────────────────────────────────
-- 2. Trigger BEFORE INSERT — calcular retain_until
-- ──────────────────────────────────────────────

create or replace function public.set_retain_until()
returns trigger as $$
begin
  if new.retain_until is null then
    new.retain_until := case
      when new.tipo = 'denuncia'  then (now() + interval '100 years')::date
      when new.tipo = 'incidente' then (now() + interval  '20 years')::date
      else                              (now() + interval  '20 years')::date
    end;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists tr_incidentes_retain_until on public.incidentes;
create trigger tr_incidentes_retain_until
  before insert on public.incidentes
  for each row
  execute function public.set_retain_until();

-- ──────────────────────────────────────────────
-- 3. Backfill — registros existentes
-- ──────────────────────────────────────────────

update public.incidentes
set retain_until = case
  when tipo = 'denuncia'  then (created_at + interval '100 years')::date
  when tipo = 'incidente' then (created_at + interval  '20 years')::date
  else                          (created_at + interval  '20 years')::date
end
where retain_until is null;

-- Tornar NOT NULL após backfill
alter table public.incidentes
  alter column retain_until set not null;

-- ──────────────────────────────────────────────
-- 4. Função: aplicar retenção (chamada pelo cron)
-- ──────────────────────────────────────────────

create or replace function public.rpc_aplicar_retencao_incidentes()
returns table(processed_count integer, incidentes_anon integer, denuncias_anon integer)
as $$
declare
  v_inc_count integer := 0;
  v_den_count integer := 0;
  rec record;
begin
  -- Iterar registros vencidos
  for rec in
    select id, tipo
    from public.incidentes
    where retain_until < current_date
      and anonymized_at is null
    limit 1000  -- proteção contra long-running em primeira execução pós-backfill
  loop
    perform public.rpc_anonimizar_incidente(rec.id);

    if rec.tipo = 'denuncia' then
      v_den_count := v_den_count + 1;
    else
      v_inc_count := v_inc_count + 1;
    end if;
  end loop;

  -- Audit log da execução do job
  if (v_inc_count + v_den_count) > 0 then
    insert into public.permission_audit_log (
      user_id, action, resource_type, details, created_at
    ) values (
      'system_cron',
      'lgpd_retencao_aplicada',
      'incidentes',
      jsonb_build_object(
        'incidentes_anonimizados', v_inc_count,
        'denuncias_anonimizadas',  v_den_count,
        'data_execucao', current_date,
        'base_legal', 'LGPD Art. 15 + CFM 1.821/2007 + Decreto 10.153/2019'
      ),
      now()
    );
  end if;

  processed_count := v_inc_count + v_den_count;
  incidentes_anon := v_inc_count;
  denuncias_anon  := v_den_count;
  return next;
end;
$$ language plpgsql security definer set search_path = '';

comment on function public.rpc_aplicar_retencao_incidentes is
  'Aplica política de retenção LGPD Art. 15 sobre tabela incidentes. Invocada por pg_cron diariamente às 03:00 UTC. Documentação: docs/lgpd-retencao.md';

-- ──────────────────────────────────────────────
-- 5. Schedule pg_cron (DESCOMENTAR APÓS VALIDAÇÃO DO COMITÊ DE ÉTICA)
-- ──────────────────────────────────────────────
-- IMPORTANTE: extensão pg_cron deve estar habilitada.
-- Não habilitar este schedule até que:
--   1. Comitê de Ética ratifique prazos em ata
--   2. 20260504_lgpd_art12_full_anonimization.sql esteja aplicada
--   3. Backfill seja executado em produção

-- select cron.schedule(
--   'lgpd-retencao-incidentes',
--   '0 3 * * *',  -- diariamente às 03:00 UTC (00:00 BRT)
--   $$ select public.rpc_aplicar_retencao_incidentes(); $$
-- );

-- Para verificar agendamento:
--   select * from cron.job where jobname = 'lgpd-retencao-incidentes';
-- Para remover:
--   select cron.unschedule('lgpd-retencao-incidentes');

-- ──────────────────────────────────────────────
-- 6. TODOs apontados pela auditoria (não fechados nesta migration)
-- ──────────────────────────────────────────────
-- TODO: Implementar exclusão de attachments no Storage (loop sobre `attachments`
--       JSONB e DELETE no bucket).
-- TODO: Adicionar coluna lgpd_consent_version (apontado em auditoria, Art. 8).
-- TODO: Avaliar migrar Supabase para sa-east-1 para reduzir transferência
--       internacional (LGPD Art. 33).

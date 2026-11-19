-- Rollback de supabase/migrations/20261119210000_escala_motivo_retencao.sql
-- Tira o expurgo e a agenda e devolve o gatilho do autor ao corpo de 20261119180000.
-- O que o expurgo já trocou por "Outro" não volta (é o propósito da retenção). O rótulo
-- "Cirurgião atrasado" dos casos já gravados fica (o app antigo só não o oferece como chip).

begin;
set local lock_timeout = '3s';

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('escala-caso-motivo-purge')
      from cron.job where jobname = 'escala-caso-motivo-purge';
  end if;
end;
$$;
drop function if exists public.escala_caso_motivo_purge();

create or replace function public.escala_caso_motivo_por()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_quem text := coalesce(nullif(public.firebase_uid(), ''), new.status_atualizado_por);
  v_publicando boolean := coalesce(current_setting('anest.publicacao', true), '') = '1';
begin
  if tg_op = 'INSERT' then
    if v_publicando then return new; end if;
    new.motivo_suspensao_por := case when new.motivo_suspensao is null then null else v_quem end;
    new.motivo_atraso_por := case when new.motivo_atraso is null then null else v_quem end;
    return new;
  end if;
  if new.motivo_suspensao is distinct from old.motivo_suspensao then
    new.motivo_suspensao_por := case when new.motivo_suspensao is null then null else v_quem end;
  else
    new.motivo_suspensao_por := old.motivo_suspensao_por;
  end if;
  if new.motivo_atraso is distinct from old.motivo_atraso then
    new.motivo_atraso_por := case when new.motivo_atraso is null then null else v_quem end;
  else
    new.motivo_atraso_por := old.motivo_atraso_por;
  end if;
  return new;
end;
$$;
revoke execute on function public.escala_caso_motivo_por() from public, anon, authenticated;

commit;

select to_regprocedure('public.escala_caso_motivo_purge()') is null as sem_purge;

-- ============================================================================
-- Escala Cirúrgica — novos status de caso: suspensa, atrasada, passa_tarde
--
-- Pedido do dono (2026-07-20): além de agendada/iniciada/terminada, o detalhe
-- do caso ganha Suspensa (não vai acontecer), Atrasada (vai, mas atrasou) e
-- Passa p/ tarde (reagendada p/ o turno da tarde — sinalizada na aba Liberações).
--
-- Amplia o CHECK da coluna + a whitelist da RPC (idempotente).
-- O trigger de eventos (20260718100000) registra as novas transições sem
-- nenhuma mudança: ele loga qualquer status_de → status_para.
-- ============================================================================

begin;

-- CHECK da coluna (nome confirmado em prod): sem isto os status novos tomam
-- 23514 em runtime mesmo com a RPC liberada.
alter table public.escala_cirurgica_caso
  drop constraint if exists escala_cirurgica_caso_status_cirurgia_check;
alter table public.escala_cirurgica_caso
  add constraint escala_cirurgica_caso_status_cirurgia_check
  check (status_cirurgia in ('agendada', 'iniciada', 'terminada', 'suspensa', 'atrasada', 'passa_tarde'));

create or replace function public.rpc_escala_status_cirurgia(
  p_caso_id uuid,
  p_status  text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_caller text := public.firebase_uid();
begin
  if v_caller = '' then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  if not public.can_write_escala_cirurgica() then
    raise exception 'permission_denied: sem acesso à escala cirúrgica' using errcode = '42501';
  end if;
  if p_status not in ('agendada', 'iniciada', 'terminada', 'suspensa', 'atrasada', 'passa_tarde') then
    raise exception 'status_invalido: %', p_status;
  end if;

  update public.escala_cirurgica_caso
     set status_cirurgia      = p_status,
         status_atualizado_por = v_caller,
         status_atualizado_em  = now(),
         updated_at            = now()
   where id = p_caso_id;

  if not found then
    raise exception 'caso_nao_encontrado';
  end if;
end;
$$;

comment on column public.escala_cirurgica_caso.status_cirurgia is
  'Andamento do caso no dia: agendada → iniciada → terminada; ou suspensa (cancelado), atrasada, passa_tarde (reagendado p/ o turno da tarde). Atualizável por qualquer clínico; audit em status_atualizado_por/em (carimbado pela RPC).';

-- Defensivo: se a função tiver sido dropada fora do fluxo, o replace recriaria
-- com EXECUTE p/ PUBLIC (default de functions) — re-afirma a ACL da original.
revoke execute on function public.rpc_escala_status_cirurgia(uuid, text) from public, anon;
grant execute on function public.rpc_escala_status_cirurgia(uuid, text) to authenticated, service_role;

commit;

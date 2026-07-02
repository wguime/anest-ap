-- ════════════════════════════════════════════════════════════════════════
-- 20260701200000_escala_status_cirurgia.sql
-- Escala Cirúrgica F1.5 — status da cirurgia por caso (pedido do dono):
--   agendada (default) → iniciada (sala ocupada, vermelho) → terminada (verde).
-- Qualquer clínico atualiza (RLS UPDATE de escala_cirurgica_caso já cobre os
-- papéis; realtime já publica a tabela). Audit: quem/quando mudou o status.
--
-- ⚠️ Conhecido e aceito: republicar a escala (rpc_salvar = delete+insert dos
-- casos) zera os statuses do dia — a conferência acontece antes das 13h.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

alter table public.escala_cirurgica_caso
  add column if not exists status_cirurgia text not null default 'agendada'
    check (status_cirurgia in ('agendada', 'iniciada', 'terminada')),
  add column if not exists status_atualizado_por text,
  add column if not exists status_atualizado_em  timestamptz;

comment on column public.escala_cirurgica_caso.status_cirurgia is
  'Andamento do caso no dia: agendada → iniciada → terminada. Atualizável por qualquer clínico; audit em status_atualizado_por/em (carimbado pela RPC).';

-- RPC de patch do status — SECURITY DEFINER com audit carimbado server-side
-- (mesma regra das demais RPCs do módulo: o ator NUNCA vem do cliente).
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
  if p_status not in ('agendada', 'iniciada', 'terminada') then
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

revoke execute on function public.rpc_escala_status_cirurgia(uuid, text) from public, anon;
grant execute on function public.rpc_escala_status_cirurgia(uuid, text) to authenticated, service_role;

COMMIT;

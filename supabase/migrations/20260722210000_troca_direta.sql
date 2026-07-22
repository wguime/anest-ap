-- ════════════════════════════════════════════════════════════════════════
-- 20260722210000_troca_direta.sql
-- Decisão do dono (2026-07-22, feedback do 1º dia com o grupo): o fluxo
-- propor→aceitar ficou engessado/confuso no dia a dia. Troca de sala passa a
-- ser DIRETA: o próprio solicitante aplica (a UI cria a proposta e aplica na
-- sequência); os envolvidos são NOTIFICADOS (sino + aviso na aba Minhas), sem
-- etapa de confirmação.
--
-- Mudança única: o guard do aceite passa a permitir também o SOLICITANTE
-- (uid_a) — antes só alvo (uid_b) ou coordenador. Todo o resto preservado:
-- ator = firebase_uid() do servidor (nunca parâmetro), lock FOR UPDATE, swap
-- atômico das duas salas, guard troca_obsoleta.
--
-- Idempotente (CREATE OR REPLACE). Rollback: reaplicar a versão de
-- 20260628200000 (guard só uid_b/coordenador).
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.aplicar_troca_cirurgica(p_troca_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v public.trocas_cirurgicas;
  v_caller text := public.firebase_uid();
  n_a int;
  n_b int;
begin
  if v_caller = '' then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;

  select * into v from public.trocas_cirurgicas where id = p_troca_id for update;
  if not found then raise exception 'troca_nao_encontrada'; end if;
  if v.status <> 'pendente' then raise exception 'troca_nao_pendente'; end if;
  -- Troca direta: qualquer um dos DOIS envolvidos aplica (ou coordenador/admin)
  if v_caller not in (v.uid_a, v.uid_b) and not public.can_manage_alias_escala() then
    raise exception 'nao_autorizado' using errcode = '42501';
  end if;

  update public.escala_cirurgica_caso
     set anestesista = v.alias_b, anestesista_user_id = v.uid_b, updated_at = now()
   where escala_id = v.escala_id and sala = v.sala_a and anestesista_user_id = v.uid_a;
  get diagnostics n_a = row_count;

  update public.escala_cirurgica_caso
     set anestesista = v.alias_a, anestesista_user_id = v.uid_a, updated_at = now()
   where escala_id = v.escala_id and sala = v.sala_b and anestesista_user_id = v.uid_b;
  get diagnostics n_b = row_count;

  if n_a = 0 or n_b = 0 then
    raise exception 'troca_obsoleta' using errcode = 'P0001';
  end if;

  update public.trocas_cirurgicas
     set status = 'aceita', respondido_por = v_caller,
         respondido_em = now(), aplicada_em = now(), updated_at = now()
   where id = p_troca_id;
end;
$$;

revoke execute on function public.aplicar_troca_cirurgica(uuid) from public, anon;
grant execute on function public.aplicar_troca_cirurgica(uuid) to authenticated, service_role;

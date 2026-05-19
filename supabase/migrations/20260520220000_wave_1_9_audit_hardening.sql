-- ============================================================================
-- Wave 1.9 hotfix — Hardening pós-audit Security
-- ============================================================================
-- Endereça MED-3 (firebase_uid REVOKE FROM PUBLIC) e MED-4 (WORM trigger
-- adicional `current_user` check) do security-reviewer da Wave 1.9.
--
-- Idempotente. Rollback safe (REVOKE/GRANT são commutativos).
-- ============================================================================

-- MED-3: REVOKE EXECUTE FROM PUBLIC antes do GRANT explícito.
-- CREATE OR REPLACE pode preservar grants antigos de migrations passadas;
-- REVOKE garante baseline limpo antes do GRANT controlado.
revoke execute on function public.firebase_uid() from public;
grant execute on function public.firebase_uid() to authenticated, anon, service_role;

comment on function public.firebase_uid() is
  'Wave 1.9 hardened: SECURITY DEFINER + set search_path = pg_catalog, public. '
  'Owner esperado em prod: postgres (Supabase default superuser). '
  'Apenas lê current_setting(request.jwt.claims), sem queries em tabela. '
  'Granted: authenticated, anon, service_role. REVOKED from public.';

-- MED-4: WORM trigger com defense-in-depth — current_user também checado.
-- Em Supabase Postgres, current_setting('role', true) pode ser modificado via
-- `SET LOCAL role = ...`. current_user reflete o role efetivo da conexão,
-- mais difícil de spoofar sem privilégio SUPERUSER.
create or replace function public.prevent_educ_dl_audit_modification()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  effective_role text;
  setting_role text;
begin
  effective_role := current_user;
  setting_role := coalesce(current_setting('role', true), '');
  -- Permite apenas se AMBOS indicarem service_role (defense-in-depth).
  if (tg_op = 'UPDATE' or tg_op = 'DELETE')
     and effective_role <> 'service_role'
     and setting_role <> 'service_role' then
    raise exception 'educacao_downloads_audit é WORM (append-only). Apenas service_role pode modificar (role=%, setting=%).',
      effective_role, setting_role;
  end if;
  return old;
end;
$$;

-- O trigger original já está em place; CREATE OR REPLACE FUNCTION acima
-- atualiza o body sem precisar DROP TRIGGER.

-- LGPD MED-1: action constraint relaxada para incluir 'cert_backfill' (admin action
-- registrada pela Edge backfill-cert-supabase). Sem isso, admin baixaria PDFs alheios
-- sem rastro — bloqueante LGPD Art. 37.
alter table public.educacao_downloads_audit
  drop constraint if exists educacao_downloads_audit_action_check;
alter table public.educacao_downloads_audit
  add constraint educacao_downloads_audit_action_check
  check (action in ('cert_download_signed', 'cert_backfill'));

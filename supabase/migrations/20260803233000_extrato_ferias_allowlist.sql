-- ════════════════════════════════════════════════════════════════════════
-- 20260803233000_extrato_ferias_allowlist.sql
-- Extrato de Férias — acesso RESTRITO por allowlist de e-mail.
--
-- Decisão do dono (2026-08-03, noite): o extrato deixa de ser de todos os
-- anestesiologistas e passa a ser SÓ de Guilherme Melo (as duas contas —
-- decisão 27/07 de manter ambas), Fernanda Guollo e Leandro Bernardes.
-- Espelha o gate do front (src/pages/ferias/gate.js — EMAILS_EXTRATO_FERIAS).
-- Sem is_admin(): "apenas" essas três pessoas; as contas do dono já estão
-- na lista.
--
-- Idempotente: create or replace.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

create or replace function public.can_access_extrato_ferias()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = public.firebase_uid()
      and p.active is not false
      and lower(trim(coalesce(p.email, ''))) in (
        'wguime@yahoo.com.br',
        'anestesista.guilherme@gmail.com',
        'guollofernanda@gmail.com',
        'leandrobernardes03@hotmail.com'
      )
  );
$$;

comment on function public.can_access_extrato_ferias() is
  'true se o usuário corrente pode ver o Extrato de Férias — allowlist por e-mail: Guilherme Melo (2 contas), Fernanda Guollo e Leandro Bernardes (decisão do dono 2026-08-03). Espelha src/pages/ferias/gate.js; mudar um = mudar o outro.';

COMMIT;

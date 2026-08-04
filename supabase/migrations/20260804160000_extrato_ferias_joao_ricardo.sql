-- ════════════════════════════════════════════════════════════════════════
-- 20260804160000_extrato_ferias_joao_ricardo.sql
-- Extrato de Férias — João Ricardo Moreira entra no allowlist (dono 04/08).
--
-- Atualiza os DOIS espelhos SQL da lista (o terceiro é
-- src/pages/ferias/gate.js, no mesmo commit):
--   can_access_extrato_ferias() → quem VÊ o extrato e o log
--   ferias_nome_socio()         → de quem são as férias que a pessoa marca
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
        'leandrobernardes03@hotmail.com',
        'joaormoreiraster@gmail.com'
      )
  );
$$;

comment on function public.can_access_extrato_ferias() is
  'true se o usuário corrente pode ver o Extrato de Férias — allowlist por e-mail: Guilherme Melo (2 contas), Fernanda Guollo, Leandro Bernardes e João Ricardo Moreira (04/08). Espelha EMAILS_EXTRATO_FERIAS em src/pages/ferias/gate.js; mudar um = mudar o outro.';

create or replace function public.ferias_nome_socio()
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select case lower(trim(coalesce(p.email, '')))
    when 'wguime@yahoo.com.br'             then 'G. MELO'
    when 'anestesista.guilherme@gmail.com' then 'G. MELO'
    when 'guollofernanda@gmail.com'        then 'FERNANDA GUOLLO'
    when 'leandrobernardes03@hotmail.com'  then 'LEANDRO BERNARDES'
    when 'joaormoreiraster@gmail.com'      then 'JOÃO RICARDO MOREIRA'
    else null
  end
  from public.profiles p
  where p.id = public.firebase_uid()
    and p.active is not false
$$;

comment on function public.ferias_nome_socio() is
  'Nome do sócio no Pega Plantão (ex. G. MELO) do usuário corrente, pelo e-mail. Espelha EMAIL_TO_SOCIO de src/pages/ferias/gate.js; usado no WITH CHECK de ferias_movimentacoes para garantir que ninguém marque férias em nome de outro.';

COMMIT;

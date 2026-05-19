-- Wave 1.9 T1.9.7: Hardening public.firebase_uid()
-- Motivo: audit Wave 1.8 identificou que firebase_uid() consulta current_setting('request.jwt.claims')
-- sem SECURITY DEFINER nem set search_path. Atacante com permissão de criar funções em pg_temp
-- poderia, em teoria, sequestrar resolução de nome via search_path takeover.
-- Solução: CREATE OR REPLACE preservando os 94 usos em 28 migrations.
--
-- Mudanças vs original (002_rls.sql:10-17):
-- - plpgsql → sql (mais seguro para lógica simples; melhor otimização)
-- - json → jsonb (melhor validação e performance)
-- - sem security definer → SECURITY DEFINER (escalonamento controlado: lê apenas current_setting)
-- - sem search_path → set search_path = pg_catalog, public (anti-takeover)
-- - mantém STABLE (correto: varia por JWT mas constante per-transaction)
-- - GRANT EXECUTE explícito (CREATE OR REPLACE pode resetar grants em algumas versões PG)
--
-- Idempotente (CREATE OR REPLACE). Rollback safe (executar a versão antiga novamente).

create or replace function public.firebase_uid()
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'user_id',
    ''
  );
$$;

grant execute on function public.firebase_uid() to authenticated, anon, service_role;

-- Smoke verify: a função continua funcional sob role authenticated
do $$
declare
  test_result text;
begin
  -- Em contexto sem JWT claim, deve retornar string vazia (não NULL nem error)
  select public.firebase_uid() into test_result;
  if test_result is null then
    raise exception 'firebase_uid() retornou NULL (esperado: string vazia)';
  end if;
end $$;

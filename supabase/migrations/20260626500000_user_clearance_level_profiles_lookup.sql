-- =============================================================================
-- 20260626500000_user_clearance_level_profiles_lookup.sql
-- Migração Firebase Third-Party Auth (Fase 1.5 do plano 2026-06)
--
-- user_clearance_level() deixava de funcionar com tokens Firebase nativos:
-- o claim `clearance_level` só existe no JWT custom HS256 emitido por
-- get-supabase-token (que será descomissionado). Passa a ler direto de
-- profiles.clearance_level via firebase_uid().
--
-- Efeitos:
--   • Compatível com AMBOS os tokens (claim deixa de ser usado).
--   • Mudança de clearance pelo admin vale imediatamente (antes: só no
--     refresh do token, até 50 min de atraso).
--   • Mesma assinatura (sem args, returns int) → policy
--     doc_confidentiality_select não muda.
--
-- SECURITY DEFINER segue o padrão de firebase_uid()
-- (20260520210000_firebase_uid_security_definer.sql): bypassa RLS de
-- profiles para a leitura pontual, com search_path fixo.
-- Default 'interno' (=1) quando perfil ausente — mesmo fail-safe da edge.
-- =============================================================================

create or replace function public.user_clearance_level()
returns int
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select case coalesce(
      (select p.clearance_level::text
         from public.profiles p
        where p.id = public.firebase_uid()),
      'interno')
    when 'publico'  then 0
    when 'interno'  then 1
    when 'restrito' then 2
    when 'sigiloso' then 3
    else 1
  end;
$$;

-- Paridade com o padrão firebase_uid(): ACL explícita
grant execute on function public.user_clearance_level() to authenticated, service_role;

-- Smoke-test: sem JWT no contexto da migration, deve retornar fail-safe 1 (interno)
do $$
begin
  if public.user_clearance_level() is distinct from 1 then
    raise exception 'user_clearance_level(): esperado 1 (interno) sem JWT, obtido %',
      public.user_clearance_level();
  end if;
end $$;

comment on function public.user_clearance_level() is
  'Clearance numérico do usuário corrente (0=publico..3=sigiloso). Lê profiles.clearance_level via firebase_uid(); default interno(1) sem perfil. Desde 2026-06 NÃO depende mais do claim clearance_level do JWT.';

comment on column public.profiles.clearance_level is
  'Nível de acesso máximo do usuário a documentos confidenciais. Lido em query-time por public.user_clearance_level() (não é mais injetado como claim no JWT).';

-- Migration: profiles.email DEVE existir em authorized_emails antes do INSERT
-- Incidente 2026-05-21 (P3a do plano pós-Erlei).
--
-- Defense in depth: hoje só rpc_create_profile valida que email é autorizado.
-- INSERT direto (frontend service createUser, dashboard Supabase, scripts ad-hoc)
-- bypassa essa validação. Trigger BEFORE INSERT garante a invariante em todos
-- os paths.
--
-- Decisões:
--   1. Trigger BLOQUEIA INSERT, não DELETE/UPDATE. Profiles existentes ficam
--      como estão (não vamos quebrar histórico).
--   2. Bypass para roles privilegiados (postgres, service_role) — permite
--      migration scripts (ex: scripts/migrate-firebase-to-supabase.js) e
--      correções operacionais via dashboard Supabase. O alvo do trigger é
--      bloquear o role 'authenticated' (app client), que é o único path
--      vulnerável a bypass acidental do rpc_create_profile.
--   3. Comparação case-insensitive via lower() — consistente com rpc_create_profile.
--   4. Mensagem de erro clara para debugging.

-- IMPORTANTE: SECURITY INVOKER (não DEFINER). Razão: SECURITY DEFINER muda
-- `current_user` para o owner da função (postgres), o que invalidaria o check
-- de bypass abaixo (trigger nunca bloquearia ninguém). Como esta função só
-- faz SELECT em authorized_emails (que `authenticated` já pode via RLS) e
-- RAISE EXCEPTION, não precisa de privilégios elevados.
CREATE OR REPLACE FUNCTION public.profiles_require_authorized_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  -- Bypass: roles privilegiados (postgres = superuser, service_role = migration scripts).
  -- O trigger existe pra proteger contra direct INSERT vindo do app client (role
  -- 'authenticated'). rpc_create_profile é SECURITY DEFINER (owner=postgres), então
  -- quando ELE faz INSERT, current_user='postgres' e cai neste bypass. ✓
  IF current_user IN ('postgres', 'service_role') THEN
    RETURN NEW;
  END IF;

  IF NEW.email IS NULL THEN
    RAISE EXCEPTION 'profiles.email cannot be NULL';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.authorized_emails
    WHERE lower(email) = lower(NEW.email)
  ) THEN
    RAISE EXCEPTION
      'INSERT em profiles requer email em authorized_emails. Email: %. Adicione ao allowlist primeiro.',
      NEW.email
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_profiles_require_authorized ON public.profiles;
CREATE TRIGGER tr_profiles_require_authorized
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_require_authorized_email();

-- Smoke (deve falhar):
--   INSERT INTO profiles (id, nome, email, role) VALUES ('test_fake', 'Fake', 'naoautorizado@test.com', 'colaborador');
--   -- ERROR: INSERT em profiles requer email em authorized_emails
--
-- Smoke (deve passar):
--   INSERT INTO authorized_emails (email, added_by) VALUES ('teste@empresa.com', 'Admin');
--   INSERT INTO profiles (id, nome, email, role) VALUES ('test_real', 'Real', 'teste@empresa.com', 'colaborador');
--   -- OK

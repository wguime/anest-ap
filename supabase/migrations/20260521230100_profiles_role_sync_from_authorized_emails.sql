-- Migration: sync profiles.role quando authorized_emails.role muda
-- Incidente 2026-05-21 (P1a do plano pós-Erlei).
--
-- Hoje, alterar cargo na aba Centro de Gestão → Emails só afeta NOVOS signups
-- (via rpc_create_profile que lê authorized_emails.role na criação). Para users
-- JÁ logados, a mudança não propaga — o admin precisa abrir aba Usuários e
-- editar individualmente. Isso é fonte de desincronização silenciosa.
--
-- Trigger AFTER UPDATE em authorized_emails(role) que:
--   1. Faz UPDATE em profiles SET role = NEW.role WHERE lower(email) = lower(NEW.email)
--   2. Só atualiza se NEW.role IS NOT NULL (NULL em authorized_emails = "sem default")
--   3. Só atualiza se OLD.role IS DISTINCT FROM NEW.role (skip no-op updates)
--   4. Loga via audit trail existente (updated_at via tr_profiles_updated_at)

CREATE OR REPLACE FUNCTION public.sync_profile_role_from_authorized_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Só age em mudança real e quando NEW tem role definida
  IF NEW.role IS NULL THEN
    RETURN NEW;
  END IF;
  IF OLD.role IS NOT DISTINCT FROM NEW.role THEN
    RETURN NEW;
  END IF;

  UPDATE public.profiles
  SET role = NEW.role,
      updated_at = now()
  WHERE lower(email) = lower(NEW.email)
    AND role IS DISTINCT FROM NEW.role;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_sync_profile_role ON public.authorized_emails;
CREATE TRIGGER tr_sync_profile_role
  AFTER UPDATE OF role ON public.authorized_emails
  FOR EACH ROW
  WHEN (NEW.role IS DISTINCT FROM OLD.role)
  EXECUTE FUNCTION public.sync_profile_role_from_authorized_email();

-- Index funcional em lower(email) para que o UPDATE do trigger
-- não vire seq scan quando profiles crescer. profiles.email já tem CHECK
-- constraint enforcing lowercase (migration 032), mas o WHERE usa lower()
-- defensivamente — index funcional resolve.
CREATE INDEX IF NOT EXISTS idx_profiles_lower_email ON public.profiles(lower(email));

-- Smoke:
--   UPDATE authorized_emails SET role = 'enfermeiro'
--   WHERE email = '<algum-email-com-profile>';
--   SELECT role FROM profiles WHERE lower(email) = lower('<o-mesmo-email>');
--   -- Esperado: profile.role agora é 'enfermeiro'

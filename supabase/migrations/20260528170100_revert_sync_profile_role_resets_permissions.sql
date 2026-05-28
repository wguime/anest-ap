-- Migration: reverte 20260528170000_sync_profile_role_resets_permissions.sql
-- Restaura função sync_profile_role_from_authorized_email ao estado original
-- da migration 20260521230100 (sem reset de permissions/custom_permissions).
--
-- Motivo: usuário (admin) pediu reversão das alterações preventivas — só o caso
-- pontual da Nathalia Fornari Fernandes deve ficar corrigido.

CREATE OR REPLACE FUNCTION public.sync_profile_role_from_authorized_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
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

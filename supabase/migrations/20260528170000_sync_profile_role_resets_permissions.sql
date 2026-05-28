-- Migration: trigger sync_profile_role_from_authorized_email também reseta
-- permissions/custom_permissions quando o cargo do usuário muda na aba Emails.
--
-- Bug observado 2026-05-28 (caso Nathalia Fornari Fernandes + 2 outros):
--   Quando admin troca o cargo via Centro de Gestão → Emails, o trigger
--   tr_sync_profile_role (migration 20260521230100) propaga authorized_emails.role
--   → profiles.role, MAS deixa profiles.permissions e profiles.custom_permissions
--   inalterados.
--
--   Resultado: usuários promovidos de "colaborador" (que tinham permissions
--   restritas tipo { "doc-protocolos": true } + custom_permissions=true) para
--   "anestesiologista" ficavam com TODAS as features bloqueadas, porque o hook
--   useCardPermissions interpreta "custom_permissions=true com poucas keys" como
--   permissions stale e bloqueia tudo que não está na lista.
--
-- Fix: ao sincronizar role via trigger, também resetar para o template padrão da
-- nova role:
--   custom_permissions = false   (= "segue template da role")
--   permissions = '{}'::jsonb    (= "nada explícito, fallback para role")
--
-- O hook useCardPermissions, vendo custom_permissions=false, libera todos os
-- cards (template anestesiologista/enfermeiro/etc = getAllCardIds(true)).
--
-- Se o admin quiser custom permissions pro novo cargo, edita pela aba Usuários.
-- A aba Emails é "qual cargo este email recebe" — não é editor de permissions.

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

  -- Reset para template da nova role: custom_permissions=false + permissions={}
  -- evita que customizações do cargo anterior fiquem "presas" e bloqueiem
  -- features no cargo novo.
  UPDATE public.profiles
  SET role = NEW.role,
      custom_permissions = false,
      permissions = '{}'::jsonb,
      updated_at = now()
  WHERE lower(email) = lower(NEW.email)
    AND role IS DISTINCT FROM NEW.role;

  RETURN NEW;
END;
$$;

-- Trigger já existe (migration 20260521230100), só estamos sobrescrevendo a
-- função. Sem DROP/CREATE TRIGGER necessário.

-- Smoke:
--   UPDATE authorized_emails SET role = 'enfermeiro'
--   WHERE email = '<email-com-custom-permissions-true>';
--   SELECT role, custom_permissions, permissions
--   FROM profiles WHERE lower(email) = lower('<o-mesmo-email>');
--   -- Esperado: role='enfermeiro', custom_permissions=false, permissions='{}'

-- Migration: trigger sync_profile_role_from_authorized_email passa a aplicar o
-- template de permissoes do cargo novo ao trocar o cargo de um usuario na aba
-- Centro de Gestao -> Emails.
--
-- Contexto (auditoria 2026-05-28):
--   Quando admin troca o cargo via authorized_emails.role, o trigger
--   (migration 20260521230100) propagava authorized_emails.role -> profiles.role
--   mas NAO atualizava profiles.permissions / custom_permissions. Resultado:
--   cargo novo + permissoes antigas presas (ex.: {"doc-protocolos": true}) =
--   usuario bloqueado de quase tudo (assinatura dos casos Nathalia, guilhermexavier.d,
--   maritania051, erlei).
--
-- Por que NAO resetar simplesmente para '{}' + custom_permissions=false:
--   O hook useCardPermissions libera TODO card nao-listado quando custom_permissions
--   != true. Para roles RESTRITOS (tec-enfermagem, medico-residente) isso
--   over-permissionaria o usuario (veria faturamento, auditorias, etc.). Os templates
--   restritos NAO vivem em tabela; sao materializados em cada usuario do role.
--
-- Solucao: ao trocar o cargo, clonar o template do PEER mais completo do cargo-alvo
--   (>5 chaves => exclui usuarios sparse/quebrados; ordena por nº de chaves desc).
--   Espelha a logica de `derive` do frontend (CentroGestaoPage). Sem peer saudavel,
--   cai em '{}' + custom_permissions=false (template all-true do codigo).
--
-- Idempotente: CREATE OR REPLACE. Reversivel: restaurar a versao da migration
--   20260521230100 (ver 20260528170100 como referencia de revert).

CREATE OR REPLACE FUNCTION public.sync_profile_role_from_authorized_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_perms jsonb;
  v_cp    boolean;
BEGIN
  IF NEW.role IS NULL THEN
    RETURN NEW;
  END IF;
  IF OLD.role IS NOT DISTINCT FROM NEW.role THEN
    RETURN NEW;
  END IF;

  -- Clonar o template do peer mais completo do cargo-alvo.
  -- O filtro (> 5 chaves) garante que nunca clonamos de um usuario sparse/quebrado.
  SELECT p.permissions, p.custom_permissions
  INTO v_perms, v_cp
  FROM public.profiles p
  WHERE p.role = NEW.role
    AND lower(p.email) <> lower(NEW.email)
    AND p.custom_permissions = true          -- so clona template restrito materializado
    AND p.permissions IS NOT NULL
    AND (SELECT count(*) FROM jsonb_object_keys(p.permissions)) > 5
  ORDER BY (SELECT count(*) FROM jsonb_object_keys(p.permissions)) DESC,
           p.updated_at DESC NULLS LAST
  LIMIT 1;

  UPDATE public.profiles
  SET role = NEW.role,
      permissions = COALESCE(v_perms, '{}'::jsonb),
      custom_permissions = COALESCE(v_cp, false),
      updated_at = now()
  WHERE lower(email) = lower(NEW.email)
    AND role IS DISTINCT FROM NEW.role;

  RETURN NEW;
END;
$function$;

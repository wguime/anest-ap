-- ============================================================================
-- Trigger: notificar responsáveis quando um incidente/denúncia é criado
--
-- Cobre o gap dos formulários HTML públicos (public/formulario-incidente.html,
-- public/formulario-denuncia.html) que inserem direto via anon key e não
-- passam pelo React. As páginas autenticadas React continuam também criando
-- notifications via client, mas o trigger garante cobertura universal.
--
-- Dedup: se a notificação para o mesmo incidente já existe (pela combinação
--   related_entity_id + recipient_id), o UNIQUE constraint evita duplicata.
--
-- LGPD: content não contém descrição/nome/tipo específico — apenas
--   protocolo + link.
--
-- SECURITY DEFINER: executa com privilégios do owner, bypassando RLS
--   (necessário porque anon key não pode inserir em notifications após a
--   migration 20260422203000_tighten_notifications_rls.sql).
-- ============================================================================

-- ──────────────────────────────────────────────
-- 1. UNIQUE constraint para idempotência
-- ──────────────────────────────────────────────
-- Evita duplicata quando o trigger roda + a UI React também cria.
-- Se já existir index com esse nome, não recria.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND indexname = 'uniq_notifications_entity_recipient'
  ) THEN
    CREATE UNIQUE INDEX uniq_notifications_entity_recipient
      ON public.notifications (related_entity_type, related_entity_id, recipient_id)
      WHERE related_entity_id IS NOT NULL;
  END IF;
END $$;

-- ──────────────────────────────────────────────
-- 2. Função do trigger
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_responsaveis_on_incidente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_denuncia boolean := NEW.tipo = 'denuncia';
  v_subject text;
  v_content text;
  v_action_url text;
  v_action_label text;
  v_action_params jsonb;
  v_entity_type text;
BEGIN
  -- Montagem LGPD-safe
  IF v_is_denuncia THEN
    v_subject := 'Nova denúncia registrada';
    v_content := format('Denúncia protocolo %s registrada — requer análise.', NEW.protocolo);
    v_action_url := 'denuncias';
    v_action_label := 'Ver Denúncia';
    v_entity_type := 'denuncia';
  ELSE
    v_subject := 'Novo incidente registrado';
    v_content := format('Incidente protocolo %s registrado — requer análise.', NEW.protocolo);
    v_action_url := 'incidentes';
    v_action_label := 'Ver Incidente';
    v_entity_type := 'incidente';
  END IF;

  v_action_params := jsonb_build_object(
    'protocolo', NEW.protocolo,
    'incidenteId', NEW.id::text
  );

  -- Insere uma notificação por responsável (admin/coordenador ativo)
  -- ON CONFLICT NOTHING absorve duplicatas se o fluxo React também chamou.
  INSERT INTO public.notifications (
    recipient_id,
    category,
    subject,
    content,
    sender_name,
    priority,
    action_url,
    action_label,
    action_params,
    dismissable,
    related_entity_type,
    related_entity_id
  )
  SELECT
    p.id,
    'incidente',
    v_subject,
    v_content,
    CASE WHEN v_is_denuncia THEN 'Canal de Denúncias' ELSE 'Sistema de Qualidade' END,
    'alta',
    v_action_url,
    v_action_label,
    v_action_params,
    true,
    v_entity_type,
    NEW.id::text
  FROM public.profiles p
  WHERE p.active IS NOT FALSE
    AND (
      COALESCE(p.is_admin, false) = true
      OR COALESCE(p.is_coordenador, false) = true
      OR p.role = 'coordenador'
    )
  ON CONFLICT (related_entity_type, related_entity_id, recipient_id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca bloquear a criação do incidente por falha na notificação.
  -- Registra warning no log do Postgres mas não re-raise.
  RAISE WARNING '[notify_responsaveis_on_incidente] falhou para %: %',
    NEW.protocolo, SQLERRM;
  RETURN NEW;
END;
$$;

-- ──────────────────────────────────────────────
-- 3. Trigger AFTER INSERT
-- ──────────────────────────────────────────────
DROP TRIGGER IF EXISTS tr_incidentes_notify_responsaveis ON public.incidentes;

CREATE TRIGGER tr_incidentes_notify_responsaveis
  AFTER INSERT ON public.incidentes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_responsaveis_on_incidente();

-- ──────────────────────────────────────────────
-- 4. Grant para função (SECURITY DEFINER já garante acesso, mas
--     explícito para clareza)
-- ──────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.notify_responsaveis_on_incidente() TO authenticated, anon;

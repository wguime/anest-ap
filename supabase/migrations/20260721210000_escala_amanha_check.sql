-- ════════════════════════════════════════════════════════════════════════
-- 20260721210000_escala_amanha_check.sql
-- Risco operacional nº1 da adesão (docs/escala-cirurgica-analise-adesao.md
-- §1/§5): dia sem escala importada = board vazio = grupo volta ao WhatsApp.
-- Job diário 18h BRT (21h UTC), dom–qui (alvo = amanhã, seg–sex): se a
-- escala de amanhã não está publicada para os hospitais esperados
-- (unimed, hro — Materno fora por ora; decisão do dono 2026-07-21),
-- notifica in-app (sino). Escalas seed NÃO contam como publicada.
--
-- Piloto: destinatário = dono (por e-mail). Liberação ao grupo: trocar o
-- SELECT de recipients para papel secretaria/admin (marcado abaixo).
--
-- Dedup: índice único parcial de 20260423021000_ensure_unique_index.sql
-- (related_entity_type, related_entity_id, recipient_id) WHERE
-- related_entity_id IS NOT NULL → máx. 1 aviso por hospital × data ×
-- destinatário, mesmo se o job rodar 2×. Espelha o INSERT canônico de
-- insert_cateter_notification (20260628130000).
--
-- Idempotente. Rollback: SELECT cron.unschedule('escala-amanha-check');
--                        DROP FUNCTION public.notify_escala_amanha_faltante();
-- ════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.notify_escala_amanha_faltante()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  h text;
  alvo date := current_date + 1;
BEGIN
  -- FDS sem escala eletiva esperada (belt — o schedule dom–qui já evita).
  -- Feriado em dia útil gera falso-positivo (aceito no piloto; revisar na
  -- liberação ao grupo — ex.: tabela de feriados ou skip manual).
  IF extract(isodow FROM alvo) IN (6, 7) THEN
    RETURN;
  END IF;

  FOREACH h IN ARRAY ARRAY['unimed', 'hro'] LOOP
    IF NOT EXISTS (
      SELECT 1
        FROM escala_cirurgica
       WHERE data = alvo
         AND hospital = h
         AND status = 'publicada'
         AND created_by NOT LIKE 'seed-teste-claude%'
    ) THEN
      INSERT INTO public.notifications (
        recipient_id, category, subject, content, sender_name, priority,
        action_url, action_label, action_params, dismissable,
        related_entity_type, related_entity_id
      )
      SELECT
        p.id,
        'escala',
        'Escala cirúrgica de amanhã não publicada — ' || upper(h),
        'A escala de ' || to_char(alvo, 'DD/MM') || ' (' || upper(h)
          || ') ainda não foi publicada. Importe pela Escala Cirúrgica → aba Completa → Importar.',
        'Escala Cirúrgica',
        'alta',
        'escalaCirurgica',
        'Abrir escala',
        jsonb_build_object('hospital', h, 'data', alvo::text),
        true,
        'escala-faltante',
        h || ':' || alvo::text
      FROM public.profiles p
      WHERE p.active IS NOT FALSE
        -- PILOTO: só o dono. Na liberação ao grupo, trocar por:
        --   lower(coalesce(p.role, '')) IN ('secretaria', ...) OR is_admin-equivalente
        AND lower(p.email) = 'wguime@yahoo.com.br'
      ON CONFLICT (related_entity_type, related_entity_id, recipient_id)
        WHERE related_entity_id IS NOT NULL
        DO NOTHING;
    END IF;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_escala_amanha_faltante: %', SQLERRM;
END;
$$;

-- Não expor via PostgREST (/rest/v1/rpc): só o pg_cron (postgres) executa.
REVOKE ALL ON FUNCTION public.notify_escala_amanha_faltante() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'escala-amanha-check') THEN
    PERFORM cron.unschedule('escala-amanha-check');
  END IF;
END $$;

-- 21:00 UTC = 18:00 BRT; dom–qui → alvo (amanhã) = seg–sex
SELECT cron.schedule(
  'escala-amanha-check',
  '0 21 * * 0-4',
  $$SELECT public.notify_escala_amanha_faltante()$$
);

-- Inspeção (manual):
-- SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'escala-amanha-check';

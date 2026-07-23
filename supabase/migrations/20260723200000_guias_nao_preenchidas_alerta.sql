-- ════════════════════════════════════════════════════════════════════════
-- 20260723200000_guias_nao_preenchidas_alerta.sql
-- Conferência de GUIAS NÃO PREENCHIDAS por turno (pedido do dono 2026-07-23):
-- "passado o turno", guia do dia ainda incompleta gera ALERTA in-app.
--
-- Guia NÃO PREENCHIDA = lançamento ativo com nome em iniciais OU sem CPF
-- OU sem valor (>0) — espelho do precisaCompletar do front (badge
-- "Completar dados").
--
-- Turno do lançamento: hora do caso vinculado (< 13:00 = matutino, senão
-- vespertino — espelho do turnoDeHora do front). Lançamento manual/sem
-- vínculo/sem hora conta no alerta VESPERTINO (fechamento do dia), que
-- também revarre o matutino ainda pendente.
--
-- Destinatários e conteúdo (LGPD: NUNCA nome/CPF — só local/sala/hora):
--   • anestesista da guia (anestesista_user_id ativo) → alerta com AS SUAS
--   • admins → alerta com o total do turno
-- Dedup: 1 alerta por dia × turno × destinatário (índice único de
-- notifications). Agendamento pg_cron:
--   matutino  → 16:30 UTC (13:30 BRT)
--   vespertino → 23:00 UTC (20:00 BRT)
--
-- Rollback: cron.unschedule('guias-pendentes-matutino'/'-vespertino');
--           DROP FUNCTION fn_alertar_guias_nao_preenchidas(text, date, boolean);
-- ════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_cron;

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_alertar_guias_nao_preenchidas(
  p_turno text,                          -- 'matutino' | 'vespertino'
  p_data date DEFAULT current_date,
  p_notificar boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_total int := 0;
  v_itens jsonb := '[]'::jsonb;
BEGIN
  -- Guias não preenchidas no recorte do turno.
  -- matutino  = só as de HOJE com hora < 13:00 (ping de fim de turno);
  -- vespertino = fechamento: TODAS as pendentes da JANELA 7 dias (revarre
  --   matutino, manuais/sem hora e dias anteriores ainda pendentes — o
  --   lembrete repete 1×/dia até a guia ser preenchida).
  DROP TABLE IF EXISTS pg_temp.tmp_guias;
  CREATE TEMP TABLE tmp_guias ON COMMIT DROP AS
  SELECT cp.id, cp.anestesista_user_id, cp.local, cp.data_cirurgia,
         c.sala, c.hora
  FROM public.cirurgias_particulares cp
  LEFT JOIN public.escala_cirurgica_caso c ON c.id = cp.escala_caso_id
  WHERE cp.cancelada_em IS NULL
    AND (cp.paciente !~ '[[:alpha:]]{3,}' OR cp.paciente_cpf IS NULL OR cp.valor <= 0)
    AND (
      CASE WHEN p_turno = 'matutino'
           THEN cp.data_cirurgia = p_data
                -- CASE aninhado: garantia DOCUMENTADA de que o cast só roda
                -- após a regex (hora 'AS' existe em prod; AND não garante ordem)
                AND CASE WHEN c.hora ~ '^\d{1,2}:\d{2}'
                         THEN split_part(c.hora, ':', 1)::int < 13
                         ELSE false END
           ELSE cp.data_cirurgia BETWEEN p_data - 7 AND p_data
      END
    );

  SELECT count(*),
         coalesce(jsonb_agg(jsonb_build_object(
           'local', local, 'sala', sala, 'hora', hora)), '[]'::jsonb)
    INTO v_total, v_itens
  FROM tmp_guias;

  IF v_total = 0 OR NOT p_notificar THEN
    RETURN jsonb_build_object('turno', p_turno, 'data', p_data, 'pendentes', v_total, 'itens', v_itens);
  END IF;

  -- Anestesista da guia: alerta personalizado com AS SUAS pendências
  BEGIN
    INSERT INTO public.notifications (
      recipient_id, category, subject, content, sender_name, priority,
      action_url, action_label, dismissable,
      related_entity_type, related_entity_id
    )
    SELECT
      p.id,
      'escala',
      'Guia particular não preenchida — turno ' || p_turno,
      'Você tem ' || g.n || ' guia(s) de cirurgia particular aguardando preenchimento (nome/CPF/valor): '
        || g.locais || '. Complete para a cobrança.',
      'Cirurgias Particulares', 'alta',
      'cirurgiasParticulares', 'Preencher guia', true,
      'guia-pendente', p_data::text || ':' || p_turno
    FROM (
      SELECT anestesista_user_id AS uid, count(*) AS n,
             string_agg(
               to_char(data_cirurgia, 'DD/MM') || ' ' || coalesce(local, '')
                 || coalesce(' ' || sala, '') || coalesce(' ' || hora, ''),
               ' · ' ORDER BY data_cirurgia
             ) AS locais
      FROM tmp_guias
      WHERE anestesista_user_id IS NOT NULL
      GROUP BY anestesista_user_id
    ) g
    JOIN public.profiles p ON p.id = g.uid AND p.active IS NOT FALSE
    ON CONFLICT (related_entity_type, related_entity_id, recipient_id)
      WHERE related_entity_id IS NOT NULL
      DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'fn_alertar_guias_nao_preenchidas (anestesistas): %', SQLERRM;
  END;

  -- Admins: total do turno (sem duplicar quando o admin é o próprio anestesista
  -- — o dedup por (type, id, recipient) segura: mesma entity_id, mesmo recipient)
  BEGIN
    INSERT INTO public.notifications (
      recipient_id, category, subject, content, sender_name, priority,
      action_url, action_label, dismissable,
      related_entity_type, related_entity_id
    )
    SELECT
      p.id,
      'escala',
      'Guias particulares não preenchidas — turno ' || p_turno,
      v_total || ' guia(s) aguardando preenchimento (nome/CPF/valor). Confira em Cirurgias Particulares.',
      'Cirurgias Particulares', 'alta',
      'cirurgiasParticulares', 'Abrir cobranças', true,
      'guia-pendente', p_data::text || ':' || p_turno
    FROM public.profiles p
    WHERE p.active IS NOT FALSE
      AND p.id IN (SELECT firebase_uid FROM public.admin_users)
    ON CONFLICT (related_entity_type, related_entity_id, recipient_id)
      WHERE related_entity_id IS NOT NULL
      DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'fn_alertar_guias_nao_preenchidas (admins): %', SQLERRM;
  END;

  RETURN jsonb_build_object('turno', p_turno, 'data', p_data, 'pendentes', v_total, 'itens', v_itens);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_alertar_guias_nao_preenchidas: %', SQLERRM;
  RETURN jsonb_build_object('erro', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_alertar_guias_nao_preenchidas(text, date, boolean) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.fn_alertar_guias_nao_preenchidas(text, date, boolean) IS
  'Alerta pós-turno de guias particulares não preenchidas (nome/CPF/valor): anestesista da guia recebe as SUAS, admins recebem o total. Conteúdo LGPD-safe (local/sala/hora). Dedup 1/dia×turno×destinatário.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'guias-pendentes-matutino') THEN
    PERFORM cron.unschedule('guias-pendentes-matutino');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'guias-pendentes-vespertino') THEN
    PERFORM cron.unschedule('guias-pendentes-vespertino');
  END IF;
END $$;

-- 16:30 UTC = 13:30 BRT (fim do matutino) · 23:00 UTC = 20:00 BRT (fim do vespertino)
SELECT cron.schedule('guias-pendentes-matutino', '30 16 * * *',
  $$SELECT public.fn_alertar_guias_nao_preenchidas('matutino')$$);
SELECT cron.schedule('guias-pendentes-vespertino', '0 23 * * *',
  $$SELECT public.fn_alertar_guias_nao_preenchidas('vespertino')$$);

COMMIT;

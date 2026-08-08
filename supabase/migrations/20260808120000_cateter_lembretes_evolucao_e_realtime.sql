-- ════════════════════════════════════════════════════════════════════════
-- 20260808120000_cateter_lembretes_evolucao_e_realtime.sql
-- Cateter Peridural — "avisei que não evoluiu, mas evoluiu no prazo" (08/08)
--
-- Três defeitos distintos produziam o mesmo sintoma para o dono:
--
--  1. notify_cateter_reminders() decidia os lembretes "registrar PO1/PO2" SÓ
--     pelo tempo desde a inserção, sem nunca olhar se aquela evolução já
--     existia. Em produção: paciente ED (inserção 04/08 09:00 BRT) evoluiu PO1
--     em 05/08 12:42 e mesmo assim recebeu "completou 24h — registre o 1º PO"
--     em 06/08 07:00, para 56 pessoas; PO2 em 06/08 20:01 e "registre o 2º PO"
--     em 07/08 07:00. Idem paciente JK em 08/08. Aqui os dois lembretes de PO
--     passam a ser suprimidos quando o followup daquele PO já foi gravado.
--     Os de 72h/96h continuam SEM gate: são alerta de duração/retirada, não
--     cobrança de evolução, e valem mesmo com o cateter evoluído em dia.
--
--  2. A janela "não evoluído" cortava em 24h/36h corridas, contadas do horário
--     EXATO da evolução anterior. A visita diária não sai na mesma hora todo
--     dia (intervalos reais: 21,8h · 25,2h · 25,4h · 31,3h · 34,4h), então um
--     cateter evoluído todo dia acendia o alerta entre a hora de ontem e a de
--     hoje. Passa a 30h/42h — 30h tolera ~6h de deriva da rotina, 42h só é
--     atingido quando um dia inteiro foi pulado.
--     ⚠️ Espelhado em src/data/cateterPeridualConfig.js
--     (EVOLUCAO_WARNING_HOURS / EVOLUCAO_CRITICAL_HOURS) — mudar um exige o outro.
--
--  3. O cron rodava 10:00 UTC = 07:00 BRT, ANTES da visita da manhã (as
--     evoluções reais saem entre 10h e 11h30 BRT), então cobrava a evolução do
--     dia antes de ela ser possível. Vai para 20:00 UTC = 17:00 BRT: fim da
--     tarde, quando "não evoluiu hoje" já é um fato.
--
-- + cateteres_peridural entra na publicação supabase_realtime. O
--   CateterPeridualContext assina esta tabela desde sempre
--   (createReliableSubscription 'cateteres-peridural-changes'), mas ela nunca
--   esteve na publicação — a assinatura era código morto e o UPDATE de
--   ultima_avaliacao_at feito pelo trigger nunca chegava ao cliente. Era por
--   isso que o aviso sumia "sozinho horas depois": só quando o app recarregava
--   ou o canal reconectava (onRefetch → fetchAll).
--
-- Idempotente. Rollback: reagendar o cron em '0 10 * * *', restaurar os cortes
-- 24/36 e remover a tabela da publicação.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Realtime para cateteres_peridural ────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'cateteres_peridural'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cateteres_peridural;
  END IF;
END;
$$;

-- ── 2. Lembretes cientes da evolução já registrada ──────────────────────
CREATE OR REPLACE FUNCTION public.notify_cateter_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
  v_ini text;
  v_suffix text;
  v_pac text;
  v_horas_ins numeric;
  v_horas_av numeric;
  v_max_po integer;
  v_today text := to_char(now(), 'YYYY-MM-DD');
BEGIN
  FOR c IN
    SELECT * FROM public.cateteres_peridural
    WHERE status = 'ativo' AND data_insercao IS NOT NULL
  LOOP
    v_ini := public.cateter_iniciais(c.paciente);
    v_suffix := CASE WHEN c.hospital IS NOT NULL THEN ' — ' || upper(c.hospital) ELSE '' END;
    v_pac := CASE WHEN v_ini <> '' THEN ' (paciente ' || v_ini || ')' ELSE '' END;
    v_horas_ins := EXTRACT(EPOCH FROM (now() - c.data_insercao)) / 3600;
    v_horas_av  := EXTRACT(EPOCH FROM (now() - coalesce(c.ultima_avaliacao_at, c.data_insercao))) / 3600;

    -- Maior PO já evoluído (NULL = nunca evoluído). dia_po é derivado da data
    -- de calendário da avaliação (lib cateterPo.js), então é ele — e não o
    -- tempo corrido — que responde "o 1º PO já foi registrado?".
    SELECT max(f.dia_po) INTO v_max_po
    FROM public.cateteres_peridural_followup f
    WHERE f.cateter_id = c.id;

    -- ── COBRANÇA DE EVOLUÇÃO POR PO (só se aquele PO ainda não existe) ──
    IF v_horas_ins >= 24 AND coalesce(v_max_po, -1) < 1 THEN
      PERFORM public._cateter_reminder_insert(c.id, 'cateter-peridural-reminder',
        'cateter-reminder_' || c.id::text || '_24h',
        'Cateter peridural ativo há 24h — registrar PO1',
        'Cateter peridural completou 24h' || v_pac || v_suffix || '. Registre a avaliação de 1º PO.',
        'normal');
    END IF;
    IF v_horas_ins >= 48 AND coalesce(v_max_po, -1) < 2 THEN
      PERFORM public._cateter_reminder_insert(c.id, 'cateter-peridural-reminder',
        'cateter-reminder_' || c.id::text || '_48h',
        'Cateter peridural ativo há 48h — registrar PO2',
        'Cateter peridural completou 48h' || v_pac || v_suffix || '. Registre a avaliação de 2º PO.',
        'normal');
    END IF;

    -- ── DURAÇÃO / RETIRADA (sem gate: vale mesmo evoluído em dia) ──
    IF v_horas_ins >= 72 THEN
      PERFORM public._cateter_reminder_insert(c.id, 'cateter-peridural-reminder',
        'cateter-reminder_' || c.id::text || '_72h',
        'Atenção: cateter peridural com 72h ativo',
        'Cateter peridural atingiu 72h' || v_pac || v_suffix || '. Próximo do limite de 96h — planejar retirada.',
        'alta');
    END IF;
    IF v_horas_ins >= 96 THEN
      PERFORM public._cateter_reminder_insert(c.id, 'cateter-peridural-reminder',
        'cateter-reminder_' || c.id::text || '_96h',
        'CRÍTICO: cateter peridural excedeu 96h',
        'Cateter peridural excedeu 96h' || v_pac || v_suffix || '. Retirar imediatamente.',
        'urgente');
    END IF;

    -- ── NÃO EVOLUÍDO (janela diária, 30h/42h — espelha o front) ──
    IF v_horas_av >= 42 THEN
      PERFORM public._cateter_reminder_insert(c.id, 'cateter-peridural-naoevoluido',
        'cateter-naoevoluido_' || c.id::text || '_' || v_today,
        'CRÍTICO: cateter peridural sem evolução',
        'Cateter peridural sem evolução PO há ' || floor(v_horas_av)::text || 'h' || v_pac || v_suffix || '. Registrar evolução.',
        'urgente');
    ELSIF v_horas_av >= 30 THEN
      PERFORM public._cateter_reminder_insert(c.id, 'cateter-peridural-naoevoluido',
        'cateter-naoevoluido_' || c.id::text || '_' || v_today,
        'Cateter peridural sem evolução há mais de um dia',
        'Cateter peridural sem evolução PO há ' || floor(v_horas_av)::text || 'h' || v_pac || v_suffix || '. Registrar evolução.',
        'alta');
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_cateter_reminders() TO service_role;

-- ── 3. Cron para 17:00 BRT (20:00 UTC), depois da visita da manhã ───────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cateter-reminders-daily') THEN
    PERFORM cron.unschedule('cateter-reminders-daily');
  END IF;
END;
$$;

SELECT cron.schedule(
  'cateter-reminders-daily',
  '0 20 * * *',
  $$SELECT public.notify_cateter_reminders()$$
);

COMMIT;

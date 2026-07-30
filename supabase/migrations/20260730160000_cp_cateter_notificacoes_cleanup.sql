-- ════════════════════════════════════════════════════════════════════════
-- 20260730160000_cp_cateter_notificacoes_cleanup.sql
-- Continuação do descarrego da inbox (dono 30/07; escala já saiu em
-- 20260730150000). Dois módulos:
--
-- CIRURGIAS PARTICULARES — fim de TODO envio de mensagem:
--   • crons guias-pendentes-matutino/vespertino (13:30/20:00 BRT) fora +
--     DROP fn_alertar_guias_nao_preenchidas (só existia p/ notificar; o
--     banner âmbar na listagem segue sendo a superfície do aviso).
--   • cron cirurgias-particulares-check REAGENDADO com p_notificar=false —
--     a AUTO-CORREÇÃO da cobrança e o log (check_log) CONTINUAM; só a
--     notificação de admins morre. A skill /cirurgias-particulares segue
--     lendo o log.
--
-- CATETER PERIDURAL — fica SÓ o alerta clínico (pedido: "deixe envio
-- apenas de alertas relacionados"):
--   • DROP dos 3 triggers de EVENTO (novo/evolução/retirada — 8.854
--     notificações acumuladas, fan-out ao grupo inteiro por evento) e das
--     funções deles + insert_cateter_notification (sem outro chamador).
--   • MANTIDOS: cron notify_cateter_reminders (PO1/PO2, 72h/96h, sem
--     evolução 24h/36h) + _cateter_reminder_insert + cateter_iniciais
--     (usada pelos lembretes).
--
-- E apaga o acumulado dos dois remetentes ('Cirurgias Particulares' 297,
-- 'Gestão de Cateteres' 10.881 — ~98% não lidas). Backup local do dono
-- antes do apply. Lembrete ainda ativo re-notifica no próximo cron (ok —
-- é alerta acionável).
--
-- Idempotente: IF EXISTS em tudo; re-schedule do check é unschedule+schedule.
-- Rollback: re-aplicar 20260628130000/160000 (triggers) e 20260723200000
--           (guias); check volta a notificar re-agendando com true.
--           Notificações apagadas não voltam (intencional).
-- LGPD: minimização — conteúdo com iniciais de paciente (cateter); exclusão
--       definitiva a pedido do controlador.
-- ════════════════════════════════════════════════════════════════════════

-- ── Cirurgias Particulares ────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'guias-pendentes-matutino') THEN
    PERFORM cron.unschedule('guias-pendentes-matutino');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'guias-pendentes-vespertino') THEN
    PERFORM cron.unschedule('guias-pendentes-vespertino');
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.fn_alertar_guias_nao_preenchidas(text, date, boolean);

-- Verificação diária continua (correção + log), sem notificar (p_notificar=false)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cirurgias-particulares-check') THEN
    PERFORM cron.unschedule('cirurgias-particulares-check');
  END IF;
END $$;

SELECT cron.schedule(
  'cirurgias-particulares-check',
  '30 23 * * *',
  $$SELECT public.fn_verificar_cirurgias_particulares('cron', false)$$
);

-- ── Cateter Peridural: eventos fora, alertas ficam ───────────────────────
DROP TRIGGER IF EXISTS tr_cateter_notif_novo ON public.cateteres_peridural;
DROP TRIGGER IF EXISTS tr_cateter_notif_evolucao ON public.cateteres_peridural_followup;
DROP TRIGGER IF EXISTS tr_cateter_notif_retirada ON public.cateteres_peridural;

DROP FUNCTION IF EXISTS public.tg_cateter_notif_novo();
DROP FUNCTION IF EXISTS public.tg_cateter_notif_evolucao();
DROP FUNCTION IF EXISTS public.tg_cateter_notif_retirada();
DROP FUNCTION IF EXISTS public.insert_cateter_notification(uuid, text, text, text, text);

-- ── Acumulado fora (backup feito antes do apply) ──────────────────────────
DELETE FROM public.notifications
WHERE sender_name IN ('Cirurgias Particulares', 'Gestão de Cateteres');

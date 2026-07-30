-- ════════════════════════════════════════════════════════════════════════
-- 20260730150000_escala_notificacoes_cleanup.sql
-- Decisão do dono 30/07: a Escala Cirúrgica NÃO manda mais notificação
-- nenhuma (as 6 fontes client-side saíram no commit 3b2c8aa — a inbox
-- tinha 99 não lidas em 23 pessoas). Esta migration fecha o lado servidor:
--
-- 1) Desliga o cron `escala-amanha-check` (aviso 18h "escala de amanhã não
--    publicada", só p/ o dono — 10/10 instâncias não lidas; dono mandou
--    retirar) e derruba a função dele.
-- 2) APAGA todas as notificações já emitidas pela escala (sender_name =
--    'Escala Cirúrgica') — inclui as do cron acima, mesmo remetente.
--    NÃO toca nas de 'Cirurgias Particulares' (category 'escala' também,
--    mas módulo de cobrança — fora do pedido).
--
-- Idempotente: guards IF EXISTS; DELETE re-executado remove 0 linhas.
-- Rollback: cron/função re-criáveis por 20260721210000_escala_amanha_check
--           (re-aplicar); as notificações apagadas NÃO voltam (intencional).
-- LGPD: redução de dados — conteúdo operacional com nomes de profissionais;
--       exclusão definitiva a pedido do controlador.
-- ════════════════════════════════════════════════════════════════════════

-- 1) Cron das 18h fora (guard: unschedule falha se o job não existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'escala-amanha-check') THEN
    PERFORM cron.unschedule('escala-amanha-check');
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.notify_escala_amanha_faltante();

-- 2) Apaga o acúmulo (109 linhas em 30/07; lidas e não lidas — pedido do dono)
DELETE FROM public.notifications
WHERE sender_name = 'Escala Cirúrgica';

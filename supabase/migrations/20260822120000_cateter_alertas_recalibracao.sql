-- ════════════════════════════════════════════════════════════════════════
-- 20260822120000_cateter_alertas_recalibracao.sql
-- Cateter Peridural — recalibração do eixo "não evoluído" (revisão 22/08)
--
-- Duas correções, ambas medidas contra a produção (107 cateteres desde
-- 16/03, 146 evoluções, 55 intervalos entre evoluções consecutivas):
--
--  1. O warning "sem evolução" sobe de 30h para 36h. A distribuição real dos
--     intervalos é mediana 21,5h · p90 32,8h · máximo 34,4h; por faixa:
--     24–30h = 10 · 30–34h = 6 · 34–36h = 0 · 36–42h = 0 · >42h = 4.
--     Ou seja, existe um VALE VAZIO entre 34h e 42h — nenhuma visita real caiu
--     ali. Os 6 intervalos de 30–34h são rotina atrasada (a visita ACONTECEU) e
--     hoje acendem alerta; os 4 acima de 42h são o dia efetivamente pulado.
--     36h fica no meio do vale: apaga os 6 falso-positivos sem perder nenhum
--     atraso real. O crítico de 42h não muda.
--     ⚠️ Espelhado em src/data/cateterPeridualConfig.js
--     (EVOLUCAO_WARNING_HOURS / EVOLUCAO_CRITICAL_HOURS) — mudar um exige o outro.
--
--  2. Cateter NUNCA evoluído sai do eixo "não evoluído". Sem nenhuma evolução,
--     a base do cálculo era a inserção, então ao passar do corte o mesmo cateter
--     disparava os DOIS eixos no mesmo run: "ativo há 24h — registrar PO1"
--     (normal) e "sem evolução há 30h" (alta), sobre o mesmo fato e para as
--     mesmas 57 pessoas. Aconteceu em 11/08 (paciente DG, 32h) e 18/08
--     (paciente OF, 30h). Quem cobra o cateter ainda sem nenhuma evolução são os
--     lembretes de PO1/PO2, que já existem e já têm gate por max(dia_po).
--     ⚠️ O CARD do app continua mostrando o alerta nesse caso (lá o nível cai no
--     fallback da inserção de propósito — a tela precisa dizer que nada foi
--     registrado). A divergência é intencional e está documentada nos dois lados.
--
-- Não muda: cortes de duração 72h/96h e seus textos, gates por max(dia_po),
-- destinatários (papéis clínicos + admins), horário do cron (17h BRT) e as
-- chaves de dedup — republicar não reenvia o que já foi enviado.
--
-- Idempotente (CREATE OR REPLACE). Rollback: restaurar a definição da migration
-- 20260808120000 (corte 30h e eixo sem o gate de ultima_avaliacao_at).
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

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
    -- Sem coalesce de propósito: cateter nunca evoluído fica com v_horas_av NULL
    -- e é tratado no bloco do eixo, abaixo.
    v_horas_av  := EXTRACT(EPOCH FROM (now() - c.ultima_avaliacao_at)) / 3600;

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

    -- ── NÃO EVOLUÍDO (janela diária, 36h/42h — espelha o front) ──
    -- Só para quem JÁ TEM ao menos uma evolução: sem nenhuma, o lembrete de
    -- PO1/PO2 acima já cobra o mesmo fato e os dois saíam juntos.
    IF c.ultima_avaliacao_at IS NOT NULL THEN
      IF v_horas_av >= 42 THEN
        PERFORM public._cateter_reminder_insert(c.id, 'cateter-peridural-naoevoluido',
          'cateter-naoevoluido_' || c.id::text || '_' || v_today,
          'CRÍTICO: cateter peridural sem evolução',
          'Cateter peridural sem evolução PO há ' || floor(v_horas_av)::text || 'h' || v_pac || v_suffix || '. Registrar evolução.',
          'urgente');
      ELSIF v_horas_av >= 36 THEN
        PERFORM public._cateter_reminder_insert(c.id, 'cateter-peridural-naoevoluido',
          'cateter-naoevoluido_' || c.id::text || '_' || v_today,
          'Cateter peridural sem evolução há mais de um dia',
          'Cateter peridural sem evolução PO há ' || floor(v_horas_av)::text || 'h' || v_pac || v_suffix || '. Registrar evolução.',
          'alta');
      END IF;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_cateter_reminders() TO service_role;

COMMIT;

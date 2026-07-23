-- ════════════════════════════════════════════════════════════════════════
-- 20260723100000_cirurgias_particulares_verificacao_diaria.sql
-- Sistema de VERIFICAÇÃO RECORRENTE + AUTO-CORREÇÃO + APRENDIZADO da
-- cobrança de cirurgias particulares (pedido do dono 2026-07-23).
--
-- Motivação: dois erros reais em 2 dias ("Part" abreviado não importava;
-- lote PART/SC importou indevidamente) — ambos só descobertos pelo dono
-- olhando a listagem. Este job fecha o ciclo sozinho, todo dia:
--
--   A. AUTO-CORREÇÃO — caso elegível (regra vigente: convênio puramente
--      particular + paciente identificado + escala publicada + não
--      suspenso) que esteja SEM lançamento ativo (janela 7 dias) é
--      importado na hora (rede de segurança p/ trigger perdido/downtime).
--   B. WATCHLIST (aprendizado) — casos que PARECEM particular mas a regra
--      não importa: convênio contém PART sem ser puro (novas abreviações/
--      compostos) OU convênio puro em linha SEM paciente (lote). Nunca
--      decidimos sozinhos (regra do dono 2026-07-22): o achado vira
--      notificação p/ o admin DECIDIR; a decisão é codificada nos 5
--      espelhos do classificador (ver skill /cirurgias-particulares).
--   C. CONSISTÊNCIA — lançamento ativo cujo caso foi SUSPENSO na escala.
--   D. HIGIENE — lançamentos "Completar dados" (sem CPF ou nome em
--      iniciais) parados há mais de 48h.
--
-- Cada execução grava uma linha em cirurgias_particulares_check_log
-- (histórico p/ medir recorrência de erro) e, se houver A/B/C, notifica
-- os ADMINS (dedup 1/dia via índice único de notifications). LGPD: o log
-- fica sob a MESMA RLS do módulo; notificação leva só CONTAGENS.
--
-- Rollback: cron.unschedule('cirurgias-particulares-check');
--           DROP FUNCTION fn_verificar_cirurgias_particulares(text, boolean);
--           DROP TABLE cirurgias_particulares_check_log;
-- ════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_cron;

BEGIN;

-- ── Log das verificações (histórico do sistema de aprendizado) ─────────
CREATE TABLE IF NOT EXISTS public.cirurgias_particulares_check_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  origem TEXT NOT NULL DEFAULT 'cron',           -- 'cron' | 'manual'
  corrigidos INT NOT NULL DEFAULT 0,             -- A: auto-importados
  suspeitos INT NOT NULL DEFAULT 0,              -- B: aguardando decisão humana
  suspensos INT NOT NULL DEFAULT 0,              -- C: lançamento ativo c/ caso suspenso
  incompletos INT NOT NULL DEFAULT 0,            -- D: completar dados >48h
  achados JSONB NOT NULL DEFAULT '[]'::jsonb     -- detalhes (iniciais/sala/convênio — nunca nome/CPF)
);

CREATE INDEX IF NOT EXISTS idx_cirurgias_check_log_run_at
  ON public.cirurgias_particulares_check_log (run_at DESC);

ALTER TABLE public.cirurgias_particulares_check_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cirurgias_particulares_check_log FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cirurgias_check_log_select" ON public.cirurgias_particulares_check_log;
CREATE POLICY "cirurgias_check_log_select" ON public.cirurgias_particulares_check_log
  FOR SELECT TO authenticated
  USING ((select public.can_write_cirurgias_particulares()));
-- Sem policy de escrita: só a função (SECURITY DEFINER/cron) grava.
REVOKE INSERT, UPDATE, DELETE ON public.cirurgias_particulares_check_log FROM anon, authenticated;

-- ── A verificação ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_verificar_cirurgias_particulares(
  p_origem text DEFAULT 'cron',
  p_notificar boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_janela date := current_date - 7;
  v_corrigidos int := 0;
  v_relinked int := 0;
  v_suspeitos int := 0;
  v_suspensos int := 0;
  v_incompletos int := 0;
  v_achados jsonb := '[]'::jsonb;
  v_rows jsonb;
BEGIN
  -- A0. RE-VÍNCULO de órfãos antes de inserir (republicação + trigger perdido:
  -- sem isto o INSERT abaixo duplicaria a cobrança do mesmo paciente).
  -- Sub-bloco: colisão rara no índice único não pode derrubar o resto.
  BEGIN
    UPDATE public.cirurgias_particulares cp
       SET escala_caso_id = c.id, updated_at = now()
      FROM public.escala_cirurgica_caso c
      JOIN public.escala_cirurgica e ON e.id = c.escala_id
     WHERE e.status = 'publicada'
       AND e.data >= v_janela
       AND public.fn_convenio_particular(c.convenio)
       AND nullif(btrim(coalesce(c.paciente_iniciais, '')), '') IS NOT NULL
       AND coalesce(c.status_extra, '') <> 'suspensa'
       AND cp.cancelada_em IS NULL
       AND cp.escala_caso_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.escala_cirurgica_caso c2 WHERE c2.id = cp.escala_caso_id)
       AND cp.data_cirurgia = e.data
       AND cp.local = CASE e.hospital WHEN 'unimed' THEN 'Unimed' WHEN 'hro' THEN 'HRO'
                                      WHEN 'materno' THEN 'Materno-infantil' ELSE e.hospital END
       AND cp.cirurgiao = coalesce(nullif(btrim(c.cirurgiao), ''), 'A completar')
       AND cp.procedimento = coalesce(nullif(btrim(c.procedimento), ''), 'A completar')
       AND NOT EXISTS (
         SELECT 1 FROM public.cirurgias_particulares cp2
         WHERE cp2.escala_caso_id = c.id AND cp2.cancelada_em IS NULL
       );
    GET DIAGNOSTICS v_relinked = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'fn_verificar_cirurgias_particulares (re-vinculo): %', SQLERRM;
  END;

  -- A. AUTO-CORREÇÃO: elegíveis sem lançamento ativo → importa (regra vigente)
  WITH candidatos AS (
    SELECT c.id, c.paciente_iniciais, c.cirurgiao, c.anestesista, c.anestesista_user_id,
           c.procedimento, c.sala, e.data, e.hospital
    FROM public.escala_cirurgica_caso c
    JOIN public.escala_cirurgica e ON e.id = c.escala_id
    WHERE e.status = 'publicada'
      AND e.data >= v_janela
      AND public.fn_convenio_particular(c.convenio)
      AND nullif(btrim(coalesce(c.paciente_iniciais, '')), '') IS NOT NULL
      AND coalesce(c.status_extra, '') <> 'suspensa'
      AND NOT EXISTS (
        SELECT 1 FROM public.cirurgias_particulares cp
        WHERE cp.escala_caso_id = c.id AND cp.cancelada_em IS NULL
      )
  ), inseridos AS (
    INSERT INTO public.cirurgias_particulares (
      paciente, cirurgiao, anestesista_nome, anestesista_user_id,
      data_cirurgia, procedimento, local, valor, status_pagamento,
      escala_caso_id, created_by_name
    )
    SELECT
      btrim(k.paciente_iniciais),
      coalesce(nullif(btrim(k.cirurgiao), ''), 'A completar'),
      coalesce(
        p.nome,
        CASE WHEN btrim(coalesce(k.anestesista, '')) ~ '[[:alpha:]]'
             THEN btrim(k.anestesista) END,
        'A definir'
      ),
      k.anestesista_user_id,
      k.data,
      coalesce(nullif(btrim(k.procedimento), ''), 'A completar'),
      CASE k.hospital WHEN 'unimed' THEN 'Unimed' WHEN 'hro' THEN 'HRO'
                      WHEN 'materno' THEN 'Materno-infantil' ELSE k.hospital END,
      0, 'pendente', k.id, 'Verificação diária (auto)'
    FROM candidatos k
    LEFT JOIN public.profiles p ON p.id = k.anestesista_user_id
    RETURNING escala_caso_id
  )
  SELECT count(*), coalesce(jsonb_agg(jsonb_build_object(
           'tipo', 'auto_corrigido', 'hospital', k.hospital, 'data', k.data,
           'sala', k.sala, 'iniciais', k.paciente_iniciais)), '[]'::jsonb)
    INTO v_corrigidos, v_rows
  FROM inseridos i JOIN candidatos k ON k.id = i.escala_caso_id;
  v_achados := v_achados || v_rows;
  v_corrigidos := v_corrigidos + v_relinked;

  -- B. WATCHLIST: parece particular mas a regra não importa → decisão humana.
  --    Sem NENHUM lançamento (nem cancelado — cancelado c/ motivo = já decidido).
  SELECT count(*), coalesce(jsonb_agg(jsonb_build_object(
           'tipo', CASE WHEN NOT public.fn_convenio_particular(c.convenio)
                        THEN 'convenio_composto' ELSE 'lote_sem_paciente' END,
           'hospital', e.hospital, 'data', e.data, 'sala', c.sala,
           'convenio', c.convenio, 'iniciais', c.paciente_iniciais)), '[]'::jsonb)
    INTO v_suspeitos, v_rows
  FROM public.escala_cirurgica_caso c
  JOIN public.escala_cirurgica e ON e.id = c.escala_id
  WHERE e.status = 'publicada'
    AND e.data >= v_janela
    -- \m = início de palavra: pega compostos/abreviações ("PART/SC", "UNIMED/PART")
    -- sem falso-positivo de dicionário (PARTO, PARTE, DEPARTAMENTO, APART...)
    AND upper(coalesce(c.convenio, '')) ~ '\mPART(ICULAR)?([^A-Z]|$)'
    AND (
      NOT public.fn_convenio_particular(c.convenio)
      OR nullif(btrim(coalesce(c.paciente_iniciais, '')), '') IS NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.cirurgias_particulares cp WHERE cp.escala_caso_id = c.id
    );
  v_achados := v_achados || v_rows;

  -- C. CONSISTÊNCIA: lançamento ativo com caso SUSPENSO na escala
  SELECT count(*), coalesce(jsonb_agg(jsonb_build_object(
           'tipo', 'caso_suspenso', 'hospital', e.hospital, 'data', e.data,
           'sala', c.sala, 'iniciais', c.paciente_iniciais)), '[]'::jsonb)
    INTO v_suspensos, v_rows
  FROM public.cirurgias_particulares cp
  JOIN public.escala_cirurgica_caso c ON c.id = cp.escala_caso_id
  JOIN public.escala_cirurgica e ON e.id = c.escala_id
  WHERE cp.cancelada_em IS NULL
    AND c.status_extra = 'suspensa';
  v_achados := v_achados || v_rows;

  -- D. HIGIENE: "Completar dados" parado há mais de 48h (só contagem)
  SELECT count(*) INTO v_incompletos
  FROM public.cirurgias_particulares cp
  WHERE cp.cancelada_em IS NULL
    AND cp.created_at < now() - interval '48 hours'
    AND (cp.paciente_cpf IS NULL OR cp.paciente !~ '[[:alpha:]]{3,}');

  INSERT INTO public.cirurgias_particulares_check_log
    (origem, corrigidos, suspeitos, suspensos, incompletos, achados)
  VALUES (p_origem, v_corrigidos, v_suspeitos, v_suspensos, v_incompletos, v_achados);

  -- Notificação (só contagens — LGPD) p/ ADMINS quando há ação a tomar.
  -- Sub-bloco: falha aqui NÃO pode desfazer as correções da seção A nem o log.
  IF p_notificar AND (v_corrigidos > 0 OR v_suspeitos > 0 OR v_suspensos > 0) THEN
    BEGIN
    INSERT INTO public.notifications (
      recipient_id, category, subject, content, sender_name, priority,
      action_url, action_label, dismissable,
      related_entity_type, related_entity_id
    )
    SELECT
      p.id,
      'escala',
      'Cirurgias Particulares — verificação diária',
      concat_ws(' · ',
        CASE WHEN v_corrigidos > 0 THEN v_corrigidos || ' lançamento(s) recuperado(s) automaticamente' END,
        CASE WHEN v_suspeitos > 0 THEN v_suspeitos || ' caso(s) suspeito(s) aguardando sua decisão (convênio composto/lote)' END,
        CASE WHEN v_suspensos > 0 THEN v_suspensos || ' lançamento(s) com cirurgia suspensa na escala' END,
        CASE WHEN v_incompletos > 0 THEN v_incompletos || ' lançamento(s) a completar (>48h)' END
      ),
      'Cirurgias Particulares', 'alta',
      'cirurgiasParticulares', 'Abrir cobranças', true,
      'cirurgias-check', current_date::text
    FROM public.profiles p
    WHERE p.active IS NOT FALSE
      AND p.id IN (SELECT firebase_uid FROM public.admin_users)
    ON CONFLICT (related_entity_type, related_entity_id, recipient_id)
      WHERE related_entity_id IS NOT NULL
      DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'fn_verificar_cirurgias_particulares (notificacao): %', SQLERRM;
    END;
  END IF;

  RETURN jsonb_build_object(
    'corrigidos', v_corrigidos, 'suspeitos', v_suspeitos,
    'suspensos', v_suspensos, 'incompletos', v_incompletos
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_verificar_cirurgias_particulares: %', SQLERRM;
  RETURN jsonb_build_object('erro', SQLERRM);
END;
$$;

-- Não expor via PostgREST: só pg_cron (postgres) e a skill (mgmt API) executam.
REVOKE ALL ON FUNCTION public.fn_verificar_cirurgias_particulares(text, boolean) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.fn_verificar_cirurgias_particulares(text, boolean) IS
  'Verificação diária da cobrança particular: auto-corrige elegíveis sem lançamento (janela 7d), sinaliza suspeitos (PART composto/lote — decisão humana, regra do dono 2026-07-22), aponta suspensos e incompletos. Log em cirurgias_particulares_check_log; notifica admins (dedup 1/dia).';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cirurgias-particulares-check') THEN
    PERFORM cron.unschedule('cirurgias-particulares-check');
  END IF;
END $$;

-- 23:30 UTC = 20:30 BRT, diário (pega publicações tardias do vespertino)
SELECT cron.schedule(
  'cirurgias-particulares-check',
  '30 23 * * *',
  $$SELECT public.fn_verificar_cirurgias_particulares('cron', true)$$
);

COMMIT;

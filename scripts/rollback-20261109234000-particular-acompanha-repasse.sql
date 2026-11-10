-- ROLLBACK de 20261109234000_cirurgia_particular_acompanha_repasse.sql: tira o gatilho do repasse
-- e as duas funções novas, e volta fn_sync_cirurgia_particular (20261002160000) e
-- fn_verificar_cirurgias_particulares (20260723100000) aos corpos que estavam no ar em 09/11/2026.
-- NÃO desfaz o anestesista já trocado em cobrança (a troca foi a regra vigente enquanto valeu).
-- De→para: nas trocas feitas pelo GATILHO, updated_by/updated_at na cobrança dizem quem e quando
-- e a captura da escala (desde 25/09) guarda o anestesista anterior do caso. Para as cobranças
-- mexidas pelo REPARO (scripts/repair-2026-11-09-particulares-repasse-e-continuacao.sql) isso não
-- basta: o de→para por linha está em public.cirurgias_particulares_reparo_2026_11_09, e o SQL
-- que desfaz o reparo está comentado no fim daquele arquivo. Este rollback não toca essa tabela.
-- Idempotente.

begin;
set local lock_timeout = '3s';
set local statement_timeout = '60s';

drop trigger if exists tr_caso_cobranca_acompanha_repasse on public.escala_cirurgica_caso;
drop function if exists public.fn_cirurgia_particular_acompanha_repasse();

CREATE OR REPLACE FUNCTION public.fn_sync_cirurgia_particular()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_escala public.escala_cirurgica%rowtype;
  v_local text;
  v_orphan uuid;
  v_anest_nome text;
  v_anest_fallback text;
  v_uid text;
  v_autor_nome text;
begin
  -- 02/10: continuação de cirurgia de outro turno não é cirurgia nova — a cobrança é a do caso
  -- de origem (a linha herda convênio e iniciais só para o card dizer o que está em sala)
  if coalesce(new.is_continuacao, false) then
    return new;
  end if;
  -- Só convênio PURAMENTE particular (composto tipo PART/SC não importa)
  if not public.fn_convenio_particular(new.convenio) then
    return new;
  end if;
  -- Regra do dono 2026-07-22: sem paciente IDENTIFICADO (lotes/linhas
  -- agregadas) não há cobrança a criar.
  if nullif(btrim(coalesce(new.paciente_iniciais, '')), '') is null then
    return new;
  end if;
  -- Suspensa não gera cobrança (des-suspender re-dispara via UPDATE)
  if new.status_extra = 'suspensa' then
    return new;
  end if;
  -- UPDATE: só age nas transições relevantes (des-suspendeu OU virou
  -- particular OU paciente foi identificado depois — ex.: lote desmembrado)
  if tg_op = 'UPDATE' then
    if not (
      (coalesce(old.status_extra, '') = 'suspensa' and coalesce(new.status_extra, '') <> 'suspensa')
      or (not public.fn_convenio_particular(old.convenio))
      or (nullif(btrim(coalesce(old.paciente_iniciais, '')), '') is null)
    ) then
      return new;
    end if;
  end if;

  select * into v_escala from public.escala_cirurgica where id = new.escala_id;
  if v_escala.id is null or v_escala.status <> 'publicada' then
    return new;
  end if;

  v_local := case v_escala.hospital
    when 'unimed' then 'Unimed'
    when 'hro' then 'HRO'
    when 'materno' then 'Materno-infantil'
    else v_escala.hospital
  end;

  if exists (
    select 1 from public.cirurgias_particulares cp
    where cp.escala_caso_id = new.id and cp.cancelada_em is null
  ) then
    return new;
  end if;

  v_uid := nullif(public.firebase_uid(), '');

  -- Republicação: re-vincula lançamento órfão equivalente em vez de duplicar
  select cp.id into v_orphan
  from public.cirurgias_particulares cp
  where cp.cancelada_em is null
    and cp.escala_caso_id is not null
    and cp.data_cirurgia = v_escala.data
    and cp.local = v_local
    and not exists (select 1 from public.escala_cirurgica_caso c2 where c2.id = cp.escala_caso_id)
    and cp.cirurgiao = coalesce(nullif(btrim(new.cirurgiao), ''), 'A completar')
    and cp.procedimento = coalesce(nullif(btrim(new.procedimento), ''), 'A completar')
  order by cp.created_at
  limit 1;

  if v_orphan is not null then
    update public.cirurgias_particulares
      set escala_caso_id = new.id, updated_at = now(), updated_by = v_uid
      where id = v_orphan;
    return new;
  end if;

  select p.nome into v_anest_nome from public.profiles p where p.id = new.anestesista_user_id;
  v_anest_fallback := nullif(btrim(new.anestesista), '');
  if v_anest_fallback !~ '[[:alpha:]]' then
    v_anest_fallback := null; -- '//', '?', '??' não são nomes
  end if;

  select p.nome into v_autor_nome from public.profiles p where p.id = v_uid;

  insert into public.cirurgias_particulares (
    paciente, cirurgiao, anestesista_nome, anestesista_user_id,
    data_cirurgia, procedimento, local, valor, status_pagamento,
    escala_caso_id, created_by, created_by_name
  ) values (
    btrim(new.paciente_iniciais),
    coalesce(nullif(btrim(new.cirurgiao), ''), 'A completar'),
    coalesce(v_anest_nome, v_anest_fallback, 'A definir'),
    new.anestesista_user_id,
    v_escala.data,
    coalesce(nullif(btrim(new.procedimento), ''), 'A completar'),
    v_local,
    0,
    'pendente',
    new.id,
    v_uid,
    coalesce(v_autor_nome, 'Importação automática')
  );

  return new;
exception when others then
  -- Cobrança NUNCA bloqueia a operação clínica (publicar/editar escala).
  raise warning 'fn_sync_cirurgia_particular (caso %): %', new.id, sqlerrm;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.fn_verificar_cirurgias_particulares(
  p_origem text DEFAULT 'cron',
  p_notificar boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
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
$function$;

-- só depois de fn_sync voltar ao corpo que não a chama
drop function if exists public.fn_cirurgia_particular_acompanha(uuid, text, text);

commit;

-- Conferência: gatilho = 0, funcoes_novas = 0
select
  (select count(*) from pg_trigger where tgname = 'tr_caso_cobranca_acompanha_repasse' and not tgisinternal) as gatilho,
  (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
     and proname in ('fn_cirurgia_particular_acompanha', 'fn_cirurgia_particular_acompanha_repasse')) as funcoes_novas;

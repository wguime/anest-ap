-- Cobrança de particular ACOMPANHA O REPASSE do caso (dono 09/11/2026).
--
-- Pergunta feita ao dono: "uma cirurgia particular foi publicada com o Dr. A e passada ao Dr. B
-- pelo app; quem aparece na cobrança?" Resposta: quem fez (Dr. B) — enquanto a cobrança ainda não
-- foi preenchida por ninguém ela acompanha o repasse; depois de preenchida, não muda mais sozinha.
-- Até aqui a cobrança nascia com o anestesista da publicação e ficava nele: o gatilho
-- tr_caso_sync_cirurgia_particular só dispara em status_extra/convenio/paciente_iniciais, e o
-- repasse (updateAnestesistaCasos), a troca executada (rpc_escala_executar_troca) e a
-- republicação mexem em anestesista/anestesista_user_id.
--
-- "AINDA NÃO PREENCHIDA" (critério, em uma frase): a cobrança está como o app a criou — sem CPF,
-- sem valor (R$ 0), pagamento "pendente" sem data e sem observação. O formulário não salva sem
-- CPF, então CPF vazio prova que ninguém salvou a guia; valor/pagamento/observação cobrem edição
-- feita por fora do formulário. O nome do paciente NÃO entra no critério: o próprio app completa
-- o nome sozinho depois da publicação (completarPacienteDoCaso), e isso não é preenchimento
-- humano. Cancelada nunca muda.
--
-- Decisões:
--   · DUPLA ("A + B" no caso; dono em 09/11, "deixar o nome dos dois anestesistas"): a cobrança
--     ainda não preenchida recebe os dois nomes COMO ESTÃO NO CASO e o login fica vazio (dupla
--     não cabe num login, como na escala). Caso que já NASCE dupla sempre gravou assim.
--   · Caso que fica SEM anestesista ("?", "//", vazio): a cobrança guarda o último nome conhecido.
--   · CONTINUAÇÃO: a cobrança é a do caso da manhã (20261002160000); repasse da linha de
--     continuação da tarde não mexe em cobrança nenhuma. Confirmado pelo dono em 10/11/2026
--     ("começou de manhã com o Dr. A e continuou à tarde com o Dr. B: de quem é a cobrança?" —
--     "De quem começou").
--   · Convênio não particular: nada a fazer.
--
-- O que muda:
--   1. fn_cirurgia_particular_acompanha(caso, anestesista, login) — NOVA, interna (sem EXECUTE
--      para anon/authenticated): troca o anestesista da cobrança ligada ao caso, só se não
--      preenchida. Rastro: updated_by/updated_by_name = quem fez o repasse (firebase_uid() da
--      sessão — nunca um autor inventado; sem sessão fica nulo) e updated_at; o de→para do
--      anestesista continua registrado pela captura da escala (tr_escala_caso_captura_update).
--   2. fn_cirurgia_particular_acompanha_repasse() + gatilho tr_caso_cobranca_acompanha_repasse
--      (AFTER UPDATE OF anestesista, anestesista_user_id, só quando o valor muda) — NOVOS.
--      Como o gatilho vizinho, NUNCA bloqueia a operação clínica (exception → warning).
--   3. fn_sync_cirurgia_particular: +1 chamada no ramo do re-vínculo de órfão (republicação com
--      outro anestesista também acompanha). Resto idêntico.
--   4. fn_verificar_cirurgias_particulares (cron 20:30): passa a ignorar is_continuacao no
--      re-vínculo (A0) e na auto-correção (A), como o gatilho já fazia — sem isso o cron podia
--      abrir uma 2ª cobrança da mesma cirurgia. Resto idêntico.
--
-- Definições de partida: pg_get_functiondef de PRODUÇÃO lido em 09/11/2026 — os corpos no ar de
-- fn_sync_cirurgia_particular (md5 17420c0b…) e fn_verificar_cirurgias_particulares
-- (md5 66d1e142…) são byte a byte os de 20261002160000 e 20260723100000 do repo.
-- Não regrava cobrança existente (sem backfill): vale para os repasses daqui em diante.
--
-- Rollback: scripts/rollback-20261109234000-particular-acompanha-repasse.sql
-- Idempotente (CREATE OR REPLACE + DROP TRIGGER IF EXISTS).

begin;
-- teto: a Management API devolve 524 depois de ~100 s e a transação podia seguir sozinha
set local lock_timeout = '3s';
set local statement_timeout = '60s';

-- 1. A troca em si, guardada pelo critério de "ainda não preenchida" -------------------------
create or replace function public.fn_cirurgia_particular_acompanha(
  p_caso_id uuid, p_anestesista text, p_anestesista_user_id text
)
 returns void
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_texto text := nullif(btrim(coalesce(p_anestesista, '')), '');
  v_login text := nullif(btrim(coalesce(p_anestesista_user_id, '')), '');
  v_nome text;
  v_uid text := nullif(public.firebase_uid(), '');
  v_autor_nome text;
begin
  if p_caso_id is null then
    return;
  end if;
  -- '?', '//', vazio não são nomes: o caso ficou sem anestesista — a cobrança guarda o último
  if v_texto !~ '[[:alpha:]]' then
    v_texto := null;
  end if;
  if v_texto ~ '\+' then
    -- dupla "A + B": os dois nomes como estão no caso, sem login (dono 09/11)
    v_nome := v_texto;
    v_login := null;
  else
    if v_login is not null then
      select p.nome into v_nome from public.profiles p where p.id = v_login;
    end if;
    v_nome := coalesce(nullif(btrim(coalesce(v_nome, '')), ''), v_texto);
  end if;
  if v_nome is null then
    return;
  end if;

  select p.nome into v_autor_nome from public.profiles p where p.id = v_uid;

  update public.cirurgias_particulares cp
     set anestesista_nome = v_nome,
         anestesista_user_id = v_login,
         updated_at = now(),
         updated_by = v_uid,
         updated_by_name = v_autor_nome
   where cp.escala_caso_id = p_caso_id
     and cp.cancelada_em is null
     -- AINDA NÃO PREENCHIDA: como o app criou
     and cp.paciente_cpf is null
     and cp.valor = 0
     and cp.status_pagamento = 'pendente'
     and cp.data_pagamento is null
     and nullif(btrim(coalesce(cp.observacoes, '')), '') is null
     and (cp.anestesista_nome is distinct from v_nome
          or cp.anestesista_user_id is distinct from v_login);
end;
$function$;

revoke all on function public.fn_cirurgia_particular_acompanha(uuid, text, text) from public;
revoke all on function public.fn_cirurgia_particular_acompanha(uuid, text, text) from anon, authenticated;

-- 2. O gatilho do repasse ---------------------------------------------------------------------
create or replace function public.fn_cirurgia_particular_acompanha_repasse()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public'
as $function$
begin
  -- continuação: a cobrança é a do caso da manhã, não desta linha
  if coalesce(new.is_continuacao, false) then
    return new;
  end if;
  if not public.fn_convenio_particular(new.convenio) then
    return new;
  end if;
  perform public.fn_cirurgia_particular_acompanha(new.id, new.anestesista, new.anestesista_user_id);
  return new;
exception when others then
  -- Cobrança NUNCA bloqueia a operação clínica (repasse/troca na escala).
  raise warning 'fn_cirurgia_particular_acompanha_repasse (caso %): %', new.id, sqlerrm;
  return new;
end;
$function$;

drop trigger if exists tr_caso_cobranca_acompanha_repasse on public.escala_cirurgica_caso;
create trigger tr_caso_cobranca_acompanha_repasse
  after update of anestesista, anestesista_user_id on public.escala_cirurgica_caso
  for each row
  when (old.anestesista is distinct from new.anestesista
        or old.anestesista_user_id is distinct from new.anestesista_user_id)
  execute function public.fn_cirurgia_particular_acompanha_repasse();

-- 3. Republicação: o órfão re-vinculado também acompanha (única mudança: bloco "09/11") -------
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
    -- 09/11: republicada com outro anestesista — a cobrança ainda não preenchida acompanha
    perform public.fn_cirurgia_particular_acompanha(new.id, new.anestesista, new.anestesista_user_id);
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

-- 4. Cron das 20:30 sem continuação (única mudança: as 2 linhas "09/11") ----------------------
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
       AND NOT coalesce(c.is_continuacao, false) -- 09/11: como o gatilho (20261002160000)
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
      AND NOT coalesce(c.is_continuacao, false) -- 09/11: como o gatilho (20261002160000)
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

commit;

-- Conferência: gatilho = 1, as outras três colunas = true
select
  (select count(*) from pg_trigger
    where tgname = 'tr_caso_cobranca_acompanha_repasse' and not tgisinternal) as gatilho,
  (select prosrc like '%fn_cirurgia_particular_acompanha(new.id%' from pg_proc
    where oid = 'public.fn_sync_cirurgia_particular()'::regprocedure) as republicacao_acompanha,
  (select prosrc like '%NOT coalesce(c.is_continuacao, false)%' from pg_proc
    where oid = 'public.fn_verificar_cirurgias_particulares(text, boolean)'::regprocedure) as cron_sem_continuacao,
  not has_function_privilege('authenticated', 'public.fn_cirurgia_particular_acompanha(uuid, text, text)', 'execute') as interna;

-- ============================================================================
-- Escala Cirúrgica — as DECISÕES da conferência viajam DENTRO da publicação
-- (auditoria de 02/09, Onda 3, item 3.1; achados A5, A6, A9 e A10).
--
-- Até aqui `rpc_publicar_escala_turno` recebia só casos, rodapé e ajuda. A troca
-- declarada na conferência, a duplicidade confirmada como intencional e o
-- "está certo, fica Livre" eram patches DEPOIS da publicação (um `rpc_escala_
-- patch_liberacao` por decisão, com `.catch(() => {})`) ou não eram gravados em
-- lugar nenhum. E republicar o MESMO turno apagava todas as chaves `turno:*` de
-- `liberacoes` e `linha_overrides`: trocaCom, assumidaPor, origem, observação,
-- local e término sumiam junto com a liberação — foi o que obrigou o dono a
-- remarcar o Eduardo às 13:10 em 20/08, depois de já ter corrigido às 12:44.
--
-- O que muda (mesma transação de sempre, mesmo lock do cabeçalho):
--
--   p_linha_overrides  { chave: { trocaCom?, duplicidade?, conferido?, origem?,
--                                 observacao?, local?, termino? } }
--        Decisões da conferência, por chave da linha SEM o prefixo do turno (a
--        RPC prefixa). `por`/`em` são carimbados aqui, nunca aceitos do cliente
--        (mesma regra da RPC de patch). `assumidaPor` e `liberadoEm` NÃO entram
--        por aqui: só nascem de execução de troca ou de toque na fila.
--
--   p_preservar        { campos: [...], linhas: [{ chave, candidatas?, liberacao? }] }
--        De quem SEGUE na escala (o cliente diz quem, pela chave atual e pelas
--        candidatas — o apelido aprendido entre as duas publicações troca a
--        chave de nome para uid), os `campos` listados do override antigo são
--        copiados de volta. Decisão do dono (05/09): identidade e rastro
--        sobrevivem; a liberação continua zerando (regra de 23/07) — por isso
--        `liberacao` existe na linha mas o cliente não a manda. Ausente/null =
--        comportamento anterior (zera tudo do turno; é o que o FDS faz).
--
--   Re-apontar: posição ASSUMIDA preservada (assumidaPor com `de.uid`) tem os
--        casos recém-inseridos no nome do dono antigo transferidos para quem
--        assumiu, e `casoIds` ganha os ids novos — hoje esses casos reapareciam
--        como linha extra `chave#casos` (republicação conflituosa).
--
--   Rastro: a RPC liga o GUC `anest.publicacao` na transação e o trigger
--        `log_escala_troca` rotula por ele — `reset_publicacao` para o que a
--        publicação apagou, `publicacao` para o que ela declarou, `manual` para
--        o resto. Antes o rótulo vinha de `v_new = '{}'`: com a manhã marcada,
--        republicar a tarde gravava a rajada de desfeitas como "manual" (A10).
--
-- UMA função, não dois overloads: o PostgREST resolve a chamada pelos NOMES dos
-- parâmetros e, com `(5 args)` e `(5 args + 2 com default)` coexistindo, a
-- chamada de 5 chaves casa as duas e volta 300 "could not choose the best
-- candidate". A antiga é dropada e a nova tem defaults — a chamada de 5 chaves
-- (FDS, legado) continua funcionando sem mudar nada no cliente.
--
-- Corpo REESCRITO por inteiro a partir de 20260815120000 + o patch por âncora de
-- 20260818140000 (gravidade). Conferido byte a byte contra a definição viva em
-- 05/09 antes de escrever (8.527 chars iguais); o guard abaixo aborta se a viva
-- não tiver os dois marcadores.
--
-- Rollback (manual) — ⚠️ A ORDEM IMPORTA, e é o INVERSO do que parece natural. Enquanto as
-- DUAS assinaturas coexistirem, toda chamada de cinco chaves nomeadas volta a dar 300
-- "could not choose the best candidate" no PostgREST: é o motivo de existir uma função só.
-- Então a de SETE argumentos sai ANTES de a antiga voltar, e os quatro passos vão num
-- `begin/commit` único (cada migration referenciada tem o seu — copiar os corpos):
--   1. drop function if exists public.rpc_publicar_escala_turno(date,text,text,jsonb,jsonb,jsonb,jsonb);
--   2. reaplicar o bloco da RPC de 20260815120000 (assinatura de 5 args);
--   3. reaplicar o patch de gravidade de 20260818140000 (âncora sobre a definição viva);
--   4. reaplicar o trigger log_escala_troca de 20260730200000 (motivo por `v_new = '{}'`).
-- Entre 1 e 2 NÃO existe função de publicação: fazer numa janela sem conferência aberta.
-- ============================================================================

begin;

set local lock_timeout = '3s';

-- ── 0) Guards ─────────────────────────────────────────────────────────────────
do $$
declare
  v5 text;
  v7 text;
  vt text;
begin
  v5 := pg_get_functiondef(to_regprocedure('public.rpc_publicar_escala_turno(date,text,text,jsonb,jsonb)')::oid);
  v7 := pg_get_functiondef(to_regprocedure('public.rpc_publicar_escala_turno(date,text,text,jsonb,jsonb,jsonb,jsonb)')::oid);
  if v5 is null and v7 is null then
    raise exception 'decisoes: rpc_publicar_escala_turno nao existe — migration fora de ordem';
  end if;
  -- a assinatura antiga tem de ser a versão viva conhecida (fds_meta + gravidade):
  -- hotfix desconhecido em prod seria sobrescrito em silêncio pelo corpo abaixo
  if v5 is not null and (position('gravidade' in v5) = 0 or position('fds_meta' in v5) = 0) then
    raise exception 'decisoes: definicao viva de rpc_publicar_escala_turno sem gravidade/fds_meta — versao inesperada, revisar antes de sobrescrever';
  end if;
  if v7 is not null then
    raise notice 'decisoes: assinatura nova ja existe — reaplicando (idempotente)';
  end if;
  vt := pg_get_functiondef('public.log_escala_troca()'::regprocedure);
  if position('reset_publicacao' in vt) = 0 then
    raise exception 'decisoes: log_escala_troca vivo nao e a versao de 20260730200000 — revisar antes de sobrescrever';
  end if;
end
$$;

-- ── 1) A assinatura antiga sai (ver cabeçalho: overload confunde o PostgREST) ──
drop function if exists public.rpc_publicar_escala_turno(date, text, text, jsonb, jsonb);

-- ── 2) A RPC ──────────────────────────────────────────────────────────────────
create or replace function public.rpc_publicar_escala_turno(
  p_data date,
  p_hospital text,
  p_turno text,
  p_header jsonb,
  p_casos jsonb,
  p_linha_overrides jsonb default null,
  p_preservar jsonb default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_id uuid;
  v_caller text := public.firebase_uid();
  v_status text := coalesce(nullif(p_header->>'status',''), 'publicada');
  v_old jsonb;
  v_ordem jsonb;
  v_ajuda jsonb;
  v_lib jsonb;
  v_over jsonb;
  v_turnos jsonb;
  v_pub jsonb;
  v_result jsonb;
  v_chave text;
  -- decisões e preservação (05/09)
  v_prefixo text := p_turno || ':';
  v_lo jsonb := nullif(p_linha_overrides, 'null'::jsonb);
  v_pres jsonb := nullif(p_preservar, 'null'::jsonb);
  v_over_antigo jsonb;
  v_lib_antigo jsonb;
  v_campos jsonb;
  v_linha jsonb;
  v_cand text;
  v_ant jsonb;
  v_keep jsonb;
  v_campo text;
  v_valor jsonb;
  v_asm jsonb;
  v_apelido text;
  v_ids jsonb;
begin
  if v_caller = '' then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  if p_turno not in ('matutino','vespertino') then
    raise exception 'turno_invalido' using errcode = '22023';
  end if;
  -- 'fds' = linha da fila única do fim de semana (2026-08-15); os demais são
  -- hospitais reais. Casos publicados numa linha 'fds' devem vir vazios (a
  -- fila deriva dos casos por hospital), mas a RPC não bloqueia — a conferência
  -- é quem publica e manda casos [].
  if p_hospital not in ('unimed','hro','materno','fds') then
    raise exception 'hospital_invalido' using errcode = '22023';
  end if;
  if v_status not in ('rascunho','publicada') then
    raise exception 'status_invalido' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_header->'ordem_liberacao','[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_header->'ajuda_externa','[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_casos,'[]'::jsonb)) <> 'array' then
    raise exception 'payload_formato_invalido' using errcode = '22023';
  end if;
  -- fds_meta pertence à linha 'fds' (COMMENT da coluna) — payload de hospital
  -- real com o campo é bug de cliente e é rejeitado, não gravado em silêncio.
  if p_header ? 'fds_meta' then
    if p_hospital <> 'fds' then
      raise exception 'payload_formato_invalido' using errcode = '22023';
    end if;
    if jsonb_typeof(p_header->'fds_meta') not in ('object','null') then
      raise exception 'payload_formato_invalido' using errcode = '22023';
    end if;
  end if;
  -- decisões: objeto de objetos, sem estado de execução/toque (que só nasce na fila)
  if v_lo is not null then
    if jsonb_typeof(v_lo) <> 'object' then
      raise exception 'payload_formato_invalido' using errcode = '22023';
    end if;
    for v_chave, v_valor in select key, value from jsonb_each(v_lo) loop
      if btrim(v_chave) = '' or jsonb_typeof(v_valor) <> 'object'
         or v_valor ? 'assumidaPor' or v_valor ? 'liberadoEm' or v_valor ? 'escalado' then
        raise exception 'payload_formato_invalido' using errcode = '22023';
      end if;
    end loop;
  end if;
  if v_pres is not null then
    if jsonb_typeof(v_pres) <> 'object'
       or jsonb_typeof(coalesce(v_pres->'campos','[]'::jsonb)) <> 'array'
       or jsonb_typeof(coalesce(v_pres->'linhas','[]'::jsonb)) <> 'array' then
      raise exception 'payload_formato_invalido' using errcode = '22023';
    end if;
    -- Cada campo é um NOME de campo do override. `por`/`em` ficam de fora porque são o
    -- carimbo do servidor: eles voltam junto com o que for preservado (mais abaixo), nunca
    -- por pedido do cliente. Chamada direta da RPC, fora do app, cai aqui.
    for v_campo in select jsonb_array_elements_text(coalesce(v_pres->'campos','[]'::jsonb)) loop
      if btrim(coalesce(v_campo,'')) = '' or v_campo in ('por','em') then
        raise exception 'payload_formato_invalido' using errcode = '22023';
      end if;
    end loop;
  end if;
  if not public.can_write_escala_cirurgica() then
    raise exception 'permission_denied: sem acesso à escala cirúrgica' using errcode = '42501';
  end if;

  -- O trigger de rastro (log_escala_troca) lê este GUC para rotular o que a
  -- PUBLICAÇÃO apagou/declarou; local à transação — some no commit/rollback.
  perform set_config('anest.publicacao', '1', true);

  -- Upsert e lock explícito: concorrência no mesmo dia/hospital fica serializada.
  insert into public.escala_cirurgica (data,hospital,status,created_by,created_at,updated_at)
  values (p_data,p_hospital,case when v_status='publicada' then 'publicada' else 'rascunho' end,v_caller,now(),now())
  on conflict (data,hospital) do nothing;
  select e.id, e.ordem_liberacao, e.ajuda_externa, e.liberacoes,
         e.linha_overrides, e.publicacao_turnos
    into v_id, v_ordem, v_ajuda, v_lib, v_over, v_turnos
    from public.escala_cirurgica e
   where e.data=p_data and e.hospital=p_hospital
   for update;

  -- Legado array/objeto é normalizado sem mover o estado do outro turno.
  v_ordem := case when jsonb_typeof(coalesce(v_ordem,'{}'))='array'
                  then jsonb_build_object('matutino',coalesce(v_ordem,'[]'))
                  else coalesce(v_ordem,'{}') end;
  v_ajuda := case when jsonb_typeof(coalesce(v_ajuda,'{}'))='array'
                  then jsonb_build_object('matutino',coalesce(v_ajuda,'[]'))
                  when jsonb_typeof(coalesce(v_ajuda,'{}'))='object' then coalesce(v_ajuda,'{}')
                  else '{}'::jsonb end;
  v_ordem := case when jsonb_typeof(v_ordem)='object' then v_ordem else '{}'::jsonb end;
  v_lib := case when jsonb_typeof(coalesce(v_lib,'{}'))='object' then coalesce(v_lib,'{}') else '{}'::jsonb end;
  v_over := case when jsonb_typeof(coalesce(v_over,'{}'))='object' then coalesce(v_over,'{}') else '{}'::jsonb end;
  v_turnos := case when jsonb_typeof(coalesce(v_turnos,'{}'))='object' then coalesce(v_turnos,'{}') else '{}'::jsonb end;
  -- `liberacoes` e `linha_overrides` permanecem mapas planos: os leitores e
  -- triggers existentes usam a chave estável da linha, não o turno.

  -- O que estava marcado ANTES desta publicação — é daqui que a preservação copia.
  v_over_antigo := v_over;
  v_lib_antigo := v_lib;

  -- O estado novo usa chaves namespaced (turno:chave). Assim, o reset do
  -- matutino nunca remove a mesma pessoa no vespertino. Chaves sem namespace
  -- são legado e permanecem até migração explícita, evitando perda silenciosa.
  for v_chave in select jsonb_object_keys(coalesce(v_lib, '{}'::jsonb)) loop
    if left(v_chave, length(p_turno) + 1) = p_turno || ':' then
      v_lib := v_lib - v_chave;
    end if;
  end loop;
  for v_chave in select jsonb_object_keys(coalesce(v_over, '{}'::jsonb)) loop
    if left(v_chave, length(p_turno) + 1) = p_turno || ':' then
      v_over := v_over - v_chave;
    end if;
  end loop;

  -- PRESERVAÇÃO (dono 05/09): de quem segue na escala, os campos pedidos do
  -- override antigo voltam — com o carimbo ORIGINAL (preservar não é ação nova).
  -- A entrada antiga é procurada pela chave atual e, na falta, pelas candidatas.
  if v_pres is not null then
    v_campos := coalesce(v_pres->'campos', '[]'::jsonb);
    for v_linha in select value from jsonb_array_elements(coalesce(v_pres->'linhas','[]'::jsonb)) loop
      v_chave := btrim(coalesce(v_linha->>'chave',''));
      if v_chave = '' or jsonb_typeof(v_linha) <> 'object' then continue; end if;
      v_ant := null;
      for v_cand in
        select v_chave
        union all
        select jsonb_array_elements_text(case when jsonb_typeof(v_linha->'candidatas') = 'array' then v_linha->'candidatas' else '[]'::jsonb end)
      loop
        if jsonb_typeof(v_over_antigo -> (v_prefixo || v_cand)) = 'object' then
          v_ant := v_over_antigo -> (v_prefixo || v_cand);
          exit;
        end if;
      end loop;
      if v_ant is not null then
        v_keep := '{}'::jsonb;
        for v_campo in select jsonb_array_elements_text(v_campos) loop
          if v_ant ? v_campo then
            v_keep := v_keep || jsonb_build_object(v_campo, v_ant -> v_campo);
          end if;
        end loop;
        if v_keep <> '{}'::jsonb then
          v_keep := v_keep || jsonb_build_object(
            'por', coalesce(v_ant -> 'por', to_jsonb(v_caller)),
            'em',  coalesce(v_ant -> 'em',  to_jsonb(now())));
          v_over := jsonb_set(v_over, array[v_prefixo || v_chave], v_keep, true);
        end if;
      end if;
      -- liberação (marca de Liberado / marcador do repasse): SÓ quando a linha pede.
      -- Hoje o cliente nunca pede (regra de 23/07 mantida pelo dono em 05/09).
      -- guarda de tipo em vez de cast cru: valor não-booleano tem de virar o mesmo
      -- `payload_formato_invalido` do resto, não um erro de cast do Postgres na tela
      if v_linha ? 'liberacao' and jsonb_typeof(v_linha->'liberacao') <> 'boolean' then
        raise exception 'payload_formato_invalido' using errcode = '22023';
      end if;
      if coalesce((v_linha->>'liberacao')::boolean, false) then
        for v_cand in
          select v_chave
          union all
          select jsonb_array_elements_text(case when jsonb_typeof(v_linha->'candidatas') = 'array' then v_linha->'candidatas' else '[]'::jsonb end)
        loop
          if v_lib_antigo ? (v_prefixo || v_cand) then
            v_lib := jsonb_set(v_lib, array[v_prefixo || v_chave], v_lib_antigo -> (v_prefixo || v_cand), true);
            exit;
          end if;
        end loop;
      end if;
    end loop;
  end if;

  -- DECISÕES da conferência: mescladas por cima do que foi preservado, com o
  -- carimbo do servidor (mesma regra da RPC de patch: `por`/`em` nunca vêm do cliente).
  if v_lo is not null then
    for v_chave, v_valor in select key, value from jsonb_each(v_lo) loop
      v_over := jsonb_set(
        v_over,
        array[v_prefixo || v_chave],
        coalesce(v_over -> (v_prefixo || v_chave), '{}'::jsonb)
          || (v_valor - 'por' - 'em')
          || jsonb_build_object('por', v_caller, 'em', now()),
        true);
    end loop;
  end if;

  -- Somente casos explicitamente publicados neste turno são substituídos.
  delete from public.escala_cirurgica_caso where escala_id=v_id and turno=p_turno;
  if jsonb_typeof(coalesce(p_casos,'[]'))='array' and jsonb_array_length(coalesce(p_casos,'[]'))>0 then
    insert into public.escala_cirurgica_caso
      (escala_id,sala,ordem,hora,tempo_estimado,termino_previsto,paciente_iniciais,idade,
       procedimento,convenio,cirurgiao,cirurgiao_display,anestesista,anestesista_user_id,
       residente,residente_user_id,bloco,is_continuacao,sem_anestesista,tipo,gravidade,turno)
    select v_id, coalesce(c->>'sala',''), coalesce((nullif(c->>'ordem',''))::int,0),
      nullif(c->>'hora',''), nullif(c->>'tempo_estimado',''), nullif(c->>'termino_previsto',''),
      nullif(c->>'paciente_iniciais',''), nullif(c->>'idade',''), nullif(c->>'procedimento',''),
      nullif(c->>'convenio',''), nullif(c->>'cirurgiao',''), nullif(c->>'cirurgiao_display',''),
      nullif(c->>'anestesista',''), nullif(c->>'anestesista_user_id',''), nullif(c->>'residente',''),
      nullif(c->>'residente_user_id',''), coalesce(nullif(c->>'bloco',''),'normal'),
      coalesce((nullif(c->>'is_continuacao',''))::boolean,false), coalesce((nullif(c->>'sem_anestesista',''))::boolean,false),
      coalesce(nullif(c->>'tipo',''),'eletiva'), nullif(c->>'gravidade',''), p_turno
    from jsonb_array_elements(coalesce(p_casos,'[]')) c;
  end if;

  -- RE-APONTAR: posição assumida que sobreviveu (assumidaPor com o recibo `de`)
  -- leva consigo os casos que a foto ainda traz no nome do dono antigo. Só por
  -- uid (dono sem login não tem como ser casado com segurança) e só neste turno.
  -- Sala "A + B" tem anestesista_user_id nulo e fica de fora sozinha.
  for v_chave, v_valor in select key, value from jsonb_each(v_over) loop
    if left(v_chave, length(v_prefixo)) <> v_prefixo then continue; end if;
    v_asm := v_valor -> 'assumidaPor';
    if jsonb_typeof(v_asm) is distinct from 'object' then continue; end if;
    if coalesce(v_asm->>'uid','') = '' or coalesce(v_asm->'de'->>'uid','') = ''
       or v_asm->>'uid' = v_asm->'de'->>'uid' then continue; end if;
    -- apelido canônico = o primeiro em ordem alfabética (é o `apelidos[0]` do roster)
    select a.apelido into v_apelido
      from public.escala_anestesista_alias a
     where a.user_id = v_asm->>'uid'
     order by a.apelido
     limit 1;
    if v_apelido is null then
      v_apelido := upper(split_part(btrim(coalesce(v_asm->>'nome','')), ' ', 1));
    end if;
    with upd as (
      update public.escala_cirurgica_caso c
         set anestesista_user_id = v_asm->>'uid',
             anestesista = coalesce(nullif(v_apelido,''), c.anestesista),
             sem_anestesista = false
       where c.escala_id = v_id and c.turno = p_turno
         and c.anestesista_user_id = v_asm->'de'->>'uid'
       returning c.id
    )
    select coalesce(jsonb_agg(u.id), '[]'::jsonb) into v_ids from upd u;
    if jsonb_array_length(v_ids) > 0 then
      v_over := jsonb_set(v_over, array[v_chave, 'assumidaPor', 'casoIds'], v_ids, true);
    end if;
  end loop;

  v_pub := jsonb_build_object('status',v_status,'publishedAt',case when v_status='publicada' then now() else null end,
    'publishedBy',case when v_status='publicada' then v_caller else null end,
    'publishedByName',nullif(p_header->>'published_by_name',''),
    'casos', (select count(*) from public.escala_cirurgica_caso where escala_id=v_id and turno=p_turno));
  v_turnos := jsonb_set(coalesce(v_turnos,'{}'), array[p_turno], v_pub, true);

  update public.escala_cirurgica set
    status=case when v_status='publicada' then 'publicada' else status end,
    ordem_liberacao=jsonb_set(v_ordem,array[p_turno],coalesce(nullif(p_header->'ordem_liberacao','null'::jsonb),'[]'::jsonb),true),
    ajuda_externa=jsonb_set(v_ajuda,array[p_turno],coalesce(nullif(p_header->'ajuda_externa','null'::jsonb),'[]'::jsonb),true),
    liberacoes=coalesce(v_lib,'{}'::jsonb),
    linha_overrides=coalesce(v_over,'{}'::jsonb),
    publicacao_turnos=v_turnos,
    -- fds_meta: só quando o payload traz (e o gate acima garante hospital='fds').
    -- Ausente ou jsonb null = preserva o atual (republicação de UM turno reenvia
    -- o meta completo por convenção da conferência; não existe "limpar" via RPC —
    -- zerar exige UPDATE direto, decisão consciente).
    fds_meta=coalesce(nullif(p_header->'fds_meta','null'::jsonb),fds_meta),
    source_image_path=coalesce(nullif(p_header->>'source_image_path',''),source_image_path),
    published_at=case when v_status='publicada' then now() else published_at end,
    published_by=case when v_status='publicada' then v_caller else published_by end,
    published_by_name=case when v_status='publicada' then coalesce((select p.nome from public.profiles p where p.id=v_caller),nullif(p_header->>'published_by_name','')) else published_by_name end,
    updated_at=now()
  where id=v_id;

  -- Auditoria da publicação: não replica dados do paciente; registra apenas
  -- quem publicou, qual turno e quantos casos foram substituídos.
  if to_regclass('public.escala_cirurgica_evento') is not null then
    begin
      insert into public.escala_cirurgica_evento (tipo, escala_id, data, hospital, detalhe, por)
      values ('publicacao', v_id, p_data, p_hospital,
        jsonb_build_object('turno', p_turno, 'casos', jsonb_array_length(coalesce(p_casos,'[]'::jsonb)), 'status', v_status), v_caller);
    exception when others then
      raise warning 'auditoria_publicacao indisponivel: %', sqlerrm;
    end;
  end if;

  select jsonb_build_object('header',(select to_jsonb(e.*) from public.escala_cirurgica e where e.id=v_id),
    'casos',coalesce((select jsonb_agg(c.* order by c.sala,c.ordem) from public.escala_cirurgica_caso c where c.escala_id=v_id),'[]'::jsonb)) into v_result;
  return v_result;
end;
$$;

comment on function public.rpc_publicar_escala_turno(date, text, text, jsonb, jsonb, jsonb, jsonb) is
  'Publica/substitui UM turno da escala cirúrgica numa transação. p_linha_overrides = decisões da conferência por chave (sem prefixo de turno; por/em carimbados aqui; assumidaPor/liberadoEm recusados). p_preservar = {campos, linhas:[{chave, candidatas, liberacao}]}: de quem segue na escala, os campos listados do override antigo voltam (05/09: rastro sobrevive, liberação zera). Posição assumida preservada re-aponta os casos do dono antigo. Liga o GUC anest.publicacao para o trigger de rastro.';

revoke execute on function public.rpc_publicar_escala_turno(date,text,text,jsonb,jsonb,jsonb,jsonb) from public, anon;
grant execute on function public.rpc_publicar_escala_turno(date,text,text,jsonb,jsonb,jsonb,jsonb) to authenticated, service_role;

-- ── 3) O trigger de rastro rotula pelo GUC, não por `v_new = '{}'` (A10) ──────
-- Corpo reproduzido de 20260730200000; só o `motivo` muda:
--   durante a publicação (GUC ligado): desfeita → reset_publicacao · declarada/assumida → publicacao
--   fora dela: manual
create or replace function public.log_escala_troca()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  k text;
  v_old jsonb := coalesce(old.linha_overrides, '{}'::jsonb);
  v_new jsonb := coalesce(new.linha_overrides, '{}'::jsonb);
  t_old jsonb; t_new jsonb;
  a_old jsonb; a_new jsonb;
  v_publicando boolean := coalesce(current_setting('anest.publicacao', true), '') = '1';
begin
  -- dado corrompido (não-objeto) não pode travar a linha nem o trigger
  if jsonb_typeof(v_old) <> 'object' or jsonb_typeof(v_new) <> 'object' then
    return new;
  end if;

  for k in
    select jsonb_object_keys(v_old)
    union
    select jsonb_object_keys(v_new)
  loop
    -- nullif('null'::jsonb): `trocaCom: null` gravado EXPLICITAMENTE não é SQL
    -- NULL — sem isto, desfazer por null viraria evento rotulado 'declarada'.
    -- Hoje o front remove a chave (spread condicional), é blindagem p/ o futuro.
    t_old := nullif(v_old -> k -> 'trocaCom', 'null'::jsonb);
    t_new := nullif(v_new -> k -> 'trocaCom', 'null'::jsonb);
    a_old := nullif(v_old -> k -> 'assumidaPor', 'null'::jsonb);
    a_new := nullif(v_new -> k -> 'assumidaPor', 'null'::jsonb);

    if t_old is distinct from t_new then
      insert into public.escala_cirurgica_evento
        (tipo, escala_id, data, hospital, anestesista, status_para, detalhe, por)
      values (
        'troca', new.id, new.data, new.hospital, k,
        case when t_new is null then 'troca_desfeita' else 'troca_declarada' end,
        -- motivo distingue "alguém desfez" do que a PUBLICAÇÃO apagou ou declarou
        -- (GUC anest.publicacao ligado pela rpc_publicar_escala_turno)
        coalesce(t_new, t_old, '{}'::jsonb) || jsonb_build_object(
          'motivo', case
            when v_publicando and t_new is null then 'reset_publicacao'
            when v_publicando then 'publicacao'
            else 'manual' end),
        -- ator: JWT primeiro (não-forjável); o `por` gravado no jsonb como fallback
        coalesce(nullif(public.firebase_uid(), ''), nullif(coalesce(t_new, t_old) ->> 'por', ''))
      );
    end if;

    if a_old is distinct from a_new then
      insert into public.escala_cirurgica_evento
        (tipo, escala_id, data, hospital, anestesista, status_para, detalhe, por)
      values (
        'troca', new.id, new.data, new.hospital, k,
        case when a_new is null then 'assuncao_desfeita' else 'posicao_assumida' end,
        coalesce(a_new, a_old, '{}'::jsonb) || jsonb_build_object(
          'motivo', case
            when v_publicando and a_new is null then 'reset_publicacao'
            when v_publicando then 'publicacao'
            else 'manual' end),
        coalesce(nullif(public.firebase_uid(), ''), nullif(coalesce(a_new, a_old) ->> 'por', ''))
      );
    end if;
  end loop;
  return new;
exception when others then
  -- log de rastro NUNCA bloqueia a operação clínica: perde os eventos DESTE
  -- update (a subtransação do bloco desfaz todos), avisa e segue
  raise warning 'log_escala_troca falhou: %', sqlerrm;
  return new;
end;
$$;

comment on function public.log_escala_troca() is
  'Rastro da troca declarada (linha_overrides.trocaCom/assumidaPor) em escala_cirurgica_evento. Diff por chave; motivo=manual|reset_publicacao|publicacao (os dois últimos quando o GUC anest.publicacao está ligado pela RPC de publicação). Nunca bloqueia a operação clínica.';

-- o trigger em si não muda (mesma função, mesmo WHEN) — recriado por idempotência
drop trigger if exists tr_escala_evento_troca on public.escala_cirurgica;
create trigger tr_escala_evento_troca
  after update on public.escala_cirurgica
  for each row
  when (old.linha_overrides is distinct from new.linha_overrides)
  execute function public.log_escala_troca();

commit;

-- o PostgREST precisa reler o cache do schema para enxergar a assinatura nova
-- (o event trigger do Supabase já faz isto em DDL; aqui é cinto e suspensório)
notify pgrst, 'reload schema';

-- Conferência VISÍVEL para quem aplica (a Management API não devolve notices)
select
  to_regprocedure('public.rpc_publicar_escala_turno(date,text,text,jsonb,jsonb,jsonb,jsonb)') is not null as rpc_nova,
  to_regprocedure('public.rpc_publicar_escala_turno(date,text,text,jsonb,jsonb)') is null as rpc_antiga_removida,
  position('p_preservar' in pg_get_functiondef(to_regprocedure('public.rpc_publicar_escala_turno(date,text,text,jsonb,jsonb,jsonb,jsonb)')::oid)) > 0 as rpc_preserva,
  position('gravidade' in pg_get_functiondef(to_regprocedure('public.rpc_publicar_escala_turno(date,text,text,jsonb,jsonb,jsonb,jsonb)')::oid)) > 0 as rpc_gravidade,
  position('fds_meta' in pg_get_functiondef(to_regprocedure('public.rpc_publicar_escala_turno(date,text,text,jsonb,jsonb,jsonb,jsonb)')::oid)) > 0 as rpc_fds,
  position('anest.publicacao' in pg_get_functiondef('public.log_escala_troca()'::regprocedure)) > 0 as trigger_por_guc;

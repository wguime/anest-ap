-- Republicação preserva swaps/ciclos e renova os recibos dos casos.
-- Escrita na revisão independente de 09/09 (branch codex); aplicada em 23/09 sobre a
-- RPC de 20260923160000 (republicar preserva andamento). Renomeada para depois dela:
-- reaplicada em ordem, a de 23/09 desfaria o fix. Só substitui o trecho conhecido;
-- assinatura, privilégios, lock, auditoria e reset de liberação continuam os mesmos.
-- Casos origem='manual' (urgências do app, preservados desde 23/09) ficam FORA do
-- re-apontar: já estão com quem atende, e numa troca A↔B voltariam ao dono antigo.
-- Rollback: reaplicar a função de 20260923160000. Sem dados a desfazer.
begin;
set local lock_timeout = '3s';
do $migration$
declare
  definicao text;
  trecho_antigo text := $old$  -- RE-APONTAR: posição assumida que sobreviveu (assumidaPor com o recibo `de`)
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
$old$;
  trecho_novo text := $new$  -- RE-APONTAR pelo snapshot original: A→B não vira entrada de B→A.
  -- revisao-swap-snapshot-v2 (marcador de idempotência da migration)
  declare
    v_casos_originais jsonb;
  begin
    select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'uid', c.anestesista_user_id)), '[]'::jsonb)
      into v_casos_originais
      from public.escala_cirurgica_caso c
     where c.escala_id = v_id and c.turno = p_turno and c.origem <> 'manual';
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
         and c.id in (
           select (original->>'id')::uuid
             from jsonb_array_elements(v_casos_originais) original
            where original->>'uid' = v_asm->'de'->>'uid'
         )
       returning c.id
    )
    select coalesce(jsonb_agg(u.id), '[]'::jsonb) into v_ids from upd u;
    -- Recibo sem caso agora fica vazio, nunca retém IDs apagados pelo DELETE.
    v_over := jsonb_set(v_over, array[v_chave, 'assumidaPor', 'casoIds'], v_ids, true);
  end loop;

  end;
$new$;
begin
  definicao := pg_get_functiondef(to_regprocedure('public.rpc_publicar_escala_turno(date,text,text,jsonb,jsonb,jsonb,jsonb)'));
  if definicao is null then raise exception 'revisao_swap: RPC ausente'; end if;
  if position(trecho_novo in definicao) > 0 then return; end if;
  if position(trecho_antigo in definicao) = 0
     or (length(definicao) - length(replace(definicao, trecho_antigo, ''))) <> length(trecho_antigo) then
    raise exception 'revisao_swap: corpo inesperado; revisar antes de substituir';
  end if;
  execute replace(definicao, trecho_antigo, trecho_novo);
end
$migration$;
commit;

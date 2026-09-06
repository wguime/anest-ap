-- ============================================================================
-- Escala Cirúrgica — a EXECUÇÃO da troca vira uma transação só (Onda 3, item 3.5;
-- achados A11 e A15 da auditoria de 02/09).
--
-- Executar um swap escreve em quatro lugares: o override do slot de cada lado
-- (`assumidaPor`, e o `trocaCom` que sai) e os casos que mudam de dono em cada
-- hospital. Isso vinha sendo feito de dentro do navegador, uma chamada por
-- efeito, com desfazer em ordem inversa quando alguma falhava — e o desfazer
-- também pode falhar. Quando falha, a mensagem honesta que sobra é "Parte foi
-- revertida — confira a lista antes de repetir", com dois anestesistas
-- respondendo pela mesma sala até alguém arrumar à mão.
--
-- Aqui os mesmos efeitos acontecem numa transação: ou o swap inteiro vale, ou
-- nada mudou. O cliente para de precisar de rollback.
--
-- LOCK: os cabeçalhos entram em `for update` ORDENADOS POR ID. Duas pessoas
-- executando trocas cruzadas ao mesmo tempo (A⇄B numa aba, B⇄C na outra) pegam
-- os mesmos cabeçalhos em ordens opostas e travam uma na outra; ordenar por id
-- dá a toda transação a mesma ordem de aquisição, que é o que impede o deadlock.
--
-- IDEMPOTÊNCIA (defeito D10, 07/08): lado cujo slot JÁ está assumido por quem
-- este lado quer pôr é PULADO inteiro — o segundo toque, a convergência da
-- publicação e dois plantonistas ao mesmo tempo não re-transferem casos que
-- agora pertencem ao outro lado do swap. A RPC devolve quantos pulou.
--
-- DEVOLVE O ESTADO RESULTANTE (achado A11): a convergência da importação
-- executa os pares num laço sobre um snapshot que não era atualizado entre
-- execuções — com A⇄B e B⇄C declarados no mesmo turno, a segunda sobrescrevia a
-- primeira. Com os overrides e os casos tocados voltando na resposta, o laço
-- atualiza o snapshot e a segunda execução enxerga a primeira.
--
-- `por`/`em` são carimbados aqui, nunca aceitos do cliente — mesma regra de
-- rpc_escala_patch_liberacao e da RPC de publicação.
--
-- Rollback (manual): `drop function if exists public.rpc_escala_executar_troca(jsonb, jsonb);`
-- e reverter o commit do cliente (o caminho antigo, por patches, volta junto).
-- Nada de schema muda aqui: é função nova, nenhuma tabela é tocada.
-- ============================================================================

begin;

set local lock_timeout = '3s';

create or replace function public.rpc_escala_executar_troca(
  p_lados  jsonb,          -- [{escala_id, chave, assumida_por, caso_ids, para_uid, para_apelido}]
  p_limpar jsonb default '[]'::jsonb  -- [{escala_id, chave}] — trocaCom a remover
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_caller text := public.firebase_uid();
  v_agora timestamptz := now();
  v_lado jsonb;
  v_id uuid;
  v_chave text;
  v_over jsonb;
  v_ant jsonb;
  v_asm jsonb;
  v_novo jsonb;
  v_ids uuid[];
  v_pulados int := 0;
  v_total int := 0;
  v_escalas jsonb := '{}'::jsonb;
  v_casos jsonb := '[]'::jsonb;
  v_toque jsonb;
begin
  if v_caller = '' then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  if not public.can_write_escala_cirurgica() then
    raise exception 'permission_denied: sem acesso à escala cirúrgica' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_lados,'[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_limpar,'[]'::jsonb)) <> 'array' then
    raise exception 'payload_formato_invalido' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_lados,'[]'::jsonb)) = 0 then
    raise exception 'payload_formato_invalido' using errcode = '22023';
  end if;

  -- Trava TODOS os cabeçalhos envolvidos (lados + limpezas) numa ordem única.
  perform e.id
    from public.escala_cirurgica e
   where e.id in (
     select (x->>'escala_id')::uuid from jsonb_array_elements(coalesce(p_lados,'[]'::jsonb)) x
     union
     select (x->>'escala_id')::uuid from jsonb_array_elements(coalesce(p_limpar,'[]'::jsonb)) x
   )
   order by e.id
     for update;

  for v_lado in select value from jsonb_array_elements(p_lados) loop
    v_total := v_total + 1;
    v_id := nullif(v_lado->>'escala_id','')::uuid;
    v_chave := btrim(coalesce(v_lado->>'chave',''));
    v_asm := v_lado->'assumida_por';
    if v_id is null or v_chave = '' or jsonb_typeof(v_asm) <> 'object' then
      raise exception 'payload_formato_invalido' using errcode = '22023';
    end if;

    select e.linha_overrides into v_over from public.escala_cirurgica e where e.id = v_id;
    if v_over is null then
      raise exception 'escala_nao_encontrada' using errcode = '22023';
    end if;
    v_ant := coalesce(v_over -> v_chave, '{}'::jsonb);

    -- Já assumido por quem este lado quer pôr? Pula o lado inteiro (D10). Casa por
    -- uid quando há; sem uid dos dois lados, pelo nome — mesma regra do cliente.
    if jsonb_typeof(v_ant->'assumidaPor') = 'object'
       and (
         (coalesce(v_asm->>'uid','') <> '' and v_ant->'assumidaPor'->>'uid' = v_asm->>'uid')
         or (coalesce(v_asm->>'uid','') = '' and coalesce(v_ant->'assumidaPor'->>'uid','') = ''
             and upper(btrim(coalesce(v_ant->'assumidaPor'->>'nome',''))) = upper(btrim(coalesce(v_asm->>'nome',''))))
       ) then
      v_pulados := v_pulados + 1;
      continue;
    end if;

    -- o `trocaCom` sai (a declaração virou fato) e o `assumidaPor` entra carimbado
    v_novo := (v_ant - 'trocaCom' - 'por' - 'em')
      || jsonb_build_object(
           'assumidaPor', (v_asm - 'por' - 'em') || jsonb_build_object('por', v_caller, 'em', v_agora),
           'por', v_caller, 'em', v_agora);

    update public.escala_cirurgica
       set linha_overrides = jsonb_set(coalesce(linha_overrides,'{}'::jsonb), array[v_chave], v_novo, true),
           updated_at = v_agora
     where id = v_id;

    -- os casos que mudam de dono. `para_uid` vazio nunca traz casos (o plano não
    -- os monta sem vínculo); se vier, é bug de cliente e é recusado em vez de
    -- apagar o anestesista das cirurgias — o modo de falha de 07/08.
    select array_agg(x::uuid) into v_ids
      from jsonb_array_elements_text(coalesce(v_lado->'caso_ids','[]'::jsonb)) x;
    if v_ids is not null and array_length(v_ids,1) > 0 then
      if coalesce(v_lado->>'para_uid','') = '' then
        raise exception 'payload_formato_invalido' using errcode = '22023';
      end if;
      update public.escala_cirurgica_caso c
         set anestesista = coalesce(nullif(v_lado->>'para_apelido',''), c.anestesista),
             anestesista_user_id = v_lado->>'para_uid',
             sem_anestesista = false
       where c.id = any(v_ids);
    end if;
  end loop;

  -- `trocaCom` declarado FORA dos slots (ex.: na linha de quem assumiu): sai junto,
  -- para o badge não sobrar dos dois lados depois de a troca virar fato.
  for v_lado in select value from jsonb_array_elements(coalesce(p_limpar,'[]'::jsonb)) loop
    v_id := nullif(v_lado->>'escala_id','')::uuid;
    v_chave := btrim(coalesce(v_lado->>'chave',''));
    if v_id is null or v_chave = '' then continue; end if;
    select e.linha_overrides into v_over from public.escala_cirurgica e where e.id = v_id;
    v_ant := v_over -> v_chave;
    if jsonb_typeof(v_ant) <> 'object' or not (v_ant ? 'trocaCom') then continue; end if;
    v_novo := v_ant - 'trocaCom' - 'por' - 'em';
    update public.escala_cirurgica
       set linha_overrides = case
             when v_novo = '{}'::jsonb then coalesce(linha_overrides,'{}'::jsonb) - v_chave
             else jsonb_set(coalesce(linha_overrides,'{}'::jsonb), array[v_chave],
                            v_novo || jsonb_build_object('por', v_caller, 'em', v_agora), true)
           end,
           updated_at = v_agora
     where id = v_id;
  end loop;

  -- ESTADO RESULTANTE (A11): overrides de cada escala tocada e os casos movidos.
  -- É com isto que a convergência da importação atualiza o snapshot entre execuções.
  select coalesce(jsonb_object_agg(e.id::text, e.linha_overrides), '{}'::jsonb) into v_escalas
    from public.escala_cirurgica e
   where e.id in (
     select (x->>'escala_id')::uuid from jsonb_array_elements(coalesce(p_lados,'[]'::jsonb)) x
     union
     select (x->>'escala_id')::uuid from jsonb_array_elements(coalesce(p_limpar,'[]'::jsonb)) x
   );

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'anestesista', c.anestesista,
           'anestesistaUserId', c.anestesista_user_id, 'semAnestesista', c.sem_anestesista)), '[]'::jsonb)
    into v_casos
    from public.escala_cirurgica_caso c
   where c.id in (
     select x::uuid
       from jsonb_array_elements(p_lados) l,
            jsonb_array_elements_text(coalesce(l->'caso_ids','[]'::jsonb)) x
   );

  v_toque := jsonb_build_object('escalas', v_escalas, 'casos', v_casos,
                                'pulados', v_pulados, 'lados', v_total);
  return v_toque;
end;
$$;

comment on function public.rpc_escala_executar_troca(jsonb, jsonb) is
  'Executa o swap da troca declarada numa transação só: assumidaPor + saída do trocaCom + casos que mudam de dono, em todas as escalas envolvidas. Cabeçalhos travados em ordem de id (sem deadlock). Lado já assumido pelo alvo é pulado (idempotência). Devolve {escalas, casos, pulados, lados} para o chamador atualizar o estado sem reler.';

revoke execute on function public.rpc_escala_executar_troca(jsonb, jsonb) from public, anon;
grant execute on function public.rpc_escala_executar_troca(jsonb, jsonb) to authenticated, service_role;

commit;

notify pgrst, 'reload schema';

-- Conferência visível para quem aplica (a Management API não devolve notices):
select to_regprocedure('public.rpc_escala_executar_troca(jsonb,jsonb)') is not null as rpc_criada,
       has_function_privilege('authenticated', 'public.rpc_escala_executar_troca(jsonb,jsonb)', 'execute') as authenticated_executa,
       not has_function_privilege('anon', 'public.rpc_escala_executar_troca(jsonb,jsonb)', 'execute') as anon_bloqueado;

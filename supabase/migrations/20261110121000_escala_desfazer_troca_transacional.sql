-- ============================================================================
-- ESCALA CIRÚRGICA — DESFAZER a troca numa transação, com a liberação seguindo a PESSOA
-- (investigação das trocas, 10/11/2026)
--
-- A execução da troca é transacional desde 05/09 (`rpc_escala_executar_troca`). O
-- DESFAZER continuou no navegador: 2 a 4 escritas (override de cada lado + os casos)
-- com rollback LIFO no cliente, e sem olhar `liberacoes`. Dois defeitos:
--   1. meio desfazer possível (a mesma classe do A15 de 05/09);
--   2. a marca de liberação mora na chave da POSIÇÃO. Se a vaga foi liberada ENQUANTO
--      estava assumida, quem saiu foi o OCUPANTE — desfeita a troca, a marca voltava
--      para o dono da vaga (que aparecia "Liberado" com a cirurgia devolvida a ele) e
--      quem tinha saído de verdade voltava à fila.
--      21/10, HRO tarde: Fernando assume a 14ª do Klisman às 14:01, é liberado nela às
--      15:02, a troca é desfeita às 16:40 → os dois são re-liberados à mão como "fora do
--      rodapé". Mesmo dia, 18:37–18:38: Melo ⇄ Cury, liberação na 12ª, desfeita 1 min
--      depois.
--
-- Regra (a de 23/10, "a liberação é da pessoa", agora também na volta): ao desfazer,
-- a marca `{ liberadoEm }` da vaga que foi gravada DEPOIS da assunção
-- (`liberadoEm >= assumidaPor.em`) segue para a chave própria do ocupante
-- (`<turno>:<uid>`) e sai da vaga. Marca ANTERIOR à assunção é do dono e fica.
-- Sem `assumidaPor.em` (registro antigo), sem uid do ocupante ou chave fora de
-- matutino/vespertino (a noite da fila única), a marca fica onde está — o
-- comportamento de hoje, lado seguro.
--
-- OS MOVIMENTOS SÃO DECIDIDOS ANTES E APLICADOS JUNTOS, contra o `liberacoes` lido logo
-- depois do lock (revisão do validador, 11/11): na troca A ⇄ B da MESMA escala a chave
-- própria de um é a vaga do outro. Decidindo lado a lado, com as DUAS vagas liberadas
-- durante a assunção, o primeiro lado via "o ocupante já tem liberação própria" (era a
-- marca do outro, que também ia sair) e apagava uma das duas. Aplicados juntos, as duas
-- marcas trocam de chave. "Liberação própria" só segura a do ocupante quando ela NÃO é
-- uma das marcas que estão saindo.
--
-- Contrato:
--   p_lados = [{ escala_id, chave ("<turno>:<slot>"), caso_ids?: uuid[],
--                para_uid?: text, para_apelido?: text }]
--     chave .......... a vaga cujo `assumidaPor` sai
--     caso_ids ....... o recibo da execução (`assumidaPor.casoIds`)
--     para_uid ....... o DONO, que recebe as cirurgias de volta
--   `caso_ids` com `para_uid` vazio é RECUSADO (payload_formato_invalido), como na
--   execução: devolver cirurgia a ninguém apagaria o anestesista. Quem quer só a posição
--   de volta (dono sem login) manda `caso_ids` vazio — é escolha explícita do cliente.
--   Das cirurgias do recibo, volta ao dono:
--     - a que ainda está com o ocupante;
--     - a que ficou SEM login e não é dupla ("?", sem anestesista) — senão ficaria órfã.
--   NÃO volta: a que foi passada a um terceiro com login (fica com ele) e a que virou
--   dupla "A + B" (dupla não transfere — regra de 11/08, a mesma do repasse e da troca).
--   Lado sem `assumidaPor` é pulado (idempotência, como o D10 da execução).
--   `trocaCom` não renasce (regra de 30/07).
-- Rastro: o trigger de liberação é calado na transação (GUC `anest.liberacao_movida`) e
-- a própria RPC grava UM evento por marca movida — `tipo='liberacao'`,
-- `status_para='movida'`, `detalhe { de, para, por, apagada }`, com `por` NULO na coluna
-- (não é ação de ninguém para a adesão). `apagada` = o ocupante já tinha liberação
-- própria e a da vaga só saiu.
-- Devolve { escalas: { id: linha_overrides }, liberacoes: { id: liberacoes },
--           casos: [...], pulados, lados, movidas: [{ escala_id, de, para }] }.
--
-- Rollback: scripts/rollback-20261110121000-desfazer-troca-transacional.sql
-- Trava: src/__tests__/lib/escalaDesfazerTrocaSql.test.js (PGlite)
-- ============================================================================

begin;

create or replace function public.rpc_escala_desfazer_troca(p_lados jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_caller text := public.firebase_uid();
  v_agora timestamptz := now();
  v_lado jsonb;
  v_id uuid;
  v_chave text;
  v_over jsonb;
  v_libs jsonb;
  v_novas jsonb;
  v_ant jsonb;
  v_asm jsonb;
  v_resto jsonb;
  v_marca jsonb;
  v_turno text;
  v_ocup text;
  v_propria text;
  v_asm_em timestamptz;
  v_lib_em timestamptz;
  v_ids uuid[];
  v_mov jsonb;
  v_apagada boolean;
  v_saem text[];
  v_pulados int := 0;
  v_total int := 0;
  v_movs jsonb := '[]'::jsonb;     -- decididos: { escala_id, de, para, marca }
  v_movidas jsonb := '[]'::jsonb;  -- devolvidos: { escala_id, de, para }
  v_escalas jsonb := '{}'::jsonb;
  v_liberacoes jsonb := '{}'::jsonb;
  v_casos jsonb := '[]'::jsonb;
  v_esc record;
begin
  if v_caller = '' then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  if not public.can_write_escala_cirurgica() then
    raise exception 'permission_denied: sem acesso à escala cirúrgica' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_lados, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_lados, '[]'::jsonb)) = 0 then
    raise exception 'payload_formato_invalido' using errcode = '22023';
  end if;

  -- Trava os cabeçalhos envolvidos numa ordem única (duas trocas cruzadas não se travam).
  perform e.id
    from public.escala_cirurgica e
   where e.id in (select (x->>'escala_id')::uuid from jsonb_array_elements(p_lados) x)
   order by e.id
     for update;

  -- ── 1. DECIDE os movimentos de liberação, todos contra o estado de ANTES ───────────
  for v_lado in select value from jsonb_array_elements(p_lados) loop
    v_id := nullif(v_lado->>'escala_id', '')::uuid;
    v_chave := btrim(coalesce(v_lado->>'chave', ''));
    if v_id is null or v_chave = '' then
      raise exception 'payload_formato_invalido' using errcode = '22023';
    end if;
    -- cirurgia sem dono a quem devolver: recusa, como a execução (apagaria o anestesista)
    if jsonb_array_length(coalesce(v_lado->'caso_ids', '[]'::jsonb)) > 0 and coalesce(v_lado->>'para_uid', '') = '' then
      raise exception 'payload_formato_invalido' using errcode = '22023';
    end if;
    select e.linha_overrides, coalesce(e.liberacoes, '{}'::jsonb) into v_over, v_libs
      from public.escala_cirurgica e where e.id = v_id;
    if not found then
      raise exception 'escala_nao_encontrada' using errcode = '22023';
    end if;
    v_asm := coalesce(v_over, '{}'::jsonb) -> v_chave -> 'assumidaPor';
    if jsonb_typeof(v_asm) is distinct from 'object' then
      continue; -- já desfeito: o laço 2 conta o pulado
    end if;
    v_turno := split_part(v_chave, ':', 1);
    v_ocup := nullif(v_asm->>'uid', '');
    v_marca := v_libs -> v_chave;
    if v_turno in ('matutino', 'vespertino') and v_ocup is not null
       and jsonb_typeof(v_marca) = 'object' and nullif(v_marca->>'liberadoEm', '') is not null
       and nullif(v_asm->>'em', '') is not null then
      begin
        v_asm_em := (v_asm->>'em')::timestamptz;
        v_lib_em := (v_marca->>'liberadoEm')::timestamptz;
      exception when others then
        v_asm_em := null; v_lib_em := null; -- carimbo ilegível: a marca fica onde está
      end;
      v_propria := v_turno || ':' || v_ocup;
      if v_asm_em is not null and v_lib_em is not null and v_lib_em >= v_asm_em and v_propria <> v_chave
         -- o mesmo lado duas vezes no payload não vira dois movimentos
         and not exists (select 1 from jsonb_array_elements(v_movs) m
                          where m->>'escala_id' = v_id::text and m->>'de' = v_chave) then
        v_movs := v_movs || jsonb_build_object('escala_id', v_id, 'de', v_chave, 'para', v_propria, 'marca', v_marca);
      end if;
    end if;
  end loop;

  -- ── 2. POSIÇÃO e CIRURGIAS, lado a lado ────────────────────────────────────────────
  for v_lado in select value from jsonb_array_elements(p_lados) loop
    v_total := v_total + 1;
    v_id := nullif(v_lado->>'escala_id', '')::uuid;
    v_chave := btrim(coalesce(v_lado->>'chave', ''));

    select e.linha_overrides into v_over from public.escala_cirurgica e where e.id = v_id;
    v_ant := coalesce(v_over -> v_chave, '{}'::jsonb);
    v_asm := v_ant -> 'assumidaPor';

    -- já desfeito (ou nunca assumido): pula o lado inteiro, casos inclusive
    if jsonb_typeof(v_asm) is distinct from 'object' then
      v_pulados := v_pulados + 1;
      continue;
    end if;
    v_ocup := nullif(v_asm->>'uid', '');

    -- a posição volta ao dono; o resto do override fica, recarimbado
    v_resto := v_ant - 'assumidaPor' - 'por' - 'em';
    update public.escala_cirurgica
       set linha_overrides = case
             when v_resto = '{}'::jsonb then coalesce(linha_overrides, '{}'::jsonb) - v_chave
             else jsonb_set(coalesce(linha_overrides, '{}'::jsonb), array[v_chave],
                            v_resto || jsonb_build_object('por', v_caller, 'em', v_agora), true)
           end,
           updated_at = v_agora
     where id = v_id;

    -- as cirurgias do recibo voltam ao dono: a que ainda está com o ocupante e a que
    -- ficou sem login e não é dupla. Com terceiro (login) e dupla "A + B" ficam.
    select array_agg(x::uuid) into v_ids
      from jsonb_array_elements_text(coalesce(v_lado->'caso_ids', '[]'::jsonb)) x;
    if v_ids is not null and array_length(v_ids, 1) > 0 then
      update public.escala_cirurgica_caso c
         set anestesista = coalesce(nullif(v_lado->>'para_apelido', ''), c.anestesista),
             anestesista_user_id = v_lado->>'para_uid',
             sem_anestesista = false
       where c.id = any(v_ids)
         and coalesce(c.anestesista, '') not like '%+%'
         -- sem login só volta a que ficou SEM anestesista ("?"/vazia): a passada a alguém de fora,
         -- que tem nome e não tem login (ajuda), fica com ele
         and ((nullif(c.anestesista_user_id, '') is null
               and (c.sem_anestesista or coalesce(c.anestesista, '') !~ '[[:alpha:]]'))
              or v_ocup is null
              or c.anestesista_user_id = v_ocup);
    end if;
  end loop;

  -- ── 3. APLICA as liberações, por escala, de uma vez ────────────────────────────────
  -- A marca que só muda de chave não é liberação nova: o trigger de rastro lê este GUC;
  -- o rastro da mudança é o evento 'movida', abaixo.
  perform set_config('anest.liberacao_movida', '1', true);
  for v_esc in
    select e.id, e.data, e.hospital, coalesce(e.liberacoes, '{}'::jsonb) as libs
      from public.escala_cirurgica e
     where e.id in (select (m->>'escala_id')::uuid from jsonb_array_elements(v_movs) m)
     order by e.id
  loop
    select array_agg(m->>'de') into v_saem
      from jsonb_array_elements(v_movs) m where m->>'escala_id' = v_esc.id::text;
    -- todas as marcas que saem, saem primeiro
    v_novas := v_esc.libs;
    select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) into v_novas
      from jsonb_each(v_esc.libs) as t(k, v) where not (k = any(v_saem));
    for v_mov in select value from jsonb_array_elements(v_movs) m where m->>'escala_id' = v_esc.id::text loop
      -- o ocupante já tinha liberação PRÓPRIA (e ela não é uma das que estão saindo):
      -- a da vaga só sai, a dele não é sobrescrita
      v_apagada := nullif(v_esc.libs -> (v_mov->>'para') ->> 'liberadoEm', '') is not null
                   and not ((v_mov->>'para') = any(v_saem));
      if not v_apagada then
        v_novas := jsonb_set(v_novas, array[v_mov->>'para'], v_mov->'marca', true);
      end if;
      v_movidas := v_movidas || jsonb_build_object('escala_id', v_esc.id, 'de', v_mov->>'de', 'para', v_mov->>'para');
      begin
        insert into public.escala_cirurgica_evento
          (tipo, escala_id, data, hospital, anestesista, status_para, detalhe, por)
        values (
          'liberacao', v_esc.id, v_esc.data, v_esc.hospital, v_mov->>'de', 'movida',
          jsonb_build_object('de', v_mov->>'de', 'para', v_mov->>'para', 'por', v_caller,
                             'apagada', v_apagada, 'em', v_mov->'marca'->'liberadoEm'),
          null
        );
      exception when others then
        raise warning 'rpc_escala_desfazer_troca: rastro da marca movida falhou: %', sqlerrm;
      end;
    end loop;
    update public.escala_cirurgica set liberacoes = v_novas, updated_at = v_agora where id = v_esc.id;
  end loop;

  select coalesce(jsonb_object_agg(e.id::text, coalesce(e.linha_overrides, '{}'::jsonb)), '{}'::jsonb),
         coalesce(jsonb_object_agg(e.id::text, coalesce(e.liberacoes, '{}'::jsonb)), '{}'::jsonb)
    into v_escalas, v_liberacoes
    from public.escala_cirurgica e
   where e.id in (select (x->>'escala_id')::uuid from jsonb_array_elements(p_lados) x);

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'anestesista', c.anestesista,
           'anestesistaUserId', c.anestesista_user_id, 'semAnestesista', c.sem_anestesista)), '[]'::jsonb)
    into v_casos
    from public.escala_cirurgica_caso c
   where c.id in (
     select x::uuid
       from jsonb_array_elements(p_lados) l,
            jsonb_array_elements_text(coalesce(l->'caso_ids', '[]'::jsonb)) x
   );

  return jsonb_build_object('escalas', v_escalas, 'liberacoes', v_liberacoes, 'casos', v_casos,
                            'pulados', v_pulados, 'lados', v_total, 'movidas', v_movidas);
end;
$function$;

comment on function public.rpc_escala_desfazer_troca(jsonb) is
  'Desfaz posição assumida (linha_overrides.assumidaPor) numa transação: posição e cirurgias voltam ao dono; a liberação gravada enquanto a vaga estava assumida segue para a chave própria do ocupante (a liberação é da pessoa, 23/10). 10/11/2026.';

revoke execute on function public.rpc_escala_desfazer_troca(jsonb) from public, anon;
grant execute on function public.rpc_escala_desfazer_troca(jsonb) to authenticated, service_role;

commit;

-- conferência
select to_regprocedure('public.rpc_escala_desfazer_troca(jsonb)') is not null as rpc_criada,
       has_function_privilege('anon', 'public.rpc_escala_desfazer_troca(jsonb)', 'execute') as anon_executa_deve_ser_false;

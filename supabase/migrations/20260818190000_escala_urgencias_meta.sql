-- Salas dos papéis do contrato de urgência do HRO — configuráveis por dia/turno.
--
-- PORQUÊ (dono 2026-08-18, 2ª decisão do dia): a ortopedia opera "normalmente na
-- sala 4" e o CO na sala 7, mas ESSAS SALAS MUDAM — e com elas muda quem absorve
-- a urgência e quem pesa nas 2 vagas do plantonista/sobreaviso. O código fixo
-- (papelDaSalaHro) vira apenas o DEFAULT; quando o dia foge do normal, quem edita
-- a escala marca na tela onde cada papel está.
--
-- Formato (chave = turno de PUBLICAÇÃO, regra dos turnos independentes 13/08):
--   urgencias_meta = {
--     "matutino":   { "orto": "Sala 3", "co": "Sala 7 - CO",
--                     "plantao": "Sala 6", "sobreaviso": null, "por": uid, "em": ts },
--     "vespertino": { ... }
--   }
-- Campo ausente/null = automático (default do contrato + heurística por ordem de
-- início). `por`/`em` são carimbados pela RPC, nunca aceitos do cliente.
--
-- Por que NÃO reusar linha_overrides com uma chave especial: o reset da
-- publicação apaga as chaves `turno:*` daquele campo (a config morreria a cada
-- republicação) e fetchLocaisHospital itera os values esperando override de
-- linha. Coluna própria sobrevive à republicação de graça — o UPDATE da RPC de
-- publicação enumera colunas e não a toca.

begin;

set local lock_timeout = '3s';

-- ── 1) A coluna ──────────────────────────────────────────────────────────────
alter table public.escala_cirurgica
  add column if not exists urgencias_meta jsonb not null default '{}'::jsonb;

comment on column public.escala_cirurgica.urgencias_meta is
  'Salas dos papéis do contrato de urgência (só HRO), por turno de publicação: {matutino:{orto,co,plantao,sobreaviso,por,em}, vespertino:{...}}. Ausente/null = automático. Escrita via rpc_escala_patch_liberacao(campo=urgencias_meta, chave=turno).';

-- ── 2) A RPC de patch por chave passa a aceitar o campo novo ─────────────────
-- Guard: a definição viva tem de ser a de 20260628200000 (nenhuma migration a
-- recriou desde então — verificado no banco em 18/08, 1800 chars). Se um hotfix
-- desconhecido tiver mexido nela, abortar em vez de sobrescrever em silêncio.
do $$
declare v text;
begin
  -- por ASSINATURA (padrão de 20260818140000): overload futuro não engana o guard
  select pg_get_functiondef(to_regprocedure('public.rpc_escala_patch_liberacao(uuid,text,text,jsonb)')::oid)
    into v;
  if v is null then
    raise exception 'urgencias_meta: rpc_escala_patch_liberacao nao existe — migration fora de ordem';
  end if;
  if position('urgencias_meta' in v) > 0 then
    raise notice 'urgencias_meta: RPC ja aceita o campo, seguindo (idempotente)';
  elsif position('linha_overrides' in v) = 0 then
    raise exception 'urgencias_meta: definicao viva inesperada de rpc_escala_patch_liberacao — revisar antes de sobrescrever';
  end if;
end
$$;

-- Corpo COMPLETO reproduzido de 20260628200000 + o campo novo (a função é
-- pequena e autocontida; o guard acima protege contra versão viva divergente).
create or replace function public.rpc_escala_patch_liberacao(
  p_escala_id uuid,
  p_campo     text,   -- 'liberacoes' | 'linha_overrides' | 'urgencias_meta'
  p_chave     text,   -- chave da linha; em urgencias_meta, o TURNO
  p_valor     jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_caller text := public.firebase_uid();
  v_remove boolean := (p_valor is null or jsonb_typeof(p_valor) = 'null');
begin
  if v_caller = '' then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  if not public.can_write_escala_cirurgica() then
    raise exception 'permission_denied: sem acesso à escala cirúrgica' using errcode = '42501';
  end if;
  if p_campo not in ('liberacoes', 'linha_overrides', 'urgencias_meta') then
    raise exception 'campo_invalido: %', p_campo;
  end if;
  if p_chave is null or btrim(p_chave) = '' then
    raise exception 'chave_invalida';
  end if;
  -- urgencias_meta é chaveado por TURNO de publicação, nunca por linha.
  if p_campo = 'urgencias_meta' and p_chave not in ('matutino', 'vespertino') then
    raise exception 'turno_invalido: %', p_chave;
  end if;

  -- Audit server-side também dentro do valor: 'por'/'em' são carimbados aqui,
  -- nunca aceitos do cliente (mesma regra do created_by/published_by).
  if not v_remove and jsonb_typeof(p_valor) = 'object' then
    p_valor := jsonb_set(jsonb_set(p_valor, '{por}', to_jsonb(v_caller)), '{em}', to_jsonb(now()));
  end if;

  if p_campo = 'liberacoes' then
    update public.escala_cirurgica set
      liberacoes = case when v_remove then liberacoes - p_chave
                        else jsonb_set(liberacoes, array[p_chave], p_valor, true) end,
      updated_at = now()
    where id = p_escala_id;
  elsif p_campo = 'linha_overrides' then
    update public.escala_cirurgica set
      linha_overrides = case when v_remove then linha_overrides - p_chave
                             else jsonb_set(linha_overrides, array[p_chave], p_valor, true) end,
      updated_at = now()
    where id = p_escala_id;
  else
    update public.escala_cirurgica set
      urgencias_meta = case when v_remove then coalesce(urgencias_meta, '{}'::jsonb) - p_chave
                            else jsonb_set(coalesce(urgencias_meta, '{}'::jsonb), array[p_chave], p_valor, true) end,
      updated_at = now()
    where id = p_escala_id;
  end if;

  if not found then
    raise exception 'escala_nao_encontrada';
  end if;
end;
$$;

revoke execute on function public.rpc_escala_patch_liberacao(uuid, text, text, jsonb) from public, anon;
grant execute on function public.rpc_escala_patch_liberacao(uuid, text, text, jsonb) to authenticated, service_role;

commit;

-- Conferência visível para quem aplica (a Management API não devolve notices):
select position('urgencias_meta' in pg_get_functiondef(p.oid)) > 0 as rpc_aceita_campo,
       exists (
         select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'escala_cirurgica'
            and column_name = 'urgencias_meta'
       ) as coluna_existe
  from pg_proc p
 where p.proname = 'rpc_escala_patch_liberacao' and p.pronamespace = 'public'::regnamespace;

-- Rollback manual:
--   alter table public.escala_cirurgica drop column urgencias_meta;
--   (e reaplicar o bloco da RPC de 20260628200000_escala_cirurgica.sql:331-385)

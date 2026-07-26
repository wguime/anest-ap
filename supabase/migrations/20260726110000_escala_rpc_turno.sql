-- ════════════════════════════════════════════════════════════════════════
-- 20260726110000_escala_rpc_turno.sql
-- rpc_salvar_escala_cirurgica passa a gravar a coluna `turno` do caso.
--
-- A RPC enumera as colunas do INSERT uma a uma, então uma coluna nova é
-- DESCARTADA EM SILÊNCIO se a função não for recriada junto — o caso seria
-- publicado com turno NULL e o SRPA da manhã voltaria a vazar para a tarde
-- (mesma classe do gotcha de ultima_avaliacao_at no cateter).
--
-- Recriada por INTEIRO (create or replace), idêntica à versão de
-- 20260715100000 exceto pela coluna nova. Idempotente.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

create or replace function public.rpc_salvar_escala_cirurgica(
  p_header jsonb,
  p_casos  jsonb     -- array JSON de casos em snake_case; campo escala_id ignorado
)
returns jsonb        -- { header: escala_cirurgica, casos: escala_cirurgica_caso[] }
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_id     uuid;
  v_status text := coalesce(nullif(p_header->>'status', ''), 'rascunho');
  v_caller text := public.firebase_uid();
  v_result jsonb;
begin
  -- SECURITY DEFINER bypassa RLS → verificar o gate explicitamente antes de qualquer DML.
  -- firebase_uid() devolve '' (não NULL) sem JWT — barrar antes do gate.
  if v_caller = '' then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  if not public.can_write_escala_cirurgica() then
    raise exception 'permission_denied: sem acesso à escala cirúrgica' using errcode = '42501';
  end if;

  -- Audit 100% server-side: created_by/published_by = firebase_uid(); o nome vem de
  -- profiles (fallback: display enviado pelo cliente). Cliente não escolhe o autor.
  insert into public.escala_cirurgica (
    data, hospital, status, ordem_liberacao, ajuda_externa, vinculos, source_image_path,
    created_by, published_at, published_by, published_by_name, created_at, updated_at
  ) values (
    (p_header->>'data')::date,
    p_header->>'hospital',
    v_status,
    coalesce(p_header->'ordem_liberacao', '[]'::jsonb),
    coalesce(p_header->'ajuda_externa',   '[]'::jsonb),
    coalesce(p_header->'vinculos',        '{}'::jsonb),
    nullif(p_header->>'source_image_path', ''),
    v_caller,
    case when v_status = 'publicada' then now() end,
    case when v_status = 'publicada' then v_caller end,
    case when v_status = 'publicada' then coalesce(
      (select p.nome from public.profiles p where p.id = v_caller),
      nullif(p_header->>'published_by_name', '')
    ) end,
    now(), now()
  )
  on conflict (data, hospital) do update set
    -- publicada nunca rebaixa para rascunho por re-importação
    status            = case when escala_cirurgica.status = 'publicada' then 'publicada' else excluded.status end,
    ordem_liberacao   = excluded.ordem_liberacao,
    ajuda_externa     = excluded.ajuda_externa,
    vinculos          = excluded.vinculos,
    source_image_path = coalesce(excluded.source_image_path, escala_cirurgica.source_image_path),
    updated_at        = now(),
    published_at      = coalesce(excluded.published_at,      escala_cirurgica.published_at),
    published_by      = coalesce(excluded.published_by,      escala_cirurgica.published_by),
    published_by_name = coalesce(excluded.published_by_name, escala_cirurgica.published_by_name)
    -- created_by, created_at, liberacoes, linha_overrides: ausentes de propósito → preservados
  returning id into v_id;

  delete from public.escala_cirurgica_caso where escala_id = v_id;

  if p_casos is not null and jsonb_typeof(p_casos) = 'array' and jsonb_array_length(p_casos) > 0 then
    insert into public.escala_cirurgica_caso (
      escala_id, sala, ordem, hora, tempo_estimado, paciente_iniciais, idade,
      procedimento, convenio, cirurgiao, cirurgiao_display,
      anestesista, anestesista_user_id, bloco, is_continuacao, sem_anestesista, tipo, turno
    )
    select
      v_id,
      coalesce(c->>'sala', ''),
      coalesce((nullif(c->>'ordem', ''))::int, 0),
      nullif(c->>'hora', ''),
      nullif(c->>'tempo_estimado', ''),
      nullif(c->>'paciente_iniciais', ''),
      nullif(c->>'idade', ''),
      nullif(c->>'procedimento', ''),
      nullif(c->>'convenio', ''),
      nullif(c->>'cirurgiao', ''),
      nullif(c->>'cirurgiao_display', ''),
      nullif(c->>'anestesista', ''),
      nullif(c->>'anestesista_user_id', ''),
      coalesce(nullif(c->>'bloco', ''), 'normal'),
      coalesce((nullif(c->>'is_continuacao', ''))::boolean,  false),
      coalesce((nullif(c->>'sem_anestesista', ''))::boolean, false),
      coalesce(nullif(c->>'tipo', ''), 'eletiva'),
      nullif(c->>'turno', '')
    from jsonb_array_elements(p_casos) as c;
  end if;

  select jsonb_build_object(
    'header', (select to_jsonb(e.*) from public.escala_cirurgica e where e.id = v_id),
    'casos', coalesce(
      (select jsonb_agg(c.* order by c.sala, c.ordem) from public.escala_cirurgica_caso c where c.escala_id = v_id),
      '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.rpc_salvar_escala_cirurgica(jsonb, jsonb) from public, anon;
grant execute on function public.rpc_salvar_escala_cirurgica(jsonb, jsonb) to authenticated, service_role;

COMMIT;

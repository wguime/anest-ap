-- ════════════════════════════════════════════════════════════════════════
-- 20260729200000_escala_caso_residente.sql
-- Residente ACOMPANHANTE do caso cirúrgico (decisão do dono 2026-07-29).
--
-- Até aqui o seletor de anestesista misturava anestesiologistas e residentes
-- (useRosterAnestesistas incluía o papel 'medico-residente'): a lista ficava
-- poluída e dava para escalar um residente como RESPONSÁVEL por engano. O
-- residente não responde pelo caso — ele acompanha. Agora ele é um campo
-- PRÓPRIO do caso (por CASO, não por sala e não por linha da fila) e sai de
-- todos os seletores de anestesista.
--
-- Duas colunas, espelhando o par que já existe para o anestesista:
--   • residente          → nome de exibição (cadastro traz só o primeiro nome,
--                          e está correto assim: não há repetido entre eles)
--   • residente_user_id  → login (profiles.id), que é o que liga o caso à aba
--                          "Minhas" do residente. A identidade vem SEMPRE do uid
--                          escolhido no seletor, nunca de texto importado.
--
-- ⚠️ Coluna nova em escala_cirurgica_caso exige QUATRO camadas: esta migration,
-- CASO_FIELDS e CAMEL_TO_SNAKE no service, e a recriação da RPC de publicar —
-- que enumera as colunas do INSERT e DESCARTA EM SILÊNCIO o que não estiver na
-- lista (mesma classe do gotcha de `turno` em 20260726110000 e de
-- ultima_avaliacao_at no cateter). A RPC é recriada no fim deste arquivo.
--
-- A coluna NÃO participa da liberação: a coluna de liberação continua derivando
-- só do anestesista (regra intocável — quem responde pelo caso é o anestesista).
--
-- Sem impacto em RLS (mesma tabela, mesmas policies) nem em realtime.
-- Idempotente: ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS /
-- CREATE OR REPLACE FUNCTION.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.escala_cirurgica_caso
  ADD COLUMN IF NOT EXISTS residente         TEXT,
  ADD COLUMN IF NOT EXISTS residente_user_id TEXT;

-- espelha idx_escala_caso_anest_uid: a aba "Minhas" do residente filtra por uid
CREATE INDEX IF NOT EXISTS idx_escala_caso_residente_uid
  ON public.escala_cirurgica_caso (residente_user_id);

COMMENT ON COLUMN public.escala_cirurgica_caso.residente IS
  'Nome de exibição do residente que ACOMPANHA o caso (cadastro tem só o primeiro nome, por decisão do dono 2026-07-29). Não é o responsável — a coluna de liberação deriva só do anestesista.';
COMMENT ON COLUMN public.escala_cirurgica_caso.residente_user_id IS
  'Login (profiles.id) do residente acompanhante — é o que liga o caso à aba "Minhas" dele. Vem sempre do seletor, nunca de texto importado.';

-- ── RPC de publicar recriada COM a coluna nova ──────────────────────────────
-- Idêntica à versão de 20260726110000 exceto pelas duas colunas do residente.
-- Sem isto, publicar a escala descartaria o residente em silêncio.
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
      anestesista, anestesista_user_id, residente, residente_user_id,
      bloco, is_continuacao, sem_anestesista, tipo, turno
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
      nullif(c->>'residente', ''),
      nullif(c->>'residente_user_id', ''),
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

-- ROLLBACK (manual) — ⚠️ DESTRUTIVO: o DROP COLUMN apaga o que a equipe já tiver
-- preenchido, sem backup. Exporte antes:
--   select id, escala_id, sala, ordem, residente, residente_user_id
--     from public.escala_cirurgica_caso where residente_user_id is not null;
--
-- ⚠️ Só vale enquanto 20260729210000 (termino_previsto) NÃO estiver aplicada:
-- reaplicar a RPC de 20260726110000 com a 210000 viva removeria `termino_previsto`
-- do INSERT junto, e esse campo voltaria a ser descartado em silêncio.
--
-- A ORDEM importa: restaurar a RPC PRIMEIRO. Ao contrário, existe uma janela em
-- que a função referencia coluna que já não existe e toda publicação toma 42703 —
-- no meio de uma manhã cirúrgica isso é visível para o usuário.
--   1. node scripts/deploy-sp21-mgmt-api.mjs apply-migration supabase/migrations/20260726110000_escala_rpc_turno.sql
--   2. ALTER TABLE public.escala_cirurgica_caso DROP COLUMN IF EXISTS residente_user_id;
--      ALTER TABLE public.escala_cirurgica_caso DROP COLUMN IF EXISTS residente;
--      (o índice cai junto com a coluna)

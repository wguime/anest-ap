-- ════════════════════════════════════════════════════════════════════════
-- 20260729210000_escala_caso_termino_previsto.sql
-- Término previsto de UMA CIRURGIA (decisão do dono 2026-07-29).
--
-- Até aqui o cronômetro era só da PESSOA: `linha_overrides[chave].termino`
-- responde "quanto falta para o Fulano sair". O dono pediu também o tempo de
-- CADA cirurgia — e, principalmente, que o plantonista NUNCA confunda um com o
-- outro. Por isso o tempo da cirurgia mora no CASO (é dele), e o total da pessoa
-- continua onde está.
--
-- ⚠️ O total da pessoa NÃO é — e não pode virar — a soma destes campos. Estimativa
-- de caso cirúrgico que estoura não converge para zero (Dexter et al., Anesth
-- Analg): somar as partes acumularia o erro justamente na hora em que a fila
-- depende do número. Os dois são manuais e independentes, como o resto do
-- cronômetro desde 23/07 (a estimativa automática foi removida — não reintroduzir).
--
-- Formato "HH:MM" (hora do término), igual ao `termino` do override da linha: o
-- front converte para "faltam ~40min" na hora de exibir, então o valor guardado
-- não envelhece sozinho.
--
-- ⚠️ Coluna nova em escala_cirurgica_caso exige QUATRO camadas: esta migration,
-- CASO_FIELDS e CAMEL_TO_SNAKE no service, e a recriação da RPC de publicar —
-- que enumera as colunas do INSERT e descarta em silêncio o que não estiver na
-- lista. A RPC é recriada no fim deste arquivo (com `residente`/`residente_user_id`
-- de 20260729200000, que precisa ter sido aplicada antes).
--
-- Sem impacto em RLS (mesma tabela, mesmas policies) nem em realtime.
-- Idempotente: ADD COLUMN IF NOT EXISTS / CREATE OR REPLACE FUNCTION.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- Pré-condição: a RPC abaixo insere `residente`/`residente_user_id`, que vêm da
-- 20260729200000. O plpgsql NÃO valida colunas no CREATE, então sem este guard a
-- migration passaria aqui e só quebraria na PRIMEIRA PUBLICAÇÃO DE ESCALA, com
-- 42703 — no meio do expediente. Melhor falhar agora, que é barato.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'escala_cirurgica_caso'
      AND column_name = 'residente'
  ) THEN
    RAISE EXCEPTION 'aplique 20260729200000_escala_caso_residente.sql antes desta';
  END IF;
END $$;

ALTER TABLE public.escala_cirurgica_caso
  ADD COLUMN IF NOT EXISTS termino_previsto TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.escala_cirurgica_caso'::regclass
      AND conname = 'escala_cirurgica_caso_termino_previsto_check'
  ) THEN
    ALTER TABLE public.escala_cirurgica_caso
      ADD CONSTRAINT escala_cirurgica_caso_termino_previsto_check
      CHECK (termino_previsto IS NULL OR termino_previsto ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
  END IF;
END $$;

COMMENT ON COLUMN public.escala_cirurgica_caso.termino_previsto IS
  'Hora prevista de término DESTA cirurgia ("HH:MM"), informada à mão pela equipe. Não confundir com linha_overrides[chave].termino, que é quando a PESSOA fica livre — e que NUNCA é a soma destes campos.';

-- ── RPC de publicar recriada COM a coluna nova ──────────────────────────────
-- Idêntica à de 20260729200000 exceto por termino_previsto. Sem isto, publicar
-- a escala descartaria o campo em silêncio.
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
      escala_id, sala, ordem, hora, tempo_estimado, termino_previsto, paciente_iniciais, idade,
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
      nullif(c->>'termino_previsto', ''),
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

-- ROLLBACK (manual) — ⚠️ DESTRUTIVO: o DROP COLUMN apaga os tempos já informados.
-- Exporte antes (é dado do dia, mas ainda assim):
--   select id, escala_id, sala, ordem, termino_previsto
--     from public.escala_cirurgica_caso where termino_previsto is not null;
--
-- A ORDEM importa: restaurar a RPC PRIMEIRO. Ao contrário, existe uma janela em
-- que a função referencia coluna que já não existe e toda publicação toma 42703.
--   1. node scripts/deploy-sp21-mgmt-api.mjs apply-migration supabase/migrations/20260729200000_escala_caso_residente.sql
--   2. ALTER TABLE public.escala_cirurgica_caso DROP COLUMN IF EXISTS termino_previsto;
--      (o CHECK cai junto com a coluna)

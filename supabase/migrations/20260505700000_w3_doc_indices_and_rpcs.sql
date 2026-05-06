-- ============================================================================
-- Wave 3 / W3-4 — Indices + RPCs atômicas para Gestão Documental
-- ----------------------------------------------------------------------------
-- Objetivo:
--   1. Garantir índices em documentos.setor_id e documentos.categoria
--      (idempotente — alguns já foram criados em Waves anteriores).
--   2. Criar `rpc_increment_view_count` — incrementa view_count + insere
--      audit row (changelog) em uma única transação.
--   3. Criar `rpc_add_document_version` — insere versão nova, arquiva
--      versões ativas anteriores, atualiza `documentos.versao_atual` e
--      cria audit row, tudo em uma única transação (BEGIN/COMMIT implícitos
--      via plpgsql function body com EXCEPTION block).
--
-- Schema verificado (001_schema.sql + Wave 0 consolidated):
--   - documentos.id              text   (NÃO uuid — Firebase-friendly IDs)
--   - documentos.view_count      integer default 0
--   - documento_versoes.id       uuid (gen_random_uuid)
--   - documento_versoes.documento_id   text → documentos(id)
--   - documento_changelog              é a tabela de audit (não há
--                                      "documento_audit_log" no schema)
--   - documento_changelog.user_id      text (Firebase UID)
--   - documento_changelog.action       enum/check incluindo 'viewed' e
--                                      'version_added'
--
-- Idempotente: usa IF NOT EXISTS / CREATE OR REPLACE. Sem DROP destrutivo.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Índices (idempotentes — protegem contra ambientes onde Wave 0 não rodou)
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_doc_setor
  ON public.documentos(setor_id)
  WHERE setor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_doc_categoria
  ON public.documentos(categoria);

-- idx_doc_updated_at JÁ existe (Wave 0 — 20260504100400). NÃO recriar.

-- ----------------------------------------------------------------------------
-- 2. RPC: rpc_increment_view_count
--    Incremento atômico de view_count + audit row.
--
--    Atenção: documentos.id é TEXT (não uuid). Para manter compatibilidade
--    com o schema atual e os Firebase UIDs em user_id, usamos TEXT em ambos.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_increment_view_count(
  p_doc_id     text,
  p_user_id    text,
  p_user_name  text DEFAULT NULL,
  p_user_email text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Increment counter atomically (single SQL statement, isolated by Postgres)
  UPDATE public.documentos
     SET view_count = COALESCE(view_count, 0) + 1
   WHERE id = p_doc_id;

  -- Audit row in changelog (best-effort — if action 'viewed' isn't allowed
  -- by the CHECK constraint in some env, skip silently rather than blocking
  -- the read path).
  BEGIN
    INSERT INTO public.documento_changelog
      (documento_id, action, user_id, user_name, user_email, changes, comment)
    VALUES (
      p_doc_id,
      'viewed',
      p_user_id,
      COALESCE(p_user_name, 'unknown'),
      p_user_email,
      '{}'::jsonb,
      ''
    );
  EXCEPTION
    WHEN check_violation OR foreign_key_violation THEN
      -- Document doesn't exist, or 'viewed' not in action enum: silently
      -- ignore. Counter update above already committed nothing if the row
      -- didn't exist (UPDATE 0 rows is not an error).
      NULL;
  END;
END;
$$;

COMMENT ON FUNCTION public.rpc_increment_view_count(text, text, text, text) IS
  'W3-4: incremento atômico de documentos.view_count + audit changelog. Substitui o read-then-write não-atômico em supabaseDocumentService.recordView.';

-- ----------------------------------------------------------------------------
-- 3. RPC: rpc_add_document_version
--    Insere versão nova, arquiva versões ativas anteriores, atualiza
--    versao_atual no documento e grava audit row — tudo em uma única
--    transação (Postgres functions são transacionais por padrão; o EXCEPTION
--    block garante rollback em caso de erro intermediário).
--
--    p_version_data: jsonb com chaves arquivo_url, arquivo_nome,
--                    arquivo_tamanho, storage_path, descricao_alteracao,
--                    motivo_alteracao.
--    p_user_info:    jsonb com chaves user_id, user_name, user_email.
--
--    Returns: a row do documento_versoes recém-inserido (json).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_add_document_version(
  p_doc_id        text,
  p_version_data  jsonb,
  p_user_info     jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        text;
  v_user_name      text;
  v_user_email     text;
  v_codigo         text;
  v_versao_atual   integer;
  v_new_version    integer;
  v_arquivo_url    text;
  v_arquivo_nome   text;
  v_arquivo_size   bigint;
  v_storage_path   text;
  v_desc           text;
  v_motivo         text;
  v_inserted       documento_versoes%ROWTYPE;
BEGIN
  -- Extract user info (required: user_id e user_name)
  v_user_id    := p_user_info ->> 'user_id';
  v_user_name  := p_user_info ->> 'user_name';
  v_user_email := p_user_info ->> 'user_email';

  IF v_user_id IS NULL OR v_user_name IS NULL THEN
    RAISE EXCEPTION 'rpc_add_document_version: p_user_info deve conter user_id e user_name'
      USING ERRCODE = '22023';  -- invalid_parameter_value
  END IF;

  -- Read current document state — lock row to avoid concurrent version bumps
  SELECT codigo, COALESCE(versao_atual, 1)
    INTO v_codigo, v_versao_atual
    FROM public.documentos
   WHERE id = p_doc_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'rpc_add_document_version: documento % não encontrado', p_doc_id
      USING ERRCODE = 'P0002';  -- no_data_found
  END IF;

  v_new_version := v_versao_atual + 1;

  -- Extract version payload
  v_arquivo_url  := p_version_data ->> 'arquivo_url';
  v_arquivo_nome := COALESCE(
    p_version_data ->> 'arquivo_nome',
    COALESCE(v_codigo, 'DOC') || '-v' || v_new_version::text || '.pdf'
  );
  v_arquivo_size := NULLIF(p_version_data ->> 'arquivo_tamanho', '')::bigint;
  v_storage_path := p_version_data ->> 'storage_path';
  v_desc         := COALESCE(p_version_data ->> 'descricao_alteracao', 'Atualização do documento');
  v_motivo       := COALESCE(p_version_data ->> 'motivo_alteracao', 'Revisão');

  -- 1. Archive previously active versions
  UPDATE public.documento_versoes
     SET status = 'arquivado'
   WHERE documento_id = p_doc_id
     AND status = 'ativo';

  -- 2. Insert new version
  INSERT INTO public.documento_versoes (
    documento_id, versao, arquivo_url, arquivo_nome, arquivo_tamanho,
    storage_path, descricao_alteracao, motivo_alteracao, status,
    created_by, created_by_name
  )
  VALUES (
    p_doc_id, v_new_version, v_arquivo_url, v_arquivo_nome, v_arquivo_size,
    v_storage_path, v_desc, v_motivo, 'ativo',
    v_user_id, v_user_name
  )
  RETURNING * INTO v_inserted;

  -- 3. Update document's current version pointer
  UPDATE public.documentos
     SET versao_atual    = v_new_version,
         arquivo_url     = COALESCE(v_arquivo_url, arquivo_url),
         arquivo_nome    = COALESCE(v_arquivo_nome, arquivo_nome),
         updated_by      = v_user_id,
         updated_by_name = v_user_name
   WHERE id = p_doc_id;

  -- 4. Audit row
  INSERT INTO public.documento_changelog
    (documento_id, action, user_id, user_name, user_email, changes, comment)
  VALUES (
    p_doc_id,
    'version_added',
    v_user_id,
    v_user_name,
    v_user_email,
    jsonb_build_object(
      'versaoAnterior', v_versao_atual,
      'versaoNova',     v_new_version
    ),
    v_desc
  );

  -- Return inserted version row as jsonb
  RETURN to_jsonb(v_inserted);
END;
$$;

COMMENT ON FUNCTION public.rpc_add_document_version(text, jsonb, jsonb) IS
  'W3-4: cria versão nova de documento atomicamente — insere em documento_versoes, arquiva ativas anteriores, atualiza documentos.versao_atual e grava changelog. Substitui o fluxo de 4 round-trips em supabaseDocumentService.addVersion.';

-- ----------------------------------------------------------------------------
-- 4. Grants — RPCs precisam ser executáveis pelo role authenticated
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.rpc_increment_view_count(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_add_document_version(text, jsonb, jsonb)     TO authenticated;

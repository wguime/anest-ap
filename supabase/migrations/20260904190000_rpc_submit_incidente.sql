-- ==========================================================================
-- 20260904190000_rpc_submit_incidente.sql
-- Envio AUTENTICADO de incidente/denúncia pelo app via RPC SECURITY DEFINER.
--
-- Bug (auditoria 04/09/2026): o app fazia INSERT ... RETURNING direto em
-- `incidentes` (`.insert(row).select()`). O RETURNING passa pelas policies de
-- SELECT; para quem não é admin a única é `user_id = firebase_uid()`, e relato
-- ANÔNIMO nasce com user_id NULL (LGPD) → 42501 "new row violates row-level
-- security policy for table incidentes". Nenhum não-admin conseguia enviar
-- relato anônimo; admin nunca via o erro. Confirmado em SQL, nos logs do
-- gateway e por REST com o usuário E2E.
--
-- Esta RPC espelha rpc_submit_public_incident (formulário público, anon):
--   • só executa autenticado (GRANT a `authenticated`; firebase_uid() não vazio);
--   • decide o anonimato NO SERVIDOR pelo tipoIdentificacao do JSONB:
--     anônimo → user_id NULL e lgpd_consent_at NULL; senão user_id = quem chama
--     (o cliente deixa de poder gravar user_id de terceiro);
--   • só aceita source do app ('app' | 'interno'); o público segue na RPC anon;
--   • normaliza `attachments` ao formato {name,path,size,type}, máx. 5;
--   • devolve a linha inserida (sem fts): protocolo e tracking_code vêm dos
--     triggers já existentes (tr_incidentes_protocolo / tr_incidentes_tracking).
-- Idempotente: CREATE OR REPLACE + GRANT/REVOKE repetíveis.
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.rpc_submit_incidente(
  p_tipo text,
  p_source text DEFAULT 'app',
  p_status text DEFAULT 'pending',
  p_protocolo text DEFAULT NULL,
  p_tracking_code text DEFAULT NULL,
  p_notificante jsonb DEFAULT '{}'::jsonb,
  p_denunciante jsonb DEFAULT '{}'::jsonb,
  p_incidente_data jsonb DEFAULT '{}'::jsonb,
  p_denuncia_data jsonb DEFAULT '{}'::jsonb,
  p_impacto jsonb DEFAULT '{}'::jsonb,
  p_contexto_anest jsonb DEFAULT '{}'::jsonb,
  p_gestao_interna jsonb DEFAULT '{}'::jsonb,
  p_attachments jsonb DEFAULT '[]'::jsonb,
  p_lgpd_consent_at timestamptz DEFAULT NULL,
  p_is_never_event boolean DEFAULT false,
  p_never_event_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid text := NULLIF(public.firebase_uid(), '');
  v_tipo_ident text;
  v_anonimo boolean;
  v_never boolean := COALESCE(p_is_never_event, false);
  v_never_code text := NULLIF(p_never_event_code, '');
  v_attachments jsonb;
  v_row public.incidentes%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'rpc_submit_incidente: caller not authenticated'
      USING ERRCODE = '42501';
  END IF;

  IF p_tipo IS NULL OR p_tipo NOT IN ('incidente', 'denuncia') THEN
    RAISE EXCEPTION 'rpc_submit_incidente: invalid tipo %', p_tipo
      USING ERRCODE = '22023';
  END IF;

  IF p_source IS NULL OR p_source NOT IN ('app', 'interno') THEN
    RAISE EXCEPTION 'rpc_submit_incidente: invalid source % (público usa rpc_submit_public_incident)', p_source
      USING ERRCODE = '22023';
  END IF;

  IF COALESCE(p_status, '') NOT IN ('', 'pending', 'pendente') THEN
    RAISE EXCEPTION 'rpc_submit_incidente: relato novo nasce pending, não %', p_status
      USING ERRCODE = '22023';
  END IF;

  -- Anonimato é decidido aqui, nunca pelo cliente: relato anônimo não recebe
  -- user_id nem lgpd_consent_at (mesma regra que o front aplicava).
  v_tipo_ident := CASE
    WHEN p_tipo = 'denuncia' THEN COALESCE(p_denunciante, '{}'::jsonb) ->> 'tipoIdentificacao'
    ELSE COALESCE(p_notificante, '{}'::jsonb) ->> 'tipoIdentificacao'
  END;
  v_anonimo := (COALESCE(v_tipo_ident, '') = 'anonimo');

  -- Relato anônimo: o JSONB de identidade vira a forma canônica — mesmo que o
  -- cliente (bug ou má-fé) mande nome/e-mail junto, nada é persistido.
  IF v_anonimo THEN
    IF p_tipo = 'denuncia' THEN
      p_denunciante := '{"tipoIdentificacao":"anonimo"}'::jsonb;
    ELSE
      p_notificante := '{"tipoIdentificacao":"anonimo"}'::jsonb;
    END IF;
  END IF;

  -- Never Event só existe em incidente; flag sem código cai (constraint
  -- chk_never_event_code_when_flagged exige código quando true).
  IF p_tipo <> 'incidente' THEN
    v_never := false;
    v_never_code := NULL;
  END IF;
  IF v_never AND v_never_code IS NULL THEN
    v_never := false;
  END IF;

  -- Anexos: só objetos com `path`, 4 campos conhecidos, máx. 5 (espelha
  -- sanitizeAttachments do front — o cliente não é confiável aqui).
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'name', COALESCE(NULLIF(s.a ->> 'name', ''), regexp_replace(s.a ->> 'path', '^.*/', '')),
           'path', s.a ->> 'path',
           'size', CASE WHEN (s.a ->> 'size') ~ '^[0-9]+$' THEN (s.a ->> 'size')::bigint ELSE 0 END,
           'type', COALESCE(s.a ->> 'type', '')
         ) ORDER BY s.ord), '[]'::jsonb)
    INTO v_attachments
    FROM (
      SELECT t.a, t.ord
        FROM jsonb_array_elements(
               CASE WHEN jsonb_typeof(COALESCE(p_attachments, '[]'::jsonb)) = 'array'
                    THEN p_attachments ELSE '[]'::jsonb END
             ) WITH ORDINALITY AS t(a, ord)
       WHERE jsonb_typeof(t.a) = 'object' AND COALESCE(t.a ->> 'path', '') <> ''
       ORDER BY t.ord
       LIMIT 5
    ) s;

  -- Relato anônimo só pode apontar para as pastas *-anon/ — é o WHEN do trigger
  -- tr_incidentes_anexos_scrub_anon que apaga o owner do upload. Fora dela o
  -- vínculo de identidade ficaria no storage; melhor recusar do que perder
  -- evidência em silêncio ou vazar quem enviou.
  IF v_anonimo AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_attachments) x
     WHERE (x ->> 'path') !~ '^(denuncias|incidentes)-anon/'
  ) THEN
    RAISE EXCEPTION 'rpc_submit_incidente: anexo de relato anônimo fora da pasta *-anon/'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.incidentes (
    tipo, source, status, protocolo, tracking_code, user_id,
    notificante, denunciante, incidente_data, denuncia_data,
    impacto, contexto_anest, gestao_interna, attachments,
    lgpd_consent_at, is_never_event, never_event_code
  ) VALUES (
    p_tipo,
    p_source,
    -- Relato novo nasce SEMPRE pendente (o cliente não escolhe o status;
    -- 'pendente' legado da NovoIncidentePage vira a chave que a UI conhece).
    'pending',
    NULLIF(p_protocolo, ''),
    NULLIF(p_tracking_code, ''),
    CASE WHEN v_anonimo THEN NULL ELSE v_uid END,
    COALESCE(p_notificante, '{}'::jsonb),
    COALESCE(p_denunciante, '{}'::jsonb),
    COALESCE(p_incidente_data, '{}'::jsonb),
    COALESCE(p_denuncia_data, '{}'::jsonb),
    COALESCE(p_impacto, '{}'::jsonb),
    COALESCE(p_contexto_anest, '{}'::jsonb),
    COALESCE(p_gestao_interna, '{}'::jsonb),
    v_attachments,
    CASE WHEN v_anonimo THEN NULL ELSE COALESCE(p_lgpd_consent_at, now()) END,
    v_never,
    v_never_code
  )
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row) - 'fts';
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_submit_incidente(
  text, text, text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, timestamptz, boolean, text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.rpc_submit_incidente(
  text, text, text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, timestamptz, boolean, text
) TO authenticated;

COMMENT ON FUNCTION public.rpc_submit_incidente(
  text, text, text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, timestamptz, boolean, text
) IS
  'Envio autenticado de incidente/denúncia pelo app. SECURITY DEFINER porque o '
  'RETURNING do INSERT direto esbarrava na policy de SELECT em relato anônimo '
  '(user_id NULL). Decide anonimato e user_id no servidor. Auditoria 04/09/2026.';

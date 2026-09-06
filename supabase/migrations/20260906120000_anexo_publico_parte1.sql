-- ==========================================================================
-- 20260906120000_anexo_publico_parte1.sql
-- Anexo no canal público (QR code) + base do limite por IP no envio.
--
-- Quem relata pelo QR (public/formulario-*.html) não conseguia enviar NENHUM
-- arquivo: a versão PUBLICADA das páginas não tem campo de arquivo e
-- rpc_submit_public_incident não tem parâmetro de anexo. Pelo app um relato leva
-- até 5. A apuração começava sem prova justamente no canal de quem está de fora.
-- (O campo já existe no working tree, nesta mesma entrega.)
--
-- Decisões do dono (05/09/2026): imagens e PDF; 3 arquivos de até 10 MB no canal
-- público; e fechar, no mesmo trabalho, o envio público — que hoje roda direto
-- pela chave anon, sem IP e sem janela (as três verify-*-public já têm limite).
--
-- Esta é a PARTE 1: só ADICIONA capacidade, sem tirar nada de ninguém. O
-- `REVOKE ... FROM anon` de rpc_submit_public_incident fica na parte 2, aplicada
-- só depois que o front novo e a edge `relato-publico` estiverem no ar — assim
-- não existe janela com página publicada chamando uma função que já perdeu o
-- acesso. (Os três HTML públicos são servidos com `no-cache, no-store` no
-- firebase.json, então não há versão velha viva em cache.)
--
-- Idempotente: CREATE OR REPLACE + on conflict do update + REVOKE/GRANT.
-- ⚠️ Re-executar ESTA migration DEPOIS da parte 2 reconcede `anon` (o GRANT no
-- fim) e reabre a RPC pública em silêncio. Se precisar re-rodar, rode a parte 2
-- logo em seguida.
--
-- Rollback (precisa de migration nova, `git revert` não desfaz):
--   update storage.buckets set allowed_mime_types = null where id='incidentes-anexos';
--   drop function public.rpc_submit_public_incident(text,text,text,jsonb,jsonb,jsonb,
--     jsonb,jsonb,jsonb,timestamptz,text,jsonb);
--   -- reaplicar o corpo de 20260505103000_rpc_extract_never_event.sql
--   drop function public.rpc_reservar_protocolo(text);
--   drop function public.rpc_check_relato_publico_rate_limit(text,text);
-- ==========================================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Balde: tipo de arquivo passa a ser barrado pelo SERVIDOR
-- ──────────────────────────────────────────────────────────────────────────
-- Até aqui `incidentes-anexos` só tinha file_size_limit (20 MB, migration
-- 20260730230000) e aceitava QUALQUER tipo — aceitável enquanto o upload exigia
-- login, menos defensável num endereço aberto na internet. A lista vale para o
-- balde inteiro, então o app passa a seguir a mesma regra (decisão do dono).
--
-- ⚠️ Isto confere o Content-Type DECLARADO na requisição; o Storage não inspeciona
-- o conteúdo. É guarda de usabilidade e rede de segurança, não controle: quem
-- quiser declara `image/png` e sobe outra coisa. O que protege de verdade é o
-- balde ser privado, sem execução, com download só por link temporário.
--
-- ⚠️ Só entra junto com o ajuste do app na MESMA entrega (accept no seletor de
-- arquivo + MIME derivado da extensão em uploadAnexos). Sem isso, anexar um
-- vídeo ou um .docx pelo app passaria a derrubar o relato INTEIRO — falha de
-- upload bloqueia o envio por desenho desde 30/07/2026.
--
-- ⚠️ HEIC/HEIF são obrigatórios: é o formato padrão da câmera do iPhone. Sem
-- eles, metade do grupo não anexa foto nenhuma.
-- O teto de 10 MB do canal público é aplicado na edge; o balde segue em 20 MB
-- porque o app (autenticado) continua com 5 × 20 MB.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'incidentes-anexos', 'incidentes-anexos', false, 20971520,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit   = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types,
      public            = EXCLUDED.public;

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Protocolo reservado ANTES do INSERT
-- ──────────────────────────────────────────────────────────────────────────
-- O caminho do anexo é `pasta/PROTOCOLO/uuid.ext` e o cleanup
-- (scripts/cleanup-incidentes-anexos.mjs) cruza o 2º segmento com a coluna
-- `protocolo` para decidir o que é órfão. Sem o protocolo no caminho, todo anexo
-- público seria apagado como órfão em 7 dias. Como o protocolo só nasce no
-- trigger (depois do INSERT), a edge reserva um aqui — mesma sequência e mesmo
-- formato, para a linha e a pasta casarem.
CREATE OR REPLACE FUNCTION public.rpc_reservar_protocolo(p_tipo text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_prefix text;
  v_seq bigint;
  v_protocolo text;
  v_tentativa int := 0;
BEGIN
  IF p_tipo IS NULL OR p_tipo NOT IN ('incidente', 'denuncia') THEN
    RAISE EXCEPTION 'rpc_reservar_protocolo: tipo inválido %', p_tipo USING ERRCODE = '22023';
  END IF;

  v_prefix := CASE p_tipo WHEN 'denuncia' THEN 'DEN' ELSE 'INC' END;

  -- Mesmo LOOP de generate_protocolo: nextval é atômico, mas o formato corta a
  -- sequência em 4 dígitos (% 10000), então colisão é possível em tese. Sem o
  -- retry, ela viraria 23505 no INSERT — com os arquivos já subidos e um caminho
  -- que carrega o protocolo, obrigando a pessoa a anexar tudo de novo.
  LOOP
    v_seq := nextval('public.seq_protocolo_global');
    v_protocolo := v_prefix || '-' || to_char(now(), 'YYYYMMDD') || '-'
                   || lpad((v_seq % 10000)::text, 4, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.incidentes WHERE protocolo = v_protocolo
    );
    v_tentativa := v_tentativa + 1;
    IF v_tentativa >= 5 THEN
      RAISE EXCEPTION 'rpc_reservar_protocolo: não foi possível reservar protocolo'
        USING ERRCODE = '55000';
    END IF;
  END LOOP;

  RETURN v_protocolo;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_reservar_protocolo(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_reservar_protocolo(text) TO service_role;

COMMENT ON FUNCTION public.rpc_reservar_protocolo(text) IS
  'Reserva um protocolo (mesma sequência e formato de generate_protocolo) para a edge '
  'relato-publico montar o caminho do anexo antes do INSERT. Só service_role. 06/09/2026.';

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Limite por IP do canal público
-- ──────────────────────────────────────────────────────────────────────────
-- Espelha rpc_check_cert_uuid_rate_limit (20260520120000) e grava na tabela que
-- já existe (documento_api_rate_limit), que tem índice (ip, requested_at) e
-- limpeza horária pelo cron `cleanup-doc-api-rate-limit`. Janela maior que a das
-- verify-* (60s) porque relatar leva minutos, não segundos.
CREATE OR REPLACE FUNCTION public.rpc_check_relato_publico_rate_limit(p_ip text, p_endpoint text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_count integer;
  v_window interval := interval '10 minutes';
  v_limit integer;
BEGIN
  -- `IS NULL` explícito: `NULL NOT IN (...)` é NULL, o IF não dispara e o INSERT
  -- morreria com 23502 opaco em vez do 22023 legível.
  IF p_endpoint IS NULL OR p_endpoint NOT IN ('relato-publico-preparar', 'relato-publico-enviar') THEN
    RAISE EXCEPTION 'rpc_check_relato_publico_rate_limit: endpoint inválido' USING ERRCODE = '22023';
  END IF;
  IF p_ip IS NULL OR p_ip = '' THEN p_ip := 'unknown'; END IF;

  -- Preparar é mais frouxo que enviar: a pessoa pode trocar de arquivo antes de
  -- concluir. Quem envia 5 relatos em 10 min de um mesmo IP não é caso de uso.
  v_limit := CASE p_endpoint WHEN 'relato-publico-preparar' THEN 10 ELSE 5 END;

  SELECT COUNT(*) INTO v_count
    FROM public.documento_api_rate_limit
   WHERE ip = p_ip
     AND endpoint = p_endpoint
     AND requested_at >= now() - v_window;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.documento_api_rate_limit (ip, endpoint, requested_at)
  VALUES (p_ip, p_endpoint, now());
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_check_relato_publico_rate_limit(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_check_relato_publico_rate_limit(text, text) TO service_role;

COMMENT ON FUNCTION public.rpc_check_relato_publico_rate_limit(text, text) IS
  'Janela deslizante de 10 min por IP do canal público (10 preparar / 5 enviar). '
  'Mesma tabela e mesmo cron de limpeza das verify-*-public. 06/09/2026.';

-- ──────────────────────────────────────────────────────────────────────────
-- 4. Envio público aceita protocolo reservado e anexos
-- ──────────────────────────────────────────────────────────────────────────
-- Parâmetros novos no FIM da lista: chamada antiga (10 argumentos, sem anexo)
-- continua válida, o que mantém o formulário publicado funcionando até o novo ir
-- ao ar. O cliente nunca é confiável aqui: o caminho de cada anexo é conferido
-- contra o protocolo desta linha e contra a pasta que o anonimato exige, e o
-- objeto precisa EXISTIR no Storage — senão o relato entra prometendo evidência
-- que não está lá (a perda silenciosa que motivou a reforma de 30/07).
-- ⚠️ DROP antes do CREATE: acrescentar parâmetros muda a assinatura, e
-- CREATE OR REPLACE criaria uma função IRMÃ de 10 argumentos convivendo com a de
-- 12 — toda chamada viraria ambígua ("function is not unique") e o canal público
-- inteiro cairia. A chamada antiga (10 argumentos nomeados, que é como o
-- PostgREST chama) continua atendida pela nova, via DEFAULT nos dois novos.
DROP FUNCTION IF EXISTS public.rpc_submit_public_incident(
  text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, timestamptz
);

CREATE OR REPLACE FUNCTION public.rpc_submit_public_incident(
  p_tipo text,
  p_source text,
  p_status text,
  p_notificante jsonb DEFAULT '{}'::jsonb,
  p_denunciante jsonb DEFAULT '{}'::jsonb,
  p_incidente_data jsonb DEFAULT '{}'::jsonb,
  p_denuncia_data jsonb DEFAULT '{}'::jsonb,
  p_impacto jsonb DEFAULT '{}'::jsonb,
  p_contexto_anest jsonb DEFAULT '{}'::jsonb,
  p_lgpd_consent_at timestamptz DEFAULT NULL::timestamptz,
  p_protocolo text DEFAULT NULL,
  p_attachments jsonb DEFAULT '[]'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  result record;
  v_is_never_event boolean;
  v_never_event_code text;
  v_tipo_ident text;
  v_anonimo boolean;
  v_pasta text;
  v_protocolo text := NULLIF(p_protocolo, '');
  v_attachments jsonb;
  v_max_bytes bigint := 10485760;  -- 10 MB: teto do canal público
BEGIN
  IF p_source NOT IN ('formulario_publico', 'externo') THEN
    RAISE EXCEPTION 'Invalid source for public submission';
  END IF;

  -- Formato do protocolo reservado, conferido ANTES de qualquer uso.
  -- Sem isto, o valor GRAVADO (cru) e o usado na checagem de pasta (sanitizado)
  -- podiam divergir: 'INC-20260830-0007.' sanitiza para o protocolo real, passa
  -- na checagem, mas grava diferente — e o UNIQUE não pega. Nasceria um relato
  -- forjado apontando para a evidência de outro, que nem admin apaga depois
  -- (attachments é imutável fora do admin desde 04/09). Protocolo é sequencial
  -- e adivinhável, então isto é integridade, não estética.
  IF v_protocolo IS NOT NULL AND v_protocolo !~ (
       '^' || CASE WHEN p_tipo = 'denuncia' THEN 'DEN' ELSE 'INC' END || '-[0-9]{8}-[0-9]{4}$'
     ) THEN
    RAISE EXCEPTION 'rpc_submit_public_incident: protocolo reservado inválido'
      USING ERRCODE = '22023';
  END IF;

  -- Extrai NE do JSONB (incidente apenas — denúncia não tem NE).
  IF p_tipo = 'incidente' THEN
    v_is_never_event := COALESCE((p_incidente_data->>'isNeverEvent')::boolean, false);
    v_never_event_code := NULLIF(p_incidente_data->>'neverEventCode', '');
  ELSE
    v_is_never_event := false;
    v_never_event_code := NULL;
  END IF;

  -- Defesa: se flag true mas código vazio, derruba a flag (constraint
  -- chk_never_event_code_when_flagged exige código quando true).
  IF v_is_never_event AND v_never_event_code IS NULL THEN
    v_is_never_event := false;
  END IF;

  -- Pasta exigida: o anonimato decide, como no app. É o WHEN do trigger
  -- tr_incidentes_anexos_scrub_anon que zera o dono do upload nas pastas *-anon.
  v_tipo_ident := CASE
    WHEN p_tipo = 'denuncia' THEN COALESCE(p_denunciante, '{}'::jsonb) ->> 'tipoIdentificacao'
    ELSE COALESCE(p_notificante, '{}'::jsonb) ->> 'tipoIdentificacao'
  END;
  v_anonimo := (COALESCE(v_tipo_ident, '') = 'anonimo');
  v_pasta := CASE WHEN p_tipo = 'denuncia' THEN 'denuncias' ELSE 'incidentes' END
             || CASE WHEN v_anonimo THEN '-anon' ELSE '' END;

  -- Normalização espelhando sanitizeAttachments do front e a de
  -- rpc_submit_incidente: só objeto com `path`, 4 campos conhecidos, teto de 3.
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
       LIMIT 3
    ) s;

  IF jsonb_array_length(v_attachments) > 0 THEN
    IF v_protocolo IS NULL THEN
      RAISE EXCEPTION 'rpc_submit_public_incident: anexo exige protocolo reservado'
        USING ERRCODE = '22023';
    END IF;

    -- Caminho tem de ser exatamente `<pasta exigida>/<protocolo desta linha>/...`.
    -- Sem isto, um cliente forjado penduraria arquivo em relato alheio. O
    -- protocolo já passou pela validação de formato acima, então entra direto no
    -- LIKE — nada de sanitizar aqui e gravar outro valor ali. O `..` é recusado
    -- por cinto: hoje o caminho é montado pela edge, mas a regra não pode
    -- depender disso.
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_attachments) x
       WHERE (x ->> 'path') NOT LIKE v_pasta || '/' || v_protocolo || '/%'
          OR (x ->> 'path') LIKE '%..%'
    ) THEN
      RAISE EXCEPTION 'rpc_submit_public_incident: anexo fora da pasta do próprio relato'
        USING ERRCODE = '22023';
    END IF;

    -- O objeto tem de existir de verdade, dentro do teto do canal público.
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_attachments) x
       WHERE NOT EXISTS (
         SELECT 1 FROM storage.objects o
          WHERE o.bucket_id = 'incidentes-anexos'
            AND o.name = (x ->> 'path')
            AND COALESCE((o.metadata ->> 'size')::bigint, 0) BETWEEN 1 AND v_max_bytes
       )
    ) THEN
      RAISE EXCEPTION 'rpc_submit_public_incident: anexo não encontrado no armazenamento'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Relato novo nasce SEMPRE pendente. Enquanto `anon` executa esta função
  -- direto (até a parte 2), `p_status` vinha cru do cliente: dava para nascer já
  -- 'resolvido' e nunca aparecer na fila dos responsáveis. Mesma regra que
  -- rpc_submit_incidente aplica no caminho autenticado.
  INSERT INTO public.incidentes (
    user_id, tipo, source, status, protocolo,
    notificante, denunciante,
    incidente_data, denuncia_data,
    impacto, contexto_anest, attachments,
    lgpd_consent_at,
    is_never_event, never_event_code
  ) VALUES (
    NULL, p_tipo, p_source, 'pending', v_protocolo,
    p_notificante, p_denunciante,
    p_incidente_data, p_denuncia_data,
    p_impacto, p_contexto_anest, v_attachments,
    p_lgpd_consent_at,
    v_is_never_event, v_never_event_code
  )
  RETURNING protocolo, tracking_code INTO result;

  RETURN json_build_object(
    'protocolo', result.protocolo,
    'tracking_code', result.tracking_code,
    'is_never_event', v_is_never_event
  );
END;
$$;

-- Grants: `anon` segue com EXECUTE até a parte 2 (o formulário publicado ainda
-- chama direto). service_role é quem a edge nova usa.
GRANT EXECUTE ON FUNCTION public.rpc_submit_public_incident(
  text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, timestamptz, text, jsonb
) TO anon, service_role;

COMMENT ON FUNCTION public.rpc_submit_public_incident(
  text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, timestamptz, text, jsonb
) IS
  'Submit público (formulário do QR). Aceita protocolo reservado pela edge relato-publico '
  'e até 3 anexos, conferindo pasta, protocolo e existência do objeto no Storage. '
  'A partir da parte 2 só a edge executa (limite por IP). 06/09/2026.';

COMMIT;

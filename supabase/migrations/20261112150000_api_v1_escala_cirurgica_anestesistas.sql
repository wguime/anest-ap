-- =============================================================================
-- 20261112150000_api_v1_escala_cirurgica_anestesistas.sql — API externa (nov/2026)
--
-- O dono vai entregar UMA chave de API a uma empresa externa. A edge api-v1
-- ganha rotas read-only de escala cirúrgica, anestesistas, residentes,
-- funcionárias e férias. Esta migration:
--
--   (a) amplia o CHECK api_tokens_scopes_subset_check com os 5 escopos novos,
--       mantendo os 6 atuais (20260513140000_api_token_write_scopes.sql);
--   (b) cria as views whitelist que a edge lê:
--         vw_api_escala_cirurgica — um caso por linha, já juntado à escala,
--                                   só escala publicada (e turno publicado);
--         vw_api_anestesistas     — roster de anestesistas + apelidos.
--
-- LGPD — whitelist por coluna. FICAM DE FORA, sem exceção: paciente_iniciais,
-- idade, procedimento, convenio, gravidade, linha_overrides/observações,
-- source_image_path, e-mail, permissions, last_access, is_admin. A edge monta a
-- resposta campo a campo por cima disto (defesa em profundidade).
--
-- Roster (vw_api_anestesistas) — espelha src/hooks/useRosterAnestesistas.js
-- (laço das linhas 110-121), com UMA diferença deliberada:
--   iguais ao hook: nome preenchido; sem conta de teste (+e2e no e-mail);
--     role normalizado 'anestesiologista' (ROLE_ALIASES de src/utils/userTypes.js
--     + o rótulo 'Anestesiologista') OU apelido no dicionário gravado NA PRÓPRIA
--     conta (uidsComAlias usa a.userId cru); conta secundária
--     (conta_duplicada_de) fora da lista; apelido gravado na secundária vale
--     para a principal.
--   diferença: o hook descarta active=false; a view os mantém com ativo=false,
--     para o uid de casos antigos continuar resolvendo. `?ativos=true` na edge
--     reproduz exatamente o roster do hook.
--
-- Anestesista do caso (vw_api_escala_cirurgica): o texto cru do rodapé traz
-- marcadores que não são nome — '?' (sem anestesista, 305 casos), '//' (46),
-- '???', '' . Texto sem nenhuma letra vira NULL, e sem_anestesista=true anula o
-- nome. sem_anestesista e continuacao (is_continuacao) saem como booleanos.
-- Texto com '+' (dupla, ex. 'A + B') sai como está, com id NULL.
--
-- Grants: só service_role (a edge usa service-role). anon/authenticated não
-- leem — diferente das vw_api_* de 2026-05, que eram GRANT anon/authenticated.
-- security_invoker = true: quem lê é o service_role (bypassa RLS); nenhum outro
-- papel tem GRANT, e o advisor não acusa view SECURITY DEFINER.
--
-- IDEMPOTÊNCIA: transação explícita; DO block com lookup em pg_constraint;
-- CREATE OR REPLACE VIEW; REVOKE/GRANT repetíveis.
--
-- ROLLBACK (manual, nesta ordem, numa transação):
--   BEGIN;
--   DROP VIEW IF EXISTS public.vw_api_escala_cirurgica;
--   DROP VIEW IF EXISTS public.vw_api_anestesistas;
--   -- 1) tirar os escopos novos dos tokens (senão o CHECK antigo falha ao validar)
--   UPDATE public.api_tokens
--      SET scopes = ARRAY(
--            SELECT s FROM unnest(scopes) s
--             WHERE s NOT IN ('read:escala-cirurgica','read:anestesistas',
--                             'read:residentes','read:funcionarias','read:ferias'))
--    WHERE scopes && ARRAY['read:escala-cirurgica','read:anestesistas',
--                          'read:residentes','read:funcionarias','read:ferias']::text[];
--   --    (token que ficar com scopes = '{}' cai no fallback legacy de 3 read na
--   --     edge — revogar antes com revoked_at = now() se não for o desejado)
--   -- 2) reaplicar o CHECK de 6 escopos de 20260513140000_api_token_write_scopes.sql
--   COMMIT;
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- (a) Escopos: 6 atuais + 5 novos
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname  = 'api_tokens_scopes_subset_check'
       AND conrelid = 'public.api_tokens'::regclass
  ) THEN
    ALTER TABLE public.api_tokens
      DROP CONSTRAINT api_tokens_scopes_subset_check;
  END IF;

  ALTER TABLE public.api_tokens
    ADD CONSTRAINT api_tokens_scopes_subset_check
    CHECK (
      scopes IS NULL
      OR scopes <@ ARRAY[
          'read:docs',
          'read:planos-acao',
          'read:comunicados',
          'write:docs',
          'write:planos-acao',
          'write:comunicados',
          'read:escala-cirurgica',
          'read:anestesistas',
          'read:residentes',
          'read:funcionarias',
          'read:ferias'
        ]::text[]
    );
END
$$;

COMMENT ON COLUMN public.api_tokens.scopes IS
  'Lista granular de scopes autorizados. Subset de '
  '[''read:docs'',''read:planos-acao'',''read:comunicados'','
  '''write:docs'',''write:planos-acao'',''write:comunicados'','
  '''read:escala-cirurgica'',''read:anestesistas'',''read:residentes'','
  '''read:funcionarias'',''read:ferias'']. '
  'BACK-COMPAT: coluna legacy `scope` é mantida; scope=''read'' ≡ os 3 read legacy. '
  'Escopos novos (nov/2026) são opt-in explícito na criação do token.';

-- ─────────────────────────────────────────────────────────────────────────────
-- (b1) vw_api_escala_cirurgica — um caso publicado por linha
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.vw_api_escala_cirurgica
WITH (security_invoker = true) AS
SELECT
  e.data                                                   AS data,
  e.hospital                                               AS hospital,
  c.turno                                                  AS turno,
  c.id                                                     AS caso_id,
  c.sala                                                   AS sala,
  c.ordem                                                  AS ordem,
  c.hora                                                   AS hora,
  c.termino_previsto                                       AS termino_previsto,
  c.tempo_estimado                                         AS tempo_estimado,
  COALESCE(NULLIF(btrim(c.cirurgiao_display), ''), NULLIF(btrim(c.cirurgiao), ''))
                                                           AS cirurgiao_nome,
  -- uid canônico: conta secundária resolve para a principal
  CASE
    WHEN COALESCE(c.sem_anestesista, false) THEN NULL
    ELSE COALESCE(pa.conta_duplicada_de, c.anestesista_user_id)
  END                                                      AS anestesista_id,
  CASE
    WHEN COALESCE(c.sem_anestesista, false) THEN NULL
    ELSE COALESCE(
      pa_principal.nome,
      pa.nome,
      CASE WHEN btrim(c.anestesista) ~ '[[:alpha:]]' THEN btrim(c.anestesista) END
    )
  END                                                      AS anestesista_nome,
  COALESCE(pr.conta_duplicada_de, c.residente_user_id)     AS residente_id,
  COALESCE(
    pr_principal.nome,
    pr.nome,
    CASE WHEN btrim(c.residente) ~ '[[:alpha:]]' THEN btrim(c.residente) END
  )                                                        AS residente_nome,
  c.tipo                                                   AS tipo,
  c.status_cirurgia                                        AS status_cirurgia,
  c.inicio_real                                            AS inicio_real,
  c.termino_real                                           AS termino_real,
  COALESCE(c.sem_anestesista, false)                       AS sem_anestesista,
  COALESCE(c.is_continuacao, false)                        AS continuacao
FROM public.escala_cirurgica_caso c
JOIN public.escala_cirurgica e
  ON e.id = c.escala_id
LEFT JOIN public.profiles pa           ON pa.id = c.anestesista_user_id
LEFT JOIN public.profiles pa_principal ON pa_principal.id = pa.conta_duplicada_de
LEFT JOIN public.profiles pr           ON pr.id = c.residente_user_id
LEFT JOIN public.profiles pr_principal ON pr_principal.id = pr.conta_duplicada_de
WHERE e.status = 'publicada'
  AND e.hospital IN ('unimed', 'hro', 'materno')
  -- publicação por turno: se o turno consta em publicacao_turnos, tem de estar
  -- publicado; escalas antigas (sem o jsonb) valem pelo status da escala.
  AND (
    e.publicacao_turnos IS NULL
    OR c.turno IS NULL
    OR NOT (e.publicacao_turnos ? c.turno)
    OR e.publicacao_turnos -> c.turno ->> 'status' = 'publicada'
  );

COMMENT ON VIEW public.vw_api_escala_cirurgica IS
  'API externa (api-v1 /v1/escala-cirurgica). Whitelist: casos de escala publicada '
  'sem dado de paciente (iniciais, idade, procedimento, convênio, gravidade) e sem '
  'observações/linha_overrides/source_image_path. Só service_role lê.';

REVOKE ALL ON public.vw_api_escala_cirurgica FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vw_api_escala_cirurgica TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- (b2) vw_api_anestesistas — roster + apelidos da escala
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.vw_api_anestesistas
WITH (security_invoker = true) AS
WITH alias_canonico AS (
  SELECT
    COALESCE(p.conta_duplicada_de, a.user_id) AS user_id,
    btrim(a.apelido)                          AS apelido
  FROM public.escala_anestesista_alias a
  LEFT JOIN public.profiles p ON p.id = a.user_id
  WHERE NULLIF(btrim(a.apelido), '') IS NOT NULL
)
SELECT
  p.id                        AS id,
  p.nome                      AS nome,
  COALESCE(p.active, true)    AS ativo,
  COALESCE(
    (SELECT array_agg(DISTINCT ac.apelido ORDER BY ac.apelido)
       FROM alias_canonico ac
      WHERE ac.user_id = p.id),
    ARRAY[]::text[]
  )                           AS apelidos
FROM public.profiles p
WHERE NULLIF(btrim(p.nome), '') IS NOT NULL
  AND p.conta_duplicada_de IS NULL
  AND COALESCE(p.email, '') !~* '\+e2e'
  AND (
    lower(btrim(COALESCE(p.role, ''))) IN (
      'anestesiologista', 'anestesista', 'médico anestesista', 'medico anestesista',
      'medico', 'médico', 'medico-staff'
    )
    -- como o hook: o apelido conta pela conta em que foi GRAVADO (uid cru)
    OR EXISTS (
      SELECT 1 FROM public.escala_anestesista_alias a
       WHERE a.user_id = p.id AND NULLIF(btrim(a.apelido), '') IS NOT NULL
    )
  );

COMMENT ON VIEW public.vw_api_anestesistas IS
  'API externa (api-v1 /v1/anestesistas). Regra de useRosterAnestesistas.js, mas mantém '
  'inativos com ativo=false (?ativos=true reproduz o roster do hook). '
  'Whitelist: id (uid), nome, ativo, apelidos. Sem e-mail/permissions/last_access/is_admin. '
  'Só service_role lê.';

REVOKE ALL ON public.vw_api_anestesistas FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vw_api_anestesistas TO service_role;

COMMIT;

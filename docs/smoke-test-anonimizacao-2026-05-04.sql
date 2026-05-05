-- ============================================================================
-- SMOKE TEST — rpc_anonimizar_incidente v2 (LGPD Art. 12)
-- Cole no SQL Editor: https://supabase.com/dashboard/project/vjzrahruvjffyyqyhjny/sql/new
-- Execute como UM bloco (Run All). Marker único: 'SMOKE_TEST_2026_05_04'.
-- ============================================================================

-- PASSO 1 — Criar incidente teste com PII identificável em TODOS os campos
INSERT INTO public.incidentes (
  tipo, source, status,
  notificante,
  incidente_data,
  impacto,
  contexto_anest,
  gestao_interna,
  admin_data
) VALUES (
  'incidente', 'app', 'pendente',
  '{"tipoIdentificacao":"identificado","nome":"SMOKE_TEST_2026_05_04 Dr. Teste","email":"teste@anest.app","funcao":"anestesiologista","setor":"centro_cirurgico","ramal":"1234"}'::jsonb,
  '{"tipo":"medicacao","subtipo":"erro_dose","dataOcorrencia":"2026-05-04","local":"sala_cirurgia_3","descricao":"PII: Paciente Joao da Silva, prontuario 12345, recebeu dose dupla de fentanil. Cirurgiao Dr. Pedro Souza."}'::jsonb,
  '{"danoAoPaciente":"moderado","acoesTomadas":"Atendimento por Dra. Maria Santos","sugestoesMelhoria":"Dupla checagem com enfermeira Ana"}'::jsonb,
  '{"faseProcedimento":"intra","tipoAnestesia":"geral","observacoes":"Paciente estavel apos 30min, sem sequelas"}'::jsonb,
  '{"parecer":"Em analise pelo Comite","feedbackAoRelator":"Recebido em 04/05/2026","notasInternas":"Coordenador Dr. Wagner Guime notificado","rca":"Pendente"}'::jsonb,
  '{"parecer":"Pendente reuniao 10/05"}'::jsonb
)
RETURNING
  '== ANTES da anonimizacao ==' AS step,
  id, protocolo, tracking_code,
  notificante->>'nome' AS nome,
  notificante->>'email' AS email,
  incidente_data->>'descricao' AS descricao_inc,
  impacto->>'danoAoPaciente' AS dano,
  gestao_interna->>'parecer' AS parecer_gestao,
  admin_data->>'parecer' AS parecer_admin,
  anonymized_at;
-- Esperado: 1 linha com TODOS os campos preenchidos (PII visivel), anonymized_at = NULL

-- PASSO 2 — Anonimizar usando o ID inserido
DO $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id
  FROM public.incidentes
  WHERE notificante->>'nome' LIKE 'SMOKE_TEST_2026_05_04%'
  ORDER BY created_at DESC LIMIT 1;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Smoke test incidente nao encontrado';
  END IF;

  PERFORM public.rpc_anonimizar_incidente(v_id);
  RAISE NOTICE 'Anonimizado: %', v_id;
END $$;

-- PASSO 3 — Conferir que TUDO foi limpo
SELECT
  '== DEPOIS da anonimizacao ==' AS step,
  id, protocolo, tracking_code,
  notificante->>'tipoIdentificacao' AS tipo_id_apos,
  notificante->>'nome' AS nome_apos,
  notificante->>'email' AS email_apos,
  incidente_data->>'tipo' AS tipo_inc_preservado,
  incidente_data->>'descricao' AS descricao_apos,
  impacto->>'danoAoPaciente' AS dano_apos,
  impacto->>'acoesTomadas' AS acoes_apos,
  contexto_anest->>'observacoes' AS obs_apos,
  gestao_interna->>'parecer' AS parecer_gestao_apos,
  gestao_interna->>'feedbackAoRelator' AS feedback_apos,
  gestao_interna->>'rca' AS rca_apos,
  admin_data->>'parecer' AS parecer_admin_apos,
  attachments,
  anonymized_at IS NOT NULL AS anonimizado,
  updated_by_name,
  user_id
FROM public.incidentes
WHERE protocolo = (
  SELECT protocolo FROM public.incidentes
  WHERE anonymized_at IS NOT NULL
    AND anonymized_at >= now() - interval '5 minutes'
  ORDER BY anonymized_at DESC LIMIT 1
);
-- Esperado:
--   tipo_id_apos = 'anonimo'
--   nome_apos = NULL (chave 'nome' removida do JSON)
--   email_apos = NULL
--   tipo_inc_preservado = 'medicacao' (taxonomia mantida)
--   descricao_apos = '' (string vazia, PII removida)
--   dano_apos = '' (string vazia)
--   acoes_apos = ''
--   obs_apos = ''
--   parecer_gestao_apos = ''
--   feedback_apos = ''
--   rca_apos = ''
--   parecer_admin_apos = ''
--   attachments = []
--   anonimizado = true
--   updated_by_name = 'Anonimização LGPD Art. 12'
--   user_id = NULL

-- PASSO 4 — Conferir rpc_fetch_by_tracking_code retorna [ANONIMIZADO]
SELECT
  '== Fetch publico apos anonimizacao ==' AS step,
  public.rpc_fetch_by_tracking_code(
    (SELECT tracking_code FROM public.incidentes
     WHERE anonymized_at IS NOT NULL
       AND anonymized_at >= now() - interval '5 minutes'
     ORDER BY anonymized_at DESC LIMIT 1)
  ) AS resultado_publico;
-- Esperado: JSON com incidente_resumo='[ANONIMIZADO]', incidente_tipo='[ANONIMIZADO]',
--           feedback_ao_relator=null, parecer=null

-- PASSO 5 — Cleanup: deletar o registro de teste para nao poluir o DB
-- (descomente apenas se quiser remover; o registro anonimizado e inocuo)
-- DELETE FROM public.incidentes
-- WHERE anonymized_at IS NOT NULL
--   AND updated_by_name = 'Anonimização LGPD Art. 12'
--   AND created_at >= now() - interval '10 minutes';

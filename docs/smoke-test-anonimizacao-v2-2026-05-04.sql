-- ============================================================================
-- SMOKE TEST v2 — rpc_anonimizar_incidente (LGPD Art. 12)
-- Versão consolidada: retorna TODOS os checks numa única tabela final.
-- Cole no SQL Editor e clique Run.
-- ============================================================================

-- PASSO 1: Limpa smoke tests anteriores, cria 1 novo, anoniza
DO $$
DECLARE v_id uuid;
BEGIN
  -- Limpar smoke tests anteriores
  DELETE FROM public.incidentes WHERE notificante->>'nome' LIKE 'SMOKE_V2%';

  -- Criar incidente teste com PII em TODOS os campos
  INSERT INTO public.incidentes (
    tipo, source, status,
    notificante, incidente_data, impacto, contexto_anest, gestao_interna, admin_data
  ) VALUES (
    'incidente', 'app', 'pendente',
    '{"tipoIdentificacao":"identificado","nome":"SMOKE_V2 Dr. Teste","email":"teste@anest.app","funcao":"anestesiologista","setor":"centro_cirurgico","ramal":"1234"}'::jsonb,
    '{"tipo":"medicacao","subtipo":"erro_dose","dataOcorrencia":"2026-05-04","local":"sala_cirurgia_3","descricao":"PII: Paciente Joao da Silva, prontuario 12345, dose dupla fentanil"}'::jsonb,
    '{"danoAoPaciente":"moderado","acoesTomadas":"Atendimento Dra. Maria","sugestoesMelhoria":"Dupla checagem"}'::jsonb,
    '{"faseProcedimento":"intra","tipoAnestesia":"geral","observacoes":"Paciente estavel"}'::jsonb,
    '{"parecer":"Em analise","feedbackAoRelator":"Recebido","notasInternas":"Coordenador notificado","rca":"Pendente"}'::jsonb,
    '{"parecer":"Pendente reuniao"}'::jsonb
  )
  RETURNING id INTO v_id;

  -- Anonimizar
  PERFORM public.rpc_anonimizar_incidente(v_id);
END $$;

-- PASSO 2: Tabela unificada com 17 checks
WITH alvo AS (
  SELECT * FROM public.incidentes
  WHERE anonymized_at >= now() - interval '2 minutes'
  ORDER BY anonymized_at DESC LIMIT 1
),
checks AS (
  SELECT 1 AS ord, 'Notificante anonimizado (sem nome)' AS check_name,
    COALESCE(notificante->>'nome', '<NULL>') AS valor_atual,
    '<NULL>' AS esperado,
    (notificante->>'nome' IS NULL) AS pass
  FROM alvo
  UNION ALL SELECT 2, 'Notificante anonimizado (sem email)',
    COALESCE(notificante->>'email', '<NULL>'), '<NULL>',
    (notificante->>'email' IS NULL) FROM alvo
  UNION ALL SELECT 3, 'tipoIdentificacao = anonimo',
    notificante->>'tipoIdentificacao', 'anonimo',
    (notificante->>'tipoIdentificacao' = 'anonimo') FROM alvo
  UNION ALL SELECT 4, 'incidente_data.descricao limpo',
    COALESCE(incidente_data->>'descricao', '<NULL>'), '"" (string vazia)',
    (incidente_data->>'descricao' = '') FROM alvo
  UNION ALL SELECT 5, 'incidente_data.tipo PRESERVADO (taxonomia)',
    COALESCE(incidente_data->>'tipo', '<NULL>'), 'medicacao',
    (incidente_data->>'tipo' = 'medicacao') FROM alvo
  UNION ALL SELECT 6, 'impacto.danoAoPaciente limpo',
    COALESCE(impacto->>'danoAoPaciente', '<NULL>'), '""',
    (impacto->>'danoAoPaciente' = '') FROM alvo
  UNION ALL SELECT 7, 'impacto.acoesTomadas limpo',
    COALESCE(impacto->>'acoesTomadas', '<NULL>'), '""',
    (impacto->>'acoesTomadas' = '') FROM alvo
  UNION ALL SELECT 8, 'contexto_anest.observacoes limpo',
    COALESCE(contexto_anest->>'observacoes', '<NULL>'), '""',
    (contexto_anest->>'observacoes' = '') FROM alvo
  UNION ALL SELECT 9, 'gestao_interna.parecer limpo',
    COALESCE(gestao_interna->>'parecer', '<NULL>'), '""',
    (gestao_interna->>'parecer' = '') FROM alvo
  UNION ALL SELECT 10, 'gestao_interna.feedbackAoRelator limpo',
    COALESCE(gestao_interna->>'feedbackAoRelator', '<NULL>'), '""',
    (gestao_interna->>'feedbackAoRelator' = '') FROM alvo
  UNION ALL SELECT 11, 'gestao_interna.notasInternas limpo',
    COALESCE(gestao_interna->>'notasInternas', '<NULL>'), '""',
    (gestao_interna->>'notasInternas' = '') FROM alvo
  UNION ALL SELECT 12, 'gestao_interna.rca limpo',
    COALESCE(gestao_interna->>'rca', '<NULL>'), '""',
    (gestao_interna->>'rca' = '') FROM alvo
  UNION ALL SELECT 13, 'admin_data.parecer limpo',
    COALESCE(admin_data->>'parecer', '<NULL>'), '""',
    (admin_data->>'parecer' = '') FROM alvo
  UNION ALL SELECT 14, 'attachments = []',
    attachments::text, '[]',
    (attachments::text = '[]') FROM alvo
  UNION ALL SELECT 15, 'anonymized_at preenchido',
    anonymized_at::text, 'timestamp recente',
    (anonymized_at IS NOT NULL) FROM alvo
  UNION ALL SELECT 16, 'updated_by_name correto',
    COALESCE(updated_by_name, '<NULL>'), 'Anonimização LGPD Art. 12',
    (updated_by_name = 'Anonimização LGPD Art. 12') FROM alvo
  UNION ALL SELECT 17, 'user_id = NULL',
    COALESCE(user_id, '<NULL>'), '<NULL>',
    (user_id IS NULL) FROM alvo
)
SELECT
  ord AS "#",
  CASE WHEN pass THEN '✅' ELSE '❌' END AS resultado,
  check_name AS "verificacao",
  valor_atual AS "obtido",
  esperado AS "esperado"
FROM checks
ORDER BY ord;
-- Esperado: 17/17 com ✅

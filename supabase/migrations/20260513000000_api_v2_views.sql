-- =============================================================================
-- 20260513000000_api_v2_views.sql — Sprint 15b / API v2 views
--
-- Expande a API pública read-only (edge function api-v1, criada na Sprint 14c)
-- com dois novos contratos READ-ONLY:
--
--   1. vw_api_planos_acao       — planos de ação PDCA publicáveis
--   2. vw_api_comunicados       — comunicados oficiais publicados
--
-- Esta migration NÃO mexe em:
--   • is_valid_api_token(text)     — já é genérica (Sprint 14c)
--   • api_tokens                   — tabela já existe
--   • documento_api_rate_limit     — reusado pelo edge para todos endpoints
--
-- PATTERN (espelha vw_api_documentos da Sprint 14c):
--   • CREATE OR REPLACE VIEW (idempotente)
--   • Whitelist EXPLÍCITA de colunas (nada de SELECT *)
--   • Filtros LGPD inline no WHERE (deleted/status público)
--   • SECURITY_INVOKER off (default) — gate é via Edge api-v1
--   • GRANT SELECT TO anon, authenticated
--
-- SECURITY MODEL (igual à Sprint 14c):
--   • View executa com privilégios do owner (postgres), portanto NÃO filtra
--     por RLS da tabela base. Gate de acesso é em CAMADA DE APLICAÇÃO: o
--     edge function valida o Bearer token (via is_valid_api_token) antes
--     de consultar a view.
--   • Mitigação dupla: (a) whitelist sem PII; (b) stripPii() no edge.
--
-- LGPD:
--   • Excluí TODOS os campos com IDs/nomes de pessoas (autor_id, autor_nome,
--     created_by, created_by_name, responsavel_id, responsavel_nome,
--     destinatarios, aprovado_por).
--   • Excluí campos free-text que podem conter PII de pacientes/colegas
--     (descricao, plan_*, do_*, check_*, act_*, conteudo, anexos).
--   • Excluí FKs lógicas a entidades sensíveis (origem_id pode apontar
--     a incidente/auditoria com PII).
--   • Excluí jsonb livres (historico, evidencias, acoes_requeridas,
--     aprovado_por) — payloads não-estruturados são PII-prone.
--   • Não há coluna `deleted_at` em nenhuma das tabelas; soft-delete usa
--     status='cancelado' (planos_acao) e arquivado=true (comunicados),
--     filtrados no WHERE.
-- =============================================================================

-- ──────────────────────────────────────────────────────────────────────────
-- 1. View vw_api_planos_acao — contrato API v2 (Sprint 15b)
--
-- COLUNAS DA TABELA BASE (public.planos_acao — migrations 010 + 016 + 020):
--   id, titulo, descricao, tipo_origem, origem_id, origem_descricao,
--   status, fase_pdca, responsavel_id, responsavel_nome, prazo, prioridade,
--   eficacia, evidencias (jsonb), historico (jsonb), tags (text[]),
--   created_by, created_by_name, created_at, updated_at,
--   plan_analise, plan_acoes, do_notas, check_resultados, act_padronizacao,
--   plan_o_que, plan_porque, plan_onde, plan_como, plan_quanto,
--   plan_meta, plan_indicador, do_percentual, do_dificuldades,
--   check_meta_atingida, check_analise, act_decisao, act_licoes_aprendidas.
--
-- COLUNAS EXPOSED (whitelist):
--   id, titulo, tipo_origem, status, fase_pdca, prazo, prioridade,
--   eficacia, tags, created_at, updated_at.
--
-- COLUNAS EXCLUDED (e por quê):
--   • descricao                        — free-text, pode conter PII/nomes
--   • origem_id, origem_descricao      — FK lógica a incidente/auditoria
--                                        (entidades sensíveis) + free-text
--   • responsavel_id, responsavel_nome — PII de responsável (LGPD)
--   • created_by, created_by_name      — PII de autor (LGPD)
--   • evidencias (jsonb)               — payload livre, pode anexar URLs/PII
--   • historico (jsonb)                — log interno de alterações (PII por
--                                        actor + comentários free-text)
--   • plan_analise, plan_acoes,
--     do_notas, check_resultados,
--     act_padronizacao,
--     plan_o_que, plan_porque,
--     plan_onde, plan_como, plan_quanto,
--     plan_meta, plan_indicador,
--     do_percentual, do_dificuldades,
--     check_meta_atingida, check_analise,
--     act_decisao,
--     act_licoes_aprendidas             — free-text PDCA/5W2H; risco alto de
--                                        conter nomes, contextos clínicos,
--                                        identificadores de paciente. EXCLUI.
--
-- FILTROS APLICADOS:
--   • status NOT IN ('cancelado')      — não expõe planos cancelados (lixo)
--     (não excluo 'planejamento' porque pode ser status válido para listagem;
--      'concluido' é o estado mais comum a ser exposto externamente)
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.vw_api_planos_acao AS
SELECT
  p.id,
  p.titulo,
  p.tipo_origem,
  p.status,
  p.fase_pdca,
  p.prazo,
  p.prioridade,
  p.eficacia,
  p.tags,
  p.created_at,
  p.updated_at
FROM public.planos_acao p
WHERE p.status <> 'cancelado';

COMMENT ON VIEW public.vw_api_planos_acao IS
  'Sprint 15b / API v2. Contrato READ-ONLY de planos PDCA para a edge api-v1. '
  'Whitelist explícita de 11 colunas — zero PII, zero free-text. '
  'Exclui: descricao, origem_*, responsavel_*, created_by_*, evidencias, '
  'historico, todos os campos PDCA/5W2H free-text. '
  'Filtros: status <> cancelado. SECURITY_INVOKER off — gate é via Edge.';

GRANT SELECT ON public.vw_api_planos_acao TO anon, authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- 2. View vw_api_comunicados — contrato API v2 (Sprint 15b)
--
-- COLUNAS DA TABELA BASE (public.comunicados — migration 019 + 20260221
-- adiciona rop_relacionada):
--   id, tipo, titulo, conteudo, status, leitura_obrigatoria, destinatarios,
--   rop_area, acoes_requeridas (jsonb), link, data_evento, anexos (jsonb),
--   prazo_confirmacao, data_validade, aprovado_por (jsonb), autor_id,
--   autor_nome, arquivado, created_at, updated_at, rop_relacionada (text[]).
--
-- COLUNAS EXPOSED (whitelist):
--   id, tipo, titulo, status, leitura_obrigatoria, rop_area, rop_relacionada,
--   link, data_evento, prazo_confirmacao, data_validade, created_at, updated_at.
--
-- COLUNAS EXCLUDED (e por quê):
--   • conteudo                        — corpo livre do comunicado (markdown/
--                                       HTML), pode conter nomes de colegas/
--                                       pacientes, instruções internas. EXCLUI.
--   • destinatarios (text[])          — lista de userIds (PII direta - LGPD)
--   • acoes_requeridas (jsonb)        — payload livre, pode citar pessoas
--   • anexos (jsonb)                  — URLs/paths de storage (vaza paths)
--   • aprovado_por (jsonb)            — PII de aprovadores (UID + nome + ts)
--   • autor_id, autor_nome            — PII de autor (LGPD)
--   • arquivado                       — flag interna; filtrada no WHERE
--
-- FILTROS APLICADOS:
--   • status = 'publicado'            — só expõe comunicados publicados
--                                       (exclui 'rascunho' e 'aprovado'/
--                                       em revisão).
--   • arquivado = false               — não expõe comunicados arquivados
--   • data_validade IS NULL
--     OR data_validade > now()        — não expõe comunicados expirados
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.vw_api_comunicados AS
SELECT
  c.id,
  c.tipo,
  c.titulo,
  c.status,
  c.leitura_obrigatoria,
  c.rop_area,
  c.rop_relacionada,
  c.link,
  c.data_evento,
  c.prazo_confirmacao,
  c.data_validade,
  c.created_at,
  c.updated_at
FROM public.comunicados c
WHERE c.status = 'publicado'
  AND c.arquivado = false
  AND (c.data_validade IS NULL OR c.data_validade > now());

COMMENT ON VIEW public.vw_api_comunicados IS
  'Sprint 15b / API v2. Contrato READ-ONLY de comunicados para a edge api-v1. '
  'Whitelist explícita de 13 colunas — zero PII, zero free-text, zero anexos. '
  'Exclui: conteudo, destinatarios, acoes_requeridas, anexos, aprovado_por, '
  'autor_id, autor_nome. '
  'Filtros: status=publicado, arquivado=false, data_validade futura/NULL. '
  'SECURITY_INVOKER off — gate é via Edge api-v1 + is_valid_api_token().';

GRANT SELECT ON public.vw_api_comunicados TO anon, authenticated;

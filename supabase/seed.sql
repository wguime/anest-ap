-- ============================================================================
-- supabase/seed.sql — Sprint 21 Wave 2.1 (DEV mock data)
--
-- Dados representativos para desenvolvimento, screenshot tests e onboarding.
-- IDEMPOTENTE: usa ON CONFLICT DO NOTHING. Pode rodar várias vezes sem efeito
-- colateral.
--
-- NÃO rode em produção. Os UIDs (seed-admin-001, seed-staff-001..003) são
-- desenvolvedores fictícios — combinam com `scripts/seed-firebase.mjs` que
-- cria as contas Firebase Auth correspondentes.
--
-- Conta:
--   10 documentos     (mix categorias/status/validades)
--   5 incidentes      (2 anônimos + 3 identificados)
--   3 planos_acao     (planejamento/execucao/concluido) vinculados a incidentes
--   5 comunicados     (Geral/Urgente/Importante/Evento/Informativo)
--   2 auditoria_execucoes  (auditorias internas)
--   1 plano_acao adicional (nao_conformidade → planos_acao com tipo_origem)
--
-- Tabela `nao_conformidades` não existe no schema atual: representamos via
-- plano_acao com `tipo_origem='nao_conformidade'`.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Admin user no admin_users (necessário para RLS/permissão admin)
-- ----------------------------------------------------------------------------

INSERT INTO admin_users (firebase_uid, email, role) VALUES
  ('seed-admin-001', 'admin@seed.local', 'admin')
ON CONFLICT (firebase_uid) DO NOTHING;


-- ----------------------------------------------------------------------------
-- 1. Documentos (10)
-- ----------------------------------------------------------------------------
-- CHECK constraints:
--   categoria: etica, comites, auditorias, relatorios, biblioteca,
--              financeiro, medicamentos, infeccoes, desastres
--   status:    rascunho, pendente, ativo, arquivado, rejeitado, revisao_pendente
--
-- Notas:
--   - `created_by` = 'seed-admin-001' (UID do dev seed, NUNCA 'admin'/'system').
--   - `storage_provider` = 'supabase' (coluna adicionada pela migration de
--     Sprint 21 Wave 1.1). Se sua DB ainda não tem essa coluna, comente os
--     campos `storage_provider` abaixo.

INSERT INTO documentos (
  id, codigo, titulo, descricao, tipo, categoria, subcategoria,
  status, versao_atual, setor_nome, responsavel, responsavel_revisao,
  arquivo_url, arquivo_nome, arquivo_tamanho, storage_path, storage_provider,
  proxima_revisao, intervalo_revisao_dias, rop_area, qmentum_weight,
  tags, observacoes,
  created_by, created_by_name, created_by_email
) VALUES
  ('doc-seed-001', 'POP-SEED-001', 'POP — Checklist Cirurgia Segura',
   'Procedimento operacional padrão de checklist pré-cirúrgico (modelo seed)',
   'pop', 'etica', 'pop',
   'ativo', 1, 'Equipe Anest', 'Dr. Seed Admin', 'Dr. Seed Admin',
   'about:blank', 'pop_checklist_cirurgia_segura.pdf', 124000,
   'documentos/seed/pop_checklist.pdf', 'supabase',
   now() + interval '180 days', 365, 'etica', 1.2,
   ARRAY['pop','cirurgia','seguranca'], 'Documento seed para DEV',
   'seed-admin-001', 'Admin Seed', 'admin@seed.local'),

  ('doc-seed-002', 'POP-SEED-002', 'POP — Anti-séptico Cirúrgico',
   'Padronização de uso de anti-séptico pré-operatório (seed)',
   'pop', 'infeccoes', 'pop',
   'ativo', 1, 'CCIH', 'Dr. Seed Admin', 'Dr. Seed Admin',
   'about:blank', 'pop_antiseptico.pdf', 98000,
   'documentos/seed/pop_antiseptico.pdf', 'supabase',
   now() - interval '30 days', 365, 'infeccoes', 1.5,
   ARRAY['pop','infeccao','antisseptico'], 'Documento seed (revisão vencida intencional)',
   'seed-admin-001', 'Admin Seed', 'admin@seed.local'),

  ('doc-seed-003', 'POP-SEED-003', 'POP — Reposição Volêmica',
   'Protocolo de reposição volêmica intraoperatória (seed)',
   'pop', 'medicamentos', 'pop',
   'rascunho', 1, 'Equipe Anest', 'Dr. Seed Staff 1', null,
   null, null, null, null, 'supabase',
   null, 365, 'medicamentos', 1.0,
   ARRAY['pop','volemia','medicamentos'], 'Rascunho em elaboração',
   'seed-staff-001', 'Staff Seed 1', 'staff1@seed.local'),

  ('doc-seed-004', 'MAN-SEED-001', 'Manual de Anestesia Ambulatorial',
   'Manual técnico de procedimentos ambulatoriais (seed)',
   'manual', 'biblioteca', 'manual',
   'ativo', 2, 'Comitê Científico', 'Dr. Seed Admin', 'Dr. Seed Staff 2',
   'about:blank', 'manual_anest_ambulatorial_v2.pdf', 1240000,
   'documentos/seed/manual_ambulatorial.pdf', 'supabase',
   now() + interval '90 days', 730, 'etica', 0.8,
   ARRAY['manual','ambulatorial'], 'Versão 2 (seed)',
   'seed-admin-001', 'Admin Seed', 'admin@seed.local'),

  ('doc-seed-005', 'MAN-SEED-002', 'Manual de Equipamentos',
   'Manual de uso e manutenção de equipamentos (seed)',
   'manual', 'biblioteca', 'manual',
   'arquivado', 3, 'Engenharia Clínica', 'Dr. Seed Staff 2', null,
   'about:blank', 'manual_equipamentos_v3.pdf', 880000,
   'documentos/seed/manual_equipamentos.pdf', 'supabase',
   null, 730, 'etica', 0.8,
   ARRAY['manual','equipamentos','arquivado'], 'Versão arquivada (substituída por outro manual)',
   'seed-admin-001', 'Admin Seed', 'admin@seed.local'),

  ('doc-seed-006', 'PRO-SEED-001', 'Protocolo Sepse Perioperatória',
   'Protocolo institucional de sepse no perioperatório (seed)',
   'protocolo', 'infeccoes', 'protocolo',
   'ativo', 1, 'CCIH', 'Dr. Seed Admin', 'Dr. Seed Admin',
   'about:blank', 'protocolo_sepse.pdf', 220000,
   'documentos/seed/protocolo_sepse.pdf', 'supabase',
   now() + interval '60 days', 365, 'infeccoes', 1.5,
   ARRAY['protocolo','sepse','infeccao'], null,
   'seed-admin-001', 'Admin Seed', 'admin@seed.local'),

  ('doc-seed-007', 'PRO-SEED-002', 'Protocolo Desastre Externo',
   'Plano de contingência para desastres externos com vítimas em massa (seed)',
   'protocolo', 'desastres', 'protocolo',
   'revisao_pendente', 1, 'Direção Técnica', 'Dr. Seed Admin', 'Dr. Seed Staff 3',
   'about:blank', 'protocolo_desastre_externo.pdf', 540000,
   'documentos/seed/protocolo_desastre.pdf', 'supabase',
   now() + interval '15 days', 365, 'etica', 1.0,
   ARRAY['protocolo','desastre','contingencia'], 'Em revisão pelo comitê',
   'seed-admin-001', 'Admin Seed', 'admin@seed.local'),

  ('doc-seed-008', 'COM-SEED-001', 'Comunicado Interno — Atualização SOP',
   'Comunicado de atualização do POP de Cirurgia Segura (seed)',
   'comunicado', 'comites', 'comunicado',
   'ativo', 1, 'Comitê Executivo', 'Dr. Seed Admin', null,
   'about:blank', 'comunicado_atualizacao_pop.pdf', 32000,
   'documentos/seed/comunicado_pop.pdf', 'supabase',
   null, 0, 'etica', 1.0,
   ARRAY['comunicado','interno'], null,
   'seed-admin-001', 'Admin Seed', 'admin@seed.local'),

  ('doc-seed-009', 'COM-SEED-002', 'Comunicado Interno — Recall Medicamento',
   'Comunicado de recall de lote de medicamento (seed)',
   'comunicado', 'medicamentos', 'comunicado',
   'pendente', 1, 'Farmácia', 'Dr. Seed Staff 1', null,
   null, null, null, null, 'supabase',
   null, 0, 'medicamentos', 1.0,
   ARRAY['comunicado','recall','medicamento'], 'Aguardando assinatura do diretor técnico',
   'seed-staff-001', 'Staff Seed 1', 'staff1@seed.local'),

  ('doc-seed-010', 'ATA-SEED-001', 'Ata Reunião Conselho Técnico',
   'Ata da reunião ordinária do conselho técnico (seed)',
   'ata', 'comites', 'ata',
   'ativo', 1, 'Conselho Técnico', 'Dr. Seed Admin', null,
   'about:blank', 'ata_conselho_tecnico.pdf', 76000,
   'documentos/seed/ata_conselho.pdf', 'supabase',
   null, 0, 'etica', 1.0,
   ARRAY['ata','reuniao','conselho'], null,
   'seed-admin-001', 'Admin Seed', 'admin@seed.local')
ON CONFLICT (id) DO NOTHING;


-- ----------------------------------------------------------------------------
-- 2. Incidentes (5) — 2 anônimos + 3 identificados
-- ----------------------------------------------------------------------------
-- Schema: id (uuid), protocolo (text unique gerado por trigger se NULL),
-- tipo CHECK (incidente|denuncia), status CHECK (pendente|em_analise|...).
-- Anonimização: notificante.tipoIdentificacao = 'anonimo' + user_id NULL.

INSERT INTO incidentes (
  id, protocolo, status, source, tipo, user_id,
  notificante, incidente_data, impacto, contexto_anest,
  attachments, created_at, updated_at
) VALUES
  ('11111111-1111-4111-8111-000000000001'::uuid,
   'INC-SEED-0001', 'pendente', 'app', 'incidente', null,
   '{"tipoIdentificacao":"anonimo","categoriaIncidente":"medication"}'::jsonb,
   '{"descricao":"Quase-erro: dose duplicada de propofol identificada antes da administração","categoriaIncidente":"medication","localOcorrencia":"Sala 03","dataOcorrencia":"2026-05-10"}'::jsonb,
   '{"nivelGravidade":"moderado","houveVitima":false}'::jsonb,
   '{"momento":"intraoperatorio","fasePericial":"manutencao"}'::jsonb,
   '[]'::jsonb,
   now() - interval '5 days', now() - interval '5 days'),

  ('11111111-1111-4111-8111-000000000002'::uuid,
   'INC-SEED-0002', 'em_analise', 'formulario_publico', 'incidente', null,
   '{"tipoIdentificacao":"anonimo","categoriaIncidente":"technical"}'::jsonb,
   '{"descricao":"Falha intermitente no monitor multiparamétrico durante procedimento","categoriaIncidente":"technical","localOcorrencia":"Sala 01","dataOcorrencia":"2026-05-08"}'::jsonb,
   '{"nivelGravidade":"baixo","houveVitima":false}'::jsonb,
   '{"momento":"intraoperatorio"}'::jsonb,
   '[]'::jsonb,
   now() - interval '7 days', now() - interval '4 days'),

  ('11111111-1111-4111-8111-000000000003'::uuid,
   'INC-SEED-0003', 'em_andamento', 'app', 'incidente', 'seed-staff-001',
   '{"tipoIdentificacao":"identificado","nome":"Staff Seed 1","cargo":"Anestesiologista","contato":"staff1@seed.local"}'::jsonb,
   '{"descricao":"Comunicação ineficaz durante handoff entre anestesistas","categoriaIncidente":"communication","localOcorrencia":"SRPA","dataOcorrencia":"2026-05-09"}'::jsonb,
   '{"nivelGravidade":"baixo","houveVitima":false}'::jsonb,
   '{"momento":"posoperatorio"}'::jsonb,
   '[]'::jsonb,
   now() - interval '4 days', now() - interval '2 days'),

  ('11111111-1111-4111-8111-000000000004'::uuid,
   'INC-SEED-0004', 'resolvido', 'app', 'incidente', 'seed-staff-002',
   '{"tipoIdentificacao":"identificado","nome":"Staff Seed 2","cargo":"Anestesiologista","contato":"staff2@seed.local"}'::jsonb,
   '{"descricao":"Erro de prescrição interceptado por farmacêutico clínico","categoriaIncidente":"medication","localOcorrencia":"Farmácia","dataOcorrencia":"2026-05-01"}'::jsonb,
   '{"nivelGravidade":"moderado","houveVitima":false}'::jsonb,
   '{"momento":"preoperatorio"}'::jsonb,
   '[]'::jsonb,
   now() - interval '12 days', now() - interval '8 days'),

  ('11111111-1111-4111-8111-000000000005'::uuid,
   'INC-SEED-0005', 'pendente', 'app', 'incidente', 'seed-staff-003',
   '{"tipoIdentificacao":"identificado","nome":"Staff Seed 3","cargo":"Anestesiologista","contato":"staff3@seed.local"}'::jsonb,
   '{"descricao":"Necessidade de reposição urgente de carrinho de via aérea difícil","categoriaIncidente":"technical","localOcorrencia":"Sala 05","dataOcorrencia":"2026-05-12"}'::jsonb,
   '{"nivelGravidade":"alto","houveVitima":false}'::jsonb,
   '{"momento":"intraoperatorio"}'::jsonb,
   '[]'::jsonb,
   now() - interval '1 days', now() - interval '1 days')
ON CONFLICT (id) DO NOTHING;


-- ----------------------------------------------------------------------------
-- 3. Planos de Ação (3 + 1 nao_conformidade)
-- ----------------------------------------------------------------------------
-- status: planejamento, execucao, verificacao, padronizacao, concluido, cancelado
-- fase_pdca: plan, do, check, act
-- tipo_origem: incidente, auditoria, nao_conformidade, manual

INSERT INTO planos_acao (
  id, titulo, descricao, tipo_origem, origem_id, origem_descricao,
  status, fase_pdca, responsavel_id, responsavel_nome, prazo, prioridade,
  tags, created_by, created_by_name, created_at
) VALUES
  ('22222222-2222-4222-8222-000000000001'::uuid,
   'Revisar protocolo de dupla checagem de medicamentos',
   'Incidente INC-SEED-0001 (quase-erro de dose) — implementar dupla checagem em todas as salas',
   'incidente', '11111111-1111-4111-8111-000000000001', 'INC-SEED-0001',
   'planejamento', 'plan',
   'seed-admin-001', 'Admin Seed',
   (now() + interval '30 days')::date, 'alta',
   ARRAY['medicamentos','dupla-checagem'],
   'seed-admin-001', 'Admin Seed', now() - interval '5 days'),

  ('22222222-2222-4222-8222-000000000002'::uuid,
   'Substituir monitores multiparamétricos das salas 01 e 02',
   'Incidente INC-SEED-0002 (falha técnica monitor) — substituição de equipamentos',
   'incidente', '11111111-1111-4111-8111-000000000002', 'INC-SEED-0002',
   'execucao', 'do',
   'seed-staff-002', 'Staff Seed 2',
   (now() + interval '45 days')::date, 'media',
   ARRAY['equipamentos','manutencao'],
   'seed-admin-001', 'Admin Seed', now() - interval '7 days'),

  ('22222222-2222-4222-8222-000000000003'::uuid,
   'Padronizar handoff SBAR entre anestesistas',
   'Incidente INC-SEED-0003 (handoff ineficaz) — treinar equipe em SBAR e validar adesão',
   'incidente', '11111111-1111-4111-8111-000000000003', 'INC-SEED-0003',
   'concluido', 'act',
   'seed-staff-001', 'Staff Seed 1',
   (now() - interval '7 days')::date, 'media',
   ARRAY['comunicacao','sbar','handoff'],
   'seed-admin-001', 'Admin Seed', now() - interval '30 days'),

  ('22222222-2222-4222-8222-000000000004'::uuid,
   'NC — Falta de assinatura digital em ata 09/2026',
   'Não-conformidade identificada em auditoria interna — ausência de assinatura digital qualificada',
   'nao_conformidade', null, 'NC-2026-001',
   'execucao', 'do',
   'seed-admin-001', 'Admin Seed',
   (now() + interval '15 days')::date, 'alta',
   ARRAY['nao-conformidade','assinatura-digital'],
   'seed-admin-001', 'Admin Seed', now() - interval '3 days')
ON CONFLICT (id) DO NOTHING;


-- ----------------------------------------------------------------------------
-- 4. Comunicados (5)
-- ----------------------------------------------------------------------------
-- tipo CHECK (Urgente, Importante, Informativo, Evento, Geral)
-- status CHECK (rascunho, aprovado, publicado)
-- id default 'com-' || substr(uuid::text, 1, 8) — usamos IDs estáveis.

INSERT INTO comunicados (
  id, tipo, titulo, conteudo, status, leitura_obrigatoria, destinatarios,
  rop_area, autor_id, autor_nome, created_at, updated_at
) VALUES
  ('com-seed01', 'Geral',
   'Boas-vindas ao Sistema ANEST',
   'Comunicado geral dando boas-vindas aos novos usuários do sistema (seed DEV).',
   'publicado', false, ARRAY[]::text[],
   'geral', 'seed-admin-001', 'Admin Seed',
   now() - interval '10 days', now() - interval '10 days'),

  ('com-seed02', 'Urgente',
   'Recall — Lote de Propofol XYZ-2026',
   'Recall preventivo do lote XYZ-2026 de Propofol. Suspender uso imediatamente e devolver à Farmácia.',
   'publicado', true, ARRAY[]::text[],
   'medicamentos', 'seed-admin-001', 'Admin Seed',
   now() - interval '2 days', now() - interval '2 days'),

  ('com-seed03', 'Importante',
   'Atualização do POP de Cirurgia Segura',
   'O POP-SEED-001 (Checklist Cirurgia Segura) foi atualizado. Leitura obrigatória para toda a equipe.',
   'aprovado', true, ARRAY[]::text[],
   'etica', 'seed-admin-001', 'Admin Seed',
   now() - interval '3 days', now() - interval '1 days'),

  ('com-seed04', 'Evento',
   'Reunião Mensal do Comitê Executivo',
   'Reunião ordinária do Comitê Executivo agendada para o dia 25.',
   'publicado', false, ARRAY[]::text[],
   'comites', 'seed-admin-001', 'Admin Seed',
   now() - interval '6 days', now() - interval '6 days'),

  ('com-seed05', 'Informativo',
   'Resultado da Auditoria Trimestral',
   'Resultados consolidados da auditoria interna trimestral disponíveis na aba Auditorias.',
   'rascunho', false, ARRAY[]::text[],
   'auditorias', 'seed-staff-002', 'Staff Seed 2',
   now() - interval '1 days', now() - interval '1 days')
ON CONFLICT (id) DO NOTHING;


-- ----------------------------------------------------------------------------
-- 5. Auditoria Execucoes (2)
-- ----------------------------------------------------------------------------
-- Não há CHECK em status; convenções típicas: rascunho, em_andamento, concluida.

INSERT INTO auditoria_execucoes (
  id, template_id, template_tipo, titulo,
  auditor_id, auditor_nome, setor_id, setor_nome,
  data_auditoria, status, respostas, score_conformidade,
  observacoes_gerais, created_by, created_at
) VALUES
  ('33333333-3333-4333-8333-000000000001'::uuid,
   null, 'qmentum_etica',
   'Auditoria Interna — Comitê de Ética (Q2/2026)',
   'seed-admin-001', 'Admin Seed', 'set-anest-001', 'Equipe Anest',
   (now() - interval '14 days')::date, 'concluida',
   '{"item-1":"conforme","item-2":"conforme","item-3":"nao-conforme"}'::jsonb,
   87.5,
   'Auditoria seed concluída com 1 não-conformidade (gerou plano de ação).',
   'seed-admin-001', now() - interval '14 days'),

  ('33333333-3333-4333-8333-000000000002'::uuid,
   null, 'qmentum_medicamentos',
   'Auditoria Interna — Gestão de Medicamentos (Q2/2026)',
   'seed-staff-001', 'Staff Seed 1', 'set-farm-001', 'Farmácia',
   (now() - interval '2 days')::date, 'em_andamento',
   '{"item-1":"conforme"}'::jsonb,
   null,
   'Auditoria seed em andamento.',
   'seed-staff-001', now() - interval '2 days')
ON CONFLICT (id) DO NOTHING;


-- ----------------------------------------------------------------------------
-- 6. Changelog de auditoria mínimo para documentos seed
-- ----------------------------------------------------------------------------
-- Mantém rastro do audit-trail mesmo no seed (compliance Qmentum).

INSERT INTO documento_changelog (
  id, documento_id, action, user_id, user_name, user_email, changes, comment, created_at
) VALUES
  ('44444444-4444-4444-8444-000000000001'::uuid,
   'doc-seed-001', 'created', 'seed-admin-001', 'Admin Seed', 'admin@seed.local',
   '{}'::jsonb, 'Criado via seed DEV', now() - interval '90 days'),
  ('44444444-4444-4444-8444-000000000002'::uuid,
   'doc-seed-002', 'created', 'seed-admin-001', 'Admin Seed', 'admin@seed.local',
   '{}'::jsonb, 'Criado via seed DEV', now() - interval '400 days')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- FIM seed.sql
-- ============================================================================

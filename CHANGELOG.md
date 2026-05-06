# CHANGELOG — ANEST

> Histórico antigo arquivado em `docs/archive/CLAUDE_CONTEXT-root-2026-03-09.md`.
> Para versões futuras: `git log` é a fonte autoritativa.

## v3.72.0 (06/05/2026) — Wave 3 + Onda 1 + Sprint 4/5 + DS reverts

### Wave 3 — Refactor estrutural (Sprint 3)
- W3-1: DocumentSection parametrizado consolidando 9 *Section.jsx (~3448 linhas)
- W3-2: DocumentoDetalhePage 1614 linhas → folder + 5 subcomponentes + 3 modais lazy + 2 hooks
- W3-3: DocumentsContext split em State+Actions com 4 hooks granulares (backward compat)
- W3-4: fetchAllDocuments paginado, RPCs atômicas (rpc_increment_view_count, rpc_add_document_version), índices novos
- W3-5: ApprovalQueue com notify + ReviewCalendar interativo (Marcar revisado / Adiar / Delegar)
- W3-5b: trigger BEFORE INSERT/UPDATE em documento_aprovacoes (4ª camada anti self-approval)

### Onda 1 — DMS validadas (5 flags ON em prod)
- HASH_SIGNATURE: SHA-256 via Web Crypto + bucket documentos-assinados
- WATERMARK: pdf-lib + edge function watermark-pdf
- RETENTION + LEGAL_HOLD: pg_cron archive 03:15 UTC, retention_policies seedada (CFM/Anvisa/LGPD/Qmentum)
- WORM + CONFIDENTIALITY: changelog imutável + ENUM clearance levels
- MULTI_STEP_APPROVAL: state machine + ApprovalWorkflowEditor + pg_cron review notifications

### Sprint 4 / O2-2 — OCR client-side (flag off por default)
- Tesseract WASM por página, fire-and-forget privacy-first
- detectIfScanned heuristic (textContent <50 chars/page)
- useOcrPipeline hook em NewDocumentModal + NewVersionModal
- OcrStatusBadge em DocumentMetadata + DocumentoCard
- fts trigger com weight D para ocr_text

### Sprint 5 / O2-4 — Bulk Import (flag off por default)
- Drag-drop multi-PDF + tabela editável + integração OCR
- Chunks de 5 paralelos via Promise.allSettled, validação MIME/size/dedupe
- BulkImportPage admin-only + botão em GestaoDocumentalPage

### DS reverts (a pedido do usuário)
- W2-3 tokens contraste WCAG revertidos (--border #4E9D5E → #C8E6C9)
- ErrorFallback DS removido, ErrorBoundary inline pre-wave restaurado
- Header BibliotecaPage volta ao estilo pre-W2-1
- Trade-off: contraste de borda 1.27:1 (FAIL WCAG 1.4.11) — auditoria a11y futura

### Fixes pós-deploy
- Biblioteca: subseções (Protocolos/Políticas/etc) clicáveis — state local + onValueChange faltavam desde W2-1
- DOC_LIST_COLUMNS gated por feature flag — colunas ocr_*/bulk_import_id só entram no SELECT quando flags ligadas
- UX header Biblioteca: removido bloco "Documentos / N", busca movida pra header com SearchToggleButton + Collapsible

### Migrations aplicadas em prod 2026-05-06
- 20260505700000_w3_doc_indices_and_rpcs.sql
- 20260505800000_w3_self_approval_block.sql
- 20260506100000_doc_ocr.sql
- 20260507100000_bulk_import.sql

### Stats
- 745 testes verdes (5 skipped pré-existentes)
- Build 17-29s, 19 chunks novos

## v3.71.1 (May 2026) — Removida integração UpToDate
- Removido card UpToDate, página dedicada, context, service, edge function,
  scraper Playwright e workflow GitHub Actions
- Motivo: ToS atualizado da Wolters Kluwer/UpToDate proíbe explicitamente
  uso de "automated software, AI solutions, machine learning, large language
  models" para acessar/processar conteúdo (banner em destaque na home
  autenticada). Risco de suspensão de conta + ação legal por copyright
- Tabela `public.uptodate_topics` com dedup_hash UNIQUE + RLS authenticated read
- Credenciais UpToDate em GitHub Secrets — nunca trafegam pelo client

## v3.70.0 (Mar 2026) — Produção Atual
- Educação: CascadeCreator, TrilhaBanner, cleanup/migration scripts
- Hierarquia completa: Trilha → Treinamento → Módulo → Aula
- Visibility model com junction tables
- 145+ páginas, 76+ calculadoras, 36 services, 12 contexts

## v3.45.0 (09/03/2026) — Fix Anexos Comunicados
- Upload Firebase Storage (blob: URL → permanent URL)
- Timestamp sanitization (empty string → null)

## v3.44.0 (25/02/2026) — Fix Admin Firestore Sync
- Permissões admin sincronizadas Supabase → Firestore
- Centro de Gestão visível para admins promovidos

## v3.43.0 (21/02/2026) — 27 Gaps Centro de Gestão 100% Conformidade
- ErrorBoundary global
- Fix blank page (null safety AssignStaffModal)
- infra_health_history table (retenção 90 dias)
- Real-time subscriptions com retry
- LGPD métricas no ComplianceDashboard
- Audit log com changedBy real

## v3.42.0 (21/02/2026) — Fix Gestão Incidentes
- Persistência gestaoInterna
- Dropdown dinâmico de responsáveis
- Dispatch local após save Supabase

## v3.41.0 (18/02/2026) — Reuniões PDF + Notificações
- PDF Viewer CORS fix
- FileUpload overflow fix
- Notificações WebAuthn (convocação + lembretes)
- DS color migration reuniões

## v3.40.0 (18/02/2026) — Login UX Refresh
- Biometric Auth (Face ID / Touch ID via WebAuthn)
- Keep Me Logged In (Firebase persistence)
- AnimatedBackground redesign

## v3.39.0 (17/02/2026) — Reuniões DS Migration
- Modal.Body overflow fix (DS-level)
- FileUpload DS tokens
- Modal footer pattern (botões fora do scroll)

## v3.38.0 (16/02/2026) — Fix DocumentCard Layout
- Cards altura uniforme (h-full flex flex-col)
- Títulos line-clamp-2
- Metadata mt-auto

## v3.37.0 (15/02/2026) — Fix Dashboard Executivo
- PDF Export funcional
- AdminOnly wrapper
- BottomNav z-index fix

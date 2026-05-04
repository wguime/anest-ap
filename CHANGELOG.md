# CHANGELOG — ANEST

> Histórico antigo arquivado em `docs/archive/CLAUDE_CONTEXT-root-2026-03-09.md`.
> Para versões futuras: `git log` é a fonte autoritativa.

## v3.71.0 (Apr 2026) — Integração UpToDate
- Card UpToDate em Publicações (entre hero "Em destaque" e "Mais publicações")
- Página dedicada: hero HScroll featured (10) + lista paginada PAGE_SIZE=20 (até 50 tópicos)
- Conteúdo embutido no app via DOMPurify (sem links externos clicáveis)
- Coleta semanal via GitHub Actions + Playwright (segunda 07:10 UTC)
- Edge Function `ingest-uptodate` com autenticação HMAC-SHA256
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

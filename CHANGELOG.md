# CHANGELOG — ANEST

> Histórico antigo arquivado em `docs/archive/CLAUDE_CONTEXT-root-2026-03-09.md`.
> Para versões futuras: `git log` é a fonte autoritativa.

## v5.3.0 (19/05/2026) — Sprint 1 Wave 1.8 · Cert PDF Firebase → Supabase private + cleanup pós-1.7

### Highlights
- **LGPD — minimização do PDF cert**: PDF do certificado migrado de Firebase Storage URL pública para **Supabase Storage privado** com **signed URL TTL=300s** gerada por Edge Function autenticada. Fecha o gap deixado pela Wave 1.7 (que minimizou só o lookup `/verificar/:uuid`, mas mantinha o PDF acessível via URL não-assinada).
- **Dual-write + on-demand backfill**: emissão nova faz upload em ambos os storages (Firebase + Supabase); certs históricos são migrados no primeiro download via `getCertificadoSignedUrl`. Cutover sem downtime, rollback safe — Firebase Storage permanece read-only durante 1 semana de soak.
- **lgpdService deletion estendido**: Art. 18 LGPD agora apaga PDFs em ambos os storages (Firebase + Supabase) com policy admin DELETE explícita.
- **Cleanup pós-1.7**: substituído `RichTextSimple` (com 4 `document.execCommand` legados) pelo `RichEditor` do DS (BlockNote 0.51, já em uso em 3 outros modais) — zero dep nova, chunk `rich-editor-core` reutilizado.

### Backend Supabase
- Migration `20260520140000_storage_certificados_bucket.sql`: bucket `certificados` (privado, 5MB max, application/pdf only) + RLS owner-scoped (SELECT/INSERT por `firebase_uid()` no folder) + admin SELECT (`is_admin()`) + service_role write + anti path-traversal (`name not like '%..%'`).
- Migration `20260520150000_storage_certificados_admin_delete.sql` (hotfix pós-audit): policy `storage_cert_admin_delete` (resolve LGPD MED bloqueante — lgpdService usa client anon-key, não service_role) + `storage_cert_owner_delete` (defesa em profundidade).
- Reutiliza helpers `public.firebase_uid()` e `public.is_admin()` de `002_rls.sql`.

### Edge Functions
- `get-cert-download-url/index.ts` (NEW): Bearer JWT HS256 obrigatório, ownership implícito (path = `${jwt.sub}/${certId}.pdf`), regex anti-traversal `[a-zA-Z0-9_-]{1,128}$`, signed URL TTL=300s, CORS pattern do projeto. Retorna 401 missing/invalid_token, 403 forbidden_user_mismatch, 404 not_found, 500 server_error.

### Frontend
- `educacaoService.emitirCertificado`: dual-write Firebase + Supabase com `supabaseMigrated:bool` flag no Firestore. Falha Supabase é não-fatal (cert ainda emite).
- `educacaoService.getCertificadoSignedUrl(certId, userId)` (NEW): backfill on-demand Firebase→Supabase + Edge fn call. AbortController timeout 10s no fetch Firebase.
- `CertificadosPage.jsx`: botão "Baixar" → signed URL via `window.open(url, '_blank', 'noopener,noreferrer')`. Fallback graceful para `downloadCertificate` (Firebase URL antiga) durante soak.
- `AdminConteudoPage.jsx`: `RichTextSimple` (39 linhas, 4 execCommand) → `<RichEditor>` DS. Delta −38 linhas.
- `certificateGenerator.js`: `getCertificatePdfUrl` marcada `@deprecated` com TODO Wave 1.9.

### Audits aplicadas (post-merge ready)
- **lgpd-reviewer**: 1 HIGH (PDF Firebase ainda público durante soak — aceitável, era assim antes; TODO Wave 1.9) + 3 MED (console.warn vaza paths, audit trail download). MEDs endereçados (DEV-wrap warns), audit trail TODO Wave 1.9.
- **security-reviewer**: 4 MED — lgpdService anon-key delete (BLOQUEANTE LGPD — endereçado via nova policy admin DELETE); CORS `*` em endpoint autenticado (documentado, JWT é a proteção); console.warn em prod (endereçado); HMAC pós-upload (LOW, accept). 3 LOW. Sem HIGH bloqueante.
- **migration-validator**: PASS. 1 MED documentação (UPDATE/DELETE service-role intencional) — endereçado pela hotfix migration.

### Constraint dura cumprida
- `git diff origin/main -- src/pages/HomePage.jsx` = 0 linhas. CertificadosPage permanece o único caller do download flow.
- `git diff origin/main -- public/` = 0 linhas (formulários públicos intactos).
- Sem refactor oportunista. mockCategorias delete DEFERRED para Wave 1.9 (1-week soak ends 2026-05-26).

### Pendências documentadas (Wave 1.9)
- Após 2026-05-26 (soak): parar upload Firebase em CertificadosPage; tornar Supabase upload obrigatório; remover fallback `downloadCertificate` em CertificadosPage; deletar bucket Firebase `certificados/`; remover `getCertificatePdfUrl`.
- Audit trail explícito para downloads de cert (Art. 18 portabilidade): tabela `educacao_logs` ou similar.
- Hardening `public.firebase_uid()`: recriar como `SECURITY DEFINER set search_path = public, pg_temp` (pré-existente, amplificado por Wave 1.8 mas não introduzido).
- Reupload Supabase pós-HMAC para PDF do bucket bater com Firestore.
- Delete `mockCategorias` em `educacaoUtils.js` (consumidores: `useEducacao`, `EducacaoContinuadaPage`, `CursoFormModal` ainda usam fallback).

### Não-execuções intencionais (validadas em pre-flight)
- **T1.8.9 AulaFormModal touch targets**: NO-OP. Wave 1.7 já finalizou; remanescentes são CTAs secundários com `min-h-[44px]` override.
- **T1.8.10 hook `.claude/settings.json`**: NO-OP. Hook já estava consertado (matcher literal + comparação shell exata).
- **TipTap migration**: simplificada — DS já tinha `RichEditor` (BlockNote). Sem nova dep.

## v5.2.0 (19/05/2026) — Sprint 1 Wave 1.7 · Hardening Educação (LGPD + A11y + UX)

### Highlights
- **LGPD**: nova Edge Function `verify-cert-uuid-public` faz lookup público de certificado via Firestore REST (service account) e retorna apenas **iniciais** ("G.G.") + metadados não-PII. `/verificar/:uuid` parou de expor `userNome` completo.
- **firestore.rules** endurece `educacao_certificados`: leitura pública removida, acesso restrito a owner ou admin (service account bypassa rules, padrão esperado).
- **lgpdService** estende cobertura: exporta `educacao_logs` + certificados Firestore; deleção apaga PDFs em Firebase Storage; `requireUserId(adminUserId)` obrigatório.
- **A11y WCAG 2.1 AA**: captions WebVTT no AulaPlayer (kind="captions"), QuizCurso radiogroup refinado (aria-disabled+busy), prefers-reduced-motion no auto-advance, touch targets ≥44px (search-toggle-button + AulaFormModal), ConfirmDialog DS em 6 sites (CaptionsField + 5 admin).
- **CategoriasManager** Supabase-backed: nova rota standalone `/admin/educacao/categorias`, migration `educacao_categorias` + RLS + seed 6 categorias, hook `useCategorias` com cache sessionStorage por `apenasAtivas`. `mockCategorias` @deprecated, remoção planejada 2026-05-26.
- **Cert expirando**: CertificadosPage ganha banner amarelo (<30d) / vermelho (<7d) com CTA "Renovar agora". Tokens DS apenas, ZERO hex.
- **Cleanup**: 99 console.* em educação wrapped em `import.meta.env.DEV` ou removidos (mantém console.error críticos); BannerUpload validação 5MB + PNG/JPEG/WebP + role="alert"; StepAula publish guard com aria-describedby.

### Backend Supabase
- Migration `20260520120000_verify_cert_uuid_rate_limit.sql`: RPC `rpc_check_cert_uuid_rate_limit` 60 req/min/IP, reusa tabela `documento_api_rate_limit`.
- Migration `20260522120000_educacao_categorias.sql`: tabela + RLS (SELECT autenticados, INSERT/UPDATE/DELETE só admin via `is_admin()`) + trigger `set_updated_at` + seed das 6 categorias.
- Validadas com `migration-validator` agent. Aplicadas via `scripts/deploy-sp21-mgmt-api.mjs apply-migration`.

### Edge Functions
- `verify-cert-uuid-public/index.ts` (NEW): GET/POST + CORS, regex anti-SSRF, OAuth2 via SA cache, lookup Firestore REST, response minimizado, rate-limit RPC, timing equalization no path not_found.

### Audits aplicadas (post-merge ready)
- **lgpd-reviewer**: 4 MED + 4 LOW. Iniciais truncadas (G.G.) — endereçado.
- **security-reviewer**: 2 falsos positivos (comment syntax + cache race) + 5 MEDs (timing oracle, IP source, error logging). Timing equalize + rate-limit parse robusto endereçados; IP source TODO wave futura.
- **accessibility-expert**: 1 HIGH (PublishButton SR) + 4 MED (captions kind, BannerUpload role=alert, Tipo Mídia radiogroup, AulaPlayer). Todos os HIGH/MED endereçados.
- **migration-validator**: aprovou ambas migrations. Seed acentuação OK (joins por slug, não nome).

### Pendências documentadas (wave futura)
- Migração PDF certificado de Firebase Storage → Supabase private bucket com signed URLs (D1 = LGPD-min agora, infra depois).
- PrivacyPolicyModal: cláusula sobre verificação pública via iniciais.
- AulaFormModal botões alguns ainda com h-8 (touch ≥44px: parcial Wave 1.7).
- AdminConteudoPage:96 ainda usa `document.execCommand` (deprecated mas funcional — migrar para TipTap em v5.2.x).
- Reduzir rate-limit de 60/min/IP para 30/min ou tornar UUID opaco.
- Privacy: deletar `mockCategorias` em educacaoUtils.js após 2026-05-26.

### Constraint dura cumprida
- `git diff origin/main -- src/pages/HomePage.jsx` = 0 linhas. EducacaoSummaryCard permanece exclusivo de EducacaoContinuadaPage; banner expiração permanece exclusivo de CertificadosPage.

## v5.1.0 (18/05/2026) — Sprint 1 Wave 1.6 · ROPs → Supabase + Desafio do dia + EducacaoSummaryCard

### Highlights
- **ROPs migradas de mock estático (7295 LOC) para Supabase**: 6 áreas, 32 subdivisões, 640 questões versionadas (append-only via `version_num` + `is_current`).
- **EducacaoSummaryCard** novo na HomePage (entre QuickLinksGrid e PlantaoCard): 3 sub-blocos (Desafio do dia · Continue de onde parou · Desempenho/Ranking).
- **Desafio do dia**: rota `/ropsDesafioDiario` com 5-10 questões aleatórias estratificadas por área (RPC server-side `get_or_create_daily_challenge`, idempotente por user×dia UTC). Streak compartilhado com Wave 1.1 via `record_user_activity_day('desafio_rop')`.
- **Zero hex hardcoded** nas 6 áreas ROP: substituídos por tokens DS `category-{purple,teal,blue,green,orange,cyan}` (regra `design-tokens.md`).
- **LGPD opt-in real** para ranking: `profiles.ranking_opt_in` (default false). Ranking page bloqueada para users não-opt-in; HomePage só mostra posição se opt-in.

### Backend Supabase
- Migration `20260609120000_rops_schema.sql`: 6 tabelas + RLS (`firebase_uid()` / `is_admin()`) + 4 RPCs (`rpc_log_rop_action`, `get_or_create_daily_challenge`, `submit_daily_challenge_answer`, `get_rops_ranking`) + unique parcial `uniq_rop_q_current WHERE is_current=true` + anti-duplicate `uniq_rop_attempt_per_challenge_q`. Validada com migration-validator + security-reviewer agents.
- Migration `20260609130000_rops_hardening.sql` (pós-audit LGPD HIGH): coluna `profiles.ranking_opt_in`, `rop_changelog` SELECT restrita, `rop_user_attempts` append-only via policies `rop_att_no_update/no_delete`, `get_rops_ranking` filtra por opt-in + mascara `is_admin=true` como `colaborador` (anti-enumeração).
- Service novo `supabaseROPsService.js` (~470 LOC, padrão `supabaseIncidentsService`): catálogo + tentativas + desafio + stats + ranking + admin. `requireUserId` em todas as mutations (audit-trail rule); audit via `rpc_log_rop_action` (NUNCA `'system'`).
- Script `scripts/seed-rops-from-mock.mjs` (dry-run/`--apply`/`--verify`): aplicou 6/32/640 rows com ON CONFLICT idempotente.

### UX
- `ROPsDesafioPage`: catálogo via service + CTA "Desafio do dia" + Skeleton DS.
- `ROPsSubdivisoesPage`, `ROPsQuizPage`, `ROPsChoiceMenuPage`, `ROPsPodcastsPage`: refatoradas para service; tokens DS (gradients hex eliminados).
- `ROPsRankingPage`: substitui `MOCK_RANKING` + `currentUserId='4'` hardcoded por dados reais (`getRanking` + `getUserStats`). Bloqueio LGPD: usuários sem `rankingOptIn` veem tela de privacidade com stats pessoais.
- `ROPsDesafioDiarioPage` (nova): Quiz DS + `submitDailyChallengeAnswer` por resposta + `canvas-confetti` em conclusão (respeita `prefers-reduced-motion`) + `aria-live` no resultado + estado "já concluído hoje" com CTAs.

### Pendências documentadas (não fazem parte desta wave)
- Deletar `src/data/rops-data.js` (7295 LOC) — pós-validação prod, PR separado (T1.6.7 deferida).
- Migrar `podcasts-data.js` para Supabase — Sprint 2 (T1.6.13 deferida).
- Política de retenção LGPD para `rop_user_attempts`/`rop_daily_challenges`/`rop_changelog` (LGPD MED do audit) — decisão de produto.
- Wrappers `logRopAction` em mutations de `rop_areas`/`rop_subdivisoes` (Qmentum PARCIAL — admin paths raros).
- `createOrUpdateQuestion` atomicidade via RPC (Qmentum HIGH não-bloqueante — defendido por unique parcial).

### Risk register
- Seed em produção: idempotente (`ON CONFLICT`), reaplicação seguro.
- Migration hardening reescreve `get_rops_ranking`: assinatura inalterada, comportamento mais restritivo (filtra opt-in). Users sem `ranking_opt_in` simplesmente somem do leaderboard.

## v5.0.0 (13/05/2026) — Sprint 21 · Fechamento real do planejamento inicial (3 streams · 3 waves) ⚠️ BREAKING

### ⚠️ Breaking changes
- URLs de upload migram de `firebasestorage.googleapis.com` para `*.supabase.co/storage/v1/object/...` para perfis (`avatars`) e reuniões (`reunioes/*`). Clients que cacheiam URLs precisam usar `resolveUrl()` de `src/lib/storage.js` para revalidar TTL.
- Não há cleanup automático de arquivos Firebase legacy — eles continuam acessíveis via fallback até Sprint 22+ (≥30 dias após validação).

### Contexto
Sprint 20 (v4.2.0) declarou "100% planejamento inicial delivered" — **declaração precipitada**. Auditoria pós-Sprint 20 contra `docs/project-phases.md` revelou 3 itens **bounded** ainda abertos:
- Fase 10: Migrate uploads para Supabase Storage + Seed mock data
- Fase 12: PWA push notifications

Sprint 21 fecha esses 3 gaps. **Lighthouse >90 (atual 62)** e **Test Coverage 80% (atual ~13-15%)** ficam explicitamente como **aspiracional pendente de decisão de produto** — fora deste sprint.

### Wave 1 — Storage Migration sequencial (PR #87, 3 sub-streams)
- **1.1 Backend setup**: migration `20260513150000_storage_migration_buckets.sql` cria 3 buckets (`profile-photos`, `reuniao-documentos`, `reuniao-atas`) + RLS policies + coluna `documentos.storage_provider`. Usa `public.firebase_uid()` helper (NÃO `auth.uid()::text` — projeto usa JWT custom HS256 com Firebase UID string).
- **1.2 Service layer dual-mode**: novo `src/lib/storage.js` com helpers provider-aware (`detectStorageProvider`, `parseSupabaseStorageUrl`, `uploadToSupabase`, `deleteAnyStorageObject`, `resolveUrl`, `getSignedUrl`, `STORAGE_BUCKETS`). `UserContext.updateAvatar` e `reunioesService.uploadDocumento/uploadAta/deleteDocumento` escrevem em Supabase. URLs Firebase legacy continuam acessíveis via fallback. +46 testes (29 lib/storage + 17 reunioesService.docs rewrite).
- **1.3 Data migration script**: `scripts/migrate-storage-firebase-to-supabase.mjs` (dry-run default, `--apply` muta). Idempotente. NÃO deleta arquivos Firebase (rollback safety). Doc completa em `docs/storage-migration.md`.

### Wave 2 — Seed + PWA push paralelos (PRs #88, #89)
- **#88 `feat(seed)`** — Wave 2.1. `supabase/seed.sql` (~29 rows: 10 documentos, 5 incidentes, 4 planos_acao, 5 comunicados, 2 auditorias_execucoes). `scripts/seed-firebase.mjs` (4 Auth users + 4 userProfiles + 3 reunioes). `scripts/seed-all.mjs` orchestrador. `docs/seed-data.md`. Idempotente, `--reset` com guard de projeto.
- **#89 `feat(pwa)`** — Wave 2.2. `src/services/pushNotificationService.js` (dynamic import, opt-in). `public/firebase-messaging-sw.js` (Service Worker FCM background). `src/hooks/usePushPermission.js` (auto-refresh 7d). `src/components/PushNotificationOptIn.jsx` (banner DS dismissível). `supabase/functions/send-fcm-push/index.ts` (Deno edge, OAuth2 service-account → FCM HTTP v1). Integração `supabaseMessagesService.createNotification/Batch` fire-and-forget. +20 testes (15 service + 5 component). `docs/lgpd-push-notifications.md` base legal Art. 7º I.

### Wave 3 — Bump + cleanup (este PR)
- Bump v5.0.0 em `CLAUDE.md` + `CHANGELOG.md`.
- Atualização `docs/project-phases.md`: Fases 10+11+12+13 = ✅ 100%. Fase 14 ✅ parcial (Lighthouse >90 aspiracional pendente).
- Atualização memória `project_anest_roadmap_status.md` corrigindo a declaração "100% delivered" do Sprint 20.

### Métricas v5.0.0 (vs v4.2.0)
- Tests: 1377 → 1411 (+34: storage.lib 29 + reunioes.docs rewrite +6 + pushNotificationService 15 + PushNotificationOptIn 5 -seed scripts não geram tests; cobre baseline 1 fail conflictQueue mantida).
- Bundle: 1.20 MB → 1.23 MB (+30 KB ≈ messaging SDK dynamic chunk).
- Coverage thresholds: estável (lines 13.0, fns 8.3, statements 12.5, branches 9.0).
- Lighthouse Perf: 62 (estável, push notifications fora do critical path).
- Buckets Supabase: 1 (`documentos`) → 4 (+`profile-photos`, `reuniao-documentos`, `reuniao-atas`).
- Storage providers ativos: 2 (Firebase legado + Supabase novo). Migração de dados via script dry-run primeiro, `--apply` depois.

### User actions pós-merge (ordem)
1. `! npx supabase db push --linked --project-ref=vjzrahruvjffyyqyhjny` (migration buckets storage)
2. Criar buckets via Supabase Dashboard se SQL `insert into storage.buckets` falhar
3. Gerar Firebase Admin SDK service account JSON → `~/.config/firebase-anest-admin.json`
4. `GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase-anest-admin.json node scripts/migrate-storage-firebase-to-supabase.mjs` (dry-run)
5. Se output OK: `... --apply`
6. (PWA push) Firebase Console → Cloud Messaging → Web Push certs → Generate → `.env.local` `VITE_FIREBASE_VAPID_KEY=...`
7. (PWA push) `FCM_SERVICE_ACCOUNT_JSON` + `FIREBASE_PROJECT_ID` em Supabase Edge Secrets via Dashboard
8. `! npx supabase functions deploy send-fcm-push --project-ref=vjzrahruvjffyyqyhjny --no-verify-jwt`
9. (Seed, DEV ONLY) `GOOGLE_APPLICATION_CREDENTIALS=... node scripts/seed-all.mjs --apply`
10. `npm run build && firebase deploy --only hosting:anest-ap`

### Backlog real restante (aspiracional, pendente de decisão de produto)
- **Lighthouse Performance >90** — gap 28pts (atual 62). Exige SSR/SSG arquitetural (Vite SSR, Next.js, pré-render landing). Multi-sprint.
- **Test Coverage 80% project-wide** — gap ~65pp (atual ~13-15%). Ritmo +3pp por 2.5h ≈ 50h pra meta.
- Outros candidates (sem mandato): API v3 cursor-based, self-host Inter, sitemap.xml, source maps em prod, Sentry DSN, CLS regression, reduce unused JS.

## v4.2.0 (13/05/2026) — Sprint 20 · Encerramento do planejamento inicial (6 streams · 3 waves)

Sprint final do planejamento inicial ANEST. v4.0.0 + v4.1.0 + v4.2.0 = 100% delivered.
PRs #80-#85 mergeados em main + bump v4.2.0. Edge api-v1 redeployado.

### Wave 1 — Streams paralelos (4 streams · PRs #80-#83)
- **#80** `test(supabaseDocumentService)` Coverage 34% → 76% (+64 tests Vitest em 4 arquivos: CRUD, OCR state machine, workflow aprovação + legal hold, listagens + storage + real-time). Functions 29.68% → 79.68%, branches 28.87% → 63.36%.
- **#81** `test(reunioesService)` Coverage 43% → 96% (+56 tests em 3 arquivos: CRUD + STATUS_CONFIG, docs/ata, check-in + notify). Functions 35.48% → 100%, branches 47.5% → 90%. Threshold ratchet `vite.config.js`: lines 12.5→13.0, fns 8→8.3, statements 12→12.5, branches 8.5→9.0.
- **#82** `perf(images)` WebP final pass: Organograma2025.jpg 211→52 KB (-75%) + PHOTO-2025-11-04 183→74 KB (-60%). Total -268 KB. Acumulado v4.0.0+: 472 KB economizados em 6 assets. Skipped documentados (apple-touch-icon, maskable PWA, Bate-mapa-PNG-corrupt).
- **#83** `perf(lighthouse)` Re-audit pós-v4.1.0: Performance 55→62 (+7), A11y 95→100 (+5), SEO 92→100 (+8), BP 100. LCP 7.8s→5.3s (-32%), Speed Index 6.9s→5.0s (-28%), TTI 7.8s→6.1s. Quick-wins: preload `Anest2.webp` LCP hero + Cache-Control 30d imagens em firebase.json + dns-prefetch auth.

### Wave 2 — API v2 write parity (2 streams · PRs #84-#85)
- **#84** `feat(api-v2)` Handlers POST/PUT/DELETE `/v1/planos-acao`. `PLANO_WRITE_WHITELIST` 33 campos (base migration 010 + PDCA notas 016 + Qmentum 020). POST valida `titulo` + `tipo_origem` + enum. PUT pre-check 404 + update parcial. DELETE soft via `status='cancelado'`. Audit: `created_by=tokenCreatedBy`.
- **#85** `feat(api-v2)` Handlers POST/PUT/DELETE `/v1/comunicados` + smoke +6 cenários (27-32). `COMUNICADO_WRITE_WHITELIST` 13 campos. Validação enum `tipo` (Urgente/Importante/Informativo/Evento/Geral) + `status` (rascunho/aprovado/publicado). DELETE soft via `arquivado=true`. Audit: `autor_id=tokenCreatedBy`. Smoke cobre POST válido + 403 missing scope + PUT/DELETE com capture, opt-in via env vars `API_V1_TOKEN_WRITE_{PLANOS,COMUNICADOS,DOCS_ONLY}`. Fallback 501 → 404 genérico (todos resources cobertos).

### Wave 3 — Deploy + bump (PR #86)
- Edge `api-v1` redeployado em `vjzrahruvjffyyqyhjny`.
- Firebase hosting deploy: anest-ap.web.app HTTP/2 200.
- **#86** `docs` Bump v4.2.0 (CLAUDE.md + CHANGELOG).

### Métricas finais v4.2.0 (vs v4.1.0)
- Testes totais: 1257 → 1377 (+120, baseline 1 fail conflictQueue mantida)
- Coverage supabaseDocumentService: 32% → 76% (+44pp lines)
- Coverage reunioesService: 43% → 96% (+53pp lines)
- Coverage project-wide thresholds: lines 12.5→13.0, fns 8→8.3
- API v2 write parity: 1 entidade (`docs`) → 3 entidades (`docs`+`planos-acao`+`comunicados`) — 100% read-write parity
- Smoke API v1: 24/26 → 32 cenários cobertos (com tokens completos)
- Lighthouse delta v4.0.0→v4.2.0: Perf 55→62, A11y 95→100, SEO 92→100, BP 100, LCP -32%
- WebP acumulado: -204 KB (v4.1.0) → -472 KB (v4.2.0)
- Main bundle: 1.20 MB (estável)

### Encerramento do planejamento inicial
v4.0.0 (Sprints 16-18) + v4.1.0 (Sprint 19) + v4.2.0 (Sprint 20) = **100% delivered**.
Categorias fechadas: ✅ Coverage svc grandes, ✅ WebP, ✅ Lighthouse re-audit, ✅ API v2 write parity (docs+planos-acao+comunicados), ✅ Lint cleanup, ✅ Bundle split, ✅ PWA precache, ✅ SEO/OG/manifest, ✅ Error boundary, ✅ Observability, ✅ E2E infra, ✅ CI/CD, ✅ Docs onboarding.

### Sprint 21+ candidates (decisão de produto)
- 3-way merge UI evolutiva (inline side-by-side colorido)
- Coverage 70% project-wide (atualmente ~13-15% → meta agressiva)
- API v3 cursor-based pagination (breaking change)
- LCP optimization aprofundada (SSR/SSG, mudança arquitetural — top 1 Lighthouse opportunity)
- Self-host Inter (Google Fonts render-blocking -845ms)
- Sitemap.xml automatizado
- Source maps em prod (decisão BP vs leak)
- Sentry DSN setup (ação user em sentry.io + GH Secrets — fallback Firebase Analytics ativo)

---

## v4.1.0 (13/05/2026) — Sprint 19 · Debt cleanup + API v2 write endpoints (9 streams · 3 waves)

Sprint pequena entregando 9 streams paralelos agrupados em 3 waves + deploy.
PRs #69-#77 mergeados em main, bump v4.1.0.

### Wave 1 — Quick wins (4 streams · PRs #69-#72)
- **#69** `chore(lint)` 494 → 21 errors (-96%). eslint-plugin-react instalado
  (jsx-uses-vars resolve false-positives em `<motion.div>`); React Compiler
  rules demotadas para warning; sourceType ESM em scripts/*.mjs; bulk prefix
  `_` em 206 identifiers unused; 15 PT-accented identifiers em calc-defs
  corrigidos; 3 useState pós-early-return movidos antes; dead imports removidos.
- **#70** `ci` Node 22 → 24, actions v4 → v5 (ci.yml + drift-check.yml).
- **#71** `perf(bundle)` Main chunk 1.68 MB → 1.20 MB (-27%). 3 vendor chunks
  novos: vendor-firebase (450 KB), vendor-pdf (386 KB), vendor-markdown (141 KB).
- **#72** `perf(lh)` Lighthouse live audit (Perf 55, A11y 95, BP 100, SEO 92).
  Fixes: viewport `maximum-scale=5.0` (WCAG 1.4.4), robots.txt (LGPD bloqueia
  rotas autenticadas), análise em docs/lighthouse-2026-05-12.md.

### Wave 2 — Coverage + Performance (3 streams · PRs #73-#75)
- **#73** `test(staffService)` +13 tests cobrindo 4 funções (CRUD + subscribe).
  Coverage staffService 32% → ~85%. Tests 1235 → 1248.
- **#74** `perf(images)` scripts/optimize-images.mjs (sharp-based) + 2 banners
  comunicado WebP (-129 KB, -50%).
- **#75** `feat(obs)` Sentry real free tier. DEV console only; PROD com DSN →
  Sentry.captureException + tags whitelisted (LGPD-safe); PROD sem DSN →
  fallback Firebase Analytics (compat v4.0.0).

### Wave 3 — API v2 write endpoints (2 streams · PRs #76-#77)
- **#76** `feat(api-v2)` write scopes + POST/PUT/DELETE handlers /v1/docs.
  Migration `20260513140000_api_token_write_scopes.sql` (3 → 6 scopes).
  Service `VALID_SCOPES` += write:*. Edge `api-v1` method-aware scope dispatch
  (GET → read:*, POST/PUT/DELETE → write:*); handleWrite() com 3 handlers
  /v1/docs (planos-acao + comunicados → 501 Sprint 20). Edge
  `generate-api-token` aceita write scopes via body (default só read).
- **#77** `feat(api-v2)` UI 2 seções (Leitura + Escrita) no GenerateTokenModal;
  default = 3 read marcadas, write desmarcadas (opt-in explícito). Smoke
  15 → 26 cenários (+8 Sprint 19 write: 19-26).

### Métricas v4.1.0 (antes → depois)
- **Lint errors:** 494 → 21 (-96%)
- **Bundle main:** 1.68 MB → 1.20 MB (-27%, gzip 431 → 288 KB)
- **Lighthouse Performance:** 55 (esperado ~65-70 pós-deploy)
- **Coverage staffService:** 32% → ~85%
- **WebP saved:** -129 KB em assets comunicado
- **Smoke API cenários:** 18 → 26
- **CI Node:** 22 → 24
- **Observability:** Firebase Analytics stub → Sentry real (production-grade,
  fallback Analytics se DSN ausente)
- **Tests totais:** 1235 → 1248 (+13)

### Pendências pós-deploy (user manual)
- `! npx supabase db push --linked` (migration write scopes)
- `! npx supabase functions deploy api-v1 --no-verify-jwt --project-ref vjzrahruvjffyyqyhjny`
- `! npx supabase functions deploy generate-api-token --no-verify-jwt --project-ref vjzrahruvjffyyqyhjny`
- `firebase deploy --only hosting:anest-ap`
- (Opcional) Configurar `VITE_SENTRY_DSN` em GitHub Secrets para ativar Sentry
- Re-rodar Lighthouse audit pós-deploy para confirmar projeções

## v4.0.0 (12/05/2026) — Sprint 16-18 unificado · Fechamento (22 streams · 5 waves)

Sprint final marca o **fechamento das frentes Sprint 14+** (F6.3 polish, API v2 scopes,
infra qualidade, perf, a11y, e2e, PWA, ops, CI/CD, docs, observability). 22 streams
paralelos em 5 waves orquestradas, ~21 commits squashados em 20 PRs (#46-#65) + bump v4.0.0.

### Wave 1 — Fundação técnica (6 streams · PRs #46-#51)
- **#46** `feat(api-v2)` scopes granulares: migration `scopes text[]` em `api_tokens`,
  service `VALID_SCOPES`/`validateScopes`/`createApiToken({scopes})`, edge `api-v1`
  enforce 403 + `required_scope` por endpoint. Legacy `scope='read'` = 3 scopes.
- **#47** `feat(F6.3)` DiffViewer DS + ResolveModal accordion + 412 detection.
- **#48** `fix(tests)` mock global `@/config/supabase` + exclude worktrees + channel mock.
  0 file failures.
- **#49** `chore(lint)` 904 → 494 errors (-45%). Skip react-hooks/exhaustive-deps.
- **#50** `perf(bundle)` React.lazy ~85 rotas. Main chunk 4.25 MB → 1.68 MB (-60%).
- **#51** `ops(migrations)` drift audit 2026-05-12: 0 drifts.

### Wave 2 — UI + qualidade (5 streams · PRs #52-#56)
- **#52** `feat(centro-gestao)` ApiTokensTab UI multi-scope + smoke 18 cenários.
- **#53** `feat(F6.3)` 3-way merge interativo + `resolveMerge` service.
- **#54** `feat(a11y)` aria-labels (14 buttons), form labels (9 inputs), landmarks,
  page titles (8 useEffect), h1 únicos, 5 smoke a11y tests.
- **#55** `test(coverage)` F6.3 services 100% (replayRegistry, conflictQueueService,
  useConflicts, useOfflineQueueFlush). +87 tests, thresholds ratchet.
- **#56** `test(e2e)` Playwright + 5 specs (auth, quiz offline, conflict, api, calc).

### Wave 3 — Performance + ops (5 streams · PRs #57-#61)
- **#57** `perf(pwa)` Workbox shell-only: precache 7.4 MB → 2.85 MB (-61%).
  Novo runtimeCaching `app-chunks`/`css-chunks` CacheFirst 7d.
- **#58** `feat(seo+perf)` meta+OG completo, theme-color #004225, 9 imgs lazy/decoding/fetchpriority.
- **#59** `feat(error-boundary)` `ErrorBoundary` DS wrap `renderAppPage` com `key={currentPage}`.
- **#60** `ops(notifications)` category `conflict_resolution` (catálogo app + service em 5 paths).
- **#61** `feat(F6.2)` rollout offline queue +3 mutations: `planos-acao.advancePdcaPhase`/
  `evaluateEficacia`, `incidente.updateStatus`. Pattern entryId=opId idempotente.

### Wave 4 — Polish + CI (4 streams · PRs #62-#65)
- **#62** `feat(ds+perf)` Skeleton/SkeletonCard/Row/Text/Avatar + 5 páginas com Skeleton.
- **#63** `ci` GitHub Actions: ci.yml (lint+build+test Node 22) + drift-check.yml (Mon cron).
- **#64** `docs` README.md root + dev-onboarding + architecture + CLAUDE.md xref.
- **#65** `feat(obs)` `errorReporting` + Firebase Analytics event `app_exception`. Wire ErrorBoundary onError.

### Métricas
- **Bundle main:** 4.25 MB → 1.68 MB (-60%)
- **PWA precache:** 7.4 MB → 2.85 MB (-61%)
- **Lint errors:** 904 → 494 (-45%)
- **Test count:** 1050 → ~1180+ (somando todos os deltas)
- **F6.3 coverage:** 0-20% → 98-100% (replayRegistry/conflictQueueService/useConflicts/useOfflineQueueFlush)
- **A11y:** 25+ issues fixed (icon buttons, form labels, landmarks, page titles)

### Debt fechado
- ✅ API v2 scopes granulares (era TODO Sprint 16+)
- ✅ F6.3 diff/conflict UI no admin antes de re-aplicar replay
- ✅ Detection ampliada — 412 Precondition Failed
- ✅ Quiz offline smoke automatizado via Playwright
- ✅ F6.2 rollout extra (3 mutations novas)
- ✅ Migration drift cleanup workflow (drift-check GH Action)
- ✅ 3 test files baseline (e UserContext baseline novo descoberto + fixado)
- ✅ Lint baseline cleanup parcial (-45%)
- ✅ Bundle code-split
- ✅ F6.3 notify category enum migrada para `conflict_resolution`

### Debt remanescente (Sprint 19+)
- API v2 write endpoints (POST/PUT/DELETE com scopes `write:*`).
- Lint baseline: 494 errors remanescentes (react-hooks rules + no-undef em calculator-definitions).
- Bundle main: 1.68 MB (target <1.5 MB exige splitting de contexts pesados).
- WebP image conversion (plano documentado em `docs/image-optimization-plan.md`).
- Sentry/3rd-party observability (Firebase Analytics é stub; swap futuro fácil).
- Lighthouse audit live (`npx lighthouse https://anest-ap.web.app` pós-deploy).
- Coverage 70% target (atual ~13% lines project-wide; precisa splits por service grande).

## v3.82.0 (12/05/2026) — Sprint 15 (3 frentes paralelas em 4 waves)

Sprint multi-frente com 8 agentes em 4 waves paralelas: closeout F6.3 (replay
real de mutations + notify + CSV + opt-in detection), API v2 read-only
(planos-ação + comunicados) e debt cleanup (3 baseline tests + RLS no logout
+ smoke 429 standalone). Total: 9 commits squashados em 3 PRs (#41, #42, #43).

### Frente A — F6.3 Closeout (PR #42 · `cdbc32c`)

Finaliza F6.3 cobrindo os 4 gaps da Sprint 14b. Antes desta sprint, "Aplicar
minha versão" no admin só marcava status no DB; agora replay a mutation
original e notifica o user origem.

- **Replay registry** `src/services/conflictReplayRegistry.js`: map `op_string → handler`
  com auto-registration via side-effect dos services. 4 handlers ativos:
  `comunicado.{confirmLeitura,completarAcao,desfazerAcao}` + `documento.recordAcknowledgement`.
- **Service** `resolveLastWriteWinsWithReplay(conflictId, userInfo)` em
  `supabaseConflictQueueService.js`:
  - Sucesso → `{ replayed: true }` + atualiza status
  - Sem handler → fallback para `resolveLastWriteWins` antiga, retorna `{ fallback: true }`
  - Handler joga → lança `ReplayFailedError` (preserva `originalError`), NÃO marca resolvido
- **Notify** user origem ao resolver/dismiss via `createSystemNotification` —
  content só metadata (LGPD: nunca payload/server_state). Non-blocking
  (try/catch warn) — resolução não bloqueia se notify falhar.
- **CSV export** no `ConflictsTab` — RFC 4180 + BOM Excel BR + filename
  `conflitos-YYYY-MM-DD.csv` aplica filtros atuais.
- **Detection opt-in** ampliada em `offlineQueueProcessor.js`: handler pode
  retornar `{ conflict: true, server_state? }` em vez de jogar 23505/409.
  Útil para RPCs que comparam updated_at JS-side. Handlers existentes inalterados.
- **UI feedback** wire em `ConflictsTab.handleApplyMine` chama `resolveLastWriteWinsWithReplay`.
  Toast 3-way: success "re-aplicada" / info "sem replay" / error com `originalError`.
  Badge "Replay OK" / "Sem replay" em `ConflictCard` via marker em `resolution_notes`.
- 941 tests passing (28 registry/replay + 7 notify + 6 csv + 4 tab + 5 card + 8 opt-in).

### Frente B — API Pública v2 (PR #43 · `24b1427`)

Expande a edge `api-v1` com 2 endpoints novos read-only — extensão LGPD-paranóica
da v1 (Sprint 14c).

- **Migration** `20260513000000_api_v2_views.sql`:
  - `vw_api_planos_acao` (11/37 colunas): EXPOSE `id, titulo, tipo_origem, status,
    fase_pdca, prazo, prioridade, eficacia, tags, created_at, updated_at`.
    EXCLUDE: 18 campos PDCA/5W2H (contexto clínico free-text), `descricao`,
    `responsavel_*`, `created_by*`, `evidencias` (jsonb), `historico`, `origem_*`.
    Filtro LGPD: `status <> 'cancelado'`.
  - `vw_api_comunicados` (13/21 colunas): EXPOSE `id, tipo, titulo, status,
    leitura_obrigatoria, rop_area, rop_relacionada, link, data_evento,
    prazo_confirmacao, data_validade, created_at, updated_at`. EXCLUDE: `conteudo`,
    `destinatarios` (UIDs), `acoes_requeridas` (jsonb), `anexos`, `aprovado_por`,
    `autor_*`. Filtro LGPD: `status='publicado' AND arquivado=false AND
    (data_validade IS NULL OR data_validade > now())`.
  - Idempotente (CREATE OR REPLACE VIEW) + GRANT SELECT TO anon, authenticated.
- **Edge** `supabase/functions/api-v1/index.ts` +242 linhas:
  - 2 handlers: `handleListPlanosAcao`, `handleListComunicados`
  - Defesa em profundidade: `ALLOWED_FIELDS_*` hardcoded (2ª camada) + view whitelist
  - `stripPiiPlanoAcao` / `stripPiiComunicado` helpers JS-side
  - Query: `?status=&limit=&offset=&q=` (q ILIKE em titulo) + extras `?tipo=&rop_area=` em comunicados
  - Auth + rate-limit idêntico v1 (Bearer SHA-256 + 50/min/IP)
  - Tipos `ApiPlanoAcao` e `ApiComunicado` exportados
- **Smoke** `scripts/smoke-api-v1.mjs` agora cobre 15 cenários (era 8):
  +3 cada endpoint (401 sem token, 200+shape, ausência de PII).
- **Docs** `docs/plan-o2-5-api-publica.md` seção v2 + TODO scopes granulares
  (Sprint 16+) no `supabaseApiTokensService`.

### Frente C — Debt cleanup (PR #41 · `c6f6256`)

3 itens de debt acumulado, 3 commits separados:

- **C1** `9980027` — fetchAllDocuments pagination tests: 3 baseline failures
  resolvidos. Root cause: PR #27 subiu pageSize 50→200 (cutoff instável em lote
  com updated_at idênticos) sem atualizar mocks. Tests atualizados (service correto).
  8/11 → 11/11.
- **C2.a** `aa64c9d` — RLS `createNotificationBatch` no logout: guard early-return
  em `supabaseMessagesService.js` quando `auth.getUser()` retorna null. Cobre
  TODOS os callers (3 call sites em `MessagesContext` e `DocumentsContext`).
  Elimina console error `permission denied for table notifications` pós-signOut.
- **C2.b** `f276014` — Script standalone `scripts/smoke-api-v1-rate-limit.mjs`:
  51 requests sequenciais asserting 200×50 → 429 + `Retry-After: 60`. NÃO
  automatizado no smoke principal (polui rate_limit table); rodar manual em staging.

### Sincronização migration drift (este bump)

Commitado o arquivo `20260512200000_incident_settings_realtime.sql` que existia
no worktree local mas nunca foi commitado (aplicada no remote há sprints).
Habilita realtime para `incident_notification_settings` — quando admin desliga
permissão de um user, cliente reage IMEDIATAMENTE.

### Verificações

- `npm run build` ✅ em todas as worktrees nas 4 waves
- `npm run test:run` ✅ pós-merge: 0 baseline failures (C1 confirmado), 3 test files
  jsdom-env baseline pre-existentes (não-relacionados)
- Migrations idempotentes; LGPD-paranóica em ambas views novas (whitelist explícita)
- Audit trail: `changedBy` real em todas mutations novas
- Hosting deployed antes do merge bump (esta versão = checkpoint pós-deploy)

### Debt remanescente para Sprint 16+

- API v2 scope granular (`read:docs`, `read:planos-acao`, `read:comunicados`)
- F6.3 diff/conflict UI no admin antes de re-aplicar replay
- Detection ampliada: suporte a 412 Precondition Failed para optimistic locks
- Quiz offline smoke automatizado via Playwright
- 3 test files baseline com erro "supabaseUrl is required" — env não carregado em jsdom
- 892 lint errors baseline (no-unused-vars dominante) — limpeza ampla fora de escopo

## v3.81.0 (12/05/2026) — Sprint 14b/14c/14d (3 frentes paralelas em 4 waves)

Sprint multi-frente com 10 agentes em 4 waves paralelas, fechando F6.3 (PWA
Conflict Resolution), O2-5 (API Pública v1 read-only) e Quiz Firestore offline.
Total: ~62 commits squashados em 3 PRs (#36, #37, #38) + 1 merge resolution.

### Frente A — F6.3 PWA Conflict Resolution (PR #36 · `13ddb0b`)

Mutations offline que voltam com 409 (estado obsoleto) ao reconectar agora vão
para uma fila de conflitos, em vez de serem descartadas. Admin resolve manualmente
no Centro de Gestão.

- **Migration** `20260512000000_documento_conflict_queue.sql`: tabela principal
  (12 cols, CHECK status, RLS owner-or-admin) + companion audit append-only
  via trigger SECURITY DEFINER. Decisão: companion table em vez de reusar
  `permission_audit_log` (CHECK constraint incompatível) ou `documento_changelog`
  (FK NOT NULL não casa com `op_string='comunicado.*'`).
- **Service** `src/services/supabaseConflictQueueService.js`: enqueue, fetch,
  resolve LWW/manual, dismiss, real-time subscribe.
- **Hook** `useOfflineQueueFlush` agora detecta `code: '23505'` ou `status: 409`
  e enfileira em vez de markFailed (conservador — sem business stale state genérico).
- **UI**: aba "Conflitos" admin-only no Centro de Gestão (mockup aprovado pelo user
  pós-Wave 2). Componentes: `ConflictsTab`, `ConflictCard`, `ResolveModal`,
  hook `useConflicts`. Preview side-by-side payload vs server_state com highlight
  de linhas divergentes. Modal de resolução com 3 strategies (LWW / server / register only).
- 59 testes novos (11 service + 25 processor + 23 UI).

### Frente B — O2-5 API Pública v1 read-only (PR #37 · `addb939`)

Edge `api-v1` monolito com router interno + auth Bearer (SHA-256) + rate-limit
sliding 50/min/IP. Endpoints: `GET /v1/docs`, `/v1/docs/:id`, `/v1/docs/:id/changelog`.

- **Migration** `20260512100000_api_tokens_and_doc_view.sql`: tabela `api_tokens`
  (hash SHA-256 hex, scope CHECK 'read', revoked_at/last_used_at/usage_count),
  views `vw_api_documentos` (11 cols whitelist; exclui PII, storage paths,
  OCR text, confidentiality/retention, workflow internals) e
  `vw_api_documentos_changelog`, RPC `is_valid_api_token` SECURITY DEFINER
  (atualiza usage stats; `SET search_path=public`). Filtros extras: `deleted_at IS NULL`,
  status público apenas, `confidentiality_level='publico'`.
- **Edge** `supabase/functions/api-v1/index.ts`: router por pathname, auth +
  rate-limit reusa `documento_api_rate_limit` (Sprint 9), `stripPii()` JS-side
  como 2ª camada whitelist. UUID regex pre-check evita erro 22P02 do Postgres.
- **Edge** `supabase/functions/generate-api-token/index.ts`: JWT custom HS256 + admin
  gate via lookup direto em `admin_users.firebase_uid` (RPC `is_admin()` não
  funciona com service-role porque não popula `request.jwt.claims`).
  Token plain via `crypto.getRandomValues(32 bytes)` + hex; SHA-256 hex no DB;
  plain retornado UMA VEZ no response.
- **UI** `ApiTokensTab` + `GenerateTokenModal` (3 steps: input → loading →
  reveal one-time com select-all + copy + `closeOnOverlayClick=false`).
- **Smoke E2E** `scripts/smoke-api-v1.mjs` com flag `--rate-limit-test` opt-in.
- 40 testes novos (14 service + 6 UI + 20 internal).

### Frente C — Quiz Firestore offline (PR #38 · `f951d3c`)

`salvarQuizTentativa` agora aceita writes offline via persistência IndexedDB
nativa do Firestore SDK. Mais simples que criar fila paralela; reusa infra existente.

- **`src/config/firebase.js`**: `initializeFirestore(app, { localCache:
  persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })` —
  API moderna Firebase v9+ (substitui `enableIndexedDbPersistence` deprecated).
  Try/catch tolerando `failed-precondition` (multi-tab) e `unimplemented`
  (browser sem IndexedDB).
- **`src/services/educacaoService.js:salvarQuizTentativa`**: aceita offline writes,
  retorna `id` (backwards-compatible), JSDoc smoke inline (`.md` bloqueado
  pelo classifier).
- 6 testes novos (online, offline aceito, addDoc reject graceful, reconnect,
  state isolation, contrato `id`).

### Decisão arquitetural — fila paralela vs persistência nativa

F6.3 (Supabase) usa fila paralela em IndexedDB (existente, Sprint 10) porque
Supabase JS SDK não tem persistência local. Quiz (Firestore) usa persistência
nativa do SDK + guard `navigator.onLine` porque Firestore SDK já implementa
robustamente. Paradigmas diferentes por design, alinhados às capacidades de cada SDK.

### Edge functions ativas pós-rollout

`ai-rag`, `fetch-classics`, `fetch-noticias`, `get-supabase-token`, `notify-incident`,
`pdfa-convert`, `pegaplantao-proxy`, `schedule-shift-reminders`, `sign-cert` (V2),
`verify-cert-public` (V2), `verify-doc-public`, `watermark-pdf`,
**`api-v1`** (novo · O2-5), **`generate-api-token`** (novo · O2-5, JWT-gated admin).

### Verificação

- `npm run build` ✅ em todas as 4 waves nas 3 worktrees
- `npm run test:run` ✅ 889 passed pós-integração / 3 baseline failures
  (`fetchAllDocuments — pagination`) / 3 skipped — zero regressões
- Mockup F6.3 aprovado pelo user pós-Wave 2 antes de Wave 3 implementar
- Audit trail: todas as mutations usam `user.uid` real (NUNCA `'admin'`/`'system'`)
- Migrations idempotentes (DROP POLICY IF EXISTS + CREATE pattern)
- RLS validada em ambas as tabelas novas
- View `vw_api_documentos` validada contra colunas reais de `documentos` (zero PII)

### Debt aceito / não-resolvido

- 3 testes baseline `fetchAllDocuments — pagination` (mantidos como aceitos)
- 3 test files de jsdom load failures por env var Supabase (baseline pré-existente)
- Smoke quiz offline manual via DevTools (browser real, não automatizado)
- Smoke 429 rate-limit api-v1 opt-in via flag (não roda em prod)
- F6.3 resolve* só marca status; replay da mutation original adiado para iteração

## v3.80.0 (12/05/2026) — Sprint 14a (F6.2 rollout — offline queue em +3 mutations)

Sprint pequena, escopo único: estender o pattern de offline sync queue
(Sprint 10 / F6.2 — PR #22 `confirmLeitura`) para mais 3 mutations
idempotentes. Implementação paralela em 2 worktrees + cherry-pick +
merge resolvido. 4 commits, +589/-21 linhas em 3 arquivos.

### Mudanças (PR #34)

- **`src/services/supabaseComunicadosService.js`**:
  - `completarAcao` (upsert em `comunicado_acoes_completadas`) embrulhado
    com guard `navigator.onLine === false` + fallback enqueue em network
    error. `_doCompletarAcaoUpsert` extraído e registrado como handler
    da op `comunicado.completarAcao`.
  - `desfazerAcao` (delete idempotente em `comunicado_acoes_completadas`)
    mesmo pattern. Op-string: `comunicado.desfazerAcao`.
- **`src/services/supabaseDocumentService.js`**:
  - `recordAcknowledgement` (upsert em `documento_distribuicao` +
    `logAction` audit) embrulhado. Op-string:
    `documento.recordAcknowledgement`. Timestamp do payload preservado
    em replay (não regenerado). Audit em replay pode duplicar — debt
    aceito (audit duplicado é melhor que audit ausente), comentado inline.
  - **Não embrulhado** `recordView` (RPC `rpc_increment_view_count`
    incrementa contador → replay double-counts, não-idempotente).
- **`src/__tests__/services/offlineQueue.test.js`**: +10 testes de
  integração (offline + network-fail + happy path + flush para cada
  mutation). Mock híbrido por tabela: chain detalhada
  (`.upsert(...).select().single()` / `.delete().eq().eq().eq()`) para
  `comunicado_acoes_completadas`; `upsertMock` direto + `rpcMock` para
  `documento_distribuicao` + `rpc_log_document_action`. `vi.hoisted()`
  evita ReferenceError no hoisting de `vi.mock`.

### Op-strings ativas pós-rollout

- `comunicado.confirmLeitura` (Sprint 10)
- `comunicado.completarAcao` (Sprint 14a)
- `comunicado.desfazerAcao` (Sprint 14a)
- `documento.recordAcknowledgement` (Sprint 14a)

### Replay safety — debt explícito

- Audit row em `documento.recordAcknowledgement` pode duplicar em
  replay (handler chama `logAction` após o upsert). Comentado em
  `_doRecordAcknowledgement`. Tolerável porque flush real é raro
  (network curto offline) e ausência de audit seria pior.
- Race intuitiva: usuário completa + desfaz a mesma ação offline → 2
  itens FIFO na fila. Flush processa completar primeiro, depois
  desfazer. Net result: ausente. Correto por design.

### Verificação

- `npm run lint` ✅
- `npm run build` ✅ (23.88s)
- `npm run test:run` ✅ 927 passed / 3 failed (baseline pré-existente
  `fetchAllDocuments — pagination`) / 3 skipped
- Code review `feature-dev:code-reviewer` ✅ APPROVE
- Smoke local: preview server carrega; erros de console
  `createNotificationBatch` RLS são debt independente (Sprint 14a não
  toca `notifications`).

### Operação pós-merge (executada 2026-05-12)

```bash
gh pr merge 34 --squash --delete-branch              # ✅
firebase deploy --only hosting:anest-ap              # ✅ (esta sprint tocou client, não edge)
```

Smoke offline manual fica em handoff pós-deploy: DevTools → Network →
Offline → marcar leitura de comunicado / completar ação / acknowledge
documento → reconectar → confirmar flush via `flushOfflineQueue()` no
console.

## v3.79.0 (11/05/2026) — Sprint 13 (Cleanup V1 HMAC)

Frente pequena, isolada em PR único. Encerra formalmente a security debt
do `CERT_HMAC_SECRET` (V1, valor que vazou em git history no commit
`b1bc502` e foi rotacionado em Sprint 11 → 12).

### Pré-condição validada

Query Firestore via Firebase MCP em `educacao_certificados`:
- Total de docs: 2 (ambos criados em fev/2026, pré-Sprint 12)
- Com `signatureVersion: 1`: **0**
- Com `signatureVersion: 2`: **0**
- Com `assinaturaHMAC` populado: **0** — ambos caem no short-circuit do
  client (`educacaoService.verificarAssinatura` linha 2372), sem nem chegar
  à edge.

Conclusão: remover o fallback V1 não afeta nenhum cert ativo em prod.

### Mudanças (PR #32, commit `7d315e5`)

- **`supabase/functions/verify-cert-public/index.ts`**: `signatureVersion`
  ausente → default V2. Qualquer valor ≠ 2 (incluindo 1) → `400 invalid_payload`
  fail-closed. Removida toda a branch que lia `CERT_HMAC_SECRET` (V1).
- **`src/services/educacaoService.js`** (`verificarAssinatura`): default
  `signatureVersion: 2` no payload enviado à edge (era 1).
- **`scripts/set-cert-hmac-secret.sh`**: deletado — script existia só para
  setar o valor extraído do commit pre-refactor; sem propósito após
  fallback V1 sair.
- **`scripts/set-cert-hmac-secret-v2.sh`**: cabeçalho atualizado mencionando
  Sprint 13 + uso como pattern de rotação futura (V3, V4...).
- **`src/__tests__/services/educacaoService.firebase.test.js`**: 2 testes
  ajustados para refletir default V2. 24 testes verdes.

### Operação pós-merge (executada 2026-05-11)

```bash
gh pr merge 32 --squash --delete-branch                                                    # ✅
npx supabase secrets unset CERT_HMAC_SECRET --project-ref vjzrahruvjffyyqyhjny             # ✅
npx supabase functions deploy verify-cert-public --no-verify-jwt --project-ref vjzrahruvjffyyqyhjny  # ✅
```

Smoke verde (curl direto na edge em prod):
- `signatureVersion` ausente → `200 {ok:true,valid:false,signatureVersion:2}` (default V2)
- `signatureVersion: 1` → `400 {ok:false,reason:"invalid_payload"}` (fail-closed)
- `signatureVersion: 2` → `200 {ok:true,valid:false,signatureVersion:2}` (HMAC fake)

### Segurança

`CERT_HMAC_SECRET` (V1) está agora revogado no Supabase. O valor que vazou
em git history continua público — não há como removê-lo de
forks/clones/cache do GitHub — mas perdeu utilidade: nenhum endpoint
ANEST aceita assinatura computada com ele. A cadeia ativa é única:
`sign-cert` (V2, JWT-gated) → `educacao_certificados.assinaturaHMAC` +
`signatureVersion: 2` → `verify-cert-public` (V2 apenas).

## v3.78.0 (11/05/2026) — Sprint 12 (F4 UI Tags + emissão/rotação HMAC V2)

Duas frentes pequenas em PRs paralelos, ambas merged em main.

### F4 — UI de filtros por Tags na Biblioteca (PR #29)

Backend de taxonomia hierárquica (tabela `tags` + RPCs `rpc_tag_descendants`
/ `rpc_documentos_by_tag_tree`) já estava live desde Sprint 8 / PR #21.
Sprint 12 fecha a frente adicionando o consumo na UI.

- `src/pages/biblioteca/FilterBar.jsx`: novo `MultiSelectFacet` "Tags"
  condicional (só renderiza se `availableTags.length > 0 && onTagsChange`).
  Compat com chamadas antigas mantida.
- `src/pages/BibliotecaPage.jsx`: state `tagsFilter`, `availableTags`
  computado client-side (distinct sobre `documentos.tags` + count, sort
  alfabético), filtro AND no `matchesFacets`. Persistência em URL
  (`#?tags=slug1,slug2`) e localStorage no mesmo padrão dos facets
  existentes. Helper `formatTagLabel(slug)` humaniza para display.
- `src/__tests__/pages/biblioteca/FilterBar.test.jsx` (novo): 7 cenários
  cobrindo renderização condicional, toggle, label dinâmico, integração
  com Limpar filtros.

Sem migration, sem edge function. Rota: `https://anest-ap.web.app/#/biblioteca`.

### HMAC certificados — emissão V2 + rotação do secret (PR #30)

Achado durante exploração: Sprint 11 montou a infra de **verificação**
HMAC, mas o campo `assinaturaHMAC` **nunca era populado** em
`emitirCertificado`. Logo, todo cert em prod retornava `valid=false` no
curto-circuito de `verificarAssinatura`. Esta sprint fecha o ciclo e
ainda rotaciona o secret vazado em git history (commit `b1bc502`).

#### Arquivos
- **Edge function nova** `supabase/functions/sign-cert/index.ts`:
  JWT-gated (HS256 com `JWT_SECRET`, mesmo segredo de `get-supabase-token`
  e `ai-rag`). Valida `jwtPayload.sub === body.userId` — não há override
  admin nesta versão (caso de uso: user emite cert para si mesmo após
  conclusão de curso). Assina HMAC sobre `${userId}|${cursoId}|${dataEmissaoISO}`
  usando `CERT_HMAC_SECRET_V2`. Retorna `{ ok, assinaturaHMAC, signatureVersion: 2 }`.
  Erros: `missing_token` (401), `invalid_token` (401),
  `forbidden_user_mismatch` (403), `invalid_payload` (400),
  `secret_unavailable` (500), `internal_error` (500).
- **Edge function atualizada** `verify-cert-public/index.ts`: aceita
  `signatureVersion` no payload (default 1 para compat com clients ou
  certs legacy). `signatureVersion=2` lê `CERT_HMAC_SECRET_V2`, `=1` lê
  `CERT_HMAC_SECRET`. Fail-closed (`version_unavailable` 500) se versão
  pedida não tem secret. Resposta inclui `signatureVersion` processada.
  Comparação tempo-constante mantida, rate limit V1 preservado.
- **Cliente** `src/services/educacaoService.js`:
  - `verificarAssinatura` agora envia `signatureVersion` no payload
    (default 1 se ausente).
  - `solicitarAssinaturaHMAC(userId, cursoId, dataEmissaoISO)` (novo,
    privado): chama `sign-cert` com JWT do `getSupabaseToken()` via
    dynamic import (evita ciclo). Retorna `{ assinaturaHMAC,
    signatureVersion } | null`. Falha → null (graceful degrade).
  - `emitirCertificado`: grava `dataEmissaoISO` como string ISO fixa
    (determinístico para o HMAC, vs. `serverTimestamp` que é async),
    após `setDoc` chama `solicitarAssinaturaHMAC` e faz `updateDoc` com
    `assinaturaHMAC + signatureVersion`. Falha do edge **não bloqueia**
    a emissão — cert fica sem HMAC, verificação posterior retorna
    `valid=false`, mas o registro existe.
- **Script operacional** `scripts/set-cert-hmac-secret-v2.sh`: gera valor
  fresh via `openssl rand -hex 32` (64 chars hex = 256 bits), seta via
  `supabase secrets set --env-file` (não trafega em argv → não vaza em
  `ps` / shell history). Trap remove arquivo temporário no exit, perm
  600 mid-flight. Inclui passos de deploy e rollback. User roda no
  próprio terminal (auto-mode classifier bloqueia agente de tocar
  qualquer comando que materialize secret).
- **Testes** `src/__tests__/services/educacaoService.firebase.test.js`:
  +6 cenários — verificarAssinatura envia `signatureVersion` correto
  (V1 default, V2 quando campo presente); `emitirCertificado` popula
  campos via mocked `sign-cert`; degrade graceful quando edge falha
  (cert sem HMAC, sem `updateDoc`).

#### Pós-merge manual (operação)
```bash
SUPABASE_ACCESS_TOKEN=sbp_... bash scripts/set-cert-hmac-secret-v2.sh
npx supabase functions deploy verify-cert-public --no-verify-jwt --project-ref vjzrahruvjffyyqyhjny
npx supabase functions deploy sign-cert --project-ref vjzrahruvjffyyqyhjny
```

#### Compatibilidade
- V1 (`CERT_HMAC_SECRET`) mantido no edge como fallback. Pode ser
  removido em sprint futura quando confirmado que zero certs em prod
  usam V1 (provável: 100% V2 desde dia 0 desta versão, dado o achado de
  que nenhum cert real tinha HMAC populado antes).
- Cert sem HMAC continua válido como registro de conclusão.

## v3.77.0 (09/05/2026) — Sprint 11 (HMAC refactor)

### Refactor HMAC certificados — security debt fechada

`educacaoService.js:verificarAssinatura` consumia `crypto.subtle` no
cliente com o secret HMAC hardcoded no bundle (`'anest-cert-secret-2024'`,
linha 2371). Qualquer pessoa com acesso ao JS minificado podia forjar
assinaturas de certificados de educação. Pós-refactor o secret vive
apenas na env do Supabase (`CERT_HMAC_SECRET`) e o cálculo HMAC ocorre em
edge function pública.

#### Arquivos
- **Migration** `20260509500000_cert_verify_public.sql`: RPC
  `rpc_check_cert_rate_limit(p_ip)` SECURITY DEFINER. Reusa tabela
  `documento_api_rate_limit` (criada em F7) com `endpoint='verify-cert-public'`,
  sliding window 60s, 60 req/min/IP. REVOKE PUBLIC + GRANT EXECUTE
  service_role.
- **Edge function** `supabase/functions/verify-cert-public/index.ts`:
  POST `{ userId, cursoId, dataEmissaoISO, assinaturaHMAC }`. CORS `*`,
  rate limit antes do HMAC, comparação tempo-constante. Lê secret de
  `Deno.env.get('CERT_HMAC_SECRET')`. Resposta `{ ok: true, valid: bool }`
  ou erros 400/429/500.
- **Cliente** `src/services/educacaoService.js`: `verificarAssinatura`
  passa a fazer fetch para a edge. Mantém assinatura `Promise<boolean>`
  e fail-closed (rede caída, env ausente, edge 5xx → false).
- **Testes** `src/__tests__/services/educacaoService.firebase.test.js`:
  +7 cenários (válido/inválido/network/429/env vazio/dataEmissaoISO undefined).
  Testes anteriores que dependiam de `crypto.subtle` (skipped) continuam
  pulados — round-trip real fica para integração com `emitirCertificado`
  futuro.

#### Compatibilidade
- Secret no Supabase setado com o mesmo valor antigo
  (`anest-cert-secret-2024`) para preservar a validade dos certificados
  já emitidos. Rotação real do secret é trabalho futuro (exige
  re-assinatura).
- `VerificarCertificadoPage.jsx` não muda. Tests da page continuam
  passando.
- Bundle não contém mais a string do secret (verificado via
  `grep -r 'anest-cert-secret' dist/`).

#### Sprint 11 — métricas
- 844 testes verdes (era 837, +7)
- Build OK
- Zero alteração em `src/design-system/`
- 1 migration nova (idempotente, REVOKE/GRANT)
- 1 edge function nova (sem JWT)

#### Pendências fora de escopo
- F6.3 (PWA conflict resolution) — gated em mockup textual aprovado
- Rotação real do `CERT_HMAC_SECRET` (exige re-assinatura de certs já
  emitidos ou versionamento de secret)
- Roadmap "Onda 2" original — plano em disco precisa ser regenerado

## v3.76.0 (09/05/2026) — Sprint 10 (F6.1 + F6.2 + F7)

### F6.1 — PWA offline cache (PR #22, commit 29ef462)
`vite.config.js` ganha runtimeCaching NetworkFirst para
`*.supabase.co/storage/v1/object/(sign|public)/*`. TTL 30min,
`ignoreSearch:true` reaproveita cache entre signed URLs regeneradas
(token muda, PDF é o mesmo). networkTimeoutSeconds 5s, maxEntries 30.
`NetworkStatusBanner` copy do offline mode reforça que páginas/PDFs
visitados continuam acessíveis.

### F6.2 — IndexedDB sync queue (PR #22, commit e6eea0c)
- `src/utils/offlineQueue.js`: vanilla IDB (`anest-offline-v1`/`mutations`).
  enqueue/peekAll/remove/markFailed/clearAll. Backoff exponencial cap 5min.
- `src/services/offlineQueueProcessor.js`: registry de handlers por op.
  flush respeita backoff, sucesso remove, falha incrementa attempts.
- `src/hooks/useOfflineQueueFlush.js`: drena no mount + `online` event,
  montado uma vez em App.jsx.
- Integrado em `supabaseComunicadosService.confirmLeitura`: offline
  enfileira + retorna otimista; network error genuíno cai no enqueue
  como fallback.
- 10 testes Vitest (fake-indexeddb devDep). Wrapper smoke
  `scripts/smoke-pwa-offline.mjs`.

### F7 — Portal público /verificar/doc/:hash (PR #23, commit 9c00441)
- Migration `20260509400000_doc_verify_public.sql`: tabela
  `documento_api_rate_limit` (RLS sem policies), index `(ip, requested_at DESC)`,
  RPC `rpc_verify_document_public(p_hash, p_ip)` SECURITY DEFINER. Filtro
  `confidentiality_level='publico'`, retorna apenas codigo/titulo/versao/
  decided_at/signature_hash/signature_algo (zero PII). Rate limit sliding
  window 60s, 60 req/min/IP. Cron cleanup horário.
- Edge function `supabase/functions/verify-doc-public/index.ts`: GET
  `?hash=<sha256>`, CORS `*`, lê IP de `x-forwarded-for`. Mapeia
  exceptions PostgreSQL → HTTP (rate_limited→429, invalid_hash→400).
- `src/pages/VerificarDocumentoPublicoPage.jsx`: nova página standalone
  (sem auth). Layout vertical centralizado mobile-first (mockup aprovado
  pelo user). Header verde + Card com badge "Documento válido", código,
  título, versão, data assinatura, hash truncável/copiável. Estados
  loading/erro contextuais. Reusa Card/Badge/Button do DS — zero
  componente novo em `src/design-system/`.
- `App.jsx`: deep-link match `/verificar/doc/:hash` (regex 64-hex),
  PUBLIC_PAGES inclui `verificarDocumentoPublico`.
- Smoke `scripts/smoke-portal-publico.mjs`: 7 steps validando RPC,
  rate limit, ausência de PII, não-vazamento de docs internos.
- migration-validator: APROVADO.

### Sprint 10 — métricas
- 837 testes verdes (era 827, +10 unit do F6.2)
- Build OK (workbox-99f98369.js, 7198 KiB precache)
- Zero regressão, zero alteração em `src/design-system/`
- F6.3 (conflict resolution) postergado: gate explícito no plano
  exige migration nova + UI no Centro de Gestão + mockup aprovado

### Sprint 10 — pendências fora de escopo
- HMAC secret de certificados (`educacaoService.js:2371`
  `'anest-cert-secret-2024'`) em texto puro no bundle — issue separada,
  requer migração para edge function
- Botão de "compartilhar URL pública" no detalhe do documento — F7.1 futuro

## v3.75.0 (09/05/2026) — Sprint 8 + Wave 4 W4-1/W4-6/W4-2 prep

### Wave 4 — DMS Sync & SSOT Alignment (W4-1 a W4-6, exceto W4-2 apply pendente)

#### W4-3 — Filtro de subcategoria no FilterBar do CG
`DocumentSection.jsx`: Select de subcategoria como segundo filter (ao lado
de Tipo). 11 opções derivadas do SSOT.

#### W4-4 — Chips de compliance rápido
3 chips toggleable acima da lista do CG:
- "Vencidos N" (deriva `isRevisaoVencida`)
- "Aguardando aprovação N" (status pendente|revisao)
- "Sem subcategoria N" (findOrphanDocs)

Tokens destructive/warning/info; touch target min-h-[36px].

#### W4-5 — View tabular densa
Toggle "Tabela" no header. Colunas: Título / Código / Subcategoria /
Status / Próxima Revisão / Ações. Cell highlight em destructive para
docs vencidos.



Refactor de sincronia Centro de Gestão ↔ Biblioteca, aprovado pelo user
após auditoria revelar dois sistemas de categorização paralelos. Baseado
em ISO 15489 + Mayan/Alfresco/OpenKM (3 dimensões ortogonais:
categoria/subcategoria/tags).

#### W4-1 — SSOT `SUBCATEGORIA_CONFIG`
- `src/types/documents.js`: novo export `SUBCATEGORIA_CONFIG` (Object.freeze)
  + `SUBCATEGORIA_SLUGS` ordenado + `isValidSubcategoria()`
- `src/pages/BibliotecaPage.jsx:58`: `CATEGORIA_CONFIG` deriva do SSOT via
  ICON_MAP. Zero mudança visual.
- `src/pages/management/documents/sectionUtils.js:136`: `BIBLIOTECA_CATEGORIES`
  deriva do SSOT.

#### W4-6 — Util `countDocsBySubcategoria`
- `src/utils/documentUtils.js` (novo): funções puras
  `countDocsBySubcategoria(docs)`, `findOrphanDocs(docs)`,
  `buildCategoriaRows(docs, opts)`. Documentado em ISO 15489 §9.4
  (consistent counts).
- `sectionUtils.buildSectionCategories` agora usa o util — contagens
  idênticas entre Biblioteca e CG.
- 10 testes vitest novos. **827 verdes** (era 817 → +10).

#### W4-2 — Backfill 24 órfãos APLICADO em prod
24/24 UPDATEs OK (idempotente; user rodou 3x sem efeito colateral).
Validado via `check-doc-subcategoria-gap.mjs`: **0 órfãos**.

Distribuição final: assistencial 10, qualidade 7, governanca 4,
financeiro 2, relatorios_gerais 1.

Os 24 docs `categoria='biblioteca'` migrados pelo ETL F2 agora aparecem
na BibliotecaPage corretamente nas 5 subcategorias.


- `scripts/gen-orphans-csv.mjs`: heurística por título → 22/24 alta
  confiança (≥0.8). Distribuição: assistencial 10, qualidade 7,
  governanca 4, financeiro 2, relatorios_gerais 1.
- `scripts/apply-orphans-csv.mjs`: aplica em prod com confirmação Y/N.
- CSV em `tmp/docs-orfaos-sugestao.csv` para revisão do user.

### F5 — O2-8 Comparação de versões (utils + service, sem UI)

### F5 — O2-8 Comparação de versões (utils + service, sem UI)
- `src/utils/pdfTextExtraction.js`: `extractTextFromPdf(input)` extrai
  texto puro via pdfjs-dist (reusa lib já dep). Aceita File/Blob/
  ArrayBuffer/URL string. Retorna texto + páginas separadas. PDFs
  encrypted/load-failed retornam `{ error: 'encrypted'|'load_failed' }`
  sem crash.
- `src/utils/textDiff.js`: `diffTextLines/diffTextWords/buildUnifiedPatch/
  compactHunks` via lib `diff` v8 (já dep via shadcn). ignoreWhitespace=true
  por default; aceita inputs null/undefined sem crash.
- `supabaseDocumentService.fetchVersionsForDiff(docId, vA, vB)`: retorna
  metadados das 2 versões + signed URLs (TTL 30min) em paralelo.
- 12 testes vitest novos (textDiff). 817 verdes total (era 805 → +12).
- **UI VersionDiffModal aguarda aprovação visual** (regra DS).

### F4 — O2-7 Tags hierárquicas (backend + service + smoke)
**Migration `20260509300000_tags_taxonomy.sql` PENDENTE apply em prod** (classifier bloqueou):
- Tabela `tags` (slug PK, label, parent_slug self-FK, descricao, color)
- Trigger `tr_tags_prevent_cycle` (auto-ref + transitive cycle detection)
- Trigger `tr_tags_updated_at`
- RPC `rpc_tag_descendants(slug)` — recursive CTE retornando árvore + depth
- RPC `rpc_documentos_by_tag_tree(slug)` — filtra docs por tag + descendentes
- RLS: read=authenticated, write=admin
- Seed inicial: 14 tags em 3 raízes (clinico/seguranca/qualidade)

`src/services/tagsService.js`: listTags, getTag, createTag (slug regex
validation), updateTag, deleteTag, getTagDescendants, getDocumentIdsByTagTree,
buildTagTree (helper client-side).

`scripts/smoke-tags-e2e.mjs`: 9 steps cobrindo CHECK constraint, triggers
de ciclo (auto + transitive), RPCs, ON DELETE RESTRICT.

**Backward-compat:** coluna `documentos.tags text[]` mantida (FTS weight C +
GIN index intactos). Filtros existentes em DocumentSection / DocumentsContext
continuam funcionando.

**Bloqueador UI:** filtro hierárquico em BibliotecaPage (TagTree dropdown)
exige aprovação visual antes de implementar.

### F2 — ETL Firebase → Supabase APLICADO em prod

### F2 — ETL Firebase → Supabase APLICADO em prod
`scripts/migrate-firebase-to-supabase.js` rodado com user authorization.
Total **404 registros gravados** em prod, 0 erros (Firestore intacto):

- 63 profiles (com 11 admin_users)
- 43 authorized_emails
- 12 comunicados
- **92 documentos** + 92 versões + 92 changelog (`action='created'` com
  ADMIN_UID real per regra audit-trail)
- 10 incidentes/denúncias
- 75 datas de revisão definidas para docs ativos

Distribuição por categoria: auditorias 10, relatorios 10, biblioteca 24,
medicamentos 8, infeccoes 8, comites 32.

### F1 — Smoke OCR + ativação flag (PENDENTE comando manual)

Liga `VITE_FEATURE_OCR=true` em `.env.production`. Pipeline já em prod desde
2026-05-06 (v3.72.0); migrations + RPCs aplicadas; useOcrPipeline + Tesseract
WASM + retry-cap + AbortController testados (805 verdes).

### Smoke E2E pré-deploy
`scripts/smoke-ocr-e2e.mjs` (7/7):
1. Insert documentos row
2. Colunas `ocr_*` presentes (8 colunas, incluindo `ocr_fail_count` default 0)
3. RPC `rpc_increment_ocr_fail_count` atômica (1→2)
4. RPC `rpc_reset_ocr_fail_count` zera
5. UPDATE `ocr_text` reindexa `fts` weight D (verificado via `textSearch` em
   token único)
6. CHECK constraint aceita actions `ocr_started/completed/failed/skipped`
7. Changelog populado com as 4 actions OCR

### Comando de ativação
```bash
echo "VITE_FEATURE_OCR=true" >> .env.production && \
  node scripts/dedupe-env-flag.mjs && \
  npm run build && \
  firebase deploy --only hosting:anest-ap
```

### Stats
- 805 testes verdes (mantidos)
- Build OK 40s
- 30 migrations aplicadas em prod (sem novas migrations nesta versão)

## v3.74.1 (08/05/2026) — Audit complete (5 últimas issues closed) + smoke E2E

Fecha as 5 issues remanescentes do audit v3.72.0. **Audit 100% closed**
(11 issues abertas → 11 closed: #11 já estava OK, #12+14+15+17+18 em v3.74.0,
#9+10+13+16+19 nesta versão).

### #19 pg_cron schedules ATIVOS em prod
Migration `20260509100000_activate_pg_cron_schedules.sql` (Comitê aprovou):
- `lgpd-retencao-incidentes` 03:00 UTC
- `apply-retention-policy` 03:05 UTC
- `archive-expired-documents` 03:15 UTC
- `notify-review-approaching` 08:00 UTC
- `notify-review-overdue` 08:15 UTC
Idempotente via `DO $$ ... PERFORM cron.unschedule ... $$ + cron.schedule`.

### #13 Storage path-scoping
Migration `20260509000000_storage_path_scoping.sql`:
- DROP `storage_doc_insert_authenticated` (catch-all)
- Admin: insert/update qualquer path no bucket
- Non-admin: paths validados `<categoria-whitelist>/doc-*/v*/*` + bloqueia `..`
- DELETE: apenas admin

### #10 Progress role=progressbar
`src/design-system/components/ui/progress.jsx`: wrapper com `role=progressbar`
+ `aria-valuemin/max/now` + `aria-label` (fallback 'Progresso'). Resolve
inacessibilidade da BulkImportPage durante importação.

### #9 A11y modais focus trap
- Novo hook `src/hooks/useModalA11y.js`: focus trap, ESC handler, focus
  restore, initial focus. Reusável em qualquer modal createPortal manual.
- `NewVersionModal`: hook + `htmlFor` em 4 labels via `useId` + click-on-backdrop
- `AddResponsibleModal` (CentroGestaoPage): `role=dialog` + `aria-modal` +
  `aria-labelledby` + `aria-label` no botão X + hook a11y
- `DocumentoDetalhePage` Suspense fallback={null} → spinner com `role=status`
  (sem mais clique repetido em conexão lenta)

### #16 Test gaps
`src/__tests__/services/ocrService.test.js`: +4 testes cobrindo
- `worker.terminate()` throw → finally engole, erro original propaga
- `pdf.destroy()` throw → finally engole, sucesso retornado
- `AbortSignal` aborta entre páginas (`OCR aborted`)
- `AbortSignal` pré-iniciado bloqueia render

`watermark.js` já tinha 9 testes (audit reportou gap incorretamente).

### Smoke tests (3 scripts)
- `scripts/smoke-audit-v3-72-1.mjs`: 9/9 (RPCs, columns, policies)
- `scripts/smoke-pdfa-e2e.mjs`: 6/6 — fluxo completo (upload → arquivar →
  edge function → bucket → changelog) com cleanup
- `scripts/smoke-pg-cron.mjs`: confirmação via apply-success (PostgREST
  não expõe schema cron por default)

### Stats
- 805 testes verdes (+4)
- Build OK
- 7 migrations aplicadas em prod hoje (20260508* + 20260509*)
- 11/11 audit issues fechadas

## v3.74.0 (08/05/2026) — Sprint 7 quick wins + OCR retry-cap

5 issues do audit v3.72.0 fechadas (#11, #12, #14, #15, #17, #18 — #11 já estava
endereçada por code-split do Vite, fechada como duplicata).

### Quick wins (audit P1/P2)
- **#18** `fetchByCategory` + `fetchById` em `supabaseDocumentService.js`:
  trocam `select('*')` por `buildDocListColumns()` — evita trazer `ocr_text`
  desnecessário e fecha vetor de leak se RLS desabilitada temporariamente
- **#17** `BulkImportPage.jsx:339`: Select de tipo usa `onChange` (era
  `onValueChange` — handler nunca disparava per `padroes-codigo.md`)
- **#14** edge function `watermark-pdf`: insere `documento_changelog`
  action='downloaded' com IP real (`X-Forwarded-For`) + viewer email após
  stamp. Forensic gap fechado (era best-effort: falha não trava download)
- **#15** `useCentroGestaoDashboard.overdueDocuments`: usa `isOverdue()`
  canônico de `dateUtils` (era `new Date() < today`, com bug TZ que
  marcava docs `proximaRevisao=hoje` como vencidos às 03:00 SP);
  renomeada métrica `documentComplianceScore` → `documentActivenessRate`
  (com alias backcompat) porque mede taxa de docs vigentes, não score
  Qmentum ponderado. Label do PDF corrigida para "Taxa de Documentos Vigentes"

### Sprint 7 médio
- **#12** OCR AbortController + retry-cap:
  - Migration `20260508500000_ocr_fail_count.sql`: coluna
    `documentos.ocr_fail_count` + RPCs atômicos
    `rpc_increment_ocr_fail_count` / `rpc_reset_ocr_fail_count`
  - `markOcrFailed` incrementa atomicamente; `persistOcrResult` zera
    em sucesso
  - `useOcrPipeline.startOcr` checa `getOcrFailCount() >= 3` antes de
    iniciar (skip a menos que `force=true`). Novo status `RETRY_CAP`
  - `AbortController` em ref + cleanup em useEffect aborta worker
    Tesseract em unmount/re-run
  - `runOcr` aceita `opts.signal` e checa abort entre páginas

### Issue #11 fechada como já-resolvida
`xlsx` e `jspdf` já eram dynamic imports (`await import('jspdf')`); Vite
code-split cria chunks separados automaticamente (xlsx 142 kB, jspdf
125 kB, html2canvas 47 kB) on-demand.

### Smoke test pós-deploy
8/8 OK em `scripts/smoke-audit-v3-72-1.mjs`.

### Stats
- 801 testes verdes (+2 vs v3.73.2); 5 skipped pré-existentes
- Build OK
- 6 migrations aplicadas em prod hoje (20260508*)

## v3.73.2 (08/05/2026) — Audit fixes APLICADAS em prod + smoke 8/8

Migrations bloqueadas em sessões anteriores foram aplicadas em prod nesta
data (após `migration repair --status reverted 20260429000000` para
desvincular órfã `uptodate_topics`).

### Migrations aplicadas em prod
- `20260508000000_audit_v3_72_fixes.sql` — firebase_uid() em 11 policies de
  018/019 + WORM bypass via current_setting + retention_policies RLS +
  advance_approval_step text + qmentum INNER JOIN + bulk_import DELETE policy
  + seed prontuarios CFM 1.821/2007.
- `20260508100000_doc_pdfa.sql` — colunas pdfa_*, bucket documentos-pdfa,
  storage policies, RPC rpc_request_pdfa_conversion.
- `20260508200000_lgpd_anonymize_rpcs.sql` — rpc_anonymize_changelog_for_user
  (bypass WORM autorizado) + rpc_anonimizar_incidente_user (scrub PII JSONB).

### Hotfixes detectados via smoke test
- `20260508300000_fix_changelog_columns.sql` — RPCs do batch acima usavam
  `changed_by` no INSERT em documento_changelog, mas o schema real
  (001_schema.sql:145) tem `user_id` / `user_name` / `user_email`.
  CREATE OR REPLACE de advance_approval_step + rpc_request_pdfa_conversion.
- `20260508400000_fix_profiles_nome.sql` — COALESCE(p.nome, p.email)
  ao invés de `p.display_name` (coluna não existe; a real é `profiles.nome`
  per 018_profiles.sql).
- Edge function `pdfa-convert` redeployada com mesmas correções.

### Smoke test pós-migrations (`scripts/smoke-audit-v3-72-1.mjs`)
8/8 checks OK:
1. retention_policies seed prontuarios -1 anos
2. Coluna documentos.pdfa_status existe
3. RPC rpc_request_pdfa_conversion executa sem erro de coluna
4. RPC rpc_anonymize_changelog_for_user existe
5. RPC rpc_anonimizar_incidente_user existe
6. RPC advance_approval_step com p_documento_id text
7. Colunas ocr_status + bulk_import_id (Sprint 4/5)
8. rpc_compliance_score_qmentum retorna json com `score` + `categories`

### Lição aprendida
Migrations do batch v3.72.1 foram escritas sem leitura prévia do schema
canônico de `documento_changelog` e `profiles` — duas migrations de
hotfix necessárias em prod. Para Sprint 7+, antes de criar RPCs com
INSERT/UPDATE em tabelas existentes, validar nomes de colunas via grep
em `supabase/migrations/00*_schema.sql`.

## v3.73.1 (08/05/2026) — Audit followup (LGPD RPCs + lazy pages)

### LGPD (audit P1)
- Migration `20260508200000_lgpd_anonymize_rpcs.sql`:
  - `rpc_anonymize_changelog_for_user(text)` SECURITY DEFINER — bypass autorizado
    do trigger WORM, admin-only. Resolve 3.P1-2 (UPDATE direto era bloqueado).
  - `rpc_anonimizar_incidente_user(text)` SECURITY DEFINER — strip de PII keys
    (`nomePaciente`, `prontuario`, `cpf`, etc) de `incidente_data`/`denuncia_data`/
    `gestao_interna` (JSONB) + detach `user_id`. Resolve 3.P1-3 (ternário no-op
    anterior nunca apagava nada).
- `src/services/lgpdService.processSolicitacao`: chama os 2 RPCs.
- `console.error` no `requestDeletion` gateado por `import.meta.env.DEV` (audit P2-1).

### Build perf (audit P0)
- 5 páginas pesadas convertidas para `React.lazy()` em `App.jsx`:
  - BibliotecaPage, GestaoDocumentalPage, CentroGestaoPage, EducacaoPage, BulkImportPage.
- Suspense já existia no shell — sem refactor de fallback.
- Main bundle: 1069 → 1010 kB gzip (−58 kB).
- Novos chunks lazy: BibliotecaPage 5.05 kB, BulkImportPage 5.64 kB,
  CentroGestaoPage 52.83 kB.

### Issues criadas (P1/P2 não-bloqueantes deferred)
- #9 A11y modais focus trap (exige aprovação DS)
- #10 Progress role=progressbar (exige aprovação DS)
- #11 Dynamic xlsx + jspdf (Sprint 7+)
- #12 OCR AbortController + retry-cap
- #13 Storage path-scoping bucket documentos
- #14 watermark-pdf changelog 'downloaded'
- #15 Qmentum dashboard score divergente
- #16 Test gaps (watermark.js, ocrService finally)
- #17 BulkImportPage Select tipo onChange
- #18 fetchByCategory/fetchById select('*') → buildDocListColumns
- #19 pg_cron schedules retention/approval (Comitê de Ética)

### Stats
- 799 testes verdes mantidos
- Build OK
- 3 migrations pendentes apply em prod: 20260508000000, 20260508100000, 20260508200000

### Pendente — usuário precisa rodar em outra aba
```
npx supabase migration repair --status reverted 20260429000000 --linked
npx supabase db push --linked --include-all
```
(O `repair` desvincula a migration órfã `uptodate` que ficou no remote após
remoção do feature; o `push` aplica as 3 pendentes.)

## v3.73.0 (07/05/2026) — Sprint 6 / O2-3 PDF/A export

Pipeline server-side de geração de PDF/A para documentos arquivados.

### Migration `20260508100000_doc_pdfa.sql`
- Colunas `pdfa_status` (CHECK pending/processing/done/failed/not_needed),
  `pdfa_url`, `pdfa_processed_at`, `pdfa_pages`, `pdfa_size_bytes` em `documentos`
- Index parcial `idx_doc_pdfa_pending` (status='arquivado' AND pdfa_status='pending')
- 3 actions novas em `documento_changelog`: `pdfa_started`, `pdfa_generated`, `pdfa_failed`
- Bucket `documentos-pdfa` (privado, signed URLs apenas) + storage policies
- RPC `rpc_request_pdfa_conversion(text, text)` SECURITY DEFINER

### Edge function `pdfa-convert` (`supabase/functions/pdfa-convert/index.ts`)
- JWT verify HS256 (mesmo padrão de `watermark-pdf`)
- Download bucket origem → normaliza via `pdf-lib` + injeta XMP metadata
  declarando `pdfaid:part=2`/`conformance=B` → upload em `documentos-pdfa`
- Update documento + insert changelog
- Erro → marca `pdfa_status='failed'` + changelog `pdfa_failed`
- **Trade-off técnico:** pdf-lib é uma "PDF/A-readiness pass" — não é PDF/A-2b
  strict. Decidido por incompatibilidade do Deno Deploy com binários nativos
  (ghostscript). Para conformidade strict, futuro upgrade pode trocar a
  implementação sem mexer no schema/UI.

### Frontend
- `src/services/supabasePdfaService.js`: `requestPdfaConversion` + `getSignedPdfaUrl`
- `src/hooks/usePdfaPipeline.js`: hook fire-and-forget com cleanup unmount
- `src/components/PdfaStatusBadge.jsx`: badge dos 6 status canônicos (replica
  pattern do OcrStatusBadge — não é mudança DS)
- `DocumentoCard` + `DocumentMetadata`: badge gated por `isPdfaEnabled()`
- `archiveDocument`: dispara `rpc_request_pdfa_conversion` quando flag ON
- `buildDocListColumns` gateado por flag PDFA
- Mapping camelCase ↔ snake_case para 5 novas colunas

### Feature flag
`VITE_FEATURE_PDFA` default false. Ligar em prod após smoke test pós-migration.

### Stats
- 799 testes verdes (+27 vs v3.72.1); 5 skipped pré-existentes
- Build OK

### Pendente
- Apply migration via `npx supabase db push --linked --include-all`
  (permission engine bloqueou apply automatizado)
- Smoke test: arquivar doc → ver `pdfa_status='done'` + arquivo em bucket

## v3.72.1 (07/05/2026) — Audit P0/P1 fixes (segurança + integridade)

Auditoria de regressão pós-PR #5 (10 agentes paralelos) identificou 16 P0 + 29 P1.
Esta versão corrige os fixes seguros e bem-escopados; A11y/DS e perf ficam para
Sprint 7 (requerem aprovação DS).

### Migration 20260508000000_audit_v3_72_fixes.sql
- `018_profiles` + `019_comunicados`: substitui `auth.uid()::text` por
  `public.firebase_uid()` em 11 policies (eram sempre NULL com JWT customizado HS256)
- WORM bypass via `current_setting('role')` ao invés de claim JWT (claim era
  forjável; setting de sessão Postgres não é)
- `retention_policies` + `documento_changelog_archive`: ENABLE RLS + policies
- `advance_approval_step(p_documento_id text)`: era `uuid`, incompatível com
  `documento_approval_steps.documento_id text`. RPC nunca funcionou em prod.
  Acrescentado guard caller deve ser approver/admin + INSERT changelog ao avançar.
- `rpc_compliance_score_qmentum`: `INNER JOIN` (era `LEFT JOIN` com COALESCE 1.0,
  divergia silenciosamente do JS `computeQmentumScore`)
- `bulk_import_jobs`: nova policy DELETE admin-only
- `retention_policies`: seed `prontuarios` -1 anos (CFM 1.821/2007 — permanente)

### Frontend
- `App.jsx`: case `bulkImport` com guard `isBulkImportEnabled()` + admin (era
  acessível via `onNavigate('bulkImport')` direto)
- `bulkImportService`:
  - `MAX_FILES_PER_JOB = 200` (anti-DoS)
  - `validateBulkRow` rejeita MIME vazio (era bypass silencioso quando
    `file.type === ''`)
  - `processFile`: storage cleanup com `deleteFile(uploadedPath)` quando
    `createDocument` falha (eliminava blobs órfãos no bucket)
  - `processFile`: chama `logAction('bulk_imported', { bulk_import_job_id, ... })`
    (CHECK constraint já tinha o action; nunca era gravado)
  - `updateJobProgress`: aceita `errorEntries[]` (chamado uma vez por chunk,
    eliminando race RMW entre falhas paralelas em `error_log`)
- `pdfTextDetection.detectIfScanned`:
  - `try/finally` com `pdf.destroy()` em todos os caminhos
  - Captura `PasswordException` → retorna `{error:'encrypted'}` sem lançar
  - `try/catch` por página (corrupção não trava pipeline)
  - Heurística complementar: >50% páginas com pouco texto força `isScanned=true`
- `supabaseDocumentService`: export `logAction`

### Pendente (próxima sessão)
- Apply migration via `npx supabase db push --linked --include-all`
  (permission engine bloqueou apply automatizado)
- pg_cron schedules retention/approval (exigem ratificação Comitê de Ética)
- LGPD: RPC anonymize_changelog SECURITY DEFINER + rpc_anonimizar_incidente
- A11y P0 (NewVersionModal/AddResponsibleModal sem focus trap) — exige
  aprovação DS
- Build/perf: React.lazy páginas + dynamic xlsx/jspdf (Sprint 7)

### Stats
- 772 testes verdes (+7 vs v3.72.0); 5 skipped pré-existentes
- Build OK, sem novos erros
- 16 P0 → 8 corrigidos; 8 deferred com motivo documentado

Auditoria completa em `docs/audit-v3.72.0.md`.

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

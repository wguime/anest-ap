# Auditoria de Regressão — ANEST v3.72.0

**Data:** 2026-05-07
**Branch:** main (commit `10f8c39`)
**Escopo:** PR #5 mergeado (Wave 3 + Onda 1 + Sprint 4 OCR + Sprint 5 Bulk Import + DS reverts)
**Método:** 10 agentes paralelos (code-reviewer + Explore) cobrindo eixos independentes

## Sumário Executivo

| Eixo                          | P0 | P1 | P2 | P3 |
|-------------------------------|----|----|----|----|
| 1. RLS + Segurança Supabase   | 3  | 4  | 4  | 3  |
| 2. Audit Trail                | 1  | 2  | 1  | 1  |
| 3. LGPD                       | 2  | 3  | 2  | 3  |
| 4. Qmentum scoring            | 1  | 2  | 1  | 1  |
| 5. UX P0 / A11y               | 2  | 3  | 1  | 1  |
| 6. DMS Onda 1                 | 2  | 2  | 2  | 2  |
| 7. OCR pipeline Sprint 4      | 1  | 3  | 2  | 2  |
| 8. Bulk Import Sprint 5       | 2  | 4  | 2  | 1  |
| 9. Build / chunking           | 2  | 3  | 2  | 1  |
| 10. Test coverage             | 0  | 3  | 2  | 1  |
| **TOTAL**                     | **16** | **29** | **19** | **16** |

### Decisão de remediação

- **P0/P1 críticos para fix imediato (v3.72.1):** 8 itens (segurança + integridade audit + cron retention)
- **P0/P1 não-bloqueantes para Sprint 6:** 5 itens (build size, watermark cleanup, etc.)
- **P2/P3:** documentados aqui + GitHub issues a criar; não interrompem Sprint 6

Ver seção "Plano de Remediação" no fim do documento.

---

## 1. RLS + Segurança Supabase

### P0
- **[P0-1]** `supabase/functions/notify-incident/index.ts:120` aceita chamadas anônimas sem validar Bearer token. Agente externo pode forjar emails de incidente. **Fix:** adicionar `verifyBearer(req.headers.get('authorization'))` (mesmo padrão de `watermark-pdf`).
- **[P0-2]** `supabase/migrations/018_profiles.sql:80,87,94,104,110,120,127,134` usa `auth.uid()::text` em 9 policies, mas o JWT customizado HS256 não popula `auth.uid()`. Policies sempre falsas → `profiles_insert/update/delete`, `auth_emails_insert/delete`, `inc_notif_*` quebradas. **Fix:** substituir todos por `public.firebase_uid()`.
- **[P0-3]** `supabase/migrations/019_comunicados.sql:109,117` (com_conf_insert, com_acoes_insert) idem — `auth.uid()::text = user_id` sempre falso, bloqueia confirmações de leitura. **Fix:** trocar por `public.firebase_uid() = user_id`.

### P1
- **[P1-1]** `supabase/migrations/20260221194522_lgpd_and_audit.sql:42-43` policy "Anon can insert LGPD requests" com `WITH CHECK (true)`. Qualquer agente anônimo cria solicitação com user_id arbitrário. **Fix:** restringir via RPC SECURITY DEFINER.
- **[P1-2]** `supabase/migrations/20260221194522_lgpd_and_audit.sql:77-80` policy anon em `permission_audit_log`. Migration `20260504100200` removeu, mas confirmar via `SELECT * FROM pg_policies WHERE tablename='permission_audit_log' AND roles='{anon}'` em prod.
- **[P1-3]** `supabase/migrations/20260505500000_worm_changelog.sql:15-17` lê `request.jwt.claims->>'role'` para detectar service_role. JWT forjado com `"role":"service_role"` contorna o WORM. **Fix:** trocar por `current_setting('role', true) = 'service_role'`.
- **[P1-4]** `supabase/migrations/20260505400000_retention_legal_hold.sql:34` tabela `retention_policies` sem RLS habilitado. **Fix:** `ALTER TABLE public.retention_policies ENABLE ROW LEVEL SECURITY` + policies SELECT authenticated, IUD admin-only.

### P2
- **[P2-1]** `documento_changelog_archive` (worm_changelog migration:42-44) sem RLS.
- **[P2-2]** `storage_doc_insert_authenticated` em 20260504100000:44 sem path-scoping no bucket — uploads podem sobrescrever paths de outros users.
- **[P2-3]** `advance_approval_step` SECURITY DEFINER (multi_step_approval:132) sem validar caller. Qualquer authenticated avança step de qualquer doc. **Fix:** adicionar guard `firebase_uid() != ANY(approver_ids) AND NOT is_admin() RAISE EXCEPTION`.
- **[P2-4]** `notify-incident:14` CORS `*` (vs `anest-ap.web.app` nas outras edge fns).

### P3
- **[P3-1]** `get-supabase-token` cache Google certs fixo em 1h, ignora `Cache-Control` da resposta.
- **[P3-2]** `025_rpc_create_profile.sql:54` GRANT pra anon — auditar uso real.
- **[P3-3]** `prevent_self_approval` permite pre-staging com action='pending'.

---

## 2. Audit Trail

### P0
- **[P0-1]** `src/services/bulkImportService.js:161-217` JSDoc promete action `'bulk_imported'` mas `processFile` só chama `createDocument` (que loga `'created'`). Migration adicionou CHECK pra `bulk_imported` mas nunca é gravado. **Fix:** após `createDocument`, chamar `logAction(docId, 'bulk_imported', { jobId, file })`.

### P1
- **[P1-1]** `supabase/migrations/20260505600000_multi_step_approval.sql:76-132` RPC `advance_approval_step` não insere em `documento_changelog`. Step transitions são silent. **Fix:** INSERT changelog com `current_setting('request.jwt.claims',true)::jsonb->>'sub'` como changed_by.
- **[P1-2]** `supabase/functions/watermark-pdf/index.ts` valida JWT, tem docId, service-role client, mas nunca grava `'downloaded'` no changelog. **Fix:** insert no changelog após `stampPdf` com `auth.sub` + IP + email.

### P2
- **[P2-1]** `restoreDocument` (line 670) e `restoreFromTrash` (line 720) duplicação — consolidar para evitar inconsistência em `deleted_at/deleted_by` cleanup.

### P3
- **[P3-1]** `archive_old_changelog` SECURITY DEFINER bypass do WORM — adicionar COMMENT documentando.

---

## 3. LGPD

### P0
- **[P0-1]** Cron `lgpd-retencao-incidentes` e `apply-retention-policy` **comentados** em prod (migrations 20260504000001:139, 20260505400000:177). Documentos vencidos acumulam → violação LGPD Art. 15. **Fix:** rodar `cron.schedule(...)` manualmente após ratificação Comitê de Ética.
- **[P0-2]** `ocr_text` (migration 20260506100000:29,50) é coluna em `documentos` indexada no FTS global com weight D. RPCs como `rpc_match_documents` projetam `ocr_text` em texto plano — PII (nomes pacientes, CRMs, CPFs) extraída de scans pode vazar via busca. **Fix:** mascarar `ocr_text` em RPCs públicas ou aplicar RLS adicional.

### P1
- **[P1-1]** `retention_policies` (20260505400000:51-61) sem entrada para `prontuarios` (CFM 1.821/2007 - 20a/permanente). **Fix:** seed `('prontuarios', -1, ...)`.
- **[P1-2]** `processSolicitacao` em `src/services/lgpdService.js:329` faz UPDATE em `documento_changelog` com role authenticated — bloqueado pelo WORM trigger. **Fix:** RPC `rpc_anonymize_changelog_for_user(p_user_id) SECURITY DEFINER`.
- **[P1-3]** `src/services/lgpdService.js:302-309` ternário `supabase.rpc ? undefined : null` é no-op — PII em `incidente_data`/`denuncia_data`/`gestao_interna` JSONB nunca é apagada. **Fix:** `await supabase.rpc('rpc_anonimizar_incidente', { p_id })`.

### P2
- **[P2-1]** `console.error` em `lgpdService.js:237` loga objeto `error` completo no client-side. **Fix:** logar apenas `error.code/message` + gate `import.meta.env.DEV`.
- **[P2-2]** Bulk import sem campo `default_confidentiality_level` no job — admin reclassifica manualmente após import.

### P3
- **[P3-1]** DPO não nominado em ata (`docs/lgpd-ripd-incidentes.md:24`).
- **[P3-2]** `lgpd_consent_version` não implementado — sem re-aceite em mudanças de política.
- **[P3-3]** WORM cobre apenas `documento_changelog` — não conflita com direito de exclusão das outras tabelas.

---

## 4. Qmentum scoring

### P0
- **[P0-1]** `supabase/migrations/20260505200000_unify_qmentum_weights.sql:99-100,105` RPC `rpc_compliance_score_qmentum` usa `LEFT JOIN ... COALESCE(w.weight, 1.0)` — categoria desconhecida pesa 1.0 no SQL mas é ignorada no JS (`computeQmentumScore` continue). Scores divergem silenciosamente. **Fix:** trocar por `INNER JOIN`.

### P1
- **[P1-1]** `src/hooks/useCentroGestaoDashboard.js:200-205` `overdueDocuments` usa `new Date(reviewDate) < today` sem normalização TZ. Diverge de `useComplianceMetrics.isRevisaoVencida`. **Fix:** importar `isOverdue` de `@/utils/dateUtils`.
- **[P1-2]** `src/hooks/useCentroGestaoDashboard.js:218-225` `documentComplianceScore = vigentes/activeDocs * 100` é fórmula diferente do `complianceScore` global. Mesmo rótulo no PDF (`centroGestaoReportTemplate.js:340`). **Fix:** renomear para `documentActivenessRate` ou alinhar.

### P2
- **[P2-1]** SSOT pesos: frontend hardcoded em `src/types/documents.js:260-270`, não lê da tabela. Risco de drift se admin mudar via dashboard. **Fix:** Wave 2 implementar `useQmentumWeights()` runtime.

### P3
- **[P3-1]** Zero testes para `computeQmentumScore`/`computeCategoryCompliance`/`computeReviewComplianceRate`. Edge cases sem cobertura: todos categorias vazias, divisão por zero, todos vencidos.

---

## 5. UX P0 / A11y

### P0
- **[P0-1]** `src/pages/DocumentoDetalhePage/modals/NewVersionModal.jsx:101-249` usa `createPortal` manual sem focus trap, sem ESC, sem focus restore. **Fix:** migrar para DS `<Modal>` (mesmo padrão de EditDocumentModal/ArchiveDocumentModal).
- **[P0-2]** `src/pages/management/CentroGestaoPage.jsx:110-124` `AddResponsibleModal` sem `role="dialog"`, sem `aria-modal`, sem aria-labelledby, sem focus trap. Botão X sem `aria-label`. **Fix:** atributos ARIA + ESC handler ou migrar para DS Modal.

### P1
- **[P1-1]** `src/design-system/components/ui/progress.jsx:76` sem `role="progressbar"`/aria-value*. BulkImportPage:382 inacessível durante importação. **Fix:** adicionar role + aria-valuemin/max/now ao wrapper. **NOTA: alteração DS — pedir aprovação ao usuário antes**.
- **[P1-2]** `NewVersionModal.jsx:135-183` 4 `<label>` sem `htmlFor`. **Fix:** adicionar id/htmlFor.
- **[P1-3]** `src/pages/DocumentoDetalhePage/index.jsx:239,255,277` `Suspense fallback={null}` em modais lazy — clique repetido em conexão lenta. **Fix:** spinner com `role="status"`.

### P2
- **[P2-1]** `CentroGestaoPage` sem skeleton em loading (vs BibliotecaPage).

### P3
- **[P3-1]** `main.jsx:41-55` ErrorBoundary inline com hex hardcoded (#111916/#2ECC71/#ff6b6b). Trade-off conhecido pós-revert DS. Em modo claro inverte legibilidade. **Fix:** Tailwind tokens `bg-background text-foreground` ou aplicar `dark` class explícito. **NOTA: alteração DS — pedir aprovação**.

---

## 6. DMS Onda 1

### P0
- **[P0-1]** `supabase/migrations/20260505600000_multi_step_approval.sql:76` RPC declarada com `p_documento_id uuid` mas `documento_approval_steps.documento_id text` (já documentado em MEMORY.md). Postgres rejeita com 42883. RPC nunca funciona em prod. **Fix:** alterar assinatura para `p_documento_id text` em todas ocorrências.
- **[P0-2]** pg_cron de retention/aprovações **comentados** nas migrations (20260505400000:166-190, 20260505600000:239-241). Documentos não arquivam, revisores não notificados. **Fix:** rodar `SELECT cron.schedule(...)` manualmente em SQL editor após Comitê.

### P1
- **[P1-1]** `submitApproval` (`src/services/supabaseDocumentService.js:1302-1312`) registra hash em `documento_aprovacoes`, não em `documento_signature_extra`. Spec/CLAUDE.md citam tabela separada — confirmar consistência.
- **[P1-2]** WORM bypass via `current_setting('request.jwt.claims')` aceita JWT forjado com `role:'service_role'`. Duplica P1-3 da seção 1.

### P2
- **[P2-1]** `fetchByCategory` (262), `fetchById` (276) em `supabaseDocumentService.js` usam `select('*')` — trazem `ocr_text` desnecessário. Se RLS desabilitada temporariamente, leak. **Fix:** usar `buildDocListColumns()`.
- **[P2-2]** `canAccessConfidentiality` em `confidentiality.js:61-64` não chamada antes de render — depende 100% da RLS. JWT cacheado pré-migration sem clearance_level cai em default 'interno'. **Fix:** garantir `get-supabase-token` injeta `clearance_level` em todos JWTs.

### P3
- **[P3-1]** `PDFViewerWithWatermark.jsx:80-88` cleanup de blob URL não roda no path de erro — memory leak leve.
- **[P3-2]** `approvalReducer:43-46` state machine cliente colapsa multi-step em uma transição. UI otimista pode flicker.

---

## 7. OCR pipeline Sprint 4

### P0
- **[P0-1]** `src/utils/pdfTextDetection.js` `detectIfScanned` sem try/catch — `pdfjsLib.getDocument({data}).promise` lança `PasswordException` em PDFs criptografados, `getTextContent()` em páginas corrompidas. PDF aberto não destruído (sem finally). **Fix:** envolver em try/finally + capturar PasswordException → retornar `{isScanned:false, error:'encrypted'}`.

### P1
- **[P1-1]** `src/hooks/useOcrPipeline.js:36-142` sem `AbortController` — `runIdRef` impede setState após unmount mas worker Tesseract continua processando. **Fix:** AbortSignal em `runOcr` + cleanup com `abort()`.
- **[P1-2]** `src/services/supabaseDocumentService.js:852-854` `markOcrPending` não loga changelog. Confirmar se `'ocr_pending'` deve existir; se sim, adicionar ao CHECK.
- **[P1-3]** Sem retry-cap. Coluna `ocr_fail_count` ausente. **Fix:** adicionar coluna + incrementar em `markOcrFailed` + checar `>=3` antes de retry.

### P2
- **[P2-1]** `src/components/DocumentoCard.jsx:13-14` `showOcrBadge` só mostra `pending/processing/failed` — esconde `done/not_needed`. `DocumentMetadata:49` mostra qualquer não-nulo. Inconsistência.
- **[P2-2]** `_setOcrStatus:831-833` sobrescreve `ocr_run_at` em `pending` — polui campo com timestamp de enqueue.

### P3
- **[P3-1]** `pdfTextDetection.js:90-91` heurística por média — PDF híbrido (9 scan + 1 texto rico) classificado erroneamente. **Fix:** complementar com `pagesWithLittleText.length / totalPages > 0.5`.
- **[P3-2]** `workerConfigured` global duplicado entre `pdfTextDetection.js` e `ocrService.js`.

---

## 8. Bulk Import Sprint 5

### P0
- **[P0-1]** `bulkImportService.js` sem `MAX_FILES_PER_JOB`. Admin pode submeter 10k arquivos → DoS. **Fix:** `const MAX_FILES_PER_JOB = 200` + check em `processBulkImport`.
- **[P0-2]** `bulkImportService.js:77-87` `updateJobProgress` race condition read-modify-write em `error_log`. 5 falhas paralelas no mesmo chunk se sobrescrevem. **Fix:** RPC com `jsonb_array_append` atômica, ou acumular por chunk.

### P1
- **[P1-1]** `App.jsx:698-699` `case 'bulkImport'` sem guard de admin nem flag. UI bloqueia, RLS cobre, mas falta dupla checagem. **Fix:** envolver com `if (!isBulkImportEnabled() || !isAdministrator(currentUser)) return <AccessDeniedPage>`.
- **[P1-2]** Changelog `'created'` em vez de `'bulk_imported'` (duplica seção 2 P0-1). **Fix:** chamar `logAction(docId, 'bulk_imported', {bulk_import_job_id: jobId})` após `createDocument`.
- **[P1-3]** `bulkImportService.js:175-199` storage leak quando `createDocument` falha após `uploadFile`. Bucket acumula objetos órfãos. **Fix:** no catch de processFile, `deleteFile(uploaded?.path)` com try interno.
- **[P1-4]** `bulkImportService.js:121` validação MIME pula quando `file.type === ''` (alguns SOs/browsers para PDFs). **Fix:** trocar `&& file.type &&` por `file.type !== 'application/pdf'`.

### P2
- **[P2-1]** `BulkImportPage.jsx:339` Select usa `onValueChange` (vs `onChange` na linha 330). DS canônica é `onChange`. Handler nunca dispara.
- **[P2-2]** `20260507100000_bulk_import.sql` sem policy DELETE em `bulk_import_jobs`. Admin não consegue cancelar/deletar via cliente.

### P3
- **[P3-1]** Sem retry/backoff em arquivo individual (timeout/503 → failed direto).

---

## 9. Build / chunking

### P0
- **[P0-1]** Main bundle `index-CXAytUUS.js` 1.06 MB gzip — `src/App.jsx:1-100` importa 317 páginas estaticamente. **Fix:** React.lazy() em BibliotecaPage, GestaoDocumentalPage, CentroGestaoPage, EducacaoPage, BulkImportPage.
- **[P0-2]** `pdf-viewer-Cif4vBwm.js` 128 KB gzip / 433 KB raw — pdfjs-dist no main bundle. **Fix:** lazy-load PDFViewerWithWatermark apenas ao abrir doc.

### P1
- **[P1-1]** `xlsx-CNerDvZX.js` 142.94 KB gzip — importado static em RelatoriosPage/FinanceiroPage. **Fix:** dynamic `await import('xlsx')` em handler de export.
- **[P1-2]** `jspdf.es.min` 125.83 KB gzip + html2canvas. **Fix:** lazy ao clicar Exportar PDF.
- **[P1-3]** `vendor-supabase` 45 KB gzip + Firebase SDK ainda presente (35 imports `firebase/*`). **Fix:** auditar imports Firebase desnecessários pós-migração.

### P2
- **[P2-1]** `vendor-ui` 197.69 KB gzip — `lucide-react` (317 ocorrências) + framer-motion. Tree-shaking funciona mas vendor pesado.
- **[P2-2]** Tesseract WASM via CDN tesseract.js — confirmar lazy on-demand.

### P3
- **[P3-1]** ✓ DocumentoDetalhePage W3-2 chunks confirmados (EditDocumentModal/NewVersionModal/ArchiveDocumentModal lazy).

---

## 10. Test coverage

**Status atual: 765 verdes, 5 skipped pré-existentes (justificados), 67 .test.* files, suite verde.**

### P0
- Nenhum.

### P1
- **[P1-1]** `src/services/ocrService.js:160-171` finally cleanup — worker.terminate() timeout/double-destroy não testado.
- **[P1-2]** `src/utils/watermark.js` zero testes. **Fix:** criar `src/__tests__/utils/watermark.test.js` (canvas injection, coordinates, memory cleanup).
- **[P1-3]** `bulkImportService.js:34-36` `handleError` nunca testa erro em `updateJobProgress` (PGRST116 + merge log).

### P2
- **[P2-1]** Mock drift risk em `bulkImportService.test.js:80-88` — chain thenable genérico, divergência potencial com schema.
- **[P2-2]** `useOcrPipeline.test.jsx:82-119` não valida ordem `markOcrPending` → `markOcrProcessing`.

### P3
- **[P3-1]** 5 skips em `educacaoService.firebase.test.js:107,133,141,188,375` — todos têm TODO comments válidos. Sugestão: data "skipped_until: Sprint X".

---

## Plano de Remediação

### Fix imediato (v3.72.1) — Bloqueantes

Branch `fix/audit-v3.72.0` a partir de `main`. Commits semânticos.

1. **[Sec-1]** notify-incident Bearer auth (1.P0-1)
2. **[Sec-2]** firebase_uid() em 018_profiles + 019_comunicados (1.P0-2, 1.P0-3)
3. **[Sec-3]** WORM bypass via current_setting role (1.P1-3 / 6.P1-2)
4. **[Sec-4]** retention_policies RLS habilitado (1.P1-4)
5. **[DMS-1]** advance_approval_step text (não uuid) (6.P0-1)
6. **[Audit-1]** action 'bulk_imported' em bulkImportService (2.P0-1 / 8.P1-2)
7. **[OCR-1]** detectIfScanned try/catch + finally (7.P0-1)
8. **[BI-1]** MAX_FILES_PER_JOB + race em error_log + storage cleanup (8.P0-1, 8.P0-2, 8.P1-3)

### LGPD (v3.72.1 ou separado)

9. **[LGPD-1]** Cron retention manual (3.P0-1, 6.P0-2 — exige Comitê)
10. **[LGPD-2]** RPC anonymize_changelog SECURITY DEFINER (3.P1-2)
11. **[LGPD-3]** rpc_anonimizar_incidente (3.P1-3)

### A11y (Sprint 7 — exige aprovação DS)

- Modais NewVersionModal/AddResponsibleModal: pedir aprovação para migração ao DS Modal.
- Progress role/aria-value: pedir aprovação DS.
- ErrorBoundary tokens: pedir aprovação DS.

### Build / Performance (Sprint 7)

- React.lazy páginas + dynamic xlsx/jspdf — não-bloqueante.

### P2/P3

- Documentar aqui (este arquivo) + abrir issues GitHub para não-bloqueantes (tracking).

---

## Notas

- Trade-off contraste de borda WCAG 1.4.11 (1.27:1) é **decisão consciente** documentada em CHANGELOG.md, não conta como P0.
- 5 testes skipped têm TODO comments válidos refletindo refatoração arquitetural — aceitável.
- Migrações antigas com `auth.uid()` foram corrigidas em parte por migrations posteriores; verificar consistência em prod via `pg_policies`.

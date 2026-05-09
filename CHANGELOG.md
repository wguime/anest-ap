# CHANGELOG — ANEST

> Histórico antigo arquivado em `docs/archive/CLAUDE_CONTEXT-root-2026-03-09.md`.
> Para versões futuras: `git log` é a fonte autoritativa.

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

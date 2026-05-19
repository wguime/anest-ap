---
  ═══════════════════════════════════════════════════════════════════════════════
    WAVE 1.9 — CUTOVER FIREBASE→SUPABASE + CLEANUP DEPRECATED + AUDIT TRAIL + HARDENING
  ═══════════════════════════════════════════════════════════════════════════════

  Working dir: /Users/guilherme/Documents/IA/ANEST V2
  Projeto: ANEST v5.3.0 → v5.4.0 — React 19.2 + Vite 7 + Tailwind 3.4 + Firebase + Supabase (RLS via JWT HS256)
  HEAD esperado em origin/main: commit 729317e (squash Wave 1.8 mergeado 2026-05-19) ou mais recente.
  Prod: https://anest-ap.web.app (Wave 1.8 live; cert PDF dual-write Firebase+Supabase, signed URL TTL=300s via Edge `get-cert-download-url`).
  **Janela operacional: SÓ rodar com data ≥ 2026-05-26 (1 semana de soak Wave 1.8 completo).**

  ═══════════════════════════════════════════════════════════════════════════════
    CONTEXTO — POR QUE ESTA WAVE EXISTE
  ═══════════════════════════════════════════════════════════════════════════════

  Wave 1.8 migrou cert PDF Firebase→Supabase private com dual-write + on-demand backfill — rollback safe
  durante 1 semana. Wave 1.9 finaliza o cutover e fecha as 9 pendências documentadas:

  1. Parar dual-write Firebase em `emitirCertificado` (cert nasce só no Supabase)
  2. Tornar Supabase upload obrigatório (`falha = throw`, não silent log)
  3. Remover fallback `downloadCertificate` (Firebase URL antiga) em CertificadosPage
  4. Deletar bucket Firebase Storage `certificados/` (após verify=100% migrados)
  5. Remover `getCertificatePdfUrl` (@deprecated desde Wave 1.8)
  6. Deletar `mockCategorias` em `educacaoUtils.js` (soak ends 2026-05-26)
  7. Audit trail server-side de download de cert (LGPD Art. 18 portabilidade)
  8. Hardening `public.firebase_uid()`: `SECURITY DEFINER set search_path = public, pg_temp`
  9. Fix HMAC ordering: re-upload Supabase pós-HMAC para PDF do bucket bater com Firestore signature

  ═══════════════════════════════════════════════════════════════════════════════
    🔴 CONSTRAINTS DUROS — REPITA PARA TODO AGENTE QUE DESPACHAR
  ═══════════════════════════════════════════════════════════════════════════════

  1. **ZERO modificações em `src/pages/HomePage.jsx`.** Verificar `git diff origin/main -- src/pages/HomePage.jsx | wc -l == 0` antes de PR.
  2. **NÃO deletar bucket Firebase ANTES de** `verify-cert-backfill.mjs --verify` retornar `pending=0`. Cert com `supabaseMigrated:false` perde acesso permanente se bucket Firebase apagado.
  3. **Stop Firebase write requer verify funcional.** Ordem obrigatória: (a) script verify funcional → (b) stop dual-write em commit → (c) force-backfill remaining → (d) verify=100% → (e) delete bucket em commit separado com aprovação manual.
  4. **NÃO faça refactor oportunista.** Tarefas fora do plano vão para issues separadas (Wave 2.0+).
  5. **Secrets: NUNCA leia `.env*`.** Nenhum secret novo necessário — todas as funções reusam JWT_SECRET/SUPABASE_SERVICE_ROLE_KEY já configurados.
  6. **HMAC fix é separado do cutover.** Pode ser implementado independente; não acoplar.
  7. **firebase_uid() hardening usa `CREATE OR REPLACE`**, não `DROP CASCADE` — preservar policies dependentes.

  ═══════════════════════════════════════════════════════════════════════════════
    PASSO 0 — SETUP (sequencial, 2 minutos)
  ═══════════════════════════════════════════════════════════════════════════════

  ```bash
  date +%Y-%m-%d                               # CONFIRMAR ≥ 2026-05-26
  git checkout main && git fetch origin && git pull --ff-only origin main
  git log -1 --format='%h %s'                  # deve mostrar ≥ 729317e (Wave 1.8 merge)
  git stash list                               # WIP de noticias preservado (NÃO descartar)
  git checkout -b wave-1.9-storage-cutover-cleanup
  ```

  **Gate de data:** se `date +%Y-%m-%d` < `2026-05-26`, PARAR. Soak da Wave 1.8 incompleto.
  Se `pull --ff-only` falhar, PARAR. Não force-merge.

  ═══════════════════════════════════════════════════════════════════════════════
    FASE 1 — PRE-FLIGHT PARALELO (4 agentes em UMA mensagem)
  ═══════════════════════════════════════════════════════════════════════════════

  Despache em paralelo. Cada agente devolve em ≤500 palavras com paths + line numbers.

  **AGENT 1 — Backfill state em produção** (subagent_type: Explore, breadth: very thorough)

  ```
  Em ANEST V2, descubra para Wave 1.9 cutover Firebase→Supabase:
  (a) Schema atual educacao_certificados em Firestore (depois Wave 1.8): listar todos
      os campos, focando em supabaseMigrated, supabaseMigratedAt, arquivoUrl, 
      assinaturaHMAC, signatureVersion. Quais são opcionais vs obrigatórios?
  (b) Existe Firebase Admin SDK script no projeto que conta docs em Firestore?
      Listar scripts/*.mjs com Firebase Admin. Como autenticam (SA file via env)?
  (c) scripts/deploy-sp21-mgmt-api.mjs como faz auth — Supabase mgmt API com PAT?
      Trace o flow. Pode ser modelo para o verify script.
  (d) Existe Edge function ou RPC server-side para forçar backfill de cert
      específico? Se não, qual é o melhor approach: client-side em loop (lento) ou
      Edge fn nova (rápida + atômica)?
  (e) Storage Firebase bucket name + caminho exato do diretório de certs.
      Confirmar: `gs://anest-ap.firebasestorage.app/certificados/{certId}.pdf`?
      Como apagar via Firebase Admin SDK (deleteFile/bulkDelete)?
  (f) Quantos certs estão em estado migrado vs pending HOJE? Use Firebase MCP se 
      disponível OU sugira script para o user rodar.
  ```

  **AGENT 2 — Mapping deprecated code para remoção segura** (subagent_type: Explore)

  ```
  Em ANEST V2, audite remoção segura na Wave 1.9:
  (a) src/pages/educacao/utils/certificateGenerator.js: 
      - getCertificatePdfUrl (linha 17-20, @deprecated Wave 1.8) — callers?
      - uploadCertificatePDF (linha 331-350) — callers?
      - downloadCertificate (linha 358-368) — callers?
      - openCertificate (linha 375-383) — callers?
      - generateCertificatePDF (linha 297-322) — MANTER (gera blob, ainda usado em 
        emitirCertificado dual-write). Confirmar não há outros consumers.
      Grep recursivo em src/. Para cada função, listar arquivo:linha + decisão 
      (deletar | manter | substituir por X).
  (b) src/pages/educacao/CertificadosPage.jsx:
      - linha ~108 (uploadCertificatePDF call durante emissão) — remover?
      - linha ~151 (handleDownload com fallback) — remover fallback try/catch?
      - Outros call-sites de downloadCertificate ou getCertificatePdfUrl?
  (c) src/pages/educacao/data/educacaoUtils.js mockCategorias — listar consumidores 
      restantes:
      - src/hooks/useEducacao.js:8, 132, 138 (Wave 1.8 confirmou)
      - src/pages/educacao/EducacaoContinuadaPage.jsx:15, 264, 893
      - src/pages/educacao/admin/CursoFormModal.jsx:10, 131
      - src/pages/educacao/data/mockEducacaoData.js (cópia duplicada em :150)
      Reportar: useCategorias hook está estável? Migration breakings esperadas?
  (d) Tests que referenciam essas funções: src/__tests__/ recursivo. Listar 
      asserts que precisam atualizar.
  ```

  **AGENT 3 — Audit trail download model + DB schema** (subagent_type: Explore)

  ```
  Em ANEST V2, para Wave 1.9 implementar audit trail server-side de download cert:
  (a) Existe tabela educacao_logs em Supabase? Schema completo, RLS, índices.
      Se não existe, qual é a canônica (audit_logs? user_actions? user_activity_log?).
      Reportar schema + grep "create table" em supabase/migrations/.
  (b) Edge functions que inserem em audit table: snippet de como fazer insert via 
      service_role client. Modelos: sign-cert? verify-cert-uuid-public?
  (c) Para download de cert, campos sugeridos:
      { user_id, cert_id, action: 'cert_download_signed', timestamp, ip, user_agent }
      — quais já existem na tabela canônica? RLS permite SELECT do próprio audit log?
  (d) Padrão LGPD: o audit log de download é dado pessoal? Como reter (retention 
      policy)? Wave 1.7/1.8 setup já cobre? Consultar rule .claude/rules/lgpd.md.
  ```

  **AGENT 4 — firebase_uid() hardening** (subagent_type: Explore + migration-validator preview)

  ```
  Em ANEST V2 supabase/migrations/002_rls.sql linhas 10-17:
  (a) Reportar a definição EXATA de public.firebase_uid() (CREATE FUNCTION snippet).
      É STABLE? IMMUTABLE? VOLATILE? Tem SECURITY DEFINER? Tem set search_path?
  (b) Mesmo para public.is_admin() — comparar (Wave 1.8 audit indicou is_admin é 
      SECURITY DEFINER, firebase_uid não é).
  (c) Listar TODAS as policies/views/triggers que dependem de firebase_uid() — 
      grep recursivo em supabase/migrations/. Qual o risco se fizermos 
      CREATE OR REPLACE FUNCTION com search_path mudado?
  (d) Padrão Supabase doc para SECURITY DEFINER functions consultando current_setting:
      precisa permissão GRANT EXECUTE? Validar com docfork MCP se disponível.
  (e) Migration template para Wave 1.9 (T1.9.7) com idempotência e rollback safety. 
      Snippet pronto.
  ```

  ═══════════════════════════════════════════════════════════════════════════════
    FASE 2 — DECISÕES via AskUserQuestion (sequencial, 1 chamada)
  ═══════════════════════════════════════════════════════════════════════════════

  3 questões em uma única AskUserQuestion:

  **D1. Estratégia de cutover Firebase write**
  - (Recomendada) "Verify-script-first": rodar `verify-cert-backfill.mjs --verify`; se pending>0, 
    forçar backfill server-side; depois verify=0; depois stop dual-write em commit; depois bucket delete em commit separado.
  - "Soft cutover atomic": stop dual-write + force-backfill no mesmo commit, sem janela manual.
  - "Hard cutover sem verify": atomic stop + delete imediato (alto risco).

  **D2. Audit trail download de cert**
  - (Recomendada) Edge `get-cert-download-url` insere server-side via service_role (não-bypassable; 
    LGPD Art. 18 portabilidade rastreada).
  - Client-side em `educacaoService.getCertificadoSignedUrl` (simples; bypassable se cliente 
    modificado — não ideal para LGPD).
  - Defer para Wave 2.0.

  **D3. Firebase Storage bucket cleanup**
  - (Recomendada) Script `delete-firebase-cert-bucket.mjs --dry-run/--apply` com aprovação 
    explícita via AskUserQuestion antes do delete real (lista N arquivos a apagar).
  - Manual via Firebase Console UI.
  - Defer indefinidamente (bucket dormente — risco mínimo, custo storage).

  ═══════════════════════════════════════════════════════════════════════════════
    FASE 3 — TASK CREATION + 3 PARALLEL IMPLEMENTATION TRACKS
  ═══════════════════════════════════════════════════════════════════════════════

  Crie 10 tasks via TaskCreate (T1.9.1 a T1.9.10):

  - T1.9.1 — Script `verify-cert-backfill.mjs` (Firebase Admin SDK; lista pending)
  - T1.9.2 — Cutover: stop dual-write Firebase + supabase upload obrigatório
  - T1.9.3 — Remove deprecated: getCertificatePdfUrl, uploadCertificatePDF, downloadCertificate, fallback CertificadosPage
  - T1.9.4 — Force-backfill server-side dos pending (Edge fn ou script Admin SDK)
  - T1.9.5 — Delete mockCategorias + migrar 4 consumers para useCategorias
  - T1.9.6 — Audit trail download em Edge `get-cert-download-url` (insert server-side)
  - T1.9.7 — Migration `firebase_uid` SECURITY DEFINER + search_path
  - T1.9.8 — Fix HMAC ordering em `emitirCertificado` (Supabase upload pós-HMAC)
  - T1.9.9 — Script `delete-firebase-cert-bucket.mjs` (--dry-run/--apply) + aprovação user
  - T1.9.10 — CHANGELOG bump v5.4.0 + atualizar tests

  Despache 3 agentes IMPLEMENTADORES em paralelo com file ownership exclusivo:

  ═════════════════════════════════════════════════════════════════════════════
  **TRACK A — STORAGE CUTOVER + SCRIPTS** (subagent_type: general-purpose)
  ═════════════════════════════════════════════════════════════════════════════
  Owner files (exclusivos):
  - `scripts/verify-cert-backfill.mjs` (CRIAR)
  - `scripts/delete-firebase-cert-bucket.mjs` (CRIAR)
  - `src/services/educacaoService.js` (emitirCertificado: remover dual-write Firebase, 
    fix HMAC ordering; manter getCertificadoSignedUrl)
  - `src/pages/educacao/CertificadosPage.jsx` (remover uploadCertificatePDF call + 
    fallback downloadCertificate)
  - `src/pages/educacao/utils/certificateGenerator.js` (deletar uploadCertificatePDF, 
    downloadCertificate, openCertificate, getCertificatePdfUrl; **MANTER** generateCertificatePDF)

  Prompt:
  ```
  Você é o Storage Cutover track da Wave 1.9. Working dir: /Users/guilherme/Documents/IA/ANEST V2.
  Branch atual: wave-1.9-storage-cutover-cleanup.

  CONSTRAINTS:
  - ZERO modificações em src/pages/HomePage.jsx
  - NÃO apagar Firebase bucket antes de verify retornar pending=0
  - HMAC ordering fix é separado: re-upload Supabase APÓS solicitarAssinaturaHMAC sucede,
    para PDF do bucket bater com Firestore assinatura
  - Stop Firebase write requer T1.9.1 funcional ANTES
  - Modal DS: title/description/footer | Toast DS: useToast | requireUserId em mutations

  ANTES DE COMEÇAR:
  1. Leia src/services/educacaoService.js linhas 3244-3434 (emitirCertificado + getCertificadoSignedUrl
     atuais Wave 1.8). Foco em: ordem solicitarAssinaturaHMAC vs Supabase upload (precisa inverter).
  2. Leia src/pages/educacao/utils/certificateGenerator.js completo.
  3. Leia src/pages/educacao/CertificadosPage.jsx handler download (linha ~151) + fallback (~164-173).
  4. Verifique scripts/ existentes: como autenticam Firebase Admin SDK? (Procure por 
     'firebase-admin' em scripts/*.mjs).

  T1.9.1 — scripts/verify-cert-backfill.mjs:
    CLI: --dry-run (default) lista IDs pending; --verify exit 0 se pending=0, exit 1 se >0;
         --json saída maquinável.
    Auth: Firebase Admin SDK (modelo: scripts existentes).
    Query Firestore educacao_certificados onde supabaseMigrated != true.
    Output: JSON { total, migrated, pending: [{ id, userId, arquivoUrl }], missing_arquivo_url: [...] }.
    Rate-limit: bulk read OK, mas paginate se > 500 docs.
    
  T1.9.2 — Cutover em emitirCertificado:
    Remover bloco dual-write Firebase do try/catch (lines ~3298-3343 Wave 1.8). 
    Após HMAC sucede, fazer Supabase upload OBRIGATÓRIO (falha = throw 'cert_supabase_upload_failed').
    Remover updateDoc supabaseMigrated (já não precisa do flag — sempre true).
    Schema cleanup: futura migration pode deletar campo, mas Wave 1.9 só para de escrever.
    
  T1.9.3 — Remover deprecated:
    - certificateGenerator.js: deletar getCertificatePdfUrl, uploadCertificatePDF, 
      downloadCertificate, openCertificate. MANTER generateCertificatePDF (ainda usado).
    - CertificadosPage.jsx: remover call uploadCertificatePDF (em handler emit); 
      remover try/catch fallback downloadCertificate (linha ~164-173 Wave 1.8). 
      Simplificar handler para sempre tentar signed URL, toast error se falhar.
    - Atualizar imports em certificateGenerator.js (remover Firebase Storage refs se não usados).
    
  T1.9.4 — Force-backfill server-side dos pending:
    DEPENDÊNCIA: T1.9.1 funcional. Roda --dry-run primeiro para listar pending.
    Opção A (recomendada): nova Edge fn supabase/functions/backfill-cert-supabase/index.ts 
    que recebe { certId, userId, arquivoUrl } via service_role, baixa Firebase, sobe Supabase, 
    atualiza Firestore. Chamada pelo script de batch.
    Opção B: script Node usa Firebase Admin SDK para baixar + Supabase Service Role client 
    para upload (sem Edge). Mais simples mas vaza service-role key local.
    Use Opção A. Script wrapper: scripts/run-backfill-pending.mjs chama Edge em loop.
    
  T1.9.8 — Fix HMAC ordering:
    Em emitirCertificado, mover bloco Supabase upload para DEPOIS de solicitarAssinaturaHMAC sucede,
    e regenerar PDF com assinaturaHMAC dentro (se generateCertificatePDF acepta `signature` no 
    payload — investigue). Se não, deixar tech-debt nota: "PDF Supabase pode não ter HMAC embedded; 
    Firestore ainda é fonte de verdade para signature".
    
  T1.9.9 — scripts/delete-firebase-cert-bucket.mjs:
    CLI: --dry-run lista N arquivos em gs://anest-ap.firebasestorage.app/certificados/ + tamanho 
    total; --apply requer interactive confirm + 2 verifications:
      1. verify-cert-backfill.mjs --verify retorna 0
      2. user digita "DELETE BUCKET" no stdin (prompt readline)
    Bulk delete via Firebase Admin Storage bulkDelete API. Log para 
    logs/delete-firebase-cert-bucket-<timestamp>.log.

  Commits granulares (1 por T-task). Build verde a cada commit.
  Reporte: hashes, files, decisões divergentes, secrets novos (deve ser nenhum), 
  tech-debt criado, output de verify --dry-run em prod.
  ```

  ═════════════════════════════════════════════════════════════════════════════
  **TRACK B — AUDIT TRAIL + SECURITY HARDENING** (subagent_type: general-purpose)
  ═════════════════════════════════════════════════════════════════════════════
  Owner files:
  - `supabase/functions/get-cert-download-url/index.ts` (insert audit trail server-side)
  - `supabase/migrations/20260527140000_firebase_uid_security_definer.sql` (CRIAR)
  - `supabase/migrations/20260527150000_cert_download_audit.sql` (CRIAR se schema novo necessário)

  Prompt:
  ```
  Você é o Audit Trail + Security Hardening track da Wave 1.9. Working dir: /Users/guilherme/Documents/IA/ANEST V2.

  CONSTRAINTS:
  - firebase_uid() recriação via CREATE OR REPLACE FUNCTION (preservar policies dependentes)
  - Audit trail insert em service_role only (não-bypassable pelo client)
  - Validar com migration-validator antes de aplicar
  - Aplicar com node scripts/deploy-sp21-mgmt-api.mjs apply-migration <path> --apply

  ANTES DE COMEÇAR:
  1. Leia supabase/migrations/002_rls.sql linhas 1-30 (helpers).
  2. Leia supabase/functions/get-cert-download-url/index.ts completo (Wave 1.8).
  3. Decida nome da tabela audit: Agent 3 pre-flight te disse (educacao_logs OR audit_logs).

  T1.9.6 — Audit trail download em Edge get-cert-download-url:
    Após createSignedUrl sucede e antes de retornar Response 200:
    
    const auditPayload = {
      user_id: userId,                              // JWT.sub
      action: 'cert_download_signed',
      target_type: 'educacao_certificado',
      target_id: certificadoId,
      metadata: {
        ttl_seconds: TTL_SECONDS,
        ip: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || null,
        user_agent: (req.headers.get('user-agent') || '').slice(0, 200),
      },
      created_at: new Date().toISOString(),
    };
    
    const { error: auditErr } = await supabaseService
      .from('<tabela canônica>')
      .insert(auditPayload);
    
    if (auditErr) {
      console.error('audit insert failed (non-fatal):', auditErr.message);
      // NÃO falhar a request — audit é best-effort, download é prioritário
    }
    
    Se schema atual não comporta os campos, criar migration 20260527150000_cert_download_audit.sql
    que adiciona action='cert_download_signed' à tabela enum/check constraint, OU cria tabela 
    cert_download_audit dedicada com RLS:
      SELECT: owner (user_id = firebase_uid()) OR admin
      INSERT: service_role
      UPDATE/DELETE: nenhum (immutable audit)
    
  T1.9.7 — Migration firebase_uid SECURITY DEFINER hardening:
    Path: supabase/migrations/20260527140000_firebase_uid_security_definer.sql
    
    Conteúdo:
    ```sql
    -- Wave 1.9 hardening — firebase_uid() SECURITY DEFINER + search_path
    -- Motivo: audit Wave 1.8 identificou que firebase_uid() consulta 
    -- current_setting('request.jwt.claims') mas não declara SECURITY DEFINER
    -- nem set search_path. Atacante com permissão de criar funções em pg_temp 
    -- poderia, em teoria, sequestrar resolução de nome via search_path takeover.
    -- 
    -- Solução: recriar com SECURITY DEFINER set search_path = pg_catalog, public.
    -- CREATE OR REPLACE preserva todas as policies/views/triggers dependentes.
    
    create or replace function public.firebase_uid()
    returns text
    language sql
    stable
    security definer
    set search_path = pg_catalog, public
    as $$
      select coalesce(
        nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
        ''
      );
    $$;
    
    -- Garantir GRANT EXECUTE para roles autenticated e anon (espelhar estado prévio).
    grant execute on function public.firebase_uid() to authenticated, anon, service_role;
    
    -- Mesmo para is_admin() se ainda não tem set search_path (verificar antes).
    -- (deixe comentado se already correctly defined).
    ```
    
    INVOQUE migration-validator antes de aplicar:
    Agent({ subagent_type: 'migration-validator', prompt: '...colar migration + perguntar...' })
    
    Aplicar: node scripts/deploy-sp21-mgmt-api.mjs apply-migration <path> --apply
    Verificar: query SELECT firebase_uid() FROM ... como user autenticado retorna sub ok.

  Commits granulares.
  Reporte: migration apply output, validator result, edge fn re-deploy command para user.
  ```

  ═════════════════════════════════════════════════════════════════════════════
  **TRACK C — CLEANUP MOCKCATEGORIAS** (subagent_type: general-purpose)
  ═════════════════════════════════════════════════════════════════════════════
  Owner files:
  - `src/pages/educacao/data/educacaoUtils.js` (delete mockCategorias)
  - `src/pages/educacao/data/mockEducacaoData.js` (delete cópia duplicada se houver)
  - `src/hooks/useEducacao.js` (migrar fallback para useCategorias)
  - `src/pages/educacao/EducacaoContinuadaPage.jsx` (migrar)
  - `src/pages/educacao/admin/CursoFormModal.jsx` (migrar)

  Prompt:
  ```
  Você é o Cleanup mockCategorias track da Wave 1.9. Working dir: /Users/guilherme/Documents/IA/ANEST V2.

  CONTEXTO PRÉ-FLIGHT (Wave 1.8 já mapeou consumers):
  - src/hooks/useEducacao.js: imports + fallback hardcoded em :8, :132, :138
  - src/pages/educacao/EducacaoContinuadaPage.jsx: imports + uso em :15, :264, :893
  - src/pages/educacao/admin/CursoFormModal.jsx: import + options dropdown em :10, :131
  - src/pages/educacao/data/mockEducacaoData.js: cópia duplicada em :150
  - src/pages/educacao/admin/CategoriasManagerPage.jsx: já migrado (Wave 1.7)
  - Testes: sem referências (Wave 1.8 grep confirmou)

  CONSTRAINTS:
  - ZERO HomePage
  - useCategorias é o hook canônico (Wave 1.7) — verificar API antes de migrar
  - Manter fallback gracioso: se useCategorias falhar (network), exibir empty state, 
    NÃO crashar

  T1.9.5 — Cleanup mockCategorias:
  1. Leia src/pages/educacao/admin/CategoriasManagerPage.jsx para ver como usa useCategorias 
     (referência canônica Wave 1.7).
  2. Leia src/hooks/useCategorias.js (API: data, isLoading, error, refetch).
  3. Para cada consumer:
     a. useEducacao.js — substituir fallback `setCategorias(mockCategorias)` por chamada 
        useCategorias (mas é um hook, não pode chamar dentro de outro hook... investigar:
        é melhor remover o estado de categorias do useEducacao e fazer components consumirem 
        useCategorias direto).
     b. EducacaoContinuadaPage.jsx — substituir import de mockCategorias pelo hook 
        useCategorias. Adaptar usos em :264 e :893 para nova API.
     c. CursoFormModal.jsx — mesmo. Options dropdown agora vem do hook.
  4. Deletar mockCategorias de educacaoUtils.js (manter outros exports intactos).
  5. Deletar cópia duplicada em mockEducacaoData.js:150 se for órfã.
  6. npm run build verde após cada step.

  Commits granulares.
  Reporte: hashes, callers migrados, surpresas (API mismatches, etc.), confirmação 
  que useCategorias suporta todos os cenários (loading state, cached, refetch).
  ```

  ═══════════════════════════════════════════════════════════════════════════════
    FASE 4 — INTEGRAÇÃO + BACKFILL FORÇADO (sequencial, ALTA criticidade)
  ═══════════════════════════════════════════════════════════════════════════════

  1. `git status -s` — confirmar nenhum overlap inesperado entre tracks.
  2. `npm run build` verde.
  3. `git diff origin/main -- src/pages/HomePage.jsx | wc -l` == 0.
  
  4. **Backfill verification em prod:**
  ```bash
  node scripts/verify-cert-backfill.mjs --dry-run
  # Expected: JSON com pending: [...] e missing_arquivo_url: [...]
  ```

  5. **Se pending > 0:**
  ```bash
  # Deploy Edge backfill-cert-supabase
  bash scripts/deploy-edge-with-pat.sh backfill-cert-supabase
  
  # Rodar batch backfill (rate-limit interno 5 req/s)
  node scripts/run-backfill-pending.mjs --apply
  
  # Re-verify
  node scripts/verify-cert-backfill.mjs --verify   # exit 0 esperado
  ```

  6. **Confirmação explícita do user via AskUserQuestion antes do bucket delete:**
  ```
  AskUserQuestion: "verify retornou pending=0 e bucket Firebase tem N arquivos 
  (X MB total). Confirma delete IRREVERSÍVEL via delete-firebase-cert-bucket.mjs --apply?"
  ```

  7. Após user confirmar:
  ```bash
  node scripts/delete-firebase-cert-bucket.mjs --apply
  # Stdin "DELETE BUCKET" interactive prompt
  ```

  ═══════════════════════════════════════════════════════════════════════════════
    FASE 5 — AUDITORIA PARALELA (3 agentes em UMA mensagem)
  ═══════════════════════════════════════════════════════════════════════════════

  **AGENT AUDIT 1 — lgpd-reviewer**
  ```
  Audite Wave 1.9 LGPD:
  - Audit trail download cumpre Art. 18 portabilidade? Server-side não-bypassable?
  - mockCategorias delete não causa regressão de privacidade?
  - HMAC ordering fix mantém integridade do PDF (não vaza signature mismatch)?
  - Firebase bucket delete: dados foram realmente migrados (verify=0)?
  - Audit trail tem RLS adequado (SELECT só pelo owner ou admin)?
  ≤400 palavras.
  ```

  **AGENT AUDIT 2 — security-reviewer**
  ```
  Audite Wave 1.9:
  - firebase_uid() SECURITY DEFINER + search_path correto? Policies dependentes 
    continuam funcionando?
  - Edge audit trail não vaza PII em log de erro?
  - delete-firebase-cert-bucket.mjs tem dry-run robusto + double-confirm?
  - Cutover atomic: race condition entre stop dual-write e backfill final?
  - Cleanup mockCategorias não introduz null pointer em fallback de network failure?
  ≤400 palavras.
  ```

  **AGENT AUDIT 3 — migration-validator**
  ```
  Validar 1-2 migrations novas (firebase_uid hardening, cert_download_audit se aplicável).
  - CREATE OR REPLACE preserva policies?
  - Idempotência (re-run sem efeito)?
  - Rollback safety (não há DROP destrutivo)?
  - search_path = pg_catalog, public é seguro contra search_path takeover?
  ≤300 palavras.
  ```

  Aplicar fixes HIGH/MED em commits adicionais antes do PR.

  ═══════════════════════════════════════════════════════════════════════════════
    FASE 6 — PR + DEPLOY
  ═══════════════════════════════════════════════════════════════════════════════

  ```bash
  git push -u origin wave-1.9-storage-cutover-cleanup
  gh pr create --base main --title "feat(educacao): cutover Firebase→Supabase + cleanup + audit trail (Wave 1.9)"
  ```

  PR body cobrir:
  - Decisões D1/D2/D3
  - Audit results table
  - Test plan (download cert pós-cutover → confirma somente Supabase signed URL; 
    audit trail aparece em educacao_logs; firebase_uid() funciona)
  - Verificação anti-regressão Home + zero degradação certs históricos
  - Pendências para Wave 2.0 (eventual: schema cleanup arquivoUrl field do Firestore)
  - Deploy steps ordenados

  **Deploy steps no PR body:**
  1. Migration firebase_uid: `node scripts/deploy-sp21-mgmt-api.mjs apply-migration supabase/migrations/20260527140000_firebase_uid_security_definer.sql --apply`
  2. Migration audit (se nova): `node scripts/deploy-sp21-mgmt-api.mjs apply-migration supabase/migrations/20260527150000_cert_download_audit.sql --apply`
  3. Deploy Edge `backfill-cert-supabase`: `bash scripts/deploy-edge-with-pat.sh backfill-cert-supabase`
  4. Deploy Edge `get-cert-download-url`: `bash scripts/deploy-edge-with-pat.sh get-cert-download-url`
  5. (Já feito na Fase 4) Backfill final + bucket Firebase delete.
  6. Merge PR + `firebase deploy --only hosting:anest-ap`
  7. Smoke test: download cert real em prod → confirma signed URL Supabase apenas; 
     audit log gravado; sem fallback Firebase.

  CHANGELOG bump v5.4.0.

  ═══════════════════════════════════════════════════════════════════════════════
    CHECKLIST FINAL (obrigatórios)
  ═══════════════════════════════════════════════════════════════════════════════

  - [ ] Data ≥ 2026-05-26 (soak Wave 1.8 completo)
  - [ ] `npm run build` verde
  - [ ] `npm run dev` sobe sem erro
  - [ ] `verify-cert-backfill.mjs --verify` retorna exit 0 (pending=0)
  - [ ] migration-validator aprovou migrations
  - [ ] lgpd-reviewer sem HIGH bloqueante
  - [ ] security-reviewer sem HIGH/MED não-resolvido
  - [ ] `git diff origin/main -- src/pages/HomePage.jsx | wc -l` == 0
  - [ ] Download cert real em prod retorna apenas Supabase signed URL (sem fallback Firebase)
  - [ ] Audit trail row aparece em `educacao_logs` (ou tabela canônica)
  - [ ] `mockCategorias` removido (grep retorna 0 em src/, exceto talvez tests)
  - [ ] Bucket Firebase `certificados/` apagado (Firebase Console confirma vazio)
  - [ ] firebase_uid() retorna sub corretamente em query autenticada
  - [ ] CHANGELOG bump v5.4.0
  - [ ] Tests verdes (incluindo updates de emitirCertificado para nova ordem HMAC)

  ═══════════════════════════════════════════════════════════════════════════════
    DIRETRIZES OPERACIONAIS (lições Wave 1.7 + 1.8 consolidadas)
  ═══════════════════════════════════════════════════════════════════════════════

  1. **Hook fix em `.claude/settings.json:40-42`** já consertado em Wave 1.8 — pode 
     trabalhar em branch != main sem bloqueio.
  2. Cache npm corrupted entre deploys — se `bash scripts/deploy-edge-with-pat.sh` 
     falhar com ENOTEMPTY, peça ao user `rm -rf ~/.npm/_npx/aa8e5c70f9d8d161` no terminal dele.
  3. `firebase` CLI funciona localmente; `supabase` é via `bash scripts/deploy-edge-with-pat.sh`.
  4. `gcloud` NÃO instalado — qualquer IAM GCP é manual via console.
  5. WIP de noticias está em `git stash list` (stash@{0} e {1}) — NÃO descartar.
  6. Migration via `node scripts/deploy-sp21-mgmt-api.mjs apply-migration <path> --apply`.
  7. Modal DS API: `title`/`description`/`footer` props (sem ModalHeader/Content/Footer).
  8. Toast DS: `const { toast } = useToast(); toast({ title, description, variant: 'destructive' })`.
  9. Audit-trail: SEMPRE `requireUserId()` em mutations.
  10. Commits granulares por T-task.
  11. **Tests pre-existentes em main**: 2 streak tests em `educacaoService.firebase.test.js` 
      podem falhar — não são da Wave 1.9. Wave 1.9 atualiza testes de `emitirCertificado` para 
      nova ordem HMAC (se aplicável).

  ═══════════════════════════════════════════════════════════════════════════════
    ANTI-PADRÃO QUE QUEBRA A WAVE
  ═══════════════════════════════════════════════════════════════════════════════

  - ❌ Qualquer modificação em `src/pages/HomePage.jsx`
  - ❌ Apagar bucket Firebase ANTES de `verify --verify` retornar exit 0
  - ❌ Stop dual-write em mesmo commit que delete bucket (sem janela de manutenção)
  - ❌ Audit trail apenas client-side (LGPD: deve ser server-side via Edge)
  - ❌ `firebase_uid()` recreate com DROP — usar `CREATE OR REPLACE`
  - ❌ Commit gigante misturando cutover + cleanup + audit + hardening
  - ❌ Skip de migration-validator
  - ❌ Force-backfill sem rate-limit (rate-limit Firebase/Supabase 5 req/s)
  - ❌ Refactor oportunista (categorias UI, novo recurso, etc.) — escopo é cleanup + cutover SÓ

  ═══════════════════════════════════════════════════════════════════════════════
    COMECE AGORA EXECUTANDO PASSO 0
  ═══════════════════════════════════════════════════════════════════════════════

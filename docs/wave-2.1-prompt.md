---
  ═══════════════════════════════════════════════════════════════════════════════
    WAVE 2.1 — SPRINT 2 START · AUTH & WEBAUTHN HARDENING (Segurança P0)
  ═══════════════════════════════════════════════════════════════════════════════

  Working dir: /Users/guilherme/Documents/IA/ANEST V2
  Projeto: ANEST v5.5.0 → v5.6.0 — React 19.2 + Vite 7 + Tailwind 3.4 + Firebase + Supabase (RLS via JWT HS256)
  HEAD esperado em origin/main: commit `67e8e2e` (hook fix Wave 1.10 hygiene) ou mais recente.
  Prod: https://anest-ap.web.app (Wave 1.9 cutover Firebase→Supabase live; bucket Firebase deletado; audit trail ativo)

  Escopo: 3 dias úteis. Sprint 2 Wave 2.1 (primeira de 4 waves do sprint).
  Plano completo: `docs/planejamento-melhorias-2026-05-16.md` linhas 380-419.

  ═══════════════════════════════════════════════════════════════════════════════
    CONTEXTO — POR QUE ESTA WAVE EXISTE
  ═══════════════════════════════════════════════════════════════════════════════

  Sprint 1 (Waves 1.1-1.9) fechou Educação Continuada + cert PDF migrado para Supabase
  privado + audit trail server-side + firebase_uid hardened. Sprint 2 inicia segurança P0:
  zerar exposições de dados de saúde + LGPD crítica.

  Wave 2.1 ataca 3 vetores específicos de auth:

  **(A) WebAuthn rework — replay-safe**
  `src/services/biometricService.js:96-177` atual gera challenge CLIENT-SIDE e armazena
  password no IndexedDB. Vetor: atacante com acesso ao device replaya a credential.
  Fix: challenge SERVER-SIDE via Edge `webauthn-challenge`, server emite Firebase
  Custom Token via Admin SDK após assinatura validada (não senha em IDB).

  **(B) JWT cache revocation**
  `src/config/supabase.js:47` cacheia JWT por 50min sem checar revogação. Se admin
  precisa revogar uma sessão (compromise, logout forçado), o JWT continua válido até
  TTL. Fix: tabela `token_blocklist` + check na Edge `get-supabase-token` antes de
  emitir refresh.

  **(C) API tokens com TTL**
  `api-v1/index.ts:386-410` aceita API tokens sem `expires_at`. Token vazado fica
  válido eternamente. Fix: coluna `expires_at` na tabela `api_tokens` + CHECK na Edge.

  ═══════════════════════════════════════════════════════════════════════════════
    🔴 CONSTRAINTS DUROS
  ═══════════════════════════════════════════════════════════════════════════════

  1. **ZERO modificações em `src/pages/HomePage.jsx`.** Verificar diff antes de PR.
  2. **WebAuthn change quebra sessões biométricas existentes** se mal feito. Mitigação:
     primeiro deploy + verify backward-compat, depois flip flag para new flow.
  3. **token_blocklist MIGRATION é DEFENSIVA** — só adiciona check; sem ela, JWT continua
     válido. Não pode quebrar fluxo existente.
  4. **API tokens TTL** — todos os tokens vivos atualmente precisam de `expires_at`
     populado via backfill antes do CHECK CONSTRAINT virar NOT NULL.
  5. Secrets: NUNCA leia `.env*`. Para Edge Function nova `webauthn-challenge`,
     `WEBAUTHN_RP_ID` e `WEBAUTHN_ORIGIN` são env vars públicas — set via Supabase
     dashboard.
  6. Hook fix (`67e8e2e`) requer **restart de sessão Claude Code** para entrar em vigor.
     Antes do primeiro Bash, force-restart se necessário.
  7. **NÃO faça refactor oportunista.** Tarefas fora do plano vão para issues separadas.

  ═══════════════════════════════════════════════════════════════════════════════
    PASSO 0 — HYGIENE PRÉ-WAVE (opcional, ~30min)
  ═══════════════════════════════════════════════════════════════════════════════

  Pendências hygiene da Wave 1.9 que podem ir antes em commits triviais (NÃO criar
  wave separada — todos são 1-2 linhas cada):

  1. **CHANGELOG v5.5.0 catch-up**: calc balanço hídrico transoperatório (commits
     `aa62b7e`, `2ee91c7`, `e769be3`) foi mergeado em main sem entrada no CHANGELOG.
     Adicionar seção v5.5.0 com Highlights da calculadora.
  2. **BACKFILL_ADMIN_UID em `.env.example`**: documentar a env var nova (1 linha +
     comment).
  3. **Nonce em certIds**: DEFER. Anti-enumeration mas certIds são deterministic e o
     endpoint /verificar/:certId retorna iniciais — não bloqueante. Sprint 5 candidate.
  4. **Audit tables → schema `audit`**: DEFER. Refactor cosmético sem ganho de
     segurança imediato. Sprint 5 candidate.
  5. **pg_cron expurgo `educacao_downloads_audit` > 5 anos**: DEFER. Retenção é 5
     anos, primeira linha foi inserida 2026-05-21 — expurgo só relevante em 2031.

  Commits triviais (1-2):
  - `docs: CHANGELOG bump v5.5.0 — calc balanço hídrico transoperatório`
  - `docs: BACKFILL_ADMIN_UID em .env.example`

  ═══════════════════════════════════════════════════════════════════════════════
    PASSO 1 — SETUP
  ═══════════════════════════════════════════════════════════════════════════════

  ```bash
  git checkout main && git fetch origin && git pull --ff-only origin main
  git log -1 --format='%h %s'                  # deve mostrar ≥ 67e8e2e
  git stash list                               # 5 stashes preservados — NÃO descartar
  git checkout -b wave-2.1-auth-webauthn-jwt-api
  ```

  ═══════════════════════════════════════════════════════════════════════════════
    FASE 1 — PRE-FLIGHT PARALELO (3 agentes em UMA mensagem)
  ═══════════════════════════════════════════════════════════════════════════════

  **AGENT 1 — WebAuthn state atual** (subagent_type: Explore, very thorough)

  ```
  Em ANEST V2, mapeie WebAuthn / biometria atual para Wave 2.1 rework. ≤500 palavras.
  (a) src/services/biometricService.js completo — funções, fluxo de challenge,
      armazenamento de credential. Onde a senha é armazenada (IndexedDB? localStorage?)?
  (b) Edge Functions existentes em supabase/functions/ com nome biometric/auth/webauthn.
  (c) Firebase Custom Token: existe alguma Edge que emite via Admin SDK? Modelo
      canônico para nova Edge `webauthn-challenge`.
  (d) Browser support detection: bibliotecas usadas (`@simplewebauthn/browser`,
      `@github/webauthn-json`, ou implementação custom)? Vale instalar
      `@simplewebauthn/server` para validar assertions no servidor?
  (e) Fluxo de login atual: como user habilita biometria? Onde é chamado? Listar
      todos os callers de biometricService.
  ```

  **AGENT 2 — JWT cache + token_blocklist patterns** (subagent_type: Explore)

  ```
  Em ANEST V2, recon para Wave 2.1 JWT revocation. ≤400 palavras.
  (a) src/config/supabase.js linhas 40-80 — fluxo de cache JWT (TTL 50min, refresh 10min
      antes de expirar). Onde é consultado?
  (b) supabase/functions/get-supabase-token/index.ts — onde emite o JWT? Que claims
      inclui? Pode adicionar check de blocklist?
  (c) Existe tabela `token_blocklist` ou similar (`revoked_tokens`, `session_blacklist`)
      no schema atual? Grep em supabase/migrations/.
  (d) Como invalidar JWT cache no client após admin revogar? Custom event existing?
      Pattern Wave 1.8 usou `supabase-token-error` event.
  (e) Modelo de migration para nova tabela: schema sugerido (jti UUID, user_id text,
      revoked_at, revoked_by, reason). RLS owner SELECT, admin INSERT.
  ```

  **AGENT 3 — API tokens TTL state** (subagent_type: Explore)

  ```
  Em ANEST V2, recon para Wave 2.1 API tokens TTL. ≤400 palavras.
  (a) supabase/functions/api-v1/index.ts linhas 380-420 — fluxo de validação de token.
      Como lookup é feito? Tabela `api_tokens` schema atual?
  (b) Existe coluna `expires_at` ou similar? Se não, listar migration recente que
      criou api_tokens. Quantos tokens vivos hoje? (query mgmt API)
  (c) Backfill strategy: tokens existentes precisam de `expires_at` antes de virar
      NOT NULL. Sugerir default (NOW() + 1 year? ou explicit per-token via admin UI?).
  (d) UI admin para gerar/revogar API tokens existe? src/pages/admin/ procurar.
  (e) Quem cria API tokens (Edge generate-api-token? Admin UI direto?). Mostrar fluxo.
  ```

  ═══════════════════════════════════════════════════════════════════════════════
    FASE 2 — DECISÕES via AskUserQuestion (1 chamada, 2 questões)
  ═══════════════════════════════════════════════════════════════════════════════

  **D1. WebAuthn library**
  - (Recomendada) `@simplewebauthn/server` (5.7M downloads/wk, mantido por Auth0 /
    Yubico) + `@simplewebauthn/browser` no client. Battle-tested.
  - Custom implementation com `crypto.subtle` (sem nova dep, mais código).
  - Defer WebAuthn rework para Wave 2.2 (foca em token_blocklist + API TTL primeiro).

  **D2. API tokens backfill default `expires_at`**
  - (Recomendada) Default `NOW() + INTERVAL '1 year'` no backfill + admin UI mostra
    expiração + permite renovar.
  - Default `NOW() + INTERVAL '30 days'` (mais agressivo, força rotação).
  - Tokens vivos sem expiração nunca expiram (mantém compat — não recomendado).

  ═══════════════════════════════════════════════════════════════════════════════
    FASE 3 — IMPLEMENTAÇÃO (3 tracks paralelos)
  ═══════════════════════════════════════════════════════════════════════════════

  Crie 8 tasks via TaskCreate (T2.1.1 a T2.1.8):

  - T2.1.1 — Migration `token_blocklist` (jti, user_id, revoked_at, revoked_by, reason)
  - T2.1.2 — Edge `get-supabase-token` consulta blocklist antes de emitir
  - T2.1.3 — Migration `api_tokens.expires_at` + backfill 1 ano + CHECK
  - T2.1.4 — Edge `api-v1` valida `expires_at > now()` antes de aceitar token
  - T2.1.5 — Edge `webauthn-challenge` (nova): emite challenge server-side, valida
            assertion, emite Firebase Custom Token via Admin SDK
  - T2.1.6 — `biometricService` reescrita: usa Edge para challenge + Custom Token
  - T2.1.7 — Tests + smoke (auth flow não regride, revocation funciona, API token
            expirado rejeitado)
  - T2.1.8 — CHANGELOG bump v5.6.0 + memory update

  Tracks paralelos (file ownership disjunto):

  **TRACK A — JWT REVOCATION + API TTL**
  Owner files:
  - supabase/migrations/20260601120000_token_blocklist.sql (CREATE)
  - supabase/migrations/20260601120100_api_tokens_ttl.sql (CREATE)
  - supabase/functions/get-supabase-token/index.ts (modify)
  - supabase/functions/api-v1/index.ts (modify lines 380-420)
  - src/config/supabase.js (modify token cache check)

  **TRACK B — WEBAUTHN REWORK**
  Owner files:
  - supabase/functions/webauthn-challenge/index.ts (CREATE)
  - supabase/functions/webauthn-verify/index.ts (CREATE — emite Custom Token)
  - src/services/biometricService.js (rewrite)
  - package.json (add @simplewebauthn/server + browser conforme D1)

  **TRACK C — DOCS + TESTS**
  Owner files:
  - CHANGELOG.md
  - src/__tests__/services/biometricService.test.js (novo ou atualizar)
  - docs/ (novo arquivo de doc se webauthn flow precisar diagrama)
  - .env.example

  ═══════════════════════════════════════════════════════════════════════════════
    FASE 4 — AUDITS PARALELAS (3 agentes)
  ═══════════════════════════════════════════════════════════════════════════════

  - **security-reviewer**: WebAuthn flow (replay protection, challenge expiration,
    origin/RPID validation), token_blocklist (race conditions, performance impact
    no hot path JWT), API tokens (timing attacks no compare?).
  - **lgpd-reviewer**: Custom Token contém PII? Logs Edge functions vazam credentials?
    Backfill `expires_at` afeta direitos do titular?
  - **migration-validator**: 2 migrations novas (idempotência, rollback, índices).

  ═══════════════════════════════════════════════════════════════════════════════
    FASE 5 — PR + DEPLOY
  ═══════════════════════════════════════════════════════════════════════════════

  Deploy steps:
  1. Apply migrations via `node scripts/deploy-sp21-mgmt-api.mjs apply-migration <path> --apply`
  2. Deploy Edge functions via `bash scripts/deploy-edge-with-pat.sh <name>` (4 fns:
     get-supabase-token UPDATED, api-v1 UPDATED, webauthn-challenge NEW, webauthn-verify NEW)
  3. Set secrets Supabase Dashboard: WEBAUTHN_RP_ID, WEBAUTHN_ORIGIN
  4. Backfill API tokens com `expires_at` (script ou direto via mgmt API SQL)
  5. Merge PR + `firebase deploy --only hosting:anest-ap`
  6. Smoke test: login biométrico em prod, admin revoga sua sessão e confirma JWT cai
     no próximo refresh (até 10min), API token expirado retorna 401

  CHANGELOG bump v5.6.0.

  ═══════════════════════════════════════════════════════════════════════════════
    CHECKLIST FINAL
  ═══════════════════════════════════════════════════════════════════════════════

  - [ ] `npm run build` verde
  - [ ] migration-validator aprovou ambas migrations
  - [ ] security-reviewer sem HIGH bloqueante
  - [ ] `git diff origin/main -- src/pages/HomePage.jsx | wc -l` == 0
  - [ ] Login biométrico funciona em prod (smoke)
  - [ ] Admin revoga JWT (insert em token_blocklist) → next refresh user é deslogado
  - [ ] API token sem expires_at (legacy) recebe expires_at via backfill
  - [ ] API token com expires_at < now() retorna 401 na Edge api-v1
  - [ ] CHANGELOG bump v5.6.0 + memory update
  - [ ] PR labels: security, p0

  ═══════════════════════════════════════════════════════════════════════════════
    DIRETRIZES OPERACIONAIS
  ═══════════════════════════════════════════════════════════════════════════════

  1. Migration via `node scripts/deploy-sp21-mgmt-api.mjs apply-migration <path> --apply`
  2. Edge deploy via `bash scripts/deploy-edge-with-pat.sh <name>` (firebase CLI funciona;
     supabase CLI via PAT script)
  3. Modal DS API: `title`/`description`/`footer` props
  4. Toast DS: `const { toast } = useToast(); toast({ variant: 'destructive' })`
  5. Audit trail: SEMPRE `requireUserId()` em mutations
  6. Commits granulares por T-task
  7. Hook PreToolUse foi consertado em `67e8e2e` — RESTART Claude Code antes de
     começar para garantir hook fix em vigor
  8. Tests pre-existentes em main que falham (não-Wave 2.1): 2 streak + ~20 conflictQueue.
     Não tocar.

  ═══════════════════════════════════════════════════════════════════════════════
    ANTI-PADRÃO QUE QUEBRA A WAVE
  ═══════════════════════════════════════════════════════════════════════════════

  - ❌ Qualquer modificação em `src/pages/HomePage.jsx`
  - ❌ Deletar tokens vivos sem backfill (`api_tokens.expires_at` NOT NULL antes do backfill)
  - ❌ WebAuthn rework + flip de flag no mesmo commit (atomic break)
  - ❌ Refactor oportunista de auth (rotacionar JWT_SECRET, etc — fora de escopo)
  - ❌ Skip de migration-validator
  - ❌ Logar Custom Token, challenge, ou PII em Edge stdout/stderr
  - ❌ Trust user-supplied RP_ID / origin (server-side allowlist obrigatório)

  ═══════════════════════════════════════════════════════════════════════════════
    COMECE AGORA EXECUTANDO PASSO 0 (hygiene opcional) ou PASSO 1 (setup direto)
  ═══════════════════════════════════════════════════════════════════════════════

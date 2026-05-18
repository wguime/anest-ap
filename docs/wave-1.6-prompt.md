# Wave 1.6 — Prompt completo para nova sessão Claude

> Use este prompt em uma **nova aba do terminal** (`claude`). Cole o bloco abaixo inteiro entre as duas linhas de `═`.
> Antes: `cd ~/Documents/IA/ANEST\ V2`

---

````
═══════════════════════════════════════════════════════════════
PRÉ-REQUISITO (auto-verificar antes de começar):
  - `main` em GitHub deve estar em commit ≥ 96dddd9 (Wave 1.5 merged 2026-05-18)
  - https://anest-ap.web.app deve estar rodando Wave 1.5 em produção
  Se algo divergir: PARAR e avisar o user antes de prosseguir.
═══════════════════════════════════════════════════════════════

Working dir: /Users/guilherme/Documents/IA/ANEST V2
Projeto: ANEST v5.0.0 — React 19.2 + Vite 7 + Tailwind 3.4 + Firebase + Supabase (RLS via JWT HS256)

LEITURAS OBRIGATÓRIAS antes de começar (em ordem):
  1. CLAUDE.md (auto-loaded)
  2. `docs/wave-execution-playbook.md` — playbook consolidado de waves anteriores
  3. `docs/planejamento-melhorias-2026-05-16.md` linha 282 em diante (Wave 1.6 — 14 tasks)
  4. Regras auto-aplicadas em `.claude/rules/`: design-tokens, audit-trail, lgpd,
     supabase-firebase, padroes-codigo, qmentum-compliance, responsividade
  5. Skills disponíveis: `/educacao`, `/supabase-migration`, `/notificacoes`
  6. Memórias críticas em `~/.claude/projects/-Users-guilherme-Documents-IA-ANEST-V2/memory/`:
     - `feedback_design_tokens_no_hardcoded_colors.md` ⭐⭐ (T1.6.8 elimina 6 hex)
     - `feedback_ds_first_then_battle_tested.md`
     - `feedback_mobile_first.md`
     - `feedback_scope_discipline.md`
     - `feedback_parallel_agents.md`
     - `feedback_audit_trail_no_system_fallback.md`
     - `project_plano_melhorias_v5_x.md`

PASSO 0 — Setup:
  1. `git checkout main && git fetch origin && git pull --ff-only origin main`
  2. Verificar HEAD ≥ 96dddd9 (último commit Wave 1.5)
  3. `git checkout -b wave-1.6-rops-card-home`
  4. `npm install` se houver lockfile diff (não deve haver)

═══════════════════════════════════════════════════════════════
WAVE 1.6 — Desafio das ROPs + migração mock → Supabase (2 dias · 14 tasks)
═══════════════════════════════════════════════════════════════

META: "Desafio do dia" virar ritual diário do anestesista (5-10 min), com dados
reais (não mais 7295 LOC mock em rops-data.js), card permanente na Home e
visual 100% alinhado ao DS (zero hex hardcoded).

DIA 19 — Backend ROPs (schema + service + migração)

  T1.6.1  Schema ROPs no Supabase — migration 20260609120000_rops_schema.sql
          Tabelas: rop_areas, rop_subdivisoes, rop_questions, rop_user_attempts,
          rop_daily_challenges. RLS: firebase_uid() = user_id.

  T1.6.2  Script de seed (scripts/seed-rops-from-mock.mjs) — 6 áreas × 32
          subdivisões × 20 questões = 640 questões. Idempotente ON CONFLICT.
          Dry-run + --apply. Padrão: scripts/seed-firebase.mjs (Sprint 21 W2.1).

  T1.6.3  Service supabaseROPsService (~250 LOC). Padrão canônico:
          supabaseIncidentsService (throw on error, snake↔camel via
          makeFieldMapper). Métodos: fetchAreas, fetchSubdivisoes,
          fetchQuestionsBySubdivisao, recordAttempt, getOrCreateDailyChallenge,
          submitDailyChallengeAnswer, getStreak, getRanking.

  T1.6.4  Refatorar ROPsDesafioPage para usar service (substitui import estático
          de rops-data). Loading com Skeleton DS. Erros via sonner.

  T1.6.5  Refatorar páginas filhas: ROPsSubdivisoesPage, ROPsQuizPage,
          ROPsRankingPage, ROPsPodcastsPage.

  T1.6.6  Question versioning: usar `rop_questions` separado (decisão de Wave 1.3
          deferida) com version_num próprio. ROPs são engessadas (Qmentum), gera
          nova versão + snapshot em attempts.

  T1.6.7  Deprecar rops-data.js — APÓS seed validado em produção. Mantém
          podcasts-data.js (escopo separado).

DIA 20 — UX: Card Home + Desafio do dia + tokens DS

  T1.6.8  Refatorar MACRO_AREAS com tokens DS — substituir 6 hex em
          ROPsDesafioPage.jsx:17-60 por category-purple/blue/orange/pink/teal etc.
          Remover gradient style; usar bg-category-X-bg + text-category-X-fg +
          border-l-4 border-category-X.

  T1.6.9  <EducacaoSummaryCard> na HomePage — card destacado fixo (entre
          ComunicadosCard e PlantaoCard). 3 sub-blocos: Desafio do dia + Continue
          de onde parou + Próxima ação. Mobile stack; desktop grid 3 col.
          Padrão: src/design-system/components/anest/educacao-summary-card.jsx.

  T1.6.10 "Desafio do dia" — RPC Postgres get_or_create_daily_challenge(user_id,
          date_utc) retorna 5-10 questões aleatórias estratificadas por área
          (TABLESAMPLE BERNOULLI ou ORDER BY random()). Idempotente: mesmo dia =
          mesmas questões. UX: timer opcional 10min (prefers-reduced-motion
          desativa pulsing), barra de progresso, canvas-confetti em 100%
          (já em Wave 1.5).

  T1.6.11 Streak compartilhado com Wave 1.1 — ao completar/iniciar desafio,
          chamar record_user_activity_day(user_id, date_utc). Streak ROP =
          streak educação = streak app (uma fonte única, server UTC).

  T1.6.12 Ranking visual no card — só se opt-in LGPD ativo. Senão, mostrar
          score pessoal "Seu melhor da semana: 87%". Anti-pattern: leaderboard
          forçado.

  T1.6.13 Migrar podcasts-data.js (OPCIONAL — defer se atrasar).

  T1.6.14 Audit trail em mutations ROP — recordAttempt,
          submitDailyChallengeAnswer, score updates: requireUserId() + logAction.
          Nunca userId || 'system' (regra audit-trail.md).

═══════════════════════════════════════════════════════════════
PROCESSO OBRIGATÓRIO (seguir docs/wave-execution-playbook.md)
═══════════════════════════════════════════════════════════════

1. PRE-FLIGHT (~5min) — disparar EM PARALELO 3 agentes general-purpose:
   (a) Re-validar libs novas (talvez react-circular-progressbar) com critérios
       duros (★≥1k OU dl≥100k/sem, last commit ≤6m, React 19, MIT/Apache/BSD,
       ≤50KB gzip, caso real positivo ≤12m).
   (b) Mapear arquivos atuais: ROPsDesafioPage, ROPsSubdivisoesPage,
       ROPsQuizPage, ROPsRankingPage, ROPsPodcastsPage, atalhosConfig.js,
       HomePage.jsx (onde inserir EducacaoSummaryCard), supabaseIncidentsService
       (padrão a copiar), seed-firebase.mjs (padrão a copiar).
   (c) Verificar gaps arquiteturais: confirmar que ROPs/desafio pode 100% em
       Supabase (sem cross-com Firestore como Wave 1.5). Confirmar firebase_uid()
       helper existe nas migrations anteriores.

2. AskUserQuestion para DUAS decisões arquiteturais ANTES de cravar:
   - T1.6.6: rop_questions banco SEPARADO vs reusar question_bank de Wave 1.3?
     (Plano sugere separado por compliance — confirmar.)
   - T1.6.10: Estratificação aleatória — TABLESAMPLE BERNOULLI vs ORDER BY random()?
     (TABLESAMPLE mais eficiente em volume; random() mais previsível.)

3. TaskCreate com as 14 tasks da Wave 1.6.

4. ANTES de qualquer migration SQL (T1.6.1):
   - Despachar agente `migration-validator` com path da migration nova.
   - Aplicar feedback antes de rodar:
     `node scripts/deploy-sp21-mgmt-api.mjs apply-migration <path>`

5. ANTES de mergear o PR:
   - Despachar agente `security-reviewer` (RLS + auth + audit trail nas mutations)
   - Despachar agente `lgpd-reviewer` (ranking opt-in T1.6.12)
   - Despachar agente `qmentum-auditor` (ROPs são compliance crítica)

6. PARA CADA TASK:
   a. TaskUpdate in_progress antes de começar
   b. DS check primeiro (61+ ui/ + 35+ anest/)
   c. Implementar
   d. `npm run build` verde antes do próximo commit (checkpoint)
   e. Commit granular por bloco lógico
   f. TaskUpdate completed

═══════════════════════════════════════════════════════════════
VERIFICAÇÕES OBRIGATÓRIAS antes de declarar Wave 1.6 pronta
═══════════════════════════════════════════════════════════════

- [ ] `npm run build` verde
- [ ] `npm run dev` sobe sem erro (esbuild — pega imports quebrados)
- [ ] `npm run lint` sem NOVOS errors (24 pré-existentes em main, OK)
- [ ] Seed dry-run com --dry-run mostra 6 + 32 + 640 rows esperadas
- [ ] migration-validator agent aprovou a migration
- [ ] security-reviewer agent aprovou RLS + audit trail
- [ ] lgpd-reviewer agent aprovou ranking opt-in
- [ ] qmentum-auditor agent aprovou ROPs schema/versioning
- [ ] Playwright resize 375x812 (iPhone) + 1280x800 (desktop) sem layout break
- [ ] Touch targets ≥44px em todas as CTAs do EducacaoSummaryCard
- [ ] Zero hex hardcoded (grep `#[0-9a-f]{3,6}` em arquivos modificados)
- [ ] changedBy = currentUserId real em todas as mutations (NUNCA 'system')

═══════════════════════════════════════════════════════════════
SAÍDA ESPERADA
═══════════════════════════════════════════════════════════════

PR draft inicial:
  feat(educacao): card ROPs na home + migração mock→Supabase + Desafio do dia + tokens DS (Wave 1.6)

Base: main (≥96dddd9)
Head: wave-1.6-rops-card-home

Test plan no PR cobrindo:
- Backend: migration aplicada; seed dry-run OK; RLS testada com firebase_uid()
  real; mutations com audit
- Aluno: card EducacaoSummaryCard aparece entre Comunicados e Plantao na Home;
  sub-bloco "Desafio do dia" mostra score atual + streak; clicar navega pro
  desafio; 5-10 questões; timer; confetti em 100%; score salvo; streak
  incrementa
- Visual: 6 áreas no ROPsDesafioPage usando tokens category-* (zero hex);
  contraste DS testado light+dark; mobile stack, desktop grid 3 col
- Compliance: ranking só visível se opt-in LGPD ativo

CHANGELOG: bump para v5.1.0 ao fim.

DEPLOY (não automático, instruir user ao fim):
  1. firebase deploy --only firestore:rules (se houver mudança em rules)
  2. firebase deploy --only hosting:anest-ap (depois do merge)

═══════════════════════════════════════════════════════════════
COMEÇAR POR
═══════════════════════════════════════════════════════════════

1. PASSO 0 (setup) — verificar Wave 1.5 em prod + criar branch
2. Ler docs/wave-execution-playbook.md e CLAUDE.md
3. Disparar EM PARALELO os 3 agentes pre-flight (libs/map/gaps)
4. AskUserQuestion para as 2 decisões arquiteturais
5. TaskCreate com 14 tasks
6. Começar T1.6.1 (migration) → migration-validator aprova → apply
7. Avançar em ordem do plano

NÃO PROSSEGUIR sem responder as 2 decisões arquiteturais.
Se algum gap arquitetural for grande demais, PARAR e reportar ao user
(regra feedback_scope_discipline). NÃO fazer refactor oportunista.
````

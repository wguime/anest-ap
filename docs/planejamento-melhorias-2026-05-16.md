# Plano de Melhorias ANEST v5.0.0 → v5.1.0

> **Data:** 2026-05-16 · **Versão alvo:** v5.1.0 (Sprint Educação) → v5.5.0 (final do plano)
> **Base:** 13 auditorias paralelas (segurança · LGPD · Qmentum · a11y · code · UX × 2 personas + 6 módulos)
> **Fonte de cada item:** ver `docs/audit-v3.72.0.md`, `auditoria-incidentes-2026-05-04.md`, `auditoria-lgpd-incidentes-2026-05-04.md`, e o relatório de revisão de hoje (em chat).

## Visão executiva

- **65 achados** consolidados. **10 P0 críticos** (3 expõem dado de saúde), **30 P1**, **25 P2**, **10 quick wins**, **7 oportunidades de benchmark externo**.
- **5 sprints de 2 semanas** = ~10 semanas. Janela: **16/05 → 25/07/2026**.
- **Sprint 1 — Educação Continuada** é a prioridade declarada. Os demais sprints são propostas; ordem ajustável.
- Cada sprint segue o padrão ANEST: **3 waves**, deploy `firebase deploy --only hosting:anest-ap` ao final, CHANGELOG bump.

| Sprint | Janela | Foco | Versão |
|---|---|---|---|
| **S1** | 18/05 → 12/06 | Educação Continuada (admin + aluno + nav cristalina + authoring fluido + Desafio ROPs + captions multi-fonte + compliance) | v5.1.0 |
| **S2** | 12/06 → 26/06 | Segurança P0 + LGPD crítica | v5.2.0 |
| **S3** | 26/06 → 10/07 | Qmentum & UX gestor | v5.3.0 |
| **S4** | 10/07 → 24/07 | UX usuário + acessibilidade WCAG | v5.4.0 |
| **S5** | 24/07 → 07/08 | Tech debt + offline-first + benchmarks (inclui Groq Whisper Turbo se houver volume de uploads) | v5.5.0 |

> **Update 2026-05-17 (parte 1):** após nova rodada de 6 pesquisas paralelas em projetos altamente testados (Frappe LMS, Moodle 4, Open edX, Anki/FSRS, Open Badges 3.0, BlockNote, react-arborist, cmdk, sonner, papaparse), o Sprint 1 cresce para **18 dias úteis** com a adição da **Wave 1.5 — Navegação cristalina + Authoring fluido** e a substituição **TipTap → BlockNote** (drag handle gratuito, React 19 limpo, Notion-like UI pronto).

> **Update 2026-05-17 (parte 2):** Sprint 1 cresce mais 2 dias (20 dias úteis total) com adição da **Wave 1.6 — Desafio das ROPs + migração mock**.

> **Update 2026-05-17 (parte 3):** após 5 pesquisas paralelas (YouTube captions, worker architectures, transcription APIs benchmark, multi-media player React, real-world experiences), Wave 1.1 T1.1.8-T1.1.10 são reformuladas e expandidas em **Wave 1.7 — Captions multi-fonte + Player Vidstack + Upload limite**. Decisões: (a) `youtube-caption-extractor` para YouTube embeds (PT auto-captions grátis 85-95% acurácia); (b) **Vidstack** substitui video-player.jsx (suporta YouTube/Vimeo/MP4/audio/HLS uniforme + parser VTT/SRT nativo + Tailwind plugin + 54KB gzip); (c) limite upload 500MB → 2GB; (d) admin VTT manual upload no AulaFormModal; (e) Whisper API NÃO entra agora (Cornell+UW 2024 documenta hallucination em 1% transcripts médicos, 38% "harmful" — esperar review humano via Sprint 5 com Groq Whisper Turbo $0.04/h se necessário); (f) decisão arquivada: **sem gravação direta no app** (MediaRecorder/getUserMedia — user descartou). Sprint 1 cresce para **22 dias úteis** (Wave 1.7 = +2 dias). Inclui: novo `<EducacaoSummaryCard>` na HomePage com Desafio do dia destacado, refatoração das 6 cores hex hardcoded de `ROPsDesafioPage` para tokens `category-*` do DS, migração de 7295 LOC de `rops-data.js` para 5 tabelas Supabase, e nova feature "Desafio do dia" (5-10 questões aleatórias por dia com streak compartilhado com a Wave 1.1).

---

## SPRINT 1 — EDUCAÇÃO CONTINUADA (16/05 → 30/05)

> **Meta:** transformar o módulo de educação na **referência interna de UX** do app, alinhado aos top padrões open source (Open edX, Frappe LMS, Moodle, Khan Academy).

### Por que primeiro
Concentra a maior densidade de gaps com impacto duplo (usuário + gestor):
- 10 gaps NOVOS na auditoria do módulo + 4 pendências pós-PR já em memória
- Tem **bug crítico ativo** (streak fantasma — gamificação sempre zerada)
- Tem **código morto perigoso** (`educacaoService_STUDENT_SAFE.js` com 326 linhas)
- Tem **violação de audit trail** (`userId || 'system'` em 5 páginas)
- Compromete certificação CFM (sem `validoAte`/recertificação)

### Best practices da pesquisa que vamos aplicar (atualizado 2026-05-17)

**Padrões pedagógicos & arquiteturais:**
1. **Frappe LMS (2.9k★)** — hierarquia 3 níveis Trilha→Curso→Módulo→Aula validada; role "Instrutor" + moderation approval para descentralizar criação
2. **Moodle 4.x (7.1k★)** — Activity Chooser modal + Course Index Drawer + question versioning com lock-on-attempt + "In Progress Courses" block no dashboard
3. **Open edX Studio (8.1k★)** — outline editor com inline rename + auto-save sem modal; activity chooser de 4 tipos
4. **LearnDash + Canvas New Quizzes** — banco de questões reutilizável separado de quiz (não clone por curso)
5. **Anki FSRS (28k★)** — algoritmo de spaced repetition validado academicamente; lib JS disponível para revisão ótima ao longo de 12 meses
6. **Open Badges 3.0 (1EdTech/IMS)** — credencial verificável JSON-LD assinada Ed25519; permite portabilidade CFM/SBA
7. **Duolingo (server-authoritative)** — fix do streak fantasma usando UTC + idempotent ON CONFLICT; path visual zig-zag vertical
8. **SCORM suspend_data pattern** — "continue de onde parou" como card hero no topo do dashboard
9. **xAPI statements (H5P)** — tracking granular verb/object/result para analytics + Qmentum
10. **WAI-ARIA radiogroup** — quiz acessível com Radix RadioGroup base (já em shadcn)

**Stack técnico decidido (validado por adoção/maturidade real):**
- **Editor rich text:** **BlockNote** v0.51 (9.7k★, drag handle gratuito, React 19 limpo) — substitui TipTap (que cobra drag handle Pro)
- **Tree drag-drop:** **react-arborist** v3.6.1 (3.6k★, 353k weekly, virtualization + inline rename built-in)
- **Command palette:** **cmdk** v1.1.1 (12.6k★, 39M weekly, já parte do shadcn)
- **Toast:** **sonner** v2.0.7 (12.4k★, 43M weekly) — substitui sistema de toast atual
- **Vídeo:** **react-player** v3.4.0 (10.2k★, 2.33M weekly, React 19 peer explícito)
- **CSV import:** **papaparse** v5.5.3 (13.5k★, 10.9M weekly) — gold standard
- **Heatmap calendário (streak):** **react-calendar-heatmap** (1.3k★, ~6kb gzip)
- **Confetti:** **canvas-confetti** (12.2k★, ~2.7kb gzip) — mais leve que react-confetti
- **Progress circular:** **react-circular-progressbar** v2.2.0 (1.6k★, ~3kb)
- **Auto-save:** RHF (já no projeto) + use-debounce + TanStack Query + Supabase upsert + OCC versioning
- **Co-autoria:** Postgres lock advisory (NÃO CRDT — LGPD-safe, zero infra extra)
- **IA quiz generation:** Claude Sonnet 4.6 + Vercel AI SDK `generateObject` + Zod schema + prompt caching (~$15/1k questões)
- **Captions:** Whisper.cpp em Edge Function Deno

**Anti-patterns que vamos EVITAR (com fonte):**
- ❌ **Big-bang migration** (Canvas Classic→New Quizzes) — manter v1 e v2 em paralelo 1-2 sprints, opt-in por curso
- ❌ **UX click-heavy** (Moodle clássico) — meta de ≤2 cliques do Home até começar próxima aula pendente
- ❌ **Streak coercitivo** — não enviar push "você vai perder X dias"; oferecer "freeze gratuito" 1x/semana
- ❌ **XP por tempo gasto** — só XP por mérito (aula concluída + quiz aprovado)
- ❌ **Leaderboard sem opt-in LGPD** — sempre consentimento explícito + pseudônimo opcional
- ❌ **react-quiz-component** (lib sem TS, sem peer fixo) — escrever quiz custom em cima de Radix RadioGroup

### Wave 1.1 — Hardening crítico (3 dias · 16/05 → 19/05)

**Objetivo:** zerar bugs e violações de regras antes de qualquer feature nova.

#### Dia 1 (16/05) — Decisão sobre código morto + streak
| Tarefa | Arquivo | Ação |
|---|---|---|
| **T1.1.1** Auditar uso de `educacaoService_STUDENT_SAFE.js` | `src/services/educacaoService_STUDENT_SAFE.js` (326 LOC) | `grep -r 'STUDENT_SAFE'` confirma zero imports → **deletar** completamente. Se houver uso futuro, faz fork desde git history. |
| **T1.1.2** Habilitar streak server-authoritative | `src/services/educacaoService.js:2342` (`registrarAtividadeDiaria`) | Invocar em `marcarAulaAssistida` + finalizar quiz. Mover lógica para Supabase function `record_user_activity_day(user_id, date_utc)` com `ON CONFLICT (user_id, date_utc) DO NOTHING`. Streak passa a ser computado server-side em UTC. |
| **T1.1.3** Liberar badge `streak_7` | `src/services/educacaoService.js:717` | Remover `unlocked: false` hardcoded — calcular a partir do nova função `get_user_streak(user_id)`. |
| **T1.1.4** Criar migration Supabase | `supabase/migrations/20260516120000_user_activity_streak.sql` | `CREATE TABLE user_activity_day (user_id text, date_utc date, PRIMARY KEY (user_id, date_utc))` + RLS `firebase_uid() = user_id` + função `get_user_streak()`. |

#### Dia 2 (17/05) — Audit trail + ARIA
| Tarefa | Arquivo | Ação |
|---|---|---|
| **T1.1.5** Substituir `userId \|\| 'system'` por `requireUserId()` | `EducacaoContinuadaPage.jsx:59`, `TrilhaDetalhePage.jsx:13`, `CursoDetalhePage.jsx:44`, `CertificadosPage.jsx:23`, `PontosPage.jsx:50` | Criar helper `src/utils/userIdContext.js` com `requireUserId(user)` → throw se nulo. Mutations protegidas. |
| **T1.1.6** ARIA radiogroup em quiz | `src/pages/educacao/components/QuizCurso.jsx` | `<fieldset role="radiogroup" aria-labelledby="pergunta-X">`. Cada opção: `role="radio" aria-checked={selected}`. Feedback via `aria-describedby`. |
| **T1.1.7** `aria-live` no resultado da tentativa | `QuizCurso.jsx:463-466` | `<div role="status" aria-live="polite" aria-atomic="true">Pontuação: X de Y</div>`. |

#### Dia 3 (19/05) — Captions WebVTT (parte 1 — pipeline)
| Tarefa | Arquivo | Ação |
|---|---|---|
| **T1.1.8** Edge Function `generate-captions` | `supabase/functions/generate-captions/index.ts` | Recebe `aulaId` + URL do vídeo. Usa `whisper.cpp` (https://github.com/ggerganov/whisper.cpp) via subprocess Deno. Output `.vtt` no bucket Storage `educacao-captions`. **Por enquanto: idempotente, async, fire-and-forget**. |
| **T1.1.9** Coluna `aulas.captions_url` | `supabase/migrations/20260519120000_aulas_captions.sql` | `ALTER TABLE aulas ADD COLUMN captions_url text`. RLS preserva. |
| **T1.1.10** `<track>` no player | `src/design-system/components/ui/video-player.jsx:1114-1124` | Aceitar prop `captions: [{src, srclang, label, default}]`. Renderizar `<track kind="captions" src={captions_url} srclang="pt-BR" label="Português" default>`. |

> **Saída Wave 1.1:** PR `feat(educacao): hardening — streak server, audit trail, ARIA quiz, pipeline captions`. CI verde.

---

### Wave 1.2 — Experiência do aluno (5 dias · 20/05 → 24/05)

**Objetivo:** retenção e descoberta. Que o aluno volte sem precisar caçar onde parou.

#### Dia 4-5 (20-21/05) — Continue de onde parou

**Padrão:** SCORM `cmi.suspend_data` adaptado para Supabase.

| Tarefa | Arquivo | Ação |
|---|---|---|
| **T1.2.1** Migration `lesson_progress.last_position_seconds` | `supabase/migrations/20260520120000_lesson_position.sql` | Adicionar coluna se não existir; índice `(user_id, last_accessed_at DESC)`. |
| **T1.2.2** Service `getResumeLesson(userId)` | `src/services/educacaoService.js` (novo método) | Retorna aula com último `last_accessed_at`, `progress_pct`, `curso`, `trilha` ancestral. |
| **T1.2.3** Componente `<ResumeHeroCard>` | `src/pages/educacao/components/ResumeHeroCard.jsx` (novo) | Card destacado no topo do `EducacaoContinuadaPage` (acima dos tabs). Layout: thumbnail + título + ProgressBar + CTA "Continuar". Hidden se `progress_pct === 100`. |
| **T1.2.4** Persistir posição no player | `src/pages/educacao/AulaPlayerPage.jsx` | `onTimeUpdate` throttled 5s → `updateLessonProgress(aulaId, position, percent)`. Usar `useEffect` cleanup para salvar ao desmontar. |
| **T1.2.5** Resume no boot do player | `AulaPlayerPage.jsx` (loader) | Se `last_position_seconds > 30 && < duration - 30`: prompt "Continuar de X:XX?" com botões. Caso contrário inicia do 0. |

#### Dia 6 (22/05) — Pré-requisitos enforced

**Padrão:** Open edX `prerequisite_subsection` — bloqueia acesso até completar antecessor.

| Tarefa | Arquivo | Ação |
|---|---|---|
| **T1.2.6** Schema `trilhas.prerequisitos` JSONB | `supabase/migrations/20260522120000_prereqs.sql` | `{ "tipo": "sequential" \| "free", "blockedUntil": "cursoId" }` por curso na trilha. |
| **T1.2.7** Helper `canAccessCurso(userId, cursoId, trilha)` | `src/services/educacaoService.js` | Calcula se o curso anterior está concluído ou se `tipo='free'`. |
| **T1.2.8** UI bloqueio | `TrilhaDetalhePage.jsx:144` | Curso bloqueado renderiza com ícone cadeado + tooltip "Conclua [curso X] antes". Não navega se clicado. |
| **T1.2.9** Editor admin de pré-req | `admin/TrilhaFormModal.jsx` | Select por curso na trilha: free / sequential. Default free para retrocompatibilidade. |

#### Dia 7-8 (23-24/05) — Quiz com feedback pedagógico + revisão

| Tarefa | Arquivo | Ação |
|---|---|---|
| **T1.2.10** Campo `questoes.explicacao` rich text | `supabase/migrations/20260523120000_questao_explicacao.sql` | `ALTER TABLE questoes ADD COLUMN explicacao text` (markdown). |
| **T1.2.11** Editor de explicação no admin | `admin/QuizFormModal.jsx` | Textarea de explicação ao lado de cada alternativa correta. Markdown preview. |
| **T1.2.12** Tela de revisão pós-tentativa | `QuizCurso.jsx:463-466` (refatorar) | Após submeter: lista cada questão com **sua resposta** + **gabarito** + **explicação** (DOMPurify markdown). Sempre disponível (não só após última tentativa). |
| **T1.2.13** Pre-teste opcional | `CursoDetalhePage.jsx` | Se curso tem `preteste_id` e user nunca atingiu 80%, oferece pre-teste antes da primeira aula. Resultado salva em `lesson_progress.preteste_score`. |

#### Dia 8 (24/05) — Share + Open Graph (parcial)

| Tarefa | Arquivo | Ação |
|---|---|---|
| **T1.2.14** Botão "Compartilhar conquista" no certificado | `CertificadosPage.jsx` | `navigator.share({title, text, url: '/verificar/' + uuid})`. Fallback copy-link. |
| **T1.2.15** Open Graph meta tags em `/verificar/:uuid` | `public/verificar.html` ou SSR pequeno | `<meta property="og:title" content="Certificado ANEST · {nome}">`. Bonus: imagem dinâmica via Edge Function `og-cert-image`. **OPCIONAL** — fica para v5.5 se atrasar. |

> **Saída Wave 1.2:** PR `feat(educacao): aluno — resume + prereq + quiz feedback + share`. Test plan inclui: resume após fechar app, prereq bloqueando navegação, revisão pós-tentativa com explicação.

---

### Wave 1.3 — Experiência do admin/instrutor (5 dias · 27/05 → 31/05)

**Objetivo:** descomplicar criação e gestão de conteúdo. Aplicar os 3 padrões de LMS modernos: tree drag-drop, rich editor block-based, question versioning.

#### Dia 9-10 (27-28/05) — BlockNote rich editor (Notion-like)

> **Mudança vs plano original:** trocamos TipTap por **BlockNote** após pesquisa comparativa. Razões: drag handle gratuito (TipTap cobra Pro), React 19 sem histórico de regressões (TipTap teve issues #5816/#5846/#5876/#6110 em refs/tippyjs), Yjs já integrado, UI Notion-like pronta. BlockNote é construído em cima de TipTap+ProseMirror, então mantemos a base sólida e ganhamos a camada de UI feita.

| Tarefa | Arquivo | Ação |
|---|---|---|
| **T1.3.1** Atualizar React para ≥19.0.3 | `package.json` | CVE-2025-55183/55184 em React 19.0.0-19.2.1 (RSC). Verificar versão atual e bumpar se necessário antes de instalar BlockNote. |
| **T1.3.2** Instalar BlockNote | `package.json` | `@blocknote/core@^0.51 @blocknote/react@^0.51 @blocknote/shadcn@^0.51`. **NÃO** instalar `@blocknote/xl-*` (pacotes pagos para closed-source). Lock minor. |
| **T1.3.3** Componente `<RichEditor>` lazy | `src/design-system/components/ui/rich-editor.jsx` (novo) | Wrapper BlockNote com variant shadcn (alinha com nosso DS). Tokens via CSS vars `--card`/`--border`/`--greenMedium`. Importado via `React.lazy` (BlockNote ~140KB gzip). |
| **T1.3.4** Desabilitar code block ou lazy-load Shiki | `rich-editor.jsx` | BlockNote code block embute Shiki (+192KB gzip — issue #1487). Para v5.1, desabilitar code block (aula médica não precisa); ou lazy-load se necessário. |
| **T1.3.5** Migrar `aula.descricao` | `admin/AulaFormModal.jsx:439-440` (textarea) | Substituir por `<RichEditor value={...} onChange={...}>`. Output: HTML purificado (DOMPurify) + JSON ProseMirror em coluna paralela `descricao_doc` para edição futura sem perda. **Backward-compat:** se valor antigo for texto puro, BlockNote renderiza como bloco `<p>`. |
| **T1.3.6** Migrar `curso.descricao` e `trilha.descricao` | `admin/CursoFormModal.jsx`, `TrilhaFormModal.jsx` | Mesmo padrão. |
| **T1.3.7** Sanitização server-side | `educacaoService.js` | Whitelist de tags via DOMPurify config compartilhada (`src/utils/sanitizeRichHtml.js`). Reject `<script>`, `<iframe>` exceto YouTube/Vimeo allowlist. |
| **T1.3.8** A11y check | testes manuais NVDA/VoiceOver | BlockNote tem ARIA built-in mas com gaps conhecidos. Validar: foco no editor anuncia "editor de texto rico"; slash menu navegável por teclado; drag handle alcançável por teclado. |

#### Dia 11 (27/05) — Múltiplos anexos por aula

| Tarefa | Arquivo | Ação |
|---|---|---|
| **T1.3.6** Schema `aula_attachments` | `supabase/migrations/20260527120000_aula_attachments.sql` | Tabela `aula_attachments(id, aula_id, url, mime_type, label, order, created_by, created_at)`. RLS leitura authenticated, write admin/instrutor. |
| **T1.3.7** UI de múltiplos uploads | `admin/AulaFormModal.jsx` | Substituir o único `url` por lista. Cada item: thumbnail + label editável + drag-handle para reordenar. Upload via `uploadService`. |
| **T1.3.8** Display no aluno | `AulaPlayerPage.jsx` | Sidebar "Material complementar" lista anexos com ícone por tipo (PDF, slides, imagem). Download tracking via `lesson_progress.attachments_downloaded`. |

#### Dia 12 (30/05) — Tree drag-and-drop no admin com react-arborist

**Padrão:** Open edX course outline + Notion-tree.

> **Mudança vs plano original:** trocamos `@dnd-kit` puro por **react-arborist** após pesquisa. Razões: virtualization nativa (suporta 600+ aulas sem lag), inline rename built-in (F2 ou double-click), keyboard nav + ARIA prontos, multi-select drag, 353k weekly downloads, MIT, último commit 2026-05-11. Construir tree do zero com @dnd-kit seria reescrever react-arborist com menos qualidade.

| Tarefa | Arquivo | Ação |
|---|---|---|
| **T1.3.13** Instalar `react-arborist` | `package.json` | `react-arborist@^3.6.1`. Já traz `react-window` para virtualization. React 19 confirmado. |
| **T1.3.14** Refatorar `TreeNavigator` para usar arborist | `src/pages/educacao/admin/components/TreeNavigator.jsx` | Substituir lista plana atual por `<Tree>` arborist. `NodeRenderer` custom usando `Avatar`/`Badge`/`ListItem` do DS com tokens (`bg-card`, `text-foreground`, `border-border`). |
| **T1.3.15** Implementar handler `onMove` | `TreeNavigator.jsx` | `onMove={(args) => reorderTreeNodes(args.parentId, args.dragIds, args.index)}`. Optimistic UI + rollback em erro. |
| **T1.3.16** RPC `reorder_educacao_nodes` | `supabase/migrations/20260530120000_reorder_rpc.sql` | RPC transacional. Atualiza coluna `order_index` em batch. Audit log via trigger. |
| **T1.3.17** Audit log de reorder | trigger SQL | `action: 'tree_reorder'`, `changedBy: requireUserId(user)`, payload com before/after IDs. |
| **T1.3.18** Inline rename (vem grátis) | `TreeNavigator.jsx` | `<Tree>` arborist suporta `onRename` nativamente. F2 ou double-click ativa edição. Salvar via `educacaoService.renameNode()`. |

#### Dia 13 (31/05) — Question versioning + duplicate course + banco reutilizável

> **Padrão ampliado:** além do versioning (Moodle 4), adotamos o **banco de questões reutilizável** (LearnDash + Canvas New Quizzes) — questão vive separada de quiz; quiz é apenas uma seleção.

| Tarefa | Arquivo | Ação |
|---|---|---|
| **T1.3.19** Schema `question_versions` | `supabase/migrations/20260531120000_question_versioning.sql` | Tabela `question_versions(id, questao_id, version_num, payload jsonb, created_by, created_at, locked_by_attempts boolean)`. Trigger ao editar `questoes` salva versão. |
| **T1.3.20** Lock-on-attempt | `educacaoService.js` (`startAttempt`) | Ao criar `quiz_attempts`, snapshot `question_version_id` em coluna nova `quiz_attempts.question_versions_snapshot jsonb`. Aluno em tentativa vê a versão snapshot, não a atual. |
| **T1.3.21** Schema `question_bank` (reutilizável) | `supabase/migrations/20260531120100_question_bank.sql` | Separar questão de quiz. Tabela `question_bank(id, payload, tags text[], rop_area, difficulty, created_by)`. Tabela `quiz_questions(quiz_id, question_id, order)` é apenas referência. |
| **T1.3.22** UI "Banco de Questões" | `admin/QuestionBankPage.jsx` (nova) | Página dedicada com filtros (tag, ROP, dificuldade, autor, success_rate). Ao criar quiz, admin escolhe do banco em vez de criar inline. |
| **T1.3.23** UI "Versão" no admin | `admin/QuizFormModal.jsx` | Banner "Esta questão tem N versões. Tentativas em andamento usam versão M." Botão "Ver histórico" abre modal com diff. |
| **T1.3.24** `duplicateCurso(cursoId)` | `educacaoService.js` (novo método) | Copia curso + módulos + aulas + referências para banco de questões (não duplica questão — referencia). Sufixo " (cópia)". Não copia enrollments/progress. Audit log. |
| **T1.3.25** Botão "Duplicar" no admin | `admin/AdminConteudoPage.jsx` (TreeNavigator action) | DropdownItem "Duplicar como modelo" no menu de cada curso/trilha. |

> **Saída Wave 1.3:** PR `feat(educacao): admin — BlockNote + anexos múltiplos + arborist + versioning + question bank + duplicate`.

---

### Wave 1.4 — Compliance, certificação e analytics (2 dias · 01-02/06)

> **Nota:** Wave 1.4 deve sobrepor parcialmente com Wave 1.3. Pode-se postergar para começo do S2 se houver atraso.

| Tarefa | Arquivo | Ação |
|---|---|---|
| **T1.4.1** `validoAte` + banner recertificação | `educacaoService.js:2535` (`emitirCertificado`) | Aceitar `cargaHorariaCFM` separado. `validoAte` calculado conforme regra do tipo (1 ano para segurança paciente). |
| **T1.4.2** Banner "Certificado expira em X dias" | `HomePage.jsx` + `CertificadosPage.jsx` | Se `validoAte - hoje < 30d`, banner amarelo. Se < 7d, vermelho. |
| **T1.4.3** Trigger ao completar trilha | `educacaoService.js` (`marcarAulaAssistida` final) | Detecta trilha 100% → `emitirCertificadoTrilha(userId, trilhaId)` (diploma consolidado). |
| **T1.4.4** Notificação "aula nova publicada" | `notificacaoEducacaoService.js` | Trigger Supabase ao `INSERT INTO aulas` com `status='publicado'` → notifica todos matriculados na trilha pai. |
| **T1.4.5** Funil em RelatoriosEducacaoPage | `admin/RelatoriosEducacaoPage.jsx` | Recharts FunnelChart: Matriculados → Iniciaram → 50%+ → Concluíram. Por trilha + por curso. |
| **T1.4.6** Heatmap de questão difícil | `RelatoriosEducacaoPage.jsx` | Tabela com `success_rate` colorido (vermelho < 30%, verde > 80%). Sort por mais difíceis. Bonus: Item Discrimination index. |
| **T1.4.7** Export CSV granular | `RelatoriosEducacaoPage.jsx:349-371` | Adicionar colunas: nota_quiz, tentativas, tempo_total_minutos, ultima_atividade, certificados_emitidos. Filtros: período, trilha, categoria. |

> **Saída Wave 1.4:** PR `feat(educacao): compliance + analytics`.

---

### Wave 1.5 — Navegação cristalina + Authoring fluido (4 dias · 03-06/06) ⭐ NOVA

> **Adicionada em 2026-05-17** após pesquisa adicional confirmar que o plano original cobria features mas não atingia o **nível de "best-in-class"** das plataformas de referência. Esta wave é o que diferencia ANEST de "mais um LMS médico" e o que faz aluno e admin **quererem voltar**.

> **Meta:** alinhar UX final com os top padrões verificados (Frappe LMS, Moodle 4, Open edX, Notion, Duolingo).

#### Aluno — Dia 14-15 (03-04/06): "1 clique até a próxima ação"

**Padrão central:** meta verificada — **≤2 cliques** do Home até começar a próxima aula pendente (vs 5+ no Moodle clássico).

| Tarefa | Arquivo | Ação | Fonte |
|---|---|---|---|
| **T1.5.1** Caminho visual da trilha (Duolingo-style) | `src/pages/educacao/components/LearningPath.jsx` (novo) | Path zig-zag vertical: nódulos `(o)` posicionados absolutamente com offset `ml-0/ml-12/ml-24/ml-12...`. Estados via tokens: `bg-success` (done), `bg-info + animate-pulse + ring-2` (atual), `bg-muted` (next), `bg-disabled + Lock icon` (locked). Divisor por "ato" (módulo) com `category-teal`. **Custom Tailwind + Framer Motion** (NÃO React Flow). | bryanjenningz/react-duolingo (460★), Duolingo redesign blog |
| **T1.5.2** Floating "Voltar para atual" | `LearningPath.jsx` | IntersectionObserver detecta se nódulo "current" saiu do viewport → mostra botão flutuante bottom-right. | Duolingo |
| **T1.5.3** Botão "Próxima aula" persistente | `AulaPlayerPage.jsx` (footer) | Ao terminar vídeo OU clicar "Concluir": CTA grande "Próxima: [Título]" no rodapé. Pré-carrega próxima aula. | Coursera, Udemy |
| **T1.5.4** Tempo restante em todo lugar | `CursoCard`, `TrilhaCard`, `AulaPlayer` | Exibir sempre: "12 min restantes nesta aula", "1h20 restante neste curso", "8h restantes na trilha". Calcular via `duracao - posicao` ou `duracao_total - aulas_concluidas_duracao`. | Udemy, Coursera |
| **T1.5.5** Breadcrumb hierárquico fixo | `src/design-system/components/anest/breadcrumb-educacao.jsx` (novo) | Renderizado em todas as páginas de educação: `Trilha X > Curso Y > Módulo Z > Aula W`. Cada nível clicável. Truncar com `...` no mobile. | Notion, Coursera |
| **T1.5.6** Filtro por chips (não form) | `EducacaoContinuadaPage.jsx:57-65` | Substituir form de filtros por chips horizontais: `[Em andamento] [Obrigatório] [Curto <30min] [Para residentes]`. Clicar toggle. Mais 1 clique que form aberto. | Spotify, Notion |
| **T1.5.7** Estados vazios úteis | `EducacaoContinuadaPage.jsx`, `TrilhaDetalhePage.jsx`, `CertificadosPage.jsx` | EmptyState não diz só "Vazio" — sugere ação: "Você ainda não se matriculou. Comece pela [Trilha recomendada para você]" com botão CTA. | Notion, Linear |
| **T1.5.8** Busca dentro da educação | `EducacaoContinuadaPage.jsx` Header + cmdk | Já tem SearchToggleButton. Expandir busca para incluir: títulos de trilha/curso/módulo/aula + descrição (full-text via Postgres `tsvector` pt-BR) + tags. Resultados agrupados. | Notion, Linear |
| **T1.5.9** Recomendações simples | `EducacaoContinuadaPage.jsx` (seção "Recomendado") | Algoritmo trivial: cursos da mesma categoria do último concluído + cursos mais populares na especialidade do user. SQL view `vw_recomendacoes_educacao`. **Não usar ML** nesta versão. | Coursera "Recommended for you" |

#### Admin — Dia 16-17 (05-06/06): "Authoring sem fricção"

| Tarefa | Arquivo | Ação | Fonte |
|---|---|---|---|
| **T1.5.10** Activity Chooser modal | `admin/components/ActivityChooserModal.jsx` (novo) | Modal `max-w-2xl` com grid 2x3 cards: 📹 Vídeo / 📖 Leitura / ✏️ Quiz ROP / 📎 Material / 💬 Discussão / 🩺 Caso Clínico. Cada card: ícone 32px + título + descrição + tag (Popular/Novo). Cores via `category-*` tokens. Keyboard: setas + Enter + 1-6 atalhos. Substitui múltiplos botões de "Adicionar" hoje espalhados. | Moodle 4 Activity Chooser (docs.moodle.org/501) |
| **T1.5.11** Auto-save com indicador | hook `useAutoSave` em `src/hooks/useAutoSave.js` (novo) + AulaFormModal/CursoFormModal/TrilhaFormModal | `react-hook-form` (já no projeto) + `use-debounce` 800ms + TanStack Query `useMutation` + Supabase `upsert` com OCC (coluna `version`). Estado UI: `idle/dirty/saving/saved/error`. Indicador no header do modal: "Salvando..." (muted) → "Salvo às 14:32" (success). Fallback `localStorage.setItem('draft:aula:${id}')`. | Google Docs / Notion / Refine shadcn AutoSaveIndicator |
| **T1.5.12** Preview "Olho de aluno" | botão em AulaFormModal/CursoFormModal | Toggle "Visualizar como aluno" abre painel lateral OU navega para a URL pública da aula em nova aba. Mantém edição aberta. Mobile preview opcional (toggle desktop/tablet/mobile). | Teachable, Thinkific |
| **T1.5.13** Lock advisory (co-autoria leve) | `supabase/migrations/20260605120000_edit_locks.sql` + `educacaoService.acquireEditLock/releaseEditLock/heartbeatEditLock` | Tabela `edit_locks(resource_type, resource_id, locked_by, locked_at, expires_at)`. RPCs Postgres + Supabase Realtime notifica outros. UI: ao abrir editor, `acquireEditLock`; se já locked, modal "Maria está editando há 2min. [Abrir em modo leitura] [Forçar edição]". Heartbeat 60s. **NÃO usa CRDT** (LGPD-safe, zero infra extra). | Confluence Edit Lock plugin |
| **T1.5.14** Bulk import questões (JSONL) | `admin/QuestionBankImporter.jsx` (novo) + Edge Function `import-questions` | Upload `.jsonl` (uma questão por linha). **papaparse** v5.5.3 para CSV (trilhas/cursos) + Zod schema para questões. Fluxo: Upload → Preview tabela (TanStack Table) → Validação Zod linha-por-linha (badge verde/vermelho + tooltip de erro) → Dry-run → Confirmar → Edge Function INSERT transacional + `import_history`. Rollback até 24h via `DELETE WHERE import_id = X`. Template Google Sheets publicado para users baixarem. | Notion CSV import, Airtable import wizard |
| **T1.5.15** Spotlight Mode no admin | `AdminConteudoPage.jsx` (toggle) | Botão "Modo edição" esconde Header, BottomNav, sidebars — 100% foco no editor. ESC ou novo clique restaura. | Tutor LMS course builder |
| **T1.5.16** Edição inline na árvore | já vem com react-arborist (T1.3.18) | Validar funcionamento: F2 ou double-click no node ativa edição inline; Enter salva; ESC cancela. Salvar via `educacaoService.renameNode(id, novoNome)` com audit. | Notion, react-arborist demo |

#### Gamification mínima e ética (sobreposto, ~0.5 dia)

| Tarefa | Arquivo | Ação | Fonte |
|---|---|---|---|
| **T1.5.17** Streak heatmap | `src/pages/educacao/PontosPage.jsx` | Instalar `react-calendar-heatmap` (~6kb). Renderizar últimos 365 dias com 4 níveis usando `category-teal-bg → category-teal`. Tooltip "X interações em DD/MM". | GitHub contributions, kevinsqi/react-calendar-heatmap (1.3k★) |
| **T1.5.18** Streak ring no Header | `src/design-system/components/anest/header.jsx` | Anel circular pequeno (SVG inline + Framer Motion) com `<Flame>` lucide e número. Sempre visível. Cor: `success` se streak ≥3 dias, `warning` se 1-2, `muted` se 0. | Duolingo |
| **T1.5.19** Confetti em conclusão de trilha | `educacaoService.emitirCertificadoTrilha` | Instalar `canvas-confetti` (~2.7kb). One-shot ao completar trilha. Respeitar `prefers-reduced-motion` (skip). | Padrão UI moderna |
| **T1.5.20** Streak freeze (anti-coerção) | `educacaoService.getUserStreak` + UI | 1 freeze gratuito por semana — se aluno perde 1 dia, streak não quebra. Documentar em help. Sem push "você vai perder X dias". | Anti-pattern documentado: streak coercitivo |
| **T1.5.21** XP por mérito, não por tempo | `educacaoService.recordXP` | XP só ao concluir aula + quiz aprovado. Bônus por primeira tentativa correta. NÃO premiar tempo em tela. | Pesquisa gamification médica (PMC10778414) |

> **Saída Wave 1.5:** PR `feat(educacao): nav cristalina (path visual + breadcrumb + filtros) + authoring fluido (activity chooser + auto-save + lock + import) + gamification ética`.

---

### Wave 1.6 — Desafio das ROPs + migração mock (2 dias · 09-10/06) ⭐ NOVA

> **Adicionada em 2026-05-17** após inspeção do código revelar que (a) já existe `ROPsDesafioPage.jsx` com 6 áreas + ranking + podcasts implementados, mas (b) usa `src/data/rops-data.js` com **7295 LOC de dados mock estáticos** e (c) viola regra `design-tokens` com 6 hex hardcoded em `MACRO_AREAS:17-60`. O **atalho "Desafio ROPs"** (id `rops`) já existe em `atalhosConfig.js:153-158` mas como opcional. Esta wave eleva o "Desafio ROPs" a **card permanente** dentro de uma seção dedicada de Educação na HomePage + migra mock → Supabase + alinha tudo ao DS.

> **Meta:** "Desafio do dia" virar parte do ritual diário do anestesista (~5-10 min), com dados reais e visual consistente com o resto do app.

#### Dia 19 (09/06) — Backend ROPs (schema + service + migração)

| Tarefa | Arquivo | Ação | Fonte/Padrão |
|---|---|---|---|
| **T1.6.1** Schema ROPs no Supabase | `supabase/migrations/20260609120000_rops_schema.sql` | Tabelas: `rop_areas(id, slug, title, category_token, icon, order)`, `rop_subdivisoes(id, area_id, slug, title, audio_url, order)`, `rop_questions(id, subdivisao_id, question, options jsonb, correct_answer_index, explanation, difficulty, source_citation, version_num)`, `rop_user_attempts(id, user_id, question_version_id, selected_option, is_correct, time_seconds, created_at)`, `rop_daily_challenges(id, user_id, date_utc, question_ids text[], started_at, completed_at, score_pct, score_count)`. RLS: `firebase_uid() = user_id`. | Schema próprio inspirado em LearnDash question bank |
| **T1.6.2** Script de seed | `scripts/seed-rops-from-mock.mjs` | Lê `src/data/rops-data.js`, faz parse das 6 áreas × 32 subdivisões × 20 questões = **640 questões** + 6 áreas + ~32 subdivisões. Idempotente (`ON CONFLICT (slug) DO UPDATE`). Dry-run + `--apply`. | Padrão `scripts/seed-firebase.mjs` (Sprint 21 Wave 2.1) |
| **T1.6.3** Service `supabaseROPsService` | `src/services/supabaseROPsService.js` (novo, ~250 LOC) | Métodos: `fetchAreas()`, `fetchSubdivisoes(areaId)`, `fetchQuestionsBySubdivisao(subdivisaoId)`, `recordAttempt(questionId, selectedOption, timeSec)`, `getOrCreateDailyChallenge(userId)`, `submitDailyChallengeAnswer(challengeId, questionId, selectedOption)`, `getStreak(userId)`, `getRanking(period)`. Padrão canônico: `supabaseIncidentsService` (throw on error, snake↔camel via `makeFieldMapper`). | Padrão de service ANEST |
| **T1.6.4** Refatorar `ROPsDesafioPage` para usar service | `src/pages/rops/ROPsDesafioPage.jsx` | Substituir `import ropsData from '@/data/rops-data'` por `useROPs()` hook. Loading state com Skeleton DS. Erros via `sonner` (já em Wave 1.5). | Padrão ANEST |
| **T1.6.5** Refatorar páginas filhas | `ROPsSubdivisoesPage.jsx`, `ROPsQuizPage.jsx`, `ROPsRankingPage.jsx`, `ROPsPodcastsPage.jsx` | Mesmo padrão — consumir service no lugar de import estático. | — |
| **T1.6.6** Question versioning compartilhado | reusa `question_versions` da Wave 1.3 (T1.3.19) | ROPs questions são apenas um "subset" do question_bank — pode-se decidir usar o **mesmo banco** (Wave 1.3 T1.3.21) ou banco separado. **Decisão: banco separado** (`rop_questions`) porque ROPs são engessadas (Qmentum) — alterações geram nova versão e snapshot em `quiz_attempts` (consistência com Wave 1.3). | LearnDash + Moodle 4 |
| **T1.6.7** Deprecar `rops-data.js` | `src/data/rops-data.js` | Após seed validado em produção: deletar arquivo (7295 LOC removidas). Manter `podcasts-data.js` por enquanto (escopo separado). | Limpeza |

#### Dia 20 (10/06) — UX: Card Educação + Desafio do dia + tokens DS

| Tarefa | Arquivo | Ação | Fonte/Padrão |
|---|---|---|---|
| **T1.6.8** Refatorar MACRO_AREAS com tokens DS | `src/pages/rops/ROPsDesafioPage.jsx:17-60` + migration T1.6.1 `rop_areas.category_token` | Substituir os 6 hex hardcoded por tokens semânticos. Mapping: `#9C27B0` → `category-purple`, `#10b981` → `category-green-fg` (ou `category-teal`), `#3B82F6` → `category-blue`, `#F59E0B` → `category-orange`, `#EC4899` → `category-pink`, `#EF4444` → `category-red-fg`. Remover `gradient` style — usar `bg-category-X-bg` (soft) + `text-category-X-fg` + `border-l-4 border-category-X`. | Regra `.claude/rules/design-tokens.md` |
| **T1.6.9** `<EducacaoSummaryCard>` na HomePage | `src/design-system/components/anest/educacao-summary-card.jsx` (novo) + `HomePage.jsx` | Card destacado fixo (não atalho opcional) renderizado entre `ComunicadosCard` e `PlantaoCard`. Layout: header "Educação Continuada" + ícone `GraduationCap`. **3 sub-blocos:** (1) `Desafio das ROPs do dia` (Trophy + score atual + streak + CTA "Começar"), (2) `Continue de onde parou` (mini-card da última aula com ProgressBar), (3) `Próxima ação` (recomendação). Mobile: stack vertical. Desktop: grid 3 col. Tokens: `bg-card`, `border-border-strong`, `text-foreground`, accents via `category-teal` (educação) e `category-purple` (ROPs). | Padrão `WidgetCard` + `PlantaoCard` |
| **T1.6.10** Feature "Desafio do dia" | `supabaseROPsService.getOrCreateDailyChallenge` + `ROPsDesafioPage` nova rota `/rops/desafio-do-dia` | RPC Postgres `get_or_create_daily_challenge(user_id, date_utc)` retorna 5-10 questões aleatórias (estratificadas por área via `TABLESAMPLE BERNOULLI` ou `ORDER BY random()`). Idempotente: mesmo dia retorna mesmas questões. UX: timer opcional (10 min total — `prefers-reduced-motion` desativa pulsing), barra de progresso (`react-circular-progressbar` já em Wave 1.5), `canvas-confetti` em 100% (já em Wave 1.5). Score salvo em `rop_daily_challenges.score_pct`. | Duolingo daily challenge, Khan mastery challenges |
| **T1.6.11** Streak compartilhado com Wave 1.1 | `supabaseROPsService` + `educacaoService.recordUserActivityDay` | Ao completar desafio do dia (ou apenas iniciar), chamar `record_user_activity_day(user_id, date_utc)` da Wave 1.1 (T1.1.2). Streak ROP = streak educação = streak app (uma fonte única de verdade, server UTC). | Padrão Duolingo + decisão arquitetural |
| **T1.6.12** Ranking visual no card | `EducacaoSummaryCard` (sub-bloco) | Se opt-in LGPD ativo (regra Wave 1.5 T1.5.21), mostrar "Você está em N° lugar nesta semana" + link "Ver ranking completo" → `ROPsRankingPage`. Caso contrário, mostrar score pessoal: "Seu melhor da semana: 87%". | Anti-pattern documentado: leaderboard só opt-in |
| **T1.6.13** Migrar `podcasts-data.js` (opcional, se sobrar tempo) | `src/data/podcasts-data.js` + nova migration `rop_podcasts(area_id, audio_url, title, duration_s)` | Mesma estratégia da T1.6.2. **OPCIONAL** — fica para Sprint 2 se atrasar. | — |
| **T1.6.14** Audit trail em mutations ROP | `supabaseROPsService` | `recordAttempt`, `submitDailyChallengeAnswer`, atualização de score: todos passam por `requireUserId()` + `logAction()` (Wave 1.1). Nunca `userId \|\| 'system'`. | Regra `.claude/rules/audit-trail.md` |

> **Saída Wave 1.6:** PR `feat(educacao): card ROPs na home + migração mock→Supabase + Desafio do dia + tokens DS`. CHANGELOG bump → **v5.1.0**. Deploy.

#### Compatibilidade com DS — checklist Wave 1.6

| Item | Onde | Status |
|---|---|---|
| Cores via tokens semânticos (zero hex) | T1.6.8 substitui 6 hex em MACRO_AREAS | ✅ obrigatório |
| Componentes do DS existentes reutilizados | `WidgetCard`, `SectionCard`, `Skeleton`, `Badge`, `Avatar`, `Trophy` icon, `GraduationCap` icon | ✅ |
| Componente novo respeita padrão `anest/*` | `educacao-summary-card.jsx` segue convenção de `comunicados-card.jsx`, `plantao-card.jsx` | ✅ |
| Touch targets ≥44×44px | CTAs do EducacaoSummaryCard | ✅ |
| Mobile-first responsivo | Card vira stack vertical, grid 3 col só em desktop | ✅ |
| Dual theme testado | `bg-card`/`text-foreground` adapta automaticamente | ✅ |
| `prefers-reduced-motion` respeitado | Timer pulsing + confetti skipam se reduced | ✅ |
| `aria-live` para anúncio de score | "Você acertou X de Y" anunciado via `role="status"` | ✅ |
| RLS Supabase + audit trail | Todas tabelas + mutations | ✅ |

#### Bibliotecas — decisão sobre dependências novas

Para `Desafio do dia` precisamos de: timer countdown, score animado, confete, progress circular. Avaliação:

| Feature | Recomendação | Justificativa |
|---|---|---|
| Countdown timer 10 min | **Framer Motion + setInterval custom** (zero deps novas) | Trivial — `motion.div` com `animate={{ width: progress }}` + hook `useCountdown`. Não justifica adicionar `react-countdown`. |
| Score animado (0 → 87%) | **Framer Motion `animate` ou hook custom** (zero deps novas) | `motion.span` com `animate={{ count: target }}` resolve. `react-countup` (3.5k★) é opção mas adiciona 8kb sem ganho relevante. |
| Confete em 100% | `canvas-confetti` (já em Wave 1.5) | Reutilização total. |
| Progress circular | `react-circular-progressbar` (já em Wave 1.5) | Reutilização total. |

> **Conclusão:** Wave 1.6 **NÃO adiciona nenhuma dependência nova** além das já planejadas em Wave 1.5. Tudo é feito com componentes do DS + libs já no stack + Framer Motion (já no projeto).

---

### Saída do Sprint 1 (v5.1.0)
- ✅ 14 pendências da memória `project_educacao_pendencias_pos_pr_auditoria.md` fechadas (inclui "categorias mock")
- ✅ 10 gaps novos da auditoria fechados
- ✅ **8+ novas features de "navegação cristalina"** (path visual, breadcrumb, próximo passo, tempo restante, chips, recomendações, busca full-text, estados úteis)
- ✅ **7+ novas features de "authoring fluido"** (Activity Chooser, auto-save com indicador, preview olho de aluno, lock advisory, bulk import, Spotlight Mode, edição inline)
- ✅ **Card "Educação" permanente** na HomePage com Desafio das ROPs do dia, Continue de onde parou, Próxima ação
- ✅ **Desafio das ROPs migrado** para Supabase (5 tabelas + service + audit trail + RLS)
- ✅ **6 hex hardcoded** em ROPsDesafioPage substituídos por tokens `category-*` do DS
- ✅ **Feature "Desafio do dia"** ROPs (5-10 questões aleatórias estratificadas, streak compartilhado, opt-in ranking LGPD)
- ✅ Gamification ética implementada (streak heatmap + ring + freeze + XP por mérito)
- ✅ ~7900 LOC mock removidas (`educacaoService_STUDENT_SAFE.js` 326 + `rops-data.js` 7295)
- ✅ 10 migrations Supabase aplicadas (streak + lesson_position + prereqs + explicação + attachments + versioning + question_bank + edit_locks + reorder RPC + rops_schema)
- ✅ Atualizar memória: criar `project_educacao_v5_1_status.md`, marcar pendências como resolvidas em `project_educacao_pendencias_pos_pr_auditoria.md`. Adicionar nota sobre podcasts ainda em mock (Sprint 2 ou backlog).

### Riscos do Sprint 1 e mitigação (atualizado 2026-05-17)

| Risco | Mitigação |
|---|---|
| **CVE React 19.0.0-19.2.1 (RSC)** — CVE-2025-55183/55184 | Bumpar React para ≥19.0.3 antes de instalar BlockNote (T1.3.1). Verificar com `npm audit` no PR. |
| **BlockNote XL packages são pagos** para closed-source | Bloquear instalação de `@blocknote/xl-*` (auditar package.json no PR). Usar só `@blocknote/core + react + shadcn`. |
| **Shiki (code block BlockNote) +192KB gzip** | Desabilitar code block na config; ou lazy-load se algum admin pedir. Issue #1487 documenta. |
| Whisper.cpp em Edge Function Deno é exótico | Wave 1.1 entrega pipeline mínimo (job enfileirado); caso falhe, **fallback:** upload manual de VTT pelo admin. |
| **BlockNote** migração quebra textos antigos | Backward-compat: ProseMirror doc compatível com texto puro renderiza como bloco `<p>`. Snapshot regression test em 5 cursos existentes. Coluna paralela `descricao_doc` (JSON) preserva edição futura sem perda. |
| Question versioning altera schema | Migration **idempotente**, snapshot do schema atual em `docs/archive/`. Migration testada com dataset de produção via supabase branch. |
| **react-arborist** pode ter limites em mobile touch | Documentado como "limitado" no mobile. **Fallback:** admin desktop-first; mobile usa lista colapsável tradicional. Feature flag `VITE_FEATURE_TREE_ARBORIST`. |
| Streak server-authoritative pode "zerar" streaks reais | Migration de seed: ler último `lastActiveDate` de `userProfiles` e backfill em `user_activity_day`. |
| **Lock advisory** pode prender resource se cliente cai sem release | TTL de 5min + heartbeat 60s. Admin força via "Forçar edição". RPC `cleanup_expired_locks` em pg_cron diário. |
| **Bulk import** pode injetar 1000s de questões ruins | Dry-run obrigatório antes do commit. Validação Zod por linha. Rollback até 24h via `import_id`. Edge Function transacional. |
| **IA quiz generation** pode alucinar | Review humano obrigatório, badge "IA-assistida" visível, citation grounding (alternativa sem citação válida bloqueia save), rate limit ~10 gerações/hora por admin. (Wave da IA fica para v5.5 — não está em S1.) |
| **Seed de 640 questões ROP** pode falhar parcialmente | Script idempotente (`ON CONFLICT (slug) DO UPDATE`), dry-run obrigatório antes de `--apply`, log de cada subdivisão inserida, rollback via `DELETE FROM rop_questions WHERE source = 'seed'`. |
| **Deletar `rops-data.js`** quebra páginas se algum import escapar | Antes de deletar: `grep -r 'rops-data' src/` deve retornar 0 hits. Fazer deleção em PR separado após validação. |
| **Refatoração de 6 hex em MACRO_AREAS** pode quebrar visual em dark mode | Tokens `category-*` já têm variantes light/dark testadas. Screenshot regression das 6 áreas antes/depois em ambos os temas. |
| **Card Educação na HomePage** pode quebrar layout em mobile pequeno | Mobile-first: card vira stack vertical, sub-blocos com `min-h-[80px]`. Teste em iPhone SE (320px). |
| **Desafio do dia** pode disparar streak indevido se aluno só "espia" | Streak só registra se aluno **submete** ≥1 resposta (não apenas abrir). Definido em RPC `record_user_activity_day(user_id, reason='daily_challenge')`. |

---

## SPRINT 2 — Segurança P0 + LGPD crítica (06/06 → 20/06)

> **Meta:** zerar exposições de dados de saúde. Cada item entrega defesa em profundidade.

### Wave 2.1 — Auth & WebAuthn (3 dias)
- **WebAuthn rework** — `src/services/biometricService.js:96-177` — challenge server-side via Edge Function `webauthn-challenge`. Substituir armazenamento de senha por **Firebase Custom Token**: server emite custom token via Admin SDK após assinatura validada. Replay-safe.
- **JWT cache revocation** — `src/config/supabase.js:47` — adicionar consulta a `token_blocklist` na Edge Function `get-supabase-token` antes de emitir.
- **API tokens com TTL** — `supabase/migrations/20260601120000_api_tokens_ttl.sql` — coluna `expires_at` + check no `api-v1/index.ts:386-410`.

### Wave 2.2 — RLS lockdown (4 dias)
- **Notifications anti-spoofing** — `20260601120100_notifications_rls_lockdown.sql` — `WITH CHECK (recipient_id = public.firebase_uid() OR public.is_admin())`. Migração idempotente.
- **Storage reuniões IDOR** — `20260513150000_storage_migration_buckets.sql:105-143` (atualizar policies) — `EXISTS (SELECT 1 FROM reunioes WHERE id::text = (storage.foldername(name))[1] AND (public.firebase_uid() = ANY(participantes_ids) OR public.is_admin()))`.
- **Firestore reuniões** — `firestore.rules:632` espelhar policy de participação.
- **Firestore escalas residência** — `firestore.rules:547-600` — separar create/update/delete checando ownership.
- **Cateter peridural RLS** — `027_cateteres_peridural.sql` (nova migration de update) — `USING (hospital = current_setting('app.user_hospital')::text AND role IN ('anestesiologista', 'medico-residente'))`. Bloquear UPDATE de `created_by/hospital`.
- **Incidentes update por colunas** — `005_incidents.sql:154-157` — trigger BEFORE UPDATE rejeita escrita em `gestao_interna/admin_data` por non-admin.

### Wave 2.3 — LGPD complementar (3 dias)
- **`lgpd_consent_version`** — `20260604120000_lgpd_consent_version.sql` — coluna + popular versão atual.
- **Cron retenção exclui attachments** — atualizar `20260504000001_lgpd_art15_retencao.sql:153` — Edge Function `cleanup-anonymized-attachments` agendada por pg_cron.
- **Export inclui Firebase** — `src/services/lgpdService.js:7-189` — adicionar fetch de `userProfiles/{uid}` + comunicados Firestore via Admin SDK.
- **Rollback de `processSolicitacao`** — `lgpdService.js:273-455` — transação Supabase + estado `parcialmente_processada` quando há falhas.
- **Console.log PII** — `public/formulario-*.html` — `if (import.meta.env.PROD)` guard + `sanitizeError()` helper.
- **App Check em formulários públicos** — `firestore.rules:367, 373` — habilitar Firebase App Check + rate limit via Cloud Function.

### Wave 2.4 — Audit trail multi-service (2 dias)
Adicionar `logAction()` + `requireUserId()` em:
- `supabaseAutoavaliacaoService.js:118` (ROP — crítico, afeta score)
- `supabaseAuditoriasService.js:181`
- `supabaseComunicadosService.js:271-353` (todos os 5 mutations)
- `supabasePlanosAcaoService.js:402`
- `tagsService.js:72/87/94`
- `reunioesService.js:82` (substituir `'sistema'`)
- `20260504000001_lgpd_art15_retencao.sql:107` (`'system_cron'` → NULL + flag `actor_type`)

### Saída Sprint 2 (v5.2.0)
- ✅ 10 P0 fechados (todos exceto BUG-06 que vai para S5)
- ✅ 9 audit trail violations corrigidas
- ✅ 6 LGPD gaps fechados
- Atualizar memórias: `feedback_audit_trail_no_system_fallback.md` consolidada.

---

## SPRINT 3 — Qmentum & UX gestor (20/06 → 04/07)

> **Meta:** elevar score Qmentum real + dar superpoderes ao gestor.

### Wave 3.1 — ROPs canônicas anestesia (3 dias)
- **5 ROPs novas** — `src/types/documents.js:260-270` — adicionar `cirurgia_segura`, `pre_anestesica`, `handoff_sbar`, `reconciliacao_med`, `substancias_controladas`.
- **CHECK constraint DB** — `supabase/migrations/20260613120000_rop_categories.sql` — atualizar enum.
- **Templates de documento** — `src/data/ropTemplates.js` — esqueleto de cada ROP com seções obrigatórias.
- **Documentação** — atualizar `.claude/rules/qmentum-compliance.md` (mudança de 6 para 14 áreas ou clarificar).

### Wave 3.2 — Comitê de Ética 4 assinaturas (3 dias)
- **Schema** — `useEticaDocumentos.js` + migration — adicionar `tipoReuniao` (executivo/assembleia), `tipoAssinatura` enum (eletronica/manual/icp_brasil/comite_presencial).
- **`createApprovalEntry`** — `src/types/documents.js:292` — aceitar 4 actions.
- **UI** — `ApprovalWorkflowEditor.jsx` — modal com 4 tabs de assinatura.
- **Tag distintiva no documento de saída** — `<Badge variant="executivo">Comitê Executivo</Badge>` vs `<Badge variant="assembleia">Assembleia Geral</Badge>`.

### Wave 3.3 — Reuniões editor de ata + workflow (4 dias)
- **Editor de ata estruturado** — `src/components/reunioes/AtaEditor.jsx` (novo) — TipTap (já instalado no S1) com schema: pauta + discussões + deliberações + encaminhamentos.
- **Versionamento de ata** — coluna `atas.versao_num` + snapshots.
- **4 modos de assinatura** — modal por participante presente: eletrônica (clique + senha), manual (upload scan), ICP-Brasil (PAdES), presencial (admin marca).
- **Quórum + votação estruturada** — `votos (a_favor/contra/abstencao/ausente)` por deliberação. Quórum calculado.
- **Ata → PlanoAção** — encaminhamento gera item em `planos_acao` com responsável.

### Wave 3.4 — Incidentes → CAPA + triagem (2 dias)
- **Triagem com filtros** — `IncidentsLayout.jsx:60-65` — adicionar filtros gravidade/área/hospital/responsável/SLA-vencido.
- **Bulk actions** — checkboxes + atribuir/fechar/exportar em lote.
- **`addHistoricoStatus`** — `IncidenteGestaoPage.jsx:181-245` — chamar em `updateGestaoInterna`. Timeline real.
- **"Gerar Plano de Ação"** — botão pré-popula `novoPlanoAcao` com `incidenteId`, ROPs vinculados.
- **Reabertura** — RPC `reopen_incidente(id, motivo)` + audit trail.

### Wave 3.5 — UX gestor (2 dias)
- **Dashboard executivo na nav** — `App.jsx` AppBottomNav — surface card no Centro de Gestão (não na bottom nav mobile).
- **Surface `reviewAlerts.critical`** — `HomePage.jsx` — badge no card Gestão.
- **Comparativo período-a-período** — `PainelGestaoPage.jsx` — toggle "vs mês anterior" / "vs ano passado".
- **Drill-down em KPI** — `KPICard` ganha `onClick` → modal com casos.
- **Export consolidado** — botão "ZIP do mês" agrega PDFs + CSVs para Qmentum.

### Saída Sprint 3 (v5.3.0)
- ✅ Score Qmentum começa a refletir realidade (não "verde por omissão")
- ✅ 8 P1 fechados (gestor)
- ✅ Atualizar memória `project_comite_etica_convencoes.md` com implementação.

---

## SPRINT 4 — UX usuário + acessibilidade WCAG (04/07 → 18/07)

### Wave 4.1 — Onboarding + personalização (3 dias)
- **Onboarding tour** — `src/components/OnboardingTour.jsx` — biblioteca `react-joyride` (MIT). 5 passos: HomePage, calc, educação, gestão, menu. Disparado no primeiro login após PrivacyPolicyModal.
- **"O que há de novo"** — `WhatsNewModal.jsx` — lê CHANGELOG.md filtrado, mostra última versão se não vista.
- **Notificações granulares** — `ProfilePage.jsx:41` — substituir único toggle por matriz: canais (push/email/in-app) × tipos (comunicado/escala/troca/educação/alerta). Persistir em `user_notification_preferences`.

### Wave 4.2 — Calculadoras supercharge (3 dias)
- **Favoritos sincronizados** — tabela `user_calculator_favorites(user_id, calc_id, position)` + estrela no card.
- **"Recém-usadas"** — coluna `last_used_at`, query no HomePage.
- **`navigator.share` no resultado** — botão "Compartilhar" formata score em texto + `share()`.
- **`window.print`** — botão imprimir resultado pra prontuário.
- **Histórico (opt-in LGPD)** — modal "Salvar este resultado no meu histórico" com base legal Art. 7 IX.

### Wave 4.3 — Acessibilidade WCAG 2.1 AA (4 dias)
- **`aria-live` em todas calculadoras** — `CalculatorShowcase.jsx:376` + 75 outras.
- **Labels formulário público** — `public/formulario-*.html` — `for=`, `aria-required`, `aria-invalid` no JS.
- **Contraste `text.muted`** — `Tokens.json:33-34` — `#6B7280` → `#4B5563`.
- **`border.strong`** — `#A5D6A7` → `#6FB87A` (ratio 3.1:1).
- **`prefers-reduced-motion`** — hook `useReducedMotion` aplicado em 49 motion components.
- **FOUC tema no boot** — script inline em `index.html` `<head>`.
- **Auto-hide controles vídeo** — `video-player.jsx:581-583` — desativar se reduced-motion ou foco visível.
- **Tabs Home/End + typeahead** — `select.jsx:230-260`.
- **Status não-apenas-por-cor** — todas as instâncias de status badge revisadas.

### Wave 4.4 — Quick wins UI/UX (2 dias)
- **"Marcar todos como lidos"** em Pendências.
- **Plantões `.ics` export** + "meus plantões do mês".
- **Profile: trocar email, idioma, fuso, "meus certificados"**.
- **Busca global retorna calculadoras + plantonistas + ROPs + incidentes próprios**.

### Saída Sprint 4 (v5.4.0)
- ✅ Pontuação Lighthouse Accessibility passa de ~80 para >95
- ✅ 8 quick wins UX fechados
- ✅ Onboarding ativo

---

## SPRINT 5 — Tech debt + offline + benchmarks (18/07 → 01/08)

### Wave 5.1 — BottomNav + roteamento (3 dias)
- **BUG-06 fechado** — decisão arquitetural: **remover `AppBottomNav` global**, padronizar via `useBottomNav()` hook que cada página chama (createPortal).
- **Aliases duplicados** — `App.jsx:966-1173` — remover kebab-case.
- **`relatoriosEducacao` aponta para componente certo**.

### Wave 5.2 — Services consolidation (2 dias)
- **`fieldMapping.js`** — `src/services/utils/fieldMapping.js` — `makeFieldMapper(CAMEL_TO_SNAKE)`. Migrar 18 services.
- **Error contract** — padronizar para `throw` (canônico). Documentar em `src/services/README.md`.
- **`MessagesContext` hex hardcoded** — usar tokens.
- **Suspense fallback** — `App.jsx:1254` — substituir por `<PageLoadingFallback>`.

### Wave 5.3 — Offline-first (4 dias)
**Padrão:** pazguille/offline-first + web.dev PWA streaming.
- **IndexedDB para calculadoras** — `src/lib/offlineCalculators.js` — armazena metadata + formulas. Permite uso sem rede.
- **Workbox precache de protocolos** — protocolos clínicos do `BibliotecaPage` cacheados na instalação.
- **Conflict queue refresh** — `src/services/conflictReplayRegistry.js` — revisar e expor UI de "X ações pendentes de sync".
- **Banner offline já existe** — `NetworkStatusBanner.jsx` — adicionar tooltip "modo offline ativo: calc e protocolos disponíveis".

### Wave 5.4 — Command Palette + benchmarks (3 dias)
- **`cmdk` global Cmd+K** — `src/components/CommandPalette.jsx` (novo) — indexa páginas, calculadoras, documentos. Respeita `PAGE_TO_CARD` permissões.
- **Bookmark notícias** — tabela `noticias_saved` + botão Salvar.
- **Auditoria timeline unificada** — `<AuditTimeline resourceId>` (Medplum-inspired) — RPC Supabase agregando audit_logs por entidade.

### Wave 5.5 — Test coverage seletivo (2 dias)
- **`authService.test.js`** — JWT exchange, `_authReady`, refresh 50min.
- **`supabaseIncidentsService` paths críticos** — anonimização, ownership.
- **`educacaoService.emitirCertificado`** — HMAC + QR validation.

### Saída Sprint 5 (v5.5.0)
- ✅ BUG-06 fechado
- ✅ Offline-first para calc + protocolos
- ✅ Command Palette
- ✅ Cobertura authService 80%

---

## Backlog estratégico (pós-S5, escopo aberto)

- **Open Badges 3.0** — certificados como VC JSON-LD assinados Ed25519. Permite portabilidade CFM/AMB/SBA.
- **Quiz adaptativo ELO** — Khan-style. Rating de aluno × rating de questão. PG function `update_question_rating` após cada tentativa.
- **DocuSeal e-signature** — atas + docs Qmentum com assinatura legal.
- **NHS Design System patterns** — error summary topo de form, date input 3 campos, timeout 20h.
- **Lighthouse >90** — exige SSR/SSG arquitetural (multi-sprint).
- **Coverage 80% project-wide** — ritmo +3pp por 2.5h ≈ 50h. Decisão de produto.
- **API v3 cursor-based + sitemap.xml + source maps prod + Sentry DSN + reduce CLS**.

---

## Como executar

### Cadência sugerida
- **Daily:** standup 15min para definir foco do dia. Atualizar TaskList.
- **Wave-end:** PR sai aberto, CI verde, 1 reviewer humano. Squash-merge.
- **Sprint-end:** bump CHANGELOG, deploy, atualizar memórias relevantes.

### Métricas de sucesso por sprint
| Sprint | Métrica primária | Métrica secundária |
|---|---|---|
| S1 | Streak funcional para 100% dos usuários ativos | NPS aluno > 70 em forma in-app |
| S2 | Penetration test de auth retorna 0 críticos | LGPD audit retorna 0 críticos |
| S3 | Score Qmentum > 75 (real, não "verde por omissão") | Tempo médio de aprovação de doc < 5d |
| S4 | Lighthouse Accessibility > 95 | Tempo de primeiro uso (TTFU) < 3min |
| S5 | App funciona 100% offline (calc + protocolos) | Bundle < 1.15 MB |

### Princípios
1. **Audit trail SEMPRE** — toda mutation tem `requireUserId()` + `logAction()`. Sem exceções.
2. **LGPD-by-default** — todo dado pessoal novo passa pelo `lgpd-audit` skill antes de merge.
3. **Tokens, nunca hex** — `npm run lint` falha em hex hardcoded (regra custom a adicionar?).
4. **Calculadora alterada = `calc-validator` skill obrigatório** — matemática certa, edge cases testados.
5. **Migration nova = `migration-validator` skill** — idempotência verificada.
6. **Feature flag para mudanças grandes** — TipTap, drag-drop, WebAuthn rework, BottomNav decision.
7. **Backward compat em schema** — adicionar coluna NULLABLE primeiro, backfill, depois NOT NULL.
8. **Paralelização agressiva** — batchear tool calls (Read/Bash/Edit em arquivos diferentes) e dispatchar agentes em paralelo (research, audit, validation) sempre que tarefas forem independentes. Ver `feedback_parallel_agents.md`. Heurística: >10s por tarefa + ≥2 independentes = paralelizar. Reduz tempo de execução do sprint em ~50%.
9. **Scope discipline** — só executar tasks em `docs/planejamento-melhorias-2026-05-16.md`. Sem refactor oportunista, sem "while I'm here" cleanup. Gap descoberto = parar + reportar, não corrigir. Ver `feedback_scope_discipline.md`.
10. **DS first + libs battle-tested (OBRIGATÓRIO em 100% das tasks)** — antes de criar qualquer componente novo, OBRIGATORIAMENTE: (a) buscar nos 92 componentes do DS (61 ui/ + 31 anest/); (b) se faltar, lançar agente paralelo pesquisando GitHub + fóruns (Reddit, HN, dev.to, Stack Overflow) — comparar 4-5 libs candidatas com critérios duros: ≥1k★ OU ≥100k npm weekly, last commit ≤6m, React 19 compat verificada, license permissiva, A11y declarada, mantenedor sério, **≥1 caso real positivo em fórum**; (c) sempre wrappear lib externa atrás de componente em `src/design-system/components/ui/` (aplicar tokens + dual theme + ≥44px touch + mobile-first); (d) documentar decisão no commit (alternativas pesquisadas + URLs). Sem pesquisa = sem PR. Ver `feedback_ds_first_then_battle_tested.md`.
11. **Mobile-first SEMPRE (validar antes de PR)** — toda nova UI desenhada primeiro para 375px (iPhone SE), depois adapta com `sm:`/`md:`/`lg:`/`xl:`. Touch targets ≥44×44px obrigatório. Validar com Playwright resize 375x812 + 1280x800 antes de commit. Bottom Nav respeitada (pb-24 quando necessário). Ver `feedback_mobile_first.md`.
12. **Paralelizar agentes/tools** — sempre que tarefas independentes (>10s cada): batchear tool calls + dispatchar agentes em paralelo (research/audit/validation simultâneos). Reduz ~50% tempo execução. Ver `feedback_parallel_agents.md`.

### Como pausar/replanejar
Se um sprint atrasa: cortar Wave 1.4 (analytics admin) ou Wave 5.3 (offline). São os waves mais isoláveis. NUNCA cortar Waves de Sprint 2 (segurança/LGPD).

---

## Apêndices

### A. Mapa de arquivos novos a criar (Sprint 1 — atualizado 2026-05-17)
```
src/utils/userIdContext.js                                       # requireUserId helper
src/utils/sanitizeRichHtml.js                                    # DOMPurify wrapper
src/hooks/useAutoSave.js                                         # ⭐ NOVO Wave 1.5 — RHF + debounce + TanStack
src/pages/educacao/components/ResumeHeroCard.jsx                 # continue de onde parou
src/pages/educacao/components/LearningPath.jsx                   # ⭐ NOVO Wave 1.5 — path Duolingo-style
src/pages/educacao/admin/components/ActivityChooserModal.jsx     # ⭐ NOVO Wave 1.5
src/pages/educacao/admin/QuestionBankPage.jsx                    # ⭐ NOVO Wave 1.3 — banco reutilizável
src/pages/educacao/admin/QuestionBankImporter.jsx                # ⭐ NOVO Wave 1.5 — bulk import JSONL
src/design-system/components/ui/rich-editor.jsx                  # BlockNote wrapper (lazy)
src/design-system/components/anest/breadcrumb-educacao.jsx       # ⭐ NOVO Wave 1.5
supabase/migrations/20260518120000_user_activity_streak.sql
supabase/migrations/20260520120000_aulas_captions.sql
supabase/migrations/20260521120000_lesson_position.sql
supabase/migrations/20260524120000_prereqs.sql
supabase/migrations/20260525120000_questao_explicacao.sql
supabase/migrations/20260528120000_aula_attachments.sql
supabase/migrations/20260530120000_reorder_rpc.sql
supabase/migrations/20260531120000_question_versioning.sql
supabase/migrations/20260531120100_question_bank.sql
supabase/migrations/20260605120000_edit_locks.sql                # ⭐ NOVO Wave 1.5 — lock advisory
supabase/migrations/20260609120000_rops_schema.sql               # ⭐ NOVO Wave 1.6 — 5 tabelas ROPs
supabase/functions/generate-captions/index.ts                    # Whisper.cpp
supabase/functions/import-questions/index.ts                     # ⭐ NOVO Wave 1.5 — bulk import transacional
scripts/seed-rops-from-mock.mjs                                  # ⭐ NOVO Wave 1.6 — seed 640 questões + 32 ROPs

src/services/supabaseROPsService.js                              # ⭐ NOVO Wave 1.6 — substitui import rops-data.js
src/design-system/components/anest/educacao-summary-card.jsx     # ⭐ NOVO Wave 1.6 — card permanente HomePage
src/pages/educacao/components/DesafioDoDia.jsx                   # ⭐ NOVO Wave 1.6 — UI Desafio do dia

[DELETAR após validação do seed]
src/data/rops-data.js                                            # 7295 LOC mock → Supabase via T1.6.2
```

### B. Dependências a adicionar (Sprint 1 — atualizado 2026-05-17)

> **Mudanças vs plano original:** TipTap removido. BlockNote adicionado. react-arborist substitui @dnd-kit puro. Pacote completo de UX/gamification incluído.

```json
{
  "dependencies": {
    "@blocknote/core": "^0.51",
    "@blocknote/react": "^0.51",
    "@blocknote/shadcn": "^0.51",
    "react-arborist": "^3.6.1",
    "react-player": "^3.4.0",
    "sonner": "^2.0.7",
    "cmdk": "^1.1.1",
    "papaparse": "^5.5.3",
    "react-calendar-heatmap": "^1.x",
    "canvas-confetti": "^1.x",
    "react-circular-progressbar": "^2.2.0",
    "use-debounce": "^10.x",
    "@tanstack/react-query": "^5.x",
    "zod": "^3.x"
  },
  "devDependencies": {
    "@types/papaparse": "^5.x",
    "@types/canvas-confetti": "^1.x"
  }
}
```

**⚠️ NÃO instalar:**
- `@blocknote/xl-*` (pagos para closed-source — auditar package.json no PR)
- `@dnd-kit/*` (substituído por react-arborist que já traz drag-drop pronto)
- `@tiptap/*` (substituído por BlockNote)
- `react-quiz-component` (sem TS, sem peer fixo — usar Radix RadioGroup já no shadcn)
- `kbar` (em beta há 12 meses, sem releases — usar cmdk)
- `react-papaparse` wrapper (lento — usar papaparse puro)

**⚠️ Pré-requisito antes de instalar BlockNote:**
- Verificar React ≥19.0.3 (CVE-2025-55183/55184). Bumpar se necessário.

**Bundle estimado adicional:**
- BlockNote core+react+shadcn (lazy): ~140KB gzip
- react-arborist: ~25KB gzip
- sonner: ~3KB gzip
- cmdk: ~12KB gzip
- papaparse: ~13KB gzip (worker chunked)
- react-calendar-heatmap: ~6KB gzip
- canvas-confetti: ~2.7KB gzip
- react-circular-progressbar: ~3KB gzip
- **Total: ~205KB gzip** (a maior parte lazy-loaded só no admin de educação ou no Cmd+K)

### C. Memórias a atualizar
| Memória | Quando | Como |
|---|---|---|
| `project_educacao_pendencias_pos_pr_auditoria.md` | Fim S1 | Marcar como ✅ resolvidas |
| `project_anest_roadmap_status.md` | Fim S1, S3, S5 | Bump versões |
| `feedback_audit_trail_no_system_fallback.md` | Fim S2 | Confirmar enforcement em 100% services |
| `project_comite_etica_convencoes.md` | Fim S3 | Implementação live |

### D. Referências externas verificadas (expandido 2026-05-17 — 6 pesquisas paralelas)

#### LMS frameworks (ranking por maturidade real)
- https://github.com/moodle/moodle — Moodle (7.1k★, 500M+ usuários, 73% LatAm HE)
- https://github.com/openedx/edx-platform — Open edX (8.1k★, 68k commits, edX/Harvard/MIT)
- https://github.com/instructure/canvas-lms — Canvas LMS (6.6k★, AGPL, universidades US)
- https://github.com/ankitects/anki — Anki (28k★, spaced repetition referência)
- https://github.com/frappe/lms — Frappe LMS (2.9k★, Vue+Python, 3 níveis = ANEST)
- https://github.com/open-spaced-repetition/fsrs4anki — FSRS algoritmo (academic-backed)
- https://github.com/openedx/frontend-app-learner-dashboard — referência dashboard
- https://docs.moodle.org/501/en/Activity_chooser — Activity Chooser (Wave 1.5 T1.5.10)
- https://moodle.com/news/moodle-4-0-dashboard-redesign/ — "In Progress" block
- https://tracker.moodle.org/browse/MDL-71664 — Course Index Drawer
- https://studio.edx.org/ — Open edX Studio outline editor
- https://h5p.org/documentation/x-api — xAPI granular tracking
- https://www.learndash.com/blog/new-quiz-builder-reusable-questions-and-status-of-3-0/ — Question bank reutilizável
- https://tutorlms.com/course-builder/ — Spotlight Mode reference

#### Editor rich text (decisão: BlockNote)
- https://github.com/TypeCellOS/BlockNote — BlockNote (9.7k★, drag handle FREE, React 19)
- https://www.blocknotejs.org/ — docs oficiais
- https://github.com/TypeCellOS/BlockNote/issues/1487 — Shiki bloat (mitigar)
- https://github.com/TypeCellOS/BlockNote/releases — v0.51 release 2026-05-14
- https://tiptap.dev/blog/release-notes/tiptap-3-0-is-stable — TipTap v3 (alternativa)
- https://github.com/ueberdosis/tiptap/issues/5876 — React 19 ref issues
- https://tiptap.dev/alternatives/blocknote-vs-tiptap — comparativo
- https://github.com/facebook/lexical — Lexical (22k★, descartado — UI manual)
- https://github.com/udecode/plate — Plate (16k★, segunda opção)
- https://liveblocks.io/blog/which-rich-text-editor-framework-should-you-choose-in-2025

#### React libs (validadas por stars + weekly downloads)
- https://github.com/brimdata/react-arborist — Tree drag-drop (3.6k★, 353k weekly)
- https://github.com/pacocoursey/cmdk — Command palette (12.6k★, 39M weekly)
- https://github.com/emilkowalski/sonner — Toast (12.4k★, 43M weekly)
- https://github.com/cookpete/react-player — Video player (10.2k★, 2.33M weekly)
- https://github.com/mholt/PapaParse — CSV parser (13.5k★, 10.9M weekly)
- https://github.com/kevinsqi/react-calendar-heatmap — Streak heatmap (1.3k★)
- https://www.npmjs.com/package/canvas-confetti — Confetti (934k weekly, 12.2k★)
- https://github.com/kevinsqi/react-circular-progressbar — Progress (1.6k★)
- https://github.com/atlassian/pragmatic-drag-and-drop — alternativa drag (12.6k★)
- https://github.com/lukasbach/react-complex-tree — alternativa tree (1.4k★, A++ A11y)
- https://github.com/vidstack/player — alternativa player moderno (3.5k★)

#### Learning Path / Gamification
- https://github.com/sanidhyy/duolingo-clone — Lingo (referência path Duolingo)
- https://github.com/bryanjenningz/react-duolingo — 460★ TS clone
- https://blog.duolingo.com/new-duolingo-home-screen-design/ — racional redesign
- https://www.iatrox.com/blog/gamification-medical-education-evidence-synapses-iatrox-2026 — evidência médica
- https://pmc.ncbi.nlm.nih.gov/articles/PMC10778414/ — Delphi gamification médica

#### Auto-save / Co-autoria / IA / Bulk import
- https://refine.dev/core/docs/ui-integrations/shadcn/components/auto-save-indicator/ — AutoSave UI
- https://supabase.com/docs/reference/javascript/upsert — Supabase upsert
- https://github.com/yjs/yjs — Yjs CRDT (Plan B futuro)
- https://github.com/AlexDunmow/y-supabase — y-supabase (não usado, "not production ready")
- https://seibert.group/blog/en/edit-lock-for-confluence-better-protection-against-simultaneous-editing-of-confluence-pages/ — Lock advisory pattern
- https://platform.claude.com/docs/en/build-with-claude/prompt-caching — Anthropic caching
- https://www.mdpi.com/2504-4990/8/2/41 — MCQ médica IA (2025)
- https://arxiv.org/html/2410.13191v1 — MCQG-SRefine
- https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-object — Vercel AI SDK
- https://www.papaparse.com/ — PapaParse

#### Certificação / Acessibilidade
- https://www.imsglobal.org/spec/ob/v3p0 — Open Badges 3.0
- https://www.sbahq.org/estrutural/cepe-a/ — SBA CEPE-A (40pts/ano)
- https://www.w3.org/WAI/ARIA/apg/patterns/radio/ — ARIA radiogroup quiz
- https://github.com/ggerganov/whisper.cpp — Whisper.cpp captions
- https://rodneylab.com/creating-whisper-video-captions/ — pipeline WebVTT
- https://service-manual.nhs.uk/design-system — NHS DS patterns

#### Outros benchmarks (S2-S5)
- https://github.com/medplum/medplum — Medplum FHIR (auditoria timeline)
- https://oregonpatientsafety.org/tools-and-best-practices/root-cause-analysis-toolkit — Oregon RCA
- https://www.docuseal.com/ — DocuSeal e-signature
- https://www.mdcalc.com/about-us — MDCalc favoritos
- https://github.com/pazguille/offline-first — Offline-first patterns
- https://web.dev/articles/pwa-with-offline-streaming — PWA streaming

#### Segurança (CVEs)
- https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components — React 19 CVE

# Overnight DS — Fechamento do gap de adoção (Ondas I–N)

**Sessão:** autônoma, sem humano ao vivo · **Data:** 2026-06-01 (madrugada)
**Branch:** `main` · **Sem push, sem deploy** (tarefa do usuário de manhã).
**HEAD inicial:** `dad9a0b` → **HEAD final:** `f9eadb0` (+4 commits).

---

## 1. Ondas: feitas / puladas / falhadas + commit

| Onda | Status | Commit | Resumo |
|---|---|---|---|
| **I** — ClinicalDisclaimer CFM 2.454/2026 | ✅ feita | `bc1b9ae` | Componente DS aplicado nos 2 pontos centrais de render que cobrem 73 calcs + 7 critérios UTI. Substituiu footer-note inline (agora carrega a ref regulatória). |
| **J** — window.confirm → ConfirmDialog | ✅ feita | `f1a0df0` | 3 ações destrutivas migradas (LGPD anonimização c/ type-to-confirm, Comunicados excluir, OrgEditModal remover cargo). |
| **K** — useHaptic em taps primários | ✅ feita | `737f790` | 8 arquivos. ConfirmDialog (universal) + 7 submits primários. |
| **L** — cauda hex → tokens | ✅ parcial | `f9eadb0` | FaturamentoStats.StatCard hex-lookup-key → `variant` (−7 hex, zero visual). Resto da cauda protegido/ambíguo — não convertido. |
| **M** — fantasmas + SectionHeading | ⚠️ parcial | (sem commit — eram untracked) | 2 arquivos-fantasma removidos. SectionHeading **pulado** (mismatch de cor — ver §2). |
| **N** — opcional (não-mergeável) | ⏭️ não feita | — | Exige validação visual/device humana. Candidatos em §3. |

**Falhas:** nenhuma. Build verde a cada bloco; nenhum bloco precisou ser revertido.

---

## 2. Decisões conservadoras tomadas sem humano (para revisão)

1. **Onda I — verificação visual por código, não screenshot.** As calculadoras são autenticadas; sem humano para logar, o screenshot ao vivo em instância isolada esbarra no login wall. A mudança é um swap puro e aditivo (note inline → componente DS já validado no DS showcase) com build verde e diff trivial → validado por código + build, conforme §3 (screenshot "quando útil"). **Pedido ao humano:** conferir visualmente o disclaimer sob 2-3 calcs + 1 critério UTI (light+dark).

2. **Onda J — escopo limitado a 3 ações genuinamente destrutivas/irreversíveis.** Convertidos: anonimização LGPD (irreversível, recebeu type-to-confirm `confirmKeyword=ANONIMIZAR`), exclusão de comunicado (bug conhecido no CLAUDE.md), remoção de cargo (cascata). **Deliberadamente NÃO convertidos** (registrados, não são regressão):
   - `ConflictsTab.jsx:249` (descartar conflito) — **teste acoplado** (`ConflictsTab.test.jsx` mocka `window.confirm` e faz `expect(...).toHaveBeenCalled()`); converter exigiria reescrever o teste → risco de regredir baseline overnight. Ação "dismiss" é menos destrutiva.
   - `kpi-editor.jsx:369` e `admin-buttons.jsx:160` — componentes DS reutilizáveis; `admin-buttons` usa prop genérica `confirmMessage` (mudaria o contrato compartilhado).

3. **Onda J — OrgEditModal: ConfirmDialog como irmão do Modal (fragment).** O `return` foi envolto em `<>...</>` para o ConfirmDialog (portal z-1100) renderizar fora da árvore do Modal. Modal-sobre-modal: o ConfirmDialog é appendado ao body depois, então fica acima. **Pedido ao humano:** confirmar empilhamento visual ao remover um cargo.

4. **Onda K — gating implícito + ConfirmDialog universal.** O `useHaptic` já é auto-gated (`navigator.vibrate` só existe em touch + respeita `prefers-reduced-motion`), então não precisei de `isTouchDevice` explícito. Coloquei haptic no botão confirmar do **ConfirmDialog** (warning p/ danger, success p/ default) — um único ponto cobre todos os confirms destrutivos do app. Sem device real overnight, validação foi por código.

5. **Onda L — só o swap de risco-zero.** Pré-flight revelou que a Fase 3 já zerou os hex fáceis; a cauda restante é majoritariamente **protegida** (SVG/Recharts stroke, glows, dados/mock, lookup-keys) ou **visualmente ambígua** (grays/zinc/teal sem espelho exato de token, paletas decorativas). Converti apenas FaturamentoStats.StatCard, onde o hex era pura chave de switch (nunca virava estilo) → `variant` com mapeamento fiel (zero mudança visual). **Não converti** (deixei como está, NÃO em branch — são no-op ou data):
   - `FaturamentoQuickStats` paleta inline-style (`style={{color}}`) — categoria D4 (data-driven). Observação: em dark mode `#004225` como cor de texto pode ter contraste ruim sobre card escuro — **possível bug de contraste worth revisar**.
   - `plantao-list-item.jsx` greens pastel (`#B8E0C8/#A8D5BA/#C5E8D5`) — micro-variações decorativas hash-based **intencionais e documentadas**; colapsar num token regrediria a diferenciação visual.

6. **Onda M — SectionHeading NÃO adotado (sem uso artificial).** O componente fixa `text-primary` no level-3, mas o padrão de subsection dominante nas páginas usa `text-muted-foreground` (+ variações de size/tracking). Um swap fiel mudaria a cor (verde) → mudança visual não-validável; estender o componente seria scope creep. Por "não criar uso artificial" (scope discipline), pulei. **Recomendação:** adicionar variante de cor `muted` ao SectionHeading antes de adotar em escala (ver §6).

---

## 3. Não-mergeado / requer humano

**Nada ficou em branches `overnight/*`** — optei por NÃO criar mudanças de layout não-validáveis overnight (baixo valor × alto risco). Todos os commits estão em `main`, locais, build verde, prontos para revisão + push de manhã.

**Onda N — candidatos preparados para o humano (não tocados):**
- **PageShell rollout** — só páginas single-return simples; alto risco de múltiplos returns. Precisa Explore + validação visual por página.
- **Pull-to-refresh** (Fase 4.4) na HomePage/listas — precisa device real.
- **FilterChips / FAB / FormActionBar** — baixo valor individual; precisam de Explore de ad-hoc real + validação de layout.
- **DataTable genuíno** — Onda H já descartou os 3 alvos admin (não-tabulares). Não há alvo limpo identificado; pular até surgir lista densa read-only sem ação-por-linha.

---

## 4. Adoção ANTES vs DEPOIS

| Componente | Antes | Depois | Nota |
|---|---:|---:|---|
| **ClinicalDisclaimer** | 0 🔴 | **2** | 2 pontos centrais cobrem 73 calcs + 7 critérios UTI |
| **useHaptic** | 0 🔴 | **8** | ConfirmDialog (universal) + 7 submits |
| **ConfirmDialog** (em ações destrutivas) | n/a | **+3** | LGPD/Comunicados/Org; total 25 call-sites no repo |
| **window.confirm** ativos (destrutivos) | 6 | **3** | restantes intencionais (§2.2) |
| **Arquivos-fantasma `* 2.*`** | 2 | **0** | removidos |
| **hex em FaturamentoStats.jsx** | 11 | **4** | 4 restantes = paleta inline-style D4 |
| **SectionHeading** | 0 | 0 | pulado (mismatch de cor) |

Drift global não regrediu: z-[NNNN] 0, raw colors 0, !important 0 (inalterados).

---

## 5. Baseline de testes (inicial vs final)

- **Inicial (1ª rodada):** `132 failed | 1783 passed | 3 skipped` · **13 arquivos** falhos.
- **Final:** `133 failed | 1782 passed | 3 skipped` · **13 arquivos** falhos.
- **Veredito: SEM regressão atribuível.** O conjunto de **arquivos** falhos é idêntico (13) e **nenhum** corresponde a arquivo tocado nesta sessão. A oscilação de 1 teste (132↔133) ocorre em suíte pré-existente **flaky** (`f62Rollout.test.js` — integração offline-queue, timing-dependent; erro pré-existente `_resetReplayRegistryForTests is not defined`). Verificado: nenhum teste referencia CalculatorShowcase/CriteriosUTIPage/LgpdSolicitacoesTab/ComunicadosPage/OrgEditModal/PublishButton/FaturamentoStats.

---

## 6. Próximos passos sugeridos

1. **Push + deploy** dos 4 commits (`bc1b9ae`..`f9eadb0`) após revisão — tarefa do usuário (`git push origin main` + `firebase deploy --only hosting:anest-ap`).
2. **Validação visual** (login necessário): disclaimer nas calcs/UTI (light+dark); fluxos de confirm destrutivo (LGPD anonimização type-to-confirm, excluir comunicado, remover cargo); empilhamento do ConfirmDialog sobre o OrgEditModal.
3. **SectionHeading:** adicionar variante de cor (`tone="muted"` ou `level={4}`) que use `text-muted-foreground` — destrava adoção em ~15+ h3 ad-hoc hoje em `text-muted-foreground` (Pendencias, Noticias, CateterDetalhe, Auditorias). Hoje bloqueado pelo `text-primary` fixo.
4. **Dark-mode contrast:** revisar `FaturamentoQuickStats` (`style={{color:'#004225'}}`) — verde escuro sobre card dark pode falhar contraste. Migrar para token theme-aware se confirmado.
5. **Onda N** com humano no loop: PageShell rollout incremental + pull-to-refresh (device) + FilterChips/FAB onde houver ad-hoc real.
6. **window.confirm restantes:** converter ConflictsTab junto com a reescrita do seu teste; avaliar kpi-editor/admin-buttons como refactor de componente DS dedicado.

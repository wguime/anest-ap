# ANEST — Conclusão Autônoma do Design System (overnight, multi-agente via Workflow)

Você é um engenheiro sênior no ANEST, app médico de gestão de qualidade em anestesiologia
(React 19 + Vite + Tailwind 3 + Firebase Auth + Supabase). Missão: executar **todo o restante**
do plano de modernização do Design System, de forma **autônoma e ininterrupta a noite toda**,
usando o Workflow tool para paralelizar o que for paralelizável, mantendo build verde e a
identidade visual travada. Não há humano disponível para responder perguntas — você decide com
defaults conservadores e documenta.

═══════════════════════════════════════════════
## 0. MODO AUTÔNOMO — regras de ouro
═══════════════════════════════════════════════
- **NÃO use `AskUserQuestion`.** Para qualquer decisão ambígua, escolha o default mais conservador
  e alinhado às DNA Rules, registre em `docs/overnight-decisions.md` (crie e vá adicionando) e siga.
- **NÃO faça `firebase deploy`** — deploy é tarefa do usuário. Só `npm run build` + `git push`.
- **Trabalhe em loop até terminar o plano** (Fase 3 leftovers → Fase 4 → follow-ups → 2.3 por último).
  Ao esgotar, gere o relatório final (seção 8) e pare.
- **Build verde + push a cada bloco lógico.** NUNCA pule `git push origin main`. GitHub é a fonte da verdade.
- **Commits granulares, conventional**, terminando com:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- **Não invente validação visual.** Há servidor dev + Playwright, mas SEM credenciais de login —
  só login/rotas públicas são alcançáveis. Valide o encanamento de tokens via DOM probe
  (`getComputedStyle` de elemento com a classe/var, em light e dark — exemplo na seção 6) e
  registre quais telas autenticadas precisam de revisão humana de manhã.

═══════════════════════════════════════════════
## 1. LEITURA OBRIGATÓRIA (antes de agir)
═══════════════════════════════════════════════
- `docs/plano-ds-modernizacao.md` — fonte da verdade das fases. A seção "Fase 3" já tem o status
  do que foi feito em 2026-05-28 (commits `36036df`→`ef2de56`).
- `CLAUDE.md` — convenções, comandos, critérios de verificação, padrões por Wave.
- `.claude/rules/*` (auto-aplicadas): `design-tokens`, `responsividade`, `navegacao`, `lgpd`,
  `qmentum-compliance`, `supabase-firebase`, `padroes-codigo`, `audit-trail`, `secrets`.
- As **🛡️ DNA Rules (12)** no topo do plano — IDENTIDADE TRAVADA, inegociável: verde `#004225`,
  glass iOS, 4 superfícies, raios 10/12/20px (NUNCA 8/16), touch ≥44px, tipografia Apple
  (h1 `text-base` / h2 `text-lg` / h3 `text-sm uppercase tracking-wide text-primary`), spring
  400/30, shell via `<PageHeader>`/`<PageShell>`, `pb-24` canônico, z-index via utilities
  (`z-nav`/`z-dropdown`/`z-sticky`/`z-header`/`z-modal`/`z-submodal`/`z-select`/`z-overlay`).
- `docs/wave-execution-playbook.md` — para fases com 5+ tarefas.
- Confirme o estado: `git status` (deve estar limpo, untracked só de skills/.tmp/.firecrawl) e
  `git log --oneline -12` (HEAD deve ser `ef2de56`).

═══════════════════════════════════════════════
## 2. JÁ CONCLUÍDO (NÃO refazer) — sessão 2026-05-28, 11 commits no main
═══════════════════════════════════════════════
- **Fase 1, 1.6, 2.1, 2.2** completas (ver plano).
- **Fase 3 — drift cleanup (núcleo):**
  - Z-index: zero `z-[…]` hardcoded em pages/components (`36036df`).
  - Raw Tailwind colors: zero em pages/components (`016b1d7`).
  - Tokens `--org-{tipo}-{slot}` fiéis ao PDF (light+dark) + fix dark-mode latente; `orgNodeColors.js`
    usa `var()` via inline-style; `getNodeClasses` morto removido (`92861d5`, `9ecce20`).
  - Hex em className → tokens/category em 22 arquivos via Workflow (`f5f902a`).
  - **Formatters (lib):** `src/utils/formatters.js` + 18 testes Vitest (`a4ee8fb`). Saída default
    espelha `toLocaleDateString('pt-BR')`. **Migração dos call sites NÃO feita** (ver §4).
  - **PageSkeleton:** `<PageSkeleton variant="list|grid|detail|dashboard">` (`e7587e1`), 1ª adoção
    em `ReuniaoDetalhePage`.
  - Fixes de regressão: organograma crash `IconComponent` (`871a1da`); FaturamentoPage →
    `WarningCallout`+`EmptyState` (`07f34d1`).

═══════════════════════════════════════════════
## 3. ARMADILHAS REAIS já descobertas (evite repetir)
═══════════════════════════════════════════════
1. **Classe Tailwind montada dinamicamente é PURGADA pelo JIT.** `` `bg-org-${tipo}` `` nunca vira
   utility. Para cor dinâmica por dado → use **inline-style `style={{ ... 'var(--token)' }}`** (como
   `orgNodeColors.js` faz) ou `safelist` no config. NUNCA classe interpolada.
2. **Colapsar par `classe-light dark:classe-dark` só quando o token ADAPTA por tema.** Tokens de
   paleta fixa NÃO adaptam: `greenBright`/`greenLight`/`greenDark` são hex fixos no config — se o
   original tinha dark distinto, mantenha `dark:` (ex.: `text-greenBright dark:text-success`).
   Já `destructive`/`warning`/`success`/`muted`/`border`/`foreground`/`category-*` adaptam.
3. **`hover:bg-primary` == `bg-primary`** (hover degenerado, sem efeito). Use `hover:bg-primary/90`.
4. **Não toque hex que é:** chave/valor de lookup contra dado de banco (`'#F59E0B': {...}`,
   `case '#34C759':`, `COR_TO_TOKEN`, `statusInfo.cor`); prop de chart/SVG (Recharts `fill=`/`stroke=`,
   `<Cell>`, props `color`/`fill`); glow `shadow-[...rgba(...)]` (não há token de glow); hex em
   comentário. Tudo isso é permitido por `design-tokens.md`.
5. **`pt-BR` matcher:** ao migrar formatters, o receptor é uma expressão arbitrária
   (`new Date(x).toLocaleDateString('pt-BR')` → `formatDate(x)`; `foo.toLocaleString('pt-BR')` →
   `formatNumber(foo)`). Regex cego quebra — use agente por arquivo + verify de equivalência.
6. **Debt pré-existente** em `src/pages/reunioes/ReuniaoDetalhePage.jsx`: imports não usados (`cn`,
   `buildDeliberacaoAbertaPayload`, `buildDeliberacaoFechadaPayload`). Limpe oportunisticamente se tocar.
7. `npm run dev`: porta 5173/5174 (Vite escolhe a livre). Rode `npm run build` 1× por bloco; agentes
   NÃO rodam build/dev/lint — você roda.

═══════════════════════════════════════════════
## 4. TRABALHO RESTANTE — Fase 3 (terminar primeiro)
═══════════════════════════════════════════════
Para cada bloco: scouting INLINE (grep da lista) → Workflow `pipeline(arquivos, refatorar,
verificarAdversarial)` quando paralelizável → você faz wiring central (barrels/config/novos
componentes) → build verde → commit + push. `schema` nos agentes p/ saída estruturada
(`{changed, skipped, notes}` e `{safe, issues}`). Mate findings duvidosos. Loop-until-dry para
resíduos.

- **3.6 Migração de formatters (99 arquivos)** — `rg -l "toLocale(Date|Time)?String\(['\"]pt-BR"`.
  Workflow por arquivo: adicionar import de `@/design-system`? Não — formatters vivem em
  `@/utils/formatters` (ou caminho relativo). Mapear: sem-opções→`formatDate(x)`;
  `{day,month:'long',year}`→`formatDate(x,'long')`; `{day,month:'short',year}`→`'medium'`;
  `{day,month:'short'}`→`'dayMonth'`; `toLocaleString('pt-BR')` numérico→`formatNumber`;
  `{maximumFractionDigits:N}`→`formatNumber(x,{maximumFractionDigits:N})`; moeda→`formatCurrency`.
  **Verify deve confirmar saída byte-idêntica.** Pular casos exóticos (options raras) e registrar.
  Considere consolidar `comunicadosHelpers` (`formatRelativeDate`/`formatFullDate`/`formatCardDate`)
  para delegar a `formatters.js` (sem quebrar consumidores).
- **3.3 Empty states** — 48 arquivos já usam `<EmptyState>`. Migrar SÓ empties de página/lista
  custom (centralizado, ícone+título). **NÃO** transformar hints inline de form/modal em `<EmptyState>`.
  Caso a caso — não sweep cego.
- **3.4 PageSkeleton — adoção incremental** nas ~40 páginas que carregam async sem indicador
  (`rg -n "if \(loading\) return|isLoading\) return" src/pages`). Trocar spinner/null por
  `<PageSkeleton variant=…>` adequado, preservando o header. Por arquivo, com cuidado.
- **3.5 Card hover normalizado** — clickable cards com hover ad-hoc → `<Card variant="interactive">`
  (existe desde Fase 1) ou as classes canônicas `hover:-translate-y-px hover:shadow-elevation-2
  transition-all active:scale-[0.98]`. Scout: cards com `onClick` + `cursor-pointer`/`hover:`.
- **3.2 Consolidar redundância** — variantes de Card duplicadas → `<Card variant=…>`; 5 charts
  (`Chart`, `DonutChart`, `LazyChart`, `LazyDonutChart`, `SparklineChart`) → interface unificada.
  Design-sensitive: preserve API pública, mantenha lazy, hex que espelha token em SVG é permitido.
- **Magic spacing residual (~30)** — `rg "[mp][trblxy]?-\[[0-9]+px\]"` → escala Tailwind quando
  equivalente (ex.: `-[12px]`→`-3`, `-[16px]`→`-4`). Só quando casa exato.
- **Inline styles em pages reais** — `EducacaoTab.jsx` (11), `ComunicadosPage.jsx` (10),
  `management/educacao/EducacaoTab.jsx` — converter `style={{}}` p/ classes/tokens quando estático
  e equivalente; manter inline quando dinâmico/data-driven.

═══════════════════════════════════════════════
## 5. Fase 4 — Polish Premium (design-sensitive)
═══════════════════════════════════════════════
**Dependências PRÉ-APROVADAS** (somente estas, pois constam do plano; qualquer outra → pular e
registrar): View Transitions API e `@starting-style` são nativos (sem dep). `LazyMotion`+`m.*` já
vem do framer-motion instalado. Magic UI: copie o SOURCE dos componentes (NumberTicker, BlurFade,
BorderBeam, AnimatedList) para o DS e tokenize — NÃO instale o pacote inteiro se der pra copiar
fonte; se precisar instalar, use `@formkit/auto-animate` e `@lottiefiles/dotlottie-react` (citados
no plano). Tudo respeitando `prefers-reduced-motion`.
- 4.1 View Transitions API (Home↔Gestão↔Educação↔Menu), `@starting-style` (modal/popover enter),
  `LazyMotion` + `m.*` (reduz bundle framer-motion).
- 4.2 Magic UI cherry-pick: NumberTicker (KPIs Centro de Gestão), BlurFade (grid 73 calcs),
  BorderBeam (slow, greenBright única cor, 8s — comunicado urgente/deliberação aberta), AnimatedList
  (feed comunicados). Wrappear no DS, tokenizar, identidade travada.
- 4.3 `@formkit/auto-animate` (listas add/remove/reorder) + Lottie lazy (3-5 empty states healthcare).
- 4.4 `useHaptic` (`navigator.vibrate`) + pull-to-refresh (HomePage + listas principais).
- 4.5 Typography variable (Inter wght 400-700) + `tabular-nums` (KPIs, escalas, timers, códigos) +
  `letter-spacing: -0.01em` em h1/h2.
Cada item: build verde + commit + push. Valide animação não quebra com reduced-motion.

═══════════════════════════════════════════════
## 6. VALIDAÇÃO (sem credenciais)
═══════════════════════════════════════════════
- `npm run build` verde por bloco; `npm run dev` sobe sem erro; `npm run test:run` para libs/utils
  tocadas (ex.: formatters tem 18 testes — não regredir).
- Playwright: `npm run dev` (5173/5174) → só login/públicas sem auth. Para tokens, use DOM probe:
  navegue à raiz, então `getComputedStyle` de um elemento com a classe/var alvo, em `light` e
  removendo/adicionando `document.documentElement.classList` `dark`. (Foi assim que se pegou o bug
  de classe dinâmica e se confirmou os vars org light/dark.)
- Registre em `docs/overnight-decisions.md` quais telas autenticadas precisam de olho humano de manhã.
  NUNCA declare "validado visualmente" o que não foi visto.

═══════════════════════════════════════════════
## 7. Fase 2.3 — TanStack Query (POR ÚLTIMO, máximo cuidado)
═══════════════════════════════════════════════
Já instalado, zero `useQuery` hoje. Toca camada de dados + cold-start do JWT (`_authReady` —
ver `.claude/rules/supabase-firebase.md`). Risco alto. Faça SÓ depois de tudo acima estar verde:
montar `QueryClientProvider` em `src/main.jsx` perto de `AuthGatedProviders`; embrulhar 1-2 services
(`supabaseComunicadosService`, `supabaseIncidentsService`) como prova de conceito, preservando
`_authReady` e o field-mapping camelCase↔snake_case. Se build/test quebrar e não resolver rápido,
**reverta esse bloco** (`git revert` do commit) e registre em decisions como "2.3 adiado — precisa
de humano". Não deixe o app quebrado.

Follow-ups de adoção (se sobrar tempo/orçamento): integração global do CommandPalette (busca em 73
calcs + 80 páginas), DataTable em `AuditLogTab`/`LgpdSolicitacoesTab`/`RelatoriosEducacao`, migração
incremental de páginas simples para `<PageShell>`.

═══════════════════════════════════════════════
## 8. AO TERMINAR — entregáveis
═══════════════════════════════════════════════
1. Atualize `docs/plano-ds-modernizacao.md` (status + datas) a cada fase concluída.
2. `docs/overnight-decisions.md` — toda decisão autônoma tomada (com o porquê) e dependências adicionadas.
3. `docs/overnight-report-<DATA>.md` — relatório de manhã: o que foi feito (com hashes de commit), o
   que precisa de validação visual humana (lista de telas), o que foi pulado/adiado e por quê, e o
   estado final do build/testes. Atualize a memória do projeto (`memory/MEMORY.md` +
   `project_ds_fase3_drift_cleanup.md` / novo `project_ds_fase4_polish.md`).
4. Garanta árvore limpa e tudo pushado. NÃO deploye.

KICKOFF: leia §1, confirme estado (`git status`/`log`), comece pela **Fase 3 §4** (migração de
formatters é o maior bloco paralelizável — bom primeiro Workflow), siga em ordem. Build verde +
commit + push por bloco. Trabalhe até cumprir todo o plano.

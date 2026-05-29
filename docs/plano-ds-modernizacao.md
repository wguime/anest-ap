# Plano de Modernização do Design System ANEST

> **Objetivo:** elevar o DS de maturidade 3.4/5 → 4.5/5 (nível Linear/Notion/Vercel) preservando a identidade institucional verde + iOS aesthetic + mobile-first.

**Última atualização:** 2026-05-28
**Status:** Fase 1 (Foundation) ✅ em produção. **Fase 1.6 (Page Patterns) ✅**. **Fase 2.1 (shadcn) ✅ componentes criados** — Command Palette/Combobox/Drawer/HoverCard/InputOTP/Kbd/DataTable + toast migrado p/ Sonner. **Fase 2.2 (healthcare) ✅**. Próxima: **Fase 3 (drift cleanup)** — alta paralelização (workflow). Fase 2.3 (TanStack Query) deferida. Adoção dos novos componentes nas páginas é incremental.

---

## 🛡️ DNA Rules — Identidade Travada (12 regras)

Toda mudança no DS deve respeitar estas regras. Inegociáveis.

### Cor e Marca
1. **Verde institucional monolítico** — `#004225` (greenDark) é a alma da marca. Sem gradientes em CTAs primários. Sem cores secundárias para ação principal.
2. **Glass iOS** — `backdrop-filter: blur(24px) saturate(180%)` com borders verde-tintadas. Não Material, não Flat.
3. **4 níveis de superfície** — Page/Section/Card/Muted com green-wash. Sem grays neutros arbitrários.

### Geometria
4. **Border radius hierárquico** — 10-12px (badges), 20px (cards), 12px (icons), 50% (avatares). **Nunca 8 ou 16px.**
5. **Buttons em escala touch** — 36/44/48px. `scale(0.97)` em tap.
6. **Safe-area-first** — `env(safe-area-inset-*)`, touch targets ≥44px.

### Tipografia
7. **Font stack Apple** — Inter + SF Pro. Labels uppercase + tracking 0.5px + weight 500. Titles 700. Body 600 (nunca 400).
8. **Heading hierarchy travada:**
   - Page title (h1 em PageHeader): `text-base font-semibold`
   - Section h2: `text-lg font-semibold`
   - Subsection h3: `text-sm font-semibold uppercase tracking-wide text-primary`

### Movimento
9. **Spring snappy** — `stiffness: 400, damping: 30`. 200ms normal, 150ms fast. Sem animações floaty. Respeita `prefers-reduced-motion`.

### Estrutura
10. **Header pattern fixo** — Todas as páginas com botão "Voltar" usam `<PageHeader>` (não copy-paste de boilerplate). Padding `px-4 sm:px-5 py-3`, fixo top, `h-14` spacer, ChevronLeft + "Voltar" + título centralizado.
11. **Page shell único** — Toda página é `<PageShell>`. `pb-24` canônico para BottomNav (não `pb-28`/`pb-32`).
12. **Card grid baseline** — `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3` para card grids. `gap-2` só para grids densos de ícones.

---

## ✅ Fase 1 — Foundation (COMPLETA — em produção)

### O que foi entregue

**Tokens (Tokens.json + tailwind.config.js + anest-theme.css):**
- Typography scale expandida com `lineHeight` + `letterSpacing` nos 11 tamanhos
- Utility classes: `text-greeting`, `text-card-title`, `text-section-title`, `text-widget-title`, `text-body-md`, `text-body-sm`, `text-caption`, `text-caption-bold`, `text-label`, `text-badge`, `text-micro`
- Z-index scale documentado: `z-nav`, `z-dropdown`, `z-sticky`, `z-header`, `z-modal`, `z-submodal`, `z-select`, `z-toast`, `z-popover`, `z-skip-link`, `z-overlay`
- Shadow elevation ladder 5 níveis (green-tinted light, neutral dark): `shadow-elevation-1` a `shadow-elevation-5`
- Fix dark mode card shadow (era `none`)

**Componentes refatorados (CVA + forwardRef):**
- ✅ Card — CVA com variants (default/elevated/flat/outlined/interactive) + padding scale
- ✅ Badge — forwardRef
- ✅ Avatar — forwardRef + hex `#004225`/`#006837` → `greenDark`/`greenMedium`
- ✅ Alert — CVA + tokens semânticos (`bg-success/10`, etc.)
- ✅ Textarea — `text-foreground` em vez de `text-black/dark:text-white`
- ✅ Modal — usa `useFocusTrap` + `prefersReducedMotion` reativo + `z-modal` + `shadow-elevation-4`
- ✅ Sheet — usa `useFocusTrap`
- ✅ ConfirmDialog — usa `useFocusTrap` + `shadow-elevation-4`
- ✅ Input — já estava bom

**Novos hooks:**
- ✅ `useFocusTrap` em `src/design-system/hooks/useFocusTrap.js` (extrai ~80 linhas duplicadas de Modal+Sheet)
- ✅ `useSwipeBack` em `src/design-system/hooks/useSwipeBack.js` (swipe-back mobile)

**Commits:** `5a967cb`, `e94371d`, `42e8dad`, `4afcb53`, `942b2cb`, `384e5bc`

### Tasks remanescentes da Fase 1
- ⏸️ **1.5 Radix unified migration** — DEFERIDA (baixa prioridade; só 2 packages Radix em uso)
- ⏸️ Tooltip + Popover têm forwardRef faltando nos subcomponents (custom implementations, não Radix). Não-crítico, deixar para refactor maior.

---

## 🏗️ Fase 1.6 — Page Pattern Library (PRÓXIMA — ~3 dias)

> **Motivação:** usuário relatou que headers ficam fora do padrão quando alterados. Auditoria revelou drift em todo o shell visual.

### 1.6.1 `<PageHeader>` v2 + migração total (~1 dia) — ✅ CONCLUÍDA (2026-05-28)

**Estado atual:**
- `PageHeader` existe em `src/components/PageHeader.jsx` (12 páginas usam)
- 113 páginas fazem `createPortal` copy-paste inline
- Padrão de referência: `src/pages/incidents/IncidentesPage.jsx:124-150`

**Tarefas:**
1. Estender `PageHeader` com `usePortal={true}` (default) — vira canonical para ambos os modos
2. Adicionar slots: `rightContent` (já existe), `subtitle`, `actions`
3. Migrar 12 módulos com copy-paste para `<PageHeader>`:
   - `src/pages/incidents/` (12 pages)
   - `src/pages/kpi/` (10)
   - `src/pages/relatorios/` (4)
   - `src/pages/rops/` (7)
   - `src/pages/educacao/` (6)
   - `src/pages/desastres/` (11)
   - `src/pages/faturamento/` (9)
   - `src/pages/comites/`
   - `src/pages/auditoria/`
   - `src/pages/etica/`
   - `src/pages/autoavaliacao/`
   - `src/pages/dashboard/`
4. ✅ ESLint rule: `no-restricted-syntax` bloqueia className `fixed top-0 left-0 right-0 z-50` em `src/pages/**` (força `<PageHeader>`). Exceção temporária: `CateteresPeridualPage` (sub-barra fixa de hospitais requer enhancement — slot `belowSlot` + spacer ajustável no PageHeader).

**Impacto:** elimina ~100 linhas de boilerplate × 12 módulos = ~1200 linhas.

**Resultado real (2026-05-28):** migração TOTAL além dos 12 módulos — também migradas as páginas soltas (auditorias-interativas, cateter-peridural, communication, planos-acao, reunioes, DocumentoDetalhePage, management/ManagementLayout + AuditTrailPage, e ~19 páginas raiz). Única página NÃO migrada: `CateteresPeridualPage` (documentada acima). Guardrail ESLint impede regressão.

### 1.6.2 `<PageShell>` novo componente (~1 dia) — ✅ COMPONENTE CRIADO (2026-05-28)

> Componente em `src/components/PageShell.jsx` (co-locado com PageHeader, exportado via `@/components`). API: `title`/`subtitle`/`onBack`/`actions` (→ PageHeader) + `containerSize` (default|lg|full), `background` (background|card|muted), `pb` (default|tall|extra|none), `contentClassName`. `EventosPage` migrada como referência. **Rollout das ~180 páginas é incremental** (páginas de detalhe/form com múltiplos returns de loading exigem migração cuidadosa — não fazer sweep cego).

**Estado atual:**
- 9 páginas usam `flex flex-col` (PageHeader local), 182 usam `div` (createPortal)
- `pb-24` (116 pages), `pb-28` (4 pages — HomePage, ComunicadosPage), `pb-32` (5 pages) — arbitrário
- Tailwind `container` class NÃO é usada; pages hardcodam `max-w-3xl`, `max-w-2xl`

**API alvo:**
```jsx
<PageShell
  title="Gestão de Incidentes"
  onBack={goBack}
  containerSize="default" // 'default' | 'lg' | 'full'
  background="background"  // 'background' | 'card' | 'muted'
>
  {children}
</PageShell>
```

Implementação (esboço em `src/design-system/components/anest/page-shell.jsx`):
```jsx
const containerClasses = {
  default: 'px-4 sm:px-5',                                        // 182 pages
  lg: 'px-4 sm:px-5 lg:px-6 xl:px-8 max-w-3xl mx-auto',          // content pages
  full: 'w-full',
}
const pbClasses = { default: 'pb-24', tall: 'pb-28', extra: 'pb-32' }
```

### 1.6.3 Padrões interativos canônicos (~1 dia) — ✅ COMPONENTES CRIADOS (2026-05-28)

Criar/promover 5 componentes (adoção nas páginas é incremental):

| Componente | Resolve | File alvo | Status |
|---|---|---|---|
| `<FilterChips>` (extrair de `TipoTabs.jsx`) | 4 pages com filter UI diferente cada | `src/design-system/components/anest/filter-chips.jsx` | ✅ criado |
| `<FloatingActionButton>` | FABs improvisados com z-index aleatório (z-30, z-1050, z-1101) | `src/design-system/components/ui/fab.jsx` | ✅ criado (z-sticky) |
| `<FormActionBar>` (bottom fixed) | Submit bars com posicionamento e z-index inconsistente | `src/design-system/components/ui/form-action-bar.jsx` | ✅ criado (z-sticky) |
| `<SectionHeading>` | h2/h3 com 5 sizes/weights diferentes nas páginas | `src/design-system/components/ui/section-heading.jsx` | ✅ criado (DNA #8) |
| `<Tabs variant="pills">` | TipoTabs (DIY) e variant="underline" usados ad-hoc | Estender `tabs.jsx` existente | ✅ já existia |

---

## 📦 Fase 2 — Adicionar Componentes Prontos (~5 dias)

### 2.1 Componentes shadcn que faltam (~3 dias) — ✅ COMPONENTES CRIADOS (2026-05-28)

> Criados e exportados via `@/design-system`: `Command`+`CommandPalette` (cmdk) + `useCommandPaletteShortcut`, `Combobox`, `Drawer` (vaul), `HoverCard` (custom, sem dep Radix nova), `InputOTP` (input-otp), `Kbd`, `DataTable` (@tanstack/react-table). **Toast migrado para Sonner** mantendo 100% a API `useToast` (sem tocar nos ~79 call sites). Deps adicionadas: `vaul`, `sonner`, `@tanstack/react-table`, `input-otp`. **Follow-ups de adoção:** integração global do CommandPalette (busca em 73 calcs + 80 páginas) e adoção do DataTable em AuditLogTab/LgpdSolicitacoesTab/RelatoriosEducacao.

Estratégia: copy-paste source do shadcn registry + wrap em CVA + tokenizar para identidade ANEST.

| Componente | shadcn source | Onde plugar | Impacto |
|---|---|---|---|
| **Command Palette (cmd+k)** | `shadcn/ui command` (lib `cmdk`) | Global — busca em 73 calcs + 80 páginas | UX premium imediato |
| **Combobox** | shadcn (Base UI ou Radix) | Hospitais, medicamentos, usuários | Substitui multi-select hacks |
| **Data Table** | shadcn + TanStack Table v8 | AuditLogTab, LgpdSolicitacoesTab, RelatoriosEducacao | Sort + filter + pagination |
| **Sonner** | shadcn/ui `sonner` | Substituir toast atual | Stacking + promise API |
| **Drawer (vaul)** | shadcn/ui `drawer` | Bottom-sheet mobile | Match iOS aesthetic |
| **Hover Card** | shadcn/ui `hover-card` | Preview de calcs, usuários | UX polish |
| **Input OTP** | shadcn/ui `input-otp` | 2FA / verificação | Segurança |
| **Kbd** | shadcn/ui `kbd` | Atalhos visíveis na Command palette | Polish |

### 2.2 Componentes healthcare-specific (~1 dia)

Criar com base em NHS + VA + CFM 2.454/2026:

| Componente | Use case ANEST | File alvo |
|---|---|---|
| **ClinicalDisclaimer** | Disclaimer CFM 2.454/2026 sob todas as 73 calcs (regulatório) | `src/design-system/components/anest/clinical-disclaimer.jsx` |
| **WarningCallout** (NHS pattern) | APACHE II/P-POSSUM quando score crítico | `src/design-system/components/anest/warning-callout.jsx` |
| **StepIndicator** (USWDS pattern) | Multi-step incident reports, LGPD consent | `src/design-system/components/ui/step-indicator.jsx` |
| **DangerConfirmDialog** (Carbon pattern) | Type-to-confirm para anonimização (substitui `window.confirm()` em ComunicadosPage) | Estender `confirm-dialog.jsx` com variant `danger-typed` |
| **ConfirmationPage** (NHS pattern) | Pós-denúncia: código `ANEST-YYYY-XXXXXX` + next steps | `src/design-system/components/anest/confirmation-page.jsx` |

### 2.3 Ativar TanStack Query (~1 dia)

Já instalado em `package.json` mas zero `useQuery` no código. Wrap services Supabase:
- `src/services/supabaseComunicadosService.js`
- `src/services/supabaseIncidentsService.js`
- Mount `QueryClientProvider` em `src/main.jsx` próximo de `AuthGatedProviders`

Benefício: cache + dedupe + optimistic updates + smoother JWT cold-start.

---

## 🧹 Fase 3 — Drift Cleanup (~4 dias) — ⏳ EM ANDAMENTO (2026-05-28)

**Concluído (2026-05-28):**
- ✅ **3.7 Z-index** — 23 arquivos: `z-[1100]`→`z-modal`, `z-[1200]`/`z-[1101]`→`z-submodal`, `z-[9999]`/`z-[10000]`→`z-overlay`; backdrop→`z-modal`; barras flutuantes→`z-sticky`. Zero `z-[…]` hardcoded em pages/components. (`36036df`)
- ✅ **Raw Tailwind colors** — 16 arquivos: `bg-red-600`→`bg-destructive`, `bg-amber-500`→`bg-warning`, `text-*-600/400`→semânticos, `bg-gray-*`→`bg-muted`, `border-gray-200`→`border-border`. Zero raw colors em pages/components. (`016b1d7`)
- ✅ **3.1 org-node tokens** — família `--org-{tipo}-{slot}` (7 tipos, light+dark) em `anest-theme.css` + Tailwind config; `orgNodeColors.js` reescrito p/ consumir tokens. Fix latente: dark mode do organograma agora aplicado (`isDark` era hardcoded `false`). (`92861d5`)
- ✅ **3.1 hex em className** — 22 componentes/páginas via Workflow (pipeline refactor→verify adversarial, 46 agentes). DocumentoCard→category-*, status→semânticos, cinzas→muted/border/foreground, greens→institucionais. 3 veredictos `safe=false` corrigidos à mão. Lookup-keys de DB, props de chart/SVG (Recharts) e glows rgba mantidos (permitidos). (`f5f902a`)

- ✅ **3.6 Formatters (lib)** — `src/utils/formatters.js` (formatDate presets/formatNumber/formatCurrency/formatPercent/formatRelativeTime) + 18 testes Vitest. Saída default espelha `toLocaleDateString('pt-BR')`. **Migração dos 99 call sites DEFERIDA** (payoff invisível — saída idêntica por design — vs. risco por arquivo; disponível sob demanda). (`a4ee8fb`)
- ✅ **3.4 PageSkeleton** — `<PageSkeleton variant="list|grid|detail|dashboard">` compondo `<Skeleton>` (espelha PageShell). 1ª adoção: ReuniaoDetalhePage. Demais incremental. (`e7587e1`)

**Fixes de regressão (validação Playwright):**
- ✅ Organograma crashava (`IconComponent is not defined` — bug pré-existente em `a43b31b`, prop `_IconComponent` vs uso `IconComponent`). (`871a1da`)
- ✅ FaturamentoPage placeholder → `<WarningCallout>` + `<EmptyState>` DS + acentuação. (`07f34d1`)
- ✅ Validado: app boota sem erros; tokens semânticos/org/category resolvem light+dark (org vars exatos por tema via inline `var()`). Telas autenticadas validadas pelo user (organograma dark + faturamento OK).

**Concluído (sessão overnight 2026-05-28→29):**
- ✅ **3.6 Migração formatters** — 94 call sites `toLocale*('pt-BR')` → `@/utils/formatters` (byte-idêntico).
  Workflow teve falha de tooling (StructuredOutput); verificado manualmente: build verde, zero novas
  falhas de teste vs baseline, auditoria de diff dos presets. 15 skips legítimos (weekday-combo / Date+segundos). (`08cb2ff`)
- ✅ **3.4 PageSkeleton adoção** — +13 páginas (DocumentoDetalhe, faturamento, relatorios, educacao,
  autoavaliacao, kpi) via Workflow no-schema. Padrão `{header}` + `<PageSkeleton header={false}>`. (`d9c0595`)
- ✅ **Inline styles (EducacaoTab, ComunicadosPage)** — NO-OP consciente: todos data-driven (cores
  dinâmicas/progress/safe-area/motion); mexer quebra comportamento. Ver `overnight-decisions.md` D4.

**Pendente:**
- ⏸️ 3.5 Card hover normalizado (preferir `<Card variant="interactive">`) · 3.3 Empty states (hints inline, caso a caso)
- ⏸️ 3.2 Consolidar Card/charts redundantes (alto risco / baixo payoff — avaliar/skip) · magic spacing residual (~25 exact-maps, payoff visual zero)

### Métricas atuais de drift
- **444 hex hardcoded** em pages/components (excluindo Tokens.json + Recharts SVG)
- **222 inline styles** `style={{}}`
- **517 magic spacing** (`mt-[12px]`, `p-[15px]`, etc.)
- **28 raw Tailwind colors** (`bg-red-600` em vez de `bg-destructive`)
- **0 `!important` overrides** ✓
- Compliance: **31% token-driven** / 69% drift

### 3.1 Refactor concentrado (~2 dias)

Top offenders:
- `src/components/organograma/orgNodeColors.js` — **101 hex** (cria tokens `org-node-*`)
- `src/pages/educacao/admin/ControleEducacaoPage.jsx` — 24 magic spacing
- `src/pages/educacao/admin/AdminConteudoPage.jsx` — 13 magic spacing
- `src/components/DocumentoCard.jsx` — 25 hex
- `src/pages/management/educacao/EducacaoTab.jsx` — 11 inline styles
- `src/pages/ComunicadosPage.jsx` — 10 inline styles

### 3.2 Consolidar componentes redundantes (~1 dia)
- 8 variantes de Card → `<Card variant="widget|stat|action|section">` (Fase 1.1 já criou CVA base)
- 5 charts (Chart, DonutChart, LazyChart, LazyDonutChart, SparklineChart) → unificar interface

### 3.3 Empty States — unificação (4h)
3 padrões coexistem hoje: DS `EmptyState`, custom inline div, bare text. Migrar tudo para `EmptyState` DS.

### 3.4 Loading states — skeleton sistemático (4h)
40+ páginas carregam dados async **sem nenhum indicator**. Criar `<PageSkeleton>` templates por tipo (list, grid, detail).

### 3.5 Card hover affordance normalizado (2h)
Normalizar todos os clickable cards:
```
hover:-translate-y-px hover:shadow-elevation-2 transition-all active:scale-[0.98]
```

### 3.6 Formatters centralizados (2h)
Criar `src/utils/formatters.js`:
- `formatDate(date)` — pt-BR consistente
- `formatRelativeTime(date)` — "Há 2 horas" via date-fns
- `formatNumber(n, decimals=2)` — Intl.NumberFormat pt-BR
- `formatCurrency(n)` — R$ com 2 casas

Substituir `.toLocaleString('pt-BR')` ad-hoc em 30+ arquivos.

### 3.7 Z-index drift cleanup
56+ hardcoded `z-[1100]`, `z-[9999]`, `z-[1200]` em pages. Substituir por utilities `z-modal`, `z-overlay`, `z-submodal` (criadas na Fase 1.2).

---

## ✨ Fase 4 — Polish Premium (~3 dias)

### 4.1 Polish nativo CSS (~1 dia)
- **View Transitions API** — page swap nativo entre Home ↔ Gestão ↔ Educação ↔ Menu (60fps iOS Safari 18+)
- **`@starting-style`** — modal/popover enter sem Motion overhead
- **`LazyMotion` + `m.*`** — Framer Motion bundle de 30KB → 4.6KB

### 4.2 Magic UI cherry-pick (~1 dia)

Apenas 4 componentes que não conflitam com identidade ANEST:

| Magic UI component | Use case ANEST |
|---|---|
| **NumberTicker** | KPIs do Centro de Gestão (Qmentum %, ROP adherence) |
| **BlurFade** | Grid de 73 calculadoras (stagger entry) |
| **BorderBeam** (slow, greenBright única cor, 8s) | Comunicado urgente, deliberação aberta |
| **AnimatedList** | Feed de comunicados (entry choreography) |

**Skip:** Aceternity (muito flashy), GSAP (licença), React Spring (redundante), Rive (overkill).

### 4.3 AutoAnimate + Lottie (~4h)
- `@formkit/auto-animate` (3KB) — listas com add/remove/reorder
- `@lottiefiles/dotlottie-react` (6KB lazy) — 3-5 empty states healthcare-themed

### 4.4 Pull-to-refresh + Haptic (~4h)
- Hook `useHaptic` (`navigator.vibrate`)
- Pull-to-refresh em HomePage + listas principais

### 4.5 Typography variable + tabular-nums (~4h)
- Variable Inter (wght 400-700)
- `tabular-nums` em KPIs, escalas, timers, códigos
- `letter-spacing: -0.01em` em h1/h2

---

## 📊 Timeline e Status

| Fase | Estimativa | Status |
|---|---|---|
| 0 — DNA Rules (12) | doc | ✅ neste arquivo |
| 1 — Foundation | 4 dias | ✅ COMPLETA (em prod) |
| 1.6 — Page Patterns | 3 dias | ✅ componentes prontos (1.6.1 migração total + 1.6.2 PageShell + 1.6.3 os 5). Rollout PageShell incremental. |
| 2 — Componentes prontos | 5 dias | ⏳ próxima |
| 3 — Drift cleanup | 4 dias | ⏸️ |
| 4 — Polish premium | 3 dias | ⏸️ |
| **Total restante** | **15 dias** | |

---

## 🎯 Como Retomar (próxima sessão)

1. **Ler este documento + CLAUDE.md** — todo contexto está aqui, sem precisar refazer auditorias
2. **Próxima task:** Fase 1.6.1 — estender `PageHeader` com `usePortal` + migrar módulos. Começar por `src/pages/incidents/` (mais homogêneo, 12 pages).
3. **Build verde a cada checkpoint** — `npm run build`
4. **Commits granulares** — um commit por bloco lógico (não bundle múltiplas fases)
5. **Deploy ao fim de cada fase** — `npm run build && git push origin main && firebase deploy --only hosting:anest-ap`

---

## 🔗 Referências internas

- **CLAUDE.md** — convenções gerais
- **.claude/rules/design-tokens.md** — guia rápido de tokens
- **.claude/rules/padroes-codigo.md** — padrões de componente
- **Tokens.json** — fonte da verdade
- **src/design-system/Tokens.json:107-123** — typography scale (Fase 1.1)
- **src/design-system/Tokens.json:159-200** — shadows + zIndex (Fase 1.2)
- **src/design-system/hooks/useFocusTrap.js** — hook canônico modal/sheet
- **src/design-system/hooks/useSwipeBack.js** — gesto mobile

## 🔗 Referências externas (audit findings)

- shadcn/ui registry: https://ui.shadcn.com/docs/components (lista completa de gaps)
- Magic UI: https://magicui.design/docs (NumberTicker, BlurFade, BorderBeam, AnimatedList)
- NHS Design System: https://service-manual.nhs.uk/design-system/components (Warning Callout, Care Card)
- USWDS: https://designsystem.digital.gov/components/step-indicator/
- VA Alert: https://design.va.gov/components/alert
- CFM 2.454/2026: https://www.laudos.ai/pt-BR/blog/cfm-2454-2026-na-pratica
- eMAG: https://emag.governoeletronico.gov.br/

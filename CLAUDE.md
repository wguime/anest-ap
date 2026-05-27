# ANEST v5.0.0 — Gestão de Qualidade para Anestesiologia

> **Para humanos:** veja README.md no root e docs/dev-onboarding.md

App médico: React 19 + Vite + Tailwind 3 + Firebase Auth + Supabase (RLS via JWT custom HS256).
73 calculadoras clínicas (13 seções) + 7 critérios UTI, educação, gestão documental, LGPD/Qmentum compliance.

> **Nota:** versão `v3.77.0` é manual (tracked em `CHANGELOG.md`); `package.json.version` é `0.0.0`.

## Regra #1 — Pesquisar nos MCPs antes de implementar
- **docfork** — Doc up-to-date de libs (React, Tailwind, Framer Motion, Firebase, Supabase)
- **shadcn** — Browse/install/preview de componentes do registry
- **playwright** — Browser automation (testar UI, validar fluxos, screenshots)
- **firebase** _(a instalar)_ — Firestore CRUD + Auth direto
- **chrome-devtools** _(a instalar)_ — Console errors, network, Lighthouse

## Arquitetura — refs rápidas
- Providers (em `src/main.jsx`): `UserProvider → AuthGatedProviders → DeferredProviders` (2s delay)
- Componentes DS: `src/design-system/components/ui/` (61) + `anest/` (31)
- Tokens (fonte da verdade): `src/design-system/Tokens.json`
- Detalhes técnicos por subsistema: ver `.claude/rules/*` (auto-aplicadas)

## Comandos
| Comando | Uso |
|---------|-----|
| `npm run dev` | Dev server (Vite) |
| `npm run build` | Build de produção |
| `npm run preview` | Preview do build |
| `npm run lint` | ESLint |
| `npm run test` / `test:run` | Vitest |
| `firebase deploy --only hosting:anest-ap` | Deploy hosting |

## Deploy para Produção (sequência obrigatória)
1. `npm run build`
2. `git add -A && git commit -m "deploy: <descrição>"`
3. `git push origin main`
4. `firebase deploy --only hosting:anest-ap`

NUNCA pular o `git push`. GitHub é fonte de verdade do histórico.

## Verification Criteria
Antes de declarar pronto:
- [ ] `npm run build` passa sem erro
- [ ] `npm run dev` (esbuild) sobe sem erro — pega imports quebrados que rollup tolera
- [ ] Mudança visual: testar em browser via playwright MCP (screenshot)
- [ ] Calculadora clínica: validar matemática em inputs limites + edge cases
- [ ] Mutation Supabase/Firestore: `changedBy` é o user real (NUNCA `'admin'`/`'system'`)
- [ ] Componente novo: dual theme (light + dark) testado

## Padrões de execução por Wave (CRÍTICO para tarefas multi-step)
**Para wave/feature com 5+ tarefas:** seguir `@docs/wave-execution-playbook.md`. Consolida:
1. Workflow **Explore → Plan → Implement → Commit** (Anthropic best-practice)
2. Pre-flight obrigatório com 3 agentes paralelos (libs + map files + gaps arquiteturais)
3. Validar SQL com `migration-validator` agent ANTES de aplicar
4. Migration via `node scripts/deploy-sp21-mgmt-api.mjs apply-migration <path>` (NÃO `supabase db push` — CLI não instalado)
5. `AskUserQuestion` para decisões arquiteturais (não assumir)
6. `TaskCreate` granular + `TaskUpdate` em tempo real
7. Build verde a cada bloco lógico (checkpoint)
8. Commits granulares por bloco (deps / backend / UX / DS tokens)
9. Cloud Function deploy é tarefa DO USER (secrets via `firebase functions:secrets:set`)
10. Modal DS API: `title`/`description`/`footer` props (sem ModalHeader/Content/Footer)

## Calculadoras Clínicas
73 calculadoras ativas em 13 seções. Dados em `src/design-system/data/calculator-definitions.js`.

**Padrão para calculadoras complexas:**
- Lib pura: `src/lib/<nome>.js` (funções puras, `num()` helper, JSDoc, named exports)
- Display custom: `src/design-system/showcase/displays/<Nome>Display.jsx` (estado interno, sem props)
- Teste: `src/__tests__/lib/<nome>.test.js` (Vitest, edge cases obrigatórios)
- Na definição: `customRender: '<nome>'` + `inputs: []` + `compute: () => null`
- Em CalculatorShowcase.jsx: import + exclusion arrays + bloco `customRender === '<nome>'`
- `LEGACY_ID_MAP`: mapeia IDs antigos → novos para favoritos não quebrarem
- `getSectionsWithCalculators()` filtra `status: 'inactive'`

**Critérios UTI** (feature separada): `src/data/criteriosUtiCalculators.js` + `src/pages/CriteriosUTIPage.jsx`
7 calculadoras (SORT, ESS, POTTER, SAS, SIAARTI, P-POSSUM, CFM 2156) em 4 categorias (Pré-op / Intra-op / Composto / Regulatório).

## Comunicados
Widget na Home em estilo iOS Mail compacto (2 items). Arquitetura: 4 camadas.

**Fluxo:** `HomePage (widget)` → `ComunicadosPage (full)` → `ComunicadosContext (split State/Actions)` → `supabaseComunicadosService` → 3 tabelas Supabase (`comunicados`, `comunicado_confirmacoes`, `comunicado_acoes_completadas`).

**Widget Home** (`ComunicadosCard`): título "Comunicados", badge "Ver todos" no header, 2 comunicados recentes com: dot não-lido, autor, tipo (badge colorido), timestamp relativo, título, preview conteúdo. Empty state com ícone Megaphone. Backward compat: prop `items` string[] ativa modo legado (bullet list) usado por EducacaoPage, GestaoPage, GestaoDocumentalPage.

**Sino unificado:** `pendenciasCount = mensagens + notificações + comunicados não-lidos`. Ponte: publicar comunicado cria notificação na inbox via `notifyComunicadoPublicado`.

**Tipos com badges:** Urgente (destructive), Importante (warning), Informativo (info), Evento (default), Geral (secondary).

**Refs:**
- Widget DS: `src/design-system/components/anest/comunicados-card.jsx`
- Página: `src/pages/ComunicadosPage.jsx`
- Context: `src/contexts/ComunicadosContext.jsx`
- Service: `src/services/supabaseComunicadosService.js`
- Helpers: `src/utils/comunicadosHelpers.js`
- Monitor admin: `src/pages/management/comunicados/ComunicadosMonitorTab.jsx`

**Bugs conhecidos (auditoria 2026-05-27):**
- RLS UPDATE policy faltando para anestesiologistas (INSERT ok via migration 031, UPDATE requer admin_users)
- Notificação silent failure se `contextUsers` vazio ao publicar
- Z-index collision: modal detalhe e modal criar/editar ambos z-index 1100
- Dead code: `pinComunicado`/`unpinComunicado` no service sem migration/UI
- `window.confirm()` nativo para delete (deveria usar `ConfirmDialog` DS)

## Bottom Nav
4 abas: **Home** | **Gestão** (Shield) | **Educação** | **Menu**
(Dashboard temporariamente oculto; código preservado em `App.jsx`)

⚠️ Bug conhecido: `src/App.jsx:1011` (TODO BUG-06) — global BottomNav pode duplicar com per-page BottomNav (createPortal). Decisão arquitetural pendente. Em página nova, **NÃO** renderizar BottomNav próprio.

## Skills (`.claude/skills/`) — invocar com `/`
`/calculadoras` `/educacao` `/gestao-documental` `/centro-gestao` `/notificacoes` `/nova-pagina` `/supabase-migration` `/rotacao-residencia` `/importar-plantoes-residencia` `/sobreaviso` `/hospitais`

## Rules (`.claude/rules/`) — auto-aplicadas neste projeto
`design-tokens` · `responsividade` · `navegacao` · `lgpd` · `qmentum-compliance` · `supabase-firebase` · `padroes-codigo` · `audit-trail`

## Referências em `docs/`
escalas-plantoes · organograma · formularios-publicos · etica-comites · residencia · incidentes-denuncias · comunicados-inbox · faturamento · desastres · planos-acao · project-phases

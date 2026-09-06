# ANEST v5.8.0 — Gestão de Qualidade para Anestesiologia

> **Para humanos:** README.md no root e `docs/dev-onboarding.md`.
> **Conhecimento por módulo NÃO mora aqui.** Vive em `.claude/rules/*.md`, que o Claude Code carrega
> sozinho quando abre um arquivo daquele módulo. Este arquivo guarda só o que vale em TODA sessão.

App médico em uso clínico diário: React 19 + Vite + Tailwind 3 + Firebase Auth + Supabase (RLS via JWT
custom HS256). 71 calculadoras clínicas (13 seções) + 7 critérios UTI, educação, gestão documental,
LGPD/Qmentum, escalas/trocas de plantão, residência, cateteres peridurais, incidentes/denúncias,
comunicados e mensagens internas.

> A versão é manual (tracked em `CHANGELOG.md`); `package.json.version` é `0.0.0`.

## Regra #1 — Pesquisar antes de implementar

MCPs ativos (3, enxugados em 2026-08-06 — o notebook é um Air M1 de 8 GB e cada MCP custa ~150 MB):

- **playwright** — browser automation (testar UI, validar fluxos, screenshots, console/network)
- **supabase** — schema, migrations, advisors, logs
- **firebase** — Firestore CRUD + Auth direto

Doc de libs (React, Tailwind, Framer Motion, Firebase, Supabase) e registry do shadcn: **WebSearch/
WebFetch na doc oficial** — `docfork`/`shadcn`/`context7`/`chrome-devtools`/`lighthouse`/`firecrawl`
foram removidos por não-uso (0–1 invocações em 34 sessões). GitHub é pelo **`gh` CLI**, não por MCP.

## Regra #2 — Layout/DS congelado (dono 14/08)

Nenhuma mudança visual (cor, tipografia, espaçamento, componente DS, navegação, animação) sem
solicitação EXPRESSA do dono — o app está em uso clínico diário e mudança visual não pedida vira ruído
e retreinamento da equipe. Corrigir bug visual REPORTADO pelo dono conta como solicitação; melhoria ou
refactor oportunista de UI, não. Na dúvida, `AskUserQuestion` antes de tocar no visual.

⚠️ Corolário (dono 24/08): **melhoria nascida de um protótipo de fim de semana fica no fim de semana.**
O fluxo de dia útil é o ritmo estabelecido da equipe — mudança ali precisa de pedido próprio.

## Regra #3 — Modelo antes do código (mudança de tela)

Proposta visual vai primeiro como **HTML estático com os tokens reais, a 430px, nos dois temas**, com a
medição ao lado (altura dos controles, y do 1º item, quantos itens cabem sem rolar). Copiar o bloco
`:root`/`.dark` de um protótipo em `.tmp/` e **abrir no navegador dele** (`open .tmp/<arquivo>.html`) —
o dono escolhe por imagem; só então `src/` muda.

## Solicitações & Prompts (Fable 5)

- Pedido novo: dar o motivo junto — "[contexto/para quem] → [o que habilita] → [pedido] → [pronto
  quando: critério verificável]"
- Runs longos: antes de reportar progresso, auditar cada claim contra um tool result da sessão; teste
  falhou = reportar com output; não verificado = dizer explicitamente
- Escrever skill/agent/prompt/subagente: seguir `.claude/rules/prompting.md` (nunca pedir "mostre seu
  raciocínio" — refusal no Fable 5; instrução curta com porquê > checklist enumerado)
- Responder sempre em **português** — respostas, relatórios, resumos e AskUserQuestion. Código,
  identificadores e mensagens de commit seguem a convenção do repo

## Comandos

| Comando | Uso |
|---------|-----|
| `npm run dev` | Dev server (Vite) |
| `npm run build` | Build de produção |
| `npm run preview` | Preview do build |
| `npm run lint` | ESLint |
| `npm run test` / `test:run` | Vitest |
| `npm run test:e2e` | Playwright |
| `firebase deploy --only hosting:anest-ap` | Deploy hosting (fallback manual) |
| `bash scripts/deploy-edge-with-pat.sh <fn> [--no-verify-jwt]` | Deploy de Edge Function |
| `node scripts/deploy-sp21-mgmt-api.mjs apply-migration <path>` | Migration (o CLI do Supabase NÃO está instalado) |

## Verification Criteria

Antes de declarar pronto:

- [ ] `npm run build` passa sem erro
- [ ] `npm run dev` (esbuild) sobe sem erro — pega imports quebrados que o rollup tolera
- [ ] Mudança visual: testar em browser via playwright MCP (screenshot), nos DOIS temas
- [ ] Calculadora clínica: validar matemática em inputs limites + edge cases
- [ ] Mutation Supabase/Firestore: `changedBy` é o user real (NUNCA `'admin'`/`'system'`)
- [ ] Componente novo: dual theme (light + dark) testado

## Deploy para Produção

**Automático na main desde 2026-08-06** (`ci.yml` job `deploy`): push na main → lint/build/test →
publica o MESMO artefato testado. Fallback manual: `npm run build` · commit · `git push origin main` ·
`firebase deploy --only hosting:anest-ap`.

- **NUNCA pular o `git push`.** GitHub é a fonte de verdade do histórico.
- **NUNCA deployar com tree sujo** — o build compila o working tree, não o HEAD.
- **Gate de CI `regressao-escala`**: mudança em código da escala cirúrgica sem teste junto FALHA
  (o tema "isolar por turno" foi corrigido 3× em 2 dias e só a correção sem teste regrediu). Dispensa
  explícita com `[sem-teste: motivo]` na mensagem do commit. Barra merge, não deploy.
- **Branch protection na main:** force-push e deleção bloqueados, `enforce_admins: false`.
- ⚠️ **A suíte roda em `America/Sao_Paulo`** (`test.env.TZ` no `vite.config.js`), não no UTC do runner.
  **Sintoma a reconhecer: "passa aqui, falha lá" em teste com data/hora = FUSO, antes de qualquer outra
  hipótese.** Reproduzir com `TZ=UTC npm run test:run`.
- ⚠️ **Cada deploy renomeia os hashes e as 137 páginas são `React.lazy`**: cliente no bundle velho pede
  um chunk que não existe e recebe `index.html` (200, `text/html`) → a rota não renderiza. A recuperação
  em `errorReporting.js` é **one-shot por sessão** (`anest-chunk-reload-attempted`, nunca rearmada).
  Daí: **evitar deploy com turno em andamento** e, quando houver, avisar para fechar e reabrir o app.
- ⚠️ O `regex: "^/[^.]*$"` no `firebase.json` é o que impede o index velho de ficar 1h em cache — o
  casamento de header usa a URL **REQUISITADA** e acontece **ANTES do rewrite**, então
  `source: "/index.html"` NÃO alcança `/` nem `/escala-cirurgica`. Mudança só de header pode ir sem
  rebuild: mesmo `dist` = mesmo `buildId` = ninguém recarregado.

Texto integral com os incidentes que originaram cada regra: `docs/deploy-e-ci.md`.

## Arquitetura — refs rápidas

- **Providers** (`src/main.jsx`): `UserProvider → AuthGatedProviders → DeferredProviders` — árvore
  ESTÁVEL desde o 1º render; o Tier 2 adia só o FETCH 2s via `DeferredReadyContext`. ⚠️ voltar a
  condicionar a MONTAGEM remonta o App inteiro aos 2s (bug "Home recarrega sozinha", fix 31/07).
  `EscalaCirurgica` não consulta o gate (o card da Home busca já no mount).
- **Componentes DS**: `src/design-system/components/ui/` (61) + `anest/` (31).
- **Tokens (fonte da verdade)**: `src/design-system/Tokens.json`.
- **Navegação**: switch em `App.jsx` com a URL como fonte de verdade (react-router v7). Página nova =
  case no switch + entrada em `pageSlugs.js` + `PAGE_TO_CARD` se exigir permissão.
- **Bottom Nav**: 4 abas (Home · Gestão · Educação · Menu), visual TRAVADO, sem badge/dot. Em página
  nova, **NÃO** renderizar BottomNav próprio (`App.jsx:1011`, TODO BUG-06).

## Edge Functions (`supabase/functions/`)

`fetch-noticias` · `fetch-yt-captions` · `fetch-classics` · `notify-incident` ·
`schedule-shift-reminders` · `send-fcm-push` · `sign-cert` / `verify-cert-public` /
`verify-cert-uuid-public` / `get-cert-download-url` · `verify-doc-public` · `pdfa-convert` ·
`watermark-pdf` · `api-v1` · `ai-rag` · `pegaplantao-proxy` · `generate-api-token` ·
`get-supabase-token` · `parse-escala-cirurgica` (Claude Vision) · `relato-publico`

⚠️ Edge que recebe JWT não-Supabase (Firebase/custom) exige `--no-verify-jwt`. CORS: allowlist + echo +
`Vary: Origin` (nunca origin única). Conferir estado atual com `node scripts/diag-edge-fn-config.mjs`.

## Tarefas multi-step (wave com 5+ tarefas)

Seguir `docs/wave-execution-playbook.md`: Explore → Plan → Implement → Commit, pre-flight com agentes
paralelos, SQL validado pelo agente `migration-validator` ANTES de aplicar, `AskUserQuestion` para
decisão arquitetural, build verde a cada bloco lógico, commits granulares. Deploy de Cloud Function é
tarefa DO DONO (secrets via `firebase functions:secrets:set`).

## Onde está o resto

### `.claude/rules/` — carregam sozinhas ao abrir um arquivo que casa os `paths`

| Rule | Entra em contexto quando você toca em |
|---|---|
| `secrets.md` | **sempre** (higiene de credenciais não pode depender de abrir arquivo) |
| `design-tokens.md` · `responsividade.md` · `padroes-codigo.md` | qualquer `.jsx` / `.css` |
| `navegacao.md` | `App.jsx`, `src/pages/**` |
| `supabase-firebase.md` | services/contexts Supabase, `supabase/**` |
| `audit-trail.md` | `src/services/**` |
| `lgpd.md` | incidentes, users, formulários públicos, migrations |
| `qmentum-compliance.md` | gestão documental |
| `prompting.md` | `CLAUDE.md`, skills, agents, commands, rules |
| `escala-visao-geral.md` | página/gate/context/service da escala cirúrgica |
| `escala-liberacoes.md` | `LiberacoesView`, `colunaLiberacao`, `plantaoNoturno` |
| `escala-fds-feriado.md` | `escalaFds*`, importação/conferência de FDS |
| `escala-urgencias.md` | `escalaCirurgicaUrgencias`, `FaixaUrgencias`, `BoardView` |
| `escala-trocas.md` | `TrocaSheet`, `DefinirAnestesistaSheet`, importação |
| `escala-telas.md` | sheets e painéis da escala (`CasoDetalheSheet`, `PainelTempo`, …) |
| `escala-numerica.md` | `escalaNumerica.js/.json`, `extrair-escala-numerica.py`, `ordem-liberacao-numerica.mjs` (escala numérica do grupo = base da ordem de liberação) |
| `calculadoras-clinicas.md` | libs e displays de calculadora |
| `cateter-peridural.md` · `comunicados-notificacoes.md` · `faturamento-particulares.md` · `ferias.md` | os módulos homônimos |
| `modulos-diversos.md` | mensagens, perfil, escalas & trocas, residência, notícias, qualidade, busca |

⚠️ **A chave do frontmatter é `paths:`, não `globs:`** (essa é do Cursor; com ela a rule carrega em TODA
sessão). Rule nova = um assunto, `paths` estreito, e conferir com `/context` que só carregou onde devia.

### Skills (`.claude/skills/`) — invocar com `/`

`/calculadoras` `/educacao` `/gestao-documental` `/centro-gestao` `/notificacoes` `/nova-pagina`
`/supabase-migration` `/rotacao-residencia` `/importar-plantoes-residencia` `/escala`
`/escala-cirurgica` `/cirurgias-particulares` `/cateter-peridural` `/criar-prompt`

> `/escala` substitui as antigas `/sobreaviso` e `/hospitais`: um docx único por mês importa as duas
> escalas de uma vez.

### `docs/`

`ls docs/` lista os 60+ arquivos. Os de consulta frequente: `deploy-e-ci` · `escala-cirurgica`
(+ `-regras`, `-automacoes`, `-evolucao-tecnica`, `-analise-adesao`, `-metricas/`) ·
`cateter-peridural` · `cirurgias-particulares` · `codigos-anestesia` · `residencia` ·
`lgpd-retencao` · `lgpd-ripd-incidentes` · `wave-execution-playbook`.

## Mapa de Módulos

| Módulo | Entrada | Backend | Detalhe |
|---|---|---|---|
| Escala Cirúrgica Diária | hub `EscalasPage` → `src/pages/escala-cirurgica/` | `escala_cirurgica*` + Edge `parse-escala-cirurgica` (Vision) | 6 rules `escala-*` |
| Calculadoras + Critérios UTI | `CalculatorShowcase`, `CriteriosUTIPage` | libs puras em `src/lib/` | `calculadoras-clinicas.md` |
| Cateter Peridural | `src/pages/cateter-peridural/` | `cateteres_peridural` + followup, pg_cron 17h | `cateter-peridural.md` |
| Cirurgias Particulares | Gestão → Faturamento | `cirurgias_particulares` + trigger de auto-import | `faturamento-particulares.md` |
| Codificação Anestésica | Gestão → Faturamento | `unimed_tuss_codigos` (read-only) | `faturamento-particulares.md` |
| Extrato de Férias | pill "Extrato" no card Férias da Home | Pega Plantão + `ferias_movimentacoes` | `ferias.md` |
| Comunicados | `ComunicadosPage` + card em Gestão | `comunicados*` (3 tabelas) | `comunicados-notificacoes.md` |
| Notificações e Denúncias | card na `GestaoPage` → `IncidentesPage`; canal público pelo QR (`public/gestao-incidentes.html`) | `incidentes` + Edges `notify-incident` / `relato-publico` | `comunicados-notificacoes.md`, `docs/incidentes-denuncias.md` |
| Mensagens · Perfil · Escalas & Trocas · Residência · Notícias · Reuniões | `src/pages/{communication,escalas,residencia,noticias,reunioes}/`, `ProfilePage` | Firestore + Supabase | `modulos-diversos.md` |
| Qualidade (hub) | `QualidadePage` | agrega via `useCardPermissions` | Planos de Ação · Auditorias · Autoavaliação ROP · KPIs · Relatórios · ROPs quiz (640 q.) — `modulos-diversos.md` |
| Busca global · Pendências · Dashboard executivo | `SearchResultsPage`, `PendenciasPage`, `src/pages/dashboard/` | `supabaseSearchService` etc. | `modulos-diversos.md` |
| Centro de Gestão · Educação | `ManagementLayout`, `EducacaoPage` | 9 abas / Trilha→Curso→Módulo→Aula | `/centro-gestao`, `/educacao` |

<!-- Manutenção: este arquivo tem alvo de <200 linhas (guia oficial Anthropic). Antes de acrescentar,
     perguntar "removendo isto, o Claude erraria?" e "isto vale em TODA sessão ou só neste módulo?".
     Se for de módulo, vai para .claude/rules/ com `paths:`. Comentários HTML como este são removidos
     antes de entrar no contexto — custam zero token. Conferir com /context e /doctor. -->

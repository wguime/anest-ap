# ANEST v5.0.0 — Gestão de Qualidade para Anestesiologia

> **Para humanos:** veja README.md no root e docs/dev-onboarding.md

App médico: React 19 + Vite + Tailwind 3 + Firebase Auth + Supabase (RLS via JWT custom HS256).
73 calculadoras clínicas (13 seções) + 7 critérios UTI, educação, gestão documental, LGPD/Qmentum compliance, escalas/trocas de plantão, residência, cateteres peridurais, incidentes/denúncias, comunicados e mensagens internas.

> **Nota:** versão `v3.77.0` é manual (tracked em `CHANGELOG.md`); `package.json.version` é `0.0.0`.

## Regra #1 — Pesquisar nos MCPs antes de implementar
- **docfork** — Doc up-to-date de libs (React, Tailwind, Framer Motion, Firebase, Supabase)
- **shadcn** — Browse/install/preview de componentes do registry
- **playwright** — Browser automation (testar UI, validar fluxos, screenshots)
- **firebase** _(a instalar)_ — Firestore CRUD + Auth direto
- **chrome-devtools** _(a instalar)_ — Console errors, network, Lighthouse

## Solicitações & Prompts (Fable 5)
- Pedido novo: dar o motivo junto — "[contexto/para quem] → [o que habilita] → [pedido] → [pronto quando: critério verificável]"
- Runs longos: antes de reportar progresso, auditar cada claim contra um tool result da sessão; teste falhou = reportar com output; não verificado = dizer explicitamente
- Escrever skill/agent/prompt/subagente: seguir `.claude/rules/prompting.md` (nunca pedir "mostre seu raciocínio" — refusal no Fable 5; instrução curta com porquê > checklist enumerado)

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
Design iOS Mail em widget e página. Arquitetura: 4 camadas.

**Fluxo:** `HomePage (widget)` → `ComunicadosPage (full)` → `ComunicadosContext (split State/Actions)` → `supabaseComunicadosService` → 3 tabelas Supabase (`comunicados`, `comunicado_confirmacoes`, `comunicado_acoes_completadas`).

**Widget Home** (`ComunicadosCard`): título "Comunicados", badge "Ver todos" no header, 2 comunicados recentes com: dot não-lido absolute na margem, autor/título bold alinhados à esquerda com "Comunicados", tipo (badge subtle), timestamp relativo, preview conteúdo. Empty state com ícone Megaphone. Backward compat: prop `items` string[] ativa modo legado (bullet list) usado por EducacaoPage, GestaoPage, GestaoDocumentalPage.

**Página (iOS Mail list):** container único `rounded-2xl bg-card` com items separados por dividers (`mx-4 border-t`). Cada item: dot não-lido absolute, autor bold + badge tipo + timestamp, título bold, preview + clip icon. Sem cards individuais.

**Formulário criar/editar:** fullscreen com 4 seções agrupadas em cards (Essencial, Público-alvo, Datas, Compliance, Extras). Labels `uppercase tracking-wide text-primary` com ícones. Footer fixo com 3 botões (Cancelar, Rascunho, Publicar).

**Sino unificado:** `pendenciasCount = mensagens + notificações + comunicados não-lidos`. Ponte: publicar comunicado cria notificação na inbox via `notifyComunicadoPublicado`.

**Tipos com badges:** Urgente (destructive), Importante (warning), Informativo (info), Evento (secondary), Geral (default).

**Refs:**
- Widget DS: `src/design-system/components/anest/comunicados-card.jsx`
- Página: `src/pages/ComunicadosPage.jsx`
- Context: `src/contexts/ComunicadosContext.jsx`
- Service: `src/services/supabaseComunicadosService.js`
- Helpers: `src/utils/comunicadosHelpers.js`
- Monitor admin: `src/pages/management/comunicados/ComunicadosMonitorTab.jsx`

**Bugs da auditoria 2026-05-27 — RESOLVIDOS no hardening 2026-06-10:**
- RLS UPDATE+SELECT para autor (migration `20260626600000`, aplicada): autor edita/vê o próprio comunicado (inclusive rascunho/arquivado)
- Silent failure de notificação: fallback `fetchAllUsers` + warn + toast se `contextUsers` vazio
- Z-index: modal criar/editar e `ConfirmDialog` DS → `z-submodal` (1200)
- Dead code pin/unpin removido do service (colunas `is_pinned/*` existem via migration `20260626200000`, sem UI — futuro)
- `window.confirm()` já havia sido trocado por `ConfirmDialog` antes da auditoria

## Cateter Peridural
Acompanhamento de cateteres peridurais por hospital (Unimed/HRO): inserção → evolução PO diária (Bromage 0-3, nível sensitivo, taxa de infusão) → retirada com motivo. Dois eixos de alerta: **duração** (warning 72h / crítico 96h desde a inserção) e **não evoluído** (warning 24h / crítico 36h sem evolução; `getEvolucaoAlertLevel`). Tempo "desde a última evolução" aparece como linha no card E no detalhe (logo abaixo do tempo de atividade) + badge no card quando em alerta; o texto NÃO faz fallback p/ inserção (mostra "Sem evolução registrada" se nunca evoluído), mas o nível de alerta SIM. `dia_po` é DERIVADO da `data_avaliacao` (não sequencial; mesmo dia = PO0; N avaliações/dia).

- Tabelas: `cateteres_peridural` (+ `ultima_avaliacao_at`, mantida por trigger) + `cateteres_peridural_followup` (`data_avaliacao`; SEM UNIQUE) — migrations 027/028 + 20260627200000 (RLS) + 100000 (admin write)/110000 (data_avaliacao)/120000 (residente)/130000 (notif)/140000 (ultima_avaliacao)/150000 (cron)/160000 (admins)
- Páginas: `src/pages/cateter-peridural/` (listagem header `PageHeader`+lupa, NovoCateterPage, CateterDetalhePage)
- Context/Service: `src/contexts/CateterPeridualContext.jsx` + `src/services/supabaseCateterPeridualService.js` — ⚠️ typo histórico "Peridual" nos filenames/símbolos; manter, não renomear. ⚠️ toda coluna nova lida no front precisa entrar em `CAMEL_TO_SNAKE` (gera o reverso): faltou `ultima_avaliacao_at` e `cateter.ultimaAvaliacaoAt` ficava `undefined` em silêncio → alerta de evolução contava desde a inserção (fix deefbaa). Libs puras: `src/lib/cateterPo.js` (computeDiaPo) + `src/lib/cateterIndicadores.js`
- Config: `src/data/cateterPeridualConfig.js` (BROMAGE_SCALE, MAX_DURATION_HOURS=96, `getAlertLevel`/`getEvolucaoAlertLevel`/`calcHorasSemAvaliacao`/`formatDuracaoHoras`)
- **Notificações SERVER-SIDE** (o INSERT client-side tomava RLS 42501): triggers `SECURITY DEFINER` criam evento novo/evolução/retirada (`20260628130000`); lembretes (duração + não-evoluído) via **pg_cron** diário `notify_cateter_reminders()` (`20260628150000`) — `useCateterReminders` cliente REMOVIDO. Recipients: anestesiologista/residente ativos **+ admins**. LGPD: só iniciais (`cateter_iniciais` SQL = `pacienteIniciais` JS)
- Regras: HRO exige anestesiologista **e/ou** residente (Unimed: anestesiologista obrigatório); retirado nunca alerta. RLS por papel: RW p/ anestesiologista/medico-residente **e admin** (`20260627200000` + `20260628100000`); demais sem acesso
- Indicador de acreditação: % retirada ≤96h no card da listagem (`computeRetiradaCompliance`)

## Mapa de Módulos (sem seção própria acima)
| Módulo | Entrada | Backend | Notas |
|---|---|---|---|
| Mensagens internas | `src/pages/communication/` (Inbox, MessageDetail) | `MessagesContext` + `supabaseMessagesService` → tabela `messages` | Threads c/ respostas; `createSystemNotification` é a ponte de notificação usada por todos os módulos |
| Escalas & Trocas | EscalasPage, EscalasFuncionariasHubPage, `Trocas*Page` | Firestore: `trocas_plantao`/`trocas_sobreaviso`/`trocas_plantao_hospitalar` + overrides diários (`residenciaPlantaoDiario`, `sobreavisoMaternoDiario`, `hospitaisDiario`) | Códigos TR/SB/PH#####; aceitar troca grava override do dia; bases estáticas em `src/data/*2026.js`; identidade resolvida por email |
| Residência | ResidenciaHubPage, GerenciarResidenciaPage | `useResidencia` + `residenciaEstagiosDiariosService` (Firestore) | Estágios rodam a cada 15 dias, rollover 07h, pula FDS/feriados; ver `docs/residencia.md` |
| Reuniões | `src/pages/reunioes/` | `reunioesService` | Detalhe com 6 tabs (contexto, check-in, presença, docs, histórico, deliberações) |
| Notícias | NoticiasPage / NoticiaDetalhe / CategoriaNoticias | `NoticiasContext` → tabela `noticias`; Edge `fetch-noticias` (PubMed E-utilities) | 4 journals; dedup trigram + DOI |
| Qualidade (hub) | QualidadePage | agrega módulos abaixo via `useCardPermissions` | |
| Planos de Ação | `src/pages/planos-acao/` | `PlanosAcaoContext` → `planos_acao` | Ciclo PDCA + avaliação de eficácia |
| Auditorias | `src/pages/auditorias{,-interativas}/` | `AuditoriasInterativasContext` → `auditoria_execucoes` | Templates em `src/data/auditoriaTemplatesConfig.js`; status rascunho/em_andamento/concluida |
| Autoavaliação ROP | `src/pages/autoavaliacao/` | `AutoavaliacaoContext` → `autoavaliacao_rop` | Ciclos; 4 status de conformidade |
| KPIs | `src/pages/kpi/` | `supabaseKpiService` → `kpi_dados_mensais` | Entrada manual mensal |
| Relatórios | `src/pages/relatorios/` | `supabaseRelatoriosService` → `relatorios_qualidade` | |
| ROPs quiz | `src/pages/rops/` | `supabaseROPsService` → `rop_areas`/`rop_subdivisoes`/`rop_questions`/`rop_user_attempts` | 640 questões (32 ROPs × 20) |
| Pendências | PendenciasPage | agrega comunicados não-lidos + docs vencidos + ROPs pendentes | |
| Busca global | SearchResultsPage + `AppCommandPalette` | `supabaseSearchService` | 15+ tipos; atalhos custom via PersonalizarAtalhosPage |
| Faturamento | `src/pages/faturamento/` | `src/data/cbhpmData.js` (12 portes CBHPM 2020) | **Em construção** — páginas placeholder |
| Dashboard executivo | `src/pages/dashboard/` | `useDashboardExecutivo` | Oculto da nav; admin-only; 21+ KPIs |
| Refeição Unimed | card em MenuPage → `src/pages/RefeicaoUnimedPage.jsx` | externo (form Hoobox, embed iframe) | Rota interna `/refeicao-unimed`; URL fixa do QR do mural (Unimed Chapecó); abre no app, não em aba externa; sem gate de permissão |
| Codificação Anestésica | card em MenuPage → `src/pages/codificacao-anestesica/` | Supabase `unimed_tuss_codigos` (read-only, ~5.4k TUSS HM+SADT) + lib pura `src/lib/codificacaoAnest{,Rules}.js` + `src/data/codigosAnestesia.js` (grupo 31602 curado) | Calculadora de guia: cola códigos autorizados → valor a pagar, porte, **percentualização** (cir. 100/70/50 por via; anestesia instr.7 maior=100%), e quando anestesia zera (porte 0/SADT) recomenda **31602355** (imperativo clínico)/**31602347** (sem porte) + justificativa. Sem gate. Tabelas Intercâmbio (1,17) e Chapecó (1,73=derivada). Seed: `scripts/extract-tuss-from-xlsx.mjs` → `scripts/seed-unimed-tuss.mjs`. ⚠ percentuais redutores são regra de auditoria (não constam da tabela), defaults editáveis; ref. `docs/codigos-anestesia.md` |

## Edge Functions (`supabase/functions/`)
`fetch-noticias` (PubMed, dedup) · `fetch-yt-captions` · `fetch-classics` · `notify-incident` · `schedule-shift-reminders` · `send-fcm-push` · `sign-cert` / `verify-cert-public` / `verify-cert-uuid-public` / `get-cert-download-url` · `verify-doc-public` · `pdfa-convert` · `watermark-pdf` · `api-v1` · `ai-rag` · `pegaplantao-proxy` · `generate-api-token` · `get-supabase-token`

Deploy: `scripts/deploy-edge-fn-mgmt.mjs`. Edges que recebem JWT não-Supabase (Firebase/custom) exigem `--no-verify-jwt`. CORS: allowlist + echo + `Vary: Origin` (nunca origin única).

## Bottom Nav
4 abas: **Home** | **Gestão** (Shield) | **Educação** | **Menu**
(Dashboard temporariamente oculto; código preservado em `App.jsx`)

⚠️ Bug conhecido: `src/App.jsx:1011` (TODO BUG-06) — global BottomNav pode duplicar com per-page BottomNav (createPortal). Decisão arquitetural pendente. Em página nova, **NÃO** renderizar BottomNav próprio.

## Skills (`.claude/skills/`) — invocar com `/`
`/calculadoras` `/educacao` `/gestao-documental` `/centro-gestao` `/notificacoes` `/nova-pagina` `/supabase-migration` `/rotacao-residencia` `/importar-plantoes-residencia` `/escala` `/cateter-peridural` `/criar-prompt`

> `/escala` substitui as antigas `/sobreaviso` e `/hospitais`: um docx único por mês (template gerado pela própria skill) importa as duas escalas de uma vez.

## Rules (`.claude/rules/`) — auto-aplicadas neste projeto
`design-tokens` · `responsividade` · `navegacao` · `lgpd` · `qmentum-compliance` · `supabase-firebase` · `padroes-codigo` · `audit-trail` · `prompting`

## Referências em `docs/`
escalas-plantoes · cateter-peridural · organograma · formularios-publicos · etica-comites · residencia · incidentes-denuncias · comunicados-inbox · faturamento · desastres · planos-acao · project-phases

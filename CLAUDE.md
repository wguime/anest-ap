# ANEST v5.0.0 — Gestão de Qualidade para Anestesiologia

> **Para humanos:** veja README.md no root e docs/dev-onboarding.md

App médico: React 19 + Vite + Tailwind 3 + Firebase Auth + Supabase (RLS via JWT custom HS256).
73 calculadoras clínicas (13 seções) + 7 critérios UTI, educação, gestão documental, LGPD/Qmentum compliance, escalas/trocas de plantão, residência, cateteres peridurais, incidentes/denúncias, comunicados e mensagens internas.

> **Nota:** versão `v3.77.0` é manual (tracked em `CHANGELOG.md`); `package.json.version` é `0.0.0`.

## Regra #1 — Pesquisar antes de implementar
MCPs ativos (3, enxugados em 2026-08-06 — o notebook é um Air M1 de 8 GB e cada MCP custa ~150 MB):
- **playwright** — Browser automation (testar UI, validar fluxos, screenshots, console/network)
- **supabase** — Schema, migrations, advisors, logs
- **firebase** — Firestore CRUD + Auth direto

Doc de libs (React, Tailwind, Framer Motion, Firebase, Supabase) e registry do shadcn: usar
**WebSearch/WebFetch** na doc oficial — `docfork`/`shadcn`/`context7`/`chrome-devtools`/`lighthouse`/`firecrawl`
foram removidos por não-uso (0–1 invocações em 34 sessões). GitHub é pelo **`gh` CLI**, não por MCP.

## Regra #2 — Layout/DS congelado (dono 14/08)
Nenhuma mudança visual (cor, tipografia, espaçamento, componente DS, navegação, animação) sem solicitação EXPRESSA do dono — o app está em uso clínico diário e mudança visual não pedida vira ruído e retreinamento da equipe. Corrigir bug visual REPORTADO pelo dono conta como solicitação; melhoria/refactor oportunista de UI, não. Na dúvida, AskUserQuestion antes de tocar no visual.

## Solicitações & Prompts (Fable 5)
- Pedido novo: dar o motivo junto — "[contexto/para quem] → [o que habilita] → [pedido] → [pronto quando: critério verificável]"
- Runs longos: antes de reportar progresso, auditar cada claim contra um tool result da sessão; teste falhou = reportar com output; não verificado = dizer explicitamente
- Escrever skill/agent/prompt/subagente: seguir `.claude/rules/prompting.md` (nunca pedir "mostre seu raciocínio" — refusal no Fable 5; instrução curta com porquê > checklist enumerado)

## Arquitetura — refs rápidas
- Providers (em `src/main.jsx`): `UserProvider → AuthGatedProviders → DeferredProviders` — árvore ESTÁVEL desde o 1º render; Tier 2 adia só o FETCH 2s via `DeferredReadyContext` (voltar a condicionar a montagem remonta o App inteiro aos 2s — bug "Home recarrega sozinha", fix 31/07). EscalaCirurgica não consulta o gate (card da Home busca já no mount)
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

## Deploy para Produção
**Deploy AUTOMÁTICO na main desde 2026-08-06** (`ci.yml` job `deploy`): push na main → lint/build/test → publica o MESMO artefato testado no hosting. Motivo: correção ficava dias no git sem chegar ao hospital ("o bug corrigido voltou" = nunca tinha sido deployado — caso c2a11e2, 05→06/08). Secrets no GitHub: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` ✅ (a anon key saiu do bundle PÚBLICO em `dist/assets/`, nunca do `.env.local`) · `FIREBASE_SERVICE_ACCOUNT_ANEST_AP` **só o dono cria** (chave-mestra gerada no Console → Contas de serviço). Sem ela o job falha no `action-hosting-deploy` e o deploy segue manual:
1. `npm run build` · 2. commit · 3. `git push origin main` · 4. `firebase deploy --only hosting:anest-ap`

NUNCA pular o `git push`. GitHub é fonte de verdade do histórico. **Gate de CI `regressao-escala`**: mudança em código da escala cirúrgica sem teste junto FALHA (o tema "isolar por turno" foi corrigido 3× em 2 dias e só a correção sem teste regrediu); dispensa explícita com `[sem-teste: motivo]` na mensagem do commit. O gate barra merge, não deploy. **Branch protection na main (08/08):** só esse check é obrigatório, force-push e deleção bloqueados, `enforce_admins: false` (o dono continua empurrando direto — o objetivo é impedir reescrita de histórico, não criar burocracia).

⚠️ **A suíte roda em `America/Sao_Paulo`** (`test.env.TZ` no `vite.config.js`), não no UTC do runner. Os testes da escala congelam um INSTANTE (`2026-07-28T10:00:00-03:00`), que em UTC vira 13h — turno vespertino — e as fixtures matutinas caíam: 28 testes vermelhos no CI e verdes no Mac, com o `Test` reprovado (e o deploy "skipped") em TODO commit de 05 a 08/08. Como toda regra de horário do app é escrita em BRT (turno, fase noturna 19h/23h, rollover 07h, crons 18h/20h30), fixar o fuso de produção é o que faz CI e máquina local verem o mesmo relógio. **Sintoma a reconhecer: "passa aqui, falha lá" em teste com data/hora = fuso, antes de qualquer outra hipótese.**

**Cada deploy renomeia os hashes e as 137 páginas são `React.lazy`** — cliente no bundle velho pede um chunk que não existe mais e recebe `index.html` (200, `text/html`), então a rota não renderiza. A recuperação em `errorReporting.js` é **one-shot por sessão** (chave `anest-chunk-reload-attempted`, nunca rearmada): o 1º erro do dia gasta o reload e os deploys seguintes ficam sem rede. Daí: **evitar deploy com turno em andamento** e, quando houver, avisar para fechar e reabrir o app. O `regex: "^/[^.]*$"` no `firebase.json` é o que impede o index velho de ficar 1h em cache — o casamento de header usa a URL REQUISITADA e acontece ANTES do rewrite, então `source: "/index.html"` NÃO alcança `/` nem `/escala-cirurgica` (incidente 29/07). Mudança só de header pode ir sozinha, sem rebuild: mesmo `dist` = mesmo `buildId` = ninguém recarregado.

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

**Card (2026-07-22: saiu da Home → aba Gestão):** `ComunicadosCard` modo legado logo abaixo do card Biblioteca em GestaoPage — títulos recentes como bullets + badge "N não lidos"/"Ver todos". O modo feed iOS-Mail do componente (prop `comunicados`) segue no DS sem uso ativo; o modo legado (prop `items` string[]) é usado por EducacaoPage, GestaoPage, GestaoDocumentalPage. No lugar do widget na Home entrou o `EscalaCirurgicaHomeCard` (ver Escala Cirúrgica Diária).

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
Acompanhamento de cateteres peridurais por hospital (Unimed/HRO): inserção → evolução PO diária (Bromage 0-3, nível sensitivo, taxa de infusão) → retirada com motivo. Dois eixos de alerta: **duração** (warning 72h / crítico 96h desde a inserção) e **não evoluído** (warning 30h / crítico 42h sem evolução; `getEvolucaoAlertLevel`). Tempo "desde a última evolução" aparece como linha no card E no detalhe (logo abaixo do tempo de atividade) + badge no card quando em alerta; o texto NÃO faz fallback p/ inserção (mostra "Sem evolução registrada" se nunca evoluído), mas o nível de alerta SIM. `dia_po` é DERIVADO da `data_avaliacao` (não sequencial; mesmo dia = PO0; N avaliações/dia).

- Tabelas: `cateteres_peridural` (+ `ultima_avaliacao_at`, mantida por trigger; **na publicação `supabase_realtime` só desde `20260808120000`** — o context assinava a tabela desde sempre, era código morto, e o cliente nunca via o UPDATE do trigger: por isso o badge "sem evolução" persistia depois de evoluir e só sumia ao recarregar. O context também espelha o trigger localmente em `TOUCH_ULTIMA_AVALIACAO`) + `cateteres_peridural_followup` (`data_avaliacao`; SEM UNIQUE) — migrations 027/028 + 20260627200000 (RLS) + 100000 (admin write)/110000 (data_avaliacao)/120000 (residente)/130000 (notif)/140000 (ultima_avaliacao)/150000 (cron)/160000 (admins)
- Páginas: `src/pages/cateter-peridural/` (listagem header `PageHeader`+lupa, NovoCateterPage, CateterDetalhePage)
- Context/Service: `src/contexts/CateterPeridualContext.jsx` + `src/services/supabaseCateterPeridualService.js` — ⚠️ typo histórico "Peridual" nos filenames/símbolos; manter, não renomear. ⚠️ toda coluna nova lida no front precisa entrar em `CAMEL_TO_SNAKE` (gera o reverso): faltou `ultima_avaliacao_at` e `cateter.ultimaAvaliacaoAt` ficava `undefined` em silêncio → alerta de evolução contava desde a inserção (fix deefbaa). Libs puras: `src/lib/cateterPo.js` (computeDiaPo) + `src/lib/cateterIndicadores.js`
- Config: `src/data/cateterPeridualConfig.js` (BROMAGE_SCALE, MAX_DURATION_HOURS=96, `getAlertLevel`/`getEvolucaoAlertLevel`/`calcHorasSemAvaliacao`/`formatDuracaoHoras`)
- **Notificações: SÓ LEMBRETES (dono 30/07)** — os eventos novo/evolução/retirada NÃO notificam mais ninguém: triggers dropados (migration `20260730160000`) E chamadas client-side removidas das páginas (`cateterNotifications.js` deletado; havia 10.881 notifs acumuladas, ~98% não lidas — apagadas com backup). ⚠️ não recriar notificação de evento — se o trigger voltar sem o dedup, o insert do front (se reintroduzido) duplica. Ficam SÓ os lembretes clínicos (duração 72/96h + não-evoluído 30/42h) via **pg_cron** diário `notify_cateter_reminders()` (`20260628150000`, revisado em `20260808120000`; helpers `_cateter_reminder_insert` + `cateter_iniciais` mantidos). Recipients: anestesiologista/residente ativos **+ admins**. LGPD: só iniciais (`cateter_iniciais` SQL = `pacienteIniciais` JS). ⚠️ **o lembrete "registrar PO1/PO2" é gated por `max(dia_po)`** (migration `20260808120000`): antes decidia só pelo tempo desde a inserção e cobrava PO já evoluído — 56 pessoas receberam 3 avisos falsos em 06–08/08; 72/96h seguem SEM gate (é alerta de retirada, vale com o cateter em dia). O cron saiu de 07h BRT (antes da visita) para **17h BRT**
- Regras: HRO exige anestesiologista **e/ou** residente (Unimed: anestesiologista obrigatório); retirado nunca alerta. RLS por papel: RW p/ anestesiologista/medico-residente **e admin** (`20260627200000` + `20260628100000`); demais sem acesso
- Indicador de acreditação: % retirada ≤96h no card da listagem (`computeRetiradaCompliance`)

## Mapa de Módulos (sem seção própria acima)
| Módulo | Entrada | Backend | Notas |
|---|---|---|---|
| Mensagens internas | `src/pages/communication/` (Inbox, MessageDetail) | `MessagesContext` + `supabaseMessagesService` → tabela `messages` | Threads c/ respostas; `createSystemNotification` é a ponte de notificação usada por todos os módulos. ⚠️ Lista da inbox usa `<div>` simples, **não** `AnimatedList`: o wrapper `layout` do framer movia a linha sob o dedo entre press/release → 1º clique não registrava ("fica parado na lista"), só em prod c/ dados reais (cliques atômicos do Playwright não reproduzem). Fix 956aedd |
| Meu Perfil | `src/pages/ProfilePage.jsx` (rota `/profile`) | Firestore `userProfiles` (fonte da verdade; `crm`/`especialidade` são **Firestore-only**, sem coluna no Supabase `profiles`) + `updateUser` sincroniza só `nome` p/ Supabase | Estrutura (best-practice pesquisada): Identidade (avatar + credenciais **CRM · especialidade** + **1 cargo** admin>coord>role) → Mensagens (atalho discreto) → Conta e Segurança → Modo Escuro → Administração (admin) → LGPD → Sair. ⚠️ **Gotcha save silencioso:** Firestore tem persistência offline (`persistentLocalCache`) → `updateDoc` resolve no cache e mostra toast de "sucesso" mesmo se a escrita do servidor for rejeitada (sessão/token Firebase degradado) → o valor some ao recarregar (`updateTime` do doc no servidor não muda). **Re-login renova o token e resolve.** |
| Escalas & Trocas | EscalasPage, EscalasFuncionariasHubPage, `Trocas*Page` | Firestore: `trocas_plantao`/`trocas_sobreaviso`/`trocas_plantao_hospitalar` + overrides diários (`residenciaPlantaoDiario`, `sobreavisoMaternoDiario`, `hospitaisDiario`) | Códigos TR/SB/PH#####; aceitar troca grava override do dia; identidade resolvida por email. **Base funcionárias é DINÂMICA (31/07):** docx mensal importado in-app (Hub → Importar, parser `src/lib/escalaFuncionariasDocx.js`) publica `escalasFuncionarias/{YYYY-MM}` (write = `hasEscalasEditPermission`) — mês publicado SUBSTITUI o mês inteiro do estático via registro `BASE_ATIVA` em `src/data/*2026.js` (abr–ago/2026 = fallback congelado; `EscalasFuncionariasBaseContext` publica `version` p/ re-render); cron `enviarLembretesEscala` 18h lê a coleção (dedup compartilhada c/ o hook client: sufixo `1day`/`1day-d0`). **Atestado = "ATESTADO" na escala (dono 08/08):** o rótulo público vem do `PUBLIC_PLACEHOLDER` de `src/lib/staffMedicalLeaves.js` — **fonte ÚNICA**; `staffMedicalLeaveService` importa em vez de repetir o texto (repetia "INDISPONÍVEL" à mão, e documento público × projeção admin divergiam para o mesmo dado). Mostra só o motivo operacional: sem datas, sem diagnóstico, sem nome de quem cobre — dado de saúde, art. 11 LGPD. |
| Residência | ResidenciaHubPage, GerenciarResidenciaPage | `useResidencia` + `residenciaEstagiosDiariosService` (Firestore) | Estágios rodam a cada 15 dias, rollover 07h, pula FDS/feriados; ver `docs/residencia.md` |
| Reuniões | `src/pages/reunioes/` | `reunioesService` | Detalhe com 6 tabs (contexto, check-in, presença, docs, histórico, deliberações) |
| Notícias | NoticiasPage / NoticiaDetalhe / CategoriaNoticias | `NoticiasContext` → tabela `noticias`; Edge `fetch-noticias` (PubMed E-utilities) | 4 journals; dedup trigram + DOI. **Curadoria de destaques (15/08):** `curadoria_por`+`curadoria_destaque_ate` (migration `20260815210000`) seguram o artigo indicado no TOPO dos destaques até o prazo, com badge "Curadoria {nome}" — lib pura `src/lib/noticiasDestaques.js` ordena curadoria ativa antes do `final_score`, `fetchHighlights` busca curados fora do top-10 e o recompute semanal re-marca `is_featured` (sem o passo extra o cron de segunda derrubava a curadoria). Artigo de journal fora do cron entra por INSERT em migration — DOI SEMPRE minúsculo (convenção da edge; índice único é case-sensitive). Badge no verde padrão do DS (`default` subtle, dono 16/08). PDF completo (só licença CC-BY — a URL é pública): arquivo em `public/artigos/*.pdf` + `oa_pdf_url` RELATIVO (`/artigos/...`) — URL relativa renderiza no **PDFViewer da gestão documental** (react-pdf, Suspense local obrigatório); URL externa (PMC) segue no iframe `PDFEmbed`. O bucket `noticias-artigos` (20260816120000) ficou VAZIO/sem uso: upload exigia service_role e o agente é barrado — hosting serve o arquivo antes do rewrite e funciona em dev e prod. 1ª curadoria: Dr. Humberto Hepp, 3 artigos até 14/09/2026 |
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
| Codificação Anestésica | card em **Gestão → Faturamento** (`FaturamentoPage`, saiu do Menu 2026-07-26) → `src/pages/codificacao-anestesica/` | Supabase `unimed_tuss_codigos` (read-only, ~5.4k TUSS HM+SADT) + lib pura `src/lib/codificacaoAnest{,Rules}.js` + `src/data/codigosAnestesia.js` (grupo 31602 curado) | Calculadora de guia estilo Volan: autocomplete (digita **código OU nome** → sugestões ao vivo via RPC `search_unimed_tuss` — **acento-insensível + multi-palavra**, migration `20260622140000` + extensão `unaccent`; com **favoritos** em localStorage `anest-cod-fav`, **sem ícone de lupa**) → cada linha com **quantidade** + **% MANUAL por linha** (entra a 100%; ajuste no badge **DropdownMenu** com `OPCOES_PERCENTUAL` 10/30/40/50-mesma via/70-outra via/100-principal). A cascata oficial **100/50/40/30/10** (`CASCATA_PERCENTUAL`/`sugerirPercentuais`, v2026.03 itens 2.1.21/4.6) é **explicada na legenda do card, não auto-aplicada** (auto-% recusado pelo dono). + valor cirurgião/anestesista. **UTM fixa R$ 1,75** (Chapecó, sem seletor, Lista v.09 01/04/2026 — subiu de 1,73) = stored×(1,75/1,17). **Acomodação** (`Select`, `ACOMODACOES`): Apartamento dobra **por código** (item XIV) via `dobraAcomodacao` — cirúrgicos 3xxx HM geral; 1/2/4 só se em `LISTA_DOBRA`; SADT/demais não dobram → `calcularGuia(opts.acomodacaoMult)` aplica a dobra por linha (o card mostra "dobrado"/"não dobra: SADT|fora da lista"). **Toggle Urgência/emergência +30%** (`opts.urgencia`, item 1.3) — só HM (SADT nunca, 1.3.2). Card de cada código mostra **Porte cir. + Indicador anest. (porte oficial v2026.03) + UTM** (anestésica = `INDICADOR_UTM[indicador]`, proc. = valor/1,17) + nº auxiliares (item 3.1) + nota **2º anestesista** quando transplante/CEC/neonato/gastroplastia (`indicaSegundoAnestesista`, item 4.8 = 30% do titular). Limite de **3 proc. SADT diagnóstico** p/ anestesia (item 4.16, flag `limiteSadt`). Totais. **Recomendação do ato anestésico segue a hierarquia oficial v2026.03 §4.3** (`recomendarCodigo` + `src/data/codificacaoAnestProtocolo.js`): 4.3.3 deny (`SEM_ATO_ANESTESICO` 121→`sem_anestesia`, não recomenda) → 4.3.1 exame (`RECOMENDACAO_EXAME` → 31602231–304) → 4.3.2 lista `LISTA_31602312` (159 cods → **31602312**) → 4.3.4 fallback (SADT→31602304 B · HM→31602355 E); 31602347 = odontológico. Indicador **A = 128 UTM = R$149,76** (planilha legada trazia 150; migration `20260624120000` corrige + insere 2 DIU faltantes). Honorário do cirurgião de 47 códigos HM reajustado na v.09 (migration `20260625120000`). Demo espelho: `public/codificacao-anestesica-demo.html`. Consulta = referência 31602 por situação (cada item **accordion**) + tabela **SADT→anestesia** (`SADT_EXAME_ANESTESIA`, item 4.3.1: RM→282, TC→274, US→266, endoscopia→231/240, etc.). **EM PRODUÇÃO desde 2026-07-26** (o guard `import.meta.env.DEV` da incubação saiu de App.jsx; card sem gate próprio — quem chega ao hub Faturamento vê). Seed: `scripts/extract-tuss-from-xlsx.mjs` → `scripts/seed-unimed-tuss.mjs`. Refs: `docs/codigos-anestesia.md`, `docs/codificacao-anestesica-v2026.03-analise.md` |
| Escala Cirúrgica Diária | card no hub **EscalasPage** (Gestão→Escalas) → `src/pages/escala-cirurgica/` | Supabase `escala_cirurgica` + `escala_cirurgica_caso` + `escala_cirurgica_evento` (migrations `20260628200000` → `20260729210000`; RLS por `can_write_escala_cirurgica()` = clínico/técnico de enfermagem/secretária OU admin (migration `20260724100000`); realtime nas 2 tabelas + `escala_plantao_p4_diario`; `trocas_cirurgicas` existe no banco mas o app não lê mais) + Edge `parse-escala-cirurgica` (Claude Vision) + lib pura `src/lib/colunaLiberacao.js` | **LIBERADO AO GRUPO 2026-07-22** (piloto de 1 encerrado): gate `podeVerEscalaCirurgica(user)` em `escala-cirurgica/gate.js` agora por papel (clínico/técnico de enfermagem/secretária/admin — **escala COLABORATIVA**, técnicos incluídos 2026-07-24; espelha a RLS) em EscalasPage + rota App.jsx. Papéis com acesso = write E read (mesma função `can_write_escala_cirurgica`); o front tem **fonte única** em `gate.js` — `podeVerEscalaCirurgica` (com escape DEV) + `podeEditarEscalaCirurgica` (sem DEV, usado por página/BoardView/Importar) — ambas via `normalizeRole`, então cargo em alias legado ('medico'/'residente'/'tecnico_enfermagem') não cai mais em canEdit falso; mudar os slugs = mudar `PAPEIS_COM_ACESSO` + a RLS. Checklist de liberação executado: seeds APAGADAS + eventos de teste limpos + cron `escala-seed-rollover-daily` desligado; regressão visual PAUSADA (fixture era a seed-20 — `test.skip` no spec, aguarda nova fixture); aviso 18h segue só p/ o dono (trocar p/ secretaria/admin quando houver). **SEM NOTIFICAÇÕES (dono 30/07):** a escala não manda mensagem NENHUMA ao grupo — as 6 fontes do context (escalado ao publicar/liberado/sala encerrou/anestesista livre/assumiu-repassou caso/novo caso) foram REMOVIDAS (a inbox tinha 99 não lidas em 23 pessoas — ninguém lia; a tela realtime é a fonte); único aviso restante é o cron 18h ao dono; regressão travada nos testes de personas (notifyUsers nunca chamado). Se algum aviso voltar, que seja opt-in e agregado, não por evento. Mobile-first: data (`DatePicker` DS) + turno + hospital (Unimed/HRO/Materno) + **3 abas**. **Completa** (`BoardView`): cards por sala (`Accordion` com `iconAfterActions` — ⇆ antes do chevron), **status em 2 EIXOS** — principal pinta o card (agendada neutro / **Iniciada VERDE** / **Terminada AZUL info**) + extra em badge toggle que convive c/ agendada-iniciada, nunca c/ terminada (**Atrasada âmbar / Suspensa vermelho / Passa para tarde ROXO** `category-purple`; CHECK de invariante no banco, RPC `rpc_escala_status_cirurgia` FOR UPDATE) — sheet 3×2 (extras desabilitados se terminada); tipo **Urgência/Emergência ambos VERMELHOS** (subtle/solid); convênio em **selo TONAL** (`bg-black/10`) no canto inferior direito (sem stripes); helper `familiaConvenio` (SUS/UNIMED/BRF/FAS/SC/CASSI/PARTICULAR/INTERCÂMBIO; dark = verde sólido); adicionar caso; **TROCAS APOSENTADAS (23/07, decisão do dono: 'muito complexo')** → `DefinirAnestesistaSheet` em 2 MODOS (⚠️ lição 23/07: o modo sala-inteira ACHATOU o IOSC p/ uma pessoa — `alvosTrocaResponsavel` decide os alvos e o update sala-wide NÃO EXISTE em nenhuma camada): header da sala = só os casos do responsável-BASE (+herdadas //; linhas com anestesista próprio ficam de fora e o sheet lista quem não muda); detalhe do caso = 'Anestesista deste caso' (caminho p/ IOSC/Exames/Umanitá). Select searchable do roster; terminados preservam quem fez; service `updateAnestesistaCasos(ids)`. Completa e Liberações derivam dos casos → mudam juntas. **TROCA REMOVIDA DE VEZ (dono 29/07)** — `TrocaSalaSheet`/`TrocaPendenteCard`/`supabaseTrocasCirurgicasService`/as 5 actions do context APAGADOS (tabela `trocas_cirurgicas` fica no banco); no lugar, campo livre de **Observação** na linha (ver Liberações). **TROCA DECLARADA (dono 30/07; reformada 07/08 — ver seção 'Reforma das trocas'):** par declarado pelo **TrocaSheet** (fluxo ÚNICO: tipo inferido + motivo) em `linha_overrides[turno:chave].trocaCom={uid,nome,tipo,motivo,por,em}` (⚠️ NUNCA chamar `troca` — nota legada colide) → badge **Troca** nos DOIS lados, inclusive entre hospitais (page deriva `paresTroca` das 3 escalas do context — registro único, sem dual-write) → execução de UM TOQUE em **swap SIMULTÂNEO** (decisão do dono): cada lado grava `assumidaPor={uid,nome}` no slot + transfere os casos não-terminados/não-"A+B" (helpers puros `planoExecucaoTroca`/`planoDesfazerTroca` em utils; `executarSubstituicao` no context com rollback LIFO — efeitos juntos ou nenhum; falha reverte + `loadData`). Na lib, `opts.assumidas` de `gerarColunaLiberacao` troca a IDENTIDADE do slot: `chave`/`nomeOriginal` NÃO mudam (marcações não órfãm), exibe/aponta/consome quem assumiu e o remove dos extras; regras POSICIONAIS (plantonista/contraturno) herdam; badge some após executar e a linha mostra "Assumiu a posição de X"; desfazer devolve casos + limpa `assumidaPor` (trocaCom NÃO renasce). `ordem_liberacao` INTOCADA por todos os caminhos novos. ⚠️ `trocaCom`/`assumidaPor` SOBREVIVEM a setLinhaOverride/Restaurar automático/toggleLiberacao/toggleEscalado — são identidade do slot, não ajuste de exibição (apagá-las devolveria o slot ao dono antigo em silêncio). `DefinirAnestesistaSheet` ganhou toggle "Assumir também a posição de X" (1 lado, mesmo motor — cobre assunção SEM troca declarada). Republicação conflituosa (casos re-importados no nome do dono): slot segue assumido e os casos do dono reaparecem como extra `chave#casos` (nunca somem em silêncio). Ações de troca no demo operam EM MEMÓRIA (base do e2e `escala-cirurgica-troca.spec.ts`, fluxo completo Giovana↔Maurício a 375px). Rastro: migration `20260730200000` (evento tipo `troca`, `motivo=manual|reset_publicacao`, aplicada 30/07). Desmarcar: qualquer canEdit. **Liberações** (`LiberacoesView`): coluna das 18 regras, cards verde=pills do seletor (`bg-primary/10`)/amarelo próximo/vermelho liberado; badge Plantonista sólido ao lado do nome (linha full-width; cronômetro na 2ª linha); sala sob o cirurgião; **cronômetro em pill `bg-primary` 100% MANUAL (23/07: nasce em branco; estimativa automática removida — '+8h53' sem sentido)** + sheet "Tempo faltante" (atalhos 15min–3h + hora exata em Select DS 15/15min); liberado = card enxuto (nome+badge+lápis); **desfazer liberação = linha RENOVADA** (`renovado` no override — zera e suprime derivados até preencher). **Painel da linha (29/07; ENXUTO 31/07):** os CASOS da pessoa SAÍRAM do painel (dono 31/07: poluía — cirurgia se vê/edita nas abas Completa e Minhas, e é LÁ que se informa o tempo de cada cirurgia e o residente; `casosObjDaLinha`/`CasoCard`/`CasoDetalheSheet` removidos da LiberacoesView); ficou só o que é da LINHA: `PainelTempo` ÚNICO (`PainelTempo.jsx`, compartilhado com o detalhe do caso; o input de hora nativo saiu), "Automático (dos casos)" ao lado de local/cirurgião, toggle de **Ajuda** e o campo de **Observação**; cronômetro some quando a linha está **Livre**. ⚠️ `linhas` de `gerarColunaLiberacao` é ordem de EXIBIÇÃO (extras `isExtra` + ajudas + plantão-do-turno-seguinte no fim) — **NUNCA** gravar `ordem_liberacao` a partir dela (foi assim que a substituição reordenou o rodapé em 29/07; hoje NADA nesta aba escreve a ordem, travado em `liberacoesPainelLinha.test.jsx`). ⚠️ dispatch otimista usa **`PATCH_HOSPITAL`** (merge sobre o estado atual): `{...escala, X}` com o `escala` do closure fazia cada escrita da sequência REVERTER a anterior. `setLinhaOverride`: `override === null` = restaurar explícito (limpa flags); objeto com campos vazios preserva `renovado` (salvar sem preencher apagava a linha renovada) — e todo caminho que grava override PARCIAL (ex. `definirTempo`) tem de reenviar os demais campos, senão os apaga. **PLANTÃO DO TURNO SEGUINTE (dono 29/07, ampliado na tarde):** o ÚLTIMO nome do rodapé, quando está ESCALADO, é o plantonista do turno seguinte e sai PRIMEIRO — **vale MESMO EM AZUL** (regra POSICIONAL; correção 30/07: o azul era desviado p/ `linhasAjuda` antes da conta, então o cálculo pegava o último NÃO-azul e o HRO marcou JANAÍNA no lugar de FERNANDO, que fechava o rodapé; quem é os dois carrega os DOIS selos) — vai p/ o FIM da lista, **abaixo até das ajudas** (`isProximoPlantao` em `gerarColunaLiberacao`, badge verde sólido). Vale nos **DOIS turnos**, e o RÓTULO vem da lib (`plantaoLabel`: matutino → "Plantão da tarde", vespertino → "Plantão da manhã") — nunca fixo na view. Sem turno informado (chamada legada) não dispara; último nome SEM casos segue nascendo liberado. Não disputa com os P1–P4 da fase noturna (aqueles vêm do card Plantões e assumem o TOPO). Ordem final da cauda (31/07): …fila → ajudas SEM origem conhecida (ordem do array `ajuda_externa`) → VISITANTES de outro hospital (ordem do rodapé de ORIGEM via `opts.rodapeOutros` — índice maior lá = libera primeiro aqui; setas de reordenar desligadas neles) → plantão do turno seguinte. Visitante = (caso OU entrada em `ajuda_externa`) + nome no rodapé de outra escala carregada; sala compartilhada "A + B" conta presença dos DOIS no cruzamento (sem isso o Melo emprestado caiu pro fim do HRO em 31/07). **Visitante sobrevive ao REPASSE (31/07 tarde, caso Leonardo→Tiago):** repassar o último caso de quem veio de fora grava o nome dele em `ajuda_externa[turno]` (`ajudasPreservadasNoRepasse` puro em utils, chamado por `setAnestesistaCasos`) — a linha segue liberável; com origem conhecida não nasce 'não escalado'. **Azul do NOSSO rodapé sem caso aqui MANTÉM a posição** (gente nossa emprestada; só desce ao fim quem tem caso AQUI — regra TIAGO intacta; plantonista = 1º NÃO-azul). **Badge de contraturno SEMPRE** no último nome do rodapé, mesmo sem caso. **`DefinirAnestesistaSheet` modo SALA opera SÓ no turno exibido** (prop `turno`; sem ela o 'Responsável atual' vinha da MANHÃ e o repasse alcançaria caso do outro turno). **Nota de local no rodapé** — "MATHEUS (CONSULT)": parêntese no fim do nome NÃO é identidade (strip em `norm`/`normNome`/`resolveKey`; virava 2 linhas da mesma pessoa) e vira rótulo de local no card (`notaRodape`, "CONSULT"→Consultório). **ORDEM IMUTÁVEL + liberação SÓ NA ORDEM (dono 27/07):** as setas ↑↓ SAÍRAM da tela para todos (nem o plantonista reordena — a ordem vale como veio no rodapé; mudar = republicar a escala; `onReorder` removido da view e da página; com a substituição fora (29/07), `reordenarLiberacao` no context não tem mais chamador na UI) e tocar em quem NÃO é o `idxProximo` mostra toast âmbar "Libere na ordem — ainda há N antes; o próximo é X" em vez de liberar (`bloqueioOrdem`; predicado `naFila` é o mesmo do idxProximo). NUNCA bloqueiam: desfazer liberação, "não escalado" (`onToggleEscalado`) e P1/P2 noturnos (fora da fila por regra do dono). **A EXIBIÇÃO TAMBÉM SEGUE O RODAPÉ (dono 11/08, reforço da mesma regra):** liberado NÃO afunda mais para o fim — fica na própria posição, riscado e com o selo Liberado. O afundamento antigo fazia a fila parecer publicada fora de ordem (11/08: o João Ricardo, 11º no rodapé, apareceu em 13º por ter nascido liberado sem cirurgia, e a leitura foi "inseriram o rodapé errado"). Só saem da ordem quem a regra manda: plantão noturno no topo; extras/ajudas/plantão-do-turno-seguinte no fim, posicionados pela própria lib. **RESIDENTE POR CASO (dono 29/07):** `useRosterAnestesistas` devolve SÓ `anestesiologista` (residente não responde pelo caso — misturado no seletor dava p/ escalá-lo como responsável); residentes têm roster próprio `useRosterResidentes` (sem apelidos — identidade sempre pelo uid do seletor; cadastrados só com o PRIMEIRO NOME e está CERTO assim, não completar). Colunas `residente`/`residente_user_id` (migration `20260729200000`): seletor no `CasoDetalheSheet` (serve Completa + Minhas + painel da linha) e no `AddCasoSheet`, nome no `CasoCard`, e a aba **Minhas** do residente casa também por `residenteUserId`. A coluna de liberação segue derivando SÓ do anestesista. **OBSERVAÇÃO da linha (dono 29/07, no lugar da troca):** texto livre em `linha_overrides[chave].observacao` (teto `OBSERVACAO_MAX`=120), exibido no card da fila abaixo do local; nota `troca` de escala ANTIGA é renderizada como observação (não some, não quebra). LGPD: o painel avisa que é recado operacional e que paciente só entra por iniciais. Com a substituição saiu a única leitura de "sou o plantonista?" → `meuUid`/`meuAlias`/`podeGerenciar` saíram das props da LiberacoesView. **AJUDA MANUAL nas 2 abas (dono 29/07):** toggle no painel da linha e no detalhe do caso (escolhido o detalhe, não o header da sala: a linha de 44px a 375px já tem sala+nome+⚙+chevron). Fonte única `ajudaExterna[turno]` → reflete na outra aba na hora; remover usa a entrada EXATA do array (casada pela chave resolvida, nunca pelo nome exibido) e adicionar entra no FIM (a ÚLTIMA ajuda sai primeiro). **TEMPO POR CIRURGIA (dono 29/07):** `termino_previsto` no caso (migration `20260729210000`, "HH:MM", CHECK de formato), preenchível pelas 2 abas via `CasoDetalheSheet`; na fila vira chip CINZA pequeno ao lado do cirurgião a que pertence (`linha.tokenTermino[token]`, o término MAIS PRÓXIMO quando o token tem 2 casos) enquanto a pílula VERDE sólida segue sendo o total da PESSOA — pesos diferentes de propósito. ⚠️ **o total NUNCA é a soma dos casos** (estimativa que estoura não converge p/ zero — Dexter et al., Anesth Analg; somar acumula o erro). `PainelTempo.jsx` = fonte única da UI de tempo. **ESPELHO do tempo total (31/07):** gravar o término da cirurgia quando a pessoa tem UMA só cirurgia ATIVA no turno preenche sozinho o cronômetro da linha (`espelhoTempoTotal` puro em utils → `setLinhaOverride` no `CasoDetalheSheet`; limpa junto; com 2+ casos, sala "A+B", sem anestesista ou posição assumida NÃO espelha — total segue 100% manual). `CasoCard` recebe `agoraMin` do PAI (um intervalo por lista, nunca um timer por card). **Log de eventos invisível** `escala_cirurgica_evento` (Fase 0 da previsão de tempos): triggers status (2 eixos) + liberações c/ snapshot da ordem — NUNCA bloqueia operação clínica. ⚠️ coluna nova lida no front → `CAMEL_TO_SNAKE` do service (`statusExtra` incluso). ⚠️ INTEGRIDADE (lição 22/07): `liberacoes`/`linha_overrides` são gravados pela CHAVE ESTÁVEL da linha (`linha.chave` = uid do vínculo ou nome normalizado, fallback de leitura no display legado) e reordenação persiste `linha.nomeOriginal` — NUNCA gravar o nome exibido (muda com vínculos → marcações órfãs + rodapé duplicado, reparado em prod). Secret `ANTHROPIC_API_KEY` (dono). **Roadmap:** previsão de términos por cirurgião×procedimento (dados já coletando), sugestão de alocação respeitando ordem de liberação, ponte financeira (guia→Conta Azul). **Identidade (Fase 2.1, 2026-07-21):** dicionário `escala_anestesista_alias` populado (54 apelidos→47 pessoas, confirmados pelo dono; regra: 1º nome sozinho c/ >1 candidato → SEMPRE perguntar); coluna de liberação agrupa por vínculo (`resolverUid`+`anestesista_user_id` — fix do "próximo a ser liberado depois dos liberados") e exibe **nome com diferencial** (apelido só-1º-nome → "Gustavo Biesdorf" via `nomeExibicao`); badge **Ajuda azul sólido**; importação escolhe o hospital da escala + edge devolve `hospitalDetectado` (sugere, nunca troca sozinha); **conferência (fix 23/07):** o login escolhido no Select VENCE o texto importado no display publicado e o aprendizado de apelido só ocorre p/ apelido DESCONHECIDO (reatribuição não ensina A→B; dicionário tinha JANAINA→Cury desde a povoação, corrigido em prod); **conferência POR ANESTESISTA (27/07):** sala/bloco com >1 anestesista (IOSC/Exames/Umanitá/seções de outro hospital) rende **UM BLOCO POR ANESTESISTA** — cada um com os seus casos, os seus cirurgiões e o seu Select (espelha `gruposExibicao` do BoardView). Em `utils`: `nomesImportados` (herança "//"/vazia resolvida por sala) → `chavesAnestesista` (chave = sala, ou `sala|NOME`) → `gruposAnestesista`; `aplicarAtribuicoes` e o aprendizado apelido→login passaram a ser POR GRUPO (a regra de "nome próprio" saiu — o split cobre o mesmo). ⚠️ a chave só é estável porque a importação CARIMBA `anestesistaImportado` na linha (campo só desta tela, fora do `CASO_FIELDS`): sem ele atribuir troca o texto e dissolve o bloco no meio da conferência; linha adicionada à mão entra no bloco-BASE para não repartir a sala e apagar atribuição já escolhida. ⚠️ o texto da SALA alimenta a key do bloco → o campo Sala grava no BLUR (`CampoSala`, 31/07): gravar por tecla remontava o bloco e o input perdia o foco (1 letra por vez); "+ Linha" e o commit abrem o bloco de destino. **Sem anestesista NÃO herda o de cima (31/07):** o split do BoardView decide pela FLAG `semAnestesista` (não só pelo texto — '' era absorvido pelo colega da sala pós-publicação), `aplicarAtribuicoes` normaliza ''→'?', o guardrail da edge seta `sem_anestesista=true` ao apagar nome fora do rodapé (edge precisa de re-deploy) e `AddCasoSheet` sem seleção grava '?'+flag. Cobertura: `src/__tests__/pages/importarEscalaConferencia.test.jsx` (Vision mockada, fluxo real da página). Lições Vision 23/07 (no prompt): **AMARELO = anestesista em 2 locais de propósito** (manter nas duas linhas), C.O da Unimed NUNCA é bloco materno (2ª reincidência), anestesista SEMPRE da célula da própria linha (proibido propagar p/ linhas com nome próprio ou inventar), **seções de outros hospitais no HRO (IOSC/HO/Digimax/…) têm anestesista POR LINHA** (3 linhas do IOSC saíram p/ um só e 2 anestesistas SUMIRAM), **rodapé vermelho = ordem de liberação SAGRADA** (todos os nomes, ordem exata; guardrail na conferência avisa nome da ordem sem caso entre escalados). Na conferência o rodapé é uma **LISTA NUMERADA** (`resumirRodape` puro em utils, dono 11/08 "difícil de analisar"): uma linha por posição com nº, papel posicional (1º plantonista / último sai 1º), selo de ajuda e **quantos casos a pessoa tem no lote** — zero casos é o detector da extração torta, e o aviso âmbar ficou só com o porquê (o nome já vai marcado na posição). Dupla `"A + B"` conta para as DUAS. **O campo de texto do rodapé SAIU (dono 11/08):** a lista é a única superfície e é EDITÁVEL na própria posição (corrigir o texto · Subir/Descer · marcar **Ajuda** · Remover) — a conferência é a transcrição da FOTO e o último ponto em que dá para consertar o que a Vision leu torto; **nada disso alcança escala publicada** (lá a fila segue imutável, mudar = republicar). Plantonista/"sai 1º" **não têm botão** — são da POSIÇÃO, muda-se movendo o nome; o único selo com botão é o de **ajuda**, que é o que mais falha na extração (30/07, o azul não reconhecido) e grava no mesmo `ajudaTexto` do campo abaixo. **Acrescentar é por LOGIN** (Select do roster; texto livre criava a mesma pessoa 2× na fila) e insere o **apelido do dicionário** — mesmo texto do "Preencher da atribuição", senão rodapé e casos caem em identidades diferentes; quem já está no rodapé sai da lista. `ordemTexto` continua a fonte da verdade (os controles reescrevem a string, então publicar/cruzamento não mudam). **DOIS ANESTESISTAS (dono 11/08):** card único SÓ quando é a MESMA cirurgia — a célula traz os dois e o prompt manda devolver `"NOME1 + NOME2"` (nunca escolher um, nunca partir em dois casos); `aplicarAtribuicoes` preserva o texto com `+` e não deixa um login escolhido apagar a colega (uid fica null; a fila conta presença dos dois e transferência nenhuma mexe em sala compartilhada). Marcar À MÃO: `DefinirAnestesistaSheet` no modo CASO tem "Segundo anestesista (mesma cirurgia)" → grava `{uid:null, apelido:'A + B', dupla:true}`; ⚠️ o `dupla` é o que impede o service de traduzir uid null em `'?' + sem_anestesista` (a cirurgia cairia no alerta). `anestesistaDoCasoEh` (utils) é a identidade única de "esse caso é meu" nas abas Completa e Minhas — sem ela a dupla sumia da Minhas DAS DUAS. O toggle de assumir posição não aparece com dupla (não há um slot único a assumir). Sala com anestesistas DIFERENTES em cirurgias diferentes segue com **um bloco por anestesista** (regra 27/07, nascida do IOSC) — foi o caso da CC - Sala 2 em 11/08 e está certo assim. **NOME AMBÍGUO BLOQUEIA A PUBLICAÇÃO (dono 11/08):** `candidatosPrimeiroNome` (utils, puro) acha quem atende por um primeiro nome sozinho; grupo sem login escolhido cujo nome tem 2+ candidatos vira aviso VERMELHO na conferência e o `publicar` recusa. Incidente: a CO - Cesárea da Unimed saiu com "JOAO" e o rodapé tinha JOAO HENRIQUE e JOAO RICARDO — o dicionário não resolve primeiro nome com dois donos (regra: perguntar, nunca chutar), os 3 casos ficaram órfãos numa linha "Fora do rodapé" e o dono deles nasceu liberado por aparecer sem cirurgia. **Demo fora de produção (23/07):** botão excluído; fixture `getDemoEscala` gated a `import.meta.env.DEV` (base dos e2e; prod nunca vê demo). ⚠️ dono tem 2 contas (`GUILHERME MELO`→wguime + `GUILHERME SOUZA MELO`→gmail) — **decisão 27/07: MANTER as duas** (login intacto nas duas), mas **29/07: UMA PESSOA, UM NOME na lista de escolha** — `profiles.conta_duplicada_de` (migration `20260729100000`, FK self c/ ON DELETE SET NULL, marcada por E-MAIL) tira a 2ª conta de `options` no `useRosterAnestesistas`, mantendo-a em `rosterByUid` (registro antigo salvo nela não perde o rótulo) e com `resolver`/`canonicalUid` remapeando secundária→principal. ⚠️ `contaDuplicadaDe` PRECISOU entrar no `CAMEL_TO_SNAKE` do `supabaseUsersService` (sem o mapa chega como `conta_duplicada_de` e o filtro nunca ativa — pegadinha do `ultima_avaliacao_at`). Quando 2+ cadastros colidem no nome curto a Liberações exibe o nome COMPLETO de todos (`curtoAmbiguo`). **Card na Home (2026-07-22):** `src/components/escala-cirurgica/EscalaCirurgicaHomeCard.jsx` (família visual do card Biblioteca) — plantonista do turno atual (`ordem_liberacao[0]` + `titleCaseNome`) por hospital com escala publicada hoje; gate `podeVerEscalaCirurgica`; context Tier 2 com fallback + fetch leve se a data do context ≠ hoje. **Cronômetro Liberações (fix 2026-07-22):** iOS/PWA mata o setInterval na suspensão (pills congeladas o dia todo) — `useAgoraMinuto` recalcula em visibilitychange/pageshow/focus E re-arma o interval; e2e determinístico `e2e/escala-cirurgica-cronometro.spec.ts` (page.clock + escala demo client-side, sem fixture no banco). **Fase noturna (2026-07-23, decisões a/b/c; REDESENHADA 24/07):** `src/lib/plantaoNoturno.js` — seg–sex (FERIADO segue a regra) na escala de HOJE. **19h→23h ('noite'):** cada plantonista noturno é um CARD igual aos demais (a caixa azul acabou), com **selo P1–P4 antes do nome** e ficha completa (toggle de liberar + cronômetro), no topo da lista e a **vespertina abaixo**. Ordem por hospital (`ORDEM_NOTURNA`): **HRO P1→P4 · Unimed P2→P3→P4 · Materno P4**; o 1º de cada hospital é o plantonista. **P4 é CORINGA:** sem marcação aparece nos TRÊS; tocar no selo abre "Onde está o P4 hoje?" e ele some dos outros dois p/ todos (tabela `escala_plantao_p4_diario`, 1 linha por data, RLS `can_write_escala_cirurgica` + realtime, migration `20260724200000`; audit server-side por trigger; **desmarcar = DELETE, sem botão na UI por decisão do dono**). **≥23h ('zerada'):** a lista do dia zera e ficam SÓ os P1–P4 do hospital (o alerta "sem anestesista" e o botão de ajuda também saem). `fundirLinhasNoturnas` HOISTA quem já está na lista (mesma `chave` → marcações/overrides seguem valendo, sem duplicar) e sintetiza card p/ quem não está (sintético não tem setas: não existe no rodapé); **card noturno sempre `teveCasos: true`** — sem isso o plantonista sem caso no turno caía em "não escalado" (nascia liberado) e afundava. P1–P4 vêm do card Plantões (useEscalaDia) casados ao dicionário via `candidatosNome` + fallback `casarPorInicialSobrenome` (o P3 "A. Schmidt" ficava sem selo: a inicial era descartada e sobrava "SCHMIDT", que NÃO é apelido cadastrável — há dois Schmidt; o fallback casa inicial+sobrenome no roster e devolve null se houver mais de um candidato); TUDO derivado do relógio — NUNCA reescrever o rodapé automaticamente (causa da corrupção 22/07). ⚠️ `key` do card de liberação é `linha.chave`, NUNCA o nome exibido (rodapé sem vínculo + caso com uid = duas linhas da mesma pessoa → React omitia/duplicava). **Definir anestesista é de TODA a equipe (27/07):** o ⚙ do header da sala e o botão do detalhe aparecem para qualquer `canEdit` (`podeDefinir = canEdit && !isDemo` no BoardView) — a regra de "só o dono da sala/coordenador" escondia o botão do board inteiro p/ a maioria (e sumia até da própria sala quando a identidade não resolvia: caso sem uid + apelido fora do dicionário). Isso absorveu o caso EM ABERTO de 24/07 (`salaEmAberto`/`grupoEmAberto`/`temAnestesistaReal` REMOVIDOS de utils); `updateAnestesistaCasos` segue gravando `sem_anestesista=false`, tirando o caso do alerta. **Automações do piloto (2026-07-21, aplicadas):** pg_cron `escala-seed-rollover-daily` (00:05 BRT, seed móvel; seed-20 imóvel) + `escala-amanha-check` (18h BRT dom–qui, notifica dono se amanhã sem escala real unimed/hro; dedup); skill `/escala-cirurgica` (status/seed/relatorio/smoke; leitura via `query-ro.mjs` SELECT-only); hook smoke pós-deploy (`scripts/smoke-prod.mjs`); regressão visual `e2e/escala-cirurgica-visual.spec.ts` (clock congelado 20/07 14h → seed fixa). ⚠️ Liberação ao grupo: unschedule do rollover + APAGAR seeds (aprovado pelo dono). Refs: `docs/escala-cirurgica.md` · `docs/escala-cirurgica-analise-adesao.md` · `docs/escala-cirurgica-evolucao-tecnica.md` · `docs/escala-cirurgica-automacoes.md` · `docs/escala-cirurgica-metricas/` |
| Cirurgias Particulares | card em **Gestão → Faturamento** (`FaturamentoPage`, saiu do Menu 2026-07-26; permissão virou subCard de `faturamento` → cascata do pai vale) → `src/pages/cirurgias-particulares/` (listagem = relatório em tela + form c/ import da escala) | Supabase `cirurgias_particulares` (migration `20260722100000`, aplicada; RLS `can_write_cirurgias_particulares()` = anestesiologista/secretaria OU admin — grupo todo vê tudo; FORCE RLS + REVOKE DELETE; realtime) + lib pura `src/lib/cirurgiasParticulares.js` + template PDF `cirurgiasParticularesReport` | **EM PRODUÇÃO** (deploy 2026-07-22; acesso = RLS anestesiologista/secretaria/admin — card visível a todos por default, barreira real é a RLS; user c/ permissões customizadas precisa do toggle no Centro de Gestão). Cobrança de honorários particulares: paciente (nome COMPLETO — dado sensível art. 5º II, base art. 11 II "d" no header da migration), cirurgião, anestesista (Select roster, default = user logado), data, procedimento, local, valor R$, status pendente/pago/glosado (`data_pagamento` auto). Período livre (2 DatePickers; DS DatePicker ganhou flip de âncora right-0 qdo popup estoura a viewport) + totais + tabs compactas sem contador (flex-1 text-xs — 4 abas cabem no 375px) + **Exportar PDF** (tarja CONFIDENCIAL + gerado por); lista é REATIVA (sem botão 'gerar'); empty state mostra o período + explica o auto-import; **CPF obrigatório no form** (migration `20260722400000`: `paciente_cpf` nullable só-dígitos CHECK 11; `validarCPF` DV + máscara na lib; `precisaCompletar` = iniciais OU sem CPF — valor saiu do critério), **valor OPCIONAL** (vazio = R$ 0, precifica depois), **CTA full-width no corpo** (header só lupa), **export em botão ÚNICO** (DropdownMenu: PDF / Excel / ambos; xlsx dinâmico, abas Cirurgias c/ CPF + Resumo, período no filename); ⚠️ REGRA DO DONO (2026-07-22): auto-import SÓ com convênio PURAMENTE particular ('Part'/'PART.'/'PARTICULAR'; COMPOSTO 'PART/SC' é ambíguo → NUNCA importa) E paciente IDENTIFICADO (lote '04 FACECTOMIA (04 PCTES)' sem paciente → não importa) — classificador `^PART(ICULAR)?[^A-Z]*$` + guard de iniciais espelhados em 5 lugares: `fn_convenio_particular`+trigger SQL (migration `20260722600000`), `familiaConvenio` (utils escala), edge parse-escala (sanitize+prompt), excelEscala e `casoImportavel` (lib) — mudar um = mudar todos (bug real 22/07: 4 casos HRO sem lançamento, corrigidos por re-backfill). Pipeline pacienteNome VALIDADO em produção 2026-07-22 (2 particulares reais importados c/ nome completo da Vision). **Verificação recorrente + aprendizado (2026-07-23)**: pg_cron `cirurgias-particulares-check` 20:30 BRT (migration `20260723100000`; **desde 30/07 roda com `p_notificar=false`** — migration `20260730160000`: corrige e loga, NÃO notifica; achados só via log/skill) — auto-corrige elegíveis sem lançamento (7d), watchlist de suspeitos (PART composto/lote, NUNCA decide sozinho), suspensos, incompletos >48h; log `cirurgias_particulares_check_log`; skill `/cirurgias-particulares` (status/verificar/historico + protocolo de aprendizado nos 5 espelhos); **alertas pós-turno de guia não preenchida REMOVIDOS (dono 30/07**, migration `20260730160000`: crons `guias-pendentes-*` desagendados + `fn_alertar_guias_nao_preenchidas` dropada; o **banner âmbar na listagem** é a única superfície do aviso; `precisaCompletar` segue incluindo valor). **Soft-cancel** (sem DELETE; `cancelada_em/por/motivo`). **AUTO-IMPORT da escala (sem botão)**: trigger `fn_sync_cirurgia_particular` (migration `20260722200000`, aplicada; AFTER INSERT/UPDATE em `escala_cirurgica_caso`, NUNCA bloqueia a operação clínica) — publicar/republicar/adicionar caso/des-suspender/convênio→particular cria rascunho automático (paciente=iniciais, valor=0, badge sólido âmbar 'Completar dados' via `precisaCompletar`; save bloqueado por `pareceIniciais` até completar o nome); AddCasoSheet oferece 'Preencher cobrança agora?' → form via `params.escalaCasoId`; toast na publicação conta particulares; `escala_caso_id` SEM FK (republicação faz DELETE+reinsert → trigger RE-VINCULA órfão por data+local+cirurgião+procedimento) + índice único parcial anti-duplo-lançamento (cancelado libera); suspensa não importa e se suspender DEPOIS do lançamento a listagem alerta (badge âmbar via `fetchCasosStatus`) c/ ação de cancelar; **backfill retroativo** `20260722300000` (idempotente, marcador 'Backfill auto-import'); **NOME COMPLETO no rascunho**: edge parse-escala devolve `pacienteNome` SÓ p/ convênio particular (prompt + sanitize; nunca entra na escala — CASO_FIELDS filtra + CHECK rejeita) e o Excel idem; pós-publicação `completarPacienteDoCaso` casa payload↔salvos por sala|ordem e completa o rascunho só se ainda estiver em iniciais; AddCasoSheet captura o nome digitado antes do blur→iniciais; Local do form = LOCAIS_BASE (hospitais+IOSC/Centro de Coluna/Accurata/Digimax/Umanitá/HO/Consultório) ∪ locais já usados (Select searchable); ⚠️ seeds do piloto publicadas com particular geram rascunho de teste (limpar junto na liberação ao grupo). Provider ON-DEMAND nos 2 cases (não global). Pendências LGPD registradas (retenção ~5a + RIPD): `docs/cirurgias-particulares.md` |

| Extrato de Férias | pill **"Extrato"** no card Férias da Home (card inteiro clicável; `FeriasCard` ganhou prop `actionPill`) → `src/pages/ferias/ExtratoFeriasPage.jsx` | Pega Plantão `getFeriasDoAno(ano)` (12 meses em lotes de 3 pelo proxy, cache 30min por chave, SEM fallback mock) + Supabase `ferias_violacoes_vistas` (migrations `20260803220000`+`233000`, aplicadas; append-only, FORCE RLS, `detected_by` amarrado ao uid) | **Acesso RESTRITO (dono 03/08): allowlist de e-mail = Guilherme Melo (2 contas), Fernanda Guollo e Leandro Bernardes** — `EMAILS_EXTRATO_FERIAS` em `src/pages/ferias/gate.js` ESPELHA a RLS `can_access_extrato_ferias()` (sem is_admin; mudar um = mudar o outro); destinatários da notificação = a mesma lista (`getDestinatariosFerias`). + `PAGE_TO_CARD: extratoFerias→'ferias'`. Layout (redesign 03/08, referência leave-trackers): **Coletivo** = 3 tiles (Dias marcados · **Alertas → bottom-sheet no toque**, nada de banner inline · Dias lotados) + lista com **nome COMPLETO** (`nomeCompleto` em `feriasSocios.js`; ids de violação seguem no nome da escala — mudar re-notificaria tudo) + `Progress` de uso + badges **Excedida/Completa/N livres**; **Individual** = saldo-herói com barra + períodos agrupados **Agendados/Usufruídos**. Libs puras: `src/lib/extratoFerias.js` (contagem: **FDS nunca conta**; **feriado só não conta em semana inteira**) + `extratoFeriasRegras.js` (**6 regras com id determinístico**; `REGRA_LABEL` simplificado 03/08; regras de PRAZO ficam fora — API não expõe quando se marcou). Dados: `feriasSocios.js` (46 sócios+ano entrada → cotas 5/20/30–35) + `feriasFeriados.js` (10 feriados do `férias/FERIADOS <ano>.pdf` — **Carnaval entra; 01/01 e 25/12 são recesso**) — manutenção ANUAL travada por tripwire. **Notificação agregada 1/dia** só com CONTAGENS (diff por id; recipients resolvidos ANTES de registrar). Export PDF (`extratoFeriasReport`) + Excel. Ano corrente automático. **Aba Mapa (03/08):** heatmap de ocupação diária (semanas × seg–sex, escala 0→7+ em tokens; toque mostra quem marcou) + plurianual por semana ISO (API serve 2023+ e o ano seguinte — `getFeriasDoAnoMin` cacheia anos passados em localStorage, loader com retry/pausa contra rate do proxy) + rankings de semanas + métricas de gestão e sugestões geradas do histórico (`src/lib/feriasAnalise.js`). Badges Completa/livres nos slots `-bg/-fg` de categoria (verde/laranja). **Aba Marcar — MARCAÇÃO SELF-SERVICE (dono 04/08):** cada sócio marca/desmarca as PRÓPRIAS férias tocando o calendário de ocupação (`calendarioOcupacao.jsx`, modo `selecao`, compartilhado com o Mapa) → barra fixa → `ConfirmarMarcacaoSheet` que DECLARA o custo (7ª vaga = 3 dias, alertas que a seleção cria, saldo antes→depois). Arquitetura: `ferias_movimentacoes` append-only (migration `20260804120000`) + replay puro `aplicarMovimentacoes` (`src/lib/feriasMovimentacoes.js`) sobre os registros do PP — **0 movimentações ⇒ extrato idêntico ao do PP** (travado em teste). RLS faz o self-service (`ferias_nome_socio()` ESPELHA `EMAIL_TO_SOCIO` do gate) e os PRAZOS no relógio do SERVIDOR (marcar: só dia futuro; desmarcar: nunca depois que a escala sai, i.e. ≤ véspera). `req_id`+índice único = confirmação retry-safe; `filtrarNoOps` = preflight anti-corrida. Regras que só avisam (cota/7ª vaga) vs. que bloqueiam (prazo/FDS) em `src/lib/feriasMarcacao.js`. Log de movimentações no fim do Mapa. ⚠️ proxy `pegaplantao-proxy` ganhou guardrails de escrita (WRITE_ALLOWLIST VAZIA, retry-401 só em GET, corpo do erro repassado) — a escrita no PP é fase-sonda futura, endpoint/códigos desconhecidos. ⚠️ lição 03/08: batch de notification p/ OUTROS destinatários NUNCA com `.select()` (RETURNING × RLS recipient-only aborta com 42501 silencioso — fix d127706 na ponte inteira). |

## Edge Functions (`supabase/functions/`)
`fetch-noticias` (PubMed, dedup) · `fetch-yt-captions` · `fetch-classics` · `notify-incident` · `schedule-shift-reminders` · `send-fcm-push` · `sign-cert` / `verify-cert-public` / `verify-cert-uuid-public` / `get-cert-download-url` · `verify-doc-public` · `pdfa-convert` · `watermark-pdf` · `api-v1` · `ai-rag` · `pegaplantao-proxy` · `generate-api-token` · `get-supabase-token` · `parse-escala-cirurgica` (Claude Vision)

Deploy: `bash scripts/deploy-edge-with-pat.sh <fn> [--no-verify-jwt]` (lê o PAT do .env.local sem ecoar; conferir estado atual com `node scripts/diag-edge-fn-config.mjs`). Edges que recebem JWT não-Supabase (Firebase/custom) exigem `--no-verify-jwt`. CORS: allowlist + echo + `Vary: Origin` (nunca origin única).

### Atualização da Escala Cirúrgica (2026-08-05)

A publicação usa a migration `20260804180000`: RPC transacional por
`data+hospital+turno`, lock do cabeçalho, `publicacao_turnos` e chaves
namespaced (`matutino:chave`/`vespertino:chave`) para liberações e overrides.
Casos legados sem turno foram fixados como matutinos. A importação herda o
turno da tela anterior e confirma hospital, data e período antes de publicar.
Em trocas, `trocaCom` apenas declara o par; somente `assumidaPor` executa a
substituição. O alvo pode estar fora do hospital e sem casos locais. Após a
execução, casos abertos e posição devem aparecer de forma idêntica em Completa
e Minhas; se houver apenas declaração, a troca ainda não foi realizada.

Duplicidade entre hospitais: durante a importação, a mesma identidade em dois
hospitais no mesmo turno abre um alerta bloqueante com hospital, turno, posição no
rodapé e casos (sala/hora/procedimento). A secretária precisa confirmar
"intencional" ou "troca com [colega]" antes de publicar (o seletor vem
pré-preenchido com o par SIMÉTRICO quando é único — `sugerirParceiroTroca`).
Desde 07/08 a decisão "troca" EXECUTA o swap ao publicar (ver Reforma abaixo).

Na conferência HRO, o campo Sala usa uma lista ordenada de salas/locais canônicos
(`salasDoHospital`) e normaliza `BLOCO A/M`, `IOSC`, `HO` e demais locais. A lista
é uma sugestão selecionável, não bloqueia uma sala nova; escolher a opção canônica
evita que células mescladas criem blocos distintos por grafia.

Trocas, posições assumidas e liberações são isoladas por turno (`matutino:chave` /
`vespertino:chave`). Dados legados sem prefixo foram migrados para matutino;
planos de troca recebem o turno atual e nunca alteram `ordem_liberacao`. A
assunção troca apenas a identidade exibida: `chave`/`nomeOriginal` continuam do
slot original (por exemplo, Paulo), mesmo com Guilherme assumindo, sendo liberado
ou desfazendo a troca; o card mantém o contexto da troca para não perder o rastro.
Casos já registrados em nome de um substituto que não consta no rodapé não são
apagados nem reatribuídos automaticamente: aparecem como “Fora do rodapé”, sem
número de posição e sem alterar a fila oficial.

### Reforma das trocas (2026-08-07) — plano em ~/.claude/plans/com-rela-ao-as-escalas-memoized-hamming.md

Dores do dono: troca não saía sozinha da importação; informações confusas ao
adicionar. Decisões travadas: 1 pessoa executa (sem aceite — aposentado 2×),
sem notificações, `ordem_liberacao` imutável.

**Fase 0 — 12 defeitos corrigidos** (D1–D12, cada um com teste; commits
f935bb8/368478e/0ce989f): rollback da troca restaura SNAPSHOT (com `de.uid`
null gravava '?' e APAGAVA o anestesista); `espelhoTempoTotal` ciente do
namespace de turno (definir término apagava local/observação); `marcarTroca`
com cadeia de fallback (`lerOverrideAnterior`); par histórico SÓ nasce de
`posicao_assumida` (`estadoTrocasDoHistorico` — troca_desfeita ressuscitava
badge; a execução gera `troca_desfeita` no eixo de declaração, ambíguo por
construção → estado vivo = SÓ `linha_overrides`); slot devolve o TURNO onde
foi achado e o turno da tela é PREFERÊNCIA (par manhã↔tarde fechava meio swap
calado); idempotência (lado já assumido é pulado — pré-requisito da
convergência); plantonista que fecha o rodapé NÃO desce ao fim da fila;
matching NUNCA por nome de exibição (`assumida.deNomeOriginal`); linha-espelho
`chave#casos` não aceita troca; `trocasHistorico` com limit(60).

**Fase 1 — TrocaSheet** (`TrocaSheet.jsx`, commit 486ea3a + redesenho do dono
09–10/08): fluxo único — colega → **uma decisão POR POSIÇÃO** → tipo (Select,
inferido pela geografia dos slots do PAR: entre_hospitais / posicoes /
entre_turnos / assuncao, corrigível) → motivo opcional → botão que muda com a
resposta. ⚠️ **o app nunca supõe a origem**: a escala costuma sair publicada JÁ
com os nomes trocados (10/08: Rafael, da Unimed, já veio no rodapé do HRO e o
Garim no da Unimed) e supor que o nome achado marca a posição de origem DESFAZ a
troca real. Cada posição do par vira um cartão (hospital · turno, nº de casos,
"Posição de X") com duas saídas explícitas — **"{dono} fica"** / **"{colega}
assume"** — nada pré-marcado; com posição por confirmar o botão fica travado
(meio swap = D4). Daí:
- alguém assume → **"Trocar agora"** (assumidaPor + casos, os dois lados juntos,
  rollback; sem passar por trocaCom — evita ruído no log);
- ninguém muda de lugar → **"Registrar troca"** = `trocaCom.apenasRegistro`
  (jsonb, sem migration): a escala já saiu certa e falta só o RASTRO — badge
  **"Troca"** sólido nos dois e "Trocado com X" no card. Era o buraco de 10/08
  ("não consigo colocar o badge nos dois"). ⚠️ registro **não** é declaração
  pendente: `paresDeclarados` o IGNORA (senão a próxima publicação executaria o
  swap e desfaria a troca real) e o painel ✏️ não oferece "Executar agora", só
  "Remover registro da troca".

**"Declarar para depois" SAIU** (dono 09/08, "não entendi a funcionalidade"):
par pendente só nasce da conferência da importação (que executa ao publicar).
`tipo`/`motivo` viajam DENTRO do jsonb (trigger audita de graça) e aparecem no
card. Vocabulário único: "Substituição executada/desfeita"→"Troca
executada/desfeita"; badge é sempre **"Troca"** (sólido = fato — assumida ou
registro; outline = falta executar); "Trocar anestesista"→"Novo responsável";
"Trocar sala/local"→"Mudar de sala/local"; "Substituir mesmo assim"→"Republicar
por cima". Toggle "Assumir também a posição" continua como atalho (tipo
`assuncao`).

**Fase 2 — troca automática na importação** (commit ff3ddd2): decisão "troca"
da conferência declara E EXECUTA ao publicar, sobre SNAPSHOT explícito
(`executarSubstituicao(..., {escalasOverride})` — sem corrida com realtime;
pula dispatch local). ⚠️ plano ANCORADO na declaração (`planoExecucaoDeclarada`):
o varre-tudo do ✏️ trocaria também a posição onde o DUPLICADO vai ficar (caso
Didomenico⇄Paulo) — troca SÓ a vaga declarante + a recíproca do parceiro;
parceiro sem vaga = assunção unilateral (caso Paulo→Guilherme, sem SQL manual
nunca mais). CONVERGÊNCIA (`paresDeclarados`): toda publicação re-varre pares
declarados e executa os que fecham — inclusive re-execução pós-republicação
(que zera overrides). Sem vínculo de login → fica declarado + aviso do que
falta. RLS validada: gate por PAPEL, não por hospital — escrita cruzada ok.

**TURNOS INDEPENDENTES (dono 13/08, regra estruturante):** manhã e tarde são
escalas SEPARADAS — "cada turno tem configurações diferentes, não vincule o turno
da manhã com o da tarde". Todo helper que recebe `turno` trata como filtro
EXATO, nunca preferência: `localizarSlotRodape`/`localizarSlotEscala` só olham o
turno pedido (o fallback para o outro turno, D3/D4 de 07/08, foi REMOVIDO — era
ele que trazia para a tela da tarde a posição que a pessoa tinha de manhã e pedia
decisão sobre ela); `casosTransferiveis` recorta pelo turno do lado; a limpeza de
`trocaCom` e o `planoDesfazerTroca` (agora com `turno`) só tocam chaves do turno
exibido (chave crua legada = matutino). Consequência ACEITA: par manhã↔tarde vira
DUAS trocas, uma por turno; e o toggle "Assumir também a posição" some quando a
vaga da pessoa está no outro turno. O "corte do turno da tela" de 10/08 virou
redundante e saiu junto.

**ÂNCORA DA TROCA (dono 13/08):** o sheet abre a partir de UMA linha, e a
posição de `a` em jogo é a DAQUELA escala — `planoExecucaoTroca` recebe
`escalaAncora` (id) e só varre os outros hospitais atrás do COLEGA. Sem isso,
quem aparece em dois hospitais no mesmo turno arrastava o outro para a decisão:
registrar a troca da Karine no MATERNO abria um cartão do HRO, onde ela está no
rodapé e tem uma linha de sala "Materno" (a mesma jornada anotada nos dois
quadros). Mesmo princípio que `planoExecucaoDeclarada` já usava na duplicidade.

**COLEGA FORA DA UNIMED/HRO (dono 13/08):** a troca era ancorada SÓ no rodapé, e
o **Materno é publicado sem rodapé nenhum** (`ordem_liberacao` vazia nos dois
turnos em 17/17 escalas) — quem trabalha lá só existe nos CASOS. O colega do
Materno caía em "não tem posição em jogo" e o swap saía pela metade: a vaga do
hospital mudava de dono e as cirurgias do Materno seguiam no nome de quem tinha
saído, para arrumar à mão uma a uma. `localizarSlotEscala` (utils, puro) é a
resposta única de "onde essa pessoa está nesta escala": rodapé e, na falta dele,
as cirurgias DAQUELE turno — o lado nasce com `semPosicao: true` (não há fila a
herdar, só os casos; `ordem_liberacao` segue intocada) e só existe se houver o
que mover (cirurgia encerrada ou sala "A + B" não conta). Vale nos dois motores:
`planoExecucaoTroca` (TrocaSheet) e o recíproco de `planoExecucaoDeclarada`
(convergência da publicação). O cartão do sheet diz "Cirurgias de X · sem fila de
liberação", e o tipo passa a inferir `entre_hospitais` sozinho. ⚠️ **cada lado
leva SÓ os casos do próprio turno** (`casosTransferiveis(..., turno)`): a Karine
trocou a tarde e o cartão do HRO contava 2 casos — um era o Exames das 7h30, que
não estava em jogo e mudaria de dono na execução (o recibo `assumidaPor.casoIds`
só tinha consertado o desfazer). Colega **sem posição NO TURNO EXIBIDO**
(consultório/folga — inclusive quem fecha o outro turno, caso Staub: manhã no HRO,
tarde no consultório) ganha **"Onde {colega} está à tarde/de manhã"**
(`LOCAL_COLEGA_OPCOES`: Consultório/Materno/
Sobreaviso/Folga/Outro) — viaja no jsonb (`trocaCom.local` / `assumidaPor.local`,
sem migration) e aparece na fila em "Trocado com X (Consultório)" e "Assumiu a
posição de Y · Consultório". A escala demo do Materno perdeu o rodapé fake para
espelhar a produção.

**Fase 3 (planejada, não iniciada)**: identidade única de matching (hoje 4
camadas), compactação do histórico, telemetria de trocas, renomear
`executarSubstituicao`→`executarTroca`.

**TROCAR DE POSIÇÃO é OPÇÃO PRÓPRIA (dono 18/08 — caso Fernanda⇄Daniela:** "a
Daniela assumiu o plantão mas ficou apenas o badge de troca"): o painel ✏️ da
linha tem DUAS entradas — "Troca com um colega" (o fluxo de sempre, registro por
padrão, que é como a **troca entre hospitais** é feita e **fica como está**) e
**"Trocar de posição na escala"**, que abre o mesmo `TrocaSheet` com
`modo='posicao'`: cada posição em jogo já nasce **"assume"** (derivado, não
estado — `escolhaDe`), o tipo não é perguntado (é `posicoes` por definição) e o
botão é "Trocar posição". Registro que já existe também converte por ali (botão
no painel da troca, com o colega pré-escolhido — antes era beco sem saída: só
"Remover"). ⚠️ o tipo do Select continua **taxonomia, não mecânica** — fazê-lo
mover sozinho foi tentado e revertido no mesmo dia, porque "Troca entre
hospitais" é justamente o caso em que a escala já saiu trocada e mover DESFARIA
a troca real (Rafael⇄Garim 10/08).

**POP-UP ANTES DE CONCLUIR (dono 18/08):** todo caminho que EXECUTA swap
(`TrocaSheet` e "Executar agora" do ✏️) passa por `ConfirmDialog` listando quem
assume qual posição, hospital · turno e quantas cirurgias em aberto vão junto.
Registro (ninguém se move) não pergunta — não há o que rever.

**Dois defeitos de matching corrigidos junto (18/08):**
- **desfazer mirava a linha da TELA, não onde a declaração mora**: `trocaCom`
  vive numa linha só — a de quem declarou — e o badge sai nos dois lados; remover
  pelo card do colega (ou de outro hospital) escrevia num override sem `trocaCom`,
  o toast dizia "Troca desfeita" e o badge continuava. `alvoRemocaoTroca(escalas,
  par)` (utils, puro) devolve o endereço real (escalaId + chave).
- **`planoDesfazerTroca` deduzia o dono do slot como "o outro do par"**: quem
  assumiu DUAS posições no mesmo turno via a segunda vaga ser desfeita junto com a
  primeira e devolvida à pessoa errada, com as cirurgias dela. A execução agora
  carimba `assumidaPor.de` (recibo do dono, jsonb, sem migration) e o desfazer só
  toca o slot certo; registro antigo sem `de` segue pela dedução.

⚠️ **Conhecido, não corrigido:** a convergência da importação executa os pares
num loop sobre um snapshot que NÃO é atualizado entre execuções — com A⇄B e B⇄C
declarados no mesmo turno, a segunda execução sobrescreve a primeira
(last-write-wins) e pode re-transferir casos. Entrada ambígua por natureza;
consertar exige `executarSubstituicao` devolver o estado resultante.

### Modo FIM DE SEMANA — fila de liberação ÚNICA (dono 15/08)

Sáb/dom operam com UMA fila por turno cobrindo os 3 hospitais (documento
"ESCALA DE FINAL DE SEMANA": grade P1–P4 em 3 faixas 7-13/13-19/19-07 × 4
colunas Unimed/HRO/ret1/ret2 + listas numeradas P5+ por período + linha "1º→
último a ser LIBERADO" por turno). A fila vive numa linha **pseudo-hospital
`'fds'`** de `escala_cirurgica` (migration `20260815120000`: CHECK +'fds',
coluna `fds_meta` jsonb {grade, posicoes Pn→pessoa, escalacao, ordemFonte},
RPC aceita 'fds' e rejeita fds_meta em hospital real) — RLS por papel e
realtime cobrem sem mudança; **`HOSPITAIS` NÃO ganhou 'fds'** (slot extra
`escalas.fds`, carregado só em FDS). ⚠️ **sentido da ordem**: o doc escreve
"1º→último a ser liberado" = INVERSO do rodapé; a inversão é ÚNICA, na
publicação da conferência (`rodapeDeOrdemDoc` em `src/lib/escalaFds.js`) —
nunca em leitura, nunca flag. Pn→pessoa normalmente vale o FDS INTEIRO (dom
7º=Thayna foi troca pessoal — domingo herda o sábado, editável); a ordem de
liberação NÃO é derivável (P09,P10,P11 ≠ reverso) — turno sem linha nasce com
SUGESTÃO (inverso da escalação) marcada "Sugerida". Importação: edge em
`modo:'fds'` + conferência própria `ImportarEscalaFdsPage` (login vence texto;
bloqueiam publicar: ordem vazia, Pn sem dono, 1º nome ambíguo);
**funcionárias do bloco PLANTÃO MATERNO NUNCA viram posição** (→ `ignorados`;
Renata/Elisete têm escala própria); publica até 4 turnos `hospital='fds'`,
`casos: []`. Fila unificada (`LiberacoesView modoFds`): casos dos 3 hospitais
mesclados (`hospitalOrigem` só exibição), badge **Pn P1–P12** por posição,
hospital prefixa o local, badges "Plantão Unimed/HRO" da faixa da grade
(genérico "Plantonista" sai), `opts.turno` OMITIDO na lib (regra
plantão-do-turno-seguinte é de dia útil; namespacing das marcações segue na
view); **trocas e P4-coringa FORA do modo FDS**. Fase noturna:
`faseLiberacoes({fds:true})` liga 19h/23h no sáb/dom com a faixa 19-07 DA
GRADE (`linhasNoturnasFds`; Unimed/HRO fixos = `foraDaFila`, nunca "próximo").
HomeCard mostra os plantões físicos da faixa (madrugada <7h = grade da
véspera); Pega Plantão ganhou P12 no FDS. **NOTURNO É TURNO, não fase (dono
15/08 21h):** o seletor do FDS tem 3 turnos (Matutino·Vespertino·**Noturno**) e
o relógio escolhe entre eles às **7h/13h/19h** (`turnoFdsAtual`) — a fusão
antiga por cima da lista do dia roubava o topo e RENUMERAVA a manhã ("sábado de
manhã não está idêntica"); hoje conferir a manhã às 21h mostra a manhã pura. Os
cards do noturno herdam a cirurgia da tarde em curso (`FDS_TURNO_CASOS`:
noturno lê casos do vespertino — o CHECK do banco só aceita matutino/
vespertino). **A FILA DA NOITE É MAIOR QUE A GRADE (dono 16/08:** sáb
P2,P1,P4,P3,**P11,P8,P7** · dom P3,P4,P1,P2,**P11,P6,P5** — "apenas adicione os
P's faltantes"): quem está de plantão à noite ≠ quem está na fila da noite, e os
Pn da lista numerada que entram são os que saem PRIMEIRO. `opts.ordem` de
`linhasNoturnasFds` (nomes, convenção do rodapé) é a fila; a grade só decide
POSTO (papel "Plantão Unimed/HRO" + `foraDaFila`). Quem está na grade e não foi
citado NUNCA some — vai para a frente (sai por último); sem ordem publicada a
fila segue sendo a linha 19-07 esquerda→direita. Mora em
**`fds_meta.ordemNoite`** porque 'noturno' não é turno de publicação, e o meta
vai inteiro em toda publicação (republicar não apaga; migration
`20260816120000` gravou 15–16/08). A conferência tem a 3ª lista, editável como
as outras: sem linha de noite no doc ela nasce da grade marcada "Sugerida", e
noite vazia NÃO trava a publicação (cai na grade) — manhã/tarde travam.
**Substituto na vaga:** nome fora do P1–P4 na
linha 19-07 (dom: JOAO RICARDO) some se casar por primeiro nome
(`resolverNomeEstrito` proíbe token solto p/ nome composto) e ASSUME o selo da
vaga livre quando é 1↔1 (P3 da Cristina), com "cobre X" no papel. Rollout: sem linha 'fds' publicada,
sáb/dom seguem por hospital + aviso a quem edita. Demo `DEMO_DATE_FDS`
(27/06, DEV-only) + e2e `escala-cirurgica-fds.spec.ts`.

### Desenho das telas da escala (dono 17/08) — escolhido em protótipo, antes do código

Método que valeu e vale para a próxima mudança visual do módulo: propostas renderizadas
como HTML estático com os tokens reais, a 430px (iPhone 14 Pro Max) nos dois temas, com a
medição ao lado (altura dos controles, y do 1º item, quantos itens cabem sem rolar) — o
dono escolhe por imagem e só então `src/` muda. A BarraControles (16/08) não entrou em
discussão: as telas convivem com ela.

- **Completa** (`BoardView`): quadro DENSO — salas em faixas full-bleed com divisórias no
  lugar de cartões soltos (6 casos por tela contra 4), cabeçalho `bg-card-elevated` com a
  sala em **pill sólida** + anestesista 15px + contagem + ⚙, sala colapsável. Card: hora em
  coluna com o término abaixo (`13:30`/`→15:45`); **iniciais · idade · PROCEDIMENTO na 1ª
  linha** (é qual cirurgia que se procura primeiro); cirurgião (+ `· R: residente`) na 2ª,
  com tempo faltante, status e convênio à direita — a 2ª linha QUEBRA em vez de truncar o
  cirurgião. A coluna do tempo tem **46px** e o texto começa logo depois (dono 18/08,
  "mais próximas ao horário"), e **caso sem horário RECUA junto** — a margem é do
  QUADRO, não da sala (`casoTemColunaTempo` sobre todos os casos do turno): urgência
  acrescentada à mão vira sala PRÓPRIA sem horário nenhum, e a reserva por sala a deixava
  fora do prumo do resto. Quadro sem horário nenhum não paga o recuo. **Tempo ESTOURADO
  mostra a âncora (dono 18/08):** cirurgia em andamento que passa da hora ficava só com
  `+50min`, e o horário que dá sentido ao número era justamente o que sumia — 50min do quê,
  faltando ou passados? Agora a coluna se lê inteira (`10:30` / `→11:57` RISCADO / `+43min`
  âmbar): riscar é a convenção de painel de aeroporto para o horário que não vale mais, faz
  o trabalho da palavra dentro de 46px (`43min além` quebraria em duas linhas) e não depende
  só da cor, que neste módulo já significa outras cinco coisas. Enquanto FALTA, `~45min` se
  explica sozinho e a âncora não aparece. **Tinta em UM eixo só**: iniciada `bg-success/[0.14]` e terminada
  `bg-info/[0.12]` (dark /20 e /22); atrasada, suspensa e passa-para-tarde ficam só no
  badge — com os cinco pintando o quadro virava vitral. `CasoCard` ganhou `moldura`:
  `'linha'` na Completa, `'card'` na Minhas (mesmo conteúdo, molduras diferentes).
- **Importar · entrada**: stepper **1 Anexar → 2 Conferir** (o 2 acende com a base) +
  cartão único "Para qual escala" (hospital · data · período); o atalho do documento de FDS
  desceu para depois do anexo — é desvio de rota, não etapa. As sugestões do anexo seguem
  sugerindo, nunca trocando sozinhas.
- **Importar · conferência**: barra fixa **Blocos · Liberações · Pendências** que ROLA até a
  seção (`#conf-blocos`/`#conf-liberacoes`/`#conf-pendencias`) — não troca de aba, porque
  bloco e fila precisam ser lidos na mesma passada — com faixa vermelha contando o que
  impede publicar. Fila de liberação em **2 colunas correndo para baixo** e **SEM contagem
  de casos por pessoa** (o número confundia): quem está na ordem sem cirurgia nenhuma leva
  **ponto âmbar** e o porquê é lido uma vez em Pendências. Editor da posição abre FORA das
  colunas. Botão diz **"Publicar N casos"**. **SRPA da Unimed entra às 09:00** (dono 18/08):
  o mapa nunca escreve esse horário — 34 das 37 publicações com SRPA vieram sem hora — e sem
  ele a posição fica fora de toda conta de tempo, então é regra da casa e mora no código
  (`aplicarHoraPadraoPosicoes` em `escalaCirurgicaItens.js`), carimbada na conferência, onde
  ainda dá para corrigir. ⚠️ **só no MATUTINO**: a hora é o que decide o turno na publicação,
  e 09:00 numa importação vespertina jogaria a SRPA para FORA da escala da tarde. O horário
  da SRPA vespertina ninguém informou; até lá ela segue sem hora, herdando o turno escolhido.
- **Importar · FDS**: **P1–P12 em 2 colunas** (P1..P6 esquerda, P7..P12 direita) e as **3
  filas lado a lado** (Manhã · Tarde · Noite) — empilhadas passavam de uma tela e comparar
  turnos exigia vai-e-volta. Cabeçalho da coluna leva **só o turno**: os selos "do
  documento"/"Sugerida" saíram da tela (a origem continua em `fds_meta.ordemFonte`, que é
  quem a fila usa). Ordinal colado ao nome (`1º Matheus`), Pn acima em peso menor; mover/
  remover e o par texto+login abrem fora das colunas. Os dois dias seguem empilhados.

### Superfícies de ação da escala (dono 17/08) — os painéis que abrem por cima

Mesmo método (protótipo a 430px nos dois temas, medição ao lado, escolha por imagem),
com DUAS rodadas de revisão do dono olhando a tela em uso. Três achados de DS que
explicam metade das queixas e valem para o app inteiro:

- ⚠️ `POSITION_CLASSES.bottom` do DS fixa **`h-[85vh]`**, não `max-h`: todo bottom-sheet
  nascia com 85% da tela mesmo quase vazio — era a causa literal de "a tela fica quase
  vazia". Os sheets da escala passam `!h-auto max-h-[88vh]`; o **default do DS fica como
  está** (mexer nele alcança os outros cinco sheets do app).
- ⚠️ o dropdown do `Select` herda a **largura do gatilho** (`select.jsx`,
  `width = Math.min(triggerWidth, …)`). Gatilho estreito = lista de 45 nomes num popover
  espremido. Onde a lista é longa, usar folha própria em vez de insistir no Select.
- ⚠️ `AccordionTrigger` pinta `dark:group-data-[state=open]:bg-card`: neutralizar SÓ a
  variante clara parte o cabeçalho em duas cores no escuro (bug visto em 17/08 no
  cabeçalho de sala). Neutralizar as duas.

- **Detalhe do caso** (`CasoDetalheSheet`, Completa + Minhas): **três cartões por
  assunto** — a cirurgia · **Andamento** · Quem está e onde. O primeiro é leitura; o
  segundo traz os dois eixos (principal pinta o card, aviso convive com iniciada e é
  bloqueado por terminada) mais o término desta cirurgia; o terceiro traz cirurgião,
  anestesista, residente, sala/local e ajuda. **Cirurgião virou editável** (grava
  `cirurgiao`, o mesmo campo do Adicionar caso). Cada editor abre em **folha de baixo
  para cima**, com o caso parado atrás — expandir dentro do cartão mudava a altura no
  meio da leitura. Nome do anestesista e grafia do procedimento saem das MESMAS funções
  do quadro (`nomeAnestesistaExibicao`, `fraseClinica`).
- **Anestesista da sala/caso** (`DefinirAnestesistaSheet`): **De → Para** — cards SAI e
  ASSUME lado a lado no topo, "Procedimentos assumidos" abaixo (com os terminados
  riscados e o porquê), toggle de assumir a posição e o par Cancelar/Trocar. O card
  ASSUME abre uma **folha** com busca no topo (nome ou apelido), largura inteira e
  altura fixa de 72vh — a lista rola por dentro e não muda de tamanho com o filtro.
  Lista só de NOMES em ordem alfabética (`localeCompare` pt-BR). "agora com {nome}" no
  cabeçalho não é decoração: foi ele que denunciou o bug de turno de 31/07.
- **Tempo** (`PainelTempo`, fonte única da pessoa e da cirurgia): o **"ou" virou
  alternador segmentado** — "Tempo faltante" × "Horário de término", um caminho por vez.
  As duas rotas ocupam a MESMA caixa (`h-[154px]`; medido no app: 413px nas duas) porque
  o card mudar de tamanho debaixo do dedo piora a leitura. Atalhos em grade de 6 +
  "Outro tempo…"; campo de horário estreito e centrado. **"Definir" saiu** — era morto,
  já que atalho, seletor e campo gravam na escolha.
- **Pílula do total da pessoa** na fila (dono 18/08, 2ª queixa sobre o MESMO número — a 1ª
  foi 30/07, com dois relógios no card): um delta solto é o pior formato possível para algo
  lido de relance, porque é relativo, sem rótulo e sem âncora. Três referências convergem —
  painel de aeroporto mostra o previsto MAIS a palavra de status (nunca só o atraso), o guia
  de timestamps do Cloudscape exige rótulo dizendo a que evento o horário se refere, e
  Dexter & Epstein (Anesth Analg) mostram que, passada a estimativa, o tempo restante médio
  fica quase CONSTANTE (um contador que sobe não prevê nada, só informa que estourou). Daí a
  assimetria de `fraseCronometro`: enquanto falta, `~25min`; quando passa, **`25min além`** —
  a mesma frase que a linha do cirurgião já usa, para a tela falar uma língua só. ⚠️ **não
  vira "atrasou"**: esse é o badge de status DA CIRURGIA e trocaria uma dúvida por outra.
  E o card **não repete o mesmo tempo**: quem tem UMA cirurgia ativa tem o total espelhado
  do término dela (31/07), então o valor saía duas vezes, âmbar no chip e verde na pílula —
  dois números idênticos fazem procurar uma diferença que não existe, que é a própria
  pergunta "a que se refere?". Fica a pílula (é ela que dirige a fila); o chip volta quando
  os horários divergem (2+ cirurgias) e some junto o truncamento do nome do cirurgião.
- **Painel da linha** (✏️ Liberações): **lista full-bleed** de cinco assuntos com o valor
  atual à direita — Observação · Local · Cirurgião(ões) · Ajuda · Troca — e o editor
  abrindo em folha. O rodapé Restaurar/Salvar some enquanto a folha está aberta (dois
  botões "Salvar" na mesma tela é escolha que ninguém deveria ter). "Recado" chama-se
  **Observação**: com o recado do plantonista na mesma aba, dois "recados" com sentidos
  diferentes se confundiam.

### Recado do plantonista (dono 17/08) — mensagem na aba Liberações

Faixa full-bleed acima de "procedimentos sem anestesista". **Só o plantonista do turno
manda** (o do selo na fila; para os demais o botão não existe) — botão "Mensagem para
equipe". **LER é de todos**: "Histórico de mensagens" abre os recados do turno, inclusive
os já confirmados, e é lá que o plantonista **apaga** (a lixeira do card sumia junto com
o recado assim que ele confirmava o próprio).

- **ATÉ 3 por PESSOA, não por turno**: cada um vê os três mais recentes que ainda não
  confirmou; confirmar libera a vaga do próximo. Um recado antigo não confirmado fica
  atrás dos novos e só aparece no histórico — decisão consciente do dono.
- **Some por confirmação individual**: quem confirmou não vê mais, quem não confirmou
  continua vendo. Sem contagem de leituras no card (virava placar); ficam texto, autor e
  hora.
- **Cor = `category-teal`, por ELIMINAÇÃO** (passou por laranja e roxo antes): verde é
  plantão/iniciada, azul é terminada, âmbar é atrasada/próximo/sem anestesista, vermelho
  é liberado/suspensa, roxo é "passa para tarde" e indigo é "troca" — todos podem estar
  na MESMA tela. Teal não significa nada no módulo.
- ⚠️ **NÃO é notificação**: vive na tela em realtime e morre na confirmação. A escala não
  manda mensagem a ninguém desde 30/07 e isso não mudou.
- Banco: `escala_cirurgica_aviso` + `escala_cirurgica_aviso_confirmacao` (migrations
  `20260817140000` e `20260817180000`). Autor e confirmante são **server-side por
  trigger** (`firebase_uid()`) — não dá para falar pela boca de outro nem inflar o placar;
  a confirmação é linha própria com PK composta (num jsonb, duas confirmações simultâneas
  se sobrescreveriam). RLS por papel, como o resto do módulo; nada toca `ordem_liberacao`.
- Hook `useAvisoPlantonista` fica FORA do context: o recado não é parte da escala e o
  context já carrega três hospitais por data.

### Urgências do HRO — contador de contrato + fila (dono 18/08)

O contrato do HRO paga por turno: manhã 1 orto (Sala 4) + 1 CO (Sala 7) + plantonista +
sobreaviso; tarde sem CO; noite só plantonista + sobreaviso → **capacidade de urgências
simultâneas = 2**; endoscopia/colono FORA do CC e hemodinâmica não contam. A 3ª urgência
exige gente que o hospital não paga — a faixa no topo da aba **Completa** (só HRO, só
quando há urgência) mostra isso em tempo real.

- Lib pura `src/lib/escalaCirurgicaUrgencias.js` — nome de propósito: o gate de CI só
  observa `escalaCirurgica*`. `CONTRATO_HRO` é config POR TURNO (o `co` some de
  `dedicadas` à tarde/noite — é onde a decisão vira código); `turnoContratual` delega a
  `faseLiberacoes` (o campo `turno` do caso só aceita matutino|vespertino, então a
  urgência das 21h é vespertina no banco mas do contrato da NOITE — **a capacidade vem do
  relógio**). `estadoUrgencias` recebe o **dia inteiro** (`casosResolvidos`), NUNCA
  `filtrarPorTurno`: urgência da manhã ainda aberta às 14h ocupa o plantonista da tarde.
  Exclusão é pela SALA (a mesma colono conta no CC e não conta em `Exames`), via
  `papelDaSalaHro` NORMALIZADO — produção tem "Sala 5"/"Sala 5 - Emergência" e
  "Sala 7"/"Sala 7 - CO" para as mesmas salas. Fila ordena gravidade→`created_at`
  (⚠️ chega em **snake_case** — não está no CAMEL_TO_SNAKE; `createdAt` = NaN silencioso);
  NUNCA por `hora` (18/08: 9 de 9 urgências sem hora). Iniciada há >4h
  (`statusAtualizadoEm`, nunca a chegada) sai da ocupação e vira pergunta "ainda em
  andamento?" — 36% das urgências ficam sem marcação, e o app não afirma o que não sabe.
- **Coluna `gravidade`** (migration `20260818140000`): imediata|urgente|aguarda
  (adaptação NCEPOD), NULL = não classificada (sem default: não existe gravidade neutra;
  NULL vai ao FIM da fila com "Classificar"). Capturada no `AddCasoSheet` (obrigatória só
  em urgência/emergência; emergência pré-seleciona imediata) e editável no cartão
  Andamento do `CasoDetalheSheet`. ⚠️ a migration patcheia as DUAS RPCs de publicação
  **sobre a definição VIVA** (`pg_get_functiondef` + âncora única + guard de versão) — a
  versão mais nova de uma RPC NÃO está na migration de nº mais alto que a cita
  (`20260726110000` é anterior a `20260729210000`); copiar a errada apaga colunas em
  silêncio. `gravidade_caso` denormalizada em `escala_cirurgica_evento` (trigger); só é
  gravada quando há transição de status — lacuna aceita, o relatório declara a cobertura.
- **UI** `FaixaUrgencias.jsx` em EscalaCirurgicaPage (branch board, fora do modo FDS),
  **FORA da BoardView** — os EmptyStates dela matariam a faixa no dia sem escala com
  urgência à mão (8 de 9 em 18/08). Desenho fechado em 3 rodadas de protótipo
  (`.tmp/urgencias-hro-prototype.html`): grade 2×2 de UMA linha (36px, sem negrito, sem
  subtítulo), postos = plantão/sobreaviso + dedicados do turno; **excedente = card
  PRÓPRIO full-width com rótulo EXTRA** (nunca chip igual aos outros); fila em 1 linha
  (nº+gravidade+procedimento+espera; sala/convênio só no detalhe), teto 3 + "ver todas";
  cores = receitas existentes (selo de sala `bg-primary/20 text-primary`, tinta
  `bg-success/[0.14] dark:/20`); **vermelho SÓ no excedente/badge/nota** — fundo
  vermelho sob cards verdes foi vetado como "vitral". Toque abre o `CasoDetalheSheet`
  (onde Iniciada/Terminada já são marcados). **Escala do HRO com casos ⇒ faixa VISÍVEL
  mesmo sem urgência (dono 19/08)** — é na publicação da manhã que se confere/configura
  as salas do contrato; sem caso nenhum no dia, some.
- **Salas CONFIGURÁVEIS por dia/turno (dono 18/08, 2ª decisão)**: "as salas do CO e
  ortopedia podem mudar" — `urgencias_meta` jsonb no cabeçalho (migration
  `20260818190000`), chaveado por turno de PUBLICAÇÃO, gravado pela MESMA
  `rpc_escala_patch_liberacao` (campo novo no CHECK; por/em carimbados server-side).
  Coluna própria DE PROPÓSITO: reusar `linha_overrides` morreria no reset da
  republicação. `salasContrato(meta, turno)` resolve config→default;
  `papelDaSalaHro(sala, salas)` — sala marcada VENCE o default por papel (orto na
  Sala 3 ⇒ Sala 4 vira comum); `distribuirPostos` casa sala marcada primeiro, resto
  por ordem de início; **a marcação muda só a ATRIBUIÇÃO, nunca a contagem**. UI: ⚙
  no cabeçalho da faixa → `SalasUrgenciaSheet` (4 Selects + Automático; tudo
  automático salva null). `urgenciasMeta` PRECISOU entrar no CAMEL_TO_SNAKE (classe
  fds_meta/conta_duplicada_de).
- **Relatório contratual**: modo `contrato-hro` planejado na skill `/escala-cirurgica`
  (pareamento 1º iniciada→1º terminada posterior = Achado 2; sweep-line com empate
  saída-antes-de-entrada; SUS = `upper(convenio) ~ '^SUS\M'`; tudo
  `at time zone 'America/Sao_Paulo'`). Validado contra produção 18/08: 16 intervalos,
  mediana 49min, pico 2 simultâneas em 06/08. Comunicado leigo à equipe:
  `.tmp/comunicado-urgencias-hro.md`.

## Bottom Nav
4 abas: **Home** | **Gestão** (Shield) | **Educação** | **Menu**
(Dashboard temporariamente oculto; código preservado em `App.jsx`)

**Visual TRAVADO (dono 14/08):** barra SEM badge/dot (removido 2× — `8663996` e 13/08; estado clínico pertence ao card do módulo, não à navegação) e cor por TOKEN em `.bottom-nav-glass` (anest-theme.css): light `--muted` #E8F5E9 (nível 1 — o nível 0 #F0FFF4 sobre cards brancos lia como "barra branca"), dark `--background` #111916; borda `border-border`, sem inset/borda branca (viravam "filete" sobre o verde). O ramo iOS (blur off) usa os mesmos tokens.

⚠️ Bug conhecido: `src/App.jsx:1011` (TODO BUG-06) — global BottomNav pode duplicar com per-page BottomNav (createPortal). Decisão arquitetural pendente. Em página nova, **NÃO** renderizar BottomNav próprio.

## Skills (`.claude/skills/`) — invocar com `/`
`/calculadoras` `/educacao` `/gestao-documental` `/centro-gestao` `/notificacoes` `/nova-pagina` `/supabase-migration` `/rotacao-residencia` `/importar-plantoes-residencia` `/escala` `/escala-cirurgica` `/cirurgias-particulares` `/cateter-peridural` `/criar-prompt`

> `/escala` substitui as antigas `/sobreaviso` e `/hospitais`: um docx único por mês (template gerado pela própria skill) importa as duas escalas de uma vez.

## Rules (`.claude/rules/`) — auto-aplicadas neste projeto
`design-tokens` · `responsividade` · `navegacao` · `lgpd` · `qmentum-compliance` · `supabase-firebase` · `padroes-codigo` · `audit-trail` · `prompting`

## Referências em `docs/`
escalas-plantoes · cateter-peridural · cirurgias-particulares · escala-cirurgica (+ -analise-adesao, -evolucao-tecnica) · organograma · formularios-publicos · etica-comites · residencia · incidentes-denuncias · comunicados-inbox · faturamento · desastres · planos-acao · project-phases

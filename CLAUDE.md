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
| Mensagens internas | `src/pages/communication/` (Inbox, MessageDetail) | `MessagesContext` + `supabaseMessagesService` → tabela `messages` | Threads c/ respostas; `createSystemNotification` é a ponte de notificação usada por todos os módulos. ⚠️ Lista da inbox usa `<div>` simples, **não** `AnimatedList`: o wrapper `layout` do framer movia a linha sob o dedo entre press/release → 1º clique não registrava ("fica parado na lista"), só em prod c/ dados reais (cliques atômicos do Playwright não reproduzem). Fix 956aedd |
| Meu Perfil | `src/pages/ProfilePage.jsx` (rota `/profile`) | Firestore `userProfiles` (fonte da verdade; `crm`/`especialidade` são **Firestore-only**, sem coluna no Supabase `profiles`) + `updateUser` sincroniza só `nome` p/ Supabase | Estrutura (best-practice pesquisada): Identidade (avatar + credenciais **CRM · especialidade** + **1 cargo** admin>coord>role) → Mensagens (atalho discreto) → Conta e Segurança → Modo Escuro → Administração (admin) → LGPD → Sair. ⚠️ **Gotcha save silencioso:** Firestore tem persistência offline (`persistentLocalCache`) → `updateDoc` resolve no cache e mostra toast de "sucesso" mesmo se a escrita do servidor for rejeitada (sessão/token Firebase degradado) → o valor some ao recarregar (`updateTime` do doc no servidor não muda). **Re-login renova o token e resolve.** |
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
| Codificação Anestésica | card em MenuPage → `src/pages/codificacao-anestesica/` | Supabase `unimed_tuss_codigos` (read-only, ~5.4k TUSS HM+SADT) + lib pura `src/lib/codificacaoAnest{,Rules}.js` + `src/data/codigosAnestesia.js` (grupo 31602 curado) | Calculadora de guia estilo Volan: autocomplete (digita **código OU nome** → sugestões ao vivo via RPC `search_unimed_tuss` — **acento-insensível + multi-palavra**, migration `20260622140000` + extensão `unaccent`; com **favoritos** em localStorage `anest-cod-fav`, **sem ícone de lupa**) → cada linha com **quantidade** + **% MANUAL por linha** (entra a 100%; ajuste no badge **DropdownMenu** com `OPCOES_PERCENTUAL` 10/30/40/50-mesma via/70-outra via/100-principal). A cascata oficial **100/50/40/30/10** (`CASCATA_PERCENTUAL`/`sugerirPercentuais`, v2026.03 itens 2.1.21/4.6) é **explicada na legenda do card, não auto-aplicada** (auto-% recusado pelo dono). + valor cirurgião/anestesista. **UTM fixa R$ 1,75** (Chapecó, sem seletor, Lista v.09 01/04/2026 — subiu de 1,73) = stored×(1,75/1,17). **Acomodação** (`Select`, `ACOMODACOES`): Apartamento dobra **por código** (item XIV) via `dobraAcomodacao` — cirúrgicos 3xxx HM geral; 1/2/4 só se em `LISTA_DOBRA`; SADT/demais não dobram → `calcularGuia(opts.acomodacaoMult)` aplica a dobra por linha (o card mostra "dobrado"/"não dobra: SADT|fora da lista"). **Toggle Urgência/emergência +30%** (`opts.urgencia`, item 1.3) — só HM (SADT nunca, 1.3.2). Card de cada código mostra **Porte cir. + Indicador anest. (porte oficial v2026.03) + UTM** (anestésica = `INDICADOR_UTM[indicador]`, proc. = valor/1,17) + nº auxiliares (item 3.1) + nota **2º anestesista** quando transplante/CEC/neonato/gastroplastia (`indicaSegundoAnestesista`, item 4.8 = 30% do titular). Limite de **3 proc. SADT diagnóstico** p/ anestesia (item 4.16, flag `limiteSadt`). Totais. **Recomendação do ato anestésico segue a hierarquia oficial v2026.03 §4.3** (`recomendarCodigo` + `src/data/codificacaoAnestProtocolo.js`): 4.3.3 deny (`SEM_ATO_ANESTESICO` 121→`sem_anestesia`, não recomenda) → 4.3.1 exame (`RECOMENDACAO_EXAME` → 31602231–304) → 4.3.2 lista `LISTA_31602312` (159 cods → **31602312**) → 4.3.4 fallback (SADT→31602304 B · HM→31602355 E); 31602347 = odontológico. Indicador **A = 128 UTM = R$149,76** (planilha legada trazia 150; migration `20260624120000` corrige + insere 2 DIU faltantes). Honorário do cirurgião de 47 códigos HM reajustado na v.09 (migration `20260625120000`). Demo espelho: `public/codificacao-anestesica-demo.html`. Consulta = referência 31602 por situação (cada item **accordion**) + tabela **SADT→anestesia** (`SADT_EXAME_ANESTESIA`, item 4.3.1: RM→282, TC→274, US→266, endoscopia→231/240, etc.). Sem gate. Seed: `scripts/extract-tuss-from-xlsx.mjs` → `scripts/seed-unimed-tuss.mjs`. Refs: `docs/codigos-anestesia.md`, `docs/codificacao-anestesica-v2026.03-analise.md` |
| Escala Cirúrgica Diária | card no hub **EscalasPage** (Gestão→Escalas) → `src/pages/escala-cirurgica/` | Supabase `escala_cirurgica` + `escala_cirurgica_caso` + `trocas_cirurgicas` + `escala_cirurgica_evento` (migrations `20260628200000` → `20260721100000`; RLS por `can_write_escala_cirurgica()` = clínico/secretária OU admin; realtime nas 3 tabelas) + Edge `parse-escala-cirurgica` (Claude Vision) + lib pura `src/lib/colunaLiberacao.js` | **LIBERADO AO GRUPO 2026-07-22** (piloto de 1 encerrado): gate `podeVerEscalaCirurgica(user)` em `escala-cirurgica/gate.js` agora por papel (clínico/secretária/admin, espelha a RLS) em EscalasPage + rota App.jsx. Checklist de liberação executado: seeds APAGADAS + eventos de teste limpos + cron `escala-seed-rollover-daily` desligado; regressão visual PAUSADA (fixture era a seed-20 — `test.skip` no spec, aguarda nova fixture); aviso 18h segue só p/ o dono (trocar p/ secretaria/admin quando houver). Mobile-first: data (`DatePicker` DS) + turno + hospital (Unimed/HRO/Materno) + **3 abas**. **Completa** (`BoardView`): cards por sala (`Accordion` com `iconAfterActions` — ⇆ antes do chevron), **status em 2 EIXOS** — principal pinta o card (agendada neutro / **Iniciada VERDE** / **Terminada AZUL info**) + extra em badge toggle que convive c/ agendada-iniciada, nunca c/ terminada (**Atrasada âmbar / Suspensa vermelho / Passa para tarde ROXO** `category-purple`; CHECK de invariante no banco, RPC `rpc_escala_status_cirurgia` FOR UPDATE) — sheet 3×2 (extras desabilitados se terminada); tipo **Urgência/Emergência ambos VERMELHOS** (subtle/solid); convênio em **selo TONAL** (`bg-black/10`) no canto inferior direito (sem stripes); helper `familiaConvenio` (SUS/UNIMED/BRF/FAS/SC/CASSI/PARTICULAR/INTERCÂMBIO; dark = verde sólido); adicionar caso; **TROCAS APOSENTADAS (23/07, decisão do dono: 'muito complexo')** → `DefinirAnestesistaSheet`: define o RESPONSÁVEL pela sala (Select searchable do roster; casos não terminados ganham apelido+uid; UserCog no header da sala e no detalhe do caso, Completa+Minhas; responsável atual repassa, coordenador define qualquer uma; ambos notificados). Completa e Liberações derivam dos casos → mudam juntas. TrocaSalaSheet/TrocaPendenteCard sem entrada de UI (arquivos/actions mantidos). **Liberações** (`LiberacoesView`): coluna das 18 regras, cards verde=pills do seletor (`bg-primary/10`)/amarelo próximo/vermelho liberado; badge Plantonista sólido ao lado do nome (linha full-width; cronômetro na 2ª linha); sala sob o cirurgião; **cronômetro em pill `bg-primary` 100% MANUAL (23/07: nasce em branco; estimativa automática removida — '+8h53' sem sentido)** + sheet "Tempo faltante" (atalhos 15min–3h + hora exata em Select DS 15/15min); liberado = card enxuto (nome+badge+lápis); **desfazer liberação = linha RENOVADA** (`renovado` no override — zera e suprime derivados até preencher). **Log de eventos invisível** `escala_cirurgica_evento` (Fase 0 da previsão de tempos): triggers status (2 eixos) + liberações c/ snapshot da ordem — NUNCA bloqueia operação clínica. ⚠️ coluna nova lida no front → `CAMEL_TO_SNAKE` do service (`statusExtra` incluso). ⚠️ INTEGRIDADE (lição 22/07): `liberacoes`/`linha_overrides` são gravados pela CHAVE ESTÁVEL da linha (`linha.chave` = uid do vínculo ou nome normalizado, fallback de leitura no display legado) e reordenação persiste `linha.nomeOriginal` — NUNCA gravar o nome exibido (muda com vínculos → marcações órfãs + rodapé duplicado, reparado em prod). Secret `ANTHROPIC_API_KEY` (dono). **Roadmap:** previsão de términos por cirurgião×procedimento (dados já coletando), sugestão de alocação respeitando ordem de liberação, ponte financeira (guia→Conta Azul). **Identidade (Fase 2.1, 2026-07-21):** dicionário `escala_anestesista_alias` populado (54 apelidos→47 pessoas, confirmados pelo dono; regra: 1º nome sozinho c/ >1 candidato → SEMPRE perguntar); coluna de liberação agrupa por vínculo (`resolverUid`+`anestesista_user_id` — fix do "próximo a ser liberado depois dos liberados") e exibe **nome com diferencial** (apelido só-1º-nome → "Gustavo Biesdorf" via `nomeExibicao`); badge **Ajuda azul sólido**; importação escolhe o hospital da escala + edge devolve `hospitalDetectado` (sugere, nunca troca sozinha); **conferência (fix 23/07):** o login escolhido no Select VENCE o texto importado no display publicado e o aprendizado de apelido só ocorre p/ apelido DESCONHECIDO (reatribuição não ensina A→B; dicionário tinha JANAINA→Cury desde a povoação, corrigido em prod); lições Vision 23/07 (no prompt): **AMARELO = anestesista em 2 locais de propósito** (manter nas duas linhas), C.O da Unimed NUNCA é bloco materno (2ª reincidência), anestesista SEMPRE da célula da própria linha (proibido propagar p/ linhas com nome próprio ou inventar). ⚠️ dono tem 2 contas (MELO→wguime; unificação pendente). **Card na Home (2026-07-22):** `src/components/escala-cirurgica/EscalaCirurgicaHomeCard.jsx` (família visual do card Biblioteca) — plantonista do turno atual (`ordem_liberacao[0]` + `titleCaseNome`) por hospital com escala publicada hoje; gate `podeVerEscalaCirurgica`; context Tier 2 com fallback + fetch leve se a data do context ≠ hoje. **Cronômetro Liberações (fix 2026-07-22):** iOS/PWA mata o setInterval na suspensão (pills congeladas o dia todo) — `useAgoraMinuto` recalcula em visibilitychange/pageshow/focus E re-arma o interval; e2e determinístico `e2e/escala-cirurgica-cronometro.spec.ts` (page.clock + escala demo client-side, sem fixture no banco). **Fase noturna (2026-07-23, decisões a/b/c do dono):** `src/lib/plantaoNoturno.js` — seg–sex (FERIADO segue a regra) na escala de HOJE: 19h→22h bloco azul "Plantão noturno" (Unimed: P3 plantonista + P2 SRPA até 22h + P4 coringa; HRO: P1 + P4; Materno: P4) sobre as linhas diurnas restantes; **≥22h a lista ZERA** (EmptyState Moon); P1–P4 vêm do card Plantões (useEscalaDia) casados ao dicionário via `candidatosNome`; TUDO derivado do relógio — NUNCA reescrever o rodapé automaticamente (causa da corrupção 22/07); setas aceitam plantonista diurno E noturno na fase noite. ⚠️ `src/__tests__/pages/escalaCirurgicaPersonas.test.jsx` está com 16 falhas PRÉ-EXISTENTES (desde antes de ceb1a01) — triagem pendente. **Automações do piloto (2026-07-21, aplicadas):** pg_cron `escala-seed-rollover-daily` (00:05 BRT, seed móvel; seed-20 imóvel) + `escala-amanha-check` (18h BRT dom–qui, notifica dono se amanhã sem escala real unimed/hro; dedup); skill `/escala-cirurgica` (status/seed/relatorio/smoke; leitura via `query-ro.mjs` SELECT-only); hook smoke pós-deploy (`scripts/smoke-prod.mjs`); regressão visual `e2e/escala-cirurgica-visual.spec.ts` (clock congelado 20/07 14h → seed fixa). ⚠️ Liberação ao grupo: unschedule do rollover + APAGAR seeds (aprovado pelo dono). Refs: `docs/escala-cirurgica.md` · `docs/escala-cirurgica-analise-adesao.md` · `docs/escala-cirurgica-evolucao-tecnica.md` · `docs/escala-cirurgica-automacoes.md` · `docs/escala-cirurgica-metricas/` |
| Cirurgias Particulares | card no **Menu** → `src/pages/cirurgias-particulares/` (listagem = relatório em tela + form c/ import da escala) | Supabase `cirurgias_particulares` (migration `20260722100000`, aplicada; RLS `can_write_cirurgias_particulares()` = anestesiologista/secretaria OU admin — grupo todo vê tudo; FORCE RLS + REVOKE DELETE; realtime) + lib pura `src/lib/cirurgiasParticulares.js` + template PDF `cirurgiasParticularesReport` | **EM PRODUÇÃO** (deploy 2026-07-22; acesso = RLS anestesiologista/secretaria/admin — card visível a todos por default, barreira real é a RLS; user c/ permissões customizadas precisa do toggle no Centro de Gestão). Cobrança de honorários particulares: paciente (nome COMPLETO — dado sensível art. 5º II, base art. 11 II "d" no header da migration), cirurgião, anestesista (Select roster, default = user logado), data, procedimento, local, valor R$, status pendente/pago/glosado (`data_pagamento` auto). Período livre (2 DatePickers; DS DatePicker ganhou flip de âncora right-0 qdo popup estoura a viewport) + totais + tabs compactas sem contador (flex-1 text-xs — 4 abas cabem no 375px) + **Exportar PDF** (tarja CONFIDENCIAL + gerado por); lista é REATIVA (sem botão 'gerar'); empty state mostra o período + explica o auto-import; **CPF obrigatório no form** (migration `20260722400000`: `paciente_cpf` nullable só-dígitos CHECK 11; `validarCPF` DV + máscara na lib; `precisaCompletar` = iniciais OU sem CPF — valor saiu do critério), **valor OPCIONAL** (vazio = R$ 0, precifica depois), **CTA full-width no corpo** (header só lupa), **export em botão ÚNICO** (DropdownMenu: PDF / Excel / ambos; xlsx dinâmico, abas Cirurgias c/ CPF + Resumo, período no filename); ⚠️ REGRA DO DONO (2026-07-22): auto-import SÓ com convênio PURAMENTE particular ('Part'/'PART.'/'PARTICULAR'; COMPOSTO 'PART/SC' é ambíguo → NUNCA importa) E paciente IDENTIFICADO (lote '04 FACECTOMIA (04 PCTES)' sem paciente → não importa) — classificador `^PART(ICULAR)?[^A-Z]*$` + guard de iniciais espelhados em 5 lugares: `fn_convenio_particular`+trigger SQL (migration `20260722600000`), `familiaConvenio` (utils escala), edge parse-escala (sanitize+prompt), excelEscala e `casoImportavel` (lib) — mudar um = mudar todos (bug real 22/07: 4 casos HRO sem lançamento, corrigidos por re-backfill). Pipeline pacienteNome VALIDADO em produção 2026-07-22 (2 particulares reais importados c/ nome completo da Vision). **Soft-cancel** (sem DELETE; `cancelada_em/por/motivo`). **AUTO-IMPORT da escala (sem botão)**: trigger `fn_sync_cirurgia_particular` (migration `20260722200000`, aplicada; AFTER INSERT/UPDATE em `escala_cirurgica_caso`, NUNCA bloqueia a operação clínica) — publicar/republicar/adicionar caso/des-suspender/convênio→particular cria rascunho automático (paciente=iniciais, valor=0, badge sólido âmbar 'Completar dados' via `precisaCompletar`; save bloqueado por `pareceIniciais` até completar o nome); AddCasoSheet oferece 'Preencher cobrança agora?' → form via `params.escalaCasoId`; toast na publicação conta particulares; `escala_caso_id` SEM FK (republicação faz DELETE+reinsert → trigger RE-VINCULA órfão por data+local+cirurgião+procedimento) + índice único parcial anti-duplo-lançamento (cancelado libera); suspensa não importa e se suspender DEPOIS do lançamento a listagem alerta (badge âmbar via `fetchCasosStatus`) c/ ação de cancelar; **backfill retroativo** `20260722300000` (idempotente, marcador 'Backfill auto-import'); **NOME COMPLETO no rascunho**: edge parse-escala devolve `pacienteNome` SÓ p/ convênio particular (prompt + sanitize; nunca entra na escala — CASO_FIELDS filtra + CHECK rejeita) e o Excel idem; pós-publicação `completarPacienteDoCaso` casa payload↔salvos por sala|ordem e completa o rascunho só se ainda estiver em iniciais; AddCasoSheet captura o nome digitado antes do blur→iniciais; Local do form = LOCAIS_BASE (hospitais+IOSC/Centro de Coluna/Accurata/Digimax/Umanitá/HO/Consultório) ∪ locais já usados (Select searchable); ⚠️ seeds do piloto publicadas com particular geram rascunho de teste (limpar junto na liberação ao grupo). Provider ON-DEMAND nos 2 cases (não global). Pendências LGPD registradas (retenção ~5a + RIPD): `docs/cirurgias-particulares.md` |

## Edge Functions (`supabase/functions/`)
`fetch-noticias` (PubMed, dedup) · `fetch-yt-captions` · `fetch-classics` · `notify-incident` · `schedule-shift-reminders` · `send-fcm-push` · `sign-cert` / `verify-cert-public` / `verify-cert-uuid-public` / `get-cert-download-url` · `verify-doc-public` · `pdfa-convert` · `watermark-pdf` · `api-v1` · `ai-rag` · `pegaplantao-proxy` · `generate-api-token` · `get-supabase-token` · `parse-escala-cirurgica` (Claude Vision)

Deploy: `scripts/deploy-edge-fn-mgmt.mjs`. Edges que recebem JWT não-Supabase (Firebase/custom) exigem `--no-verify-jwt`. CORS: allowlist + echo + `Vary: Origin` (nunca origin única).

## Bottom Nav
4 abas: **Home** | **Gestão** (Shield) | **Educação** | **Menu**
(Dashboard temporariamente oculto; código preservado em `App.jsx`)

⚠️ Bug conhecido: `src/App.jsx:1011` (TODO BUG-06) — global BottomNav pode duplicar com per-page BottomNav (createPortal). Decisão arquitetural pendente. Em página nova, **NÃO** renderizar BottomNav próprio.

## Skills (`.claude/skills/`) — invocar com `/`
`/calculadoras` `/educacao` `/gestao-documental` `/centro-gestao` `/notificacoes` `/nova-pagina` `/supabase-migration` `/rotacao-residencia` `/importar-plantoes-residencia` `/escala` `/escala-cirurgica` `/cateter-peridural` `/criar-prompt`

> `/escala` substitui as antigas `/sobreaviso` e `/hospitais`: um docx único por mês (template gerado pela própria skill) importa as duas escalas de uma vez.

## Rules (`.claude/rules/`) — auto-aplicadas neste projeto
`design-tokens` · `responsividade` · `navegacao` · `lgpd` · `qmentum-compliance` · `supabase-firebase` · `padroes-codigo` · `audit-trail` · `prompting`

## Referências em `docs/`
escalas-plantoes · cateter-peridural · cirurgias-particulares · escala-cirurgica (+ -analise-adesao, -evolucao-tecnica) · organograma · formularios-publicos · etica-comites · residencia · incidentes-denuncias · comunicados-inbox · faturamento · desastres · planos-acao · project-phases

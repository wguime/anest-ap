# ANEST v5.0.0 — Gestão de Qualidade para Anestesiologia

> **Para humanos:** veja README.md no root e docs/dev-onboarding.md

App médico: React 19 + Vite + Tailwind 3 + Firebase Auth + Supabase (RLS via JWT custom HS256).
71 calculadoras clínicas (13 seções) + 7 critérios UTI, educação, gestão documental, LGPD/Qmentum compliance, escalas/trocas de plantão, residência, cateteres peridurais, incidentes/denúncias, comunicados e mensagens internas.

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
71 calculadoras ativas em 13 seções. Dados em `src/design-system/data/calculator-definitions.js`.

**Padrão para calculadoras complexas:**
- Lib pura: `src/lib/<nome>.js` (funções puras, `num()` helper, JSDoc, named exports)
- Display custom: `src/design-system/showcase/displays/<Nome>Display.jsx` (estado interno, sem props)
- Teste: `src/__tests__/lib/<nome>.test.js` (Vitest, edge cases obrigatórios)
- Na definição: `customRender: '<nome>'` + `inputs: []` + `compute: () => null`
- Em CalculatorShowcase.jsx: import + exclusion arrays + bloco `customRender === '<nome>'`
- `LEGACY_ID_MAP`: mapeia IDs antigos → novos para favoritos não quebrarem
- `getSectionsWithCalculators()` filtra `status: 'inactive'`

**Anticoagulantes** (card `periop_anticoagulantes`, seção Perioperatório e Via Aérea, 2026-08-25):
consulta, não escore. `src/lib/anticoagulantes.js` (pura) tem 30 fármacos × 4 janelas — última dose→punção,
última dose→retirada do cateter, punção→próxima dose, retirada→próxima dose — mais 9 reversores, protocolo do
cateter, sinais de hematoma, limiares e suspensão pré-operatória. 4 abas em `AnticoagulantesDisplay.jsx`.
Números da **ASRA 5ª ed. (2025)**, com ESAIC/ESRA 2022 e SBA 2020 (nomes ANVISA) como contraponto na tela —
⚠️ a SBA é mais conservadora nos DOACs (72 h para qualquer dose contra 24–36 h da ASRA em dose baixa); trocar a
fonte primária é 1 linha por fármaco. `resolverJanela` ajusta por ClCr e idade, e a PRIMEIRA regra que casa
vence (renal antes de idade). ⚠️ `resumo` existe porque badge é `whitespace-nowrap` e não encolhe: a frase do
GP IIb/IIIa deixava o nome do fármaco com 49px. Travas: `anticoagulantes.test.js` (43), com invariantes de
comprimento de rótulo — foi assim que o defeito nasceu.

**Inibidores de apetite** (card `periop_inibidores_apetite`, seção Perioperatório e Via Aérea, 2026-08-25):
GLP-1, coagonistas GLP-1/GIP e antiobesidade no perioperatório. `src/lib/inibidoresApetite.js` (pura) tem 15
fármacos, os 17 fatores de risco dos itens 7/8/9 da nota, dieta/jejum, POCUS gástrico e conduta no dia.
**3 abas, POR MOMENTO — não por assunto (dono 26/08, depois de uma investigação medida):** `Pré-op` ·
`No dia` · `Referência`. As 4 antigas (Fármacos/Jejum/POCUS/Conduta) partiam a mesma decisão em duas telas
(Fármacos mandava fazer POCUS, POCUS dizia como) e juntavam momentos diferentes numa só (o comparativo, de
gabinete, ao lado da broncoaspiração, de emergência). O que a medição mostrou: **Conduta era a aba mais longa
(2,4 telas a 375px) e a que menos tinha conteúdo próprio — 7 de 31 itens**; a manchete do **Jejum tinha 100% de
sobreposição** (trigramas) com o passo 1 do veredito; e **POCUS era a mais enxuta (229 palavras) e a única com
cálculo**. "Pré-op" é o mesmo vocabulário do card de Anticoagulantes, na mesma seção.

- **Cortados:** `ISR_PASSOS` e `BRONCOASPIRACAO` (12 itens) — conduta de estômago cheio que vale para íleo,
  gestante e trauma; um card de consulta de GLP-1 não precisa reensinar. `CONDUTA_ALTO_RISCO` **FICOU** (5
  itens): não estava na pergunta feita ao dono, e o protótipo a tinha omitido por engano meu.
- `AVISO_JEJUM_NAO_BASTA` saiu da lista de conduta e virou export próprio — é o único item DE GLP-1 ali, e
  pertence ao momento de reavaliar na admissão, não ao de conduzir.
- ⚠️ **Os 17 fatores de risco ganharam tela.** Só existiam dentro da folha "Avaliação do paciente", que exige
  escolher um fármaco antes — a pergunta mais consultável do card ("esse paciente é de alto risco?") não tinha
  como ser lida. Agora abrem a aba Referência.

⚠️ **O veredito é UM cartão** (dono 26/08: "informação duplicada, exclua o card amarelo"): o `Alert` da conduta
repetia o que o cartão Suspensão logo abaixo já dizia. Mas apagá-lo sem mais custaria o caso **manter** — por isso
`avaliarPreOperatorio` passou a devolver `conduta.heroi`, `conduta.chip`, `conduta.alternativa` e `explicacao`.
**O herói é a FRASE do veredito, não o número:** em "Não é obrigatória", um "7 dias antes" em corpo 24 diria o
OPOSTO da conduta, e o intervalo desce para `alternativa`. No "manter" a explicação vem da CONDUTA, não do
`motivo` do fármaco, que fala de suspender. Invariante em teste: `heroi` do manter não contém dígito.

⚠️ **`variant="destructive"` NÃO existe no `Alert` do DS — é `error`** (`alert.jsx`: default/success/warning/
error/info). O alerta "Estômago cheio confirmado ou suspeito" usava `destructive`, caía calado no `default` (fundo
de card) e nunca foi vermelho. Vale para o app inteiro: `Badge` usa `destructive`, `Alert` usa `error`.

O alerta "Quando fazer" do POCUS era `info` (azul) e virou `success` (verde) a pedido do dono.

⚠️ **A hierarquia de fontes é INVERTIDA em relação ao card de Anticoagulantes**: aqui a primária é a **nota SBA
C.SBA-01744/2026, de 15/05/2026** (consenso SBA + SBD + ABESO), e ANZCA/SPAQI/AOA-RCOA/ASA-ASMBS 2025 entram como
contraponto na aba Conduta. Motivo: é brasileira, é a mais recente e traz o algoritmo INTEIRO. Decisão reforçada
pelo dono no meio da implementação — *"as recomendações de suspensão devem ser baseadas nas recomendações da SBA;
mantenha outras situações mas o norte deve ser a SBA"*. Daí `avaliarPreOperatorio` citar o item da nota em cada
conduta (itens 3, 3.3, 4 e 5), travado em teste.

⚠️ **A nota da SBA cobre SÓ GLP-1 e coagonistas GLP-1/GIP.** Sibutramina, anfepramona, femproporex, mazindol,
naltrexona/bupropiona, orlistate e topiramato continuam no card — mas cada entrada carrega `fonteSuspensao`, que
a tela mostra em selo ao lado do intervalo: verde **SBA** (8 fármacos) ou **Fora da nota da SBA** com a fonte real
(7). Sem isso a tela dá à SBA uma recomendação que ela não fez. Invariante em teste amarra o selo à CLASSE.

Regras que mais se perdem numa edição distraída, todas com trava própria:
- **Alto risco tem piso de 7 dias mesmo em fármaco de CURTA duração** (item 5) — a liraglutida sai de 1 dia para 7.
- **Semaglutida ORAL (Rybelsus) é diária mas de LONGA duração** (meia-vida ~7 dias): frequência de dose e
  farmacologia divergem, e a SBA classifica por DURAÇÃO. Quem seguir a frequência manda o paciente para a sala
  com 1 dia de suspensão contra uma droga de uma semana.
- **Dieta líquida sem resíduos 24 h + jejum 8–12 h valem para TODOS** (item 6), suspendendo ou não.
- **Manter o fármaco exige POCUS gástrico sistemático** (item 3). Sem essa estrutura, item 3.3: não considerar
  manter. É o `pocusDisponivel` do painel — o único eixo que muda "manter" em "suspender".
- **O corte do POCUS é `> 1,5 mL/kg`**: exatamente 1,5 ainda é BAIXO risco. Fronteira testada nos dois lados.
- **Sólido/particulado vence qualquer volume.**
- **Naltrexona/bupropiona é o que mais muda o plano anestésico** (bloqueia o receptor opioide; 72 h se houver
  opioide previsto, e só reintroduzir 7–10 dias após a última dose) — e é justamente o que NÃO retarda o
  esvaziamento gástrico, então sai do algoritmo de aspiração por `retardaEsvaziamento: false`.

⚠️ `toFixed()` devolve PONTO decimal e o resto do card escreve com vírgula ("1,5 mL/kg", "27,0"). O resultado do
POCUS saía `1.26 mL/kg` ao lado da fórmula com vírgula — dois separadores na mesma tela fazem duvidar da conta.
Helper `numeroBr` no display; travado no e2e por string exata.

Travas: `inibidoresApetite.test.js` (42) + e2e `inibidores-apetite.spec.ts`, que é a auditoria de LAYOUT a 375px
nos dois temas REAIS (`localStorage['anest-theme']` via `addInitScript` — forçar a classe `.dark` no `<html>` não
muda `TabsList`/`TabsTrigger`, que leem `useTheme()` do contexto, e rende screenshot "dark" falso). Ela mede barra
de abas × cards, truncamento por `scrollWidth > clientWidth`, alvo de toque e estouro horizontal. Dois achados
ficaram de fora por serem DO APP e não do card, confirmados medindo o card de Anticoagulantes: o `<input>` do DS
tem 24px mas a caixa que recebe o toque tem 58px (falso-positivo), e o botão **"Voltar"** do cabeçalho da página
de calculadora tem **20px** — esse é real, vale para as 71 telas e depende de pedido do dono (Regra #2).

**Lista agrupada por medicação** (`src/lib/agrupamentoFarmacos.js` + `ListaFarmacosAgrupada.jsx`, dono 25/08 —
*"a lista ficou muito extensa e com medicações repetidas"*): vale para os DOIS cards. Anticoagulantes saíram de
30 linhas para **22 cartões** (só a HNF ocupava 4: EV · SC baixa · SC alta · SC terapêutica; mais enoxaparina,
fondaparinux, rivaroxabana, apixabana e dabigatrana, cada uma em dose baixa/alta); inibidores, de 15 para **13**
(semaglutida injetável+oral, exenatida diária+LAR). Só quem TEM variante declara `grupo`/`grupoNome`/`variante` —
quem não declara é o próprio cartão, então 90% das duas bases ficou intocada.

⚠️ **As variantes abrem em OUTRA TELA (`PaginaGrupo`), não em sanfona.** Três desenhos foram reprovados pelo dono
na MESMA tarde, em sequência, e o registro deles é o que impede refazê-los: (1) sanfona expandindo no lugar →
*"quero que o usuário clique no card e apareçam as opções numa outra página"*; (2) badge com a contagem
("2 opções") → badge é lugar de dado clínico, não de metadado da lista; (3) `ChevronRight` no cartão de grupo →
*"retire as setas"*, porque só ele tinha seta e a margem direita da lista ficava irregular. Hoje o cartão de
grupo é visualmente IGUAL aos demais, e quem diz que há mais lá dentro é a linha das apresentações.

- ⚠️ `resumoDoGrupo` devolve **`null` quando as variantes divergem**: um número no cartão da lista seria lido como
  "o" intervalo daquela medicação, e ele depende da dose que ainda não foi escolhida (enoxaparina vai de 12 h a
  24 h, e as regras de função renal esticam mais). Convergindo — semaglutida, 7 dias nas duas —, o valor aparece.
- **Marca comercial em TODOS os cartões das duas listas** (dono 25/08), 3ª linha, abaixo da via/apresentação;
  no cartão de grupo é a união DEDUPLICADA das variantes ("Ozempic · Wegovy · Rybelsus"). É por ela que a
  medicação é procurada — quem atende ouve "Ozempic", não "semaglutida". Trava: 45 de 45 fármacos têm marca.
- Nome do fármaco em **16px/700** (o h4 do DS) nas duas listas — era 14px/600 e o dono pediu mais destaque.
- Grupo com UMA variante presente (a busca estreitou) exibe o nome COMPLETO do fármaco: "Enoxaparina" ali
  esconderia qual das duas doses é o resultado.
- A tela do grupo sai da base COMPLETA, não do resultado da busca — quem pediu a medicação quer ver todas as
  apresentações dela. E o voltar do DETALHE devolve à tela do grupo quando foi por ela que se chegou.
- Travas: `agrupamentoFarmacos.test.js` (19), incluindo "não perde nem duplica fármaco" nas duas bases e
  "variantes do mesmo grupo ficam na MESMA classe" (senão o cartão apareceria duas vezes). ⚠️ um teste MUDOU DE
  LADO com o porquê no corpo, em vez de sumir: o que exigia a contagem no badge.

⚠️ **`Badge variant="secondary"` é CINZA (#6B7280), não verde — o verde institucional do DS é o `default`**
(#004225 no claro, #2ECC71 no escuro; `src/styles/anest-theme.css`). Foi o que deixou os badges das duas listas
"quase invisíveis" (dono 25/08) e o que faz `info` (#007AFF) parecer fora do padrão. Vale para o app inteiro:
badge neutro-mas-visível é `default badgeStyle="subtle"`, não `secondary`.

**Legibilidade da lista e dos reversores (dono 25/08, mesma rodada):**
- **Título da classe** ("HEPARINAS", "AGONISTAS DO RECEPTOR GLP-1") era 11px/600 em `muted-foreground` — o MESMO
  peso dos rótulos DENTRO dos cartões, então não separava nada e sumia no meio deles. Agora 13px/700 em
  `foreground`, com barrinha do verde institucional à esquerda e respiro acima: o olho acha a divisão antes de
  ler o texto.
- **Badge do reversor** era `info` (azul) com só o número — "1–2 h" do quê? Virou `default` (verde) com o rótulo
  DENTRO: "Início 1–2 h". ⚠️ o `inicio` do plasma fresco ("30 min a horas") passou a **"≥ 30 min"** porque
  "Início 30 min a horas" estouraria a linha do cabeçalho do card — mesma classe de problema do `resumo` dos
  anticoagulantes: badge é `whitespace-nowrap` e não encolhe.
- **Sanfona "Como usar, riscos e disponibilidade"** eram bullets seguidos de duas linhas soltas com o rótulo
  embutido no meio da frase ("Riscos: ...", "No Brasil: ..."). Viraram **três assuntos rotulados** — Como usar ·
  Riscos · Disponibilidade no Brasil — com o mesmo rótulo 11px/600 do "DOSE" do cabeçalho.

**As regras vivem no PRÓPRIO fármaco (dono 25/08):** *"quero que sempre coloque as regras, para evitar ficar
procurando em outros fármacos (pode manter a informação: mesma dose que X...)"*. Dalteparina e nadroparina só
diziam "mesmas regras da enoxaparina" e paravam aí — quem estava com o paciente na frente saía da tela para achar
o número. Hoje o alerta traz as quatro janelas por dose E mantém a referência. Trava em
`anticoagulantes.test.js`; ⚠️ a 1ª versão dela usava `/4 h/`, que casa DENTRO de "24 h" e passaria no texto
antigo — hoje é `/\b4 h depois de retirar/`, conferido reprovando o texto antigo nas 4 asserções antes de entrar.

**O motivo da suspensão diz o número que o sustenta:** "Longa duração." sozinho não explica nada a quem lê no
corredor — o que decide a regra dos 7 dias é a MEIA-VIDA, e era ela que ficava de fora (dono 25/08, sobre a
tirzepatida: "deixe essa informação mais clara"). Os 8 GLP-1/coagonistas passaram a abrir com ela
("Meia-vida de ~5 dias, então entra na regra dos 7 dias..."), travado por invariante.

**Bloco "Suspensão" do detalhe (inibidores):** o intervalo é HERÓI em linha própria, 24px/700. Antes dividia a
linha com o rótulo "Intervalo desta conduta" e ficava espremido à direita, com a referência quebrando AO LADO do
badge e virando um bloco ragged — foi o *"informações amontoadas"* do dono. `fonteSuspensao.detalhe` ganhou teto
de 48 caracteres (invariante em teste) e a explicação de escopo vive uma vez só, no rodapé da aba.

⚠️ **`TabsContent` do DS DESMONTA o painel inativo — estado local dentro de uma aba MORRE na troca.** Vale para o
app inteiro. Nos dois cards de consulta isso apagava, em silêncio, o fármaco aberto E os dados do paciente
digitados: nos Inibidores, os 17 fatores marcados + data/hora da última dose + toggle do POCUS; nos
Anticoagulantes, ClCr, idade, plaquetas, RNI e a última dose (medido: RNI 2,5 digitado, perdido ao ir em
"Cateter" e voltar). Correção: o estado subiu para o componente RAIZ (`useEstadoPreOp` / `useEstadoBloqueio`),
que não desmonta. `painelAberto` fica de fora de propósito — folha aberta não deve sobreviver a troca de aba.

⚠️ **Dentro de um fármaco, a barra de abas SOME nos dois cards** (dono 26/08, sobre os Inibidores: "ao abrir um
medicamento os seletores acima podem confundir o usuário"). Encostada num cartão intitulado "Liraglutida", ela
lia como sub-abas DAQUELE remédio — "Liraglutida: Pré-op / No dia / Referência" — em vez de abas da página. A
imersão é **derivada** (`Boolean(farmacoId || grupoId)`), não avisada por callback, e fecha de quebra o único
caminho de sair do fármaco por engano: resta o "← Todos os fármacos", que é explícito. ⚠️ voltando de um fármaco
alcançado pela tela do GRUPO, o botão diz o nome do grupo, não "Todos os fármacos" — são dois passos de volta.
Aplicado também aos Anticoagulantes porque é o MESMO defeito, confirmado por medição, e perder dado de paciente
digitado é bug, não estilo.

**Três limites do DS descobertos aqui, que valem para o app inteiro:**
- ⚠️ `DatePicker` abre o popup como `absolute z-50` **sem portal** (`date-picker.jsx:434`), e `AccordionContent`
  (e `CollapsibleContent`) animam altura com `overflow-hidden` — calendário dentro de sanfona sai **cortado no
  meio do mês**. Onde precisar dos dois, usar `Sheet`.
- ⚠️ `TabsList` traz `w-full`: largura fixa em 100% do pai **ignora margem negativa**. A barra ficava 16px mais
  estreita que os cards e deslocada 8px à esquerda — lia-se como "seletores não centralizados". Com margem
  negativa, passar `w-auto` junto. E `flex` respeita o `min-width:auto` de cada rótulo (larguras desiguais):
  `grid grid-cols-4` iguala, mas aí o `px-3` do gatilho não cabe mais — `px-1`.
- ⚠️ `Alert` põe o ícone numa **coluna à esquerda**, centrado na vertical: em alerta longo ele flutua no meio e
  rouba ~24px de largura de TODAS as linhas. Ícone dentro do `title` + colapsar a coluna resolve. **O mesmo
  padrão estava no `InfoBox` do CalculatorShowcase e foi corrigido para TODAS as calculadoras (dono 25/08)** —
  o texto recuava 48px e agora recua 17px.

**Critérios UTI** (feature separada): `src/data/criteriosUtiCalculators.js` + `src/pages/CriteriosUTIPage.jsx`
7 calculadoras (SORT, ESS, POTTER, SAS, SIAARTI, P-POSSUM, CFM 2156) em 4 categorias (Pré-op / Intra-op / Composto / Regulatório).

## Notificações e Denúncias (ex-"Gestão de Incidentes")
**Renomeado 2026-08-19 (dono): "a equipe não achava"** — quem quer notificar um evento adverso não procura por "Gestão de Incidentes". Trocado nas 6 superfícies de ENTRADA: card da GestaoPage, `PageHeader` da IncidentesPage, `AppCommandPalette` (rótulo + 11 termos: denúncia/denunciar/near miss/relato/assédio/…), `atalhosConfig`, `rolePermissionTemplates` e `useActivityTracking`. **Rota, IDs e chave de permissão continuam `incidentes`** — mudar quebra link salvo e permissão concedida sem ganho para quem usa. **ROP 1.2 do Qmentum, RIPD e política de privacidade mantêm o nome oficial** ("Gestão de Incidentes sobre a Segurança dos Pacientes"): são artefatos de conformidade, não navegação.

**Destaque visual — `ComunicadosCard variant="solid"`** (dono 19/08, escolhido em protótipo antes do código): o nome era só metade do problema; a outra era o cartão ser o 1º de TRÊS visualmente idênticos na aba. Solid = `bg-gradient-to-br from-greenMedium to-greenBright` + texto branco + badge branco, **a MESMA tinta nos dois temas de propósito**. ⚠️ a tentação de escurecer o gradiente no dark (`greenDark→greenDarkest`, que é o que o banner da IncidentesPage faz) foi testada e REPROVADA: em L do HSL o cartão ficaria 12,9%→6,7% contra vizinhos de 12,2% e fundo de 8,2% — começa na clareza dos vizinhos e termina mais escuro que a página, então não tem contraste de massa em ponto nenhum e some. A tinta escolhida fica em L 20→36%. É o ÚNICO cartão pintado da aba; pintar um segundo devolve o problema.

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
Acompanhamento de cateteres peridurais por hospital (Unimed/HRO): inserção → evolução PO diária (Bromage 0-3, nível sensitivo, taxa de infusão) → retirada com motivo. Dois eixos de alerta: **duração** (warning 72h / crítico 96h desde a inserção) e **não evoluído** (warning 36h / crítico 42h sem evolução; `getEvolucaoAlertLevel`). Tempo "desde a última evolução" aparece como linha no card E no detalhe (logo abaixo do tempo de atividade) + badge no card quando em alerta; o texto NÃO faz fallback p/ inserção (mostra "Sem evolução registrada" se nunca evoluído), mas o nível de alerta SIM. `dia_po` é DERIVADO da `data_avaliacao` (não sequencial; mesmo dia = PO0; N avaliações/dia).

- Tabelas: `cateteres_peridural` (+ `ultima_avaliacao_at`, mantida por trigger; **na publicação `supabase_realtime` só desde `20260808120000`** — o context assinava a tabela desde sempre, era código morto, e o cliente nunca via o UPDATE do trigger: por isso o badge "sem evolução" persistia depois de evoluir e só sumia ao recarregar. O context também espelha o trigger localmente em `TOUCH_ULTIMA_AVALIACAO`) + `cateteres_peridural_followup` (`data_avaliacao`; SEM UNIQUE) — migrations 027/028 + 20260627200000 (RLS) + 100000 (admin write)/110000 (data_avaliacao)/120000 (residente)/130000 (notif)/140000 (ultima_avaliacao)/150000 (cron)/160000 (admins)
- Páginas: `src/pages/cateter-peridural/` (listagem header `PageHeader`+lupa, NovoCateterPage, CateterDetalhePage)
- Context/Service: `src/contexts/CateterPeridualContext.jsx` + `src/services/supabaseCateterPeridualService.js` — ⚠️ typo histórico "Peridual" nos filenames/símbolos; manter, não renomear. ⚠️ toda coluna nova lida no front precisa entrar em `CAMEL_TO_SNAKE` (gera o reverso): faltou `ultima_avaliacao_at` e `cateter.ultimaAvaliacaoAt` ficava `undefined` em silêncio → alerta de evolução contava desde a inserção (fix deefbaa). Libs puras: `src/lib/cateterPo.js` (computeDiaPo) + `src/lib/cateterIndicadores.js`
- Config: `src/data/cateterPeridualConfig.js` (BROMAGE_SCALE, MAX_DURATION_HOURS=96, `getAlertLevel`/`getEvolucaoAlertLevel`/`calcHorasSemAvaliacao`/`formatDuracaoHoras`)
- **Notificações: SÓ LEMBRETES (dono 30/07)** — os eventos novo/evolução/retirada NÃO notificam mais ninguém: triggers dropados (migration `20260730160000`) E chamadas client-side removidas das páginas (`cateterNotifications.js` deletado; havia 10.881 notifs acumuladas, ~98% não lidas — apagadas com backup). ⚠️ não recriar notificação de evento — se o trigger voltar sem o dedup, o insert do front (se reintroduzido) duplica. Ficam SÓ os lembretes clínicos (duração 72/96h + não-evoluído 36/42h) via **pg_cron** diário `notify_cateter_reminders()` (`20260628150000`, revisado em `20260808120000` e `20260822120000`; helpers `_cateter_reminder_insert` + `cateter_iniciais` mantidos). Recipients: anestesiologista/residente ativos **+ admins**. LGPD: só iniciais (`cateter_iniciais` SQL = `pacienteIniciais` JS). ⚠️ **o lembrete "registrar PO1/PO2" é gated por `max(dia_po)`** (migration `20260808120000`): antes decidia só pelo tempo desde a inserção e cobrava PO já evoluído — 56 pessoas receberam 3 avisos falsos em 06–08/08; 72/96h seguem SEM gate (é alerta de retirada, vale com o cateter em dia). O cron saiu de 07h BRT (antes da visita) para **17h BRT**. **RECALIBRAÇÃO 22/08 (`20260822120000`):** o warning de "não evoluído" subiu de 30h para **36h** — a distribuição real dos 55 intervalos entre evoluções (mediana 21,5h · p90 32,8h · máx 34,4h) tem 6 casos em 30–34h, **nenhum entre 34h e 42h** e 4 acima de 42h; o corte antigo acendia alerta em visita que ACONTECEU, e 36h fica no vale vazio sem perder atraso real. E cateter **nunca evoluído SAIU do eixo** (`ultima_avaliacao_at IS NOT NULL` no cron): a base virava a inserção e os DOIS eixos disparavam no mesmo run sobre o mesmo fato (11/08 e 18/08, 2×57 pessoas) — quem cobra esse caso é o PO1/PO2, que já tem gate. ⚠️ o CARD segue alertando aí (o nível cai no fallback da inserção de propósito): divergência intencional, documentada nos dois lados. Métrica que motivou a revisão: 507 notificações desde 08/08, **2,4% lidas** por 2 pessoas, e **9 dos 75 cateteres que passaram de 24h foram retirados sem NENHUMA evolução registrada** — o dono decidiu (22/08) MANTER os 57 destinatários e o texto "Retirar imediatamente" do 96h
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
| Escala Cirúrgica Diária | card no hub **EscalasPage** (Gestão→Escalas) → `src/pages/escala-cirurgica/` | Supabase `escala_cirurgica` + `escala_cirurgica_caso` + `escala_cirurgica_evento` (migrations `20260628200000` → `20260729210000`; RLS por `can_write_escala_cirurgica()` = clínico/técnico de enfermagem/secretária OU admin (migration `20260724100000`); realtime nas 2 tabelas + `escala_plantao_p4_diario`; `trocas_cirurgicas` existe no banco mas o app não lê mais) + Edge `parse-escala-cirurgica` (Claude Vision) + lib pura `src/lib/colunaLiberacao.js` | **LIBERADO AO GRUPO 2026-07-22** (piloto de 1 encerrado): gate `podeVerEscalaCirurgica(user)` em `escala-cirurgica/gate.js` agora por papel (clínico/técnico de enfermagem/secretária/admin — **escala COLABORATIVA**, técnicos incluídos 2026-07-24; espelha a RLS) em EscalasPage + rota App.jsx. Papéis com acesso = write E read (mesma função `can_write_escala_cirurgica`); o front tem **fonte única** em `gate.js` — `podeVerEscalaCirurgica` (com escape DEV) + `podeEditarEscalaCirurgica` (sem DEV, usado por página/BoardView/Importar) — ambas via `normalizeRole`, então cargo em alias legado ('medico'/'residente'/'tecnico_enfermagem') não cai mais em canEdit falso; mudar os slugs = mudar `PAPEIS_COM_ACESSO` + a RLS. Checklist de liberação executado: seeds APAGADAS + eventos de teste limpos + cron `escala-seed-rollover-daily` desligado; regressão visual PAUSADA (fixture era a seed-20 — `test.skip` no spec, aguarda nova fixture); aviso 18h segue só p/ o dono (trocar p/ secretaria/admin quando houver). **SEM NOTIFICAÇÕES (dono 30/07):** a escala não manda mensagem NENHUMA ao grupo — as 6 fontes do context (escalado ao publicar/liberado/sala encerrou/anestesista livre/assumiu-repassou caso/novo caso) foram REMOVIDAS (a inbox tinha 99 não lidas em 23 pessoas — ninguém lia; a tela realtime é a fonte); único aviso restante é o cron 18h ao dono; regressão travada nos testes de personas (notifyUsers nunca chamado). Se algum aviso voltar, que seja opt-in e agregado, não por evento. Mobile-first: data (`DatePicker` DS) + turno + hospital (Unimed/HRO/Materno) + **3 abas**. **Completa** (`BoardView`): cards por sala (`Accordion` com `iconAfterActions` — ⇆ antes do chevron), **status em 2 EIXOS** — principal pinta o card (agendada neutro / **Iniciada VERDE** / **Terminada AZUL info**) + extra em badge toggle que convive c/ agendada-iniciada, nunca c/ terminada (**Atrasada âmbar / Suspensa vermelho / Passa para tarde ROXO** `category-purple`; CHECK de invariante no banco, RPC `rpc_escala_status_cirurgia` FOR UPDATE). **O EXTRA MORA NO CANTO SUPERIOR DIREITO e o rótulo vem do TURNO (dono 20/08):** o badge é o ÚLTIMO elemento da 1ª linha do card, depois da caixa reservada do estado — antes ele vinha ANTES dela e, num caso agendado (caixa vazia), parava a 76px da borda, flutuando no meio do card; e `passaTurnoLabel` (`src/lib/escalaCirurgicaRegras.js`, puro) escreve **"Passa para tarde" de manhã e "Passa para noite" à tarde** — rótulo fixo nomeava, às 16h, um turno que já acabou (mesma mecânica do `plantaoLabel` da fila: a palavra vem do turno, nunca fixa na view). Vale nas 3 superfícies (card da Completa/Minhas, chip do `CasoDetalheSheet`, badge da linha em Liberações — lá pelo turno da TELA). ⚠️ o VALOR gravado continua `passa_tarde` nos dois turnos: está no CHECK de `escala_cirurgica_caso` e nas duas RPCs de publicação (migrations `20260720100000`/`20260721100000`), então um `passa_noite` custaria migration + reescrita de histórico para mudar só a palavra na tela — sheet 3×2 (extras desabilitados se terminada); tipo **Urgência/Emergência ambos VERMELHOS** (subtle/solid); convênio em **selo TONAL** (`bg-black/10`) no canto inferior direito (sem stripes); helper `familiaConvenio` (SUS/UNIMED/BRF/FAS/SC/CASSI/PARTICULAR/INTERCÂMBIO; dark = verde sólido); adicionar caso; **TROCAS APOSENTADAS (23/07, decisão do dono: 'muito complexo')** → `DefinirAnestesistaSheet` em 2 MODOS (⚠️ lição 23/07: o modo sala-inteira ACHATOU o IOSC p/ uma pessoa — `alvosTrocaResponsavel` decide os alvos e o update sala-wide NÃO EXISTE em nenhuma camada): header da sala = só os casos do responsável-BASE (+herdadas //; linhas com anestesista próprio ficam de fora e o sheet lista quem não muda); detalhe do caso = 'Anestesista deste caso' (caminho p/ IOSC/Exames/Umanitá). Select searchable do roster; terminados preservam quem fez; service `updateAnestesistaCasos(ids)`. Completa e Liberações derivam dos casos → mudam juntas. **TROCA REMOVIDA DE VEZ (dono 29/07)** — `TrocaSalaSheet`/`TrocaPendenteCard`/`supabaseTrocasCirurgicasService`/as 5 actions do context APAGADOS (tabela `trocas_cirurgicas` fica no banco); no lugar, campo livre de **Observação** na linha (ver Liberações). **TROCA DECLARADA (dono 30/07; reformada 07/08 — ver seção 'Reforma das trocas'):** par declarado pelo **TrocaSheet** (fluxo ÚNICO: tipo inferido + motivo) em `linha_overrides[turno:chave].trocaCom={uid,nome,tipo,motivo,por,em}` (⚠️ NUNCA chamar `troca` — nota legada colide) → badge **Troca** nos DOIS lados, inclusive entre hospitais (page deriva `paresTroca` das 3 escalas do context — registro único, sem dual-write) → execução de UM TOQUE em **swap SIMULTÂNEO** (decisão do dono): cada lado grava `assumidaPor={uid,nome}` no slot + transfere os casos não-terminados/não-"A+B" (helpers puros `planoExecucaoTroca`/`planoDesfazerTroca` em utils; `executarSubstituicao` no context com rollback LIFO — efeitos juntos ou nenhum; falha reverte + `loadData`). Na lib, `opts.assumidas` de `gerarColunaLiberacao` troca a IDENTIDADE do slot: `chave`/`nomeOriginal` NÃO mudam (marcações não órfãm), exibe/aponta/consome quem assumiu e o remove dos extras; regras POSICIONAIS (plantonista/contraturno) herdam; badge some após executar e a linha mostra "Assumiu a posição de X"; desfazer devolve casos + limpa `assumidaPor` (trocaCom NÃO renasce). `ordem_liberacao` INTOCADA por todos os caminhos novos. ⚠️ `trocaCom`/`assumidaPor` SOBREVIVEM a setLinhaOverride/Restaurar automático/toggleLiberacao/toggleEscalado — são identidade do slot, não ajuste de exibição (apagá-las devolveria o slot ao dono antigo em silêncio). `DefinirAnestesistaSheet` ganhou toggle "Assumir também a posição de X" (1 lado, mesmo motor — cobre assunção SEM troca declarada). Republicação conflituosa (casos re-importados no nome do dono): slot segue assumido e os casos do dono reaparecem como extra `chave#casos` (nunca somem em silêncio). Ações de troca no demo operam EM MEMÓRIA (base do e2e `escala-cirurgica-troca.spec.ts`, fluxo completo Giovana↔Maurício a 375px). Rastro: migration `20260730200000` (evento tipo `troca`, `motivo=manual|reset_publicacao`, aplicada 30/07). Desmarcar: qualquer canEdit. **Liberações** (`LiberacoesView`): coluna das 18 regras, cards verde=pills do seletor (`bg-primary/10`)/amarelo próximo/vermelho liberado; badge Plantonista sólido ao lado do nome (linha full-width; cronômetro na 2ª linha); sala sob o cirurgião; **cronômetro em pill `bg-primary` 100% MANUAL (23/07: nasce em branco; estimativa automática removida — '+8h53' sem sentido)** + sheet "Tempo faltante" (atalhos 15min–3h + hora exata em Select DS 15/15min); liberado = card enxuto (nome+badge+lápis); **desfazer liberação = linha RENOVADA** (`renovado` no override — zera e suprime derivados até preencher). **Painel da linha (29/07; ENXUTO 31/07):** os CASOS da pessoa SAÍRAM do painel (dono 31/07: poluía — cirurgia se vê/edita nas abas Completa e Minhas, e é LÁ que se informa o tempo de cada cirurgia e o residente; `casosObjDaLinha`/`CasoCard`/`CasoDetalheSheet` removidos da LiberacoesView); ficou só o que é da LINHA: `PainelTempo` ÚNICO (`PainelTempo.jsx`, compartilhado com o detalhe do caso; o input de hora nativo saiu), "Automático (dos casos)" ao lado de local/cirurgião, toggle de **Ajuda** e o campo de **Observação**; cronômetro some quando a linha está **Livre**. ⚠️ `linhas` de `gerarColunaLiberacao` é ordem de EXIBIÇÃO (extras `isExtra` + ajudas + plantão-do-turno-seguinte no fim) — **NUNCA** gravar `ordem_liberacao` a partir dela (foi assim que a substituição reordenou o rodapé em 29/07; hoje NADA nesta aba escreve a ordem, travado em `liberacoesPainelLinha.test.jsx`). ⚠️ dispatch otimista usa **`PATCH_HOSPITAL`** (merge sobre o estado atual): `{...escala, X}` com o `escala` do closure fazia cada escrita da sequência REVERTER a anterior. `setLinhaOverride`: `override === null` = restaurar explícito (limpa flags); objeto com campos vazios preserva `renovado` (salvar sem preencher apagava a linha renovada) — e todo caminho que grava override PARCIAL (ex. `definirTempo`) tem de reenviar os demais campos, senão os apaga. **PLANTÃO DO TURNO SEGUINTE (dono 29/07, ampliado na tarde):** o ÚLTIMO nome do rodapé, quando está ESCALADO, é o plantonista do turno seguinte e sai PRIMEIRO — **vale MESMO EM AZUL** (regra POSICIONAL; correção 30/07: o azul era desviado p/ `linhasAjuda` antes da conta, então o cálculo pegava o último NÃO-azul e o HRO marcou JANAÍNA no lugar de FERNANDO, que fechava o rodapé; quem é os dois carrega os DOIS selos) — vai p/ o FIM da lista, **abaixo até das ajudas** (`isProximoPlantao` em `gerarColunaLiberacao`, badge verde sólido). Vale nos **DOIS turnos**, e o RÓTULO vem da lib (`plantaoLabel`: matutino → "Plantão da tarde", vespertino → "Plantão da manhã") — nunca fixo na view. Sem turno informado (chamada legada) não dispara; último nome SEM casos segue nascendo liberado. Não disputa com os P1–P4 da fase noturna (aqueles vêm do card Plantões e assumem o TOPO). Ordem final da cauda (31/07): …fila → ajudas SEM origem conhecida (ordem do array `ajuda_externa`) → VISITANTES de outro hospital (ordem do rodapé de ORIGEM via `opts.rodapeOutros` — índice maior lá = libera primeiro aqui; setas de reordenar desligadas neles) → plantão do turno seguinte. Visitante = (caso OU entrada em `ajuda_externa`) + nome no rodapé de outra escala carregada; sala compartilhada "A + B" conta presença dos DOIS no cruzamento (sem isso o Melo emprestado caiu pro fim do HRO em 31/07). **Visitante sobrevive ao REPASSE (31/07 tarde, caso Leonardo→Tiago; RESTRITO 19/08):** repassar o último caso de quem veio de OUTRO hospital grava o nome dele em `ajuda_externa[turno]` (`ajudasPreservadasNoRepasse` puro em utils, chamado por `setAnestesistaCasos`) — a linha segue liberável; com origem conhecida não nasce 'não escalado'. ⚠️ Desde 19/08 (dono, swap Guilherme⇄Diego): SÓ preserva quem é COMPROVADAMENTE de outro hospital (`opts.outrasEscalas` — rodapé do turno lá ou, sem rodapé como no Materno, caso do turno em nome dele); colega do MESMO hospital troca só os procedimentos, NUNCA vira ajuda. E o matching é por IDENTIDADE (`opts.resolverUid` + uid do caso; grafia sem espaços é fallback) — texto contra texto marcou o dono como 'ajuda' quando a Vision escreveu 'GUILHERME M ELO' e o rodapé dizia 'GUILHERME MELO'. E quem é do RODAPÉ e fica sem caso no repasse ganha AUTOMATICAMENTE o marcador `{escalado:true}` do toggle manual (`escaladosPreservadosNoRepasse`, mesmo scan) — sem ele a linha cai em 'sem caso', SAI da fila (o `naFila` a pula) e deixa de aguardar a vez: quem trabalhou o dia todo some da ordem sem ninguém liberar ('a pessoa acaba os casos e aparece liberado', dono 19/08 — na época o sem-caso ainda nascia vermelho; a liberação é manual e NA ORDEM). A chave do marcador vem do nome DO RODAPÉ (uid do vínculo, senão nome normalizado) — a grafia do caso diverge. **REGRA FECHADA (dono 20/08): NINGUÉM NASCE LIBERADO — o vermelho é SÓ do toque humano.** `liberado = liberadoReal`, ponto; quem está sem caso mostra **"Livre"** e AGUARDA na própria posição (o `naFila` a pula, então ela não trava o "próximo" de ninguém). Três situações caem no mesmo "Livre": nunca escalado desde a publicação · terminou todos os casos · ficou sem caso num REPASSE (aqui com o `{escalado:true}` que o próprio repasse grava, que a mantém ATIVA na fila em vez de Livre). `liberadoEm` só nasce do toggle manual, na ordem. ⚠️ **ISTO JÁ FOI REVERTIDO UMA VEZ E O SINTOMA VOLTOU EM 24h** — o commit 7545ef3 (19/08 21:59) implantou "ninguém nasce Liberado" e o 2154201 (22:08, último da noite) o desfez para atender "mantenha a configuração de sair na ordem de liberação como liberado"; no dia seguinte, 47s depois da publicação da tarde da Unimed, o Eduardo (5º de 15, sem cirurgia porque tinha trocado com a Raquel) nasceu vermelho no MEIO da fila e a equipe leu como liberação fora de ordem. A frase da 5ª mensagem NÃO pede vermelho automático — pede que a pessoa **continue na ordem**, e é o "Livre" na própria posição que faz isso. Nenhum teste pegou a volta porque a suíte foi reescrita no MESMO commit do revert: a trava morreu junto com o comportamento. Daí o describe de hoje ser um **invariante** ("NINGUÉM nasce Liberado", com o recorte real de 20/08), não uma persona. Travas: `escalaOrdemLiberacaoImutavel.test.jsx` (nenhuma action escreve a ordem; repasse não libera) + describe "Liberações — NINGUÉM nasce Liberado (invariante, dono 20/08)" em `escalaCirurgicaPersonas.test.jsx`. ⚠️ republicar um turno ZERA `liberacoes`/`linha_overrides` daquele turno (por desenho da RPC): a marcação feita à mão antes da republicação se perde — foi o que obrigou o dono a remarcar o Eduardo às 13:10 depois de já ter corrigido às 12:44. **O CÍRCULO DA FILA SEMPRE LIBERA (dono 20/08, mesmo dia, 2º relato):** naquela mesma tarde ele tocou **16 vezes** no círculo da Thayna — último nome do rodapé vespertino, "Plantão da manhã", sem cirurgia — e ela só alternava entre "Livre" e "Próximo a ser liberado", sem nunca ser liberada. Causa: naquela linha o círculo não era o botão de liberar, era um toggle de `{escalado:true}` (criado em 19/08 como escape do vermelho automático); com o vermelho automático extinto na manhã seguinte, o toggle virou pura armadilha — mesmo controle, dois significados. Agora `onClick` é sempre `toggle(...)`; o marcador `escalado` continua existindo, mas **só o REPASSE o grava** (`escaladosPreservadosNoRepasse`) e ele **não tem mais entrada na UI** (`toggleEscalado` segue no context como escritor canônico — se voltar a ter botão, que NÃO seja o mesmo do liberar). Dois defeitos irmãos saíram junto: (a) `toggleLiberacao` lia QUALQUER entrada do mapa como "já liberado", então liberar por cima do marcador do repasse **apagava o marcador** e anunciava sucesso — o mapa `liberacoes` guarda duas coisas na mesma chave e agora a liberação sobrescreve o marcador (`entradaAtual.escalado !== true`); (b) o bloqueio de ordem era isentado por `semEscala`, o que deixava quem tinha o marcador do repasse **furar a fila** — hoje o predicado é só o `naFila`, que já distingue quem ocupa posição de quem não ocupa. Consequência boa e intencional: quem está sem caso **não é "próximo a ser liberado" de ninguém** (fora da fila) e mesmo assim pode ser liberado a qualquer momento, com um toque. Travas: 3 casos novos no describe do invariante + "liberar por cima do marcador do repasse LIBERA" em `escalaOrdemLiberacaoImutavel.test.jsx`. **CONVOCAR TAMBÉM SEGUE A ORDEM (dono 20/08, 3º relato):** "assim como não é possível liberar colegas fora da ordem, quero que não seja possível convocar outro colega (em vermelho) fora da ordem". Desfazer a liberação é DEVOLVER a pessoa à fila, e devolver a errada fura a ordem pelo outro lado — a convocada vira o "próximo" e passa na frente de quem, na ordem, saiu depois dela. Como a fila sai de baixo p/ cima, ela volta de **cima p/ baixo**: o próximo a convocar é o liberado MAIS PRÓXIMO de quem ainda está em sala (`idxConvocar` = 1º liberado depois do `idxProximo`), e tocar em qualquer outro mostra "Convoque X primeiro" em vez de desfazer — mesmo desenho do bloqueio de liberar (toast âmbar, 12s). ⚠️ **quem nunca esteve na fila fica fora dos dois sentidos**: liberado SEM caso não conta como `idxConvocar` nem é bloqueado (o vermelho ali é registro de que a pessoa não está em jogo, não posição cedida), e liberado ACIMA do `idxProximo` também não bloqueia — voltar lá em cima não muda quem é o próximo. Isso substitui o "desfazer liberação NUNCA é bloqueado pela ordem" de 27/07. Travas: 4 casos em `escalaCirurgicaPersonas.test.jsx` (convocar fora da ordem não desfaz · o próximo desfaz · o aviso nomeia quem volta antes · sem-caso nunca bloqueia). **VERMELHO AUTOMÁTICO SÓ NA CAUDA (dono 21/08 — fecho das três queixas):** "os últimos usuários da lista de liberação que não estiverem com procedimento cirúrgico no momento de importação da escala aparecem como LIBERADOS (vermelho)", não verdes com o badge Livre. As duas metades da regra vêm de sintomas opostos e convivem: no **MEIO** da fila ninguém nasce vermelho (20/08 — a equipe lê como liberação fora de ordem); na **CAUDA** nasce, porque quem fecha a lista sem cirurgia nenhuma não está em jogo. ⚠️ **a fronteira é o ÚLTIMO NOME COM TRABALHO NA IMPORTAÇÃO** (`idxUltimoTrabalho`, varredura de baixo p/ cima por `naoEscalado`), **não o `idxProximo`**: amarrar à fila faria a linha do MEIO virar vermelha sozinha conforme os de baixo fossem liberados — decisão automática de novo, exatamente o que não pode acontecer. **O círculo é um CHECKBOX de "está liberada"** e marcado/desmarcado espelha o vermelho em toda linha; só a GRAVAÇÃO muda: linha comum grava `liberadoEm`, linha da cauda (já nasce marcada) desmarca gravando `{escalado:true}` — que é o `toggleEscalado`, de volta à UI só para isso. O que não pode voltar é o círculo VAZIO alternando um flag escondido (bug de 20/08). Travas: describe "vermelho automático SÓ na cauda" com o recorte real de 21/08 (Rafael · Daniela · Alexandre Danieli vermelhos, Alexandre Schmidt próximo) + caso Thayna. **Azul do NOSSO rodapé sem caso aqui MANTÉM a posição** (gente nossa emprestada; só desce ao fim quem tem caso AQUI — regra TIAGO intacta; plantonista = 1º NÃO-azul). **Badge de contraturno SEMPRE** no último nome do rodapé, mesmo sem caso. **`DefinirAnestesistaSheet` modo SALA opera SÓ no turno exibido** (prop `turno`; sem ela o 'Responsável atual' vinha da MANHÃ e o repasse alcançaria caso do outro turno). **Nota de local no rodapé** — "MATHEUS (CONSULT)": parêntese no fim do nome NÃO é identidade (strip em `norm`/`normNome`/`resolveKey`; virava 2 linhas da mesma pessoa) e vira rótulo de local no card (`notaRodape`, "CONSULT"→Consultório). **ORDEM IMUTÁVEL + liberação SÓ NA ORDEM (dono 27/07):** as setas ↑↓ SAÍRAM da tela para todos (nem o plantonista reordena — a ordem vale como veio no rodapé; mudar = republicar a escala; `onReorder` removido da view e da página; com a substituição fora (29/07), `reordenarLiberacao` no context não tem mais chamador na UI) e tocar em quem NÃO é o `idxProximo` mostra toast âmbar "Libere na ordem — ainda há N antes; o próximo é X" em vez de liberar (`bloqueioOrdem`; predicado `naFila` é o mesmo do idxProximo). NUNCA bloqueiam: desfazer liberação, "não escalado" (`onToggleEscalado`) e P1/P2 noturnos (fora da fila por regra do dono). **A EXIBIÇÃO TAMBÉM SEGUE O RODAPÉ (dono 11/08, reforço da mesma regra):** liberado NÃO afunda mais para o fim — fica na própria posição, riscado e com o selo Liberado. O afundamento antigo fazia a fila parecer publicada fora de ordem (11/08: o João Ricardo, 11º no rodapé, apareceu em 13º por ter nascido liberado sem cirurgia, e a leitura foi "inseriram o rodapé errado"). Só saem da ordem quem a regra manda: plantão noturno no topo; extras/ajudas/plantão-do-turno-seguinte no fim, posicionados pela própria lib. **RESIDENTE POR CASO (dono 29/07):** `useRosterAnestesistas` devolve SÓ `anestesiologista` (residente não responde pelo caso — misturado no seletor dava p/ escalá-lo como responsável); residentes têm roster próprio `useRosterResidentes` (sem apelidos — identidade sempre pelo uid do seletor; cadastrados só com o PRIMEIRO NOME e está CERTO assim, não completar). Colunas `residente`/`residente_user_id` (migration `20260729200000`): seletor no `CasoDetalheSheet` (serve Completa + Minhas + painel da linha) e no `AddCasoSheet`, nome no `CasoCard`, e a aba **Minhas** do residente casa também por `residenteUserId`. A coluna de liberação segue derivando SÓ do anestesista. **OBSERVAÇÃO da linha (dono 29/07, no lugar da troca):** texto livre em `linha_overrides[chave].observacao` (teto `OBSERVACAO_MAX`=120), exibido no card da fila abaixo do local; nota `troca` de escala ANTIGA é renderizada como observação (não some, não quebra). LGPD: o painel avisa que é recado operacional e que paciente só entra por iniciais. Com a substituição saiu a única leitura de "sou o plantonista?" → `meuUid`/`meuAlias`/`podeGerenciar` saíram das props da LiberacoesView. **AJUDA MANUAL nas 2 abas (dono 29/07):** toggle no painel da linha e no detalhe do caso (escolhido o detalhe, não o header da sala: a linha de 44px a 375px já tem sala+nome+⚙+chevron). Fonte única `ajudaExterna[turno]` → reflete na outra aba na hora; remover usa a entrada EXATA do array (casada pela chave resolvida, nunca pelo nome exibido) e adicionar entra no FIM (a ÚLTIMA ajuda sai primeiro). **TEMPO POR CIRURGIA (dono 29/07):** `termino_previsto` no caso (migration `20260729210000`, "HH:MM", CHECK de formato), preenchível pelas 2 abas via `CasoDetalheSheet`; na fila vira chip CINZA pequeno ao lado do cirurgião a que pertence (`linha.tokenTermino[token]`, o término MAIS PRÓXIMO quando o token tem 2 casos) enquanto a pílula VERDE sólida segue sendo o total da PESSOA — pesos diferentes de propósito. ⚠️ **o total NUNCA é a soma dos casos** (estimativa que estoura não converge p/ zero — Dexter et al., Anesth Analg; somar acumula o erro). `PainelTempo.jsx` = fonte única da UI de tempo. **ESPELHO do tempo total (31/07):** gravar o término da cirurgia quando a pessoa tem UMA só cirurgia ATIVA no turno preenche sozinho o cronômetro da linha (`espelhoTempoTotal` puro em utils → `setLinhaOverride` no `CasoDetalheSheet`; limpa junto; com 2+ casos, sala "A+B", sem anestesista ou posição assumida NÃO espelha — total segue 100% manual). `CasoCard` recebe `agoraMin` do PAI (um intervalo por lista, nunca um timer por card). **Log de eventos invisível** `escala_cirurgica_evento` (Fase 0 da previsão de tempos): triggers status (2 eixos) + liberações c/ snapshot da ordem — NUNCA bloqueia operação clínica. ⚠️ coluna nova lida no front → `CAMEL_TO_SNAKE` do service (`statusExtra` incluso). ⚠️ INTEGRIDADE (lição 22/07): `liberacoes`/`linha_overrides` são gravados pela CHAVE ESTÁVEL da linha (`linha.chave` = uid do vínculo ou nome normalizado, fallback de leitura no display legado) e reordenação persiste `linha.nomeOriginal` — NUNCA gravar o nome exibido (muda com vínculos → marcações órfãs + rodapé duplicado, reparado em prod). Secret `ANTHROPIC_API_KEY` (dono). **Roadmap:** previsão de términos por cirurgião×procedimento (dados já coletando), sugestão de alocação respeitando ordem de liberação, ponte financeira (guia→Conta Azul). **Identidade (Fase 2.1, 2026-07-21):** dicionário `escala_anestesista_alias` populado (54 apelidos→47 pessoas, confirmados pelo dono; regra: 1º nome sozinho c/ >1 candidato → SEMPRE perguntar); coluna de liberação agrupa por vínculo (`resolverUid`+`anestesista_user_id` — fix do "próximo a ser liberado depois dos liberados") e exibe **nome com diferencial** (apelido só-1º-nome → "Gustavo Biesdorf" via `nomeExibicao`); badge **Ajuda azul sólido**; importação escolhe o hospital da escala + edge devolve `hospitalDetectado` (sugere, nunca troca sozinha); **conferência (fix 23/07):** o login escolhido no Select VENCE o texto importado no display publicado e o aprendizado de apelido só ocorre p/ apelido DESCONHECIDO (reatribuição não ensina A→B; dicionário tinha JANAINA→Cury desde a povoação, corrigido em prod); **conferência POR ANESTESISTA (27/07):** sala/bloco com >1 anestesista (IOSC/Exames/Umanitá/seções de outro hospital) rende **UM BLOCO POR ANESTESISTA** — cada um com os seus casos, os seus cirurgiões e o seu Select (espelha `gruposExibicao` do BoardView). Em `utils`: `nomesImportados` (herança "//"/vazia resolvida por sala) → `chavesAnestesista` (chave = sala, ou `sala|NOME`) → `gruposAnestesista`; `aplicarAtribuicoes` e o aprendizado apelido→login passaram a ser POR GRUPO (a regra de "nome próprio" saiu — o split cobre o mesmo). ⚠️ a chave só é estável porque a importação CARIMBA `anestesistaImportado` na linha (campo só desta tela, fora do `CASO_FIELDS`): sem ele atribuir troca o texto e dissolve o bloco no meio da conferência; linha adicionada à mão entra no bloco-BASE para não repartir a sala e apagar atribuição já escolhida. ⚠️ o texto da SALA alimenta a key do bloco → o campo Sala grava no BLUR (`CampoSala`, 31/07): gravar por tecla remontava o bloco e o input perdia o foco (1 letra por vez); "+ Linha" e o commit abrem o bloco de destino. **Sem anestesista NÃO herda o de cima (31/07):** o split do BoardView decide pela FLAG `semAnestesista` (não só pelo texto — '' era absorvido pelo colega da sala pós-publicação), `aplicarAtribuicoes` normaliza ''→'?', o guardrail da edge seta `sem_anestesista=true` ao apagar nome fora do rodapé (edge precisa de re-deploy) e `AddCasoSheet` sem seleção grava '?'+flag. Cobertura: `src/__tests__/pages/importarEscalaConferencia.test.jsx` (Vision mockada, fluxo real da página). Lições Vision 23/07 (no prompt): **AMARELO = anestesista em 2 locais de propósito** (manter nas duas linhas), C.O da Unimed NUNCA é bloco materno (2ª reincidência), anestesista SEMPRE da célula da própria linha (proibido propagar p/ linhas com nome próprio ou inventar), **seções de outros hospitais no HRO (IOSC/HO/Digimax/…) têm anestesista POR LINHA** (3 linhas do IOSC saíram p/ um só e 2 anestesistas SUMIRAM), **rodapé vermelho = ordem de liberação SAGRADA** (todos os nomes, ordem exata; guardrail na conferência avisa nome da ordem sem caso entre escalados). Na conferência o rodapé é uma **LISTA NUMERADA** (`resumirRodape` puro em utils, dono 11/08 "difícil de analisar"): uma linha por posição com nº, papel posicional (1º plantonista / último sai 1º), selo de ajuda e **quantos casos a pessoa tem no lote** — zero casos é o detector da extração torta, e o aviso âmbar ficou só com o porquê (o nome já vai marcado na posição). Dupla `"A + B"` conta para as DUAS. **O campo de texto do rodapé SAIU (dono 11/08):** a lista é a única superfície e é EDITÁVEL na própria posição (corrigir o texto · Subir/Descer · marcar **Ajuda** · Remover) — a conferência é a transcrição da FOTO e o último ponto em que dá para consertar o que a Vision leu torto; **nada disso alcança escala publicada** (lá a fila segue imutável, mudar = republicar). Plantonista/"sai 1º" **não têm botão** — são da POSIÇÃO, muda-se movendo o nome; o único selo com botão é o de **ajuda**, que é o que mais falha na extração (30/07, o azul não reconhecido) e grava no mesmo `ajudaTexto` do campo abaixo. **Acrescentar é por LOGIN** (Select do roster; texto livre criava a mesma pessoa 2× na fila) e insere o **apelido do dicionário** — mesmo texto do "Preencher da atribuição", senão rodapé e casos caem em identidades diferentes; quem já está no rodapé sai da lista. `ordemTexto` continua a fonte da verdade (os controles reescrevem a string, então publicar/cruzamento não mudam). **DOIS ANESTESISTAS (dono 11/08):** card único SÓ quando é a MESMA cirurgia — a célula traz os dois e o prompt manda devolver `"NOME1 + NOME2"` (nunca escolher um, nunca partir em dois casos); `aplicarAtribuicoes` preserva o texto com `+` e não deixa um login escolhido apagar a colega (uid fica null; a fila conta presença dos dois e transferência nenhuma mexe em sala compartilhada). Marcar À MÃO: `DefinirAnestesistaSheet` no modo CASO tem "Segundo anestesista (mesma cirurgia)" → grava `{uid:null, apelido:'A + B', dupla:true}`; ⚠️ o `dupla` é o que impede o service de traduzir uid null em `'?' + sem_anestesista` (a cirurgia cairia no alerta). `anestesistaDoCasoEh` (utils) é a identidade única de "esse caso é meu" nas abas Completa e Minhas — sem ela a dupla sumia da Minhas DAS DUAS. O toggle de assumir posição não aparece com dupla (não há um slot único a assumir). Sala com anestesistas DIFERENTES em cirurgias diferentes segue com **um bloco por anestesista** (regra 27/07, nascida do IOSC) — foi o caso da CC - Sala 2 em 11/08 e está certo assim. **NOME AMBÍGUO BLOQUEIA A PUBLICAÇÃO (dono 11/08):** `candidatosPrimeiroNome` (utils, puro) acha quem atende por um primeiro nome sozinho; grupo sem login escolhido cujo nome tem 2+ candidatos vira aviso VERMELHO na conferência e o `publicar` recusa. Incidente: a CO - Cesárea da Unimed saiu com "JOAO" e o rodapé tinha JOAO HENRIQUE e JOAO RICARDO — o dicionário não resolve primeiro nome com dois donos (regra: perguntar, nunca chutar), os 3 casos ficaram órfãos numa linha "Fora do rodapé" e o dono deles nasceu liberado por aparecer sem cirurgia. **Demo fora de produção (23/07):** botão excluído; fixture `getDemoEscala` gated a `import.meta.env.DEV` (base dos e2e; prod nunca vê demo). ⚠️ dono tem 2 contas (`GUILHERME MELO`→wguime + `GUILHERME SOUZA MELO`→gmail) — **decisão 27/07: MANTER as duas** (login intacto nas duas), mas **29/07: UMA PESSOA, UM NOME na lista de escolha** — `profiles.conta_duplicada_de` (migration `20260729100000`, FK self c/ ON DELETE SET NULL, marcada por E-MAIL) tira a 2ª conta de `options` no `useRosterAnestesistas`, mantendo-a em `rosterByUid` (registro antigo salvo nela não perde o rótulo) e com `resolver`/`canonicalUid` remapeando secundária→principal. ⚠️ `contaDuplicadaDe` PRECISOU entrar no `CAMEL_TO_SNAKE` do `supabaseUsersService` (sem o mapa chega como `conta_duplicada_de` e o filtro nunca ativa — pegadinha do `ultima_avaliacao_at`). Quando 2+ cadastros colidem no nome curto a Liberações exibe o nome COMPLETO de todos (`curtoAmbiguo`). **Card na Home (2026-07-22):** `src/components/escala-cirurgica/EscalaCirurgicaHomeCard.jsx` (família visual do card Biblioteca) — plantonista do turno atual (`ordem_liberacao[0]` + `titleCaseNome`) por hospital com escala publicada hoje; gate `podeVerEscalaCirurgica`; context Tier 2 com fallback + fetch leve se a data do context ≠ hoje. **Cronômetro Liberações (fix 2026-07-22):** iOS/PWA mata o setInterval na suspensão (pills congeladas o dia todo) — `useAgoraMinuto` recalcula em visibilitychange/pageshow/focus E re-arma o interval; e2e determinístico `e2e/escala-cirurgica-cronometro.spec.ts` (page.clock + escala demo client-side, sem fixture no banco). **Fase noturna (2026-07-23, decisões a/b/c; REDESENHADA 24/07):** `src/lib/plantaoNoturno.js` — seg–sex (FERIADO segue a regra) na escala de HOJE. **19h→23h ('noite'):** cada plantonista noturno é um CARD igual aos demais (a caixa azul acabou), com **selo P1–P4 antes do nome** e ficha completa (toggle de liberar + cronômetro), no topo da lista e a **vespertina abaixo**. Ordem por hospital (`ORDEM_NOTURNA`): **HRO P1→P4 · Unimed P2→P3→P4 · Materno P4**; o 1º de cada hospital é o plantonista. **P4 é CORINGA:** sem marcação aparece nos TRÊS; tocar no selo abre "Onde está o P4 hoje?" e ele some dos outros dois p/ todos (tabela `escala_plantao_p4_diario`, 1 linha por data, RLS `can_write_escala_cirurgica` + realtime, migration `20260724200000`; audit server-side por trigger; **desmarcar = DELETE, sem botão na UI por decisão do dono**). **≥23h ('zerada'):** a lista do dia zera e ficam SÓ os P1–P4 do hospital (o alerta "sem anestesista" e o botão de ajuda também saem). `fundirLinhasNoturnas` HOISTA quem já está na lista (mesma `chave` → marcações/overrides seguem valendo, sem duplicar) e sintetiza card p/ quem não está (sintético não tem setas: não existe no rodapé); **card noturno sempre `teveCasos: true`** — sem isso o plantonista sem caso no turno caía em "não escalado" (nascia liberado) e afundava. P1–P4 vêm do card Plantões (useEscalaDia) casados ao dicionário via `candidatosNome` + fallback `casarPorInicialSobrenome` (o P3 "A. Schmidt" ficava sem selo: a inicial era descartada e sobrava "SCHMIDT", que NÃO é apelido cadastrável — há dois Schmidt; o fallback casa inicial+sobrenome no roster e devolve null se houver mais de um candidato); TUDO derivado do relógio — NUNCA reescrever o rodapé automaticamente (causa da corrupção 22/07). ⚠️ `key` do card de liberação é `linha.chave`, NUNCA o nome exibido (rodapé sem vínculo + caso com uid = duas linhas da mesma pessoa → React omitia/duplicava). **Definir anestesista é de TODA a equipe (27/07):** o ⚙ do header da sala e o botão do detalhe aparecem para qualquer `canEdit` (`podeDefinir = canEdit && !isDemo` no BoardView) — a regra de "só o dono da sala/coordenador" escondia o botão do board inteiro p/ a maioria (e sumia até da própria sala quando a identidade não resolvia: caso sem uid + apelido fora do dicionário). Isso absorveu o caso EM ABERTO de 24/07 (`salaEmAberto`/`grupoEmAberto`/`temAnestesistaReal` REMOVIDOS de utils); `updateAnestesistaCasos` segue gravando `sem_anestesista=false`, tirando o caso do alerta. **Automações do piloto (2026-07-21, aplicadas):** pg_cron `escala-seed-rollover-daily` (00:05 BRT, seed móvel; seed-20 imóvel) + `escala-amanha-check` (18h BRT dom–qui, notifica dono se amanhã sem escala real unimed/hro; dedup); skill `/escala-cirurgica` (status/seed/relatorio/smoke; leitura via `query-ro.mjs` SELECT-only); hook smoke pós-deploy (`scripts/smoke-prod.mjs`); regressão visual `e2e/escala-cirurgica-visual.spec.ts` (clock congelado 20/07 14h → seed fixa). ⚠️ Liberação ao grupo: unschedule do rollover + APAGAR seeds (aprovado pelo dono). Refs: `docs/escala-cirurgica.md` · `docs/escala-cirurgica-analise-adesao.md` · `docs/escala-cirurgica-evolucao-tecnica.md` · `docs/escala-cirurgica-automacoes.md` · `docs/escala-cirurgica-metricas/` |
| Cirurgias Particulares | card em **Gestão → Faturamento** (`FaturamentoPage`, saiu do Menu 2026-07-26; permissão virou subCard de `faturamento` → cascata do pai vale) → `src/pages/cirurgias-particulares/` (listagem = relatório em tela + form c/ import da escala) | Supabase `cirurgias_particulares` (migration `20260722100000`, aplicada; RLS `can_write_cirurgias_particulares()` = anestesiologista/secretaria OU admin — grupo todo vê tudo; FORCE RLS + REVOKE DELETE; realtime) + lib pura `src/lib/cirurgiasParticulares.js` + template PDF `cirurgiasParticularesReport` | **EM PRODUÇÃO** (deploy 2026-07-22; acesso = RLS anestesiologista/secretaria/admin — card visível a todos por default, barreira real é a RLS; user c/ permissões customizadas precisa do toggle no Centro de Gestão). Cobrança de honorários particulares: paciente (nome COMPLETO — dado sensível art. 5º II, base art. 11 II "d" no header da migration), cirurgião, anestesista (Select roster, default = user logado), data, procedimento, local, valor R$, status pendente/pago/glosado (`data_pagamento` auto). Período livre (2 DatePickers; DS DatePicker ganhou flip de âncora right-0 qdo popup estoura a viewport) + totais + tabs compactas sem contador (flex-1 text-xs — 4 abas cabem no 375px) + **Exportar PDF** (tarja CONFIDENCIAL + gerado por); lista é REATIVA (sem botão 'gerar'); empty state mostra o período + explica o auto-import; **CPF obrigatório no form** (migration `20260722400000`: `paciente_cpf` nullable só-dígitos CHECK 11; `validarCPF` DV + máscara na lib; `precisaCompletar` = iniciais OU sem CPF — valor saiu do critério), **valor OPCIONAL** (vazio = R$ 0, precifica depois), **CTA full-width no corpo** (header só lupa), **export em botão ÚNICO** (DropdownMenu: PDF / Excel / ambos; xlsx dinâmico, abas Cirurgias c/ CPF + Resumo, período no filename); ⚠️ REGRA DO DONO (2026-07-22): auto-import SÓ com convênio PURAMENTE particular ('Part'/'PART.'/'PARTICULAR'; COMPOSTO 'PART/SC' é ambíguo → NUNCA importa) E paciente IDENTIFICADO (lote '04 FACECTOMIA (04 PCTES)' sem paciente → não importa) — classificador `^PART(ICULAR)?[^A-Z]*$` + guard de iniciais espelhados em 5 lugares: `fn_convenio_particular`+trigger SQL (migration `20260722600000`), `familiaConvenio` (utils escala), edge parse-escala (sanitize+prompt), excelEscala e `casoImportavel` (lib) — mudar um = mudar todos (bug real 22/07: 4 casos HRO sem lançamento, corrigidos por re-backfill). Pipeline pacienteNome VALIDADO em produção 2026-07-22 (2 particulares reais importados c/ nome completo da Vision). **Verificação recorrente + aprendizado (2026-07-23)**: pg_cron `cirurgias-particulares-check` 20:30 BRT (migration `20260723100000`; **desde 30/07 roda com `p_notificar=false`** — migration `20260730160000`: corrige e loga, NÃO notifica; achados só via log/skill) — auto-corrige elegíveis sem lançamento (7d), watchlist de suspeitos (PART composto/lote, NUNCA decide sozinho), suspensos, incompletos >48h; log `cirurgias_particulares_check_log`; skill `/cirurgias-particulares` (status/verificar/historico + protocolo de aprendizado nos 5 espelhos); **alertas pós-turno de guia não preenchida REMOVIDOS (dono 30/07**, migration `20260730160000`: crons `guias-pendentes-*` desagendados + `fn_alertar_guias_nao_preenchidas` dropada; o **banner âmbar na listagem** é a única superfície do aviso; `precisaCompletar` segue incluindo valor). **Soft-cancel** (sem DELETE; `cancelada_em/por/motivo`). **AUTO-IMPORT da escala (sem botão)**: trigger `fn_sync_cirurgia_particular` (migration `20260722200000`, aplicada; AFTER INSERT/UPDATE em `escala_cirurgica_caso`, NUNCA bloqueia a operação clínica) — publicar/republicar/adicionar caso/des-suspender/convênio→particular cria rascunho automático (paciente=iniciais, valor=0, badge sólido âmbar 'Completar dados' via `precisaCompletar`; save bloqueado por `pareceIniciais` até completar o nome); AddCasoSheet oferece 'Preencher cobrança agora?' → form via `params.escalaCasoId`; toast na publicação conta particulares; `escala_caso_id` SEM FK (republicação faz DELETE+reinsert → trigger RE-VINCULA órfão por data+local+cirurgião+procedimento) + índice único parcial anti-duplo-lançamento (cancelado libera); suspensa não importa e se suspender DEPOIS do lançamento a listagem alerta (badge âmbar via `fetchCasosStatus`) c/ ação de cancelar; **backfill retroativo** `20260722300000` (idempotente, marcador 'Backfill auto-import'); **NOME COMPLETO no rascunho**: edge parse-escala devolve `pacienteNome` SÓ p/ convênio particular (prompt + sanitize; nunca entra na escala — CASO_FIELDS filtra + CHECK rejeita) e o Excel idem; pós-publicação `completarPacienteDoCaso` casa payload↔salvos por sala|ordem e completa o rascunho só se ainda estiver em iniciais; AddCasoSheet captura o nome digitado antes do blur→iniciais; Local do form = LOCAIS_BASE (hospitais+IOSC/Centro de Coluna/Accurata/Digimax/Umanitá/HO/Consultório) ∪ locais já usados (Select searchable); ⚠️ seeds do piloto publicadas com particular geram rascunho de teste (limpar junto na liberação ao grupo). Provider ON-DEMAND nos 2 cases (não global). Pendências LGPD registradas (retenção ~5a + RIPD): `docs/cirurgias-particulares.md` |

| Extrato de Férias | pill **"Extrato"** no card Férias da Home (card inteiro clicável; `FeriasCard` ganhou prop `actionPill`) → `src/pages/ferias/ExtratoFeriasPage.jsx` | Pega Plantão `getFeriasDoAno(ano)` (12 meses em lotes de 3 pelo proxy, cache 30min por chave, SEM fallback mock) + Supabase `ferias_violacoes_vistas` (migrations `20260803220000`+`233000`, aplicadas; append-only, FORCE RLS, `detected_by` amarrado ao uid) | **Acesso RESTRITO (dono 03/08): allowlist de e-mail = Guilherme Melo (2 contas), Fernanda Guollo e Leandro Bernardes** — `EMAILS_EXTRATO_FERIAS` em `src/pages/ferias/gate.js` ESPELHA a RLS `can_access_extrato_ferias()` (sem is_admin; mudar um = mudar o outro); destinatários da notificação = a mesma lista (`getDestinatariosFerias`). + `PAGE_TO_CARD: extratoFerias→'ferias'`. Layout (redesign 03/08, referência leave-trackers): **Coletivo** = 3 tiles (Dias marcados · **Alertas → bottom-sheet no toque**, nada de banner inline · Dias lotados) + lista com **nome COMPLETO** (`nomeCompleto` em `feriasSocios.js`; ids de violação seguem no nome da escala — mudar re-notificaria tudo) + `Progress` de uso + badges **Excedida/Completa/N livres**; **Individual** = saldo-herói com barra + card **Extrato POR SEMESTRE** (dono 19/08), cada metade com Agendados/Usufruídos dentro. **METADE DA COTA POR SEMESTRE:** o PDF diz "metade dos dias até fim de junho (ou julho com filhos em idade escolar)" + "dias não usufruídos em cada semestre serão perdidos"; dono 19/08 fechou que a metade é da **COTA**, não dos dias marcados — pode-se usar MAIS que a metade no 1º semestre, **nunca** mais que a metade no 2º. Daí `src/lib/feriasSemestre.js` (puro): `minS1 = ceil(cota/2)` (piso, só mostrado — dia que passou não volta) e `maxS2 = floor(cota/2)` (**TETO, que a aba Agendar BLOQUEIA** — `avaliarMarcacaoDia({semestre})`, tipo `METADE_SEGUNDO_SEMESTRE`; é o único bloqueio de REGRA, os demais só declaram custo). Cota ímpar sobra p/ o 1º semestre. A fronteira é o **CORTE** (30/06; 31/07 se `filhosIdadeEscolar` — hoje null p/ todos), não a metade do calendário, e período que o atravessa é PARTIDO nos dois lados. **1º ano (cota 5) é exceção nos dois eixos:** semestre livre (PDF) + os 5 dias têm de ser **uma semana corrida seg–sex, sem fracionar** (dono 19/08) — `semanaCorridaPrimeiroAno`, aviso no card. ⚠️ decisão do dono: essas duas regras novas ficam **só no extrato individual + no bloqueio da marcação** — NÃO viraram violação no motor (`extratoFeriasRegras.js` segue com 6), para não despejar alerta no Coletivo/PDF/notificação. Os totais por semestre incluem a penalidade da 7ª vaga do lado onde ela caiu; os "Total agendado/usufruído" globais saíram (o hero já traz os dois números). Libs puras: `src/lib/extratoFerias.js` (contagem: **FDS nunca conta**; **feriado só não conta em semana inteira**) + `extratoFeriasRegras.js` (**6 regras com id determinístico**; `REGRA_LABEL` simplificado 03/08; regras de PRAZO ficam fora — API não expõe quando se marcou). Dados: `feriasSocios.js` (46 sócios+ano entrada → cotas 5/20/30–35) + `feriasFeriados.js` (10 feriados do `férias/FERIADOS <ano>.pdf` — **Carnaval entra; 01/01 e 25/12 são recesso**) — manutenção ANUAL travada por tripwire. **Notificação agregada 1/dia** só com CONTAGENS (diff por id; recipients resolvidos ANTES de registrar). Export PDF (`extratoFeriasReport`) + Excel. Ano corrente automático. **Aba Mapa (03/08):** heatmap de ocupação diária (semanas × seg–sex, escala 0→7+ em tokens; toque mostra quem marcou) + plurianual por semana ISO (API serve 2023+ e o ano seguinte — `getFeriasDoAnoMin` cacheia anos passados em localStorage, loader com retry/pausa contra rate do proxy) + rankings de semanas + métricas de gestão e sugestões geradas do histórico (`src/lib/feriasAnalise.js`). Badges Completa/livres nos slots `-bg/-fg` de categoria (verde/laranja). **Aba Marcar — MARCAÇÃO SELF-SERVICE (dono 04/08):** cada sócio marca/desmarca as PRÓPRIAS férias tocando o calendário de ocupação (`calendarioOcupacao.jsx`, modo `selecao`, compartilhado com o Mapa) → barra fixa → `ConfirmarMarcacaoSheet` que DECLARA o custo (7ª vaga = 3 dias, alertas que a seleção cria, saldo antes→depois). Arquitetura: `ferias_movimentacoes` append-only (migration `20260804120000`) + replay puro `aplicarMovimentacoes` (`src/lib/feriasMovimentacoes.js`) sobre os registros do PP — **0 movimentações ⇒ extrato idêntico ao do PP** (travado em teste). RLS faz o self-service (`ferias_nome_socio()` ESPELHA `EMAIL_TO_SOCIO` do gate) e os PRAZOS no relógio do SERVIDOR (marcar: só dia futuro; desmarcar: nunca depois que a escala sai, i.e. ≤ véspera). `req_id`+índice único = confirmação retry-safe; `filtrarNoOps` = preflight anti-corrida. Regras que só avisam (cota/7ª vaga) vs. que bloqueiam (prazo/FDS) em `src/lib/feriasMarcacao.js`. Log de movimentações no fim do Mapa. ⚠️ proxy `pegaplantao-proxy` ganhou guardrails de escrita (WRITE_ALLOWLIST VAZIA, retry-401 só em GET, corpo do erro repassado) — a escrita no PP é fase-sonda futura, endpoint/códigos desconhecidos. ⚠️ lição 03/08: batch de notification p/ OUTROS destinatários NUNCA com `.select()` (RETURNING × RLS recipient-only aborta com 42501 silencioso — fix d127706 na ponte inteira). |

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
Casos já registrados em nome de quem não consta no rodapé não são apagados
nem reatribuídos automaticamente. Desde 19/08 (dono, caso Staub) essa linha
**entra na fila como AJUDA**: badge azul "Ajuda" (sem o selo "Fora do rodapé",
que lia como acusação; com origem em outro hospital vale o badge derivado
"Ajuda (Hospital)"), numerada na exibição e **primeira a ir embora** — exceto
quando o plantão do contraturno está ESCALADO, que segue fechando a lista (sai
primeiro) com a ajuda logo acima (liberada depois dele); plantão não escalado/
liberado é pulado pelo naFila e a ajuda vira o próximo. A `ordem_liberacao`
publicada segue intocada — o número é sequência de exibição.

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

### FDS — todos os arquivos numa entrada só (dono 22/08)

"é assim que recebo os arquivos": no fim de semana chegam JUNTOS, no mesmo dia, a
tabela de posições (sáb+dom) e um mapa cirúrgico por hospital e por dia. Os 4
arquivos de 22–23/08 custavam **6 leituras da Vision e 9 publicações**, com
hospital/data/período trocados à mão entre elas. `ImportarEscalaFdsPage` virou a
**LISTA DE DOCUMENTOS** (modelo A, escolhido em protótipo a 430px): a tabela é o
1º item porque vale os dois dias, cada mapa entra como item que se declara
sozinho (hospital pelo layout, data pelo cabeçalho — `classificarAnexoMapa`;
o que a leitura não resolveu vira Select no próprio item, nunca palpite), e um
"Publicar fim de semana" faz as 4 filas + uma chamada por (hospital, dia, turno)
COM casos. Chave do item = hospital+dia: reanexar o mesmo par SUBSTITUI.

⚠️ **O fluxo de DIA ÚTIL não muda** (dono 22/08: "durante a semana as escalas são
postadas em turnos diferentes pois são disponibilizadas em turnos diferentes, não
mexa na organização já estabelecida"). `ImportarEscalaPage` só trocou o import de
`prepararCasos`, movido para `utils` como `prepararCasosImportados` (fonte única,
sem alteração). A edge idem: sem a flag `secoesTurno` o prompt é literalmente a
mesma string.

**O que faz a leitura ficar correta — o turno vem da FAIXA, não só da hora:** o
turno saía de `turnoDeHora`, e as linhas **"AS"** (a seguir) do HRO não têm hora —
herdavam o período selecionado NO ANEXO. Por isso o mesmo mapa precisava ser
anexado duas vezes, e a tarde se perdia (6 das 15 cirurgias do HRO em 22/08 são
"AS"; em 21/08 a produção tem 4 casos com `hora='AS'` e 14 sem hora). A edge em
`secoesTurno: true` lê a faixa **MATUTINO/VESPERTINO** e devolve `turno` por caso;
`turnoDoCasoImportado` decide **hora > faixa > padrão** (a hora vence porque
`selecionarCasosDoTurno` republica por ela).
⚠️ **A herança de "//" NÃO pode atravessar a faixa:** ela é por SALA, e a Sala 1
do HRO tem THAYNA às 7h com a coluna da tarde VAZIA — sem fronteira, as 3
cirurgias da tarde sairiam no nome dela, em silêncio. Daí
`prepararCasosFimDeSemana` preparar o lote POR TURNO. Só morde onde o documento
deixa a tarde em branco, que é o caso do mapa de fim de semana (no dia útil a
tarde traz nomes próprios).

**Sugestão pelo posto da grade** (dono 22/08): sala sem nenhum nome no mapa entra
pré-selecionada com quem a grade põe naquele hospital naquele turno
(`anestesistaDoPosto` — HRO 13–19h = Rômulo), marcada "Sugerido pelo posto da
grade". Só alcança grupo SEM nome lido, e só se o login resolver — nunca chuta
identidade. Conferência do mapa (`ConferirMapaFdsPage`) é enxuta de propósito: no
FDS o mapa **não tem rodapé** (a fila é a da linha 'fds'), então não há lista
numerada, ajuda, troca nem duplicidade — e `ordemLiberacao: []` na publicação do
mapa, senão nasceria uma 2ª ordem concorrendo com a única.

Guardrail anti-perda espelha o do dia útil: anexo menor que o turno já publicado
(≥3 casos) pede "Republicar por cima". Refs: `src/lib/escalaFdsMapas.js` (lib
pura) · `ConferirMapaFdsPage.jsx` · testes `escalaFdsMapas.test.js` +
`importarEscalaFdsMapas.test.jsx` · e2e visual `importar-fds-mapas.spec.ts`.
⚠️ a edge `parse-escala-cirurgica` PRECISA de re-deploy para a faixa valer.

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
- **CARTÃO com rótulo, EM TODA ESCALA (dono 24/08):** "quero que essa configuração de
  mensagem do plantonista seja assim nos dias úteis". O desenho nasceu no protótipo do
  fim de semana e ficou lá dois dias, enquanto o dia útil seguia com a faixa de borda a
  borda de 17/08 e o "Confirmar" numa pastilha de 32px no canto. O que veio junto: o
  **rótulo** diz de quem é a mensagem antes de ela ser lida, e o **"Confirmar leitura"**
  vira botão de largura inteira (40px de alvo contra 32) — é a única saída do recado.
  Sem ramificação por modo: um recado, um desenho. ⚠️ a trava
  (`liberacoesAvisoPlantonista.test.jsx`) MUDOU DE LADO com o porquê no corpo — ela
  travava a divergência entre os modos e hoje trava a convergência.
- **Cor = `category-purple` (dono 20/08), no lugar do teal de 17/08**: "que as mensagens
  enviadas pelo plantonista sejam em tons de roxo e não esse verde". O teal tinha sido
  escolhido por ELIMINAÇÃO (verde é plantão/iniciada, azul é terminada, âmbar é
  atrasada/próximo/sem anestesista, vermelho é liberado/suspensa, indigo é "troca" — todos
  na MESMA tela), mas na tela em uso ele lia como MAIS UM VERDE, que é justamente o que a
  faixa não pode parecer. ⚠️ o roxo também é o badge "Passa para tarde/noite" — a separação
  é de MASSA, não de matiz: a faixa é a superfície soft (`-bg`) de borda a borda; o badge é
  pastilha sólida dentro do card. Trocar a tinta do badge é o caminho se um dia confundir,
  nunca a da faixa. Travado em `liberacoesAvisoPlantonista.test.jsx`.
- ⚠️ **Não entra na CAIXA DE ENTRADA**: vive na tela em realtime e morre na confirmação. A
  escala não cria notificação in-app desde 30/07 e isso não mudou.
- **VIRA PUSH DE TELA BLOQUEADA (dono 24/08):** "quero que os usuários recebam um pop-up da
  mensagem mesmo com o celular bloqueado". Ao enviar, o recado sai também por FCM para
  **todos com acesso à escala** (decisão do dono; = `podeEditarEscalaCirurgica`, o mesmo
  conjunto do gate e da RLS, de qualquer hospital — `destinatariosPush.js` não tem regra
  própria de propósito), menos o autor. ⚠️ **não é volta do que foi cortado em 30/07**:
  aquilo eram 6 avisos automáticos POR EVENTO que criavam linha na inbox (99 não lidas em 23
  pessoas); este é uma frase que uma pessoa escolheu escrever, tem teto de 3 na tela, é
  opt-in por construção (só chega a quem ativou notificação) e **não deixa não-lida em lugar
  nenhum**. `priority:'high'` + tag única (`escala-recado`): dois recados seguidos
  SUBSTITUEM na bandeja em vez de empilhar. ⚠️ **LGPD**: o corpo aparece na tela BLOQUEADA de
  quem recebe, à vista de quem estiver com o aparelho na mão — o aviso do formulário passou a
  dizer "sem paciente: nem nome, nem iniciais", que é mais estrito que a regra da Observação.
- **Alcance real medido (24/08): 35 dos 71 perfis têm `fcmToken`** (31 renovados em agosto).
  No iPhone o token só existe com o app **instalado na tela de início** — em aba do Safari a
  API nem existe —, então esse número é literalmente "quantos aparelhos podem receber com a
  tela bloqueada". Quem não instalou não recebe, e isso não é falha: a tela segue sendo a
  fonte da verdade.
- Banco: `escala_cirurgica_aviso` + `escala_cirurgica_aviso_confirmacao` (migrations
  `20260817140000` e `20260817180000`). Autor e confirmante são **server-side por
  trigger** (`firebase_uid()`) — não dá para falar pela boca de outro nem inflar o placar;
  a confirmação é linha própria com PK composta (num jsonb, duas confirmações simultâneas
  se sobrescreveriam). RLS por papel, como o resto do módulo; nada toca `ordem_liberacao`.
- Hook `useAvisoPlantonista` fica FORA do context: o recado não é parte da escala e o
  context já carrega três hospitais por data.

### Urgências do HRO — contador de contrato + fila (dono 18–20/08)

O contrato do HRO paga por turno: manhã 1 orto (Sala 4) + 1 CO (Sala 7 - CO) + plantonista
+ sobreaviso; tarde sem CO; noite só plantonista + sobreaviso → **2 vagas de urgência
simultâneas**. A 3ª exige gente que o hospital não paga, e a faixa no topo da aba
**Completa** mostra isso enquanto acontece. Escala do HRO com casos ⇒ faixa VISÍVEL mesmo
sem urgência (dono 19/08 — é na publicação da manhã que se confere/configura as salas do
contrato); sem caso nenhum no dia, some. Endoscopia/colono fora do CC e hemodinâmica não
contam.

**A CONTA (regra fechada em 20/08 na 2ª rodada — a 1ª contou por SALA e o dono corrigiu:
"a vaga é gasta por cirurgia"):** a unidade é a CIRURGIA, mas duas cirurgias do MESMO
anestesista são UMA ocupação — ninguém opera dois pacientes ao mesmo tempo, e é isso que
faz o CO com cesáreas o dia todo ser um card com `2 cir.` em vez de dois. Agrupador:
`anestesistaUserId` → nome → sala.

**ENCAIXE (dono 20/08):** urgência aberta entra numa vaga LIVRE do contrato mesmo ANTES de
começar (quem a assumiu já é o plantonista/sobreaviso) → sem vaga livre e ainda não
iniciada, vai para a **FILA** → sem vaga livre e JÁ INICIADA, vira **Extra**. Ordem de
entrada: quem já opera (mais antigo) → depois a fila (gravidade → chegada); sala marcada
casa com o posto dela antes de tudo.

**Sala ESTAÇÃO** é o que faz uma cirurgia contar mesmo sem `tipo=urgencia`: sala marcada
como plantão/sobreaviso no `urgencias_meta`, ou listada em `CONTRATO_HRO[turno].estacoes`
(= `['co']` à TARDE e à NOITE — "à tarde e à noite não há sala exclusiva para CO, então se
entrar será considerada como urgência/emergência"). É o "DIA TODO" do CO, que é eletiva no
banco. ⚠️ à noite vale o **"SE ENTRAR"**: só cirurgia que chegou depois das 19h
(`INICIO_NOTURNO_MIN`) **ou que está em andamento** — o `turno` do banco não distingue
tarde de noite, e a sobra da tarde sem "terminada" (3 casos na Sala 4 em 20/08) travaria
vaga toda noite. Estação esquecida (>4h iniciada) NÃO some: vira a mesma pergunta "ainda em
andamento?" das urgências. **Marcar a sala do plantão/sobreaviso ENTRA na contagem** (pedido
do dono: "se as salas de urgência não tiverem sido identificadas, que haja como marcar sala
para que entre na contagem") e vence a absorção do dedicado; marcar sala SEM cirurgia aberta
não gasta vaga — marcar não é reservar. Tinta verde só com cirurgia EM ANDAMENTO.

- Lib pura `src/lib/escalaCirurgicaUrgencias.js` — nome de propósito: o gate de CI só
  observa `escalaCirurgica*`. `CONTRATO_HRO` é config POR TURNO (`dedicadas` + `estacoes`
  — é onde a decisão do dono vira código); `turnoContratual` delega a `faseLiberacoes` (o
  campo `turno` do caso só aceita matutino|vespertino, então a urgência das 21h é
  vespertina no banco mas do contrato da NOITE — **a capacidade vem do relógio**).
  `estadoUrgencias` recebe o **dia inteiro** (`casosResolvidos`), NUNCA `filtrarPorTurno`:
  urgência da manhã ainda aberta às 14h ocupa o plantonista da tarde. Exclusão é pela SALA
  (a mesma colono conta no CC e não conta em `Exames`), via `papelDaSalaHro` NORMALIZADO —
  produção tem "Sala 5"/"Sala 5 - Emergência" para a mesma sala. Fila ordena
  gravidade→`created_at` (⚠️ chega em **snake_case** — não está no CAMEL_TO_SNAKE;
  `createdAt` = NaN silencioso); NUNCA por `hora` (18/08: 9 de 9 urgências sem hora).
  Iniciada há >4h (`statusAtualizadoEm`, nunca a chegada) sai da ocupação e vira pergunta —
  36% das urgências ficam sem marcação, e o app não afirma o que não sabe.
- **Coluna `gravidade`** (migration `20260818140000`): imediata|urgente|aguarda (adaptação
  NCEPOD), NULL = não classificada (sem default: não existe gravidade neutra; NULL vai ao
  FIM da fila com "Classificar"). ⚠️ a migration patcheia as DUAS RPCs de publicação
  **sobre a definição VIVA** (`pg_get_functiondef` + âncora única + guard de versão) — a
  versão mais nova de uma RPC NÃO está na migration de nº mais alto que a cita
  (`20260726110000` é anterior a `20260729210000`); copiar a errada apaga colunas em
  silêncio. `gravidade_caso` denormalizada em `escala_cirurgica_evento` (trigger); só é
  gravada quando há transição de status — lacuna aceita, o relatório declara a cobertura.
- **UI** `FaixaUrgencias.jsx` em EscalaCirurgicaPage (branch board, fora do modo FDS),
  **FORA da BoardView** — os EmptyStates dela matariam a faixa no dia sem escala com
  urgência à mão (8 de 9 em 18/08). Desenho fechado em 3 rodadas de protótipo
  (`.tmp/urgencias-hro-prototype.html`): grade 2×2 de UMA linha (36px, sem negrito, sem
  subtítulo), postos = plantão/sobreaviso + dedicados do turno; **excedente = card PRÓPRIO
  full-width com rótulo EXTRA** (nunca chip igual aos outros); fila em 1 linha
  (nº+gravidade+procedimento+espera), teto 3 + "ver todas"; cores = receitas existentes
  (selo `bg-primary/20`, tinta `bg-success/[0.14] dark:/20`); **vermelho SÓ no
  excedente/badge/nota** — fundo vermelho sob cards verdes foi vetado como "vitral". Toque
  abre o `CasoDetalheSheet` (onde Iniciada/Terminada já são marcados); posto SEM caso abre
  o AddCasoSheet com `postoInicial`/`salaInicial` (19/08). Os cards dos dedicados vêm
  prontos da lib (`estado.dedicados`) — derivá-los na view duplicava a regra do contrato e
  fazia a sala marcada como plantão aparecer DUAS vezes na grade.
- **Salas CONFIGURÁVEIS por dia/turno (dono 18/08, 2ª decisão)**: "as salas do CO e
  ortopedia podem mudar" — `urgencias_meta` jsonb no cabeçalho (migration
  `20260818190000`), chaveado por turno de PUBLICAÇÃO, gravado pela MESMA
  `rpc_escala_patch_liberacao` (campo novo no CHECK; por/em carimbados server-side).
  Coluna própria DE PROPÓSITO: reusar `linha_overrides` morreria no reset da republicação.
  `salasContrato(meta, turno)` resolve config→default; `papelDaSalaHro(sala, salas)` — sala
  marcada VENCE o default por papel (orto na Sala 3 ⇒ Sala 4 vira comum). UI: ⚙ no
  cabeçalho da faixa → `SalasUrgenciaSheet` (4 Selects + Automático; tudo automático salva
  null). ⚠️ **CO pode ser feito em QUALQUER sala** (dono 20/08) — é por isso que a
  marcação existe: `salas.co = 'Sala 3'` faz a Sala 3 ser o CO do dia e a Sala 7 voltar a
  ser comum. `urgenciasMeta` PRECISOU entrar no CAMEL_TO_SNAKE (classe
  fds_meta/conta_duplicada_de).
- **TIPO editável no detalhe do caso (dono 20/08):** "digamos que essa cirurgia era uma
  urgência que não foi lida ao ser adicionada na escala" — o tipo só existia no
  `AddCasoSheet`, então urgência que a Vision leu como eletiva era beco sem saída. O cartão
  **Andamento** do `CasoDetalheSheet` tem Eletiva·Urgência·Emergência (emergência
  pré-seleciona gravidade `imediata`; voltar p/ eletiva limpa a gravidade) e reclassificar
  joga a cirurgia no encaixe acima. O badge do cabeçalho continua sendo a identidade — o
  botão é a AÇÃO, e os dois textos coexistem de propósito.
- **"Adicionar caso" no padrão do detalhe (dono 20/08, modelo A escolhido em protótipo —
  `.tmp/adicionar-caso-modelos.html`):** três cartões com a MESMA divisão do detalhe
  (**A cirurgia** · **Tipo e prioridade** · **Quem está e onde**), painel `!h-auto
  max-h-[90vh]`, rodapé com borda + par de botões e o "falta preencher" logo acima deles.
  Tipo e gravidade vivem em **`ChipsEscolha.jsx`** — fonte ÚNICA das pastilhas de 44px,
  consumida pelo detalhe e pelo formulário: eram Select num e pastilha no outro para o
  MESMO dado. **CONVÊNIO virou lista** (`CONVENIOS_BASE` + `conveniosDaEscala` em utils,
  com "+ Outro convênio…" para digitar): o campo livre acumulou "Unirmd", "Umimed",
  "Particulae", "Sua", "sUS" em produção, e convênio com erro de digitação some do
  agrupamento por família e, no particular, da COBRANÇA (o trigger casa o texto). ⚠️ a
  grafia da lista é a que vai ao banco: "Particular" precisa seguir casando
  `^PART(ICULAR)?[^A-Z]*$`, travado em teste. Ordem INVERSA à de `salasDoHospital`
  (canônica primeiro): sala agrupa por TEXTO, convênio agrupa por FAMÍLIA. O campo do posto
  virou **"Quem vai fazer esta urgência"** com o contrato explicado por extenso — o dono não
  entendia "posto ocupado → o excedente entra como Extra". ⚠️ os testes do formulário
  achavam a sala por `getAllByRole('combobox')[0]`; agora é `escolherSala()` pelo
  placeholder — índice de combobox quebra a cada campo novo.
- **CONVÊNIO editável no caso publicado (dono 20/08):** "esse convênio foi digitado
  errado e não pode ser alterado" — a apendicectomia das 18h entrou como "Sua" (erro de
  "SUS"). Era o último dado da cirurgia sem conserto depois de publicada, e não é
  cosmético: `familiaConvenio` decide o selo, o agrupamento e a COBRANÇA particular.
  Linha no cartão **A cirurgia** do `CasoDetalheSheet` (só p/ quem edita) → `EditorSheet`
  com a MESMA lista do formulário + digitação. ⚠️ o aviso da folha é regra de negócio, não
  decoração: trocar PARA Particular cria a cobrança pelo trigger, mas SAIR de Particular
  não apaga a cobrança já criada — ela precisa de cancelamento em Cirurgias Particulares.
- **Rótulos de sala (dono 20/08):** "Sala 7" → **"Sala 7 - CO"** é rótulo ÚNICO
  (`normalizarSalaHro`, idempotente), e a normalização passou a valer para sala digitada à
  mão no `AddCasoSheet` e no "Mudar" do detalhe, não só na importação. `MATERNO` entrou na
  lista canônica de exclusão e `PADROES_FORA_DO_CONTRATO_HRO` (regex) é a rede para o
  rótulo digitado — "AMBULAT.", "Ambulatorial BERA", "Odonto ambulatorial" e "MATERNO"
  caíam em 'geral' e uma urgência ali entrava na conta das 2 vagas do HRO.
- **RÓTULO DE SALA CURTO, BLOCO IMPLÍCITO (dono 21/08 — "ficou muito poluído"):** a
  numérica do HRO é do BLOCO A, a 5 é a Emergência e a 7 é o CO, mas **nada disso vai para o
  rótulo**: `Sala 1`…`Sala 9`, uma entrada por sala na lista de escolha. A tentativa de 20/08
  (`Bloco A - Sala 7 - CO`) durou um dia — a sala se repete na pastilha de cada faixa do
  quadro, no card de cada pessoa da fila e nos cards da faixa de urgências, e três informações
  no mesmo rótulo espremeram o resto (o card do dedicado passou a truncar o nome). **`Bloco M`
  MANTÉM o bloco** — ali ele não é implícito, é o que separa a sala 1 do materno da sala 1 do
  bloco A. O que o app continua sabendo: `normalizarSalaHro` traduz `CO`→`Sala 7`,
  `EMERGENCIA`→`Sala 5`, `Bloco A - Sala 4`→`Sala 4`, `Sala 7 - CO`→`Sala 7`;
  `papelDaSalaHro` segue classificando orto/CO e a faixa de urgências nomeia o papel **no
  badge ao lado**, não no rótulo. ⚠️ **escala publicada NÃO é reescrita** e produção tem as
  três grafias da mesma sala (`Sala 5` 27 · `Sala 5 - Emergência` 26 · `Sala 7 - CO` 30 ·
  alguns `Bloco A - Sala N`): a ponte é **`chaveSalaHro`** (utils, puro) — colapsa prefixo de
  bloco A e sufixo de papel no número —, e é ela que faz o `chaveSala` do contrato contar UMA
  vaga, a sala marcada no ⚙ casar com o caso na outra grafia e o seletor não oferecer a mesma
  sala duas vezes (`chaveSalaEscolha` em `salasDoHospital` + no dropdown de local da
  Liberações). ⚠️ a normalização vale **só para sala DIGITADA**: normalizar a opção ESCOLHIDA
  reescreveria a grafia do DIA e criaria o segundo bloco no quadro — que é o que a regra existe
  para impedir. `CONTRATO_HRO.dedicadas` é a fonte única do padrão orto/CO (o `AddCasoSheet`
  copiava à mão). Travas em `escalaCirurgicaSalas.test.js` + `escalaCirurgicaUrgencias.test.js`.
- **SALA DA UNIMED: a numérica sozinha é o CENTRO CIRÚRGICO (dono 25/08 — "não está saindo com
  a Sala, está aparecendo apenas um número"):** o mapa da Unimed rotula a coluna ora
  "CENTRO CIRÚRGICO - SALA 1", ora "SALA 1", ora só **"1"**, e `normalizarSalaUnimed` só conhecia
  a primeira — as outras duas passavam cruas e iam publicadas assim (31 casos no feriado de 25/08,
  17 em 19/08). O estrago não é só o rótulo: a Unimed **não tem** uma `chaveSalaHro` que colapse
  grafias, então `"6"` e `"CC - Sala 6"` são DUAS salas — dois blocos no quadro e duas entradas no
  seletor. Hoje `^(?:SALA\s*)?0*(\d+)` → `CC - Sala N`, e o `0*` entrou também nas regras do CC e
  do CO, porque produção tem "CC - Sala 01" e "CC - Sala 1" para a mesma sala (12/08). ⚠️ assumir o
  CC só é seguro porque o **bloco obstétrico vem sempre rotulado** no mapa ("CO - Sala 3") e a
  regra do C.O corre ANTES — travado em teste. A escala de 25/08 já publicada foi reparada por
  `scripts/repair-escala-unimed-salas-2026-08-25.sql` (só a coluna `sala`, só aquela data): os dois
  triggers de negócio da tabela são `UPDATE OF` colunas específicas e não disparam, o `local` de
  `cirurgias_particulares` é o HOSPITAL e não a sala, e `liberacoes`/`linha_overrides` são
  chaveados por PESSOA — reimportar, que era a alternativa, zeraria as liberações do turno em
  pleno feriado.
- **Fila: coluna à direita, badge do turno com respiro e "Editar" por extenso (dono 21/08):**
  o tempo fica em cima e o **"Editar" no canto INFERIOR direito**, os dois com a mesma margem
  da borda (11px a 375px) e na mesma vertical do "Passa para tarde/noite" — que usa `ml-auto`
  mas encostava na borda porque o corpo do card não tem padding à direita (`mr-2.5`). Antes a
  direita tinha DOIS layouts (linha; coluna quando havia setas de ajuda) e um `mr-10` só para
  alinhá-los entre si — com uma coluna só, o alinhamento é o padrão e o hack saiu. O **lápis
  virou badge "Editar"** (`badgeStyle` outline): o ícone não dizia o que abria, e o painel não
  é "editar a linha" — é observação, local, cirurgião, ajuda e troca. Outline = ação (o
  vocabulário dos botões do topo da aba); os badges de ESTADO são sólidos, então nada se
  confunde. `aria-label` inalterado (`Editar local/cirurgião de {nome}`) — é o que distingue
  16 botões iguais no leitor de tela e o que testes e e2e usam. O botão leva **44px de alvo com
  `-my-2`** (truque do selo P4: toque confortável sem esticar 17 cards) — por isso o e2e mede
  o BADGE, não o botão, senão acusa sobreposição onde a tela mostra empilhamento. O ✏️ do selo
  P4 FICA: ali ele marca que o selo é editável, outra função.
- **Badge do turno não encosta no cronômetro (dono 21/08, "amontoado"):** o badge fica na
  linha do nome e a coluna direita começa logo abaixo — medido, o badge terminava em 32px e a
  pílula do cronômetro começava em 32px, e dois pills sólidos colados liam como um bloco de
  duas cores. `mt-2` na coluna **só quando o badge existe** (`mostraPassaTurno`): folga fixa
  esticaria os 17 cards. ⚠️ `mostraPassaTurno` é declarado DEPOIS de `renovado` — declarar
  junto de `liberado`, como tentei, cai na zona morta e derruba a aba inteira com o
  ErrorBoundary. Os três pills ficam com 8px entre si.
- **Seta do cirurgião e "~" do cronômetro: fora (dono 24/08):** o ▶ que marcava "cirurgia em
  andamento" antes do nome do cirurgião saiu — a própria linha já distingue (a iniciada conta
  "faltam 45min", a agendada mostra "até 15:45"), e o glifo repetia isso num símbolo que só se
  entendia pelo tooltip, que no celular não existe. `andando` segue decidindo contagem × hora;
  só o desenho saiu. E a pílula do total mostra **`1h18`**, sem til: o `~` sai em
  `fraseCronometro`, NÃO em `formatFaltante`, que é compartilhado — a coluna de tempo do
  quadro da Completa (`~45min`, desenho de 18/08) fica como está.
- **TEMPO ESTOURADO pede atualização (dono 24/08):** "após terminar o tempo estabelecido, quero
  que o usuário receba uma mensagem para atualizar o tempo, caso o procedimento não tenha
  terminado". São DUAS metades e elas falham diferente. **(1) Tela**, 100% confiável: a pílula
  vira **âmbar** (era verde, a cor de "está tudo correndo", enquanto o texto já dizia "25min
  além" — número e tinta discordavam) e o card ganha "Atualize o tempo se a cirurgia não
  terminou". Âmbar aqui já significa "passou do previsto" (tempo da cirurgia estourada, badge
  Atrasada). **(2) Push** para a pessoa do cronômetro, ⚠️ **best-effort**: quem dispara é o
  aparelho de quem estiver com a aba Liberações aberta — sem nenhuma tela aberta naquele
  minuto, ninguém recebe e só o âmbar aparece depois. Um cron no servidor resolveria, ao custo
  de refazer em SQL a resolução de identidade da fila (as 4 camadas de matching), que é onde
  este módulo mais errou. Só entra quem tem login vinculado, não foi liberado e AINDA tem
  cirurgia aberta; card noturno entra (P1–P4 têm cronômetro e é quem mais fica sem ninguém
  olhando a tela). ⚠️ **a trava de "N telas, uma push" é a PK do banco**, não código:
  `escala_cirurgica_aviso_tempo` (migration `20260824120000`, aplicada) com
  `upsert + ignoreDuplicates` → `ON CONFLICT DO NOTHING`, e só manda quem conseguiu inserir.
  `ignoreDuplicates` é opção de **upsert**; em `insert` ela é descartada em silêncio e o
  perdedor leva 23505 — foi achado na revisão. O `alvo` (HH:MM) está na chave: atualizar o
  tempo rearma o aviso; repetir o MESMO horário não. A policy de SELECT parece órfã e **não
  é** — é o `.select()` que revela quem ganhou a corrida; removê-la mata a push em silêncio.
- **`send-fcm-push` aceita `userIds` (lote, 24/08):** o recado alcança ~70 pessoas e uma
  chamada por destinatário seriam 70 requisições saindo do celular de quem escreveu, no meio
  do turno. O OAuth do Google resolve UMA vez e os lookups vão em blocos de 10. Contrato de 1
  pessoa (`userId` + 404 `no_fcm_token`) intacto — as mensagens internas dependem dele; os
  dois foram verificados contra a edge em produção depois do deploy.
- **A folga é de TODO selo, não só do roxo (dono 24/08, "alguns badges muito próximos"):** a
  correção de 21/08 travou o `mt-2` em `mostraPassaTurno` e o defeito seguiu de pé para os
  outros oito selos — medido a 375px com a escala real, "Plantão da tarde" terminava a **0px**
  do "+ Tempo total". A coluna da direita é `items-center` na 2ª linha, então quando as infos
  da esquerda são curtas (linha liberada, linha sem cirurgião) **ela vira o elemento mais alto
  do card** e começa colada no fim da 1ª linha: acontece em METADE da fila. Hoje a condição é
  `temSeloAoLadoDoNome`, e os nove selos viraram consts que o JSX e a folga consomem — a lista
  não tem como divergir. Junto: `pr-1.5` na linha do nome (com nome longo + 3 selos o último
  parava a **1px** da borda arredondada) e o roxo trocou `mr-2.5` por `mr-1`, que somado ao
  `pr` fecha os mesmos 10px do `pr-2.5` da coluna. ⚠️ **6px entre selos é TETO medido, não
  escolha estética**: a linha tem 282px a 375px e "Leonardo Ferrazzo" + Plantonista + Troca
  gasta 275,5 — `pr-2` e `pr-2.5 + gap-2` foram testados no app e os dois truncam o NOME do
  plantonista ("Leonardo Ferraz…"), que é a identidade do card; `flex-wrap` joga "Troca" órfã
  numa 2ª linha e contraria "badge ao lado do nome". A 430px sobram 64px, se um dia valer abrir
  o gap só acima de ~400px. Trava: `liberacoesSelosPosicao.test.jsx` é **invariante** ("havendo
  selo, há folga"), não o caso de um selo — foi exatamente a trava estreita que deixou 21/08
  passar; e a varredura de geometria (nenhum par < 6px, nada encostando na borda) vive no e2e
  `escala-cirurgica-acoes-layout.spec.ts`, porque jsdom não mede layout.
- **A TARDE HERDA AS SALAS DE URGÊNCIA DA MANHÃ (dono 21/08):** `salasContrato` faz fallback
  campo a campo `vespertino → matutino`. Quem marca onde está o plantão às 7h não remarca às
  13h, e sem a herança a tarde nascia toda em automático: a sala perdia o posto, deixava de
  ser ESTAÇÃO e as cirurgias dela saíam da conta e da lista. "Automático" na tarde passa a
  significar "o que a manhã disse"; marcar a tarde vence o herdado, campo a campo. ⚠️ é
  **exceção EXPLÍCITA e restrita** à regra estruturante de 13/08 ("turnos independentes"):
  vale só para `urgencias_meta`. Em TROCA e posição a regra segue integral —
  `localizarSlotRodape`/`localizarSlotEscala` e `casosTransferiveis` continuam tratando
  `turno` como filtro EXATO, travados em `planoTroca.test.js`. O teste que afirmava o inverso
  virou o teste da exceção, com o porquê no corpo — não foi apagado.
- **CRUZAMENTO DA URGÊNCIA QUE ATRAVESSA O TURNO (dono 21/08):** "ao passar salas de urgência
  da manhã para tarde cruze os dados com a escala da tarde (no momento da importação) e ajuste
  os anestesistas conforme escala da tarde; se não houver anestesista escalado, mantenha na
  fila". A urgência aberta é do DIA, não do turno: às 13h ela segue ocupando a sala, mas quem
  responde por ela passa a ser quem a escala NOVA pôs ali — o da manhã foi embora. Era conserto
  à mão depois de cada publicação. Lib pura `planoCruzamentoUrgencias` (devolve o PLANO; quem
  chama grava), chamada no `publicar` da importação, **só HRO** e fire-and-forget — falhar ali
  nunca desfaz a publicação. Regras: a resposta vem da ESCALA publicada (quem está NAQUELA sala,
  por `chaveSala`, não por texto) · cirurgia **já iniciada entra igual** ("será assumida por
  alguém da escala vespertina") · **sem ninguém escalado na sala o caso fica SEM anestesista**
  (`sem_anestesista=true`, entra no alerta e segue na fila) e a **sala continua ocupada** nos
  cards, porque a cirurgia existe — nunca se mantém o nome de quem já saiu. Fora do alcance de
  propósito: cirurgia CONCLUÍDA (é registro do que aconteceu), sala fora do contrato e caso do
  próprio turno publicado. Idempotente: republicar não reescreve quem já está certo. ⚠️ o toast
  DIZ o que mudou — reatribuir anestesista é decisão clínica e não pode acontecer em silêncio.
  Depende de `saved.casos` trazer os DOIS turnos, que é o contrato da RPC
  (`rpc_publicar_escala_turno` devolve todos os casos da escala, sem filtro de turno).
- **Definir anestesista PELA FAIXA (dono 21/08):** a urgência costuma nascer sem anestesista
  (as cesarianas do CO), e o detalhe aberto pela faixa não oferecia o botão da linha
  "Anestesista" — `CasoDetalheSheet` esconde a ação quando `podeDefinirAnestesista`/
  `onDefinirAnestesista` faltam, e a `FaixaUrgencias` era o único chamador que não as passava
  (BoardView e MinhasEscalasView passavam). A faixa agora monta o `DefinirAnestesistaSheet`
  como o quadro. Travado no teste: o mock do detalhe expõe `data-definivel`.
- **UMA SALA, UMA VAGA — a mesma sala nunca conta duas vezes (dono 21/08):** "a sala extra é
  a mesma sala que o plantão está fazendo as cirurgias do CO, ou seja, está contando a mesma
  sala 2 vezes". Só por titular, a Sala 7 rendia DUAS ocupações — as cesarianas sem
  anestesista (chave `sala:`) e o caso com login — e a segunda virava EXTRA "acima do
  contrato" (3 de 2) com ninguém a mais no hospital. Não cabem duas cirurgias simultâneas na
  mesma sala. As duas regras de colapso se resolvem juntas por **componente conexo de
  (titular, sala)**: mesma pessoa em duas salas = uma ocupação (20/08) · mesma sala com dois
  titulares = uma ocupação (21/08). ⚠️ consequência aceita: uma pessoa em duas salas LIGA
  essas salas, então um terceiro numa delas cai no mesmo componente — o erro passa a ser para
  MENOS, que é o oposto do que o dono recusou.
- **Urgências: card do posto em DUAS LINHAS + fila com uma linha por CIRURGIA (dono 21/08).**
  Card: sala em cima, anestesista embaixo — numa linha só os dois disputavam ~150px e o rótulo
  longo empurrou o nome para fora, sobrando uma pastilha muda. A LINHA DA FILA continua em uma
  linha (`CARD_FILA`): ali não há sala, e o que se lê de relance é gravidade → procedimento →
  espera. ⚠️ **a fila recebia só o que sobrava dos postos** e os dois agrupamentos a
  esvaziavam: "uma pessoa, uma vaga" colapsava as cirurgias do mesmo titular num card, e a sala
  DEDICADA nem chegava a `candidatos`. Em 21/08 havia 6 urgências abertas (3 cesarianas no CO,
  2 na Emergência, 1 na Sala 8) e a tela dizia "2 de 2 salas" com fila VAZIA. Hoje a OCUPAÇÃO
  segue sendo uma por titular (ninguém opera dois pacientes ao mesmo tempo) e a FILA lista toda
  urgência aberta que ainda não começou e **não é o representante de nenhum card** — incluindo
  quem espera atrás de uma sala dedicada, que é justamente onde a fila se forma. Invariante
  travado em teste: cada urgência aberta aparece EXATAMENTE uma vez, ou como card ou na fila.
- **Relatório contratual**: modo `contrato-hro` planejado na skill `/escala-cirurgica`
  (pareamento 1º iniciada→1º terminada posterior = Achado 2; sweep-line com empate
  saída-antes-de-entrada; SUS = `upper(convenio) ~ '^SUS\M'`; tudo
  `at time zone 'America/Sao_Paulo'`). Validado contra produção 18/08: 16 intervalos,
  mediana 49min, pico 2 simultâneas em 06/08. Comunicado leigo à equipe:
  `.tmp/comunicado-urgencias-hro.md`.

### FDS — UMA TELA SÓ (dono 24/08), depois da análise dos 5 fins de semana

"Quero organizar as escalas de final de semana apenas com lista de liberações."
A análise (5 fins de semana no banco) confirmou e mostrou o porquê real: em dois
deles houve **mais toques para DESFAZER liberação do que para liberar** (13×3 em
15/08, 9×3 em 22/08, estes em 13 minutos), sempre pela mesma causa — cirurgia sem
anestesista definido faz a pessoa aparecer sem trabalho e a fila se desmancha. O
quadro por sala resolve um problema que o sábado não tem (12 salas contra 42) e
é largamente abandonado (15/08 e 23/08: NENHUMA cirurgia marcada). Mas ele não
podia sumir sem levar junto a ação mais usada: no fim de semana quase toda
marcação é na cirurgia **de outra pessoa** (19 de 20 em 22/08), por 1 a 3 pessoas
no dia — alguém cobrindo o grupo.

**A tela:** sáb/dom perdem as ABAS e o SELETOR DE HOSPITAL (`BarraControles`
aceita `null` nesses eixos = "não existe esse eixo aqui"); sobra a fila, com
data e turno. Dia útil intocado. Card no **modelo A** (ações empilhadas à
direita, escolhido em protótipo): **hospital ISOLADO** em caixa alta logo abaixo
do nome, **sala** na linha seguinte, **cirurgiões em lista** depois — numa fila
que cobre três hospitais "onde a pessoa está" é a primeira pergunta, e a caixa
alta curta lê como rótulo em vez de disputar com o nome.

⚠️ **"Terminei" NASCEU E SAIU NO MESMO DIA (dono 24/08, três decisões seguidas):**
botão da linha que encerrava de uma vez as cirurgias em aberto no nome da pessoa
→ restrito à fila única → **REMOVIDO**, e a coluna de ações voltou a ser
`+ Tempo total` + `Editar`, a mesma dupla do dia útil ("verifique como os cards
estão configurados em dias úteis e use a mesma distribuição"). Medido depois da
remoção: a coluna caiu de 87 para **55px** e o espaço vazio da fila de 222 para
**84px**, porque a altura do card passou a ser ditada pelo TEXTO e não pela
coluna. ⚠️ o problema que o botão atacava CONTINUA de pé: em 22/08, 15 das 35
cirurgias nunca saíram de "agendada", e sem atalho na linha o encerramento volta
a ser caso a caso no detalhe. `linha.casoIds` (ids das cirurgias abertas da
pessoa) ficou na lib, testado, para quando houver outra ideia.

**Painel da linha ganhou três assuntos, só na fila única:** **Hospital** (campo
próprio no override — quem troca de hospital no meio do sábado não tinha como
dizer isso), **Responsável** (troca o NOME mantendo a posição: assunção
unilateral pelo mesmo motor do dia útil — pedido do dono para "alguém de FORA da
escala fazer um turno específico") e **Posição na fila** (trocar de vaga com um
colega, duas assunções cruzadas numa transação; "pode deixar a opção, mas não é
a regra"). ⚠️ `ordem_liberacao` continua IMUTÁVEL nos três — muda quem ocupa a
vaga, nunca a ordem publicada.

⚠️ **DEFEITO CORRIGIDO: o seletor de Local abria VAZIO no fim de semana** — a
chave saía de `hospitalLabel.toLowerCase()`, que ali vale `"fim de semana"`
(inexistente em `LOCAIS_BASE`), e o complemento vinha de `escala.casos`, que na
linha 'fds' é SEMPRE vazio. Era por isso que `local` nunca havia sido usado num
sábado. Agora a lista é a união dos três hospitais, estreitando quando há
hospital escolhido na linha.

⚠️ **`executarSubstituicao`/`desfazerSubstituicao` passaram a resolver ONDE O
CASO MORA**: na fila única a linha 'fds' não guarda caso nenhum, e o snapshot de
rollback e o patch otimista liam `lado.hospital` — a reversão não restauraria
nada e o quadro só pintaria no realtime.

⛔ **NADA DISTO ATRAVESSA PARA O DIA ÚTIL (dono 24/08, 2ª mensagem):** *"solicitei
alguns ajustes para escala do final de semana e esses ajustes ficaram para a
escala de dias úteis — não quero que sejam aplicadas em dias úteis. Faça apenas o
solicitado."* A primeira versão adotou CINCO coisas do protótipo do fim de semana
também no dia útil, e as cinco voltaram: o **recado do plantonista** (cartão com
rótulo + "Confirmar leitura" de largura inteira → volta a faixa de borda a borda
de 17/08 com a pastilha "Confirmar" no canto); o **"Importar"** do cabeçalho
(outline sem ícone → volta a `ghost` com o ícone); a pastilha **"Assumir"** no
bloco de sem-anestesista (→ volta "Toque para definir o anestesista"); e a
**ordem do card** (hospital isolado + sala ANTES dos
cirurgiões → volta sala ABAIXO do cirurgião, desenho de 20/07). O gate é
`modoFds` em cada ponto. (O "Terminei" saiu de vez horas depois — ver acima.)

⚠️ **PUBLICAÇÃO PINTA TODO MUNDO DE VERDE na fila única (dono 24/08):** "ao
publicar escala de final de semana, todos os usuários apareçam com o card verde".
A cauda vermelha automática (21/08) e o card BRANCO de "Livre" (20/08) nasceram
do DIA ÚTIL, onde o rodapé traz gente que fecha a lista sem cirurgia nenhuma. Na
fila única quem está publicado ESTÁ de plantão, e o mapa cirúrgico chega em
importação SEPARADA — muitas vezes depois: metade da lista nascia descolorida ou
vermelha, dizendo "já foi embora" de quem tinha acabado de entrar na escala. Em
`modoFds` o vermelho volta a ser só do toque humano. O BADGE "Livre" fica — é
informação verdadeira ("sem cirurgia agora") e não some com a tinta. Medido em
22/08 depois da mudança: 12 cards, 0 liberados automáticos. O dia útil mantém as
duas regras. ⚠️ **A pastilha do alerta SAIU (dono 24/08, 3ª volta no mesmo elemento):**
"Toque para definir" (dia útil) → pastilha "Assumir" só no fim de semana →
"Adicionar anestesista" → **a pastilha sai e vale a FRASE ABAIXO nos dois
modos**. O que decidiu foi a medida, não o gosto: inline a pastilha comia **48%
da linha** (183px de 378) e sobravam 195px para hora, hospital, sala,
procedimento e cirurgião — a sala ainda não truncava, mas por pouco. Abaixo, o
texto recupera a linha inteira (**376px** medidos no app) por 22px de altura, e o
alerta volta a ser UM código só: era pastilha no sábado e frase na segunda para o
mesmo gesto. O card inteiro segue sendo o alvo. Travas: describe "fila única — ninguém nasce vermelho na
publicação" em `escalaFdsTelaUnica.test.jsx`.

⚠️ A regra geral, que já vale para a IMPORTAÇÃO desde 22/08 e agora vale para a
TELA: melhoria nascida de um protótipo de fim de semana fica no fim de semana. O
dia útil é o fluxo estabelecido de uma equipe em uso clínico diário — mudança
visual ali é retreinamento, e precisa de pedido próprio (Regra #2).

Travas: `escalaFdsTelaUnica.test.jsx` (barra sem os eixos, card, os três
assuntos, Local não-vazio, o describe "sem 'Terminei' na fila" — que guarda o
caminho inteiro do botão para ele não voltar sem decisão nem a remoção parecer
esquecimento — + o describe **"o desenho
da fila única não atravessa para o dia útil"**, que é a trava da FRONTEIRA — ela
já foi cruzada uma vez); `liberacoesAvisoPlantonista.test.jsx` cobre as DUAS
formas do recado, uma por dia; `escalaTurnoAutomatico.test.jsx` prende o ícone do
"Importar" no dia útil. ⚠️ um teste MUDOU DE LADO com o porquê no corpo, em vez de
sumir: o de 16/08 que exigia o seletor de hospital no FDS.

### FERIADO — a mesma fila única, com uma LISTA no lugar da grade (dono 24/08)

Feriado roda como fim de semana na vida real (plantão 07h→07h, um anestesista
cobrindo os três hospitais) e rodava como dia útil no app. Agora `ehDataFilaUnica`
= sáb/dom **ou** feriado, e o feriado entra pelo MESMO caminho do FDS — linha
pseudo-hospital `'fds'`, `ImportarEscalaFdsPage`, `LiberacoesView modoFds`, tela
única. Não existe um terceiro modo.

⚠️ **A fonte do feriado é `FERIADOS_2026` (`src/data/plantao2026.js`)** — a MESMA
lista de `isPlantao24h`, que é literalmente a condição "este dia roda plantão de
fim de semana". **Não usar `FERIADOS_UTEIS`** (`feriasFeriados.js`): aquela é de
contagem de FÉRIAS e exclui de propósito 24/12, 25/12, 31/12 e 01/01 (lá o fim de
ano é RECESSO), além de não ter 15/11 — dias em que o hospital roda escala de
feriado e a fila única precisa ligar. `ehDiaUtil` NÃO muda: o plantão noturno e a
escala de funcionárias seguem com as próprias regras.

**O documento é uma LISTA SIMPLES de nomes** ("FERIADO 25/08" + 22 nomes), sem
grade P1–P4, sem posições numeradas e sem a linha "1º→último a ser liberado" do
FDS. Daí: sem a numeração Pn DA GRADE (P1–P12), sem P4-coringa, sem fila da
noite (`fase` fixa em `'dia'` — derivada da DATA, não de `fdsMeta.tipo`, que só
existe depois de publicar), e o seletor com dois turnos.

**SELOS P1–P4 DO PLANTÃO — a fonte é a do DIA ÚTIL (dono 25/08):** "informe quem
são os plantões (P1–P4) assim como já é informado nas escalas de dias úteis;
apenas nos feriados, já que dias úteis e finais de semana já possuem essas
marcações". Vêm do **card Plantões** (`plantoes` → `plantonistasNoturnos` →
`marcarSelosNoTurno`), que é onde os P1–P4 do dia existem — a folha do feriado
não traz posição nenhuma. Uma condição: `avisarSelos` deixou de ser exclusivo de
`!modoFds`; `ehDiaUtil` (true numa terça) é o que segue excluindo sáb/dom. Como
no dia útil, o selo é **da PESSOA e vale nos dois turnos**, acompanhando a
posição dela em cada fila.

⚠️ **duas numerações, um badge — não misturar.** Sáb/dom ficam fora por motivo
DIFERENTE do dia útil: lá os Pn saem da GRADE do documento e vão até **P12**,
sendo posições da ESCALA, não o plantão do dia. Por isso `marcarSelosFds` é
PULADO no feriado (`modoFds && !feriado`): na prática `posicoes` é `{}` ali, mas
um meta legado bastaria para pôr P7/P8 no mesmo selo que significa "plantão".

⚠️ **P do card sem linha na folha NÃO vira card** (confirmado pelo dono 25/08):
naquele dia o card Plantões trazia P3 Fernando Henrique e P4 Rômulo, nenhum dos
dois na lista de 22 nomes — sem card na fila, não há o que marcar, e sintetizar
linha seria inventar presença. Só P1 e P2 apareceram, e está certo assim.

⚠️ **SENTIDO DA FILA — errar aqui inverte tudo, e foi o defeito de 24/08** ("a
ordem de liberação veio invertida"). A folha do feriado **já vem na direção do
RODAPÉ**: quem está no TOPO é quem FICA até o fim da manhã, e a CAUDA sai
primeiro. A folha de 25/08 prova sozinha — os **13 primeiros nomes são
exatamente os 13 com cirurgia de manhã** nos mapas de Unimed e HRO, e os 9
últimos (ROSE → GUILHERME DIDOMENICO) não têm nenhuma; esses mesmos 9 cobrem as
9 salas da tarde. Quem não tem cirurgia é quem vai embora primeiro, e é por isso
que está no fim da folha. Então: **manhã = a folha na ordem escrita · tarde = a
folha de trás para frente**. A tela da manhã lê igual ao papel.

A inversão continua ACONTECENDO UMA VEZ SÓ, na publicação: `ordensDocumentoFeriado`
devolve a convenção do DOCUMENTO (manhã invertida, tarde direta) e
`rodapeDeOrdemDoc` faz a única volta, como no FDS. ⚠️ **a CONFERÊNCIA mostra e
edita a folha na ordem escrita** — é a transcrição do documento, e Subir/Descer/
Remover indexam por ela; exibir a lista já invertida por turno faz o botão mexer
na pessoa errada, em silêncio (defeito real, corrigido antes de sair).

**Os mapas cirúrgicos entram na MESMA entrada**, como no FDS de 22/08, e o caso é
o do fim de semana, INTEIRO. ⚠️ não reduzir o caso a sala/cirurgião/anestesista
"porque é só o que o card mostra": isso derruba o **convênio**, e é o convênio que
o trigger `fn_sync_cirurgia_particular` casa para abrir a cobrança — só o mapa da
Unimed de 25/08 traz 6 PARTICULAR.

**SELO DE PLANTÃO — os DOIS QUE FECHAM A FILA DO TURNO (dono 25/08):** "o
primeiro e segundo nomes da lista sempre serão plantão de algum hospital conforme
ordem de liberação (**ou seja os dois últimos a serem liberados são os
plantões**)" — é também a confirmação independente do sentido da fila. No FDS o
selo sai da grade P1–P4 da faixa; no feriado, das **posições 1 e 2 da ORDEM
PUBLICADA do turno exibido**, que por convenção do rodapé são os dois últimos a
sair → "Plantão Unimed"/"Plantão HRO" (o genérico "Plantonista" segue suprimido
na fila única, como no FDS — ele diria menos). Sem cirurgia no dia inteiro cai no
genérico. ⚠️ o HOSPITAL vem das cirurgias do **DIA** (`hospitaisDoDia`), não do
turno: quem fecha a fila pode já estar sem cirurgia naquele turno, e pelo mapa do
turno o selo perderia o hospital justamente aí.

⚠️ **É POSICIONAL, não da pessoa — e isso foi corrigido no MESMO DIA.** A 1ª
versão saía de `fdsMeta.listaFonte` (a folha, que não vira) e valia nos dois
turnos, com o argumento de que o plantão do feriado é 07h→07h. O dono recusou
olhando a tela da tarde: *"na escala da tarde, os dois últimos a serem liberados
devem receber o badge de plantão e os primeiros a serem liberados (que foram os
plantões da manhã) devem perder os badges"*. O motivo é o que o selo COMUNICA
numa fila — **quem ainda vai ficar**: preso à folha, de tarde ele marcava quem
estava indo embora PRIMEIRO e não dizia nada sobre quem ficaria até a noite. Como
a tarde é a folha invertida, ler a ordem do turno dá o mesmo resultado de manhã e
troca os donos à tarde, sem regra extra. **`EscalaCirurgicaHomeCard` mudou
junto** (mesma fonte, turno do relógio compartilhado): preso à folha, ele passaria
às 13h a nomear na Home quem a fila já mostra saindo. Travas: describe "feriado"
em `escalaFdsTelaUnica.test.jsx` — fixture com **QUATRO** nomes de propósito, já
que com dois a folha e a ordem invertida contêm as mesmas pessoas e QUALQUER
regra passa (foi assim que a 1ª versão atravessou os testes) — e o caso das 14h
em `escalaCirurgicaHomeCard.test.jsx`. `fdsMeta.listaFonte` continua GRAVADO como
transcrição do documento, mas nenhuma tela deriva dele.

**O LOGIN NASCE PREENCHIDO PELO NOME LIDO (dono 25/08):** "identificou o
anestesista (cabeçalho) mas o campo abaixo deixou 'sem anestesista'". A
conferência do mapa só pré-selecionava pelo POSTO DA GRADE (22/08), que alcança
apenas grupo SEM nome — e no feriado não há grade. `sugerirAtribuicoesLidas`
resolve o nome do documento pelo dicionário, como a conferência de DIA ÚTIL já
fazia; não vira "sugestão" na tela (o nome é do documento, o dicionário só diz a
qual login pertence — diferente do posto, que é palpite e segue rotulado). Fora
de propósito: "?" (ausência é informação), nome que o dicionário não resolve
(escolha humana) e DUPLA "A + B" (um login não representa dois). ⚠️ **não havia
perda de dado** — `aplicarAtribuicoes` recebe o `resolver` e já caía no
dicionário na publicação; o defeito era a conferência não mostrar o que ia
acontecer. Efeito aceito: com o login resolvido o cabeçalho do grupo mostra o
nome do CADASTRO, como a sugestão do posto já fazia.

**HOSPITAL E DIA DO MAPA SEMPRE EDITÁVEIS (dono 25/08, "há possibilidade de
confusão? e se houver como resolver?"):** os dois Selects só nasciam quando a
leitura FALHAVA, então leitura CONFIANTE E ERRADA era beco sem saída — remover e
reanexar reclassifica igual. ⚠️ o risco é concreto: o mapa do HRO **de feriado**
não tem coluna ANEST (o anestesista vem em "Observação") nem rodapé vermelho —
as duas assinaturas do HRO no prompt — e casa quase palavra por palavra com a
descrição do MATERNO. `redefinirMapa` já re-chaveava e re-preparava o lote com
as salas canônicas do hospital novo; só faltava o caminho até ele.

**CAUDA VERMELHA: SÓ NA MANHÃ DO FERIADO.** O mapa desta linha, por turno:

| | cauda vermelha? |
|---|---|
| dia útil (manhã e tarde) | sim — regra de 21/08 |
| **feriado, MANHÃ** | **sim** (dono 25/08: "os usuários que não tiverem casos deixe como liberados") |
| **feriado, TARDE** | **não** |
| sáb/dom, os dois turnos | não — decisão de 24/08 |

A manhã do feriado entrou porque ali lista e mapas chegam JUNTOS, na mesma tela:
"sem caso" é informação de verdade, e a manhã de 25/08 saiu certa assim (1–13
trabalhando, 14–22 liberados). ⚠️ **O VESPERTINO DA FILA ÚNICA FICA FORA POR
REGRA, não por acidente** (dono 25/08, fim da tarde): *"as escalas vespertinas,
na maioria das vezes, estarão sem anestesistas escalados... mantenha o esquema de
todos estarem livres e não liberados; os ajustes nos períodos vespertinos serão
feitos manualmente"*. Em 25/08 o mapa da tarde chegou com as 18 cirurgias sem um
único anestesista nos dois hospitais, e a guarda `temAlguemComTrabalho` (22/08)
já segurava o vermelho — **mas por acaso**: bastaria UM nome designado no anexo
para a guarda cair e a fila inteira atrás dele nascer vermelha. O corte por turno
(`caudaAutomatica = !modoFds || (feriado && turnoBase === 'matutino')`) é o que
torna isso estável quando a tarde vier parcialmente preenchida — caso previsto
por ele na mesma mensagem ("se alguma escala dos feriados e finais de semana
vierem com anestesistas designados, faça a distribuição conforme os anexos").
O badge "Livre" continua nos dois turnos: a tinta sai, a informação não.

⚠️ o teste que trava isso usa uma tarde com DOIS colegas já designados, de
propósito — com a tarde 100% vazia a guarda de 22/08 mascara a diferença e
qualquer regra passa. Conferido que ele FALHA com a regra anterior (2 cards
vermelhos) antes de entrar.

Herda de graça do modo FDS: badge "Livre" para quem está sem cirurgia, hospital
em caixa alta no card, a ação do alerta como frase abaixo do texto. Travas:
describe "feriado como data de fila única" em `escalaFds.test.js` — com o invariante que roda `gerarColunaLiberacao`
sobre o rodapé publicado e afirma QUEM é o próximo a ser liberado em cada turno,
que é o que protege contra uma re-inversão (asserção de string não protege) — +
o describe "FERIADO" em `importarEscalaFds.test.jsx` (publicação nos dois turnos
e o alinhamento entre o que a tela mostra e o que Descer move) + e2e
`escala-cirurgica-feriado.spec.ts` sobre a fixture DEV `DEMO_DATE_FERIADO`.

### FDS — fila completa e o fim do vermelho em massa (dono 22/08)

Duas queixas no mesmo dia, sobre a escala de 22–23/08 publicada pelo app.

**"Estão faltando colegas"** (domingo e noite): a linha de ordem do documento é a
fila, mas quem está ESCALADO no turno e não foi citado nela **nunca some** —
regra já estabelecida em 16/08 para a noite ("apenas adicione os P's faltantes"),
que vale para qualquer turno. No domingo o bloco traz uma linha só (`P1 P2 P3
P4`) e cita à parte 8º OSCAR, 7º GUILHERME DIDOMENICO e EMERGENCIA: 11º THAYNA —
os três ficaram fora da fila. O slot de cada faltante vem de `sugerirRodapeFds`
(postos na frente · numerados no meio · retaguarda no fim), que é a forma que o
PRÓPRIO documento usa na manhã de sábado, onde P4/P3 são a retaguarda e saem
primeiro. ⚠️ turno com UMA linha só no bloco = a linha é do MATUTINO; o
vespertino nasce da grade daquele turno (marcado "sugerida") — aplicar a mesma
linha nos dois punha Daniela/Rômulo à frente numa tarde cujo plantão é
Karine/Gabriel, e sumia com Matheus e Cristina, que só existem na faixa 13-19.

**Fila inteira vermelha:** a tarde de sábado saiu com 8 cirurgias sem
anestesista definido e os 7 nomes nasceram LIBERADOS de uma vez, antes de o turno
começar. Causa: `idxUltimoTrabalho` é -1 quando NINGUÉM tem cirurgia, e `idx >
-1` é verdade para a fila toda. A cauda é o que vem DEPOIS do último nome com
trabalho; sem esse nome não há depois, e vale a regra de 20/08 — ninguém nasce
liberado. Guarda `temAlguemComTrabalho` em `LiberacoesView`; travado em
`escalaCirurgicaPersonas.test.jsx` (describe "sem ninguém em cirurgia não há
cauda"), com o caso inverso junto: um nome com cirurgia e a cauda volta a nascer
liberada. Acontece sempre que o mapa do turno chega sem anestesista — o mapa do
HRO de fim de semana traz a coluna vazia à tarde.

### "Passa para tarde" PERSISTE na tarde (dono 22/08)

O marcador existia desde 20/08 mas só pintava o badge no turno de ORIGEM: a
cirurgia continuava só na manhã e, na tela da tarde, quem estava nela aparecia
SEM CASO — sumia da conta de quem está ocupado bem no turno em que ela vai
acontecer. Agora ela ATRAVESSA: `casoSegueParaOTurno` (utils, puro) +
`filtrarPorTurnoExibicao` põem a cirurgia matutina marcada também na tarde, e
`casoConcluido` (terminada OU suspensa) encerra a travessia — a mesma pergunta
"ainda ocupa alguém?" que decide vaga e cronômetro no resto do módulo. Só
matutino→vespertino: à tarde o rótulo é "Passa para noite" e a noite já enxerga
os casos da tarde (`FDS_TURNO_CASOS.noturno`).

Superfícies: **Completa** entrega a cirurgia ao MESMO grupo "Ainda abertas —
Manhã" que as urgências herdadas já usam (o grupo existe e foi escolhido para
exatamente esta forma de problema; a diferença é a origem — urgência vem do
contrato do HRO, esta vale em qualquer hospital) · **Minhas** e a **fila de
Liberações** contam a cirurgia na tarde. ⚠️ o badge "Passa para tarde/noite" da
FILA continua saindo só do caso DAQUELE turno (`turnoDoCaso(c) !== turnoBase`
pula): o rótulo nomeia quem SAI do turno, e ela entrou nele.

⚠️ **`filtrarPorTurno` continua ESTRITO** e é ele que TROCA e posição usam —
regra estruturante de 13/08, turno é filtro e nunca preferência. Mover a
cirurgia da manhã ao trocar a posição da TARDE reatribuiria caso de outro turno.
Travas: `escalaPassaDeTurno.test.js` (invariante "alcançável na tarde, uma vez
só" + o que não pode mudar junto) + caso na `escalaCirurgicaPersonas.test.jsx`.

### A fila é da ORDEM PUBLICADA, não da lista na tela (dono 24/08)

Relato: *"ao adicionar a escala vespertina deixou: Vicente (livre), Gabriela
(próximo a ser liberado). Vicente não tinha procedimentos na escala, o correto é
estar liberado, e Gabriela não estava na escala e foi adicionada como 'ajuda'.
Nenhum dos dois apareceu na tela de confirmação antes da publicação... esse erro
está aparecendo com frequência."* Três sintomas, **uma causa**: a travessia de
22/08 pôs na fila da tarde alguém que não estava no turno, e a linha dela
deslocou a fronteira da cauda.

Reconstruído dos dados (Unimed, 24/08): a cirurgia da **Gabriela** das 07:00 na
CC - Sala 10 foi marcada "passa para tarde" e ficou `agendada`; à tarde ela
estava escalada no **HRO** (15º do rodapé de lá). A regra de 22/08 trouxe a
cirurgia para a tarde da Unimed, a lib não a achou no rodapé e a devolveu como
**visitante** no fim da lista — badge "Ajuda" e "próximo a ser liberado" para
quem nem estava no hospital. E como ela vinha DEPOIS do Vicente e tinha caso,
virou o "último nome com trabalho": o Vicente, 14º e último da ordem com
cirurgia nenhuma, saiu de LIBERADO para "Livre".

- **A cauda é da ordem** (`linha.noRodape`, novo na lib): a exibição acrescenta no
  fim extras, ajudas e visitantes, e nenhum deles ocupa posição na fila — então
  nenhum deles define onde a fila termina nem nasce liberado por estar depois do
  fim dela. Antes a fronteira era o último índice da LISTA, e qualquer visitante
  com cirurgia a empurrava; é por isso que o sintoma era frequente (visitante de
  outro hospital é rotina). `proximoPlantao` continua sendo do rodapé, mesmo
  exibido por último.
- **A travessia conta, não cria** (`casosDaFilaDoTurno` em utils, no lugar de
  `filtrarPorTurnoExibicao` SÓ na LiberacoesView): a cirurgia que atravessa o
  turno entra na fila de quem **já está** no turno — nome na ordem publicada ou
  cirurgia própria dele — e nunca inventa posição para quem não está. O Humberto,
  que também tinha uma marcada "passa para tarde" e ESTÁ no rodapé da tarde,
  segue com a cirurgia na linha dele (era o comportamento certo desde 22/08). A
  cirurgia da Gabriela **não some**: continua no quadro da **Completa**, no grupo
  "Ainda abertas — Manhã", e na aba **Minhas** dela — lá a pergunta é "esta
  cirurgia existe?", na fila é "quem está nesta fila?". Identidade tolerante por
  desenho (`chavesIdentidade`: uid E nome, as duas metades de uma dupla "A + B"):
  casar demais preserva o comportamento de hoje, casar de menos some com a linha
  de quem está trabalhando.
- **A conferência passa a dizer o que vai acontecer** — era a queixa do "não
  apareceu na tela de confirmação". O aviso de 23/07 fala de SUSPEITA ("confira a
  extração"), e quem lê conclui que está tudo certo. Agora quem fecha a ordem sem
  cirurgia é **nomeado**, com a consequência ("vai nascer LIBERADO (vermelho) na
  fila"), e a cirurgia da manhã que atravessa sem dono presente vira pendência
  própria com sala, hora e cirurgião. ⚠️ **um aviso por nome**: quem está na cauda
  sai do aviso de extração (dizia a mesma coisa e contava a pessoa duas vezes no
  contador de pendências); o ponto âmbar na posição cobre os dois casos. A
  conferência agora busca também a escala JÁ PUBLICADA do próprio hospital — é
  dela que saem as cirurgias marcadas, que o lote em conferência não contém.
- Travas: describe "a cauda é da ORDEM, não da tela" (recorte real de 24/08:
  Humberto · Raul · Vicente · Gabriela visitante · Didomenico) + "passa para tarde
  de quem não está na tarde" em `escalaCirurgicaPersonas.test.jsx`; invariante "a
  travessia não inventa gente na fila" em `escalaPassaDeTurno.test.js`; os dois
  avisos novos em `importarEscalaConferenciaAncoras.test.jsx`.

### Sincronia das superfícies de urgência (dono 21/08) — uma derivação, um relógio, um "acabou"

Relato: *"ao finalizar uma cirurgia de urgência ela não está sincronizada com as informações no
topo — Raul ao finalizar no card da Completa não finalizou no mostrador, e vice-versa"*. **Não era
bug de escrita** (os dois pontos que gravam status chamam a mesma action, no mesmo `escala.casos`):
era **escopo**. A faixa lê o DIA INTEIRO (regra do contrato, "ocupação é do relógio") e o quadro só
o turno. Medido em produção em 21/08 às 15h: das **5 urgências abertas do HRO, 4 eram da manhã** —
na aba Tarde o quadro mostrava UMA, e as outras quatro não tinham card para tocar.

- **`casosHerdados(estado, turno)`** (lib) devolve o que a faixa CONTA e não é do turno; a
  `BoardView` renderiza num `AccordionItem` **no FIM**, "Ainda abertas — Manhã" (escolha do dono:
  no fim, não no meio das salas). Sai do MESMO `estado` da faixa — derivadas da mesma fonte, as
  duas não têm como discordar. ⚠️ o EmptyState "nenhum caso neste turno" passou a conferir também
  as herdadas: o turno vazio é exatamente quando elas precisam ser vistas.
- **`useEstadoUrgencias`** é a única porta da UI para `estadoUrgencias`. Antes, faixa e
  "Adicionar caso" montavam os `opts` à mão e divergiam no `hojeIso` — numa escala de outro dia um
  aplicava a linha da NOITE e o outro a da manhã, e o formulário dizia "CO · ocupado" ao lado de um
  card de CO livre. `estadoUrgenciasDaEscala` normaliza; `estadoUrgencias` segue exportada porque é
  ela que os testes de REGRA exercitam.
- **`src/lib/escalaCirurgicaStatus.js`** é a fonte única de "acabou?" — a frase estava em QUATRO
  lugares. São **duas perguntas e continuam duas**: `casoConcluido` ("ainda ocupa alguém?" —
  terminada OU suspensa, decide vaga/cronômetro) e `casoTerminado` ("quem responde pelo registro?"
  — só terminada; é o que a TROCA usa, porque cirurgia suspensa acompanha quem assume a sala).
  Unificar num booleano só mudaria o comportamento da troca sem pedido.
- **`useAgoraMinuto` virou store de módulo** (`useSyncExternalStore`): sete superfícies tinham cada
  uma o seu `setInterval` e podiam ficar 30s defasadas justamente nas fronteiras que decidem o que
  aparece (13h, 19h, 15min da suspeita, 4h da esquecida). O `EscalaCirurgicaHomeCard` usava
  `new Date()` cru — sem tick e furando o devClock. ⚠️ `getSnapshot` devolve valor CACHEADO:
  recalcular no render dá tearing na virada do minuto.
- **`PATCH_CASOS` / `ADD_CASO` no reducer**: o rollback de `setStatusCirurgia` era a única action
  que revertia com `SET_HOSPITAL` + o snapshot do closure — num blip de rede descartava tudo que
  outra pessoa tivesse mudado desde a captura. E `adicionarCaso` era a única escrita de casos fora
  das guardas anti-atropelo (sem `marcarEscrita`), então um `loadData` em voo podia fazer o caso
  novo sumir. ⚠️ `PATCH_CASOS` **preserva a referência dos casos não tocados** — contrato do
  `React.memo` do `CasoCard`, travado em teste.
- **O carimbo entra no OTIMISTA e só no eixo PRINCIPAL.** `setStatusCirurgia(…, userInfo)` grava
  `statusAtualizadoEm/Por` no ato (a faixa lê esse carimbo para "em sala há X"; sem ele o tempo
  sumia até o realtime e um carimbo antigo mandava a cirurgia para "iniciada há 6h" e de volta — o
  "vai e volta"). Migration `20260821200000` para de carimbar no toggle de aviso: **provado em
  produção** na cirurgia da Rose (iniciada 14:33 → suspensa 15:01 → agendada 15:42, carimbo 15:42,
  que não é nada útil). `updated_at` continua em ambos — é ele que alimenta o realtime.
- **`carimboDeStatus`** põe "Iniciada às 14:33 por Fulano" no cartão Andamento do detalhe. É o
  antídoto do achado da literatura: quadro em que a equipe não confia AUMENTA a carga de
  comunicação (as pessoas ligam para confirmar). Sem autor no roster, mostra só a hora — nunca
  "por —"; carimbo de outro dia não vira horário solto.
- **Travas**: `escalaUrgenciasSincronia.test.jsx` tem o INVARIANTE ("tudo que a faixa conta está
  alcançável no quadro, e nada duas vezes") — é ele que protege, não a persona, porque o tema
  "isolar por turno" já regrediu três vezes neste módulo. Mais `escalaCirurgicaStatus.test.js`,
  `escalaRelogioUnico.test.jsx` e os casos novos em `escalaCirurgicaOtimista.test.jsx`.

### Resposta tátil da escala (dono 19/08) — otimismo + memo

O toque pinta ANTES do servidor em TODAS as marcações do módulo: dispatch
primeiro, erro reverte ao snapshot + toast (`toggleLiberacao`/`toggleEscalado`/
`setLinhaOverride`/`atualizarCaso`/`adicionarAjuda`/`removerAjuda` ganharam o
padrão que `setStatusCirurgia` já tinha — esperar o RTT Brasil→us-west-2 antes
de pintar foi o "delay" reportado pela 2ª vez). O toast de SUCESSO continua
atrás da persistência (honestidade F1.6: quem anuncia sucesso é o servidor);
action de escrita NOVA segue o mesmo desenho. Sheets fecham a folha/limpam o
rascunho no toque (rascunho digitado se perde se o servidor recusar — trade-off
aceito, o erro toasta). Render: `CasoCard` é `React.memo` com comparador que
IGNORA `onClick` (contrato: handler só pode depender de `caso` + setters
estáveis — call site novo respeita ou o card fica stale) e
`resolverAnestesistas` preserva a REFERÊNCIA do caso inalterado — juntos, um
toque re-renderiza UM card, não o quadro. Travado em
`escalaCirurgicaOtimista.test.jsx` (service com promise pendente = detector de
espera) + caso de referência em `colunaLiberacao.test.js`. Abertura de página
já era coberta: prefetch do chunk 6s pós-boot (`App.jsx`), sheets com import
estático, roster em cache SWR.

⚠️ **A recarga NÃO atropela o toque (2º round, mesmo dia** — "iniciada ia para
outra opção e voltava"): o repinte do cache por data em `loadData` é o SWR da
TROCA DE DATA (16/08) — na revalidação da MESMA data ele repintava o snapshot
de antes do toque até o fetch fresco chegar. Regras em `loadData`: realtime/
retomada/refresh/rollback chamam `{revalidacao: true}` (sem repinte de cache);
só a recarga mais nova aplica (`loadSeqRef` + data conferida); snapshot do
servidor NÃO aplica com escrita otimista em voo ou pintada durante o voo
(`escritasRef`/`mutSeqRef` — reagenda 800ms). Toda action otimista chama
`marcarEscrita()` após o dispatch e `encerrarEscrita()` no finally — action
nova sem o par reabre o vai-e-volta.

## Bottom Nav
4 abas: **Home** | **Gestão** (Shield) | **Educação** | **Menu**
(Dashboard temporariamente oculto; código preservado em `App.jsx`)

**Visual TRAVADO (dono 14/08):** barra SEM badge/dot (removido 2× — `8663996` e 13/08; estado clínico pertence ao card do módulo, não à navegação) e cor por TOKEN em `.bottom-nav-glass` (anest-theme.css): light `--muted` #E8F5E9 (nível 1 — o nível 0 #F0FFF4 sobre cards brancos lia como "barra branca"), dark `--background` #111916; borda `border-border`, sem inset/borda branca (viravam "filete" sobre o verde). O ramo iOS (blur off) usa os mesmos tokens.

⚠️ Bug conhecido: `src/App.jsx:1011` (TODO BUG-06) — global BottomNav pode duplicar com per-page BottomNav (createPortal). Decisão arquitetural pendente. Em página nova, **NÃO** renderizar BottomNav próprio.

## Orientação da tela — a tela do app é FIXA (dono 25–26/08)
Nada gira, exceto o que nasce deitado: **documento (PDF/anexo Office), vídeo e imagem em tela cheia** — e **sem
aviso nenhum** (a 1ª versão bloqueava com overlay "Gire seu dispositivo" e o dono recusou). Vale para **todos os
usuários, em qualquer sistema**, embutido no app: nada de configuração por aparelho. ⚠️ **não existe API que
trave a rotação no iPhone** — `lock()` é recurso EXPERIMENTAL do Safari desde o 16.4 (Ajustes → Safari → Avançado)
e o `orientation` do manifest o iOS ignora —, então a trava tem duas camadas em `src/lib/orientacaoTela.js`: o
lock nativo (Android/PWA; ⚠️ liberar é `lock('any')`, **nunca `unlock()`**) e a **contra-rotação por CSS** — com
o aparelho deitado o `<body>` gira de volta e o app fica em pé em relação ao aparelho, como um app que não
suporta paisagem. A exceção é PEDIDA por `useLandscapePermitido()` e devolvida ao desmontar (contador, não
booleano); pedem `PDFViewer`/`VideoPlayer` do DS, `PDFEmbed`, `AulaPlayerPage`, `ExpandedImageModal` e o anexo
Office do comunicado — prévia em formulário de ADMIN fica FORA.
⚠️ **Quem decide compensar é a MEDIA QUERY, não o JS**: o `orientationchange` do iOS chega ANTES de a viewport
virar, então decidir no JS lia "retrato", não compensava, e só o `resize` seguinte corrigia — dava para VER o app
deitar e voltar (relato do dono 26/08). Ao JS sobra o SENTIDO (`.rot-cw`) e a exceção (`.landscape-liberado`).
⚠️ **A regra é só de CELULAR** (dono 26/08: "em ipads, tablets a tela pode girar"): `max-height: 500px` separa
celular deitado de tablet e `pointer: coarse` tira o desktop. Esse corte é DO DONO — no meio do caminho eu o
removi supondo que fosse a causa do "continua rodando", e ele corrigiu na hora. Vale para TODOS os usuários,
sem ninguém configurar nada no aparelho ("quero que seja uma função nativa do aplicativo"). Três consequências do transform: é o **`<body>`** e não o `#root` (todo portal do DS monta em
`document.body`); o `<body>` vira o containing block dos `fixed` **e o que ROLA** — daí `rolarAoTopo()`
(`src/utils/rolarAoTopo.js`); e ⚠️ **as unidades de viewport não sabem da rotação** (`vh` mede a tela física), o
que espremia a página numa faixa — na tela virtual ALTURA é `100vw` e LARGURA é `100vh`, com traduções GERADAS em
`index.css` travadas por `unidadesViewportRotacao.test.js`. ⚠️ **o que não dá para eliminar**: a animação de
rotação do próprio iOS, que é do sistema (só app nativo, via `Info.plist`, trava isso). E o preço: a ACT rule
b33eff do W3C reprova a técnica como falha do **WCAG 2.1 SC 1.3.4 (AA)** — cabe na exceção "orientação
essencial", decisão do dono. Detalhes: `.claude/rules/responsividade.md`.

## Skills (`.claude/skills/`) — invocar com `/`
`/calculadoras` `/educacao` `/gestao-documental` `/centro-gestao` `/notificacoes` `/nova-pagina` `/supabase-migration` `/rotacao-residencia` `/importar-plantoes-residencia` `/escala` `/escala-cirurgica` `/cirurgias-particulares` `/cateter-peridural` `/criar-prompt`

> `/escala` substitui as antigas `/sobreaviso` e `/hospitais`: um docx único por mês (template gerado pela própria skill) importa as duas escalas de uma vez.

## Rules (`.claude/rules/`) — auto-aplicadas neste projeto
`design-tokens` · `responsividade` · `navegacao` · `lgpd` · `qmentum-compliance` · `supabase-firebase` · `padroes-codigo` · `audit-trail` · `prompting`

## Referências em `docs/`
escalas-plantoes · cateter-peridural · cirurgias-particulares · escala-cirurgica (+ -analise-adesao, -evolucao-tecnica) · organograma · formularios-publicos · etica-comites · residencia · incidentes-denuncias · comunicados-inbox · faturamento · desastres · planos-acao · project-phases

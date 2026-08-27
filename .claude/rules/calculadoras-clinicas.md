---
paths:
  - "src/lib/anticoagulantes.js"
  - "src/lib/inibidoresApetite.js"
  - "src/lib/agrupamentoFarmacos.js"
  - "src/design-system/showcase/**"
  - "src/design-system/data/calculator-definitions.js"
  - "src/data/criteriosUtiCalculators.js"
  - "src/pages/CriteriosUTIPage.jsx"
  - "src/__tests__/lib/anticoagulantes*"
  - "src/__tests__/lib/inibidoresApetite*"
  - "src/__tests__/lib/agrupamentoFarmacos*"
  - "e2e/inibidores-apetite*"
description: Calculadoras clínicas (71 em 13 seções) — padrão de lib pura + display, Anticoagulantes, Inibidores de apetite, agrupamento por medicação
---

<!-- Movido do CLAUDE.md em 2026-08-26 (otimização de contexto): o arquivo passou de
     1.603 linhas para o alvo oficial de <200. O texto abaixo está VERBATIM — nenhuma
     decisão do dono foi editada ou resumida. Esta rule carrega SÓ quando o Claude lê um
     arquivo que casa os `paths` acima. -->

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

⚠️ **CONTRASTE DOS BADGES — medido em 26/08 contra WCAG AA (4,5:1), vale para o app inteiro:**

| variante | `subtle` | `solid` |
|---|---|---|
| **default** (verde institucional #004225) | **9,71 ✓** | **11,63 ✓** |
| warning | 1,99 ✗ | 9,78 ✓ |
| destructive | 4,13 ✗ | 4,83 ✓ |
| secondary | 4,27 ✗ | 4,83 ✓ |
| info | 3,54 ✗ | 4,02 ✗ |
| **success** | 2,04 ✗ | **2,22 ✗** |

**Só o `default` passa em `subtle`, e o `success` reprova ATÉ sólido** — #34C759 é claro demais para texto
branco. Daí as regras nos dois cards de consulta: `subtle` só com `default`; status colorido sempre `solid`; e
NADA usa `success` com texto — vira `default`, que mantém o sentido "ok" e passa com folga. Sobre o cabeçalho
tonal (#D4EDDA) o `secondary` cai para 3,90, então lá os atributos usam `default` outline (9,37). ⚠️ Os tokens
NÃO foram mexidos (alcançariam o app inteiro); a correção é por uso. Outros displays ainda usam `success` com
texto (`BalancoHidricoTransopDisplay`, `SofaDisplay`) — não tocados, ficam para decisão do dono. Trava no e2e
mede o RENDERIZADO compondo o alfa sobre o primeiro ancestral opaco: sem isso o rgba do badge é comparado com
ele mesmo e dá razão 1 (foi o que o meu 1º medidor fez).

⚠️ **Cabeçalho do fármaco em tom de destaque** (dono 26/08): `bg-accent dark:bg-card dark:border dark:border-border`
— a MESMA receita do `EscalaCirurgicaHomeCard`, que é o padrão do app para cartão que se destaca sem virar
alerta. No escuro o `accent` (#212D28) fica quase igual ao `card`, por isso lá o destaque vem da BORDA. Vale
para os dois cards de consulta e para a tela das apresentações.

⚠️ **O `Alert` do DS tem `border-l-4`** (alert.jsx:9) — a borda esquerda grossa destoava dos demais cards. Anulada
LOCALMENTE com `border-l` na className (tailwind-merge resolve a favor da última); mexer no `alert.jsx`
alcançaria todos os alertas do app.

⚠️ **O título da calculadora pagava DOIS padding-top**: a página do App dá 16px e o `CalculatorShowcase` dava
outros 12, contra 16px abaixo — o dono viu o desequilíbrio. Com `pt-0` no container, os dois vãos ficam em 16px.
Vale para as 71 calculadoras.

⚠️ **O voltar mora em cartão PRÓPRIO**, separado do da medicação (dono 26/08: "está colado"). Continua no fluxo
do scroll — não flutua sobre o cabeçalho fixo, que era o motivo de ele estar dentro do card.

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

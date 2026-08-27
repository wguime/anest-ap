# Revisão do sistema de calculadoras — ANEST

> Prompt de trabalho. Escrito em 26/08/2026 a partir de levantamento no repo, não de memória.
> Os números abaixo foram conferidos; se divergirem do que você encontrar, **confie no repo e corrija este texto**.

---

## ⚠️ COMEÇA AQUI — estado da retomada (26/08, ~22h)

**Há um commit pronto e NÃO empurrado**, por decisão do dono: esperar a outra sessão terminar o modo `deitado:`
para não gerar conflito.

```
6409650  fix(calculadoras): SAPS III não gravava nenhuma seleção   ← este trabalho
901422b  fix(deitado): cards por LINHA e faixa lateral…            ┐
559c651  feat(deitado): Home, Gestão e Menu na horizontal          ├ outra sessão
ed76afd  feat(deitado): fundação do modo horizontal                ┘
```

**Ao retomar, nesta ordem:**

1. **Confirme que a outra sessão fechou.** Ela tinha 6 arquivos ainda em edição — `HomePage.jsx`,
   `GestaoPage.jsx`, `PageHeader.jsx` e três de `escala-cirurgica/`. Enquanto houver `M` neles, o trabalho está
   em curso. ⚠️ A árvore é compartilhada: `git add` de caminho amplo leva o que a outra sessão está escrevendo.
2. **Rode a suíte no COMMIT, não na árvore.** A combinação que vai ao ar (commits deles + o meu, sem as edições
   em curso) nunca foi verificada — o que rodou verde aqui incluía as edições não commitadas.
3. **Só então empurre.** O CI está operacional e deploya sozinho a partir de um checkout limpo.
4. ⚠️ **Não deploye manualmente daqui**: `npm run build` compila o *working tree*, não o HEAD, e levaria junto o
   que estiver em edição.

**O que já está feito e verificado** (não refaça): a SAPS III foi corrigida e conferida no navegador — escore
32 → 47 ao escolher "75-79 anos (15 pts)". O restante deste documento é o plano, ainda não executado.

⚠️ **A Frente 7 (celular deitado) foi escrita ANTES de eu descobrir os 3 commits acima.** A outra sessão já
construiu a fundação — variante `deitado:`, navegação lateral, Home/Gestão/Menu. Releia a Frente 7 como
"aplicar o que já existe às calculadoras", não como "criar o modo horizontal".

---

## Por que esta revisão existe

As 71 calculadoras são consultadas por anestesiologistas **no celular, durante o ato anestésico**. Erro de conta é
risco ao paciente; tela confusa custa segundos que ninguém tem. O dono pediu quatro coisas de uma vez — revisão de
DS, revisão da matemática, agrupamento das "calculadoras" que não calculam, e português em tudo — porque são
sintomas do mesmo descuido acumulado.

Pronto quando: `npm run build` passa, `npm run test:run` passa, e os checks da seção **Como verificar** rodam limpos.

---

## Escopo

**Entra:** as 71 calculadoras ativas (`src/design-system/data/calculator-definitions.js`), os 15 displays custom
(`src/design-system/showcase/displays/`), o `CalculatorShowcase.jsx` e os **7 Critérios UTI**
(`src/data/criteriosUtiCalculators.js` + `src/pages/CriteriosUTIPage.jsx`), que são um segundo sistema paralelo com
convenções próprias.

**Fica de fora:** Codificação Anestésica e Extrato de Férias. Fazem contas, mas são módulos de negócio com dono e
histórico próprios — mexer neles aqui é ampliar escopo sem pedido.

---

## Passo 0 — consertar o ferramental ANTES de revisar

Sem isso a revisão começa cega e o revisor perde tempo redescobrindo. **Tudo abaixo foi verificado:**

| onde | o que diz | realidade |
|---|---|---|
| `.claude/skills/calculadoras/SKILL.md` | calculadoras vivem em `src/pages/calculadoras/` | **o diretório não existe** |
| `.claude/agents/calc-validator.md` | mesmo caminho | idem — o agente procura no vazio |
| skill | "76+ calculadoras" | **71 ativas**, 80 definidas, 13 seções |
| cabeçalho de `calculator-definitions.js` | "84 calculadoras … 34 ativas" | idem — **três fontes, três números, nenhum certo** |
| skill | "`customRender` — 6 calcs" | **16** (8 com arquivo próprio em `displays/`, 8 inline no Showcase) |
| skill | "CalculatorShowcase: SEM padding próprio" | tem `px-2 pb-3` |
| skill | "Score com 2 decimais: `result.score.toFixed(2)`" | ⚠️ ver Frente 4 |

Corrija a skill e o agente **primeiro**. Enquanto o caminho estiver morto, qualquer invocação do `calc-validator`
produz um relatório vazio que parece aprovação.

---

## Frente 1 — As que não calculam

Medido, com `compute()` executado sobre entradas de exemplo:

| calculadora | entradas | o que devolve |
|---|---|---|
| **Mallampati** | 1 | só o próprio `score` |
| **Cormack-Lehane** | 1 | `score` + texto |
| **ASA** | 2 | `score` + texto |
| Apfel | 4 | escore real |
| STOP-Bang | 8 | escore + risco |
| Glasgow / GCS-P / Glasgow Ped. | 3–4 | soma real |
| Aldrete Unificado | 0 (display) | calcula no display |

Mallampati e Cormack são **consulta de uma entrada que devolve a entrada**. ASA idem, com um modificador.
Apfel, STOP-Bang, Glasgow e Aldrete **calculam** — não entram no agrupamento só por serem escalas.

**Decidido pelo dono (26/08): AGRUPAR, não excluir.** Um card único de **classificações** reunindo ASA,
Mallampati e Cormack-Lehane, no padrão consulta que os cards de Anticoagulantes e Inibidores de apetite já usam
(lib pura + display + abas).

⚠️ **A varredura das 71 já foi feita — e agrupar NÃO significa mexer em 71 calculadoras.** Cada `compute` foi lido
e o resultado é: **exatamente 3** entram no card (`periop_asa`, `periop_mallampati`, `periop_cormack`).
As outras 68 calculam de verdade e **ficam como estão**. Fora do módulo, `cfm2156` (Critérios UTI) tem a mesma
mecânica, mas é feature separada — decisão à parte.

Dois casos-limite, declarados para o dono decidir, não para você escolher:
- **RASS** (metade de `uti_sedacao_delirium`) — a metade RASS é classificação pura, mas a outra metade, o CAM-ICU,
  é algoritmo sequencial. Separar as duas é mudança de escopo.
- **`ped_jejum`** (Jejum Pré-operatório) — é consulta em tabela, mas as categorias são de alimento, não graus do
  paciente. Não é a mesma coisa que Mallampati.

⚠️ **O ASA é entrada de OUTRAS calculadoras** — `sort` e `ppossum` (Critérios UTI) pedem a classificação ASA num
select próprio. Nada quebra em código se o card sair da lista, mas o card é onde a definição e os exemplos de cada
classe estão escritos. Agrupar preserva isso; excluir, não.

Teste para separar o que agrupa do que fica: **o app faz uma conta que o usuário não faria de cabeça?**
Glasgow soma três eixos, Apfel pondera quatro fatores, STOP-Bang oito — ficam. Mallampati devolve a classe que a
pessoa acabou de escolher — agrupa.

⚠️ `LEGACY_ID_MAP` existe para favoritos não quebrarem. Toda calculadora que sair da lista precisa de entrada lá.

## Frente 2 — Enxugar para as essenciais

⚠️ **`status: 'inactive'` é a rede de segurança do dono, não lixo.** Decisão dele em 26/08: *"as que forem
descartadas quero que deixe inativas caso eu mude de ideia e resolva retornar com elas no app"*. **Nada é
apagado.** Descartar = `status: 'inactive'` + entrada em `LEGACY_ID_MAP` para favorito salvo não quebrar.
(Isso revoga a versão anterior deste prompt, que propunha excluir as 9 inativas de vez.)

As 9 já inativas continuam inativas. Verificado que todas têm substituta ativa, então ninguém perde acesso:
Holliday-Segar → `ped_holliday_segar` · RASS e CAM-ICU → `uti_sedacao_delirium` · SOFA e qSOFA →
`uti_sofa_unificado` · CHA₂DS₂-VASc e HAS-BLED → dentro de `FibrilacaoAtrialDisplay` · as duas Aldrete → dentro
de `AldreteDisplay`.

**A fazer:** triagem das 71 ativas contra o dia a dia da anestesia. O dono disse que *"várias não fazem sentido no
dia a dia da anestesia ou são pouco usadas"* e quer **apenas as essenciais**.

Critérios de triagem — aplique e **mostre o porquê de cada corte**:
- é consultada no perioperatório, ou é de outra especialidade que entrou por arrasto?
- decide conduta, ou só nomeia o que o anestesiologista já sabe de cabeça?
- há duplicata funcional (duas formas da mesma escala)?
- a versão pediátrica e a adulta precisam ser cards separados?

**Entregue a triagem como PROPOSTA para o dono aprovar, uma linha por calculadora com o motivo do corte.**
Não desative nada por conta própria: "pouco usada" é juízo clínico, e o app não tem telemetria de uso para
sustentar a afirmação — se você disser que algo é pouco usado, diga que é impressão, não medição.

## Frente 3 — Dois bugs já confirmados, antes de qualquer revisão

Achados durante o levantamento e **verificados por mim**. Corrija estes primeiro: são defeito, não opinião.

### 3a. A SAPS III não gravava nenhuma seleção — ✅ CORRIGIDO em 26/08

`Saps3Display.jsx` importa a `Select` do DS e passa **`onValueChange`** em **15 lugares** — mas a `Select` do DS
expõe **`onChange`** (`ui/select.jsx:8`). A prop desconhecida cai no `...props` e é derramada no DOM
(`select.jsx:332`). O console do navegador confirma:

```
Unknown event handler property `onValueChange`. It will be ignored.
```

**A SAPS III — escore de mortalidade em UTI — não registrava nada do que o usuário escolhia.** Era o único
display do sistema com esse erro (`onValueChange` 15 × `onChange` 0).

**Corrigido fora do fluxo da revisão, a pedido do dono.** As assinaturas eram idênticas (o `Select` chama
`onChange?.(optionValue)`, o valor direto — `select.jsx:214`), então foi renomear as 15. Verificado no navegador:
o aviso do React sumiu, a seleção grava, e o escore foi de **32 → 47** ao escolher "75-79 anos (15 pts)" — os 15
pontos exatos da opção.

**Falta a trava.** Não há teste que pegue isso. Crie um: prop errada em `Select` é falha silenciosa — o React só
avisa no console e a tela parece funcionar. Um teste que monte cada display e verifique que nenhum passa prop
desconhecida ao `Select` protegeria todos os 16 `customRender` de uma vez.

### 3b. Cinco libs testadas que a produção não usa

`apacheII.js`, `curb65.js`, `fourScore.js`, `roxIndex.js` e `electrolyteCorrection.js` têm teste e **zero
importadores** fora dos próprios testes. As calculadoras equivalentes (`uti_apache2`, `uti_curb65`,
`uti_four_score`, `uti_rox`, `renal_sódio`, `renal_cálcio`) calculam **inline** em `calculator-definitions.js`.

Consequência: **a suíte fica verde sem cobrir a matemática que roda em produção**, e as duas implementações podem
divergir sem nada acusar. Em calculadora clínica isso é pior que não ter teste — é teste que dá falsa segurança.
Decida por par: ou a calculadora passa a importar a lib, ou a lib e o teste morrem. Não deixe as duas.

⚠️ **Antes de unificar, compare as duas implementações.** Se já divergiram, uma das duas está errada hoje.

## Frente 3c — Matemática das demais

Use o agente **`calc-validator`** (depois de consertar o caminho dele). Para cada calculadora:

- fórmula conferida contra fonte primária, **com a fonte citada** na saída;
- variante certa quando há mais de uma (peso ideal: Devine × Robinson × Hamwi);
- unidades explícitas na tela e conversões corretas;
- casos-limite: zero, negativo, valores fisiologicamente impossíveis, divisão por zero;
- **a referência ainda é a prática corrente?** Diretriz de 2010 citada numa calculadora de 2026 é achado.

Priorize por dano: dose de fármaco e reposição volêmica antes de escore prognóstico.
**Não tem certeza clínica de algo? Diga que não tem.** Chute em calculadora médica é o pior resultado possível.

Toda correção de conta entra com teste em `src/__tests__/lib/` cobrindo os limites. Hoje há 58 arquivos de teste
para 71 calculadoras — parte não tem trava.

## Frente 4 — Português, incluindo os números

O dono pediu português em todos os termos e um siglário. Duas metades:

**Palavras.** Anglicismo de interface (`Weight`, `Input`, `Output`, `Score`, `Range`, `Blood Loss`) vira português.
⚠️ **Sigla clínica consagrada não é anglicismo**: `PEEP`, `ASA`, `IMC`, `PaO₂`, `FiO₂`, `SpO₂` são o vocabulário que
o anestesiologista escreve — trocar isso piora. Na dúvida, pergunte ao dono; não decida.

**Números — e esta é a parte que ninguém vê.** A skill **manda** `result.score.toFixed(2)`, e `toFixed` produz
**ponto decimal**: hoje todo escore aparece como `12.75` em vez de `12,75`. São **133 usos de `toFixed`** contra
**2** de `toLocaleString('pt-BR')` no sistema de calculadoras. Num app brasileiro o formato de número é tão
português quanto as palavras — e como está codificado na regra, cada calculadora nova nasce com o defeito.
Corrija a skill e crie um helper único (existe precedente: `numeroBr` em `InibidoresApetiteDisplay.jsx`).

**Siglas em inglês já localizadas em texto de tela** (varredura restrita a `label`/`title`/`unit`/`placeholder`,
para não confundir `MAP` de PAM com `.map()` do JavaScript):

| onde | está | correto |
|---|---|---|
| `displays/BalancoHidricoTransopDisplay.jsx:327, 337, 385` | `Hct` | **`Ht`** (hematócrito) — apontado pelo dono |
| `displays/BalancoHidricoTransopDisplay.jsx:383, 564` | `ABL` (*allowable blood loss*) | **perda sanguínea permitida** |
| `data/criteriosUtiCalculators.js:192` | `BUN` | **ureia** |
| `calculator-definitions.js` — 5 lugares | `Hematocrito` | **`Hematócrito`** (falta o acento) |

⚠️ `CAM-ICU` aparece na varredura e **não se traduz** — é nome próprio de instrumento validado, como Mallampati e
Glasgow. Traduzir descaracteriza a escala. Mesma lógica vale para `STOP-Bang` e `HAS-BLED`.

**Varredura ampla concluída** (todas as strings fora de comentário, incluindo `infoBox`, `resultMessage`, opções
e interpretações): **103 ocorrências em 9 termos**.

| termo | vezes | vira | onde dói mais |
|---|---|---|---|
| **`Score`** | **76** | **escore** | espalhado nas interpretações e nos `resultMessage` |
| **`MABL`** | **10** | **perda sanguínea máxima permitida** | ⚠️ é o **título** de duas calculadoras: "MABL Adulto" e "MABL Pediátrico" |
| `Deficit` | 7 | déficit | inclusive no título "Deficit Hidrico" |
| `ABL` | 3 | perda sanguínea permitida | balanço hídrico |
| `BUN`, `Hct`, `Range`, `Blood Loss`, `Weight` | 1–2 cada | ver acima | — |

Concentração: **90 das 103 estão em `calculator-definitions.js`**.

**E há um problema de português puro, separado das siglas: 26 palavras sem acento em texto de tela.**

| errado | certo | vezes |
|---|---|---|
| `Formula` | **Fórmula** | 12 |
| `Deficit` | **Déficit** | 7 |
| `Hematocrito` | **Hematócrito** | 5 |
| `Hidrico` | **Hídrico** | 1 (no título "Deficit Hidrico") |
| `Sanguinea` | **Sanguínea** | 1 |

⚠️ **NÃO traduza nomes próprios de instrumentos validados**: `CAM-ICU`, `STOP-Bang`, `HAS-BLED`, `FLACC`,
`CHEOPS`, `NEWS2`, `MEWS`, `SOFA`, `qSOFA`, `APACHE`, `SAPS`, `NIHSS`, `CURB-65`, `ROX`, `PEWS`, `PRISM`, `PIM3`,
`TIMI`, `HEART`, `ARISCAT`, `RCRI`. Traduzir descaracteriza a escala e quebra a busca por nome.
`MABL` **não** é nome próprio — é descrição em inglês, e traduz.

Entregar também o **siglário** — as siglas que ficam, com o significado por extenso.

## Frente 5 — Balanço hídrico transoperatório

Relato literal do dono: *"está confusa de usar"* e *"ao adicionar novo horário a tela fica muito longa (para
cirurgias longas)"*. Uma cirurgia de 6 h com registro a cada 30 min são 12 linhas.

**Medido no app a 375px** (não é impressão):

| horas registradas | altura | telas de 812px | campos |
|---|---|---|---|
| vazia, sem peso | 2.161px | 2,7 | 4 |
| 1 hora | 3.687px | 4,5 | 10 |
| 4 horas | 4.857px | 6,0 | 28 |
| **12 horas** (cirurgia de 6 h) | **7.977px** | **9,8** | **76** |

**Cada hora custa ~390px — quase meia tela.** Cada uma é um cartão com **6 campos numéricos** em 3 pares
(`HoraRow`, `BalancoHidricoTransopDisplay.jsx:116`).

⚠️ **O pior não é o comprimento, é a ordem.** Com 12 horas, o "Balanço acumulado" fica em **y=6209**, depois do
último campo (y=6049). O número que o anestesista abriu a calculadora para ver está **atrás de 76 campos**. Numa
calculadora consultada durante a cirurgia, o resultado tem de estar sempre à vista — não no fim de 9,8 telas.

Some a isso os anglicismos, que se concentram justamente aqui: `Hct` (327, 337, 385) e `ABL` (383, 564).

Apresente **2 ou 3 caminhos** de redesenho com o trade-off de cada um — **e deixe o dono escolher por imagem**
(ver Regras). Pense em: resultado fixo no topo ou rodapé; uma linha compacta por hora em vez de cartão de 6
campos; hora recolhida depois de preenchida.

Confira também a matemática da reposição (jejum, manutenção, perdas, terceiro espaço) contra a prática corrente.

## Frente 6 — DS e o padrão de seleção

**Estado atual, verificado:** as calculadoras selecionam por `Select` dropdown (9 com `useDropdown: true`),
`WidgetCard` em grade de 2 e `RiskFactorCard`. A escala cirúrgica usa *segmented control*:
`BarraControles.jsx:33` (`grid gap-1 rounded-[12px] bg-muted p-1`) e `:48`
(`rounded-[10px] transition-all active:scale-95`) — trilho tingido, segmentos iguais, afundar no toque. É o idioma
iOS, e são ~15 linhas de Tailwind, não um componente complexo. O `useHaptic` do DS é usado em 8 telas do app,
**nenhuma delas calculadora**.

**O problema real não é falta de componente — é excesso.** Levantado: **sete mecanismos** coexistem hoje para a
mesma pergunta "escolher uma opção entre várias":

1. `Select` do DS (dropdown) — **149 inputs `select`** nas definições + 43 nos Critérios UTI
2. `SelectAsCards` — botões em lista, `CalculatorShowcase.jsx:1900`; é o padrão quando há ≤6 opções
3. `RiskFactorCard` — para os **102 inputs `bool`**
4. **pill toggle escrito à mão e copiado 3×** — `AldreteDisplay:62`, `BalancoHidricoTransopDisplay:62`,
   `SofaDisplay:144` (um comentário em `AldreteDisplay:59` admite a cópia)
5. `Tabs variant="default"` — só nos dois cards de consulta novos
6. grades Sim/Não à mão — `Saps3Display:334` e `:415`
7. **quadrado-com-check reimplementado 4×**, com raios e tamanhos diferentes entre si — `SofaDisplay:180`,
   `Saps3Display:292`, `SedacaoDeliriumDisplay:176`, `CriteriosUTIPage:373`

**Consolidar isso vale mais que trazer padrão novo.** Os itens 4 e 7 são duplicação pura: sete cópias de dois
componentes que deveriam ser um cada.

⚠️ **NÃO construa nada** (dono, 26/08: *"pode buscar componentes e elementos prontos do iOS, não quero que você
crie"*). **Buscar biblioteca externa É permitido** — desde que passe na regra da casa: ≥1k estrelas, commits nos
últimos 6 meses, React 19, e embrulhada no DS.

**A busca já foi feita. Resultado:**

**Konsta UI** (`konstaui/konsta`) é a biblioteca dedicada a iOS+Tailwind e passa em quase tudo — **4.238 estrelas**,
push em **25/08/2026**, MIT, v5.4.0, uma dependência só. ⚠️ **Mas exige Tailwind 4** (o `theme.css` dela usa
`@source`, diretiva que não existe no Tailwind 3) e **este projeto está no Tailwind 3.4.17**. A última versão
compatível com Tailwind 3 é a 4.0.1 — adotar uma major atrasada é trade ruim. Migrar Tailwind 3→4 é mudança de
projeto inteiro, muito maior que esta revisão. **Segundo impedimento, independente do primeiro:** a Konsta traz o
próprio tema iOS completo (cores, tipografia), que colidiria com os 140 tokens do DS ANEST e a identidade verde
institucional. Seriam duas linguagens visuais no mesmo app.

**Conclusão da busca: o que serve já está aqui**, e nada precisa ser instalado nem escrito:

| peça iOS | componente | onde |
|---|---|---|
| *segmented control* | **`Tabs variant="default"`** ("abas com background em container") | `ui/tabs.jsx:58` |
| *bottom sheet* arrastável | **`Drawer`** — é o **`vaul` v1.1.2**, a mesma lib do shadcn | `ui/drawer.jsx` |
| toggle iOS | `Switch` | `ui/switch.jsx` |
| feedback tátil | `useHaptic` | `design-system/hooks` — usado em 8 telas, **nenhuma calculadora** |

Mais um pronto, este no código da escala: **`SegmentedSelector.jsx`** (`src/pages/escala-cirurgica/`) tem **zero
imports** — nenhum contexto, hook, roster ou service. É função pura de `(options, value, onChange)`, já consumida
por 5 arquivos. Reusar é trocar o caminho do import. O `Trilho` (hospital/turno/data) é irmão dele, mas está
**privado** dentro de `BarraControles.jsx:30` e precisaria ser exportado.

O que produz a sensação de iOS, medido nas classes: raio externo maior que o interno com 4px de padding
(`rounded-[12px]` fora, `rounded-[10px]` dentro), largura idêntica por `gridTemplateColumns: repeat(N, minmax(0,1fr))`
— e não flex, que é a armadilha do `min-width:auto` — e **`active:scale-95`**, o segmento que afunda sob o dedo.
⚠️ Não há indicador deslizante animado nem feedback tátil: `useHaptic` existe e **nenhum arquivo da escala o usa**.

⚠️ **Semântica errada para formulário.** O `SegmentedSelector` usa `role="tablist"`/`role="tab"`, que descreve
navegação entre painéis. Entrada de dado pede `radiogroup`/`radio`. Reusar sem ajustar isso degrada leitor de tela
numa tela de decisão clínica — corrija na promoção ao DS.

**Onde o encaixe é real:** os 3 pill toggles copiados fazem à mão exatamente o trabalho dele, com 2 opções curtas.
Trocá-los é consolidação, não redesenho. **Onde não encaixa:** os 149 dropdowns — rótulo clínico é longo
("ASA III — doença sistêmica grave") e segmento de largura igual a 375px vira reticências. O limite prático é ~4
opções curtas. Trocar os 149 seria mudança visual em 70 telas em uso clínico, sem pedido: cai na Regra #2.

⚠️ **Protótipo antes de implementar** (dono, 26/08): HTML estático a 430px, nos dois temas, com a medição ao lado.
Ele aprova por imagem; só então `src/` muda.

**Varrer também**, com as classes de defeito que já se provaram reais neste app:

- `<Alert variant="destructive">` — **não existe** no DS (é `error`) e cai calado no `default`, fundo de card.
- Badge `subtle` com variante não-`default` — todas reprovam AA. `success` reprova **até sólido** (2,22:1).
  `text-success` e `text-warning` para texto dão 2,04 e 1,99:1 sobre branco.
- `z-index` cravado em número no lugar do token da escala (`z-modal`, `z-select`…).
- Alvos de toque abaixo de 44px; truncamento (`scrollWidth > clientWidth`); estouro horizontal.
- Hex cravado e cor crua do Tailwind (`text-yellow-500`) — a regra é token semântico.
- Estado do usuário dentro de `TabsContent`: ele **desmonta** o painel inativo e o valor digitado morre.
  A saída é `forceMount`, que existe e não está documentada.

## Frente 7 — Celular deitado

Pedido do dono (26/08): *"estou planejando também para posição horizontal dos dispositivos; inclua para planejar
calculadoras no formato horizontal também"*.

⚠️ **A infraestrutura já existe e é decisão tomada — não reabra.** `tailwind.config.js:27` define a variante
**`deitado:`** (o nome é em português; procurar por `landscape:` no JSX dá zero e engana):

```
deitado: { raw: "(orientation: landscape) and (max-height: 500px) and (pointer: coarse)" }
```

Não é breakpoint de largura: é **celular na horizontal** — largura sobrando, altura curta. `max-height` exclui
tablet, `pointer: coarse` exclui desktop. O `index.css:82` já move a navegação para uma faixa lateral de 76px e
zera o `pb-28` das páginas. E há duas armadilhas documentadas no próprio arquivo:

- ⚠️ **a decisão é de CSS, nunca de JS** — o `orientationchange` do iOS chega antes de a viewport ter as medidas
  novas, e decidir em JS fazia a tela pular;
- ⚠️ **a variante é declarada POR ÚLTIMO** no config de propósito: o Tailwind emite as media queries na ordem da
  lista e empate de especificidade é decidido por quem vem depois. Declarada antes, `deitado:grid-cols-2` perdia
  para `lg:grid-cols-3`.

**O estado hoje: 48 usos de `deitado:` no app — e ZERO no sistema de calculadoras.** Navegação, Home e Gestão já
foram adaptadas; as calculadoras ficaram de fora inteiras.

**A fazer:** deitado, a tela tem ~375px de altura e sobra largura. Isso ataca de frente o problema da Frente 5 —
uma coluna que só cresce é péssima com 375px de altura, e o balanço hídrico já custa 9,8 telas em pé. Use a
largura: entradas de um lado, resultado fixo do outro. Referência de padrão pronto: `bottom-nav.jsx:46-60` e
`GestaoPage.jsx`.

**Priorize** as calculadoras longas (balanço hídrico, SAPS III, SOFA, os escores de muitos itens) — nas curtas o
ganho é pequeno. E meça: a régua é "quantas telas de 375px de altura", não "parece melhor".

---

## Como entregar as propostas visuais — o dono aprova por imagem

Pedido explícito (26/08): *"quero que mande modelos antes de implementar para aprovação"* e *"abra o navegador"*.

Para **toda** mudança de tela desta revisão, antes de tocar em `src/`:

1. Escreva o modelo como **HTML estático**, com os tokens reais do DS (copie as variáveis de
   `src/styles/anest-theme.css`), em `.tmp/`.
2. Renderize as duas orientações: **430px de largura** (retrato) **e ~812×375** (deitado), **nos dois temas**.
3. Ponha **a medição ao lado** — altura em pixels, quantas telas, quantos campos, onde fica o resultado. Foi a
   medição que provou o problema do balanço hídrico; é ela que sustenta a escolha.
4. **Abra no navegador do dono** (`open .tmp/arquivo.html`) e espere a aprovação.
5. Só então implemente.

Quando houver mais de um caminho, mostre-os **lado a lado** na mesma página, com o trade-off escrito embaixo de
cada um. O dono escolhe por imagem — não descreva o que ele veria, mostre.

---

## Decisões que são do dono — não decida sozinho

1. Agrupar ASA/Mallampati/Cormack num card, **ou excluí-las**?
2. Apagar as 9 inativas?
3. Contraste: corrigir nos **tokens** (alcança o app inteiro de uma vez) ou **por uso** (~660 pontos)?
4. Qual dos caminhos de redesenho do balanço hídrico?
5. Levar o *segmented control* para as calculadoras é mudança visual — precisa de aprovação por imagem.

## Regras invioláveis

- **Regra #2 do CLAUDE.md:** nenhuma mudança visual sem pedido expresso. Corrigir bug reportado conta; melhoria
  oportunista, não. Este prompt **é** o pedido para as frentes acima — nada além delas.
- **Mudança de tela vai como protótipo primeiro:** HTML estático a 430px, nos dois temas, com a medição ao lado.
  O dono escolhe por imagem; só então `src/` muda.
- **Só tokens semânticos.** Nada de hex nem cor crua do Tailwind.
- **Toda correção de conta entra com teste.** E rode o teste novo contra o código ANTIGO antes de chamá-lo de
  trava — teste que passa nos dois lados não protege nada.

## Como verificar

```bash
npm run build            # obrigatório
npm run test:run         # 239 arquivos hoje
npm run dev              # pega import quebrado que o rollup tolera
npx playwright test e2e/calculadora-flow.spec.ts --project=chromium
```

Mais, no browser a 375px **nos dois temas reais** (`localStorage['anest-theme']` via `addInitScript` — forçar a
classe `.dark` no `<html>` não muda componentes que leem `useTheme()` e rende screenshot falso):

- nenhum badge abaixo de 4,5:1 — composto o alfa sobre o primeiro ancestral opaco;
- nenhum alvo de toque abaixo de 44px, medindo a **caixa** do campo, não o `<input>` interno;
- zero truncamento e zero estouro horizontal.

Modelo pronto: o describe de contraste em `e2e/inibidores-apetite.spec.ts`.

---
paths:
  - "src/pages/escala-cirurgica/LiberacoesView.jsx"
  - "src/pages/escala-cirurgica/PainelTempo.jsx"
  - "src/pages/escala-cirurgica/useAgoraMinuto.js"
  - "src/pages/escala-cirurgica/useAvisoPlantonista.js"
  - "src/pages/escala-cirurgica/useAvisoTempoEstourado.js"
  - "src/lib/colunaLiberacao.js"
  - "src/lib/escalaCirurgicaRegras.js"
  - "src/lib/plantaoNoturno.js"
  - "src/__tests__/**/escalaCirurgicaPersonas*"
  - "src/__tests__/**/escalaOrdemLiberacao*"
  - "src/__tests__/**/liberacoes*"
  - "src/__tests__/**/escalaPassaDeTurno*"
description: Escala Cirúrgica — fila de liberação: ordem imutável, cauda vermelha, plantão noturno, travessia de turno, resposta tátil
---

<!-- Movido do CLAUDE.md em 2026-08-26 (otimização de contexto): o arquivo passou de
     1.603 linhas para o alvo oficial de <200. O texto abaixo está VERBATIM — nenhuma
     decisão do dono foi editada ou resumida. Esta rule carrega SÓ quando o Claude lê um
     arquivo que casa os `paths` acima. -->

## Fila — quatro decisões do dono em 31/08 (noite, após usar a tela)

- **Liberado SEM nome riscado**: o card vermelho já diz tudo; o `line-through`
  por cima era redundância. Fica a opacidade. Trava em
  `escalaCirurgicaPersonas.test.jsx` (mudou de lado com o porquê no corpo).
- **Badges de plantão ACOMPANHAM a cor do card**: "Plantão da tarde/manhã"
  (contraturno) e os selos P1–P4 não somem ao liberar — trocam para o vermelho
  sólido (`bg-destructive`) quando o card está vermelho (cauda automática OU
  liberação manual), e seguem verdes em quem trabalha. A informação posicional
  continua verdadeira; só a tinta combina. `liberacoesLiberadoVisual.test.jsx`.
- **Materno NÃO tem plantão de contraturno**: "o segundo anestesista no materno
  não precisa de badge de plantão". `gerarColunaLiberacao` ganhou
  `plantaoContraturno: false` (a view passa para o Materno): selo E
  vai-para-o-fim do último nome saem JUNTOS — selo sem a mecânica deixaria a
  pessoa saindo primeiro sem nada explicando. HRO/Unimed seguem como sempre.
- **Ajuda DECLARADA em outro hospital ganha o badge aqui** (caso Eduardo:
  "marquei Eduardo como ajuda no materno e o badge não saiu na fila do HRO").
  A decisão de 30/07 (emprestado com badge) só ligava com CASO lá;
  `presencaOutros` agora carrega também a `ajuda_externa` das outras escalas
  (`ajudaDeclarada: true`) e a linha ganha `isAjuda`/`ajudaFora` + "Ajuda no
  Materno" no card — no Materno, sem rodapé e às vezes sem casos, a declaração
  é o ÚNICO sinal. A posição daqui não muda.
  `liberacoesCasoEmOutroHospital.test.jsx`.


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

Superfícies: **Completa** NÃO a mostra mais na tarde (dono 14/09: "essa informação
de 'ainda abertas' não é necessária, as escalas são corrigidas quando enviadas no
novo turno" — a foto da tarde já traz "CONTINUAÇÃO RM"/"CONTINUAÇÃO +-14h", e a RM
da manhã aparecia ao lado da própria continuação). De 22/08 a 14/09 ela entrava no
grupo "Ainda abertas — Manhã" das urgências herdadas; o grupo segue existindo SÓ
para a urgência do contrato do HRO, que não vem na foto · **Minhas** e a **fila de
Liberações** seguem contando a cirurgia na tarde. ⚠️ o badge "Passa para tarde/noite" da
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
  cirurgia da Gabriela **não some**: continua na aba **Minhas** dela e no quadro
  da MANHÃ (na Completa da tarde ela deixou de aparecer em 14/09 — a escala da
  tarde traz a continuação) — lá a pergunta é "esta cirurgia existe?", na fila é
  "quem está nesta fila?". Identidade tolerante por
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

### A cauda libera pelo HOSPITAL DE ORIGEM (dono 27/08)

*"sempre os primeiros a irem embora são os plantões do contraturno, após os
anestesistas que estariam escalados no materno e após os anestesistas de outro
hospital, sempre respeitando a ordem de liberação do hospital de origem"* —
resposta ao relato do mesmo dia: *"a ordem de liberações está errada, as ajudas
vieram do HRO, e segundo a escala quem sai primeiro é Gustavo e não Alexandre.
Romulo continua ser o primeiro das ajudas a ir embora."*

**Como a regra chegou quebrada:** a ordenação por rodapé de origem existe na lib
desde 31/07 (`opts.rodapeOutros`), mas a PÁGINA parou de alimentá-la em **04/08**
(`ebfa726`, "fix: nao inferir ajuda entre hospitais") — `presencaOutros` virou
`[]` para matar um falso badge de "Ajuda" em quem estava escalado em dois
hospitais no mesmo turno. Aquela inferência vinha da metade derivada dos **casos**;
a metade do **rodapé**, que é a única que a ordem precisa, foi junto. Desde então
a cauda ordenava por ordem de ENCONTRO dos casos. Medido em 27/08 na Unimed/tarde:
HRO tinha ALEXANDRE S em 6º e GUSTAVO em 10º, e a Unimed liberava o Alexandre
primeiro. ⚠️ o teste de lib passava o tempo todo — o que quebrou foi o FIO entre
página e lib, e é por isso que a trava nova é de PÁGINA (`escalaAjudaOrigemHospital.test.jsx`).

- `presencaOutros` voltou **só com o rodapé** (`{ nome, uid, hospital, hospitalLabel, rodapeIdx }`).
  Enquanto ele não tiver `sala`, `ajudandoFora`/`ajudaForaInfo` seguem desligados —
  a inferência de "emprestado" continua fora, como está desde 04/08.
- Níveis da cauda, de quem sai por ÚLTIMO para quem sai PRIMEIRO: fila → ajuda sem
  origem conhecida → ajuda de outro hospital (índice do rodapé de lá ASCENDENTE:
  maior índice lá = sai antes lá = mais embaixo aqui) → **Materno** → plantão do
  contraturno. O contraturno fecha a lista por fora do sort (regra de 29/07) e,
  estando escalado, é ELE o "próximo a ser liberado", não a ajuda logo acima.
- **`origemHospital`/`origemLabel` na linha são a FONTE ÚNICA do badge
  "Ajuda (HRO)"** — a view cruzava as escalas de novo para escrever o rótulo, e com
  a marca manual passariam a existir dois caminhos para a mesma frase. Quem decide
  a ORDEM decide o RÓTULO. ⚠️ a condição para gravar o par é TER ORIGEM, não ter o
  slug: `hospital` é opcional em `rodapeOutros` e gatear pelo slug deixava sem
  rótulo a chamada que só manda nome + índice.

### A ORDEM INFORMADA vence a derivada (dono 09/09)

*"você não seguiu a ordem de liberação, corrija (mantendo a ordem de liberações
conforme informado)."* — 10/09 de manhã, Unimed: o recado numerava
*"1º Aline – Iosc · 2º Guilherme – Iosc · 3º Rafael – Unimed · 4º Alexandre – Unimed"*,
o lote gravou `ajuda_externa` na ordem certa (o ÚLTIMO do array sai primeiro) e a
fila publicou o inverso — **Alexandre saindo antes do Rafael**. O HRO acertou por
acaso: lá a Aline fecha o rodapé, então o plantão do contraturno (29/07) já a
punha em 1º.

**Por que a derivada ganhava:** Alexandre está em 11º no rodapé do HRO, Rafael veio
do consultório e não está em rodapé nenhum. Pela regra de 27/08 (*ajuda sem origem
conhecida → ajuda de outro hospital*), quem TEM origem desce e sai antes — e a
numeração do dono não tinha como se opor, porque o array só decidia entre os que
não têm origem. Pior: o mesmo trecho zerava o `ajudaIdx` de quem tem origem, e as
setas do bloco somem sem ele — **o defeito ainda bloqueava o conserto manual**.

- `opts.ajudaOrdemInformada` (bool, por turno) faz o array de ajuda mandar na cauda;
  quem não está nele cai em `Infinity`, abaixo dos numerados — 27/08 continua valendo
  para quem ninguém numerou. Sem a marca, NADA muda.
- Com a marca, `ajudaIdx` sobrevive a ter origem: as setas voltam, e reordenar no
  toque continua sendo o conserto de última hora do plantonista.
- **A marca mora em `ajuda_externa.ordemInformada[turno]`** (chave irmã dos arrays;
  todo leitor passa por `rodapeDoTurno`, que lê `[turno]`). Helpers
  `ajudaOrdemInformada` / `marcarAjudaOrdemInformada` em `utils.js`.
- Quem grava: **as setas** (`reordenarAjuda` — mexeu, declarou) e a **publicação por
  foto** quando o lote traz `ajudaOrdemInformada: true` no hospital. Publicação sem
  numeração APAGA a marca do turno: a lista que a Vision monta sai na ordem da
  IMAGEM e não é ordem de ninguém — foi exatamente disso que 27/08 reclamou.
- **A exceção de 31/08 também cede à numeração** (dono 10/09, HRO da manhã). A Aline
  fecha o rodapé do HRO e o Guilherme Melo fecha o da Unimed; a partição da view
  (`passaNaFrenteDoPlantao`) jogava o Guilherme para depois dela e ele saía primeiro,
  ao contrário do recado. A razão que o dono deu, e que 31/08 não cobria:
  *"os dois plantões do contraturno estão trabalhando, e há ajudas saídas do HRO para
  a Unimed; nesse caso o primeiro a ser liberado é o plantão do contraturno que tem
  ajudas emprestadas para outro hospital, na sequência o plantão do contraturno do
  hospital que recebeu ajuda."* Em 31/08 a direção era a inversa (a Unimed emprestou o
  Oscar ao HRO, e ele saiu antes do plantão do HRO) — por isso as duas leituras
  convivem. **Hoje quem resolve isso é a NUMERAÇÃO, não a derivação**: entre linhas
  numeradas a exceção não se aplica; quem está fora da lista informada segue com
  31/08 inteiro. ⚠️ **Perguntado na hora se o app devia DEDUZIR a direção do
  empréstimo sozinho, o dono escolheu manter a numeração como autoridade** (10/09)
  — não reabrir isso por conta própria. A direção não é derivável sem escolher uma
  regra nova: em 10/09 a Unimed também "emprestou" alguém ao HRO (o próprio
  plantonista dela), e generalizar foi exatamente o erro de 30/08.
- ⚠️ **A promoção a `proximoPlantao` também cede à numeração (dono 11/09, Unimed da
  manhã).** O recado dizia *"1º Giovana · 2º Aline · 3º Marílio"* e a **Aline saiu
  primeiro**: ela fecha o rodapé da Unimed E está na ajuda numerada, e o `splice` de
  29/07 (`colunaLiberacao.js`, bloco `PLANTAO_LABEL`) a tirava de `linhasAjuda`
  **antes** do sort por `ajudaIdx` e a grudava no fim de `linhas` — onde se libera
  primeiro. A numeração não tinha como alcançá-la: ela nunca chegava ao sort.
  É o MESMO defeito de 10/09, no OUTRO ponto que deriva posição a partir do plantão
  do contraturno — o gate daquele dia entrou só em `passaNaFrenteDoPlantao`.
  `opts.ajudaOrdemInformada && posAjuda.has(chaveUltima)` cai no `else if` que já
  existia para o plantonista (D11, 07/08): **o selo fica, só o movimento sai**.
  ⚠️ **Ao tocar qualquer regra que derive posição do plantão do contraturno,
  procurar os DOIS pontos** — a lista de exceções de 29/07 e a partição da view.
  Trava de LIB em `colunaLiberacao.test.js` (aqui o fio já existia; o que errava era
  a lib). ⚠️ na fixture, a ajuda que deve sair primeiro PRECISA fechar o rodapé de
  origem: sem isso a derivação de 27/08 produz a mesma ordem e o teste passa sem a
  correção valer de nada.
- Trava de PÁGINA em `escalaAjudaOrigemHospital.test.jsx` (mesma razão de 27/08: a
  lib já sabia ordenar, o que faltava era o fio). ⚠️ na fixture, o visitante NÃO pode
  ser o último do rodapé de origem — aí ele vira plantão do contraturno de lá e a
  exceção de 31/08 o joga para o fim antes de qualquer ordem.

### "Veio de" — informar o Materno, que quase nunca tem escala (dono 27/08)

*"crie um sistema para informar, pq eventualmente o materno não tem escala e esses
anestesistas não aparecem em escala nenhuma"*. Sem rodapé de onde derivar, quem
veio do Materno não tinha lugar na cauda — era o caso do Rômulo em 27/08.

Linha **"Veio de"** no painel "Editar", só nas linhas da cauda (`isExtra ||
isAjuda`; quem está no rodapé daqui é da casa e a pergunta não existe), com os
hospitais MENOS o da fila + "Não informar". Grava o slug em
`linha_overrides[turno:chave].origem` via `definirOrigemLinha` (otimista, audit
com o user real) e chega à lib como `opts.origemManual` = `{ [chave]: { hospital,
label } }`. Quando o hospital de origem TEM escala, o valor aparece como
"(da escala)" e não precisa de toque.

- A marca **vence a derivada** — é declaração humana sobre alguém que a estrutura
  não enxerga. Mas marcar o MESMO hospital em que a pessoa já aparece **preserva a
  posição real de lá** (confirmar "veio do HRO" não pode zerar o 10º do Gustavo e
  empatá-lo com o 6º do Alexandre); de outro hospital, índice 0 e o sort estável
  mantém a ordem em que já estava.
- `origem` sobrevive a QUALQUER salvar do editor e ao "Restaurar automático", pela
  mesma razão de `trocaCom`/`assumidaPor`: é declaração sobre a pessoa, não ajuste
  de exibição — e é ela que decide a ordem de saída. Limpar é só pelo "Não informar".

### "Não é ajuda" para o badge DERIVADO (dono 14/09)

"Quando usuários estão marcados como ajuda, algumas vezes não aparece a opção de desfazer
ajuda." Sete fontes fazem uma linha ser Ajuda; só a entrada em `ajuda_externa` tinha
desfazer. O badge da fila lia `isAjuda` OU "extra fora de todo rodapé"; o botão do painel
lia só `isAjuda` — badge derivado (emprestado pelo cruzamento de escalas, extra sem origem,
visitante de outro rodapé) aparecia com o botão DESLIGADO, e o toque ADICIONAVA a pessoa ao
array (ela caía para o fim da fila; no slot assumido adicionava o nome do DONO do slot).

- **Um predicado só:** `ehAjudaVisivel(linha)` na `LiberacoesView` decide badge E botão.
- **Desfazer um badge derivado é declaração persistida:** `linha_overrides[turno:chave]
  .semAjuda = true` (`definirSemAjudaLinha` no context, mesma mecânica de `origem`; em
  `CAMPOS_RASTRO`, então sobrevive ao editor, ao Restaurar e à republicação). A view passa
  `opts.semAjuda` (Set de chaves) à lib, que deixa de carimbar `isAjuda`/`ajudaFora` e a
  ORIGEM derivada (`idxOrigem`/`hospOrigem` devolvem null) — posição, `teveCasos` e o resto
  da linha ficam. Tocar de novo limpa a declaração (volta ao automático); linha comum sem
  declaração entra no array como sempre. Ajuda ESCRITA no array continua saindo do array.
- **Casamento tolerante** em `nomeAjudaDe`: uid, `nomeOriginal` e nome exibido, além da chave.
- FDS intacto: o badge derivado de extra já era só de dia útil (05/09).

### Cirurgião uma vez, cirurgias abaixo — tempo por cirurgia e SOMA no total (dono 14/09, tarde)

Escolhido em maquete (`.tmp/tempos-por-cirurgia-c.html`, 430px, dois temas). No card da
fila, cada cirurgião aberto da pessoa é um TÍTULO, e cada cirurgia dele uma linha embaixo:
**hora · nome curto · término** ("faltam 12min" na que está em andamento, "até 12:05" na
agendada) — o término SÓ quando informado; sem ele a linha acaba no nome. A frase "N
cirurgias · M com término informado" saiu. Só no dia a dia da linha: renovada, cirurgião
ajustado à mão e card sintético (noite) seguem no desenho antigo (uma linha por cirurgião).

⚠️ **A fila só MOSTRA o término, não informa (dono 15/09, foto do card da Giovana):** *"retire
o badge de tempo ao lado das cirurgias, quero que apenas adicione o tempo correspondente à
cirurgia quando adicionado tempo no card"*. O tracejado "+ término" e o "Ajustar" por cirurgia
(nascidos em 14/09) SAÍRAM, junto com a folha "Término de …" da view. O tempo de cada cirurgia
se informa no CARD dela — `CasoDetalheSheet`, nas abas Completa e Minhas — como já estava
decidido em 31/07 ("é LÁ que se informa o tempo de cada cirurgia"); a fila reflete pelo
realtime. O texto do término na linha é `<span>`, não botão. `onDefinirTerminoCaso` continua
como prop da view porque o espelho inverso (pílula → caso único, seção abaixo) grava por ela.

- **A fileira de baixo fica SOB O CÍRCULO (dono 15/09, opção C em maquete):** "há bastante
  sobra de espaço à esquerda do card, abaixo do círculo". As colunas do número (w-5) e do
  círculo (w-9) só servem à linha do nome; abaixo dela, a fileira [infos | pílula/Editar]
  recua `-ml-14` (`deitado:-ml-9`, sem a coluna do número) e desce `mt-2` para não encostar
  no círculo visual. É essa largura que faz cada cirurgia caber numa LINHA SÓ, com o tempo
  colado ao nome (sem `flex-wrap`, sem `ml-auto`) — só um nome muito longo encurta com "…".
  Medido em 15/09 a 375/390/430: sem quebra, sem corte. A coluna da direita não muda.
- **Dados:** `linha.cirurgias` (`colunaLiberacao.js`): as cirurgias ABERTAS da pessoa em
  ordem de horário — `{ id, hora, token, procedimento, terminoPrevisto, andamento, sala }`,
  sem dado de paciente. O token continua existindo para o desenho antigo.
- **Nome curto:** `nomeCurtoProcedimento` (`src/lib/escalaProcedimentoCurto.js`) — dicionário
  por família calibrado nos 1.203 procedimentos distintos dos 30 dias até 14/09 ("RESSECCAO
  ENDOSCOPICA DA PROSTATA" → RTU; "PROSTATOVESICULECTOMIA…" → Prostatectomia) + fallback
  que tira a embalagem e fica com a cabeça da frase. Lista de conferência do dono em
  `.tmp/nomes-curtos-procedimentos.md`. Rótulo errado = entrada nova no dicionário, com teste.
- **`PainelTempo` devolve `meta.minutos`** quando a escolha foi DURAÇÃO (atalho ou "Outro
  tempo…"); hora exata não traz meta. Quem consome é o detalhe do caso — a fila deixou de
  abrir o painel por cirurgia em 15/09. O handler `onDefinirTerminoCaso(casoId, hhmm, meta)`
  da página segue existindo para o espelho inverso da pílula.
- **Duração encadeada** (`terminoEncadeado`, utils): na cirurgia EM ANDAMENTO "1h" é agora
  + 1h; na que ainda não começou é **término da anterior da mesma pessoa + 1h** (a última,
  por hora, que já tem término; sem anterior com término, agora). Vale no detalhe do caso
  (Minhas/Completa) — a fila só mostra o resultado (15/09).
- **SOMA no total** (`espelhoTempoTotal`, ampliado): com UMA cirurgia o total espelha o
  término dela (30/07); com TODAS as cirurgias da pessoa com término, o total vira o ÚLTIMO
  término (= soma das durações encadeadas). Alguma sem término → total manual (29/07
  continua valendo aí). Limpar o término de uma delas quando o total ainda é a soma gravada
  limpa o total; total mexido à mão fica. Chamado no detalhe do caso e no handler da página
  (caminho da fila). A pílula da pessoa continua editável e vence quando editada à mão.
- ⚠️ Isto SUPERSEDE, para o caso "todas informadas", a regra de 29/07 de que o total nunca é
  soma — decisão explícita do dono em 14/09. Travas: `liberacoesPainelLinha.test.jsx`
  (grupos, término só quando informado, espelho único), `casoDetalheSheet.test.jsx` (encadeamento e soma),
  `espelhoTempoTotal.test.js`, `colunaLiberacao.test.js` (`cirurgias`),
  `escalaProcedimentoCurto.test.js`.

### ⛔ O total é informado INDEPENDENTE dos tempos individuais (dono 15/09, à tarde)

**Não reintroduzir o espelho PARCIAL.** A v5.12.8 (15/09, 17h) fez "com alguma cirurgia
informada, o total vira o último término entre as que têm" e recalculava o total ao mudar o
status — a partir da foto do card do dono ("13:00 Varizes · faltam 1h56" e a pílula em "2h29":
*"tempo informado não corresponde ao tempo total"*). Ficou 30 minutos em produção. Ao ler a
explicação (a pílula 19:00 tinha sido gravada à mão às 14:56 com três cirurgias sem término;
às 16:27 uma terminou e outra ganhou 18:27), o dono decidiu: *"quero que mantenha o sistema
em que é informado o tempo total independente dos tempos individuais das cirurgias"*.
Revertido na v5.12.9.

- A pílula é a estimativa da PESSOA para o turno. Divergir do "faltam X" de uma cirurgia com
  outra ainda sem término é ESPERADO, não defeito — quem ajusta é a pessoa, na pílula.
- O que continua valendo é só o que já existia: uma cirurgia ↔ total (30/07 e 14/09) e
  todas informadas → soma (14/09). Alguma sem término → manual (29/07). Nada disso roda ao
  mudar STATUS.
- Travas: `espelhoTempoTotal.test.js` (describe "o total é independente dos tempos
  individuais" — inclusive `espelhoTempoTotal.length === 3`, sem `patch` de status) e
  `escalaTerminadaZeraTempo.test.jsx` (describe "o total NÃO muda com o status").

### "Terminada" zera o tempo da cirurgia — e SÓ dela (dono 15/09)

*"Ao clicar em terminada o tempo referente àquela cirurgia fique zerado para que não continue
contando como tempo."* O funil é o `setStatusCirurgia` do context (os dois botões — detalhe do
caso e faixa de urgências — passam por ele):
- `terminada` grava `terminoPrevisto: null` no otimista e no banco (`updateCaso` depois da RPC
  do status, que não conhece a coluna; só quando havia o que zerar). Erro na RPC reverte os
  dois. `iniciada`/`agendada` e os avisos (atrasada/suspensa/passa_tarde) não encostam no
  término — suspensa pode voltar.
- A pílula do total NÃO é tocada (seção acima). A linha da cirurgia some da fila por
  `casoConcluido`, e é isso que "para de contar".
- Trava: `escalaTerminadaZeraTempo.test.jsx` (context, com o cenário real do HRO de 15/09).

### Espelho do tempo nos DOIS sentidos (dono 14/09)

Com UMA só cirurgia aberta, o total da pessoa É o término dela. O caminho caso→total existe
desde 30/07 (`espelhoTempoTotal`, no detalhe do caso); a volta não existia, e ajustar a
pílula deixava "faltam 2min" no caso e "32min" na pílula. `definirTempo` (view) agora grava
também `terminoPrevisto` no caso pela prop `onDefinirTerminoCaso` (página →
`atualizarCaso(..., { silencioso: true })`; na fila única a escala é a do hospital do caso),
com as guardas do espelho de ida: `casosAtivos === 1 && casoIds.length === 1`, sem dupla
"A + B" (é de dois donos), sem "?". Com 2+ cirurgias o total segue 100% manual — nunca soma
de estimativas (29/07). Trava: `liberacoesPainelLinha.test.jsx`, describe "a pílula do total
espelha…".
- Nada disso encosta em `ordem_liberacao`.


## Quem está de ajuda em OUTRO hospital (dono 2026-08-30/31 — caso Oscar)

Uma pessoa, duas telas, e as duas estavam erradas.

**Na escala DELE** (Unimed, onde está no rodapé e não tem cirurgia): nascia
"Liberado". `naoEscalado` respondia olhando UMA escala, e quem está de ajuda fora
não tem caso aqui **por definição** — a razão da linha vazia era ele estar
operando do outro lado da cidade. O dono: *"Oscar deve permanecer na lista de
liberações da Unimed, ser marcado como ajuda e conter no card
local/cirurgia/cirurgião onde ele está."*

**Na escala ONDE AJUDA** (HRO, com cirurgia e fora do rodapé de lá): entrava
ACIMA do plantão do contraturno e era liberado DEPOIS dele. O dono: *"Oscar sai
antes de Guilherme Xavier porque Guilherme é plantão do contraturno mas não está
como ajuda."*

### A regra da ordem — a exceção é ESTREITA

> **A ajuda passa à frente do plantão do contraturno DAQUI só quando ela própria
> é o plantão do contraturno de OUTRO hospital.** Os dois requisitos juntos.

Dono em 31/08, corrigindo a generalização que eu tinha escrito no dia anterior
("ajuda sempre sai primeiro, sem exceção"): *"ISSO ESTÁ ERRADO!! A escala de
amanhã é uma EXCEÇÃO, Oscar só irá sair antes do plantão do contraturno do HRO
porque ele é plantão de contraturno de outro hospital e está como ajuda."*

Os dois pegam plantão no próximo turno; o daqui já está em casa, o de fora ainda
precisa atravessar a cidade. **Ajuda que não é plantão em lugar nenhum continua
saindo depois do plantão daqui**, exatamente como desde 19/08 — `fechaComPlantao`
continua de pé, e a exceção é uma partição das ajudas por `contraturnoDe(linha)`
(quem FECHA o rodapé de outro hospital naquele turno).

⚠️ **"Aqui de ajuda" tem DUAS formas, e a partição precisa das duas.** `isExtra`
é quem tem caso aqui e não aparece no rodapé daqui; quem está escrito **em AZUL
no rodapé** (`ajudaExterna`) é ajuda declarada e vem com `isAjuda`, **sem**
`isExtra` — foi assim que o Oscar chegou no HRO, e a 1ª versão desta exceção
passou por cima dele ("na aba liberações não houve alteração"). `ajudaFora` fica
fora das duas: essa é a pessoa NOSSA emprestada para fora, que mantém a posição
daqui (31/07).

⚠️ Regra de fila reportada como errada raramente vira regra geral. Antes de
transformar um caso em "sem exceção", perguntar: **o que neste caso é
particular?** Aqui era ser plantonista dos dois lados, não ser ajuda.

### O mecanismo (não crie um segundo)

`ajudandoFora` / `ajudaFora` / `ajudaForaInfo` foram desenhados em **30/07** e
ficaram parados esperando o dado. Ligar é encher `presencaOutros` com os CASOS
dos outros hospitais (`sala` + `cirurgiao`), em `EscalaCirurgicaPage`. Daí sai
tudo de graça: a pessoa MANTÉM a posição de liberação daqui, ganha o badge
**Ajuda**, o card diz `Ajuda IOSC/HRO · Mauricio Fabiani`, e a lib carimba
`teveCasos` — então ela não nasce liberada.

⚠️ **O recorte que faltava** (e que causou o revert de 04/08, `ebfa726`, por
"falso emprestado"): **só entra quem NÃO tem cirurgia AQUI**. Quem opera nos dois
trabalha nos dois e não está emprestado a lugar nenhum; quem tem caso só lá está
deslocado. Sem esse recorte a inferência por casos volta a errar.

No modo FDS não existe "outro hospital": os três são a MESMA fila.

### O card de quem está EMPRESTADO usa o mesmo desenho dos outros (dono 11/09)

*"Lista de cirurgiões está desconfigurada, deve ser organizada em coluna como os
outros cards, não deve conter número de procedimentos, apenas cirurgiões
(verifique porque saiu do padrão e corrija)."*

Por que saiu do padrão: a linha "Ajuda CC - Sala 2/Unimed · 2 cirurgias · Mateus
Baptistella, Mauricio Spagnol" nasceu em **30/08** como UMA frase concatenada com
"·", enquanto o bloco de cirurgiões do card já era **um `<p>` por nome desde
24/07**. Dois códigos para a mesma informação, escritos com um mês de distância —
e só o mais novo ficou fora do padrão. Com 2+ cirurgiões a frase furava a largura
do card.

Hoje o bloco é um `<div>` com a cor (`text-[13px] leading-snug
text-muted-foreground`) e um `<p class="truncate">` por linha: destino primeiro,
cirurgiões abaixo. **O nº de cirurgias saiu** — com os nomes em coluna a contagem
virou o número de linhas, e `ajudaForaInfo` deixou de devolver `casos` (o campo
só existia para aquela frase).

⚠️ A asserção de 09/09 ("o destino não é azul") olhava a `className` do próprio
`<p>`; com a cor no bloco, ela subiu para o container **e ficou mais estrita** —
nem o bloco nem nenhuma linha dentro dele pode ser azul. Trava em
`liberacoesPainelLinha.test.jsx`, com DOIS cirurgiões de propósito: com um só,
coluna e frase renderizam igual e o teste passaria sem a correção valer de nada.

### Turno próprio — jornada especial PODE sair fora da ordem (dono 11/09/2026)

*"A Louise deve sair da escala às 19h (ou criar a possibilidade de liberar ela às 19h), a
escala especial dela o turno é das 13 às 19h."* Ela é a 4ª de 15 no rodapé do HRO, então a
ordem só chegaria nela em **12º lugar**: a trava de 27/07 recusava o toque, e restavam duas
saídas ruins — liberar 11 colegas que ainda operavam, ou deixar a saída dela sem registro.

`linha_overrides[<turno>:<chave>].turnoProprio = { ate: 'HH:MM' }` isenta a linha **só do
bloqueio de liberar** (`bloqueioOrdem`, lado `liberar`, na `LiberacoesView`): o toque nela
nunca é recusado, esteja a fila onde estiver. Ela **continua na ordem** (`naFila`): quando a
fila chega nela é ELA o "próximo a ser liberado", conta no "faltam N" de quem está acima, e
quem está acima espera por ela. A hora combinada é um **teto para a espera dela**, nunca um
motivo para os de cima saírem antes.

⚠️ **A 1ª versão (manhã de 11/09) a tirava da fila inteira** (`naFila` → false, o caminho do
plantão do turno na fila única) — e às 18h09 do mesmo dia o dono mandou a foto: HRO da tarde,
5º–15º liberados, Louise (4ª) em sala com "Turno até 19:00", e o **3º do rodapé** com o cartão
amarelo "Próximo a ser liberado". *"próximo a ser liberado está errado na escala, corrija."*
"Sair fora da ordem" tinha virado "ser pulada": os de cima passavam na frente dela antes das
19h. A frase "tira da conta de faltam N" era o próprio defeito, não a virtude.

O card **diz o porquê** ("Turno até 19:00 · pode sair fora da ordem"), na receita das linhas
irmãs (13px, muted, sem cor nem ícone). Sem a frase, ver alguém do meio da fila sair antes dos
de baixo lê como fila furada — que é exatamente o que a trava existe para impedir. "Pode", e
não "sai": quando a fila chega nela o card traz a frase E o cartão amarelo, sem contradição.

⚠️ **NÃO trava a liberação antes da hora, de propósito.** A hora é informação no card e quem
libera é gente olhando o relógio; travar criaria um modo de falha novo (relógio do aparelho,
plantão que acaba antes) para resolver algo que a fila nunca teve — ninguém libera colega por
engano. A marca também **não libera sozinha**: a pessoa segue trabalhando até alguém tocar.

⚠️ **QUEM DECIDE É A ESCALA NUMÉRICA, não a mão (dono 11/09, no mesmo dia).** *"Mantenha a
Louise nesse esquema enquanto a escala numérica vier com a escala especial para ela. A partir
do momento que não houver, deixar as regras conforme os outros anestesistas."* A marca é
**recarimbada a cada publicação** a partir de `excecaoTurnoDoDia` — nos DOIS caminhos, a skill
(`escalaConferenciaHeadless`) e a tela (`ImportarEscalaPage`), porque as duas passam por
`montarLinhaOverrides`. Quando o quadro acabar (edição de 2026: depois de 20/11), a função
devolve `null`, a marca deixa de ser gravada e a pessoa volta à ordem — **sem nada a
desmarcar**. Escala especial nova no dataset já funciona sozinha: ver
`.claude/rules/escala-numerica.md` para o formato (`excecoes`).

⚠️ Não existe UI para marcar à mão, e é de propósito: a fonte é o documento. Se um dia precisar
de marcação avulsa, o lugar é o painel "Editar" da linha, junto de "Veio de" — e aí a derivada
não pode simplesmente sobrescrever a declaração humana (é a lição de `origemManual`, 27/08).

Travas: `escalaNumericaOrdem.test.js` (describe da `excecaoTurnoDoDia` — o caso que mais vale é
"fora da vigência a marca some SOZINHA", porque é ele que dispensa alguém de lembrar de
desmarcar) e `liberacoesPainelLinha.test.jsx` (describe "Turno próprio"; a fixture marca quem
está no MEIO do rodapé, senão qualquer regra passaria). Os dois últimos casos do describe são a
trava das 18h09 — "com os de baixo liberados, é ELA o próximo" e "liberar o 1º com ela em sala é
recusado" — e os dois FALHAM contra a 1ª versão (conferido trocando a view pela de `origin/main`).

## Anotação manual da linha × casos (dono 16/09/2026)

Na fila, `linha_overrides[turno:chave].local` e `.cirurgioes` (editor da linha) e `.renovado` (marca do
desfazer liberação) **vencem** o que vem dos casos (`LiberacoesView`: `localExibido = ov.local || salasAuto`,
`listaCirurgioes = ov.cirurgioes ? […] : …`, `usaGrupos = !renovado && !ov.cirurgioes && …`). Foi assim que
trocar ADRIANO↔PAULO na Escala completa "não mudou nada" na Liberações: a anotação da LOUISE e o `renovado`
seguiram na tela. Regra: **quando um caso passa a dizer onde a pessoa está, a anotação cede** —
`limparAnotacaoDaLinha` (contexto) apaga os três em `setAnestesistaCasos` (quem recebe casos),
`adicionarCaso` e `atualizarCaso` (sala/cirurgião editados); tempo informado, observação, troca, assunção,
origem e decisões da conferência sobrevivem; sem resto, o override some. A troca simultânea e o "assumir
posição" (RPC `executarTrocaAtomica`) preservam a anotação do slot de propósito — são fluxos da própria fila.
Ao investigar "a fila não mudou", olhar `linha_overrides` ANTES de suspeitar do realtime: a troca de aba no
mesmo aparelho nem passa por ele.

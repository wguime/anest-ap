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

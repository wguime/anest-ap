---
paths:
  - "src/lib/escalaCirurgicaUrgencias.js"
  - "src/lib/escalaCirurgicaStatus.js"
  - "src/pages/escala-cirurgica/FaixaUrgencias.jsx"
  - "src/pages/escala-cirurgica/SalasUrgenciaSheet.jsx"
  - "src/pages/escala-cirurgica/useEstadoUrgencias.js"
  - "src/pages/escala-cirurgica/BoardView.jsx"
  - "src/__tests__/**/escalaCirurgicaUrgencias*"
  - "src/__tests__/**/escalaUrgenciasSincronia*"
description: Escala Cirúrgica — urgências do HRO: contrato por turno, salas-estação, fila e sincronia das superfícies
---

<!-- Movido do CLAUDE.md em 2026-08-26 (otimização de contexto): o arquivo passou de
     1.603 linhas para o alvo oficial de <200. O texto abaixo está VERBATIM — nenhuma
     decisão do dono foi editada ou resumida. Esta rule carrega SÓ quando o Claude lê um
     arquivo que casa os `paths` acima. -->

### Urgências do HRO — contador de contrato + fila (dono 18–20/08)

O contrato do HRO paga por turno: manhã 1 orto (Sala 4) + 1 CO (Sala 7) + plantonista
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
  gravidade→`created_at` (⚠️ lido como `caso.created_at || caso.createdAt`: o service
  entrega `createdAt`, que está no CAMEL_TO_SNAKE, e o fallback cobre linha crua — ler um nome
  só pode dar NaN silencioso); NUNCA por `hora` (18/08: 9 de 9 urgências sem hora).
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
  (`.tmp/urgencias-hro-prototype.html`): grade 2×2 de cards em TRÊS linhas de papel fixo
  — papel · quem · onde+carga ("Sala 7 · 2 cir."), modelo B do dono em 09/09
  (`.tmp/urgencias-cards-modelos.html`) —, postos = plantão/sobreaviso + dedicados do turno (o
  dedicado leva barra cinza à esquerda: fica fora da conta); **excedente = card PRÓPRIO
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
- **Rótulos de sala (dono 20/08; rótulo CURTO desde 21/08, item abaixo):** `normalizarSalaHro`
  (idempotente) vale para sala digitada à mão no `AddCasoSheet` e no "Mudar" do detalhe, não só
  na importação, e devolve o rótulo curto (`Sala 7 - CO` → `Sala 7`).
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
- Card da fila de Liberações (coluna à direita, selos, cronômetro, tempo estourado): em
  `escala-liberacoes.md`; `send-fcm-push` em lote: em `escala-telas.md`.
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
- **Urgências: card do posto em TRÊS LINHAS + fila com uma linha por CIRURGIA (dono 21/08; card
  refeito em 09/09).** Card: papel · quem · onde+carga, modelo B escolhido pelo dono entre três a
  430px ("as informações nesses cards não ficam muito claras"): no desenho anterior, sala em cima e
  nome embaixo com o papel espremido à direita, contrato e dedicado pareciam a mesma espécie. O
  cabeçalho mostra o turno do contrato + uma pastilha por vaga, no lugar de "0 de 2 salas" ao lado
  de "2 livres" (detalhe no cabeçalho de `FaixaUrgencias.jsx`). A LINHA DA FILA continua em uma
  linha (`CARD_FILA`): ali não há sala, e o que se lê de relance é gravidade → procedimento →
  espera.
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

## Selos do caso quebram linha em vez de vazar (dono 16/09, foto de 14/09 19h01)

No `CasoCard` do quadro (Minhas/Completa) o grupo de selos do canto superior direito era
`shrink-0`: com "Iniciada" + "Passa para noite" ao lado de "Hemodinâmica V.A.P. 46a" a
ocorrência saía pela borda do card. Agora o grupo é `flex-wrap` sem `shrink-0` — a ocorrência
desce para uma 2ª linha, ainda encostada no canto (`justify-end` vale por linha). O Badge do DS
segue `whitespace-nowrap` (padroes-codigo.md): encolher o texto não estava em pauta. Trava em
`escalaCompletaQuadroDenso.test.jsx` ("os selos do canto direito quebram linha").

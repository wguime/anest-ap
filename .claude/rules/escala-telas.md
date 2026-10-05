---
paths:
  - "src/pages/escala-cirurgica/BoardView.jsx"
  - "src/pages/escala-cirurgica/CasoDetalheSheet.jsx"
  - "src/pages/escala-cirurgica/AddCasoSheet.jsx"
  - "src/pages/escala-cirurgica/ChipsEscolha.jsx"
  - "src/pages/escala-cirurgica/PainelTempo.jsx"
  - "src/pages/escala-cirurgica/DefinirAnestesistaSheet.jsx"
  - "src/pages/escala-cirurgica/FaixaHorarioPendente.jsx"
  - "src/pages/escala-cirurgica/SeloHorarioPendente.jsx"
  - "src/pages/escala-cirurgica/useHorarioPendente.js"
  - "src/lib/escalaHorarioPendente.js"
  - "src/pages/escala-cirurgica/ImportarEscalaPage.jsx"
  - "src/pages/escala-cirurgica/ImportarEscalasPage.jsx"
  - "src/lib/escalaLoteImportacao.js"
  - "src/lib/escalaHospitalEstrutura.js"
  - "src/pages/escala-cirurgica/destinatariosPush.js"
  - "src/pages/escala-cirurgica/useAvisoPlantonista.js"
  - "supabase/functions/send-fcm-push/**"
description: Escala Cirúrgica — desenho das telas, painéis de ação e recado do plantonista (decisões do dono em protótipo)
---

<!-- Movido do CLAUDE.md em 2026-08-26 (otimização de contexto): o arquivo passou de
     1.603 linhas para o alvo oficial de <200. O texto abaixo está VERBATIM — nenhuma
     decisão do dono foi editada ou resumida. Esta rule carrega SÓ quando o Claude lê um
     arquivo que casa os `paths` acima. -->

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
- **Importar · conferência**: barra fixa **Blocos · Ordem e decisões · Pendências** (o chip
  do meio era "Liberações" até 31/08) que ROLA até a
  seção (`#conf-blocos`/`#conf-liberacoes`/`#conf-pendencias`) — não troca de aba, porque
  bloco e fila precisam ser lidos na mesma passada — com faixa vermelha contando o que
  impede publicar. Fila de liberação em **2 colunas correndo para baixo** e **SEM contagem
  de casos por pessoa** (o número confundia): quem está na ordem sem cirurgia nenhuma leva
  **ponto âmbar** e o porquê é lido uma vez, na linha de decisão dentro do cartão da fila
  (31/08, § "Conferência — DECISÕES DO DIA"). Editor da posição abre FORA das
  colunas. Botão diz **"Publicar N casos"**. **SRPA da Unimed entra às 09:00** (dono 18/08):
  o mapa nunca escreve esse horário — 34 das 37 publicações com SRPA vieram sem hora — e sem
  ele a posição fica fora de toda conta de tempo, então é regra da casa e mora no código
  (`aplicarHoraPadraoPosicoes` em `escalaCirurgicaItens.js`), carimbada na conferência, onde
  ainda dá para corrigir. ⚠️ **só no MATUTINO**: a hora é o que decide o turno na publicação,
  e 09:00 numa importação vespertina jogaria a SRPA para FORA da escala da tarde. O horário
  da SRPA vespertina ninguém informou; até lá ela segue sem hora, herdando o turno escolhido.
- **Importar · LOTE do dia útil (dono 27/08)**: os arquivos dos hospitais entram
  TODOS DE UMA VEZ e a conferência ganha **uma aba por hospital**
  (`ImportarEscalasPage`, modelo B escolhido em protótipo a 430px). Cada arquivo
  se declara pelo layout (`hospitalDetectado`, que a leitura já devolvia e a tela
  só usava como sugestão) — o que não se declarou vira Select no próprio item,
  nunca palpite; a chave do item é o **HOSPITAL** (no FDS é hospital+dia, porque
  lá um documento cobre o fim de semana), então reanexar o mesmo hospital
  SUBSTITUI a aba. **Data e período seguem do LOTE**, um cartão só: "continuarei
  anexando as escalas um turno por vez". ⚠️ as abas são instâncias MONTADAS e
  escondidas (`oculta`), nunca `Tabs` do DS — `TabsContent` desmonta o painel
  inativo e levaria junto a conferência já feita (trava em
  `importarEscalasLote.test.jsx`). O selo da aba é **círculo de 20px** (mesmo
  diâmetro do badge do SegmentedSelector): vermelho = bloqueia publicar, âmbar =
  aviso, ✓ = pronta — a taxonomia da barra de pendências, agora por hospital.
  Publicar abre a **folha de revisão** (Sheet `!h-auto max-h-[88vh]`, senão nasce
  com 85% da tela vazia) listando os hospitais; o botão publica **uma escala de
  cada vez**, pela via de sempre. Hospital com bloqueio fica **de fora**, com o
  motivo, e não segura os outros — escala precisa publicar; e como a publicação
  não é transacional entre hospitais, o relato diz por nome quais subiram.
  **Ganho de graça:** com as escalas na tela, a duplicidade entre hospitais e a
  ajuda em azul passam a ser vistas ANTES da primeira publicação (antes o
  cruzamento só via o que já estava publicado — o primeiro hospital do dia não
  tinha com o que cruzar e o último decidia pelos dois).
- **Importar · lote em uso, 7 correções (dono 27/08, mesmo dia da entrega)**: o
  dono usou a tela no centro cirúrgico e mandou print de cada uma.
  **(1) A conferência só abre com o LOTE INTEIRO lido** — entregando aba por aba,
  ele começava a conferir a primeira com as outras ainda na Vision e a tela mudava
  de tamanho embaixo do dedo ("Lendo…" ao lado de escala aberta); o progresso diz
  "Lendo 2 de 3" e as abas entram juntas.
  **(2)** o seletor de período voltou ao padrão de 44px do DS: a 40px ficava mais
  baixo que o DatePicker e o cartão saía torto.
  **(3) O anestesista SAIU do título do bloco** e ficou só no seletor — aparecia
  duas vezes, e uma delas era a grafia que a leitura chutou; no lugar dele o
  **CIRURGIÃO**, que é quem identifica a sala na imagem (`CC - Sala 1 · Cesar
  Bombardelli`). ⚠️ bloco dividido por anestesista e SEM cirurgião (posição
  assistencial) mantém o nome importado — sem ele os dois blocos da mesma sala
  ficariam idênticos.
  **(4) A descrição das pendências vive abaixo dos chips**, com a AÇÃO de cada uma
  ("2 blocos sem anestesista", "1 nome ambíguo — escolha o login"): o número
  sozinho obrigava a rolar até o fim para descobrir o quê. Fica FORA da barra
  sticky de propósito (4 linhas ali comeriam altura fixa da conferência inteira) e
  tem `aria-label` próprio, senão o texto "impede publicar" disputa com o botão
  Publicar nos testes.
  **(5) Sala do IOSC não cai mais na "Sala 1" do HRO**: `normalizarSalaHro` passa a
  receber o **BLOCO** lido e, em seção-clínica (iosc/ho/ccoluna) com sala numérica
  ou vazia, a sala vira o nome da seção. A regra existia SÓ no prompt desde 24/07 —
  quando a leitura escorrega, a linha do IOSC cai numa sala do HRO junto de outro
  anestesista, que é o pior desfecho. Aqui não depende de leitura.
  **(6) CAUSA RAIZ achada em 28/08, com o recorte do mapa na mão:** HEMO, EXAMES
  e IMAGEM **não são cabeçalhos de seção** — são a PRÓPRIA LINHA da cirurgia
  ("09:00 | HEMO | ANGIOPLASTIA INTRALUMINAL – 2H | Alexandre Medeiros"), com o
  rótulo do local na coluna Leito, em fundo amarelo. O hint do HRO mandava o
  contrário desde 24/07 ("um rótulo na coluna Leito INICIA UMA SEÇÃO que vale
  para as linhas ABAIXO"): lida como título, a linha não vira caso e a cirurgia
  some sem rastro. Medido em produção (`scripts/diag-escala-secoes-hro.mjs`, 41
  importações do HRO em 60 dias): **Exames 90% · Hemodinâmica 49% · Imagem 15%** —
  e o padrão confirma a causa, porque Exames costuma ter linhas ABAIXO dele (que
  viram casos) enquanto Imagem quase sempre é uma linha só, justamente a que
  vira "cabeçalho" e desaparece. O prompt passou a decidir pelo CONTEÚDO: linha
  com hora, procedimento, paciente ou cirurgião é CASO e o rótulo é a sala dela;
  cabeçalho é só a linha que traz o rótulo e mais nada — destaque e cor não
  decidem (é o mesmo motivo do IOSC em roxo escorregar). Na tela ficou o aviso
  POR SEÇÃO faltante (o "só quando faltam as três" pegava 3 das 41 importações
  enquanto a Imagem se perdia em 35), travado em `importarEscalaConferencia`.
  **(7) O campo Sala virou ESCOLHA das salas daquele hospital** + "Outra sala…"
  para digitar: o `datalist` praticamente não abre no iPhone, então na prática a
  sala era sempre digitada — que é como a mesma sala vira três grafias e três
  blocos. A trava do foco de 30/07 (commit no BLUR) continua valendo DENTRO do
  campo livre.
- **Importar · FDS**: **P1–P12 em 2 colunas** (P1..P6 esquerda, P7..P12 direita) e as **3
  filas lado a lado** (Manhã · Tarde · Noite) — empilhadas passavam de uma tela e comparar
  turnos exigia vai-e-volta. Cabeçalho da coluna leva **só o turno**: os selos "do
  documento"/"Sugerida" saíram da tela (a origem continua em `fds_meta.ordemFonte`, que é
  quem a fila usa). Ordinal colado ao nome (`1º Matheus`), Pn acima em peso menor; mover/
  remover e o par texto+login abrem fora das colunas. Os dois dias seguem empilhados.

### Virada das 19h limpa o que JÁ ESTAVA terminado/suspenso (dono 2026-09-17)

*"Na transição da escala da tarde para noite, quero que exclua todos os procedimentos
terminados e/ou suspensos [...] a partir das 19 seguem os procedimentos da tarde que ainda
não terminaram e urgências."* E, na 2ª rodada do mesmo dia: *"após as 19h selecionar
'terminada' não deve excluir da aba completa, deve permanecer assim como é nos outros
turnos, deve apenas haver a limpeza [...] na transição do turno vespertino para noturno."*

É um **EVENTO da virada, não um filtro contínuo**: a Completa e a Minhas, a partir das
**19h da escala de HOJE** e só sobre os casos da **tarde**, escondem quem **já estava**
terminado/suspenso às 19h; quem termina ou é suspenso depois fica no quadro com o selo,
como em qualquer turno — um "Terminada" tocado por engano à noite continua ao alcance.
A sala que só tinha caso fechado some junto. A fila de Liberações já escondia caso
encerrado — nada mudou ali.

- Helpers puros em `utils.js`: `visaoNoturna({ agoraMin, dataEscala, hojeIso, turno })`
  (só `vespertino`, só hoje, ≥ `INICIO_NOTURNO_MIN` — regra do relógio como a fase da fila,
  mas **sem** `faseLiberacoes`, que exclui sáb/dom sem fila única por causa dos P1–P4) ·
  `concluidoAntesDaNoite(caso, { dataEscala })` · `limparConcluidosNaVirada(casos, …)`.
- **QUANDO concluiu vem do carimbo de cada eixo**: terminada (e "suspensa" legada no eixo
  principal) → `statusAtualizadoEm`; o toggle **Suspensa** do eixo extra NÃO carimba desde
  21/08 (é aviso, não transição) → só `updatedAt`, que é o que sobra para datar a suspensão.
  Consequência assumida: suspensa da tarde **editada** à noite volta ao quadro (o erro é para
  o lado de mostrar). Sem carimbo nenhum (legado/demo) conta como concluído antes.
- Por isso o **otimista carimba `updatedAt` nos DOIS ramos** (`setStatusCirurgia`), como a
  RPC (`updated_at = now()` em ambos): sem ele, suspender às 19h30 sumia até o refetch e
  voltava — o "vai e volta" de 21/08 de novo.
- **Outra data e a manhã consultada à noite ficam inteiras** — a noite é continuação da
  tarde, e o registro do dia continua legível no dia seguinte.
- **Quadro vazio à noite NÃO é o "Nenhum caso neste turno"**: é o caso normal (tudo limpo
  na virada) e leva um vazio próprio ("Nenhuma cirurgia em andamento") com o **"Adicionar
  caso" de pé** — é a hora da urgência; o "Recolher todas" some porque não há sala.
  Na Minhas, tinha caso e a virada limpou tudo → "Nenhuma cirurgia sua em andamento";
  sem caso meu nenhum → o vazio de sempre.
- Travas: `escalaCompletaNoite.test.jsx` + `updatedAt` no otimista em
  `escalaCirurgicaOtimista.test.jsx`.

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
  assunto** — a cirurgia · **Andamento** · Quem está e onde (desde 02/10 com o cartão
  **Horário da cirurgia** entre o primeiro e o Andamento — § "Horário da cirurgia"). O
  primeiro é leitura; o segundo traz os dois eixos (principal pinta o card, aviso convive
  com iniciada e é bloqueado por terminada) — o término desta cirurgia subiu para o cartão
  do horário em 02/10; o terceiro traz cirurgião,
  anestesista, residente, sala/local e ajuda. Sala, cirurgião, convênio e residente se
  corrigem pelo **"Editar dados da cirurgia"** (desde 01/09 — os mini-editores daqui saíram,
  § "Editar e EXCLUIR"); o editor que sobrou, o do tempo, abre em **folha de baixo
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
  As duas rotas ocupam a MESMA caixa (`h-[172px]`; a conta está no comentário do `PainelTempo`) porque
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

### Horário da cirurgia — início e término REAIS, acima do Andamento (dono 2026-10-02, modelo A em protótipo)

> "quero que seja possível adicionar o horário de início e fim de cada procedimento [...] tanto
> clicando no card do procedimento na aba completa como na aba liberações ao clicar em adicionar
> tempo [...] quero que essa informação ganhe destaque e quero que fique acima dos cards de andamento."

Reverte a recusa de 25/09 (a hora do toque era a última palavra) por pedido do próprio dono.
Protótipo `.tmp/inicio-termino-cirurgia.html` (2 modelos, 430px, dois temas, medição ao lado); o dono
escolheu o **A — dois blocos lado a lado** (o B era linha do tempo com barra) e, na mesma pergunta,
**"andam juntos"** (o horário acompanha o status) contra "independentes".

- **Cartão "Horário da cirurgia" ENTRE "a cirurgia" e o Andamento** (`CasoDetalheSheet`, serve
  Completa, Minhas e Urgências): borda verde `border-primary/55` + tinta `bg-primary/[0.045]`
  (dark /8), blocos **INÍCIO** e **TÉRMINO** de 88px com o horário em 30px, cada um um botão. Embaixo
  do número, o que dá sentido a ele: "agendada 13:30" no início; "faltam 45min"/"X além" (âmbar) ou
  "previsão" no término. No título, "em sala há X" (só no dia operacional da escala) ou "durou X".
  Faixa à esquerda repete a tinta do quadro: verde no início quando iniciada, azul no término quando
  terminada. Vazio = tracejado "Definir início/término". Quem não edita vê os blocos sem botão.
- ⚠️ **A linha "Término desta cirurgia" saiu do fim do Andamento** — subiu para o bloco TÉRMINO
  (nome acessível "Término desta cirurgia: …"). Não deixar o término em dois lugares.
- **Término = previsão enquanto corre** (`terminoPrevisto`, o mesmo PainelTempo de sempre — fila,
  pílula, espelho e "→15:30" do quadro intactos); **depois de Terminada é o REAL** (`terminoReal`,
  folha "Terminou há…" × "Horário de término").
- **Início** abre `PainelHoraPassada` (em `PainelTempo.jsx`, a fonte única da UI de tempo): o
  PainelTempo virado para trás — "Começou há…" (Agora, 5, 15, 30, 45 min, 1h + "Outro tempo…" até
  8h) × "Horário de início" (4 dígitos, mesma máscara), caixa fixa de 172px, Limpar, prévia "Começou
  às 14:05 · há 25min". Recusa com frase (`role="alert"`), sem gravar: no futuro (só no dia
  operacional da escala; 1 min de folga), início depois do término, término antes do início
  (`erroHorarioReal`).
- **O horário ANDA JUNTO com o status** — trigger `tr_escala_caso_horario_real` (migration
  `20261002190000`), espelhado no otimista por `horarioRealNaTransicao` (`src/lib/escalaHorarioReal.js`):
  Iniciada preenche o início com a hora do toque (se vazio); Terminada preenche o término (se vazio) e,
  se o início estava vazio, tira-o do carimbo de iniciada que o UPDATE vai sobrescrever; reabrir limpa o
  término; Agendada limpa os dois. **Valor informado à mão nunca é sobrescrito pelo toque** — é o que
  conserta a marcação em lote. Informar o início de uma cirurgia AGENDADA a marca Iniciada
  (`gravarInicioReal`: `setStatusCirurgia(..., { inicioReal })`, que grava o início ANTES da RPC para o
  trigger não trocá-lo); já iniciada, só o horário. "Limpar" não mexe no status.
- **Sincronia:** os campos são do caso — Completa, Minhas, Urgências e a folha do "+ Tempo total" leem
  o mesmo dado pelo mesmo realtime. A faixa de urgências conta "em sala há" do início real
  (`inicioDaUrgencia`, o dia vem da marcação — resolve a madrugada). Republicar o turno preserva os
  quatro campos junto com o andamento (RPC de 23/09, bloco do andamento).
- **Autor:** `inicio_real_por`/`termino_real_por` pelo mesmo trigger (`firebase_uid()`, com
  `status_atualizado_por` de reserva), no padrão de `termino_previsto_por`.
- **EditorSheet ganhou `px-4`**: o corpo das folhas de editor encostava na borda (o editor de término
  que estava no ar tinha o mesmo defeito); o protótipo aprovado tem 16px.
- Travas: `escalaHorarioCirurgia.test.jsx` (telas e sincronia), `escalaHorarioRealStatus.test.jsx`
  (context), `escalaHorarioReal.test.js` (lib + par com o trigger), `escalaHorarioRealSql.test.js`
  (PGlite: trigger, desfazer, script sem carimbo, republicação).

#### Revisão da tarde (dono 02/10, protótipo `.tmp/horario-compacto.html`) — o que vale HOJE

O dono usou a versão da manhã e mandou oito prints. O que mudou (e substitui o que estiver
acima em conflito):

- **Cartão 35% mais baixo** (94px contra 145px): blocos de UMA linha (`BlocoHorario`, em
  `BlocoHorario.jsx`, fonte única do detalhe e das Liberações) — rótulo e uma referência à
  esquerda, horário à direita (20px, 22px a partir de 400px). ⚠️ "agendada 13:30" SAIU do bloco:
  a 375/390px era cortada (a hora agendada já está no cabeçalho da folha); no lugar, o que só o
  bloco diz — "há 40min" no início, "faltam 45min"/"X além" (pela previsão) ou "durou 1h17" no
  término. ⚠️ colunas `grid-cols-2` (minmax(0,1fr)): com `1fr` puro o 2º bloco vazava do cartão
  a 375px.
- **"Editar dados da cirurgia" virou a pílula "Editar"** no canto do 1º cartão — o `ActionPill`
  do DS, o mesmo "Editar" do Estágios/Plantão da Home (alvo de toque crescido por `after:`).
- **INÍCIO e TÉRMINO são horários EXATOS**, e **o TÉRMINO deixou de ser a previsão**: o bloco é o
  horário real em que acabou. Informar o término marca **Terminada** (decisão do dono, "andam
  juntos", espelho do início); `gravarTerminoReal` + `setStatusCirurgia(..., { terminoReal })`.
- **O TEMPO ESTIMADO** (a previsão de término de sempre — `terminoPrevisto`, a fila, a pílula, o
  "→15:30" do quadro) é o botão `BotaoEstimado` no topo do cartão ("+ Tempo estimado" / "Estimado
  15:30"); some depois de Terminada.
- **CONFIRMAR O HORÁRIO** (`ConfirmarHorario`): tocar em **Iniciada/Terminada** (Andamento) ou no
  bloco **INÍCIO/TÉRMINO** abre o card "Início/Término da cirurgia" com o horário proposto em 40px
  (o já informado → a hora em que foi MARCADA iniciada, para quem começou antes de 02/10 → agora),
  "Confirmar início às HH:MM" e "Foi em outro horário? Digite o correto" (4 dígitos, grava ao
  completar). Pelo BOTÃO, confirmar aplica o status do botão (reabrir uma terminada pelo
  "Iniciada" vale); tocar o botão do status em que ela já está só CORRIGE o horário (reenviar o
  status recarimbaria o "Iniciada às…"). Pelo BLOCO vale a regra de `gravarInicioReal`/
  `gravarTerminoReal`. "Limpar horário" só pelo bloco, com horário gravado. Agendada e os avisos
  gravam no toque, como sempre. O "Terminada" da faixa de urgências (cirurgia esquecida) também
  passa pelo card.
- **PainelTempo** (as três folhas): abre SEMPRE no **"Horário de término"** (1ª aba); "Tempo
  faltante" em grade **4×2** (15min, 30, 45, 1h, 1h30, 2h, 3h + "Outro" na 8ª casa — o gatilho do
  Select do DS tem padding INLINE, encolhido por `[&_[role=combobox]]:!px-2`); "Limpar" na linha da
  prévia; a frase "Dois jeitos de dizer a mesma coisa" saiu; caixa de 104px (era 172).
- Travas novas/atualizadas: `escalaHorarioCirurgia.test.jsx` (25 casos), `painelTempo.test.jsx`,
  `escalaUrgenciasFaixa.test.jsx` (o "Terminada" confirma antes de gravar).

### Horário pendente — alerta PÚBLICO de quem não preencheu início/término (dono 2026-10-05, modelo A)

> "há vários anestesistas que não estão preenchendo as informações. quero que crie um alerta [...]
> marcando o anestesista que não preencheu e que seja público [...] só devem sair quando as
> informações de início/término forem preenchidas"

Protótipo `.tmp/alerta-horario-pendente.html` (3 modelos, 430px, dois temas); o dono escolheu o **A —
faixa no topo**. Regras em `src/lib/escalaHorarioPendente.js` (puro); dados em `useHorarioPendente`
(página); faixa + lista em `FaixaHorarioPendente`; selo em `SeloHorarioPendente` (card da Completa e
da Minhas, prop `pendencia` do `CasoCard` — está no comparador do `memo`).

- **Entra** quando o anestesista é LIBERADO na fila (`escala.liberacoes[turno:chave]`, uid ou nome
  normalizado; `{escalado:true}` do repasse NÃO é liberação; no FDS também a linha 'fds') **ou** quando
  o turno ACABA (13h/19h no relógio operacional) — o que vier primeiro. "Passa para tarde" vence com a
  tarde e não entra pela liberação; "passa para a noite" não vence no dia.
- **Sai** só com início E término — ou Suspensa. Fora da conta: sem anestesista/"?"/"//", sem
  procedimento, continuação (não conta em dobro, como na cobrança). Dupla "A + B" marca os dois.
- **Liberado com cirurgia ABERTA (uma ou mais — dono, mesma conversa):** a linha da lista diz
  "Liberado com a cirurgia aberta" e oferece **Preencher horário** ou **Colega assumiu** (o
  `DefinirAnestesistaSheet` do caso). Passada a cirurgia a quem não foi liberado, ela sai do alerta e
  volta a seguir a regra pelo nome novo.
- **Conta a partir da TARDE de 05/10** (`INICIO_ALERTA_HORARIO`). **Dura o dia operacional** (vira às
  7h) e só existe vendo HOJE; o que não foi preenchido no dia vai para o relatório de adesão — RPC
  `escala_horario_pendente_relatorio(p_desde, p_ate)` (migration `20261005150000`, mesmos cortes da
  lib; acesso = `can_write_escala_cirurgica()`, porque devolve procedimento). Ao vivo, sem tabela: não
  há caminho para preencher dia anterior. ⚠️ O "dia encerrado" dela vira às 07:00, não é o
  `escala_adesao_ultimo_dia()`.
- **Sem push e sem caixa de entrada** (a escala parou de notificar em 30/07): é só tela.
- **Relatório (modelo A, `.tmp/relatorio-horario-nao-preenchido.html`)**: seção "Horário não
  preenchido no dia" em `src/pages/escala-adesao/SecaoHorarioNaoPreenchido.jsx`, logo depois dos
  indicadores da página de adesão — último dia encerrado · 7 dias · período da ABA (a janela segue a
  aba: 30/60 dias ou o mês, `useHorarioNaoPreenchido`) e a lista por pessoa (`montarRelatorioHorario`);
  o toque abre as cirurgias por dia, só leitura. Sem acesso (42501) a seção não aparece. O card da Home
  NÃO mudou (decisão de 05/10).
- Faixa: vermelho-claro `destructive/[0.07]` (escuro /16), texto `category-red-fg`; nomes em pílulas
  numa linha só, as que couberem + "+N" (medidas numa fileira invisível, `quantasPilulasCabem`).
  Folhas montadas mesmo com zero pendência (preencher a última com o detalhe aberto não fecha o
  detalhe). Selo: Badge `destructive` OUTLINE + `ClockAlert` (sólido já é Suspensa/Emergência).
- Travas: `src/__tests__/lib/escalaHorarioPendente.test.js`, `src/__tests__/pages/escalaHorarioPendente.test.jsx`.

### Editar e EXCLUIR o caso publicado (dono 2026-09-01, modelo A em protótipo)

> "ao adicionar novo caso, após adicionado não é possível editar… ou eventualmente
> procedimento foi adicionado de forma errada."

Estado anterior: o detalhe corrigia **sala, cirurgião, convênio, residente** (um
editorzinho cada) e **hora, procedimento, paciente e idade não tinham conserto
nenhum**; excluir não existia em lugar algum. Protótipo
`.tmp/editar-excluir-caso.html` (2 modelos, 430px, dois temas, medição ao lado);
o dono escolheu o **A — um formulário só**.

- **`AddCasoSheet` serve os dois sentidos**: sem `caso`, acrescenta; com `caso`,
  EDITA preenchido ("Editar caso" · botão **Salvar**). O detalhe ganhou a porta
  única **"Editar dados da cirurgia"** (`onEditarCaso`) e voltou a ser o painel de
  ESTADO — os quatro mini-editores saíram. Medição que decidiu: com mini-editor
  para os oito campos o painel iria a **1163px** (rola, excluir 425px abaixo da
  dobra); assim fica em **721px** e cabe no teto de 88vh.
- **A porta existe nas TRÊS abas** (Completa, Minhas, faixa de Urgências). Um botão
  só na Completa recriaria a "aba pela metade" que a Minhas deixou de ser em 29/07.
- ⚠️ **O ANESTESISTA continua no `DefinirAnestesistaSheet`** e o POSTO do contrato
  continua no ⚙ da faixa: o primeiro decide dupla/substituição/posição na fila (um
  Select perderia isso, e salvo vazio apagaria a dupla "A + B"); o segundo é
  configuração de SALA, não campo do caso.
- **A dupla "A + B" existe em TODOS os modos da folha** (dono 14/09). Era "só no modo
  CASO" desde 11/08, e foi assim que a Hemodinâmica da tarde de 14/09 perdeu a dupla:
  o dono abriu pelo cabeçalho da sala (modo SALA, 3 linhas com "//"), a linha "Dois
  anestesistas" não existia, confirmou uma pessoa e as três ficaram só com ela. A
  dupla vai para os ALVOS (no modo SALA, as cirurgias que mudam de mão; sala
  multi-anestesista já chega split por pessoa). E o **primeiro da dupla pode ser quem
  já responde**: acrescentar a Gabriela ao Adriano não exige re-escolher o Adriano no
  seletor que nasce vazio. **A dupla já gravada nasce PREENCHIDA** (`duplaAtual`: as
  duas metades resolvidas pelo dicionário, campo do segundo já aberto): trocar só uma
  metade é um toque no card ASSUME (primeiro) ou no Select (segundo); "Só um
  anestesista" desmarca o segundo e grava o primeiro com login; escolher como primeiro
  quem era o segundo INVERTE a ordem em vez de apagar uma metade; a metade que não
  mudou volta com a grafia ORIGINAL, nunca reescrita pelo dicionário (`apelidos[0]` é
  o alfabético — "GUILHERME M ELO"). Confirmar só acende quando algo muda. Só "?" e
  dupla com metade que o dicionário não resolve ("OSCAR + ?") ainda exigem escolher o
  primeiro. Reparo do dia: `scripts/repair-escala-2026-09-14-hemodinamica-dupla.sql`.
- ⚠️ **O patch é DIFF, nunca o formulário inteiro**: `anestesista` e `ordem` não têm
  campo nesta tela e seriam apagados. Abrir e fechar sem tocar em nada não escreve.
- ⚠️ **`iniciais()` não é idempotente** — "M.C.G." é um token só e virava "M.".
  Passava despercebido enquanto o formulário só CRIAVA caso. O guard `soIniciais`
  usa o MESMO predicado do CHECK do banco (`[[:alpha:]]{3,}`): o que já está na
  forma aceita lá não é reprocessado.
- **Hora que cai no outro período PERGUNTA antes de mover** ("15:00 é da tarde —
  mover?"). O turno é campo próprio desde 26/07, então a hora não o move sozinha, e
  mover calado faria o caso sumir da tela de quem acabou de editá-lo. Só pergunta
  quando o turno GRAVADO é matutino/vespertino: sem turno explícito ou no FDS quem
  filtra o quadro já é a hora, e o caso se move sozinho.
- **EXCLUIR só o caso `origem = 'manual'`** (coluna nova, migration
  `20260901130000`). O que veio do mapa se conserta republicando o turno. A marca é
  do BANCO, não palpite da tela: `addCaso` grava `'manual'` (fora de `CASO_FIELDS`,
  para nenhum `updateCaso` poder converter um caso do mapa em apagável) e as três
  RPCs de publicação inserem com lista explícita, caindo no default `'importacao'`.
- **Backfill do histórico por DUAS condições**, não uma: nasceu ≥30s depois do lote
  do seu `(escala, turno)` **E** nasceu sozinha (`irmaos = 1`). A segunda veio da
  validação e vale a lição: `addCaso` insere UMA linha por chamada, então
  `created_at` compartilhado é lote de publicação. Sem ela, **77 linhas** de três
  lotes de 23/07 (32, 29 e 16 — sobreviveram por terem `turno NULL` na época) seriam
  marcadas manuais e ganhariam o botão. Resultado real: 196 manuais / 3.390
  importados.
- **A exclusão deixa rastro**: trigger `tr_escala_caso_evento_exclusao` grava em
  `escala_cirurgica_evento` (`tipo='exclusao'`, autor por `firebase_uid()`), só para
  `origem='manual'` — logar o lote inteiro de toda republicação seria ruído, e caso
  do mapa não tem botão. LGPD: como o resto da tabela, não copia paciente/idade.
- A confirmação **nomeia** a cirurgia e avisa nos dois casos em que excluir
  provavelmente não é o que se quer: cirurgia já **iniciada** (marque Suspensa) e
  caso **particular** (a cobrança já criada não some junto).
- Travas: `addCasoSheetEdicao.test.jsx` (22 casos). ⚠️ os testes de GRAVAÇÃO de
  residente/sala/cirurgião/convênio **mudaram de arquivo** — saíram de
  `casoDetalheSheet.test.jsx` e exercitam o mesmo invariante pelo caminho novo;
  lá ficou o que é do painel (leitura + a porta, que some para quem não edita).

## Recado do plantonista (dono 17/08) — mensagem na aba Liberações

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


## De quem é o anexo — layout **e** conteúdo (dono 2026-08-30)

> "Tentei anexar as escalas de amanhã de manhã, mas não está reconhecendo a escala do HRO."

O hospital de um arquivo vinha de UMA fonte: o `hospitalDetectado` que a Vision devolve
olhando o **layout** — e, do lado do Excel, de uma suposição de extensão (`planilha =
Unimed`, verdade enquanto só a Unimed exportava planilha).

Layout é frágil aqui por uma razão do papel: **o mapa do HRO e o do Materno têm as MESMAS
colunas** (Leito/Paciente/Cirurgião/Procedimento) e a assinatura do HRO é a **cor** —
células amarelas e o rodapé vermelho. Print desbotado, foto de lado ou recorte sem o
rodapé não entregam cor. Os dois desfechos:

- classificação **vazia** → o arquivo cai na fila do "de qual hospital é isto?";
- classificação **trocada** → o arquivo entra na aba do OUTRO hospital, **por cima dela**,
  e a escala do HRO simplesmente não aparece. Este é o caro, e era silencioso.

`src/lib/escalaHospitalEstrutura.js` dá a segunda fonte, do conteúdo já lido: **IOSC,
Hospital de Olhos, Centro de Coluna, Hemodinâmica, Digimax e Bloco M só existem no HRO;
SRPA, Accurata, Umanitá e as seções C.O - CESAREA / CENTRO CIRÚRGICO, só na Unimed**.
Exames, Imagem e Consultório ficam de fora de propósito — os dois têm. Em planilha o
cabeçalho decide: **LEITO** é do HRO, **IDADE/TEMPO** são do export da Unimed.

⚠️ **A assimetria é a regra, não detalhe de implementação:** uma marca **preenche** o que a
leitura deixou vazio; são precisas **duas** para **contradizer** o que ela afirmou. Encher
um vazio é barato; derrubar uma leitura afirmativa por causa de um `bloco` solto (a Vision
erra um de vez em quando) sairia caro. E contradição **não escolhe sozinha** — ela manda
PERGUNTAR, com o que o conteúdo viu ("o conteúdo é do HRO, mas o layout foi lido como
Materno"). Regra da casa intacta: sugere, nunca troca sozinho.

⚠️ **Dois arquivos para o mesmo hospital no MESMO lote não é reanexo** — é classificação
errada de um dos dois. O segundo **pergunta** em vez de substituir; substituir em silêncio
apagaria uma escala inteira que a tela ACABOU de dizer que leu. Reanexar em OUTRO lote
continua substituindo, que é o que quem reanexa está mandando fazer.

O fluxo de FIM DE SEMANA (`classificarAnexoMapa`, em `escalaFdsMapas.js`) usa a mesma
lib e a mesma assimetria desde 31/08 (`decidirHospital` + estrutura; contradição devolve
`conflitoHospital` e pergunta) — § "Auditoria ponta a ponta", item 4.


## 2ª rodada do lote (dono 2026-08-30, noite) — quatro defeitos

**1. O que sobra no lote é DEDUZIDO.** O mapa do HRO daquela segunda não tinha
marca nenhuma: as salas eram "Sala 3", "Sala 6", e **"Sala N" pelado é dos dois
hospitais** (o da Unimed às vezes vem só com o número — dono 25/08). O lote sabe
o que o arquivo sozinho não sabe: se os outros dois já são Unimed e Materno, o
que sobra é o HRO. Não é palpite, é conta — e por isso ela **só fecha quando
sobra UM arquivo para UMA vaga**; com duas vagas livres continua perguntando. A
dedução é DITA na tela, nunca silenciosa.

⚠️ As marcas de `escalaHospitalEstrutura.js` foram MEDIDAS no banco (1.000 casos
em 60 dias) e a medição derrubou três que pareciam óbvias: **Hemodinâmica** (9 no
HRO, 11 na Unimed), **SRPA** (3/18) e o **bloco `materno`** (6 no Materno, 3 na
Unimed, onde é o C.O da própria casa). Marca que existe nos dois não classifica —
classificar por ela manda a escala para a aba errada, que é o defeito de origem.

**2. Ajuda declarada não é duplicidade por classificar.** "Oscar está como ajuda
de outro hospital no HRO, foi identificado como ajuda e mesmo assim a escala não
pôde ser publicada." O nome em AZUL no rodapé **já é a resposta** da pergunta que
o painel faz. Vale a ajuda de QUALQUER lado (quem é ajuda no HRO aparece
duplicado também na conferência da Unimed). O item continua visível, como
informação; o que ele deixa de fazer é travar.

**3. A decisão de duplicidade é do LOTE, não da aba.** "Tive que clicar a mesma
informação nas 3 abas dos hospitais, mesmo já tendo informado e no caso não tendo
relação com o Materno." A duplicidade é da PESSOA e a chave dela é a mesma em
qualquer aba: responder uma vez responde para todas. Fora do lote (tela de uma
escala só) o estado segue local.

**4. Bloco de UM caso não pergunta o anestesista duas vezes.** O seletor do bloco
JÁ é o daquele caso; o seletor por caso existe para FURAR a atribuição do bloco,
e com um caso não há o que furar. Mesma família da queixa de 27/08 (nome
duplicado no título e no placeholder).

⚠️ **Segue de pé:** quando a leitura perde a seção do IOSC e devolve `bloco:
"normal"` + `sala: "Sala 3"`, não há no arquivo o que recuperar — o guardrail de
27/08 (`normalizarSalaHro(sala, bloco)`) só corrige quando o bloco chegou certo.

## Conferência — DECISÕES DO DIA no cartão da fila (dono 31/08, modelo B em protótipo)

Reforma da superfície da conferência (`ImportarEscalaPage`, serve também cada aba do
lote) para quem publica sem treinamento: as decisões operacionais moravam no FIM da
página como avisos espalhados, sem lugar de preencher. Protótipo
`.tmp/conferencia-decisoes-modelos.html` (3 modelos, 430px, dois temas, medição ao
lado); o dono escolheu o **B — decisões coladas na fila**. Medição que sustentou o
desenho (`.tmp/diag-conferencia-uso-real.mjs`, banco desde 25/06): troca = 122
ações/5 semanas (53% entre hospitais); ajuda = 55 declaradas (origem confirmável em
33); alguém fora da ordem em 31% dos turnos; duplicidade ~3/semana; posição
assistencial só tem 2 rótulos reais (SRPA Unimed ×54 · Consultório HRO ×11 — **não
ganhou controle novo**: situação que não acontece não ganha botão).

- **A barra segue com 3 âncoras**; o chip do meio virou **"Ordem e decisões"** com
  selo âmbar (nº por responder+conferir), ✓ verde quando tudo respondido, e o nº de
  nomes quando não há decisão nenhuma.
- **As decisões são linhas de 52px DENTRO do cartão da fila** (toda decisão é sobre
  quem entra, sai ou muda de lugar NELA), cada uma abrindo **folha** (Sheet bottom,
  `!h-auto max-h-[88vh]`) com as saídas em botões de largura inteira. Respondida =
  linha verde com "Refazer". **Os dados gravados são os MESMOS de antes**
  (`ajudaTexto`, `duplicidadeDecisoes`/`trocaEscolhida`, `ordemTexto`) — a reforma é
  de superfície; a publicação, a execução da troca declarada e o bloqueio de
  duplicidade não mudaram.
- **UMA linha por pessoa**: a "ajuda provável" do cruzamento (rodapé lá + caso aqui)
  é a MESMA pessoa que a lib de duplicidades pendura como pendência — eram dois
  avisos com o mesmo botão. A partição é pela forma: **casos nos DOIS hospitais →
  âmbar "em dois hospitais"** (folha: Trocou com… pré-sugerido · Trabalha nos dois ·
  É ajuda aqui); **só rodapé lá → azul "ajuda de fora?"** (mesma folha com "Marcar
  como ajuda" na frente). "Fora da ordem" ganhou a 2ª saída com botão (**Acrescentar
  à ordem no fim** — antes era só texto). "Na ordem sem cirurgia" (ponto âmbar) é
  linha de CONFERÊNCIA: a folha explica (cauda avisa que nasce LIBERADO) e não grava.
- **O Input de texto da ajuda SAIU**: marcar é pela folha/fila; **remover é o
  "Refazer"** da linha verde "marcado como ajuda" (ajuda fora da ordem não aparece na
  lista numerada — sem essa linha ela ficava invisível e irremovível). Pendências
  ficou só com avisos de conferência contra a foto (seções ausentes, repetidos,
  conflitos, travessias); o cartão-resumo aponta para onde a resposta mora.
- **O anestesista é perguntado UMA vez por bloco**: a linha do caso LÊ o nome herdado
  ("Com RODNEI · do bloco") e o seletor abre só pelo lápis (63% dos blocos têm 1
  caso; multi-anestesista real = 22% das salas — o Select repetido por caso quase
  nunca trabalhava). ⚠️ a trava do lote **"com DOIS casos o seletor por caso volta"
  MUDOU DE LADO** com o porquê no corpo (`importarEscalasLote.test.jsx`).
- Travas novas em `importarEscalaDecisoesDoDia.test.jsx` (11 casos, todos vermelhos
  contra o código anterior); `importarEscalaTrocaDuplicidade.test.jsx` segue travando
  a MECÂNICA (trocaCom na chave do turno; execução na publicação; assunção
  unilateral) pelo caminho novo da folha. Validação visual real:
  `.tmp/shot-conferencia.mjs` (login E2E + edge interceptada, cenário 31/08
  Oscar/Rodnei⇄Janaína) — a folha real pré-sugeriu a Janaína pelo par simétrico.
- **AZUL DE EMPRESTADO não vira ajuda DAQUI (dono 01/09 — caso Eduardo, corrigido à
  mão 2× em 2 dias antes da regra).** No mapa do HRO o azul tem dois sentidos; o de
  "nosso, emprestado" gravado na ajuda daqui joga a pessoa para o fim da fila DAQUI
  (o oposto do certo) e a ajuda-declarada do lado errado silencia a duplicidade. Na
  conferência, azul da LEITURA + nome no rodapé daqui + casos em outra escala do dia
  + nenhum caso REAL daqui (pseudo-linha "MATERNO | EDUARDO" não conta —
  `PSEUDO_SALAS_HOSPITAL`) = realocado: sai da ajuda daqui (one-shot, marca manual
  nunca é tocada — lição do campo grudento), vira linha informativa "emprestado ao
  X" com Refazer, e **a ajuda ATRAVESSA para a aba de DESTINO do lote**
  (`resumoAba.azuisRealocados` → `irmasPara` → effect de entrada): é a declaração da
  foto aplicada no lugar certo, e é o que faz "mantém a posição na origem · sai
  primeiro onde ajuda" valer sem pergunta nova. Com caso REAL aqui o azul fica (caso
  Tiago 30/07). `azuisEmprestados` puro em utils; travas no describe "azul de quem
  está no rodapé daqui" (`importarEscalasLote.test.jsx`).
- **A folha "na ordem, sem cirurgia" tem SAÍDAS, não "Entendi"** (dono 31/08, na
  primeira noite de uso: "apenas aparece um card com a mesma informação e um botão
  Entendi, nada acontece depois de clicar, não faz sentido"). As saídas vigentes (seis, em
  dois grupos, mais "Está certo — sem cirurgia hoje") moram em
  `.claude/rules/escala-trocas.md` § "A folha 'Onde está X hoje?'". Quem já está marcado
  como ajuda SAI da lista de conferência: ajuda sem caso aqui é o normal dela. Folha
  informativa sem ação é beco — toda folha de decisão precisa gravar ou levar a quem grava.

## Auditoria da leitura (dono 2026-08-31) — o lote lia SEM as regras

> "Ao publicar a escala de hoje a tarde ela ficou com vários erros. Quero que faça
> uma auditoria a respeito da leitura das escalas e regras."

Conferidos linha a linha os três documentos do dia contra o publicado: **4 defeitos
em 63 casos** (HRO 28/28 e Unimed 35/35 em contagem — nada sumiu, nada sobrou).

**A causa de fundo:** até 31/08, `HOSPITAL_HINT[hospital]` só entrava no prompt quando o
`hospital` era enviado. O **lote de dia útil (27/08) lê cada arquivo sem `hospital`** — o
hospital é justamente o que ele quer descobrir —, e com isso a leitura passou a
rodar **sem nenhuma** das regras por hospital acumuladas desde 24/07: as
seções-clínicas do HRO, a herança do `//`, os rótulos de sala, os blocos do rodapé
da Unimed. Elas existiam e simplesmente não chegavam ao modelo pelo caminho que
virou o padrão. Sem hospital declarado, agora vão **os três** conjuntos (~700
tokens), com a instrução de aplicar só o do layout reconhecido.

⚠️ **Regra para a próxima vez:** ao trocar o caminho por onde uma leitura passa,
conferir o que o caminho ANTIGO carregava junto. Aqui o lote herdou a chamada mas
não o argumento que a instruía — e o efeito só aparece semanas depois, como
"erro da IA".

**Os 4 defeitos, e o que ficou de guardrail:**

1. **IOSC, 2ª linha → "Sala 2" do HRO com a anestesista de lá.** A clínica numera
   as próprias salas 1–3 e os números colidem com os do HRO (erro de 24/07 de
   volta). Como a coluna ANEST era `//`, ela herdou por SALA e pegou a Daniela.
   → guardrail em `normalizarCasosHro`: **`//` logo abaixo de uma seção-clínica
   continua na seção**. Janela de UMA linha, e só linha com `//` — manter a seção
   aberta engoliria uma sala numérica de verdade que viesse depois.
2. **IOSC, 3ª linha → sala certa, bloco `normal`.** → **o rótulo manda no bloco**
   (a volta do guardrail de 27/08, que só fazia bloco→sala).
3. **Unimed: Diego e Fernanda trocados entre Exames e Imagem.** Blocos pequenos e
   empilhados; os dois no rodapé, então nenhum guardrail de ausência pegou. Só
   prompt.
4. **Unimed: os dois Consultórios com o nome do OUTRO na coluna do cirurgião.**
   Consultório não tem cirurgião. Só prompt.

⚠️ **Não há guardrail para a linha de clínica com NOME PRÓPRIO e sala interna** —
nada no arquivo a distingue de uma sala do HRO. Medido em 90 dias: **13% das salas
numéricas do HRO têm 2 anestesistas no mesmo turno legitimamente**, então "2
pessoas na mesma sala" não serve de aviso: seria ruído em 1 de cada 8. Esse caso
continua sendo da conferência.

Reparo do dado publicado: `scripts/repair-escala-2026-08-31-vespertino.sql`
(6 UPDATEs idempotentes, casando pelo valor errado; reimportar zeraria liberações,
tempos e a troca Rodnei⇄Janaína de um turno em andamento).

## Auditoria ponta a ponta (31/08, 2ª rodada) — a CLASSE do defeito, não os 4

Depois do reparo do vespertino, o dono pediu a auditoria do módulo inteiro atrás
da CLASSE: "regra que existe e não alcança quem precisa dela". Quatro
confirmadas, todas com teste que falhava contra o código anterior:

1. **`//` chegava PUBLICADO ao banco — 46 casos em 60 dias (medido).** O ramo
   final de `aplicarAtribuicoes` preservava o texto cru quando o grupo tinha
   nome fora do dicionário e ninguém escolhia login; e a fila PULA `//` em toda
   a lib — a cirurgia herdeira não contava para o dono da sala, que aparecia
   "livre" com cirurgia em aberto. Agora a herança é escrita por extenso na
   publicação (nome do grupo; dupla herda inteira, uid nulo). Metade dos casos
   veio dos mapas de FDS, que publicam pela mesma função.
2. **Leitura truncada entrava MUDA no lote.** A tela de uma escala avisa
   "leitura incompleta" desde 06/08 e o FDS tem aviso persistente na lista de
   mapas; o lote guardava `truncado` e não avisava nada
   (`ImportarEscalasPage` — agora entra no toast de problemas do anexo).
3. **"Planilha = Unimed" sobreviveu no fluxo de UMA escala.** O lote decide pelo
   CABEÇALHO desde 30/08 (LEITO = HRO); a tela individual seguia sugerindo
   "Usar Unimed" até para o xlsx do HRO com o HRO já escolhido. Agora
   `importarExcel` consulta `hospitalPelaEstrutura` e a extensão virou fallback.
4. **`classificarAnexoMapa` (FDS) ganhou a 2ª fonte** (`decidirHospital` +
   estrutura), a mesma assimetria do dia útil — o risco era maior lá: o mapa do
   HRO de feriado não tem coluna ANEST nem rodapé vermelho e casa com a
   descrição do Materno. Conflito devolve `conflitoHospital` e pergunta.

⚠️ Bônus da correção da edge (ebfacdd): os MAPAS de FDS (`secoesTurno: true`,
sem `hospital`) também liam sem NENHUMA regra por hospital desde 22/08 — o
mesmo buraco do lote, curado de carona pelos 3 hints por default.

Medições que sustentam o resto (`scripts/diag-escala-leitura-60d.mjs`):
turno×hora incoerente = 129 casos, TODOS de 22–24/07 (legado da migração por
turno, não defeito atual); "fora do rodapé" = 45 pessoas-turno em 108 turnos
(TETO — inclui trocas executadas legítimas); sala de seção com bloco `normal` =
14 casos desde 18/08 (série do defeito nº 2, reparo em
`scripts/repair-escala-2026-08-31-matutino-e-blocos.sql`, que também zera o
cirurgião dos 2 Consultórios da MATUTINA de 31/08 — mesmos defeitos do
vespertino, no turno que o reparo do dono não cobriu).

### `send-fcm-push` em lote (24/08)

<!-- Movido de escala-urgencias.md: os paths de lá não carregam com a edge. -->

- **`send-fcm-push` aceita `userIds` (lote, 24/08):** o recado alcança ~70 pessoas e uma
  chamada por destinatário seriam 70 requisições saindo do celular de quem escreveu, no meio
  do turno. O OAuth do Google resolve UMA vez e os lookups vão em blocos de 10. Contrato de 1
  pessoa (`userId` + 404 `no_fcm_token`) intacto — as mensagens internas dependem dele; os
  dois foram verificados contra a edge em produção depois do deploy.

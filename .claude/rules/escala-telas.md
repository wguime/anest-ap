---
paths:
  - "src/pages/escala-cirurgica/BoardView.jsx"
  - "src/pages/escala-cirurgica/CasoDetalheSheet.jsx"
  - "src/pages/escala-cirurgica/AddCasoSheet.jsx"
  - "src/pages/escala-cirurgica/ChipsEscolha.jsx"
  - "src/pages/escala-cirurgica/PainelTempo.jsx"
  - "src/pages/escala-cirurgica/DefinirAnestesistaSheet.jsx"
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

O fluxo de FIM DE SEMANA (`classificarAnexoMapa`, em `escalaFdsMapas.js`) tem a MESMA
lacuna e continua só com o layout — não foi tocado por ser outro fluxo; a lib é
compartilhável quando o dono pedir.


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

## Auditoria da leitura (dono 2026-08-31) — o lote lia SEM as regras

> "Ao publicar a escala de hoje a tarde ela ficou com vários erros. Quero que faça
> uma auditoria a respeito da leitura das escalas e regras."

Conferidos linha a linha os três documentos do dia contra o publicado: **4 defeitos
em 63 casos** (HRO 28/28 e Unimed 35/35 em contagem — nada sumiu, nada sobrou).

**A causa de fundo:** `HOSPITAL_HINT[hospital]` só entra no prompt quando o
`hospital` é enviado. O **lote de dia útil (27/08) lê cada arquivo SEM hint** — o
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

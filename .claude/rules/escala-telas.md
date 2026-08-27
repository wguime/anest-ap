---
paths:
  - "src/pages/escala-cirurgica/BoardView.jsx"
  - "src/pages/escala-cirurgica/CasoDetalheSheet.jsx"
  - "src/pages/escala-cirurgica/AddCasoSheet.jsx"
  - "src/pages/escala-cirurgica/ChipsEscolha.jsx"
  - "src/pages/escala-cirurgica/PainelTempo.jsx"
  - "src/pages/escala-cirurgica/DefinirAnestesistaSheet.jsx"
  - "src/pages/escala-cirurgica/ImportarEscalaPage.jsx"
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

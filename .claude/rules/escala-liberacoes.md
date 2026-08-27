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

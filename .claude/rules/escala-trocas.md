---
paths:
  - "src/pages/escala-cirurgica/TrocaSheet.jsx"
  - "src/pages/escala-cirurgica/DefinirAnestesistaSheet.jsx"
  - "src/pages/escala-cirurgica/VinculosSheet.jsx"
  - "src/pages/escala-cirurgica/ImportarEscalaPage.jsx"
  - "src/lib/escalaCirurgicaDuplicidades.js"
  - "src/lib/escalaCirurgicaItens.js"
  - "src/__tests__/**/planoTroca*"
  - "src/__tests__/**/importarEscalaConferencia*"
description: Escala Cirúrgica — trocas e posição assumida: TrocaSheet, execução na importação, duplicidade entre hospitais
---

<!-- Movido do CLAUDE.md em 2026-08-26 (otimização de contexto): o arquivo passou de
     1.603 linhas para o alvo oficial de <200. O texto abaixo está VERBATIM — nenhuma
     decisão do dono foi editada ou resumida. Esta rule carrega SÓ quando o Claude lê um
     arquivo que casa os `paths` acima. -->

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

✅ **CORRIGIDO em 05/09 (item 3.5):** a convergência executava os pares num loop
sobre um snapshot que não era atualizado entre execuções — com A⇄B e B⇄C
declarados no mesmo turno, a segunda sobrescrevia a primeira. `executarSubstituicao`
passou a devolver o estado resultante (o que a RPC transacional grava) e o loop o
mescla no snapshot antes da volta seguinte.

### As decisões da conferência viajam na PUBLICAÇÃO (Onda 3, 2026-09-05)

`rpc_publicar_escala_turno` (migration `20260905150000`) recebe mais dois parâmetros, com
default — a chamada de cinco chaves do FDS e do legado continua valendo:

- `p_linha_overrides` = `{ chave: { trocaCom?, duplicidade?, conferido? } }`, SEM prefixo de
  turno (a RPC prefixa) e SEM `por`/`em` (carimbados no servidor). `assumidaPor`,
  `liberadoEm` e `escalado` são RECUSADOS: só nascem de execução de troca ou de toque na
  fila.
- `p_preservar` = `{ campos, linhas: [{ chave, candidatas, liberacao }] }` — de quem SEGUE
  na escala, os campos listados do override antigo voltam com o carimbo ORIGINAL.
  **Decisão do dono (05/09): identidade e rastro sobrevivem à republicação do mesmo turno
  (`trocaCom`, `assumidaPor`, `origem`, `observacao`, `local`, `termino`,
  `duplicidade`, `conferido`); a liberação continua zerando (regra 23/07).** As
  `candidatas` existem porque o apelido aprendido entre duas publicações troca a chave da
  pessoa de nome para uid. `montarPreservacao` aceita `regraLiberacao`
  ('nunca' | 'mesma_posicao' | 'na_ordem') para o dia em que essa regra mudar.

Junto: posição assumida preservada RE-APONTA os casos que a foto ainda traz no nome do dono
antigo (antes viravam a linha extra `chave#casos`), e o trigger `log_escala_troca` rotula o
`motivo` pelo GUC `anest.publicacao` — `reset_publicacao` para o que a publicação apagou,
`publicacao` para o que ela declarou, `manual` para o resto (antes o rótulo vinha de
`v_new = '{}'` e, com a manhã marcada, republicar a tarde gravava tudo como "manual").

⚠️ Campo novo de `linha_overrides` que seja DECLARAÇÃO sobre a pessoa (e não ajuste de
exibição) precisa entrar em `CAMPOS_RASTRO` (`src/lib/escalaPublicacaoDecisoes.js`) **e** nas
listas de sobrevivência do context (`setLinhaOverride`, `toggleLiberacao`, `toggleEscalado`,
`definirOrigemLinha`). Faltando uma, ele é apagado em silêncio no primeiro Salvar do editor —
é a classe do bug de `origem` de 27/08.

⚠️ Sem teste de PL/pgSQL no repo: `scripts/smoke-rpc-publicar-escala.mjs` exercita a RPC
contra o banco dentro de uma função que termina em EXCEÇÃO — a transação cai e nada fica
gravado. É o jeito de conferir mudança nessa RPC antes e depois de aplicar.

### A folha "Onde está X hoje?" (Onda 3, 2026-09-05)

A pergunta do nome que está na ordem sem cirurgia tem SEIS saídas, em dois grupos, mais o
ghost "Está certo — fica Livre na posição" (`conferido`, audit A8). Cada uma grava no canal
que a FILA já lê: ajuda em `ajuda_externa`; **trocou com um colega** em `trocaCom` (declara e
executa na própria publicação, com `hospitalVaga` explícito — a vaga que muda de dono, que no
lote era ambígua, audit A3); **consultório/sobreaviso** como NOTA na posição do rodapé
(`(CONSULT)`/`(SOBREAVISO)`, que `rotuloNota` normaliza e que já impede a linha de nascer
liberada); e as três de conserto de extração (bloco, posição, remover).

A resposta é da PESSOA e é compartilhada pelas três abas do lote (mesmo espaço de chaves das
duplicidades, mesma dupla `carimbarDecisao`/`localizarDecisao`). Quem já aparece na
duplicidade NÃO rende uma segunda pergunta (audit A7). `duplicidade: 'intencional'` gravado
na escala publicada é lido de volta (`decisoesPublicadas`) e a pergunta não trava a
publicação de novo — "Refazer" ali grava `reaberta`, porque apagar faria a publicada
responder outra vez (audit A6).

⚠️ **"Está em outro hospital sem troca" NÃO é saída da folha** (dono 04/09: é exceção e fica
como está) — `emprestadoA` e o painel "Foi para" seguem fora do escopo.

### A execução da troca é uma transação só (item 3.5, 2026-09-05)

`rpc_escala_executar_troca(p_lados, p_limpar)` (migration `20260905220000`) faz, numa
transação: o `assumidaPor` de cada lado, a saída do `trocaCom` e os casos que mudam de dono
em todos os hospitais envolvidos. Antes eram 2 a 4 escritas saindo do navegador com desfazer
LIFO — e o desfazer também podia falhar, deixando "Parte foi revertida, confira a lista"
com dois anestesistas na mesma sala (audit A15). O rollback do cliente SAIU: não há estado
pela metade a desfazer.

- **Lock:** os cabeçalhos entram em `for update` ORDENADOS POR ID — sem isso, duas trocas
  cruzadas simultâneas pegam os mesmos cabeçalhos em ordens opostas e travam uma na outra.
- **Idempotência (D10)** virou do SERVIDOR: lado já assumido por quem o plano quer pôr é
  pulado, e a RPC devolve `pulados` (é o que vira o aviso "Troca já executada").
- **Devolve o estado resultante** (`{escalas, casos, pulados, lados}`): é ele que atualiza o
  snapshot da convergência entre execuções (A11) e o estado local sem reler a escala.
- `por`/`em` são carimbados no servidor, dentro e fora do `assumidaPor`.
- O modo DEMO segue 100% em memória (base dos e2e), pelo mesmo caminho de cálculo.

⚠️ Sem suíte de PL/pgSQL no repo: `scripts/smoke-rpc-executar-troca.mjs` exercita a RPC
contra o banco dentro de uma função que termina em EXCEÇÃO — a transação cai e nada fica
gravado. É a cobertura do SQL, inclusive do "tudo ou nada".

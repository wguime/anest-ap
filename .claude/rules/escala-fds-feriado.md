---
paths:
  - "src/lib/escalaFds.js"
  - "src/lib/escalaFdsMapas.js"
  - "src/pages/escala-cirurgica/ImportarEscalaFdsPage.jsx"
  - "src/pages/escala-cirurgica/ConferirMapaFdsPage.jsx"
  - "src/pages/escala-cirurgica/LiberacoesView.jsx"
  - "src/__tests__/**/escalaFds*"
  - "src/__tests__/**/importarEscalaFds*"
  - "e2e/escala-cirurgica-fds*"
  - "e2e/escala-cirurgica-feriado*"
  - "e2e/importar-fds-mapas*"
description: Escala Cirúrgica — fim de semana e feriado: fila única, linha pseudo-hospital 'fds', mapas na mesma entrada
---

<!-- Movido do CLAUDE.md em 2026-08-26 (otimização de contexto): o arquivo passou de
     1.603 linhas para o alvo oficial de <200. O texto abaixo está VERBATIM — nenhuma
     decisão do dono foi editada ou resumida. Esta rule carrega SÓ quando o Claude lê um
     arquivo que casa os `paths` acima. -->

### Modo FIM DE SEMANA — fila de liberação ÚNICA (dono 15/08)

Sáb/dom operam com UMA fila por turno cobrindo os 3 hospitais (documento
"ESCALA DE FINAL DE SEMANA": grade P1–P4 em 3 faixas 7-13/13-19/19-07 × 4
colunas Unimed/HRO/ret1/ret2 + listas numeradas P5+ por período + linha "1º→
último a ser LIBERADO" por turno). A fila vive numa linha **pseudo-hospital
`'fds'`** de `escala_cirurgica` (migration `20260815120000`: CHECK +'fds',
coluna `fds_meta` jsonb {grade, posicoes Pn→pessoa, escalacao, ordemFonte},
RPC aceita 'fds' e rejeita fds_meta em hospital real) — RLS por papel e
realtime cobrem sem mudança; **`HOSPITAIS` NÃO ganhou 'fds'** (slot extra
`escalas.fds`, carregado só em FDS). ⚠️ **sentido da ordem**: o doc escreve
"1º→último a ser liberado" = INVERSO do rodapé; a inversão é ÚNICA, na
publicação da conferência (`rodapeDeOrdemDoc` em `src/lib/escalaFds.js`) —
nunca em leitura, nunca flag. Pn→pessoa normalmente vale o FDS INTEIRO (dom
7º=Thayna foi troca pessoal — domingo herda o sábado, editável); a ordem de
liberação NÃO é derivável (P09,P10,P11 ≠ reverso) — turno sem linha nasce com
SUGESTÃO (inverso da escalação) marcada "Sugerida". Importação: edge em
`modo:'fds'` + conferência própria `ImportarEscalaFdsPage` (login vence texto;
bloqueiam publicar: ordem vazia, Pn sem dono, 1º nome ambíguo);
**funcionárias do bloco PLANTÃO MATERNO NUNCA viram posição** (→ `ignorados`;
Renata/Elisete têm escala própria); publica até 4 turnos `hospital='fds'`,
`casos: []`. Fila unificada (`LiberacoesView modoFds`): casos dos 3 hospitais
mesclados (`hospitalOrigem` só exibição), badge **Pn P1–P12** por posição,
hospital prefixa o local, badges "Plantão Unimed/HRO" da faixa da grade
(genérico "Plantonista" sai), `opts.turno` OMITIDO na lib (regra
plantão-do-turno-seguinte é de dia útil; namespacing das marcações segue na
view); **trocas e P4-coringa FORA do modo FDS**. Fase noturna:
`faseLiberacoes({fds:true})` liga 19h/23h no sáb/dom com a faixa 19-07 DA
GRADE (`linhasNoturnasFds`; Unimed/HRO fixos = `foraDaFila`, nunca "próximo").
HomeCard mostra os plantões físicos da faixa (madrugada <7h = grade da
véspera); Pega Plantão ganhou P12 no FDS. **NOTURNO É TURNO, não fase (dono
15/08 21h):** o seletor do FDS tem 3 turnos (Matutino·Vespertino·**Noturno**) e
o relógio escolhe entre eles às **7h/13h/19h** (`turnoFdsAtual`) — a fusão
antiga por cima da lista do dia roubava o topo e RENUMERAVA a manhã ("sábado de
manhã não está idêntica"); hoje conferir a manhã às 21h mostra a manhã pura. Os
cards do noturno herdam a cirurgia da tarde em curso (`FDS_TURNO_CASOS`:
noturno lê casos do vespertino — o CHECK do banco só aceita matutino/
vespertino). **A FILA DA NOITE É MAIOR QUE A GRADE (dono 16/08:** sáb
P2,P1,P4,P3,**P11,P8,P7** · dom P3,P4,P1,P2,**P11,P6,P5** — "apenas adicione os
P's faltantes"): quem está de plantão à noite ≠ quem está na fila da noite, e os
Pn da lista numerada que entram são os que saem PRIMEIRO. `opts.ordem` de
`linhasNoturnasFds` (nomes, convenção do rodapé) é a fila; a grade só decide
POSTO (papel "Plantão Unimed/HRO" + `foraDaFila`). Quem está na grade e não foi
citado NUNCA some — vai para a frente (sai por último); sem ordem publicada a
fila segue sendo a linha 19-07 esquerda→direita. Mora em
**`fds_meta.ordemNoite`** porque 'noturno' não é turno de publicação, e o meta
vai inteiro em toda publicação (republicar não apaga; migration
`20260816120000` gravou 15–16/08). A conferência tem a 3ª lista, editável como
as outras: sem linha de noite no doc ela nasce da grade marcada "Sugerida", e
noite vazia NÃO trava a publicação (cai na grade) — manhã/tarde travam.
**Substituto na vaga:** nome fora do P1–P4 na
linha 19-07 (dom: JOAO RICARDO) some se casar por primeiro nome
(`resolverNomeEstrito` proíbe token solto p/ nome composto) e ASSUME o selo da
vaga livre quando é 1↔1 (P3 da Cristina), com "Substituindo X" no papel. Rollout: sem linha 'fds' publicada,
sáb/dom seguem por hospital + aviso a quem edita. Demo `DEMO_DATE_FDS`
(27/06, DEV-only) + e2e `escala-cirurgica-fds.spec.ts`.

### FDS — todos os arquivos numa entrada só (dono 22/08)

"é assim que recebo os arquivos": no fim de semana chegam JUNTOS, no mesmo dia, a
tabela de posições (sáb+dom) e um mapa cirúrgico por hospital e por dia. Os 4
arquivos de 22–23/08 custavam **6 leituras da Vision e 9 publicações**, com
hospital/data/período trocados à mão entre elas. `ImportarEscalaFdsPage` virou a
**LISTA DE DOCUMENTOS** (modelo A, escolhido em protótipo a 430px): a tabela é o
1º item porque vale os dois dias, cada mapa entra como item que se declara
sozinho (hospital pelo layout, data pelo cabeçalho — `classificarAnexoMapa`;
o que a leitura não resolveu vira Select no próprio item, nunca palpite), e um
"Publicar fim de semana" faz as 4 filas + uma chamada por (hospital, dia, turno)
COM casos. Chave do item = hospital+dia: reanexar o mesmo par SUBSTITUI.

⚠️ **O fluxo de DIA ÚTIL ganhou o lote em 27/08** — o "não mexa" de 22/08 valia
para o TURNO, e essa parte continua de pé. O dono voltou ao assunto pedindo o
anexo em lote também no dia útil ("quero que verifique a possibilidade de
adicionar como é feito no final de semana") com **uma aba de conferência por
hospital**, e mantendo o resto: "continuarei anexando as escalas um turno por
vez". Ver `escala-telas.md` → *Lote do dia útil*. A edge segue igual: sem a flag
`secoesTurno` o prompt é literalmente a mesma string, e o lote do dia útil NÃO a
envia (lá o turno vem da hora, e a faixa MATUTINO/VESPERTINO é do mapa de FDS).

**O que faz a leitura ficar correta — o turno vem da FAIXA, não só da hora:** o
turno saía de `turnoDeHora`, e as linhas **"AS"** (a seguir) do HRO não têm hora —
herdavam o período selecionado NO ANEXO. Por isso o mesmo mapa precisava ser
anexado duas vezes, e a tarde se perdia (6 das 15 cirurgias do HRO em 22/08 são
"AS"; em 21/08 a produção tem 4 casos com `hora='AS'` e 14 sem hora). A edge em
`secoesTurno: true` lê a faixa **MATUTINO/VESPERTINO** e devolve `turno` por caso;
`turnoDoCasoImportado` decide **hora > faixa > padrão** (a hora vence porque
`selecionarCasosDoTurno` republica por ela).
⚠️ **A herança de "//" NÃO pode atravessar a faixa:** ela é por SALA, e a Sala 1
do HRO tem THAYNA às 7h com a coluna da tarde VAZIA — sem fronteira, as 3
cirurgias da tarde sairiam no nome dela, em silêncio. Daí
`prepararCasosFimDeSemana` preparar o lote POR TURNO. Só morde onde o documento
deixa a tarde em branco, que é o caso do mapa de fim de semana (no dia útil a
tarde traz nomes próprios).

**Sugestão pelo posto da grade** (dono 22/08): sala sem nenhum nome no mapa entra
pré-selecionada com quem a grade põe naquele hospital naquele turno
(`anestesistaDoPosto` — HRO 13–19h = Rômulo), marcada "Sugerido pelo posto da
grade". Só alcança grupo SEM nome lido, e só se o login resolver — nunca chuta
identidade. Conferência do mapa (`ConferirMapaFdsPage`) é enxuta de propósito: no
FDS o mapa **não tem rodapé** (a fila é a da linha 'fds'), então não há lista
numerada, ajuda, troca nem duplicidade — e `ordemLiberacao: []` na publicação do
mapa, senão nasceria uma 2ª ordem concorrendo com a única.

Guardrail anti-perda espelha o do dia útil: anexo menor que o turno já publicado
(≥3 casos) pede "Republicar por cima". Refs: `src/lib/escalaFdsMapas.js` (lib
pura) · `ConferirMapaFdsPage.jsx` · testes `escalaFdsMapas.test.js` +
`importarEscalaFdsMapas.test.jsx` · e2e visual `importar-fds-mapas.spec.ts`.
⚠️ a edge `parse-escala-cirurgica` PRECISA de re-deploy para a faixa valer.

### FDS — UMA TELA SÓ (dono 24/08), depois da análise dos 5 fins de semana

"Quero organizar as escalas de final de semana apenas com lista de liberações."
A análise (5 fins de semana no banco) confirmou e mostrou o porquê real: em dois
deles houve **mais toques para DESFAZER liberação do que para liberar** (13×3 em
15/08, 9×3 em 22/08, estes em 13 minutos), sempre pela mesma causa — cirurgia sem
anestesista definido faz a pessoa aparecer sem trabalho e a fila se desmancha. O
quadro por sala resolve um problema que o sábado não tem (12 salas contra 42) e
é largamente abandonado (15/08 e 23/08: NENHUMA cirurgia marcada). Mas ele não
podia sumir sem levar junto a ação mais usada: no fim de semana quase toda
marcação é na cirurgia **de outra pessoa** (19 de 20 em 22/08), por 1 a 3 pessoas
no dia — alguém cobrindo o grupo.

**A tela:** sáb/dom perdem as ABAS e o SELETOR DE HOSPITAL (`BarraControles`
aceita `null` nesses eixos = "não existe esse eixo aqui"); sobra a fila, com
data e turno. Dia útil intocado. Card no **modelo A** (ações empilhadas à
direita, escolhido em protótipo): **hospital ISOLADO** em caixa alta logo abaixo
do nome, **sala** na linha seguinte, **cirurgiões em lista** depois — numa fila
que cobre três hospitais "onde a pessoa está" é a primeira pergunta, e a caixa
alta curta lê como rótulo em vez de disputar com o nome.

⚠️ **"Terminei" NASCEU E SAIU NO MESMO DIA (dono 24/08, três decisões seguidas):**
botão da linha que encerrava de uma vez as cirurgias em aberto no nome da pessoa
→ restrito à fila única → **REMOVIDO**, e a coluna de ações voltou a ser
`+ Tempo total` + `Editar`, a mesma dupla do dia útil ("verifique como os cards
estão configurados em dias úteis e use a mesma distribuição"). Medido depois da
remoção: a coluna caiu de 87 para **55px** e o espaço vazio da fila de 222 para
**84px**, porque a altura do card passou a ser ditada pelo TEXTO e não pela
coluna. ⚠️ o problema que o botão atacava CONTINUA de pé: em 22/08, 15 das 35
cirurgias nunca saíram de "agendada", e sem atalho na linha o encerramento volta
a ser caso a caso no detalhe. `linha.casoIds` (ids das cirurgias abertas da
pessoa) ficou na lib, testado, para quando houver outra ideia.

**Painel da linha ganhou três assuntos, só na fila única:** **Hospital** (campo
próprio no override — quem troca de hospital no meio do sábado não tinha como
dizer isso), **Responsável** (troca o NOME mantendo a posição: assunção
unilateral pelo mesmo motor do dia útil — pedido do dono para "alguém de FORA da
escala fazer um turno específico") e **Posição na fila** (trocar de vaga com um
colega, duas assunções cruzadas numa transação; "pode deixar a opção, mas não é
a regra"). ⚠️ `ordem_liberacao` continua IMUTÁVEL nos três — muda quem ocupa a
vaga, nunca a ordem publicada.

⚠️ **DEFEITO CORRIGIDO: o seletor de Local abria VAZIO no fim de semana** — a
chave saía de `hospitalLabel.toLowerCase()`, que ali vale `"fim de semana"`
(inexistente em `LOCAIS_BASE`), e o complemento vinha de `escala.casos`, que na
linha 'fds' é SEMPRE vazio. Era por isso que `local` nunca havia sido usado num
sábado. Agora a lista é a união dos três hospitais, estreitando quando há
hospital escolhido na linha.

⚠️ **`executarSubstituicao`/`desfazerSubstituicao` passaram a resolver ONDE O
CASO MORA**: na fila única a linha 'fds' não guarda caso nenhum, e o snapshot de
rollback e o patch otimista liam `lado.hospital` — a reversão não restauraria
nada e o quadro só pintaria no realtime.

⛔ **NADA DISTO ATRAVESSA PARA O DIA ÚTIL (dono 24/08, 2ª mensagem):** *"solicitei
alguns ajustes para escala do final de semana e esses ajustes ficaram para a
escala de dias úteis — não quero que sejam aplicadas em dias úteis. Faça apenas o
solicitado."* A primeira versão adotou CINCO coisas do protótipo do fim de semana
também no dia útil, e as cinco voltaram: o **recado do plantonista** (cartão com
rótulo + "Confirmar leitura" de largura inteira → volta a faixa de borda a borda
de 17/08 com a pastilha "Confirmar" no canto); o **"Importar"** do cabeçalho
(outline sem ícone → volta a `ghost` com o ícone); a pastilha **"Assumir"** no
bloco de sem-anestesista (→ volta "Toque para definir o anestesista"); e a
**ordem do card** (hospital isolado + sala ANTES dos
cirurgiões → volta sala ABAIXO do cirurgião, desenho de 20/07). O gate é
`modoFds` em cada ponto. (O "Terminei" saiu de vez horas depois — ver acima.)

⚠️ **PUBLICAÇÃO PINTA TODO MUNDO DE VERDE na fila única (dono 24/08):** "ao
publicar escala de final de semana, todos os usuários apareçam com o card verde".
A cauda vermelha automática (21/08) e o card BRANCO de "Livre" (20/08) nasceram
do DIA ÚTIL, onde o rodapé traz gente que fecha a lista sem cirurgia nenhuma. Na
fila única quem está publicado ESTÁ de plantão, e o mapa cirúrgico chega em
importação SEPARADA — muitas vezes depois: metade da lista nascia descolorida ou
vermelha, dizendo "já foi embora" de quem tinha acabado de entrar na escala. Em
`modoFds` o vermelho volta a ser só do toque humano. O BADGE "Livre" fica — é
informação verdadeira ("sem cirurgia agora") e não some com a tinta. Medido em
22/08 depois da mudança: 12 cards, 0 liberados automáticos. O dia útil mantém as
duas regras. ⚠️ **A pastilha do alerta SAIU (dono 24/08, 3ª volta no mesmo elemento):**
"Toque para definir" (dia útil) → pastilha "Assumir" só no fim de semana →
"Adicionar anestesista" → **a pastilha sai e vale a FRASE ABAIXO nos dois
modos**. O que decidiu foi a medida, não o gosto: inline a pastilha comia **48%
da linha** (183px de 378) e sobravam 195px para hora, hospital, sala,
procedimento e cirurgião — a sala ainda não truncava, mas por pouco. Abaixo, o
texto recupera a linha inteira (**376px** medidos no app) por 22px de altura, e o
alerta volta a ser UM código só: era pastilha no sábado e frase na segunda para o
mesmo gesto. O card inteiro segue sendo o alvo. Travas: describe "fila única — ninguém nasce vermelho na
publicação" em `escalaFdsTelaUnica.test.jsx`.

⚠️ A regra geral, que já vale para a IMPORTAÇÃO desde 22/08 e agora vale para a
TELA: melhoria nascida de um protótipo de fim de semana fica no fim de semana. O
dia útil é o fluxo estabelecido de uma equipe em uso clínico diário — mudança
visual ali é retreinamento, e precisa de pedido próprio (Regra #2).

Travas: `escalaFdsTelaUnica.test.jsx` (barra sem os eixos, card, os três
assuntos, Local não-vazio, o describe "sem 'Terminei' na fila" — que guarda o
caminho inteiro do botão para ele não voltar sem decisão nem a remoção parecer
esquecimento — + o describe **"o desenho
da fila única não atravessa para o dia útil"**, que é a trava da FRONTEIRA — ela
já foi cruzada uma vez); `liberacoesAvisoPlantonista.test.jsx` cobre as DUAS
formas do recado, uma por dia; `escalaTurnoAutomatico.test.jsx` prende o ícone do
"Importar" no dia útil. ⚠️ um teste MUDOU DE LADO com o porquê no corpo, em vez de
sumir: o de 16/08 que exigia o seletor de hospital no FDS.

### FERIADO — a mesma fila única, com uma LISTA no lugar da grade (dono 24/08)

Feriado roda como fim de semana na vida real (plantão 07h→07h, um anestesista
cobrindo os três hospitais) e rodava como dia útil no app. Agora `ehDataFilaUnica`
= sáb/dom **ou** feriado, e o feriado entra pelo MESMO caminho do FDS — linha
pseudo-hospital `'fds'`, `ImportarEscalaFdsPage`, `LiberacoesView modoFds`, tela
única. Não existe um terceiro modo.

⚠️ **A fonte do feriado é `FERIADOS_2026` (`src/data/plantao2026.js`)** — a MESMA
lista de `isPlantao24h`, que é literalmente a condição "este dia roda plantão de
fim de semana". **Não usar `FERIADOS_UTEIS`** (`feriasFeriados.js`): aquela é de
contagem de FÉRIAS e exclui de propósito 24/12, 25/12, 31/12 e 01/01 (lá o fim de
ano é RECESSO), além de não ter 15/11 — dias em que o hospital roda escala de
feriado e a fila única precisa ligar. `ehDiaUtil` NÃO muda: o plantão noturno e a
escala de funcionárias seguem com as próprias regras.

**O documento é uma LISTA SIMPLES de nomes** ("FERIADO 25/08" + 22 nomes), sem
grade P1–P4, sem posições numeradas e sem a linha "1º→último a ser liberado" do
FDS. Daí: sem a numeração Pn DA GRADE (P1–P12), sem P4-coringa, sem fila da
noite (`fase` fixa em `'dia'` — derivada da DATA, não de `fdsMeta.tipo`, que só
existe depois de publicar), e o seletor com dois turnos.

**SELOS P1–P4 DO PLANTÃO — a fonte é a do DIA ÚTIL (dono 25/08):** "informe quem
são os plantões (P1–P4) assim como já é informado nas escalas de dias úteis;
apenas nos feriados, já que dias úteis e finais de semana já possuem essas
marcações". Vêm do **card Plantões** (`plantoes` → `plantonistasNoturnos` →
`marcarSelosNoTurno`), que é onde os P1–P4 do dia existem — a folha do feriado
não traz posição nenhuma. Uma condição: `avisarSelos` deixou de ser exclusivo de
`!modoFds`; `ehDiaUtil` (true numa terça) é o que segue excluindo sáb/dom. Como
no dia útil, o selo é **da PESSOA e vale nos dois turnos**, acompanhando a
posição dela em cada fila.

⚠️ **duas numerações, um badge — não misturar.** Sáb/dom ficam fora por motivo
DIFERENTE do dia útil: lá os Pn saem da GRADE do documento e vão até **P12**,
sendo posições da ESCALA, não o plantão do dia. Por isso `marcarSelosFds` é
PULADO no feriado (`modoFds && !feriado`): na prática `posicoes` é `{}` ali, mas
um meta legado bastaria para pôr P7/P8 no mesmo selo que significa "plantão".

⚠️ **P do card sem linha na folha NÃO vira card** (confirmado pelo dono 25/08):
naquele dia o card Plantões trazia P3 Fernando Henrique e P4 Rômulo, nenhum dos
dois na lista de 22 nomes — sem card na fila, não há o que marcar, e sintetizar
linha seria inventar presença. Só P1 e P2 apareceram, e está certo assim.

⚠️ **SENTIDO DA FILA — errar aqui inverte tudo, e foi o defeito de 24/08** ("a
ordem de liberação veio invertida"). A folha do feriado **já vem na direção do
RODAPÉ**: quem está no TOPO é quem FICA até o fim da manhã, e a CAUDA sai
primeiro. A folha de 25/08 prova sozinha — os **13 primeiros nomes são
exatamente os 13 com cirurgia de manhã** nos mapas de Unimed e HRO, e os 9
últimos (ROSE → GUILHERME DIDOMENICO) não têm nenhuma; esses mesmos 9 cobrem as
9 salas da tarde. Quem não tem cirurgia é quem vai embora primeiro, e é por isso
que está no fim da folha. Então: **manhã = a folha na ordem escrita · tarde = a
folha de trás para frente**. A tela da manhã lê igual ao papel.

A inversão continua ACONTECENDO UMA VEZ SÓ, na publicação: `ordensDocumentoFeriado`
devolve a convenção do DOCUMENTO (manhã invertida, tarde direta) e
`rodapeDeOrdemDoc` faz a única volta, como no FDS. ⚠️ **a CONFERÊNCIA mostra e
edita a folha na ordem escrita** — é a transcrição do documento, e Subir/Descer/
Remover indexam por ela; exibir a lista já invertida por turno faz o botão mexer
na pessoa errada, em silêncio (defeito real, corrigido antes de sair).

**Os mapas cirúrgicos entram na MESMA entrada**, como no FDS de 22/08, e o caso é
o do fim de semana, INTEIRO. ⚠️ não reduzir o caso a sala/cirurgião/anestesista
"porque é só o que o card mostra": isso derruba o **convênio**, e é o convênio que
o trigger `fn_sync_cirurgia_particular` casa para abrir a cobrança — só o mapa da
Unimed de 25/08 traz 6 PARTICULAR.

**SELO DE PLANTÃO — os DOIS QUE FECHAM A FILA DO TURNO (dono 25/08):** "o
primeiro e segundo nomes da lista sempre serão plantão de algum hospital conforme
ordem de liberação (**ou seja os dois últimos a serem liberados são os
plantões**)" — é também a confirmação independente do sentido da fila. No FDS o
selo sai da grade P1–P4 da faixa; no feriado, das **posições 1 e 2 da ORDEM
PUBLICADA do turno exibido**, que por convenção do rodapé são os dois últimos a
sair → "Plantão Unimed"/"Plantão HRO" (o genérico "Plantonista" segue suprimido
na fila única, como no FDS — ele diria menos). Sem cirurgia no dia inteiro cai no
genérico. ⚠️ o HOSPITAL vem das cirurgias do **DIA** (`hospitaisDoDia`), não do
turno: quem fecha a fila pode já estar sem cirurgia naquele turno, e pelo mapa do
turno o selo perderia o hospital justamente aí.

⚠️ **É POSICIONAL, não da pessoa — e isso foi corrigido no MESMO DIA.** A 1ª
versão saía de `fdsMeta.listaFonte` (a folha, que não vira) e valia nos dois
turnos, com o argumento de que o plantão do feriado é 07h→07h. O dono recusou
olhando a tela da tarde: *"na escala da tarde, os dois últimos a serem liberados
devem receber o badge de plantão e os primeiros a serem liberados (que foram os
plantões da manhã) devem perder os badges"*. O motivo é o que o selo COMUNICA
numa fila — **quem ainda vai ficar**: preso à folha, de tarde ele marcava quem
estava indo embora PRIMEIRO e não dizia nada sobre quem ficaria até a noite. Como
a tarde é a folha invertida, ler a ordem do turno dá o mesmo resultado de manhã e
troca os donos à tarde, sem regra extra. **`EscalaCirurgicaHomeCard` mudou
junto** (mesma fonte, turno do relógio compartilhado): preso à folha, ele passaria
às 13h a nomear na Home quem a fila já mostra saindo. Travas: describe "feriado"
em `escalaFdsTelaUnica.test.jsx` — fixture com **QUATRO** nomes de propósito, já
que com dois a folha e a ordem invertida contêm as mesmas pessoas e QUALQUER
regra passa (foi assim que a 1ª versão atravessou os testes) — e o caso das 14h
em `escalaCirurgicaHomeCard.test.jsx`. `fdsMeta.listaFonte` continua GRAVADO como
transcrição do documento, mas nenhuma tela deriva dele.

**O LOGIN NASCE PREENCHIDO PELO NOME LIDO (dono 25/08):** "identificou o
anestesista (cabeçalho) mas o campo abaixo deixou 'sem anestesista'". A
conferência do mapa só pré-selecionava pelo POSTO DA GRADE (22/08), que alcança
apenas grupo SEM nome — e no feriado não há grade. `sugerirAtribuicoesLidas`
resolve o nome do documento pelo dicionário, como a conferência de DIA ÚTIL já
fazia; não vira "sugestão" na tela (o nome é do documento, o dicionário só diz a
qual login pertence — diferente do posto, que é palpite e segue rotulado). Fora
de propósito: "?" (ausência é informação), nome que o dicionário não resolve
(escolha humana) e DUPLA "A + B" (um login não representa dois). ⚠️ **não havia
perda de dado** — `aplicarAtribuicoes` recebe o `resolver` e já caía no
dicionário na publicação; o defeito era a conferência não mostrar o que ia
acontecer. Efeito aceito: com o login resolvido o cabeçalho do grupo mostra o
nome do CADASTRO, como a sugestão do posto já fazia.

**HOSPITAL E DIA DO MAPA SEMPRE EDITÁVEIS (dono 25/08, "há possibilidade de
confusão? e se houver como resolver?"):** os dois Selects só nasciam quando a
leitura FALHAVA, então leitura CONFIANTE E ERRADA era beco sem saída — remover e
reanexar reclassifica igual. ⚠️ o risco é concreto: o mapa do HRO **de feriado**
não tem coluna ANEST (o anestesista vem em "Observação") nem rodapé vermelho —
as duas assinaturas do HRO no prompt — e casa quase palavra por palavra com a
descrição do MATERNO. `redefinirMapa` já re-chaveava e re-preparava o lote com
as salas canônicas do hospital novo; só faltava o caminho até ele.

**CAUDA VERMELHA: SÓ NA MANHÃ DO FERIADO.** O mapa desta linha, por turno:

| | cauda vermelha? |
|---|---|
| dia útil (manhã e tarde) | sim — regra de 21/08 |
| **feriado, MANHÃ** | **sim** (dono 25/08: "os usuários que não tiverem casos deixe como liberados") |
| **feriado, TARDE** | **não** |
| sáb/dom, os dois turnos | não — decisão de 24/08 |

A manhã do feriado entrou porque ali lista e mapas chegam JUNTOS, na mesma tela:
"sem caso" é informação de verdade, e a manhã de 25/08 saiu certa assim (1–13
trabalhando, 14–22 liberados). ⚠️ **O VESPERTINO DA FILA ÚNICA FICA FORA POR
REGRA, não por acidente** (dono 25/08, fim da tarde): *"as escalas vespertinas,
na maioria das vezes, estarão sem anestesistas escalados... mantenha o esquema de
todos estarem livres e não liberados; os ajustes nos períodos vespertinos serão
feitos manualmente"*. Em 25/08 o mapa da tarde chegou com as 18 cirurgias sem um
único anestesista nos dois hospitais, e a guarda `temAlguemComTrabalho` (22/08)
já segurava o vermelho — **mas por acaso**: bastaria UM nome designado no anexo
para a guarda cair e a fila inteira atrás dele nascer vermelha. O corte por turno
(`caudaAutomatica = !modoFds || (feriado && turnoBase === 'matutino')`) é o que
torna isso estável quando a tarde vier parcialmente preenchida — caso previsto
por ele na mesma mensagem ("se alguma escala dos feriados e finais de semana
vierem com anestesistas designados, faça a distribuição conforme os anexos").
O badge "Livre" continua nos dois turnos: a tinta sai, a informação não.

⚠️ o teste que trava isso usa uma tarde com DOIS colegas já designados, de
propósito — com a tarde 100% vazia a guarda de 22/08 mascara a diferença e
qualquer regra passa. Conferido que ele FALHA com a regra anterior (2 cards
vermelhos) antes de entrar.

Herda de graça do modo FDS: badge "Livre" para quem está sem cirurgia, hospital
em caixa alta no card, a ação do alerta como frase abaixo do texto. Travas:
describe "feriado como data de fila única" em `escalaFds.test.js` — com o invariante que roda `gerarColunaLiberacao`
sobre o rodapé publicado e afirma QUEM é o próximo a ser liberado em cada turno,
que é o que protege contra uma re-inversão (asserção de string não protege) — +
o describe "FERIADO" em `importarEscalaFds.test.jsx` (publicação nos dois turnos
e o alinhamento entre o que a tela mostra e o que Descer move) + e2e
`escala-cirurgica-feriado.spec.ts` sobre a fixture DEV `DEMO_DATE_FERIADO`.

### FDS — fila completa e o fim do vermelho em massa (dono 22/08)

Duas queixas no mesmo dia, sobre a escala de 22–23/08 publicada pelo app.

**"Estão faltando colegas"** (domingo e noite): a linha de ordem do documento é a
fila, mas quem está ESCALADO no turno e não foi citado nela **nunca some** —
regra já estabelecida em 16/08 para a noite ("apenas adicione os P's faltantes"),
que vale para qualquer turno. No domingo o bloco traz uma linha só (`P1 P2 P3
P4`) e cita à parte 8º OSCAR, 7º GUILHERME DIDOMENICO e EMERGENCIA: 11º THAYNA —
os três ficaram fora da fila. O slot de cada faltante vem de `sugerirRodapeFds`
(postos na frente · numerados no meio · retaguarda no fim), que é a forma que o
PRÓPRIO documento usa na manhã de sábado, onde P4/P3 são a retaguarda e saem
primeiro. ⚠️ turno com UMA linha só no bloco = a linha é do MATUTINO; o
vespertino nasce da grade daquele turno (marcado "sugerida") — aplicar a mesma
linha nos dois punha Daniela/Rômulo à frente numa tarde cujo plantão é
Karine/Gabriel, e sumia com Matheus e Cristina, que só existem na faixa 13-19.

**Fila inteira vermelha:** a tarde de sábado saiu com 8 cirurgias sem
anestesista definido e os 7 nomes nasceram LIBERADOS de uma vez, antes de o turno
começar. Causa: `idxUltimoTrabalho` é -1 quando NINGUÉM tem cirurgia, e `idx >
-1` é verdade para a fila toda. A cauda é o que vem DEPOIS do último nome com
trabalho; sem esse nome não há depois, e vale a regra de 20/08 — ninguém nasce
liberado. Guarda `temAlguemComTrabalho` em `LiberacoesView`; travado em
`escalaCirurgicaPersonas.test.jsx` (describe "sem ninguém em cirurgia não há
cauda"), com o caso inverso junto: um nome com cirurgia e a cauda volta a nascer
liberada. Acontece sempre que o mapa do turno chega sem anestesista — o mapa do
HRO de fim de semana traz a coluna vazia à tarde.

### FDS — a fila da NOITE nasce completa, e substituto em turno de DIA (dono 29/08)

Duas queixas sobre o fim de semana 29–30/08, publicado pelo app às 15h47.

**"A noite não saiu com todos na ordem estabelecida — faltam P5, P6, P7 e P8":**
as duas noites saíram só com os QUATRO da faixa 19-07. A ordem estabelecida é a
de 16/08, e continua valendo — **sáb `P2,P1,P4,P3,P11,P8,P7` · dom
`P3,P4,P1,P2,P11,P6,P5`** (a união dos numerados dos dois dias é exatamente
P5–P8, que é o que o dono enumerou). Nos FDS de 15–16 e 22–23/08 esses Pn
entraram **à mão**, pela 3ª lista da conferência: `sugerirRodapeFds(dia,
'noturno')` devolvia só a linha da grade, e o conserto manual toda semana
passava por comportamento normal.

Agora a sugestão da noite nasce completa: **`FDS_NOITE_NUMERADOS`** (constante em
`escalaFds.js`, `{6: [P11,P8,P7], 0: [P11,P6,P5]}`) acrescenta os numerados
DEPOIS dos quatro postos — eles liberam PRIMEIRO. `sugerirRodapeFds` passou a
receber **`data`** no primeiro argumento (o objeto de `normalizarParseFds` já a
tinha); sem data, cai nos quatro da grade, que é o comportamento antigo — é o
que mantém o FERIADO fora, já que a data dele não é sáb/dom.

⚠️ **por que constante e não derivação:** a fila da noite não está no documento
para ser lida. `listas` e `ordemLiberacaoDoc` da edge só existem para matutino/
vespertino, e os numerados da noite também não são o fim da lista do dia (15/08:
escalação P5→P12, noite P11,P8,P7). Travas em `escalaFds.test.js` (describe "a
fila da noite completa") e no `importarEscalaFds.test.jsx`: o valor esperado é,
caractere por caractere, o que a migration `20260816120000` gravou depois de o
dono ditar a ordem — se a sugestão reproduz aquele fim de semana, reproduz a
regra. Conferido que os testes FALHAM contra o código anterior.

**"O badge e plantão da Unimed saíram errados na tarde de hoje":** a grade 13-19
trazia DANIELA no posto da Unimed e a linha do documento a punha em ÚLTIMO na
fila — ela carregava o badge "Plantão Unimed" sendo, ao mesmo tempo, a PRIMEIRA a
ser liberada. O dono deu o sentido: *"Daniela está no lugar de Karine (Daniela
deve ocupar a segunda posição da escala de liberações)"*. É **SUBSTITUTO NA VAGA
num turno de DIA** — o mesmo caso que a noite já trata em `aplicarCoberturaNoite`
(JOAO RICARDO cobrindo a Cristina em 16/08): quem cobre assume o SLOT de quem foi
coberto e o coberto SAI da fila daquele turno. `fds_meta.posicoes` NÃO muda —
DANIELA segue sendo P11 no roster do fim de semana, e é por P11 que a fila da
noite a chama; o que muda é a vaga que ela ocupa naquele turno.

⚠️ **como reconhecer sozinho que a leitura errou a grade:** a linha 13-19 é uma
permutação de P1–P4 (6 de 6 dias de FDS antes deste), e o começo da linha de
liberação do turno diz quem são os dois plantões — em 29/08 ela abria em `P3,P4`
enquanto a grade dizia `P11,P3`. Junto disso, a leitura perdeu o `P1,P2` do FIM
da linha da tarde, que os dois sábados anteriores têm: a retaguarda da faixa
13-19 entra no fim da fila (regra de 22/08, "quem está escalado no turno e não
foi citado nunca some"). Correção dos dois dias em
`supabase/migrations/20260829210000_ordem_fds_29_30_08.sql`.

⚠️ **o efeito colateral silencioso:** com a grade errada, `anestesistaDoPosto`
atribuiu as 5 cirurgias da tarde da Unimed a DANIELA — sala sem nome no mapa
recebe quem a grade põe no posto. Aqui isso ficou certo por acaso (ela é mesmo
quem está lá), mas o mapa **não é evidência independente** da grade: conferir o
posto contra a linha de liberação, nunca contra os casos que ele mesmo preencheu.

### FILA ÚNICA — a ordem de liberação vale MESMO SEM CIRURGIA (dono 29/08)

Duas queixas do mesmo sábado, com a MESMA raiz — e é a **terceira vez** que essa
raiz aparece:

1. *"Daniela está marcada como próxima a ir embora. Está errado, **os plantões
   nunca vão embora**."*
2. *"É possível realizar a liberação **fora da ordem já estabelecida** nas
   regras."* (print: ALEXANDRE, 6º de 8, liberado com o 7º e o 8º ainda na fila.)

`naFila` — a função que decide quem conta para a ordem — exigia **estar em sala**
(`!naoEscalado`). Premissa de DIA ÚTIL: lá o rodapé traz gente que fecha a lista
sem trabalho nenhum. No sáb/dom **quem está publicado ESTÁ de plantão** e o mapa
cirúrgico chega em importação SEPARADA, muitas vezes depois — na tarde de 29/08
só os dois plantões tinham caso. Com a fila praticamente vazia:

- o "próximo a ser liberado" é o ÚLTIMO da fila, e **subia até o plantão** (1);
- a trava **"LIBERAÇÃO SÓ NA ORDEM"** (27/07) só vale para quem está NA fila —
  com a fila vazia ela **não pegava ninguém**, e qualquer card saía a qualquer
  hora, sem um aviso sequer (2).

⚠️ **É a mesma premissa que já teve de sair da cauda vermelha e do card branco em
24/08** ("ninguém nasce vermelho na publicação"). Ela volta porque `naoEscalado`
está espalhado; ao mexer em qualquer decisão de fila, perguntar antes: *isto
supõe que sem cirurgia a pessoa não está em jogo?* No fim de semana, está.

**O que passou a valer em `modoFds`, turno de DIA:**

| | regra |
|---|---|
| quem tem posição (`noRodape`) | está na fila **tenha ou não cirurgia** |
| plantão da faixa (`plantaoFisico`) | **fora da fila** — nunca é o "próximo", nunca esbarra na ordem para sair. É o equivalente de dia do `foraDaFila` que a NOITE já tinha nas colunas Unimed/HRO |
| extra · ajuda · visitante | **inalterado** — sem posição, seguem por "está em sala" (19/08 põe a ajuda COM cirurgia na frente da saída; 24/08 diz que eles não ocupam vaga) |
| convocar (desfazer) | simétrico ao liberar: `voltaPraFila` também deixou de exigir cirurgia para quem tem posição |

⚠️ o recorte por `noRodape` **não é detalhe**: sem ele a ajuda avulsa sem caso
vira a última da exibição e rouba o "próximo" de quem fecha o rodapé — foi o que
quebrou dois testes de `liberacoesFdsUnificada` (fixture real de 15/08) antes de
entrar. O dia útil não é tocado em nenhum dos quatro pontos.

Travas em `escalaFdsTelaUnica.test.jsx`, describe "a ordem de liberação vale
mesmo sem cirurgia": liberar quem não fecha a fila avisa · quem fecha sai mesmo
sem cirurgia · o cartão amarelo cai em quem FECHA a fila (e não no último com
cirurgia) · sobrando só os plantões ninguém é o próximo · e o plantão sai sem
esbarrar na ordem. Conferido que 3 deles FALHAM contra o código anterior.

### FILA ÚNICA — quatro regras que uniformizam com o dia útil (dono 29/08, noite)

**1. O cartão amarelo é de quem TRABALHA, não do fim da fila.** *"O próximo a ser
liberado deve ser o primeiro anestesista contendo informações sobre escalação
(local, cirurgiões, ajuda...) e não o último da fila."* A ORDEM e a TINTA
passaram a ser duas perguntas: `idxProximo` (quem pode sair agora, trava quem
tenta furar) continua sendo o último da fila; `idxCartao` (o card amarelo) é o
último **com escalação**. Fila inteira sem caso = nenhum cartão amarelo, que é o
estado normal de um turno recém-trocado. ⛔ `idxCartao` só existe em `modoFds` —
no dia útil o cartão segue no `idxProximo`, como desde 27/07 (Regra #2).

**2. Preenchimento automático SÓ na manhã de sábado.** `anestesistaDoPosto` ganhou
`dataIso` e devolve `''` fora do matutino de sábado — **sem data, desligado**. A
sugestão de 22/08 alcançava qualquer turno cuja sala viesse sem nome, e é assim
que o mapa do fim de semana chega quase sempre: em 29/08 as **5 cirurgias da
tarde da Unimed, em 3 salas**, foram publicadas no nome do posto sem que ninguém
tivesse escrito aquilo. A manhã de sábado é o único turno em que a tabela e os
mapas chegam JUNTOS e o posto ainda descreve o dia.

**3. O plantão da faixa está SEMPRE trabalhando.** Nunca "Livre", nunca no cartão
amarelo, nunca esbarra na ordem para sair, e **conta como trabalho** na conta do
último com trabalho. Ele cobre o hospital as 6 horas inteiras — o mapa estar
vazio não muda isso. É o equivalente de DIA do `foraDaFila` que a noite já tinha.

**4. "Livre" virou "Liberado", de verdade.** *"Quero que mude a marcação de
'livre' para liberado assim como já é realizado em dias úteis, fica mais fácil
dos usuários entenderem e uniformiza"* — e no protótipo ele escolheu o **vermelho
de verdade**, não a troca da palavra. `caudaAutomatica` passou a ser `true` em
todo dia e todo turno.

⚠️ **ISTO SUPERSEDE DOIS RECORTES ANTERIORES, e é decisão dele nos dois casos:**
o *"todos verdes na publicação"* de 24/08 e a exceção do *vespertino da fila
única* de 25/08 (que também valia para o FERIADO). O que sustentava os dois era o
plantão NÃO contar como trabalho: com o mapa chegando vazio, a cauda ou pegava a
fila inteira ou não existia. Com a regra 3 acima, a cauda começa logo abaixo dos
dois postos — dois cards verdes no topo e o resto vermelho até chegar cirurgia,
que é o desenho aprovado.

⚠️ **O que NÃO mudou:** a guarda `temAlguemComTrabalho` (22/08) continua de pé —
sem NINGUÉM trabalhando não há cauda, e ela ainda morde no sáb/dom cuja grade
ainda não foi importada. E o vermelho no MEIO da fila segue não sendo automático
(incidente Eduardo, 20/08). No FERIADO o plantão é POSICIONAL (as duas primeiras
da ordem do turno), então ele sempre existe e a cauda sempre nasce.

**5. O cabeçalho não oscila mais.** *"O cabeçalho de final de semana alterna com o
cabeçalho de dias úteis (mostrando abas: minhas, completa e liberações)."*
`modoFds` depende do FETCH da linha 'fds' e o contexto ZERA `escalas` ao trocar de
data sem cache — nessa janela o sábado abria com as abas e o seletor de hospital
do dia útil. `chromeFilaUnica = dataFilaUnica && (loading || modoFds)` decide os
EIXOS pelo CALENDÁRIO, que não espera rede: é o mesmo remédio do defeito irmão de
16/08 (o seletor piscando de 2 para 3 turnos). Sem fila publicada, cai no modo por
hospital depois de carregar — uma transição no caso raro, em vez de uma por
abertura.

Travas: describes "a cauda nasce liberada, como no dia útil" e "a ordem de
liberação vale mesmo sem cirurgia" em `escalaFdsTelaUnica.test.jsx` (com o caso
"fila publicada sem mapa: ninguém amarelo, e a ordem continua travando", que é o
que separa as duas perguntas) · "cabeçalho não oscila" em
`escalaTurnoAutomatico.test.jsx` · a manhã/tarde de sábado em
`escalaFdsMapas.test.js` e `importarEscalaFdsMapas.test.jsx`. ⚠️ **oito testes
mudaram de lado com o porquê no corpo** — nenhum foi apagado.

### FILA ÚNICA — a NOITE classifica como o dia (dono 29/08)

*"O turno da noite continua com todos verdes, verifique."* Depois de "Livre"
virar "Liberado" nos turnos de dia, a noite ficou sendo a única tela onde
ninguém nascia liberado — e não por regra: **todo card noturno nascia com
`teveCasos: true`**, carimbado por `fundirLinhasNoturnas`.

⚠️ **O carimbo é do DIA ÚTIL e continua lá.** No dia útil os cards noturnos são
fundidos NA LISTA do dia, e sem ele o plantonista sem caso caía em "não
escalado", nascia vermelho e **afundava** para o fim em vez de liderar (defeito
de 24/07). Na fila única a noite é um TURNO PRÓPRIO e `linhasFase` filtra a lista
só nos cards noturnos — não há para onde afundar, e o que sobra do carimbo é uma
classificação falsa. `fundirLinhasNoturnas` ganhou `opts.forcarEmSala`, desligado
só em `modoFds`.

Com isso a noite passa a ler como qualquer turno: **os dois postos da faixa
19-07 sempre verdes** (regra do plantão, que também os mantém fora do "próximo"),
**quem herdou cirurgia da tarde verde** (`FDS_TURNO_CASOS.noturno` = vespertino) e
**o resto da fila vermelho**. Em 30/08 isso são 2 verdes, 2 com cirurgia da tarde
e 3 vermelhos dos 7 da fila.

⚠️ **`noRodape` não alcança a noite** — ele é carimbado pela lib do DIA, e a ordem
publicada da noite é `fds_meta.ordemNoite`, com cards vindos de
`linhasNoturnasFds` (o sintético inclusive). Daí `temPosicao(l)`, que responde
"ocupa posição?" pelos dois caminhos; sem ele a cauda da noite nunca nasceria,
porque nenhum card noturno tem `noRodape`.

Travas: describe "a NOITE classifica como o dia" em `escalaFdsTelaUnica.test.jsx`
(os dois postos verdes · quem herdou cirurgia da tarde verde · o plantão nunca
"Livre" nem vermelho) + dois testes que MUDARAM DE LADO em
`liberacoesFdsUnificada.test.jsx`, com o porquê no corpo: a CRISTINA (retaguarda
2ª chamada sem cirurgia) era "próximo a ser liberado" e hoje já nasce liberada.

### FILA ÚNICA — troca de UM TURNO SÓ, também à noite (dono 29/08)

*"Há várias trocas entre colegas que fazem apenas um turno (de P1-P4,
eventualmente outros Pn) — quero que adicione a possibilidade de troca apenas
naquele turno caso já não venha descrito na escala de posições e fila"*, e no
mesmo fôlego: *"quero que ao clicar em 'editar' todos os turnos tenham todas as
mesmas opções, sem divergir independente de turno"*.

O painel do card **NOTURNO** era o único sem **Responsável** e sem **Posição na
fila** — os dois exigiam `!editor.noturno`. Hospital, Local, Cirurgião, Tempo e
Observação já estavam lá.

⚠️ **O botão faltando era o menor dos problemas.** A gravação usava
`turnoDeCasos` para o NAMESPACE da marcação, e à noite isso é `'vespertino'`:
`chaveTurno('vespertino', 'noite:X')` → `vespertino:noite:X`, enquanto a tela da
noite lê `chaveEscopo('noite:X')` → `noite:X` (o `chaveTurno`/`chaveEscopo` não
prefixa 'noturno'). A assunção iria para uma chave que a noite nunca lê — e que a
TARDE leria. **`turnoDaMarcacao` (= turno da tela) separou as duas perguntas:**
"de que turno são as cirurgias" (`turnoDeCasos`, alimenta publicação e casos) e
"onde mora a marcação" (o turno EXIBIDO). Nos turnos de dia os dois têm o mesmo
valor — lá nada mudou. ⚠️ a PUBLICAÇÃO (`garantirEscala`) continua em
`turnoDeCasos`: o CHECK do banco só aceita matutino/vespertino.

**A identidade da noite é aplicada FORA da lib.** As linhas de dia recebem
`assumidaPor` dentro de `gerarColunaLiberacao` (`opts.assumidas`); as da noite
não passam por lá — vêm de `linhasNoturnasFds`, derivadas da grade. A troca é
aplicada por cima (`comAssuncao`), com **chave e `nomeOriginal` intocados**: é
isso que faz as marcações já gravadas continuarem valendo e que faz quem cobre
**herdar o badge "Plantão Unimed/HRO"**, porque `plantaoFisicoDe` casa pelo nome
da GRADE. O papel ganha "· Substituindo X", a mesma frase do substituto lido do
documento (EDUARDO, 30/08) — um código só para os dois caminhos.

O Select de **Posição na fila** passou a listar `linhasFase` (a fila EXIBIDA) e a
exigir o mesmo tipo de card dos dois lados: à noite `linhas` ainda é a lista da
TARDE, e o seletor oferecia as pessoas erradas.

⛔ **"Ajuda" ficou de fora, e é ausência com motivo:** `adicionarAjuda` grava em
`ajuda_externa[turno]` e a fila lê `rodapeDoTurno(ajudaExterna, turnoBase)` — à
noite isso é a tarde, então a marcação da noite cairia numa chave que ninguém lê;
e `linhasFase` descarta a lista do dia no noturno, então o badge não teria onde
aparecer. Botão morto é pior que botão ausente. Se a ajuda tiver de existir à
noite, a fila da noite precisa de fonte própria para ela.

Travas: describe "o painel é o mesmo em todos os turnos" em
`escalaFdsTelaUnica.test.jsx` (as duas opções presentes no card noturno · quem
assume herda o badge e o "Substituindo X" · o posto coberto não nasce Livre nem
liberado). Conferido que os três FALHAM contra o código anterior.

### FILA ÚNICA — a troca de turno LIBERA TODO MUNDO menos os dois postos (dono 29/08)

*"Quero que a noite cumpra a mesma regra de troca de turnos no final de semana:
ao trocar de turno todos fiquem liberados exceto os plantões (HRO e Unimed)."*

A noite ainda deixava verdes quem **herdou a cirurgia da tarde** — o card noturno
lê os casos do vespertino (`FDS_TURNO_CASOS.noturno`), e em 30/08 isso mantinha
Nathalia e Giovana trabalhando às 19h por causa de uma cirurgia do turno
anterior. A herança é do TURNO DE TRÁS: quem estava em sala às 18h59 foi liberado
às 19h, e é exatamente isso que a troca de turno significa.

`semEscalacaoNoTurno(l)` responde "está escalado NESTE turno?" com regras
diferentes por turno: no dia é `naoEscalado` (tem sala/cirurgião/caso); na NOITE
da fila única é só `!plantaoFisicoDe(l)` — **os dois postos e mais ninguém**.
Resultado: às 19h a tela tem dois cards verdes e o resto liberado.

⚠️ **A cirurgia herdada CONTINUA VISÍVEL no card** — a decisão de 15/08 ("a
cirurgia em curso não some às 19h") vale. O que ela deixou de fazer é decidir
quem está trabalhando no turno. Card vermelho com a cirurgia listada é
informação, não contradição: a cirurgia é do turno passado.

**Duas frases mudaram na mesma rodada:**

- **"cobre X" → "Substituindo X"**, nos DOIS caminhos que a produzem: o
  substituto lido do documento (`aplicarCoberturaNoite`) e a troca feita à mão no
  painel. Um código só para os dois.
- **"Retaguarda 1ª chamada" / "2ª chamada" SAÍRAM** (`FDS_NOITE_PAPEL.ret1/ret2`
  agora são `null`). As colunas 3 e 4 seguem sendo a ordem de chamada — quem diz
  isso é a POSIÇÃO na fila, não uma frase no card. Sem papel, o card fica igual
  ao dos numerados da lista, que é o que eles são à noite. ⚠️ `aplicarCoberturaNoite`
  precisou da guarda: sem posto, o papel passa a ser só "Substituindo X".

Travas: describe "a NOITE classifica como o dia" em `escalaFdsTelaUnica.test.jsx`
— "SÓ os dois postos ficam verdes" e "a cirurgia herdada APARECE, mas não segura
ninguém no turno", este último trocando de lado no mesmo dia em que nasceu, com o
porquê no corpo. Os dois afirmam também que "Retaguarda" sumiu da tela.

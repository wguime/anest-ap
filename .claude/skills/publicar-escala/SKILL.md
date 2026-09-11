---
name: publicar-escala
description: Publica a escala cirúrgica de um turno a partir das fotos que o dono cola no chat (Unimed, HRO, Materno), sem passar pela tela de importação — lê pela edge, confere contra a foto, publica pela RPC como o dono e verifica. Use quando o dono anexar fotos da escala e pedir para publicar ("publique as escalas da tarde", "escalas de amanhã", "UNIMED [foto] HRO [foto] MATERNO [foto]"), ou quando pedir para corrigir uma escala já publicada a partir da foto.
allowed-tools: Read, Bash, Write, Edit, Grep, Glob
user-invocable: true
---

# Publicar escala pela foto

O dono manda as fotos e quer a escala no ar sem explicar nada (08/09/2026). O caminho é o
mesmo da tela de importação, só que quem confere é você, olhando a foto: a leitura pela
edge é boa mas não é confiável sozinha (08/09 ela devolveu hora com data colada e um HRO
pela metade), e a publicação é a MESMA RPC da tela, assinada como o dono.

Script: `scripts/escala-publicar-turno.mjs` (cabeçalho documenta os dois comandos).

## Passos

1. **Data e turno.** Vêm da mensagem ("da tarde", "de amanhã"); sem isso, a data é hoje em
   `America/Sao_Paulo` e o turno vem das horas da foto (13:00 em diante = vespertino). A
   planilha da Unimed traz a data em cada linha; o HRO às vezes traz uma data velha no título
   (08/09 dizia 04/09 e era de 08/09 — a continuação das cirurgias da manhã prova). Decida pela
   coerência entre as três fotos e diga no relatório o que assumiu.
2. **Guardar as fotos.** O caminho do WhatsApp é temporário: copie para
   `.tmp/escala-lote/<data>-<turno>/` (pasta fora do git — tem iniciais de paciente).
3. **Ler as três em paralelo**, cada uma com a dica do hospital (o layout diz qual é: Unimed =
   grade branca SALA/PACIENTE/IDADE/…; HRO = Excel colorido Leito/ANEST/Conv./Sala com rodapé
   vermelho; Materno = relatório G-HOSP "Mapa de cirurgias"):
   `node scripts/escala-publicar-turno.mjs ler <foto> --hospital <h> --out .tmp/escala-lote/<data>-<turno>/<h>.json`

   ⚠️ **A leitura demora, e o cliente pode cortar antes dela terminar.** Medido em 30 dias:
   **75% das leituras de HRO e Unimed passam de 60s** (pior caso 139s) — lentidão é o normal,
   não sintoma. Em 11/09 o caminho de rede passou a cortar aos **~66s** com
   `SocketError: other side closed` e `bytesRead: 0`: o payload subiu inteiro e a resposta
   nunca voltou. **A edge TERMINOU assim mesmo** — as três leituras cortadas daquele dia estão
   em `escala_leitura_log` com `stop_reason: end_turn` e custaram **US$ 0,36 sem entregar nada**.
   Então, ao ver esse erro: **conferir o log ANTES de repetir**
   (`select criado_em, hospital_hint, casos, stop_reason, latencia_ms from escala_leitura_log
   order by criado_em desc limit 5`) — repetir é pagar de novo pela mesma leitura.
   ⚠️ **Reduzir a imagem NÃO resolve**: testado 370 KB → 254 KB (1600 → 1300px), falhou no
   mesmo ponto, aos 66s. O corte é de TEMPO, não de tamanho. Persistindo, **transcreva da foto**
   (passo abaixo) — custa US$ 0 de API e sai mais rápido que a 3ª tentativa.

   💡 **O Materno é o MESMO documento nos dois turnos do dia** ("Mapa de cirurgias" traz o dia
   inteiro). Se a manhã já foi publicada por aqui, o rascunho está em
   `.tmp/escala-lote/<data>-matutino/materno.json`: reaproveite os casos do outro turno em vez
   de reler. Só o nome anotado à mão muda de lugar entre os turnos — conferir esse na foto basta.
4. **Conferir cada rascunho contra a foto** — é o passo que não pode ser pulado. O que mais
   erra: hora (só HH:MM; "AS" fica "AS"); anestesista por linha (**"//" é IGUALDADE e vale
   SEMPRE a linha de cima na mesma sala** — dono 11/09: "isso já está definido nas regras". Não
   perguntar. A dúvida que motivou o esclarecimento: uma ajuda de fora entrou no meio da sala e a
   linha seguinte era "//" — mesmo assim o "//" é dela, não de quem abriu a sala; célula vazia ou "?" é linha descoberta → `"?"` e `semAnestesista: true`; nome em AZUL é
   ajuda de outro hospital → entra em `ajudaExterna` e no caso; AMARELO é a pessoa em dois
   locais de propósito, mantém nos dois); seções fora da grade (Exames, Imagem, Hemodinâmica,
   IOSC, HO, Ambulatório, Braqui, Simone); rodapé completo NA ORDEM, com notas entre parênteses
   ("MATHEUS (CONSULT.)" é uma posição); continuações ("CONTINUAÇÃO ±14h" é caso, com
   `isContinuacao`); Bloco M do HRO com salas internas diferentes (o "//" não herda entre
   "Bloco M - Sala 3" e "Bloco M - Sala 2" — escreva o nome). No Materno só o nome anotado à mão
   em vermelho é anestesista; "Geral" é técnica. Paciente PARTICULAR puro leva `pacienteNome`
   (é o que preenche a cobrança); todo o resto fica por iniciais.

   **O que a leitura erra de fato** — medido nas 7 leituras de 10–11/09, em ordem de frequência.
   Conferir estes primeiro rende mais que reler o rascunho inteiro:

   | erro | frequência | como reconhecer |
   |---|---|---|
   | **`ajudaExterna` no hospital errado** | **4 de 4** | a edge põe a ajuda no hospital **onde o nome está ESCRITO**, e ela pertence ao hospital **onde a pessoa vai TRABALHAR**. Azul no rodapé do HRO + caso azul na Unimed = ajuda **da Unimed**. Sempre reescrever os dois lados à mão. |
   | **PARTICULAR sem `pacienteNome`** | **5 de 8 no HRO**, 1 de 6 na Unimed | o HRO escreve nome e idade na mesma célula e a edge devolve só as iniciais. Sem o nome o gatilho não abre a cobrança, **em silêncio**. Varrer todo caso `convenio` PART/PARTICULAR. |
   | **nome PARTIDO no meio** | **4 de 4** | sempre o mesmo: `GUILHERME M ELO` → `GUILHERME MELO`. Um espaço no meio do sobrenome vira nome que o dicionário não resolve. |
   | **anestesista NÃO lido (célula vazia)** | 5 | dois padrões: nome em **AZUL** (3×) e seções de baixo — **IMAGEM, C.O, Exames** (2×). Nunca aceitar célula vazia sem olhar a foto: `""` ≠ "sem anestesista". |
   | **data do HRO** | 2 erradas + 1 ausente em 3 | o HRO traz a data do dia ANTERIOR no título, ou nenhuma. Unimed e Materno trazem a certa em cada linha — decidir por elas. |
   | **SRPA / posição assistencial** | 1 de 2 | intermitente: em 11/09 a edge leu `SRPA · COSTA` sozinha, em 10/09 perdeu `SRPA · GABRIELA`. Conferir, não assumir nem que falta nem que veio. |

   ⚠️ **No Materno o nome à mão MUDA DE LINHA entre os turnos** e a edge tende a colá-lo na
   primeira linha da sala. Em 10/09 ela pôs RAFAEL na linha das 07:30 quando a anotação estava
   na de 13:30 — com a sala inteira herdando "//", o turno errado fica com o dono errado.
5. **Montar o lote** `{ data, turno, hospitais: { unimed: {casos, ordemLiberacao, ajudaExterna,
   posicoesAssistenciais, dataDetectada}, hro: …, materno: … } }` e ensaiar:
   `node scripts/escala-publicar-turno.mjs publicar <lote.json> --ensaio`. O `publicar` roda
   a MESMA conferência da tela (`src/lib/escalaConferenciaHeadless.js`, pelas mesmas funções):
   - **bloqueia** como a tela: nome ambíguo, hora inválida, campo que o banco recusa, rodapé
     vazio no HRO/Unimed, **pessoa em dois hospitais sem decisão**, turno já publicado;
   - **avisa** como a tela: rodapé contra a **escala numérica com as férias do dia** (Pega
     Plantão), cauda que nasce liberada, nome na ordem sem caso, caso de quem não está no
     rodapé (azul não lido), ajuda provável e conflito com outro hospital, conflito de horário,
     bloco repetido, item duplicado, seções do HRO ausentes, cirurgia da manhã que atravessa sem
     dono, data da foto divergente, escala que encolhe;
   - move sozinho o **azul emprestado** para a ajuda do hospital onde a pessoa trabalha.
   Bloqueio de duplicidade se responde no lote, como na folha da tela:
   `"decisoes": { "NOME": { "tipo": "intencional" } }` (trabalha nos dois) ou
   `{ "tipo": "troca", "parceiro": "NOME" }`; "está certo, fica Livre" vai em
   `"conferidos": ["NOME"]`. As decisões viajam na RPC (`p_linha_overrides`) e, ao republicar, o
   rastro de quem segue na escala é preservado (`p_preservar`) — igual à tela. Divergência com a
   numérica é aviso, nunca bloqueio: troca, ajuda e consultório mudam o rodapé de propósito;
   compare com a foto e siga. Nome ambíguo: escreva o nome completo, nunca escolha.
6. **Publicar** (sem `--ensaio`). ⚠️ Se a publicação falhar por **rede** (`ETIMEDOUT`/
   `EHOSTUNREACH` — aconteceu 2× em 11/09), **conferir o banco antes de repetir**: a RPC roda
   `begin … commit` numa chamada só, então ou gravou tudo ou nada, e o script não sabe qual foi.
   `select hospital, publicacao_turnos->'<turno>'->>'casos' from escala_cirurgica where data='<data>'`
   — `null` significa que não gravou e pode repetir à vontade. O script recusa turno já publicado: se o pedido é corrigir
   uma escala em uso (status marcados, liberações), o conserto é reparo linha a linha em SQL
   (`scripts/repair-escala-2026-09-08-matutino-leitura.sql` é o modelo) — republicar zera
   o trabalho do turno. Só use `--republicar` quando o dono pedir isso e ninguém marcou nada.
7. **Relatar**: por hospital, quantos casos, rodapé, ajuda, quem ficou com "?", o que foi
   decidido (data, herança, azul) e os avisos que sobraram.

   **Custo** (medido, `claude-opus-4-8` a US$ 5/M entrada e US$ 25/M saída, de
   `escala_leitura_log`): **~US$ 0,19 por publicação de três fotos** — Unimed US$ 0,07–0,17
   conforme o tamanho, HRO US$ 0,07–0,10, Materno US$ 0,04. Quase tudo é SAÍDA: o custo sobe
   com o **número de casos**, não com o tamanho da imagem. Sai da conta de API do dono, não do
   plano do Claude Code. Transcrever da foto custa US$ 0.

## Como ler o recado do dono que vem junto das fotos

O dono manda, no estilo do WhatsApp do grupo, o que a foto não diz. Exemplo real (08/09, para
a manhã de 09/09):

> Como ajuda + ordem de liberação: 1º Beta Anest – Uni · 2º Joao Moreira – Simone · 3º Garim
> Anest – Iosc. Trocas: Rafael Anest (consultório) na posição do Diego Anest no Iosc;
> Nathália Anest Fornari (consultório) na posição da Fernanda Anest no Iosc.

- **"Como ajuda … 1º X – Local"**: X é ajuda de outro hospital no local dito (Beta = ROBERTA na
  Unimed; João Moreira = JOAO RICARDO na Simone do HRO; Garim no IOSC do HRO). Entra em
  `ajudaExterna` do hospital certo e o caso dele ganha `cor: "azul"`. A numeração é a ordem em
  que SAEM; na fila a ÚLTIMA ajuda do array sai primeiro, então quem tem o número menor vai
  DEPOIS no array (2º João, 3º Garim → `["GARIM","JOAO RICARDO"]`).
  ⚠️ **A ajuda numerada PODE estar no rodapé do próprio hospital** (ALINE, 11/09: 17ª e última
  da Unimed e 2ª na ordem de saída). Isso é legítimo — transcreva os dois: o rodapé como está na
  foto E o nome na `ajudaExterna`. Até 11/09 o app ignorava a numeração nesse caso, porque quem
  fecha o rodapé virava "plantão do contraturno" e saía da fila antes do sort; corrigido em
  `colunaLiberacao.js` (ver `.claude/rules/escala-liberacoes.md`). Se a ordem publicada sair
  diferente do recado, é defeito de código — não conserte mexendo no lote.
  ⚠️ **Numerou = `ajudaOrdemInformada: true` no hospital, dentro do lote** (dono 09/09). Sem
  essa marca a fila ordena a cauda pelo rodapé do hospital de ORIGEM (regra de 27/08) e passa
  por cima da numeração: em 10/09 o dono pediu "3º Rafael, 4º Alexandre" e a Unimed liberou o
  Alexandre primeiro, porque ele está em 11º no rodapé do HRO e o Rafael veio do consultório,
  sem origem. Publicação sem numeração NÃO leva a marca — a lista que a Vision monta sai na
  ordem da imagem e não é ordem de ninguém.
- **"Trocas: A (consultório) na posição do B no Iosc"**: a escala já saiu com A no IOSC e B não
  está em escala nenhuma (consultório). Não é duplicidade: é REGISTRO de troca na linha de A,
  `decisoes: { "A": { "tipo": "troca", "parceiro": "B", "apenasRegistro": true, "local":
  "Consultório" } }` — badge Troca e "Trocado com B (Consultório)" na fila, nada se move. A
  numérica vai apontar exatamente B faltando e A sobrando: é a confirmação, não um erro.
- ⚠️ **Troca do recado é SEMPRE `apenasRegistro: true`** — inclusive quando os DOIS estão nesta
  escala ("Troca particular: Joao H. e Klisman", 09/09). O que o dono manda já aconteceu; a foto
  já saiu certa e o que falta é só o rastro. Sem o campo, a decisão vira DECLARAÇÃO PENDENTE:
  o badge nasce outline em vez do sólido de sempre (`LiberacoesView.jsx:1950`) e a convergência
  da próxima importação do turno EXECUTA um swap que ninguém pediu — desfazendo a troca real
  (`escalaPublicacaoDecisoes.js`: "`paresDeclarados` ignora registro de propósito"). Publicada
  sem ele, o conserto é acrescentá-lo no jsonb pela `rpc_escala_patch_liberacao`, sem republicar.
  Não perguntar ao dono entre "registro" e "executar": desde a reforma de 07/08 as 40 trocas em
  produção são registro, e o modo que executa é do TrocaSheet, com um toque na fila.
- Apelido do WhatsApp → apelido do dicionário: Beta = ROBERTA · Joao Moreira = JOAO RICARDO ·
  Garim = GARIM · Nathália Fornari = NATHALIA · **Dani Resi = DANIELA (Reis, não "residente")** ·
  Rafael = PELISSARO (mesmo cadastro; a fila mostra o apelido canônico, não o que o dono
  escreveu). Na dúvida, o dicionário (`escala_anestesista_alias`) decide; nunca chute.

## Limites

Nunca publique sem ter conferido a foto; nunca deixe nome completo de paciente fora do caso
PARTICULAR; a pasta `.tmp/escala-lote/` não entra em commit; nenhum deploy ou migration faz
parte disto. Se a leitura vier truncada ou com rodapé vazio, releia com a dica (o script já
passa) e, persistindo, transcreva da foto.

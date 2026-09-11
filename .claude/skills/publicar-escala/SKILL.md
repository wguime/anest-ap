---
name: publicar-escala
description: Publica a escala cirúrgica de um turno a partir das fotos que o dono cola no chat (Unimed, HRO, Materno), sem passar pela tela de importação e SEM consumir a API — você transcreve a foto que já está no contexto, a conferência da tela valida, e a publicação é a mesma RPC, assinada como o dono. Use quando o dono anexar fotos da escala e pedir para publicar ("publique as escalas da tarde", "escalas de amanhã", "UNIMED [foto] HRO [foto] MATERNO [foto]"), ou quando pedir para corrigir uma escala já publicada a partir da foto.
allowed-tools: Read, Bash, Write, Edit, Grep, Glob
user-invocable: true
---

# Publicar escala pela foto

O dono manda as fotos e quer a escala no ar sem explicar nada (08/09/2026). A publicação é a
MESMA RPC da tela, com a MESMA conferência, assinada como o dono.

## ⛔ A LEITURA É SUA — não chame a edge (dono 11/09/2026)

> *"Quero que tudo seja realizado pelo Claude Code sem consumir a API. Tudo está sendo
> realizado no chat, não faz sentido descontar."*

**As fotos já estão no seu contexto.** Mandá-las para a edge `parse-escala-cirurgica` é pagar
a Vision para reler o que você está vendo — US$ 0,19 por publicação de três fotos, cobrados na
conta de API do dono. **Transcreva você mesmo** e o custo é zero.

Não é só o dinheiro: a edge some com os erros que ela mesma introduz. Medido nas 7 leituras de
10–11/09, e cada um destes eu já tinha de corrigir à mão depois — `ajudaExterna` no hospital
errado **4 de 4** · PARTICULAR sem nome do paciente **5 de 8 no HRO** · `GUILHERME M ELO`
partido **4 de 4** · célula do anestesista vazia 5× (azuis e as seções IMAGEM/C.O/Exames) ·
data do HRO errada ou ausente **3 de 3**. A conferência contra a foto sempre foi a leitura que
manda; a da edge era um rascunho que eu reescrevia. Transcrever tira a passada intermediária,
não a conferência.

E some o que quebrou em 11/09: timeout aos ~66s (a edge termina, cobra, e a resposta não chega)
e as falhas de rede. Transcrever não tem nenhum dos dois.

**Verificado (11/09):** `parse-escala-cirurgica` é a ÚNICA edge do repo que chama a API
Anthropic, e a única chamada a ela no script está dentro de `if (cmd === 'ler')`. O comando
`publicar` toca só `api.supabase.com` (SQL) e `pegaplantao-proxy` (férias) — **não usar o `ler`
zera o consumo, e nada mais precisa mudar**. ⚠️ A edge continua existindo e sendo usada pela
TELA de importação, que é como a equipe publica; isto vale só para a skill.

Script: `scripts/escala-publicar-turno.mjs` — use o comando **`publicar`**. O comando `ler`
fica como último recurso (foto ilegível, volume que você não consegue transcrever com
segurança); usá-lo é uma decisão a comunicar ao dono, com o custo, não o caminho normal.

## Passos

1. **Data e turno.** Vêm da mensagem ("da tarde", "de amanhã"); sem isso, a data é hoje em
   `America/Sao_Paulo` e o turno vem das horas da foto (13:00 em diante = vespertino). A
   planilha da Unimed traz a data em cada linha; o HRO às vezes traz uma data velha no título
   (08/09 dizia 04/09 e era de 08/09 — a continuação das cirurgias da manhã prova). Decida pela
   coerência entre as três fotos e diga no relatório o que assumiu.
2. **Guardar as fotos.** O caminho do WhatsApp é temporário: copie para
   `.tmp/escala-lote/<data>-<turno>/` (pasta fora do git — tem iniciais de paciente).
3. **Transcrever as três fotos** — você lendo a imagem, sem edge e sem custo. Grave um JSON por
   hospital em `.tmp/escala-lote/<data>-<turno>/<h>.json` com a forma que o `publicar` espera:

   ```jsonc
   { "hospital": "unimed",
     "casos": [{ "sala": "CENTRO CIRÚRGICO - SALA 1", "ordem": 0, "hora": "13:30",
                 "tempoEstimado": "02:15", "pacienteIniciais": "Z.S.S.A.", "idade": "83a 2m 1d",
                 "procedimento": "...", "convenio": "", "cirurgiao": "...",
                 "anestesista": "ERLEI", "bloco": "normal", "isContinuacao": false,
                 "semAnestesista": false, "tipo": "eletiva", "cor": "" }],
     "posicoesAssistenciais": [{ "local": "SRPA", "anestesista": "VICENTE" }],
     "ordemLiberacao": ["ROSE", "ROBERTA", "..."],
     "ajudaExterna": [], "dataDetectada": "2026-09-11" }
   ```

   Escreva por um script Python com a tabela em literal (foi assim que a Unimed de 34 casos saiu
   em 11/09): `ordem` reinicia por sala, as iniciais saem do nome por regra, e o `pacienteNome`
   entra só onde o convênio é PARTICULAR — errar isso à mão em 34 linhas é fácil, num laço não.
   **Não escreva sala canônica**: transcreva o rótulo como está na foto ("CENTRO CIRÚRGICO -
   SALA 1", "UMANITA", "C.O") — `normalizarCasosImportados` converte para "CC - Sala 1",
   "Umanitá", "Sala 7 - CO" e é ela que decide, não você.

   **O que a edge fazia por baixo e agora é seu:**
   - **LGPD** — `pacienteNome` SÓ em convênio PARTICULAR puro (é o que abre a cobrança). Todo o
     resto vai por iniciais, e nome completo de paciente não-particular não entra no JSON.
   - **`dataDetectada`** — a data que a FOTO diz, não a da publicação; é ela que dispara o aviso
     de divergência. HRO costuma trazer a do dia anterior ou nenhuma: transcreva o que está lá.
   - **`semAnestesista: true`** com `anestesista: "?"` onde a foto traz "?" / "???" / vazio.

   ⚠️ **Transcreva o que a foto mostra, não o que faria sentido.** A cor é dado (azul = ajuda de
   outro hospital, amarelo = a pessoa em dois locais de propósito), "//" é igualdade com a linha
   de cima **sempre**, e "AS" é hora válida. Onde a foto estiver ambígua, diga no relatório em
   vez de escolher.

   💡 **O Materno é o MESMO documento nos dois turnos do dia** ("Mapa de cirurgias" traz o dia
   inteiro). Se a manhã já foi publicada por aqui, os casos estão em
   `.tmp/escala-lote/<data>-matutino/materno.json` — reaproveite e confira só o nome à mão, que
   MUDA DE LINHA entre os turnos.

4. **Reler a foto contra o JSON montado** — é o passo que não pode ser pulado, e continua
   existindo mesmo sem a edge: antes ele pegava os erros dela, agora pega os seus. Confira linha
   a linha, na foto, não no que você lembra de ter escrito. O que mais
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

   **Comece por estes seis.** É o que a leitura automática errava, medido nas 7 leituras de
   10–11/09 — ou seja, é o que a escala tem de difícil, e continua difícil quando quem lê é
   você. Os três primeiros falham **em silêncio depois de publicados**:

   | erro | frequência | como reconhecer |
   |---|---|---|
   | **`ajudaExterna` no hospital errado** | **4 de 4** | a armadilha: a ajuda pertence ao hospital **onde a pessoa vai TRABALHAR**, e o nome está ESCRITO no outro. Azul no rodapé do HRO + caso azul na Unimed = ajuda **da Unimed**. Sempre reescrever os dois lados à mão. |
   | **PARTICULAR sem `pacienteNome`** | **5 de 8 no HRO**, 1 de 6 na Unimed | o HRO escreve nome e idade na mesma célula e é fácil levar só as iniciais. Sem o nome o gatilho não abre a cobrança, **em silêncio**. Varrer todo caso `convenio` PART/PARTICULAR. |
   | **nome que o dicionário não resolve** | **4 de 4** | `GUILHERME M ELO` era o vício da edge; o seu é escrever o nome do WhatsApp em vez do apelido do dicionário. Resolver todo nome em `escala_anestesista_alias` antes do ensaio. |
   | **anestesista das seções de baixo** | 5 | onde a leitura automática mais falhava: nomes em **AZUL** (3×) e as seções **IMAGEM, C.O, Exames, SRPA, Umanitá** (2×), que ficam fora da grade principal e são fáceis de pular na transcrição. Varrer a foto de cima a baixo, não só a grade. |
   | **data do HRO** | 2 erradas + 1 ausente em 3 | o HRO traz a data do dia ANTERIOR no título, ou nenhuma — transcreva o que está lá e deixe o aviso aparecer. Unimed e Materno trazem a certa em cada linha — decidir por elas. |
   | **SRPA / posição assistencial** | 1 de 2 | uma linha solta entre as seções, sem hora — some com facilidade. Vai em `posicoesAssistenciais`, não em `casos`. |

   ⚠️ **No Materno o nome à mão MUDA DE LINHA entre os turnos** e é fácil colá-lo na
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

   **Custo: US$ 0.** Com a transcrição no chat nada sai da conta de API do dono — verificado em
   11/09: no fluxo de `publicar` as únicas chamadas externas são `api.supabase.com` (SQL) e
   `pegaplantao-proxy` (férias). Se por exceção você tiver usado o `ler`, diga quanto custou
   (`escala_leitura_log`: ~US$ 0,19 por três fotos, quase tudo em tokens de SAÍDA — escala com o
   nº de casos, não com o tamanho da imagem).

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

Nunca publique sem ter relido a foto contra o JSON; nunca deixe nome completo de paciente fora
do caso PARTICULAR; a pasta `.tmp/escala-lote/` não entra em commit; nenhum deploy ou migration
faz parte disto. **Não chame a edge de leitura** — ver o bloco no topo; se algum dia precisar
dela (foto ilegível que você não consegue transcrever), avise o dono antes, com o custo, e
saiba que o `ler` corta aos ~66s desde 11/09 **mesmo quando a edge termina e cobra**: conferir
`escala_leitura_log` antes de repetir, porque repetir paga de novo pela mesma leitura.

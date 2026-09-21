---
name: publicar-escala
description: Publica a escala cirúrgica de um turno a partir das fotos que o dono cola no chat (Unimed, HRO, Materno), sem passar pela tela de importação e SEM consumir a API — você transcreve a foto que já está no contexto, a conferência da tela valida, e a publicação é a mesma RPC, assinada como o dono. Use quando o dono anexar fotos da escala e pedir para publicar ("publique as escalas da tarde", "escalas de amanhã", "UNIMED [foto] HRO [foto] MATERNO [foto]"), ou quando pedir para corrigir uma escala já publicada a partir da foto. Cobre também o FIM DE SEMANA ("publique as escalas de final de semana", tabela de posições + mapas de sábado e domingo): fila única por turno na linha 'fds', mapas sem rodapé — comando `publicar-fds`.
allowed-tools: Read, Bash, Write, Edit, Grep, Glob
user-invocable: true
---

# Publicar escala pela foto

O dono manda as fotos e quer a escala no ar sem explicar nada. **Você transcreve** (as fotos já
estão no contexto — a edge `parse-escala-cirurgica` custa US$ 0,19 por lote, erra mais e corta aos
66 s; nunca chamá-la, e o app continua lendo do jeito dele). O `publicar` roda a MESMA conferência
da tela (`escalaConferenciaHeadless.js`) e a MESMA RPC, assinada como o dono. **Meta: ≤ 4 min do
pedido ao PUBLICADO.** O porquê de cada regra está em `REFERENCIA.md` — não é leitura de rotina.

## Roteiro — 3 chamadas de ferramenta

1. **Write** `.tmp/escala-lote/<data>-<turno>/gerar.py` a partir de `gerar-template.py` (helpers em
   `lote.py`): só as tabelas dos três hospitais, rodapés, `decisoes` e `conferidos`. Data e turno
   vêm da mensagem; sem isso, hoje em `America/Sao_Paulo` e o turno pelas horas (13:00+ = tarde).
2. **Bash**: `cp` das fotos para a pasta (o caminho do WhatsApp é temporário; a pasta é fora do git)
   + `python3 gerar.py` + `node scripts/escala-publicar-turno.mjs publicar <lote.json> --ensaio`.
3. **Reler a foto contra a saída do ensaio** — o único passo que não se pula; é a saída, não o JSON.
   Na ordem, por hospital: (a) **contagem por sala** — cada linha da foto tem uma linha no ensaio
   (a linha esquecida é o erro silencioso); (b) **anestesista por linha**, seguindo cada corrente
   de "//" e cada "?"; (c) **cor** — todo azul/amarelo da foto aparece como `azul`/`amarelo`, e a
   ajuda está no hospital onde a pessoa trabalha; (d) **`PART: nome`** em todo particular;
   (e) **rodapé** nome a nome, na ordem; (f) **seções de baixo + SRPA** presentes; (g) os avisos
   restantes têm explicação na foto ou no recado. Sem bloqueio e sem aviso que aponte erro seu →
   **Bash** `publicar` (sem `--ensaio`). O `gerar.py` já parou antes em erro de forma (hora, cor e
   tempo na posição errada, "//" sem base ou abaixo de "?", cirurgião trocado com procedimento,
   particular sem nome) e avisou nome sem caso no meio do rodapé.
4. Relatório curto: por hospital "N casos · rodapé N · ajuda […]", quem ficou com "?", o que o
   recado virou, avisos que sobraram. Custo US$ 0.

**Não fazer** — cada item custou minutos em 17/09: consultar `escala_anestesista_alias` (o ensaio
resolve todo nome e bloqueia o ambíguo); consultar o banco antes do ensaio (ele diz "já
publicado"; o turno é carimbado pelo lote e, no Materno, as horas < 13:00 ficam fora da tarde
sozinhas); rodar `ordem-liberacao-numerica.mjs` (o ensaio compara com a numérica + férias); ler
o gerar.py de outro dia ou código do app para lembrar convenção (a ficha abaixo responde — se não
responder, ela ganha uma linha depois de publicar); perguntar ao dono o que a ficha ou "Recado"
já decidem — pergunte só o que nem a foto nem o recado dizem (célula ilegível, nome que não é
apelido conhecido).

## Ficha de transcrição

- **Sala = rótulo da foto**; quem canoniza é `normalizarCasosImportados`. Unimed: `C.O - CESAREA`,
  `C.O - SALA 3`, `HEMODINAMICA`, `CENTRO CIRÚRGICO - SALA N` (`… SALA 10 ROBOTICA`), `EXAMES`,
  `IMAGEM`, `ACCURATA`, `UMANITA`, `CLINICA CIRURGICA`. HRO: `Sala N` (Bloco A), `Bloco M - Sala N`
  (o "//" **não** herda entre salas do Bloco M — escreva o nome), `C.O` (vira Sala 7), `HEMO`,
  `EXAMES`, `IOSC` (as três salas internas viram `IOSC`), `HO`, `MATERNO`, `CONSULT.`, `AMBULAT.`,
  `Centro de Coluna`, `SIMONE`, `Braqui`. Materno: `Sala N HC`.
- **Hora** só `HH:MM`; `AS` é hora válida. **Data** (`dataDetectada`) é a que a FOTO diz — a Unimed
  traz em cada linha, o Materno no topo, o HRO às vezes a do dia anterior ou nenhuma (`''`): decida
  pela coerência das três e deixe o aviso aparecer.
- **Anestesista por linha**: nome da foto · `//` = igual à linha de cima na MESMA sala, **sempre**
  (mesmo se quem está acima é ajuda de fora) · `?`/vazio = descoberta (`"?"`, `semAnestesista`).
  **"//" abaixo de "?"** também é descoberta → escreva `"?"` (um "//" ali cairia no 1º nome da sala).
  **Materno da tarde sem nome nas primeiras linhas → `"?"` explícito**, nunca vazio/`//` (herdariam
  o nome anotado mais abaixo). No Materno só o nome À MÃO em vermelho é anestesista; "Geral" é técnica
  e o nome **muda de linha** entre manhã e tarde.
- **Cor é dado**: AZUL = ajuda de outro hospital → `cor: 'azul'` no caso **e** em `ajudaExterna` do
  hospital onde a pessoa vai TRABALHAR (o nome pode estar escrito no outro — azul no rodapé de A com
  caso azul em B = ajuda de B; transcreva os dois lados como a cor diz, o script realoca). AMARELO =
  a pessoa em dois locais de propósito → `cor: 'amarelo'` nos dois, sem decisão. Célula de DATA
  amarela na Unimed é marca da planilha. `"02 ANEST"` amarelo sem 2º nome: nota no procedimento, "//".
  **Dois nomes na célula ("PAULO + GUILHERME MELO")** → anestesista `"A + B"` tal qual: é bloco de dupla no
  app (uid nulo por desenho, a fila conta os dois pelo "+", o "//" abaixo herda a dupla inteira); o ensaio
  avisa "sem vínculo" e "na ordem sem caso" para os dois — esperado, não é erro do lote (18/09).
- **Seções fora da grade** são casos (Exames, Imagem, Hemodinâmica, Accurata, Umanitá, IOSC, HO,
  Ambulatório, Braqui, Simone, Consultório, e a linha `MATERNO | NN PROCEDIMENTOS | NOME` do HRO).
  `SRPA | NOME` vai em `posicoesAssistenciais` (conta como ocupado). "CONTINUAÇÃO ±14h" é caso com
  `cont=True`. Varrer a foto de cima a baixo — é onde a leitura mais perde nome.
- **Rodapé** completo, NA ORDEM, com as notas ("MATHEUS (CONSULT)" é uma posição). Quem fecha o
  rodapé **sem caso** (plantão do contraturno/noite) → `conferidos` — só a **cauda contígua**. Nome
  sem caso no MEIO do rodapé é quase sempre linha da foto esquecida (ou azul não lido): volte à
  foto antes de pôr em `conferidos`; o `gerar.py` avisa os dois casos.
- **LGPD**: `pacienteNome` só em PARTICULAR/PART (o template faz; é o que abre a cobrança); FAS,
  SC, BRF, UNIMED FUNDACAO não são particular. Todo o resto por iniciais; nome de não-particular
  não entra no JSON.
- `turnoProprio` (Louise) é automático pela numérica. `RAFAEL` sai como `PELISSARO` — mesmo
  cadastro. Ambíguo na foto: diga no relatório em vez de escolher.

## Recado do dono → lote

| frase | vira |
|---|---|
| "Como ajuda … 1º X – Local · 2º Y – Local" | X, Y em `ajudaExterna` do hospital do LOCAL, `cor: 'azul'` no caso; a ÚLTIMA do array sai primeiro (2º Y, 3º Z → `['Z','Y']`); **`ajuda_ordem_informada=True`** naquele hospital. A ajuda numerada pode estar no rodapé do próprio hospital — transcreva os dois. Se a fila publicada sair em ordem diferente do recado, é defeito de código, não do lote. |
| "Trocas: A (consultório) na posição do B no HRO" | `'A': {tipo:'troca', parceiro:'B', apenasRegistro:True, local:'Consultório'}` — B fora de escala. |
| "A na posição do B" com os DOIS em escala | registro nos dois lados: `'A': {…parceiro:'B', local:'<hospital de B>'}` e `'B': {…parceiro:'A', local:'<hospital de A>'}`. |
| qualquer troca do recado | **sempre `apenasRegistro: True`** — já aconteceu, a foto já saiu certa; sem o campo vira declaração pendente e a próxima importação executa um swap. Não perguntar "registro ou executar". |
| "X na equipe da Unimed até as 19h" / "no HRO até as 13h" | X é membro da equipe daquele hospital no turno. Nada de ajuda, troca ou `turnoProprio` ("até as 19h" = fim do turno). A numérica aponta "a mais"/"faltando" — é a confirmação. |
| linha `MATERNO` do HRO + mapa HC com a mesma pessoa | duplicidade esperada: responde pela troca do recado ou `'NOME': {tipo:'intencional'}`. |
| apelidos | Beta = ROBERTA · Joao Moreira = JOAO RICARDO · Garim = GARIM · Nathália Fornari = NATHALIA · Dani Resi = DANIELA (Reis) · Rafael = PELISSARO. Nome ambíguo (dois GUILHERME, dois JOAO): escreva o nome completo, nunca escolha; o ensaio recusa o que não resolver. |

## O que o ensaio faz com o lote

**Bloqueia** (a tela também recusaria): nome ambíguo, hora inválida, campo que o banco recusa,
rodapé vazio (HRO/Unimed), pessoa em dois hospitais sem decisão, turno já publicado. **Avisa**:
rodapé × numérica com férias do dia, férias da DUPLA (Rose/Aline, Humberto/Roberta tiram junto)
e pós-plantão (P1/P2 da noite da véspera: 2ª posição de manhã, fora à tarde) já descontados —
o que sobra é troca, ajuda e consultório, que mudam o rodapé de propósito (compare com a foto e
siga; não relate como "faltando" quem o aviso já diz que foi descontado), cauda que nasce liberada, nome na ordem sem caso, caso de quem não
está no rodapé (azul não lido?), ajuda provável, conflito de horário, bloco/item repetido, seção
do HRO ausente, travessia da manhã sem dono, data divergente, escala que encolhe, **particular sem
nome** (a cobrança não abre). Realoca sozinho o azul emprestado. Respostas no lote: `decisoes`
(`intencional` | `troca`) e `conferidos` ("está certo, fica Livre"); viajam na RPC e o rastro de
quem segue sobrevive a republicar.

**Publicar**: falhou por rede (`ETIMEDOUT`/`EHOSTUNREACH`) → antes de repetir,
`select hospital, publicacao_turnos->'<turno>'->>'casos' from escala_cirurgica where data='<data>'`
(a RPC é uma transação: `null` = não gravou, pode repetir). **`--republicar` zera status e
liberações** — só a pedido do dono e com ninguém tendo marcado nada; escala em uso se conserta
linha a linha em SQL (`scripts/repair-escala-2026-09-08-matutino-leitura.sql`), ou no jsonb pela
`rpc_escala_patch_liberacao` sem republicar.

## Fim de semana (sáb/dom) — outro fluxo

Na sexta chegam a **tabela "ESCALA DE FINAL DE SEMANA"** (sáb + dom na mesma foto) e **um mapa por
hospital por dia**. Roteiro igual, com `gerar-fds-template.py` (`Mapa`, `salvar_fds`) em
`.tmp/escala-lote/<sábado>-fds/` e o comando **`publicar-fds`** (`--ensaio`, depois sem). O modelo
muda (regra completa em `.claude/rules/escala-fds-feriado.md`):

| | dia útil | fim de semana |
|---|---|---|
| fila | uma por hospital, no rodapé do mapa | **uma por turno para os 3 hospitais**, da TABELA; linha pseudo-hospital `'fds'` |
| rodapé no mapa | é a ordem | **não há** — o mapa vai sem `ordemLiberacao` |
| turnos | manhã, tarde | manhã, tarde, **noite** (`fds_meta.ordemNoite`) |
| ajuda / duplicidade / troca | conferência completa | **não existem**; quem está em dois hospitais só está |
| numérica | rodapé × numérica | posições × **Pega Plantão** do sábado (P5–P12 exatos; P1–P4 é bloco que só a foto ordena) |
| sala sem nome | "?" | `''` — a lib decide ("?"; na **manhã de sábado**, o posto da grade) |

Tabela: `grade` (3 faixas × unimed/hro/ret1/ret2), `posicoes` (Pn→nome, só o sábado é rotulado),
`escalacao` (Pn por turno, na ordem da lista numerada), `ordemDoc` = a linha "1º→último a ser
LIBERADO" **como está no documento** (a inversão é do script, uma vez; linha ausente = `[]` →
sugestão pela escalação, marcada "sugerida"; **noite sempre `[]`** — grade 19-07 + sáb P11,P8,P7 ·
dom P11,P6,P5). A retaguarda que a linha da tarde omite (P1, P2) entra no fim do rodapé pelo script
(`completarRodapeFds`, imprime "acrescentado ao fim") — se o dono mandar diferente, é ele quem
decide. **Domingo herda as posições do sábado; a COR diz a troca pessoal** (nome novo na cor de um
Pn → só essa posição em `posicoes` do domingo); o bloco "8º X 7º Y · EMERGENCIA: 11º Z · P1 P2 P3
P4" sem linha de liberação → `escalacao: ['P8','P7','P11']` nos dois turnos, `ordemDoc` vazio.
`PLANTÃO MATERNO` (MARTA, ELISETE) são funcionárias → `ignorados`. Divergência com o Pega Plantão
em P1–P4 é troca pessoal, não erro — o documento manda, e desde 18/09 o script nem avisa (só gente de
fora do bloco); "G. Staub"/"A. Danieli" são a inicial do Pega Plantão e o casador resolve pelo cadastro.
**Domingo**: P7/P8 sem cirurgia eletiva no mapa aparecem no FIM da fila, liberados, com o motivo no
card (regra da tela, 18/09) — diga no relatório quem está nessa situação; acionar em urgência é o toque.

Mapas: `m.vesp()` ao cruzar o título VESPERTINO (as linhas "AS" só têm turno pela faixa; a hora
vence quando existe); célula vazia é `''`, `?` só quando escrito; a tarde costuma vir sem
anestesista nos dois hospitais — publique vazio, a fila única distribui. Acréscimo do dono por
texto ("artrodese toracolombar sábado 13h, particular, Penteado") é um caso a mais no hospital
onde o cirurgião opera (`cirurgiao ilike '%penteado%'` no banco → HRO, Sala 3); sem nome de
paciente a cobrança não abre — avise. **O caso leva só o que o recado diz**: procedimento
desconhecido fica `''` (o card mostra "AS —"), sala desconhecida fica o que dá para afirmar
("CC") — nunca texto seu no campo (19/09: "CIRURGIA (RECADO DO DONO)" foi para o card de todos).
Turno em uso: acréscimo é `repair-escala-<data>-*.sql` pela Management API, não republicação; e
antes de dizer "fulano voltou a trabalhar", leia `liberacoes` da linha — marcação de toque vence o caso. Bloqueia: ordem vazia de manhã/tarde, Pn sem dono, nome
ambíguo, campo recusado, turno já publicado. Avisa: Pega Plantão, sala sem nome, posto sugerido,
encolhimento. Relatório: as três filas por dia (quem foi
acrescentado, o que é "sugerida"), casos por hospital/turno, particulares com e sem cobrança, a
troca de P1–P4 que a foto mostrou.

## Limites

Nunca publicar sem reler a foto contra o ensaio; nome completo de paciente só em particular;
`.tmp/escala-lote/` não entra em commit; nenhum deploy ou migration faz parte disto; **feriado**
(lista simples, `ordensDocumentoFeriado`) não tem comando — o script recusa a data e a publicação é
pela tela; **nunca a edge de leitura** — foto ilegível é pergunta ao dono, com o custo; **o app não
muda** (edge, prompt dela, cache, `ImportarEscalaPage`, `escalaCirurgicaService` ficam como estão —
é como a equipe publica; mudança lá é pedido próprio do dono, Regra #2).

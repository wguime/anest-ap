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
4. **Conferir cada rascunho contra a foto** — é o passo que não pode ser pulado. O que mais
   erra: hora (só HH:MM; "AS" fica "AS"); anestesista por linha ("//" herda o de cima NA MESMA
   sala; célula vazia ou "?" é linha descoberta → `"?"` e `semAnestesista: true`; nome em AZUL é
   ajuda de outro hospital → entra em `ajudaExterna` e no caso; AMARELO é a pessoa em dois
   locais de propósito, mantém nos dois); seções fora da grade (Exames, Imagem, Hemodinâmica,
   IOSC, HO, Ambulatório, Braqui, Simone); rodapé completo NA ORDEM, com notas entre parênteses
   ("MATHEUS (CONSULT.)" é uma posição); continuações ("CONTINUAÇÃO ±14h" é caso, com
   `isContinuacao`); Bloco M do HRO com salas internas diferentes (o "//" não herda entre
   "Bloco M - Sala 3" e "Bloco M - Sala 2" — escreva o nome). No Materno só o nome anotado à mão
   em vermelho é anestesista; "Geral" é técnica. Paciente PARTICULAR puro leva `pacienteNome`
   (é o que preenche a cobrança); todo o resto fica por iniciais.
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
6. **Publicar** (sem `--ensaio`). O script recusa turno já publicado: se o pedido é corrigir
   uma escala em uso (status marcados, liberações), o conserto é reparo linha a linha em SQL
   (`scripts/repair-escala-2026-09-08-matutino-leitura.sql` é o modelo) — republicar zera
   o trabalho do turno. Só use `--republicar` quando o dono pedir isso e ninguém marcou nada.
7. **Relatar**: por hospital, quantos casos, rodapé, ajuda, quem ficou com "?", o que foi
   decidido (data, herança, azul) e os avisos que sobraram. Três leituras custam ~US$ 0,40.

## Limites

Nunca publique sem ter conferido a foto; nunca deixe nome completo de paciente fora do caso
PARTICULAR; a pasta `.tmp/escala-lote/` não entra em commit; nenhum deploy ou migration faz
parte disto. Se a leitura vier truncada ou com rodapé vazio, releia com a dica (o script já
passa) e, persistindo, transcreva da foto.

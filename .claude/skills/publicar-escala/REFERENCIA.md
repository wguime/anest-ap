# /publicar-escala — referência (o porquê de cada regra)

> Leitura opcional. A `SKILL.md` traz só o que se faz; aqui está o que aconteceu para cada regra
> existir. Não carregar de propósito numa publicação — é história, não passo.

## Por que a leitura é sua e não da edge (dono 11/09/2026)

*"Quero que tudo seja realizado pelo Claude Code sem consumir a API. Tudo está sendo realizado no
chat, não faz sentido descontar."* Mandar as fotos para `parse-escala-cirurgica` é pagar a Vision
para reler o que já está no contexto — US$ 0,19 por publicação de três fotos (`escala_leitura_log`:
quase tudo tokens de saída; escala com o nº de casos, não com a imagem). E a edge trazia os erros
que eu corrigia à mão depois, medidos nas 7 leituras de 10–11/09:

| erro | frequência |
|---|---|
| `ajudaExterna` no hospital errado | 4 de 4 |
| PARTICULAR sem `pacienteNome` | 5 de 8 no HRO, 1 de 6 na Unimed |
| `GUILHERME M ELO` partido / nome fora do dicionário | 4 de 4 |
| célula do anestesista vazia (azuis; IMAGEM, C.O, Exames, SRPA, Umanitá) | 5 |
| data do HRO errada ou ausente | 3 de 3 |
| SRPA perdida | 1 de 2 |

Desde 11/09 o `ler` ainda corta aos ~66 s **mesmo quando a edge termina e cobra** — repetir paga de
novo. Verificado: `parse-escala-cirurgica` é a única edge que chama a API Anthropic e a única chamada
no script está em `if (cmd === 'ler')`; `publicar` toca só `api.supabase.com` e `pegaplantao-proxy`.

⛔ **Vale só para a skill — o app não muda** (dono, no mesmo fôlego): *"mantenha assim as leituras
realizadas aqui no Claude Code, mas não troque a forma como as escalas são lidas quando anexadas
via app."* `ImportarEscalaPage`, a edge, o prompt dela, o cache e o `escalaCirurgicaService` são como
a EQUIPE publica. Os números acima são para conferir melhor, não backlog da edge (Regra #2).

## Por que ≤ 4 min (dono 17/09/2026)

*"Demorou em torno de 10 min para concluir, deve ser mais ágil."* Medido: `publicar` gasta ~5 s na
conferência e ~15 s com a RPC. Os 10 min foram pesquisa — reler o gerar.py de outro dia, consultar
o dicionário de apelidos (o ensaio resolve e bloqueia), conferir o banco antes do ensaio, rodar a
numérica à parte (o ensaio compara), ler `utils.js` para lembrar como "//" e salas se resolvem, e
uma pergunta ao dono sobre o recado ("na equipe da Unimed até as 19h") que a skill devia responder
— resposta dele: *"aprenda para as próximas"*. Daí o template, os helpers em `lote.py`, a ficha e a
lista do que não fazer.

## Incidentes que viraram regra

- **"//" é igualdade, sempre a linha de cima na mesma sala** (dono 11/09: "isso já está definido nas
  regras"). A dúvida: uma ajuda de fora entrou no meio da sala e a linha seguinte era "//" — o "//" é
  dela, não de quem abriu a sala.
- **Materno: o nome à mão muda de linha entre os turnos.** Em 10/09 a leitura pôs RAFAEL na linha
  das 07:30 quando a anotação estava na de 13:30 — com a sala inteira herdando "//", o turno errado
  ficou com o dono errado. Em 17/09 as linhas da tarde sem nome viraram "?" explícito porque um
  "//" ou vazio ali herdaria, pela base da sala, o nome anotado mais abaixo.
- **Ajuda numerada no rodapé do próprio hospital** (ALINE, 11/09: 17ª e última da Unimed e 2ª na
  ordem de saída). Até 11/09 o app ignorava a numeração nesse caso — quem fecha o rodapé virava
  "plantão do contraturno" e saía da fila antes do sort; corrigido em `colunaLiberacao.js`.
- **Numeração sem a marca** (10/09): o dono pediu "3º Rafael, 4º Alexandre" e a Unimed liberou o
  Alexandre primeiro, porque sem `ajudaOrdemInformada` a cauda se ordena pelo rodapé do hospital
  de ORIGEM (regra de 27/08) e o Rafael veio do consultório, sem origem. Publicação sem numeração
  NÃO leva a marca — a lista que a Vision monta sai na ordem da imagem e não é ordem de ninguém.
- **Troca do recado sem `apenasRegistro`** vira DECLARAÇÃO PENDENTE: badge outline
  (`LiberacoesView.jsx`) e a convergência da próxima importação EXECUTA um swap que ninguém pediu,
  desfazendo a troca real (`escalaPublicacaoDecisoes.js`: `paresDeclarados` ignora registro de
  propósito). Desde a reforma de 07/08 as 40 trocas em produção são registro; o modo que executa é
  do TrocaSheet, com um toque na fila. Conserto sem republicar: `rpc_escala_patch_liberacao`.
- **Azul emprestado** (15/09: MAURICIO azul fechando o rodapé da Unimed e "SIMONE | MAURICIO" azul
  no HRO): o script realoca sozinho ("azul emprestado: sai da ajuda do unimed e entra na ajuda do
  hro"); ele mantém a posição no rodapé da Unimed e não vira aviso de cauda.
- **Linha "MATERNO | 04 PROCEDIMENTOS | NOME" da folha do HRO** é caso do HRO (pseudo-sala que
  registra onde a pessoa está; a equipe publica assim desde 27/08). O `local` da troca chega ao
  badge também por esse caminho (headless corrigido 14/09).
- **"02 ANEST" amarelo sem 2º nome** (Hemodinâmica da Unimed, 15/09): nota no `procedimento`, "//"
  herdando o de cima; a dupla é decisão do dono pelo app.
- **Data do HRO**: 08/09 dizia 04/09 e era de 08/09 — a continuação das cirurgias da manhã provou.
- **Falha de rede na publicação** (2× em 11/09): a RPC roda `begin … commit` numa chamada só, então
  ou gravou tudo ou nada; `publicacao_turnos->'<turno>'->>'casos'` nulo = pode repetir.
- **Reparo de escala em uso**: republicar zera as liberações do turno (casos manuais e andamento da
  cirurgia igual ficam, migration `20260923160000_escala_republicar_preserva_andamento`); o modelo
  de conserto linha a linha é `scripts/repair-escala-2026-09-08-matutino-leitura.sql`.

## Fim de semana — incidentes

- 24/08 (feriado): a ordem foi invertida à mão E pelo script → fila ao contrário. A inversão é
  UMA, em `rodapeDeOrdemDoc`.
- 15/08 (migration `20260815223000`) e 29/08: a retaguarda que a linha da tarde omite (P1, P2)
  entra no fim do rodapé — o script faz (`completarRodapeFds`); a tela não fez em 05/09.
- 12/09: três cirurgias "AS" da tarde caíram na manhã no 1º ensaio por falta da faixa por linha —
  daí `turno` carimbado por linha (`Mapa.vesp()`).
- 12/09: KLISMAN roxo no domingo = P3 do LEANDRO (troca pessoal); o Pega Plantão tinha KLISMAN no
  bloco do sábado e o documento tinha LEANDRO — o documento manda.
- 22/08: o bloco do domingo sem linha de liberação publica pela sugestão ("sugerida").
- 05/09 (dono): "nos finais de semana não existe a opção de ajuda… nunca marque ajuda de forma
  automática". 04/09: P1–P4 é um bloco cuja ordem só a foto decide. 29/08: sala sem nome recebe o
  posto só na manhã de sábado. 16/08: noite = grade 19-07 + sáb P11,P8,P7 · dom P11,P6,P5.

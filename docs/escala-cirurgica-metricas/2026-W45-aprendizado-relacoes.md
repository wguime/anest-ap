# Escala Cirúrgica — todas as relações da escalação · 2026-W45, 2ª rodada (até 08/11)

> Pedido do dono (09/11): aprender *"a maneira como os anestesistas são escalados, com quem, por que
> com determinados cirurgiões e conjuntos de cirurgias"* e *"relacionar a ordem de liberação do rodapé
> com a quantidade e o tempo de cirurgia"*, para enviar **mapa + rodapé** e receber a escalação sugerida,
> que um anestesista confere antes de publicar. Continuação de `2026-W45-aprendizado.md`.
> Base: produção, só leitura, 22/07–08/11/2026, dia útil. Scripts: `2026-W45-aprendizado-scripts/`
> (`blocos.mjs`, `f_relacoes.mjs`, `g_simulador.mjs`); exports no fim de `2026-W45-aprendizado-queries.sql`.
> **Medido** = saiu dos scripts. **Inferido** está marcado.

## Resposta curta

- **A posição no rodapé decide a carga, em escada com degraus** — e é quase só isso que os dados
  explicam. Quem sai cedo recebe menos e termina antes; o último (contraturno) quase nunca recebe
  bloco; o plantonista recebe a carga mais longa.
- **Afinidade existe, mas é pequena e é de LOCAL, não de cirurgião.** 26 preferências e 6 exclusões
  com evidência forte (Umanitá, Exames do HRO, Consultório, SRPA, plástica, mastologia, pediatria).
  Com cirurgião, 3 pares em 164 cirurgiões.
- **Não há equalização de carga** ao longo dos dias, nem pares fixos de troca.
- **As trocas do dia são repasse para liberar na ordem**: 98% acontecem com o turno em curso e 68%
  vão para quem sai depois.
- **O simulador novo empata com o coordenador na ordem e não reproduz a escolha dele**: 24% de pares
  invertidos contra 23% do plano publicado (acaso: 40%); mesma pessoa no mesmo bloco em 13% (acaso: 7%).
- Conclusão: dá para sugerir uma escalação **boa pela ordem**; não dá para adivinhar a escolha
  pessoal do coordenador. O que falta para isso não está no banco — está nas 12 perguntas do fim e no
  registro do que o conferente muda.

## 1. Unidade de análise: o bloco

Bloco = sala × anestesista dentro do turno, tirado do plano **como publicado** (captura
`alocacao` com `detalhe.publicacao`, última publicação antes do início do turno). Antes de 28/09
não há captura: o plano é reconstruído do caso final, sem os acrescentados à mão.

| | Medido |
|---|---|
| Turnos com rodapé | 315 (Unimed 144, HRO 144, Materno 27) |
| Plano publicado capturado × reconstruído | 136 × 179 |
| Blocos (Unimed + HRO) | 4.892; mediana de 17 por turno |
| Cirurgias por bloco | mediana 1 (p75 = 2) |
| Posições sem cirurgia (SRPA, consultório) | 261 |
| Blocos sem anestesista no mapa | 183 |
| Blocos em dupla "A + B" | 20 |
| Com soma do tempo do mapa | 32% (só Unimed) |
| Com fim real · com minutos reais limpos | 1.038 · 692 |
| Pediátrico · urgência · atravessa o turno | 6% · 1% · 6% |
| Cirurgião identificado · especialidade identificada | 93% · 82% |
| Pessoa do rodapé: sem bloco · 1 bloco · 2 ou mais | 16% · 73% · 11% |

Limites: a especialidade é deduzida do texto do procedimento por expressão regular; o cirurgião usa
o agrupamento automático de grafias (nomes com "?" são primeiros nomes com mais de um dono). O
Materno tem rodapé em poucos dias e ficou fora das relações.

## 2. As relações

### 2.1 Posição no rodapé × carga — escada com degraus

Mediana de quem tem bloco (minutos previstos pelo modelo de duração; fim real só desde 05/10):

| Degrau | Unimed manhã | Unimed tarde | HRO manhã | HRO tarde |
|---|---|---|---|---|
| Último (contraturno): fica sem bloco | 85% | 91% | 78% | 93% |
| Sai cedo (1º quarto): sem bloco | 31% | 34% | 29% | 40% |
| Sai cedo: minutos · fim real | 184 · 11:00 | 75 · 15:36 | 124 · 09:57 | 120 · 16:04 |
| 2º quarto | 210 · 11:41 | 186 · 17:00 | 186 · 11:23 | 168 · 16:27 |
| 3º quarto | 240 · 12:04 | 230 · 17:48 | 235 · 11:49 | 203 · 17:44 |
| Sai tarde (4º quarto) | 259 · 13:12 | 256 · 18:28 | 245 · 12:30 | 236 · 18:15 |
| 2º do rodapé | **66 · 09:01** | 272 · 19:08 | 295 · 12:10 | 254 · 18:41 |
| Plantonista (1º) | 251 · 11:34 | 291 · 19:43 | 235 · 12:42 | 255 · 16:34 |
| Fora do rodapé (ajuda) | 183 · 11:21 | 100 · 16:23 | 106 · 09:44 | 134 · 15:00 |

- **É escada no meio da fila** (ρ saída × fim real = 0,60 em 86 turnos, 83 positivos, tirando os degraus).
- **Degraus:** o último quase nunca recebe; o primeiro quarto fica sem bloco em um terço das vezes;
  o plantonista recebe carga de quem sai tarde; **o 2º do rodapé da Unimed de manhã recebe bloco curto**
  (66 min, termina às 9h) — no HRO o 2º recebe o mais longo. Inferido: é o pós-plantão da Unimed.
- **O plantonista do HRO fica com a Sala 4 ou a Sala 5 em 129 de 144 turnos (90%)** — Sala 4 é 46% dos
  blocos dele, Sala 5 27%, Sala 7 11%. Na Unimed não há sala dominante (a mais frequente, CC Sala 1, 23%).
- **Manhã da Unimed é a exceção:** a ordem quase não acompanha a carga (ρ 0,08 com nº de cirurgias,
  0,23 com fim real). Tarde da Unimed é a mais alinhada (0,67; 22 de 22 turnos).

ρ de Spearman por turno (mediana; turnos; positivos/negativos):

| | Nº de cirurgias | Minutos previstos | Soma do mapa | Fim previsto | Fim real |
|---|---|---|---|---|---|
| Todos | 0,28 (287; 240/46) | 0,41 (256/31) | 0,40 (141; 125/15) | 0,33 (243/43) | 0,49 (89; 78/10) |
| Unimed manhã | 0,08 | 0,20 | 0,29 | 0,17 | 0,23 (23) |
| Unimed tarde | 0,27 | 0,60 | 0,68 | 0,62 | 0,67 (22) |
| HRO manhã | 0,33 | 0,41 | — | 0,30 | 0,48 (23) |
| HRO tarde | 0,44 | 0,49 | — | 0,45 | 0,51 (21) |

A ordem acompanha **minutos**, não quantidade de cirurgias. (Na 1ª rodada o ρ de 0,74 usava a
alocação final; aqui é o plano publicado, por isso é menor.)

### 2.2 Anestesista × cirurgião, especialidade, sala, local, pediatria

Teste: 1.000 permutações dos donos entre os blocos do mesmo turno, e de novo só entre donos da
**mesma faixa de saída** (terços) — a segunda responde "dois candidatos na mesma faixa: quem pega o quê?".

| Dimensão | Concentração global (z, mesma faixa) | Preferências achadas | Exclusões achadas |
|---|---|---|---|
| Sala | 9,6 | 11 | 6 |
| Especialidade | 6,5 | 2 (+2 no limiar) | 0 de 253 testadas |
| Local | 6,1 | 9 | 3 |
| Cirurgião | 4,7 | 3 | 0 (nenhum par com oportunidade suficiente) |
| Pediatria | 3,6 | 1 | 0 de 28 |

- A 1ª rodada disse "sem afinidade" olhando a média; **o dono tinha razão em parte**: a afinidade é
  real (z de 4,7 a 9,6), mas concentrada em poucos pares e em locais, não em cirurgiões.
- **Vale fora da amostra:** preferências aprendidas até 18/10 repetiram-se de 19/10 a 06/11 a 1,9× o
  acaso (sala: 15 observados × 7,8 esperados; local: 12 × 6,3). As 3 exclusões aprendidas até 18/10
  tiveram 0 ocorrências depois (2,4 esperadas).
- **Ninguém é dono de uma especialidade.** Toda especialidade com 40+ blocos foi feita por 25 a 47 das
  47 pessoas; 80% dos blocos se espalham por 15 a 31 pessoas. Cardíaca: 25 pessoas em 40 blocos.
- Anestesista × hospital: 8 pessoas têm 18–31% dos turnos na Unimed (a mediana do grupo é 55%). Vem do
  rodapé, que agora é entrada; não entra no simulador.

**Tabela (b) — preferências e exclusões aprendidas** (todos os turnos; nulo por faixa de saída):

| Anestesista | Com o quê | Observado × esperado | Turnos juntos | Tipo |
|---|---|---|---|---|
| A40 | Endoscopia (especialidade) | 39 × 18,3 | 100 | preferência |
| A40 | Exames do HRO | 16 × 4,8 | 48 | preferência |
| A40 | IOSC (HRO) | **0 × 6,3** | 48 | exclusão |
| A35 | Plástica | 20 × 7,2 | 56 | preferência |
| A35 | Umanitá | 9 × 3,0 | 18 | preferência |
| A23 | Umanitá | 13 × 5,0 | 23 | preferência |
| A06 | Umanitá | 10 × 3,4 | 21 | preferência |
| A38 | Umanitá | 10 × 3,7 | 24 | preferência |
| A26 | Umanitá | **1 × 8,5** | 46 | exclusão |
| A27 | Umanitá | **0 × 5,2** | 38 | exclusão |
| A26 | SRPA da Unimed | 18 × 6,5 | 54 | preferência |
| A13 | Centro obstétrico da Unimed | 11 × 4,6 | 38 | preferência |
| A34 | IOSC (HRO) | 14 × 6,9 | 45 | preferência |
| A25 | Mastologia | 11 × 4,8 | 42 | preferência |
| A30 | Pediátrico | 16 × 7,8 | 56 | preferência |
| A06 | Cirurgia geral | 12 × 6,0 | 66 | preferência |
| A37 | Consultório (HRO) | 11 × 3,0 | 31 | preferência |
| A47 | Consultório (HRO) | 10 × 2,9 | 29 | preferência |
| A02 | Consultório (HRO) | 10 × 3,8 | 34 | preferência |
| A25 · A35 · A23 | Consultório (HRO) | **0 × 6,1 · 5,7 · 5,7** | 61 · 74 · 61 | exclusão |
| A23 | cirurgião "C477" (Unimed) | 6 × 1,3 | 12 | preferência (grafia ambígua) |
| A35 | cirurgião "C537" (Unimed) | 8 × 2,2 | 18 | preferência (grafia ambígua) |
| A35 | C298 (HRO) | 7 × 2,4 | 21 | preferência |

Todas com p ≤ 0,002 (preferência) ou ≤ 0,005 (exclusão). Falsos positivos esperados no conjunto: ~2.
Inferido: as linhas de Consultório vêm da numérica (verde), não de escolha — pergunta 9.

### 2.3 Anestesista × anestesista

- Dupla "A + B": 20 blocos em 3,5 meses, nenhuma dupla repetida. Não há par fixo.
- Depois da publicação: 493 pares distintos de "quem passa → quem recebe"; só 13 repetem em 3+ turnos
  (o mais frequente, 5 turnos). **Não há dupla de cobertura.**

### 2.4 Residente

Registrado em 57 casos (0,6%). Não dá para medir relação nenhuma.

### 2.5 Carga

- Minutos previstos por pessoa-turno: mediana 175; p25 60; p75 254; p90 335; zero em 20%.
- **Não há equalização.** Quem recebeu mais que o degrau explica ontem tende a receber mais hoje
  (ρ = +0,10; n = 2.417), não menos. Contra a média dos 5 dias anteriores: +0,13.
- A desigualdade de minutos dentro do turno (Gini 0,30) é igual à de repartir os blocos ao acaso (0,31).
- Quem foi plantonista do rodapé na véspera recebe 9 ± 5 min a menos: efeito fraco.
- Efeito por pessoa além do degrau (40+ turnos): só 2 de 46 se destacam — A33 (−121 ± 12
  min) e A36 (−39 ± 13). Inferido: A33 aparece no rodapé com a nota "(CONSULT)".

### 2.6 O que as trocas do dia ensinam (28/09–08/11)

| | Medido |
|---|---|
| Movimentos | 1.040: 889 de A para B, 133 preenchem caso sem anestesista, 15 esvaziam |
| Quando | 876 com o turno em curso; 13 antes de começar |
| Estado da cirurgia | 550 agendadas, 329 iniciadas, 10 terminadas |
| Troca simétrica (um pelo outro) | 15 (2%) — o resto é repasse de mão única |
| Direção (os dois no rodapé, n = 686) | **68% vão para quem sai DEPOIS**; mediana de 13 pontos da fila |
| Um dos dois fora do rodapé | 203 |
| Quem passou foi liberado em seguida | 490 de 686; 235 em até 30 min |
| Carga de quem recebe × de quem passa (no plano) | igual (mediana 0) |
| Blocos com dono final ≠ publicado | 267 de 1.680 (16%) |

Leitura: a troca não corrige carga nem segue pares; **é a fila andando** — quem está para sair entrega
a cirurgia que não começou a quem fica. O erro do plano que ela revela é um só: bloco que termina
tarde na mão de quem sai cedo.

### 2.7 Dia da semana e mudança no tempo

- Dia da semana: sem diferença relevante (16–17 blocos por turno; ρ saída × fim previsto de 0,25 a 0,45).
- Julho → novembro: a escada é a mesma (ρ 0,34 → 0,33). Caíram as ajudas por turno (1,6 → 0,2) e as
  pessoas com 2+ blocos (18% → 7%); parte dessa queda é a troca de fonte (final → publicado) em 28/09.

## 3. O modelo de decisão em três camadas

**(a) Regras duras — já estão no código, não reaprender**

| Regra | Onde |
|---|---|
| Quem trabalha e a ordem de saída (numérica, férias, pós-plantão, A29, feriado, FDS) | `escalaNumerica.js`, `posPlantao.js` — e agora é ENTRADA |
| Último do rodapé = plantão do turno seguinte, sai primeiro | `colunaLiberacao.js` |
| Azul = ajuda; 1º não-azul = plantonista | `colunaLiberacao.js` |
| Consultório/sobreaviso na nota do rodapé ocupa a posição | `colunaLiberacao.js` |
| Dupla só com "+" no mapa; "A / B" é um ou outro | rule `escala-visao-geral` |
| Continuação herda o caso da manhã | `escalaHorarioPendente.js` |

**(b) Aprendido com evidência forte** — a tabela de 2.2, mais três degraus de posição:
último quase nunca recebe bloco (78–93%, n = 288); plantonista do HRO com Sala 4 ou 5 (129 de 144
turnos); 2º do rodapé da Unimed de manhã com bloco curto (n = 74).

**(c) Critério para o resto:** quem sai antes recebe o bloco que termina antes (minutos, não nº de
cirurgias), minimizando pares invertidos. Equilíbrio de carga **não** entra: os dados não mostram que
o coordenador o persiga.

## 4. Simulador novo

Entrada: blocos do mapa (sem nomes) + rodapé. Saída: bloco → pessoa, por atribuição ótima. Aprende
até 18/10 (234 turnos; pesos ajustados em 28/09–18/10); teste em 19/10–06/11 (54 turnos, 848 blocos).

| Versão | Mesma pessoa que o publicado | Mesma faixa (±1 posição) | Acerta quem fica sem bloco | Pares invertidos > 30 min | Violações |
|---|---|---|---|---|---|
| Acaso | 7% | 19% | — | 40% | — |
| (c) escada linear | 10% | 24% | 80% | **24%** | 1 |
| (c) escada com degraus | 7% | 26% | 93% | 28% | 1 |
| (c) + papel × sala | 11% | 28% | 91% | 28% | 1 |
| (a)+(b)+(c) completo | **13%** | 28% | 89% | 29% | 0 |
| Publicado pelo coordenador | — | — | — | 23% | 0 |
| Final, depois das trocas | 81% igual ao publicado | — | — | 22% | — |

- **Acerta:** quem fica sem bloco (93%), a faixa de quem sai (mediana de 3 posições de distância do
  publicado; 52% a até 3), SRPA (41%), plantonista e 2º do rodapé (22%).
- **Erra:** a pessoa exata (13%; por turno, de 0% a 36%). No meio da fila acerta 9%.
- **Por quê:** com ~16 pessoas e 17 blocos há dezenas de escalações equivalentes pela ordem, e o que
  faz o coordenador escolher uma delas não está gravado. As afinidades são reais mas cobrem poucos blocos.
- **Tensão medida:** ajustar o simulador para imitar o coordenador piora a ordem (24% → 29%). A escada
  pura fica a 1 ponto do plano publicado.
- Na 1ª rodada os números eram 20,8% × 24,9%; aqui a conta inclui todos os blocos e quem recebe dois,
  por isso os percentuais não são comparáveis entre os dois relatórios — só dentro de cada tabela.
- O simulador recebe os blocos já desenhados pelo coordenador (sala × pessoa). Num mapa cru, sala com
  dois anestesistas (IOSC, Exames) ainda precisa ser repartida.

**Três turnos lado a lado** (número = ordem de saída; 1 sai primeiro). Melhor, mediano e pior do teste:

*27/10, Unimed, tarde — 36% igual*

| Bloco | Cirurgias | Fim previsto · real | Publicado | Sugerido |
|---|---|---|---|---|
| Umanitá | 1 | 14:00 · 13:00 | A09 (10) | A44 (4) |
| CC Sala 6 | 1 | 14:26 · 14:46 | A44 (4) | A41 (3) |
| CC Sala 4 | 2 | 14:50 · 15:28 | A41 (3) | A09 (10) |
| CC Sala 10 | 1 | 15:55 · **19:07** | A06 (14) | A06 (14) |
| CC Sala 2 | 1 | 16:15 · 15:30 | A34 (5) | A20 (8) |
| Imagem | 1 | 16:18 · 14:30 | A34 (5) | A30 (6) |
| Hemodinâmica | 2 | 16:50 · 15:57 | A22 (9) | A03 (15) |
| Exames | 1 | 17:07 · 17:23 | A40 (2) | A40 (2) |
| Exames | 1 | 17:08 · 17:23 | A16 (7) | A16 (7) |
| CC Sala 5 | 2 | 17:14 · 18:04 | A30 (6) | A22 (9) |
| CO Sala 3 | 4 | 18:02 · — | A20 (8) | A28 (12) |
| CC Sala 7 | 3 | 18:30 · 18:43 | A28 (12) | A10 (11) |
| SRPA | — | 19:00 | A38 (13) | A38 (13) |
| CC Sala 1 | 3 | 19:10 · 18:43 | A14 (16) | A14 (16) |

Sem bloco — publicado: A47 (1). Sugerido: A47 (1) e A34 (5).

*20/10, Unimed, manhã — 12% igual*

| Bloco | Cirurgias | Fim previsto · real | Publicado | Sugerido |
|---|---|---|---|---|
| Imagem | 1 | 08:44 · 09:00 | A31 (5) | A39 (4) |
| Imagem | 1 | 08:48 · 10:50 | A39 (4) | A36 (14) |
| CC Sala 1 | 1 | 09:00 · 09:00 | A26 (17) | A19 (2) |
| CO Sala 3 | 2 | 09:26 · 10:50 | A42 (3) | A13 (9) |
| CC Sala 4 | 3 | 10:22 · 10:38 | A27 (12) | A04 (8) |
| CC Sala 7 | 2 | 10:30 · **13:35** | A04 (8) | A01 (6) |
| CC Sala 6 | 2 | 11:00 · 11:22 | A05 (13) | A17 (11) |
| CO Cesárea | 3 | 11:24 · — | A13 (9) | A42 (3) |
| CC Sala 5 | 1 | 12:15 · 11:20 | A32 (18) | A34 (7) |
| CC Sala 3 | 2 | 12:20 · 11:34 | A17 (11) | A05 (13) |
| CC Sala 10 | 1 | 12:30 · 12:10 | A28 (16) | A32 (18) |
| CC Sala 2 | 4 | 12:56 · 12:45 | A24 (10) | A27 (12) |
| SRPA | — | 13:00 | A26 (17) | A26 (17) |
| Exames | 2 | 13:05 · 11:31 | A34 (7) | A24 (10) |
| Hemodinâmica | 5 | 13:50 · 13:44 | A14 (15) | A14 (15) |
| Imagem | 2 | 14:08 · 14:25 | A36 (14) | A28 (16) |

Sem bloco — publicado: A07 (1) e A19 (2). Sugerido: A07 (1).
Repare: o coordenador pôs o 2º a sair numa cesárea e o 17º numa sala de uma cirurgia; o simulador
não faria nenhum dos dois, e não sabe por quê foram feitos.

*19/10, Unimed, tarde — 0% igual*

| Bloco | Cirurgias | Fim previsto · real | Publicado | Sugerido |
|---|---|---|---|---|
| Imagem | 1 | 14:14 · 16:04 | A33 (2) | A28 (3) |
| Accurata | 1 | 14:44 · 17:09 | A34 (8) | A47 (5) |
| CC Sala 3 | 2 | 16:18 · — | A07 (17) | A22 (10) |
| CO Sala 3 | 2 | 16:18 · — | A47 (5) | A34 (8) |
| CC Sala 1 | 2 | 16:20 · 17:00 | A21 (6) | A07 (17) |
| CC Sala 10 | 2 | 16:35 · 17:37 | A30 (9) | A29 (15) |
| Exames | 1 | 17:04 · 17:36 | A30 (9) | A04 (7) |
| CC Sala 5 | 4 | 17:20 · 16:59 | A04 (7) | A12 (11) |
| Exames | 1 | 17:33 · 16:01 | A33 (2) | A30 (9) |
| SRPA | — | 19:00 | A10 (14) | A46 (12) |
| CC Sala 6 | 2 | 19:05 · — | A46 (12) | A10 (14) |
| CC Sala 2 | 4 | 19:56 · — | A29 (15) | A19 (16) |
| CC Sala 4 | 3 | 21:42 · — | A12 (11) | A09 (13) |

Sem bloco — publicado: A03 (1), A22 (10). Sugerido: A03 (1),
A33 (2), A14 (4), A21 (6). Aqui o simulador deixou quatro pessoas
livres e deu dois blocos a quem sai tarde; o coordenador deu dois blocos curtos a quem sai cedo.

## 5. Como o aprendizado evolui

| O que gravar | Formato | Por que |
|---|---|---|
| Retrato da conferência (grade esperada, férias, pós-plantão, divergências) | tipo `conferencia` em `escala_cirurgica_captura` | reconstruir o dia sem o Pega Plantão |
| Dicionário de cirurgiões | `escala_cirurgiao` + `escala_cirurgiao_alias` | 65 grupos ambíguos; afinidade com cirurgião hoje é ilegível |
| **Sugestão × o que o conferente mudou × motivo em um toque** | `escala_cirurgica_sugestao` + `_ajuste` | é o dado de treino que não existe; o aceite também grava |
| Restrições confirmadas pelo dono | `escala_cirurgica_restricao` | exclusão aprendida só vira regra dura com a resposta dele |

- Rascunho, sem aplicar: `2026-W45-aprendizado-rascunho-migration.sql`. Nada vai para
  `escala_cirurgica_evento`. Leitura só admin. Retenção proposta: 24 meses, com linha em
  `docs/lgpd-retencao.md` (a da captura atual segue pendente desde 25/09).
- Placar semanal: `g_simulador.mjs` sobre os exports da semana, promovido a
  `scripts/escala-aprendizado-placar.mjs`, rodado no modo `relatorio` da skill `/escala-cirurgica`.
- **Critério para ligar a sugestão na conferência**, em 4 semanas seguidas de teste:
  1. pares invertidos ≤ os do plano publicado (hoje 24% × 23%);
  2. zero violação de restrição confirmada pelo dono;
  3. acerto de quem fica sem bloco ≥ 90% (hoje 93% na versão com degraus);
  4. erro de duração < 25 min nos pares limpos (hoje 27–28).
- Depois de ligada, a meta passa a ser a **taxa de aceitação** do conferente por bloco; os motivos de
  recusa mais frequentes viram regra ou peso.
- Antes de qualquer tela: protótipo HTML (Regra #3). Sugestão só na conferência, rotulada; nada na
  pílula do caso; sem notificação.

## 6. Perguntas para o dono

Da que mais muda o resultado para a que menos muda.

1. **O que é "a melhor forma"?** O simulador que segue só a ordem empata com o plano publicado (24% ×
   23% de pares invertidos), mas escolhe a mesma pessoa em 10% dos blocos.
   → Sair na ordem, e o conferente ajusta o resto · Sair na ordem e equilibrar minutos · Parecer com o que eu faria.
2. **Quando sobram blocos, quem pega dois?** 11% das pessoas recebem 2+ blocos; em 19/10 à tarde o
   2º a sair pegou Imagem + Exames.
   → Quem sai cedo, dois curtos · Quem sai tarde · Quem estiver mais perto (mesmo setor) · Depende do dia.
3. **Quem fica sem bloco quando sobra gente?** O último do rodapé fica sem em 78–93% dos turnos; o
   primeiro quarto, em um terço.
   → Sempre os primeiros a sair · O último, depois os primeiros · Quem pediu · Não há regra.
4. **O 2º do rodapé de manhã na Unimed recebe bloco curto (mediana 66 min, termina às 9h, 74 turnos).
   É o pós-plantão?**
   → Sim, sempre o bloco mais curto · Sim, mas só se houver · Coincidência.
5. **O plantonista do HRO ficou com a Sala 4 ou a Sala 5 em 129 de 144 turnos. É regra?**
   → Sim, a emergência é dele · Preferência, não regra · Coincidência.
6. **O plantonista recebe carga longa (235–291 min). Devo dar a ele o bloco que termina por último?**
   → Sim · Não, bloco médio para ficar disponível · Só a emergência e a SRPA.
7. **Nas trocas do dia, 68% das cirurgias vão para quem sai depois. A sugestão deve evitar isso já na
   publicação, mesmo deixando quem sai cedo com menos?**
   → Sim, é o objetivo · Em parte, sem deixar ninguém ocioso · Não, a troca do dia resolve.
8. **A40 fez 39 blocos de endoscopia (esperado: 18) e nenhum no IOSC em 48 turnos
   (esperado: 6). É regra?**
   → Sim, priorizar exames e não escalar no IOSC · Só a preferência · Coincidência.
9. **Umanitá: A35, A06, A38 e A23 vão 3× mais que o acaso; A26 foi 1
   vez em 46 turnos e A27 nenhuma em 38. É credenciamento?**
   → Sim, só alguns podem · Preferência · Coincidência.
10. **O consultório é escolha ou já vem definido?** No HRO, A37, A47 e A02
    aparecem 3× mais; A25, A35 e A23 nunca.
    → Já vem no rodapé, não é para sugerir · É escolha, com essas pessoas · É escolha, sem restrição.
11. **A35 com plástica (20 × 7), A25 com mastologia (11 × 5), A30 com pediatria
    (16 × 8). Manter?**
    → Sim, priorizar · Só desempate · Ignorar.
12. **Não achei cirurgião com anestesista fixo (3 pares em 164 cirurgiões). Existe algum que eu devo
    respeitar?**
    → Nenhum · Poucos, eu listo · Vários, eu listo.

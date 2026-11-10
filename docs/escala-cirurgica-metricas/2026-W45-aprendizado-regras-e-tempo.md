# Escala Cirúrgica — regras do dono, modelo de tempo e aprendizado contínuo · 2026-W45, 3ª rodada

> O dono respondeu as 12 perguntas da 2ª rodada em 09/11/2026. Este relatório registra as respostas como
> regras, mede o TEMPO que a escalação precisa, refaz o simulador com as regras e deixa o ciclo semanal
> rodando. Continuação de `2026-W45-aprendizado-relacoes.md`. Base: produção, só leitura, 22/07–08/11.
> Scripts em `2026-W45-aprendizado-scripts/`: `tempo.mjs`, `h_tempo.mjs`, `i_simulador_v3.mjs`,
> `ciclo-semanal.mjs`. Nesta rodada não houve consulta nova ao banco: tudo saiu dos exports da 2ª.
> **Medido** = saiu dos scripts. **Inferido** está marcado.

## Resposta curta

- As regras do dono estão em `regras-escalacao.json` e o simulador as lê. Com elas a sugestão não viola
  regra dura nenhuma e acerta quem fica sem bloco em 94% — mas **não melhorou na ordem de saída**:
  26,1% de pares invertidos, contra 23,2% do plano publicado.
- **O que separa a sugestão do objetivo é só o tempo.** Se o fim real de cada bloco fosse conhecido,
  a mesma regra de ordem daria **0% de pares invertidos**. Com a previsão de hoje dá 25%.
- A duração de UMA cirurgia já se prevê razoavelmente (erro de 27,5 min; 17,5 quando há histórico do
  cirurgião naquele procedimento). O **fim do BLOCO** erra **60 min**, porque soma a duração, o atraso
  do primeiro caso e o giro de sala.
- O giro de sala, medido pela primeira vez: **30 min na Unimed, 40 no HRO**; 10 a 12 min a mais
  quando muda o cirurgião. O primeiro caso atrasa **15 min na Unimed e 30 no HRO**.
- O ciclo semanal roda com um comando e regrava as tabelas de tempo e o placar.

## A. Regras do dono (09/11/2026)

Arquivo: `regras-escalacao.json` (o simulador lê dele). Neste repositório as pessoas aparecem por código
(A = anestesista, C = cirurgião, R = residente); a versão com nomes fica em `.local/escala-aprendizado/com-nomes/`. Em português simples:

| Regra | Tipo |
|---|---|
| A melhor escalação é a que respeita a **ordem de saída**: mais tempo para quem sai depois, menos para quem vai embora antes. O resto o conferente ajusta. | objetivo |
| Quando sobra gente, fica sem bloco o **último do rodapé**; depois, quem sai mais cedo. | dura |
| O **pós-plantão** (2º do rodapé, Unimed, manhã) recebe sempre o bloco mais curto. | dura |
| O **plantonista** recebe o bloco que termina por último. | dura |
| No HRO o plantonista fica, de preferência, em **ortopedia e/ou urgência** (hoje Salas 4 e 5; a regra é o tipo de cirurgia, não o número). | preferência |
| Quando sobram blocos, quem recebe dois é decidido pelo **tempo**: curtos para quem sai antes, longos para quem sai depois. | dura |
| **Consultório só para cooperado da Unimed.** | dura |
| **A40**: priorizar para endoscopia/exames; nunca no IOSC. | dura + preferência |
| Não tentar evitar na publicação as trocas do dia. | objetivo |
| Não existe cirurgião com anestesista fixo. Há anestesistas que não devem ser escalados com certos cirurgiões ou locais — a lista vem do dono. | estrutura pronta, vazia |

**Descartado pelo dono — não reaprender:** Umanitá (preferências e exclusões: coincidência); A35
× plástica, A25 × mastologia, A30 × pediatria, A06 × cirurgia geral (ignorar); pares
anestesista × cirurgião.

**Aprendido e ainda sem resposta:** SRPA da Unimed (ver pergunta 2); A13 × centro obstétrico
(11 × 4,6); A34 × IOSC (14 × 6,9).

**Regra declarada × o que os planos publicados mostram** (todos os turnos):

| Regra | Praticada em |
|---|---|
| Último do rodapé sem bloco | 249 de 287 turnos (87%) |
| Plantonista do HRO em ortopedia/urgência | 90 de 142 (63%) |
| Pós-plantão com o bloco mais curto ou o 2º mais curto | 33 de 70 (47%); na mediana, o bloco dele está nos 12% mais curtos |
| Plantonista com o bloco que termina por último ou penúltimo | 79 de 281 pelo fim previsto (28%); 19 de 57 pelo fim real (33%); na mediana, o bloco dele está em 77% da fila |
| Consultório com quem nunca tinha ido | 1 vez no teste |

As duas últimas linhas viraram as perguntas 3 e 4.

**Consultório — lista provável de cooperados:** fora do repositório. O histórico separa 22 pessoas que
já estiveram no consultório 2+ vezes, 10 que estiveram uma vez só e 14 que nunca estiveram em 3 meses
(13 delas com a vez na numérica, em verde, de 3 a 6 dias). A lista nominal, **não confirmada**, está só em
`.local/escala-aprendizado/com-nomes/`. Não é regra: o dono vai enviar a lista de cooperados.

## B. O modelo de tempo

### B1. Duração de uma cirurgia, por nível

Teste fora da amostra, 19/10–08/11, 1.347 pares limpos; cada semana prevista só com as anteriores
(573 pares de treino na primeira).

| Nível usado (o primeiro que tiver 3+ casos) | Cobertura | Erro mediano | Até 30 min |
|---|---|---|---|
| Cirurgião × procedimento | 18% | **17,5 min** | 66% |
| Procedimento × hospital | 37% | 23 | 61% |
| Procedimento | 11% | 33 | 47% |
| Cirurgião | 14% | 35,5 | 43% |
| Hospital | 18% | 45 | 38% |
| **Cascata inteira** | 100% | **27,5** | 53% |
| Tempo do mapa, onde existe (522 casos, só Unimed) | — | 20 (cascata nos mesmos casos: 20,5) | — |

- Com 5–9 casos do par cirurgião × procedimento o erro cai para 15 min (n = 96).
- Hoje existem 173 pares cirurgião × procedimento com 3+ casos e 66 com 5+. Em 5 semanas de hora real.
  Esse número cresce sozinho a cada semana publicada — é o aprendizado contínuo que o dono pediu.
- 18% das cirurgias ainda caem no nível "hospital": procedimento e cirurgião nunca vistos, ou grafia
  que não casou.

### B2. Giro de sala (fim real de uma → início real da seguinte)

Medido pela primeira vez. Salas de centro cirúrgico e obstétrico, pares limpos desde 02/10:
968 sequências; 11% sobrepostas (horário digitado errado) e 19% acima de 120 min (sala parada) ficaram
fora; 676 válidas.

| | Mediana | Faixa central (p25–p75) | n |
|---|---|---|---|
| Unimed | **30 min** | 19–50 | 356 |
| HRO | **40 min** | 21–66 | 249 |
| Materno | 19 min | 5–30 | 71 |
| Unimed, mesmo cirurgião × cirurgião diferente | 29 × 40,5 | | 224 × 132 |
| HRO, mesmo cirurgião × cirurgião diferente | 39 × 51,5 | | 149 × 100 |
| Mesmo anestesista nas duas × anestesista diferente | 30 × 53,5 | | 492 × 184 |
| Manhã × tarde | 30 × 39 | | 355 × 321 |

- Por sala: Unimed 30–40 min em todas; HRO de 33 (Sala 4) a 53 (Sala 9).
- Por cirurgião (10+ sequências dele): só 9 têm amostra. De 10 min (C273, Materno) a 39,5
  (C066, Unimed).
- Em IOSC, Exames, Hemodinâmica e Imagem há salas paralelas sob o mesmo nome (49% das sequências se
  sobrepõem): **giro não é mensurável ali** com o que o mapa traz.
- Ressalva: 8% dos giros são zero (o início digitado igual ao fim da anterior).

### B3. Atraso do primeiro caso em relação à hora do mapa

| | Mediana | Faixa central | No horário ou antes | Mais de 30 min | n |
|---|---|---|---|---|---|
| Unimed manhã | 15 min | 3–25 | 24% | 12% | 190 |
| Unimed tarde | 13 min | 0–30 | 31% | 17% | 143 |
| HRO manhã | **30 min** | 20–58 | 10% | 49% | 202 |
| HRO tarde | **30 min** | 10–50 | 24% | 41% | 138 |

### B4. Fim do bloco — o que importa para a ordem

672 blocos com fim real, 19/10–08/11. A última coluna é a que decide a escalação: quanto a ORDEM
prevista dos blocos de um turno acompanha a ordem real (1 = perfeita).

| Previsão | Erro mediano do fim | Viés | Ordem prevista × real (ρ) |
|---|---|---|---|
| 2ª rodada: duração + 20 min fixos entre cirurgias | 64 min | −47 (prevê cedo demais) | 0,43 |
| + giro medido | 62,5 | −35 | 0,49 |
| + atraso do 1º caso | 59,5 | −27,5 | 0,43 |
| 3ª rodada: duração + giro + atraso | 60 | −15,5 | 0,49 |
| 3ª rodada usando o tempo do mapa onde existe | 57 | −5 | 0,55 |
| Linha do tempo da sala (a seguinte começa quando a anterior acaba) + mapa | 59,5 | −1 | **0,56** |
| Só hora + soma do tempo do mapa (Unimed, 210 blocos) | 52 | −37,5 | **0,68** |
| Só o nº de cirurgias do bloco | — | — | 0,26 |
| Estimativa da equipe (1º "tempo total" × fim real da pessoa, n = 241) | 38 | — | dada 111 min antes do fim |

- Giro e atraso **tiraram o viés** (de −47 para −1 min) mas **não reduziram o erro** (60 min).
- Unimed 45–55 min; HRO 66–71.
- O erro do bloco é o dobro do erro da cirurgia porque os três erros se somam, e porque a hora
  impressa no mapa vale pouco para a 2ª cirurgia em diante.
- A previsão do sistema acompanha a ordem real tão bem quanto a ordem que o coordenador publica
  (0,49–0,56 × 0,49). Nenhum dos dois passa disso com a informação de hoje.

## C. Simulador v3

Entrada: blocos do mapa + rodapé. Passos: consultório para quem traz "(CONSULT)" no rodapé →
plantonista com o bloco que termina por último (HRO: ortopedia/urgência) → pós-plantão com o mais curto
→ o resto pela ordem (bloco que termina antes para quem sai antes), respeitando as restrições. Sobrou
gente: sai o último, depois quem sai cedo. Sobrou bloco: junta dois que cabem em sequência, começando
pelos que acabam mais cedo. Teste: 19/10–06/11, 54 turnos, 848 blocos.

| Versão | Mesma pessoa que o publicado | ±1 posição | Com/sem bloco certo | Pares invertidos > 30 min | Sem contar o pós-plantão | Violações de regra dura |
|---|---|---|---|---|---|---|
| Acaso | 7% | 19% | — | 40,0% | — | — |
| v2 — escada linear (2ª rodada) | 10% | 24% | 80% | 24% | — | 1 |
| v2 — completo, com as afinidades | 13% | 28% | 89% | 29% | — | 0 |
| **v3 — regras do dono** | 10% | 28% | **94%** | **26,1%** | 25,0% | **0** |
| v3 + SRPA da Unimed (manhã) com o pós-plantão | 12% | 29% | 94% | 25,9% | 24,7% | 0 |
| Publicado pelo coordenador | — | — | — | 23,2% | 20,3% | 1 |
| Final, depois das trocas | 81% igual ao publicado | — | — | 21,5% | 18,5% | — |
| **v3 se o fim real de cada bloco fosse conhecido** | 11% | 31% | 94% | **3,1%** | 1,1% | 0 |
| Só a ordem, com o fim real conhecido | 11% | 31% | 94% | **0,0%** | 0,0% | 1 |

Por turno, v3 × publicado em inversões: melhor em 17, igual em 3, pior em 34.
A coluna "sem contar o pós-plantão" existe porque ele é o 2º do rodapé e termina cedo de propósito.

**Quanto veio de cada regra** (tirando uma de cada vez):

| Sem esta regra | Com/sem bloco certo | Pares invertidos | Efeito |
|---|---|---|---|
| "Último fica sem bloco" | 94% → **81%** | 26,1% | a que mais vale: +13 pontos em quem fica sem bloco |
| "Pós-plantão com o mais curto" | 94% | 26,1% → 24,8% | custa 1,3 ponto na conta bruta; 0,3 sem contar o próprio pós-plantão |
| Modelo de tempo novo | 94% | 26,1% → 26,0% | nenhum na ordem; ±1 posição cai de 28% para 26% |
| "Plantonista termina por último" | 94% | 26,2% | nenhum mensurável |
| "Plantonista do HRO em ortopedia/urgência" | 94% | 26,2% | ±1 posição: 28% → 27% |
| "Dois blocos pelo tempo" | 94% | 26,3% | +0,2 ponto |
| Consultório | 94% | 26,1% | evita 1 violação |
| Restrições do A40 | 94% | 26,1% | nenhum (ele não cairia no IOSC nesses turnos) |

Acerto da pessoa exata por regra que decidiu o bloco: plantonista 19% (n = 54), pós-plantão 21%
(n = 14), ordem 9% (n = 754), dois blocos 4% (n = 25).

**Leitura franca**

- As regras do dono deram **estrutura**, não ganho de ordem: zero violação, 94% em quem fica sem bloco.
- Na ordem, v3 fica a 3 pontos do plano publicado (26,1% × 23,2%) — igual à 2ª rodada.
- O teto não está nas regras: com o tempo certo, a regra de ordem sozinha zera as inversões. Os 25%
  são erro de previsão do fim do bloco.
- A sugestão continua não reproduzindo a escolha pessoal (10–12%), e pelas respostas do dono isso não
  é mais o objetivo.

**Os mesmos 3 turnos** (número = ordem de saída; 1 sai primeiro)

*27/10, Unimed, tarde — 21% igual (v2: 36%)*

| Bloco | Cirurgias | Fim previsto · real | Publicado | Sugerido v3 |
|---|---|---|---|---|
| Umanitá | 1 | 14:10 · 13:00 | A09 (10) | A41 (3) |
| CC Sala 6 | 1 | 14:40 · 14:46 | A44 (4) | A44 (4) |
| CC Sala 4 | 2 | 15:07 · 15:28 | A41 (3) | A34 (5) |
| CC Sala 10 | 1 | 16:10 · **19:07** | A06 (14) | A30 (6) |
| CC Sala 2 | 1 | 16:25 · 15:30 | A34 (5) | A16 (7) |
| Imagem | 1 | 16:28 · 14:30 | A34 (5) | A20 (8) |
| Hemodinâmica | 2 | 17:07 · 15:57 | A22 (9) | A22 (9) |
| Exames | 1 | 17:17 · 17:23 | A40 (2) | A09 (10) |
| Exames | 1 | 17:18 · 17:23 | A16 (7) | A10 (11) |
| CC Sala 5 | 2 | 17:24 · 18:04 | A30 (6) | A28 (12) |
| CO Sala 3 | 4 | 17:33 · — | A20 (8) | A38 (13) |
| SRPA | — | 19:00 | A38 (13) | A06 (14) |
| CC Sala 7 | 3 | 19:21 · 18:43 | A28 (12) | A03 (15) |
| CC Sala 1 | 3 | 20:50 · 18:43 | A14 (16) | A14 (16) — plantonista |

Sem bloco — publicado: A47 (1). Sugerido: A47 (1) e A40 (2).
Dois defeitos visíveis: a Sala 10 (uma cirurgia prevista para 16:10 que acabou 19:07) foi para quem
sai em 6º; e o A40 ficou sem bloco com dois Exames no mapa — a preferência dele pesa pouco contra a
ordem e a regra "quem sai cedo fica sem" o tirou antes. O coordenador fez o contrário nos dois.

*20/10, Unimed, manhã — 6% igual (v2: 12%)*

| Bloco | Cirurgias | Fim previsto · real | Publicado | Sugerido v3 |
|---|---|---|---|---|
| Imagem | 1 | 08:59 · 09:00 | A31 (5) | A19 (2) |
| Materno | 1 | 08:59 · 08:51 | A01 (6) | A42 (3) |
| Imagem | 1 | 09:03 · 10:50 | A39 (4) | A26 (17) — pós-plantão |
| CC Sala 1 | 1 | 09:15 · 09:00 | A26 (17) | A39 (4) |
| CO Sala 3 | 2 | 09:42 · 10:50 | A42 (3) | A31 (5) |
| CC Sala 6 | 2 | 12:12 · 11:22 | A05 (13) | A01 (6) |
| CC Sala 7 | 2 | 12:27 · **13:35** | A04 (8) | A34 (7) |
| CC Sala 5 | 1 | 12:30 · 11:20 | A32 (18) | A04 (8) |
| CC Sala 3 | 2 | 12:42 · 11:34 | A17 (11) | A13 (9) |
| CC Sala 10 | 1 | 12:45 · 12:10 | A28 (16) | A24 (10) |
| CO Cesárea | 3 | 12:50 · — | A13 (9) | A17 (11) |
| CC Sala 4 | 3 | 12:53 · 10:38 | A27 (12) | A27 (12) |
| SRPA | — | 13:00 | A26 (17) | A05 (13) |
| Exames | 2 | 13:40 · 11:31 | A34 (7) | A36 (14) |
| CC Sala 2 | 4 | 13:50 · 12:45 | A24 (10) | A14 (15) |
| Imagem | 2 | 14:30 · 14:25 | A36 (14) | A28 (16) |
| Hemodinâmica | 5 | 14:31 · 13:44 | A14 (15) | A32 (18) — plantonista |

Sem bloco — publicado: A07 (1) e A19 (2). Sugerido: A07 (1).
Aqui a regra do pós-plantão acertou o espírito (A26, 2º do rodapé, com um bloco de uma cirurgia) e
errou o bloco; o coordenador deu a ele a Sala 1 **e a SRPA** — é a pergunta 2. O plantonista publicado
(A32) ficou com uma sala de uma cirurgia que acabou 11:20, não com o bloco mais longo — pergunta 3.

*19/10, Unimed, tarde — 0% igual (v2: 0%)*

| Bloco | Cirurgias | Fim previsto · real | Publicado | Sugerido v3 |
|---|---|---|---|---|
| Imagem | 1 | 14:29 · 16:04 | A33 (2) | A47 (5) |
| Accurata | 1 | 14:59 · 17:09 | A34 (8) | A21 (6) |
| CC Sala 1 | 2 | 16:42 · 17:00 | A21 (6) | A04 (7) |
| CC Sala 10 | 2 | 16:57 · 17:37 | A30 (9) | A34 (8) |
| CO Sala 3 | 2 | 17:12 · — | A47 (5) | A30 (9) |
| Exames | 1 | 17:19 · 17:36 | A30 (9) | A22 (10) |
| Exames | 1 | 17:48 · 16:01 | A33 (2) | A12 (11) |
| SRPA | — | 19:00 | A10 (14) | A46 (12) |
| CC Sala 5 | 4 | 19:05 · 16:59 | A04 (7) | A09 (13) |
| CC Sala 3 | 2 | 19:12 · — | A07 (17) | A10 (14) |
| CC Sala 4 | 3 | 19:38 · — | A12 (11) | A29 (15) |
| CC Sala 6 | 2 | 19:45 · — | A46 (12) | A19 (16) |
| CC Sala 2 | 4 | 20:30 · — | A29 (15) | A07 (17) — plantonista |

Sem bloco — publicado: A03 (1), A22 (10). Sugerido: A03 (1),
A33 (2), A28 (3), A14 (4).
O mapa tinha 13 blocos para 17 pessoas. A regra "sai o último, depois quem sai cedo" deixou os quatro
primeiros livres; o coordenador deu dois blocos curtos ao 2º a sair e deixou a 10ª sem nada.

## D. Aprendizado contínuo

**O ciclo, o mais simples que funciona:** um script, uma vez por semana, que lê o banco só com SELECT
(7 consultas, uma por tabela), regrava as tabelas de tempo e o placar, e diz o que mudou.

| O que | Onde |
|---|---|
| Comando | `node docs/escala-cirurgica-metricas/2026-W45-aprendizado-scripts/ciclo-semanal.mjs --exportar` |
| Dados exportados (têm nomes) | `.local/escala-aprendizado/dados/` — fora do git |
| Tabelas de tempo | `.local/escala-aprendizado/saida/tempos.json` (5 níveis), `giro.json`, `atraso.json` |
| Placar da semana, sem nomes | `docs/escala-cirurgica-metricas/placar-semanal/AAAA-Www.md` |
| O que mudou, com nomes | `.local/escala-aprendizado/saida/placar-AAAA-Www.md` |
| Regras | `docs/escala-cirurgica-metricas/regras-escalacao.json` |

- "O que mudou" lista: cirurgião novo com 3+ cirurgias; par cirurgião × procedimento novo com 5+; mediana
  que mudou 15+ min e 20%+; procedimento cujo tempo das últimas 3 semanas difere 20+ min do histórico.
- **Como a sugestão usa a tabela mais recente:** o simulador recalcula a tabela a cada execução a
  partir dos exports; quando a sugestão for para a conferência (pela skill `/publicar-escala`), ela lê
  `tempos.json`, `giro.json` e `atraso.json` da última rodada. Para dentro do app, as tabelas
  `escala_tempo` e `escala_aprendizado_placar` estão rascunhadas em
  `2026-W45-aprendizado-rascunho-migration.sql` (não aplicadas).
- Rodei o ciclo de ponta a ponta com os exports atuais: erro de duração 27,5 min, inversões 26,1%,
  94% em quem fica sem bloco, 0 violações; placar em `placar-semanal/2026-W45.md`.
- **Não testado:** o caminho `--exportar` (as 7 consultas são as mesmas que já rodei à mão nas rodadas
  anteriores, mas a chamada pelo script não foi executada, para não repetir a leitura no banco hoje).

**Como rodar na semana que vem**

1. Fora de turno (noite ou fim de semana), na raiz do repo: o comando da tabela acima, com `--exportar`.
2. Ler as 5 linhas que ele imprime: erro de duração, inversões, com/sem bloco, violações, nº de mudanças.
3. Abrir `placar-semanal/AAAA-Www.md` e comparar com a semana anterior.
4. Se o dono mandou regra nova, acrescentar a linha em `regras-escalacao.json` e rodar de novo sem `--exportar`.
5. Para refazer uma semana passada: `--ate AAAA-MM-DD`.

**O que ainda falta gravar para o aprendizado sair do tempo e chegar à escolha** (rascunho da 2ª
rodada, inalterado): o que o conferente muda na sugestão e por quê, o dicionário de cirurgiões, o
retrato da conferência.

**Critério para ligar a sugestão na conferência** (4 semanas seguidas no placar): inversões ≤ as do
plano publicado · zero violação de regra dura · ≥ 90% em quem fica sem bloco · erro de duração < 25 min.
Hoje: 26,1% × 23,2% · 0 · 94% · 27,5.

## E. Perguntas para o dono

1. **Consultório — a lista de quem NÃO pode.** 14 pessoas nunca foram ao consultório em 3 meses, mesmo
   com a vez na numérica (lista nominal só na versão com nomes). São os não cooperados?
   → Sim, exatamente esses · Quase, eu corrijo os nomes · Não, a lista é outra, eu envio.
2. **SRPA da Unimed.** De manhã ela ficou com o 2º do rodapé em 65 de 74 turnos; à tarde, com quem
   sai tarde em 63 de 68. É regra?
   → Sim: manhã com o pós-plantão, tarde com quem sai por último · Só a da manhã · Não é regra.
3. **Plantonista.** A regra é "o bloco que termina por último", mas nos planos publicados isso
   aconteceu em 28% dos turnos (em 20/10 o plantonista ficou com uma sala de uma cirurgia). Como sugerir?
   → Sempre o que termina por último · Um dos últimos, sem ser obrigatoriamente o último · No HRO, ortopedia/urgência mesmo que termine cedo.
4. **Pós-plantão.** Depois do bloco curto ele vai embora, mesmo sendo o 2º do rodapé?
   → Sim, sai ao terminar · Fica até a ordem chegar nele · Fica na SRPA.
5. **Quando sobra gente e há blocos curtos.** Em 19/10 à tarde o sistema deixou os 4 primeiros a sair
   sem bloco; você deu dois blocos curtos ao 2º e deixou a 10ª livre. O que vale?
   → Quem sai cedo pega os curtos e quem fica livre é do meio da fila · Livre é sempre quem sai primeiro · Depende de quem pediu.
6. **Tempo estimado no mapa do HRO.** Onde o mapa traz o tempo (Unimed), a ordem prevista dos blocos
   acompanha a real em 0,68; sem ele, 0,49. O HRO não manda.
   → Vou pedir ao HRO · Não é possível · Um anestesista estima na conferência.

## F. Fecho — respostas do dono às 6 perguntas (10/11/2026)

**O que virou regra** (`regras-escalacao.json`, versão `2026-11-10.1`):

| Pergunta | Resposta do dono | No arquivo de regras |
|---|---|---|
| 1. Consultório | "Enviarei a lista em outro momento." | Regra dura mantida, com a lista **vazia** e estado "aguardando lista do dono". O sistema não sugere ninguém para consultório; ele vem do rodapé ou da numérica. A lista provável da seção A **não é regra** e saiu do JSON. |
| 2. SRPA da Unimed | "Sim, as duas, e normalmente a tarde é o 4º anestesista da escala." | Regra nova `srpa-unimed`: manhã = pós-plantão (2º do rodapé); tarde = 4º do rodapé. |
| 3. Plantonista | "HRO: ortopedia/urgência; resto: último." | HRO passou de preferência a regra dura (mesmo que termine cedo); fora do HRO, o bloco que termina por último. |
| 4. Pós-plantão depois do bloco curto | "Fica na SRPA até as 13h conforme já definido nas regras da SRPA." | Acrescentado à regra do pós-plantão, apontando para a regra que já existe. |
| 5. Sobra gente | "Livre é sempre quem sai primeiro." | Texto da regra `sem-bloco` fechado: último do rodapé, depois quem sai primeiro, na ordem. |
| 6. Tempo do HRO | "Um anestesista estima." | Entrada prevista `tempo-estimado-hro`: campo de tempo por bloco na conferência. |

**Onde a regra da SRPA até as 13h já estava escrita:** `.claude/rules/escala-telas.md`, seção do horário
da SRPA — *"a SRPA tem horário FIXO — 09:00–13:00, 13:00–19:00, 19:00–22:00"* (dono, 26/10) — e
`HORA_PADRAO_SRPA` em `src/lib/escalaCirurgicaItens.js` (Unimed de manhã entra às 09:00; dono, 18/08).
O horário já era regra. **O que não estava escrito em lugar nenhum é QUEM ocupa a SRPA** (pós-plantão de
manhã, 4º do rodapé à tarde): isso é novo e ficou só no arquivo de regras.

**SRPA da Unimed, medido** (todos os turnos): de manhã, com o 2º do rodapé em 65 de 74 (88%); à tarde,
com **exatamente o 4º em 49 de 68 (72%)** — 5º em 6, 3º em 4, 2º em 3, outros em 6.

**Placar v3 com as respostas** (mesmo teste: 19/10–06/11, 54 turnos, 848 blocos):

| Versão | Mesma pessoa | ±1 posição | Com/sem bloco certo | Pares invertidos > 30 min | Sem contar o pós-plantão | Violações |
|---|---|---|---|---|---|---|
| v3 de 09/11 | 10% | 28% | 94% | 26,1% | 25,0% | 0 |
| **v3 de 10/11** | **14%** | **30%** | 93% | **25,9%** | 24,7% | 0 |
| Publicado pelo coordenador | — | — | — | 23,2% | 20,3% | 0 |
| Final, depois das trocas | — | — | — | 21,5% | 18,5% | — |
| v3 de 10/11 com o fim real conhecido | 13% | 33% | 93% | 3,0% | 1,1% | 0 |

- O ganho veio da SRPA: sem ela, "mesma pessoa" volta a 10%. A regra acertou 14 de 14 de manhã e 11 de
  13 à tarde.
- Unimed: mesma pessoa em 17% (manhã) e 19% (tarde); pares invertidos 27,5% e **17,2%**.
  HRO: 10% e 10%; pares invertidos **29,1% e 27,8%**.
- 10 blocos de consultório ficaram sem sugestão, por desenho.
- Na ordem de saída, nada mudou: continua a ~3 pontos do plano publicado, e o teto continua sendo o tempo.
- Atrito entre duas regras, visto em 27/10 à tarde: A40 era o 2º a sair, havia dois blocos de
  Exames e sobrou gente; "livre é quem sai primeiro" o deixou sem bloco, contra "priorizar para exames".
  O simulador dá a vez à regra de quem fica livre.
  **Decidido pelo dono em 10/11/2026: vence "livre é quem sai primeiro"** — a preferência só decide entre quem vai receber bloco (registrado em `precedencias` no arquivo de regras).

**Tempo estimado do HRO na conferência — quanto deve ajudar** (inferido do que foi medido):

- Hoje, no HRO, a ordem prevista dos blocos acompanha a real em ρ 0,49, e o fim do bloco erra 66–71 min.
- Na Unimed, onde o mapa traz o tempo, só hora + tempo do mapa dá ρ 0,68; e a tarde da Unimed tem 17% de
  pares invertidos contra 28–29% no HRO.
- A estimativa de um anestesista erra 38 min no fim da pessoa (contra 60 do modelo), mas esse número é
  de estimativa dada com a cirurgia em curso; na conferência será dada antes, e deve errar mais.
- Expectativa honesta: o HRO sair de ~28% para algo entre 20% e 24% de pares invertidos. Só se confirma
  medindo: por isso o campo tem de gravar o tempo informado, para entrar no placar.

**Próximos passos, em ordem**

1. **Campo de tempo por bloco na conferência** (HRO primeiro), gravado junto com a publicação. É a única
   coisa que ataca o gargalo medido. Antes de `src/`: protótipo HTML (Regra #3).
2. **Sugestão pela skill `/publicar-escala`, fora do app**: o `i_simulador_v3.mjs` vira um passo do
   `escala-publicar-turno.mjs --ensaio`, que imprime "bloco → pessoa sugerida" ao lado do que veio na
   foto. Sem tela nova, sem migration; o conferente já é o dono.
3. **Gravar sugestão × o que foi publicado × motivo** (tabelas `escala_cirurgica_sugestao*` do rascunho).
   Enquanto a sugestão roda pela skill, basta um JSON por turno em `.local/escala-aprendizado/sugestoes/`.
4. **Lista de cooperados e lista de "não escalar com"** do dono → linhas no `regras-escalacao.json`.
5. **Dicionário de cirurgiões** (65 grupos ambíguos): sobe a cobertura do nível cirurgião × procedimento,
   hoje 18%, onde o erro é 17,5 min.
6. **Repartir sala com dois anestesistas num mapa cru** (IOSC, Exames): hoje o simulador recebe os blocos
   já desenhados.
7. Só depois, com 4 semanas de placar dentro do critério: sugestão dentro da conferência do app.

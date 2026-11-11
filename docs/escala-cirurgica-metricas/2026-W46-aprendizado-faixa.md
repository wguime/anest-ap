# Escala Cirúrgica — previsão com faixa, fim do bloco por simulação e escalação por custo esperado · 2026-W46

> Passos 1 e 2 da pesquisa `2026-W46-pesquisa-escalacao-automatica.md`, implementados só nos scripts do
> aprendizado (`2026-W45-aprendizado-scripts/`: `faixa.mjs`, `j_faixa.mjs`, `i_simulador_v3.mjs`,
> `ciclo-semanal.mjs`). Nada em `src/`, nenhuma migration aplicada, nenhuma consulta nova ao banco: usei
> os exports de 10/11 (dados até 09/11). Teste fora da amostra: 19/10–09/11; cada semana é prevista só
> com as anteriores, inclusive a escolha dos parâmetros. Pessoas aparecem por código.
> **Medido** = saiu dos scripts. **Inferido** está marcado.

## Resposta curta

- **A previsão por cirurgia melhorou e ganhou faixa confiável**: erro mediano de 27 para 24,2 min, e o
  P80 cobre 80% dos casos (Unimed 82%, HRO 78%) — dentro da meta de 75–85%.
- **O fim do bloco não melhorou no ponto** (60 min de erro, igual), **mas agora tem faixa honesta**: o
  P80 do fim do bloco cobre 79% dos casos.
- **A escalação por custo esperado empata com a anterior**: 25,9% de pares invertidos (v3: 25,7%;
  publicado: 23,6%). Ordenar e emparelhar basta; o custo esperado vale 1 minuto.
- **Regra do bloco curto para o plantonista**: empata exatamente com a regra do dono no que deixa os
  outros além do horário, desde que o plantonista renda ao terminar. O que pesa é a rendição, não o
  bloco em que ele começa.
- O teto continua o mesmo: o bloco previsto para terminar por último foi de fato o último em 7 de 30
  turnos (23%). Na literatura, 47,5%.

## 1. Duração por cirurgia: modelo atual × modelo com faixa

Modelo novo: encolhimento em log-minutos com peso n/(n+k), do hospital até o par cirurgião ×
procedimento; onde o mapa traz tempo estimado, ele entra como centro com o viés medido por hospital ×
especialidade. Parâmetros escolhidos pela validação em semanas anteriores: **k = 2**, peso do mapa
**0,75**, largura z80 entre 0,83 e 0,85 (a primeira semana usou o padrão k = 4 e 0,5, por não ter validação).

| 1.448 pares limpos, mesmos casos | Erro mediano | Erro médio | Até 30 min | P80 cobre |
|---|---|---|---|---|
| Modelo atual (mediana com recuo) | 27 min | 45,7 | 54% | não tem faixa |
| **Modelo com faixa (P50)** | **24,2 min** | 41,9 | 57% | **80%** |

Calibração do P80 por hospital: Unimed 82% (n = 728) · HRO 78% (n = 636) · Materno 82% (n = 84).
Largura mediana entre P50 e P80: 44 min.

| Nível que decidiu o centro | Casos | Erro novo | Erro atual nos mesmos | P80 cobre |
|---|---|---|---|---|
| Tempo do mapa (com viés corrigido) | 30% | 19,8 | 24 | 84% |
| Procedimento × hospital | 23% | 27,1 | 28,5 | 78% |
| Cirurgião × procedimento | 19% | 17 | 16,5 | 84% |
| Hospital | 12% | 42,7 | 52,5 | 78% |
| Cirurgião | 9% | 44,1 | 42,5 | 73% |
| Procedimento | 7% | 33,3 | 34 | 77% |

- O ganho veio de dois lugares: corrigir o viés do tempo do mapa (24 → 19,8) e o encolhimento nos
  casos sem histórico (52,5 → 42,7).
- Onde já havia histórico do par, o modelo novo não é melhor no ponto (17 × 16,5); ganha a faixa.
- O nível "cirurgião" sozinho fica fora da meta (73%): pouca gente, procedimentos muito diferentes.

## 2. Fim do bloco: soma × simulação

Simulação: 1.000 sorteios por turno de atraso do 1º caso, durações (lognormal do modelo acima) e giros,
com as distribuições medidas por hospital; em sala de centro cirúrgico a cirurgia seguinte começa quando
a anterior acaba.

| 722 blocos com fim real | Erro mediano | Viés | Até 30 min | Ordem prevista × real (ρ) | P80 cobre |
|---|---|---|---|---|---|
| Soma (3ª rodada, linha do tempo da sala) | 59 min | −1 | 30% | 0,56 | não tem faixa |
| **Simulação (P50)** | 60,6 min | −2 | 28% | 0,50 | **79%** |

- Calibração do P80 do fim do bloco: HRO 76% (n = 358) · Unimed 81% (n = 364). Largura mediana P50 → P80: 78 min.
- **Franco:** a simulação não prevê melhor o horário provável nem a ordem. O que ela entrega é a faixa
  — e a faixa está certa: quando o sistema diz "até as 18h10 com 80% de chance", acerta 4 em 5.
- Na janela do placar semanal (26/10–09/11) os dois empatam também na ordem (0,58 × 0,58).
- O bloco previsto para terminar por último foi de fato o último em **7 de 30 turnos (23%)**.

## 3. Escalação: v3 × v4 × publicado × final

v4 = regras do dono (papéis por posição pré-fixados, par proibido com custo infinito) + fim do bloco
simulado + emparelhamento húngaro por **custo esperado**: cada posição de saída tem um horário-alvo, e
o custo de um bloco para uma pessoa é o atraso esperado além do alvo, mais um quarto da folga esperada
antes dele. Teste: 19/10–09/11, 58 turnos, 913 blocos.

| Versão | Mesma pessoa | ±1 posição | Com/sem bloco certo | Pares invertidos > 30 min | Sem contar o pós-plantão | Atraso ponderado pela ordem | P80 do bloco cobre | Violações |
|---|---|---|---|---|---|---|---|---|
| Acaso | 7% | — | — | 40,1% | — | — | — | — |
| v3 (regras do dono, soma) | 14% | 30% | 94% | 25,7% | 24,2% | 46,2 min | — | 0 |
| **v4 (faixa + custo esperado)** | 13% | 28% | 94% | 25,9% | 23,9% | 45,7 min | 79% | 0 |
| v4 só ordenando pelo P50 | 14% | 28% | 94% | 26,2% | 24,2% | 46,7 min | 79% | 0 |
| Só a ordem, sem regra de papel | 12% | 29% | 94% | 24,0% | 23,9% | 44,3 min | — | 0 |
| Publicado pelo coordenador | — | — | — | 23,6% | 20,7% | 41,8 min | — | 0 |
| Final, depois das trocas | 81% igual ao publicado | — | — | 21,9% | 18,7% | 37,7 min | — | — |
| Com o fim real conhecido | 14% | 32% | 94% | 0,0–3,4% | 0,0–1,1% | 0–5,4 min | — | 0 |

*Atraso ponderado pela ordem*: para cada pessoa, quantos minutos ela termina depois do horário que teria
se os mesmos blocos estivessem na ordem de saída; quem sai primeiro pesa mais. É a métrica nova pedida
pela pesquisa.

- **Ordenar e emparelhar basta** com as restrições de hoje: o custo esperado muda 1 minuto no atraso
  ponderado e 0,3 ponto nos pares invertidos. Mantive o húngaro porque é ele que respeita o par proibido.
- As regras de papel custam ~1,5 ponto na ordem (25,7% × 24,0% sem elas). Elas existem por outro motivo.
- A sugestão continua 2 a 4 pontos atrás do plano publicado, e a 4 minutos no atraso ponderado.
- O custo esperado muda escolhas pontuais do jeito certo: em 05/11 à tarde, na Unimed, um bloco que era
  o 7º a terminar pelo horário provável (17:00) mas podia ir até 19:11 foi para quem sai em 10º.

## 4. Teste da regra do bloco curto (Dexter 2019) × regra do dono

Regra do dono: plantonista com o bloco que termina por último (HRO: ortopedia/urgência). Regra do bloco
curto: plantonista começa no bloco previsto para acabar mais cedo e, ao terminar, assume o que de fato
ainda vai mais longe. Desfecho: minutos de quem **não** é plantonista além do fim do turno (13h/19h).
Fim real do bloco; onde falta, o P50. Só turnos com 60%+ dos blocos com fim real.

| | Unimed (25 turnos) | HRO (28 turnos) |
|---|---|---|
| A — regra do dono, sem rendição | 182 min por turno; alguém > 30 min além em 72% | 244 min; 82% |
| A+ — regra do dono + plantonista rende ao terminar | **113 min**; 64%; rendição em 56% dos turnos | **106 min**; 57%; rendição em 86% |
| B — bloco curto + rende o que de fato vai mais longe | **113 min**; 64%; rendição em 100% | **106 min**; 57%; rendição em 100% |
| Fim mediano do plantonista em A · em A+ e B | 16:22 · 17:19 | 16:43 · 18:31 |

- **As duas regras empatam exatamente** quando há rendição. Não é coincidência: nos dois casos o
  plantonista acaba no bloco que de fato termina por último; muda só quem carrega, até lá, o bloco que a
  previsão errou.
- **O ganho está na rendição, não no bloco inicial**: 182 → 113 min na Unimed, 244 → 106 no HRO.
- Diferenças reais entre A+ e B: B exige um repasse todo turno (100% × 56–86%), e deixa o plantonista
  livre mais cedo para urgência. A+ só troca quando a previsão erra.
- Limites: a rendição simulada é perfeita (sabe qual bloco vai mais longe) e instantânea; na prática
  rende-se com informação do dia. Blocos sem fim real usam o P50.
- **Conflito com a regra do dono?** Não no resultado. A regra dele já produz o mesmo desfecho se o
  plantonista assumir, ao terminar, a sala que ainda vai longe — que é o que "a troca do dia resolve"
  descreve. Fica como pergunta 1.

## 5. O que mudou no ciclo semanal

- `ciclo-semanal.mjs` passou a rodar também a faixa e a v4 e a gravar `.local/escala-aprendizado/saida/faixa.json`
  (parâmetros escolhidos para a próxima semana, erro e calibração).
- O placar semanal ganhou a seção **Faixa (P50/P80)**: erro dos dois modelos, cobertura do P80 da duração e
  do fim do bloco por hospital, e em quantos turnos o último bloco previsto foi o último de fato; e, na
  escalação, v3 × v4 e o atraso ponderado pela ordem.
- Rodei o ciclo de ponta a ponta com os exports de 10/11, sem `--exportar`: duração 23,5 min com P80 em
  80,2%; fim do bloco 57,9 min com P80 em 77,9% (HRO 74,1%, um ponto abaixo da meta); v4 com 25,1% de
  pares invertidos; 94,0% em quem fica sem bloco; 0 violações. `placar-semanal/2026-W46.md` foi regerado.
- O comando agendado (`--exportar`) não foi reexecutado contra o banco; a parte de exportação não foi alterada.
- `codigos.mjs varrer` agora cobre também os relatórios `2026-W46-aprendizado*`; resultado: os mesmos 7
  falsos positivos de antes, nenhum nome de profissional.

## 6. O que coletar

| Dado | O banco já tem? | Onde, ou o que falta |
|---|---|---|
| Tempo estimado do mapa, bruto | **Tem** (só Unimed manda) | `escala_cirurgica_caso.tempo_estimado` e captura `alocacao` |
| Hora do mapa × hora real do 1º caso | **Tem** | `hora` × `inicio_real` do caso |
| Fim de um caso → início do seguinte (giro) | **Tem** | derivado de `termino_real`/`inicio_real` por sala |
| "Quanto falta?" | **Tem**, pouco usado (21% das cirurgias) | `termino_previsto` + captura `estimativa`. Falta só a forma de um toque |
| Encaixe depois da publicação | **Tem** | captura `alocacao` com origem manual |
| Cancelamento/suspensão | **Tem** | evento de status (suspensa) e evento de exclusão do caso |
| Repasse: de quem, para quem, hora | **Tem** | captura `realocacao` |
| Repasse: **motivo** | Falta | lista fechada em `realocacao.detalhe.motivo` |
| Hora real de **saída** de cada anestesista | Parcial | existe a hora do TOQUE de liberar (`liberacoes[…].liberadoEm`), quase sempre de terceiro; falta a hora informada → tipo `saida` |
| Marca de **hora digitada depois** | Parcial | só se deduz comparando com o toque; falta a hora do registro → `inicio_real_em`/`termino_real_em` |
| Caso que **mudou de sala ou de hora** | Falta | a captura não escuta `sala` nem `hora` → tipo `movimento` |
| **Correção do conferente** + motivo | Falta | não há sugestão gravada → `escala_cirurgica_sugestao` + `_ajuste` |
| **Tempo estimado pelo conferente** (HRO) | Falta | tipo `tempo_bloco` |
| Retrato da conferência (quem estava disponível) | Falta | tipo `conferencia`, com lista única de indisponíveis |
| Procedimento **normalizado** | Falta no banco | hoje só nos scripts → `procedimento_chave` na captura |
| Cirurgião com identidade única | Falta | dicionário `escala_cirurgiao` + `_alias`; captura por `cirurgiao_id` |

Rascunho atualizado (não aplicado, fora de `supabase/migrations`): seção "REVISÃO DE 10/11/2026" de
`2026-W45-aprendizado-rascunho-migration.sql`. Atende à revisão de LGPD: purge na mesma migration (24
meses, a confirmar), RLS explícita para os 4 verbos nas três tabelas novas, restrição sem motivo e criada
só pelo dono, lista única de indisponíveis sem motivo, `cirurgiao_id` no lugar do nome, nenhum campo de
texto livre (o motivo "outro" não abre texto).

## 7. Perguntas para o dono

1. **Plantonista e rendição.** Quando o plantonista termina o bloco dele e outra sala ainda vai longe,
   ele assume essa sala? No teste isso tirou 70 min por turno de gente além do horário na Unimed e 140
   no HRO.
   → Sim, sempre que terminar antes · Só se o colega pedir · Não, cada um termina o seu.
2. **Bloco curto para o plantonista.** A literatura sugere o plantonista começar no bloco mais curto e
   depois assumir o que for mais longe. Nos nossos dados dá o mesmo resultado da sua regra, com um
   repasse a mais por turno. Quer manter a sua regra?
   → Manter (bloco que termina por último) · Testar o bloco curto na Unimed · Tanto faz, o conferente decide.
3. **Bloco de horário incerto.** Um bloco que provavelmente acaba às 17h mas pode ir até 19h deve ir
   para quem sai mais tarde do que o horário provável indicaria?
   → Sim, considerar a folga · Não, usar só o horário provável · Mostrar os dois e eu decido.
4. **Hora de saída.** Ao liberar um colega, registrar a hora em que ele de fato saiu (já vem preenchida
   com a hora do toque, corrige quem quiser)?
   → Sim · Não, a hora do toque basta.
5. **Motivo do repasse.** Ao passar uma cirurgia para outro colega, marcar o motivo em um toque
   (liberar na ordem · sala atrasou · urgência · combinado · correção)?
   → Sim, sempre · Só quando for fora da ordem · Não.

## 8. Fecho — respostas do dono (10/11/2026) e placar com elas

| Pergunta | Resposta | Onde ficou |
|---|---|---|
| 1. Plantonista rende quem está preso | "Sim, é o esperado": estando livre, ele entra no lugar do colega que pela ordem já deveria ter saído | regra `plantonista-rende` |
| 2. Bloco curto para o plantonista | Não foi perguntado: dá o mesmo resultado com um repasse a mais. Fica a regra dele | registrado como não adotado |
| 3. Sala de horário incerto | "Sim, considerar a folga" | objetivo `considerar-a-folga`: a ordenação usa o P80 |
| 4. Hora de saída na liberação | "Sim" | entrada aprovada `hora-de-saida`; tipo `saida` no rascunho de captura |
| 5. Motivo do repasse | Em aberto: sai do reexame do sistema de trocas | `emAberto` no arquivo de regras; marcado no rascunho |

Vocabulário (dono): no que o usuário lê não se usa "bloco" nem "tempo do bloco" — diz-se "sala" ou
"cirurgias de <cirurgião>". Neste relatório técnico "bloco" continua.

**Placar com as duas respostas** (mesmo teste: 19/10–09/11, 58 turnos, 913 blocos). v5 = v4 ordenando e
mirando pelo fim com folga (P80). "Com rendição" = o plantonista, ao terminar, assume a cirurgia do
primeiro da ordem de saída que ainda vai mais de 15 min além; esse colega sai nessa hora.

| Versão | Mesma pessoa | Com/sem bloco certo | Pares invertidos > 30 min | Sem contar o pós-plantão | Atraso ponderado pela ordem | Violações |
|---|---|---|---|---|---|---|
| v4 (faixa + custo esperado) | 13% | 94% | 25,9% | 23,9% | 45,7 min | 0 |
| v5 (v4 + folga pelo P80) | 14% | 94% | 25,7% | 23,7% | 45,4 min | 0 |
| v4 + rendição do plantonista | 13% | 94% | 23,3% | 21,2% | 40,6 min | 0 |
| **v5 + rendição do plantonista** | 14% | 94% | **23,0%** | 20,9% | **40,3 min** | 0 |
| Publicado pelo coordenador | — | — | 23,6% | 20,7% | 41,8 min | 0 |
| Publicado + a mesma rendição | — | — | 20,2% | 17,1% | 34,7 min | — |
| Final, depois das trocas reais | — | — | 21,9% | 18,7% | 37,7 min | — |

- **A folga quase não muda o placar** (25,9% → 25,7%; 0,3 min): muda poucas escolhas por turno.
- **A rendição vale 2,7 pontos e 5 minutos** (25,7% → 23,0%; 45,4 → 40,3 min).
- Com as duas, a sugestão **iguala o plano publicado sem rendição** (23,0% × 23,6%; 40,3 × 41,8 min).
- Comparação justa é com a mesma rendição dos dois lados: o plano do coordenador vai a 20,2% e 34,7 min.
  **A distância continua em ~3 pontos e ~6 minutos.**
- A rendição simulada sabe quem ainda vai longe e troca na hora; na prática rende menos do que isso.

# Escala Cirúrgica — o "aprendizado" já sustenta sugerir a escalação? · 2026-W45 (até 08/11)

> Pedido do dono (09/11): com o banco que já temos, como melhorar o aprendizado e o que falta para
> colar o mapa SEM os nomes e receber a sugestão de quem vai para qual sala. Reavaliação do W39
> (`2026-W39-aprendizado.md`). Base: produção, só leitura, 22/07–08/11/2026. Queries e exports:
> `2026-W45-aprendizado-queries.sql`; análise reexecutável em `2026-W45-aprendizado-scripts/`.
> **Medido** = saiu de query/script desta revisão. **Inferido** está marcado como tal.

## Resposta curta

- O gargalo de setembro (hora capturada) **foi resolvido**: de ~80–100 pares limpos por semana para
  ~350–570. A previsão de duração caiu de ~38 para **27–28 min** de erro mediano (22–24 na última
  semana, com 5 semanas de treino). O critério 1 (< 25 min) está **na fronteira**, não cumprido com folga.
- O critério 2 (menos inversões que a escalação humana) **não foi atingido, mas está perto**: o plano
  publicado pelo coordenador gera 20,8% de pares invertidos; um simulador ingênuo, 24,9%; o acaso, 39,5%.
- Nada lê o que é capturado: não existe "agente". Existe captura passiva (funcionando) e análise manual.
- O que falta não é mais dado do mesmo tipo: é **identidade do cirurgião**, **tempo do mapa no HRO**,
  **retrato de quem estava disponível no dia** e as **restrições que só o coordenador conhece**.

## 1. Inventário

**Onde o dado mora (medido):**

| Fonte | O que traz | Volume |
|---|---|---|
| `escala_cirurgica_caso.inicio_real/termino_real` (+ `_por`), desde 02/10 | duração real; sobrevive à republicação | 2.290 pares plausíveis em 5 semanas |
| `escala_cirurgica_evento` | toques de status e liberações | 19.874 linhas, 11 MB |
| `escala_cirurgica_captura`, desde 25/09 | alocação publicada, trocas, estimativas, ordem | 8.775 linhas, 4,9 MB |
| `escala_cirurgica.ordem_liberacao/ajuda_externa/linha_overrides` | rodapé, ajudas, trocas, decisões | 1 linha por hospital-dia |
| `src/data/escalaNumerica.json` + libs | regra da ordem (03/08–18/12) | 100 dias |

**A captura de 25/09 está enchendo, todos os tipos gravam** (26/09–08/11): alocação 4.455 (4.153 de
publicação, 302 manuais) · realocação 1.177 · estimativa 1.632 · estimativa_total 924 · ordem 214.
Os três gatilhos estão ligados. Nenhum tipo parado; nenhuma estimativa órfã.

**Volume por semana:** 550–710 casos (Unimed ~49%, HRO ~45%, Materno ~6%), estável desde agosto.

**Qualidade da hora — antes × depois:**

| Período | Pares plausíveis | Com ponta em lote | Limpos | % dos casos |
|---|---|---|---|---|
| 22/07–24/09 (W39, par de eventos) | 1.685 | 57% | 722 | 13% |
| 02–13/10 (hora real nasce) | 462 | 19% | 373 | — |
| 14–26/10 (trava de 14/10) | 951 | 15% | 806 | — |
| 27/10–08/11 (liberar sem travar) | 910 | 8,5% | 833 | ~66% |

- Terminadas sem horário: 100% até 01/10; **0–3%** desde 05/10.
- No período mais recente, 68% dos inícios e 48% dos términos foram **digitados** (não são a hora do
  toque); ~95% dos digitados caem em múltiplo de 5 min. É horário lembrado, com resolução de 5 min.
- ~55–60% dos horários são gravados pelo próprio anestesista do caso (era 4–11% nas marcações em lote).
- Ressalva: "limpo" = sem ponta em lote. Horário digitado depois não é auditável; o conjunto
  "estrito" (as duas pontas pelo próprio anestesista) tem só 753 pares e dá erro parecido (30 min).

## 2. Backtest de duração

Treino 02–25/10, teste 26/10–08/11, pares limpos (n = 1.043 / 877). Erro absoluto mediano, em minutos:

| Preditor | Todos (n=974) | Limpos (n=877) | Limpos, teste só 02–08/11 (n=387) |
|---|---|---|---|
| Mediana do hospital | 39 | 39 | 35 |
| Família do procedimento → cirurgião → hospital | 29,8 | 29 | 23 |
| Família × hospital | 27 | 28 | **22** |
| Só cirurgião | 37,3 | 37 | 30 |
| Tempo do mapa (`tempo_estimado`) → hospital | 32 | 30 | 30 |
| Cascata completa | 26,3 | **27** | 24 |

- **Critério 1 (< 25 min nos limpos): não cumprido no teste de 2 semanas (27–28); cumprido por pouco
  na última semana (22–24).** O erro cai com o tamanho do treino; a tendência é favorável.
- **Unimed 24 min · HRO 34 min.** A diferença tem causa medida: o mapa da Unimed traz tempo estimado
  em 74% dos casos e o do HRO em **0%**. Onde o tempo do mapa existe, ele erra 20 min (17 na última
  semana) — empata com o modelo.
- **Família × cirurgião com 5+ casos: erro de 15 min**, mas cobre só 7–18% dos casos. É a maior
  alavanca, e está travada pela falta de identidade do cirurgião (item 4).
- Cirurgias longas (> 150 min reais) erram ~95 min: o modelo não as reconhece.
- Para a escalação o que conta é a **soma por pessoa no turno**: erro mediano de **47 min** (30% relativo).
- **Estimativa da equipe** (captura; 538 cirurgias): erro de **21 min** na 1ª estimativa, 17 na última,
  sem viés. Mas é dada em mediana **74 min antes do fim**, com a cirurgia em curso, e cobre só 21% das
  terminadas. Não serve para escalar na véspera; serve para aferir o modelo.

## 3. Ordem de escalação × ordem de liberação

**Quem está no turno e em que ordem sai é REGRA (medido, 262 turnos de dia útil, Unimed + HRO):**
- 86,2% das posições do rodapé são a grade da numérica daquele hospital no dia; entre elas, **97,3%
  na ordem relativa da numérica**.
- Os 13,8% restantes: 11,4% gente da grade de OUTRO hospital no dia (empréstimo, troca, pós-plantão),
  2,1% consultório, 0,2% sem explicação na grade.
- Faltam 5 nomes por turno em relação à grade (férias, licença, pós-plantão, troca). **Não deu para
  separar os motivos**: férias e plantão noturno são consultados ao vivo no Pega Plantão e não ficam
  gravados.

**Quem vai para qual sala é ESCOLHA do coordenador.** Nenhuma regra escrita fixa a sala. Padrões
medidos (288 turnos, mediana de 14 pessoas com caso por turno):

| O que a posição de saída acompanha | Turnos | ρ mediano | ρ>0 / ρ<0 |
|---|---|---|---|
| Soma do tempo do mapa (só onde existe) | 134 | **0,68** | 127 / 7 |
| Nº de casos da pessoa | 287 | 0,36 | 252 / 35 |
| Hora agendada do último caso | 287 | 0,09 | 176 / 109 |
| Fim previsto pelo modelo (dado anterior) | 54 | 0,42 | 49 / 5 |
| Fim REAL (hora real, 05/10+) | 88 | **0,74** | 87 / 1 |
| Fim real, sem término colado na liberação | 83 | 0,71 | 79 / 3 |

- O coordenador dá a carga menor a quem sai primeiro, e **usa o tempo do mapa** para isso.
- O 0,74 é da alocação FINAL. **20,5% das cirurgias mudam de anestesista depois da publicação**
  (493 de 2.405): parte do alinhamento é correção ao longo do turno, não plano.
- **Afinidade cirurgião × anestesista: não existe.** O anestesista mais frequente de um cirurgião
  responde por 15% dos turnos; ao acaso seriam 14% (164 cirurgiões; 8 acima do p95 = o esperado).
- **Sala fixa por anestesista: não existe** (9% × 8% ao acaso).
- **Sala × posição de saída: existe, fraco** (explica 17% da variância). SRPA e as salas de
  emergência do HRO ficam com quem sai por último (o plantonista); Exames, Umanitá e Consultório com
  quem sai cedo. Inferido: é o plantonista segurando a emergência, não preferência pessoal.
- Residente: registrado em 0,6% dos casos. Não dá para medir o efeito.
- 19% das posições do rodapé não têm caso no turno; 22% das pessoas cobrem 2+ salas.

**Simulador offline (54 turnos, 19/10–06/11, 542 pessoas).** Pega os pacotes de cirurgias do plano
publicado, redistribui entre as mesmas pessoas (quem sai primeiro recebe o pacote de fim previsto
mais cedo) e conta pares invertidos por mais de 30 min com os horários reais:

| Alocação | Pares invertidos |
|---|---|
| Final humana (depois das trocas do dia) | 13,2% |
| **Plano publicado pelo coordenador** | **20,8%** |
| Simulador: fim previsto pelo modelo | 24,9% |
| Simulador: modelo + histórico da sala | 27,6% (IC95% da diferença para o humano: +3,7 a +10,2 pp) |
| Simulador: só nº de casos | 27,1% |
| Acaso | 39,5% |

- **Critério 2: não atingido.** O simulador vence o plano humano em 19 turnos, empata em 3, perde em 32.
- O simulador põe a mesma pessoa no mesmo pacote que o coordenador em só 15% dos casos: há muitas
  alocações quase equivalentes.
- Limites do simulador: não redesenha os pacotes (quem cobre duas salas), não conhece restrição
  nenhuma, e supõe que a duração não depende de quem anestesia.

## 4. Diagnóstico do "agente"

- **O que roda:** só gatilhos de captura. Nenhum job, view, tabela de medianas ou tela lê
  `escala_cirurgica_captura`. O relatório semanal (`/escala-cirurgica relatorio`) rodou uma vez (W30).
- **Quebrado:** nada. `cirurgiao_display` continua vazio em todos os casos.
- **Pendente do W39:** retenção de `escala_cirurgica_captura` e `_evento` em `docs/lgpd-retencao.md`.

**O que nenhuma espera vai trazer:**

1. **Identidade do cirurgião.** 951 grafias (hospital + texto); um agrupamento automático chega a 689
   grupos, 65 ambíguos (primeiro nome com dois donos). 191 grupos cobrem 80% dos casos.
2. **Chave de procedimento.** 3.027 textos → 997 famílias; só 22 têm 20+ pares limpos. Linhas-lista
   ("EDA + COLO, n pacientes", facos em série) precisam do nº de pacientes como variável.
3. **Tempo estimado no mapa do HRO.** Não vem na planilha; é o que separa 24 de 34 min.
4. **Disponibilidade do dia.** Férias, licença e pós-plantão são calculados na conferência e
   descartados. Sem isso o passado não é reproduzível e o simulador não sabe quem escalar.
5. **Restrições do coordenador.** Quem não faz o quê (cardíaca, pediatria, neuro), quem cobre duas
   salas, quando a sala fica com dupla, residente. Só perguntando.
6. **Motivo das trocas do dia** (20,5% dos casos): correção de plano ruim ou imprevisto?

## 5. Roteiro

| Fase | O que construir | Pronto quando | Dá para fazer já? |
|---|---|---|---|
| A. Chaves | `src/lib/escalaCirurgiaoChave.js` + `src/data/escalaCirurgioes.json` (dicionário revisado pelo dono, 191 grupos primeiro); nº de pacientes das linhas-lista em `escalaProcedimentoCurto.js` | cobertura família × cirurgião ≥ 40% no teste; Vitest dos casos ambíguos | **Sim**, só código e revisão |
| B. Medianas reexecutáveis | `scripts/escala-aprendizado-backtest.mjs` (os scripts desta pasta, promovidos) gerando tabela de medianas e o placar dos dois critérios | um comando refaz este relatório; rodado toda semana | **Sim** |
| C. Retrato da conferência | tipo novo `conferencia` em `escala_cirurgica_captura`: grade esperada, férias, pós-plantão, decisões (migration + `escalaConferenciaHeadless.js`) | um turno passado é reconstruído sem Pega Plantão | Precisa de migration (fora de turno) |
| D. Restrições | arquivo de regras do coordenador (`src/data/escalaRestricoes.json`) preenchido em entrevista | o simulador não propõe nenhuma alocação que o dono vete numa amostra de 20 turnos | Depende do dono |
| E. Simulador com regras | `scripts/escala-simular-alocacao.mjs`: mapa sem nomes → rodapé pelas libs (`escalaNumerica`, `posPlantao`) → proposta → comparação com a humana | 4 semanas seguidas com menos inversões que o plano publicado e erro < 25 min | Versão ingênua existe (`d_pub.mjs`); a completa depende de A, C e D |
| F. Sugestão na conferência | bloco "Sugestão" na conferência da importação, rotulado, nunca aplicado sozinho | protótipo HTML aprovado (Regra #3) e critério da fase E cumprido | **Não ainda** |

Fora do roteiro, por decisão já tomada: estimativa automática na pílula do caso e qualquer notificação.

**Não é viável hoje:** sugerir a escalação em produção. O modelo perde do coordenador por ~4 pp e não
conhece restrições. Também não é viável aprender as restrições por estatística: os dados não mostram
afinidade nenhuma, então o que existir é regra a ser escrita.

## As 3 ações de maior retorno imediato

1. **Dicionário de cirurgiões + nº de pacientes das listas (fase A).** Onde família × cirurgião
   existe o erro é 15 min, e hoje isso cobre 7–18% dos casos.
2. **Gravar o retrato da conferência (fase C) e pedir o tempo estimado no mapa do HRO.** São os dois
   dados que o tempo não devolve; cada semana sem eles é histórico irreproduzível.
3. **Promover o backtest a script semanal (fase B).** Os dois critérios viram um placar; a distância
   atual é 2–3 min no erro e 4 pp nas inversões.

# Escala Cirúrgica — o "aprendizado" sustenta sugerir a alocação? · 2026-W39 (até 24/09)

> Pedido do dono (25/09): *"revise essa funcionalidade e verifique como aperfeiçoar — a ideia é que em
> algum momento (com um banco de dados robusto) as escalas cirúrgicas sejam inseridas sem os nomes dos
> anestesistas e você sugira onde cada um deve ser escalado baseados nos tempos aprendidos e na ordem
> de liberação"*. Base: produção, só leitura, 22/07–24/09/2026, dia útil, sem a linha `fds`, sem dado
> de paciente. Queries: `2026-W39-aprendizado-queries.sql` (ao lado). Plano original:
> `docs/escala-cirurgica-evolucao-tecnica.md` §1.

## O que existe hoje

Só a **Fase 0** do plano de julho: `escala_cirurgica_evento` (triggers) registra cada transição de
status do caso e cada liberação com a ordem vigente. As Fases 1 (chave única de cirurgião e de
procedimento) e 2 (medianas por cirurgião × procedimento, sugestão) **não foram feitas**, e o relatório
semanal (`/escala-cirurgica relatorio`) só rodou uma vez (W30).

## Volume × qualidade

| | Unimed | HRO | Materno | Total |
|---|---|---|---|---|
| Casos | 2.913 | 2.488 | 299 | **5.700** |
| Com alguma marcação de status | 2.014 | 1.726 | 70 | 3.810 (67%) |
| Par início→fim plausível (5–720 min) | 822 | 857 | 6 | 1.685 (30%) |
| Par plausível **sem marcação em lote** | 353 | 363 | 6 | **722 (13%)** |

- **Volume não é o problema; a hora marcada é.** 41% das "terminada" e 43% das "iniciada" são
  marcadas em lote (3+ pela mesma pessoa em ≤60 s), quase sempre por um terceiro (4–11% pelo
  anestesista do caso, contra 62% nas marcações isoladas). 19,5% dos inícios caem a ±60 s do fim da
  cirurgia anterior da sala. O lote **não está caindo** semana a semana (30–51% desde a W31).
- Só 80–100 pares limpos por semana.

## A duração dá para prever?

`nomeCurtoProcedimento` agrupa os 1.655 textos distintos em **357 famílias**; só 15 têm 10+ pares
limpos. Backtest (treino 22/07–13/09, teste 14–24/09), erro absoluto mediano em minutos:

| Preditor | Todos os pares (n=364) | Só pares limpos (n=163) |
|---|---|---|
| Mediana do hospital (baseline) | 43,4 | 33,1 |
| Família do procedimento → cirurgião → hospital | **37,6** | 33,5 |
| `tempo_estimado` do mapa → hospital | 42,4 | 32,5 |

- Ganho de 13% sobre o baseline, e nenhum nos pares limpos (treino espalhado demais). Erro típico
  ≈ metade da duração mediana (79 min).
- **O cirurgião não acrescenta nada mensurável:** 424 grafias, `cirurgiao_display` vazio em todos.
- Referência humana: o `termino_previsto` informado pela equipe (190 cirurgias que ainda o guardam)
  erra **18,6 min** — melhor que qualquer preditor, mas é informado com a cirurgia em curso.

## O coordenador já aloca na direção certa?

Por turno (4+ pessoas), Spearman entre a ordem de saída do rodapé e a hora do último "terminada" da
pessoa (ρ > 0 = quem sai antes terminou antes):

| Recorte | Turnos | ρ mediano | ρ>0 / ρ<0 |
|---|---|---|---|
| Todos | 131 | 0,60 | 116 / 15 |
| Término marcado a >15 min da liberação da pessoa | 68 | **0,48** | 56 / 12 |
| Término marcado pelo próprio anestesista | 23 | 0,80 | 20 / 3 |
| Só casos importados, sem troca de anestesista | 130 | 0,59 (Unimed 0,67 · HRO 0,45) | 117 / 13 |

⚠️ Parte do 0,60 é artefato: a fila só libera na ordem (`bloqueioOrdem`) e muitas "terminada" são
marcadas no momento da liberação, herdando a ordem do rodapé. Tirando esses (2ª linha), o sinal cai
para ~0,5 mas continua claro. No mapa publicado, a ordem de saída acompanha o **nº de casos** da pessoa
(ρ 0,36), e não a hora marcada da última cirurgia (ρ 0,09).
Sobra desalinhamento: 17,8% dos pares de pessoas estão invertidos por >30 min (média de 4,5 por turno).

## Conclusão

**Sugerir a alocação hoje não é viável**: a previsão erra ~38 min, e o coordenador já acerta a direção
(ρ ~0,5–0,6) — um modelo com esse erro não o superaria. O gargalo é a **qualidade da hora capturada**,
não a quantidade de dados. Lacunas, da mais para a menos importante:

1. **Hora real de início/fim** separada da hora do toque (a marcação em lote é 41–43% do total).
2. **Histórico das estimativas** — `termino_previsto` não tem histórico e é zerado ao marcar
   "terminada" (desde 15/09); o tempo total da pessoa (`linha_overrides.termino`) é sobrescrito sem
   registro. São o melhor sinal que existe (erro de 18,6 min) e se perdem.
3. **Retrato da alocação publicada** e log da troca de anestesista no caso — sem isso não se separa o
   que o coordenador planejou do que aconteceu (217 casos, 6%, mudaram de anestesista).
4. Hora real da liberação/repasse de sala; evento para quem volta depois de liberado (`renovado`).
5. Turno, bloco, origem e posição na sala no evento; cirurgião com identidade única; procedimento
   codificado (TUSS — a RPC `search_unimed_tuss` já existe).

Nota LGPD (baixa): 2 de 6.664 eventos de status trazem a idade do paciente dentro do texto do
procedimento, que o log copia.

## Quando reavaliar

Com as lacunas 1–3 fechadas, rodar de novo este backtest. Critério para começar a sugestão: erro
mediano < 25 min nos pares limpos **e** uma alocação sugerida que, reaplicada aos dias do teste com as
durações reais, gere menos pares invertidos que a alocação feita à mão. A sugestão entra na
conferência da importação como SUGESTÃO rotulada (nunca automática — princípio do módulo), e nunca
na pílula da fila (estimativa automática ali foi recusada em 23/07).

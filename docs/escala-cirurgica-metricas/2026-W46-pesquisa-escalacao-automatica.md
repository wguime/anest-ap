# Escalação automática de anestesistas por sala — pesquisa externa (2026-W46)

> Pesquisa feita em 10/11/2026 para orientar a funcionalidade de sugestão automática bloco → pessoa.
> Complementa os estudos internos `2026-W45-aprendizado*.md` (que mediram o problema com os nossos dados).
> Aqui só entra o que vem de fora: artigos, repositórios, produtos e relatos.

**Como ler as marcações de evidência**

- **[lido]** — resumo ou texto lido nesta pesquisa (PubMed, PMC, página do autor/fornecedor, registro do npm).
- **[trecho]** — só vi o título ou um trecho devolvido pela busca; não li o artigo.
- **[memória]** — afirmação de conhecimento prévio, não conferida agora.
- **[raciocínio]** — conclusão minha a partir das fontes; não é resultado publicado.
- *Medido* = número de estudo. *Opinião* = recomendação de autor/fornecedor/usuário sem medição.

---

## (a) Resumo em 10 linhas

1. A literatura confirma o que os nossos dados mostraram: **o limite é a previsão do fim da sala, não o algoritmo de atribuição.** Num centro cirúrgico estudado por Dexter (5 anos), a sala com a lista mais longa só foi a última a terminar em **47,5% dos dias**, com erro absoluto médio de **55,9 min por sala** — mesma ordem do nosso (~60 min).
2. Com poucos casos por par cirurgião×procedimento, o método que funciona é **bayesiano com encolhimento sobre distribuição lognormal**: centra no tempo agendado/estimado quando há pouco histórico e migra para o histórico conforme ele cresce. Validado em 65.661 casos, com limites de predição corretos a 2%.
3. **Trabalhar com faixa (P50/P80), não com um número.** A decisão "quem termina depois de quem" depende da incerteza de cada bloco; a incerteza vem quase toda dos procedimentos com 0–2 casos históricos.
4. **Machine learning melhora pouco e pede muito dado**: ganho de ~9–10 min de erro médio em estudos com 47 mil a 1,2 milhão de casos; o próprio grupo de Dexter sustenta que corrigir o viés de quem agenda obtém o mesmo. Com ~1.300 casos/mês e 6 semanas de hora real, não é a hora.
5. **Corrigir vieses sistemáticos rende mais que sofisticar o modelo**: ajustar atraso do 1º caso + viés de duração por especialidade reduziu o atraso total em 30–35% (medido); mexer em poucos casos isolados, só 4–9%.
6. **Durante o caso, o tempo restante se atualiza de forma não intuitiva**: caso que já passou do previsto continua com mediana de ~35 min restantes. Perguntar ao anestesista "quanto falta?" é o dado mais barato e mais informativo — é onde está o ganho real para os repasses.
7. A atribuição, no nosso tamanho (~17 blocos × ~16 pessoas, ordem de saída já dada), **não precisa de solver**: ordenar + emparelhar resolve o caso sem restrição; com exclusões pessoa×local, o algoritmo húngaro (JS puro, milissegundos) dá o ótimo. CP-SAT em WebAssembly existe, mas é comunitário, pesa ~13 MB e não se justifica.
8. Existe literatura exatamente sobre o nosso formato — **"relief order" como entrada** (preprint 2026, 18 salas × 14 anestesistas) — e ela conclui que usar a **distribuição** das durações, e não a média, é o que mais muda o resultado.
9. Produtos comerciais fazem atribuição diária **por regras + validação da edição manual** (AnesthesiaGo) ou arrasta-e-solta (QGenda); nenhum achado descreve otimização por ordem de saída, e os relatos de usuários dizem que "ainda precisa de um humano para a atribuição diária".
10. Portanto: **(1º)** previsão com faixa e correção de viés, **(2º)** atribuição por custo esperado com explicação e registro da correção do coordenador, **(3º)** atualização intradia e sugestão de repasse. Ligar a sugestão só depois de 4 semanas em modo sombra batendo o plano humano fora da amostra.

---

## (b) Achados por tema

### 1. Previsão de duração e de fim de sala (o gargalo)

| Achado | Tipo | Fonte |
|---|---|---|
| Com pouco ou nenhum histórico, centrar a distribuição prevista no **tempo agendado** e tomar a incerteza proporcional de outros cirurgiões/procedimentos; com histórico moderado ou grande, usar só o histórico; com pouco, **média ponderada dos dois**. Testado em 65.661 casos: limites de predição corretos a 2% (o limite inferior de 5% ficou acima de 4,9% dos tempos reais); probabilidade de um caso durar mais que outro estimada a 0,7%. | Medido [lido] | Dexter F, Ledolter J. *Bayesian prediction bounds and comparisons of operating room times even for procedures with few or no historic data.* Anesthesiology 2005;103:1259-67. https://pubmed.ncbi.nlm.nih.gov/16306741/ |
| A incerteza por **amostra pequena** (procedimentos com 0–2 casos históricos) respondeu por praticamente toda a incerteza nas decisões que dependem de tempo de sala. Agrupar procedimentos em categorias largas reduz essa incerteza mas **aumenta a variabilidade do processo** — melhor manter a descrição fina e usar o método bayesiano. A variabilidade difere por especialidade e urgência (erro percentual acima da mediana de 22% em 57% das colunas urgentes × 42% das eletivas). 61.353 casos. | Medido [lido] | Dexter F, Dexter EU, Ledolter J. *Influence of procedure classification on process variability and parameter uncertainty of surgical case durations.* Anesth Analg 2010;110:1155-63. https://pubmed.ncbi.nlm.nih.gov/20357155/ |
| "A maioria dos casos tem pouco ou nenhum histórico para os procedimentos agendados"; generalização e automação dependem de **vocabulário estruturado** de procedimentos. | Opinião de especialista, baseada em estudos próprios [lido: resumo] | Dexter F, Epstein RH, Marian AA. *Case duration prediction and estimating time remaining in ongoing cases.* Br J Anaesth 2022;128:751-5. https://pubmed.ncbi.nlm.nih.gov/35382924/ |
| Modelo hierárquico bayesiano (cirurgião e grupo cirúrgico como efeitos aleatórios) dispensa a estimativa do cirurgião. **Lognormal supera gama** nos limites superiores; cobertura dos limites de 80% e 90% com desvio < 1% do nominal; mas o **erro percentual absoluto médio do ponto é 38,5%** nos casos com 0–3 históricos — a faixa acerta, o ponto não. | Medido [lido] | Gañan-Cardenas E, Jiménez JC, Pemberthy-R JI. *Bayesian hierarchical modeling of operating room times for surgeries with few or no historic data.* J Clin Monit Comput 2022;36:687-702. https://pubmed.ncbi.nlm.nih.gov/33907937/ |
| **Somar estimativas não prevê bem qual sala termina por último.** Em 5 anos de um centro ambulatorial: a sala com mais horas agendadas foi a última a terminar em 47,5 ± 2,8% dos dias; viés médio desprezível (4,0 min/caso), mas erro absoluto somado = 25,1% do tempo de sala, **55,9 ± 1,1 min por sala**; giro de sala com erro absoluto médio de 13,1 min frente à média anual. Causa: variabilidade do tempo operatório e, em menor grau, do giro — não encaixes (0,5%) nem cancelamentos (3,6%). O método já era o bayesiano. | Medido [lido: texto integral] | Dexter F, Osman BM, Epstein RH. *Improving intraoperative handoffs for ambulatory anesthesia: challenges and solutions for the anesthesiologist.* Local Reg Anesth 2019;12:37-46. https://pmc.ncbi.nlm.nih.gov/articles/PMC6538832/ (autores citados de memória; conteúdo lido) |
| **Tempo restante durante o caso**: caso agendado para 2 h que já dura 1,5 h não tem mediana de 0,5 h restante, tem mais, e o quanto varia por procedimento. Depois de ultrapassar o previsto, a mediana restante quase não muda (35 min às 14h30 e também às 15h); varia muito por cirurgião/procedimento (16 / 35 / 86 min nos percentis 10 / 50 / 90). Implementado **em SQL** no banco do sistema de anestesia, num hospital de 29 salas; ao perguntar ao anestesista "quanto falta?" por mensagem na estação, a resposta veio em média em 1,2 min. | Medido [lido] | Dexter F, Epstein RH, Lee JD, Ledolter J. *Automatic updating of times remaining in surgical cases using Bayesian analysis of historical case duration data and "instant messaging" updates from anesthesia providers.* Anesth Analg 2009;108:929-40. https://pubmed.ncbi.nlm.nih.gov/19224806/ |
| Corrigir o cronograma pelo **atraso médio do 1º caso + viés de duração por especialidade** reduziu o atraso total em 30–35%. Mover casos de sala reduziu 50–70% nos casos movidos, mas só 6–9% no total; folga entre cirurgiões, 4–8%. "Intervenções que tocam poucos casos têm pouco potencial." | Medido [lido] | Wachtel RE, Dexter F. *Reducing tardiness from scheduled start times by making adjustments to the operating room schedule.* Anesth Analg 2009;108:1902-9. https://pubmed.ncbi.nlm.nih.gov/19448220/ |
| O atraso depende da **duração total dos casos anteriores** na sala, não de giros prolongados nem de o cirurgião seguir a si mesmo. | Medido [trecho] | Wachtel RE, Dexter F. Artigo companheiro, Anesth Analg 2009. https://pubmed.ncbi.nlm.nih.gov/19448219/ |
| Monitorar o **viés** das estimativas por serviço; onde o serviço subestima de forma consistente (3 a 65 min por 8 h de sala), usar o histórico em vez da estimativa do cirurgião. 58.291 casos. | Medido [trecho] | Dexter F, Macario A, Epstein RH, Ledolter J. *Validity and usefulness of a method to monitor surgical services' average bias in scheduled case durations.* Can J Anaesth 2005. https://iro.uiowa.edu/esploro/outputs/journalArticle/Validity-and-usefulness-of-a-method/9983806247602771 |
| Fatores operacionais e temporais (hora do dia, ordem na sala etc.) melhoram a estimativa, mas "a variabilidade inerente permanece alta, exigindo cautela ao otimizar escalas". | Medido [lido] | Kayis E et al. *Improving prediction of surgery duration using operational and temporal factors.* AMIA Annu Symp Proc 2012:456-62. https://pmc.ncbi.nlm.nih.gov/articles/PMC3540440/ |
| Durações cirúrgicas seguem distribuição aproximadamente lognormal (base de todos os métodos acima). | [memória] | Strum DP, May JH, Vargas LG. Anesthesiology 2000 — não conferido agora. |

**Machine learning — leitura cética**

| Estudo | Dados | Referência usada | Resultado | Fonte |
|---|---|---|---|---|
| Ensaio randomizado (único achado) | 683 pacientes, colorretal e gineco, 1 centro | processo padrão do prontuário + estimativa do cirurgião | Erro absoluto médio **59,3 → 49,5 min** (−9,8 min; P = 0,03); espera do paciente −33,1 min | Strömblad CT et al. JAMA Surg 2021;156:315-21. https://pmc.ncbi.nlm.nih.gov/articles/PMC7841577/ [lido] |
| Réplica crítica | — | — | Título: "simplesmente ajustar o viés de quem agenda atinge os mesmos objetivos que o machine learning" | Dexter F, Epstein RH. JAMA Surg 2021;156:1074-5. https://pubmed.ncbi.nlm.nih.gov/34259804/ [trecho — carta sem resumo; argumento não lido] |
| Multicêntrico | 1.177.893 procedimentos, 13 hospitais | regressão linear com médias históricas | Erro absoluto médio **43 → 34 min**; dentro de ±20%: 39% → 46%. Variável mais importante: **duração histórica do procedimento por cirurgião** | Kendale S et al. JMIR AI 2023;2:e44909. https://pubmed.ncbi.nlm.nih.gov/38875567/ [lido] |
| Um centro acadêmico | 46.986 cirurgias, XGBoost | média histórica + estimativa do cirurgião | Dentro de ±10%: **32% → 39%**; modelo por cirurgião melhor que por serviço | Bartek MA et al. J Am Coll Surg 2019;229:346-54. https://pubmed.ncbi.nlm.nih.gov/31310851/ [lido] |
| Piloto com produto comercial | 990 casos, 3 meses | previsão do prontuário | −7 min de diferença absoluta | Tuwatananurak JP et al. J Med Syst 2019;43:44. https://pubmed.ncbi.nlm.nih.gov/30656433/ [lido] — coautor da empresa |
| Revisão de escopo | 14 estudos | "padrão da indústria" | Só **7 de 13** com melhora estatisticamente significativa; "limitações metodológicas importantes na maioria" | Spence C et al. BJS Open 2023;7:zrad113. https://pubmed.ncbi.nlm.nih.gov/37931236/ [lido] |
| Tempo restante em tempo real (rede neural com sinais vitais, drogas, eventos) | 70.826 casos, 8 hospitais | método bayesiano e duração agendada | Erro (CRPS) 13,8 min, 6,4 min melhor que o bayesiano. Acertar se a sala passa das 15h, 1 h antes: **agendado 78% · bayesiano 80% · rede 89%** | Jiao Y et al. Br J Anaesth 2022;128:829-37. https://pmc.ncbi.nlm.nih.gov/articles/PMC9074795/ [lido] |
| Idem, implantação prospectiva silenciosa | 62.142 procedimentos, 10 meses | duração agendada com viés corrigido | CRPS 27,19 × 51,66 min; sem deriva em 10 meses | Jiao Y et al. BJA Open 2024. https://pmc.ncbi.nlm.nih.gov/articles/PMC11091514/ [lido] |

Leitura [raciocínio]: (i) na previsão **antes** do caso, o ML tira ~7–10 min de um erro de 43–59 min, e isso com dezenas de milhares de casos; (ii) o método bayesiano simples fica a 2 pontos percentuais do "ingênuo" e a 9 da rede neural só quando a rede lê **dados intraoperatórios do prontuário eletrônico** — que não temos; (iii) em todos, a variável dominante é a que já usamos (histórico cirurgião×procedimento). O nosso erro mediano de 17,5 min onde há histórico do par já está na faixa do que esses modelos entregam.

### 2. Atribuição anestesista → sala e ordem de saída

| Achado | Tipo | Fonte |
|---|---|---|
| **O nosso formato existe na literatura.** Sistema de rodízio em que "os tempos de saída são determinados por uma ordem de saída predefinida… nenhum anestesista é liberado antes dos que o precedem"; a ordem "normalmente vem dos horários de saída do dia anterior". O modelo recebe o mapa do dia e a ordem, e decide hora de saída e sala de cada um, pesando três custos: saída tardia, **repasses** e sala descoberta. Instâncias reais: **70–80 cirurgias, 18 salas, 14 anestesistas**; durações lognormais por especialidade. | Modelo + experimento computacional [lido: texto integral]. **Preprint, não revisado por pares** | Sinha A, Bansal A, Ozaltin O, Russell M. *Relief-based Anesthesiologist Scheduling with Stochastic Surgery Durations.* Optimization Online, jun/2026. https://optimization-online.org/2026/06/relief-based-anesthesiologist-scheduling-with-stochastic-surgery-durations/ |
| No mesmo trabalho: planejar com a **distribuição** das durações em vez da média reduziu o custo total em 39–69% e os repasses/períodos descobertos esperados em >90%, à custa de saídas 26–40% mais "caras" (mais tarde). Contra as escalas reais de 50 dias, 77–90% de melhora **na função de custo do próprio modelo**. | Medido em simulação; ganho contra a prática real é na métrica dos autores — ler com reserva [lido] | idem |
| Estratégia de rendição que usa **só o histórico de durações** para estimar o tempo restante dos casos em andamento gerou 3,4–4,9% mais horas extras que o mínimo teórico (conhecimento perfeito). "Pouco se ganharia" com câmeras ou rastreamento em tempo real. | Medido [lido] | Dexter F, Macario A, O'Neill L. *A strategy for deciding operating room assignments for second-shift anesthetists.* Anesth Analg 1999;89:920-4. https://pubmed.ncbi.nlm.nih.gov/10512265/ |
| **Contraintuitivo:** quem fica até tarde deve ir para a sala prevista para terminar **mais cedo**, não a mais longa — termina, ajuda nos giros e então **assume o caso que de fato vai terminar por último**, decidido com a informação do dia. No centro estudado, ~44% menos custo de gente ficando até tarde sem previsão. Recomendação: no máximo 20% de chance de alguém ficar além do planejado. | Medido em 1 centro ambulatorial + recomendação [lido] | Dexter, Osman, Epstein 2019 (acima). https://pmc.ncbi.nlm.nih.gov/articles/PMC6538832/ |
| Sistema de apoio em tempo real que ordena a rendição por quem saiu mais tarde recentemente: após implantar, menos desvios da ordem ideal e saída cedo mais bem distribuída. | Medido (antes/depois) [lido] | Wax DB, McCormick PJ. *A real-time decision support system for anesthesiologist end-of-shift relief.* Anesth Analg 2017;124:599-602. https://pubmed.ncbi.nlm.nih.gov/27861437/ |
| Lista priorizada enviada por e-mail a quem decide a rendição: residentes retidos 2 dias seguidos caíram de 1,33% para 0,43%; retidos após 17h30 de 18,09% para 12,64%; percepção de conseguir decidir com equidade de 60% para 94%. | Medido (14 meses antes × 16 depois) [lido] | Bhutiani M et al. *Decision support tool improves real and perceived anesthesiology resident relief equity.* Anesth Analg 2018;127:513-9. https://pubmed.ncbi.nlm.nih.gov/29878944/ |
| Rendição decidida por **equidade** pode reduzir a produtividade do grupo; os autores modelam alternativa por produtividade. | [trecho — só título e descrição da busca] | Dexter F, Epstein RH, Marian AA. Perioper Care Oper Room Manag 2022. https://doi.org/10.1016/j.pcorm.2022.100244 |
| Sem orientação, anestesistas decidem para **aumentar o próprio trabalho clínico por unidade de tempo no local onde estão**, mesmo quando isso aumenta hora extra e imprevisibilidade; **educação não mudou as decisões**. | Medido (1 hospital) [lido] | Dexter F, Lee JD, Dow AJ, Lubarsky DA. *A psychological basis for anesthesiologists' operating room managerial decision-making on the day of surgery.* Anesth Analg 2007;105:430-4. https://pubmed.ncbi.nlm.nih.gov/17646501/ |
| Modelos integrados (sala + anestesista) com otimização estocástica/robusta existem e foram aplicados em hospital universitário, mas decidem também a sala das cirurgias e usam hora extra como recurso — não tratam ordem de saída nem repasse. | [trecho / citado no preprint acima] | Rath S, Rajaram K, Mahajan A. Oper Res 2017;65:1460-78. https://doi.org/10.1287/opre.2017.1634 · Tsang MY et al. Oper Res 2025;73:1430-58. https://arxiv.org/abs/2204.11374 |

**Formulação que decorre disso** [raciocínio; o primeiro item é resultado clássico de teoria de escalonamento, não relido agora]:

- Sem restrições, com a ordem de saída fixa, **ordenar os blocos pelo fim previsto e emparelhar com a ordem de saída** minimiza qualquer custo de atraso convexo — não há o que otimizar além disso.
- Com restrições pessoa×local/cirurgião, vira um **problema de atribuição linear**: matriz de custo pessoa×bloco, par proibido = custo infinito, resolvido de forma exata pelo algoritmo húngaro em O(n³). Para 17×16 são microssegundos em JavaScript.
- O custo de cada par deve ser **esperado sobre a distribuição** do fim do bloco (ex.: minutos esperados em que o bloco passa do "horário-alvo" daquela posição), não calculado sobre o ponto. É a versão barata da lição do preprint de 2026 e continua sendo atribuição linear.
- Papéis por posição (plantonista, pós-plantão, quem fica livre) entram como **pré-fixações** antes do emparelhamento, não como pesos.
- "Pares invertidos" é uma métrica de avaliação, não o objetivo do solver (como objetivo seria atribuição quadrática, desnecessária).

### 3. Ferramentas e repositórios

| Item | Situação verificada em 10/11/2026 | Fonte |
|---|---|---|
| **Google OR-Tools / CP-SAT em JS** | Não achei build oficial para JavaScript/WebAssembly. Há portes **comunitários**: `cpsat-js` (v1.5.1, criado em abr/2026, ~2 mil downloads/semana, **12,8 MB**) e `or-tools-wasm` (72 estrelas, criado em mai/2026, multithread no navegador). Jovens demais para um app clínico. | https://www.npmjs.com/package/cpsat-js · https://github.com/Axelwickm/or-tools-wasm [lido: registro npm e API do GitHub] |
| **HiGHS (WASM)** | `highs` v1.15.4 (out/2026), MIT, ~156 mil downloads/semana, ~4 MB. Solver MIP sério se um dia for preciso. | https://www.npmjs.com/package/highs [lido] |
| **glpk.js** | v5.0.0 (dez/2025), **GPL-3.0** (licença restritiva), ~19 mil/semana. | https://www.npmjs.com/package/glpk.js [lido] |
| **javascript-lp-solver / YALPS** | JS puro. `javascript-lp-solver` v1.0.3 (jan/2026), ~118 mil/semana; `yalps` v0.6.4 (dez/2025), MIT, 240 KB, ~56 mil/semana (reescrita mais rápida do primeiro). | https://www.npmjs.com/package/javascript-lp-solver · https://www.npmjs.com/package/yalps [lido] |
| **Húngaro em JS** | `munkres-js` v1.2.2 (2017, estável, ~54 mil/semana, sem dependências). O algoritmo cabe em ~60 linhas — dá para ter como lib pura própria, com teste. | https://www.npmjs.com/package/munkres-js [lido] |
| **Supabase Edge Functions** | Aceita WebAssembly; limites: 256 MB de memória, **2 s de CPU por requisição**, função de até 20 MB. Um solver WASM de 13 MB com 2 s de CPU é apertado; o húngaro roda no cliente sem nada disso. | https://supabase.com/docs/guides/functions/limits · https://supabase.com/docs/guides/functions/wasm [lido] |
| **Repositórios de escalação de anestesia** | Não achei repositório aberto de atribuição **diária** de anestesia que valha adotar. O que existe: benchmark de escala de anestesistas em camadas (mensal/semanal/sala) com código Java e CP-SAT, e código suplementar de artigos de Operations Research. Servem de leitura, não de base. | https://data.mendeley.com/datasets/rtg2nkbnd9/2 [trecho] |

Conclusão [raciocínio]: **solver não é necessário.** Ordenação + húngaro dá o ótimo com garantia para o nosso problema; um MIP (HiGHS) só faria sentido se a decisão passasse a incluir tempo (quem rende quem a que horas, com custos de repasse), e mesmo aí uma heurística gulosa sobre a ordem de saída é defensável.

### 4. Produtos comerciais e relatos de usuários

| Produto | O que foi possível confirmar | Fonte |
|---|---|---|
| **AnesthesiaGo (PerfectServe)** | Gera a atribuição diária de casos por **motor de regras** (qualificação, credenciamento por local, pares indesejados, "times" cirurgião–anestesista); se alguém edita à mão, **valida e avisa** a regra violada. Números do fornecedor: escala pronta em ~12 min, 44 min a menos que o manual. Nada sobre ordem de saída. | *Alegação de fornecedor* [trecho] https://www.perfectserve.com/news/perfectserve-acquires-anesthesiago/ · https://marketplace.aviahealth.com/product/65458 |
| **QGenda** | Forte na escala mensal. Relatos: "não usamos para a atribuição diária"; grupo grande monta o dia por arrasta-e-solta sobre a escala mensal, integrado ao sistema do hospital com "muito trabalho de TI". | *Relato de usuários* [lido] https://forums.studentdoctor.net/threads/scheduling-software.1474919/ |
| **Lightning Bolt (PerfectServe)**, **Amion**, **EZCall** | Citados por usuários; Lightning Bolt teria ferramenta de atribuição diária; queixas são de preço e de plantões "amontoados", não de algoritmo. | *Relato* [lido] idem |
| **Opmed.ai, Qventus, LeanTaaS iQueue** | Posicionamento em previsão de duração/demanda e uso de sala; exigem alimentação do prontuário eletrônico. As páginas públicas não descrevem atribuição diária de anestesia por ordem de saída. | *Marketing* [lido: Opmed; demais páginas não abriram] https://www.opmed.ai/ |
| Importação automática da escala para o prontuário | Mudanças após o fechamento das 14h caíram de 13,3% para 6,9%. | Medido [trecho] Hoefnagel, McLeod, Mongan. Perioper Care Oper Room Manag 2020 |

Relatos que resumem o estado da prática [lido, opinião]: "ainda é preciso um humano para a atribuição diária de sala/caso"; "não conheço software comercial que atenda um departamento de anestesia com mais de 3 pessoas — escala mensal + atribuição diária extremamente fluida"; usuário responsável pela escala de 30 médicos: "a automação resolve ~90%, eu reviso os erros e preencho as lacunas".

**Não encontrei** discussão no Reddit (r/anesthesiology) descrevendo um sistema de lista de saída, nem relato de grupo que tenha adotado sugestão automática por ordem de saída e medido aceitação. Os termos variam de grupo para grupo ("late 1…late 5", "first out", "relief list"); um exemplo documentado de fila numerada de quem fica até tarde: https://anesthesia.bidmc.harvard.edu/Policies/admin/SOP/Anesthesia%20Call%20Structure%20&%20Emergency%20Back-up%20Staff.pdf [trecho].

### 5. Robustez e adoção

- **Humano no circuito é o padrão observado**, não a exceção: os produtos geram e validam, o coordenador ajusta (seção 4). Opinião + relato.
- **Lista priorizada simples já muda comportamento e percepção de justiça** (Wax 2017; Bhutiani 2018 — medido). O ganho veio de tornar a ordem visível e a decisão auditável, não de otimização.
- **Educação não muda decisão; o padrão oferecido muda** (Dexter 2007 — medido que a educação não mudou). Implica que a sugestão precisa nascer certa na tela; não adianta explicar a regra e esperar adesão [raciocínio].
- **Avaliação**: validação temporal (treina no passado, testa no futuro), coorte de teste grande e longa, e vigiar deriva por troca de equipe, procedimento novo e mudança de rotina — limitações que Jiao 2024 aponta em quase todos os estudos [lido]. Para previsão com faixa, medir **cobertura** (o P80 contém 80% dos casos?) e não só erro do ponto (Dexter 2005; Gañan-Cardenas 2022).
- **Aversão a algoritmo**: pessoas abandonam o algoritmo depois de vê-lo errar, mesmo sendo melhor que o humano (Dietvorst et al. 2015 [memória/trecho]). Não achei estudo específico sobre motivos de correção em escala de pessoal — lacuna real da literatura.
- **Risco conhecido de previsão**: a variabilidade inerente continua alta mesmo com modelo melhor (Kayis 2012; Dexter 2019). Prometer precisão que não existe é o principal risco de produto [raciocínio].

---

## (c) Recomendação para este app, em ordem

### 1º — Previsão com faixa e correção de viés (antes de qualquer tela)

1. **Trocar a mediana com recuo por encolhimento lognormal.** Trabalhar em log-minutos; para cada par cirurgião×procedimento, a previsão é a média ponderada entre o histórico do par e o nível acima (procedimento → cirurgião/especialidade → hospital), com peso `n / (n + k)`. É o mesmo recuo hierárquico de hoje, mas contínuo e com variância. Saída por caso: **P50 e P80**, nunca um número só. (Dexter & Ledolter 2005; Dexter 2010.)
2. **Onde o mapa traz tempo estimado, usá-lo como centro** quando o par tem pouco histórico — depois de medir e corrigir o viés por hospital/especialidade. Onde o mapa não traz, o centro é o nível hierárquico acima. (Dexter 2005; viés: Dexter 2005 Can J Anaesth.)
3. **Fim do bloco por simulação**, não por soma: sortear ~1.000 vezes (atraso do 1º caso + casos + giros) e guardar a distribuição do fim. Custa milissegundos em JS e entrega direto "probabilidade de o bloco A terminar depois do B". (Motivo: Dexter 2019 — soma de pontos acerta a última sala em menos da metade dos dias.)
4. **Giro e atraso do 1º caso como médias medidas por hospital** (e por sala/cirurgião se o dado sustentar), aplicadas como correção sistemática. É onde está o ganho grande e barato (Wachtel & Dexter 2009: 30–35%).
5. **Normalizar o nome do procedimento** num vocabulário estável (o editorial de 2022 trata isso como pré-requisito). Sem isso o histórico por par se fragmenta em grafias.

Cabe em lib pura JS + uma tabela/visão de parâmetros no Postgres. Sem servidor, sem solver.

### 2º — Atribuição por custo esperado, explicada e corrigível

1. Pré-fixar os papéis por posição (plantonista, pós-plantão, quem fica livre).
2. Montar a matriz pessoa×bloco com **custo esperado** a partir das simulações; par proibido = infinito; resolver com **húngaro** (lib própria testada ou `munkres-js`).
3. Mostrar **o porquê em uma linha por pessoa** ("bloco com fim previsto 11h40–12h30; você é o 3º a sair") e marcar os blocos de **baixa confiança** (pouco histórico, faixa larga) — é aí que o coordenador deve olhar.
4. **Registrar toda correção**: sugestão original, escolha final e motivo em lista curta (restrição pessoal · conhecimento do caso · previsão errada · troca combinada · outro). É o dado de treino que ninguém mais tem.
5. Validar a edição manual contra as restrições duras e avisar, sem bloquear (padrão AnesthesiaGo).

### 3º — Durante o turno: tempo restante e sugestão de repasse

1. Atualizar o fim previsto de cada bloco com o **tempo decorrido** (distribuição condicional — Dexter 2009, feito em SQL).
2. Um campo **"quanto falta?"** de um toque na folha do caso (15 · 30 · 60 · 90+ min). Sem notificação — a escala é sem notificações por decisão do dono; é campo opcional na tela que já se abre.
3. Sugerir **quem rende quem** quando alguém termina: o próximo da ordem de saída que ainda está em caso com maior tempo restante esperado. A estratégia baseada só em histórico ficou a 3–5% do ótimo (Dexter 1999), e é aqui que 20% das cirurgias já mudam de mão.
4. Considerar, para o plantonista e para quem sai por último, a regra de Dexter 2019: começar no bloco **curto** e assumir depois o que de fato vai mais longe. Vale testar no backtest contra a regra atual ("bloco que termina por último") antes de adotar.

### O que começar a coletar agora

| Dado | Para quê |
|---|---|
| Marca de **"hora digitada depois"** × toque na hora (já derivável) e horário do registro | pesar/filtrar o histórico; medir o ruído do próprio dado |
| **Tempo estimado do mapa**, bruto, como veio | centro bayesiano e medição do viés de quem agenda |
| **Hora marcada × hora real do 1º caso** por sala | correção de atraso inicial |
| **Fim de um caso → início do seguinte** na mesma sala | giro real por hospital |
| **Hora real de saída de cada anestesista** (liberação) | é o desfecho que a funcionalidade quer melhorar; hoje medimos só o fim dos blocos |
| **Repasse**: de quem, para quem, hora, motivo | treinar e avaliar a sugestão de rendição |
| **Correção do coordenador** + motivo | treino e métrica de aceitação |
| **Encaixes, cancelamentos e casos movidos de sala** depois da publicação | separar erro de previsão de mudança de mapa |
| **"Quanto falta?"** quando informado | atualização intradia |
| Procedimento **normalizado** | histórico por par utilizável |

### Critérios para ligar a sugestão

- **Modo sombra por 4 semanas**: a sugestão é calculada e gravada, não exibida; compara-se com o plano humano publicado.
- Backtest **fora da amostra, em janela rolante** (treina até a semana N, testa na N+1).
- Ligar quando, no período de teste: (i) pares invertidos >30 min **≤ plano humano**; (ii) minutos de atraso ponderados pela ordem de saída ≤ humano; (iii) **cobertura do P80 entre 75% e 85%**; (iv) zero violação de restrição dura; (v) acerto de quem fica sem bloco mantido (hoje 94%).
- Depois de ligada: acompanhar **% de sugestões publicadas sem edição** e a distribuição dos motivos de correção; rever parâmetros mensalmente; alerta quando cirurgião ou procedimento novo aparecer (previsão de baixa confiança).

### O que NÃO fazer (retorno baixo segundo a literatura)

- **Gradient boosting / rede neural agora.** Ganho típico de ~9 min sobre um erro de 43–59 min, com 47 mil a 1,2 milhão de casos; temos ~1.300/mês e 6 semanas de hora real. Reavaliar com **≥ 12 meses** de hora real (~15 mil casos) e só se o encolhimento bayesiano tiver estagnado.
- **CP-SAT, programação inteira ou estocástica.** O problema é de atribuição linear pequeno; o húngaro dá o ótimo.
- **Exibir previsão como número único** ou prometer "termina às 11h40".
- **Perseguir a previsão perfeita antes do turno.** O teto é estrutural (47,5% de acerto da última sala no estudo de Dexter); o ganho adicional está no ajuste **durante** o turno.
- **Categorias largas de procedimento** para "ter mais dados" — reduz uma incerteza e aumenta outra (Dexter 2010).
- **Reordenar a saída por equidade dentro do sistema.** A ordem já vem decidida; o papel do app é medir e mostrar se ela está sendo cumprida em tempo.
- **Contar com explicação/treinamento para mudar hábito** — não mudou no estudo de 2007; o que muda é a sugestão já vir certa.

---

## (d) Leituras recomendadas

1. **Dexter F, Ledolter J (2005)** — o método bayesiano para pouco histórico. Base do passo 1. https://pubmed.ncbi.nlm.nih.gov/16306741/
2. **Dexter F, Osman BM, Epstein RH (2019)** — texto aberto; mostra com números por que a sala "mais longa" não é a que termina por último e propõe a regra do bloco curto. https://pmc.ncbi.nlm.nih.gov/articles/PMC6538832/
3. **Sinha A et al. (2026, preprint)** — o único trabalho com ordem de saída como entrada; vale a introdução e a seção 5. https://optimization-online.org/2026/06/relief-based-anesthesiologist-scheduling-with-stochastic-surgery-durations/
4. **Dexter F et al. (2009)** — tempo restante em caso em andamento, implementado em SQL, com pergunta ao anestesista. https://pubmed.ncbi.nlm.nih.gov/19224806/
5. **Wachtel RE, Dexter F (2009)** — corrigir viés sistemático rende mais que intervenções pontuais. https://pubmed.ncbi.nlm.nih.gov/19448220/
6. **Dexter F, Dexter EU, Ledolter J (2010)** — de onde vem a incerteza; por que não agrupar procedimentos. https://pubmed.ncbi.nlm.nih.gov/20357155/
7. **Kendale S et al. (2023)** e **Strömblad CT et al. (2021)** — o melhor que o ML entrega, com os números. https://pubmed.ncbi.nlm.nih.gov/38875567/ · https://pmc.ncbi.nlm.nih.gov/articles/PMC7841577/
8. **Wax & McCormick (2017)** e **Bhutiani et al. (2018)** — apoio à decisão de rendição e percepção de justiça. https://pubmed.ncbi.nlm.nih.gov/27861437/ · https://pubmed.ncbi.nlm.nih.gov/29878944/
9. **Dexter F et al. (2007)** — como anestesistas decidem no dia e por que educação não basta. https://pubmed.ncbi.nlm.nih.gov/17646501/
10. **Dexter F, Macario A, O'Neill L (1999)** — estratégia de rendição só com histórico fica a 3–5% do ótimo. https://pubmed.ncbi.nlm.nih.gov/10512265/

---

## Limites desta pesquisa

- Vários artigos de Dexter foram lidos **só no resumo** (acesso pago); as fórmulas exatas do método de 2005 e a carta de 2021 no JAMA Surgery não foram lidas.
- O preprint de 2026 não é revisado por pares e seus ganhos são medidos na função de custo dos próprios autores.
- Páginas de QGenda, Qventus, LeanTaaS e AnesthesiaGo não abriram ou são só marketing; o que consta delas vem de trechos de busca e de relatos em fórum.
- Não foram encontrados relatos de grupos sobre aceitação de sugestão automática por ordem de saída, nem repositório aberto equivalente ao nosso problema.
- Quase toda a evidência é de hospitais dos EUA com prontuário eletrônico e hora de sala registrada pela enfermagem; a nossa hora é marcada pelo anestesista e em parte digitada depois — os números servem de ordem de grandeza, não de meta.

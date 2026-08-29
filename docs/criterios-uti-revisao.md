# Critérios UTI — revisão por evidência e mudança de lugar

> 29/08/2026. Decisão do dono: os Critérios UTI **ficam**, mas deixam de ter card próprio e passam a
> ser um **título dentro de Calculadoras**. E o critério de permanência mudou: não é mais "é
> ferramenta de UTI", é **"é validada para decidir encaminhamento de paciente perioperatório à UTI"**.

---

## O que existe hoje

Sete ferramentas em `src/data/criteriosUtiCalculators.js`, renderizadas por `CriteriosUTIPage.jsx`
(766 linhas, sistema de renderização próprio). Card em `MenuPage.jsx`, rota `criteriosUti`.
A página foi aberta **79 vezes** entre 05/03 e 29/08.

---

## Revisão: 7 → 5

### Ficam — validadas para ESTA decisão

| ferramenta | quando | por que fica |
|---|---|---|
| **SORT** | pré-op, 6 variáveis | Mortalidade em 30 dias validada externamente (AUROC 0,899). O limiar de **≥ 5%** é usado operacionalmente para sinalizar UTI: no grupo de alto risco houve 25,0% de admissão não planejada em UTI contra 3,1% no padrão, e baixar o corte para 5% não inunda a UTI — só 2,2% da população atinge o critério de admissão direta. |
| **ESS** | pré-op, emergência | Há estudo com o título exato *"Can the emergency surgery score (ESS) be used as a triage tool predicting the postoperative need for an ICU admission?"* (Peponis et al., Am J Surg 2019) — que o app **já cita**. c-statistic 0,80–0,90 para admissão em UTI. |
| **SAS** | intra-op, 3 variáveis | *"Validated for the prediction of ICU-level care requirements within 72 h post-operatively in numerous surgical specialties."* Em 8.501 pacientes de cirurgia abdominal de alto risco, associação forte com a **própria decisão** de admitir (OR ajustado 14,41 para SAS 0–2). |
| **SIAARTI 2025** | composto | *"Planning intensive care unit admission after elective major abdominal surgery: good clinical practice document by SIAARTI-SIC-ANIARTI"*. É literalmente um documento sobre planejar admissão em UTI depois de cirurgia. |
| **CFM 2156** | regulatório | Resolução CFM 2156/2016, **vigente**, define as 5 prioridades de admissão em UTI no Brasil. É o critério legal, não estatístico — e é o que responde a auditoria. |

### Saem

**`POTTER-Inspirado` — não é o POTTER, e é o corte mais claro dos dois.**

O próprio código admite: *"Calculadora inspirada na metodologia POTTER. O algoritmo original usa
Optimal Classification Trees proprietárias."* O que roda é uma árvore de decisão feita à mão, com
8–12 perguntas — **sem validação nenhuma**. Mas a tela exibe as referências de validação do POTTER
verdadeiro (Bertsimas, Ann Surg 2018; Kaafarani, J Am Coll Surg 2021), que validam um algoritmo que
este código não implementa.

Isso é pior que "não validada para esta decisão": é **credibilidade emprestada**. Quem lê vê duas
citações de peso ao pé de um resultado que não tem respaldo algum.

**`P-POSSUM` — validada, mas para outra pergunta e em outro momento.**

É de fato o escore cirúrgico mais validado, porém para **morbimortalidade**, não para a decisão de
encaminhamento. Dois motivos decisivos:

1. **Não dá para usar na hora da decisão.** Das 18 variáveis, parte é intra e pós-operatória, e ainda
   exige laboratório, radiografia de tórax e ECG. A decisão de encaminhar é tomada antes disso ou ao
   fim da cirurgia — momentos que a SORT (6 variáveis pré-op) e a SAS (3 variáveis ao fim) já cobrem.
2. **O uso dominante dela é auditoria**, comparando mortalidade observada × esperada entre serviços,
   não decisão individual.

---

## Um achado à parte, dentro da ESS que fica

⚠️ **A ESS pontua `racaBranca` (+1 pt)** — `criteriosUtiCalculators.js:165` — e a variável entra na
soma. O app já traz o disclaimer certo: *"está na derivação original (ACS-NSQIP, EUA). Validações
internacionais frequentemente a omitem por refletir confundidores socioeconômicos, não risco
biológico."*

Só que ele **descreve** o problema e mesmo assim **soma** o ponto. E há incoerência interna: a
calculadora renal do mesmo app usa a **CKD-EPI 2021 *race-free***, justamente a versão que removeu o
coeficiente racial pelo mesmo motivo. Num app brasileiro, "raça branca" como fator de risco é ainda
mais frágil que na derivação americana.

**Proposta:** remover o ponto do cálculo e manter a nota explicando por quê — que é o que as
validações internacionais fazem. Não mexi: muda o escore, e quero seu aval.

---

## A mudança de lugar

Hoje: card em `MenuPage.jsx` → rota `criteriosUti` → `CriteriosUTIPage.jsx`.
Pedido: sem card próprio; vira **título dentro de Calculadoras**.

Duas formas, com custo bem diferente:

**Caminho A — seção que reaproveita a renderização atual.** Entra uma 14ª seção em
`calculatorSections` ("Indicação de UTI"), com as 5 ferramentas como cards. Abrir um card renderiza o
componente que já existe. O card sai do Menu. As 766 linhas de renderização clínica **não são
reescritas**.

**Caminho B — fusão completa.** Converter as 5 para `calculator-definitions.js` no formato padrão.
Ganha consistência total de layout, mas reescreve 766 linhas que hoje renderizam árvore de decisão,
seções com subtotais e interpretação por faixa — em ferramentas de decisão clínica, e sem teste que
cubra essa renderização.

**Recomendo o A.** O pedido é sobre onde a coisa mora, não sobre reescrever como ela desenha.

⚠️ A rota `criteriosUti` deve continuar respondendo mesmo sem card, senão link salvo e histórico do
navegador quebram.

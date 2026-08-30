# Prompt 1 — Auditoria: o que a anestesia realmente usa

> Cole o bloco abaixo numa **aba nova** do Claude Code, na raiz do repo. Ele é autossuficiente:
> não depende de nenhuma conversa anterior.

---

```
Estou revisando o sistema de calculadoras do ANEST — app de gestão de qualidade usado
diariamente por um grupo de anestesiologistas em Chapecó/SC, consultado NO CELULAR durante
o ato anestésico. Em 29/08/2026 fizemos uma triagem que reduziu 76 cards ativos para 54,
e ela se apoiou em literatura e no escopo de cada instrumento — NÃO em uso real, porque o
app não tem telemetria por calculadora. Preciso saber se acertamos: o que anestesiologistas
de fato consultam, e o que aplicativos e sites do mesmo nicho oferecem.

Com isso em mente: faça uma auditoria em duas frentes e entregue uma PROPOSTA, sem mexer
em código.

FRENTE A — o que a prática usa
Levante, com fonte, quais calculadoras/escalas são efetivamente consultadas na rotina
perioperatória: pré-anestésico, intraoperatório, SRPA e dor aguda. Sirva-se de diretrizes
(ASA, ESAIC, SBA, AHA/PALS), livros-texto de referência (Miller, Barash), currículos de
residência e revisões sobre uso de escores na prática. Diga sempre o TIPO de evidência —
diretriz que recomenda nominalmente vale mais que citação de passagem.

FRENTE B — o que a concorrência oferece
Compare com o que apps e sites do mesmo nicho trazem: MDCalc, QxMD Calculate, Anesthesia
Calculators, Pedi Crisis, Whitebook, e o que mais achar relevante no mercado brasileiro.
Interessa o que eles têm e nós NÃO, e o que temos e ninguém mais tem — as duas direções.

CONFRONTO
Cruze as duas frentes com o estado atual do repo. Leia primeiro, não confie em memória:
- `src/design-system/data/calculator-definitions.js` — 86 definições, 54 `active`,
  32 `inactive`, em 14 seções. Conte pelo repo, os números mudam.
- `docs/revisao-calculadoras-triagem.md` — a triagem que já foi feita, com o motivo e a
  fonte de cada corte. As 20 desativadas em 29/08 estão listadas lá.
- `docs/criterios-uti-revisao.md` — a seção "Indicação de UTI", 5 ferramentas.
- `.claude/skills/calculadoras/SKILL.md` — onde tudo mora e as armadilhas do arquivo.

Responda três perguntas, cada item com fonte:
1. Alguma das 32 inativas deveria VOLTAR? (`status: 'inactive'` → `'active'` é uma palavra)
2. Alguma das 54 ativas ainda não deveria estar lá?
3. O que falta que a prática usa e nós não temos?

⚠️ SOBRE USO REAL — o dado não existe, e não invente
`useActivityTracking` expõe `trackFeatureUse` e NENHUM componente a chama; só
`trackPageView`, em `App.jsx`. Existe contagem POR PÁGINA (a de Calculadoras foi aberta
530 vezes entre 05/03 e 29/08, contra 7.909 da Escala Cirúrgica) e NÃO existe contagem por
calculadora. Rode `node scripts/stats-uso-calculadoras.mjs` e
`node scripts/stats-favoritos-calculadoras.mjs` para ver o que há. Qualquer afirmação do
tipo "a calculadora X é pouco usada por aqui" seria invenção — diga que é impressão da
literatura, nunca medição deste grupo.

Pronto quando:
- Existe `docs/auditoria-calculadoras-uso-real.md` com as três respostas, uma linha por
  calculadora, cada uma com fonte e com o TIPO de evidência declarado.
- Toda recomendação de voltar/cortar/criar diz o que muda na conduta de quem usa.
- Onde a evidência não decidir, o documento diz que não decide, em vez de escolher.

Não altere `src/`. Isto é levantamento para o dono decidir depois. Se durante a leitura
encontrar erro de MATEMÁTICA numa calculadora, não conserte aqui: registre num item
separado do documento, porque correção de conta entra com teste e é outro trabalho.
```

---

**O que foi inferido:** que a auditoria é levantamento e não execução (por isso "não altere `src/`"),
e que o benchmark de mercado interessa nas duas direções. Os números do repo (86/54/32) valem para
30/08/2026 — o prompt já manda recontar.

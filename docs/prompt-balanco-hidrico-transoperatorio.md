# Prompt 2 — Reformar o Balanço Hídrico Transoperatório

> Cole o bloco abaixo numa **aba nova** do Claude Code, na raiz do repo. Ele é autossuficiente.

---

```
Estou reformando o Balanço Hídrico Transoperatório do ANEST — app de gestão de qualidade
usado por anestesiologistas em Chapecó/SC, consultado NO CELULAR durante a cirurgia. É a
calculadora mais pesada do sistema e o dono relatou, com estas palavras: "está confusa de
usar" e "ao adicionar novo horário a tela fica muito longa (para cirurgias longas)".

O problema foi MEDIDO no app a 375px, não é impressão:

  horas registradas | altura   | telas de 812px | campos
  vazia             | 2.161px  | 2,7            | 4
  1 hora            | 3.687px  | 4,5            | 10
  4 horas           | 4.857px  | 6,0            | 28
  12 h (cirurgia 6h)| 7.977px  | 9,8            | 76

Cada hora custa ~390px, quase meia tela: é um cartão com 6 campos numéricos em 3 pares
(`HoraRow`, `BalancoHidricoTransopDisplay.jsx:116`).

⚠️ O pior não é o comprimento, é a ORDEM. Com 12 horas, o "Balanço acumulado" fica em
y=6209, depois do último campo (y=6049). O número que a pessoa abriu a calculadora para
ver está atrás de 76 campos. Numa tela consultada durante a cirurgia, o resultado tem de
estar sempre à vista.

Com isso em mente: reforme a calculadora, e faça isso em três etapas nesta ordem.

ETAPA 1 — AUDITORIA DA MATEMÁTICA, antes de qualquer pixel
Confira a conta contra as fontes mais atualizadas e validadas hoje, citando cada uma:
- reposição de jejum (a regra "déficit = manutenção × horas" ainda é praticada?)
- manutenção intraoperatória (4-2-1 segue valendo no intraop?)
- perdas para terceiro espaço por porte cirúrgico — este é o ponto quente: a literatura
  de fluidoterapia restritiva/goal-directed dos últimos anos questiona os valores clássicos
  de 4/6/8 mL/kg/h. Diga o que a evidência ATUAL sustenta, não o que o livro antigo dizia.
- reposição de perda sanguínea (as proporções 3:1 para cristaloide e 1:1 para coloide)
- balanço acumulado e diurese mínima aceitável
Fontes: ERAS Society, diretrizes de fluidoterapia perioperatória, revisões dos últimos
5 anos. Se a evidência mudou o número que o app usa, isso é achado e vem ANTES do redesenho.

ETAPA 2 — PROTÓTIPO, para o dono aprovar por imagem
O dono pediu horas em ABAS, mas ele mesmo abriu a porta para algo melhor: proponha 2 ou 3
caminhos com o trade-off de cada um, e recomende um. Considere abas por hora, hora recolhida
depois de preenchida, uma linha compacta por hora no lugar do cartão de 6 campos, e o
resultado fixo no topo ou rodapé. O que decide é: quantas telas de 375px, e onde fica o
"Balanço acumulado".

Regra da casa (`CLAUDE.md` Regra #3): protótipo é HTML estático em `.tmp/`, com os tokens
reais copiados de `src/styles/anest-theme.css`, renderizado a 430px E a ~812×375, nos DOIS
temas, com a medição ao lado — altura, quantas telas, quantos campos, onde fica o resultado.
Abra com `open .tmp/arquivo.html` e PARE, esperando a escolha. Não mexa em `src/` antes.

⚠️ Existe a variante `deitado:` (`tailwind.config.js:27`) para celular na horizontal, já
usada no `CalculatorShowcase`. Deitado sobram largura e faltam 375px de altura — é onde
"entradas de um lado, resultado do outro" resolve o problema de raiz. Para testar no
navegador, o Chromium de desktop reporta `pointer: fine` e a variante NÃO ativa: emule toque
(`hasTouch: true, isMobile: true`) ou a captura sai com layout de retrato.

ETAPA 3 — IMPLEMENTAR o caminho escolhido
Correção de conta entra com teste em `src/__tests__/`, cobrindo os limites. E rode o teste
novo contra o código ANTIGO antes de chamá-lo de trava — teste que passa nos dois lados não
protege nada.

⚠️ Duas armadilhas do DS que esta tela pode pisar:
- `TabsContent` DESMONTA o painel inativo (`tabs.jsx:421`). Se as horas virarem abas e o
  valor digitado morar dentro da aba, trocar de hora APAGA o que foi digitado. Isso já
  apagou dado de paciente em outras telas. Estado na RAIZ, ou `forceMount`.
- `toFixed()` escreve com PONTO e o app escreve com vírgula.

Contexto do arquivo:
- `src/design-system/showcase/displays/BalancoHidricoTransopDisplay.jsx`
- definição `adt_balanco_hidrico_transop` em `calculator-definitions.js`
- `.claude/skills/calculadoras/SKILL.md` — armadilhas do arquivo, incluindo que
  `parseFloat(x) || 0` descarta o ZERO
- É uma das 3 calculadoras favoritadas por alguém no app inteiro

Pronto quando:
- `npm run lint` sem ERRO, `npm run build` passa, `npm run test:run` passa.
- A medição da tabela acima foi REFEITA no app e está no commit: quantas telas com 12 horas,
  e em que y fica o "Balanço acumulado".
- Screenshot nos dois temas, a 430px e deitado.
- Toda mudança de número da conta tem fonte citada e teste.

Não amplie o escopo para outras calculadoras. Se achar defeito em outra, registre e siga.
```

---

**O que foi inferido:** que a auditoria da matemática vem antes do redesenho (mudar a conta depois
de aprovar a tela obrigaria a refazer o protótipo), e que "abas" é o pedido mas não necessariamente
a melhor resposta — por isso o prompt pede alternativas com trade-off.

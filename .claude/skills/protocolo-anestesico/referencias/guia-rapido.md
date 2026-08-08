# Guia de consulta rápida

Documento separado do protocolo completo, **escrito diretamente em HTML** (não
convertido de markdown) para controle fino de densidade.

## Princípio de projeto

O protocolo completo responde **"por quê"**. O guia rápido responde **"o quê" e
"quanto"**, em segundos, com o documento pendurado na parede ou na mão.

A referência de qualidade é o *Stanford Emergency Manual* e os cognitive aids
da SPA: uma ação por linha, verbo primeiro, número em destaque, zero justificativa.

**Teste de aceitação:** um residente no primeiro plantão consegue executar a
fase crítica só com o guia? Se precisar abrir o completo, o guia falhou.

---

## Três formatos

| Formato | Uso | Quando produzir |
|---|---|---|
| **A — Guia de 4 páginas A4** | Afixar na sala, prancheta | Sempre |
| **B — Cartão de bolso A6 (frente e verso)** | Bolso do jaleco | Procedimentos com muitas doses críticas |
| **C — Folha de cockpit (1 página)** | Fase crítica apenas, na parede em frente ao aparelho | Procedimentos com uma fase crítica bem definida |

Produzir A sempre; oferecer B e C.

---

## Formato A — as 4 páginas

### Página 1 — Linha do tempo
Cartões por fase, cor consistente com a página 2. Cada cartão traz: duração
típica, metas numéricas em destaque, vigilância por tempo cirúrgico.

Banner no topo declarando a legenda dos marcos (`I0` = incisão, `H0` = evento
crítico, `I0 −90` = noventa minutos antes). **Número relativo sem referencial
declarado é defeito.**

### Página 2 — Fase crítica
- Checklist cronometrado da transição, com caixas de seleção
- Tabela de gatilhos: achado → conduta imediata, escalonada por gravidade
- Bloco **"NÃO FAZER"** com borda vermelha — as práticas refutadas específicas
  deste procedimento. É o item que mais muda comportamento.

### Página 3 — Doses e diluições
- Fórmula universal em faixa de destaque
- Tabela ml/h do vasopressor principal por faixa de peso (50/60/70/80/90 kg)
- Demais infusões: fármaco, diluição, dose, referência para 70 kg
- Eletrólitos: referência, apresentação, correção
- Armadilhas de rotulagem em caixa de atenção

### Página 4 — Algoritmos
- Fluxos das intercorrências principais em monoespaçado
- Tabela do agente/variante do procedimento
- Fórmulas de bolso
- Caixa final com o item de maior risco de esquecimento

---

## Formato B — cartão de bolso A6

Uma folha A4 gera 4 cartões (imprimir e cortar). Frente e verso:

**Frente:** as 8–12 metas numéricas do procedimento + doses dos 3 vasoativos mais
prováveis, em tabela por peso.

**Verso:** o checklist da fase crítica em 10 linhas + os 5 gatilhos de emergência.

Nada mais. Se não couber, não entra.

---

## Formato C — folha de cockpit

Uma página A4 retrato, fonte grande (10–12 pt), legível a 1,5 m. Só a fase
crítica: o que ligar, o que desligar, os alvos e os três gatilhos.

Pensada para ficar colada onde o anestesiologista olha, não para ser lida na mão.

---

## Regras de execução

- **Nenhuma referência bibliográfica, nenhuma justificativa.** Quem quer o porquê
  abre o completo.
- **Toda meta numérica em destaque visual.** O olho tem que achar "≤ 38,5 °C" sem
  ler a frase.
- **Verbo no imperativo.** "Desligar manta", não "a manta deve ser desligada".
- **Números idênticos aos do documento completo.** Rodar a checagem de coerência
  cruzada de `controle-qualidade.md`.
- **Nunca ultrapassar o número de páginas.** Se estourar, cortar conteúdo — nunca
  reduzir fonte abaixo de 6,5 pt.
- **Rodapé em toda página** remetendo ao documento completo, com versão e data.
- Logo ANEST no cabeçalho da página 1.

## Erros recorrentes a evitar

- Virar resumo do documento completo em vez de recorte operacional
- Números divergindo do completo (o erro mais grave e o mais comum)
- Marcos temporais sem legenda
- Justificativa infiltrada ("porque a hipertermia reduz a função plaquetária") —
  corta
- Cor decorativa competindo com o vermelho de emergência

---

## Variante para protocolos transversais

O formato de 4 páginas é do modelo **por procedimento**. Para protocolo
transversal, o guia tem **1–2 páginas** no formato que o tema pedir — tabela
única de decisão, cartaz de crise ou checklist+doses — conforme
`estrutura-transversal.md`. As regras visuais (metas em destaque, vermelho só
para emergência, masthead ANEST, rodapé) não mudam.

## Notação temporal no guia

Mesma regra do documento completo: sem códigos. No espaço apertado do guia,
usar as formas compactas com o evento declarado no título da seção ou do
cartão: "−90 min" sob o título "tempos = minutos antes da incisão";
"Faltando 30 min" nos cabeçalhos de contagem regressiva; "aos 30 min de
perfusão" no decorrido.

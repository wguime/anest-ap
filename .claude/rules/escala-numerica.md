---
paths:
  - "src/lib/escalaNumerica.js"
  - "src/data/escalaNumerica.json"
  - "scripts/extrair-escala-numerica.py"
  - "scripts/ordem-liberacao-numerica.mjs"
  - "scripts/ferias-pega-plantao.mjs"
  - "src/__tests__/lib/escalaNumerica*"
description: Escala NUMÉRICA do grupo — como interpretar o PDF colorido, montar a ordem de liberação por hospital/turno, Louise, feriados e férias; e como trocar de edição
---

# Escala numérica — referência da ordem de liberação (dono 03/09/2026)

O grupo publica, por período, um PDF com a **escala numérica**: por dia útil, a sequência de
números (pessoas) de cada hospital. É a **base** da ordem de liberação que aparece no rodapé
da escala cirúrgica — o rodapé publicado pode divergir (trocas, ajuda, consultório escalado),
e é justamente essa divergência que a conferência deve apontar. Nada aqui grava
`ordem_liberacao`: o rodapé continua sendo a fonte da fila; a numérica confere.

Onde mora: dataset `src/data/escalaNumerica.json` (extraído do PDF com cor), lib pura
`src/lib/escalaNumerica.js` (`ordemBase` → `inserirLouise` → `excluirFerias` → `montarOrdem`,
`compararComRodape`, `formatarOrdem`), CLI `node scripts/ordem-liberacao-numerica.mjs
<data> [hospital|todos] [turno|ambos] [--ferias]`, férias `node scripts/ferias-pega-plantao.mjs
<data>` (login do usuário e2e → proxy; imprime só nomes e datas), testes
`src/__tests__/lib/escalaNumericaOrdem.test.js`. Skill: `/escala-cirurgica ordem …`.

## Como ler o documento (a cor é dado — texto puro perde a informação)

- **Blocos = semanas** pelo cabeçalho ("03/08 a 07/08"); dentro, **5 colunas = seg, ter, qua,
  qui, sex**. Localize a data exata antes de ler a coluna (há dois Q e dois S). Só as datas
  presentes no documento valem — nunca extrapolar o padrão.
- **Letras do topo** identificam hospitais: **M = Materno · R = Regional (HRO) · U = Unimed**.
  **A cor da letra manda:** os números da mesma cor naquela coluna são daquele hospital. R
  vermelho + U preto → vermelhos = HRO, pretos = Unimed; no dia seguinte inverte. Vermelho e
  preto NÃO são hospitais fixos. **Azul = Materno. Verde = consultório** (fica separado; nunca
  atribuído automaticamente a hospital).
- **Legenda** (direita): número → nome, Grupo 1 em vermelho (ímpares) e Grupo 2 em preto
  (pares). O número identifica a PESSOA, não a posição. Cor da legenda não é hospital.
  Preservar "ALEXANDRE S", "ALEXANDRE D", "GUILHERME D". **Entradas compartilhadas** ("05
  HUMBERTO / ROBERTA", "07 ROSE / ALINE") não viram duas pessoas: quem ocupa naquele dia vem
  de regra vigente ou fonte confirmada (`ocupantes` na lib); sem isso, é PENDÊNCIA.
- **Ordem por hospital e turno:** só os números da cor do hospital, na **posição física** da
  coluna — **manhã de cima para baixo; tarde de baixo para cima** (a manhã invertida). Nunca
  ordenar por valor nem por nome: "44 → 01" é sequência normal. A lib já devolve a tarde
  invertida — quem consumir NÃO inverte de novo.
- **Colunas em cinza = feriado**: sem validade, há escala própria do feriado. Não usar os
  números nem reaproveitar o dia anterior; se a escala do feriado não estiver disponível,
  registrar a ausência. Na edição vigente: 25/08 (Chapecó), 07/09, 12/10, 02/11, 20/11.
- **Exceção da Louise (nº 43):** trabalha só à tarde (13h–19h). Quadro próprio "ESCALA LOUISE —
  POSIÇÕES TURNO VESPERTINO": a **letra é o hospital do dia** e o **ordinal é a POSIÇÃO** em
  que ela entra na ordem da tarde (posição, não número da legenda). Primeiro monta-se a
  sequência vespertina; depois Louise é **inserida** na posição (1 = primeira) — o ocupante e
  os seguintes descem uma casa; ninguém sai. Só o hospital indicado, só a tarde. Durante a
  exceção o 43 NÃO está na grade (inserir pelo 43 duplicaria). Na edição vigente o quadro vai
  de 24/08 a 20/11 e o 43 volta à grade em 23/11 (o arquivo chega a dezembro apesar do nome).
  Ordinal em cinza com letra colorida (05/11 e 06/11) é ambíguo → pendência, não dedução.
- **Férias (Pega Plantão) — cruzamento obrigatório** antes de fechar a lista: casar identidade
  (legenda × nome completo; `CADASTRO_LEGENDA` na lib espelha o dicionário de apelidos),
  excluir quem está de férias no dia preservando a ordem relativa, registrar exclusões e fonte.
  Ausência numa escala de plantão NÃO prova férias. **Ordem das operações: base → inserir
  Louise → retirar férias** (a posição dela referencia a escala principal; a retirada só
  compacta). Nunca escolher substituto. Sem acesso ao PP ou identidade ambígua → lista
  **pendente de conferência** (a lib faz isso quando `ferias` é `null`).
- **Resultado** (`formatarOrdem`): data, turno, hospital; lista com posição final, número e
  nome; consultório à parte; Louise quando houver; exclusões por férias com a fonte; pendências.

## Ao receber uma escala numérica NOVA (o dono cola o PDF/imagem aqui)

1. Copiar o arquivo para `.local/escala-numerica/` (gitignored — o PDF tem os nomes do grupo;
   o JSON extraído é o que vai ao repo). Renderizar (`pdftoppm -r 150 -png`) e OLHAR as páginas:
   cabeçalhos, cores, quadro da Louise, legenda.
2. `.local/venv-pdf/bin/python scripts/extrair-escala-numerica.py <pdf> <ano>` (venv:
   `python3 -m venv .local/venv-pdf && .local/venv-pdf/bin/pip install pdfplumber`). Ler os
   `avisos` do JSON: cabeçalho inesperado, cor sem hospital, Louise com contagem errada.
3. Conferir contra a imagem: um dia com R vermelho, um com U vermelho, uma coluna cinza, a
   inserção da Louise (se houver quadro) e um dia com férias. `npx vitest run
   src/__tests__/lib/escalaNumericaOrdem.test.js` — atualizar as datas/valores dos testes
   para a edição nova (eles travam a edição vigente, não a regra).
4. Conferir a legenda contra `escala_anestesista_alias` (`query-ro.mjs`): nome novo ou grafia
   nova → atualizar `CADASTRO_LEGENDA` na lib.
5. Commit do JSON + testes; o PDF não entra.

Regime novo (jornada diferente, fim da exceção da Louise, hospital novo) NÃO se deduz do
padrão: confirmar com o dono antes de aplicar fora do intervalo impresso.

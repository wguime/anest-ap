---
paths:
  - "src/lib/escalaNumerica.js"
  - "src/lib/posPlantao.js"
  - "src/lib/trocasFeriado.js"
  - "src/pages/escala-numerica/**"
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
<data> [hospital|todos] [turno|ambos]` (consulta o Pega Plantão sempre; `--sem-ferias` só sem
rede, e a lista sai pendente), férias `node scripts/ferias-pega-plantao.mjs
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
  HUMBERTO / ROBERTA", "07 ROSE / ALINE"): nos dias úteis **o par é a posição, exatamente como
  impresso** (dono 03/09) — não se escolhe um dos dois nem vira pendência; `ocupantes` na lib
  só quando o dono informar quem está naquele dia. Na escala de feriados cada um aparece por
  si, como todos os outros. **Quando a escala do turno (foto/rodapé) traz só UM dos dois, vale o
  que saiu na escala** — a dupla resolveu entre si (dono 03/09): `aplicarEscalaNasDuplas`/
  `compararComRodape` trocam o par pelo nome que apareceu e isso NÃO é divergência.
- **Ordem por hospital e turno:** só os números da cor do hospital, na **posição física** da
  coluna — **manhã de cima para baixo; tarde de baixo para cima** (a manhã invertida). Nunca
  ordenar por valor nem por nome: "44 → 01" é sequência normal. A lib já devolve a tarde
  invertida — quem consumir NÃO inverte de novo.
- **Colunas em cinza = feriado**: sem validade, há escala própria do feriado. Não usar os
  números nem reaproveitar o dia anterior. Na edição vigente: 25/08 (Chapecó), 07/09, 12/10,
  02/11, 20/11 — e **feriado válido é só o que está no documento** (dono 04/09): 15/11, 24/12,
  25/12, 31/12 e 01/01 estão em `FERIADOS_2026` do app mas NÃO na folha publicada, e o
  Carnaval está na folha sem ser fila única no app. **A escala de feriados** (PDF "FERIADOS <ano>", `feriados.dias` no dataset,
  extraída por `scripts/extrair-feriados-numerica.py`) é uma **FILA ÚNICA por feriado** —
  todos os hospitais, 20 nomes, **manhã do 1º ao último de cima para baixo, tarde invertida**
  (dono 03/09). Louise já vem impressa quando trabalha (nada a inserir). Nomes sem sobrenome
  ("GUILHERME", "JOAO") são resolvidos por `APELIDOS_FERIADO` na lib — em FERIADOS 2026,
  **GUILHERME = Guilherme Melo (04) e JOAO = João Ricardo (06)** (dono 03/09); edição nova
  sem resposta → sem número e pendência. Daniela, Nathalia, Rômulo, Guilherme D e João
  Henrique não estão em feriado nenhum de 2026. Feriado sem escala própria no dataset =
  registrar a ausência, nunca reaproveitar a grade.
- **Exceção da Louise (nº 43):** trabalha só à tarde (13h–19h). Quadro próprio "ESCALA LOUISE —
  POSIÇÕES TURNO VESPERTINO": a **letra é o hospital do dia** e o **ordinal é a POSIÇÃO** em
  que ela entra na ordem da tarde (posição, não número da legenda). Primeiro monta-se a
  sequência vespertina; depois Louise é **inserida** na posição (1 = primeira) — o ocupante e
  os seguintes descem uma casa; ninguém sai. Só o hospital indicado, só a tarde. Durante a
  exceção o 43 NÃO está na grade (inserir pelo 43 duplicaria). Na edição vigente o quadro vai
  de 24/08 a 20/11 e o 43 volta à grade em 23/11 (o arquivo chega a dezembro apesar do nome).
  Ordinal em cinza com letra colorida (05/11 e 06/11 na edição de 2026) foi ERRO de
  formatação (dono 03/09): o quadro vale e a Louise entra normalmente; o extrator só registra
  o fato (`ordinalCinza`).
- **Férias (Pega Plantão) — cruzamento obrigatório e SEMPRE na hora** (dono 03/09: "sempre há
  mudanças de última hora" — nunca reaproveitar consulta antiga nem cache): casar identidade
  (legenda × nome completo; `CADASTRO_LEGENDA` na lib espelha o dicionário de apelidos),
  excluir quem está de férias no dia preservando a ordem relativa, registrar exclusões e fonte.
  Ausência numa escala de plantão NÃO prova férias. **Ordem das operações: base → inserir
  Louise → retirar férias** (a posição dela referencia a escala principal; a retirada só
  compacta). Nunca escolher substituto. Sem acesso ao PP ou identidade ambígua → lista
  **pendente de conferência** (a lib faz isso quando `ferias` é `null`).
- **Resultado** (`formatarOrdem`): data, turno, hospital; lista com posição final, número e
  nome; consultório à parte; Louise quando houver; exclusões por férias com a fonte; pendências.

## Pós-plantão — quem fez a noite da véspera (dono 03/09/2026)

Vale **de segunda a sexta**, na tela de consulta (`src/lib/posPlantao.js`):

- **Manhã:** o P1 da noite (HRO) e o P2 (Unimed) assumem a **2ª posição do hospital em que
  plantonaram**, abaixo do plantão da manhã. Eles **saem da coluna que a numérica lhes deu** —
  vale o hospital do plantão, não o da grade. Caso real: na noite de 03/09 o ROMULO foi P1
  (HRO) e a numérica de 04/09 o traz na Unimed; ele atravessa para o HRO. Quem não está na
  grade do dia entra assim mesmo, identificado pela legenda; identidade desconhecida NÃO entra.
- **Tarde:** não são escalados, mas **ficam na posição que a numérica lhes dá**, com
  "(pós plantão)" ao lado do nome. Ninguém é renumerado (mesma escolha das férias: marcar, não
  sumir). Abaixo de 400px o rótulo encolhe para "(pós)" — senão o nome é que truncava.
- **Fonte do plantão noturno:** de terça a sexta é o **Pega Plantão**, na data da VÉSPERA, nos
  registros que começam às 19h. Na **segunda** a véspera é domingo e o domingo à noite NÃO
  existe no Pega Plantão (conferido em 23/08 e 30/08: só o P11 de 24h) — vem da faixa `19-07`
  da **grade do documento de fim de semana** (`escala_cirurgica` linha `hospital='fds'`,
  `fds_meta.grade`, via `svc.fetchEscala(domingo, 'fds')`).
- Sexta à noite não gera pós-plantão: o sábado não tem escala numérica.
- Em **feriado** a tela mostra a fila única e a regra NÃO roda (não há coluna por hospital).

## Trocas de FERIADO (dono 03/09/2026)

Com aceite da contraparte, notificação só para quem precisa agir, e dois escopos: trocar de
FERIADO com um colega (cada um assume a posição do outro) ou trocar de POSIÇÃO no mesmo
feriado. Firestore `trocas_feriado`; **não há coleção de override** — a troca aceita é o fato e
`aplicarTrocasNaFila` a aplica na leitura. ⚠️ A regra do Firestore exige deploy à mão.
Identidade: `identificarNaLegenda` devolve **null quando ambíguo** — "GUILHERME" casa com MELO
(04), STAUB (13) e GUILHERME D (41), e as chaves "10"–"44" do JSON vêm ANTES de "01"–"09".

## As três fontes de conferência (dono 03–04/09)

Cada tipo de dia tem uma referência que NÃO passa pela leitura da foto. Divergência é sempre
AVISO, nunca bloqueio: troca, ajuda e consultório escalado mudam a fila de propósito.

| Dia | Referência | Onde compara | Regra |
|---|---|---|---|
| Útil | escala numérica (`dias`) | `ImportarEscalaPage` (rodapé lido) | ordem exata; férias descontadas |
| Feriado | folha "FERIADOS \<ano\>" (`feriados.dias`) | `ImportarEscalaFdsPage` (lista lida) | ordem exata; **só valem os feriados do documento** (dono 04/09) |
| Fim de semana | **Pega Plantão**, campo `Setor` ("1 - P1", "E10 - P10") | `ImportarEscalaFdsPage` (tabela de posições) | **só o SÁBADO** é consultado e vale os dois dias; P5+ é posição exata; **P1–P4 é bloco** — as mesmas 4 pessoas em ordem trocada pedem CONFIRMAÇÃO, não são erro; posição que o PP não cobre não vira acusação |

`src/lib/escalaFdsPegaPlantao.js` faz o do fim de semana; `nomesCompativeis` lá dentro casa
"GUILHERME DIDOMENICO" com "Guilherme Xavier Di Domenico" e "GUILHERME MELO" com "GUILHERME
M ELO" (token curto consome tokens CONSECUTIVOS do longo, com o primeiro nome batendo). Na
tela o casamento tem 3 camadas: dicionário de apelidos → `casarNomeComLegenda` (mapa curado:
"COSTA" é o Marcos, não o Gabriel) → `nomesCompativeis`.

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

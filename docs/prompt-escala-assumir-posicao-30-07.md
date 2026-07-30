# Escala Cirúrgica — assumir os casos do colega ASSUMINDO TAMBÉM a posição de liberação

> Este arquivo É o prompt. Abra numa aba nova do Claude Code no repo `~/dev/anest`
> e trabalhe a partir daqui. Leia a linha **Escala Cirúrgica Diária** do `CLAUDE.md`
> antes de tocar em qualquer coisa: quase toda regra de negócio dessa tela já foi
> decidida pelo dono e várias custaram bug em produção.

## Contexto

A **Escala Cirúrgica Diária** é usada ao vivo, no celular, dentro do centro
cirúrgico de três hospitais (Unimed, HRO, Materno) por ~47 anestesiologistas.
O plantonista gerencia a fila de liberação por ela; a fila corre de baixo para
cima e **liberar fora da ordem é bloqueado** pelo app.

**O caso real que motivou (30/07):** trocas administrativas entre hospitais que
NÃO saem na escala impressa. Giovana saiu na escala do HRO e Maurício na da
Unimed, mas a posição original deles é invertida. Quando a Giovana vai à Unimed
desfazer a troca e **assume a sala do Maurício** (Definir anestesista), os casos
passam para o uid dela — mas o rodapé da Unimed diz MAURICIO. Ela não está na
ordem publicada, então a derivação a joga como **linha EXTRA no fim da fila** e
ela aparece como **primeira a ser liberada**, o que está errado: ela deveria
ocupar a posição do Maurício.

## A funcionalidade pedida (decisão do dono, literal)

> "Quero que nesses casos haja uma funcionalidade para informar que ao assumir o
> lugar daquele colega esse novo colega assuma também a posição na escala de
> liberações e não fique como primeiro a ser liberado."

Ou seja: no fluxo de **Definir anestesista** (o mesmo sheet serve Completa,
Minhas e o painel da linha nas Liberações), oferecer a opção "assumir também a
posição de X na ordem de liberação". Com ela marcada, a linha do rodapé que era
do colega passa a ser da pessoa que assumiu — **na mesma posição** — e a pessoa
não vira linha extra.

A sincronização dos CASOS entre as três abas **já é garantida** (todas derivam de
`escala.casos` no context; `setAnestesistaCasos` é a action única, fix de 30/07
de manhã). O trabalho novo é a **posição** na fila + a opção no sheet.

## ⚠️ O campo minado — leia antes de desenhar

1. **`ordem_liberacao` é IMUTÁVEL no app. NUNCA escreva nela.** Reescrever o
   rodapé corrompeu a escala em 22/07; a feature "substituição de posição" foi
   REMOVIDA em 29/07; há teste travando (`liberacoesPainelLinha.test.jsx`:
   "salvar o painel inteiro só grava o override da linha — nada de ordem/casos").
   Esta funcionalidade NÃO move ninguém no rodapé — ela troca a **identidade de
   um slot existente**. Se o seu desenho precisar escrever `ordem_liberacao`,
   o desenho está errado.
2. **Marcações vão pela chave ESTÁVEL da linha** (`linha.chave` = uid do vínculo
   ou nome normalizado). Se a chave do slot mudar quando alguém assume, as
   liberações/overrides já gravados naquele slot ÓRFÃM. Recomendação forte: a
   chave do slot **não muda** — quem assume herda a chave da posição. Há
   fallback de leitura por `normNome(nomeOriginal)` em `marcaDe`/`overrideDe`
   (`LiberacoesView.jsx` ~linha 209), adicionado em 30/07.
3. **Override parcial apaga os demais campos.** Todo caminho que grava
   `linha_overrides[chave]` PARCIAL tem de reenviar os campos existentes
   (`local`, `cirurgioes`, `termino`, `observacao`, `renovado`…) — regra
   documentada no CLAUDE.md, bug real. O campo novo entra JUNTO dos existentes.
4. **A RPC de escrita é opaca — verificado em 30/07 à tarde:**
   `rpc_escala_patch_liberacao` grava `p_valor` como jsonb inteiro por chave,
   SEM whitelist de subcampos (migration `20260628200000`). Campo novo no
   override (ex.: `assumidaPor`) passa **sem migration**. A RPC de PUBLICAR
   (`rpc_salvar_escala_cirurgica`) preserva `liberacoes`/`linha_overrides` no
   upsert ("ausentes de propósito"), então republicar não apaga a assunção —
   mas CONFIRME isso com teste, porque republicação faz DELETE+reinsert dos
   casos e o vínculo caso↔pessoa muda de ids.
5. **`PATCH_HOSPITAL` faz merge sobre o estado atual** — nunca dispatch com
   `{...escala, X}` do closure (reverte escrita anterior, bug 29/07).
6. **Identidade (fixes de 30/07 que interagem com isto):**
   - `uidLocalPorNome` em `gerarColunaLiberacao`: os casos ensinam nome→uid
     local, então o rodapé MAURICIO resolve para o uid do Maurício mesmo sem
     dicionário — MAS quando a Giovana assume TODOS os casos dele, os casos
     ensinam GIOVANA→uid-giovana e MAURICIO não aparece em caso nenhum: o slot
     resolve pelo dicionário (ou nome) e fica vazio; ela vira extra. É exatamente
     o buraco que esta feature fecha.
   - **Emprestado/cruzamento**: a Giovana está no rodapé do HRO; na Unimed o
     cruzamento pode marcá-la "Ajuda (HRO)" como extra (`ajudaDeOutro`), e no
     HRO ela pode aparecer como emprestada ("Ajuda X/Unimed", `ajudandoFora`).
     Defina a PRECEDÊNCIA: posição assumida na Unimed provavelmente deve
     suprimir o badge de ajuda derivada ali (ela não é ajuda — ela assumiu a
     posição); no HRO o comportamento de emprestada pode continuar correto.
     Decisão de produto ambígua → `AskUserQuestion` com as telas dos dois lados.
   - **Contraturno posicional**: o último nome do rodapé é o plantão do
     contraturno, MESMO em azul. Se o slot assumido for o último, quem assume
     herda o selo? Provavelmente sim (a regra é posicional) — confirme com o
     dono se aparecer o caso.
7. **Liberar na ordem** (`idxProximo`/`naFila`, toast "Libere Fulano primeiro"):
   o nome no aviso tem de ser o de quem ASSUMIU, não o do rodapé.

## Caminho sugerido (verifique — não engula)

Representar a assunção como atributo do SLOT em `linha_overrides`:

```
linha_overrides[chaveDoSlot].assumidaPor = { uid, nome, por, em }
```

- `chaveDoSlot` = a chave estável da linha do rodapé do colega (uid do Maurício
  quando resolve, senão nome normalizado). A chave NÃO muda com a assunção.
- Na derivação (`gerarColunaLiberacao` — a view teria de passar os overrides,
  hoje a lib não os recebe): o slot com `assumidaPor` exibe o nome de quem
  assumiu (`nomeExibicao(uid)`), aponta `uid` para quem assumiu, consome o GRUPO
  de casos dessa pessoa (cirurgiões/salas/tempos dela) e a pessoa é REMOVIDA dos
  extras — sem linha duplicada.
- UI no `DefinirAnestesistaSheet`: ao confirmar um novo responsável, quando o
  responsável ANTERIOR ocupa posição no rodapé do turno, oferecer o toggle
  ("Assumir também a posição de Maurício na ordem de liberação"). Persistir no
  MESMO fluxo do confirmar (os dois efeitos juntos ou nenhum — decidir e testar
  o que acontece se a segunda escrita falhar).
- Desfazer: definir os casos de volta para o dono original deve limpar
  `assumidaPor` (ou oferecer limpar). Pense no caminho de erro humano.

Se no meio da verificação um desenho melhor aparecer (ex.: campo próprio fora de
`linha_overrides`), proponha com prós/contras — mas a invariante 1 não se negocia.

## Como trabalhar

- Leitura do banco: `.claude/skills/escala-cirurgica/scripts/query-ro.mjs` (SELECT-only).
- SQL novo (se precisar): `migration-validator` ANTES, aplicar com
  `node scripts/deploy-sp21-mgmt-api.mjs apply-migration <path>`.
- Decisão de UX/precedência ambígua: `AskUserQuestion`, não suposição.
- Testes que JÁ travam invariantes (não podem regredir):
  `src/__tests__/pages/liberacoesPainelLinha.test.jsx` (ordem imutável, chave
  estável, emprestado) · `src/__tests__/lib/colunaLiberacao.test.js` (identidade
  caso-uid × rodapé, contraturno, emprestado).
- ⚠️ Bomba-relógio conhecida: teste de escala que use a data/hora REAL quebra em
  outro horário (aconteceu 2× — 23h e turno da tarde). Congele o relógio
  (`vi.useFakeTimers` + `setSystemTime`) em qualquer teste novo com fixture de
  turno.
- Antes de declarar pronto: `npm run lint` (0 erros) · `npm run test:run` ·
  `npm run build` · verificação em browser real a 375px (o e2e
  `escala-cirurgica-acoes-layout.spec.ts` mede geometria; screenshot conferido a
  olho — 2 layouts quebrados foram a produção em 30/07 por pular isso).
- **NÃO faça deploy com turno em andamento sem o dono mandar.**

## Pronto quando

- Assumir os casos do colega COM a opção marcada põe quem assumiu **na posição
  do colega** na fila (não como extra/primeira a ser liberada), nas três abas,
  com realtime para os outros aparelhos.
- `ordem_liberacao` não foi escrita por nenhum caminho novo (o teste que trava
  continua verde, e um teste novo cobre o caminho da assunção).
- Marcações/overrides já gravados no slot não órfãm quando alguém assume.
- O aviso "Libere Fulano primeiro" e as notificações nomeiam quem assumiu.
- O caso Giovana↔Maurício de 30/07 é reproduzido em teste (lib + view) e o
  fluxo real foi verificado em browser.

## Rastro (30/07, para não refazer)

- Giovana: rodapé do HRO. Maurício: rodapé da Unimed. Confirme uids/apelidos com
  `query-ro.mjs` em `profiles` + `escala_anestesista_alias` na data em questão.
- `setAnestesistaCasos` (context, ~linha 473) é a action única dos 3 caminhos;
  NÃO toca em `ordem_liberacao` — confirmado por leitura em 30/07.
- `gerarColunaLiberacao` (`src/lib/colunaLiberacao.js`): extras entram antes das
  ajudas; `uidLocalPorNome` (fix 30/07) resolve rodapé por casos; emprestados
  (`ajudandoFora`) mantêm posição com `teveCasos=true` forçado.
- `rpc_escala_patch_liberacao` (migration `20260628200000`): jsonb opaco por
  chave, campo novo passa sem migration; caller via `firebase_uid()` +
  `can_write_escala_cirurgica()`.
- Fallback de leitura de marcações por `normNome(nomeOriginal)`:
  `LiberacoesView.jsx` `marcaDe`/`overrideDe` (fix 30/07).

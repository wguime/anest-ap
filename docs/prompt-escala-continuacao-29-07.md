# Escala Cirúrgica — 5 pedidos do dono (29/07/2026, tarde)

> Este arquivo É o prompt. Abra numa aba nova do Claude Code no repo `~/dev/anest`
> e trabalhe a partir daqui. Leia o `CLAUDE.md` (linha da Escala Cirúrgica Diária)
> antes de tocar em qualquer coisa: há muita regra de negócio já decidida.

## Contexto

A **Escala Cirúrgica Diária** é usada ao vivo, no celular, dentro do centro
cirúrgico de três hospitais (Unimed, HRO, Materno) por ~47 anestesiologistas,
residentes, técnicas de enfermagem e secretaria. O plantonista do turno gerencia
a fila de liberação por ela; erro nessa tela atrasa gente saindo de sala.

Os cinco pedidos abaixo vieram do dono em 29/07 à tarde, depois de usar o módulo
no dia real. Estão em ordem de dependência, não de prioridade.

---

## 1. Residentes fora da lista de anestesistas

**Por quê:** hoje o seletor mistura anestesiologistas e residentes, e o residente
não é o responsável pelo caso — ele acompanha. A lista fica poluída e dá para
escalar um residente como responsável por engano.

**Hoje:** `src/hooks/useRosterAnestesistas.js:38` inclui
`['anestesiologista', 'medico-residente']` no roster, e esse roster alimenta
TODOS os seletores de anestesista (conferência da importação, adicionar caso,
definir anestesista da sala/caso, ajuda).

Os residentes estão cadastrados **só com o primeiro nome** (Augusto, Daniel,
Guilherme, Jacinta, Raffaela, Rodrigo, Roosewelt, Wagner) e **está certo assim**
— decisão do dono em 29/07: não há nome repetido entre eles, então o primeiro
nome basta para identificar. Não "complete" esses cadastros.

**O que fazer:**
- Tirar `medico-residente` do roster de **anestesista** (o hook passa a devolver
  só `anestesiologista`).
- **Campo próprio "Residente" DENTRO de cada card de cirurgia** — decisão do dono
  em 29/07: *"é um campo dentro de cada card de cirurgia que seja possível
  acrescentar o nome do residente"*. Ou seja: o residente é por CASO, não por
  sala e não por linha da fila. Entra no detalhe do caso
  (`CasoDetalheSheet.jsx`, o mesmo sheet que a aba Liberações abre desde 29/07)
  e no `AddCasoSheet.jsx`, e o nome aparece no `CasoCard` (`BoardView.jsx`)
  junto do cirurgião/anestesista.
- Use um **seletor dos residentes cadastrados** (mesma lista que sai do roster de
  anestesista), não texto livre: guardando o uid, a aba "Minhas" do residente
  passa a poder mostrar os casos dele. Grave uid + nome de exibição, como já é
  feito com `anestesista` / `anestesistaUserId`.
- O residente precisa aparecer no caso sem virar o responsável: quem responde
  pelo caso continua sendo o anestesiologista, e a coluna de liberação continua
  derivando só do anestesista.

**Atenção (custa caro se esquecer):**
- Coluna nova em `escala_cirurgica_caso` exige **quatro** lugares: migration,
  `CASO_FIELDS` e `CAMEL_TO_SNAKE` em `src/services/supabaseEscalaCirurgicaService.js`
  **e a RPC `rpc_salvar_escala_cirurgica`**, que enumera as colunas do INSERT —
  sem recriar a RPC, o campo é descartado em silêncio ao publicar a escala.
- Residentes têm login e continuam vendo a aba "Minhas": se o caso guarda o
  residente, a aba Minhas dele deve considerar esse campo.

**Pronto quando:** nenhum residente aparece em nenhum seletor de anestesista;
dá para anexar um residente a um caso, publicar a escala e o residente sobrevive
ao ciclo publicar → recarregar; `npm run test:run` verde.

---

## 2. Tirar a troca do app — no lugar, um campo livre de observação

**Por quê:** decisão do dono em 29/07: *"quero que retire a funcionalidade de
troca (apenas deixe um campo em aberto para observação)"*. A troca automatizada
já tinha sido reduzida duas vezes (o sistema de propor/aceitar foi aposentado em
23/07; a troca de posições entre hospitais entrou em 27/07) e continua sendo
complexidade que o dia real não paga. Quem troca de hospital ou de sala escreve
isso em uma linha de texto — o plantonista lê e resolve.

**Hoje:** o painel da linha (lápis na aba Liberações) tem o bloco "QUEM ESTÁ
NESTA POSIÇÃO" com o botão "Substituir nesta posição", que reescreve o rodapé do
turno, move os casos da linha para o substituto e, se o escolhido tem posição em
outro hospital, troca as posições nas DUAS escalas e grava a nota `troca` nos
dois cards. Envolve `pedirConfirmacao` / `confirmarSubstituicao` / o painel âmbar
de confirmação (`LiberacoesView.jsx`), `substituirPosicao` / `localizarPosicao`
(`EscalaCirurgicaPage.jsx`) e a nota `troca` em `setLinhaOverride` (context).

**O que fazer:**
- **Remover** todo esse caminho: o bloco no painel, as duas funções da página, a
  nota `troca` e o badge "Troca / Troca com X · Hospital" do card. Junto com ele
  saem `onSubstituir` e `localizarPosicao` das props da view.
- No lugar, um campo **"Observação"** no painel da linha: texto livre, curto,
  que aparece no card da fila (defina onde — abaixo do cirurgião é o candidato
  natural, é lá que já ficam as infos da linha). Vazio = não aparece nada.
- Deve dar para editar e limpar, como os outros ajustes da linha.
- Vale reaproveitar a mecânica que já existe: guarde em
  `linha_overrides[chave].observacao` via `setLinhaOverride`
  (`EscalaCirurgicaContext.jsx`), ao lado de `local`/`cirurgioes`/`termino`. A
  chave é `linha.chave` (uid do vínculo ou nome normalizado) — **nunca** o nome
  exibido. Confira o tratamento de `renovado`: a observação deve seguir a mesma
  regra dos outros campos (some ao "Restaurar automático", sobrevive a um salvar
  com os demais campos vazios).
- Notas `troca` que existirem em escalas antigas: decida entre exibir como
  observação ou simplesmente ignorar, e diga qual escolheu. Não deixe o card
  quebrar com o formato velho.
- Também estão parados desde 23/07, sem entrada de UI: `TrocaSalaSheet.jsx`,
  `TrocaPendenteCard.jsx`, `supabaseTrocasCirurgicasService.js`, as actions
  `propoTroca`/`aceitarTroca`/`recusarTroca`/`cancelarTroca` do context e a
  tabela `trocas_cirurgicas`. Com a troca aposentada de vez, proponha ao dono
  remover esse código morto (a tabela pode ficar — apagar dado é irreversível).
- Atualize `CLAUDE.md` e `docs/escala-cirurgica.md`: hoje os dois descrevem a
  troca entre hospitais como funcionalidade viva.

**LGPD:** é campo aberto num painel que todo o grupo enxerga. Deixe claro na
interface que é recado operacional — a escala só guarda iniciais de paciente, e
isso não pode ser furado por um texto livre.

**Pronto quando:** não existe mais nenhum caminho na interface que altere
`ordem_liberacao` ou o `anestesista_user_id` de um caso a partir da aba
Liberações (prove com teste); a observação aparece no card, edita e limpa; o app
não quebra ao abrir uma escala antiga que tenha a nota `troca`; suíte verde.

---

## 3. Badge "Ajuda" manual nas duas abas

**Por quê:** a ajuda de outro hospital vem dos nomes em azul do rodapé, mas nem
sempre a escala traz isso. Quando não vem, hoje não há como marcar.

**Hoje:** a aba Liberações tem "Adicionar anestesista (ajuda)", que escreve em
`escala.ajudaExterna[turno]` e põe a pessoa no fim da fila com o selo azul
**Ajuda**. A aba **Completa não tem nada disso**.

**O que fazer:**
- Permitir marcar/desmarcar **Ajuda** também na aba Completa (no bloco da sala ou
  no detalhe do caso — decida pelo que é menos intrusivo e diga por quê).
- Manter a fonte única: as duas abas leem `ajudaExterna` do mesmo lugar, então
  marcar numa reflete na outra na hora (é o que o dono chama de "sincronizado").

**Pronto quando:** marcar Ajuda na Completa faz o selo azul aparecer na fila da
Liberações sem recarregar, e vice-versa; desmarcar volta ao estado anterior.

---

## 4. Tempo faltante POR CIRURGIA (além do total da pessoa)

**Por quê:** hoje o cronômetro é por **linha/pessoa** ("quanto falta para essa
pessoa sair"). O dono quer também o tempo de **cada cirurgia**, e — o ponto
crítico — que o plantonista **nunca confunda** um com o outro.

**Hoje:** `linha_overrides[chave].termino` guarda um "HH:MM" por PESSOA. O card
mostra a pílula verde `~1h30`. O tempo é 100% manual por decisão do dono (a
estimativa automática foi removida em 23/07 — **não reintroduzir**).

**O que fazer:**
- Guardar um término previsto **por caso** (nova coluna em
  `escala_cirurgica_caso` — reveja o aviso das quatro camadas no item 1).
- Deixar preencher esse tempo **na aba Completa** (detalhe do caso) e **na aba
  Liberações** (o painel da linha já lista os casos da pessoa desde 29/07 —
  `casosObjDaLinha` + `CasoCard`).
- Na aba Liberações, a visualização precisa deixar claro **o que é de uma
  cirurgia específica e o que é o total da pessoa**, mantendo os dois visíveis.
  Sugestão a avaliar (não é ordem): pílula da linha = total, com rótulo tipo
  "sala"; tempo por caso mostrado junto do horário do caso, com o nome do
  procedimento ao lado. Proponha o desenho antes de implementar e valide com
  `AskUserQuestion` se houver mais de uma leitura razoável.

**Pronto quando:** dá para informar o tempo de uma cirurgia específica pelas duas
abas; o card da fila mostra os dois números sem ambiguidade (um teste de leitura:
mostre a tela a alguém e pergunte "quanto falta para o Fulano sair?" e "quanto
falta para essa cirurgia?"); o total continua sendo o que decide a cor/ordem da
fila.

---

## 5. "Plantão da manhã" também na escala da tarde

**Por quê:** a regra do plantão do turno seguinte subiu hoje de manhã valendo só
para a escala matutina (badge "Plantão da tarde"). O dono ampliou em 29/07 à
tarde: *"também pode ser válido para plantão da manhã escalado a tarde (deixar
badge plantão da manhã)"*. Quem vai pegar o plantão da manhã seguinte e está
escalado à tarde precisa sair primeiro, pela mesma razão.

**Hoje:** `src/lib/colunaLiberacao.js` marca `isProximoPlantao` **só** quando
`opts.turno === 'matutino'`; o badge em `LiberacoesView.jsx` é fixo em "Plantão
da tarde".

**O que fazer:**
- Aplicar a mesma regra no turno **vespertino**: último nome do rodapé, se
  estiver escalado, vai para o fim da lista (primeiro a ser liberado, abaixo das
  ajudas) — igualzinho ao matutino.
- O rótulo do badge muda com o turno: matutino → **"Plantão da tarde"**;
  vespertino → **"Plantão da manhã"**. Mande o rótulo pela lib ou derive do
  turno na view; não deixe o texto fixo em dois lugares.
- **Cuidado com a fase noturna:** a partir das 19h os P1–P4 do card Plantões
  assumem o topo da lista. Esses selos e a regra deles (P1/P2 fora da fila do
  "próximo a ser liberado") continuam valendo — o plantão da manhã é outra
  coisa, fica no fim da lista e não disputa com os P1–P4.
- Os testes de `src/__tests__/lib/colunaLiberacao.test.js` incluem hoje um caso
  afirmando que **no vespertino a regra não vale** — esse teste inverte de sinal
  e vira o caso do "Plantão da manhã".

**Pronto quando:** publicando uma escala vespertina, o último nome escalado do
rodapé aparece no fim da fila com o badge "Plantão da manhã" e é o próximo a ser
liberado; a escala matutina continua exatamente como está hoje; suíte verde.

---

## Regras que NÃO podem ser violadas

Todas já custaram bug em produção. O porquê está junto para você julgar os casos
de borda:

O dono reforçou em 29/07 à tarde que **tudo que ele pediu de manhã continua
valendo** — as três primeiras linhas desta tabela são exatamente isso, e os itens 1–5
acima não podem desfazê-las de raspão:

| Regra | Por quê |
|---|---|
| **Plantão do turno seguinte**: o ÚLTIMO nome do rodapé, quando está escalado, ganha badge verde e é o **primeiro a ser liberado** — vai para o fim da lista, **abaixo até das ajudas** (`isProximoPlantao`, `colunaLiberacao.js`). Vale nos DOIS turnos, com rótulo diferente — ver item 5 | pedido do dono 29/07; quem pega o próximo plantão sai primeiro para descansar |
| **Ajudas (nomes em AZUL do rodapé) vão para o fim da fila** — são as primeiras a sair, na ordem do array `ajuda_externa`: a ÚLTIMA escrita sai primeiro | é a ordem do próprio rodapé lida de baixo para cima; o item 3 (badge manual) tem de preservar isso |
| **Cauda da fila, na ordem**: …fila → ajudas → plantão da tarde | foi assim que a Unimed e o HRO ficaram corretos em 29/07; mexer nisso reordena a saída de gente real |
| **A ordem do rodapé é imutável no app** — ninguém reordena, nem o plantonista (27/07) | reescrever o rodapé automaticamente corrompeu a escala em 22/07 |
| **Liberar só na ordem** — quem não é o próximo recebe aviso, não libera | fila furada obrigava correção manual no banco |
| **Cronômetro 100% manual** | a estimativa automática enchia a coluna de "+8h53" e ninguém confiava |
| **`linhas` de `gerarColunaLiberacao` é ordem de EXIBIÇÃO** — nunca gravar `ordem_liberacao` a partir dela | carrega extras/ajudas/plantão-da-tarde; foi o bug de 29/07 |
| **Marcações vão pela chave estável** (`linha.chave`), nunca pelo nome exibido | nome muda com vínculo → marcações órfãs e linha duplicada |
| **Escala é colaborativa** — qualquer `canEdit` marca andamento e define anestesista | restringir ao dono da sala escondia o botão do board inteiro |
| **Paciente só por iniciais** | LGPD; o CHECK do banco rejeita nome completo |
| **Coluna nova lida no front** → `CAMEL_TO_SNAKE` (+ `CASO_FIELDS` + a RPC de publicar) | sem o mapa, o campo chega em snake_case e fica `undefined` em silêncio |
| **Dono tem 2 contas** — as duas ativas; a 2ª está fora dos seletores via `profiles.conta_duplicada_de` | decisão dele; não propor desativar |

## Como trabalhar

- Wave de 5+ tarefas: siga `docs/wave-execution-playbook.md`.
- SQL: valide com o agente `migration-validator` **antes** de aplicar, e aplique
  com `node scripts/deploy-sp21-mgmt-api.mjs apply-migration <path>` (a CLI do
  Supabase não está instalada). Leitura: `.claude/skills/escala-cirurgica/scripts/query-ro.mjs`.
- Decisão arquitetural ou pedido ambíguo: `AskUserQuestion`, não adivinhe.
- Antes de declarar pronto: `npm run lint` (0 erros), `npm run build`,
  `npm run test:run`, e `npm run dev` de pé.
- Deploy (sequência obrigatória): build → `git add -A` dos arquivos tocados →
  commit → **`git push origin main`** → `firebase deploy --only hosting:anest-ap`
  → `node scripts/smoke-prod.mjs`.

## Estado em que você está pegando (deploys de 29/07)

- `53291f1` — plantão da tarde: último nome escalado do rodapé sai primeiro,
  antes das ajudas, com badge verde.
- `5d59355` — correção da substituição de posição (a ordem passou a sair do
  rodapé, não da lista de exibição) + painel da linha com os casos da pessoa
  (`CasoCard` + `CasoDetalheSheet` dentro das Liberações) + painel de tempo único
  + cronômetro some quando a linha está "Livre".
  ⚠️ A parte da substituição deste commit **vai embora no item 2** — o que
  sobrevive é o painel da linha com os casos, o painel de tempo e o cronômetro.
  Os testes de `src/__tests__/pages/liberacoesSubstituicao.test.jsx` que cobrem
  a substituição saem junto; os do painel da linha ficam.
- `127934d` — uma pessoa, um nome no seletor (`profiles.conta_duplicada_de`).

Pendências abertas que o dono ainda não decidiu:
- 4 cobranças particulares duplicadas de uma escala apagada em 27/07 (ids em
  `docs/`/histórico da sessão), aguardando ok para cancelar com motivo.
- Campo "Local" da linha é só etiqueta: não move a sala dos casos de verdade.

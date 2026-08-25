# Prompt — Escala de FERIADO com fila de liberação única

> Cole o bloco abaixo numa aba nova do terminal, dentro de `~/dev/Anest`.
> Ele é autossuficiente: não depende desta conversa.
>
> **Anexos que o dono precisa arrastar junto:** a LISTA do feriado (a folha com
> "FERIADO 25/08" e os nomes), o mapa cirúrgico da Unimed e o do HRO. O do
> Materno quando houver.

---

Estou trabalhando na **Escala Cirúrgica do ANEST**, que a equipe de
anestesiologia opera no celular durante o plantão. Hoje o app tem dois modos: o
**dia útil** (três abas, seletor de hospital, uma fila de liberação por hospital)
e o **fim de semana** (uma tela só, fila de liberação ÚNICA cobrindo Unimed, HRO
e Materno). **Feriado funciona como fim de semana na vida real e como dia útil no
app** — é o buraco que quero fechar.

Amanhã, 25/08/2026, é Dia do Município em Chapecó. A equipe já mandou a escala no
formato de feriado e não há como publicá-la.

## O que muda no feriado, e por quê

**A fila é única**, como no sábado: um anestesista cobre os três hospitais e a
ordem de saída é uma só. O que difere do fim de semana é a FONTE da ordem: no
sábado ela vem de um documento com grade P1–P4 e linhas "do primeiro ao último a
ser liberado"; no feriado vem de uma **LISTA SIMPLES DE NOMES**, sem posições
numeradas e sem grade de plantão.

**A mesma lista serve os dois turnos, lida em sentidos opostos** (regra do dono):
manhã de cima para baixo, tarde de baixo para cima.

⚠️ **A folha do feriado JÁ vem na direção do rodapé** — ela NÃO é a linha
"1º→último a ser liberado" do documento de fim de semana. A diferença inverte a
fila inteira, então a prova está na própria folha de 25/08: os **13 primeiros
nomes são exatamente os 13 que têm cirurgia de manhã** nos mapas da Unimed e do
HRO, e **nenhum dos 9 últimos tem** — são esses 9 que cobrem as salas da tarde.
Como a convenção do app é "1ª posição sai por ÚLTIMO", a lista escrita já diz que
quem não tem cirurgia sai primeiro. Ou seja:

- **manhã** — `ordem_liberacao` = a folha **na ordem escrita**;
- **tarde** — a folha **de trás para frente**.

`rodapeDeOrdemDoc` continua sendo a única inversão do módulo, e nada disso
alcança o fim de semana: o `ordemLiberacaoDoc` de sáb/dom segue como está.

## Pedido

Faça o feriado publicar e operar com fila única, reusando o modo de fim de semana
em vez de criar um terceiro modo.

**A importação precisa aceitar três coisas na mesma entrada**, como já faz o fim
de semana: a **lista do feriado** (que gera a fila) e os **mapas cirúrgicos** de
Unimed, HRO e Materno (que geram as cirurgias). Dos mapas extraia apenas o que o
card mostra: **hospital, sala, cirurgião e anestesista**. Nada de paciente além
das iniciais — é regra de LGPD do projeto e o CHECK do banco rejeita nome
completo na escala.

Duas regras da tela, decididas em 24/08 depois deste prompt ser escrito, e que
o feriado herda sem trabalho extra se você reusar o caminho do fim de semana:

- **o alerta de sem-anestesista não tem pastilha**: a ação é a frase "Toque para
  definir o anestesista" ABAIXO do texto. Inline ela comia 48% da linha e o texto
  ficava com 195px; abaixo, recupera 376px por 22px de altura;
- **o recado do plantonista é cartão** com rótulo "RECADO DO PLANTONISTA",
  "autor · plantonista · hora" e "Confirmar leitura" de largura inteira.

Nenhuma das duas tem ramificação por modo — são um código só, então não há o que
"ligar" para o feriado.

**O card do feriado é o mesmo do fim de semana**, sem exceção: hospital em caixa
alta isolado abaixo do nome, sala na linha seguinte, cirurgiões em lista, e a
coluna da direita com "+ Tempo total" e "Editar". A única diferença esperada é a
ausência do selo Pn — no feriado não há posições numeradas.

## Onde o terreno já está pronto

- `src/lib/escalaFds.js` — modo fila única: `FDS_HOSPITAL` ('fds', o
  pseudo-hospital que guarda a fila), `rodapeDeOrdemDoc` (a inversão), `fds_meta`
  (jsonb do cabeçalho).
- `src/pages/escala-cirurgica/ImportarEscalaFdsPage.jsx` — a lista de documentos
  com vários anexos e a publicação em lote.
- `src/lib/escalaFdsMapas.js` — classificação do anexo (hospital pelo layout,
  data pelo cabeçalho) e o turno por caso.
- `src/pages/escala-cirurgica/LiberacoesView.jsx` — a fila (`modoFds`).
- `supabase/functions/parse-escala-cirurgica/index.ts` — a leitura por Vision;
  `modo: 'fds'` para o documento de grade, `secoesTurno: true` para os mapas.
- **A tabela de feriados já existe e 25/08/2026 está nela**: `FERIADOS_UTEIS` em
  `src/lib/feriasFeriados.js` e `FERIADO_LABELS` em `src/data/plantao2026.js`
  ("DIA DO MUNICÍPIO"). Use uma delas em vez de criar outra.
- ⚠️ `ehDiaUtil` (`src/lib/plantaoNoturno.js`) hoje considera feriado um dia
  ÚTIL, e é isso que mantém o feriado fora do modo fila única. Mudar essa função
  alcança a fase noturna e a escala de funcionárias — verifique os dois antes.

## Fronteiras

- **Não toque no fluxo de dia útil.** É decisão expressa do dono (24/08): as três
  abas, o seletor de hospital, o botão "Importar" e a ordem do card seguem como
  estão de segunda a sexta. (O recado do plantonista e o alerta de sem-anestesista
  são a exceção — o dono pediu que os dois valham igual em toda escala, e eles já
  estão assim.) A trava disso é o describe
  "o desenho da fila única não atravessa para o dia útil" em
  `src/__tests__/pages/escalaFdsTelaUnica.test.jsx` — ele tem de continuar verde.
- **`ordem_liberacao` é imutável depois de publicada.** Mudar a fila = republicar.
- **A escala não manda notificação a ninguém** desde 30/07. Nada aqui muda isso.
- **Sem mudança visual não pedida** (Regra #2 do CLAUDE.md). Se algo na tela
  precisar mudar, modele antes em HTML estático a 430px nos dois temas e mostre
  ao dono — é o método da casa.
- Migration só se for inevitável; `fds_meta` é jsonb e absorve campo novo sem SQL.

## Exemplo real, para usar como teste de aceitação

Lista do feriado 25/08/2026, na ordem em que aparece na folha:

```
FERNANDA · DANIELA · GABRIELA · OSCAR · ADRIANO · GIOVANA · MARILIO · VICENTE
TIAGO · JOAO RICARDO · RAUL · NATHALIA · GUILHERME MELO · ROSE · GABRIEL
GARIM · CURY · KLISMAN · KARINE · ALEXANDRE S · ALEXANDRE D · GUILHERME DIDOMENICO
```

O que a tela tem de mostrar depois de publicar:

- **manhã** — o primeiro a ser liberado é **GUILHERME DIDOMENICO** (fecha a lista
  e não tem cirurgia); a última, **FERNANDA** (abre a lista e opera desde as 7h30);
- **tarde** — inverte: a primeira a ser liberada é **FERNANDA**; o último,
  **GUILHERME DIDOMENICO**;
- os dois turnos com os **22 nomes**, nenhum a menos;
- todos os cards **VERDES** na publicação (regra do dono de 24/08: ninguém nasce
  liberado na fila única);
- as cirurgias dos mapas aparecendo no card de quem as faz, com hospital, sala e
  cirurgião — e as sem anestesista no alerta do topo, com a frase "Toque para
  definir o anestesista" abaixo do texto.

⚠️ Confira dois nomes contra o dicionário `escala_anestesista_alias` antes de
confiar na fila: **ALEXANDRE S** e **ALEXANDRE D** são pessoas diferentes, e
**GUILHERME MELO** e **GUILHERME DIDOMENICO** também. Primeiro nome sozinho com
mais de um dono BLOQUEIA a publicação, por regra da casa — não chute identidade.

## Pronto quando

- [ ] `npm run build` passa e `npm run dev` sobe sem erro;
- [ ] a suíte inteira verde (`npm run test:run`), incluindo os testes existentes
      de fim de semana e de dia útil;
- [ ] teste novo cobrindo a inversão da lista nos dois turnos, com a lista de 22
      nomes acima como fixture — é o núcleo da regra e o que mais tem risco de
      inverter em silêncio;
- [ ] o gate de CI `regressao-escala` passa (mudança em código da escala exige
      teste no mesmo commit);
- [ ] a tela conferida no navegador via Playwright, nos dois temas, a 430px.

Publicar de verdade em produção é decisão do dono — pergunte antes; evitar deploy
com turno em andamento é regra do projeto.

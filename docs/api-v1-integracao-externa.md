# API ANEST v1: escalas, pessoas e férias (integração externa)

API **somente leitura**, em JSON. Criada em nov/2026 para uma aplicação externa, separada do app ANEST.
Revisada em 17/11/2026 com as respostas às dúvidas do integrador.

## Acesso

- **Base:** `https://vjzrahruvjffyyqyhjny.supabase.co/functions/v1/api-v1`
- **Autenticação:** cabeçalho `Authorization: Bearer <chave>`.
  - A chave é gerada pelo administrador no Centro de Gestão → API e aparece uma única vez.
  - **Vale 1 ano. Não há aviso automático de vencimento:** quando vence, a resposta passa a ser `401`.
  - Pode haver mais de uma chave (por exemplo, uma de teste e outra de produção), cada uma revogável
    em separado. **Todas leem os mesmos dados reais.** Para testar sem dado real, use o modo de exemplo.
- **Limite:** 50 requisições por minuto por IP, fixo. Acima disso a resposta é `429` com
  `Retry-After`. Os cabeçalhos `X-RateLimit-*` vêm em toda resposta.
- **Métodos:** só `GET`. `POST`, `PUT` e `DELETE` respondem `405`.
- **Datas:** `YYYY-MM-DD`, no horário de Brasília. Rotas com período aceitam `?data=` ou `?inicio=&fim=`,
  com no máximo **62 dias**.
- **Timeout recomendado:** 15 s ou mais. As rotas que consultam o Pega Plantão (`/v1/ferias/*` e
  `/v1/escala-cirurgica/plantoes`) podem levar alguns segundos na primeira chamada.

```bash
curl -H "Authorization: Bearer $ANEST_API_KEY" \
  "https://vjzrahruvjffyyqyhjny.supabase.co/functions/v1/api-v1/v1/escala-cirurgica?data=2026-11-12"
```

### Modo de exemplo (`?exemplo=true`)

Acrescente `?exemplo=true` a qualquer rota desta página. A resposta traz **dados fictícios no mesmo
formato** e a marca `"exemplo": true`, sem consultar nenhum dado real. A chave e o escopo da rota
continuam sendo exigidos.

```bash
curl -H "Authorization: Bearer $ANEST_API_KEY" \
  "https://vjzrahruvjffyyqyhjny.supabase.co/functions/v1/api-v1/v1/ferias/extrato?exemplo=true"
```

## Identificação das pessoas

- O **`id` do anestesista** é o mesmo em todas as rotas: escala, plantões, extrato de férias e
  ausências. É o `id` de `/v1/anestesistas`. Case sempre por `id`, nunca por nome.
- O `id` vem `null` quando a pessoa não pôde ser identificada **sem ambiguidade**. A API nunca adivinha.
  Hoje 4 dos 46 sócios estão nessa situação no extrato de férias, porque o nome no Pega Plantão difere
  do cadastro do app. O grupo está corrigindo o cadastro.
- Residentes e funcionárias têm `id` próprio (por exemplo, `r2-daniel` ou `renata`), sem relação com o
  `id` dos anestesistas.

## Rotas

| Rota | Escopo | O que devolve |
|---|---|---|
| `GET /v1/escala-cirurgica` | `read:escala-cirurgica` | escala publicada por dia, hospital e turno |
| `GET /v1/escala-cirurgica/plantoes` | `read:escala-cirurgica` | plantões noturnos dos anestesistas (P1–P4) e do fim de semana |
| `GET /v1/anestesistas` | `read:anestesistas` | lista de anestesistas |
| `GET /v1/residentes` | `read:residentes` | lista de residentes |
| `GET /v1/residentes/plantoes` | `read:residentes` | plantão do residente por dia |
| `GET /v1/residentes/estagios` | `read:residentes` | rodízio de estágios por dia e turno (só dias úteis) |
| `GET /v1/funcionarias/escala` | `read:funcionarias` | sobreaviso materno e hospitais (HRO, UNIMED, Plantão Pago) por dia e turno |
| `GET /v1/ferias/extrato` | `read:ferias` | extrato de férias dos sócios no ano |
| `GET /v1/ferias/ausencias` | `read:ferias` | quem está ausente em cada dia (férias ou afastamento, com o motivo do afastamento ⚠️) |
| `GET /v1/escala-numerica` | `read:escala-cirurgica` | ordem de liberação do dia por hospital e turno (escala numérica), com as observações dos cards ⚠️ |
| `GET /v1/feriados` | `read:escala-cirurgica` | escala dos feriados do ano (fila efetiva) e todas as trocas de feriado, com justificativa ⚠️ |
| `GET /v1/plantoes` | `read:escala-cirurgica` | todos os registros do Pega Plantão por dia, inclusive licenças com o motivo ⚠️ |

⚠️ = traz **dado sensível** (veja "Dados sensíveis" no fim). As três últimas usam a **mesma chave** da
escala cirúrgica: quem tem `read:escala-cirurgica` vê tudo o que a página Escalas do app mostra.

### Escala cirúrgica: `GET /v1/escala-cirurgica`

Parâmetros:
- `?data=` ou `?inicio=&fim=`;
- opcionais `hospital=unimed|hro|materno` e `turno=matutino|vespertino`.

Só entram turnos **publicados**.

```json
{"data":[{"data":"2026-11-12","hospital":"unimed","turno":"matutino","casos":[
  {"sala":"3","ordem":1,"hora":"07:00","termino_previsto":"09:00","tempo_estimado":"2h",
   "cirurgiao":"Dr. Fulano","anestesista":{"id":"<id>","nome":"NOME"},
   "residente":null,"tipo":"eletiva","status":"terminada",
   "inicio_real":"07:10","termino_real":"08:55","sem_anestesista":false,"continuacao":false}]}],
 "meta":{"inicio":"2026-11-12","fim":"2026-11-12","hospital":null,"turno":null,"total_escalas":1,"total_casos":1}}
```

- `id: null` quando o nome da escala não está ligado a uma conta, por exemplo uma dupla "A + B".
- `sem_anestesista: true` significa que o caso não tem anestesista definido.
- `continuacao: true` significa que o caso continua do turno anterior.
- **Trocas:** o anestesista de cada caso já é o da escala **efetiva**. Quando uma troca é feita no app,
  o caso passa a mostrar quem assumiu. A API não informa se o nome veio de uma troca.
- **Horário de publicação**, observado de 15/09 a 14/11/2026 em dias úteis:
  - **manhã:** publicada na **véspera**, em geral entre 18h e 22h40, mediana 19h40;
  - **tarde:** publicada no **próprio dia**, entre 11h30 e 13h, mediana 12h.

  Para comparar com uma escala gerada por você, consulte a manhã depois das 23h da véspera e a tarde
  depois das 13h30. Um turno ainda não publicado simplesmente não aparece.

### Plantões noturnos: `GET /v1/escala-cirurgica/plantoes?data=` ou `?inicio=&fim=`

```json
{"data":[{"data":"2026-11-16","fim_de_semana":false,"plantoes":[
  {"posicao":"P1","hospital":"hro","papel":"plantonista",
   "inicio":"2026-11-16T19:00:00-03:00","fim":"2026-11-17T07:00:00-03:00",
   "anestesista":{"id":"<id>","nome":"NOME"}},
  {"posicao":"P4","hospital":null,"papel":"coringa","inicio":"…","fim":"…",
   "anestesista":{"id":null,"nome":"NOME NO PEGA PLANTÃO"}}]}],
 "meta":{"inicio":"2026-11-16","fim":"2026-11-16","fonte":"pega_plantao","total_dias":1,"total_plantoes":4}}
```

- **Fonte:** Pega Plantão, a mesma do app. Todo dia do período aparece, mesmo com a lista vazia.
- **Dias úteis** (inclui feriado): só P1 a P4 com início às 19h ou depois.
  - P1 é o plantonista do HRO.
  - P2 é o plantonista da Unimed.
  - P3 é o plantão noturno da Unimed.
  - P4 é o coringa: o `hospital` vem preenchido quando o grupo define onde ele fica no dia; caso
    contrário, vem `null`.
- **Fim de semana:** todas as posições registradas no dia, com `hospital` e `papel` `null`.
- `papel` pode ser `plantonista`, `plantao_noturno` ou `coringa`. Horários vêm com fuso `-03:00`.
- `anestesista: null` indica uma posição sem ninguém.

### Anestesistas: `GET /v1/anestesistas[?ativos=true|false]`

```json
{"data":[{"id":"<id>","nome":"NOME","apelidos":["APELIDO"],"ativo":true}],"meta":{"total":46,"ativos":null}}
```

### Residentes

- `GET /v1/residentes` →
  ```json
  {"data":[{"id":"r1-augusto","nome":"Augusto","ano":"R1"}]}
  ```
- `GET /v1/residentes/plantoes?inicio=&fim=` →
  ```json
  {"data":[{"data":"2026-11-07","residente":{"id":"r2-daniel","nome":"Daniel","ano":"R2"},"origem":"base","inicio":"07:00","fim":"07:00","duracaoHoras":24,"feriado":null}]}
  ```
- `GET /v1/residentes/estagios?inicio=&fim=` →
  ```json
  {"data":[{"data":"2026-11-13","turnos":[{"turno":"manha","residentes":[{"id":"r3-wagner","nome":"Wagner","ano":"R3","estagio":"Neuro","origem":"base"}]}]}]}
  ```

O campo `origem` diz de onde veio o nome: `base` é a escala original, `troca` é uma troca aceita e
`ajuste` é uma correção manual. A resposta sempre traz a escala **efetiva**.

### Funcionárias: `GET /v1/funcionarias/escala?inicio=&fim=`

```json
{"data":[{"data":"2026-04-04","feriado":null,
  "sobreavisoMaterno":{"funcionaria":{"id":"renata","nome":"Renata"},"inicio":"19:00","fim":"07:00","origem":"base"},
  "hospitais":[{"local":"HRO","turno":"manha","inicio":"07:00","fim":"15:00","funcionaria":{"id":"renata","nome":"Renata"},"origem":"base"}]}]}
```

A escala de dia útil do HRO, da UNIMED e do consultório ainda **não** está disponível. O app guarda só
a situação do momento, sem histórico por data.

### Férias: `GET /v1/ferias/extrato?ano=YYYY[&nome=]`

- `ano` é o ano corrente se for omitido. São aceitos de 2023 até o ano seguinte ao atual.
- `nome` aceita o nome completo ou o `nome_escala`, sem diferenciar maiúsculas nem acentos. Se não
  encontrar ninguém, a resposta é `404`.
- Os números são os mesmos da tela Extrato de Férias do app.

```json
{"ano":2026,"total":1,"socios":[{"id":"<id>","nome":"Fulano de Tal","nome_escala":"FULANO DE TAL","cota":30,
  "regra_cota":"4º ano em diante","dias_marcados":15,"dias_penalidade":2,"dias_usados":17,"saldo":13,
  "periodos":[{"inicio":"2026-07-13","fim":"2026-07-24","dias_uteis":10}],
  "penalidades":[{"data":"2026-07-15","dias_extras":2}]}]}
```

- **Quem aparece:** só os **46 sócios**, cada um com a própria cota. Rose e Aline, por exemplo, são
  sócias separadas. Quem não é sócio não entra no extrato, mas aparece em `/v1/ferias/ausencias`.
- **`nome_escala`** é o nome completo **em maiúsculas**, exatamente como está no Pega Plantão (por
  exemplo `"MARCOS TADEU CURY"`). É único entre os 46 e só muda se o cadastro no Pega Plantão mudar.
  Mesmo assim, case por `id`.
- **Quais férias entram:** não há estado de "pendente" ou "proposta". Entra tudo o que está lançado
  como Férias no Pega Plantão, mais o que o próprio sócio marca ou desmarca no app.
  - Marcação e desmarcação feitas no app valem **na hora**.
  - Mudança feita direto no Pega Plantão aparece em **até 5 minutos** (cache fixo de 5 min).
- **Saldo:** use `dias_marcados`, `dias_usados` e `saldo`, que já aplicam as regras do grupo. Fim de
  semana não conta. Feriado só deixa de contar quando a semana inteira está marcada.
- **`periodos`:**
  - `inicio` e `fim` são sempre dias úteis. Sábado, domingo e feriado no meio do período não o
    interrompem, e fim de semana marcado na ponta fica de fora.
  - `dias_uteis` é **informativo**: conta os dias de semana marcados no período, inclusive feriado.
    Por isso a soma pode passar de `dias_marcados`.
  - Um feriado marcado **abre um período novo**, então duas semanas seguidas com feriado podem vir
    como dois períodos colados. Para juntá-los, trate como contínuos dois períodos em que o primeiro
    dia útil depois do `fim` de um é o `inicio` do outro.
- **Virada do ano:** cada ano traz só os dias dele. Um período de 28/12 a 10/01 aparece **cortado**:
  28/12 a 31/12 em `?ano=2026` e a parte de janeiro em `?ano=2027`.

### Ausências: `GET /v1/ferias/ausencias?data=` ou `?inicio=&fim=`

Lista, por dia, quem está ausente, para não escalar essas pessoas. Na linha `ausente`, `motivo` traz o
setor do afastamento no Pega Plantão (ex.: `"LICENÇA SAÚDE"`) — **dado sensível**; em `ferias`, `null`.

```json
{"data":[
  {"data":"2026-07-14","pessoa":{"id":"<id>","nome":"Fulano de Tal"},"tipo":"ferias","motivo":null},
  {"data":"2026-07-14","pessoa":{"id":"<id>","nome":"Beltrano"},"tipo":"ausente","motivo":"LICENÇA SAÚDE"},
  {"data":"2026-07-16","pessoa":{"id":null,"nome":"NOME NO PEGA PLANTÃO"},"tipo":"ausente","motivo":"LICENÇA MATERNIDADE"}],
 "meta":{"inicio":"2026-07-13","fim":"2026-07-17","total":3,"fonte":"pega_plantao+ferias_movimentacoes","tipos":{"…":"…"}}}
```

- `tipo: "ferias"` vem do mesmo cálculo do extrato.
- `tipo: "ausente"` é qualquer outro afastamento registrado no Pega Plantão.
- Se a pessoa tiver os dois no mesmo dia, sai uma linha só, como `ferias`.
- Inclui anestesistas que não são sócios. O período pode atravessar a virada do ano.

### Escala numérica: `GET /v1/escala-numerica?data=` ou `?inicio=&fim=` (até 62 dias)

A ordem de liberação esperada de cada dia, **exatamente como a tela "Escala Numérica" do app**: a
escala numérica do grupo, com o pós-plantão aplicado e quem está fora marcado na posição (ninguém é
removido nem renumerado). A tarde já vem invertida — não inverta de novo.

```json
{"data":[{"data":"2026-11-04","dia_semana":"quarta","tipo":"dia_util","feriado":null,
  "turnos":[{"turno":"matutino","rotulo":"Manhã",
    "hospitais":[{"hospital":"hro","rotulo":"HRO","trabalhando":17,
      "lista":[
        {"posicao":1,"numero":"04","nome_legenda":"MELO","nome":"Guilherme Melo",
         "anestesistas":[{"id":"<id>","nome":"GUILHERME SOUZA MELO"}],
         "situacao":null,"rotulo":null,"posto_plantao":null,"destino":null,
         "em_ferias":[],"inserida":false,"trocado":false},
        {"posicao":2,"numero":"30","nome_legenda":"ROMULO","nome":"Rômulo Roxo","anestesistas":[…],
         "situacao":"plantao_noturno","rotulo":"plantão P1 · noite","posto_plantao":"P1", "…":"…"}],
      "observacao":{"texto":"texto livre do card","atualizado_em":"2026-11-03T20:00:00+00:00"}}],
    "consultorio":{"lista":[…],"observacao":null},
    "pendencias":[]},
   {"turno":"vespertino", "…":"…"}]}],
 "meta":{"inicio":"2026-11-04","fim":"2026-11-04","total_dias":1,
         "edicao":{"ano":2026,"vigencia":{"inicio":"2026-08-03","fim":"2026-12-18"}},
         "ferias_conferidas":true,"situacoes":{"…":"…"}}}
```

- `tipo`: `dia_util` (três hospitais + consultório), `feriado` (fila única: `turnos[].lista`, todos os
  hospitais), `fim_de_semana` (a numérica não vale: `fim_de_semana` traz os postos P1…P12 do Pega
  Plantão, lançados no sábado — o domingo usa o sábado anterior, `sabado_referencia`) ou
  `fora_da_vigencia` (a edição publicada não cobre a data).
- `situacao`: `ferias`, `ausente` (licença), `pos_plantao` (fez a noite; à tarde não trabalha),
  `plantao_noturno` (fez a noite; de manhã **trabalha**, na 2ª posição do hospital do plantão),
  `lugar_vago` (lugar de quem subiu para o plantão em outro hospital — `destino` diz para onde; não é
  ninguém ali) ou `null`. Linha com `ferias`/`ausente`/`pos_plantao` fica na posição mas não trabalha.
- `trabalhando`: quantos trabalham no turno (só HRO e Unimed, como no app).
- `nome_legenda` é o nome impresso na escala do grupo; `anestesistas` traz uma pessoa por nome — a
  **dupla** ("HUMBERTO / ROBERTA") traz as duas. `inserida: true` = a Louise, inserida pelo quadro
  dela na tarde.
- `observacao`: texto livre que a equipe escreve embaixo de cada card (por dia, turno e hospital/
  consultório) — **dado sensível** (texto livre). Sem autor.
- `ferias_conferidas: false` = o Pega Plantão não respondeu: a lista sai sem as marcas de férias,
  licença e plantão da noite, como no app.

### Feriados: `GET /v1/feriados[?ano=YYYY]`

A escala de cada feriado (fila única, todos os hospitais) **já com as trocas aceitas aplicadas**, e a
lista de todas as trocas de feriado do ano, em qualquer status.

```json
{"ano":2026,
 "feriados":[{"data":"2026-11-20","nome":"Consciência Negra","dia_semana":"sexta",
   "fila":{"matutino":[{"posicao":1,"numero":"…","nome_legenda":"…","anestesistas":[…],"situacao":null,"trocado":true,"…":"…"}],
           "vespertino":[…]}}],
 "trocas":[{"codigo":"FR123456","status":"pendente","escopo":"data",
   "feriado":{"data":"2026-11-20","nome":"Consciência Negra"},
   "feriado_desejado":{"data":"2026-11-02","nome":"Finados"},
   "de":{"id":"<id>","nome":"…"},"para":{"id":"<id>","nome":"…"},
   "justificativa":"texto escrito por quem pediu",
   "criada_em":"2026-10-05T10:00:00Z","decidida_em":null}],
 "meta":{"total_feriados":10,"total_trocas":1,"ferias_conferidas":true}}
```

- A tarde é a manhã invertida. `trocado: true` marca quem entrou por troca.
- `status` da troca: `pendente`, `aceita`, `rejeitada` ou `cancelada`. Só as `aceita` mudam a fila.
  `escopo`: `data` (troca de feriado entre duas pessoas) ou `posicao` (troca de lugar no mesmo feriado).
- `justificativa` é texto livre — **dado sensível**.
- Só existe a escala do ano publicado; outro `ano` devolve listas vazias com `meta.aviso`.

### Registros do Pega Plantão: `GET /v1/plantoes?data=` ou `?inicio=&fim=` (até 62 dias)

Tudo o que está lançado no Pega Plantão em cada dia (por dia de início), menos férias (que estão em
`/v1/ferias/ausencias`). Diferente de `/v1/escala-cirurgica/plantoes`, que é a visão do app (só o
noturno P1–P4 no dia útil, com hospital), aqui vem o registro como está no Pega Plantão.

```json
{"data":[{"data":"2026-11-10","plantoes":[
  {"posicao":"P1","setor":"1 - P1","tipo":"Noturno","inicio":"2026-11-10T19:00:00-03:00",
   "fim":"2026-11-11T07:00:00-03:00","anestesista":{"id":"<id>","nome":"…"},"licenca":false,"motivo":null},
  {"posicao":null,"setor":"LICENÇA SAÚDE","tipo":"…","inicio":"2026-11-10T07:00:00-03:00",
   "fim":"2026-11-10T19:00:00-03:00","anestesista":{"id":"<id>","nome":"…"},"licenca":true,"motivo":"LICENÇA SAÚDE"}]}],
 "meta":{"total_plantoes":1,"total_licencas":1,"fonte":"pega_plantao"}}
```

- Licença: `licenca: true`, `posicao: null` e `motivo` = setor do Pega Plantão — **dado sensível**.
- O fim de semana é lançado no **sábado** e vale 48 h; o domingo quase não tem registro próprio.

## Erros

| Status | `error` | Quando |
|---|---|---|
| 400 | `invalid_parameter` | data inválida, período acima de 62 dias, filtro desconhecido |
| 401 | `invalid_token` | chave ausente, errada, **vencida** ou revogada |
| 403 | `forbidden` (+ `required_scope`) | a chave não tem o escopo da rota |
| 404 | `not_found` | rota inexistente, ou `nome` sem correspondência nas férias |
| 405 | `method_not_allowed` | método diferente de GET |
| 429 | `rate_limit_exceeded` | mais de 50 requisições por minuto |
| 500/502 | `internal_error` / `upstream_unavailable` | falha interna ou do Pega Plantão (tente de novo em instantes) |

## O que a API NÃO entrega (LGPD)

Estes dados ficam fora por decisão do grupo:
- dados de paciente da escala cirúrgica: iniciais, idade, procedimento, convênio, gravidade,
  observações do caso e a foto da escala;
- e-mails, CPF, CRM e telefones;
- quem registrou cada marcação de férias, quem escreveu cada observação e quem respondeu cada troca.

## Dados sensíveis (incluídos por decisão do grupo)

Por decisão expressa do grupo (controlador dos dados, nov/2026), a API entrega também:

| Campo | Rota | Por que é sensível |
|---|---|---|
| `motivo` | `/v1/ferias/ausencias`, `/v1/plantoes` | motivo de licença/afastamento é **dado de saúde** (LGPD, art. 11) |
| `observacao` | `/v1/escala-numerica` | texto livre escrito pela equipe |
| `justificativa` | `/v1/feriados` (trocas) | texto livre escrito por quem pediu a troca |

Esses campos só podem ser tratados nos termos do **contrato de operador de dados** assinado com o
grupo: finalidade combinada, acesso restrito a quem precisa, sem repasse a terceiros, armazenamento
protegido e exclusão ao fim do contrato. Se a sua aplicação não precisa deles, descarte-os ao receber.

Os dados de anestesistas, residentes e funcionárias continuam sendo **dados pessoais**. O uso está
restrito à finalidade combinada no contrato de tratamento de dados com o grupo. Não podem ser
repassados a terceiros e devem ser apagados ao fim do contrato.

---

### Para quem mantém o ANEST

- **Código:** `supabase/functions/api-v1/` (numérica e feriados em `_escala-numerica.ts`, registros do
  PP em `_plantoes-pp.ts`; libs da numérica COPIADAS em `_lib-numerica/` por
  `node scripts/gerar-libs-numerica-api-v1.mjs` — rodar e redeployar a cada edição nova da escala
  numérica/feriados ou mudança nas libs; o teste `apiV1EscalaNumerica` acusa se esquecer)
  - `_escala-cirurgica.ts`, `_plantoes.ts`, `_pessoas-escalas.ts`, `_ferias.ts`, `_ausencias.ts`,
    `_exemplos.ts`
  - contrato em `_contrato.ts`
  - views `vw_api_escala_cirurgica` e `vw_api_anestesistas`, criadas em `20261112150000`
- **Regenerar e republicar** a api-v1 quando mudar `src/data/residencia2026.js`, `plantao2026.js`,
  `sobreavisoMaterno2026.js`, `hospitaisTecnicas2026.js` ou as libs de férias (troca anual de sócios
  ou feriados):
  ```bash
  node scripts/gerar-dados-api-v1.mjs
  node scripts/gerar-libs-ferias-api-v1.mjs
  ```
  Os testes `src/__tests__/functions/apiV1*.test.js` falham se as cópias ficarem velhas ou se uma rota
  nova ficar sem exemplo.
- **`id` nulo no extrato/ausências/plantões:** o nome do Pega Plantão não casa com nenhum cadastro.
  Corrigir cadastrando o nome do PP como apelido da pessoa (`escala_anestesista_alias`, o mesmo
  dicionário da escala), sem mexer em código e sem trocar o nome exibido no app. Feito em 17/11/2026
  para OSCAR AUGUSTO DE OLIVEIRA MORAIS, JANAINA SANCHES FAVORITO MORAIS, MATHEUS VIEIRA DA CUNHA e
  GUILHERME XAVIER DI DOMENICO → 46/46 sócios com id. Sócio novo no PP com nome diferente do cadastro:
  repetir.
- **Secrets do projeto** usados por esta função: `FCM_SERVICE_ACCOUNT_JSON` (leitura do Firestore) e
  `PEGAPLANTAO_*`.

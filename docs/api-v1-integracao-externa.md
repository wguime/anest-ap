# API ANEST v1 — escalas, pessoas e férias (integração externa)

API **somente leitura**, em JSON. Criada em nov/2026 para uma aplicação externa, separada do app ANEST.

## Acesso

- **Base:** `https://vjzrahruvjffyyqyhjny.supabase.co/functions/v1/api-v1`
- **Autenticação:** cabeçalho `Authorization: Bearer <chave>`.
  - A chave é gerada pelo administrador no Centro de Gestão → Tokens de API e aparece uma única vez.
  - Vale 1 ano e pode ser revogada a qualquer momento.
- **Limite:** 50 requisições por minuto por IP. Acima disso a resposta é `429` com `Retry-After`. Os cabeçalhos `X-RateLimit-*` vêm em toda resposta.
- **Métodos:** só `GET`. `POST`, `PUT` e `DELETE` nestas rotas respondem `405`.
- **Datas:** `YYYY-MM-DD`, no horário de Brasília. Rotas com período aceitam `?data=` ou `?inicio=&fim=`, com no máximo **62 dias**.

```bash
curl -H "Authorization: Bearer $ANEST_API_KEY" \
  "https://vjzrahruvjffyyqyhjny.supabase.co/functions/v1/api-v1/v1/escala-cirurgica?data=2026-11-12"
```

## Rotas

| Rota | Escopo | O que devolve |
|---|---|---|
| `GET /v1/escala-cirurgica` | `read:escala-cirurgica` | escala publicada por dia, hospital e turno |
| `GET /v1/anestesistas` | `read:anestesistas` | lista de anestesistas |
| `GET /v1/residentes` | `read:residentes` | lista de residentes |
| `GET /v1/residentes/plantoes` | `read:residentes` | plantão do residente por dia |
| `GET /v1/residentes/estagios` | `read:residentes` | rodízio de estágios por dia e turno (só dias úteis) |
| `GET /v1/funcionarias/escala` | `read:funcionarias` | sobreaviso materno e hospitais (HRO, UNIMED, Plantão Pago) por dia e turno |
| `GET /v1/ferias/extrato` | `read:ferias` | extrato de férias dos sócios no ano |

### Escala cirúrgica: `GET /v1/escala-cirurgica`

Parâmetros:
- `?data=` ou `?inicio=&fim=`;
- opcionais `hospital=unimed|hro|materno` e `turno=matutino|vespertino`.

Só entram escalas **publicadas**.

```json
{"data":[{"data":"2026-11-12","hospital":"unimed","turno":"matutino","casos":[
  {"sala":"3","ordem":1,"hora":"07:00","termino_previsto":"09:00","tempo_estimado":"2h",
   "cirurgiao":"Dr. Fulano","anestesista":{"id":"<id>","nome":"NOME"},
   "residente":null,"tipo":"eletiva","status":"terminada",
   "inicio_real":"07:10","termino_real":"08:55","sem_anestesista":false,"continuacao":false}]}],
 "meta":{"inicio":"2026-11-12","fim":"2026-11-12","hospital":null,"turno":null,"total_escalas":1,"total_casos":1}}
```

- `anestesista.id` é o mesmo `id` de `/v1/anestesistas`.
- `id: null` quando o nome da escala não está ligado a uma conta, por exemplo uma dupla "A + B".
- `sem_anestesista: true` significa que o caso não tem anestesista definido.
- `continuacao: true` significa que o caso continua do turno anterior.

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

O campo `origem` diz de onde veio o nome: `base` é a escala original, `troca` é uma troca aceita e `ajuste` é uma correção manual. A resposta sempre traz a escala **efetiva**, com trocas e ajustes já aplicados.

### Funcionárias: `GET /v1/funcionarias/escala?inicio=&fim=`

```json
{"data":[{"data":"2026-04-04","feriado":null,
  "sobreavisoMaterno":{"funcionaria":{"id":"renata","nome":"Renata"},"inicio":"19:00","fim":"07:00","origem":"base"},
  "hospitais":[{"local":"HRO","turno":"manha","inicio":"07:00","fim":"15:00","funcionaria":{"id":"renata","nome":"Renata"},"origem":"base"}]}]}
```

A escala de dia útil do HRO, da UNIMED e do consultório ainda **não** está disponível. O app guarda só a situação do momento, sem histórico por data.

### Férias: `GET /v1/ferias/extrato?ano=YYYY[&nome=]`

- `ano` é o ano corrente se for omitido.
- `nome` aceita o nome completo ou o nome da escala, sem diferenciar maiúsculas nem acentos. Se não encontrar ninguém, a resposta é `404`.
- Os números são os mesmos da tela Extrato de Férias do app.

```json
{"ano":2026,"total":1,"socios":[{"nome":"Fulano de Tal","nome_escala":"F. TAL","cota":30,"regra_cota":"4º ano em diante",
  "dias_marcados":15,"dias_penalidade":2,"dias_usados":17,"saldo":13,
  "periodos":[{"inicio":"2026-07-13","fim":"2026-07-24","dias_uteis":10}],
  "penalidades":[{"data":"2026-07-15","dias_extras":2}]}]}
```

A primeira consulta de um ano leva alguns segundos, porque varre o Pega Plantão. Depois o resultado fica 5 minutos em cache. Se o Pega Plantão estiver fora, a resposta é `502 upstream_unavailable`.

## Erros

| Status | `error` | Quando |
|---|---|---|
| 400 | `invalid_parameter` | data inválida, período acima de 62 dias, filtro desconhecido |
| 401 | `invalid_token` | chave ausente, errada, vencida ou revogada |
| 403 | `forbidden` (+ `required_scope`) | a chave não tem o escopo da rota |
| 404 | `not_found` | rota inexistente, ou `nome` sem correspondência nas férias |
| 405 | `method_not_allowed` | método diferente de GET |
| 429 | `rate_limit_exceeded` | mais de 50 requisições por minuto |
| 500/502 | `internal_error` / `upstream_unavailable` | falha interna ou de fonte externa |

## O que a API NÃO entrega (LGPD)

Estes dados ficam fora por decisão do grupo:
- dados de paciente da escala: iniciais, idade, procedimento, convênio, gravidade, observações e a foto da escala;
- e-mails, CPF, CRM e telefones;
- motivo de licença ou atestado;
- quem registrou cada marcação de férias.

Os dados de anestesistas, residentes e funcionárias continuam sendo **dados pessoais**. O uso está restrito à finalidade combinada no contrato de tratamento de dados com o grupo. Não podem ser repassados a terceiros e devem ser apagados ao fim do contrato.

---

### Para quem mantém o ANEST

- **Código:** `supabase/functions/api-v1/`
  - `_escala-cirurgica.ts`, `_pessoas-escalas.ts`, `_ferias.ts`
  - contrato em `_contrato.ts`
  - views `vw_api_escala_cirurgica` e `vw_api_anestesistas`, criadas em `20261112150000`
- **Regenerar e republicar** a api-v1 quando mudar `src/data/residencia2026.js`, `plantao2026.js`, `sobreavisoMaterno2026.js`, `hospitaisTecnicas2026.js` ou as libs de férias (troca anual de sócios ou feriados):
  ```bash
  node scripts/gerar-dados-api-v1.mjs
  node scripts/gerar-libs-ferias-api-v1.mjs
  ```
  Os testes `src/__tests__/functions/apiV1*.test.js` falham se as cópias ficarem velhas.
- **Secrets do projeto** usados por esta função: `FCM_SERVICE_ACCOUNT_JSON` (leitura do Firestore) e `PEGAPLANTAO_*`.

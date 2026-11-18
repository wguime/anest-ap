---
paths:
  - "supabase/functions/api-v1/**"
  - "supabase/functions/generate-api-token/**"
  - "docs/api-v1-*"
  - "src/__tests__/functions/apiV1*"
  - "scripts/gerar-dados-api-v1.mjs"
  - "scripts/gerar-libs-*-api-v1.mjs"
description: api-v1 — API somente leitura entregue a uma empresa EXTERNA (escalas, pessoas, férias); o que pode sair, o filtro de saída e como manter
---

# api-v1 — API externa de escalas e férias

Desde 13/11/2026 a `api-v1` serve um programador de empresa EXTERNA, com UMA chave que tem os 5
escopos `read:escala-cirurgica`, `read:anestesistas`, `read:residentes`, `read:funcionarias` e
`read:ferias`. Manual de manutenção completo: `docs/api-v1-manutencao-interna.md`.

## O que a API entrega (e só isso)

Dados de escalas e férias. Rotas: escala cirúrgica (+ `/plantoes`), escala numérica, feriados (fila
efetiva + todas as trocas), plantões do Pega Plantão, anestesistas, residentes (+ plantões, estágios),
funcionárias (escala), férias (extrato, ausências). As 3 rotas da página /escalas (numérica, feriados,
plantões) ficam sob `read:escala-cirurgica` — sem escopo novo. Toda rota aceita `?exemplo=true`
(fixtures fictícias em `_exemplos.ts`).

Dados sensíveis que saem POR DECISÃO EXPRESSA do dono (17/11): `motivo` da licença/ausência,
`observacao` da numérica (texto livre, sem autor) e a `justificativa` das trocas de feriado. A doc
externa tem a seção "Dados sensíveis" (LGPD art. 11). Não ampliar além disso sem pedido do dono.

**Nunca sai:** dado de paciente (iniciais, idade, procedimento, convênio, gravidade, observação do
caso, foto), e-mail, CPF, CRM, autor de registro. A whitelist mora na view `vw_api_*` E de novo no TS.

## A API não revela a arquitetura do app (dono 18/11)

Toda resposta de `ROTAS_LEITURA` — real ou exemplo — passa por `_saida.ts` (`sanitizarSaida`):
- `id` sai opaco: `p_` + 20 hex de SHA-256('anest-api-v1:id:'+uid). Estável — mesma pessoa, mesmo id em
  todas as rotas. **Nunca trocar o sal**: quebra o vínculo que o integrador já gravou.
- `fonte` só `pega_plantao` ou `app` (nunca nome de tabela/coleção).
- 5xx sem `detail` técnico (`upstream_unavailable` tem texto fixo genérico); 4xx de parâmetro mantém o texto.
- rota fora da chave → **404 `not_found`**, nunca 403 nomeando o escopo.

Campo novo que carregue identificador interno precisa se chamar `id` (o filtro só reescreve `id`) ou
ganhar tratamento em `_saida.ts`. Travado por `src/__tests__/functions/apiV1Saida.test.js`.

**Docs:** `docs/api-v1-integracao-externa.md` é a ÚNICA que vai ao integrador — sem nome de arquivo,
tabela, view, secret ou script. Tudo isso vai para `docs/api-v1-manutencao-interna.md` (NUNCA enviar).

## Identidade

O nome do PP casa com o anestesista pelo dicionário `escala_anestesista_alias` (apelido em UPPER sem
acento). Sócio que aparecer com `id: null` no extrato: inserir o nome do PP como apelido apontando
para o uid, com `created_by` = uid real do dono (nunca 'system'). Nome ambíguo fica `null` — nunca
adivinhar. 46/46 com id desde 17/11.

## Manutenção

- **Cópias dentro da edge** (Deno não importa `src/`): ao mudar sócios, feriados, escalas-base ou as
  libs de férias/numérica, rodar `scripts/gerar-dados-api-v1.mjs`, `scripts/gerar-libs-ferias-api-v1.mjs`
  e `scripts/gerar-libs-numerica-api-v1.mjs` e redeployar. Os testes `apiV1*` acusam cópia velha.
- **Deploy:** `bash scripts/deploy-edge-with-pat.sh api-v1 --no-verify-jwt` (fixado em `supabase@2`).
  Precisa de confirmação do dono. Commit só de app-irrelevante → `[skip ci]`.
- **Limites:** 50 req/min por IP (janela deslizante 60 s, 429 + `Retry-After: 60`); cache do PP 5 min
  (férias/ausências), 2 min (plantões); escala cirúrgica, numérica e pessoas em tempo real; intervalo
  máximo de 62 dias; chave vale 1 ano.
- **Conferir na API real sem expor chave:** `node .tmp/smoke-api-v1-escalas.mjs` (contagens e campos
  proibidos) e `node .tmp/auditoria-api-v1-saida.mjs` (vestígio interno, uid vazado, id não opaco).
  Ambos criam chave temporária só com o hash e revogam no fim — se a revogação falhar (ECONNRESET já
  aconteceu), conferir `api_tokens` com `name like 'smoke%' and revoked_at is null` e revogar.
- **Revogar a chave da empresa:** Centro de Gestão → Painel → API Tokens.

## Pendente / fora do escopo

- Escala de dia útil das funcionárias (doc `staff/schedule` sem data) e CRM não estão na API.
- Pendências do dono: gerar a chave única (marcar os 5 de "Escalas e pessoas", desmarcar Documentos,
  Planos e Comunicados) e assinar o contrato de operador LGPD antes de entregá-la.

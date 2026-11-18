# api-v1 — manutenção interna (NÃO enviar ao integrador)

> Separado de `docs/api-v1-integracao-externa.md` em 18/11/2026: a doc externa não pode citar código,
> tabelas, Firestore, secrets nem scripts (pedido do dono: a API não revela a arquitetura do app).
> Filtro de saída em `supabase/functions/api-v1/_saida.ts` (ids opacos, `fonte` só
> `pega_plantao`/`app`, erro 5xx sem detalhe, rota fora da chave = 404) — trava em
> `src/__tests__/functions/apiV1Saida.test.js`.

## Para quem mantém o ANEST

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

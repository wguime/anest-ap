# Plan O2-5 — API Pública Read-Only (Sprint 8)

> Gerado em 2026-05-09 por feature-dev:code-architect.
> Status: **Aguardando aprovação para implementar.**

## Resumo executivo

API pública read-only para integração externa, implementada como
**edge function monolito** `supabase/functions/api-v1/index.ts` com
router interno baseado em `URL.pathname`. Espelha padrão de
`watermark-pdf`/`pdfa-convert` (autocontidos, JWT via `jose`).

- **Auth:** tabela nova `api_tokens` (SHA-256 hash + scope + revogação),
  separada do JWT interno do app. Token raw exibido uma única vez.
- **Rate limit:** sliding window 50 req/min/IP, persistido em
  `documento_api_rate_limit`, limpeza via pg_cron a cada 5 min.
- **Endpoints v1:** `GET /v1/docs`, `GET /v1/docs/:id`, `GET /v1/docs/:id/changelog`.
- **PII:** view `vw_api_documentos` (whitelist de campos) + `stripPii()`
  no edge (dupla camada).

## Arquivos a criar

| Path | Propósito |
|------|-----------|
| `supabase/migrations/20260509200000_api_tokens.sql` | Tabelas `api_tokens` + `documento_api_rate_limit` + view `vw_api_documentos` + cron cleanup |
| `supabase/migrations/20260509210000_changelog_action_api_accessed.sql` | Adiciona action `api_accessed` ao CHECK constraint do changelog |
| `supabase/functions/api-v1/index.ts` | Edge function (router + handlers + auth + rate limit) |
| `scripts/smoke-api-v1.mjs` | Smoke E2E (8 cenários incluindo rate limit hit) |
| `docs/api-publica.md` | OpenAPI light + exemplos curl |

## Sequência de build

1. Migration `20260509200000_api_tokens.sql` (idempotente)
2. Migration `20260509210000_changelog_action_api_accessed.sql`
3. Token de teste via SQL editor: `INSERT INTO api_tokens (token_hash, label, created_by) VALUES (encode(sha256('test-token'), 'hex'), 'Smoke', 'pPdKZ75E9zNdPnLz50qisPiHfJw1')`
4. Deploy: `npx supabase functions deploy api-v1 --no-verify-jwt`
5. Smoke: `API_BASE=… API_TOKEN=… node scripts/smoke-api-v1.mjs`
6. Doc OpenAPI light em `docs/api-publica.md`
7. PR `feat/sprint8-api-publica`, squash merge, bump CHANGELOG

## Riscos

1. Token entropia — UI admin DEVE usar `crypto.getRandomValues` 32 bytes (não UUID)
2. Rate limit não-atômico (par INSERT+COUNT) — aceitável para best-effort
3. Cold start Edge ~150-300ms — transparente para clientes warm
4. View `vw_api_documentos` é o contrato público — qualquer coluna nova em `documentos` precisa ser explicitamente excluída
5. Custo: 5 clientes × 50 req/min ≈ 11M req/mês → pode exceder Pro tier 2M; considerar `Cache-Control: max-age=30` na lista
6. CORS — edge usa `*` (API pública), aceitável pois auth é via Bearer

## Bloqueador para implementação

UI admin para geração/revogação de tokens (nova aba "Integrações" no
Centro de Gestão) é **mudança de DS** (nova tabela admin, nova aba).
Per regra de DS rígida (`feedback_no_ds_changes.md`), exige aprovação
**antes** de codar.

Mockup textual aprovável:

```
Centro de Gestão → aba "Integrações" (nova, após Usuários)

Cabeçalho: "Tokens de API Pública"
Botão primário: "+ Gerar Token"
  Modal:
    - Campo "Nome / Sistema integrado" (obrigatório)
    - Escopos (checkbox): docs:read (único — pré-marcado)
    - Botão "Gerar"
  Após geração:
    - Alert amarelo: "Copie agora. O token NÃO será exibido novamente."
    - Campo read-only com token raw + botão copiar
    - Botão "Fechar"

Tabela:
  Colunas: Nome | Escopos | Criado em | Último uso | Status | Ações
  Ação "Revogar" → confirm modal → seta revoked_at = now()
```

## Smoke test design — 8 cenários

1. `GET /v1/docs` 200 + shape (`data[]`, `total`, `limit`, `offset`)
2. `GET /v1/docs?categoria=etica` filtra corretamente
3. `GET /v1/docs/:id` sem campos PII (`created_by`, `storage_path`, `ocr_text`, `arquivo_url`)
4. `GET /v1/docs/:id/changelog` sem `user_id`/`user_email`
5. Token inválido → 401
6. Sem Authorization → 401
7. ID inexistente → 404
8. 55 requests seguidos → pelo menos um 429

## Decisões de arquitetura tomadas

- **Token de API:** tabela nova (não reusar JWT interno) — isolamento de ciclo de vida
- **Rate limit:** PostgreSQL sliding window (não Redis) — sem dep externa
- **Função:** monolito (não múltiplas) — segue precedente do projeto
- **Whitelist:** view + stripPii (dupla camada)
- **Paginação:** offset/limit (cursor pode vir em v2)

## Próximos passos

1. **Aprovar mockup** da aba Integrações (DS lock).
2. **Aplicar migrations** + deploy edge (eu posso fazer; auth via service-role).
3. **Implementar UI admin** (depois de aprovação).
4. **Documentar API** (`docs/api-publica.md`) e divulgar para integradores.

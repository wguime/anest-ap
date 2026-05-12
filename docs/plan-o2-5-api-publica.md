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

---

## v2 — Sprint 15b: planos-ação + comunicados

Status: **v2 release — pendente deploy migration + functions.**

Expansão read-only da API pública. Mesma edge `api-v1` (router por path),
mesma auth Bearer SHA-256, mesmo rate-limit 50 req/min/IP.

### Novos endpoints

| Método | Path | Descrição |
|--------|------|-----------|
| `GET` | `/v1/planos-acao` | Lista planos PDCA publicáveis (whitelist) |
| `GET` | `/v1/comunicados` | Lista comunicados oficiais publicados (whitelist) |

### Query params

Comuns (ambos):
- `?status=<status>` — filtra por `status` (igualdade exata)
- `?limit=<1-100>` — paginação, default 50
- `?offset=<N>` — paginação, default 0
- `?q=<termo>` — busca textual no `titulo` (ILIKE)

Extras `/v1/comunicados`:
- `?tipo=<tipo>` — filtra por `tipo` (igualdade)
- `?rop_area=<area>` — filtra por `rop_area` (igualdade)

### Whitelist de colunas

**`vw_api_planos_acao`** (11 colunas):
`id, titulo, tipo_origem, status, fase_pdca, prazo, prioridade, eficacia, tags, created_at, updated_at`.

Filtro inline: `status <> 'cancelado'`.

Excluídos (PII/free-text): `descricao, origem_id, origem_descricao, responsavel_id, responsavel_nome, created_by, created_by_name, evidencias, historico`, todos os campos PDCA/5W2H free-text (`plan_*, do_*, check_*, act_*`).

**`vw_api_comunicados`** (13 colunas):
`id, tipo, titulo, status, leitura_obrigatoria, rop_area, rop_relacionada, link, data_evento, prazo_confirmacao, data_validade, created_at, updated_at`.

Filtros inline: `status = 'publicado' AND arquivado = false AND (data_validade IS NULL OR data_validade > now())`.

Excluídos (PII/free-text/anexos): `conteudo, destinatarios, acoes_requeridas, anexos, aprovado_por, autor_id, autor_nome, arquivado`.

### Auth + rate-limit

Idêntico v1:
- `Authorization: Bearer <token>` obrigatório (SHA-256 hash em `api_tokens`).
- Rate-limit: 50 req/min por IP, persistido em `documento_api_rate_limit`.
- Headers de resposta: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

### Smoke (15 cenários totais)

Cenários 0–7 cobrem v1 (`/v1/docs`, `/v1/docs/:id`, `/v1/docs/:id/changelog`).
Cenários 8–13 adicionados em Sprint 15b para `/v1/planos-acao` e `/v1/comunicados`:

- `[8]` GET planos-acao sem Authorization → 401
- `[9]` GET planos-acao com token válido → 200 + shape
- `[10]` `data[0]` planos-acao sem PII/free-text (assertivas por chave)
- `[11]` GET comunicados sem Authorization → 401
- `[12]` GET comunicados com token válido → 200 + shape
- `[13]` `data[0]` comunicados sem PII/free-text (assertivas por chave)
- `[14]` rate-limit (opt-in via `--rate-limit-test`)

### Deploy (Wave 4)

```bash
npx supabase db push --linked
npx supabase functions deploy api-v1 --project-ref vjzrahruvjffyyqyhjny --no-verify-jwt
API_BASE=https://vjzrahruvjffyyqyhjny.functions.supabase.co \
ADMIN_JWT=… \
node scripts/smoke-api-v1.mjs
```

### Scopes granulares (decisão)

**ADIADO para Sprint 16+.** Hoje todos os tokens têm scope `'read'` único, válido
para todos os endpoints. Evolução prevista: `'read:docs'`, `'read:planos-acao'`,
`'read:comunicados'` — requer migration na coluna `scope` da tabela `api_tokens`
e tabela de listagem por scope na UI admin.

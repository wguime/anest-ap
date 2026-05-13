/**
 * Sprint 14c + Sprint 15b + Sprint 16 — Smoke E2E para a API pública v1
 * (edge api-v1) + edge admin generate-api-token. Rodar manualmente após deploy.
 *
 * Uso básico (smoke sem gerar token novo):
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... API_V1_TEST_TOKEN=... \
 *     node scripts/smoke-api-v1.mjs
 *
 * Uso completo (inclui geração de token via edge admin):
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... ADMIN_JWT=... \
 *     node scripts/smoke-api-v1.mjs
 *
 * Cenários 16–18 (Sprint 16, scope enforcement):
 *   Requerem tokens narrow-scoped (apenas 1 scope cada). Como a edge
 *   generate-api-token ainda não aceita `scopes` no body, gere via UI:
 *     Centro de Gestão → API → Gerar token → marque APENAS 1 checkbox.
 *   Exporte os tokens raw retornados nas seguintes env vars:
 *     API_V1_TOKEN_DOCS_ONLY        — token com scopes=['read:docs']
 *     API_V1_TOKEN_PLANOS_ONLY      — token com scopes=['read:planos-acao']
 *     API_V1_TOKEN_ALL              — token com os 3 scopes (default UI)
 *   Cenários 16–18 são SKIP se as 3 vars não estiverem setadas.
 *
 * Variáveis:
 *   SUPABASE_URL                — URL do projeto (ex: https://vjz...supabase.co)
 *   SUPABASE_ANON_KEY           — anon key (apikey do gateway das edges)
 *   API_V1_TEST_TOKEN           — token RAW (plain) pré-existente OU vazio
 *                                 (caso só queira testar com ADMIN_JWT)
 *   ADMIN_JWT                   — JWT custom HS256 ANEST de um user admin
 *                                 (emitido por get-supabase-token). Quando
 *                                 presente, cenário 0 chama generate-api-token
 *                                 e usa o token retornado nos cenários seguintes.
 *   GENERATE_TOKEN_ENDPOINT     — opcional, override do path do edge admin
 *                                 (default: /functions/v1/generate-api-token)
 *   API_V1_TOKEN_DOCS_ONLY      — Sprint 16, token narrow-scope read:docs
 *   API_V1_TOKEN_PLANOS_ONLY    — Sprint 16, token narrow-scope read:planos-acao
 *   API_V1_TOKEN_ALL            — Sprint 16, token com os 3 scopes
 *   API_V1_TOKEN_WRITE_DOCS         — Sprint 19, token com write:docs
 *   API_V1_TOKEN_WRITE_PLANOS       — Sprint 20, token com write:planos-acao
 *   API_V1_TOKEN_WRITE_COMUNICADOS  — Sprint 20, token com write:comunicados
 *   API_V1_TOKEN_WRITE_DOCS_ONLY    — Sprint 20, token só com write:docs
 *                                     (usado para 403 negative tests em
 *                                     /v1/planos-acao e /v1/comunicados)
 *
 * Cenários:
 *   0. (opcional, com ADMIN_JWT) POST generate-api-token → 201 { token, id, ... }
 *      Reusa o token gerado nos cenários seguintes (substitui API_V1_TEST_TOKEN).
 *   1. Sem Authorization → 401 { error: 'invalid_token' }
 *   2. Authorization: Bearer inválido → 401
 *   3. GET /v1/docs com token válido → 200 { data, pagination }, sem PII
 *   4. Headers X-RateLimit-* presentes
 *   5. GET /v1/docs/:id com id válido → 200 sem PII
 *   6. GET /v1/docs/:id zero-UUID → 404
 *   7. GET /v1/docs/:id/changelog com id válido → 200 { data, pagination }
 *   --- Sprint 15b / API v2: /v1/planos-acao ---
 *   8. GET /v1/planos-acao sem Authorization → 401
 *   9. GET /v1/planos-acao com token → 200 { data, pagination }
 *   10. Cada row em data[] NÃO tem campos PII/free-text excluídos
 *   --- Sprint 15b / API v2: /v1/comunicados ---
 *   11. GET /v1/comunicados sem Authorization → 401
 *   12. GET /v1/comunicados com token → 200 { data, pagination }
 *   13. Cada row em data[] NÃO tem campos PII/free-text excluídos
 *   14. (opt-in, --rate-limit-test) 51 reqs sequenciais → última 429
 *   --- Sprint 16: scope enforcement (require API_V1_TOKEN_*_ONLY env vars) ---
 *   16. Token com scopes=['read:docs'] → GET /v1/planos-acao → 403 + required_scope
 *   17. Token com scopes=['read:planos-acao'] → GET /v1/docs → 403 + required_scope
 *   18. Token com os 3 scopes → GET /v1/comunicados → 200
 *   --- Sprint 19: write endpoints /v1/docs ---
 *   19-26. POST/PUT/DELETE /v1/docs (com tokens narrow-scope)
 *   --- Sprint 20: write endpoints /v1/planos-acao + /v1/comunicados ---
 *   27. POST /v1/planos-acao válido → 201 + captura PLANO_ID
 *   28. POST /v1/planos-acao com token write:docs apenas → 403 write:planos-acao
 *   29. PUT /v1/planos-acao/:id (status='execucao', fase='do') → 200
 *   30. POST /v1/comunicados válido → 201 + captura COM_ID
 *   31. POST /v1/comunicados com token write:docs apenas → 403 write:comunicados
 *   32. DELETE /v1/comunicados/:id → 200 + data.arquivado=true (soft-delete)
 *
 * Exit 0 se tudo passa; 1 caso contrário.
 */

const args = process.argv.slice(2)
const RATE_LIMIT_TEST = args.includes('--rate-limit-test')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
const ADMIN_JWT = process.env.ADMIN_JWT
let API_V1_TEST_TOKEN = process.env.API_V1_TEST_TOKEN
const GENERATE_TOKEN_ENDPOINT =
  process.env.GENERATE_TOKEN_ENDPOINT || '/functions/v1/generate-api-token'

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Variáveis obrigatórias: SUPABASE_URL, SUPABASE_ANON_KEY')
  process.exit(1)
}
if (!API_V1_TEST_TOKEN && !ADMIN_JWT) {
  console.error(
    'Forneça pelo menos um de: API_V1_TEST_TOKEN (token raw existente) ou ' +
      'ADMIN_JWT (para gerar um novo via edge admin).',
  )
  process.exit(1)
}

const BASE = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/api-v1`
const ADMIN_BASE = `${SUPABASE_URL.replace(/\/$/, '')}${GENERATE_TOKEN_ENDPOINT}`

const PII_FIELDS = [
  'created_by',
  'created_by_name',
  'created_by_email',
  'updated_by',
  'updated_by_name',
  'arquivo_url',
  'storage_path',
  'arquivo_nome',
  'pdfa_url',
  'ocr_text',
  'ocr_text_url',
  'observacoes',
  'responsavel',
  'responsavel_revisao',
  'responsavel_elaboracao',
  'responsavel_aprovacao',
  'setor_id',
  'setor_nome',
]

const ALLOWED_FIELDS = new Set([
  'id',
  'titulo',
  'tipo',
  'categoria',
  'status',
  'versao_atual',
  'rop_area',
  'qmentum_weight',
  'created_at',
  'updated_at',
  'proxima_revisao',
])

let failed = 0
let passed = 0

function ok(name) {
  console.log(`  PASS  ${name}`)
  passed++
}

function fail(name, detail) {
  console.error(`  FAIL  ${name}`)
  if (detail) console.error(`        ${detail}`)
  failed++
}

async function fetchJson(url, init = {}) {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    ...(init.headers || {}),
  }
  const res = await fetch(url, { ...init, headers })
  let body = null
  const text = await res.text()
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = { _raw: text }
  }
  return { status: res.status, headers: res.headers, body }
}

// ──────────────────────────────────────────────────────────────────────────
// Cenário 0: ADMIN_JWT → generate-api-token
// ──────────────────────────────────────────────────────────────────────────
if (ADMIN_JWT) {
  console.log('\n[0] POST generate-api-token com ADMIN_JWT →')
  const r = await fetchJson(ADMIN_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ADMIN_JWT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `smoke-${new Date().toISOString().slice(0, 19)}`,
      scope: 'read',
    }),
  })

  if (r.status !== 201) {
    fail('0.1 status 201', `recebido ${r.status} body=${JSON.stringify(r.body)}`)
  } else {
    ok('0.1 status 201')
  }
  if (!r.body?.ok || typeof r.body.token !== 'string' || r.body.token.length < 32) {
    fail('0.2 body.token (plain hex) presente', `recebido ${JSON.stringify(r.body)}`)
  } else {
    ok('0.2 body.token (plain hex) presente')
    // Substitui o token usado nos cenários seguintes
    API_V1_TEST_TOKEN = r.body.token
  }
  if (!r.body?.id || typeof r.body.id !== 'string') {
    fail('0.3 body.id retornado', `recebido ${JSON.stringify(r.body?.id)}`)
  } else {
    ok('0.3 body.id retornado')
  }
}

if (!API_V1_TEST_TOKEN) {
  console.error('\nNenhum API_V1_TEST_TOKEN disponível após cenário 0. Abortando.')
  process.exit(1)
}

// ──────────────────────────────────────────────────────────────────────────
// Cenário 1: sem Authorization → 401
// ──────────────────────────────────────────────────────────────────────────
console.log('\n[1] GET /v1/docs sem Authorization →')
{
  const r = await fetchJson(`${BASE}/v1/docs`)
  if (r.status !== 401) {
    fail('1.1 status 401', `recebido ${r.status}`)
  } else {
    ok('1.1 status 401')
  }
  if (r.body?.error !== 'invalid_token') {
    fail('1.2 error=invalid_token', `recebido ${JSON.stringify(r.body)}`)
  } else {
    ok('1.2 error=invalid_token')
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Cenário 2: Bearer inválido → 401
// ──────────────────────────────────────────────────────────────────────────
console.log('\n[2] GET /v1/docs com Bearer inválido →')
{
  const r = await fetchJson(`${BASE}/v1/docs`, {
    headers: { Authorization: 'Bearer obviously-not-a-real-token-xxxxxxxxx' },
  })
  if (r.status !== 401) {
    fail('2.1 status 401', `recebido ${r.status}`)
  } else {
    ok('2.1 status 401')
  }
  if (r.body?.error !== 'invalid_token') {
    fail('2.2 error=invalid_token', `recebido ${JSON.stringify(r.body)}`)
  } else {
    ok('2.2 error=invalid_token')
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Cenário 3: GET /v1/docs com token válido → 200, shape, sem PII
// ──────────────────────────────────────────────────────────────────────────
let sampleId = null
console.log('\n[3] GET /v1/docs com token válido →')
{
  const r = await fetchJson(`${BASE}/v1/docs?limit=10`, {
    headers: { Authorization: `Bearer ${API_V1_TEST_TOKEN}` },
  })

  if (r.status !== 200) {
    fail('3.1 status 200', `recebido ${r.status} body=${JSON.stringify(r.body)}`)
  } else {
    ok('3.1 status 200')
  }

  if (!r.body || typeof r.body !== 'object') {
    fail('3.2 body é objeto', `recebido ${typeof r.body}`)
  } else if (!Array.isArray(r.body.data)) {
    fail('3.2 body.data é array', `recebido ${typeof r.body.data}`)
  } else {
    ok('3.2 body.data é array')

    const pag = r.body.pagination
    if (
      !pag ||
      typeof pag.total !== 'number' ||
      typeof pag.limit !== 'number' ||
      typeof pag.offset !== 'number'
    ) {
      fail('3.3 pagination shape', `recebido ${JSON.stringify(pag)}`)
    } else {
      ok('3.3 pagination shape')
    }

    // Validação no-PII em cada row
    let piiLeak = null
    let extraField = null
    for (const row of r.body.data) {
      if (!row || typeof row !== 'object') continue
      for (const k of Object.keys(row)) {
        if (PII_FIELDS.includes(k)) {
          piiLeak = `row leaked field ${k}`
          break
        }
        if (!ALLOWED_FIELDS.has(k)) {
          extraField = `row contains non-whitelisted field ${k}`
        }
      }
      if (piiLeak) break
    }
    if (piiLeak) fail('3.4 nenhuma PII em data[]', piiLeak)
    else ok('3.4 nenhuma PII em data[]')

    if (extraField) {
      fail('3.5 só campos whitelisted', extraField)
    } else {
      ok('3.5 só campos whitelisted')
    }

    // Captura ID p/ cenários downstream (5 e 7).
    if (r.body.data.length > 0 && r.body.data[0]?.id) {
      sampleId = r.body.data[0].id
    }
  }

  // Cenário 4: rate-limit headers presentes na 200
  console.log('\n[4] Headers X-RateLimit-* presentes →')
  const limit = r.headers.get('x-ratelimit-limit')
  const remaining = r.headers.get('x-ratelimit-remaining')
  const reset = r.headers.get('x-ratelimit-reset')
  if (!limit) fail('4.1 X-RateLimit-Limit', 'header ausente')
  else ok(`4.1 X-RateLimit-Limit=${limit}`)
  if (remaining === null) fail('4.2 X-RateLimit-Remaining', 'header ausente')
  else ok(`4.2 X-RateLimit-Remaining=${remaining}`)
  if (!reset) fail('4.3 X-RateLimit-Reset', 'header ausente')
  else ok(`4.3 X-RateLimit-Reset=${reset}`)
}

// ──────────────────────────────────────────────────────────────────────────
// Cenário 5: GET /v1/docs/:id com id válido → 200 sem PII
// ──────────────────────────────────────────────────────────────────────────
console.log('\n[5] GET /v1/docs/:id com id válido →')
if (!sampleId) {
  console.log('  SKIP  (nenhum documento disponível em /v1/docs para amostra)')
} else {
  const r = await fetchJson(`${BASE}/v1/docs/${encodeURIComponent(sampleId)}`, {
    headers: { Authorization: `Bearer ${API_V1_TEST_TOKEN}` },
  })

  if (r.status !== 200) {
    fail('5.1 status 200', `recebido ${r.status} body=${JSON.stringify(r.body)}`)
  } else {
    ok('5.1 status 200')
  }

  const row = r.body?.data
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    fail('5.2 body.data é objeto (não array)', `recebido ${typeof row}`)
  } else {
    ok('5.2 body.data é objeto')

    if (row.id !== sampleId) {
      fail('5.3 row.id corresponde ao :id requisitado', `esperado ${sampleId}, recebido ${row.id}`)
    } else {
      ok('5.3 row.id corresponde ao :id requisitado')
    }

    let piiLeak = null
    let extraField = null
    for (const k of Object.keys(row)) {
      if (PII_FIELDS.includes(k)) {
        piiLeak = `row leaked field ${k}`
        break
      }
      if (!ALLOWED_FIELDS.has(k)) {
        extraField = `row contains non-whitelisted field ${k}`
      }
    }
    if (piiLeak) fail('5.4 nenhuma PII em data', piiLeak)
    else ok('5.4 nenhuma PII em data')

    if (extraField) {
      fail('5.5 só campos whitelisted em data', extraField)
    } else {
      ok('5.5 só campos whitelisted em data')
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Cenário 6: GET /v1/docs/<zero-uuid> → 404
// ──────────────────────────────────────────────────────────────────────────
console.log('\n[6] GET /v1/docs/<zero-uuid> →')
{
  const r = await fetchJson(`${BASE}/v1/docs/00000000-0000-0000-0000-000000000000`, {
    headers: { Authorization: `Bearer ${API_V1_TEST_TOKEN}` },
  })
  if (r.status !== 404) {
    fail('6.1 status 404', `recebido ${r.status}`)
  } else {
    ok('6.1 status 404')
  }
  if (r.body?.error !== 'not_found') {
    fail('6.2 error=not_found', `recebido ${JSON.stringify(r.body)}`)
  } else {
    ok('6.2 error=not_found')
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Cenário 7: GET /v1/docs/:id/changelog → 200 { data, pagination }
// ──────────────────────────────────────────────────────────────────────────
console.log('\n[7] GET /v1/docs/:id/changelog com id válido →')
if (!sampleId) {
  console.log('  SKIP  (nenhum documento disponível em /v1/docs para amostra)')
} else {
  const r = await fetchJson(
    `${BASE}/v1/docs/${encodeURIComponent(sampleId)}/changelog?limit=10`,
    { headers: { Authorization: `Bearer ${API_V1_TEST_TOKEN}` } },
  )

  if (r.status !== 200) {
    fail('7.1 status 200', `recebido ${r.status} body=${JSON.stringify(r.body)}`)
  } else {
    ok('7.1 status 200')
  }

  if (!Array.isArray(r.body?.data)) {
    fail('7.2 body.data é array', `recebido ${typeof r.body?.data}`)
  } else {
    ok('7.2 body.data é array')

    const allowedChangelogFields = new Set(['id', 'documento_id', 'versao', 'acao', 'created_at'])
    let badField = null
    for (const entry of r.body.data) {
      if (!entry || typeof entry !== 'object') continue
      for (const k of Object.keys(entry)) {
        if (!allowedChangelogFields.has(k)) {
          badField = `entry contém campo inesperado ${k}`
          break
        }
      }
      if (badField) break
    }
    if (badField) fail('7.3 entries só com campos da view', badField)
    else ok('7.3 entries só com campos da view')
  }

  const pag = r.body?.pagination
  if (
    !pag ||
    typeof pag.total !== 'number' ||
    typeof pag.limit !== 'number' ||
    typeof pag.offset !== 'number'
  ) {
    fail('7.4 pagination shape', `recebido ${JSON.stringify(pag)}`)
  } else {
    ok('7.4 pagination shape')
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Sprint 15b — API v2: /v1/planos-acao
// ──────────────────────────────────────────────────────────────────────────

// Campos PII/free-text que NUNCA devem aparecer na resposta de /v1/planos-acao.
// Espelha as colunas EXCLUDED na view vw_api_planos_acao (migration B1).
const PII_FIELDS_PLANOS = [
  'descricao',
  'origem_id',
  'origem_descricao',
  'responsavel_id',
  'responsavel_nome',
  'created_by',
  'created_by_name',
  'evidencias',
  'historico',
  'plan_analise',
  'plan_acoes',
  'do_notas',
  'check_resultados',
  'act_padronizacao',
  'plan_o_que',
  'plan_porque',
  'plan_onde',
  'plan_como',
  'plan_quanto',
  'plan_meta',
  'plan_indicador',
  'do_percentual',
  'do_dificuldades',
  'check_meta_atingida',
  'check_analise',
  'act_decisao',
  'act_licoes_aprendidas',
]

const ALLOWED_FIELDS_PLANOS = new Set([
  'id',
  'titulo',
  'tipo_origem',
  'status',
  'fase_pdca',
  'prazo',
  'prioridade',
  'eficacia',
  'tags',
  'created_at',
  'updated_at',
])

// ──────────────────────────────────────────────────────────────────────────
// Cenário 8: GET /v1/planos-acao sem Authorization → 401
// ──────────────────────────────────────────────────────────────────────────
console.log('\n[8] GET /v1/planos-acao sem Authorization →')
{
  const r = await fetchJson(`${BASE}/v1/planos-acao`)
  if (r.status !== 401) {
    fail('8.1 status 401', `recebido ${r.status}`)
  } else {
    ok('8.1 status 401')
  }
  if (r.body?.error !== 'invalid_token') {
    fail('8.2 error=invalid_token', `recebido ${JSON.stringify(r.body)}`)
  } else {
    ok('8.2 error=invalid_token')
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Cenário 9: GET /v1/planos-acao com token válido → 200 { data, pagination }
// ──────────────────────────────────────────────────────────────────────────
let planosFirstRow = null
console.log('\n[9] GET /v1/planos-acao com token válido →')
{
  const r = await fetchJson(`${BASE}/v1/planos-acao?limit=10`, {
    headers: { Authorization: `Bearer ${API_V1_TEST_TOKEN}` },
  })

  if (r.status !== 200) {
    fail('9.1 status 200', `recebido ${r.status} body=${JSON.stringify(r.body)}`)
  } else {
    ok('9.1 status 200')
  }

  if (!r.body || typeof r.body !== 'object') {
    fail('9.2 body é objeto', `recebido ${typeof r.body}`)
  } else if (!Array.isArray(r.body.data)) {
    fail('9.2 body.data é array', `recebido ${typeof r.body.data}`)
  } else {
    ok('9.2 body.data é array')

    const pag = r.body.pagination
    if (
      !pag ||
      typeof pag.total !== 'number' ||
      typeof pag.limit !== 'number' ||
      typeof pag.offset !== 'number'
    ) {
      fail('9.3 pagination shape', `recebido ${JSON.stringify(pag)}`)
    } else {
      ok('9.3 pagination shape')
    }

    if (r.body.data.length > 0) {
      planosFirstRow = r.body.data[0]
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Cenário 10: /v1/planos-acao data[0] NÃO tem campos PII/free-text
// ──────────────────────────────────────────────────────────────────────────
console.log('\n[10] /v1/planos-acao data[0] sem PII/free-text →')
if (!planosFirstRow) {
  console.log('  SKIP  (data[] vazio em /v1/planos-acao)')
} else {
  let piiLeak = null
  let extraField = null
  for (const k of Object.keys(planosFirstRow)) {
    if (PII_FIELDS_PLANOS.includes(k)) {
      piiLeak = `row leaked field ${k}`
      break
    }
    if (!ALLOWED_FIELDS_PLANOS.has(k)) {
      extraField = `row contains non-whitelisted field ${k}`
    }
  }
  if (piiLeak) fail('10.1 nenhuma PII/free-text em data[0]', piiLeak)
  else ok('10.1 nenhuma PII/free-text em data[0]')

  if (extraField) {
    fail('10.2 só campos whitelisted em data[0]', extraField)
  } else {
    ok('10.2 só campos whitelisted em data[0]')
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Sprint 15b — API v2: /v1/comunicados
// ──────────────────────────────────────────────────────────────────────────

// Campos PII/free-text que NUNCA devem aparecer na resposta de /v1/comunicados.
// Espelha as colunas EXCLUDED na view vw_api_comunicados (migration B1).
const PII_FIELDS_COMUNICADOS = [
  'conteudo',
  'destinatarios',
  'acoes_requeridas',
  'anexos',
  'aprovado_por',
  'autor_id',
  'autor_nome',
  'arquivado',
]

const ALLOWED_FIELDS_COMUNICADOS = new Set([
  'id',
  'tipo',
  'titulo',
  'status',
  'leitura_obrigatoria',
  'rop_area',
  'rop_relacionada',
  'link',
  'data_evento',
  'prazo_confirmacao',
  'data_validade',
  'created_at',
  'updated_at',
])

// ──────────────────────────────────────────────────────────────────────────
// Cenário 11: GET /v1/comunicados sem Authorization → 401
// ──────────────────────────────────────────────────────────────────────────
console.log('\n[11] GET /v1/comunicados sem Authorization →')
{
  const r = await fetchJson(`${BASE}/v1/comunicados`)
  if (r.status !== 401) {
    fail('11.1 status 401', `recebido ${r.status}`)
  } else {
    ok('11.1 status 401')
  }
  if (r.body?.error !== 'invalid_token') {
    fail('11.2 error=invalid_token', `recebido ${JSON.stringify(r.body)}`)
  } else {
    ok('11.2 error=invalid_token')
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Cenário 12: GET /v1/comunicados com token válido → 200 { data, pagination }
// ──────────────────────────────────────────────────────────────────────────
let comunicadosFirstRow = null
console.log('\n[12] GET /v1/comunicados com token válido →')
{
  const r = await fetchJson(`${BASE}/v1/comunicados?limit=10`, {
    headers: { Authorization: `Bearer ${API_V1_TEST_TOKEN}` },
  })

  if (r.status !== 200) {
    fail('12.1 status 200', `recebido ${r.status} body=${JSON.stringify(r.body)}`)
  } else {
    ok('12.1 status 200')
  }

  if (!r.body || typeof r.body !== 'object') {
    fail('12.2 body é objeto', `recebido ${typeof r.body}`)
  } else if (!Array.isArray(r.body.data)) {
    fail('12.2 body.data é array', `recebido ${typeof r.body.data}`)
  } else {
    ok('12.2 body.data é array')

    const pag = r.body.pagination
    if (
      !pag ||
      typeof pag.total !== 'number' ||
      typeof pag.limit !== 'number' ||
      typeof pag.offset !== 'number'
    ) {
      fail('12.3 pagination shape', `recebido ${JSON.stringify(pag)}`)
    } else {
      ok('12.3 pagination shape')
    }

    if (r.body.data.length > 0) {
      comunicadosFirstRow = r.body.data[0]
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Cenário 13: /v1/comunicados data[0] NÃO tem campos PII/free-text
// ──────────────────────────────────────────────────────────────────────────
console.log('\n[13] /v1/comunicados data[0] sem PII/free-text →')
if (!comunicadosFirstRow) {
  console.log('  SKIP  (data[] vazio em /v1/comunicados)')
} else {
  let piiLeak = null
  let extraField = null
  for (const k of Object.keys(comunicadosFirstRow)) {
    if (PII_FIELDS_COMUNICADOS.includes(k)) {
      piiLeak = `row leaked field ${k}`
      break
    }
    if (!ALLOWED_FIELDS_COMUNICADOS.has(k)) {
      extraField = `row contains non-whitelisted field ${k}`
    }
  }
  if (piiLeak) fail('13.1 nenhuma PII/free-text em data[0]', piiLeak)
  else ok('13.1 nenhuma PII/free-text em data[0]')

  if (extraField) {
    fail('13.2 só campos whitelisted em data[0]', extraField)
  } else {
    ok('13.2 só campos whitelisted em data[0]')
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Cenário 14 (OPT-IN com --rate-limit-test): 51 requests sequenciais → 429
// Default OFF para não poluir contadores de rate-limit em produção.
// Recomendado: rodar em staging onde tabela documento_api_rate_limit pode
// ser limpa após teste.
// ──────────────────────────────────────────────────────────────────────────
if (RATE_LIMIT_TEST) {
  console.log('\n[14] Rate-limit (51 reqs sequenciais) — flag --rate-limit-test ATIVO →')
  let last = null
  for (let i = 0; i < 51; i++) {
    last = await fetchJson(`${BASE}/v1/docs?limit=1`, {
      headers: { Authorization: `Bearer ${API_V1_TEST_TOKEN}` },
    })
    if (last.status === 429) {
      ok(`14.1 429 disparado na req #${i + 1}`)
      break
    }
  }
  if (!last || last.status !== 429) {
    fail('14.1 429 disparado dentro de 51 reqs', `última status=${last?.status}`)
  } else {
    const retry = last.headers.get('retry-after')
    if (!retry) fail('14.2 Retry-After header', 'ausente em 429')
    else ok(`14.2 Retry-After=${retry}`)
    if (last.body?.error !== 'rate_limit_exceeded') {
      fail('14.3 error=rate_limit_exceeded', `recebido ${JSON.stringify(last.body)}`)
    } else {
      ok('14.3 error=rate_limit_exceeded')
    }
  }
} else {
  console.log('\n[14] Rate-limit test SKIP (use --rate-limit-test para ativar)')
}

// ──────────────────────────────────────────────────────────────────────────
// Sprint 16 — Scope enforcement (cenários 16, 17, 18)
//
// Requerem tokens narrow-scoped pré-gerados via UI admin (Centro de Gestão →
// API → Gerar token com 1 checkbox marcada). Gracioso: se as 3 envs não
// estão setadas, todos os 3 cenários são SKIP (não falha).
// ──────────────────────────────────────────────────────────────────────────
const TOKEN_DOCS_ONLY = process.env.API_V1_TOKEN_DOCS_ONLY
const TOKEN_PLANOS_ONLY = process.env.API_V1_TOKEN_PLANOS_ONLY
const TOKEN_ALL = process.env.API_V1_TOKEN_ALL

const SCOPE_TOKENS_AVAILABLE = !!(TOKEN_DOCS_ONLY && TOKEN_PLANOS_ONLY && TOKEN_ALL)

// ──────────────────────────────────────────────────────────────────────────
// Cenário 16: token apenas read:docs → GET /v1/planos-acao → 403 + required_scope
// ──────────────────────────────────────────────────────────────────────────
console.log('\n[16] Sprint 16 — token read:docs apenas → GET /v1/planos-acao →')
if (!SCOPE_TOKENS_AVAILABLE) {
  console.log(
    '  SKIP  (faltam env vars API_V1_TOKEN_DOCS_ONLY / _PLANOS_ONLY / _ALL — ' +
      'gere via UI: Centro de Gestão → API → Gerar token com 1 checkbox)',
  )
} else {
  const r = await fetchJson(`${BASE}/v1/planos-acao`, {
    headers: { Authorization: `Bearer ${TOKEN_DOCS_ONLY}` },
  })
  if (r.status !== 403) {
    fail('16.1 status 403', `recebido ${r.status} body=${JSON.stringify(r.body)}`)
  } else {
    ok('16.1 status 403')
  }
  if (r.body?.required_scope !== 'read:planos-acao') {
    fail(
      '16.2 body.required_scope=read:planos-acao',
      `recebido ${JSON.stringify(r.body?.required_scope)}`,
    )
  } else {
    ok('16.2 body.required_scope=read:planos-acao')
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Cenário 17: token apenas read:planos-acao → GET /v1/docs → 403 + required_scope
// ──────────────────────────────────────────────────────────────────────────
console.log('\n[17] Sprint 16 — token read:planos-acao apenas → GET /v1/docs →')
if (!SCOPE_TOKENS_AVAILABLE) {
  console.log('  SKIP  (faltam env vars de tokens narrow-scope — ver cenário 16)')
} else {
  const r = await fetchJson(`${BASE}/v1/docs`, {
    headers: { Authorization: `Bearer ${TOKEN_PLANOS_ONLY}` },
  })
  if (r.status !== 403) {
    fail('17.1 status 403', `recebido ${r.status} body=${JSON.stringify(r.body)}`)
  } else {
    ok('17.1 status 403')
  }
  if (r.body?.required_scope !== 'read:docs') {
    fail(
      '17.2 body.required_scope=read:docs',
      `recebido ${JSON.stringify(r.body?.required_scope)}`,
    )
  } else {
    ok('17.2 body.required_scope=read:docs')
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Cenário 18: token com os 3 scopes → GET /v1/comunicados → 200
// ──────────────────────────────────────────────────────────────────────────
console.log('\n[18] Sprint 16 — token com 3 scopes → GET /v1/comunicados →')
if (!SCOPE_TOKENS_AVAILABLE) {
  console.log('  SKIP  (faltam env vars de tokens narrow-scope — ver cenário 16)')
} else {
  const r = await fetchJson(`${BASE}/v1/comunicados?limit=1`, {
    headers: { Authorization: `Bearer ${TOKEN_ALL}` },
  })
  if (r.status !== 200) {
    fail('18.1 status 200', `recebido ${r.status} body=${JSON.stringify(r.body)}`)
  } else {
    ok('18.1 status 200')
  }
  if (!r.body || !Array.isArray(r.body.data)) {
    fail('18.2 body.data é array', `recebido ${typeof r.body?.data}`)
  } else {
    ok('18.2 body.data é array')
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Sprint 19 — Write endpoints (cenários 19-24)
// Requer: API_V1_TOKEN_WRITE_DOCS (scopes=['read:docs','write:docs'])
// ──────────────────────────────────────────────────────────────────────────
const TOKEN_WRITE_DOCS = process.env.API_V1_TOKEN_WRITE_DOCS
const WRITE_TOKEN_AVAILABLE = !!TOKEN_WRITE_DOCS

let createdDocId = null

console.log('\n[19] Sprint 19 — POST /v1/docs sem body válido → 400')
if (!WRITE_TOKEN_AVAILABLE) {
  console.log('  SKIP  (defina API_V1_TOKEN_WRITE_DOCS)')
} else {
  const r = await fetchJson(`${BASE}/v1/docs`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN_WRITE_DOCS}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ descricao: 'sem titulo nem tipo' }),
  })
  r.status === 400
    ? ok('19.1 status 400 validation_failed')
    : fail('19.1 status 400', `recebido ${r.status}`)
}

console.log('\n[20] Sprint 19 — POST /v1/docs body válido → 201 + data.id')
if (!WRITE_TOKEN_AVAILABLE) {
  console.log('  SKIP')
} else {
  // Sprint 19 hotfix: field names snake_case PT — titulo + categoria obrigatórios.
  const r = await fetchJson(`${BASE}/v1/docs`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN_WRITE_DOCS}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      titulo: `Smoke Sprint 19 — ${new Date().toISOString()}`,
      tipo: 'pop',
      categoria: 'biblioteca',
      descricao: 'criado via smoke-api-v1.mjs',
    }),
  })
  if (r.status === 201 && r.body?.data?.id) {
    ok('20.1 status 201 + data.id')
    createdDocId = r.body.data.id
  } else {
    fail('20.1 status 201', `recebido ${r.status} body=${JSON.stringify(r.body)}`)
  }
}

console.log('\n[21] Sprint 19 — POST /v1/docs sem write:docs (token read-only) → 403')
if (!SCOPE_TOKENS_AVAILABLE) {
  console.log('  SKIP')
} else {
  const r = await fetchJson(`${BASE}/v1/docs`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN_DOCS_ONLY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ titulo: 'x', tipo: 'pop', categoria: 'biblioteca' }),
  })
  r.status === 403 && r.body?.required_scope === 'write:docs'
    ? ok('21.1 status 403 + required_scope=write:docs')
    : fail(
        '21.1 status 403 required_scope',
        `recebido ${r.status} body=${JSON.stringify(r.body)}`,
      )
}

console.log('\n[22] Sprint 19 — PUT /v1/docs/:id válido → 200')
if (!WRITE_TOKEN_AVAILABLE || !createdDocId) {
  console.log('  SKIP  (precisa de cenário 20 passar)')
} else {
  const r = await fetchJson(`${BASE}/v1/docs/${createdDocId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${TOKEN_WRITE_DOCS}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ descricao: 'atualizado via smoke' }),
  })
  r.status === 200 ? ok('22.1 status 200') : fail('22.1 status 200', `recebido ${r.status}`)
}

console.log('\n[23] Sprint 19 — PUT /v1/docs/id-inexistente → 404')
if (!WRITE_TOKEN_AVAILABLE) {
  console.log('  SKIP')
} else {
  const r = await fetchJson(`${BASE}/v1/docs/00000000-0000-0000-0000-000000000000`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${TOKEN_WRITE_DOCS}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ descricao: 'x' }),
  })
  r.status === 404 ? ok('23.1 status 404') : fail('23.1 status 404', `recebido ${r.status}`)
}

console.log('\n[24] Sprint 19 — DELETE /v1/docs/:id válido → 200 (soft-delete)')
if (!WRITE_TOKEN_AVAILABLE || !createdDocId) {
  console.log('  SKIP')
} else {
  const r = await fetchJson(`${BASE}/v1/docs/${createdDocId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${TOKEN_WRITE_DOCS}` },
  })
  r.status === 200 && r.body?.data?.status === 'arquivado'
    ? ok('24.1 status 200 + data.status=arquivado')
    : fail('24.1', `recebido ${r.status} body=${JSON.stringify(r.body)}`)
}

console.log('\n[25] Sprint 19 — DELETE sem write:docs (token read-only) → 403')
if (!SCOPE_TOKENS_AVAILABLE) {
  console.log('  SKIP')
} else {
  const r = await fetchJson(`${BASE}/v1/docs/00000000-0000-0000-0000-000000000000`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${TOKEN_DOCS_ONLY}` },
  })
  r.status === 403 && r.body?.required_scope === 'write:docs'
    ? ok('25.1 status 403 + required_scope=write:docs')
    : fail('25.1', `recebido ${r.status} body=${JSON.stringify(r.body)}`)
}

console.log('\n[26] Sprint 19 — POST /v1/planos-acao → 501 not_implemented (Sprint 20)')
if (!WRITE_TOKEN_AVAILABLE) {
  console.log('  SKIP')
} else {
  // Precisaria token com write:planos-acao para passar scope. Aqui só vemos 403
  // (esperado) ou 501 (se token tiver scope). Documenta como "não-fatal".
  const r = await fetchJson(`${BASE}/v1/planos-acao`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN_WRITE_DOCS}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ titulo: 'x' }),
  })
  if (r.status === 403 || r.status === 501) {
    ok(`26.1 status ${r.status} (esperado 403 ou 501 — escopo Sprint 20)`)
  } else {
    fail('26.1', `recebido ${r.status}`)
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Sprint 20 — Write endpoints para planos-acao + comunicados (cenários 27-32)
//
// Opt-in via env vars (3 tokens novos):
//   API_V1_TOKEN_WRITE_PLANOS        — scopes ⊇ ['write:planos-acao']
//   API_V1_TOKEN_WRITE_COMUNICADOS   — scopes ⊇ ['write:comunicados']
//   API_V1_TOKEN_WRITE_DOCS_ONLY     — scopes = ['write:docs'] (negative test)
// Sem essas vars os cenários 27-32 são SKIP (mesmo padrão dos cenários 16-18 e
// 19-25). Gere via UI: Centro de Gestão → API → Gerar token marcando apenas
// o(s) scope(s) correspondente(s).
// ──────────────────────────────────────────────────────────────────────────
const TOKEN_WRITE_PLANOS = process.env.API_V1_TOKEN_WRITE_PLANOS
const TOKEN_WRITE_COMUNICADOS = process.env.API_V1_TOKEN_WRITE_COMUNICADOS
const TOKEN_WRITE_DOCS_ONLY = process.env.API_V1_TOKEN_WRITE_DOCS_ONLY

let createdPlanoId = null
let createdComunicadoId = null

console.log('\n[27] Sprint 20 — POST /v1/planos-acao válido → 201 + data.id')
if (!TOKEN_WRITE_PLANOS) {
  console.log('  SKIP  (defina API_V1_TOKEN_WRITE_PLANOS)')
} else {
  const r = await fetchJson(`${BASE}/v1/planos-acao`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN_WRITE_PLANOS}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      titulo: `Smoke plano Sprint 20 — ${new Date().toISOString()}`,
      tipo_origem: 'manual',
      prioridade: 'baixa',
    }),
  })
  if (r.status === 201 && r.body?.data?.id) {
    ok('27.1 status 201 + data.id')
    createdPlanoId = r.body.data.id
  } else {
    fail('27.1 status 201', `recebido ${r.status} body=${JSON.stringify(r.body)}`)
  }
}

console.log('\n[28] Sprint 20 — POST /v1/planos-acao sem write:planos-acao → 403')
if (!TOKEN_WRITE_DOCS_ONLY) {
  console.log('  SKIP  (defina API_V1_TOKEN_WRITE_DOCS_ONLY)')
} else {
  const r = await fetchJson(`${BASE}/v1/planos-acao`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN_WRITE_DOCS_ONLY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ titulo: 'x', tipo_origem: 'manual' }),
  })
  if (r.status === 403 && r.body?.required_scope === 'write:planos-acao') {
    ok('28.1 status 403 + required_scope=write:planos-acao')
  } else {
    fail('28.1', `recebido ${r.status} body=${JSON.stringify(r.body)}`)
  }
}

console.log('\n[29] Sprint 20 — PUT /v1/planos-acao/:id válido → 200')
if (!TOKEN_WRITE_PLANOS || !createdPlanoId) {
  console.log('  SKIP  (precisa do cenário 27 passar)')
} else {
  const r = await fetchJson(`${BASE}/v1/planos-acao/${createdPlanoId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${TOKEN_WRITE_PLANOS}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: 'execucao', fase_pdca: 'do' }),
  })
  if (r.status === 200 && r.body?.data?.id === createdPlanoId) {
    ok('29.1 status 200 + data.id ecoa')
  } else {
    fail('29.1', `recebido ${r.status} body=${JSON.stringify(r.body)}`)
  }
}

console.log('\n[30] Sprint 20 — POST /v1/comunicados válido → 201 + data.id')
if (!TOKEN_WRITE_COMUNICADOS) {
  console.log('  SKIP  (defina API_V1_TOKEN_WRITE_COMUNICADOS)')
} else {
  const r = await fetchJson(`${BASE}/v1/comunicados`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN_WRITE_COMUNICADOS}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      titulo: `Smoke comunicado Sprint 20 — ${new Date().toISOString()}`,
      tipo: 'Geral',
      conteudo: 'Teste smoke automated.',
      rop_area: 'geral',
    }),
  })
  if (r.status === 201 && r.body?.data?.id) {
    ok('30.1 status 201 + data.id')
    createdComunicadoId = r.body.data.id
  } else {
    fail('30.1', `recebido ${r.status} body=${JSON.stringify(r.body)}`)
  }
}

console.log('\n[31] Sprint 20 — POST /v1/comunicados sem write:comunicados → 403')
if (!TOKEN_WRITE_DOCS_ONLY) {
  console.log('  SKIP  (defina API_V1_TOKEN_WRITE_DOCS_ONLY)')
} else {
  const r = await fetchJson(`${BASE}/v1/comunicados`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN_WRITE_DOCS_ONLY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ titulo: 'x', tipo: 'Geral' }),
  })
  if (r.status === 403 && r.body?.required_scope === 'write:comunicados') {
    ok('31.1 status 403 + required_scope=write:comunicados')
  } else {
    fail('31.1', `recebido ${r.status} body=${JSON.stringify(r.body)}`)
  }
}

console.log('\n[32] Sprint 20 — DELETE /v1/comunicados/:id → 200 (soft-delete arquivado=true)')
if (!TOKEN_WRITE_COMUNICADOS || !createdComunicadoId) {
  console.log('  SKIP  (precisa do cenário 30 passar)')
} else {
  const r = await fetchJson(`${BASE}/v1/comunicados/${createdComunicadoId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${TOKEN_WRITE_COMUNICADOS}` },
  })
  if (r.status === 200 && r.body?.data?.arquivado === true) {
    ok('32.1 status 200 + data.arquivado=true')
  } else {
    fail('32.1', `recebido ${r.status} body=${JSON.stringify(r.body)}`)
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Resumo
// ──────────────────────────────────────────────────────────────────────────
console.log('\n32 cenários total (era 26). +6 Sprint 20 write endpoints (planos + comunicados).')
console.log(`Resultado: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)

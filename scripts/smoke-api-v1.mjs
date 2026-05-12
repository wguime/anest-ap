/**
 * Sprint 14c — Smoke E2E para a API pública v1 (edge api-v1) + edge admin
 * generate-api-token. Rodar manualmente após deploy.
 *
 * Uso básico (smoke sem gerar token novo):
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... API_V1_TEST_TOKEN=... \
 *     node scripts/smoke-api-v1.mjs
 *
 * Uso completo (inclui geração de token via edge admin):
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... ADMIN_JWT=... \
 *     node scripts/smoke-api-v1.mjs
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
 *   8. (opt-in, --rate-limit-test) 51 reqs sequenciais → última 429
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
// Cenário 8 (OPT-IN com --rate-limit-test): 51 requests sequenciais → 429
// Default OFF para não poluir contadores de rate-limit em produção.
// Recomendado: rodar em staging onde tabela documento_api_rate_limit pode
// ser limpa após teste.
// ──────────────────────────────────────────────────────────────────────────
if (RATE_LIMIT_TEST) {
  console.log('\n[8] Rate-limit (51 reqs sequenciais) — flag --rate-limit-test ATIVO →')
  let last = null
  for (let i = 0; i < 51; i++) {
    last = await fetchJson(`${BASE}/v1/docs?limit=1`, {
      headers: { Authorization: `Bearer ${API_V1_TEST_TOKEN}` },
    })
    if (last.status === 429) {
      ok(`8.1 429 disparado na req #${i + 1}`)
      break
    }
  }
  if (!last || last.status !== 429) {
    fail('8.1 429 disparado dentro de 51 reqs', `última status=${last?.status}`)
  } else {
    const retry = last.headers.get('retry-after')
    if (!retry) fail('8.2 Retry-After header', 'ausente em 429')
    else ok(`8.2 Retry-After=${retry}`)
    if (last.body?.error !== 'rate_limit_exceeded') {
      fail('8.3 error=rate_limit_exceeded', `recebido ${JSON.stringify(last.body)}`)
    } else {
      ok('8.3 error=rate_limit_exceeded')
    }
  }
} else {
  console.log('\n[8] Rate-limit test SKIP (use --rate-limit-test para ativar)')
}

// ──────────────────────────────────────────────────────────────────────────
// Resumo
// ──────────────────────────────────────────────────────────────────────────
console.log(`\nResultado: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)

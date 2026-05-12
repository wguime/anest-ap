/**
 * Sprint 14c smoke; rodar manualmente após deploy: `node scripts/test-api-v1.mjs`.
 * Variáveis: SUPABASE_URL, SUPABASE_ANON_KEY, API_V1_TEST_TOKEN.
 *
 *   SUPABASE_URL         — URL do projeto (ex: https://vjz...supabase.co)
 *   SUPABASE_ANON_KEY    — anon key (não usada para auth da API; presença
 *                          serve como sanity check + future-proof se a edge
 *                          passar a exigir verify-jwt um dia)
 *   API_V1_TEST_TOKEN    — token RAW (plain), inserido via UI ou SQL com
 *                          token_hash = sha256(plain) na tabela api_tokens.
 *
 * Cenários:
 *   1. Sem Authorization → 401 { error: 'invalid_token' }
 *   2. Authorization: Bearer invalid → 401
 *   3. GET /v1/docs com token válido → 200, shape { data, pagination },
 *      sem campos PII em nenhuma linha
 *   4. Headers X-RateLimit-Limit/Remaining/Reset presentes na 200
 *
 * Exit 0 se tudo passa; 1 caso contrário.
 */

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
const API_V1_TEST_TOKEN = process.env.API_V1_TEST_TOKEN

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !API_V1_TEST_TOKEN) {
  console.error(
    'Variáveis obrigatórias: SUPABASE_URL, SUPABASE_ANON_KEY, API_V1_TEST_TOKEN',
  )
  process.exit(1)
}

const BASE = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/api-v1`

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

async function fetchJson(path, init = {}) {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    ...(init.headers || {}),
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers })
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
// Cenário 1: Sem Authorization header → 401
// ──────────────────────────────────────────────────────────────────────────
console.log('\n[1] GET /v1/docs sem Authorization →')
{
  const r = await fetchJson('/v1/docs')
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
  const r = await fetchJson('/v1/docs', {
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
console.log('\n[3] GET /v1/docs com token válido →')
{
  const r = await fetchJson('/v1/docs?limit=10', {
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
    if (!pag || typeof pag.total !== 'number' || typeof pag.limit !== 'number' || typeof pag.offset !== 'number') {
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
// Resumo
// ──────────────────────────────────────────────────────────────────────────
console.log(`\nResultado: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)

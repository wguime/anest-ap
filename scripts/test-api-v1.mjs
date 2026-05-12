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
 *   5. GET /v1/docs/:id com id válido → 200, shape { data: {…} } sem PII
 *   6. GET /v1/docs/:id com id zero-UUID → 404
 *   7. GET /v1/docs/:id/changelog com id válido → 200,
 *      shape { data: [], pagination }
 *
 * TODO: cobertura 429 — requer disparar 51 requests sequenciais o que polui
 *       contadores de rate-limit em prod. Manter em smoke separado (manual)
 *       executado em janela onde a tabela documento_api_rate_limit possa ser
 *       limpa após o teste.
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
// Captura sampleId para reuso nos cenários 5/7.
// ──────────────────────────────────────────────────────────────────────────
let sampleId = null
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
// Cenário 5: GET /v1/docs/:id com id válido → 200, shape { data: {…} } sem PII
// ──────────────────────────────────────────────────────────────────────────
console.log('\n[5] GET /v1/docs/:id com id válido →')
if (!sampleId) {
  console.log('  SKIP  (nenhum documento disponível em /v1/docs para amostra)')
} else {
  const r = await fetchJson(`/v1/docs/${encodeURIComponent(sampleId)}`, {
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
// Cenário 6: GET /v1/docs/:id com id zero-UUID → 404
// ──────────────────────────────────────────────────────────────────────────
console.log('\n[6] GET /v1/docs/<zero-uuid> →')
{
  const r = await fetchJson('/v1/docs/00000000-0000-0000-0000-000000000000', {
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
// Cenário 7: GET /v1/docs/:id/changelog com id válido → 200 { data, pagination }
// ──────────────────────────────────────────────────────────────────────────
console.log('\n[7] GET /v1/docs/:id/changelog com id válido →')
if (!sampleId) {
  console.log('  SKIP  (nenhum documento disponível em /v1/docs para amostra)')
} else {
  const r = await fetchJson(`/v1/docs/${encodeURIComponent(sampleId)}/changelog?limit=10`, {
    headers: { Authorization: `Bearer ${API_V1_TEST_TOKEN}` },
  })

  if (r.status !== 200) {
    fail('7.1 status 200', `recebido ${r.status} body=${JSON.stringify(r.body)}`)
  } else {
    ok('7.1 status 200')
  }

  if (!Array.isArray(r.body?.data)) {
    fail('7.2 body.data é array', `recebido ${typeof r.body?.data}`)
  } else {
    ok('7.2 body.data é array')

    // Validação de shape de cada entry — colunas exatas da view de changelog.
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
  if (!pag || typeof pag.total !== 'number' || typeof pag.limit !== 'number' || typeof pag.offset !== 'number') {
    fail('7.4 pagination shape', `recebido ${JSON.stringify(pag)}`)
  } else {
    ok('7.4 pagination shape')
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Resumo
// ──────────────────────────────────────────────────────────────────────────
console.log(`\nResultado: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)

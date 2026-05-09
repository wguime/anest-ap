/**
 * Smoke E2E do portal público /verificar/doc/:hash — Sprint 10 / F7.
 *
 * Pré-condição: migration 20260509400000_doc_verify_public.sql APLICADA
 * no projeto Supabase apontado por VITE_SUPABASE_URL.
 *
 * Valida (via service_role JWT, batendo direto na RPC):
 *   1. RPC existe e responde
 *   2. hash inválido (não-hex) → exception 'invalid_hash'
 *   3. hash de doc com confidentiality_level='publico' → retorna shape esperado
 *   4. hash de doc com confidentiality_level='interno' → retorna vazio (não vaza)
 *   5. hash inexistente → retorna vazio
 *   6. shape NÃO contém PII (approver_id, approver_name, autor_*, created_by)
 *   7. rate limit: 60 req/min/IP — chamada 61 retorna 'rate_limited'
 *   8. cleanup
 *
 * Uso:
 *   node scripts/smoke-portal-publico.mjs
 */
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { SignJWT } from 'jose'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')
const envVars = {}
const envPath = resolve(projectRoot, '.env.local')
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^([^#=][^=]*)=(.*)$/)
    if (m) envVars[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '')
  })
}

const SUPABASE_URL = envVars.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = envVars.VITE_SUPABASE_ANON_KEY
const JWT_SECRET = envVars.SUPABASE_JWT_SECRET

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !JWT_SECRET) {
  console.error('Faltam VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / SUPABASE_JWT_SECRET em .env.local')
  process.exit(1)
}

const ADMIN_UID = 'pPdKZ75E9zNdPnLz50qisPiHfJw1'

const serviceJwt = await new SignJWT({
  iss: 'supabase',
  ref: 'vjzrahruvjffyyqyhjny',
  role: 'service_role',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
})
  .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
  .sign(new TextEncoder().encode(JWT_SECRET))

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${serviceJwt}` } },
})

const SUFFIX = String(Date.now()).slice(-8)
const DOC_PUBLIC_ID = `doc-smoke-portal-pub-${SUFFIX}`
const DOC_INTERNAL_ID = `doc-smoke-portal-int-${SUFFIX}`
const HASH_PUBLIC = 'a'.repeat(64) // hash de teste do doc PÚBLICO
const HASH_INTERNAL = 'b'.repeat(64) // hash de teste do doc INTERNO
const HASH_NONEXISTENT = 'c'.repeat(64)
const TEST_IP_1 = `127.0.0.${(Date.now() % 200) + 50}`  // IP único por execução

async function cleanup() {
  console.log('🧹 cleanup...')
  for (const id of [DOC_PUBLIC_ID, DOC_INTERNAL_ID]) {
    try { await sb.from('documento_aprovacoes').delete().eq('documento_id', id) } catch (_) {}
    try { await sb.from('documentos').delete().eq('id', id) } catch (_) {}
  }
  // Limpa rate_limit do IP de teste para não afetar próximas execuções
  try { await sb.from('documento_api_rate_limit').delete().eq('ip', TEST_IP_1) } catch (_) {}
}

let pass = 0, fail = 0
async function step(name, fn) {
  try {
    await fn()
    console.log(`✅ ${name}`)
    pass++
  } catch (err) {
    console.log(`❌ ${name}\n   ${err.message}`)
    fail++
  }
}

async function callRPC(hash, ip) {
  return await sb.rpc('rpc_verify_document_public', { p_hash: hash, p_ip: ip })
}

try {
  // Setup: 2 docs (publico + interno) cada com 1 aprovação assinada
  await sb.from('documentos').insert({
    id: DOC_PUBLIC_ID,
    codigo: `SMOKE-PUB-${SUFFIX}`,
    titulo: 'Smoke Portal Público',
    categoria: 'biblioteca',
    tipo: 'documento',
    status: 'ativo',
    versao_atual: 1,
    confidentiality_level: 'publico',
    storage_path: `biblioteca/${DOC_PUBLIC_ID}/v1/x.pdf`,
    arquivo_nome: 'x.pdf',
    arquivo_tamanho: 1,
    created_by: ADMIN_UID,
    created_by_name: 'Smoke',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  await sb.from('documentos').insert({
    id: DOC_INTERNAL_ID,
    codigo: `SMOKE-INT-${SUFFIX}`,
    titulo: 'Smoke Portal Interno',
    categoria: 'biblioteca',
    tipo: 'documento',
    status: 'ativo',
    versao_atual: 1,
    confidentiality_level: 'interno',
    storage_path: `biblioteca/${DOC_INTERNAL_ID}/v1/x.pdf`,
    arquivo_nome: 'x.pdf',
    arquivo_tamanho: 1,
    created_by: ADMIN_UID,
    created_by_name: 'Smoke',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  await sb.from('documento_aprovacoes').insert({
    documento_id: DOC_PUBLIC_ID,
    versao: 1,
    step_order: 0,
    approver_id: ADMIN_UID,
    approver_name: 'Smoke Approver',
    action: 'approved',
    comment: '',
    decided_at: new Date().toISOString(),
    signature_hash: HASH_PUBLIC,
    signature_algo: 'SHA-256',
  })
  await sb.from('documento_aprovacoes').insert({
    documento_id: DOC_INTERNAL_ID,
    versao: 1,
    step_order: 0,
    approver_id: ADMIN_UID,
    approver_name: 'Smoke Approver',
    action: 'approved',
    comment: '',
    decided_at: new Date().toISOString(),
    signature_hash: HASH_INTERNAL,
    signature_algo: 'SHA-256',
  })

  await step('1. RPC rpc_verify_document_public existe', async () => {
    const { error } = await callRPC(HASH_NONEXISTENT, TEST_IP_1)
    if (error && /not exist|not found/i.test(error.message)) {
      throw new Error(`RPC não existe: ${error.message}`)
    }
  })

  await step('2. Hash inválido (não-hex) → invalid_hash', async () => {
    const { error } = await callRPC('XYZ', TEST_IP_1)
    if (!error) throw new Error('esperava exception, obteve sucesso')
    if (!/invalid_hash/i.test(error.message)) throw new Error(`mensagem inesperada: ${error.message}`)
  })

  await step('3. Hash de doc PÚBLICO retorna shape correto', async () => {
    const { data, error } = await callRPC(HASH_PUBLIC, TEST_IP_1)
    if (error) throw error
    if (!Array.isArray(data) || data.length !== 1) {
      throw new Error(`esperado 1 row, got ${data?.length ?? 0}`)
    }
    const row = data[0]
    if (row.codigo !== `SMOKE-PUB-${SUFFIX}`) throw new Error(`codigo errado: ${row.codigo}`)
    if (row.titulo !== 'Smoke Portal Público') throw new Error(`titulo errado: ${row.titulo}`)
    if (row.versao !== 1) throw new Error(`versao errada: ${row.versao}`)
    if (row.signature_hash !== HASH_PUBLIC) throw new Error(`hash errado`)
    if (row.signature_algo !== 'SHA-256') throw new Error(`algo errado: ${row.signature_algo}`)
  })

  await step('4. Hash de doc INTERNO retorna vazio (não vaza)', async () => {
    const { data, error } = await callRPC(HASH_INTERNAL, TEST_IP_1)
    if (error) throw error
    if (!Array.isArray(data) || data.length !== 0) {
      throw new Error(`esperava 0 rows, got ${data?.length} — VAZAMENTO de doc não-público!`)
    }
  })

  await step('5. Hash inexistente retorna vazio', async () => {
    const { data, error } = await callRPC(HASH_NONEXISTENT, TEST_IP_1)
    if (error) throw error
    if (!Array.isArray(data) || data.length !== 0) {
      throw new Error(`esperava 0 rows, got ${data?.length}`)
    }
  })

  await step('6. Shape NÃO contém PII (approver_id/name, created_by, autor)', async () => {
    const { data, error } = await callRPC(HASH_PUBLIC, TEST_IP_1)
    if (error) throw error
    const row = data[0]
    const pii = ['approver_id', 'approver_name', 'created_by', 'autor_id', 'autor_nome', 'comment']
    for (const field of pii) {
      if (field in row) throw new Error(`PII LEAK: campo "${field}" presente no shape`)
    }
    // Whitelist confirmada — apenas estes campos
    const allowed = new Set(['codigo', 'titulo', 'versao', 'decided_at', 'signature_hash', 'signature_algo'])
    for (const k of Object.keys(row)) {
      if (!allowed.has(k)) throw new Error(`campo inesperado no shape: ${k}`)
    }
  })

  await step('7. Rate limit: 60+ chamadas/min/IP → rate_limited', async () => {
    // Já fizemos algumas chamadas acima com TEST_IP_1; usa IP novo dedicado
    const burstIp = `127.0.0.${(Date.now() % 200) + 251}`
    let lastError = null
    let succeeded = 0
    for (let i = 0; i < 65; i++) {
      const { error } = await callRPC(HASH_NONEXISTENT, burstIp)
      if (error) {
        lastError = error
        break
      }
      succeeded++
    }
    if (!lastError) throw new Error(`fez ${succeeded}+ chamadas sem rate_limited — limit não está ativo`)
    if (!/rate_limited/i.test(lastError.message)) throw new Error(`erro inesperado: ${lastError.message}`)
    if (succeeded < 55) throw new Error(`limit disparou cedo demais (após ${succeeded} chamadas)`)
    // cleanup do IP burst
    try { await sb.from('documento_api_rate_limit').delete().eq('ip', burstIp) } catch (_) {}
  })
} catch (e) {
  console.error('Erro fatal:', e.message)
} finally {
  await cleanup()
}

console.log(`\n${pass}/${pass + fail} steps OK`)
process.exit(fail === 0 ? 0 : 1)

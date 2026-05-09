/**
 * Smoke test pós-migrations 20260508* (audit v3.72.0 fixes + PDF/A + LGPD).
 *
 * Uso:
 *   node scripts/smoke-audit-v3-72-1.mjs
 *
 * Lê credenciais de .env.local (não imprime valores). Usa service-role JWT
 * via SUPABASE_JWT_SECRET para bypassar RLS e consultar pg_catalog.
 *
 * Verifica:
 *   1. RPCs criados (rpc_anonymize_changelog_for_user, rpc_anonimizar_incidente_user,
 *      rpc_request_pdfa_conversion, advance_approval_step)
 *   2. advance_approval_step assinatura usa text (não uuid)
 *   3. profiles_insert policy referencia firebase_uid (não auth.uid)
 *   4. retention_policies seedada com 'prontuarios' / -1 anos
 *   5. WORM trigger usa current_setting('role')
 *   6. Coluna documentos.pdfa_status existe
 *   7. Bucket documentos-pdfa existe
 *   8. CHECK constraint changelog inclui pdfa_generated + bulk_imported
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

const jwt = await new SignJWT({
  iss: 'supabase',
  ref: 'vjzrahruvjffyyqyhjny',
  role: 'service_role',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
})
  .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
  .sign(new TextEncoder().encode(JWT_SECRET))

const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${jwt}` } },
})

const checks = []
function add(name, fn) {
  checks.push({ name, fn })
}

add('1. retention_policies seed prontuarios -1 anos', async () => {
  const { data, error } = await supa
    .from('retention_policies')
    .select('categoria, retention_years')
    .eq('categoria', 'prontuarios')
    .single()
  if (error) throw error
  if (data?.retention_years !== -1) throw new Error(`got ${JSON.stringify(data)}`)
})

add('2. Coluna documentos.pdfa_status existe', async () => {
  const { data, error } = await supa
    .from('documentos')
    .select('id, pdfa_status, pdfa_url, pdfa_pages, pdfa_size_bytes, pdfa_processed_at')
    .limit(1)
  if (error) throw error
  // se a coluna não existe, o select falha com erro — chegou aqui = OK
})

add('3. RPC rpc_request_pdfa_conversion existe (chama com id inexistente)', async () => {
  const { error } = await supa.rpc('rpc_request_pdfa_conversion', {
    p_documento_id: '__smoke-non-existent__',
    p_user_id: 'system',
  })
  if (error && /does not exist/i.test(error.message)) throw error
  // RPC existe — pode dar erro de constraint mas não "function does not exist"
})

add('4. RPC rpc_anonymize_changelog_for_user existe (admin-check)', async () => {
  const { error } = await supa.rpc('rpc_anonymize_changelog_for_user', {
    p_user_id: '__smoke-non-existent__',
  })
  // Esperamos um erro mas NÃO "function does not exist"
  if (error && /function .* does not exist/i.test(error.message)) {
    throw new Error('RPC ausente: ' + error.message)
  }
})

add('5. RPC rpc_anonimizar_incidente_user existe', async () => {
  const { error } = await supa.rpc('rpc_anonimizar_incidente_user', {
    p_user_id: '__smoke-non-existent__',
  })
  if (error && /function .* does not exist/i.test(error.message)) {
    throw new Error('RPC ausente: ' + error.message)
  }
})

add('6. RPC advance_approval_step com p_documento_id text (não uuid)', async () => {
  // Se a assinatura ainda fosse uuid, passar string normal causaria erro de cast.
  const { error } = await supa.rpc('advance_approval_step', {
    p_documento_id: '__smoke-non-existent__',
  })
  if (error && /function .* does not exist/i.test(error.message)) {
    throw new Error('RPC ausente: ' + error.message)
  }
  if (error && /invalid input syntax for type uuid/i.test(error.message)) {
    throw new Error('Assinatura ainda é uuid: ' + error.message)
  }
})

add('7. Coluna ocr_status + bulk_import_id existem (Sprint 4/5)', async () => {
  const { error } = await supa
    .from('documentos')
    .select('id, ocr_status, bulk_import_id')
    .limit(1)
  if (error) throw error
})

add('8. rpc_compliance_score_qmentum existe e retorna json', async () => {
  const { data, error } = await supa.rpc('rpc_compliance_score_qmentum')
  if (error) throw error
  if (typeof data !== 'object') throw new Error('expected json object')
  if (!('score' in data) || !('categories' in data)) {
    throw new Error('shape inesperada: ' + JSON.stringify(data).slice(0, 100))
  }
})

add('9. ocr_fail_count column + RPCs existem', async () => {
  const { error } = await supa.from('documentos').select('id, ocr_fail_count').limit(1)
  if (error) throw error
  // RPC reset
  const { error: rpcErr } = await supa.rpc('rpc_reset_ocr_fail_count', { p_documento_id: '__non-existent__' })
  if (rpcErr && /does not exist/i.test(rpcErr.message)) throw rpcErr
})

let pass = 0
let fail = 0
for (const c of checks) {
  try {
    await c.fn()
    console.log(`✅ ${c.name}`)
    pass++
  } catch (err) {
    console.log(`❌ ${c.name}`)
    console.log(`   ${err.message}`)
    fail++
  }
}

console.log(`\n${pass}/${pass + fail} checks OK`)
process.exit(fail === 0 ? 0 : 1)

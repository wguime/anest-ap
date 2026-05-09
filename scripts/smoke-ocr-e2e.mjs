/**
 * Smoke test E2E do pipeline OCR (Sprint 4 / O2-2).
 *
 * O OCR em si é client-side (Tesseract WASM no browser). Este smoke valida
 * a camada de persistência + indexação que o pipeline depende:
 *
 *   1. Migration `20260506100000_doc_ocr.sql` aplicada (colunas ocr_*)
 *   2. Migration `20260508500000_ocr_fail_count.sql` aplicada (coluna + 2 RPCs)
 *   3. RPC `rpc_increment_ocr_fail_count` incrementa atomicamente
 *   4. RPC `rpc_reset_ocr_fail_count` zera o contador
 *   5. UPDATE `ocr_text` reindexa `fts` (trigger weight D)
 *   6. CHECK constraint aceita actions ocr_started/ocr_completed/ocr_failed/ocr_skipped
 *   7. Cleanup
 *
 * Uso:
 *   node scripts/smoke-ocr-e2e.mjs
 *
 * Não imprime valor de secret. Usa service-role via JWT_SECRET.
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
  console.error('Faltam VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / SUPABASE_JWT_SECRET')
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

const TEST_DOC_ID = `doc-smoke-ocr-${Date.now()}`
const UNIQUE_TOKEN = `tokenocr${Date.now()}`

async function cleanup() {
  console.log('🧹 cleanup...')
  try {
    await sb.from('documentos').update({ deleted_at: new Date().toISOString(), deleted_by: 'smoke' }).eq('id', TEST_DOC_ID)
  } catch (_) {}
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
    throw err
  }
}

try {
  // 1. Insere doc base
  await step('1. Insert documentos row', async () => {
    const { error } = await sb.from('documentos').insert({
      id: TEST_DOC_ID,
      titulo: 'Smoke OCR',
      categoria: 'biblioteca',
      tipo: 'documento',
      status: 'rascunho',
      versao_atual: 1,
      storage_path: `biblioteca/${TEST_DOC_ID}/v1/test.pdf`,
      arquivo_nome: 'test.pdf',
      arquivo_tamanho: 100,
      created_by: ADMIN_UID,
      created_by_name: 'Smoke Test',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    if (error) throw error
  })

  // 2. Migration 20260506100000: colunas OCR existem
  await step('2. Colunas ocr_* presentes em documentos', async () => {
    const { data, error } = await sb.from('documentos')
      .select('ocr_status,ocr_text,ocr_text_url,ocr_engine,ocr_confidence,ocr_pages_processed,ocr_run_at,ocr_fail_count')
      .eq('id', TEST_DOC_ID).single()
    if (error) throw error
    if (data.ocr_fail_count !== 0) throw new Error(`ocr_fail_count default = ${data.ocr_fail_count} (esperado 0)`)
  })

  // 3. RPC rpc_increment_ocr_fail_count
  await step('3. RPC rpc_increment_ocr_fail_count atomica', async () => {
    const { data, error } = await sb.rpc('rpc_increment_ocr_fail_count', { p_documento_id: TEST_DOC_ID })
    if (error) throw error
    if (data !== 1) throw new Error(`returned ${data} (esperado 1)`)
    const r2 = await sb.rpc('rpc_increment_ocr_fail_count', { p_documento_id: TEST_DOC_ID })
    if (r2.error) throw r2.error
    if (r2.data !== 2) throw new Error(`segundo increment = ${r2.data} (esperado 2)`)
  })

  // 4. RPC rpc_reset_ocr_fail_count
  await step('4. RPC rpc_reset_ocr_fail_count zera', async () => {
    const { error } = await sb.rpc('rpc_reset_ocr_fail_count', { p_documento_id: TEST_DOC_ID })
    if (error) throw error
    const { data, error: e2 } = await sb.from('documentos').select('ocr_fail_count').eq('id', TEST_DOC_ID).single()
    if (e2) throw e2
    if (data.ocr_fail_count !== 0) throw new Error(`ocr_fail_count = ${data.ocr_fail_count} pós-reset (esperado 0)`)
  })

  // 5. Trigger fts re-indexa quando ocr_text muda (weight D)
  await step('5. UPDATE ocr_text reindexa fts (weight D)', async () => {
    const ocrText = `Conteudo OCR de teste com termo unico ${UNIQUE_TOKEN} para validar fts weight D`
    const { error } = await sb.from('documentos')
      .update({ ocr_status: 'done', ocr_text: ocrText, ocr_engine: 'tesseract-wasm-v5-por', ocr_confidence: 0.85, ocr_pages_processed: 1, ocr_run_at: new Date().toISOString() })
      .eq('id', TEST_DOC_ID)
    if (error) throw error

    // Busca via fts: token único só pode estar no ocr_text
    const { data, error: e2 } = await sb.from('documentos')
      .select('id,ocr_status')
      .eq('id', TEST_DOC_ID)
      .textSearch('fts', UNIQUE_TOKEN, { type: 'plain', config: 'portuguese' })
    if (e2) throw e2
    if (!data || data.length === 0) throw new Error('fts não retornou doc após update de ocr_text — trigger não está reindexando')
    if (data[0].ocr_status !== 'done') throw new Error(`ocr_status=${data[0].ocr_status}`)
  })

  // 6. CHECK constraint aceita as 4 actions OCR no changelog
  await step('6. documento_changelog aceita actions ocr_*', async () => {
    const actions = ['ocr_started', 'ocr_completed', 'ocr_failed', 'ocr_skipped']
    for (const action of actions) {
      const { error } = await sb.from('documento_changelog').insert({
        documento_id: TEST_DOC_ID,
        action,
        user_id: ADMIN_UID,
        user_name: 'Smoke',
        user_email: 'smoke@test',
        changes: { smoke: true },
      })
      if (error) throw new Error(`action ${action}: ${error.message}`)
    }
  })

  // 7. logAction wiring: query as 4 actions criadas
  await step('7. Changelog populado com 4 actions OCR', async () => {
    const { data, error } = await sb.from('documento_changelog')
      .select('action').eq('documento_id', TEST_DOC_ID)
    if (error) throw error
    const set = new Set((data || []).map((r) => r.action))
    for (const a of ['ocr_started', 'ocr_completed', 'ocr_failed', 'ocr_skipped']) {
      if (!set.has(a)) throw new Error(`falta action ${a} (got ${[...set].join(',')})`)
    }
  })
} catch (_) {
  // erros já reportados em step()
} finally {
  await cleanup()
}

console.log(`\n${pass}/${pass + fail} steps OK`)
process.exit(fail === 0 ? 0 : 1)

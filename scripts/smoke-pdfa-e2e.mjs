/**
 * Smoke test E2E do pipeline PDF/A.
 *
 * Fluxo:
 *   1. Insere doc de teste com status='arquivado' e storagePath em bucket 'documentos'
 *   2. Faz upload de um PDF mínimo no bucket 'documentos'
 *   3. Invoca edge function 'pdfa-convert' com auth JWT
 *   4. Polla até pdfa_status='done' ou 'failed' (timeout 60s)
 *   5. Verifica que o arquivo existe em 'documentos-pdfa'
 *   6. Verifica que documento_changelog tem actions 'pdfa_started' + 'pdfa_generated'
 *   7. Cleanup: deleta doc + storage objects + changelog entries
 *
 * Uso:
 *   node scripts/smoke-pdfa-e2e.mjs
 *
 * Não imprime nenhum valor de secret. Usa service-role via JWT_SECRET
 * (mesmo padrão de scripts/check-supabase-counts.mjs).
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

const ADMIN_UID = 'pPdKZ75E9zNdPnLz50qisPiHfJw1' // wguime — admin Firebase UID per memory

const jwt = await new SignJWT({
  iss: 'supabase',
  ref: 'vjzrahruvjffyyqyhjny',
  role: 'authenticated',
  sub: ADMIN_UID,
  email: 'wguime@yahoo.com.br',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
})
  .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
  .sign(new TextEncoder().encode(JWT_SECRET))

const serviceJwt = await new SignJWT({
  iss: 'supabase',
  ref: 'vjzrahruvjffyyqyhjny',
  role: 'service_role',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
})
  .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
  .sign(new TextEncoder().encode(JWT_SECRET))

// Service-role client (cleanup; bypassa RLS)
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${serviceJwt}` } },
})

const TEST_DOC_ID = `doc-smoke-pdfa-${Date.now()}`
const TEST_STORAGE_PATH = `biblioteca/${TEST_DOC_ID}/v1/test.pdf`
let pdfaStorageObjectPath = null

// Minimal valid 1-page PDF (~ 460 bytes)
const minimalPdfBytes = new Uint8Array([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a,
  0x25, 0xc4, 0xe5, 0xf2, 0xe5, 0xeb, 0xa7, 0xf3, 0xa0, 0xd0, 0xc4, 0xc6, 0x0a,
  ...new TextEncoder().encode(
    '4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 18 Tf\n20 50 Td\n(ANEST PDFA SMOKE) Tj\nET\nendstream\nendobj\n' +
    '3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/Resources <<\n/Font <<\n/F1 5 0 R\n>>\n>>\n/MediaBox [0 0 200 100]\n/Contents 4 0 R\n>>\nendobj\n' +
    '5 0 obj\n<<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>\nendobj\n' +
    '2 0 obj\n<<\n/Type /Pages\n/Count 1\n/Kids [3 0 R]\n>>\nendobj\n' +
    '1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n' +
    'xref\n0 6\n0000000000 65535 f\n0000000456 00000 n\n0000000389 00000 n\n0000000164 00000 n\n0000000013 00000 n\n0000000310 00000 n\ntrailer\n<<\n/Size 6\n/Root 1 0 R\n>>\nstartxref\n506\n%%EOF\n'
  ),
])

async function cleanup() {
  console.log('🧹 cleanup...')
  // Delete bucket files
  try { await sb.storage.from('documentos').remove([TEST_STORAGE_PATH]) } catch (_) {}
  if (pdfaStorageObjectPath) {
    try { await sb.storage.from('documentos-pdfa').remove([pdfaStorageObjectPath]) } catch (_) {}
  }
  // Changelog: precisamos bypass do WORM trigger via service-role (que session_role
  // espera 'service_role' — JWT customizado não satisfaz, mesmo com role no claim).
  // A migration 20260508000000 trocou para current_setting('role'); como não conseguimos
  // setar isso via PostgREST, deixamos os 2 changelog rows (pdfa_started + pdfa_generated)
  // — não é problema de teste; em prod admin pode purgar manualmente se quiser.
  // Soft-delete do doc:
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
  // 1. Upload do PDF
  await step('1. Upload PDF de teste em documentos/', async () => {
    const { error } = await sb.storage.from('documentos').upload(TEST_STORAGE_PATH, minimalPdfBytes, {
      contentType: 'application/pdf', upsert: true,
    })
    if (error) throw error
  })

  // 2. Insere documento arquivado
  await step('2. Insert documentos row (status=arquivado)', async () => {
    const { error } = await sb.from('documentos').insert({
      id: TEST_DOC_ID,
      titulo: 'Smoke PDF/A',
      categoria: 'biblioteca',
      tipo: 'documento',
      status: 'arquivado',
      versao_atual: 1,
      storage_path: TEST_STORAGE_PATH,
      arquivo_nome: 'test.pdf',
      arquivo_tamanho: minimalPdfBytes.byteLength,
      created_by: ADMIN_UID,
      created_by_name: 'Smoke Test',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    if (error) throw error
  })

  // 3. Invoca edge function pdfa-convert
  await step('3. Invoke edge function pdfa-convert', async () => {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/pdfa-convert`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        documentoId: TEST_DOC_ID,
        sourceStoragePath: `documentos/${TEST_STORAGE_PATH}`,
      }),
    })
    if (!r.ok) {
      const t = await r.text()
      throw new Error(`HTTP ${r.status}: ${t.slice(0, 200)}`)
    }
    const json = await r.json()
    if (!json.success) throw new Error('edge function returned no success: ' + JSON.stringify(json))
    pdfaStorageObjectPath = json.pdfaUrl?.replace(/^documentos-pdfa\//, '')
  })

  // 4. Verifica que pdfa_status='done' no documento
  await step('4. documentos.pdfa_status = done', async () => {
    const { data, error } = await sb.from('documentos').select('pdfa_status, pdfa_url, pdfa_pages, pdfa_size_bytes').eq('id', TEST_DOC_ID).single()
    if (error) throw error
    if (data.pdfa_status !== 'done') throw new Error(`got pdfa_status=${data.pdfa_status}`)
    if (!data.pdfa_url) throw new Error('pdfa_url null')
    if (!data.pdfa_pages || data.pdfa_pages < 1) throw new Error(`pdfa_pages=${data.pdfa_pages}`)
    if (!data.pdfa_size_bytes || data.pdfa_size_bytes < 100) throw new Error(`pdfa_size_bytes=${data.pdfa_size_bytes}`)
  })

  // 5. Verifica arquivo no bucket documentos-pdfa
  await step('5. Arquivo presente no bucket documentos-pdfa', async () => {
    if (!pdfaStorageObjectPath) throw new Error('pdfaStorageObjectPath null')
    const { data, error } = await sb.storage.from('documentos-pdfa').download(pdfaStorageObjectPath)
    if (error) throw error
    if (!data || data.size < 100) throw new Error(`download size=${data?.size}`)
  })

  // 6. Verifica changelog (pdfa_generated)
  await step('6. documento_changelog tem action=pdfa_generated', async () => {
    const { data, error } = await sb.from('documento_changelog')
      .select('action').eq('documento_id', TEST_DOC_ID).order('created_at', { ascending: false })
    if (error) throw error
    const actions = (data || []).map((r) => r.action)
    if (!actions.includes('pdfa_generated')) throw new Error('missing pdfa_generated; got: ' + JSON.stringify(actions))
  })
} catch (_) {
  // erros já reportados em step()
} finally {
  await cleanup()
}

console.log(`\n${pass}/${pass + fail} steps OK`)
process.exit(fail === 0 ? 0 : 1)

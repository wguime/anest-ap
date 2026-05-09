/**
 * Smoke test E2E da taxonomia de Tags (Sprint 8 / O2-7).
 *
 * Valida:
 *   1. Migration aplicada (tabela `tags` + colunas)
 *   2. Seed inicial (14 tags) presente
 *   3. Slug inválido rejeitado pelo CHECK constraint
 *   4. Trigger de ciclo bloqueia auto-referência
 *   5. Trigger de ciclo bloqueia loop transitivo (A→B, B→A)
 *   6. RPC rpc_tag_descendants retorna árvore corretamente
 *   7. RPC rpc_documentos_by_tag_tree filtra docs por tag + descendentes
 *   8. RLS write bloqueado para non-admin (skip se não testável)
 *   9. Cleanup
 *
 * Uso:
 *   node scripts/smoke-tags-e2e.mjs
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

const SUFFIX = String(Date.now()).slice(-8)
const TEST_TAG_PARENT = `smoke-parent-${SUFFIX}`
const TEST_TAG_CHILD = `smoke-child-${SUFFIX}`
const TEST_TAG_GRANDCHILD = `smoke-grandchild-${SUFFIX}`
const TEST_DOC_ID = `doc-smoke-tag-${Date.now()}`

async function cleanup() {
  console.log('🧹 cleanup...')
  // delete child first (FK RESTRICT)
  for (const slug of [TEST_TAG_GRANDCHILD, TEST_TAG_CHILD, TEST_TAG_PARENT]) {
    try { await sb.from('tags').delete().eq('slug', slug) } catch (_) {}
  }
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
  }
}

try {
  // 1. Tabela tags acessível
  await step('1. SELECT tags retorna seed inicial', async () => {
    const { data, error } = await sb.from('tags').select('slug').limit(20)
    if (error) throw error
    if (!data || data.length < 5) throw new Error(`apenas ${data?.length ?? 0} tags encontradas`)
  })

  // 2. Tags raiz da seed
  await step('2. Seed contém tags raiz esperadas', async () => {
    const { data, error } = await sb.from('tags').select('slug,label,parent_slug').is('parent_slug', null)
    if (error) throw error
    const slugs = new Set((data || []).map((r) => r.slug))
    for (const expected of ['clinico', 'seguranca', 'qualidade']) {
      if (!slugs.has(expected)) throw new Error(`tag raiz "${expected}" não encontrada (got: ${[...slugs].join(',')})`)
    }
  })

  // 3. CHECK constraint rejeita slug inválido
  await step('3. CHECK constraint rejeita slug com maiúscula', async () => {
    const { error } = await sb.from('tags').insert({
      slug: 'INVALID-Slug', label: 'X', created_by: ADMIN_UID,
    })
    if (!error) {
      // cleanup se passou (não deveria)
      await sb.from('tags').delete().eq('slug', 'INVALID-Slug')
      throw new Error('insert com slug inválido foi aceito')
    }
  })

  // 4. Insert hierarquia válida + auto-referência bloqueada
  await step('4. Cria parent + child + grandchild', async () => {
    const r1 = await sb.from('tags').insert({ slug: TEST_TAG_PARENT, label: 'Parent', created_by: ADMIN_UID })
    if (r1.error) throw r1.error
    const r2 = await sb.from('tags').insert({ slug: TEST_TAG_CHILD, label: 'Child', parent_slug: TEST_TAG_PARENT, created_by: ADMIN_UID })
    if (r2.error) throw r2.error
    const r3 = await sb.from('tags').insert({ slug: TEST_TAG_GRANDCHILD, label: 'Grandchild', parent_slug: TEST_TAG_CHILD, created_by: ADMIN_UID })
    if (r3.error) throw r3.error
  })

  await step('5. Trigger bloqueia auto-referência (slug = parent_slug)', async () => {
    const { error } = await sb.from('tags')
      .update({ parent_slug: TEST_TAG_PARENT })
      .eq('slug', TEST_TAG_PARENT)
    if (!error) throw new Error('auto-referência foi aceita')
  })

  await step('6. Trigger bloqueia ciclo transitivo (parent ← grandchild)', async () => {
    // Tentaria fazer PARENT ter como pai o GRANDCHILD → ciclo
    const { error } = await sb.from('tags')
      .update({ parent_slug: TEST_TAG_GRANDCHILD })
      .eq('slug', TEST_TAG_PARENT)
    if (!error) throw new Error('ciclo transitivo foi aceito')
  })

  // 7. RPC descendents
  await step('7. RPC rpc_tag_descendants retorna 3 nodes (parent + child + grandchild)', async () => {
    const { data, error } = await sb.rpc('rpc_tag_descendants', { p_slug: TEST_TAG_PARENT })
    if (error) throw error
    const slugs = (data || []).map((r) => r.slug)
    if (!slugs.includes(TEST_TAG_PARENT)) throw new Error(`falta parent (${slugs.join(',')})`)
    if (!slugs.includes(TEST_TAG_CHILD)) throw new Error(`falta child (${slugs.join(',')})`)
    if (!slugs.includes(TEST_TAG_GRANDCHILD)) throw new Error(`falta grandchild (${slugs.join(',')})`)
    if (data.length !== 3) throw new Error(`esperado 3 nodes, got ${data.length}`)
  })

  // 8. RPC docs by tag tree — cria doc com tag grandchild, busca por parent
  await step('8. RPC rpc_documentos_by_tag_tree filtra docs por tag + descendentes', async () => {
    const r1 = await sb.from('documentos').insert({
      id: TEST_DOC_ID,
      titulo: 'Smoke Tag Tree',
      categoria: 'biblioteca',
      tipo: 'documento',
      status: 'rascunho',
      versao_atual: 1,
      tags: [TEST_TAG_GRANDCHILD],
      storage_path: `biblioteca/${TEST_DOC_ID}/v1/x.pdf`,
      arquivo_nome: 'x.pdf',
      arquivo_tamanho: 1,
      created_by: ADMIN_UID,
      created_by_name: 'Smoke',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    if (r1.error) throw r1.error

    const { data, error } = await sb.rpc('rpc_documentos_by_tag_tree', { p_slug: TEST_TAG_PARENT })
    if (error) throw error
    const ids = (data || []).map((row) => (typeof row === 'string' ? row : row.id ?? row))
    if (!ids.includes(TEST_DOC_ID)) throw new Error(`doc com tag grandchild não retornou em busca pelo parent. got=${JSON.stringify(ids).slice(0,200)}`)
  })

  // 9. DELETE com FK RESTRICT bloqueia parent que tem child
  await step('9. ON DELETE RESTRICT bloqueia delete de parent com child', async () => {
    const { error } = await sb.from('tags').delete().eq('slug', TEST_TAG_PARENT)
    if (!error) {
      // cleanup vai pegar
      throw new Error('parent foi deletado mesmo tendo child (RESTRICT falhou)')
    }
  })
} catch (e) {
  console.error('Erro fatal:', e.message)
} finally {
  await cleanup()
}

console.log(`\n${pass}/${pass + fail} steps OK`)
process.exit(fail === 0 ? 0 : 1)

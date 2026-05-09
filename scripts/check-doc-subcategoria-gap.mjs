/**
 * Diagnóstico: docs com categoria='biblioteca' mas subcategoria NULL/inválida.
 *
 * Esses docs aparecem no Centro de Gestão (que filtra por categoria) mas
 * NÃO na BibliotecaPage (que filtra por subcategoria === one-of CATEGORIA_CONFIG).
 *
 * Read-only — apenas SELECT. Não modifica nada.
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

const serviceJwt = await new SignJWT({
  iss: 'supabase', ref: 'vjzrahruvjffyyqyhjny', role: 'service_role',
  iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600,
})
  .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
  .sign(new TextEncoder().encode(JWT_SECRET))

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${serviceJwt}` } },
})

const VALID_BIBLIOTECA_SUBCATEGORIAS = [
  'modelos', 'governanca', 'institucional', 'planejamento', 'normas',
  'manuais', 'formularios', 'relatorios', 'mapas-processo', 'outros',
  'obsoletos',
]

console.log('=== Diagnóstico: docs categoria/subcategoria ===\n')

// 1. Total por categoria
const { data: total, error: e1 } = await sb
  .from('documentos')
  .select('categoria', { count: 'exact', head: false })
  .is('deleted_at', null)
if (e1) { console.error(e1); process.exit(1) }

const counts = total.reduce((acc, r) => {
  acc[r.categoria] = (acc[r.categoria] ?? 0) + 1
  return acc
}, {})
console.log('Total docs ativos por categoria:')
for (const [k, v] of Object.entries(counts).sort()) {
  console.log(`  ${k.padEnd(15)} ${v}`)
}

// 2. Docs categoria='biblioteca' com subcategoria
const { data: biblio, error: e2 } = await sb
  .from('documentos')
  .select('id,titulo,subcategoria,status,created_at')
  .eq('categoria', 'biblioteca')
  .is('deleted_at', null)
if (e2) { console.error(e2); process.exit(1) }

console.log(`\nTotal docs com categoria='biblioteca': ${biblio.length}`)
const subCounts = biblio.reduce((acc, r) => {
  const k = r.subcategoria ?? '(NULL)'
  acc[k] = (acc[k] ?? 0) + 1
  return acc
}, {})
console.log('  Distribuição por subcategoria:')
for (const [k, v] of Object.entries(subCounts).sort()) {
  const valid = VALID_BIBLIOTECA_SUBCATEGORIAS.includes(k) ? '✓' : '✗ INVÁLIDA'
  console.log(`    ${k.padEnd(20)} ${v}  ${valid}`)
}

// 3. Lista os docs órfãos
const orphans = biblio.filter(
  (r) => !VALID_BIBLIOTECA_SUBCATEGORIAS.includes(r.subcategoria)
)
console.log(`\n🚨 Docs ÓRFÃOS (categoria='biblioteca' + subcategoria inválida): ${orphans.length}`)
if (orphans.length) {
  console.log('  Primeiros 10:')
  for (const r of orphans.slice(0, 10)) {
    const sub = r.subcategoria ?? 'NULL'
    console.log(`    ${r.id.slice(0, 30)}  sub=${sub.padEnd(15)}  "${(r.titulo ?? '').slice(0, 50)}"`)
  }
}

// 4. Outras categorias com subcategoria? (para detectar se Centro de Gestão tem mesmo problema)
console.log('\n=== Subcategorias presentes em outras categorias ===')
const { data: all } = await sb
  .from('documentos')
  .select('categoria,subcategoria')
  .is('deleted_at', null)
  .neq('categoria', 'biblioteca')
const subByCat = {}
for (const r of all) {
  if (!subByCat[r.categoria]) subByCat[r.categoria] = new Set()
  subByCat[r.categoria].add(r.subcategoria ?? '(NULL)')
}
for (const [cat, subs] of Object.entries(subByCat)) {
  console.log(`  ${cat}: ${[...subs].slice(0, 5).join(', ')}${subs.size > 5 ? `, ...(${subs.size})` : ''}`)
}

console.log('\n✅ Diagnóstico OK.')

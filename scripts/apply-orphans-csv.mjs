/**
 * Wave 4 W4-2 — Aplica subcategoria via CSV revisado pelo usuário.
 *
 * Lê tmp/docs-orfaos-sugestao.csv (gerado por gen-orphans-csv.mjs).
 * Para cada linha, faz UPDATE documentos SET subcategoria=$slug WHERE id=$id.
 * Idempotente: se já tiver subcategoria correta, no-op.
 *
 * Pede confirmação [Y/n] antes de aplicar (atende regra "blind apply").
 *
 * Uso:
 *   node scripts/apply-orphans-csv.mjs
 *   node scripts/apply-orphans-csv.mjs --dry-run   # só mostra o que faria
 */
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createInterface } from 'readline'
import { SignJWT } from 'jose'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')

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

const VALID_SUBCATEGORIAS = new Set([
  'modelos', 'governanca', 'institucional', 'assistencial', 'gestao_pessoas',
  'residencia', 'financeiro', 'qualidade', 'tecnologia_mat', 'relatorios_gerais',
  'obsoletos',
])

const csvPath = resolve(projectRoot, 'tmp/docs-orfaos-sugestao.csv')
if (!existsSync(csvPath)) {
  console.error(`CSV não encontrado: ${csvPath}\nRode primeiro: node scripts/gen-orphans-csv.mjs`)
  process.exit(1)
}

// Parser CSV simples (suporta campos quoted com vírgulas/quebras)
function parseCsv(content) {
  const lines = []
  let row = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < content.length; i++) {
    const ch = content[i]
    if (inQuotes) {
      if (ch === '"' && content[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') inQuotes = false
      else cur += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { row.push(cur); cur = '' }
      else if (ch === '\n' || ch === '\r') {
        if (cur || row.length) { row.push(cur); lines.push(row); row = []; cur = '' }
      } else cur += ch
    }
  }
  if (cur || row.length) { row.push(cur); lines.push(row) }
  return lines
}

const csv = parseCsv(readFileSync(csvPath, 'utf8'))
const header = csv.shift()
const idIdx = header.indexOf('id')
const subIdx = header.indexOf('subcategoria_sugerida')
const tituloIdx = header.indexOf('titulo')

if (idIdx < 0 || subIdx < 0) {
  console.error('CSV inválido: colunas "id" e "subcategoria_sugerida" obrigatórias')
  process.exit(1)
}

const updates = csv.filter((r) => r[idIdx] && r[subIdx]).map((r) => ({
  id: r[idIdx],
  titulo: r[tituloIdx] ?? '',
  subcategoria: r[subIdx].toLowerCase().trim(),
}))

const invalid = updates.filter((u) => !VALID_SUBCATEGORIAS.has(u.subcategoria))
if (invalid.length) {
  console.error(`❌ ${invalid.length} subcategoria(s) inválida(s) no CSV:`)
  for (const u of invalid) console.error(`   ${u.id}: "${u.subcategoria}"`)
  console.error(`Valores aceitos: ${[...VALID_SUBCATEGORIAS].join(', ')}`)
  process.exit(1)
}

console.log(`Total updates: ${updates.length}`)
const distribution = updates.reduce((a, u) => ((a[u.subcategoria] = (a[u.subcategoria] || 0) + 1), a), {})
for (const [k, v] of Object.entries(distribution).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(20)} ${v}`)
}

if (DRY_RUN) {
  console.log('\n[DRY-RUN] nenhuma escrita feita. Saindo.')
  process.exit(0)
}

async function ask(q) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    rl.question(q, (a) => { rl.close(); resolve(a.trim().toLowerCase()) })
  })
}

const ans = await ask(`\nAplicar ${updates.length} updates em prod? [Y/n] `)
if (ans === 'n') { console.log('Cancelado.'); process.exit(0) }

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

let ok = 0, fail = 0
for (const u of updates) {
  const { error } = await sb
    .from('documentos')
    .update({ subcategoria: u.subcategoria, updated_at: new Date().toISOString() })
    .eq('id', u.id)
  if (error) { console.error(`❌ ${u.id}: ${error.message}`); fail++ }
  else ok++
}

console.log(`\n${ok}/${updates.length} updates OK; ${fail} falhas.`)
process.exit(fail === 0 ? 0 : 1)

/**
 * Wave 4 W4-2 — Gera CSV de classificação dos docs órfãos.
 *
 * Heurística por título → subcategoria sugerida:
 *   - protocolo|manejo|prevenção|profilaxia|sedação|manutenção|cuidado → assistencial
 *   - auditoria|qualidade|qualificação                                  → qualidade
 *   - política financeira|financeira|financeiro                         → financeiro
 *   - política|fornecedor                                               → governanca
 *   - relatório|relatorio|bate mapa                                     → relatorios_gerais
 *   - default                                                           → assistencial
 *
 * Output: tmp/docs-orfaos-sugestao.csv com colunas:
 *   id, titulo, subcategoria_atual, subcategoria_sugerida, confianca, motivo
 *
 * User revisa CSV e ajusta. Depois roda apply-orphans-csv.mjs.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
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

const VALID_SUBCATEGORIAS = [
  'modelos', 'governanca', 'institucional', 'assistencial', 'gestao_pessoas',
  'residencia', 'financeiro', 'qualidade', 'tecnologia_mat', 'relatorios_gerais',
  'obsoletos',
]

/**
 * @returns {[string, number, string]} [subcategoria_sugerida, confianca, motivo]
 */
function suggestSubcategoria(titulo) {
  const t = (titulo || '').toLowerCase()
  // ordem importa: regras mais específicas primeiro
  if (/financeir[ao]/.test(t)) return ['financeiro', 0.95, 'matched: financeira/financeiro']
  if (/relat[óo]rio|bate\s*mapa/.test(t)) return ['relatorios_gerais', 0.9, 'matched: relatório/bate mapa']
  if (/auditori|qualidad|qualifica[cç][aã]o/.test(t)) return ['qualidade', 0.9, 'matched: auditoria/qualidade/qualificação']
  if (/pol[íi]tica|fornecedor|regimento/.test(t)) return ['governanca', 0.8, 'matched: política/fornecedor/regimento']
  if (/contrato|legal|acordo/.test(t)) return ['institucional', 0.8, 'matched: contrato/legal/acordo']
  if (/funcion[áa]ri|colaborador|sal[áa]rio|f[ée]rias/.test(t)) return ['gestao_pessoas', 0.85, 'matched: funcionário/colaborador']
  if (/resid[êe]ncia|residente|est[áa]gio/.test(t)) return ['residencia', 0.9, 'matched: residência/residente/estágio']
  if (/equipamento|t[ée]cnic|tecnologia|infra/.test(t)) return ['tecnologia_mat', 0.8, 'matched: equipamento/técnico']
  if (/protocolo|manejo|preven[cç][aã]o|profilaxi|seda[cç][aã]o|manuten[cç][aã]o|cuidado|alergia|deteriora[cç][aã]o|punc[cç][aã]o|n[áa]usea|dor|cefaleia|normotermia|broncoaspira[cç][aã]o|infec[cç][aã]o|h[íi]gi[ée]ne|antibiot|esterili|isc/.test(t)) {
    return ['assistencial', 0.9, 'matched: protocolo/clínico']
  }
  if (/modelo|template/.test(t)) return ['modelos', 0.95, 'matched: modelo/template']
  // fallback
  return ['assistencial', 0.4, 'fallback (revisar manualmente)']
}

const { data: orphans, error } = await sb
  .from('documentos')
  .select('id,titulo,subcategoria,categoria,tipo,created_at')
  .eq('categoria', 'biblioteca')
  .is('deleted_at', null)
  .or('subcategoria.is.null,subcategoria.eq.')

if (error) { console.error(error); process.exit(1) }

console.log(`Encontrados ${orphans.length} órfãos. Gerando CSV...`)

const tmpDir = resolve(projectRoot, 'tmp')
if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true })
const csvPath = resolve(tmpDir, 'docs-orfaos-sugestao.csv')

const escape = (v) => {
  if (v == null) return ''
  const s = String(v)
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

const rows = ['id,titulo,subcategoria_atual,subcategoria_sugerida,confianca,motivo']
let highConf = 0
const distribution = {}
for (const r of orphans) {
  const [sug, conf, motivo] = suggestSubcategoria(r.titulo)
  distribution[sug] = (distribution[sug] || 0) + 1
  if (conf >= 0.8) highConf++
  rows.push(
    [r.id, r.titulo, r.subcategoria ?? 'NULL', sug, conf.toFixed(2), motivo]
      .map(escape)
      .join(',')
  )
}
writeFileSync(csvPath, rows.join('\n') + '\n', 'utf8')

console.log(`✅ CSV gerado: ${csvPath}`)
console.log(`Total: ${orphans.length} | Alta confiança (≥0.8): ${highConf}\n`)
console.log('Distribuição sugerida:')
for (const [k, v] of Object.entries(distribution).sort((a, b) => b[1] - a[1])) {
  const valid = VALID_SUBCATEGORIAS.includes(k) ? '✓' : '✗ INVÁLIDA'
  console.log(`  ${k.padEnd(20)} ${v}  ${valid}`)
}
console.log('\nPróximos passos:')
console.log('  1. Abrir tmp/docs-orfaos-sugestao.csv e revisar a coluna "subcategoria_sugerida"')
console.log('  2. Ajustar onde achar incorreto')
console.log('  3. Salvar com mesmo nome')
console.log('  4. Rodar: node scripts/apply-orphans-csv.mjs')

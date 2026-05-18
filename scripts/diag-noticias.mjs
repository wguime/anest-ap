/**
 * Diagnóstico: por que `noticias` (publicações + destaques) não está atualizando?
 *
 * Verifica:
 *   1. Estado dos pg_cron jobs (fetch-noticias-daily, recompute-noticias-weekly)
 *   2. Histórico de execução (cron.job_run_details) — sucesso/falha/duração
 *   3. Estado dos dados em public.noticias (último fetched_at, publicado_em,
 *      count por fonte, count featured, count com final_score)
 *   4. Presença da secret `edge_fn_service_role` no Vault (sem expor valor)
 *
 * Rodar:  node scripts/diag-noticias.mjs
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

async function fromSchema(schema, table, query = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}${query}`
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      apikey: SUPABASE_ANON_KEY,
      'Accept-Profile': schema,
    },
  })
  if (!r.ok) {
    const txt = await r.text()
    return { error: { status: r.status, body: txt } }
  }
  return { data: await r.json() }
}

const fmtBR = (iso) => {
  if (!iso) return 'N/A'
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}
const hoursAgo = (iso) => {
  if (!iso) return null
  return Math.round((Date.now() - new Date(iso).getTime()) / 3600_000)
}

console.log('═══════════════════════════════════════════════════════════════')
console.log('  DIAGNÓSTICO: Publicações + Destaques Científicos (noticias) ')
console.log(`  Agora: ${fmtBR(new Date().toISOString())} (BRT)`)
console.log('═══════════════════════════════════════════════════════════════\n')

// 1) Cron jobs
console.log('━━━ 1) Cron jobs ativos ━━━')
const jobs = await fromSchema('cron', 'job', '?select=jobid,jobname,schedule,active,command')
if (jobs.error) {
  console.log(`  ⚠️  Sem acesso ao schema cron via PostgREST: ${jobs.error.status}`)
} else {
  const interest = jobs.data.filter((j) =>
    j.jobname === 'fetch-noticias-daily' || j.jobname === 'recompute-noticias-weekly'
  )
  if (interest.length === 0) {
    console.log('  ❌ NENHUM dos 2 jobs encontrados em cron.job!')
    console.log('     (provavelmente migration não foi aplicada em prod)')
  }
  for (const j of interest) {
    const icon = j.active ? '✅' : '❌ INATIVO'
    console.log(`  ${icon} ${j.jobname}  schedule="${j.schedule}"`)
  }
}

// 2) Últimas execuções
console.log('\n━━━ 2) Últimas execuções (cron.job_run_details) ━━━')
const runs = await fromSchema(
  'cron',
  'job_run_details',
  '?select=jobid,job_pid,start_time,end_time,status,return_message&order=start_time.desc&limit=20'
)
if (runs.error) {
  console.log(`  ⚠️  Sem acesso a job_run_details: ${runs.error.status}`)
} else {
  // mapear jobid → jobname
  const idToName = new Map()
  if (jobs.data) for (const j of jobs.data) idToName.set(j.jobid, j.jobname)
  const relevantIds = jobs.data
    ? new Set(jobs.data
        .filter((j) => j.jobname === 'fetch-noticias-daily' || j.jobname === 'recompute-noticias-weekly')
        .map((j) => j.jobid))
    : null
  const filtered = runs.data.filter((r) => !relevantIds || relevantIds.has(r.jobid))
  if (filtered.length === 0) {
    console.log('  ❌ Nenhum registro de execução pros 2 jobs nas últimas 20 runs')
  }
  for (const r of filtered.slice(0, 10)) {
    const name = idToName.get(r.jobid) || `jobid=${r.jobid}`
    const icon = r.status === 'succeeded' ? '✅' : (r.status === 'failed' ? '❌' : '⏳')
    console.log(`  ${icon} ${name}  ${fmtBR(r.start_time)}  status=${r.status}`)
    if (r.return_message && r.status !== 'succeeded') {
      console.log(`     msg: ${String(r.return_message).slice(0, 200)}`)
    }
  }
}

// 3) Estado dos dados em public.noticias
console.log('\n━━━ 3) Estado dos dados em public.noticias ━━━')
const { data: countRow } = await supa
  .from('noticias')
  .select('id', { count: 'exact', head: true })
const { count: totalCount } = await supa
  .from('noticias')
  .select('*', { count: 'exact', head: true })
console.log(`  Total de registros: ${totalCount ?? '?'}`)

const { data: latest } = await supa
  .from('noticias')
  .select('id, titulo, fonte, publicado_em, fetched_at, final_score, is_featured, scores_updated_at')
  .order('fetched_at', { ascending: false })
  .limit(5)
if (latest && latest.length) {
  const newest = latest[0]
  const fh = hoursAgo(newest.fetched_at)
  const ph = hoursAgo(newest.publicado_em)
  console.log(`  Último fetched_at:   ${fmtBR(newest.fetched_at)}  (há ~${fh}h)`)
  console.log(`  Último publicado_em: ${fmtBR(newest.publicado_em)}  (há ~${ph}h)`)
  if (fh > 36) console.log('  ⚠️  fetched_at > 36h — fetch-noticias-daily NÃO está rodando!')
  console.log('\n  Últimas 5 notícias inseridas:')
  for (const n of latest) {
    console.log(`   • [${n.fonte}] ${n.titulo.slice(0, 80)}`)
    console.log(`     fetched=${fmtBR(n.fetched_at)} score=${n.final_score ?? '∅'} feat=${n.is_featured}`)
  }
}

const { data: featured } = await supa
  .from('noticias')
  .select('id, titulo, scores_updated_at, final_score')
  .eq('is_featured', true)
  .order('final_score', { ascending: false })
const featCount = featured?.length ?? 0
console.log(`\n  Destaques (is_featured=true): ${featCount}`)
if (featCount > 0) {
  const newest = featured[0]
  console.log(`  Último scores_updated_at: ${fmtBR(newest.scores_updated_at)} (há ~${hoursAgo(newest.scores_updated_at)}h)`)
}

const { count: scoredCount } = await supa
  .from('noticias')
  .select('*', { count: 'exact', head: true })
  .not('final_score', 'is', null)
console.log(`  Com final_score: ${scoredCount ?? '?'} de ${totalCount ?? '?'}`)

// fontes / categorias breakdown
const { data: bySource } = await supa
  .from('noticias')
  .select('fonte')
  .order('fetched_at', { ascending: false })
  .limit(500)
if (bySource) {
  const counts = {}
  for (const r of bySource) counts[r.fonte] = (counts[r.fonte] || 0) + 1
  console.log('\n  Distribuição últimas 500 (por fonte):')
  for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${k}: ${v}`)
  }
}

// 4) Vault secret presence
console.log('\n━━━ 4) Vault: presença de edge_fn_service_role ━━━')
const vault = await fromSchema('vault', 'decrypted_secrets', '?select=name&name=eq.edge_fn_service_role')
if (vault.error) {
  console.log(`  ⚠️  Sem acesso a vault.decrypted_secrets via PostgREST: ${vault.error.status}`)
  console.log('     (esperado; vault não é exposto. Verifique no console SQL Supabase.)')
} else if (vault.data.length === 0) {
  console.log('  ❌ Secret edge_fn_service_role NÃO existe no vault!')
  console.log('     → cron `fetch-noticias-daily` faz POST com Bearer vazio → 401 silencioso')
} else {
  console.log('  ✅ Secret edge_fn_service_role presente')
}

console.log('\n═══════════════════════════════════════════════════════════════')
console.log('  Diagnóstico concluído.')
console.log('═══════════════════════════════════════════════════════════════')

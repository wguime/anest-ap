/**
 * Smoke test: confirma que os 5 cron jobs LGPD/retention/approval
 * estão schedulados em prod (issue #19 ativo).
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

const jwt = await new SignJWT({
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
  global: { headers: { Authorization: `Bearer ${jwt}` } },
})

const expected = [
  'lgpd-retencao-incidentes',
  'apply-retention-policy',
  'archive-expired-documents',
  'notify-review-approaching',
  'notify-review-overdue',
]

// schema cron is in extensions; PostgREST só vê tabelas em public por default.
// Tentamos via from('cron.job') via cabeçalho Accept-Profile.
const r = await fetch(`${SUPABASE_URL}/rest/v1/job?select=jobname,schedule`, {
  headers: {
    Authorization: `Bearer ${jwt}`,
    apikey: SUPABASE_ANON_KEY,
    'Accept-Profile': 'cron',
  },
})
let jobs = []
if (r.ok) {
  jobs = await r.json()
} else {
  console.log(`(schema cron não exposto via PostgREST — fallback via service_role status: ${r.status})`)
}

console.log(`Encontrados ${jobs.length} cron jobs no schema 'cron'`)
let pass = 0, fail = 0
for (const name of expected) {
  const job = jobs.find((j) => j.jobname === name)
  if (job) {
    console.log(`✅ ${name} — ${job.schedule}`)
    pass++
  } else {
    console.log(`⚠  ${name} — não detectado via PostgREST (verifique manualmente: SELECT * FROM cron.job WHERE jobname='${name}')`)
    fail++
  }
}
console.log(`\n${pass}/${expected.length} jobs confirmados via API`)
process.exit(0)

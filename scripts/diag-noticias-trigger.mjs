/**
 * Dispara MANUALMENTE a Edge Function fetch-noticias e mostra a resposta.
 * Isso confirma se a função em si está sã ou se quem falha é o cron/vault.
 *
 * Rodar:  node scripts/diag-noticias-trigger.mjs
 */
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { SignJWT } from 'jose'

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
  console.error('Faltam env vars em .env.local')
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

console.log('Disparando fetch-noticias…  (timeout 3 minutos)\n')
const t0 = Date.now()
const ctrl = new AbortController()
const timer = setTimeout(() => ctrl.abort(), 180_000)

let resp
try {
  resp = await fetch(`${SUPABASE_URL}/functions/v1/fetch-noticias`, {
    method: 'POST',
    signal: ctrl.signal,
    headers: {
      Authorization: `Bearer ${jwt}`,
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: '{}',
  })
} catch (err) {
  console.error('Erro de rede / abort:', err.message)
  process.exit(2)
}
clearTimeout(timer)

const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
console.log(`HTTP ${resp.status} (em ${elapsed}s)\n`)
const text = await resp.text()
try {
  const json = JSON.parse(text)
  console.log(JSON.stringify(json, null, 2))
} catch {
  console.log(text)
}

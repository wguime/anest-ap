/**
 * Dispara manualmente translate-noticias-async para processar a fila imediatamente
 * (sem esperar o cron de 1 minuto).
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

const jwt = await new SignJWT({
  iss: 'supabase',
  ref: 'vjzrahruvjffyyqyhjny',
  role: 'service_role',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
})
  .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
  .sign(new TextEncoder().encode(JWT_SECRET))

console.log('Disparando translate-noticias-async…')
const t0 = Date.now()
const resp = await fetch(`${SUPABASE_URL}/functions/v1/translate-noticias-async`, {
  method: 'POST',
  signal: AbortSignal.timeout(180_000),
  headers: {
    Authorization: `Bearer ${jwt}`,
    apikey: SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  },
  body: '{}',
})
const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
console.log(`HTTP ${resp.status} (em ${elapsed}s)\n`)
const text = await resp.text()
try { console.log(JSON.stringify(JSON.parse(text), null, 2)) }
catch { console.log(text) }

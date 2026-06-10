#!/usr/bin/env node
/**
 * Smoke test — contrato de auth das edges pós-migração verify-auth (Fase 1.3).
 *
 * Lê VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY de .env.local internamente
 * (nunca imprime valores). Casos:
 *   1. Bearer <anon key>: passa o gateway (JWT válido do projeto), chega na
 *      função; verifyAuthHeader valida HS256 mas sub está ausente → espera-se
 *      o reason de "invalid token" da função (prova que o helper roda em prod).
 *   2. generate-api-token sem Authorization (deployada com --no-verify-jwt):
 *      espera-se 401 missing_token direto da função.
 *
 * Uso: node scripts/smoke-edges-auth.mjs
 */
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
)

const URL_BASE = env.VITE_SUPABASE_URL
const ANON = env.VITE_SUPABASE_ANON_KEY
if (!URL_BASE || !ANON) {
  console.error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ausentes em .env.local')
  process.exit(1)
}

async function hit(fn, { withAuth }) {
  const headers = { 'Content-Type': 'application/json', apikey: ANON }
  if (withAuth) headers['Authorization'] = `Bearer ${ANON}`
  const res = await fetch(`${URL_BASE}/functions/v1/${fn}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  })
  const body = (await res.text()).slice(0, 120)
  console.log(`${fn} [auth=${withAuth ? 'anon-jwt' : 'nenhum'}] → ${res.status} ${body}`)
  return res.status
}

let fail = 0
// Caso 1: anon JWT chega na função → helper roda → invalid (sub ausente)
for (const fn of ['sign-cert', 'send-fcm-push', 'ai-rag']) {
  const s = await hit(fn, { withAuth: true })
  if (s !== 401) { console.error(`  ✗ esperado 401, obtido ${s}`); fail++ }
}
// Caso 2: no-verify-jwt, sem header → missing_token da função
{
  const s = await hit('generate-api-token', { withAuth: false })
  if (s !== 401) { console.error(`  ✗ esperado 401, obtido ${s}`); fail++ }
}
console.log(fail === 0 ? '✅ contratos de auth OK' : `❌ ${fail} falha(s)`)
process.exit(fail === 0 ? 0 : 1)

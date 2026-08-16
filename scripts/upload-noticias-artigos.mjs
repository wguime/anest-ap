#!/usr/bin/env node
/**
 * upload-noticias-artigos.mjs — sobe PDF open-access de artigo curado para o
 * bucket público `noticias-artigos` (criado em 20260816120000).
 *
 * O bucket não tem policy de escrita de propósito: upload só por aqui, com
 * papel service_role. Como a service key não fica no repo, o script assina
 * um JWT HS256 de 10 min com o SUPABASE_JWT_SECRET do .env.local (mesmo
 * mecanismo do fluxo de auth do app) — o segredo é consumido, nunca impresso.
 * Só aceite PDF com licença que permita redistribuição (CC-BY e afins) —
 * a URL final é pública.
 *
 * Uso:
 *   node scripts/upload-noticias-artigos.mjs <arquivo.pdf> [nome-no-bucket.pdf]
 */
import { SignJWT } from 'jose'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname, basename } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const env = {}
const envPath = resolve(root, '.env.local')
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^([^#=][^=]*)=(.*)$/)
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  })
}

const URL = process.env.SUPABASE_URL || env.VITE_SUPABASE_URL
const ANON = process.env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || env.SUPABASE_JWT_SECRET
if (!URL || !ANON || !JWT_SECRET) {
  console.error('❌ Faltam VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / SUPABASE_JWT_SECRET (.env.local).')
  process.exit(1)
}

const BUCKET = 'noticias-artigos'
const filePath = process.argv[2]
if (!filePath || !existsSync(filePath)) {
  console.error('Uso: node scripts/upload-noticias-artigos.mjs <arquivo.pdf> [nome-no-bucket.pdf]')
  process.exit(1)
}
const destName = (process.argv[3] || basename(filePath)).replace(/[^a-zA-Z0-9._-]/g, '')
if (!destName.toLowerCase().endsWith('.pdf')) {
  console.error('❌ Só PDF: o PDFEmbed do app exige URL terminando em .pdf')
  process.exit(1)
}

const token = await new SignJWT({ role: 'service_role', iss: 'supabase' })
  .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
  .setIssuedAt()
  .setExpirationTime('10m')
  .sign(new TextEncoder().encode(JWT_SECRET))

const body = readFileSync(filePath)
const res = await fetch(`${URL}/storage/v1/object/${BUCKET}/${destName}`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    apikey: ANON,
    'Content-Type': 'application/pdf',
    'x-upsert': 'true',
  },
  body,
})
if (!res.ok) {
  console.error('❌ Upload falhou:', res.status, (await res.text()).slice(0, 300))
  process.exit(1)
}
console.log('✅', `${URL}/storage/v1/object/public/${BUCKET}/${destName}`)

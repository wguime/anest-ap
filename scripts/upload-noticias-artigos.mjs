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
 *   node scripts/upload-noticias-artigos.mjs --dir <pasta>   # todos os .pdf da pasta
 */
import { SignJWT } from 'jose'
import { readFileSync, existsSync, readdirSync } from 'fs'
import { resolve, dirname, basename, join } from 'path'
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

let jobs = [] // [{ filePath, destName }]
if (process.argv[2] === '--dir') {
  const dir = process.argv[3]
  if (!dir || !existsSync(dir)) {
    console.error('Uso: node scripts/upload-noticias-artigos.mjs --dir <pasta-com-pdfs>')
    process.exit(1)
  }
  jobs = readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.pdf'))
    .map((f) => ({ filePath: join(dir, f), destName: f }))
  if (jobs.length === 0) {
    console.error('❌ Nenhum .pdf na pasta', dir)
    process.exit(1)
  }
} else {
  const filePath = process.argv[2]
  if (!filePath || !existsSync(filePath)) {
    console.error('Uso: node scripts/upload-noticias-artigos.mjs <arquivo.pdf> [nome-no-bucket.pdf]')
    process.exit(1)
  }
  jobs = [{ filePath, destName: process.argv[3] || basename(filePath) }]
}

const token = await new SignJWT({ role: 'service_role', iss: 'supabase' })
  .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
  .setIssuedAt()
  .setExpirationTime('10m')
  .sign(new TextEncoder().encode(JWT_SECRET))

let falhas = 0
for (const { filePath, destName } of jobs) {
  const safeName = destName.replace(/[^a-zA-Z0-9._-]/g, '')
  if (!safeName.toLowerCase().endsWith('.pdf')) {
    console.error('❌ Só PDF (o PDFEmbed do app exige URL terminando em .pdf):', destName)
    falhas++
    continue
  }
  const body = readFileSync(filePath)
  const res = await fetch(`${URL}/storage/v1/object/${BUCKET}/${safeName}`, {
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
    console.error('❌ Upload falhou:', safeName, res.status, (await res.text()).slice(0, 300))
    falhas++
    continue
  }
  console.log('✅', `${URL}/storage/v1/object/public/${BUCKET}/${safeName}`)
}
process.exit(falhas > 0 ? 1 : 0)

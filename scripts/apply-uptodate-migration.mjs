/**
 * Aplica APENAS a migration de uptodate_topics no Supabase remoto via pooler.
 *
 * Por que script direto e não `supabase db push`?
 * Há drift de 14 migrations locais não trackeadas no remoto, que provavelmente
 * foram aplicadas via Studio/SQL editor. `supabase db push` tentaria reaplicar
 * todas e quebraria. Este script roda só a SQL nova de uptodate_topics, isolada.
 *
 * Uso (rodar na raiz do projeto):
 *   node scripts/apply-uptodate-migration.mjs
 *
 * Lê SUPABASE_DB_PASSWORD de .env.local (já existente).
 * Conexão idempotente — todos os CREATE/INSERT usam IF NOT EXISTS / ON CONFLICT.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

function readEnvLocal() {
  const envPath = path.join(ROOT, '.env.local')
  if (!fs.existsSync(envPath)) {
    throw new Error('.env.local não encontrado')
  }
  const content = fs.readFileSync(envPath, 'utf8')
  const map = {}
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (!m) continue
    let val = m[2]
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    map[m[1]] = val
  }
  return map
}

async function main() {
  const env = readEnvLocal()
  const password = env.SUPABASE_DB_PASSWORD
  if (!password) {
    throw new Error('SUPABASE_DB_PASSWORD ausente em .env.local')
  }

  const sqlPath = path.join(
    ROOT,
    'supabase/migrations/20260429000000_create_uptodate_topics.sql',
  )
  const sql = fs.readFileSync(sqlPath, 'utf8')

  const client = new pg.Client({
    host: 'aws-0-us-west-2.pooler.supabase.com',
    port: 5432,
    user: 'postgres.vjzrahruvjffyyqyhjny',
    password,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  })

  console.log('[migrate] connecting to pooler...')
  await client.connect()
  try {
    console.log('[migrate] applying uptodate_topics migration...')
    await client.query(sql)
    console.log('[migrate] OK — checking results...')
    const tbl = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'uptodate_topics'
      ORDER BY ordinal_position
    `)
    console.log(`[migrate] uptodate_topics columns (${tbl.rows.length}):`)
    for (const r of tbl.rows) console.log(`  ${r.column_name}: ${r.data_type}`)

    const idx = await client.query(`
      SELECT indexname FROM pg_indexes
      WHERE schemaname='public' AND tablename='uptodate_topics'
      ORDER BY indexname
    `)
    console.log(`[migrate] indexes (${idx.rows.length}):`)
    for (const r of idx.rows) console.log(`  ${r.indexname}`)

    const rls = await client.query(`
      SELECT relrowsecurity FROM pg_class
      WHERE relname='uptodate_topics' AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')
    `)
    console.log(`[migrate] RLS enabled: ${rls.rows[0]?.relrowsecurity}`)

    const fn = await client.query(`
      SELECT proname FROM pg_proc
      WHERE proname='uptodate_refresh_featured'
    `)
    console.log(`[migrate] uptodate_refresh_featured fn: ${fn.rows.length > 0 ? 'OK' : 'MISSING'}`)
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error('[migrate] FAILED:', err.message)
  process.exit(1)
})

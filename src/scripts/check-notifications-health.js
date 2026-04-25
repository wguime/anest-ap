#!/usr/bin/env node

/**
 * Auditoria da saúde da tabela notifications:
 * - distribuição de categorias
 * - últimas notificações por categoria
 * - notificações por entidade (cateter, comunicado, etc.)
 * - confirma que CHECK constraint em category foi removida
 * - confirma que constraints de priority continuam aceitando os valores
 *   usados pelo app
 *
 * Uso (read-only):
 *   node src/scripts/check-notifications-health.js
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '../..')

const envPath = resolve(projectRoot, '.env.local')
const envVars = {}
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^([^#=][^=]*)=(.*)$/)
    if (m) envVars[m[1].trim()] = m[2].trim()
  })
}

const DB_PASSWORD = envVars.SUPABASE_DB_PASSWORD
if (!DB_PASSWORD) {
  console.error('ERRO: .env.local precisa ter SUPABASE_DB_PASSWORD')
  process.exit(1)
}

const { default: postgres } = await import('postgres')
const sql = postgres({
  host: 'aws-0-us-west-2.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  username: 'postgres.vjzrahruvjffyyqyhjny',
  password: DB_PASSWORD,
  ssl: 'require',
  prepare: false,
  max: 1,
})

console.log('=== Auditoria — public.notifications ===\n')

try {
  // 1. CHECK constraints ativos
  console.log('1. CHECK constraints ativos:')
  const checks = await sql`
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conrelid = 'public.notifications'::regclass AND contype = 'c'
    ORDER BY conname;
  `
  if (checks.length === 0) console.log('   (nenhum)')
  for (const r of checks) console.log(`   ${r.conname}: ${r.def}`)

  // 2. UNIQUE constraints / indexes
  console.log('\n2. UNIQUE indexes:')
  const uniques = await sql`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'notifications'
      AND indexdef ILIKE '%UNIQUE%'
    ORDER BY indexname;
  `
  if (uniques.length === 0) console.log('   (nenhum)')
  for (const r of uniques) console.log(`   ${r.indexname}\n     ${r.indexdef}`)

  // 3. Distribuição de categorias
  console.log('\n3. Distribuição por category:')
  const cats = await sql`
    SELECT category, COUNT(*)::int AS total,
           SUM(CASE WHEN read_at IS NULL THEN 1 ELSE 0 END)::int AS unread,
           MAX(created_at) AS last_at
    FROM public.notifications
    GROUP BY category
    ORDER BY total DESC;
  `
  console.log('   ' + 'category'.padEnd(16) + 'total'.padStart(8) + 'unread'.padStart(10) + '   last')
  for (const r of cats) {
    console.log(
      '   ' +
        String(r.category).padEnd(16) +
        String(r.total).padStart(8) +
        String(r.unread).padStart(10) +
        '   ' +
        new Date(r.last_at).toISOString().slice(0, 19)
    )
  }

  // 4. Distribuição por related_entity_type
  console.log('\n4. Distribuição por related_entity_type:')
  const ents = await sql`
    SELECT COALESCE(related_entity_type, '(null)') AS et,
           COUNT(*)::int AS total,
           COUNT(DISTINCT recipient_id)::int AS recipients,
           COUNT(DISTINCT related_entity_id)::int AS entities,
           MAX(created_at) AS last_at
    FROM public.notifications
    GROUP BY 1
    ORDER BY total DESC;
  `
  console.log('   ' + 'entity_type'.padEnd(34) + 'total'.padStart(7) + 'recip'.padStart(7) + 'ent'.padStart(6) + '   last')
  for (const r of ents) {
    console.log(
      '   ' +
        String(r.et).padEnd(34) +
        String(r.total).padStart(7) +
        String(r.recipients).padStart(7) +
        String(r.entities).padStart(6) +
        '   ' +
        new Date(r.last_at).toISOString().slice(0, 19)
    )
  }

  // 5. Últimas 5 notificações por categoria com problema potencial (cateter especialmente)
  console.log('\n5. Últimas notificações de cateter (sanity check):')
  const latestCateter = await sql`
    SELECT id, subject, recipient_id, related_entity_type, related_entity_id, created_at, read_at
    FROM public.notifications
    WHERE category = 'cateter'
    ORDER BY created_at DESC
    LIMIT 10;
  `
  for (const r of latestCateter) {
    const read = r.read_at ? '✓' : ' '
    console.log(
      `   [${read}] ${new Date(r.created_at).toISOString().slice(0, 16)}  ${r.subject}`
    )
    console.log(`        entity=${r.related_entity_type}/${r.related_entity_id?.slice(0, 8)}  recip=${r.recipient_id?.slice(0, 12)}`)
  }

  // 6. Cateter ativos sem notificação correspondente?
  console.log('\n6. Cateteres ativos sem notificação para algum destinatário ativo:')
  const orphans = await sql`
    WITH active_recipients AS (
      SELECT id FROM public.profiles
      WHERE active = true AND role IN ('anestesiologista', 'medico-residente')
    ),
    expected AS (
      SELECT c.id AS cateter_id, ar.id AS recipient_id
      FROM public.cateteres_peridural c
      CROSS JOIN active_recipients ar
    ),
    actual AS (
      SELECT (related_entity_id)::uuid AS cateter_id, recipient_id
      FROM public.notifications
      WHERE related_entity_type = 'cateter-peridural'
    )
    SELECT (e.cateter_id)::text AS cateter_id, COUNT(*)::int AS missing_recipients
    FROM expected e
    LEFT JOIN actual a ON a.cateter_id = e.cateter_id AND a.recipient_id = e.recipient_id
    WHERE a.recipient_id IS NULL
    GROUP BY e.cateter_id
    ORDER BY missing_recipients DESC
    LIMIT 5;
  `
  if (orphans.length === 0) {
    console.log('   ✓ todos os cateteres têm notificação para todos os destinatários ativos')
  } else {
    for (const r of orphans) {
      console.log(`   cateter=${r.cateter_id?.slice(0, 8)} → ${r.missing_recipients} destinatários sem notificação`)
    }
  }

  // 7. Total geral
  console.log('\n7. Resumo:')
  const total = await sql`
    SELECT COUNT(*)::int AS total,
           SUM(CASE WHEN read_at IS NULL THEN 1 ELSE 0 END)::int AS unread,
           COUNT(DISTINCT recipient_id)::int AS users_with_notif
    FROM public.notifications;
  `
  const t = total[0]
  console.log(`   total=${t.total} | unread=${t.unread} | usuários com notificação=${t.users_with_notif}`)
} catch (err) {
  console.error('\n✗ Erro na auditoria:', err.message)
  process.exit(1)
} finally {
  await sql.end()
}

#!/usr/bin/env node

/**
 * Aplica a migration que remove o CHECK constraint em notifications.category
 * (supabase/migrations/20260424120000_notifications_relax_category_check.sql)
 * via pooler.
 *
 * Uso:
 *   node src/scripts/apply-relax-category-check.js              # dry-run
 *   EXECUTE=1 node src/scripts/apply-relax-category-check.js    # aplica
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
const DRY_RUN = process.env.EXECUTE !== '1'

if (!DB_PASSWORD) {
  console.error('ERRO: .env.local precisa ter SUPABASE_DB_PASSWORD')
  process.exit(1)
}

const sqlPath = resolve(projectRoot, 'supabase/migrations/20260424120000_notifications_relax_category_check.sql')
const sql = readFileSync(sqlPath, 'utf8')

console.log(`=== Aplicar relax category check ${DRY_RUN ? '(DRY-RUN)' : '(EXECUTANDO)'} ===\n`)
console.log(`Arquivo: ${sqlPath}\n`)
console.log('---- SQL ----')
console.log(sql)
console.log('---- / ----\n')

if (DRY_RUN) {
  console.log('[DRY-RUN] Nada foi aplicado. Rode com EXECUTE=1 para efetivar.')
  process.exit(0)
}

const { default: postgres } = await import('postgres')

const sqlClient = postgres({
  host: 'aws-0-us-west-2.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  username: 'postgres.vjzrahruvjffyyqyhjny',
  password: DB_PASSWORD,
  ssl: 'require',
  prepare: false,
  max: 1,
})

try {
  console.log('Conectando ao pooler...')

  // Antes: mostrar constraint atual
  const beforeRows = await sqlClient`
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conrelid = 'public.notifications'::regclass
      AND contype = 'c';
  `
  console.log('\nCHECK constraints ANTES:')
  beforeRows.forEach((r) => console.log(`  ${r.conname}: ${r.def}`))

  await sqlClient.unsafe(sql)
  console.log('\n✓ Migration aplicada com sucesso.\n')

  const afterRows = await sqlClient`
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conrelid = 'public.notifications'::regclass
      AND contype = 'c';
  `
  console.log('CHECK constraints DEPOIS:')
  if (afterRows.length === 0) console.log('  (nenhuma)')
  afterRows.forEach((r) => console.log(`  ${r.conname}: ${r.def}`))
} catch (err) {
  console.error('\n✗ Erro aplicando migration:', err.message)
  process.exit(1)
} finally {
  await sqlClient.end()
}

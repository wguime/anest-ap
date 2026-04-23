#!/usr/bin/env node

/**
 * Aplica a migration de tightening RLS em notifications
 * (supabase/migrations/20260422203000_tighten_notifications_rls.sql) via pooler.
 *
 * Uso:
 *   node src/scripts/apply-notifications-rls-migration.js              # dry-run
 *   EXECUTE=1 node src/scripts/apply-notifications-rls-migration.js    # aplica
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../..');

const envPath = resolve(projectRoot, '.env.local');
const envVars = {};
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#=][^=]*)=(.*)$/);
    if (m) envVars[m[1].trim()] = m[2].trim();
  });
}

const DB_PASSWORD = envVars.SUPABASE_DB_PASSWORD;
const DRY_RUN = process.env.EXECUTE !== '1';

if (!DB_PASSWORD) {
  console.error('ERRO: .env.local precisa ter SUPABASE_DB_PASSWORD');
  process.exit(1);
}

const sqlPath = resolve(projectRoot, 'supabase/migrations/20260422203000_tighten_notifications_rls.sql');
const sql = readFileSync(sqlPath, 'utf8');

console.log(`=== Aplicar RLS migration ${DRY_RUN ? '(DRY-RUN)' : '(EXECUTANDO)'} ===\n`);
console.log(`Arquivo: ${sqlPath}\n`);
console.log('---- SQL ----');
console.log(sql);
console.log('---- / ----\n');

if (DRY_RUN) {
  console.log('[DRY-RUN] Nada foi aplicado. Rode com EXECUTE=1 para efetivar.');
  process.exit(0);
}

const { default: postgres } = await import('postgres');

const sqlClient = postgres({
  host: 'aws-0-us-west-2.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  username: 'postgres.vjzrahruvjffyyqyhjny',
  password: DB_PASSWORD,
  ssl: 'require',
  prepare: false,
  max: 1,
});

try {
  console.log('Conectando ao pooler...');
  await sqlClient.unsafe(sql);
  console.log('\n✓ Migration aplicada com sucesso.\n');

  // Verificação: lista policies em notifications
  const policies = await sqlClient`
    SELECT policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications'
    ORDER BY cmd, policyname;
  `;
  console.log('Policies atuais em public.notifications:');
  policies.forEach(p => {
    console.log(`  [${p.cmd}] ${p.policyname}`);
    if (p.with_check) console.log(`    WITH CHECK: ${p.with_check}`);
  });
} catch (err) {
  console.error('\n✗ Erro aplicando migration:', err.message);
  process.exit(1);
} finally {
  await sqlClient.end();
}

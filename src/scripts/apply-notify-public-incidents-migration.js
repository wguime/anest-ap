#!/usr/bin/env node

/**
 * Aplica a migration do trigger que notifica responsáveis quando
 * incidentes/denúncias são inseridos (inclui formulários públicos).
 *
 * Uso:
 *   node src/scripts/apply-notify-public-incidents-migration.js              # dry-run
 *   EXECUTE=1 node src/scripts/apply-notify-public-incidents-migration.js    # aplica
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

const sqlPath = resolve(projectRoot, 'supabase/migrations/20260422213000_notify_public_incidents.sql');
const sql = readFileSync(sqlPath, 'utf8');

console.log(`=== Trigger formulários públicos ${DRY_RUN ? '(DRY-RUN)' : '(EXECUTANDO)'} ===\n`);
console.log('Migration:', sqlPath);
console.log(`Tamanho: ${sql.length} bytes\n`);

if (DRY_RUN) {
  console.log('---- SQL preview (primeiras 800 chars) ----');
  console.log(sql.slice(0, 800) + '...\n');
  console.log('[DRY-RUN] Rode com EXECUTE=1 para aplicar via Supabase SQL Editor ou pooler.');
  process.exit(0);
}

// Execução: requer postgres lib. Como não está disponível como dep
// runtime, o caminho canônico é colar o SQL no Supabase SQL Editor.
// Este script apenas mostra conteúdo + valida que a migration existe.
console.log('Para aplicar:');
console.log('1. Abra https://supabase.com/dashboard/project/vjzrahruvjffyyqyhjny/sql/new');
console.log('2. Cole o conteúdo do arquivo acima e clique "Run this query"');
console.log('3. Ao final, valide com a query:\n');
console.log(`   SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'tr_incidentes_notify_responsaveis';`);
console.log('   -- Deve retornar 1 linha com tgenabled = \'O\' (origin/enabled)\n');

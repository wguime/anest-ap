#!/usr/bin/env node

/**
 * Verifica as policies atuais em public.notifications após aplicar a
 * migration de tightening RLS.
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
if (!DB_PASSWORD) {
  console.error('ERRO: .env.local precisa ter SUPABASE_DB_PASSWORD');
  process.exit(1);
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
  const policies = await sqlClient`
    SELECT policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications'
    ORDER BY cmd, policyname;
  `;

  console.log(`Policies em public.notifications (${policies.length} total):\n`);
  policies.forEach((p, i) => {
    console.log(`  ${i + 1}. [${p.cmd}] "${p.policyname}"`);
    if (p.qual) console.log(`       USING: ${p.qual}`);
    if (p.with_check) console.log(`       WITH CHECK: ${p.with_check}`);
    console.log('');
  });

  // Sanity checks
  const insertPolicy = policies.find(p => p.cmd === 'INSERT');
  if (!insertPolicy) {
    console.error('⚠️  Nenhuma policy de INSERT encontrada!');
  } else if (insertPolicy.with_check === 'true') {
    console.error('⚠️  Policy INSERT ainda permissiva (WITH CHECK = true). Migration NÃO aplicada.');
  } else if (insertPolicy.with_check?.includes('firebase_uid') && insertPolicy.with_check?.includes('profiles')) {
    console.log('✓ Policy INSERT trancada: exige perfil ativo (firebase_uid + profiles).');
  } else {
    console.log('? Policy INSERT presente mas com condição diferente da esperada.');
  }
} catch (err) {
  console.error('Erro:', err.message);
  process.exit(1);
} finally {
  await sqlClient.end();
}

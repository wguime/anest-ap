#!/usr/bin/env node
/**
 * scripts/seed-all.mjs
 *
 * Sprint 21 Wave 2.1 — Orquestrador de seed (Supabase + Firebase) para DEV.
 *
 * Sequência:
 *   1. Aplica supabase/seed.sql via Supabase service_role REST RPC.
 *   2. Roda scripts/seed-firebase.mjs como subprocess.
 *   3. Imprime resumo final.
 *
 * Default = DRY-RUN. Use --apply para executar.
 *
 * Flags forwarded para o subscript Firebase:
 *   --apply       Executa mutações
 *   --reset       Reset antes (somente DEV — guardrail no subscript)
 *   --verbose     Log detalhado
 *
 * Pré-requisitos:
 *   - .env.local com VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_JWT_SECRET
 *   - GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase-anest-admin.json
 *
 * Uso:
 *   GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase-anest-admin.json \
 *     node scripts/seed-all.mjs              # dry-run (Supabase + Firebase)
 *   GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase-anest-admin.json \
 *     node scripts/seed-all.mjs --apply      # aplica de fato
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { SignJWT } from 'jose';

// ----------------------------------------------------------------------------
// CLI args
// ----------------------------------------------------------------------------
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const RESET = args.includes('--reset');
const VERBOSE = args.includes('--verbose');

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// ----------------------------------------------------------------------------
// Env
// ----------------------------------------------------------------------------
const envVars = {};
const envPath = resolve(projectRoot, '.env.local');
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^([^#=][^=]*)=(.*)$/);
    if (m) envVars[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  });
}

const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const JWT_SECRET = envVars.SUPABASE_JWT_SECRET;
const SUPABASE_REF = envVars.VITE_SUPABASE_PROJECT_REF || 'vjzrahruvjffyyqyhjny';

if (!SUPABASE_URL || !JWT_SECRET) {
  console.error('Faltam VITE_SUPABASE_URL / SUPABASE_JWT_SECRET em .env.local');
  process.exit(1);
}

// ----------------------------------------------------------------------------
// Logger
// ----------------------------------------------------------------------------
function log(msg) { console.log(msg); }

// ----------------------------------------------------------------------------
// Step 1 — Apply supabase/seed.sql
// ----------------------------------------------------------------------------
async function applySupabaseSeed() {
  log('\n━━━ STEP 1: Supabase seed.sql ━━━');

  const seedPath = resolve(projectRoot, 'supabase', 'seed.sql');
  if (!existsSync(seedPath)) {
    log(`seed.sql não encontrado em ${seedPath}`);
    return { applied: false, error: 'file_not_found' };
  }
  const sql = readFileSync(seedPath, 'utf8');
  log(`  seed.sql carregado: ${sql.length} bytes, ${sql.split('\n').length} linhas`);

  if (!APPLY) {
    log('  DRY-RUN: pulando aplicação. Use --apply para executar.');
    return { applied: false, dryRun: true };
  }

  // Assina JWT service_role
  const jwt = await new SignJWT({
    iss: 'supabase',
    ref: SUPABASE_REF,
    role: 'service_role',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .sign(new TextEncoder().encode(JWT_SECRET));

  // Aplica SQL via RPC `exec_sql` se existir, senão informa o user.
  // OBSERVAÇÃO: a maioria dos projetos Supabase NÃO expõe um `exec_sql` por
  // RLS-safety. O caminho canônico é `psql` ou `supabase db push`.
  // Aqui tentamos o RPC; se falhar, instruímos o user.
  const apiUrl = `${SUPABASE_URL}/rest/v1/rpc/exec_sql`;
  try {
    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
        apikey: jwt,
      },
      body: JSON.stringify({ sql }),
    });
    if (resp.ok) {
      log('  seed.sql aplicado via RPC exec_sql.');
      return { applied: true };
    }
    const body = await resp.text();
    log(`  RPC exec_sql não disponível (HTTP ${resp.status}). Body: ${body.slice(0, 200)}`);
    log('  Solução: aplicar manualmente:');
    log(`    psql "postgresql://postgres.${SUPABASE_REF}:<SENHA>@aws-0-us-west-2.pooler.supabase.com:5432/postgres" -f supabase/seed.sql`);
    log('  Ou via Supabase Dashboard → SQL Editor → cole o conteúdo de supabase/seed.sql.');
    return { applied: false, error: `http_${resp.status}` };
  } catch (err) {
    log(`  Erro de rede: ${err.message}`);
    log('  Aplique manualmente via psql ou Dashboard.');
    return { applied: false, error: err.message };
  }
}

// ----------------------------------------------------------------------------
// Step 2 — Run seed-firebase.mjs subprocess
// ----------------------------------------------------------------------------
function runFirebaseSeed() {
  log('\n━━━ STEP 2: Firebase seed (subprocess) ━━━');

  const scriptPath = resolve(__dirname, 'seed-firebase.mjs');
  if (!existsSync(scriptPath)) {
    log(`seed-firebase.mjs não encontrado em ${scriptPath}`);
    return { exitCode: -1, error: 'file_not_found' };
  }

  const subArgs = [];
  if (APPLY) subArgs.push('--apply');
  if (RESET) subArgs.push('--reset');
  if (VERBOSE) subArgs.push('--verbose');

  log(`  Executando: node ${scriptPath} ${subArgs.join(' ')}`);
  const result = spawnSync('node', [scriptPath, ...subArgs], {
    stdio: 'inherit',
    env: { ...process.env },
  });

  return { exitCode: result.status ?? -1 };
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------
async function main() {
  log('═══════════════════════════════════════════════════════════════════');
  log(`  ANEST Sprint 21 Wave 2.1 — Seed All (Supabase + Firebase)`);
  log(`  Mode: ${APPLY ? 'APPLY (mutate)' : 'DRY-RUN (read-only)'}`);
  log(`  Reset: ${RESET ? 'YES' : 'no'}    Verbose: ${VERBOSE}`);
  log(`  Supabase ref: ${SUPABASE_REF}`);
  log('═══════════════════════════════════════════════════════════════════');

  const startedAt = Date.now();

  const supabaseResult = await applySupabaseSeed();
  const firebaseResult = runFirebaseSeed();

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);

  log('\n═══════════════════════════════════════════════════════════════════');
  log(`  SUMMARY (${elapsedSec}s)`);
  log(`  supabase ${JSON.stringify(supabaseResult)}`);
  log(`  firebase exitCode=${firebaseResult.exitCode}`);
  log('═══════════════════════════════════════════════════════════════════');
  if (!APPLY) {
    log('\nDRY-RUN — rode com --apply para executar.');
  }

  process.exit(firebaseResult.exitCode === 0 ? 0 : firebaseResult.exitCode);
}

main().catch((err) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});

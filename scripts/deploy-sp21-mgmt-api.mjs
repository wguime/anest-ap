#!/usr/bin/env node
/**
 * Sprint 21 deploy helper — uses Supabase Management API + Personal Access Token
 * to apply migration + manage secrets without `supabase login`.
 *
 * Subcommands:
 *   test           - quick connectivity check (GET /v1/projects/<ref>)
 *   apply-migration <sql_file>
 *   list-buckets
 *   set-secret <name> <value>
 *   list-secrets   - prints names only, never values
 *   query <sql>    - run arbitrary SELECT, prints rows as JSON
 *
 * Env:
 *   SUPABASE_ACCESS_TOKEN  (sbp_...) — from .env.local
 *   VITE_SUPABASE_PROJECT_REF (default vjzrahruvjffyyqyhjny)
 *
 * Safety: refuses to print SUPABASE_ACCESS_TOKEN or secret values.
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const env = {};
const envPath = resolve(projectRoot, '.env.local');
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^([^#=][^=]*)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  });
}

const PAT = process.env.SUPABASE_ACCESS_TOKEN || env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.VITE_SUPABASE_PROJECT_REF || env.VITE_SUPABASE_PROJECT_REF || 'vjzrahruvjffyyqyhjny';

if (!PAT) {
  console.error('❌ Missing SUPABASE_ACCESS_TOKEN in .env.local or process env');
  process.exit(1);
}

const MGMT = 'https://api.supabase.com';

async function call(method, path, body) {
  const r = await fetch(`${MGMT}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${PAT}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return { ok: r.ok, status: r.status, body: parsed };
}

const cmd = process.argv[2];

if (cmd === 'test') {
  const r = await call('GET', `/v1/projects/${REF}`);
  if (r.ok) {
    console.log(`✅ Connected. Project ${REF}: name="${r.body?.name || '?'}", region=${r.body?.region || '?'}, status=${r.body?.status || '?'}`);
    process.exit(0);
  } else {
    console.error(`❌ ${r.status} — ${JSON.stringify(r.body).slice(0, 200)}`);
    process.exit(1);
  }
}

if (cmd === 'apply-migration') {
  const file = process.argv[3];
  if (!file) {
    console.error('Usage: apply-migration <sql_file>');
    process.exit(1);
  }
  const sql = readFileSync(file, 'utf8');
  console.log(`Applying ${file} (${sql.length} chars) to project ${REF}...`);
  const r = await call('POST', `/v1/projects/${REF}/database/query`, { query: sql });
  if (r.ok) {
    console.log('✅ Migration applied successfully.');
    if (Array.isArray(r.body)) console.log(`   ${r.body.length} result row(s).`);
    process.exit(0);
  } else {
    console.error(`❌ ${r.status}`);
    console.error(JSON.stringify(r.body, null, 2));
    process.exit(1);
  }
}

if (cmd === 'list-buckets') {
  // Management API doesn't expose buckets directly; query via SQL.
  const r = await call('POST', `/v1/projects/${REF}/database/query`, {
    query: "select id, name, public, file_size_limit, created_at from storage.buckets order by created_at",
  });
  if (r.ok) {
    console.log('Buckets:');
    if (Array.isArray(r.body)) {
      r.body.forEach((b) => console.log(`  - ${b.id} (public=${b.public}, size_limit=${b.file_size_limit})`));
    } else {
      console.log(JSON.stringify(r.body, null, 2));
    }
    process.exit(0);
  } else {
    console.error(`❌ ${r.status} — ${JSON.stringify(r.body)}`);
    process.exit(1);
  }
}

if (cmd === 'set-secret') {
  const name = process.argv[3];
  const value = process.argv[4];
  if (!name || !value) {
    console.error('Usage: set-secret <NAME> <value>');
    process.exit(1);
  }
  const r = await call('POST', `/v1/projects/${REF}/secrets`, [{ name, value }]);
  if (r.ok || r.status === 201) {
    console.log(`✅ Secret ${name} set.`);
    process.exit(0);
  } else {
    console.error(`❌ ${r.status} — ${JSON.stringify(r.body)}`);
    process.exit(1);
  }
}

if (cmd === 'set-secret-file') {
  const name = process.argv[3];
  const file = process.argv[4];
  if (!name || !file) {
    console.error('Usage: set-secret-file <NAME> <file_path>');
    process.exit(1);
  }
  if (!existsSync(file)) {
    console.error(`❌ File not found: ${file}`);
    process.exit(1);
  }
  const value = readFileSync(file, 'utf8');
  console.log(`Setting secret ${name} from file ${file} (${value.length} chars)...`);
  const r = await call('POST', `/v1/projects/${REF}/secrets`, [{ name, value }]);
  if (r.ok || r.status === 201) {
    console.log(`✅ Secret ${name} set.`);
    process.exit(0);
  } else {
    console.error(`❌ ${r.status} — ${JSON.stringify(r.body)}`);
    process.exit(1);
  }
}

if (cmd === 'list-secrets') {
  const r = await call('GET', `/v1/projects/${REF}/secrets`);
  if (r.ok && Array.isArray(r.body)) {
    console.log('Secrets (names only):');
    r.body.forEach((s) => console.log(`  - ${s.name}`));
    process.exit(0);
  } else {
    console.error(`❌ ${r.status} — ${JSON.stringify(r.body)}`);
    process.exit(1);
  }
}

if (cmd === 'query') {
  const q = process.argv.slice(3).join(' ');
  if (!q) { console.error('Usage: query <SQL>'); process.exit(1); }
  const r = await call('POST', `/v1/projects/${REF}/database/query`, { query: q });
  if (r.ok) {
    console.log(JSON.stringify(r.body, null, 2));
    process.exit(0);
  } else {
    console.error(`❌ ${r.status} — ${JSON.stringify(r.body)}`);
    process.exit(1);
  }
}

console.error(`Unknown command: ${cmd}`);
console.error('Use: test | apply-migration <file> | list-buckets | set-secret <NAME> <value> | list-secrets | query <sql>');
process.exit(1);

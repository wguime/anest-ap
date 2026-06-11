#!/usr/bin/env node
/**
 * Seta verify_jwt de Edge Functions via Management API (sem redeploy de código).
 * Uso: node scripts/set-edge-verify-jwt.mjs <true|false> <slug> [slug2 ...]
 *
 * Env (mesmo padrão de deploy-sp21-mgmt-api.mjs): SUPABASE_ACCESS_TOKEN de .env.local.
 * Nunca imprime tokens.
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
if (!PAT) { console.error('❌ Missing SUPABASE_ACCESS_TOKEN'); process.exit(1); }

const value = process.argv[2];
const slugs = process.argv.slice(3);
if (!['true', 'false'].includes(value) || slugs.length === 0) {
  console.error('Usage: set-edge-verify-jwt.mjs <true|false> <slug> [slug2 ...]');
  process.exit(1);
}

let fail = 0;
for (const slug of slugs) {
  const r = await fetch(
    `https://api.supabase.com/v1/projects/${REF}/functions/${slug}?verify_jwt=${value}`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ verify_jwt: value === 'true' }),
    },
  );
  const body = await r.json().catch(() => null);
  if (r.ok && body) {
    console.log(`✅ ${slug}: verify_jwt=${body.verify_jwt}`);
  } else {
    console.error(`❌ ${slug}: ${r.status} ${JSON.stringify(body).slice(0, 150)}`);
    fail++;
  }
}
process.exit(fail === 0 ? 0 : 1);

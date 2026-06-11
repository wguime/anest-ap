#!/usr/bin/env node
/**
 * Diagnóstico: lista config das Edge Functions via Management API.
 * Imprime slug, verify_jwt, status e updated_at — NUNCA imprime tokens/secrets.
 *
 * Env (mesmo padrão de deploy-sp21-mgmt-api.mjs):
 *   SUPABASE_ACCESS_TOKEN (sbp_...) — de .env.local
 *   VITE_SUPABASE_PROJECT_REF (default vjzrahruvjffyyqyhjny)
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

const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/functions`, {
  headers: { Authorization: `Bearer ${PAT}` },
});
const fns = await r.json();
if (!Array.isArray(fns)) {
  console.error(`❌ ${r.status} — ${JSON.stringify(fns).slice(0, 200)}`);
  process.exit(1);
}

const onlySlug = process.argv[2];
for (const f of fns) {
  if (onlySlug && f.slug !== onlySlug) continue;
  console.log(
    `${f.slug.padEnd(28)} verify_jwt=${String(f.verify_jwt).padEnd(5)} status=${f.status} updated=${new Date(f.updated_at).toISOString()}`
  );
}

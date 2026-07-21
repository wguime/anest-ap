#!/usr/bin/env node
/**
 * query-ro.mjs — SELECT-only wrapper do endpoint Management API /database/query.
 *
 * Por quê: `deploy-sp21-mgmt-api.mjs query` aceita QUALQUER SQL (mesmo endpoint
 * do apply-migration). Os modos de leitura da skill /escala-cirurgica usam este
 * wrapper para que um erro de digitação nunca vire escrita no banco de produção.
 * É um cinto de segurança contra acidente (não contra adversário): valida que o
 * statement começa com SELECT/WITH e que não há multi-statement via ';'.
 *
 * Uso: node .claude/skills/escala-cirurgica/scripts/query-ro.mjs "select ..."
 * Env: SUPABASE_ACCESS_TOKEN via .env.local (mesmo padrão do deploy-sp21-mgmt-api.mjs;
 *      nunca impresso).
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..', '..', '..', '..');
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

let sql = process.argv.slice(2).join(' ').trim();
if (!sql) {
  console.error('Uso: query-ro.mjs "select ..."');
  process.exit(1);
}
sql = sql.replace(/;\s*$/, '');

if (!/^\s*(select|with)\b/i.test(sql)) {
  console.error('❌ query-ro: só SELECT/WITH. Para escrita use deploy-sp21-mgmt-api.mjs conscientemente.');
  process.exit(2);
}
if (sql.includes(';')) {
  console.error('❌ query-ro: multi-statement (";") não permitido.');
  process.exit(2);
}

const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
});
const text = await r.text();
if (!r.ok) {
  console.error(`❌ HTTP ${r.status}: ${text.slice(0, 500)}`);
  process.exit(1);
}
try {
  console.log(JSON.stringify(JSON.parse(text), null, 2));
} catch {
  console.log(text);
}

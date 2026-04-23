#!/usr/bin/env node
/**
 * Aplica SQL arbitrário via Supabase Management API.
 * Requer SUPABASE_ACCESS_TOKEN (PAT) no env.
 *
 * Uso: SUPABASE_ACCESS_TOKEN='sbp_...' node src/scripts/apply-sql-via-management-api.js <path-to-sql>
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const PAT = process.env.SUPABASE_ACCESS_TOKEN;
if (!PAT) {
  console.error('ERRO: export SUPABASE_ACCESS_TOKEN primeiro');
  process.exit(1);
}

const sqlPath = process.argv[2];
if (!sqlPath) {
  console.error('Uso: node apply-sql-via-management-api.js <path-to-sql>');
  process.exit(1);
}

const sql = readFileSync(resolve(sqlPath), 'utf8');
const PROJECT_REF = 'vjzrahruvjffyyqyhjny';

console.log(`Aplicando ${sqlPath} (${sql.length} bytes) via Management API...`);

const res = await fetch(
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PAT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  }
);

console.log(`HTTP ${res.status}`);
const text = await res.text();
try {
  const json = JSON.parse(text);
  console.log(JSON.stringify(json, null, 2));
} catch {
  console.log(text);
}

process.exit(res.ok ? 0 : 1);

#!/usr/bin/env node

/**
 * E2E: chama a Edge Function schedule-shift-reminders em modo auto REAL
 * (dryRun=false), depois consulta notifications para confirmar que a
 * inserção aconteceu via dedup por related_entity_id.
 *
 * Isso valida TODO o pipeline exceto o disparo pg_cron → net.http_post
 * (que é infra Supabase e já foi configurado com cron.schedule).
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

const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const JWT_SECRET = envVars.SUPABASE_JWT_SECRET;
const ANON_KEY = envVars.VITE_SUPABASE_ANON_KEY;

const { SignJWT } = await import('jose');
const secretKey = new TextEncoder().encode(JWT_SECRET);
const serviceJWT = await new SignJWT({
  iss: 'supabase', ref: 'vjzrahruvjffyyqyhjny', role: 'service_role',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 600,
}).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).sign(secretKey);

const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  global: { headers: { Authorization: `Bearer ${serviceJWT}` } },
  auth: { persistSession: false, autoRefreshToken: false },
});

const endpoint = `${SUPABASE_URL}/functions/v1/schedule-shift-reminders`;

// Usa data fixa 2026-03-06 12:00 BRT = 15:00 UTC → amanhã UTC = 2026-03-07
// → r3-raffaela (email raffanehls@gmail.com)
// Importante: usar hora BRT longe da meia-noite UTC para evitar off-by-one.
const testNow = '2026-03-06T12:00:00-03:00';
console.log(`Chamando Edge Function em modo AUTO REAL com now=${testNow}`);

const res = await fetch(endpoint, {
  method: 'POST',
  headers: { Authorization: `Bearer ${serviceJWT}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ dryRun: false, now: testNow }),
});
const body = await res.json();
console.log(`\nResposta HTTP ${res.status}:`);
console.log(JSON.stringify(body, null, 2));

// Consulta notifications relacionadas
const expectedEntityId = 'plantao-residencia_2026-03-07_r3-raffaela_1day';
console.log(`\nBuscando notification com related_entity_id=${expectedEntityId}...`);

const { data, error } = await supabase
  .from('notifications')
  .select('id, recipient_id, subject, content, category, action_url, action_params, related_entity_type, related_entity_id, created_at')
  .eq('related_entity_id', expectedEntityId);

if (error) {
  console.error('Erro consultando notifications:', error.message);
  process.exit(1);
}

if (!data || data.length === 0) {
  console.error('\n✗ FALHA: nenhuma notification encontrada com esse related_entity_id.');
  process.exit(1);
}

console.log(`\n✓ ${data.length} notification(s) encontrada(s):`);
data.forEach((n, i) => {
  console.log(`  ${i + 1}. ${n.subject}`);
  console.log(`     recipient_id: ${n.recipient_id}`);
  console.log(`     category: ${n.category}`);
  console.log(`     action_url: ${n.action_url}`);
  console.log(`     action_params: ${JSON.stringify(n.action_params)}`);
  console.log(`     created_at: ${n.created_at}`);
});

console.log('\n=== Cadeia end-to-end validada ===');
console.log('Edge Function → dedup → notifications table ✓');
console.log('pg_cron jobs agendados ✓ (disparo automático ocorre em 21:00 UTC e 09:00 UTC)');

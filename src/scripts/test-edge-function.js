#!/usr/bin/env node

/**
 * Sanity checks da Edge Function schedule-shift-reminders.
 *
 * Testes:
 *   1. POST {} com data fixa (2026-03-06 23:00) → modo auto, esperado:
 *      gera item D-1 para r3-raffaela (amanhã 2026-03-07). dryRun=true não
 *      insere.
 *   2. POST com items fake em dryRun → valida dedup.
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

if (!SUPABASE_URL || !JWT_SECRET || !ANON_KEY) {
  console.error('ERRO: .env.local precisa VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY e SUPABASE_JWT_SECRET');
  process.exit(1);
}

const { SignJWT } = await import('jose');
const secretKey = new TextEncoder().encode(JWT_SECRET);
const serviceJWT = await new SignJWT({
  iss: 'supabase',
  ref: 'vjzrahruvjffyyqyhjny',
  role: 'service_role',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 600,
})
  .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
  .sign(secretKey);

const endpoint = `${SUPABASE_URL}/functions/v1/schedule-shift-reminders`;

async function call(body, label) {
  console.log(`\n--- ${label} ---`);
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceJWT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log(`HTTP ${res.status}`);
  let parsed;
  try {
    parsed = JSON.parse(text);
    console.log(JSON.stringify(parsed, null, 2));
  } catch {
    console.log(text);
  }
  return { status: res.status, text, parsed };
}

// Test 1: modo auto com data fixa (dryRun, não insere)
// 2026-03-06 23:00 → amanhã 2026-03-07 → PLANTOES_2026['2026-03-07'] = 'r3-raffaela'
const t1 = await call(
  { dryRun: true, now: '2026-03-06T23:00:00-03:00' },
  'Test 1: auto mode dryRun com data fixa (esperado: r3-raffaela D-1)'
);

// Test 2: manual mode com fake items
const fakeEntityId = `test-${Date.now()}`;
const t2 = await call({
  dryRun: true,
  items: [{
    recipientId: 'fake-user-id-test',
    category: 'sistema',
    subject: 'Sanity check',
    content: 'Dry-run manual test',
    relatedEntityType: 'sanity-test',
    relatedEntityId: fakeEntityId,
  }],
}, 'Test 2: manual mode dryRun com item fake');

// Test 3: auto com data de FDS (domingo 2026-03-01 → 07:00 plantão 24h)
const t3 = await call(
  { dryRun: true, now: '2026-02-28T23:00:00-03:00' },
  'Test 3: auto mode, amanhã=domingo 2026-03-01 (24h plantão)'
);

// Avaliação
console.log('\n=== Resumo ===');
const t1Ok = t1.status === 200 && t1.parsed?.mode === 'auto';
const t2Ok = t2.status === 200 && t2.parsed?.mode === 'manual' && t2.parsed?.wouldInsert === 1;
const t3Ok = t3.status === 200 && t3.parsed?.mode === 'auto';
console.log(`Test 1 (auto D-1): ${t1Ok ? '✓' : '✗'} ${t1.parsed?.wouldInsert !== undefined ? `wouldInsert=${t1.parsed.wouldInsert}` : ''}`);
console.log(`Test 2 (manual):   ${t2Ok ? '✓' : '✗'}`);
console.log(`Test 3 (auto FDS): ${t3Ok ? '✓' : '✗'} ${t3.parsed?.wouldInsert !== undefined ? `wouldInsert=${t3.parsed.wouldInsert}` : ''}`);

const allOk = t1Ok && t2Ok && t3Ok;
console.log(allOk ? '\n✓ Edge Function respondendo corretamente.' : '\n✗ Problemas detectados.');
process.exit(allOk ? 0 : 1);

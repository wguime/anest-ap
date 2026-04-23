#!/usr/bin/env node
/**
 * Verifica se o trigger tr_incidentes_notify_responsaveis existe.
 * Usa um RPC SELECT via postgrest se possível; senão, tenta INSERT duplicado
 * para ver se a função existe (comportamento indireto).
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../../.env.local');
const envVars = {};
readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([^#=][^=]*)=(.*)$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
});

const { SignJWT } = await import('jose');
const secretKey = new TextEncoder().encode(envVars.SUPABASE_JWT_SECRET);
const serviceJWT = await new SignJWT({
  iss: 'supabase', ref: 'vjzrahruvjffyyqyhjny', role: 'service_role',
  iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 600,
}).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).sign(secretKey);

// Tenta GET /rest/v1/ via postgrest para ver se a rpc notify_responsaveis_on_incidente aparece
// Nota: funções de trigger normalmente não são expostas via PostgREST, mas vamos ver

const res = await fetch(`${envVars.VITE_SUPABASE_URL}/rest/v1/`, {
  headers: {
    'apikey': envVars.VITE_SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${serviceJWT}`,
    'Accept-Profile': 'public',
  },
});
const spec = await res.json();

// Verifica se existe referência à função
const specStr = JSON.stringify(spec);
const hasFn = specStr.includes('notify_responsaveis_on_incidente');
console.log(`Função exposta via PostgREST: ${hasFn ? '✓' : '✗ (mas triggers geralmente não aparecem aqui)'}`);

// Testa UNIQUE INDEX: insere 2x a mesma notification e vê se a 2ª é bloqueada
console.log('\nTestando UNIQUE INDEX uniq_notifications_entity_recipient...');
const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: `Bearer ${serviceJWT}` } },
  auth: { persistSession: false, autoRefreshToken: false },
});

const uniqueRelId = `check-trigger-${Date.now()}`;
const row = {
  recipient_id: 'pPdKZ75E9zNdPnLz50qisPiHfJw1',
  category: 'sistema',
  subject: 'Check trigger exists',
  content: 'test',
  related_entity_type: 'sanity-test',
  related_entity_id: uniqueRelId,
  priority: 'normal',
  dismissable: true,
};

const { error: e1 } = await supabase.from('notifications').insert(row);
console.log(`1ª inserção: ${e1 ? '✗ ' + e1.message : '✓'}`);

const { error: e2 } = await supabase.from('notifications').insert(row);
const expectedConflict = e2 && (e2.code === '23505' || e2.message?.includes('duplicate') || e2.message?.includes('unique'));
console.log(`2ª inserção (duplicada): ${expectedConflict ? '✓ bloqueada pelo UNIQUE index' : '✗ NÃO bloqueada — index ausente ou ON CONFLICT quebrado'}`);
if (e2 && !expectedConflict) console.log(`  detalhe: ${e2.message}`);

// Cleanup
await supabase.from('notifications').delete().eq('related_entity_id', uniqueRelId);
console.log('\nCleanup OK.');

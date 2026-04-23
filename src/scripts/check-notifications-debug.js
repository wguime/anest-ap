#!/usr/bin/env node
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
const { SignJWT } = await import('jose');
const secretKey = new TextEncoder().encode(envVars.SUPABASE_JWT_SECRET);
const serviceJWT = await new SignJWT({
  iss: 'supabase', ref: 'vjzrahruvjffyyqyhjny', role: 'service_role',
  iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 600,
}).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).sign(secretKey);

const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: `Bearer ${serviceJWT}` } },
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await supabase
  .from('notifications')
  .select('id, recipient_id, subject, related_entity_type, related_entity_id, created_at')
  .eq('related_entity_type', 'plantao-residencia')
  .order('created_at', { ascending: false })
  .limit(10);
console.log('Error:', error);
console.log('Total rows:', data?.length || 0);
(data || []).forEach((r, i) =>
  console.log(`  ${i + 1}. ${r.related_entity_id} | recipient=${r.recipient_id.substring(0,8)}... | ${r.created_at}`)
);

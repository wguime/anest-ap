// Diagnostic-only: inspect Erlei records in profiles + authorized_emails.
// Read-only. No mutations. Safe to run anytime.
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SignJWT } from 'jose';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const envVars = {};
const envPath = resolve(projectRoot, '.env.local');
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^([^#=][^=]*)=(.*)$/);
    if (m) envVars[m[1].trim()] = m[2].trim();
  });
}

const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = envVars.VITE_SUPABASE_ANON_KEY;
const JWT_SECRET = envVars.SUPABASE_JWT_SECRET;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !JWT_SECRET) {
  console.error('ERR: missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / SUPABASE_JWT_SECRET in .env.local');
  process.exit(1);
}

const jwt = await new SignJWT({
  iss: 'supabase',
  ref: 'vjzrahruvjffyyqyhjny',
  role: 'service_role',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
})
  .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
  .sign(new TextEncoder().encode(JWT_SECRET));

const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${jwt}` } },
});

const EMAIL = 'erlei@clinicacastelo.com.br';

console.log('═══ profiles WHERE email = ', EMAIL, '═══');
{
  const { data, error } = await supa.from('profiles').select('*').eq('email', EMAIL);
  if (error) console.error('ERR', error);
  else console.log(JSON.stringify(data, null, 2));
}

console.log('\n═══ profiles WHERE nome ILIKE %Erlei%  ═══');
{
  const { data, error } = await supa.from('profiles').select('id, nome, email, role, active, is_admin, custom_permissions, last_access, access_count, created_at, updated_at').ilike('nome', '%Erlei%');
  if (error) console.error('ERR', error);
  else console.log(JSON.stringify(data, null, 2));
}

console.log('\n═══ authorized_emails WHERE email = ', EMAIL, '═══');
{
  const { data, error } = await supa.from('authorized_emails').select('*').eq('email', EMAIL);
  if (error) console.error('ERR', error);
  else console.log(JSON.stringify(data, null, 2));
}

// Does the role column exist on authorized_emails?
console.log('\n═══ Does authorized_emails.role column exist? (probe via .select(role)) ═══');
{
  const { data, error } = await supa.from('authorized_emails').select('role').limit(1);
  if (error) console.error('PROBE ERR:', error.message, error.code, error.hint || '');
  else console.log('Column exists. Sample:', JSON.stringify(data));
}

// Test an UPDATE to see RLS / column status
console.log('\n═══ Probe UPDATE authorized_emails SET role = role WHERE email = X (dry-run via .select() only) ═══');
{
  const { data, error } = await supa
    .from('authorized_emails')
    .update({ role: 'anestesiologista' })
    .eq('email', '__nonexistent__@example.test')
    .select();
  if (error) console.error('UPDATE PROBE ERR:', error.message, error.code, error.hint || '');
  else console.log('UPDATE probe (no row matched, as expected):', JSON.stringify(data));
}

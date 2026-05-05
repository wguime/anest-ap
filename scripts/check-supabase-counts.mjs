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
  readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#=][^=]*)=(.*)$/);
    if (m) envVars[m[1].trim()] = m[2].trim();
  });
}

const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = envVars.VITE_SUPABASE_ANON_KEY;
const JWT_SECRET = envVars.SUPABASE_JWT_SECRET;

const jwt = await new SignJWT({
  iss: 'supabase', ref: 'vjzrahruvjffyyqyhjny',
  role: 'service_role',
  iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+3600,
}).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).sign(new TextEncoder().encode(JWT_SECRET));

const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${jwt}` } },
});

const { data, error } = await supa
  .from('documentos')
  .select('categoria, subcategoria', { count: 'exact' });

if (error) { console.error('ERR', error); process.exit(1); }

const byCat = {};
const bySub = {};
for (const r of data) {
  byCat[r.categoria] = (byCat[r.categoria]||0)+1;
  const k = `${r.categoria}/${r.subcategoria||'-'}`;
  bySub[k] = (bySub[k]||0)+1;
}
console.log('TOTAL:', data.length);
console.log('\nBY CATEGORIA:');
for (const [k,v] of Object.entries(byCat).sort()) console.log(`  ${k}: ${v}`);
console.log('\nBY CAT/SUB (etica + relatorios):');
for (const [k,v] of Object.entries(bySub).sort()) {
  if (k.startsWith('etica/') || k.startsWith('relatorios/')) console.log(`  ${k}: ${v}`);
}

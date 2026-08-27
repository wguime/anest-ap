/**
 * Read-only: confere o estado final da consolidação da conta do Oscar Morais
 * (scripts/fix-oscar-morais-conta.mjs). Cada linha é um invariante; sai com
 * código 1 se algum falhar.
 *
 * Uso: node scripts/verify-oscar-morais-conta.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { SignJWT } from 'jose';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const PROJECT_ID = 'anest-ap';

const NEW_UID = 'qasYnJpQ01QrVjRO7Og5rBNRlVu2';
const NEW_EMAIL = 'oscarmorais3@hotmail.com';
const OLD_UID = '0PIwC4DeeMggzMK2JTqW0nmEYHj1';
const OLD_EMAIL = 'oscarmorais@hotmail.com';
const ROLE = 'anestesiologista';

const envVars = {};
const envPath = resolve(projectRoot, '.env.local');
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^([^#=][^=]*)=(.*)$/);
    if (m) envVars[m[1].trim()] = m[2].trim();
  });
}

const svcJwt = await new SignJWT({
  iss: 'supabase', ref: 'vjzrahruvjffyyqyhjny', role: 'service_role',
  iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600,
}).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).sign(new TextEncoder().encode(envVars.SUPABASE_JWT_SECRET));

// JWT no formato da edge `get-supabase-token`, para testar a RLS como o Oscar.
const oscarJwt = await new SignJWT({
  sub: NEW_UID, role: 'authenticated', aud: 'authenticated', iss: 'supabase',
  iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600,
}).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).sign(new TextEncoder().encode(envVars.SUPABASE_JWT_SECRET));

const mk = (bearer) => createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${bearer}` } },
});
const supa = mk(svcJwt);
const comoOscar = mk(oscarJwt);

// Firestore via token da CLI do firebase (consumido, nunca impresso).
const store = resolve(homedir(), '.config/configstore/firebase-tools.json');
const refreshToken = JSON.parse(readFileSync(store, 'utf8'))?.tokens?.refresh_token;
const tok = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  }),
}).then((r) => r.json());
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const fsGet = async (path) => {
  const r = await fetch(`${FS}/${path}`, { headers: { Authorization: `Bearer ${tok.access_token}` } });
  return r.status === 404 ? null : r.json();
};

let falhas = 0;
const check = (ok, label, detalhe = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detalhe ? ` — ${detalhe}` : ''}`);
  if (!ok) falhas += 1;
};

console.log('\n═══ Conta NOVA (a que fica) ═══');
{
  const fs = await fsGet(`userProfiles/${NEW_UID}`);
  const role = fs?.fields?.role?.stringValue;
  check(role === ROLE, `Firestore userProfiles.role = '${ROLE}'`, `lido: '${role}'`);
  check(fs?.fields?.customPermissions?.booleanValue === false, 'Firestore customPermissions = false (reconciliação vira no-op)');
  check(fs?.fields?.rankingOptIn?.booleanValue === false, 'Firestore rankingOptIn = false (reconciliação vira no-op)');

  const { data: p } = await supa.from('profiles').select('role, email, active').eq('id', NEW_UID).maybeSingle();
  check(p?.role === ROLE, `Supabase profiles.role = '${ROLE}'`, `lido: '${p?.role}'`);
  check(p?.email === NEW_EMAIL, `Supabase profiles.email = ${NEW_EMAIL}`);
  check(p?.active === true, 'Supabase profiles.active = true');

  const { data: gate } = await comoOscar.rpc('can_write_escala_cirurgica');
  check(gate === true, 'RLS can_write_escala_cirurgica() com o JWT dele = true');

  const { data: escalas, error: escErr } = await comoOscar.from('escala_cirurgica').select('id').limit(1);
  check(!escErr && (escalas?.length ?? 0) > 0, 'SELECT em escala_cirurgica com o JWT dele devolve linha');

  const { data: alias } = await supa.from('escala_anestesista_alias').select('apelido').eq('user_id', NEW_UID);
  const apelidos = (alias || []).map((a) => a.apelido).sort();
  check(apelidos.includes('OSCAR') && apelidos.includes('OSCAR MORAIS'), 'apelidos da escala apontam para o UID novo', apelidos.join(', ') || 'nenhum');

  const { data: ae } = await supa.from('authorized_emails').select('email, role').eq('email', NEW_EMAIL).maybeSingle();
  check(!!ae, `authorized_emails mantém ${NEW_EMAIL}`, ae ? `role='${ae.role}'` : 'ausente');
}

console.log('\n═══ Conta ANTIGA (a que sai) ═══');
{
  const { data: p } = await supa.from('profiles').select('id').eq('id', OLD_UID).maybeSingle();
  check(!p, 'Supabase profiles do UID antigo removido');

  const { data: ae } = await supa.from('authorized_emails').select('email').eq('email', OLD_EMAIL).maybeSingle();
  check(!ae, `authorized_emails sem ${OLD_EMAIL}`);

  const { count: nAlias } = await supa.from('escala_anestesista_alias').select('*', { count: 'exact', head: true }).eq('user_id', OLD_UID);
  check(nAlias === 0, 'nenhum apelido órfão no UID antigo', `${nAlias}`);

  const { count: nNotif } = await supa.from('notifications').select('*', { count: 'exact', head: true }).eq('recipient_id', OLD_UID);
  check(nNotif === 0, 'notificações do UID antigo removidas', `${nNotif}`);

  check(!(await fsGet(`userProfiles/${OLD_UID}`)), 'Firestore userProfiles do UID antigo removido');
  check(!(await fsGet(`users/${OLD_UID}`)), 'Firestore users do UID antigo removido');

  const { count: nAudit } = await supa.from('permission_audit_log').select('*', { count: 'exact', head: true }).eq('target_user_id', OLD_UID);
  check(nAudit > 0, 'trilha de auditoria do UID antigo PRESERVADA (nunca apagar)', `${nAudit} entrada(s)`);
}

console.log(`\n${falhas ? `❌ ${falhas} verificação(ões) falharam` : '✅ tudo verde'}\n`);
process.exit(falhas ? 1 : 0);

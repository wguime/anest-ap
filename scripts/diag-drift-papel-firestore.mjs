/**
 * Read-only: mede quantas pessoas estão com o MESMO defeito do Oscar Morais —
 * papel certo no Supabase e `colaborador` (ou outro papel divergente) no
 * Firestore, que é o que `podeVerEscalaCirurgica`/`useCardPermissions` leem.
 *
 * Origem do defeito: o perfil do Firestore nasce no cliente (UserContext) com o
 * molde sem privilégio; a reconciliação Supabase→Firestore não consegue gravar
 * `role` porque `firestore.rules` proíbe o próprio usuário de tocar em campo de
 * privilégio. Quem foi criado pelo Centro de Gestão não passa por isso.
 *
 * Uso: node scripts/diag-drift-papel-firestore.mjs
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

const envVars = {};
const envPath = resolve(projectRoot, '.env.local');
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^([^#=][^=]*)=(.*)$/);
    if (m) envVars[m[1].trim()] = m[2].trim();
  });
}

const jwt = await new SignJWT({
  iss: 'supabase', ref: 'vjzrahruvjffyyqyhjny', role: 'service_role',
  iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600,
}).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).sign(new TextEncoder().encode(envVars.SUPABASE_JWT_SECRET));

const supa = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${jwt}` } },
});

const FIREBASE_CLI_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLI_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

const store = resolve(homedir(), '.config/configstore/firebase-tools.json');
const refreshToken = JSON.parse(readFileSync(store, 'utf8'))?.tokens?.refresh_token;
const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: FIREBASE_CLI_CLIENT_ID,
    client_secret: FIREBASE_CLI_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  }),
}).then((r) => r.json());
const token = tokenRes.access_token;
if (!token) { console.error('OAuth falhou:', tokenRes.error_description || tokenRes.error); process.exit(1); }

const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// Lê userProfiles inteiro (coleção pequena) paginando.
const fsProfiles = new Map();
let pageToken = '';
do {
  const url = `${FS_BASE}/userProfiles?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
  const page = await fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
  for (const d of page.documents || []) {
    const id = d.name.split('/').pop();
    fsProfiles.set(id, {
      role: d.fields?.role?.stringValue ?? null,
      isAdmin: d.fields?.isAdmin?.booleanValue ?? null,
      customPermissions: d.fields?.customPermissions?.booleanValue ?? null,
    });
  }
  pageToken = page.nextPageToken || '';
} while (pageToken);

const { data: sbProfiles, error } = await supa
  .from('profiles')
  .select('id, nome, email, role, is_admin, custom_permissions, last_access, access_count')
  .order('created_at', { ascending: true });
if (error) { console.error(error); process.exit(1); }

console.log(`Firestore userProfiles: ${fsProfiles.size} | Supabase profiles: ${sbProfiles.length}\n`);

const PAPEIS_ESCALA = ['anestesiologista', 'medico-residente', 'tec-enfermagem', 'secretaria'];

const drift = [];
const semFirestore = [];
for (const p of sbProfiles) {
  const fs = fsProfiles.get(p.id);
  if (!fs) { semFirestore.push(p); continue; }
  if ((fs.role || null) !== (p.role || null)) drift.push({ p, fs });
}

console.log('═══ Papel divergente (Supabase ≠ Firestore) ═══');
if (!drift.length) console.log('  (nenhum)');
for (const { p, fs } of drift) {
  const perdeEscala = PAPEIS_ESCALA.includes(String(p.role || '').toLowerCase())
    && !PAPEIS_ESCALA.includes(String(fs.role || '').toLowerCase())
    && !fs.isAdmin;
  console.log(`  ${perdeEscala ? '⚠️ ' : '   '}${(p.nome || '(sem nome)').padEnd(32)} ${String(p.email).padEnd(34)} supabase='${p.role}' firestore='${fs.role}' acessos=${p.access_count}${perdeEscala ? '  ← SEM Escala Cirúrgica' : ''}`);
}

console.log('\n═══ Sem doc no Firestore (nunca logou) ═══');
if (!semFirestore.length) console.log('  (nenhum)');
for (const p of semFirestore) {
  console.log(`  ${(p.nome || '(sem nome)').padEnd(32)} ${String(p.email).padEnd(34)} role='${p.role}' acessos=${p.access_count}`);
}

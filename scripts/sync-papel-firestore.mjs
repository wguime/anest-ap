/**
 * Persiste no Firestore os campos de privilégio que o app já trata como verdade
 * vindos do Supabase — papel, flags de admin e permissões.
 *
 * ── Por que existe ──────────────────────────────────────────────────────────
 * `reconcileFromSupabase` (src/contexts/UserContext.jsx) lê o perfil do Supabase
 * e, quando diverge do Firestore, aplica em memória E tenta gravar de volta. Mas
 * `firestore.rules` só deixa ADMIN escrever campo de privilégio: para os demais
 * o servidor recusa, o SDK faz rollback da escrita otimista, o rollback dispara
 * `onSnapshot` de novo com o valor velho e a reconciliação recomeça — o papel
 * fica piscando a sessão inteira.
 *
 * Este script faz a mesma reconciliação com credencial de admin (REST do
 * Firestore, que ignora as rules), então o writeback pega. Depois dele a
 * reconciliação do app vira no-op e o flapping para.
 *
 * Calcula EXATAMENTE o `syncFields` do UserContext — nada além disso é tocado.
 *
 * Uso:
 *   node scripts/sync-papel-firestore.mjs                 # dry-run de todo mundo
 *   node scripts/sync-papel-firestore.mjs --apply         # aplica em todo mundo
 *   node scripts/sync-papel-firestore.mjs --uid <UID>     # limita a uma pessoa
 *   node scripts/sync-papel-firestore.mjs --campos role   # limita os campos
 *
 * Idempotente: rodar de novo depois de aplicado não muda nada.
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { SignJWT } from 'jose';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const PROJECT_ID = 'anest-ap';
const ACTOR = 'pPdKZ75E9zNdPnLz50qisPiHfJw1'; // wguime@yahoo.com.br — audit-trail.md

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const UID = argv.includes('--uid') ? argv[argv.indexOf('--uid') + 1] : null;
const CAMPOS = argv.includes('--campos')
  ? argv[argv.indexOf('--campos') + 1].split(',').map((s) => s.trim())
  : null;
const tag = APPLY ? 'APLICA' : 'DRY-RUN';

// ── Supabase (service_role) ─────────────────────────────────────────────────
const envVars = {};
const envPath = resolve(projectRoot, '.env.local');
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^([^#=][^=]*)=(.*)$/);
    if (m) envVars[m[1].trim()] = m[2].trim();
  });
}
if (!envVars.SUPABASE_JWT_SECRET) { console.error('ERR: SUPABASE_JWT_SECRET ausente em .env.local'); process.exit(1); }

const jwt = await new SignJWT({
  iss: 'supabase', ref: 'vjzrahruvjffyyqyhjny', role: 'service_role',
  iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600,
}).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).sign(new TextEncoder().encode(envVars.SUPABASE_JWT_SECRET));

const supa = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${jwt}` } },
});

// ── Firestore REST com o token da CLI do firebase (consumido, nunca impresso) ─
const store = resolve(homedir(), '.config/configstore/firebase-tools.json');
if (!existsSync(store)) { console.error('ERR: CLI do firebase não autenticada. Rode: firebase login'); process.exit(1); }
const refreshToken = JSON.parse(readFileSync(store, 'utf8'))?.tokens?.refresh_token;
const tokRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  }),
}).then((r) => r.json());
if (!tokRes.access_token) { console.error('ERR: OAuth falhou —', tokRes.error_description || tokRes.error); process.exit(1); }
const TOKEN = tokRes.access_token;
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// ── Conversão de valores Firestore REST ↔ JS ────────────────────────────────
function fromFs(v) {
  if (v == null) return undefined;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, fromFs(x)]));
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFs);
  return undefined;
}
function toFs(v) {
  if (v === null) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFs) } };
  if (typeof v === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toFs(x)])) } };
  return { nullValue: null };
}

async function fsListUserProfiles() {
  const out = new Map();
  let pageToken = '';
  do {
    const url = `${FS}/userProfiles?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const page = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } }).then((r) => r.json());
    for (const d of page.documents || []) {
      out.set(d.name.split('/').pop(), Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, fromFs(v)])));
    }
    pageToken = page.nextPageToken || '';
  } while (pageToken);
  return out;
}

async function fsPatch(uid, campos) {
  const fields = Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, toFs(v)]));
  fields.updatedAt = { timestampValue: new Date().toISOString() };
  const mask = [...Object.keys(campos), 'updatedAt'].map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
  const res = await fetch(`${FS}/userProfiles/${uid}?${mask}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`PATCH ${uid} → ${res.status} ${await res.text()}`);
}

// ── Mesma lógica de syncFields do UserContext ───────────────────────────────
function syncFieldsDe(row, fsDoc) {
  const s = {};
  if (row.role && row.role !== fsDoc.role) s.role = row.role;
  if (row.is_admin === true && fsDoc.isAdmin !== true) s.isAdmin = true;
  if (row.is_coordenador === true && fsDoc.isCoordenador !== true) s.isCoordenador = true;
  if (row.custom_permissions != null && fsDoc.customPermissions !== row.custom_permissions) {
    s.customPermissions = row.custom_permissions;
  }
  if (row.ranking_opt_in != null && fsDoc.rankingOptIn !== row.ranking_opt_in) {
    s.rankingOptIn = row.ranking_opt_in;
  }
  if (row.permissions && typeof row.permissions === 'object' && Object.keys(row.permissions).length > 0) {
    const sb = JSON.stringify(row.permissions, Object.keys(row.permissions).sort());
    const fs = JSON.stringify(fsDoc.permissions || {}, Object.keys(fsDoc.permissions || {}).sort());
    if (sb !== fs) s.permissions = row.permissions;
  }
  return CAMPOS ? Object.fromEntries(Object.entries(s).filter(([k]) => CAMPOS.includes(k))) : s;
}

// ── Execução ────────────────────────────────────────────────────────────────
const fsDocs = await fsListUserProfiles();
let q = supa.from('profiles').select('id, nome, email, role, is_admin, is_coordenador, custom_permissions, permissions, ranking_opt_in');
if (UID) q = q.eq('id', UID);
const { data: rows, error } = await q;
if (error) { console.error(error); process.exit(1); }

console.log(`\n╔══ Sincronizar privilégio Supabase → Firestore — ${tag} ══╗`);
console.log(`  perfis Supabase: ${rows.length} | docs Firestore: ${fsDocs.size}${UID ? `  (filtro --uid ${UID})` : ''}${CAMPOS ? `  (campos: ${CAMPOS.join(', ')})` : ''}\n`);

const pendentes = [];
for (const row of rows) {
  const fsDoc = fsDocs.get(row.id);
  if (!fsDoc) continue; // ninguém sem doc no Firestore (quem nunca logou)
  const s = syncFieldsDe(row, fsDoc);
  if (Object.keys(s).length) pendentes.push({ row, fsDoc, s });
}

if (!pendentes.length) {
  console.log('  Nada divergente — Firestore já espelha o Supabase.\n');
  process.exit(0);
}

for (const { row, fsDoc, s } of pendentes) {
  console.log(`  ${(row.nome || '(sem nome)').padEnd(30)} ${row.email}`);
  for (const [k, v] of Object.entries(s)) {
    const antes = k === 'permissions' ? `${Object.keys(fsDoc.permissions || {}).length} chaves` : JSON.stringify(fsDoc[k]);
    const depois = k === 'permissions' ? `${Object.keys(v).length} chaves` : JSON.stringify(v);
    console.log(`      ${k}: ${antes} → ${depois}`);
  }
}

if (!APPLY) {
  console.log(`\n  ${pendentes.length} perfil(is) divergente(s). Rode com --apply para gravar.\n`);
  process.exit(0);
}

// Backup antes de gravar.
mkdirSync(resolve(projectRoot, '.tmp'), { recursive: true });
const bkPath = resolve(projectRoot, '.tmp', `backup-sync-papel-${new Date().toISOString().slice(0, 10)}.json`);
writeFileSync(bkPath, JSON.stringify(pendentes.map(({ row, fsDoc, s }) => ({ id: row.id, email: row.email, firestoreAntes: fsDoc, aplicado: s })), null, 2));
console.log(`\n  backup → ${bkPath}`);

for (const { row, s } of pendentes) {
  await fsPatch(row.id, s);
  console.log(`  ✅ ${row.email}: ${Object.keys(s).join(', ')}`);
  if (s.role) {
    const { error: audErr } = await supa.from('permission_audit_log').insert({
      target_user_id: row.id,
      changed_by: ACTOR,
      action: 'role_change',
      old_value: { role: pendentes.find((p) => p.row.id === row.id).fsDoc.role, origem: 'firestore' },
      new_value: { role: s.role, origem: 'firestore' },
    });
    if (audErr) console.warn(`     AVISO: audit falhou — ${audErr.message}`);
  }
}

console.log(`\n╚══ ${tag} concluído — ${pendentes.length} perfil(is) ══╝\n`);

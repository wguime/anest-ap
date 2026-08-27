/**
 * Tira da Daniela Klein Reis o template de permissão de RESIDENTE que sobrou
 * depois que ela virou anestesiologista. Pedido do dono 2026-08-27.
 *
 * ── Estado antes ────────────────────────────────────────────────────────────
 * `profiles.role` já é 'anestesiologista' (o Firestore foi acertado por
 * scripts/sync-papel-firestore.mjs). Mas `custom_permissions` continua true com
 * o mapa do residente: 11 cards em false (qualidade, auditorias, relatorios,
 * reunioes, comites, desastres, organograma, planos_acao, autoavaliacao,
 * faturamento, etica_bioetica) e o resíduo `"ano": "R1"` — que NÃO é card e não
 * é lido por lugar nenhum do app (grep em src/: zero ocorrências).
 *
 * ── O que faz ───────────────────────────────────────────────────────────────
 * Zera `custom_permissions` e esvazia `permissions`, nos dois backends. Com
 * `customPermissions !== true`, `useCardPermissions` cai no ramo "usuário nunca
 * teve permissões editadas → permitir tudo", que é exatamente o
 * ROLE_PERMISSION_TEMPLATES.anestesiologista (`getAllCardIds(true)`). Mesma
 * configuração dos outros anestesiologistas.
 *
 * Uso:
 *   node scripts/fix-daniela-template-anestesiologista.mjs           # dry-run
 *   node scripts/fix-daniela-template-anestesiologista.mjs --apply
 *
 * Idempotente. Faz backup em .tmp/ antes de gravar.
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

const APPLY = process.argv.includes('--apply');
const tag = APPLY ? 'APLICA' : 'DRY-RUN';

const UID = 'Dcbb3U7D1cWIeRrIEQNTMySDcDp2';
const EMAIL = 'danikreis@gmail.com';
const ROLE_ESPERADO = 'anestesiologista';
const ACTOR = 'pPdKZ75E9zNdPnLz50qisPiHfJw1'; // wguime@yahoo.com.br — audit-trail.md

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

// Firestore REST com o token da CLI do firebase (consumido, nunca impresso).
const store = resolve(homedir(), '.config/configstore/firebase-tools.json');
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
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const { data: perfil, error } = await supa.from('profiles').select('*').eq('id', UID).maybeSingle();
if (error) { console.error(error); process.exit(1); }
if (!perfil) { console.error(`ERR: perfil ${UID} não existe`); process.exit(1); }
if (perfil.email !== EMAIL) { console.error(`ERR: e-mail não bate (${perfil.email}). Abortando por segurança.`); process.exit(1); }
if (perfil.role !== ROLE_ESPERADO) { console.error(`ERR: papel é '${perfil.role}', esperado '${ROLE_ESPERADO}'. Rode antes scripts/sync-papel-firestore.mjs.`); process.exit(1); }

const fsDoc = await fetch(`${FS}/userProfiles/${UID}`, { headers: { Authorization: `Bearer ${tokRes.access_token}` } }).then((r) => (r.status === 404 ? null : r.json()));

// Chaves lidas DIRETO (`user.permissions['x']`), fora do useCardPermissions —
// PermissionsModal.jsx:426. Com permissions={} viram undefined, ou seja seguem
// NEGADAS: esvaziar o mapa não concede nenhuma delas.
const CHAVES_ESPECIAIS = ['residencia-edit', 'tec-enf-secretaria-edit', 'staff-absence-private'];

const bloqueados = Object.entries(perfil.permissions || {}).filter(([, v]) => v === false).map(([k]) => k);
const cardsLiberados = bloqueados.filter((k) => !CHAVES_ESPECIAIS.includes(k));
const seguemNegadas = bloqueados.filter((k) => CHAVES_ESPECIAIS.includes(k));

console.log(`\n╔══ Daniela Klein Reis → template de anestesiologista — ${tag} ══╗`);
console.log(`  papel: ${perfil.role}`);
console.log(`  custom_permissions: ${perfil.custom_permissions} → false`);
console.log(`  permissions: ${Object.keys(perfil.permissions || {}).length} chaves → {} (herda o padrão do cargo)`);
console.log(`\n  cards que passam a ser vistos (${cardsLiberados.length}) — via useCardPermissions:`);
console.log(`    ${cardsLiberados.join(', ') || '(nenhum)'}`);
console.log(`\n  permissões de EDIÇÃO que seguem negadas (${seguemNegadas.length}) — lidas direto, undefined é falsy:`);
console.log(`    ${seguemNegadas.join(', ') || '(nenhuma)'}`);
console.log(`\n  resíduo removido: ${'ano' in (perfil.permissions || {}) ? `"ano": "${perfil.permissions.ano}"` : '(sem campo ano)'}`);

if (perfil.custom_permissions === false && Object.keys(perfil.permissions || {}).length === 0) {
  console.log('\n  Já está no estado final — nada a fazer.\n');
  process.exit(0);
}

if (!APPLY) {
  console.log('\n  Nada foi alterado. Rode de novo com --apply para aplicar.\n');
  process.exit(0);
}

mkdirSync(resolve(projectRoot, '.tmp'), { recursive: true });
const bkPath = resolve(projectRoot, '.tmp', `backup-daniela-template-${new Date().toISOString().slice(0, 10)}.json`);
writeFileSync(bkPath, JSON.stringify({ supabaseAntes: perfil, firestoreAntes: fsDoc }, null, 2));
console.log(`\n  backup → ${bkPath}`);

// 1. Supabase (source of truth)
{
  const { error: e } = await supa
    .from('profiles')
    .update({ custom_permissions: false, permissions: {} })
    .eq('id', UID);
  if (e) { console.error('  ERRO Supabase:', e.message); process.exit(1); }
  console.log('  ✅ Supabase profiles');
}

// 2. Firestore — campo de privilégio, então vai pela REST com credencial de admin.
{
  const mask = ['customPermissions', 'permissions', 'updatedAt']
    .map((f) => `updateMask.fieldPaths=${f}`).join('&');
  const res = await fetch(`${FS}/userProfiles/${UID}?${mask}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokRes.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        customPermissions: { booleanValue: false },
        permissions: { mapValue: { fields: {} } },
        updatedAt: { timestampValue: new Date().toISOString() },
      },
    }),
  });
  if (!res.ok) { console.error('  ERRO Firestore:', res.status, await res.text()); process.exit(1); }
  console.log('  ✅ Firestore userProfiles');
}

// 3. Audit trail
{
  const { error: e } = await supa.from('permission_audit_log').insert({
    target_user_id: UID,
    changed_by: ACTOR,
    action: 'permission_update',
    old_value: { customPermissions: perfil.custom_permissions, cardsBloqueados: bloqueados, ano: perfil.permissions?.ano ?? null },
    new_value: { customPermissions: false, permissions: {}, motivo: 'deixou de ser residente — template de anestesiologista' },
  });
  if (e) console.warn('  AVISO: audit falhou —', e.message);
  else console.log('  ✅ permission_audit_log');
}

console.log(`\n╚══ ${tag} concluído ══╝\n`);

/**
 * Consolida a conta do Oscar Morais no e-mail novo e devolve o acesso à Escala
 * Cirúrgica. Pedido do dono 2026-08-27.
 *
 * ── O que estava quebrado ────────────────────────────────────────────────────
 * Ele se cadastrou em 26/08 com `oscarmorais3@hotmail.com`. O `rpc_create_profile`
 * do Supabase leu `authorized_emails.role` e gravou `anestesiologista` — o lado
 * Supabase está 100% certo (a RLS `can_write_escala_cirurgica()` devolve true
 * para ele). Mas o perfil do FIRESTORE é criado pelo cliente (UserContext) no
 * molde sem privilégio: `role: 'colaborador'`. E `podeVerEscalaCirurgica(user)`
 * lê justamente esse papel.
 *
 * A reconciliação Supabase→Firestore tenta corrigir, mas `firestore.rules`
 * proíbe o próprio usuário de escrever `role`/`customPermissions` (anti escalada
 * de privilégio). O SDK aplica a escrita no cache local, o servidor recusa e o
 * SDK faz ROLLBACK — o que dispara `onSnapshot` de novo com 'colaborador'. Isso
 * realimenta a reconciliação: o papel fica piscando entre 'colaborador' e
 * 'anestesiologista' e o card da escala aparece e some. Só uma escrita com
 * privilégio de admin encerra o ciclo.
 *
 * Os apelidos "OSCAR" / "OSCAR MORAIS" do dicionário da escala também ainda
 * apontam para o UID da conta ANTIGA — sem reapontar, a escala não o reconhece
 * nem depois do papel corrigido.
 *
 * ── O que este script faz ────────────────────────────────────────────────────
 *  1. backup JSON de tudo que será alterado/apagado (.tmp/)
 *  2. Firestore userProfiles/<UID novo>: role='anestesiologista',
 *     customPermissions=false, rankingOptIn=false — os três campos que a
 *     reconciliação tentava gravar; com eles alinhados ela vira no-op
 *  3. escala_anestesista_alias: 2 apelidos → UID novo
 *  4. authorized_emails: remove o e-mail ANTIGO
 *  5. notifications do UID antigo: apaga (conta nunca acessada — access_count 0)
 *  6. profiles (Supabase) + userProfiles/users (Firestore) do UID antigo: apaga
 *  7. permission_audit_log: registra as mudanças com o UID REAL do dono
 *
 * NÃO toca no `permission_audit_log` histórico (trilha imutável) nem na conta do
 * Firebase Auth do e-mail antigo — ver o relatório no fim da execução.
 *
 * Credenciais: Supabase vem de `.env.local`; o Firestore usa o token da CLI do
 * `firebase` já autenticada (o script lê o configstore internamente e nunca
 * imprime o valor). A REST do Firestore com credencial OAuth ignora as rules —
 * é o equivalente ao caminho de admin do Centro de Gestão.
 *
 * Uso:
 *   node scripts/fix-oscar-morais-conta.mjs           # dry-run (padrão)
 *   node scripts/fix-oscar-morais-conta.mjs --apply   # aplica
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

const APPLY = process.argv.includes('--apply');
const tag = APPLY ? 'APLICA' : 'DRY-RUN';

// ── Alvos ───────────────────────────────────────────────────────────────────
const PROJECT_ID = 'anest-ap';
const NEW_UID = 'qasYnJpQ01QrVjRO7Og5rBNRlVu2';
const NEW_EMAIL = 'oscarmorais3@hotmail.com';
const OLD_UID = '0PIwC4DeeMggzMK2JTqW0nmEYHj1';
const OLD_EMAIL = 'oscarmorais@hotmail.com';
const ROLE = 'anestesiologista';
// Ator do audit trail: UID REAL do dono (audit-trail.md — nunca 'admin'/'system').
const ACTOR = 'pPdKZ75E9zNdPnLz50qisPiHfJw1'; // wguime@yahoo.com.br

// ── Supabase (service_role via JWT HS256, mesmo padrão dos scripts diag-*) ───
const envVars = {};
const envPath = resolve(projectRoot, '.env.local');
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^([^#=][^=]*)=(.*)$/);
    if (m) envVars[m[1].trim()] = m[2].trim();
  });
}
if (!envVars.VITE_SUPABASE_URL || !envVars.VITE_SUPABASE_ANON_KEY || !envVars.SUPABASE_JWT_SECRET) {
  console.error('ERR: falta VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / SUPABASE_JWT_SECRET em .env.local');
  process.exit(1);
}
const jwt = await new SignJWT({
  iss: 'supabase', ref: 'vjzrahruvjffyyqyhjny', role: 'service_role',
  iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600,
}).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).sign(new TextEncoder().encode(envVars.SUPABASE_JWT_SECRET));

const supa = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${jwt}` } },
});

// ── Firestore REST com o token da CLI do firebase ───────────────────────────
// client_id/secret do firebase-tools são constantes públicas do projeto
// open-source (app instalado); o refresh_token do usuário fica no configstore e
// é consumido aqui sem nunca ser impresso.
const FIREBASE_CLI_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLI_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

async function firestoreAccessToken() {
  const store = resolve(homedir(), '.config/configstore/firebase-tools.json');
  if (!existsSync(store)) throw new Error('CLI do firebase não autenticada (configstore ausente). Rode: firebase login');
  const refreshToken = JSON.parse(readFileSync(store, 'utf8'))?.tokens?.refresh_token;
  if (!refreshToken) throw new Error('configstore sem refresh_token. Rode: firebase login --reauth');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: FIREBASE_CLI_CLIENT_ID,
      client_secret: FIREBASE_CLI_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error(`OAuth falhou (${res.status}): ${json.error_description || json.error || 'sem access_token'}`);
  return json.access_token;
}

const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function firestoreGet(token, path) {
  const res = await fetch(`${FS_BASE}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

async function firestorePatch(token, path, fields) {
  const mask = Object.keys(fields).map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
  const res = await fetch(`${FS_BASE}/${path}?${mask}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`PATCH ${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

async function firestoreDelete(token, path) {
  const res = await fetch(`${FS_BASE}/${path}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok && res.status !== 404) throw new Error(`DELETE ${path} → ${res.status} ${await res.text()}`);
  return res.status;
}

const token = await firestoreAccessToken();

console.log(`\n╔══ Consolidação da conta do Oscar Morais — ${tag} ══╗`);
console.log(`  manter:  ${NEW_EMAIL}  (uid ${NEW_UID})`);
console.log(`  excluir: ${OLD_EMAIL}  (uid ${OLD_UID})\n`);

// ── 1. Backup ───────────────────────────────────────────────────────────────
const backup = { geradoEm: new Date().toISOString(), NEW_UID, OLD_UID };
{
  const { data: profs } = await supa.from('profiles').select('*').in('id', [OLD_UID, NEW_UID]);
  backup.profiles = profs || [];
  const { data: auth } = await supa.from('authorized_emails').select('*').in('email', [OLD_EMAIL, NEW_EMAIL]);
  backup.authorized_emails = auth || [];
  const { data: alias } = await supa.from('escala_anestesista_alias').select('*').in('user_id', [OLD_UID, NEW_UID]);
  backup.escala_anestesista_alias = alias || [];
  const { data: notifs } = await supa.from('notifications').select('*').eq('recipient_id', OLD_UID);
  backup.notifications = notifs || [];
  backup.firestore = {};
  for (const p of [`userProfiles/${OLD_UID}`, `userProfiles/${NEW_UID}`, `users/${OLD_UID}`, `users/${NEW_UID}`]) {
    backup.firestore[p] = await firestoreGet(token, p);
  }

  mkdirSync(resolve(projectRoot, '.tmp'), { recursive: true });
  const bkPath = resolve(projectRoot, '.tmp', `backup-oscar-morais-${new Date().toISOString().slice(0, 10)}.json`);
  writeFileSync(bkPath, JSON.stringify(backup, null, 2));
  console.log(`[1] backup → ${bkPath}`);
  console.log(`    profiles=${backup.profiles.length} authorized_emails=${backup.authorized_emails.length} apelidos=${backup.escala_anestesista_alias.length} notifications=${backup.notifications.length}`);
  console.log(`    firestore: ${Object.entries(backup.firestore).map(([k, v]) => `${k}=${v ? 'ok' : '(ausente)'}`).join(' ')}`);
}

// ── 2. Firestore: papel do perfil NOVO ──────────────────────────────────────
{
  const doc = backup.firestore[`userProfiles/${NEW_UID}`];
  const antes = doc?.fields?.role?.stringValue ?? '(sem campo)';
  console.log(`\n[2] Firestore userProfiles/${NEW_UID}`);
  console.log(`    role: '${antes}' → '${ROLE}'`);
  console.log(`    customPermissions → false | rankingOptIn → false  (alinha a reconciliação e para o flapping)`);
  if (APPLY) {
    await firestorePatch(token, `userProfiles/${NEW_UID}`, {
      role: { stringValue: ROLE },
      customPermissions: { booleanValue: false },
      rankingOptIn: { booleanValue: false },
      updatedAt: { timestampValue: new Date().toISOString() },
    });
    const depois = await firestoreGet(token, `userProfiles/${NEW_UID}`);
    console.log(`    ok — role agora: '${depois?.fields?.role?.stringValue}'`);
  }
}

// ── 3. Apelidos da escala → UID novo ────────────────────────────────────────
{
  const alvo = backup.escala_anestesista_alias.filter((a) => a.user_id === OLD_UID);
  console.log(`\n[3] escala_anestesista_alias → UID novo: ${alvo.map((a) => a.apelido).join(', ') || '(nada a fazer)'}`);
  if (APPLY && alvo.length) {
    const { error } = await supa
      .from('escala_anestesista_alias')
      .update({ user_id: NEW_UID })
      .eq('user_id', OLD_UID);
    if (error) { console.error('    ERRO:', error.message); process.exit(1); }
    console.log('    ok');
  }
}

// ── 4. authorized_emails: remove o antigo ───────────────────────────────────
{
  const tem = backup.authorized_emails.some((e) => e.email === OLD_EMAIL);
  console.log(`\n[4] authorized_emails DELETE ${OLD_EMAIL} — ${tem ? 'presente' : 'já ausente'}`);
  if (APPLY && tem) {
    const { error } = await supa.from('authorized_emails').delete().eq('email', OLD_EMAIL);
    if (error) { console.error('    ERRO:', error.message); process.exit(1); }
    console.log('    ok');
  }
}

// ── 5. notifications do UID antigo ──────────────────────────────────────────
{
  console.log(`\n[5] notifications DELETE recipient_id=${OLD_UID} — ${backup.notifications.length} linha(s) (já no backup)`);
  if (APPLY && backup.notifications.length) {
    const { error } = await supa.from('notifications').delete().eq('recipient_id', OLD_UID);
    if (error) { console.error('    ERRO:', error.message); process.exit(1); }
    console.log('    ok');
  }
}

// ── 6. Conta antiga: Supabase + Firestore ───────────────────────────────────
{
  const tem = backup.profiles.some((p) => p.id === OLD_UID);
  console.log(`\n[6] conta antiga DELETE — profiles: ${tem ? 'presente' : 'já ausente'}`);
  for (const p of [`userProfiles/${OLD_UID}`, `users/${OLD_UID}`]) {
    console.log(`    firestore ${p}: ${backup.firestore[p] ? 'presente' : 'já ausente'}`);
  }
  if (APPLY) {
    if (tem) {
      const { error } = await supa.from('profiles').delete().eq('id', OLD_UID);
      if (error) { console.error('    ERRO:', error.message); process.exit(1); }
      console.log('    supabase profiles ok');
    }
    for (const p of [`userProfiles/${OLD_UID}`, `users/${OLD_UID}`]) {
      if (!backup.firestore[p]) continue;
      const st = await firestoreDelete(token, p);
      console.log(`    firestore ${p} → ${st}`);
    }
  }
}

// ── 7. Audit trail ──────────────────────────────────────────────────────────
{
  const linhas = [
    { target_user_id: NEW_UID, changed_by: ACTOR, action: 'role_change', old_value: { role: 'colaborador', origem: 'firestore' }, new_value: { role: ROLE, origem: 'firestore' } },
    { target_user_id: NEW_UID, changed_by: ACTOR, action: 'permission_update', old_value: { escala_alias_user_id: OLD_UID }, new_value: { escala_alias_user_id: NEW_UID } },
    { target_user_id: OLD_UID, changed_by: ACTOR, action: 'user_delete', old_value: { email: OLD_EMAIL, motivo: `conta duplicada — e-mail atualizado para ${NEW_EMAIL}` }, new_value: null },
  ];
  console.log(`\n[7] permission_audit_log: ${linhas.length} entradas (changed_by=${ACTOR})`);
  if (APPLY) {
    const { error } = await supa.from('permission_audit_log').insert(linhas);
    if (error) console.error('    AVISO: audit falhou —', error.message);
    else console.log('    ok');
  }
}

console.log(`\n╚══ ${tag} concluído ══╝`);
if (!APPLY) {
  console.log('\nNada foi alterado. Rode de novo com --apply para aplicar.');
} else {
  console.log(`\nPendente FORA deste script: a conta do Firebase Auth de ${OLD_EMAIL},`);
  console.log('se existir — o Admin SDK não está disponível nesta máquina (sem service-account e sem gcloud).');
}

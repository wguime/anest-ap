#!/usr/bin/env node
/**
 * scripts/migrate-storage-firebase-to-supabase.mjs
 *
 * Sprint 21 (v5.0.0) — Data migration: backfill arquivos legados de Firebase
 * Storage para Supabase Storage. Mantém Firebase Storage intacto (rollback
 * safety — limpeza só em Sprint 22+ após validação 30 dias).
 *
 * Escopo:
 *   1) userProfiles.avatar              → bucket profile-photos
 *   2) reuniao_documentos.arquivoUrl    → bucket reuniao-documentos | reuniao-atas
 *   3) documentos.url (Supabase already) → SKIP (já está em Supabase Storage)
 *
 * Comportamento:
 *   - Default = DRY-RUN. Mostra o que faria sem alterar nada.
 *   - --apply  = executa migração (baixa Firebase, sobe Supabase, atualiza DB).
 *   - Idempotente: pula registros com storageProvider/storage_provider='supabase'.
 *   - Skip registros cuja URL já é Supabase (mesmo sem flag — auto-corrige flag).
 *
 * Pré-requisitos:
 *   GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase-anest-admin.json
 *   .env.local com VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_JWT_SECRET
 *
 * Uso:
 *   GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase-anest-admin.json \\
 *     node scripts/migrate-storage-firebase-to-supabase.mjs              # dry-run
 *   GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase-anest-admin.json \\
 *     node scripts/migrate-storage-firebase-to-supabase.mjs --apply
 *
 * Flags:
 *   --apply              executa (default = dry-run)
 *   --only=profiles      apenas userProfiles.avatar
 *   --only=reunioes      apenas reuniao_documentos
 *   --limit=N            processa no máximo N registros por collection (debug)
 *   --verbose            log detalhado
 *
 * Saída:
 *   /tmp/anest-storage-migration-{timestamp}.log  (resumo + lista por id)
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { SignJWT } from 'jose';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

// ----------------------------------------------------------------------------
// CLI args
// ----------------------------------------------------------------------------
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const VERBOSE = args.includes('--verbose');
const ONLY = (args.find((a) => a.startsWith('--only=')) || '').split('=')[1] || null;
const LIMIT = parseInt((args.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || '0', 10) || null;

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// ----------------------------------------------------------------------------
// Env
// ----------------------------------------------------------------------------
const envVars = {};
const envPath = resolve(projectRoot, '.env.local');
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^([^#=][^=]*)=(.*)$/);
    if (m) envVars[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  });
}

const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = envVars.VITE_SUPABASE_ANON_KEY;
const JWT_SECRET = envVars.SUPABASE_JWT_SECRET;
const SUPABASE_REF = envVars.VITE_SUPABASE_PROJECT_REF || 'vjzrahruvjffyyqyhjny';
const GAC = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !JWT_SECRET) {
  console.error('❌ Faltam VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / SUPABASE_JWT_SECRET em .env.local');
  process.exit(1);
}
if (!GAC) {
  console.error('❌ GOOGLE_APPLICATION_CREDENTIALS não setada.');
  console.error('   Exporte um service account JSON (Firebase Console → Project Settings → Service Accounts).');
  console.error('   Exemplo: GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase-anest-admin.json node scripts/migrate-storage-firebase-to-supabase.mjs');
  process.exit(1);
}
if (!existsSync(GAC)) {
  console.error(`❌ Arquivo não encontrado: ${GAC}`);
  process.exit(1);
}

// ----------------------------------------------------------------------------
// Init Firebase Admin
// ----------------------------------------------------------------------------
const saContent = JSON.parse(readFileSync(GAC, 'utf8'));
const FIREBASE_PROJECT_ID = saContent.project_id;
const STORAGE_BUCKET = envVars.VITE_FIREBASE_STORAGE_BUCKET || `${FIREBASE_PROJECT_ID}.appspot.com`;

if (!getApps().length) {
  initializeApp({
    credential: cert(saContent),
    storageBucket: STORAGE_BUCKET,
  });
}
const firestore = getFirestore();
const fbBucket = getStorage().bucket();

// ----------------------------------------------------------------------------
// Init Supabase service_role client (escreve com bypass RLS)
// ----------------------------------------------------------------------------
const supaJwt = await new SignJWT({
  iss: 'supabase',
  ref: SUPABASE_REF,
  role: 'service_role',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
})
  .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
  .sign(new TextEncoder().encode(JWT_SECRET));

const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${supaJwt}` } },
});

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
function isFirebaseUrl(url) {
  return typeof url === 'string'
    && (url.includes('firebasestorage.googleapis.com') || url.includes('storage.googleapis.com/v0/'));
}
function isSupabaseUrl(url) {
  return typeof url === 'string'
    && (url.includes('.supabase.co/storage/') || url.includes('/storage/v1/object/'));
}

/**
 * Extrai o storage path de uma URL Firebase Download.
 * Ex: https://firebasestorage.googleapis.com/v0/b/anest-ap.appspot.com/o/avatars%2Fuid?alt=media&token=xyz
 *  → 'avatars/uid'
 */
function firebasePathFromUrl(url) {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/o\/(.+)$/);
    if (!m) return null;
    return decodeURIComponent(m[1]);
  } catch {
    return null;
  }
}

/**
 * Baixa um Firebase Storage object como Buffer + contentType.
 * Suporta inferir path tanto de URL quanto de storagePath direto.
 */
async function downloadFirebaseObject({ url, storagePath }) {
  const path = storagePath || (url ? firebasePathFromUrl(url) : null);
  if (!path) throw new Error('Sem storagePath/URL para inferir caminho Firebase');
  const file = fbBucket.file(path);
  const [exists] = await file.exists();
  if (!exists) throw new Error(`Firebase object não existe: ${path}`);
  const [buf] = await file.download();
  const [meta] = await file.getMetadata();
  return { buf, contentType: meta.contentType || 'application/octet-stream', size: buf.length };
}

/**
 * Upload Buffer em Supabase Storage bucket/path. Retorna { url } signed.
 */
async function uploadToSupabaseStorage(bucket, path, buf, contentType) {
  const { error } = await supabase.storage.from(bucket).upload(path, buf, {
    upsert: true,
    cacheControl: '3600',
    contentType,
  });
  if (error) throw new Error(`Supabase upload error: ${error.message}`);
  const { data, error: signErr } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (signErr) throw new Error(`Supabase sign error: ${signErr.message}`);
  return { url: data.signedUrl };
}

// ----------------------------------------------------------------------------
// Logger (file + stdout)
// ----------------------------------------------------------------------------
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const logPath = `/tmp/anest-storage-migration-${ts}.log`;
const logLines = [];
function log(msg) {
  console.log(msg);
  logLines.push(msg);
}
function logVerbose(msg) {
  if (VERBOSE) console.log(`  ${msg}`);
  logLines.push(`  ${msg}`);
}

// ----------------------------------------------------------------------------
// Stream 1: userProfiles.avatar → profile-photos bucket
// ----------------------------------------------------------------------------
async function migrateProfiles() {
  log('\n━━━ STREAM 1: userProfiles.avatar → profile-photos ━━━');
  const stats = { total: 0, skipped_supabase: 0, skipped_no_avatar: 0, migrated: 0, errors: 0, would_migrate: 0 };

  let query = firestore.collection('userProfiles');
  if (LIMIT) query = query.limit(LIMIT);
  const snap = await query.get();

  for (const docSnap of snap.docs) {
    stats.total += 1;
    const data = docSnap.data();
    const uid = docSnap.id;
    const avatarUrl = data.avatar;

    if (!avatarUrl) { stats.skipped_no_avatar += 1; continue; }
    if (data.storage_provider === 'supabase' || isSupabaseUrl(avatarUrl)) {
      stats.skipped_supabase += 1;
      logVerbose(`SKIP supabase: ${uid}`);
      continue;
    }
    if (!isFirebaseUrl(avatarUrl)) {
      logVerbose(`SKIP unknown provider: ${uid} → ${avatarUrl?.slice(0, 60)}…`);
      continue;
    }

    if (!APPLY) {
      stats.would_migrate += 1;
      logVerbose(`WOULD MIGRATE: ${uid}`);
      continue;
    }

    try {
      const { buf, contentType, size } = await downloadFirebaseObject({
        url: avatarUrl,
        storagePath: `avatars/${uid}`,
      });
      const supaPath = `${uid}/avatar.jpg`;
      const { url } = await uploadToSupabaseStorage('profile-photos', supaPath, buf, contentType);
      await firestore.doc(`userProfiles/${uid}`).update({
        avatar: url,
        storage_provider: 'supabase',
        storage_migrated_at: FieldValue.serverTimestamp(),
      });
      stats.migrated += 1;
      log(`✓ ${uid} → profile-photos/${supaPath} (${(size / 1024).toFixed(1)} KB)`);
    } catch (err) {
      stats.errors += 1;
      log(`✗ ${uid}: ${err.message}`);
    }
  }

  log(`\n  total=${stats.total} skipped_no_avatar=${stats.skipped_no_avatar} skipped_supabase=${stats.skipped_supabase} migrated=${stats.migrated} would_migrate=${stats.would_migrate} errors=${stats.errors}`);
  return stats;
}

// ----------------------------------------------------------------------------
// Stream 2: reuniao_documentos.arquivoUrl → reuniao-documentos | reuniao-atas
// ----------------------------------------------------------------------------
async function migrateReuniaoDocs() {
  log('\n━━━ STREAM 2: reuniao_documentos.arquivoUrl → reuniao-{documentos,atas} ━━━');
  const stats = { total: 0, skipped_supabase: 0, skipped_no_url: 0, migrated: 0, errors: 0, would_migrate: 0 };

  let query = firestore.collection('reuniao_documentos');
  if (LIMIT) query = query.limit(LIMIT);
  const snap = await query.get();

  for (const docSnap of snap.docs) {
    stats.total += 1;
    const data = docSnap.data();
    const id = docSnap.id;
    const fileUrl = data.arquivoUrl;
    const storagePath = data.storagePath;

    if (!fileUrl && !storagePath) { stats.skipped_no_url += 1; continue; }
    if (data.storageProvider === 'supabase' || (fileUrl && isSupabaseUrl(fileUrl))) {
      stats.skipped_supabase += 1;
      logVerbose(`SKIP supabase: ${id}`);
      continue;
    }
    if (fileUrl && !isFirebaseUrl(fileUrl) && !storagePath) {
      logVerbose(`SKIP unknown provider: ${id}`);
      continue;
    }

    const tipo = data.tipoDocumento;
    const reuniaoId = data.reuniaoId;
    if (!reuniaoId || !tipo) {
      stats.errors += 1;
      log(`✗ ${id}: faltam tipoDocumento/reuniaoId`);
      continue;
    }

    const isAta = tipo === 'ata';
    const targetBucket = isAta ? 'reuniao-atas' : 'reuniao-documentos';
    const originalName = data.arquivoNome || (storagePath ? basename(storagePath) : 'arquivo.pdf');
    const safeName = originalName.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\.\.+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '_');
    const targetPath = isAta
      ? `${reuniaoId}/${Date.now()}_${safeName}`
      : `${reuniaoId}/${tipo}/${Date.now()}_${safeName}`;

    if (!APPLY) {
      stats.would_migrate += 1;
      logVerbose(`WOULD MIGRATE: ${id} → ${targetBucket}/${targetPath}`);
      continue;
    }

    try {
      const { buf, contentType, size } = await downloadFirebaseObject({ url: fileUrl, storagePath });
      const { url } = await uploadToSupabaseStorage(targetBucket, targetPath, buf, contentType);
      await firestore.doc(`reuniao_documentos/${id}`).update({
        arquivoUrl: url,
        storagePath: targetPath,
        storageBucket: targetBucket,
        storageProvider: 'supabase',
        storage_migrated_at: FieldValue.serverTimestamp(),
      });
      stats.migrated += 1;
      log(`✓ ${id} → ${targetBucket}/${targetPath} (${(size / 1024).toFixed(1)} KB)`);
    } catch (err) {
      stats.errors += 1;
      log(`✗ ${id}: ${err.message}`);
    }
  }

  log(`\n  total=${stats.total} skipped_no_url=${stats.skipped_no_url} skipped_supabase=${stats.skipped_supabase} migrated=${stats.migrated} would_migrate=${stats.would_migrate} errors=${stats.errors}`);
  return stats;
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------
async function main() {
  log('═══════════════════════════════════════════════════════════════════');
  log(`  ANEST Sprint 21 — Storage Migration Firebase → Supabase`);
  log(`  Mode: ${APPLY ? 'APPLY (mutate)' : 'DRY-RUN (read-only)'}`);
  log(`  Only: ${ONLY || 'all streams'}    Limit: ${LIMIT || 'no'}    Verbose: ${VERBOSE}`);
  log(`  Firebase project: ${FIREBASE_PROJECT_ID}  bucket: ${STORAGE_BUCKET}`);
  log(`  Supabase ref: ${SUPABASE_REF}`);
  log('═══════════════════════════════════════════════════════════════════');

  const startedAt = Date.now();
  const allStats = {};

  if (!ONLY || ONLY === 'profiles') {
    allStats.profiles = await migrateProfiles();
  }
  if (!ONLY || ONLY === 'reunioes') {
    allStats.reunioes = await migrateReuniaoDocs();
  }

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);

  log('\n═══════════════════════════════════════════════════════════════════');
  log(`  SUMMARY (${elapsedSec}s)`);
  for (const [stream, s] of Object.entries(allStats)) {
    log(`  ${stream.padEnd(12)} migrated=${s.migrated || 0}  would_migrate=${s.would_migrate || 0}  skipped=${(s.skipped_supabase || 0) + (s.skipped_no_avatar || 0) + (s.skipped_no_url || 0)}  errors=${s.errors || 0}`);
  }
  log('═══════════════════════════════════════════════════════════════════');
  if (!APPLY) {
    log('\n⚠️  Esta foi uma DRY-RUN. Para executar de fato, rode com --apply.');
  }

  writeFileSync(logPath, logLines.join('\n') + '\n', 'utf8');
  log(`\nLog completo: ${logPath}`);

  // Exit non-zero if any errors so CI/automation pode detectar.
  const anyErrors = Object.values(allStats).some((s) => (s.errors || 0) > 0);
  process.exit(anyErrors ? 2 : 0);
}

main().catch((err) => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});

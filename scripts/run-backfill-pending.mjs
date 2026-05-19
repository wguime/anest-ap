#!/usr/bin/env node
/**
 * scripts/run-backfill-pending.mjs
 *
 * Wave 1.9 T1.9.4 — Wrapper de força-backfill que itera sobre os certificados
 * `supabaseMigrated !== true` e chama a Edge function `backfill-cert-supabase`
 * para mover o PDF do Firebase Storage para Supabase Storage.
 *
 * Após sucesso da Edge, atualiza o doc Firestore com:
 *   { supabaseMigrated: true, supabaseMigratedAt: now, supabaseMigratedBackfill: true }
 *
 * Default = DRY-RUN. Use --apply para executar.
 *
 * Flags:
 *   --apply       Executa chamadas Edge + writes Firestore (default = dry-run)
 *   --limit=N     Processa no máximo N pending docs
 *   --verbose     Log detalhado
 *
 * Pré-requisitos (ambos):
 *   - GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase-anest-admin.json (Admin SDK)
 *   - .env.local com:
 *       VITE_SUPABASE_URL
 *       SUPABASE_JWT_SECRET  (para emitir JWT HS256 admin do caller)
 *       BACKFILL_ADMIN_UID   (firebase_uid de uma linha em admin_users)
 *
 * Uso:
 *   GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase-anest-admin.json \
 *     node scripts/run-backfill-pending.mjs              # dry-run
 *   GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase-anest-admin.json \
 *     node scripts/run-backfill-pending.mjs --apply
 *
 * Saída:
 *   /tmp/anest-backfill-pending-{timestamp}.log
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SignJWT } from 'jose';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// ----------------------------------------------------------------------------
// CLI args
// ----------------------------------------------------------------------------
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const VERBOSE = args.includes('--verbose');
const LIMIT = parseInt(
  (args.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || '0',
  10,
) || null;

const RATE_LIMIT_MS = 200; // 5 req/s — folga grande pra Edge não ficar sobrecarregada

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// ----------------------------------------------------------------------------
// Env (.env.local — não loga valores)
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
const JWT_SECRET = envVars.SUPABASE_JWT_SECRET;
const SUPABASE_REF = envVars.VITE_SUPABASE_PROJECT_REF || 'vjzrahruvjffyyqyhjny';
const ADMIN_UID = envVars.BACKFILL_ADMIN_UID || process.env.BACKFILL_ADMIN_UID;
const GAC = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!SUPABASE_URL || !JWT_SECRET) {
  console.error('Faltam VITE_SUPABASE_URL / SUPABASE_JWT_SECRET em .env.local');
  process.exit(2);
}
if (!ADMIN_UID) {
  console.error('Faltou BACKFILL_ADMIN_UID (firebase_uid de admin) em .env.local ou env.');
  process.exit(2);
}
if (!GAC) {
  console.error('Faltou GOOGLE_APPLICATION_CREDENTIALS.');
  process.exit(2);
}
if (!existsSync(GAC)) {
  console.error(`Arquivo nao encontrado: ${GAC}`);
  process.exit(2);
}

// ----------------------------------------------------------------------------
// Init Firebase Admin
// ----------------------------------------------------------------------------
const saContent = JSON.parse(readFileSync(GAC, 'utf8'));
const FIREBASE_PROJECT_ID = saContent.project_id;

if (!getApps().length) {
  initializeApp({ credential: cert(saContent) });
}
const firestore = getFirestore();

// ----------------------------------------------------------------------------
// Emit Supabase JWT HS256 com sub=ADMIN_UID (mesmo formato do get-supabase-token)
// ----------------------------------------------------------------------------
async function emitAdminJwt() {
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({
    sub: ADMIN_UID,
    role: 'authenticated',
    iss: 'supabase',
    ref: SUPABASE_REF,
    iat: now,
    exp: now + 3600,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .sign(new TextEncoder().encode(JWT_SECRET));
}

// ----------------------------------------------------------------------------
// Logger (file + stdout)
// ----------------------------------------------------------------------------
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const logPath = `/tmp/anest-backfill-pending-${ts}.log`;
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
// Helpers
// ----------------------------------------------------------------------------
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function listPending() {
  let query = firestore.collection('educacao_certificados');
  if (LIMIT) query = query.limit(LIMIT);
  const snap = await query.get();
  const pending = [];
  for (const docSnap of snap.docs) {
    const data = docSnap.data() || {};
    if (data.supabaseMigrated === true) continue;
    pending.push({
      id: docSnap.id,
      userId: typeof data.userId === 'string' ? data.userId : null,
      arquivoUrl: typeof data.arquivoUrl === 'string' ? data.arquivoUrl : null,
    });
  }
  return { total: snap.size, pending };
}

async function callBackfillEdge(jwt, { certId, userId, arquivoUrl }) {
  const url = `${SUPABASE_URL}/functions/v1/backfill-cert-supabase`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ certId, userId, arquivoUrl }),
  });
  const text = await resp.text().catch(() => '');
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return { ok: resp.ok, status: resp.status, body: parsed };
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------
async function main() {
  log('═══════════════════════════════════════════════════════════════════');
  log(`  ANEST Wave 1.9 — Force Backfill Pending Certs`);
  log(`  Mode: ${APPLY ? 'APPLY (mutate)' : 'DRY-RUN (read-only)'}`);
  log(`  Firebase project: ${FIREBASE_PROJECT_ID}    Supabase ref: ${SUPABASE_REF}`);
  log(`  Admin UID: ${ADMIN_UID.slice(0, 6)}…${ADMIN_UID.slice(-4)}`);
  log(`  Limit: ${LIMIT || 'no'}    Verbose: ${VERBOSE}`);
  log('═══════════════════════════════════════════════════════════════════');

  const startedAt = Date.now();

  log('\n[1/3] Listando pending no Firestore…');
  const { total, pending } = await listPending();
  log(`  total=${total}  pending=${pending.length}`);

  if (pending.length === 0) {
    log('\nNenhum certificado pending. Tudo já está migrado.');
    writeFileSync(logPath, logLines.join('\n') + '\n', 'utf8');
    log(`\nLog: ${logPath}`);
    process.exit(0);
  }

  if (!APPLY) {
    log('\n[2/3] DRY-RUN: listando o que seria feito.');
    pending.forEach((p) => {
      logVerbose(`WOULD BACKFILL: ${p.id} userId=${p.userId || 'NULL'} arquivoUrl=${p.arquivoUrl ? 'set' : 'MISSING'}`);
    });
    log(`\n  would_backfill=${pending.length}  missing_arquivo_url=${pending.filter((p) => !p.arquivoUrl).length}`);
    writeFileSync(logPath, logLines.join('\n') + '\n', 'utf8');
    log(`\nLog: ${logPath}`);
    log('\nEsta foi uma DRY-RUN. Para executar de fato, rode com --apply.');
    process.exit(0);
  }

  log('\n[2/3] Emitindo JWT admin…');
  const jwt = await emitAdminJwt();
  logVerbose('JWT emitido (HS256, exp=3600s)');

  log('\n[3/3] Backfill iniciando…');
  const stats = { ok: 0, fail: 0, skip_no_url: 0, skip_no_user: 0 };

  for (const p of pending) {
    if (!p.arquivoUrl) {
      stats.skip_no_url += 1;
      log(`SKIP ${p.id}: sem arquivoUrl (cert legacy sem PDF Firebase)`);
      continue;
    }
    if (!p.userId) {
      stats.skip_no_user += 1;
      log(`SKIP ${p.id}: sem userId`);
      continue;
    }

    try {
      const res = await callBackfillEdge(jwt, {
        certId: p.id,
        userId: p.userId,
        arquivoUrl: p.arquivoUrl,
      });
      if (!res.ok || !res.body?.ok) {
        stats.fail += 1;
        const reason = res.body?.reason || `http_${res.status}`;
        log(`FAIL ${p.id}: ${reason}`);
      } else {
        // Edge OK — agora atualiza Firestore via Admin SDK
        try {
          await firestore.doc(`educacao_certificados/${p.id}`).update({
            supabaseMigrated: true,
            supabaseMigratedAt: FieldValue.serverTimestamp(),
            supabaseMigratedBackfill: true,
          });
          stats.ok += 1;
          log(`OK   ${p.id} → ${res.body.path} (${res.body.sizeBytes} bytes)`);
        } catch (err) {
          stats.fail += 1;
          log(`FAIL ${p.id}: Edge OK mas Firestore write falhou: ${err.message}`);
        }
      }
    } catch (err) {
      stats.fail += 1;
      log(`FAIL ${p.id}: exception ${err.message}`);
    }

    await sleep(RATE_LIMIT_MS);
  }

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);

  log('\n═══════════════════════════════════════════════════════════════════');
  log(`  SUMMARY (${elapsedSec}s)`);
  log(`  pending=${pending.length}  ok=${stats.ok}  fail=${stats.fail}  skip_no_url=${stats.skip_no_url}  skip_no_user=${stats.skip_no_user}`);
  log('═══════════════════════════════════════════════════════════════════');

  writeFileSync(logPath, logLines.join('\n') + '\n', 'utf8');
  log(`\nLog: ${logPath}`);

  process.exit(stats.fail > 0 ? 2 : 0);
}

main().catch((err) => {
  console.error('\nFatal error:', err?.message || err);
  process.exit(1);
});

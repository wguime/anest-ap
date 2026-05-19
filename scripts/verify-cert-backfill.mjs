#!/usr/bin/env node
/**
 * scripts/verify-cert-backfill.mjs
 *
 * Wave 1.9 T1.9.1 — Audita o estado de migração dos certificados emitidos
 * (Firebase Storage legado → Supabase Storage).
 *
 * Lê a collection `educacao_certificados` no Firestore via Firebase Admin SDK,
 * lista os documentos cujo flag `supabaseMigrated` NÃO é `true` (false, null,
 * ou campo ausente). Esses são os certificados que ainda precisam de backfill
 * antes do bucket Firebase ser deletado.
 *
 * Default = DRY-RUN (lista pending). Modos:
 *
 * Flags:
 *   --verify    Exit 0 se pending=0 (gate para delete-firebase-cert-bucket).
 *               Exit 1 se houver pending > 0 (CI/script-friendly).
 *   --json      Output JSON apenas (sem progress logs em stderr).
 *   --limit=N   Processa no máximo N docs (debug; default = sem limite).
 *   --verbose   Log detalhado por documento.
 *
 * Pré-requisitos:
 *   GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase-anest-admin.json
 *
 * Uso:
 *   GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase-anest-admin.json \
 *     node scripts/verify-cert-backfill.mjs                # dry-run, lista pending
 *   GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase-anest-admin.json \
 *     node scripts/verify-cert-backfill.mjs --verify       # exit 0/1 gate
 *   GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase-anest-admin.json \
 *     node scripts/verify-cert-backfill.mjs --json         # JSON puro
 *
 * Saída:
 *   stdout: JSON com { total, migrated, pending: [...], missing_arquivo_url, ts }
 *   log file: /tmp/anest-verify-cert-backfill-{ts}.log
 *
 * Codes de saída:
 *   0 — sem pending (ou modo dry-run sem --verify; sempre 0 em sucesso)
 *   1 — --verify e pending > 0
 *   2 — erro fatal (env, Firebase auth, etc)
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ----------------------------------------------------------------------------
// CLI args
// ----------------------------------------------------------------------------
const args = process.argv.slice(2);
const VERIFY = args.includes('--verify');
const JSON_ONLY = args.includes('--json');
const VERBOSE = args.includes('--verbose');
const LIMIT = parseInt(
  (args.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || '0',
  10,
) || null;

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// ----------------------------------------------------------------------------
// Env
// ----------------------------------------------------------------------------
const GAC = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!GAC) {
  console.error('Faltou GOOGLE_APPLICATION_CREDENTIALS.');
  console.error('   Exemplo: GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase-anest-admin.json node scripts/verify-cert-backfill.mjs');
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
// Logger (file + stderr) — stdout fica reservado para JSON final
// ----------------------------------------------------------------------------
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const logPath = `/tmp/anest-verify-cert-backfill-${ts}.log`;
const logLines = [];

function info(msg) {
  logLines.push(msg);
  if (!JSON_ONLY) console.error(msg);
}
function verbose(msg) {
  logLines.push(`  ${msg}`);
  if (VERBOSE && !JSON_ONLY) console.error(`  ${msg}`);
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------
async function main() {
  info('═══════════════════════════════════════════════════════════════════');
  info(`  ANEST Wave 1.9 — Verify Cert Backfill`);
  info(`  Firebase project: ${FIREBASE_PROJECT_ID}`);
  info(`  Mode: ${VERIFY ? 'VERIFY (gate exit code)' : 'DRY-RUN (lista pending)'}`);
  info(`  Limit: ${LIMIT || 'no'}    Verbose: ${VERBOSE}`);
  info('═══════════════════════════════════════════════════════════════════');

  const startedAt = Date.now();

  // Firestore não suporta "OR" simples em where(). Estratégia: paginar TUDO
  // e filtrar in-memory por `data.supabaseMigrated !== true`.
  // Coleção `educacao_certificados` tem cardinalidade pequena (1 doc por
  // user+curso); paginação simples bastará.
  let query = firestore.collection('educacao_certificados');
  if (LIMIT) query = query.limit(LIMIT);
  const snap = await query.get();

  const total = snap.size;
  const pending = [];
  let migrated = 0;
  let missingArquivoUrl = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data() || {};
    if (data.supabaseMigrated === true) {
      migrated += 1;
      continue;
    }

    const userId = typeof data.userId === 'string' ? data.userId : null;
    const arquivoUrl = typeof data.arquivoUrl === 'string' ? data.arquivoUrl : null;
    if (!arquivoUrl) missingArquivoUrl += 1;

    const item = {
      id: docSnap.id,
      userId,
      arquivoUrl,
      missingArquivoUrl: !arquivoUrl,
      supabaseMigrated: data.supabaseMigrated ?? null,
    };
    pending.push(item);
    verbose(`PENDING: ${docSnap.id} userId=${userId || 'NULL'} arquivoUrl=${arquivoUrl ? 'set' : 'MISSING'}`);
  }

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);

  info('');
  info('═══════════════════════════════════════════════════════════════════');
  info(`  RESULT (${elapsedSec}s)`);
  info(`  total=${total}  migrated=${migrated}  pending=${pending.length}  missing_arquivo_url=${missingArquivoUrl}`);
  info('═══════════════════════════════════════════════════════════════════');

  const result = {
    total,
    migrated,
    pending,
    missing_arquivo_url: missingArquivoUrl,
    ts: new Date().toISOString(),
    firebase_project: FIREBASE_PROJECT_ID,
  };

  // Output JSON to stdout (machine-readable)
  console.log(JSON.stringify(result, null, JSON_ONLY ? 0 : 2));

  // Persist log file
  writeFileSync(logPath, logLines.join('\n') + '\n', 'utf8');
  if (!JSON_ONLY) console.error(`\nLog completo: ${logPath}`);

  // Exit code: --verify usa pending=0 como gate.
  if (VERIFY && pending.length > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('\nFatal error:', err?.message || err);
  process.exit(2);
});

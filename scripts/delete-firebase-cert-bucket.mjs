#!/usr/bin/env node
/**
 * scripts/delete-firebase-cert-bucket.mjs
 *
 * Wave 1.9 T1.9.9 — Deleta TODOS os arquivos em `gs://anest-ap.firebasestorage.app/certificados/`
 * do Firebase Storage. Operação destrutiva e irreversível.
 *
 * Pré-requisito ABSOLUTO: rodar `verify-cert-backfill.mjs --verify` antes —
 * se houver pending > 0, abortamos. Quem tira o gate é o caller (FASE 5 do
 * playbook). Este script DUPLA-CONFIRMA por garantia:
 *
 *   GATE 1: --apply é obrigatório (default = dry-run).
 *   GATE 2: execSync de verify-cert-backfill --verify, deve exit 0.
 *   GATE 3: prompt interativo. User precisa digitar "DELETE BUCKET" para
 *           confirmar a operação destrutiva.
 *
 * Default = DRY-RUN. Lista arquivos + bytes totais sem deletar.
 *
 * Flags:
 *   --apply     Executa o delete (após gates 2 + 3)
 *   --verbose   Log detalhado
 *
 * Pré-requisitos:
 *   GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase-anest-admin.json
 *
 * Uso:
 *   GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase-anest-admin.json \
 *     node scripts/delete-firebase-cert-bucket.mjs              # dry-run
 *   GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase-anest-admin.json \
 *     node scripts/delete-firebase-cert-bucket.mjs --apply
 *
 * Saída:
 *   /tmp/anest-delete-cert-bucket-{timestamp}.log
 *
 * ATENÇÃO: Este script NÃO é executado durante a wave de código. O delete
 * acontece manualmente em FASE 6 do playbook, depois que:
 *   - Wave 1.9 estiver em prod ≥ 24h
 *   - run-backfill-pending --apply tiver rodado com 0 errors
 *   - verify-cert-backfill --verify tiver retornado pending=0
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { createInterface } from 'readline';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

// ----------------------------------------------------------------------------
// CLI args
// ----------------------------------------------------------------------------
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const VERBOSE = args.includes('--verbose');

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// ----------------------------------------------------------------------------
// Env
// ----------------------------------------------------------------------------
const GAC = process.env.GOOGLE_APPLICATION_CREDENTIALS;
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
const STORAGE_BUCKET = process.env.FIREBASE_STORAGE_BUCKET || 'anest-ap.firebasestorage.app';

if (!getApps().length) {
  initializeApp({
    credential: cert(saContent),
    storageBucket: STORAGE_BUCKET,
  });
}
const bucket = getStorage().bucket();

// ----------------------------------------------------------------------------
// Logger (file + stdout)
// ----------------------------------------------------------------------------
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const logPath = `/tmp/anest-delete-cert-bucket-${ts}.log`;
const logLines = [];
function log(msg) {
  console.log(msg);
  logLines.push(`[${new Date().toISOString()}] ${msg}`);
}
function logVerbose(msg) {
  if (VERBOSE) console.log(`  ${msg}`);
  logLines.push(`[${new Date().toISOString()}]   ${msg}`);
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
function bytesPretty(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

async function listCertificadosFiles() {
  const [files] = await bucket.getFiles({ prefix: 'certificados/' });
  return files;
}

function promptUser(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function runVerifyGate() {
  // Tenta achar o script vizinho. Se path resolution falhar, escala.
  const verifyScript = resolve(__dirname, 'verify-cert-backfill.mjs');
  if (!existsSync(verifyScript)) {
    throw new Error(`verify-cert-backfill.mjs não encontrado em ${verifyScript}`);
  }
  log('\nGATE 2: chamando verify-cert-backfill.mjs --verify…');
  try {
    execSync(`node "${verifyScript}" --verify --json`, {
      env: process.env,
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    log('  PASSED — pending=0');
    return true;
  } catch (err) {
    log(`  FAILED — exit code ${err.status}. Pending > 0 ou erro no verify.`);
    return false;
  }
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------
async function main() {
  log('═══════════════════════════════════════════════════════════════════');
  log(`  ANEST Wave 1.9 — DELETE Firebase Storage cert bucket`);
  log(`  Bucket: gs://${STORAGE_BUCKET}/certificados/`);
  log(`  Firebase project: ${FIREBASE_PROJECT_ID}`);
  log(`  Mode: ${APPLY ? 'APPLY (DESTRUCTIVE)' : 'DRY-RUN (list only)'}`);
  log('═══════════════════════════════════════════════════════════════════');

  log('\n[1/4] Listando arquivos em certificados/…');
  const files = await listCertificadosFiles();
  let totalBytes = 0;
  for (const f of files) {
    const size = parseInt(f.metadata?.size || 0, 10);
    totalBytes += size;
    logVerbose(`  ${f.name} (${bytesPretty(size)})`);
  }
  log(`  total=${files.length} files, ${bytesPretty(totalBytes)}`);

  if (files.length === 0) {
    log('\nBucket já vazio. Nada a deletar.');
    writeFileSync(logPath, logLines.join('\n') + '\n', 'utf8');
    log(`\nLog: ${logPath}`);
    process.exit(0);
  }

  if (!APPLY) {
    log('\nDRY-RUN: nenhum arquivo foi deletado.');
    log('Para deletar de fato, rode com --apply (vai pedir confirmação dupla).');
    writeFileSync(logPath, logLines.join('\n') + '\n', 'utf8');
    log(`\nLog: ${logPath}`);
    process.exit(0);
  }

  // GATE 2: verify --verify
  log('\n[2/4] Verificando pré-requisito: backfill completo…');
  const gateOk = runVerifyGate();
  if (!gateOk) {
    log('\nABORT: rode `verify-cert-backfill --verify` para listar pending,');
    log('       depois `run-backfill-pending --apply` para forçar backfill.');
    writeFileSync(logPath, logLines.join('\n') + '\n', 'utf8');
    log(`\nLog: ${logPath}`);
    process.exit(1);
  }

  // GATE 3: prompt interativo
  log('\n[3/4] CONFIRMAÇÃO FINAL — operação destrutiva e irreversível.');
  log(`Você está prestes a deletar ${files.length} arquivos (${bytesPretty(totalBytes)})`);
  log(`do bucket gs://${STORAGE_BUCKET}/certificados/`);
  const answer = await promptUser("\nDigite 'DELETE BUCKET' (em maiúsculas) para confirmar: ");
  if (answer.trim() !== 'DELETE BUCKET') {
    log(`\nABORT: confirmação inválida (recebido: "${answer.slice(0, 50)}")`);
    writeFileSync(logPath, logLines.join('\n') + '\n', 'utf8');
    log(`\nLog: ${logPath}`);
    process.exit(1);
  }
  log('  Confirmação aceita.');

  // [4/4] DELETE
  log('\n[4/4] Deletando arquivos…');
  const startedAt = Date.now();
  try {
    // Usa deleteFiles com prefix — atômico do ponto de vista do caller.
    // Cada arquivo individual é logado pela GCP audit log, então temos
    // trilha externa adicional.
    await bucket.deleteFiles({ prefix: 'certificados/' });
    const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
    log(`\nDeleted ${files.length} files em ${elapsedSec}s.`);
    // Log individual de cada arquivo (pós-delete, persistido)
    for (const f of files) {
      logLines.push(`[${new Date().toISOString()}] DELETED ${f.name}`);
    }
  } catch (err) {
    log(`\nERRO no delete: ${err.message}`);
    writeFileSync(logPath, logLines.join('\n') + '\n', 'utf8');
    log(`\nLog: ${logPath}`);
    process.exit(2);
  }

  log('\n═══════════════════════════════════════════════════════════════════');
  log(`  COMPLETED — ${files.length} arquivos deletados (${bytesPretty(totalBytes)})`);
  log('═══════════════════════════════════════════════════════════════════');

  writeFileSync(logPath, logLines.join('\n') + '\n', 'utf8');
  log(`\nLog completo: ${logPath}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('\nFatal error:', err?.message || err);
  process.exit(2);
});

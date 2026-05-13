#!/usr/bin/env node
/**
 * scripts/seed-firebase.mjs
 *
 * Sprint 21 Wave 2.1 — Seed de mock data Firebase (Auth + Firestore) para DEV.
 *
 * Cria:
 *   - 1 admin (seed-admin-001) + 3 staff (seed-staff-{001..003}) em Firebase Auth.
 *   - userProfiles/{uid} para cada user.
 *   - 3 reunioes (agendada, em_andamento, concluida) em Firestore.
 *   - 1 ata em reuniao_documentos (metadata-only) para a reunião concluída.
 *
 * IDEMPOTENTE: tratamentos try/catch para `auth/uid-already-exists` e
 * `set({merge:true})` para Firestore — pode rodar várias vezes.
 *
 * Default = DRY-RUN. Use --apply para executar.
 *
 * Flags:
 *   --apply       Executa mutações (default dry-run)
 *   --reset       Apaga docs das collections antes de criar (DEV ONLY)
 *   --verbose     Log detalhado
 *
 * Pré-requisitos:
 *   GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase-anest-admin.json
 *
 * Uso:
 *   GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase-anest-admin.json \
 *     node scripts/seed-firebase.mjs              # dry-run
 *   GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase-anest-admin.json \
 *     node scripts/seed-firebase.mjs --apply
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// ----------------------------------------------------------------------------
// CLI args
// ----------------------------------------------------------------------------
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const RESET = args.includes('--reset');
const VERBOSE = args.includes('--verbose');

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

const GAC = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!GAC) {
  console.error('Faltou GOOGLE_APPLICATION_CREDENTIALS.');
  console.error('   Exemplo: GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase-anest-admin.json node scripts/seed-firebase.mjs');
  process.exit(1);
}
if (!existsSync(GAC)) {
  console.error(`Arquivo não encontrado: ${GAC}`);
  process.exit(1);
}

// ----------------------------------------------------------------------------
// Init Firebase Admin
// ----------------------------------------------------------------------------
const saContent = JSON.parse(readFileSync(GAC, 'utf8'));
const FIREBASE_PROJECT_ID = saContent.project_id;

// Reset guardrail: NUNCA permitir --reset em projeto que parece prod.
// Projeto 'anest-ap' (Firebase real) é PROD. Bloqueamos --reset nele
// independente de quem chame — explicit allowlist.
const DEV_PROJECT_ALLOWLIST = (envVars.SEED_DEV_PROJECTS || '').split(',').map((s) => s.trim()).filter(Boolean);

if (RESET) {
  console.warn('═══════════════════════════════════════════════════════════════');
  console.warn('  WARNING: --reset apaga docs seed em Firestore + Auth.');
  console.warn(`  Projeto Firebase: ${FIREBASE_PROJECT_ID}`);
  console.warn('═══════════════════════════════════════════════════════════════');

  if (!DEV_PROJECT_ALLOWLIST.includes(FIREBASE_PROJECT_ID)) {
    console.error(`Projeto "${FIREBASE_PROJECT_ID}" NÃO está em SEED_DEV_PROJECTS allowlist.`);
    console.error('   Para habilitar --reset, adicione em .env.local:');
    console.error(`     SEED_DEV_PROJECTS=${FIREBASE_PROJECT_ID}`);
    console.error('   --reset é SOMENTE para projetos DEV/staging.');
    process.exit(1);
  }
}

if (!getApps().length) {
  initializeApp({ credential: cert(saContent) });
}
const firestore = getFirestore();
const auth = getAuth();

// ----------------------------------------------------------------------------
// Logger
// ----------------------------------------------------------------------------
function log(msg) { console.log(msg); }
function logVerbose(msg) { if (VERBOSE) console.log(`  ${msg}`); }

// ----------------------------------------------------------------------------
// Seed data definitions
// ----------------------------------------------------------------------------
const SEED_USERS = [
  {
    uid: 'seed-admin-001',
    email: 'admin@seed.local',
    displayName: 'Admin Seed',
    password: 'Seed@2026!',
    profile: {
      nome: 'Admin Seed',
      email: 'admin@seed.local',
      role: 'administrador',
      isAdmin: true,
      cargo: 'Diretor Técnico',
      setor: 'Direção Técnica',
    },
  },
  {
    uid: 'seed-staff-001',
    email: 'staff1@seed.local',
    displayName: 'Staff Seed 1',
    password: 'Seed@2026!',
    profile: {
      nome: 'Staff Seed 1',
      email: 'staff1@seed.local',
      role: 'colaborador',
      isAdmin: false,
      cargo: 'Anestesiologista',
      setor: 'Equipe Anest',
    },
  },
  {
    uid: 'seed-staff-002',
    email: 'staff2@seed.local',
    displayName: 'Staff Seed 2',
    password: 'Seed@2026!',
    profile: {
      nome: 'Staff Seed 2',
      email: 'staff2@seed.local',
      role: 'colaborador',
      isAdmin: false,
      cargo: 'Anestesiologista',
      setor: 'Equipe Anest',
    },
  },
  {
    uid: 'seed-staff-003',
    email: 'staff3@seed.local',
    displayName: 'Staff Seed 3',
    password: 'Seed@2026!',
    profile: {
      nome: 'Staff Seed 3',
      email: 'staff3@seed.local',
      role: 'colaborador',
      isAdmin: false,
      cargo: 'Anestesiologista',
      setor: 'Equipe Anest',
    },
  },
];

const SEED_REUNIOES = [
  {
    id: 'reuniao-seed-001',
    titulo: 'Reunião Mensal — Comitê Executivo (seed agendada)',
    tipo: 'comite_executivo',
    status: 'agendada',
    dataInicioISO: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    local: 'Sala de Reuniões 01',
    criadoPor: 'seed-admin-001',
    criadoPorNome: 'Admin Seed',
  },
  {
    id: 'reuniao-seed-002',
    titulo: 'Reunião — Análise de Incidentes (seed em_andamento)',
    tipo: 'analise_incidentes',
    status: 'em_andamento',
    dataInicioISO: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    local: 'Sala de Reuniões 02',
    criadoPor: 'seed-admin-001',
    criadoPorNome: 'Admin Seed',
  },
  {
    id: 'reuniao-seed-003',
    titulo: 'Reunião — Conselho Técnico (seed concluída)',
    tipo: 'conselho_tecnico',
    status: 'concluida',
    dataInicioISO: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    local: 'Sala de Reuniões 01',
    criadoPor: 'seed-admin-001',
    criadoPorNome: 'Admin Seed',
  },
];

const SEED_REUNIAO_DOCS = [
  {
    id: 'reuniao-doc-seed-001',
    reuniaoId: 'reuniao-seed-003',
    tipoDocumento: 'ata',
    titulo: 'Ata Seed — Conselho Técnico',
    arquivoNome: 'ata_conselho_tecnico_seed.pdf',
    arquivoUrl: 'about:blank',
    storageProvider: 'supabase',
    storageBucket: 'reuniao-atas',
    storagePath: 'reuniao-seed-003/seed_ata_conselho_tecnico.pdf',
    uploadedBy: 'seed-admin-001',
    uploadedByName: 'Admin Seed',
  },
];

// ----------------------------------------------------------------------------
// Reset (DEV only)
// ----------------------------------------------------------------------------
async function resetCollections() {
  log('\n━━━ RESET: apagando docs seed ━━━');
  const stats = { authDeleted: 0, profilesDeleted: 0, reunioesDeleted: 0, reuniaoDocsDeleted: 0 };

  if (!APPLY) {
    log('  DRY-RUN: pulando reset efetivo. Use --apply --reset para executar.');
    return stats;
  }

  // Apaga Firebase Auth users (apenas os UIDs seed)
  for (const u of SEED_USERS) {
    try {
      await auth.deleteUser(u.uid);
      stats.authDeleted += 1;
      logVerbose(`auth.deleteUser ok: ${u.uid}`);
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        logVerbose(`auth user not found (ok): ${u.uid}`);
      } else {
        log(`auth.deleteUser falhou ${u.uid}: ${err.message}`);
      }
    }
  }

  // Apaga userProfiles seed
  for (const u of SEED_USERS) {
    try {
      await firestore.doc(`userProfiles/${u.uid}`).delete();
      stats.profilesDeleted += 1;
    } catch (err) {
      logVerbose(`userProfiles delete ${u.uid}: ${err.message}`);
    }
  }

  // Apaga reuniao_documentos seed
  for (const d of SEED_REUNIAO_DOCS) {
    try {
      await firestore.doc(`reuniao_documentos/${d.id}`).delete();
      stats.reuniaoDocsDeleted += 1;
    } catch (err) {
      logVerbose(`reuniao_documentos delete ${d.id}: ${err.message}`);
    }
  }

  // Apaga reunioes seed
  for (const r of SEED_REUNIOES) {
    try {
      await firestore.doc(`reunioes/${r.id}`).delete();
      stats.reunioesDeleted += 1;
    } catch (err) {
      logVerbose(`reunioes delete ${r.id}: ${err.message}`);
    }
  }

  log(`  authDeleted=${stats.authDeleted} profilesDeleted=${stats.profilesDeleted} reunioesDeleted=${stats.reunioesDeleted} reuniaoDocsDeleted=${stats.reuniaoDocsDeleted}`);
  return stats;
}

// ----------------------------------------------------------------------------
// Seed users (Auth + userProfiles)
// ----------------------------------------------------------------------------
async function seedUsers() {
  log('\n━━━ STREAM 1: Firebase Auth + userProfiles ━━━');
  const stats = { authCreated: 0, authSkipped: 0, profileWritten: 0, errors: 0, wouldCreate: 0 };

  for (const u of SEED_USERS) {
    if (!APPLY) {
      stats.wouldCreate += 1;
      logVerbose(`WOULD CREATE auth+profile: ${u.uid} (${u.email})`);
      continue;
    }

    // Auth user (idempotente)
    try {
      await auth.createUser({
        uid: u.uid,
        email: u.email,
        displayName: u.displayName,
        password: u.password,
        emailVerified: true,
      });
      stats.authCreated += 1;
      log(`auth.createUser: ${u.uid} (${u.email})`);
    } catch (err) {
      if (err.code === 'auth/uid-already-exists' || err.code === 'auth/email-already-exists') {
        stats.authSkipped += 1;
        logVerbose(`auth user já existe (ok): ${u.uid}`);
      } else {
        stats.errors += 1;
        log(`auth.createUser falhou ${u.uid}: ${err.message}`);
        continue;
      }
    }

    // Firestore profile (set merge = idempotente)
    try {
      await firestore.doc(`userProfiles/${u.uid}`).set({
        ...u.profile,
        uid: u.uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        seedSource: 'seed-firebase.mjs',
      }, { merge: true });
      stats.profileWritten += 1;
    } catch (err) {
      stats.errors += 1;
      log(`userProfiles set falhou ${u.uid}: ${err.message}`);
    }
  }

  log(`  authCreated=${stats.authCreated} authSkipped=${stats.authSkipped} profileWritten=${stats.profileWritten} wouldCreate=${stats.wouldCreate} errors=${stats.errors}`);
  return stats;
}

// ----------------------------------------------------------------------------
// Seed reunioes + ata em reuniao_documentos
// ----------------------------------------------------------------------------
async function seedReunioes() {
  log('\n━━━ STREAM 2: reunioes + reuniao_documentos ━━━');
  const stats = { reunioesWritten: 0, reuniaoDocsWritten: 0, errors: 0, wouldWrite: 0 };

  for (const r of SEED_REUNIOES) {
    if (!APPLY) {
      stats.wouldWrite += 1;
      logVerbose(`WOULD WRITE reuniao: ${r.id}`);
      continue;
    }
    try {
      await firestore.doc(`reunioes/${r.id}`).set({
        ...r,
        dataInicio: new Date(r.dataInicioISO),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        seedSource: 'seed-firebase.mjs',
      }, { merge: true });
      stats.reunioesWritten += 1;
      log(`reuniao gravada: ${r.id} (${r.status})`);
    } catch (err) {
      stats.errors += 1;
      log(`reunioes set falhou ${r.id}: ${err.message}`);
    }
  }

  for (const d of SEED_REUNIAO_DOCS) {
    if (!APPLY) {
      stats.wouldWrite += 1;
      logVerbose(`WOULD WRITE reuniao_documento: ${d.id}`);
      continue;
    }
    try {
      await firestore.doc(`reuniao_documentos/${d.id}`).set({
        ...d,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        seedSource: 'seed-firebase.mjs',
      }, { merge: true });
      stats.reuniaoDocsWritten += 1;
      log(`reuniao_documento gravado: ${d.id} (${d.tipoDocumento})`);
    } catch (err) {
      stats.errors += 1;
      log(`reuniao_documentos set falhou ${d.id}: ${err.message}`);
    }
  }

  log(`  reunioesWritten=${stats.reunioesWritten} reuniaoDocsWritten=${stats.reuniaoDocsWritten} wouldWrite=${stats.wouldWrite} errors=${stats.errors}`);
  return stats;
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------
async function main() {
  log('═══════════════════════════════════════════════════════════════════');
  log(`  ANEST Sprint 21 Wave 2.1 — Seed Firebase (Auth + Firestore)`);
  log(`  Mode: ${APPLY ? 'APPLY (mutate)' : 'DRY-RUN (read-only)'}`);
  log(`  Reset: ${RESET ? 'YES' : 'no'}    Verbose: ${VERBOSE}`);
  log(`  Firebase project: ${FIREBASE_PROJECT_ID}`);
  log('═══════════════════════════════════════════════════════════════════');

  const startedAt = Date.now();
  const allStats = {};

  if (RESET) {
    allStats.reset = await resetCollections();
  }
  allStats.users = await seedUsers();
  allStats.reunioes = await seedReunioes();

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);

  log('\n═══════════════════════════════════════════════════════════════════');
  log(`  SUMMARY (${elapsedSec}s)`);
  for (const [stream, s] of Object.entries(allStats)) {
    log(`  ${stream.padEnd(10)} ${JSON.stringify(s)}`);
  }
  log('═══════════════════════════════════════════════════════════════════');
  if (!APPLY) {
    log('\nDRY-RUN — rode com --apply para executar.');
  }

  const anyErrors = Object.values(allStats).some((s) => (s.errors || 0) > 0);
  process.exit(anyErrors ? 2 : 0);
}

main().catch((err) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});

/**
 * Deleta DEFINITIVAMENTE um usuario do Firebase Auth (por UID).
 *
 * Contexto: o Firebase MCP nao expoe delete de Auth (so get/update). A usuaria ja
 * teve profiles + authorized_emails (Supabase) + userProfiles (Firestore) removidos e
 * a conta Auth foi DESABILITADA via MCP. Este script remove o registro Auth restante.
 *
 * Requer GOOGLE_APPLICATION_CREDENTIALS apontando para service-account JSON,
 * OU Application Default Credentials (gcloud auth application-default login).
 * (mesmo padrao de scripts/update-erlei-firebase-email.mjs)
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json node scripts/delete-firebase-auth-user.mjs
 *
 * Idempotente: se o usuario ja nao existe, sai limpo (codigo auth/user-not-found).
 * Seguranca: so deleta se a conta estiver DISABLED e o email bater com EXPECTED_EMAIL.
 */
import { readFileSync, existsSync } from 'fs';
import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Alvo: rosangela_msilva1 (exclusao pedida pelo admin 2026-05-28)
const TARGET_UID = 'EH5VZNApzEgUUCHoELLJUlIEpVB3';
const EXPECTED_EMAIL = 'rosangela_msilva1@outlook.com';

const GAC = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!getApps().length) {
  if (GAC && existsSync(GAC)) {
    const sa = JSON.parse(readFileSync(GAC, 'utf8'));
    initializeApp({ credential: cert(sa) });
    console.log(`Initialized firebase-admin via GAC: ${GAC}`);
  } else {
    try {
      initializeApp({ credential: applicationDefault() });
      console.log('Initialized firebase-admin via Application Default Credentials');
    } catch (err) {
      console.error('FALHA: nem GOOGLE_APPLICATION_CREDENTIALS nem ADC disponiveis.');
      console.error('Setar GAC: GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json');
      console.error('OU rodar: gcloud auth application-default login');
      console.error('Erro original:', err.message);
      process.exit(1);
    }
  }
}

const auth = getAuth();

try {
  let before;
  try {
    before = await auth.getUser(TARGET_UID);
  } catch (e) {
    if (e.code === 'auth/user-not-found') {
      console.log('✅ Usuario ja nao existe no Firebase Auth. Nada a fazer.');
      process.exit(0);
    }
    throw e;
  }

  console.log('=== Snapshot antes ===');
  console.log(`  uid: ${before.uid}`);
  console.log(`  email: ${before.email}`);
  console.log(`  displayName: ${before.displayName}`);
  console.log(`  disabled: ${before.disabled}`);

  // Guardas de seguranca: so deleta a conta certa, e so se ja estiver desabilitada.
  if (before.email !== EXPECTED_EMAIL) {
    console.error(`\n⚠️  Email atual ("${before.email}") != EXPECTED_EMAIL ("${EXPECTED_EMAIL}"). Abortando.`);
    process.exit(1);
  }
  if (!before.disabled) {
    console.error('\n⚠️  Conta NAO esta desabilitada. Abortando por seguranca (esperado: disabled=true).');
    process.exit(1);
  }

  console.log(`\n=== Deletando ${EXPECTED_EMAIL} (uid ${TARGET_UID}) ===`);
  await auth.deleteUser(TARGET_UID);
  console.log('✅ Usuario deletado do Firebase Auth.');
  console.log('\nDeleção completa: Supabase (profiles + authorized_emails) + Firestore + Firebase Auth.');
} catch (err) {
  console.error('\n❌ ERR:', err.message, err.code || '');
  process.exit(1);
}

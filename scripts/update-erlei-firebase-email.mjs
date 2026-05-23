/**
 * Atualiza email do user Erlei no Firebase Auth (mantém UID).
 * Pedido user 2026-05-23 — caminho A do correção de typo clinicastelo → clinicacastelo.
 *
 * Requer GOOGLE_APPLICATION_CREDENTIALS apontando para service-account JSON.
 * (mesmo padrão de scripts/delete-firebase-cert-bucket.mjs).
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json node scripts/update-erlei-firebase-email.mjs
 *
 * Idempotente: se o email já estiver atualizado, sai limpo.
 */
import { readFileSync, existsSync } from 'fs';
import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const ERLEI_UID = 'zgiKSWgcRcYnfanHzC5QVcvkmDJ3';
const NEW_EMAIL = 'erlei@clinicacastelo.com.br';
const OLD_EMAIL = 'erlei@clinicastelo.com.br';

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
      console.error('FALHA: nem GOOGLE_APPLICATION_CREDENTIALS nem ADC disponíveis.');
      console.error('Setar GAC: GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json');
      console.error('OU rodar: gcloud auth application-default login');
      console.error('Erro original:', err.message);
      process.exit(1);
    }
  }
}

const auth = getAuth();

console.log(`\n=== Snapshot antes ===`);
try {
  const before = await auth.getUser(ERLEI_UID);
  console.log(`  uid: ${before.uid}`);
  console.log(`  email: ${before.email}`);
  console.log(`  displayName: ${before.displayName}`);
  console.log(`  emailVerified: ${before.emailVerified}`);
  console.log(`  disabled: ${before.disabled}`);
  console.log(`  providers: ${before.providerData.map(p => `${p.providerId}:${p.email || p.uid}`).join(', ')}`);

  if (before.email === NEW_EMAIL) {
    console.log('\n✅ Email já está correto. Nada a fazer.');
    process.exit(0);
  }

  if (before.email !== OLD_EMAIL) {
    console.error(`\n⚠️  Email atual ("${before.email}") não bate com OLD_EMAIL ("${OLD_EMAIL}"). Abortando por segurança.`);
    process.exit(1);
  }

  console.log(`\n=== Atualizando para ${NEW_EMAIL} ===`);
  const after = await auth.updateUser(ERLEI_UID, {
    email: NEW_EMAIL,
    emailVerified: true,
  });
  console.log(`  ✅ email atualizado: ${after.email}`);
  console.log(`  emailVerified: ${after.emailVerified}`);
  console.log(`  providers após: ${after.providerData.map(p => `${p.providerId}:${p.email || p.uid}`).join(', ')}`);

  console.log('\n=== DONE ===');
  console.log('Erlei agora loga com:', NEW_EMAIL);
  console.log('Mesmo UID:', ERLEI_UID);
  console.log('Profile + authorized_emails no Supabase já estavam corretos.');
} catch (err) {
  console.error('\n❌ ERR:', err.message, err.code || '');
  process.exit(1);
}

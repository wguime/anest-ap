/**
 * Troca o e-mail de login da RAQUEL SCHNEIDER FELICIANI e redefine a senha padrão.
 * Pedido do dono 2026-08-24.
 *
 * O e-mail é chave de identidade em 6 lugares. Este script cobre os 4 do Google:
 *   1. Firebase Auth (login)             — email + emailVerified + password
 *   2. Firestore userProfiles/{uid}      — fonte da verdade do perfil
 *   3. Firestore users/{uid}             — espelho legado
 *   4. Firestore authorized_emails/{email} — ⚠️ o ID DO DOC é o próprio e-mail:
 *      não dá para "editar", tem de criar o novo e apagar o velho.
 * Os outros 2 (Supabase profiles.email e authorized_emails.email) vão por SQL
 * via scripts/deploy-sp21-mgmt-api.mjs — sem eles o pré-check de login
 * (rpc_is_email_authorized) recusa o e-mail novo.
 *
 * Credencial: GOOGLE_APPLICATION_CREDENTIALS (service-account do anest-ap), mesmo
 * padrão de update-erlei-firebase-email.mjs e reset-aline-password.mjs. Nunca impresso.
 *
 * Uso:
 *   GOOGLE_APPLICATION_CREDENTIALS=/caminho/sa.json node scripts/update-raquel-email.mjs           # read-only
 *   GOOGLE_APPLICATION_CREDENTIALS=/caminho/sa.json node scripts/update-raquel-email.mjs --apply   # aplica
 *
 * Guardas: aborta se o projeto não for anest-ap, se o uid não existir, se o nome
 * não bater ou se o e-mail atual não for o esperado. Idempotente: rodar de novo
 * com o e-mail já trocado só reaplica a senha e completa o que faltou.
 */
import { readFileSync, existsSync } from 'fs';
import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');

const EXPECTED_PROJECT = 'anest-ap';
const UID = 'Mrvu97vM8DamJVBdwsQMKth1I533';
const OLD_EMAIL = 'raquel_schneider_12@hotmail.com';
const NEW_EMAIL = 'schneiderraquel17@gmail.com';
const NEW_PASSWORD = '123456';
const NOME_ESPERADO = 'RAQUEL';

const GAC = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!getApps().length) {
  if (GAC && existsSync(GAC)) {
    const sa = JSON.parse(readFileSync(GAC, 'utf8'));
    if (sa.project_id !== EXPECTED_PROJECT) {
      console.error(`FALHA: service-account é do projeto "${sa.project_id}", esperado "${EXPECTED_PROJECT}". Abortando.`);
      process.exit(1);
    }
    initializeApp({ credential: cert(sa), projectId: EXPECTED_PROJECT });
    console.log(`Credencial: service-account do projeto ${sa.project_id}`);
  } else {
    try {
      initializeApp({ credential: applicationDefault(), projectId: EXPECTED_PROJECT });
      console.log('Credencial: Application Default Credentials');
    } catch (err) {
      console.error('FALHA: nem GOOGLE_APPLICATION_CREDENTIALS nem ADC disponíveis.');
      console.error('  GOOGLE_APPLICATION_CREDENTIALS=/caminho/sa.json node scripts/update-raquel-email.mjs');
      console.error('Erro original:', err.message);
      process.exit(1);
    }
  }
}

// ⚠️ keepalive: sem um timer segurando o event loop, o Node encerra no meio de uma
// chamada pendente do Firestore ("unsettled top-level await") e a escrita sai pela metade.
const keepalive = setInterval(() => {}, 1000);

const auth = getAuth();
const db = getFirestore();

const emailsDe = (data) =>
  Object.entries(data ?? {})
    .filter(([, v]) => typeof v === 'string' && v.includes('@'))
    .map(([k, v]) => `${k} = ${v}`);

async function main() {
  // ---------------- snapshot ----------------
  console.log('\n=== 1. Firebase Auth (antes) ===');
  const user = await auth.getUser(UID);
  console.log(`  uid............: ${user.uid}`);
  console.log(`  email..........: ${user.email}`);
  console.log(`  displayName....: ${user.displayName || '(vazio)'}`);
  console.log(`  emailVerified..: ${user.emailVerified}`);
  console.log(`  disabled.......: ${user.disabled}`);
  console.log(`  providers......: ${user.providerData.map((p) => p.providerId).join(', ') || '(nenhum)'}`);
  console.log(`  lastSignIn.....: ${user.metadata.lastSignInTime || '(nunca)'}`);

  const hay = `${user.displayName || ''} ${user.email || ''}`.toUpperCase();
  if (!hay.includes(NOME_ESPERADO)) {
    throw new Error(`Conta não parece ser da Raquel (esperado conter "${NOME_ESPERADO}").`);
  }
  const jaMigrado = user.email === NEW_EMAIL;
  if (!jaMigrado && user.email !== OLD_EMAIL) {
    throw new Error(`E-mail atual ("${user.email}") não bate com o esperado ("${OLD_EMAIL}").`);
  }

  const perfilRef = db.collection('userProfiles').doc(UID);
  const usersRef = db.collection('users').doc(UID);
  const autOldRef = db.collection('authorized_emails').doc(OLD_EMAIL);
  const autNewRef = db.collection('authorized_emails').doc(NEW_EMAIL);

  const [perfil, legado, autOld, autNew] = await Promise.all([
    perfilRef.get(), usersRef.get(), autOldRef.get(), autNewRef.get(),
  ]);

  console.log('\n=== 2. Firestore userProfiles/{uid} (antes) ===');
  console.log(perfil.exists ? `  ${emailsDe(perfil.data()).join(' · ') || '(sem campo de e-mail)'}` : '  (não existe)');

  console.log('\n=== 3. Firestore users/{uid} (antes) ===');
  console.log(legado.exists ? `  ${emailsDe(legado.data()).join(' · ') || '(sem campo de e-mail)'}` : '  (não existe)');

  console.log('\n=== 4. Firestore authorized_emails/{email} (antes) ===');
  console.log(`  doc antigo "${OLD_EMAIL}": ${autOld.exists ? JSON.stringify(autOld.data()) : '(não existe)'}`);
  console.log(`  doc novo   "${NEW_EMAIL}": ${autNew.exists ? JSON.stringify(autNew.data()) : '(não existe)'}`);

  if (!APPLY) {
    console.log('\n(read-only) Rode com --apply para trocar o e-mail e redefinir a senha.');
    return;
  }

  // ---------------- apply ----------------
  console.log(`\n=== Aplicando: ${user.email} → ${NEW_EMAIL} ===`);

  const depois = await auth.updateUser(UID, {
    email: NEW_EMAIL,
    emailVerified: true,
    password: NEW_PASSWORD,
  });
  console.log(`  ✅ 1. Firebase Auth: ${depois.email} (emailVerified: ${depois.emailVerified}, senha redefinida)`);

  if (perfil.exists) {
    await perfilRef.update({ email: NEW_EMAIL, updatedAt: new Date().toISOString() });
    console.log(`  ✅ 2. userProfiles/${UID}.email = ${(await perfilRef.get()).data().email}`);
  } else {
    console.log('  ⏭️  2. userProfiles: doc inexistente, nada a fazer');
  }

  if (legado.exists) {
    const campos = Object.entries(legado.data())
      .filter(([, v]) => v === OLD_EMAIL)
      .map(([k]) => k);
    if (campos.length) {
      await usersRef.update(Object.fromEntries(campos.map((k) => [k, NEW_EMAIL])));
      console.log(`  ✅ 3. users/${UID}: campo(s) ${campos.join(', ')} → ${NEW_EMAIL}`);
    } else {
      console.log('  ⏭️  3. users: nenhum campo com o e-mail antigo');
    }
  } else {
    console.log('  ⏭️  3. users: doc inexistente, nada a fazer');
  }

  if (autOld.exists) {
    // O ID do doc É o e-mail: recria com o mesmo conteúdo sob o id novo e apaga o velho.
    await autNewRef.set({ ...autOld.data(), email: NEW_EMAIL });
    await autOldRef.delete();
    console.log(`  ✅ 4. authorized_emails: doc "${NEW_EMAIL}" criado, "${OLD_EMAIL}" apagado`);
  } else if (autNew.exists) {
    console.log('  ⏭️  4. authorized_emails: já estava no e-mail novo');
  } else {
    console.log('  ⚠️  4. authorized_emails: nenhum doc encontrado nos dois e-mails');
  }

  console.log('\n=== DONE (Google) ===');
  console.log(`Login novo: ${NEW_EMAIL}  ·  uid inalterado: ${UID}`);
  console.log('Falta o Supabase: profiles.email + authorized_emails.email.');
}

try {
  await main();
} catch (err) {
  console.error(`\n❌ ${err.message} ${err.code || ''}`);
  process.exitCode = 1;
} finally {
  clearInterval(keepalive);
}

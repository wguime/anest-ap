/**
 * Read-only: procura o e-mail ANTIGO da Raquel em todas as coleções do Firestore
 * e confere se o e-mail NOVO já está em uso no Firebase Auth.
 *
 * Por quê: em Escalas & Trocas a identidade é resolvida por E-MAIL (não por uid),
 * então trocar o login pode órfãr registros históricos. Antes de aplicar, saber
 * onde o texto aparece — inclusive em ID de documento (a coleção authorized_emails
 * usa o próprio e-mail como id).
 *
 * ⚠️ keepalive: sem um timer segurando o event loop, o Node encerra no meio de um
 * `col.get()` pendente ("unsettled top-level await") e a varredura sai incompleta.
 *
 * Uso: GOOGLE_APPLICATION_CREDENTIALS=/caminho/sa.json node scripts/diag-raquel-email-refs.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const OLD_EMAIL = 'raquel_schneider_12@hotmail.com';
const NEW_EMAIL = 'schneiderraquel17@gmail.com';
const UID = 'Mrvu97vM8DamJVBdwsQMKth1I533';

const GAC = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!GAC || !existsSync(GAC)) {
  console.error('FALHA: GOOGLE_APPLICATION_CREDENTIALS ausente.');
  process.exit(1);
}
if (!getApps().length) initializeApp({ credential: cert(JSON.parse(readFileSync(GAC, 'utf8'))) });

const keepalive = setInterval(() => {}, 1000);

const auth = getAuth();
const db = getFirestore();

async function main() {
  console.log('=== E-mail novo já está em uso no Firebase Auth? ===');
  try {
    const dono = await auth.getUserByEmail(NEW_EMAIL);
    console.log(`  ⚠️  SIM — uid ${dono.uid} (${dono.displayName || 'sem nome'})`);
    if (dono.uid !== UID) console.log('  ⚠️  É OUTRA conta. Trocar causaria conflito (EMAIL_EXISTS).');
  } catch (err) {
    if (err.code === 'auth/user-not-found') console.log('  ✅ Não — e-mail livre.');
    else console.log(`  (erro) ${err.message}`);
  }

  console.log('\n=== Ocorrências do e-mail antigo no Firestore ===');
  const cols = await db.listCollections();
  console.log(`  (varrendo ${cols.length} coleções de topo)\n`);
  let total = 0;
  for (const col of cols) {
    let snap;
    try {
      snap = await col.get();
    } catch (err) {
      console.log(`  ${col.id}: (erro ao ler) ${err.message}`);
      continue;
    }
    const hits = [];
    for (const doc of snap.docs) {
      const noId = doc.id.includes(OLD_EMAIL);
      const noCorpo = JSON.stringify(doc.data() ?? {}).includes(OLD_EMAIL);
      if (noId || noCorpo) hits.push(`${doc.id}${noId ? ' [id]' : ''}`);
    }
    const marca = hits.length ? '⚠️ ' : '   ';
    console.log(`  ${marca}${col.id} (${snap.size} docs): ${hits.length} hit(s)${hits.length ? ' → ' + hits.slice(0, 8).join(', ') + (hits.length > 8 ? ' …' : '') : ''}`);
    total += hits.length;
  }
  console.log(`\nTotal de documentos com o e-mail antigo: ${total}`);
}

try {
  await main();
} catch (err) {
  console.error('ERRO:', err.message);
  process.exitCode = 1;
} finally {
  clearInterval(keepalive);
}

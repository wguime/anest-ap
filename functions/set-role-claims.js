#!/usr/bin/env node
/**
 * Backfill — custom claim `role: 'authenticated'` em TODOS os usuários Firebase.
 *
 * Pré-requisito da integração Supabase Third-Party Auth: todo JWT precisa do
 * claim `role` para mapear ao papel Postgres `authenticated` (sem ele, RLS
 * trata como `anon` → 0 linhas).
 *
 * Uso (no terminal do usuário, credencial NUNCA passa pelo chat):
 *   cd functions
 *   # autenticação via Application Default Credentials — uma das opções:
 *   #   gcloud auth application-default login
 *   #   export GOOGLE_APPLICATION_CREDENTIALS=/caminho/service-account.json
 *   node set-role-claims.js              # dry-run: só lista o que faria
 *   EXECUTE=1 node set-role-claims.js    # aplica de verdade
 *
 * Idempotente: pula usuários que já têm role=authenticated. Preserva claims
 * existentes. Pagina de 1000 em 1000.
 */
const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'anest-ap' });

const EXECUTE = process.env.EXECUTE === '1';

async function main() {
  console.log(`Modo: ${EXECUTE ? 'EXECUTE (aplicando claims)' : 'DRY-RUN (use EXECUTE=1 para aplicar)'}`);
  let nextPageToken;
  let total = 0;
  let applied = 0;
  let skipped = 0;
  let failed = 0;

  do {
    const page = await admin.auth().listUsers(1000, nextPageToken);
    nextPageToken = page.pageToken;

    for (const user of page.users) {
      total += 1;
      const claims = user.customClaims || {};
      if (claims.role === 'authenticated') {
        skipped += 1;
        continue;
      }
      if (!EXECUTE) {
        console.log(`[dry-run] aplicaria claim em ${user.uid} (${user.email || 'sem email'})`);
        applied += 1;
        continue;
      }
      try {
        await admin.auth().setCustomUserClaims(user.uid, {
          ...claims,
          role: 'authenticated',
        });
        applied += 1;
        console.log(`OK ${user.uid} (${user.email || 'sem email'})`);
      } catch (error) {
        failed += 1;
        console.error(`FALHA ${user.uid}: ${error.message}`);
      }
    }
  } while (nextPageToken);

  console.log('---');
  console.log(`Total: ${total} | ${EXECUTE ? 'Aplicados' : 'A aplicar'}: ${applied} | Já tinham: ${skipped} | Falhas: ${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('Erro fatal:', err.message);
  process.exit(1);
});

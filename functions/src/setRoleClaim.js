/**
 * Cloud Function — Custom claim `role: 'authenticated'` para Supabase Third-Party Auth.
 *
 * O Supabase inspeciona o claim `role` de todo JWT para mapear o papel Postgres.
 * Tokens Firebase não trazem esse claim por padrão → sem ele, queries rodam como
 * `anon` e RLS retorna 0 linhas. Este trigger garante o claim em todo usuário novo.
 *
 * Usa o trigger v1 `auth.user().onCreate` (não exige Identity Platform, ao
 * contrário das blocking functions v2).
 *
 * Caveat documentado pelo Supabase: onCreate é assíncrono — o PRIMEIRO ID token
 * emitido no signup pode não conter o claim. O claim aparece no refresh seguinte
 * (≤1h) ou em getIdToken(true). Usuários ANEST são criados via allowlist e fazem
 * login depois, então na prática o claim já está presente no primeiro uso.
 *
 * Backfill de usuários existentes: node functions/set-role-claims.js (dry-run).
 */
const functionsV1 = require('firebase-functions/v1');
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();

const setRoleClaimOnCreate = functionsV1.auth.user().onCreate(async (user) => {
  try {
    // Preserva claims existentes (ex: futuros claims de admin)
    const existing = (await admin.auth().getUser(user.uid)).customClaims || {};
    if (existing.role === 'authenticated') return null;
    await admin.auth().setCustomUserClaims(user.uid, {
      ...existing,
      role: 'authenticated',
    });
    console.log('setRoleClaimOnCreate: claim aplicado', { uid: user.uid });
  } catch (error) {
    // Não-fatal: backfill script cobre usuários que falharem aqui
    console.error('setRoleClaimOnCreate: falha ao aplicar claim', {
      uid: user.uid,
      message: error.message,
    });
  }
  return null;
});

module.exports = { setRoleClaimOnCreate };

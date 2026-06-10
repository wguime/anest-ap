/**
 * Cloud Functions ANEST V2 — entrypoint
 */
const { enviarLembretesEscala, enviarLembretesEscalaManual } = require('./src/escalaReminders');
const { importQuestionsJsonl, rollbackImportQuestions } = require('./src/importQuestions');
const { setRoleClaimOnCreate } = require('./src/setRoleClaim');

exports.enviarLembretesEscala = enviarLembretesEscala;
exports.enviarLembretesEscalaManual = enviarLembretesEscalaManual;
// T1.5.14 — Bulk import questões de quiz
exports.importQuestionsJsonl = importQuestionsJsonl;
exports.rollbackImportQuestions = rollbackImportQuestions;
// Auth nativo Supabase — claim role:authenticated em usuário novo
exports.setRoleClaimOnCreate = setRoleClaimOnCreate;

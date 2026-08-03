/**
 * Cloud Functions ANEST V2 — entrypoint
 */
const { enviarLembretesEscala, enviarLembretesEscalaManual } = require('./src/escalaReminders');
const { importQuestionsJsonl, rollbackImportQuestions } = require('./src/importQuestions');
const { setRoleClaimOnCreate } = require('./src/setRoleClaim');
const {
  projetarIndisponibilidadeStaff,
  projetarIndisponibilidadeStaffAoAlterar,
} = require('./src/staffAvailabilityProjection');

exports.enviarLembretesEscala = enviarLembretesEscala;
exports.enviarLembretesEscalaManual = enviarLembretesEscalaManual;
// T1.5.14 — Bulk import questões de quiz
exports.importQuestionsJsonl = importQuestionsJsonl;
exports.rollbackImportQuestions = rollbackImportQuestions;
// Auth nativo Supabase — claim role:authenticated em usuário novo
exports.setRoleClaimOnCreate = setRoleClaimOnCreate;
// Projeta afastamentos como marcadores operacionais genéricos (pseudonimizados).
exports.projetarIndisponibilidadeStaff = projetarIndisponibilidadeStaff;
exports.projetarIndisponibilidadeStaffAoAlterar = projetarIndisponibilidadeStaffAoAlterar;

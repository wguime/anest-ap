/**
 * Cloud Functions ANEST V2 — entrypoint
 */
const { enviarLembretesEscala, enviarLembretesEscalaManual } = require('./src/escalaReminders');

exports.enviarLembretesEscala = enviarLembretesEscala;
exports.enviarLembretesEscalaManual = enviarLembretesEscalaManual;

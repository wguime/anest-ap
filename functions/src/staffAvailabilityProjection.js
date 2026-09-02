/**
 * Recalcula a seção ATESTADO do documento público a partir de
 * `staffMedicalLeaves`, e devolve à seção de origem quem já voltou.
 *
 * É o ÚNICO caminho que pode escrever `indisponivel`: a regra do Firestore
 * (`match /staff/{docId}`, allow update) obriga o cliente a reenviar essa chave
 * idêntica ao que já está gravado, então só o Admin SDK a altera. Enquanto
 * estas funções não estavam deployadas, mover alguém para ATESTADO tirava a
 * pessoa da seção operacional e não punha nada no lugar — sumia da escala.
 *
 * ⚠️ Desde 01/09/2026 a projeção leva NOME e PERÍODO (decisão do dono); antes
 * era um marcador anônimo. `staff/schedule` é legível por qualquer usuário
 * autenticado, então o afastamento deixou de ser pseudonimizado.
 * Ver `staffProjectionCore.js`.
 */
const { onSchedule } = require('firebase-functions/v2/scheduler')
const { onDocumentWritten } = require('firebase-functions/v2/firestore')
const admin = require('firebase-admin')

if (!admin.apps.length) admin.initializeApp()
const db = admin.firestore()

const {
  dateKeyInSaoPaulo,
  projectScope,
} = require('./staffProjectionCore')

async function projectCurrentAvailability(referenceDate = new Date(), additionalLeaves = []) {
  const today = dateKeyInSaoPaulo(referenceDate)
  const scheduleRef = db.doc('staff/schedule')
  const leavesQuery = db.collection('staffMedicalLeaves').where('status', '==', 'active')
  const counts = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(leavesQuery)
    const scheduleSnap = await transaction.get(scheduleRef)
    if (!scheduleSnap.exists) throw new Error('staff/schedule não existe')

    const leavesByScope = { hospitais: [], consultorio: [] }
    snapshot.forEach((leaveDoc) => {
      const leave = leaveDoc.data()
      if (leave.scope === 'hospitais' || leave.scope === 'consultorio') {
        leavesByScope[leave.scope].push(leave)
      }
    })
    for (const leave of additionalLeaves) {
      if (leave?.scope === 'hospitais' || leave?.scope === 'consultorio') {
        leavesByScope[leave.scope].push(leave)
      }
    }

    const schedule = scheduleSnap.data()
    const hospitais = projectScope(schedule.hospitais, leavesByScope.hospitais, today, 'hospitais')
    const consultorio = projectScope(schedule.consultorio, leavesByScope.consultorio, today, 'consultorio')
    const revision = Number.isInteger(schedule.revision) ? schedule.revision + 1 : 1
    transaction.update(scheduleRef, { hospitais, consultorio, revision })
    return {
      hospitais: hospitais.indisponivel.length,
      consultorio: consultorio.indisponivel.length,
    }
  })

  console.log('staff availability projected', { today, ...counts })
  return { today, ...counts }
}

const projetarIndisponibilidadeStaff = onSchedule(
  {
    schedule: '5 0 * * *',
    timeZone: 'America/Sao_Paulo',
    region: 'us-central1',
    retryCount: 2,
  },
  () => projectCurrentAvailability()
)

const projetarIndisponibilidadeStaffAoAlterar = onDocumentWritten(
  {
    document: 'staffMedicalLeaves/{leaveId}',
    region: 'us-central1',
    retry: true,
  },
  (event) => {
    const before = event.data?.before?.exists ? event.data.before.data() : null
    const after = event.data?.after?.exists ? event.data.after.data() : null
    const restorationHint = after?.status === 'cancelled'
      ? after
      : (!after && before ? { ...before, status: 'cancelled' } : null)
    return projectCurrentAvailability(new Date(), restorationHint ? [restorationHint] : [])
  }
)

module.exports = {
  dateKeyInSaoPaulo,
  projectScope,
  projectCurrentAvailability,
  projetarIndisponibilidadeStaff,
  projetarIndisponibilidadeStaffAoAlterar,
}

/**
 * Projeta somente marcadores operacionais genéricos de indisponibilidades
 * vigentes. É pseudonimização: nome e período ficam em staffMedicalLeaves,
 * mas equipes pequenas ainda podem inferir mudanças comparando a escala.
 */
const { onSchedule } = require('firebase-functions/v2/scheduler')
const { onDocumentWritten } = require('firebase-functions/v2/firestore')
const admin = require('firebase-admin')

if (!admin.apps.length) admin.initializeApp()
const db = admin.firestore()

const PLACEHOLDER = Object.freeze({
  nome: 'INDISPONÍVEL',
  status: 'indisponivel',
})

const VALID_SECTIONS = Object.freeze({
  hospitais: new Set(['hro', 'unimed', 'materno', 'ferias']),
  consultorio: new Set([
    'volanFinanceiro', 'administrativo', 'recepcao', 'telefoneWhatsapp',
    'financeiro', 'enfermagemQmentum', 'ferias',
  ]),
})

function dateKeyInSaoPaulo(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function timestampDateKey(timestamp) {
  return timestamp?.toDate ? dateKeyInSaoPaulo(timestamp.toDate()) : null
}

function normalizedEmployeeName(value) {
  return String(value || '').trim().toLocaleUpperCase('pt-BR')
}

function isActiveOn(leave, dateKey) {
  if (leave?.status !== 'active') return false
  const startsOn = timestampDateKey(leave.startsAt)
  const endsOn = timestampDateKey(leave.endsAt)
  return startsOn && endsOn && startsOn <= dateKey && endsOn >= dateKey
}

function projectScope(rawGroup = {}, leaves = [], dateKey, scope = null) {
  const group = { ...rawGroup }
  delete group.atestado
  delete group.indisponivel

  const activeLeaves = leaves.filter((leave) => isActiveOn(leave, dateKey))
  const activeNames = new Set(activeLeaves.map((leave) => normalizedEmployeeName(leave.employeeName)))

  for (const [sectionKey, entries] of Object.entries(group)) {
    if (!Array.isArray(entries)) continue
    group[sectionKey] = entries.filter(
      (entry) => !activeNames.has(normalizedEmployeeName(entry?.nome))
    )
  }

  for (const leave of leaves.filter((candidate) => !isActiveOn(candidate, dateKey))) {
    const employeeName = String(leave.employeeName || '').trim()
    const previous = leave.previousAssignment
    const validSections = VALID_SECTIONS[scope || leave.scope]
    if (
      !employeeName || activeNames.has(normalizedEmployeeName(employeeName)) ||
      !previous?.sectionKey || !validSections?.has(previous.sectionKey) ||
      typeof previous.turno !== 'string' || previous.turno.length > 80 ||
      (previous.funcoes != null && (typeof previous.funcoes !== 'string' || previous.funcoes.length > 120))
    ) {
      continue
    }
    const alreadyPresent = Object.values(group).some((entries) => (
      Array.isArray(entries) && entries.some(
        (entry) => normalizedEmployeeName(entry?.nome) === normalizedEmployeeName(employeeName)
      )
    ))
    if (alreadyPresent) continue
    const target = Array.isArray(group[previous.sectionKey]) ? group[previous.sectionKey] : []
    group[previous.sectionKey] = [...target, {
      nome: employeeName,
      turno: previous.turno || '-',
      status: 'ativa',
      ...(previous.funcoes ? { funcoes: previous.funcoes } : {}),
    }]
  }

  group.indisponivel = Array.from(
    { length: activeNames.size },
    () => ({ ...PLACEHOLDER })
  )
  return group
}

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

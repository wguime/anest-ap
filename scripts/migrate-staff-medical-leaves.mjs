#!/usr/bin/env node
/**
 * Migra staff/schedule.*.atestado para staffMedicalLeaves/{id}.
 *
 * Dry-run (padrão):
 *   node scripts/migrate-staff-medical-leaves.mjs --year 2026
 *
 * Aplicação (exige autorização explícita e UID real do operador):
 *   node scripts/migrate-staff-medical-leaves.mjs --year 2026 --actor-uid UID --apply
 *
 * O ano nunca é inferido: o legado guarda somente DD/MM-DD/MM.
 */
import { createHash } from 'node:crypto'
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore'
import { existsSync, readFileSync } from 'node:fs'

const args = new Set(process.argv.slice(2))
const valueAfter = (flag) => {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] : null
}
const apply = args.has('--apply')
const year = Number(valueAfter('--year'))
const actorUid = valueAfter('--actor-uid')

if (!Number.isInteger(year) || year < 2020 || year > 2100) {
  throw new Error('Informe o ano confirmado com --year AAAA. O script não infere o ano legado.')
}
if (apply && !actorUid) {
  throw new Error('--apply exige --actor-uid com o UID real do operador autorizado.')
}

if (!getApps().length) {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (credentialsPath && existsSync(credentialsPath)) {
    initializeApp({ credential: cert(JSON.parse(readFileSync(credentialsPath, 'utf8'))) })
  } else {
    initializeApp({ credential: applicationDefault(), projectId: 'anest-ap' })
  }
}

const db = getFirestore()
const scheduleRef = db.doc('staff/schedule')
const scheduleSnap = await scheduleRef.get()
if (!scheduleSnap.exists) throw new Error('staff/schedule não existe.')
const schedule = scheduleSnap.data()

function parseLegacyRange(value) {
  const match = String(value || '').trim().match(/^(\d{1,2})\/(\d{1,2})-(\d{1,2})\/(\d{1,2})$/)
  if (!match) return null
  const [, startDay, startMonth, endDay, endMonth] = match.map(Number)
  const endYear = endMonth < startMonth ? year + 1 : year
  const startsAt = new Date(Date.UTC(year, startMonth - 1, startDay, 12, 0, 0))
  const endsAt = new Date(Date.UTC(endYear, endMonth - 1, endDay, 12, 0, 0))
  if (
    startsAt.getUTCFullYear() !== year || startsAt.getUTCMonth() !== startMonth - 1 || startsAt.getUTCDate() !== startDay ||
    endsAt.getUTCFullYear() !== endYear || endsAt.getUTCMonth() !== endMonth - 1 || endsAt.getUTCDate() !== endDay ||
    endsAt < startsAt
  ) return null
  return { startsAt, endsAt }
}

const planned = []
const invalid = []
for (const scope of ['hospitais', 'consultorio']) {
  for (const entry of schedule?.[scope]?.atestado || []) {
    const range = parseLegacyRange(entry?.turno)
    if (!entry?.nome || !range) {
      invalid.push({ scope, hasName: !!entry?.nome, range: entry?.turno || null })
      continue
    }
    const hash = createHash('sha256')
      .update(`${scope}|${entry.nome.trim()}|${range.startsAt.toISOString()}|${range.endsAt.toISOString()}`)
      .digest('hex')
      .slice(0, 28)
    planned.push({
      id: `legacy_${hash}`,
      scope,
      employeeName: entry.nome.trim(),
      startsAt: range.startsAt,
      endsAt: range.endsAt,
    })
  }
}

console.log(JSON.stringify({
  mode: apply ? 'apply' : 'dry-run',
  confirmedYear: year,
  legacyFound: planned.length + invalid.length,
  valid: planned.length,
  invalid: invalid.length,
  invalidRanges: invalid.map((item) => ({ scope: item.scope, range: item.range })),
}, null, 2))

if (invalid.length > 0) {
  throw new Error('Migração interrompida: corrija todos os intervalos inválidos antes de aplicar.')
}
if (!apply) process.exit(0)
if (planned.length === 0) {
  throw new Error('Nenhum atestado legado encontrado. Nada foi alterado; a migração não deve ser reaplicada.')
}
if (planned.length > 499) {
  throw new Error('Mais de 499 registros: a migração atômica excederia o limite do Firestore. Divida somente após revisão manual.')
}

const actorRecord = await getAuth().getUser(actorUid)
if (actorRecord.disabled) {
  throw new Error('O --actor-uid está desabilitado no Firebase Auth.')
}
const actorProfileSnap = await db.doc(`userProfiles/${actorUid}`).get()
const actorProfile = actorProfileSnap.exists ? actorProfileSnap.data() : null
const actorRole = String(actorProfile?.role || '').toLowerCase()
const actorAuthorized = actorProfile?.permissions?.['staff-absence-private'] === true
if (!actorAuthorized) {
  throw new Error(`O --actor-uid (${actorRole || 'sem papel'}) não possui staff-absence-private.`)
}

const refs = planned.map((leave) => db.doc(`staffMedicalLeaves/${leave.id}`))
const existing = refs.length > 0 ? await db.getAll(...refs) : []
const existingById = new Map(existing.map((snapshot) => [snapshot.id, snapshot]))
const activePrivateSnapshot = await db.collection('staffMedicalLeaves')
  .where('status', '==', 'active')
  .get()
const batch = db.batch()
const now = Timestamp.now()

for (const leave of planned) {
  const prior = existingById.get(leave.id)
  batch.set(db.doc(`staffMedicalLeaves/${leave.id}`), {
    scope: leave.scope,
    employeeName: leave.employeeName,
    kind: 'medical_leave',
    startsAt: Timestamp.fromDate(leave.startsAt),
    endsAt: Timestamp.fromDate(leave.endsAt),
    status: 'active',
    source: 'legacy',
    createdAt: prior?.exists ? prior.data().createdAt : now,
    createdBy: prior?.exists ? prior.data().createdBy : actorUid,
    updatedAt: now,
    updatedBy: actorUid,
  })
}

const todayKey = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date())
const dateKey = (date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(date)
const projectionById = new Map()
activePrivateSnapshot.forEach((snapshot) => {
  const data = snapshot.data()
  const startsAt = data.startsAt?.toDate?.()
  const endsAt = data.endsAt?.toDate?.()
  if (startsAt && endsAt) {
    projectionById.set(snapshot.id, {
      scope: data.scope,
      employeeName: data.employeeName,
      startsAt,
      endsAt,
    })
  }
})
planned.forEach((leave) => projectionById.set(leave.id, leave))
const activeCount = (scope) => new Set(
  Array.from(projectionById.values())
    .filter((leave) => (
      leave.scope === scope &&
      dateKey(leave.startsAt) <= todayKey &&
      dateKey(leave.endsAt) >= todayKey
    ))
    .map((leave) => leave.employeeName.trim().toLocaleUpperCase('pt-BR'))
).size
const placeholders = (count) => Array.from({ length: count }, () => ({
  nome: 'INDISPONÍVEL',
  status: 'indisponivel',
}))

batch.update(scheduleRef, {
  'hospitais.atestado': FieldValue.delete(),
  'consultorio.atestado': FieldValue.delete(),
  'hospitais.indisponivel': placeholders(activeCount('hospitais')),
  'consultorio.indisponivel': placeholders(activeCount('consultorio')),
  revision: Number.isInteger(schedule.revision) ? schedule.revision + 1 : 1,
  updatedAt: now,
  updatedBy: actorUid,
}, { lastUpdateTime: scheduleSnap.updateTime })

await batch.commit()
console.log(JSON.stringify({ applied: true, privateCreatedOrUpdated: planned.length }, null, 2))

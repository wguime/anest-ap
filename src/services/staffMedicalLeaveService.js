import {
  Timestamp,
  collection,
  doc,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore'

import { db } from '../config/firebase'
import { createFirestoreSubscription } from './firestoreSubscriptionHelper'
import {
  extractMedicalLeavesFromStaff,
  isoFromDateLike,
  sanitizeStaffForPublic,
} from '../lib/staffMedicalLeaves'

const COLLECTION = 'staffMedicalLeaves'
const STAFF_COLLECTION = 'staff'
const VALID_PREVIOUS_SECTIONS = {
  hospitais: new Set(['hro', 'unimed', 'materno', 'ferias']),
  consultorio: new Set([
    'volanFinanceiro', 'administrativo', 'recepcao', 'telefoneWhatsapp',
    'financeiro', 'enfermagemQmentum', 'ferias',
  ]),
}

function timestampFromIso(value) {
  const normalized = isoFromDateLike(value)
  if (!normalized) return null
  const date = new Date(`${normalized}T12:00:00`)
  return Number.isNaN(date.getTime()) ? null : Timestamp.fromDate(date)
}

function cleanPreviousAssignment(value, scope) {
  if (!value || typeof value !== 'object') return null
  if (!VALID_PREVIOUS_SECTIONS[scope]?.has(value.sectionKey)) return null
  const clean = {}
  clean.sectionKey = value.sectionKey
  if (typeof value.turno === 'string' && value.turno && value.turno.length <= 80) clean.turno = value.turno
  if (typeof value.funcoes === 'string' && value.funcoes && value.funcoes.length <= 120) clean.funcoes = value.funcoes
  return Object.keys(clean).length > 0 ? clean : null
}

export function subscribeStaffMedicalLeaves(callback, options = {}) {
  const leavesQuery = query(
    collection(db, COLLECTION),
    where('status', '==', 'active')
  )
  const { cleanup } = createFirestoreSubscription(
    leavesQuery,
    {
      onData: (snapshot) => {
        const leaves = snapshot.docs.map((snapshotDoc) => {
          const data = snapshotDoc.data()
          return {
            id: snapshotDoc.id,
            ...data,
            startsOn: isoFromDateLike(data.startsAt),
            endsOn: isoFromDateLike(data.endsAt),
          }
        })
        callback({ leaves, error: null })
      },
      onError: (error) => callback({ leaves: [], error: error.message }),
    },
    { onStatusChange: options.onStatusChange }
  )
  return cleanup
}

export async function saveStaffWithMedicalLeaves({
  staffData,
  currentPublicStaff = null,
  existingLeaves = [],
  userId,
  dateKey,
  updatePublic = true,
}) {
  try {
    if (updatePublic && !currentPublicStaff) {
      return { success: false, error: 'Reabra o editor para carregar a versão atual da escala.' }
    }
    const desiredLeaves = extractMedicalLeavesFromStaff(staffData)
    const invalid = desiredLeaves.find((leave) => (
      !leave.employeeName || !leave.startsOn || !leave.endsOn || leave.endsOn < leave.startsOn
    ))
    if (invalid) {
      return { success: false, error: 'Confirme o ano e o intervalo completo de todos os atestados.' }
    }

    const batch = writeBatch(db)
    const desiredExistingIds = new Set()
    const normalizedLeaves = []
    const existingById = new Map(existingLeaves.map((leave) => [leave.id, leave]))

    for (const leave of desiredLeaves) {
      const startsAt = timestampFromIso(leave.startsOn)
      const endsAt = timestampFromIso(leave.endsOn)
      if (!startsAt || !endsAt) {
        return { success: false, error: 'Datas de atestado inválidas.' }
      }

      const prior = leave.id ? existingById.get(leave.id) : null
      const isExisting = !!prior &&
        prior.scope === leave.scope &&
        prior.employeeName === leave.employeeName
      const leaveRef = isExisting
        ? doc(db, COLLECTION, leave.id)
        : doc(collection(db, COLLECTION))
      const previousAssignment = cleanPreviousAssignment(leave.previousAssignment, leave.scope)
      const commonData = {
        scope: leave.scope,
        employeeName: leave.employeeName,
        kind: 'medical_leave',
        startsAt,
        endsAt,
        status: 'active',
        source: leave.source,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      }
      if (previousAssignment) commonData.previousAssignment = previousAssignment

      if (isExisting) {
        desiredExistingIds.add(leave.id)
        batch.update(leaveRef, {
          startsAt,
          endsAt,
          status: 'active',
          updatedAt: serverTimestamp(),
          updatedBy: userId,
        })
      } else {
        batch.set(leaveRef, {
          ...commonData,
          createdAt: serverTimestamp(),
          createdBy: userId,
        })
      }
      const effectivePreviousAssignment = isExisting
        ? cleanPreviousAssignment(prior.previousAssignment, prior.scope)
        : previousAssignment
      normalizedLeaves.push({
        ...leave,
        id: leaveRef.id,
        status: 'active',
        previousAssignment: effectivePreviousAssignment,
      })
    }

    for (const existing of existingLeaves) {
      if (!desiredExistingIds.has(existing.id)) {
        batch.update(doc(db, COLLECTION, existing.id), {
          status: 'cancelled',
          updatedAt: serverTimestamp(),
          updatedBy: userId,
        })
        normalizedLeaves.push({ ...existing, status: 'cancelled' })
      }
    }

    const publicStaff = updatePublic
      ? sanitizeStaffForPublic(staffData, [], dateKey)
      : sanitizeStaffForPublic(staffData, normalizedLeaves, dateKey)
    if (updatePublic) {
      for (const scope of ['hospitais', 'consultorio']) {
        const currentProjection = currentPublicStaff?.[scope]?.indisponivel
        // `indisponivel` é server-owned: a regra do Firestore exige que o update
        // do cliente reenvie essa chave IDÊNTICA à gravada, e só as Cloud
        // Functions (Admin SDK) a recalculam. Daí copiar em vez de projetar.
        //
        // A cópia tem de ser literal. Antes cada item virava o PUBLIC_PLACEHOLDER
        // anônimo — o que só passava enquanto a projeção era uma lista de
        // placeholders iguais entre si. Desde 01/09 ela carrega nome e período
        // (decisão do dono), então remapear mudaria o conteúdo e o save inteiro
        // voltaria permission-denied na primeira edição depois de um atestado.
        publicStaff[scope].indisponivel = Array.isArray(currentProjection)
          ? currentProjection.map((entry) => ({ ...entry }))
          : []
      }
      const currentRevision = currentPublicStaff?.revision
      const revision = Number.isInteger(currentRevision) ? currentRevision + 1 : 1
      publicStaff.revision = revision
      batch.set(doc(db, STAFF_COLLECTION, 'schedule'), {
        ...publicStaff,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      })
    }

    await batch.commit()
    return { success: true, error: null, staff: publicStaff }
  } catch (error) {
    console.error('Error saving private staff medical leaves:', error)
    return { success: false, error: error.message }
  }
}

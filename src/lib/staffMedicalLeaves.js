const PUBLIC_PLACEHOLDER = Object.freeze({
  // A escala operacional deve informar o motivo operacional, sem expor
  // datas, diagnóstico ou qualquer detalhe do atestado.
  nome: 'ATESTADO',
  status: 'indisponivel',
})

const SENSITIVE_SECTION_KEYS = ['atestado']
const VALID_PREVIOUS_SECTIONS = {
  hospitais: new Set(['hro', 'unimed', 'materno', 'ferias']),
  consultorio: new Set([
    'volanFinanceiro', 'administrativo', 'recepcao', 'telefoneWhatsapp',
    'financeiro', 'enfermagemQmentum', 'ferias',
  ]),
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function isoFromDateLike(value) {
  if (!value) return null
  if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    if (!match) return null
    const [, yearText, monthText, dayText] = match
    const year = Number(yearText)
    const month = Number(monthText)
    const day = Number(dayText)
    const candidate = new Date(Date.UTC(year, month - 1, day))
    if (
      candidate.getUTCFullYear() !== year ||
      candidate.getUTCMonth() !== month - 1 ||
      candidate.getUTCDate() !== day
    ) return null
    return value
  }
  const date = typeof value.toDate === 'function' ? value.toDate() : value
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function placeholderList(count) {
  return Array.from({ length: Math.max(0, count) }, () => ({ ...PUBLIC_PLACEHOLDER }))
}

function normalizedEmployeeName(value) {
  return String(value || '').trim().toLocaleUpperCase('pt-BR')
}

function restorePreviousAssignment(group, leave) {
  const employeeName = String(leave.employeeName || '').trim()
  const previous = leave.previousAssignment
  if (
    !employeeName || !VALID_PREVIOUS_SECTIONS[leave.scope]?.has(previous?.sectionKey) ||
    typeof previous.turno !== 'string' || previous.turno.length > 80 ||
    (previous.funcoes != null && (typeof previous.funcoes !== 'string' || previous.funcoes.length > 120))
  ) {
    return
  }

  const alreadyPresent = Object.entries(group).some(([sectionKey, entries]) => (
    sectionKey !== 'indisponivel' &&
    Array.isArray(entries) &&
    entries.some((entry) => normalizedEmployeeName(entry?.nome) === normalizedEmployeeName(employeeName))
  ))
  if (alreadyPresent) return

  const restored = {
    nome: employeeName,
    turno: previous.turno || '-',
    status: 'ativa',
    ...(previous.funcoes ? { funcoes: previous.funcoes } : {}),
  }
  const target = Array.isArray(group[previous.sectionKey]) ? group[previous.sectionKey] : []
  group[previous.sectionKey] = [...target, restored]
}

export function isMedicalLeaveActiveOn(leave, dateKey) {
  if (!leave || leave.status === 'cancelled') return false
  const startsOn = isoFromDateLike(leave.startsOn || leave.startsAt)
  const endsOn = isoFromDateLike(leave.endsOn || leave.endsAt)
  const selectedDate = isoFromDateLike(dateKey)
  return !!startsOn && !!endsOn && !!selectedDate && startsOn <= selectedDate && endsOn >= selectedDate
}

export function collectLegacyMedicalLeaves(rawStaff) {
  const entries = []
  for (const scope of ['hospitais', 'consultorio']) {
    const legacy = rawStaff?.[scope]?.atestado
    if (!Array.isArray(legacy)) continue
    legacy.forEach((entry, index) => {
      if (!entry?.nome) return
      entries.push({
        id: `legacy-${scope}-${index}`,
        scope,
        employeeName: entry.nome,
        legacyRange: entry.turno || null,
        status: 'active',
        source: 'legacy',
        requiresDateConfirmation: true,
      })
    })
  }
  return entries
}

export function sanitizeStaffForPublic(rawStaff, medicalLeaves, dateKey = isoFromDateLike(new Date())) {
  const sanitized = clone(rawStaff || {}) || {}
  const legacy = collectLegacyMedicalLeaves(rawStaff)

  for (const scope of ['hospitais', 'consultorio']) {
    const group = { ...(sanitized[scope] || {}) }
    SENSITIVE_SECTION_KEYS.forEach((key) => delete group[key])

    let count
    if (Array.isArray(medicalLeaves)) {
      const scopedLeaves = medicalLeaves.filter((leave) => leave.scope === scope)
      const activeLeaves = scopedLeaves.filter((leave) => isMedicalLeaveActiveOn(leave, dateKey))
      const activeNames = new Set(activeLeaves.map((leave) => normalizedEmployeeName(leave.employeeName)))

      for (const [sectionKey, entries] of Object.entries(group)) {
        if (sectionKey === 'indisponivel' || !Array.isArray(entries)) continue
        group[sectionKey] = entries.filter(
          (entry) => !activeNames.has(normalizedEmployeeName(entry?.nome))
        )
      }
      scopedLeaves
        .filter((leave) => (
          !isMedicalLeaveActiveOn(leave, dateKey) &&
          !activeNames.has(normalizedEmployeeName(leave.employeeName))
        ))
        .forEach((leave) => restorePreviousAssignment(group, leave))

      count = activeNames.size
    } else if (legacy.length > 0) {
      count = legacy.filter((leave) => leave.scope === scope).length
    } else {
      count = Array.isArray(group.indisponivel) ? group.indisponivel.length : 0
    }

    group.indisponivel = placeholderList(count)
    sanitized[scope] = group
  }

  delete sanitized.medicalLeaves
  delete sanitized.staffMedicalLeaves
  return sanitized
}

function dateRangeLabel(startsOn, endsOn) {
  if (!startsOn || !endsOn) return '-'
  const [y1, m1, d1] = startsOn.split('-')
  const [y2, m2, d2] = endsOn.split('-')
  if (!y1 || !y2) return '-'
  return `${d1}/${m1}/${y1}-${d2}/${m2}/${y2}`
}

export function medicalLeaveToStaffEntry(leave) {
  const startsOn = isoFromDateLike(leave.startsOn || leave.startsAt)
  const endsOn = isoFromDateLike(leave.endsOn || leave.endsAt)
  const previousAssignment = clone(leave.previousAssignment) || null
  return {
    nome: leave.employeeName,
    turno: leave.requiresDateConfirmation
      ? leave.legacyRange || '-'
      : dateRangeLabel(startsOn, endsOn),
    status: 'atestado',
    medicalLeaveId: leave.id,
    startsOn,
    endsOn,
    source: leave.source || 'manual',
    requiresDateConfirmation: !!leave.requiresDateConfirmation,
    previousAssignment,
    ...(previousAssignment?.funcoes ? { funcoes: previousAssignment.funcoes } : {}),
  }
}

export function mergeMedicalLeavesForEditing(publicStaff, medicalLeaves = [], legacyLeaves = []) {
  const merged = clone(publicStaff || {}) || {}
  const privateIds = new Set(medicalLeaves.map((leave) => leave.id))
  const allLeaves = [
    ...medicalLeaves.filter((leave) => leave.status !== 'cancelled'),
    ...legacyLeaves.filter((leave) => !privateIds.has(leave.id)),
  ]

  for (const scope of ['hospitais', 'consultorio']) {
    merged[scope] = { ...(merged[scope] || {}) }
    delete merged[scope].indisponivel
    merged[scope].atestado = allLeaves
      .filter((leave) => leave.scope === scope)
      .map(medicalLeaveToStaffEntry)
  }
  return merged
}

export function extractMedicalLeavesFromStaff(staffData) {
  const leaves = []
  for (const scope of ['hospitais', 'consultorio']) {
    const entries = staffData?.[scope]?.atestado
    if (!Array.isArray(entries)) continue
    entries.forEach((entry) => {
      if (!entry?.nome) return
      leaves.push({
        id: entry.medicalLeaveId || null,
        scope,
        employeeName: entry.nome.trim(),
        startsOn: isoFromDateLike(entry.startsOn),
        endsOn: isoFromDateLike(entry.endsOn),
        source: entry.source === 'legacy' ? 'legacy' : 'manual',
        previousAssignment: clone(entry.previousAssignment) || null,
      })
    })
  }
  return leaves
}

export function hasSensitiveStaffFields(staffData) {
  return ['hospitais', 'consultorio'].some((scope) =>
    Array.isArray(staffData?.[scope]?.atestado) && staffData[scope].atestado.length > 0
  )
}

export { PUBLIC_PLACEHOLDER, isoFromDateLike }

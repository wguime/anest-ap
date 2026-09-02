/**
 * Lógica pura da projeção de indisponibilidade do staff.
 *
 * Vive separada de `staffAvailabilityProjection.js` porque aquele módulo puxa
 * `firebase-functions` e `firebase-admin` no topo: importá-lo num teste sobe o
 * SDK inteiro. Aqui é JS puro, então a suíte do app consegue exercitar a regra
 * que decide quem aparece na escala — e essa regra nunca teve teste.
 *
 * `functions/` é um pacote CommonJS separado e não enxerga `src/`, então parte
 * disto espelha `src/lib/staffMedicalLeaves.js` por imposição do empacotamento.
 * O que os dois lados precisam manter igual está marcado com ⚠️.
 */

// ⚠️ Espelha VALID_PREVIOUS_SECTIONS de src/lib/staffMedicalLeaves.js.
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
  return timestamp && typeof timestamp.toDate === 'function'
    ? dateKeyInSaoPaulo(timestamp.toDate())
    : null
}

function normalizedEmployeeName(value) {
  return String(value || '').trim().toLocaleUpperCase('pt-BR')
}

function isActiveOn(leave, dateKey) {
  if (!leave || leave.status !== 'active') return false
  const startsOn = timestampDateKey(leave.startsAt)
  const endsOn = timestampDateKey(leave.endsAt)
  return !!startsOn && !!endsOn && startsOn <= dateKey && endsOn >= dateKey
}

/**
 * "2026-09-02" + "2026-09-08" → "02/09-08/09", o mesmo formato curto que o
 * card já usa para Férias (dono 01/09: atestado aparece como os outros pontos
 * de trabalho, com nome e período).
 */
function leavePeriodLabel(leave) {
  const startsOn = timestampDateKey(leave?.startsAt)
  const endsOn = timestampDateKey(leave?.endsAt)
  if (!startsOn || !endsOn) return '-'
  const short = (key) => {
    const [, month, day] = key.split('-')
    return `${day}/${month}`
  }
  return `${short(startsOn)}-${short(endsOn)}`
}

/**
 * Entrada que vai para a seção ATESTADO do documento público.
 *
 * ⚠️ Desde 01/09/2026 leva NOME e PERÍODO, por decisão do dono: antes era um
 * marcador anônimo ("ATESTADO", sem nome nem data) e ele pediu que o card
 * mostrasse quem está afastada e por quanto tempo, como já faz com Férias.
 * `staff/schedule` é legível por qualquer usuário autenticado, então esta linha
 * é o ponto exato em que o afastamento deixa de ser anônimo — mexer aqui é
 * mexer em dado de saúde (art. 11 LGPD).
 */
function leaveToPublicEntry(leave) {
  return {
    nome: String(leave?.employeeName || '').trim(),
    turno: leavePeriodLabel(leave),
    status: 'indisponivel',
  }
}

function restorePrevious(group, leave, scope, activeNames) {
  const employeeName = String(leave?.employeeName || '').trim()
  const previous = leave?.previousAssignment
  const validSections = VALID_SECTIONS[scope || leave?.scope]
  if (
    !employeeName || activeNames.has(normalizedEmployeeName(employeeName)) ||
    !previous || !validSections || !validSections.has(previous.sectionKey) ||
    typeof previous.turno !== 'string' || previous.turno.length > 80 ||
    (previous.funcoes != null && (typeof previous.funcoes !== 'string' || previous.funcoes.length > 120))
  ) {
    return
  }

  const alreadyPresent = Object.values(group).some((entries) => (
    Array.isArray(entries) && entries.some(
      (entry) => normalizedEmployeeName(entry && entry.nome) === normalizedEmployeeName(employeeName)
    )
  ))
  if (alreadyPresent) return

  const target = Array.isArray(group[previous.sectionKey]) ? group[previous.sectionKey] : []
  group[previous.sectionKey] = [...target, {
    nome: employeeName,
    turno: previous.turno || '-',
    status: 'ativa',
    ...(previous.funcoes ? { funcoes: previous.funcoes } : {}),
  }]
}

/**
 * Recalcula um escopo (hospitais | consultorio) a partir dos afastamentos.
 *
 * Quem está afastada HOJE sai da seção operacional e entra em `indisponivel`;
 * quem não está mais volta para a seção de origem pelo `previousAssignment`.
 * É o passo que fecha o saldo: ninguém pode sair de um lado sem aparecer no
 * outro — foi exatamente isso que quebrou quando o trigger não existia.
 */
function projectScope(rawGroup = {}, leaves = [], dateKey, scope = null) {
  const group = { ...rawGroup }
  delete group.atestado
  delete group.indisponivel

  const activeLeaves = leaves.filter((leave) => isActiveOn(leave, dateKey))
  const activeNames = new Set(activeLeaves.map((leave) => normalizedEmployeeName(leave.employeeName)))

  for (const [sectionKey, entries] of Object.entries(group)) {
    if (!Array.isArray(entries)) continue
    group[sectionKey] = entries.filter(
      (entry) => !activeNames.has(normalizedEmployeeName(entry && entry.nome))
    )
  }

  for (const leave of leaves.filter((candidate) => !isActiveOn(candidate, dateKey))) {
    restorePrevious(group, leave, scope, activeNames)
  }

  // Ordem estável: o card lista na mesma sequência a cada projeção, senão duas
  // execuções do cron trocariam as linhas de lugar sem nada ter mudado.
  group.indisponivel = activeLeaves
    .slice()
    .sort((a, b) => normalizedEmployeeName(a.employeeName)
      .localeCompare(normalizedEmployeeName(b.employeeName), 'pt-BR'))
    .map(leaveToPublicEntry)

  return group
}

module.exports = {
  VALID_SECTIONS,
  dateKeyInSaoPaulo,
  isActiveOn,
  leavePeriodLabel,
  leaveToPublicEntry,
  normalizedEmployeeName,
  projectScope,
  timestampDateKey,
}

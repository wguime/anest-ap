/**
 * Regras de integridade da Escala Cirúrgica.
 *
 * Este módulo é puro e compartilhado por importação, publicação e testes.
 * Regras que dependem do banco (RLS, lock e publicação atômica) continuam na
 * migration; aqui ficam apenas as validações determinísticas do contrato.
 */

export const TURNOS_ESCALA = Object.freeze(['matutino', 'vespertino'])

export const STATUS_PRINCIPAL_ESCALA = Object.freeze(['agendada', 'iniciada', 'terminada'])
export const STATUS_EXTRA_ESCALA = Object.freeze(['atrasada', 'suspensa', 'passa_tarde'])

/**
 * Rótulo do extra `passa_tarde` — o DESTINO depende do turno (dono 20/08): de
 * manhã a cirurgia que não cabe passa PARA A TARDE; à tarde ela passa PARA A
 * NOITE, e o rótulo fixo "Passa para tarde" às 16h nomeava um turno que já
 * acabou. Mesma mecânica do `plantaoLabel` da coluna de liberação: a palavra
 * vem do turno, nunca fixa na view.
 *
 * ⚠️ o VALOR no banco continua `passa_tarde` nos dois turnos — ele está no CHECK
 * de `escala_cirurgica_caso` e nas duas RPCs de publicação (migrations
 * 20260720100000 / 20260721100000). Criar um `passa_noite` custaria migration +
 * reescrita de histórico para mudar só a palavra na tela.
 */
export function passaTurnoLabel(turno) {
  return turno === 'vespertino' ? 'Passa para noite' : 'Passa para tarde'
}

const HORA_RE = /^(\d{1,2})(?::(\d{2}))?\s*h?$/i

/** Marcador operacional: começa após o término da cirurgia anterior. */
export function ehHoraSequencialEscala(value) {
  return /^(?:AS|A\s+SEGUIR|À\s+SEGUIR)$/i.test(String(value ?? '').trim())
}

/**
 * Faz parsing estrito de uma hora de escala.
 * Aceita 08, 08:30 e 08h; rejeita datas, minutos inválidos e valores vazios.
 */
export function parseHoraEscala(value) {
  const texto = String(value ?? '').trim()
  if (!texto) return null
  const match = HORA_RE.exec(texto)
  if (!match) return null
  const hora = Number(match[1])
  const minuto = match[2] == null ? 0 : Number(match[2])
  if (!Number.isInteger(hora) || !Number.isInteger(minuto) || hora > 23 || minuto > 59) return null
  return { hora, minuto, minutos: hora * 60 + minuto, texto }
}

/** Retorna o turno da hora; valores vazios continuam sem turno. */
export function turnoDaHoraEscala(value) {
  const parsed = parseHoraEscala(value)
  if (!parsed) return null
  return parsed.hora < 13 ? 'matutino' : 'vespertino'
}

/**
 * Valida um caso antes da publicação.
 * `turno` explícito é obrigatório para itens sem hora. Quando há hora e ela
 * diverge do turno, retornamos warning: posições e encaixes podem ser uma
 * exceção operacional, então a UI deve pedir confirmação humana em vez de
 * mover o caso silenciosamente.
 */
export function validarCasoEscala(caso = {}) {
  const issues = []
  const turno = caso.turno || null
  const hora = String(caso.hora ?? '').trim()
  if (ehHoraSequencialEscala(hora)) return issues
  const parsed = hora ? parseHoraEscala(hora) : null

  if (turno && !TURNOS_ESCALA.includes(turno)) {
    issues.push({ code: 'turno_invalido', severity: 'error', message: 'Turno inválido.' })
  }
  if (hora && !parsed) {
    issues.push({ code: 'hora_invalida', severity: 'error', message: `Horário inválido: ${hora}.` })
  }
  if (!hora && !TURNOS_ESCALA.includes(turno)) {
    issues.push({ code: 'turno_ausente', severity: 'error', message: 'Item sem horário precisa de turno explícito.' })
  }
  if (parsed && TURNOS_ESCALA.includes(turno)) {
    const esperado = parsed.hora < 13 ? 'matutino' : 'vespertino'
    if (esperado !== turno) {
      issues.push({
        code: 'hora_turno_divergente',
        severity: 'warning',
        expectedTurno: esperado,
        message: `Horário ${hora} pertence ao ${esperado}, mas o caso está no ${turno}.`,
      })
    }
  }
  return issues
}

export function validarTurnoEscala(turno) {
  return TURNOS_ESCALA.includes(turno)
}

/** Status principal segue o ciclo normal; reversões exigem justificativa. */
export function transicaoStatusEscala(origem, destino, { motivo } = {}) {
  if (!STATUS_PRINCIPAL_ESCALA.includes(origem) || !STATUS_PRINCIPAL_ESCALA.includes(destino)) {
    return { ok: false, code: 'status_invalido' }
  }
  if (origem === destino) return { ok: true, reversible: false }
  const ciclo = { agendada: 'iniciada', iniciada: 'terminada' }
  if (ciclo[origem] === destino) return { ok: true, reversible: false }
  return motivo && String(motivo).trim().length >= 3
    ? { ok: true, reversible: true }
    : { ok: false, code: 'reversao_exige_motivo', reversible: true }
}

/**
 * Extra do caso, aceitando o legado no campo principal (demo e dados anteriores
 * ao desdobramento em dois eixos gravavam o extra em `statusCirurgia`).
 */
export function extraDoCaso(caso) {
  const extra = String(caso?.statusExtra || '')
  if (STATUS_EXTRA_ESCALA.includes(extra)) return extra
  const principal = String(caso?.statusCirurgia || '')
  return STATUS_EXTRA_ESCALA.includes(principal) ? principal : ''
}

/**
 * A cirurgia foi marcada para atravessar o turno ("Passa para tarde"/"Passa para
 * noite" — o valor gravado é `passa_tarde` nos dois, ver passaTurnoLabel).
 */
export function casoPassaDeTurno(caso) {
  return extraDoCaso(caso) === 'passa_tarde'
}

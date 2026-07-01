/**
 * Helpers de apresentação da escala cirúrgica (puro, sem React).
 */
import { resolverAnestesistas } from '@/lib/colunaLiberacao'

/** Normaliza nome p/ comparação (acento/caixa/PED-insensível). */
export const normNome = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^\s*ped\s+/i, '')
    .trim()
    .toUpperCase()

/** Casos com anestesista "//" já resolvido (regra 2), p/ exibição e matching. */
export function casosResolvidos(escala) {
  return escala?.casos?.length ? resolverAnestesistas(escala.casos) : []
}

/** Alias do usuário p/ "Minhas escalas": campo escalaAlias, senão 1º nome. */
export function meuAliasDe(user) {
  return (
    user?.escalaAlias ||
    user?.firstName ||
    String(user?.displayName || '').split(/\s+/)[0] ||
    ''
  ).trim()
}

/** Agrupa casos por sala preservando a ordem (Map sala -> casos[]). */
export function agruparPorSala(casos) {
  const grupos = new Map()
  for (const c of casos) {
    const sala = c.sala || '—'
    if (!grupos.has(sala)) grupos.set(sala, [])
    grupos.get(sala).push(c)
  }
  return grupos
}

/**
 * Rank numérico de uma sala para ordenação do board.
 * Salas numéricas pela própria numeração; nomeadas mapeadas por hospital:
 *   HRO: ORTO → 4, CO → 7.  Unimed: C.O (centro obstétrico) → depois das numéricas.
 * Blocos auxiliares (SRPA/EXAMES/IMAGEM/CONSULTÓRIO/HEMO/IOSC) por último.
 */
export function rankSala(sala, hospital) {
  const s = normNome(sala)
  if (/SRPA|EXAME|IMAGEM|CONSULT|HEMO|IOSC/.test(s)) return 90
  if (hospital === 'hro') {
    if (/\bORTO\b/.test(s)) return 4
    if (/\bCO\b/.test(s)) return 7
  }
  if (/^C\.?\s*O\b/.test(s) || /CENTRO OBSTET/.test(s)) return 80 // C.O (Unimed) após as numéricas
  const m = s.match(/(\d+)/)
  if (m) return Number(m[1])
  return 85
}

/** Comparador de salas por hospital (ordem numérica + mapeamentos). */
export const compararSalas = (hospital) => (a, b) => {
  const d = rankSala(a, hospital) - rankSala(b, hospital)
  return d !== 0 ? d : a.localeCompare(b, 'pt-BR')
}

/**
 * Aplica a atribuição de anestesistas (por sala) aos casos na publicação:
 * grava `anestesistaUserId` (login) e o `anestesista` (apelido p/ exibição).
 * @param {Array} casos
 * @param {Object} atribuicoes  sala -> uid
 * @param {(sala:string, uid:string)=>string} apelidoDe  rótulo de exibição
 */
export function aplicarAtribuicoes(casos, atribuicoes, apelidoDe) {
  return (casos || []).map((c) => {
    // atribuição manual da sala vence; senão preserva um uid já vindo da extração.
    const uid = atribuicoes?.[c.sala] || c.anestesistaUserId || null
    return {
      ...c,
      anestesistaUserId: uid,
      anestesista: atribuicoes?.[c.sala] ? apelidoDe(c.sala, uid) : (c.anestesista || ''),
    }
  })
}

/** Turno de uma hora "HH:MM": matutino (< 13:00) | vespertino. Sem hora → null. */
export function turnoDeHora(hora) {
  const m = /^(\d{1,2}):?(\d{2})?/.exec(String(hora || '').trim())
  if (!m) return null
  const h = Number(m[1])
  if (!Number.isFinite(h)) return null
  return h < 13 ? 'matutino' : 'vespertino'
}

/** Filtra casos pelo turno; casos sem hora aparecem em ambos. */
export function filtrarPorTurno(casos, turno) {
  if (!turno) return casos
  return casos.filter((c) => {
    const t = turnoDeHora(c.hora)
    return t == null || t === turno
  })
}

/** Turno corrente pela hora local (default do seletor). */
export function turnoAtual(d = new Date()) {
  return d.getHours() < 13 ? 'matutino' : 'vespertino'
}

/** "2026-06-27" → "27/06/2026". */
export function formatData(iso) {
  if (!iso) return ''
  const [a, m, d] = String(iso).split('-')
  return d && m && a ? `${d}/${m}/${a}` : iso
}

/** "HH:MM" → minutos do dia; null se inválido/vazio (mesma regex de turnoDeHora). */
export function parseHoraMinutos(hora) {
  const m = /^(\d{1,2}):?(\d{2})?/.exec(String(hora || '').trim())
  if (!m) return null
  const h = Number(m[1])
  const min = m[2] ? Number(m[2]) : 0
  if (!Number.isFinite(h) || h > 23 || min > 59) return null
  return h * 60 + min
}

/** Janela (min) abaixo da qual dois casos do mesmo anestesista conflitam. */
export const JANELA_CONFLITO_MIN = 90

/**
 * Conflitos = mesmo login (anestesista_user_id) em 2 salas com horário sobreposto
 * (< janelaMin). Casos sem hora / sem login / "?" são ignorados. Dedup por par de salas.
 * @returns {Array<{userId,nome,sala1,hora1,sala2,hora2}>}
 */
export function detectarConflitos(casos, janelaMin = JANELA_CONFLITO_MIN) {
  const eleg = (casos || [])
    .filter((c) => c.anestesistaUserId && !c.semAnestesista && parseHoraMinutos(c.hora) != null)
    .map((c) => ({ ...c, _min: parseHoraMinutos(c.hora) }))
  const out = new Map()
  for (let i = 0; i < eleg.length; i++) {
    for (let j = i + 1; j < eleg.length; j++) {
      const a = eleg[i], b = eleg[j]
      if (a.anestesistaUserId !== b.anestesistaUserId) continue
      if (a.sala === b.sala) continue
      if (Math.abs(a._min - b._min) >= janelaMin) continue
      const chave = `${a.anestesistaUserId}|${[a.sala, b.sala].sort().join('|')}`
      if (!out.has(chave)) {
        out.set(chave, {
          userId: a.anestesistaUserId,
          nome: a.anestesista || b.anestesista || '',
          sala1: a.sala, hora1: a.hora, sala2: b.sala, hora2: b.hora,
        })
      }
    }
  }
  return [...out.values()]
}

/**
 * Valida uma troca de sala (uid_a sai de sala_a, uid_b sai de sala_b) — evita
 * o mesmo login em 2 salas no mesmo horário após o swap. Retorna erro (string) ou null.
 */
export function validarConflito(casos, salaA, uidA, salaB, uidB) {
  if (!uidA || !uidB) return 'Ambas as salas precisam de anestesista atribuído.'
  if (uidA === uidB) return 'Não é possível trocar consigo mesmo.'
  if (salaA === salaB) return 'Selecione salas diferentes.'

  const horas = (sala) => new Set((casos || []).filter((c) => c.sala === sala && c.hora).map((c) => c.hora))
  const hB = horas(salaB)
  const conflA = (casos || []).find(
    (c) => c.anestesistaUserId === uidA && c.sala !== salaA && c.sala !== salaB && hB.has(c.hora)
  )
  if (conflA) return `Você já está na sala ${conflA.sala} no mesmo horário da sala alvo.`
  const hA = horas(salaA)
  const conflB = (casos || []).find(
    (c) => c.anestesistaUserId === uidB && c.sala !== salaA && c.sala !== salaB && hA.has(c.hora)
  )
  if (conflB) return `O colega tem casos na sala ${conflB.sala} no mesmo horário da sua sala.`
  return null
}

/** Anestesista (login+apelido) que cobre uma sala, a partir dos casos. */
export function anestesistaDaSala(casos, sala) {
  const c = (casos || []).find((x) => x.sala === sala && x.anestesistaUserId)
  return c ? { uid: c.anestesistaUserId, alias: c.anestesista || '' } : { uid: null, alias: '' }
}

/** Salas com anestesista atribuído (uid), únicas — p/ o seletor de troca. */
export function salasComAnestesista(casos) {
  const vistos = new Set()
  const out = []
  for (const c of casos || []) {
    if (c.anestesistaUserId && !vistos.has(c.sala)) { vistos.add(c.sala); out.push({ sala: c.sala, uid: c.anestesistaUserId, alias: c.anestesista || '' }) }
  }
  return out
}

/** Variante de Badge p/ o tipo do caso. */
export const tipoBadge = (tipo) =>
  tipo === 'emergencia'
    ? { variant: 'destructive', label: 'Emergência' }
    : tipo === 'urgencia'
    ? { variant: 'warning', label: 'Urgência' }
    : null

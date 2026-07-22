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
  // Ordem canônica (dono, 2026-07-21) p/ Unimed E HRO:
  //   [CO Unimed] → salas numéricas/CC → Hemodinâmica → SRPA → Exames → Imagem →
  //   demais locais em ORDEM ALFABÉTICA (outros hospitais na mesma escala —
  //   o tie-break alfabético do comparador resolve dentro do rank 85).
  if (hospital === 'unimed' || hospital === 'hro') {
    if (hospital === 'unimed') {
      if (/^C\.?\s*O\b/.test(s) || /CENTRO OBSTET/.test(s)) {
        if (/CESAR/.test(s)) return 0
        const n = s.match(/(\d+)/)
        return 1 + (n ? Number(n[1]) / 100 : 0)
      }
      if (/^CC\b/.test(s) || /CENTRO CIRURGICO/.test(s)) {
        const n = s.match(/(\d+)/)
        return 10 + (n ? Number(n[1]) : 0)
      }
    } else {
      // HRO (ordem do dono 2026-07-22): salas numéricas → Bloco M → Hemodinâmica →
      // Exames → Imagem → Braquiterapia → Consultório → demais alfabético
      // (Centro de Coluna, Digimax, Hospital de Olhos, IOSC, Ambulatorial…)
      if (/BLOCO\s*M/.test(s)) {
        const n = s.match(/(\d+)/)
        return 30 + (n ? Number(n[1]) / 100 : 0)
      }
      if (/\bORTO\b/.test(s)) return 14
      if (/\bCO\b/.test(s)) return 17 // CO do HRO = Sala 7
      if (/EMERG/.test(s) && !/\d/.test(s)) return 15 // Emergência sozinha = Sala 5
      if (/HEMO/.test(s)) return 60
      if (/EXAME/.test(s)) return 62
      if (/IMAGEM/.test(s)) return 64
      if (/BRAQUI/.test(s)) return 66
      if (/CONSULT/.test(s)) return 68
      const m = s.match(/(\d+)/)
      if (m) return 10 + Number(m[1])
      return 85
    }
    if (/HEMO/.test(s)) return 60
    if (/SRPA/.test(s)) return 62
    if (/EXAME/.test(s)) return 64
    if (/IMAGEM/.test(s)) return 66
    const m = s.match(/(\d+)/)
    if (m) return 10 + Number(m[1]) // "Sala N"/"CC - Sala N"
    return 85 // demais locais → alfabético
  }
  if (/SRPA|EXAME|IMAGEM|CONSULT|HEMO|IOSC/.test(s)) return 90
  if (/^C\.?\s*O\b/.test(s) || /CENTRO OBSTET/.test(s)) return 80 // C.O após as numéricas
  const m = s.match(/(\d+)/)
  if (m) return Number(m[1])
  return 85
}

/**
 * Normaliza o rótulo de sala da escala Unimed na IMPORTAÇÃO (pedido 2026-07-21):
 * "CENTRO CIRÚRGICO - SALA 1" → "CC - Sala 1"; "CO - CESAREA" → "CO - Cesárea".
 * Rótulos curtos cabem no mobile sem truncar.
 */
export function normalizarSalaUnimed(sala) {
  const raw = String(sala || '').trim()
  const s = normNome(raw)
  if (!s) return raw
  let m = s.match(/CENTRO\s+CIRURGICO.*?(\d+)/) || (/^CC\b/.test(s) ? s.match(/(\d+)/) : null)
  if (m) return `CC - Sala ${m[1]}`
  if (/^C\.?\s*O\b/.test(s) || /CENTRO OBSTET/.test(s)) {
    if (/CESAR/.test(s)) return 'CO - Cesárea'
    const n = s.match(/(\d+)/)
    return n ? `CO - Sala ${n[1]}` : 'CO'
  }
  if (/SRPA/.test(s)) return 'SRPA'
  if (/EXAME/.test(s)) return 'Exames'
  if (/IMAGEM/.test(s)) return 'Imagem'
  if (/HEMO/.test(s)) return 'Hemodinâmica'
  if (/CONSULT/.test(s)) return 'Consultório'
  if (/UMANITA/.test(s)) return 'Umanitá'
  if (/ACCURATA/.test(s)) return 'Accurata'
  return raw
}

/**
 * Normaliza o rótulo de sala da escala HRO na importação (regras do dono 2026-07-21):
 * "CO" → "Sala 7 - CO" (o CO do HRO é a sala 7); "HO"/"H.O." → "Hospital de Olhos".
 */
export function normalizarSalaHro(sala) {
  const raw = String(sala || '').trim()
  const s = normNome(raw)
  if (!s) return raw
  if (/^H\.?\s*O\.?$/.test(s) || /HOSPITAL DE OLHOS/.test(s)) return 'Hospital de Olhos'
  if (/^C\.?\s*O\.?$/.test(s)) return 'Sala 7 - CO'
  if (/^EMERG/.test(s) && !/\d/.test(s)) return 'Sala 5 - Emergência' // Emergência sozinha = Sala 5
  if (/BLOCO\s*M/.test(s)) {
    const n = s.match(/(\d+)/)
    return n ? `Bloco M - Sala ${n[1]}` : 'Bloco M'
  }
  if (/^EXAMES?$/.test(s)) return 'Exames'
  if (/^CONSULT/.test(s)) return 'Consultório'
  if (/^IMAGEM$/.test(s)) return 'Imagem'
  if (/^HEMO/.test(s)) return 'Hemodinâmica'
  if (/BRAQUI/.test(s)) return 'Braquiterapia'
  if (/^IOSC$/.test(s)) return 'IOSC'
  if (/C\.?\s*COLUNA|CENTRO DE COLUNA/.test(s)) return 'Centro de Coluna'
  if (/DIGIMAX/.test(s)) return 'Digimax'
  if (/AMBULATORI/.test(s)) return 'Ambulatorial'
  return raw
}

/**
 * Rótulo de EXIBIÇÃO da sala (pedido 2026-07-21): EXAMES → "Exames",
 * CONSULT./CONSULTORIO → "Consultório", sempre — vale também para escalas já
 * salvas com o rótulo cru (a normalização de importação cobre só as novas).
 */
export function salaExibicao(sala) {
  const s = normNome(sala)
  if (/^EXAMES?$/.test(s)) return 'Exames'
  if (/^CONSULT/.test(s)) return 'Consultório'
  if (/^IMAGEM$/.test(s)) return 'Imagem'
  if (/^HEMO/.test(s)) return 'Hemodinâmica'
  if (/^BRAQUI/.test(s)) return 'Braquiterapia'
  return String(sala || '').trim()
}

/**
 * Rótulo de sala NAS LIBERAÇÕES (2026-07-22): abreviado p/ caber no card —
 * "Hospital de Olhos" → "HO". Demais seguem salaExibicao.
 */
export function salaLiberacao(sala) {
  if (/HOSPITAL DE OLHOS/.test(normNome(sala))) return 'HO'
  return salaExibicao(sala)
}

/** Bloco derivado do rótulo de sala normalizado (importação Unimed sem Vision). */
export function blocoDaSalaUnimed(sala) {
  const s = normNome(sala)
  if (/SRPA/.test(s)) return 'srpa'
  if (/EXAME/.test(s)) return 'exames'
  if (/IMAGEM/.test(s)) return 'imagem'
  if (/HEMO/.test(s)) return 'hemodinamica'
  if (/CONSULT/.test(s)) return 'consultorio'
  if (/UMANITA/.test(s)) return 'umanita'
  if (/ACCURATA/.test(s)) return 'accurata'
  return 'normal'
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

/** "01:30" → 90 minutos; null se não for duração hh:mm válida. */
export function parseDuracaoMin(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim())
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

/** Status que encerram o caso p/ fins de estimativa/fechamento de sala. */
export const STATUS_CONCLUIDO = ['terminada', 'suspensa']

/**
 * Caso concluído p/ fins de sala (não conta no cronômetro/fechamento):
 * terminada (principal) OU suspensa — que hoje vive em statusExtra
 * (aceita o valor legado no campo principal p/ demo/dados antigos).
 */
export const casoConcluido = (c) =>
  STATUS_CONCLUIDO.includes(c?.statusCirurgia || 'agendada') || c?.statusExtra === 'suspensa'

/**
 * Estimativa de término de uma SALA: maior (hora início + tempoEstimado) entre
 * os casos ATIVOS (terminada/suspensa não contam). Sem hora+tempo não contribui.
 * @returns {{ estado:'encerrada' }|{ estado:'estimado', fimMin:number }|null}
 */
export function estimativaTerminoSala(casos, sala) {
  let total = 0
  let ativos = 0
  let fimMax = null
  for (const c of casos || []) {
    if (c.sala !== sala) continue
    total += 1
    if (casoConcluido(c)) continue
    ativos += 1
    const ini = parseHoraMinutos(c.hora)
    const dur = parseDuracaoMin(c.tempoEstimado)
    if (ini == null || dur == null) continue
    const fim = ini + dur
    if (fimMax == null || fim > fimMax) fimMax = fim
  }
  if (total > 0 && ativos === 0) return { estado: 'encerrada' }
  if (fimMax != null) return { estado: 'estimado', fimMin: fimMax }
  return null
}

/** Texto do cronômetro: diferença entre a estimativa e agora (minutos do dia). */
export function formatRestante(fimMin, agoraMin) {
  const diff = fimMin - agoraMin
  const abs = Math.abs(diff)
  const txt = abs >= 60 ? `${Math.floor(abs / 60)}h${String(abs % 60).padStart(2, '0')}` : `${abs}min`
  return diff >= 0 ? `termina em ~${txt}` : `há ${txt} além do previsto`
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

/** Normaliza convênio p/ classificação (acento/caixa; NÃO usa normNome — não tem regra PED). */
const normConvenio = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()

/**
 * Família do convênio p/ identificação visual rápida no board.
 * "Unimed Regional" e "UNIMED CHAPECÓ" caem na mesma família; texto vazio → null.
 */
export function familiaConvenio(convenio) {
  const s = normConvenio(convenio)
  if (!s) return null
  if (s.includes('INTERCAMB')) return 'intercambio' // antes de UNIMED: "Unimed Intercâmbio" é regime próprio
  if (s.startsWith('UNIMED')) return 'unimed'
  if (/^SUS\b/.test(s)) return 'sus'
  if (s.startsWith('BRF')) return 'brf'
  if (s.startsWith('FAS')) return 'fas'
  if (/^SC\b/.test(s)) return 'sc'
  if (s.startsWith('CASSI')) return 'cassi'
  if (s.startsWith('PARTICULAR')) return 'particular'
  return 'outro'
}

// Classes ESTÁTICAS por família — string dinâmica seria purgada pelo Tailwind JIT.
// Tokens category-* (cores não-semânticas, .claude/rules/design-tokens.md); verde/vermelho
// ficam de fora p/ não competir com os status success/warning/destructive do card.
// DARK: pedido do dono (2026-07-16) — badge de convênio uniforme no verde sólido do
// badge success (identificação por cor fica na stripe da borda esquerda).
const BADGE_DARK_VERDE = 'dark:bg-[hsl(var(--badge-success))] dark:text-[hsl(var(--badge-success-foreground))]'
const CONVENIO_CORES = {
  unimed: { stripe: 'border-l-category-teal', badge: `bg-category-teal-bg text-category-teal-fg ${BADGE_DARK_VERDE}` },
  sus: { stripe: 'border-l-category-blue', badge: `bg-category-blue-bg text-category-blue-fg ${BADGE_DARK_VERDE}` },
  particular: { stripe: 'border-l-category-purple', badge: `bg-category-purple-bg text-category-purple-fg ${BADGE_DARK_VERDE}` },
  brf: { stripe: 'border-l-category-orange', badge: `bg-category-orange-bg text-category-orange-fg ${BADGE_DARK_VERDE}` },
  fas: { stripe: 'border-l-category-indigo', badge: `bg-category-indigo-bg text-category-indigo-fg ${BADGE_DARK_VERDE}` },
  sc: { stripe: 'border-l-category-cyan', badge: `bg-category-cyan-bg text-category-cyan-fg ${BADGE_DARK_VERDE}` },
  intercambio: { stripe: 'border-l-category-pink', badge: `bg-category-pink-bg text-category-pink-fg ${BADGE_DARK_VERDE}` },
  // category-red só tem -bg/-fg; o stripe usa o -fg. Vermelho na lateral não compete
  // com status (que é FUNDO amarelo/verde) nem com liberado (outra aba).
  cassi: { stripe: 'border-l-category-red-fg', badge: `bg-category-red-bg text-category-red-fg ${BADGE_DARK_VERDE}` },
  outro: { stripe: 'border-l-border-strong', badge: `border border-border bg-muted/40 text-muted-foreground ${BADGE_DARK_VERDE} dark:border-transparent` },
}

/** Stripe (borda esquerda) + badge do convênio; null se o caso não tem convênio. */
export function corConvenio(convenio) {
  const familia = familiaConvenio(convenio)
  return familia ? { familia, ...CONVENIO_CORES[familia] } : null
}

/** Badge do tipo do caso — ambos em tons de VERMELHO (pedido do dono 2026-07-21):
 *  urgência = vermelho suave (subtle); emergência = vermelho cheio (solid). */
export const tipoBadge = (tipo) =>
  tipo === 'emergencia'
    ? { variant: 'destructive', style: 'solid', label: 'Emergência' }
    : tipo === 'urgencia'
    ? { variant: 'destructive', style: 'subtle', label: 'Urgência' }
    : null

/**
 * HORÁRIO REAL de início e de término de cada cirurgia (dono 2026-10-02, modelo A
 * escolhido em protótipo `.tmp/inicio-termino-cirurgia.html`): "quero que seja
 * possível adicionar o horário de início e fim de cada procedimento".
 *
 * Dois campos "HH:MM" no caso — `inicioReal` e `terminoReal` —, no mesmo formato de
 * `hora` e `terminoPrevisto`. Enquanto a cirurgia corre, o "término" da tela é a
 * PREVISÃO (`terminoPrevisto`, que dirige a fila, a pílula e o quadro); o real só
 * existe depois de "Terminada".
 *
 * O horário ANDA JUNTO com o status (decisão do dono, 02/10) e quem garante isso é o
 * trigger `tr_escala_caso_horario_real` (migration 20261002190000) — vale para todo
 * caminho que muda o status. `horarioRealNaTransicao` é o ESPELHO dele no otimista:
 * mudou a regra lá, muda aqui (e o teste do par trava os dois lados).
 *
 * ⚠️ Valor informado à mão nunca é sobrescrito pelo toque: o trigger só preenche
 * vazio. É isso que conserta a marcação em lote (41% das marcações na revisão de
 * 25/09) — a hora do toque é o ponto de partida, não a última palavra.
 */
import { agora } from '@/lib/devClock'
import { diffRelogioMin, parseHoraMinutos } from '@/pages/escala-cirurgica/utils'

const pad = (n) => String(n).padStart(2, '0')
const isoDe = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** "HH:MM" de um Date (relógio do aparelho — o mesmo fuso do trigger, America/Sao_Paulo). */
export function hhmmDe(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * O que o trigger grava quando o status principal muda — para o otimista pintar o
 * MESMO que o banco vai devolver (senão o bloco do horário pisca no refetch).
 *   → agendada : os dois somem;
 *   → iniciada : início = o informado, o que já havia, ou a hora do toque; o término
 *                real some (cirurgia reaberta não terminou);
 *   → terminada: término = o que já havia ou a hora do toque; início vazio de quem
 *                estava iniciada = a hora em que foi marcada iniciada.
 * Sem mudança de status, só o início informado (ou nada).
 *
 * @param {object} vivo  o caso antes do toque
 * @param {string} status
 * @param {{agoraD?: Date, inicioInformado?: string|null}} [opts]
 * @returns {{inicioReal?: string|null, terminoReal?: string|null}}
 */
export function horarioRealNaTransicao(vivo, status, { agoraD = agora(), inicioInformado = null } = {}) {
  const antes = vivo?.statusCirurgia || 'agendada'
  if (!['agendada', 'iniciada', 'terminada'].includes(status) || status === antes) {
    return inicioInformado ? { inicioReal: inicioInformado } : {}
  }
  if (status === 'agendada') return { inicioReal: null, terminoReal: null }
  if (status === 'iniciada') {
    return { inicioReal: inicioInformado || vivo?.inicioReal || hhmmDe(agoraD), terminoReal: null }
  }
  const doCarimbo = antes === 'iniciada' && vivo?.statusAtualizadoEm ? hhmmDe(new Date(vivo.statusAtualizadoEm)) : null
  return { inicioReal: vivo?.inicioReal || doCarimbo || null, terminoReal: vivo?.terminoReal || hhmmDe(agoraD) }
}

/**
 * A escala é a do DIA OPERACIONAL de agora? Hoje, ou ontem antes das 07:00 (a noite
 * é continuação da tarde — mesma régua de `minutoNoDiaOperacional` das urgências).
 * Fora dele "agora" não diz nada sobre a cirurgia: nem "em sala há", nem "no futuro".
 */
export function ehDiaOperacionalAtual(dataEscala, agoraD = agora()) {
  if (!dataEscala) return true
  if (dataEscala === isoDe(agoraD)) return true
  const ontem = new Date(agoraD.getTime())
  ontem.setDate(ontem.getDate() - 1)
  return dataEscala === isoDe(ontem) && agoraD.getHours() < 7
}

/** Minutos entre dois "HH:MM" (atravessa a meia-noite); null se não dá para medir. */
export function duracaoMin(inicio, fim) {
  const a = parseHoraMinutos(inicio)
  const b = parseHoraMinutos(fim)
  if (a == null || b == null) return null
  const d = diffRelogioMin(b, a)
  return d >= 0 ? d : null
}

/** "1h17" / "40min" — o mesmo formato do resto do módulo. */
export function rotuloMinutos(min) {
  if (min == null || min < 0) return ''
  return min >= 60 ? `${Math.floor(min / 60)}h${pad(min % 60)}` : `${min}min`
}

/**
 * Por que um horário real informado à mão NÃO pode ser gravado — ou null.
 * Nunca no futuro (só se sabe isso no dia operacional da escala) e nunca com o
 * início depois do término.
 *
 * @param {{campo:'inicio'|'termino', hhmm:string, inicioReal?:string, terminoReal?:string,
 *          dataEscala?:string, agoraD?:Date}} p
 */
export function erroHorarioReal({ campo, hhmm, inicioReal = null, terminoReal = null, dataEscala = null, agoraD = agora() }) {
  const alvo = parseHoraMinutos(hhmm)
  if (alvo == null) return 'Horário inválido.'
  if (ehDiaOperacionalAtual(dataEscala, agoraD)) {
    const agoraMin = agoraD.getHours() * 60 + agoraD.getMinutes()
    if (diffRelogioMin(alvo, agoraMin) > 1) {
      return campo === 'inicio' ? 'O início não pode ser depois de agora.' : 'O término não pode ser depois de agora.'
    }
  }
  if (campo === 'inicio' && terminoReal && duracaoMin(hhmm, terminoReal) == null) {
    return `O início não pode ser depois do término (${terminoReal}).`
  }
  if (campo === 'termino' && inicioReal && duracaoMin(inicioReal, hhmm) == null) {
    return `O término não pode ser antes do início (${inicioReal}).`
  }
  return null
}

/**
 * Grava o INÍCIO informado à mão — a MESMA regra no detalhe do caso (Completa,
 * Minhas, Urgências) e na folha do "+ Tempo total" (Liberações), por isso uma função
 * só: numa cirurgia AGENDADA, informar o início é dizer que ela começou, então vai
 * pelo `setStatusCirurgia` com o horário junto (o context grava o início antes da RPC
 * e o trigger não o troca pela hora do toque); já iniciada/terminada, é só a correção
 * do horário. Vazio ("Limpar") só apaga o horário — não mexe no status.
 *
 * @returns {Promise<void>}
 */
export function gravarInicioReal({ escala, caso, hhmm, userId = null, setStatusCirurgia, atualizarCaso }) {
  if (!caso?.id) return Promise.resolve()
  if (hhmm && (caso.statusCirurgia || 'agendada') === 'agendada') {
    return setStatusCirurgia(escala, caso, 'iniciada', { userId, inicioReal: hhmm })
  }
  return atualizarCaso(escala, caso.id, { inicioReal: hhmm || null }, { silencioso: true })
}

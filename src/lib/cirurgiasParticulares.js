/**
 * Cirurgias Particulares — lógica pura do módulo de cobrança.
 *
 * Filtros de período/status, totais do relatório e regras da integração
 * com a Escala Cirúrgica (import de casos PARTICULAR).
 * Sem dependência de React/Supabase — testável em Vitest.
 */
import { familiaConvenio } from '@/pages/escala-cirurgica/utils'

/** Helper numérico: NUMERIC do Postgres pode chegar como string no supabase-js. */
const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// ============================================================================
// STATUS DE PAGAMENTO
// ============================================================================

/** Ordem canônica de exibição (tabs/relatório). */
export const STATUS_PAGAMENTO = [
  { value: 'pendente', label: 'Pendente', badgeVariant: 'warning' },
  { value: 'pago', label: 'Pago', badgeVariant: 'success' },
  { value: 'glosado', label: 'Glosado', badgeVariant: 'destructive' },
]

export const STATUS_LABEL = Object.fromEntries(STATUS_PAGAMENTO.map((s) => [s.value, s.label]))
export const STATUS_BADGE_VARIANT = Object.fromEntries(
  STATUS_PAGAMENTO.map((s) => [s.value, s.badgeVariant])
)

// ============================================================================
// FILTROS
// ============================================================================

/** Lançamentos ativos = não cancelados (soft-cancel via canceladaEm). */
export function filtrarAtivas(registros = []) {
  return registros.filter((r) => r && !r.canceladaEm)
}

/**
 * Filtra por período de dataCirurgia, bounds INCLUSIVOS.
 * Compara strings YYYY-MM-DD direto (ordem lexicográfica = cronológica) —
 * sem new Date() para não sofrer virada de dia em UTC-3.
 * Limite ausente (null/'') = aberto daquele lado.
 */
export function filtrarPorPeriodo(registros = [], inicioISO = null, fimISO = null) {
  return registros.filter((r) => {
    const d = r?.dataCirurgia
    if (!d) return false
    if (inicioISO && d < inicioISO) return false
    if (fimISO && d > fimISO) return false
    return true
  })
}

// ============================================================================
// TOTAIS DO RELATÓRIO
// ============================================================================

/**
 * Totais do período: geral + por status de pagamento.
 * Status desconhecido não quebra — cai fora dos buckets conhecidos mas
 * conta no total (o registro existe e vale dinheiro).
 */
export function computeTotais(registros = []) {
  const porStatus = Object.fromEntries(
    STATUS_PAGAMENTO.map((s) => [s.value, { count: 0, valor: 0 }])
  )
  let count = 0
  let valor = 0

  for (const r of registros) {
    if (!r) continue
    count += 1
    const v = num(r.valor)
    valor += v
    const bucket = porStatus[r.statusPagamento]
    if (bucket) {
      bucket.count += 1
      bucket.valor += v
    }
  }

  return { total: { count, valor }, porStatus }
}

/**
 * Resumo por anestesista p/ o PDF: agrupa por nome exibido, soma valores
 * por status. Ordena por valor total desc (quem mais faturou primeiro).
 */
export function resumoPorAnestesista(registros = []) {
  const map = new Map()
  for (const r of registros) {
    if (!r) continue
    const nome = r.anestesistaNome || '—'
    if (!map.has(nome)) {
      map.set(nome, { anestesista: nome, count: 0, valorTotal: 0, valorPago: 0, valorPendente: 0, valorGlosado: 0 })
    }
    const acc = map.get(nome)
    const v = num(r.valor)
    acc.count += 1
    acc.valorTotal += v
    if (r.statusPagamento === 'pago') acc.valorPago += v
    else if (r.statusPagamento === 'glosado') acc.valorGlosado += v
    else acc.valorPendente += v
  }
  return [...map.values()].sort((a, b) => b.valorTotal - a.valorTotal)
}

// ============================================================================
// VALOR EM R$
// ============================================================================

/**
 * Converte texto digitado em número: aceita "1.234,56" (pt-BR), "1234,56",
 * "1234.56" e "1234". Retorna null para vazio/inválido/negativo.
 */
export function parseValorBRL(str) {
  const s = String(str ?? '').trim()
  if (!s) return null
  let normalized = s.replace(/\s|R\$/g, '')
  if (normalized.includes(',')) {
    // vírgula é o separador decimal → pontos são de milhar
    normalized = normalized.replace(/\./g, '').replace(',', '.')
  }
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null
  const n = Number(normalized)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100) / 100
}

// ============================================================================
// INTEGRAÇÃO COM A ESCALA CIRÚRGICA
// ============================================================================

/**
 * true se o texto ainda parece INICIAIS (padrão da escala: "C.S.G.", "MC") —
 * espelho do CHECK de escala_cirurgica_caso.paciente_iniciais
 * (`!~ '[[:alpha:]]{3,}'`): nome de verdade tem alguma palavra com 3+ letras.
 * Usado p/ bloquear o save enquanto o nome importado não foi completado.
 */
export function pareceIniciais(str) {
  const s = String(str || '').trim()
  if (!s) return true
  return !/\p{L}{3,}/u.test(s)
}

/**
 * Caso da escala importável p/ cobrança: convênio da família PARTICULAR e
 * não suspenso (statusExtra da escala; suspensa não gera cobrança — se o
 * plantonista reverter o toggle, o caso volta a ser importável sozinho).
 */
export function casoImportavel(caso) {
  if (!caso) return false
  if (familiaConvenio(caso.convenio) !== 'particular') return false
  if (caso.statusExtra === 'suspensa') return false
  return true
}

/** Rótulo de exibição do hospital da escala (valores do cabeçalho). */
export const HOSPITAL_LABEL = {
  unimed: 'Unimed',
  hro: 'HRO',
  materno: 'Materno-infantil',
}

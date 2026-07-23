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
 * Caso da escala importável p/ cobrança (mesma regra do trigger
 * fn_sync_cirurgia_particular): convênio PURAMENTE particular (composto
 * "PART/SC" é ambíguo — regra do dono 2026-07-22), paciente IDENTIFICADO
 * (lote sem paciente não cobra) e não suspenso.
 */
export function casoImportavel(caso) {
  if (!caso) return false
  if (familiaConvenio(caso.convenio) !== 'particular') return false
  if (!String(caso.pacienteIniciais || '').trim()) return false
  if (caso.statusExtra === 'suspensa') return false
  return true
}

/**
 * GUIA NÃO PREENCHIDA (conferência, pedido do dono 2026-07-23): sem nome
 * completo OU sem CPF OU sem valor. Valor é opcional NO CADASTRO (pode
 * lançar sem precificar), mas a guia só está "preenchida" p/ cobrança com
 * os três — badge "Completar dados" + alertas pós-turno usam este critério
 * (espelho do fn_alertar_guias_nao_preenchidas no banco).
 */
export function precisaCompletar(registro) {
  if (!registro) return false
  return (
    pareceIniciais(registro.paciente) ||
    !registro.pacienteCpf ||
    !(Number(registro.valor) > 0)
  )
}

// ============================================================================
// CPF (obrigatório no form da guia — decisão do dono 2026-07-22)
// ============================================================================

/** Remove tudo que não é dígito. */
export const limparCPF = (str) => String(str || '').replace(/\D/g, '')

/** Formata 11 dígitos como 000.000.000-00 (parcial conforme digita). */
export function formatarCPF(str) {
  const d = limparCPF(str).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

/**
 * Valida CPF pelos dígitos verificadores (algoritmo oficial).
 * Rejeita tamanho ≠ 11 e sequências repetidas (111.111.111-11 etc.).
 */
export function validarCPF(str) {
  const d = limparCPF(str)
  if (d.length !== 11) return false
  if (/^(\d)\1{10}$/.test(d)) return false
  const dv = (len) => {
    let soma = 0
    for (let i = 0; i < len; i++) soma += Number(d[i]) * (len + 1 - i)
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10])
}

/** Rótulo de exibição do hospital da escala (valores do cabeçalho). */
export const HOSPITAL_LABEL = {
  unimed: 'Unimed',
  hro: 'HRO',
  materno: 'Materno-infantil',
}

/**
 * Cateter Peridural - Configuration
 */
import { Activity, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'

// Hospitais
export const HOSPITAIS = {
  unimed: { label: 'Unimed', value: 'unimed' },
  hro: { label: 'HRO', value: 'hro' },
}

export const HOSPITAIS_OPTIONS = Object.values(HOSPITAIS)

// Status do cateter
export const CATETER_STATUS = {
  ativo: { label: 'Ativo', variant: 'success', icon: Activity },
  retirado: { label: 'Retirado', variant: 'secondary', icon: CheckCircle2 },
}

// Tamanhos de cateter peridural
export const TAMANHOS_CPD = ['16G', '18G', '20G']

// Opções de sítio de inserção
export const SITIO_INSERCAO_OPTIONS = [
  'Normal',
  'Hiperemia',
  'Edema',
  'Secreção',
  'Dor local',
]

// Escala de Bromage (bloqueio motor)
export const BROMAGE_SCALE = [
  { value: 0, label: '0 - Sem bloqueio (movimento completo)' },
  { value: 1, label: '1 - Incapaz de elevar perna estendida' },
  { value: 2, label: '2 - Incapaz de flexionar joelho' },
  { value: 3, label: '3 - Incapaz de flexionar tornozelo' },
]

// Duração máxima e alerta
export const MAX_DURATION_HOURS = 96
export const WARNING_DURATION_HOURS = 72

// Alerta de "cateter não evoluído" — horas SEM evolução PO (ciclo diário).
// Eixo distinto do de duração total: cobra evolução diária do cateter ativo.
//
// 30/42h, não 24/36 (ajuste 08/08): a visita diária não acontece na mesma hora
// todo dia — os intervalos reais entre evoluções em produção foram 21,8h · 25,2h
// · 25,4h · 31,3h · 34,4h. Com o corte em 24h, um cateter evoluído TODO DIA
// acendia o alerta na janela entre a hora da visita de ontem e a de hoje, e ele
// sumia sozinho quando a visita do dia era registrada. 30h tolera ~6h de deriva
// da rotina; 42h significa que um dia inteiro foi pulado.
// ⚠️ Espelhados em notify_cateter_reminders() (migration 20260808120000) —
// mudar aqui exige mudar lá.
export const EVOLUCAO_WARNING_HOURS = 30
export const EVOLUCAO_CRITICAL_HOURS = 42

// Complicações comuns
export const COMPLICACOES_COMUNS = [
  'Hematoma',
  'Abscesso',
  'Hipotensão',
  'Prurido',
  'Retirada acidental',
  'Migração',
  'Infecção',
]

// Motivos comuns de retirada
export const MOTIVOS_RETIRADA = [
  'Término do tratamento',
  'Complicação',
  'Retirada acidental',
  'Alta hospitalar',
  'Solicitação médica',
  'Duração máxima atingida',
  'Outro',
]

/**
 * Calcula horas desde a inserção do cateter
 */
export function calcHorasCateter(dataInsercao) {
  if (!dataInsercao) return 0
  const now = new Date()
  const insercao = new Date(dataInsercao)
  return Math.floor((now - insercao) / (1000 * 60 * 60))
}

/**
 * Retorna nível de alerta baseado nas horas
 */
export function getAlertLevel(dataInsercao) {
  const horas = calcHorasCateter(dataInsercao)
  if (horas >= MAX_DURATION_HOURS) return 'critical'
  if (horas >= WARNING_DURATION_HOURS) return 'warning'
  return 'normal'
}

/**
 * Horas desde a última evolução PO. Se o cateter nunca foi evoluído
 * (ultimaAvaliacaoAt ausente), conta desde a inserção.
 */
export function calcHorasSemAvaliacao(ultimaAvaliacaoAt, dataInsercao) {
  const base = ultimaAvaliacaoAt || dataInsercao
  if (!base) return 0
  const ref = new Date(base)
  if (Number.isNaN(ref.getTime())) return 0
  return Math.floor((Date.now() - ref.getTime()) / (1000 * 60 * 60))
}

/**
 * Nível de alerta de "não evoluído" (horas sem evolução PO).
 */
export function getEvolucaoAlertLevel(ultimaAvaliacaoAt, dataInsercao) {
  const horas = calcHorasSemAvaliacao(ultimaAvaliacaoAt, dataInsercao)
  if (horas >= EVOLUCAO_CRITICAL_HOURS) return 'critical'
  if (horas >= EVOLUCAO_WARNING_HOURS) return 'warning'
  return 'normal'
}

/**
 * Formata uma quantidade de horas em "Xd Yh" (omite o dia quando < 24h).
 */
export function formatDuracaoHoras(horas) {
  if (!Number.isFinite(horas) || horas < 0) return '0h'
  const dias = Math.floor(horas / 24)
  return dias > 0 ? `${dias}d ${horas % 24}h` : `${horas % 24}h`
}

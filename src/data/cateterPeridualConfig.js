/**
 * Cateter Peridural - Configuration
 */
import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react'

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

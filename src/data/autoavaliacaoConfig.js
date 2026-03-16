/**
 * Autoavaliacao Qmentum - Configuration
 */
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Shield,
  MessageSquare,
  Pill,
  Heart,
  ShieldAlert,
  Activity,
  FileText,
  ClipboardCheck,
  GraduationCap,
  TrendingUp,
  Paperclip,
} from 'lucide-react'
import ropsData from '@/data/rops-data'

// Status de avaliacao (cores alinhadas ao DS)
export const AVALIACAO_STATUS = {
  conforme: {
    label: 'Conforme',
    color: '#34C759',
    bgColor: '#E8F5E9',
    darkBgColor: '#243530',
    icon: CheckCircle2,
    variant: 'success',
  },
  parcialmente_conforme: {
    label: 'Parcialmente Conforme',
    color: '#F59E0B',
    bgColor: '#FFFBEB',
    darkBgColor: '#3D2F0A',
    icon: AlertTriangle,
    variant: 'warning',
  },
  nao_conforme: {
    label: 'Não Conforme',
    color: '#DC2626',
    bgColor: '#FEF2F2',
    darkBgColor: '#7F1D1D',
    icon: XCircle,
    variant: 'destructive',
  },
  nao_avaliado: {
    label: 'Não Avaliado',
    color: '#6B7280',
    bgColor: '#E8F5E9',
    darkBgColor: '#243530',
    icon: HelpCircle,
    variant: 'secondary',
  },
}

// Opcoes de ciclo trimestral
export const CYCLE_OPTIONS = [
  { id: '2026-Q1', label: '1\u00B0 Trimestre 2026', startDate: '2026-01-01', endDate: '2026-03-31' },
  { id: '2026-Q2', label: '2\u00B0 Trimestre 2026', startDate: '2026-04-01', endDate: '2026-06-30' },
  { id: '2026-Q3', label: '3\u00B0 Trimestre 2026', startDate: '2026-07-01', endDate: '2026-09-30' },
  { id: '2026-Q4', label: '4\u00B0 Trimestre 2026', startDate: '2026-10-01', endDate: '2026-12-31' },
  { id: '2025-Q4', label: '4\u00B0 Trimestre 2025', startDate: '2025-10-01', endDate: '2025-12-31' },
]

// Configuracao das 6 areas macro (cor unificada DS primary)
const DS_PRIMARY = '#006837'
export const AREA_CONFIG = {
  'cultura-seguranca': { title: 'Cultura de Segurança', color: DS_PRIMARY, icon: Shield, ropCount: 4 },
  'comunicacao': { title: 'Comunicação', color: DS_PRIMARY, icon: MessageSquare, ropCount: 9 },
  'uso-medicamentos': { title: 'Uso de Medicamentos', color: DS_PRIMARY, icon: Pill, ropCount: 5 },
  'vida-profissional': { title: 'Vida Profissional', color: DS_PRIMARY, icon: Heart, ropCount: 5 },
  'prevencao-infeccoes': { title: 'Prevenção de Infecções', color: DS_PRIMARY, icon: ShieldAlert, ropCount: 5 },
  'avaliacao-riscos': { title: 'Avaliação de Riscos', color: DS_PRIMARY, icon: Activity, ropCount: 4 },
}

// Total: 32 ROPs

// Tipos de evidencia
export const EVIDENCE_TYPES = [
  { id: 'documento', label: 'Documento', icon: FileText },
  { id: 'auditoria', label: 'Auditoria Interativa', icon: ClipboardCheck },
  { id: 'incidente', label: 'Incidente/Relato', icon: AlertTriangle },
  { id: 'treinamento', label: 'Treinamento', icon: GraduationCap },
  { id: 'indicador', label: 'Indicador', icon: TrendingUp },
  { id: 'outro', label: 'Outro', icon: Paperclip },
]

// ============================================================================
// AREA → AUDIT TYPE MAPPING
// ============================================================================

// Maps each area to the audit types (keys from AUDITORIA_TIPO_CONFIG) that validate its ROPs
export const AREA_AUDIT_MAPPING = {
  'cultura-seguranca': ['politica_qualidade', 'seguranca_paciente'],
  'comunicacao': ['abreviaturas', 'politica_disclosure'],
  'uso-medicamentos': ['uso_medicamentos'],
  'vida-profissional': ['vida_profissional'],
  'prevencao-infeccoes': ['higiene_maos', 'controle_infeccao'],
  'avaliacao-riscos': ['procedimento', 'equipamentos', 'operacional'],
}

export function getAuditTypesForArea(areaKey) {
  return AREA_AUDIT_MAPPING[areaKey] || []
}

// ============================================================================
// SCORE THRESHOLDS (usados pelo algoritmo de sugestao de status)
// ============================================================================

export const SCORE_THRESHOLDS = {
  conforme: 100,              // 100% dos itens C
  parcialmente_conforme: 50,  // 50-99%
  // < 50% = nao_conforme
}

// ============================================================================
// HELPERS
// ============================================================================

export function getEffectiveDeadline(avaliacao, cicloAtual) {
  if (avaliacao.prazo) return avaliacao.prazo
  const ciclo = CYCLE_OPTIONS.find((c) => c.id === (avaliacao.ciclo || cicloAtual))
  return ciclo?.endDate || null
}

export function diasAteFimCiclo(cicloId) {
  const ciclo = CYCLE_OPTIONS.find((c) => c.id === cicloId)
  if (!ciclo) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const fim = new Date(ciclo.endDate + 'T00:00:00')
  return Math.ceil((fim - hoje) / (1000 * 60 * 60 * 24))
}

export function getCurrentCycle() {
  const now = new Date()
  const year = now.getFullYear()
  const quarter = Math.ceil((now.getMonth() + 1) / 3)
  return `${year}-Q${quarter}`
}

export function getStatusConfig(status) {
  return AVALIACAO_STATUS[status] || AVALIACAO_STATUS.nao_avaliado
}

export function getAreaConfig(areaKey) {
  return AREA_CONFIG[areaKey] || { title: areaKey, color: DS_PRIMARY, icon: HelpCircle, ropCount: 0 }
}

export function getAllRopsForArea(areaKey) {
  const data = ropsData || {}
  const area = data[areaKey]
  if (!area || !area.subdivisoes) return []

  return Object.entries(area.subdivisoes).map(([ropId, ropData]) => ({
    ropId,
    title: ropData.title,
  }))
}

export function calcularProgressoArea(avaliacoes, areaKey) {
  const rops = getAllRopsForArea(areaKey)
  const total = rops.length
  const areaAvaliacoes = avaliacoes.filter((a) => a.ropArea === areaKey)

  const avaliados = areaAvaliacoes.filter((a) => a.status !== 'nao_avaliado').length
  const conformes = areaAvaliacoes.filter((a) => a.status === 'conforme').length
  const parciais = areaAvaliacoes.filter((a) => a.status === 'parcialmente_conforme').length
  const naoConformes = areaAvaliacoes.filter((a) => a.status === 'nao_conforme').length
  const percentual = total > 0 ? Math.round((avaliados / total) * 100) : 0

  return { total, avaliados, conformes, parciais, naoConformes, percentual }
}

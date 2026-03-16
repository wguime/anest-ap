/**
 * Planos de Acao (PDCA) - Configuration
 */
import {
  ClipboardList,
  Play,
  CheckCircle2,
  RefreshCw,
  Target,
  AlertTriangle,
  Clock,
  ArrowUpCircle,
  XCircle,
  Zap,
} from 'lucide-react'

// Fases do ciclo PDCA
export const PDCA_PHASES = {
  plan: {
    id: 'plan',
    label: 'Plan (Planejar)',
    shortLabel: 'Plan',
    description: 'Identificar o problema e planejar ações corretivas',
    icon: ClipboardList,
    color: '#3B82F6', // blue
    bgColor: '#EFF6FF',
    darkBgColor: '#1E3A5F',
  },
  do: {
    id: 'do',
    label: 'Do (Executar)',
    shortLabel: 'Do',
    description: 'Implementar as ações planejadas',
    icon: Play,
    color: '#F59E0B', // amber
    bgColor: '#FFFBEB',
    darkBgColor: '#3D2F0A',
  },
  check: {
    id: 'check',
    label: 'Check (Verificar)',
    shortLabel: 'Check',
    description: 'Avaliar resultados e eficácia das ações',
    icon: CheckCircle2,
    color: '#10B981', // emerald
    bgColor: '#ECFDF5',
    darkBgColor: '#0D3B2E',
  },
  act: {
    id: 'act',
    label: 'Act (Padronizar)',
    shortLabel: 'Act',
    description: 'Padronizar as melhorias e prevenir recorrência',
    icon: RefreshCw,
    color: '#8B5CF6', // violet
    bgColor: '#F5F3FF',
    darkBgColor: '#2D1B5E',
  },
}

export const PDCA_PHASE_ORDER = ['plan', 'do', 'check', 'act']

// Status do plano de acao (variants alinhados ao DS e padroes internacionais: info=azul, warning=ambar, success=verde, destructive=vermelho, secondary=neutro)
export const PLANO_STATUS = {
  planejamento: { label: 'Planejamento', variant: 'info', icon: ClipboardList },
  execucao: { label: 'Em Execução', variant: 'warning', icon: Play },
  verificacao: { label: 'Verificação', variant: 'info', icon: CheckCircle2 },
  padronizacao: { label: 'Padronização', variant: 'secondary', icon: RefreshCw },
  concluido: { label: 'Concluído', variant: 'success', icon: Target },
  cancelado: { label: 'Cancelado', variant: 'destructive', icon: XCircle },
}

// Prioridades (padroes internacionais: baixa=neutro, media=azul, alta=ambar, urgente=vermelho)
export const PRIORIDADES = {
  baixa: { label: 'Baixa', variant: 'secondary', icon: Clock, order: 1 },
  media: { label: 'Média', variant: 'info', icon: Target, order: 2 },
  alta: { label: 'Alta', variant: 'warning', icon: ArrowUpCircle, order: 3 },
  urgente: { label: 'Urgente', variant: 'destructive', icon: Zap, order: 4 },
}

// Avaliacao de eficacia
export const EFICACIA_OPTIONS = {
  eficaz: { label: 'Eficaz', variant: 'success', description: 'A ação corretiva resolveu o problema' },
  parcialmente_eficaz: { label: 'Parcialmente Eficaz', variant: 'warning', description: 'A ação reduziu mas não eliminou o problema' },
  ineficaz: { label: 'Ineficaz', variant: 'destructive', description: 'A ação não resolveu o problema' },
}

// Tipo de origem
export const TIPO_ORIGEM = {
  incidente: { label: 'Incidente', icon: AlertTriangle, color: '#EF4444' },
  auditoria: { label: 'Auditoria', icon: ClipboardList, color: '#3B82F6' },
  nao_conformidade: { label: 'Não Conformidade', icon: XCircle, color: '#F59E0B' },
  manual: { label: 'Manual', icon: Target, color: '#6B7280' },
}

// Percentual de execucao (Do)
export const PERCENTUAL_EXECUCAO_OPTIONS = [
  { value: '0', label: '0%' },
  { value: '25', label: '25%' },
  { value: '50', label: '50%' },
  { value: '75', label: '75%' },
  { value: '100', label: '100%' },
]

// Meta atingida (Check)
export const META_ATINGIDA_OPTIONS = {
  sim: { label: 'Sim', variant: 'success' },
  parcialmente: { label: 'Parcialmente', variant: 'warning' },
  nao: { label: 'Não', variant: 'destructive' },
}

// Decisao Act
export const DECISAO_ACT_OPTIONS = {
  padronizar: { label: 'Padronizar', variant: 'success' },
  corrigir_repetir: { label: 'Corrigir e repetir ciclo', variant: 'warning' },
  novo_plano: { label: 'Novo plano necessário', variant: 'destructive' },
}

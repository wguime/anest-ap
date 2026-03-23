import { getTipoConfig } from '@/types/documents'
import {
  FileText,
  Scale,
  BookOpen,
  ClipboardCheck,
  BarChart2,
  GitBranch,
  AlertTriangle,
  Target,
  FileSignature,
  TrendingUp,
  Table2,
  Pill,
  ShieldAlert,
  Flame,
  DollarSign,
  Users,
  Calendar,
  Shield,
  Receipt,
  FileBarChart,
  FileSearch,
  ClipboardList,
  CheckCircle2,
  XCircle,
  FilePlus2,
  Landmark,
  Building2,
  Stethoscope,
  GraduationCap,
  BadgeCheck,
  Cpu,
  Archive,
} from 'lucide-react'

/**
 * Icon mapping for document tipos
 * Covers CATEGORY_SUBSECTIONS values + legacy tipos
 */
const TIPO_ICONS = {
  // Novos (CATEGORY_SUBSECTIONS)
  politicas: Scale,
  protocolos_clinicos: FileText,
  procedimentos: ClipboardCheck,
  manuais: BookOpen,
  formularios: ClipboardCheck,
  relatorios: BarChart2,
  fluxogramas: GitBranch,
  mapas_processos: GitBranch,
  mapas_risco: AlertTriangle,
  tabelas: Table2,
  regimentos: FileText,
  regimento_interno: FileText,
  atas: FileText,
  planos_acao: Target,
  contratos_legais: FileSignature,
  acordos_processos: FileSignature,
  contratos: FileSignature,
  indicadores: TrendingUp,
  auditorias: ClipboardCheck,
  protocolos: FileText,
  // Modelos
  modelo_politica: Scale,
  modelo_procedimento: ClipboardCheck,
  modelo_manual: BookOpen,
  modelo_formulario: ClipboardCheck,
  modelo_relatorio: BarChart2,
  // Relatorios gerais
  relatorios_gestao: BarChart2,
  relatorios_assistenciais: BarChart2,
  relatorios_financeiros: BarChart2,
  relatorios_qualidade: BarChart2,
  // Legados
  parecer: Scale,
  resolucao: FileText,
  termo: FileSignature,
  protocolo: FileText,
  politica: Scale,
  formulario: ClipboardCheck,
  manual: BookOpen,
  relatorio: BarChart2,
  processo: GitBranch,
  risco: AlertTriangle,
  plano: Target,
  etica: Scale,
  // Legados secao-especificos
  interna: ClipboardCheck,
  externa: ClipboardCheck,
  conformidade: CheckCircle2,
  naoconformidade: XCircle,
  planoacao: FileText,
  mensal: FileText,
  trimestral: FileText,
  anual: FileText,
  incidente: AlertTriangle,
  seguranca: Shield,
  simulacao: AlertTriangle,
  orcamento: DollarSign,
  relatorio_financeiro: FileBarChart,
  contrato: FileText,
  auditoria_fiscal: FileSearch,
  nota_fiscal: Receipt,
  prestacao_contas: ClipboardList,
  procedimento: FileText,
  executivo: Users,
  gestao_pessoas: Users,
  escalas: Calendar,
  tecnologia: FileText,
  qualidade: FileText,
  educacao: FileText,
  etica_conduta: FileText,
  desastres: AlertTriangle,
  organograma: FileText,
  financeiro: DollarSign,
}

/**
 * Get icon component for a document tipo
 */
export const getTipoIcon = (tipo) => TIPO_ICONS[tipo?.toLowerCase()] || FileText

/**
 * Get full config (label, color, icon) for DocumentCard
 */
export function getDocCardConfig(tipo) {
  const config = getTipoConfig(tipo)
  const icon = getTipoIcon(tipo)
  return { label: config.label, color: config.color, icon }
}

/**
 * Biblioteca categories — used by ALL Centro de Gestao sections in the "Categorias" tab.
 * Based on the Biblioteca sections (00–10).
 */
const BIBLIOTECA_CATEGORIES = [
  { id: 'modelos',           label: '00 Modelos',           icon: FilePlus2 },
  { id: 'governanca',        label: '01 Governanca',        icon: Landmark },
  { id: 'institucional',     label: '02 Institucional',     icon: Building2 },
  { id: 'assistencial',      label: '03 Assistencial',      icon: Stethoscope },
  { id: 'gestao_pessoas',    label: '04 Gestao Pessoas',    icon: Users },
  { id: 'residencia',        label: '05 Residencia',        icon: GraduationCap },
  { id: 'financeiro',        label: '06 Financeiro',        icon: DollarSign },
  { id: 'qualidade',         label: '07 Qualidade',         icon: BadgeCheck },
  { id: 'tecnologia_mat',    label: '08 Tecnologia Mat',    icon: Cpu },
  { id: 'relatorios_gerais', label: '09 Relatorios Gerais', icon: FileBarChart },
  { id: 'obsoletos',         label: '10 Obsoletos',         icon: Archive },
]

/**
 * Build section categories for the "Categorias" tab.
 * Groups docs by `doc.subcategoria` using BIBLIOTECA_CATEGORIES as base.
 * Always shows all 11 categories even if count = 0.
 * @param {Array} docs - documents for this section
 */
export function buildSectionCategories(docs) {
  const countMap = {}

  docs.forEach(doc => {
    if (doc.status?.toLowerCase() === 'arquivado') return
    const sub = doc.subcategoria?.toLowerCase()
    if (!sub) return
    countMap[sub] = (countMap[sub] || 0) + 1
  })

  return BIBLIOTECA_CATEGORIES.map(cat => ({
    id: cat.id,
    label: cat.label,
    icon: cat.icon,
    count: countMap[cat.id] || 0,
  }))
}

/**
 * Build type filter options from actual doc tipos.
 * Used in the Documentos/Arquivados filter dropdown.
 * @param {Array} docs - documents for this section
 */
export function buildTypeFilters(docs) {
  const tipoSet = new Set()
  docs.forEach(doc => {
    const tipo = doc.tipo?.toLowerCase()
    if (tipo) tipoSet.add(tipo)
  })

  const tipos = Array.from(tipoSet)
    .map(tipo => {
      const config = getTipoConfig(tipo)
      return { value: tipo, label: config.label }
    })
    .sort((a, b) => a.label.localeCompare(b.label))

  return [{ value: 'all', label: 'Todos os tipos' }, ...tipos]
}

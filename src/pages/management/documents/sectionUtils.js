import { getTipoConfig, SUBCATEGORIA_CONFIG } from '@/types/documents'
import { countDocsBySubcategoria } from '@/utils/documentUtils'
import { FileText, Scale, BookOpen, ClipboardCheck, BarChart2, GitBranch, AlertTriangle, Target, FileSignature, TrendingUp, Table2, Pill, ShieldAlert, Flame, DollarSign, Users, Calendar, Shield, Receipt, FileBarChart, FileSearch, ClipboardList, CheckCircle2, XCircle, FilePlus2, Landmark, Building2, Stethoscope, GraduationCap, BadgeCheck, Cpu, Archive } from 'lucide-react'

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
 * Biblioteca categories — Wave 4 W4-1: deriva do SSOT SUBCATEGORIA_CONFIG.
 * Used by ALL Centro de Gestao sections in the "Categorias" tab.
 */
const SECTION_ICON_MAP = {
  FilePlus2, Landmark, Building2, Stethoscope, Users, GraduationCap,
  DollarSign, BadgeCheck, Cpu, FileBarChart, Archive,
}
const BIBLIOTECA_CATEGORIES = Object.entries(SUBCATEGORIA_CONFIG)
  .sort(([, a], [, b]) => a.order - b.order)
  .map(([id, cfg]) => ({
    id,
    label: cfg.label,
    icon: SECTION_ICON_MAP[cfg.iconKey],
  }))

/**
 * Build section categories for the "Categorias" tab.
 * Wave 4 W4-6: usa countDocsBySubcategoria do util compartilhado para
 * garantir contagens idênticas às da BibliotecaPage.
 *
 * @param {Array} docs - documents for this section
 */
export function buildSectionCategories(docs) {
  const counts = countDocsBySubcategoria(docs)

  return BIBLIOTECA_CATEGORIES.map(cat => ({
    id: cat.id,
    label: cat.label,
    icon: cat.icon,
    count: counts[cat.id] || 0,
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

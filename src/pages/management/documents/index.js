/**
 * Documents Module - Section Components
 *
 * This module exports all document section components for the Centro de Gestao.
 * Each section handles a specific document category with sub-tabs support.
 *
 * Sections:
 * - EticaSection: Etica e Bioetica documents
 * - ComitesSection: Comites institucionais documents
 * - AuditoriasSection: Auditorias internas e externas
 * - RelatoriosSection: Relatorios de seguranca e qualidade
 * - BibliotecaSection: Biblioteca de protocolos e documentos
 * - FinanceiroSection: Financeiro (Em breve placeholder)
 * - MedicamentosSection: Uso de Medicamentos
 * - InfeccoesSection: Prevencao de Infeccoes
 * - DesastresSection: Gerenciamento de Desastres
 */

export { default as EticaSection } from './EticaSection'
export { default as ComitesSection } from './ComitesSection'
export { default as AuditoriasSection } from './AuditoriasSection'
export { default as RelatoriosSection } from './RelatoriosSection'
export { default as BibliotecaSection } from './BibliotecaSection'
export { default as FinanceiroSection } from './FinanceiroSection'
export { default as MedicamentosSection } from './MedicamentosSection'
export { default as InfeccoesSection } from './InfeccoesSection'
export { default as DesastresSection } from './DesastresSection'
export { default as DocumentsLayout } from './DocumentsLayout'

// Also export as named object for convenience
import EticaSection from './EticaSection'
import ComitesSection from './ComitesSection'
import AuditoriasSection from './AuditoriasSection'
import RelatoriosSection from './RelatoriosSection'
import BibliotecaSection from './BibliotecaSection'
import FinanceiroSection from './FinanceiroSection'
import MedicamentosSection from './MedicamentosSection'
import InfeccoesSection from './InfeccoesSection'
import DesastresSection from './DesastresSection'
import DocumentsLayout from './DocumentsLayout'

/**
 * Section component mapping by category ID
 * Useful for dynamic section rendering
 */
export const SECTION_COMPONENTS = {
  etica: EticaSection,
  comites: ComitesSection,
  auditorias: AuditoriasSection,
  relatorios: RelatoriosSection,
  biblioteca: BibliotecaSection,
  financeiro: FinanceiroSection,
  medicamentos: MedicamentosSection,
  infeccoes: InfeccoesSection,
  desastres: DesastresSection
}

/**
 * Get section component by category ID
 * @param {string} categoryId - The category identifier
 * @returns {React.Component|null} The section component or null
 */
export function getSectionComponent(categoryId) {
  return SECTION_COMPONENTS[categoryId] || null
}

export default {
  EticaSection,
  ComitesSection,
  AuditoriasSection,
  RelatoriosSection,
  BibliotecaSection,
  FinanceiroSection,
  MedicamentosSection,
  InfeccoesSection,
  DesastresSection,
  DocumentsLayout,
  SECTION_COMPONENTS,
  getSectionComponent
}

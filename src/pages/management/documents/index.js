/**
 * Documents Module — Section Components
 *
 * Wave 3 / W3-1: 9 *Section.jsx files were consolidated into a single
 * parametrized DocumentSection driven by SECTION_CONFIG.
 *
 * Public API:
 *   import { DocumentSection, getSectionComponent, SECTION_COMPONENTS } from './documents'
 *
 * Back-compat (deprecated, all map to DocumentSection with categoryId):
 *   EticaSection, ComitesSection, AuditoriasSection, RelatoriosSection,
 *   BibliotecaSection, FinanceiroSection, MedicamentosSection,
 *   InfeccoesSection, DesastresSection
 */

import { createElement } from 'react'
import DocumentSection from './DocumentSection'
import DocumentsLayout from './DocumentsLayout'
import { SECTION_CONFIG, getSectionConfig } from './sectionConfig'

// ─── Back-compat helper: build a wrapped section component for a categoryId ──
// Uses React.createElement so this file remains pure .js (no JSX).
function makeSectionComponent(categoryId) {
  function Wrapped(props) {
    return createElement(DocumentSection, { ...props, categoryId })
  }
  Wrapped.displayName = `${categoryId.charAt(0).toUpperCase() + categoryId.slice(1)}Section`
  return Wrapped
}

const EticaSection = makeSectionComponent('etica')
const ComitesSection = makeSectionComponent('comites')
const AuditoriasSection = makeSectionComponent('auditorias')
const RelatoriosSection = makeSectionComponent('relatorios')
const BibliotecaSection = makeSectionComponent('biblioteca')
const FinanceiroSection = makeSectionComponent('financeiro')
const MedicamentosSection = makeSectionComponent('medicamentos')
const InfeccoesSection = makeSectionComponent('infeccoes')
const DesastresSection = makeSectionComponent('desastres')

export {
  DocumentSection,
  DocumentsLayout,
  SECTION_CONFIG,
  getSectionConfig,
  // Back-compat named exports
  EticaSection,
  ComitesSection,
  AuditoriasSection,
  RelatoriosSection,
  BibliotecaSection,
  FinanceiroSection,
  MedicamentosSection,
  InfeccoesSection,
  DesastresSection,
}

/**
 * Section component mapping by category ID.
 * Each entry is a wrapper around DocumentSection with the categoryId baked in.
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
  desastres: DesastresSection,
}

/**
 * Get section component by category ID.
 * @param {string} categoryId
 * @returns {React.Component|null}
 */
export function getSectionComponent(categoryId) {
  return SECTION_COMPONENTS[categoryId] || null
}

export default {
  DocumentSection,
  DocumentsLayout,
  SECTION_CONFIG,
  SECTION_COMPONENTS,
  getSectionComponent,
  // Back-compat
  EticaSection,
  ComitesSection,
  AuditoriasSection,
  RelatoriosSection,
  BibliotecaSection,
  FinanceiroSection,
  MedicamentosSection,
  InfeccoesSection,
  DesastresSection,
}

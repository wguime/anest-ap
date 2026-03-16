/**
 * Configuracao dos tipos de Relatorios de Auditorias
 * Cada tipo tem sua configuracao para exibicao em accordions e cards
 */

import { FileBarChart, Droplets, Pill, ClipboardCheck } from 'lucide-react';

/**
 * Configuracoes dos tipos de relatorios de auditorias
 * - consolidado_rops: Relatórios consolidados de ROPs
 * - higiene_maos: Relatórios de auditorias de higiene das mãos
 * - medicamentos: Relatórios de uso de medicamentos
 * - conformidade: Relatórios de conformidade geral
 */
export const AUDITORIA_RELATORIO_CONFIGS = {
  consolidado_rops: {
    id: 'consolidado_rops',
    titulo: 'Consolidado ROPs',
    descricao: 'Relatórios consolidados de auditorias ROPs',
    collection: 'auditorias_relatorios_rops',
    storagePath: 'Auditorias/Relatorios/ROPs',
    icon: 'FileBarChart',
    color: '#059669',
  },
  higiene_maos: {
    id: 'higiene_maos',
    titulo: 'Higiene das Mãos',
    descricao: 'Relatórios de auditorias de higiene das mãos',
    collection: 'auditorias_relatorios_higiene',
    storagePath: 'Auditorias/Relatorios/HigieneMaos',
    icon: 'Droplets',
    color: '#2563eb',
  },
  medicamentos: {
    id: 'medicamentos',
    titulo: 'Uso de Medicamentos',
    descricao: 'Relatórios de auditorias de uso de medicamentos',
    collection: 'auditorias_relatorios_medicamentos',
    storagePath: 'Auditorias/Relatorios/Medicamentos',
    icon: 'Pill',
    color: '#7c3aed',
  },
  conformidade: {
    id: 'conformidade',
    titulo: 'Conformidade',
    descricao: 'Relatórios de conformidade geral',
    collection: 'auditorias_relatorios_conformidade',
    storagePath: 'Auditorias/Relatorios/Conformidade',
    icon: 'ClipboardCheck',
    color: '#dc2626',
  },
};

/**
 * Configuracao de tipos para accordions (similar ao RELATORIO_TIPO_CONFIG de documentos)
 * Usado no design unificado de PermissionsPage
 */
export const AUDITORIA_RELATORIO_TIPO_CONFIG = {
  consolidado_rops: {
    label: 'Consolidado ROPs',
    shortLabel: 'ROPs',
    icon: FileBarChart,
    color: '#059669',
    order: 1,
  },
  higiene_maos: {
    label: 'Higiene das Mãos',
    shortLabel: 'Higiene',
    icon: Droplets,
    color: '#2563eb',
    order: 2,
  },
  medicamentos: {
    label: 'Uso de Medicamentos',
    shortLabel: 'Medicamentos',
    icon: Pill,
    color: '#7c3aed',
    order: 3,
  },
  conformidade: {
    label: 'Conformidade',
    shortLabel: 'Conformidade',
    icon: ClipboardCheck,
    color: '#dc2626',
    order: 4,
  },
};

/**
 * Retorna a configuracao de um tipo especifico
 * @param {string} tipo - ID do tipo de relatorio
 * @returns {Object|null} Configuracao do tipo ou null se nao encontrado
 */
export function getAuditoriaRelatorioConfig(tipo) {
  return AUDITORIA_RELATORIO_CONFIGS[tipo] || null;
}

/**
 * Retorna todas as configuracoes como array
 * @returns {Array} Array de configuracoes
 */
export function getAllAuditoriaRelatorioConfigs() {
  return Object.values(AUDITORIA_RELATORIO_CONFIGS);
}

/**
 * Retorna a cor de um tipo de relatorio de auditoria
 * @param {string} tipo - ID do tipo
 * @returns {string} Cor hex
 */
export function getAuditoriaRelatorioColor(tipo) {
  return AUDITORIA_RELATORIO_CONFIGS[tipo]?.color || '#6B7280';
}

/**
 * Retorna o label de um tipo de relatorio de auditoria
 * @param {string} tipo - ID do tipo
 * @returns {string} Label do tipo
 */
export function getAuditoriaRelatorioLabel(tipo) {
  return AUDITORIA_RELATORIO_CONFIGS[tipo]?.titulo || tipo;
}

/**
 * Retorna a configuracao de tipo para accordions
 * @param {string} tipo - ID do tipo de relatorio de auditoria
 * @returns {Object} Config do tipo para accordion
 */
export function getAuditoriaRelatorioTipoConfig(tipo) {
  return AUDITORIA_RELATORIO_TIPO_CONFIG[tipo] || { label: tipo, icon: FileBarChart, color: '#6B7280', order: 99 };
}

export default AUDITORIA_RELATORIO_CONFIGS;

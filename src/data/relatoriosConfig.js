/**
 * Configuracao dos tipos de documentos de Relatorios
 * Cada tipo tem sua colecao no Firestore e path no Storage
 */

import { FileBarChart, AlertTriangle, TrendingUp } from 'lucide-react';

/**
 * Configuracoes dos tipos de relatorios
 * - trimestral: Relatorios trimestrais de indicadores
 * - incidentes: Consolidado de incidentes e eventos adversos
 * - indicadores: KPIs e indicadores de qualidade
 */
export const RELATORIOS_CONFIGS = {
  trimestral: {
    id: 'trimestral',
    titulo: 'Relatórios Trimestrais',
    descricao: 'Indicadores consolidados por trimestre',
    collection: 'relatorios_trimestrais_documentos',
    storagePath: 'Relatorios/Trimestral',
    icon: 'FileBarChart',
    color: '#3B82F6',
  },
  incidentes: {
    id: 'incidentes',
    titulo: 'Consolidado de Incidentes',
    descricao: 'Eventos adversos e quase-erros',
    collection: 'relatorios_incidentes_documentos',
    storagePath: 'Relatorios/Incidentes',
    icon: 'AlertCircle',
    color: '#DC2626',
  },
  indicadores: {
    id: 'indicadores',
    titulo: 'Indicadores de Qualidade',
    descricao: 'KPIs anuais consolidados',
    collection: 'relatorios_indicadores_documentos',
    storagePath: 'Relatorios/Indicadores',
    icon: 'TrendingUp',
    color: '#059669',
  },
};

/**
 * Configuracao de tipos para accordions (similar ao TIPO_CONFIG de documentos)
 * Usado no design unificado de RelatoriosPage e PermissionsPage
 */
export const RELATORIO_TIPO_CONFIG = {
  trimestral: {
    label: 'Trimestral',
    shortLabel: 'Trimestral',
    icon: FileBarChart,
    color: '#3B82F6',
    order: 1,
  },
  incidentes: {
    label: 'Incidentes',
    shortLabel: 'Incidentes',
    icon: AlertTriangle,
    color: '#DC2626',
    order: 2,
  },
  indicadores: {
    label: 'Indicadores',
    shortLabel: 'Indicadores',
    icon: TrendingUp,
    color: '#059669',
    order: 3,
  },
};

/**
 * Retorna a configuracao de um tipo especifico
 * @param {string} tipo - ID do tipo de relatorio
 * @returns {Object|null} Configuracao do tipo ou null se nao encontrado
 */
export function getRelatorioConfig(tipo) {
  return RELATORIOS_CONFIGS[tipo] || null;
}

/**
 * Retorna todas as configuracoes como array
 * @returns {Array} Array de configuracoes
 */
export function getAllRelatorioConfigs() {
  return Object.values(RELATORIOS_CONFIGS);
}

/**
 * Retorna a cor de um tipo de relatorio
 * @param {string} tipo - ID do tipo
 * @returns {string} Cor hex
 */
export function getRelatorioColor(tipo) {
  return RELATORIOS_CONFIGS[tipo]?.color || '#6B7280';
}

/**
 * Retorna o label de um tipo de relatorio
 * @param {string} tipo - ID do tipo
 * @returns {string} Label do tipo
 */
export function getRelatorioLabel(tipo) {
  return RELATORIOS_CONFIGS[tipo]?.titulo || tipo;
}

/**
 * Retorna a configuracao de tipo para accordions
 * @param {string} tipo - ID do tipo de relatorio
 * @returns {Object} Config do tipo para accordion
 */
export function getRelatorioTipoConfig(tipo) {
  return RELATORIO_TIPO_CONFIG[tipo] || { label: tipo, icon: FileBarChart, color: '#6B7280', order: 99 };
}

export default RELATORIOS_CONFIGS;

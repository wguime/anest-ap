/**
 * Configuracao dos tipos de documentos de Etica e Bioetica
 * Cada tipo tem sua colecao no Firestore e path no Storage
 */
export const ETICA_CONFIGS = {
  dilemas: {
    id: 'dilemas',
    titulo: 'Gestão de Dilemas Bioéticos',
    descricao: 'Casos e deliberações éticas',
    collection: 'etica_dilemas_documentos',
    storagePath: 'Etica_Bioetica/Dilemas',
    icon: 'Brain',
  },
  parecerUti: {
    id: 'parecerUti',
    titulo: 'Parecer Ético - UTI',
    descricao: 'Pareceres éticos para UTI',
    collection: 'etica_parecer_uti_documentos',
    storagePath: 'Etica_Bioetica/Parecer_UTI',
    icon: 'Heart',
  },
  diretrizes: {
    id: 'diretrizes',
    titulo: 'Diretrizes Institucionais',
    descricao: 'Diretrizes e normas éticas',
    collection: 'etica_diretrizes_documentos',
    storagePath: 'Etica_Bioetica/Diretrizes',
    icon: 'BookOpen',
  },
  emissaoParecer: {
    id: 'emissaoParecer',
    titulo: 'Emissão de Parecer Técnico-Ético',
    descricao: 'Emissão de pareceres técnicos',
    collection: 'etica_parecer_tecnico_documentos',
    storagePath: 'Etica_Bioetica/Parecer_Tecnico',
    icon: 'FileText',
  },
  codigoEtica: {
    id: 'codigoEtica',
    titulo: 'Código de Ética',
    descricao: 'Código de ética médica',
    collection: 'etica_codigo_documentos',
    storagePath: 'Etica_Bioetica/Codigo',
    icon: 'Scale',
  },
};

/**
 * Retorna a configuracao de um tipo especifico
 * @param {string} tipo - ID do tipo de documento
 * @returns {Object|null} Configuracao do tipo ou null se nao encontrado
 */
export function getEticaConfig(tipo) {
  return ETICA_CONFIGS[tipo] || null;
}

/**
 * Retorna todas as configuracoes como array
 * @returns {Array} Array de configuracoes
 */
export function getAllEticaConfigs() {
  return Object.values(ETICA_CONFIGS);
}

export default ETICA_CONFIGS;

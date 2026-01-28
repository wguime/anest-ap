/**
 * visibilityUtils.js
 * Funções utilitárias para cálculo de visibilidade de entidades educacionais
 * 
 * Modelo de Visibilidade:
 * - INHERIT: herda do pai (default para filhos)
 * - PUBLIC: visível para todos os usuários autenticados
 * - RESTRICTED: visível apenas para allowedUserTypes específicos
 */

/**
 * Calcula a visibilidade efetiva percorrendo a ancestry
 * @param {Object} entity - Entidade atual (Trilha, Curso, Módulo ou Aula)
 * @param {Array} ancestry - Array de pais ordenados do mais próximo ao mais distante
 *                           Ex: [modulo, curso, trilha] para uma Aula
 * @returns {{ effectiveVisibility: string, effectiveAllowedUserTypes: string[] }}
 */
export function computeEffectiveVisibility(entity, ancestry = []) {
  // 1. Se a entidade tem modo explícito (não INHERIT), usar
  if (entity?.visibilityMode === 'PUBLIC') {
    return { 
      effectiveVisibility: 'PUBLIC', 
      effectiveAllowedUserTypes: [] 
    };
  }
  
  if (entity?.visibilityMode === 'RESTRICTED') {
    return { 
      effectiveVisibility: 'RESTRICTED', 
      effectiveAllowedUserTypes: entity.allowedUserTypes || [] 
    };
  }
  
  // 2. Se INHERIT (ou undefined/null), percorrer pais
  for (const parent of ancestry) {
    if (!parent) continue;
    
    if (parent.visibilityMode === 'PUBLIC') {
      return { 
        effectiveVisibility: 'PUBLIC', 
        effectiveAllowedUserTypes: [] 
      };
    }
    
    if (parent.visibilityMode === 'RESTRICTED') {
      return { 
        effectiveVisibility: 'RESTRICTED', 
        effectiveAllowedUserTypes: parent.allowedUserTypes || [] 
      };
    }
    // Se pai também é INHERIT, continua subindo
  }
  
  // 3. Se nenhum override encontrado (toda cadeia é INHERIT), assume PUBLIC
  return { 
    effectiveVisibility: 'PUBLIC', 
    effectiveAllowedUserTypes: [] 
  };
}

/**
 * Verifica se um usuário pode acessar uma entidade
 * @param {Object} entity - Entidade com campos effectiveVisibility e effectiveAllowedUserTypes
 * @param {string} userType - Tipo do usuário (ex: 'medico', 'enfermeiro')
 * @returns {boolean}
 */
export function canUserAccess(entity, userType) {
  if (!entity) return false;
  
  const visibility = entity.effectiveVisibility || entity.visibilityMode;
  const allowedTypes = entity.effectiveAllowedUserTypes || entity.allowedUserTypes || [];
  
  // PUBLIC ou undefined = acesso permitido
  if (visibility === 'PUBLIC' || !visibility || visibility === 'INHERIT') {
    return true;
  }
  
  // RESTRICTED = verificar allowedUserTypes
  if (visibility === 'RESTRICTED') {
    if (!userType) return false;
    return allowedTypes.includes(userType);
  }
  
  // Fallback: permitir acesso
  return true;
}

/**
 * Verifica se usuário pode acessar entidade calculando visibilidade em tempo real
 * Útil quando effectiveVisibility não está pré-computado
 * @param {Object} entity - Entidade atual
 * @param {Array} ancestry - Array de pais
 * @param {string} userType - Tipo do usuário
 * @returns {boolean}
 */
export function canUserAccessWithAncestry(entity, ancestry, userType) {
  const { effectiveVisibility, effectiveAllowedUserTypes } = computeEffectiveVisibility(entity, ancestry);
  return canUserAccess({ effectiveVisibility, effectiveAllowedUserTypes }, userType);
}

/**
 * Filtra array de entidades por visibilidade
 * @param {Array} entities - Array de entidades
 * @param {string} userType - Tipo do usuário
 * @param {Function} getAncestry - Função opcional que retorna ancestry para cada entidade
 * @returns {Array} Entidades visíveis para o usuário
 */
export function filterByVisibility(entities, userType, getAncestry = null) {
  if (!Array.isArray(entities)) return [];
  
  return entities.filter(entity => {
    // Se tem effectiveVisibility pré-computado, usar
    if (entity.effectiveVisibility) {
      return canUserAccess(entity, userType);
    }
    
    // Se tem função para obter ancestry, calcular
    if (getAncestry) {
      const ancestry = getAncestry(entity);
      return canUserAccessWithAncestry(entity, ancestry, userType);
    }
    
    // Fallback: verificar apenas visibilityMode da própria entidade
    return canUserAccess(entity, userType);
  });
}

/**
 * Retorna label amigável para o modo de visibilidade
 * @param {string} mode - 'INHERIT' | 'PUBLIC' | 'RESTRICTED'
 * @returns {string}
 */
export function getVisibilityLabel(mode) {
  switch (mode) {
    case 'INHERIT':
      return 'Herdar do pai';
    case 'PUBLIC':
      return 'Público';
    case 'RESTRICTED':
      return 'Restrito';
    default:
      return 'Herdar do pai';
  }
}

/**
 * Constantes de visibilidade
 */
export const VISIBILITY_MODES = {
  INHERIT: 'INHERIT',
  PUBLIC: 'PUBLIC',
  RESTRICTED: 'RESTRICTED',
};

/**
 * Opções de visibilidade para selects
 */
export const VISIBILITY_OPTIONS = [
  { value: 'INHERIT', label: 'Herdar do pai' },
  { value: 'PUBLIC', label: 'Público (todos os usuários)' },
  { value: 'RESTRICTED', label: 'Restrito (tipos específicos)' },
];

/**
 * Opções de visibilidade para Trilha (sem INHERIT pois é raiz)
 */
export const VISIBILITY_OPTIONS_ROOT = [
  { value: 'PUBLIC', label: 'Público (todos os usuários)' },
  { value: 'RESTRICTED', label: 'Restrito (tipos específicos)' },
];

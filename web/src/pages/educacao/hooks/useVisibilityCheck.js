/**
 * useVisibilityCheck.js
 * Hook para verificação de visibilidade de entidades educacionais
 */

import { useMemo, useCallback } from 'react';
import { 
  computeEffectiveVisibility, 
  canUserAccess,
  canUserAccessWithAncestry,
  filterByVisibility,
} from '../utils/visibilityUtils';

/**
 * Hook para verificação de visibilidade
 * @param {Object} user - Usuário atual com tipoUsuario ou role
 * @returns {Object} Funções de verificação de visibilidade
 */
export function useVisibilityCheck(user) {
  // Extrair tipo do usuário
  const userType = useMemo(() => {
    return user?.tipoUsuario || user?.role || null;
  }, [user?.tipoUsuario, user?.role]);

  /**
   * Verificar se usuário pode acessar uma entidade
   * Usa campos pré-computados se disponíveis, senão calcula na hora
   */
  const checkVisibility = useCallback((entity, ancestry = []) => {
    if (!entity) return false;
    
    // Se tem effectiveVisibility pré-computado, usar diretamente
    if (entity.effectiveVisibility) {
      return canUserAccess(entity, userType);
    }
    
    // Fallback: calcular na hora com ancestry
    return canUserAccessWithAncestry(entity, ancestry, userType);
  }, [userType]);

  /**
   * Filtrar array de entidades por visibilidade
   */
  const filterVisible = useCallback((entities, getAncestry = null) => {
    return filterByVisibility(entities, userType, getAncestry);
  }, [userType]);

  /**
   * Verificar se entidade é pública
   */
  const isPublic = useCallback((entity) => {
    if (!entity) return false;
    const visibility = entity.effectiveVisibility || entity.visibilityMode;
    return !visibility || visibility === 'PUBLIC';
  }, []);

  /**
   * Verificar se entidade é restrita
   */
  const isRestricted = useCallback((entity) => {
    if (!entity) return false;
    const visibility = entity.effectiveVisibility || entity.visibilityMode;
    return visibility === 'RESTRICTED';
  }, []);

  /**
   * Verificar se entidade herda visibilidade
   */
  const inheritsVisibility = useCallback((entity) => {
    if (!entity) return true;
    return !entity.visibilityMode || entity.visibilityMode === 'INHERIT';
  }, []);

  /**
   * Obter label descritivo da visibilidade
   */
  const getVisibilityDescription = useCallback((entity, parentEntity = null) => {
    if (!entity) return 'Desconhecido';
    
    const mode = entity.visibilityMode || 'INHERIT';
    const effective = entity.effectiveVisibility;
    
    if (mode === 'INHERIT') {
      if (effective === 'RESTRICTED') {
        return 'Herdado (Restrito)';
      }
      return 'Herdado (Público)';
    }
    
    if (mode === 'PUBLIC') {
      return 'Público';
    }
    
    if (mode === 'RESTRICTED') {
      const types = entity.allowedUserTypes || [];
      if (types.length === 0) {
        return 'Restrito (nenhum tipo definido)';
      }
      return `Restrito (${types.length} tipo${types.length > 1 ? 's' : ''})`;
    }
    
    return mode;
  }, []);

  return {
    userType,
    checkVisibility,
    filterVisible,
    isPublic,
    isRestricted,
    inheritsVisibility,
    getVisibilityDescription,
    // Re-exportar funções utilitárias
    computeEffectiveVisibility,
    canUserAccess,
  };
}

export default useVisibilityCheck;

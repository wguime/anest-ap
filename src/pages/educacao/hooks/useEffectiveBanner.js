/**
 * useEffectiveBanner.js
 * Hook para determinar o banner efetivo de uma entidade
 * Percorre a ancestry para encontrar o banner mais próximo (da Trilha)
 */

import { useMemo } from 'react';

/**
 * Hook para encontrar o banner efetivo baseado na ancestry
 * O banner é definido na Trilha e persiste em Treinamento, Módulo e Aula
 * 
 * @param {Object} entity - Entidade atual (Curso, Módulo ou Aula)
 * @param {string} entityType - Tipo da entidade ('trilha' | 'curso' | 'modulo' | 'aula')
 * @param {Object} ancestry - Objeto com ancestrais { trilha, curso, modulo }
 * @returns {Object|null} Banner efetivo ou null
 */
export function useEffectiveBanner(entity, entityType, ancestry = {}) {
  return useMemo(() => {
    // Se a entidade é uma trilha, usar seu próprio banner
    if (entityType === 'trilha') {
      return entity?.banner || null;
    }

    // Para outros tipos, procurar na ancestry (trilha é o único que tem banner)
    const { trilha, curso, modulo } = ancestry;

    // Trilha é o único nível que define banner
    if (trilha?.banner) {
      return trilha.banner;
    }

    // Se a própria entidade tiver um banner (caso raro), usar
    if (entity?.banner) {
      return entity.banner;
    }

    return null;
  }, [entity, entityType, ancestry]);
}

/**
 * Hook para construir breadcrumb de navegação baseado na ancestry
 * 
 * @param {Object} ancestry - Objeto com ancestrais { trilha, curso, modulo, aula }
 * @param {string} currentType - Tipo da entidade atual
 * @param {Function} onNavigate - Função de navegação
 * @returns {Array} Array de { label, onClick, type, id }
 */
export function useBreadcrumb(ancestry, currentType, onNavigate) {
  return useMemo(() => {
    const { trilha, curso, modulo, aula } = ancestry;
    const items = [];

    // Trilha (sempre primeiro se existir)
    if (trilha) {
      items.push({
        label: trilha.titulo || 'Trilha',
        type: 'trilha',
        id: trilha.id,
        onClick: currentType !== 'trilha' 
          ? () => onNavigate?.('trilhaDetalhe', { id: trilha.id })
          : undefined,
      });
    }

    // Curso/Treinamento
    if (curso) {
      items.push({
        label: curso.titulo || 'Treinamento',
        type: 'curso',
        id: curso.id,
        onClick: currentType !== 'curso' 
          ? () => onNavigate?.('cursoDetalhe', { id: curso.id })
          : undefined,
      });
    }

    // Módulo
    if (modulo) {
      items.push({
        label: modulo.titulo || 'Módulo',
        type: 'modulo',
        id: modulo.id,
        onClick: currentType !== 'modulo'
          ? () => onNavigate?.('moduloDetalhe', { id: modulo.id })
          : undefined,
      });
    }

    // Aula (se for a entidade atual, sem onClick)
    if (aula && currentType === 'aula') {
      items.push({
        label: aula.titulo || 'Aula',
        type: 'aula',
        id: aula.id,
        onClick: undefined, // É o item atual
      });
    }

    return items;
  }, [ancestry, currentType, onNavigate]);
}

/**
 * Hook combinado para obter banner e breadcrumb
 * Útil para páginas que precisam de ambos
 */
export function useBannerAndBreadcrumb(entity, entityType, ancestry, onNavigate) {
  const banner = useEffectiveBanner(entity, entityType, ancestry);
  const breadcrumb = useBreadcrumb(ancestry, entityType, onNavigate);

  return {
    banner,
    breadcrumb,
    hasBanner: !!banner,
    trilha: ancestry?.trilha || null,
  };
}

export default useEffectiveBanner;

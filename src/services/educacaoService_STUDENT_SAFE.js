/**
 * educacaoService - Student-Safe Queries
 * 
 * IMPORTANTE: Aluno NÃO pode ler junction tables (admin-only)
 * Usa arrays denormalizados: publishedCursoIds, publishedModuloIds, publishedAulaIds
 */

import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  documentId,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// Collections
const COLLECTIONS = {
  TRILHAS: 'educacao_trilhas',
  CURSOS: 'educacao_cursos',
  MODULOS: 'educacao_modulos',
  AULAS: 'educacao_aulas',
  // Junction tables (ADMIN-ONLY, não usar em queries de aluno)
  TRILHA_CURSOS: 'educacao_trilha_cursos',
  CURSO_MODULOS: 'educacao_curso_modulos',
  MODULO_AULAS: 'educacao_modulo_aulas',
};

// ============================================================================
// QUERIES STUDENT-SAFE (sem junction tables)
// ============================================================================

/**
 * Buscar trilhas para o aluno
 * Somente PUBLISHED + ativo + visibilidade permitida
 * NÃO usa junction tables
 */
export async function getTrilhasForStudent(userType) {
  try {
    // Query direta em trilhas
    const baseQuery = query(
      collection(db, COLLECTIONS.TRILHAS),
      where('status', '==', 'PUBLISHED'),
      where('ativo', '==', true),
      orderBy('ordem', 'asc')
    );

    const snap = await getDocs(baseQuery);
    const trilhas = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Filtrar por visibilidade efetiva
    return trilhas.filter(t => canAccessByVisibility(t, userType));
  } catch (error) {
    console.error('Erro ao buscar trilhas para aluno:', error);
    return [];
  }
}

/**
 * Buscar cursos de uma trilha para o aluno
 * USA publishedCursoIds (array denormalizado, NÃO junction table)
 */
export async function getCursosForStudent(trilhaId, userType) {
  try {
    // 1. Buscar trilha (contém publishedCursoIds)
    const trilhaDoc = await getDoc(doc(db, COLLECTIONS.TRILHAS, trilhaId));
    if (!trilhaDoc.exists()) return [];

    const trilha = trilhaDoc.data();
    const cursoIds = trilha.publishedCursoIds || [];
    
    if (cursoIds.length === 0) return [];

    // 2. Buscar cursos por IDs (com chunking)
    const cursos = await fetchByIdsInOrder(
      COLLECTIONS.CURSOS,
      cursoIds, // já ordenados e filtrados (PUBLISHED + ativo)
      userType
    );

    return cursos;
  } catch (error) {
    console.error('Erro ao buscar cursos para aluno:', error);
    return [];
  }
}

/**
 * Buscar módulos de um curso para o aluno
 * USA publishedModuloIds (array denormalizado)
 */
export async function getModulosForStudent(cursoId, userType) {
  try {
    const cursoDoc = await getDoc(doc(db, COLLECTIONS.CURSOS, cursoId));
    if (!cursoDoc.exists()) return [];

    const curso = cursoDoc.data();
    const moduloIds = curso.publishedModuloIds || [];
    
    if (moduloIds.length === 0) return [];

    const modulos = await fetchByIdsInOrder(
      COLLECTIONS.MODULOS,
      moduloIds,
      userType
    );

    return modulos;
  } catch (error) {
    console.error('Erro ao buscar módulos para aluno:', error);
    return [];
  }
}

/**
 * Buscar aulas de um módulo para o aluno
 * USA publishedAulaIds (array denormalizado)
 */
export async function getAulasForStudent(moduloId, userType) {
  try {
    const moduloDoc = await getDoc(doc(db, COLLECTIONS.MODULOS, moduloId));
    if (!moduloDoc.exists()) return [];

    const modulo = moduloDoc.data();
    const aulaIds = modulo.publishedAulaIds || [];
    
    if (aulaIds.length === 0) return [];

    const aulas = await fetchByIdsInOrder(
      COLLECTIONS.AULAS,
      aulaIds,
      userType
    );

    return aulas;
  } catch (error) {
    console.error('Erro ao buscar aulas para aluno:', error);
    return [];
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Helper: buscar docs por IDs com chunking (limit 10 por query Firestore)
 * Reordena conforme array original (não conforme retorno Firestore)
 */
async function fetchByIdsInOrder(collectionName, ids, userType) {
  if (!ids || ids.length === 0) return [];

  // Chunking: Firestore permite max 10 ids em 'in' query
  const chunks = [];
  for (let i = 0; i < ids.length; i += 10) {
    chunks.push(ids.slice(i, i + 10));
  }

  const allDocs = [];
  
  for (const chunk of chunks) {
    const q = query(
      collection(db, collectionName),
      where(documentId(), 'in', chunk)
    );
    
    const snap = await getDocs(q);
    allDocs.push(...snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  // Reordenar conforme array original (ids)
  const docMap = new Map(allDocs.map(d => [d.id, d]));
  const ordered = ids.map(id => docMap.get(id)).filter(Boolean);

  // Filtrar por visibilidade (double-check, array já deveria estar correto)
  return ordered.filter(doc => canAccessByVisibility(doc, userType));
}

/**
 * Verificar se usuário pode acessar entidade por visibilidade
 */
function canAccessByVisibility(entity, userType) {
  if (!entity) return false;
  
  // PUBLIC: todos acessam
  if (entity.effectiveVisibility === 'PUBLIC') return true;
  
  // RESTRICTED: verificar allowedUserTypes
  if (entity.effectiveVisibility === 'RESTRICTED') {
    return entity.effectiveAllowedUserTypes?.includes(userType);
  }
  
  // Fallback: negar acesso
  return false;
}

// ============================================================================
// QUERIES COMPLETAS (Árvore completa para aluno)
// ============================================================================

/**
 * Buscar árvore completa de conteúdo para o aluno
 * Retorna trilhas com cursos, módulos e aulas já carregados
 */
export async function getConteudoCompletoForStudent(userType) {
  try {
    // 1. Buscar trilhas
    const trilhas = await getTrilhasForStudent(userType);
    
    // 2. Para cada trilha, buscar cursos
    const trilhasComCursos = await Promise.all(
      trilhas.map(async (trilha) => {
        const cursos = await getCursosForStudent(trilha.id, userType);
        
        // 3. Para cada curso, buscar módulos
        const cursosComModulos = await Promise.all(
          cursos.map(async (curso) => {
            const modulos = await getModulosForStudent(curso.id, userType);
            
            // 4. Para cada módulo, buscar aulas
            const modulosComAulas = await Promise.all(
              modulos.map(async (modulo) => {
                const aulas = await getAulasForStudent(modulo.id, userType);
                return { ...modulo, aulas };
              })
            );
            
            return { ...curso, modulos: modulosComAulas };
          })
        );
        
        return { ...trilha, cursos: cursosComCursos };
      })
    );
    
    return trilhasComCursos;
  } catch (error) {
    console.error('Erro ao buscar conteúdo completo para aluno:', error);
    return [];
  }
}

/**
 * Buscar conteúdo de uma trilha específica para o aluno
 */
export async function getTrilhaCompletoForStudent(trilhaId, userType) {
  try {
    // 1. Buscar trilha
    const trilhaDoc = await getDoc(doc(db, COLLECTIONS.TRILHAS, trilhaId));
    if (!trilhaDoc.exists()) return null;
    
    const trilha = { id: trilhaDoc.id, ...trilhaDoc.data() };
    
    // Validar acesso
    if (trilha.status !== 'PUBLISHED' || !trilha.ativo) return null;
    if (!canAccessByVisibility(trilha, userType)) return null;
    
    // 2. Buscar cursos
    const cursos = await getCursosForStudent(trilhaId, userType);
    
    // 3. Para cada curso, buscar módulos e aulas
    const cursosCompletos = await Promise.all(
      cursos.map(async (curso) => {
        const modulos = await getModulosForStudent(curso.id, userType);
        
        const modulosCompletos = await Promise.all(
          modulos.map(async (modulo) => {
            const aulas = await getAulasForStudent(modulo.id, userType);
            return { ...modulo, aulas };
          })
        );
        
        return { ...curso, modulos: modulosCompletos };
      })
    );
    
    return { ...trilha, cursos: cursosCompletos };
  } catch (error) {
    console.error('Erro ao buscar trilha completa para aluno:', error);
    return null;
  }
}

// ============================================================================
// VALIDAÇÃO SEGURA (acesso por URL direta)
// ============================================================================

/**
 * Buscar entidade por ID com validação de segurança
 * Bloqueia acesso a DRAFT via URL direta
 */
export async function getEntityByIdSecure(collectionName, entityId, userType) {
  try {
    const docRef = doc(db, collectionName, entityId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return { entity: null, error: 'Não encontrado' };
    }

    const entity = { id: docSnap.id, ...docSnap.data() };

    // Validar status (se aplicável)
    if (entity.status && entity.status !== 'PUBLISHED') {
      return { entity: null, error: 'ACCESS_DENIED: Conteúdo não publicado' };
    }

    // Validar ativo
    if (entity.ativo === false) {
      return { entity: null, error: 'ACCESS_DENIED: Conteúdo inativo' };
    }

    // Validar visibilidade
    if (!canAccessByVisibility(entity, userType)) {
      return { entity: null, error: 'ACCESS_DENIED: Sem permissão' };
    }

    return { entity, error: null };
  } catch (error) {
    console.error('Erro ao buscar entidade:', error);
    return { entity: null, error: error.message };
  }
}

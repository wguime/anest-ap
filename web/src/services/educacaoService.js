/**
 * Educacao Continuada Service
 * Sistema completo de gestão de conteúdos educacionais
 *
 * Estrutura Firestore (Normalizada):
 * - educacao_trilhas/{trilhaId}
 * - educacao_cursos/{cursoId}
 * - educacao_modulos/{moduloId}
 * - educacao_aulas/{aulaId}
 * - educacao_progresso/{userId}/cursos/{cursoId}
 * - educacao_progresso/{userId}/trilhas/{trilhaId}
 * - educacao_progresso/{userId}/estatisticas
 * - educacao_certificados/{certificadoId}
 * - educacao_categorias/{categoriaId}
 * - educacao_logs/{logId}
 */
import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  documentId,
  serverTimestamp,
  updateDoc,
  writeBatch,
  increment,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { computeEffectiveVisibility, canUserAccess } from '../pages/educacao/utils/visibilityUtils';

// ============================================================================
// RELAÇÕES (JUNCTION TABLES) - Reuso real com ordem por pai
// ============================================================================

export async function getCursoModulosRel(cursoId) {
  try {
    const q = query(
      collection(db, COLLECTIONS.CURSO_MODULOS),
      where('cursoId', '==', cursoId),
      orderBy('ordem', 'asc')
    );
    const snap = await getDocs(q);
    const rels = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return { rels, error: null };
  } catch (error) {
    console.error('Erro ao buscar relações curso-módulos:', error);
    return { rels: [], error: error.message };
  }
}

export async function getModuloAulasRel(moduloId) {
  try {
    const q = query(
      collection(db, COLLECTIONS.MODULO_AULAS),
      where('moduloId', '==', moduloId),
      orderBy('ordem', 'asc')
    );
    const snap = await getDocs(q);
    const rels = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return { rels, error: null };
  } catch (error) {
    console.error('Erro ao buscar relações módulo-aulas:', error);
    return { rels: [], error: error.message };
  }
}

export async function getAllCursoModulosRel() {
  try {
    const snap = await getDocs(collection(db, COLLECTIONS.CURSO_MODULOS));
    const rels = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return { rels, error: null };
  } catch (error) {
    console.error('Erro ao buscar todas relações curso-módulos:', error);
    return { rels: [], error: error.message };
  }
}

export async function getAllModuloAulasRel() {
  try {
    const snap = await getDocs(collection(db, COLLECTIONS.MODULO_AULAS));
    const rels = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return { rels, error: null };
  } catch (error) {
    console.error('Erro ao buscar todas relações módulo-aulas:', error);
    return { rels: [], error: error.message };
  }
}

export async function linkModuloToCurso(cursoId, moduloId, ordem = null, userId) {
  try {
    const safeUserId = userId || 'system';
    const { rels } = await getCursoModulosRel(cursoId);
    const already = rels.find(r => r.moduloId === moduloId);
    if (already) return { relId: already.id, error: null };

    const nextOrdem = ordem ?? (rels.length + 1);
    const docRef = await addDoc(collection(db, COLLECTIONS.CURSO_MODULOS), {
      cursoId,
      moduloId,
      ordem: nextOrdem,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: safeUserId,
    });

    await logOperacao({
      acao: 'create',
      entidade: 'curso_modulo',
      entidadeId: docRef.id,
      usuario: safeUserId,
      dados: { cursoId, moduloId, ordem: nextOrdem },
    });

    return { relId: docRef.id, error: null };
  } catch (error) {
    console.error('Erro ao vincular módulo ao curso:', error);
    return { relId: null, error: error.message };
  }
}

export async function unlinkModuloFromCurso(cursoId, moduloId, userId) {
  try {
    const { rels } = await getCursoModulosRel(cursoId);
    const rel = rels.find(r => r.moduloId === moduloId);
    if (!rel) return { success: true, error: null };

    await deleteDoc(doc(db, COLLECTIONS.CURSO_MODULOS, rel.id));

    await logOperacao({
      acao: 'delete',
      entidade: 'curso_modulo',
      entidadeId: rel.id,
      usuario: userId,
      dados: { cursoId, moduloId },
    });

    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao desvincular módulo do curso:', error);
    return { success: false, error: error.message };
  }
}

export async function linkAulaToModulo(moduloId, aulaId, ordem = null, userId) {
  try {
    const safeUserId = userId || 'system';
    const { rels } = await getModuloAulasRel(moduloId);
    const already = rels.find(r => r.aulaId === aulaId);
    if (already) return { relId: already.id, error: null };

    const nextOrdem = ordem ?? (rels.length + 1);
    const docRef = await addDoc(collection(db, COLLECTIONS.MODULO_AULAS), {
      moduloId,
      aulaId,
      ordem: nextOrdem,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: safeUserId,
    });

    await logOperacao({
      acao: 'create',
      entidade: 'modulo_aula',
      entidadeId: docRef.id,
      usuario: safeUserId,
      dados: { moduloId, aulaId, ordem: nextOrdem },
    });

    return { relId: docRef.id, error: null };
  } catch (error) {
    console.error('Erro ao vincular aula ao módulo:', error);
    return { relId: null, error: error.message };
  }
}

export async function unlinkAulaFromModulo(moduloId, aulaId, userId) {
  try {
    const { rels } = await getModuloAulasRel(moduloId);
    const rel = rels.find(r => r.aulaId === aulaId);
    if (!rel) return { success: true, error: null };

    await deleteDoc(doc(db, COLLECTIONS.MODULO_AULAS, rel.id));

    await logOperacao({
      acao: 'delete',
      entidade: 'modulo_aula',
      entidadeId: rel.id,
      usuario: userId,
      dados: { moduloId, aulaId },
    });

    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao desvincular aula do módulo:', error);
    return { success: false, error: error.message };
  }
}

export async function reorderCursoModulos(cursoId, moduloIds, userId) {
  try {
    const { rels } = await getCursoModulosRel(cursoId);
    const batch = writeBatch(db);

    moduloIds.forEach((moduloId, index) => {
      const rel = rels.find(r => r.moduloId === moduloId);
      if (!rel) return;
      batch.update(doc(db, COLLECTIONS.CURSO_MODULOS, rel.id), {
        ordem: index + 1,
        updatedAt: serverTimestamp(),
        updatedBy: userId || 'system',
      });
    });

    await batch.commit();
    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao reordenar módulos no curso:', error);
    return { success: false, error: error.message };
  }
}

export async function reorderModuloAulas(moduloId, aulaIds, userId) {
  try {
    const { rels } = await getModuloAulasRel(moduloId);
    const batch = writeBatch(db);

    aulaIds.forEach((aulaId, index) => {
      const rel = rels.find(r => r.aulaId === aulaId);
      if (!rel) return;
      batch.update(doc(db, COLLECTIONS.MODULO_AULAS, rel.id), {
        ordem: index + 1,
        updatedAt: serverTimestamp(),
        updatedBy: userId || 'system',
      });
    });

    await batch.commit();
    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao reordenar aulas no módulo:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// RELAÇÕES TRILHA ↔ CURSO (N:N) - Junction Table com ID composto
// ============================================================================

/**
 * Gerar ID composto para garantir unicidade: trilhaId_cursoId
 */
function getTrilhaCursoRelId(trilhaId, cursoId) {
  return `${trilhaId}_${cursoId}`;
}

/**
 * Buscar cursos de uma trilha (ordenados)
 */
export async function getTrilhaCursosRel(trilhaId) {
  try {
    const q = query(
      collection(db, COLLECTIONS.TRILHA_CURSOS),
      where('trilhaId', '==', trilhaId),
      orderBy('ordem', 'asc')
    );
    const snap = await getDocs(q);
    const rels = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return { rels, error: null };
  } catch (error) {
    console.error('Erro ao buscar relações trilha-cursos:', error);
    return { rels: [], error: error.message };
  }
}

/**
 * Buscar trilhas que contêm um curso
 */
export async function getCursoTrilhasRel(cursoId) {
  try {
    const q = query(
      collection(db, COLLECTIONS.TRILHA_CURSOS),
      where('cursoId', '==', cursoId)
    );
    const snap = await getDocs(q);
    const rels = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return { rels, error: null };
  } catch (error) {
    console.error('Erro ao buscar trilhas do curso:', error);
    return { rels: [], error: error.message };
  }
}

/**
 * Buscar todas as relações trilha-curso
 */
export async function getAllTrilhaCursosRel() {
  try {
    const snap = await getDocs(collection(db, COLLECTIONS.TRILHA_CURSOS));
    const rels = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return { rels, error: null };
  } catch (error) {
    console.error('Erro ao buscar todas relações trilha-cursos:', error);
    return { rels: [], error: error.message };
  }
}

/**
 * Vincular curso a uma trilha (usando ID composto para unicidade)
 */
export async function linkCursoToTrilha(trilhaId, cursoId, ordem = null, userId) {
  try {
    const safeUserId = userId || 'system';
    const relId = getTrilhaCursoRelId(trilhaId, cursoId);
    
    // Verificar se já existe
    const existingRef = doc(db, COLLECTIONS.TRILHA_CURSOS, relId);
    const existingSnap = await getDoc(existingRef);
    
    if (existingSnap.exists()) {
      return { relId, error: null }; // Já existe, retornar ID
    }
    
    // Buscar ordem se não fornecida
    let nextOrdem = ordem;
    if (nextOrdem === null) {
      const { rels } = await getTrilhaCursosRel(trilhaId);
      nextOrdem = rels.length + 1;
    }
    
    // Criar com ID composto
    await setDoc(doc(db, COLLECTIONS.TRILHA_CURSOS, relId), {
      trilhaId,
      cursoId,
      ordem: nextOrdem,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: safeUserId,
    });
    
    await logOperacao({
      acao: 'create',
      entidade: 'trilha_curso',
      entidadeId: relId,
      usuario: safeUserId,
      dados: { trilhaId, cursoId, ordem: nextOrdem },
    });
    
    return { relId, error: null };
  } catch (error) {
    console.error('Erro ao vincular curso à trilha:', error);
    return { relId: null, error: error.message };
  }
}

/**
 * Desvincular curso de uma trilha
 */
export async function unlinkCursoFromTrilha(trilhaId, cursoId, userId) {
  try {
    const relId = getTrilhaCursoRelId(trilhaId, cursoId);
    const docRef = doc(db, COLLECTIONS.TRILHA_CURSOS, relId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return { success: true, error: null }; // Já não existe
    }
    
    await deleteDoc(docRef);
    
    await logOperacao({
      acao: 'delete',
      entidade: 'trilha_curso',
      entidadeId: relId,
      usuario: userId || 'system',
      dados: { trilhaId, cursoId },
    });
    
    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao desvincular curso da trilha:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Reordenar cursos dentro de uma trilha
 */
export async function reorderTrilhaCursos(trilhaId, cursoIds, userId) {
  try {
    const batch = writeBatch(db);
    
    cursoIds.forEach((cursoId, index) => {
      const relId = getTrilhaCursoRelId(trilhaId, cursoId);
      batch.update(doc(db, COLLECTIONS.TRILHA_CURSOS, relId), {
        ordem: index + 1,
        updatedAt: serverTimestamp(),
        updatedBy: userId || 'system',
      });
    });
    
    await batch.commit();
    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao reordenar cursos na trilha:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Sincronizar cursos de uma trilha (substituir todos)
 * Útil para migração de Trilha.cursos[] para junction table
 */
export async function syncTrilhaCursos(trilhaId, cursoIds, userId) {
  try {
    const safeUserId = userId || 'system';
    const { rels: existingRels } = await getTrilhaCursosRel(trilhaId);
    const existingCursoIds = existingRels.map(r => r.cursoId);
    
    const batch = writeBatch(db);
    
    // Remover cursos que não estão mais na lista
    for (const rel of existingRels) {
      if (!cursoIds.includes(rel.cursoId)) {
        batch.delete(doc(db, COLLECTIONS.TRILHA_CURSOS, rel.id));
      }
    }
    
    // Adicionar/atualizar cursos
    cursoIds.forEach((cursoId, index) => {
      const relId = getTrilhaCursoRelId(trilhaId, cursoId);
      
      if (existingCursoIds.includes(cursoId)) {
        // Atualizar ordem
        batch.update(doc(db, COLLECTIONS.TRILHA_CURSOS, relId), {
          ordem: index + 1,
          updatedAt: serverTimestamp(),
          updatedBy: safeUserId,
        });
      } else {
        // Criar novo
        batch.set(doc(db, COLLECTIONS.TRILHA_CURSOS, relId), {
          trilhaId,
          cursoId,
          ordem: index + 1,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: safeUserId,
        });
      }
    });
    
    await batch.commit();
    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao sincronizar cursos da trilha:', error);
    return { success: false, error: error.message };
  }
}

async function getDocsByIdsSafe(collectionName, ids) {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const chunks = [];
  for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));

  const results = [];
  for (const chunk of chunks) {
    const q = query(
      collection(db, collectionName),
      where(documentId(), 'in', chunk)
    );
    const snap = await getDocs(q);
    snap.docs.forEach(d => results.push({ id: d.id, ...d.data() }));
  }
  return results;
}

// ============================================
// COLEÇÕES
// ============================================
const COLLECTIONS = {
  TRILHAS: 'educacao_trilhas',
  CURSOS: 'educacao_cursos',
  MODULOS: 'educacao_modulos',
  AULAS: 'educacao_aulas',
  TRILHA_CURSOS: 'educacao_trilha_cursos',  // N:N Trilha <-> Curso
  CURSO_MODULOS: 'educacao_curso_modulos',
  MODULO_AULAS: 'educacao_modulo_aulas',
  PROGRESSO: 'educacao_progresso',
  CERTIFICADOS: 'educacao_certificados',
  CATEGORIAS: 'educacao_categorias',
  LOGS: 'educacao_logs',
};

// ============================================
// TIPOS DE USUÁRIO (para filtragem de trilhas)
// ============================================
export const TIPOS_USUARIO = {
  medico: { label: 'Médico Staff', color: '#2563eb' },
  residente: { label: 'Médico Residente', color: '#7c3aed' },
  enfermeiro: { label: 'Enfermeiro', color: '#059669' },
  tecnico_enfermagem: { label: 'Técnico de Enfermagem', color: '#0891b2' },
  farmaceutico: { label: 'Farmacêutico', color: '#dc2626' },
  administrativo: { label: 'Administrativo', color: '#f59e0b' },
  secretaria: { label: 'Secretária', color: '#ec4899' },
  coordenador: { label: 'Coordenador', color: '#1e40af' },
  gestor: { label: 'Gestor', color: '#15803d' },
};

// ============================================
// AUDITORIA (Logs de operações)
// ============================================

/**
 * Registrar operação no log de auditoria
 */
async function logOperacao({ acao, entidade, entidadeId, usuario, dados }) {
  try {
    const safeUsuario = usuario || 'system';
    await addDoc(collection(db, COLLECTIONS.LOGS), {
      acao, // 'create' | 'update' | 'delete'
      entidade, // 'trilha' | 'curso' | 'modulo' | 'aula'
      entidadeId,
      usuario: safeUsuario,
      dados,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error('Erro ao registrar log:', error);
    // Não propagar erro - log é secundário
  }
}

// ============================================
// TRILHAS (Learning Paths)
// ============================================

/**
 * Buscar todas as trilhas ativas
 */
export async function getTrilhas() {
  try {
    const q = query(
      collection(db, COLLECTIONS.TRILHAS),
      where('ativo', '==', true),
      orderBy('ordem', 'asc')
    );
    const querySnapshot = await getDocs(q);
    const trilhas = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    return { trilhas, error: null };
  } catch (error) {
    console.error('Erro ao buscar trilhas:', error);
    return { trilhas: [], error: error.message };
  }
}

/**
 * Buscar trilha por ID
 */
export async function getTrilhaById(trilhaId) {
  try {
    const docRef = doc(db, COLLECTIONS.TRILHAS, trilhaId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { trilha: { id: docSnap.id, ...docSnap.data() }, error: null };
    }
    return { trilha: null, error: 'Trilha não encontrada' };
  } catch (error) {
    console.error('Erro ao buscar trilha:', error);
    return { trilha: null, error: error.message };
  }
}

/**
 * Adicionar nova trilha
 */
export async function addTrilha(data, userId) {
  try {
    const safeUserId = userId || 'system';
    const trilhaData = {
      ...data,
      cursos: data.cursos || [],
      ativo: data.ativo !== false,
      ordem: data.ordem || 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: safeUserId,
    };

    const docRef = await addDoc(collection(db, COLLECTIONS.TRILHAS), trilhaData);

    await logOperacao({
      acao: 'create',
      entidade: 'trilha',
      entidadeId: docRef.id,
      usuario: safeUserId,
      dados: { depois: trilhaData },
    });

    return { trilhaId: docRef.id, error: null };
  } catch (error) {
    console.error('Erro ao adicionar trilha:', error);
    return { trilhaId: null, error: error.message };
  }
}

/**
 * Atualizar trilha
 */
export async function updateTrilha(trilhaId, updates, userId) {
  try {
    const docRef = doc(db, COLLECTIONS.TRILHAS, trilhaId);
    const docSnap = await getDoc(docRef);
    const dadosAnteriores = docSnap.exists() ? docSnap.data() : null;

    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });

    await logOperacao({
      acao: 'update',
      entidade: 'trilha',
      entidadeId: trilhaId,
      usuario: userId,
      dados: { antes: dadosAnteriores, depois: updates },
    });

    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao atualizar trilha:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Deletar trilha (soft delete)
 */
export async function deleteTrilha(trilhaId, userId) {
  try {
    const docRef = doc(db, COLLECTIONS.TRILHAS, trilhaId);
    await updateDoc(docRef, {
      ativo: false,
      deletedAt: serverTimestamp(),
      deletedBy: userId,
    });

    await logOperacao({
      acao: 'delete',
      entidade: 'trilha',
      entidadeId: trilhaId,
      usuario: userId,
      dados: { softDelete: true },
    });

    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao deletar trilha:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Buscar trilhas por tipo de usuário
 */
export async function getTrilhasPorTipoUsuario(tipoUsuario) {
  try {
    const q = query(
      collection(db, COLLECTIONS.TRILHAS),
      where('ativo', '==', true),
      where('tiposUsuario', 'array-contains', tipoUsuario)
    );
    const querySnapshot = await getDocs(q);
    const trilhas = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    return { trilhas, error: null };
  } catch (error) {
    console.error('Erro ao buscar trilhas por tipo:', error);
    return { trilhas: [], error: error.message };
  }
}

// ============================================
// CURSOS
// ============================================

/**
 * Buscar todos os cursos ativos
 */
export async function getCursos() {
  try {
    const q = query(
      collection(db, COLLECTIONS.CURSOS),
      where('ativo', '==', true),
      orderBy('ordem', 'asc')
    );
    const querySnapshot = await getDocs(q);
    const cursos = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    return { cursos, error: null };
  } catch (error) {
    console.error('Erro ao buscar cursos:', error);
    return { cursos: [], error: error.message };
  }
}

/**
 * Buscar um curso específico pelo ID
 */
export async function getCursoById(cursoId) {
  try {
    const docRef = doc(db, COLLECTIONS.CURSOS, cursoId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { curso: { id: docSnap.id, ...docSnap.data() }, error: null };
    }
    return { curso: null, error: 'Curso não encontrado' };
  } catch (error) {
    console.error('Erro ao buscar curso:', error);
    return { curso: null, error: error.message };
  }
}

/**
 * Adicionar novo curso
 */
export async function addCurso(data, userId) {
  try {
    const safeUserId = userId || 'system';
    const cursoData = {
      ...data,
      moduloIds: data.moduloIds || [],
      ativo: data.ativo !== false,
      ordem: data.ordem || 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: safeUserId,
    };

    const docRef = await addDoc(collection(db, COLLECTIONS.CURSOS), cursoData);

    await logOperacao({
      acao: 'create',
      entidade: 'curso',
      entidadeId: docRef.id,
      usuario: safeUserId,
      dados: { depois: cursoData },
    });

    return { cursoId: docRef.id, error: null };
  } catch (error) {
    console.error('Erro ao adicionar curso:', error);
    return { cursoId: null, error: error.message };
  }
}

/**
 * Atualizar curso
 */
export async function updateCurso(cursoId, updates, userId) {
  try {
    const docRef = doc(db, COLLECTIONS.CURSOS, cursoId);
    const docSnap = await getDoc(docRef);
    const dadosAnteriores = docSnap.exists() ? docSnap.data() : null;

    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });

    await logOperacao({
      acao: 'update',
      entidade: 'curso',
      entidadeId: cursoId,
      usuario: userId,
      dados: { antes: dadosAnteriores, depois: updates },
    });

    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao atualizar curso:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Deletar curso (soft delete) - também desativa módulos e aulas
 */
export async function deleteCurso(cursoId, userId) {
  try {
    const batch = writeBatch(db);

    // Soft delete no curso
    const cursoRef = doc(db, COLLECTIONS.CURSOS, cursoId);
    batch.update(cursoRef, {
      ativo: false,
      deletedAt: serverTimestamp(),
      deletedBy: userId,
    });

    // Remover relações curso ↔ módulos (não desativar módulos/aulas, pois podem ser reutilizados)
    const relSnap = await getDocs(
      query(collection(db, COLLECTIONS.CURSO_MODULOS), where('cursoId', '==', cursoId))
    );
    relSnap.docs.forEach(d => batch.delete(d.ref));

    await batch.commit();

    await logOperacao({
      acao: 'delete',
      entidade: 'curso',
      entidadeId: cursoId,
      usuario: userId,
      dados: {
        softDelete: true,
        relacoesRemovidas: relSnap.docs.length,
      },
    });

    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao deletar curso:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Buscar cursos obrigatórios por tipo de usuário
 */
export async function getCursosObrigatorios(tipoUsuario) {
  try {
    // Primeiro buscar trilhas obrigatórias para esse tipo
    const { trilhas } = await getTrilhasPorTipoUsuario(tipoUsuario);
    const trilhasObrigatorias = trilhas.filter(t => t.obrigatoria);

    // Coletar IDs únicos de cursos
    const cursoIds = new Set();
    trilhasObrigatorias.forEach(t => {
      (t.cursos || []).forEach(id => cursoIds.add(id));
    });

    if (cursoIds.size === 0) {
      return { cursos: [], error: null };
    }

    // Buscar cursos
    const cursos = [];
    for (const cursoId of cursoIds) {
      const { curso } = await getCursoById(cursoId);
      if (curso && curso.ativo) {
        cursos.push(curso);
      }
    }

    return { cursos, error: null };
  } catch (error) {
    console.error('Erro ao buscar cursos obrigatórios:', error);
    return { cursos: [], error: error.message };
  }
}

/**
 * Buscar cursos opcionais por tipo de usuário
 */
export async function getCursosOpcionais(tipoUsuario) {
  try {
    const { trilhas } = await getTrilhasPorTipoUsuario(tipoUsuario);
    const trilhasOpcionais = trilhas.filter(t => !t.obrigatoria);

    const cursoIds = new Set();
    trilhasOpcionais.forEach(t => {
      (t.cursos || []).forEach(id => cursoIds.add(id));
    });

    if (cursoIds.size === 0) {
      return { cursos: [], error: null };
    }

    const cursos = [];
    for (const cursoId of cursoIds) {
      const { curso } = await getCursoById(cursoId);
      if (curso && curso.ativo) {
        cursos.push(curso);
      }
    }

    return { cursos, error: null };
  } catch (error) {
    console.error('Erro ao buscar cursos opcionais:', error);
    return { cursos: [], error: error.message };
  }
}

// ============================================
// MÓDULOS
// ============================================

/**
 * Buscar módulos de um curso
 */
export async function getModulosByCurso(cursoId) {
  try {
    // Preferir relações (reuso real). Fallback para legado (cursoId em módulo).
    const { rels } = await getCursoModulosRel(cursoId);
    if (rels?.length) {
      const moduloIds = rels.map(r => r.moduloId);
      const modulos = await getDocsByIdsSafe(COLLECTIONS.MODULOS, moduloIds);
      const modulosAtivos = modulos.filter(m => m.ativo !== false);
      const byId = new Map(modulosAtivos.map(m => [m.id, m]));
      return {
        modulos: moduloIds.map(id => byId.get(id)).filter(Boolean),
        error: null,
      };
    }

    const q = query(
      collection(db, COLLECTIONS.MODULOS),
      where('cursoId', '==', cursoId),
      where('ativo', '==', true),
      orderBy('ordem', 'asc')
    );
    const querySnapshot = await getDocs(q);
    const modulos = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return { modulos, error: null };
  } catch (error) {
    console.error('Erro ao buscar módulos:', error);
    return { modulos: [], error: error.message };
  }
}

/**
 * Buscar módulo por ID
 */
export async function getModuloById(moduloId) {
  try {
    const docRef = doc(db, COLLECTIONS.MODULOS, moduloId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { modulo: { id: docSnap.id, ...docSnap.data() }, error: null };
    }
    return { modulo: null, error: 'Módulo não encontrado' };
  } catch (error) {
    console.error('Erro ao buscar módulo:', error);
    return { modulo: null, error: error.message };
  }
}

/**
 * Adicionar novo módulo
 */
export async function addModulo(data, userId) {
  try {
    const safeUserId = userId || 'system';
    const cursoId = data.cursoId || null;

    // Ordem por curso deve viver na relação; mantemos `ordem` no módulo apenas como compatibilidade.
    const { rels } = cursoId ? await getCursoModulosRel(cursoId) : { rels: [] };
    const nextOrdem = data.ordem || (rels?.length || 0) + 1;

    const moduloData = {
      ...data,
      aulaIds: data.aulaIds || [],
      ativo: data.ativo !== false,
      ordem: nextOrdem,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: safeUserId,
    };

    const docRef = await addDoc(collection(db, COLLECTIONS.MODULOS), moduloData);

    // Criar vínculo curso ↔ módulo (reuso real)
    if (cursoId) {
      await linkModuloToCurso(cursoId, docRef.id, nextOrdem, safeUserId);

      // Atualizar lista legado no curso (compatibilidade)
      const cursoRef = doc(db, COLLECTIONS.CURSOS, cursoId);
      const cursoSnap = await getDoc(cursoRef);
      if (cursoSnap.exists()) {
        const cursoData = cursoSnap.data();
        const moduloIds = cursoData.moduloIds || [];
        await updateDoc(cursoRef, {
          moduloIds: [...moduloIds, docRef.id],
          updatedAt: serverTimestamp(),
        });
      }
    }

    await logOperacao({
      acao: 'create',
      entidade: 'modulo',
      entidadeId: docRef.id,
      usuario: safeUserId,
      dados: { depois: moduloData },
    });

    return { moduloId: docRef.id, error: null };
  } catch (error) {
    console.error('Erro ao adicionar módulo:', error);
    return { moduloId: null, error: error.message };
  }
}

/**
 * Atualizar módulo
 */
export async function updateModulo(moduloId, updates, userId) {
  try {
    const docRef = doc(db, COLLECTIONS.MODULOS, moduloId);
    const docSnap = await getDoc(docRef);
    const dadosAnteriores = docSnap.exists() ? docSnap.data() : null;

    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });

    await logOperacao({
      acao: 'update',
      entidade: 'modulo',
      entidadeId: moduloId,
      usuario: userId,
      dados: { antes: dadosAnteriores, depois: updates },
    });

    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao atualizar módulo:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Deletar módulo (soft delete)
 */
export async function deleteModulo(moduloId, userId) {
  try {
    const batch = writeBatch(db);

    // Buscar o módulo para saber o cursoId
    const moduloRef = doc(db, COLLECTIONS.MODULOS, moduloId);
    const moduloSnap = await getDoc(moduloRef);
    const moduloData = moduloSnap.data();

    // Soft delete no módulo
    batch.update(moduloRef, {
      ativo: false,
      deletedAt: serverTimestamp(),
      deletedBy: userId,
    });

    // Remover relações (módulo pode estar em múltiplos cursos; aulas podem ser reutilizadas)
    const cursoRelsSnap = await getDocs(
      query(collection(db, COLLECTIONS.CURSO_MODULOS), where('moduloId', '==', moduloId))
    );
    cursoRelsSnap.docs.forEach(d => batch.delete(d.ref));

    const aulaRelsSnap = await getDocs(
      query(collection(db, COLLECTIONS.MODULO_AULAS), where('moduloId', '==', moduloId))
    );
    aulaRelsSnap.docs.forEach(d => batch.delete(d.ref));

    // Compatibilidade: remover do cursoId legado (se existir)
    if (moduloData?.cursoId) {
      const cursoRef = doc(db, COLLECTIONS.CURSOS, moduloData.cursoId);
      const cursoSnap = await getDoc(cursoRef);
      if (cursoSnap.exists()) {
        const cursoData = cursoSnap.data();
        const moduloIds = (cursoData.moduloIds || []).filter(id => id !== moduloId);
        batch.update(cursoRef, { moduloIds, updatedAt: serverTimestamp() });
      }
    }

    await batch.commit();

    await logOperacao({
      acao: 'delete',
      entidade: 'modulo',
      entidadeId: moduloId,
      usuario: userId,
      dados: {
        softDelete: true,
        relacoesCursoRemovidas: cursoRelsSnap.docs.length,
        relacoesAulaRemovidas: aulaRelsSnap.docs.length,
      },
    });

    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao deletar módulo:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// AULAS
// ============================================

/**
 * Buscar aulas de um módulo
 */
export async function getAulasByModulo(moduloId) {
  try {
    // Preferir relações (reuso real). Fallback para legado (moduloId em aula).
    const { rels } = await getModuloAulasRel(moduloId);
    if (rels?.length) {
      const aulaIds = rels.map(r => r.aulaId);
      const aulas = await getDocsByIdsSafe(COLLECTIONS.AULAS, aulaIds);
      const aulasAtivas = aulas.filter(a => a.ativo !== false);
      const byId = new Map(aulasAtivas.map(a => [a.id, a]));
      return {
        aulas: aulaIds.map(id => byId.get(id)).filter(Boolean),
        error: null,
      };
    }

    const q = query(
      collection(db, COLLECTIONS.AULAS),
      where('moduloId', '==', moduloId),
      where('ativo', '==', true),
      orderBy('ordem', 'asc')
    );
    const querySnapshot = await getDocs(q);
    const aulas = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return { aulas, error: null };
  } catch (error) {
    console.error('Erro ao buscar aulas:', error);
    return { aulas: [], error: error.message };
  }
}

/**
 * Buscar aula por ID
 */
export async function getAulaById(aulaId) {
  try {
    const docRef = doc(db, COLLECTIONS.AULAS, aulaId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { aula: { id: docSnap.id, ...docSnap.data() }, error: null };
    }
    return { aula: null, error: 'Aula não encontrada' };
  } catch (error) {
    console.error('Erro ao buscar aula:', error);
    return { aula: null, error: error.message };
  }
}

/**
 * Adicionar nova aula
 */
export async function addAula(data, userId) {
  try {
    const safeUserId = userId || 'system';
    const moduloId = data.moduloId || null;
    const { rels } = moduloId ? await getModuloAulasRel(moduloId) : { rels: [] };
    const nextOrdem = data.ordem || (rels?.length || 0) + 1;

    const aulaData = {
      ...data,
      ativo: data.ativo !== false,
      ordem: nextOrdem,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: safeUserId,
    };

    const docRef = await addDoc(collection(db, COLLECTIONS.AULAS), aulaData);

    // Criar vínculo módulo ↔ aula (reuso real)
    if (moduloId) {
      await linkAulaToModulo(moduloId, docRef.id, nextOrdem, safeUserId);

      // Atualizar lista legado no módulo (compatibilidade)
      const moduloRef = doc(db, COLLECTIONS.MODULOS, moduloId);
      const moduloSnap = await getDoc(moduloRef);
      if (moduloSnap.exists()) {
        const moduloData = moduloSnap.data();
        const aulaIds = moduloData.aulaIds || [];
        await updateDoc(moduloRef, {
          aulaIds: [...aulaIds, docRef.id],
          updatedAt: serverTimestamp(),
        });
      }
    }

    await logOperacao({
      acao: 'create',
      entidade: 'aula',
      entidadeId: docRef.id,
      usuario: safeUserId,
      dados: { depois: aulaData },
    });

    return { aulaId: docRef.id, error: null };
  } catch (error) {
    console.error('Erro ao adicionar aula:', error);
    return { aulaId: null, error: error.message };
  }
}

/**
 * Atualizar aula
 */
export async function updateAula(aulaId, updates, userId) {
  try {
    const docRef = doc(db, COLLECTIONS.AULAS, aulaId);
    const docSnap = await getDoc(docRef);
    const dadosAnteriores = docSnap.exists() ? docSnap.data() : null;

    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });

    await logOperacao({
      acao: 'update',
      entidade: 'aula',
      entidadeId: aulaId,
      usuario: userId,
      dados: { antes: dadosAnteriores, depois: updates },
    });

    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao atualizar aula:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Deletar aula (soft delete)
 */
export async function deleteAula(aulaId, userId) {
  try {
    const aulaRef = doc(db, COLLECTIONS.AULAS, aulaId);
    const aulaSnap = await getDoc(aulaRef);
    const aulaData = aulaSnap.data();

    const batch = writeBatch(db);

    // Soft delete na aula
    batch.update(aulaRef, {
      ativo: false,
      deletedAt: serverTimestamp(),
      deletedBy: userId,
    });

    // Remover relações módulo ↔ aula (aula pode estar em múltiplos módulos)
    const relSnap = await getDocs(
      query(collection(db, COLLECTIONS.MODULO_AULAS), where('aulaId', '==', aulaId))
    );
    relSnap.docs.forEach(d => batch.delete(d.ref));

    // Compatibilidade: remover da lista legado do módulo (se existir)
    if (aulaData?.moduloId) {
      const moduloRef = doc(db, COLLECTIONS.MODULOS, aulaData.moduloId);
      const moduloSnap = await getDoc(moduloRef);
      if (moduloSnap.exists()) {
        const moduloData = moduloSnap.data();
        const aulaIds = (moduloData.aulaIds || []).filter(id => id !== aulaId);
        batch.update(moduloRef, { aulaIds, updatedAt: serverTimestamp() });
      }
    }

    await batch.commit();

    await logOperacao({
      acao: 'delete',
      entidade: 'aula',
      entidadeId: aulaId,
      usuario: userId,
      dados: { softDelete: true, relacoesRemovidas: relSnap.docs.length },
    });

    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao deletar aula:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// REORDENAÇÃO
// ============================================

/**
 * Reordenar cursos dentro de uma trilha
 */
export async function reorderCursos(trilhaId, cursoIds, userId) {
  try {
    const docRef = doc(db, COLLECTIONS.TRILHAS, trilhaId);
    await updateDoc(docRef, {
      cursos: cursoIds,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao reordenar cursos:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Reordenar módulos dentro de um curso
 */
export async function reorderModulos(cursoId, moduloIds, userId) {
  try {
    // Preferir reordenação via relações (ordem por curso). Fallback para legado.
    const { rels } = await getCursoModulosRel(cursoId);
    if (rels?.length) {
      const { success, error } = await reorderCursoModulos(cursoId, moduloIds, userId);
      if (!success) throw new Error(error);
      // Compatibilidade: atualizar lista no curso
      await updateDoc(doc(db, COLLECTIONS.CURSOS, cursoId), {
        moduloIds,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      });
      return { success: true, error: null };
    }

    const batch = writeBatch(db);
    moduloIds.forEach((moduloId, index) => {
      batch.update(doc(db, COLLECTIONS.MODULOS, moduloId), { ordem: index + 1 });
    });
    batch.update(doc(db, COLLECTIONS.CURSOS, cursoId), {
      moduloIds,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
    await batch.commit();
    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao reordenar módulos:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Reordenar aulas dentro de um módulo
 */
export async function reorderAulas(moduloId, aulaIds, userId) {
  try {
    // Preferir reordenação via relações (ordem por módulo). Fallback para legado.
    const { rels } = await getModuloAulasRel(moduloId);
    if (rels?.length) {
      const { success, error } = await reorderModuloAulas(moduloId, aulaIds, userId);
      if (!success) throw new Error(error);
      // Compatibilidade: atualizar lista no módulo
      await updateDoc(doc(db, COLLECTIONS.MODULOS, moduloId), {
        aulaIds,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      });
      return { success: true, error: null };
    }

    const batch = writeBatch(db);
    aulaIds.forEach((aulaId, index) => {
      batch.update(doc(db, COLLECTIONS.AULAS, aulaId), { ordem: index + 1 });
    });
    batch.update(doc(db, COLLECTIONS.MODULOS, moduloId), {
      aulaIds,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
    await batch.commit();
    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao reordenar aulas:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// PROGRESSO DO USUÁRIO
// ============================================

/**
 * Buscar progresso de um usuário em todos os cursos
 */
export async function getProgressoUsuario(userId) {
  try {
    const progressoRef = collection(db, COLLECTIONS.PROGRESSO, userId, 'cursos');
    const querySnapshot = await getDocs(progressoRef);
    const progressos = querySnapshot.docs.map(doc => ({
      id: doc.id,
      cursoId: doc.id,
      ...doc.data(),
    }));
    return { progressos, error: null };
  } catch (error) {
    console.error('Erro ao buscar progresso:', error);
    return { progressos: [], error: error.message };
  }
}

/**
 * Buscar progresso de um usuário em um curso específico
 */
export async function getProgressoCurso(userId, cursoId) {
  try {
    const docRef = doc(db, COLLECTIONS.PROGRESSO, userId, 'cursos', cursoId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { progresso: { id: docSnap.id, ...docSnap.data() }, error: null };
    }
    return { progresso: null, error: null };
  } catch (error) {
    console.error('Erro ao buscar progresso do curso:', error);
    return { progresso: null, error: error.message };
  }
}

/**
 * Buscar progresso do usuário em uma trilha
 */
export async function getProgressoTrilha(userId, trilhaId) {
  try {
    const docRef = doc(db, COLLECTIONS.PROGRESSO, userId, 'trilhas', trilhaId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { progresso: { id: docSnap.id, ...docSnap.data() }, error: null };
    }
    return { progresso: null, error: null };
  } catch (error) {
    console.error('Erro ao buscar progresso da trilha:', error);
    return { progresso: null, error: error.message };
  }
}

/**
 * Buscar estatísticas do usuário
 */
export async function getEstatisticasUsuario(userId) {
  try {
    const docRef = doc(db, COLLECTIONS.PROGRESSO, userId, 'estatisticas', 'geral');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { estatisticas: docSnap.data(), error: null };
    }
    return {
      estatisticas: {
        totalPontos: 0,
        totalCursosCompletos: 0,
        totalCertificados: 0,
        horasEstudadas: 0,
        ultimaAtividade: null,
      },
      error: null
    };
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    return { estatisticas: null, error: error.message };
  }
}

/**
 * Iniciar um curso (criar registro de progresso)
 */
export async function iniciarCurso(userId, cursoId) {
  try {
    const docRef = doc(db, COLLECTIONS.PROGRESSO, userId, 'cursos', cursoId);
    const docSnap = await getDoc(docRef);

    // Se já existe, não sobrescrever
    if (docSnap.exists()) {
      return { success: true, error: null };
    }

    await setDoc(docRef, {
      cursoId,
      status: 'em_andamento',
      progresso: 0,
      modulosCompletos: [],
      aulasAssistidas: [],
      dataInicio: serverTimestamp(),
      dataConclusao: null,
      pontos: 0,
      ultimoAcesso: serverTimestamp(),
    });

    // Atualizar estatísticas gerais
    const statsRef = doc(db, COLLECTIONS.PROGRESSO, userId, 'estatisticas', 'geral');
    await setDoc(statsRef, {
      ultimaAtividade: serverTimestamp(),
    }, { merge: true });

    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao iniciar curso:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Marcar aula como assistida
 */
export async function marcarAulaAssistida(userId, cursoId, aulaId, percentualAssistido = 100) {
  try {
    const docRef = doc(db, COLLECTIONS.PROGRESSO, userId, 'cursos', cursoId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      // Iniciar curso se não existir
      await iniciarCurso(userId, cursoId);
    }

    const data = docSnap.exists() ? docSnap.data() : { aulasAssistidas: [] };
    const aulasAssistidas = data.aulasAssistidas || [];

    // Verificar se já está na lista
    const existente = aulasAssistidas.find(a =>
      typeof a === 'string' ? a === aulaId : a.aulaId === aulaId
    );

    if (!existente && percentualAssistido >= 90) {
      // Adicionar nova aula assistida
      aulasAssistidas.push({
        aulaId,
        percentual: percentualAssistido,
        dataAssistida: new Date().toISOString(),
      });
    } else if (existente && typeof existente === 'object') {
      // Atualizar percentual se já existe
      existente.percentual = Math.max(existente.percentual, percentualAssistido);
    }

    await updateDoc(docRef, {
      aulasAssistidas,
      ultimoAcesso: serverTimestamp(),
    });

    // Atualizar estatísticas
    const statsRef = doc(db, COLLECTIONS.PROGRESSO, userId, 'estatisticas', 'geral');
    await setDoc(statsRef, {
      ultimaAtividade: serverTimestamp(),
    }, { merge: true });

    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao marcar aula assistida:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Concluir um módulo
 */
export async function concluirModulo(userId, cursoId, moduloId, totalModulos) {
  try {
    const docRef = doc(db, COLLECTIONS.PROGRESSO, userId, 'cursos', cursoId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return { success: false, error: 'Progresso não encontrado' };
    }

    const data = docSnap.data();
    const modulosCompletos = data.modulosCompletos || [];

    if (!modulosCompletos.includes(moduloId)) {
      modulosCompletos.push(moduloId);
    }

    const progresso = Math.round((modulosCompletos.length / totalModulos) * 100);
    const isConcluido = progresso >= 100;

    await updateDoc(docRef, {
      modulosCompletos,
      progresso,
      status: isConcluido ? 'concluido' : 'em_andamento',
      dataConclusao: isConcluido ? serverTimestamp() : null,
      updatedAt: serverTimestamp(),
    });

    return { success: true, progresso, isConcluido, error: null };
  } catch (error) {
    console.error('Erro ao concluir módulo:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Concluir um curso manualmente
 */
export async function concluirCurso(userId, cursoId, pontos = 0) {
  try {
    const docRef = doc(db, COLLECTIONS.PROGRESSO, userId, 'cursos', cursoId);

    await updateDoc(docRef, {
      status: 'concluido',
      progresso: 100,
      pontos,
      dataConclusao: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Atualizar estatísticas
    const statsRef = doc(db, COLLECTIONS.PROGRESSO, userId, 'estatisticas', 'geral');
    await setDoc(statsRef, {
      totalPontos: increment(pontos),
      totalCursosCompletos: increment(1),
      ultimaAtividade: serverTimestamp(),
    }, { merge: true });

    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao concluir curso:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Concluir uma trilha
 */
export async function concluirTrilha(userId, trilhaId) {
  try {
    const docRef = doc(db, COLLECTIONS.PROGRESSO, userId, 'trilhas', trilhaId);

    await setDoc(docRef, {
      status: 'concluido',
      progresso: 100,
      dataConclusao: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao concluir trilha:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Atualizar progresso genérico
 */
export async function atualizarProgresso(userId, cursoId, dados) {
  try {
    const docRef = doc(db, COLLECTIONS.PROGRESSO, userId, 'cursos', cursoId);
    await updateDoc(docRef, {
      ...dados,
      updatedAt: serverTimestamp(),
    });
    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao atualizar progresso:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// CERTIFICADOS
// ============================================

/**
 * Buscar certificados de um usuário
 */
export async function getCertificados(userId) {
  try {
    const q = query(
      collection(db, COLLECTIONS.CERTIFICADOS),
      where('userId', '==', userId),
      orderBy('dataConclusao', 'desc')
    );
    const querySnapshot = await getDocs(q);
    const certificados = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    return { certificados, error: null };
  } catch (error) {
    console.error('Erro ao buscar certificados:', error);
    return { certificados: [], error: error.message };
  }
}

/**
 * Emitir certificado para um curso concluído
 */
export async function emitirCertificado(userId, curso, trilhaId = null) {
  try {
    const certificadoId = trilhaId
      ? `${userId}_trilha_${trilhaId}`
      : `${userId}_${curso.id}`;
    const docRef = doc(db, COLLECTIONS.CERTIFICADOS, certificadoId);

    const certificado = {
      id: certificadoId,
      userId,
      cursoId: curso.id,
      cursoTitulo: curso.titulo,
      trilhaId,
      cargaHoraria: `${Math.ceil((curso.duracaoMinutos || 60) / 60)}h`,
      dataConclusao: serverTimestamp(),
      dataEmissao: serverTimestamp(),
      validoAte: null, // Sem expiração por padrão
      arquivoUrl: null,
      emitido: true,
      createdAt: serverTimestamp(),
    };

    await setDoc(docRef, certificado);

    // Atualizar estatísticas
    const statsRef = doc(db, COLLECTIONS.PROGRESSO, userId, 'estatisticas', 'geral');
    await setDoc(statsRef, {
      totalCertificados: increment(1),
      ultimaAtividade: serverTimestamp(),
    }, { merge: true });

    return { certificado: { ...certificado, id: certificadoId }, error: null };
  } catch (error) {
    console.error('Erro ao emitir certificado:', error);
    return { certificado: null, error: error.message };
  }
}

// ============================================
// CATEGORIAS
// ============================================

/**
 * Buscar categorias
 */
export async function getCategorias() {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTIONS.CATEGORIAS));
    const categorias = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    return { categorias, error: null };
  } catch (error) {
    console.error('Erro ao buscar categorias:', error);
    return { categorias: [], error: error.message };
  }
}

/**
 * Adicionar categoria
 */
export async function addCategoria(data, userId) {
  try {
    const safeUserId = userId || 'system';
    const docRef = await addDoc(collection(db, COLLECTIONS.CATEGORIAS), {
      ...data,
      createdAt: serverTimestamp(),
      createdBy: safeUserId,
    });
    return { categoriaId: docRef.id, error: null };
  } catch (error) {
    console.error('Erro ao adicionar categoria:', error);
    return { categoriaId: null, error: error.message };
  }
}

// ============================================
// ESTATÍSTICAS E PONTOS
// ============================================

/**
 * Calcular pontos totais do usuário
 */
export async function calcularPontosTotais(userId) {
  try {
    const { progressos } = await getProgressoUsuario(userId);
    const pontos = progressos
      .filter(p => p.status === 'concluido')
      .reduce((sum, p) => sum + (p.pontos || 0), 0);
    return { pontos, error: null };
  } catch (error) {
    console.error('Erro ao calcular pontos:', error);
    return { pontos: 0, error: error.message };
  }
}

/**
 * Calcular horas estudadas
 */
export async function getHorasEstudadas(userId) {
  try {
    const { progressos } = await getProgressoUsuario(userId);
    const { cursos } = await getCursos();

    let minutos = 0;
    progressos.forEach(p => {
      const curso = cursos.find(c => c.id === p.cursoId);
      if (curso && p.progresso > 0) {
        minutos += Math.round((curso.duracaoMinutos || 0) * (p.progresso / 100));
      }
    });

    return { horas: Math.round(minutos / 60 * 10) / 10, error: null };
  } catch (error) {
    console.error('Erro ao calcular horas:', error);
    return { horas: 0, error: error.message };
  }
}

/**
 * Buscar ranking de usuários (para gamificação)
 */
export async function getRankingUsuarios(tipoUsuario = null, limite = 10) {
  try {
    // Esta é uma operação complexa que idealmente seria feita com Cloud Functions
    // Por simplicidade, retornamos mock
    // Em produção: consultar collection aggregada ou usar Cloud Functions
    return {
      ranking: [],
      error: 'Implementação via Cloud Functions necessária para produção'
    };
  } catch (error) {
    console.error('Erro ao buscar ranking:', error);
    return { ranking: [], error: error.message };
  }
}

// ============================================
// RELATÓRIOS ADMIN
// ============================================

/**
 * Obter relatório de progresso por tipo de usuário
 */
export async function getRelatorioProgressoPorTipo(tipoUsuario) {
  try {
    // Esta operação requer agregação que deve ser feita via Cloud Functions
    // Por simplicidade, retornamos estrutura esperada
    return {
      relatorio: {
        tipoUsuario,
        totalUsuarios: 0,
        emDia: 0,
        atrasados: 0,
        cursosPopulares: [],
        tempoMedioConclusao: 0,
      },
      error: 'Implementação via Cloud Functions necessária para relatórios completos'
    };
  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    return { relatorio: null, error: error.message };
  }
}

// ============================================
// VISIBILIDADE E SEGURANÇA
// ============================================

/**
 * Buscar entidades visíveis para um tipo de usuário
 * Usa campos effectiveVisibility pré-computados para query eficiente
 * @param {string} collectionName - Nome da collection
 * @param {string} userType - Tipo do usuário
 * @param {Object} additionalFilters - Filtros adicionais (ex: { ativo: true })
 */
export async function getVisibleEntities(collectionName, userType, additionalFilters = {}) {
  try {
    // Query 1: Entidades PUBLIC
    const publicConstraints = [
      where('effectiveVisibility', '==', 'PUBLIC'),
    ];
    
    // Adicionar filtros adicionais
    Object.entries(additionalFilters).forEach(([key, value]) => {
      publicConstraints.push(where(key, '==', value));
    });
    
    const publicQ = query(collection(db, collectionName), ...publicConstraints);
    
    // Query 2: Entidades RESTRICTED para este userType
    const restrictedConstraints = [
      where('effectiveVisibility', '==', 'RESTRICTED'),
      where('effectiveAllowedUserTypes', 'array-contains', userType),
    ];
    
    Object.entries(additionalFilters).forEach(([key, value]) => {
      restrictedConstraints.push(where(key, '==', value));
    });
    
    const restrictedQ = query(collection(db, collectionName), ...restrictedConstraints);
    
    // Query 3: Entidades sem effectiveVisibility definido (legado - assume PUBLIC)
    const legacyConstraints = [
      where('effectiveVisibility', '==', null),
    ];
    
    Object.entries(additionalFilters).forEach(([key, value]) => {
      legacyConstraints.push(where(key, '==', value));
    });
    
    // Executar queries em paralelo
    const [publicSnap, restrictedSnap] = await Promise.all([
      getDocs(publicQ),
      getDocs(restrictedQ),
    ]);
    
    const results = [
      ...publicSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      ...restrictedSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    ];
    
    return { entities: results, error: null };
  } catch (error) {
    console.error(`Erro ao buscar entidades visíveis de ${collectionName}:`, error);
    return { entities: [], error: error.message };
  }
}

/**
 * Buscar trilhas visíveis para um tipo de usuário
 */
export async function getVisibleTrilhas(userType) {
  try {
    const { entities, error } = await getVisibleEntities(
      COLLECTIONS.TRILHAS,
      userType,
      { ativo: true }
    );
    
    if (error) return { trilhas: [], error };
    
    // Ordenar por ordem
    entities.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    
    return { trilhas: entities, error: null };
  } catch (error) {
    console.error('Erro ao buscar trilhas visíveis:', error);
    return { trilhas: [], error: error.message };
  }
}

/**
 * Buscar entidade por ID com verificação de acesso
 * BLOQUEIA acesso não autorizado
 * @param {string} collectionName - Nome da collection
 * @param {string} entityId - ID da entidade
 * @param {string} userType - Tipo do usuário
 * @returns {{ entity: Object|null, error: string|null }}
 */
export async function getEntityByIdSecure(collectionName, entityId, userType) {
  try {
    const docRef = doc(db, collectionName, entityId);
    const snap = await getDoc(docRef);
    
    if (!snap.exists()) {
      return { entity: null, error: 'NOT_FOUND' };
    }
    
    const entity = { id: snap.id, ...snap.data() };
    
    // Verificar acesso usando effectiveVisibility pré-computado
    if (entity.effectiveVisibility === 'RESTRICTED') {
      const allowedTypes = entity.effectiveAllowedUserTypes || [];
      if (!allowedTypes.includes(userType)) {
        console.warn(`Acesso negado: ${collectionName}/${entityId} para userType=${userType}`);
        return { entity: null, error: 'ACCESS_DENIED' };
      }
    }
    
    return { entity, error: null };
  } catch (error) {
    console.error(`Erro ao buscar ${collectionName}/${entityId}:`, error);
    return { entity: null, error: error.message };
  }
}

/**
 * Buscar trilha por ID com verificação de acesso
 */
export async function getTrilhaByIdSecure(trilhaId, userType) {
  return getEntityByIdSecure(COLLECTIONS.TRILHAS, trilhaId, userType);
}

/**
 * Buscar curso por ID com verificação de acesso
 */
export async function getCursoByIdSecure(cursoId, userType) {
  return getEntityByIdSecure(COLLECTIONS.CURSOS, cursoId, userType);
}

/**
 * Buscar módulo por ID com verificação de acesso
 */
export async function getModuloByIdSecure(moduloId, userType) {
  return getEntityByIdSecure(COLLECTIONS.MODULOS, moduloId, userType);
}

/**
 * Buscar aula por ID com verificação de acesso
 */
export async function getAulaByIdSecure(aulaId, userType) {
  return getEntityByIdSecure(COLLECTIONS.AULAS, aulaId, userType);
}

/**
 * Calcular e persistir effectiveVisibility para uma entidade
 * Chamado ao criar/atualizar entidades
 * @param {Object} entity - Entidade com visibilityMode e allowedUserTypes
 * @param {Array} ancestry - Array de pais
 * @returns {{ effectiveVisibility: string, effectiveAllowedUserTypes: string[] }}
 */
export function calculateAndPersistVisibility(entity, ancestry = []) {
  return computeEffectiveVisibility(entity, ancestry);
}

/**
 * Atualizar effectiveVisibility em cascata quando pai muda
 * Atualiza todos os filhos que têm visibilityMode = INHERIT
 * @param {string} parentType - 'trilha' | 'curso' | 'modulo'
 * @param {string} parentId - ID do pai
 * @param {Object} newEffectiveVis - { effectiveVisibility, effectiveAllowedUserTypes }
 */
export async function propagateVisibilityChange(parentType, parentId, newEffectiveVis, userId) {
  try {
    const batch = writeBatch(db);
    const safeUserId = userId || 'system';
    
    if (parentType === 'trilha') {
      // Atualizar cursos vinculados que herdam
      const { rels } = await getTrilhaCursosRel(parentId);
      for (const rel of rels) {
        const { entity: curso } = await getCursoById(rel.cursoId);
        if (curso && (!curso.visibilityMode || curso.visibilityMode === 'INHERIT')) {
          batch.update(doc(db, COLLECTIONS.CURSOS, rel.cursoId), {
            ...newEffectiveVis,
            updatedAt: serverTimestamp(),
            updatedBy: safeUserId,
          });
          // Propagar para módulos deste curso
          await propagateVisibilityChange('curso', rel.cursoId, newEffectiveVis, userId);
        }
      }
    } else if (parentType === 'curso') {
      // Atualizar módulos vinculados que herdam
      const { rels } = await getCursoModulosRel(parentId);
      for (const rel of rels) {
        const { entity: modulo } = await getModuloById(rel.moduloId);
        if (modulo && (!modulo.visibilityMode || modulo.visibilityMode === 'INHERIT')) {
          batch.update(doc(db, COLLECTIONS.MODULOS, rel.moduloId), {
            ...newEffectiveVis,
            updatedAt: serverTimestamp(),
            updatedBy: safeUserId,
          });
          // Propagar para aulas deste módulo
          await propagateVisibilityChange('modulo', rel.moduloId, newEffectiveVis, userId);
        }
      }
    } else if (parentType === 'modulo') {
      // Atualizar aulas vinculadas que herdam
      const { rels } = await getModuloAulasRel(parentId);
      for (const rel of rels) {
        const { entity: aula } = await getAulaById(rel.aulaId);
        if (aula && (!aula.visibilityMode || aula.visibilityMode === 'INHERIT')) {
          batch.update(doc(db, COLLECTIONS.AULAS, rel.aulaId), {
            ...newEffectiveVis,
            updatedAt: serverTimestamp(),
            updatedBy: safeUserId,
          });
        }
      }
    }
    
    await batch.commit();
    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao propagar mudança de visibilidade:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// EXPORT DEFAULT
// ============================================

export default {
  // Trilhas
  getTrilhas,
  getTrilhaById,
  addTrilha,
  updateTrilha,
  deleteTrilha,
  getTrilhasPorTipoUsuario,

  // Cursos
  getCursos,
  getCursoById,
  addCurso,
  updateCurso,
  deleteCurso,
  getCursosObrigatorios,
  getCursosOpcionais,

  // Módulos
  getModulosByCurso,
  getModuloById,
  addModulo,
  updateModulo,
  deleteModulo,

  // Aulas
  getAulasByModulo,
  getAulaById,
  addAula,
  updateAula,
  deleteAula,

  // Reordenação
  reorderCursos,
  reorderModulos,
  reorderAulas,

  // Progresso
  getProgressoUsuario,
  getProgressoCurso,
  getProgressoTrilha,
  getEstatisticasUsuario,
  iniciarCurso,
  marcarAulaAssistida,
  concluirModulo,
  concluirCurso,
  concluirTrilha,
  atualizarProgresso,

  // Certificados
  getCertificados,
  emitirCertificado,

  // Categorias
  getCategorias,
  addCategoria,

  // Estatísticas
  calcularPontosTotais,
  getHorasEstudadas,
  getRankingUsuarios,

  // Relatórios
  getRelatorioProgressoPorTipo,

  // Junction Table Trilha ↔ Curso
  getTrilhaCursosRel,
  getCursoTrilhasRel,
  getAllTrilhaCursosRel,
  linkCursoToTrilha,
  unlinkCursoFromTrilha,
  reorderTrilhaCursos,
  syncTrilhaCursos,

  // Visibilidade e Segurança
  getVisibleEntities,
  getVisibleTrilhas,
  getEntityByIdSecure,
  getTrilhaByIdSecure,
  getCursoByIdSecure,
  getModuloByIdSecure,
  getAulaByIdSecure,
  calculateAndPersistVisibility,
  propagateVisibilityChange,

  // Constantes
  TIPOS_USUARIO,
  COLLECTIONS,
};

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
  getDocsFromServer,
  query,
  where,
  orderBy,
  documentId,
  serverTimestamp,
  updateDoc,
  writeBatch,
  increment,
  Timestamp,
  deleteField,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { computeEffectiveVisibility, canUserAccess } from '../pages/educacao/utils/visibilityUtils';

// ============================================================================
// HELPERS: Strip & Normalize
// ============================================================================

function stripPublicationFields(data) {
  if (!data || typeof data !== 'object') return data;
  const { status: _s, statusPublicacao: _sp, publishedAt: _pa, unpublishedAt: _ua, releaseAt: _ra, ...rest } = data;
  return rest;
}

function normalizeEntityStatus(entity) {
  if (!entity) return entity;
  const n = { ...entity };
  if (n.statusPublicacao) {
    // canonical — nothing to do
  } else if (n.status) {
    n.statusPublicacao = String(n.status).toUpperCase() === 'PUBLISHED' ? 'published' : 'draft';
  } else {
    n.statusPublicacao = 'draft';
  }
  if (!n.effectiveVisibility) {
    n.effectiveVisibility = 'PUBLIC';
  }
  return n;
}

async function batchFetchByIds(collectionName, ids) {
  const map = new Map();
  if (!ids?.length) return map;
  const chunks = [];
  for (let i = 0; i < ids.length; i += 30) {
    chunks.push(ids.slice(i, i + 30));
  }
  await Promise.all(chunks.map(async (chunk) => {
    const q = query(collection(db, collectionName), where(documentId(), 'in', chunk));
    // Usar getDocsFromServer para evitar cache stale
    const snap = await getDocsFromServer(q);
    snap.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() }));
  }));
  return map;
}

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
    // Usar getDocsFromServer para evitar cache stale
    const snap = await getDocsFromServer(q);
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
    // Usar getDocsFromServer para evitar cache stale
    const snap = await getDocsFromServer(q);
    const rels = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return { rels, error: null };
  } catch (error) {
    console.error('Erro ao buscar relações módulo-aulas:', error);
    return { rels: [], error: error.message };
  }
}

export async function getAllCursoModulosRel() {
  try {
    // Usar getDocsFromServer para forçar busca do servidor
    const snap = await getDocsFromServer(collection(db, COLLECTIONS.CURSO_MODULOS));
    const rels = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return { rels, error: null };
  } catch (error) {
    console.error('Erro ao buscar todas relações curso-módulos:', error);
    return { rels: [], error: error.message };
  }
}

export async function getAllModuloAulasRel() {
  try {
    // Usar getDocsFromServer para forçar busca do servidor
    const snap = await getDocsFromServer(collection(db, COLLECTIONS.MODULO_AULAS));
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

    // Atomic: junction + denormalize cursoId on module
    const batch = writeBatch(db);
    const junctionRef = doc(collection(db, COLLECTIONS.CURSO_MODULOS));
    batch.set(junctionRef, {
      cursoId, moduloId, ordem: nextOrdem,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(), createdBy: safeUserId,
    });
    batch.update(doc(db, COLLECTIONS.MODULOS, moduloId), {
      cursoId,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    await logOperacao({
      acao: 'create',
      entidade: 'curso_modulo',
      entidadeId: junctionRef.id,
      usuario: safeUserId,
      dados: { cursoId, moduloId, ordem: nextOrdem },
    });

    return { relId: junctionRef.id, error: null };
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

    // Atomic: delete junction + clear cursoId on module
    const batch = writeBatch(db);
    batch.delete(doc(db, COLLECTIONS.CURSO_MODULOS, rel.id));
    batch.update(doc(db, COLLECTIONS.MODULOS, moduloId), {
      cursoId: null,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

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

    // Read parent module's cursoId BEFORE batch (reads can't be in writeBatch)
    const moduloSnap = await getDoc(doc(db, COLLECTIONS.MODULOS, moduloId));
    const parentCursoId = moduloSnap.exists() ? (moduloSnap.data().cursoId || null) : null;

    // Atomic: junction + denormalize moduloId+cursoId on aula
    const batch = writeBatch(db);
    const junctionRef = doc(collection(db, COLLECTIONS.MODULO_AULAS));
    batch.set(junctionRef, {
      moduloId, aulaId, ordem: nextOrdem,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(), createdBy: safeUserId,
    });
    batch.update(doc(db, COLLECTIONS.AULAS, aulaId), {
      moduloId,
      cursoId: parentCursoId,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    await logOperacao({
      acao: 'create',
      entidade: 'modulo_aula',
      entidadeId: junctionRef.id,
      usuario: safeUserId,
      dados: { moduloId, aulaId, ordem: nextOrdem },
    });

    return { relId: junctionRef.id, error: null };
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

    // Atomic: delete junction + clear moduloId/cursoId on aula
    const batch = writeBatch(db);
    batch.delete(doc(db, COLLECTIONS.MODULO_AULAS, rel.id));
    batch.update(doc(db, COLLECTIONS.AULAS, aulaId), {
      moduloId: null,
      cursoId: null,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

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
    // Usar getDocsFromServer para evitar cache stale
    const snap = await getDocsFromServer(q);
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
    // Usar getDocsFromServer para evitar cache stale
    const snap = await getDocsFromServer(q);
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
    // Usar getDocsFromServer para forçar busca do servidor
    const snap = await getDocsFromServer(collection(db, COLLECTIONS.TRILHA_CURSOS));
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
    // Usar getDocsFromServer para evitar cache stale
    const snap = await getDocsFromServer(q);
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
  anestesiologista: { label: 'Anestesiologista', color: '#2563eb' },
  'medico-residente': { label: 'Médico Residente', color: '#8b5cf6' },
  enfermeiro: { label: 'Enfermeiro', color: '#10b981' },
  'tec-enfermagem': { label: 'Téc. Enfermagem', color: '#06b6d4' },
  farmaceutico: { label: 'Farmacêutico', color: '#ec4899' },
  colaborador: { label: 'Colaborador', color: '#6366f1' },
  // Coordenador é função adicional (flag isCoordenador), mas mantemos o label aqui para UI/compatibilidade.
  coordenador: { label: 'Coordenador', color: '#16a085' },
  secretaria: { label: 'Secretária', color: '#f59e0b' },
};

// Normalização para compatibilidade com dados antigos:
// - medico -> anestesiologista
// - tecnico_enfermagem -> tec_enfermagem
// - administrativo -> colaborador
const USER_TYPE_ALIASES = {
  medico: 'anestesiologista',
  residente: 'medico-residente',
  'medico-residente': 'medico-residente',
  tecnico_enfermagem: 'tec-enfermagem',
  'tec_enfermagem': 'tec-enfermagem',
  'tecnico-enfermagem': 'tec-enfermagem',
  administrativo: 'colaborador',
};

function normalizeUserType(userType) {
  const key = String(userType || '').trim().toLowerCase();
  if (!key) return '';
  return USER_TYPE_ALIASES[key] || key;
}

function normalizeUserTypes(list) {
  if (!Array.isArray(list)) return [];
  return Array.from(new Set(list.map(normalizeUserType).filter(Boolean)));
}

// ============================================
// PERMISSÕES DE EDUCAÇÃO
// ============================================

export const EDUCACAO_PERMISSIONS = {
  VIEW: 'educacao_view',
  MANAGE: 'educacao_manage',
  REPORTS: 'educacao_reports',
  PUBLISH: 'educacao_publish',
};

export function hasEducacaoPermission(user, permission) {
  if (!user) return false;
  if (user.isAdmin) return true;
  return !!(user.permissions && user.permissions[permission]);
}

// ============================================
// BADGES (Conquistas do Aluno)
// ============================================

export const BADGE_DEFINITIONS = [
  { id: 'primeiro_curso', label: 'Primeiro Curso', icon: '🎓', description: 'Concluir seu primeiro curso' },
  { id: 'cinco_cursos', label: 'Cinco Cursos', icon: '🏅', description: 'Concluir 5 cursos' },
  { id: 'nota_maxima', label: 'Nota Máxima', icon: '💯', description: 'Obter 100% em um quiz' },
  { id: 'trilha_completa', label: 'Trilha Completa', icon: '🛤️', description: 'Concluir uma trilha inteira' },
  { id: 'streak_7', label: 'Sequência 7 dias', icon: '🔥', description: '7 dias consecutivos estudando' },
  { id: 'madrugador', label: 'Madrugador', icon: '⏰', description: 'Concluir antes do prazo' },
  { id: 'completista', label: 'Completista', icon: '✅', description: 'Concluir todos os cursos obrigatórios' },
];

/**
 * Calcula badges desbloqueados com base no progresso.
 * @param {Array} progressos - Array de progresso do usuário (status, cursoId, notaQuiz, dataConclusao, dataLimite)
 * @param {Array} cursos - Array de cursos (id, obrigatorio)
 * @param {Array} trilhaProgressos - Array de progresso de trilhas (status)
 * @returns {Array} BADGE_DEFINITIONS com campo `unlocked` e `unlockedAt`
 */
export function getUserBadges(progressos = [], cursos = [], trilhaProgressos = []) {
  const concluidos = progressos.filter(p => p.status === 'concluido');

  return BADGE_DEFINITIONS.map(def => {
    let unlocked = false;
    let unlockedAt = null;

    switch (def.id) {
      case 'primeiro_curso':
        if (concluidos.length >= 1) {
          unlocked = true;
          unlockedAt = concluidos[0]?.dataConclusao || null;
        }
        break;

      case 'cinco_cursos':
        if (concluidos.length >= 5) {
          unlocked = true;
          unlockedAt = concluidos[4]?.dataConclusao || null;
        }
        break;

      case 'nota_maxima':
        {
          const perfect = concluidos.find(p => (p.notaQuiz || 0) >= 100);
          if (perfect) {
            unlocked = true;
            unlockedAt = perfect.dataConclusao || null;
          }
        }
        break;

      case 'trilha_completa':
        {
          const trilhaConcluida = (trilhaProgressos || []).find(t => t.status === 'concluido');
          if (trilhaConcluida) {
            unlocked = true;
            unlockedAt = trilhaConcluida.dataConclusao || null;
          }
        }
        break;

      case 'streak_7':
        // Computed externally (requires daily activity data)
        unlocked = false;
        break;

      case 'madrugador':
        {
          const early = concluidos.find(p => {
            if (!p.dataConclusao || !p.dataLimite) return false;
            return new Date(p.dataConclusao) < new Date(p.dataLimite);
          });
          if (early) {
            unlocked = true;
            unlockedAt = early.dataConclusao || null;
          }
        }
        break;

      case 'completista':
        {
          const obrigatorios = (cursos || []).filter(c => c.obrigatorio);
          if (obrigatorios.length > 0) {
            const allDone = obrigatorios.every(c =>
              concluidos.some(p => p.cursoId === c.id)
            );
            unlocked = allDone;
          }
        }
        break;
    }

    return { ...def, unlocked, unlockedAt };
  });
}

// ============================================
// BONUS DE PONTOS
// ============================================

/**
 * Calcula bonus de pontos baseado em nota do quiz e prazo.
 * @param {number} pontosBase - Pontos base do curso
 * @param {number} notaQuiz - Nota do quiz (0-100)
 * @param {Date} [dataConclusao] - Data de conclusão
 * @param {Date} [dataLimite] - Data limite
 * @returns {number} Pontos de bônus
 */
export function calcularBonusPontos(pontosBase, notaQuiz, dataConclusao, dataLimite) {
  if (!pontosBase) return 0;
  let bonusPercent = 0;
  if (notaQuiz > 90) bonusPercent += 20;
  if (dataConclusao && dataLimite && new Date(dataConclusao) < new Date(dataLimite)) {
    bonusPercent += 10;
  }
  return Math.round(pontosBase * bonusPercent / 100);
}

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
    // Usar getDocsFromServer para forçar busca do servidor e evitar cache
    const querySnapshot = await getDocsFromServer(q);
    const trilhas = querySnapshot.docs.map(d => normalizeEntityStatus({ id: d.id, ...d.data() }));
    return { trilhas, error: null };
  } catch (error) {
    console.error('Erro ao buscar trilhas:', error);
    return { trilhas: [], error: error.message };
  }
}

/**
 * Inscrição em tempo real para trilhas ativas (onSnapshot)
 * @param {function} onUpdate - Callback chamado quando trilhas mudam: (trilhas) => void
 * @param {function} [onError] - Callback opcional de erro: (error) => void
 * @returns {function} unsubscribe - Função para cancelar inscrição
 */
export function subscribeTrilhas(onUpdate, onError) {
  // IMPORTANT:
  // Evitar depender de índice composto (ativo + ordem) para garantir sincronização
  // imediata mesmo em projetos/ambientes sem o índice criado.
  // Fazemos listen na collection inteira e filtramos/ordenamos no client.
  const ref = collection(db, COLLECTIONS.TRILHAS);

  return onSnapshot(
    ref,
    (snapshot) => {
      const trilhas = snapshot.docs
        .map(d => normalizeEntityStatus({ id: d.id, ...d.data() }))
        .filter(t => t?.ativo === true)
        .sort((a, b) => (a?.ordem || 0) - (b?.ordem || 0));
      onUpdate(trilhas);
    },
    (error) => {
      console.error('[subscribeTrilhas] Erro:', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Buscar trilha por ID
 */
export async function getTrilhaById(trilhaId) {
  try {
    const docRef = doc(db, COLLECTIONS.TRILHAS, trilhaId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { trilha: normalizeEntityStatus({ id: docSnap.id, ...docSnap.data() }), error: null };
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
      ...stripPublicationFields(data),
      statusPublicacao: data.statusPublicacao || 'published',
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
    const safeUpdates = stripPublicationFields(updates);

    await updateDoc(docRef, {
      ...safeUpdates,
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
    const batch = writeBatch(db);

    // Soft delete na trilha + limpar arrays denormalizados
    const docRef = doc(db, COLLECTIONS.TRILHAS, trilhaId);
    batch.update(docRef, {
      ativo: false,
      publishedCursoIds: [],
      deletedAt: serverTimestamp(),
      deletedBy: userId,
    });

    // Remover relações trilha ↔ cursos da junction table
    const trilhaCursosSnap = await getDocsFromServer(
      query(collection(db, COLLECTIONS.TRILHA_CURSOS), where('trilhaId', '==', trilhaId))
    );
    trilhaCursosSnap.docs.forEach(d => batch.delete(d.ref));

    await batch.commit();

    await logOperacao({
      acao: 'delete',
      entidade: 'trilha',
      entidadeId: trilhaId,
      usuario: userId,
      dados: { softDelete: true, relacoesRemovidas: trilhaCursosSnap.docs.length },
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
    // Usar getDocsFromServer para evitar cache stale
    const querySnapshot = await getDocsFromServer(q);
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
    // Usar getDocsFromServer para forçar busca do servidor e evitar cache
    const querySnapshot = await getDocsFromServer(q);
    const cursos = querySnapshot.docs.map(d => normalizeEntityStatus({ id: d.id, ...d.data() }));
    return { cursos, error: null };
  } catch (error) {
    console.error('Erro ao buscar cursos:', error);
    return { cursos: [], error: error.message };
  }
}

/**
 * Inscrição em tempo real para cursos ativos (onSnapshot)
 * @param {function} onUpdate - Callback chamado quando cursos mudam: (cursos) => void
 * @param {function} [onError] - Callback opcional de erro: (error) => void
 * @returns {function} unsubscribe - Função para cancelar inscrição
 */
export function subscribeCursos(onUpdate, onError) {
  // IMPORTANT:
  // Evitar depender de índice composto (ativo + ordem). Listen em toda a collection
  // e aplicar filtro/ordem no client para garantir sincronização em qualquer ambiente.
  const ref = collection(db, COLLECTIONS.CURSOS);

  return onSnapshot(
    ref,
    (snapshot) => {
      const cursos = snapshot.docs
        .map(d => normalizeEntityStatus({ id: d.id, ...d.data() }))
        .filter(c => c?.ativo === true)
        .sort((a, b) => (a?.ordem || 0) - (b?.ordem || 0));
      onUpdate(cursos);
    },
    (error) => {
      console.error('[subscribeCursos] Erro:', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Buscar um curso específico pelo ID
 */
export async function getCursoById(cursoId) {
  try {
    const docRef = doc(db, COLLECTIONS.CURSOS, cursoId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { curso: normalizeEntityStatus({ id: docSnap.id, ...docSnap.data() }), error: null };
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
      ...stripPublicationFields(data),
      statusPublicacao: data.statusPublicacao || 'published',
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
    const safeUpdates = stripPublicationFields(updates);

    await updateDoc(docRef, {
      ...safeUpdates,
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
  console.log('[service.deleteCurso] Iniciando para cursoId:', cursoId, 'userId:', userId);
  try {
    const batch = writeBatch(db);

    // Soft delete no curso + limpar arrays denormalizados
    const cursoRef = doc(db, COLLECTIONS.CURSOS, cursoId);
    console.log('[service.deleteCurso] Preparando batch.update com ativo:false');
    batch.update(cursoRef, {
      ativo: false,
      publishedModuloIds: [],
      deletedAt: serverTimestamp(),
      deletedBy: userId,
    });

    // Remover relações curso ↔ módulos (não desativar módulos/aulas, pois podem ser reutilizados)
    const relSnap = await getDocsFromServer(
      query(collection(db, COLLECTIONS.CURSO_MODULOS), where('cursoId', '==', cursoId))
    );
    console.log('[service.deleteCurso] Relações curso_modulos a remover:', relSnap.docs.length);
    relSnap.docs.forEach(d => batch.delete(d.ref));

    // Remover relações trilha ↔ curso (junction table N:N)
    const trilhaCursosSnap = await getDocsFromServer(
      query(collection(db, COLLECTIONS.TRILHA_CURSOS), where('cursoId', '==', cursoId))
    );
    console.log('[service.deleteCurso] Relações trilha_cursos a remover:', trilhaCursosSnap.docs.length);
    // Guardar trilhaIds ANTES de deletar para sincronizar depois
    const parentTrilhaIds = trilhaCursosSnap.docs.map(d => d.data().trilhaId).filter(Boolean);
    trilhaCursosSnap.docs.forEach(d => batch.delete(d.ref));

    console.log('[service.deleteCurso] Executando batch.commit...');
    await batch.commit();
    console.log('[service.deleteCurso] batch.commit SUCESSO!');

    // Sincronizar publishedCursoIds nas trilhas pai (após commit para dados consistentes)
    for (const trilhaId of [...new Set(parentTrilhaIds)]) {
      try {
        await syncTrilhaPublishedCursos(trilhaId);
        console.log(`[service.deleteCurso] Sincronizado publishedCursoIds da trilha ${trilhaId}`);
      } catch (syncErr) {
        console.error(`[service.deleteCurso] Erro ao sincronizar trilha ${trilhaId}:`, syncErr);
      }
    }

    await logOperacao({
      acao: 'delete',
      entidade: 'curso',
      entidadeId: cursoId,
      usuario: userId,
      dados: {
        softDelete: true,
        relacoesCursoModulosRemovidas: relSnap.docs.length,
        relacoesTrilhaCursosRemovidas: trilhaCursosSnap.docs.length,
        trilhasSincronizadas: parentTrilhaIds.length,
      },
    });

    return { success: true, error: null };
  } catch (error) {
    console.error('[service.deleteCurso] ERRO:', error);
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
 * Inscrição em tempo real para todos os módulos ativos (onSnapshot)
 * @param {function} onUpdate - Callback chamado quando módulos mudam: (modulos) => void
 * @param {function} [onError] - Callback opcional de erro: (error) => void
 * @returns {function} unsubscribe - Função para cancelar inscrição
 */
export function subscribeModulos(onUpdate, onError) {
  // IMPORTANT:
  // Evitar depender de índice composto (ativo + ordem) para garantir sincronização
  // imediata mesmo em projetos/ambientes sem o índice criado.
  // Fazemos listen na collection inteira e filtramos/ordenamos no client.
  const ref = collection(db, COLLECTIONS.MODULOS);

  return onSnapshot(
    ref,
    (snapshot) => {
      const modulos = snapshot.docs
        .map(d => normalizeEntityStatus({ id: d.id, ...d.data() }))
        .filter(m => m?.ativo === true)
        .sort((a, b) => (a?.ordem || 0) - (b?.ordem || 0));
      onUpdate(modulos);
    },
    (error) => {
      console.error('[subscribeModulos] Erro:', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Buscar módulos de um curso
 */
export async function getModulosByCurso(cursoId) {
  try {
    // Preferir relações (reuso real). Fallback para legado (cursoId em módulo).
    const { rels } = await getCursoModulosRel(cursoId);
    if (rels?.length) {
      const moduloIds = rels.map(r => r.moduloId);
      const modulos = (await getDocsByIdsSafe(COLLECTIONS.MODULOS, moduloIds)).map(normalizeEntityStatus);
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
    // Usar getDocsFromServer para forçar busca do servidor e evitar cache
    const querySnapshot = await getDocsFromServer(q);
    const modulos = querySnapshot.docs.map(d => normalizeEntityStatus({ id: d.id, ...d.data() }));
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
      return { modulo: normalizeEntityStatus({ id: docSnap.id, ...docSnap.data() }), error: null };
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
      ...stripPublicationFields(data),
      statusPublicacao: data.statusPublicacao || 'published',
      cursoId: cursoId,
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
    const safeUpdates = stripPublicationFields(updates);

    await updateDoc(docRef, {
      ...safeUpdates,
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

    // Soft delete no módulo + limpar arrays denormalizados
    batch.update(moduloRef, {
      ativo: false,
      publishedAulaIds: [],
      deletedAt: serverTimestamp(),
      deletedBy: userId,
    });

    // Remover relações curso ↔ módulo (módulo pode estar em múltiplos cursos)
    const cursoRelsSnap = await getDocsFromServer(
      query(collection(db, COLLECTIONS.CURSO_MODULOS), where('moduloId', '==', moduloId))
    );
    // Guardar cursoIds ANTES de deletar para sincronizar depois
    const parentCursoIds = cursoRelsSnap.docs.map(d => d.data().cursoId).filter(Boolean);
    cursoRelsSnap.docs.forEach(d => batch.delete(d.ref));

    // Remover relações módulo ↔ aulas (aulas podem ser reutilizadas)
    const aulaRelsSnap = await getDocsFromServer(
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

    // Sincronizar publishedModuloIds nos cursos pai (após commit para dados consistentes)
    const uniqueCursoIds = [...new Set([...parentCursoIds, ...(moduloData?.cursoId ? [moduloData.cursoId] : [])])];
    for (const cursoId of uniqueCursoIds) {
      try {
        await syncCursoPublishedModulos(cursoId);
        console.log(`[service.deleteModulo] Sincronizado publishedModuloIds do curso ${cursoId}`);
      } catch (syncErr) {
        console.error(`[service.deleteModulo] Erro ao sincronizar curso ${cursoId}:`, syncErr);
      }
    }

    await logOperacao({
      acao: 'delete',
      entidade: 'modulo',
      entidadeId: moduloId,
      usuario: userId,
      dados: {
        softDelete: true,
        relacoesCursoRemovidas: cursoRelsSnap.docs.length,
        relacoesAulaRemovidas: aulaRelsSnap.docs.length,
        cursosSincronizados: uniqueCursoIds.length,
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
 * Inscrição em tempo real para todas as aulas ativas (onSnapshot)
 * @param {function} onUpdate - Callback chamado quando aulas mudam: (aulas) => void
 * @param {function} [onError] - Callback opcional de erro: (error) => void
 * @returns {function} unsubscribe - Função para cancelar inscrição
 */
export function subscribeAulas(onUpdate, onError) {
  // IMPORTANT:
  // Evitar depender de índice composto (ativo + ordem) para garantir sincronização
  // imediata mesmo em projetos/ambientes sem o índice criado.
  // Fazemos listen na collection inteira e filtramos/ordenamos no client.
  const ref = collection(db, COLLECTIONS.AULAS);

  return onSnapshot(
    ref,
    (snapshot) => {
      const aulas = snapshot.docs
        .map(d => normalizeEntityStatus({ id: d.id, ...d.data() }))
        .filter(a => a?.ativo === true)
        .sort((a, b) => (a?.ordem || 0) - (b?.ordem || 0));
      onUpdate(aulas);
    },
    (error) => {
      console.error('[subscribeAulas] Erro:', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Buscar aulas de um módulo
 */
export async function getAulasByModulo(moduloId) {
  try {
    // Preferir relações (reuso real). Fallback para legado (moduloId em aula).
    const { rels } = await getModuloAulasRel(moduloId);
    if (rels?.length) {
      const aulaIds = rels.map(r => r.aulaId);
      const aulas = (await getDocsByIdsSafe(COLLECTIONS.AULAS, aulaIds)).map(normalizeEntityStatus);
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
    // Usar getDocsFromServer para forçar busca do servidor e evitar cache
    const querySnapshot = await getDocsFromServer(q);
    const aulas = querySnapshot.docs.map(d => normalizeEntityStatus({ id: d.id, ...d.data() }));
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
      return { aula: normalizeEntityStatus({ id: docSnap.id, ...docSnap.data() }), error: null };
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
      ...stripPublicationFields(data),
      statusPublicacao: data.statusPublicacao || 'published',
      moduloId: moduloId,
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
    const safeUpdates = stripPublicationFields(updates);

    await updateDoc(docRef, {
      ...safeUpdates,
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
    const relSnap = await getDocsFromServer(
      query(collection(db, COLLECTIONS.MODULO_AULAS), where('aulaId', '==', aulaId))
    );
    // Guardar moduloIds ANTES de deletar para sincronizar depois
    const parentModuloIds = relSnap.docs.map(d => d.data().moduloId).filter(Boolean);
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

    // Sincronizar publishedAulaIds nos módulos pai (após commit para dados consistentes)
    const uniqueModuloIds = [...new Set([...parentModuloIds, ...(aulaData?.moduloId ? [aulaData.moduloId] : [])])];
    for (const moduloId of uniqueModuloIds) {
      try {
        await syncModuloPublishedAulas(moduloId);
        console.log(`[service.deleteAula] Sincronizado publishedAulaIds do módulo ${moduloId}`);
      } catch (syncErr) {
        console.error(`[service.deleteAula] Erro ao sincronizar módulo ${moduloId}:`, syncErr);
      }
    }

    await logOperacao({
      acao: 'delete',
      entidade: 'aula',
      entidadeId: aulaId,
      usuario: userId,
      dados: {
        softDelete: true,
        relacoesRemovidas: relSnap.docs.length,
        modulosSincronizados: uniqueModuloIds.length,
      },
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
    // Usar getDocsFromServer para evitar cache stale
    const querySnapshot = await getDocsFromServer(progressoRef);
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
// PROGRESSO DE AULAS (granular)
// ============================================

/**
 * Salvar progresso de reprodução de uma aula (posição e percentual)
 */
export async function salvarProgressoAula(userId, cursoId, aulaId, currentTime, percentual) {
  try {
    const docRef = doc(db, COLLECTIONS.PROGRESSO, userId, 'cursos', cursoId);
    const field = `progressoAulas.${aulaId}`;
    try {
      await updateDoc(docRef, {
        [field]: { currentTime, percentual },
        ultimoAcesso: serverTimestamp(),
      });
    } catch (e) {
      if (e.code === 'not-found') {
        await setDoc(docRef, {
          userId,
          cursoId,
          status: 'em_andamento',
          progressoAulas: { [aulaId]: { currentTime, percentual } },
          ultimoAcesso: serverTimestamp(),
        });
      } else {
        throw e;
      }
    }
    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao salvar progresso da aula:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// QUIZ
// ============================================

/**
 * Buscar perguntas do quiz de um curso
 */
export async function getQuiz(cursoId) {
  try {
    const docRef = doc(db, COLLECTIONS.CURSOS, cursoId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      return { perguntas: [], error: null };
    }
    const data = docSnap.data();
    return { perguntas: data.perguntas || [], error: null };
  } catch (error) {
    console.error('Erro ao buscar quiz:', error);
    return { perguntas: [], error: error.message };
  }
}

/**
 * Buscar configuração do quiz de um curso
 */
export async function getQuizConfig(cursoId) {
  try {
    const docRef = doc(db, COLLECTIONS.CURSOS, cursoId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      return { config: {}, error: null };
    }
    const data = docSnap.data();
    return {
      config: {
        maxTentativas: data.maxTentativas,
        tempoLimiteMinutos: data.tempoLimiteMinutos,
        notaMinima: data.notaMinima,
      },
      error: null,
    };
  } catch (error) {
    console.error('Erro ao buscar config do quiz:', error);
    return { config: {}, error: error.message };
  }
}

/**
 * Buscar tentativas de quiz de um usuario em um curso
 */
export async function getQuizTentativas(cursoId, userId) {
  try {
    const q = query(
      collection(db, COLLECTIONS.CURSOS, cursoId, 'tentativas'),
      where('userId', '==', userId),
      orderBy('data', 'desc')
    );
    const snap = await getDocs(q);
    const tentativas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return { tentativas, error: null };
  } catch (error) {
    console.error('Erro ao buscar tentativas do quiz:', error);
    return { tentativas: [], error: error.message };
  }
}

/**
 * Salvar perguntas de quiz (admin)
 */
export async function salvarQuiz(cursoId, perguntas, userId) {
  try {
    const docRef = doc(db, COLLECTIONS.CURSOS, cursoId);
    await updateDoc(docRef, {
      perguntas,
      quizUpdatedAt: serverTimestamp(),
      quizUpdatedBy: userId || 'system',
    });
    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao salvar quiz:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Salvar resultado geral do quiz no progresso do usuario
 */
export async function salvarResultadoQuiz(userId, cursoId, resultado) {
  try {
    const docRef = doc(db, COLLECTIONS.PROGRESSO, userId, 'cursos', cursoId);
    const updateData = {
      quizResult: {
        ...resultado,
        dataRealizacao: serverTimestamp(),
      },
      ultimoAcesso: serverTimestamp(),
    };
    if (!resultado.aprovado) {
      updateData.quizResult.bloqueadoAte = Timestamp.fromDate(
        new Date(Date.now() + 24 * 60 * 60 * 1000)
      );
    }
    await setDoc(docRef, updateData, { merge: true });
    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao salvar resultado do quiz:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Salvar tentativa individual de quiz
 */
export async function salvarQuizTentativa(cursoId, userId, tentativa) {
  try {
    await addDoc(collection(db, COLLECTIONS.CURSOS, cursoId, 'tentativas'), {
      ...tentativa,
      userId,
      data: serverTimestamp(),
    });
    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao salvar tentativa do quiz:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// ATIVIDADE DIARIA E REPAROS
// ============================================

/**
 * Registrar atividade diaria do usuario (streak)
 */
export async function registrarAtividadeDiaria(userId) {
  try {
    const statsRef = doc(db, COLLECTIONS.PROGRESSO, userId, 'estatisticas', 'geral');
    const statsSnap = await getDoc(statsRef);
    const stats = statsSnap.exists() ? statsSnap.data() : {};

    const hoje = new Date().toISOString().slice(0, 10);
    if (stats.ultimaAtividadeDia === hoje) {
      return { streak: stats.streak || 1, error: null };
    }

    const ontem = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const novoStreak = stats.ultimaAtividadeDia === ontem ? (stats.streak || 0) + 1 : 1;
    const melhorStreak = Math.max(novoStreak, stats.melhorStreak || 0);

    await setDoc(statsRef, {
      streak: novoStreak,
      melhorStreak,
      ultimaAtividadeDia: hoje,
      ultimaAtividade: serverTimestamp(),
    }, { merge: true });

    return { streak: novoStreak, error: null };
  } catch (error) {
    console.error('Erro ao registrar atividade diaria:', error);
    return { streak: 0, error: error.message };
  }
}

/**
 * Reparar estatisticas do usuario retroativamente
 */
export async function repararEstatisticasUsuario(userId, progressos, cursos) {
  try {
    const concluidos = (progressos || []).filter(p => p.status === 'concluido');
    let totalPontos = 0;
    concluidos.forEach(p => {
      totalPontos += p.pontos || 0;
    });

    const statsRef = doc(db, COLLECTIONS.PROGRESSO, userId, 'estatisticas', 'geral');
    await setDoc(statsRef, {
      totalPontos,
      totalCursosCompletos: concluidos.length,
      ultimaAtividade: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.error('Erro ao reparar estatisticas:', error);
  }
}

// ============================================
// CERTIFICADOS
// ============================================

/**
 * Buscar certificado por ID (para verificacao publica)
 */
export async function getCertificadoById(certificadoId) {
  try {
    const docRef = doc(db, COLLECTIONS.CERTIFICADOS, certificadoId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      return { certificado: null, error: 'Certificado nao encontrado' };
    }
    return { certificado: { id: docSnap.id, ...docSnap.data() }, error: null };
  } catch (error) {
    console.error('Erro ao buscar certificado:', error);
    return { certificado: null, error: error.message };
  }
}

/**
 * Verificar assinatura HMAC de um certificado
 * Retorna true se valido, false caso contrario
 */
export async function verificarAssinatura(certificado) {
  try {
    if (!certificado?.assinaturaHMAC) return false;
    // Reconstruir payload assinado
    const payload = `${certificado.userId}|${certificado.cursoId}|${certificado.dataEmissaoISO || ''}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode('anest-cert-secret-2024'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
    return hex === certificado.assinaturaHMAC;
  } catch (error) {
    console.error('Erro ao verificar assinatura:', error);
    return false;
  }
}

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
    // Usar getDocsFromServer para evitar cache stale
    const querySnapshot = await getDocsFromServer(q);
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
    // Usar getDocsFromServer para evitar cache stale
    const querySnapshot = await getDocsFromServer(collection(db, COLLECTIONS.CATEGORIAS));
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
    const normalizedUserType = normalizeUserType(userType);

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
      where('effectiveAllowedUserTypes', 'array-contains', normalizedUserType),
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
    
    // Executar queries em paralelo - usar getDocsFromServer para evitar cache stale
    const [publicSnap, restrictedSnap] = await Promise.all([
      getDocsFromServer(publicQ),
      getDocsFromServer(restrictedQ),
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

  // Progresso de Aulas
  salvarProgressoAula,

  // Quiz
  getQuiz,
  getQuizConfig,
  getQuizTentativas,
  salvarQuiz,
  salvarResultadoQuiz,
  salvarQuizTentativa,

  // Atividade Diaria
  registrarAtividadeDiaria,
  repararEstatisticasUsuario,

  // Certificados
  getCertificados,
  getCertificadoById,
  verificarAssinatura,
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

  // Publish/Unpublish
  publishEntity,
  unpublishEntity,
  backfillDenormalizedParents,

  // STUDENT-SAFE QUERIES (SEM JUNCTION TABLES)
  getTrilhasForStudent,
  getCursosForStudent,
  getModulosForStudent,
  getAulasForStudent,
  getConteudoCompletoForStudent,
  getTrilhaCompletoForStudent,

  // Constantes
  TIPOS_USUARIO,
  COLLECTIONS,
  BADGE_DEFINITIONS,
  EDUCACAO_PERMISSIONS,

  // Badges & Pontos
  getUserBadges,
  calcularBonusPontos,
  hasEducacaoPermission,
};

// ============================================================================
// PUBLISH / UNPUBLISH (SINGLE SOURCE OF TRUTH FOR STATUS WRITES)
// ============================================================================

function getCollectionForType(entityType) {
  const map = {
    trilha: COLLECTIONS.TRILHAS,
    curso: COLLECTIONS.CURSOS,
    modulo: COLLECTIONS.MODULOS,
    aula: COLLECTIONS.AULAS,
  };
  if (!map[entityType]) throw new Error(`Unknown entity type: ${entityType}`);
  return map[entityType];
}

async function getChildIdsFromJunction(entityType, entityId) {
  switch (entityType) {
    case 'trilha': {
      const { rels } = await getTrilhaCursosRel(entityId);
      return (rels || []).map(r => r.cursoId);
    }
    case 'curso': {
      const { rels } = await getCursoModulosRel(entityId);
      return (rels || []).map(r => r.moduloId);
    }
    case 'modulo': {
      const { rels } = await getModuloAulasRel(entityId);
      return (rels || []).map(r => r.aulaId);
    }
    default:
      return [];
  }
}

const CHILD_TYPE_MAP = { trilha: 'curso', curso: 'modulo', modulo: 'aula' };

async function ensureDenormalizedParentsForChildren(parentType, parentId) {
  const childIds = await getChildIdsFromJunction(parentType, parentId);
  if (!childIds.length) return;

  const childType = CHILD_TYPE_MAP[parentType];
  const childCollName = getCollectionForType(childType);
  const childrenMap = await batchFetchByIds(childCollName, childIds);
  const MAX_BATCH = 400;

  if (parentType === 'trilha') {
    for (const [cursoId] of childrenMap) {
      await ensureDenormalizedParentsForChildren('curso', cursoId);
    }
  } else if (parentType === 'curso') {
    const needsUpdate = [];
    for (const [id, data] of childrenMap) {
      if (data.cursoId !== parentId) needsUpdate.push(id);
    }
    for (let i = 0; i < needsUpdate.length; i += MAX_BATCH) {
      const chunk = needsUpdate.slice(i, i + MAX_BATCH);
      const batch = writeBatch(db);
      for (const id of chunk) {
        batch.update(doc(db, childCollName, id), { cursoId: parentId, updatedAt: serverTimestamp() });
      }
      await batch.commit();
    }
    for (const [moduloId] of childrenMap) {
      await ensureDenormalizedParentsForChildren('modulo', moduloId);
    }
  } else if (parentType === 'modulo') {
    const moduloData = childrenMap.size > 0 ? (await getDoc(doc(db, COLLECTIONS.MODULOS, parentId))).data() : null;
    const parentCursoId = moduloData?.cursoId || null;
    const needsUpdate = [];
    for (const [id, data] of childrenMap) {
      if (data.moduloId !== parentId || data.cursoId !== parentCursoId) needsUpdate.push(id);
    }
    for (let i = 0; i < needsUpdate.length; i += MAX_BATCH) {
      const chunk = needsUpdate.slice(i, i + MAX_BATCH);
      const batch = writeBatch(db);
      for (const id of chunk) {
        batch.update(doc(db, childCollName, id), { moduloId: parentId, cursoId: parentCursoId, updatedAt: serverTimestamp() });
      }
      await batch.commit();
    }
  }
}

async function publishChildrenCascade(parentType, parentId, userId) {
  let published = 0;
  const errors = [];
  const MAX_BATCH = 400;

  try {
    const childType = CHILD_TYPE_MAP[parentType];
    if (!childType) return { published, errors };

    const childIds = await getChildIdsFromJunction(parentType, parentId);
    if (childIds.length === 0) return { published, errors };

    const childCollName = getCollectionForType(childType);
    const childrenMap = await batchFetchByIds(childCollName, childIds);
    const activeChildIds = [];
    for (const [id, data] of childrenMap) {
      if (data.ativo !== false) activeChildIds.push(id);
    }

    for (let i = 0; i < activeChildIds.length; i += MAX_BATCH) {
      const chunk = activeChildIds.slice(i, i + MAX_BATCH);
      const batch = writeBatch(db);
      for (const childId of chunk) {
        const childData = childrenMap.get(childId);
        const fields = {
          statusPublicacao: 'published',
          status: 'PUBLISHED',
          publishedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          updatedBy: userId,
        };
        if (!childData?.effectiveVisibility) {
          fields.effectiveVisibility = 'PUBLIC';
        }
        batch.update(doc(db, childCollName, childId), fields);
      }
      await batch.commit();
      published += chunk.length;
    }

    if (parentType === 'trilha') await syncTrilhaPublishedCursos(parentId);
    if (parentType === 'curso') await syncCursoPublishedModulos(parentId);
    if (parentType === 'modulo') await syncModuloPublishedAulas(parentId);

    for (const childId of activeChildIds) {
      const sub = await publishChildrenCascade(childType, childId, userId);
      published += sub.published;
      errors.push(...sub.errors);
    }
  } catch (error) {
    errors.push(`cascade-publish ${parentType}:${parentId}: ${error.message}`);
  }
  return { published, errors };
}

async function syncPublishedArraysUp(entityType, entityId) {
  const errors = [];
  try {
    switch (entityType) {
      case 'aula': {
        const aulaSnap = await getDoc(doc(db, COLLECTIONS.AULAS, entityId));
        let moduloId = aulaSnap.exists() ? aulaSnap.data().moduloId : null;
        if (!moduloId) {
          const q = query(collection(db, COLLECTIONS.MODULO_AULAS), where('aulaId', '==', entityId));
          // Usar getDocsFromServer para evitar cache stale
          const snap = await getDocsFromServer(q);
          moduloId = snap.docs[0]?.data()?.moduloId || null;
        }
        if (moduloId) {
          const r = await syncModuloPublishedAulas(moduloId);
          if (!r.success) errors.push(r.error);
          errors.push(...await syncPublishedArraysUp('modulo', moduloId));
        }
        break;
      }
      case 'modulo': {
        const moduloSnap = await getDoc(doc(db, COLLECTIONS.MODULOS, entityId));
        let cursoId = moduloSnap.exists() ? moduloSnap.data().cursoId : null;
        if (!cursoId) {
          const q = query(collection(db, COLLECTIONS.CURSO_MODULOS), where('moduloId', '==', entityId));
          // Usar getDocsFromServer para evitar cache stale
          const snap = await getDocsFromServer(q);
          cursoId = snap.docs[0]?.data()?.cursoId || null;
        }
        if (cursoId) {
          const r = await syncCursoPublishedModulos(cursoId);
          if (!r.success) errors.push(r.error);
          errors.push(...await syncPublishedArraysUp('curso', cursoId));
        }
        break;
      }
      case 'curso': {
        const q = query(collection(db, COLLECTIONS.TRILHA_CURSOS), where('cursoId', '==', entityId));
        // Usar getDocsFromServer para evitar cache stale
        const snap = await getDocsFromServer(q);
        for (const d of snap.docs) {
          const trilhaId = d.data().trilhaId;
          const r = await syncTrilhaPublishedCursos(trilhaId);
          if (!r.success) errors.push(r.error);
        }
        break;
      }
    }
  } catch (error) {
    errors.push(`syncUp ${entityType}:${entityId}: ${error.message}`);
  }
  return errors;
}

export async function publishEntity(entityType, entityId, { cascade = true, userId = 'system' } = {}) {
  const errors = [];
  let publishedCount = 0;

  try {
    const collName = getCollectionForType(entityType);
    const entityRef = doc(db, collName, entityId);
    const entitySnap = await getDoc(entityRef);
    if (!entitySnap.exists()) {
      return { success: false, published: 0, errors: [`${entityType} ${entityId} not found`] };
    }

    const entityData = entitySnap.data();
    const publishFields = {
      statusPublicacao: 'published',
      status: 'PUBLISHED',
      publishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    };
    if (!entityData.effectiveVisibility) {
      publishFields.effectiveVisibility = 'PUBLIC';
    }
    await updateDoc(entityRef, publishFields);
    publishedCount++;

    await logOperacao({
      acao: 'publish', entidade: entityType, entidadeId: entityId,
      usuario: userId, dados: { cascade },
    });

    if (cascade && entityType !== 'aula') {
      await ensureDenormalizedParentsForChildren(entityType, entityId);
    }

    if (cascade && entityType !== 'aula') {
      const cascadeResult = await publishChildrenCascade(entityType, entityId, userId);
      publishedCount += cascadeResult.published;
      errors.push(...cascadeResult.errors);
    }

    const syncErrors = await syncPublishedArraysUp(entityType, entityId);
    errors.push(...syncErrors);

    return { success: errors.length === 0, published: publishedCount, errors };
  } catch (error) {
    console.error(`[publishEntity] Error:`, error);
    return { success: false, published: publishedCount, errors: [...errors, error.message] };
  }
}

export async function unpublishEntity(entityType, entityId, { userId = 'system' } = {}) {
  const errors = [];

  try {
    const collName = getCollectionForType(entityType);
    const entityRef = doc(db, collName, entityId);
    const entitySnap = await getDoc(entityRef);
    if (!entitySnap.exists()) {
      return { success: false, unpublished: 0, errors: [`${entityType} ${entityId} not found`] };
    }

    const unpublishFields = {
      statusPublicacao: 'draft',
      status: 'DRAFT',
      publishedAt: deleteField(),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    };
    if (entityType === 'trilha') unpublishFields.publishedCursoIds = [];
    if (entityType === 'curso') unpublishFields.publishedModuloIds = [];
    if (entityType === 'modulo') unpublishFields.publishedAulaIds = [];

    await updateDoc(entityRef, unpublishFields);

    await logOperacao({
      acao: 'unpublish', entidade: entityType, entidadeId: entityId,
      usuario: userId, dados: {},
    });

    const syncErrors = await syncPublishedArraysUp(entityType, entityId);
    errors.push(...syncErrors);

    return { success: errors.length === 0, unpublished: 1, errors };
  } catch (error) {
    console.error(`[unpublishEntity] Error:`, error);
    return { success: false, unpublished: 0, errors: [...errors, error.message] };
  }
}

export async function backfillDenormalizedParents({ dryRun = true, limit = 1000 } = {}) {
  const errors = [];
  let modulesFixed = 0, aulasFixed = 0;
  const MAX_BATCH = 400;

  try {
    // Usar getDocsFromServer para evitar cache stale
    const cmSnap = await getDocsFromServer(query(collection(db, COLLECTIONS.CURSO_MODULOS)));
    const moduloUpdates = new Map();
    for (const d of cmSnap.docs) {
      const { cursoId, moduloId } = d.data();
      if (cursoId && moduloId) moduloUpdates.set(moduloId, cursoId);
    }

    const moduloIds = Array.from(moduloUpdates.keys()).slice(0, limit);
    const modulosMap = await batchFetchByIds(COLLECTIONS.MODULOS, moduloIds);
    const moduloFixes = [];
    for (const [id, data] of modulosMap) {
      const expectedCursoId = moduloUpdates.get(id);
      if (data.cursoId !== expectedCursoId) {
        moduloFixes.push({ id, cursoId: expectedCursoId });
      }
    }

    if (!dryRun) {
      for (let i = 0; i < moduloFixes.length; i += MAX_BATCH) {
        const chunk = moduloFixes.slice(i, i + MAX_BATCH);
        const batch = writeBatch(db);
        for (const { id, cursoId } of chunk) {
          batch.update(doc(db, COLLECTIONS.MODULOS, id), { cursoId, updatedAt: serverTimestamp() });
        }
        await batch.commit();
        modulesFixed += chunk.length;
      }
    } else {
      modulesFixed = moduloFixes.length;
    }

    // Usar getDocsFromServer para evitar cache stale
    const maSnap = await getDocsFromServer(query(collection(db, COLLECTIONS.MODULO_AULAS)));
    const aulaUpdates = new Map();
    for (const d of maSnap.docs) {
      const { moduloId, aulaId } = d.data();
      if (moduloId && aulaId) {
        const parentCursoId = moduloUpdates.get(moduloId) || null;
        aulaUpdates.set(aulaId, { moduloId, cursoId: parentCursoId });
      }
    }

    const aulaIds = Array.from(aulaUpdates.keys()).slice(0, limit);
    const aulasMap = await batchFetchByIds(COLLECTIONS.AULAS, aulaIds);
    const aulaFixes = [];
    for (const [id, data] of aulasMap) {
      const expected = aulaUpdates.get(id);
      if (data.moduloId !== expected.moduloId || data.cursoId !== expected.cursoId) {
        aulaFixes.push({ id, ...expected });
      }
    }

    if (!dryRun) {
      for (let i = 0; i < aulaFixes.length; i += MAX_BATCH) {
        const chunk = aulaFixes.slice(i, i + MAX_BATCH);
        const batch = writeBatch(db);
        for (const { id, moduloId, cursoId } of chunk) {
          batch.update(doc(db, COLLECTIONS.AULAS, id), { moduloId, cursoId, updatedAt: serverTimestamp() });
        }
        await batch.commit();
        aulasFixed += chunk.length;
      }
    } else {
      aulasFixed = aulaFixes.length;
    }
  } catch (error) {
    errors.push(error.message);
  }

  console.log(`[backfill] dryRun=${dryRun} modules=${modulesFixed} aulas=${aulasFixed} errors=${errors.length}`);
  return { modulesFixed, aulasFixed, errors, dryRun };
}

// ============================================================================
// STUDENT-SAFE QUERIES (SEM JUNCTION TABLES)
// ============================================================================

/**
 * Buscar trilhas para o aluno
 * Somente PUBLISHED + ativo + visibilidade permitida
 * SEM junction tables
 */
export async function getTrilhasForStudent(userType) {
  try {
    const qPublic = query(
      collection(db, COLLECTIONS.TRILHAS),
      where('statusPublicacao', '==', 'published'),
      where('ativo', '==', true),
      where('effectiveVisibility', '==', 'PUBLIC'),
      orderBy('ordem', 'asc')
    );

    const normalizedType = normalizeUserType(userType);
    const qRestricted = normalizedType ? query(
      collection(db, COLLECTIONS.TRILHAS),
      where('statusPublicacao', '==', 'published'),
      where('ativo', '==', true),
      where('effectiveVisibility', '==', 'RESTRICTED'),
      where('effectiveAllowedUserTypes', 'array-contains', normalizedType),
      orderBy('ordem', 'asc')
    ) : null;

    // Usar getDocsFromServer para evitar cache stale
    const [publicSnap, restrictedSnap] = await Promise.all([
      getDocsFromServer(qPublic),
      qRestricted ? getDocsFromServer(qRestricted) : { docs: [] },
    ]);

    const seen = new Set();
    const trilhas = [];
    for (const snap of [publicSnap, restrictedSnap]) {
      for (const d of snap.docs) {
        if (!seen.has(d.id)) {
          seen.add(d.id);
          trilhas.push(normalizeEntityStatus({ id: d.id, ...d.data() }));
        }
      }
    }
    trilhas.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    return trilhas;
  } catch (error) {
    console.error('getTrilhasForStudent error:', error);
    return [];
  }
}

/**
 * Buscar cursos de uma trilha para o aluno
 * USA publishedCursoIds (array denormalizado, NÃO junction table)
 */
export async function getCursosForStudent(trilhaId) {
  try {
    // 1. Buscar trilha (contém publishedCursoIds)
    const trilhaDoc = await getDoc(doc(db, COLLECTIONS.TRILHAS, trilhaId));
    if (!trilhaDoc.exists()) return [];
    
    const trilha = trilhaDoc.data();
    const cursoIds = trilha.publishedCursoIds || [];
    
    if (cursoIds.length === 0) return [];
    
    // 2. Buscar cursos por IDs (com chunking)
    return await fetchByIdsInOrder(COLLECTIONS.CURSOS, cursoIds);
  } catch (error) {
    console.error('getCursosForStudent error:', error);
    return [];
  }
}

/**
 * Buscar módulos de um curso para o aluno
 * USA publishedModuloIds (array denormalizado)
 */
export async function getModulosForStudent(cursoId) {
  try {
    const cursoDoc = await getDoc(doc(db, COLLECTIONS.CURSOS, cursoId));
    if (!cursoDoc.exists()) return [];
    
    const curso = cursoDoc.data();
    const moduloIds = curso.publishedModuloIds || [];
    
    if (moduloIds.length === 0) return [];
    
    return await fetchByIdsInOrder(COLLECTIONS.MODULOS, moduloIds);
  } catch (error) {
    console.error('getModulosForStudent error:', error);
    return [];
  }
}

/**
 * Buscar aulas de um módulo para o aluno
 * USA publishedAulaIds (array denormalizado)
 */
export async function getAulasForStudent(moduloId) {
  try {
    const moduloDoc = await getDoc(doc(db, COLLECTIONS.MODULOS, moduloId));
    if (!moduloDoc.exists()) return [];
    
    const modulo = moduloDoc.data();
    const aulaIds = modulo.publishedAulaIds || [];
    
    if (aulaIds.length === 0) return [];
    
    return await fetchByIdsInOrder(COLLECTIONS.AULAS, aulaIds);
  } catch (error) {
    console.error('getAulasForStudent error:', error);
    return [];
  }
}

/**
 * Helper: buscar docs por IDs com chunking (max 30 por query Firestore)
 * Filtra ativo + statusPublicacao, com fallback individual em caso de PERMISSION_DENIED
 */
async function fetchByIdsInOrder(collectionName, ids) {
  if (!ids?.length) return [];

  const chunks = [];
  for (let i = 0; i < ids.length; i += 30) {
    chunks.push(ids.slice(i, i + 30));
  }

  const allDocs = [];

  for (const chunk of chunks) {
    try {
      const q = query(
        collection(db, collectionName),
        where(documentId(), 'in', chunk),
        where('ativo', '==', true),
        where('statusPublicacao', '==', 'published')
      );
      // Usar getDocsFromServer para evitar cache stale
      const snap = await getDocsFromServer(q);
      allDocs.push(...snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.warn(`[fetchByIdsInOrder] Chunk failed (${collectionName}):`, err.code || err.message);
      for (const id of chunk) {
        try {
          const snap = await getDoc(doc(db, collectionName, id));
          if (snap.exists()) {
            const data = snap.data();
            if (data.ativo !== false && (data.statusPublicacao === 'published' || data.status === 'PUBLISHED')) {
              allDocs.push({ id: snap.id, ...data });
            }
          }
        } catch {
          // Individual doc also denied — skip silently
        }
      }
    }
  }

  const docMap = new Map(allDocs.map(d => [d.id, d]));
  return ids.map(id => docMap.get(id)).filter(Boolean);
}

/**
 * Verificar se usuário pode acessar entidade por visibilidade
 */
function canAccessByVisibility(entity, userType) {
  if (!entity) return false;

  const normalizedUserType = normalizeUserType(userType);
  
  // PUBLIC: todos acessam
  if (entity.effectiveVisibility === 'PUBLIC') return true;
  
  // RESTRICTED: verificar allowedUserTypes
  if (entity.effectiveVisibility === 'RESTRICTED') {
    const allowed = normalizeUserTypes(entity.effectiveAllowedUserTypes || []);
    return allowed.includes(normalizedUserType);
  }
  
  // Fallback: negar acesso
  return false;
}

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
        const cursos = await getCursosForStudent(trilha.id);

        // 3. Para cada curso, buscar módulos
        const cursosComModulos = await Promise.all(
          cursos.map(async (curso) => {
            const modulos = await getModulosForStudent(curso.id);

            // 4. Para cada módulo, buscar aulas
            const modulosComAulas = await Promise.all(
              modulos.map(async (modulo) => {
                const aulas = await getAulasForStudent(modulo.id);
                return { ...modulo, aulas };
              })
            );
            
            return { ...curso, modulos: modulosComAulas };
          })
        );
        
        return { ...trilha, cursos: cursosComModulos };
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
    const sp = (trilha.statusPublicacao || '').toLowerCase();
    const sl = (trilha.status || '').toUpperCase();
    if (sp !== 'published' && sl !== 'PUBLISHED') return null;
    if (!trilha.ativo) return null;
    if (!canAccessByVisibility(trilha, userType)) return null;
    
    // 2. Buscar cursos
    const cursos = await getCursosForStudent(trilhaId);

    // 3. Para cada curso, buscar módulos e aulas
    const cursosCompletos = await Promise.all(
      cursos.map(async (curso) => {
        const modulos = await getModulosForStudent(curso.id);

        const modulosCompletos = await Promise.all(
          modulos.map(async (modulo) => {
            const aulas = await getAulasForStudent(modulo.id);
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
// CLIENT-SIDE SYNC FALLBACK
// Popula published*Ids manualmente caso Cloud Functions não estejam rodando
// ============================================================================

/**
 * Verifica se entidade é acessível por alunos
 * (lógica equivalente à Cloud Function)
 */
export function isEntityAccessible(entity) {
  if (!entity) return false;
  if (entity.ativo === false) return false;
  
  // Verificar status (suporta ambos formatos)
  const statusPub = entity.statusPublicacao?.toLowerCase();
  const statusLegacy = entity.status?.toUpperCase();
  
  if (statusPub) {
    if (statusPub === 'draft') return false;
    if (statusPub === 'scheduled' && entity.releaseAt) {
      const releaseDate = entity.releaseAt?.toDate?.() || new Date(entity.releaseAt);
      if (Date.now() < releaseDate.getTime()) return false;
    }
  } else if (statusLegacy && statusLegacy !== 'PUBLISHED') {
    return false;
  }
  
  return true;
}

/**
 * Sincroniza publishedCursoIds de uma trilha
 * @param {string} trilhaId - ID da trilha
 * @returns {Promise<{ success: boolean, count: number, error?: string }>}
 */
export async function syncTrilhaPublishedCursos(trilhaId) {
  try {
    // 1. Buscar relações ordenadas da junction table
    const relsResult = await getTrilhaCursosRel(trilhaId);
    if (relsResult.error) throw new Error(relsResult.error);
    
    const relations = relsResult.rels || [];
    
    if (relations.length === 0) {
      // Sem cursos, limpar array
      await updateDoc(doc(db, COLLECTIONS.TRILHAS, trilhaId), {
        publishedCursoIds: [],
        updatedAt: serverTimestamp(),
      });
      return { success: true, count: 0 };
    }
    
    // 2. Buscar cursos (batch)
    const cursoIds = relations.map(r => r.cursoId);
    const cursosMap = await batchFetchByIds(COLLECTIONS.CURSOS, cursoIds);
    const cursos = Array.from(cursosMap.values());

    // 3. Filtrar acessíveis
    const cursosElegiveis = cursos.filter(isEntityAccessible);
    
    // 4. Ordenar conforme junction table
    const cursosOrderMap = new Map(cursosElegiveis.map(c => [c.id, c]));
    const ordenados = relations
      .map(r => cursosOrderMap.get(r.cursoId))
      .filter(Boolean);
    
    // 5. Atualizar trilha
    const publishedCursoIds = ordenados.map(c => c.id);
    await updateDoc(doc(db, COLLECTIONS.TRILHAS, trilhaId), {
      publishedCursoIds,
      updatedAt: serverTimestamp(),
    });
    
    console.log(`[SYNC] Trilha ${trilhaId}: ${publishedCursoIds.length} cursos sincronizados`);
    return { success: true, count: publishedCursoIds.length };
  } catch (error) {
    console.error(`[SYNC] Erro ao sincronizar trilha ${trilhaId}:`, error);
    return { success: false, count: 0, error: error.message };
  }
}

/**
 * Sincroniza publishedModuloIds de um curso
 * @param {string} cursoId - ID do curso
 * @returns {Promise<{ success: boolean, count: number, error?: string }>}
 */
export async function syncCursoPublishedModulos(cursoId) {
  try {
    // 1. Buscar relações ordenadas
    const relsResult = await getCursoModulosRel(cursoId);
    if (relsResult.error) throw new Error(relsResult.error);
    
    const relations = relsResult.rels || [];
    
    if (relations.length === 0) {
      await updateDoc(doc(db, COLLECTIONS.CURSOS, cursoId), {
        publishedModuloIds: [],
        updatedAt: serverTimestamp(),
      });
      return { success: true, count: 0 };
    }
    
    // 2. Buscar módulos (batch)
    const moduloIds = relations.map(r => r.moduloId);
    const modulosMap = await batchFetchByIds(COLLECTIONS.MODULOS, moduloIds);
    const modulos = Array.from(modulosMap.values());

    // 3. Filtrar acessíveis
    const modulosElegiveis = modulos.filter(isEntityAccessible);

    // 4. Ordenar conforme junction table
    const modulosOrderMap = new Map(modulosElegiveis.map(m => [m.id, m]));
    const ordenados = relations
      .map(r => modulosOrderMap.get(r.moduloId))
      .filter(Boolean);

    // 5. Atualizar curso
    const publishedModuloIds = ordenados.map(m => m.id);
    await updateDoc(doc(db, COLLECTIONS.CURSOS, cursoId), {
      publishedModuloIds,
      updatedAt: serverTimestamp(),
    });
    
    console.log(`[SYNC] Curso ${cursoId}: ${publishedModuloIds.length} módulos sincronizados`);
    return { success: true, count: publishedModuloIds.length };
  } catch (error) {
    console.error(`[SYNC] Erro ao sincronizar curso ${cursoId}:`, error);
    return { success: false, count: 0, error: error.message };
  }
}

/**
 * Sincroniza publishedAulaIds de um módulo
 * @param {string} moduloId - ID do módulo
 * @returns {Promise<{ success: boolean, count: number, error?: string }>}
 */
export async function syncModuloPublishedAulas(moduloId) {
  try {
    // 1. Buscar relações ordenadas
    const relsResult = await getModuloAulasRel(moduloId);
    if (relsResult.error) throw new Error(relsResult.error);
    
    const relations = relsResult.rels || [];
    
    if (relations.length === 0) {
      await updateDoc(doc(db, COLLECTIONS.MODULOS, moduloId), {
        publishedAulaIds: [],
        updatedAt: serverTimestamp(),
      });
      return { success: true, count: 0 };
    }
    
    // 2. Buscar aulas (batch)
    const aulaIds = relations.map(r => r.aulaId);
    const aulasMap = await batchFetchByIds(COLLECTIONS.AULAS, aulaIds);
    const aulas = Array.from(aulasMap.values());

    // 3. Filtrar acessíveis
    const aulasElegiveis = aulas.filter(isEntityAccessible);

    // 4. Ordenar conforme junction table
    const aulasOrderMap = new Map(aulasElegiveis.map(a => [a.id, a]));
    const ordenados = relations
      .map(r => aulasOrderMap.get(r.aulaId))
      .filter(Boolean);

    // 5. Atualizar módulo
    const publishedAulaIds = ordenados.map(a => a.id);
    await updateDoc(doc(db, COLLECTIONS.MODULOS, moduloId), {
      publishedAulaIds,
      updatedAt: serverTimestamp(),
    });
    
    console.log(`[SYNC] Módulo ${moduloId}: ${publishedAulaIds.length} aulas sincronizadas`);
    return { success: true, count: publishedAulaIds.length };
  } catch (error) {
    console.error(`[SYNC] Erro ao sincronizar módulo ${moduloId}:`, error);
    return { success: false, count: 0, error: error.message };
  }
}

/**
 * Sincroniza toda a hierarquia de uma trilha (cascata)
 * @param {string} trilhaId - ID da trilha
 * @returns {Promise<{ success: boolean, stats: Object, errors: string[] }>}
 */
export async function syncTrilhaCascade(trilhaId) {
  const stats = { trilhas: 0, cursos: 0, modulos: 0 };
  const errors = [];
  
  try {
    // 1. Sincronizar trilha → cursos
    const trilhaResult = await syncTrilhaPublishedCursos(trilhaId);
    if (trilhaResult.success) {
      stats.trilhas = 1;
    } else {
      errors.push(`Trilha ${trilhaId}: ${trilhaResult.error}`);
    }
    
    // 2. Buscar cursos vinculados
    const relsResult = await getTrilhaCursosRel(trilhaId);
    const cursoIds = (relsResult.rels || []).map(r => r.cursoId);
    
    // 3. Para cada curso, sincronizar módulos
    for (const cursoId of cursoIds) {
      const cursoResult = await syncCursoPublishedModulos(cursoId);
      if (cursoResult.success) {
        stats.cursos++;
      } else {
        errors.push(`Curso ${cursoId}: ${cursoResult.error}`);
      }
      
      // 4. Buscar módulos do curso
      const modulosRels = await getCursoModulosRel(cursoId);
      const moduloIds = (modulosRels.rels || []).map(r => r.moduloId);
      
      // 5. Para cada módulo, sincronizar aulas
      for (const moduloId of moduloIds) {
        const moduloResult = await syncModuloPublishedAulas(moduloId);
        if (moduloResult.success) {
          stats.modulos++;
        } else {
          errors.push(`Módulo ${moduloId}: ${moduloResult.error}`);
        }
      }
    }
    
    console.log('[SYNC] Sincronização em cascata concluída:', stats);
    return { success: errors.length === 0, stats, errors };
  } catch (error) {
    console.error('[SYNC] Erro na sincronização em cascata:', error);
    return { success: false, stats, errors: [...errors, error.message] };
  }
}

/**
 * Sincroniza toda a hierarquia de um curso (cascata)
 * @param {string} cursoId - ID do curso
 * @returns {Promise<{ success: boolean, stats: Object, errors: string[] }>}
 */
export async function syncCursoCascade(cursoId) {
  const stats = { cursos: 0, modulos: 0 };
  const errors = [];
  
  try {
    // 1. Sincronizar curso → módulos
    const cursoResult = await syncCursoPublishedModulos(cursoId);
    if (cursoResult.success) {
      stats.cursos = 1;
    } else {
      errors.push(`Curso ${cursoId}: ${cursoResult.error}`);
    }
    
    // 2. Buscar módulos vinculados
    const modulosRels = await getCursoModulosRel(cursoId);
    const moduloIds = (modulosRels.rels || []).map(r => r.moduloId);
    
    // 3. Para cada módulo, sincronizar aulas
    for (const moduloId of moduloIds) {
      const moduloResult = await syncModuloPublishedAulas(moduloId);
      if (moduloResult.success) {
        stats.modulos++;
      } else {
        errors.push(`Módulo ${moduloId}: ${moduloResult.error}`);
      }
    }
    
    console.log('[SYNC] Sincronização curso cascata concluída:', stats);
    return { success: errors.length === 0, stats, errors };
  } catch (error) {
    console.error('[SYNC] Erro na sincronização curso cascata:', error);
    return { success: false, stats, errors: [...errors, error.message] };
  }
}


// ============================================
// LIMPEZA DE REFERÊNCIAS ÓRFÃS
// ============================================

/**
 * Limpa referências órfãs em arrays denormalizados e junction tables.
 * Remove IDs de entidades deletadas (ativo=false) de publishedCursoIds, publishedModuloIds, publishedAulaIds.
 * Remove entradas de junction tables que apontam para entidades inexistentes ou deletadas.
 *
 * @param {Object} options
 * @param {boolean} options.dryRun - Se true, apenas relata sem fazer alterações (default: false)
 * @returns {Promise<{ success: boolean, stats: Object, errors: string[] }>}
 */
export async function cleanOrphanedReferences({ dryRun = false } = {}) {
  const stats = {
    trilhasVerificadas: 0,
    cursosVerificados: 0,
    modulosVerificados: 0,
    publishedCursoIdsLimpos: 0,
    publishedModuloIdsLimpos: 0,
    publishedAulaIdsLimpos: 0,
    junctionTrilhaCursosRemovidas: 0,
    junctionCursoModulosRemovidas: 0,
    junctionModuloAulasRemovidas: 0,
  };
  const errors = [];

  try {
    // 1. Limpar publishedCursoIds em trilhas
    const trilhasSnap = await getDocsFromServer(
      query(collection(db, COLLECTIONS.TRILHAS), where('ativo', '==', true))
    );
    stats.trilhasVerificadas = trilhasSnap.docs.length;

    for (const trilhaDoc of trilhasSnap.docs) {
      const trilhaData = trilhaDoc.data();
      const publishedCursoIds = trilhaData.publishedCursoIds || [];
      if (publishedCursoIds.length === 0) continue;

      // Verificar quais cursos ainda existem e estão ativos
      const cursosMap = await batchFetchByIds(COLLECTIONS.CURSOS, publishedCursoIds);
      const validIds = publishedCursoIds.filter(id => {
        const curso = cursosMap.get(id);
        return curso && curso.ativo !== false;
      });

      if (validIds.length < publishedCursoIds.length) {
        const removidos = publishedCursoIds.length - validIds.length;
        stats.publishedCursoIdsLimpos += removidos;
        console.log(`[CLEANUP] Trilha ${trilhaDoc.id}: ${removidos} cursoIds órfãos encontrados`);

        if (!dryRun) {
          await updateDoc(doc(db, COLLECTIONS.TRILHAS, trilhaDoc.id), {
            publishedCursoIds: validIds,
            updatedAt: serverTimestamp(),
          });
        }
      }
    }

    // 2. Limpar publishedModuloIds em cursos
    const cursosSnap = await getDocsFromServer(
      query(collection(db, COLLECTIONS.CURSOS), where('ativo', '==', true))
    );
    stats.cursosVerificados = cursosSnap.docs.length;

    for (const cursoDoc of cursosSnap.docs) {
      const cursoData = cursoDoc.data();
      const publishedModuloIds = cursoData.publishedModuloIds || [];
      if (publishedModuloIds.length === 0) continue;

      const modulosMap = await batchFetchByIds(COLLECTIONS.MODULOS, publishedModuloIds);
      const validIds = publishedModuloIds.filter(id => {
        const modulo = modulosMap.get(id);
        return modulo && modulo.ativo !== false;
      });

      if (validIds.length < publishedModuloIds.length) {
        const removidos = publishedModuloIds.length - validIds.length;
        stats.publishedModuloIdsLimpos += removidos;
        console.log(`[CLEANUP] Curso ${cursoDoc.id}: ${removidos} moduloIds órfãos encontrados`);

        if (!dryRun) {
          await updateDoc(doc(db, COLLECTIONS.CURSOS, cursoDoc.id), {
            publishedModuloIds: validIds,
            updatedAt: serverTimestamp(),
          });
        }
      }
    }

    // 3. Limpar publishedAulaIds em módulos
    const modulosSnap = await getDocsFromServer(
      query(collection(db, COLLECTIONS.MODULOS), where('ativo', '==', true))
    );
    stats.modulosVerificados = modulosSnap.docs.length;

    for (const moduloDoc of modulosSnap.docs) {
      const moduloData = moduloDoc.data();
      const publishedAulaIds = moduloData.publishedAulaIds || [];
      if (publishedAulaIds.length === 0) continue;

      const aulasMap = await batchFetchByIds(COLLECTIONS.AULAS, publishedAulaIds);
      const validIds = publishedAulaIds.filter(id => {
        const aula = aulasMap.get(id);
        return aula && aula.ativo !== false;
      });

      if (validIds.length < publishedAulaIds.length) {
        const removidos = publishedAulaIds.length - validIds.length;
        stats.publishedAulaIdsLimpos += removidos;
        console.log(`[CLEANUP] Módulo ${moduloDoc.id}: ${removidos} aulaIds órfãos encontrados`);

        if (!dryRun) {
          await updateDoc(doc(db, COLLECTIONS.MODULOS, moduloDoc.id), {
            publishedAulaIds: validIds,
            updatedAt: serverTimestamp(),
          });
        }
      }
    }

    // 4. Limpar junction tables com referências para entidades deletadas/inexistentes
    // 4a. educacao_trilha_cursos
    const tcSnap = await getDocsFromServer(collection(db, COLLECTIONS.TRILHA_CURSOS));
    const allTrilhaIds = new Set(trilhasSnap.docs.map(d => d.id));
    const allCursoIds = new Set(cursosSnap.docs.map(d => d.id));

    for (const jDoc of tcSnap.docs) {
      const data = jDoc.data();
      if (!allTrilhaIds.has(data.trilhaId) || !allCursoIds.has(data.cursoId)) {
        stats.junctionTrilhaCursosRemovidas++;
        if (!dryRun) {
          await deleteDoc(doc(db, COLLECTIONS.TRILHA_CURSOS, jDoc.id));
        }
      }
    }

    // 4b. educacao_curso_modulos
    const cmSnap = await getDocsFromServer(collection(db, COLLECTIONS.CURSO_MODULOS));
    const allModuloIds = new Set(modulosSnap.docs.map(d => d.id));

    for (const jDoc of cmSnap.docs) {
      const data = jDoc.data();
      if (!allCursoIds.has(data.cursoId) || !allModuloIds.has(data.moduloId)) {
        stats.junctionCursoModulosRemovidas++;
        if (!dryRun) {
          await deleteDoc(doc(db, COLLECTIONS.CURSO_MODULOS, jDoc.id));
        }
      }
    }

    // 4c. educacao_modulo_aulas
    const maSnap = await getDocsFromServer(collection(db, COLLECTIONS.MODULO_AULAS));
    const allAulaIdsSet = new Set(
      (await getDocsFromServer(query(collection(db, COLLECTIONS.AULAS), where('ativo', '==', true)))).docs.map(d => d.id)
    );

    for (const jDoc of maSnap.docs) {
      const data = jDoc.data();
      if (!allModuloIds.has(data.moduloId) || !allAulaIdsSet.has(data.aulaId)) {
        stats.junctionModuloAulasRemovidas++;
        if (!dryRun) {
          await deleteDoc(doc(db, COLLECTIONS.MODULO_AULAS, jDoc.id));
        }
      }
    }

    const totalLimpos = stats.publishedCursoIdsLimpos + stats.publishedModuloIdsLimpos +
      stats.publishedAulaIdsLimpos + stats.junctionTrilhaCursosRemovidas +
      stats.junctionCursoModulosRemovidas + stats.junctionModuloAulasRemovidas;

    console.log(`[CLEANUP] ${dryRun ? 'DRY RUN' : 'EXECUTADO'} - ${totalLimpos} referências órfãs ${dryRun ? 'encontradas' : 'removidas'}`, stats);

    return { success: true, stats, errors };
  } catch (error) {
    console.error('[CLEANUP] Erro na limpeza de referências órfãs:', error);
    return { success: false, stats, errors: [...errors, error.message] };
  }
}

// ============================================
// FUNÇÃO DE DIAGNÓSTICO - DELETAR CURSO DIRETAMENTE
// ============================================

/**
 * Função de teste para deletar um curso diretamente via console
 * Use: testDeleteCurso('ID_DO_CURSO')
 */
export async function testDeleteCurso(cursoId) {
  console.log('=== TESTE DELETE CURSO ===');
  console.log('1. Buscando curso atual...');
  
  try {
    // Verificar curso antes
    const cursoRef = doc(db, COLLECTIONS.CURSOS, cursoId);
    const cursoSnap = await getDoc(cursoRef);
    
    if (!cursoSnap.exists()) {
      console.error('Curso não encontrado:', cursoId);
      return { success: false, error: 'Curso não encontrado' };
    }
    
    const cursoData = cursoSnap.data();
    console.log('2. Curso encontrado:', cursoData.titulo, '| ativo:', cursoData.ativo);
    
    // Fazer update direto (sem batch)
    console.log('3. Atualizando ativo para false...');
    await updateDoc(cursoRef, {
      ativo: false,
      deletedAt: serverTimestamp(),
      deletedBy: 'teste-console',
    });
    console.log('4. updateDoc executado!');
    
    // Verificar após update
    console.log('5. Verificando após update...');
    const cursoSnapAfter = await getDoc(cursoRef);
    const cursoDataAfter = cursoSnapAfter.data();
    console.log('6. Curso após update:', cursoDataAfter.titulo, '| ativo:', cursoDataAfter.ativo);
    
    if (cursoDataAfter.ativo === false) {
      console.log('✅ SUCESSO! Curso marcado como inativo.');
      return { success: true };
    } else {
      console.error('❌ FALHA! ativo ainda é:', cursoDataAfter.ativo);
      return { success: false, error: 'ativo não foi atualizado' };
    }
  } catch (error) {
    console.error('❌ ERRO:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// COMPLIANCE SUMMARY
// ============================================================================

/**
 * Calculate Qmentum compliance summary across users and mandatory trilhas.
 * @param {Array<{id:string}>} usuarios
 * @param {Array} trilhas - Trilha objects with obrigatoria, prazoConclusao, cursos[], createdAt
 * @param {Object} progressosPorUsuario - { userId: [{ cursoId, progresso }] }
 * @returns {{totalUsuarios,emConformidade,parcialmenteConformes,naoConformes,porcentagemConformidade}}
 */
export function getComplianceSummary(usuarios, trilhas, progressosPorUsuario) {
  if (!usuarios?.length) {
    return { totalUsuarios: 0, emConformidade: 0, parcialmenteConformes: 0, naoConformes: 0, porcentagemConformidade: 0 };
  }

  const mandatoryTrilhas = (trilhas || []).filter((t) => t.obrigatoria && t.ativo);
  const now = new Date();

  let emConformidade = 0;
  let parcialmenteConformes = 0;
  let naoConformes = 0;

  for (const user of usuarios) {
    const progressos = progressosPorUsuario?.[user.id] || [];
    let allComplete = true;
    let hasAnyProgress = false;
    let hasOverdue = false;

    for (const trilha of mandatoryTrilhas) {
      const cursos = trilha.cursos || [];
      const completedAll = cursos.every((cId) => {
        const p = progressos.find((pr) => pr.cursoId === cId);
        return p && p.progresso >= 100;
      });

      if (completedAll) {
        if (cursos.length > 0) hasAnyProgress = true;
        continue;
      }

      allComplete = false;

      const someProgress = cursos.some((cId) => {
        const p = progressos.find((pr) => pr.cursoId === cId);
        return p && p.progresso > 0;
      });
      if (someProgress) hasAnyProgress = true;

      if (trilha.prazoConclusao && trilha.createdAt) {
        const created = trilha.createdAt instanceof Date ? trilha.createdAt : new Date(trilha.createdAt);
        const deadline = new Date(created.getTime() + trilha.prazoConclusao * 24 * 60 * 60 * 1000);
        if (now > deadline) hasOverdue = true;
      }
    }

    if (mandatoryTrilhas.length === 0 || allComplete) {
      emConformidade++;
    } else if (hasOverdue) {
      naoConformes++;
    } else if (hasAnyProgress) {
      parcialmenteConformes++;
    } else {
      naoConformes++;
    }
  }

  const total = usuarios.length;
  return {
    totalUsuarios: total,
    emConformidade,
    parcialmenteConformes,
    naoConformes,
    porcentagemConformidade: total > 0 ? Math.round((emConformidade / total) * 100) : 0,
  };
}

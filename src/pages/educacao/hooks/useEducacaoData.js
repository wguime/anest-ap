/**
 * useEducacaoData.js
 * Hook centralizado para gerenciamento de dados de educação
 *
 * Integrado com Firestore, com fallback para mock data em desenvolvimento
 */

import { useState, useMemo, useCallback, useEffect, createContext, useContext, createElement } from 'react';
import { useUser } from '../../../contexts/UserContext';
import * as educacaoService from '../../../services/educacaoService';
import {
  mockTrilhas,
  mockCursos,
  mockModulos,
  mockAulas,
  getModulosByCurso,
  getAulasByModulo,
  getAulasByCurso,
  getAulasByTrilha,
  getCursosByTrilha,
  buildContentTree,
  getContentStats,
} from '../data/mockEducacaoData';

// Verificar se está em modo mock
// Por padrão, usar Firebase (useMock = false)
// Para forçar mock, definir VITE_USE_MOCK=true no .env
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

function dedupeById(items) {
  const map = new Map();
  (items || []).forEach((item) => {
    if (!item?.id) return;
    map.set(item.id, item);
  });
  return Array.from(map.values());
}

// Context para compartilhar dados entre páginas (evita re-fetch a cada navegação)
const EducacaoDataContext = createContext(null);

/**
 * Hook para gerenciamento de dados de educação
 * Fornece CRUD e navegação para Trilhas, Cursos, Módulos e Aulas
 *
 * @param {Object} options - Opções de configuração
 * @param {boolean} options.useMock - Forçar uso de dados mock (default: auto)
 * @param {boolean} options.autoFetch - Buscar dados automaticamente (default: true)
 */
export function useEducacaoData({ useMock: useMockParam = USE_MOCK, autoFetch = true } = {}) {
  // Quando dentro de um EducacaoDataProvider, reutilizar dados do contexto
  const _ctx = useContext(EducacaoDataContext);

  const { user, isMock } = useUser();
  // UserContext pode estar em mock (id) ou Firebase (uid)
  // Firestore não aceita `undefined`, então garantimos um fallback estável.
  const userId = user?.uid || user?.id || 'system';
  const useMock = useMockParam || isMock;

  // Estado principal
  const [trilhas, setTrilhas] = useState(useMock ? mockTrilhas : []);
  const [cursos, setCursos] = useState(useMock ? mockCursos : []);
  const [modulos, setModulos] = useState(useMock ? mockModulos : []);
  const [aulas, setAulas] = useState(useMock ? mockAulas : []);
  const [trilhaCursosRel, setTrilhaCursosRel] = useState([]);
  const [cursoModulosRel, setCursoModulosRel] = useState([]);
  const [moduloAulasRel, setModuloAulasRel] = useState([]);

  // Estado de loading
  const [loading, setLoading] = useState(!useMock);
  const [error, setError] = useState(null);

  // ============================================
  // SANITIZAÇÃO / INTEGRIDADE BÁSICA
  // ============================================
  // Mantém referências inválidas fora da árvore (trilha->curso). Módulos/Aulas podem existir sem vínculo (reuso real).
  const { trilhasSan, cursosSan, modulosSan, aulasSan } = useMemo(() => {
    const cursosById = new Map((cursos || []).map(c => [c.id, c]));

    const trilhasValidas = (trilhas || []).map(t => {
      // Preferir junction table, fallback para array embarcado
      const junctionIds = (trilhaCursosRel || [])
        .filter(r => r.trilhaId === t.id)
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
        .map(r => r.cursoId);
      const cursoIds = junctionIds.length > 0 ? junctionIds : (t.cursos || []);
      return {
        ...t,
        cursos: cursoIds.filter(id => cursosById.has(id)),
      };
    });

    return {
      trilhasSan: trilhasValidas,
      cursosSan: cursos || [],
      modulosSan: modulos || [],
      aulasSan: aulas || [],
    };
  }, [trilhas, cursos, modulos, aulas, trilhaCursosRel]);

  // ============================================
  // RELAÇÕES (reuso real + ordem por pai)
  // ============================================
  
  // Mapa: trilhaId -> [{ cursoId, ordem, ... }]
  const trilhaCursosByTrilhaId = useMemo(() => {
    const map = new Map();
    (trilhaCursosRel || []).forEach((r) => {
      if (!r?.trilhaId || !r?.cursoId) return;
      const arr = map.get(r.trilhaId) || [];
      arr.push(r);
      map.set(r.trilhaId, arr);
    });
    map.forEach((arr, key) => {
      arr.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      map.set(key, arr);
    });
    return map;
  }, [trilhaCursosRel]);

  // Mapa: cursoId -> [trilhaId, ...]
  const cursoTrilhasByCursoId = useMemo(() => {
    const map = new Map();
    (trilhaCursosRel || []).forEach((r) => {
      if (!r?.trilhaId || !r?.cursoId) return;
      const arr = map.get(r.cursoId) || [];
      arr.push(r.trilhaId);
      map.set(r.cursoId, arr);
    });
    return map;
  }, [trilhaCursosRel]);
  
  const cursoModulosByCursoId = useMemo(() => {
    const map = new Map();
    (cursoModulosRel || []).forEach((r) => {
      if (!r?.cursoId || !r?.moduloId) return;
      const arr = map.get(r.cursoId) || [];
      arr.push(r);
      map.set(r.cursoId, arr);
    });
    map.forEach((arr, key) => {
      arr.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      map.set(key, arr);
    });
    return map;
  }, [cursoModulosRel]);

  const moduloAulasByModuloId = useMemo(() => {
    const map = new Map();
    (moduloAulasRel || []).forEach((r) => {
      if (!r?.moduloId || !r?.aulaId) return;
      const arr = map.get(r.moduloId) || [];
      arr.push(r);
      map.set(r.moduloId, arr);
    });
    map.forEach((arr, key) => {
      arr.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      map.set(key, arr);
    });
    return map;
  }, [moduloAulasRel]);

  // ============================================
  // CARREGAMENTO DE DADOS DO FIRESTORE
  // ============================================

  /**
   * Buscar trilhas do Firestore
   */
  const fetchTrilhas = useCallback(async () => {
    if (useMock) return;
    try {
      const { trilhas: data, error } = await educacaoService.getTrilhas();
      if (error) throw new Error(error);
      setTrilhas(data || []);
    } catch (err) {
      console.error('Erro ao buscar trilhas:', err);
    }
  }, [useMock]);

  /**
   * Buscar cursos do Firestore
   */
  const fetchCursos = useCallback(async () => {
    if (useMock) return;
    try {
      const { cursos: data, error } = await educacaoService.getCursos();
      if (error) throw new Error(error);
      setCursos(data || []);
    } catch (err) {
      console.error('Erro ao buscar cursos:', err);
    }
  }, [useMock]);

  /**
   * Buscar módulos do Firestore (por curso)
   */
  const fetchModulosByCurso = useCallback(async (cursoId) => {
    if (useMock) return;
    try {
      const { modulos: data, error } = await educacaoService.getModulosByCurso(cursoId);
      if (error) throw new Error(error);

      setModulos(prev => {
        // Não dá para remover "módulos deste curso" pelo campo `cursoId`,
        // pois com reuso real o módulo pode estar em vários cursos (e `cursoId` pode ser nulo).
        const incoming = data || [];
        const incomingIds = new Set(incoming.map(m => m.id));
        const kept = (prev || []).filter(m => !incomingIds.has(m.id));
        return dedupeById([...kept, ...incoming]);
      });
    } catch (err) {
      console.error('Erro ao buscar módulos:', err);
    }
  }, [useMock]);

  /**
   * Buscar todos os módulos
   */
  const fetchAllModulos = useCallback(async () => {
    if (useMock) return;
    try {
      // Buscar módulos de cada curso
      const promises = cursos.map(c => educacaoService.getModulosByCurso(c.id));
      const results = await Promise.all(promises);

      const allModulos = [];
      results.forEach(({ modulos: data }) => {
        if (data && data.length > 0) {
          allModulos.push(...data);
        }
      });

      setModulos(dedupeById(allModulos));
    } catch (err) {
      console.error('Erro ao buscar módulos:', err);
    }
  }, [useMock, cursos]);

  /**
   * Buscar todas as aulas
   */
  const fetchAllAulas = useCallback(async () => {
    if (useMock) return;
    try {
      // Buscar aulas de cada módulo
      const uniqueModulos = dedupeById(modulos);
      const promises = uniqueModulos.map(m => educacaoService.getAulasByModulo(m.id));
      const results = await Promise.all(promises);

      const allAulas = [];
      results.forEach(({ aulas: data }) => {
        if (data && data.length > 0) {
          allAulas.push(...data);
        }
      });

      setAulas(dedupeById(allAulas));
    } catch (err) {
      console.error('Erro ao buscar aulas:', err);
    }
  }, [useMock, modulos]);

  const fetchAllRelacoes = useCallback(async () => {
    if (useMock) return;
    try {
      const [
        { rels: trilhaCursoRels },
        { rels: cursoModRels }, 
        { rels: moduloAulaRels }
      ] = await Promise.all([
        educacaoService.getAllTrilhaCursosRel(),
        educacaoService.getAllCursoModulosRel(),
        educacaoService.getAllModuloAulasRel(),
      ]);
      setTrilhaCursosRel(trilhaCursoRels || []);
      setCursoModulosRel(cursoModRels || []);
      setModuloAulasRel(moduloAulaRels || []);
    } catch (err) {
      console.error('Erro ao buscar relações:', err);
      setTrilhaCursosRel([]);
      setCursoModulosRel([]);
      setModuloAulasRel([]);
    }
  }, [useMock]);

  /**
   * Carregar todos os dados
   */
  // Função para forçar atualização do Firestore (mesmo em modo mock)
  // Fetches data inline to avoid stale closure issues
  const forceRefreshFromFirestore = useCallback(async () => {
    console.log('[useEducacaoData] Forçando atualização do Firestore...');
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch trilhas and cursos in parallel (fresh data, no closure dependency)
      const [trilhasResult, cursosResult] = await Promise.all([
        educacaoService.getTrilhas(),
        educacaoService.getCursos(),
      ]);

      const freshTrilhas = trilhasResult.trilhas || [];
      const freshCursos = cursosResult.cursos || [];

      setTrilhas(freshTrilhas);
      setCursos(freshCursos);

      // 2. Fetch modules using FRESH cursos (not stale state)
      const moduloPromises = freshCursos.map(c => educacaoService.getModulosByCurso(c.id));
      const moduloResults = await Promise.all(moduloPromises);
      const allModulos = [];
      moduloResults.forEach(({ modulos: data }) => {
        if (data?.length > 0) allModulos.push(...data);
      });
      const freshModulos = dedupeById(allModulos);
      setModulos(freshModulos);

      // 3. Fetch aulas using FRESH modulos (not stale state)
      const aulaPromises = freshModulos.map(m => educacaoService.getAulasByModulo(m.id));
      const aulaResults = await Promise.all(aulaPromises);
      const allAulas = [];
      aulaResults.forEach(({ aulas: data }) => {
        if (data?.length > 0) allAulas.push(...data);
      });
      setAulas(dedupeById(allAulas));

      // 4. Fetch all relations
      const [tcRels, cmRels, maRels] = await Promise.all([
        educacaoService.getAllTrilhaCursosRel(),
        educacaoService.getAllCursoModulosRel(),
        educacaoService.getAllModuloAulasRel(),
      ]);
      setTrilhaCursosRel(tcRels.rels || []);
      setCursoModulosRel(cmRels.rels || []);
      setModuloAulasRel(maRels.rels || []);

      console.log('[useEducacaoData] Atualização concluída:', {
        trilhas: freshTrilhas.length, cursos: freshCursos.length,
        modulos: freshModulos.length, aulas: allAulas.length,
      });
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []); // Empty deps — fetches fresh data inline, no stale closures

  const fetchAll = useCallback(async () => {
    if (useMock) {
      // Derivar relações a partir do modelo legado (compatibilidade)
      const derivedCursoModulos = [];
      (cursos || []).forEach((c) => {
        const ids = c.moduloIds?.length
          ? c.moduloIds
          : (modulos || []).filter(m => m.cursoId === c.id).sort((a, b) => (a.ordem || 0) - (b.ordem || 0)).map(m => m.id);
        ids.forEach((moduloId, index) => {
          derivedCursoModulos.push({
            id: `${c.id}__${moduloId}`,
            cursoId: c.id,
            moduloId,
            ordem: index + 1,
          });
        });
      });

      const derivedModuloAulas = [];
      (modulos || []).forEach((m) => {
        const ids = m.aulaIds?.length
          ? m.aulaIds
          : (aulas || []).filter(a => a.moduloId === m.id).sort((a, b) => (a.ordem || 0) - (b.ordem || 0)).map(a => a.id);
        ids.forEach((aulaId, index) => {
          derivedModuloAulas.push({
            id: `${m.id}__${aulaId}`,
            moduloId: m.id,
            aulaId,
            ordem: index + 1,
          });
        });
      });

      setCursoModulosRel(derivedCursoModulos);
      setModuloAulasRel(derivedModuloAulas);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch trilhas + cursos in parallel (fresh data, no closure dependency)
      const [trilhasResult, cursosResult] = await Promise.all([
        educacaoService.getTrilhas(),
        educacaoService.getCursos(),
      ]);

      const freshTrilhas = trilhasResult.trilhas || [];
      const freshCursos = cursosResult.cursos || [];

      setTrilhas(freshTrilhas);
      setCursos(freshCursos);

      // Fetch modules using FRESH cursos (not stale state)
      const moduloPromises = freshCursos.map(c => educacaoService.getModulosByCurso(c.id));
      const moduloResults = await Promise.all(moduloPromises);
      const allModulos = [];
      moduloResults.forEach(({ modulos: data }) => {
        if (data?.length > 0) allModulos.push(...data);
      });
      const freshModulos = dedupeById(allModulos);
      setModulos(freshModulos);

      // Fetch aulas using FRESH modulos (not stale state)
      const aulaPromises = freshModulos.map(m => educacaoService.getAulasByModulo(m.id));
      const aulaResults = await Promise.all(aulaPromises);
      const allAulas = [];
      aulaResults.forEach(({ aulas: data }) => {
        if (data?.length > 0) allAulas.push(...data);
      });
      setAulas(dedupeById(allAulas));

      // Fetch all relations
      const [tcRels, cmRels, maRels] = await Promise.all([
        educacaoService.getAllTrilhaCursosRel(),
        educacaoService.getAllCursoModulosRel(),
        educacaoService.getAllModuloAulasRel(),
      ]);
      setTrilhaCursosRel(tcRels.rels || []);
      setCursoModulosRel(cmRels.rels || []);
      setModuloAulasRel(maRels.rels || []);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [useMock, cursos, modulos, aulas]); // Keep mock-path deps for derived relations

  // Carregamento inicial (pula quando dentro de EducacaoDataProvider — dados vêm do contexto)
  // Também inicia subscriptions em tempo real para TODAS as entidades
  useEffect(() => {
    if (!autoFetch || useMock || _ctx) return;

    // Fetch inicial de todas as entidades e relações
    fetchAll();

    // Subscriptions em tempo real para TODAS as entidades (trilhas, cursos, módulos, aulas)
    // Quando ativo muda para false (soft delete), o item some automaticamente da lista
    // Isso garante sincronização imediata entre admin e página do usuário

    const unsubTrilhas = educacaoService.subscribeTrilhas(
      (trilhasFromFirestore) => {
        setTrilhas(trilhasFromFirestore);
      },
      (err) => {
        console.error('[useEducacaoData] Erro na subscription de trilhas:', err);
      }
    );

    const unsubCursos = educacaoService.subscribeCursos(
      (cursosFromFirestore) => {
        setCursos(cursosFromFirestore);
      },
      (err) => {
        console.error('[useEducacaoData] Erro na subscription de cursos:', err);
      }
    );

    // Subscription para módulos - sincroniza quando módulo é deletado (ativo=false)
    const unsubModulos = educacaoService.subscribeModulos(
      (modulosFromFirestore) => {
        setModulos(modulosFromFirestore);
      },
      (err) => {
        console.error('[useEducacaoData] Erro na subscription de módulos:', err);
      }
    );

    // Subscription para aulas - sincroniza quando aula é deletada (ativo=false)
    const unsubAulas = educacaoService.subscribeAulas(
      (aulasFromFirestore) => {
        setAulas(aulasFromFirestore);
      },
      (err) => {
        console.error('[useEducacaoData] Erro na subscription de aulas:', err);
      }
    );

    // Cleanup: cancelar TODAS as subscriptions ao desmontar
    return () => {
      unsubTrilhas();
      unsubCursos();
      unsubModulos();
      unsubAulas();
    };
  }, [autoFetch, useMock, _ctx]); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================
  // TRILHAS
  // ============================================

  const addTrilha = useCallback(async (trilhaData) => {
    if (useMock) {
      const newTrilha = {
        ...trilhaData,
        id: trilhaData.id || `trilha-${Date.now()}`,
        statusPublicacao: trilhaData.statusPublicacao || 'draft',
        publishedAt: trilhaData.publishedAt || null,
        releaseAt: trilhaData.releaseAt || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setTrilhas(prev => [...prev, newTrilha]);
      return newTrilha;
    }

    try {
      const result = await educacaoService.addTrilha(trilhaData, userId);
      const { trilhaId, error } = result || {};
      
      if (error) {
        throw new Error(error);
      }
      
      if (!trilhaId) {
        throw new Error('ID da trilha não foi retornado pelo servidor');
      }

      await fetchTrilhas(); // Recarregar lista
      return { id: trilhaId, ...trilhaData };
    } catch (err) {
      console.error('Erro ao adicionar trilha:', err);
      throw err;
    }
  }, [useMock, userId, fetchTrilhas]);

  const updateTrilha = useCallback(async (id, updates) => {
    if (useMock) {
      let updatedTrilha = null;
      setTrilhas(prev => prev.map(t => {
        if (t.id === id) {
          updatedTrilha = { ...t, ...updates, updatedAt: new Date() };
          return updatedTrilha;
        }
        return t;
      }));
      return updatedTrilha || { id, ...updates };
    }

    try {
      const { success, error } = await educacaoService.updateTrilha(id, updates, userId);
      if (error) throw new Error(error);
      if (success) await fetchTrilhas();
      return { id, ...updates };
    } catch (err) {
      console.error('Erro ao atualizar trilha:', err);
      throw err;
    }
  }, [useMock, userId, fetchTrilhas]);

  const deleteTrilha = useCallback(async (id) => {
    if (useMock) {
      setTrilhas(prev => prev.filter(t => t.id !== id));
      return;
    }

    try {
      const { success, error } = await educacaoService.deleteTrilha(id, userId);
      if (error) throw new Error(error);
      if (success) {
        setTrilhas(prev => prev.filter(t => t.id !== id));
        // Invalidar relações para manter consistência em telas derivadas
        await fetchAllRelacoes();
      }
    } catch (err) {
      console.error('Erro ao deletar trilha:', err);
      throw err;
    }
  }, [useMock, userId, fetchAllRelacoes]);

  const getTrilhaById = useCallback((id) => {
    return trilhas.find(t => t.id === id);
  }, [trilhas]);

  // ============================================
  // CURSOS
  // ============================================

  const addCurso = useCallback(async (cursoData) => {
    if (useMock) {
      const newCurso = {
        ...cursoData,
        id: cursoData.id || `curso-${Date.now()}`,
        modulos: cursoData.modulos || [],
        statusPublicacao: cursoData.statusPublicacao || 'draft',
        publishedAt: cursoData.publishedAt || null,
        releaseAt: cursoData.releaseAt || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setCursos(prev => [...prev, newCurso]);
      return newCurso;
    }

    try {
      const result = await educacaoService.addCurso(cursoData, userId);
      const { cursoId, error } = result || {};
      
      if (error) {
        throw new Error(error);
      }
      
      if (!cursoId) {
        throw new Error('ID do curso não foi retornado pelo servidor');
      }

      await fetchCursos();
      return { id: cursoId, ...cursoData };
    } catch (err) {
      console.error('Erro ao adicionar curso:', err);
      throw err;
    }
  }, [useMock, userId, fetchCursos]);

  const updateCurso = useCallback(async (id, updates) => {
    if (useMock) {
      let updatedCurso = null;
      setCursos(prev => prev.map(c => {
        if (c.id === id) {
          updatedCurso = { ...c, ...updates, updatedAt: new Date() };
          return updatedCurso;
        }
        return c;
      }));
      return updatedCurso || { id, ...updates };
    }

    try {
      const { success, error } = await educacaoService.updateCurso(id, updates, userId);
      if (error) throw new Error(error);
      if (success) await fetchCursos();
      return { id, ...updates };
    } catch (err) {
      console.error('Erro ao atualizar curso:', err);
      throw err;
    }
  }, [useMock, userId, fetchCursos]);

  const deleteCurso = useCallback(async (id) => {
    if (useMock) {
      // Modo mock: atualiza state local apenas
      setModulos(prev => prev.filter(m => m.cursoId !== id));
      setAulas(prev => prev.filter(a => a.cursoId !== id));
      setCursos(prev => prev.filter(c => c.id !== id));
      setTrilhas(prev => prev.map(t => ({
        ...t,
        cursos: t.cursos.filter(cId => cId !== id),
      })));
      return;
    }

    try {
      const { success, error } = await educacaoService.deleteCurso(id, userId);
      if (error) throw new Error(error);

      if (success) {
        // Remoção imediata do state (não depender apenas da subscription async)
        setCursos(prev => prev.filter(c => c.id !== id));
        setTrilhas(prev => prev.map(t => ({
          ...t,
          cursos: (t.cursos || []).filter(cId => cId !== id),
        })));
        await fetchAllRelacoes();
      }
    } catch (err) {
      console.error('Erro ao deletar curso:', err);
      throw err;
    }
  }, [useMock, userId, fetchAllRelacoes]);

  const getCursoById = useCallback((id) => {
    return cursos.find(c => c.id === id);
  }, [cursos]);

  // ============================================
  // MÓDULOS
  // ============================================

  const addModulo = useCallback(async (moduloData) => {
    if (useMock) {
      const newModulo = {
        ...moduloData,
        id: moduloData.id || `mod-${Date.now()}`,
        ordem: moduloData.ordem || modulos.filter(m => m.cursoId === moduloData.cursoId).length + 1,
        ativo: true,
      };
      setModulos(prev => [...prev, newModulo]);

      // Também atualiza a lista de módulos no curso (para compatibilidade)
      if (moduloData.cursoId) {
        setCursos(prev => prev.map(c =>
          c.id === moduloData.cursoId
            ? {
              ...c,
              modulos: [...(c.modulos || []), { id: newModulo.id, titulo: newModulo.titulo, tipo: newModulo.tipo, duracao: newModulo.duracao }],
            }
            : c
        ));
      }

      return newModulo;
    }

    try {
      const result = await educacaoService.addModulo(moduloData, userId);
      const { moduloId, error } = result || {};
      
      if (error) {
        throw new Error(error);
      }
      
      if (!moduloId) {
        throw new Error('ID do módulo não foi retornado pelo servidor');
      }

      await fetchModulosByCurso(moduloData.cursoId);
      return { id: moduloId, ...moduloData };
    } catch (err) {
      console.error('Erro ao adicionar módulo:', err);
      throw err;
    }
  }, [useMock, modulos, userId, fetchModulosByCurso]);

  const updateModulo = useCallback(async (id, updates) => {
    if (useMock) {
      let updatedModulo = null;
      setModulos(prev => prev.map(m => {
        if (m.id === id) {
          updatedModulo = { ...m, ...updates };
          return updatedModulo;
        }
        return m;
      }));

      // Atualiza também no curso
      const modulo = modulos.find(m => m.id === id);
      if (modulo?.cursoId) {
        setCursos(prev => prev.map(c =>
          c.id === modulo.cursoId
            ? {
              ...c,
              modulos: c.modulos?.map(m =>
                m.id === id ? { ...m, ...updates } : m
              ),
            }
            : c
        ));
      }
      return updatedModulo || { id, ...updates };
    }

    try {
      const { success, error } = await educacaoService.updateModulo(id, updates, userId);
      if (error) throw new Error(error);

      const modulo = modulos.find(m => m.id === id);
      if (success && modulo) await fetchModulosByCurso(modulo.cursoId);
      return { id, ...updates };
    } catch (err) {
      console.error('Erro ao atualizar módulo:', err);
      throw err;
    }
  }, [useMock, modulos, userId, fetchModulosByCurso]);

  const deleteModulo = useCallback(async (id) => {
    if (useMock) {
      const modulo = modulos.find(m => m.id === id);
      setAulas(prev => prev.filter(a => a.moduloId !== id));
      setModulos(prev => prev.filter(m => m.id !== id));
      if (modulo?.cursoId) {
        setCursos(prev => prev.map(c =>
          c.id === modulo.cursoId
            ? { ...c, modulos: c.modulos?.filter(m => m.id !== id) }
            : c
        ));
      }
      return;
    }

    try {
      const { success, error } = await educacaoService.deleteModulo(id, userId);
      if (error) throw new Error(error);

      if (success) {
        // Remoção imediata do state (não depender apenas da subscription async)
        setModulos(prev => prev.filter(m => m.id !== id));
        await fetchAllRelacoes();
      }
    } catch (err) {
      console.error('Erro ao deletar módulo:', err);
      throw err;
    }
  }, [useMock, modulos, userId, fetchAllRelacoes]);

  const getModuloById = useCallback((id) => {
    return modulos.find(m => m.id === id);
  }, [modulos]);

  // ============================================
  // AULAS
  // ============================================

  const addAula = useCallback(async (aulaData) => {
    if (useMock) {
      const newAula = {
        ...aulaData,
        id: aulaData.id || `aula-${Date.now()}`,
        ordem: aulaData.ordem || aulas.filter(a => a.moduloId === aulaData.moduloId).length + 1,
        ativo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setAulas(prev => [...prev, newAula]);
      return newAula;
    }

    try {
      const result = await educacaoService.addAula(aulaData, userId);
      const { aulaId, error } = result || {};
      
      if (error) {
        throw new Error(error);
      }
      
      if (!aulaId) {
        throw new Error('ID da aula não foi retornado pelo servidor');
      }

      await fetchAllAulas();
      return { id: aulaId, ...aulaData };
    } catch (err) {
      console.error('Erro ao adicionar aula:', err);
      throw err;
    }
  }, [useMock, aulas, userId, fetchAllAulas]);

  const updateAula = useCallback(async (id, updates) => {
    if (useMock) {
      let updatedAula = null;
      setAulas(prev => prev.map(a => {
        if (a.id === id) {
          updatedAula = { ...a, ...updates, updatedAt: new Date() };
          return updatedAula;
        }
        return a;
      }));
      return updatedAula || { id, ...updates };
    }

    try {
      const { success, error } = await educacaoService.updateAula(id, updates, userId);
      if (error) throw new Error(error);
      if (success) await fetchAllAulas();
      return { id, ...updates };
    } catch (err) {
      console.error('Erro ao atualizar aula:', err);
      throw err;
    }
  }, [useMock, userId, fetchAllAulas]);

  const deleteAula = useCallback(async (id) => {
    if (useMock) {
      setAulas(prev => prev.filter(a => a.id !== id));
      return;
    }

    try {
      const { success, error } = await educacaoService.deleteAula(id, userId);
      if (error) throw new Error(error);

      if (success) {
        // Remoção imediata do state (não depender apenas da subscription async)
        setAulas(prev => prev.filter(a => a.id !== id));
        await fetchAllRelacoes();
      }
    } catch (err) {
      console.error('Erro ao deletar aula:', err);
      throw err;
    }
  }, [useMock, userId, fetchAllRelacoes]);

  const getAulaById = useCallback((id) => {
    return aulas.find(a => a.id === id);
  }, [aulas]);

  // ============================================
  // VÍNCULOS (reuso real)
  // ============================================

  // ============================================
  // RELAÇÕES TRILHA ↔ CURSO (N:N)
  // ============================================

  const linkCursoToTrilha = useCallback(async (trilhaId, cursoId) => {
    if (useMock) {
      setTrilhaCursosRel(prev => {
        const current = (prev || []).filter(r => r.trilhaId === trilhaId);
        if (current.some(r => r.cursoId === cursoId)) return prev;
        const ordem = current.length + 1;
        return [
          ...(prev || []),
          { id: `${trilhaId}_${cursoId}`, trilhaId, cursoId, ordem },
        ];
      });
      return { relId: `${trilhaId}_${cursoId}`, error: null };
    }

    const { relId, error } = await educacaoService.linkCursoToTrilha(trilhaId, cursoId, null, userId);
    if (error) throw new Error(error);
    await fetchAllRelacoes();
    return { relId, error: null };
  }, [useMock, userId, fetchAllRelacoes]);

  const unlinkCursoFromTrilha = useCallback(async (trilhaId, cursoId) => {
    if (useMock) {
      setTrilhaCursosRel(prev => (prev || []).filter(r => !(r.trilhaId === trilhaId && r.cursoId === cursoId)));
      return { success: true, error: null };
    }

    const { success, error } = await educacaoService.unlinkCursoFromTrilha(trilhaId, cursoId, userId);
    if (error) throw new Error(error);
    await fetchAllRelacoes();
    return { success, error: null };
  }, [useMock, userId, fetchAllRelacoes]);

  const reorderCursosInTrilhaJunction = useCallback(async (trilhaId, cursoIds) => {
    if (useMock) {
      setTrilhaCursosRel(prev => {
        const others = (prev || []).filter(r => r.trilhaId !== trilhaId);
        const updated = cursoIds.map((cursoId, index) => ({
          id: `${trilhaId}_${cursoId}`,
          trilhaId,
          cursoId,
          ordem: index + 1,
        }));
        return [...others, ...updated];
      });
      return { success: true, error: null };
    }

    const { success, error } = await educacaoService.reorderTrilhaCursos(trilhaId, cursoIds, userId);
    if (error) throw new Error(error);
    await fetchAllRelacoes();
    return { success, error: null };
  }, [useMock, userId, fetchAllRelacoes]);

  // Função para obter cursos de uma trilha usando a junction table
  const getCursosByTrilhaIdFromRel = useCallback((trilhaId) => {
    const rels = trilhaCursosByTrilhaId.get(trilhaId) || [];
    const cursosMap = new Map(cursos.map(c => [c.id, c]));
    return rels
      .map(r => cursosMap.get(r.cursoId))
      .filter(Boolean);
  }, [trilhaCursosByTrilhaId, cursos]);

  // Função para obter trilhas de um curso usando a junction table
  const getTrilhasByCursoIdFromRel = useCallback((cursoId) => {
    const trilhaIds = cursoTrilhasByCursoId.get(cursoId) || [];
    const trilhasMap = new Map(trilhas.map(t => [t.id, t]));
    return trilhaIds
      .map(id => trilhasMap.get(id))
      .filter(Boolean);
  }, [cursoTrilhasByCursoId, trilhas]);

  // ============================================
  // RELAÇÕES CURSO ↔ MÓDULO
  // ============================================

  const linkModuloToCurso = useCallback(async (cursoId, moduloId) => {
    if (useMock) {
      setCursoModulosRel(prev => {
        const current = (prev || []).filter(r => r.cursoId === cursoId);
        if (current.some(r => r.moduloId === moduloId)) return prev;
        const ordem = current.length + 1;
        return [
          ...(prev || []),
          { id: `${cursoId}__${moduloId}`, cursoId, moduloId, ordem },
        ];
      });
      return;
    }

    const { error } = await educacaoService.linkModuloToCurso(cursoId, moduloId, null, userId);
    if (error) throw new Error(error);
    await fetchAllRelacoes();
  }, [useMock, userId, fetchAllRelacoes]);

  const unlinkModuloFromCurso = useCallback(async (cursoId, moduloId) => {
    if (useMock) {
      setCursoModulosRel(prev => (prev || []).filter(r => !(r.cursoId === cursoId && r.moduloId === moduloId)));
      return;
    }

    const { error } = await educacaoService.unlinkModuloFromCurso(cursoId, moduloId, userId);
    if (error) throw new Error(error);
    await fetchAllRelacoes();
  }, [useMock, userId, fetchAllRelacoes]);

  const linkAulaToModulo = useCallback(async (moduloId, aulaId) => {
    if (useMock) {
      setModuloAulasRel(prev => {
        const current = (prev || []).filter(r => r.moduloId === moduloId);
        if (current.some(r => r.aulaId === aulaId)) return prev;
        const ordem = current.length + 1;
        return [
          ...(prev || []),
          { id: `${moduloId}__${aulaId}`, moduloId, aulaId, ordem },
        ];
      });
      return;
    }

    const { error } = await educacaoService.linkAulaToModulo(moduloId, aulaId, null, userId);
    if (error) throw new Error(error);
    await fetchAllRelacoes();
  }, [useMock, userId, fetchAllRelacoes]);

  const unlinkAulaFromModulo = useCallback(async (moduloId, aulaId) => {
    if (useMock) {
      setModuloAulasRel(prev => (prev || []).filter(r => !(r.moduloId === moduloId && r.aulaId === aulaId)));
      return;
    }

    const { error } = await educacaoService.unlinkAulaFromModulo(moduloId, aulaId, userId);
    if (error) throw new Error(error);
    await fetchAllRelacoes();
  }, [useMock, userId, fetchAllRelacoes]);

  // ============================================
  // REORDENAÇÃO
  // ============================================

  const reorderCursosInTrilha = useCallback(async (trilhaId, cursoIds) => {
    if (useMock) {
      setTrilhas(prev => prev.map(t =>
        t.id === trilhaId ? { ...t, cursos: cursoIds, updatedAt: new Date() } : t
      ));
      return;
    }

    try {
      const { success, error } = await educacaoService.reorderCursos(trilhaId, cursoIds, userId);
      if (error) throw new Error(error);
      if (success) await fetchTrilhas();
    } catch (err) {
      console.error('Erro ao reordenar cursos:', err);
      throw err;
    }
  }, [useMock, userId, fetchTrilhas]);

  const reorderModulosInCurso = useCallback(async (cursoId, moduloIds) => {
    if (useMock) {
      setCursoModulosRel(prev => {
        const others = (prev || []).filter(r => r.cursoId !== cursoId);
        const updated = moduloIds.map((moduloId, index) => ({
          id: `${cursoId}__${moduloId}`,
          cursoId,
          moduloId,
          ordem: index + 1,
        }));
        return [...others, ...updated];
      });
      return;
    }

    try {
      const { success, error } = await educacaoService.reorderCursoModulos(cursoId, moduloIds, userId);
      if (error) throw new Error(error);
      if (success) await fetchAllRelacoes();
    } catch (err) {
      console.error('Erro ao reordenar módulos:', err);
      throw err;
    }
  }, [useMock, userId, fetchAllRelacoes]);

  const reorderAulasInModulo = useCallback(async (moduloId, aulaIds) => {
    if (useMock) {
      setModuloAulasRel(prev => {
        const others = (prev || []).filter(r => r.moduloId !== moduloId);
        const updated = aulaIds.map((aulaId, index) => ({
          id: `${moduloId}__${aulaId}`,
          moduloId,
          aulaId,
          ordem: index + 1,
        }));
        return [...others, ...updated];
      });
      return;
    }

    try {
      const { success, error } = await educacaoService.reorderModuloAulas(moduloId, aulaIds, userId);
      if (error) throw new Error(error);
      if (success) await fetchAllRelacoes();
    } catch (err) {
      console.error('Erro ao reordenar aulas:', err);
      throw err;
    }
  }, [useMock, userId, fetchAllRelacoes]);

  // ============================================
  // NAVEGAÇÃO (usando helpers do mockData)
  // ============================================

  const getModulosByCursoId = useCallback((cursoId) => {
    const rels = cursoModulosByCursoId.get(cursoId) || [];
    if (rels.length) {
      const ids = rels.map(r => r.moduloId);
      const byId = new Map((modulos || []).map(m => [m.id, m]));
      return ids.map(id => byId.get(id)).filter(Boolean);
    }
    return getModulosByCurso(cursoId, modulos);
  }, [modulos, cursoModulosByCursoId]);

  const getAulasByModuloId = useCallback((moduloId) => {
    const rels = moduloAulasByModuloId.get(moduloId) || [];
    if (rels.length) {
      const ids = rels.map(r => r.aulaId);
      const byId = new Map((aulas || []).map(a => [a.id, a]));
      return ids.map(id => byId.get(id)).filter(Boolean);
    }
    return getAulasByModulo(moduloId, aulas);
  }, [aulas, moduloAulasByModuloId]);

  const getAulasByCursoId = useCallback((cursoId) => {
    return getAulasByCurso(cursoId, aulas, modulos);
  }, [aulas, modulos]);

  const getAulasByTrilhaId = useCallback((trilhaId) => {
    return getAulasByTrilha(trilhaId, trilhas, cursos, aulas, modulos);
  }, [trilhas, cursos, aulas, modulos]);

  const getCursosByTrilhaId = useCallback((trilhaId) => {
    return getCursosByTrilha(trilhaId, trilhas, cursos);
  }, [trilhas, cursos]);

  // ============================================
  // ESTRUTURA HIERÁRQUICA
  // ============================================

  const contentTree = useMemo(() => {
    const cursosById = new Map((cursosSan || []).map(c => [c.id, c]));
    const modulosById = new Map((modulosSan || []).map(m => [m.id, m]));
    const aulasById = new Map((aulasSan || []).map(a => [a.id, a]));

    return (trilhasSan || []).map((trilha) => {
      // Prefer junction table, fallback to embedded array
      const relsCursos = (trilhaCursosRel || [])
        .filter(r => r.trilhaId === trilha.id)
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      const cursoIds = relsCursos.length
        ? relsCursos.map(r => r.cursoId)
        : (trilha.cursos || []);
      const cursosOrdered = cursoIds
        .map((cid) => cursosById.get(cid))
        .filter(Boolean);

      return {
        ...trilha,
        type: 'trilha',
        children: cursosOrdered.map((curso) => {
          const modulosOrdered = getModulosByCursoId(curso.id)
            .map(m => modulosById.get(m.id) || m)
            .filter(Boolean);

          return {
            ...curso,
            type: 'curso',
            children: modulosOrdered.map((modulo) => {
              const aulasOrdered = getAulasByModuloId(modulo.id)
                .map(a => aulasById.get(a.id) || a)
                .filter(Boolean)
                .filter(a => a.ativo !== false);

              return {
                ...modulo,
                type: 'modulo',
                children: aulasOrdered.map((aula) => ({ ...aula, type: 'aula' })),
              };
            }),
          };
        }),
      };
    });
  }, [trilhasSan, cursosSan, modulosSan, aulasSan, trilhaCursosRel, getModulosByCursoId, getAulasByModuloId]);

  const stats = useMemo(() => {
    return getContentStats(trilhasSan, cursosSan, modulosSan, aulasSan);
  }, [trilhasSan, cursosSan, modulosSan, aulasSan]);

  // ============================================
  // RETURN
  // ============================================

  // Se dentro de Provider, retornar dados compartilhados (evita duplicação)
  if (_ctx) return _ctx;

  return {
    // Estado
    trilhas: trilhasSan,
    cursos: cursosSan,
    modulos: modulosSan,
    aulas: aulasSan,
    loading,
    error,

    // CRUD Trilhas
    addTrilha,
    updateTrilha,
    deleteTrilha,
    getTrilhaById,

    // CRUD Cursos
    addCurso,
    updateCurso,
    deleteCurso,
    getCursoById,

    // CRUD Módulos
    addModulo,
    updateModulo,
    deleteModulo,
    getModuloById,

    // CRUD Aulas
    addAula,
    updateAula,
    deleteAula,
    getAulaById,

    // Reordenação
    reorderCursosInTrilha,
    reorderModulosInCurso,
    reorderAulasInModulo,

    // Navegação
    getModulosByCursoId,
    getAulasByModuloId,
    getAulasByCursoId,
    getAulasByTrilhaId,
    getCursosByTrilhaId,

    // Estrutura
    contentTree,
    stats,

    // Relações Trilha ↔ Curso (N:N junction table)
    trilhaCursosRel,
    trilhaCursosByTrilhaId,
    cursoTrilhasByCursoId,
    linkCursoToTrilha,
    unlinkCursoFromTrilha,
    reorderCursosInTrilhaJunction,
    getCursosByTrilhaIdFromRel,
    getTrilhasByCursoIdFromRel,

    // Relações Curso ↔ Módulo (para UI de vínculo/reuso)
    cursoModulosRel,
    moduloAulasRel,
    linkModuloToCurso,
    unlinkModuloFromCurso,
    linkAulaToModulo,
    unlinkAulaFromModulo,

    // Refetch
    fetchAll,
    forceRefreshFromFirestore,
    fetchTrilhas,
    fetchCursos,
    fetchModulosByCurso,
    fetchAllModulos,
    fetchAllAulas,
    fetchAllRelacoes,

    // Setters diretos (para casos especiais)
    setTrilhas,
    setCursos,
    setModulos,
    setAulas,

    // Config
    useMock,
  };
}

/**
 * Provider que compartilha uma única instância de useEducacaoData entre páginas.
 * Wrap no App.jsx para que navegações internas não re-busquem dados do Firestore.
 */
export function EducacaoDataProvider({ children }) {
  const data = useEducacaoData();
  return createElement(EducacaoDataContext.Provider, { value: data }, children);
}

export default useEducacaoData;

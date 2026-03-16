/**
 * useProgressoUsuario.js
 * Hook para gerenciamento de progresso individual do usuário em educação continuada
 *
 * Funcionalidades:
 * - Buscar progresso em cursos e trilhas
 * - Rastrear aulas assistidas
 * - Calcular estatísticas
 * - Filtrar conteúdo por tipo de usuário
 * - Gerenciar certificados
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useUser } from '../../../contexts/UserContext';
import * as educacaoService from '../../../services/educacaoService';

/**
 * Hook para gerenciamento de progresso do usuário em educação continuada
 * @param {Object} options - Opções do hook
 * @param {boolean} options.autoFetch - Buscar dados automaticamente (default: true)
 * @returns {Object} Estado e funções de progresso
 */
export function useProgressoUsuario({ autoFetch = true } = {}) {
  const { user, userProfile } = useUser();

  // Estado de progresso
  const [progressoCursos, setProgressoCursos] = useState([]);
  const [progressoTrilhas, setProgressoTrilhas] = useState([]);
  const [estatisticas, setEstatisticas] = useState({
    totalPontos: 0,
    totalCursosCompletos: 0,
    totalCertificados: 0,
    horasEstudadas: 0,
    ultimaAtividade: null,
  });
  const [certificados, setCertificados] = useState([]);

  // Estado de conteúdo filtrado
  const [trilhasDisponiveis, setTrilhasDisponiveis] = useState([]);
  const [cursosObrigatorios, setCursosObrigatorios] = useState([]);
  const [cursosOpcionais, setCursosOpcionais] = useState([]);

  // Estado de loading/erro
  const [loading, setLoading] = useState(false);
  const [loadingProgresso, setLoadingProgresso] = useState(false);
  const [loadingTrilhas, setLoadingTrilhas] = useState(false);
  const [error, setError] = useState(null);

  // ID do usuário
  const userId = user?.uid;
  const tipoUsuario = userProfile?.tipoUsuario || userProfile?.role?.toLowerCase();

  // ============================================
  // CARREGAMENTO DE DADOS
  // ============================================

  /**
   * Buscar progresso do usuário em todos os cursos
   */
  const fetchProgressoCursos = useCallback(async () => {
    if (!userId) return;

    setLoadingProgresso(true);
    try {
      const { progressos, error } = await educacaoService.getProgressoUsuario(userId);
      if (error) throw new Error(error);
      setProgressoCursos(progressos);
    } catch (err) {
      console.error('Erro ao buscar progresso:', err);
      setError(err.message);
    } finally {
      setLoadingProgresso(false);
    }
  }, [userId]);

  /**
   * Buscar estatísticas do usuário
   */
  const fetchEstatisticas = useCallback(async () => {
    if (!userId) return;

    try {
      const { estatisticas: stats, error } = await educacaoService.getEstatisticasUsuario(userId);
      if (!error && stats) {
        setEstatisticas(stats);
      }

      // Buscar horas estudadas
      const { horas } = await educacaoService.getHorasEstudadas(userId);
      setEstatisticas(prev => ({ ...prev, horasEstudadas: horas }));

    } catch (err) {
      console.error('Erro ao buscar estatísticas:', err);
    }
  }, [userId]);

  /**
   * Buscar certificados do usuário
   */
  const fetchCertificados = useCallback(async () => {
    if (!userId) return;

    try {
      const { certificados: certs, error } = await educacaoService.getCertificados(userId);
      if (error) throw new Error(error);
      setCertificados(certs);
    } catch (err) {
      console.error('Erro ao buscar certificados:', err);
    }
  }, [userId]);

  /**
   * Buscar trilhas disponíveis para o tipo de usuário
   */
  const fetchTrilhasDisponiveis = useCallback(async () => {
    if (!tipoUsuario) return;

    setLoadingTrilhas(true);
    try {
      const { trilhas, error } = await educacaoService.getTrilhasPorTipoUsuario(tipoUsuario);
      if (error) throw new Error(error);
      setTrilhasDisponiveis(trilhas);
    } catch (err) {
      console.error('Erro ao buscar trilhas:', err);
      setError(err.message);
    } finally {
      setLoadingTrilhas(false);
    }
  }, [tipoUsuario]);

  /**
   * Buscar cursos obrigatórios e opcionais
   */
  const fetchCursos = useCallback(async () => {
    if (!tipoUsuario) return;

    try {
      const [obrigatoriosResult, opcionaisResult] = await Promise.all([
        educacaoService.getCursosObrigatorios(tipoUsuario),
        educacaoService.getCursosOpcionais(tipoUsuario),
      ]);

      if (!obrigatoriosResult.error) {
        setCursosObrigatorios(obrigatoriosResult.cursos);
      }
      if (!opcionaisResult.error) {
        setCursosOpcionais(opcionaisResult.cursos);
      }
    } catch (err) {
      console.error('Erro ao buscar cursos:', err);
    }
  }, [tipoUsuario]);

  /**
   * Buscar todos os dados
   */
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    await Promise.all([
      fetchProgressoCursos(),
      fetchEstatisticas(),
      fetchCertificados(),
      fetchTrilhasDisponiveis(),
      fetchCursos(),
    ]);

    setLoading(false);
  }, [fetchProgressoCursos, fetchEstatisticas, fetchCertificados, fetchTrilhasDisponiveis, fetchCursos]);

  // Carregamento automático
  useEffect(() => {
    if (autoFetch && userId) {
      fetchAll();
    }
  }, [autoFetch, userId, fetchAll]);

  // ============================================
  // OPERAÇÕES DE PROGRESSO
  // ============================================

  /**
   * Iniciar um curso
   */
  const iniciarCurso = useCallback(async (cursoId) => {
    if (!userId) return { success: false, error: 'Usuário não autenticado' };

    try {
      const result = await educacaoService.iniciarCurso(userId, cursoId);
      if (result.success) {
        // Atualizar estado local
        await fetchProgressoCursos();
      }
      return result;
    } catch (err) {
      console.error('Erro ao iniciar curso:', err);
      return { success: false, error: err.message };
    }
  }, [userId, fetchProgressoCursos]);

  /**
   * Marcar aula como assistida
   */
  const marcarAulaAssistida = useCallback(async (cursoId, aulaId, percentual = 100) => {
    if (!userId) return { success: false, error: 'Usuário não autenticado' };

    try {
      const result = await educacaoService.marcarAulaAssistida(userId, cursoId, aulaId, percentual);
      if (result.success) {
        // Atualizar estado local
        await fetchProgressoCursos();
        await fetchEstatisticas();
      }
      return result;
    } catch (err) {
      console.error('Erro ao marcar aula:', err);
      return { success: false, error: err.message };
    }
  }, [userId, fetchProgressoCursos, fetchEstatisticas]);

  /**
   * Concluir módulo
   */
  const concluirModulo = useCallback(async (cursoId, moduloId, totalModulos, pontos = 2.0) => {
    if (!userId) return { success: false, error: 'Usuário não autenticado' };

    try {
      const result = await educacaoService.concluirModulo(userId, cursoId, moduloId, totalModulos, pontos);
      if (result.success) {
        await fetchProgressoCursos();
        await fetchEstatisticas();

        // Se curso foi concluído, buscar certificados atualizados
        if (result.isConcluido) {
          await fetchCertificados();
        }
      }
      return result;
    } catch (err) {
      console.error('Erro ao concluir módulo:', err);
      return { success: false, error: err.message };
    }
  }, [userId, fetchProgressoCursos, fetchEstatisticas, fetchCertificados]);

  /**
   * Concluir curso manualmente (geralmente via admin)
   */
  const concluirCurso = useCallback(async (cursoId, pontos = 0) => {
    if (!userId) return { success: false, error: 'Usuário não autenticado' };

    try {
      const result = await educacaoService.concluirCurso(userId, cursoId, pontos);
      if (result.success) {
        await fetchProgressoCursos();
        await fetchEstatisticas();
        await fetchCertificados();
      }
      return result;
    } catch (err) {
      console.error('Erro ao concluir curso:', err);
      return { success: false, error: err.message };
    }
  }, [userId, fetchProgressoCursos, fetchEstatisticas, fetchCertificados]);

  // ============================================
  // HELPERS E COMPUTED VALUES
  // ============================================

  /**
   * Obter progresso de um curso específico
   */
  const getProgressoCurso = useCallback((cursoId) => {
    return progressoCursos.find(p => p.cursoId === cursoId) || null;
  }, [progressoCursos]);

  /**
   * Verificar se curso está concluído
   * Considers quiz requirement: if avaliacaoObrigatoria, course is only
   * truly "completed" when quizResult.aprovado is true.
   */
  const isCursoConcluido = useCallback((cursoId, cursoData = null) => {
    const progresso = getProgressoCurso(cursoId);
    if (!progresso) return false;
    const statusOk = progresso.status === 'concluido' || progresso.status === 'aprovado';
    if (!statusOk) return false;
    // If the course requires a quiz, check quiz approval
    if (cursoData?.avaliacaoObrigatoria) {
      return progresso.quizResult?.aprovado === true;
    }
    return true;
  }, [getProgressoCurso]);

  /**
   * Verificar se curso está em andamento
   */
  const isCursoEmAndamento = useCallback((cursoId) => {
    const progresso = getProgressoCurso(cursoId);
    return progresso?.status === 'em_andamento';
  }, [getProgressoCurso]);

  /**
   * Obter percentual de progresso de um curso
   */
  const getPercentualCurso = useCallback((cursoId) => {
    const progresso = getProgressoCurso(cursoId);
    return progresso?.progresso || 0;
  }, [getProgressoCurso]);

  /**
   * Verificar se aula foi assistida
   */
  const isAulaAssistida = useCallback((cursoId, aulaId) => {
    const progresso = getProgressoCurso(cursoId);
    if (!progresso?.aulasAssistidas) return false;

    return progresso.aulasAssistidas.some(a =>
      typeof a === 'string' ? a === aulaId : a.aulaId === aulaId
    );
  }, [getProgressoCurso]);

  /**
   * Calcular progresso de uma trilha
   */
  const getProgressoTrilha = useCallback((trilhaId) => {
    const trilha = trilhasDisponiveis.find(t => t.id === trilhaId);
    if (!trilha || !trilha.cursos || trilha.cursos.length === 0) return 0;

    let totalProgresso = 0;
    trilha.cursos.forEach(cursoId => {
      totalProgresso += getPercentualCurso(cursoId);
    });

    return Math.round(totalProgresso / trilha.cursos.length);
  }, [trilhasDisponiveis, getPercentualCurso]);

  /**
   * Verificar se trilha está concluída
   */
  const isTrilhaConcluida = useCallback((trilhaId) => {
    const trilha = trilhasDisponiveis.find(t => t.id === trilhaId);
    if (!trilha || !trilha.cursos) return false;

    return trilha.cursos.every(cursoId => isCursoConcluido(cursoId));
  }, [trilhasDisponiveis, isCursoConcluido]);

  /**
   * Trilhas obrigatórias pendentes
   */
  const trilhasPendentes = useMemo(() => {
    return trilhasDisponiveis.filter(t => t.obrigatoria && !isTrilhaConcluida(t.id));
  }, [trilhasDisponiveis, isTrilhaConcluida]);

  /**
   * Cursos em andamento
   */
  const cursosEmAndamento = useMemo(() => {
    return progressoCursos.filter(p => p.status === 'em_andamento');
  }, [progressoCursos]);

  /**
   * Cursos concluídos
   */
  const cursosConcluidos = useMemo(() => {
    return progressoCursos.filter(p => p.status === 'concluido');
  }, [progressoCursos]);

  /**
   * Verificar se usuário está em dia com obrigatórios
   */
  const isEmDiaComObrigatorios = useMemo(() => {
    return trilhasPendentes.length === 0;
  }, [trilhasPendentes]);

  // ============================================
  // RETURN
  // ============================================

  return {
    // Estado
    progressoCursos,
    progressoTrilhas,
    estatisticas,
    certificados,

    // Conteúdo filtrado
    trilhasDisponiveis,
    cursosObrigatorios,
    cursosOpcionais,

    // Loading/Erro
    loading,
    loadingProgresso,
    loadingTrilhas,
    error,

    // Operações
    iniciarCurso,
    marcarAulaAssistida,
    concluirModulo,
    concluirCurso,

    // Refetch
    fetchAll,
    fetchProgressoCursos,
    fetchEstatisticas,
    fetchCertificados,
    fetchTrilhasDisponiveis,
    fetchCursos,

    // Helpers
    getProgressoCurso,
    getPercentualCurso,
    getProgressoTrilha,
    isCursoConcluido,
    isCursoEmAndamento,
    isTrilhaConcluida,
    isAulaAssistida,

    // Computed
    trilhasPendentes,
    cursosEmAndamento,
    cursosConcluidos,
    isEmDiaComObrigatorios,

    // Info do usuário
    userId,
    tipoUsuario,
  };
}

export default useProgressoUsuario;

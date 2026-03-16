/**
 * useEducacao Hook
 * Hook para gerenciar dados de educacao continuada
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useUser } from '../contexts/UserContext';
import {
  getCursos,
  getCursoById,
  getProgressoUsuario,
  iniciarCurso,
  atualizarProgresso,
  concluirModulo,
  getCertificados,
  emitirCertificado,
  getCategorias,
} from '../services/educacaoService';
import {
  mockCategorias,
} from '../pages/educacao/data/educacaoUtils';
// Lazy import to avoid circular dependency at module init time
const getMessagesService = () => import('../services/supabaseMessagesService').then(m => m.default);

/**
 * Hook para gerenciar dados de educacao continuada
 * @returns {Object} - Dados e funcoes para gerenciar educacao
 */
export function useEducacao() {
  const { user, firebaseUser } = useUser();

  // Estado dos cursos
  const [cursos, setCursos] = useState([]);
  const [cursosLoading, setCursosLoading] = useState(true);
  const [cursosError, setCursosError] = useState(null);
  const [usandoMock, setUsandoMock] = useState(true);

  // Estado do progresso
  const [progressos, setProgressos] = useState([]);
  const [progressosLoading, setProgressosLoading] = useState(true);

  // Estado dos certificados
  const [certificados, setCertificados] = useState([]);
  const [certificadosLoading, setCertificadosLoading] = useState(true);

  // Estado das categorias
  const [categorias, setCategorias] = useState([]);

  // Estados de operacao
  const [iniciandoCurso, setIniciandoCurso] = useState(false);
  const [atualizandoProgresso, setAtualizandoProgresso] = useState(false);
  const [emitindoCertificado, setEmitindoCertificado] = useState(false);

  // Buscar cursos do Firestore
  const fetchCursos = useCallback(async () => {
    setCursosLoading(true);
    setCursosError(null);

    try {
      const { cursos: data, error } = await getCursos();

      if (error) {
        console.warn('Erro ao buscar cursos, usando mock:', error);
        setCursos([]);
        setUsandoMock(true);
        setCursosError(error);
      } else if (data && data.length > 0) {
        setCursos(data);
        setUsandoMock(false);
      } else {
        // Sem dados no Firestore, usar mock
        setCursos([]);
        setUsandoMock(true);
      }
    } catch (err) {
      console.error('Erro ao buscar cursos:', err);
      setCursos([]);
      setUsandoMock(true);
      setCursosError(err.message);
    } finally {
      setCursosLoading(false);
    }
  }, []);

  // Buscar progresso do usuario
  const fetchProgresso = useCallback(async () => {
    if (!firebaseUser?.uid) {
      setProgressos([]);
      setProgressosLoading(false);
      return;
    }

    setProgressosLoading(true);

    try {
      const { progressos: data, error } = await getProgressoUsuario(firebaseUser.uid);

      if (error || data.length === 0) {
        // Usar mock se erro ou sem dados
        setProgressos([]);
      } else {
        setProgressos(data);
      }
    } catch (err) {
      console.error('Erro ao buscar progresso:', err);
      setProgressos([]);
    } finally {
      setProgressosLoading(false);
    }
  }, [firebaseUser?.uid]);

  // Buscar certificados do usuario
  const fetchCertificados = useCallback(async () => {
    if (!firebaseUser?.uid) {
      setCertificados([]);
      setCertificadosLoading(false);
      return;
    }

    setCertificadosLoading(true);

    try {
      const { certificados: data, error } = await getCertificados(firebaseUser.uid);

      if (error || data.length === 0) {
        // Usar mock se erro ou sem dados
        setCertificados([]);
      } else {
        setCertificados(data);
      }
    } catch (err) {
      console.error('Erro ao buscar certificados:', err);
      setCertificados([]);
    } finally {
      setCertificadosLoading(false);
    }
  }, [firebaseUser?.uid]);

  // Buscar categorias
  const fetchCategorias = useCallback(async () => {
    try {
      const { categorias: data, error } = await getCategorias();

      if (error || data.length === 0) {
        setCategorias(mockCategorias);
      } else {
        setCategorias(data);
      }
    } catch (err) {
      console.error('Erro ao buscar categorias:', err);
      setCategorias(mockCategorias);
    }
  }, []);

  // Carregar dados na montagem
  useEffect(() => {
    fetchCursos();
    fetchCategorias();
  }, [fetchCursos, fetchCategorias]);

  useEffect(() => {
    fetchProgresso();
    fetchCertificados();
  }, [fetchProgresso, fetchCertificados]);

  // Combinar cursos com progresso
  const cursosComProgresso = useMemo(() => {
    return cursos.map(curso => {
      const progresso = progressos.find(p => p.cursoId === curso.id);
      return {
        ...curso,
        progresso: progresso?.progresso || 0,
        status: progresso?.status || 'nao_iniciado',
        progressoId: progresso?.id || null,
        modulosCompletos: progresso?.modulosCompletos || [],
        dataInicio: progresso?.dataInicio || null,
        dataConclusao: progresso?.dataConclusao || null,
        pontos: progresso?.pontos || 0,
      };
    });
  }, [cursos, progressos]);

  // Check for approaching course deadlines
  useEffect(() => {
    if (!firebaseUser?.uid || cursosComProgresso.length === 0) return;

    const now = new Date();
    cursosComProgresso.forEach(curso => {
      if (curso.status === 'concluido' || curso.status === 'aprovado') return;
      const deadline = curso.dataLimiteConclusao || curso.dataValidade;
      if (!deadline) return;

      const deadlineDate = new Date(deadline);
      const daysLeft = Math.ceil((deadlineDate - now) / (1000 * 60 * 60 * 24));
      if (daysLeft > 7 || daysLeft < 0) return;

      // Dedup: check localStorage
      const storageKey = `curso_deadline_notified_${curso.id}_${deadlineDate.toISOString().slice(0, 10)}`;
      if (localStorage.getItem(storageKey)) return;

      getMessagesService().then(svc => svc.createNotification({
        recipientId: firebaseUser.uid,
        category: 'educacao',
        subject: `Prazo se aproxima: ${curso.titulo}`,
        content: `Faltam ${daysLeft} dias para concluir o curso obrigatório "${curso.titulo}"`,
        senderName: 'Educação Continuada',
        priority: daysLeft <= 3 ? 'urgente' : 'alta',
        actionUrl: 'educacao',
        actionLabel: 'Continuar Curso',
      })).catch(err => console.error('[useEducacao] Deadline notification error:', err));

      localStorage.setItem(storageKey, 'true');
    });
  }, [firebaseUser?.uid, cursosComProgresso]);

  // Contar status
  const statusCounts = useMemo(() => ({
    nao_iniciado: cursosComProgresso.filter(c => c.status === 'nao_iniciado').length,
    em_andamento: cursosComProgresso.filter(c => c.status === 'em_andamento').length,
    concluido: cursosComProgresso.filter(c => c.status === 'concluido').length,
    aprovado: cursosComProgresso.filter(c => c.status === 'aprovado').length,
    reprovado: cursosComProgresso.filter(c => c.status === 'reprovado').length,
    expirado: cursosComProgresso.filter(c => c.status === 'expirado').length,
  }), [cursosComProgresso]);

  // Calcular pontos totais
  const pontosTotais = useMemo(() => {
    return cursosComProgresso
      .filter(c => c.status === 'concluido' || c.status === 'aprovado')
      .reduce((sum, c) => sum + (c.pontos || c.pontosAoCompletar || 0), 0);
  }, [cursosComProgresso]);

  // Buscar curso por ID
  const getCurso = useCallback((cursoId) => {
    return cursosComProgresso.find(c => c.id === cursoId) || null;
  }, [cursosComProgresso]);

  // Iniciar curso
  const handleIniciarCurso = useCallback(async (cursoId) => {
    if (!firebaseUser?.uid) {
      return { success: false, error: 'Usuário não autenticado' };
    }

    setIniciandoCurso(true);

    try {
      const { success, error } = await iniciarCurso(firebaseUser.uid, cursoId);

      if (success) {
        await fetchProgresso();
        return { success: true, error: null };
      }
      return { success: false, error };
    } catch (err) {
      return { success: false, error: err.message };
    } finally {
      setIniciandoCurso(false);
    }
  }, [firebaseUser?.uid, fetchProgresso]);

  // Concluir modulo
  const handleConcluirModulo = useCallback(async (cursoId, moduloId) => {
    if (!firebaseUser?.uid) {
      return { success: false, error: 'Usuário não autenticado' };
    }

    const curso = cursos.find(c => c.id === cursoId);
    if (!curso) {
      return { success: false, error: 'Curso não encontrado' };
    }

    setAtualizandoProgresso(true);

    try {
      const totalModulos = curso.modulos?.length || 1;
      const { success, error } = await concluirModulo(
        firebaseUser.uid,
        cursoId,
        moduloId,
        totalModulos
      );

      if (success) {
        await fetchProgresso();

        // Check if course is now 100% complete
        const updatedCurso = cursosComProgresso.find(c => c.id === cursoId);
        const completedCount = (updatedCurso?.modulosCompletos?.length || 0) + 1; // +1 for just-completed
        if (completedCount >= totalModulos) {
          // Course completed — fire-and-forget notification
          getMessagesService().then(svc => svc.createNotification({
            recipientId: firebaseUser.uid,
            category: 'educacao',
            subject: 'Curso concluído!',
            content: `Parabéns! Você concluiu o curso "${curso.titulo}"`,
            senderName: 'Educação Continuada',
            priority: 'normal',
            actionUrl: 'educacao',
            actionLabel: 'Ver Certificado',
          })).catch(err => console.error('[useEducacao] Notification error:', err));
        }

        return { success: true, error: null };
      }
      return { success: false, error };
    } catch (err) {
      return { success: false, error: err.message };
    } finally {
      setAtualizandoProgresso(false);
    }
  }, [firebaseUser?.uid, cursos, fetchProgresso]);

  // Emitir certificado
  const handleEmitirCertificado = useCallback(async (cursoId) => {
    if (!firebaseUser?.uid) {
      return { success: false, error: 'Usuário não autenticado' };
    }

    const curso = cursosComProgresso.find(c => c.id === cursoId);
    if (!curso) {
      return { success: false, error: 'Curso não encontrado' };
    }

    if (curso.status !== 'concluido' && curso.status !== 'aprovado') {
      return { success: false, error: 'Curso não concluído' };
    }

    setEmitindoCertificado(true);

    try {
      const { certificado, error } = await emitirCertificado(
        firebaseUser.uid,
        curso,
        curso.dataConclusao
      );

      if (certificado) {
        await fetchCertificados();

        // Notify about certificate availability
        getMessagesService().then(svc => svc.createNotification({
          recipientId: firebaseUser.uid,
          category: 'educacao',
          subject: 'Certificado disponível',
          content: `Seu certificado do curso "${curso.titulo}" está pronto para download`,
          senderName: 'Educação Continuada',
          priority: 'normal',
          actionUrl: 'educacao',
          actionLabel: 'Ver Certificado',
        })).catch(err => console.error('[useEducacao] Notification error:', err));

        return { success: true, certificado, error: null };
      }
      return { success: false, error };
    } catch (err) {
      return { success: false, error: err.message };
    } finally {
      setEmitindoCertificado(false);
    }
  }, [firebaseUser?.uid, cursosComProgresso, fetchCertificados]);

  // Certificados pendentes (cursos concluidos sem certificado emitido)
  const certificadosPendentes = useMemo(() => {
    const cursosConcluidosIds = cursosComProgresso
      .filter(c => c.status === 'concluido' || c.status === 'aprovado')
      .map(c => c.id);

    const certificadosEmitidosIds = certificados
      .filter(c => c.emitido)
      .map(c => c.cursoId);

    return cursosComProgresso
      .filter(c => cursosConcluidosIds.includes(c.id) && !certificadosEmitidosIds.includes(c.id));
  }, [cursosComProgresso, certificados]);

  // Certificados emitidos
  const certificadosEmitidos = useMemo(() => {
    return certificados.filter(c => c.emitido);
  }, [certificados]);

  // Extrato de pontos
  const pontosExtrato = useMemo(() => {
    return cursosComProgresso
      .filter(c => c.status === 'concluido' || c.status === 'aprovado')
      .map(c => ({
        id: c.id,
        cursoTitulo: c.titulo,
        pontos: c.pontos || c.pontosAoCompletar || 0,
        dataConclusao: c.dataConclusao,
      }));
  }, [cursosComProgresso]);

  return {
    // Cursos
    cursos,
    cursosComProgresso,
    cursosLoading,
    cursosError,
    usandoMock,
    getCurso,
    fetchCursos,

    // Categorias
    categorias,

    // Status
    statusCounts,
    pontosTotais,

    // Progresso
    progressos,
    progressosLoading,
    handleIniciarCurso,
    handleConcluirModulo,
    iniciandoCurso,
    atualizandoProgresso,

    // Certificados
    certificados,
    certificadosLoading,
    certificadosPendentes,
    certificadosEmitidos,
    handleEmitirCertificado,
    emitindoCertificado,
    fetchCertificados,

    // Pontos
    pontosExtrato,

    // Loading geral
    loading: cursosLoading || progressosLoading,
  };
}

export default useEducacao;

/**
 * FaturamentoContext
 * Gerencia estado global do módulo de faturamento
 * TODO: Implementar supabaseFaturamentoService e remover mock data
 */
import { createContext, useContext, useState, useCallback, useRef } from 'react';
import {
  MOCK_CONVENIOS,
  MOCK_HOSPITAIS,
  MOCK_CIRURGIOES,
  MOCK_ANESTESISTAS,
  MOCK_EVENTOS,
  MOCK_NOTAS,
  MOCK_LOTES,
  MOCK_STATS,
} from '../data/mockFaturamento';

const FaturamentoContext = createContext(null);

// MOCK MANTIDO — modulo faturamento ainda nao planejado (decisao 21/02/2026)
// TODO: Replace with supabaseFaturamentoService when faturamento module is implemented
const USE_MOCK = true;

export function FaturamentoProvider({ children, forceMock = false }) {
  const useMock = USE_MOCK || forceMock;
  const useMockRef = useRef(useMock);
  useMockRef.current = useMock;

  // Estados principais
  const [eventos, setEventos] = useState(useMock ? MOCK_EVENTOS : []);
  const [notas, setNotas] = useState(useMock ? MOCK_NOTAS : []);
  const [lotes, setLotes] = useState(useMock ? MOCK_LOTES : []);
  const [convenios, setConvenios] = useState(useMock ? MOCK_CONVENIOS : []);
  const [hospitais, setHospitais] = useState(useMock ? MOCK_HOSPITAIS : []);
  const [cirurgioes, setCirurgioes] = useState(useMock ? MOCK_CIRURGIOES : []);
  const [anestesistas, setAnestesistas] = useState(useMock ? MOCK_ANESTESISTAS : []);
  const [stats, setStats] = useState(useMock ? MOCK_STATS : null);

  // Estados de carregamento
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filtros ativos
  const [filters, setFilters] = useState({
    status: 'all',
    convenio: 'all',
    hospital: 'all',
    anestesista: 'all',
    periodo: 'mes',
    dataInicio: null,
    dataFim: null,
  });

  // ============================================================================
  // EVENTOS
  // ============================================================================

  const fetchEventos = useCallback(async (customFilters = {}) => {
    if (useMockRef.current) {
      // Aplicar filtros no mock
      let filtered = [...MOCK_EVENTOS];
      const activeFilters = { ...filters, ...customFilters };

      if (activeFilters.status !== 'all') {
        filtered = filtered.filter(e => e.status === activeFilters.status);
      }
      if (activeFilters.convenio !== 'all') {
        filtered = filtered.filter(e => e.healthInsuranceId === activeFilters.convenio);
      }
      if (activeFilters.hospital !== 'all') {
        filtered = filtered.filter(e => e.hospitalId === activeFilters.hospital);
      }
      if (activeFilters.anestesista !== 'all') {
        filtered = filtered.filter(e => e.anesthesiologistId === activeFilters.anestesista);
      }

      setEventos(filtered);
      return filtered;
    }

    setLoading(true);
    try {
      // TODO: Implementar busca no Firebase
      setLoading(false);
      return eventos;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      return [];
    }
  }, [filters, eventos]);

  const createEvento = useCallback(async (eventoData) => {
    if (useMockRef.current) {
      const newEvento = {
        ...eventoData,
        id: `evt-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: eventoData.status || 'rascunho',
      };
      setEventos(prev => [newEvento, ...prev]);
      return { success: true, evento: newEvento };
    }

    try {
      // TODO: Implementar criação no Firebase
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  const updateEvento = useCallback(async (eventoId, updates) => {
    if (useMockRef.current) {
      setEventos(prev => prev.map(e =>
        e.id === eventoId ? { ...e, ...updates, updatedAt: new Date() } : e
      ));
      return { success: true };
    }

    try {
      // TODO: Implementar atualização no Firebase
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  const deleteEvento = useCallback(async (eventoId) => {
    if (useMockRef.current) {
      setEventos(prev => prev.filter(e => e.id !== eventoId));
      return { success: true };
    }

    try {
      // TODO: Implementar deleção no Firebase
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  // ============================================================================
  // NOTAS FISCAIS
  // ============================================================================

  const fetchNotas = useCallback(async (customFilters = {}) => {
    if (useMockRef.current) {
      setNotas(MOCK_NOTAS);
      return MOCK_NOTAS;
    }

    setLoading(true);
    try {
      // TODO: Implementar busca no Firebase
      setLoading(false);
      return notas;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      return [];
    }
  }, [notas]);

  const createNota = useCallback(async (notaData) => {
    if (useMockRef.current) {
      const newNota = {
        ...notaData,
        id: `nf-${Date.now()}`,
        createdAt: new Date(),
        status: 'emitida',
      };
      setNotas(prev => [newNota, ...prev]);

      // Atualizar eventos incluídos na nota
      if (notaData.events?.length > 0) {
        setEventos(prev => prev.map(e =>
          notaData.events.includes(e.id)
            ? { ...e, status: 'faturado', invoiceId: newNota.id, updatedAt: new Date() }
            : e
        ));
      }

      return { success: true, nota: newNota };
    }

    try {
      // TODO: Implementar criação no Firebase
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  // ============================================================================
  // LOTES
  // ============================================================================

  const fetchLotes = useCallback(async () => {
    if (useMockRef.current) {
      setLotes(MOCK_LOTES);
      return MOCK_LOTES;
    }

    setLoading(true);
    try {
      // TODO: Implementar busca no Firebase
      setLoading(false);
      return lotes;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      return [];
    }
  }, [lotes]);

  const createLote = useCallback(async (loteData) => {
    if (useMockRef.current) {
      const newLote = {
        ...loteData,
        id: `lote-${Date.now()}`,
        createdAt: new Date(),
        status: 'aberto',
      };
      setLotes(prev => [newLote, ...prev]);

      // Atualizar notas incluídas no lote
      if (loteData.invoices?.length > 0) {
        setNotas(prev => prev.map(n =>
          loteData.invoices.includes(n.id)
            ? { ...n, batchId: newLote.id }
            : n
        ));
      }

      return { success: true, lote: newLote };
    }

    try {
      // TODO: Implementar criação no Firebase
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  // ============================================================================
  // CADASTROS
  // ============================================================================

  const fetchConvenios = useCallback(async () => {
    if (useMockRef.current) {
      setConvenios(MOCK_CONVENIOS);
      return MOCK_CONVENIOS;
    }
    // TODO: Firebase
    return convenios;
  }, [convenios]);

  const createConvenio = useCallback(async (convenioData) => {
    if (useMockRef.current) {
      const newConvenio = {
        ...convenioData,
        id: `conv-${Date.now()}`,
        createdAt: new Date(),
        active: true,
      };
      setConvenios(prev => [newConvenio, ...prev]);
      return { success: true, convenio: newConvenio };
    }
    // TODO: Firebase
    return { success: false, error: 'Não implementado' };
  }, []);

  const updateConvenio = useCallback(async (convenioId, updates) => {
    if (useMockRef.current) {
      setConvenios(prev => prev.map(c =>
        c.id === convenioId ? { ...c, ...updates } : c
      ));
      return { success: true };
    }
    // TODO: Firebase
    return { success: false, error: 'Não implementado' };
  }, []);

  const fetchHospitais = useCallback(async () => {
    if (useMockRef.current) {
      setHospitais(MOCK_HOSPITAIS);
      return MOCK_HOSPITAIS;
    }
    return hospitais;
  }, [hospitais]);

  const fetchCirurgioes = useCallback(async () => {
    if (useMockRef.current) {
      setCirurgioes(MOCK_CIRURGIOES);
      return MOCK_CIRURGIOES;
    }
    return cirurgioes;
  }, [cirurgioes]);

  const fetchAnestesistas = useCallback(async () => {
    if (useMockRef.current) {
      setAnestesistas(MOCK_ANESTESISTAS);
      return MOCK_ANESTESISTAS;
    }
    return anestesistas;
  }, [anestesistas]);

  // ============================================================================
  // ESTATÍSTICAS
  // ============================================================================

  const fetchStats = useCallback(async () => {
    if (useMockRef.current) {
      setStats(MOCK_STATS);
      return MOCK_STATS;
    }

    try {
      // TODO: Calcular estatísticas do Firebase
      return stats;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, [stats]);

  // ============================================================================
  // UTILIDADES
  // ============================================================================

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const getConvenioById = useCallback((id) => {
    return convenios.find(c => c.id === id);
  }, [convenios]);

  const getHospitalById = useCallback((id) => {
    return hospitais.find(h => h.id === id);
  }, [hospitais]);

  const getAnestesistaById = useCallback((id) => {
    return anestesistas.find(a => a.id === id);
  }, [anestesistas]);

  const getCirurgiaoById = useCallback((id) => {
    return cirurgioes.find(c => c.id === id);
  }, [cirurgioes]);

  const value = {
    // Dados
    eventos,
    notas,
    lotes,
    convenios,
    hospitais,
    cirurgioes,
    anestesistas,
    stats,

    // Estado
    loading,
    error,
    filters,
    useMock: useMockRef.current,

    // Eventos
    fetchEventos,
    createEvento,
    updateEvento,
    deleteEvento,

    // Notas
    fetchNotas,
    createNota,

    // Lotes
    fetchLotes,
    createLote,

    // Cadastros
    fetchConvenios,
    createConvenio,
    updateConvenio,
    fetchHospitais,
    fetchCirurgioes,
    fetchAnestesistas,

    // Estatísticas
    fetchStats,

    // Utilidades
    clearError,
    updateFilters,
    getConvenioById,
    getHospitalById,
    getAnestesistaById,
    getCirurgiaoById,
  };

  return (
    <FaturamentoContext.Provider value={value}>
      {children}
    </FaturamentoContext.Provider>
  );
}

export const useFaturamento = () => {
  const context = useContext(FaturamentoContext);
  if (!context) {
    throw new Error('useFaturamento deve ser usado dentro de um FaturamentoProvider');
  }
  return context;
};

export default FaturamentoContext;

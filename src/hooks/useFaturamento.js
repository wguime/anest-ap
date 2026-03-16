/**
 * Hooks para o módulo de Faturamento
 * Custom hooks que encapsulam lógica de estado e efeitos
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useFaturamento as useFaturamentoContext } from '../contexts/FaturamentoContext';
import { calcularValorEvento, formatarMoeda, getCorStatus } from '../data/cbhpmData';

// ============================================================================
// useEventos - Hook para listagem e manipulação de eventos
// ============================================================================

export function useEventos(initialFilters = {}) {
  const {
    eventos,
    fetchEventos,
    createEvento,
    updateEvento,
    deleteEvento,
    loading,
    convenios,
  } = useFaturamentoContext();

  const [filters, setFilters] = useState({
    status: 'all',
    convenio: 'all',
    search: '',
    ...initialFilters,
  });

  // Buscar eventos quando filtros mudam
  useEffect(() => {
    fetchEventos(filters);
  }, [filters, fetchEventos]);

  // Eventos filtrados por busca local
  const eventosFiltrados = useMemo(() => {
    if (!filters.search) return eventos;

    const searchLower = filters.search.toLowerCase();
    return eventos.filter(
      e =>
        e.patientName?.toLowerCase().includes(searchLower) ||
        e.procedureDescription?.toLowerCase().includes(searchLower) ||
        e.healthInsuranceName?.toLowerCase().includes(searchLower)
    );
  }, [eventos, filters.search]);

  // Agrupar por status
  const eventosPorStatus = useMemo(() => {
    const grupos = {
      rascunho: [],
      pendente: [],
      aprovado: [],
      faturado: [],
      pago: [],
      glosado: [],
    };

    eventosFiltrados.forEach(e => {
      if (grupos[e.status]) {
        grupos[e.status].push(e);
      }
    });

    return grupos;
  }, [eventosFiltrados]);

  // Totais por status
  const totais = useMemo(() => {
    const result = {};
    Object.keys(eventosPorStatus).forEach(status => {
      result[status] = {
        count: eventosPorStatus[status].length,
        valor: eventosPorStatus[status].reduce((sum, e) => sum + (e.finalValue || 0), 0),
      };
    });
    return result;
  }, [eventosPorStatus]);

  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  return {
    eventos: eventosFiltrados,
    eventosPorStatus,
    totais,
    filters,
    updateFilters,
    loading,
    createEvento,
    updateEvento,
    deleteEvento,
    refetch: () => fetchEventos(filters),
  };
}

// ============================================================================
// useEvento - Hook para evento individual
// ============================================================================

export function useEvento(eventoId) {
  const { eventos, updateEvento, loading } = useFaturamentoContext();

  const evento = useMemo(() => {
    return eventos.find(e => e.id === eventoId) || null;
  }, [eventos, eventoId]);

  const update = useCallback(async (updates) => {
    if (!eventoId) return { success: false, error: 'ID do evento não fornecido' };
    return updateEvento(eventoId, updates);
  }, [eventoId, updateEvento]);

  return {
    evento,
    loading,
    updateEvento: update,
  };
}

// ============================================================================
// useNotas - Hook para notas fiscais
// ============================================================================

export function useNotas(initialFilters = {}) {
  const { notas, fetchNotas, createNota, loading } = useFaturamentoContext();

  const [filters, setFilters] = useState({
    status: 'all',
    convenio: 'all',
    ...initialFilters,
  });

  useEffect(() => {
    fetchNotas(filters);
  }, [filters, fetchNotas]);

  // Notas por status
  const notasPorStatus = useMemo(() => {
    const grupos = {
      emitida: [],
      enviada: [],
      paga: [],
      glosada: [],
    };

    notas.forEach(n => {
      if (grupos[n.status]) {
        grupos[n.status].push(n);
      }
    });

    return grupos;
  }, [notas]);

  // Totais
  const totais = useMemo(() => {
    return {
      total: notas.length,
      valor: notas.reduce((sum, n) => sum + (n.totalValue || 0), 0),
      pendente: notasPorStatus.emitida.length + notasPorStatus.enviada.length,
      valorPendente: [...notasPorStatus.emitida, ...notasPorStatus.enviada].reduce(
        (sum, n) => sum + (n.totalValue || 0),
        0
      ),
    };
  }, [notas, notasPorStatus]);

  return {
    notas,
    notasPorStatus,
    totais,
    filters,
    updateFilters: (newFilters) => setFilters(prev => ({ ...prev, ...newFilters })),
    loading,
    createNota,
    refetch: () => fetchNotas(filters),
  };
}

// ============================================================================
// useLotes - Hook para lotes
// ============================================================================

export function useLotes(initialFilters = {}) {
  const { lotes, fetchLotes, createLote, loading } = useFaturamentoContext();

  const [filters, setFilters] = useState({
    status: 'all',
    ...initialFilters,
  });

  useEffect(() => {
    fetchLotes(filters);
  }, [filters, fetchLotes]);

  // Lotes por status
  const lotesPorStatus = useMemo(() => {
    const grupos = {
      aberto: [],
      fechado: [],
      enviado: [],
      processado: [],
    };

    lotes.forEach(l => {
      if (grupos[l.status]) {
        grupos[l.status].push(l);
      }
    });

    return grupos;
  }, [lotes]);

  return {
    lotes,
    lotesPorStatus,
    filters,
    updateFilters: (newFilters) => setFilters(prev => ({ ...prev, ...newFilters })),
    loading,
    createLote,
    refetch: () => fetchLotes(filters),
  };
}

// ============================================================================
// useFaturamentoStats - Hook para estatísticas
// ============================================================================

export function useFaturamentoStats() {
  const { stats, fetchStats, loading } = useFaturamentoContext();
  const [periodo, setPeriodo] = useState('mes');

  useEffect(() => {
    fetchStats(periodo);
  }, [periodo, fetchStats]);

  // Calcular variações e percentuais
  const statsCalculados = useMemo(() => {
    if (!stats) return null;

    return {
      ...stats,
      // Taxa de conversão
      taxaConversao: stats.produzido?.mes > 0
        ? ((stats.recebido?.mes / stats.produzido?.mes) * 100).toFixed(1)
        : 0,
      // Formatação
      produzidoFormatado: formatarMoeda(stats.produzido?.mes),
      recebidoFormatado: formatarMoeda(stats.recebido?.mes),
      glosasFormatado: formatarMoeda(stats.glosas?.mes),
      overFormatado: formatarMoeda(stats.over?.mes),
    };
  }, [stats]);

  return {
    stats: statsCalculados,
    periodo,
    setPeriodo,
    loading,
    refetch: () => fetchStats(periodo),
  };
}

// ============================================================================
// useCalculoValores - Hook para cálculo de valores
// ============================================================================

export function useCalculoValores() {
  const { convenios, getConvenioById } = useFaturamentoContext();

  /**
   * Calcular valor de um evento baseado no porte e convênio
   */
  const calcularValor = useCallback((codigoPorte, convenioId) => {
    const convenio = getConvenioById(convenioId);
    return calcularValorEvento(codigoPorte, convenio);
  }, [getConvenioById]);

  /**
   * Calcular total de uma lista de eventos
   */
  const calcularTotal = useCallback((eventos) => {
    return eventos.reduce((sum, e) => sum + (e.finalValue || 0), 0);
  }, []);

  /**
   * Calcular totais por convênio
   */
  const totaisPorConvenio = useCallback((eventos) => {
    const totais = {};

    eventos.forEach(e => {
      const convenioId = e.healthInsuranceId;
      if (!totais[convenioId]) {
        totais[convenioId] = {
          convenioId,
          convenioName: e.healthInsuranceName,
          count: 0,
          valor: 0,
        };
      }
      totais[convenioId].count++;
      totais[convenioId].valor += e.finalValue || 0;
    });

    return Object.values(totais);
  }, []);

  return {
    calcularValor,
    calcularTotal,
    totaisPorConvenio,
    formatarMoeda,
    getCorStatus,
  };
}

// ============================================================================
// useCadastros - Hook para dados de cadastro (convênios, hospitais, etc)
// ============================================================================

export function useCadastros() {
  const {
    convenios,
    hospitais,
    cirurgioes,
    anestesistas,
    fetchConvenios,
    fetchHospitais,
    fetchCirurgioes,
    fetchAnestesistas,
    createConvenio,
    updateConvenio,
    loading,
  } = useFaturamentoContext();

  useEffect(() => {
    fetchConvenios();
    fetchHospitais();
    fetchCirurgioes();
    fetchAnestesistas();
  }, [fetchConvenios, fetchHospitais, fetchCirurgioes, fetchAnestesistas]);

  // Opções para select
  const convenioOptions = useMemo(() => [
    { value: 'all', label: 'Todos os convênios' },
    ...convenios.map(c => ({ value: c.id, label: c.name })),
  ], [convenios]);

  const hospitalOptions = useMemo(() => [
    { value: 'all', label: 'Todos os hospitais' },
    ...hospitais.map(h => ({ value: h.id, label: h.name })),
  ], [hospitais]);

  const cirurgiaoOptions = useMemo(() => [
    { value: '', label: 'Selecione o cirurgião' },
    ...cirurgioes.map(c => ({ value: c.id, label: c.name })),
  ], [cirurgioes]);

  const anestesistaOptions = useMemo(() => [
    { value: 'all', label: 'Todos os anestesistas' },
    ...anestesistas.map(a => ({ value: a.id, label: a.name })),
  ], [anestesistas]);

  return {
    convenios,
    hospitais,
    cirurgioes,
    anestesistas,
    convenioOptions,
    hospitalOptions,
    cirurgiaoOptions,
    anestesistaOptions,
    createConvenio,
    updateConvenio,
    loading,
    refetch: () => {
      fetchConvenios();
      fetchHospitais();
      fetchCirurgioes();
      fetchAnestesistas();
    },
  };
}

export default {
  useEventos,
  useEvento,
  useNotas,
  useLotes,
  useFaturamentoStats,
  useCalculoValores,
  useCadastros,
};

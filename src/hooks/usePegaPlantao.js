/**
 * usePegaPlantao Hook
 * Hooks para buscar dados da API Pega Plantao
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getPlantoesHoje,
  getPlantoesHojePorSetor,
  getAfastamentosAtivos,
  transformPlantoes,
  transformAfastamentos,
  isConfigured,
  clearCache,
  isWeekend as checkIsWeekend,
  isWeekendMode as checkIsWeekendMode,
  getPeriodoAtual,
  estaNaMadrugada,
  HORA_CORTE_PLANTAO,
} from '../services/pegaPlantaoApi';

// ============================================================================
// DADOS MOCK (fallback em caso de erro)
// ============================================================================

const MOCK_PLANTOES = [
  { hospital: 'Hospital Santa Casa', data: 'Segunda, 16 Dez', hora: '07:00', bg: '#B8E0C8' },
  { hospital: 'Hospital São Lucas', data: 'Terça, 17 Dez', hora: '19:00', bg: '#A8D5BA' },
  { hospital: 'Hospital Regional', data: 'Quinta, 19 Dez', hora: '07:00', bg: '#C5E8D5' },
  { hospital: 'Hospital Municipal', data: 'Sábado, 21 Dez', hora: '13:00', bg: '#D4EDDA' },
];

const MOCK_FERIAS = [
  { nome: 'Dr. Carlos Silva', periodo: 'Férias' },
  { nome: 'Dra. Ana Costa', periodo: 'Férias' },
  { nome: 'Dr. Pedro Santos', periodo: 'Férias' },
  { nome: 'Dra. Maria Oliveira', periodo: 'Férias' },
  { nome: 'Dr. João Ferreira', periodo: 'Licença' },
];

// Mock de plantoes por setor para dias uteis (P1-P4)
const MOCK_PLANTOES_SETOR_DIAS_UTEIS = {
  manha: [],
  tarde: [
    { setor: 'P1', nome: 'Eduardo Savoldi', hospital: 'Eduardo Savoldi', data: 'P1', hora: '19:00' },
    { setor: 'P2', nome: 'Klisman Drescher', hospital: 'Klisman Drescher', data: 'P2', hora: '19:00' },
    { setor: 'P3', nome: 'Cristina Barbosa', hospital: 'Cristina Barbosa', data: 'P3', hora: '19:00' },
    { setor: 'P4', nome: 'G. Melo', hospital: 'G. Melo', data: 'P4', hora: '19:00' },
  ],
  ferias: MOCK_FERIAS,
  isWeekend: false,
};

// Mock para sabado manha (P1-P11)
const MOCK_PLANTOES_SETOR_SABADO_MANHA = {
  manha: [
    { setor: 'P1', nome: 'Dr. Silva', hospital: 'Dr. Silva', data: 'P1', hora: '07:00' },
    { setor: 'P2', nome: 'Dra. Costa', hospital: 'Dra. Costa', data: 'P2', hora: '07:00' },
    { setor: 'P3', nome: 'Dr. Santos', hospital: 'Dr. Santos', data: 'P3', hora: '07:00' },
    { setor: 'P4', nome: 'Dra. Oliveira', hospital: 'Dra. Oliveira', data: 'P4', hora: '07:00' },
    { setor: 'P5', nome: 'Dr. Ferreira', hospital: 'Dr. Ferreira', data: 'P5', hora: '07:00' },
    { setor: 'P6', nome: 'Dra. Mendes', hospital: 'Dra. Mendes', data: 'P6', hora: '07:00' },
    { setor: 'P7', nome: 'Dr. Lima', hospital: 'Dr. Lima', data: 'P7', hora: '07:00' },
    { setor: 'P8', nome: 'Dra. Souza', hospital: 'Dra. Souza', data: 'P8', hora: '07:00' },
    { setor: 'P9', nome: 'Dr. Pereira', hospital: 'Dr. Pereira', data: 'P9', hora: '07:00' },
    { setor: 'P10', nome: 'Dra. Alves', hospital: 'Dra. Alves', data: 'P10', hora: '07:00' },
    { setor: 'P11', nome: 'Dr. Rocha', hospital: 'Dr. Rocha', data: 'P11', hora: '07:00' },
  ],
  tarde: [
    { setor: 'P1', nome: 'Dr. Silva B', hospital: 'Dr. Silva B', data: 'P1', hora: '13:00' },
    { setor: 'P2', nome: 'Dra. Costa B', hospital: 'Dra. Costa B', data: 'P2', hora: '13:00' },
    { setor: 'P3', nome: 'Dr. Santos B', hospital: 'Dr. Santos B', data: 'P3', hora: '13:00' },
    { setor: 'P4', nome: 'Dra. Oliveira B', hospital: 'Dra. Oliveira B', data: 'P4', hora: '13:00' },
    { setor: 'P5', nome: 'Dr. Ferreira B', hospital: 'Dr. Ferreira B', data: 'P5', hora: '13:00' },
    { setor: 'P6', nome: 'Dra. Mendes B', hospital: 'Dra. Mendes B', data: 'P6', hora: '13:00' },
    { setor: 'P7', nome: 'Dr. Lima B', hospital: 'Dr. Lima B', data: 'P7', hora: '13:00' },
    { setor: 'P8', nome: 'Dra. Souza B', hospital: 'Dra. Souza B', data: 'P8', hora: '13:00' },
    { setor: 'P9', nome: 'Dr. Pereira B', hospital: 'Dr. Pereira B', data: 'P9', hora: '13:00' },
    { setor: 'P10', nome: 'Dra. Alves B', hospital: 'Dra. Alves B', data: 'P10', hora: '13:00' },
    { setor: 'P11', nome: 'Dr. Rocha B', hospital: 'Dr. Rocha B', data: 'P11', hora: '13:00' },
  ],
  ferias: [],
  isWeekend: true,
};

// Mock para domingo (P1-P11 - todos os 11 plantonistas)
const MOCK_PLANTOES_SETOR_DOMINGO = {
  manha: [
    { setor: 'P1', nome: 'Dr. Domingo 1', hospital: 'Dr. Domingo 1', data: 'P1', hora: '07:00' },
    { setor: 'P2', nome: 'Dra. Domingo 2', hospital: 'Dra. Domingo 2', data: 'P2', hora: '07:00' },
    { setor: 'P3', nome: 'Dr. Domingo 3', hospital: 'Dr. Domingo 3', data: 'P3', hora: '07:00' },
    { setor: 'P4', nome: 'Dra. Domingo 4', hospital: 'Dra. Domingo 4', data: 'P4', hora: '07:00' },
    { setor: 'P5', nome: 'Dr. Domingo 5', hospital: 'Dr. Domingo 5', data: 'P5', hora: '07:00' },
    { setor: 'P6', nome: 'Dra. Domingo 6', hospital: 'Dra. Domingo 6', data: 'P6', hora: '07:00' },
    { setor: 'P7', nome: 'Dr. Domingo 7', hospital: 'Dr. Domingo 7', data: 'P7', hora: '07:00' },
    { setor: 'P8', nome: 'Dra. Domingo 8', hospital: 'Dra. Domingo 8', data: 'P8', hora: '07:00' },
    { setor: 'P9', nome: 'Dr. Domingo 9', hospital: 'Dr. Domingo 9', data: 'P9', hora: '07:00' },
    { setor: 'P10', nome: 'Dra. Domingo 10', hospital: 'Dra. Domingo 10', data: 'P10', hora: '07:00' },
    { setor: 'P11', nome: 'Dr. Domingo 11', hospital: 'Dr. Domingo 11', data: 'P11', hora: '07:00' },
  ],
  tarde: [
    { setor: 'P1', nome: 'Dr. Domingo T1', hospital: 'Dr. Domingo T1', data: 'P1', hora: '13:00' },
    { setor: 'P2', nome: 'Dra. Domingo T2', hospital: 'Dra. Domingo T2', data: 'P2', hora: '13:00' },
    { setor: 'P3', nome: 'Dr. Domingo T3', hospital: 'Dr. Domingo T3', data: 'P3', hora: '13:00' },
    { setor: 'P4', nome: 'Dra. Domingo T4', hospital: 'Dra. Domingo T4', data: 'P4', hora: '13:00' },
    { setor: 'P5', nome: 'Dr. Domingo T5', hospital: 'Dr. Domingo T5', data: 'P5', hora: '13:00' },
    { setor: 'P6', nome: 'Dra. Domingo T6', hospital: 'Dra. Domingo T6', data: 'P6', hora: '13:00' },
    { setor: 'P7', nome: 'Dr. Domingo T7', hospital: 'Dr. Domingo T7', data: 'P7', hora: '13:00' },
    { setor: 'P8', nome: 'Dra. Domingo T8', hospital: 'Dra. Domingo T8', data: 'P8', hora: '13:00' },
    { setor: 'P9', nome: 'Dr. Domingo T9', hospital: 'Dr. Domingo T9', data: 'P9', hora: '13:00' },
    { setor: 'P10', nome: 'Dra. Domingo T10', hospital: 'Dra. Domingo T10', data: 'P10', hora: '13:00' },
    { setor: 'P11', nome: 'Dr. Domingo T11', hospital: 'Dr. Domingo T11', data: 'P11', hora: '13:00' },
  ],
  ferias: [],
  isWeekend: true,
};

/**
 * Obter mock de plantoes por setor baseado no dia da semana.
 * No modo FDS (sáb 7h → seg 7h), sempre retorna mock de sábado (48h).
 * Fora do FDS, usa lógica de madrugada para dias úteis.
 */
function getMockPlantoesSetor(date = new Date()) {
  // Modo FDS: sempre retornar mock de sábado (plantonistas ficam 48h)
  if (checkIsWeekendMode(date)) {
    return MOCK_PLANTOES_SETOR_SABADO_MANHA;
  }

  // Fora do FDS: lógica de dias úteis com madrugada
  const ehMadrugada = estaNaMadrugada(date);
  let diaSemana = date.getDay();

  if (ehMadrugada) {
    diaSemana = diaSemana === 0 ? 6 : diaSemana - 1;
  }

  // Sábado antes das 7h (fora do modo FDS) = sexta noite
  if (diaSemana === 6) return MOCK_PLANTOES_SETOR_DIAS_UTEIS;
  return MOCK_PLANTOES_SETOR_DIAS_UTEIS;
}

// ============================================================================
// usePlantoesHoje - Plantoes do dia atual
// ============================================================================

/**
 * Hook para buscar plantoes do dia atual
 * @returns {Object} - { plantoes, loading, error, refetch, usandoMock }
 */
export function usePlantoesHoje() {
  const [plantoes, setPlantoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usandoMock, setUsandoMock] = useState(false);

  const fetchPlantoes = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Se API nao configurada, usar mock
    if (!isConfigured()) {
      console.warn('API Pega Plantao nao configurada, usando mock data');
      setPlantoes(MOCK_PLANTOES);
      setUsandoMock(true);
      setLoading(false);
      return;
    }

    try {
      const data = await getPlantoesHoje();
      const transformed = transformPlantoes(data);
      setPlantoes(transformed);
      setUsandoMock(false);
    } catch (err) {
      console.error('Erro ao buscar plantoes:', err);
      setError(err.message);
      // Fallback para mock em caso de erro
      setPlantoes(MOCK_PLANTOES);
      setUsandoMock(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlantoes();
  }, [fetchPlantoes]);

  return {
    plantoes,
    loading,
    error,
    usandoMock,
    refetch: fetchPlantoes,
  };
}

// ============================================================================
// useAfastamentosAtivos - Ferias/Licencas vigentes
// ============================================================================

/**
 * Hook para buscar afastamentos ativos
 * @param {Array<{cod: string, nome: string}>} profissionais - Lista de profissionais
 * @returns {Object} - { ferias, loading, error, refetch, usandoMock }
 */
export function useAfastamentosAtivos(profissionais = []) {
  const [ferias, setFerias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usandoMock, setUsandoMock] = useState(false);

  const fetchAfastamentos = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Se API nao configurada ou sem profissionais, usar mock
    if (!isConfigured() || profissionais.length === 0) {
      console.warn('API Pega Plantao nao configurada ou sem profissionais, usando mock data');
      setFerias(MOCK_FERIAS);
      setUsandoMock(true);
      setLoading(false);
      return;
    }

    try {
      const codigos = profissionais.map(p => p.cod);
      const afastamentos = await getAfastamentosAtivos(codigos);

      // Mapear afastamentos com nomes dos profissionais
      const feriasComNomes = afastamentos.map(af => {
        const profissional = profissionais.find(p => p.cod === af.CodProfissional);
        return transformAfastamentos([af], profissional?.nome || 'Profissional')[0];
      });

      setFerias(feriasComNomes);
      setUsandoMock(false);
    } catch (err) {
      console.error('Erro ao buscar afastamentos:', err);
      setError(err.message);
      // Fallback para mock em caso de erro
      setFerias(MOCK_FERIAS);
      setUsandoMock(true);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(profissionais)]);

  useEffect(() => {
    fetchAfastamentos();
  }, [fetchAfastamentos]);

  return {
    ferias,
    loading,
    error,
    usandoMock,
    refetch: fetchAfastamentos,
  };
}

// ============================================================================
// useEscalaDia - Escala do dia com setores P1-P11
// ============================================================================

/**
 * Hook para buscar escala do dia organizada por setores (P1-P11)
 * Retorna plantoes separados por periodo (manha/tarde) e ferias (apenas dias uteis)
 *
 * @returns {Object} - Dados da escala do dia
 */
export function useEscalaDia() {
  // Usar useMemo para evitar criar nova data a cada render
  const hoje = useMemo(() => new Date(), []);

  // Inicializar com dados vazios - sera preenchido pelo fetch
  const [data, setData] = useState({
    manha: [],
    tarde: [],
    ferias: [],
    isWeekend: checkIsWeekendMode(hoje),
  });
  const [loading, setLoading] = useState(true); // Inicia como true - vai buscar da API
  const [error, setError] = useState(null);
  const [usandoMock, setUsandoMock] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const fetchEscala = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Se API nao configurada, manter mock
    if (!isConfigured()) {
      console.warn('API Pega Plantao nao configurada, mantendo mock data');
      const mockData = getMockPlantoesSetor(hoje);
      setData(mockData);
      setUsandoMock(true);
      setLoading(false);
      setHasLoadedOnce(true);
      return;
    }

    try {
      const escalaData = await getPlantoesHojePorSetor(hoje);
      setData(escalaData);
      setUsandoMock(false);
      setHasLoadedOnce(true);
    } catch (err) {
      console.error('Erro ao buscar escala do dia:', err);
      setError(err.message);
      // Fallback para mock em caso de erro
      const mockData = getMockPlantoesSetor(hoje);
      setData(mockData);
      setUsandoMock(true);
      setHasLoadedOnce(true);
    } finally {
      setLoading(false);
    }
  }, [hoje]);

  // Buscar dados da API apenas uma vez no mount
  useEffect(() => {
    fetchEscala();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Array vazio = executa apenas uma vez no mount

  // Combinar plantoes de manha e tarde para exibicao, ordenados por setor (P1-P11)
  const plantoesCombinados = useMemo(() => {
    const combined = [...data.manha, ...data.tarde];
    return combined.sort((a, b) => {
      const numA = parseInt((a.setor || '').replace(/\D/g, ''), 10) || 999;
      const numB = parseInt((b.setor || '').replace(/\D/g, ''), 10) || 999;
      return numA - numB;
    });
  }, [data.manha, data.tarde]);

  // FDS: deduplica por setor (um plantonista por P1-P11)
  // Se a API retorna turnos manhã+tarde para o mesmo setor, mantém apenas o primeiro
  const plantoesFDS = useMemo(() => {
    if (!data.isWeekend) return plantoesCombinados;
    const seen = new Set();
    return plantoesCombinados.filter(p => {
      if (!p.setor || seen.has(p.setor)) return false;
      seen.add(p.setor);
      return true;
    });
  }, [data.isWeekend, plantoesCombinados]);

  // Determinar periodo atual
  const periodoAtual = getPeriodoAtual(hoje);

  // Plantoes do periodo atual (para exibicao compacta)
  // Em dias úteis: SEMPRE mostrar os plantões noturnos (que estão em data.tarde)
  // Em fins de semana: mostrar baseado no período atual
  const plantoesperiodoAtual = data.isWeekend
    ? (periodoAtual === 'manha' ? data.manha : data.tarde)
    : data.tarde; // Em dias úteis, sempre noturno (que está em tarde)

  // Total de plantoes
  const totalPlantoes = plantoesCombinados.length;

  return {
    // Dados separados por periodo
    plantoesManha: data.manha,
    plantoesTarde: data.tarde,
    ferias: data.ferias,

    // Dados combinados
    plantoes: plantoesCombinados,
    plantoesFDS,
    plantoesperiodoAtual,

    // Estado do dia
    isWeekend: data.isWeekend,
    periodoAtual,
    totalPlantoes,

    // Estado de expansao (para fins de semana)
    expanded,
    setExpanded,
    toggleExpanded: () => setExpanded((prev) => !prev),

    // Estado de carregamento
    loading,
    error,
    usandoMock,
    hasLoadedOnce, // Indica se dados foram carregados da API ao menos uma vez
    refetch: fetchEscala,
  };
}

// ============================================================================
// usePegaPlantao - Hook combinado
// ============================================================================

/**
 * Hook combinado para buscar plantoes e ferias
 * @param {Array<{cod: string, nome: string}>} profissionais - Lista de profissionais para ferias
 * @returns {Object} - Dados de plantoes e ferias
 */
export function usePegaPlantao(profissionais = []) {
  const plantoesData = usePlantoesHoje();
  const feriasData = useAfastamentosAtivos(profissionais);

  const refetchAll = useCallback(() => {
    clearCache();
    plantoesData.refetch();
    feriasData.refetch();
  }, [plantoesData.refetch, feriasData.refetch]);

  return {
    plantoes: plantoesData.plantoes,
    plantoesLoading: plantoesData.loading,
    plantoesError: plantoesData.error,
    plantoesUsandoMock: plantoesData.usandoMock,
    refetchPlantoes: plantoesData.refetch,

    ferias: feriasData.ferias,
    feriasLoading: feriasData.loading,
    feriasError: feriasData.error,
    feriasUsandoMock: feriasData.usandoMock,
    refetchFerias: feriasData.refetch,

    loading: plantoesData.loading || feriasData.loading,
    refetchAll,
  };
}

export default usePegaPlantao;

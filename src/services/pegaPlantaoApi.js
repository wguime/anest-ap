/**
 * Pega Plantao API Service
 * Cliente da API Pega Plantao v1.7 com autenticacao OAuth 2.0 e cache
 */
import { getSupabaseToken } from '@/config/supabase'

// ============================================================================
// CONFIGURACAO
// ============================================================================

const API_CONFIG = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  cacheTTL: 5 * 60 * 1000, // 5 minutos
  profissionaisCacheTTL: 24 * 60 * 60 * 1000, // 24 horas para lista de profissionais
};

// ============================================================================
// CACHE
// ============================================================================

const cache = {
  data: new Map(),
  timestamps: new Map(),

  get(key) {
    const timestamp = this.timestamps.get(key);
    if (!timestamp || Date.now() - timestamp > API_CONFIG.cacheTTL) {
      this.data.delete(key);
      this.timestamps.delete(key);
      return null;
    }
    return this.data.get(key);
  },

  set(key, value) {
    this.data.set(key, value);
    this.timestamps.set(key, Date.now());
  },

  clear() {
    this.data.clear();
    this.timestamps.clear();
  },
};

// ============================================================================
// REQUISICOES HTTP
// ============================================================================

/**
 * Fazer requisicao autenticada via Edge Function proxy
 */
async function apiRequest(endpoint, options = {}) {
  const token = await getSupabaseToken()
  if (!token) throw new Error('Not authenticated')

  const response = await fetch(`${API_CONFIG.supabaseUrl}/functions/v1/pegaplantao-proxy`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      endpoint,
      method: options.method || 'GET',
      body: options.body ? JSON.parse(options.body) : undefined,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `API error: ${response.status}`)
  }

  return await response.json()
}

// ============================================================================
// CONSTANTES DE HORÁRIO
// ============================================================================

export const HORA_CORTE_PLANTAO = 7; // 7h da manhã - hora de troca de plantão

/**
 * Verifica se está no período de madrugada (00:00 - 06:59)
 * Neste período, plantonistas noturnos do dia anterior ainda estão em serviço
 * @param {Date} date - Data/hora a verificar
 * @returns {boolean}
 */
export function estaNaMadrugada(date = new Date()) {
  const hora = date.getHours();
  return hora >= 0 && hora < HORA_CORTE_PLANTAO;
}

/**
 * Formata data para string YYYY-MM-DD usando horário LOCAL
 * Evita problemas de timezone que ocorrem com toISOString()
 * @param {Date} date - Data a formatar
 * @returns {string} - Data no formato YYYY-MM-DD
 */
function formatarDataLocal(date) {
  const ano = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const dia = String(date.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/**
 * Retorna a "data efetiva" para exibição de plantões noturnos
 *
 * Regra de negócio: Plantonistas noturnos (19:00-07:00) ficam expostos por 24h:
 * - Início da exposição: 07:00 do dia que inicia o plantão
 * - Fim da exposição: 07:00 do dia seguinte
 *
 * Exemplo: Plantão quinta 19:00 até sexta 07:00
 * - Aparece de: quinta 07:00 até sexta 07:00
 *
 * @param {Date} dataReferencia - Data/hora de referência
 * @returns {Date} - Data efetiva para busca de plantões
 */
function getDataEfetiva(dataReferencia = new Date()) {
  const hora = dataReferencia.getHours();
  const dataEfetiva = new Date(dataReferencia);

  if (hora < 7) {
    // Antes das 7h: ainda mostra plantão do dia anterior
    dataEfetiva.setDate(dataEfetiva.getDate() - 1);
  }

  return dataEfetiva;
}

/**
 * Verifica se um plantão está em andamento no momento atual
 * @param {Object} plantao - Objeto do plantão com campos Inicio e Fim
 * @param {Date} agora - Data/hora atual
 * @returns {boolean}
 */
export function plantaoEmAndamento(plantao, agora = new Date()) {
  const inicio = new Date(plantao.Inicio);
  const fim = plantao.Fim ? new Date(plantao.Fim) : null;

  // Se não tem fim definido, considerar em andamento se já começou
  if (!fim) {
    return agora >= inicio;
  }

  // Plantão está em andamento se: inicio <= agora < fim
  return agora >= inicio && agora < fim;
}

// ============================================================================
// CONFIGURACAO DE SETORES POR PERIODO
// ============================================================================

const SETORES_CONFIG = {
  // Segunda a Sexta
  diasUteis: ['P1', 'P2', 'P3', 'P4'],
  // Sabado Manha
  sabadoManha: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'P11'],
  // Sabado Tarde (todos os 11 setores)
  sabadoTarde: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'P11'],
  // Domingo - Manha e Tarde (todos os 11 setores)
  domingo: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'P11'],
};

/**
 * Extrair numero do setor (P1, P2, etc.) do nome completo
 * @param {string} nomeSetor - Ex: "ANESTESIA CHAPECO - 1 - P1"
 * @returns {string|null} - Ex: "P1"
 */
function extrairNumeroSetor(nomeSetor) {
  if (!nomeSetor) return null;
  const match = nomeSetor.match(/P(\d+)/i);
  return match ? `P${match[1]}` : null;
}

/**
 * Determinar quais setores mostrar baseado no dia/periodo
 * @param {Date} date - Data de referencia
 * @param {string} periodo - 'manha' | 'tarde'
 * @returns {Array<string>}
 */
export function getSetoresParaPeriodo(date = new Date(), periodo = 'manha') {
  const diaSemana = date.getDay(); // 0=Dom, 6=Sab

  if (diaSemana >= 1 && diaSemana <= 5) {
    // Segunda a Sexta
    return SETORES_CONFIG.diasUteis;
  }

  if (diaSemana === 6) {
    // Sabado
    return periodo === 'manha' ? SETORES_CONFIG.sabadoManha : SETORES_CONFIG.sabadoTarde;
  }

  // Domingo
  return SETORES_CONFIG.domingo;
}

/**
 * Verificar se a data e fim de semana
 * @param {Date} date
 * @returns {boolean}
 */
export function isWeekend(date = new Date()) {
  const dia = date.getDay();
  return dia === 0 || dia === 6;
}

/**
 * Verificar se está no "modo fim de semana" para exibição de plantões.
 * Os plantonistas de sábado ficam expostos por 48h contínuas.
 *
 * Regra: Sábado 7h → Segunda 7h = modo fim de semana
 *
 * - Sábado antes das 7h: NÃO (ainda mostra plantão noturno de sexta)
 * - Sábado 7h+: SIM
 * - Domingo (dia todo): SIM
 * - Segunda antes das 7h: SIM (plantonistas de sábado ainda em serviço)
 * - Segunda 7h+: NÃO (troca para plantão de segunda)
 *
 * @param {Date} date
 * @returns {boolean}
 */
export function isWeekendMode(date = new Date()) {
  const dia = date.getDay();
  const hora = date.getHours();
  // Sábado 7h+ (plantonistas de FDS começaram)
  if (dia === 6 && hora >= HORA_CORTE_PLANTAO) return true;
  // Domingo (dia todo - plantonistas de sábado continuam)
  if (dia === 0) return true;
  // Segunda-feira antes das 7h (plantonistas de sábado ainda em serviço)
  if (dia === 1 && hora < HORA_CORTE_PLANTAO) return true;
  return false;
}

/**
 * Retorna a data do SÁBADO correspondente ao fim de semana atual.
 * Durante o modo FDS, sempre retorna o sábado para que os mesmos
 * plantonistas fiquem expostos por 48h (sáb 7h → seg 7h).
 *
 * @param {Date} date - Data de referência (deve estar em modo FDS)
 * @returns {Date} - Data do sábado correspondente
 */
function getSabadoDoFDS(date) {
  const dia = date.getDay();
  const result = new Date(date);

  if (dia === 6) {
    // Sábado: usar este sábado
    return result;
  }
  if (dia === 0) {
    // Domingo: voltar 1 dia → sábado
    result.setDate(result.getDate() - 1);
    return result;
  }
  if (dia === 1) {
    // Segunda (madrugada): voltar 2 dias → sábado
    result.setDate(result.getDate() - 2);
    return result;
  }
  return result;
}

/**
 * Determinar o periodo atual (manha ou tarde) baseado na hora
 * @param {Date} date
 * @returns {string}
 */
export function getPeriodoAtual(date = new Date()) {
  const hora = date.getHours();
  return hora < 12 ? 'manha' : 'tarde';
}

// ============================================================================
// ENDPOINTS - PLANTOES
// ============================================================================

/**
 * Listar plantoes com filtros
 * @param {Object} filtros - { dataInicio, dataFim, codSetores, codTipoPlantao }
 */
export async function getPlantoes(filtros = {}) {
  const cacheKey = `plantoes_${JSON.stringify(filtros)}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams();
  if (filtros.dataInicio) params.append('filtro.dataInicio', filtros.dataInicio);
  if (filtros.dataFim) params.append('filtro.dataFim', filtros.dataFim);
  if (filtros.codSetores) {
    filtros.codSetores.forEach(cod => params.append('filtro.codSetores', cod));
  }
  if (filtros.codTipoPlantao) params.append('filtro.codTipoPlantao', filtros.codTipoPlantao);

  const queryString = params.toString();
  const endpoint = `/api/v1/plantoes${queryString ? `?${queryString}` : ''}`;

  const data = await apiRequest(endpoint);
  cache.set(cacheKey, data);
  return data;
}

/**
 * Buscar plantoes do dia atual
 */
export async function getPlantoesHoje() {
  const hoje = new Date();
  const dataStr = hoje.toISOString().split('T')[0];

  return getPlantoes({
    dataInicio: `${dataStr}T00:00:00`,
    dataFim: `${dataStr}T23:59:59`,
  });
}

/**
 * Buscar plantoes do dia atual organizados por setor (P1-P11)
 *
 * Lógica para DIAS ÚTEIS:
 * - 00:00 - 06:59 (madrugada): Mostrar plantões noturnos do dia ANTERIOR (ainda em andamento)
 * - 07:00 - 18:59 (dia): Mostrar plantões noturnos do dia ATUAL (que começarão às 19h)
 * - 19:00 - 23:59 (noite): Mostrar plantões noturnos do dia ATUAL (em andamento)
 *
 * Lógica para FINS DE SEMANA (sáb 7h → seg 7h):
 * - SEMPRE buscar dados do SÁBADO (plantonistas ficam 48h)
 * - Mostrar todos os P1-P11 sem filtro de horário
 *
 * @param {Date} dataReferencia - Data de referencia
 * @returns {Promise<Object>} - { manha: [...], tarde: [...], ferias: [...] }
 */
export async function getPlantoesHojePorSetor(dataReferencia = new Date()) {
  const horaAtual = dataReferencia.getHours();
  const ehFimDeSemana = isWeekendMode(dataReferencia);

  // Data efetiva para busca na API
  let dataEfetiva;
  if (ehFimDeSemana) {
    // Modo FDS: SEMPRE buscar dados do SÁBADO (48h contínuas)
    dataEfetiva = getSabadoDoFDS(dataReferencia);
  } else {
    // Dias úteis: antes das 7h mostra dia anterior (plantão noturno em vigência)
    dataEfetiva = getDataEfetiva(dataReferencia);
  }
  const dataEfetivaStr = formatarDataLocal(dataEfetiva);

  // Buscar plantões da data efetiva
  const plantoes = await getPlantoes({
    dataInicio: `${dataEfetivaStr}T00:00:00`,
    dataFim: `${dataEfetivaStr}T23:59:59`,
  });

  // FILTRAR plantões baseado no contexto
  let plantoesFiltrados;

  if (ehFimDeSemana) {
    // Fim de semana: mostrar TODOS os plantões do dia (P1-P11 expostos de sáb 7h a seg 7h)
    // Não filtrar por plantaoEmAndamento pois os plantonistas ficam visíveis o dia todo
    plantoesFiltrados = plantoes;
  } else {
    // Dias úteis: mostrar plantões noturnos da data efetiva
    plantoesFiltrados = plantoes.filter(p => {
      const inicio = new Date(p.Inicio);
      const horaInicio = inicio.getHours();
      const dataPlantao = formatarDataLocal(inicio);

      // Plantões noturnos (19h+) da data efetiva
      return dataPlantao === dataEfetivaStr && horaInicio >= 19;
    });
  }

  // Separar plantoes por periodo (manha/tarde) e extrair setor
  const resultado = {
    manha: [],
    tarde: [],
    ferias: [],
    isWeekend: isWeekendMode(dataReferencia),
  };

  // Em modo FDS, usar dataEfetiva para setores (ex: segunda madrugada usa config de domingo)
  const dataParaSetores = ehFimDeSemana ? dataEfetiva : dataReferencia;
  const setoresManha = getSetoresParaPeriodo(dataParaSetores, 'manha');
  const setoresTarde = getSetoresParaPeriodo(dataParaSetores, 'tarde');

  // ==========================================================================
  // EXTRAIR FÉRIAS DOS PLANTÕES (Setor = "Férias")
  // Usa plantões originais da API, não os filtrados por período
  // ==========================================================================
  const plantoesFerias = plantoes.filter(p =>
    p.Setor && p.Setor.toLowerCase().includes('férias')
  );

  const feriasExtraidas = plantoesFerias.map(p => {
    const inicio = new Date(p.Inicio);
    const fim = p.Fim ? new Date(p.Fim) : null;

    // Formatar período
    const formatarData = (date) => {
      const dia = date.getDate().toString().padStart(2, '0');
      const mes = (date.getMonth() + 1).toString().padStart(2, '0');
      return `${dia}/${mes}`;
    };

    // Verificar se início e fim são a mesma data
    const dataInicioStr = formatarData(inicio);
    const dataFimStr = fim ? formatarData(fim) : null;

    let periodo;
    if (!fim) {
      periodo = `A partir de ${dataInicioStr}`;
    } else if (dataInicioStr === dataFimStr) {
      // Mesma data: mostrar apenas uma vez
      periodo = dataInicioStr;
    } else {
      periodo = `${dataInicioStr} - ${dataFimStr}`;
    }

    return {
      nome: p.ProfDePlantao || p.ProfFixo || 'Profissional',
      periodo,
      tipo: 'férias',
      codigo: p.CodigoPlantao,
    };
  });

  // Filtrar plantões reais (excluir férias) para processamento
  const plantoesReais = plantoesFiltrados.filter(p =>
    !p.Setor || !p.Setor.toLowerCase().includes('férias')
  );

  plantoesReais.forEach((plantao, index) => {
    const setor = extrairNumeroSetor(plantao.Setor);
    if (!setor) {
      return;
    }

    const inicio = new Date(plantao.Inicio);
    const hora = inicio.getHours();
    const horaFormatada = inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });

    const item = {
      setor,
      nome: plantao.ProfDePlantao || plantao.ProfFixo || 'A definir',
      horario: horaFormatada,
      local: plantao.Local,
      tipo: plantao.Tipo,
      codigoPlantao: plantao.CodigoPlantao,
      // Dados para compatibilidade com PlantaoListItem
      hospital: plantao.ProfDePlantao || plantao.ProfFixo || 'A definir',
      data: setor,
      hora: horaFormatada,
    };

    // LÓGICA DE FILTRAGEM BASEADA NO DIA
    if (ehFimDeSemana) {
      // Fins de semana: separar por manhã (<12h) e tarde (>=12h)
      const periodo = hora < 12 ? 'manha' : 'tarde';
      if (periodo === 'manha' && setoresManha.includes(setor)) {
        resultado.manha.push(item);
      } else if (periodo === 'tarde' && setoresTarde.includes(setor)) {
        resultado.tarde.push(item);
      }
    } else {
      // Dias úteis: APENAS plantões noturnos (hora >= 19) de P1-P4
      const setoresDiasUteis = ['P1', 'P2', 'P3', 'P4'];
      const ehNoturno = hora >= 19;

      if (ehNoturno && setoresDiasUteis.includes(setor)) {
        // Em dias úteis, todos os plantões noturnos vão para "tarde" (que representa noturno)
        resultado.tarde.push(item);
      }
    }
  });

  // Ordenar por numero do setor
  const ordenarPorSetor = (a, b) => {
    const numA = parseInt(a.setor.replace('P', ''));
    const numB = parseInt(b.setor.replace('P', ''));
    return numA - numB;
  };

  resultado.manha.sort(ordenarPorSetor);
  resultado.tarde.sort(ordenarPorSetor);

  // Férias já foram extraídas dos plantões acima
  resultado.ferias = feriasExtraidas;

  return resultado;
}

/**
 * Buscar escala semanal completa
 * @param {Date} dataReferencia - Data de referencia para a semana
 * @returns {Promise<Object>} - Dados da semana organizados por dia
 */
export async function getEscalaSemanal(dataReferencia = new Date()) {
  // Calcular inicio e fim da semana (domingo a sabado)
  const inicioSemana = new Date(dataReferencia);
  inicioSemana.setDate(dataReferencia.getDate() - dataReferencia.getDay());
  inicioSemana.setHours(0, 0, 0, 0);

  const fimSemana = new Date(inicioSemana);
  fimSemana.setDate(inicioSemana.getDate() + 6);
  fimSemana.setHours(23, 59, 59, 999);

  const plantoes = await getPlantoes({
    dataInicio: inicioSemana.toISOString().replace('Z', ''),
    dataFim: fimSemana.toISOString().replace('Z', ''),
  });

  // Organizar por dia da semana
  const diasSemana = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
  const resultado = {};

  diasSemana.forEach((dia, index) => {
    resultado[dia] = {
      data: new Date(inicioSemana.getTime() + index * 24 * 60 * 60 * 1000),
      manha: [],
      tarde: [],
    };
  });

  plantoes.forEach((plantao) => {
    const inicio = new Date(plantao.Inicio);
    const diaSemana = diasSemana[inicio.getDay()];
    const hora = inicio.getHours();
    const periodo = hora < 12 ? 'manha' : 'tarde';
    const setor = extrairNumeroSetor(plantao.Setor);

    if (!setor) return;

    const item = {
      setor,
      nome: plantao.ProfDePlantao || plantao.ProfFixo || 'A definir',
      horario: inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false }),
      local: plantao.Local,
      tipo: plantao.Tipo,
    };

    resultado[diaSemana][periodo].push(item);
  });

  // Ordenar cada dia por setor
  Object.values(resultado).forEach((dia) => {
    const ordenar = (a, b) => {
      const numA = parseInt(a.setor.replace('P', ''));
      const numB = parseInt(b.setor.replace('P', ''));
      return numA - numB;
    };
    dia.manha.sort(ordenar);
    dia.tarde.sort(ordenar);
  });

  return resultado;
}

/**
 * Buscar plantões e férias de uma data arbitrária (YYYY-MM-DD).
 * Retorna { plantoes: [{nome, setor, horario, inicio}], ferias: [{nome, inicio, fim, periodo}] }
 */
export async function getPlantoesPorData(dateStr) {
  const raw = await getPlantoes({
    dataInicio: `${dateStr}T00:00:00`,
    dataFim: `${dateStr}T23:59:59`,
  })

  const ferias = []
  const plantoes = []

  for (const p of raw) {
    const nome = p.ProfDePlantao || p.ProfFixo || ''
    if (!nome) continue

    if (p.Setor && p.Setor.toLowerCase().includes('férias')) {
      const inicio = new Date(p.Inicio)
      const fim = p.Fim ? new Date(p.Fim) : null
      const fmt = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
      const periodo = fim ? `${fmt(inicio)} - ${fmt(fim)}` : `A partir de ${fmt(inicio)}`
      ferias.push({ nome, inicio: p.Inicio, fim: p.Fim || null, periodo })
    } else {
      const inicio = new Date(p.Inicio)
      const horaFormatada = inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false })
      const setor = p.Setor ? (p.Setor.match(/P(\d+)/i) ? `P${p.Setor.match(/P(\d+)/i)[1]}` : p.Setor) : ''
      plantoes.push({ nome, setor, horario: horaFormatada, inicio: p.Inicio })
    }
  }

  return { plantoes, ferias }
}

// ============================================================================
// ENDPOINTS - AFASTAMENTOS (FERIAS/LICENCAS)
// ============================================================================

/**
 * Buscar afastamentos de um profissional
 * @param {string} codProfissional - Codigo do profissional
 */
export async function getAfastamentos(codProfissional) {
  const cacheKey = `afastamentos_${codProfissional}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const endpoint = `/api/v1/profissionais/${codProfissional}/afastamentos`;
  const data = await apiRequest(endpoint);
  cache.set(cacheKey, data);
  return data;
}

/**
 * Buscar afastamentos ativos (hoje dentro do periodo)
 * @param {Array<string>} codProfissionais - Lista de codigos de profissionais
 */
export async function getAfastamentosAtivos(codProfissionais = []) {
  const hoje = new Date();

  const promises = codProfissionais.map(async (cod) => {
    try {
      const afastamentos = await getAfastamentos(cod);
      // Filtrar apenas afastamentos ativos
      return afastamentos.filter(af => {
        const inicio = new Date(af.Inicio);
        const fim = new Date(af.Fim);
        return hoje >= inicio && hoje <= fim;
      });
    } catch (error) {
      console.warn(`Erro ao buscar afastamentos do profissional ${cod}:`, error);
      return [];
    }
  });

  const results = await Promise.all(promises);
  return results.flat();
}

// ============================================================================
// ENDPOINTS - LOCAIS E GRUPOS
// ============================================================================

/**
 * Listar todos os locais
 */
export async function getLocais() {
  const cacheKey = 'locais';
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const data = await apiRequest('/api/v1/locais');
  cache.set(cacheKey, data);
  return data;
}

/**
 * Listar setores de um local
 * @param {string} codLocal - Codigo do local
 */
export async function getSetores(codLocal) {
  const cacheKey = `setores_${codLocal}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const data = await apiRequest(`/api/v1/locais/${codLocal}`);
  cache.set(cacheKey, data);
  return data;
}

/**
 * Listar todos os grupos
 */
export async function getGrupos() {
  const cacheKey = 'grupos';
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const data = await apiRequest('/api/v1/grupos');
  cache.set(cacheKey, data);
  return data;
}

// ============================================================================
// ENDPOINTS - PROFISSIONAIS
// ============================================================================

/**
 * Buscar profissional por codigo
 * @param {string} codProfissional - Codigo do profissional
 */
export async function getProfissional(codProfissional) {
  const cacheKey = `profissional_${codProfissional}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const data = await apiRequest(`/api/v1/profissionais/${codProfissional}`);
  cache.set(cacheKey, data);
  return data;
}

/**
 * Listar profissionais por codigo ou profissao
 * @param {string} codOuProfissao - Codigo interno ou nome da profissao
 */
export async function getProfissionais(codOuProfissao) {
  const cacheKey = `profissionais_${codOuProfissao}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const data = await apiRequest(`/api/v1/profissionais/lista/${codOuProfissao}`);
  cache.set(cacheKey, data);
  return data;
}

/**
 * Buscar lista de profissionais do grupo (anestesiologistas)
 * Cache longo de 24 horas para evitar requisições repetidas
 * @returns {Promise<Array>} Lista de profissionais com Codigo e Nome
 */
export async function getProfissionaisDoGrupo() {
  const cacheKey = 'profissionais_grupo';

  // Verificar cache com TTL longo (24 horas)
  const cached = cache.data.get(cacheKey);
  const timestamp = cache.timestamps.get(cacheKey);
  if (cached && timestamp && (Date.now() - timestamp < API_CONFIG.profissionaisCacheTTL)) {
    return cached;
  }

  try {
    const data = await apiRequest('/api/v1/profissionais/lista/anestesiologista');

    // Salvar em cache com TTL longo
    cache.data.set(cacheKey, data);
    cache.timestamps.set(cacheKey, Date.now());

    return data;
  } catch (error) {
    console.error('❌ [PegaPlantao] Erro ao buscar profissionais:', error.message);
    return [];
  }
}

// ============================================================================
// TRANSFORMADORES DE DADOS
// ============================================================================

/**
 * Transformar plantao da API para formato do componente
 */
export function transformPlantao(apiPlantao) {
  const inicio = new Date(apiPlantao.Inicio);
  const fim = apiPlantao.Fim ? new Date(apiPlantao.Fim) : null;

  // Dias da semana em portugues
  const diasSemana = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'];
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  // Formatar data: "Segunda, 16 Dez"
  const dataFormatada = `${diasSemana[inicio.getDay()]}, ${inicio.getDate()} ${meses[inicio.getMonth()]}`;

  // Formatar hora: "07:00"
  const horaFormatada = inicio.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  // Formatar hora de fim
  const horaFim = fim ? fim.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }) : null;

  // Cores alternadas para os cards
  const bgColors = ['#B8E0C8', '#A8D5BA', '#C5E8D5', '#D4EDDA'];

  return {
    hospital: apiPlantao.Local || 'Local não informado',
    data: dataFormatada,
    hora: horaFormatada,
    horaFim,  // NOVO: hora de término formatada
    bg: bgColors[Math.floor(Math.random() * bgColors.length)],
    // Dados adicionais
    setor: apiPlantao.Setor,
    tipo: apiPlantao.Tipo,
    profissionalFixo: apiPlantao.ProfFixo,
    profissionalDePlantao: apiPlantao.ProfDePlantao,
    codigoPlantao: apiPlantao.CodigoPlantao,
    // Campos raw para cálculos
    inicioRaw: apiPlantao.Inicio,  // Manter original para cálculos
    fimRaw: apiPlantao.Fim,        // NOVO: campo Fim para verificações
  };
}

/**
 * Transformar lista de plantoes
 */
export function transformPlantoes(plantoes) {
  const bgColors = ['#B8E0C8', '#A8D5BA', '#C5E8D5', '#D4EDDA'];
  return plantoes.map((p, index) => ({
    ...transformPlantao(p),
    bg: bgColors[index % bgColors.length],
  }));
}

/**
 * Transformar afastamento da API para formato do componente
 */
export function transformAfastamento(apiAfastamento, nomeProfissional = 'Profissional') {
  const inicio = new Date(apiAfastamento.Inicio);
  const fim = new Date(apiAfastamento.Fim);

  // Formatar datas: "20/12 - 05/01"
  const formatarData = (date) => {
    const dia = date.getDate().toString().padStart(2, '0');
    const mes = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${dia}/${mes}`;
  };

  return {
    nome: nomeProfissional,
    periodo: `${formatarData(inicio)} - ${formatarData(fim)}`,
    comentario: apiAfastamento.Comentario,
    codigo: apiAfastamento.Codigo,
  };
}

/**
 * Transformar lista de afastamentos
 */
export function transformAfastamentos(afastamentos, nomeProfissional) {
  return afastamentos.map(a => transformAfastamento(a, nomeProfissional));
}

// ============================================================================
// UTILITARIOS
// ============================================================================

/**
 * Limpar cache da API
 */
export function clearCache() {
  cache.clear();
}

/**
 * Logout - limpar tokens e cache
 */
export function logout() {
  cache.clear();
}

/**
 * Verificar se API esta configurada
 */
export function isConfigured() {
  return !!API_CONFIG.supabaseUrl;
}

/**
 * Verificar se esta autenticado na API
 */
export function isAuthenticated() {
  return true; // Authentication is handled by Supabase JWT
}

export default {
  // Plantoes
  getPlantoes,
  getPlantoesHoje,
  getPlantoesHojePorSetor,
  getPlantoesPorData,
  getEscalaSemanal,
  // Afastamentos
  getAfastamentos,
  getAfastamentosAtivos,
  // Locais e Grupos
  getLocais,
  getSetores,
  getGrupos,
  // Profissionais
  getProfissional,
  getProfissionais,
  getProfissionaisDoGrupo,
  // Transformadores
  transformPlantao,
  transformPlantoes,
  transformAfastamento,
  transformAfastamentos,
  // Utilitarios
  clearCache,
  logout,
  isConfigured,
  isAuthenticated,
  // Helpers de periodo
  getSetoresParaPeriodo,
  isWeekend,
  isWeekendMode,
  getPeriodoAtual,
  // Helpers de madrugada/plantão em andamento
  HORA_CORTE_PLANTAO,
  estaNaMadrugada,
  plantaoEmAndamento,
};

/**
 * API Pega Plantão - Integração
 * 
 * Integração com a API "pega plantão" para buscar informações de:
 * - Plantões do dia
 * - Férias e licenças
 * - Anestesistas RPA
 * 
 * Documentação disponível em: API pega plantão/
 */

// Configuração da API (será configurada conforme documentação)
const PEGA_PLANTAO_CONFIG = {
    baseURL: '', // Será preenchido após análise da documentação
    endpoints: {
        plantaoHoje: '/api/plantao/hoje',
        feriasLicenca: '/api/ferias-licenca/hoje',
        anestesistasRPA: '/api/anestesistas/rpa'
    },
    cacheDuration: 5 * 60 * 1000, // 5 minutos
    timeout: 10000 // 10 segundos
};

// Cache local
const cache = {
    plantaoHoje: {
        data: null,
        timestamp: null
    },
    feriasLicenca: {
        data: null,
        timestamp: null
    },
    anestesistasRPA: {
        data: null,
        timestamp: null
    }
};

/**
 * Verifica se os dados em cache ainda são válidos
 */
function isCacheValid(cacheEntry) {
    if (!cacheEntry.data || !cacheEntry.timestamp) {
        return false;
    }
    const now = Date.now();
    return (now - cacheEntry.timestamp) < PEGA_PLANTAO_CONFIG.cacheDuration;
}

/**
 * Faz requisição HTTP com timeout e tratamento de erros
 */
async function fetchWithTimeout(url, options = {}, timeout = PEGA_PLANTAO_CONFIG.timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Timeout ao buscar dados da API');
        }
        throw error;
    }
}

/**
 * Busca plantões do dia atual
 * @returns {Promise<Array>} Lista de médicos em plantão
 */
async function buscarPlantaoHoje() {
    // Verificar cache
    if (isCacheValid(cache.plantaoHoje)) {
        console.log('[API] Retornando dados do cache - Plantão Hoje');
        return cache.plantaoHoje.data;
    }

    try {
        // TODO: Implementar chamada real após análise da documentação
        // Por enquanto, retorna mock data para desenvolvimento
        
        // Simulação de delay da API
        await new Promise(resolve => setTimeout(resolve, 500));

        // Mock data - será substituído pela chamada real
        // Garantir 4 plantonistas (P1, P2, P3, P4)
        const mockData = [
            {
                id: '1',
                nome: 'P1',
                sala: 'Sala 1',
                ramal: '1234',
                status: 'active',
                avatar: 'P1'
            },
            {
                id: '2',
                nome: 'P2',
                sala: 'Sala 2',
                ramal: '5678',
                status: 'active',
                avatar: 'P2'
            },
            {
                id: '3',
                nome: 'P3',
                sala: 'Sala 3',
                ramal: '9012',
                status: 'active',
                avatar: 'P3'
            },
            {
                id: '4',
                nome: 'P4',
                sala: 'Sala 4',
                ramal: '3456',
                status: 'active',
                avatar: 'P4'
            }
        ];

        // Atualizar cache
        cache.plantaoHoje = {
            data: mockData,
            timestamp: Date.now()
        };

        return mockData;
    } catch (error) {
        console.error('[API] Erro ao buscar plantão hoje:', error);
        // Retornar dados do cache mesmo se expirados, ou array vazio
        return cache.plantaoHoje.data || [];
    }
}

/**
 * Busca médicos em férias ou licença no dia atual
 * @returns {Promise<Array>} Lista de médicos em férias/licença
 */
async function buscarFeriasLicencaHoje() {
    // Verificar cache
    if (isCacheValid(cache.feriasLicenca)) {
        console.log('[API] Retornando dados do cache - Férias/Licença');
        return cache.feriasLicenca.data;
    }

    try {
        // TODO: Implementar chamada real após análise da documentação
        
        await new Promise(resolve => setTimeout(resolve, 500));

        // Mock data - garantir 6 médicos para 3 colunas com 2 nomes cada
        const mockData = [
            {
                id: '1',
                nome: 'Dra. Maria Alba',
                tipo: 'Férias',
                dataInicio: '2024-01-15',
                dataFim: '2024-01-30',
                avatar: 'MA'
            },
            {
                id: '2',
                nome: 'Dr. Carlos Santos',
                tipo: 'Licença Médica',
                dataInicio: '2024-01-20',
                dataFim: '2024-01-25',
                avatar: 'CS'
            },
            {
                id: '3',
                nome: 'Dra. Ana Paula',
                tipo: 'Férias',
                dataInicio: '2024-01-18',
                dataFim: '2024-02-02',
                avatar: 'AP'
            },
            {
                id: '4',
                nome: 'Dr. Roberto Lima',
                tipo: 'Férias',
                dataInicio: '2024-01-22',
                dataFim: '2024-02-06',
                avatar: 'RL'
            },
            {
                id: '5',
                nome: 'Dr. José Silva',
                tipo: 'Licença Médica',
                dataInicio: '2024-01-25',
                dataFim: '2024-01-30',
                avatar: 'JS'
            },
            {
                id: '6',
                nome: 'Dra. Maria Costa',
                tipo: 'Férias',
                dataInicio: '2024-01-20',
                dataFim: '2024-02-04',
                avatar: 'MC'
            }
        ];

        cache.feriasLicenca = {
            data: mockData,
            timestamp: Date.now()
        };

        return mockData;
    } catch (error) {
        console.error('[API] Erro ao buscar férias/licença:', error);
        return cache.feriasLicenca.data || [];
    }
}

/**
 * Busca anestesistas RPA disponíveis
 * @returns {Promise<Array>} Lista de anestesistas RPA
 */
async function buscarAnestesistasRPA() {
    // Verificar cache
    if (isCacheValid(cache.anestesistasRPA)) {
        console.log('[API] Retornando dados do cache - Anestesistas RPA');
        return cache.anestesistasRPA.data;
    }

    try {
        // TODO: Implementar chamada real após análise da documentação
        
        await new Promise(resolve => setTimeout(resolve, 500));

        // Mock data
        const mockData = [
            {
                id: '1',
                nome: 'Dr. Ana Paula',
                especialidade: 'Anestesiologia',
                disponivel: true,
                contato: 'ramal 3456',
                avatar: 'AP'
            },
            {
                id: '2',
                nome: 'Dr. Roberto Lima',
                especialidade: 'Anestesiologia',
                disponivel: true,
                contato: 'ramal 7890',
                avatar: 'RL'
            }
        ];

        cache.anestesistasRPA = {
            data: mockData,
            timestamp: Date.now()
        };

        return mockData;
    } catch (error) {
        console.error('[API] Erro ao buscar anestesistas RPA:', error);
        return cache.anestesistasRPA.data || [];
    }
}

/**
 * Limpa o cache (útil para forçar atualização)
 */
function limparCache() {
    cache.plantaoHoje = { data: null, timestamp: null };
    cache.feriasLicenca = { data: null, timestamp: null };
    cache.anestesistasRPA = { data: null, timestamp: null };
    console.log('[API] Cache limpo');
}

/**
 * Força atualização de todos os dados (ignora cache)
 */
async function atualizarTodos() {
    limparCache();
    try {
        await Promise.all([
            buscarPlantaoHoje(),
            buscarFeriasLicencaHoje(),
            buscarAnestesistasRPA()
        ]);
        console.log('[API] Todos os dados atualizados');
    } catch (error) {
        console.error('[API] Erro ao atualizar dados:', error);
    }
}

// Exportar funções (compatível com módulos ES6 e script global)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        buscarPlantaoHoje,
        buscarFeriasLicencaHoje,
        buscarAnestesistasRPA,
        limparCache,
        atualizarTodos
    };
}

// Tornar disponível globalmente
window.PegaPlantaoAPI = {
    buscarPlantaoHoje,
    buscarFeriasLicencaHoje,
    buscarAnestesistasRPA,
    limparCache,
    atualizarTodos
};


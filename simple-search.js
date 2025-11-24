/**
 * ===============================================
 * SIMPLE SEARCH - MINISEARCH IMPLEMENTATION
 * ===============================================
 *
 * Sistema de busca simplificado baseado em MiniSearch.
 * Substitui toda a arquitetura anterior (2.000+ linhas).
 *
 * MiniSearch: https://lucaongaro.github.io/minisearch/
 * - 6KB minified
 * - 4.6k GitHub stars
 * - Battle-tested em produção
 *
 * @version 1.0.0
 * @author Claude Code
 */

const AnestSearch = {
    miniSearch: null,
    initialized: false,
    allDocuments: [],

    /**
     * Inicializa sistema de busca
     */
    async init() {
        if (this.initialized) return true;

        console.log('🔍 Inicializando busca com MiniSearch...');

        // Criar índice MiniSearch
        this.miniSearch = new MiniSearch({
            fields: ['title', 'description', 'filePath', 'categoria', 'codigo'],
            storeFields: ['title', 'description', 'type', 'icon', 'actionType', 'actionTarget'],
            searchOptions: {
                fuzzy: 0.2,        // Tolera typos (20% de diferença)
                prefix: true,       // Busca prefixos ("prot" encontra "protocolo")
                boost: { title: 2 } // Título tem peso 2x maior
            }
        });

        // Carregar todos os dados
        await this.loadAllData();

        this.initialized = true;
        console.log(`✅ Busca inicializada: ${this.allDocuments.length} itens indexados`);
        return true;
    },

    /**
     * Carrega dados de todas as fontes
     */
    async loadAllData() {
        this.allDocuments = [];

        // 1. DOCUMENTOS DO FIRESTORE
        await this.loadFirestoreDocuments();

        // 2. ROPS
        this.loadROPs();

        // 3. CALCULADORAS
        this.loadCalculadoras();

        // 4. PODCASTS
        this.loadPodcasts();

        // 5. FUNCIONALIDADES DO APP
        this.loadFuncionalidades();

        // Adicionar todos ao índice DE UMA VEZ
        if (this.allDocuments.length > 0) {
            this.miniSearch.addAll(this.allDocuments);
        }
    },

    /**
     * Carrega documentos do Firestore
     */
    async loadFirestoreDocuments() {
        if (!window.db) {
            console.warn('⚠️ Firebase não disponível para busca');
            return;
        }

        const collections = [
            'biblioteca_documentos',
            'medicamentos_documentos',
            'infeccao_documentos',
            'conciliacao_documentos',
            'checklist_documentos',
            'kpi_documentos',
            'auditorias_documentos',
            'relatorios_documentos',
            'comunicados'
        ];

        for (const col of collections) {
            try {
                const snapshot = await window.db.collection(col).limit(100).get();

                snapshot.forEach(doc => {
                    const data = doc.data();

                    this.allDocuments.push({
                        id: `${col}-${doc.id}`,
                        title: data.titulo || data.nome || 'Sem título',
                        description: data.descricao || data.conteudo?.substring(0, 100) || '',
                        filePath: data.arquivo || '',
                        categoria: data.categoria || col.replace('_documentos', ''),
                        codigo: data.codigo || '',
                        type: col,
                        icon: 'fa-file-pdf',
                        actionType: 'open',
                        actionTarget: data.arquivo
                    });
                });

                console.log(`  ✓ ${col}: ${snapshot.size} documentos`);
            } catch (error) {
                console.error(`  ✗ Erro em ${col}:`, error);
            }
        }
    },

    /**
     * Carrega ROPs
     */
    loadROPs() {
        if (!window.ropsData) {
            console.warn('⚠️ ropsData não disponível');
            return;
        }

        for (const [macroKey, macro] of Object.entries(window.ropsData)) {
            for (const [subKey, sub] of Object.entries(macro.subdivisoes || {})) {
                this.allDocuments.push({
                    id: `rop-${macroKey}-${subKey}`,
                    title: sub.title || subKey,
                    description: `${macro.title} - ${sub.questions?.length || 0} questões`,
                    filePath: '',
                    categoria: 'ROPs',
                    codigo: subKey,
                    type: 'rop',
                    icon: 'fa-clipboard-check',
                    actionType: 'navigate',
                    actionTarget: 'showROPsDesafio'
                });
            }
        }
    },

    /**
     * Carrega calculadoras
     */
    loadCalculadoras() {
        const calculadoras = [
            { id: 'morse', nome: 'Escala de Morse', desc: 'Avaliação de risco de quedas', fn: 'showEscalaMorse' },
            { id: 'apfel', nome: 'Apfel Score', desc: 'Risco de náusea e vômito pós-operatório', fn: 'showApfelScore' },
            { id: 'mews', nome: 'MEWS', desc: 'Escore de alerta precoce modificado', fn: 'showMEWS' },
            { id: 'glasgow', nome: 'Glasgow', desc: 'Escala de coma de Glasgow', fn: 'showGlasgow' }
        ];

        calculadoras.forEach(calc => {
            this.allDocuments.push({
                id: `calc-${calc.id}`,
                title: calc.nome,
                description: calc.desc,
                filePath: '',
                categoria: 'Calculadoras',
                codigo: calc.id,
                type: 'calculadora',
                icon: 'fa-calculator',
                actionType: 'navigate',
                actionTarget: calc.fn
            });
        });
    },

    /**
     * Carrega podcasts
     */
    loadPodcasts() {
        if (!window.podcastsData) {
            console.warn('⚠️ podcastsData não disponível');
            return;
        }

        // podcastsData é um objeto com categorias, não array
        for (const [categoryKey, category] of Object.entries(window.podcastsData)) {
            if (!category.audios || !Array.isArray(category.audios)) continue;

            category.audios.forEach((podcast, idx) => {
                this.allDocuments.push({
                    id: `podcast-${categoryKey}-${idx}`,
                    title: podcast.titulo || podcast.title || 'Podcast',
                    description: podcast.descricao || category.title || '',
                    filePath: podcast.url || '',
                    categoria: 'Podcasts',
                    codigo: '',
                    type: 'podcast',
                    icon: 'fa-podcast',
                    actionType: 'navigate',
                    actionTarget: 'showPodcastsROPs'
                });
            });
        }
    },

    /**
     * Carrega funcionalidades do app
     */
    loadFuncionalidades() {
        const funcionalidades = [
            { nome: 'Painel de Qualidade', desc: 'Gestão da qualidade e indicadores', action: 'showPainelQualidade' },
            { nome: 'Minhas Pendências', desc: 'Comunicados e documentos não lidos', action: 'showPendencias' },
            { nome: 'Residência Médica', desc: 'Gestão de residentes', action: 'showResidencia' },
            { nome: 'ROPs Quiz', desc: 'Desafio de conhecimento Qmentum', action: 'showROPsDesafio' },
            { nome: 'Biblioteca de Protocolos', desc: 'Protocolos clínicos', action: 'showBiblioteca' }
        ];

        funcionalidades.forEach((func, idx) => {
            this.allDocuments.push({
                id: `func-${idx}`,
                title: func.nome,
                description: func.desc,
                filePath: '',
                categoria: 'Funcionalidades',
                codigo: '',
                type: 'funcionalidade',
                icon: 'fa-cogs',
                actionType: 'navigate',
                actionTarget: func.action
            });
        });
    },

    /**
     * Executa busca
     */
    search(query) {
        if (!this.initialized || !query || query.trim().length < 2) {
            return [];
        }

        const results = this.miniSearch.search(query.trim(), {
            fuzzy: 0.2,
            prefix: true
        });

        console.log(`🔍 Busca: "${query}" → ${results.length} resultados`);
        return results;
    },

    /**
     * Renderiza resultados
     */
    renderResults(results, container) {
        if (!container) {
            console.error('Container não encontrado');
            return;
        }

        if (!results || results.length === 0) {
            container.innerHTML = `
                <div class="search-no-results">
                    <i class="fas fa-search"></i>
                    <p>Nenhum resultado encontrado</p>
                </div>
            `;
            container.style.display = 'block';
            container.classList.add('active');
            return;
        }

        // Agrupar por tipo
        const grouped = {};
        results.forEach(r => {
            const type = r.type || 'outros';
            if (!grouped[type]) grouped[type] = [];
            grouped[type].push(r);
        });

        let html = '<div class="search-results-container">';

        for (const [type, items] of Object.entries(grouped)) {
            const typeName = {
                'biblioteca_documentos': 'Protocolos',
                'medicamentos_documentos': 'Medicamentos',
                'infeccao_documentos': 'Controle de Infecção',
                'comunicados': 'Comunicados',
                'kpi_documentos': 'Indicadores de Qualidade',
                'auditorias_documentos': 'Auditorias',
                'rop': 'ROPs',
                'calculadora': 'Calculadoras',
                'podcast': 'Podcasts',
                'funcionalidade': 'Funcionalidades'
            }[type] || type;

            html += `
                <div class="search-category">
                    <h4 class="search-category-title">
                        <i class="fas ${items[0].icon}"></i> ${typeName}
                        <span class="result-count">(${items.length})</span>
                    </h4>
            `;

            items.slice(0, 5).forEach(item => {
                html += `
                    <div class="search-result-item" data-id="${item.id}">
                        <div class="result-icon">
                            <i class="fas ${item.icon}"></i>
                        </div>
                        <div class="result-content">
                            <span class="result-title">${this.escapeHtml(item.title)}</span>
                            <span class="result-desc">${this.escapeHtml(item.description)}</span>
                        </div>
                    </div>
                `;
            });

            html += '</div>';
        }

        html += '</div>';
        container.innerHTML = html;
        container.style.display = 'block';
        container.classList.add('active');

        // Adicionar listeners
        this.attachListeners(container);
    },

    /**
     * Anexa event listeners
     */
    attachListeners(container) {
        const items = container.querySelectorAll('.search-result-item');

        items.forEach(item => {
            item.addEventListener('click', () => {
                const doc = this.allDocuments.find(d => d.id === item.dataset.id);
                if (!doc) return;

                // Fechar dropdown
                this.hideResults();

                // Limpar campo de busca
                const searchInput = document.getElementById('globalSearch');
                if (searchInput) {
                    searchInput.value = '';
                    searchInput.blur();
                }

                // Executar ação
                if (doc.actionType === 'open' && doc.actionTarget) {
                    if (typeof window.openDocument === 'function') {
                        window.openDocument(doc.actionTarget, doc.title);
                    }
                } else if (doc.actionType === 'navigate' && doc.actionTarget) {
                    if (typeof window[doc.actionTarget] === 'function') {
                        window[doc.actionTarget]();
                    } else {
                        console.error(`Função ${doc.actionTarget} não encontrada`);
                    }
                }
            });
        });
    },

    /**
     * Esconde resultados
     */
    hideResults() {
        const container = document.getElementById('searchResults');
        if (container) {
            container.style.display = 'none';
            container.classList.remove('active');
        }
    },

    /**
     * Escapa HTML para prevenir XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Exportar para window
window.AnestSearch = AnestSearch;

console.log('✅ Simple Search carregado (MiniSearch)');

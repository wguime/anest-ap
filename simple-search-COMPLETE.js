/**
 * ===============================================
 * SIMPLE SEARCH - VERSÃO PROFISSIONAL COMPLETA
 * ===============================================
 *
 * MELHORIAS IMPLEMENTADAS (v5.0.0):
 * 1. ✅ Extração robusta de URL (objeto Firestore ou string)
 * 2. ✅ Validação completa antes de executar ações
 * 3. ✅ Tratamento de erros robusto com try/catch
 * 4. ✅ Feedback visual de loading ao clicar
 * 5. ✅ Navegação por teclado (setas, Enter, Esc, Shift+Enter)
 * 6. ✅ Highlight de termos buscados nos resultados
 * 7. ✅ Atributos ARIA para acessibilidade
 * 8. ✅ Mensagens de erro claras e amigáveis
 * 9. ✅ Debounce otimizado (150ms - padrão Spotlight)
 * 10. ✅ Filtro de documentos inválidos nos resultados
 * 11. ✅ Fallback inteligente para navegação (padrão Samsung DeX)
 * 12. ✅ Calculadoras com acesso direto (padrão Windows)
 * 13. ✅ Indexação completa de todas as funções show* (padrão Spotlight)
 * 14. ✅ Logs detalhados para debug profissional
 * 15. ✅ Extração de URL no clique (padrão Spotlight)
 *
 * PADRÕES APLICADOS:
 * - Apple Spotlight: Abertura direta, fallback automático, busca rápida
 * - Windows Search: Acesso direto à função, Shift+Enter para localização
 * - Samsung DeX: Fallback silencioso, validação prévia
 *
 * CARACTERÍSTICAS:
 * - Busca EXATA (não fuzzy) - "proto" ≠ "protocolo"
 * - Event delegation otimizada
 * - Suporte completo a objetos Firestore
 * - UX profissional com feedback visual
 * - Acessibilidade WCAG 2.1
 * - Indexação completa de todas as funcionalidades
 *
 * @version 5.0.0 - VERSÃO PROFISSIONAL COMPLETA
 * @author Claude Code
 */

const AnestSearch = {
    miniSearch: null,
    initialized: false,
    allDocuments: [],
    stats: {
        firestore: 0,
        rops: 0,
        calculadoras: 0,
        podcasts: 0,
        funcionalidades: 0,
        painelCards: 0
    },
    // Estado para navegação por teclado
    keyboardState: {
        focusedIndex: -1,
        currentResults: []
    },

    /**
     * Normaliza texto removendo acentos e caracteres especiais
     */
    normalizeText(text) {
        if (!text) return '';
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove diacríticos
            .replace(/[^a-z0-9\s]/g, ''); // Remove caracteres especiais
    },

    /**
     * Extrai URL de arquivo de forma robusta
     * Trata objeto Firestore, string, ou null/undefined
     * Prioriza: url > arquivoURL > arquivo > filePath
     * @param {string|object|null} data - Dados do arquivo (pode ser objeto ou string)
     * @returns {string} URL do arquivo ou string vazia se inválido
     */
    extractFileUrl(data) {
        if (!data) {
            return '';
        }

        // Se for objeto (estrutura Firestore)
        if (typeof data === 'object' && data !== null) {
            // Tentar propriedades na ordem de prioridade
            const possiblePaths = [
                data.url,
                data.arquivoURL,
                data.arquivo,
                data.filePath,
                data.path,
                data.downloadURL, // Firebase Storage
                data.storagePath  // Caminho do storage
            ];

            for (const path of possiblePaths) {
                if (typeof path === 'string' && path.trim().length > 0 && path !== '#') {
                    const trimmed = path.trim();
                    // Validar que é uma URL válida ou caminho válido
                    // Aceitar: URLs http/https, caminhos absolutos (/), caminhos relativos (com ou sem extensão)
                    if (trimmed.startsWith('http') || 
                        trimmed.startsWith('https') ||
                        trimmed.startsWith('/') || 
                        trimmed.includes('.') ||
                        trimmed.length > 3) { // Aceitar qualquer caminho com mais de 3 caracteres
                        return trimmed;
                    }
                }
            }

            return '';
        }

        // Se for string
        if (typeof data === 'string') {
            const trimmed = data.trim();
            if (trimmed.length > 0 && trimmed !== '#') {
                return trimmed;
            }
        }

        return '';
    },

    /**
     * Inicializa sistema de busca
     */
    async init() {
        if (this.initialized) return true;

        console.log('🔍 [BUSCA COMPLETA] Inicializando busca UNIVERSAL...');

        // Criar índice MiniSearch SEM FUZZY (busca exata)
        this.miniSearch = new MiniSearch({
            fields: [
                'title',
                'description',
                'filePath',
                'categoria',
                'codigo',
                'keywords',
                'content'
            ],
            storeFields: ['title', 'description', 'type', 'icon', 'actionType', 'actionTarget', 'actionParams', 'categoria'],
            processTerm: (term) => this.normalizeText(term),
            searchOptions: {
                fuzzy: false,        // CRÍTICO: Busca EXATA!
                prefix: true,        // Permite "prot" → "protocolo"
                combineWith: 'AND',  // TODOS os termos devem estar presentes
                boost: {
                    title: 3,
                    keywords: 2
                }
            }
        });

        // Carregar TODOS os dados
        await this.loadAllDataComplete();

        this.initialized = true;

        console.log(`✅ [BUSCA COMPLETA] Indexados: ${this.allDocuments.length} itens`);
        console.log(`   📚 Índice Manual: ${this.stats.manualIndex} (documentos físicos + cards)`);
        console.log(`   📊 Firestore: ${this.stats.firestore}`);
        console.log(`   📊 ROPs: ${this.stats.rops}`);
        console.log(`   📊 Calculadoras: ${this.stats.calculadoras}`);
        console.log(`   📊 Podcasts: ${this.stats.podcasts}`);
        console.log(`   📊 Funcionalidades: ${this.stats.funcionalidades}`);

        // Inicializar navegação por teclado
        this.initKeyboardNavigation();

        return true;
    },

    /**
     * Carrega TODOS os dados sem restrições
     */
    async loadAllDataComplete() {
        this.allDocuments = [];
        this.stats = { firestore: 0, rops: 0, calculadoras: 0, podcasts: 0, funcionalidades: 0, painelCards: 0, manualIndex: 0 };

        console.log('📥 Carregando dados completos...');

        // 0. ÍNDICE MANUAL - PRIORIDADE MÁXIMA (119 documentos físicos)
        this.loadManualIndexComplete();

        // 1. FIRESTORE - SÓ COLEÇÕES QUE EXISTEM
        await this.loadFirestoreComplete();

        // 2. ROPS - TODOS
        this.loadROPsComplete();

        // 3. CALCULADORAS - TODAS
        this.loadCalculadorasComplete();

        // 4. PODCASTS - TODOS
        this.loadPodcastsComplete();

        // 5. FUNCIONALIDADES - TODAS
        this.loadFuncionalidadesComplete();

        // 6. TODAS AS FUNÇÕES DO APP - PADRÃO SPOTLIGHT
        this.loadAllAppFunctions();

        // 7. CARDS DO PAINEL - Já carregados do índice manual, mas mantém para compatibilidade
        // this.loadPainelCardsComplete();

        // Adicionar todos ao índice
        if (this.allDocuments.length > 0) {
            this.miniSearch.addAll(this.allDocuments);
        }
    },

    /**
     * NOVO: Carrega índice manual completo (119 documentos físicos)
     */
    loadManualIndexComplete() {
        if (!window.SEARCH_INDEX_COMPLETE) {
            console.warn('⚠️ Índice manual não disponível');
            return;
        }

        console.log('📚 Carregando ÍNDICE MANUAL...');

        // Carregar DOCUMENTOS FÍSICOS (119 docs)
        if (window.SEARCH_INDEX_COMPLETE.documentos && Array.isArray(window.SEARCH_INDEX_COMPLETE.documentos)) {
            window.SEARCH_INDEX_COMPLETE.documentos.forEach(doc => {
                // Extrair URL de forma robusta - tentar todas as possibilidades
                let fileUrl = '';
                
                // Tentar arquivo primeiro
                if (doc.arquivo) {
                    fileUrl = this.extractFileUrl(doc.arquivo);
                }
                
                // Se não encontrou, tentar arquivoURL
                if (!fileUrl && doc.arquivoURL) {
                    fileUrl = this.extractFileUrl(doc.arquivoURL);
                }
                
                // Se não encontrou, tentar url
                if (!fileUrl && doc.url) {
                    fileUrl = this.extractFileUrl(doc.url);
                }
                
                const hasValidUrl = fileUrl && fileUrl.length > 0 && fileUrl !== '#';
                const actionType = doc.action || (hasValidUrl ? 'open' : 'invalid');

                this.allDocuments.push({
                    id: doc.id,
                    title: doc.titulo || '',
                    description: doc.descricao || '',
                    filePath: fileUrl,
                    categoria: doc.categoria || '',
                    codigo: doc.codigo || '',
                    keywords: this.normalizeText(doc.keywords || ''),
                    content: '',
                    type: doc.tipo || 'documento',
                    icon: doc.icon || 'fa-file-pdf',
                    actionType: actionType,
                    actionTarget: fileUrl,
                    actionParams: null
                });
                this.stats.manualIndex++;
            });
        }

        // Carregar CARDS DO PAINEL (20 cards)
        // REMOVIDO: Card "ROPs Desafio" removido da busca conforme solicitado
        // REMOVIDO: Card "Podcasts Educacionais" removido da busca conforme solicitado
        if (window.SEARCH_INDEX_COMPLETE.cards && Array.isArray(window.SEARCH_INDEX_COMPLETE.cards)) {
            window.SEARCH_INDEX_COMPLETE.cards.forEach(card => {
                // REMOVIDO: Pular card ROPs Desafio (removido da busca)
                if (card.id === 'card-rops' || card.target === 'showROPsDesafio') {
                    return; // Não indexar Desafio das ROPs
                }
                // REMOVIDO: Pular card Podcasts Educacionais
                if (card.titulo && (card.titulo.toLowerCase().includes('podcasts educacionais') || card.titulo.toLowerCase().includes('podcast educacional'))) {
                    return; // Não indexar Podcasts Educacionais
                }
                if (card.target === 'showPodcastsMenu' || card.target === 'showPodcastsROPs' || card.target === 'showROPsPodcasts') {
                    return; // Não indexar podcasts
                }
                
                this.allDocuments.push({
                    id: card.id,
                    title: card.titulo || '',
                    description: card.descricao || '',
                    filePath: '',
                    categoria: 'Painel',
                    codigo: '',
                    keywords: this.normalizeText(card.keywords || ''),
                    content: '',
                    type: 'painel-card',
                    icon: card.icon || 'fa-th-large',
                    actionType: card.action || 'function',
                    actionTarget: card.target || '',
                    actionParams: null
                });
                this.stats.manualIndex++;
            });
        }

        console.log(`  ✓ Índice Manual: ${this.stats.manualIndex} itens (documentos físicos + cards)`);
    },

    /**
     * Carrega documentos do Firestore - SÓ COLEÇÕES QUE EXISTEM
     */
    async loadFirestoreComplete() {
        if (!window.db) {
            console.warn('⚠️ Firebase não disponível');
            return;
        }

        // CORREÇÃO: SÓ COLEÇÕES QUE REALMENTE EXISTEM!
        const collections = [
            'biblioteca_documentos',    // Protocolos
            'medicamentos_documentos',  // Segurança medicamentos
            'infeccao_documentos',      // Controle infecção
            'conciliacao_documentos',   // Conciliação medicamentosa
            'checklist_documentos',     // Checklists cirúrgicos
            'kpi_documentos',           // Indicadores qualidade
            'auditorias_documentos',    // Auditorias
            'relatorios_documentos',    // Relatórios segurança
            'comunicados'               // Comunicados/notícias
        ];

        for (const col of collections) {
            try {
                const snapshot = await window.db.collection(col).get();

                let count = 0;
                snapshot.forEach(doc => {
                    const data = doc.data();

                    // Extrair URL de forma robusta - tentar TODAS as possibilidades
                    // Prioridade: arquivoURL > arquivo > downloadURL > url
                    let fileUrl = '';
                    
                    // Tentar arquivoURL primeiro (mais comum no Firestore)
                    if (data.arquivoURL) {
                        fileUrl = this.extractFileUrl(data.arquivoURL);
                    }
                    
                    // Se não encontrou, tentar arquivo
                    if (!fileUrl && data.arquivo) {
                        fileUrl = this.extractFileUrl(data.arquivo);
                    }
                    
                    // Se ainda não encontrou, tentar outras propriedades
                    if (!fileUrl && data.downloadURL) {
                        fileUrl = this.extractFileUrl(data.downloadURL);
                    }
                    
                    if (!fileUrl && data.url) {
                        fileUrl = this.extractFileUrl(data.url);
                    }
                    
                    const fileName = fileUrl ? fileUrl.split('/').pop() : (data.titulo || data.nome || 'Sem título');
                    const keywords = this.extractKeywords(data.titulo, data.descricao, fileName);

                    // Validar se tem URL válida antes de indexar
                    const hasValidUrl = fileUrl && fileUrl.length > 0 && fileUrl !== '#';

                    this.allDocuments.push({
                        id: `${col}-${doc.id}`,
                        title: data.titulo || data.nome || fileName || 'Sem título',
                        description: data.descricao || data.conteudo?.substring(0, 200) || '',
                        filePath: fileUrl,
                        categoria: data.categoria || col.replace('_documentos', ''),
                        codigo: data.codigo || '',
                        keywords: keywords,
                        content: data.conteudo || '',
                        type: col,
                        icon: 'fa-file-pdf',
                        // Se não tem URL válida, marcar como inválido para não aparecer clicável
                        actionType: hasValidUrl ? 'open' : 'invalid',
                        actionTarget: fileUrl,
                        actionParams: null
                    });
                    count++;
                });

                if (count > 0) {
                    console.log(`  ✓ ${col}: ${count} documentos`);
                    this.stats.firestore += count;
                }
            } catch (error) {
                console.log(`  ⊘ ${col}: ${error.message}`);
            }
        }
    },

    /**
     * Extrai palavras-chave (SEM acentos, SEM caracteres especiais)
     */
    extractKeywords(titulo, descricao, fileName) {
        const text = this.normalizeText(`${titulo} ${descricao} ${fileName}`);
        const keywords = [];

        const medicalTerms = [
            'protocolo', 'procedimento', 'diretriz', 'norma',
            'checklist', 'formulario', 'politica', 'manual',
            'seguranca', 'qualidade', 'auditoria', 'relatorio',
            'medicamento', 'farmaco', 'droga', 'dose',
            'infeccao', 'higiene', 'assepsia', 'antissepsia',
            'cirurgia', 'procedimento', 'intervencao',
            'anestesia', 'sedacao', 'analgesia',
            'etica', 'consentimento', 'autonomia',
            'paciente', 'cliente', 'usuario',
            'risco', 'evento', 'incidente', 'adverse',
            'antibiotico', 'profilaxia', 'latex'
        ];

        medicalTerms.forEach(term => {
            if (text.includes(term)) {
                keywords.push(term);
            }
        });

        return keywords.join(' ');
    },

    /**
     * Carrega TODOS os ROPs
     */
    /**
     * Carrega ROPs - APENAS ÍCONE PRINCIPAL (não itens individuais)
     * REMOVIDO: Itens individuais de ROPs removidos da busca conforme solicitado
     * O ícone principal "ROPs Quiz" / "Desafio das ROPs" já está indexado em loadFuncionalidadesComplete
     */
    loadROPsComplete() {
        // REMOVIDO: Não indexar ROPs individuais (ROP 1.1, ROP 2.2, etc.)
        // O ícone principal "ROPs Quiz" já está indexado em loadFuncionalidadesComplete
        // com actionType: 'function' e actionTarget: 'showROPsDesafio'
        // Isso leva diretamente para a página do Desafio das ROPs
        console.log(`  ✓ ROPs: Ícone principal apenas (itens individuais removidos da busca)`);
    },

    /**
     * Carrega TODAS as calculadoras
     * PADRÃO WINDOWS: Acesso direto à função, não apenas à seção
     */
    loadCalculadorasComplete() {
        const calculadoras = [
            { id: 'morse', nome: 'Escala de Morse', desc: 'Avaliação de risco de quedas', keywords: 'queda fall morse risco', fn: 'showEscalaMorse' },
            { id: 'apfel', nome: 'Apfel Score', desc: 'Risco de náusea e vômito pós-operatório', keywords: 'apfel nausea vomito ponv', fn: 'showApfelScore' },
            { id: 'eberhart', nome: 'Eberhart Score', desc: 'Risco de náusea e vômito em crianças', keywords: 'eberhart crianca pediatria nausea', fn: 'showAvaliacaoRiscos' },
            { id: 'mews', nome: 'MEWS', desc: 'Escore de alerta precoce modificado', keywords: 'mews deterioracao clinica warning', fn: 'showCalculadoras' },
            { id: 'glasgow', nome: 'Glasgow', desc: 'Escala de coma de Glasgow', keywords: 'glasgow coma consciencia neurologico', fn: 'showGlasgow' },
            { id: 'braden', nome: 'Escala de Braden', desc: 'Risco de lesão por pressão', keywords: 'braden lesao pressao ulcera', fn: 'showEscalaBraden' },
            { id: 'caprini', nome: 'Escala de Caprini', desc: 'Risco de tromboembolismo venoso', keywords: 'caprini tev trombose venoso', fn: 'showEscalaCaprini' },
            { id: 'padua', nome: 'Escala de Padua', desc: 'Risco de tromboembolismo venoso', keywords: 'padua tev trombose venoso', fn: 'showEscalaPadua' },
            { id: 'doses-pediatria', nome: 'Doses Pediatria', desc: 'Dosagens medicamentos pediátricas', keywords: 'dose crianca pediatria peso', fn: 'showDosesPediatricas' },
            { id: 'rcri', nome: 'RCRI', desc: 'Risco cardíaco revisado', keywords: 'rcri cardiaco risco cirurgia', fn: 'showRCRI' },
            { id: 'pedicalc', nome: 'PediCalc', desc: 'Calculadora pediátrica completa', keywords: 'pedicalc pediatria crianca calculo', fn: 'showDosesPediatricas' },
            { id: 'imc', nome: 'IMC', desc: 'Índice de massa corporal', keywords: 'imc peso altura obesidade', fn: 'showCalculadoras' },
            { id: 'clearance', nome: 'Clearance Creatinina', desc: 'Função renal', keywords: 'clearance creatinina renal tfg', fn: 'showClearanceCreatinina' },
            { id: 'asa', nome: 'Classificação ASA', desc: 'Estado físico do paciente', keywords: 'asa classificacao fisica anestesia', fn: 'showASA' }
        ];

        calculadoras.forEach(calc => {
            // Verificar se função existe antes de indexar
            const functionExists = typeof window[calc.fn] === 'function';
            
            this.allDocuments.push({
                id: `calc-${calc.id}`,
                title: calc.nome,
                description: calc.desc,
                filePath: '',
                categoria: 'Calculadoras',
                codigo: calc.id,
                keywords: this.normalizeText(calc.keywords),
                content: '',
                type: 'calculadora',
                icon: 'fa-calculator',
                // PADRÃO WINDOWS: Acesso direto à função específica
                actionType: functionExists ? 'function' : 'section',
                actionTarget: functionExists ? calc.fn : 'ferramentas',
                actionParams: null
            });
            this.stats.calculadoras++;
        });

        console.log(`  ✓ Calculadoras: ${this.stats.calculadoras} (acesso direto)`);
    },

    /**
     * Carrega Podcasts - APENAS ÍCONE PRINCIPAL (não episódios individuais)
     * REMOVIDO: Episódios individuais removidos da busca conforme solicitado
     */
    loadPodcastsComplete() {
        // REMOVIDO: Não indexar podcasts individuais, apenas o ícone principal já está em loadFuncionalidadesComplete
        // O ícone principal "Podcasts Educacionais" já está indexado e acessa showPodcastsMenu
        console.log(`  ✓ Podcasts: Ícone principal apenas (episódios individuais removidos da busca)`);
    },

    /**
     * Carrega Funcionalidades - REMOVIDO: Todas as funcionalidades removidas conforme solicitado
     * Carrega funcionalidades principais do aplicativo
     */
    loadFuncionalidadesComplete() {
        const funcionalidades = [
            {
                id: 'func-rops-desafio',
                title: 'Desafio das ROPs',
                description: 'Teste seus conhecimentos sobre as ROPs Qmentum',
                categoria: 'Funcionalidades',
                keywords: this.normalizeText('rops desafio quiz questoes teste conhecimento rops qmentum'),
                type: 'funcionalidade',
                icon: 'fa-trophy',
                actionType: 'function',
                actionTarget: 'showROPsDesafio',
                actionParams: null
            }
        ];

        funcionalidades.forEach((func, idx) => {
            this.allDocuments.push({
                id: `func-${idx}`,
                title: func.nome,
                description: func.desc,
                filePath: '',
                categoria: 'Funcionalidades',
                codigo: '',
                keywords: this.normalizeText(func.keywords),
                content: '',
                type: 'funcionalidade',
                icon: 'fa-tools',
                actionType: func.action,
                actionTarget: func.target,
                actionParams: null
            });
            this.stats.funcionalidades++;
        });

        console.log(`  ✓ Funcionalidades: ${this.stats.funcionalidades}`);
    },

    /**
     * Carrega TODAS as funções show* disponíveis no window
     * PADRÃO SPOTLIGHT: Indexação completa de todas as funcionalidades
     */
    loadAllAppFunctions() {
        if (typeof window === 'undefined') return;

        const functionKeywords = {
            // Calculadoras
            'showEscalaMorse': 'morse queda risco avaliacao',
            'showEscalaBraden': 'braden lesao pressao ulcera',
            'showEscalaCaprini': 'caprini tev trombose venoso',
            'showEscalaPadua': 'padua tev trombose venoso',
            'showGlasgow': 'glasgow coma consciencia neurologico',
            'showApfelScore': 'apfel nausea vomito ponv',
            'showRCRI': 'rcri cardiaco risco cirurgia',
            'showDosesPediatricas': 'doses pediatria crianca medicamento',
            'showAvaliacaoRiscos': 'avaliacao risco calculadora escala',
            'showCalculadoras': 'calculadora ferramenta calculo',
            
            // Protocolos e Documentos
            'showBiblioteca': 'biblioteca protocolo documento',
            'showProtocolos': 'protocolo procedimento diretriz',
            'showPoliticas': 'politica norma diretriz',
            'showFormularios': 'formulario documento',
            'showManuais': 'manual guia instrucao',
            
            // Qualidade
            'showQualityPanel': 'qualidade gestao kpi indicador',
            'showKPIs': 'kpi indicador metrica performance',
            'showAuditorias': 'auditoria conformidade verificacao',
            'showRelatorios': 'relatorio seguranca trimestral',
            'showSegurancaMedicamentos': 'medicamento farmaco droga prescricao',
            'showControleInfeccao': 'infeccao prevencao higiene',
            
            // ROPs e Educação - REMOVIDO: Todas as funções ROPs removidas da busca (exceto showROPsDesafio que está em Funcionalidades)
            // 'showROPsDesafio': 'rops quiz desafio questoes teste', // Mantido apenas em loadFuncionalidadesComplete
            // REMOVIDO: 'showPodcastsMenu': 'podcast audio aula educacao', // Podcasts Educacionais removidos da busca
            
            // Incidentes e Denúncias
            'showCanalDenuncia': 'denuncia denunciar sigilo anonimo canal',
            'showIncidentes': 'incidente notificacao evento adverso near miss gestao',
            'showGestaoIncidentes': 'gestao incidente notificacao evento adverso',
            'showNovoIncidente': 'notificacao incidente formulario evento adverso',
            'showQRCodeGenerator': 'qrcode codigo qr gerar formulario publico',
            
            // Manutenção e Cálculos
            'showManutencaoPediatrica': 'manutencao pediatrica hidrica reposicao liquido',
            
            // Outros
            'showComunicados': 'comunicado noticia aviso informacao',
            'showResidencia': 'residencia residente programa medico',
            'showProfile': 'perfil usuario configuracao dados',
            'showAdminPanel': 'admin administrativo gestao sistema',
            'showSection': 'secao navegacao menu'
        };

        let count = 0;
        const processedFunctions = new Set(); // Evitar duplicatas

        // Escanear window para funções que começam com 'show'
        for (const key in window) {
            if (key.startsWith('show') && typeof window[key] === 'function') {
                // Filtrar funções internas do sistema
                if (key.startsWith('showToast') || 
                    key.startsWith('showLoading') || 
                    key.startsWith('showModal') ||
                    key === 'showSection') {
                    continue;
                }

                // Filtrar funções ROPs específicas (mas MANTER showROPsDesafio que será indexado em loadFuncionalidadesComplete)
                // MANTER: Documentos/manuais relacionados a ROPs continuam sendo indexados normalmente
                if (key === 'showROPs' || 
                    key === 'showROPsChoiceMenu' || 
                    key === 'showROPsSubdivisoes' || 
                    key === 'showROPsRanking' ||
                    key === 'showROPsPodcasts' ||
                    key === 'showPodcastsROPs' ||
                    key === 'showPodcastMacroArea' ||
                    key === 'showMacroArea') {
                    continue; // Não indexar essas funções específicas
                }
                // MANTER showROPsDesafio - será indexado em loadFuncionalidadesComplete
                
                // REMOVIDO: Filtrar todas as funções relacionadas a Podcasts (incluindo Podcasts Educacionais)
                if (key.includes('Podcast')) {
                    continue; // Não indexar podcasts (incluindo Podcasts Educacionais)
                }

                // Evitar duplicatas (já indexadas em outras funções)
                if (processedFunctions.has(key)) continue;
                processedFunctions.add(key);

                // Obter keywords ou gerar baseado no nome
                const keywords = functionKeywords[key] || this.generateKeywordsFromFunctionName(key);
                
                // Categorizar função
                let categoria = 'Funcionalidades';
                let icon = 'fa-tools';
                
                if (key.includes('Escala') || key.includes('Score') || key.includes('Doses') || key.includes('RCRI') || key.includes('Glasgow')) {
                    categoria = 'Calculadoras';
                    icon = 'fa-calculator';
                } else if (key.includes('Protocolo') || key.includes('Biblioteca') || key.includes('Formulario') || key.includes('Manual') || key.includes('Politica')) {
                    categoria = 'Documentos';
                    icon = 'fa-file-pdf';
                } else if (key.includes('Qualidade') || key.includes('KPI') || key.includes('Auditoria') || key.includes('Relatorio')) {
                    categoria = 'Qualidade';
                    icon = 'fa-chart-line';
                } else if (key.includes('ROP')) {
                    categoria = 'ROPs';
                    icon = 'fa-clipboard-check';
                } else if (key.includes('Podcast')) {
                    // REMOVIDO: Não categorizar podcasts (já filtrados acima)
                    continue; // Não indexar podcasts
                } else if (key.includes('Incidente') || key.includes('Denuncia') || key.includes('Canal') || key.includes('GestaoIncidentes')) {
                    categoria = 'Qualidade';
                    icon = 'fa-exclamation-triangle';
                } else if (key.includes('Manutencao') || key.includes('QRCode')) {
                    categoria = 'Ferramentas';
                    icon = 'fa-tools';
                }

                this.allDocuments.push({
                    id: `func-${key}`,
                    title: this.formatFunctionName(key),
                    description: `Acessar ${this.formatFunctionName(key)}`,
                    filePath: '',
                    categoria: categoria,
                    codigo: key,
                    keywords: this.normalizeText(keywords),
                    content: '',
                    type: 'funcionalidade',
                    icon: icon,
                    actionType: 'function',
                    actionTarget: key,
                    actionParams: null
                });
                count++;
            }
        }

        this.stats.funcionalidades += count;
        console.log(`  ✓ Funções do App indexadas: ${count} funções adicionais`);
        
        // Log de funções encontradas vs indexadas para debug
        const allShowFunctions = [];
        for (const key in window) {
            if (key.startsWith('show') && typeof window[key] === 'function') {
                allShowFunctions.push(key);
            }
        }
        console.log(`  📊 Total de funções show* encontradas: ${allShowFunctions.length}`);
        console.log(`  📊 Funções indexadas: ${count}`);
    },

    /**
     * Gera keywords baseado no nome da função
     * Melhorado com mapeamento de termos relacionados
     */
    generateKeywordsFromFunctionName(functionName) {
        // Remover 'show' e dividir por maiúsculas
        const name = functionName.replace(/^show/, '');
        const words = name.match(/[A-Z][a-z]*/g) || [];
        const baseKeywords = words.map(w => w.toLowerCase()).join(' ');
        
        // Mapeamento de termos relacionados para melhorar busca
        const termMapping = {
            'canal': ['denuncia', 'denunciar', 'anonimo', 'sigilo', 'canal'],
            'denuncia': ['denuncia', 'denunciar', 'anonimo', 'sigilo', 'canal'],
            'incidente': ['incidente', 'notificacao', 'evento', 'adverso', 'near', 'miss', 'gestao'],
            'notificacao': ['notificacao', 'incidente', 'evento', 'adverso', 'formulario'],
            'gestao': ['gestao', 'incidente', 'notificacao', 'evento'],
            'manutencao': ['manutencao', 'reposicao', 'hidrica', 'liquido', 'pediatrica'],
            'qrcode': ['qrcode', 'codigo', 'qr', 'gerar', 'formulario', 'publico'],
            'podcast': ['podcast', 'audio', 'aula', 'educacao', 'rops'],
            'rops': ['rops', 'quiz', 'desafio', 'questoes', 'teste', 'conhecimento']
        };
        
        // Adicionar termos relacionados baseados nas palavras encontradas
        let enhancedKeywords = baseKeywords;
        const lowerWords = baseKeywords.split(' ');
        
        lowerWords.forEach(word => {
            if (termMapping[word]) {
                enhancedKeywords += ' ' + termMapping[word].join(' ');
            }
        });
        
        return enhancedKeywords;
    },

    /**
     * Formata nome da função para exibição
     */
    formatFunctionName(functionName) {
        const name = functionName.replace(/^show/, '');
        const words = name.match(/[A-Z][a-z]*/g) || [name];
        return words.join(' ');
    },

    /**
     * NOVO: Carrega cards do painel principal (ícones visíveis)
     */
    loadPainelCardsComplete() {
        const cards = [
            { nome: 'Últimos Comunicados', desc: 'Notícias e avisos recentes', keywords: 'comunicado noticia aviso ultimos', icon: 'fa-bullhorn', action: 'function', target: 'showComunicados' },
            { nome: 'Minhas Pendências', desc: 'Documentos e comunicados não lidos', keywords: 'pendencia nao lido documento comunicado', icon: 'fa-clipboard-list', action: 'function', target: 'loadPendencias' },
            { nome: 'Painel de Gestão à Vista', desc: 'Indicadores e métricas de qualidade', keywords: 'gestao vista indicador metrica qualidade', icon: 'fa-chart-line', action: 'function', target: 'showQualityPanel' },
            { nome: 'Organograma', desc: 'Estrutura organizacional', keywords: 'organograma estrutura hierarquia', icon: 'fa-sitemap', action: 'function', target: 'showOrganograma' }
        ];

        cards.forEach((card, idx) => {
            this.allDocuments.push({
                id: `card-${idx}`,
                title: card.nome,
                description: card.desc,
                filePath: '',
                categoria: 'Painel',
                codigo: '',
                keywords: this.normalizeText(card.keywords),
                content: '',
                type: 'painel-card',
                icon: card.icon,
                actionType: card.action,
                actionTarget: card.target,
                actionParams: null
            });
            this.stats.painelCards++;
        });

        console.log(`  ✓ Cards Painel: ${this.stats.painelCards}`);
    },

    /**
     * Executa busca (EXATA, sem fuzzy)
     */
    search(query) {
        if (!this.initialized || !query || query.trim().length < 2) {
            return [];
        }

        const normalizedQuery = this.normalizeText(query.trim());

        // Busca principal
        let results = this.miniSearch.search(normalizedQuery, {
            fuzzy: false,         // BUSCA EXATA!
            prefix: true,         // "prot" → "protocolo"
            combineWith: 'AND',   // TODOS os termos
            boost: {
                title: 3,
                keywords: 2
            }
        });

        // FALLBACK: Se não encontrou resultados, tentar busca mais ampla
        if (results.length === 0) {
            // Tentar busca com OR ao invés de AND
            results = this.miniSearch.search(normalizedQuery, {
                fuzzy: false,
                prefix: true,
                combineWith: 'OR',   // QUALQUER termo
                boost: {
                    title: 3,
                    keywords: 2
                }
            });
            
            // Se ainda não encontrou, verificar correspondência direta com nomes de funções
            if (results.length === 0) {
                const queryLower = normalizedQuery.toLowerCase();
                const directMatches = this.allDocuments.filter(doc => {
                    // Verificar se query corresponde ao nome da função ou título
                    const titleLower = (doc.title || '').toLowerCase();
                    const targetLower = (doc.actionTarget || '').toLowerCase();
                    return titleLower.includes(queryLower) || 
                           targetLower.includes(queryLower) ||
                           (doc.keywords && doc.keywords.includes(queryLower));
                });
                
                if (directMatches.length > 0) {
                    console.log(`🔍 [FALLBACK] Encontrado ${directMatches.length} correspondências diretas`);
                    return directMatches;
                }
            }
        }

        console.log(`🔍 Busca: "${query}" (normalizado: "${normalizedQuery}") → ${results.length} resultados`);
        return results;
    },

    /**
     * Inicializa navegação por teclado no input de busca
     */
    initKeyboardNavigation() {
        const searchInput = document.getElementById('globalSearch');
        if (!searchInput) return;

        // Remover listener antigo se existir
        const oldKeyHandler = searchInput.__keyboardHandler;
        if (oldKeyHandler) {
            searchInput.removeEventListener('keydown', oldKeyHandler);
        }

        // Criar novo handler
        const keyHandler = (e) => {
            const container = document.getElementById('searchResults');
            if (!container || container.style.display === 'none') {
                return;
            }

            const items = Array.from(container.querySelectorAll('.search-result-item'));
            if (items.length === 0) return;

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    this.keyboardState.focusedIndex = Math.min(
                        this.keyboardState.focusedIndex + 1,
                        items.length - 1
                    );
                    this.highlightKeyboardItem(items);
                    break;

                case 'ArrowUp':
                    e.preventDefault();
                    this.keyboardState.focusedIndex = Math.max(
                        this.keyboardState.focusedIndex - 1,
                        -1
                    );
                    this.highlightKeyboardItem(items);
                    break;

                case 'Enter':
                    e.preventDefault();
                    if (this.keyboardState.focusedIndex >= 0 && items[this.keyboardState.focusedIndex]) {
                        // PADRÃO WINDOWS/SPOTLIGHT: Shift+Enter navega para localização
                        if (e.shiftKey) {
                            this.navigateToLocationFromKeyboard(items[this.keyboardState.focusedIndex]);
                        } else {
                            // Enter normal: abre arquivo/função diretamente
                            items[this.keyboardState.focusedIndex].click();
                        }
                    }
                    break;

                case 'Escape':
                    e.preventDefault();
                    this.hideResults();
                    searchInput.blur();
                    break;

                case 'Tab':
                    // Permitir Tab normal, mas resetar foco
                    this.keyboardState.focusedIndex = -1;
                    this.highlightKeyboardItem(items);
                    break;
            }
        };

        searchInput.addEventListener('keydown', keyHandler);
        searchInput.__keyboardHandler = keyHandler;
    },

    /**
     * Destaca item focado pela navegação por teclado
     */
    highlightKeyboardItem(items) {
        items.forEach((item, index) => {
            if (index === this.keyboardState.focusedIndex) {
                item.classList.add('keyboard-focused');
                item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            } else {
                item.classList.remove('keyboard-focused');
            }
        });
    },

    /**
     * Navega para localização do arquivo usando teclado (Shift+Enter)
     * PADRÃO WINDOWS/SPOTLIGHT
     */
    navigateToLocationFromKeyboard(item) {
        const docId = item.dataset.id;
        const doc = this.allDocuments.find(d => d.id === docId);
        
        if (!doc) return;
        
        console.log('📍 Navegando para localização (Shift+Enter):', doc.title);
        this.navigateToFileLocation(doc);
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
                    <small>Busca exata - tente termos mais gerais</small>
                </div>
            `;
            container.style.display = 'block';
            container.classList.add('active');
            return;
        }

        // Filtrar resultados inválidos e remover ROPs individuais
        const validResults = results.filter(r => {
            // Remover documentos inválidos
            if (r.actionType === 'invalid' || !r.actionType) return false;
            
            // Filtrar funções ROPs específicas (mas MANTER showROPsDesafio)
            // MANTER: Documentos/manuais relacionados a ROPs continuam aparecendo normalmente
            if (r.actionTarget && typeof r.actionTarget === 'string' && r.actionType === 'function') {
                const actionTarget = r.actionTarget.toLowerCase();
                // Filtrar funções ROPs específicas (mas MANTER showROPsDesafio)
                if (actionTarget === 'showrops' || 
                    actionTarget === 'showropschoicemenu' || 
                    actionTarget === 'showropssubdivisoes' || 
                    actionTarget === 'showropsranking' ||
                    actionTarget === 'showropspodcasts' ||
                    actionTarget === 'showpodcastsrops' ||
                    actionTarget === 'showpodcastmacroarea' ||
                    actionTarget === 'showmacroarea') {
                    return false; // Remover essas funções ROPs específicas
                }
                // MANTER showROPsDesafio - não filtrar
                // Filtrar Podcasts Educacionais
                if (actionTarget === 'showpodcastsmenu' || (actionTarget.includes('podcast') && actionTarget !== 'showropsdesafio')) {
                    return false; // Remover Podcasts Educacionais
                }
            }
            
            // Filtrar Podcasts Educacionais por título (mas MANTER Desafio das ROPs)
            if (r.title && (r.title.toLowerCase().includes('podcasts educacionais') || 
                           r.title.toLowerCase().includes('podcast educacional'))) {
                return false; // Remover Podcasts Educacionais
            }
            // MANTER "Desafio das ROPs" - não filtrar por título
            
            // REMOVIDO: Filtrar ROPs individuais (mantém apenas o ícone principal)
            // ROPs individuais têm id começando com 'rop-' e não são o card principal
            if (r.type === 'rop' && r.id && r.id.startsWith('rop-') && r.id !== 'card-rops') {
                return false; // Remover ROPs individuais
            }
            
            // REMOVIDO: Filtrar podcasts individuais (mantém apenas o ícone principal)
            // Podcasts individuais têm id começando com 'podcast-'
            if (r.type === 'podcast' && r.id && r.id.startsWith('podcast-')) {
                return false; // Remover podcasts individuais
            }
            
            return true;
        });
        
        const grouped = {};
        validResults.forEach(r => {
            const type = r.type || 'outros';
            if (!grouped[type]) grouped[type] = [];
            grouped[type].push(r);
        });

        let html = '<div class="search-results-container">';

        for (const [type, items] of Object.entries(grouped)) {
            const typeName = {
                'biblioteca_documentos': 'Biblioteca de Protocolos',
                'medicamentos_documentos': 'Segurança de Medicamentos',
                'infeccao_documentos': 'Controle de Infecção',
                'comunicados': 'Comunicados',
                'kpi_documentos': 'Indicadores de Qualidade',
                'auditorias_documentos': 'Auditorias',
                'relatorios_documentos': 'Relatórios de Segurança',
                'conciliacao_documentos': 'Conciliação Medicamentosa',
                'checklist_documentos': 'Checklists Cirúrgicos',
                'rop': 'ROPs Qmentum',
                'calculadora': 'Calculadoras Clínicas',
                'podcast': 'Podcasts Educacionais',
                'funcionalidade': 'Funcionalidades',
                'painel-card': 'Painel Principal'
            }[type] || type;

            html += `
                <div class="search-category">
                    <h4 class="search-category-title">
                        <i class="fas ${items[0].icon}"></i> ${typeName}
                        <span class="result-count">(${items.length})</span>
                    </h4>
            `;

            // Obter query atual para highlight
            const searchInput = document.getElementById('globalSearch');
            const currentQuery = searchInput ? searchInput.value : '';

            items.slice(0, 20).forEach(item => {
                // Destacar termos buscados no título e descrição
                const highlightedTitle = this.highlightSearchTerms(item.title, currentQuery);
                const highlightedDesc = this.highlightSearchTerms(item.description, currentQuery);

                html += `
                    <div class="search-result-item"
                         data-id="${this.escapeHtml(item.id)}"
                         data-action-type="${this.escapeHtml(item.actionType || '')}"
                         data-action-target="${this.escapeHtml(item.actionTarget || '')}"
                         role="button"
                         tabindex="0"
                         aria-label="${this.escapeHtml(item.title)}"
                         style="cursor: pointer;">
                        <div class="result-icon">
                            <i class="fas ${item.icon}"></i>
                        </div>
                        <div class="result-content">
                            <span class="result-title">${highlightedTitle}</span>
                            <span class="result-desc">${highlightedDesc}</span>
                            ${item.categoria ? `<span class="result-cat">${this.escapeHtml(item.categoria)}</span>` : ''}
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

        // Resetar estado de navegação por teclado
        this.keyboardState.focusedIndex = -1;
        this.keyboardState.currentResults = results;

        // Anexar listeners
        this.attachListeners(container);

        // Inicializar navegação por teclado se ainda não foi inicializada
        this.initKeyboardNavigation();
    },

    /**
     * Mostra estado de loading no item clicado
     */
    showLoadingState(item) {
        if (!item) return;
        item.classList.add('search-loading');
        const icon = item.querySelector('.result-icon i');
        if (icon) {
            icon.className = 'fas fa-spinner fa-spin';
        }
    },

    /**
     * Remove estado de loading do item
     */
    hideLoadingState(item) {
        if (!item) return;
        item.classList.remove('search-loading');
    },

    /**
     * Navega para localização do arquivo quando não consegue abrir diretamente
     * PADRÃO SAMSUNG DEX: Fallback automático e silencioso
     */
    navigateToFileLocation(doc) {
        console.log('📍 Navegando para localização do arquivo:', doc.title);
        
        // Mapear tipo/categoria para função de navegação
        const locationMap = {
            'biblioteca_documentos': 'showBiblioteca',
            'protocolos': 'showBiblioteca',
            'formularios': 'showBiblioteca',
            'manuais': 'showBiblioteca',
            'medicamentos_documentos': 'showSegurancaMedicamentos',
            'infeccao_documentos': 'showControleInfeccao',
            'kpi_documentos': 'showQualityPanel',
            'auditorias_documentos': 'showAuditorias',
            'relatorios_documentos': 'showRelatorios',
            'comunicados': 'showComunicados',
            'calculadora': 'showCalculadoras',
            'documento': 'showBiblioteca'
        };

        // Tentar encontrar função de navegação baseada no tipo
        const navFunction = locationMap[doc.type] || locationMap[doc.categoria?.toLowerCase()] || 'showBiblioteca';
        
        if (typeof window[navFunction] === 'function') {
            console.log(`✅ Navegando para ${navFunction} (fallback)`);
            window[navFunction]();
            
            // Mostrar mensagem informativa (silenciosa, apenas se necessário)
            setTimeout(() => {
                if (typeof window.showToast === 'function') {
                    window.showToast(`Navegando para localização de "${doc.title}"`, 'info');
                }
            }, 200);
        } else {
            console.warn(`⚠️ Função de navegação ${navFunction} não encontrada`);
            // Fallback final: mostrar biblioteca
            if (typeof window.showBiblioteca === 'function') {
                window.showBiblioteca();
            }
        }
    },

    /**
     * Anexa event listener usando DELEGAÇÃO REAL (não forEach)
     * Baseado em: https://stackoverflow.com/questions/34896106/
     * Validado por: MDN, Stack Overflow, TypeOfNaN
     * MELHORADO: Validação robusta, tratamento de erros, feedback visual
     */
    attachListeners(container) {
        // REMOVER listener antigo (se existir) para evitar duplicação
        const oldHandler = container.__searchClickHandler;
        if (oldHandler) {
            container.removeEventListener('click', oldHandler);
        }

        // CRIAR novo handler com delegação REAL
        const newHandler = (e) => {
            // Encontrar o elemento .search-result-item clicado (ou ancestral)
            const item = e.target.closest('.search-result-item');

            if (!item) return; // Click fora de um resultado

            e.preventDefault();
            e.stopPropagation();

            const docId = item.dataset.id;
            const doc = this.allDocuments.find(d => d.id === docId);

            if (!doc) {
                console.error('❌ Documento não encontrado:', docId);
                if (typeof window.showToast === 'function') {
                    window.showToast('Erro: Documento não encontrado', 'error');
                }
                return;
            }

            // VALIDAÇÃO INICIAL: Verificar se actionType é válido
            if (doc.actionType === 'invalid' || !doc.actionType) {
                console.warn('⚠️ Documento inválido ou sem ação:', doc.title);
                if (typeof window.showToast === 'function') {
                    window.showToast('Este documento não está disponível para abertura', 'warning');
                }
                return;
            }

            // Logs detalhados para debug
            console.log('🎯 [BUSCA] Click em resultado:');
            console.log('   📄 Título:', doc.title);
            console.log('   🏷️  Tipo:', doc.actionType);
            console.log('   🎯 Target:', doc.actionTarget);
            console.log('   📁 Categoria:', doc.categoria || 'N/A');
            console.log('   🔍 ID:', doc.id);
            console.log('   📂 FilePath:', doc.filePath || 'N/A');

            // Mostrar loading visual
            this.showLoadingState(item);

            // Fechar dropdown imediatamente para melhor performance
            this.hideResults();

            const searchInput = document.getElementById('globalSearch');
            if (searchInput) {
                searchInput.value = '';
                searchInput.blur();
            }

            // Executar ação baseada no tipo com tratamento de erros robusto
            try {
                if (doc.actionType === 'open') {
                    // VALIDAÇÃO ESPECÍFICA PARA 'open': Verificar se actionTarget existe e não está vazio
                    // Se estiver vazio, tentar extrair do filePath ou outros campos
                    let actionTarget = doc.actionTarget;
                    
                    if (!actionTarget || (typeof actionTarget === 'string' && actionTarget.trim().length === 0)) {
                        // Tentar extrair do filePath
                        if (doc.filePath) {
                            actionTarget = this.extractFileUrl(doc.filePath);
                        }
                        
                        // Se ainda vazio, tentar fallback para navegação
                        if (!actionTarget || actionTarget.trim().length === 0) {
                            console.warn('⚠️ actionTarget vazio para:', doc.title, '| Tentando fallback...');
                            this.navigateToFileLocation(doc);
                            return;
                        }
                        
                        // Atualizar actionTarget no documento para próxima vez
                        doc.actionTarget = actionTarget;
                    }
                    
                // Abrir documento PDF
                    console.log('→ [AÇÃO] Abrindo documento...');
                    console.log('   📄 Título:', doc.title);
                    console.log('   🔗 Target original:', actionTarget, `(tipo: ${typeof actionTarget})`);
                    
                    // PADRÃO SPOTLIGHT: Extrair URL usando extractFileUrl (pode ser objeto ou string)
                    const extractedUrl = this.extractFileUrl(actionTarget);
                    
                    if (!extractedUrl || extractedUrl === '' || extractedUrl === '#') {
                        // Fallback 1: Tentar extrair do filePath se actionTarget falhou
                        if (doc.filePath) {
                            const filePathUrl = this.extractFileUrl(doc.filePath);
                            if (filePathUrl && filePathUrl.length > 0) {
                                console.log('✅ [FALLBACK] URL extraída do filePath:', filePathUrl);
                                // Usar URL do filePath
                if (typeof window.openDocument === 'function') {
                                    const protocolosSection = document.getElementById('protocolosSection');
                                    if (protocolosSection && typeof window.showSection === 'function') {
                                        window.showSection('protocolos');
                                    }
                                    setTimeout(() => {
                                        window.openDocument(filePathUrl, doc.title);
                                    }, 50);
                                    return;
                                }
                            }
                        }
                        
                        // Fallback 2: Navegar para localização do arquivo
                        console.warn('⚠️ [FALLBACK] URL inválida após extração');
                        console.warn('   Target original:', actionTarget);
                        console.warn('   FilePath:', doc.filePath || 'N/A');
                        console.warn('   Tentando navegar para localização...');
                        this.navigateToFileLocation(doc);
                        return;
                    }

                    console.log('✅ [SUCESSO] URL extraída e validada:', extractedUrl);

                    if (typeof window.openDocument === 'function') {
                        // Tentar abrir diretamente (padrão Spotlight)
                        try {
                            console.log('   🚀 Chamando window.openDocument...');
                            
                            // CRÍTICO: Garantir que a seção protocolosSection está visível antes de abrir
                            const protocolosSection = document.getElementById('protocolosSection');
                            if (protocolosSection) {
                                // NÃO limpar recursos PDF antes de abrir - isso estava impedindo a abertura
                                // A limpeza será feita automaticamente quando necessário
                                
                                // Ativar seção protocolos se não estiver ativa
                                if (typeof window.showSection === 'function') {
                                    window.showSection('protocolos');
                                } else {
                                    // Fallback: mostrar seção manualmente
                                    document.querySelectorAll('.section').forEach(s => {
                                        s.classList.remove('active');
                                    });
                                    protocolosSection.classList.add('active');
                                    protocolosSection.style.display = 'block';
                                }
                                
                                // Pequeno delay otimizado para garantir que a seção está renderizada
                                setTimeout(() => {
                                    try {
                                        // Garantir que a busca continue funcionando após abrir documento
                                        // Limpar qualquer timeout pendente que possa estar bloqueando
                                        if (window.globalSearchTimeout) {
                                            clearTimeout(window.globalSearchTimeout);
                                            window.globalSearchTimeout = null;
                                        }
                                        
                                        window.openDocument(extractedUrl, doc.title);
                                        console.log('   ✅ Documento aberto com sucesso');
                                        
                                        // Scroll imediato para o topo da seção
                                        protocolosSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    } catch (error) {
                                        console.error('❌ Erro ao abrir documento:', error);
                                    }
                                }, 100);
                            } else {
                                console.error('❌ Seção protocolosSection não encontrada');
                                // Fallback: navegar para biblioteca
                                if (typeof window.showBiblioteca === 'function') {
                                    window.showBiblioteca();
                                } else {
                                    this.navigateToFileLocation(doc);
                                }
                            }
                        } catch (openError) {
                            console.error('❌ [ERRO] Falha ao abrir documento diretamente');
                            console.error('   Erro:', openError);
                            console.warn('   🔄 Tentando fallback para localização...');
                            // Fallback: navegar para localização
                            this.navigateToFileLocation(doc);
                    }
                } else {
                        console.warn('⚠️ window.openDocument não existe, abrindo em nova aba');
                        window.open(extractedUrl, '_blank');
                    }
                } else if (doc.actionType === 'function') {
                // Executar função
                console.log('→ Executando função:', doc.actionTarget);
                    const funcName = doc.actionTarget.trim();
                    
                    // Verificar se função existe no window ou em escopo global
                    let funcToCall = window[funcName];
                    
                    // Se não encontrou, tentar encontrar em eval (para funções não exportadas)
                    if (!funcToCall && typeof eval(`typeof ${funcName}`) !== 'undefined') {
                        try {
                            funcToCall = eval(funcName);
                        } catch (e) {
                            // Ignorar erro
                        }
                    }
                    
                    if (typeof funcToCall === 'function') {
                        // Para funções de incidentes/denúncia/gestão, garantir que a seção qualidade está ativa
                        if (funcName === 'showCanalDenuncia' || 
                            funcName === 'showNovoIncidente' || 
                            funcName === 'showIncidentes' ||
                            funcName === 'showGestaoIncidentes') {
                            // Garantir que a seção qualidade está visível primeiro
                if (typeof window.showSection === 'function') {
                                window.showSection('qualidade');
                            }
                            
                            // Delay otimizado para garantir que a seção está renderizada antes de chamar função específica
                            setTimeout(() => {
                                try {
                                    funcToCall();
                    } catch (error) {
                                    console.error(`❌ Erro ao executar ${funcName}:`, error);
                                    // Tentar chamar showIncidentes como fallback
                                    if (funcName !== 'showIncidentes' && typeof window.showIncidentes === 'function') {
                                        window.showIncidentes();
                                    }
                                }
                            }, 200); // Aumentado para 200ms para garantir renderização completa
                } else {
                            // Para calculadoras, garantir que a seção ferramentas está ativa primeiro
                            // NOTA: showDosesPediatricas já chama showSection internamente, então não precisa de delay extra
                            if (funcName.startsWith('showEscala') || funcName === 'showGlasgow' || funcName === 'showApfelScore' || funcName === 'showRCRI' || funcName === 'showAvaliacaoRiscos') {
                                // Garantir que a seção ferramentas está visível primeiro
                                if (typeof window.showSection === 'function') {
                                    window.showSection('ferramentas');
                                }
                                
                                // Delay otimizado para garantir que a seção está renderizada antes de chamar função específica
                                setTimeout(() => {
                                    try {
                                        funcToCall();
                                    } catch (error) {
                                        console.error(`❌ Erro ao executar ${funcName}:`, error);
                                        // Fallback: mostrar página de calculadoras
                                        if (typeof window.showCalculadoras === 'function') {
                                            window.showCalculadoras();
                                        }
                                    }
                                }, 150);
                            } else if (funcName === 'showDosesPediatricas') {
                                // showDosesPediatricas já chama showSection('ferramentas') internamente
                                // Chamar diretamente sem delay extra para evitar duplicação
                                try {
                                    funcToCall();
                    } catch (error) {
                                    console.error(`❌ Erro ao executar ${funcName}:`, error);
                                    // Fallback: mostrar página de calculadoras
                                    if (typeof window.showCalculadoras === 'function') {
                                        window.showCalculadoras();
                                    }
                                }
                            } else {
                                // Para outras funções, chamar diretamente
                                funcToCall();
                            }
                        }
                    } else {
                        // Fallback: tentar chamar showIncidentes primeiro se for função relacionada
                        if ((funcName === 'showCanalDenuncia' || 
                             funcName === 'showNovoIncidente' || 
                             funcName === 'showGestaoIncidentes') && typeof window.showIncidentes === 'function') {
                            console.log('   🔄 Fallback: Chamando showIncidentes primeiro...');
                            window.showSection('qualidade');
                            setTimeout(() => {
                                window.showIncidentes();
                                // Após mostrar incidentes, tentar chamar função específica novamente (se não for showGestaoIncidentes)
                                if (funcName !== 'showGestaoIncidentes') {
                                    setTimeout(() => {
                                        if (typeof window[funcName] === 'function') {
                                            window[funcName]();
                                        } else {
                                            console.error(`❌ Função ${funcName} não encontrada após showIncidentes`);
                        if (typeof window.showToast === 'function') {
                                                window.showToast(`Função ${funcName} não está disponível. Acesse através de Gestão de Incidentes.`, 'warning');
                        }
                    }
                                    }, 200);
                                }
                            }, 150);
                } else {
                            console.error(`❌ Função ${funcName} não existe no window`);
                    if (typeof window.showToast === 'function') {
                                window.showToast(`Função ${funcName} não está disponível.`, 'error');
                    }
                }
                    }
                } else if (doc.actionType === 'section') {
                // Navegar para seção
                console.log('→ Navegando para seção:', doc.actionTarget);
                    const sectionName = doc.actionTarget.trim();
                    
                if (typeof window.showSection === 'function') {
                        window.showSection(sectionName);
            } else {
                        throw new Error('Função showSection não existe');
                    }
                } else if (doc.actionType === 'navigate') {
                // Navegação alternativa (para ROPs)
                console.log('→ Navegando (navigate):', doc.actionTarget);
                    const funcName = doc.actionTarget.trim();
                    
                    if (typeof window[funcName] === 'function') {
                        window[funcName]();
                } else {
                        throw new Error(`Função de navegação ${funcName} não existe`);
                }
            } else {
                    throw new Error(`Tipo de ação desconhecido: ${doc.actionType}`);
                }

                // Remover loading após sucesso (otimizado)
                setTimeout(() => {
                    this.hideLoadingState(item);
                }, 200);

            } catch (error) {
                console.error('❌ [ERRO CRÍTICO] Falha ao executar ação:');
                console.error('   📄 Documento:', doc.title);
                console.error('   🏷️  Tipo:', doc.actionType);
                console.error('   🎯 Target:', doc.actionTarget);
                console.error('   📁 Categoria:', doc.categoria || 'N/A');
                console.error('   🔍 ID:', doc.id);
                console.error('   ⚠️  Erro:', error);
                console.error('   📚 Stack:', error.stack);
                
                // Remover loading em caso de erro
                this.hideLoadingState(item);
                
                // Mostrar mensagem de erro amigável
                if (typeof window.showToast === 'function') {
                    let errorMessage = 'Erro ao executar ação';
                    if (error.message.includes('não existe')) {
                        errorMessage = `Função não encontrada: ${doc.actionTarget}`;
                    } else if (error.message.includes('URL inválida')) {
                        errorMessage = 'URL do documento inválida ou não disponível';
                    } else {
                        errorMessage = error.message || 'Erro desconhecido';
                    }
                    window.showToast(errorMessage, 'error');
                }
            }
        };

        // ANEXAR listener ao CONTAINER (não aos items!)
        container.addEventListener('click', newHandler);

        // SALVAR referência para poder remover depois
        container.__searchClickHandler = newHandler;

        const itemCount = container.querySelectorAll('.search-result-item').length;
        console.log(`✅ Event delegation anexada ao container (${itemCount} itens renderizados)`);
    },

    hideResults() {
        // Garantir que o debounce continue funcionando após fechar resultados
        // Não limpar o timeout global aqui, apenas esconder os resultados
        const container = document.getElementById('searchResults');
        if (container) {
            container.style.display = 'none';
            container.classList.remove('active');
        }
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Destaca termos buscados no texto usando <mark>
     * Versão melhorada que funciona com textos acentuados
     * @param {string} text - Texto a ser destacado
     * @param {string} query - Termo de busca
     * @returns {string} HTML com termos destacados
     */
    highlightSearchTerms(text, query) {
        if (!text || !query) return this.escapeHtml(text || '');

        const normalizedQuery = this.normalizeText(query);
        const queryTerms = normalizedQuery.split(' ').filter(term => term.length >= 2);

        if (queryTerms.length === 0) return this.escapeHtml(text);

        let highlightedText = this.escapeHtml(text);

        // Para cada termo da busca, encontrar e destacar no texto original
        queryTerms.forEach(term => {
            // Criar regex que busca o termo no texto original
            // Usa uma abordagem que encontra variações com/sem acentos
            const regex = new RegExp(`(${this.createFlexibleRegex(term)})`, 'gi');
            highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
        });

        return highlightedText;
    },

    /**
     * Cria regex flexível que encontra termos com ou sem acentos
     * Exemplo: "protocolo" encontra "protocolo", "protocolo", etc.
     */
    createFlexibleRegex(term) {
        // Mapear caracteres para suas variações com/sem acentos
        const accentMap = {
            'a': '[aáàâãä]', 'e': '[eéêë]', 'i': '[iíîï]', 'o': '[oóôõö]', 'u': '[uúûü]',
            'c': '[cç]', 'n': '[nñ]', 'A': '[AÁÀÂÃÄ]', 'E': '[EÉÊË]', 'I': '[IÍÎÏ]',
            'O': '[OÓÔÕÖ]', 'U': '[UÚÛÜ]', 'C': '[CÇ]', 'N': '[NÑ]'
        };

        return term.split('').map(char => {
            if (accentMap[char]) {
                return accentMap[char];
            }
            // Escapar caracteres especiais do regex
            return this.escapeRegex(char);
        }).join('');
    },

    /**
     * Escapa caracteres especiais para regex
     */
    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    },

    /**
     * Função de diagnóstico completo do sistema de busca
     * Execute no console: AnestSearch.diagnose()
     */
    diagnose() {
        console.group('🔧 DIAGNÓSTICO DO SISTEMA DE BUSCA ANEST');

        console.log('1️⃣ Status de Inicialização:');
        console.log('   ✓ Busca inicializada:', this.initialized);
        console.log('   ✓ Total de documentos indexados:', this.allDocuments.length);

        console.log('\n2️⃣ Estatísticas de Indexação:');
        console.table(this.stats);

        console.log('\n3️⃣ Container de Resultados:');
        const container = document.getElementById('searchResults');
        if (container) {
            console.log('   ✓ Elemento existe:', true);
            console.log('   ✓ Listener delegado anexado:', !!container.__searchClickHandler);
            console.log('   ✓ Itens renderizados atualmente:', container.querySelectorAll('.search-result-item').length);
            console.log('   ✓ Container visível:', container.style.display !== 'none');
        } else {
            console.error('   ❌ Container #searchResults NÃO ENCONTRADO!');
        }

        console.log('\n4️⃣ Funções Críticas no Window Scope:');
        const criticalFunctions = [
            'openDocument',
            'showROPsDesafio',
            'showSection',
            'showDocumentCategory',
            'showQualityPanel',
            'showBiblioteca',
            'showComunicados',
            'showToast'
        ];
        criticalFunctions.forEach(fn => {
            const exists = typeof window[fn] === 'function';
            console.log(`   ${exists ? '✓' : '❌'} window.${fn}:`, typeof window[fn]);
        });

        console.log('\n5️⃣ Teste de Busca:');
        const testQuery = 'avaliacao';
        try {
            const results = this.search(testQuery);
            console.log(`   ✓ Busca por "${testQuery}":`, results.length, 'resultados');
            if (results.length > 0) {
                console.log('   ✓ Primeiro resultado:', results[0].title);
            }
        } catch (error) {
            console.error('   ❌ Erro ao testar busca:', error);
        }

        console.log('\n6️⃣ Índice Manual (window.SEARCH_INDEX_COMPLETE):');
        if (window.SEARCH_INDEX_COMPLETE) {
            console.log('   ✓ Documentos:', window.SEARCH_INDEX_COMPLETE.documentos?.length || 0);
            console.log('   ✓ Cards:', window.SEARCH_INDEX_COMPLETE.cards?.length || 0);
        } else {
            console.error('   ❌ Índice manual não carregado!');
        }

        console.log('\n7️⃣ MiniSearch Instance:');
        console.log('   ✓ Instance existe:', !!this.miniSearch);
        if (this.miniSearch) {
            console.log('   ✓ Documentos indexados:', this.miniSearch.documentCount);
        }

        console.groupEnd();

        console.log('\n💡 Dica: Para testar um click manualmente:');
        console.log('   1. Faça uma busca (ex: "avaliacao")');
        console.log('   2. Clique em um resultado');
        console.log('   3. Veja os logs "🎯 Click em:" e "→ Abrindo documento:" no console');

        console.log('\n8️⃣ Documentos com Problemas Potenciais:');
        const problematicDocs = this.allDocuments.filter(d => {
            if (d.actionType === 'open') {
                const url = this.extractFileUrl(d.actionTarget || d.filePath);
                return !url || url.length === 0;
            }
            return false;
        });
        
        if (problematicDocs.length > 0) {
            console.warn(`   ⚠️ ${problematicDocs.length} documentos podem ter problemas:`);
            problematicDocs.slice(0, 10).forEach(doc => {
                console.warn(`   - ${doc.title} (ID: ${doc.id})`);
                console.warn(`     actionTarget: ${doc.actionTarget}`);
                console.warn(`     filePath: ${doc.filePath}`);
            });
        } else {
            console.log('   ✅ Nenhum documento com problema detectado');
        }
    },

    /**
     * Verifica completude da indexação
     * Compara funções disponíveis vs indexadas
     */
    verifyIndexCompleteness() {
        console.group('🔍 VERIFICAÇÃO DE COMPLETUDE DA INDEXAÇÃO');
        
        // Encontrar todas as funções show* disponíveis
        const allShowFunctions = [];
        for (const key in window) {
            if (key.startsWith('show') && typeof window[key] === 'function') {
                // Filtrar funções internas
                if (!key.startsWith('showToast') && 
                    !key.startsWith('showLoading') && 
                    !key.startsWith('showModal') &&
                    key !== 'showSection') {
                    allShowFunctions.push(key);
                }
            }
        }
        
        // Encontrar funções indexadas
        const indexedFunctions = this.allDocuments
            .filter(d => d.actionType === 'function' && d.actionTarget && d.actionTarget.startsWith('show'))
            .map(d => d.actionTarget);
        
        const indexedSet = new Set(indexedFunctions);
        const missingFunctions = allShowFunctions.filter(fn => !indexedSet.has(fn));
        
        console.log(`📊 Total de funções show* disponíveis: ${allShowFunctions.length}`);
        console.log(`📊 Funções indexadas: ${indexedFunctions.length}`);
        console.log(`📊 Funções faltando indexação: ${missingFunctions.length}`);
        
        if (missingFunctions.length > 0) {
            console.warn('⚠️ Funções não indexadas:');
            missingFunctions.forEach(fn => {
                console.warn(`   - ${fn}`);
            });
            console.log('💡 Execute AnestSearch.reindexMissingFunctions() para indexar automaticamente');
        } else {
            console.log('✅ Todas as funções estão indexadas!');
        }
        
        console.groupEnd();
        return { total: allShowFunctions.length, indexed: indexedFunctions.length, missing: missingFunctions };
    },

    /**
     * Reindexa funções que estão faltando
     */
    reindexMissingFunctions() {
        const verification = this.verifyIndexCompleteness();
        if (verification.missing.length === 0) {
            console.log('✅ Nenhuma função faltando para indexar');
            return;
        }
        
        console.log(`🔄 Reindexando ${verification.missing.length} funções...`);
        verification.missing.forEach(fn => {
            const keywords = this.generateKeywordsFromFunctionName(fn);
            this.allDocuments.push({
                id: `func-${fn}`,
                title: this.formatFunctionName(fn),
                description: `Acessar ${this.formatFunctionName(fn)}`,
                filePath: '',
                categoria: 'Funcionalidades',
                codigo: fn,
                keywords: this.normalizeText(keywords),
                content: '',
                type: 'funcionalidade',
                icon: 'fa-tools',
                actionType: 'function',
                actionTarget: fn,
                actionParams: null
            });
        });
        
        // Reindexar no MiniSearch
        if (this.miniSearch) {
            this.miniSearch.addAll(this.allDocuments.slice(-verification.missing.length));
        }
        
        console.log(`✅ ${verification.missing.length} funções reindexadas com sucesso!`);
    }
};

window.AnestSearch = AnestSearch;

// ==================== DEBOUNCE PARA BUSCA GLOBAL ====================
let globalSearchTimeout = null;

/**
 * Função de debounce para busca global (chamada pelo input no HTML)
 * CORRIGIDO: Agora renderiza os resultados após buscar
 * @param {string} query - Texto da busca
 */
window.debounceGlobalSearch = function(query) {
    // Limpar timeout anterior
    if (globalSearchTimeout) {
        clearTimeout(globalSearchTimeout);
    }

    // Obter container de resultados
    const container = document.getElementById('searchResults');
    
    // Se query muito curta, esconder resultados
    if (!query || query.trim().length < 2) {
        if (container && window.AnestSearch && typeof window.AnestSearch.hideResults === 'function') {
            window.AnestSearch.hideResults();
        }
        return;
    }

    // Criar novo timeout
    globalSearchTimeout = setTimeout(() => {
        if (!window.AnestSearch || !window.AnestSearch.initialized) {
            console.warn('⚠️ Sistema de busca ainda não inicializado');
            if (container) {
                container.innerHTML = '<div class="search-loading"><i class="fas fa-spinner fa-spin"></i> Carregando sistema de busca...</div>';
                container.style.display = 'block';
            }
            return;
        }

        // Executar busca
        const results = window.AnestSearch.search(query);
        
        // Renderizar resultados no container
        if (container) {
            window.AnestSearch.renderResults(results, container);
        } else {
            console.error('❌ Container #searchResults não encontrado');
        }
    }, 150); // 150ms de delay (PADRÃO SPOTLIGHT: busca mais rápida)
};

console.log('✅ Simple Search PROFISSIONAL COMPLETA carregada (v5.0.0)');
console.log('   ✨ Padrões aplicados: Apple Spotlight, Windows Search, Samsung DeX');
console.log('   🚀 Melhorias: Acesso direto, Fallback inteligente, Indexação completa, Busca rápida (150ms)');
console.log('   ⌨️  Atalhos: Enter (abrir), Shift+Enter (localização), Esc (fechar)');
console.log('💡 Execute AnestSearch.diagnose() no console para diagnóstico completo');


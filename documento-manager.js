// ==================== GERENCIADOR UNIVERSAL DE DOCUMENTOS ====================
// Sistema genérico para gerenciar documentos de qualquer categoria
// Data: 3 de novembro de 2025

// Função auxiliar para detectar dispositivos mobile
function isMobileDevice() {
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

// ==================== FUNÇÕES AUXILIARES DE PERMISSÕES ====================

// Mapear categoriaId para categoria de permissão
function mapCategoryToPermissionCategory(categoriaId) {
    // Mapear categorias específicas para categorias de permissão
    const categoryMap = {
        'biblioteca_documentos': 'protocolos',
        'higiene_maos': 'protocolos',
        'uso_medicamentos': 'protocolos',
        'politica_gestao_qualidade': 'politicas',
        'politica_disclosure': 'politicas',
        'trimestral': 'relatorios',
        'incidentes': 'relatorios',
        'auditorias': 'relatorios',
        'indicadores_qualidade': 'relatorios'
    };
    
    return categoryMap[categoriaId] || 'protocolos'; // Padrão: protocolos
}

// Verificar se usuário pode criar documentos na categoria
function canCreateDocumentForCategory(user, categoriaId) {
    if (!user || typeof canCreateDocument === 'undefined') {
        return false;
    }
    
    const category = mapCategoryToPermissionCategory(categoriaId);
    return canCreateDocument(user, category);
}

// Verificar se usuário pode editar documentos na categoria
function canEditDocumentForCategory(user, categoriaId) {
    if (!user || typeof canEditDocument === 'undefined') {
        return false;
    }
    
    const category = mapCategoryToPermissionCategory(categoriaId);
    return canEditDocument(user, category);
}

// Verificar se usuário pode excluir documentos na categoria
function canDeleteDocumentForCategory(user, categoriaId) {
    if (!user || typeof canDeleteDocument === 'undefined') {
        return false;
    }
    
    const category = mapCategoryToPermissionCategory(categoriaId);
    return canDeleteDocument(user, category);
}

// ==================== CONFIGURAÇÕES DAS CATEGORIAS ====================

const CATEGORIAS_DOCUMENTOS = {
    // Auditorias e Conformidades
    'higiene_maos': {
        nome: 'Higiene das Mãos',
        icone: '🧼',
        colecao: 'auditoria_higiene_maos',
        pasta: 'auditoria_higiene_maos',
        voltarPara: 'showAuditorias'
    },
    'uso_medicamentos': {
        nome: 'Uso de Medicamentos',
        icone: '💊',
        colecao: 'auditoria_uso_medicamentos',
        pasta: 'auditoria_uso_medicamentos',
        voltarPara: 'showAuditorias'
    },
    'abreviaturas': {
        nome: 'Abreviaturas Perigosas',
        icone: '❌',
        colecao: 'auditoria_abreviaturas',
        pasta: 'auditoria_abreviaturas',
        voltarPara: 'showAuditorias'
    },
    'politica_gestao_qualidade': {
        nome: 'Política de Gestão da Qualidade',
        icone: '📋',
        colecao: 'politica_gestao_qualidade',
        pasta: 'politica_gestao_qualidade',
        voltarPara: 'showAuditorias'
    },
    'politica_disclosure': {
        nome: 'Política de Disclosure',
        icone: '📄',
        colecao: 'politica_disclosure',
        pasta: 'politica_disclosure',
        voltarPara: 'showAuditorias'
    },
    
    // Relatórios de Segurança
    'trimestral': {
        nome: 'Relatório Trimestral',
        icone: '📅',
        colecao: 'relatorio_trimestral',
        pasta: 'relatorio_trimestral',
        voltarPara: 'showRelatorios'
    },
    'incidentes': {
        nome: 'Consolidado de Incidentes',
        icone: '⚠️',
        colecao: 'relatorio_incidentes',
        pasta: 'relatorio_incidentes',
        voltarPara: 'showRelatorios'
    },
    'auditorias': {
        nome: 'Relatório de Auditorias',
        icone: '🔍',
        colecao: 'relatorio_auditorias',
        pasta: 'relatorio_auditorias',
        voltarPara: 'showRelatorios'
    },
    'indicadores_qualidade': {
        nome: 'Indicadores de Qualidade',
        icone: '📊',
        colecao: 'relatorio_indicadores',
        pasta: 'relatorio_indicadores',
        voltarPara: 'showRelatorios'
    },
    
    // Biblioteca de Documentos (geral)
    'biblioteca_documentos': {
        nome: 'Biblioteca de Documentos',
        icone: '📚',
        colecao: 'biblioteca_documentos',
        pasta: 'biblioteca_documentos',
        voltarPara: 'showBibliotecaDocumentos'
    },
    
    // KPIs - Indicadores de Qualidade
    'kpi_adesao_protocolos': {
        nome: 'KPI - Adesão aos Protocolos',
        icone: '📊',
        colecao: 'kpi_adesao_protocolos',
        pasta: 'kpi_adesao_protocolos',
        voltarPara: 'showKPIs'
    },
    'kpi_taxa_infeccao': {
        nome: 'KPI - Taxa de Infecção',
        icone: '🦠',
        colecao: 'kpi_taxa_infeccao',
        pasta: 'kpi_taxa_infeccao',
        voltarPara: 'showKPIs'
    },
    
    // Biblioteca de Documentos - Medicamentos
    'medicamentos_alta_vigilancia': {
        nome: 'Medicamentos de Alta Vigilância',
        icone: '💊',
        colecao: 'doc_mav',
        pasta: 'doc_mav',
        voltarPara: 'showBibliotecaDocumentos'
    },
    'eletrolitos': {
        nome: 'Eletrólitos Concentrados',
        icone: '⚡',
        colecao: 'doc_eletrolitos',
        pasta: 'doc_eletrolitos',
        voltarPara: 'showBibliotecaDocumentos'
    },
    'heparina': {
        nome: 'Segurança no Uso da Heparina',
        icone: '💉',
        colecao: 'doc_heparina',
        pasta: 'doc_heparina',
        voltarPara: 'showBibliotecaDocumentos'
    },
    'narcoticos': {
        nome: 'Segurança dos Narcóticos',
        icone: '🔒',
        colecao: 'doc_narcoticos',
        pasta: 'doc_narcoticos',
        voltarPara: 'showBibliotecaDocumentos'
    },
    'lista_abreviaturas': {
        nome: 'Lista de Abreviaturas Perigosas',
        icone: '⚠️',
        colecao: 'doc_lista_abreviaturas',
        pasta: 'doc_lista_abreviaturas',
        voltarPara: 'showBibliotecaDocumentos'
    },
    'intoxicacao_anestesicos_locais': {
        nome: 'Intoxicação por Anestésicos Locais',
        icone: '💉',
        colecao: 'doc_intoxicacao_anestesicos',
        pasta: 'doc_intoxicacao_anestesicos',
        voltarPara: 'showBibliotecaDocumentos'
    },
    'manejo_glicemia': {
        nome: 'Manejo da Glicemia',
        icone: '🩺',
        colecao: 'doc_manejo_glicemia',
        pasta: 'doc_manejo_glicemia',
        voltarPara: 'showBibliotecaDocumentos'
    },
    
    // Protocolos
    'protocolo_higiene_maos': {
        nome: 'Protocolo de Higiene das Mãos',
        icone: '✋',
        colecao: 'protocolo_higiene_maos',
        pasta: 'protocolo_higiene_maos',
        voltarPara: 'showProtocolosPrevencao'
    },
    'prevencao_isc': {
        nome: 'Prevenção de Infecção de Sítio Cirúrgico',
        icone: '🦠',
        colecao: 'protocolo_prevencao_isc',
        pasta: 'protocolo_prevencao_isc',
        voltarPara: 'showProtocolosPrevencao'
    },
    'prevencao_ics': {
        nome: 'Prevenção de Infecção de Corrente Sanguínea',
        icone: '💉',
        colecao: 'protocolo_prevencao_ics',
        pasta: 'protocolo_prevencao_ics',
        voltarPara: 'showProtocolosPrevencao'
    },
    'prevencao_pav': {
        nome: 'Prevenção de Pneumonia Associada à Ventilação',
        icone: '🫁',
        colecao: 'protocolo_prevencao_pav',
        pasta: 'protocolo_prevencao_pav',
        voltarPara: 'showProtocolosPrevencao'
    },
    'prevencao_itu': {
        nome: 'Prevenção de Infecção do Trato Urinário',
        icone: '🚽',
        colecao: 'protocolo_prevencao_itu',
        pasta: 'protocolo_prevencao_itu',
        voltarPara: 'showProtocolosPrevencao'
    },
    'prevencao_broncoaspiracao': {
        nome: 'Prevenção da Broncoaspiração',
        icone: '🫁',
        colecao: 'protocolo_prevencao_broncoaspiracao',
        pasta: 'protocolo_prevencao_broncoaspiracao',
        voltarPara: 'showProtocolosPrevencao'
    },
    'prevencao_alergia_latex': {
        nome: 'Prevenção de Alergia ao Látex',
        icone: '🛡️',
        colecao: 'protocolo_prevencao_alergia_latex',
        pasta: 'protocolo_prevencao_alergia_latex',
        voltarPara: 'showProtocolosPrevencao'
    },
    
    // Conciliação Medicamentosa
    'conciliacao_admissao': {
        nome: 'Conciliação na Admissão',
        icone: '📥',
        colecao: 'conciliacao_admissao',
        pasta: 'conciliacao_admissao',
        voltarPara: 'showConciliacaoMedicamentosa'
    },
    'conciliacao_transferencia': {
        nome: 'Conciliação na Transferência',
        icone: '🔄',
        colecao: 'conciliacao_transferencia',
        pasta: 'conciliacao_transferencia',
        voltarPara: 'showConciliacaoMedicamentosa'
    },
    'conciliacao_alta': {
        nome: 'Conciliação na Alta',
        icone: '📤',
        colecao: 'conciliacao_alta',
        pasta: 'conciliacao_alta',
        voltarPara: 'showConciliacaoMedicamentosa'
    },
    
    // Outros
    'protocolo_institucional': {
        nome: 'Protocolo Institucional',
        icone: '📋',
        colecao: 'protocolo_institucional',
        pasta: 'protocolo_institucional',
        voltarPara: 'showConciliacaoMedicamentosa'
    },
    'checklist_cirurgia': {
        nome: 'Checklist de Cirurgia Segura',
        icone: '✅',
        colecao: 'checklist_cirurgia',
        pasta: 'checklist_cirurgia',
        voltarPara: 'showProtocolos'
    }
};

// ==================== FUNÇÃO AUXILIAR ====================

function isAdminLocal(user) {
    const adminEmails = [
        'wguime@yahoo.com.br',
        'guilherme@anest.com.br',
        'admin@anest.com.br'
    ];
    
    if (adminEmails.includes(user?.email)) {
        return true;
    }
    
    return user?.role === 'Administrador' || user?.role === 'Coordenador';
}

// ==================== GERENCIADOR UNIVERSAL ====================

class DocumentoManager {
    constructor(categoriaId) {
        this.config = CATEGORIAS_DOCUMENTOS[categoriaId];
        if (!this.config) {
            console.error(`Categoria não encontrada: ${categoriaId}`);
        }
        this.categoriaId = categoriaId;
    }
    
    // Mostrar lista de documentos
    show() {
        console.log(`${this.config.icone} ${this.config.nome} - Carregando...`);
        console.log(`📂 DocumentoManager.show() - Categoria: ${this.categoriaId}`);
        console.log(`   Configuração:`, this.config);

        // Determinar página de histórico baseado no categoriaId e voltarPara
        let historyPage = null;
        if (this.categoriaId === 'higiene_maos' || this.categoriaId === 'uso_medicamentos' || this.categoriaId === 'abreviaturas') {
            historyPage = `auditoria-${this.categoriaId.replace(/_/g, '-')}`;
        } else if (this.categoriaId === 'politica_gestao_qualidade') {
            historyPage = 'auditoria-politica-gestao-qualidade';
        } else if (this.categoriaId === 'politica_disclosure') {
            historyPage = 'auditoria-politica-disclosure';
        } else if (this.categoriaId === 'auditorias') {
            historyPage = 'relatorio-auditorias';
        } else if (this.categoriaId === 'trimestral') {
            historyPage = 'relatorio-trimestral';
        } else if (this.categoriaId === 'incidentes') {
            historyPage = 'relatorio-incidentes';
        } else if (this.categoriaId === 'indicadores_qualidade') {
            historyPage = 'relatorio-indicadores-qualidade';
        } else if (this.categoriaId === 'eletrolitos') {
            historyPage = 'doc-eletrolitos';
        } else if (this.categoriaId === 'heparina') {
            historyPage = 'doc-heparina';
        } else if (this.categoriaId === 'narcoticos') {
            historyPage = 'doc-narcoticos';
        } else if (this.categoriaId === 'medicamentos_alta_vigilancia') {
            historyPage = 'doc-medicamentos-alta-vigilancia';
        } else if (this.categoriaId === 'intoxicacao_anestesicos_locais') {
            historyPage = 'doc-intoxicacao-anestesicos-locais';
        } else if (this.categoriaId === 'manejo_glicemia') {
            historyPage = 'doc-manejo-glicemia';
        } else if (this.categoriaId === 'protocolo_higiene_maos') {
            historyPage = 'doc-protocolo-higiene-maos';
        } else if (this.categoriaId === 'prevencao_broncoaspiracao') {
            historyPage = 'doc-prevencao-broncoaspiracao';
        } else if (this.categoriaId === 'prevencao_alergia_latex') {
            historyPage = 'doc-prevencao-alergia-latex';
        } else if (this.categoriaId === 'prevencao_isc') {
            historyPage = 'doc-prevencao-isc';
        } else if (this.categoriaId === 'prevencao_ics') {
            historyPage = 'doc-prevencao-ics';
        } else if (this.categoriaId === 'prevencao_pav') {
            historyPage = 'doc-prevencao-pav';
        } else if (this.categoriaId === 'prevencao_itu') {
            historyPage = 'doc-prevencao-itu';
        } else if (this.categoriaId === 'conciliacao_admissao') {
            historyPage = 'doc-conciliacao-admissao';
        } else if (this.categoriaId === 'conciliacao_transferencia') {
            historyPage = 'doc-conciliacao-transferencia';
        } else if (this.categoriaId === 'conciliacao_alta') {
            historyPage = 'doc-conciliacao-alta';
        } else if (this.categoriaId === 'protocolo_institucional') {
            historyPage = 'doc-protocolo-institucional';
        }
        
        // Atualizar histórico de navegação
        if (historyPage && typeof atualizarHistoricoNavegacao === 'function') {
            atualizarHistoricoNavegacao(historyPage);
        }
        
        // Determinar qual section usar baseado no voltarPara
        const sectionId = (this.config.voltarPara === 'showAuditorias' || this.config.voltarPara === 'showRelatorios') 
            ? 'qualidadeSection' 
            : (this.config.voltarPara === 'showBibliotecaDocumentos' || this.config.voltarPara === 'showProtocolosPrevencao')
            ? 'protocolosSection'
            : (this.config.voltarPara === 'showConciliacaoMedicamentosa')
            ? 'ferramentasSection'
            : (this.config.voltarPara === 'showKPIs')
            ? 'painelSection'
            : 'painelSection';
        const section = document.getElementById(sectionId);

        if (!section) {
            console.error(`❌ Section ${sectionId} não encontrada!`);
            alert(`Erro: Não foi possível abrir documentos.\nSeção '${sectionId}' não encontrada.\n\nCategoria: ${this.categoriaId}`);
            return;
        }

        console.log(`   ✅ Section encontrada!`);
        // Determinar cor do gradiente baseado no tipo
        const gradient = this.config.icone.includes('💊') ? '#dc2626 0%, #ef4444 100%' :
                        this.config.icone.includes('🛡️') ? '#2563eb 0%, #3b82f6 100%' :
                        this.config.icone.includes('📋') ? '#7c3aed 0%, #a855f7 100%' :
                        '#006837 0%, #9BC53D 100%';
        
        const html = `
            ${renderInfoBanner('fas fa-file-alt', this.config.nome, `Documentos e protocolos de ${this.config.nome.toLowerCase()}`, gradient, 'voltarPagina()')}
            
            ${canCreateDocumentForCategory(currentUser, this.categoriaId) ? `
                <div style="margin-bottom: 20px; text-align: right;">
                    <button class="btn-add" onclick="docManager_${this.categoriaId}.showNovo()" style="background: #059669; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; gap: 8px;">
                        <i class="fas fa-plus"></i> Novo Documento
                    </button>
                </div>
            ` : ''}

            <div class="comunicados-list" id="docsContainer">
                <div class="info-box">
                    <i class="fas fa-spinner fa-spin"></i> Carregando documentos...
                </div>
            </div>
        `;
        
        section.innerHTML = html;
        this.loadDocs();
    }
    
    // Carregar documentos
    async loadDocs() {
        console.log(`   📥 loadDocs() - Iniciando carregamento da coleção: ${this.config.colecao}`);

        try {
            let docs;
            try {
                // Tentar com orderBy primeiro
                console.log(`   ⏳ Tentando query com orderBy...`);
                docs = await db.collection(this.config.colecao)
                    .orderBy('data', 'desc')
                    .limit(50)
                    .get();
                console.log(`   ✅ Query com orderBy bem-sucedida! Documentos encontrados: ${docs.size}`);
            } catch (orderError) {
                // Se falhar (por exemplo, falta índice), tentar sem orderBy
                console.warn('⚠️ Erro ao ordenar por data, tentando sem ordenação:', orderError);
                docs = await db.collection(this.config.colecao)
                    .limit(50)
                    .get();
                console.log(`   ✅ Query sem orderBy bem-sucedida! Documentos encontrados: ${docs.size}`);
            }
            
            const container = document.getElementById('docsContainer');
            if (docs.empty) {
                container.innerHTML = `
                    <div class="info-box">
                        <i class="fas fa-info-circle"></i> Nenhum documento disponível no momento.
                        ${canCreateDocumentForCategory(currentUser, this.categoriaId) ? '<br><br>Clique em "Novo Documento" para adicionar o primeiro documento.' : ''}
                    </div>
                `;
                return;
            }
            
            // Converter para array e ordenar por data (caso não tenha sido ordenado no servidor)
            const docsArray = [];
            docs.forEach(doc => {
                docsArray.push({ id: doc.id, data: doc.data() });
            });
            
            // Ordenar por data (mais recente primeiro)
            docsArray.sort((a, b) => {
                const dataA = a.data.data?.toDate?.() || new Date(0);
                const dataB = b.data.data?.toDate?.() || new Date(0);
                return dataB - dataA; // Descendente
            });
            
            let html = '';
            let countAtivos = 0;
            docsArray.forEach(doc => {
                const data = doc.data;
                
                // Filtrar apenas documentos ativos
                if (data.ativo === false) return;
                
                countAtivos++;
                const dataFormatada = data.data?.toDate().toLocaleDateString('pt-BR') || 'Data não disponível';
                
                html += `
                    <div class="comunicado-card" onclick="docManager_${this.categoriaId}.showDetalhe('${doc.id}')" style="cursor: pointer;">
                        <div class="comunicado-header">
                            <h3>${data.titulo}</h3>
                            <span class="comunicado-date">${dataFormatada}</span>
                        </div>
                        <p class="comunicado-preview">${data.descricao?.substring(0, 150) || ''}...</p>
                        <div class="comunicado-footer">
                            <span><i class="fas fa-user"></i> ${data.autorNome || 'Administração'}</span>
                            ${data.arquivoURL ? '<span><i class="fas fa-file-pdf"></i> PDF anexado</span>' : ''}
                        </div>
                    </div>
                `;
            });
            
            // Se não houver documentos ativos após o filtro
            if (countAtivos === 0) {
                container.innerHTML = `
                    <div class="info-box">
                        <i class="fas fa-info-circle"></i> Nenhum documento disponível no momento.
                        ${canCreateDocumentForCategory(currentUser, this.categoriaId) ? '<br><br>Clique em "Novo Documento" para adicionar o primeiro documento.' : ''}
                    </div>
                `;
                return;
            }
            
            container.innerHTML = html;
        } catch (error) {
            console.error('❌ Erro ao carregar documentos:', error);
            console.error('   Detalhes do erro:', error.message, error.code);
            alert(`Erro ao carregar documentos da categoria "${this.config.nome}".\n\nColeção: ${this.config.colecao}\nErro: ${error.message}\n\nVerifique o console para mais detalhes.`);
            const container = document.getElementById('docsContainer');
            if (container) {
                container.innerHTML = `
                    <div class="info-box" style="background: #FEE2E2; color: #991B1B;">
                        <i class="fas fa-exclamation-triangle"></i> <strong>Erro ao carregar documentos.</strong>
                        <br><br><small>${error.message}</small>
                    </div>
                `;
            }
        }
    }
    
    // Mostrar detalhes do documento
    async showDetalhe(id) {
        try {
            const doc = await db.collection(this.config.colecao).doc(id).get();
            if (!doc.exists) {
                showToast('Documento não encontrado', 'error');
                return;
            }
            
            const data = doc.data();
            const dataFormatada = data.data?.toDate().toLocaleString('pt-BR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }) || 'Data não disponível';

            // Codificar URL para Google Viewer ANTES de inserir no HTML
            const encodedURL = data.arquivoURL ? encodeURIComponent(data.arquivoURL) : '';

            // Determinar qual section usar baseado no voltarPara (mesma lógica do show())
            const sectionId = (this.config.voltarPara === 'showAuditorias' || this.config.voltarPara === 'showRelatorios')
                ? 'qualidadeSection'
                : (this.config.voltarPara === 'showBibliotecaDocumentos' || this.config.voltarPara === 'showProtocolosPrevencao')
                ? 'protocolosSection'
                : (this.config.voltarPara === 'showConciliacaoMedicamentosa')
                ? 'ferramentasSection'
                : (this.config.voltarPara === 'showKPIs')
                ? 'painelSection'
                : 'painelSection';
            const section = document.getElementById(sectionId);

            if (!section) {
                console.error(`❌ Section ${sectionId} não encontrada!`);
                return;
            }
            const html = `
                <div class="section-header">
                    <button class="btn-back" onclick="docManager_${this.categoriaId}.show()">
                        <i class="fas fa-arrow-left"></i>
                    </button>
                    <h1 class="section-title">${data.titulo}</h1>
                    ${canDeleteDocumentForCategory(currentUser, this.categoriaId) ? `
                        <button class="btn-delete" onclick="docManager_${this.categoriaId}.delete('${id}')" style="background: #DC2626;">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </div>

                <div class="comunicado-detalhes">
                    <div class="comunicado-meta">
                        <div><i class="fas fa-calendar"></i> ${dataFormatada}</div>
                        <div><i class="fas fa-user"></i> ${data.autor || 'Administração'}</div>
                        <div><i class="fas fa-tag"></i> ${this.config.nome}</div>
                    </div>
                    <div class="comunicado-content">
                        ${data.descricao ? data.descricao.replace(/\n/g, '<br>') : ''}
                    </div>
                    
                    ${data.arquivoURL ? `
                    <div style="margin-top: 24px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px; background: #2C3E50; color: white; border-radius: 8px 8px 0 0;">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <i class="fas fa-file-pdf" style="font-size: 20px; color: #DC2626;"></i>
                                <span style="font-weight: 500;">${data.arquivoNome || 'Documento.pdf'}</span>
                            </div>
                            <span style="font-size: 14px; color: #BDC3C7;">Visualização segura do documento</span>
                        </div>
                        <div id="pdfViewerContainer_${id}" style="width: 100%; height: ${isMobileDevice() ? '600px' : '800px'}; border: 2px solid #2C3E50; border-top: none; border-radius: 0 0 8px 8px; background: white; position: relative;">
                            ${isMobileDevice() ? `
                                <!-- Mobile: Abordagem híbrida com Google Viewer fallback -->
                                <object
                                    data="${data.arquivoURL}#toolbar=1&navpanes=0&scrollbar=1"
                                    type="application/pdf"
                                    width="100%"
                                    height="100%"
                                    style="border: none;">
                                    <embed
                                        src="https://docs.google.com/gview?url=${encodedURL}&embedded=true"
                                        width="100%"
                                        height="100%"
                                        type="application/pdf"
                                        style="border: none;">
                                    </embed>
                                    <div style="padding: 20px; text-align: center;">
                                        <p style="margin-bottom: 16px;">Não foi possível carregar o PDF no visualizador.</p>
                                        <a href="${data.arquivoURL}" target="_blank" style="display: inline-block; padding: 12px 24px; background: #006837; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
                                            <i class="fas fa-download"></i> Baixar PDF
                                        </a>
                                    </div>
                                </object>
                            ` : `
                                <!-- Desktop: iframe tradicional com fallback para PDF.js -->
                                <div class="pdf-loading" id="pdfLoading_${id}" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
                                    <i class="fas fa-spinner fa-spin" style="font-size: 48px; color: #006837; margin-bottom: 16px;"></i>
                                    <p>Carregando documento...</p>
                                </div>
                                <iframe
                                    id="pdfIframe_${id}"
                                    src="${data.arquivoURL}#toolbar=1&navpanes=0&scrollbar=1"
                                    style="width: 100%; height: 100%; border: none; display: none;"
                                    frameborder="0"
                                    oncontextmenu="return false;">
                                </iframe>
                            `}
                        </div>
                    </div>
                    ` : ''}
                    
                    ${canDeleteDocumentForCategory(currentUser, this.categoriaId) ? `
                    <div class="document-actions" style="justify-content: center; margin-top: 24px;">
                        <button class="btn-delete" onclick="docManager_${this.categoriaId}.delete('${id}')">
                            <i class="fas fa-trash"></i> Excluir
                        </button>
                    </div>
                    ` : ''}
                </div>
            `;
            
            section.innerHTML = html;
            
            // Configurar fallback para PDF se houver arquivoURL (apenas desktop)
            if (data.arquivoURL && !isMobileDevice()) {
                setTimeout(() => {
                    const iframe = document.getElementById(`pdfIframe_${id}`);
                    const loadingDiv = document.getElementById(`pdfLoading_${id}`);
                    const container = document.getElementById(`pdfViewerContainer_${id}`);

                    if (iframe && loadingDiv && container) {
                        let iframeLoaded = false;
                        
                        // Timeout para detectar se o iframe não carregou
                        const timeout = setTimeout(async () => {
                            if (!iframeLoaded && typeof carregarPDFComPDFJS === 'function') {
                                console.warn('⚠️ Iframe não carregou, tentando PDF.js...');
                                iframe.style.display = 'none';
                                
                                // Criar estrutura para PDF.js usando a função existente
                                container.innerHTML = `
                                    <div class="pdf-viewer-container">
                                        <div class="pdf-viewer-header">
                                            <div class="pdf-info">
                                                <i class="fas fa-file-pdf"></i>
                                                <span>${data.arquivoNome || 'Documento.pdf'}</span>
                                            </div>
                                            <div class="pdf-controls">
                                                <button class="btn-pdf" onclick="zoomOut()" title="Diminuir zoom">
                                                    <i class="fas fa-search-minus"></i>
                                                </button>
                                                <button class="btn-pdf" onclick="zoomIn()" title="Aumentar zoom">
                                                    <i class="fas fa-search-plus"></i>
                                                </button>
                                                <button class="btn-pdf" onclick="resetZoom()" title="Zoom original">
                                                    <i class="fas fa-expand-arrows-alt"></i>
                                                </button>
                                            </div>
                                        </div>
                                        <div class="pdf-viewer" style="height: 800px;">
                                            <div class="pdf-loading" id="pdfLoading_${id}_pdfjs">
                                                <i class="fas fa-spinner fa-spin"></i>
                                                <p>Carregando documento...</p>
                                            </div>
                                            <canvas id="pdfCanvas_${id}_pdfjs" style="display: none; border: none; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); max-width: 100%;"></canvas>
                                        </div>
                                    </div>
                                `;
                                
                                // Aguardar um pouco para o DOM atualizar e então carregar com PDF.js
                                setTimeout(() => {
                                    // Temporariamente substituir os IDs globais para PDF.js usar
                                    const originalLoading = document.getElementById('pdfLoading');
                                    const originalCanvas = document.getElementById('pdfCanvas');
                                    
                                    if (originalLoading) originalLoading.id = 'pdfLoading_temp';
                                    if (originalCanvas) originalCanvas.id = 'pdfCanvas_temp';
                                    
                                    const newLoading = document.getElementById(`pdfLoading_${id}_pdfjs`);
                                    const newCanvas = document.getElementById(`pdfCanvas_${id}_pdfjs`);
                                    
                                    if (newLoading) newLoading.id = 'pdfLoading';
                                    if (newCanvas) newCanvas.id = 'pdfCanvas';
                                    
                                    carregarPDFComPDFJS(data.arquivoURL).then(() => {
                                        // Restaurar IDs originais se existirem
                                        if (originalLoading) originalLoading.id = 'pdfLoading';
                                        if (originalCanvas) originalCanvas.id = 'pdfCanvas';
                                    }).catch(() => {
                                        // Restaurar IDs originais em caso de erro
                                        if (originalLoading) originalLoading.id = 'pdfLoading';
                                        if (originalCanvas) originalCanvas.id = 'pdfCanvas';
                                    });
                                }, 100);
                            }
                        }, 5000);
                        
                        // Detectar quando o iframe carregar com sucesso
                        iframe.onload = () => {
                            iframeLoaded = true;
                            clearTimeout(timeout);
                            console.log('✅ PDF carregado com sucesso via iframe!');
                            loadingDiv.style.display = 'none';
                            iframe.style.display = 'block';
                        };
                        
                        // Detectar erro no iframe (alguns navegadores não suportam onerror em iframes)
                        // Usaremos apenas o timeout como fallback
                    }
                }, 100);
            }
        } catch (error) {
            console.error('Erro ao carregar detalhes:', error);
            showToast('Erro ao carregar documento', 'error');
        }
    }
    
    // Mostrar formulário de novo documento
    showNovo() {
        // Verificar permissão antes de mostrar formulário
        if (!canCreateDocumentForCategory(currentUser, this.categoriaId)) {
            showToast('Você não tem permissão para criar documentos nesta categoria', 'error');
            return;
        }
        
        // Determinar qual section usar baseado no voltarPara
        const sectionId = (this.config.voltarPara === 'showAuditorias' || this.config.voltarPara === 'showRelatorios') 
            ? 'qualidadeSection' 
            : (this.config.voltarPara === 'showBibliotecaDocumentos' || this.config.voltarPara === 'showProtocolosPrevencao')
            ? 'protocolosSection'
            : (this.config.voltarPara === 'showConciliacaoMedicamentosa')
            ? 'ferramentasSection'
            : (this.config.voltarPara === 'showKPIs')
            ? 'painelSection'
            : 'painelSection';
        const section = document.getElementById(sectionId);

        if (!section) {
            console.error(`❌ Section ${sectionId} não encontrada!`);
            alert(`Erro: Não foi possível abrir documentos.\nSeção '${sectionId}' não encontrada.\n\nCategoria: ${this.categoriaId}`);
            return;
        }

        console.log(`   ✅ Section encontrada!`);
        const html = `
            <div class="section-header">
                <button class="btn-back" onclick="docManager_${this.categoriaId}.show()">
                    <i class="fas fa-arrow-left"></i>
                </button>
                <h1 class="section-title">📝 Novo Documento - ${this.config.nome}</h1>
            </div>

            <div class="comunicado-form">
                <div class="form-group">
                    <label>Título *</label>
                    <input type="text" class="form-control" id="doc_titulo" placeholder="Digite o título do documento" required>
                </div>

                <div class="form-group">
                    <label>Descrição *</label>
                    <textarea class="form-control" id="doc_descricao" rows="6" placeholder="Digite a descrição completa do documento" required></textarea>
                </div>

                <div class="form-group">
                    <label>Anexar PDF</label>
                    <input type="file" class="form-select" id="doc_arquivo" accept=".pdf" style="padding: 12px;">
                    <small style="color: #6B7280; display: block; margin-top: 8px;">
                        <i class="fas fa-info-circle"></i> Arquivo opcional. Tamanho máximo: 10MB
                    </small>
                </div>

                <div class="form-actions">
                    <button class="btn-secondary" onclick="docManager_${this.categoriaId}.show()">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                    <button class="btn-primary" onclick="docManager_${this.categoriaId}.salvar()">
                        <i class="fas fa-save"></i> Salvar Documento
                    </button>
                </div>
            </div>
        `;
        
        section.innerHTML = html;
    }
    
    // Salvar documento
    async salvar() {
        // Verificar permissão antes de salvar
        if (!canCreateDocumentForCategory(currentUser, this.categoriaId)) {
            showToast('Você não tem permissão para criar documentos nesta categoria', 'error');
            return;
        }
        
        try {
            showLoading();
            
            const titulo = document.getElementById('doc_titulo').value;
            const descricao = document.getElementById('doc_descricao').value;
            const arquivoInput = document.getElementById('doc_arquivo');
            
            if (!titulo || !descricao) {
                hideLoading();
                showToast('Preencha todos os campos obrigatórios', 'error');
                return;
            }
            
            const docData = {
                titulo,
                descricao,
                autor: currentUser.email,
                autorNome: currentUser.displayName || currentUser.email,
                data: firebase.firestore.FieldValue.serverTimestamp(),
                ativo: true
            };
            
            if (arquivoInput && arquivoInput.files && arquivoInput.files[0]) {
                const arquivo = arquivoInput.files[0];
                
                if (arquivo.size > 10 * 1024 * 1024) {
                    hideLoading();
                    showToast('Arquivo muito grande. Máximo 10MB.', 'error');
                    return;
                }
                
                const storageRef = firebase.storage().ref();
                const nomeArquivo = `${this.config.pasta}/${Date.now()}_${arquivo.name}`;
                const fileRef = storageRef.child(nomeArquivo);
                
                await fileRef.put(arquivo);
                const urlArquivo = await fileRef.getDownloadURL();
                
                docData.arquivoURL = urlArquivo;
                docData.arquivoNome = arquivo.name;
            }
            
            await db.collection(this.config.colecao).add(docData);
            
            hideLoading();
            showToast('Documento salvo com sucesso!', 'success');
            this.show();
        } catch (error) {
            hideLoading();
            console.error('Erro ao salvar documento:', error);
            showToast('Erro ao salvar documento', 'error');
        }
    }
    
    // Excluir documento
    async delete(id) {
        // Verificar permissão antes de excluir
        if (!canDeleteDocumentForCategory(currentUser, this.categoriaId)) {
            showToast('Você não tem permissão para excluir documentos nesta categoria', 'error');
            return;
        }
        
        if (!confirm('Tem certeza que deseja excluir este documento?')) {
            return;
        }
        
        try {
            showLoading();
            await db.collection(this.config.colecao).doc(id).update({ ativo: false });
            hideLoading();
            showToast('Documento excluído com sucesso!', 'success');
            this.show();
        } catch (error) {
            hideLoading();
            console.error('Erro ao excluir documento:', error);
            showToast('Erro ao excluir documento', 'error');
        }
    }
}

// ==================== INSTÂNCIAS GLOBAIS PARA CADA CATEGORIA ====================

// Criar automaticamente um manager para cada categoria
Object.keys(CATEGORIAS_DOCUMENTOS).forEach(categoriaId => {
    window[`docManager_${categoriaId}`] = new DocumentoManager(categoriaId);
});

// ==================== FUNÇÕES GLOBAIS (COMPATIBILIDADE) ====================

// Auditorias e Conformidades
function showAuditoriaEspecifica(categoriaId) {
    const manager = window[`docManager_${categoriaId}`];
    if (manager) {
        manager.show();
    } else {
        console.error(`Manager não encontrado para: ${categoriaId}`);
    }
}

// Relatórios de Segurança
function showRelatorioEspecifico(categoriaId) {
    const manager = window[`docManager_${categoriaId}`];
    if (manager) {
        manager.show();
    } else {
        console.error(`Manager não encontrado para: ${categoriaId}`);
    }
}

console.log('✅ Sistema de Gerenciamento de Documentos carregado!');
console.log(`📊 Total de categorias: ${Object.keys(CATEGORIAS_DOCUMENTOS).length}`);
console.log('📂 Document Managers criados:');
Object.keys(CATEGORIAS_DOCUMENTOS).forEach(key => {
    console.log(`   - docManager_${key} (${CATEGORIAS_DOCUMENTOS[key].nome})`);
});


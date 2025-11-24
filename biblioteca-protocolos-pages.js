// ==================== PÁGINAS DE BIBLIOTECA E PROTOCOLOS ====================
// Funções para mostrar cards de Biblioteca e Protocolos com gerenciamento de documentos
// Data: 4 de novembro de 2025

// ==================== BIBLIOTECA DE DOCUMENTOS ====================

function showBibliotecaDocumentos() {
    console.log('💊 Segurança de Medicamentos');
    
    // Atualizar histórico de navegação
    if (typeof atualizarHistoricoNavegacao === 'function') {
        atualizarHistoricoNavegacao('biblioteca-documentos');
    }
    
    const section = document.getElementById('protocolosSection');
    if (!section) {
        console.error('❌ protocolosSection não encontrada!');
        return;
    }
    
    const html = `
        ${renderInfoBanner('fas fa-book-medical', 'Segurança de Medicamentos', 'Protocolos e documentos para manuseio seguro de medicamentos', '#006837 0%, #9BC53D 100%', 'voltarPagina()')}

        <div class="protocols-grid">
            <div class="protocol-card" onclick="showGrupoMedicamentosAltaVigilancia()" style="cursor: pointer;">
                <div class="protocol-icon" style="background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);">
                    <i class="fas fa-exclamation-triangle" style="font-size: 32px; color: white;"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Medicamentos de Alta Vigilância</h3>
                </div>
            </div>

            <div class="protocol-card" onclick="showGrupoMedicamentosEspecificos()" style="cursor: pointer;">
                <div class="protocol-icon" style="background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);">
                    <i class="fas fa-pills" style="font-size: 32px; color: white;"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Medicamentos Específicos</h3>
                </div>
            </div>

            <div class="protocol-card" onclick="showGrupoListasDiretrizes()" style="cursor: pointer;">
                <div class="protocol-icon" style="background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);">
                    <i class="fas fa-list-check" style="font-size: 32px; color: white;"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Listas e Diretrizes</h3>
                </div>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
}

function showGrupoMedicamentosAltaVigilancia() {
    // Atualizar histórico de navegação
    if (typeof atualizarHistoricoNavegacao === 'function') {
        atualizarHistoricoNavegacao('grupo-medicamentos-alta-vigilancia');
    }
    
    const section = document.getElementById('protocolosSection');
    if (!section) return;

    const html = `
        ${renderInfoBanner('fas fa-exclamation-triangle', 'Medicamentos de Alta Vigilância', 'Protocolos e diretrizes para o manuseio seguro de medicamentos de alta vigilância', '#dc2626 0%, #ef4444 100%', 'voltarPagina()')}

        <div class="protocols-grid">
            <div class="protocol-card" onclick="docManager_medicamentos_alta_vigilancia.show()" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #dc2626;">
                    <i class="fas fa-pills"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Medicamentos de Alta Vigilância</h3>
                </div>
            </div>

            <div class="protocol-card" onclick="docManager_intoxicacao_anestesicos_locais.show()" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #ea580c;">
                    <i class="fas fa-syringe"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Intoxicação por Anestésicos Locais</h3>
                </div>
            </div>

            <div class="protocol-card" onclick="docManager_manejo_glicemia.show()" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #059669;">
                    <i class="fas fa-stethoscope"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Manejo da Glicemia</h3>
                </div>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
}

function showGrupoMedicamentosEspecificos() {
    // Atualizar histórico de navegação
    if (typeof atualizarHistoricoNavegacao === 'function') {
        atualizarHistoricoNavegacao('grupo-medicamentos-especificos');
    }
    
    const section = document.getElementById('protocolosSection');
    if (!section) return;

    const html = `
        ${renderInfoBanner('fas fa-pills', 'Medicamentos Específicos', 'Protocolos de segurança para medicamentos específicos e de uso controlado', '#f97316 0%, #fb923c 100%', 'voltarPagina()')}

        <div class="protocols-grid">
            <div class="protocol-card" onclick="docManager_heparina.show()" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #dc2626;">
                    <i class="fas fa-syringe"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Segurança no Uso da Heparina</h3>
                </div>
            </div>

            <div class="protocol-card" onclick="docManager_eletrolitos.show()" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #f97316;">
                    <i class="fas fa-bolt"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Eletrólitos Concentrados</h3>
                </div>
            </div>

            <div class="protocol-card" onclick="docManager_narcoticos.show()" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #7c2d12;">
                    <i class="fas fa-lock"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Segurança dos Narcóticos</h3>
                </div>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
}

function showGrupoListasDiretrizes() {
    // Atualizar histórico de navegação
    if (typeof atualizarHistoricoNavegacao === 'function') {
        atualizarHistoricoNavegacao('grupo-listas-diretrizes');
    }
    
    const section = document.getElementById('protocolosSection');
    if (!section) return;

    const html = `
        ${renderInfoBanner('fas fa-list-check', 'Listas e Diretrizes', 'Listas e diretrizes para segurança no uso de medicamentos', '#f59e0b 0%, #fbbf24 100%', 'voltarPagina()')}

        <div class="protocols-grid">
            <div class="protocol-card" onclick="docManager_lista_abreviaturas.show()" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #f59e0b;">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Lista de Abreviaturas Perigosas</h3>
                </div>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
}

// ==================== PROTOCOLOS DE PREVENÇÃO ====================

function showProtocolosPrevencao() {
    console.log('🛡️ Controle de Infecção');
    
    // Atualizar histórico de navegação
    if (typeof atualizarHistoricoNavegacao === 'function') {
        atualizarHistoricoNavegacao('protocolos-prevencao');
    }
    
    const section = document.getElementById('protocolosSection');
    if (!section) {
        console.error('❌ protocolosSection não encontrada!');
        return;
    }
    
    const html = `
        ${renderInfoBanner('fas fa-shield-virus', 'Controle de Infecção', 'Bundles e protocolos baseados em evidências para prevenção de IRAS', '#006837 0%, #9BC53D 100%', 'voltarPagina()')}

        <div class="protocols-grid">
            <div class="protocol-card" onclick="showGrupoProtocolosBasicosPrevencao()" style="cursor: pointer;">
                <div class="protocol-icon" style="background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);">
                    <i class="fas fa-shield-alt" style="font-size: 32px; color: white;"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Protocolos Básicos de Prevenção</h3>
                </div>
            </div>

            <div class="protocol-card" onclick="showGrupoBundlesIRAS()" style="cursor: pointer;">
                <div class="protocol-icon" style="background: linear-gradient(135deg, #059669 0%, #10b981 100%);">
                    <i class="fas fa-virus-slash" style="font-size: 32px; color: white;"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Bundles de Prevenção de IRAS</h3>
                </div>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
}

function showGrupoProtocolosBasicosPrevencao() {
    // Atualizar histórico de navegação
    if (typeof atualizarHistoricoNavegacao === 'function') {
        atualizarHistoricoNavegacao('grupo-protocolos-basicos-prevencao');
    }
    
    const section = document.getElementById('protocolosSection');
    if (!section) return;

    const html = `
        ${renderInfoBanner('fas fa-shield-alt', 'Protocolos Básicos de Prevenção', 'Protocolos fundamentais para prevenção de infecções e eventos adversos', '#2563eb 0%, #3b82f6 100%', 'voltarPagina()')}

        <div class="protocols-grid">
            <div class="protocol-card" onclick="docManager_protocolo_higiene_maos.show()" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #2563eb;">
                    <i class="fas fa-hand-paper"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Protocolo de Higiene das Mãos</h3>
                </div>
            </div>

            <div class="protocol-card" onclick="docManager_prevencao_broncoaspiracao.show()" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #0891b2;">
                    <i class="fas fa-lungs"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Prevenção da Broncoaspiração</h3>
                </div>
            </div>

            <div class="protocol-card" onclick="docManager_prevencao_alergia_latex.show()" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #f59e0b;">
                    <i class="fas fa-shield-alt"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Prevenção de Alergia ao Látex</h3>
                </div>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
}

function showGrupoBundlesIRAS() {
    // Atualizar histórico de navegação
    if (typeof atualizarHistoricoNavegacao === 'function') {
        atualizarHistoricoNavegacao('grupo-bundles-iras');
    }
    
    const section = document.getElementById('protocolosSection');
    if (!section) return;

    const html = `
        ${renderInfoBanner('fas fa-virus-slash', 'Bundles de Prevenção de IRAS', 'Bundles baseados em evidências para prevenção de infecções relacionadas à assistência à saúde', '#059669 0%, #10b981 100%', 'voltarPagina()')}

        <div class="protocols-grid">
            <div class="protocol-card" onclick="docManager_prevencao_isc.show()" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #7c3aed;">
                    <i class="fas fa-virus"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Prevenção de Infecção de Sítio Cirúrgico</h3>
                </div>
            </div>

            <div class="protocol-card" onclick="docManager_prevencao_ics.show()" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #dc2626;">
                    <i class="fas fa-syringe"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Prevenção de Infecção de Corrente Sanguínea</h3>
                </div>
            </div>

            <div class="protocol-card" onclick="docManager_prevencao_pav.show()" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #059669;">
                    <i class="fas fa-lungs"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Prevenção de Pneumonia Associada à Ventilação</h3>
                </div>
            </div>

            <div class="protocol-card" onclick="docManager_prevencao_itu.show()" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #0891b2;">
                    <i class="fas fa-toilet"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Prevenção de Infecção do Trato Urinário</h3>
                </div>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
}

console.log('✅ Páginas de Biblioteca e Protocolos carregadas!');


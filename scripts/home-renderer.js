/**
 * Renderiza a seção Home (Painel de Controle) estilo Fintech
 */
async function renderHomeSection() {
    console.log('[Home Renderer] renderHomeSection() chamada');
    const section = document.getElementById('homeSection');
    if (!section) {
        console.error('[Home Renderer] Seção homeSection não encontrada!');
        return;
    }

    // Cabeçalho já existe no HTML estático
    const header = section.querySelector('.section-header');
    const headerHTML = header ? header.outerHTML : '<div class="section-header"><h1 class="section-title">Home</h1></div>';

    let html = headerHTML;

    // 1. Credit Cards (Comunicados & Pendências)
    html += `
        <div class="credit-cards-container">
            ${renderCreditCard({
                type: 'comunicados',
                label: 'ANEST',
                icon: 'fa-bullhorn',
                title: 'Últimos Comunicados',
                preview: 'Nova diretriz sobre manejo de vias aéreas difíceis publicada...',
                badge: { type: 'new', text: '3 novos' },
                action: 'showComunicados()'
            })}
            
            ${renderCreditCard({
                type: 'pendencias',
                label: 'GESTÃO',
                icon: 'fa-tasks',
                title: 'Minhas Pendências',
                preview: '• Leitura: Protocolo de Normotermia<br>• Quiz: ROPs - Cultura de Segurança',
                badge: { type: 'warning', text: '5 pendentes' },
                action: 'showPendencias()'
            })}
        </div>
    `;

    // Carregar dados da API (com fallback para dados mock)
    try {
        let plantoes, ferias;
        
        if (window.PegaPlantaoAPI && typeof window.PegaPlantaoAPI.buscarPlantaoHoje === 'function') {
            plantoes = await window.PegaPlantaoAPI.buscarPlantaoHoje();
        } else {
            // Fallback para dados mock
            plantoes = [
                { name: 'P1', details: '15 Dez 2025 - Noturno', badge: { type: 'info', text: 'em 3 dias' } },
                { name: 'P2', details: '22 Dez 2025 - Diurno', badge: { type: 'success', text: 'em 10 dias' } },
                { name: 'P3', details: '29 Dez 2025 - Noturno', badge: { type: 'info', text: 'em 17 dias' } },
                { name: 'P4', details: '05 Jan 2026 - Diurno', badge: { type: 'success', text: 'em 24 dias' } }
            ];
        }
        
        if (window.PegaPlantaoAPI && typeof window.PegaPlantaoAPI.buscarFeriasLicencaHoje === 'function') {
            ferias = await window.PegaPlantaoAPI.buscarFeriasLicencaHoje();
        } else {
            // Fallback para dados mock
            ferias = [
                { name: 'Dr. João Silva', details: '15-30 Jan 2026', active: true },
                { name: 'Dra. Ana Costa', details: '20 Jan - 05 Fev', active: true },
                { name: 'Dr. Pedro Santos', details: '01-15 Fev 2026', active: true },
                { name: '—', details: '', active: false },
                { name: 'Enf. Maria Lima', details: '10-25 Fev 2026', active: true },
                { name: '—', details: '', active: false }
            ];
        }

        // 2. Widget Plantão (4 itens)
        html += renderWidgetPlantao(plantoes);

        // 3. Widget Férias (Grid 2x3)
        html += renderWidgetFerias(ferias);
    } catch (e) {
        console.error("Erro ao carregar dados do widget", e);
        // Fallback com dados mock em caso de erro
        html += renderWidgetPlantao([
            { name: 'P1', details: '15 Dez 2025 - Noturno', badge: { type: 'info', text: 'em 3 dias' } },
            { name: 'P2', details: '22 Dez 2025 - Diurno', badge: { type: 'success', text: 'em 10 dias' } },
            { name: 'P3', details: '29 Dez 2025 - Noturno', badge: { type: 'info', text: 'em 17 dias' } },
            { name: 'P4', details: '05 Jan 2026 - Diurno', badge: { type: 'success', text: 'em 24 dias' } }
        ]);
        html += renderWidgetFerias([
            { name: 'Dr. João Silva', details: '15-30 Jan 2026', active: true },
            { name: 'Dra. Ana Costa', details: '20 Jan - 05 Fev', active: true },
            { name: 'Dr. Pedro Santos', details: '01-15 Fev 2026', active: true },
            { name: '—', details: '', active: false },
            { name: 'Enf. Maria Lima', details: '10-25 Fev 2026', active: true },
            { name: '—', details: '', active: false }
        ]);
    }

    // 4. Atalhos Rápidos (Grid 2x2)
    html += `
        <div class="shortcut-section">
            <h3 class="widget-title">Atalhos Rápidos</h3>
            <div class="shortcut-grid">
                ${renderShortcutButton('fa-calculator', 'Calculadoras', 'showCalculadoras()')}
                ${renderShortcutButton('fa-exclamation-triangle', 'Reportar Incidente', 'showReportarIncidente()')}
                ${renderShortcutButton('fa-clipboard-list', 'Protocolos', "navigateToPage('documentos')")}
                ${renderShortcutButton('fa-tools', 'Manutenção', 'showManutencao()')}
            </div>
        </div>
    `;

    section.innerHTML = html;
}

// --- Helper Functions ---

function renderCreditCard(data) {
    return `
        <div class="card-credit-style card-credit-${data.type}" onclick="${data.action}">
            <div class="card-credit-header">
                <span class="card-credit-label">${data.label}</span>
                <i class="fas ${data.icon} card-credit-icon"></i>
            </div>
            <div class="card-credit-content">
                <h3>${data.title}</h3>
                <p class="card-credit-preview">${data.preview}</p>
            </div>
            <div class="card-credit-footer">
                <span class="badge-${data.badge.type}">${data.badge.text}</span>
            </div>
        </div>
    `;
}

function renderWidgetPlantao(items) {
    let itemsHtml = items.map(item => `
        <div class="widget-plantao-item">
            <div class="widget-plantao-icon"><i class="fas fa-calendar-alt"></i></div>
            <div class="widget-plantao-info">
                <div class="widget-plantao-name">${item.name}</div>
                <div class="widget-plantao-details">${item.details}</div>
            </div>
            <div class="badge-${item.badge.type}">${item.badge.text}</div>
        </div>
    `).join('');

    return `
        <div class="widget-plantao">
            <span class="widget-title">Próximos Plantões</span>
            ${itemsHtml}
        </div>
    `;
}

function renderWidgetFerias(items) {
    let itemsHtml = items.map(item => `
        <div class="widget-ferias-item ${item.active ? '' : 'empty'}">
            <div class="widget-ferias-icon"><i class="fas fa-umbrella-beach"></i></div>
            <div class="widget-ferias-name">${item.name}</div>
            <div class="widget-ferias-details">${item.details}</div>
        </div>
    `).join('');

    return `
        <div class="widget-ferias">
            <span class="widget-title">Férias Programadas</span>
            <div class="ferias-grid">
                ${itemsHtml}
            </div>
        </div>
    `;
}

function renderShortcutButton(icon, label, action) {
    return `
        <div class="shortcut-button" onclick="${action}">
            <i class="fas ${icon}"></i>
            <span>${label}</span>
        </div>
    `;
}

// --- Compatibility Functions (Mock) ---
function showComunicados() { alert('Mostrar Comunicados'); }
function showPendencias() { alert('Mostrar Pendências'); }
function showCalculadoras() { navigateToPage('ferramentas'); } // Redireciona para ferramentas onde estão as calculadoras
function showReportarIncidente() { alert('Formulário de Incidente'); }
function showManutencao() { alert('Área de Manutenção'); }


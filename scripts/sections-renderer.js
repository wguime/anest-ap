/**
 * Renderiza a seção Qualidade
 */
function renderQualidadeSection() {
    const section = document.getElementById('qualidadeSection');
    if (!section) return;

    const header = section.querySelector('.section-header');
    const headerHTML = header ? header.outerHTML : '<div class="section-header"><h1 class="section-title">Qualidade e Segurança</h1></div>';

    let html = headerHTML;

    // 1. Featured Cards (Incidentes & ROPs)
    html += `
        <div class="credit-cards-container">
            ${renderCreditCard({
                type: 'featured',
                label: 'SEGURANÇA',
                icon: 'fa-exclamation-triangle',
                title: 'Gestão de Incidentes',
                preview: 'Notificar eventos adversos e near miss',
                badge: { type: 'info', text: 'Relatar' },
                action: "alert('Gestão de Incidentes')"
            })}
            
            ${renderCreditCard({
                type: 'rops',
                label: 'QMENTUM',
                icon: 'fa-bullseye',
                title: 'Desafio das ROPs',
                preview: 'Quiz gamificado e podcasts educacionais',
                badge: { type: 'warning', text: '65% concluído' },
                action: "alert('Desafio ROPs')"
            })}
        </div>
    `;

    // 2. Page Cards Grid (8 itens)
    html += '<div class="page-cards-grid">';
    const items = [
        { title: 'Indicadores', subtitle: '6 KPIs monitorados', icon: 'fa-arrow-up-right', action: "alert('Indicadores')" },
        { title: 'Painel 21 KPIs', subtitle: 'Gestão à vista', icon: 'fa-arrow-up-right', action: "alert('Painel Gestão')" },
        { title: 'Auditorias', subtitle: '25 categorias', icon: 'fa-arrow-up-right', action: "alert('Auditorias')" },
        { title: 'Relatórios', subtitle: 'Segurança do paciente', icon: 'fa-arrow-up-right', action: "alert('Relatórios')" },
        { title: 'Ética', subtitle: 'Gestão de dilemas', icon: 'fa-arrow-up-right', action: "alert('Ética')" },
        { title: 'Comitês', subtitle: 'Regimentos internos', icon: 'fa-arrow-up-right', action: "alert('Comitês')" },
        { title: 'Organograma', subtitle: 'Estrutura organizacional', icon: 'fa-arrow-up-right', action: "alert('Organograma')" },
        { title: 'Desastres', subtitle: 'Planos de emergência', icon: 'fa-arrow-up-right', action: "alert('Desastres')" }
    ];

    items.forEach(item => {
        html += renderPageCard(item);
    });
    html += '</div>';

    section.innerHTML = html;
}

/**
 * Renderiza a seção Documentos
 */
function renderDocumentosSection() {
    const section = document.getElementById('documentosSection');
    if (!section) return;

    const header = section.querySelector('.section-header');
    const headerHTML = header ? header.outerHTML : '<div class="section-header"><h1 class="section-title">Documentos</h1></div>';

    let html = headerHTML;

    // Featured Card
    html += renderCreditCard({
        type: 'featured',
        label: 'DOCUMENTOS',
        icon: 'fa-book',
        title: 'Biblioteca de Documentos',
        preview: 'Protocolos, políticas, formulários e manuais',
        badge: { type: 'new', text: '120 documentos' },
        action: "alert('Biblioteca')"
    });

    // Page Cards Grid
    html += '<div class="page-cards-grid">';
    const items = [
        { title: 'Medicamentos', subtitle: 'MAV, Eletrólitos, Heparina', icon: 'fa-arrow-up-right', action: "alert('Medicamentos')" },
        { title: 'Infecção', subtitle: 'Bundles e Protocolos IRAS', icon: 'fa-arrow-up-right', action: "alert('Infecção')" },
        { title: 'Conciliação', subtitle: 'Admissão, Transfer., Alta', icon: 'fa-arrow-up-right', action: "alert('Conciliação')" }
    ];

    items.forEach(item => {
        html += renderPageCard(item);
    });
    html += '</div>';

    section.innerHTML = html;
}

/**
 * Renderiza a seção Ferramentas
 */
function renderFerramentasSection() {
    const section = document.getElementById('ferramentasSection');
    if (!section) return;

    const header = section.querySelector('.section-header');
    const headerHTML = header ? header.outerHTML : '<div class="section-header"><h1 class="section-title">Ferramentas</h1></div>';

    let html = headerHTML;

    // Featured Card
    html += renderCreditCard({
        type: 'featured',
        label: 'CLÍNICAS',
        icon: 'fa-calculator',
        title: 'Calculadoras Anestésicas',
        preview: 'Ferramentas clínicas e scores',
        badge: { type: 'new', text: '12 calculadoras' },
        action: "alert('Calculadoras')"
    });

    // Page Cards Grid
    html += '<div class="page-cards-grid">';
    const items = [
        { title: 'Riscos', subtitle: 'Morse, Braden, Caprini', icon: 'fa-arrow-up-right', action: "alert('Riscos')" },
        { title: 'Checklist OMS', subtitle: 'Cirurgia segura', icon: 'fa-arrow-up-right', action: "alert('Checklist OMS')" },
        { title: 'Residência', subtitle: 'Escalas, calendário', icon: 'fa-arrow-up-right', action: "alert('Residência')" },
        { title: 'Manutenção', subtitle: 'Configurações e ajustes', icon: 'fa-arrow-up-right', action: "alert('Manutenção')" }
    ];

    items.forEach(item => {
        html += renderPageCard(item);
    });
    html += '</div>';

    section.innerHTML = html;
}

// --- Helper Function for Page Cards ---
function renderPageCard(item) {
    return `
        <div class="page-card-large" onclick="${item.action}">
            <i class="fas ${item.icon} arrow-diagonal"></i>
            <h3>${item.title}</h3>
            <p>${item.subtitle}</p>
        </div>
    `;
}


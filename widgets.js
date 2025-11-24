/**
 * Widgets - Componentes Reutilizáveis
 * 
 * Componentes de widgets iOS-style para a Home
 * - Widget Plantão Hoje
 * - Widget Férias/Licença
 * - Widget Comunicados (carrossel)
 * - Widget Pendências
 */

/**
 * Renderiza o widget de Plantão Hoje (otimizado desktop/mobile)
 * @param {HTMLElement} container - Container onde o widget será renderizado
 * @param {Array} medicos - Lista de médicos em plantão
 */
function renderWidgetPlantaoHoje(container, medicos = []) {
    if (!container) return;

    // Garantir 4 plantonistas (P1, P2, P3, P4) - preencher com mock se necessário
    const medicosExibir = medicos.slice(0, 4);
    while (medicosExibir.length < 4) {
        medicosExibir.push({
            id: `p${medicosExibir.length + 1}`,
            nome: `P${medicosExibir.length + 1}`,
            sala: `Sala ${medicosExibir.length + 1}`,
            ramal: `${1000 + medicosExibir.length}`,
            status: 'active',
            avatar: `P${medicosExibir.length + 1}`
        });
    }

    const widgetHTML = `
        <div class="widget widget-full widget-plantao-optimized" id="widget-plantao-hoje">
            <div class="widget-header-optimized border-bottom">
                <div class="widget-title-group">
                    <div class="widget-icon-optimized bg-plantao">
                        <i class="fas fa-user-md"></i>
                    </div>
                    <h3 class="widget-title-main">Plantão Hoje</h3>
                </div>
                <span class="badge badge-success-optimized">${medicosExibir.length} médico${medicosExibir.length !== 1 ? 's' : ''}</span>
            </div>
            <div class="widget-content-optimized plantao-grid-responsive" id="plantao-content">
                ${medicosExibir.length === 0 
                    ? renderEmptyState('Nenhum médico em plantão hoje')
                    : medicosExibir.map(medico => renderDoctorItemOptimized(medico)).join('')
                }
            </div>
        </div>
    `;

    container.innerHTML = widgetHTML;
}

/**
 * Renderiza item de médico otimizado
 */
function renderDoctorItemOptimized(medico) {
    return `
        <div class="doctor-item-optimized">
            <div class="doctor-avatar-optimized">${medico.avatar || getInitials(medico.nome)}</div>
            <div class="doctor-info-optimized">
                <div class="doctor-name-optimized">${medico.nome}</div>
                <div class="doctor-details-optimized">
                    <i class="fas fa-door-open"></i> ${medico.sala} • Ramal ${medico.ramal}
                </div>
            </div>
            <div class="doctor-status-optimized ${medico.status === 'active' ? 'active' : ''}"></div>
        </div>
    `;
}

/**
 * Renderiza um item de médico no widget de plantão
 */
function renderDoctorItem(medico) {
    const statusClass = medico.status === 'active' ? '' : 'inactive';
    return `
        <div class="doctor-item" data-doctor-id="${medico.id}">
            <div class="doctor-avatar">${medico.avatar || getInitials(medico.nome)}</div>
            <div class="doctor-info">
                <div class="doctor-name">${medico.nome}</div>
                <div class="doctor-details">
                    ${medico.sala ? `<span>${medico.sala}</span>` : ''}
                    ${medico.ramal ? `<span>• Ramal ${medico.ramal}</span>` : ''}
                </div>
            </div>
            <div class="doctor-status ${statusClass}"></div>
        </div>
    `;
}

/**
 * Renderiza o widget de Férias e Licença (otimizado desktop/mobile)
 * @param {HTMLElement} container - Container onde o widget será renderizado
 * @param {Array} medicos - Lista de médicos em férias/licença
 */
function renderWidgetFeriasLicenca(container, medicos = []) {
    if (!container) return;

    // Garantir 6 médicos para grid responsivo
    const medicosExibir = medicos.slice(0, 6);
    while (medicosExibir.length < 6 && medicosExibir.length > 0) {
        medicosExibir.push({
            id: `f${medicosExibir.length + 1}`,
            nome: `Médico ${medicosExibir.length + 1}`,
            tipo: 'Férias',
            avatar: `M${medicosExibir.length + 1}`
        });
    }

    const widgetHTML = `
        <div class="widget widget-full widget-ferias-optimized" id="widget-ferias-licenca">
            <div class="widget-header-optimized">
                <div class="widget-title-group">
                    <div class="widget-icon-optimized bg-ferias">
                        <i class="fas fa-calendar-times"></i>
                    </div>
                    <h3 class="widget-title-main">Ausências (Férias/Licença)</h3>
                </div>
                ${medicosExibir.length > 0 ? `<span class="badge badge-warning-optimized">${medicosExibir.length}</span>` : ''}
            </div>
            <div class="widget-content-optimized">
                ${medicosExibir.length === 0 
                    ? renderEmptyState('Nenhum médico em férias/licença hoje')
                    : `
                        <div class="ferias-grid-responsive">
                            ${medicosExibir.map(medico => renderFeriasItemOptimized(medico)).join('')}
                        </div>
                    `
                }
            </div>
        </div>
    `;

    container.innerHTML = widgetHTML;
}

/**
 * Renderiza item de férias otimizado
 */
function renderFeriasItemOptimized(medico) {
    const tipoClass = medico.tipo === 'Férias' ? 'ferias' : 'licenca';
    return `
        <div class="ferias-item-optimized">
            <div class="ferias-avatar-optimized">${medico.avatar || getInitials(medico.nome)}</div>
            <div class="ferias-name-optimized">${medico.nome}</div>
            <div class="ferias-type-badge ${tipoClass}">${medico.tipo || 'Férias'}</div>
        </div>
    `;
}

/**
 * Renderiza slides do carrossel de férias (3 colunas com 2 nomes cada)
 */
function renderFeriasCarouselSlides(medicos) {
    const slides = [];
    for (let i = 0; i < medicos.length; i += 6) {
        const grupo = medicos.slice(i, i + 6);
        slides.push(`
            <div class="ferias-slide" data-index="${Math.floor(i / 6)}">
                <div class="ferias-grid-3cols">
                    ${grupo.map(medico => renderFeriasItemCompact(medico)).join('')}
                </div>
            </div>
        `);
    }
    return slides.join('');
}

/**
 * Renderiza item compacto de férias para grid
 */
function renderFeriasItemCompact(medico) {
    return `
        <div class="ferias-item-compact">
            <div class="doctor-avatar" style="width: 40px; height: 40px; font-size: 16px;">${medico.avatar || getInitials(medico.nome)}</div>
            <div class="doctor-info">
                <div class="doctor-name" style="font-size: 14px; margin-bottom: 2px;">${medico.nome}</div>
                <div class="doctor-details" style="font-size: 12px;">${medico.tipo || 'Férias'}</div>
            </div>
        </div>
    `;
}

/**
 * Renderiza um item de férias/licença
 */
function renderFeriasItem(medico) {
    return `
        <div class="doctor-item" style="background: transparent; padding: 8px 0;">
            <div class="doctor-avatar" style="width: 36px; height: 36px; font-size: 14px;">${medico.avatar || getInitials(medico.nome)}</div>
            <div class="doctor-info">
                <div class="doctor-name" style="font-size: 14px;">${medico.nome}</div>
                <div class="doctor-details" style="font-size: 12px;">${medico.tipo}</div>
            </div>
        </div>
    `;
}

/**
 * Renderiza o widget de Comunicados (formato otimizado desktop/mobile)
 * @param {HTMLElement} container - Container onde o widget será renderizado
 * @param {Array} comunicados - Lista de comunicados
 */
function renderWidgetComunicados(container, comunicados = []) {
    if (!container) return;

    const widgetHTML = `
        <div class="widget widget-comunicados-optimized" id="widget-comunicados" onclick="showComunicados()" style="cursor: pointer;">
            <div class="widget-header-optimized">
                <div class="widget-title-group">
                    <div class="widget-icon-optimized bg-comunicados">
                        <i class="fas fa-bullhorn"></i>
                    </div>
                    <div>
                        <h3 class="widget-title-main">Últimos Comunicados</h3>
                        <p class="widget-subtitle-hidden">Atualizações institucionais recentes</p>
                    </div>
                </div>
                ${comunicados.length > 0 ? `<span class="badge badge-new-optimized">${comunicados.length} novo${comunicados.length !== 1 ? 's' : ''}</span>` : ''}
            </div>
            <div class="widget-content-optimized">
                ${comunicados.length === 0 
                    ? renderEmptyState('Nenhum comunicado novo')
                    : `
                        <div class="comunicados-list-optimized">
                            ${comunicados.slice(0, 2).map(comunicado => `
                                <div class="comunicado-item-optimized">
                                    <div class="comunicado-item-header">
                                        <div class="comunicado-title-optimized">${comunicado.titulo || comunicado.title || 'Comunicado'}</div>
                                        <span class="comunicado-time-badge">${formatTimeAgo(comunicado.data || new Date())}</span>
                                    </div>
                                    <p class="comunicado-description-optimized">${comunicado.descricao || comunicado.texto || ''}</p>
                                </div>
                            `).join('')}
                        </div>
                    `
                }
            </div>
        </div>
    `;

    container.innerHTML = widgetHTML;
}

/**
 * Renderiza um slide de comunicado
 */
function renderComunicadoSlide(comunicado, index) {
    const timeAgo = formatTimeAgo(comunicado.data || new Date());
    return `
        <div class="comunicado-slide" data-index="${index}">
            <div class="comunicado-title">${comunicado.titulo || 'Comunicado'}</div>
            <div class="comunicado-description">${comunicado.descricao || comunicado.texto || ''}</div>
            <div class="comunicado-time">${timeAgo}</div>
        </div>
    `;
}

/**
 * Renderiza indicadores do carrossel (dots)
 */
function renderCarouselIndicators(count) {
    return `
        <div class="carousel-indicators" id="carousel-indicators">
            ${Array.from({ length: count }, (_, i) => 
                `<div class="carousel-dot ${i === 0 ? 'active' : ''}" data-index="${i}"></div>`
            ).join('')}
        </div>
    `;
}

/**
 * Renderiza o widget de Pendências (formato otimizado desktop/mobile)
 * @param {HTMLElement} container - Container onde o widget será renderizado
 * @param {Object} pendencias - Objeto com informações de pendências
 */
function renderWidgetPendencias(container, pendencias = { total: 0, items: [] }) {
    if (!container) return;

    const widgetHTML = `
        <div class="widget widget-pendencias-optimized" id="widget-pendencias" onclick="showPendencias()" style="cursor: pointer;">
            <div class="widget-header-optimized">
                <div class="widget-title-group">
                    <div class="widget-icon-optimized bg-pendencias">
                        <i class="fas fa-tasks"></i>
                    </div>
                    <div>
                        <h3 class="widget-title-main">Pendências</h3>
                        <p class="widget-subtitle-hidden">Ações requeridas</p>
                    </div>
                </div>
                ${pendencias.total > 0 ? `<span class="badge badge-danger-optimized">${pendencias.total}</span>` : ''}
            </div>
            <div class="widget-content-optimized">
                ${pendencias.total === 0 
                    ? renderEmptyState('Nenhuma pendência')
                    : `
                        <div class="pendencias-list-optimized">
                            ${pendencias.items.slice(0, 3).map((item, i) => `
                                <div class="pendencia-item-optimized">
                                    <div class="pendencia-indicator ${i === 0 ? 'urgent' : 'normal'}"></div>
                                    <div class="pendencia-content">
                                        <div class="pendencia-title-optimized">${item.titulo || item.texto || 'Pendência'}</div>
                                        <div class="pendencia-type">${item.tipo || 'Pendente'}</div>
                                    </div>
                                    <i class="fas fa-chevron-right pendencia-arrow"></i>
                                </div>
                            `).join('')}
                        </div>
                    `
                }
            </div>
        </div>
    `;

    container.innerHTML = widgetHTML;
}

/**
 * Renderiza estado vazio
 */
function renderEmptyState(message) {
    return `
        <div class="widget-empty">
            <div class="widget-empty-icon"><i class="fas fa-inbox"></i></div>
            <div class="widget-empty-text">${message}</div>
        </div>
    `;
}

/**
 * Renderiza estado de loading
 */
function renderLoadingState() {
    return `
        <div class="widget-loading">
            <div>
                <div class="widget-skeleton" style="width: 60%; margin: 0 auto 8px;"></div>
                <div class="widget-skeleton" style="width: 80%; margin: 0 auto 8px;"></div>
                <div class="widget-skeleton" style="width: 70%; margin: 0 auto;"></div>
            </div>
        </div>
    `;
}

/**
 * Inicializa carrossel com funcionalidade de swipe
 */
function initCarousel(carouselId) {
    const carousel = document.getElementById(carouselId);
    if (!carousel) return;

    let currentIndex = 0;
    const slides = carousel.querySelectorAll('.comunicado-slide');
    const indicators = document.querySelectorAll('.carousel-dot');
    const totalSlides = slides.length;

    if (totalSlides === 0) return;

    // Função para atualizar carrossel
    function updateCarousel(index) {
        currentIndex = Math.max(0, Math.min(index, totalSlides - 1));
        
        // Scroll para o slide atual
        const slideWidth = slides[0].offsetWidth + 16; // width + gap
        carousel.scrollTo({
            left: currentIndex * slideWidth,
            behavior: 'smooth'
        });

        // Atualizar indicadores
        indicators.forEach((dot, i) => {
            dot.classList.toggle('active', i === currentIndex);
        });
    }

    // Event listeners para indicadores
    indicators.forEach((dot, index) => {
        dot.addEventListener('click', () => updateCarousel(index));
    });

    // Swipe gestures (touch)
    let startX = 0;
    let isDragging = false;

    carousel.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        isDragging = true;
    });

    carousel.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
    });

    carousel.addEventListener('touchend', (e) => {
        if (!isDragging) return;
        isDragging = false;
        
        const endX = e.changedTouches[0].clientX;
        const diff = startX - endX;

        if (Math.abs(diff) > 50) {
            if (diff > 0 && currentIndex < totalSlides - 1) {
                updateCarousel(currentIndex + 1);
            } else if (diff < 0 && currentIndex > 0) {
                updateCarousel(currentIndex - 1);
            }
        }
    });

    // Auto-scroll (opcional)
    // setInterval(() => {
    //     if (currentIndex < totalSlides - 1) {
    //         updateCarousel(currentIndex + 1);
    //     } else {
    //         updateCarousel(0);
    //     }
    // }, 5000);
}

/**
 * Obtém iniciais de um nome
 */
function getInitials(nome) {
    if (!nome) return '?';
    const partes = nome.trim().split(' ');
    if (partes.length === 1) {
        return partes[0].substring(0, 2).toUpperCase();
    }
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/**
 * Formata tempo relativo (ex: "Há 2 horas")
 */
function formatTimeAgo(date) {
    if (!date) return '';
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `Há ${minutes} minuto${minutes !== 1 ? 's' : ''}`;
    if (hours < 24) return `Há ${hours} hora${hours !== 1 ? 's' : ''}`;
    return `Há ${days} dia${days !== 1 ? 's' : ''}`;
}

// Exportar funções globalmente
window.Widgets = {
    renderWidgetPlantaoHoje,
    renderWidgetFeriasLicenca,
    renderWidgetComunicados,
    renderWidgetPendencias,
    renderLoadingState,
    renderEmptyState
};

// Exportar initCarousel globalmente também
window.initCarousel = initCarousel;


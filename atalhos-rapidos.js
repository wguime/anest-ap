/**
 * Sistema de Atalhos Rápidos Editáveis
 * 
 * Permite que usuários personalizem os atalhos rápidos na Home
 * Salvamento de preferências no Firebase (perfil do usuário)
 */

// Lista de atalhos disponíveis
const ATALHOS_DISPONIVEIS = [
    {
        id: 'calculadoras',
        label: 'Calculadoras',
        icon: 'fa-calculator',
        action: () => showCalculadoras(),
        categoria: 'ferramentas'
    },
    {
        id: 'reportar-incidente',
        label: 'Reportar Incidente',
        icon: 'fa-exclamation-circle',
        action: () => showIncidentes(),
        categoria: 'qualidade'
    },
    {
        id: 'protocolos',
        label: 'Protocolos',
        icon: 'fa-book',
        action: () => showSection('protocolos'),
        categoria: 'documentos'
    },
    {
        id: 'manutencao',
        label: 'Manutenção',
        icon: 'fa-wrench',
        action: () => {
            // TODO: Implementar função de manutenção
            showToast('Funcionalidade em breve', 'info');
        },
        categoria: 'ferramentas'
    },
    {
        id: 'checklist',
        label: 'Checklist',
        icon: 'fa-check-square',
        action: () => showChecklistCirurgia(),
        categoria: 'ferramentas'
    },
    {
        id: 'indicadores',
        label: 'Indicadores',
        icon: 'fa-chart-line',
        action: () => showKPIs(),
        categoria: 'qualidade'
    },
    {
        id: 'auditorias',
        label: 'Auditorias',
        icon: 'fa-clipboard-check',
        action: () => showAuditorias(),
        categoria: 'qualidade'
    },
    {
        id: 'biblioteca',
        label: 'Biblioteca',
        icon: 'fa-book-open',
        action: () => showBiblioteca(),
        categoria: 'documentos'
    }
];

// Atalhos padrão (se usuário não tiver configurado)
const ATALHOS_PADRAO = ['calculadoras', 'reportar-incidente', 'protocolos', 'manutencao'];

/**
 * Carrega atalhos rápidos do perfil do usuário ou usa padrão
 */
async function carregarAtalhosRapidos() {
    try {
        if (!currentUser) {
            return ATALHOS_PADRAO;
        }

        const db = firebase.firestore();
        const userDoc = await db.collection('usuarios').doc(currentUser.uid).get();
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.atalhosRapidos && Array.isArray(userData.atalhosRapidos)) {
                return userData.atalhosRapidos;
            }
        }

        return ATALHOS_PADRAO;
    } catch (error) {
        console.error('[Atalhos] Erro ao carregar atalhos:', error);
        return ATALHOS_PADRAO;
    }
}

/**
 * Salva atalhos rápidos no perfil do usuário
 */
async function salvarAtalhosRapidos(atalhosIds) {
    try {
        if (!currentUser) {
            console.warn('[Atalhos] Usuário não autenticado');
            return false;
        }

        const db = firebase.firestore();
        await db.collection('usuarios').doc(currentUser.uid).update({
            atalhosRapidos: atalhosIds,
            atalhosRapidosAtualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });

        console.log('[Atalhos] Atalhos salvos com sucesso');
        return true;
    } catch (error) {
        console.error('[Atalhos] Erro ao salvar atalhos:', error);
        return false;
    }
}

/**
 * Renderiza os atalhos rápidos na Home
 * @param {HTMLElement} container - Container onde os atalhos serão renderizados
 */
async function renderizarAtalhosRapidos(container) {
    if (!container) return;

    const atalhosIds = await carregarAtalhosRapidos();
    const atalhos = atalhosIds
        .map(id => ATALHOS_DISPONIVEIS.find(a => a.id === id))
        .filter(a => a !== undefined);

    const widgetHTML = `
        <div class="section-group" id="widget-atalhos-rapidos" style="padding: 0 20px 20px 20px;">
            <h2 class="section-title-small" style="font-size: 18px; font-weight: 700; color: #1B4D3E; margin-bottom: 16px;">
                Acesso Rápido
            </h2>
            <div class="quick-actions-optimized" id="quick-actions-container">
                ${atalhos.map(atalho => renderizarAtalho(atalho)).join('')}
            </div>
        </div>
    `;

    container.innerHTML = widgetHTML;

    // Adicionar event listeners
    atalhos.forEach(atalho => {
        const elemento = document.querySelector(`[data-atalho-id="${atalho.id}"]`);
        if (elemento) {
            elemento.addEventListener('click', () => {
                // Haptic feedback (se disponível)
                if (navigator.vibrate) {
                    navigator.vibrate(10);
                }
                atalho.action();
            });
        }
    });
}

/**
 * Renderiza um atalho individual (otimizado desktop/mobile)
 */
function renderizarAtalho(atalho) {
    // Mapear cores e backgrounds baseado no tipo
    const cores = {
        'calculadoras': { color: 'text-purple-600', bg: 'bg-purple-50' },
        'reportar-incidente': { color: 'text-orange-600', bg: 'bg-orange-50' },
        'protocolos': { color: 'text-blue-600', bg: 'bg-blue-50' },
        'manutencao': { color: 'text-gray-600', bg: 'bg-gray-100' },
        'checklist': { color: 'text-green-600', bg: 'bg-green-50' },
        'indicadores': { color: 'text-indigo-600', bg: 'bg-indigo-50' },
        'auditorias': { color: 'text-teal-600', bg: 'bg-teal-50' },
        'biblioteca': { color: 'text-cyan-600', bg: 'bg-cyan-50' }
    };
    
    const cor = cores[atalho.id] || { color: 'text-gray-600', bg: 'bg-gray-100' };
    const descricao = {
        'calculadoras': 'Doses e Escalas',
        'reportar-incidente': 'Reportar Risco',
        'protocolos': 'Biblioteca',
        'manutencao': 'Abrir Chamado',
        'checklist': 'Cirurgia Segura',
        'indicadores': 'KPIs',
        'auditorias': 'Conformidade',
        'biblioteca': 'Documentos'
    }[atalho.id] || '';
    
    return `
        <button class="quick-action-optimized" data-atalho-id="${atalho.id}" role="button" tabindex="0">
            <div class="quick-action-icon-optimized ${cor.bg} ${cor.color}">
                <i class="fas ${atalho.icon}"></i>
            </div>
            <div class="quick-action-content">
                <div class="quick-action-label-optimized">${atalho.label}</div>
                <div class="quick-action-desc">${descricao}</div>
            </div>
        </button>
    `;
}

/**
 * Abre modal de configuração de atalhos
 */
async function abrirConfiguracaoAtalhos() {
    const atalhosAtuais = await carregarAtalhosRapidos();
    
    // Criar modal de configuração
    const modalHTML = `
        <div class="modal-overlay" id="modal-atalhos" onclick="fecharModalAtalhos(event)">
            <div class="modal-content" onclick="event.stopPropagation()" style="max-width: 600px;">
                <div class="modal-header">
                    <h2>Configurar Atalhos Rápidos</h2>
                    <button class="btn-icon" onclick="fecharModalAtalhos()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <p style="margin-bottom: 20px; color: var(--color-text-secondary);">
                        Arraste para reordenar. Selecione até 6 atalhos.
                    </p>
                    <div id="atalhos-config-lista" style="display: flex; flex-direction: column; gap: 12px;">
                        ${ATALHOS_DISPONIVEIS.map(atalho => {
                            const selecionado = atalhosAtuais.includes(atalho.id);
                            return `
                                <div class="atalho-config-item" data-atalho-id="${atalho.id}" draggable="true" style="
                                    display: flex;
                                    align-items: center;
                                    gap: 12px;
                                    padding: 12px;
                                    background: var(--color-bg-card);
                                    border: 2px solid ${selecionado ? 'var(--color-primary)' : 'var(--color-border-primary)'};
                                    border-radius: 12px;
                                    cursor: move;
                                ">
                                    <input type="checkbox" ${selecionado ? 'checked' : ''} 
                                        onchange="toggleAtalho('${atalho.id}', this.checked)"
                                        style="width: 20px; height: 20px; cursor: pointer;">
                                    <div class="quick-action-icon" style="width: 40px; height: 40px; font-size: 20px;">
                                        <i class="fas ${atalho.icon}"></i>
                                    </div>
                                    <div style="flex: 1;">
                                        <div style="font-weight: 600; color: var(--color-text-primary);">${atalho.label}</div>
                                        <div style="font-size: 12px; color: var(--color-text-tertiary);">${atalho.categoria}</div>
                                    </div>
                                    <i class="fas fa-grip-vertical" style="color: var(--color-text-tertiary); cursor: grab;"></i>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px;">
                    <button class="btn-secondary" onclick="fecharModalAtalhos()">Cancelar</button>
                    <button class="btn-primary" onclick="salvarConfiguracaoAtalhos()">Salvar</button>
                </div>
            </div>
        </div>
    `;

    // Adicionar modal ao body
    const modal = document.createElement('div');
    modal.innerHTML = modalHTML;
    document.body.appendChild(modal);

    // Inicializar drag and drop
    initDragAndDrop();
}

/**
 * Toggle de seleção de atalho
 */
let atalhosSelecionados = [];

async function toggleAtalho(atalhoId, selecionado) {
    if (selecionado) {
        if (!atalhosSelecionados.includes(atalhoId) && atalhosSelecionados.length < 6) {
            atalhosSelecionados.push(atalhoId);
        } else if (atalhosSelecionados.length >= 6) {
            showToast('Máximo de 6 atalhos permitidos', 'warning');
            document.querySelector(`input[onchange*="${atalhoId}"]`).checked = false;
            return;
        }
    } else {
        atalhosSelecionados = atalhosSelecionados.filter(id => id !== atalhoId);
    }

    // Atualizar visual
    const item = document.querySelector(`[data-atalho-id="${atalhoId}"]`);
    if (item) {
        item.style.borderColor = selecionado ? 'var(--color-primary)' : 'var(--color-border-primary)';
    }
}

/**
 * Inicializa drag and drop para reordenar
 */
function initDragAndDrop() {
    const lista = document.getElementById('atalhos-config-lista');
    if (!lista) return;

    let draggedElement = null;

    lista.querySelectorAll('.atalho-config-item').forEach(item => {
        item.addEventListener('dragstart', (e) => {
            draggedElement = item;
            item.style.opacity = '0.5';
        });

        item.addEventListener('dragend', () => {
            if (draggedElement) {
                draggedElement.style.opacity = '1';
                draggedElement = null;
            }
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            const afterElement = getDragAfterElement(lista, e.clientY);
            if (afterElement == null) {
                lista.appendChild(draggedElement);
            } else {
                lista.insertBefore(draggedElement, afterElement);
            }
        });
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.atalho-config-item:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

/**
 * Salva configuração de atalhos
 */
async function salvarConfiguracaoAtalhos() {
    // Obter ordem atual dos elementos selecionados
    const lista = document.getElementById('atalhos-config-lista');
    const selecionados = [];
    
    lista.querySelectorAll('.atalho-config-item').forEach(item => {
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (checkbox && checkbox.checked) {
            selecionados.push(item.dataset.atalhoId);
        }
    });

    if (selecionados.length === 0) {
        showToast('Selecione pelo menos um atalho', 'warning');
        return;
    }

    const sucesso = await salvarAtalhosRapidos(selecionados);
    if (sucesso) {
        showToast('Atalhos salvos com sucesso!', 'success');
        fecharModalAtalhos();
        // Recarregar atalhos na Home
        const container = document.getElementById('atalhos-rapidos-container');
        if (container) {
            await renderizarAtalhosRapidos(container);
        }
    } else {
        showToast('Erro ao salvar atalhos', 'error');
    }
}

/**
 * Fecha modal de configuração
 */
function fecharModalAtalhos(event) {
    if (event && event.target.id !== 'modal-atalhos') return;
    
    const modal = document.getElementById('modal-atalhos');
    if (modal) {
        modal.remove();
    }
    
    // Reset selecionados
    atalhosSelecionados = [];
}

// Carregar atalhos selecionados ao abrir modal
window.abrirConfiguracaoAtalhos = async function() {
    atalhosSelecionados = await carregarAtalhosRapidos();
    await abrirConfiguracaoAtalhos();
};

// Exportar funções globalmente
window.AtalhosRapidos = {
    renderizarAtalhosRapidos,
    carregarAtalhosRapidos,
    salvarAtalhosRapidos
};


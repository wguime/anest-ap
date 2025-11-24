/**
 * Quality View
 * Manages Incidents, Indicators, and ROPs.
 */

export async function render() {
    const container = document.getElementById('dynamicContent');

    container.innerHTML = `
        <div class="section-header">
            <h1 class="section-title">Qualidade e Segurança</h1>
            <p class="section-subtitle">Gestão de riscos e conformidade</p>
        </div>

        <!-- Quick Actions -->
        <div class="cards-container">
            <div class="info-card highlight" onclick="openIncidentModal()">
                <div class="card-icon-wrapper" style="background: var(--error); color: white;">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div class="card-content">
                    <h3>Reportar Incidente</h3>
                    <p>Notificação rápida e sem culpa</p>
                </div>
                <i class="fas fa-chevron-right card-arrow"></i>
            </div>
        </div>

        <!-- Indicators Preview -->
        <h2 class="section-title-small" style="margin-top: 24px;">Indicadores (Mês Atual)</h2>
        <div class="indicators-grid">
            <div class="indicator-card">
                <span class="indicator-value">98%</span>
                <span class="indicator-label">Adesão Checklist</span>
            </div>
            <div class="indicator-card">
                <span class="indicator-value">0</span>
                <span class="indicator-label">Eventos Sentinela</span>
            </div>
            <div class="indicator-card">
                <span class="indicator-value">12</span>
                <span class="indicator-label">ROPs Concluídas</span>
            </div>
        </div>

        <!-- ROPs List -->
        <h2 class="section-title-small" style="margin-top: 24px;">Práticas Organizacionais (ROPs)</h2>
        <div class="menu-list">
            <div class="menu-item" onclick="alert('Em breve: ROPs de Comunicação')">
                <div class="menu-icon"><i class="fas fa-comments"></i></div>
                <div class="menu-content">
                    <h3>Comunicação Efetiva</h3>
                    <p>Passagem de plantão e SBAR</p>
                </div>
                <i class="fas fa-chevron-right"></i>
            </div>
            <div class="menu-item" onclick="alert('Em breve: ROPs de Medicamentos')">
                <div class="menu-icon"><i class="fas fa-pills"></i></div>
                <div class="menu-content">
                    <h3>Segurança Medicamentosa</h3>
                    <p>Alta vigilância e etiquetas</p>
                </div>
                <i class="fas fa-chevron-right"></i>
            </div>
        </div>
    `;

    // Inject Modal HTML if not exists
    if (!document.getElementById('incidentModal')) {
        const modalHTML = `
            <div id="incidentModal" class="modal-overlay hidden">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Reportar Incidente</h3>
                        <button class="btn-close" onclick="closeIncidentModal()"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="modal-body">
                        <form id="incidentForm">
                            <div class="form-group">
                                <label>O que aconteceu?</label>
                                <select class="form-input" required>
                                    <option value="">Selecione...</option>
                                    <option value="medicamento">Erro de Medicação</option>
                                    <option value="equipamento">Falha de Equipamento</option>
                                    <option value="queda">Queda do Paciente</option>
                                    <option value="outros">Outros</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Descrição Breve</label>
                                <textarea class="form-input" rows="3" placeholder="Descreva o ocorrido..." required></textarea>
                            </div>
                            <div class="form-group">
                                <label>Classificação</label>
                                <div class="radio-group">
                                    <label><input type="radio" name="severity" value="near_miss"> Near Miss</label>
                                    <label><input type="radio" name="severity" value="adverse_event"> Evento Adverso</label>
                                </div>
                            </div>
                            <button type="submit" class="btn-primary full-width">Enviar Notificação</button>
                        </form>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // Expose modal functions globally for onclick handlers
    window.openIncidentModal = () => {
        document.getElementById('incidentModal').classList.remove('hidden');
    };
    window.closeIncidentModal = () => {
        document.getElementById('incidentModal').classList.add('hidden');
    };

    // Handle Form Submit
    const form = document.getElementById('incidentForm');
    if (form) {
        form.onsubmit = (e) => {
            e.preventDefault();
            // Here we would save to Firestore 'incidentes' collection
            alert('Incidente reportado com sucesso! (Simulação)');
            window.closeIncidentModal();
            form.reset();
        };
    }
}

/**
 * Shift View
 * Manages the "Escala" (Schedule) and "Doctors on Duty".
 */

export async function render() {
    const container = document.getElementById('dynamicContent');

    container.innerHTML = `
        <div class="section-header">
            <h1 class="section-title">Escala de Plantão</h1>
            <p class="section-subtitle">Gestão de equipe e turnos</p>
        </div>

        <!-- Doctors on Duty Widget (Escala do Dia) -->
        <div class="shift-widget-container">
            <div class="widget-header">
                <h3>Plantão Hoje (24h)</h3>
                <span class="badge-date">${new Date().toLocaleDateString('pt-BR')}</span>
            </div>
            
            <div class="doctors-grid" id="doctorsOnDuty">
                <!-- Loading State -->
                <div class="loading-skeleton">Carregando escala...</div>
            </div>
        </div>

        <!-- Monthly Calendar Placeholder -->
        <div class="calendar-container" style="margin-top: 24px;">
            <div class="info-card">
                <div class="card-content">
                    <h3>Escala Mensal</h3>
                    <p>Visualização de calendário em breve</p>
                </div>
                <i class="fas fa-calendar-alt card-arrow"></i>
            </div>
        </div>

        <!-- Fatigue Alert Example -->
        <div class="fatigue-alert hidden" id="fatigueAlert">
            <i class="fas fa-exclamation-triangle"></i>
            <div>
                <strong>Alerta de Fadiga</strong>
                <p>Dr. João Silva excede 24h em 48h.</p>
            </div>
        </div>
    `;

    // Load real data
    loadDoctorsOnDuty();
    checkFatigue();
}

async function loadDoctorsOnDuty() {
    // Mock data for now - in real app, fetch from 'escalas' collection
    const mockDoctors = [
        { name: 'Dr. João Silva', room: 'Sala 1', avatar: 'JS', status: 'active' },
        { name: 'Dra. Maria Lima', room: 'Sala 2', avatar: 'ML', status: 'active' },
        { name: 'Dr. Pedro Santos', room: 'RPA', avatar: 'PS', status: 'break' },
        { name: 'Dra. Ana Costa', room: 'Coord.', avatar: 'AC', status: 'active' },
    ];

    const grid = document.getElementById('doctorsOnDuty');
    if (!grid) return;

    // Simulate network delay
    setTimeout(() => {
        grid.innerHTML = mockDoctors.map(doc => `
            <div class="doctor-card ${doc.status === 'break' ? 'status-break' : ''}">
                <div class="doctor-avatar">${doc.avatar}</div>
                <div class="doctor-info">
                    <span class="doctor-name">${doc.name}</span>
                    <span class="doctor-room"><i class="fas fa-map-marker-alt"></i> ${doc.room}</span>
                </div>
                <div class="status-indicator ${doc.status}"></div>
            </div>
        `).join('');
    }, 500);
}

async function checkFatigue() {
    // Mock logic: Check for doctors with excessive hours
    // In real app: Query 'shifts' collection for last 48h per doctor
    const fatigueRisk = true; // Simulating a risk found
    const doctorName = 'Dr. João Silva';

    if (fatigueRisk) {
        const alert = document.getElementById('fatigueAlert');
        if (alert) {
            alert.classList.remove('hidden');
            alert.querySelector('p').textContent = `${doctorName} excede 24h em 48h.`;
        }
    }
}

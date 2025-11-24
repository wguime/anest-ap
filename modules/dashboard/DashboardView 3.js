/**
 * Dashboard View
 * Renders the "Command Center" with real data.
 */
import { getCurrentUser, getUserProfile } from '../core/Auth.js';

export async function render() {
    const container = document.getElementById('dynamicContent');

    // Render Skeleton/Loading State
    container.innerHTML = `
        <div class="section-header">
            <h1 class="section-title">Centro de Comando</h1>
            <p class="section-subtitle">Visão geral do seu plantão</p>
        </div>
        
        <div class="cards-container">
            <!-- Feed de Prioridades -->
            <div class="info-card highlight" id="card-prioridades">
                <div class="card-icon-wrapper">
                    <i class="fas fa-bullhorn"></i>
                </div>
                <div class="card-content">
                    <h3>Feed de Prioridades</h3>
                    <p>Carregando...</p>
                </div>
            </div>

            <!-- Minhas Pendências -->
            <div class="info-card" id="card-pendencias">
                <div class="card-icon-wrapper">
                    <i class="fas fa-tasks"></i>
                </div>
                <div class="card-content">
                    <h3>Minhas Pendências</h3>
                    <p>Verificando...</p>
                </div>
            </div>

            <!-- Resumo de Plantão -->
            <div class="info-card" onclick="alert('Funcionalidade em breve')">
                <div class="card-icon-wrapper">
                    <i class="fas fa-clock"></i>
                </div>
                <div class="card-content">
                    <h3>Resumo de Plantão</h3>
                    <p>Toque para check-in</p>
                </div>
                <i class="fas fa-chevron-right card-arrow"></i>
            </div>
        </div>

        <!-- Quick Actions Grid -->
        <h2 class="section-title-small" style="margin-top: 24px;">Acesso Rápido</h2>
        <div class="menu-list">
             <div class="menu-item" onclick="window.location.hash='#/clinical'">
                <div class="menu-icon" style="background: var(--primary-light); color: var(--primary-dark);">
                    <i class="fas fa-calculator"></i>
                </div>
                <div class="menu-content">
                    <h3>Calculadoras</h3>
                    <p>Doses e riscos</p>
                </div>
                <i class="fas fa-chevron-right"></i>
            </div>
        </div>
    `;

    // Fetch Data asynchronously
    loadPriorities();
    loadPendencies();
}

async function loadPriorities() {
    try {
        const snapshot = await firebase.firestore()
            .collection('comunicados')
            .where('prioridade', '==', 'urgente')
            .limit(3)
            .get();

        const count = snapshot.size;
        const card = document.getElementById('card-prioridades');
        if (card) {
            const text = card.querySelector('p');
            if (count > 0) {
                text.textContent = `${count} comunicados urgentes`;
                text.style.color = 'var(--error)';
                text.style.fontWeight = 'bold';
            } else {
                text.textContent = 'Nenhuma urgência no momento';
                text.style.color = 'var(--text-secondary)';
            }
        }
    } catch (error) {
        console.error('Erro ao carregar prioridades:', error);
    }
}

async function loadPendencies() {
    const user = getCurrentUser();
    const profile = getUserProfile();
    const card = document.getElementById('card-pendencias');

    if (!user || !profile || !card) {
        if (card) card.querySelector('p').textContent = 'Faça login para ver';
        return;
    }

    try {
        const db = firebase.firestore();
        const userCreatedAt = profile.createdAt && profile.createdAt.toDate ? profile.createdAt.toDate() : new Date();
        let totalPendencies = 0;

        // 1. Comunicados Novos
        const comunicadosSnapshot = await db.collection('comunicados')
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();

        const lidosSnapshot = await db.collection('usuarios').doc(user.uid)
            .collection('comunicados_lidos').get();
        const lidos = new Set(lidosSnapshot.docs.map(d => d.id));

        comunicadosSnapshot.forEach(doc => {
            const data = doc.data();
            const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
            if (createdAt >= userCreatedAt && !lidos.has(doc.id)) {
                totalPendencies++;
            }
        });

        // 2. Documentos Novos
        const docsSnapshot = await db.collection('documentos')
            .orderBy('uploadedAt', 'desc')
            .limit(20)
            .get();

        const docsVistosSnapshot = await db.collection('usuarios').doc(user.uid)
            .collection('documentos_visualizados').get();
        const docsVistos = new Set(docsVistosSnapshot.docs.map(d => d.id));

        docsSnapshot.forEach(doc => {
            const data = doc.data();
            const uploadedAt = data.uploadedAt?.toDate ? data.uploadedAt.toDate() : new Date();
            if (uploadedAt >= userCreatedAt && !docsVistos.has(doc.id)) {
                totalPendencies++;
            }
        });

        // Update UI
        const text = card.querySelector('p');
        if (totalPendencies > 0) {
            text.textContent = `${totalPendencies} itens pendentes`;
            text.style.color = 'var(--warning)';
            text.style.fontWeight = 'bold';
        } else {
            text.textContent = 'Tudo em dia!';
            text.style.color = 'var(--success)';
        }

    } catch (error) {
        console.error('Erro ao carregar pendências:', error);
        if (card) card.querySelector('p').textContent = 'Erro ao carregar';
    }
}

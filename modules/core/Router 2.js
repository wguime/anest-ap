/**
 * Router Module
 * Handles hash-based navigation.
 */

const routes = {
    '#/login': () => import('../ui/LoginView.js').then(m => m.render()),
    '#/dashboard': () => import('../dashboard/DashboardView.js').then(m => m.render()),
    '#/shifts': () => import('../shifts/ShiftView.js').then(m => m.render()),
    '#/clinical': () => import('../clinical/ClinicalView.js').then(m => m.render()),
    '#/quality': () => import('../quality/QualityView.js').then(m => m.render()),
    '#/documents': () => import('../documents/DocumentsView.js').then(m => m.render()),
    '#/profile': () => import('../ui/ProfileView.js').then(m => m.render()),
};

export function initRouter() {
    window.addEventListener('hashchange', handleRoute);
    handleRoute(); // Handle initial route
}

async function handleRoute() {
    const hash = window.location.hash || '#/dashboard';
    console.log('📍 Navigating to:', hash);

    const appContainer = document.getElementById('dynamicContent'); // We'll use this or a new container

    // Basic Guard
    if (hash !== '#/login' && !firebase.auth().currentUser) {
        // Wait a bit for auth to initialize if it's the first load
        // For now, let Auth.js handle the redirect if not logged in
    }

    const renderer = routes[hash];
    if (renderer) {
        try {
            // Clear current content
            // appContainer.innerHTML = '<div class="loader"></div>'; 

            // Render new content
            await renderer();

            // Update Bottom Nav Active State
            updateActiveNav(hash);
        } catch (error) {
            console.error('Error rendering route:', error);
            appContainer.innerHTML = '<p>Erro ao carregar a página.</p>';
        }
    } else {
        console.warn('Route not found:', hash);
        // Default to dashboard
        if (hash !== '#/dashboard') window.location.hash = '#/dashboard';
    }
}

function updateActiveNav(hash) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('href') === hash) {
            item.classList.add('active');
        }
    });
}

/**
 * Shell Module
 * Manages the main app layout (Header, Bottom Nav).
 */
import { logout, getCurrentUser } from '../core/Auth.js';

export function initShell() {
    const mainApp = document.getElementById('mainApp');
    if (!mainApp) return;

    // Setup Top Bar (Header)
    setupTopBar();

    // Setup Bottom Navigation
    setupBottomNav();
}

function setupTopBar() {
    const header = document.querySelector('.app-header');
    if (header) {
        // Clear existing content to rebuild with search
        header.innerHTML = `
            <div class="header-content">
                <div class="search-bar-container">
                    <i class="fas fa-search search-icon"></i>
                    <input type="text" class="search-input" placeholder="Buscar protocolos, ferramentas..." id="globalSearchInput">
                </div>
                <button class="btn-icon" onclick="logout()">
                    <i class="fas fa-sign-out-alt"></i>
                </button>
            </div>
        `;

        // Re-attach logout listener
        const logoutBtn = header.querySelector('.btn-icon[onclick="logout()"]');
        if (logoutBtn) {
            logoutBtn.onclick = (e) => {
                e.preventDefault();
                logout();
            };
        }

        // Search listener
        const searchInput = document.getElementById('globalSearchInput');
        if (searchInput) {
            searchInput.addEventListener('focus', () => {
                // Expand search or show recent searches
                console.log('Search focused');
            });
        }
    }
}

function setupBottomNav() {
    const nav = document.querySelector('.bottom-nav');
    if (nav) {
        nav.innerHTML = `
            <a href="#/dashboard" class="nav-item active">
                <i class="fas fa-home"></i>
                <span>Início</span>
            </a>
            <a href="#/shifts" class="nav-item">
                <i class="fas fa-calendar-alt"></i>
                <span>Escala</span>
            </a>
            <a href="#/quality" class="nav-item">
                <i class="fas fa-shield-alt"></i>
                <span>Qualidade</span>
            </a>
            <a href="#/documents" class="nav-item">
                <i class="fas fa-book"></i>
                <span>Biblioteca</span>
            </a>
            <a href="#/profile" class="nav-item">
                <i class="fas fa-user"></i>
                <span>Perfil</span>
            </a>
        `;
    }
}

export function updateHeader(title, showBack = false) {
    const header = document.querySelector('.app-header');
    if (!header) return;

    // Simple header update logic - can be expanded
    const titleEl = header.querySelector('h1') || header.querySelector('.header-title');
    if (titleEl) titleEl.textContent = title;
}

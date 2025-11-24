/**
 * Login View
 * Renders the Login Screen.
 */
import { login } from '../core/Auth.js';

export function render() {
    // In a real SPA, we might just show/hide the login overlay
    // For now, we'll ensure the login screen is visible and main app is hidden
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');

    if (loginScreen) loginScreen.style.display = 'flex';
    if (mainApp) mainApp.style.display = 'none';

    // Re-attach listeners if needed (or rely on existing ones in index.html for now)
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            try {
                await login(email, password);
            } catch (error) {
                alert('Erro ao fazer login: ' + error.message);
            }
        };
    }
}

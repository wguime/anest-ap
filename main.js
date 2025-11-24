/**
 * Main Entry Point
 * Initializes the application, authentication, and routing.
 */
import { initAuth } from './modules/core/Auth.js';
import { initRouter } from './modules/core/Router.js';
import { initShell } from './modules/ui/Shell.js';

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 App Initializing...');

    // Initialize UI Shell (Navigation, Header)
    initShell();

    // Initialize Router
    initRouter();

    // Initialize Authentication (this will trigger router updates)
    initAuth();
    
    console.log('✅ App Initialized');
});

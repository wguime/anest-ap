/**
 * Sistema de navegação Fintech Style (Mockup 2)
 * Gerencia a troca de seções e estado da bottom navigation
 */
function navigateToPage(pageName) {
    console.log(`[Navigation] Navegando para: ${pageName}`);
    
    // 1. Esconder todas as seções
    const sections = ['homeSection', 'qualidadeSection', 'documentosSection', 'ferramentasSection'];
    
    sections.forEach(sectionId => {
        const section = document.getElementById(sectionId);
        if (section) {
            section.style.display = 'none';
            section.classList.remove('active');
        }
    });

    // 2. Mostrar seção selecionada
    const targetId = pageName + 'Section';
    const targetSection = document.getElementById(targetId);
    
    if (targetSection) {
        targetSection.style.display = 'block';
        targetSection.classList.add('active');
        
        // Renderizar conteúdo específico se necessário
        switch(pageName) {
            case 'home':
                if (typeof renderHomeSection === 'function') {
                    renderHomeSection();
                } else {
                    console.warn('[Navigation] renderHomeSection não encontrada');
                }
                break;
            case 'qualidade':
                if (typeof renderQualidadeSection === 'function') {
                    renderQualidadeSection();
                } else {
                    console.warn('[Navigation] renderQualidadeSection não encontrada');
                }
                break;
            case 'documentos':
                if (typeof renderDocumentosSection === 'function') {
                    renderDocumentosSection();
                } else {
                    console.warn('[Navigation] renderDocumentosSection não encontrada');
                }
                break;
            case 'ferramentas':
                if (typeof renderFerramentasSection === 'function') {
                    renderFerramentasSection();
                } else {
                    console.warn('[Navigation] renderFerramentasSection não encontrada');
                }
                break;
        }
    } else {
        console.error(`[Navigation] Seção não encontrada: ${targetId}`);
    }

    // 3. Atualizar bottom nav
    const navItems = document.querySelectorAll('.bottom-nav-item');
    navItems.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-page') === pageName) {
            item.classList.add('active');
        }
    });

    // 4. Scroll to top e atualizar estado global
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (typeof currentScreen !== 'undefined') {
        currentScreen = pageName;
    }
    
    // Atualizar histórico de navegação
    if (typeof navigationHistory !== 'undefined') {
        if (navigationHistory.length === 0 || navigationHistory[navigationHistory.length - 1] !== pageName) {
            navigationHistory.push(pageName);
        }
    }
    
    console.log(`[Navigation] Navegação concluída para: ${pageName}`);
}

// Alias para manter compatibilidade com chamadas antigas
// Esta função será sobrescrita pelo app.js, mas mantém compatibilidade inicial
if (typeof showSection === 'undefined') {
    window.showSection = function(sectionName) {
        // Mapeamento de nomes antigos para novos
        const map = {
            'painel': 'home',
            'protocolos': 'documentos'
        };
        
        const newName = map[sectionName] || sectionName;
        navigateToPage(newName);
    };
}


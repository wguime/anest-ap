// ==================== GLOBAL STATE ====================
let currentUser = null;
let currentScreen = 'home';
let currentQuiz = null;
let userProfile = null; // Perfil do usuário para sistema de pendências
let userProgress = {
    scores: {},
    completedTopics: [],
    totalPoints: 0,
    achievements: []
};
let navigationHistory = []; // Histórico de navegação para botão voltar
let isNavigatingBack = false; // Flag para evitar atualizar histórico ao voltar

// ==================== FUNÇÕES AUXILIARES ====================

// Função auxiliar para detectar dispositivos mobile
function isMobileDevice() {
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

// Mapeamento de hierarquia: página filha -> página pai
const pageHierarchy = {
    // Páginas do Painel
    'pendencias': 'painel',
    'comunicados': 'painel',
    'kpis': 'painel',
    'rops-desafio': 'painel',
    'residencia': 'painel',
    
    // Páginas de Qualidade
    'auditorias': 'qualidade',
    'relatorios': 'qualidade',
    'grupo-auditorias-operacionais': 'auditorias',
    'conformidade-politicas': 'auditorias',
    // Auditorias específicas podem vir de grupo-auditorias-operacionais ou conformidade-politicas
    'auditoria-higiene-maos': 'grupo-auditorias-operacionais',
    'auditoria-uso-medicamentos': 'grupo-auditorias-operacionais',
    'auditoria-abreviaturas': 'grupo-auditorias-operacionais',
    'auditoria-politica-gestao-qualidade': 'conformidade-politicas',
    'auditoria-politica-disclosure': 'conformidade-politicas',
    'relatorio-auditorias': 'conformidade-politicas',
    'relatorio-trimestral': 'relatorios',
    'relatorio-incidentes': 'relatorios',
    'relatorio-indicadores-qualidade': 'relatorios',
    
    // Páginas de Protocolos
    'biblioteca': 'protocolos',
    'biblioteca-documentos': 'protocolos',
    'seguranca-medicamentos': 'protocolos',
    'protocolos-prevencao': 'protocolos',
    'controle-infeccao': 'protocolos',
    'grupo-protocolos-basicos-prevencao': 'protocolos-prevencao',
    'grupo-bundles-iras': 'protocolos-prevencao',
    // Documentos específicos de protocolos básicos
    'doc-protocolo-higiene-maos': 'grupo-protocolos-basicos-prevencao',
    'doc-prevencao-broncoaspiracao': 'grupo-protocolos-basicos-prevencao',
    'doc-prevencao-alergia-latex': 'grupo-protocolos-basicos-prevencao',
    // Documentos específicos de bundles IRAS
    'doc-prevencao-isc': 'grupo-bundles-iras',
    'doc-prevencao-ics': 'grupo-bundles-iras',
    'doc-prevencao-pav': 'grupo-bundles-iras',
    'doc-prevencao-itu': 'grupo-bundles-iras',
    'grupo-medicamentos-alta-vigilancia': 'biblioteca-documentos',
    'grupo-medicamentos-especificos': 'biblioteca-documentos',
    'grupo-listas-diretrizes': 'biblioteca-documentos',
    // Documentos específicos de medicamentos - Alta Vigilância
    'doc-medicamentos-alta-vigilancia': 'grupo-medicamentos-alta-vigilancia',
    'doc-intoxicacao-anestesicos-locais': 'grupo-medicamentos-alta-vigilancia',
    'doc-manejo-glicemia': 'grupo-medicamentos-alta-vigilancia',
    // Documentos específicos de medicamentos - Específicos
    'doc-eletrolitos': 'grupo-medicamentos-especificos',
    'doc-heparina': 'grupo-medicamentos-especificos',
    'doc-narcoticos': 'grupo-medicamentos-especificos',
    
    // Páginas de Ferramentas
    'calculadoras': 'ferramentas',
    'conciliacao-medicamentosa': 'ferramentas',
    // Documentos específicos de conciliação medicamentosa
    'doc-conciliacao-admissao': 'conciliacao-medicamentosa',
    'doc-conciliacao-transferencia': 'conciliacao-medicamentosa',
    'doc-conciliacao-alta': 'conciliacao-medicamentosa',
    'doc-protocolo-institucional': 'conciliacao-medicamentosa',
    
    // ROPs é uma página especial (screen separada)
    'rops': 'painel'
};

// ==================== LAYOUT COMPONENTS (Padrão Segurança de Medicamentos) ====================

/**
 * Mapeia emojis para ícones FontAwesome
 * @param {string} emoji - Emoji a ser convertido
 * @returns {string} Classe FontAwesome correspondente
 */
function emojiToFontAwesome(emoji) {
    const emojiMap = {
        '🏠': 'fa-home',
        '📢': 'fa-bullhorn',
        '📋': 'fa-clipboard-list',
        '📊': 'fa-chart-line',
        '🏆': 'fa-trophy',
        '🧑‍⚕️': 'fa-user-md',
        '⚠️': 'fa-exclamation-triangle',
        '📖': 'fa-book',
        '💊': 'fa-pills',
        '🦠': 'fa-virus',
        '✅': 'fa-check-circle',
        '🛠️': 'fa-tools',
        '🛡️': 'fa-shield-alt',
        '📝': 'fa-file-alt',
        '🎧': 'fa-headphones',
        '💬': 'fa-comments',
        '👥': 'fa-users',
        '🧼': 'fa-hand-sparkles',
        '🧮': 'fa-calculator',
        '🔧': 'fa-wrench',
        '📚': 'fa-book-open',
        '🛏️': 'fa-bed',
        '⚖️': 'fa-balance-scale',
        '⚕️': 'fa-plus-circle',
        '👨‍👩‍👧': 'fa-users',
        '🎗️': 'fa-ribbon',
        '❤️': 'fa-heart',
        '🌬️': 'fa-wind',
        '📅': 'fa-calendar-alt',
        '🏥': 'fa-hospital',
        '🩸': 'fa-tint',
        '🦵': 'fa-walking',
        '👴': 'fa-user',
        '🧓': 'fa-user',
        '🧬': 'fa-dna',
        '👩': 'fa-user',
        '📄': 'fa-file-alt',
        '🔗': 'fa-link'
    };
    
    return emojiMap[emoji] || 'fa-circle';
}

/**
 * Converte um ícone (emoji ou FontAwesome) para HTML FontAwesome
 * @param {string} icon - Ícone (emoji ou classe FontAwesome)
 * @returns {string} HTML do ícone FontAwesome
 */
function getIconHTML(icon) {
    // Se já é uma classe FontAwesome (começa com 'fa-' ou 'fas ')
    if (icon.startsWith('fa-') || icon.startsWith('fas ')) {
        return `<i class="${icon.startsWith('fas ') ? icon : 'fas ' + icon}"></i>`;
    }
    
    // Se é um emoji, converter para FontAwesome
    const faClass = emojiToFontAwesome(icon);
    return `<i class="fas ${faClass}"></i>`;
}

/**
 * Renderiza o cabeçalho de seção padronizado
 * @param {string} emoji - Emoji para o título
 * @param {string} title - Título da seção
 * @param {string} subtitle - Subtítulo/descrição
 * @returns {string} HTML do cabeçalho
 */
function renderSectionHeader(emoji, title, subtitle) {
    return `
        <div class="section-header">
            <h1 class="section-title">${emoji} ${title}</h1>
            <p class="section-subtitle">${subtitle}</p>
        </div>
    `;
}

/**
 * Renderiza um banner informativo com gradiente
 * @param {string} icon - Classe do ícone FontAwesome
 * @param {string} title - Título do banner
 * @param {string} description - Descrição
 * @param {string} gradient - Gradiente CSS (ex: '#dc2626 0%, #991b1b 100%')
 * @param {string} backOnClick - Função onclick para o botão voltar (opcional)
 * @returns {string} HTML do banner
 */
function renderInfoBanner(icon, title, description, gradient, backOnClick = null) {
    return `
        <div class="info-banner" style="background: linear-gradient(135deg, ${gradient}); color: white; padding: 16px; border-radius: 12px; margin-bottom: 24px; margin-top: 0; position: relative; z-index: 1;">
            ${backOnClick ? `
                <button class="btn-back" onclick="${backOnClick}" style="position: absolute; top: 16px; left: 16px; width: 44px; height: 44px; border-radius: 50%; background: rgba(255,255,255,0.2); border: 2px solid rgba(255,255,255,0.3); color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s;">
                    <i class="fas fa-arrow-left" style="font-size: 18px;"></i>
                </button>
            ` : ''}
            <div style="display: flex; align-items: center; gap: 12px; ${backOnClick ? 'padding-left: 60px;' : ''}">
                <i class="${icon}" style="font-size: 24px;"></i>
                <div>
                    <strong style="display: block; font-size: 16px; margin-bottom: 4px;">${title}</strong>
                    <span style="font-size: 14px; opacity: 0.95;">${description}</span>
                </div>
            </div>
        </div>
    `;
}

/**
/**
 * Renderiza um card de protocolo/documento padronizado
 * @param {Object} item - Objeto com {icon, title, description, file, color, onClick, showStatus}
 * @returns {string} HTML do card
 */
function renderProtocolCard(item) {
    const hasFile = item.file && item.file !== null;
    const onClickAttr = item.onClick 
        ? `onclick="${item.onClick}"` 
        : hasFile 
            ? `onclick="openDocument('${item.file.replace(/'/g, "\\'")}', '${item.title.replace(/'/g, "\\'")}')"` 
            : `onclick="showToast('Documento em breve', 'info')"`;
    
    // Mostrar status apenas se showStatus for true E se não tiver onClick customizado
    const showStatusBadge = item.showStatus === true && !item.onClick;
    
    // Mostrar descrição apenas se showDescription for true (para página de calculadoras)
    const showDescription = item.showDescription === true;
    
    // Converter ícone (emoji ou FontAwesome) para HTML FontAwesome
    const iconHTML = getIconHTML(item.icon);
    
    return `
        <div class="protocol-card" ${onClickAttr} style="cursor: pointer;">
            <div class="protocol-icon" style="background: ${item.color || '#2563eb'};">
                ${iconHTML}
            </div>
            <div class="protocol-content">
                <h3 class="protocol-title">${item.title}</h3>
                ${showDescription ? `<p class="protocol-description">${item.description}</p>` : ''}
                ${showStatusBadge ? (hasFile ? 
                    '<span class="protocol-status available"><i class="fas fa-check-circle"></i> Disponível</span>' : 
                    '<span class="protocol-status pending"><i class="fas fa-clock"></i> Em breve</span>'
                ) : ''}
            </div>
        </div>
    `;
}

/**
 * Renderiza uma caixa informativa no final da página
 * @param {string} icon - Classe do ícone FontAwesome
 * @param {string} title - Título da caixa
 * @param {string} content - Conteúdo HTML
 * @returns {string} HTML da info box
 */
function renderInfoBox(icon, title, content) {
    return `
        <div class="info-box" style="margin-top: 24px;">
            <i class="${icon}"></i>
            <div>
                <strong>${title}</strong>
                ${content}
            </div>
        </div>
    `;
}

/**
 * Alterna a exibição de um grupo de cards (expandir/colapsar)
 * @param {string} groupId - ID do elemento do grupo a ser expandido/colapsado
 */
function toggleGroup(groupId) {
    const content = document.getElementById(groupId);
    const icon = document.getElementById(`icon_${groupId}`);
    
    if (!content || !icon) return;
    
    const isVisible = content.style.display !== 'none' && content.style.display !== '';
    const computedStyle = window.getComputedStyle(content);
    const isActuallyVisible = computedStyle.display !== 'none';
    
    if (!isVisible && !isActuallyVisible) {
        // Expandir
        content.style.display = 'block';
        icon.style.transform = 'rotate(180deg)';
    } else {
        // Colapsar
        content.style.display = 'none';
        icon.style.transform = 'rotate(0deg)';
    }
}

/**
 * Renderiza um layout completo padronizado
 * @param {Object} config - {header, banner, items, infoBox}
 * @returns {string} HTML completo
 */
function renderStandardLayout(config) {
    let html = '';

    // Banner (header removido - não renderizar mais)
    if (config.banner) {
        html += renderInfoBanner(config.banner.icon, config.banner.title, config.banner.description, config.banner.gradient, config.banner.backOnClick || null);
    }

    // Grid de cards
    if (config.items && config.items.length > 0) {
        html += '<div class="protocols-grid">';
        config.items.forEach(item => {
            html += renderProtocolCard(item);
        });
        html += '</div>';
    }

    // Info box
    if (config.infoBox) {
        html += renderInfoBox(config.infoBox.icon, config.infoBox.title, config.infoBox.content);
    }

    return html;
}

// ==================== DARK MODE ====================
function toggleDarkMode() {
    const body = document.body;
    body.classList.toggle('dark-mode');

    // Salvar preferência
    const isDarkMode = body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);

    // Atualizar todos os ícones de dark mode (desktop e dropdown)
    const darkModeIcons = document.querySelectorAll('[onclick*="toggleDarkMode"] i');
    const darkModeText = document.getElementById('darkModeText');

    darkModeIcons.forEach(icon => {
        if (isDarkMode) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        } else {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    });

    // Atualizar texto no dropdown
    if (darkModeText) {
        darkModeText.textContent = isDarkMode ? 'Modo Claro' : 'Modo Escuro';
    }
}

function loadDarkModePreference() {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
        document.body.classList.add('dark-mode');

        // Atualizar todos os ícones
        const darkModeIcons = document.querySelectorAll('[onclick*="toggleDarkMode"] i');
        darkModeIcons.forEach(icon => {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        });

        // Atualizar texto no dropdown
        const darkModeText = document.getElementById('darkModeText');
        if (darkModeText) {
            darkModeText.textContent = 'Modo Claro';
        }
    }
}

// ==================== PROFILE DROPDOWN ====================
function toggleProfileDropdown(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('profileDropdown');
    const isActive = dropdown.classList.contains('active');

    // Fechar todos os outros dropdowns primeiro
    closeAllDropdowns();

    if (!isActive) {
        dropdown.style.display = 'block';
        // Pequeno delay para animação funcionar
        setTimeout(() => {
            dropdown.classList.add('active');
        }, 10);
    }
}

function closeProfileDropdown() {
    const dropdown = document.getElementById('profileDropdown');
    dropdown.classList.remove('active');
    setTimeout(() => {
        if (!dropdown.classList.contains('active')) {
            dropdown.style.display = 'none';
        }
    }, 300);
}

function closeAllDropdowns() {
    // Fechar dropdown de busca global
    const searchDropdown = document.getElementById('searchResults');
    if (searchDropdown) {
        searchDropdown.classList.remove('active');
    }

    // Fechar dropdown de perfil
    const profileDropdown = document.getElementById('profileDropdown');
    if (profileDropdown) {
        profileDropdown.classList.remove('active');
        setTimeout(() => {
            if (!profileDropdown.classList.contains('active')) {
                profileDropdown.style.display = 'none';
            }
        }, 300);
    }
}

// Fechar dropdowns ao clicar fora
document.addEventListener('click', (event) => {
    const profileContainer = event.target.closest('.profile-dropdown-container');
    const searchContainer = event.target.closest('.header-search-container');

    if (!profileContainer && !searchContainer) {
        closeAllDropdowns();
    }
});

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async () => {
    // Carregar preferência de dark mode
    loadDarkModePreference();

    // ==================== INICIALIZAR SISTEMA DE BUSCA ====================
    // Sistema simplificado com MiniSearch
    // A inicialização completa será feita após autenticação

    // Setup input listener imediatamente (busca será inicializada depois)
    const searchInput = document.getElementById('globalSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value;
            const container = document.getElementById('searchResults');

            if (!container) return;

            if (query.length < 2) {
                if (window.AnestSearch && typeof window.AnestSearch.hideResults === 'function') {
                    window.AnestSearch.hideResults();
                }
                return;
            }

            // Se busca já inicializada, executar
            if (window.AnestSearch && window.AnestSearch.initialized) {
                const results = window.AnestSearch.search(query);
                window.AnestSearch.renderResults(results, container);
            } else {
                // Mostrar loading
                container.innerHTML = '<div class="search-loading"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';
                container.style.display = 'block';
            }
        });

        console.log('✅ Event listener de busca configurado');
    }
    // ======================================================================

    // Garantir que loading screen seja ocultado após um tempo máximo
    setTimeout(() => {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
    }, 3000); // Timeout de segurança após 3 segundos
    
    // rops-data.js já contém todas as 640 questões
    // Não precisa mais carregar do JSON separado
    
    // Configurar event listeners dos formulários
    const loginForm = document.getElementById('loginForm');
    const loginButton = loginForm?.querySelector('.btn-login-primary');
    
    // Função auxiliar para processar login
    const processLogin = async () => {
        const email = document.getElementById('loginEmail')?.value?.trim();
        const password = document.getElementById('loginPassword')?.value;
        console.log('📧 Email:', email ? 'preenchido' : 'vazio');
        console.log('🔒 Senha:', password ? 'preenchida' : 'vazia');
        
        if (email && password) {
            console.log('🚀 Iniciando login...');
            await handleLogin(email, password);
        } else {
            console.log('❌ Campos vazios');
            showToast('Por favor, preencha todos os campos', 'error');
        }
    };
    
    if (loginForm) {
        console.log('✅ Formulário de login encontrado, adicionando event listener');
        
        // Event listener no formulário (submit)
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('📝 Submit do formulário de login detectado');
            await processLogin();
        });
        
        // Event listener adicional no botão (para mobile - eventos de toque)
        if (loginButton) {
            loginButton.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('👆 Clique no botão de login detectado');
                await processLogin();
            });
            
            // Suporte para eventos de toque
            loginButton.addEventListener('touchend', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('👆 Toque no botão de login detectado');
                await processLogin();
            });
        }
    } else {
        console.error('❌ Formulário de login não encontrado!');
    }
    
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('registerName')?.value;
            const email = document.getElementById('registerEmail')?.value;
            const password = document.getElementById('registerPassword')?.value;
            const confirmPassword = document.getElementById('registerPasswordConfirm')?.value;
            if (name && email && password && confirmPassword) {
                await handleRegister(name, email, password, confirmPassword);
            } else {
                showToast('Por favor, preencha todos os campos', 'error');
            }
        });
    }
    
    // Inicializar app
    try {
        initializeApp();
    } catch (error) {
        console.error('❌ Erro ao inicializar app:', error);
        // Em caso de erro, mostrar tela de login
        showLoginScreen();
    }
});

let authStateListener = null;
let isProcessingAuthState = false;
let lastProcessedUserId = null;
let authStateChangeTimeout = null;

function initializeApp() {
    // Garantir que a tela de login seja exibida inicialmente
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');
    const loadingScreen = document.getElementById('loadingScreen');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const loginTabs = document.getElementById('loginTabs');
    
    // Mostrar login screen por padrão e ocultar loading
    if (loginScreen) {
        loginScreen.style.setProperty('display', 'flex', 'important');
        loginScreen.classList.remove('hidden');
    }
    if (mainApp) {
        mainApp.style.setProperty('display', 'none', 'important');
        mainApp.classList.add('hidden');
    }
    if (loadingScreen) {
        loadingScreen.style.setProperty('display', 'none', 'important');
    }
    
    // Garantir que apenas o formulário de login esteja visível inicialmente
    if (loginForm) {
        loginForm.style.setProperty('display', 'flex', 'important');
        loginForm.classList.remove('hidden');
    }
    if (registerForm) {
        registerForm.style.setProperty('display', 'none', 'important');
        registerForm.classList.add('hidden');
    }
    if (loginTabs) {
        loginTabs.classList.add('hidden');
    }
    
    // Verificar se Firebase está disponível
    if (typeof firebase === 'undefined' || !firebase.auth) {
        console.error('❌ Firebase não está disponível');
        showLoginScreen();
        return;
    }
    
    // Remover listener anterior se existir
    if (authStateListener) {
        authStateListener();
        authStateListener = null;
    }
    
    // Limpar timeout anterior se existir
    if (authStateChangeTimeout) {
        clearTimeout(authStateChangeTimeout);
        authStateChangeTimeout = null;
    }
    
    // Check authentication state
    authStateListener = auth.onAuthStateChanged(async (user) => {
        // Evitar processamento simultâneo do mesmo estado
        const userId = user ? user.uid : null;
        
        // Se já está processando o mesmo usuário, ignorar
        if (isProcessingAuthState) {
            if (userId === lastProcessedUserId) {
                console.log('⚠️ Estado de autenticação já está sendo processado, ignorando chamada duplicada');
                return;
            }
        }
        
        // Cancelar processamento anterior se houver
        if (authStateChangeTimeout) {
            clearTimeout(authStateChangeTimeout);
        }
        
        isProcessingAuthState = true;
        lastProcessedUserId = userId;
        
        // Usar timeout para evitar múltiplas execuções rápidas
        authStateChangeTimeout = setTimeout(async () => {
            try {
                if (user) {
                    // Verificar se o usuário realmente mudou
                    if (currentUser && currentUser.uid === user.uid) {
                        console.log('✅ Usuário já autenticado, mantendo estado atual');
                        isProcessingAuthState = false;
                        return;
                    }
                    
                    currentUser = user;
                    await loadUserProfile();
                    await loadCurrentUserData();
                    loadUserProgress();

                    // Inicializar sistema de busca após dados carregados
                    if (window.AnestSearch && !window.AnestSearch.initialized) {
                        console.log('🔍 Inicializando busca após autenticação...');
                        try {
                            await window.AnestSearch.init();
                        } catch (error) {
                            console.error('❌ Erro ao inicializar busca:', error);
                        }
                    }

                    await showMainApp();
                } else {
                    console.log('Usuário não autenticado, mostrando tela de login');
                    userProfile = null;
                    currentUser = null;
                    showLoginScreen();
                }
            } catch (error) {
                console.error('❌ Erro ao processar mudança de estado de autenticação:', error);
                showLoginScreen();
            } finally {
                // Resetar flag após delay
                setTimeout(() => {
                    isProcessingAuthState = false;
                }, 1000);
            }
        }, 100);
    });
}

// ==================== AUTHENTICATION ====================
function showRegisterTabs() {
    console.log('showRegisterTabs chamada');
    // Mostra as abas removendo a classe hidden
    const loginTabs = document.getElementById('loginTabs');
    if (loginTabs) {
        loginTabs.classList.remove('hidden');
        console.log('Abas mostradas');
    } else {
        console.error('loginTabs não encontrado');
    }
    // Muda para a aba de registro
    showTab('register');
}

function showTab(tab) {
    console.log('showTab chamada com:', tab);
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const tabs = document.querySelectorAll('.tab-btn');
    const loginTabs = document.getElementById('loginTabs');
    
    // Se mudar para register, garante que as abas estejam visíveis
    if (tab === 'register' && loginTabs) {
        loginTabs.classList.remove('hidden');
    }
    
    // Remove active de todas as abas
    tabs.forEach(btn => btn.classList.remove('active'));
    
    // Adiciona active na aba correspondente
    tabs.forEach(btn => {
        const btnText = btn.textContent.trim();
        if ((tab === 'login' && btnText === 'Login') ||
            (tab === 'register' && btnText === 'Registrar')) {
            btn.classList.add('active');
            console.log('Aba ativada:', btnText);
        }
    });
    
    // Mostra/esconde os formulários com !important via style
    if (tab === 'login') {
        if (loginForm) {
            loginForm.style.setProperty('display', 'flex', 'important');
            loginForm.classList.remove('hidden');
            console.log('Formulário de login mostrado');
        }
        if (registerForm) {
            registerForm.style.setProperty('display', 'none', 'important');
            registerForm.classList.add('hidden');
            console.log('Formulário de registro escondido');
        }
    } else {
        if (loginForm) {
            loginForm.style.setProperty('display', 'none', 'important');
            loginForm.classList.add('hidden');
            console.log('Formulário de login escondido');
        }
        if (registerForm) {
            registerForm.style.setProperty('display', 'flex', 'important');
            registerForm.classList.remove('hidden');
            console.log('Formulário de registro mostrado');
        }
    }
}

// Variável para prevenir múltiplos cliques simultâneos
let isLoggingIn = false;

// Função auxiliar para processar login
async function handleLogin(email, password) {
    // Prevenir múltiplos cliques simultâneos
    if (isLoggingIn) {
        console.log('⚠️ Login já em andamento, ignorando clique duplicado');
        return;
    }
    
    try {
        isLoggingIn = true;
        console.log('🔐 Iniciando autenticação...');
        showLoading();
        
        // Desabilitar botão durante o login
        const loginButton = document.querySelector('#loginForm .btn-login-primary');
        if (loginButton) {
            loginButton.disabled = true;
        }
        
        // Verificar se auth está disponível
        if (!auth) {
            console.error('❌ Firebase auth não está disponível');
            hideLoading();
            showToast('Erro: Firebase não está configurado. Recarregue a página.', 'error');
            return;
        }
        
        console.log('✅ Firebase auth disponível, fazendo login...');
        await auth.signInWithEmailAndPassword(email, password);
        console.log('✅ Login bem-sucedido!');
        hideLoading();
        // Toast removido - login bem-sucedido não precisa de notificação
    } catch (error) {
        console.error('❌ Erro no login:', error);
        hideLoading();
        handleAuthError(error);
    } finally {
        isLoggingIn = false;
        // Reabilitar botão após o login
        const loginButton = document.querySelector('#loginForm .btn-login-primary');
        if (loginButton) {
            loginButton.disabled = false;
        }
    }
}

// Login with email/password - Event listener movido para DOMContentLoaded

// Função auxiliar para processar registro
async function handleRegister(name, email, password, confirmPassword) {
    if (password !== confirmPassword) {
        showToast('As senhas não coincidem!', 'error');
        return;
    }
    
    if (password.length < 6) {
        showToast('A senha deve ter pelo menos 6 caracteres!', 'error');
        return;
    }
    
    try {
        showLoading();
        
        // ===== VALIDAÇÃO DE EMAIL AUTORIZADO =====
        // Verificar se o email está na lista de emails autorizados
        const authorizedEmailDoc = await db.collection('authorized_emails')
            .doc(email.toLowerCase())
            .get();
        
        if (!authorizedEmailDoc.exists || !authorizedEmailDoc.data().isActive) {
            hideLoading();
            showToast('Email não autorizado. Entre em contato com o administrador para solicitar acesso.', 'error');
            return;
        }
        // ==========================================
        
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        
        // Update profile with name
        await userCredential.user.updateProfile({
            displayName: name
        });
        
        // Initialize user data in Firestore
        await db.collection('users').doc(userCredential.user.uid).set({
            name: name,
            email: email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            progress: {},
            totalPoints: 0
        });
        
        // Criar perfil do usuário na coleção userProfiles (para sistema de pendências)
        const createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('userProfiles').doc(userCredential.user.uid).set({
            firstName: name.split(' ')[0] || '',
            lastName: name.split(' ').slice(1).join(' ') || '',
            email: email,
            createdAt: createdAt,
            progress: {}
        });
        
        // Atualizar userProfile local
        await loadUserProfile();
        
        hideLoading();
        // Toast removido - registro bem-sucedido não precisa de notificação
    } catch (error) {
        hideLoading();
        handleAuthError(error);
    }
}

// Register new user
// Register form event listener movido para DOMContentLoaded


// Reset password
async function resetPassword() {
    const email = prompt('Digite seu email para recuperação de senha:');
    if (!email) return;
    
    try {
        await auth.sendPasswordResetEmail(email);
        showToast('Email de recuperação enviado! Verifique sua caixa de entrada.', 'success');
    } catch (error) {
        handleAuthError(error);
    }
}

// Logout
async function logout() {
    try {
        await auth.signOut();
        // Toast removido - logout não precisa de notificação
        showLoginScreen();
    } catch (error) {
        showToast('Erro ao fazer logout: ' + error.message, 'error');
    }
}

// ==================== UI MANAGEMENT ====================
function showLoading() {
    document.getElementById('loadingScreen').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingScreen').style.display = 'none';
}

function showLoginScreen() {
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');
    const loadingScreen = document.getElementById('loadingScreen');
    
    console.log('🔐 Mostrando tela de login');
    
    if (loginScreen) {
        loginScreen.style.setProperty('display', 'flex', 'important');
        loginScreen.classList.remove('hidden');
    }
    if (mainApp) {
        mainApp.style.setProperty('display', 'none', 'important');
        mainApp.classList.add('hidden');
    }
    if (loadingScreen) {
        loadingScreen.style.setProperty('display', 'none', 'important');
    }
}

let isShowingMainApp = false; // Flag para evitar múltiplas chamadas

async function showMainApp() {
    // Evitar múltiplas chamadas simultâneas
    if (isShowingMainApp) {
        console.log('⚠️ showMainApp já está em execução, ignorando chamada duplicada');
        return;
    }
    
    isShowingMainApp = true;
    
    try {
        console.log('📱 Mostrando aplicativo principal...');
        const loginScreen = document.getElementById('loginScreen');
        const mainApp = document.getElementById('mainApp');
        const loadingScreen = document.getElementById('loadingScreen');
        
        // Esconder tela de login com !important
        if (loginScreen) {
            loginScreen.style.setProperty('display', 'none', 'important');
            loginScreen.classList.add('hidden');
            console.log('✅ Tela de login escondida');
        }
        
        // Mostrar aplicativo principal
        if (mainApp) {
            mainApp.style.setProperty('display', 'flex', 'important');
            mainApp.classList.remove('hidden');
            console.log('✅ Aplicativo principal mostrado');
        }
        
        // Esconder loading screen
        if (loadingScreen) {
            loadingScreen.style.setProperty('display', 'none', 'important');
        }
        
        // loadCurrentUserData já foi chamado antes de showMainApp no onAuthStateChanged
        // Não precisa chamar novamente aqui
        
        // Filtrar cards baseado em permissões
        filterCardsByPermissions();
        
        // Mostrar/ocultar ícone de administração
        updateAdminIconVisibility();
        
        // Renderizar painel padronizado ao iniciar
        // Inicializar histórico de navegação com a página inicial
        if (navigationHistory.length === 0) {
            navigationHistory.push('painel');
        }
        
        renderPainelMenu();
        showSection('painel');
    } finally {
        // Resetar flag após um pequeno delay para permitir que a função seja chamada novamente se necessário
        setTimeout(() => {
            isShowingMainApp = false;
        }, 1000);
    }
}

function showScreen(screenName) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Show selected screen
    const screen = document.getElementById(screenName + 'Screen');
    if (screen) {
        screen.classList.add('active');
        currentScreen = screenName;
        
        // Adicionar botão de voltar (exceto apenas na home)
        if (screenName !== 'home') {
            adicionarBotaoVoltar(screen);
        }
    }
}

function goHome() {
    showScreen('home');
}

// ==================== TOAST NOTIFICATIONS ====================
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'fa-check-circle' : 
                 type === 'error' ? 'fa-exclamation-circle' : 
                 'fa-info-circle';
    
    toast.innerHTML = `
        <i class="fas ${icon}"></i>
        <span class="toast-message">${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Remove after 5 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

function handleAuthError(error) {
    let message = 'Erro ao processar solicitação.';
    
    switch (error.code) {
        case 'auth/user-not-found':
            message = 'Usuário não encontrado.';
            break;
        case 'auth/wrong-password':
            message = 'Senha incorreta.';
            break;
        case 'auth/email-already-in-use':
            message = 'Este email já está em uso.';
            break;
        case 'auth/weak-password':
            message = 'A senha é muito fraca.';
            break;
        case 'auth/invalid-email':
            message = 'Email inválido.';
            break;
        case 'auth/popup-closed-by-user':
            message = 'Login cancelado pelo usuário.';
            break;
        case 'auth/configuration-not-found':
            message = 'Firebase Authentication não está configurado. Por favor, habilite no Firebase Console.';
            console.error('❌ Firebase Authentication não está habilitado no projeto. Acesse: https://console.firebase.google.com/project/anest-ap/authentication');
            break;
        default:
            message = error.message;
    }
    
    showToast(message, 'error');
}

// ==================== USER PROFILE ====================
/**
 * Carregar perfil do usuário da coleção userProfiles (necessário para sistema de pendências)
 */
async function loadUserProfile() {
    try {
        if (!currentUser) {
            console.warn('⚠️ [USER PROFILE] Usuário não autenticado');
            userProfile = null;
            return;
        }
        
        const userProfileDoc = await db.collection('userProfiles').doc(currentUser.uid).get();
        
        if (userProfileDoc.exists) {
            const data = userProfileDoc.data();
            userProfile = {
                uid: currentUser.uid,
                createdAt: data.createdAt || firebase.firestore.FieldValue.serverTimestamp(),
                progress: data.progress || {},
                firstName: data.firstName || '',
                lastName: data.lastName || '',
                email: data.email || currentUser.email || '',
                ...data
            };
            console.log('✅ [USER PROFILE] Perfil carregado:', userProfile);
        } else {
            // Criar perfil padrão se não existir
            const createdAt = firebase.firestore.FieldValue.serverTimestamp();
            userProfile = {
                uid: currentUser.uid,
                createdAt: createdAt,
                progress: {},
                firstName: currentUser.displayName?.split(' ')[0] || '',
                lastName: currentUser.displayName?.split(' ').slice(1).join(' ') || '',
                email: currentUser.email || '',
                createdAt: createdAt
            };
            
            // Salvar no Firestore
            await db.collection('userProfiles').doc(currentUser.uid).set(userProfile);
            console.log('✅ [USER PROFILE] Perfil padrão criado:', userProfile);
        }
    } catch (error) {
        console.error('❌ [USER PROFILE] Erro ao carregar perfil:', error);
        // Criar perfil padrão em caso de erro
        userProfile = {
            uid: currentUser?.uid || '',
            createdAt: new Date(),
            progress: {},
            firstName: '',
            lastName: '',
            email: currentUser?.email || ''
        };
    }
}

// ==================== USER PERMISSIONS ====================
/**
 * Carregar dados completos do usuário do Firestore (incluindo permissões)
 */
async function loadCurrentUserData() {
    try {
        if (!currentUser) return;
        
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
            const data = userDoc.data();
            
            // Atualizar currentUser com dados do Firestore
            currentUser = {
                ...currentUser,
                ...data,
                uid: currentUser.uid
            };
            
            // Garantir que role existe (padrão: funcionaria)
            if (!currentUser.role) {
                currentUser.role = 'funcionaria';
            }
        } else {
            // Criar registro padrão se não existir
            currentUser.role = 'funcionaria';
            await db.collection('users').doc(currentUser.uid).set({
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName,
                role: 'funcionaria',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                active: true
            });
        }
    } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
    }
}

/**
 * Filtrar cards baseado em permissões do usuário
 */
function filterCardsByPermissions() {
    if (!currentUser || typeof hasCardPermission === 'undefined') {
        return; // Permissions system não carregado ainda
    }
    
    // Encontrar todos os cards com data-card-id
    const allCards = document.querySelectorAll('[data-card-id]');
    
    allCards.forEach(card => {
        const cardId = card.getAttribute('data-card-id');
        if (cardId && !hasCardPermission(currentUser, cardId)) {
            // Ocultar card se usuário não tiver permissão
            card.style.display = 'none';
        } else {
            // Mostrar card se tiver permissão
            card.style.display = '';
        }
    });
}

/**
 * Atualizar visibilidade do ícone de administração (agora dentro do dropdown de perfil)
 */
function updateAdminIconVisibility() {
    // Agora controlamos o item "Gerenciar Permissões" dentro do dropdown
    const adminDropdownItems = document.querySelectorAll('.profile-dropdown-item.admin-only');

    if (!adminDropdownItems.length) return;

    adminDropdownItems.forEach(item => {
        if (typeof isAdministrator !== 'undefined' && isAdministrator(currentUser)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// ==================== USER PROGRESS ====================
async function loadUserProgress() {
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
            const data = userDoc.data();
            userProgress = {
                scores: data.progress || {},
                completedTopics: data.completedTopics || [],
                totalPoints: data.totalPoints || 0,
                achievements: data.achievements || []
            };
        }
    } catch (error) {
        console.error('Erro ao carregar progresso:', error);
    }
}

async function saveUserProgress() {
    try {
        await db.collection('users').doc(currentUser.uid).update({
            progress: userProgress.scores,
            completedTopics: userProgress.completedTopics,
            totalPoints: userProgress.totalPoints,
            achievements: userProgress.achievements,
            lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Erro ao salvar progresso:', error);
    }
}

// ==================== ROPS SECTION ====================
function showROPs() {
    // Atualizar histórico de navegação
    atualizarHistoricoNavegacao('rops');
    
    const screen = document.getElementById('ropsScreen');
    if (!window.ropsData) {
        showToast('Erro: Dados de ROPs não carregados', 'error');
        return;
    }
    screen.innerHTML = `
        <button class="back-btn" onclick="goHome()">
            <i class="fas fa-arrow-left"></i>
        </button>
        <h2 class="screen-title">ROPs - Desafio de Conhecimento</h2>
        
        <div class="menu-grid">
            ${Object.entries(window.ropsData).map(([key, macroArea]) => `
                <div class="menu-card" onclick="showMacroArea('${key}')">
                    <div class="card-icon" style="background: ${macroArea.color}">
                        <i class="${macroArea.icon}"></i>
                    </div>
                    <h3>${macroArea.title}</h3>
                </div>
            `).join('')}
            
            <div class="menu-card" onclick="showSimulado()">
                <div class="card-icon" style="background: linear-gradient(135deg, #ff6e7f 0%, #bfe9ff 100%)">
                    <i class="fas fa-graduation-cap"></i>
                </div>
                <h3>Simulado Geral</h3>
            </div>
            
            <div class="menu-card" onclick="showRanking()">
                <div class="card-icon" style="background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%)">
                    <i class="fas fa-trophy"></i>
                </div>
                <h3>Ranking</h3>
            </div>
        </div>
    `;
    showScreen('rops');
}

function getUserMacroProgress(macroKey) {
    if (!window.ropsData || !window.ropsData[macroKey]) return null;
    const macroArea = window.ropsData[macroKey];
    const subdivisoes = Object.keys(macroArea.subdivisoes);
    const completed = subdivisoes.filter(sub => 
        userProgress.completedTopics.includes(sub)
    ).length;
    
    const percentage = Math.round((completed / subdivisoes.length) * 100);
    
    return `
        <div style="margin-top: 10px; padding: 5px 10px; background: rgba(102, 126, 234, 0.1); border-radius: 5px;">
            <small style="color: var(--primary-color); font-weight: 600;">
                ${percentage}% completo
            </small>
        </div>
    `;
}

function showMacroArea(macroKey) {
    if (!window.ropsData || !window.ropsData[macroKey]) {
        showToast('Erro: Macroárea não encontrada', 'error');
        return;
    }
    const macroArea = window.ropsData[macroKey];
    const screen = document.getElementById('ropsScreen');
    
    screen.innerHTML = `
        <button class="back-btn" onclick="showROPs()">
            <i class="fas fa-arrow-left"></i>
        </button>
        <h2 class="screen-title">${macroArea.title}</h2>
        
        <div class="menu-grid">
            ${Object.entries(macroArea.subdivisoes).map(([key, subdivisao]) => `
                <div class="menu-card" onclick="startQuiz('${macroKey}', '${key}')">
                    <div class="card-icon" style="background: ${macroArea.color}">
                        <i class="fas fa-clipboard-question"></i>
                    </div>
                    <h3>${subdivisao.title}</h3>
                    <p>${subdivisao.questions.length} questões</p>
                    ${getSubdivisaoProgress(key)}
                </div>
            `).join('')}
            
            <div class="menu-card" onclick="startQuiz('${macroKey}', 'all')">
                <div class="card-icon" style="background: ${macroArea.color}">
                    <i class="fas fa-random"></i>
                </div>
                <h3>Todas Embaralhadas</h3>
                <p>Quiz completo da macroárea</p>
            </div>
            
            ${macroArea.subdivisoes[Object.keys(macroArea.subdivisoes)[0]].audioFile ? `
                <div class="menu-card" onclick="showAudioAulas('${macroKey}')">
                    <div class="card-icon" style="background: ${macroArea.color}">
                        <i class="fas fa-headphones"></i>
                    </div>
                    <h3>Áudio Aulas</h3>
                    <p>Material em áudio</p>
                </div>
            ` : ''}
        </div>
    `;
}

function getSubdivisaoProgress(subdivKey) {
    const score = userProgress.scores[subdivKey];
    if (!score) {
        return '<small style="color: var(--text-light);">Não iniciado</small>';
    }
    
    const percentage = Math.round((score.correct / score.total) * 100);
    const color = percentage >= 70 ? 'var(--success-color)' : 
                  percentage >= 50 ? 'var(--warning-color)' : 'var(--danger-color)';
    
    return `
        <div style="margin-top: 10px; padding: 5px 10px; background: rgba(102, 126, 234, 0.1); border-radius: 5px;">
            <small style="color: ${color}; font-weight: 600;">
                Melhor: ${percentage}% (${score.correct}/${score.total})
            </small>
        </div>
    `;
}

// ==================== QUIZ SYSTEM ====================
function startQuiz(macroKey, subdivKey) {
    if (!window.ropsData || !window.ropsData[macroKey]) {
        showToast('Erro: Dados de ROPs não carregados', 'error');
        return;
    }
    const macroArea = window.ropsData[macroKey];
    let questions = [];
    
    if (subdivKey === 'all') {
        // Get all questions from all subdivisions
        Object.values(macroArea.subdivisoes).forEach(subdiv => {
            questions = questions.concat(subdiv.questions);
        });
    } else {
        questions = macroArea.subdivisoes[subdivKey].questions;
    }
    
    // Shuffle questions
    questions = shuffleArray([...questions]);
    
    currentQuiz = {
        macroKey,
        subdivKey,
        questions,
        currentIndex: 0,
        score: 0,
        answers: [],
        startTime: Date.now()
    };
    
    showQuestion();
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function showQuestion() {
    const screen = document.getElementById('quizScreen');
    const question = currentQuiz.questions[currentQuiz.currentIndex];
    
    screen.innerHTML = `
        <button class="back-btn" onclick="confirmQuitQuiz()">
            <i class="fas fa-times"></i> Sair do Quiz
        </button>
        
        <div class="quiz-container">
            <div class="quiz-header">
                <div class="quiz-progress">
                    Questão ${currentQuiz.currentIndex + 1} de ${currentQuiz.questions.length}
                </div>
                <div class="quiz-score">
                    <i class="fas fa-star"></i> ${currentQuiz.score} pontos
                </div>
            </div>
            
            <div class="question-container">
                <div class="question-text">
                    ${question.question}
                </div>
                
                <div class="options-container" id="optionsContainer">
                    ${question.options.map((option, index) => `
                        <button class="option-btn" onclick="selectAnswer(${index})">
                            <span class="option-letter">${String.fromCharCode(65 + index)}</span>
                            <span>${option}</span>
                        </button>
                    `).join('')}
                </div>
                
                <div id="explanationContainer"></div>
            </div>
            
            <div class="quiz-controls" id="quizControls">
                <button class="btn-quiz btn-show-explanation" onclick="showExplanation()" style="display: none;" id="btnExplanation">
                    <i class="fas fa-lightbulb"></i> Ver Explicação
                </button>
                <button class="btn-quiz btn-next" onclick="nextQuestion()" style="display: none;" id="btnNext">
                    Próxima <i class="fas fa-arrow-right"></i>
                </button>
            </div>
        </div>
    `;
    
    showScreen('quiz');
}

function selectAnswer(selectedIndex) {
    const question = currentQuiz.questions[currentQuiz.currentIndex];
    const options = document.querySelectorAll('.option-btn');
    const isCorrect = selectedIndex === question.correctAnswer;
    
    // Disable all options
    options.forEach((btn, index) => {
        btn.classList.add('disabled');
        btn.onclick = null;
        
        if (index === question.correctAnswer) {
            btn.classList.add('correct');
        } else if (index === selectedIndex && !isCorrect) {
            btn.classList.add('wrong');
        }
    });
    
    // Update score
    if (isCorrect) {
        currentQuiz.score += 10;
        currentQuiz.answers.push({ questionIndex: currentQuiz.currentIndex, correct: true });
        showToast('Resposta correta! +10 pontos', 'success');
    } else {
        currentQuiz.answers.push({ questionIndex: currentQuiz.currentIndex, correct: false });
        showToast('Resposta incorreta. Veja a explicação.', 'error');
    }
    
    // Show controls
    document.getElementById('btnExplanation').style.display = 'flex';
    document.getElementById('btnNext').style.display = 'flex';
    
    // Update score display
    document.querySelector('.quiz-score').innerHTML = `
        <i class="fas fa-star"></i> ${currentQuiz.score} pontos
    `;
}

function showExplanation() {
    const question = currentQuiz.questions[currentQuiz.currentIndex];
    const container = document.getElementById('explanationContainer');
    
    container.innerHTML = `
        <div class="explanation-container">
            <h4><i class="fas fa-lightbulb"></i> Explicação</h4>
            <p>${question.explanation}</p>
        </div>
    `;
    
    document.getElementById('btnExplanation').style.display = 'none';
}

function nextQuestion() {
    currentQuiz.currentIndex++;
    
    if (currentQuiz.currentIndex < currentQuiz.questions.length) {
        showQuestion();
    } else {
        finishQuiz();
    }
}

function confirmQuitQuiz() {
    if (confirm('Deseja realmente sair do quiz? Seu progresso será perdido.')) {
        showROPs();
    }
}

async function finishQuiz() {
    const totalQuestions = currentQuiz.questions.length;
    const correctAnswers = currentQuiz.answers.filter(a => a.correct).length;
    const percentage = Math.round((correctAnswers / totalQuestions) * 100);
    const timeSpent = Math.round((Date.now() - currentQuiz.startTime) / 1000);
    
    // Update user progress
    if (!userProgress.scores[currentQuiz.subdivKey] || 
        percentage > (userProgress.scores[currentQuiz.subdivKey].percentage || 0)) {
        userProgress.scores[currentQuiz.subdivKey] = {
            correct: correctAnswers,
            total: totalQuestions,
            percentage: percentage,
            date: new Date().toISOString()
        };
    }
    
    if (percentage >= 70 && !userProgress.completedTopics.includes(currentQuiz.subdivKey)) {
        userProgress.completedTopics.push(currentQuiz.subdivKey);
    }
    
    userProgress.totalPoints += currentQuiz.score;
    
    // Save to Firestore
    await saveUserProgress();
    await saveQuizResult(correctAnswers, totalQuestions, percentage, timeSpent);
    
    // Atualizar pendências após completar quiz
    setTimeout(async () => {
        if (typeof loadPendenciasCompletas === 'function') {
            await loadPendenciasCompletas();
        }
        if (typeof atualizarContadorPendencias === 'function') {
            await atualizarContadorPendencias();
        }
    }, 500);
    
    // Show results
    showResults(correctAnswers, totalQuestions, percentage, timeSpent);
}

async function saveQuizResult(correct, total, percentage, timeSpent) {
    try {
        await db.collection('quiz_results').add({
            userId: currentUser.uid,
            userName: currentUser.displayName || currentUser.email,
            macroKey: currentQuiz.macroKey,
            subdivKey: currentQuiz.subdivKey,
            correct: correct,
            total: total,
            percentage: percentage,
            score: currentQuiz.score,
            timeSpent: timeSpent,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Erro ao salvar resultado:', error);
    }
}

function showResults(correct, total, percentage, timeSpent) {
    const screen = document.getElementById('resultsScreen');
    
    const resultClass = percentage >= 80 ? 'excellent' : 
                        percentage >= 60 ? 'good' : 'needs-improvement';
    
    const resultIcon = percentage >= 80 ? 'fa-trophy' : 
                       percentage >= 60 ? 'fa-smile' : 'fa-book';
    
    const resultMessage = percentage >= 80 ? 'Excelente desempenho!' : 
                          percentage >= 60 ? 'Bom trabalho!' : 'Continue estudando!';
    
    const minutes = Math.floor(timeSpent / 60);
    const seconds = timeSpent % 60;
    
    screen.innerHTML = `
        <div class="results-container">
            <div class="results-icon ${resultClass}">
                <i class="fas ${resultIcon}"></i>
            </div>
            
            <div class="results-score">${percentage}%</div>
            <div class="results-message">${resultMessage}</div>
            
            <div class="results-stats">
                <div class="stat-item">
                    <span class="stat-value">${correct}</span>
                    <span class="stat-label">Acertos</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${total - correct}</span>
                    <span class="stat-label">Erros</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${currentQuiz.score}</span>
                    <span class="stat-label">Pontos</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${minutes}:${seconds.toString().padStart(2, '0')}</span>
                    <span class="stat-label">Tempo</span>
                </div>
            </div>
            
            <div class="quiz-controls">
                <button class="btn-quiz btn-next" onclick="showROPs()">
                    <i class="fas fa-home"></i>
            </button>
                <button class="btn-quiz btn-next" onclick="startQuiz('${currentQuiz.macroKey}', '${currentQuiz.subdivKey}')">
                    <i class="fas fa-redo"></i> Refazer
                </button>
        </div>
        
            <button class="btn-primary" onclick="showRanking()" style="margin-top: 20px;">
                <i class="fas fa-trophy"></i> Ver Ranking
            </button>
        </div>
    `;
    
    showScreen('results');
}

// ==================== RANKING ====================
async function showRanking() {
    const screen = document.getElementById('rankingScreen');
    
    screen.innerHTML = `
        <button class="back-btn" onclick="showROPs()">
            <i class="fas fa-arrow-left"></i>
        </button>
        
        <div class="ranking-container">
            <h2 style="text-align: center; color: var(--text-dark); margin-bottom: 30px;">
                <i class="fas fa-trophy" style="color: #FFD700;"></i> Ranking Geral
            </h2>
            
            <div class="ranking-tabs">
                <button class="tab-btn active" onclick="loadRanking('geral')">
                    Geral
                </button>
                <button class="tab-btn" onclick="loadRanking('mensal')">
                    Mensal
                </button>
                <button class="tab-btn" onclick="loadRanking('semanal')">
                    Semanal
                </button>
            </div>
            
            <div id="rankingContent">
                <div style="text-align: center; padding: 40px;">
                    <div class="loader" style="margin: 0 auto;"></div>
                </div>
            </div>
        </div>
    `;
    
    showScreen('ranking');
    loadRanking('geral');
}

async function loadRanking(period) {
    const content = document.getElementById('rankingContent');
    content.innerHTML = '<div style="text-align: center; padding: 40px;"><div class="loader" style="margin: 0 auto;"></div></div>';
    
    try {
        // Get top users
        let query = db.collection('users')
            .orderBy('totalPoints', 'desc')
            .limit(50);
        
        if (period !== 'geral') {
            const date = new Date();
            if (period === 'mensal') {
                date.setMonth(date.getMonth() - 1);
            } else {
                date.setDate(date.getDate() - 7);
            }
            query = query.where('lastUpdate', '>=', date);
        }
        
        const snapshot = await query.get();
        const users = [];
        snapshot.forEach(doc => {
            users.push({ id: doc.id, ...doc.data() });
        });
        
        if (users.length === 0) {
            content.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 40px;">Nenhum usuário encontrado.</p>';
            return;
        }
        
        content.innerHTML = `
            <table class="ranking-table">
                <thead>
                    <tr>
                        <th>Posição</th>
                        <th>Nome</th>
                        <th>Pontos</th>
                        <th>Tópicos Completos</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map((user, index) => {
                        const isCurrentUser = user.id === currentUser.uid;
                        const positionClass = index === 0 ? 'gold' : 
                                             index === 1 ? 'silver' : 
                                             index === 2 ? 'bronze' : 'regular';
                        
                        return `
                            <tr style="${isCurrentUser ? 'background: rgba(102, 126, 234, 0.1); font-weight: 600;' : ''}">
                                <td>
                                    <div class="ranking-position ${positionClass}">
                                        ${index < 3 ? '<i class="fas fa-trophy"></i>' : (index + 1)}
                                    </div>
                                </td>
                                <td>
                                    ${user.name || user.email}
                                    ${isCurrentUser ? '<i class="fas fa-user" style="color: var(--primary-color); margin-left: 10px;"></i>' : ''}
                                </td>
                                <td>
                                    <strong style="color: var(--primary-color);">${user.totalPoints || 0}</strong>
                                </td>
                                <td>${(user.completedTopics || []).length}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Erro ao carregar ranking:', error);
        content.innerHTML = '<p style="text-align: center; color: var(--danger-color); padding: 40px;">Erro ao carregar ranking.</p>';
    }
}

// ==================== SIMULADO ====================
function showSimulado() {
    if (!window.ropsData) {
        showToast('Erro: Dados de ROPs não carregados', 'error');
        return;
    }
    const allQuestions = [];
    
    // Collect 50 random questions from all ROPs
    Object.values(window.ropsData).forEach(macroArea => {
        Object.values(macroArea.subdivisoes).forEach(subdiv => {
            allQuestions.push(...subdiv.questions);
        });
    });
    
    // Shuffle and take 50
    const selectedQuestions = shuffleArray(allQuestions).slice(0, Math.min(50, allQuestions.length));
    
    currentQuiz = {
        macroKey: 'simulado',
        subdivKey: 'simulado',
        questions: selectedQuestions,
        currentIndex: 0,
        score: 0,
        answers: [],
        startTime: Date.now()
    };
    
    showQuestion();
}

// ==================== OTHER SECTIONS ====================
function showResidencia() {
    // Atualizar histórico de navegação
    atualizarHistoricoNavegacao('residencia');
    
    const screen = document.getElementById('residenciaScreen');
    screen.innerHTML = `
        <button class="back-btn" onclick="goHome()">
            <i class="fas fa-arrow-left"></i>
                    </button>
        <h2 class="screen-title">Residência Médica</h2>
        
        <div class="menu-grid">
            <div class="menu-card">
                <div class="card-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)">
                    <i class="fas fa-chalkboard-teacher"></i>
                </div>
                <h3>Aulas</h3>
                <p>Material didático e apresentações</p>
            </div>
            
            <div class="menu-card">
                <div class="card-icon" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%)">
                    <i class="fas fa-newspaper"></i>
                </div>
                <h3>Artigos</h3>
                <p>Artigos científicos relevantes</p>
            </div>
            
            <div class="menu-card">
                <div class="card-icon" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)">
                    <i class="fas fa-calendar-alt"></i>
                </div>
                <h3>Escalas</h3>
                <p>Escalas de plantão e atividades</p>
            </div>
            
            <div class="menu-card">
                <div class="card-icon" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)">
                    <i class="fas fa-hospital"></i>
                </div>
                <h3>Estágios</h3>
                <p>Informações sobre estágios</p>
            </div>
            
            <div class="menu-card">
                <div class="card-icon" style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%)">
                    <i class="fas fa-umbrella-beach"></i>
                </div>
                <h3>Férias</h3>
                <p>Programação de férias</p>
            </div>
        </div>
        
        <div style="background: white; border-radius: 20px; padding: 40px; margin-top: 30px; text-align: center;">
            <i class="fas fa-info-circle" style="font-size: 48px; color: var(--primary-color); margin-bottom: 20px;"></i>
            <h3 style="color: var(--text-dark); margin-bottom: 10px;">Seção em Desenvolvimento</h3>
            <p style="color: var(--text-light);">
                O conteúdo desta seção será adicionado em breve. Entre em contato com a administração para mais informações.
            </p>
        </div>
    `;
    showScreen('residencia');
}

function showProtocolos() {
    // Atualizar histórico de navegação
    atualizarHistoricoNavegacao('protocolos');
    
    showDocumentsSection('protocolos', 'Protocolos', 'file-medical', documentsData.protocolos);
}

function showPoliticas() {
    showDocumentsSection('politicas', 'Políticas', 'shield-alt', documentsData.politicas);
}

function showFormularios() {
    showDocumentsSection('formularios', 'Formulários', 'clipboard-list', documentsData.formularios);
}

function showManuais() {
    showDocumentsSection('manuais', 'Manuais', 'book', documentsData.manuais);
}

// Função movida para painel-qualidade.js

function showProcessos() {
    showDocumentsSection('processos', 'Mapeamento de Processos', 'project-diagram', documentsData.processos);
}

function showRiscos() {
    showDocumentsSection('riscos', 'Mapeamento de Riscos', 'exclamation-triangle', documentsData.riscos);
}

function showTermos() {
    showGenericSection('termos', 'Termos', 'file-contract', 'Termos de consentimento e documentos legais.');
}

function showClima() {
    showGenericSection('clima', 'Clima de Segurança', 'temperature-high', 'Relatórios de clima organizacional de segurança.');
}

function showPlanoSeguranca() {
    showDocumentsSection('planoSeguranca', 'Plano de Segurança do Paciente', 'clipboard-check', documentsData.planoSeguranca);
}

function showGenericSection(sectionKey, title, icon, description) {
    const screen = document.getElementById(sectionKey + 'Screen');
    screen.innerHTML = `
        <button class="back-btn" onclick="goHome()">
            <i class="fas fa-arrow-left"></i>
        </button>
        <h2 class="screen-title">${title}</h2>
        
        <div style="background: white; border-radius: 20px; padding: 40px; text-align: center; max-width: 600px; margin: 0 auto;">
            <i class="fas fa-${icon}" style="font-size: 64px; color: var(--primary-color); margin-bottom: 20px;"></i>
            <h3 style="color: var(--text-dark); margin-bottom: 15px;">${title}</h3>
            <p style="color: var(--text-light); margin-bottom: 30px;">
                ${description}
            </p>
            <div style="background: var(--bg-light); border-radius: 10px; padding: 20px;">
                <i class="fas fa-folder-open" style="font-size: 48px; color: var(--text-light); margin-bottom: 10px;"></i>
                <p style="color: var(--text-light);">
                    Nenhum documento disponível no momento.<br>
                    Os arquivos serão carregados em breve.
                </p>
            </div>
        </div>
    `;
    showScreen(sectionKey);
}

async function showProfile() {
    console.log('👤 Mostrando perfil do usuário');
    
    if (!currentUser) {
        showToast('Erro: Usuário não autenticado', 'error');
        return;
    }
    
    // Buscar dados adicionais do Firestore
    let userData = {
        email: currentUser.email,
        displayName: currentUser.displayName || '',
        photoURL: currentUser.photoURL || '',
        role: 'Usuário'
    };
    
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
            const firestoreData = userDoc.data();
            userData = { ...userData, ...firestoreData };
        }
    } catch (error) {
        console.error('Erro ao buscar dados do usuário:', error);
    }
    
    const section = document.getElementById('painelSection');
    if (!section) return;
    
    const html = `
        ${renderSectionHeader('👤', 'Meu Perfil', '')}
        
        ${renderInfoBanner('fas fa-user-circle', 'Informações da Conta', 'Gerencie suas informações pessoais e configurações de segurança', '#006837 0%, #9BC53D 100%')}
        
        <button class="btn-secondary" onclick="showSection('painel')" style="margin-bottom: 24px;">
            <i class="fas fa-arrow-left"></i> Voltar ao Painel
        </button>
        
        <div class="protocols-grid">
            <!-- Card: Informações Pessoais -->
            <div class="protocol-card" style="cursor: default; flex-direction: column; align-items: stretch;">
                <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 20px;">
                    <div class="protocol-icon" style="background: #006837;">
                        <i class="fas fa-clipboard-list"></i>
                    </div>
                    <div class="protocol-content" style="flex: 1; margin: 0;">
                        <h3 class="protocol-title" style="margin: 0;">Informações Pessoais</h3>
                    </div>
                </div>
                
                <form id="profileForm" style="display: flex; flex-direction: column; gap: 16px;">
                    <div class="form-group">
                        <label for="userName" style="display: block; margin-bottom: 8px; font-weight: 500; color: var(--text-dark);">
                            Nome Completo
                        </label>
                        <input 
                            type="text" 
                            id="userNameInput" 
                            class="form-input" 
                            value="${userData.displayName || ''}"
                            placeholder="Digite seu nome completo"
                            style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px;"
                        >
                    </div>
                    
                    <div class="form-group">
                        <label for="userEmail" style="display: block; margin-bottom: 8px; font-weight: 500; color: var(--text-dark);">
                            Email
                        </label>
                        <input 
                            type="email" 
                            id="userEmailInput" 
                            class="form-input" 
                            value="${userData.email}"
                            readonly
                            disabled
                            style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; background: #f5f5f5; cursor: not-allowed;"
                        >
                        <small style="display: block; margin-top: 4px; color: #666; font-size: 12px;">
                            O email não pode ser alterado
                        </small>
                    </div>
                    
                    <div class="form-group">
                        <label for="userRole" style="display: block; margin-bottom: 8px; font-weight: 500; color: var(--text-dark);">
                            Perfil
                        </label>
                        <input 
                            type="text" 
                            id="userRoleInput" 
                            class="form-input" 
                            value="${userData.role || 'Usuário'}"
                            readonly
                            disabled
                            style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; background: #f5f5f5; cursor: not-allowed;"
                        >
                        <small style="display: block; margin-top: 4px; color: #666; font-size: 12px;">
                            O perfil é definido pelo administrador
                        </small>
                    </div>
                    
                    <button type="button" onclick="updateProfile()" class="btn-primary" style="padding: 12px; background: #006837; color: white; border: none; border-radius: 8px; font-weight: 500; cursor: pointer; transition: all 0.3s;">
                        <i class="fas fa-save"></i> Salvar Alterações
                    </button>
                </form>
            </div>
            
            <!-- Card: Segurança -->
            <div class="protocol-card" style="cursor: default; flex-direction: column; align-items: stretch;">
                <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 20px;">
                    <div class="protocol-icon" style="background: #dc2626;">
                        <span style="font-size: 32px;">🔒</span>
                    </div>
                    <div class="protocol-content" style="flex: 1; margin: 0;">
                        <h3 class="protocol-title" style="margin: 0;">Segurança</h3>
                    </div>
                </div>
                
                <form id="passwordForm" style="display: flex; flex-direction: column; gap: 16px;">
                    <div class="form-group">
                        <label for="currentPassword" style="display: block; margin-bottom: 8px; font-weight: 500; color: var(--text-dark);">
                            Senha Atual
                        </label>
                        <input 
                            type="password" 
                            id="currentPassword" 
                            class="form-input" 
                            placeholder="Digite sua senha atual"
                            style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px;"
                        >
                    </div>
                    
                    <div class="form-group">
                        <label for="newPassword" style="display: block; margin-bottom: 8px; font-weight: 500; color: var(--text-dark);">
                            Nova Senha
                        </label>
                        <input 
                            type="password" 
                            id="newPassword" 
                            class="form-input" 
                            placeholder="Digite a nova senha (mín. 6 caracteres)"
                            style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px;"
                        >
                    </div>
                    
                    <div class="form-group">
                        <label for="confirmPassword" style="display: block; margin-bottom: 8px; font-weight: 500; color: var(--text-dark);">
                            Confirmar Nova Senha
                        </label>
                        <input 
                            type="password" 
                            id="confirmPassword" 
                            class="form-input" 
                            placeholder="Digite a nova senha novamente"
                            style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px;"
                        >
                    </div>
                    
                    <button type="button" onclick="changePassword()" class="btn-primary" style="padding: 12px; background: #dc2626; color: white; border: none; border-radius: 8px; font-weight: 500; cursor: pointer; transition: all 0.3s;">
                        <i class="fas fa-key"></i> Alterar Senha
                    </button>
                </form>
            </div>
        </div>
        
        ${renderInfoBox('fas fa-info-circle', 'Informações sobre Segurança', '<p style="margin: 0; font-size: 14px; line-height: 1.6;">Mantenha sua senha segura e nunca a compartilhe com terceiros. Recomendamos usar senhas com no mínimo 8 caracteres, incluindo letras, números e símbolos.</p>')}
    `;
    
    section.innerHTML = html;
    
    // Remove active de todas as seções
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    
    // Ativa a seção painel
    section.classList.add('active');
    
    console.log('✅ Perfil exibido com sucesso');
}

async function updateProfile() {
    const newName = document.getElementById('userNameInput').value.trim();
    
    if (!newName) {
        showToast('Por favor, preencha seu nome', 'error');
        return;
    }
    
    try {
        // Atualizar Firebase Auth
        await firebase.auth().currentUser.updateProfile({
            displayName: newName
        });
        
        // Atualizar Firestore
        await db.collection('users').doc(currentUser.uid).update({
            displayName: newName,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Atualizar variável global
        currentUser.displayName = newName;
        
        showToast('Perfil atualizado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao atualizar perfil:', error);
        showToast('Erro ao atualizar perfil: ' + error.message, 'error');
    }
}

async function changePassword() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    // Validações
    if (!currentPassword || !newPassword || !confirmPassword) {
        showToast('Por favor, preencha todos os campos', 'error');
        return;
    }
    
    if (newPassword.length < 6) {
        showToast('A nova senha deve ter no mínimo 6 caracteres', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showToast('As senhas não coincidem', 'error');
        return;
    }
    
    try {
        // Reautenticar usuário
        const user = firebase.auth().currentUser;
        const credential = firebase.auth.EmailAuthProvider.credential(
            user.email,
            currentPassword
        );
        
        await user.reauthenticateWithCredential(credential);
        
        // Atualizar senha
        await user.updatePassword(newPassword);
        
        // Limpar formulário
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
        
        showToast('Senha alterada com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao alterar senha:', error);
        
        let errorMessage = 'Erro ao alterar senha';
        if (error.code === 'auth/wrong-password') {
            errorMessage = 'Senha atual incorreta';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'A senha é muito fraca';
        } else if (error.code === 'auth/requires-recent-login') {
            errorMessage = 'Por favor, faça login novamente e tente alterar a senha';
        } else {
            errorMessage = error.message;
        }
        
        showToast(errorMessage, 'error');
    }
}

// ==================== DOCUMENTS SECTION ====================
function showDocumentsSection(sectionKey, title, icon, documents) {
    const screen = document.getElementById(sectionKey + 'Screen');
    
    if (!documents || documents.length === 0) {
        screen.innerHTML = `
            <button class="back-btn" onclick="goHome()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h2 class="screen-title">${title}</h2>
            
            <div class="documents-container">
                <div class="empty-state">
                    <i class="fas fa-${icon}"></i>
                    <h3>Nenhum documento disponível</h3>
                    <p>Os arquivos serão adicionados em breve.</p>
                </div>
            </div>
        `;
    } else {
        // Get unique categories
        const categories = [...new Set(documents.map(d => d.categoria || d.tipo).filter(Boolean))];
        
        screen.innerHTML = `
            <button class="back-btn" onclick="goHome()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h2 class="screen-title">${title}</h2>
            
            <div class="documents-container">
                <div style="margin-bottom: 20px;">
                    <p style="color: var(--text-light); margin-bottom: 10px;">
                        <i class="fas fa-info-circle"></i> Total: ${documents.length} documento${documents.length > 1 ? 's' : ''}
                </p>
            </div>
                
                ${categories.length > 1 ? `
                    <div class="category-filter">
                        <button class="filter-btn active" onclick="filterDocuments('${sectionKey}', 'all')">
                            Todos (${documents.length})
                        </button>
                        ${categories.map(cat => `
                            <button class="filter-btn" onclick="filterDocuments('${sectionKey}', '${cat}')">
                                ${cat} (${documents.filter(d => (d.categoria || d.tipo) === cat).length})
                            </button>
                        `).join('')}
                    </div>
                ` : ''}
                
                <div class="documents-grid" id="${sectionKey}DocumentsGrid">
                    ${documents.map(doc => {
                        const fileExtension = doc.file.split('.').pop().toUpperCase();
                        const iconClass = fileExtension === 'PDF' ? 'fa-file-pdf' : 
                                        fileExtension === 'DOCX' ? 'fa-file-word' : 
                                        fileExtension === 'ODT' ? 'fa-file-alt' : 'fa-file';
                        
                        return `
                            <div class="document-item" onclick="openDocument('${doc.file.replace(/'/g, "\\'")}', '${doc.title.replace(/'/g, "\\'")}')">
                                <div class="document-icon">
                                    <i class="fas ${iconClass}"></i>
                                </div>
                                <div class="document-info">
                                    <div class="document-title">${doc.title}</div>
                                    <div class="document-meta">
                                        ${doc.codigo ? `<span class="document-badge">${doc.codigo}</span>` : ''}
                                        ${doc.categoria ? `<span class="document-badge">${doc.categoria}</span>` : ''}
                                        ${doc.tipo ? `<span class="document-badge">${doc.tipo}</span>` : ''}
                                        ${doc.periodo ? `<span class="document-badge">${doc.periodo}</span>` : ''}
                                        ${doc.ano ? `<span class="document-badge">${doc.ano}</span>` : ''}
                                    </div>
                                </div>
                                <i class="fas fa-external-link-alt" style="color: var(--primary-color);"></i>
                            </div>
                        `;
                    }).join('')}
                </div>
        </div>
    `;
}

    showScreen(sectionKey);
}

function filterDocuments(sectionKey, category) {
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    const documents = documentsData[sectionKey];
    const grid = document.getElementById(sectionKey + 'DocumentsGrid');
    
    const filtered = category === 'all' ? documents : 
                     documents.filter(d => (d.categoria || d.tipo) === category);
    
    grid.innerHTML = filtered.map(doc => {
        const fileExtension = doc.file.split('.').pop().toUpperCase();
        const iconClass = fileExtension === 'PDF' ? 'fa-file-pdf' : 
                        fileExtension === 'DOCX' ? 'fa-file-word' : 
                        fileExtension === 'ODT' ? 'fa-file-alt' : 'fa-file';
        
    return `
            <div class="document-item" onclick="openDocument('${doc.file.replace(/'/g, "\\'")}', '${doc.title.replace(/'/g, "\\'")}')">
                <div class="document-icon">
                    <i class="fas ${iconClass}"></i>
            </div>
                <div class="document-info">
                    <div class="document-title">${doc.title}</div>
                    <div class="document-meta">
                        ${doc.codigo ? `<span class="document-badge">${doc.codigo}</span>` : ''}
                        ${doc.categoria ? `<span class="document-badge">${doc.categoria}</span>` : ''}
                        ${doc.tipo ? `<span class="document-badge">${doc.tipo}</span>` : ''}
                        ${doc.periodo ? `<span class="document-badge">${doc.periodo}</span>` : ''}
                        ${doc.ano ? `<span class="document-badge">${doc.ano}</span>` : ''}
                    </div>
                </div>
                <i class="fas fa-external-link-alt" style="color: var(--primary-color);"></i>
        </div>
    `;
    }).join('');
}

// ==================== PODCASTS ROPS ====================
function showPodcastsROPs() {
    const screen = document.getElementById('podcastsScreen');
    
    screen.innerHTML = `
        <button class="back-btn" onclick="goHome()">
            <i class="fas fa-arrow-left"></i>
        </button>
        <h2 class="screen-title">Podcasts ROPs - Áudio Aulas</h2>
        
        <div class="menu-grid">
            ${Object.entries(podcastsData).map(([key, macroArea]) => {
                const audioCount = macroArea.audios.length;
                return `
                    <div class="menu-card" onclick="showPodcastMacroArea('${key}')">
                        <div class="card-icon" style="background: ${macroArea.color}">
                            <i class="${macroArea.icon}"></i>
                        </div>
                        <h3>${macroArea.title}</h3>
                        <p>${audioCount} áudio${audioCount !== 1 ? 's' : ''} disponível${audioCount !== 1 ? 'is' : ''}</p>
                    </div>
                `;
            }).join('')}
        </div>
    `;

    showScreen('podcasts');

    return true; // Explicit success return
}

function showPodcastMacroArea(macroKey) {
    const macroArea = podcastsData[macroKey];
    const screen = document.getElementById('podcastsScreen');
    
    if (!macroArea.audios || macroArea.audios.length === 0) {
        screen.innerHTML = `
            <button class="back-btn" onclick="showPodcastsROPs()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h2 class="screen-title">${macroArea.title}</h2>
            
            <div class="documents-container">
                <div class="no-audios-message">
                    <i class="fas fa-microphone-slash"></i>
                    <h3>Nenhuma áudio aula disponível ainda</h3>
                    <p style="margin-top: 10px;">As áudio aulas desta macroárea serão adicionadas em breve.</p>
                </div>
            </div>
        `;
    } else {
        screen.innerHTML = `
            <button class="back-btn" onclick="showPodcastsROPs()">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h2 class="screen-title">${macroArea.title}</h2>
            
            <div class="documents-container">
                <div style="margin-bottom: 30px; text-align: center;">
                    <p style="color: var(--text-light);">
                        <i class="fas fa-headphones"></i> ${macroArea.audios.length} áudio${macroArea.audios.length > 1 ? 's' : ''} disponível${macroArea.audios.length > 1 ? 'is' : ''}
                    </p>
                </div>
                
                ${macroArea.audios.map((audio, index) => `
                    <div class="audio-player-container">
                        <div class="audio-player-header">
                            <div class="audio-player-icon" style="background: ${macroArea.color}">
                                <i class="fas fa-play"></i>
                            </div>
                            <div class="audio-player-info">
                                <div class="audio-player-title">${audio.title}</div>
                                <div class="audio-player-description">${audio.descricao}</div>
                            </div>
                        </div>
                        <div class="audio-player-controls">
                            <audio controls preload="metadata">
                                <source src="${audio.file}" type="audio/mp4">
                                <source src="${audio.file}" type="audio/m4a">
                                Seu navegador não suporta o elemento de áudio.
                            </audio>
                        </div>
                    </div>
                `).join('')}
                
                <div style="margin-top: 30px; padding: 20px; background: var(--bg-light); border-radius: 15px;">
                    <h4 style="color: var(--text-dark); margin-bottom: 10px;">
                        <i class="fas fa-info-circle"></i> Dicas de Uso
                    </h4>
                    <ul style="color: var(--text-light); padding-left: 20px;">
                        <li>Use fones de ouvido para melhor experiência</li>
                        <li>Você pode ajustar a velocidade de reprodução no player</li>
                        <li>Os áudios ficam salvos para ouvir offline no navegador</li>
                        <li>Recomendamos ouvir em um ambiente tranquilo</li>
                    </ul>
                </div>
            </div>
        `;
    }
    
    showScreen('podcasts');
}

console.log('App initialized successfully!');

// ==================== FASE 2: NAVEGAÇÃO ENTRE SEÇÕES ====================

// Salvar HTML original das seções
let protocolosOriginalHTML = '';
let painelOriginalHTML = '';
let ferramentasOriginalHTML = '';
let qualidadeOriginalHTML = '';

// Função auxiliar para atualizar histórico de navegação
function atualizarHistoricoNavegacao(pageName, skipIfSame = true) {
    // Não atualizar histórico se estivermos voltando
    if (isNavigatingBack) {
        isNavigatingBack = false; // Resetar flag
        return;
    }
    
    const currentPage = navigationHistory[navigationHistory.length - 1];
    if (!skipIfSame || currentPage !== pageName) {
        navigationHistory.push(pageName);
        // Limitar histórico a 50 páginas para evitar uso excessivo de memória
        if (navigationHistory.length > 50) {
            navigationHistory.shift();
        }
        console.log('📚 Histórico atualizado:', navigationHistory);
    }
}

// Função auxiliar para adicionar botão de voltar em qualquer seção
function adicionarBotaoVoltar(containerElement, excludePages = ['home']) {
    if (!containerElement) return;
    
    // Verificar se já existe um botão de voltar
    if (containerElement.querySelector('.btn-voltar-header')) {
        return;
    }
    
    // Criar botão de voltar
    const backButton = document.createElement('button');
    backButton.className = 'btn-voltar-header';
    backButton.innerHTML = '<i class="fas fa-arrow-left"></i>';
    backButton.onclick = voltarPagina;
    
    // Adicionar ao início do container
    containerElement.insertBefore(backButton, containerElement.firstChild);
    
    console.log('✅ Botão de voltar adicionado');
}

// Função para obter a página pai na hierarquia
function getParentPage(currentPage) {
    // Se a página atual tem um pai definido na hierarquia, retornar o pai
    if (pageHierarchy[currentPage]) {
        return pageHierarchy[currentPage];
    }
    
    // Se a página atual já é uma página principal, retornar null (não tem pai)
    if (currentPage === 'painel' || currentPage === 'qualidade' || 
        currentPage === 'protocolos' || currentPage === 'ferramentas') {
        return null;
    }
    
    // Fallback: tentar encontrar no histórico
    if (navigationHistory && navigationHistory.length > 1) {
        // Procurar a última página principal no histórico
        for (let i = navigationHistory.length - 2; i >= 0; i--) {
            const page = navigationHistory[i];
            if (page === 'painel' || page === 'qualidade' || 
                page === 'protocolos' || page === 'ferramentas') {
                return page;
            }
        }
    }
    
    // Se não encontrar, retornar painel como padrão
    return 'painel';
}

// Função para voltar página (baseada na hierarquia)
function voltarPagina() {
    console.log('🔙 Voltando página...');
    console.log('📚 Histórico atual:', navigationHistory);
    
    // Obter a página atual
    const currentPage = navigationHistory[navigationHistory.length - 1];
    
    if (!currentPage) {
        // Se não houver página atual, voltar para o painel
        showSection('painel');
        return;
    }
    
    // Obter a página pai na hierarquia
    const parentPage = getParentPage(currentPage);
    
    console.log('📍 Página atual:', currentPage);
    console.log('📍 Página pai (hierarquia):', parentPage);
    
    // Marcar que estamos voltando para evitar atualizar histórico
    isNavigatingBack = true;
    
    // Remove a página atual do histórico
    navigationHistory.pop();
    
    if (parentPage) {
        // Navegar para a página pai na hierarquia
        if (parentPage === 'painel' || parentPage === 'qualidade' || 
            parentPage === 'protocolos' || parentPage === 'ferramentas') {
            showSection(parentPage);
        } else if (parentPage === 'auditorias') {
            showAuditorias();
        } else if (parentPage === 'relatorios') {
            showRelatorios();
        } else if (parentPage === 'grupo-auditorias-operacionais') {
            showGrupoAuditoriasOperacionais();
        } else if (parentPage === 'conformidade-politicas') {
            showGrupoConformidadePoliticas();
        } else if (parentPage === 'biblioteca-documentos') {
            if (typeof showBibliotecaDocumentos === 'function') {
                showBibliotecaDocumentos();
            } else {
                showSection('protocolos');
            }
        } else if (parentPage === 'grupo-medicamentos-alta-vigilancia') {
            if (typeof showGrupoMedicamentosAltaVigilancia === 'function') {
                showGrupoMedicamentosAltaVigilancia();
            } else {
                showSection('protocolos');
            }
        } else if (parentPage === 'grupo-medicamentos-especificos') {
            if (typeof showGrupoMedicamentosEspecificos === 'function') {
                showGrupoMedicamentosEspecificos();
            } else {
                showSection('protocolos');
            }
        } else if (parentPage === 'grupo-listas-diretrizes') {
            if (typeof showGrupoListasDiretrizes === 'function') {
                showGrupoListasDiretrizes();
            } else {
                showSection('protocolos');
            }
        } else if (parentPage === 'protocolos-prevencao') {
            if (typeof showProtocolosPrevencao === 'function') {
                showProtocolosPrevencao();
            } else {
                showSection('protocolos');
            }
        } else if (parentPage === 'grupo-protocolos-basicos-prevencao') {
            if (typeof showGrupoProtocolosBasicosPrevencao === 'function') {
                showGrupoProtocolosBasicosPrevencao();
            } else {
                showSection('protocolos');
            }
        } else if (parentPage === 'grupo-bundles-iras') {
            if (typeof showGrupoBundlesIRAS === 'function') {
                showGrupoBundlesIRAS();
            } else {
                showSection('protocolos');
            }
        } else if (parentPage === 'conciliacao-medicamentosa') {
            if (typeof showConciliacaoMedicamentosa === 'function') {
                showConciliacaoMedicamentosa();
            } else {
                showSection('ferramentas');
            }
        } else {
            // Fallback: usar showSection se for página principal
            showSection(parentPage);
        }
    } else {
        // Se não houver pai (já está na página principal), usar histórico
        if (navigationHistory && navigationHistory.length > 0) {
            const previousPage = navigationHistory[navigationHistory.length - 1];
            // Navegar para a página anterior
            if (previousPage === 'painel' || previousPage === 'qualidade' || 
                previousPage === 'protocolos' || previousPage === 'ferramentas') {
                showSection(previousPage);
            } else {
                // Se a página anterior também não for principal, voltar para o pai dela
                const previousParent = getParentPage(previousPage);
                if (previousParent) {
                    showSection(previousParent);
                } else {
                    showSection('painel');
                }
            }
        } else {
            // Se não houver histórico, voltar para o painel
            showSection('painel');
        }
    }
}

// Função goBack() para compatibilidade com botões HTML
function goBack() {
    voltarPagina();
}

document.addEventListener('DOMContentLoaded', () => {
    // Salvar HTML original da seção de protocolos
    const protocolosSection = document.getElementById('protocolosSection');
    if (protocolosSection) {
        protocolosOriginalHTML = protocolosSection.innerHTML;
    }
    
    // Salvar HTML original da seção do painel
    const painelSection = document.getElementById('painelSection');
    if (painelSection) {
        painelOriginalHTML = painelSection.innerHTML;
    }
    
    // Salvar HTML original da seção de ferramentas
    const ferramentasSection = document.getElementById('ferramentasSection');
    if (ferramentasSection) {
        ferramentasOriginalHTML = ferramentasSection.innerHTML;
    }
    
    // Salvar HTML original da seção de qualidade
    const qualidadeSection = document.getElementById('qualidadeSection');
    if (qualidadeSection) {
        qualidadeOriginalHTML = qualidadeSection.innerHTML;
    }
});

function showSection(sectionName) {
    console.log('📍 Navegando para seção principal:', sectionName);
    
    // CRÍTICO: Limpar recursos PDF ao navegar para outra seção (exceto se estiver indo para protocolos)
    // Isso previne lentidão e problemas de memória
    const protocolosSection = document.getElementById('protocolosSection');
    const qualidadeSection = document.getElementById('qualidadeSection');
    
    // Verificar se há PDF sendo visualizado em qualquer seção
    const isViewingPDF = (protocolosSection && protocolosSection.classList.contains('active') && 
                          (document.getElementById('pdfCanvas') || document.getElementById('pdfPagesContainer') || 
                           document.getElementById('pdfIframe') || document.querySelector('object[type="application/pdf"]'))) ||
                         (qualidadeSection && qualidadeSection.classList.contains('active') && 
                          (qualidadeSection.querySelector('.pdf-viewer-container') || qualidadeSection.querySelector('.info-banner')));
    
    if (isViewingPDF) {
        console.log('🧹 Limpando recursos PDF antes de navegar para outra seção...');
        limparRecursosPDF();
        
        // Limpar HTML da seção de protocolos se não estiver voltando para ela
        if (protocolosSection && sectionName !== 'protocolos') {
            // Remover elementos PDF específicos incluindo o banner
            const pdfViewer = protocolosSection.querySelector('.pdf-viewer-container');
            if (pdfViewer) {
                pdfViewer.remove();
            }
            // Remover banner de PDF se existir
            const pdfBanner = protocolosSection.querySelector('.info-banner');
            if (pdfBanner && pdfBanner.querySelector('i.fa-file-pdf')) {
                pdfBanner.remove();
            }
        }
        
        // Limpar HTML da seção de qualidade se não estiver voltando para ela
        if (qualidadeSection && sectionName !== 'qualidade') {
            // Remover elementos PDF específicos incluindo o banner
            const pdfViewer = qualidadeSection.querySelector('.pdf-viewer-container');
            if (pdfViewer) {
                pdfViewer.remove();
            }
            // Remover banner de PDF se existir
            const pdfBanner = qualidadeSection.querySelector('.info-banner');
            if (pdfBanner && pdfBanner.querySelector('i.fa-file-pdf')) {
                pdfBanner.remove();
            }
        }
    }
    
    // Garantir que sempre mostra a página principal da seção
    // Se não estivermos voltando, limpar histórico de subpáginas quando clicar nos ícones da barra inferior
    if (!isNavigatingBack && 
        (sectionName === 'painel' || sectionName === 'qualidade' || 
         sectionName === 'protocolos' || sectionName === 'ferramentas')) {
        // Limpar histórico de subpáginas desta seção, mantendo apenas a última ocorrência da seção principal
        const filteredHistory = [];
        let foundSection = false;
        for (let i = navigationHistory.length - 1; i >= 0; i--) {
            const page = navigationHistory[i];
            if (page === sectionName) {
                if (!foundSection) {
                    filteredHistory.unshift(page);
                    foundSection = true;
                }
            } else if (!pageHierarchy[page] || pageHierarchy[page] !== sectionName) {
                // Manter páginas de outras seções
                filteredHistory.unshift(page);
            }
        }
        if (!foundSection) {
            filteredHistory.push(sectionName);
        }
        navigationHistory = filteredHistory;
    }
    
    // Atualizar histórico de navegação
    atualizarHistoricoNavegacao(sectionName);
    
    // Filtrar cards baseado em permissões após mudar de seção
    setTimeout(() => {
        filterCardsByPermissions();
    }, 100);
    
    // Remove active de todas as seções
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
        
        // Remover banners de PDF órfãos de todas as seções ao navegar
        const pdfBanner = section.querySelector('.info-banner');
        if (pdfBanner) {
            // Verificar se é um banner de PDF (contém ícone fa-file-pdf)
            const pdfIcon = pdfBanner.querySelector('i.fa-file-pdf');
            if (pdfIcon) {
                pdfBanner.remove();
                console.log('🧹 Banner de PDF removido da seção:', section.id);
            }
        }
        // Remover também containers de PDF órfãos
        const pdfViewer = section.querySelector('.pdf-viewer-container');
        if (pdfViewer) {
            pdfViewer.remove();
            console.log('🧹 Container de PDF removido da seção:', section.id);
        }
    });
    
    // Esconder dynamicContent quando voltar para páginas principais
    const dynamicContent = document.getElementById('dynamicContent');
    if (dynamicContent) {
        dynamicContent.style.display = 'none';
        dynamicContent.classList.remove('active');
    }
    
    // Remove active de todos os botões da nav
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Renderiza o menu padronizado para cada seção (sempre mostra a página principal)
    // Garantir que banners de PDF sejam removidos antes de renderizar
    if (sectionName === 'painel') {
        const painelSection = document.getElementById('painelSection');
        if (painelSection) {
            const pdfBanner = painelSection.querySelector('.info-banner');
            if (pdfBanner && pdfBanner.querySelector('i.fa-file-pdf')) {
                pdfBanner.remove();
            }
        }
        renderPainelMenu();
    } else if (sectionName === 'qualidade') {
        const qualidadeSection = document.getElementById('qualidadeSection');
        if (qualidadeSection) {
            const pdfBanner = qualidadeSection.querySelector('.info-banner');
            if (pdfBanner && pdfBanner.querySelector('i.fa-file-pdf')) {
                pdfBanner.remove();
            }
            const pdfViewer = qualidadeSection.querySelector('.pdf-viewer-container');
            if (pdfViewer) {
                pdfViewer.remove();
            }
        }
        renderQualidadeMenu();
    } else if (sectionName === 'protocolos') {
        const protocolosSection = document.getElementById('protocolosSection');
        if (protocolosSection) {
            const pdfBanner = protocolosSection.querySelector('.info-banner');
            if (pdfBanner && pdfBanner.querySelector('i.fa-file-pdf')) {
                pdfBanner.remove();
            }
            const pdfViewer = protocolosSection.querySelector('.pdf-viewer-container');
            if (pdfViewer) {
                pdfViewer.remove();
            }
        }
        renderProtocolosMenu();
    } else if (sectionName === 'ferramentas') {
        const ferramentasSection = document.getElementById('ferramentasSection');
        if (ferramentasSection) {
            const pdfBanner = ferramentasSection.querySelector('.info-banner');
            if (pdfBanner && pdfBanner.querySelector('i.fa-file-pdf')) {
                pdfBanner.remove();
            }
        }
        renderFerramentasMenu();
    }
    
    // Ativa a seção solicitada
    const section = document.getElementById(sectionName + 'Section');
    if (section) {
        section.classList.add('active');
    }
    
    // Ativa o botão correspondente na barra inferior
    const btn = document.querySelector(`[data-section="${sectionName}"]`);
    if (btn) {
        btn.classList.add('active');
    }

    return true; // Explicit return for search system validation
}

// ==================== MINHAS PENDÊNCIAS ====================

async function showPendencias() {
    console.log('📋 Pendências clicado');
    
    // Atualizar histórico de navegação
    atualizarHistoricoNavegacao('pendencias');
    
    const section = document.getElementById('painelSection');
    if (!section) {
        console.error('Seção painelSection não encontrada');
        return;
    }
    
    // Usar renderPendenciasPage para renderizar a página sem exemplos
    section.innerHTML = renderPendenciasPage();
    
    // Garantir que userProfile está carregado antes de carregar pendências
    if (!userProfile) {
        console.log('⏳ [PENDÊNCIAS] Carregando perfil do usuário...');
        await loadUserProfile();
    }
    
    // Carregar pendências reais do Firebase
    setTimeout(() => {
        loadPendenciasCompletas();
    }, 200);
}

// Função para renderizar a página de pendências (estrutura HTML)
function renderPendenciasPage() {
    return `
        ${renderInfoBanner('fas fa-tasks', 'Minhas Pendências', 'Complete suas tarefas para manter-se atualizado', '#f59e0b 0%, #d97706 100%', "showSection('painel')")}
        
        <div id="pendencias-list" style="margin-top: 20px;">
            <div style="text-align: center; padding: 40px 20px; color: var(--cor-texto-claro);">
                <i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 15px;"></i>
                <p>Carregando pendências...</p>
            </div>
        </div>
    `;
}

// ==================== FUNÇÕES DO PAINEL PRINCIPAL ====================

// NOTA: A função showKPIs() foi movida para painel-qualidade.js
// onde está implementada com funcionalidade completa de gestão de documentos

function showResidencia() {
    console.log('🧑‍⚕️ Residência clicado');
    
    // Atualizar histórico de navegação
    atualizarHistoricoNavegacao('residencia');
    
    showToast('Funcionalidade em desenvolvimento', 'info');
}

// ==================== FUNÇÕES DE QUALIDADE E SEGURANÇA ====================

async function showIncidentes() {
    console.log('⚠️ Gestão de Incidentes');
    
    const section = document.getElementById('qualidadeSection');
    if (!section) return;
    
    // Limpar qualquer banner de PDF que possa ter ficado órfão
    const pdfBanner = section.querySelector('.info-banner');
    if (pdfBanner && pdfBanner.querySelector('i.fa-file-pdf')) {
        pdfBanner.remove();
        console.log('🧹 Banner de PDF removido antes de renderizar Gestão de Incidentes');
    }
    const pdfViewer = section.querySelector('.pdf-viewer-container');
    if (pdfViewer) {
        pdfViewer.remove();
        console.log('🧹 Container de PDF removido antes de renderizar Gestão de Incidentes');
    }
    
    // Banner padronizado + conteúdo original do painel-qualidade.js
    const html = `
        ${renderInfoBanner('fas fa-exclamation-triangle', 'Gestão de Incidentes', 'Notifique eventos adversos e near miss para melhorar continuamente a segurança do paciente', '#dc2626 0%, #991b1b 100%', "showSection('qualidade')")}
        
        <div class="protocols-grid">
            <div class="protocol-card" onclick="showNovoIncidente()" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #dc2626;">
                    <i class="fas fa-file-alt"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Formulário de Notificação</h3>
                </div>
            </div>

            <div class="protocol-card" onclick="showCanalDenuncia()" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #f59e0b;">
                    <i class="fas fa-shield-alt"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Canal de Denúncia Anônimo</h3>
                </div>
            </div>

            <div class="protocol-card" onclick="window.open('https://patientsafety.epimedmonitor.com/Public/PSNotification?CultureCode=pt-BR&TenantId=D0594BFF-3B84-4CD3-9009-927502C9EFEC&NetworkId=049D109C-44A6-4DA3-881B-25C13357BDF3&HospitalId=B813D26F-4DC7-498E-A5B3-37B1C4AB7A98', '_blank')" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #2563eb;">
                    <i class="fas fa-link"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Notificação Unimed</h3>
                </div>
            </div>

            <div class="protocol-card" onclick="showQRCodeGenerator()" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #8b5cf6;">
                    <span style="font-size: 32px;">📱</span>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Gerar QR Codes</h3>
                </div>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
}

async function showAuditorias() {
    console.log('📋 Auditorias e Conformidade');
    
    // Atualizar histórico de navegação
    atualizarHistoricoNavegacao('auditorias');

    const section = document.getElementById('qualidadeSection');
    if (!section) return;

    const html = `
        ${renderInfoBanner('fas fa-clipboard-check', 'Auditorias e Conformidade', 'Acompanhe auditorias e mantenha a conformidade com os padrões de acreditação', '#006837 0%, #9BC53D 100%', "showSection('qualidade')")}

        <div class="protocols-grid">
            <div class="protocol-card" onclick="showGrupoAuditoriasOperacionais()" style="cursor: pointer;">
                <div class="protocol-icon" style="background: linear-gradient(135deg, #059669 0%, #10B981 100%);">
                    <i class="fas fa-clipboard-list" style="font-size: 32px; color: white;"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Auditorias Operacionais</h3>
                </div>
            </div>

            <div class="protocol-card" onclick="showGrupoConformidadePoliticas()" style="cursor: pointer;">
                <div class="protocol-icon" style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);">
                    <i class="fas fa-file-contract" style="font-size: 32px; color: white;"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Conformidade e Políticas</h3>
                </div>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
}

function showGrupoAuditoriasOperacionais() {
    // Atualizar histórico de navegação
    atualizarHistoricoNavegacao('grupo-auditorias-operacionais');
    
    const section = document.getElementById('qualidadeSection');
    if (!section) return;

    const html = `
        ${renderInfoBanner('fas fa-clipboard-list', 'Auditorias Operacionais', 'Registros e evidências de auditorias de processos operacionais', '#059669 0%, #10B981 100%', 'showAuditorias()')}

        <div class="protocols-grid">
            <div class="protocol-card" onclick="showAuditoriaEspecifica('higiene_maos')" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #059669;">
                    <i class="fas fa-hand-sparkles"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Higiene das Mãos</h3>
                </div>
            </div>

            <div class="protocol-card" onclick="showAuditoriaEspecifica('uso_medicamentos')" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #2563eb;">
                    <i class="fas fa-pills"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Uso de Medicamentos</h3>
                </div>
            </div>

            <div class="protocol-card" onclick="showAuditoriaEspecifica('abreviaturas')" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #dc2626;">
                    <span style="font-size: 32px;">❌</span>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Abreviaturas Perigosas</h3>
                </div>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
}

function showGrupoConformidadePoliticas() {
    // Atualizar histórico de navegação
    atualizarHistoricoNavegacao('conformidade-politicas');
    
    const section = document.getElementById('qualidadeSection');
    if (!section) return;

    const html = `
        ${renderInfoBanner('fas fa-file-contract', 'Conformidade e Políticas', 'Políticas institucionais e documentos que garantem a conformidade com padrões de qualidade', '#7c3aed 0%, #a855f7 100%', 'showAuditorias()')}

        <div class="protocols-grid">
            <div class="protocol-card" onclick="showAuditoriaEspecifica('politica_gestao_qualidade')" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #7c3aed;">
                    <i class="fas fa-clipboard-list"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Política de Gestão da Qualidade</h3>
                </div>
            </div>

            <div class="protocol-card" onclick="showAuditoriaEspecifica('politica_disclosure')" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #0891b2;">
                    <i class="fas fa-file-alt"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Política de Disclosure</h3>
                </div>
            </div>

            <div class="protocol-card" onclick="showRelatorioEspecifico('auditorias')" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #059669;">
                    <span style="font-size: 32px;">🔍</span>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Relatório de Auditorias</h3>
                </div>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
}

async function showRelatorios() {
    console.log('📊 Relatórios de Segurança');
    
    // Atualizar histórico de navegação
    atualizarHistoricoNavegacao('relatorios');

    const section = document.getElementById('qualidadeSection');
    if (!section) return;

    // Verificar permissões de admin
    const isAdmin = typeof checkUserRole === 'function' ?
        await checkUserRole(['Administrador', 'Coordenador']) : false;

    // Banner padronizado + conteúdo original do painel-qualidade.js
    const html = `
        ${renderInfoBanner('fas fa-file-medical-alt', 'Relatórios de Segurança', 'Relatórios trimestrais e anuais de indicadores de qualidade e segurança', '#006837 0%, #9BC53D 100%', "showSection('qualidade')")}

        <div class="protocols-grid">
            <div class="protocol-card" onclick="showRelatorioEspecifico('trimestral')" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #2563eb;">
                    <i class="fas fa-calendar-alt"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Relatório Trimestral</h3>
                </div>
            </div>

            <div class="protocol-card" onclick="showRelatorioEspecifico('incidentes')" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #dc2626;">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Consolidado de Incidentes</h3>
                </div>
            </div>

            <div class="protocol-card" onclick="showRelatorioEspecifico('indicadores_qualidade')" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #059669;">
                    <i class="fas fa-chart-line"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Painel de Gestão à Vista</h3>
                </div>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
}

// ==================== RENDERIZAÇÃO DE MENUS PRINCIPAIS ====================

/**
 * Renderiza o menu principal do Painel (Home)
 */
function renderPainelMenu() {
    const section = document.getElementById('painelSection');
    if (!section) return;
    
    const config = {
        header: {
            emoji: '🏠',
            title: 'Painel Principal',
            subtitle: '' // Subtítulo removido
        },
        banner: {
            icon: 'fas fa-house-user',
            title: 'Bem-vindo ao Sistema ANEST',
            description: 'Acesse comunicados, indicadores de qualidade e todas as ferramentas disponíveis',
            gradient: '#004225 0%, #006837 100%' // Verde escuro ANEST
        },
        items: [
            {
                icon: '📢',
                title: 'Últimos Comunicados',
                description: 'Notícias e atualizações da diretoria',
                color: '#2563eb',
                onClick: 'showComunicados()'
            },
            {
                icon: '📋',
                title: 'Minhas Pendências',
                description: 'Tarefas e leituras obrigatórias',
                color: '#f59e0b',
                onClick: 'showPendencias()'
            },
            {
                icon: '📊',
                title: 'Painel de Gestão à Vista',
                description: 'Métricas e desempenho institucional',
                color: '#059669',
                onClick: 'showKPIs()'
            },
            {
                icon: 'fas fa-sitemap',
                title: 'Organograma',
                description: 'Estrutura organizacional e hierarquia institucional 2025',
                color: '#6366f1',
                onClick: 'showOrganograma()'
            },
            {
                icon: '🏆',
                title: 'ROPs Desafio',
                description: 'Quiz gamificado - Teste seus conhecimentos',
                color: '#7c3aed',
                onClick: 'showROPsDesafio()'
            },
            {
                icon: 'fas fa-balance-scale',
                title: 'Ética e Bioética',
                description: 'Gestão de dilemas éticos e pareceres técnicos',
                color: '#7c3aed',
                onClick: 'showEticaBioetica()'
            },
            {
                icon: 'fas fa-users',
                title: 'Comitês',
                description: 'Regimentos internos e estrutura de governança',
                color: '#0891b2',
                onClick: 'showComites()'
            },
            {
                icon: '🧑‍⚕️',
                title: 'Residência Médica',
                description: 'Calendário, escalas e informações',
                color: '#0891b2',
                onClick: 'showResidencia()'
            }
        ]
    };
    
    section.innerHTML = renderStandardLayout(config);
}

/**
 * Renderiza o menu principal de Qualidade e Segurança
 */
function renderQualidadeMenu() {
    const section = document.getElementById('qualidadeSection');
    if (!section) return;
    
    const config = {
        header: {
            emoji: '🛡️',
            title: 'Qualidade e Segurança',
            subtitle: '' // Subtítulo removido
        },
        banner: {
            icon: 'fas fa-shield-alt',
            title: 'Cultura de Segurança e Qualidade',
            description: 'Ferramentas para notificação, análise e melhoria contínua da segurança do paciente',
            gradient: '#006837 0%, #9BC53D 100%' // Verde ANEST
        },
        items: [
            {
                icon: '⚠️',
                title: 'Gestão de Incidentes',
                description: 'Notificar eventos adversos e near miss',
                color: '#dc2626',
                onClick: 'showIncidentes()'
            },
            {
                icon: '📋',
                title: 'Auditorias e Conformidade',
                description: 'Registros e resultados de auditorias',
                color: '#2563eb',
                onClick: 'showAuditorias()'
            },
            {
                icon: '📊',
                title: 'Relatórios de Segurança',
                description: 'Relatórios trimestrais e consolidados',
                color: '#059669',
                onClick: 'showRelatorios()'
            },
            {
                icon: 'fas fa-fire',
                title: 'Gerenciamento de Desastres',
                description: 'Planos de emergência, CGPED e protocolo de desastres',
                color: '#dc2626',
                onClick: 'showGerenciamentoDesastres()'
            }
        ],
        infoBox: {
            icon: 'fas fa-info-circle',
            title: 'Sobre Qualidade e Segurança:',
            content: '<p>Esta seção centraliza todas as ferramentas para promover a cultura de segurança e garantir a conformidade com os padrões Qmentum de acreditação.</p>'
        }
    };
    
    section.innerHTML = renderStandardLayout(config);
}

/**
 * Renderiza o menu principal de Protocolos
 */
function renderProtocolosMenu() {
    const section = document.getElementById('protocolosSection');
    if (!section) return;
    
    const config = {
        header: {
            emoji: '📚',
            title: 'Protocolos e Documentos',
            subtitle: '' // Subtítulo removido
        },
        banner: {
            icon: 'fas fa-book-medical',
            title: 'Protocolos Baseados em Evidências',
            description: 'Acesse protocolos institucionais, ROPs e diretrizes clínicas atualizadas',
            gradient: '#006837 0%, #9BC53D 100%' // Verde ANEST
        },
        items: [
            {
                icon: '📖',
                title: 'Biblioteca de Documentos',
                description: 'Todos os protocolos e POPs',
                color: '#2563eb',
                onClick: 'showBiblioteca()'
            },
            {
                icon: '💊',
                title: 'Segurança de Medicamentos',
                description: 'Protocolos ROPs de medicamentos',
                color: '#dc2626',
                onClick: 'showSegurancaMedicamentos()'
            },
            {
                icon: '🦠',
                title: 'Controle de Infecção',
                description: 'Protocolos de prevenção de IRAS',
                color: '#059669',
                onClick: 'showControleInfeccao()'
            }
        ],
        infoBox: {
            icon: 'fas fa-info-circle',
            title: 'Sobre os Protocolos:',
            content: '<p>Todos os protocolos são revisados periodicamente e baseados nas melhores evidências científicas e diretrizes Qmentum.</p>'
        }
    };
    
    section.innerHTML = renderStandardLayout(config);
}

/**
 * Renderiza o menu principal de Ferramentas Clínicas
 */
function renderFerramentasMenu() {
    const section = document.getElementById('ferramentasSection');
    if (!section) return;
    
    const config = {
        header: {
            emoji: '🛠️',
            title: 'Ferramentas',
            subtitle: '' // Subtítulo removido
        },
        banner: {
            icon: 'fas fa-tools',
            title: 'Ferramentas de Apoio à Prática Clínica',
            description: 'Recursos para auxiliar na tomada de decisão e segurança do paciente',
            gradient: '#006837 0%, #9BC53D 100%' // Verde ANEST
        },
        items: [
            {
                icon: '✅',
                title: 'Checklist de Cirurgia Segura (OMS)',
                description: 'Lista de verificação interativa',
                color: '#059669',
                onClick: 'showChecklistCirurgia()'
            },
            {
                icon: '💊',
                title: 'Conciliação Medicamentosa',
                description: 'Protocolos de admissão, transferência e alta',
                color: '#2563eb',
                onClick: 'showConciliacaoMedicamentosa()'
            },
            {
                icon: '⚠️',
                title: 'Avaliação de Riscos',
                description: 'Calculadoras de risco e protocolos',
                color: '#f59e0b',
                onClick: 'showAvaliacaoRiscos()'
            },
            {
                icon: '🧮',
                title: 'Calculadoras Anestésicas',
                description: 'Ferramentas de cálculo clínico',
                color: '#7c3aed',
                onClick: 'showCalculadoras()'
            },
            {
                icon: '🔧',
                title: 'Manutenção',
                description: 'Sistema de manutenção e gestão',
                color: '#3b82f6',
                onClick: "window.open('https://app.fixcare.io/auth', '_blank')"
            }
        ],
        infoBox: {
            icon: 'fas fa-info-circle',
            title: 'Sobre as Ferramentas:',
            content: '<p>As ferramentas clínicas são validadas e baseadas em guidelines internacionais. Use-as como apoio à decisão clínica.</p>'
        }
    };
    
    section.innerHTML = renderStandardLayout(config);
}

// ==================== GESTÃO DE COMUNICADOS (ETAPA 4) ====================

async function showComunicados() {
    console.log('📢 Carregando Últimos Comunicados');
    
    // Atualizar histórico de navegação
    atualizarHistoricoNavegacao('comunicados');
    
    const section = document.getElementById('painelSection');
    if (!section) {
        console.error('❌ Seção painelSection não encontrada');
        showToast('Erro ao carregar comunicados', 'error');
        return;
    }
    
    // Verificar se usuário é admin ou coordenador
    const isAdmin = await checkUserRole(['Administrador', 'Coordenador']);
    console.log('🔍 showComunicados - isAdmin:', isAdmin);
    
    const html = `
        ${renderInfoBanner('fas fa-bullhorn', 'Últimos Comunicados', 'Notícias, atualizações e informações importantes da instituição', '#2563eb 0%, #3b82f6 100%', "showSection('painel')")}
        
        <div style="margin-bottom: 20px; text-align: right;">
            ${isAdmin ? `
                <button class="btn-primary" onclick="showModalNovoComunicado()" style="background: #2563eb; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; gap: 8px;">
                    <i class="fas fa-plus"></i> Novo Comunicado
                </button>
            ` : ''}
        </div>
        
        <div id="comunicados-container" style="margin-top: 24px;">
            <div style="text-align: center; padding: 40px;">
                <i class="fas fa-spinner fa-spin" style="font-size: 32px; color: var(--primary-medium);"></i>
                <p style="margin-top: 16px; color: var(--text-secondary);">Carregando comunicados...</p>
            </div>
            </div>
        `;
    
    section.innerHTML = html;

    // Carregar comunicados do Firebase
    loadComunicadosFromFirebase(isAdmin);

    return true; // Explicit success return
}

async function checkUserRole(allowedRoles) {
    if (!currentUser) {
        console.log('❌ checkUserRole: Nenhum usuário logado');
        return false;
    }
    
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            const userRole = userData.role || 'Sem role definido';
            console.log(`👤 Role do usuário: "${userRole}"`);
            console.log(`✅ Roles permitidos: ${allowedRoles.join(', ')}`);
            
            // Comparação case-insensitive
            const userRoleLower = userRole.toLowerCase();
            const allowedRolesLower = allowedRoles.map(role => role.toLowerCase());
            const hasPermission = allowedRolesLower.includes(userRoleLower);
            
            console.log(`${hasPermission ? '✅' : '❌'} Permissão: ${hasPermission ? 'CONCEDIDA' : 'NEGADA'}`);
            return hasPermission;
        } else {
            console.log('⚠️ Documento do usuário não encontrado no Firestore');
        }
    } catch (error) {
        console.error('❌ Erro ao verificar role do usuário:', error);
    }
    
    return false;
}

async function loadComunicadosFromFirebase(isAdmin) {
    const container = document.getElementById('comunicados-container');
    
    try {
        const snapshot = await db.collection('comunicados')
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();
        
        if (snapshot.empty) {
            container.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 60px 20px; background: var(--bg-card); border-radius: 12px; border: 2px dashed var(--border-color);">
                    <i class="fas fa-inbox" style="font-size: 64px; color: var(--text-light); margin-bottom: 16px;"></i>
                    <h3 style="color: var(--text-primary); margin-bottom: 8px;">Nenhum comunicado ainda</h3>
                    <p style="color: var(--text-secondary); margin-bottom: ${isAdmin ? '16px' : '24px'};">
                        ${isAdmin ? 'Clique em "Novo Comunicado" para adicionar o primeiro.' : 'Novos comunicados aparecerão aqui.'}
                    </p>
                    ${!isAdmin ? `
                        <div style="margin-top: 20px; padding: 16px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; max-width: 500px; margin-left: auto; margin-right: auto;">
                            <p style="margin: 0; color: #856404; font-size: 14px;">
                                <i class="fas fa-info-circle"></i> 
                                <strong>Apenas administradores e coordenadores</strong> podem criar comunicados.
                            </p>
                        </div>
                    ` : ''}
            </div>
        `;
            return;
        }
        
        const comunicados = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        container.innerHTML = `
            <div class="protocols-grid">
                ${comunicados.map(com => renderComunicadoCard(com, isAdmin)).join('')}
            </div>
        `;
        
    } catch (error) {
        console.error('Erro ao carregar comunicados:', error);
        container.innerHTML = `
            <div class="error-state" style="text-align: center; padding: 40px; background: #fee; border-radius: 12px; border: 2px solid #fcc;">
                <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #c33; margin-bottom: 16px;"></i>
                <h3 style="color: #c33; margin-bottom: 8px;">Erro ao carregar comunicados</h3>
                <p style="color: #666;">Por favor, tente novamente mais tarde.</p>
            </div>
        `;
    }
}

function renderComunicadoCard(comunicado, isAdmin) {
    const tipoColors = {
        'Urgente': '#dc2626',
        'Importante': '#f59e0b',
        'Informativo': '#3b82f6',
        'Evento': '#9333ea',
        'Geral': '#6b7280'
    };
    
    const tipoColor = tipoColors[comunicado.tipo] || tipoColors['Geral'];
    
    const data = comunicado.createdAt?.toDate ? 
        comunicado.createdAt.toDate().toLocaleDateString('pt-BR') : 
        'Data não disponível';
    
    // Formatar data do evento se existir
    let dataEventoHTML = '';
    if (comunicado.dataEvento) {
        const dataEvt = new Date(comunicado.dataEvento);
        const dataFormatada = dataEvt.toLocaleDateString('pt-BR', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        dataEventoHTML = `
            <div style="margin-top: 12px; padding: 8px 12px; background: rgba(147, 51, 234, 0.1); border-left: 3px solid #9333ea; border-radius: 4px;">
                <i class="fas fa-calendar-check" style="color: #9333ea; margin-right: 6px;"></i>
                <strong style="color: #9333ea;">Evento:</strong>
                <span style="color: var(--text-primary); margin-left: 6px;">${dataFormatada}</span>
            </div>
        `;
    }
    
    return `
        <div class="protocol-card comunicado-card" style="cursor: pointer; flex-direction: column; align-items: stretch;">
            <div onclick="verComunicadoCompleto('${comunicado.id}')" style="flex: 1;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                    <span style="display: inline-block; padding: 4px 12px; background: ${tipoColor}; color: white; border-radius: 12px; font-size: 12px; font-weight: 600;">
                        ${comunicado.tipo || 'Geral'}
                    </span>
                    <span style="font-size: 13px; color: var(--text-light);">
                        <i class="fas fa-calendar"></i> ${data}
                    </span>
                </div>
                
                <h3 style="margin: 0 0 8px 0; color: var(--text-primary); font-size: 18px; font-weight: 600;">
                    ${comunicado.titulo}
                </h3>
                
                <p style="margin: 0; color: var(--text-secondary); font-size: 14px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">
                    ${comunicado.conteudo}
                </p>
                
                ${dataEventoHTML}
                
                ${comunicado.link ? `
                    <div style="margin-top: 8px;">
                        <i class="fas fa-link" style="color: var(--primary-medium); margin-right: 6px;"></i>
                        <span style="font-size: 13px; color: var(--primary-medium);">Link incluído</span>
                    </div>
                ` : ''}
                </div>
                
            ${isAdmin ? `
                <div style="display: flex; gap: 8px; margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border-color);">
                    <button onclick="event.stopPropagation(); editarComunicado('${comunicado.id}')" style="flex: 1; padding: 8px; background: var(--primary-medium); color: white; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; transition: all 0.2s;">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button onclick="event.stopPropagation(); excluirComunicado('${comunicado.id}')" style="flex: 1; padding: 8px; background: #dc2626; color: white; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; transition: all 0.2s;">
                        <i class="fas fa-trash"></i> Excluir
                    </button>
                </div>
            ` : ''}
        </div>
    `;
}

// Modal para criar/editar comunicado
let comunicadoEditando = null;
let arquivosSelecionados = [];

function showModalNovoComunicado() {
    comunicadoEditando = null;
    arquivosSelecionados = [];
    showModalComunicado();
}

async function editarComunicado(id) {
    try {
        const doc = await db.collection('comunicados').doc(id).get();
        if (doc.exists) {
            comunicadoEditando = { id, ...doc.data() };
            showModalComunicado();
        }
    } catch (error) {
        console.error('Erro ao carregar comunicado:', error);
        showToast('Erro ao carregar comunicado', 'error');
    }
}

function showModalComunicado() {
    const isEdit = comunicadoEditando !== null;
    const data = comunicadoEditando || {};
    
    const modalHTML = `
        <div id="modalComunicado" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px;">
            <div style="background: var(--bg-card); border-radius: 16px; max-width: 700px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
                <div style="padding: 24px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                    <h2 style="margin: 0; color: var(--text-primary); font-size: 24px;">
                        <i class="fas fa-${isEdit ? 'edit' : 'plus-circle'}"></i> 
                        ${isEdit ? 'Editar Comunicado' : 'Novo Comunicado'}
                    </h2>
                    <button onclick="closeModalComunicado()" style="background: none; border: none; font-size: 24px; color: var(--text-light); cursor: pointer;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <form id="formComunicado" style="padding: 24px;">
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary);">
                            <i class="fas fa-tag"></i> Tipo *
                        </label>
                        <select id="tipoComunicado" required onchange="toggleDataEvento()" style="width: 100%; padding: 12px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 15px; background: var(--bg-card); color: var(--text-primary);">
                            <option value="Geral" ${data.tipo === 'Geral' ? 'selected' : ''}>Geral</option>
                            <option value="Informativo" ${data.tipo === 'Informativo' ? 'selected' : ''}>Informativo</option>
                            <option value="Importante" ${data.tipo === 'Importante' ? 'selected' : ''}>Importante</option>
                            <option value="Urgente" ${data.tipo === 'Urgente' ? 'selected' : ''}>Urgente</option>
                            <option value="Evento" ${data.tipo === 'Evento' ? 'selected' : ''}>Evento</option>
                    </select>
                </div>
                
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary);">
                            <i class="fas fa-heading"></i> Título *
                        </label>
                        <input type="text" id="tituloComunicado" value="${data.titulo || ''}" required maxlength="100" placeholder="Ex: Nova Política de Segurança" style="width: 100%; padding: 12px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 15px; background: var(--bg-card); color: var(--text-primary);">
                </div>
                
                    <div id="dataEventoContainer" style="margin-bottom: 20px; ${data.tipo === 'Evento' ? '' : 'display: none;'}">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary);">
                            <i class="fas fa-calendar-alt"></i> Data do Evento ${data.tipo === 'Evento' ? '*' : '(opcional)'}
                        </label>
                        <input type="datetime-local" id="dataEvento" value="${data.dataEvento || ''}" ${data.tipo === 'Evento' ? 'required' : ''} style="width: 100%; padding: 12px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 15px; background: var(--bg-card); color: var(--text-primary);">
                        <small style="display: block; margin-top: 4px; color: var(--text-secondary); font-size: 12px;">
                            Informe quando o evento irá ocorrer
                        </small>
                </div>
                
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary);">
                            <i class="fas fa-align-left"></i> Conteúdo *
                        </label>
                        <textarea id="conteudoComunicado" required rows="6" placeholder="Descreva o comunicado..." style="width: 100%; padding: 12px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 15px; resize: vertical; background: var(--bg-card); color: var(--text-primary);">${data.conteudo || ''}</textarea>
                </div>
                
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary);">
                            <i class="fas fa-link"></i> Link (opcional)
                        </label>
                        <input type="url" id="linkComunicado" value="${data.link || ''}" placeholder="https://exemplo.com" style="width: 100%; padding: 12px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 15px; background: var(--bg-card); color: var(--text-primary);">
                </div>
                
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary);">
                            <i class="fas fa-paperclip"></i> Anexos (opcional)
                        </label>
                        <input type="file" id="fileInput" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif" style="display: none;" onchange="handleFileSelection(event)">
                        <button type="button" onclick="document.getElementById('fileInput').click()" style="width: 100%; padding: 16px; border: 2px dashed var(--border-color); border-radius: 8px; background: var(--bg-light); color: var(--text-secondary); font-size: 14px; cursor: pointer; transition: all 0.2s;">
                            <i class="fas fa-cloud-upload-alt" style="font-size: 24px; display: block; margin-bottom: 8px;"></i>
                            Clique para selecionar arquivos
                            <div style="font-size: 12px; margin-top: 4px; color: var(--text-light);">
                                PDF, Word, Excel, PowerPoint, Imagens (máx 10MB cada)
                            </div>
                        </button>
                        <div id="arquivos-selecionados" style="margin-top: 12px;"></div>
                </div>
                
                    <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
                        <button type="button" onclick="closeModalComunicado()" style="padding: 12px 24px; background: var(--bg-light); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 8px; font-weight: 600; cursor: pointer;">
                            Cancelar
                        </button>
                        <button type="submit" style="padding: 12px 24px; background: var(--primary-medium); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                            <i class="fas fa-${isEdit ? 'save' : 'paper-plane'}"></i> ${isEdit ? 'Salvar' : 'Publicar'}
                        </button>
                </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    document.getElementById('formComunicado').addEventListener('submit', async (e) => {
        e.preventDefault();
        await salvarComunicado();
    });
    
    document.getElementById('modalComunicado').addEventListener('click', (e) => {
        if (e.target.id === 'modalComunicado') closeModalComunicado();
    });
    
    // Chamar toggleDataEvento para configurar estado inicial
    toggleDataEvento();
}

// Toggle campo de data do evento
function toggleDataEvento() {
    const tipo = document.getElementById('tipoComunicado')?.value;
    const container = document.getElementById('dataEventoContainer');
    const input = document.getElementById('dataEvento');
    const label = container?.querySelector('label');
    
    if (!container || !input) return;
    
    if (tipo === 'Evento') {
        container.style.display = 'block';
        input.required = true;
        if (label) {
            label.innerHTML = '<i class="fas fa-calendar-alt"></i> Data do Evento *';
        }
    } else {
        container.style.display = 'block'; // Sempre mostrar, mas não obrigatório
        input.required = false;
        if (label) {
            label.innerHTML = '<i class="fas fa-calendar-alt"></i> Data do Evento (opcional)';
        }
    }
}

function closeModalComunicado() {
    const modal = document.getElementById('modalComunicado');
    if (modal) modal.remove();
    comunicadoEditando = null;
    arquivosSelecionados = [];
}

// Manipulação de arquivos
function handleFileSelection(event) {
    const files = Array.from(event.target.files);
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    files.forEach(file => {
        if (file.size > maxSize) {
            showToast(`Arquivo "${file.name}" muito grande (máx 10MB)`, 'error');
            return;
        }
        
        // Verificar se já não foi adicionado
        if (!arquivosSelecionados.find(f => f.name === file.name && f.size === file.size)) {
            arquivosSelecionados.push(file);
        }
    });
    
    renderArquivosSelecionados();
}

function renderArquivosSelecionados() {
    const container = document.getElementById('arquivos-selecionados');
    if (!container) return;
    
    if (arquivosSelecionados.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = arquivosSelecionados.map((file, index) => {
        const tamanho = (file.size / 1024).toFixed(1);
        const icone = getFileIcon(file.name);
        
        return `
            <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 8px;">
                <i class="fas fa-${icone}" style="font-size: 24px; color: var(--primary-medium);"></i>
                <div style="flex: 1;">
                    <div style="font-weight: 500; color: var(--text-primary); font-size: 14px;">${file.name}</div>
                    <div style="font-size: 12px; color: var(--text-light);">${tamanho} KB</div>
                </div>
                <button type="button" onclick="removerArquivo(${index})" style="background: none; border: none; color: #dc2626; cursor: pointer; padding: 8px;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    }).join('');
}

function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const icons = {
        'pdf': 'file-pdf',
        'doc': 'file-word',
        'docx': 'file-word',
        'xls': 'file-excel',
        'xlsx': 'file-excel',
        'ppt': 'file-powerpoint',
        'pptx': 'file-powerpoint',
        'jpg': 'file-image',
        'jpeg': 'file-image',
        'png': 'file-image',
        'gif': 'file-image'
    };
    return icons[ext] || 'file';
}

function removerArquivo(index) {
    arquivosSelecionados.splice(index, 1);
    renderArquivosSelecionados();
    showToast('Arquivo removido', 'info');
}

// Upload de arquivos para Firebase Storage
async function uploadArquivos(comunicadoId) {
    if (arquivosSelecionados.length === 0) return [];
    
    const storage = firebase.storage();
    const uploadPromises = arquivosSelecionados.map(async (file) => {
        const fileName = `${Date.now()}_${file.name}`;
        const storageRef = storage.ref(`comunicados/${comunicadoId}/${fileName}`);
        
        try {
            const snapshot = await storageRef.put(file);
            const downloadURL = await snapshot.ref.getDownloadURL();
            
            return {
                nome: file.name,
                url: downloadURL,
                tamanho: file.size,
                tipo: file.type,
                uploadedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error(`Erro ao fazer upload de ${file.name}:`, error);
            throw error;
        }
    });
    
    return await Promise.all(uploadPromises);
}

async function salvarComunicado() {
    const tipo = document.getElementById('tipoComunicado').value;
    const titulo = document.getElementById('tituloComunicado').value.trim();
    const conteudo = document.getElementById('conteudoComunicado').value.trim();
    const link = document.getElementById('linkComunicado').value.trim();
    const dataEvento = document.getElementById('dataEvento').value;
    
    if (!titulo || !conteudo) {
        showToast('Preencha todos os campos obrigatórios', 'error');
        return;
    }
    
    if (tipo === 'Evento' && !dataEvento) {
        showToast('Informe a data do evento', 'error');
        return;
    }
    
    // Desabilitar botão de submit
    const submitBtn = document.querySelector('#formComunicado button[type="submit"]');
    const btnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    
    try {
        let docRef;
        let comunicadoId;
        
        // 1. Criar ou obter ID do documento
        if (comunicadoEditando) {
            comunicadoId = comunicadoEditando.id;
            docRef = db.collection('comunicados').doc(comunicadoId);
        } else {
            docRef = db.collection('comunicados').doc();
            comunicadoId = docRef.id;
        }
        
        // 2. Fazer upload dos arquivos (se houver)
        let anexos = [];
        if (arquivosSelecionados.length > 0) {
            submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Enviando arquivos (${arquivosSelecionados.length})...`;
            anexos = await uploadArquivos(comunicadoId);
            console.log('✅ Arquivos enviados:', anexos);
        }
        
        // 3. Manter anexos existentes se estiver editando
        if (comunicadoEditando && comunicadoEditando.anexos) {
            anexos = [...comunicadoEditando.anexos, ...anexos];
        }
        
        // 4. Preparar dados do comunicado
        const comunicadoData = {
            tipo,
            titulo,
            conteudo,
            link: link || null,
            dataEvento: dataEvento || null,
            anexos,
            autorId: currentUser.uid,
            autorNome: currentUser.displayName || currentUser.email,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // 5. Salvar no Firestore
        if (comunicadoEditando) {
            await docRef.update(comunicadoData);
            showToast('Comunicado atualizado!', 'success');
        } else {
            comunicadoData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await docRef.set(comunicadoData);
            showToast('Comunicado publicado!', 'success');
        }
        
        closeModalComunicado();
        showComunicados();
        
    } catch (error) {
        console.error('Erro ao salvar:', error);
        showToast('Erro ao salvar comunicado: ' + error.message, 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = btnText;
    }
}

async function excluirComunicado(id) {
    if (!confirm('Tem certeza que deseja excluir este comunicado?')) return;
    
    try {
        await db.collection('comunicados').doc(id).delete();
        showToast('Comunicado excluído!', 'success');
        showComunicados();
    } catch (error) {
        console.error('Erro ao excluir:', error);
        showToast('Erro ao excluir', 'error');
    }
}

// Funções de PDF removidas - usando iframe nativo agora

async function verComunicadoCompleto(id) {
    console.log('🎯 FUNÇÃO verComunicadoCompleto CHAMADA! ID:', id);
    try {
        console.log('📡 Buscando comunicado no Firebase...');
        const doc = await db.collection('comunicados').doc(id).get();
        console.log('📦 Documento recebido. Exists:', doc.exists);
        
        if (!doc.exists) {
            console.error('❌ Comunicado não encontrado no Firebase!');
            showToast('Comunicado não encontrado', 'error');
            return;
        }
        
        const c = doc.data();
        console.log('📄 Dados do comunicado:', c);
        console.log('📎 Anexos:', c.anexos);
        const data = c.createdAt?.toDate?.() ? 
            c.createdAt.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : 
            'Data não disponível';
        
        const tipoColors = {
            'Urgente': '#dc2626',
            'Importante': '#f59e0b',
            'Informativo': '#3b82f6',
            'Evento': '#9333ea',
            'Geral': '#6b7280'
        };
        
        // Formatar data do evento se existir
        let dataEventoSection = '';
        if (c.dataEvento) {
            const dataEvt = new Date(c.dataEvento);
            const dataFormatada = dataEvt.toLocaleDateString('pt-BR', { 
                day: '2-digit', 
                month: 'long', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            dataEventoSection = `
                <div style="margin-top: 24px; margin-bottom: 24px; padding: 20px; background: linear-gradient(135deg, rgba(147, 51, 234, 0.1) 0%, rgba(147, 51, 234, 0.05) 100%); border-radius: 12px; border: 2px solid #9333ea;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                        <i class="fas fa-calendar-alt" style="font-size: 28px; color: #9333ea;"></i>
                        <div>
                            <div style="font-size: 12px; color: #9333ea; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Data do Evento</div>
                            <div style="font-size: 20px; color: var(--text-primary); font-weight: 700; margin-top: 4px;">${dataFormatada}</div>
        </div>
                    </div>
                </div>
            `;
        }
        
        const modalHTML = `
        <style>
                /* PDF Viewer com iframe - Responsivo */
                #modalVerComunicado .anexo-pdf-container iframe {
                    width: 100% !important;
                    height: 700px !important;
                    border: none !important;
                    display: block !important;
                    background: white;
                }
                
                @media (max-width: 768px) {
                    #modalVerComunicado .anexo-pdf-container iframe {
                        height: 600px !important;
                    }
                }
                
                @media (max-width: 480px) {
                    #modalVerComunicado .anexo-pdf-container iframe {
                        height: 500px !important;
                    }
                }
                
                /* Manter imagens PNG responsivas também */
                #modalVerComunicado .anexo-image {
                    max-width: 100%;
                    height: auto;
                display: block;
            }
        </style>
            <div id="modalVerComunicado" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px;">
                <div style="background: var(--bg-card); border-radius: 16px; max-width: 800px; width: 100%; max-height: 90vh; overflow-y: auto;">
                    <div style="padding: 32px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 24px;">
                            <span style="padding: 6px 16px; background: ${tipoColors[c.tipo] || tipoColors['Geral']}; color: white; border-radius: 16px; font-size: 14px; font-weight: 600;">
                                ${c.tipo || 'Geral'}
                            </span>
                            <button onclick="document.getElementById('modalVerComunicado').remove()" style="background: none; border: none; font-size: 24px; color: var(--text-light); cursor: pointer;">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        
                        <h2 style="margin: 0 0 12px 0; color: var(--text-primary); font-size: 28px; font-weight: 700;">
                            ${c.titulo}
                        </h2>
                        
                        <div style="display: flex; gap: 16px; margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--border-color); color: var(--text-secondary); font-size: 14px;">
                            <div><i class="fas fa-calendar"></i> ${data}</div>
                            <div><i class="fas fa-user"></i> ${c.autorNome || 'Sistema'}</div>
                        </div>
                        
                        <div style="color: var(--text-primary); font-size: 16px; line-height: 1.8; white-space: pre-line;">
                            ${c.conteudo}
                        </div>
                        
                        ${dataEventoSection}
                        
                        ${c.link ? `
                            <div style="margin-top: 24px; padding: 16px; background: var(--bg-light); border-radius: 12px; border-left: 4px solid var(--primary-medium);">
                                <div style="margin-bottom: 8px;"><i class="fas fa-link" style="color: var(--primary-medium);"></i> <strong>Link:</strong></div>
                                <a href="${c.link}" target="_blank" style="color: var(--primary-medium); word-break: break-all;">
                                    ${c.link} <i class="fas fa-external-link-alt" style="font-size: 12px;"></i>
                                </a>
                            </div>
                        ` : ''}
                        
                        ${c.anexos && c.anexos.length > 0 ? `
                            <div style="margin-top: 32px;">
                                <h3 class="anexos-title" style="color: var(--text-primary); font-size: 18px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; font-weight: 700;">
                                    <i class="fas fa-paperclip"></i> Anexos (${c.anexos.length})
                                </h3>
                                <div style="display: flex; flex-direction: column; gap: 24px;">
                                    ${c.anexos.map((anexo, index) => {
                                        const ext = anexo.nome.split('.').pop().toLowerCase();
                                        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
                                        const isPdf = ext === 'pdf';
                                        
                                        if (isPdf) {
                                            const googleViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(anexo.url)}&embedded=true`;
                                            return `
                                                <div style="border: 2px solid var(--border-color); border-radius: 12px; overflow: hidden; margin-bottom: 8px;">
                                                    <div style="padding: 12px 16px; background: var(--bg-card); border-bottom: 1px solid var(--border-color); display: flex; align-items: center; gap: 12px;">
                                                        <i class="fas fa-file-pdf" style="font-size: 20px; color: #dc2626;"></i>
                                                        <div style="flex: 1;">
                                                            <div style="font-weight: 600; font-size: 14px; color: var(--text-primary);">${anexo.nome}</div>
                                                            <div style="font-size: 12px; color: var(--text-light);">${(anexo.tamanho / 1024).toFixed(1)} KB</div>
                                                        </div>
                                                        <a href="${anexo.url}" target="_blank" 
                                                           style="padding: 6px 12px; background: #dc2626; color: white; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                                                            <i class="fas fa-external-link-alt"></i> Abrir
                                                        </a>
                                                    </div>
                                                    <div style="width: 100%; height: 700px;">
                                                        <iframe src="${googleViewerUrl}" 
                                                                style="width: 100%; height: 100%; border: none; display: block;">
                                                        </iframe>
                                                    </div>
                                                </div>
                                            `;
                                        } else if (isImage) {
                                            return `
                                                <div class="anexo-image-container" style="border: 2px solid var(--border-color); border-radius: 12px; overflow: hidden; background: var(--bg-light); margin-bottom: 8px;">
                                                    <div style="padding: 12px 16px; background: var(--bg-card); border-bottom: 1px solid var(--border-color); display: flex; align-items: center; gap: 12px;">
                                                        <i class="fas fa-file-image" style="font-size: 20px; color: #059669;"></i>
                                                        <div style="flex: 1;">
                                                            <div style="font-weight: 600; font-size: 14px; color: var(--text-primary);">${anexo.nome}</div>
                                                            <div style="font-size: 12px; color: var(--text-light);">${(anexo.tamanho / 1024).toFixed(1)} KB</div>
                                                        </div>
                                                    </div>
                                                    <div class="image-viewer-container" style="padding: 16px; display: flex; justify-content: center; align-items: center; background: #f9fafb;">
                                                        <img src="${anexo.url}" 
                                                             alt="${anexo.nome}" 
                                                             class="anexo-image"
                                                             style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); display: block;"
                                                             oncontextmenu="return false;">
                                                    </div>
                                                </div>
                                            `;
                                        } else {
                                            // Outros arquivos (Word, Excel, etc) - mostrar info mas não renderizar
                                            return `
                                                <div style="padding: 16px; background: var(--bg-light); border-radius: 8px; border: 1px solid var(--border-color); display: flex; align-items: center; gap: 12px;">
                                                    <i class="fas fa-${getFileIcon(anexo.nome)}" style="font-size: 32px; color: var(--primary-medium);"></i>
                                                    <div style="flex: 1;">
                                                        <div style="font-weight: 600; font-size: 14px; color: var(--text-primary);">${anexo.nome}</div>
                                                        <div style="font-size: 12px; color: var(--text-light); margin-top: 4px;">${(anexo.tamanho / 1024).toFixed(1)} KB</div>
                                                        <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px; font-style: italic;">
                                                            <i class="fas fa-info-circle"></i> Este tipo de arquivo não pode ser visualizado diretamente
                                                        </div>
                                                    </div>
                                                </div>
                                            `;
                                        }
                                    }).join('')}
                                </div>
                            </div>
                        ` : ''}
                        
                        <button onclick="document.getElementById('modalVerComunicado').remove()" style="width: 100%; margin-top: 32px; padding: 14px; background: var(--primary-medium); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 16px;">
                            Fechar
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        document.getElementById('modalVerComunicado').addEventListener('click', (e) => {
            if (e.target.id === 'modalVerComunicado') e.target.remove();
        });
        
        
    } catch (error) {
        console.error('Erro:', error);
        showToast('Erro ao carregar comunicado', 'error');
    }
}

async function loadComunicados() {
    try {
        const comunicadosList = document.getElementById('comunicados-list');
        
        // Simular carregamento de comunicados (substituir por dados reais do Firebase)
        const comunicados = [
            {
                id: '1',
                title: 'Nova Política de Segurança',
                content: 'Implementação de novas diretrizes de segurança para procedimentos anestésicos.',
                date: '2025-10-29',
                priority: 'high',
                read: false
            },
            {
                id: '2',
                title: 'Atualização de Protocolos',
                content: 'Revisão e atualização dos protocolos de emergência.',
                date: '2025-10-28',
                priority: 'medium',
                read: true
            },
            {
                id: '3',
                title: 'Reunião de Equipe',
                content: 'Reunião mensal agendada para próxima sexta-feira.',
                date: '2025-10-27',
                priority: 'low',
                read: true
            }
        ];
        
        if (comunicados.length === 0) {
            comunicadosList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-bullhorn"></i>
                    <h3>Nenhum comunicado disponível</h3>
                    <p>Novos comunicados aparecerão aqui quando disponíveis.</p>
                </div>
            `;
            return;
        }
        
        comunicadosList.innerHTML = comunicados.map(comunicado => `
            <div class="comunicado-card ${comunicado.read ? '' : 'unread'}" onclick="openComunicado('${comunicado.id}')">
                <div class="comunicado-header">
                    <div class="comunicado-priority priority-${comunicado.priority}">
                        <i class="fas fa-circle"></i>
                    </div>
                    <div class="comunicado-title">
                        <h3>${comunicado.title}</h3>
                        <span class="comunicado-date">${formatDate(comunicado.date)}</span>
                    </div>
                    ${!comunicado.read ? '<span class="badge-new">Novo</span>' : ''}
                </div>
                <div class="comunicado-content">
                    <p>${comunicado.content}</p>
                </div>
                <div class="comunicado-actions">
                    <button class="btn-read" onclick="event.stopPropagation(); markAsRead('${comunicado.id}')">
                        <i class="fas fa-check"></i> Marcar como lido
                    </button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Erro ao carregar comunicados:', error);
        document.getElementById('comunicados-list').innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Erro ao carregar comunicados</h3>
                <p>Tente novamente mais tarde.</p>
            </div>
        `;
    }
}

function openComunicado(id) {
    console.log('Abrindo comunicado:', id);
    showToast('Abrindo comunicado...', 'info');
    // Implementar abertura do comunicado
}

function markAsRead(id) {
    console.log('Marcando como lido:', id);
    showToast('Comunicado marcado como lido', 'success');
    // Implementar marcação como lido
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Funções movidas para painel-qualidade.js

// ==================== ROPS DESAFIO - QUIZ GAMIFICADO ====================

let currentQuizState = {
    area: null,
    areaKey: null,
    rop: null,
    ropKey: null,
    questions: [],
    currentQuestion: 0,
    score: 0,
    answers: [],
    savedState: null  // Para salvar estado ao sair
};

function showROPsDesafio() {
    console.log('🏆 ROPs Desafio clicado');
    
    // Atualizar histórico de navegação
    atualizarHistoricoNavegacao('rops-desafio');
    
    if (!window.ropsData) {
        showToast('Erro: Dados de ROPs não carregados', 'error');
        return;
    }
    
    // Contar total de questões
    let totalQuestions = 0;
    Object.keys(window.ropsData).forEach(areaKey => {
        const area = window.ropsData[areaKey];
        if (area.subdivisoes) {
            Object.keys(area.subdivisoes).forEach(ropKey => {
                const rop = area.subdivisoes[ropKey];
                if (rop.questions) {
                    totalQuestions += rop.questions.length;
                }
            });
        }
    });
    
    console.log(`✅ ${Object.keys(window.ropsData).length} áreas ROPs disponíveis`);
    console.log(`✅ ${totalQuestions} questões no total`);
    
    // Criar tela de áreas ROPs
    const section = document.getElementById('painelSection');
    if (!section) return;
    
    const areas = Object.entries(window.ropsData);
    
    const html = `
        ${renderInfoBanner('fas fa-trophy', 'ROPs Desafio', 'Teste seus conhecimentos com quizzes e ouça podcasts educativos sobre as ROPs Qmentum', '#7c3aed 0%, #a855f7 100%', "showSection('painel')")}
        
        <div class="menu-grid">
            ${areas.map(([key, area]) => {
                // Contar questões desta área
                let areaQuestions = 0;
                if (area.subdivisoes) {
                    Object.values(area.subdivisoes).forEach(rop => {
                        if (rop.questions) areaQuestions += rop.questions.length;
                    });
                }
                
                return `
                    <div class="menu-card" onclick="showROPsChoiceMenu('${key}')">
                        <div class="card-icon" style="background: ${area.color}">
                            <i class="${area.icon}"></i>
                </div>
                        <h3>${area.title}</h3>
                </div>
                `;
            }).join('')}
            
            <div class="menu-card" onclick="showROPsRanking()">
                <div class="card-icon" style="background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%)">
                    <i class="fas fa-trophy"></i>
            </div>
                <h3>Ranking</h3>
            </div>
        </div>
        
        ${renderInfoBox('fas fa-info-circle', 'Sobre ROPs Desafio:', '<p>Aprenda de forma interativa sobre as Práticas Organizacionais Requeridas (ROPs) do Qmentum. Complete quizzes, ganhe pontos e suba no ranking!</p>')}
    `;
    
    section.innerHTML = html;
}

// ==================== PODCASTS ROPS ====================

function showROPsPodcasts(areaKey) {
    console.log('🎧 Podcasts ROPs clicado - Área:', areaKey);
    
    const section = document.getElementById('painelSection');
    if (!section) {
        console.error('❌ Seção painelSection não encontrada');
        showToast('Erro ao carregar podcasts', 'error');
        return;
    }
    
    if (!window.podcastsData) {
        console.error('❌ Dados de podcasts não carregados');
        showToast('Erro: Dados de podcasts não disponíveis', 'error');
        return;
    }
    
    // Se areaKey foi fornecida, mostrar apenas podcasts dessa área
    let categoriesToShow = {};
    if (areaKey && window.podcastsData[areaKey]) {
        categoriesToShow[areaKey] = window.podcastsData[areaKey];
        console.log('✅ Mostrando podcasts da área:', areaKey);
    } else {
        // Mostrar todas as categorias
        categoriesToShow = window.podcastsData;
        console.log('✅ Mostrando todos os podcasts');
    }
    
    // Gerar HTML por categoria
    let categoriesHTML = '';
    Object.entries(categoriesToShow).forEach(([key, category]) => {
        categoriesHTML += `
            <div style="margin-bottom: 32px;">
                <h2 style="color: #1e40af; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb;">
                    <i class="${category.icon}"></i> ${category.title}
                </h2>
                ${(category.audios || []).map((podcast, idx) => `
                    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin-bottom: 12px; cursor: pointer;" onclick="playPodcastByIndex('${key}', ${idx})">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div><i class="fas fa-headphones" style="font-size: 24px;"></i></div>
                            <div style="flex: 1;">
                                <h3 style="margin: 0 0 4px 0; color: #1e40af; font-size: 15px;">${podcast.title}</h3>
                                <p style="margin: 0; color: #64748b; font-size: 13px;">${podcast.descricao || podcast.description || ''}</p>
                </div>
                            <button onclick="event.stopPropagation(); playPodcastByIndex('${key}', ${idx})" style="width: 40px; height: 40px; background: #3b82f6; color: white; border: none; border-radius: 50%; cursor: pointer; font-size: 16px;">
                                ▶️
            </button>
                        </div>
                    </div>
                `).join('')}
        </div>
    `;
    });
    
    const totalPodcasts = Object.values(categoriesToShow).reduce((sum, cat) => sum + (cat.audios?.length || 0), 0);
    
    const html = `
        ${renderInfoBanner('fas fa-headphones', 'Podcasts ROPs', `Conteúdo educativo em áudio - ${totalPodcasts} podcast${totalPodcasts !== 1 ? 's' : ''} disponível${totalPodcasts !== 1 ? 'eis' : ''}`, '#7c3aed 0%, #a855f7 100%', areaKey ? `showROPsChoiceMenu('${areaKey}')` : 'showROPsDesafio()')}
        
        <div style="padding: 20px;">
            ${categoriesHTML}
        </div>
    `;
    
    section.innerHTML = html;
    console.log('✅ Podcasts reais renderizados com sucesso!');
    // Toast removido - carregamento de podcasts não precisa de notificação
}

function playPodcastByIndex(categoryKey, podcastIndex) {
    console.log('🎵 Tocando podcast - Categoria:', categoryKey, 'Índice:', podcastIndex);
    
    if (!window.podcastsData || !window.podcastsData[categoryKey]) {
        console.error('❌ Categoria não encontrada:', categoryKey);
        showToast('Erro: Categoria não encontrada', 'error');
        return;
    }
    
    // CORRIGIDO: usar 'audios' em vez de 'podcasts'
    const podcasts = window.podcastsData[categoryKey].audios || [];
    const podcast = podcasts[podcastIndex];
    
    if (!podcast) {
        console.error('❌ Podcast não encontrado no índice:', podcastIndex);
        showToast('Erro: Podcast não encontrado', 'error');
        return;
    }
    
    const audioUrl = podcast.file || podcast.audioFile;
    console.log('📁 Arquivo:', audioUrl);
    console.log('🎵 Título:', podcast.title);
    
    if (!audioUrl) {
        console.error('❌ Podcast sem URL');
        showToast('Erro: URL do áudio não encontrada', 'error');
        return;
    }
    
    // Método simples que funcionava antes
    const audio = new Audio(audioUrl);
    
    audio.addEventListener('loadeddata', () => {
        console.log('✅ Áudio carregado com sucesso');
        showToast(`Tocando: ${podcast.title}`, 'success');
        audio.play().catch(error => {
            console.error('❌ Erro ao tocar áudio:', error);
            showToast('Erro ao tocar áudio', 'error');
        });
    });
    
    audio.addEventListener('error', (e) => {
        console.error('❌ Erro ao carregar áudio:', e);
        console.error('❌ Arquivo que falhou:', audioUrl);
        showToast('Erro ao carregar áudio', 'error');
    });
    
    audio.addEventListener('ended', () => {
        console.log('✅ Podcast finalizado');
        showToast('Podcast finalizado!', 'info');
    });
}

// Função para controlar velocidade de reprodução
function changePlaybackRate(selectElement, audioFile) {
    const rate = parseFloat(selectElement.value);
    console.log('🎵 Alterando velocidade para:', rate + 'x');
    
    // Encontrar o elemento de áudio correspondente
    const audioElement = selectElement.closest('.menu-card').querySelector('audio');
    if (audioElement) {
        audioElement.playbackRate = rate;
        console.log('✅ Velocidade alterada para:', rate + 'x');
    }
}

function playRealPodcast(audioFile, title) {
    // Função antiga mantida para compatibilidade
    console.log('🎵 Tocando podcast (método antigo):', title);
    const audio = new Audio(audioFile);
    audio.play().catch(error => {
        console.error('❌ Erro:', error);
        showToast('Erro ao tocar áudio', 'error');
    });
}

function playPodcast(id) {
    console.log('Tocando podcast:', id);
    showToast('Iniciando podcast...', 'info');
    // Função antiga mantida para compatibilidade
}

function downloadPodcast(id) {
    console.log('Baixando podcast:', id);
    showToast('Iniciando download...', 'info');
    // Implementar download
}

// Nova função: Escolher entre Quiz ou Podcasts
function showROPsChoiceMenu(areaKey) {
    const area = window.ropsData[areaKey];
    if (!area) return;
    
    
    const section = document.getElementById('painelSection');
    if (!section) return;
    
    // Contar questões e podcasts
    let totalQuestions = 0;
    if (area.subdivisoes) {
        Object.values(area.subdivisoes).forEach(rop => {
            if (rop.questions) totalQuestions += rop.questions.length;
        });
    }
    
    // Mapeamento de chaves alternativas (compatibilidade com cache antigo)
    const keyMapping = {
        'vida-profissional-e-força-de-trabalho': 'vida-profissional',
        'avaliação-de-risco': 'avaliacao-riscos'
    };
    
    // Debug: verificar se podcastsData existe
    console.log('🔍 window.podcastsData existe?', !!window.podcastsData);
    if (window.podcastsData) {
        console.log('🔍 Chaves disponíveis:', Object.keys(window.podcastsData));
        console.log('🔍 Total de podcasts:', Object.values(window.podcastsData).reduce((sum, cat) => sum + (cat.audios?.length || 0), 0));
    }
    
    // Buscar podcasts diretamente pela chave
    let podcastsArea = window.podcastsData?.[areaKey];
    console.log('🔍 podcastsArea para', areaKey, ':', !!podcastsArea);
    
    // Se não encontrou, tentar chaves alternativas
    if (!podcastsArea) {
        const alternativeKeys = {
            'vida-profissional-e-força-de-trabalho': 'vida-profissional',
            'avaliação-de-risco': 'avaliacao-riscos',
            'cultura-de-seguranca': 'cultura-seguranca',
            'comunicacao': 'comunicacao',
            'uso-de-medicamentos': 'uso-medicamentos',
            'prevenção-de-infeccoes': 'prevencao-infeccoes'
        };
        
        const altKey = alternativeKeys[areaKey];
        if (altKey) {
            podcastsArea = window.podcastsData?.[altKey];
            console.log('🔄 Tentando chave alternativa:', altKey, 'Resultado:', !!podcastsArea);
        }
    }
    
    const podcasts = podcastsArea?.audios || [];
    console.log('🎧 Podcasts encontrados para', areaKey, ':', podcasts.length);
    if (podcasts.length > 0) {
        console.log('🎧 Primeiro podcast:', podcasts[0].title);
    } else {
        console.log('❌ Nenhum podcast encontrado para', areaKey);
        console.log('🔍 Chaves disponíveis no podcastsData:', Object.keys(window.podcastsData || {}));
    }
    
    // Extrair primeira cor do gradient ou usar cor sólida
    let primaryColor = '#004225';
    if (area.color) {
        // Se for um gradient, extrair a primeira cor hexadecimal (antes do espaço ou %)
        const gradientMatch = area.color.match(/linear-gradient\([^)]*?#([A-F0-9]{6})(?:\s|%)/i);
        if (gradientMatch) {
            primaryColor = '#' + gradientMatch[1];
        } else {
            // Se não for gradient, tentar extrair cor hexadecimal direta
            const colorMatch = area.color.match(/#[A-F0-9]{6}/i);
            if (colorMatch) {
                primaryColor = colorMatch[0];
            }
        }
    }
    console.log(`🎨 [DEBUG] Área: ${areaKey}, Cor extraída: ${primaryColor}, Cor original: ${area.color}`);
    
    // Mapeamento de ícones FontAwesome por área ROPs
    const areaIcons = {
        'cultura-seguranca': 'fa-shield-alt',
        'comunicacao': 'fa-comments',
        'uso-medicamentos': 'fa-pills',
        'vida-profissional': 'fa-users',
        'prevencao-infeccoes': 'fa-hand-sparkles',
        'avaliacao-riscos': 'fa-exclamation-triangle'
    };
    
    const areaIcon = areaIcons[areaKey] || 'fa-circle';
    
    // Setup preferências globais de áudio (sem quebrar versões antigas)
    if (typeof window.USE_STORAGE_AUDIO === 'undefined') {
        window.USE_STORAGE_AUDIO = true; // preferir Firebase Storage se os arquivos já estiverem lá
    }
    if (typeof window.FIREBASE_STORAGE_BUCKET === 'undefined') {
        window.FIREBASE_STORAGE_BUCKET = 'anest-ap.appspot.com';
    }

    const html = `
        ${renderInfoBanner('fas fa-graduation-cap', `${area.title}`, 'Escolha entre questões interativas ou podcasts educativos sobre esta área', area.color.replace('linear-gradient(135deg, ', '').replace(')', ''), 'showROPsDesafio()')}
        
        <div class="protocols-grid">
            <div class="protocol-card" onclick="showROPsSubdivisoes('${areaKey}')" style="cursor: pointer;">
                <div class="protocol-icon" style="background: ${area.color}">
                    <i class="fas fa-file-alt"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title" style="color: ${primaryColor} !important;">Questões</h3>
                </div>
            </div>
            
            <div class="protocol-card ${podcasts.length === 0 ? '' : ''}" onclick="${podcasts.length > 0 ? `showROPsPodcasts('${areaKey}')` : 'showToast(\'Em breve\', \'info\')'}" style="cursor: pointer; ${podcasts.length === 0 ? 'opacity: 0.6;' : ''}">
                <div class="protocol-icon" style="background: ${area.color}">
                    <i class="fas fa-headphones"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title" style="color: ${primaryColor} !important;">Podcasts</h3>
                </div>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
}

function showROPsSubdivisoes(areaKey) {
    const area = window.ropsData[areaKey];
    if (!area) return;
    
    console.log('📚 Mostrando subdivisões de:', area.title);
    
    const section = document.getElementById('painelSection');
    if (!section) return;
    
    const subdivisoes = Object.entries(area.subdivisoes || {});
    
    const html = `
        ${renderInfoBanner('fas fa-question-circle', `${area.title} - Questões`, 'Escolha uma ROP específica para começar o quiz e testar seus conhecimentos', area.color.replace('linear-gradient(135deg, ', '').replace(')', ''), `showROPsChoiceMenu('${areaKey}')`)}
        
        <div class="protocols-grid">
            ${subdivisoes.map(([ropKey, rop]) => {
                // Extrair primeira cor do gradient ou usar cor sólida
                let iconColor = '#004225';
                if (area.color) {
                    const gradientMatch = area.color.match(/linear-gradient\([^)]*?#([A-F0-9]{6})(?:\s|%)/i);
                    if (gradientMatch) {
                        iconColor = '#' + gradientMatch[1];
                    } else {
                        const colorMatch = area.color.match(/#[A-F0-9]{6}/i);
                        if (colorMatch) {
                            iconColor = colorMatch[0];
                        }
                    }
                }
                return `
                <div class="protocol-card" onclick="startQuiz('${areaKey}', '${ropKey}')" style="cursor: pointer;">
                    <div class="protocol-icon" style="background: ${area.color}">
                        <i class="fas fa-file-alt"></i>
                    </div>
                    <div class="protocol-content">
                        <h3 class="protocol-title" style="color: ${iconColor} !important;">${rop.title}</h3>
                    </div>
                </div>
            `;
            }).join('')}
        </div>
    `;
    
    section.innerHTML = html;
}

function showROPsPodcasts(areaKey) {
    const area = window.ropsData[areaKey];
    
    // Mapeamento de chaves alternativas (mesma lógica do showROPsChoiceMenu)
    const keyMapping = {
        'vida-profissional-e-força-de-trabalho': 'vida-profissional',
        'avaliação-de-risco': 'avaliacao-riscos'
    };
    
    // Tentar encontrar a área com a chave correta ou alternativa
    let podcastsArea = window.podcastsData?.[areaKey];
    
    if (!podcastsArea && keyMapping[areaKey]) {
        podcastsArea = window.podcastsData?.[keyMapping[areaKey]];
    }
    
    if (!area || !podcastsArea) {
        showToast(`Podcasts não encontrados para ${area?.title || areaKey}`, 'error');
        return;
    }
    
    console.log('🎧 Mostrando podcasts de:', area.title);
    
    const section = document.getElementById('painelSection');
    if (!section) return;
    
    const podcasts = podcastsArea.audios || [];
    
    console.log('🔍 Debug - areaKey:', areaKey);
    console.log('🔍 Debug - podcastsArea:', podcastsArea);
    console.log('🔍 Debug - podcasts encontrados:', podcasts.length);
    
    if (podcasts.length === 0) {
        console.warn('⚠️ Nenhum podcast encontrado para área:', areaKey);
        showToast('Nenhum podcast disponível para esta área', 'info');
    }
    
    // Função para escapar HTML e garantir URLs corretas
    const escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };
    
    const html = `
        ${renderInfoBanner('fas fa-headphones', `${area.title} - Podcasts`, 'Ouça podcasts sobre as ROPs desta área e aprenda no seu ritmo', area.color.replace('linear-gradient(135deg, ', '').replace(')', ''), `showROPsChoiceMenu('${areaKey}')`)}
        
        <div class="protocols-grid" id="podcasts-container-${areaKey}">
            <!-- Podcasts serão inseridos aqui dinamicamente -->
        </div>
    `;
    
    section.innerHTML = html;
    
    // Criar elementos de áudio dinamicamente para garantir URLs corretas
    const container = section.querySelector(`#podcasts-container-${areaKey}`);
    if (!container) {
        console.error('❌ Container de podcasts não encontrado');
        return;
    }
    
    podcasts.forEach((podcast, index) => {
        const audioUrl = podcast.file || podcast.audioFile || '';
        console.log(`🔍 Criando podcast ${index}: ${podcast.title}`);
        console.log(`🔍 URL: ${audioUrl.substring(0, 100)}...`);
        
        if (!audioUrl) {
            console.error('❌ Podcast sem URL:', podcast);
            return;
        }
        
        // Criar card
        const card = document.createElement('div');
        card.className = 'protocol-card';
        card.style.cssText = 'cursor: default; flex-direction: column; align-items: stretch;';
        
        // Criar header do card
        const header = document.createElement('div');
        header.style.cssText = 'display: flex; align-items: center; gap: 16px; margin-bottom: 16px;';
        
        const iconDiv = document.createElement('div');
        iconDiv.className = 'protocol-icon';
        iconDiv.style.cssText = `background: ${area.color.match(/#[A-F0-9]{6}/i)?.[0] || '#004225'}; margin: 0;`;
        iconDiv.innerHTML = '<i class="fas fa-headphones"></i>';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'protocol-content';
        contentDiv.style.cssText = 'flex: 1; margin: 0;';
        
        const title = document.createElement('h3');
        title.className = 'protocol-title';
        // Extrair primeira cor do gradient ou usar cor sólida
        let iconColor = '#004225';
        if (area.color) {
            const gradientMatch = area.color.match(/linear-gradient\([^)]*?#([A-F0-9]{6})(?:\s|%)/i);
            if (gradientMatch) {
                iconColor = '#' + gradientMatch[1];
            } else {
                const colorMatch = area.color.match(/#[A-F0-9]{6}/i);
                if (colorMatch) {
                    iconColor = colorMatch[0];
                }
            }
        }
        title.style.cssText = `margin: 0; color: ${iconColor} !important;`;
        title.textContent = podcast.title;
        
        contentDiv.appendChild(title);
        
        header.appendChild(iconDiv);
        header.appendChild(contentDiv);
        
        // Criar wrapper para o player de áudio com estilo simples (sem bordas)
        const audioWrapper = document.createElement('div');
        audioWrapper.className = 'podcast-audio-wrapper';
        audioWrapper.style.cssText = `
            width: 100%;
            background: transparent;
            border: none;
            padding: 0;
            margin-top: 8px;
        `;
        
        // Criar elemento de áudio com estilos inline para garantir aplicação
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.controlsList = 'nodownload';
        audio.preload = 'metadata';
        audio.className = 'podcast-audio-player';
        audio.setAttribute('data-podcast-index', index);
        
        // Aplicar estilos inline diretamente para remover TODOS os contornos
        audio.style.cssText = `
            width: 100%;
            outline: none !important;
            border: none !important;
            box-shadow: none !important;
            -webkit-box-shadow: none !important;
            background: transparent !important;
            -webkit-appearance: none !important;
            -moz-appearance: none !important;
            appearance: none !important;
            filter: none !important;
            -webkit-filter: none !important;
        `;
        
            // Adicionar estilos após inserir no DOM para garantir remoção completa
            setTimeout(() => {
                // Forçar remoção de TODOS os contornos e sombras
                const props = ['outline', 'border', 'box-shadow', '-webkit-box-shadow', 'background', 'filter', '-webkit-filter'];
                props.forEach(prop => {
                    audio.style.setProperty(prop, prop.includes('background') ? 'transparent' : 'none', 'important');
                });
                
                // Adicionar estilo global mais agressivo via tag style
                if (!document.getElementById('podcast-audio-no-contours')) {
                    // Detectar modo escuro
                    const isDarkMode = document.body.classList.contains('dark-mode');
                    
                    // Modo Claro: Círculo branco com seta preta
                    // Modo Escuro: Círculo verde (#1a3329 - cor do card) com seta branca
                    const playIconColor = isDarkMode ? 'white' : 'black';
                    const playBgColor = isDarkMode ? '#1a3329' : '#FFFFFF'; // Verde do card no modo escuro
                    const playIconSvg = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="' + playIconColor + '"><path d="M8 5v14l11-7z"/></svg>');
                    
                    const darkModeStyles = isDarkMode ? `
                        audio.podcast-audio-player::-webkit-media-controls-current-time-display,
                        audio.podcast-audio-player::-webkit-media-controls-time-remaining-display {
                            color: #FFFFFF !important;
                            text-shadow: none !important;
                            -webkit-text-stroke: 0 !important;
                        }
                        audio.podcast-audio-player::-webkit-media-controls-mute-button {
                            color: #FFFFFF !important;
                            text-shadow: none !important;
                            -webkit-text-stroke: 0 !important;
                        }
                        audio.podcast-audio-player::-webkit-media-controls-timeline::-webkit-slider-thumb {
                            background-color: #FFFFFF !important;
                        }
                    ` : '';
                    
                    const globalStyle = document.createElement('style');
                    globalStyle.id = 'podcast-audio-no-contours';
                    globalStyle.textContent = `
                        audio.podcast-audio-player,
                        .podcast-audio-wrapper audio,
                        .protocol-card audio.podcast-audio-player {
                            border: none !important;
                            outline: none !important;
                            box-shadow: none !important;
                            -webkit-box-shadow: none !important;
                            background: transparent !important;
                            -webkit-appearance: none !important;
                            -moz-appearance: none !important;
                            appearance: none !important;
                            filter: none !important;
                            -webkit-filter: none !important;
                        }
                        audio.podcast-audio-player::-webkit-media-controls-enclosure,
                        .podcast-audio-wrapper audio::-webkit-media-controls-enclosure {
                            border: none !important;
                            outline: none !important;
                            box-shadow: none !important;
                            -webkit-box-shadow: none !important;
                            background: transparent !important;
                            border-radius: 0 !important;
                            padding: 0 !important;
                            margin: 0 !important;
                        }
                        audio.podcast-audio-player::-webkit-media-controls-panel,
                        .podcast-audio-wrapper audio::-webkit-media-controls-panel {
                            border: none !important;
                            outline: none !important;
                            box-shadow: none !important;
                            -webkit-box-shadow: none !important;
                            background: transparent !important;
                            border-radius: 0 !important;
                        }
                        audio.podcast-audio-player::-webkit-media-controls-play-button {
                            border: none !important;
                            outline: none !important;
                            box-shadow: none !important;
                            -webkit-box-shadow: none !important;
                            background-color: ` + playBgColor + ` !important;
                            background-image: url("data:image/svg+xml,` + playIconSvg + `") !important;
                            background-size: 14px 14px !important;
                            background-position: center !important;
                            background-repeat: no-repeat !important;
                            display: inline-block !important;
                            visibility: visible !important;
                            opacity: 1 !important;
                            -webkit-appearance: media-play-button !important;
                            appearance: media-play-button !important;
                        }
                        ` + darkModeStyles + `
                        audio.podcast-audio-player::-webkit-media-controls-timeline {
                            background-color: transparent !important;
                            border: none !important;
                        }
                        audio.podcast-audio-player::-webkit-media-controls-volume-slider {
                            background-color: transparent !important;
                            border: none !important;
                        }
                    `;
                    document.head.appendChild(globalStyle);
                }
            }, 300);
        
        // Criar sources com URLs corretas
        const source1 = document.createElement('source');
        source1.src = audioUrl;
        source1.type = 'audio/x-m4a';
        
        const source2 = document.createElement('source');
        source2.src = audioUrl;
        source2.type = 'audio/mp4';
        
        const source3 = document.createElement('source');
        source3.src = audioUrl;
        source3.type = 'audio/mpeg';
        
        audio.appendChild(source1);
        audio.appendChild(source2);
        audio.appendChild(source3);
        
        // Adicionar o áudio ao wrapper
        audioWrapper.appendChild(audio);
        
        // Adicionar listeners
        audio.addEventListener('error', (e) => {
            console.error(`❌ Erro ao carregar áudio ${index}:`, e);
            console.error(`❌ URL que falhou:`, audioUrl);
            console.error(`❌ Podcast:`, podcast);
            showToast(`Erro ao carregar áudio: ${podcast.title}`, 'error');
        });
        
        audio.addEventListener('loadedmetadata', () => {
            console.log(`✅ Áudio ${index} carregado:`, podcast.title);
        });
        
        audio.addEventListener('canplay', () => {
            console.log(`✅ Áudio ${index} pronto para tocar:`, podcast.title);
        });
        
        // Montar card
        card.appendChild(header);
        card.appendChild(audioWrapper);
        container.appendChild(card);
    });
}


function startQuiz(areaKey, ropKey) {
    const area = window.ropsData[areaKey];
    const rop = area?.subdivisoes?.[ropKey];
    
    if (!rop || !rop.questions || rop.questions.length === 0) {
        showToast('Nenhuma questão disponível para esta ROP', 'error');
        return;
    }
    
    // Inicializar estado do quiz
    currentQuizState = {
        area: area.title,
        areaKey: areaKey,
        rop: rop.title,
        ropKey: ropKey,
        questions: [...rop.questions], // Copiar array
        currentQuestion: 0,
        score: 0,
        answers: []
    };
    
    console.log('🎯 Iniciando quiz:', rop.title, '-', rop.questions.length, 'questões');
    
    showQuizQuestion();
}

function showQuizQuestion() {
    const section = document.getElementById('painelSection');
    if (!section) return;
    
    const state = currentQuizState;
    const question = state.questions[state.currentQuestion];
    const progress = ((state.currentQuestion + 1) / state.questions.length) * 100;
    
    const html = `
        ${renderInfoBanner('fas fa-question-circle', state.rop, state.area, '#7c3aed 0%, #a855f7 100%', `showROPsSubdivisoes('${state.areaKey}')`)}
        
        <div class="quiz-container">
            <div class="quiz-header">
                <h2 style="display: none;">${state.rop}</h2>
                <p class="quiz-subtitle" style="display: none;">${state.area}</p>
            </div>
            
            <div class="quiz-progress-container">
                <div class="quiz-progress-bar" style="width: ${progress}%"></div>
                <span class="quiz-progress-text">Questão ${state.currentQuestion + 1} de ${state.questions.length}</span>
            </div>
            
            <div class="quiz-score">
                <i class="fas fa-star"></i> ${state.score} pontos
            </div>
            
            <div class="quiz-question">
                <h3>${question.question}</h3>
            </div>
            
            <div class="quiz-options">
                ${question.options.map((option, index) => `
                    <button class="quiz-option" onclick="answerQuestion(${index})">
                        <span class="option-letter">${String.fromCharCode(65 + index)}</span>
                        <span class="option-text">${option}</span>
                    </button>
                `).join('')}
            </div>
        </div>
    `;
    
    section.innerHTML = html;
}

function answerQuestion(selectedIndex) {
    const state = currentQuizState;
    const question = state.questions[state.currentQuestion];
    const isCorrect = selectedIndex === question.correctAnswer;
    
    if (isCorrect) {
        state.score += 10;
    }
    
    state.answers.push({
        question: question.question,
        selected: selectedIndex,
        correct: question.correctAnswer,
        isCorrect: isCorrect
    });
    
    showQuizFeedback(selectedIndex, isCorrect, question);
}

function showQuizFeedback(selectedIndex, isCorrect, question) {
    const section = document.getElementById('painelSection');
    if (!section) return;
    
    const state = currentQuizState;
    const progress = ((state.currentQuestion + 1) / state.questions.length) * 100;
    
    const html = `
        ${renderInfoBanner('fas fa-question-circle', state.rop, state.area, '#7c3aed 0%, #a855f7 100%', `showROPsSubdivisoes('${state.areaKey}')`)}
        
        <div class="quiz-container">
            <div class="quiz-header" style="display: none;">
                <h2>${state.rop}</h2>
                <p class="quiz-subtitle">${state.area}</p>
            </div>
            
            <div class="quiz-progress-container">
                <div class="quiz-progress-bar" style="width: ${progress}%"></div>
                <span class="quiz-progress-text">Questão ${state.currentQuestion + 1} de ${state.questions.length}</span>
            </div>
            
            <div class="quiz-score">
                <i class="fas fa-star"></i> ${state.score} pontos
            </div>
            
            <div class="quiz-feedback ${isCorrect ? 'correct' : 'incorrect'}">
                <div class="feedback-icon">
                    <i class="fas fa-${isCorrect ? 'check-circle' : 'times-circle'}"></i>
                </div>
                <h3>${isCorrect ? 'Correto!' : 'Incorreto!'}</h3>
                ${!isCorrect ? `<p class="correct-answer">Resposta correta: <strong>${question.options[question.correctAnswer]}</strong></p>` : ''}
                <p class="explanation">${question.explanation}</p>
            </div>
            
            <button class="btn-primary btn-large" onclick="nextQuestion()">
                ${state.currentQuestion + 1 < state.questions.length ? 'Próxima Questão' : 'Ver Resultado'}
                <i class="fas fa-arrow-right"></i>
            </button>
        </div>
    `;
    
    section.innerHTML = html;
}

function nextQuestion() {
    currentQuizState.currentQuestion++;
    
    if (currentQuizState.currentQuestion < currentQuizState.questions.length) {
        showQuizQuestion();
    } else {
        showQuizResults();
    }
}

async function showQuizResults() {
    const section = document.getElementById('painelSection');
    if (!section) return;
    
    const state = currentQuizState;
    const totalQuestions = state.questions.length;
    const correctAnswers = state.answers.filter(a => a.isCorrect).length;
    const percentage = (correctAnswers / totalQuestions) * 100;
    
    let performance = '';
    let performanceClass = '';
    if (percentage >= 90) {
        performance = 'Excelente!';
        performanceClass = 'excellent';
    } else if (percentage >= 70) {
        performance = 'Muito Bom!';
        performanceClass = 'good';
    } else if (percentage >= 50) {
        performance = 'Bom!';
        performanceClass = 'average';
    } else {
        performance = 'Continue Estudando!';
        performanceClass = 'needs-improvement';
    }
    
    const html = `
        ${renderInfoBanner('fas fa-trophy', 'Quiz Concluído!', state.rop, '#f59e0b 0%, #d97706 100%', `showROPsSubdivisoes('${state.areaKey}')`)}
        
        <div class="quiz-results">
            <div class="results-header">
                <i class="fas fa-trophy results-trophy"></i>
                <h2 style="display: none;">Quiz Concluído!</h2>
                <h3 style="display: none;">${state.rop}</h3>
            </div>
            
            <div class="results-performance ${performanceClass}">
                <h1>${performance}</h1>
            </div>
            
            <div class="results-stats">
                <div class="result-stat">
                    <h3>${correctAnswers}</h3>
                    <p>Acertos</p>
            </div>
                <div class="result-stat">
                    <h3>${totalQuestions - correctAnswers}</h3>
                    <p>Erros</p>
                </div>
                <div class="result-stat">
                    <h3>${percentage.toFixed(0)}%</h3>
                    <p>Aproveitamento</p>
                </div>
                <div class="result-stat highlight">
                    <h3>${state.score}</h3>
                    <p>Pontos</p>
                </div>
            </div>
            
            <div class="results-actions">
                <button class="btn-primary" onclick="showROPsDesafio()">
                    <i class="fas fa-home"></i> para Áreas
                </button>
                <button class="btn-secondary" onclick="startQuiz('${Object.keys(window.ropsData).find(k => window.ropsData[k].title === state.area)}', '${Object.keys(window.ropsData[Object.keys(window.ropsData).find(k => window.ropsData[k].title === state.area)].subdivisoes).find(k => window.ropsData[Object.keys(window.ropsData).find(k => window.ropsData[k].title === state.area)].subdivisoes[k].title === state.rop)}')">
                    <i class="fas fa-redo"></i> Refazer Quiz
                </button>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
    
    // Salvar progresso no Firestore
    await saveQuizProgress(state.area, state.rop, correctAnswers, totalQuestions, state.score);
    
    // Atualizar pendências após completar quiz
    setTimeout(async () => {
        if (typeof loadPendenciasCompletas === 'function') {
            await loadPendenciasCompletas();
        }
        if (typeof atualizarContadorPendencias === 'function') {
            await atualizarContadorPendencias();
        }
    }, 500);
    
    showToast(`Quiz concluído! ${correctAnswers}/${totalQuestions} acertos`, 'success');
}

// ==================== RANKING SYSTEM ====================
async function saveQuizProgress(area, rop, correctAnswers, totalQuestions, score) {
    if (!currentUser) return;
    
    try {
        const userRef = db.collection('users').doc(currentUser.uid);
        const userDoc = await userRef.get();
        
        let userData = userDoc.data() || { totalScore: 0, quizzesCompleted: 0, correctAnswers: 0, totalAnswers: 0 };
        
        // Atualizar estatísticas gerais
        userData.totalScore = (userData.totalScore || 0) + score;
        userData.quizzesCompleted = (userData.quizzesCompleted || 0) + 1;
        userData.correctAnswers = (userData.correctAnswers || 0) + correctAnswers;
        userData.totalAnswers = (userData.totalAnswers || 0) + totalQuestions;
        userData.lastActivity = new Date().toISOString();
        userData.displayName = currentUser.displayName || currentUser.email;
        
        // Atualizar progresso por área
        if (!userData.areaProgress) userData.areaProgress = {};
        if (!userData.areaProgress[area]) userData.areaProgress[area] = { completed: 0, score: 0 };
        userData.areaProgress[area].completed++;
        userData.areaProgress[area].score += score;
        
        await userRef.set(userData, { merge: true });
        
        // Também atualizar userProfile.progress para o sistema de pendências
        try {
            // Encontrar a macroKey correspondente ao area
            let macroKey = null;
            if (typeof window.ropsData !== 'undefined' && window.ropsData) {
                for (const key in window.ropsData) {
                    if (window.ropsData[key].title === area) {
                        macroKey = key;
                        break;
                    }
                }
            }
            
            if (macroKey) {
                // Encontrar a ropKey correspondente ao rop
                let ropKey = null;
                if (window.ropsData && window.ropsData[macroKey] && window.ropsData[macroKey].subdivisoes) {
                    for (const key in window.ropsData[macroKey].subdivisoes) {
                        if (window.ropsData[macroKey].subdivisoes[key].title === rop) {
                            ropKey = key;
                            break;
                        }
                    }
                }
                
                if (ropKey && correctAnswers >= Math.ceil(totalQuestions * 0.7)) {
                    // Marcar como completa apenas se acertou 70% ou mais
                    const userProfileRef = db.collection('userProfiles').doc(currentUser.uid);
                    const userProfileDoc = await userProfileRef.get();
                    
                    if (userProfileDoc.exists) {
                        const profileData = userProfileDoc.data();
                        if (!profileData.progress) profileData.progress = {};
                        if (!profileData.progress[macroKey]) profileData.progress[macroKey] = {};
                        profileData.progress[macroKey][ropKey] = true;
                        
                        await userProfileRef.update({
                            progress: profileData.progress
                        });
                        
                        // Atualizar userProfile local
                        if (userProfile) {
                            if (!userProfile.progress) userProfile.progress = {};
                            if (!userProfile.progress[macroKey]) userProfile.progress[macroKey] = {};
                            userProfile.progress[macroKey][ropKey] = true;
                        }
                    }
                }
            }
        } catch (profileError) {
            console.warn('⚠️ Erro ao atualizar userProfile.progress:', profileError);
        }
        
        console.log('✅ Progresso salvo no Firestore');
    } catch (error) {
        console.error('❌ Erro ao salvar progresso:', error);
    }
}

async function showROPsRanking() {
    console.log('🏆 Mostrando Ranking');
    showLoading();
    
    try {
        // Buscar top 10 usuários
        const snapshot = await db.collection('users')
            .orderBy('totalScore', 'desc')
            .limit(10)
            .get();
        
        const rankings = [];
        snapshot.forEach(doc => {
            rankings.push({ id: doc.id, ...doc.data() });
        });
        
        // Buscar dados do usuário atual
        const currentUserDoc = await db.collection('users').doc(currentUser.uid).get();
        const currentUserData = currentUserDoc.data() || { totalScore: 0, quizzesCompleted: 0, correctAnswers: 0, totalAnswers: 0 };
        
        // Encontrar posição do usuário atual
        const allUsers = await db.collection('users').orderBy('totalScore', 'desc').get();
        let userPosition = 0;
        allUsers.forEach((doc, index) => {
            if (doc.id === currentUser.uid) {
                userPosition = index + 1;
            }
        });
        
        hideLoading();
        
        const section = document.getElementById('painelSection');
        if (!section) return;
        
        const accuracy = currentUserData.totalAnswers > 0 
            ? ((currentUserData.correctAnswers / currentUserData.totalAnswers) * 100).toFixed(1)
            : 0;
        
        const html = `
            ${renderInfoBanner('fas fa-trophy', 'Ranking ROPs', 'Os melhores no desafio Qmentum', '#f59e0b 0%, #d97706 100%', 'showROPsDesafio()')}
            
            <!-- Estatísticas do Usuário Atual -->
            <div class="user-stats-card">
                <div class="user-stats-header">
                    <div class="user-avatar">
                        <i class="fas fa-user"></i>
            </div>
                    <div class="user-info">
                        <h3>${currentUser.displayName || 'Usuário'}</h3>
                        <p>Posição: #${userPosition}</p>
            </div>
            </div>
                <div class="user-stats-grid">
                    <div class="user-stat">
                        <i class="fas fa-trophy"></i>
                        <h4>${currentUserData.totalScore || 0}</h4>
                        <p>Pontos</p>
            </div>
                    <div class="user-stat">
                        <i class="fas fa-check-circle"></i>
                        <h4>${currentUserData.quizzesCompleted || 0}</h4>
                        <p>Quizzes</p>
            </div>
                    <div class="user-stat">
                        <i class="fas fa-percent"></i>
                        <h4>${accuracy}%</h4>
                        <p>Acertos</p>
        </div>
            </div>
            </div>
            
            <!-- Top 10 -->
            <h2 style="margin: 32px 0 16px 0; font-size: 1.5rem;">🌟 Top 10</h2>
            <div class="ranking-list">
                ${rankings.map((user, index) => {
                    const userAccuracy = user.totalAnswers > 0 
                        ? ((user.correctAnswers / user.totalAnswers) * 100).toFixed(0)
                        : 0;
                    
                    let medal = '';
                    if (index === 0) medal = '🥇';
                    else if (index === 1) medal = '🥈';
                    else if (index === 2) medal = '🥉';
                    
                    const isCurrentUser = user.id === currentUser.uid;
                    
                    return `
                        <div class="ranking-item ${isCurrentUser ? 'current-user' : ''}">
                            <div class="ranking-position">
                                <span class="position-number">${medal || `#${index + 1}`}</span>
            </div>
                            <div class="ranking-user">
                                <div class="user-avatar-small">
                                    <i class="fas fa-user"></i>
            </div>
                                <div>
                                    <h4>${user.displayName || 'Usuário ' + (index + 1)}</h4>
                                    <p>${user.quizzesCompleted || 0} quizzes • ${userAccuracy}% acertos</p>
        </div>
            </div>
                            <div class="ranking-score">
                                <h3>${user.totalScore || 0}</h3>
                                <p>pontos</p>
            </div>
            </div>
                    `;
                }).join('')}
            </div>
        `;
        
        section.innerHTML = html;
        
    } catch (error) {
        hideLoading();
        console.error('❌ Erro ao buscar ranking:', error);
        showToast('Erro ao carregar ranking', 'error');
    }
}

function showResidencia() {
    console.log('🧑‍⚕️ Residência clicado');
    
    // Atualizar histórico de navegação
    atualizarHistoricoNavegacao('residencia');
    
    showToast('Funcionalidade em desenvolvimento', 'info');
}

function showGestaoIncidentes() {
    console.log('⚠️ Gestão de Incidentes clicado');
    // Redirecionar para showIncidentes que é a função real implementada
    if (typeof showIncidentes === 'function') {
        // Garantir que a seção qualidade está ativa primeiro
        if (typeof showSection === 'function') {
            showSection('qualidade');
        }
        setTimeout(() => {
            showIncidentes();
        }, 150);
    } else {
        showToast('Erro: Função de incidentes não disponível', 'error');
    }
}

// Funções movidas para painel-qualidade.js

async function showBiblioteca() {
    console.log('📚 Biblioteca clicado');
    
    // Atualizar histórico de navegação
    atualizarHistoricoNavegacao('biblioteca');
    
    // Verificar permissões de admin
    const isAdmin = typeof checkUserRole === 'function' ?
        await checkUserRole(['Administrador', 'Coordenador']) : false;
    console.log('🔍 showBiblioteca - isAdmin:', isAdmin);
    
    // Verificar se os dados estão disponíveis
    if (!window.documentsData) {
        showToast('Erro: Dados de documentos não carregados', 'error');
        console.error('documentsData não está disponível');
        return;
    }
    
    // COMBINAR TODOS OS DOCUMENTOS (protocolos, formularios, manuais, etc)
    const todosDocumentos = [];
    
    // Adicionar protocolos
    if (window.documentsData.protocolos) {
        todosDocumentos.push(...window.documentsData.protocolos);
    }
    
    // Adicionar formulários
    if (window.documentsData.formularios) {
        window.documentsData.formularios.forEach(doc => {
            todosDocumentos.push({
                ...doc,
                categoria: doc.categoria || 'Formulários'
            });
        });
    }
    
    // Adicionar manuais
    if (window.documentsData.manuais) {
        window.documentsData.manuais.forEach(doc => {
            todosDocumentos.push({
                ...doc,
                categoria: doc.categoria || 'Manuais'
            });
        });
    }
    
    // Adicionar outros tipos de documentos que possam existir
    Object.keys(window.documentsData).forEach(key => {
        if (key !== 'protocolos' && key !== 'formularios' && key !== 'manuais') {
            const docs = window.documentsData[key];
            if (Array.isArray(docs)) {
                docs.forEach(doc => {
                    todosDocumentos.push({
                        ...doc,
                        categoria: doc.categoria || key.charAt(0).toUpperCase() + key.slice(1)
                    });
                });
            }
        }
    });
    
    // Carregar documentos adicionados do Firestore
    try {
        const snapshot = await db.collection('biblioteca_documentos')
            .where('ativo', '==', true)
            .get();
        
        snapshot.forEach(doc => {
            const data = doc.data();
            // Verificar se arquivo existe e tem URL válida
            let fileUrl = '';
            if (data.arquivo && data.arquivo.url) {
                fileUrl = data.arquivo.url;
            } else if (typeof data.arquivo === 'string') {
                // Fallback: se arquivo for string direta
                fileUrl = data.arquivo;
            }
            
            todosDocumentos.push({
                title: data.titulo,
                codigo: data.codigo || 'Sem código',
                file: fileUrl,
                categoria: data.categoria || 'Outros',
                descricao: data.descricao || '',
                isFromFirestore: true,
                firestoreId: doc.id,
                storagePath: data.arquivo?.storagePath || '',
                arquivoNome: data.arquivo?.nome || '',
                arquivoTipo: data.arquivo?.nome ? data.arquivo.nome.split('.').pop().toLowerCase() : ''
            });
        });
        console.log(`✅ ${snapshot.size} documentos adicionados do Firestore`);
    } catch (error) {
        console.error('⚠️ Erro ao carregar documentos do Firestore:', error);
    }
    
    console.log(`✅ ${todosDocumentos.length} documentos disponíveis no total`);
    
    // Criar tela de biblioteca
    const section = document.getElementById('protocolosSection');
    if (!section) return;
    
    // Agrupar por categoria e remover duplicatas (preferir PDFs)
    const categorias = {};
    const documentosPorTitulo = {}; // Para detectar duplicatas
    
    todosDocumentos.forEach(doc => {
        const cat = doc.categoria || 'Outros';
        if (!categorias[cat]) categorias[cat] = [];
        
        // Normalizar título para detectar duplicatas
        const tituloNormalizado = doc.title.toLowerCase().trim();
        
        // Se já existe um documento com mesmo título
        if (documentosPorTitulo[tituloNormalizado]) {
            const existente = documentosPorTitulo[tituloNormalizado];
            const existenteIsPDF = existente.arquivoTipo === 'pdf';
            const novoIsPDF = doc.arquivoTipo === 'pdf';
            
            // Se o novo é PDF e o existente não é, substituir
            if (novoIsPDF && !existenteIsPDF) {
                // Remover o existente da lista
                const index = categorias[cat].indexOf(existente);
                if (index > -1) {
                    categorias[cat].splice(index, 1);
                }
                // Adicionar o novo
                categorias[cat].push(doc);
                documentosPorTitulo[tituloNormalizado] = doc;
            }
            // Se ambos são PDF ou ambos não são PDF, manter o primeiro
            // (não adicionar duplicata)
        } else {
            // Primeira ocorrência deste título
            categorias[cat].push(doc);
            documentosPorTitulo[tituloNormalizado] = doc;
        }
    });
    
    console.log('📁 Categorias encontradas:', Object.keys(categorias));
    console.log('📊 Documentos por categoria:', Object.entries(categorias).map(([cat, docs]) => `${cat}: ${docs.length}`));
    
    // Ordenar categorias alfabeticamente (sem números, usando nomes exatos das pastas)
    const categoriasOrdenadas = Object.entries(categorias).sort(([catA], [catB]) => {
        // Ordenar alfabeticamente ignorando maiúsculas/minúsculas
        return catA.toLowerCase().localeCompare(catB.toLowerCase(), 'pt-BR');
    });
    
    // Ordenar documentos dentro de cada categoria por título
    categoriasOrdenadas.forEach(([categoria, docs]) => {
        docs.sort((a, b) => {
            // Ordenar por código se existir, senão por título
            if (a.codigo && b.codigo) {
                return a.codigo.localeCompare(b.codigo);
            }
            if (a.codigo) return -1;
            if (b.codigo) return 1;
            return a.title.localeCompare(b.title, 'pt-BR');
        });
    });
    
    console.log('📋 Categorias ordenadas:', categoriasOrdenadas.map(([cat]) => cat));
    
    // Criar HTML - CARD INTEIRO CLICÁVEL (COM BOTÃO NOVO DOCUMENTO)
    const html = `
        ${renderInfoBanner('fas fa-book-open', 'Biblioteca de Documentos', 'Acesse todos os protocolos, formulários e documentos institucionais', '#006837 0%, #9BC53D 100%', "showSection('protocolos')")}
        ${isAdmin ? `<div style="margin-bottom: 20px; text-align: right;"><button class="btn-add" onclick="showModalNovoBibliotecaDocumento()" style="background: #006837; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; gap: 8px;"><i class="fas fa-plus"></i> Novo Documento</button></div>` : ''}
        
        <div class="search-container">
            <input type="text" 
                   id="searchDocs" 
                   class="search-input" 
                   placeholder="🔍 Buscar protocolo..."
                   onkeyup="filterDocuments()">
        </div>
        
        <div id="documentsContainer" class="documents-list">
            ${categoriasOrdenadas.map(([categoria, docs]) => `
                <div class="category-group">
                    <h2 class="category-title">${categoria}</h2>
                    <div class="docs-grid">
                        ${docs.map(doc => `
                            <div class="doc-card" data-title="${doc.title.toLowerCase()}" style="position: relative;">
                                <div onclick="openDocument('${doc.file.replace(/'/g, "\\'")}', '${doc.title.replace(/'/g, "\\'")}')" style="cursor: pointer; flex: 1;">
                                    <div class="doc-icon">
                                        <i class="fas fa-file-pdf"></i>
                                    </div>
                                    <div class="doc-info">
                                        <h3 class="doc-title">${doc.title}</h3>
                                        <p class="doc-codigo">${doc.codigo}</p>
                                    </div>
                                </div>
                                ${doc.isFromFirestore && isAdmin ? `
                                    <button onclick="event.stopPropagation(); excluirDocumentoBiblioteca('${doc.firestoreId}', '${doc.storagePath || ''}')" 
                                            style="position: absolute; top: 12px; right: 12px; background: #dc2626; color: white; border: none; width: 36px; height: 36px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; transition: all 0.3s; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);"
                                            onmouseover="this.style.background='#b91c1c'; this.style.transform='scale(1.1)'"
                                            onmouseout="this.style.background='#dc2626'; this.style.transform='scale(1)'"
                                            title="Excluir documento">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    section.innerHTML = html;

    return true; // Explicit success return
}

function filterDocuments() {
    const searchTerm = document.getElementById('searchDocs').value.toLowerCase().trim();
    const docCards = document.querySelectorAll('.doc-card');
    const categoryGroups = document.querySelectorAll('.category-group');
    const categoryTitles = document.querySelectorAll('.category-title');
    
    // Se não houver termo de busca, mostrar tudo normalmente
    if (!searchTerm) {
        docCards.forEach(card => {
            card.style.display = 'flex';
        });
        categoryGroups.forEach(group => {
            group.style.display = 'block';
        });
        categoryTitles.forEach(title => {
            title.style.display = 'block';
        });
        return;
    }
    
    // Ocultar todos os títulos de categoria durante a busca
    categoryTitles.forEach(title => {
        title.style.display = 'none';
    });
    
    // Filtrar documentos e ocultar grupos vazios
    let hasVisibleCards = false;
    
    docCards.forEach(card => {
        const title = card.getAttribute('data-title');
        if (title.includes(searchTerm)) {
            card.style.display = 'flex';
            hasVisibleCards = true;
        } else {
            card.style.display = 'none';
        }
    });
    
    // Ocultar grupos de categoria que não têm documentos visíveis
    categoryGroups.forEach(group => {
        const cardsInGroup = group.querySelectorAll('.doc-card');
        let hasVisibleCard = false;
        
        cardsInGroup.forEach(card => {
            const displayStyle = window.getComputedStyle(card).display;
            if (displayStyle !== 'none') {
                hasVisibleCard = true;
            }
        });
        
        if (!hasVisibleCard) {
            group.style.display = 'none';
        } else {
            group.style.display = 'block';
        }
    });
}

// Função auxiliar para normalizar URLs de documentos
function normalizeDocumentUrl(filePath) {
    if (!filePath || filePath === '' || filePath === '#') {
        return filePath;
    }

    // Se já for uma URL completa (HTTP ou Firebase Storage), retornar como está
    if (filePath.startsWith('http') || filePath.startsWith('firebasestorage')) {
        return filePath;
    }

    // CORREÇÃO: Usar origem atual para servir arquivos localmente
    // Se estiver em localhost:8000, servir de lá
    // Se estiver em anest-ap.web.app, servir de lá
    let baseUrl = window.location.origin;

    // Construir URL completa e codificar espaços e caracteres especiais
    let pathPart = filePath.startsWith('/') ? filePath : '/' + filePath;
    // CORREÇÃO PARA LOCALHOST: Adicionar /App/ quando necessário
    const isLocalhost = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');
    // Verificar se é um documento (contém Documentos) e não já tem /App/
    if (isLocalhost && !pathPart.startsWith('/App/') && pathPart.includes('Documentos')) {
        pathPart = '/App' + pathPart;
        console.log('🔧 LOCALHOST: Adicionado /App/ ao caminho do documento:', pathPart);
    }

    // Codificar o caminho corretamente (espaços viram %20, etc)
    // Dividir em partes para codificar apenas o caminho, não a barra inicial
    const pathParts = pathPart.split('/');
    const encodedParts = pathParts.map(part => {
        if (part === '') return ''; // Preservar barras
        return encodeURIComponent(part);
    });
    const encodedPath = encodedParts.join('/');

    const finalUrl = baseUrl + encodedPath;

    console.log('📍 URL normalizada:', {
        original: filePath,
        baseUrl: baseUrl,
        pathPart: pathPart,
        encodedPath: encodedPath,
        finalUrl: finalUrl
    });
    return finalUrl; // Explicit return with value
}

function openDocument(filePath, title) {
    console.log('📄 Abrindo documento:', title, 'em:', filePath);
    
    // Garantir que a busca continue funcionando após abrir documento
    // Limpar qualquer timeout pendente que possa estar bloqueando
    if (window.globalSearchTimeout) {
        clearTimeout(window.globalSearchTimeout);
        window.globalSearchTimeout = null;
    }
    
    // NOTA: Não limpar recursos PDF aqui - será feito dentro de carregarPDFComPDFJS()
    // para evitar conflitos de timing no desktop

    // ==================== TYPE VALIDATION ====================
    // CRITICAL: Handle filePath that can be string, object, or null

    let validatedPath = null;

    // If filePath is an object (Firestore document structure)
    if (typeof filePath === 'object' && filePath !== null) {
        console.warn('⚠️ filePath é objeto, tentando extrair caminho...', filePath);

        // Try common property names
        const possiblePaths = [
            filePath.path,
            filePath.url,
            filePath.arquivo,
            filePath.file,
            filePath.filePath
        ];

        for (const path of possiblePaths) {
            if (typeof path === 'string' && path.trim().length > 0 && path !== '#') {
                validatedPath = path.trim();
                console.log('✅ Caminho extraído de objeto:', validatedPath);
                break;
            }
        }

        if (!validatedPath) {
            console.error('❌ Objeto não contém caminho válido:', filePath);
            showToast('Erro: Estrutura de documento inválida', 'error');
            return false;
        }
    }
    // If filePath is a string
    else if (typeof filePath === 'string') {
        validatedPath = filePath.trim();
    }
    // If filePath is null/undefined or other invalid type
    else {
        console.error('❌ Tipo de filePath inválido:', typeof filePath, filePath);
        showToast('Erro: Tipo de documento não reconhecido', 'error');
        return false;
    }

    // Final validation of extracted path
    if (!validatedPath || validatedPath === '' || validatedPath === '#') {
        console.error('❌ Caminho final inválido:', validatedPath);
        showToast('Erro: URL do documento inválida ou não disponível', 'error');
        return false; // Explicit failure return
    }

    // Update filePath variable for rest of function
    filePath = validatedPath;

    // ==================== END TYPE VALIDATION ====================

    const section = document.getElementById('protocolosSection');
    if (!section) {
        console.error('❌ Seção protocolosSection não encontrada');
        return false; // Explicit failure return
    }
    
    // Normalizar URL - garantir que está completa
    let urlFinal = normalizeDocumentUrl(filePath);
    
    // Se for URL do Firebase Storage, usar iframe
    const isFirebaseStorage = urlFinal.includes('firebasestorage.googleapis.com') || 
                             urlFinal.includes('storage.googleapis.com') ||
                             urlFinal.includes('firebasestorage.app');
    
    if (isFirebaseStorage) {
        console.log('🔥 Documento do Firebase Storage detectado - usando visualização especial');
        carregarPDFFirebaseStorage(urlFinal, title, section);
        return true; // Explicit success return
    }
    
    // Documentos locais - visualização com suporte mobile
    const isMobile = isMobileDevice();
    const encodedURL = encodeURIComponent(urlFinal);
    const viewerHeight = isMobile ? '600px' : 'calc(100vh - 250px)';
    const minHeight = isMobile ? '600px' : '800px';
    
    const html = `
        ${renderInfoBanner('fas fa-file-pdf', title, 'Visualização segura do documento', '#006837 0%, #9BC53D 100%')}

        <div class="pdf-viewer-container">
            <div class="pdf-viewer-header">
                <div class="pdf-info">
                    <i class="fas fa-file-pdf"></i>
                    <span>${title}</span>
                </div>
                <div class="pdf-controls">
                    ${!isMobile ? `
                        <button class="btn-pdf" onclick="zoomOut()" title="Diminuir zoom">
                            <i class="fas fa-search-minus"></i>
                        </button>
                        <button class="btn-pdf" onclick="zoomIn()" title="Aumentar zoom">
                            <i class="fas fa-search-plus"></i>
                        </button>
                        <button class="btn-pdf" onclick="resetZoom()" title="Zoom original">
                            <i class="fas fa-expand-arrows-alt"></i>
                        </button>
                    ` : ''}
                    <button class="btn-pdf" onclick="voltarBiblioteca()">
                        <i class="fas fa-times"></i> Fechar
                    </button>
                </div>
        </div>
        
            <div class="pdf-viewer" style="height: ${viewerHeight}; min-height: ${minHeight};">
                ${isMobile ? `
                    <!-- Mobile: Abordagem híbrida com Google Viewer fallback -->
                    <div class="pdf-loading" id="pdfLoading" style="display: none;">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>Carregando documento...</p>
                    </div>
                    <object
                        data="${urlFinal}#toolbar=1&navpanes=0&scrollbar=1"
                        type="application/pdf"
                        width="100%"
                        height="100%"
                        style="border: 2px solid #2C3E50; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); background: white;">
                        <embed
                            src="https://docs.google.com/gview?url=${encodedURL}&embedded=true"
                            width="100%"
                            height="100%"
                            type="application/pdf"
                            style="border: 2px solid #2C3E50; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); background: white;">
                        </embed>
                        <div style="padding: 20px; text-align: center;">
                            <p style="margin-bottom: 16px; color: #666;">Não foi possível carregar o PDF no visualizador.</p>
                            <a href="${urlFinal}" target="_blank" style="display: inline-block; padding: 12px 24px; background: #006837; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
                                <i class="fas fa-download"></i> Baixar PDF
                            </a>
                        </div>
                    </object>
                ` : `
                    <!-- Desktop: PDF.js com canvas -->
                    <div class="pdf-loading" id="pdfLoading">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>Carregando documento...</p>
                    </div>
                    <canvas id="pdfCanvas" style="display: none; border: none; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); max-width: 100%;"></canvas>
                `}
            </div>
            
            <div class="pdf-footer">
                <div class="pdf-warning">
                    <i class="fas fa-shield-alt"></i>
                    <span>Documento protegido - Apenas visualização permitida</span>
                </div>
            </div>
        </div>
    `;
    
    section.innerHTML = html;

    // Garantir que a seção está visível e ativa
    section.classList.add('active');
    section.style.display = 'block';
    
    // Scroll para o topo da seção
    const scrollTimeout = setTimeout(() => {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    pdfTimeouts.push(scrollTimeout); // Registrar timeout para limpeza

    // Carregar PDF apenas em desktop (mobile usa object/embed)
    if (!isMobile) {
        // Pequeno delay para garantir que o HTML foi renderizado antes de carregar PDF
        setTimeout(() => {
            carregarPDFComPDFJS(filePath);
        }, 100);
    } else {
        // Em mobile, o object/embed já carrega automaticamente
        console.log('📱 Mobile detectado - usando visualização nativa/Google Viewer');
    }

    return true; // Explicit success return
}

// Função para voltar à biblioteca
function voltarBiblioteca() {
    // Limpar recursos PDF ao voltar para biblioteca
    if (typeof limparRecursosPDF === 'function') {
        limparRecursosPDF();
    }
    showBiblioteca();
}

// ==================== VISUALIZADOR FIREBASE STORAGE ====================

async function carregarPDFFirebaseStorage(url, title, section) {
    console.log('🔥 Carregando PDF do Firebase Storage:', url);
    
    // Garantir que a URL está corretamente formatada
    let urlFinal = url;
    
    // Se a URL não tiver o token de acesso, tentar obter um novo
    if (!urlFinal.includes('token=') && !urlFinal.includes('alt=media')) {
        try {
            // Se for um caminho do Storage, tentar obter URL de download
            if (urlFinal.includes('firebasestorage') || urlFinal.includes('storage.googleapis.com')) {
                // A URL já deve estar completa, mas vamos garantir
                if (!urlFinal.includes('alt=media')) {
                    urlFinal += (urlFinal.includes('?') ? '&' : '?') + 'alt=media';
                }
            }
        } catch (error) {
            console.warn('⚠️ Erro ao processar URL:', error);
        }
    }
    
    // Detectar mobile e criar HTML apropriado
    const isMobile = isMobileDevice();
    const encodedURL = encodeURIComponent(urlFinal);
    const viewerHeight = isMobile ? '600px' : 'calc(100vh - 250px)';
    const minHeight = isMobile ? '600px' : '800px';
    
    const html = `
        ${renderInfoBanner('fas fa-file-pdf', title, 'Visualização segura do documento', '#006837 0%, #9BC53D 100%', 'showBiblioteca()')}

        <div class="pdf-viewer-container">
            <div class="pdf-viewer-header">
                <div class="pdf-info">
                    <i class="fas fa-file-pdf"></i>
                    <span>${title}</span>
                </div>
                <div class="pdf-controls">
                    ${!isMobile ? `
                        <button class="btn-pdf" onclick="zoomOut()" title="Diminuir zoom">
                            <i class="fas fa-search-minus"></i>
                        </button>
                        <button class="btn-pdf" onclick="zoomIn()" title="Aumentar zoom">
                            <i class="fas fa-search-plus"></i>
                        </button>
                        <button class="btn-pdf" onclick="resetZoom()" title="Zoom original">
                            <i class="fas fa-expand-arrows-alt"></i>
                        </button>
                    ` : ''}
                    <button class="btn-pdf" onclick="voltarBiblioteca()">
                        <i class="fas fa-times"></i> Fechar
                    </button>
                </div>
            </div>
            
            <div class="pdf-viewer" style="height: ${viewerHeight}; min-height: ${minHeight};">
                ${isMobile ? `
                    <!-- Mobile: Abordagem híbrida com Google Viewer fallback -->
                    <div class="pdf-loading" id="pdfLoading" style="display: none;">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>Carregando documento...</p>
                    </div>
                    <object
                        data="${urlFinal}#toolbar=1&navpanes=0&scrollbar=1"
                        type="application/pdf"
                        width="100%"
                        height="100%"
                        style="border: 2px solid #2C3E50; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); background: white;">
                        <embed
                            src="https://docs.google.com/gview?url=${encodedURL}&embedded=true"
                            width="100%"
                            height="100%"
                            type="application/pdf"
                            style="border: 2px solid #2C3E50; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); background: white;">
                        </embed>
                        <div style="padding: 20px; text-align: center;">
                            <p style="margin-bottom: 16px; color: #666;">Não foi possível carregar o PDF no visualizador.</p>
                            <a href="${urlFinal}" target="_blank" style="display: inline-block; padding: 12px 24px; background: #006837; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
                                <i class="fas fa-download"></i> Baixar PDF
                            </a>
                        </div>
                    </object>
                ` : `
                    <!-- Desktop: iframe com fallback para PDF.js -->
                    <div class="pdf-loading" id="pdfLoading">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>Carregando documento...</p>
                    </div>
                    <iframe 
                        id="pdfIframe"
                        src="${urlFinal}#toolbar=1&navpanes=0&scrollbar=1" 
                        style="width: 100%; height: 100%; border: 2px solid #2C3E50; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); background: white; display: none;"
                        frameborder="0"
                        oncontextmenu="return false;"
                    ></iframe>
                    <canvas id="pdfCanvas" style="display: none; border: none; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); max-width: 100%;"></canvas>
                `}
            </div>
            
            <div class="pdf-footer">
                <div class="pdf-warning">
                    <i class="fas fa-shield-alt"></i>
                    <span>Documento protegido - Apenas visualização permitida</span>
                </div>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
    
    if (isMobile) {
        console.log('📱 Mobile detectado - usando visualização nativa/Google Viewer para Firebase Storage');
    } else {
        console.log('✅ Iframe do Firebase Storage criado com URL:', urlFinal);
        
        // Tentar carregar com iframe primeiro (apenas desktop)
        const iframe = document.getElementById('pdfIframe');
        const loadingDiv = document.getElementById('pdfLoading');
        
        // Timeout para detectar se o iframe não carregou
        let iframeLoaded = false;
        const timeout = setTimeout(async () => {
            if (!iframeLoaded) {
                console.warn('⚠️ Iframe não carregou em 5 segundos, tentando PDF.js...');
                // Ocultar iframe e tentar com PDF.js
                iframe.style.display = 'none';
                loadingDiv.style.display = 'block';
                await carregarPDFComPDFJS(urlFinal);
            }
        }, 5000);
        pdfTimeouts.push(timeout); // Registrar timeout para limpeza
        
        // Detectar quando o iframe carregar com sucesso
        iframe.onload = () => {
            iframeLoaded = true;
            clearTimeout(timeout);
            // Remover timeout da lista
            const index = pdfTimeouts.indexOf(timeout);
            if (index > -1) pdfTimeouts.splice(index, 1);
            console.log('✅ PDF do Firebase carregado com sucesso via iframe!');
            loadingDiv.style.display = 'none';
            iframe.style.display = 'block';
        };
        
        // Detectar erro no iframe
        iframe.onerror = async () => {
            iframeLoaded = true;
            clearTimeout(timeout);
            // Remover timeout da lista
            const index = pdfTimeouts.indexOf(timeout);
            if (index > -1) pdfTimeouts.splice(index, 1);
            console.warn('⚠️ Erro ao carregar iframe, tentando PDF.js...');
            iframe.style.display = 'none';
            loadingDiv.style.display = 'block';
            await carregarPDFComPDFJS(urlFinal);
        };
    }
}

// ==================== VISUALIZADOR PDF GLOBAL ====================

// Variáveis globais para PDF.js
let pdfDoc = null;
let currentPage = 1;
let totalPages = 0;
let loadingTask = null; // Referência ao loading task para poder cancelar
let pdfTimeouts = []; // Array para rastrear timeouts relacionados ao PDF
let pdfEventListeners = []; // Array para rastrear event listeners relacionados ao PDF

// Função para limpar recursos PDF anteriores
function limparRecursosPDF() {
    try {
        console.log('🧹 Iniciando limpeza completa de recursos PDF...');
        
        // Limpar todos os timeouts pendentes relacionados ao PDF
        pdfTimeouts.forEach(timeout => {
            if (timeout) clearTimeout(timeout);
        });
        pdfTimeouts = [];
        
        // Cancelar loading task anterior se existir
        if (loadingTask) {
            try {
                loadingTask.destroy();
            } catch (e) {
                console.warn('⚠️ Erro ao destruir loadingTask:', e);
            }
            loadingTask = null;
        }
        
        // Limpar referência ao documento PDF
        if (pdfDoc) {
            try {
                pdfDoc.destroy();
            } catch (e) {
                console.warn('⚠️ Erro ao destruir pdfDoc:', e);
            }
            pdfDoc = null;
        }
        
        // Limpar container de páginas PDF e seus event listeners
        const pagesContainer = document.getElementById('pdfPagesContainer');
        if (pagesContainer) {
            // Clonar e substituir para remover todos os event listeners
            const newContainer = pagesContainer.cloneNode(false);
            pagesContainer.parentNode?.replaceChild(newContainer, pagesContainer);
        }
        
        // Limpar canvas
        const canvas = document.getElementById('pdfCanvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
            canvas.width = 0;
            canvas.height = 0;
        }
        
        // Limpar iframes e objects de PDF
        const pdfIframe = document.getElementById('pdfIframe');
        if (pdfIframe) {
            pdfIframe.src = 'about:blank';
            pdfIframe.remove();
        }
        
        // Limpar objects e embeds de PDF
        const pdfObjects = document.querySelectorAll('object[type="application/pdf"], embed[type="application/pdf"]');
        pdfObjects.forEach(obj => {
            try {
                if (obj.data) obj.data = 'about:blank';
                obj.remove();
            } catch (e) {
                console.warn('⚠️ Erro ao remover object/embed:', e);
            }
        });
        
        // Limpar banners de PDF de todas as seções
        const allSections = document.querySelectorAll('.section');
        allSections.forEach(section => {
            const pdfBanner = section.querySelector('.info-banner');
            if (pdfBanner) {
                // Verificar se é um banner de PDF (contém ícone fa-file-pdf)
                const pdfIcon = pdfBanner.querySelector('i.fa-file-pdf');
                if (pdfIcon) {
                    pdfBanner.remove();
                    console.log('🧹 Banner de PDF removido da seção:', section.id);
                }
            }
            // Remover também containers de PDF
            const pdfViewer = section.querySelector('.pdf-viewer-container');
            if (pdfViewer) {
                pdfViewer.remove();
                console.log('🧹 Container de PDF removido da seção:', section.id);
            }
        });
        
        // Limpar variáveis globais relacionadas ao zoom
        if (window.currentScale !== undefined) {
            window.currentScale = 1.0;
        }
        if (window.translateX !== undefined) {
            window.translateX = 0;
        }
        if (window.translateY !== undefined) {
            window.translateY = 0;
        }
        if (window.aplicarTransformacao) {
            window.aplicarTransformacao = null;
        }
        
        // Limpar variáveis
        currentPage = 1;
        totalPages = 0;
        
        // Forçar garbage collection se disponível (apenas para desenvolvimento)
        if (window.gc) {
            window.gc();
        }
        
        console.log('✅ Recursos PDF limpos completamente');
    } catch (error) {
        console.warn('⚠️ Erro ao limpar recursos PDF:', error);
    }
}

// Função para carregar PDF com PDF.js
async function carregarPDFComPDFJS(url) {
    console.log('🔍 Tentando carregar PDF de:', url);
    
    try {
        // CRÍTICO: Limpar recursos PDF anteriores antes de carregar novo
        // Mas apenas se já houver um PDF carregado (evitar limpar elementos recém-criados)
        if (pdfDoc || loadingTask) {
            limparRecursosPDF();
        }
        
        // Verificar se os elementos necessários existem
        const loadingDiv = document.getElementById('pdfLoading');
        const canvas = document.getElementById('pdfCanvas');
        
        if (!loadingDiv || !canvas) {
            console.error('❌ Elementos PDF não encontrados no DOM. Aguardando renderização...');
            // Aguardar um pouco e tentar novamente
            await new Promise(resolve => setTimeout(resolve, 200));
            const retryLoadingDiv = document.getElementById('pdfLoading');
            const retryCanvas = document.getElementById('pdfCanvas');
            if (!retryLoadingDiv || !retryCanvas) {
                console.error('❌ Elementos PDF ainda não encontrados após espera');
                throw new Error('Elementos PDF não encontrados no DOM');
            }
        }
        
        // Configurar PDF.js
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        
        console.log('📥 Iniciando download do PDF...');
        
        // Para documentos locais, garantir que a URL está correta
        let urlFinal = normalizeDocumentUrl(url);
        
        console.log('🔗 URL final para PDF.js:', urlFinal);
        
        // Carregar PDF com opções CORS
        loadingTask = pdfjsLib.getDocument({
            url: urlFinal,
            cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
            cMapPacked: true,
            withCredentials: false
        });
        
        pdfDoc = await loadingTask.promise;
        
        totalPages = pdfDoc.numPages;
        currentPage = 1;
        
        console.log('✅ PDF carregado! Total de páginas:', totalPages);
        
        // Ocultar loading e mostrar canvas
        const finalLoadingDiv = document.getElementById('pdfLoading');
        const finalCanvas = document.getElementById('pdfCanvas');
        
        if (finalLoadingDiv) {
            finalLoadingDiv.style.display = 'none';
        }
        if (finalCanvas) {
            finalCanvas.style.display = 'block';
        }
        
        // Renderizar todas as páginas com rolagem vertical
        await renderizarTodasPaginas();
        
        // Atualizar controles
        atualizarControles();
        
        console.log('✅ PDF renderizado com sucesso!');
        
    } catch (error) {
        console.error('❌ ERRO DETALHADO ao carregar PDF:');
        console.error('URL:', url);
        console.error('Erro:', error);
        console.error('Tipo de erro:', error.name);
        console.error('Mensagem:', error.message);
        
        let mensagemErro = 'Erro ao carregar documento';
        let detalhes = '';
        
        if (error.name === 'MissingPDFException') {
            mensagemErro = 'Arquivo PDF não encontrado';
            detalhes = 'O documento pode ter sido movido ou excluído.';
        } else if (error.name === 'InvalidPDFException') {
            mensagemErro = 'Arquivo PDF inválido ou corrompido';
            detalhes = 'O arquivo não é um PDF válido.';
        } else if (error.message && error.message.includes('CORS')) {
            mensagemErro = 'Erro de permissão (CORS)';
            detalhes = 'Verifique as configurações de segurança.';
        } else if (error.message && error.message.includes('404')) {
            mensagemErro = 'Documento não encontrado (404)';
            detalhes = 'Verifique se o arquivo existe no servidor.';
        } else if (error.message && error.message.includes('403')) {
            mensagemErro = 'Acesso negado (403)';
            detalhes = 'Verifique as regras do Firebase Storage.';
        }
        
        document.getElementById('pdfLoading').innerHTML = `
            <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #ef4444; margin-bottom: 16px;"></i>
            <p style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">${mensagemErro}</p>
            <p style="font-size: 14px; color: #6b7280; margin-bottom: 16px;">${detalhes}</p>
            <p style="font-size: 12px; color: #9ca3af; font-family: monospace; background: #f3f4f6; padding: 12px; border-radius: 8px; max-width: 600px; word-break: break-all;">${url}</p>
            <button onclick="voltarBiblioteca()" style="margin-top: 16px; padding: 12px 24px; background: #006837; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                <i class="fas fa-arrow-left"></i> Voltar
            </button>
        `;
    }
}

// Função para renderizar todas as páginas com rolagem vertical
async function renderizarTodasPaginas() {
    if (!pdfDoc) {
        console.warn('⚠️ pdfDoc não disponível para renderização');
        return;
    }
    
    try {
        const container = document.querySelector('.pdf-viewer');
        if (!container) {
            console.error('❌ Container .pdf-viewer não encontrado');
            return;
        }
        
        const containerWidth = container.clientWidth - 40; // padding
        
        // Calcular escala baseada na largura do container
        const firstPage = await pdfDoc.getPage(1);
        const scale = Math.min(containerWidth / firstPage.view[2], 1.5);
        
        // Criar container para todas as páginas
        const pagesContainer = document.createElement('div');
        pagesContainer.id = 'pdfPagesContainer';
        pagesContainer.style.cssText = `
            width: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
            gap: 20px;
            padding: 20px 0;
        `;
        
        // Limpar canvas existente
        const canvas = document.getElementById('pdfCanvas');
        if (canvas) {
            canvas.style.display = 'none';
        }
        
        // Renderizar todas as páginas
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale });
            
            // Criar canvas para cada página
            const pageCanvas = document.createElement('canvas');
            pageCanvas.className = 'pdf-page-canvas';
            pageCanvas.style.cssText = `
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                background: white;
                margin: 0 auto;
                display: block;
            `;
            
            const context = pageCanvas.getContext('2d');
            
            // Configurar canvas com alta qualidade
            const devicePixelRatio = window.devicePixelRatio || 1;
            pageCanvas.height = viewport.height * devicePixelRatio;
            pageCanvas.width = viewport.width * devicePixelRatio;
            
            context.scale(devicePixelRatio, devicePixelRatio);
            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = 'high';
            
            // Definir dimensões de exibição
            pageCanvas.style.height = viewport.height + 'px';
            pageCanvas.style.width = viewport.width + 'px';
            
            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            
            await page.render(renderContext).promise;
            pagesContainer.appendChild(pageCanvas);
        }
        
        // Substituir canvas por container de páginas
        const pdfViewer = document.querySelector('.pdf-viewer');
        pdfViewer.innerHTML = '';
        pdfViewer.appendChild(pagesContainer);
        
        // Adicionar funcionalidades de zoom apenas com controles
        adicionarControlesZoomVertical();
        
    } catch (error) {
        console.error('❌ Erro ao renderizar páginas:', error);
    }
}

// Função para adicionar controles de zoom apenas com botões e pinça mobile
function adicionarControlesZoomVertical() {
    const pagesContainer = document.getElementById('pdfPagesContainer');
    if (!pagesContainer) return;
    
    let currentScale = 1.0;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let translateX = 0;
    let translateY = 0;
    
    // Aplicar zoom a todas as páginas
    function aplicarTransformacao() {
        const canvases = pagesContainer.querySelectorAll('.pdf-page-canvas');
        canvases.forEach(canvas => {
            canvas.style.transform = `translate(${translateX}px, ${translateY}px) scale(${currentScale})`;
            canvas.style.transformOrigin = '0 0';
        });
    }
    
    // Expor função e variáveis globalmente para controles de zoom
    window.currentScale = currentScale;
    window.translateX = translateX;
    window.translateY = translateY;
    window.aplicarTransformacao = aplicarTransformacao;
    
    // Arrastar para mover (sem zoom por scroll)
    pagesContainer.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('pdf-page-canvas')) {
            isDragging = true;
            startX = e.clientX - translateX;
            startY = e.clientY - translateY;
            pagesContainer.style.cursor = 'grabbing';
        }
    });
    
    pagesContainer.addEventListener('mousemove', (e) => {
        if (isDragging) {
            translateX = e.clientX - startX;
            translateY = e.clientY - startY;
            aplicarTransformacao();
        }
    });
    
    pagesContainer.addEventListener('mouseup', () => {
        isDragging = false;
        pagesContainer.style.cursor = 'grab';
    });
    
    pagesContainer.addEventListener('mouseleave', () => {
        isDragging = false;
        pagesContainer.style.cursor = 'grab';
    });
    
    // Touch events para mobile - APENAS PINÇA PARA ZOOM
    let lastTouchDistance = 0;
    let lastTouchCenter = { x: 0, y: 0 };
    
    pagesContainer.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (e.touches.length === 1) {
            // Um dedo - arrastar
            const touch = e.touches[0];
            startX = touch.clientX - translateX;
            startY = touch.clientY - translateY;
            isDragging = true;
        } else if (e.touches.length === 2) {
            // Dois dedos - zoom com pinça
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            lastTouchDistance = Math.sqrt(
                Math.pow(touch2.clientX - touch1.clientX, 2) +
                Math.pow(touch2.clientY - touch1.clientY, 2)
            );
            lastTouchCenter = {
                x: (touch1.clientX + touch2.clientX) / 2,
                y: (touch1.clientY + touch2.clientY) / 2
            };
        }
    });
    
    pagesContainer.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (e.touches.length === 1 && isDragging) {
            // Arrastar
            const touch = e.touches[0];
            translateX = touch.clientX - startX;
            translateY = touch.clientY - startY;
            aplicarTransformacao();
        } else if (e.touches.length === 2) {
            // Zoom com pinch
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const currentDistance = Math.sqrt(
                Math.pow(touch2.clientX - touch1.clientX, 2) +
                Math.pow(touch2.clientY - touch1.clientY, 2)
            );
            
            if (lastTouchDistance > 0) {
                const delta = currentDistance / lastTouchDistance;
                const newScale = Math.max(0.5, Math.min(3.0, currentScale * delta));
                
                // Ajustar posição para manter o centro do zoom
                const rect = pagesContainer.getBoundingClientRect();
                const centerX = lastTouchCenter.x - rect.left;
                const centerY = lastTouchCenter.y - rect.top;
                
                translateX = centerX - (centerX - translateX) * (newScale / currentScale);
                translateY = centerY - (centerY - translateY) * (newScale / currentScale);
                
                currentScale = newScale;
                aplicarTransformacao();
            }
            
            lastTouchDistance = currentDistance;
        }
    });
    
    pagesContainer.addEventListener('touchend', (e) => {
        if (e.touches.length === 0) {
            isDragging = false;
        }
    });
    
    // Estilo inicial
    pagesContainer.style.cursor = 'grab';
    pagesContainer.style.touchAction = 'none';
}

// Funções de zoom
function zoomIn() {
    const newScale = Math.min(3.0, (window.currentScale || 1.0) * 1.2);
    window.currentScale = newScale;
    if (window.aplicarTransformacao) {
        window.aplicarTransformacao();
    }
}

function zoomOut() {
    const newScale = Math.max(0.5, (window.currentScale || 1.0) * 0.8);
    window.currentScale = newScale;
    if (window.aplicarTransformacao) {
        window.aplicarTransformacao();
    }
}

function resetZoom() {
    window.currentScale = 1.0;
    window.translateX = 0;
    window.translateY = 0;
    if (window.aplicarTransformacao) {
        window.aplicarTransformacao();
    }
}

// Função para navegar para página anterior
function anteriorPagina() {
    if (currentPage > 1) {
        currentPage--;
        renderizarPagina(currentPage);
        atualizarControles();
    }
}

// Função para navegar para próxima página
function proximaPagina() {
    if (currentPage < totalPages) {
        currentPage++;
        renderizarPagina(currentPage);
        atualizarControles();
    }
}

// Função para atualizar controles de navegação
function atualizarControles() {
    const btnAnterior = document.getElementById('btnAnterior');
    const btnProximo = document.getElementById('btnProximo');
    
    if (btnAnterior) {
        btnAnterior.disabled = currentPage <= 1;
        btnAnterior.style.opacity = currentPage <= 1 ? '0.5' : '1';
    }
    
    if (btnProximo) {
        btnProximo.disabled = currentPage >= totalPages;
        btnProximo.style.opacity = currentPage >= totalPages ? '0.5' : '1';
    }
}

function showSegurancaMedicamentos() {
    // Atualizar histórico de navegação
    atualizarHistoricoNavegacao('seguranca-medicamentos');
    
    // Redireciona para a nova página com gerenciamento de documentos
    showBibliotecaDocumentos();
}

function showControleInfeccao() {
    // Atualizar histórico de navegação
    atualizarHistoricoNavegacao('controle-infeccao');
    
    // Redireciona para a nova página com gerenciamento de documentos
    showProtocolosPrevencao();
}

async function showChecklistCirurgia() {
    console.log('✅ Checklist de Cirurgia Segura (OMS)');

    const section = document.getElementById('ferramentasSection');
    if (!section) return;

    // Verificar permissões de admin
    const isAdmin = typeof checkUserRole === 'function' ?
        await checkUserRole(['Administrador', 'Coordenador']) : false;

    const html = `
        ${renderInfoBanner('fas fa-clipboard-check', 'Lista de Verificação para Cirurgia Segura', 'Checklist da Organização Mundial da Saúde (OMS)', '#059669 0%, #10B981 100%', "showSection('ferramentas')")}
        ${isAdmin ? `<div style="margin-bottom: 20px; text-align: right;"><button class="btn-add" onclick="showModalNovoChecklistDocumento()" style="background: #059669; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; gap: 8px;"><i class="fas fa-plus"></i> Novo Documento</button></div>` : ''}
        
        <div class="checklist-info">
            <i class="fas fa-info-circle"></i>
            <p>Marque cada item conforme é verificado pela equipe. O checklist deve ser completado em voz alta nos três momentos críticos.</p>
        </div>
        
        <!-- SIGN IN -->
        <div class="checklist-section">
            <div class="checklist-header sign-in">
                <i class="fas fa-clipboard-check"></i>
                <div>
                    <h2>SIGN IN - Antes da Indução Anestésica</h2>
                    <p>Paciente, Anestesista e Enfermeiro</p>
                </div>
            </div>
            <div class="checklist-items">
                <label class="checklist-item">
                    <input type="checkbox" id="signin-1" onchange="updateChecklistProgress()">
                    <span>Paciente confirmou sua identidade, local cirúrgico, procedimento e consentimento</span>
                </label>
                <label class="checklist-item">
                    <input type="checkbox" id="signin-2" onchange="updateChecklistProgress()">
                    <span>Demarcação do local cirúrgico foi realizada (quando aplicável)</span>
                </label>
                <label class="checklist-item">
                    <input type="checkbox" id="signin-3" onchange="updateChecklistProgress()">
                    <span>Checagem de segurança anestésica foi concluída</span>
                </label>
                <label class="checklist-item">
                    <input type="checkbox" id="signin-4" onchange="updateChecklistProgress()">
                    <span>Oxímetro de pulso colocado e funcionando</span>
                </label>
                <label class="checklist-item">
                    <input type="checkbox" id="signin-5" onchange="updateChecklistProgress()">
                    <span>Paciente possui:</span>
                </label>
                <div class="checklist-sub-items">
                    <label class="checklist-item sub">
                        <input type="checkbox" id="signin-5a" onchange="updateChecklistProgress()">
                        <span>Alergia conhecida?</span>
                    </label>
                    <label class="checklist-item sub">
                        <input type="checkbox" id="signin-5b" onchange="updateChecklistProgress()">
                        <span>Via aérea difícil / risco de aspiração?</span>
                    </label>
                    <label class="checklist-item sub">
                        <input type="checkbox" id="signin-5c" onchange="updateChecklistProgress()">
                        <span>Risco de perda sanguínea > 500ml (7ml/kg em crianças)?</span>
                    </label>
                </div>
            </div>
        </div>
        
        <!-- TIME OUT -->
        <div class="checklist-section">
            <div class="checklist-header time-out">
                <i class="fas fa-pause-circle"></i>
                <div>
                    <h2>TIME OUT - Antes da Incisão Cirúrgica</h2>
                    <p>Toda a equipe cirúrgica (pausa cirúrgica)</p>
                </div>
            </div>
            <div class="checklist-items">
                <label class="checklist-item">
                    <input type="checkbox" id="timeout-1" onchange="updateChecklistProgress()">
                    <span>Confirmar que todos os membros da equipe se apresentaram pelo nome e função</span>
                </label>
                <label class="checklist-item">
                    <input type="checkbox" id="timeout-2" onchange="updateChecklistProgress()">
                    <span>Cirurgião, Anestesiologista e Enfermeiro confirmam verbalmente:</span>
                </label>
                <div class="checklist-sub-items">
                    <label class="checklist-item sub">
                        <input type="checkbox" id="timeout-2a" onchange="updateChecklistProgress()">
                        <span>Identificação do paciente</span>
                    </label>
                    <label class="checklist-item sub">
                        <input type="checkbox" id="timeout-2b" onchange="updateChecklistProgress()">
                        <span>Local cirúrgico</span>
                    </label>
                    <label class="checklist-item sub">
                        <input type="checkbox" id="timeout-2c" onchange="updateChecklistProgress()">
                        <span>Procedimento a ser realizado</span>
                    </label>
                </div>
                <label class="checklist-item">
                    <input type="checkbox" id="timeout-3" onchange="updateChecklistProgress()">
                    <span>Previsão de eventos críticos pelo Cirurgião</span>
                </label>
                <label class="checklist-item">
                    <input type="checkbox" id="timeout-4" onchange="updateChecklistProgress()">
                    <span>Previsão de eventos críticos pelo Anestesiologista</span>
                </label>
                <label class="checklist-item">
                    <input type="checkbox" id="timeout-5" onchange="updateChecklistProgress()">
                    <span>Previsão de eventos críticos pela Enfermagem</span>
                </label>
                <label class="checklist-item">
                    <input type="checkbox" id="timeout-6" onchange="updateChecklistProgress()">
                    <span>Profilaxia antimicrobiana foi administrada nos últimos 60 min?</span>
                </label>
                <label class="checklist-item">
                    <input type="checkbox" id="timeout-7" onchange="updateChecklistProgress()">
                    <span>Imagens essenciais estão disponíveis?</span>
                </label>
            </div>
        </div>
        
        <!-- SIGN OUT -->
        <div class="checklist-section">
            <div class="checklist-header sign-out">
                <i class="fas fa-check-double"></i>
                <div>
                    <h2>SIGN OUT - Antes do Paciente Sair da Sala</h2>
                    <p>Enfermeiro verbalmente com a equipe</p>
                </div>
            </div>
            <div class="checklist-items">
                <label class="checklist-item">
                    <input type="checkbox" id="signout-1" onchange="updateChecklistProgress()">
                    <span>Enfermeiro confirma verbalmente com a equipe:</span>
                </label>
                <div class="checklist-sub-items">
                    <label class="checklist-item sub">
                        <input type="checkbox" id="signout-1a" onchange="updateChecklistProgress()">
                        <span>Nome do procedimento realizado</span>
                    </label>
                    <label class="checklist-item sub">
                        <input type="checkbox" id="signout-1b" onchange="updateChecklistProgress()">
                        <span>Contagem de instrumentais, compressas e agulhas está correta</span>
                    </label>
                    <label class="checklist-item sub">
                        <input type="checkbox" id="signout-1c" onchange="updateChecklistProgress()">
                        <span>Identificação de espécimes cirúrgicos (incluindo nome do paciente)</span>
                    </label>
                    <label class="checklist-item sub">
                        <input type="checkbox" id="signout-1d" onchange="updateChecklistProgress()">
                        <span>Se há problemas com equipamentos a serem resolvidos</span>
                    </label>
                </div>
                <label class="checklist-item">
                    <input type="checkbox" id="signout-2" onchange="updateChecklistProgress()">
                    <span>Cirurgião, Anestesiologista e Enfermeiro revisam as principais preocupações para recuperação e tratamento do paciente</span>
                </label>
            </div>
        </div>
        
        <!-- Progress Bar -->
        <div class="checklist-progress-container">
            <div class="checklist-progress-label">
                <span>Progresso do Checklist</span>
                <span id="checklistProgressText">0/27 itens</span>
            </div>
            <div class="checklist-progress-bar-bg">
                <div id="checklistProgressBar" class="checklist-progress-bar-fill"></div>
            </div>
        </div>
        
        <!-- Actions -->
        <div class="checklist-actions">
            <button class="btn-secondary" onclick="resetChecklist()">
                <i class="fas fa-redo"></i> Limpar Checklist
            </button>
            <button class="btn-primary" onclick="saveChecklist()" id="btnSaveChecklist" disabled>
                <i class="fas fa-save"></i> Salvar Registro
            </button>
            </div>
        `;
        
    section.innerHTML = html;
    updateChecklistProgress();
}

function updateChecklistProgress() {
    // Contar checkboxes marcados
    const allCheckboxes = document.querySelectorAll('.checklist-items input[type="checkbox"]');
    const checkedCheckboxes = document.querySelectorAll('.checklist-items input[type="checkbox"]:checked');
    
    const total = allCheckboxes.length;
    const checked = checkedCheckboxes.length;
    const percentage = total > 0 ? (checked / total) * 100 : 0;
    
    // Atualizar UI
    const progressBar = document.getElementById('checklistProgressBar');
    const progressText = document.getElementById('checklistProgressText');
    const saveButton = document.getElementById('btnSaveChecklist');
    
    if (progressBar) {
        progressBar.style.width = `${percentage}%`;
    }
    
    if (progressText) {
        progressText.textContent = `${checked}/${total} itens`;
    }
    
    if (saveButton) {
        saveButton.disabled = (checked < total);
    }
}

function resetChecklist() {
    const checkboxes = document.querySelectorAll('.checklist-items input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
    updateChecklistProgress();
    showToast('Checklist limpo', 'info');
}

async function saveChecklist() {
    if (!currentUser) {
        showToast('Você precisa estar logado para salvar', 'error');
        return;
    }
    
    try {
        showLoading();
        
        // Coletar dados do checklist
        const checklistData = {
            userId: currentUser.uid,
            userName: currentUser.displayName || currentUser.email,
            timestamp: new Date().toISOString(),
            signIn: {
                item1: document.getElementById('signin-1').checked,
                item2: document.getElementById('signin-2').checked,
                item3: document.getElementById('signin-3').checked,
                item4: document.getElementById('signin-4').checked,
                item5: document.getElementById('signin-5').checked,
                item5a: document.getElementById('signin-5a').checked,
                item5b: document.getElementById('signin-5b').checked,
                item5c: document.getElementById('signin-5c').checked
            },
            timeOut: {
                item1: document.getElementById('timeout-1').checked,
                item2: document.getElementById('timeout-2').checked,
                item2a: document.getElementById('timeout-2a').checked,
                item2b: document.getElementById('timeout-2b').checked,
                item2c: document.getElementById('timeout-2c').checked,
                item3: document.getElementById('timeout-3').checked,
                item4: document.getElementById('timeout-4').checked,
                item5: document.getElementById('timeout-5').checked,
                item6: document.getElementById('timeout-6').checked,
                item7: document.getElementById('timeout-7').checked
            },
            signOut: {
                item1: document.getElementById('signout-1').checked,
                item1a: document.getElementById('signout-1a').checked,
                item1b: document.getElementById('signout-1b').checked,
                item1c: document.getElementById('signout-1c').checked,
                item1d: document.getElementById('signout-1d').checked,
                item2: document.getElementById('signout-2').checked
            }
        };
        
        // Salvar no Firestore
        await db.collection('checklists').add(checklistData);
        
        hideLoading();
        showToast('Checklist salvo com sucesso!', 'success');
        
        // Limpar checklist após salvar
        setTimeout(() => {
            resetChecklist();
        }, 1000);
        
    } catch (error) {
        hideLoading();
        console.error('❌ Erro ao salvar checklist:', error);
        showToast('Erro ao salvar checklist', 'error');
    }
}

async function showConciliacaoMedicamentosa() {
    console.log('🔄 Conciliação Medicamentosa');
    
    // Atualizar histórico de navegação
    if (typeof atualizarHistoricoNavegacao === 'function') {
        atualizarHistoricoNavegacao('conciliacao-medicamentosa');
    }

    const section = document.getElementById('ferramentasSection');
    if (!section) return;

    // Verificar permissões de admin
    const isAdmin = typeof checkUserRole === 'function' ?
        await checkUserRole(['Administrador', 'Coordenador']) : false;

    const html = `
        ${renderInfoBanner('fas fa-exchange-alt', 'Conciliação Medicamentosa', 'Prevenção de erros de medicação em transições de cuidado - Meta Internacional de Segurança', '#7c3aed 0%, #5b21b6 100%', 'voltarPagina()')}
        
        <div class="protocols-grid">
            <div class="protocol-card" onclick="docManager_conciliacao_admissao.show()" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #7c3aed;">
                    <span style="font-size: 32px;">📥</span>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Conciliação na Admissão</h3>
                </div>
            </div>
            
            <div class="protocol-card" onclick="docManager_conciliacao_transferencia.show()" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #2563eb;">
                    <span style="font-size: 32px;">🔄</span>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Conciliação na Transferência</h3>
                </div>
            </div>
            
            <div class="protocol-card" onclick="docManager_conciliacao_alta.show()" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #059669;">
                    <span style="font-size: 32px;">📤</span>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Conciliação na Alta</h3>
                </div>
            </div>
            
            <div class="protocol-card" onclick="docManager_protocolo_institucional.show()" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #dc2626;">
                    <i class="fas fa-clipboard-list"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Protocolo Institucional</h3>
                </div>
            </div>
        </div>
        
        <div class="info-box" style="margin-top: 24px;">
            <i class="fas fa-info-circle"></i>
            <div>
                <strong>Sobre a Conciliação Medicamentosa:</strong>
                <p>Processo formal de comparação da lista completa de medicamentos que o paciente estava usando antes da admissão/transferência com a prescrição atual, para identificar e resolver discrepâncias.</p>
                <br>
                <strong>Momentos críticos:</strong>
                <ul style="margin: 8px 0 0 20px;">
                    <li>Admissão hospitalar</li>
                    <li>Transferência entre unidades</li>
                    <li>Alta hospitalar</li>
                </ul>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
}

function showConciliacaoAdmissao() {
    const section = document.getElementById('ferramentasSection');
    if (!section) return;
    
    const html = `
        ${renderInfoBanner('fas fa-sign-in-alt', 'Conciliação na Admissão', 'Registro de medicamentos em uso domiciliar', '#7c3aed 0%, #5b21b6 100%')}
        
        <div class="calculator-container">
            <div class="calculator-card">
                <h3 style="margin-bottom: 16px; color: var(--primary);">
                    <i class="fas fa-user"></i> Dados do Paciente
                </h3>
                
                <form id="conciliacaoForm" class="calc-form">
                <div class="form-group">
                        <label>Nome do Paciente:</label>
                        <input type="text" id="pacienteNome" class="form-input" required>
                </div>
                
                <div class="form-group">
                        <label>Prontuário:</label>
                        <input type="text" id="pacienteProntuario" class="form-input" required>
                </div>
                
                <div class="form-group">
                        <label>Data de Admissão:</label>
                        <input type="date" id="dataAdmissao" class="form-input" required>
                    </div>
                    
                    <h3 style="margin: 24px 0 16px; color: var(--primary);">
                        <i class="fas fa-pills"></i> Medicamentos em Uso Domiciliar
                    </h3>
                    
                    <div id="medicamentosContainer">
                        <div class="medicamento-item" style="background: var(--bg-card); padding: 16px; border-radius: 8px; margin-bottom: 12px;">
                            <div class="form-group">
                                <label>Medicamento:</label>
                                <input type="text" class="form-input med-nome" placeholder="Nome do medicamento">
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                                <div class="form-group">
                                    <label>Dose:</label>
                                    <input type="text" class="form-input med-dose" placeholder="Ex: 500mg">
                                </div>
                                <div class="form-group">
                                    <label>Via:</label>
                                    <select class="form-input med-via">
                                        <option value="VO">VO - Via Oral</option>
                                        <option value="EV">EV - Endovenosa</option>
                                        <option value="IM">IM - Intramuscular</option>
                                        <option value="SC">SC - Subcutânea</option>
                                        <option value="SL">SL - Sublingual</option>
                                        <option value="Tópica">Tópica</option>
                                        <option value="Inalatória">Inalatória</option>
                    </select>
                                </div>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                                <div class="form-group">
                                    <label>Frequência:</label>
                                    <input type="text" class="form-input med-freq" placeholder="Ex: 8/8h">
                                </div>
                                <div class="form-group">
                                    <label>Última Dose:</label>
                                    <input type="datetime-local" class="form-input med-ultima">
                                </div>
                            </div>
                        </div>
                </div>
                
                    <button type="button" class="btn-secondary" onclick="adicionarMedicamento()" style="width: 100%; margin-bottom: 16px;">
                        <i class="fas fa-plus"></i> Adicionar Medicamento
                    </button>
                    
                    <h3 style="margin: 24px 0 16px; color: var(--primary);">
                        <i class="fas fa-notes-medical"></i> Observações
                    </h3>
                    
                    <div class="form-group">
                        <label>Alergias Medicamentosas:</label>
                        <textarea class="form-input" id="alergias" rows="2" placeholder="Descrever alergias conhecidas"></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label>Observações Adicionais:</label>
                        <textarea class="form-input" id="observacoes" rows="3" placeholder="Informações relevantes sobre o uso dos medicamentos"></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label>Responsável pela Conciliação:</label>
                        <input type="text" id="responsavel" class="form-input" placeholder="Nome do profissional">
                    </div>
                    
                    <button type="button" class="btn-primary" onclick="salvarConciliacao()" style="width: 100%;">
                        <i class="fas fa-save"></i> Salvar Conciliação
                </button>
            </form>
            </div>
        </div>
        
        <div class="info-box" style="margin-top: 24px;">
            <i class="fas fa-lightbulb"></i>
            <div>
                <strong>Dicas importantes:</strong>
                <ul style="margin: 8px 0 0 20px;">
                    <li>Entrevistar o paciente ou familiar/cuidador</li>
                    <li>Verificar receitas, caixas de medicamentos e embalagens</li>
                    <li>Confirmar doses, vias e horários</li>
                    <li>Documentar medicamentos de venda livre e fitoterápicos</li>
                    <li>Registrar a última dose tomada</li>
                </ul>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
}

function adicionarMedicamento() {
    const container = document.getElementById('medicamentosContainer');
    const novoMed = document.createElement('div');
    novoMed.className = 'medicamento-item';
    novoMed.style.cssText = 'background: var(--bg-card); padding: 16px; border-radius: 8px; margin-bottom: 12px; position: relative;';
    novoMed.innerHTML = `
        <button type="button" onclick="this.parentElement.remove()" style="position: absolute; top: 8px; right: 8px; background: #dc2626; color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
            <i class="fas fa-times"></i>
        </button>
        <div class="form-group">
            <label>Medicamento:</label>
            <input type="text" class="form-input med-nome" placeholder="Nome do medicamento">
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="form-group">
                <label>Dose:</label>
                <input type="text" class="form-input med-dose" placeholder="Ex: 500mg">
            </div>
            <div class="form-group">
                <label>Via:</label>
                <select class="form-input med-via">
                    <option value="VO">VO - Via Oral</option>
                    <option value="EV">EV - Endovenosa</option>
                    <option value="IM">IM - Intramuscular</option>
                    <option value="SC">SC - Subcutânea</option>
                    <option value="SL">SL - Sublingual</option>
                    <option value="Tópica">Tópica</option>
                    <option value="Inalatória">Inalatória</option>
                </select>
            </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="form-group">
                <label>Frequência:</label>
                <input type="text" class="form-input med-freq" placeholder="Ex: 8/8h">
            </div>
            <div class="form-group">
                <label>Última Dose:</label>
                <input type="datetime-local" class="form-input med-ultima">
            </div>
        </div>
    `;
    container.appendChild(novoMed);
}

function salvarConciliacao() {
    const medicamentos = [];
    document.querySelectorAll('.medicamento-item').forEach(item => {
        const nome = item.querySelector('.med-nome').value;
        if (nome) {
            medicamentos.push({
                nome: nome,
                dose: item.querySelector('.med-dose').value,
                via: item.querySelector('.med-via').value,
                frequencia: item.querySelector('.med-freq').value,
                ultimaDose: item.querySelector('.med-ultima').value
            });
        }
    });
    
    if (medicamentos.length === 0) {
        showToast('Adicione pelo menos um medicamento', 'warning');
        return;
    }
    
    const dados = {
        paciente: document.getElementById('pacienteNome').value,
        prontuario: document.getElementById('pacienteProntuario').value,
        dataAdmissao: document.getElementById('dataAdmissao').value,
        medicamentos: medicamentos,
        alergias: document.getElementById('alergias').value,
        observacoes: document.getElementById('observacoes').value,
        responsavel: document.getElementById('responsavel').value,
        timestamp: new Date().toISOString()
    };
    
    console.log('💾 Conciliação salva:', dados);
    showToast('Conciliação medicamentosa registrada com sucesso!', 'success');
    
    // Aqui você pode integrar com Firebase/backend
    // await db.collection('conciliacoes').add(dados);
}

function showConciliacaoTransferencia() {
    const section = document.getElementById('ferramentasSection');
    if (!section) return;
    
    const html = `
        ${renderInfoBanner('fas fa-exchange-alt', 'Conciliação na Transferência', 'Atualização de medicamentos entre setores/unidades', '#7c3aed 0%, #5b21b6 100%')}
        
        <div class="calculator-container">
            <div class="calculator-card">
                <h3 style="margin-bottom: 16px; color: var(--primary);">
                    <i class="fas fa-user"></i> Dados da Transferência
                </h3>
                
                <form id="conciliacaoTransfForm" class="calc-form">
                <div class="form-group">
                        <label>Nome do Paciente:</label>
                        <input type="text" id="pacienteNomeTransf" class="form-input" required>
                    </div>
                    
                    <div class="form-group">
                        <label>Prontuário:</label>
                        <input type="text" id="pacienteProntuarioTransf" class="form-input" required>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div class="form-group">
                            <label>Setor de Origem:</label>
                            <select class="form-input" id="setorOrigem">
                        <option value="">Selecione...</option>
                                <option value="Emergência">Emergência</option>
                                <option value="UTI">UTI</option>
                                <option value="Centro Cirúrgico">Centro Cirúrgico</option>
                                <option value="Enfermaria">Enfermaria</option>
                                <option value="SRPA">SRPA</option>
                                <option value="Hemodinâmica">Hemodinâmica</option>
                    </select>
                        </div>
                        <div class="form-group">
                            <label>Setor de Destino:</label>
                            <select class="form-input" id="setorDestino">
                                <option value="">Selecione...</option>
                                <option value="Emergência">Emergência</option>
                                <option value="UTI">UTI</option>
                                <option value="Centro Cirúrgico">Centro Cirúrgico</option>
                                <option value="Enfermaria">Enfermaria</option>
                                <option value="SRPA">SRPA</option>
                                <option value="Hemodinâmica">Hemodinâmica</option>
                            </select>
                        </div>
                </div>
                
                <div class="form-group">
                        <label>Data/Hora da Transferência:</label>
                        <input type="datetime-local" id="dataTransferencia" class="form-input" required>
                </div>
                
                    <h3 style="margin: 24px 0 16px; color: var(--primary);">
                        <i class="fas fa-pills"></i> Medicamentos Atuais
                    </h3>
                    
                    <div id="medicamentosTransfContainer">
                        <div class="medicamento-item" style="background: var(--bg-card); padding: 16px; border-radius: 8px; margin-bottom: 12px;">
                <div class="form-group">
                                <label>Medicamento:</label>
                                <input type="text" class="form-input med-nome-transf" placeholder="Nome do medicamento">
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
                                <div class="form-group">
                                    <label>Dose:</label>
                                    <input type="text" class="form-input med-dose-transf" placeholder="Ex: 500mg">
                                </div>
                                <div class="form-group">
                                    <label>Via:</label>
                                    <select class="form-input med-via-transf">
                                        <option value="VO">VO</option>
                                        <option value="EV">EV</option>
                                        <option value="IM">IM</option>
                                        <option value="SC">SC</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Frequência:</label>
                                    <input type="text" class="form-input med-freq-transf" placeholder="8/8h">
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Status:</label>
                                <select class="form-input med-status-transf">
                                    <option value="manter">✅ Manter</option>
                                    <option value="suspender">❌ Suspender</option>
                                    <option value="alterar">🔄 Alterar dose/via</option>
                                    <option value="novo">➕ Novo medicamento</option>
                                </select>
                            </div>
                        </div>
                </div>
                    
                    <button type="button" class="btn-secondary" onclick="adicionarMedicamentoTransf()" style="width: 100%; margin-bottom: 16px;">
                        <i class="fas fa-plus"></i> Adicionar Medicamento
                    </button>
                    
                    <h3 style="margin: 24px 0 16px; color: var(--primary);">
                        <i class="fas fa-notes-medical"></i> Observações da Transferência
                    </h3>
                
                <div class="form-group">
                        <label>Alterações Realizadas:</label>
                        <textarea class="form-input" id="alteracoesTransf" rows="3" placeholder="Descrever alterações na prescrição"></textarea>
                </div>
                
                    <div class="form-group">
                        <label>Motivo das Alterações:</label>
                        <textarea class="form-input" id="motivoTransf" rows="2" placeholder="Justificativa clínica"></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label>Responsável pela Conciliação:</label>
                        <input type="text" id="responsavelTransf" class="form-input" placeholder="Nome do profissional">
                    </div>
                    
                    <button type="button" class="btn-primary" onclick="salvarConciliacaoTransf()" style="width: 100%;">
                        <i class="fas fa-save"></i> Salvar Conciliação
                </button>
            </form>
            </div>
        </div>
        
        <div class="info-box" style="margin-top: 24px;">
            <i class="fas fa-info-circle"></i>
            <div>
                <strong>Pontos de atenção na transferência:</strong>
                <ul style="margin: 8px 0 0 20px;">
                    <li>Verificar mudanças na prescrição entre setores</li>
                    <li>Confirmar continuidade de medicamentos críticos</li>
                    <li>Documentar suspensões e suas justificativas</li>
                    <li>Comunicar alterações à equipe receptora</li>
                </ul>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
}

function adicionarMedicamentoTransf() {
    const container = document.getElementById('medicamentosTransfContainer');
    const novoMed = document.createElement('div');
    novoMed.className = 'medicamento-item';
    novoMed.style.cssText = 'background: var(--bg-card); padding: 16px; border-radius: 8px; margin-bottom: 12px; position: relative;';
    novoMed.innerHTML = `
        <button type="button" onclick="this.parentElement.remove()" style="position: absolute; top: 8px; right: 8px; background: #dc2626; color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
            <i class="fas fa-times"></i>
        </button>
        <div class="form-group">
            <label>Medicamento:</label>
            <input type="text" class="form-input med-nome-transf" placeholder="Nome do medicamento">
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
            <div class="form-group">
                <label>Dose:</label>
                <input type="text" class="form-input med-dose-transf" placeholder="Ex: 500mg">
            </div>
            <div class="form-group">
                <label>Via:</label>
                <select class="form-input med-via-transf">
                    <option value="VO">VO</option>
                    <option value="EV">EV</option>
                    <option value="IM">IM</option>
                    <option value="SC">SC</option>
                </select>
            </div>
            <div class="form-group">
                <label>Frequência:</label>
                <input type="text" class="form-input med-freq-transf" placeholder="8/8h">
            </div>
        </div>
        <div class="form-group">
            <label>Status:</label>
            <select class="form-input med-status-transf">
                <option value="manter">✅ Manter</option>
                <option value="suspender">❌ Suspender</option>
                <option value="alterar">🔄 Alterar dose/via</option>
                <option value="novo">➕ Novo medicamento</option>
            </select>
        </div>
    `;
    container.appendChild(novoMed);
}

function salvarConciliacaoTransf() {
    const medicamentos = [];
    document.querySelectorAll('.medicamento-item').forEach(item => {
        const nome = item.querySelector('.med-nome-transf')?.value;
        if (nome) {
            medicamentos.push({
                nome: nome,
                dose: item.querySelector('.med-dose-transf').value,
                via: item.querySelector('.med-via-transf').value,
                frequencia: item.querySelector('.med-freq-transf').value,
                status: item.querySelector('.med-status-transf').value
            });
        }
    });
    
    if (medicamentos.length === 0) {
        showToast('Adicione pelo menos um medicamento', 'warning');
        return;
    }
    
    const dados = {
        tipo: 'transferencia',
        paciente: document.getElementById('pacienteNomeTransf').value,
        prontuario: document.getElementById('pacienteProntuarioTransf').value,
        setorOrigem: document.getElementById('setorOrigem').value,
        setorDestino: document.getElementById('setorDestino').value,
        dataTransferencia: document.getElementById('dataTransferencia').value,
        medicamentos: medicamentos,
        alteracoes: document.getElementById('alteracoesTransf').value,
        motivo: document.getElementById('motivoTransf').value,
        responsavel: document.getElementById('responsavelTransf').value,
        timestamp: new Date().toISOString()
    };
    
    console.log('💾 Conciliação de Transferência salva:', dados);
    showToast('Conciliação de transferência registrada com sucesso!', 'success');
}

function showConciliacaoAlta() {
    const section = document.getElementById('ferramentasSection');
    if (!section) return;
    
    const html = `
        ${renderInfoBanner('fas fa-sign-out-alt', 'Conciliação na Alta', 'Orientações para continuidade do tratamento', '#7c3aed 0%, #5b21b6 100%')}
        
        <div class="calculator-container">
            <div class="calculator-card">
                <h3 style="margin-bottom: 16px; color: var(--primary);">
                    <i class="fas fa-user"></i> Dados da Alta
                </h3>
                
                <form id="conciliacaoAltaForm" class="calc-form">
                <div class="form-group">
                        <label>Nome do Paciente:</label>
                        <input type="text" id="pacienteNomeAlta" class="form-input" required>
                </div>
                
                <div class="form-group">
                        <label>Prontuário:</label>
                        <input type="text" id="pacienteProntuarioAlta" class="form-input" required>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div class="form-group">
                            <label>Data de Admissão:</label>
                            <input type="date" id="dataAdmissaoAlta" class="form-input">
                        </div>
                        <div class="form-group">
                            <label>Data de Alta:</label>
                            <input type="date" id="dataAlta" class="form-input" required>
                        </div>
                    </div>
                    
                    <h3 style="margin: 24px 0 16px; color: var(--primary);">
                        <i class="fas fa-pills"></i> Medicamentos para Alta
                    </h3>
                    
                    <div id="medicamentosAltaContainer">
                        <div class="medicamento-item" style="background: var(--bg-card); padding: 16px; border-radius: 8px; margin-bottom: 12px;">
                            <div class="form-group">
                                <label>Medicamento:</label>
                                <input type="text" class="form-input med-nome-alta" placeholder="Nome do medicamento">
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                                <div class="form-group">
                                    <label>Dose e Via:</label>
                                    <input type="text" class="form-input med-dose-alta" placeholder="Ex: 500mg VO">
                                </div>
                                <div class="form-group">
                                    <label>Frequência:</label>
                                    <input type="text" class="form-input med-freq-alta" placeholder="Ex: 8/8h ou 3x/dia">
                                </div>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                                <div class="form-group">
                                    <label>Duração do Tratamento:</label>
                                    <input type="text" class="form-input med-duracao-alta" placeholder="Ex: 7 dias">
                                </div>
                                <div class="form-group">
                                    <label>Origem:</label>
                                    <select class="form-input med-origem-alta">
                                        <option value="novo">➕ Novo na alta</option>
                                        <option value="continuar">🔄 Continuar de casa</option>
                                        <option value="hospital">🏥 Iniciado no hospital</option>
                    </select>
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Orientações ao Paciente:</label>
                                <textarea class="form-input med-orientacao-alta" rows="2" placeholder="Como tomar, cuidados especiais..."></textarea>
                            </div>
                        </div>
                </div>
                    
                    <button type="button" class="btn-secondary" onclick="adicionarMedicamentoAlta()" style="width: 100%; margin-bottom: 16px;">
                        <i class="fas fa-plus"></i> Adicionar Medicamento
                    </button>
                    
                    <h3 style="margin: 24px 0 16px; color: var(--primary);">
                        <i class="fas fa-notes-medical"></i> Informações Adicionais
                    </h3>
                
                <div class="form-group">
                        <label>Medicamentos Suspensos na Alta:</label>
                        <textarea class="form-input" id="medsSuspensosAlta" rows="2" placeholder="Medicamentos que o paciente usava e devem ser suspensos"></textarea>
                </div>
                
                    <div class="form-group">
                        <label>Orientações Gerais:</label>
                        <textarea class="form-input" id="orientacoesAlta" rows="3" placeholder="Retorno, sinais de alerta, quando procurar atendimento..."></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label>Médico Responsável:</label>
                        <input type="text" id="medicoAlta" class="form-input" placeholder="Nome do médico">
                    </div>
                    
                    <button type="button" class="btn-primary" onclick="salvarConciliacaoAlta()" style="width: 100%;">
                        <i class="fas fa-save"></i> Salvar e Gerar Receita
                </button>
            </form>
            </div>
        </div>
        
        <div class="info-box" style="margin-top: 24px;">
            <i class="fas fa-lightbulb"></i>
            <div>
                <strong>Checklist da Alta:</strong>
                <ul style="margin: 8px 0 0 20px;">
                    <li>✅ Comparar com medicamentos de uso domiciliar</li>
                    <li>✅ Identificar medicamentos suspensos e novos</li>
                    <li>✅ Fornecer orientações claras e por escrito</li>
                    <li>✅ Verificar se paciente/familiar compreendeu</li>
                    <li>✅ Agendar retorno e exames de controle</li>
                </ul>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
}

function adicionarMedicamentoAlta() {
    const container = document.getElementById('medicamentosAltaContainer');
    const novoMed = document.createElement('div');
    novoMed.className = 'medicamento-item';
    novoMed.style.cssText = 'background: var(--bg-card); padding: 16px; border-radius: 8px; margin-bottom: 12px; position: relative;';
    novoMed.innerHTML = `
        <button type="button" onclick="this.parentElement.remove()" style="position: absolute; top: 8px; right: 8px; background: #dc2626; color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
            <i class="fas fa-times"></i>
        </button>
        <div class="form-group">
            <label>Medicamento:</label>
            <input type="text" class="form-input med-nome-alta" placeholder="Nome do medicamento">
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="form-group">
                <label>Dose e Via:</label>
                <input type="text" class="form-input med-dose-alta" placeholder="Ex: 500mg VO">
            </div>
            <div class="form-group">
                <label>Frequência:</label>
                <input type="text" class="form-input med-freq-alta" placeholder="Ex: 8/8h ou 3x/dia">
            </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="form-group">
                <label>Duração do Tratamento:</label>
                <input type="text" class="form-input med-duracao-alta" placeholder="Ex: 7 dias">
            </div>
            <div class="form-group">
                <label>Origem:</label>
                <select class="form-input med-origem-alta">
                    <option value="novo">➕ Novo na alta</option>
                    <option value="continuar">🔄 Continuar de casa</option>
                    <option value="hospital">🏥 Iniciado no hospital</option>
                </select>
            </div>
        </div>
        <div class="form-group">
            <label>Orientações ao Paciente:</label>
            <textarea class="form-input med-orientacao-alta" rows="2" placeholder="Como tomar, cuidados especiais..."></textarea>
        </div>
    `;
    container.appendChild(novoMed);
}

function salvarConciliacaoAlta() {
    const medicamentos = [];
    document.querySelectorAll('.medicamento-item').forEach(item => {
        const nome = item.querySelector('.med-nome-alta')?.value;
        if (nome) {
            medicamentos.push({
                nome: nome,
                dose: item.querySelector('.med-dose-alta').value,
                frequencia: item.querySelector('.med-freq-alta').value,
                duracao: item.querySelector('.med-duracao-alta').value,
                origem: item.querySelector('.med-origem-alta').value,
                orientacoes: item.querySelector('.med-orientacao-alta').value
            });
        }
    });
    
    if (medicamentos.length === 0) {
        showToast('Adicione pelo menos um medicamento', 'warning');
        return;
    }
    
    const dados = {
        tipo: 'alta',
        paciente: document.getElementById('pacienteNomeAlta').value,
        prontuario: document.getElementById('pacienteProntuarioAlta').value,
        dataAdmissao: document.getElementById('dataAdmissaoAlta').value,
        dataAlta: document.getElementById('dataAlta').value,
        medicamentos: medicamentos,
        medicamentosSuspensos: document.getElementById('medsSuspensosAlta').value,
        orientacoes: document.getElementById('orientacoesAlta').value,
        medico: document.getElementById('medicoAlta').value,
        timestamp: new Date().toISOString()
    };
    
    console.log('💾 Conciliação de Alta salva:', dados);
    showToast('Conciliação de alta registrada com sucesso! Receita gerada.', 'success');
}

function showProtocoloConciliacao() {
    showToast('Protocolo Institucional - PDF em breve', 'info');
}

function showAvaliacaoRiscos() {
    console.log('🛡️ Avaliação de Riscos clicado');

    // CRÍTICO: Ativar seção ferramentas primeiro
    showSection('ferramentas');

    const section = document.getElementById('ferramentasSection');
    if (!section) return false; // Explicit failure return

    const html = `
        ${renderInfoBanner('fas fa-shield-alt', 'Avaliação de Riscos', 'Ferramentas para avaliação de riscos clínicos baseadas em evidências', '#006837 0%, #9BC53D 100%', "showSection('ferramentas')")}

        <div class="protocols-grid">
            <div class="protocol-card" onclick="showEscalaMorse()" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #dc2626;">
                    <span style="font-size: 32px;">🚶</span>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Escala de Morse</h3>
                </div>
            </div>

            <div class="protocol-card" onclick="showEscalaBraden()" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #f59e0b;">
                    <i class="fas fa-bed"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Escala de Braden</h3>
                </div>
            </div>

            <div class="protocol-card" onclick="showEscalaCaprini()" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #2563eb;">
                    <span style="font-size: 32px;">💓</span>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Escala de Caprini</h3>
                </div>
            </div>

            <div class="protocol-card" onclick="showEscalaPadua()" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #7c3aed;">
                    <i class="fas fa-hospital"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Escala de Padua</h3>
                </div>
            </div>
        </div>
    `;

    section.innerHTML = html;

    return true; // Explicit success return
}

// ==================== ESCALA DE MORSE (QUEDAS) ====================
function showEscalaMorse() {
    // CRÍTICO: Ativar seção ferramentas primeiro
    showSection('ferramentas');

    const section = document.getElementById('ferramentasSection');
    if (!section) return;

    const html = `
        ${renderInfoBanner('fas fa-walking', 'Escala de Morse', 'Avaliação de Risco de Quedas', '#dc2626 0%, #991b1b 100%', 'showAvaliacaoRiscos()')}

        <div class="calculator-container">
            <div class="calculator-card">
                <form id="morseForm" class="calc-form">
                    <!-- Histórico de quedas -->
                    <div class="form-group">
                        <label class="form-label">1. Histórico de quedas</label>
                        <select name="quedas" class="form-select" onchange="calcularMorse()">
                            <option value="">Selecione...</option>
                            <option value="0">Não (0 pontos)</option>
                            <option value="25">Sim (25 pontos)</option>
                        </select>
                    </div>

                    <!-- Diagnóstico secundário -->
                    <div class="form-group">
                        <label class="form-label">2. Diagnóstico secundário</label>
                        <select name="diagnostico" class="form-select" onchange="calcularMorse()">
                            <option value="">Selecione...</option>
                            <option value="0">Não (0 pontos)</option>
                            <option value="15">Sim (15 pontos)</option>
                        </select>
                    </div>

                    <!-- Auxílio para deambular -->
                    <div class="form-group">
                        <label class="form-label">3. Auxílio para deambular</label>
                        <select name="auxilio" class="form-select" onchange="calcularMorse()">
                            <option value="">Selecione...</option>
                            <option value="0">Nenhum / Acamado / Auxílio de enfermagem (0 pontos)</option>
                            <option value="15">Muletas / Bengala / Andador (15 pontos)</option>
                            <option value="30">Mobiliário (30 pontos)</option>
                        </select>
                    </div>

                    <!-- Terapia endovenosa -->
                    <div class="form-group">
                        <label class="form-label">4. Terapia endovenosa / Dispositivo EV</label>
                        <select name="terapia" class="form-select" onchange="calcularMorse()">
                            <option value="">Selecione...</option>
                            <option value="0">Não (0 pontos)</option>
                            <option value="20">Sim (20 pontos)</option>
                        </select>
                    </div>

                    <!-- Marcha -->
                    <div class="form-group">
                        <label class="form-label">5. Marcha / Transferência</label>
                        <select name="marcha" class="form-select" onchange="calcularMorse()">
                            <option value="">Selecione...</option>
                            <option value="0">Normal / Acamado / Imóvel (0 pontos)</option>
                            <option value="10">Fraca (10 pontos)</option>
                            <option value="20">Comprometida / Cambaleante (20 pontos)</option>
                        </select>
                    </div>

                    <!-- Estado mental -->
                    <div class="form-group">
                        <label class="form-label">6. Estado mental</label>
                        <select name="mental" class="form-select" onchange="calcularMorse()">
                            <option value="">Selecione...</option>
                            <option value="0">Orientado / Capaz quanto à própria limitação (0 pontos)</option>
                            <option value="15">Superestima capacidade / Esquece limitações (15 pontos)</option>
                        </select>
                    </div>

                    <div id="morseResult" class="result-box" style="display: none;">
                        <h3>Resultado</h3>
                        <div class="score-display">
                            <span class="score-number" id="morseScore">0</span>
                            <span class="score-label">pontos</span>
                        </div>
                        <div class="risk-classification" id="morseRisk"></div>
                        <div class="risk-recommendation" id="morseRecommendation"></div>
                    </div>

                    <button type="button" class="btn-reset" onclick="resetMorse()">
                        <i class="fas fa-redo"></i> Limpar
                        </button>
                </form>
                    </div>

            <div class="info-box">
                <h3><i class="fas fa-info-circle"></i> Sobre a Escala de Morse</h3>
                <p>A Escala de Morse é uma ferramenta de triagem para identificar pacientes com risco de quedas.</p>
                <h4>Interpretação dos Resultados:</h4>
                <ul>
                    <li><strong>0-24 pontos:</strong> Baixo risco</li>
                    <li><strong>25-50 pontos:</strong> Médio risco</li>
                    <li><strong>≥ 51 pontos:</strong> Alto risco</li>
                </ul>
            </div>
                </div>
            `;
    
    section.innerHTML = html;
}

function calcularMorse() {
    const form = document.getElementById('morseForm');
    if (!form) return;
    
    const quedas = parseInt(form.quedas.value) || 0;
    const diagnostico = parseInt(form.diagnostico.value) || 0;
    const auxilio = parseInt(form.auxilio.value) || 0;
    const terapia = parseInt(form.terapia.value) || 0;
    const marcha = parseInt(form.marcha.value) || 0;
    const mental = parseInt(form.mental.value) || 0;
    
    const total = quedas + diagnostico + auxilio + terapia + marcha + mental;
    
    // Mostrar resultado apenas se todos os campos estiverem preenchidos
    const allFilled = form.quedas.value && form.diagnostico.value && form.auxilio.value && 
                      form.terapia.value && form.marcha.value && form.mental.value;
    
    if (allFilled) {
        const resultBox = document.getElementById('morseResult');
        const scoreDisplay = document.getElementById('morseScore');
        const riskDisplay = document.getElementById('morseRisk');
        const recommendationDisplay = document.getElementById('morseRecommendation');
        
        scoreDisplay.textContent = total;
        
        let riskLevel, riskClass, recommendation;
        
        if (total <= 24) {
            riskLevel = 'Baixo Risco';
            riskClass = 'risk-low';
            recommendation = 'Manter cuidados de rotina e reavaliação periódica.';
        } else if (total <= 50) {
            riskLevel = 'Médio Risco';
            riskClass = 'risk-medium';
            recommendation = 'Implementar medidas preventivas padrão: identificação do leito, orientação ao paciente, chamada de emergência ao alcance, iluminação adequada.';
        } else {
            riskLevel = 'Alto Risco';
            riskClass = 'risk-high';
            recommendation = 'Implementar protocolo completo de prevenção de quedas: supervisão constante, grade do leito elevada, dispositivos de segurança, reavaliação frequente, considerar acompanhante.';
        }
        
        riskDisplay.className = `risk-classification ${riskClass}`;
        riskDisplay.textContent = riskLevel;
        recommendationDisplay.textContent = recommendation;
        
        resultBox.style.display = 'block';
    }
}

function resetMorse() {
    const form = document.getElementById('morseForm');
    if (form) {
        form.reset();
        document.getElementById('morseResult').style.display = 'none';
    }
}

// ==================== ESCALA DE BRADEN (ÚLCERAS POR PRESSÃO) ====================
function showEscalaBraden() {
    // CRÍTICO: Ativar seção ferramentas primeiro
    showSection('ferramentas');

    const section = document.getElementById('ferramentasSection');
    if (!section) return;

    const html = `
        ${renderInfoBanner('fas fa-bed', 'Escala de Braden', 'Avaliação de Risco de Úlceras por Pressão', '#f59e0b 0%, #d97706 100%', 'showAvaliacaoRiscos()')}

        <div class="calculator-container">
            <div class="calculator-card">
                <form id="bradenForm" class="calc-form">
                    <!-- Percepção Sensorial -->
                    <div class="form-group">
                        <label class="form-label">1. Percepção Sensorial</label>
                        <select name="sensorial" class="form-select" onchange="calcularBraden()">
                            <option value="">Selecione...</option>
                            <option value="1">Totalmente limitado (1)</option>
                            <option value="2">Muito limitado (2)</option>
                            <option value="3">Levemente limitado (3)</option>
                            <option value="4">Nenhuma limitação (4)</option>
                        </select>
                    </div>

                    <!-- Umidade -->
                    <div class="form-group">
                        <label class="form-label">2. Umidade</label>
                        <select name="umidade" class="form-select" onchange="calcularBraden()">
                            <option value="">Selecione...</option>
                            <option value="1">Constantemente úmida (1)</option>
                            <option value="2">Muito úmida (2)</option>
                            <option value="3">Ocasionalmente úmida (3)</option>
                            <option value="4">Raramente úmida (4)</option>
                        </select>
                    </div>

                    <!-- Atividade -->
                    <div class="form-group">
                        <label class="form-label">3. Atividade</label>
                        <select name="atividade" class="form-select" onchange="calcularBraden()">
                            <option value="">Selecione...</option>
                            <option value="1">Acamado (1)</option>
                            <option value="2">Confinado à cadeira (2)</option>
                            <option value="3">Anda ocasionalmente (3)</option>
                            <option value="4">Anda frequentemente (4)</option>
                        </select>
                    </div>

                    <!-- Mobilidade -->
                    <div class="form-group">
                        <label class="form-label">4. Mobilidade</label>
                        <select name="mobilidade" class="form-select" onchange="calcularBraden()">
                            <option value="">Selecione...</option>
                            <option value="1">Totalmente imóvel (1)</option>
                            <option value="2">Bastante limitado (2)</option>
                            <option value="3">Levemente limitado (3)</option>
                            <option value="4">Não apresenta limitações (4)</option>
                        </select>
                    </div>

                    <!-- Nutrição -->
                    <div class="form-group">
                        <label class="form-label">5. Nutrição</label>
                        <select name="nutricao" class="form-select" onchange="calcularBraden()">
                            <option value="">Selecione...</option>
                            <option value="1">Muito pobre (1)</option>
                            <option value="2">Provavelmente inadequado (2)</option>
                            <option value="3">Adequado (3)</option>
                            <option value="4">Excelente (4)</option>
                        </select>
                    </div>

                    <!-- Fricção e Cisalhamento -->
                    <div class="form-group">
                        <label class="form-label">6. Fricção e Cisalhamento</label>
                        <select name="friccao" class="form-select" onchange="calcularBraden()">
                            <option value="">Selecione...</option>
                            <option value="1">Problema (1)</option>
                            <option value="2">Problema em potencial (2)</option>
                            <option value="3">Nenhum problema aparente (3)</option>
                        </select>
                    </div>

                    <div id="bradenResult" class="result-box" style="display: none;">
                        <h3>Resultado</h3>
                        <div class="score-display">
                            <span class="score-number" id="bradenScore">0</span>
                            <span class="score-label">pontos</span>
                        </div>
                        <div class="risk-classification" id="bradenRisk"></div>
                        <div class="risk-recommendation" id="bradenRecommendation"></div>
                    </div>

                    <button type="button" class="btn-reset" onclick="resetBraden()">
                        <i class="fas fa-redo"></i> Limpar
                    </button>
                </form>
            </div>

            <div class="info-box">
                <h3><i class="fas fa-info-circle"></i> Sobre a Escala de Braden</h3>
                <p>Ferramenta validada para predizer o risco de desenvolvimento de úlceras por pressão.</p>
                <h4>Interpretação dos Resultados:</h4>
                <ul>
                    <li><strong>≤ 9 pontos:</strong> Risco muito alto</li>
                    <li><strong>10-12 pontos:</strong> Risco alto</li>
                    <li><strong>13-14 pontos:</strong> Risco moderado</li>
                    <li><strong>15-18 pontos:</strong> Risco baixo</li>
                    <li><strong>≥ 19 pontos:</strong> Sem risco</li>
                </ul>
            </div>
                </div>
            `;
    
    section.innerHTML = html;
}

function calcularBraden() {
    const form = document.getElementById('bradenForm');
    if (!form) return;
    
    const sensorial = parseInt(form.sensorial.value) || 0;
    const umidade = parseInt(form.umidade.value) || 0;
    const atividade = parseInt(form.atividade.value) || 0;
    const mobilidade = parseInt(form.mobilidade.value) || 0;
    const nutricao = parseInt(form.nutricao.value) || 0;
    const friccao = parseInt(form.friccao.value) || 0;
    
    const total = sensorial + umidade + atividade + mobilidade + nutricao + friccao;
    
    const allFilled = form.sensorial.value && form.umidade.value && form.atividade.value && 
                      form.mobilidade.value && form.nutricao.value && form.friccao.value;
    
    if (allFilled) {
        const resultBox = document.getElementById('bradenResult');
        const scoreDisplay = document.getElementById('bradenScore');
        const riskDisplay = document.getElementById('bradenRisk');
        const recommendationDisplay = document.getElementById('bradenRecommendation');
        
        scoreDisplay.textContent = total;
        
        let riskLevel, riskClass, recommendation;
        
        if (total <= 9) {
            riskLevel = 'Risco Muito Alto';
            riskClass = 'risk-critical';
            recommendation = 'Protocolo intensivo: mudança de decúbito a cada 1-2h, uso de colchão de ar, curativos preventivos, avaliação nutricional, hidratação da pele.';
        } else if (total <= 12) {
            riskLevel = 'Risco Alto';
            riskClass = 'risk-high';
            recommendation = 'Mudança de decúbito a cada 2-3h, uso de superfícies de redistribuição de pressão, proteção de proeminências ósseas, atenção à nutrição.';
        } else if (total <= 14) {
            riskLevel = 'Risco Moderado';
            riskClass = 'risk-medium';
            recommendation = 'Mudança de decúbito a cada 3-4h, uso de almofadas de posicionamento, hidratação da pele, monitoramento regular.';
        } else if (total <= 18) {
            riskLevel = 'Risco Baixo';
            riskClass = 'risk-low';
            recommendation = 'Manter cuidados básicos de pele, mudança de decúbito conforme necessário, reavaliação periódica.';
            } else {
            riskLevel = 'Sem Risco';
            riskClass = 'risk-none';
            recommendation = 'Manter cuidados de rotina. Reavaliar se houver mudança no estado clínico.';
        }
        
        riskDisplay.className = `risk-classification ${riskClass}`;
        riskDisplay.textContent = riskLevel;
        recommendationDisplay.textContent = recommendation;
        
        resultBox.style.display = 'block';
    }
}

function resetBraden() {
    const form = document.getElementById('bradenForm');
    if (form) {
        form.reset();
        document.getElementById('bradenResult').style.display = 'none';
    }
}

// ==================== ESCALA DE CAPRINI (TEV CIRÚRGICO) ====================
function showEscalaCaprini() {
    // CRÍTICO: Ativar seção ferramentas primeiro
    showSection('ferramentas');

    const section = document.getElementById('ferramentasSection');
    if (!section) return;

    const html = `
        ${renderInfoBanner('fas fa-heartbeat', 'Escala de Caprini', 'Risco de TEV em Pacientes Cirúrgicos', '#2563eb 0%, #3b82f6 100%', 'showAvaliacaoRiscos()')}

        <div class="calculator-container">
            <div class="calculator-card">
                <div id="capriniForm">
                    <!-- 1 PONTO -->
                    <div class="factor-group">
                        <h4 class="group-title">
                            <i class="fas fa-circle"></i>
                            1 Ponto Cada
                        </h4>
                        
                        <div class="risk-factor-card" onclick="toggleCapriniFactor(this, 1)">
                            <div class="card-content">
                                <div class="factor-icon">📅</div>
                                <div class="factor-text">
                                    <strong>Idade 41-60 anos</strong>
                        </div>
                    </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                    </div>
                    </div>
                        
                        <div class="risk-factor-card" onclick="toggleCapriniFactor(this, 1)">
                            <div class="card-content">
                                <div class="factor-icon">🏥</div>
                                <div class="factor-text">
                                    <strong>Cirurgia menor</strong>
                </div>
                            </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                            </div>
                        </div>
                        
                        <div class="risk-factor-card" onclick="toggleCapriniFactor(this, 1)">
                            <div class="card-content">
                                <div class="factor-icon">⚖️</div>
                                <div class="factor-text">
                                    <strong>IMC > 25 kg/m²</strong>
                                </div>
                            </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                            </div>
                        </div>
                        
                        <div class="risk-factor-card" onclick="toggleCapriniFactor(this, 1)">
                            <div class="card-content">
                                <div class="factor-icon">🦵</div>
                                <div class="factor-text">
                                    <strong>Varizes de membros inferiores</strong>
                                </div>
                            </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                            </div>
                        </div>
                    </div>

                    <!-- 2 PONTOS -->
                    <div class="factor-group">
                        <h4 class="group-title">
                            <i class="fas fa-exclamation"></i>
                            2 Pontos Cada
                        </h4>
                        
                        <div class="risk-factor-card" onclick="toggleCapriniFactor(this, 2)">
                            <div class="card-content">
                                <div class="factor-icon">👴</div>
                                <div class="factor-text">
                                    <strong>Idade 61-74 anos</strong>
                                </div>
                            </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                            </div>
                        </div>
                        
                        <div class="risk-factor-card" onclick="toggleCapriniFactor(this, 2)">
                            <div class="card-content">
                                <div class="factor-icon">⚕️</div>
                                <div class="factor-text">
                                    <strong>Cirurgia maior (> 45 min)</strong>
                                </div>
                            </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                            </div>
                        </div>
                        
                        <div class="risk-factor-card" onclick="toggleCapriniFactor(this, 2)">
                            <div class="card-content">
                                <div class="factor-icon">🛏️</div>
                                <div class="factor-text">
                                    <strong>Mobilidade reduzida</strong>
                                </div>
                            </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                            </div>
                        </div>
                        
                        <div class="risk-factor-card" onclick="toggleCapriniFactor(this, 2)">
                            <div class="card-content">
                                <div class="factor-icon">💊</div>
                                <div class="factor-text">
                                    <strong>Anticoncepcional ou TH</strong>
                                </div>
                            </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                            </div>
                        </div>
                    </div>

                    <!-- 3 PONTOS -->
                    <div class="factor-group">
                        <h4 class="group-title">
                            <i class="fas fa-exclamation-triangle"></i>
                            3 Pontos Cada
                        </h4>
                        
                        <div class="risk-factor-card" onclick="toggleCapriniFactor(this, 3)">
                            <div class="card-content">
                                <div class="factor-icon">🧓</div>
                                <div class="factor-text">
                                    <strong>Idade ≥ 75 anos</strong>
                                </div>
                            </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                            </div>
                        </div>
                        
                        <div class="risk-factor-card" onclick="toggleCapriniFactor(this, 3)">
                            <div class="card-content">
                                <div class="factor-icon">👨‍👩‍👧</div>
                                <div class="factor-text">
                                    <strong>História familiar de TEV</strong>
                                </div>
                            </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                            </div>
                        </div>
                        
                        <div class="risk-factor-card" onclick="toggleCapriniFactor(this, 3)">
                            <div class="card-content">
                                <div class="factor-icon">🧬</div>
                                <div class="factor-text">
                                    <strong>Trombofilia conhecida</strong>
                                </div>
                            </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                            </div>
                        </div>
                    </div>

                    <!-- 5 PONTOS -->
                    <div class="factor-group">
                        <h4 class="group-title">
                            <i class="fas fa-radiation"></i>
                            5 Pontos Cada
                        </h4>
                        
                        <div class="risk-factor-card" onclick="toggleCapriniFactor(this, 5)">
                            <div class="card-content">
                                <div class="factor-icon">🩸</div>
                                <div class="factor-text">
                                    <strong>História prévia de TEV</strong>
                                </div>
                            </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                            </div>
                        </div>
                        
                        <div class="risk-factor-card" onclick="toggleCapriniFactor(this, 5)">
                            <div class="card-content">
                                <div class="factor-icon">🎗️</div>
                                <div class="factor-text">
                                    <strong>Câncer ativo ou em tratamento</strong>
                                </div>
                            </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                            </div>
                        </div>
                        
                        <div class="risk-factor-card" onclick="toggleCapriniFactor(this, 5)">
                            <div class="card-content">
                                <div class="factor-icon">🦠</div>
                                <div class="factor-text">
                                    <strong>Sepse (< 1 mês)</strong>
                                </div>
                            </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                            </div>
                        </div>
                    </div>

                    <div id="capriniResult" class="result-box" style="display: none;">
                        <h3>Resultado Final</h3>
                        <div class="score-display">
                            <span class="score-number" id="capriniScore">0</span>
                            <span class="score-label">pontos</span>
                        </div>
                        <div class="risk-classification" id="capriniRisk"></div>
                        <div class="risk-recommendation" id="capriniRecommendation"></div>
                    </div>

                    <!-- Score Tracker -->
                    <div class="score-tracker">
                        <div class="current-score">
                            <span id="capriniCurrentScore">0</span> pontos
                        </div>
                        <div class="score-status" id="capriniStatus">
                            Selecione os fatores de risco
                        </div>
                    </div>

                    <button type="button" class="btn-reset" onclick="resetCaprini()">
                        <i class="fas fa-redo"></i> Limpar Tudo
                    </button>
                </div>
            </div>

            <div class="info-box">
                <h3><i class="fas fa-info-circle"></i> Sobre a Escala de Caprini</h3>
                <p>Avalia o risco de TEV em pacientes cirúrgicos.</p>
                <h4>Interpretação:</h4>
                <ul>
                    <li><strong>0-1:</strong> Risco muito baixo</li>
                    <li><strong>2:</strong> Risco baixo</li>
                    <li><strong>3-4:</strong> Risco moderado</li>
                    <li><strong>≥5:</strong> Risco alto</li>
                </ul>
            </div>
                </div>
            `;
    
    section.innerHTML = html;
}

function toggleCapriniFactor(card, points) {
    card.classList.toggle('selected');
    const icon = card.querySelector('.card-check i');
    
    if (card.classList.contains('selected')) {
        icon.classList.remove('fa-circle');
        icon.classList.add('fa-check-circle');
        card.dataset.value = points;
    } else {
        icon.classList.remove('fa-check-circle');
        icon.classList.add('fa-circle');
        delete card.dataset.value;
    }
    
    calcularCaprini();
}

function calcularCaprini() {
    const cards = document.querySelectorAll('.risk-factor-card.selected');
    let total = 0;
    
    cards.forEach(card => {
        total += parseInt(card.dataset.value) || 0;
    });
    
    // Atualizar score tracker
    document.getElementById('capriniCurrentScore').textContent = total;
    
    if (total === 0) {
        document.getElementById('capriniStatus').textContent = 'Selecione os fatores de risco';
    } else {
        document.getElementById('capriniStatus').textContent = getRiskText(total);
    }
    
    // Mostrar resultado final
    const scoreDisplay = document.getElementById('capriniScore');
    const riskDisplay = document.getElementById('capriniRisk');
    const recommendationDisplay = document.getElementById('capriniRecommendation');
    
    scoreDisplay.textContent = total;
    
    let riskLevel, riskClass, recommendation;
    
    if (total <= 1) {
        riskLevel = 'Risco Muito Baixo';
        riskClass = 'risk-none';
        recommendation = 'Deambulação precoce. Profilaxia mecânica não obrigatória.';
    } else if (total === 2) {
        riskLevel = 'Risco Baixo';
        riskClass = 'risk-low';
        recommendation = 'Profilaxia mecânica: meias de compressão graduada ou compressão pneumática intermitente.';
    } else if (total <= 4) {
        riskLevel = 'Risco Moderado';
        riskClass = 'risk-medium';
        recommendation = 'Profilaxia farmacológica (HBPM ou HNF) + profilaxia mecânica. Avaliar contraindicações.';
    } else {
        riskLevel = 'Risco Alto';
        riskClass = 'risk-high';
        recommendation = 'Profilaxia farmacológica obrigatória (HBPM dose ajustada ou HNF) + profilaxia mecânica. Considerar profilaxia estendida pós-alta.';
    }
    
    riskDisplay.className = `risk-classification ${riskClass}`;
    riskDisplay.textContent = riskLevel;
    recommendationDisplay.textContent = recommendation;
    
    document.getElementById('capriniResult').style.display = 'block';
    
    function getRiskText(score) {
        if (score <= 1) return 'Risco Muito Baixo';
        if (score === 2) return 'Risco Baixo';
        if (score <= 4) return 'Risco Moderado';
        return 'Risco Alto';
    }
}

function resetCaprini() {
    const cards = document.querySelectorAll('.risk-factor-card.selected');
    cards.forEach(card => {
        card.classList.remove('selected');
        const icon = card.querySelector('.card-check i');
        icon.classList.remove('fa-check-circle');
        icon.classList.add('fa-circle');
        delete card.dataset.value;
    });
    
    document.getElementById('capriniCurrentScore').textContent = '0';
    document.getElementById('capriniStatus').textContent = 'Selecione os fatores de risco';
    document.getElementById('capriniResult').style.display = 'none';
}

// ==================== ESCALA DE PADUA (TEV CLÍNICO) ====================
function showEscalaPadua() {
    // CRÍTICO: Ativar seção ferramentas primeiro
    showSection('ferramentas');

    const section = document.getElementById('ferramentasSection');
    if (!section) return;

    const html = `
        ${renderInfoBanner('fas fa-hospital', 'Escala de Padua', 'Risco de TEV em Pacientes Clínicos', '#7c3aed 0%, #a855f7 100%', 'showAvaliacaoRiscos()')}

        <div class="calculator-container">
            <div class="calculator-card">
                <div id="paduaForm">
                    <!-- 3 PONTOS -->
                    <div class="factor-group">
                        <h4 class="group-title">
                            <i class="fas fa-exclamation-triangle"></i>
                            Alto Impacto (3 pontos cada)
                        </h4>
                        
                        <div class="risk-factor-card" onclick="togglePaduaFactor(this, 3)">
                            <div class="card-content">
                                <div class="factor-icon">🎗️</div>
                                <div class="factor-text">
                                    <strong>Câncer ativo</strong>
                                </div>
                            </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                            </div>
                        </div>
                        
                        <div class="risk-factor-card" onclick="togglePaduaFactor(this, 3)">
                            <div class="card-content">
                                <div class="factor-icon">🩸</div>
                                <div class="factor-text">
                                    <strong>TEV prévio</strong>
                                    <span class="factor-points">Exceto TVP superficial</span>
                                </div>
                            </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                            </div>
                        </div>
                        
                        <div class="risk-factor-card" onclick="togglePaduaFactor(this, 3)">
                            <div class="card-content">
                                <div class="factor-icon">🛏️</div>
                                <div class="factor-text">
                                    <strong>Mobilidade reduzida</strong>
                                    <span class="factor-points">Repouso no leito ≥ 3 dias</span>
                                </div>
                            </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                            </div>
                        </div>
                        
                        <div class="risk-factor-card" onclick="togglePaduaFactor(this, 3)">
                            <div class="card-content">
                                <div class="factor-icon">🧬</div>
                                <div class="factor-text">
                                    <strong>Trombofilia conhecida</strong>
                                </div>
                            </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                            </div>
                        </div>
                    </div>

                    <!-- 2 PONTOS -->
                    <div class="factor-group">
                        <h4 class="group-title">
                            <i class="fas fa-exclamation"></i>
                            Trauma (2 pontos)
                        </h4>
                        
                        <div class="risk-factor-card" onclick="togglePaduaFactor(this, 2)">
                            <div class="card-content">
                                <div class="factor-icon">🤕</div>
                                <div class="factor-text">
                                    <strong>Trauma recente</strong>
                                    <span class="factor-points">≤ 1 mês</span>
                                </div>
                            </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                            </div>
                        </div>
                    </div>

                    <!-- 1 PONTO -->
                    <div class="factor-group">
                        <h4 class="group-title">
                            <i class="fas fa-info-circle"></i>
                            Outros Fatores (1 ponto cada)
                        </h4>
                        
                        <div class="risk-factor-card" onclick="togglePaduaFactor(this, 1)">
                            <div class="card-content">
                                <div class="factor-icon">👴</div>
                                <div class="factor-text">
                                    <strong>Idade ≥ 70 anos</strong>
                                </div>
                            </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                            </div>
                        </div>
                        
                        <div class="risk-factor-card" onclick="togglePaduaFactor(this, 1)">
                            <div class="card-content">
                                <div class="factor-icon">💔</div>
                                <div class="factor-text">
                                    <strong>Insuficiência cardíaca/respiratória</strong>
                                </div>
                            </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                            </div>
                        </div>
                        
                        <div class="risk-factor-card" onclick="togglePaduaFactor(this, 1)">
                            <div class="card-content">
                                <div class="factor-icon">🫀</div>
                                <div class="factor-text">
                                    <strong>IAM agudo ou AVC isquêmico</strong>
                                </div>
                            </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                            </div>
                        </div>
                        
                        <div class="risk-factor-card" onclick="togglePaduaFactor(this, 1)">
                            <div class="card-content">
                                <div class="factor-icon">🦠</div>
                                <div class="factor-text">
                                    <strong>Infecção aguda ou doença reumatológica</strong>
                                </div>
                            </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                            </div>
                        </div>
                        
                        <div class="risk-factor-card" onclick="togglePaduaFactor(this, 1)">
                            <div class="card-content">
                                <div class="factor-icon">⚖️</div>
                                <div class="factor-text">
                                    <strong>Obesidade</strong>
                                    <span class="factor-points">IMC ≥ 30 kg/m²</span>
                                </div>
                            </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                            </div>
                        </div>
                        
                        <div class="risk-factor-card" onclick="togglePaduaFactor(this, 1)">
                            <div class="card-content">
                                <div class="factor-icon">💊</div>
                                <div class="factor-text">
                                    <strong>Terapia hormonal em curso</strong>
                                </div>
                            </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                            </div>
                        </div>
                    </div>

                    <div id="paduaResult" class="result-box" style="display: none;">
                        <h3>Resultado Final</h3>
                        <div class="score-display">
                            <span class="score-number" id="paduaScore">0</span>
                            <span class="score-label">pontos</span>
                        </div>
                        <div class="risk-classification" id="paduaRisk"></div>
                        <div class="risk-recommendation" id="paduaRecommendation"></div>
                    </div>

                    <!-- Score Tracker -->
                    <div class="score-tracker">
                        <div class="current-score">
                            <span id="paduaCurrentScore">0</span> pontos
                        </div>
                        <div class="score-status" id="paduaStatus">
                            Selecione os fatores de risco
                        </div>
                    </div>

                    <button type="button" class="btn-reset" onclick="resetPadua()">
                        <i class="fas fa-redo"></i> Limpar Tudo
                    </button>
                </div>
            </div>

            <div class="info-box">
                <h3><i class="fas fa-info-circle"></i> Sobre a Escala de Padua</h3>
                <p>Prediz o risco de TEV em pacientes clínicos hospitalizados.</p>
                <h4>Interpretação:</h4>
                <ul>
                    <li><strong>< 4 pontos:</strong> Baixo risco - Sem profilaxia</li>
                    <li><strong>≥ 4 pontos:</strong> Alto risco - Profilaxia indicada</li>
                </ul>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
}

function togglePaduaFactor(card, points) {
    card.classList.toggle('selected');
    const icon = card.querySelector('.card-check i');
    
    if (card.classList.contains('selected')) {
        icon.classList.remove('fa-circle');
        icon.classList.add('fa-check-circle');
        card.dataset.value = points;
    } else {
        icon.classList.remove('fa-check-circle');
        icon.classList.add('fa-circle');
        delete card.dataset.value;
    }
    
    calcularPadua();
}

function calcularPadua() {
    const cards = document.querySelectorAll('#paduaForm .risk-factor-card.selected');
    let total = 0;
    
    cards.forEach(card => {
        total += parseInt(card.dataset.value) || 0;
    });
    
    // Atualizar score tracker
    document.getElementById('paduaCurrentScore').textContent = total;
    
    if (total === 0) {
        document.getElementById('paduaStatus').textContent = 'Selecione os fatores de risco';
    } else if (total < 4) {
        document.getElementById('paduaStatus').textContent = 'Baixo Risco';
    } else {
        document.getElementById('paduaStatus').textContent = 'Alto Risco - Profilaxia Indicada';
    }
    
    // Mostrar resultado final
    const scoreDisplay = document.getElementById('paduaScore');
    const riskDisplay = document.getElementById('paduaRisk');
    const recommendationDisplay = document.getElementById('paduaRecommendation');
    
    scoreDisplay.textContent = total;
    
    let riskLevel, riskClass, recommendation;
    
    if (total < 4) {
        riskLevel = 'Baixo Risco';
        riskClass = 'risk-low';
        recommendation = 'Profilaxia farmacológica NÃO indicada. Manter deambulação precoce e hidratação adequada. Reavaliar diariamente.';
    } else {
        riskLevel = 'Alto Risco';
        riskClass = 'risk-high';
        recommendation = 'Profilaxia farmacológica INDICADA: Enoxaparina 40mg SC 1x/dia ou Heparina 5.000 UI SC 8/8h ou 12/12h. Avaliar contraindicações (sangramento ativo, plaquetopenia < 50.000). Considerar profilaxia mecânica se contraindicação farmacológica.';
    }
    
    riskDisplay.className = `risk-classification ${riskClass}`;
    riskDisplay.textContent = riskLevel;
    recommendationDisplay.textContent = recommendation;
    
    document.getElementById('paduaResult').style.display = 'block';
}

function resetPadua() {
    const cards = document.querySelectorAll('#paduaForm .risk-factor-card.selected');
    cards.forEach(card => {
        card.classList.remove('selected');
        const icon = card.querySelector('.card-check i');
        icon.classList.remove('fa-check-circle');
        icon.classList.add('fa-circle');
        delete card.dataset.value;
    });
    
    document.getElementById('paduaCurrentScore').textContent = '0';
    document.getElementById('paduaStatus').textContent = 'Selecione os fatores de risco';
    document.getElementById('paduaResult').style.display = 'none';
}

function showCalculadoras() {
    console.log('🧮 Calculadoras Anestésicas clicado');

    // CRÍTICO: Ativar seção ferramentas primeiro
    showSection('ferramentas');

    // Atualizar histórico de navegação
    atualizarHistoricoNavegacao('calculadoras');

    const section = document.getElementById('ferramentasSection');
    if (!section) return false; // Explicit failure return

    const html = `
        ${renderInfoBanner('fas fa-calculator', 'Calculadoras Anestésicas', 'Ferramentas de cálculo agrupadas por especialidade para apoio à prática anestésica', '#006837 0%, #9BC53D 100%', "showSection('ferramentas')")}
        
        <div class="calculators-categories">
            <!-- Doses Pediátricas -->
            <div class="calc-category">
                <h2 class="category-title">
                    <i class="fas fa-baby"></i> Doses Pediátricas
                </h2>
                <div class="protocols-grid">
                    <div class="protocol-card" onclick="showDosesPediatricas()" style="cursor: pointer;">
                        <div class="protocol-icon" style="background: #10b981;">
                            <i class="fas fa-calculator"></i>
                        </div>
                        <div class="protocol-content">
                            <h3 class="protocol-title">Calculadora Automática</h3>
                            <p class="protocol-description">15 Drogas Essenciais</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Risco Cardiopulmonar -->
            <div class="calc-category">
                <h2 class="category-title">
                    <i class="fas fa-heartbeat"></i> Risco Cardiopulmonar
                </h2>
                <div class="protocols-grid">
                    <div class="protocol-card" onclick="showRCRI()" style="cursor: pointer;">
                        <div class="protocol-icon" style="background: #dc2626;">
                            <span style="font-size: 32px;">💓</span>
                        </div>
                        <div class="protocol-content">
                            <h3 class="protocol-title">RCRI</h3>
                            <p class="protocol-description">Risco Cardíaco Revisado</p>
                        </div>
                    </div>
                    
                    <div class="protocol-card" onclick="showGoldmanRisk()" style="cursor: pointer;">
                        <div class="protocol-icon" style="background: #b91c1c;">
                            <i class="fas fa-heart"></i>
                        </div>
                        <div class="protocol-content">
                            <h3 class="protocol-title">Goldman Cardiac Risk</h3>
                            <p class="protocol-description">Risco Cardiovascular</p>
                        </div>
                    </div>
                    
                    <div class="protocol-card" onclick="showApfelScore()" style="cursor: pointer;">
                        <div class="protocol-icon" style="background: #f59e0b;">
                            <span style="font-size: 32px;">🤢</span>
                        </div>
                        <div class="protocol-content">
                            <h3 class="protocol-title">Apfel Score</h3>
                            <p class="protocol-description">Risco de PONV</p>
                        </div>
                    </div>
                    
                    <div class="protocol-card" onclick="showARISCAT()" style="cursor: pointer;">
                        <div class="protocol-icon" style="background: #0284c7;">
                            <span style="font-size: 32px;">🫁</span>
                        </div>
                        <div class="protocol-content">
                            <h3 class="protocol-title">ARISCAT Score</h3>
                            <p class="protocol-description">Complicações Pulmonares</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Avaliação Clínica -->
            <div class="calc-category">
                <h2 class="category-title">
                    <i class="fas fa-stethoscope"></i> Avaliação Clínica
                </h2>
                <div class="protocols-grid">
                    <div class="protocol-card" onclick="showASA()" style="cursor: pointer;">
                        <div class="protocol-icon" style="background: #4f46e5;">
                            <i class="fas fa-clipboard-list"></i>
                        </div>
                        <div class="protocol-content">
                            <h3 class="protocol-title">ASA Physical Status</h3>
                            <p class="protocol-description">Classificação Pré-Anestésica</p>
                        </div>
                    </div>
                    
                    <div class="protocol-card" onclick="showSTOPBang()" style="cursor: pointer;">
                        <div class="protocol-icon" style="background: #2563eb;">
                            <span style="font-size: 32px;">😴</span>
                        </div>
                        <div class="protocol-content">
                            <h3 class="protocol-title">STOP-Bang</h3>
                            <p class="protocol-description">Risco de SAHOS</p>
                        </div>
                    </div>
                    
                    <div class="protocol-card" onclick="showGlasgow()" style="cursor: pointer;">
                        <div class="protocol-icon" style="background: #7c3aed;">
                            <span style="font-size: 32px;">🧠</span>
                        </div>
                        <div class="protocol-content">
                            <h3 class="protocol-title">Escala de Glasgow</h3>
                            <p class="protocol-description">Nível de Consciência</p>
                        </div>
                    </div>
                    
                    <div class="protocol-card" onclick="showRASS()" style="cursor: pointer;">
                        <div class="protocol-icon" style="background: #9333ea;">
                            <span style="font-size: 32px;">💤</span>
                        </div>
                        <div class="protocol-content">
                            <h3 class="protocol-title">RASS</h3>
                            <p class="protocol-description">Sedação/Agitação</p>
                        </div>
                    </div>
                    
                    <div class="protocol-card" onclick="showClearanceCreatinina()" style="cursor: pointer;">
                        <div class="protocol-icon" style="background: #0d9488;">
                            <span style="font-size: 32px;">🩺</span>
                        </div>
                        <div class="protocol-content">
                            <h3 class="protocol-title">Clearance Creatinina</h3>
                            <p class="protocol-description">Função Renal</p>
                        </div>
                    </div>
                    
                    <div class="protocol-card" onclick="showMallampati()" style="cursor: pointer;">
                        <div class="protocol-icon" style="background: #e11d48;">
                            <span style="font-size: 32px;">👄</span>
                        </div>
                        <div class="protocol-content">
                            <h3 class="protocol-title">Mallampati</h3>
                            <p class="protocol-description">Predição Intubação</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Antropométricas -->
            <div class="calc-category">
                <h2 class="category-title">
                    <i class="fas fa-weight"></i> Medidas Antropométricas
                </h2>
                <div class="protocols-grid">
                    <div class="protocol-card" onclick="showPesoIdeal()" style="cursor: pointer;">
                        <div class="protocol-icon" style="background: #059669;">
                            <i class="fas fa-balance-scale"></i>
                        </div>
                        <div class="protocol-content">
                            <h3 class="protocol-title">Peso Ideal / BSA</h3>
                            <p class="protocol-description">Cálculos Antropométricos</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Pediatria -->
            <div class="calc-category">
                <h2 class="category-title">
                    <i class="fas fa-baby"></i> Pediatria
                </h2>
                <div class="protocols-grid">
                    <div class="protocol-card" onclick="showManutencaoPediatrica()" style="cursor: pointer;">
                        <div class="protocol-icon" style="background: #0891b2;">
                            <span style="font-size: 32px;">💧</span>
                        </div>
                        <div class="protocol-content">
                            <h3 class="protocol-title">Manutenção Hídrica</h3>
                            <p class="protocol-description">Holliday-Segar</p>
                        </div>
                    </div>
                    
                    <div class="protocol-card" onclick="showFLACC()" style="cursor: pointer;">
                        <div class="protocol-icon" style="background: #ec4899;">
                            <span style="font-size: 32px;">👶</span>
                        </div>
                        <div class="protocol-content">
                            <h3 class="protocol-title">FLACC</h3>
                            <p class="protocol-description">Dor Pediátrica</p>
                        </div>
                    </div>
                    <div class="protocol-card" onclick="showTuboEndotraqueal()" style="cursor: pointer;">
                        <div class="protocol-icon" style="background: #7c3aed;">
                            <span style="font-size: 32px;">🫁</span>
                        </div>
                        <div class="protocol-content">
                            <h3 class="protocol-title">Tubo Endotraqueal</h3>
                            <p class="protocol-description">Tamanho e Profundidade</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Recuperação Pós-Anestésica -->
            <div class="calc-category">
                <h2 class="category-title">
                    <i class="fas fa-bed-pulse"></i> Recuperação Pós-Anestésica
                </h2>
                <div class="protocols-grid">
                    <div class="protocol-card" onclick="showAldrete()" style="cursor: pointer;">
                        <div class="protocol-icon" style="background: #db2777;">
                            <span style="font-size: 32px;">💪</span>
                        </div>
                        <div class="protocol-content">
                            <h3 class="protocol-title">Índice de Aldrete</h3>
                            <p class="protocol-description">Recuperação Adulto</p>
                        </div>
                    </div>
                    
                    <div class="protocol-card" onclick="showSteward()" style="cursor: pointer;">
                        <div class="protocol-icon" style="background: #0d9488;">
                            <span style="font-size: 32px;">🍼</span>
                        </div>
                        <div class="protocol-content">
                            <h3 class="protocol-title">Escala de Steward</h3>
                            <p class="protocol-description">Recuperação Pediátrica</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Conversão de Drogas -->
            <div class="calc-category">
                <h2 class="category-title">
                    <i class="fas fa-exchange-alt"></i> Drogas e Segurança
                </h2>
                <div class="protocols-grid">
                    <div class="protocol-card" onclick="showConversaoOpioides()" style="cursor: pointer;">
                        <div class="protocol-icon" style="background: #d97706;">
                            <i class="fas fa-pills"></i>
                        </div>
                        <div class="protocol-content">
                            <h3 class="protocol-title">Conversão de Opioides</h3>
                            <p class="protocol-description">Equianalgesia</p>
                        </div>
                    </div>
                    <div class="protocol-card" onclick="showDoseMaxAL()" style="cursor: pointer;">
                        <div class="protocol-icon" style="background: #dc2626;">
                            <span style="font-size: 32px;">💉</span>
                        </div>
                        <div class="protocol-content">
                            <h3 class="protocol-title">Dose Máxima AL</h3>
                            <p class="protocol-description">Anestésico Local</p>
                        </div>
                    </div>
                    <div class="protocol-card" onclick="showBloqueadores()" style="cursor: pointer;">
                        <div class="protocol-icon" style="background: #4f46e5;">
                            <span style="font-size: 32px;">🤚</span>
                        </div>
                        <div class="protocol-content">
                            <h3 class="protocol-title">Bloqueadores Neuromusculares</h3>
                            <p class="protocol-description">Guia de Dosagem</p>
                        </div>
                    </div>
                    <div class="protocol-card" onclick="showDosesAdultos()" style="cursor: pointer;">
                        <div class="protocol-icon" style="background: #059669;">
                            <i class="fas fa-book"></i>
                        </div>
                        <div class="protocol-content">
                            <h3 class="protocol-title">Doses Medicações - Adultos</h3>
                            <p class="protocol-description">60+ Medicações</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Ventilação -->
            <div class="calc-category">
                <h2 class="category-title">
                    <i class="fas fa-wind"></i> Ventilação
                </h2>
                <div class="protocols-grid">
                    <div class="protocol-card" onclick="showVolumeProtetora()" style="cursor: pointer;">
                        <div class="protocol-icon" style="background: #0284c7;">
                            <i class="fas fa-wind"></i>
                        </div>
                        <div class="protocol-content">
                            <h3 class="protocol-title">Volume Corrente Protetora</h3>
                            <p class="protocol-description">Ventilação Intraoperatória</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Analgesia e Dor -->
            <div class="calc-category">
                <h2 class="category-title">
                    <i class="fas fa-briefcase-medical"></i> Analgesia e Dor
                </h2>
                <div class="protocols-grid">
                    <div class="protocol-card" onclick="showEscalaDor()" style="cursor: pointer;">
                        <div class="protocol-icon" style="background: #e11d48;">
                            <span style="font-size: 32px;">😖</span>
                        </div>
                        <div class="protocol-content">
                            <h3 class="protocol-title">Escala de Dor</h3>
                            <p class="protocol-description">Avaliação EVA/EVN</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Hidratação e Reposição -->
            <div class="calc-category">
                <h2 class="category-title">
                    <i class="fas fa-droplet-percent"></i> Hidratação e Reposição
                </h2>
                <div class="protocols-grid">
                    <div class="protocol-card" onclick="showDeficitHidrico()" style="cursor: pointer;">
                        <div class="protocol-icon" style="background: #0891b2;">
                            <span style="font-size: 32px;">⏳</span>
                        </div>
                        <div class="protocol-content">
                            <h3 class="protocol-title">Déficit Hídrico</h3>
                            <p class="protocol-description">Reposição de Jejum</p>
                        </div>
                    </div>
                    <div class="protocol-card" onclick="showPerdasSanguineas()" style="cursor: pointer;">
                        <div class="protocol-icon" style="background: #b91c1c;">
                            <i class="fas fa-tint"></i>
                        </div>
                        <div class="protocol-content">
                            <h3 class="protocol-title">Perdas Sanguíneas</h3>
                            <p class="protocol-description">Estimativa e Reposição</p>
                        </div>
                    </div>
                    <div class="protocol-card" onclick="showPerdaMaxima()" style="cursor: pointer;">
                        <div class="protocol-icon" style="background: #7f1d1d;">
                            <span style="font-size: 32px;">🧪</span>
                        </div>
                        <div class="protocol-content">
                            <h3 class="protocol-title">Perda Máxima Permitida</h3>
                            <p class="protocol-description">Perda sem Transfusão</p>
                        </div>
                    </div>
                    <div class="protocol-card" onclick="showTransfusoes()" style="cursor: pointer;">
                        <div class="protocol-icon" style="background: #450a0a;">
                            <span style="font-size: 32px;">🩹</span>
                        </div>
                        <div class="protocol-content">
                            <h3 class="protocol-title">Transfusões Sanguíneas</h3>
                            <p class="protocol-description">Hemoderivados</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Emergência e Ressuscitação -->
            <div class="calc-category">
                <h2 class="category-title">
                    <i class="fas fa-truck-medical"></i> Emergência e Ressuscitação
                </h2>
                <div class="protocols-grid">
                    <div class="protocol-card" onclick="showIndiceChoque()" style="cursor: pointer;">
                        <div class="protocol-icon" style="background: #dc2626;">
                            <span style="font-size: 32px;">🚨</span>
                        </div>
                        <div class="protocol-content">
                            <h3 class="protocol-title">Índice de Choque</h3>
                            <p class="protocol-description">FC/PAS - Choque Hipovolêmico</p>
                        </div>
                    </div>
                    <div class="protocol-card" onclick="showEmergenciaAdultos()" style="cursor: pointer;">
                        <div class="protocol-icon" style="background: #991b1b;">
                            <span style="font-size: 32px;">💉</span>
                        </div>
                        <div class="protocol-content">
                            <h3 class="protocol-title">Drogas de Emergência</h3>
                            <p class="protocol-description">Tabela SAVA/ACLS por Peso</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    section.innerHTML = html;

    return true; // Explicit success return
}

function showDosesPediatricas() {
    console.log('💊 Calculadora de Doses Pediátricas COMPLETA (PediCalc)');

    // CRÍTICO: Ativar seção ferramentas primeiro
    showSection('ferramentas');

    if (!window.calcularDosePediCalc) {
        showToast('Erro: Dados de doses não carregados', 'error');
            return;
        }
        
    const section = document.getElementById('ferramentasSection');
    if (!section) return;
    
    // Contar total de drogas
    let totalDrogas = 0;
    Object.values(window.pediCalcData).forEach(cat => {
        totalDrogas += cat.drogas.length;
    });
    
    const html = `
        ${renderInfoBanner('fas fa-baby', 'PediCalc - Doses Pediátricas', `Calculadora automática completa - ${totalDrogas} drogas em 4 categorias`, '#10b981 0%, #059669 100%', 'showCalculadoras()')}
        
        <!-- Campo de Peso -->
        <div class="dose-calculator-input">
            <label for="pesoInput">
                <i class="fas fa-weight"></i> Peso da Criança (kg):
            </label>
            <input 
                type="number" 
                id="pesoInput" 
                placeholder="Digite o peso em kg..." 
                min="0.5" 
                max="150" 
                step="0.1"
                oninput="calcularDosesAutomatico()"
                class="peso-input"
                autofocus
            />
                    </div>
        
        <!-- Resultados -->
        <div id="dosesResultado" class="doses-resultado">
            <div class="empty-state">
                <i class="fas fa-calculator" style="font-size: 3rem; opacity: 0.3; margin-bottom: 16px;"></i>
                <p>Digite o peso da criança para calcular automaticamente as doses de <strong>${totalDrogas} drogas</strong> organizadas por categoria</p>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 8px;">
                    <i class="fas fa-heartbeat"></i> PCR &nbsp;•&nbsp; 
                    <i class="fas fa-syringe"></i> Sedação &nbsp;•&nbsp; 
                    <i class="fas fa-brain"></i> Anticonvulsivantes &nbsp;•&nbsp; 
                    <i class="fas fa-flask"></i> Antídotos
                </p>
                    </div>
                </div>
            `;
    
    section.innerHTML = html;
}

function calcularDosesAutomatico() {
    const pesoInput = document.getElementById('pesoInput');
    const resultadoDiv = document.getElementById('dosesResultado');
    
    if (!pesoInput || !resultadoDiv) return;
    
    const peso = parseFloat(pesoInput.value);
    
    // Validar peso
    if (!peso || peso <= 0 || peso > 150) {
        resultadoDiv.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; opacity: 0.3; margin-bottom: 16px; color: var(--warning);"></i>
                <p>Digite um peso válido entre 0,5 kg e 150 kg</p>
            </div>
        `;
        return;
    }
    
    // Calcular doses
    const resultados = window.calcularDosePediCalc(peso);
    
    if (!resultados || resultados.length === 0) {
        resultadoDiv.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-times-circle" style="font-size: 3rem; opacity: 0.3; margin-bottom: 16px; color: var(--error);"></i>
                <p>Erro ao calcular doses</p>
            </div>
        `;
        return;
    }
    
    // Agrupar por categoria
    const porCategoria = {};
    resultados.forEach(med => {
        if (!porCategoria[med.categoria]) {
            porCategoria[med.categoria] = [];
        }
        porCategoria[med.categoria].push(med);
    });
    
    // Exibir resultados por categoria
    resultadoDiv.innerHTML = `
        <div class="doses-info-box">
            <i class="fas fa-info-circle"></i>
            <p><strong>Peso:</strong> ${peso} kg | <strong>Drogas:</strong> ${resultados.length} calculadas</p>
        </div>
        
        ${Object.keys(porCategoria).map(categoria => `
            <div class="categoria-doses">
                <h3 class="categoria-doses-title">
                    ${categoria === 'PCR (Parada Cardiorrespiratória)' ? '<i class="fas fa-heartbeat"></i>' : ''}
                    ${categoria === 'Sedação / Analgesia / Bloqueio' ? '<i class="fas fa-syringe"></i>' : ''}
                    ${categoria === 'Anticonvulsivantes' ? '<i class="fas fa-brain"></i>' : ''}
                    ${categoria === 'Antídotos' ? '<i class="fas fa-flask"></i>' : ''}
                    ${categoria}
                </h3>
                <div class="doses-tabela-container">
                    <table class="doses-tabela">
                        <thead>
                            <tr>
                                <th>Droga</th>
                                <th>Apresentação</th>
                                <th>Dose Padrão</th>
                                <th>Diluição</th>
                                <th class="dose-final-col">Dose Final</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${porCategoria[categoria].map(med => `
                                <tr>
                                    <td><strong>${med.droga}</strong></td>
                                    <td>${med.apresentacao}</td>
                                    <td>${med.dosePadrao}</td>
                                    <td>${med.diluicao}</td>
                                    <td class="dose-final-col">
                                        <span class="dose-final-value">${med.volumeFinal} ${med.unidade}</span>
                                    </td>
                                </tr>
                                <tr class="observacao-row">
                                    <td colspan="5">
                                        <i class="fas fa-info-circle"></i> ${med.observacao}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `).join('')}
    `;
}

// ==================== RCRI (REVISED CARDIAC RISK INDEX - LEE) ====================
function showRCRI() {
    // CRÍTICO: Ativar seção ferramentas primeiro
    showSection('ferramentas');

    const section = document.getElementById('ferramentasSection');
    if (!section) return;

    const html = `
        ${renderInfoBanner('fas fa-heart-pulse', 'RCRI - Índice de Lee', 'Risco Cardíaco em Cirurgia Não-Cardíaca', '#dc2626 0%, #991b1b 100%', 'showCalculadoras()')}

        <div class="calculator-container">
            <div class="calculator-card">
                <div id="rcriForm">
                    <div class="factor-group">
                        <h4 class="group-title">
                            <i class="fas fa-heart-pulse"></i>
                            Fatores de Risco (1 ponto cada)
                        </h4>
                        
                        <div class="risk-factor-card" onclick="toggleRCRIFactor(this)">
                            <div class="card-content">
                                <div class="factor-icon">🫀</div>
                                <div class="factor-text">
                                    <strong>Cirurgia de alto risco</strong>
                                    <span class="factor-points">Intraperitoneal, intratorácica, vascular suprainguinal</span>
                                </div>
                            </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                            </div>
                        </div>
                        
                        <div class="risk-factor-card" onclick="toggleRCRIFactor(this)">
                            <div class="card-content">
                                <div class="factor-icon">💔</div>
                                <div class="factor-text">
                                    <strong>Doença arterial coronariana</strong>
                                    <span class="factor-points">IAM prévio, angina, uso de nitrato, onda Q no ECG</span>
                            </div>
                        </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                    </div>
                        </div>
                        
                        <div class="risk-factor-card" onclick="toggleRCRIFactor(this)">
                            <div class="card-content">
                                <div class="factor-icon">🧠</div>
                                <div class="factor-text">
                                    <strong>Insuficiência cardíaca</strong>
                                    <span class="factor-points">História de IC, edema pulmonar, dispneia paroxística noturna, B3</span>
                                </div>
                            </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                            </div>
                        </div>
                        
                        <div class="risk-factor-card" onclick="toggleRCRIFactor(this)">
                            <div class="card-content">
                                <div class="factor-icon">🧬</div>
                                <div class="factor-text">
                                    <strong>História de AVC ou AIT</strong>
                                </div>
                            </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                            </div>
                        </div>
                        
                        <div class="risk-factor-card" onclick="toggleRCRIFactor(this)">
                            <div class="card-content">
                                <div class="factor-icon">💉</div>
                                <div class="factor-text">
                                    <strong>Diabetes insulino-dependente</strong>
                                    <span class="factor-points">Em uso de insulina</span>
                                </div>
                            </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                            </div>
                        </div>
                        
                        <div class="risk-factor-card" onclick="toggleRCRIFactor(this)">
                            <div class="card-content">
                                <div class="factor-icon">🩺</div>
                                <div class="factor-text">
                                    <strong>Insuficiência renal</strong>
                                    <span class="factor-points">Creatinina > 2.0 mg/dL ou diálise</span>
                                </div>
                            </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                            </div>
                        </div>
                    </div>

                    <div id="rcriResult" class="result-box" style="display: none;">
                        <h3>Resultado Final</h3>
                        <div class="score-display">
                            <span class="score-number" id="rcriScore">0</span>
                            <span class="score-label">ponto(s)</span>
                        </div>
                        <div class="risk-classification" id="rcriRisk"></div>
                        <div class="risk-recommendation" id="rcriRecommendation"></div>
                    </div>

                    <!-- Score Tracker -->
                    <div class="score-tracker">
                        <div class="current-score">
                            <span id="rcriCurrentScore">0</span> ponto(s)
                        </div>
                        <div class="score-status" id="rcriStatus">
                            Selecione os fatores de risco
                        </div>
                    </div>

                    <button type="button" class="btn-reset" onclick="resetRCRI()">
                        <i class="fas fa-redo"></i> Limpar Tudo
                        </button>
                </div>
            </div>

            <div class="info-box">
                <h3><i class="fas fa-info-circle"></i> Sobre o RCRI</h3>
                <p>Estima risco de complicações cardíacas maiores em cirurgia não-cardíaca.</p>
                <h4>Interpretação:</h4>
                <ul>
                    <li><strong>0 pontos:</strong> Classe I - Risco muito baixo (0.4%)</li>
                    <li><strong>1 ponto:</strong> Classe II - Risco baixo (0.9%)</li>
                    <li><strong>2 pontos:</strong> Classe III - Risco moderado (6.6%)</li>
                    <li><strong>≥ 3 pontos:</strong> Classe IV - Risco alto (≥ 11%)</li>
                </ul>
                    </div>
                </div>
            `;
    
    section.innerHTML = html;
}

function toggleRCRIFactor(card) {
    card.classList.toggle('selected');
    const icon = card.querySelector('.card-check i');
    
    if (card.classList.contains('selected')) {
        icon.classList.remove('fa-circle');
        icon.classList.add('fa-check-circle');
    } else {
        icon.classList.remove('fa-check-circle');
        icon.classList.add('fa-circle');
    }
    
    calcularRCRI();
}

function calcularRCRI() {
    const cards = document.querySelectorAll('#rcriForm .risk-factor-card.selected');
    const total = cards.length;
    
    // Atualizar score tracker
    document.getElementById('rcriCurrentScore').textContent = total;
    
    let statusText = '';
    if (total === 0) {
        statusText = 'Selecione os fatores de risco';
    } else if (total === 1) {
        statusText = 'Classe II - Risco Baixo';
    } else if (total === 2) {
        statusText = 'Classe III - Risco Moderado';
    } else {
        statusText = 'Classe IV - Risco Alto';
    }
    document.getElementById('rcriStatus').textContent = statusText;
    
    // Mostrar resultado final
    const scoreDisplay = document.getElementById('rcriScore');
    const riskDisplay = document.getElementById('rcriRisk');
    const recommendationDisplay = document.getElementById('rcriRecommendation');
    
    scoreDisplay.textContent = total;
    
    let riskLevel, riskClass, recommendation;
    
    if (total === 0) {
        riskLevel = 'Classe I - Risco Muito Baixo (0.4%)';
        riskClass = 'risk-very-low';
        recommendation = 'Proceder com cirurgia. Considerar apenas medidas padrão de monitorização. Risco de eventos cardíacos maiores < 1%.';
    } else if (total === 1) {
        riskLevel = 'Classe II - Risco Baixo (0.9%)';
        riskClass = 'risk-low';
        recommendation = 'Proceder com cirurgia. Monitorização cardíaca intraoperatória. Considerar beta-bloqueador se já em uso. Risco de eventos cardíacos maiores ≈ 1%.';
    } else if (total === 2) {
        riskLevel = 'Classe III - Risco Moderado (6.6%)';
        riskClass = 'risk-moderate';
        recommendation = 'Considerar otimização pré-operatória. Avaliar indicação de ECG, troponina e ecocardiograma. Beta-bloqueador perioperatório. Monitorização intensiva. Risco de eventos cardíacos ≈ 7%.';
    } else {
        riskLevel = 'Classe IV - Risco Alto (≥ 11%)';
        riskClass = 'risk-high';
        recommendation = 'Otimização pré-operatória OBRIGATÓRIA. Avaliação cardiológica detalhada. Considerar exames complementares (eco stress, cintilografia, cate). Beta-bloqueador perioperatório. Monitorização invasiva. UTI pós-operatória. Risco de eventos cardíacos ≥ 11%.';
    }
    
    riskDisplay.className = `risk-classification ${riskClass}`;
    riskDisplay.textContent = riskLevel;
    recommendationDisplay.textContent = recommendation;
    
    document.getElementById('rcriResult').style.display = 'block';
}

function resetRCRI() {
    const cards = document.querySelectorAll('#rcriForm .risk-factor-card.selected');
    cards.forEach(card => {
        card.classList.remove('selected');
        const icon = card.querySelector('.card-check i');
        icon.classList.remove('fa-check-circle');
        icon.classList.add('fa-circle');
    });
    
    document.getElementById('rcriCurrentScore').textContent = '0';
    document.getElementById('rcriStatus').textContent = 'Selecione os fatores de risco';
    document.getElementById('rcriResult').style.display = 'none';
}

// ==================== APFEL SCORE (PONV RISK) ====================
function showApfelScore() {
    // CRÍTICO: Ativar seção ferramentas primeiro
    showSection('ferramentas');

    const section = document.getElementById('ferramentasSection');
    if (!section) return;

    const html = `
        ${renderInfoBanner('fas fa-pills', 'Apfel Score', 'Risco de Náusea e Vômito Pós-Operatório (PONV)', '#f59e0b 0%, #d97706 100%', 'showCalculadoras()')}

        <div class="calculator-container">
            <div class="calculator-card">
                <div id="apfelForm">
                    <div class="factor-group">
                        <h4 class="group-title">
                            <i class="fas fa-exclamation-triangle"></i>
                            Fatores de Risco (1 ponto cada)
                        </h4>
                        
                        <div class="risk-factor-card" onclick="toggleApfelFactor(this)">
                            <div class="card-content">
                                <div class="factor-icon">👩</div>
                                <div class="factor-text">
                                    <strong>Sexo feminino</strong>
                            </div>
                            </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                        </div>
                        </div>
                        
                        <div class="risk-factor-card" onclick="toggleApfelFactor(this)">
                            <div class="card-content">
                                <div class="factor-icon">🚭</div>
                                <div class="factor-text">
                                    <strong>Não fumante</strong>
                                    <span class="factor-points">Nunca fumou ou parou há mais de 1 ano</span>
                                </div>
                            </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                            </div>
                        </div>
                        
                        <div class="risk-factor-card" onclick="toggleApfelFactor(this)">
                            <div class="card-content">
                                <div class="factor-icon">🤢</div>
                                <div class="factor-text">
                                    <strong>História de PONV ou cinetose</strong>
                                    <span class="factor-points">Náusea/vômito pós-operatório prévio ou enjoo de movimento</span>
                                </div>
                            </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                            </div>
                        </div>
                        
                        <div class="risk-factor-card" onclick="toggleApfelFactor(this)">
                            <div class="card-content">
                                <div class="factor-icon">💊</div>
                                <div class="factor-text">
                                    <strong>Uso de opioides pós-operatórios</strong>
                                    <span class="factor-points">Expectativa de uso de opioides no pós-operatório</span>
                                </div>
                            </div>
                            <div class="card-check">
                                <i class="fas fa-circle"></i>
                            </div>
                        </div>
                    </div>

                    <div id="apfelResult" class="result-box" style="display: none;">
                        <h3>Resultado Final</h3>
                        <div class="score-display">
                            <span class="score-number" id="apfelScore">0</span>
                            <span class="score-label">ponto(s)</span>
                        </div>
                        <div class="risk-classification" id="apfelRisk"></div>
                        <div class="risk-recommendation" id="apfelRecommendation"></div>
                    </div>

                    <!-- Score Tracker -->
                    <div class="score-tracker">
                        <div class="current-score">
                            <span id="apfelCurrentScore">0</span> ponto(s)
                        </div>
                        <div class="score-status" id="apfelStatus">
                            Selecione os fatores de risco
                        </div>
                    </div>

                    <button type="button" class="btn-reset" onclick="resetApfel()">
                        <i class="fas fa-redo"></i> Limpar Tudo
                            </button>
                        </div>
                    </div>

            <div class="info-box">
                <h3><i class="fas fa-info-circle"></i> Sobre o Apfel Score</h3>
                <p>Prediz risco de PONV em cirurgias com anestesia geral.</p>
                <h4>Interpretação:</h4>
                <ul>
                    <li><strong>0 pontos:</strong> Risco muito baixo (10%)</li>
                    <li><strong>1 ponto:</strong> Risco baixo (20%)</li>
                    <li><strong>2 pontos:</strong> Risco moderado (40%)</li>
                    <li><strong>3 pontos:</strong> Risco alto (60%)</li>
                    <li><strong>4 pontos:</strong> Risco muito alto (80%)</li>
                </ul>
            </div>
                </div>
            `;
    
    section.innerHTML = html;
}

function toggleApfelFactor(card) {
    card.classList.toggle('selected');
    const icon = card.querySelector('.card-check i');
    
    if (card.classList.contains('selected')) {
        icon.classList.remove('fa-circle');
        icon.classList.add('fa-check-circle');
    } else {
        icon.classList.remove('fa-check-circle');
        icon.classList.add('fa-circle');
    }
    
    calcularApfel();
}

function calcularApfel() {
    const cards = document.querySelectorAll('#apfelForm .risk-factor-card.selected');
    const total = cards.length;
    
    // Atualizar score tracker
    document.getElementById('apfelCurrentScore').textContent = total;
    
    const risks = ['10%', '20%', '40%', '60%', '80%'];
    const labels = ['Muito Baixo', 'Baixo', 'Moderado', 'Alto', 'Muito Alto'];
    
    if (total === 0) {
        document.getElementById('apfelStatus').textContent = 'Selecione os fatores de risco';
    } else {
        document.getElementById('apfelStatus').textContent = `Risco ${labels[total]} (${risks[total]})`;
    }
    
    // Mostrar resultado final
    const scoreDisplay = document.getElementById('apfelScore');
    const riskDisplay = document.getElementById('apfelRisk');
    const recommendationDisplay = document.getElementById('apfelRecommendation');
    
    scoreDisplay.textContent = total;
    
    let riskLevel, riskClass, recommendation;
    
    if (total === 0) {
        riskLevel = 'Risco Muito Baixo (10%)';
        riskClass = 'risk-very-low';
        recommendation = 'Profilaxia NÃO necessária. Tratamento apenas se sintomas ocorrerem.';
    } else if (total === 1) {
        riskLevel = 'Risco Baixo (20%)';
        riskClass = 'risk-low';
        recommendation = 'Considerar monoterapia profilática: Dexametasona 4-8mg IV no início da cirurgia OU Ondansetrona 4mg IV no final.';
    } else if (total === 2) {
        riskLevel = 'Risco Moderado (40%)';
        riskClass = 'risk-moderate';
        recommendation = 'PROFILAXIA INDICADA com dupla terapia: Dexametasona 4-8mg IV (início) + Ondansetrona 4mg IV (final). Evitar N2O se possível. Usar TIVA ou propofol.';
    } else if (total === 3) {
        riskLevel = 'Risco Alto (60%)';
        riskClass = 'risk-high';
        recommendation = 'PROFILAXIA MULTIMODAL: Dexametasona 8mg IV + Ondansetrona 4mg IV + Droperidol 0.625mg IV OU Metoclopramida 10mg IV. Usar TIVA (propofol). EVITAR: N2O, gases halogenados, opioides (usar multimodal).';
    } else {
        riskLevel = 'Risco Muito Alto (80%)';
        riskClass = 'risk-very-high';
        recommendation = 'PROFILAXIA AGRESSIVA: Dexametasona 8mg + Ondansetrona 4mg + Droperidol 0.625mg + Escopolamina transdérmica (aplicar 2h antes). TIVA obrigatória. Analgesia multimodal SEM opioides (bloqueios regionais). Hidratação generosa.';
    }
    
    riskDisplay.className = `risk-classification ${riskClass}`;
    riskDisplay.textContent = riskLevel;
    recommendationDisplay.textContent = recommendation;
    
    document.getElementById('apfelResult').style.display = 'block';
}

function resetApfel() {
    const cards = document.querySelectorAll('#apfelForm .risk-factor-card.selected');
    cards.forEach(card => {
        card.classList.remove('selected');
        const icon = card.querySelector('.card-check i');
        icon.classList.remove('fa-check-circle');
        icon.classList.add('fa-circle');
    });
    
    document.getElementById('apfelCurrentScore').textContent = '0';
    document.getElementById('apfelStatus').textContent = 'Selecione os fatores de risco';
    document.getElementById('apfelResult').style.display = 'none';
}

// ==================== SISTEMA DE PENDÊNCIAS COMPLETO ====================
// Implementação do sistema de pendências com dados reais do Firebase

/**
 * Carregar TODAS as pendências do usuário de múltiplas fontes
 * - Comunicados novos não lidos (criados após a conta do usuário)
 * - Documentos novos não visualizados (adicionados após a criação da conta do usuário)
 * - Novas funcionalidades não visualizadas
 * - ROPs não concluídas agrupadas por macroárea com percentuais
 */
async function loadPendenciasCompletas() {
    console.log('🔍 [PENDÊNCIAS COMPLETAS] Iniciando carregamento...');
    
    try {
        if (!currentUser || !userProfile) {
            console.log('❌ [PENDÊNCIAS] Usuário não autenticado ou perfil não carregado');
            const list = document.getElementById('pendencias-list');
            if (list) {
                list.innerHTML = 
                    '<p style="text-align: center; color: var(--cor-texto-claro);">Faça login para ver suas pendências.</p>';
            }
            return;
        }
        
        const list = document.getElementById('pendencias-list');
        if (!list) {
            console.error('❌ [PENDÊNCIAS] Elemento pendencias-list não encontrado');
            return;
        }
        
        // Obter data de criação da conta do usuário
        const userCreatedAt = userProfile.createdAt ? 
            (userProfile.createdAt.toDate ? userProfile.createdAt.toDate() : new Date(userProfile.createdAt.seconds * 1000)) : 
            new Date();
        
        console.log(`📅 [PENDÊNCIAS] Conta do usuário criada em: ${userCreatedAt.toLocaleDateString('pt-BR')}`);
        
        const pendencias = [];
        
        // ========== 1. COMUNICADOS NOVOS NÃO LIDOS ==========
        console.log('📡 [PENDÊNCIAS] Buscando comunicados novos não lidos...');
        try {
            let comunicadosSnapshot;
            try {
                comunicadosSnapshot = await db.collection('comunicados')
                    .orderBy('createdAt', 'desc')
                    .limit(50)
                    .get();
            } catch (orderError) {
                console.warn('⚠️ [PENDÊNCIAS] Erro com orderBy, tentando sem...');
                comunicadosSnapshot = await db.collection('comunicados').limit(50).get();
            }
            
            if (!comunicadosSnapshot.empty) {
                // Buscar comunicados já lidos
                const lidosSnapshot = await db.collection('usuarios').doc(currentUser.uid)
                    .collection('comunicados_lidos').get();
                const comunicadosLidos = [];
                lidosSnapshot.forEach(doc => comunicadosLidos.push(doc.id));
                
                // Filtrar apenas comunicados NOVOS (criados após a conta do usuário) e não lidos
                comunicadosSnapshot.forEach(doc => {
                    const data = doc.data();
                    // Aceitar tanto 'titulo' quanto 'title' (compatibilidade)
                    const titulo = data.titulo || data.title;
                    const conteudo = data.conteudo || data.content;
                    
                    if (!titulo || !conteudo || comunicadosLidos.includes(doc.id)) return;
                    
                    const comunicadoCreatedAt = data.createdAt ? 
                        (data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt.seconds * 1000)) : 
                        new Date();
                    
                    // Apenas comunicados criados após a criação da conta do usuário
                    if (comunicadoCreatedAt >= userCreatedAt) {
                        const date = comunicadoCreatedAt;
                        const daysAgo = Math.floor((new Date() - date) / (1000 * 60 * 60 * 24));
                        pendencias.push({
                            id: doc.id,
                            tipo: 'comunicado',
                            titulo: titulo,
                            descricao: `Publicado ${daysAgo === 0 ? 'hoje' : daysAgo === 1 ? 'ontem' : `há ${daysAgo} dias`} - ${conteudo.substring(0, 80) + (conteudo.length > 80 ? '...' : '')}`,
                            icone: '📢',
                            prioridade: data.prioridade === 'alta' || data.priority === 'alta' ? 'alta' : 
                                       data.prioridade === 'media' || data.priority === 'media' ? 'media' : 'baixa',
                            data: date,
                            createdAt: date,
                            acao: () => window.abrirComunicadoEPendencias(doc.id)
                        });
                    }
                });
                console.log(`✅ [PENDÊNCIAS] ${pendencias.filter(p => p.tipo === 'comunicado').length} comunicados novos não lidos`);
            }
        } catch (error) {
            console.error('❌ [PENDÊNCIAS] Erro ao carregar comunicados:', error);
        }
        
        // ========== 2. DOCUMENTOS NOVOS NÃO VISUALIZADOS ==========
        console.log('📡 [PENDÊNCIAS] Buscando documentos novos não visualizados...');
        try {
            let docsSnapshot;
            try {
                docsSnapshot = await db.collection('documentos')
                    .orderBy('uploadedAt', 'desc')
                    .limit(50)
                    .get();
            } catch (orderError) {
                console.warn('⚠️ [PENDÊNCIAS] Erro com orderBy em documentos, tentando sem...');
                docsSnapshot = await db.collection('documentos').limit(50).get();
            }
            
            if (!docsSnapshot.empty) {
                // Buscar documentos já visualizados pelo usuário
                const docsVisualizadosSnapshot = await db.collection('usuarios').doc(currentUser.uid)
                    .collection('documentos_visualizados').get();
                const docsVisualizados = [];
                docsVisualizadosSnapshot.forEach(doc => docsVisualizados.push(doc.id));
                
                // Filtrar apenas documentos NOVOS (adicionados após a criação da conta do usuário) e não visualizados
                docsSnapshot.forEach(doc => {
                    const data = doc.data();
                    if (!data.title || docsVisualizados.includes(doc.id)) return;
                    
                    const docUploadedAt = data.uploadedAt ? 
                        (data.uploadedAt.toDate ? data.uploadedAt.toDate() : new Date(data.uploadedAt.seconds * 1000)) : 
                        new Date();
                    
                    // Apenas documentos adicionados após a criação da conta do usuário
                    if (docUploadedAt >= userCreatedAt) {
                        const date = docUploadedAt;
                        const daysAgo = Math.floor((new Date() - date) / (1000 * 60 * 60 * 24));
                        pendencias.push({
                            id: doc.id,
                            tipo: 'documento',
                            titulo: data.title || data.fileName,
                            descricao: `Adicionado ${daysAgo === 0 ? 'hoje' : daysAgo === 1 ? 'ontem' : `há ${daysAgo} dias`} por ${data.uploadedBy || 'Administrador'}`,
                            icone: '📄',
                            prioridade: 'media',
                            data: date,
                            createdAt: date,
                            fileURL: data.fileURL || '',
                            acao: () => window.abrirDocumentoEPendencias(doc.id, data.fileURL)
                        });
                    }
                });
                console.log(`✅ [PENDÊNCIAS] ${pendencias.filter(p => p.tipo === 'documento').length} documentos novos não visualizados`);
            }
        } catch (error) {
            console.error('❌ [PENDÊNCIAS] Erro ao carregar documentos:', error);
        }
        
        // ========== 3. NOVAS FUNCIONALIDADES ==========
        console.log('📡 [PENDÊNCIAS] Buscando novas funcionalidades...');
        try {
            let funcionalidadesSnapshot;
            try {
                funcionalidadesSnapshot = await db.collection('funcionalidades')
                    .orderBy('createdAt', 'desc')
                    .limit(20)
                    .get();
            } catch (orderError) {
                funcionalidadesSnapshot = await db.collection('funcionalidades').limit(20).get();
            }
            
            if (!funcionalidadesSnapshot.empty) {
                // Buscar funcionalidades já visualizadas
                const funcVisualizadasSnapshot = await db.collection('usuarios').doc(currentUser.uid)
                    .collection('funcionalidades_visualizadas').get();
                const funcVisualizadas = [];
                funcVisualizadasSnapshot.forEach(doc => funcVisualizadas.push(doc.id));
                
                funcionalidadesSnapshot.forEach(doc => {
                    const data = doc.data();
                    if (!data.titulo || funcVisualizadas.includes(doc.id)) return;
                    
                    const funcCreatedAt = data.createdAt ? 
                        (data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt.seconds * 1000)) : 
                        new Date();
                    
                    // Apenas funcionalidades criadas após a criação da conta do usuário
                    if (funcCreatedAt >= userCreatedAt) {
                        pendencias.push({
                            id: doc.id,
                            tipo: 'funcionalidade',
                            titulo: data.titulo,
                            descricao: data.descricao || 'Nova funcionalidade disponível',
                            icone: '✨',
                            prioridade: data.prioridade || 'media',
                            data: funcCreatedAt,
                            createdAt: funcCreatedAt,
                            rota: data.rota || null,
                            acao: () => window.abrirFuncionalidadeEPendencias(doc.id, data.rota)
                        });
                    }
                });
                console.log(`✅ [PENDÊNCIAS] ${pendencias.filter(p => p.tipo === 'funcionalidade').length} novas funcionalidades`);
            }
        } catch (error) {
            console.error('❌ [PENDÊNCIAS] Erro ao carregar funcionalidades:', error);
        }
        
        // ========== 4. ROPs NÃO CONCLUÍDAS POR MACROÁREA ==========
        console.log('📡 [PENDÊNCIAS] Verificando ROPs não concluídas por macroárea...');
        try {
            if (typeof window.ropsData !== 'undefined' && window.ropsData) {
                const userProgress = userProfile?.progress || {};
                const macroAreasPendentes = {};
                
                // Agrupar ROPs por macroárea
                Object.keys(window.ropsData).forEach(macroKey => {
                    const macro = window.ropsData[macroKey];
                    if (!macro || !macro.subdivisoes) return;
                    
                    let totalROPs = 0;
                    let ropsCompletas = 0;
                    const ropsPendentes = [];
                    
                    Object.keys(macro.subdivisoes).forEach(ropKey => {
                        totalROPs++;
                        const rop = macro.subdivisoes[ropKey];
                        const isCompleta = userProgress[macroKey] && userProgress[macroKey][ropKey];
                        
                        if (isCompleta) {
                            ropsCompletas++;
                        } else {
                            ropsPendentes.push({
                                key: ropKey,
                                titulo: rop.title || ropKey,
                                macroKey: macroKey
                            });
                        }
                    });
                    
                    const percentualCompleto = totalROPs > 0 ? Math.round((ropsCompletas / totalROPs) * 100) : 0;
                    
                    // Adicionar como pendente se não estiver 100% completa
                    if (percentualCompleto < 100 && ropsPendentes.length > 0) {
                        macroAreasPendentes[macroKey] = {
                            macroKey: macroKey,
                            titulo: macro.title || macroKey,
                            totalROPs: totalROPs,
                            completas: ropsCompletas,
                            pendentes: ropsPendentes.length,
                            percentualCompleto: percentualCompleto,
                            percentualPendente: 100 - percentualCompleto
                        };
                    }
                });
                
                // Criar pendências para cada macroárea
                Object.values(macroAreasPendentes).forEach(macro => {
                    pendencias.push({
                        id: `macro_${macro.macroKey}`,
                        tipo: 'rop_macroarea',
                        titulo: macro.titulo,
                        descricao: `${macro.pendentes} de ${macro.totalROPs} ROPs pendentes`,
                        icone: '🏆',
                        prioridade: macro.percentualCompleto < 30 ? 'alta' : macro.percentualCompleto < 70 ? 'media' : 'baixa',
                        data: new Date(),
                        progresso: macro.percentualCompleto,
                        percentualPendente: macro.percentualPendente,
                        macroKey: macro.macroKey,
                        acao: () => window.abrirROPMacroAreaEPendencias(macro.macroKey)
                    });
                });
                
                console.log(`✅ [PENDÊNCIAS] ${Object.keys(macroAreasPendentes).length} macroáreas com ROPs pendentes`);
            }
        } catch (error) {
            console.error('❌ [PENDÊNCIAS] Erro ao carregar ROPs:', error);
        }
        
        console.log(`📊 [PENDÊNCIAS] Total de pendências: ${pendencias.length}`);
        
        // ========== RENDERIZAR PENDÊNCIAS ==========
        if (pendencias.length === 0) {
            console.log('✅ [PENDÊNCIAS] Nenhuma pendência encontrada!');
            list.innerHTML = `
                <div style="text-align: center; padding: 40px 20px;">
                    <i class="fas fa-inbox" style="font-size: 3rem; color: var(--cor-texto-claro); margin-bottom: 15px; opacity: 0.5;"></i>
                    <p style="color: var(--cor-texto-claro); font-size: 1.1rem; font-weight: 500;">Não há pendências</p>
                    <p style="color: var(--cor-texto-claro); margin-top: 10px; font-size: 0.9rem;">A pasta está vazia e sem pendências no momento.</p>
                    <p style="color: var(--cor-texto-claro); margin-top: 8px; font-size: 0.85rem; opacity: 0.7;">Novos comunicados, documentos e funcionalidades aparecerão aqui quando forem adicionados.</p>
                </div>
            `;
            return;
        }
        
        // Ordenar por prioridade e data
        pendencias.sort((a, b) => {
            const prioridades = { 'alta': 0, 'media': 1, 'baixa': 2 };
            const priA = prioridades[a.prioridade] || 2;
            const priB = prioridades[b.prioridade] || 2;
            if (priA !== priB) return priA - priB;
            return b.data - a.data;
        });
        
        // Agrupar por tipo
        const comunicados = pendencias.filter(p => p.tipo === 'comunicado');
        const documentos = pendencias.filter(p => p.tipo === 'documento');
        const funcionalidades = pendencias.filter(p => p.tipo === 'funcionalidade');
        const ropsMacroAreas = pendencias.filter(p => p.tipo === 'rop_macroarea');
        
        let html = `<div class="pendencias-container">`;
        
        // Comunicados
        if (comunicados.length > 0) {
            html += `
                <div class="pendencia-section">
                    <h3 class="pendencia-title">
                        <i class="fas fa-bullhorn"></i>
                        Comunicados Não Lidos
                    </h3>
                    <div class="pendencia-list" id="comunicados-pendentes">
            `;
            comunicados.forEach(p => {
                const priorityIcon = p.prioridade === 'alta' ? 'fa-exclamation-circle' : 
                                    p.prioridade === 'media' ? 'fa-info-circle' : 'fa-check-circle';
                html += `
                    <div class="pendencia-item" onclick="window.abrirComunicadoEPendencias('${p.id}')" style="cursor: pointer;">
                        <div class="pendencia-icon" style="color: ${p.prioridade === 'alta' ? '#dc2626' : p.prioridade === 'media' ? '#f59e0b' : '#059669'};">
                            <i class="fas ${priorityIcon}"></i>
                            </div>
                        <div class="pendencia-content">
                            <h4>${p.titulo}</h4>
                            <p>${p.descricao}</p>
                            <span class="pendencia-date">${p.data ? new Date(p.data).toLocaleDateString('pt-BR') : 'Recente'}</span>
                        </div>
                        <button class="btn-action" onclick="event.stopPropagation(); window.abrirComunicadoEPendencias('${p.id}')">
                            <i class="fas fa-eye"></i>
                            </button>
                    </div>
                `;
            });
            html += `</div></div>`;
        }
        
        // Documentos
        if (documentos.length > 0) {
            html += `
                <div class="pendencia-section">
                    <h3 class="pendencia-title">
                        <i class="fas fa-file-alt"></i>
                        Documentos para Revisar
                    </h3>
                    <div class="pendencia-list" id="documentos-pendentes">
            `;
            documentos.forEach(p => {
                const fileURL = (p.fileURL || '').replace(/'/g, "\\'");
                html += `
                    <div class="pendencia-item" onclick="window.abrirDocumentoEPendencias('${p.id}', '${fileURL}')" style="cursor: pointer;">
                        <div class="pendencia-icon" style="color: #2563eb;">
                            <i class="fas fa-file-pdf"></i>
                            </div>
                        <div class="pendencia-content">
                            <h4>${p.titulo}</h4>
                            <p>${p.descricao}</p>
                            <span class="pendencia-date">${p.data ? new Date(p.data).toLocaleDateString('pt-BR') : 'Recente'}</span>
                        </div>
                        <button class="btn-action" onclick="event.stopPropagation(); window.abrirDocumentoEPendencias('${p.id}', '${fileURL}')">
                            <i class="fas fa-eye"></i>
                            </button>
                        </div>
                `;
            });
            html += `</div></div>`;
        }
        
        // Funcionalidades
        if (funcionalidades.length > 0) {
            html += `
                <div class="pendencia-section">
                    <h3 class="pendencia-title">
                        <i class="fas fa-star"></i>
                        Novas Funcionalidades
                    </h3>
                    <div class="pendencia-list" id="funcionalidades-pendentes">
            `;
            funcionalidades.forEach(p => {
                const rota = (p.rota || '').replace(/'/g, "\\'");
                html += `
                    <div class="pendencia-item" onclick="window.abrirFuncionalidadeEPendencias('${p.id}', '${rota}')" style="cursor: pointer;">
                        <div class="pendencia-icon" style="color: #7c3aed;">
                            <i class="fas fa-rocket"></i>
                        </div>
                        <div class="pendencia-content">
                            <h4>${p.titulo}</h4>
                            <p>${p.descricao}</p>
                            <span class="pendencia-date">${p.data ? new Date(p.data).toLocaleDateString('pt-BR') : 'Recente'}</span>
                        </div>
                        <button class="btn-action" onclick="event.stopPropagation(); window.abrirFuncionalidadeEPendencias('${p.id}', '${rota}')">
                            <i class="fas fa-play"></i>
                        </button>
                    </div>
                `;
            });
            html += `</div></div>`;
        }
        
        // ROPs por Macroárea
        if (ropsMacroAreas.length > 0) {
            html += `
                <div class="pendencia-section">
                    <h3 class="pendencia-title">
                        <i class="fas fa-graduation-cap"></i>
                        Desafios ROPs por Macroárea
                    </h3>
                    <div class="pendencia-list" id="rops-pendentes">
            `;
            ropsMacroAreas.forEach(p => {
                const progressPercent = Math.round(p.progresso || 0);
                html += `
                    <div class="pendencia-item" onclick="window.abrirROPMacroAreaEPendencias('${p.macroKey}')" style="cursor: pointer;">
                        <div class="pendencia-icon" style="color: #f59e0b;">
                            <i class="fas fa-trophy"></i>
                                </div>
                        <div class="pendencia-content" style="flex: 1;">
                            <h4>${p.titulo}</h4>
                            <p>${p.descricao}</p>
                            <div style="margin-top: 8px; padding: 8px; background: rgba(0,0,0,0.05); border-radius: 4px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                    <span style="font-size: 0.85rem; color: var(--cor-texto-claro);">${progressPercent}% completo</span>
                                    <span style="font-size: 0.85rem; color: var(--cor-aviso); font-weight: bold;">${p.percentualPendente}% pendente</span>
                            </div>
                                <div style="background: #e5e7eb; border-radius: 4px; height: 6px; overflow: hidden;">
                                    <div style="background: ${progressPercent < 30 ? '#dc2626' : progressPercent < 70 ? '#f59e0b' : '#059669'}; height: 100%; width: ${progressPercent}%; transition: width 0.3s ease;"></div>
                        </div>
                            </div>
                        </div>
                        <button class="btn-action" onclick="event.stopPropagation(); window.abrirROPMacroAreaEPendencias('${p.macroKey}')">
                            <i class="fas fa-play"></i>
                        </button>
                    </div>
                `;
            });
            html += `</div></div>`;
        }
        
        html += `</div>`;
        
        list.innerHTML = html;
        console.log('✅ [PENDÊNCIAS] Renderização concluída!');
        
    } catch (error) {
        console.error('❌ [PENDÊNCIAS] Erro geral:', error);
        const list = document.getElementById('pendencias-list');
        if (list) {
            list.innerHTML = `
                <div style="text-align: center; padding: 40px 20px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: var(--cor-perigo); margin-bottom: 15px;"></i>
                    <p style="color: var(--cor-perigo); font-size: 1.1rem;">Erro ao carregar pendências</p>
                    <p style="color: var(--cor-texto-claro); font-size: 0.9rem; margin-top: 10px;">${error.message}</p>
                </div>
            `;
        }
    }
}

/**
 * Abrir comunicado e marcar como lido (remove da pendência)
 */
window.abrirComunicadoEPendencias = async function(comunicadoId) {
    console.log(`📢 [PENDÊNCIAS] Abrindo comunicado: ${comunicadoId}`);
    
    try {
        if (!currentUser) return;
        
        // Buscar dados do comunicado
        const comunicadoDoc = await db.collection('comunicados').doc(comunicadoId).get();
        if (!comunicadoDoc.exists) {
            showToast('Comunicado não encontrado', 'error');
            return;
        }
        
        const comunicado = comunicadoDoc.data();
        
        // Navegar para a página de comunicados primeiro
        if (typeof showComunicados === 'function') {
            await showComunicados();
            
            // Aguardar carregamento e destacar o comunicado
            setTimeout(() => {
                // Tentar destacar o comunicado específico
                const comunicadoEl = document.querySelector(`[data-comunicado-id="${comunicadoId}"]`);
                if (comunicadoEl) {
                    comunicadoEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    comunicadoEl.style.border = '2px solid var(--primary-medium)';
                    comunicadoEl.style.boxShadow = '0 0 10px rgba(0, 110, 55, 0.3)';
                    setTimeout(() => {
                        comunicadoEl.style.border = '';
                        comunicadoEl.style.boxShadow = '';
                    }, 3000);
                }
            }, 500);
        } else {
            // Fallback: mostrar comunicado diretamente na seção
            const section = document.getElementById('painelSection');
            if (section) {
                section.innerHTML = `
                    ${renderInfoBanner('fas fa-bullhorn', comunicado.title || comunicado.titulo || 'Comunicado', 'Visualização do comunicado', '#2563eb 0%, #3b82f6 100%', 'showPendencias()')}
                    <div style="padding: 20px;">
                        <div style="background: var(--cor-card); padding: 16px; border-radius: 12px; margin-bottom: 20px;">
                            <p style="color: var(--cor-texto); white-space: pre-wrap;">${comunicado.content || comunicado.conteudo || ''}</p>
                            ${comunicado.link ? `<p style="margin-top: 16px;"><a href="${comunicado.link}" target="_blank" style="color: var(--primary-medium);">${comunicado.link}</a></p>` : ''}
                        </div>
                    </div>
                `;
            }
        }
        
        // Marcar como lido automaticamente ao visualizar
            await db.collection('usuarios').doc(currentUser.uid)
            .collection('comunicados_lidos').doc(comunicadoId).set({
                    readAt: firebase.firestore.FieldValue.serverTimestamp(),
                comunicadoId: comunicadoId
            });
        
        // Recarregar pendências
        setTimeout(() => {
            loadPendenciasCompletas();
            atualizarContadorPendencias();
        }, 500);
        
    } catch (error) {
        console.error('❌ [PENDÊNCIAS] Erro ao abrir comunicado:', error);
        showToast('Erro ao abrir comunicado', 'error');
    }
};

/**
 * Abrir documento e marcar como visualizado (remove da pendência)
 */
window.abrirDocumentoEPendencias = async function(documentoId, fileURL) {
    console.log(`📄 [PENDÊNCIAS] Abrindo documento: ${documentoId}`);
    
    try {
        if (!currentUser) return;
        
        // Abrir documento em nova aba se tiver URL
        if (fileURL) {
            window.open(fileURL, '_blank');
        } else {
            // Buscar dados do documento
            const docDoc = await db.collection('documentos').doc(documentoId).get();
            if (docDoc.exists) {
                const data = docDoc.data();
                if (data.fileURL) {
                    window.open(data.fileURL, '_blank');
                }
            }
        }
        
        // Marcar como visualizado automaticamente ao abrir
            await db.collection('usuarios').doc(currentUser.uid)
            .collection('documentos_visualizados').doc(documentoId).set({
                    viewedAt: firebase.firestore.FieldValue.serverTimestamp(),
                documentoId: documentoId
            });
        
        showToast('Documento aberto e marcado como visualizado', 'success');
        
        // Recarregar pendências
        setTimeout(() => {
            loadPendenciasCompletas();
            atualizarContadorPendencias();
        }, 500);
        
    } catch (error) {
        console.error('❌ [PENDÊNCIAS] Erro ao abrir documento:', error);
        showToast('Erro ao abrir documento', 'error');
    }
};

/**
 * Abrir funcionalidade e marcar como visualizada (remove da pendência)
 */
window.abrirFuncionalidadeEPendencias = async function(funcionalidadeId, rota) {
    console.log(`✨ [PENDÊNCIAS] Abrindo funcionalidade: ${funcionalidadeId}`);
    
    try {
        if (!currentUser) return;
        
        // Navegar para a rota da funcionalidade se fornecida
        if (rota) {
            // Tentar showSection primeiro (função principal de navegação)
            if (typeof showSection === 'function') {
                showSection(rota);
            } else if (typeof navigateTo === 'function') {
                navigateTo(rota);
            } else {
                // Tentar chamar função diretamente baseada na rota
                const functionName = rota.charAt(0).toUpperCase() + rota.slice(1).replace(/-([a-z])/g, (g) => g[1].toUpperCase());
                if (typeof window['show' + functionName] === 'function') {
                    window['show' + functionName]();
                } else {
                    showToast('Navegando para funcionalidade...', 'info');
                }
            }
        } else {
            showToast('Funcionalidade aberta!', 'success');
        }
        
        // Marcar como visualizada
        await db.collection('usuarios').doc(currentUser.uid)
            .collection('funcionalidades_visualizadas').doc(funcionalidadeId).set({
                viewedAt: firebase.firestore.FieldValue.serverTimestamp(),
                funcionalidadeId: funcionalidadeId
            });
        
        // Recarregar pendências
        setTimeout(() => {
            loadPendenciasCompletas();
            atualizarContadorPendencias();
        }, 500);
        
    } catch (error) {
        console.error('❌ [PENDÊNCIAS] Erro ao abrir funcionalidade:', error);
        showToast('Erro ao abrir funcionalidade', 'error');
    }
};

/**
 * Abrir ROPs de uma macroárea e atualizar pendências ao concluir atividades
 */
window.abrirROPMacroAreaEPendencias = async function(macroKey) {
    console.log(`🏆 [PENDÊNCIAS] Abrindo ROPs da macroárea: ${macroKey}`);
    
    try {
        // Navegar para a página de ROPs Desafio
        if (typeof showROPsDesafio === 'function') {
            showROPsDesafio();
            
            // Aguardar carregamento e chamar showROPsChoiceMenu para expandir a macroárea
            setTimeout(() => {
                if (typeof showROPsChoiceMenu === 'function') {
                    showROPsChoiceMenu(macroKey);
                } else if (typeof showMacroArea === 'function') {
                    // Usar showMacroArea se existir
                    showMacroArea(macroKey);
                } else {
                    // Tentar encontrar e clicar no card da macroárea
                    const macroCard = Array.from(document.querySelectorAll('.menu-card')).find(card => {
                        const onclick = card.getAttribute('onclick');
                        return onclick && onclick.includes(`showROPsChoiceMenu('${macroKey}')`);
                    });
                    if (macroCard) {
                        macroCard.click();
                    }
                }
            }, 500);
        } else if (typeof showROPs === 'function') {
            // Fallback para showROPs antigo
            showROPs();
            
            setTimeout(() => {
                if (typeof showMacroArea === 'function') {
                    showMacroArea(macroKey);
                }
            }, 500);
        } else {
            showToast('Erro: Página de ROPs não disponível', 'error');
        }
        
        // As pendências serão atualizadas automaticamente quando o usuário completar ROPs
        // pois o progresso é salvo em userProfile.progress
        
    } catch (error) {
        console.error('❌ [PENDÊNCIAS] Erro ao abrir ROPs:', error);
        showToast('Erro ao abrir ROPs', 'error');
    }
};

/**
 * Marcar pendência como resolvida (redirecionador inteligente)
 * NOTA: Esta função NÃO deve ser chamada diretamente. Use as funções específicas acima.
 */
window.marcarPendenciaComoResolvida = async function(tipo, id) {
    console.log(`⚠️ [PENDÊNCIAS] Função marcarPendenciaComoResolvida chamada - redirecionando para função específica`);
    
    // Redirecionar para função apropriada baseada no tipo
    if (tipo === 'comunicado') {
        await window.abrirComunicadoEPendencias(id);
    } else if (tipo === 'documento') {
        await window.abrirDocumentoEPendencias(id);
    } else if (tipo === 'funcionalidade') {
        await window.abrirFuncionalidadeEPendencias(id);
    } else if (tipo === 'rop_macroarea') {
        // Extrair macroKey do id (formato: macro_macroKey)
        const macroKey = id.replace('macro_', '');
        await window.abrirROPMacroAreaEPendencias(macroKey);
    }
};

/**
 * Marcar documento como visualizado (legado - manter compatibilidade)
 */
window.marcarDocumentoComoVisualizado = async function(documentoId) {
    console.log(`👁️ [DOCUMENTOS] Marcando como visualizado: ${documentoId}`);
    await window.abrirDocumentoEPendencias(documentoId);
};

/**
 * Atualizar contador de pendências no menu principal (badge)
 */
async function atualizarContadorPendencias() {
    try {
        if (!currentUser || !userProfile) return;
        
        let totalPendencias = 0;
        
        // Obter data de criação da conta do usuário
        const userCreatedAt = userProfile.createdAt ? 
            (userProfile.createdAt.toDate ? userProfile.createdAt.toDate() : new Date(userProfile.createdAt.seconds * 1000)) : 
            new Date();
        
        // 1. Contar comunicados novos não lidos
        try {
            let comunicadosSnapshot;
            try {
                comunicadosSnapshot = await db.collection('comunicados')
                    .orderBy('createdAt', 'desc').limit(50).get();
            } catch (e) {
                comunicadosSnapshot = await db.collection('comunicados').limit(50).get();
            }
            
            const lidosSnapshot = await db.collection('usuarios').doc(currentUser.uid)
                .collection('comunicados_lidos').get();
            const comunicadosLidos = [];
            lidosSnapshot.forEach(doc => comunicadosLidos.push(doc.id));
            
            comunicadosSnapshot.forEach(doc => {
                const data = doc.data();
                // Aceitar tanto 'titulo' quanto 'title' (compatibilidade)
                const titulo = data.titulo || data.title;
                const conteudo = data.conteudo || data.content;
                if (titulo && conteudo && !comunicadosLidos.includes(doc.id)) {
                    const comunicadoCreatedAt = data.createdAt ? 
                        (data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt.seconds * 1000)) : 
                        new Date();
                    if (comunicadoCreatedAt >= userCreatedAt) {
                        totalPendencias++;
                    }
                }
            });
        } catch (error) {
            console.error('❌ Erro ao contar comunicados:', error);
        }
        
        // 2. Contar documentos novos não visualizados
        try {
            let docsSnapshot;
            try {
                docsSnapshot = await db.collection('documentos')
                    .orderBy('uploadedAt', 'desc').limit(50).get();
            } catch (e) {
                docsSnapshot = await db.collection('documentos').limit(50).get();
            }
            
            if (!docsSnapshot.empty) {
            const docsVisualizadosSnapshot = await db.collection('usuarios').doc(currentUser.uid)
                .collection('documentos_visualizados').get();
            const docsVisualizados = [];
            docsVisualizadosSnapshot.forEach(doc => docsVisualizados.push(doc.id));
            
            docsSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.title && !docsVisualizados.includes(doc.id)) {
                        const docUploadedAt = data.uploadedAt ? 
                            (data.uploadedAt.toDate ? data.uploadedAt.toDate() : new Date(data.uploadedAt.seconds * 1000)) : 
                            new Date();
                        if (docUploadedAt >= userCreatedAt) {
                            totalPendencias++;
                        }
                    }
                });
            }
        } catch (error) {
            console.error('❌ Erro ao contar documentos:', error);
        }
        
        // 3. Contar funcionalidades novas
        try {
            let funcionalidadesSnapshot;
            try {
                funcionalidadesSnapshot = await db.collection('funcionalidades')
                    .orderBy('createdAt', 'desc').limit(20).get();
            } catch (e) {
                funcionalidadesSnapshot = await db.collection('funcionalidades').limit(20).get();
            }
            
            if (!funcionalidadesSnapshot.empty) {
                const funcVisualizadasSnapshot = await db.collection('usuarios').doc(currentUser.uid)
                    .collection('funcionalidades_visualizadas').get();
                const funcVisualizadas = [];
                funcVisualizadasSnapshot.forEach(doc => funcVisualizadas.push(doc.id));
                
                funcionalidadesSnapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.titulo && !funcVisualizadas.includes(doc.id)) {
                        const funcCreatedAt = data.createdAt ? 
                            (data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt.seconds * 1000)) : 
                            new Date();
                        if (funcCreatedAt >= userCreatedAt) {
                            totalPendencias++;
                        }
                    }
                });
            }
        } catch (error) {
            console.log('ℹ️ Coleção funcionalidades não existe ou está vazia');
        }
        
        // 4. Contar macroáreas de ROPs não completas
        try {
            if (typeof window.ropsData !== 'undefined' && window.ropsData) {
                const userProgress = userProfile?.progress || {};
                
                Object.keys(window.ropsData).forEach(macroKey => {
                    const macro = window.ropsData[macroKey];
                    if (!macro || !macro.subdivisoes) return;
                    
                    let totalROPs = 0;
                    let ropsCompletas = 0;
                    
                    Object.keys(macro.subdivisoes).forEach(ropKey => {
                        totalROPs++;
                        if (userProgress[macroKey] && userProgress[macroKey][ropKey]) {
                            ropsCompletas++;
                        }
                    });
                    
                    const percentualCompleto = totalROPs > 0 ? Math.round((ropsCompletas / totalROPs) * 100) : 0;
                    
                    // Contar como pendência se não estiver 100% completa
                    if (percentualCompleto < 100) {
                        totalPendencias++;
                    }
                });
            }
    } catch (error) {
            console.error('❌ Erro ao contar ROPs:', error);
        }
        
        console.log(`📊 [CONTADOR] Total de pendências: ${totalPendencias}`);
        
        // Atualizar badge no menu - procurar pelo título "Minhas Pendências"
        const listItems = document.querySelectorAll('.list-item');
        listItems.forEach(item => {
            const titleElement = item.querySelector('.title');
            if (titleElement && titleElement.textContent.includes('Minhas Pendências')) {
                let badge = item.querySelector('.badge-count');
                if (totalPendencias > 0) {
                    if (!badge) {
                        badge = document.createElement('span');
                        badge.className = 'badge-count';
                        badge.style.cssText = 'background: #dc2626; color: white; border-radius: 50%; min-width: 20px; height: 20px; padding: 0 6px; display: inline-flex; align-items: center; justify-content: center; font-size: 0.7rem; margin-left: 8px; font-weight: bold;';
                        titleElement.appendChild(badge);
                    }
                    badge.textContent = totalPendencias > 9 ? '9+' : totalPendencias;
                } else if (badge) {
                    badge.remove();
                }
            }
        });
        
    } catch (error) {
        console.error('Erro ao atualizar contador de pendências:', error);
    }
}

// Expor funções globalmente
window.loadPendenciasCompletas = loadPendenciasCompletas;
window.loadPendencias = loadPendenciasCompletas; // Alias para compatibilidade
window.atualizarContadorPendencias = atualizarContadorPendencias;
window.showModalNovoComunicado = showModalNovoComunicado;
window.showComunicados = showComunicados;
window.showBiblioteca = showBiblioteca;

// Exportar TODAS as funções de navegação show* para a busca global
window.showSection = showSection;
window.showROPs = showROPs;
window.showROPsDesafio = showROPsDesafio;
window.showROPsPodcasts = showROPsPodcasts;
window.showROPsChoiceMenu = showROPsChoiceMenu;
window.showROPsSubdivisoes = showROPsSubdivisoes;
window.showMacroArea = showMacroArea;
window.showCalculadoras = showCalculadoras;
window.showAvaliacaoRiscos = showAvaliacaoRiscos;
window.showEscalaMorse = showEscalaMorse;
window.showEscalaBraden = showEscalaBraden;
window.showEscalaCaprini = showEscalaCaprini;
window.showEscalaPadua = showEscalaPadua;
window.showRCRI = showRCRI;
window.showApfelScore = showApfelScore;
window.showDosesPediatricas = showDosesPediatricas;
window.showResidencia = showResidencia;
window.showProtocolos = showProtocolos;
window.showPoliticas = showPoliticas;
window.showFormularios = showFormularios;
window.showManuais = showManuais;
window.showProcessos = showProcessos;
window.showRiscos = showRiscos;
window.showTermos = showTermos;
window.showClima = showClima;
window.showPlanoSeguranca = showPlanoSeguranca;
window.showSegurancaMedicamentos = showSegurancaMedicamentos;
window.showControleInfeccao = showControleInfeccao;
window.showConciliacaoAdmissao = showConciliacaoAdmissao;
window.showConciliacaoTransferencia = showConciliacaoTransferencia;
window.showConciliacaoAlta = showConciliacaoAlta;
window.showProtocoloConciliacao = showProtocoloConciliacao;
window.showGestaoIncidentes = showGestaoIncidentes;
window.showIncidentes = showIncidentes;
window.limparRecursosPDF = limparRecursosPDF;
window.showGrupoAuditoriasOperacionais = showGrupoAuditoriasOperacionais;
window.showGrupoConformidadePoliticas = showGrupoConformidadePoliticas;
window.showPodcastsROPs = showPodcastsROPs;
window.showPodcastMacroArea = showPodcastMacroArea;
window.showSimulado = showSimulado;
window.openDocument = openDocument;
window.isMobileDevice = isMobileDevice;
window.openComunicado = openComunicado;

console.log('✅ Fase 2: Navegação básica carregada');
console.log('✅ Funções de navegação exportadas para window scope');


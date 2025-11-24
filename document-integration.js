<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <title>ANEST - Sistema de Gestão Qmentum</title>
    <link rel="stylesheet" href="styles.css?v=1761300950">
    <link rel="stylesheet" href="painel-qualidade.css?v=1761300012">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body>
    <!-- Loading Screen -->
    <div id="loadingScreen" class="loading-screen">
        <div class="loading-content">
            <div class="loader"></div>
            <p>Carregando...</p>
        </div>
    </div>

    <!-- Login Screen -->
    <div id="loginScreen" class="login-screen-split">
        <!-- Lado Esquerdo - Formulário -->
        <div class="login-left">
            <div class="login-container-new">
                <div class="login-header-new">
                    <img src="Anest2.png" alt="ANEST" class="login-logo-new">
                    <button class="help-btn" onclick="alert('Entre em contato: contato@anest.com.br')">
                        <i class="fas fa-question-circle"></i> Ajuda
                    </button>
                </div>
                
                <h1 class="login-title">Entrar</h1>
                <p class="login-subtitle">Escolha como deseja entrar na sua conta</p>
                
                <div class="login-tabs">
                    <button class="tab-btn active" onclick="showTab('login')">Login</button>
                    <button class="tab-btn" onclick="showTab('register')">Registrar</button>
                </div>

                <!-- Login Form -->
                <form id="loginForm" class="auth-form-new">
                    <div class="form-group-new">
                        <label>Email</label>
                        <input type="email" id="loginEmail" placeholder="Digite seu email" required>
                    </div>
                    <div class="form-group-new">
                        <label>Senha</label>
                        <input type="password" id="loginPassword" placeholder="Digite sua senha" required>
                    </div>
                    <button type="submit" class="btn-login-primary">
                        Entrar
                    </button>
                    <a href="#" class="forgot-password-new" onclick="resetPassword(); return false;">Esqueceu a senha?</a>
                </form>

                <!-- Register Form -->
                <form id="registerForm" class="auth-form-new" style="display: none;">
                    <div class="form-group-new">
                        <label>Nome Completo</label>
                        <input type="text" id="registerName" placeholder="Digite seu nome completo" required>
                    </div>
                    <div class="form-group-new">
                        <label>Email</label>
                        <input type="email" id="registerEmail" placeholder="Digite seu email" required>
                    </div>
                    <div class="form-group-new">
                        <label>Senha</label>
                        <input type="password" id="registerPassword" placeholder="Mínimo 6 caracteres" required minlength="6">
                    </div>
                    <div class="form-group-new">
                        <label>Confirmar Senha</label>
                        <input type="password" id="registerPasswordConfirm" placeholder="Digite a senha novamente" required minlength="6">
                    </div>
                    <button type="submit" class="btn-login-primary">
                        Criar Conta
                    </button>
                </form>

                <div class="divider-new">
                    <span>ou</span>
                </div>

                <button class="btn-google-new" onclick="loginWithGoogle()">
                    <i class="fab fa-google"></i> Entrar com Google
                </button>

                <div class="login-footer">
                    <a href="#" onclick="alert('Suporte: contato@anest.com.br')">Suporte</a>
                    <span>—</span>
                    <a href="#" onclick="alert('Em desenvolvimento')">Termos de Uso</a>
                    <span>—</span>
                    <a href="#" onclick="alert('Em desenvolvimento')">Política de Privacidade</a>
                </div>
            </div>
        </div>

        <!-- Lado Direito - Arte com Círculos -->
        <div class="login-right">
            <div class="circles-animation">
                <div class="circle circle-1"></div>
                <div class="circle circle-2"></div>
                <div class="circle circle-3"></div>
                <div class="circle circle-4"></div>
                <div class="circle circle-5"></div>
                <div class="floating-dots">
                    <div class="dot dot-1"></div>
                    <div class="dot dot-2"></div>
                    <div class="dot dot-3"></div>
                    <div class="dot dot-4"></div>
                    <div class="dot dot-5"></div>
                </div>
                <div class="logo-center">
                    <img src="Anest2.png" alt="ANEST" class="logo-float">
                </div>
            </div>
        </div>
    </div>

    <!-- Main App -->
    <div id="mainApp" style="display: none;">
        <!-- Header -->
        <header class="app-header">
            <div class="header-content">
                <div class="logo">
                    <img src="Anest2.png" alt="ANEST" class="header-logo-new">
                </div>
                <div class="user-menu">
                    <span id="userName" class="user-name"></span>
                    <button class="btn-icon" onclick="toggleDarkMode()">
                        <i class="fas fa-moon"></i>
                    </button>
                    <button class="btn-icon" onclick="showProfile()">
                        <i class="fas fa-user-circle"></i>
                    </button>
                    <button class="btn-icon" onclick="logout()">
                        <i class="fas fa-sign-out-alt"></i>
                    </button>
                </div>
            </div>
        </header>

        <!-- Main Content Container -->
        <main class="main-container">
            <div class="content-wrapper">
                
                <!-- SECTION 1: PAINEL -->
                <div id="painelSection" class="section active">
                    <div class="section-header">
                        <button class="btn-back" onclick="goBack()" style="display: none;">
                            <i class="fas fa-arrow-left"></i>
                        </button>
                        <h1 class="section-title">Painel Principal</h1>
                    </div>

                    <div class="cards-container">
                        <!-- Card: Últimos Comunicados -->
                        <div class="info-card" onclick="showComunicados()">
                            <div class="card-icon-wrapper">
                                <i class="fas fa-bullhorn"></i>
                            </div>
                            <div class="card-content">
                                <h3>Últimos Comunicados</h3>
                                <p>Notícias e atualizações da diretoria</p>
                                <span class="badge-new">3 novos</span>
                            </div>
                            <i class="fas fa-chevron-right card-arrow"></i>
                        </div>

                        <!-- Card: Minhas Pendências -->
                        <div class="info-card" onclick="showPendencias()">
                            <div class="card-icon-wrapper">
                                <i class="fas fa-tasks"></i>
                            </div>
                            <div class="card-content">
                                <h3>Minhas Pendências</h3>
                                <p>Tarefas e leituras obrigatórias</p>
                                <span class="badge-warning">5 pendentes</span>
                            </div>
                            <i class="fas fa-chevron-right card-arrow"></i>
                        </div>

                        <!-- Card: Indicadores de Qualidade (KPIs) -->
                        <div class="info-card" onclick="showKPIs()">
                            <div class="card-icon-wrapper">
                                <i class="fas fa-chart-line"></i>
                            </div>
                            <div class="card-content">
                                <h3>Indicadores de Qualidade</h3>
                                <p>Métricas e desempenho institucional</p>
                            </div>
                            <i class="fas fa-chevron-right card-arrow"></i>
                        </div>

                        <!-- Card: ROPs Desafio -->
                        <div class="info-card highlight" onclick="showROPsDesafio()">
                            <div class="card-icon-wrapper">
                                <i class="fas fa-trophy"></i>
                            </div>
                            <div class="card-content">
                                <h3>🏆 ROPs Desafio</h3>
                                <p>Quiz gamificado - Teste seus conhecimentos</p>
                                <div class="progress-mini">
                                    <div class="progress-bar" style="width: 65%"></div>
                                    <span class="progress-text">65% concluído</span>
                                </div>
                            </div>
                            <i class="fas fa-chevron-right card-arrow"></i>
                        </div>

                        <!-- Card: Residência Médica -->
                        <div class="info-card" onclick="showResidencia()">
                            <div class="card-icon-wrapper">
                                <i class="fas fa-user-graduate"></i>
                            </div>
                            <div class="card-content">
                                <h3>🧑‍⚕️ Residência Médica</h3>
                                <p>Calendário, escalas e informações</p>
                            </div>
                            <i class="fas fa-chevron-right card-arrow"></i>
                        </div>
                    </div>
                </div>

                <!-- SECTION 2: QUALIDADE E SEGURANÇA -->
                <div id="qualidadeSection" class="section">
                    <div class="section-header">
                        <button class="btn-back" onclick="goBack()" style="display: none;">
                            <i class="fas fa-arrow-left"></i>
                        </button>
                        <h1 class="section-title">Qualidade e Segurança</h1>
                    </div>

                    <div class="menu-list">
                        <!-- Gestão de Incidentes -->
                        <div class="menu-item" onclick="showIncidentes()">
                            <div class="menu-icon">
                                <i class="fas fa-exclamation-circle"></i>
                            </div>
                            <div class="menu-content">
                                <h3>Gestão de Incidentes</h3>
                                <p>Notificar eventos adversos e near miss</p>
                            </div>
                            <i class="fas fa-chevron-right"></i>
                        </div>

                        <!-- Auditorias e Conformidade -->
                        <div class="menu-item" onclick="showAuditorias()">
                            <div class="menu-icon">
                                <i class="fas fa-clipboard-check"></i>
                            </div>
                            <div class="menu-content">
                                <h3>Auditorias e Conformidade</h3>
                                <p>Registros e resultados de auditorias</p>
                            </div>
                            <i class="fas fa-chevron-right"></i>
                        </div>

                        <!-- Relatórios de Segurança -->
                        <div class="menu-item" onclick="showRelatorios()">
                            <div class="menu-icon">
                                <i class="fas fa-file-medical-alt"></i>
                            </div>
                            <div class="menu-content">
                                <h3>Relatórios de Segurança</h3>
                                <p>Relatórios trimestrais e consolidados</p>
                            </div>
                            <i class="fas fa-chevron-right"></i>
                        </div>
                    </div>
                </div>

                <!-- SECTION 3: PROTOCOLOS -->
                <div id="protocolosSection" class="section">
                    <div class="section-header">
                        <button class="btn-back" onclick="goBack()" style="display: none;">
                            <i class="fas fa-arrow-left"></i>
                        </button>
                        <h1 class="section-title">Protocolos e Documentos</h1>
                    </div>

                    <!-- Busca Geral -->
                    <div class="search-box">
                        <i class="fas fa-search"></i>
                        <input type="text" id="protocolSearch" placeholder="Buscar documentos..." onkeyup="searchProtocols()">
                    </div>

                    <div class="menu-list">
                        <!-- Biblioteca de Documentos -->
                        <div class="menu-item" onclick="showBiblioteca()">
                            <div class="menu-icon">
                                <i class="fas fa-book"></i>
                            </div>
                            <div class="menu-content">
                                <h3>Biblioteca de Documentos</h3>
                                <p>Todos os protocolos e POPs</p>
                            </div>
                            <i class="fas fa-chevron-right"></i>
                        </div>

                        <!-- Segurança de Medicamentos -->
                        <div class="menu-item" onclick="showSegurancaMedicamentos()">
                            <div class="menu-icon">
                                <i class="fas fa-pills"></i>
                            </div>
                            <div class="menu-content">
                                <h3>Segurança de Medicamentos</h3>
                                <p>Protocolos ROPs de medicamentos</p>
                            </div>
                            <i class="fas fa-chevron-right"></i>
                        </div>

                        <!-- Controle de Infecção -->
                        <div class="menu-item" onclick="showControleInfeccao()">
                            <div class="menu-icon">
                                <i class="fas fa-hands-wash"></i>
                            </div>
                            <div class="menu-content">
                                <h3>Controle de Infecção</h3>
                                <p>Protocolos de prevenção</p>
                            </div>
                            <i class="fas fa-chevron-right"></i>
                        </div>
                    </div>
                </div>

                <!-- SECTION 4: FERRAMENTAS -->
                <div id="ferramentasSection" class="section">
                    <div class="section-header">
                        <button class="btn-back" onclick="goBack()" style="display: none;">
                            <i class="fas fa-arrow-left"></i>
                        </button>
                        <h1 class="section-title">Ferramentas Clínicas</h1>
                    </div>

                    <div class="menu-list">
                        <!-- Checklist de Cirurgia Segura -->
                        <div class="menu-item" onclick="showChecklistCirurgia()">
                            <div class="menu-icon">
                                <i class="fas fa-check-square"></i>
                            </div>
                            <div class="menu-content">
                                <h3>Checklist de Cirurgia Segura (OMS)</h3>
                                <p>Lista de verificação interativa</p>
                            </div>
                            <i class="fas fa-chevron-right"></i>
                        </div>

                        <!-- Conciliação Medicamentosa -->
                        <div class="menu-item" onclick="showConciliacaoMedicamentosa()">
                            <div class="menu-icon">
                                <i class="fas fa-exchange-alt"></i>
                            </div>
                            <div class="menu-content">
                                <h3>Conciliação Medicamentosa</h3>
                                <p>Protocolos de admissão, transferência e alta</p>
                            </div>
                            <i class="fas fa-chevron-right"></i>
                        </div>

                        <!-- Avaliação de Riscos -->
                        <div class="menu-item" onclick="showAvaliacaoRiscos()">
                            <div class="menu-icon">
                                <i class="fas fa-shield-alt"></i>
                            </div>
                            <div class="menu-content">
                                <h3>Avaliação de Riscos</h3>
                                <p>Calculadoras de risco e protocolos</p>
                            </div>
                            <i class="fas fa-chevron-right"></i>
                        </div>

                        <!-- Calculadoras Anestésicas -->
                        <div class="menu-item" onclick="showCalculadoras()">
                            <div class="menu-icon">
                                <i class="fas fa-calculator"></i>
                            </div>
                            <div class="menu-content">
                                <h3>Calculadoras Anestésicas</h3>
                                <p>Ferramentas de cálculo clínico</p>
                            </div>
                            <i class="fas fa-chevron-right"></i>
                        </div>
                    </div>
                </div>

                <!-- Dynamic Content Area -->
                <div id="dynamicContent" class="section"></div>

            </div>
        </main>

        <!-- Bottom Navigation -->
        <nav class="bottom-nav">
            <button class="nav-item active" onclick="showSection('painel')" data-section="painel">
                <i class="fas fa-home"></i>
                <span>Painel</span>
            </button>
            <button class="nav-item" onclick="showSection('qualidade')" data-section="qualidade">
                <i class="fas fa-shield-alt"></i>
                <span>Qualidade</span>
            </button>
            <button class="nav-item" onclick="showSection('protocolos')" data-section="protocolos">
                <i class="fas fa-book"></i>
                <span>Protocolos</span>
            </button>
            <button class="nav-item" onclick="showSection('ferramentas')" data-section="ferramentas">
                <i class="fas fa-tools"></i>
                <span>Ferramentas</span>
            </button>
        </nav>
    </div>

    <!-- Toast Notifications -->
    <div id="toastContainer" class="toast-container"></div>

    <!-- Firebase -->
    <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-storage-compat.js"></script>
    
    <!-- Chart.js for graphs -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js"></script>
    
    <!-- App Scripts -->
    <script src="firebase-config.js?v=1761300051"></script>
    <script src="documents-data.js?v=1761189762"></script>
    <script src="rops-data.js?v=1761189762"></script>
    <script src="podcasts-data.js?v=1761300035"></script>
    <script src="banco-questoes-loader.js?v=1761189762"></script>
    <script src="pedicalc-complete-data.js?v=1761189762"></script>
    <script src="doses-adultos-data.js?v=1761197000"></script>
    <script src="calculadoras-extras.js?v=1761196000"></script>
    <script src="calculadoras-medicas.js?v=1761198000"></script>
    <script src="calculadoras-clinicas.js?v=1761199000"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
    <script src="painel-qualidade.js?v=1761252486"></script>
    <script src="podcasts-data.js?v=1761300070"></script>
    <script src="app.js?v=1761301300"></script>
</body>
</html>


// ==================== SISTEMA DE PERMISSÕES INDIVIDUAIS ====================
// Sistema híbrido: Perfis base + customização individual por usuário

// ==================== PERMISSÕES BASE (ACESSO TOTAL) ====================
// TODOS OS PERFIS TÊM ACESSO TOTAL, EXCETO PAINEL ADMIN
// Permissões específicas serão customizadas individualmente por usuário
const BASE_PERMISSIONS = {
    // Cards - TODOS TÊM ACESSO
    'card-comunicados': true,
    'card-pendencias': true,
    'card-kpis': true,
    'card-rops': true,
    'card-residencia': true,
    'card-incidentes': true,
    'card-auditorias': true,
    'card-relatorios': true,
    'card-biblioteca': true,
    'card-medicamentos': true,
    'card-infeccao': true,
    'card-checklist': true,
    'card-conciliacao': true,
    'card-riscos': true,
    'card-calculadoras': true,
    
    // ROPs - TODOS TÊM ACESSO
    'rop-cultura': true,
    'rop-comunicacao': true,
    'rop-medicamentos': true,
    'rop-vida-profissional': true,
    'rop-infeccoes': true,
    'rop-riscos': true,
    
    // Documentos (leitura) - TODOS TÊM ACESSO
    'doc-protocolos': true,
    'doc-politicas': true,
    'doc-formularios': true,
    'doc-manuais': true,
    'doc-relatorios': true,
    'doc-processos': true,
    'doc-riscos': true,
    'doc-termos': true,
    'doc-clima': true,
    'doc-plano': true,
    
    // Permissões de escrita - SÓ ADMIN (será sobrescrito nos perfis admin)
    'doc-create': false,
    'doc-edit': false,
    'doc-delete': false,
    
    // Módulos - TODOS TÊM ACESSO
    'residencia': true,
    'podcasts': true,
    'notificacoes': true,
    'ranking': true,
    'admin-panel': false  // SÓ ADMIN/COORDENADOR
};

// ==================== PERFIS BASE (TEMPLATES) ====================
const ROLES_TEMPLATES = {
    'socio': {
        name: 'Sócio',
        color: '#6f42c1',
        icon: 'fa-user-tie',
        permissions: {...BASE_PERMISSIONS}  // Acesso total, exceto admin-panel
    },
    
    'administrador': {
        name: 'Administrador',
        color: '#dc3545',
        icon: 'fa-user-shield',
        permissions: {
            ...BASE_PERMISSIONS,  // Herda tudo do base
            // Sobrescreve apenas o que é diferente
            'doc-create': true,
            'doc-edit': true,
            'doc-delete': true,
            'admin-panel': true
        }
    },
    
    'coordenador': {
        name: 'Coordenador',
        color: '#007bff',
        icon: 'fa-user-cog',
        permissions: {
            ...BASE_PERMISSIONS,  // Herda tudo do base
            // Sobrescreve apenas o que é diferente
            'admin-panel': true  // Coordenador tem acesso ao painel admin
        }
    },
    
    'enfermeira': {
        name: 'Enfermeira',
        color: '#28a745',
        icon: 'fa-user-nurse',
        permissions: {...BASE_PERMISSIONS}  // Acesso total, exceto admin-panel
    },
    
    'farmaceutica': {
        name: 'Farmacêutica',
        color: '#e83e8c',
        icon: 'fa-pills',
        permissions: {...BASE_PERMISSIONS}  // Acesso total, exceto admin-panel
    },
    
    'tecnico-enfermagem': {
        name: 'Técnico em Enfermagem',
        color: '#20c997',
        icon: 'fa-hand-holding-medical',
        permissions: {...BASE_PERMISSIONS}  // Acesso total, exceto admin-panel
    },
    
    'secretaria': {
        name: 'Secretária',
        color: '#fd7e14',
        icon: 'fa-user-secret',
        permissions: {...BASE_PERMISSIONS}  // Acesso total, exceto admin-panel
    },
    
    'funcionaria': {
        name: 'Funcionária',
        color: '#6c757d',
        icon: 'fa-user',
        permissions: {...BASE_PERMISSIONS}  // Acesso total, exceto admin-panel
    },
    
    'colaborador': {
        name: 'Colaborador',
        color: '#17a2b8',
        icon: 'fa-user-friends',
        permissions: {...BASE_PERMISSIONS}  // Acesso total, exceto admin-panel
    },
    
    'residente': {
        name: 'Residente',
        color: '#17a2b8',
        icon: 'fa-graduation-cap',
        permissions: {...BASE_PERMISSIONS}  // Acesso total, exceto admin-panel
    }
};

// ==================== MAPEAMENTO: MÓDULOS → PERMISSÕES ====================
const MODULE_PERMISSIONS_MAP = {
    // ROPs Macroáreas
    'cultura-seguranca': 'rop-cultura',
    'comunicacao': 'rop-comunicacao',
    'uso-medicamentos': 'rop-medicamentos',
    'vida-profissional': 'rop-vida-profissional',
    'prevencao-infeccoes': 'rop-infeccoes',
    'avaliacao-riscos': 'rop-riscos',
    
    // Documentos
    'protocolos': 'doc-protocolos',
    'politicas': 'doc-politicas',
    'formularios': 'doc-formularios',
    'manuais': 'doc-manuais',
    'relatorios': 'doc-relatorios',
    'processos': 'doc-processos',
    'riscos': 'doc-riscos',
    'termos': 'doc-termos',
    'clima': 'doc-clima',
    'plano': 'doc-plano'
};

// ==================== ESTRUTURA DE USUÁRIO NO FIRESTORE ====================
/*
users/{userId} = {
    uid: "firebase_uid",
    email: "usuario@email.com",
    displayName: "Nome do Usuário",
    role: "medico", // perfil base
    customPermissions: { // OVERRIDE individual
        'rop-medicamentos': false, // desativa algo do perfil
        'doc-relatorios': true // ativa algo não permitido no perfil
    },
    createdAt: timestamp,
    lastLogin: timestamp,
    active: true,
    createdBy: "admin_uid", // quem criou/aprovou
    notes: "Médico staff - acesso temporário a relatórios"
}
*/

// ==================== FUNÇÕES DE PERMISSÃO ====================

// Obter permissões finais do usuário (perfil + customizações)
function getUserPermissions(user) {
    if (!user || !user.role) {
        // Se não houver perfil, usar visitante (mas não existe mais, usar funcionaria como padrão mínimo)
        const defaultRole = ROLES_TEMPLATES['funcionaria'] || Object.values(ROLES_TEMPLATES)[0];
        return defaultRole ? defaultRole.permissions : {};
    }
    
    // Começa com permissões do perfil base
    const basePermissions = {...ROLES_TEMPLATES[user.role]?.permissions || {}};
    
    // Aplica customizações individuais (override)
    if (user.customPermissions) {
        Object.assign(basePermissions, user.customPermissions);
    }
    
    // Aplica permissões de cards individuais (override)
    if (user.cardPermissions) {
        Object.assign(basePermissions, user.cardPermissions);
    }
    
    // Aplica permissões de categorias de documentos (override)
    if (user.documentCategoryPermissions) {
        Object.assign(basePermissions, user.documentCategoryPermissions);
    }
    
    // Aplica permissões de escrita de documentos (override)
    if (user.documentWritePermissions) {
        Object.assign(basePermissions, user.documentWritePermissions);
    }
    
    return basePermissions;
}

// Verificar se usuário tem permissão específica
function hasPermission(user, permissionKey) {
    const permissions = getUserPermissions(user);
    return permissions[permissionKey] === true;
}

// Verificar se usuário pode acessar um módulo (macroárea ou documento)
function canAccessModule(user, moduleKey) {
    const permissionKey = MODULE_PERMISSIONS_MAP[moduleKey];
    if (!permissionKey) return false;
    return hasPermission(user, permissionKey);
}

// Filtrar ROPs baseado em permissões
function getAvailableROPs(user) {
    const allROPs = Object.keys(ropsData);
    return allROPs.filter(ropKey => canAccessModule(user, ropKey));
}

// Filtrar documentos baseado em permissões
function getAvailableDocuments(user) {
    const allDocs = Object.keys(documentsData);
    return allDocs.filter(docKey => canAccessModule(user, docKey));
}

// ==================== CONTROLE DE CARDS ====================

// Verificar se usuário tem acesso a um card específico
function hasCardPermission(user, cardId) {
    if (!user) return false;
    
    const permissions = getUserPermissions(user);
    
    // Verificar permissão individual do card
    if (permissions[cardId] !== undefined) {
        return permissions[cardId] === true;
    }
    
    // Se não houver permissão específica, verificar se tem acesso geral
    return false;
}

// Obter lista de cards permitidos para o usuário
function getAllowedCards(user) {
    if (!user) return [];
    
    const permissions = getUserPermissions(user);
    const allCards = [
        'card-comunicados',
        'card-pendencias',
        'card-kpis',
        'card-rops',
        'card-residencia',
        'card-incidentes',
        'card-auditorias',
        'card-relatorios',
        'card-biblioteca',
        'card-medicamentos',
        'card-infeccao',
        'card-checklist',
        'card-conciliacao',
        'card-riscos',
        'card-calculadoras'
    ];
    
    return allCards.filter(cardId => hasCardPermission(user, cardId));
}

// ==================== CONTROLE DE DOCUMENTOS ====================

// Verificar se usuário tem acesso a uma categoria de documentos (leitura)
function hasDocumentCategoryPermission(user, category) {
    if (!user) return false;
    
    const permissions = getUserPermissions(user);
    const categoryKey = `doc-${category}`;
    
    // Verificar permissão da categoria
    if (permissions[categoryKey] !== undefined) {
        return permissions[categoryKey] === true;
    }
    
    return false;
}

// Verificar se usuário tem acesso a um documento individual (leitura)
function hasDocumentPermission(user, docId) {
    if (!user) return false;
    
    const permissions = getUserPermissions(user);
    
    // Verificar permissão individual do documento
    if (user.documentIndividualPermissions && user.documentIndividualPermissions[docId] !== undefined) {
        return user.documentIndividualPermissions[docId] === true;
    }
    
    // Se não houver permissão individual, verificar categoria
    // Extrair categoria do docId (ex: PRO.ANEST.0001-00 -> protocolos)
    const category = extractCategoryFromDocId(docId);
    if (category) {
        return hasDocumentCategoryPermission(user, category);
    }
    
    return false;
}

// Extrair categoria do ID do documento
function extractCategoryFromDocId(docId) {
    // Mapear códigos de documentos para categorias
    if (docId.startsWith('PRO.') || docId.startsWith('PT ')) {
        return 'protocolos';
    }
    if (docId.startsWith('PLI.')) {
        return 'politicas';
    }
    // Adicionar mais mapeamentos conforme necessário
    return null;
}

// Obter documentos permitidos para uma categoria
function getAllowedDocuments(user, category) {
    if (!user || !hasDocumentCategoryPermission(user, category)) {
        return [];
    }
    
    // Retornar todos os documentos da categoria se tiver permissão
    // A filtragem individual será feita depois
    if (typeof documentsData !== 'undefined' && documentsData[category]) {
        return documentsData[category].filter(doc => {
            // Verificar se documento não está bloqueado individualmente
            if (user.documentIndividualPermissions && 
                user.documentIndividualPermissions[doc.codigo] === false) {
                return false;
            }
            return true;
        });
    }
    
    return [];
}

// ==================== CONTROLE DE PERMISSÕES DE ESCRITA ====================

// Verificar se usuário pode criar documentos em uma categoria
function canCreateDocument(user, category) {
    if (!user) return false;
    
    const permissions = getUserPermissions(user);
    
    // Verificar permissão geral de criação
    if (permissions['doc-create'] === true) {
        return true;
    }
    
    // Verificar permissão específica da categoria
    const categoryKey = `doc-create-${category}`;
    if (user.documentWritePermissions && user.documentWritePermissions[categoryKey] === true) {
        return true;
    }
    
    return false;
}

// Verificar se usuário pode editar documentos em uma categoria
function canEditDocument(user, category) {
    if (!user) return false;
    
    const permissions = getUserPermissions(user);
    
    // Verificar permissão geral de edição
    if (permissions['doc-edit'] === true) {
        return true;
    }
    
    // Verificar permissão específica da categoria
    const categoryKey = `doc-edit-${category}`;
    if (user.documentWritePermissions && user.documentWritePermissions[categoryKey] === true) {
        return true;
    }
    
    return false;
}

// Verificar se usuário pode excluir documentos em uma categoria
function canDeleteDocument(user, category) {
    if (!user) return false;
    
    const permissions = getUserPermissions(user);
    
    // Verificar permissão geral de exclusão
    if (permissions['doc-delete'] === true) {
        return true;
    }
    
    // Verificar permissão específica da categoria
    const categoryKey = `doc-delete-${category}`;
    if (user.documentWritePermissions && user.documentWritePermissions[categoryKey] === true) {
        return true;
    }
    
    return false;
}

// Verificar se usuário é administrador
function isAdministrator(user) {
    if (!user) return false;
    // Aceitar tanto 'administrador' quanto 'Administrador' e 'coordenador'
    const role = user.role ? user.role.toLowerCase() : '';
    return role === 'administrador' || role === 'coordenador' || hasPermission(user, 'admin-panel');
}

// ==================== ADMIN: GERENCIAR PERMISSÕES ====================

// Listar todos usuários (admin)
async function listAllUsers() {
    if (!isAdministrator(currentUser)) {
        throw new Error('Acesso negado');
    }
    
    const usersSnapshot = await db.collection('users').get();
    const users = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
    
    // Ordenar alfabeticamente por nome (displayName ou email)
    users.sort((a, b) => {
        const nameA = (a.displayName || a.name || a.email || '').toLowerCase();
        const nameB = (b.displayName || b.name || b.email || '').toLowerCase();
        return nameA.localeCompare(nameB, 'pt-BR');
    });
    
    return users;
}

// Atualizar perfil base de um usuário
async function updateUserRole(userId, newRole) {
    if (!isAdministrator(currentUser)) {
        throw new Error('Acesso negado');
    }
    
    await db.collection('users').doc(userId).update({
        role: newRole,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: currentUser.uid
    });
}

// Atualizar permissão individual de um usuário
async function updateUserCustomPermission(userId, permissionKey, value) {
    if (!isAdministrator(currentUser)) {
        throw new Error('Acesso negado');
    }
    
    const updateData = {};
    updateData[`customPermissions.${permissionKey}`] = value;
    updateData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    updateData.updatedBy = currentUser.uid;
    
    await db.collection('users').doc(userId).update(updateData);
}

// Resetar customizações (voltar ao perfil base)
async function resetUserCustomPermissions(userId) {
    if (!isAdministrator(currentUser)) {
        throw new Error('Acesso negado');
    }
    
    await db.collection('users').doc(userId).update({
        customPermissions: firebase.firestore.FieldValue.delete(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: currentUser.uid
    });
}

// Atualizar permissão de card (apenas admin)
async function updateCardPermission(userId, cardId, allowed) {
    if (!isAdministrator(currentUser)) {
        throw new Error('Acesso negado');
    }
    
    const updateData = {};
    updateData[`cardPermissions.${cardId}`] = allowed;
    updateData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    updateData.updatedBy = currentUser.uid;
    
    await db.collection('users').doc(userId).update(updateData);
}

// Atualizar permissão de categoria de documentos (apenas admin)
async function updateDocumentCategoryPermission(userId, category, allowed) {
    if (!isAdministrator(currentUser)) {
        throw new Error('Acesso negado');
    }
    
    const updateData = {};
    updateData[`documentCategoryPermissions.doc-${category}`] = allowed;
    updateData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    updateData.updatedBy = currentUser.uid;
    
    await db.collection('users').doc(userId).update(updateData);
}

// Atualizar permissão de documento individual (apenas admin)
async function updateDocumentPermission(userId, docId, allowed) {
    if (!isAdministrator(currentUser)) {
        throw new Error('Acesso negado');
    }
    
    const updateData = {};
    updateData[`documentIndividualPermissions.${docId}`] = allowed;
    updateData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    updateData.updatedBy = currentUser.uid;
    
    await db.collection('users').doc(userId).update(updateData);
}

// Atualizar permissão de escrita de documentos (apenas admin)
async function updateDocumentWritePermission(userId, action, category, allowed) {
    if (!isAdministrator(currentUser)) {
        throw new Error('Acesso negado');
    }
    
    const updateData = {};
    if (category) {
        updateData[`documentWritePermissions.doc-${action}-${category}`] = allowed;
    } else {
        updateData[`documentWritePermissions.doc-${action}`] = allowed;
    }
    updateData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    updateData.updatedBy = currentUser.uid;
    
    await db.collection('users').doc(userId).update(updateData);
}

// ==================== UI: PAINEL DE GERENCIAMENTO ====================

function showPermissionsManagement() {
    if (!isAdministrator(currentUser)) {
        showToast('Acesso negado. Apenas administradores podem acessar.', 'error');
        return;
    }
    
    // Redirecionar para interface de gerenciamento
    showAdminPermissionsPanel();
}

function showAdminPermissionsPanel() {
    if (!isAdministrator(currentUser)) {
        showToast('Acesso negado', 'error');
        return;
    }
    
    // Criar ou usar seção dinâmica para interface administrativa
    const dynamicContent = document.getElementById('dynamicContent');
    if (!dynamicContent) {
        showToast('Erro: elemento dynamicContent não encontrado', 'error');
        return;
    }
    
    // Mostrar seção dinâmica
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    dynamicContent.classList.add('section', 'active');
    dynamicContent.style.display = 'block';
    
    dynamicContent.innerHTML = `
        <div class="section-header">
            <button class="btn-back" onclick="showSection('painel')">
                <i class="fas fa-arrow-left"></i>
            </button>
            <h1 class="section-title">
                <i class="fas fa-user-shield"></i> Gerenciamento de Permissões
            </h1>
        </div>
        
        <div class="admin-panel">
            <div class="admin-tabs">
                <button class="admin-tab active" onclick="switchAdminTab('users')">
                    <i class="fas fa-users"></i> Usuários
                </button>
                <button class="admin-tab" onclick="switchAdminTab('authorized-emails')">
                    <i class="fas fa-envelope-open-text"></i> Emails Autorizados
                </button>
                <button class="admin-tab" onclick="switchAdminTab('stats')">
                    <i class="fas fa-chart-bar"></i> Estatísticas
                </button>
            </div>
            
            <div id="adminContent" style="padding: 24px;">
                <div class="admin-loading">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Carregando...</p>
                </div>
            </div>
        </div>
    `;
    
    // Carregar primeira aba
    switchAdminTab('users');
}

// Alternar entre abas
function switchAdminTab(tabName) {
    // Atualizar visual das abas
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event?.target?.closest('.admin-tab')?.classList.add('active');
    
    // Carregar conteúdo da aba
    if (tabName === 'users') {
    showUsersList();
    } else if (tabName === 'authorized-emails') {
        showAuthorizedEmailsList();
    } else if (tabName === 'stats') {
        showAdminStats();
    }
}

// Listar usuários
async function showUsersList() {
    const content = document.getElementById('adminContent');
    content.innerHTML = '<div class="admin-loading"><i class="fas fa-spinner fa-spin"></i><p>Carregando usuários...</p></div>';
    
    try {
        const users = await listAllUsers();
        
        if (users.length === 0) {
        content.innerHTML = `
                <div class="admin-empty">
                    <i class="fas fa-users"></i>
                    <h3>Nenhum usuário encontrado</h3>
                    <p>Os usuários aparecerão aqui quando fizerem login pela primeira vez</p>
                            </div>
            `;
            return;
        }
        
        // Contador de usuários por perfil
        const usersByRole = {};
        users.forEach(user => {
            const roleName = ROLES_TEMPLATES[user.role]?.name || user.role || 'Sem perfil';
            usersByRole[roleName] = (usersByRole[roleName] || 0) + 1;
        });
        
        content.innerHTML = `
            <div class="admin-toolbar">
                <div class="admin-search">
                    <i class="fas fa-search"></i>
                    <input type="text" id="userSearch" placeholder="Buscar por nome ou email..." oninput="filterUsers()">
                </div>
                <div class="admin-actions">
                    <span style="color: #666; font-size: 14px;">
                        <i class="fas fa-users"></i> ${users.length} usuário(s)
                    </span>
                            </div>
                        </div>
                        
            <div class="users-grid" id="usersGrid">
                ${users.map(user => {
                    const role = ROLES_TEMPLATES[user.role] || {name: user.role || 'Funcionária', color: '#999', icon: 'fa-user'};
                    // Prioridade: name > displayName > primeira parte do email
                    const fullName = user.name || user.displayName || user.email?.split('@')[0] || 'Usuário';
                    const initials = fullName.substring(0, 2).toUpperCase();
                    const hasCustom = user.customPermissions || user.cardPermissions || user.documentWritePermissions;
                    
                    return `
                        <div class="user-card" onclick="editUserPermissions('${user.id}')" data-user-name="${(fullName || '').toLowerCase()}" data-user-email="${(user.email || '').toLowerCase()}" style="cursor: pointer; padding: 20px; background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: all 0.3s ease;">
                            <div class="user-card-header" style="display: flex !important; align-items: flex-start; gap: 12px; margin-bottom: 16px;">
                                <div class="user-avatar" style="width: 48px; height: 48px; border-radius: 50%; background: ${role.color}; color: white; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 600; flex-shrink: 0;">${initials}</div>
                                <div class="user-info" style="flex: 1; min-width: 0; display: block !important;">
                                    <h3 style="margin: 0 0 4px 0 !important; font-size: 16px !important; font-weight: 600 !important; color: #1f2937 !important; word-break: break-word; display: block !important; visibility: visible !important; opacity: 1 !important;">${fullName}</h3>
                                    <p class="user-email" style="margin: 0 !important; font-size: 14px !important; color: #6b7280 !important; word-break: break-word; display: block !important;">${user.email || 'Sem email'}</p>
                                </div>
                            </div>
                            <div class="user-role-badge" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: ${role.color}; color: white; border-radius: 6px; font-size: 13px; font-weight: 600;">
                                <i class="fas ${role.icon}"></i>
                                <span>${role.name}</span>
                            </div>
                            ${hasCustom ? '<div style="margin-top: 8px;"><span style="display: inline-flex; align-items: center; gap: 4px; background: #ff9800; color: white; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 600;"><i class="fas fa-star"></i> <span>PERSONALIZADO</span></span></div>' : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    } catch (error) {
        content.innerHTML = `
            <div class="admin-alert error">
                <i class="fas fa-exclamation-triangle"></i>
                <div>
                    <strong>Erro ao carregar usuários</strong><br>
                    ${error.message}
                </div>
            </div>
        `;
    }
}

// Filtrar usuários na busca
function filterUsers() {
    const searchTerm = document.getElementById('userSearch')?.value.toLowerCase() || '';
    const userCards = document.querySelectorAll('#usersGrid .user-card');
    
    userCards.forEach(card => {
        const name = card.getAttribute('data-user-name') || '';
        const email = card.getAttribute('data-user-email') || '';
        
        if (name.includes(searchTerm) || email.includes(searchTerm)) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
}

// Adicionar função para estatísticas
async function showAdminStats() {
    const content = document.getElementById('adminContent');
    content.innerHTML = '<div class="admin-loading"><i class="fas fa-spinner fa-spin"></i><p>Carregando estatísticas...</p></div>';
    
    try {
        const users = await listAllUsers();
        
        // Calcular estatísticas
        const stats = {
            total: users.length,
            byRole: {},
            withCustom: 0,
            active: 0
        };
        
        users.forEach(user => {
            const roleName = ROLES_TEMPLATES[user.role]?.name || 'Outros';
            stats.byRole[roleName] = (stats.byRole[roleName] || 0) + 1;
            
            if (user.customPermissions || user.cardPermissions || user.documentWritePermissions) {
                stats.withCustom++;
            }
            
            if (user.active !== false) {
                stats.active++;
            }
        });
        
        content.innerHTML = `
            <div class="admin-stats">
                <div class="stat-card">
                    <i class="fas fa-users"></i>
                    <p class="stat-value">${stats.total}</p>
                    <p class="stat-label">Total de Usuários</p>
                        </div>
                <div class="stat-card">
                    <i class="fas fa-user-check"></i>
                    <p class="stat-value">${stats.active}</p>
                    <p class="stat-label">Usuários Ativos</p>
                </div>
                <div class="stat-card">
                    <i class="fas fa-star"></i>
                    <p class="stat-value">${stats.withCustom}</p>
                    <p class="stat-label">Personalizados</p>
                </div>
                <div class="stat-card">
                    <i class="fas fa-user-shield"></i>
                    <p class="stat-value">${stats.byRole['Administrador'] || 0}</p>
                    <p class="stat-label">Administradores</p>
                </div>
            </div>
            
            <div style="background: white; border: 2px solid #e0e0e0; border-radius: 12px; padding: 24px; margin-top: 20px;">
                <h3 style="margin: 0 0 16px 0; color: #333;">
                    <i class="fas fa-chart-pie"></i> Usuários por Perfil
                </h3>
                ${Object.entries(stats.byRole).map(([role, count]) => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; margin-bottom: 8px; background: #f9f9f9; border-radius: 8px;">
                        <span style="font-weight: 500; color: #333;">${role}</span>
                        <span style="background: #667eea; color: white; padding: 4px 12px; border-radius: 12px; font-weight: 600;">${count}</span>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (error) {
        content.innerHTML = `
            <div class="admin-alert error">
                <i class="fas fa-exclamation-triangle"></i>
                <div>
                    <strong>Erro ao carregar estatísticas</strong><br>
                    ${error.message}
                </div>
            </div>
        `;
    }
}

// Fechar modal de permissões e atualizar lista
function closePermissionsModalAndRefresh() {
    // Fechar modal
    const modal = document.querySelector('.admin-modal');
    if (modal) {
        modal.remove();
    }
    
    // Atualizar lista de usuários
    showUsersList();
    
    showToast('Permissões salvas com sucesso!', 'success');
}

// Editar permissões de um usuário específico
async function editUserPermissions(userId) {
    // Criar modal
    const modal = document.createElement('div');
    modal.className = 'admin-modal';
    modal.innerHTML = '<div class="admin-modal-content"><div class="admin-loading"><i class="fas fa-spinner fa-spin"></i><p>Carregando...</p></div></div>';
    document.body.appendChild(modal);
    
    // Fechar modal ao clicar fora
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closePermissionsModalAndRefresh();
        }
    });
    
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        const user = {id: userDoc.id, ...userDoc.data()};
        const finalPermissions = getUserPermissions(user);
        const role = ROLES_TEMPLATES[user.role] || {name: user.role || 'Funcionária', color: '#999', icon: 'fa-user'};
        const userName = user.displayName || user.email?.split('@')[0] || 'Usuário';
        const initials = userName.substring(0, 2).toUpperCase();
        
        modal.querySelector('.admin-modal-content').innerHTML = `
            <div class="admin-modal-header">
                <h2><i class="fas fa-user-edit"></i> Editar Permissões</h2>
                <button class="admin-modal-close" onclick="closePermissionsModalAndRefresh()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="admin-modal-body">
                <!-- Info do Usuário -->
                <div style="background: linear-gradient(135deg, ${role.color} 0%, ${role.color}dd 100%); color: white; padding: 20px; border-radius: 12px; margin-bottom: 24px;">
                    <div style="display: flex; align-items: center; gap: 16px;">
                        <div style="width: 56px; height: 56px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 600;">
                            ${initials}
                        </div>
                        <div style="flex: 1;">
                            <h3 style="margin: 0 0 4px 0; font-size: 20px;">${userName}</h3>
                            <p style="margin: 0; opacity: 0.9; font-size: 14px;">${user.email || 'Sem email'}</p>
                        </div>
                        <div style="background: rgba(255,255,255,0.2); padding: 8px 16px; border-radius: 20px; font-weight: 600;">
                            <i class="fas ${role.icon}"></i> ${role.name}
                        </div>
                    </div>
                </div>
                
                <!-- Seleção de Perfil -->
                <div class="role-select-group">
                    <label>
                        <i class="fas fa-id-card"></i> Perfil Base
                    </label>
                    <select id="userRoleSelect_${userId}" onchange="updateUserRoleNow('${userId}', this.value)">
                        ${Object.keys(ROLES_TEMPLATES).map(roleKey => `
                            <option value="${roleKey}" ${user.role === roleKey ? 'selected' : ''}>
                                ${ROLES_TEMPLATES[roleKey].name}
                            </option>
                        `).join('')}
                    </select>
                    <p class="help-text">
                        O perfil base define as permissões padrão. Você pode personalizar permissões individuais abaixo.
                    </p>
                </div>
                
                ${user.customPermissions || user.cardPermissions || user.documentWritePermissions ? `
                    <div class="admin-alert warning" style="margin-bottom: 20px;">
                        <i class="fas fa-star"></i>
                        <div>
                            <strong>Este usuário possui permissões personalizadas</strong><br>
                            <button onclick="if(confirm('Tem certeza?')) resetPermissionsNow('${userId}')" class="admin-btn admin-btn-secondary" style="margin-top: 8px; padding: 6px 12px; font-size: 13px;">
                                <i class="fas fa-undo"></i> Resetar para perfil base
                            </button>
                        </div>
                    </div>
                        ` : ''}
                
                <!-- Seção de Permissões de Cards -->
                <div class="permission-section">
                    <div class="permission-section-header">
                        <i class="fas fa-th-large"></i>
                        <h3>Acesso aos Cards</h3>
                    </div>
                    <div class="permissions-grid">
                        ${renderCardPermissionTogglesNew(userId, user, finalPermissions)}
                    </div>
                    </div>
                    
                <!-- Seção de ROPs -->
                <div class="permission-section">
                    <div class="permission-section-header">
                        <i class="fas fa-question-circle"></i>
                        <h3>ROPs - Desafio</h3>
                    </div>
                    <div class="permissions-grid">
                        ${renderPermissionTogglesNew(userId, user, finalPermissions, [
                                'rop-cultura',
                                'rop-comunicacao',
                                'rop-medicamentos',
                                'rop-vida-profissional',
                                'rop-infeccoes',
                                'rop-riscos'
                            ])}
                    </div>
                        </div>
                        
                <!-- Seção de Documentos -->
                <div class="permission-section">
                    <div class="permission-section-header">
                        <i class="fas fa-file-alt"></i>
                        <h3>Documentos (Leitura)</h3>
                    </div>
                    <div class="permissions-grid">
                        ${renderPermissionTogglesNew(userId, user, finalPermissions, [
                                'doc-protocolos',
                                'doc-politicas',
                                'doc-formularios',
                                'doc-manuais',
                                'doc-relatorios',
                                'doc-processos',
                                'doc-riscos',
                                'doc-termos',
                                'doc-clima',
                                'doc-plano'
                            ])}
                    </div>
                        </div>
                        
                <!-- Seção de Permissões de Escrita -->
                <div class="permission-section">
                    <div class="permission-section-header">
                        <i class="fas fa-edit"></i>
                        <h3>Permissões de Escrita</h3>
                    </div>
                    <div class="permissions-grid">
                        ${renderWritePermissionTogglesNew(userId, user, finalPermissions)}
                    </div>
                </div>
                
                <!-- Seção de Módulos -->
                <div class="permission-section">
                    <div class="permission-section-header">
                        <i class="fas fa-cog"></i>
                        <h3>Outros Módulos</h3>
                    </div>
                    <div class="permissions-grid">
                        ${renderPermissionTogglesNew(userId, user, finalPermissions, [
                                'residencia',
                                'podcasts',
                                'notificacoes',
                                'ranking',
                                'admin-panel'
                            ])}
                        </div>
                    </div>
                </div>
                
            <div class="admin-modal-footer">
                <button class="admin-btn admin-btn-secondary" onclick="closePermissionsModalAndRefresh()">
                    <i class="fas fa-times"></i> Fechar
                </button>
                <p style="margin: 0; color: #6b7280; font-size: 13px;">
                    <i class="fas fa-info-circle"></i> As alterações são salvas automaticamente
                </p>
            </div>
        `;
    } catch (error) {
        modal.remove();
        showToast('Erro ao carregar usuário: ' + error.message, 'error');
    }
}

// Renderizar toggles de permissão (nova versão)
function renderPermissionTogglesNew(userId, user, finalPermissions, permissionKeys) {
    return permissionKeys.map(key => {
        const baseValue = ROLES_TEMPLATES[user.role]?.permissions[key];
        const customValue = user.customPermissions?.[key];
        const isCustom = customValue !== undefined;
        const currentValue = finalPermissions[key];
        
        const label = key
            .replace('rop-', 'ROPs: ')
            .replace('doc-', '')
            .replace(/-/g, ' ')
            .split(' ')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
        
        return `
            <div class="permission-item">
                <label class="permission-label">
                    <i class="fas fa-check-circle"></i>
                    <span>${label}</span>
                </label>
                <label class="permission-toggle">
                    <input 
                        type="checkbox" 
                        ${currentValue ? 'checked' : ''}
                        onchange="toggleUserPermission('${userId}', '${key}', this.checked, ${baseValue})"
                    >
                    <span class="permission-slider"></span>
                </label>
            </div>
        `;
    }).join('');
}

// Renderizar toggles de permissão de cards (nova versão)
function renderCardPermissionTogglesNew(userId, user, finalPermissions) {
    const allCards = [
        {id: 'card-comunicados', label: 'Últimos Comunicados', icon: 'fa-bullhorn'},
        {id: 'card-pendencias', label: 'Minhas Pendências', icon: 'fa-tasks'},
        {id: 'card-kpis', label: 'Indicadores de Qualidade', icon: 'fa-chart-line'},
        {id: 'card-rops', label: 'ROPs Desafio', icon: 'fa-trophy'},
        {id: 'card-residencia', label: 'Residência Médica', icon: 'fa-user-graduate'},
        {id: 'card-incidentes', label: 'Gestão de Incidentes', icon: 'fa-exclamation-circle'},
        {id: 'card-auditorias', label: 'Auditorias e Conformidade', icon: 'fa-clipboard-check'},
        {id: 'card-relatorios', label: 'Relatórios de Segurança', icon: 'fa-file-medical-alt'},
        {id: 'card-biblioteca', label: 'Biblioteca de Documentos', icon: 'fa-book'},
        {id: 'card-medicamentos', label: 'Segurança de Medicamentos', icon: 'fa-pills'},
        {id: 'card-infeccao', label: 'Controle de Infecção', icon: 'fa-hands-wash'},
        {id: 'card-checklist', label: 'Checklist de Cirurgia Segura (OMS)', icon: 'fa-check-square'},
        {id: 'card-conciliacao', label: 'Conciliação Medicamentosa', icon: 'fa-exchange-alt'},
        {id: 'card-riscos', label: 'Avaliação de Riscos', icon: 'fa-shield-alt'},
        {id: 'card-calculadoras', label: 'Calculadoras Anestésicas', icon: 'fa-calculator'}
    ];
    
    return allCards.map(card => {
        const baseValue = ROLES_TEMPLATES[user.role]?.permissions[card.id];
        const customValue = user.cardPermissions?.[card.id];
        const isCustom = customValue !== undefined;
        const currentValue = finalPermissions[card.id];
        
        return `
            <div class="permission-item">
                <label class="permission-label">
                    <i class="fas ${card.icon}"></i>
                    <span>${card.label}</span>
                </label>
                <label class="permission-toggle">
                    <input 
                        type="checkbox" 
                        ${currentValue ? 'checked' : ''}
                        onchange="toggleCardPermission('${userId}', '${card.id}', this.checked, ${baseValue})"
                    >
                    <span class="permission-slider"></span>
                </label>
            </div>
        `;
    }).join('');
}

// Renderizar toggles de permissão de escrita (nova versão)
function renderWritePermissionTogglesNew(userId, user, finalPermissions) {
    const writeActions = [
        {key: 'doc-create', label: 'Criar Documentos', icon: 'fa-plus'},
        {key: 'doc-edit', label: 'Editar Documentos', icon: 'fa-edit'},
        {key: 'doc-delete', label: 'Excluir Documentos', icon: 'fa-trash'}
    ];
    
    return writeActions.map(action => {
        const baseValue = ROLES_TEMPLATES[user.role]?.permissions[action.key];
        const customValue = user.documentWritePermissions?.[action.key];
        const isCustom = customValue !== undefined;
        const currentValue = finalPermissions[action.key];
        
        return `
            <div class="permission-item">
                <label class="permission-label">
                    <i class="fas ${action.icon}"></i>
                    <span>${action.label}</span>
                </label>
                <label class="permission-toggle">
                    <input 
                        type="checkbox" 
                        ${currentValue ? 'checked' : ''}
                        onchange="toggleWritePermission('${userId}', '${action.key}', this.checked, ${baseValue})"
                    >
                    <span class="permission-slider"></span>
                </label>
            </div>
        `;
    }).join('');
}

// Renderizar toggles de permissão
function renderPermissionToggles(userId, user, finalPermissions, permissionKeys) {
    return permissionKeys.map(key => {
        const baseValue = ROLES_TEMPLATES[user.role]?.permissions[key];
        const customValue = user.customPermissions?.[key];
        const isCustom = customValue !== undefined;
        const currentValue = finalPermissions[key];
        
        const label = key
            .replace('rop-', 'ROPs: ')
            .replace('doc-', '')
            .replace(/-/g, ' ')
            .split(' ')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
        
        return `
            <div class="permission-toggle ${isCustom ? 'customized' : ''}">
                <label class="toggle-label">
                    <input 
                        type="checkbox" 
                        ${currentValue ? 'checked' : ''}
                        onchange="toggleUserPermission('${userId}', '${key}', this.checked, ${baseValue})"
                    >
                    <span class="toggle-slider"></span>
                    <span class="toggle-text">
                        ${label}
                        ${isCustom ? '<i class="fas fa-star" title="Customizado"></i>' : ''}
                    </span>
                </label>
            </div>
        `;
    }).join('');
}

// Renderizar toggles de permissão de cards
function renderCardPermissionToggles(userId, user, finalPermissions) {
    const allCards = [
        {id: 'card-comunicados', label: 'Últimos Comunicados'},
        {id: 'card-pendencias', label: 'Minhas Pendências'},
        {id: 'card-kpis', label: 'Indicadores de Qualidade'},
        {id: 'card-rops', label: 'ROPs Desafio'},
        {id: 'card-residencia', label: 'Residência Médica'},
        {id: 'card-incidentes', label: 'Gestão de Incidentes'},
        {id: 'card-auditorias', label: 'Auditorias e Conformidade'},
        {id: 'card-relatorios', label: 'Relatórios de Segurança'},
        {id: 'card-biblioteca', label: 'Biblioteca de Documentos'},
        {id: 'card-medicamentos', label: 'Segurança de Medicamentos'},
        {id: 'card-infeccao', label: 'Controle de Infecção'},
        {id: 'card-checklist', label: 'Checklist de Cirurgia Segura'},
        {id: 'card-conciliacao', label: 'Conciliação Medicamentosa'},
        {id: 'card-riscos', label: 'Avaliação de Riscos'},
        {id: 'card-calculadoras', label: 'Calculadoras Anestésicas'}
    ];
    
    return allCards.map(card => {
        const baseValue = ROLES_TEMPLATES[user.role]?.permissions[card.id];
        const customValue = user.cardPermissions?.[card.id];
        const isCustom = customValue !== undefined;
        const currentValue = finalPermissions[card.id];
        
        return `
            <div class="permission-toggle ${isCustom ? 'customized' : ''}">
                <label class="toggle-label">
                    <input 
                        type="checkbox" 
                        ${currentValue ? 'checked' : ''}
                        onchange="toggleCardPermission('${userId}', '${card.id}', this.checked, ${baseValue})"
                    >
                    <span class="toggle-slider"></span>
                    <span class="toggle-text">
                        ${card.label}
                        ${isCustom ? '<i class="fas fa-star" title="Customizado"></i>' : ''}
                    </span>
                </label>
            </div>
        `;
    }).join('');
}

// Renderizar toggles de permissão de escrita
function renderWritePermissionToggles(userId, user, finalPermissions) {
    const writeActions = [
        {key: 'doc-create', label: 'Criar Documentos (Geral)'},
        {key: 'doc-edit', label: 'Editar Documentos (Geral)'},
        {key: 'doc-delete', label: 'Excluir Documentos (Geral)'}
    ];
    
    const categories = ['protocolos', 'politicas', 'formularios', 'manuais', 'relatorios'];
    
    let html = writeActions.map(action => {
        const baseValue = ROLES_TEMPLATES[user.role]?.permissions[action.key];
        const customValue = user.documentWritePermissions?.[action.key];
        const isCustom = customValue !== undefined;
        const currentValue = finalPermissions[action.key];
        
        return `
            <div class="permission-toggle ${isCustom ? 'customized' : ''}">
                <label class="toggle-label">
                    <input 
                        type="checkbox" 
                        ${currentValue ? 'checked' : ''}
                        onchange="toggleWritePermission('${userId}', '${action.key.replace('doc-', '')}', null, this.checked, ${baseValue})"
                    >
                    <span class="toggle-slider"></span>
                    <span class="toggle-text">
                        ${action.label}
                        ${isCustom ? '<i class="fas fa-star" title="Customizado"></i>' : ''}
                    </span>
                </label>
            </div>
        `;
    }).join('');
    
    html += '<hr style="margin: 16px 0; border: none; border-top: 1px solid #ddd;">';
    html += '<strong style="display: block; margin-bottom: 8px;">Por Categoria:</strong>';
    
    categories.forEach(category => {
        ['create', 'edit', 'delete'].forEach(action => {
            const key = `doc-${action}-${category}`;
            const baseValue = false; // Padrão é false
            const customValue = user.documentWritePermissions?.[key];
            const isCustom = customValue !== undefined;
            const currentValue = finalPermissions[key] || false;
            
            const actionLabel = action === 'create' ? 'Criar' : action === 'edit' ? 'Editar' : 'Excluir';
            const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1);
            
            html += `
                <div class="permission-toggle ${isCustom ? 'customized' : ''}">
                    <label class="toggle-label">
                        <input 
                            type="checkbox" 
                            ${currentValue ? 'checked' : ''}
                            onchange="toggleWritePermission('${userId}', '${action}', '${category}', this.checked, ${baseValue})"
                        >
                        <span class="toggle-slider"></span>
                        <span class="toggle-text">
                            ${actionLabel} ${categoryLabel}
                            ${isCustom ? '<i class="fas fa-star" title="Customizado"></i>' : ''}
                        </span>
                    </label>
                </div>
            `;
        });
    });
    
    return html;
}

// Toggle permissão individual
async function toggleUserPermission(userId, permissionKey, newValue, baseValue) {
    try {
        // Verificar se é administrador antes de qualquer operação
        if (!isAdministrator(currentUser)) {
            throw new Error('Acesso negado: apenas administradores podem modificar permissões');
        }
        
        // Se o valor é igual ao do perfil base, remove a customização
        if (newValue === baseValue) {
            const userRef = db.collection('users').doc(userId);
            const updateData = {};
            updateData[`customPermissions.${permissionKey}`] = firebase.firestore.FieldValue.delete();
            // Incluir campos de auditoria para que as regras do Firestore reconheçam como admin
            updateData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
            updateData.updatedBy = currentUser.uid;
            await userRef.update(updateData);
            // Toast removido para não poluir a UI
        } else {
            // Caso contrário, cria/atualiza a customização
            await updateUserCustomPermission(userId, permissionKey, newValue);
            // Toast removido para não poluir a UI
        }
        
        // Recarrega se for o próprio usuário
        if (userId === currentUser.uid) {
            await loadCurrentUserData();
        }
    } catch (error) {
        showToast('Erro ao atualizar permissão: ' + error.message, 'error');
    }
}

// Atualizar perfil base
async function updateUserRoleNow(userId, newRole) {
    try {
        await updateUserRole(userId, newRole);
        showToast('Perfil atualizado com sucesso', 'success');
        editUserPermissions(userId); // Recarrega
        
        if (userId === currentUser.uid) {
            await loadCurrentUserData();
        }
    } catch (error) {
        showToast('Erro ao atualizar perfil: ' + error.message, 'error');
    }
}

// Toggle permissão de card
async function toggleCardPermission(userId, cardId, newValue, baseValue) {
    try {
        // Verificar se é administrador antes de qualquer operação
        if (!isAdministrator(currentUser)) {
            throw new Error('Acesso negado: apenas administradores podem modificar permissões');
        }
        
        // Se o valor é igual ao do perfil base, remove a customização
        if (newValue === baseValue) {
            const userRef = db.collection('users').doc(userId);
            const updateData = {};
            updateData[`cardPermissions.${cardId}`] = firebase.firestore.FieldValue.delete();
            // Incluir campos de auditoria para que as regras do Firestore reconheçam como admin
            updateData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
            updateData.updatedBy = currentUser.uid;
            await userRef.update(updateData);
            // Toast removido para não poluir a UI
        } else {
            // Caso contrário, cria/atualiza a customização
            await updateCardPermission(userId, cardId, newValue);
            // Toast removido para não poluir a UI
        }
        
        // Recarrega se for o próprio usuário
        if (userId === currentUser.uid) {
            await loadCurrentUserData();
            filterCardsByPermissions();
        }
        
        // NÃO recarrega mais o modal - melhora a experiência do usuário
    } catch (error) {
        showToast('Erro ao atualizar permissão de card: ' + error.message, 'error');
    }
}

// Toggle permissão de escrita
async function toggleWritePermission(userId, action, category, newValue, baseValue) {
    try {
        // Verificar se é administrador antes de qualquer operação
        if (!isAdministrator(currentUser)) {
            throw new Error('Acesso negado: apenas administradores podem modificar permissões');
        }
        
        const key = category ? `doc-${action}-${category}` : `doc-${action}`;
        
        // Se o valor é igual ao do perfil base, remove a customização
        if (newValue === baseValue) {
            const userRef = db.collection('users').doc(userId);
            const updateData = {};
            updateData[`documentWritePermissions.${key}`] = firebase.firestore.FieldValue.delete();
            // Incluir campos de auditoria para que as regras do Firestore reconheçam como admin
            updateData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
            updateData.updatedBy = currentUser.uid;
            await userRef.update(updateData);
            // Toast removido para não poluir a UI
        } else {
            // Caso contrário, cria/atualiza a customização
            await updateDocumentWritePermission(userId, action, category, newValue);
            // Toast removido para não poluir a UI
        }
        
        // Recarrega se for o próprio usuário
        if (userId === currentUser.uid) {
            await loadCurrentUserData();
        }
        
        // NÃO recarrega mais o modal - melhora a experiência do usuário
    } catch (error) {
        showToast('Erro ao atualizar permissão de escrita: ' + error.message, 'error');
    }
}

// Resetar customizações
async function resetPermissionsNow(userId) {
    if (!confirm('Resetar todas customizações? O usuário voltará ao perfil base.')) {
        return;
    }
    
    try {
        await resetUserCustomPermissions(userId);
        
        // Também resetar permissões de cards e escrita
        const userRef = db.collection('users').doc(userId);
        await userRef.update({
            cardPermissions: firebase.firestore.FieldValue.delete(),
            documentWritePermissions: firebase.firestore.FieldValue.delete(),
            documentCategoryPermissions: firebase.firestore.FieldValue.delete(),
            documentIndividualPermissions: firebase.firestore.FieldValue.delete()
        });
        
        showToast('Permissões resetadas para o perfil base', 'success');
        editUserPermissions(userId);
        
        if (userId === currentUser.uid) {
            await loadCurrentUserData();
            filterCardsByPermissions();
        }
    } catch (error) {
        showToast('Erro ao resetar permissões: ' + error.message, 'error');
    }
}

// ==================== INTEGRAÇÃO COM APP.JS ====================

// Nota: A função loadCurrentUserData agora está em app.js
// Esta função foi movida para evitar duplicação

// Mostrar templates de perfis
function showRolesTemplates() {
    const content = document.getElementById('adminContent');
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    content.innerHTML = `
        <div class="roles-grid">
            ${Object.keys(ROLES_TEMPLATES).map(roleKey => {
                const role = ROLES_TEMPLATES[roleKey];
                return `
                    <div class="role-card">
                        <div class="role-header" style="background: ${role.color}; color: white; padding: 16px; border-radius: 8px 8px 0 0;">
                            <i class="fas ${role.icon}" style="font-size: 24px; margin-bottom: 8px;"></i>
                            <h3>${role.name}</h3>
                        </div>
                        <div class="role-content" style="padding: 16px;">
                            <button class="btn-primary btn-sm" onclick="editRolePermissions('${roleKey}')">
                                <i class="fas fa-edit"></i> Editar Permissões Padrão
                            </button>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// Editar permissões padrão de um perfil
function editRolePermissions(roleKey) {
    const role = ROLES_TEMPLATES[roleKey];
    const content = document.getElementById('adminContent');
    
    content.innerHTML = `
        <div class="role-edit-panel">
            <div class="role-edit-header">
                <h3>
                    <i class="fas ${role.icon}" style="color: ${role.color};"></i>
                    ${role.name}
                </h3>
                <button class="btn-secondary" onclick="showRolesTemplates()">
                    <i class="fas fa-times"></i> Fechar
                </button>
            </div>
            
            <div class="info-box" style="margin-bottom: 24px;">
                <i class="fas fa-info-circle"></i>
                <strong>Atenção:</strong> Alterar permissões padrão de um perfil afetará todos os usuários com esse perfil que não tiverem customizações individuais.
            </div>
            
            <div class="permissions-grid">
                <div class="permission-category">
                    <h5><i class="fas fa-th-large"></i> Cards</h5>
                    ${renderRoleCardPermissions(roleKey, role)}
                </div>
                
                <div class="permission-category">
                    <h5><i class="fas fa-file-alt"></i> Documentos (Leitura)</h5>
                    ${renderRoleDocumentPermissions(roleKey, role)}
                </div>
                
                <div class="permission-category">
                    <h5><i class="fas fa-edit"></i> Permissões de Escrita</h5>
                    ${renderRoleWritePermissions(roleKey, role)}
                </div>
            </div>
        </div>
    `;
}

// Renderizar permissões de cards para edição de perfil
function renderRoleCardPermissions(roleKey, role) {
    const allCards = [
        {id: 'card-comunicados', label: 'Últimos Comunicados'},
        {id: 'card-pendencias', label: 'Minhas Pendências'},
        {id: 'card-kpis', label: 'Indicadores de Qualidade'},
        {id: 'card-rops', label: 'ROPs Desafio'},
        {id: 'card-residencia', label: 'Residência Médica'},
        {id: 'card-incidentes', label: 'Gestão de Incidentes'},
        {id: 'card-auditorias', label: 'Auditorias e Conformidade'},
        {id: 'card-relatorios', label: 'Relatórios de Segurança'},
        {id: 'card-biblioteca', label: 'Biblioteca de Documentos'},
        {id: 'card-medicamentos', label: 'Segurança de Medicamentos'},
        {id: 'card-infeccao', label: 'Controle de Infecção'},
        {id: 'card-checklist', label: 'Checklist de Cirurgia Segura'},
        {id: 'card-conciliacao', label: 'Conciliação Medicamentosa'},
        {id: 'card-riscos', label: 'Avaliação de Riscos'},
        {id: 'card-calculadoras', label: 'Calculadoras Anestésicas'}
    ];
    
    return allCards.map(card => {
        const currentValue = role.permissions[card.id] || false;
        return `
            <div class="permission-toggle">
                <label class="toggle-label">
                    <input 
                        type="checkbox" 
                        ${currentValue ? 'checked' : ''}
                        onchange="updateRolePermission('${roleKey}', '${card.id}', this.checked)"
                    >
                    <span class="toggle-slider"></span>
                    <span class="toggle-text">${card.label}</span>
                </label>
            </div>
        `;
    }).join('');
}

// Renderizar permissões de documentos para edição de perfil
function renderRoleDocumentPermissions(roleKey, role) {
    const docCategories = [
        'doc-protocolos', 'doc-politicas', 'doc-formularios', 'doc-manuais',
        'doc-relatorios', 'doc-processos', 'doc-riscos', 'doc-termos',
        'doc-clima', 'doc-plano'
    ];
    
    return docCategories.map(key => {
        const currentValue = role.permissions[key] || false;
        const label = key.replace('doc-', '').replace(/-/g, ' ')
            .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        
        return `
            <div class="permission-toggle">
                <label class="toggle-label">
                    <input 
                        type="checkbox" 
                        ${currentValue ? 'checked' : ''}
                        onchange="updateRolePermission('${roleKey}', '${key}', this.checked)"
                    >
                    <span class="toggle-slider"></span>
                    <span class="toggle-text">${label}</span>
                </label>
            </div>
        `;
    }).join('');
}

// Renderizar permissões de escrita para edição de perfil
function renderRoleWritePermissions(roleKey, role) {
    const writeActions = [
        {key: 'doc-create', label: 'Criar Documentos (Geral)'},
        {key: 'doc-edit', label: 'Editar Documentos (Geral)'},
        {key: 'doc-delete', label: 'Excluir Documentos (Geral)'}
    ];
    
    return writeActions.map(action => {
        const currentValue = role.permissions[action.key] || false;
        return `
            <div class="permission-toggle">
                <label class="toggle-label">
                    <input 
                        type="checkbox" 
                        ${currentValue ? 'checked' : ''}
                        onchange="updateRolePermission('${roleKey}', '${action.key}', this.checked)"
                    >
                    <span class="toggle-slider"></span>
                    <span class="toggle-text">${action.label}</span>
                </label>
            </div>
        `;
    }).join('');
}

// Atualizar permissão padrão de um perfil
async function updateRolePermission(roleKey, permissionKey, value) {
    try {
        // Atualizar no template local
        ROLES_TEMPLATES[roleKey].permissions[permissionKey] = value;
        
        showToast('Permissão padrão atualizada. Esta alteração afetará novos usuários e usuários sem customizações.', 'success');
    } catch (error) {
        showToast('Erro ao atualizar permissão padrão: ' + error.message, 'error');
    }
}

// Mostrar matriz de permissões
function showPermissionsMatrix() {
    const content = document.getElementById('adminContent');
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    const allCards = [
        'card-comunicados', 'card-pendencias', 'card-kpis', 'card-rops',
        'card-residencia', 'card-incidentes', 'card-auditorias', 'card-relatorios',
        'card-biblioteca', 'card-medicamentos', 'card-infeccao', 'card-checklist',
        'card-conciliacao', 'card-riscos', 'card-calculadoras'
    ];
    
    let html = `
        <div class="permissions-matrix">
            <h3>Matriz de Permissões de Cards</h3>
            <div style="overflow-x: auto;">
                <table class="matrix-table">
                    <thead>
                        <tr>
                            <th>Perfil</th>
                            ${allCards.map(card => `<th>${card.replace('card-', '').replace(/-/g, ' ')}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.keys(ROLES_TEMPLATES).map(roleKey => {
                            const role = ROLES_TEMPLATES[roleKey];
                            return `
                                <tr>
                                    <td><strong>${role.name}</strong></td>
                                    ${allCards.map(card => {
                                        const hasPermission = role.permissions[card] || false;
                                        return `<td style="text-align: center;">
                                            ${hasPermission ? '<i class="fas fa-check" style="color: green;"></i>' : '<i class="fas fa-times" style="color: red;"></i>'}
                                        </td>`;
                                    }).join('')}
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    content.innerHTML = html;
}

// Formatador de data
function formatDate(timestamp) {
    if (!timestamp) return 'Nunca';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR');
}

// ==================== GERENCIAMENTO DE EMAILS AUTORIZADOS ====================

// Listar emails autorizados
async function showAuthorizedEmailsList() {
    const content = document.getElementById('adminContent');
    content.innerHTML = '<div class="admin-loading"><i class="fas fa-spinner fa-spin"></i><p>Carregando emails autorizados...</p></div>';
    
    try {
        // Buscar todos os emails autorizados
        const snapshot = await db.collection('authorized_emails').get();
        
        const emails = [];
        snapshot.forEach(doc => {
            emails.push({ id: doc.id, ...doc.data() });
        });
        
        // Ordenar alfabeticamente por nome
        emails.sort((a, b) => {
            const nameA = (a.name || a.email || '').toLowerCase();
            const nameB = (b.name || b.email || '').toLowerCase();
            return nameA.localeCompare(nameB, 'pt-BR');
        });
        
        if (emails.length === 0) {
            content.innerHTML = `
                <div class="admin-empty">
                    <i class="fas fa-envelope-open-text"></i>
                    <h3>Nenhum email autorizado</h3>
                    <p>Adicione emails para permitir que usuários se cadastrem no sistema</p>
                    <button onclick="showAddAuthorizedEmailModal()" class="btn-primary" style="margin-top: 16px;">
                        <i class="fas fa-plus"></i> Adicionar Email Autorizado
                    </button>
                </div>
            `;
            return;
        }
        
        // Renderizar lista de emails
        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <div>
                    <h2 style="margin: 0; font-size: 20px; color: #1f2937;">Emails Autorizados</h2>
                    <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 14px;">
                        Gerencie os emails autorizados a se cadastrar no sistema
                    </p>
                </div>
                <button onclick="showAddAuthorizedEmailModal()" class="btn-primary">
                    <i class="fas fa-plus"></i> Adicionar Email
                </button>
            </div>
            
            <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead style="background: #f9fafb; border-bottom: 1px solid #e5e7eb;">
                            <tr>
                                <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: #374151; font-size: 14px;">Nome</th>
                                <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: #374151; font-size: 14px;">Email</th>
                                <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: #374151; font-size: 14px;">Status</th>
                                <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: #374151; font-size: 14px;">Adicionado em</th>
                                <th style="padding: 12px 16px; text-align: center; font-weight: 600; color: #374151; font-size: 14px;">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        emails.forEach(email => {
            const isActive = email.isActive !== false;
            const statusBadge = isActive 
                ? '<span style="display: inline-block; padding: 4px 8px; background: #d1fae5; color: #065f46; border-radius: 6px; font-size: 12px; font-weight: 500;">Ativo</span>'
                : '<span style="display: inline-block; padding: 4px 8px; background: #fee2e2; color: #991b1b; border-radius: 6px; font-size: 12px; font-weight: 500;">Inativo</span>';
            
            html += `
                <tr style="border-bottom: 1px solid #f3f4f6;">
                    <td style="padding: 16px; color: #1f2937; font-weight: 500;">${email.name || 'Não informado'}</td>
                    <td style="padding: 16px; color: #6b7280;">${email.email}</td>
                    <td style="padding: 16px;">${statusBadge}</td>
                    <td style="padding: 16px; color: #6b7280; font-size: 14px;">${formatDate(email.addedAt)}</td>
                    <td style="padding: 16px; text-align: center;">
                        <div style="display: flex; gap: 8px; justify-content: center;">
                            ${isActive 
                                ? `<button onclick="toggleAuthorizedEmailStatus('${email.id}', false)" class="btn-icon" title="Desativar" style="color: #f59e0b;">
                                    <i class="fas fa-ban"></i>
                                   </button>`
                                : `<button onclick="toggleAuthorizedEmailStatus('${email.id}', true)" class="btn-icon" title="Ativar" style="color: #10b981;">
                                    <i class="fas fa-check-circle"></i>
                                   </button>`
                            }
                            <button onclick="deleteAuthorizedEmail('${email.id}', '${email.email}')" class="btn-icon" title="Excluir" style="color: #ef4444;">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        html += `
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div style="margin-top: 16px; padding: 16px; background: #eff6ff; border-radius: 8px; border-left: 4px solid #3b82f6;">
                <div style="display: flex; align-items: start; gap: 12px;">
                    <i class="fas fa-info-circle" style="color: #3b82f6; margin-top: 2px;"></i>
                    <div>
                        <h4 style="margin: 0 0 8px 0; color: #1e40af; font-size: 14px; font-weight: 600;">Sobre Emails Autorizados</h4>
                        <p style="margin: 0; color: #1e40af; font-size: 13px; line-height: 1.6;">
                            Apenas usuários com emails nesta lista podem se cadastrar no sistema. 
                            Quando desativado, o email não poderá mais se registrar, mas usuários já cadastrados não são afetados.
                        </p>
                    </div>
                </div>
            </div>
        `;
        
        content.innerHTML = html;
        
    } catch (error) {
        console.error('Erro ao carregar emails autorizados:', error);
        content.innerHTML = `
            <div class="admin-empty">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Erro ao carregar emails</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

// Modal para adicionar email autorizado
function showAddAuthorizedEmailModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h2><i class="fas fa-envelope-open-text"></i> Adicionar Email Autorizado</h2>
                <button class="btn-close" onclick="this.closest('.modal-overlay').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <form id="addAuthorizedEmailForm" onsubmit="handleAddAuthorizedEmail(event)">
                    <div class="form-group-new">
                        <label>Nome Completo</label>
                        <input type="text" id="authorizedName" placeholder="Digite o nome completo" required>
                    </div>
                    <div class="form-group-new">
                        <label>Email</label>
                        <input type="email" id="authorizedEmail" placeholder="Digite o email" required>
                    </div>
                    <div style="display: flex; gap: 12px; margin-top: 24px;">
                        <button type="button" onclick="this.closest('.modal-overlay').remove()" class="btn-secondary" style="flex: 1;">
                            Cancelar
                        </button>
                        <button type="submit" class="btn-primary" style="flex: 1;">
                            <i class="fas fa-plus"></i> Adicionar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('authorizedName').focus();
}

// Adicionar email autorizado
async function handleAddAuthorizedEmail(event) {
    event.preventDefault();
    
    const name = document.getElementById('authorizedName').value.trim();
    const email = document.getElementById('authorizedEmail').value.trim().toLowerCase();
    
    if (!name || !email) {
        showToast('Preencha todos os campos', 'error');
        return;
    }
    
    try {
        showLoading();
        
        // Verificar se já existe
        const existingDoc = await db.collection('authorized_emails').doc(email).get();
        if (existingDoc.exists) {
            hideLoading();
            showToast('Este email já está na lista de autorizados', 'warning');
            return;
        }
        
        // Adicionar email autorizado
        await db.collection('authorized_emails').doc(email).set({
            email: email,
            name: name,
            addedAt: firebase.firestore.FieldValue.serverTimestamp(),
            addedBy: currentUser.uid,
            isActive: true
        });
        
        hideLoading();
        showToast('Email autorizado adicionado com sucesso!', 'success');
        
        // Fechar modal
        document.querySelector('.modal-overlay')?.remove();
        
        // Recarregar lista
        showAuthorizedEmailsList();
        
    } catch (error) {
        hideLoading();
        console.error('Erro ao adicionar email autorizado:', error);
        showToast('Erro ao adicionar email: ' + error.message, 'error');
    }
}

// Alternar status do email autorizado
async function toggleAuthorizedEmailStatus(emailId, newStatus) {
    const action = newStatus ? 'ativar' : 'desativar';
    
    if (!confirm(`Tem certeza que deseja ${action} este email?`)) {
        return;
    }
    
    try {
        showLoading();
        
        await db.collection('authorized_emails').doc(emailId).update({
            isActive: newStatus
        });
        
        hideLoading();
        showToast(`Email ${action === 'ativar' ? 'ativado' : 'desativado'} com sucesso!`, 'success');
        
        // Recarregar lista
        showAuthorizedEmailsList();
        
    } catch (error) {
        hideLoading();
        console.error('Erro ao alterar status:', error);
        showToast('Erro ao alterar status: ' + error.message, 'error');
    }
}

// Excluir email autorizado
async function deleteAuthorizedEmail(emailId, emailAddress) {
    if (!confirm(`Tem certeza que deseja excluir o email:\n\n${emailAddress}\n\nEsta ação não pode ser desfeita.`)) {
        return;
    }
    
    try {
        showLoading();
        
        await db.collection('authorized_emails').doc(emailId).delete();
        
        hideLoading();
        showToast('Email removido com sucesso!', 'success');
        
        // Recarregar lista
        showAuthorizedEmailsList();
        
    } catch (error) {
        hideLoading();
        console.error('Erro ao excluir email:', error);
        showToast('Erro ao excluir email: ' + error.message, 'error');
    }
}

// ==================== EXPORTAR ====================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ROLES_TEMPLATES,
        getUserPermissions,
        hasPermission,
        canAccessModule,
        getAvailableROPs,
        getAvailableDocuments
    };
}


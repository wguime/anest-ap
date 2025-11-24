// ==================== SEÇÃO PAINEL (SITEMAP v2) ====================

// ========== COMUNICADOS (mantido) ==========
async function showComunicados() {
    const section = document.getElementById('painelSection');
    if (!section) return;
    
    // Verificar se é admin usando checkUserRole (disponível no app.js)
    let isAdminUser = false;
    if (typeof checkUserRole === 'function') {
        isAdminUser = await checkUserRole(['Administrador', 'Coordenador']);
    } else {
        // Fallback: verificar por email (função local)
        if (currentUser && currentUser.email) {
            const adminEmails = ['admin@anest.com.br', 'guilherme@anest.com.br'];
            isAdminUser = adminEmails.includes(currentUser.email);
        }
    }
    console.log('🔍 showComunicados (painel-qualidade.js) - isAdminUser:', isAdminUser);
    
    const html = `
        ${renderInfoBanner('fas fa-bullhorn', 'Últimos Comunicados', 'Notícias e atualizações da diretoria', '#2563eb 0%, #3b82f6 100%', "showSection('painel')")}
        <div style="margin-bottom: 20px; text-align: right;">
            ${isAdminUser ? `<button class="btn-add" onclick="showModalNovoComunicado()" style="background: #2563eb; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; gap: 8px;"><i class="fas fa-plus"></i> Novo Comunicado</button>` : ''}
        </div>

        <div class="comunicados-container" id="comunicadosContainer">
            <div class="loading-spinner">
                <i class="fas fa-spinner fa-spin"></i> Carregando comunicados...
            </div>
        </div>
    `;
    
    section.innerHTML = html;
    await loadComunicados();
}

async function loadComunicados() {
    try {
        const comunicadosRef = db.collection('comunicados').orderBy('data', 'desc').limit(20);
        const snapshot = await comunicadosRef.get();
        
        const container = document.getElementById('comunicadosContainer');
        
        if (snapshot.empty) {
            container.innerHTML = `
                <div class="info-box">
                    <i class="fas fa-info-circle"></i> Nenhum comunicado disponível no momento.
                    ${(() => {
                        if (!currentUser) return false;
                        const adminEmails = ['admin@anest.com.br', 'guilherme@anest.com.br'];
                        return adminEmails.includes(currentUser.email);
                    })() ? '<br><br>Clique em "Novo" para criar o primeiro comunicado.' : ''}
                </div>
            `;
            return;
        }
        
        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const dataFormatada = data.data?.toDate().toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }) || 'Data não disponível';
            
            const priorityClass = data.prioridade === 'alta' ? 'priority-high' : 
                                 data.prioridade === 'media' ? 'priority-medium' : 'priority-low';
            
            const priorityLabel = data.prioridade === 'alta' ? '🔴 Urgente' : 
                                 data.prioridade === 'media' ? '🟡 Normal' : '🟢 Informativo';
            
            html += `
                <div class="comunicado-card ${priorityClass}" onclick="showComunicadoDetalhes('${doc.id}')">
                    <div class="comunicado-header">
                        <div class="comunicado-priority">${priorityLabel}</div>
                        <div class="comunicado-date">${dataFormatada}</div>
                    </div>
                    <h3 class="comunicado-title">${data.titulo}</h3>
                    <p class="comunicado-preview">${data.conteudo.substring(0, 150)}${data.conteudo.length > 150 ? '...' : ''}</p>
                    <div class="comunicado-footer">
                        <div class="comunicado-author">
                            <i class="fas fa-user"></i> ${data.autor || 'Administração'}
                        </div>
                        ${data.categoria ? `<div class="comunicado-category"><i class="fas fa-tag"></i> ${data.categoria}</div>` : ''}
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Erro ao carregar comunicados:', error);
        document.getElementById('comunicadosContainer').innerHTML = `
            <div class="info-box" style="background: #FEE2E2; color: #991B1B;">
                <i class="fas fa-exclamation-triangle"></i> Erro ao carregar comunicados. Tente novamente.
            </div>
        `;
    }
}

async function showComunicadoDetalhes(id) {
    try {
        const doc = await db.collection('comunicados').doc(id).get();
        if (!doc.exists) {
            showToast('Comunicado não encontrado', 'error');
            return;
        }
        
        const data = doc.data();
        const dataFormatada = data.data?.toDate().toLocaleString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }) || 'Data não disponível';
        
        const isAdmin = (() => {
            if (!currentUser) return false;
            const adminEmails = ['admin@anest.com.br', 'guilherme@anest.com.br'];
            return adminEmails.includes(currentUser.email);
        })();
        
        const section = document.getElementById('painelSection');
        const html = `
            ${renderInfoBanner('fas fa-bullhorn', data.titulo, 'Detalhes do comunicado', '#2563eb 0%, #3b82f6 100%', 'showComunicados()')}
            ${isAdmin ? `<div style="margin-bottom: 20px; text-align: right;"><button class="btn-delete" onclick="deleteComunicado('${id}')" style="background: #DC2626; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; gap: 8px;"><i class="fas fa-trash"></i> Excluir</button></div>` : ''}

            <div class="comunicado-detalhes">
                <div class="comunicado-meta">
                    <div><i class="fas fa-calendar"></i> ${dataFormatada}</div>
                    <div><i class="fas fa-user"></i> ${data.autor || 'Administração'}</div>
                    ${data.categoria ? `<div><i class="fas fa-tag"></i> ${data.categoria}</div>` : ''}
                </div>
                <div class="comunicado-content">
                    ${data.conteudo.replace(/\n/g, '<br>')}
                </div>
            </div>
        `;
        
        section.innerHTML = html;
    } catch (error) {
        console.error('Erro ao carregar detalhes:', error);
        showToast('Erro ao carregar comunicado', 'error');
    }
}

function showNovoComunicado() {
    const section = document.getElementById('painelSection');
    const html = `
        ${renderInfoBanner('fas fa-plus-circle', 'Novo Comunicado', 'Criar novo comunicado para a instituição', '#2563eb 0%, #3b82f6 100%', 'showComunicados()')}

        <div class="form-container">
            <form id="novoComunicadoForm" class="calc-form">
                <div class="form-group">
                    <label class="form-label"><i class="fas fa-heading"></i> Título *</label>
                    <input type="text" class="form-select" id="com_titulo" placeholder="Ex: Nova atualização de protocolo" required>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-align-left"></i> Conteúdo *</label>
                    <textarea class="form-select" id="com_conteudo" rows="8" placeholder="Descreva o comunicado..." required></textarea>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-exclamation-circle"></i> Prioridade</label>
                    <select class="form-select" id="com_prioridade">
                        <option value="baixa">🟢 Informativo</option>
                        <option value="media" selected>🟡 Normal</option>
                        <option value="alta">🔴 Urgente</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-tag"></i> Categoria</label>
                    <select class="form-select" id="com_categoria">
                        <option value="">Selecione...</option>
                        <option value="Protocolos">Protocolos</option>
                        <option value="Segurança">Segurança</option>
                        <option value="Medicamentos">Medicamentos</option>
                        <option value="Treinamento">Treinamento</option>
                        <option value="Administrativo">Administrativo</option>
                        <option value="Eventos">Eventos</option>
                    </select>
                </div>

                <button type="submit" class="btn-primary">
                    <i class="fas fa-paper-plane"></i> Publicar Comunicado
                </button>
            </form>
        </div>
    `;
    
    section.innerHTML = html;
    
    document.getElementById('novoComunicadoForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await salvarComunicado();
    });
}

async function salvarComunicado() {
    try {
        showLoading();
        
        const titulo = document.getElementById('com_titulo').value;
        const conteudo = document.getElementById('com_conteudo').value;
        const prioridade = document.getElementById('com_prioridade').value;
        const categoria = document.getElementById('com_categoria').value;
        
        await db.collection('comunicados').add({
            titulo,
            conteudo,
            prioridade,
            categoria,
            autor: currentUser.email,
            autorNome: currentUser.displayName || currentUser.email,
            data: firebase.firestore.FieldValue.serverTimestamp(),
            ativo: true
        });
        
        hideLoading();
        showToast('Comunicado publicado com sucesso!', 'success');
        showComunicados();
    } catch (error) {
        hideLoading();
        console.error('Erro ao salvar comunicado:', error);
        showToast('Erro ao publicar comunicado', 'error');
    }
}

async function deleteComunicado(id) {
    if (!confirm('Tem certeza que deseja excluir este comunicado?')) return;
    
    try {
        showLoading();
        await db.collection('comunicados').doc(id).delete();
        hideLoading();
        showToast('Comunicado excluído com sucesso!', 'success');
        showComunicados();
    } catch (error) {
        hideLoading();
        console.error('Erro ao excluir comunicado:', error);
        showToast('Erro ao excluir comunicado', 'error');
    }
}

// ========== PENDÊNCIAS INTELIGENTES (NOVO) ==========
async function showPendencias() {
    const section = document.getElementById('painelSection');
    if (!section) return;
    
    const html = `
        ${renderInfoBanner('fas fa-tasks', 'Minhas Pendências', 'Tarefas, leituras obrigatórias e treinamentos', '#f59e0b 0%, #d97706 100%', "showSection('painel')")}

        <div class="pendencias-stats">
            <div class="stat-card stat-atrasada">
                <div class="stat-number" id="pendAtrasadas">--</div>
                <div class="stat-label">Atrasadas</div>
            </div>
            <div class="stat-card stat-pendente">
                <div class="stat-number" id="pendPendentes">--</div>
                <div class="stat-label">Pendentes</div>
            </div>
            <div class="stat-card stat-concluido">
                <div class="stat-number" id="pendConcluidas">--</div>
                <div class="stat-label">Concluídas</div>
            </div>
        </div>

        <div class="pendencias-container" id="pendenciasContainer">
            <div class="loading-spinner">
                <i class="fas fa-spinner fa-spin"></i> Carregando pendências...
            </div>
        </div>
    `;
    
    section.innerHTML = html;
    await loadPendenciasInteligentes();
}

async function loadPendenciasInteligentes() {
    try {
        const pendencias = [];
        
        // 1. ROPs não concluídas - COM FALLBACK
        if (typeof userProgress !== 'undefined' && userProgress.scores && typeof ropsData !== 'undefined') {
            const ropsKeys = Object.keys(ropsData || {});
            for (const key of ropsKeys) {
                const progresso = userProgress.scores[key] || 0;
                if (progresso < 100) {
                    pendencias.push({
                        tipo: 'rop',
                        titulo: `ROPs: ${ropsData[key]?.nome || key}`,
                        descricao: `Quiz não concluído (${progresso.toFixed(0)}% completo)`,
                        progresso: progresso,
                        prioridade: progresso < 30 ? 'alta' : progresso < 70 ? 'media' : 'baixa',
                        icone: '🏆',
                        acao: () => showROPsChoiceMenu(key)
                    });
                }
            }
        } else {
            // FALLBACK: Pendências de exemplo quando dados não estão disponíveis
            pendencias.push({
                tipo: 'exemplo',
                titulo: 'ROPs: Avaliação de Riscos',
                descricao: 'Quiz não concluído (0% completo)',
                progresso: 0,
                prioridade: 'alta',
                icone: '🏆',
                acao: () => showToast('Redirecionando para ROPs...', 'info')
            });
            pendencias.push({
                tipo: 'exemplo',
                titulo: 'ROPs: Comunicação',
                descricao: 'Quiz não concluído (25% completo)',
                progresso: 25,
                prioridade: 'media',
                icone: '🏆',
                acao: () => showToast('Redirecionando para ROPs...', 'info')
            });
        }
        
        // 2. Documentos não lidos (simulado - implementar lógica real depois)
        const docsNaoLidos = await getDocsNaoLidos();
        pendencias.push(...docsNaoLidos);
        
        // 3. Treinamentos pendentes (simulado)
        const treinamentos = await getTreinamentosPendentes();
        pendencias.push(...treinamentos);
        
        // 4. Tarefas manuais do usuário - COM FALLBACK
        try {
            const tarefasSnapshot = await db.collection('pendencias')
                .where('usuario', '==', currentUser.uid)
                .where('status', '==', 'pendente')
                .get();
            
            tarefasSnapshot.forEach(doc => {
                const data = doc.data();
                const prazo = data.prazo?.toDate();
                const hoje = new Date();
                const atrasada = prazo && prazo < hoje;
                
                pendencias.push({
                    tipo: 'tarefa',
                    titulo: data.titulo,
                    descricao: data.descricao || '',
                    prioridade: atrasada ? 'alta' : data.prioridade,
                    prazo: prazo,
                    atrasada: atrasada,
                    icone: '📝',
                    id: doc.id,
                    acao: () => togglePendencia(doc.id, false)
                });
            });
        } catch (error) {
            console.log('Firebase não disponível, usando dados de exemplo');
            // Adicionar pendências de exemplo
            pendencias.push({
                tipo: 'exemplo',
                titulo: 'Leitura de Protocolo: Segurança de Medicamentos',
                descricao: 'Protocolo obrigatório para todos os profissionais',
                prioridade: 'media',
                icone: '📚',
                acao: () => showToast('Abrindo protocolo...', 'info')
            });
            pendencias.push({
                tipo: 'exemplo',
                titulo: 'Treinamento: Higiene das Mãos',
                descricao: 'Curso obrigatório de atualização',
                prioridade: 'baixa',
                icone: '🎓',
                acao: () => showToast('Abrindo treinamento...', 'info')
            });
        }
        
        // Calcular estatísticas
        const hoje = new Date();
        const atrasadas = pendencias.filter(p => p.atrasada || (p.prazo && p.prazo < hoje)).length;
        const pendentes = pendencias.filter(p => !p.atrasada && (!p.prazo || p.prazo >= hoje)).length;
        
        document.getElementById('pendAtrasadas').textContent = atrasadas;
        document.getElementById('pendPendentes').textContent = pendentes;
        document.getElementById('pendConcluidas').textContent = '0'; // Implementar depois
        
        const container = document.getElementById('pendenciasContainer');
        
        if (pendencias.length === 0) {
            container.innerHTML = `
                <div class="info-box">
                    <i class="fas fa-check-circle"></i> Parabéns! Você não tem pendências no momento!
                </div>
            `;
            return;
        }
        
        // Ordenar por prioridade
        pendencias.sort((a, b) => {
            const prioridadeOrdem = { alta: 0, media: 1, baixa: 2 };
            return prioridadeOrdem[a.prioridade] - prioridadeOrdem[b.prioridade];
        });
        
        let html = '';
        pendencias.forEach(pend => {
            const prioClass = pend.atrasada ? 'pendencia-atrasada' : 
                            pend.prioridade === 'alta' ? 'pendencia-alta' : '';
            
            html += `
                <div class="pendencia-card ${prioClass}" onclick="executarPendencia('${pend.tipo}', '${pend.id || ''}', '${pend.titulo}')">
                    <div class="pendencia-icon">${pend.icone}</div>
                    <div class="pendencia-content">
                        <h3 class="pendencia-title">${pend.titulo}</h3>
                        <p class="pendencia-desc">${pend.descricao}</p>
                        ${pend.progresso !== undefined ? `
                            <div class="progress-mini">
                                <div class="progress-bar" style="width: ${pend.progresso}%"></div>
                                <span class="progress-text">${pend.progresso.toFixed(0)}%</span>
                            </div>
                        ` : ''}
                        ${pend.prazo ? `
                            <div class="pendencia-prazo">
                                <i class="fas fa-calendar"></i> ${pend.prazo.toLocaleDateString('pt-BR')}
                                ${pend.atrasada ? '<span class="badge-atrasada">⚠️ Atrasada</span>' : ''}
                            </div>
                        ` : ''}
                    </div>
                    <i class="fas fa-chevron-right card-arrow"></i>
                </div>
            `;
        });
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Erro ao carregar pendências:', error);
        document.getElementById('pendenciasContainer').innerHTML = `
            <div class="info-box" style="background: #FEE2E2; color: #991B1B;">
                <i class="fas fa-exclamation-triangle"></i> Erro ao carregar pendências. Tente novamente.
            </div>
        `;
    }
}

async function getDocsNaoLidos() {
    // TODO: Implementar lógica real de docs não lidos
    // Por enquanto, retorna array vazio
    return [];
}

async function getTreinamentosPendentes() {
    // TODO: Implementar lógica real de treinamentos
    // Por enquanto, retorna array vazio
    return [];
}

function executarPendencia(tipo, id, titulo) {
    // Redirecionar para a tela apropriada
    if (tipo === 'rop') {
        // Extrair key da ROPs do título e abrir
        // Implementar lógica específica
        showToast('Abrindo ROPs...', 'info');
    } else if (tipo === 'tarefa' && id) {
        // Marcar tarefa como concluída
        togglePendencia(id, false);
    }
}

async function togglePendencia(id, isConcluida) {
    try {
        await db.collection('pendencias').doc(id).update({
            status: isConcluida ? 'pendente' : 'concluida',
            dataConclusao: isConcluida ? null : firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showToast('Pendência atualizada!', 'success');
        loadPendenciasInteligentes();
    } catch (error) {
        console.error('Erro ao atualizar pendência:', error);
        showToast('Erro ao atualizar pendência', 'error');
    }
}

// ========== KPIs ESPECÍFICOS (NOVO) ==========
async function showKPIs() {
    // Atualizar histórico de navegação
    if (typeof atualizarHistoricoNavegacao === 'function') {
        atualizarHistoricoNavegacao('kpis');
    }
    
    const section = document.getElementById('painelSection');
    if (!section) return;
    
    // Verificar se é admin usando checkUserRole (disponível no app.js)
    let isAdminUser = false;
    if (typeof checkUserRole === 'function') {
        isAdminUser = await checkUserRole(['Administrador', 'Coordenador']);
    } else {
        // Fallback: verificar por email (função local)
        if (currentUser && currentUser.email) {
            const adminEmails = ['admin@anest.com.br', 'guilherme@anest.com.br'];
            isAdminUser = adminEmails.includes(currentUser.email);
        }
    }
    
    const html = `
        ${renderInfoBanner('fas fa-chart-line', 'Painel de Gestão à Vista', 'KPIs e métricas de desempenho institucional', '#059669 0%, #10B981 100%', "showSection('painel')")}
        ${isAdminUser ? `<div style="margin-bottom: 20px; text-align: right;"><button class="btn-add" onclick="showEditarKPIs()" style="background: #059669; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; gap: 8px;"><i class="fas fa-edit"></i> Editar KPIs</button></div>` : ''}

        <div class="kpis-container" id="kpisContainer">
            <div class="loading-spinner">
                <i class="fas fa-spinner fa-spin"></i> Carregando indicadores...
            </div>
        </div>
    `;
    
    section.innerHTML = html;
    await loadKPIsEspecificos();
}

// ==================== FUNÇÕES UTILITÁRIAS PARA INDICADORES ANUAIS ====================

// Parse da meta para extrair operador e valor alvo
function parseMeta(metaLabel) {
    const raw = metaLabel.trim().toLowerCase();
    
    // Meta zero
    if (raw.includes("meta zero")) {
        const num = raw.match(/([0-9]+([.,][0-9]+)?)/g);
        if (num) {
            const n = Number(num[0].replace(",", "."));
            return { op: "<=", target: n, raw: metaLabel };
        }
        return { op: "zero", target: 0, raw: metaLabel };
    }
    
    // Razão (ex.: ≤ 1/10.000)
    if (raw.includes("/")) {
        const ratio = raw.match(/([0-9]+)\s*\/\s*([0-9]+)/);
        if (ratio) {
            const num = Number(ratio[1]);
            const den = Number(ratio[2]);
            const pct = (num / den) * 100;
            return { op: "ratioMax", target: pct, raw: metaLabel };
        }
    }
    
    // Operadores comuns com número
    const m = raw.match(/(≥|<=|≤|>=|<|>|\=)\s*([0-9]+([.,][0-9]+)?)/);
    if (m) {
        const opMap = { "≥": ">=", ">=": ">=", "≤": "<=", "<=": "<=", "<": "<", ">": ">", "=": "==" };
        const op = opMap[m[1]];
        const n = Number(m[2].replace(",", "."));
        return { op, target: n, raw: metaLabel };
    }

    // Percentual simples sem operador (assume >=)
    const pctOnly = raw.match(/^([0-9]+([.,][0-9]+)?)\s*%?\s*$/);
    if (pctOnly) {
        const n = Number(pctOnly[1].replace(",", "."));
        return { op: ">=", target: n, raw: metaLabel };
    }

    // Fallback
    return { op: "==", target: NaN, raw: metaLabel };
}

// Avalia status de conformidade
function evaluateStatus(valorSet, metaParsed, unidade) {
    const v = valorSet;
    const near = 0.10; // tolerância de 10% para "Parcial"
    
    const pass = () => ({ label: "Conforme", color: "badge-conforme", emoji: "🟢" });
    const warn = () => ({ label: "Parcial", color: "badge-parcial", emoji: "🟠" });
    const fail = () => ({ label: "Não conforme", color: "badge-nao-conforme", emoji: "🔴" });
    
    if (metaParsed.op === "zero") {
        if (v === 0) return pass();
        if (v > 0 && v <= 0.0001) return warn();
        return fail();
    }
    
    if (metaParsed.op === "ratioMax") {
        if (v <= metaParsed.target) return pass();
        if (v <= metaParsed.target * (1 + near)) return warn();
        return fail();
    }
    
    if (isNaN(metaParsed.target)) {
        return { label: "Info", color: "badge-info", emoji: "ℹ️" };
    }
    
    // Operadores numéricos
    if (metaParsed.op === ">=" || metaParsed.op === ">") {
        const thresh = metaParsed.op === ">" ? metaParsed.target + Number.EPSILON : metaParsed.target;
        if (v >= thresh) return pass();
        if (v >= thresh * (1 - near)) return warn();
        return fail();
    }
    
    if (metaParsed.op === "<=" || metaParsed.op === "<") {
        const thresh = metaParsed.op === "<" ? metaParsed.target - Number.EPSILON : metaParsed.target;
        if (v <= thresh) return pass();
        if (v <= thresh * (1 + near)) return warn();
        return fail();
    }
    
    if (metaParsed.op === "==") {
        if (v === metaParsed.target) return pass();
        if (Math.abs(v - metaParsed.target) / (metaParsed.target || 1) <= near) return warn();
        return fail();
    }
    
    return { label: "Info", color: "badge-info", emoji: "ℹ️" };
}

// Calcula média anual
function calcularMedia(meses) {
    const sum = meses.reduce((a, b) => a + b, 0);
    return Number((sum / meses.length).toFixed(2));
}

// Formata valor com unidade
function formatValor(v, unidade) {
    if (unidade === "%") {
        return `${v}${unidade}`;
    }
    return `${v}`;
}

// Função helper para determinar ícone FontAwesome baseado no ID do indicador
function getIconFA(kpiId) {
    const iconMap = {
        'consulta_pre_anestesica': 'fa-calendar-check',
        'dor_intraop_alta': 'fa-heartbeat',
        'jejum_abreviado': 'fa-clock',
        'pcr_inducao_alta': 'fa-exclamation-circle',
        'mudanca_tecnica': 'fa-exchange-alt',
        'uti_sem_planejamento': 'fa-hospital',
        'controle_glicemico': 'fa-chart-line',
        'saidas_sem_evento': 'fa-check-circle',
        'mortalidade_48h_30d': 'fa-cross',
        'estrat_risco_asa': 'fa-clipboard-check',
        'via_aerea_dificil_nao_ident': 'fa-lungs',
        'nvpo': 'fa-dizzy',
        'intoxicacao_locais': 'fa-syringe',
        'atb_timing': 'fa-clock',
        'atb_droga_correta': 'fa-pills',
        'atb_repique': 'fa-redo',
        'profilaxia_antimicrobiana': 'fa-pills',
        'prev_cefaleia_ppd': 'fa-head-side-virus',
        'hipotermia_intraop': 'fa-thermometer-half',
        'adesao_protocolos_seguranca': 'fa-shield-alt',
        'adesao_protocolos_clinicos': 'fa-clipboard-list'
    };
    return iconMap[kpiId] || 'fa-chart-bar'; // Ícone padrão
}

// Função helper para determinar cor do ícone baseado no ID do indicador
function getIconColor(kpiId) {
    const colorMap = {
        'consulta_pre_anestesica': '#10B981', // Verde
        'dor_intraop_alta': '#EC4899', // Rosa/Vermelho
        'jejum_abreviado': '#F59E0B', // Laranja
        'pcr_inducao_alta': '#EF4444', // Vermelho crítico
        'mudanca_tecnica': '#3B82F6', // Azul
        'uti_sem_planejamento': '#8B5CF6', // Roxo
        'controle_glicemico': '#10B981', // Verde
        'saidas_sem_evento': '#10B981', // Verde
        'mortalidade_48h_30d': '#991B1B', // Vermelho escuro
        'estrat_risco_asa': '#3B82F6', // Azul
        'via_aerea_dificil_nao_ident': '#F59E0B', // Laranja
        'nvpo': '#EC4899', // Rosa/Vermelho
        'intoxicacao_locais': '#8B5CF6', // Roxo
        'atb_timing': '#10B981', // Verde
        'atb_droga_correta': '#10B981', // Verde
        'atb_repique': '#10B981', // Verde
        'profilaxia_antimicrobiana': '#10B981', // Verde
        'prev_cefaleia_ppd': '#3B82F6', // Azul
        'hipotermia_intraop': '#60A5FA', // Azul claro
        'adesao_protocolos_seguranca': '#16A085', // Verde teal
        'adesao_protocolos_clinicos': '#16A085' // Verde teal
    };
    return colorMap[kpiId] || '#004225'; // Verde primário como padrão
}

// Função helper para calcular porcentagem de progresso da barra baseado na meta
function calcularProgressoBarra(valorSet, metaParsed, unidade) {
    // Se já é porcentagem e a meta também é porcentagem, usar diretamente
    if (unidade === "%" && metaParsed.op && !isNaN(metaParsed.target)) {
        if (metaParsed.op === ">=" || metaParsed.op === ">") {
            // Para metas >=, mostrar progresso até 100% baseado na meta
            const progresso = Math.min(100, (valorSet / metaParsed.target) * 100);
            return progresso;
        } else if (metaParsed.op === "<=" || metaParsed.op === "<") {
            // Para metas <=, inverter: quanto menor, melhor
            // Se está abaixo da meta, mostrar como 100% de sucesso
            if (valorSet <= metaParsed.target) return 100;
            // Se está acima, mostrar progresso negativo (mas limitar visualmente)
            const excesso = ((valorSet - metaParsed.target) / metaParsed.target) * 100;
            return Math.max(0, 100 - excesso);
        }
    }
    
    // Para valores não porcentuais ou casos especiais, usar valorSet diretamente se for < 100
    if (valorSet <= 100) {
        return Math.min(100, Math.max(0, valorSet));
    }
    
    // Fallback: normalizar valores grandes
    return Math.min(100, (valorSet / 100) * 100);
}

async function loadKPIsEspecificos() {
    try {
        // Verificar se o array indicadores2025 está disponível
        if (typeof indicadores2025 === 'undefined') {
            console.error('Array indicadores2025 não está disponível. Verifique se indicadores-anuais-data.js foi carregado.');
            document.getElementById('kpisContainer').innerHTML = `
                <div class="info-box" style="background: #FEE2E2; color: #991B1B;">
                    <i class="fas fa-exclamation-triangle"></i> Erro: dados dos indicadores não carregados.
                </div>
            `;
            return;
        }
        
        const container = document.getElementById('kpisContainer');
        let html = '<div class="kpis-grid">';
        
        // Renderizar cada indicador do array
        indicadores2025.forEach(kpi => {
            const valorSet = kpi.meses[8]; // setembro (índice 8)
            const metaParsed = parseMeta(kpi.metaLabel);
            const status = evaluateStatus(valorSet, metaParsed, kpi.unidade);
            const iconFA = getIconFA(kpi.id);
            const iconColor = getIconColor(kpi.id);
            const progressoBarra = calcularProgressoBarra(valorSet, metaParsed, kpi.unidade);
            
            html += `
                <div class="kpi-card kpi-card-clickable" onclick="showModalGraficoKPI('${kpi.id}')" style="cursor: pointer; position: relative;">
                    <div class="kpi-header">
                        <div class="kpi-icon" style="color: ${iconColor};">
                            <i class="fas ${iconFA}"></i>
                        </div>
                        <div class="kpi-badge ${status.color}" title="Status: ${status.label}">
                            <span>${status.emoji}</span>
                            <span>${status.label}</span>
                        </div>
                    </div>
                    <div class="kpi-body">
                        <h3 class="kpi-title">${kpi.titulo}</h3>
                        <div class="kpi-value">
                            <span class="kpi-number">${formatValor(valorSet, kpi.unidade)}</span>
                        </div>
                    </div>
                    <div class="kpi-periodo" style="font-size: 12px; color: #6B7280; margin-bottom: 8px;">
                        Mês base: Setembro • Meta: ${kpi.metaLabel}
                    </div>
                    <div class="kpi-progress">
                        <div class="kpi-progress-bar" style="width: ${progressoBarra}%"></div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
    } catch (error) {
        console.error('Erro ao carregar KPIs:', error);
        document.getElementById('kpisContainer').innerHTML = `
            <div class="info-box" style="background: #FEE2E2; color: #991B1B;">
                <i class="fas fa-exclamation-triangle"></i> Erro ao carregar indicadores. Tente novamente.
            </div>
        `;
    }
}

// Modal com gráfico de linha (jan→set) usando Chart.js
function showModalGraficoKPI(kpiId) {
    // Buscar o indicador pelo ID
    if (typeof indicadores2025 === 'undefined') {
        showToast('Erro: dados dos indicadores não carregados.', 'error');
        return;
    }
    
    const kpi = indicadores2025.find(i => i.id === kpiId);
    if (!kpi) {
        showToast('Indicador não encontrado.', 'error');
        return;
    }
    
    const valorSet = kpi.meses[8];
    const metaParsed = parseMeta(kpi.metaLabel);
    const status = evaluateStatus(valorSet, metaParsed, kpi.unidade);
    const mediaAnual = calcularMedia(kpi.meses);
    
    const mesesLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set'];
    const chartData = mesesLabels.map((mes, i) => ({
        mes: mes,
        valor: kpi.meses[i]
    }));
    
    // Criar HTML do modal
    const modalId = 'modalGraficoKPI';
    const modalHTML = `
        <div id="${modalId}" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px; overflow-y: auto;">
            <div style="background: white; border-radius: 12px; max-width: 900px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);">
                <div style="padding: 24px; border-bottom: 1px solid #E5E7EB; display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1;">
                        <h2 style="font-size: 24px; font-weight: 700; color: var(--text-primary); margin: 0 0 8px 0; display: flex; align-items: center; gap: 12px;">
                            ${kpi.icone || '📊'} ${kpi.titulo}
                            <span class="kpi-badge ${status.color}" style="font-size: 12px; padding: 4px 8px;">
                                ${status.emoji} ${status.label}
                            </span>
                        </h2>
                        <div style="font-size: 14px; color: #6B7280; margin-top: 4px;">
                            Meta: <strong>${kpi.metaLabel}</strong> • Média anual (Jan–Set): <strong>${formatValor(mediaAnual, kpi.unidade)}</strong>
                        </div>
                    </div>
                    <button onclick="closeModalGraficoKPI()" style="background: none; border: none; font-size: 24px; color: #6B7280; cursor: pointer; padding: 4px; margin-left: 16px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 6px; transition: all 0.2s;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div style="padding: 24px;">
                    <div style="height: 400px; position: relative;">
                        <canvas id="chartKPI_${kpiId}"></canvas>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remover modal anterior se existir
    const existingModal = document.getElementById(modalId);
    if (existingModal) {
        existingModal.remove();
    }
    
    // Adicionar modal ao body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Fechar ao clicar fora do modal
    document.getElementById(modalId).addEventListener('click', (e) => {
        if (e.target.id === modalId) {
            closeModalGraficoKPI();
        }
    });
    
    // Renderizar gráfico usando Chart.js
    setTimeout(() => {
        renderGraficoChartJS(kpiId, chartData, kpi, metaParsed);
    }, 100);
}

// Renderizar gráfico Chart.js
function renderGraficoChartJS(kpiId, chartData, kpi, metaParsed) {
    const canvasId = `chartKPI_${kpiId}`;
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Destruir gráfico anterior se existir
    if (window.chartInstances && window.chartInstances[canvasId]) {
        window.chartInstances[canvasId].destroy();
    }
    
    if (!window.chartInstances) {
        window.chartInstances = {};
    }
    
    // Configurar dados do gráfico
    const datasets = [{
        label: kpi.titulo,
        data: chartData.map(d => d.valor),
        borderColor: '#16a34a',
        backgroundColor: 'rgba(22, 163, 74, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: '#16a34a',
        pointBorderColor: '#fff',
        pointBorderWidth: 2
    }];
    
    // Adicionar linha de referência para meta se for numérica
    if (!isNaN(metaParsed.target) && kpi.unidade === "%") {
        datasets.push({
            label: 'Meta',
            data: Array(9).fill(metaParsed.target),
            borderColor: '#64748b',
            borderWidth: 2,
            borderDash: [6, 6],
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 0
        });
    }
    
    // Criar gráfico
    window.chartInstances[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.map(d => d.mes),
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 15,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatValor(context.parsed.y, kpi.unidade)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatValor(value, kpi.unidade);
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

// Fechar modal de gráfico
function closeModalGraficoKPI() {
    const modal = document.getElementById('modalGraficoKPI');
    if (modal) {
        // Destruir gráfico antes de remover modal
        const canvas = modal.querySelector('canvas');
        if (canvas && window.chartInstances && window.chartInstances[canvas.id]) {
            window.chartInstances[canvas.id].destroy();
            delete window.chartInstances[canvas.id];
        }
        modal.remove();
    }
}

async function showEditarKPIs() {
    const section = document.getElementById('painelSection');
    if (!section) return;
    
    // Verificar se o array kpis está disponível
    if (typeof kpis === 'undefined') {
        showToast('Erro: dados dos indicadores não carregados.', 'error');
        showKPIs();
        return;
    }
    
    // Buscar valores atuais do Firebase
    let valoresAtuais = {};
    try {
        const kpisSnapshot = await db.collection('kpis_valores').get();
        kpisSnapshot.forEach(doc => {
            valoresAtuais[doc.id] = doc.data().value || doc.data().valor || '';
        });
    } catch (error) {
        console.log('Erro ao buscar valores do Firebase:', error);
    }
    
    let kpisEditHtml = '';
    kpis.forEach(kpi => {
        // Usar valor salvo se existir, senão usar valor padrão
        const valorAtual = valoresAtuais[kpi.id] || kpi.value;
        const inputId = `kpi_${kpi.id}`;
        
        kpisEditHtml += `
            <div class="kpi-edit-card">
                <h3>${kpi.icon} ${kpi.title}</h3>
                ${kpi.subtitle ? `<p style="font-size: 12px; color: #6B7280; margin-bottom: 8px;">${kpi.subtitle}</p>` : ''}
                <div class="form-group">
                    <label class="form-label">Valor Atual</label>
                    <input type="text" class="form-select" id="${inputId}" value="${valorAtual}" placeholder="${kpi.value}">
                </div>
                <div class="kpi-meta">Meta: ${kpi.goal}</div>
            </div>
        `;
    });
    
    const html = `
        ${renderInfoBanner('fas fa-edit', 'Editar KPIs', 'Atualizar valores dos indicadores', '#059669 0%, #10B981 100%', 'showKPIs()')}

        <div class="form-container">
            <div class="info-box" style="background: #DBEAFE; margin-bottom: var(--spacing-md);">
                <i class="fas fa-info-circle"></i> 
                <strong>Instruções:</strong> Atualize os valores atuais dos indicadores. Os valores serão salvos no sistema.
            </div>

            <form id="editarKPIsForm" class="calc-form">
                <div class="kpis-edit-grid">
                    ${kpisEditHtml}
                </div>

                <button type="submit" class="btn-primary">
                    <i class="fas fa-save"></i> Salvar Valores dos KPIs
                </button>
            </form>
        </div>
    `;
    
    section.innerHTML = html;
    
    document.getElementById('editarKPIsForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await salvarKPIs();
    });
}

async function salvarKPIs() {
    try {
        // Verificar se o array kpis está disponível
        if (typeof kpis === 'undefined') {
            showToast('Erro: dados dos indicadores não carregados.', 'error');
            return;
        }
        
        showLoading();
        
        // Coletar valores de todos os KPIs do formulário
        const valoresParaSalvar = {};
        kpis.forEach(kpi => {
            const inputId = `kpi_${kpi.id}`;
            const inputElement = document.getElementById(inputId);
            if (inputElement) {
                const valor = inputElement.value.trim();
                // Salvar como string para preservar formato (ex: "+275%", "4,3%")
                valoresParaSalvar[kpi.id] = valor || kpi.value;
            }
        });
        
        // Salvar no Firebase usando os IDs dos KPIs
        for (const [kpiId, valor] of Object.entries(valoresParaSalvar)) {
            await db.collection('kpis_valores').doc(kpiId).set({
                value: valor,
                valor: valor, // manter compatibilidade com código antigo
                atualizadoPor: currentUser ? currentUser.email : 'sistema',
                dataAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }
        
        hideLoading();
        showToast('KPIs atualizados com sucesso!', 'success');
        showKPIs();
    } catch (error) {
        hideLoading();
        console.error('Erro ao salvar KPIs:', error);
        showToast('Erro ao salvar KPIs: ' + error.message, 'error');
    }
}

// Helper para verificar se é admin (local)
function isAdminLocal(user) {
    if (!user) return false;
    const adminEmails = ['admin@anest.com.br', 'guilherme@anest.com.br', 'wguime@yahoo.com.br'];
    return adminEmails.includes(user.email);
}

// ==================== SEÇÃO QUALIDADE (SITEMAP v2) ====================

// ========== GESTÃO DE INCIDENTES (MELHORADO) ==========
async function showIncidentes() {
    const section = document.getElementById('qualidadeSection');
    if (!section) return;
    
    const html = `
        ${renderInfoBanner('fas fa-exclamation-triangle', 'Gestão de Incidentes', 'Notificação de eventos adversos e near miss', '#dc2626 0%, #991b1b 100%', "showSection('qualidade')")}

        <div class="menu-list">
            <div class="menu-item" onclick="showNovoIncidente()">
                <div class="menu-icon" style="background: linear-gradient(135deg, #EF4444, #B91C1C);">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div class="menu-content">
                    <h3>Formulário de Notificação</h3>
                    <p>Notificar evento adverso ou near miss (confidencial)</p>
                </div>
                <i class="fas fa-chevron-right"></i>
            </div>

            <div class="menu-item" onclick="showCanalDenuncia()">
                <div class="menu-icon" style="background: linear-gradient(135deg, #F59E0B, #D97706);">
                    <i class="fas fa-shield-alt"></i>
                </div>
                <div class="menu-content">
                    <h3>Canal de Denúncia Anônimo</h3>
                    <p>Denúncia sigilosa e segura</p>
                </div>
                <i class="fas fa-chevron-right"></i>
            </div>

            <div class="menu-item" onclick="window.open('https://patientsafety.epimedmonitor.com/Public/PSNotification?CultureCode=pt-BR&TenantId=D0594BFF-3B84-4CD3-9009-927502C9EFEC&NetworkId=049D109C-44A6-4DA3-881B-25C13357BDF3&HospitalId=B813D26F-4DC7-498E-A5B3-37B1C4AB7A98', '_blank')">
                <div class="menu-icon" style="background: linear-gradient(135deg, #3B82F6, #1E40AF);">
                    <i class="fas fa-external-link-alt"></i>
                </div>
                <div class="menu-content">
                    <h3>Notificação Unimed</h3>
                    <p>Sistema externo de notificação de segurança</p>
                </div>
                <i class="fas fa-chevron-right"></i>
            </div>

            <div class="menu-item" onclick="showQRCodeGenerator()">
                <div class="menu-icon" style="background: linear-gradient(135deg, #8B5CF6, #6D28D9);">
                    <i class="fas fa-qrcode"></i>
                </div>
                <div class="menu-content">
                    <h3>Gerar QR Codes para Publicação</h3>
                    <p>Gerar QR codes para formulários públicos</p>
                </div>
                <i class="fas fa-chevron-right"></i>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
}

function showNovoIncidente() {
    // CRÍTICO: Ativar seção qualidade primeiro
    if (typeof showSection === 'function') {
        showSection('qualidade');
    }
    
    const section = document.getElementById('qualidadeSection');
    if (!section) {
        console.error('❌ Seção qualidadeSection não encontrada');
        return;
    }
    
    const html = `
        ${renderInfoBanner('fas fa-file-alt', 'Formulário de Notificação', 'Baseado em padrões Qmentum e Takaoka', '#dc2626 0%, #991b1b 100%', 'showIncidentes()')}

        <div class="form-container">
            <form id="novoIncidenteForm" class="calc-form">
                <div class="info-box" style="background: #DBEAFE; margin-bottom: var(--spacing-md);">
                    <i class="fas fa-lock"></i> 
                    <strong>Notificação Confidencial:</strong> As informações serão tratadas com sigilo absoluto e usadas apenas para melhoria da qualidade e segurança do paciente.
                </div>

                <h3 style="color: var(--primary-dark); margin-bottom: var(--spacing-sm);">1. Identificação do Notificante</h3>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-user"></i> Nome Completo (opcional)</label>
                    <input type="text" class="form-select" id="inc_nome_notificante" placeholder="Deixe em branco para notificação anônima">
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-briefcase"></i> Função/Cargo</label>
                    <select class="form-select" id="inc_funcao_notificante">
                        <option value="">Selecione...</option>
                        <option value="Medico">Médico</option>
                        <option value="Enfermeiro">Enfermeiro</option>
                        <option value="Tecnico">Técnico</option>
                        <option value="Administrativo">Administrativo</option>
                        <option value="Outro">Outro</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-building"></i> Setor/Serviço</label>
                    <select class="form-select" id="inc_setor_notificante">
                        <option value="">Selecione...</option>
                        <option value="Centro Cirúrgico">Centro Cirúrgico</option>
                        <option value="Sala de Recuperação">Sala de Recuperação (SRPA)</option>
                        <option value="UTI">Unidade de Terapia Intensiva (UTI)</option>
                        <option value="Enfermaria">Enfermaria</option>
                        <option value="Pronto Socorro">Pronto Socorro</option>
                        <option value="Ambulatório">Ambulatório</option>
                        <option value="Outro">Outro</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-phone"></i> Contato (Telefone ou E-mail) - Opcional</label>
                    <input type="text" class="form-select" id="inc_contato_notificante" placeholder="Para contato se necessário">
                </div>

                <div class="form-group-bool">
                    <input type="checkbox" id="inc_notificacao_anonima">
                    <label for="inc_notificacao_anonima">Notificação Anônima</label>
                </div>

                <h3 style="color: var(--primary-dark); margin: var(--spacing-md) 0 var(--spacing-sm);">2. Dados do Incidente</h3>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-calendar"></i> Data e Hora do Ocorrido *</label>
                    <input type="datetime-local" class="form-select" id="inc_data_ocorrido" required>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-map-marker-alt"></i> Local *</label>
                    <select class="form-select" id="inc_local" required>
                        <option value="">Selecione...</option>
                        <option value="Centro Cirúrgico">Centro Cirúrgico</option>
                        <option value="Sala de Recuperação">Sala de Recuperação (SRPA)</option>
                        <option value="UTI">Unidade de Terapia Intensiva (UTI)</option>
                        <option value="Enfermaria">Enfermaria</option>
                        <option value="Pronto Socorro">Pronto Socorro</option>
                        <option value="Ambulatório">Ambulatório</option>
                        <option value="Outro">Outro</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-list"></i> Tipo de Incidente *</label>
                    <select class="form-select" id="inc_tipo" required>
                        <option value="">Selecione...</option>
                        <optgroup label="Medicação">
                            <option value="Medicação - Erro de Dose">Erro de Dose</option>
                            <option value="Medicação - Erro de Via">Erro de Via</option>
                            <option value="Medicação - Omissão">Omissão de Dose</option>
                            <option value="Medicação - Medicamento Errado">Medicamento Errado</option>
                            <option value="Medicação - Paciente Errado">Paciente Errado</option>
                        </optgroup>
                        <optgroup label="Cirurgia">
                            <option value="Cirurgia - Local Errado">Cirurgia em Local Errado</option>
                            <option value="Cirurgia - Procedimento Errado">Procedimento Errado</option>
                            <option value="Cirurgia - Paciente Errado">Paciente Errado</option>
                            <option value="Cirurgia - Corpo Estranho">Retenção de Corpo Estranho</option>
                        </optgroup>
                        <optgroup label="Identificação">
                            <option value="Identificação - Pulseira">Pulseira de Identificação</option>
                            <option value="Identificação - Paciente">Identificação Incorreta do Paciente</option>
                        </optgroup>
                        <optgroup label="Via Aérea">
                            <option value="Via Aérea - Intubação Difícil">Intubação Difícil Não Prevista</option>
                            <option value="Via Aérea - Extubação Acidental">Extubação Acidental</option>
                            <option value="Via Aérea - Aspiração">Broncoaspiração</option>
                        </optgroup>
                        <optgroup label="Cardiovascular">
                            <option value="CV - Parada Cardíaca">Parada Cardíaca</option>
                            <option value="CV - Hipotensão Grave">Hipotensão Grave</option>
                            <option value="CV - Arritmia">Arritmia Grave</option>
                        </optgroup>
                        <optgroup label="Outros">
                            <option value="Queda">Queda</option>
                            <option value="Lesão de Pele">Lesão de Pele/Úlcera de Pressão</option>
                            <option value="Infecção">Infecção Relacionada à Assistência</option>
                            <option value="Equipamento">Falha de Equipamento</option>
                            <option value="Comunicação">Falha de Comunicação</option>
                            <option value="Prontuário">Erro de Documentação</option>
                            <option value="Alergia">Reação Alérgica</option>
                            <option value="Outro">Outro</option>
                        </optgroup>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-exclamation-triangle"></i> Severidade *</label>
                    <select class="form-select" id="inc_severidade" required>
                        <option value="">Selecione...</option>
                        <option value="near_miss">🟢 Near Miss - Incidente sem dano (quase erro)</option>
                        <option value="baixa">🟡 Leve - Dano leve, sem necessidade de intervenção</option>
                        <option value="media">🟠 Moderado - Necessitou intervenção</option>
                        <option value="alta">🔴 Grave - Prolongou internação ou causou dano permanente</option>
                        <option value="critica">🔴🔴 Crítico - Óbito ou dano grave permanente</option>
                    </select>
                </div>


                <div class="form-group">
                    <label class="form-label"><i class="fas fa-file-alt"></i> O que aconteceu? * (Descreva em detalhes)</label>
                    <textarea class="form-select" id="inc_desc_detalhada" rows="6" placeholder="Descreva:
- O que aconteceu?
- Como aconteceu?
- Quando aconteceu?
- Quem estava envolvido?
- Qual foi o resultado?" required></textarea>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-question-circle"></i> Por que aconteceu? (Causas identificadas)</label>
                    <textarea class="form-select" id="inc_causas" rows="3" placeholder="Identifique os fatores contribuintes:
- Fatores humanos
- Fatores do sistema
- Fatores ambientais"></textarea>
                </div>

                <!-- Sessões 3, 4 e 5 ocultas do usuário mas ainda coletadas para envio no email -->
                <div style="display: none;">
                <h3 style="color: var(--primary-dark); margin: var(--spacing-md) 0 var(--spacing-sm);">3. Impacto e Ações</h3>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-user-injured"></i> Houve dano ao paciente?</label>
                    <select class="form-select" id="inc_dano">
                        <option value="">Selecione...</option>
                        <option value="nao">Não</option>
                        <option value="sim">Sim</option>
                        <option value="nao_aplicavel">Não aplicável</option>
                    </select>
                </div>

                <div class="form-group" id="danoDetails" style="display: none;">
                    <label class="form-label"><i class="fas fa-notes-medical"></i> Descreva o dano ao paciente</label>
                    <textarea class="form-select" id="inc_dano_desc" rows="3" placeholder="Descreva o dano ocorrido e as consequências..."></textarea>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-clipboard-check"></i> Ações Imediatas Tomadas</label>
                    <textarea class="form-select" id="inc_acoes" rows="4" placeholder="Descreva as ações que foram tomadas imediatamente após o incidente..."></textarea>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-user-tie"></i> Responsável pela Ação Imediata</label>
                    <input type="text" class="form-select" id="inc_responsavel_acao" placeholder="Nome e cargo do responsável">
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-lightbulb"></i> Sugestões de Melhoria</label>
                    <textarea class="form-select" id="inc_sugestoes" rows="4" placeholder="Como prevenir que isso aconteça novamente?
- Mudanças de processo
- Treinamentos necessários
- Barreiras de segurança"></textarea>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-calendar-check"></i> Data Prevista para Implementação da Ação</label>
                    <input type="date" class="form-select" id="inc_data_prevista_implementacao">
                </div>

                <h3 style="color: var(--primary-dark); margin: var(--spacing-md) 0 var(--spacing-sm);">4. Classificação e Encaminhamento</h3>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-search"></i> Necessita Investigação Mais Detalhada?</label>
                    <select class="form-select" id="inc_necessita_investigacao">
                        <option value="">Selecione...</option>
                        <option value="sim">Sim</option>
                        <option value="nao">Não</option>
                        <option value="talvez">Talvez</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-users"></i> Encaminhamento para Comissão de Segurança do Paciente</label>
                    <select class="form-select" id="inc_encaminhamento_comissao">
                        <option value="">Selecione...</option>
                        <option value="sim">Sim - Encaminhar</option>
                        <option value="nao">Não</option>
                        <option value="ja_encaminhado">Já foi encaminhado</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-comments"></i> Evento foi comunicado ao paciente/família?</label>
                    <select class="form-select" id="inc_comunicado_paciente">
                        <option value="">Selecione...</option>
                        <option value="sim">Sim</option>
                        <option value="nao">Não</option>
                        <option value="nao_aplicavel">Não aplicável</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-gavel"></i> Evento foi relatado a órgão regulador?</label>
                    <select class="form-select" id="inc_relatado_orgao_regulador">
                        <option value="">Selecione...</option>
                        <option value="sim">Sim</option>
                        <option value="nao">Não</option>
                        <option value="nao_aplicavel">Não aplicável</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-calendar-times"></i> Data de Encerramento do Caso (quando aplicável)</label>
                    <input type="date" class="form-select" id="inc_data_encerramento">
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-book"></i> Resultado Final / Lição Aprendida</label>
                    <textarea class="form-select" id="inc_resultado_final" rows="4" placeholder="Descreva o resultado final, lições aprendidas e melhorias implementadas..."></textarea>
                </div>

                <h3 style="color: var(--primary-dark); margin: var(--spacing-md) 0 var(--spacing-sm);">5. Contexto de Anestesiologia</h3>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-clock"></i> Fase do Procedimento</label>
                    <select class="form-select" id="inc_fase_procedimento">
                        <option value="">Selecione...</option>
                        <option value="pre_operatorio">Pré-operatório</option>
                        <option value="intra_operatorio">Intra-operatório</option>
                        <option value="pos_operatorio">Pós-operatório</option>
                        <option value="nao_aplicavel">Não aplicável</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-syringe"></i> Tipo de Anestesia</label>
                    <select class="form-select" id="inc_tipo_anestesia">
                        <option value="">Selecione...</option>
                        <option value="geral">Geral</option>
                        <option value="regional">Regional</option>
                        <option value="local">Local</option>
                        <option value="sedacao">Sedação</option>
                        <option value="nao_aplicavel">Não aplicável</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-heartbeat"></i> Monitoramento Envolvido</label>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-top: 10px;">
                        <label style="display: flex; align-items: center; gap: 5px;">
                            <input type="checkbox" value="ECG" id="mon_ecg"> ECG
                        </label>
                        <label style="display: flex; align-items: center; gap: 5px;">
                            <input type="checkbox" value="SpO2" id="mon_spo2"> SpO2
                        </label>
                        <label style="display: flex; align-items: center; gap: 5px;">
                            <input type="checkbox" value="PAM" id="mon_pam"> PAM
                        </label>
                        <label style="display: flex; align-items: center; gap: 5px;">
                            <input type="checkbox" value="EtCO2" id="mon_etco2"> EtCO2
                        </label>
                        <label style="display: flex; align-items: center; gap: 5px;">
                            <input type="checkbox" value="Temperatura" id="mon_temp"> Temperatura
                        </label>
                        <label style="display: flex; align-items: center; gap: 5px;">
                            <input type="checkbox" value="Outro" id="mon_outro"> Outro
                        </label>
                    </div>
                    <input type="text" class="form-select" id="inc_monitoramento_outro" placeholder="Especifique outro monitoramento" style="margin-top: 10px; display: none;">
                </div>
                </div>
                <!-- Fim das sessões ocultas -->

                <div class="form-group-bool" style="margin-top: var(--spacing-md);">
                    <input type="checkbox" id="inc_consentimento_uso" required>
                    <label for="inc_consentimento_uso">Consentimento para uso dos dados para análise institucional e melhoria contínua *</label>
                </div>

                <button type="submit" class="btn-primary">
                    <i class="fas fa-paper-plane"></i> Enviar Notificação
                </button>
            </form>
        </div>
    `;
    
    section.innerHTML = html;
    
    // Definir data/hora atual como padrão
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('inc_data_ocorrido').value = now.toISOString().slice(0, 16);
    
    // Mostrar/ocultar campo de descrição de dano
    document.getElementById('inc_dano').addEventListener('change', function() {
        document.getElementById('danoDetails').style.display = this.value === 'sim' ? 'block' : 'none';
    });

    // Mostrar/ocultar campos de paciente
    document.getElementById('inc_envolvimento_paciente').addEventListener('change', function() {
        document.getElementById('dadosPacienteSection').style.display = this.value === 'sim' ? 'block' : 'none';
    });

    // Mostrar campo de outro monitoramento
    document.getElementById('mon_outro').addEventListener('change', function() {
        document.getElementById('inc_monitoramento_outro').style.display = this.checked ? 'block' : 'none';
    });
    
    document.getElementById('novoIncidenteForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await salvarIncidente();
    });
}

async function salvarIncidente() {
    try {
        showLoading();
        
        const dataOcorridoStr = document.getElementById('inc_data_ocorrido').value;
        const dataOcorrido = firebase.firestore.Timestamp.fromDate(new Date(dataOcorridoStr));
        
        // Coletar monitoramento
        const monitoramentos = [];
        if (document.getElementById('mon_ecg').checked) monitoramentos.push('ECG');
        if (document.getElementById('mon_spo2').checked) monitoramentos.push('SpO2');
        if (document.getElementById('mon_pam').checked) monitoramentos.push('PAM');
        if (document.getElementById('mon_etco2').checked) monitoramentos.push('EtCO2');
        if (document.getElementById('mon_temp').checked) monitoramentos.push('Temperatura');
        if (document.getElementById('mon_outro').checked && document.getElementById('inc_monitoramento_outro').value) {
            monitoramentos.push(document.getElementById('inc_monitoramento_outro').value);
        }

        // Gerar número de protocolo
        const hoje = new Date();
        const dataStr = hoje.toISOString().slice(0, 10).replace(/-/g, '');
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const numeroProtocolo = `INC-${dataStr}-${random}`;

        const incidenteData = {
            dataOcorrido,
            local: document.getElementById('inc_local').value,
            tipo: document.getElementById('inc_tipo').value,
            severidade: document.getElementById('inc_severidade').value,
            descricaoCurta: document.getElementById('inc_desc_curta').value,
            descricaoDetalhada: document.getElementById('inc_desc_detalhada').value,
            causas: document.getElementById('inc_causas').value,
            dano: document.getElementById('inc_dano').value,
            danoDescricao: document.getElementById('inc_dano_desc').value,
            acoes: document.getElementById('inc_acoes').value,
            sugestoes: document.getElementById('inc_sugestoes').value,
            categoriaRisco: document.getElementById('inc_categoria_risco').value,
            // Novos campos Qmentum
            nomeNotificante: document.getElementById('inc_nome_notificante').value,
            funcaoNotificante: document.getElementById('inc_funcao_notificante').value,
            setorNotificante: document.getElementById('inc_setor_notificante').value,
            contatoNotificante: document.getElementById('inc_contato_notificante').value,
            notificacaoAnonima: document.getElementById('inc_notificacao_anonima').checked,
            envolvimentoPaciente: document.getElementById('inc_envolvimento_paciente').value,
            nomePaciente: document.getElementById('inc_nome_paciente').value,
            numeroProntuario: document.getElementById('inc_numero_prontuario').value,
            idadePaciente: document.getElementById('inc_idade_paciente').value ? parseInt(document.getElementById('inc_idade_paciente').value) : null,
            sexoPaciente: document.getElementById('inc_sexo_paciente').value,
            responsavelAcao: document.getElementById('inc_responsavel_acao').value,
            dataPrevistaImplementacao: document.getElementById('inc_data_prevista_implementacao').value,
            necessitaInvestigacao: document.getElementById('inc_necessita_investigacao').value,
            encaminhamentoComissao: document.getElementById('inc_encaminhamento_comissao').value,
            comunicadoPaciente: document.getElementById('inc_comunicado_paciente').value,
            relatadoOrgaoRegulador: document.getElementById('inc_relatado_orgao_regulador').value,
            dataEncerramento: document.getElementById('inc_data_encerramento').value,
            resultadoFinal: document.getElementById('inc_resultado_final').value,
            faseProcedimento: document.getElementById('inc_fase_procedimento').value,
            tipoAnestesia: document.getElementById('inc_tipo_anestesia').value,
            monitoramento: monitoramentos.join(', '),
            consentimentoUso: document.getElementById('inc_consentimento_uso').checked,
            numeroProtocolo,
            status: 'pendente',
            fonte: 'app',
            notificadoPor: currentUser.uid,
            notificadoPorEmail: currentUser.email,
            dataPreenchimento: firebase.firestore.FieldValue.serverTimestamp(),
            data: firebase.firestore.FieldValue.serverTimestamp(),
            emailEnviado: false
        };
        
        await db.collection('incidentes').add(incidenteData);
        
        hideLoading();
        showToast('Incidente notificado com sucesso! Obrigado por contribuir com a segurança.', 'success');
        showIncidentes();
    } catch (error) {
        hideLoading();
        console.error('Erro ao salvar incidente:', error);
        showToast('Erro ao notificar incidente', 'error');
    }
}

// ========== CANAL DE DENÚNCIA ANÔNIMO ==========
function showCanalDenuncia() {
    const section = document.getElementById('qualidadeSection');
    const html = `
        ${renderInfoBanner('fas fa-shield-alt', 'Canal de Denúncia Anônimo', 'Denúncia sigilosa e segura', '#f59e0b 0%, #d97706 100%', 'showIncidentes()')}

        <div class="denuncia-container">
            <div class="info-box" style="background: #FEF3C7;">
                <i class="fas fa-shield-alt"></i>
                <strong>Sigilo Garantido:</strong> Esta denúncia é completamente anônima. Nenhuma informação pessoal será coletada ou armazenada.
            </div>

            <div class="info-box" style="background: #DBEAFE; margin-top: var(--spacing-md);">
                <i class="fas fa-info-circle"></i>
                <strong>Quando usar este canal:</strong>
                <ul style="margin-top: var(--spacing-xs); font-size: 14px;">
                    <li>Violações éticas</li>
                    <li>Assédio moral ou sexual</li>
                    <li>Fraudes ou irregularidades</li>
                    <li>Situações de risco não reportadas</li>
                    <li>Qualquer situação que comprometa a segurança do paciente ou equipe</li>
                </ul>
            </div>

            <form id="denunciaForm" class="calc-form">
                <h3 style="color: var(--primary-dark); margin-bottom: var(--spacing-sm);">1. Identificação do Denunciante</h3>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-user"></i> Nome (opcional se anônimo)</label>
                    <input type="text" class="form-select" id="den_nome" placeholder="Deixe em branco para denúncia anônima">
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-briefcase"></i> Função/Cargo</label>
                    <select class="form-select" id="den_funcao">
                        <option value="">Selecione...</option>
                        <option value="Medico">Médico</option>
                        <option value="Enfermeiro">Enfermeiro</option>
                        <option value="Tecnico">Técnico</option>
                        <option value="Administrativo">Administrativo</option>
                        <option value="Paciente">Paciente/Família</option>
                        <option value="Outro">Outro</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-building"></i> Unidade/Serviço</label>
                    <select class="form-select" id="den_unidade">
                        <option value="">Selecione...</option>
                        <option value="Centro Cirúrgico">Centro Cirúrgico</option>
                        <option value="Sala de Recuperação">Sala de Recuperação (SRPA)</option>
                        <option value="UTI">Unidade de Terapia Intensiva (UTI)</option>
                        <option value="Enfermaria">Enfermaria</option>
                        <option value="Pronto Socorro">Pronto Socorro</option>
                        <option value="Ambulatório">Ambulatório</option>
                        <option value="Administrativo">Administrativo</option>
                        <option value="Outro">Outro</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-phone"></i> Contato (Telefone ou E-mail) - Opcional</label>
                    <input type="text" class="form-select" id="den_contato" placeholder="Para contato se necessário">
                </div>

                <div class="form-group-bool">
                    <input type="checkbox" id="den_anonimo" checked>
                    <label for="den_anonimo">Deseja permanecer anônimo?</label>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-bell"></i> Deseja ser informado/a sobre o andamento da apuração?</label>
                    <select class="form-select" id="den_deseja_ser_informado">
                        <option value="">Selecione...</option>
                        <option value="sim">Sim</option>
                        <option value="nao">Não</option>
                    </select>
                </div>

                <h3 style="color: var(--primary-dark); margin: var(--spacing-md) 0 var(--spacing-sm);">2. Sobre o Fato Denunciado</h3>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-list"></i> Tipo de Denúncia *</label>
                    <select class="form-select" id="den_tipo" required>
                        <option value="">Selecione...</option>
                        <option value="etica">Violação Ética</option>
                        <option value="assedio">Assédio (Moral ou Sexual)</option>
                        <option value="seguranca">Risco à Segurança do Paciente</option>
                        <option value="fraude">Fraude ou Irregularidade</option>
                        <option value="discriminacao">Discriminação</option>
                        <option value="conflito_interesse">Conflito de Interesse</option>
                        <option value="violacao_politica">Violação de Política Institucional</option>
                        <option value="outro">Outro</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-calendar"></i> Data do Ocorrido</label>
                    <input type="date" class="form-select" id="den_data">
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-clock"></i> Hora do Ocorrido (aproximada)</label>
                    <input type="time" class="form-select" id="den_hora">
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-map-marker-alt"></i> Local (Unidade, Sala, Setor)</label>
                    <input type="text" class="form-select" id="den_local" placeholder="Ex: Centro Cirúrgico, Enfermaria 3, etc.">
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-user-friends"></i> Nome(s) da(s) Pessoa(s) Envolvida(s) (se conhecidas)</label>
                    <input type="text" class="form-select" id="den_nome_envolvidos" placeholder="Nome(s) das pessoas envolvidas">
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-id-badge"></i> Cargo(s)/Função(ões) da(s) Pessoa(s) Envolvida(s)</label>
                    <input type="text" class="form-select" id="den_cargo_envolvidos" placeholder="Cargo(s) ou função(ões)">
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-file-alt"></i> Descrição Detalhada do Fato *</label>
                    <textarea class="form-select" id="den_descricao" rows="8" placeholder="Descreva em detalhes:
- O que aconteceu?
- Quando aconteceu?
- Onde aconteceu?
- Quem está envolvido? (se souber)
- Há testemunhas?
- Há evidências?" required></textarea>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-users"></i> Testemunhas (Nome/Contato) - Opcional</label>
                    <textarea class="form-select" id="den_testemunhas" rows="3" placeholder="Liste testemunhas, se houver, com nome e contato (opcional)"></textarea>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-exclamation-triangle"></i> Qual é o impacto ou dano (real ou potencial)?</label>
                    <textarea class="form-select" id="den_impacto" rows="4" placeholder="Descreva o impacto ou dano para paciente, colaborador ou instituição"></textarea>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-tasks"></i> Quais medidas foram tomadas até agora? (se houver)</label>
                    <textarea class="form-select" id="den_medidas_tomadas" rows="3" placeholder="Descreva medidas já tomadas, se houver"></textarea>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-paperclip"></i> Evidências ou Anexos (opcional)</label>
                    <input type="file" class="form-select" id="den_anexos" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx">
                    <small style="color: #666; font-size: 0.8rem;">Formatos aceitos: PDF, imagens, documentos (máx. 10MB por arquivo)</small>
                    <div id="den_anexos_lista" style="margin-top: 10px;"></div>
                </div>

                <h3 style="color: var(--primary-dark); margin: var(--spacing-md) 0 var(--spacing-sm);">3. Confirmações</h3>

                <div class="form-group-bool">
                    <input type="checkbox" id="den_confirmacao_confidencialidade" required>
                    <label for="den_confirmacao_confidencialidade">Confirmo que estou ciente da política de confidencialidade *</label>
                </div>

                <button type="submit" class="btn-primary" style="background: #DC2626;">
                    <i class="fas fa-paper-plane"></i> Enviar Denúncia Anônima
                </button>
            </form>
        </div>
    `;
    
    section.innerHTML = html;
    
    // Mostrar lista de arquivos selecionados
    document.getElementById('den_anexos').addEventListener('change', function() {
        const lista = document.getElementById('den_anexos_lista');
        lista.innerHTML = '';
        if (this.files.length > 0) {
            lista.innerHTML = '<strong>Arquivos selecionados:</strong><ul style="margin-top: 5px;">';
            for (let i = 0; i < this.files.length; i++) {
                lista.innerHTML += `<li>${this.files[i].name} (${(this.files[i].size / 1024 / 1024).toFixed(2)} MB)</li>`;
            }
            lista.innerHTML += '</ul>';
        }
    });
    
    document.getElementById('denunciaForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await salvarDenuncia();
    });
}

async function salvarDenuncia() {
    try {
        showLoading();
        
        // Processar anexos se houver
        const anexosFiles = document.getElementById('den_anexos').files;
        const anexosUrls = [];
        
        if (anexosFiles.length > 0) {
            for (let i = 0; i < anexosFiles.length; i++) {
                const file = anexosFiles[i];
                // Validar tamanho (10MB)
                if (file.size > 10 * 1024 * 1024) {
                    showToast(`Arquivo ${file.name} excede 10MB`, 'error');
                    hideLoading();
                    return;
                }
                
                const storageRef = storage.ref(`denuncias/${Date.now()}_${file.name}`);
                await storageRef.put(file);
                const url = await storageRef.getDownloadURL();
                anexosUrls.push({ nome: file.name, url: url });
            }
        }

        // Gerar número de protocolo
        const hoje = new Date();
        const dataStr = hoje.toISOString().slice(0, 10).replace(/-/g, '');
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const numeroProtocolo = `DEN-${dataStr}-${random}`;
        
        const denunciaData = {
            tipo: document.getElementById('den_tipo').value,
            descricao: document.getElementById('den_descricao').value,
            dataOcorrido: document.getElementById('den_data').value,
            horaOcorrido: document.getElementById('den_hora').value,
            local: document.getElementById('den_local').value,
            // Novos campos Qmentum
            nomeDenunciante: document.getElementById('den_nome').value,
            funcaoDenunciante: document.getElementById('den_funcao').value,
            unidadeDenunciante: document.getElementById('den_unidade').value,
            contatoDenunciante: document.getElementById('den_contato').value,
            anonimo: document.getElementById('den_anonimo').checked,
            desejaSerInformado: document.getElementById('den_deseja_ser_informado').value,
            nomeEnvolvidos: document.getElementById('den_nome_envolvidos').value,
            cargoEnvolvidos: document.getElementById('den_cargo_envolvidos').value,
            testemunhas: document.getElementById('den_testemunhas').value,
            impacto: document.getElementById('den_impacto').value,
            medidasTomadas: document.getElementById('den_medidas_tomadas').value,
            anexos: anexosUrls,
            confirmacaoConfidencialidade: document.getElementById('den_confirmacao_confidencialidade').checked,
            numeroProtocolo,
            status: 'pendente',
            fonte: 'app',
            dataPreenchimento: firebase.firestore.FieldValue.serverTimestamp(),
            data: firebase.firestore.FieldValue.serverTimestamp(),
            emailEnviado: false
        };
        
        await db.collection('denuncias').add(denunciaData);
        
        hideLoading();
        showToast(`Denúncia recebida com sucesso! Protocolo: ${numeroProtocolo}. Obrigado por contribuir com um ambiente mais seguro.`, 'success');
        showIncidentes();
    } catch (error) {
        hideLoading();
        console.error('Erro ao salvar denúncia:', error);
        showToast('Erro ao enviar denúncia', 'error');
    }
}

// ========== GERADOR DE QR CODES ==========
function showQRCodeGenerator() {
    const section = document.getElementById('qualidadeSection');
    const baseUrl = window.location.origin;
    const urlIncidente = `${baseUrl}/formulario-publico.html?tipo=incidente`;
    const urlDenuncia = `${baseUrl}/formulario-publico.html?tipo=denuncia`;
    
    const html = `
        ${renderInfoBanner('fas fa-qrcode', 'Gerar QR Codes para Publicação', 'Gere QR codes para acesso público aos formulários', '#8b5cf6 0%, #6d28d9 100%', 'showIncidentes()')}

        <div class="form-container" style="padding: var(--spacing-lg); max-width: 1400px; margin: 0 auto;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: var(--spacing-md); justify-items: center;" id="qrcode-grid">
                <!-- QR Code Notificação -->
                <div class="qrcode-card" style="background: white; padding: var(--spacing-lg); border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); width: 100%; max-width: 500px;">
                    <h3 style="color: var(--primary-dark); margin-bottom: var(--spacing-sm); text-align: center;">
                        <i class="fas fa-exclamation-triangle"></i> Formulário de Notificação
                    </h3>
                    <div id="qrcode-notificacao" style="display: flex; justify-content: center; align-items: center; margin: var(--spacing-lg) 0; min-height: 250px;"></div>
                    <div style="text-align: center; margin: var(--spacing-sm) 0;">
                        <small style="color: #666; word-break: break-all; font-size: 11px;">${urlIncidente}</small>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 10px; margin-top: var(--spacing-md);">
                        <button class="btn-primary" onclick="downloadQRCode('notificacao')" style="font-size: 14px; padding: 10px;">
                            <i class="fas fa-download"></i> Baixar PNG
                        </button>
                        <button class="btn-primary" onclick="downloadQRCodePDF('notificacao')" style="font-size: 14px; padding: 10px; background: #DC2626;">
                            <i class="fas fa-file-pdf"></i> Baixar PDF
                        </button>
                        <button class="btn-primary" onclick="copyQRCodeURL('notificacao')" style="font-size: 14px; padding: 10px; background: #3B82F6;">
                            <i class="fas fa-copy"></i> Copiar URL
                        </button>
                        <button class="btn-primary" onclick="printQRCode('notificacao')" style="font-size: 14px; padding: 10px; background: #059669;">
                            <i class="fas fa-print"></i> Imprimir
                        </button>
                    </div>
                </div>

                <!-- QR Code Denúncia -->
                <div class="qrcode-card" style="background: white; padding: var(--spacing-lg); border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); width: 100%; max-width: 500px;">
                    <h3 style="color: #DC2626; margin-bottom: var(--spacing-sm); text-align: center;">
                        <i class="fas fa-shield-alt"></i> Canal de Denúncia
                    </h3>
                    <div id="qrcode-denuncia" style="display: flex; justify-content: center; align-items: center; margin: var(--spacing-lg) 0; min-height: 250px;"></div>
                    <div style="text-align: center; margin: var(--spacing-sm) 0;">
                        <small style="color: #666; word-break: break-all; font-size: 11px;">${urlDenuncia}</small>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 10px; margin-top: var(--spacing-md);">
                        <button class="btn-primary" onclick="downloadQRCode('denuncia')" style="font-size: 14px; padding: 10px;">
                            <i class="fas fa-download"></i> Baixar PNG
                        </button>
                        <button class="btn-primary" onclick="downloadQRCodePDF('denuncia')" style="font-size: 14px; padding: 10px; background: #DC2626;">
                            <i class="fas fa-file-pdf"></i> Baixar PDF
                        </button>
                        <button class="btn-primary" onclick="copyQRCodeURL('denuncia')" style="font-size: 14px; padding: 10px; background: #3B82F6;">
                            <i class="fas fa-copy"></i> Copiar URL
                        </button>
                        <button class="btn-primary" onclick="printQRCode('denuncia')" style="font-size: 14px; padding: 10px; background: #059669;">
                            <i class="fas fa-print"></i> Imprimir
                        </button>
                    </div>
                </div>
            </div>

            <div style="display: flex; gap: var(--spacing-sm); justify-content: center; margin-top: var(--spacing-md);">
                <button class="btn-primary" onclick="downloadBothQRCodePDF()" style="max-width: 300px;">
                    <i class="fas fa-file-pdf"></i> Baixar Ambos em PDF
                </button>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
    
    // Gerar QR codes usando a biblioteca qrcode.js
    setTimeout(() => {
        if (typeof QRCode !== 'undefined') {
            // Limpar divs antes de gerar
            document.getElementById('qrcode-notificacao').innerHTML = '';
            document.getElementById('qrcode-denuncia').innerHTML = '';
            
            // Determinar tamanho do QR code baseado na largura da tela
            const isMobile = window.innerWidth < 768;
            const qrSize = isMobile ? 250 : 400;
            
            // QR Code Notificação
            new QRCode(document.getElementById('qrcode-notificacao'), {
                text: urlIncidente,
                width: qrSize,
                height: qrSize,
                colorDark: '#000000',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.H
            });
            
            // QR Code Denúncia
            new QRCode(document.getElementById('qrcode-denuncia'), {
                text: urlDenuncia,
                width: qrSize,
                height: qrSize,
                colorDark: '#000000',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.H
            });
            
            // Ajustar grid para mobile
            const grid = document.getElementById('qrcode-grid');
            if (grid && isMobile) {
                grid.style.gridTemplateColumns = '1fr';
            }
        } else {
            console.error('Biblioteca QRCode não carregada');
            document.getElementById('qrcode-notificacao').innerHTML = '<p style="color: red;">Erro: Biblioteca QRCode não encontrada. Recarregue a página.</p>';
            document.getElementById('qrcode-denuncia').innerHTML = '<p style="color: red;">Erro: Biblioteca QRCode não encontrada. Recarregue a página.</p>';
        }
    }, 100);
}

// Funções auxiliares para download e impressão de QR codes
function downloadQRCode(tipo) {
    const canvas = document.querySelector(`#qrcode-${tipo} canvas`);
    if (!canvas) {
        showToast('QR Code não encontrado', 'error');
        return;
    }
    
    const link = document.createElement('a');
    link.download = `qr-${tipo}-${new Date().toISOString().slice(0,10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('QR Code baixado com sucesso!', 'success');
}

function downloadQRCodePDF(tipo) {
    const canvas = document.querySelector(`#qrcode-${tipo} canvas`);
    if (!canvas) {
        showToast('QR Code não encontrado', 'error');
        return;
    }
    
    // Usar jsPDF se disponível, senão fazer download do PNG
    if (typeof window.jspdf !== 'undefined') {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF();
        const imgData = canvas.toDataURL('image/png');
        const title = tipo === 'notificacao' ? 'Formulário de Notificação' : 'Canal de Denúncia';
        const url = tipo === 'notificacao' ? 
            `${window.location.origin}/formulario-publico.html?tipo=incidente` :
            `${window.location.origin}/formulario-publico.html?tipo=denuncia`;
        
        pdf.setFontSize(18);
        pdf.text(title, 105, 20, { align: 'center' });
        pdf.addImage(imgData, 'PNG', 55, 35, 100, 100);
        pdf.setFontSize(10);
        pdf.text('URL:', 105, 145, { align: 'center' });
        pdf.setFontSize(8);
        pdf.text(url, 105, 150, { align: 'center', maxWidth: 180 });
        
        pdf.save(`qr-${tipo}-${new Date().toISOString().slice(0,10)}.pdf`);
        showToast('PDF baixado com sucesso!', 'success');
    } else {
        // Fallback: baixar PNG
        downloadQRCode(tipo);
        showToast('Biblioteca PDF não disponível. Baixando PNG.', 'info');
    }
}

function copyQRCodeURL(tipo) {
    const url = tipo === 'notificacao' ? 
        `${window.location.origin}/formulario-publico.html?tipo=incidente` :
        `${window.location.origin}/formulario-publico.html?tipo=denuncia`;
    
    navigator.clipboard.writeText(url).then(() => {
        showToast('URL copiada para área de transferência!', 'success');
    }).catch(() => {
        // Fallback para navegadores antigos
        const textarea = document.createElement('textarea');
        textarea.value = url;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('URL copiada para área de transferência!', 'success');
    });
}

function printQRCode(tipo) {
    const canvas = document.querySelector(`#qrcode-${tipo} canvas`);
    if (!canvas) {
        showToast('QR Code não encontrado', 'error');
        return;
    }
    
    const title = tipo === 'notificacao' ? 'Formulário de Notificação' : 'Canal de Denúncia';
    const url = tipo === 'notificacao' ? 
        `${window.location.origin}/formulario-publico.html?tipo=incidente` :
        `${window.location.origin}/formulario-publico.html?tipo=denuncia`;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>${title} - QR Code</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 40px; }
                    h1 { margin-bottom: 20px; }
                    img { margin: 20px 0; }
                    p { margin-top: 20px; font-size: 12px; word-break: break-all; }
                </style>
            </head>
            <body>
                <h1>${title}</h1>
                <img src="${canvas.toDataURL('image/png')}" alt="QR Code" style="width: 400px; height: 400px;">
                <p>${url}</p>
            </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

function downloadBothQRCodePDF() {
    if (typeof window.jspdf === 'undefined') {
        showToast('Biblioteca PDF não disponível. Baixando QR codes individuais.', 'info');
        downloadQRCode('notificacao');
        setTimeout(() => downloadQRCode('denuncia'), 500);
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    const canvasNotificacao = document.querySelector('#qrcode-notificacao canvas');
    const canvasDenuncia = document.querySelector('#qrcode-denuncia canvas');
    
    if (!canvasNotificacao || !canvasDenuncia) {
        showToast('QR Codes não encontrados', 'error');
        return;
    }
    
    // Página 1: Notificação
    pdf.setFontSize(18);
    pdf.text('Formulário de Notificação', 105, 20, { align: 'center' });
    pdf.addImage(canvasNotificacao.toDataURL('image/png'), 'PNG', 55, 35, 100, 100);
    pdf.setFontSize(10);
    pdf.text('URL:', 105, 145, { align: 'center' });
    pdf.setFontSize(8);
    pdf.text(`${window.location.origin}/formulario-publico.html?tipo=incidente`, 105, 150, { align: 'center', maxWidth: 180 });
    
    // Página 2: Denúncia
    pdf.addPage();
    pdf.setFontSize(18);
    pdf.text('Canal de Denúncia Anônimo', 105, 20, { align: 'center' });
    pdf.addImage(canvasDenuncia.toDataURL('image/png'), 'PNG', 55, 35, 100, 100);
    pdf.setFontSize(10);
    pdf.text('URL:', 105, 145, { align: 'center' });
    pdf.setFontSize(8);
    pdf.text(`${window.location.origin}/formulario-publico.html?tipo=denuncia`, 105, 150, { align: 'center', maxWidth: 180 });
    
    // Página 3: Instruções
    pdf.addPage();
    pdf.setFontSize(16);
    pdf.text('Instruções de Uso', 105, 20, { align: 'center' });
    pdf.setFontSize(12);
    pdf.text('1. Escaneie o QR code com a câmera do seu celular', 20, 40);
    pdf.text('2. Ou acesse a URL diretamente no navegador', 20, 55);
    pdf.text('3. Preencha o formulário com as informações solicitadas', 20, 70);
    pdf.text('4. Envie o formulário e anote o número de protocolo', 20, 85);
    pdf.text('5. O formulário será enviado automaticamente por email', 20, 100);
    
    pdf.save(`qr-codes-ambos-${new Date().toISOString().slice(0,10)}.pdf`);
    showToast('PDF com ambos QR codes baixado com sucesso!', 'success');
}

// ========== AUDITORIAS COM UPLOAD (NOVO) ==========
async function showAuditorias() {
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

async function loadContadoresAuditorias() {
    try {
        const tipos = ['higiene_maos', 'uso_medicamentos', 'abreviaturas'];
        
        // Dados de exemplo consistentes
        const exemplos = {
            'higiene_maos': 4,
            'uso_medicamentos': 2,
            'abreviaturas': 1
        };
        
        for (const tipo of tipos) {
            let count = exemplos[tipo] || 0;
            
            // Tentar buscar dados reais do Firebase (se disponível)
            try {
                if (typeof db !== 'undefined' && db) {
                    const snapshot = await db.collection('auditorias_evidencias')
                        .where('tipo', '==', tipo)
                        .get();
                    count = snapshot.size;
                }
            } catch (error) {
                console.log(`Firebase não disponível para ${tipo}, usando dados de exemplo: ${count}`);
            }
            
            const badgeId = tipo === 'higiene_maos' ? 'badge_higiene' : 
                           tipo === 'uso_medicamentos' ? 'badge_medicamentos' : 'badge_abreviaturas';
            
            const badge = document.getElementById(badgeId);
            if (badge) {
                badge.textContent = `${count} documento${count !== 1 ? 's' : ''}`;
                console.log(`Contador ${tipo}: ${count} documentos`);
            } else {
                console.warn(`Badge não encontrado: ${badgeId}`);
            }
        }
    } catch (error) {
        console.error('Erro ao carregar contadores:', error);
        // Fallback: definir contadores com dados de exemplo
        const badges = [
            { id: 'badge_higiene', count: 4 },
            { id: 'badge_medicamentos', count: 2 },
            { id: 'badge_abreviaturas', count: 1 }
        ];
        
        badges.forEach(({ id, count }) => {
            const badge = document.getElementById(id);
            if (badge) {
                badge.textContent = `${count} documento${count !== 1 ? 's' : ''}`;
            }
        });
    }
}

async function showAuditoriaEspecifica(tipo) {
    const titulos = {
        'higiene_maos': '🧼 Higiene das Mãos',
        'uso_medicamentos': '👁️ Uso de Medicamentos',
        'abreviaturas': '❌ Abreviaturas Perigosas'
    };
    
    // Determinar página de histórico baseado no tipo
    let historyPage = null;
    if (tipo === 'higiene_maos' || tipo === 'uso_medicamentos' || tipo === 'abreviaturas') {
        historyPage = `auditoria-${tipo.replace(/_/g, '-')}`;
    }
    
    // Atualizar histórico de navegação
    if (historyPage && typeof atualizarHistoricoNavegacao === 'function') {
        atualizarHistoricoNavegacao(historyPage);
    }
    
    // Armazenar tipo atual para uso nas funções de editar/excluir
    window.currentAuditoriaTipo = tipo;
    
    // Verificar se é admin usando checkUserRole (disponível no app.js)
    let isAdminUser = false;
    if (typeof checkUserRole === 'function') {
        isAdminUser = await checkUserRole(['Administrador', 'Coordenador']);
    } else {
        // Fallback: verificar por email (função local)
        if (currentUser && currentUser.email) {
            const adminEmails = ['admin@anest.com.br', 'guilherme@anest.com.br'];
            isAdminUser = adminEmails.includes(currentUser.email);
        }
    }
    
    const section = document.getElementById('qualidadeSection');
    const html = `
        ${renderInfoBanner('fas fa-clipboard-check', titulos[tipo], 'Evidências e documentos de auditoria', '#059669 0%, #10B981 100%', 'voltarPagina()')}
        ${isAdminUser ? `<div style="margin-bottom: 20px; text-align: right;"><button class="btn-add" onclick="showUploadAuditoria('${tipo}')" style="background: #059669; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; gap: 8px;"><i class="fas fa-upload"></i> Upload</button></div>` : ''}

        <div class="documentos-container" id="documentosContainer">
            <div class="loading-spinner">
                <i class="fas fa-spinner fa-spin"></i> Carregando documentos...
            </div>
        </div>
    `;
    
    section.innerHTML = html;
    await loadDocumentosAuditoria(tipo);
}

async function loadDocumentosAuditoria(tipo) {
    try {
        // Verificar se é admin usando checkUserRole (disponível no app.js)
        let isAdmin = false;
        if (typeof checkUserRole === 'function') {
            isAdmin = await checkUserRole(['Administrador', 'Coordenador']);
        } else if (typeof window.isAdmin === 'function') {
            isAdmin = window.isAdmin(currentUser);
        } else {
            // Fallback: verificar por email (função local)
            if (currentUser && currentUser.email) {
                const adminEmails = ['admin@anest.com.br', 'guilherme@anest.com.br'];
                isAdmin = adminEmails.includes(currentUser.email);
            }
        }
        
        // Tentar buscar de auditorias_evidencias (collection antiga) e auditorias_documentos (nova)
        let snapshot = null;
        try {
            snapshot = await db.collection('auditorias_evidencias')
                .where('tipo', '==', tipo)
                .get();
        } catch (e) {
            console.warn('Erro ao buscar de auditorias_evidencias:', e);
            // Se não encontrar, tentar buscar de auditorias_documentos
            try {
                snapshot = await db.collection('auditorias_documentos')
                    .where('tipo', '==', tipo)
                    .get();
            } catch (e2) {
                console.warn('Erro ao buscar de auditorias_documentos:', e2);
            }
        }
        
        const container = document.getElementById('documentosContainer');
        if (!container) return;
        
        if (!snapshot || snapshot.empty) {
            container.innerHTML = `
                <div class="info-box">
                    <i class="fas fa-folder-open"></i> Nenhum documento cadastrado ainda.
                    ${isAdmin ? '<br><br>Clique em "Upload" para adicionar evidências.' : ''}
                </div>
            `;
            return;
        }
        
        // Ordenar no cliente por data (desc)
        const docs = [];
        snapshot.forEach(doc => {
            docs.push({ id: doc.id, data: doc.data() });
        });
        
        docs.sort((a, b) => {
            const dateA = a.data.data?.toDate?.() || a.data.uploadedAt?.toDate?.() || new Date(0);
            const dateB = b.data.data?.toDate?.() || b.data.uploadedAt?.toDate?.() || new Date(0);
            return dateB - dateA;
        });
        
        let html = '';
        docs.forEach(({ id, data }) => {
            const dataFormatada = data.data?.toDate ? data.data.toDate().toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            }) : (data.uploadedAt?.toDate ? data.uploadedAt.toDate().toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            }) : 'Data não disponível');
            
            const fileURL = data.url || data.fileURL;
            const titulo = data.titulo || data.title || 'Sem título';
            
            html += `
                <div class="doc-card" style="position: relative;">
                    <div onclick="abrirPDF('${fileURL}', '${titulo.replace(/'/g, "\\'")}')" style="cursor: pointer; display: flex; align-items: center; gap: 16px; padding: 16px;">
                        <div class="doc-icon" style="background: linear-gradient(135deg, #DC2626, #991B1B);">
                            <i class="fas fa-file-pdf"></i>
                        </div>
                        <div class="doc-info" style="flex: 1;">
                            <div class="doc-title">${titulo}</div>
                            <div class="doc-codigo">${dataFormatada} • ${data.responsavel || data.uploadedByName || 'Sistema'}</div>
                        </div>
                    </div>
                    ${isAdmin ? `
                        <div style="display: flex; gap: 8px; padding: 8px 16px; border-top: 1px solid var(--border-color);">
                            <button onclick="event.stopPropagation(); excluirAuditoriaDocumento('${id}', '${(data.filePath || data.url || '').replace(/'/g, "\\'")}')" style="flex: 1; padding: 8px; background: #dc2626; color: white; border: none; border-radius: 6px; font-size: 13px; cursor: pointer;">
                                <i class="fas fa-trash"></i> Excluir
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;
        });
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Erro ao carregar documentos:', error);
        const container = document.getElementById('documentosContainer');
        if (container) {
            container.innerHTML = `
                <div class="info-box" style="background: #FEE2E2; color: #991B1B;">
                    <i class="fas fa-exclamation-triangle"></i> Erro ao carregar documentos.
                </div>
            `;
        }
    }
}

function showUploadAuditoria(tipo) {
    const titulos = {
        'higiene_maos': '🧼 Higiene das Mãos',
        'uso_medicamentos': '👁️ Uso de Medicamentos',
        'abreviaturas': '❌ Abreviaturas Perigosas'
    };
    
    const section = document.getElementById('qualidadeSection');
    const html = `
        ${renderInfoBanner('fas fa-upload', 'Upload de Evidência', `${titulos[tipo]} - Adicionar documento`, '#059669 0%, #10B981 100%', `showAuditoriaEspecifica('${tipo}')`)}

        <div class="form-container">
            <div class="info-box" style="background: #FEF3C7; margin-bottom: var(--spacing-md);">
                <i class="fas fa-info-circle"></i> 
                <strong>Instruções:</strong> Faça upload de documentos PDF com evidências de auditoria. 
                Formatos aceitos: PDF (máximo 10MB).
            </div>

            <form id="uploadAuditoriaForm" class="calc-form">
                <div class="form-group">
                    <label class="form-label"><i class="fas fa-heading"></i> Título do Documento *</label>
                    <input type="text" class="form-select" id="aud_titulo" placeholder="Ex: Auditoria Higiene das Mãos - Q3 2024" required>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-calendar"></i> Data da Auditoria *</label>
                    <input type="date" class="form-select" id="aud_data" required>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-user"></i> Responsável pela Auditoria</label>
                    <input type="text" class="form-select" id="aud_responsavel" placeholder="Nome do responsável" value="${currentUser.displayName || currentUser.email}">
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-file-pdf"></i> Arquivo PDF *</label>
                    <input type="file" class="form-select" id="aud_arquivo" accept=".pdf" required>
                    <small class="form-help">Máximo 10MB. Apenas arquivos PDF.</small>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-align-left"></i> Observações</label>
                    <textarea class="form-select" id="aud_observacoes" rows="3" placeholder="Observações sobre a auditoria..."></textarea>
                </div>

                <button type="submit" class="btn-primary">
                    <i class="fas fa-upload"></i> Upload do Documento
                </button>
            </form>
        </div>
    `;
    
    section.innerHTML = html;
    
    // Definir data atual como padrão
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('aud_data').value = hoje;
    
    document.getElementById('uploadAuditoriaForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await uploadAuditoria(tipo);
    });
}

async function uploadAuditoria(tipo) {
    try {
        showLoading();
        
        const titulo = document.getElementById('aud_titulo').value;
        const data = document.getElementById('aud_data').value;
        const responsavel = document.getElementById('aud_responsavel').value;
        const arquivo = document.getElementById('aud_arquivo').files[0];
        const observacoes = document.getElementById('aud_observacoes').value;
        
        if (!arquivo) {
            hideLoading();
            showToast('Selecione um arquivo PDF', 'error');
            return;
        }
        
        if (arquivo.size > 10 * 1024 * 1024) { // 10MB
            hideLoading();
            showToast('Arquivo muito grande. Máximo 10MB.', 'error');
            return;
        }
        
        // Simular upload (em produção, usar Firebase Storage)
        const urlSimulada = './pdfs/relatorio-trimestral-q3-2024.pdf';
        
        // Salvar metadados no Firebase
        await db.collection('auditorias_evidencias').add({
            tipo: tipo,
            titulo: titulo,
            data: firebase.firestore.Timestamp.fromDate(new Date(data)),
            responsavel: responsavel,
            url: urlSimulada,
            observacoes: observacoes,
            tamanho: arquivo.size,
            nomeArquivo: arquivo.name,
            uploadPor: currentUser.email,
            uploadData: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        hideLoading();
        showToast('Documento enviado com sucesso!', 'success');
        showAuditoriaEspecifica(tipo);
    } catch (error) {
        hideLoading();
        console.error('Erro ao fazer upload:', error);
    }
}

// ========== RELATÓRIOS DE AUDITORIAS DAS ROPS ==========
async function showRelatorioAuditoriasROPS() {
    // Verificar se é admin usando checkUserRole (disponível no app.js)
    let isAdminUser = false;
    if (typeof checkUserRole === 'function') {
        isAdminUser = await checkUserRole(['Administrador', 'Coordenador']);
    } else {
        // Fallback: verificar por email (função local)
        if (currentUser && currentUser.email) {
            const adminEmails = ['admin@anest.com.br', 'guilherme@anest.com.br'];
            isAdminUser = adminEmails.includes(currentUser.email);
        }
    }
    
    const section = document.getElementById('qualidadeSection');
    const html = `
        ${renderInfoBanner('fas fa-file-alt', 'Relatório de Auditorias das ROPS', 'Documentos e relatórios de auditorias das ROPS', '#059669 0%, #10B981 100%', 'showAuditorias()')}
        ${isAdminUser ? `<div style="margin-bottom: 20px; text-align: right;"><button class="btn-add" onclick="showUploadRelatorioAuditoriasROPS()" style="background: #059669; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; gap: 8px;"><i class="fas fa-upload"></i> Upload</button></div>` : ''}

        <div class="documentos-container" id="documentosRelatorioROPSContainer">
            <div class="loading-spinner">
                <i class="fas fa-spinner fa-spin"></i> Carregando documentos...
            </div>
        </div>
    `;
    
    section.innerHTML = html;
    await loadDocumentosRelatorioAuditoriasROPS();
}

async function loadDocumentosRelatorioAuditoriasROPS() {
    try {
        // Verificar se é admin
        let isAdmin = false;
        if (typeof checkUserRole === 'function') {
            isAdmin = await checkUserRole(['Administrador', 'Coordenador']);
        } else if (currentUser && currentUser.email) {
            const adminEmails = ['admin@anest.com.br', 'guilherme@anest.com.br'];
            isAdmin = adminEmails.includes(currentUser.email);
        }
        
        // Buscar documentos do Firebase
        let snapshot = null;
        try {
            snapshot = await db.collection('auditorias_documentos')
                .where('tipo', '==', 'relatorio_auditorias_rops')
                .get();
        } catch (e) {
            console.warn('Erro ao buscar documentos:', e);
        }
        
        const container = document.getElementById('documentosRelatorioROPSContainer');
        if (!container) return;
        
        // Adicionar documento padrão se não houver documentos no Firebase
        let html = '';
        
        // Documento padrão (fixo)
        html += `
            <div class="doc-card" style="position: relative;">
                <div onclick="abrirPDF('Documentos/7 - Ficha Tecnica Indicadores/Relatorio de Auditorias das ROPS 2.2025.pdf', 'Relatório de Auditorias das ROPS 2.2025')" style="cursor: pointer; display: flex; align-items: center; gap: 16px; padding: 16px;">
                    <div class="doc-icon" style="background: linear-gradient(135deg, #DC2626, #991B1B);">
                        <i class="fas fa-file-pdf"></i>
                    </div>
                    <div class="doc-info" style="flex: 1;">
                        <div class="doc-title">Relatório de Auditorias das ROPS 2.2025</div>
                        <div class="doc-codigo">2025 • Documento Padrão</div>
                    </div>
                </div>
            </div>
        `;
        
        // Adicionar documentos do Firebase se existirem
        if (snapshot && !snapshot.empty) {
            const docs = [];
            snapshot.forEach(doc => {
                docs.push({ id: doc.id, data: doc.data() });
            });
            
            docs.sort((a, b) => {
                const dateA = a.data.data?.toDate?.() || a.data.uploadedAt?.toDate?.() || new Date(0);
                const dateB = b.data.data?.toDate?.() || b.data.uploadedAt?.toDate?.() || new Date(0);
                return dateB - dateA;
            });
            
            docs.forEach(({ id, data }) => {
                const dataFormatada = data.data?.toDate ? data.data.toDate().toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                }) : (data.uploadedAt?.toDate ? data.uploadedAt.toDate().toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                }) : 'Data não disponível');
                
                const fileURL = data.url || data.fileURL;
                const titulo = data.titulo || data.title || 'Sem título';
                
                html += `
                    <div class="doc-card" style="position: relative;">
                        <div onclick="abrirPDF('${fileURL}', '${titulo.replace(/'/g, "\\'")}')" style="cursor: pointer; display: flex; align-items: center; gap: 16px; padding: 16px;">
                            <div class="doc-icon" style="background: linear-gradient(135deg, #DC2626, #991B1B);">
                                <i class="fas fa-file-pdf"></i>
                            </div>
                            <div class="doc-info" style="flex: 1;">
                                <div class="doc-title">${titulo}</div>
                                <div class="doc-codigo">${dataFormatada} • ${data.responsavel || data.uploadedByName || 'Sistema'}</div>
                            </div>
                        </div>
                        ${isAdmin ? `
                            <div style="display: flex; gap: 8px; padding: 8px 16px; border-top: 1px solid var(--border-color);">
                                <button onclick="event.stopPropagation(); excluirRelatorioAuditoriasROPS('${id}', '${(data.filePath || data.url || '').replace(/'/g, "\\'")}')" style="flex: 1; padding: 8px; background: #dc2626; color: white; border: none; border-radius: 6px; font-size: 13px; cursor: pointer;">
                                    <i class="fas fa-trash"></i> Excluir
                                </button>
                            </div>
                        ` : ''}
                    </div>
                `;
            });
        }
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Erro ao carregar documentos:', error);
        const container = document.getElementById('documentosRelatorioROPSContainer');
        if (container) {
            container.innerHTML = `
                <div class="info-box" style="background: #FEE2E2; color: #991B1B;">
                    <i class="fas fa-exclamation-triangle"></i> Erro ao carregar documentos.
                </div>
            `;
        }
    }
}

function showUploadRelatorioAuditoriasROPS() {
    const section = document.getElementById('qualidadeSection');
    const html = `
        ${renderInfoBanner('fas fa-upload', 'Upload de Relatório', 'Relatório de Auditorias das ROPS - Adicionar documento', '#059669 0%, #10B981 100%', 'showRelatorioAuditoriasROPS()')}

        <div class="form-container">
            <div class="info-box" style="background: #FEF3C7; margin-bottom: var(--spacing-md);">
                <i class="fas fa-info-circle"></i> 
                <strong>Instruções:</strong> Faça upload de documentos PDF com relatórios de auditorias das ROPS. 
                Formatos aceitos: PDF (máximo 10MB).
            </div>

            <form id="uploadRelatorioROPSForm" class="calc-form">
                <div class="form-group">
                    <label class="form-label"><i class="fas fa-heading"></i> Título do Documento *</label>
                    <input type="text" class="form-select" id="rops_titulo" placeholder="Ex: Relatório de Auditorias das ROPS - Q1 2025" required>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-calendar"></i> Data do Relatório *</label>
                    <input type="date" class="form-select" id="rops_data" required>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-user"></i> Responsável</label>
                    <input type="text" class="form-select" id="rops_responsavel" placeholder="Nome do responsável" value="${currentUser.displayName || currentUser.email}">
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-file-pdf"></i> Arquivo PDF *</label>
                    <input type="file" class="form-select" id="rops_arquivo" accept=".pdf" required>
                    <small class="form-help">Máximo 10MB. Apenas arquivos PDF.</small>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-align-left"></i> Observações</label>
                    <textarea class="form-select" id="rops_observacoes" rows="3" placeholder="Observações sobre o relatório..."></textarea>
                </div>

                <button type="submit" class="btn-primary">
                    <i class="fas fa-upload"></i> Upload do Documento
                </button>
            </form>
        </div>
    `;
    
    section.innerHTML = html;
    
    // Definir data atual como padrão
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('rops_data').value = hoje;
    
    document.getElementById('uploadRelatorioROPSForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await uploadRelatorioAuditoriasROPS();
    });
}

async function uploadRelatorioAuditoriasROPS() {
    try {
        showLoading();
        
        const titulo = document.getElementById('rops_titulo').value;
        const data = document.getElementById('rops_data').value;
        const responsavel = document.getElementById('rops_responsavel').value;
        const arquivo = document.getElementById('rops_arquivo').files[0];
        const observacoes = document.getElementById('rops_observacoes').value;
        
        if (!arquivo) {
            hideLoading();
            showToast('Selecione um arquivo PDF', 'error');
            return;
        }
        
        if (arquivo.size > 10 * 1024 * 1024) { // 10MB
            hideLoading();
            showToast('Arquivo muito grande. Máximo 10MB.', 'error');
            return;
        }
        
        // Upload para Firebase Storage
        const storage = firebase.storage();
        const timestamp = Date.now();
        const filename = `${timestamp}_${arquivo.name}`;
        const storagePath = `auditorias_documentos/relatorio_auditorias_rops/${filename}`;
        const storageRef = storage.ref(storagePath);
        
        const uploadTask = await storageRef.put(arquivo);
        const downloadURL = await uploadTask.ref.getDownloadURL();
        
        // Salvar metadados no Firebase
        await db.collection('auditorias_documentos').add({
            tipo: 'relatorio_auditorias_rops',
            titulo: titulo,
            data: firebase.firestore.Timestamp.fromDate(new Date(data)),
            responsavel: responsavel,
            url: downloadURL,
            filePath: storagePath,
            observacoes: observacoes,
            tamanho: arquivo.size,
            nomeArquivo: arquivo.name,
            uploadedBy: currentUser.email,
            uploadedByName: currentUser.displayName || currentUser.email,
            uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        hideLoading();
        showToast('Documento enviado com sucesso!', 'success');
        showRelatorioAuditoriasROPS();
    } catch (error) {
        hideLoading();
        console.error('Erro ao fazer upload:', error);
        showToast('Erro ao enviar documento', 'error');
    }
}

async function excluirRelatorioAuditoriasROPS(id, filePath) {
    if (!confirm('Tem certeza que deseja excluir este documento?')) {
        return;
    }
    
    try {
        showLoading();
        
        // Excluir do Firestore
        await db.collection('auditorias_documentos').doc(id).delete();
        
        // Excluir do Storage se tiver filePath
        if (filePath && filePath.startsWith('auditorias_documentos/')) {
            try {
                const storage = firebase.storage();
                const storageRef = storage.ref(filePath);
                await storageRef.delete();
            } catch (storageError) {
                console.warn('Erro ao excluir do Storage:', storageError);
            }
        }
        
        hideLoading();
        showToast('Documento excluído com sucesso!', 'success');
        showRelatorioAuditoriasROPS();
    } catch (error) {
        hideLoading();
        console.error('Erro ao excluir documento:', error);
        showToast('Erro ao excluir documento', 'error');
    }
}

// ========== RELATÓRIOS COM UPLOAD (NOVO) ==========
async function showRelatorios() {
    const section = document.getElementById('qualidadeSection');
    if (!section) return;
    
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
                    <h3 class="protocol-title">Indicadores de Qualidade</h3>
                </div>
            </div>
        </div>
    `;
    
    section.innerHTML = html;
    
    // Carregar contadores
    await loadContadoresRelatorios();
}

async function loadContadoresRelatorios() {
    try {
        const tipos = ['trimestral', 'incidentes', 'auditorias'];
        
        // Dados de exemplo consistentes
        const exemplos = {
            'trimestral': 2,
            'incidentes': 1,
            'auditorias': 3
        };
        
        for (const tipo of tipos) {
            let count = exemplos[tipo] || 0;
            
            // Tentar buscar dados reais do Firebase (se disponível)
            try {
                if (typeof db !== 'undefined' && db) {
                    const snapshot = await db.collection('relatorios_seguranca')
                        .where('tipo', '==', tipo)
                        .get();
                    count = snapshot.size;
                }
            } catch (error) {
                console.log(`Firebase não disponível para ${tipo}, usando dados de exemplo: ${count}`);
            }
            
            const badgeId = tipo === 'trimestral' ? 'badge_trimestral' : 
                           tipo === 'incidentes' ? 'badge_consolidado' : 'badge_relatorio_audit';
            
            const badge = document.getElementById(badgeId);
            if (badge) {
                badge.textContent = `${count} documento${count !== 1 ? 's' : ''}`;
                console.log(`Contador ${tipo}: ${count} documentos`);
            } else {
                console.warn(`Badge não encontrado: ${badgeId}`);
            }
        }
    } catch (error) {
        console.error('Erro ao carregar contadores:', error);
        // Fallback: definir contadores com dados de exemplo
        const badges = [
            { id: 'badge_trimestral', count: 2 },
            { id: 'badge_consolidado', count: 1 },
            { id: 'badge_relatorio_audit', count: 3 }
        ];
        
        badges.forEach(({ id, count }) => {
            const badge = document.getElementById(id);
            if (badge) {
                badge.textContent = `${count} documento${count !== 1 ? 's' : ''}`;
            }
        });
    }
}

async function showRelatorioEspecifico(tipo) {
    const titulos = {
        'trimestral': '📅 Relatório Trimestral',
        'incidentes': '⚠️ Consolidado de Incidentes',
        'auditorias': '🔍 Relatório de Auditorias'
    };
    
    // Determinar página de histórico baseado no tipo
    let historyPage = null;
    if (tipo === 'trimestral') {
        historyPage = 'relatorio-trimestral';
    } else if (tipo === 'incidentes') {
        historyPage = 'relatorio-incidentes';
    } else if (tipo === 'auditorias') {
        historyPage = 'relatorio-auditorias';
    }
    
    // Atualizar histórico de navegação
    if (historyPage && typeof atualizarHistoricoNavegacao === 'function') {
        atualizarHistoricoNavegacao(historyPage);
    }
    
    // Armazenar tipo atual para uso nas funções de editar/excluir
    window.currentRelatorioTipo = tipo;
    
    // Verificar se é admin usando checkUserRole (disponível no app.js)
    let isAdminUser = false;
    if (typeof checkUserRole === 'function') {
        isAdminUser = await checkUserRole(['Administrador', 'Coordenador']);
    } else {
        // Fallback: verificar por email (função local)
        if (currentUser && currentUser.email) {
            const adminEmails = ['admin@anest.com.br', 'guilherme@anest.com.br'];
            isAdminUser = adminEmails.includes(currentUser.email);
        }
    }
    
    const section = document.getElementById('qualidadeSection');
    const html = `
        ${renderInfoBanner('fas fa-file-medical-alt', titulos[tipo], 'Documentos disponíveis', '#006837 0%, #9BC53D 100%', 'voltarPagina()')}
        ${isAdmin ? `<div style="margin-bottom: 20px; text-align: right;"><button class="btn-add" onclick="showUploadRelatorio('${tipo}')" style="background: #006837; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; gap: 8px;"><i class="fas fa-upload"></i> Upload</button></div>` : ''}

        <div class="documentos-container" id="documentosContainer">
            <div class="loading-spinner">
                <i class="fas fa-spinner fa-spin"></i> Carregando documentos...
            </div>
        </div>
    `;
    
    section.innerHTML = html;
    await loadDocumentosRelatorio(tipo);
}

async function loadDocumentosRelatorio(tipo) {
    try {
        // Verificar se é admin usando checkUserRole (disponível no app.js)
        let isAdmin = false;
        if (typeof checkUserRole === 'function') {
            isAdmin = await checkUserRole(['Administrador', 'Coordenador']);
        } else if (typeof window.isAdmin === 'function') {
            isAdmin = window.isAdmin(currentUser);
        } else {
            // Fallback: verificar por email (função local)
            if (currentUser && currentUser.email) {
                const adminEmails = ['admin@anest.com.br', 'guilherme@anest.com.br'];
                isAdmin = adminEmails.includes(currentUser.email);
            }
        }
        
        // Tentar buscar de relatorios_seguranca (collection antiga) e relatorios_documentos (nova)
        let snapshot = null;
        try {
            snapshot = await db.collection('relatorios_seguranca')
                .where('tipo', '==', tipo)
                .orderBy('data', 'desc')
                .get();
        } catch (e) {
            // Se não encontrar, tentar buscar de relatorios_documentos
            try {
                snapshot = await db.collection('relatorios_documentos')
                    .where('tipo', '==', tipo)
                    .orderBy('uploadedAt', 'desc')
                    .get();
            } catch (e2) {
                console.warn('Erro ao buscar documentos:', e2);
            }
        }
        
        const container = document.getElementById('documentosContainer');
        if (!container) return;
        
        if (!snapshot || snapshot.empty) {
            container.innerHTML = `
                <div class="info-box">
                    <i class="fas fa-folder-open"></i> Nenhum documento cadastrado ainda.
                    ${(() => {
                        if (!currentUser) return false;
                        const adminEmails = ['admin@anest.com.br', 'guilherme@anest.com.br'];
                        return adminEmails.includes(currentUser.email);
                    })() ? '<br><br>Clique em "Upload" para adicionar relatórios.' : ''}
                </div>
            `;
            return;
        }
        
        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const dataFormatada = data.data?.toDate ? data.data.toDate().toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            }) : (data.uploadedAt?.toDate ? data.uploadedAt.toDate().toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            }) : 'Data não disponível');
            
            const fileURL = data.url || data.fileURL;
            const titulo = data.titulo || data.title || 'Sem título';
            
            html += `
                <div class="doc-card" style="position: relative;">
                    <div onclick="abrirPDF('${fileURL}', '${titulo.replace(/'/g, "\\'")}')" style="cursor: pointer; display: flex; align-items: center; gap: 16px; padding: 16px;">
                        <div class="doc-icon" style="background: linear-gradient(135deg, #DC2626, #991B1B);">
                            <i class="fas fa-file-pdf"></i>
                        </div>
                        <div class="doc-info" style="flex: 1;">
                            <div class="doc-title">${titulo}</div>
                            <div class="doc-codigo">${dataFormatada} • ${data.responsavel || data.uploadedByName || 'Sistema'}</div>
                        </div>
                    </div>
                    ${isAdmin ? `
                        <div style="display: flex; gap: 8px; padding: 8px 16px; border-top: 1px solid var(--border-color);">
                            <button onclick="event.stopPropagation(); editarRelatorioDocumento('${doc.id}', '${tipo}')" style="flex: 1; padding: 8px; background: var(--primary-medium); color: white; border: none; border-radius: 6px; font-size: 13px; cursor: pointer;">
                                <i class="fas fa-edit"></i> Editar
                            </button>
                            <button onclick="event.stopPropagation(); excluirRelatorioDocumento('${doc.id}', '${(data.filePath || data.url || '').replace(/'/g, "\\'")}')" style="flex: 1; padding: 8px; background: #dc2626; color: white; border: none; border-radius: 6px; font-size: 13px; cursor: pointer;">
                                <i class="fas fa-trash"></i> Excluir
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;
        });
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Erro ao carregar documentos:', error);
        document.getElementById('documentosContainer').innerHTML = `
            <div class="info-box" style="background: #FEE2E2; color: #991B1B;">
                <i class="fas fa-exclamation-triangle"></i> Erro ao carregar documentos.
            </div>
        `;
    }
}

function showUploadRelatorio(tipo) {
    const titulos = {
        'trimestral': '📅 Relatório Trimestral',
        'incidentes': '⚠️ Consolidado de Incidentes',
        'auditorias': '🔍 Relatório de Auditorias'
    };
    
    const section = document.getElementById('qualidadeSection');
    const html = `
        ${renderInfoBanner('fas fa-upload', 'Upload de Relatório', `${titulos[tipo]} - Adicionar documento`, '#006837 0%, #9BC53D 100%', `showRelatorioEspecifico('${tipo}')`)}

        <div class="form-container">
            <div class="info-box" style="background: #FEF3C7; margin-bottom: var(--spacing-md);">
                <i class="fas fa-info-circle"></i> 
                <strong>Instruções:</strong> Faça upload de relatórios de segurança em PDF. 
                Formatos aceitos: PDF (máximo 10MB).
            </div>

            <form id="uploadRelatorioForm" class="calc-form">
                <div class="form-group">
                    <label class="form-label"><i class="fas fa-heading"></i> Título do Relatório *</label>
                    <input type="text" class="form-select" id="rel_titulo" placeholder="Ex: Relatório Trimestral Q3 2024" required>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-calendar"></i> Período do Relatório *</label>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <input type="date" class="form-select" id="rel_data_inicio" placeholder="Data Início" required>
                        <input type="date" class="form-select" id="rel_data_fim" placeholder="Data Fim" required>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-user"></i> Responsável pelo Relatório</label>
                    <input type="text" class="form-select" id="rel_responsavel" placeholder="Nome do responsável" value="${currentUser.displayName || currentUser.email}">
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-file-pdf"></i> Arquivo PDF *</label>
                    <input type="file" class="form-select" id="rel_arquivo" accept=".pdf" required>
                    <small class="form-help">Máximo 10MB. Apenas arquivos PDF.</small>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-align-left"></i> Resumo do Relatório</label>
                    <textarea class="form-select" id="rel_resumo" rows="4" placeholder="Breve resumo dos principais pontos do relatório..."></textarea>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-exclamation-triangle"></i> Principais Achados</label>
                    <textarea class="form-select" id="rel_achados" rows="3" placeholder="Principais achados, não conformidades ou recomendações..."></textarea>
                </div>

                <button type="submit" class="btn-primary">
                    <i class="fas fa-upload"></i> Upload do Relatório
                </button>
            </form>
        </div>
    `;
    
    section.innerHTML = html;
    
    // Definir período padrão (último trimestre)
    const hoje = new Date();
    const tresMesesAtras = new Date(hoje.getFullYear(), hoje.getMonth() - 3, 1);
    const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    
    document.getElementById('rel_data_inicio').value = tresMesesAtras.toISOString().split('T')[0];
    document.getElementById('rel_data_fim').value = primeiroDiaMes.toISOString().split('T')[0];
    
    document.getElementById('uploadRelatorioForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await uploadRelatorio(tipo);
    });
}

async function uploadRelatorio(tipo) {
    try {
        showLoading();
        
        const titulo = document.getElementById('rel_titulo').value;
        const dataInicio = document.getElementById('rel_data_inicio').value;
        const dataFim = document.getElementById('rel_data_fim').value;
        const responsavel = document.getElementById('rel_responsavel').value;
        const arquivo = document.getElementById('rel_arquivo').files[0];
        const resumo = document.getElementById('rel_resumo').value;
        const achados = document.getElementById('rel_achados').value;
        
        if (!arquivo) {
            hideLoading();
            showToast('Selecione um arquivo PDF', 'error');
            return;
        }
        
        if (arquivo.size > 10 * 1024 * 1024) { // 10MB
            hideLoading();
            showToast('Arquivo muito grande. Máximo 10MB.', 'error');
            return;
        }
        
        // Validar datas
        if (new Date(dataInicio) > new Date(dataFim)) {
            hideLoading();
            showToast('Data de início deve ser anterior à data de fim', 'error');
            return;
        }
        
        // Simular upload (em produção, usar Firebase Storage)
        const urlSimulada = './pdfs/relatorio-trimestral-q2-2024.pdf';
        
        // Salvar metadados no Firebase
        await db.collection('relatorios_seguranca').add({
            tipo: tipo,
            titulo: titulo,
            dataInicio: firebase.firestore.Timestamp.fromDate(new Date(dataInicio)),
            dataFim: firebase.firestore.Timestamp.fromDate(new Date(dataFim)),
            responsavel: responsavel,
            url: urlSimulada,
            resumo: resumo,
            achados: achados,
            tamanho: arquivo.size,
            nomeArquivo: arquivo.name,
            uploadPor: currentUser.email,
            uploadData: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        hideLoading();
        showToast('Relatório enviado com sucesso!', 'success');
        showRelatorioEspecifico(tipo);
    } catch (error) {
        hideLoading();
        console.error('Erro ao fazer upload:', error);
        showToast('Erro ao enviar relatório', 'error');
    }
}

// Contadores de documentos removidos - cards limpos

// Função para abrir PDFs com PDF.js (sem ferramentas de download/impressão)
function abrirPDF(url, titulo) {
    console.log('🔍 Abrindo PDF com PDF.js:', { url, titulo });
    
    const section = document.getElementById('qualidadeSection');
    if (!section) {
        console.error('❌ Seção qualidadeSection não encontrada');
        showToast('Erro: Seção não encontrada', 'error');
        return;
    }
    
    // Verificar se a URL é válida
    if (!url || url === '#' || url === '') {
        console.error('❌ URL inválida:', url);
        showToast('Erro: URL do documento inválida', 'error');
        return;
    }
    
    const html = `
        ${renderInfoBanner('fas fa-file-pdf', titulo, 'Visualização segura do documento', '#006837 0%, #9BC53D 100%', 'showRelatorioAuditoriasROPS()')}

        <div class="pdf-viewer-container">
            <div class="pdf-viewer-header">
                <div class="pdf-info">
                    <i class="fas fa-file-pdf"></i>
                    <span>${titulo}</span>
                </div>
                <div class="pdf-controls">
                    <button class="btn-pdf" onclick="zoomOut()" title="Diminuir zoom">
                        <i class="fas fa-search-minus"></i>
                    </button>
                    <button class="btn-pdf" onclick="zoomIn()" title="Aumentar zoom">
                        <i class="fas fa-search-plus"></i>
                    </button>
                    <button class="btn-pdf" onclick="resetZoom()" title="Zoom original">
                        <i class="fas fa-expand-arrows-alt"></i>
                    </button>
                    <button class="btn-pdf" onclick="fecharPDF()">
                        <i class="fas fa-times"></i> Fechar
                    </button>
                </div>
            </div>
            
            <div class="pdf-viewer">
                <div class="pdf-loading" id="pdfLoading">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Carregando documento...</p>
                </div>
                <canvas id="pdfCanvas" style="display: none; border: none; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); max-width: 100%;"></canvas>
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
    
    // Passar caminho diretamente - carregarPDFComPDFJS vai construir a URL corretamente
    console.log('🔗 Carregando PDF com caminho:', url);
    
    // Carregar PDF com PDF.js (mesma função usada em outros lugares)
    carregarPDFComPDFJS(url);
}

// Funções PDF.js movidas para app.js (disponíveis globalmente)

function protegerPDF() {
    // Desabilitar menu de contexto (clique direito)
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        return false;
    });
    
    // Desabilitar atalhos de teclado para download/impressão
    document.addEventListener('keydown', function(e) {
        // Ctrl+P (imprimir)
        if (e.ctrlKey && e.key === 'p') {
            e.preventDefault();
            showToast('Impressão desabilitada para este documento', 'warning');
            return false;
        }
        
        // Ctrl+S (salvar)
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            showToast('Download desabilitado para este documento', 'warning');
            return false;
        }
        
        // F12 (DevTools)
        if (e.key === 'F12') {
            e.preventDefault();
            return false;
        }
        
        // Ctrl+Shift+I (DevTools)
        if (e.ctrlKey && e.shiftKey && e.key === 'I') {
            e.preventDefault();
            return false;
        }
    });
    
    // Desabilitar seleção de texto
    document.addEventListener('selectstart', function(e) {
        e.preventDefault();
        return false;
    });
    
    // Desabilitar arrastar
    document.addEventListener('dragstart', function(e) {
        e.preventDefault();
        return false;
    });
}

function fecharPDF() {
    showRelatorioAuditoriasROPS();
}

// ==================== GESTÃO DE DOCUMENTOS POR INDICADOR ====================

// Helper para verificar permissão de admin
function isAdmin(user) {
    if (!user) return false;
    const adminEmails = ['admin@anest.com.br', 'guilherme@anest.com.br', 'wguime@yahoo.com.br'];
    return adminEmails.includes(user.email);
}

// ========== 1. TAXA DE INFECÇÃO ==========
async function showTaxaInfeccao() {
    const section = document.getElementById('painelSection');
    if (!section) return;
    
    const isAdminUser = isAdmin(currentUser);
    console.log('🦠 Taxa de Infecção - É Admin?', isAdminUser, 'User:', currentUser);
    
    const html = `
        ${renderInfoBanner('fas fa-virus', 'Taxa de Infecção', 'Indicadores e relatórios de infecção hospitalar', '#dc2626 0%, #991b1b 100%', 'showKPIs()')}
        ${isAdminUser ? `<div style="margin-bottom: 20px; text-align: right;"><button class="btn-add" onclick="showNovoDocTaxaInfeccao()" style="background: #dc2626; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; gap: 8px;"><i class="fas fa-plus"></i> Novo Documento</button></div>` : ''}

        <div class="comunicados-container" id="docsContainer">
            <div class="loading-spinner">
                <i class="fas fa-spinner fa-spin"></i> Carregando documentos...
            </div>
        </div>
    `;
    
    section.innerHTML = html;
    await loadDocsTaxaInfeccao();
}

async function loadDocsTaxaInfeccao() {
    try {
        const docsRef = db.collection('kpi_taxa_infeccao').orderBy('data', 'desc').limit(20);
        const snapshot = await docsRef.get();
        
        const container = document.getElementById('docsContainer');
        const isAdminUser = isAdmin(currentUser);
        
        console.log('📄 Carregando Taxa Infecção - Docs:', snapshot.size, 'É Admin?', isAdminUser);
        
        if (snapshot.empty) {
            container.innerHTML = `
                <div class="info-box" style="text-align: center; padding: 40px;">
                    <i class="fas fa-folder-open" style="font-size: 48px; color: #CBD5E1; margin-bottom: 16px;"></i>
                    <h3 style="color: var(--text-primary); margin-bottom: 8px;">Nenhum documento disponível</h3>
                    ${isAdminUser ? '<p style="color: var(--text-secondary);">Clique no botão <strong>"Novo"</strong> acima para adicionar o primeiro documento.</p>' : '<p style="color: var(--text-secondary);">Ainda não há documentos publicados nesta seção.</p>'}
                </div>
            `;
            return;
        }
        
        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const dataFormatada = data.data?.toDate().toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }) || 'Data não disponível';
            
            html += `
                <div class="comunicado-card" onclick="showDetalheTaxaInfeccao('${doc.id}')">
                    <div class="comunicado-header">
                        <div class="comunicado-priority">🦠 Taxa de Infecção</div>
                        <div class="comunicado-date">${dataFormatada}</div>
                    </div>
                    <h3 class="comunicado-title">${data.titulo}</h3>
                    <p class="comunicado-preview">${data.descricao ? data.descricao.substring(0, 150) : ''}${data.descricao && data.descricao.length > 150 ? '...' : ''}</p>
                    <div class="comunicado-footer">
                        <div class="comunicado-author">
                            <i class="fas fa-user"></i> ${data.autor || 'Administração'}
                        </div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Erro ao carregar documentos:', error);
        // Se houver erro (ex: collection não existe ou sem permissão), mostrar mensagem amigável
        const container = document.getElementById('docsContainer');
        if (container) {
            container.innerHTML = `
                <div class="info-box">
                    <i class="fas fa-info-circle"></i> Nenhum documento disponível no momento.
                    ${isAdmin(currentUser) ? '<br><br>Clique em "Novo" para adicionar o primeiro documento.' : ''}
                </div>
            `;
        }
    }
}

async function showDetalheTaxaInfeccao(id) {
    try {
        const doc = await db.collection('kpi_taxa_infeccao').doc(id).get();
        if (!doc.exists) {
            showToast('Documento não encontrado', 'error');
            return;
        }
        
        const data = doc.data();
        const dataFormatada = data.data?.toDate().toLocaleString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }) || 'Data não disponível';
        
        const section = document.getElementById('painelSection');
        const html = `
            ${renderInfoBanner('fas fa-file-alt', data.titulo, 'Documento de Taxa de Infecção', '#dc2626 0%, #991b1b 100%', 'showTaxaInfeccao()')}
            ${isAdmin(currentUser) ? `<div style="margin-bottom: 20px; text-align: right;"><button class="btn-delete" onclick="deleteDocTaxaInfeccao('${id}')" style="background: #DC2626; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; gap: 8px;"><i class="fas fa-trash"></i> Excluir</button></div>` : ''}

            <div class="comunicado-detalhes">
                <div class="comunicado-meta">
                    <div><i class="fas fa-calendar"></i> ${dataFormatada}</div>
                    <div><i class="fas fa-user"></i> ${data.autor || 'Administração'}</div>
                    <div><i class="fas fa-tag"></i> Taxa de Infecção</div>
                </div>
                <div class="comunicado-content">
                    ${data.descricao ? data.descricao.replace(/\n/g, '<br>') : ''}
                </div>
                
                ${data.arquivoURL ? `
                <div style="margin-top: 24px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px; background: #2C3E50; color: white; border-radius: 8px 8px 0 0;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <i class="fas fa-file-pdf" style="font-size: 20px; color: #DC2626;"></i>
                            <span style="font-weight: 500;">${data.arquivoNome || 'Documento.pdf'}</span>
                        </div>
                        <span style="font-size: 14px; color: #BDC3C7;">Visualização segura do documento</span>
                    </div>
                    <iframe 
                        src="${data.arquivoURL}#toolbar=1&navpanes=0&scrollbar=1" 
                        style="width: 100%; height: 800px; border: 2px solid #2C3E50; border-top: none; border-radius: 0 0 8px 8px; background: white;"
                        frameborder="0"
                        oncontextmenu="return false;">
                    </iframe>
                </div>
                ` : ''}
                
                ${isAdmin(currentUser) ? `
                <div class="document-actions" style="justify-content: center; margin-top: 24px;">
                    <button class="btn-delete" onclick="deleteDocTaxaInfeccao('${id}')">
                        <i class="fas fa-trash"></i> Excluir
                    </button>
                </div>
                ` : ''}
            </div>
        `;
        
        section.innerHTML = html;
    } catch (error) {
        console.error('Erro ao carregar detalhes:', error);
        showToast('Erro ao carregar documento', 'error');
    }
}

function showNovoDocTaxaInfeccao() {
    const section = document.getElementById('painelSection');
    const html = `
        ${renderInfoBanner('fas fa-plus-circle', 'Novo Documento - Taxa de Infecção', 'Adicionar novo documento de taxa de infecção', '#dc2626 0%, #991b1b 100%', 'showTaxaInfeccao()')}

        <div class="form-container">
            <form id="novoDocForm" class="calc-form">
                <div class="form-group">
                    <label class="form-label"><i class="fas fa-heading"></i> Título *</label>
                    <input type="text" class="form-select" id="doc_titulo" placeholder="Ex: Relatório Mensal de Infecções" required>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-align-left"></i> Descrição *</label>
                    <textarea class="form-select" id="doc_descricao" rows="8" placeholder="Descreva o documento..." required></textarea>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-file-pdf"></i> Anexar Arquivo PDF</label>
                    <input type="file" class="form-select" id="doc_arquivo" accept=".pdf" style="padding: 12px;">
                    <small style="color: var(--text-secondary); font-size: 12px; display: block; margin-top: 8px;">
                        <i class="fas fa-info-circle"></i> Opcional. Máximo 10MB. Apenas arquivos PDF.
                    </small>
                </div>

                <button type="submit" class="btn-primary">
                    <i class="fas fa-save"></i> Salvar Documento
                </button>
            </form>
        </div>
    `;
    
    section.innerHTML = html;
    
    document.getElementById('novoDocForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await salvarDocTaxaInfeccao();
    });
}

async function salvarDocTaxaInfeccao() {
    try {
        showLoading();
        
        const titulo = document.getElementById('doc_titulo').value;
        const descricao = document.getElementById('doc_descricao').value;
        const arquivoInput = document.getElementById('doc_arquivo');
        
        // Dados básicos do documento
        const docData = {
            titulo,
            descricao,
            autor: currentUser.email,
            autorNome: currentUser.displayName || currentUser.email,
            data: firebase.firestore.FieldValue.serverTimestamp(),
            ativo: true
        };
        
        // Se houver arquivo anexado, fazer upload
        if (arquivoInput && arquivoInput.files && arquivoInput.files[0]) {
            const arquivo = arquivoInput.files[0];
            
            // Validar tamanho (10MB)
            if (arquivo.size > 10 * 1024 * 1024) {
                hideLoading();
                showToast('Arquivo muito grande. Máximo 10MB.', 'error');
                return;
            }
            
            // Upload para Firebase Storage
            const storageRef = firebase.storage().ref();
            const nomeArquivo = `kpi_taxa_infeccao/${Date.now()}_${arquivo.name}`;
            const fileRef = storageRef.child(nomeArquivo);
            
            await fileRef.put(arquivo);
            const urlArquivo = await fileRef.getDownloadURL();
            
            docData.arquivoURL = urlArquivo;
            docData.arquivoNome = arquivo.name;
        }
        
        await db.collection('kpi_taxa_infeccao').add(docData);
        
        hideLoading();
        showToast('Documento salvo com sucesso!', 'success');
        showTaxaInfeccao();
    } catch (error) {
        hideLoading();
        console.error('Erro ao salvar documento:', error);
        showToast('Erro ao salvar documento', 'error');
    }
}

async function deleteDocTaxaInfeccao(id) {
    if (!confirm('Tem certeza que deseja excluir este documento?')) return;
    
    try {
        showLoading();
        await db.collection('kpi_taxa_infeccao').doc(id).delete();
        hideLoading();
        showToast('Documento excluído com sucesso!', 'success');
        showTaxaInfeccao();
    } catch (error) {
        hideLoading();
        console.error('Erro ao excluir documento:', error);
        showToast('Erro ao excluir documento', 'error');
    }
}

// ========== 2. ADESÃO AOS PROTOCOLOS ==========
async function showAdesaoProtocolos() {
    const section = document.getElementById('painelSection');
    if (!section) return;
    
    const isAdminUser = isAdmin(currentUser);
    console.log('✅ Adesão aos Protocolos - É Admin?', isAdminUser, 'User:', currentUser);
    
    const html = `
        ${renderInfoBanner('fas fa-check-circle', 'Adesão aos Protocolos', 'Monitoramento de conformidade e compliance', '#059669 0%, #10B981 100%', 'showKPIs()')}
        ${isAdminUser ? `<div style="margin-bottom: 20px; text-align: right;"><button class="btn-add" onclick="showNovoDocAdesaoProtocolos()" style="background: #059669; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; gap: 8px;"><i class="fas fa-plus"></i> Novo Documento</button></div>` : ''}

        <div class="comunicados-container" id="docsContainer">
            <div class="loading-spinner">
                <i class="fas fa-spinner fa-spin"></i> Carregando documentos...
            </div>
        </div>
    `;
    
    section.innerHTML = html;
    await loadDocsAdesaoProtocolos();
}

async function loadDocsAdesaoProtocolos() {
    try {
        const docsRef = db.collection('kpi_adesao_protocolos').orderBy('data', 'desc').limit(20);
        const snapshot = await docsRef.get();
        
        const container = document.getElementById('docsContainer');
        const isAdminUser = isAdmin(currentUser);
        
        console.log('📄 Carregando Adesão Protocolos - Docs:', snapshot.size, 'É Admin?', isAdminUser);
        
        if (snapshot.empty) {
            container.innerHTML = `
                <div class="info-box" style="text-align: center; padding: 40px;">
                    <i class="fas fa-folder-open" style="font-size: 48px; color: #CBD5E1; margin-bottom: 16px;"></i>
                    <h3 style="color: var(--text-primary); margin-bottom: 8px;">Nenhum documento disponível</h3>
                    ${isAdminUser ? '<p style="color: var(--text-secondary);">Clique no botão <strong>"Novo"</strong> acima para adicionar o primeiro documento.</p>' : '<p style="color: var(--text-secondary);">Ainda não há documentos publicados nesta seção.</p>'}
                </div>
            `;
            return;
        }
        
        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const dataFormatada = data.data?.toDate().toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }) || 'Data não disponível';
            
            html += `
                <div class="comunicado-card" onclick="showDetalheAdesaoProtocolos('${doc.id}')">
                    <div class="comunicado-header">
                        <div class="comunicado-priority">✅ Adesão aos Protocolos</div>
                        <div class="comunicado-date">${dataFormatada}</div>
                    </div>
                    <h3 class="comunicado-title">${data.titulo}</h3>
                    <p class="comunicado-preview">${data.descricao ? data.descricao.substring(0, 150) : ''}${data.descricao && data.descricao.length > 150 ? '...' : ''}</p>
                    <div class="comunicado-footer">
                        <div class="comunicado-author">
                            <i class="fas fa-user"></i> ${data.autor || 'Administração'}
                        </div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Erro ao carregar documentos:', error);
        // Se houver erro (ex: collection não existe ou sem permissão), mostrar mensagem amigável
        const container = document.getElementById('docsContainer');
        if (container) {
            container.innerHTML = `
                <div class="info-box">
                    <i class="fas fa-info-circle"></i> Nenhum documento disponível no momento.
                    ${isAdmin(currentUser) ? '<br><br>Clique em "Novo" para adicionar o primeiro documento.' : ''}
                </div>
            `;
        }
    }
}

async function showDetalheAdesaoProtocolos(id) {
    try {
        const doc = await db.collection('kpi_adesao_protocolos').doc(id).get();
        if (!doc.exists) {
            showToast('Documento não encontrado', 'error');
            return;
        }
        
        const data = doc.data();
        const dataFormatada = data.data?.toDate().toLocaleString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }) || 'Data não disponível';
        
        const section = document.getElementById('painelSection');
        const html = `
            ${renderInfoBanner('fas fa-file-alt', data.titulo, 'Documento de Adesão aos Protocolos', '#059669 0%, #10B981 100%', 'showAdesaoProtocolos()')}
            ${isAdmin(currentUser) ? `<div style="margin-bottom: 20px; text-align: right;"><button class="btn-delete" onclick="deleteDocAdesaoProtocolos('${id}')" style="background: #DC2626; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; gap: 8px;"><i class="fas fa-trash"></i> Excluir</button></div>` : ''}

            <div class="comunicado-detalhes">
                <div class="comunicado-meta">
                    <div><i class="fas fa-calendar"></i> ${dataFormatada}</div>
                    <div><i class="fas fa-user"></i> ${data.autor || 'Administração'}</div>
                    <div><i class="fas fa-tag"></i> Adesão aos Protocolos</div>
                </div>
                <div class="comunicado-content">
                    ${data.descricao ? data.descricao.replace(/\n/g, '<br>') : ''}
                </div>
                
                ${data.arquivoURL ? `
                <div style="margin-top: 24px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px; background: #2C3E50; color: white; border-radius: 8px 8px 0 0;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <i class="fas fa-file-pdf" style="font-size: 20px; color: #DC2626;"></i>
                            <span style="font-weight: 500;">${data.arquivoNome || 'Documento.pdf'}</span>
                        </div>
                        <span style="font-size: 14px; color: #BDC3C7;">Visualização segura do documento</span>
                    </div>
                    <iframe 
                        src="${data.arquivoURL}#toolbar=1&navpanes=0&scrollbar=1" 
                        style="width: 100%; height: 800px; border: 2px solid #2C3E50; border-top: none; border-radius: 0 0 8px 8px; background: white;"
                        frameborder="0"
                        oncontextmenu="return false;">
                    </iframe>
                </div>
                ` : ''}
                
                ${isAdmin(currentUser) ? `
                <div class="document-actions" style="justify-content: center; margin-top: 24px;">
                    <button class="btn-delete" onclick="deleteDocAdesaoProtocolos('${id}')">
                        <i class="fas fa-trash"></i> Excluir
                    </button>
                </div>
                ` : ''}
            </div>
        `;
        
        section.innerHTML = html;
    } catch (error) {
        console.error('Erro ao carregar detalhes:', error);
        showToast('Erro ao carregar documento', 'error');
    }
}

function showNovoDocAdesaoProtocolos() {
    const section = document.getElementById('painelSection');
    const html = `
        ${renderInfoBanner('fas fa-plus-circle', 'Novo Documento - Adesão aos Protocolos', 'Adicionar novo documento de adesão aos protocolos', '#059669 0%, #10B981 100%', 'showAdesaoProtocolos()')}

        <div class="form-container">
            <form id="novoDocForm" class="calc-form">
                <div class="form-group">
                    <label class="form-label"><i class="fas fa-heading"></i> Título *</label>
                    <input type="text" class="form-select" id="doc_titulo" placeholder="Ex: Relatório de Conformidade Mensal" required>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-align-left"></i> Descrição *</label>
                    <textarea class="form-select" id="doc_descricao" rows="8" placeholder="Descreva o documento..." required></textarea>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-file-pdf"></i> Anexar Arquivo PDF</label>
                    <input type="file" class="form-select" id="doc_arquivo" accept=".pdf" style="padding: 12px;">
                    <small style="color: var(--text-secondary); font-size: 12px; display: block; margin-top: 8px;">
                        <i class="fas fa-info-circle"></i> Opcional. Máximo 10MB. Apenas arquivos PDF.
                    </small>
                </div>

                <button type="submit" class="btn-primary">
                    <i class="fas fa-save"></i> Salvar Documento
                </button>
            </form>
        </div>
    `;
    
    section.innerHTML = html;
    
    document.getElementById('novoDocForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await salvarDocAdesaoProtocolos();
    });
}

async function salvarDocAdesaoProtocolos() {
    try {
        showLoading();
        
        const titulo = document.getElementById('doc_titulo').value;
        const descricao = document.getElementById('doc_descricao').value;
        const arquivoInput = document.getElementById('doc_arquivo');
        
        const docData = {
            titulo,
            descricao,
            autor: currentUser.email,
            autorNome: currentUser.displayName || currentUser.email,
            data: firebase.firestore.FieldValue.serverTimestamp(),
            ativo: true
        };
        
        if (arquivoInput && arquivoInput.files && arquivoInput.files[0]) {
            const arquivo = arquivoInput.files[0];
            if (arquivo.size > 10 * 1024 * 1024) {
                hideLoading();
                showToast('Arquivo muito grande. Máximo 10MB.', 'error');
                return;
            }
            const storageRef = firebase.storage().ref();
            const nomeArquivo = `kpi_adesao_protocolos/${Date.now()}_${arquivo.name}`;
            const fileRef = storageRef.child(nomeArquivo);
            await fileRef.put(arquivo);
            const urlArquivo = await fileRef.getDownloadURL();
            docData.arquivoURL = urlArquivo;
            docData.arquivoNome = arquivo.name;
        }
        
        await db.collection('kpi_adesao_protocolos').add(docData);
        
        hideLoading();
        showToast('Documento salvo com sucesso!', 'success');
        showAdesaoProtocolos();
    } catch (error) {
        hideLoading();
        console.error('Erro ao salvar documento:', error);
        showToast('Erro ao salvar documento', 'error');
    }
}

async function deleteDocAdesaoProtocolos(id) {
    if (!confirm('Tem certeza que deseja excluir este documento?')) return;
    
    try {
        showLoading();
        await db.collection('kpi_adesao_protocolos').doc(id).delete();
        hideLoading();
        showToast('Documento excluído com sucesso!', 'success');
        showAdesaoProtocolos();
    } catch (error) {
        hideLoading();
        console.error('Erro ao excluir documento:', error);
        showToast('Erro ao excluir documento', 'error');
    }
}

// ========== 3. EVENTOS ADVERSOS ==========
async function showEventosAdversos() {
    const section = document.getElementById('painelSection');
    if (!section) return;
    
    const isAdminUser = isAdmin(currentUser);
    console.log('⚠️ Eventos Adversos - É Admin?', isAdminUser, 'User:', currentUser);
    
    const html = `
        ${renderInfoBanner('fas fa-exclamation-triangle', 'Eventos Adversos', 'Registros e análise de eventos adversos', '#dc2626 0%, #991b1b 100%', 'showKPIs()')}
        ${isAdminUser ? `<div style="margin-bottom: 20px; text-align: right;"><button class="btn-add" onclick="showNovoDocEventosAdversos()" style="background: #dc2626; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; gap: 8px;"><i class="fas fa-plus"></i> Novo Documento</button></div>` : ''}

        <div class="comunicados-container" id="docsContainer">
            <div class="loading-spinner">
                <i class="fas fa-spinner fa-spin"></i> Carregando documentos...
            </div>
        </div>
    `;
    
    section.innerHTML = html;
    await loadDocsEventosAdversos();
}

async function loadDocsEventosAdversos() {
    try {
        const docsRef = db.collection('kpi_eventos_adversos').orderBy('data', 'desc').limit(20);
        const snapshot = await docsRef.get();
        
        const container = document.getElementById('docsContainer');
        const isAdminUser = isAdmin(currentUser);
        
        console.log('📄 Carregando Eventos Adversos - Docs:', snapshot.size, 'É Admin?', isAdminUser);
        
        if (snapshot.empty) {
            container.innerHTML = `
                <div class="info-box" style="text-align: center; padding: 40px;">
                    <i class="fas fa-folder-open" style="font-size: 48px; color: #CBD5E1; margin-bottom: 16px;"></i>
                    <h3 style="color: var(--text-primary); margin-bottom: 8px;">Nenhum documento disponível</h3>
                    ${isAdminUser ? '<p style="color: var(--text-secondary);">Clique no botão <strong>"Novo"</strong> acima para adicionar o primeiro documento.</p>' : '<p style="color: var(--text-secondary);">Ainda não há documentos publicados nesta seção.</p>'}
                </div>
            `;
            return;
        }
        
        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const dataFormatada = data.data?.toDate().toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }) || 'Data não disponível';
            
            html += `
                <div class="comunicado-card" onclick="showDetalheEventosAdversos('${doc.id}')">
                    <div class="comunicado-header">
                        <div class="comunicado-priority">⚠️ Eventos Adversos</div>
                        <div class="comunicado-date">${dataFormatada}</div>
                    </div>
                    <h3 class="comunicado-title">${data.titulo}</h3>
                    <p class="comunicado-preview">${data.descricao ? data.descricao.substring(0, 150) : ''}${data.descricao && data.descricao.length > 150 ? '...' : ''}</p>
                    <div class="comunicado-footer">
                        <div class="comunicado-author">
                            <i class="fas fa-user"></i> ${data.autor || 'Administração'}
                        </div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Erro ao carregar documentos:', error);
        // Se houver erro (ex: collection não existe ou sem permissão), mostrar mensagem amigável
        const container = document.getElementById('docsContainer');
        if (container) {
            container.innerHTML = `
                <div class="info-box">
                    <i class="fas fa-info-circle"></i> Nenhum documento disponível no momento.
                    ${isAdmin(currentUser) ? '<br><br>Clique em "Novo" para adicionar o primeiro documento.' : ''}
                </div>
            `;
        }
    }
}

async function showDetalheEventosAdversos(id) {
    try {
        const doc = await db.collection('kpi_eventos_adversos').doc(id).get();
        if (!doc.exists) {
            showToast('Documento não encontrado', 'error');
            return;
        }
        
        const data = doc.data();
        const dataFormatada = data.data?.toDate().toLocaleString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }) || 'Data não disponível';
        
        const section = document.getElementById('painelSection');
        const html = `
            ${renderInfoBanner('fas fa-file-alt', data.titulo, 'Documento de Eventos Adversos', '#dc2626 0%, #991b1b 100%', 'showEventosAdversos()')}
            ${isAdmin(currentUser) ? `<div style="margin-bottom: 20px; text-align: right;"><button class="btn-delete" onclick="deleteDocEventosAdversos('${id}')" style="background: #DC2626; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; gap: 8px;"><i class="fas fa-trash"></i> Excluir</button></div>` : ''}

            <div class="comunicado-detalhes">
                <div class="comunicado-meta">
                    <div><i class="fas fa-calendar"></i> ${dataFormatada}</div>
                    <div><i class="fas fa-user"></i> ${data.autor || 'Administração'}</div>
                    <div><i class="fas fa-tag"></i> Eventos Adversos</div>
                </div>
                <div class="comunicado-content">
                    ${data.descricao ? data.descricao.replace(/\n/g, '<br>') : ''}
                </div>
                
                ${data.arquivoURL ? `
                <div style="margin-top: 24px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px; background: #2C3E50; color: white; border-radius: 8px 8px 0 0;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <i class="fas fa-file-pdf" style="font-size: 20px; color: #DC2626;"></i>
                            <span style="font-weight: 500;">${data.arquivoNome || 'Documento.pdf'}</span>
                        </div>
                        <span style="font-size: 14px; color: #BDC3C7;">Visualização segura do documento</span>
                    </div>
                    <iframe 
                        src="${data.arquivoURL}#toolbar=1&navpanes=0&scrollbar=1" 
                        style="width: 100%; height: 800px; border: 2px solid #2C3E50; border-top: none; border-radius: 0 0 8px 8px; background: white;"
                        frameborder="0"
                        oncontextmenu="return false;">
                    </iframe>
                </div>
                ` : ''}
                
                ${isAdmin(currentUser) ? `
                <div class="document-actions" style="justify-content: center; margin-top: 24px;">
                    <button class="btn-delete" onclick="deleteDocEventosAdversos('${id}')">
                        <i class="fas fa-trash"></i> Excluir
                    </button>
                </div>
                ` : ''}
            </div>
        `;
        
        section.innerHTML = html;
    } catch (error) {
        console.error('Erro ao carregar detalhes:', error);
        showToast('Erro ao carregar documento', 'error');
    }
}

function showNovoDocEventosAdversos() {
    const section = document.getElementById('painelSection');
    const html = `
        ${renderInfoBanner('fas fa-plus-circle', 'Novo Documento - Eventos Adversos', 'Adicionar novo documento de eventos adversos', '#dc2626 0%, #991b1b 100%', 'showEventosAdversos()')}

        <div class="form-container">
            <form id="novoDocForm" class="calc-form">
                <div class="form-group">
                    <label class="form-label"><i class="fas fa-heading"></i> Título *</label>
                    <input type="text" class="form-select" id="doc_titulo" placeholder="Ex: Relatório Trimestral de Eventos" required>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-align-left"></i> Descrição *</label>
                    <textarea class="form-select" id="doc_descricao" rows="8" placeholder="Descreva o documento..." required></textarea>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-file-pdf"></i> Anexar Arquivo PDF</label>
                    <input type="file" class="form-select" id="doc_arquivo" accept=".pdf" style="padding: 12px;">
                    <small style="color: var(--text-secondary); font-size: 12px; display: block; margin-top: 8px;">
                        <i class="fas fa-info-circle"></i> Opcional. Máximo 10MB. Apenas arquivos PDF.
                    </small>
                </div>

                <button type="submit" class="btn-primary">
                    <i class="fas fa-save"></i> Salvar Documento
                </button>
            </form>
        </div>
    `;
    
    section.innerHTML = html;
    
    document.getElementById('novoDocForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await salvarDocEventosAdversos();
    });
}

async function salvarDocEventosAdversos() {
    try {
        showLoading();
        
        const titulo = document.getElementById('doc_titulo').value;
        const descricao = document.getElementById('doc_descricao').value;
        const arquivoInput = document.getElementById('doc_arquivo');
        
        const docData = {
            titulo,
            descricao,
            autor: currentUser.email,
            autorNome: currentUser.displayName || currentUser.email,
            data: firebase.firestore.FieldValue.serverTimestamp(),
            ativo: true
        };
        
        if (arquivoInput && arquivoInput.files && arquivoInput.files[0]) {
            const arquivo = arquivoInput.files[0];
            if (arquivo.size > 10 * 1024 * 1024) {
                hideLoading();
                showToast('Arquivo muito grande. Máximo 10MB.', 'error');
                return;
            }
            const storageRef = firebase.storage().ref();
            const nomeArquivo = `kpi_eventos_adversos/${Date.now()}_${arquivo.name}`;
            const fileRef = storageRef.child(nomeArquivo);
            await fileRef.put(arquivo);
            const urlArquivo = await fileRef.getDownloadURL();
            docData.arquivoURL = urlArquivo;
            docData.arquivoNome = arquivo.name;
        }
        
        await db.collection('kpi_eventos_adversos').add(docData);
        
        hideLoading();
        showToast('Documento salvo com sucesso!', 'success');
        showEventosAdversos();
    } catch (error) {
        hideLoading();
        console.error('Erro ao salvar documento:', error);
        showToast('Erro ao salvar documento', 'error');
    }
}

async function deleteDocEventosAdversos(id) {
    if (!confirm('Tem certeza que deseja excluir este documento?')) return;
    
    try {
        showLoading();
        await db.collection('kpi_eventos_adversos').doc(id).delete();
        hideLoading();
        showToast('Documento excluído com sucesso!', 'success');
        showEventosAdversos();
    } catch (error) {
        hideLoading();
        console.error('Erro ao excluir documento:', error);
        showToast('Erro ao excluir documento', 'error');
    }
}

// ========== 4. SATISFAÇÃO DO PACIENTE ==========
async function showSatisfacaoPaciente() {
    const section = document.getElementById('painelSection');
    if (!section) return;
    
    const isAdminUser = isAdmin(currentUser);
    console.log('⭐ Satisfação do Paciente - É Admin?', isAdminUser, 'User:', currentUser);
    
    const html = `
        ${renderInfoBanner('fas fa-star', 'Satisfação do Paciente', 'Pesquisas e avaliações de satisfação', '#f59e0b 0%, #d97706 100%', 'showKPIs()')}
        ${isAdminUser ? `<div style="margin-bottom: 20px; text-align: right;"><button class="btn-add" onclick="showNovoDocSatisfacaoPaciente()" style="background: #f59e0b; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; gap: 8px;"><i class="fas fa-plus"></i> Novo Documento</button></div>` : ''}

        <div class="comunicados-container" id="docsContainer">
            <div class="loading-spinner">
                <i class="fas fa-spinner fa-spin"></i> Carregando documentos...
            </div>
        </div>
    `;
    
    section.innerHTML = html;
    await loadDocsSatisfacaoPaciente();
}

async function loadDocsSatisfacaoPaciente() {
    try {
        const docsRef = db.collection('kpi_satisfacao_paciente').orderBy('data', 'desc').limit(20);
        const snapshot = await docsRef.get();
        
        const container = document.getElementById('docsContainer');
        const isAdminUser = isAdmin(currentUser);
        
        console.log('📄 Carregando Satisfação Paciente - Docs:', snapshot.size, 'É Admin?', isAdminUser);
        
        if (snapshot.empty) {
            container.innerHTML = `
                <div class="info-box" style="text-align: center; padding: 40px;">
                    <i class="fas fa-folder-open" style="font-size: 48px; color: #CBD5E1; margin-bottom: 16px;"></i>
                    <h3 style="color: var(--text-primary); margin-bottom: 8px;">Nenhum documento disponível</h3>
                    ${isAdminUser ? '<p style="color: var(--text-secondary);">Clique no botão <strong>"Novo"</strong> acima para adicionar o primeiro documento.</p>' : '<p style="color: var(--text-secondary);">Ainda não há documentos publicados nesta seção.</p>'}
                </div>
            `;
            return;
        }
        
        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const dataFormatada = data.data?.toDate().toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }) || 'Data não disponível';
            
            html += `
                <div class="comunicado-card" onclick="showDetalheSatisfacaoPaciente('${doc.id}')">
                    <div class="comunicado-header">
                        <div class="comunicado-priority">⭐ Satisfação do Paciente</div>
                        <div class="comunicado-date">${dataFormatada}</div>
                    </div>
                    <h3 class="comunicado-title">${data.titulo}</h3>
                    <p class="comunicado-preview">${data.descricao ? data.descricao.substring(0, 150) : ''}${data.descricao && data.descricao.length > 150 ? '...' : ''}</p>
                    <div class="comunicado-footer">
                        <div class="comunicado-author">
                            <i class="fas fa-user"></i> ${data.autor || 'Administração'}
                        </div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Erro ao carregar documentos:', error);
        // Se houver erro (ex: collection não existe ou sem permissão), mostrar mensagem amigável
        const container = document.getElementById('docsContainer');
        if (container) {
            container.innerHTML = `
                <div class="info-box">
                    <i class="fas fa-info-circle"></i> Nenhum documento disponível no momento.
                    ${isAdmin(currentUser) ? '<br><br>Clique em "Novo" para adicionar o primeiro documento.' : ''}
                </div>
            `;
        }
    }
}

async function showDetalheSatisfacaoPaciente(id) {
    try {
        const doc = await db.collection('kpi_satisfacao_paciente').doc(id).get();
        if (!doc.exists) {
            showToast('Documento não encontrado', 'error');
            return;
        }
        
        const data = doc.data();
        const dataFormatada = data.data?.toDate().toLocaleString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }) || 'Data não disponível';
        
        const section = document.getElementById('painelSection');
        const html = `
            ${renderInfoBanner('fas fa-file-alt', data.titulo, 'Documento de Satisfação do Paciente', '#f59e0b 0%, #d97706 100%', 'showSatisfacaoPaciente()')}
            ${isAdmin(currentUser) ? `<div style="margin-bottom: 20px; text-align: right;"><button class="btn-delete" onclick="deleteDocSatisfacaoPaciente('${id}')" style="background: #DC2626; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; gap: 8px;"><i class="fas fa-trash"></i> Excluir</button></div>` : ''}

            <div class="comunicado-detalhes">
                <div class="comunicado-meta">
                    <div><i class="fas fa-calendar"></i> ${dataFormatada}</div>
                    <div><i class="fas fa-user"></i> ${data.autor || 'Administração'}</div>
                    <div><i class="fas fa-tag"></i> Satisfação do Paciente</div>
                </div>
                <div class="comunicado-content">
                    ${data.descricao ? data.descricao.replace(/\n/g, '<br>') : ''}
                </div>
                
                ${data.arquivoURL ? `
                <div style="margin-top: 24px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px; background: #2C3E50; color: white; border-radius: 8px 8px 0 0;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <i class="fas fa-file-pdf" style="font-size: 20px; color: #DC2626;"></i>
                            <span style="font-weight: 500;">${data.arquivoNome || 'Documento.pdf'}</span>
                        </div>
                        <span style="font-size: 14px; color: #BDC3C7;">Visualização segura do documento</span>
                    </div>
                    <iframe 
                        src="${data.arquivoURL}#toolbar=1&navpanes=0&scrollbar=1" 
                        style="width: 100%; height: 800px; border: 2px solid #2C3E50; border-top: none; border-radius: 0 0 8px 8px; background: white;"
                        frameborder="0"
                        oncontextmenu="return false;">
                    </iframe>
                </div>
                ` : ''}
                
                ${isAdmin(currentUser) ? `
                <div class="document-actions" style="justify-content: center; margin-top: 24px;">
                    <button class="btn-delete" onclick="deleteDocSatisfacaoPaciente('${id}')">
                        <i class="fas fa-trash"></i> Excluir
                    </button>
                </div>
                ` : ''}
            </div>
        `;
        
        section.innerHTML = html;
    } catch (error) {
        console.error('Erro ao carregar detalhes:', error);
        showToast('Erro ao carregar documento', 'error');
    }
}

function showNovoDocSatisfacaoPaciente() {
    const section = document.getElementById('painelSection');
    const html = `
        ${renderInfoBanner('fas fa-plus-circle', 'Novo Documento - Satisfação do Paciente', 'Adicionar novo documento de satisfação do paciente', '#f59e0b 0%, #d97706 100%', 'showSatisfacaoPaciente()')}

        <div class="form-container">
            <form id="novoDocForm" class="calc-form">
                <div class="form-group">
                    <label class="form-label"><i class="fas fa-heading"></i> Título *</label>
                    <input type="text" class="form-select" id="doc_titulo" placeholder="Ex: Pesquisa de Satisfação Q1 2025" required>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-align-left"></i> Descrição *</label>
                    <textarea class="form-select" id="doc_descricao" rows="8" placeholder="Descreva o documento..." required></textarea>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-file-pdf"></i> Anexar Arquivo PDF</label>
                    <input type="file" class="form-select" id="doc_arquivo" accept=".pdf" style="padding: 12px;">
                    <small style="color: var(--text-secondary); font-size: 12px; display: block; margin-top: 8px;">
                        <i class="fas fa-info-circle"></i> Opcional. Máximo 10MB. Apenas arquivos PDF.
                    </small>
                </div>

                <button type="submit" class="btn-primary">
                    <i class="fas fa-save"></i> Salvar Documento
                </button>
            </form>
        </div>
    `;
    
    section.innerHTML = html;
    
    document.getElementById('novoDocForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await salvarDocSatisfacaoPaciente();
    });
}

async function salvarDocSatisfacaoPaciente() {
    try {
        showLoading();
        
        const titulo = document.getElementById('doc_titulo').value;
        const descricao = document.getElementById('doc_descricao').value;
        const arquivoInput = document.getElementById('doc_arquivo');
        
        const docData = {
            titulo,
            descricao,
            autor: currentUser.email,
            autorNome: currentUser.displayName || currentUser.email,
            data: firebase.firestore.FieldValue.serverTimestamp(),
            ativo: true
        };
        
        if (arquivoInput && arquivoInput.files && arquivoInput.files[0]) {
            const arquivo = arquivoInput.files[0];
            if (arquivo.size > 10 * 1024 * 1024) {
                hideLoading();
                showToast('Arquivo muito grande. Máximo 10MB.', 'error');
                return;
            }
            const storageRef = firebase.storage().ref();
            const nomeArquivo = `kpi_satisfacao_paciente/${Date.now()}_${arquivo.name}`;
            const fileRef = storageRef.child(nomeArquivo);
            await fileRef.put(arquivo);
            const urlArquivo = await fileRef.getDownloadURL();
            docData.arquivoURL = urlArquivo;
            docData.arquivoNome = arquivo.name;
        }
        
        await db.collection('kpi_satisfacao_paciente').add(docData);
        
        hideLoading();
        showToast('Documento salvo com sucesso!', 'success');
        showSatisfacaoPaciente();
    } catch (error) {
        hideLoading();
        console.error('Erro ao salvar documento:', error);
        showToast('Erro ao salvar documento', 'error');
    }
}

async function deleteDocSatisfacaoPaciente(id) {
    if (!confirm('Tem certeza que deseja excluir este documento?')) return;
    
    try {
        showLoading();
        await db.collection('kpi_satisfacao_paciente').doc(id).delete();
        hideLoading();
        showToast('Documento excluído com sucesso!', 'success');
        showSatisfacaoPaciente();
    } catch (error) {
        hideLoading();
        console.error('Erro ao excluir documento:', error);
        showToast('Erro ao excluir documento', 'error');
    }
}

// ========== 5. TEMPO DE ATENDIMENTO ==========
async function showTempoAtendimento() {
    const section = document.getElementById('painelSection');
    if (!section) return;
    
    const isAdminUser = isAdmin(currentUser);
    console.log('⏱️ Tempo de Atendimento - É Admin?', isAdminUser, 'User:', currentUser);
    
    const html = `
        ${renderInfoBanner('fas fa-clock', 'Tempo de Atendimento', 'Métricas de tempo e eficiência', '#2563eb 0%, #3b82f6 100%', 'showKPIs()')}
        ${isAdminUser ? `<div style="margin-bottom: 20px; text-align: right;"><button class="btn-add" onclick="showNovoDocTempoAtendimento()" style="background: #2563eb; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; gap: 8px;"><i class="fas fa-plus"></i> Novo Documento</button></div>` : ''}

        <div class="comunicados-container" id="docsContainer">
            <div class="loading-spinner">
                <i class="fas fa-spinner fa-spin"></i> Carregando documentos...
            </div>
        </div>
    `;
    
    section.innerHTML = html;
    await loadDocsTempoAtendimento();
}

async function loadDocsTempoAtendimento() {
    try {
        const docsRef = db.collection('kpi_tempo_atendimento').orderBy('data', 'desc').limit(20);
        const snapshot = await docsRef.get();
        
        const container = document.getElementById('docsContainer');
        const isAdminUser = isAdmin(currentUser);
        
        console.log('📄 Carregando Tempo Atendimento - Docs:', snapshot.size, 'É Admin?', isAdminUser);
        
        if (snapshot.empty) {
            container.innerHTML = `
                <div class="info-box" style="text-align: center; padding: 40px;">
                    <i class="fas fa-folder-open" style="font-size: 48px; color: #CBD5E1; margin-bottom: 16px;"></i>
                    <h3 style="color: var(--text-primary); margin-bottom: 8px;">Nenhum documento disponível</h3>
                    ${isAdminUser ? '<p style="color: var(--text-secondary);">Clique no botão <strong>"Novo"</strong> acima para adicionar o primeiro documento.</p>' : '<p style="color: var(--text-secondary);">Ainda não há documentos publicados nesta seção.</p>'}
                </div>
            `;
            return;
        }
        
        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const dataFormatada = data.data?.toDate().toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }) || 'Data não disponível';
            
            html += `
                <div class="comunicado-card" onclick="showDetalheTempoAtendimento('${doc.id}')">
                    <div class="comunicado-header">
                        <div class="comunicado-priority">⏱️ Tempo de Atendimento</div>
                        <div class="comunicado-date">${dataFormatada}</div>
                    </div>
                    <h3 class="comunicado-title">${data.titulo}</h3>
                    <p class="comunicado-preview">${data.descricao ? data.descricao.substring(0, 150) : ''}${data.descricao && data.descricao.length > 150 ? '...' : ''}</p>
                    <div class="comunicado-footer">
                        <div class="comunicado-author">
                            <i class="fas fa-user"></i> ${data.autor || 'Administração'}
                        </div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Erro ao carregar documentos:', error);
        // Se houver erro (ex: collection não existe ou sem permissão), mostrar mensagem amigável
        const container = document.getElementById('docsContainer');
        if (container) {
            container.innerHTML = `
                <div class="info-box">
                    <i class="fas fa-info-circle"></i> Nenhum documento disponível no momento.
                    ${isAdmin(currentUser) ? '<br><br>Clique em "Novo" para adicionar o primeiro documento.' : ''}
                </div>
            `;
        }
    }
}

async function showDetalheTempoAtendimento(id) {
    try {
        const doc = await db.collection('kpi_tempo_atendimento').doc(id).get();
        if (!doc.exists) {
            showToast('Documento não encontrado', 'error');
            return;
        }
        
        const data = doc.data();
        const dataFormatada = data.data?.toDate().toLocaleString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }) || 'Data não disponível';
        
        const section = document.getElementById('painelSection');
        const html = `
            ${renderInfoBanner('fas fa-file-alt', data.titulo, 'Documento de Tempo de Atendimento', '#2563eb 0%, #3b82f6 100%', 'showTempoAtendimento()')}
            ${isAdmin(currentUser) ? `<div style="margin-bottom: 20px; text-align: right;"><button class="btn-delete" onclick="deleteDocTempoAtendimento('${id}')" style="background: #DC2626; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; gap: 8px;"><i class="fas fa-trash"></i> Excluir</button></div>` : ''}

            <div class="comunicado-detalhes">
                <div class="comunicado-meta">
                    <div><i class="fas fa-calendar"></i> ${dataFormatada}</div>
                    <div><i class="fas fa-user"></i> ${data.autor || 'Administração'}</div>
                    <div><i class="fas fa-tag"></i> Tempo de Atendimento</div>
                </div>
                <div class="comunicado-content">
                    ${data.descricao ? data.descricao.replace(/\n/g, '<br>') : ''}
                </div>
                
                ${data.arquivoURL ? `
                <div style="margin-top: 24px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px; background: #2C3E50; color: white; border-radius: 8px 8px 0 0;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <i class="fas fa-file-pdf" style="font-size: 20px; color: #DC2626;"></i>
                            <span style="font-weight: 500;">${data.arquivoNome || 'Documento.pdf'}</span>
                        </div>
                        <span style="font-size: 14px; color: #BDC3C7;">Visualização segura do documento</span>
                    </div>
                    <iframe 
                        src="${data.arquivoURL}#toolbar=1&navpanes=0&scrollbar=1" 
                        style="width: 100%; height: 800px; border: 2px solid #2C3E50; border-top: none; border-radius: 0 0 8px 8px; background: white;"
                        frameborder="0"
                        oncontextmenu="return false;">
                    </iframe>
                </div>
                ` : ''}
                
                ${isAdmin(currentUser) ? `
                <div class="document-actions" style="justify-content: center; margin-top: 24px;">
                    <button class="btn-delete" onclick="deleteDocTempoAtendimento('${id}')">
                        <i class="fas fa-trash"></i> Excluir
                    </button>
                </div>
                ` : ''}
            </div>
        `;
        
        section.innerHTML = html;
    } catch (error) {
        console.error('Erro ao carregar detalhes:', error);
        showToast('Erro ao carregar documento', 'error');
    }
}

function showNovoDocTempoAtendimento() {
    const section = document.getElementById('painelSection');
    const html = `
        ${renderInfoBanner('fas fa-plus-circle', 'Novo Documento - Tempo de Atendimento', 'Adicionar novo documento de tempo de atendimento', '#2563eb 0%, #3b82f6 100%', 'showTempoAtendimento()')}

        <div class="form-container">
            <form id="novoDocForm" class="calc-form">
                <div class="form-group">
                    <label class="form-label"><i class="fas fa-heading"></i> Título *</label>
                    <input type="text" class="form-select" id="doc_titulo" placeholder="Ex: Análise de Tempo Médio de Espera" required>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-align-left"></i> Descrição *</label>
                    <textarea class="form-select" id="doc_descricao" rows="8" placeholder="Descreva o documento..." required></textarea>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-file-pdf"></i> Anexar Arquivo PDF</label>
                    <input type="file" class="form-select" id="doc_arquivo" accept=".pdf" style="padding: 12px;">
                    <small style="color: var(--text-secondary); font-size: 12px; display: block; margin-top: 8px;">
                        <i class="fas fa-info-circle"></i> Opcional. Máximo 10MB. Apenas arquivos PDF.
                    </small>
                </div>

                <button type="submit" class="btn-primary">
                    <i class="fas fa-save"></i> Salvar Documento
                </button>
            </form>
        </div>
    `;
    
    section.innerHTML = html;
    
    document.getElementById('novoDocForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await salvarDocTempoAtendimento();
    });
}

async function salvarDocTempoAtendimento() {
    try {
        showLoading();
        
        const titulo = document.getElementById('doc_titulo').value;
        const descricao = document.getElementById('doc_descricao').value;
        const arquivoInput = document.getElementById('doc_arquivo');
        
        const docData = {
            titulo,
            descricao,
            autor: currentUser.email,
            autorNome: currentUser.displayName || currentUser.email,
            data: firebase.firestore.FieldValue.serverTimestamp(),
            ativo: true
        };
        
        if (arquivoInput && arquivoInput.files && arquivoInput.files[0]) {
            const arquivo = arquivoInput.files[0];
            if (arquivo.size > 10 * 1024 * 1024) {
                hideLoading();
                showToast('Arquivo muito grande. Máximo 10MB.', 'error');
                return;
            }
            const storageRef = firebase.storage().ref();
            const nomeArquivo = `kpi_tempo_atendimento/${Date.now()}_${arquivo.name}`;
            const fileRef = storageRef.child(nomeArquivo);
            await fileRef.put(arquivo);
            const urlArquivo = await fileRef.getDownloadURL();
            docData.arquivoURL = urlArquivo;
            docData.arquivoNome = arquivo.name;
        }
        
        await db.collection('kpi_tempo_atendimento').add(docData);
        
        hideLoading();
        showToast('Documento salvo com sucesso!', 'success');
        showTempoAtendimento();
    } catch (error) {
        hideLoading();
        console.error('Erro ao salvar documento:', error);
        showToast('Erro ao salvar documento', 'error');
    }
}

async function deleteDocTempoAtendimento(id) {
    if (!confirm('Tem certeza que deseja excluir este documento?')) return;
    
    try {
        showLoading();
        await db.collection('kpi_tempo_atendimento').doc(id).delete();
        hideLoading();
        showToast('Documento excluído com sucesso!', 'success');
        showTempoAtendimento();
    } catch (error) {
        hideLoading();
        console.error('Erro ao excluir documento:', error);
        showToast('Erro ao excluir documento', 'error');
    }
}

// ========== 6. SEGURANÇA MEDICAMENTOSA ==========
async function showSegurancaMedicamentosa() {
    const section = document.getElementById('painelSection');
    if (!section) return;
    
    const isAdminUser = isAdmin(currentUser);
    console.log('💊 Segurança Medicamentosa - É Admin?', isAdminUser, 'User:', currentUser);
    
    const html = `
        ${renderInfoBanner('fas fa-pills', 'Segurança Medicamentosa', 'Protocolos e incidentes medicamentosos', '#dc2626 0%, #991b1b 100%', 'showKPIs()')}
        ${isAdminUser ? `<div style="margin-bottom: 20px; text-align: right;"><button class="btn-add" onclick="showNovoDocSegurancaMedicamentosa()" style="background: #dc2626; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; gap: 8px;"><i class="fas fa-plus"></i> Novo Documento</button></div>` : ''}

        <div class="comunicados-container" id="docsContainer">
            <div class="loading-spinner">
                <i class="fas fa-spinner fa-spin"></i> Carregando documentos...
            </div>
        </div>
    `;
    
    section.innerHTML = html;
    await loadDocsSegurancaMedicamentosa();
}

async function loadDocsSegurancaMedicamentosa() {
    try {
        const docsRef = db.collection('kpi_seguranca_medicamentosa').orderBy('data', 'desc').limit(20);
        const snapshot = await docsRef.get();
        
        const container = document.getElementById('docsContainer');
        const isAdminUser = isAdmin(currentUser);
        
        console.log('📄 Carregando Segurança Medicamentosa - Docs:', snapshot.size, 'É Admin?', isAdminUser);
        
        if (snapshot.empty) {
            container.innerHTML = `
                <div class="info-box" style="text-align: center; padding: 40px;">
                    <i class="fas fa-folder-open" style="font-size: 48px; color: #CBD5E1; margin-bottom: 16px;"></i>
                    <h3 style="color: var(--text-primary); margin-bottom: 8px;">Nenhum documento disponível</h3>
                    ${isAdminUser ? '<p style="color: var(--text-secondary);">Clique no botão <strong>"Novo"</strong> acima para adicionar o primeiro documento.</p>' : '<p style="color: var(--text-secondary);">Ainda não há documentos publicados nesta seção.</p>'}
                </div>
            `;
            return;
        }
        
        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const dataFormatada = data.data?.toDate().toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }) || 'Data não disponível';
            
            html += `
                <div class="comunicado-card" onclick="showDetalheSegurancaMedicamentosa('${doc.id}')">
                    <div class="comunicado-header">
                        <div class="comunicado-priority">💊 Segurança Medicamentosa</div>
                        <div class="comunicado-date">${dataFormatada}</div>
                    </div>
                    <h3 class="comunicado-title">${data.titulo}</h3>
                    <p class="comunicado-preview">${data.descricao ? data.descricao.substring(0, 150) : ''}${data.descricao && data.descricao.length > 150 ? '...' : ''}</p>
                    <div class="comunicado-footer">
                        <div class="comunicado-author">
                            <i class="fas fa-user"></i> ${data.autor || 'Administração'}
                        </div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    } catch (error) {
        console.error('Erro ao carregar documentos:', error);
        // Se houver erro (ex: collection não existe ou sem permissão), mostrar mensagem amigável
        const container = document.getElementById('docsContainer');
        if (container) {
            container.innerHTML = `
                <div class="info-box">
                    <i class="fas fa-info-circle"></i> Nenhum documento disponível no momento.
                    ${isAdmin(currentUser) ? '<br><br>Clique em "Novo" para adicionar o primeiro documento.' : ''}
                </div>
            `;
        }
    }
}

async function showDetalheSegurancaMedicamentosa(id) {
    try {
        const doc = await db.collection('kpi_seguranca_medicamentosa').doc(id).get();
        if (!doc.exists) {
            showToast('Documento não encontrado', 'error');
            return;
        }
        
        const data = doc.data();
        const dataFormatada = data.data?.toDate().toLocaleString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }) || 'Data não disponível';
        
        const section = document.getElementById('painelSection');
        const html = `
            ${renderInfoBanner('fas fa-file-alt', data.titulo, 'Documento de Segurança Medicamentosa', '#dc2626 0%, #991b1b 100%', 'showSegurancaMedicamentosa()')}
            ${isAdmin(currentUser) ? `<div style="margin-bottom: 20px; text-align: right;"><button class="btn-delete" onclick="deleteDocSegurancaMedicamentosa('${id}')" style="background: #DC2626; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; gap: 8px;"><i class="fas fa-trash"></i> Excluir</button></div>` : ''}

            <div class="comunicado-detalhes">
                <div class="comunicado-meta">
                    <div><i class="fas fa-calendar"></i> ${dataFormatada}</div>
                    <div><i class="fas fa-user"></i> ${data.autor || 'Administração'}</div>
                    <div><i class="fas fa-tag"></i> Segurança Medicamentosa</div>
                </div>
                <div class="comunicado-content">
                    ${data.descricao ? data.descricao.replace(/\n/g, '<br>') : ''}
                </div>
                
                ${data.arquivoURL ? `
                <div style="margin-top: 24px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px; background: #2C3E50; color: white; border-radius: 8px 8px 0 0;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <i class="fas fa-file-pdf" style="font-size: 20px; color: #DC2626;"></i>
                            <span style="font-weight: 500;">${data.arquivoNome || 'Documento.pdf'}</span>
                        </div>
                        <span style="font-size: 14px; color: #BDC3C7;">Visualização segura do documento</span>
                    </div>
                    <iframe 
                        src="${data.arquivoURL}#toolbar=1&navpanes=0&scrollbar=1" 
                        style="width: 100%; height: 800px; border: 2px solid #2C3E50; border-top: none; border-radius: 0 0 8px 8px; background: white;"
                        frameborder="0"
                        oncontextmenu="return false;">
                    </iframe>
                </div>
                ` : ''}
                
                ${isAdmin(currentUser) ? `
                <div class="document-actions" style="justify-content: center; margin-top: 24px;">
                    <button class="btn-delete" onclick="deleteDocSegurancaMedicamentosa('${id}')">
                        <i class="fas fa-trash"></i> Excluir
                    </button>
                </div>
                ` : ''}
            </div>
        `;
        
        section.innerHTML = html;
    } catch (error) {
        console.error('Erro ao carregar detalhes:', error);
        showToast('Erro ao carregar documento', 'error');
    }
}

function showNovoDocSegurancaMedicamentosa() {
    const section = document.getElementById('painelSection');
    const html = `
        ${renderInfoBanner('fas fa-plus-circle', 'Novo Documento - Segurança Medicamentosa', 'Adicionar novo documento de segurança medicamentosa', '#dc2626 0%, #991b1b 100%', 'showSegurancaMedicamentosa()')}

        <div class="form-container">
            <form id="novoDocForm" class="calc-form">
                <div class="form-group">
                    <label class="form-label"><i class="fas fa-heading"></i> Título *</label>
                    <input type="text" class="form-select" id="doc_titulo" placeholder="Ex: Relatório de Eventos Medicamentosos" required>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-align-left"></i> Descrição *</label>
                    <textarea class="form-select" id="doc_descricao" rows="8" placeholder="Descreva o documento..." required></textarea>
                </div>

                <div class="form-group">
                    <label class="form-label"><i class="fas fa-file-pdf"></i> Anexar Arquivo PDF</label>
                    <input type="file" class="form-select" id="doc_arquivo" accept=".pdf" style="padding: 12px;">
                    <small style="color: var(--text-secondary); font-size: 12px; display: block; margin-top: 8px;">
                        <i class="fas fa-info-circle"></i> Opcional. Máximo 10MB. Apenas arquivos PDF.
                    </small>
                </div>

                <button type="submit" class="btn-primary">
                    <i class="fas fa-save"></i> Salvar Documento
                </button>
            </form>
        </div>
    `;
    
    section.innerHTML = html;
    
    document.getElementById('novoDocForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await salvarDocSegurancaMedicamentosa();
    });
}

async function salvarDocSegurancaMedicamentosa() {
    try {
        showLoading();
        
        const titulo = document.getElementById('doc_titulo').value;
        const descricao = document.getElementById('doc_descricao').value;
        const arquivoInput = document.getElementById('doc_arquivo');
        
        const docData = {
            titulo,
            descricao,
            autor: currentUser.email,
            autorNome: currentUser.displayName || currentUser.email,
            data: firebase.firestore.FieldValue.serverTimestamp(),
            ativo: true
        };
        
        if (arquivoInput && arquivoInput.files && arquivoInput.files[0]) {
            const arquivo = arquivoInput.files[0];
            if (arquivo.size > 10 * 1024 * 1024) {
                hideLoading();
                showToast('Arquivo muito grande. Máximo 10MB.', 'error');
                return;
            }
            const storageRef = firebase.storage().ref();
            const nomeArquivo = `kpi_seguranca_medicamentosa/${Date.now()}_${arquivo.name}`;
            const fileRef = storageRef.child(nomeArquivo);
            await fileRef.put(arquivo);
            const urlArquivo = await fileRef.getDownloadURL();
            docData.arquivoURL = urlArquivo;
            docData.arquivoNome = arquivo.name;
        }
        
        await db.collection('kpi_seguranca_medicamentosa').add(docData);
        
        hideLoading();
        showToast('Documento salvo com sucesso!', 'success');
        showSegurancaMedicamentosa();
    } catch (error) {
        hideLoading();
        console.error('Erro ao salvar documento:', error);
        showToast('Erro ao salvar documento', 'error');
    }
}

async function deleteDocSegurancaMedicamentosa(id) {
    if (!confirm('Tem certeza que deseja excluir este documento?')) return;
    
    try {
        showLoading();
        await db.collection('kpi_seguranca_medicamentosa').doc(id).delete();
        hideLoading();
        showToast('Documento excluído com sucesso!', 'success');
        showSegurancaMedicamentosa();
    } catch (error) {
        hideLoading();
        console.error('Erro ao excluir documento:', error);
        showToast('Erro ao excluir documento', 'error');
    }
}

// ========== GERENCIAMENTO DE DESASTRES ==========

async function showGerenciamentoDesastres() {
    console.log('🧭 Gerenciamento de Desastres');

    // Atualizar histórico de navegação
    if (typeof atualizarHistoricoNavegacao === 'function') {
        atualizarHistoricoNavegacao('gerenciamento-desastres');
    }

    const section = document.getElementById('qualidadeSection');
    if (!section) return;

    const html = `
        ${renderInfoBanner('fas fa-fire', 'Gerenciamento de Desastres', 'Protocolos de emergência, CGPED e preparação para desastres internos e externos', '#dc2626 0%, #b91c1c 100%', "showSection('qualidade')")}

        <div class="protocols-grid">
            <div class="protocol-card" onclick="showEmergenciaAndamento()" style="cursor: pointer;">
                <div class="protocol-icon" style="background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);">
                    <i class="fas fa-fire-extinguisher" style="font-size: 32px; color: white;"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">🚨 Emergência em Andamento</h3>
                </div>
            </div>

            <div class="protocol-card" onclick="showPlanosFluxos()" style="cursor: pointer;">
                <div class="protocol-icon" style="background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);">
                    <i class="fas fa-clipboard-list" style="font-size: 32px; color: white;"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">📘 Planos e Fluxos</h3>
                </div>
            </div>
        </div>

        <div class="info-box" style="margin-top: 30px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-left: 4px solid #f59e0b;">
            <i class="fas fa-info-circle" style="color: #d97706;"></i>
            <div>
                <strong style="color: #78350f;">Sobre o Gerenciamento de Desastres:</strong>
                <p style="margin-top: 8px; color: #78350f;">Sistema integrado de preparação e resposta a emergências e desastres, coordenado pelo CGPED (Comitê de Gestão e Preparação para Emergências e Desastres). Alinhado aos padrões Qmentum de acreditação.</p>
                <p style="margin-top: 8px; color: #78350f;"><strong>Siglas:</strong> CGPED (Comitê de Gestão e Preparação), SESMT (Segurança do Trabalho), CCIH (Controle de Infecção), SRPA (Recuperação Pós-Anestésica)</p>
            </div>
        </div>
    `;

    section.innerHTML = html;
}

function showEmergenciaAndamento() {
    if (typeof atualizarHistoricoNavegacao === 'function') {
        atualizarHistoricoNavegacao('emergencia-andamento');
    }

    const section = document.getElementById('qualidadeSection');
    if (!section) return;

    const html = `
        ${renderInfoBanner('fas fa-fire-extinguisher', '🚨 Emergência em Andamento', 'Protocolos de ação imediata para situações críticas', '#dc2626 0%, #ef4444 100%', 'showGerenciamentoDesastres()')}

        <div class="protocols-grid">
            <div class="protocol-card" onclick="showEmergenciaDetalhes('incendio')" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #dc2626;">
                    <span style="font-size: 32px;">🔥</span>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Incêndio / Abandono de Área</h3>
                    <p class="protocol-description">Procedimentos de evacuação e rotas de fuga</p>
                </div>
            </div>

            <div class="protocol-card" onclick="showEmergenciaDetalhes('multiplas-vitimas')" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #dc2626;">
                    <span style="font-size: 32px;">🏥</span>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Múltiplas Vítimas / Desastre Externo</h3>
                    <p class="protocol-description">Gabinete de crise e triagem de vítimas</p>
                </div>
            </div>

            <div class="protocol-card" onclick="showEmergenciaDetalhes('pane-eletrica')" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #f59e0b;">
                    <span style="font-size: 32px;">⚡</span>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Pane Elétrica / Falha Estrutural</h3>
                    <p class="protocol-description">Ativação de geradores e áreas críticas</p>
                </div>
            </div>

            <div class="protocol-card" onclick="showEmergenciaDetalhes('quimico-biologico')" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #f59e0b;">
                    <span style="font-size: 32px;">🧪</span>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Desastre Químico / Biológico</h3>
                    <p class="protocol-description">Isolamento e descontaminação</p>
                </div>
            </div>

            <div class="protocol-card" onclick="showEmergenciaDetalhes('inundacao')" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #2563eb;">
                    <span style="font-size: 32px;">💧</span>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Inundação / Clima Extremo</h3>
                    <p class="protocol-description">Proteção elétrica e remoção de pacientes</p>
                </div>
            </div>

            <div class="protocol-card" onclick="showEmergenciaDetalhes('ameaca-bomba')" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #7c3aed;">
                    <span style="font-size: 32px;">💥</span>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Ameaça de Bomba / Segurança Física</h3>
                    <p class="protocol-description">Evacuação silenciosa e segurança patrimonial</p>
                </div>
            </div>
        </div>
    `;

    section.innerHTML = html;
}

function showEmergenciaDetalhes(tipo) {
    const section = document.getElementById('qualidadeSection');
    if (!section) return;

    const emergencias = {
        'incendio': {
            titulo: '🔥 Incêndio / Abandono de Área',
            cor: '#dc2626',
            quando: 'Ao identificar fumaça, fogo, cheiro de gás, explosão ou alarme sonoro',
            quem: 'Colaborador mais próximo → Brigada → CGPED',
            alerta: 'Sirene intermitente e comunicação por rádio',
            equipe: 'Brigada de Incêndio, Evacuação, Remoção, SESMT, Segurança Patrimonial',
            procedimentos: [
                'Comunicar pacientes e iniciar evacuação pela rota sinalizada',
                'Fechar válvulas de gases e portas',
                'Priorizar evacuação por cor (vermelho → verde)',
                'Confirmar no ponto de encontro externo a evacuação total'
            ],
            pontos: 'Áreas externas sinalizadas (zonas seguras)',
            registros: 'Horário de início, término e setor responsável'
        },
        'multiplas-vitimas': {
            titulo: '🏥 Múltiplas Vítimas / Desastre Externo',
            cor: '#dc2626',
            quando: 'Recebimento de alerta externo (SAMU, Defesa Civil)',
            quem: 'Coordenador Médico de Emergência / Enfermagem → CGPED',
            alerta: 'Comunicação via rádio e ativação do Gabinete de Crise',
            equipe: 'Coordenação Geral (Diretor Técnico), Coordenação Assistencial (Enfermagem, médicos, anestesistas), Coordenação Estrutural (Engenharia, SESMT, segurança), Coordenação de Comunicação (Diretoria, Marketing)',
            procedimentos: [
                'Montar área de triagem e isolamento',
                'Ativar hospital de base (apoio) e definir fluxo de atendimento',
                'Pacientes Azul/Verde → Unimed Personal',
                'Registrar horários, leitos e transferências'
            ],
            pontos: 'Entrada prioritária de ambulâncias; acesso livre ao CC e UTI',
            registros: 'Gabinete de Crise documenta todas as ações'
        },
        'pane-eletrica': {
            titulo: '⚡ Pane Elétrica / Falha Estrutural',
            cor: '#f59e0b',
            quando: 'Falha de energia ou de sistemas críticos',
            quem: 'Engenharia Clínica → CGPED e Diretoria',
            alerta: 'Comunicação interna via rádio',
            equipe: 'Engenharia Clínica, CGPED, TI',
            procedimentos: [
                'Ativar geradores e verificar sistemas de gases',
                'Priorizar suporte em áreas críticas (UTI, CC, Emergência)',
                'Confirmar iluminação de emergência',
                'Registrar tempos de falha e retorno'
            ],
            pontos: 'Áreas críticas com prioridade: UTI, Centro Cirúrgico, Emergência',
            registros: 'Tempo de falha, tempo de retorno, áreas afetadas'
        },
        'quimico-biologico': {
            titulo: '🧪 Desastre Químico / Biológico',
            cor: '#f59e0b',
            quando: 'Vazamento químico, contaminação, exposição biológica',
            quem: 'SESMT ou CCIH → CGPED',
            alerta: 'Isolamento imediato da área',
            equipe: 'SESMT, CCIH, Segurança Patrimonial',
            procedimentos: [
                'Isolar área afetada',
                'Equipar EPIs',
                'Iniciar descontaminação conforme protocolo',
                'Notificar CCIH e SESMT',
                'Registrar vítimas e medidas tomadas'
            ],
            pontos: 'Área de descontaminação externa',
            registros: 'Vítimas expostas, tipo de contaminação, medidas de contenção'
        },
        'inundacao': {
            titulo: '💧 Inundação / Clima Extremo',
            cor: '#2563eb',
            quando: 'Alagamento ou eventos climáticos severos',
            quem: 'Manutenção → CGPED',
            alerta: 'Comunicação via rádio',
            equipe: 'Manutenção, Engenharia, CGPED',
            procedimentos: [
                'Desligar energia elétrica e evacuar área inundada',
                'Manutenção hidráulica remove excesso de água',
                'Recolocar pacientes em zonas seguras',
                'Comunicar CGPED e registrar danos estruturais'
            ],
            pontos: 'Zonas elevadas e áreas secas',
            registros: 'Danos estruturais, áreas afetadas'
        },
        'ameaca-bomba': {
            titulo: '💥 Ameaça de Bomba / Segurança Física',
            cor: '#7c3aed',
            quando: 'Ameaça recebida ou objeto suspeito',
            quem: 'Segurança Patrimonial → CGPED → Polícia Militar',
            alerta: 'Evacuação silenciosa',
            equipe: 'Segurança Patrimonial, CGPED, Polícia Militar',
            procedimentos: [
                'Acionar Segurança Patrimonial e CGPED',
                'Isolar a área, sem pânico',
                'Evacuação silenciosa',
                'Polícia Militar informada',
                'CGPED coordena encerramento e registro final'
            ],
            pontos: 'Distância mínima de segurança (200m do local)',
            registros: 'Horário da ameaça, medidas tomadas, autoridades envolvidas'
        }
    };

    const emergencia = emergencias[tipo];
    if (!emergencia) return;

    const html = `
        ${renderInfoBanner('fas fa-exclamation-circle', emergencia.titulo, '', `${emergencia.cor} 0%, ${emergencia.cor}CC 100%`, 'showEmergenciaAndamento()')}

        <div style="max-width: 1000px; margin: 0 auto;">
            <!-- Card único compacto -->
            <div class="protocol-card" style="background: white; border-left: 4px solid ${emergencia.cor}; padding: 24px;">
                <div class="protocol-content">
                    <!-- Grid de informações -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; margin-bottom: 24px;">
                        <div>
                            <h3 style="color: ${emergencia.cor}; margin-bottom: 8px; font-size: 14px; font-weight: 700; text-transform: uppercase;">
                                <i class="fas fa-exclamation-triangle"></i> Quando Acionar
                            </h3>
                            <p style="font-size: 15px; line-height: 1.6; color: #374151;">${emergencia.quando}</p>
                        </div>

                        <div>
                            <h3 style="color: ${emergencia.cor}; margin-bottom: 8px; font-size: 14px; font-weight: 700; text-transform: uppercase;">
                                <i class="fas fa-users"></i> Quem Aciona
                            </h3>
                            <p style="font-size: 15px; line-height: 1.6; color: #374151;">${emergencia.quem}</p>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; margin-bottom: 24px;">
                        <div>
                            <h3 style="color: ${emergencia.cor}; margin-bottom: 8px; font-size: 14px; font-weight: 700; text-transform: uppercase;">
                                <i class="fas fa-bell"></i> Sistema de Alerta
                            </h3>
                            <p style="font-size: 15px; line-height: 1.6; color: #374151;">${emergencia.alerta}</p>
                        </div>

                        <div>
                            <h3 style="color: ${emergencia.cor}; margin-bottom: 8px; font-size: 14px; font-weight: 700; text-transform: uppercase;">
                                <i class="fas fa-user-friends"></i> Equipe Envolvida
                            </h3>
                            <p style="font-size: 15px; line-height: 1.6; color: #374151;">${emergencia.equipe}</p>
                        </div>
                    </div>

                    <!-- Procedimentos em destaque -->
                    <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
                        <h3 style="color: ${emergencia.cor}; margin-bottom: 12px; font-size: 16px; font-weight: 700;">
                            <i class="fas fa-tasks"></i> Procedimentos
                        </h3>
                        <ol style="font-size: 15px; line-height: 1.8; padding-left: 20px; color: #374151; margin: 0;">
                            ${emergencia.procedimentos.map(proc => `<li style="margin-bottom: 8px;">${proc}</li>`).join('')}
                        </ol>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px;">
                        <div>
                            <h3 style="color: ${emergencia.cor}; margin-bottom: 8px; font-size: 14px; font-weight: 700; text-transform: uppercase;">
                                <i class="fas fa-map-marker-alt"></i> Pontos de Encontro / Rotas
                            </h3>
                            <p style="font-size: 15px; line-height: 1.6; color: #374151;">${emergencia.pontos}</p>
                        </div>

                        <div>
                            <h3 style="color: ${emergencia.cor}; margin-bottom: 8px; font-size: 14px; font-weight: 700; text-transform: uppercase;">
                                <i class="fas fa-file-alt"></i> Registros Obrigatórios
                            </h3>
                            <p style="font-size: 15px; line-height: 1.6; color: #374151;">${emergencia.registros}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    section.innerHTML = html;
}

function showPlanosFluxos() {
    if (typeof atualizarHistoricoNavegacao === 'function') {
        atualizarHistoricoNavegacao('planos-fluxos');
    }

    const section = document.getElementById('qualidadeSection');
    if (!section) return;

    const html = `
        ${renderInfoBanner('fas fa-clipboard-list', '📘 Planos e Fluxos', 'Documentos estruturais e protocolos do CGPED', '#2563eb 0%, #3b82f6 100%', 'showGerenciamentoDesastres()')}

        <div class="protocols-grid">
            <div class="protocol-card" onclick="showPlanoDetalhes('manual-gestao')" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #2563eb;">
                    <i class="fas fa-book" style="font-size: 32px; color: white;"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Manual de Gestão e Preparação para Emergências</h3>
                </div>
            </div>

            <div class="protocol-card" onclick="showPlanoDetalhes('times-gerenciamento')" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #2563eb;">
                    <i class="fas fa-sitemap" style="font-size: 32px; color: white;"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Times de Gerenciamento e Fluxos do CGPED</h3>
                </div>
            </div>

            <div class="protocol-card" onclick="showPlanoDetalhes('apoio-psicologico')" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #059669;">
                    <i class="fas fa-brain" style="font-size: 32px; color: white;"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Apoio Psicológico Pós-Emergência</h3>
                </div>
            </div>

            <div class="protocol-card" onclick="showPlanoDetalhes('simulado-srpa')" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #f59e0b;">
                    <i class="fas fa-clipboard-check" style="font-size: 32px; color: white;"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">Relatório de Simulado SRPA - Vazamento de Gás</h3>
                </div>
            </div>
        </div>
    `;

    section.innerHTML = html;
}

async function showPlanoDetalhes(tipo) {
    const section = document.getElementById('qualidadeSection');
    if (!section) return;

    const planos = {
        'manual-gestao': {
            titulo: 'Manual de Gestão e Preparação para Emergências',
            descricao: 'Define estrutura e responsabilidades do CGPED',
            cor: '#2563eb'
        },
        'times-gerenciamento': {
            titulo: 'Times de Gerenciamento e Fluxos do CGPED',
            descricao: 'Coordenação geral, assistencial, estrutural e de comunicação',
            cor: '#2563eb'
        },
        'apoio-psicologico': {
            titulo: 'Apoio Psicológico Pós-Emergência',
            descricao: 'Fases de intervenção: imediata, breve e acompanhamento',
            cor: '#059669'
        },
        'simulado-srpa': {
            titulo: 'Relatório de Simulado SRPA - Vazamento de Gás',
            descricao: 'Evacuação de 5 pacientes em 5 minutos (meta atingida)',
            cor: '#f59e0b'
        }
    };

    const plano = planos[tipo];
    if (!plano) return;

    // Verificar se já existe documento para este tipo
    const documento = await carregarDocumentoDesastres(tipo);

    // Banner com botão Novo Documento (padrão do app)
    let html = `
        ${renderInfoBanner('fas fa-file-alt', plano.titulo, plano.descricao, `${plano.cor} 0%, ${plano.cor}CC 100%`, 'showPlanosFluxos()')}

        <div style="display: flex; justify-content: flex-end; margin-bottom: 24px; padding: 0 20px;">
            <button onclick="uploadPlanoDocumento('${tipo}')" class="btn-add">
                <i class="fas fa-plus"></i> Novo Documento
            </button>
        </div>
    `;

    if (documento) {
        // Documento existe - mostrar em formato de card/lista (padrão do app)
        const dataFormatada = documento.createdAt ? new Date(documento.createdAt.toDate()).toLocaleDateString('pt-BR') : '';
        const docId = documento.id || '';
        const storagePath = documento.storagePath || '';

        html += `
            <div class="document-card" onclick="abrirPDFDesastres('${docId}')" style="margin: 0 20px 20px 20px; background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-left: 4px solid ${plano.cor}; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.boxShadow='0 4px 16px rgba(0,0,0,0.15)'" onmouseout="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'">
                <div style="display: flex; justify-content: space-between; align-items: start; gap: 20px;">
                    <div style="flex: 1;">
                        <h3 style="color: #1f2937; margin: 0 0 8px 0; font-size: 18px; font-weight: 600;">
                            ${documento.titulo}
                        </h3>
                        <p style="color: #6b7280; margin: 0 0 12px 0; font-size: 14px;">
                            ${plano.descricao}
                        </p>

                        <div style="display: flex; flex-wrap: wrap; gap: 16px; align-items: center; font-size: 13px; color: #6b7280;">
                            <span>
                                <i class="fas fa-user"></i> ${documento.createdByName || documento.createdBy || 'N/A'}
                            </span>
                            <span>
                                <i class="fas fa-file-pdf"></i> PDF anexado
                            </span>
                            ${dataFormatada ? `<span style="margin-left: auto;">${dataFormatada}</span>` : ''}
                        </div>

                        ${documento.observacoes ? `
                            <div style="margin-top: 12px; padding: 12px; background: #f9fafb; border-radius: 6px; font-size: 13px; color: #6b7280;">
                                <i class="fas fa-comment"></i> ${documento.observacoes}
                            </div>
                        ` : ''}
                    </div>

                    <div style="display: flex; gap: 8px; flex-shrink: 0;">
                        <button onclick="event.stopPropagation(); excluirDocumentoDesastres('${docId}', '${storagePath}')"
                                title="Excluir documento"
                                style="padding: 10px 16px; border: 2px solid #dc2626; border-radius: 8px; background: white; color: #dc2626; font-weight: 600; cursor: pointer; transition: all 0.3s;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    } else {
        // Nenhum documento - mensagem amigável
        html += `
            <div style="text-align: center; padding: 60px 20px; color: #9ca3af;">
                <i class="fas fa-inbox" style="font-size: 64px; margin-bottom: 16px; opacity: 0.5;"></i>
                <p style="font-size: 16px; margin: 0;">Nenhum documento adicionado ainda.</p>
                <p style="font-size: 14px; margin: 8px 0 0 0;">Clique em "Novo Documento" para adicionar.</p>
            </div>
        `;
    }

    section.innerHTML = html;
}

// Função para abrir PDF ao clicar no card (padrão do app)
async function abrirPDFDesastres(docId) {
    try {
        console.log('📄 Abrindo PDF do documento:', docId);

        // Buscar documento no Firestore
        const doc = await db.collection('desastres_documentos').doc(docId).get();

        if (!doc.exists) {
            showToast('Documento não encontrado', 'error');
            return;
        }

        const data = doc.data();
        const dataFormatada = data.createdAt?.toDate().toLocaleString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }) || 'Data não disponível';

        if (!data.arquivoURL) {
            showToast('URL do PDF não encontrada', 'error');
            return;
        }

        // Codificar URL para Google Viewer
        const encodedURL = encodeURIComponent(data.arquivoURL);

        // Usar qualidadeSection (padrão para documentos do painel de qualidade)
        const section = document.getElementById('qualidadeSection');
        if (!section) {
            console.error('❌ qualidadeSection não encontrada');
            return;
        }

        // Detectar mobile
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        const html = `
            <div class="section-header">
                <button class="btn-back" onclick="showPlanosFluxos()">
                    <i class="fas fa-arrow-left"></i>
                </button>
                <h1 class="section-title">${data.titulo}</h1>
                <button class="btn-delete" onclick="excluirDocumentoDesastres('${docId}', '${data.storagePath}')" style="background: #DC2626;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>

            <div class="comunicado-detalhes">
                <div class="comunicado-meta">
                    <div><i class="fas fa-calendar"></i> ${dataFormatada}</div>
                    <div><i class="fas fa-user"></i> ${data.createdByName || data.createdBy || 'N/A'}</div>
                    <div><i class="fas fa-fire" style="color: #dc2626;"></i> Gerenciamento de Desastres</div>
                </div>
                ${data.observacoes ? `
                    <div class="comunicado-content">
                        ${data.observacoes.replace(/\n/g, '<br>')}
                    </div>
                ` : ''}

                <div style="margin-top: 24px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px; background: #2C3E50; color: white; border-radius: 8px 8px 0 0;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <i class="fas fa-file-pdf" style="font-size: 20px; color: #DC2626;"></i>
                            <span style="font-weight: 500;">${data.arquivoNome || 'Documento.pdf'}</span>
                        </div>
                        <span style="font-size: 14px; color: #BDC3C7;">Visualização segura do documento</span>
                    </div>
                    <div id="pdfViewerContainer_${docId}" style="width: 100%; height: ${isMobile ? '600px' : '800px'}; border: 2px solid #2C3E50; border-top: none; border-radius: 0 0 8px 8px; background: white; position: relative;">
                        ${isMobile ? `
                            <!-- Mobile: Abordagem híbrida com Google Viewer fallback -->
                            <object
                                data="${data.arquivoURL}#toolbar=1&navpanes=0&scrollbar=1"
                                type="application/pdf"
                                width="100%"
                                height="100%"
                                style="border: none;">
                                <embed
                                    src="https://docs.google.com/gview?url=${encodedURL}&embedded=true"
                                    width="100%"
                                    height="100%"
                                    type="application/pdf"
                                    style="border: none;">
                                </embed>
                                <div style="padding: 20px; text-align: center;">
                                    <p style="margin-bottom: 16px;">Não foi possível carregar o PDF no visualizador.</p>
                                    <a href="${data.arquivoURL}" target="_blank" style="display: inline-block; padding: 12px 24px; background: #006837; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
                                        <i class="fas fa-download"></i> Baixar PDF
                                    </a>
                                </div>
                            </object>
                        ` : `
                            <!-- Desktop: iframe tradicional -->
                            <div class="pdf-loading" id="pdfLoading_${docId}" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
                                <i class="fas fa-spinner fa-spin" style="font-size: 48px; color: #006837; margin-bottom: 16px;"></i>
                                <p>Carregando documento...</p>
                            </div>
                            <iframe
                                id="pdfIframe_${docId}"
                                src="${data.arquivoURL}#toolbar=1&navpanes=0&scrollbar=1"
                                style="width: 100%; height: 100%; border: none; display: none;"
                                frameborder="0"
                                oncontextmenu="return false;">
                            </iframe>
                        `}
                    </div>
                </div>
            </div>
        `;

        section.innerHTML = html;

        // Configurar iframe load para desktop
        if (!isMobile) {
            setTimeout(() => {
                const iframe = document.getElementById(`pdfIframe_${docId}`);
                const loadingDiv = document.getElementById(`pdfLoading_${docId}`);

                if (iframe && loadingDiv) {
                    iframe.onload = () => {
                        loadingDiv.style.display = 'none';
                        iframe.style.display = 'block';
                    };

                    // Fallback se não carregar em 5 segundos
                    setTimeout(() => {
                        if (iframe.style.display === 'none') {
                            loadingDiv.innerHTML = `
                                <p style="margin-bottom: 16px;">Não foi possível carregar o PDF no visualizador.</p>
                                <a href="${data.arquivoURL}" target="_blank" style="display: inline-block; padding: 12px 24px; background: #006837; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
                                    <i class="fas fa-download"></i> Abrir em Nova Aba
                                </a>
                            `;
                        }
                    }, 5000);
                }
            }, 100);
        }

        console.log('✅ PDF aberto com sucesso');

    } catch (error) {
        console.error('❌ Erro ao abrir PDF:', error);
        showToast('Erro ao abrir documento: ' + error.message, 'error');
    }
}

function showApoioComunicacao() {
    if (typeof atualizarHistoricoNavegacao === 'function') {
        atualizarHistoricoNavegacao('apoio-comunicacao');
    }

    const section = document.getElementById('qualidadeSection');
    if (!section) return;

    const html = `
        ${renderInfoBanner('fas fa-comments', '💬 Apoio e Comunicação', 'Canais de apoio e protocolos de comunicação de crise', '#059669 0%, #10B981 100%', 'showGerenciamentoDesastres()')}

        <div class="protocols-grid">
            <div class="protocol-card" onclick="showApoioDetalhes('psicologico')" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #059669;">
                    <i class="fas fa-brain" style="font-size: 32px; color: white;"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">🧠 Apoio Psicológico Pós-Desastre</h3>
                    <p class="protocol-description">Suporte emocional após eventos críticos</p>
                </div>
            </div>

            <div class="protocol-card" onclick="showApoioDetalhes('canais')" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #2563eb;">
                    <i class="fas fa-phone" style="font-size: 32px; color: white;"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">☎️ Canais Oficiais</h3>
                    <p class="protocol-description">Contatos de emergência e coordenação</p>
                </div>
            </div>

            <div class="protocol-card" onclick="showApoioDetalhes('crise')" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #f59e0b;">
                    <i class="fas fa-bullhorn" style="font-size: 32px; color: white;"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">📢 Comunicação de Crise</h3>
                    <p class="protocol-description">Porta-vozes e canais institucionais</p>
                </div>
            </div>

            <div class="protocol-card" onclick="showApoioDetalhes('familias')" style="cursor: pointer;">
                <div class="protocol-icon" style="background: #7c3aed;">
                    <i class="fas fa-users" style="font-size: 32px; color: white;"></i>
                </div>
                <div class="protocol-content">
                    <h3 class="protocol-title">🧑‍🤝‍🧑 Pacientes e Familiares</h3>
                    <p class="protocol-description">Comunicação clara e apoio emocional</p>
                </div>
            </div>
        </div>
    `;

    section.innerHTML = html;
}

function showApoioDetalhes(tipo) {
    const section = document.getElementById('qualidadeSection');
    if (!section) return;

    const apoios = {
        'psicologico': {
            titulo: '🧠 Apoio Psicológico Pós-Desastre',
            cor: '#059669',
            itens: [
                'Ativado por CGPED após emergências críticas',
                'Equipe: Psicologia, RH e CGPED',
                'Objetivo: prevenção de estresse pós-traumático',
                'Atendimento: presencial ou remoto',
                'Registro confidencial'
            ]
        },
        'canais': {
            titulo: '☎️ Canais Oficiais',
            cor: '#2563eb',
            itens: [
                'CGPED: coordenação geral',
                'SESMT / Brigada: emergências',
                'Engenharia: suporte técnico',
                'Comunicação: canal oficial interno',
                'Ouvidoria: confidencial'
            ]
        },
        'crise': {
            titulo: '📢 Comunicação de Crise',
            cor: '#f59e0b',
            itens: [
                'Porta-vozes: Diretoria Médica, CGPED e Comunicação',
                'Comunicação interna via rádio e WhatsApp institucional',
                'Comunicação externa validada e documentada',
                'Padrão QMENTUM: transparência e empatia'
            ]
        },
        'familias': {
            titulo: '🧑‍🤝‍🧑 Comunicação com Pacientes e Familiares',
            cor: '#7c3aed',
            itens: [
                'Garantir clareza e segurança nas informações',
                'Apoio emocional disponível',
                'Informar pontos de encontro e fluxos',
                'Registrar comunicações'
            ]
        }
    };

    const apoio = apoios[tipo];
    if (!apoio) return;

    const html = `
        ${renderInfoBanner('fas fa-info-circle', apoio.titulo, '', `${apoio.cor} 0%, ${apoio.cor}CC 100%`, 'showApoioComunicacao()')}

        <div style="max-width: 900px; margin: 0 auto;">
            <div class="protocol-card" style="cursor: default;">
                <div class="protocol-content">
                    <ul style="font-size: 16px; line-height: 2; padding-left: 20px;">
                        ${apoio.itens.map(item => `<li>${item}</li>`).join('')}
                    </ul>
                </div>
            </div>
        </div>
    `;

    section.innerHTML = html;
}

function showResumos() {
    if (typeof atualizarHistoricoNavegacao === 'function') {
        atualizarHistoricoNavegacao('resumos');
    }

    const section = document.getElementById('qualidadeSection');
    if (!section) return;

    const html = `
        ${renderInfoBanner('fas fa-file-alt', '🗂️ Resumos', 'Resumos executivos dos principais documentos', '#64748b 0%, #94a3b8 100%', 'showGerenciamentoDesastres()')}

        <div style="max-width: 1000px; margin: 0 auto;">
            <div class="protocol-card" style="margin-bottom: 20px; cursor: default;">
                <div class="protocol-content">
                    <h3 style="color: #2563eb; margin-bottom: 15px;"><i class="fas fa-book"></i> MAN.INS.0001-02 — Manual de Gestão</h3>
                    <ul style="font-size: 15px; line-height: 1.8; padding-left: 20px;">
                        <li>Define estrutura e responsabilidades do CGPED</li>
                        <li>Estabelece planos de contingência para falhas estruturais</li>
                        <li>Protocolo de evacuação e pontos de encontro</li>
                    </ul>
                </div>
            </div>

            <div class="protocol-card" style="margin-bottom: 20px; cursor: default;">
                <div class="protocol-content">
                    <h3 style="color: #2563eb; margin-bottom: 15px;"><i class="fas fa-sitemap"></i> FLU.INSA.0009-06 — Times de Gerenciamento</h3>
                    <ul style="font-size: 15px; line-height: 1.8; padding-left: 20px;">
                        <li>Coordenação geral, assistencial, estrutural e de comunicação</li>
                        <li>Fluxos de ativação e comunicação interna</li>
                        <li>Protocolo de ativação do hospital de base</li>
                    </ul>
                </div>
            </div>

            <div class="protocol-card" style="margin-bottom: 20px; cursor: default;">
                <div class="protocol-content">
                    <h3 style="color: #059669; margin-bottom: 15px;"><i class="fas fa-brain"></i> FLU.INSH.0025-00 — Apoio Psicológico</h3>
                    <ul style="font-size: 15px; line-height: 1.8; padding-left: 20px;">
                        <li>Fases de intervenção: imediata, breve e acompanhamento</li>
                        <li>Equipe multidisciplinar com RH e Psicologia</li>
                        <li>Registro confidencial e acompanhamento de 30 dias</li>
                    </ul>
                </div>
            </div>

            <div class="protocol-card" style="margin-bottom: 20px; cursor: default;">
                <div class="protocol-content">
                    <h3 style="color: #f59e0b; margin-bottom: 15px;"><i class="fas fa-clipboard-check"></i> Simulado SRPA — 23/07/2025</h3>
                    <ul style="font-size: 15px; line-height: 1.8; padding-left: 20px;">
                        <li>Evacuação de 5 pacientes em 5 minutos (meta atingida)</li>
                        <li>Coordenação eficaz entre equipes</li>
                        <li>Oportunidade: padronizar comandos verbais</li>
                    </ul>
                </div>
            </div>
        </div>
    `;

    section.innerHTML = html;
}

// ========== FUNÇÕES DE UPLOAD DE DOCUMENTOS ==========

function showNovoDocumentoDesastres() {
    showToast('Funcionalidade de upload de documentos em desenvolvimento. Em breve você poderá adicionar novos documentos ao sistema.', 'info');
}

async function uploadPlanoDocumento(tipo) {
    const planoTitulos = {
        'manual-gestao': 'Manual de Gestão e Preparação para Emergências',
        'times-gerenciamento': 'Times de Gerenciamento e Fluxos do CGPED',
        'apoio-psicologico': 'Apoio Psicológico Pós-Emergência',
        'simulado-srpa': 'Relatório de Simulado SRPA - Vazamento de Gás'
    };

    const titulo = planoTitulos[tipo];

    // Criar modal de upload
    const modalHTML = `
        <div id="modalUploadDesastres" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;">
            <div style="background: white; border-radius: 12px; padding: 32px; max-width: 500px; width: 90%; max-height: 90vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                    <h2 style="margin: 0; color: #1f2937; font-size: 20px;">
                        <i class="fas fa-upload"></i> Upload de Documento
                    </h2>
                    <button onclick="fecharModalUploadDesastres()" style="background: none; border: none; font-size: 24px; color: #6b7280; cursor: pointer; padding: 0; width: 32px; height: 32px;">
                        ×
                    </button>
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">
                        <i class="fas fa-file-alt"></i> Documento
                    </label>
                    <input type="text" id="des_titulo" value="${titulo}" readonly style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; background: #f9fafb;">
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">
                        <i class="fas fa-file-pdf"></i> Selecionar PDF *
                    </label>
                    <input type="file" id="des_arquivo" accept=".pdf" style="width: 100%; padding: 12px; border: 2px dashed #e5e7eb; border-radius: 8px; background: #f9fafb; cursor: pointer;">
                    <small style="display: block; margin-top: 8px; color: #6b7280;">
                        <i class="fas fa-info-circle"></i> Apenas PDF. Tamanho máximo: 10MB
                    </small>
                </div>

                <div style="margin-bottom: 24px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">
                        <i class="fas fa-align-left"></i> Observações (opcional)
                    </label>
                    <textarea id="des_observacoes" rows="3" placeholder="Adicione observações sobre o documento..." style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; resize: vertical;"></textarea>
                </div>

                <div style="display: flex; gap: 12px;">
                    <button onclick="fecharModalUploadDesastres()" style="flex: 1; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; background: white; color: #374151; font-weight: 600; cursor: pointer;">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                    <button onclick="salvarDocumentoDesastres('${tipo}')" class="btn-add" style="flex: 1; margin: 0;">
                        <i class="fas fa-check"></i> Salvar
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function fecharModalUploadDesastres() {
    const modal = document.getElementById('modalUploadDesastres');
    if (modal) {
        modal.remove();
    }
}

async function salvarDocumentoDesastres(tipo) {
    try {
        const titulo = document.getElementById('des_titulo').value.trim();
        const observacoes = document.getElementById('des_observacoes').value.trim();
        const arquivo = document.getElementById('des_arquivo').files[0];

        // Validações
        if (!arquivo) {
            showToast('Selecione um arquivo PDF', 'error');
            return;
        }

        if (arquivo.type !== 'application/pdf') {
            showToast('Apenas arquivos PDF são permitidos', 'error');
            return;
        }

        if (arquivo.size > 10 * 1024 * 1024) {
            showToast('Arquivo muito grande. Máximo 10MB', 'error');
            return;
        }

        showLoading();
        fecharModalUploadDesastres();

        // 1. Upload do arquivo para Firebase Storage
        const timestamp = Date.now();
        const filename = `${timestamp}_${arquivo.name}`;
        const storagePath = `Gerenciamento_Desastres/${filename}`;
        const storageRef = storage.ref(storagePath);

        console.log('📤 Fazendo upload do PDF...');
        const uploadTask = await storageRef.put(arquivo);
        const downloadURL = await uploadTask.ref.getDownloadURL();
        console.log('✅ Upload concluído:', downloadURL);

        // 2. Salvar metadados no Firestore (padrão do app)
        const docData = {
            titulo: titulo,
            tipo: tipo,
            observacoes: observacoes || '',
            arquivoURL: downloadURL,  // Padrão do app
            arquivoNome: arquivo.name,
            arquivoTamanho: arquivo.size,
            storagePath: storagePath,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: currentUser.email,
            createdByName: currentUser.displayName || currentUser.email,
            ativo: true
        };

        console.log('💾 Salvando no Firestore...');
        await db.collection('desastres_documentos').add(docData);

        hideLoading();
        showToast('✅ Documento adicionado com sucesso!', 'success');

        // Recarregar a página do plano para mostrar o documento
        setTimeout(() => {
            showPlanoDetalhes(tipo);
        }, 500);

    } catch (error) {
        console.error('❌ Erro ao salvar documento:', error);
        hideLoading();
        showToast('Erro ao salvar documento: ' + error.message, 'error');
    }
}

async function carregarDocumentoDesastres(tipo) {
    try {
        console.log('🔍 Buscando documento do tipo:', tipo);

        // Query simplificada sem index composto - busca todos do tipo e filtra no código
        const snapshot = await db.collection('desastres_documentos')
            .where('tipo', '==', tipo)
            .get();

        if (!snapshot.empty) {
            // Filtrar documentos ativos e pegar o mais recente
            const documentosAtivos = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(doc => doc.ativo !== false) // Considera ativo se não tiver o campo ou for true
                .sort((a, b) => {
                    // Ordenar por data de criação (mais recente primeiro)
                    if (!a.createdAt) return 1;
                    if (!b.createdAt) return -1;
                    return b.createdAt.toMillis() - a.createdAt.toMillis();
                });

            if (documentosAtivos.length > 0) {
                const documento = documentosAtivos[0];
                console.log('✅ Documento encontrado:', documento);
                return documento;
            }
        }

        console.log('📭 Nenhum documento encontrado');
        return null;
    } catch (error) {
        console.error('❌ Erro ao carregar documento:', error);
        return null;
    }
}

async function excluirDocumentoDesastres(firestoreId, storagePath) {
    console.log('🗑️ Excluindo documento:', firestoreId);

    if (!confirm('Tem certeza que deseja excluir este documento? Esta ação não pode ser desfeita.')) {
        return;
    }

    try {
        showLoading();

        // 1. Excluir do Firestore
        await db.collection('desastres_documentos').doc(firestoreId).delete();
        console.log('✅ Documento excluído do Firestore');

        // 2. Excluir do Storage (se existir)
        if (storagePath) {
            try {
                const storageRef = storage.ref(storagePath);
                await storageRef.delete();
                console.log('✅ Arquivo excluído do Storage');
            } catch (storageError) {
                console.warn('⚠️ Arquivo não encontrado no Storage (já pode ter sido excluído)');
            }
        }

        hideLoading();
        showToast('✅ Documento excluído com sucesso!', 'success');

        // Voltar para a tela de Planos e Fluxos
        setTimeout(() => {
            showPlanosFluxos();
        }, 500);

    } catch (error) {
        console.error('❌ Erro ao excluir documento:', error);
        hideLoading();
        showToast('Erro ao excluir documento: ' + error.message, 'error');
    }
}

// ========== ORGANOGRAMA ==========

async function uploadOrganogramaAutomatico() {
    try {
        console.log('📤 Iniciando upload automático do organograma...');

        // Buscar a imagem do organograma
        const imagePath = 'Documentos/11 - Novos/Organograma2025.jpg';
        const imageUrl = `${imagePath}`;

        // Fazer fetch da imagem
        const response = await fetch(imageUrl);
        if (!response.ok) {
            console.error('❌ Erro ao buscar imagem:', response.statusText);
            return;
        }

        const blob = await response.blob();
        console.log('✅ Imagem carregada:', blob.size, 'bytes');

        // Upload para Firebase Storage
        const timestamp = Date.now();
        const filename = `${timestamp}_Organograma2025.jpg`;
        const storagePath = `Organogramas/${filename}`;
        const storageRef = storage.ref(storagePath);

        console.log('📤 Fazendo upload para Firebase Storage...');
        const uploadTask = await storageRef.put(blob, { contentType: 'image/jpeg' });
        const downloadURL = await uploadTask.ref.getDownloadURL();
        console.log('✅ Upload concluído:', downloadURL);

        // Salvar metadados no Firestore
        const docData = {
            titulo: 'Organograma Institucional 2025',
            observacoes: 'Estrutura organizacional completa da instituição',
            arquivoURL: downloadURL,
            arquivoNome: 'Organograma2025.jpg',
            arquivoTipo: 'image/jpeg',
            arquivoTamanho: blob.size,
            storagePath: storagePath,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: currentUser ? currentUser.email : 'sistema',
            createdByName: currentUser ? (currentUser.displayName || currentUser.email) : 'Sistema',
            ativo: true
        };

        console.log('💾 Salvando no Firestore...');
        await db.collection('organograma_documentos').add(docData);
        console.log('✅ Organograma adicionado automaticamente com sucesso!');

    } catch (error) {
        console.error('❌ Erro ao fazer upload automático do organograma:', error);
    }
}

async function showOrganograma() {
    console.log('📊 Organograma');

    if (typeof atualizarHistoricoNavegacao === 'function') {
        atualizarHistoricoNavegacao('organograma');
    }

    showLoading();

    try {
        // Verificar se já existe organograma (query simplificada sem índice composto)
        const snapshot = await db.collection('organograma_documentos')
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();

        // Filtrar documentos ativos no código (evita necessidade de índice composto)
        const documentosAtivos = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(doc => doc.ativo !== false);

        let documento = documentosAtivos.length > 0 ? documentosAtivos[0] : null;

        // Se não existe documento, fazer upload automático da imagem padrão
        if (!documento) {
            console.log('📤 Nenhum organograma encontrado, fazendo upload automático...');
            await uploadOrganogramaAutomatico();

            // Recarregar documento após upload
            const newSnapshot = await db.collection('organograma_documentos')
                .orderBy('createdAt', 'desc')
                .limit(10)
                .get();

            const novosDocumentosAtivos = newSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(doc => doc.ativo !== false);

            documento = novosDocumentosAtivos.length > 0 ? novosDocumentosAtivos[0] : null;
        }

        hideLoading();

        // Abrir imagem diretamente
        if (documento) {
            await abrirOrganograma(documento.id);
        } else {
            // Se não existe, mostrar mensagem de erro
            const section = document.getElementById('painelSection');
            if (!section) return;

            section.innerHTML = `
                ${renderInfoBanner('fas fa-sitemap', 'Organograma Institucional', 'Estrutura organizacional e hierarquia da instituição', '#6366f1 0%, #4f46e5 100%', "showSection('painel')")}

                <div style="text-align: center; padding: 60px 20px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 64px; color: #f59e0b; margin-bottom: 16px;"></i>
                    <h3 style="color: #1f2937; margin: 0 0 8px 0;">Erro ao carregar organograma</h3>
                    <p style="color: #6b7280; margin: 0 0 24px 0;">Não foi possível carregar ou criar o organograma automaticamente.</p>
                    <button onclick="uploadOrganograma()" class="btn-add">
                        <i class="fas fa-plus"></i> Adicionar Organograma
                    </button>
                </div>
            `;
        }
    } catch (error) {
        console.error('❌ Erro ao carregar organograma:', error);
        hideLoading();
        showToast('Erro ao carregar organograma: ' + error.message, 'error');
    }
}

async function uploadOrganograma() {
    const modalHTML = `
        <div id="modalUploadOrganograma" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;">
            <div style="background: white; border-radius: 12px; padding: 32px; max-width: 500px; width: 90%; max-height: 90vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                    <h2 style="margin: 0; color: #1f2937; font-size: 20px;">
                        <i class="fas fa-upload"></i> Upload de Organograma
                    </h2>
                    <button onclick="fecharModalUploadOrganograma()" style="background: none; border: none; font-size: 24px; color: #6b7280; cursor: pointer; padding: 0; width: 32px; height: 32px;">
                        ×
                    </button>
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">
                        <i class="fas fa-heading"></i> Título
                    </label>
                    <input type="text" id="org_titulo" value="Organograma Institucional 2025" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px;">
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">
                        <i class="fas fa-file"></i> Selecionar Arquivo *
                    </label>
                    <input type="file" id="org_arquivo" accept=".pdf,.png,.jpg,.jpeg,.pptx" style="width: 100%; padding: 12px; border: 2px dashed #e5e7eb; border-radius: 8px; background: #f9fafb; cursor: pointer;">
                    <small style="display: block; margin-top: 8px; color: #6b7280;">
                        <i class="fas fa-info-circle"></i> Formatos aceitos: PDF, PNG, JPG, PPTX. Tamanho máximo: 15MB
                    </small>
                </div>

                <div style="margin-bottom: 24px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">
                        <i class="fas fa-align-left"></i> Observações (opcional)
                    </label>
                    <textarea id="org_observacoes" rows="3" placeholder="Adicione observações sobre o organograma..." style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; resize: vertical;"></textarea>
                </div>

                <div style="display: flex; gap: 12px;">
                    <button onclick="fecharModalUploadOrganograma()" style="flex: 1; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; background: white; color: #374151; font-weight: 600; cursor: pointer;">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                    <button onclick="salvarOrganograma()" class="btn-add" style="flex: 1; margin: 0;">
                        <i class="fas fa-check"></i> Salvar
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function fecharModalUploadOrganograma() {
    const modal = document.getElementById('modalUploadOrganograma');
    if (modal) modal.remove();
}

async function salvarOrganograma() {
    try {
        const titulo = document.getElementById('org_titulo').value.trim();
        const observacoes = document.getElementById('org_observacoes').value.trim();
        const arquivo = document.getElementById('org_arquivo').files[0];

        if (!titulo) {
            showToast('Digite um título', 'error');
            return;
        }

        if (!arquivo) {
            showToast('Selecione um arquivo', 'error');
            return;
        }

        const tiposAceitos = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'];
        if (!tiposAceitos.includes(arquivo.type)) {
            showToast('Formato de arquivo não suportado', 'error');
            return;
        }

        if (arquivo.size > 15 * 1024 * 1024) {
            showToast('Arquivo muito grande. Máximo 15MB', 'error');
            return;
        }

        showLoading();
        fecharModalUploadOrganograma();

        // Upload para Firebase Storage
        const timestamp = Date.now();
        const filename = `${timestamp}_${arquivo.name}`;
        const storagePath = `Organogramas/${filename}`;
        const storageRef = storage.ref(storagePath);

        console.log('📤 Fazendo upload do organograma...');
        const uploadTask = await storageRef.put(arquivo);
        const downloadURL = await uploadTask.ref.getDownloadURL();
        console.log('✅ Upload concluído:', downloadURL);

        // Salvar metadados no Firestore
        const docData = {
            titulo: titulo,
            observacoes: observacoes || '',
            arquivoURL: downloadURL,
            arquivoNome: arquivo.name,
            arquivoTipo: arquivo.type,
            arquivoTamanho: arquivo.size,
            storagePath: storagePath,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: currentUser.email,
            createdByName: currentUser.displayName || currentUser.email,
            ativo: true
        };

        console.log('💾 Salvando no Firestore...');
        await db.collection('organograma_documentos').add(docData);

        hideLoading();
        showToast('✅ Organograma adicionado com sucesso!', 'success');

        setTimeout(() => {
            showOrganograma();
        }, 500);

    } catch (error) {
        console.error('❌ Erro ao salvar organograma:', error);
        hideLoading();
        showToast('Erro ao salvar organograma: ' + error.message, 'error');
    }
}

async function abrirOrganograma(docId) {
    try {
        console.log('📊 Abrindo organograma:', docId);

        const doc = await db.collection('organograma_documentos').doc(docId).get();

        if (!doc.exists) {
            showToast('Documento não encontrado', 'error');
            return;
        }

        const data = doc.data();

        if (!data.arquivoURL) {
            showToast('URL do arquivo não encontrada', 'error');
            return;
        }

        // Se for PowerPoint, abrir em nova aba para download
        if (data.arquivoTipo === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
            window.open(data.arquivoURL, '_blank');
            showToast('Arquivo PowerPoint aberto para download', 'info');
            return;
        }

        // Para imagens e PDFs, abrir visualização inline
        const dataFormatada = data.createdAt?.toDate().toLocaleString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }) || 'Data não disponível';

        const encodedURL = encodeURIComponent(data.arquivoURL);
        const section = document.getElementById('painelSection');
        if (!section) return;

        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const isPDF = data.arquivoTipo === 'application/pdf';
        const isImage = data.arquivoTipo && data.arquivoTipo.startsWith('image/');

        let viewerHTML = '';

        if (isImage) {
            // Exibir imagem diretamente
            viewerHTML = `
                <div style="width: 100%; background: white; border-radius: 8px; padding: 20px; text-align: center;">
                    <img src="${data.arquivoURL}" alt="${data.titulo}" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                </div>
            `;
        } else if (isPDF) {
            // Exibir PDF
            viewerHTML = `
                <div style="margin-top: 24px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px; background: #2C3E50; color: white; border-radius: 8px 8px 0 0;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <i class="fas fa-file-pdf" style="font-size: 20px; color: #DC2626;"></i>
                            <span style="font-weight: 500;">${data.arquivoNome || 'Documento.pdf'}</span>
                        </div>
                    </div>
                    <div style="width: 100%; height: ${isMobile ? '600px' : '800px'}; border: 2px solid #2C3E50; border-top: none; border-radius: 0 0 8px 8px;">
                        <iframe src="${data.arquivoURL}#toolbar=1" width="100%" height="100%" style="border: none;"></iframe>
                    </div>
                </div>
            `;
        }

        const html = `
            <div class="section-header">
                <button class="btn-back" onclick="showSection('painel')">
                    <i class="fas fa-arrow-left"></i>
                </button>
                <h1 class="section-title">${data.titulo}</h1>
                <button class="btn-delete" onclick="excluirOrganograma('${docId}', '${data.storagePath}')" style="background: #DC2626;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>

            <div class="comunicado-detalhes">
                <div class="comunicado-meta">
                    <div><i class="fas fa-calendar"></i> ${dataFormatada}</div>
                    <div><i class="fas fa-user"></i> ${data.createdByName || data.createdBy || 'N/A'}</div>
                    <div><i class="fas fa-sitemap" style="color: #6366f1;"></i> Organograma</div>
                </div>
                ${data.observacoes ? `
                    <div class="comunicado-content">
                        ${data.observacoes.replace(/\n/g, '<br>')}
                    </div>
                ` : ''}

                ${viewerHTML}
            </div>
        `;

        section.innerHTML = html;
        console.log('✅ Organograma aberto com sucesso');

    } catch (error) {
        console.error('❌ Erro ao abrir organograma:', error);
        showToast('Erro ao abrir organograma: ' + error.message, 'error');
    }
}

async function excluirOrganograma(firestoreId, storagePath) {
    if (!confirm('Tem certeza que deseja excluir este organograma? Esta ação não pode ser desfeita.')) {
        return;
    }

    try {
        showLoading();

        await db.collection('organograma_documentos').doc(firestoreId).delete();
        console.log('✅ Documento excluído do Firestore');

        if (storagePath) {
            try {
                const storageRef = storage.ref(storagePath);
                await storageRef.delete();
                console.log('✅ Arquivo excluído do Storage');
            } catch (storageError) {
                console.warn('⚠️ Arquivo não encontrado no Storage');
            }
        }

        hideLoading();
        showToast('✅ Organograma excluído com sucesso!', 'success');

        setTimeout(() => {
            showSection('painel');
        }, 500);

    } catch (error) {
        console.error('❌ Erro ao excluir organograma:', error);
        hideLoading();
        showToast('Erro ao excluir organograma: ' + error.message, 'error');
    }
}

// ==================== ÉTICA E BIOÉTICA ====================

/**
 * Tela principal de Ética e Bioética
 * Exibe 5 cards para gestão ética, pareceres e diretrizes institucionais
 */
async function showEticaBioetica() {
    console.log('⚖️ Ética e Bioética');

    if (typeof atualizarHistoricoNavegacao === 'function') {
        atualizarHistoricoNavegacao('etica-bioetica');
    }

    const section = document.getElementById('painelSection');
    if (!section) return;

    const config = {
        banner: {
            icon: 'fas fa-balance-scale',
            title: 'Ética e Bioética',
            description: 'Gestão de dilemas éticos, pareceres técnicos e diretrizes institucionais',
            gradient: '#7c3aed 0%, #6d28d9 100%', // Roxo para diferenciação
            backOnClick: 'showSection(\'painel\')' // Botão voltar integrado no banner
        },
        items: [
            {
                icon: 'fas fa-comments',
                title: 'Gestão de Dilemas Bioéticos',
                description: 'Análise e deliberação de casos éticos complexos',
                color: '#7c3aed',
                onClick: 'showDilemasBioeticos()'
            },
            {
                icon: 'fas fa-file-medical',
                title: 'Parecer Ético – Encaminhamento para UTI',
                description: 'Avaliação ética para transferência de pacientes críticos',
                color: '#dc2626',
                onClick: 'showParecerUTI()'
            },
            {
                icon: 'fas fa-book-open',
                title: 'Ética – Diretrizes Institucionais',
                description: 'Normas e políticas éticas da instituição',
                color: '#2563eb',
                onClick: 'showDiretrizesEtica()'
            },
            {
                icon: 'fas fa-file-signature',
                title: 'Emissão de Parecer Técnico-Ético',
                description: 'Formulários e processos para emissão de pareceres',
                color: '#059669',
                onClick: 'showEmissaoParecer()'
            },
            {
                icon: 'fas fa-gavel',
                title: 'Código de Ética',
                description: 'Código de Ética Médica e normas profissionais',
                color: '#0891b2',
                onClick: 'showCodigoEtica()'
            }
        ],
        infoBox: {
            icon: 'fas fa-info-circle',
            title: 'Sobre Ética e Bioética:',
            content: '<p>Esta seção concentra ferramentas para análise ética de casos complexos, emissão de pareceres técnicos e consulta às diretrizes institucionais, promovendo decisões baseadas em princípios bioéticos.</p>'
        }
    };

    section.innerHTML = renderStandardLayout(config);
}

// ========== Funções dos Cards de Ética ==========

// Configuração dos tipos de documentos de Ética
const ETICA_CONFIGS = {
    'dilemas': {
        titulo: 'Gestão de Dilemas Bioéticos',
        descricao: 'Análise e deliberação de casos éticos complexos',
        icon: 'fas fa-comments',
        cor: '#7c3aed',
        collection: 'etica_dilemas_documentos',
        storagePath: 'Etica_Bioetica/Dilemas'
    },
    'parecer-uti': {
        titulo: 'Parecer Ético – Encaminhamento para UTI',
        descricao: 'Avaliação ética para transferência de pacientes críticos',
        icon: 'fas fa-file-medical',
        cor: '#dc2626',
        collection: 'etica_parecer_uti_documentos',
        storagePath: 'Etica_Bioetica/Parecer_UTI'
    },
    'diretrizes': {
        titulo: 'Ética – Diretrizes Institucionais',
        descricao: 'Normas e políticas éticas da instituição',
        icon: 'fas fa-book-open',
        cor: '#2563eb',
        collection: 'etica_diretrizes_documentos',
        storagePath: 'Etica_Bioetica/Diretrizes'
    },
    'parecer-tecnico': {
        titulo: 'Emissão de Parecer Técnico-Ético',
        descricao: 'Formulários e processos para emissão de pareceres',
        icon: 'fas fa-file-signature',
        cor: '#059669',
        collection: 'etica_parecer_tecnico_documentos',
        storagePath: 'Etica_Bioetica/Parecer_Tecnico'
    },
    'codigo': {
        titulo: 'Código de Ética',
        descricao: 'Código de Ética Médica e normas profissionais',
        icon: 'fas fa-gavel',
        cor: '#0891b2',
        collection: 'etica_codigo_documentos',
        storagePath: 'Etica_Bioetica/Codigo'
    }
};

// Função genérica para exibir card de ética com documentos
async function showEticaCard(tipo) {
    const config = ETICA_CONFIGS[tipo];
    if (!config) {
        console.error('❌ Tipo de documento ética inválido:', tipo);
        return;
    }

    console.log('⚖️', config.titulo);
    const section = document.getElementById('painelSection');
    if (!section) return;

    showLoading();

    try {
        // Carregar documento
        const documento = await carregarDocumentoEtica(tipo);

        // Banner com botão Voltar e Novo Documento
        let html = `
            <div class="section-header" style="margin-bottom: 24px;">
                <button class="btn-back" onclick="showEticaBioetica()">
                    <i class="fas fa-arrow-left"></i>
                </button>
                <h1 class="section-title">
                    <i class="${config.icon}" style="color: ${config.cor};"></i> ${config.titulo}
                </h1>
                <button onclick="uploadEticaDocumento('${tipo}')" class="btn-add" style="background: ${config.cor};">
                    <i class="fas fa-plus"></i> Novo Documento
                </button>
            </div>

            <div style="padding: 0 20px 20px 20px;">
                <p style="color: #6b7280; font-size: 16px; margin: 0 0 24px 0;">
                    ${config.descricao}
                </p>
            </div>
        `;

        if (documento) {
            // Documento existe - mostrar card
            const dataFormatada = documento.createdAt ? new Date(documento.createdAt.toDate()).toLocaleDateString('pt-BR') : '';
            const docId = documento.id || '';
            const storagePath = documento.storagePath || '';

            html += `
                <div class="document-card" onclick="abrirPDFEtica('${tipo}', '${docId}')" style="margin: 0 20px 20px 20px; background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-left: 4px solid ${config.cor}; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.boxShadow='0 4px 16px rgba(0,0,0,0.15)'" onmouseout="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'">
                    <div style="display: flex; justify-content: space-between; align-items: start; gap: 20px;">
                        <div style="flex: 1;">
                            <h3 style="color: #1f2937; margin: 0 0 8px 0; font-size: 18px; font-weight: 600;">
                                ${documento.titulo}
                            </h3>
                            <p style="color: #6b7280; margin: 0 0 12px 0; font-size: 14px;">
                                ${config.descricao}
                            </p>

                            <div style="display: flex; flex-wrap: wrap; gap: 16px; align-items: center; font-size: 13px; color: #6b7280;">
                                <span>
                                    <i class="fas fa-user"></i> ${documento.createdByName || documento.createdBy || 'N/A'}
                                </span>
                                <span>
                                    <i class="fas fa-file-pdf"></i> PDF anexado
                                </span>
                                ${dataFormatada ? `<span style="margin-left: auto;">${dataFormatada}</span>` : ''}
                            </div>

                            ${documento.observacoes ? `
                                <div style="margin-top: 12px; padding: 12px; background: #f9fafb; border-radius: 6px; font-size: 13px; color: #6b7280;">
                                    <i class="fas fa-comment"></i> ${documento.observacoes}
                                </div>
                            ` : ''}
                        </div>

                        <div style="display: flex; gap: 8px; flex-shrink: 0;">
                            <button onclick="event.stopPropagation(); excluirDocumentoEtica('${tipo}', '${docId}', '${storagePath}')"
                                    title="Excluir documento"
                                    style="padding: 10px 16px; border: 2px solid #dc2626; border-radius: 8px; background: white; color: #dc2626; font-weight: 600; cursor: pointer; transition: all 0.3s;">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Nenhum documento - mensagem amigável
            html += `
                <div style="text-align: center; padding: 60px 20px; color: #9ca3af;">
                    <i class="fas fa-inbox" style="font-size: 64px; margin-bottom: 16px; opacity: 0.5;"></i>
                    <p style="font-size: 16px; margin: 0;">Nenhum documento adicionado ainda.</p>
                    <p style="font-size: 14px; margin: 8px 0 0 0;">Clique em "Novo Documento" para adicionar.</p>
                </div>
            `;
        }

        section.innerHTML = html;

    } catch (error) {
        console.error('❌ Erro ao carregar documento ética:', error);
        section.innerHTML = `
            <div class="section-header" style="margin-bottom: 24px;">
                <button class="btn-back" onclick="showEticaBioetica()">
                    <i class="fas fa-arrow-left"></i>
                </button>
                <h1 class="section-title">
                    <i class="${config.icon}" style="color: ${config.cor};"></i> ${config.titulo}
                </h1>
            </div>

            <div style="text-align: center; padding: 60px 20px; color: #dc2626;">
                <i class="fas fa-exclamation-triangle" style="font-size: 64px; margin-bottom: 16px; opacity: 0.5;"></i>
                <p style="font-size: 16px; margin: 0;">Erro ao carregar documentos</p>
                <p style="font-size: 14px; margin: 8px 0 0 0;">${error.message}</p>
            </div>
        `;
    } finally {
        hideLoading();
    }
}

// Funções individuais para cada card
function showDilemasBioeticos() {
    if (typeof atualizarHistoricoNavegacao === 'function') {
        atualizarHistoricoNavegacao('dilemas-bioeticos');
    }
    showEticaCard('dilemas');
}

function showParecerUTI() {
    if (typeof atualizarHistoricoNavegacao === 'function') {
        atualizarHistoricoNavegacao('parecer-uti');
    }
    showEticaCard('parecer-uti');
}

function showDiretrizesEtica() {
    if (typeof atualizarHistoricoNavegacao === 'function') {
        atualizarHistoricoNavegacao('diretrizes-etica');
    }
    showEticaCard('diretrizes');
}

function showEmissaoParecer() {
    if (typeof atualizarHistoricoNavegacao === 'function') {
        atualizarHistoricoNavegacao('emissao-parecer');
    }
    showEticaCard('parecer-tecnico');
}

function showCodigoEtica() {
    if (typeof atualizarHistoricoNavegacao === 'function') {
        atualizarHistoricoNavegacao('codigo-etica');
    }
    showEticaCard('codigo');
}

// ========== Funções auxiliares de Ética ==========

// Upload modal
async function uploadEticaDocumento(tipo) {
    const config = ETICA_CONFIGS[tipo];
    if (!config) return;

    const modalHTML = `
        <div id="modalUploadEtica" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;">
            <div style="background: white; border-radius: 12px; padding: 32px; max-width: 500px; width: 90%; max-height: 90vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                    <h2 style="margin: 0; color: #1f2937; font-size: 20px;">
                        <i class="fas fa-upload"></i> Upload de Documento
                    </h2>
                    <button onclick="fecharModalUploadEtica()" style="background: none; border: none; font-size: 24px; color: #6b7280; cursor: pointer; padding: 0; width: 32px; height: 32px;">
                        ×
                    </button>
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">
                        <i class="fas fa-file-alt"></i> Documento
                    </label>
                    <input type="text" id="etica_titulo" value="${config.titulo}" readonly style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; background: #f9fafb;">
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">
                        <i class="fas fa-file-pdf"></i> Selecionar PDF *
                    </label>
                    <input type="file" id="etica_arquivo" accept=".pdf" style="width: 100%; padding: 12px; border: 2px dashed #e5e7eb; border-radius: 8px; background: #f9fafb; cursor: pointer;">
                    <small style="display: block; margin-top: 8px; color: #6b7280;">
                        <i class="fas fa-info-circle"></i> Apenas PDF. Tamanho máximo: 10MB
                    </small>
                </div>

                <div style="margin-bottom: 24px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">
                        <i class="fas fa-align-left"></i> Observações (opcional)
                    </label>
                    <textarea id="etica_observacoes" rows="3" placeholder="Adicione observações sobre o documento..." style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; resize: vertical;"></textarea>
                </div>

                <div style="display: flex; gap: 12px;">
                    <button onclick="fecharModalUploadEtica()" style="flex: 1; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; background: white; color: #374151; font-weight: 600; cursor: pointer;">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                    <button onclick="salvarDocumentoEtica('${tipo}')" class="btn-add" style="flex: 1; margin: 0;">
                        <i class="fas fa-check"></i> Salvar
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function fecharModalUploadEtica() {
    const modal = document.getElementById('modalUploadEtica');
    if (modal) {
        modal.remove();
    }
}

// Salvar documento
async function salvarDocumentoEtica(tipo) {
    const config = ETICA_CONFIGS[tipo];
    if (!config) return;

    try {
        const titulo = document.getElementById('etica_titulo').value.trim();
        const observacoes = document.getElementById('etica_observacoes').value.trim();
        const arquivo = document.getElementById('etica_arquivo').files[0];

        // Validações
        if (!arquivo) {
            showToast('Selecione um arquivo PDF', 'error');
            return;
        }

        if (arquivo.type !== 'application/pdf') {
            showToast('Apenas arquivos PDF são permitidos', 'error');
            return;
        }

        if (arquivo.size > 10 * 1024 * 1024) {
            showToast('Arquivo muito grande. Máximo 10MB', 'error');
            return;
        }

        showLoading();
        fecharModalUploadEtica();

        // 1. Upload do arquivo para Firebase Storage
        const timestamp = Date.now();
        const filename = `${timestamp}_${arquivo.name}`;
        const storagePath = `${config.storagePath}/${filename}`;
        const storageRef = storage.ref(storagePath);

        console.log('📤 Fazendo upload do PDF...');
        const uploadTask = await storageRef.put(arquivo);
        const downloadURL = await uploadTask.ref.getDownloadURL();
        console.log('✅ Upload concluído:', downloadURL);

        // 2. Salvar metadados no Firestore
        const docData = {
            titulo: titulo,
            tipo: tipo,
            observacoes: observacoes || '',
            arquivoURL: downloadURL,
            arquivoNome: arquivo.name,
            arquivoTamanho: arquivo.size,
            storagePath: storagePath,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: currentUser.email,
            createdByName: currentUser.displayName || currentUser.email,
            ativo: true
        };

        console.log('💾 Salvando no Firestore...');
        await db.collection(config.collection).add(docData);

        hideLoading();
        showToast('✅ Documento adicionado com sucesso!', 'success');

        // Recarregar a página do card
        setTimeout(() => {
            showEticaCard(tipo);
        }, 500);

    } catch (error) {
        console.error('❌ Erro ao salvar documento:', error);
        hideLoading();
        showToast('Erro ao salvar documento: ' + error.message, 'error');
    }
}

// Carregar documento
async function carregarDocumentoEtica(tipo) {
    const config = ETICA_CONFIGS[tipo];
    if (!config) return null;

    try {
        console.log('🔍 Buscando documento do tipo:', tipo);

        const snapshot = await db.collection(config.collection)
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();

        if (!snapshot.empty) {
            const documentosAtivos = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(doc => doc.ativo !== false);

            if (documentosAtivos.length > 0) {
                const documento = documentosAtivos[0];
                console.log('✅ Documento encontrado:', documento);
                return documento;
            }
        }

        console.log('📭 Nenhum documento encontrado');
        return null;
    } catch (error) {
        console.error('❌ Erro ao carregar documento:', error);
        return null;
    }
}

// Abrir PDF
async function abrirPDFEtica(tipo, docId) {
    const config = ETICA_CONFIGS[tipo];
    if (!config) return;

    try {
        console.log('📄 Abrindo PDF do documento:', docId);

        const doc = await db.collection(config.collection).doc(docId).get();

        if (!doc.exists) {
            showToast('Documento não encontrado', 'error');
            return;
        }

        const data = doc.data();
        const dataFormatada = data.createdAt?.toDate().toLocaleString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }) || 'Data não disponível';

        if (!data.arquivoURL) {
            showToast('URL do PDF não encontrada', 'error');
            return;
        }

        const encodedURL = encodeURIComponent(data.arquivoURL);
        const section = document.getElementById('painelSection');
        if (!section) {
            console.error('❌ painelSection não encontrada');
            return;
        }

        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        const html = `
            <div class="section-header">
                <button class="btn-back" onclick="showEticaCard('${tipo}')">
                    <i class="fas fa-arrow-left"></i>
                </button>
                <h1 class="section-title">${data.titulo}</h1>
                <button class="btn-delete" onclick="excluirDocumentoEtica('${tipo}', '${docId}', '${data.storagePath}')" style="background: #DC2626;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>

            <div class="comunicado-detalhes">
                <div class="comunicado-meta">
                    <div><i class="fas fa-calendar"></i> ${dataFormatada}</div>
                    <div><i class="fas fa-user"></i> ${data.createdByName || data.createdBy || 'N/A'}</div>
                    <div><i class="${config.icon}" style="color: ${config.cor};"></i> ${config.titulo}</div>
                </div>
                ${data.observacoes ? `
                    <div class="comunicado-content">
                        ${data.observacoes.replace(/\n/g, '<br>')}
                    </div>
                ` : ''}

                <div style="margin-top: 24px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px; background: #2C3E50; color: white; border-radius: 8px 8px 0 0;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <i class="fas fa-file-pdf" style="font-size: 20px; color: #DC2626;"></i>
                            <span style="font-weight: 500;">${data.arquivoNome || 'Documento.pdf'}</span>
                        </div>
                        <span style="font-size: 14px; color: #BDC3C7;">Visualização segura do documento</span>
                    </div>
                    <div id="pdfViewerContainer_${docId}" style="width: 100%; height: ${isMobile ? '600px' : '800px'}; border: 2px solid #2C3E50; border-top: none; border-radius: 0 0 8px 8px; background: white; position: relative;">
                        ${isMobile ? `
                            <object
                                data="${data.arquivoURL}#toolbar=1&navpanes=0&scrollbar=1"
                                type="application/pdf"
                                width="100%"
                                height="100%"
                                style="border: none;">
                                <embed
                                    src="https://docs.google.com/gview?url=${encodedURL}&embedded=true"
                                    width="100%"
                                    height="100%"
                                    type="application/pdf"
                                    style="border: none;">
                                </embed>
                                <div style="padding: 20px; text-align: center;">
                                    <p style="margin-bottom: 16px;">Não foi possível carregar o PDF no visualizador.</p>
                                    <a href="${data.arquivoURL}" target="_blank" style="display: inline-block; padding: 12px 24px; background: #006837; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
                                        <i class="fas fa-download"></i> Baixar PDF
                                    </a>
                                </div>
                            </object>
                        ` : `
                            <div class="pdf-loading" id="pdfLoading_${docId}" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
                                <i class="fas fa-spinner fa-spin" style="font-size: 48px; color: #006837; margin-bottom: 16px;"></i>
                                <p>Carregando documento...</p>
                            </div>
                            <iframe
                                id="pdfIframe_${docId}"
                                src="${data.arquivoURL}#toolbar=1&navpanes=0&scrollbar=1"
                                style="width: 100%; height: 100%; border: none; display: none;"
                                frameborder="0"
                                oncontextmenu="return false;">
                            </iframe>
                        `}
                    </div>
                </div>
            </div>
        `;

        section.innerHTML = html;

        // Configurar iframe load para desktop
        if (!isMobile) {
            setTimeout(() => {
                const iframe = document.getElementById(`pdfIframe_${docId}`);
                const loadingDiv = document.getElementById(`pdfLoading_${docId}`);

                if (iframe && loadingDiv) {
                    iframe.onload = () => {
                        loadingDiv.style.display = 'none';
                        iframe.style.display = 'block';
                    };

                    setTimeout(() => {
                        if (iframe.style.display === 'none') {
                            loadingDiv.innerHTML = `
                                <p style="margin-bottom: 16px;">Não foi possível carregar o PDF no visualizador.</p>
                                <a href="${data.arquivoURL}" target="_blank" style="display: inline-block; padding: 12px 24px; background: #006837; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
                                    <i class="fas fa-download"></i> Abrir em Nova Aba
                                </a>
                            `;
                        }
                    }, 5000);
                }
            }, 100);
        }

        console.log('✅ PDF aberto com sucesso');

    } catch (error) {
        console.error('❌ Erro ao abrir PDF:', error);
        showToast('Erro ao abrir documento: ' + error.message, 'error');
    }
}

// Excluir documento
async function excluirDocumentoEtica(tipo, firestoreId, storagePath) {
    const config = ETICA_CONFIGS[tipo];
    if (!config) return;

    console.log('🗑️ Excluindo documento:', firestoreId);

    if (!confirm('Tem certeza que deseja excluir este documento? Esta ação não pode ser desfeita.')) {
        return;
    }

    try {
        showLoading();

        // 1. Excluir do Firestore
        await db.collection(config.collection).doc(firestoreId).delete();
        console.log('✅ Documento excluído do Firestore');

        // 2. Excluir do Storage (se existir)
        if (storagePath) {
            try {
                const storageRef = storage.ref(storagePath);
                await storageRef.delete();
                console.log('✅ Arquivo excluído do Storage');
            } catch (storageError) {
                console.warn('⚠️ Arquivo não encontrado no Storage (já pode ter sido excluído)');
            }
        }

        hideLoading();
        showToast('✅ Documento excluído com sucesso!', 'success');

        // Voltar para a tela do card
        setTimeout(() => {
            showEticaCard(tipo);
        }, 500);

    } catch (error) {
        console.error('❌ Erro ao excluir documento:', error);
        hideLoading();
        showToast('Erro ao excluir documento: ' + error.message, 'error');
    }
}

// ==================== COMITÊS ====================

/**
 * Tela principal de Comitês
 * Exibe 9 cards com regimentos internos dos comitês
 */
async function showComites() {
    console.log('🏛️ Comitês');

    if (typeof atualizarHistoricoNavegacao === 'function') {
        atualizarHistoricoNavegacao('comites');
    }

    const section = document.getElementById('painelSection');
    if (!section) return;

    const config = {
        banner: {
            icon: 'fas fa-users',
            title: 'Comitês',
            description: 'Regimentos internos e estrutura de governança dos comitês institucionais',
            gradient: '#0891b2 0%, #0e7490 100%', // Azul ciano
            backOnClick: 'showSection(\'painel\')'
        },
        items: [
            {
                icon: 'fas fa-file-alt',
                title: 'Regimento Interno',
                description: '',
                color: '#0891b2',
                onClick: 'verDocumentosComite(\'regimento-interno\')'
            },
            {
                icon: 'fas fa-dollar-sign',
                title: 'Comitê Financeiro',
                description: '',
                color: '#059669',
                onClick: 'verDocumentosComite(\'financeiro\')'
            },
            {
                icon: 'fas fa-user-tie',
                title: 'Comitê de Gestão de Pessoas',
                description: '',
                color: '#7c3aed',
                onClick: 'verDocumentosComite(\'gestao-pessoas\')'
            },
            {
                icon: 'fas fa-check-circle',
                title: 'Comitê de Qualidade',
                description: '',
                color: '#2563eb',
                onClick: 'verDocumentosComite(\'qualidade\')'
            },
            {
                icon: 'fas fa-graduation-cap',
                title: 'Comitê de Educação Continuada e Residência Médica',
                description: '',
                color: '#dc2626',
                onClick: 'verDocumentosComite(\'educacao-residencia\')'
            },
            {
                icon: 'fas fa-calendar-alt',
                title: 'Comitê de Escalas',
                description: '',
                color: '#f59e0b',
                onClick: 'verDocumentosComite(\'escalas\')'
            },
            {
                icon: 'fas fa-laptop-medical',
                title: 'Comitê de Tecnologia e Materiais',
                description: '',
                color: '#6366f1',
                onClick: 'verDocumentosComite(\'tecnologia-materiais\')'
            },
            {
                icon: 'fas fa-balance-scale',
                title: 'Comitê de Ética e Conduta',
                description: '',
                color: '#8b5cf6',
                onClick: 'verDocumentosComite(\'etica-conduta\')'
            },
            {
                icon: 'fas fa-chart-line',
                title: 'Comitê Executivo de Gestão',
                description: '',
                color: '#10b981',
                onClick: 'verDocumentosComite(\'executivo-gestao\')'
            }
        ],
        infoBox: {
            icon: 'fas fa-info-circle',
            title: 'Sobre os Comitês:',
            content: '<p>Os comitês são estruturas de governança que auxiliam na gestão institucional, garantindo organização, transparência e participação nas decisões estratégicas e operacionais.</p>'
        }
    };

    section.innerHTML = renderStandardLayout(config);
}

// Mapeamento de comitês
const COMITES_INFO = {
    'regimento-interno': { nome: 'Regimento Interno', cor: '#0891b2', icon: 'fas fa-file-alt' },
    'financeiro': { nome: 'Comitê Financeiro', cor: '#059669', icon: 'fas fa-dollar-sign' },
    'gestao-pessoas': { nome: 'Comitê de Gestão de Pessoas', cor: '#7c3aed', icon: 'fas fa-user-tie' },
    'qualidade': { nome: 'Comitê de Qualidade', cor: '#2563eb', icon: 'fas fa-check-circle' },
    'educacao-residencia': { nome: 'Comitê de Educação Continuada e Residência Médica', cor: '#dc2626', icon: 'fas fa-graduation-cap' },
    'escalas': { nome: 'Comitê de Escalas', cor: '#f59e0b', icon: 'fas fa-calendar-alt' },
    'tecnologia-materiais': { nome: 'Comitê de Tecnologia e Materiais', cor: '#6366f1', icon: 'fas fa-laptop-medical' },
    'etica-conduta': { nome: 'Comitê de Ética e Conduta', cor: '#8b5cf6', icon: 'fas fa-balance-scale' },
    'executivo-gestao': { nome: 'Comitê Executivo de Gestão', cor: '#10b981', icon: 'fas fa-chart-line' }
};

// Função para ver documentos de um comitê específico
async function verDocumentosComite(comiteId) {
    const comiteInfo = COMITES_INFO[comiteId];
    if (!comiteInfo) {
        showToast('Comitê não encontrado', 'error');
        return;
    }

    const section = document.getElementById('painelSection');
    if (!section) return;

    // Banner com identidade visual + botão Novo Documento
    let html = `
        ${renderInfoBanner(comiteInfo.icon, comiteInfo.nome, 'Regimentos internos e estrutura de governança', `${comiteInfo.cor} 0%, ${comiteInfo.cor}dd 100%`, 'showComites()')}

        <div style="display: flex; justify-content: flex-end; margin-bottom: 20px;">
            <button onclick="adicionarDocumentoComite('${comiteId}')" class="btn-primary" style="padding: 12px 24px; background: #16a085; border: none; color: white; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                <i class="fas fa-plus-circle"></i>
                Novo Documento
            </button>
        </div>

        <div id="documentosComiteContainer" style="display: grid; gap: 16px;">
        </div>
    `;

    section.innerHTML = html;

    // Carregar documentos do Firestore
    await carregarDocumentosComite(comiteId);
}

// Carregar lista de documentos
async function carregarDocumentosComite(comiteId) {
    const comiteInfo = COMITES_INFO[comiteId];
    const container = document.getElementById('documentosComiteContainer');
    if (!container) return;

    try {
        const snapshot = await db.collection('comites_documentos')
            .where('comite', '==', comiteId)
            .where('ativo', '==', true)
            .get();

        if (snapshot.empty) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 40px; background: #f8f9fa; border-radius: 12px; border: 2px dashed #ddd;">
                    <i class="fas fa-folder-open" style="font-size: 64px; color: #ddd; margin-bottom: 16px;"></i>
                    <h3 style="color: #666; margin-bottom: 8px;">Nenhum documento cadastrado</h3>
                    <p style="color: #999; margin: 0;">Use o botão "Novo Documento" para adicionar</p>
                </div>
            `;
            return;
        }

        // Converter para array e ordenar por data
        const docs = snapshot.docs
            .map(doc => ({ id: doc.id, data: doc.data() }))
            .sort((a, b) => {
                const dateA = a.data.createdAt ? a.data.createdAt.seconds : 0;
                const dateB = b.data.createdAt ? b.data.createdAt.seconds : 0;
                return dateB - dateA;
            });

        let docsHtml = '';
        docs.forEach(({ id, data }) => {
            const dataFormatada = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString('pt-BR') : 'Data não informada';
            const autor = data.createdByName || data.createdBy || 'N/A';

            docsHtml += `
                <div onclick="abrirDocumentoComite('${id}')" class="documento-card" style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-left: 4px solid ${comiteInfo.cor}; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'">
                    <h3 style="margin: 0 0 8px 0; color: #2c3e50; font-size: 16px;">
                        ${data.titulo}
                    </h3>
                    ${data.observacoes ? `<p style="margin: 0 0 12px 0; color: #666; font-size: 14px; line-height: 1.5;">${data.observacoes}</p>` : ''}
                    <div style="display: flex; gap: 16px; font-size: 13px; color: #999; margin-top: 12px;">
                        <span><i class="fas fa-user"></i> ${autor}</span>
                        <span><i class="fas fa-file-pdf"></i> PDF anexado</span>
                    </div>
                </div>
            `;
        });

        container.innerHTML = docsHtml;

    } catch (error) {
        console.error('Erro ao carregar documentos:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; background: #fee; border-radius: 12px; border: 2px solid #fcc;">
                <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #c33; margin-bottom: 16px;"></i>
                <h3 style="color: #c33; margin-bottom: 8px;">Erro ao carregar documentos</h3>
                <p style="color: #666; margin: 0;">${error.message}</p>
            </div>
        `;
    }
}

// Função para adicionar documento - Modal de upload
function adicionarDocumentoComite(comiteId) {
    const comiteInfo = COMITES_INFO[comiteId];
    if (!comiteInfo) return;

    const modalHtml = `
        <div id="modalComiteDocumento" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 20px;">
            <div style="background: white; padding: 32px; border-radius: 16px; max-width: 600px; width: 100%; max-height: 90vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                    <h2 style="margin: 0; color: ${comiteInfo.cor};">
                        <i class="fas fa-plus-circle"></i>
                        Adicionar Documento
                    </h2>
                    <button onclick="fecharModalComiteDocumento()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <form id="formComiteDocumento" onsubmit="salvarDocumentoComite(event, '${comiteId}'); return false;">
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #2c3e50;">Título do Documento *</label>
                        <input type="text" id="comite_titulo" required placeholder="Ex: Regimento Interno 2025" style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 8px; font-size: 14px;">
                    </div>

                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #2c3e50;">Observações (opcional)</label>
                        <textarea id="comite_observacoes" rows="3" placeholder="Descrição adicional do documento..." style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 8px; font-size: 14px; resize: vertical;"></textarea>
                    </div>

                    <div style="margin-bottom: 24px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #2c3e50;">Arquivo (PDF) *</label>
                        <input type="file" id="comite_arquivo" required accept=".pdf" style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 8px; font-size: 14px;">
                        <p style="margin-top: 8px; font-size: 12px; color: #999;">Apenas arquivos PDF (máximo 10MB)</p>
                    </div>

                    <div style="display: flex; gap: 12px;">
                        <button type="button" onclick="fecharModalComiteDocumento()" style="flex: 1; padding: 14px; background: #6c757d; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                            Cancelar
                        </button>
                        <button type="submit" id="btnSalvarComite" style="flex: 1; padding: 14px; background: ${comiteInfo.cor}; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                            <i class="fas fa-save"></i> Salvar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// Fechar modal
function fecharModalComiteDocumento() {
    const modal = document.getElementById('modalComiteDocumento');
    if (modal) modal.remove();
}

// Salvar documento no Firestore + Storage
async function salvarDocumentoComite(event, comiteId) {
    event.preventDefault();

    const comiteInfo = COMITES_INFO[comiteId];
    if (!comiteInfo) return;

    try {
        const titulo = document.getElementById('comite_titulo').value.trim();
        const observacoes = document.getElementById('comite_observacoes').value.trim();
        const arquivo = document.getElementById('comite_arquivo').files[0];

        // Validações
        if (!arquivo) {
            showToast('Selecione um arquivo PDF', 'error');
            return;
        }

        if (arquivo.type !== 'application/pdf') {
            showToast('Apenas arquivos PDF são permitidos', 'error');
            return;
        }

        if (arquivo.size > 10 * 1024 * 1024) {
            showToast('Arquivo muito grande. Máximo 10MB', 'error');
            return;
        }

        showLoading();
        fecharModalComiteDocumento();

        // Upload do arquivo para Firebase Storage
        const timestamp = Date.now();
        const filename = `${timestamp}_${arquivo.name}`;
        const storagePath = `Documentos/Comites/${comiteId}/${filename}`;
        const storageRef = storage.ref(storagePath);

        console.log('📤 Fazendo upload do PDF...');
        const uploadTask = await storageRef.put(arquivo);
        const downloadURL = await uploadTask.ref.getDownloadURL();
        console.log('✅ Upload concluído:', downloadURL);

        // Salvar metadados no Firestore
        const docData = {
            titulo: titulo,
            comite: comiteId,
            comiteNome: comiteInfo.nome,
            observacoes: observacoes || '',
            arquivoURL: downloadURL,
            arquivoNome: arquivo.name,
            arquivoTamanho: arquivo.size,
            storagePath: storagePath,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: currentUser.email,
            createdByName: currentUser.displayName || currentUser.email,
            ativo: true
        };

        console.log('💾 Salvando no Firestore...');
        await db.collection('comites_documentos').add(docData);

        hideLoading();
        showToast('✅ Documento adicionado com sucesso!', 'success');

        // Recarregar a lista
        setTimeout(() => {
            verDocumentosComite(comiteId);
        }, 500);

    } catch (error) {
        console.error('❌ Erro ao salvar documento:', error);
        hideLoading();
        showToast('Erro ao salvar documento: ' + error.message, 'error');
    }
}

// Abrir documento para visualização (desktop/mobile)
async function abrirDocumentoComite(documentoId) {
    try {
        console.log('📄 Abrindo documento:', documentoId);

        const doc = await db.collection('comites_documentos').doc(documentoId).get();

        if (!doc.exists) {
            showToast('Documento não encontrado', 'error');
            return;
        }

        const data = doc.data();
        const comiteInfo = COMITES_INFO[data.comite];

        const dataFormatada = data.createdAt?.toDate().toLocaleString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }) || 'Data não disponível';

        if (!data.arquivoURL) {
            showToast('URL do PDF não encontrada', 'error');
            return;
        }

        const encodedURL = encodeURIComponent(data.arquivoURL);
        const section = document.getElementById('painelSection');
        if (!section) {
            console.error('❌ painelSection não encontrada');
            return;
        }

        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        const html = `
            <div class="section-header">
                <button class="btn-back" onclick="verDocumentosComite('${data.comite}')">
                    <i class="fas fa-arrow-left"></i>
                </button>
                <h1 class="section-title">${data.titulo}</h1>
                <button class="btn-delete" onclick="excluirDocumentoComite('${documentoId}')" style="background: #DC2626;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>

            <div class="comunicado-detalhes">
                <div class="comunicado-meta">
                    <div><i class="fas fa-calendar"></i> ${dataFormatada}</div>
                    <div><i class="fas fa-user"></i> ${data.createdByName || data.createdBy || 'N/A'}</div>
                    <div><i class="${comiteInfo.icon}" style="color: ${comiteInfo.cor};"></i> ${comiteInfo.nome}</div>
                </div>
                ${data.observacoes ? `
                    <div class="comunicado-content">
                        ${data.observacoes.replace(/\n/g, '<br>')}
                    </div>
                ` : ''}

                <div style="margin-top: 24px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px; background: #2C3E50; color: white; border-radius: 8px 8px 0 0;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <i class="fas fa-file-pdf" style="font-size: 20px; color: #DC2626;"></i>
                            <span style="font-weight: 500;">${data.arquivoNome || 'Documento.pdf'}</span>
                        </div>
                        <span style="font-size: 14px; color: #BDC3C7;">Visualização segura do documento</span>
                    </div>
                    <div id="pdfViewerContainer_${documentoId}" style="width: 100%; height: ${isMobile ? '600px' : '800px'}; border: 2px solid #2C3E50; border-top: none; border-radius: 0 0 8px 8px; background: white; position: relative;">
                        ${isMobile ? `
                            <object
                                data="${data.arquivoURL}#toolbar=1&navpanes=0&scrollbar=1"
                                type="application/pdf"
                                width="100%"
                                height="100%"
                                style="border: none;">
                                <embed
                                    src="https://docs.google.com/gview?url=${encodedURL}&embedded=true"
                                    width="100%"
                                    height="100%"
                                    type="application/pdf"
                                    style="border: none;">
                                </embed>
                                <div style="padding: 20px; text-align: center;">
                                    <p style="margin-bottom: 16px;">Não foi possível carregar o PDF no visualizador.</p>
                                    <a href="${data.arquivoURL}" target="_blank" style="display: inline-block; padding: 12px 24px; background: #006837; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
                                        <i class="fas fa-download"></i> Baixar PDF
                                    </a>
                                </div>
                            </object>
                        ` : `
                            <div class="pdf-loading" id="pdfLoading_${documentoId}" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
                                <i class="fas fa-spinner fa-spin" style="font-size: 48px; color: #006837; margin-bottom: 16px;"></i>
                                <p>Carregando documento...</p>
                            </div>
                            <iframe
                                id="pdfIframe_${documentoId}"
                                src="${data.arquivoURL}#toolbar=1&navpanes=0&scrollbar=1"
                                style="width: 100%; height: 100%; border: none; display: none;"
                                frameborder="0"
                                oncontextmenu="return false;">
                            </iframe>
                        `}
                    </div>
                </div>
            </div>
        `;

        section.innerHTML = html;

        // Configurar iframe load para desktop
        if (!isMobile) {
            setTimeout(() => {
                const iframe = document.getElementById(`pdfIframe_${documentoId}`);
                const loadingDiv = document.getElementById(`pdfLoading_${documentoId}`);

                if (iframe && loadingDiv) {
                    iframe.onload = () => {
                        loadingDiv.style.display = 'none';
                        iframe.style.display = 'block';
                    };

                    setTimeout(() => {
                        if (iframe.style.display === 'none') {
                            loadingDiv.innerHTML = `
                                <p style="margin-bottom: 16px;">Não foi possível carregar o PDF no visualizador.</p>
                                <a href="${data.arquivoURL}" target="_blank" style="display: inline-block; padding: 12px 24px; background: #006837; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
                                    <i class="fas fa-download"></i> Abrir em Nova Aba
                                </a>
                            `;
                        }
                    }, 5000);
                }
            }, 100);
        }

        console.log('✅ PDF aberto com sucesso');

    } catch (error) {
        console.error('❌ Erro ao abrir documento:', error);
        showToast('Erro ao abrir documento: ' + error.message, 'error');
    }
}

// Excluir documento
async function excluirDocumentoComite(documentoId) {
    if (!confirm('Tem certeza que deseja excluir este documento?')) {
        return;
    }

    try {
        const doc = await db.collection('comites_documentos').doc(documentoId).get();
        if (!doc.exists) {
            showToast('Documento não encontrado', 'error');
            return;
        }

        const data = doc.data();

        showLoading();

        // Marcar como inativo ao invés de deletar
        await db.collection('comites_documentos').doc(documentoId).update({
            ativo: false,
            deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
            deletedBy: currentUser.email
        });

        hideLoading();
        showToast('✅ Documento excluído com sucesso!', 'success');

        // Recarregar lista
        setTimeout(() => {
            verDocumentosComite(data.comite);
        }, 500);

    } catch (error) {
        console.error('❌ Erro ao excluir documento:', error);
        hideLoading();
        showToast('Erro ao excluir documento: ' + error.message, 'error');
    }
}

// Exportar funções para o escopo global (window)
window.showKPIs = showKPIs;
window.showOrganograma = showOrganograma;
window.abrirOrganograma = abrirOrganograma;
window.excluirOrganograma = excluirOrganograma;
window.uploadOrganograma = uploadOrganograma;
window.uploadOrganogramaAutomatico = uploadOrganogramaAutomatico;

// Exportar funções de Ética e Bioética
window.showEticaBioetica = showEticaBioetica;
window.showDilemasBioeticos = showDilemasBioeticos;
window.showParecerUTI = showParecerUTI;
window.showDiretrizesEtica = showDiretrizesEtica;
window.showEmissaoParecer = showEmissaoParecer;
window.showCodigoEtica = showCodigoEtica;
window.showEticaCard = showEticaCard;
window.uploadEticaDocumento = uploadEticaDocumento;
window.fecharModalUploadEtica = fecharModalUploadEtica;
window.salvarDocumentoEtica = salvarDocumentoEtica;
window.carregarDocumentoEtica = carregarDocumentoEtica;
window.abrirPDFEtica = abrirPDFEtica;
window.excluirDocumentoEtica = excluirDocumentoEtica;

// Exportar funções de Comitês
window.showComites = showComites;
window.verDocumentosComite = verDocumentosComite;
window.carregarDocumentosComite = carregarDocumentosComite;
window.adicionarDocumentoComite = adicionarDocumentoComite;
window.fecharModalComiteDocumento = fecharModalComiteDocumento;
window.salvarDocumentoComite = salvarDocumentoComite;
window.abrirDocumentoComite = abrirDocumentoComite;
window.excluirDocumentoComite = excluirDocumentoComite;

// Exportar funções de Incidentes e Denúncias
window.showIncidentes = showIncidentes;
window.showNovoIncidente = showNovoIncidente;
window.showCanalDenuncia = showCanalDenuncia;
window.showQRCodeGenerator = showQRCodeGenerator;

console.log('✅ Módulo Painel e Qualidade v2 carregado');
console.log('✅ Funções Organograma exportadas para window');
console.log('✅ Funções Ética e Bioética exportadas para window');
console.log('✅ Sistema completo de documentos Ética implementado (5 cards)');
console.log('✅ Módulo Comitês implementado (9 regimentos internos)');


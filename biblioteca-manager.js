// ==================== GERENCIAMENTO DE DOCUMENTOS DA BIBLIOTECA ====================
// Sistema para adicionar documentos à Biblioteca de Documentos
// Preserva os documentos estáticos existentes

async function showModalNovoBibliotecaDocumento() {
    console.log('📚 Abrindo modal Novo Documento - Biblioteca');
    
    const modal = document.getElementById('modalNovoDocumento') || criarModalNovoDocumento();
    
    modal.innerHTML = `
        <div style="background: var(--bg-card, white); border-radius: 16px; max-width: 700px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
            <div style="padding: 24px; border-bottom: 1px solid var(--border-color, #e5e7eb); display: flex; justify-content: space-between; align-items: center;">
                <h2 style="margin: 0; color: var(--text-primary, #1f2937); font-size: 24px; display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-plus-circle" style="color: #006837;"></i> Novo Documento
                </h2>
                <button onclick="fecharModalBiblioteca()" style="background: none; border: none; font-size: 24px; color: var(--text-light, #9ca3af); cursor: pointer; padding: 4px 8px; transition: color 0.3s;" onmouseover="this.style.color='#1f2937'" onmouseout="this.style.color='#9ca3af'">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <form id="formNovoBiblioteca" onsubmit="event.preventDefault(); salvarDocumentoBiblioteca();" style="padding: 24px;">
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary, #1f2937); font-size: 15px;">
                        <i class="fas fa-tag" style="margin-right: 6px;"></i> Categoria *
                    </label>
                    <select id="bib_categoria" required style="width: 100%; padding: 12px; border: 1px solid var(--border-color, #e5e7eb); border-radius: 8px; font-size: 15px; background: var(--bg-card, white); color: var(--text-primary, #1f2937); outline: none; transition: border-color 0.3s;" onfocus="this.style.borderColor='#006837'" onblur="this.style.borderColor='var(--border-color, #e5e7eb)'">
                        <option value="">Selecione uma categoria...</option>
                        <option value="Ficha Tecnica Indicadores">📊 Ficha Tecnica Indicadores</option>
                        <option value="Formularios">📝 Formularios</option>
                        <option value="Manuais">📚 Manuais</option>
                        <option value="Mapeamento de Processos">🗺️ Mapeamento de Processos</option>
                        <option value="Mapeamento dos Riscos">⚠️ Mapeamento dos Riscos</option>
                        <option value="Plano de Seguranca do Paciente">🛡️ Plano de Seguranca do Paciente</option>
                        <option value="Politicas">📜 Politicas</option>
                        <option value="Protocolos">📋 Protocolos</option>
                        <option value="Relatorios de Seguranca">📊 Relatorios de Seguranca</option>
                        <option value="Termos">📑 Termos</option>
                        <option value="Auditorias">🔍 Auditorias</option>
                    </select>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary, #1f2937); font-size: 15px;">
                        <i class="fas fa-heading" style="margin-right: 6px;"></i> Título *
                    </label>
                    <input type="text" id="bib_titulo" placeholder="Ex: Nova Política de Segurança" required style="width: 100%; padding: 12px; border: 1px solid var(--border-color, #e5e7eb); border-radius: 8px; font-size: 15px; background: var(--bg-card, white); color: var(--text-primary, #1f2937); outline: none; transition: border-color 0.3s;" onfocus="this.style.borderColor='#006837'" onblur="this.style.borderColor='var(--border-color, #e5e7eb)'">
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary, #1f2937); font-size: 15px;">
                        <i class="fas fa-code" style="margin-right: 6px;"></i> Código do Documento
                    </label>
                    <input type="text" id="bib_codigo" placeholder="Ex: PRO.001" style="width: 100%; padding: 12px; border: 1px solid var(--border-color, #e5e7eb); border-radius: 8px; font-size: 15px; background: var(--bg-card, white); color: var(--text-primary, #1f2937); outline: none; transition: border-color 0.3s;" onfocus="this.style.borderColor='#006837'" onblur="this.style.borderColor='var(--border-color, #e5e7eb)'">
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary, #1f2937); font-size: 15px;">
                        <i class="fas fa-align-left" style="margin-right: 6px;"></i> Descrição
                    </label>
                    <textarea id="bib_descricao" rows="4" placeholder="Descreva o documento..." style="width: 100%; padding: 12px; border: 1px solid var(--border-color, #e5e7eb); border-radius: 8px; font-size: 15px; background: var(--bg-card, white); color: var(--text-primary, #1f2937); outline: none; resize: vertical; font-family: inherit; transition: border-color 0.3s;" onfocus="this.style.borderColor='#006837'" onblur="this.style.borderColor='var(--border-color, #e5e7eb)'"></textarea>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary, #1f2937); font-size: 15px;">
                        <i class="fas fa-paperclip" style="margin-right: 6px;"></i> Anexos (opcional)
                    </label>
                    <input type="file" id="bib_arquivo" accept=".pdf" required style="width: 100%; padding: 12px; border: 1px solid var(--border-color, #e5e7eb); border-radius: 8px; font-size: 14px; background: var(--bg-card, white); color: var(--text-primary, #1f2937); outline: none; cursor: pointer; transition: border-color 0.3s;" onfocus="this.style.borderColor='#006837'" onblur="this.style.borderColor='var(--border-color, #e5e7eb)'">
                    <small style="display: block; margin-top: 6px; color: var(--text-secondary, #6b7280); font-size: 13px;">
                        <i class="fas fa-info-circle" style="margin-right: 4px;"></i> Máximo 10MB. Apenas arquivos PDF.
                    </small>
                </div>
                
                <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--border-color, #e5e7eb);">
                    <button type="button" onclick="fecharModalBiblioteca()" style="padding: 12px 24px; background: var(--bg-secondary, #f3f4f6); color: var(--text-primary, #1f2937); border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background='var(--bg-secondary, #f3f4f6)'">
                        <i class="fas fa-times" style="margin-right: 6px;"></i> Cancelar
                    </button>
                    <button type="submit" style="padding: 12px 24px; background: linear-gradient(135deg, #006837 0%, #9BC53D 100%); color: white; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.3s; box-shadow: 0 4px 12px rgba(0, 104, 55, 0.3);" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(0, 104, 55, 0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(0, 104, 55, 0.3)'">
                        <i class="fas fa-save" style="margin-right: 6px;"></i> Salvar Documento
                    </button>
                </div>
            </form>
        </div>
    `;
    
    modal.style.display = 'flex';
}

function criarModalNovoDocumento() {
    const modal = document.createElement('div');
    modal.id = 'modalNovoDocumento';
    modal.className = 'modal';
    modal.style.cssText = `
        display: none;
        position: fixed;
        z-index: 10000;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        align-items: center;
        justify-content: center;
        padding: 20px;
    `;
    document.body.appendChild(modal);
    return modal;
}

function fecharModalBiblioteca() {
    const modal = document.getElementById('modalNovoDocumento');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function salvarDocumentoBiblioteca() {
    console.log('💾 Salvando documento na Biblioteca...');
    
    try {
        // Coletar dados do formulário
        const titulo = document.getElementById('bib_titulo').value.trim();
        const categoria = document.getElementById('bib_categoria').value;
        const descricao = document.getElementById('bib_descricao').value.trim();
        const codigo = document.getElementById('bib_codigo').value.trim();
        const arquivo = document.getElementById('bib_arquivo').files[0];
        
        // Validações
        if (!titulo || !categoria) {
            showToast('Preencha todos os campos obrigatórios', 'error');
            return;
        }
        
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
        
        // 1. Upload do arquivo para Firebase Storage
        const timestamp = Date.now();
        const filename = `${timestamp}_${arquivo.name}`;
        const storagePath = `biblioteca_documentos/${filename}`;
        const storageRef = storage.ref(storagePath);
        
        console.log('📤 Fazendo upload do PDF...');
        const uploadTask = await storageRef.put(arquivo);
        const downloadURL = await uploadTask.ref.getDownloadURL();
        console.log('✅ Upload concluído:', downloadURL);
        
        // 2. Salvar metadados no Firestore
        const docData = {
            titulo: titulo,
            categoria: categoria,
            descricao: descricao || '',
            codigo: codigo || '',
            arquivo: {
                url: downloadURL,
                nome: arquivo.name,
                tamanho: arquivo.size,
                storagePath: storagePath  // Adicionar o caminho para facilitar a exclusão
            },
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: currentUser.email,
            createdByName: currentUser.displayName || currentUser.email,
            ativo: true
        };
        
        console.log('💾 Salvando no Firestore...');
        await db.collection('biblioteca_documentos').add(docData);
        
        hideLoading();
        showToast('✅ Documento adicionado com sucesso!', 'success');
        fecharModalBiblioteca();
        
        // Recarregar a biblioteca para mostrar o novo documento
        setTimeout(() => {
            showBiblioteca();
        }, 500);
        
    } catch (error) {
        console.error('❌ Erro ao salvar documento:', error);
        hideLoading();
        showToast('Erro ao salvar documento: ' + error.message, 'error');
    }
}

// ==================== FUNÇÃO DE EXCLUSÃO ====================

async function excluirDocumentoBiblioteca(firestoreId, storagePath) {
    console.log('🗑️ Excluindo documento:', firestoreId);
    
    if (!confirm('Tem certeza que deseja excluir este documento? Esta ação não pode ser desfeita.')) {
        return;
    }
    
    try {
        showLoading();
        
        // 1. Excluir do Firestore
        await db.collection('biblioteca_documentos').doc(firestoreId).delete();
        console.log('✅ Documento excluído do Firestore');
        
        // 2. Excluir do Storage (se existir)
        if (storagePath) {
            try {
                const storageRef = storage.ref(storagePath);
                await storageRef.delete();
                console.log('✅ Arquivo excluído do Storage');
            } catch (storageError) {
                console.warn('⚠️ Erro ao excluir do Storage (arquivo pode não existir):', storageError);
            }
        }
        
        hideLoading();
        showToast('✅ Documento excluído com sucesso!', 'success');
        
        // Recarregar biblioteca
        setTimeout(() => {
            showBiblioteca();
        }, 500);
        
    } catch (error) {
        console.error('❌ Erro ao excluir documento:', error);
        hideLoading();
        showToast('Erro ao excluir documento: ' + error.message, 'error');
    }
}

// Expor funções globalmente
window.showModalNovoBibliotecaDocumento = showModalNovoBibliotecaDocumento;
window.fecharModalBiblioteca = fecharModalBiblioteca;
window.salvarDocumentoBiblioteca = salvarDocumentoBiblioteca;
window.excluirDocumentoBiblioteca = excluirDocumentoBiblioteca;

console.log('✅ biblioteca-manager.js carregado!');

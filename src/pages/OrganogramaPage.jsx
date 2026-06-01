import { useState, useCallback } from 'react';
import { SectionCard, ConfirmDialog } from '@/design-system';
import { GraduationCap, Network, Pencil, Check, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components';
import { OrgAccordion, OrgDetailModal, OrgEditModal, ORGANOGRAMA_DATA } from '@/components/organograma';
import { useOrganograma } from '@/hooks/useOrganograma';
import { useUser } from '@/contexts/UserContext';

export default function OrganogramaPage({ onNavigate }) {
  const [_activeNav, _setActiveNav] = useState('shield');

  // Hook do organograma (Firebase)
  const {
    data: organogramaData,
    loading,
    saving,
    addChild,
    addAdvisory,
    update,
    remove,
  } = useOrganograma();

  // Contexto do usuario (para verificar admin)
  const { user } = useUser();
  const roleKey = (user?.role || '').toLowerCase();
  const isAdmin = !!(user?.isAdmin || user?.isCoordenador || roleKey === 'administrador' || roleKey === 'coordenador');

  // Estado do modo de edicao
  const [isEditMode, setIsEditMode] = useState(false);

  // Estado do modal de detalhes (view mode)
  const [selectedNode, setSelectedNode] = useState(null);

  // Estado do modal de edicao (edit mode)
  const [editModalState, setEditModalState] = useState({
    open: false,
    node: null,       // No sendo editado (null para novo)
    parentId: null,   // ID do pai (para criacao)
    isAdvisory: false, // Se esta criando advisory
  });

  // Abrir modal de detalhes (view mode)
  const handleNodeClick = useCallback((node) => {
    if (!isEditMode) {
      setSelectedNode(node);
    }
  }, [isEditMode]);

  // Fechar modal de detalhes
  const handleCloseDetailModal = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Toggle modo de edicao
  const toggleEditMode = useCallback(() => {
    setIsEditMode((prev) => !prev);
  }, []);

  // Abrir modal de edicao para um no existente
  const handleEdit = useCallback((node) => {
    setEditModalState({
      open: true,
      node: node,
      parentId: null,
      isAdvisory: node.tipo === 'advisory',
    });
  }, []);

  // Abrir modal para adicionar filho
  const handleAddChild = useCallback((parentNode) => {
    setEditModalState({
      open: true,
      node: null,
      parentId: parentNode.id,
      isAdvisory: false,
    });
  }, []);

  // Abrir modal para adicionar advisory
  const handleAddAdvisory = useCallback((parentNode) => {
    setEditModalState({
      open: true,
      node: null,
      parentId: parentNode.id,
      isAdvisory: true,
    });
  }, []);

  // Fechar modal de edicao
  const handleCloseEditModal = useCallback(() => {
    setEditModalState({
      open: false,
      node: null,
      parentId: null,
      isAdvisory: false,
    });
  }, []);

  // Salvar no modal de edicao
  const handleSaveEdit = useCallback(async (nodeData) => {
    const userId = user?.uid || 'unknown';

    if (editModalState.node) {
      // Editando no existente
      await update(editModalState.node.id, nodeData, userId);
    } else if (editModalState.isAdvisory) {
      // Criando novo advisory
      await addAdvisory(editModalState.parentId, nodeData, userId);
    } else {
      // Criando novo filho
      await addChild(editModalState.parentId, nodeData, userId);
    }

    handleCloseEditModal();
  }, [editModalState, user, update, addAdvisory, addChild, handleCloseEditModal]);

  // Deletar no (remoção efetiva — chamada após confirmação)
  const handleDelete = useCallback(async (node) => {
    const userId = user?.uid || 'unknown';
    await remove(node.id, userId);
    handleCloseEditModal();
  }, [user, remove, handleCloseEditModal]);

  // Confirmação destrutiva do botão inline do accordion (o modal de edição
  // tem sua própria confirmação interna). Sem este guard, o trash inline
  // removia o cargo SEM confirmar.
  const [deleteTarget, setDeleteTarget] = useState(null);
  const requestDelete = useCallback((node) => setDeleteTarget(node), []);
  const confirmInlineDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await handleDelete(deleteTarget);
    setDeleteTarget(null);
  }, [deleteTarget, handleDelete]);

  // Dados a usar (Firebase ou fallback)
  const displayData = organogramaData || ORGANOGRAMA_DATA;

  // Header fixo via PageHeader
  const header = (
    <PageHeader
      title="Organograma"
      onBack={() => onNavigate('qualidade')}
      actions={isAdmin && (
        <button
          type="button"
          onClick={toggleEditMode}
          disabled={saving}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
            transition-colors
            ${isEditMode
              ? 'bg-primary text-white hover:bg-greenDark'
              : 'bg-muted text-primary hover:bg-border dark:hover:bg-muted'
            }
            disabled:opacity-50
          `}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isEditMode ? (
            <Check className="w-4 h-4" />
          ) : (
            <Pencil className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">
            {isEditMode ? 'Concluir' : 'Editar'}
          </span>
        </button>
      )}
    />
  );

  // Loading state
  if (loading) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">
            Carregando organograma...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background pb-24">
      {header}

      <div className="px-4 sm:px-5 py-4">
        {/* Card com titulo e icone */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
            <Network className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">
              Estrutura Organizacional 2025
            </h2>
            <p className="text-[13px] text-muted-foreground">
              {isEditMode
                ? 'Toque em um cargo para editar'
                : 'Toque para expandir os niveis'
              }
            </p>
          </div>
        </div>

        {/* Banner de modo de edicao */}
        {isEditMode && (
          <div className="mb-4 p-3 rounded-xl bg-category-blue-bg border border-category-blue">
            <p className="text-[13px] text-category-blue-fg dark:text-info">
              <strong>Modo de edicao ativo.</strong> As alteracoes sao salvas automaticamente no Firebase.
            </p>
          </div>
        )}

        {/* Arvore do Organograma (Accordion) */}
        <SectionCard className="mb-4">
          <OrgAccordion
            data={displayData}
            onNodeClick={handleNodeClick}
            isEditMode={isEditMode}
            onEdit={handleEdit}
            onDelete={requestDelete}
            onAddChild={handleAddChild}
            onAddAdvisory={handleAddAdvisory}
          />
        </SectionCard>

        {/* Legenda (atualizada com cores corretas) */}
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="text-[13px] font-semibold text-muted-foreground mb-3">
            Legenda
          </h3>
          <div className="grid grid-cols-2 gap-2 text-[12px]">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-muted border border-primary" />
              <span className="text-muted-foreground">Governanca</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-category-blue-bg border border-category-blue-fg" />
              <span className="text-muted-foreground">Executivo</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-category-orange-bg border border-category-orange" />
              <span className="text-muted-foreground">Tecnico</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-muted border border-greenLight" />
              <span className="text-muted-foreground">Administrativo</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-muted border border-success" />
              <span className="text-muted-foreground">Comite</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-card border border-border" />
              <span className="text-muted-foreground">Operacional</span>
            </div>
            <div className="flex items-center gap-2 col-span-2">
              <div className="w-3 h-3 rounded bg-card/50 border border-dashed border-muted-foreground" />
              <span className="text-muted-foreground">Consultivo (borda tracejada)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Detalhes (view mode) - Bottom Sheet */}
      <OrgDetailModal
        node={selectedNode}
        open={!!selectedNode && !isEditMode}
        onClose={handleCloseDetailModal}
      />

      {/* Modal de Edicao (edit mode) */}
      <OrgEditModal
        open={editModalState.open}
        onClose={handleCloseEditModal}
        node={editModalState.node}
        parentId={editModalState.parentId}
        isAdvisory={editModalState.isAdvisory}
        onSave={handleSaveEdit}
        onDelete={handleDelete}
        canDelete={editModalState.node?.id !== displayData?.id}
        saving={saving}
      />

      {/* Confirmação destrutiva — remoção de cargo pelo botão inline (cascata) */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => { if (!saving) setDeleteTarget(null); }}
        onConfirm={confirmInlineDelete}
        variant="danger"
        title={deleteTarget ? `Remover "${deleteTarget.cargo}"?` : 'Remover cargo?'}
        description="Todos os cargos subordinados também serão removidos. Esta ação não pode ser desfeita."
        confirmText="Remover"
        loading={saving}
      />

    </div>
  );
}

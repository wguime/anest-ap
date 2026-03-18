import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  SectionCard,
  BottomNav,
} from '@/design-system';
import {
  GraduationCap,
  ChevronLeft,
  Network,
  Pencil,
  Check,
  Loader2,
} from 'lucide-react';
import {
  OrgAccordion,
  OrgDetailModal,
  OrgEditModal,
  ORGANOGRAMA_DATA,
} from '@/components/organograma';
import { useOrganograma } from '@/hooks/useOrganograma';
import { useUser } from '@/contexts/UserContext';

export default function OrganogramaPage({ onNavigate }) {
  const [activeNav, setActiveNav] = useState('shield');

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

  // Deletar no
  const handleDelete = useCallback(async (node) => {
    const userId = user?.uid || 'unknown';
    await remove(node.id, userId);
    handleCloseEditModal();
  }, [user, remove, handleCloseEditModal]);

  // Dados a usar (Firebase ou fallback)
  const displayData = organogramaData || ORGANOGRAMA_DATA;

  // Header fixo via Portal
  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={() => onNavigate('qualidade')}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>
          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            Organograma
          </h1>
          {/* Botao de edicao (apenas admin) */}
          <div className="min-w-[70px] flex justify-end">
            {isAdmin && (
              <button
                type="button"
                onClick={toggleEditMode}
                disabled={saving}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                  transition-colors
                  ${isEditMode
                    ? 'bg-primary text-white hover:bg-[#005028]'
                    : 'bg-muted text-primary hover:bg-[#C8E6C9] dark:hover:bg-muted'
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
          </div>
        </div>
      </div>
    </nav>
  );

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
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
    <div className="min-h-screen bg-background pb-24">
      {/* Header fixo via Portal */}
      {createPortal(headerElement, document.body)}

      {/* Espacador para o header fixo */}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-5 py-4">
        {/* Card com titulo e icone */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
            <Network className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-black dark:text-white">
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
          <div className="mb-4 p-3 rounded-xl bg-[#E3F2FD] dark:bg-[#1A237E] border border-[#1565C0] dark:border-[#64B5F6]">
            <p className="text-[13px] text-[#0D47A1] dark:text-[#90CAF9]">
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
            onDelete={handleDelete}
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
              <div className="w-3 h-3 rounded bg-[#E3F2FD] border border-[#1565C0]" />
              <span className="text-muted-foreground">Executivo</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-[#FFF3E0] border border-[#FF9800]" />
              <span className="text-muted-foreground">Tecnico</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-[#F1F4E9] border border-[#7D8B69]" />
              <span className="text-muted-foreground">Administrativo</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-muted border border-[#4CAF50]" />
              <span className="text-muted-foreground">Comite</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-white border border-[#E0E0E0]" />
              <span className="text-muted-foreground">Operacional</span>
            </div>
            <div className="flex items-center gap-2 col-span-2">
              <div className="w-3 h-3 rounded bg-white/50 border border-dashed border-[#9E9E9E]" />
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

      <BottomNav
        items={[
          { icon: 'Home', active: false, id: 'home' },
          { icon: 'Shield', active: true, id: 'shield' },
          {
            icon: <GraduationCap className="w-6 h-6 sm:w-7 sm:h-7 transition-colors text-muted-foreground" fill="none" />,
            active: false,
            id: 'education',
          },
          { icon: 'Menu', active: false, id: 'menu' },
        ]}
        onItemClick={(item) => {
          setActiveNav(item.id);
          if (item.id === 'home') onNavigate('home');
          else if (item.id === 'shield') onNavigate('gestao');
          else if (item.id === 'education') onNavigate('educacao');
          else if (item.id === 'menu') onNavigate('menu');
        }}
      />
    </div>
  );
}

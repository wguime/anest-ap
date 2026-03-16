/**
 * TrilhasTab.jsx
 * Aba de gerenciamento de trilhas
 */

import { useState, useMemo, useCallback } from 'react';
import {
  Search,
  MoreVertical,
  Edit2,
  Trash2,
  Copy,
  Plus,
  GitBranch,
  CheckCircle,
  XCircle,
  AlertTriangle,
  BookOpen,
  Clock,
  Users,
  ArrowUpDown,
  GripVertical,
} from 'lucide-react';
import {
  Card,
  CardContent,
  Button,
  Input,
  Badge,
  EmptyState,
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  ConfirmDialog,
  Modal,
} from '@/design-system';
import { Reorder } from 'framer-motion';
import { cn } from '@/design-system/utils/tokens';
import { TIPOS_USUARIO } from '../../data/educacaoUtils';

export function TrilhasTab({
  trilhas,
  cursos,
  onUpdate,
  onDelete,
  onAdd,
  onToggleAtivo,
  onCursoCreated,
  onReorderCursos,
  onOpenTrilhaModal,
  onOpenNovoModal,
}) {
  const [busca, setBusca] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [trilhaToDelete, setTrilhaToDelete] = useState(null);
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [reorderingTrilha, setReorderingTrilha] = useState(null);
  const [reorderedCursoIds, setReorderedCursoIds] = useState([]);

  // Filtrar trilhas
  const trilhasFiltradas = useMemo(() => {
    if (!busca) return trilhas;

    const buscaLower = busca.toLowerCase();
    return trilhas.filter(t =>
      t.titulo.toLowerCase().includes(buscaLower) ||
      t.descricao?.toLowerCase().includes(buscaLower)
    );
  }, [trilhas, busca]);

  // Handlers
  const handleCreateTrilha = () => onOpenNovoModal?.();
  const handleEditTrilha = (trilha) => onOpenTrilhaModal?.(trilha);

  const handleDuplicateTrilha = (trilha) => {
    const newTrilha = {
      ...trilha,
      id: undefined,
      titulo: `${trilha.titulo} (Copia)`,
    };
    onAdd?.(newTrilha);
  };

  const handleDeleteClick = (trilha) => {
    setTrilhaToDelete(trilha);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    if (trilhaToDelete) {
      onDelete?.(trilhaToDelete.id);
    }
    setTrilhaToDelete(null);
    setShowDeleteConfirm(false);
  };

  // Salvar é tratado pelo modal global em AdminConteudoPage

  // Handlers para reordenação
  const handleOpenReorder = useCallback((trilha) => {
    setReorderingTrilha(trilha);
    setReorderedCursoIds(trilha.cursos || []);
    setShowReorderModal(true);
  }, []);

  const handleSaveReorder = useCallback(() => {
    if (reorderingTrilha && onReorderCursos) {
      onReorderCursos(reorderingTrilha.id, reorderedCursoIds);
    }
    setShowReorderModal(false);
    setReorderingTrilha(null);
    setReorderedCursoIds([]);
  }, [reorderingTrilha, reorderedCursoIds, onReorderCursos]);

  // Obter cursos para reordenação (com dados completos)
  const cursosParaReordenar = useMemo(() => {
    if (!reorderingTrilha?.cursos) return [];
    return reorderedCursoIds
      .map(id => cursos.find(c => c.id === id))
      .filter(Boolean);
  }, [reorderedCursoIds, cursos, reorderingTrilha]);

  // Labels dos tipos de usuário
  const getTiposLabels = (tiposUsuario) => {
    if (!tiposUsuario?.length) return '';
    return tiposUsuario
      .slice(0, 2)
      .map(t => TIPOS_USUARIO[t]?.label || t)
      .join(', ') + (tiposUsuario.length > 2 ? ` +${tiposUsuario.length - 2}` : '');
  };

  // Contar cursos
  const getCursosCount = (cursosIds) => {
    return cursosIds?.length || 0;
  };

  // Contar quantas aulas existem na trilha (derivado via cursos vinculados)
  const getAulasCountForTrilha = useCallback((trilha) => {
    const cursoIds = trilha?.cursos || [];
    if (cursoIds.length === 0) return 0;
    // Como a lista de aulas não está disponível aqui, mostramos apenas um indicador simples:
    // número de treinamentos vinculados (proxy de conteúdo). A contagem real de aulas entra na fase 3/relatórios.
    return null;
  }, []);

  // Obter nome do curso
  const getCursoNome = (cursoId) => {
    return cursos?.find(c => c.id === cursoId)?.titulo || cursoId;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-foreground">
          Trilhas ({trilhasFiltradas.length})
        </h2>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar trilhas..."
          className="pl-9"
        />
      </div>

      {/* Lista de Trilhas */}
      {trilhasFiltradas.length === 0 ? (
        <EmptyState
          icon={<GitBranch className="w-16 h-16" />}
          title="Nenhuma trilha encontrada"
          description={busca
            ? "Ajuste a busca para ver mais trilhas"
            : "Trilhas agrupam treinamentos com um objetivo comum. Comece criando sua primeira trilha."}
        >
          {!busca && (
            <Button
              onClick={handleCreateTrilha}
              leftIcon={<Plus className="w-4 h-4" />}
              className="mt-4"
            >
              Criar Primeira Trilha
            </Button>
          )}
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {trilhasFiltradas.map((trilha) => (
            <Card key={trilha.id} className="overflow-hidden">
              {/* Indicador de obrigatoriedade */}
              {trilha.obrigatoria && (
                <div className="bg-warning/10 px-4 py-2 border-b border-warning/20">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-warning" />
                    <span className="text-xs font-medium text-warning">
                      Trilha Obrigatoria
                    </span>
                  </div>
                </div>
              )}

              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Ícone */}
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
                    trilha.ativo !== false ? "bg-primary/10" : "bg-muted"
                  )}>
                    <GitBranch className={cn(
                      "w-6 h-6",
                      trilha.ativo !== false ? "text-primary" : "text-muted-foreground"
                    )} />
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-foreground">
                          {trilha.titulo}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {trilha.descricao}
                        </p>
                      </div>

                      {/* Menu de ações */}
                      <DropdownMenu>
                        <DropdownTrigger asChild>
                          <Button variant="ghost" size="icon" className="flex-shrink-0">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownTrigger>
                        <DropdownContent align="end">
                          <DropdownItem
                            icon={<Edit2 className="w-4 h-4" />}
                            onClick={() => handleEditTrilha(trilha)}
                          >
                            Editar
                          </DropdownItem>
                          {trilha.cursos?.length > 1 && (
                            <DropdownItem
                              icon={<ArrowUpDown className="w-4 h-4" />}
                              onClick={() => handleOpenReorder(trilha)}
                            >
                              Reordenar Treinamentos
                            </DropdownItem>
                          )}
                          <DropdownItem
                            icon={<Copy className="w-4 h-4" />}
                            onClick={() => handleDuplicateTrilha(trilha)}
                          >
                            Duplicar
                          </DropdownItem>
                          <DropdownSeparator />
                          <DropdownItem
                            icon={<Trash2 className="w-4 h-4" />}
                            onClick={() => handleDeleteClick(trilha)}
                            destructive
                          >
                            Excluir
                          </DropdownItem>
                        </DropdownContent>
                      </DropdownMenu>
                    </div>

                    {/* Badges de info */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {trilha.tiposUsuario?.length > 0 && (
                        <Badge variant="secondary" badgeStyle="subtle">
                          <Users className="w-3 h-3 mr-1" />
                          {getTiposLabels(trilha.tiposUsuario)}
                        </Badge>
                      )}

                      <Badge variant="secondary" badgeStyle="subtle">
                        <BookOpen className="w-3 h-3 mr-1" />
                        {getCursosCount(trilha.cursos)} {getCursosCount(trilha.cursos) === 1 ? 'treinamento' : 'treinamentos'}
                      </Badge>

                      {trilha.prazoConclusao && (
                        <Badge variant="secondary" badgeStyle="subtle">
                          <Clock className="w-3 h-3 mr-1" />
                          {trilha.prazoConclusao} dias
                        </Badge>
                      )}

                      <button onClick={() => onToggleAtivo?.(trilha)}>
                        {trilha.ativo !== false ? (
                          <Badge variant="success" badgeStyle="subtle">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Ativa
                          </Badge>
                        ) : (
                          <Badge variant="secondary" badgeStyle="subtle">
                            <XCircle className="w-3 h-3 mr-1" />
                            Inativa
                          </Badge>
                        )}
                      </button>
                    </div>

                    {/* Lista de treinamentos */}
                    {trilha.cursos?.length > 0 ? (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-2">Treinamentos:</p>
                        <div className="flex flex-wrap gap-1">
                          {trilha.cursos.map((cursoId, index) => (
                            <span
                              key={cursoId}
                              className="text-xs px-2 py-1 bg-muted rounded-md"
                            >
                              {index + 1}. {getCursoNome(cursoId)}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-xs text-muted-foreground italic">
                          Nenhum treinamento vinculado. 
                          <button
                            type="button"
                            onClick={() => handleEditTrilha(trilha)}
                            className="text-primary hover:underline ml-1"
                          >
                            Adicionar treinamentos
                          </button>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de Confirmação de Exclusão */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Excluir Trilha"
        description={`Tem certeza que deseja excluir a trilha "${trilhaToDelete?.titulo}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />

      {/* Modal de Reordenação de Treinamentos */}
      <Modal
        open={showReorderModal}
        onClose={() => setShowReorderModal(false)}
        title={`Reordenar Treinamentos - ${reorderingTrilha?.titulo || ''}`}
        size="md"
      >
        <div className="space-y-4 p-1">
          <p className="text-sm text-muted-foreground">
            Arraste os treinamentos para reorganizar a ordem na trilha.
          </p>

          {cursosParaReordenar.length > 0 ? (
            <Reorder.Group
              axis="y"
              values={cursosParaReordenar}
              onReorder={(newItems) => setReorderedCursoIds(newItems.map(c => c.id))}
              className="space-y-2"
            >
              {cursosParaReordenar.map((curso, index) => (
                <Reorder.Item
                  key={curso.id}
                  value={curso}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border border-border bg-card",
                    "cursor-grab active:cursor-grabbing",
                    "hover:bg-muted/50 transition-colors"
                  )}
                  whileDrag={{
                    scale: 1.02,
                    boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
                    zIndex: 50,
                  }}
                >
                  <GripVertical className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-primary">{index + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{curso.titulo}</p>
                    <p className="text-xs text-muted-foreground truncate">{curso.descricao}</p>
                  </div>
                </Reorder.Item>
              ))}
            </Reorder.Group>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum treinamento nesta trilha.
            </p>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setShowReorderModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveReorder}>
              Salvar Ordem
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default TrilhasTab;

/**
 * ModulosTab.jsx
 * Aba de gerenciamento de módulos
 */

import { useState, useMemo, useCallback } from 'react';
import {
  Search,
  MoreVertical,
  Edit2,
  Trash2,
  Plus,
  FolderOpen,
  Video,
  FileText,
  HelpCircle,
  CheckCircle,
  XCircle,
  Clock,
  BookOpen,
  Wrench,
  ArrowUpDown,
  GripVertical,
} from 'lucide-react';
import {
  Card,
  CardContent,
  Button,
  Input,
  Badge,
  Select,
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
import { formatDuracao } from '../../data/educacaoUtils';

const TIPOS_MODULO = {
  conteudo: { label: 'Conteúdo', icon: BookOpen, color: 'green' },
  video: { label: 'Vídeo', icon: Video, color: 'blue' },
  leitura: { label: 'Leitura', icon: FileText, color: 'orange' },
  quiz: { label: 'Quiz', icon: HelpCircle, color: 'purple' },
  pratico: { label: 'Prático', icon: Wrench, color: 'teal' },
};

export function ModulosTab({
  modulos,
  cursos,
  aulas,
  onUpdate,
  onDelete,
  onAdd,
  onToggleAtivo,
  onReorderModulos,
  onOpenModuloModal,
  onOpenNovoModal,
}) {
  const [busca, setBusca] = useState('');
  const [filtroCurso, setFiltroCurso] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [moduloToDelete, setModuloToDelete] = useState(null);
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [reorderingCurso, setReorderingCurso] = useState(null);
  const [reorderedModuloIds, setReorderedModuloIds] = useState([]);

  // Opções de filtro por treinamento
  const cursoOptions = useMemo(() => {
    return [
      { value: '', label: 'Todos os treinamentos' },
      ...cursos.map(c => ({ value: c.id, label: c.titulo })),
    ];
  }, [cursos]);

  // Módulos filtrados
  const modulosFiltrados = useMemo(() => {
    let resultado = [...modulos];

    if (busca) {
      const buscaLower = busca.toLowerCase();
      resultado = resultado.filter(m =>
        m.titulo.toLowerCase().includes(buscaLower)
      );
    }

    if (filtroCurso) {
      resultado = resultado.filter(m => m.cursoId === filtroCurso);
    }

    // Ordenar por curso e ordem
    resultado.sort((a, b) => {
      if (a.cursoId !== b.cursoId) {
        return (a.cursoId || '').localeCompare(b.cursoId || '');
      }
      return (a.ordem || 0) - (b.ordem || 0);
    });

    return resultado;
  }, [modulos, busca, filtroCurso]);

  // Handlers
  const handleCreateModulo = () => onOpenNovoModal?.();
  const handleEditModulo = (modulo) => onOpenModuloModal?.(modulo);

  const handleDeleteClick = (modulo) => {
    setModuloToDelete(modulo);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    if (moduloToDelete) {
      onDelete?.(moduloToDelete.id);
    }
    setModuloToDelete(null);
    setShowDeleteConfirm(false);
  };

  // Salvar é tratado pelo modal global em AdminConteudoPage

  // Handlers para reordenação
  const handleOpenReorder = useCallback((cursoId) => {
    const curso = cursos.find(c => c.id === cursoId);
    if (!curso) return;
    
    const modulosDoCurso = modulos
      .filter(m => m.cursoId === cursoId)
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    
    setReorderingCurso(curso);
    setReorderedModuloIds(modulosDoCurso.map(m => m.id));
    setShowReorderModal(true);
  }, [cursos, modulos]);

  const handleSaveReorder = useCallback(() => {
    if (reorderingCurso && onReorderModulos) {
      onReorderModulos(reorderingCurso.id, reorderedModuloIds);
    }
    setShowReorderModal(false);
    setReorderingCurso(null);
    setReorderedModuloIds([]);
  }, [reorderingCurso, reorderedModuloIds, onReorderModulos]);

  // Obter módulos para reordenação
  const modulosParaReordenar = useMemo(() => {
    return reorderedModuloIds
      .map(id => modulos.find(m => m.id === id))
      .filter(Boolean);
  }, [reorderedModuloIds, modulos]);

  // Verificar se um curso tem módulos suficientes para reordenar
  const canReorderCurso = useCallback((cursoId) => {
    const count = modulos.filter(m => m.cursoId === cursoId).length;
    return count > 1;
  }, [modulos]);

  // Obter nome do treinamento
  const getCursoNome = (cursoId) => {
    return cursos.find(c => c.id === cursoId)?.titulo || cursoId || '-';
  };

  // Contar aulas do módulo
  const getAulasCount = (moduloId) => {
    return aulas?.filter(a => a.moduloId === moduloId).length || 0;
  };

  // Obter config do tipo
  const getTipoConfig = (tipo) => {
    return TIPOS_MODULO[tipo] || TIPOS_MODULO.video;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-foreground">
          Módulos ({modulosFiltrados.length})
        </h2>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar módulos..."
                className="pl-9"
              />
            </div>

            <div className="flex gap-2">
              <Select
                value={filtroCurso}
                onChange={setFiltroCurso}
                options={cursoOptions}
                className="flex-1"
              />
              {filtroCurso && canReorderCurso(filtroCurso) && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleOpenReorder(filtroCurso)}
                  title="Reordenar Módulos"
                >
                  <ArrowUpDown className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Módulos */}
      {modulosFiltrados.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="w-16 h-16" />}
          title="Nenhum módulo encontrado"
          description={busca || filtroCurso
            ? "Ajuste os filtros para ver mais módulos"
            : cursos.length === 0
              ? "Crie um treinamento primeiro para depois adicionar módulos."
              : "Módulos organizam as aulas dentro de um treinamento. Crie o primeiro módulo."}
        >
          {!busca && !filtroCurso && cursos.length > 0 && (
            <Button
              onClick={handleCreateModulo}
              leftIcon={<Plus className="w-4 h-4" />}
              className="mt-4"
            >
              Criar Primeiro Módulo
            </Button>
          )}
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {modulosFiltrados.map((modulo) => {
            const tipoConfig = getTipoConfig(modulo.tipo);
            const TipoIcon = tipoConfig.icon;

            return (
              <Card key={modulo.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Ícone do tipo */}
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
                      modulo.ativo !== false 
                        ? "bg-orange-100 dark:bg-orange-900/30" 
                        : "bg-muted"
                    )}>
                      <TipoIcon className={cn(
                        "w-6 h-6",
                        modulo.ativo !== false 
                          ? "text-orange-600 dark:text-orange-400" 
                          : "text-muted-foreground"
                      )} />
                    </div>

                    {/* Conteúdo */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className={cn(
                            "font-semibold",
                            modulo.ativo === false && "text-muted-foreground line-through"
                          )}>
                            {modulo.titulo}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                            <BookOpen className="w-3 h-3" />
                            {getCursoNome(modulo.cursoId)}
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
                              onClick={() => handleEditModulo(modulo)}
                            >
                              Editar
                            </DropdownItem>
                            <DropdownSeparator />
                            <DropdownItem
                              icon={<Trash2 className="w-4 h-4" />}
                              onClick={() => handleDeleteClick(modulo)}
                              destructive
                            >
                              Excluir
                            </DropdownItem>
                          </DropdownContent>
                        </DropdownMenu>
                      </div>

                      {/* Badges de info */}
                      <div className="flex flex-wrap gap-2 mt-3">
                        <Badge variant="secondary" badgeStyle="subtle">
                          <TipoIcon className="w-3 h-3 mr-1" />
                          {tipoConfig.label}
                        </Badge>

                        <Badge variant="secondary" badgeStyle="subtle">
                          <Clock className="w-3 h-3 mr-1" />
                          {formatDuracao(modulo.duracao)}
                        </Badge>

                        <Badge variant="secondary" badgeStyle="subtle">
                          <Video className="w-3 h-3 mr-1" />
                          {getAulasCount(modulo.id)} aulas
                        </Badge>

                        {modulo.ordem && (
                          <Badge variant="secondary" badgeStyle="subtle">
                            #{modulo.ordem}
                          </Badge>
                        )}

                        <button onClick={() => onToggleAtivo?.(modulo)}>
                          {modulo.ativo !== false ? (
                            <Badge variant="success" badgeStyle="subtle">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Ativo
                            </Badge>
                          ) : (
                            <Badge variant="secondary" badgeStyle="subtle">
                              <XCircle className="w-3 h-3 mr-1" />
                              Inativo
                            </Badge>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog de Confirmação de Exclusão */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Excluir Módulo"
        description={`Tem certeza que deseja excluir o módulo "${moduloToDelete?.titulo}"? Isso também excluirá todas as aulas associadas. Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />

      {/* Modal de Reordenação de Módulos */}
      <Modal
        open={showReorderModal}
        onClose={() => setShowReorderModal(false)}
        title={`Reordenar Módulos - ${reorderingCurso?.titulo || ''}`}
        size="md"
      >
        <div className="space-y-4 p-1">
          <p className="text-sm text-muted-foreground">
            Arraste os módulos para reorganizar a ordem no treinamento.
          </p>

          {modulosParaReordenar.length > 0 ? (
            <Reorder.Group
              axis="y"
              values={modulosParaReordenar}
              onReorder={(newItems) => setReorderedModuloIds(newItems.map(m => m.id))}
              className="space-y-2"
            >
              {modulosParaReordenar.map((modulo, index) => {
                const tipoConfig = getTipoConfig(modulo.tipo);
                const TipoIcon = tipoConfig.icon;
                
                return (
                  <Reorder.Item
                    key={modulo.id}
                    value={modulo}
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
                    <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                      <TipoIcon className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{modulo.titulo}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDuracao(modulo.duracao)} • {tipoConfig.label}
                      </p>
                    </div>
                    <Badge variant="secondary" badgeStyle="subtle">
                      #{index + 1}
                    </Badge>
                  </Reorder.Item>
                );
              })}
            </Reorder.Group>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum módulo neste treinamento.
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

export default ModulosTab;

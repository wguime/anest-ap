/**
 * AulasTab.jsx
 * Aba de gerenciamento de aulas
 */

import { useState, useMemo, useCallback } from 'react';
import {
  Search,
  MoreVertical,
  Edit2,
  Trash2,
  Eye,
  Plus,
  Video,
  Youtube,
  Headphones,
  FileText,
  GripVertical,
  CheckCircle,
  XCircle,
  ArrowUpDown,
  FolderOpen,
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
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Modal,
} from '@/design-system';
import { Reorder } from 'framer-motion';
import { cn } from '@/design-system/utils/tokens';
import { TIPOS_MIDIA, formatDuracao } from '../../data/educacaoUtils';

export function AulasTab({
  aulas,
  cursos,
  modulos,
  onUpdate,
  onDelete,
  onAdd,
  onToggleAtivo,
  onPlay,
  onCursoCreated,
  onModuloCreated,
  onReorderAulas,
  onOpenAulaModal,
  onOpenNovoModal,
}) {
  const [filtros, setFiltros] = useState({
    busca: '',
    cursoId: '',
    tipo: '',
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [aulaToDelete, setAulaToDelete] = useState(null);
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [reorderingModulo, setReorderingModulo] = useState(null);
  const [reorderedAulaIds, setReorderedAulaIds] = useState([]);

  // Opções de filtro
  const cursoOptions = useMemo(() => {
    return [
      { value: '', label: 'Todos os cursos' },
      ...cursos.map(c => ({ value: c.id, label: c.titulo })),
    ];
  }, [cursos]);

  const tipoOptions = useMemo(() => {
    return [
      { value: '', label: 'Todos os tipos' },
      ...Object.entries(TIPOS_MIDIA).map(([value, { label }]) => ({ value, label })),
    ];
  }, []);

  // Filtrar aulas
  const aulasFiltradas = useMemo(() => {
    let resultado = [...aulas];

    if (filtros.busca) {
      const busca = filtros.busca.toLowerCase();
      resultado = resultado.filter(a =>
        a.titulo.toLowerCase().includes(busca) ||
        a.descricao?.toLowerCase().includes(busca)
      );
    }

    if (filtros.cursoId) {
      resultado = resultado.filter(a => a.cursoId === filtros.cursoId);
    }

    if (filtros.tipo) {
      resultado = resultado.filter(a => a.tipo === filtros.tipo);
    }

    // Ordenar por curso e ordem
    resultado.sort((a, b) => {
      if (a.cursoId !== b.cursoId) {
        return (a.cursoId || '').localeCompare(b.cursoId || '');
      }
      return (a.ordem || 0) - (b.ordem || 0);
    });

    return resultado;
  }, [aulas, filtros]);

  // Handlers
  const handleCreateAula = () => onOpenNovoModal?.();
  const handleEditAula = (aula) => onOpenAulaModal?.(aula);

  const handleDeleteClick = (aula) => {
    setAulaToDelete(aula);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    if (aulaToDelete) {
      onDelete?.(aulaToDelete.id);
    }
    setAulaToDelete(null);
    setShowDeleteConfirm(false);
  };

  // Salvar é tratado pelo modal global em AdminConteudoPage

  // Handlers para reordenação
  const handleOpenReorder = useCallback((moduloId) => {
    const modulo = modulos.find(m => m.id === moduloId);
    if (!modulo) return;
    
    const aulasDoModulo = aulas
      .filter(a => a.moduloId === moduloId)
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    
    setReorderingModulo(modulo);
    setReorderedAulaIds(aulasDoModulo.map(a => a.id));
    setShowReorderModal(true);
  }, [modulos, aulas]);

  const handleSaveReorder = useCallback(() => {
    if (reorderingModulo && onReorderAulas) {
      onReorderAulas(reorderingModulo.id, reorderedAulaIds);
    }
    setShowReorderModal(false);
    setReorderingModulo(null);
    setReorderedAulaIds([]);
  }, [reorderingModulo, reorderedAulaIds, onReorderAulas]);

  // Obter aulas para reordenação
  const aulasParaReordenar = useMemo(() => {
    return reorderedAulaIds
      .map(id => aulas.find(a => a.id === id))
      .filter(Boolean);
  }, [reorderedAulaIds, aulas]);

  // Obter módulos únicos das aulas filtradas para botão de reorder
  const modulosFiltrados = useMemo(() => {
    if (!filtros.cursoId) return [];
    const moduloIds = new Set(aulasFiltradas.map(a => a.moduloId));
    return modulos.filter(m => moduloIds.has(m.id) && 
      aulas.filter(a => a.moduloId === m.id).length > 1);
  }, [aulasFiltradas, modulos, aulas, filtros.cursoId]);

  // Obter nome do curso
  const getCursoNome = (cursoId) => {
    return cursos.find(c => c.id === cursoId)?.titulo || cursoId || '-';
  };

  // Ícone do tipo
  const getTipoIcon = (tipo) => {
    switch (tipo) {
      case 'youtube':
        return <Youtube className="w-4 h-4 text-red-500" />;
      case 'audio':
        return <Headphones className="w-4 h-4 text-purple-500" />;
      case 'document':
        return <FileText className="w-4 h-4 text-orange-500" />;
      default:
        return <Video className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-foreground">
          Aulas ({aulasFiltradas.length})
        </h2>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={filtros.busca}
                onChange={(e) => setFiltros(prev => ({ ...prev, busca: e.target.value }))}
                placeholder="Buscar aulas..."
                className="pl-9"
              />
            </div>

            <Select
              value={filtros.cursoId}
              onChange={(v) => setFiltros(prev => ({ ...prev, cursoId: v }))}
              options={cursoOptions}
            />

            <Select
              value={filtros.tipo}
              onChange={(v) => setFiltros(prev => ({ ...prev, tipo: v }))}
              options={tipoOptions}
            />
          </div>
        </CardContent>
      </Card>

      {/* Botões de reordenação por módulo */}
      {modulosFiltrados.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-muted-foreground">Reordenar aulas por módulo:</span>
          {modulosFiltrados.map(modulo => (
            <Button
              key={modulo.id}
              variant="outline"
              size="sm"
              onClick={() => handleOpenReorder(modulo.id)}
              leftIcon={<FolderOpen className="w-3 h-3" />}
            >
              {modulo.titulo}
            </Button>
          ))}
        </div>
      )}

      {/* Lista de Aulas */}
      {aulasFiltradas.length === 0 ? (
        <EmptyState
          icon={<Video className="w-16 h-16" />}
          title="Nenhuma aula encontrada"
          description={filtros.busca || filtros.cursoId || filtros.tipo
            ? "Ajuste os filtros para ver mais aulas"
            : modulos.length === 0
              ? "Crie um treinamento e um módulo primeiro para depois adicionar aulas."
              : "Aulas são o conteúdo principal (vídeos, áudios). Adicione a primeira aula."}
        >
          {!filtros.busca && !filtros.cursoId && !filtros.tipo && modulos.length > 0 && (
            <Button
              onClick={handleCreateAula}
              leftIcon={<Plus className="w-4 h-4" />}
              className="mt-4"
            >
              Criar Primeira Aula
            </Button>
          )}
        </EmptyState>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead className="hidden sm:table-cell">Curso</TableHead>
                  <TableHead className="hidden md:table-cell">Tipo</TableHead>
                  <TableHead className="hidden md:table-cell">Duracao</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aulasFiltradas.map((aula) => (
                  <TableRow key={aula.id}>
                    <TableCell>
                      <span className="text-xs text-muted-foreground font-medium">
                        {aula.ordem || '-'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                          {getTipoIcon(aula.tipo)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {aula.titulo}
                          </p>
                          <p className="text-xs text-muted-foreground truncate sm:hidden">
                            {getCursoNome(aula.cursoId)}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-sm text-muted-foreground truncate block max-w-[200px]">
                        {getCursoNome(aula.cursoId)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="secondary" badgeStyle="subtle">
                        {TIPOS_MIDIA[aula.tipo]?.label || aula.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-sm text-muted-foreground">
                        {formatDuracao(aula.duracao)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <button onClick={() => onToggleAtivo?.(aula)}>
                        {aula.ativo !== false ? (
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
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownTrigger>
                        <DropdownContent align="end">
                          <DropdownItem
                            icon={<Eye className="w-4 h-4" />}
                            onClick={() => onPlay?.(aula)}
                          >
                            Preview
                          </DropdownItem>
                          <DropdownItem
                            icon={<Edit2 className="w-4 h-4" />}
                            onClick={() => handleEditAula(aula)}
                          >
                            Editar
                          </DropdownItem>
                          <DropdownSeparator />
                          <DropdownItem
                            icon={<Trash2 className="w-4 h-4" />}
                            onClick={() => handleDeleteClick(aula)}
                            destructive
                          >
                            Excluir
                          </DropdownItem>
                        </DropdownContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Dialog de Confirmação de Exclusão */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Excluir Aula"
        description={`Tem certeza que deseja excluir a aula "${aulaToDelete?.titulo}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />

      {/* Modal de Reordenação de Aulas */}
      <Modal
        open={showReorderModal}
        onClose={() => setShowReorderModal(false)}
        title={`Reordenar Aulas - ${reorderingModulo?.titulo || ''}`}
        size="md"
      >
        <div className="space-y-4 p-1">
          <p className="text-sm text-muted-foreground">
            Arraste as aulas para reorganizar a ordem no módulo.
          </p>

          {aulasParaReordenar.length > 0 ? (
            <Reorder.Group
              axis="y"
              values={aulasParaReordenar}
              onReorder={(newItems) => setReorderedAulaIds(newItems.map(a => a.id))}
              className="space-y-2"
            >
              {aulasParaReordenar.map((aula, index) => (
                <Reorder.Item
                  key={aula.id}
                  value={aula}
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
                  <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                    {getTipoIcon(aula.tipo)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{aula.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDuracao(aula.duracao)} • {TIPOS_MIDIA[aula.tipo]?.label || aula.tipo}
                    </p>
                  </div>
                  <Badge variant="secondary" badgeStyle="subtle">
                    #{index + 1}
                  </Badge>
                </Reorder.Item>
              ))}
            </Reorder.Group>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma aula neste módulo.
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

export default AulasTab;

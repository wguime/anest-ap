/**
 * CursosTab.jsx
 * Aba de gerenciamento de cursos
 */

import { useState, useMemo } from 'react';
import {
  Search,
  MoreVertical,
  Edit2,
  Trash2,
  Plus,
  BookOpen,
  FolderOpen,
  Video,
  CheckCircle,
  XCircle,
  Clock,
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
} from '@/design-system';
import { cn } from '@/design-system/utils/tokens';
import { formatDuracao } from '../../data/mockEducacaoData';

export function CursosTab({
  cursos,
  trilhas,
  modulos,
  onUpdate,
  onDelete,
  onAdd,
  onToggleAtivo,
  onTrilhasUpdate, // Callback para atualizar trilhas quando curso é vinculado
  onOpenCursoModal,
  onOpenNovoModal,
}) {
  const [busca, setBusca] = useState('');
  const [filtroTrilha, setFiltroTrilha] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [cursoToDelete, setCursoToDelete] = useState(null);

  // Opções de filtro
  const trilhaOptions = useMemo(() => {
    return [
      { value: '', label: 'Todas as trilhas' },
      ...trilhas.map(t => ({ value: t.id, label: t.titulo })),
    ];
  }, [trilhas]);

  // Cursos filtrados
  const cursosFiltrados = useMemo(() => {
    let resultado = [...cursos];

    if (busca) {
      const buscaLower = busca.toLowerCase();
      resultado = resultado.filter(c =>
        c.titulo.toLowerCase().includes(buscaLower) ||
        c.descricao?.toLowerCase().includes(buscaLower)
      );
    }

    if (filtroTrilha) {
      const trilha = trilhas.find(t => t.id === filtroTrilha);
      if (trilha) {
        resultado = resultado.filter(c => trilha.cursos?.includes(c.id));
      }
    }

    return resultado;
  }, [cursos, trilhas, busca, filtroTrilha]);

  // Handlers
  const handleCreateCurso = () => onOpenNovoModal?.();
  const handleEditCurso = (curso) => onOpenCursoModal?.(curso);

  const handleDeleteClick = (curso) => {
    setCursoToDelete(curso);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    if (cursoToDelete) {
      onDelete?.(cursoToDelete.id);
    }
    setCursoToDelete(null);
    setShowDeleteConfirm(false);
  };

  // Salvar é tratado pelo modal global em AdminConteudoPage

  // Contar módulos do curso
  const getModulosCount = (cursoId) => {
    return modulos?.filter(m => m.cursoId === cursoId).length || 0;
  };

  // Obter nomes das trilhas do curso
  const getTrilhasInfo = (cursoId) => {
    const trilhasComCurso = trilhas.filter(t => t.cursos?.includes(cursoId));
    if (trilhasComCurso.length === 0) return { label: 'Sem trilha', count: 0, firstTitle: null };
    if (trilhasComCurso.length === 1) return { label: trilhasComCurso[0].titulo, count: 1, firstTitle: trilhasComCurso[0].titulo };
    return { label: `${trilhasComCurso[0].titulo} +${trilhasComCurso.length - 1}`, count: trilhasComCurso.length, firstTitle: trilhasComCurso[0].titulo };
  };

  // Calcular duração total do curso
  const getDuracaoCurso = (curso) => {
    const modulosCurso = modulos?.filter(m => m.cursoId === curso.id) || [];
    const total = modulosCurso.reduce((acc, m) => acc + (m.duracao || 0), 0);
    return total || curso.duracaoMinutos || 0;
  };

  const getPublicacaoBadge = (curso) => {
    const status = curso.statusPublicacao || 'published';
    if (status === 'draft') return <Badge variant="secondary" badgeStyle="subtle">Rascunho</Badge>;
    if (status === 'scheduled') return <Badge variant="warning" badgeStyle="subtle">Agendado</Badge>;
    return <Badge variant="success" badgeStyle="subtle">Publicado</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-foreground">
          Treinamentos ({cursosFiltrados.length})
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
                placeholder="Buscar cursos..."
                className="pl-9"
              />
            </div>

            <Select
              value={filtroTrilha}
              onChange={setFiltroTrilha}
              options={trilhaOptions}
            />
          </div>
        </CardContent>
      </Card>

      {/* Lista de Treinamentos */}
      {cursosFiltrados.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="w-16 h-16" />}
          title="Nenhum treinamento encontrado"
          description={busca || filtroTrilha
            ? "Ajuste os filtros para ver mais treinamentos"
            : "Treinamentos contêm módulos e aulas. Crie um para começar a adicionar conteúdo educacional."}
        >
          {!busca && !filtroTrilha && (
            <Button
              onClick={handleCreateCurso}
              leftIcon={<Plus className="w-4 h-4" />}
              className="mt-4"
            >
              Criar Primeiro Treinamento
            </Button>
          )}
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cursosFiltrados.map((curso) => (
            <Card key={curso.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Ícone */}
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
                    curso.ativo !== false ? "bg-blue-100 dark:bg-blue-900/30" : "bg-muted"
                  )}>
                    <BookOpen className={cn(
                      "w-6 h-6",
                      curso.ativo !== false ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"
                    )} />
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className={cn(
                          "font-semibold",
                          curso.ativo === false && "text-muted-foreground line-through"
                        )}>
                          {curso.titulo}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {curso.descricao}
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
                            icon={<Video className="w-4 h-4" />}
                            onClick={() => {
                              const next = (curso.statusPublicacao || 'published') === 'draft' ? 'published' : 'draft';
                              onUpdate?.(curso.id, { statusPublicacao: next, updatedAt: new Date() });
                            }}
                          >
                            {(curso.statusPublicacao || 'published') === 'draft' ? 'Publicar' : 'Tornar rascunho'}
                          </DropdownItem>
                          <DropdownItem
                            icon={<Edit2 className="w-4 h-4" />}
                            onClick={() => handleEditCurso(curso)}
                          >
                            Editar
                          </DropdownItem>
                          <DropdownSeparator />
                          <DropdownItem
                            icon={<Trash2 className="w-4 h-4" />}
                            onClick={() => handleDeleteClick(curso)}
                            destructive
                          >
                            Excluir
                          </DropdownItem>
                        </DropdownContent>
                      </DropdownMenu>
                    </div>

                    {/* Badges de info */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {getPublicacaoBadge(curso)}
                      {getModulosCount(curso.id) > 0 ? (
                        <Badge variant="secondary" badgeStyle="subtle">
                          <FolderOpen className="w-3 h-3 mr-1" />
                          {getModulosCount(curso.id)} módulos
                        </Badge>
                      ) : (
                        <Badge variant="warning" badgeStyle="subtle">
                          <FolderOpen className="w-3 h-3 mr-1" />
                          Sem módulos
                        </Badge>
                      )}

                      <Badge variant="secondary" badgeStyle="subtle">
                        <Clock className="w-3 h-3 mr-1" />
                        {formatDuracao(getDuracaoCurso(curso))}
                      </Badge>

                      <button onClick={() => onToggleAtivo?.(curso)}>
                        {curso.ativo !== false ? (
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

                    {/* Trilhas vinculadas */}
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-xs text-muted-foreground">
                        Trilhas:{" "}
                        <span className="font-medium text-foreground">
                          {getTrilhasInfo(curso.id).label}
                        </span>
                        {getTrilhasInfo(curso.id).count > 0 && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (usado em {getTrilhasInfo(curso.id).count})
                          </span>
                        )}
                      </p>
                    </div>
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
        title="Excluir Treinamento"
        description={`Tem certeza que deseja excluir o treinamento "${cursoToDelete?.titulo}"? Isso também excluirá todos os módulos e aulas associados. Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}

export default CursosTab;

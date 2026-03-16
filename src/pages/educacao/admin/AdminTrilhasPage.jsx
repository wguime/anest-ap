/**
 * AdminTrilhasPage.jsx
 * Página de administração de trilhas (CRUD)
 */

import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  Plus,
  Search,
  MoreVertical,
  Edit2,
  Trash2,
  Copy,
  GitBranch,
  CheckCircle,
  XCircle,
  AlertTriangle,
  BookOpen,
  Clock,
  Users,
} from 'lucide-react';
import {
  Card,
  CardContent,
  Button,
  Input,
  Badge,
  EmptyState,
  Alert,
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  ConfirmDialog,
  Spinner,
} from '@/design-system';
import { cn } from '@/design-system/utils/tokens';
import { TrilhaFormModal } from './TrilhaFormModal';
import { useEducacaoData } from '../hooks/useEducacaoData';
import { TIPOS_USUARIO } from '../data/educacaoUtils';

/**
 * AdminTrilhasPage - Gerenciamento de trilhas
 */
export default function AdminTrilhasPage({ onNavigate, goBack }) {
  // Hook de dados - usa Firebase por padrão
  const {
    trilhas,
    cursos,
    loading,
    error,
    addTrilha,
    updateTrilha,
    deleteTrilha,
    addCurso,
  } = useEducacaoData();

  // State local
  const [busca, setBusca] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedTrilha, setSelectedTrilha] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [trilhaToDelete, setTrilhaToDelete] = useState(null);

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
  const handleCreateTrilha = () => {
    setSelectedTrilha(null);
    setShowModal(true);
  };

  const handleEditTrilha = (trilha) => {
    setSelectedTrilha(trilha);
    setShowModal(true);
  };

  const handleDuplicateTrilha = async (trilha) => {
    const newTrilha = {
      ...trilha,
      id: undefined, // Deixar o hook gerar novo ID
      titulo: `${trilha.titulo} (Cópia)`,
    };
    await addTrilha(newTrilha);
  };

  const handleDeleteClick = (trilha) => {
    setTrilhaToDelete(trilha);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (trilhaToDelete) {
      await deleteTrilha(trilhaToDelete.id);
    }
    setTrilhaToDelete(null);
    setShowDeleteConfirm(false);
  };

  const handleSaveTrilha = async (trilhaData) => {
    if (selectedTrilha) {
      // Edição
      await updateTrilha(selectedTrilha.id, trilhaData);
    } else {
      // Criação
      await addTrilha(trilhaData);
    }
    setShowModal(false);
    setSelectedTrilha(null);
  };

  const handleToggleAtivo = async (trilha) => {
    await updateTrilha(trilha.id, { ativo: !trilha.ativo });
  };

  // Handler para quando um novo curso é criado dentro do modal de trilha
  const handleCursoCreated = async (cursoData) => {
    await addCurso(cursoData);
  };

  // Labels dos tipos de usuário
  const getTiposLabels = (tiposUsuario) => {
    return tiposUsuario
      .slice(0, 2)
      .map(t => TIPOS_USUARIO[t]?.label || t)
      .join(', ') + (tiposUsuario.length > 2 ? ` +${tiposUsuario.length - 2}` : '');
  };

  // Contar cursos
  const getCursosCount = (cursos) => {
    return cursos.length;
  };

  // Header
  const headerElement = (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="px-4 sm:px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-[70px]">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1 text-primary hover:opacity-70 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
          </div>

          <h1 className="text-base font-semibold text-foreground truncate text-center flex-1 mx-2">
            Gerenciar Trilhas
          </h1>

          <div className="min-w-[70px]" />
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      {createPortal(headerElement, document.body)}
      <div className="h-14" aria-hidden="true" />

      <div className="px-4 sm:px-6 py-4 space-y-4">
        {/* Header com botão */}
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-foreground">
            Trilhas ({trilhasFiltradas.length})
          </h2>
          <Button
            onClick={handleCreateTrilha}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Nova Trilha
          </Button>
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

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <Alert variant="error" title="Erro ao carregar trilhas">
            {error}
          </Alert>
        )}

        {/* Lista de Trilhas */}
        {!loading && trilhasFiltradas.length === 0 ? (
          <EmptyState
            icon={<GitBranch className="w-16 h-16" />}
            title="Nenhuma trilha encontrada"
            description={busca
              ? "Ajuste a busca para ver mais trilhas"
              : "Clique em 'Nova Trilha' para criar a primeira trilha"}
          />
        ) : !loading && (
          <div className="space-y-4">
            {trilhasFiltradas.map((trilha) => (
              <Card key={trilha.id} className="overflow-hidden">
                {/* Indicador de obrigatoriedade */}
                {trilha.obrigatoria && (
                  <div className="bg-warning/10 px-4 py-2 border-b border-warning/20">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-warning" />
                      <span className="text-xs font-medium text-warning">
                        Trilha Obrigatória
                      </span>
                    </div>
                  </div>
                )}

                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Ícone */}
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
                      trilha.ativo ? "bg-primary/10" : "bg-muted"
                    )}>
                      <GitBranch className={cn(
                        "w-6 h-6",
                        trilha.ativo ? "text-primary" : "text-muted-foreground"
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
                        <Badge variant="secondary" badgeStyle="subtle">
                          <Users className="w-3 h-3 mr-1" />
                          {getTiposLabels(trilha.tiposUsuario)}
                        </Badge>

                        <Badge variant="secondary" badgeStyle="subtle">
                          <BookOpen className="w-3 h-3 mr-1" />
                          {getCursosCount(trilha.cursos)} {getCursosCount(trilha.cursos) === 1 ? 'curso' : 'cursos'}
                        </Badge>

                        {trilha.prazoConclusao && (
                          <Badge variant="secondary" badgeStyle="subtle">
                            <Clock className="w-3 h-3 mr-1" />
                            {trilha.prazoConclusao} dias
                          </Badge>
                        )}

                        <button
                          onClick={() => handleToggleAtivo(trilha)}
                        >
                          {trilha.ativo ? (
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

                      {/* Lista de cursos */}
                      {trilha.cursos?.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <p className="text-xs text-muted-foreground mb-2">Cursos:</p>
                          <div className="flex flex-wrap gap-1">
                            {trilha.cursos.map((cursoId, index) => {
                              const curso = cursos.find(c => c.id === cursoId);
                              return (
                                <span
                                  key={cursoId}
                                  className="text-xs px-2 py-1 bg-muted rounded-md"
                                >
                                  {index + 1}. {curso?.titulo || cursoId}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Criar/Editar */}
      <TrilhaFormModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSaveTrilha}
        trilha={selectedTrilha}
        cursos={cursos}
        onCursoCreated={handleCursoCreated}
      />

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
    </div>
  );
}

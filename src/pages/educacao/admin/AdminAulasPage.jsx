/**
 * AdminAulasPage.jsx
 * Página de administração de aulas (CRUD)
 */

import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit2,
  Trash2,
  Eye,
  Video,
  Youtube,
  Headphones,
  FileText,
  BookOpen,
  ExternalLink,
  GripVertical,
  CheckCircle,
  XCircle,
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
} from '@/design-system';
import { cn } from '@/design-system/utils/tokens';
import { AulaFormModal } from './AulaFormModal';
import {
  TIPOS_MIDIA,
  formatDuracao,
  formatData,
} from '../data/educacaoUtils';
import { useEducacaoData } from '../hooks/useEducacaoData';

/**
 * AdminAulasPage - Gerenciamento de aulas
 */
export default function AdminAulasPage({ onNavigate, goBack }) {
  const { aulas: hookAulas, cursos: hookCursos } = useEducacaoData();
  // State
  const [aulas, setAulas] = useState(hookAulas || []);
  const [filtros, setFiltros] = useState({
    busca: '',
    cursoId: '',
    tipo: '',
  });
  const [showModal, setShowModal] = useState(false);
  const [selectedAula, setSelectedAula] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [aulaToDelete, setAulaToDelete] = useState(null);

  // Opções de filtro
  const cursoOptions = useMemo(() => {
    return [
      { value: '', label: 'Todos os cursos' },
      ...(hookCursos || []).map(c => ({ value: c.id, label: c.titulo })),
    ];
  }, [hookCursos]);

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
        return a.cursoId.localeCompare(b.cursoId);
      }
      return a.ordem - b.ordem;
    });

    return resultado;
  }, [aulas, filtros]);

  // Handlers
  const handleCreateAula = () => {
    setSelectedAula(null);
    setShowModal(true);
  };

  const handleEditAula = (aula) => {
    setSelectedAula(aula);
    setShowModal(true);
  };

  const handleDeleteClick = (aula) => {
    setAulaToDelete(aula);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    if (aulaToDelete) {
      setAulas(prev => prev.filter(a => a.id !== aulaToDelete.id));
    }
    setAulaToDelete(null);
    setShowDeleteConfirm(false);
  };

  const handleSaveAula = (aulaData) => {
    setAulas(prev => {
      const existingIndex = prev.findIndex(a => a.id === aulaData.id);
      if (existingIndex >= 0) {
        const newAulas = [...prev];
        newAulas[existingIndex] = aulaData;
        return newAulas;
      }
      return [...prev, aulaData];
    });
  };

  const handleToggleAtivo = (aula) => {
    setAulas(prev => prev.map(a =>
      a.id === aula.id ? { ...a, ativo: !a.ativo } : a
    ));
  };

  // Obter nome do curso
  const getCursoNome = (cursoId) => {
    return (hookCursos || []).find(c => c.id === cursoId)?.titulo || cursoId;
  };

  // Ícone do tipo
  const getTipoIcon = (tipo) => {
    switch (tipo) {
      case 'youtube':
        return <Youtube className="w-4 h-4 text-red-500" />;
      case 'vimeo':
        return <Video className="w-4 h-4 text-blue-400" />;
      case 'audio':
        return <Headphones className="w-4 h-4 text-purple-500" />;
      case 'document':
        return <FileText className="w-4 h-4 text-orange-500" />;
      case 'text':
        return <BookOpen className="w-4 h-4 text-green-500" />;
      case 'link':
        return <ExternalLink className="w-4 h-4 text-cyan-500" />;
      case 'video':
      default:
        return <Video className="w-4 h-4 text-blue-500" />;
    }
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
            Gerenciar Aulas
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
        {/* Botão Nova Aula */}
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-foreground">
            Aulas ({aulasFiltradas.length})
          </h2>
          <Button
            onClick={handleCreateAula}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Nova Aula
          </Button>
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

        {/* Lista de Aulas */}
        {aulasFiltradas.length === 0 ? (
          <EmptyState
            icon={<Video className="w-16 h-16" />}
            title="Nenhuma aula encontrada"
            description={filtros.busca || filtros.cursoId || filtros.tipo
              ? "Ajuste os filtros para ver mais aulas"
              : "Clique em 'Nova Aula' para criar a primeira aula"}
          />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead className="hidden sm:table-cell">Curso</TableHead>
                    <TableHead className="hidden md:table-cell">Tipo</TableHead>
                    <TableHead className="hidden md:table-cell">Duração</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aulasFiltradas.map((aula) => (
                    <TableRow key={aula.id}>
                      <TableCell>
                        <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
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
                        <button
                          onClick={() => handleToggleAtivo(aula)}
                          className="flex items-center gap-1"
                        >
                          {aula.ativo ? (
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
                              onClick={() => {}}
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
      </div>

      {/* Modal de Criar/Editar */}
      <AulaFormModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSaveAula}
        aula={selectedAula}
      />

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
    </div>
  );
}

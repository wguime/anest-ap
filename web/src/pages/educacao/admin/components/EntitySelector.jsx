/**
 * EntitySelector.jsx
 * Componente para selecionar entidades existentes com busca e paginação
 * Usado em todas as etapas do CascadeCreator
 */

import { useState, useMemo, useCallback } from 'react';
import {
  Input,
  Button,
  Badge,
} from '@/design-system';
import {
  Search,
  GitBranch,
  BookOpen,
  FolderOpen,
  Video,
  ChevronLeft,
  ChevronRight,
  Check,
} from 'lucide-react';
import { cn } from '@/design-system/utils/tokens';

const ENTITY_ICONS = {
  trilha: GitBranch,
  curso: BookOpen,
  treinamento: BookOpen,
  modulo: FolderOpen,
  aula: Video,
};

const ENTITY_LABELS = {
  trilha: 'Trilha',
  curso: 'Treinamento',
  treinamento: 'Treinamento',
  modulo: 'Módulo',
  aula: 'Aula',
};

const PAGE_SIZE = 8;

function safeLower(s) {
  return String(s || '').toLowerCase();
}

export function EntitySelector({
  entityType,
  entities = [],
  onSelect,
  excludeIds = [],
  emptyMessage = 'Nenhum item encontrado.',
  selectedId = null,
  showStatus = true,
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const Icon = ENTITY_ICONS[entityType] || BookOpen;
  const label = ENTITY_LABELS[entityType] || entityType;

  // Filtrar entidades
  const filtered = useMemo(() => {
    return entities
      .filter(e => !excludeIds.includes(e.id))
      .filter(e => {
        const q = safeLower(search).trim();
        if (!q) return true;
        return (
          safeLower(e.titulo).includes(q) ||
          safeLower(e.descricao).includes(q) ||
          safeLower(e.id).includes(q)
        );
      });
  }, [entities, excludeIds, search]);

  // Paginar
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  // Resetar página ao buscar
  const handleSearch = useCallback((value) => {
    setSearch(value);
    setPage(1);
  }, []);

  // Handler de seleção
  const handleSelect = useCallback((entity) => {
    onSelect?.(entity);
  }, [onSelect]);

  return (
    <div className="space-y-4">
      {/* Busca */}
      <Input
        variant="search"
        placeholder={`Buscar ${label.toLowerCase()}...`}
        value={search}
        onChange={(e) => handleSearch(e.target.value)}
        leftIcon={<Search className="w-4 h-4" />}
      />

      {/* Contador */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{filtered.length} {label.toLowerCase()}(s) encontrado(s)</span>
        {totalPages > 1 && (
          <span>Página {page} de {totalPages}</span>
        )}
      </div>

      {/* Lista */}
      {paged.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          <Icon className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {paged.map((entity) => {
            const isSelected = entity.id === selectedId;
            
            return (
              <button
                key={entity.id}
                type="button"
                onClick={() => handleSelect(entity)}
                className={cn(
                  "w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-all",
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                  isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                )}>
                  {isSelected ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{entity.titulo || '—'}</p>
                    {showStatus && entity.statusPublicacao && (
                      <Badge 
                        variant={entity.statusPublicacao === 'published' ? 'success' : 'secondary'}
                        badgeStyle="subtle"
                        className="text-[10px]"
                      >
                        {entity.statusPublicacao === 'published' ? 'Publicado' : 'Rascunho'}
                      </Badge>
                    )}
                    {showStatus && entity.ativo === false && (
                      <Badge variant="secondary" badgeStyle="subtle" className="text-[10px]">
                        Inativo
                      </Badge>
                    )}
                  </div>
                  
                  {entity.descricao && (
                    <p className="text-sm text-muted-foreground truncate mt-0.5">
                      {entity.descricao}
                    </p>
                  )}
                  
                  <p className="text-xs text-muted-foreground mt-1">
                    ID: <span className="font-mono">{entity.id}</span>
                  </p>
                </div>

                <ChevronRight className={cn(
                  "w-5 h-5 shrink-0 transition-colors",
                  isSelected ? "text-primary" : "text-muted-foreground"
                )} />
              </button>
            );
          })}
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }
              
              return (
                <Button
                  key={pageNum}
                  variant={page === pageNum ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setPage(pageNum)}
                  className="w-8 h-8 p-0"
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default EntitySelector;

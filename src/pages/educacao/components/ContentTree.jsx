/**
 * ContentTree.jsx
 * Componente de árvore para visualização hierárquica do conteúdo
 * Trilha → Curso → Módulo → Aula
 *
 * Linhas de conexão baseadas em: https://iamkate.com/code/tree-views/
 */

import { useState, useCallback } from 'react';
import {
  ChevronDown,
  ChevronRight,
  GitBranch,
  BookOpen,
  FolderOpen,
  Video,
  Edit2,
  Trash2,
  Play,
  Plus,
  MoreVertical,
  GripVertical,
  CheckCircle,
  XCircle,
  ExternalLink,
} from 'lucide-react';
import {
  Button,
  Badge,
  DropdownMenu,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  Tooltip,
} from '@/design-system';
import { useBreakpoint } from '@/design-system/hooks';
import { cn } from '@/design-system/utils/tokens';

/**
 * Ícones por tipo de nó
 */
const NODE_ICONS = {
  trilha: GitBranch,
  curso: BookOpen,
  modulo: FolderOpen,
  aula: Video,
};

/**
 * Cores por tipo de nó
 */
const NODE_COLORS = {
  trilha: 'text-purple-500',
  curso: 'text-blue-500',
  modulo: 'text-orange-500',
  aula: 'text-green-500',
};

/**
 * CSS Variables para as linhas da árvore
 */
const TREE_VARS = {
  lineColor: 'var(--muted-foreground)',
  lineOpacity: '0.25',
  spacing: 20, // Espaçamento base entre níveis (px)
  lineWidth: 1, // Largura da linha (px)
};

/**
 * TreeLines - Componente para renderizar as linhas de conexão
 */
function TreeLines({ level, isLast, hasChildren, isExpanded }) {
  if (level === 0) return null;

  return (
    <>
      {/* Linha vertical - conecta ao pai */}
      <span
        className="absolute pointer-events-none"
        style={{
          left: (level - 1) * TREE_VARS.spacing + 9,
          top: 0,
          bottom: isLast ? '50%' : 0,
          width: TREE_VARS.lineWidth,
          backgroundColor: TREE_VARS.lineColor,
          opacity: TREE_VARS.lineOpacity,
        }}
      />
      {/* Linha horizontal - conecta ao nó atual */}
      <span
        className="absolute pointer-events-none"
        style={{
          left: (level - 1) * TREE_VARS.spacing + 9,
          top: '50%',
          width: TREE_VARS.spacing - 4,
          height: TREE_VARS.lineWidth,
          backgroundColor: TREE_VARS.lineColor,
          opacity: TREE_VARS.lineOpacity,
          transform: 'translateY(-50%)',
        }}
      />
    </>
  );
}

/**
 * TreeLinesEdit - Componente para renderizar as linhas de conexão (modo edição com drag handle)
 */
function TreeLinesEdit({ level, isLast }) {
  if (level === 0) return null;

  // Offset adicional para acomodar o drag handle (w-4 = 16px + gap = ~18px)
  const dragOffset = 18;

  return (
    <>
      {/* Linha vertical - conecta ao pai */}
      <span
        className="absolute pointer-events-none"
        style={{
          left: (level - 1) * TREE_VARS.spacing + 9 + dragOffset,
          top: 0,
          bottom: isLast ? '50%' : 0,
          width: TREE_VARS.lineWidth,
          backgroundColor: TREE_VARS.lineColor,
          opacity: TREE_VARS.lineOpacity,
        }}
      />
      {/* Linha horizontal - conecta ao nó atual */}
      <span
        className="absolute pointer-events-none"
        style={{
          left: (level - 1) * TREE_VARS.spacing + 9 + dragOffset,
          top: '50%',
          width: TREE_VARS.spacing - 4,
          height: TREE_VARS.lineWidth,
          backgroundColor: TREE_VARS.lineColor,
          opacity: TREE_VARS.lineOpacity,
          transform: 'translateY(-50%)',
        }}
      />
    </>
  );
}

/**
 * ReadOnlyTreeNode - Nó simplificado para modo somente leitura
 */
function ReadOnlyTreeNode({
  node,
  onNavigate,
  expandedNodes,
  toggleExpand,
  level = 0,
  isLast = false,
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedNodes.has(node.id);
  const Icon = NODE_ICONS[node.type] || Video;
  const iconColor = NODE_COLORS[node.type] || 'text-gray-500';
  const { isTouchDevice, isMobile } = useBreakpoint();

  const handleToggle = () => {
    if (hasChildren) {
      toggleExpand(node.id);
    }
  };

  // Keyboard navigation handler
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle();
    }
  };

  return (
    <div className="select-none relative">
      {/* Linhas de conexão */}
      <TreeLines
        level={level}
        isLast={isLast}
        hasChildren={hasChildren}
        isExpanded={isExpanded}
      />

      {/* Linha do nó */}
      <div
        role="treeitem"
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-level={level + 1}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className={cn(
          "group flex items-center gap-1.5 py-1.5 px-1 rounded-lg transition-colors min-h-[32px]",
          "hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
        )}
        style={{ marginLeft: level * TREE_VARS.spacing }}
      >
        {/* Botão de expandir/colapsar */}
        <button
          type="button"
          onClick={handleToggle}
          aria-label={hasChildren ? (isExpanded ? "Colapsar" : "Expandir") : undefined}
          className={cn(
            "w-5 h-5 flex items-center justify-center rounded transition-colors flex-shrink-0",
            hasChildren ? "hover:bg-muted cursor-pointer" : "cursor-default opacity-0"
          )}
        >
          {hasChildren && (
            isExpanded
              ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
              : <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </button>

        {/* Ícone do tipo */}
        <div className={cn(
          "w-6 h-6 rounded flex items-center justify-center flex-shrink-0",
          node.ativo !== false ? "bg-primary/10" : "bg-muted"
        )}>
          <Icon className={cn(
            "w-3.5 h-3.5",
            node.ativo !== false ? iconColor : "text-muted-foreground"
          )} />
        </div>

        {/* Conteúdo principal */}
        <div className="flex-1 min-w-0">
          {/* Título */}
          <span className={cn(
            "block font-medium text-sm leading-snug",
            node.ativo === false && "text-muted-foreground line-through"
          )}>
            {node.titulo}
          </span>

          {/* Badges inline */}
          {(hasChildren || node.obrigatoria || node.ativo === false) && (
            <div className="flex items-center gap-1 flex-wrap mt-0.5">
              {hasChildren && (
                <Badge variant="secondary" badgeStyle="subtle" className="text-[10px] px-1 py-0 h-4">
                  {node.children.length}
                </Badge>
              )}
              {node.obrigatoria && (
                <Badge variant="warning" badgeStyle="subtle" className="text-[10px] px-1 py-0 h-4">
                  Obrig.
                </Badge>
              )}
              {node.ativo === false && (
                <Badge variant="secondary" badgeStyle="subtle" className="text-[10px] px-1 py-0 h-4">
                  Inativo
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Ações compactas */}
        {node.ativo !== false && (
          <CheckCircle className="w-4 h-4 text-green-500/60 flex-shrink-0" />
        )}
        {onNavigate && (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onNavigate(node.type, { id: node.id })}
            className={cn(
              "w-6 h-6 flex-shrink-0 transition-opacity",
              (isTouchDevice || isMobile) ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
            title="Ver detalhes"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {/* Filhos (recursivo) */}
      {hasChildren && isExpanded && (
        <div role="group">
          {node.children.map((child, index) => (
            <ReadOnlyTreeNode
              key={child.id}
              node={child}
              onNavigate={onNavigate}
              expandedNodes={expandedNodes}
              toggleExpand={toggleExpand}
              level={level + 1}
              isLast={index === node.children.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * TreeNode - Componente individual de nó da árvore
 */
function TreeNode({
  node,
  onEdit,
  onDelete,
  onAdd,
  onPlay,
  onToggleActive,
  expandedNodes,
  toggleExpand,
  level = 0,
  isLast = false,
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedNodes.has(node.id);
  const Icon = NODE_ICONS[node.type] || Video;
  const iconColor = NODE_COLORS[node.type] || 'text-gray-500';
  const { isTouchDevice, isMobile } = useBreakpoint();

  const handleToggle = () => {
    if (hasChildren) {
      toggleExpand(node.id);
    }
  };

  // Keyboard navigation handler
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle();
    }
  };

  // Determinar o que pode ser adicionado como filho
  const getChildType = () => {
    switch (node.type) {
      case 'trilha': return 'curso';
      case 'curso': return 'modulo';
      case 'modulo': return 'aula';
      default: return null;
    }
  };

  const childType = getChildType();
  const childLabel = {
    curso: 'Curso',
    modulo: 'Módulo',
    aula: 'Aula',
  }[childType];

  // Determinar visibilidade dos botões de ação
  const actionButtonClass = cn(
    "transition-opacity",
    (isTouchDevice || isMobile) ? "opacity-100" : "opacity-0 group-hover:opacity-100"
  );

  // Calcular se é último item considerando o botão "Adicionar"
  const isLastInGroup = isLast && !childType;

  return (
    <div className="select-none relative">
      {/* Linhas de conexão (com offset para drag handle) */}
      <TreeLinesEdit level={level} isLast={isLastInGroup} />

      {/* Linha do nó */}
      <div
        role="treeitem"
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-level={level + 1}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className={cn(
          "group flex items-center gap-1.5 py-1.5 px-1 rounded-lg transition-colors min-h-[32px]",
          "hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
        )}
        style={{ marginLeft: level * TREE_VARS.spacing }}
      >
        {/* Drag handle */}
        <div
          className={cn(
            "w-4 h-5 flex items-center justify-center cursor-grab flex-shrink-0",
            (isTouchDevice || isMobile) ? "opacity-50" : "opacity-0 group-hover:opacity-50"
          )}
        >
          <GripVertical className="w-3 h-3 text-muted-foreground" />
        </div>

        {/* Botão de expandir/colapsar */}
        <button
          type="button"
          onClick={handleToggle}
          aria-label={hasChildren ? (isExpanded ? "Colapsar" : "Expandir") : undefined}
          className={cn(
            "w-5 h-5 flex items-center justify-center rounded transition-colors flex-shrink-0",
            hasChildren ? "hover:bg-muted cursor-pointer" : "cursor-default opacity-0"
          )}
        >
          {hasChildren && (
            isExpanded
              ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
              : <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </button>

        {/* Ícone do tipo */}
        <div className={cn(
          "w-6 h-6 rounded flex items-center justify-center flex-shrink-0",
          node.ativo !== false ? "bg-primary/10" : "bg-muted"
        )}>
          <Icon className={cn(
            "w-3.5 h-3.5",
            node.ativo !== false ? iconColor : "text-muted-foreground"
          )} />
        </div>

        {/* Conteúdo principal */}
        <div className="flex-1 min-w-0">
          {/* Título */}
          <span className={cn(
            "block font-medium text-sm leading-snug",
            node.ativo === false && "text-muted-foreground line-through"
          )}>
            {node.titulo}
          </span>

          {/* Descrição */}
          {node.descricao && (
            <p className="text-xs text-muted-foreground leading-snug mt-0.5">
              {node.descricao}
            </p>
          )}

          {/* Badges inline */}
          {(hasChildren || node.obrigatoria || node.ativo === false) && (
            <div className="flex items-center gap-1 flex-wrap mt-0.5">
              {hasChildren && (
                <Badge variant="secondary" badgeStyle="subtle" className="text-[10px] px-1 py-0 h-4">
                  {node.children.length}
                </Badge>
              )}
              {node.obrigatoria && (
                <Badge variant="warning" badgeStyle="subtle" className="text-[10px] px-1 py-0 h-4">
                  Obrig.
                </Badge>
              )}
              {node.ativo === false && (
                <Badge variant="secondary" badgeStyle="subtle" className="text-[10px] px-1 py-0 h-4">
                  Inativo
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Ações compactas */}
        {node.type !== 'aula' && (
          <button
            onClick={() => onToggleActive?.(node)}
            aria-label={node.ativo !== false ? "Desativar item" : "Ativar item"}
            className={cn(
              "w-6 h-6 flex items-center justify-center rounded flex-shrink-0",
              actionButtonClass
            )}
          >
            {node.ativo !== false ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        )}

        {node.type === 'aula' && onPlay && (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onPlay(node)}
            aria-label="Reproduzir aula"
            className={cn("w-6 h-6 flex-shrink-0", actionButtonClass)}
          >
            <Play className="w-3.5 h-3.5" />
          </Button>
        )}

        <DropdownMenu>
          <DropdownTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Menu de ações"
              className={cn("w-6 h-6 flex-shrink-0", actionButtonClass)}
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownTrigger>
          <DropdownContent align="end">
            <DropdownItem
              icon={<Edit2 className="w-4 h-4" />}
              onClick={() => onEdit?.(node)}
            >
              Editar
            </DropdownItem>

            {childType && (
              <DropdownItem
                icon={<Plus className="w-4 h-4" />}
                onClick={() => onAdd?.(node.type, node.id, childType)}
              >
                Adicionar {childLabel}
              </DropdownItem>
            )}

            <DropdownSeparator />

            <DropdownItem
              icon={<Trash2 className="w-4 h-4" />}
              onClick={() => onDelete?.(node)}
              destructive
            >
              Excluir
            </DropdownItem>
          </DropdownContent>
        </DropdownMenu>
      </div>

      {/* Filhos (recursivo) */}
      {hasChildren && isExpanded && (
        <div role="group">
          {node.children.map((child, index) => (
            <TreeNode
              key={child.id}
              node={child}
              onEdit={onEdit}
              onDelete={onDelete}
              onAdd={onAdd}
              onPlay={onPlay}
              onToggleActive={onToggleActive}
              expandedNodes={expandedNodes}
              toggleExpand={toggleExpand}
              level={level + 1}
              isLast={index === node.children.length - 1}
            />
          ))}

          {/* Botão de adicionar no final da lista */}
          {childType && (
            <div className="relative">
              {/* Linhas para o botão adicionar */}
              <TreeLinesEdit level={level + 1} isLast={true} />

              <button
                type="button"
                onClick={() => onAdd?.(node.type, node.id, childType)}
                className={cn(
                  "flex items-center gap-1.5 py-1.5 px-1 w-full text-left min-h-[32px]",
                  "text-sm text-muted-foreground hover:text-foreground",
                  "hover:bg-muted/30 rounded-lg transition-colors"
                )}
                style={{ marginLeft: (level + 1) * TREE_VARS.spacing }}
              >
                <div className="w-4 h-5 flex-shrink-0" /> {/* Spacer para alinhar com drag */}
                <Plus className="w-5 h-5 flex-shrink-0" />
                <span>Adicionar {childLabel}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * ContentTree - Componente principal da árvore de conteúdo
 *
 * @param {boolean} readOnly - Se true, exibe árvore simplificada sem ações de edição
 * @param {function} onNavigate - Callback para navegação (usado em modo readOnly)
 */
export function ContentTree({
  data,
  readOnly = false,
  onNavigate,
  onEdit,
  onDelete,
  onAdd,
  onPlay,
  onToggleActive,
  defaultExpandedTypes = ['trilha'],
  className,
}) {
  // Estado de nós expandidos
  const [expandedNodes, setExpandedNodes] = useState(() => {
    const expanded = new Set();
    // Expandir tipos padrão
    data.forEach(node => {
      if (defaultExpandedTypes.includes(node.type)) {
        expanded.add(node.id);
      }
    });
    return expanded;
  });

  const toggleExpand = useCallback((nodeId) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const allIds = new Set();
    const collectIds = (nodes) => {
      nodes.forEach(node => {
        allIds.add(node.id);
        if (node.children) {
          collectIds(node.children);
        }
      });
    };
    collectIds(data);
    setExpandedNodes(allIds);
  }, [data]);

  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set());
  }, []);

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <GitBranch className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Nenhum conteudo encontrado</p>
        <p className="text-sm">Crie uma trilha para comecar</p>
      </div>
    );
  }

  // Modo somente leitura
  if (readOnly) {
    return (
      <div className={cn("space-y-0", className)}>
        {/* Controles */}
        <div className="flex items-center justify-end gap-2 mb-4">
          <Button
            size="sm"
            variant="ghost"
            onClick={expandAll}
          >
            Expandir Tudo
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={collapseAll}
          >
            Colapsar Tudo
          </Button>
        </div>

        {/* Árvore simplificada com ARIA */}
        <div role="tree" aria-label="Estrutura de conteúdo">
          {data.map((node, index) => (
            <ReadOnlyTreeNode
              key={node.id}
              node={node}
              onNavigate={onNavigate}
              expandedNodes={expandedNodes}
              toggleExpand={toggleExpand}
              level={0}
              isLast={index === data.length - 1}
            />
          ))}
        </div>
      </div>
    );
  }

  // Modo completo com ações
  return (
    <div className={cn("space-y-0", className)}>
      {/* Controles */}
      <div className="flex items-center justify-end gap-2 mb-4">
        <Button
          size="sm"
          variant="ghost"
          onClick={expandAll}
        >
          Expandir Tudo
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={collapseAll}
        >
          Colapsar Tudo
        </Button>
      </div>

      {/* Árvore com ARIA */}
      <div role="tree" aria-label="Estrutura de conteúdo">
        {data.map((node, index) => (
          <TreeNode
            key={node.id}
            node={node}
            onEdit={onEdit}
            onDelete={onDelete}
            onAdd={onAdd}
            onPlay={onPlay}
            onToggleActive={onToggleActive}
            expandedNodes={expandedNodes}
            toggleExpand={toggleExpand}
            level={0}
            isLast={index === data.length - 1}
          />
        ))}
      </div>

      {/* Botão de adicionar trilha no final */}
      <button
        type="button"
        onClick={() => onAdd?.(null, null, 'trilha')}
        className={cn(
          "flex items-center gap-2 px-3 py-3 w-full text-left mt-4",
          "text-sm text-muted-foreground hover:text-foreground",
          "border-2 border-dashed border-border hover:border-primary/50",
          "rounded-xl transition-colors"
        )}
      >
        <Plus className="w-5 h-5" />
        <span>Nova Trilha</span>
      </button>
    </div>
  );
}

export default ContentTree;

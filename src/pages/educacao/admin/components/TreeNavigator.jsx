import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Tree } from 'react-arborist';
import { ChevronRight, Dot } from 'lucide-react';
import { Badge } from '@/design-system';
import { cn } from '@/design-system/utils/tokens';

const NODE_LABEL = {
  trilha: 'Trilha',
  curso: 'Treinamento',
  modulo: 'Módulo',
  aula: 'Aula',
};

function nodeKey(node) {
  return `${node?.type || 'unknown'}:${node?.id || 'unknown'}`;
}

function collectAllKeys(items) {
  const out = [];
  const walk = (nodes) => {
    (nodes || []).forEach((n) => {
      out.push(nodeKey(n));
      if (Array.isArray(n.children) && n.children.length) walk(n.children);
    });
  };
  walk(items);
  return out;
}

export function useTreeExpansion(items, { defaultExpandAll = false } = {}) {
  const allKeys = useMemo(() => collectAllKeys(items), [items]);
  const allKeysRef = useRef(allKeys);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    allKeysRef.current = allKeys;
  }, [allKeys]);

  const [expandedKeys, setExpandedKeys] = useState(() => {
    if (defaultExpandAll) return new Set(allKeys);
    return new Set();
  });

  useEffect(() => {
    setExpandedKeys((prev) => {
      const allowed = new Set(allKeysRef.current);
      const hasInvalid = Array.from(prev).some(k => !allowed.has(k));
      if (!hasInvalid) return prev;
      const next = new Set();
      prev.forEach((k) => {
        if (allowed.has(k)) next.add(k);
      });
      return next;
    });
  }, [allKeys]);

  const isExpanded = useCallback((key) => expandedKeys.has(key), [expandedKeys]);

  const expand = useCallback((key) => {
    setExpandedKeys((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    setVersion(v => v + 1);
  }, []);

  const collapse = useCallback((key) => {
    setExpandedKeys((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    setVersion(v => v + 1);
  }, []);

  const toggle = useCallback((key) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setVersion(v => v + 1);
  }, []);

  const expandAll = useCallback(() => {
    setExpandedKeys(() => new Set(allKeysRef.current));
    setVersion(v => v + 1);
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedKeys(() => new Set());
    setVersion(v => v + 1);
  }, []);

  return {
    expandedKeys,
    setExpandedKeys,
    isExpanded,
    expand,
    collapse,
    toggle,
    expandAll,
    collapseAll,
    allKeys,
    version,
  };
}

function NodeRenderer({ node, style, dragHandle, tree }) {
  const data = node.data || {};
  const hasChildren = Array.isArray(data.children) && data.children.length > 0;
  const childCount = hasChildren ? data.children.length : 0;
  const isSelected = node.isSelected;

  return (
    <div
      ref={dragHandle}
      style={style}
      role="treeitem"
      aria-level={node.level + 1}
      aria-selected={isSelected || undefined}
      aria-expanded={hasChildren ? node.isOpen : undefined}
      className={cn(
        'group relative flex items-center gap-2.5 rounded-xl px-3 py-2 mx-1 my-0.5',
        'transition-colors duration-150 select-none cursor-pointer',
        isSelected ? 'bg-primary/10' : 'hover:bg-muted/60',
        data?.ativo === false && 'opacity-60',
        node.isDragging && 'opacity-40'
      )}
      data-active={data?.ativo !== false}
    >
      {hasChildren ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            node.toggle();
          }}
          className={cn(
            'h-9 w-9 shrink-0 inline-flex items-center justify-center',
            'rounded-lg hover:bg-primary/10 transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          )}
          aria-label={node.isOpen ? 'Colapsar' : 'Expandir'}
          title={node.isOpen ? 'Colapsar' : 'Expandir'}
        >
          <ChevronRight
            className={cn(
              'h-4 w-4 text-primary transition-transform duration-200',
              node.isOpen ? 'rotate-90' : 'rotate-0'
            )}
          />
        </button>
      ) : (
        <span className="h-9 w-9 inline-flex items-center justify-center shrink-0 text-muted-foreground/30">
          <Dot className="h-4 w-4" />
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2 min-w-0">
          {node.isEditing ? (
            <input
              type="text"
              autoFocus
              defaultValue={data.titulo || ''}
              onClick={(e) => e.stopPropagation()}
              onBlur={(e) => node.submit(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') node.submit(e.currentTarget.value);
                if (e.key === 'Escape') node.reset();
              }}
              aria-label="Renomear item"
              className={cn(
                'w-full text-sm font-medium px-2 py-1 rounded-md',
                'bg-background border border-primary outline-none',
                'focus:ring-2 focus:ring-primary/30'
              )}
            />
          ) : (
            <p
              onDoubleClick={() => {
                if (!tree.props.disableEdit) node.edit();
              }}
              className={cn(
                'text-sm font-medium leading-snug whitespace-normal break-words',
                isSelected ? 'text-primary' : 'text-foreground'
              )}
              title={`${NODE_LABEL[data?.type] || 'Item'} • ID: ${data?.id || '—'}`}
            >
              {data?.titulo || '—'}
            </p>
          )}

          {data?.ativo === false && (
            <Badge variant="secondary" badgeStyle="subtle">
              Inativo
            </Badge>
          )}
        </div>
        <p className={cn(
          'text-xs mt-0.5',
          isSelected ? 'text-primary/70' : 'text-muted-foreground'
        )}>
          {NODE_LABEL[data?.type] || 'Item'}
        </p>
      </div>

      <div className="shrink-0 flex items-center gap-2">
        {hasChildren && (
          <Badge
            variant={isSelected ? 'default' : 'secondary'}
            badgeStyle="subtle"
            className="text-xs font-semibold"
          >
            {childCount}
          </Badge>
        )}
      </div>
    </div>
  );
}

const ROW_HEIGHT = 56;

export function TreeNavigator({
  items,
  selectedNode,
  onSelect,
  onMove,
  onRename,
  expansion,
  ariaLabel = 'Navegação hierárquica de conteúdo',
  className,
  height = 600,
  width = '100%',
}) {
  const selectedKey = selectedNode?.type && selectedNode?.id
    ? nodeKey(selectedNode)
    : null;

  const initialOpenState = useMemo(() => {
    const map = {};
    const set = expansion?.expandedKeys || new Set();
    set.forEach((k) => { map[k] = true; });
    return map;
  }, [expansion?.expandedKeys]);

  const handleSelect = useCallback((nodes) => {
    const first = nodes?.[0];
    if (first && first.data) onSelect?.(first.data);
  }, [onSelect]);

  const handleToggle = useCallback((id) => {
    expansion?.toggle?.(id);
  }, [expansion]);

  if (!Array.isArray(items) || items.length === 0) {
    return (
      <div className={cn('p-4 text-sm text-muted-foreground', className)}>
        Nenhum item encontrado.
      </div>
    );
  }

  return (
    <div role="tree" aria-label={ariaLabel} className={cn('w-full', className)}>
      <Tree
        key={`tree-${expansion?.version || 0}`}
        data={items}
        idAccessor={(node) => nodeKey(node)}
        childrenAccessor="children"
        openByDefault={false}
        initialOpenState={initialOpenState}
        selection={selectedKey || undefined}
        onSelect={handleSelect}
        onToggle={handleToggle}
        onMove={onMove}
        onRename={onRename}
        disableEdit={!onRename}
        disableDrag={!onMove}
        disableDrop={!onMove}
        rowHeight={ROW_HEIGHT}
        height={height}
        width={width}
        indent={16}
        overscanCount={5}
        padding={4}
      >
        {NodeRenderer}
      </Tree>
    </div>
  );
}

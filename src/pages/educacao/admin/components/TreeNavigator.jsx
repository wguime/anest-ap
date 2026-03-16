import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Dot } from 'lucide-react';
import { Badge, Button } from '@/design-system';
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

function flattenVisible(items, isExpanded) {
  const flat = [];
  const walk = (nodes, level, parentKey) => {
    (nodes || []).forEach((n) => {
      const key = nodeKey(n);
      const children = Array.isArray(n.children) ? n.children : [];
      const hasChildren = children.length > 0;
      const expanded = hasChildren ? !!isExpanded(key) : false;
      flat.push({
        key,
        node: n,
        level,
        parentKey,
        hasChildren,
        expanded,
        childCount: children.length,
      });
      if (hasChildren && expanded) {
        walk(children, level + 1, key);
      }
    });
  };
  walk(items, 1, null);
  return flat;
}

/**
 * Hook para controlar expansão/colapso de uma árvore (Set de keys).
 * Mantém o estado consistente quando a árvore muda (ex: busca).
 */
export function useTreeExpansion(items, { defaultExpandAll = false } = {}) {
  const allKeys = useMemo(() => collectAllKeys(items), [items]);
  const allKeysRef = useRef(allKeys);

  // Contador de versão para forçar re-renders
  const [version, setVersion] = useState(0);

  // Atualizar ref quando allKeys muda
  useEffect(() => {
    allKeysRef.current = allKeys;
  }, [allKeys]);

  const [expandedKeys, setExpandedKeys] = useState(() => {
    if (defaultExpandAll) return new Set(allKeys);
    return new Set();
  });

  // Remover keys que não existem mais (ex: após filtro/busca)
  useEffect(() => {
    setExpandedKeys((prev) => {
      const allowed = new Set(allKeysRef.current);
      const hasInvalid = Array.from(prev).some(k => !allowed.has(k));
      
      // Só atualiza se tiver keys inválidas
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
    version, // Expor versão para forçar re-render em consumers
  };
}

function TreeRow({
  item,
  selectedKey,
  focusedKey,
  setFocusedKey,
  onSelect,
  onToggleExpand,
  onExpand,
  onCollapse,
  rowRef,
}) {
  const { key, node, level, parentKey, hasChildren, expanded, childCount } = item;

  const isSelected = selectedKey === key;
  const isFocused = focusedKey === key;

  const handleSelect = () => {
    setFocusedKey(key);
    onSelect?.(node);
  };

  const handleKeyDown = (e) => {
    // Seleção (setas são tratadas no container para evitar duplicidade)
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      handleSelect();
      return;
    }
    if (e.key === 'Backspace') {
      // Atalho opcional: voltar para o pai (não conflita com input porque o foco está no treeitem)
      if (parentKey) {
        e.preventDefault();
        e.stopPropagation();
        setFocusedKey(parentKey);
      }
    }
  };

  return (
    <div
      ref={rowRef}
      role="treeitem"
      aria-level={level}
      aria-selected={isSelected}
      aria-expanded={hasChildren ? expanded : undefined}
      tabIndex={isFocused ? 0 : -1}
      onClick={handleSelect}
      onFocus={() => setFocusedKey(key)}
      onKeyDown={handleKeyDown}
      className={cn(
        'group relative flex items-center gap-2.5 rounded-xl px-3 py-2',
        'transition-colors duration-150 select-none cursor-pointer',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        isSelected
          ? 'bg-primary/10'
          : 'hover:bg-muted/60',
        node?.ativo === false ? 'opacity-60' : null
      )}
      style={{ paddingLeft: 8 + (level - 1) * 12 }}
      data-active={node?.ativo !== false}
    >
      {level > 1 ? (
        <>
          <span
            aria-hidden="true"
            className="absolute top-0 bottom-0 w-px bg-border/40 pointer-events-none"
            style={{ left: 8 + (level - 2) * 12 + 12 }}
          />
          <span
            aria-hidden="true"
            className="absolute top-1/2 h-px bg-border/40 pointer-events-none"
            style={{ left: 8 + (level - 2) * 12 + 12, width: 12 }}
          />
        </>
      ) : null}

      {hasChildren ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand?.(key);
          }}
          className={cn(
            'h-9 w-9 shrink-0 inline-flex items-center justify-center',
            'rounded-lg hover:bg-primary/10 transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          )}
          title={expanded ? 'Colapsar' : 'Expandir'}
          aria-label={expanded ? 'Colapsar' : 'Expandir'}
        >
          <ChevronRight
            className={cn(
              'h-4 w-4 text-primary transition-transform duration-200',
              expanded ? 'rotate-90' : 'rotate-0'
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
          <p
            className={cn(
              'text-sm font-medium leading-snug whitespace-normal break-words',
              isSelected ? 'text-primary' : 'text-foreground'
            )}
            title={`${NODE_LABEL[node?.type] || 'Item'} • ID: ${node?.id || '—'}`}
          >
            {node?.titulo || '—'}
          </p>

          {node?.ativo === false ? (
            <Badge variant="secondary" badgeStyle="subtle">
              Inativo
            </Badge>
          ) : null}
        </div>
        <p className={cn(
          'text-xs mt-0.5',
          isSelected ? 'text-primary/70' : 'text-muted-foreground'
        )}>
          {NODE_LABEL[node?.type] || 'Item'}
        </p>
      </div>

      <div className="shrink-0 flex items-center gap-2">
        {hasChildren ? (
          <Badge 
            variant={isSelected ? 'default' : 'secondary'} 
            badgeStyle="subtle" 
            className="text-xs font-semibold"
          >
            {childCount}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}

export function TreeNavigator({
  items,
  selectedNode,
  onSelect,
  expansion,
  ariaLabel = 'Navegação hierárquica de conteúdo',
  className,
}) {
  const selectedKey = selectedNode?.type && selectedNode?.id ? `${selectedNode.type}:${selectedNode.id}` : null;

  // Extrair o Set diretamente
  const expandedKeys = expansion?.expandedKeys || new Set();
  const toggle = expansion?.toggle;
  const expand = expansion?.expand;
  const collapse = expansion?.collapse;

  // Função para verificar se está expandido - usa o Set diretamente
  const isExpandedFn = (key) => expandedKeys.has(key);

  // Recalcula sempre - evita problemas com memoização de Sets
  // Performance é aceitável para árvores de tamanho normal
  const flat = flattenVisible(items, isExpandedFn);

  const [focusedKey, setFocusedKey] = useState(() => selectedKey || flat[0]?.key || null);
  const rowRefs = useRef(new Map());

  // Manter foco válido ao filtrar/buscar
  useEffect(() => {
    if (!flat.length) {
      setFocusedKey(null);
      return;
    }
    if (focusedKey && flat.some((x) => x.key === focusedKey)) return;
    setFocusedKey(selectedKey || flat[0].key);
  }, [flat, focusedKey, selectedKey]);

  // Scroll/focus para item selecionado (quando existir na lista visível)
  useEffect(() => {
    if (!selectedKey) return;
    const ref = rowRefs.current.get(selectedKey);
    if (ref && typeof ref.scrollIntoView === 'function') {
      ref.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedKey, flat]);

  const focusByIndex = useCallback((idx) => {
    const item = flat[idx];
    if (!item) return;
    setFocusedKey(item.key);
    const ref = rowRefs.current.get(item.key);
    if (ref && typeof ref.focus === 'function') ref.focus();
  }, [flat]);

  const onContainerKeyDown = (e) => {
    if (!flat.length) return;
    const currentIndex = flat.findIndex((x) => x.key === focusedKey);
    const idx = currentIndex >= 0 ? currentIndex : 0;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusByIndex(Math.min(flat.length - 1, idx + 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusByIndex(Math.max(0, idx - 1));
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      focusByIndex(0);
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      focusByIndex(flat.length - 1);
      return;
    }
    if (e.key === 'ArrowRight') {
      const item = flat[idx];
      if (!item) return;
      if (item.hasChildren && !item.expanded) {
        e.preventDefault();
        e.stopPropagation();
        expand?.(item.key);
        return;
      }
      // Se já expandido, focar primeiro filho (se existir)
      if (item.hasChildren && item.expanded) {
        const next = flat[idx + 1];
        if (next && next.parentKey === item.key) {
          e.preventDefault();
          e.stopPropagation();
          focusByIndex(idx + 1);
        }
      }
      return;
    }
    if (e.key === 'ArrowLeft') {
      const item = flat[idx];
      if (!item) return;
      if (item.hasChildren && item.expanded) {
        e.preventDefault();
        e.stopPropagation();
        collapse?.(item.key);
        return;
      }
      if (item.parentKey) {
        const parentIdx = flat.findIndex((x) => x.key === item.parentKey);
        if (parentIdx >= 0) {
          e.preventDefault();
          e.stopPropagation();
          focusByIndex(parentIdx);
        }
      }
    }
  };

  if (!Array.isArray(items) || items.length === 0) {
    return (
      <div className={cn('p-4 text-sm text-muted-foreground', className)}>
        Nenhum item encontrado.
      </div>
    );
  }

  return (
    <div
      role="tree"
      aria-label={ariaLabel}
      className={cn('space-y-0.5', className)}
      onKeyDown={onContainerKeyDown}
    >
      {flat.map((item) => (
        <TreeRow
          key={item.key}
          item={item}
          selectedKey={selectedKey}
          focusedKey={focusedKey}
          setFocusedKey={setFocusedKey}
          onSelect={onSelect}
          onToggleExpand={toggle}
          onExpand={expand}
          onCollapse={collapse}
          rowRef={(el) => {
            if (!el) {
              rowRefs.current.delete(item.key);
              return;
            }
            rowRefs.current.set(item.key, el);
          }}
        />
      ))}
    </div>
  );
}


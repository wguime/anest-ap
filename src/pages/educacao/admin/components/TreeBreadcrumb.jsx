import { useMemo } from 'react';
import { BookOpen, FolderOpen, GitBranch, Video } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/design-system';

const NODE_ICON = {
  trilha: GitBranch,
  curso: BookOpen,
  modulo: FolderOpen,
  aula: Video,
};

const NODE_LABEL = {
  trilha: 'Trilha',
  curso: 'Treinamento',
  modulo: 'Módulo',
  aula: 'Aula',
};

function nodeKey(node) {
  return `${node?.type || 'unknown'}:${node?.id || 'unknown'}`;
}

function findPath(nodes, targetKey, acc = []) {
  for (const n of nodes || []) {
    const nextAcc = [...acc, n];
    if (nodeKey(n) === targetKey) return nextAcc;
    const children = Array.isArray(n.children) ? n.children : [];
    if (children.length) {
      const found = findPath(children, targetKey, nextAcc);
      if (found) return found;
    }
  }
  return null;
}

export function TreeBreadcrumb({ items, selectedNode, onSelect }) {
  const selectedKey = selectedNode?.type && selectedNode?.id ? `${selectedNode.type}:${selectedNode.id}` : null;

  const path = useMemo(() => {
    if (!selectedKey) return [];
    const found = findPath(items || [], selectedKey);
    return Array.isArray(found) ? found : [];
  }, [items, selectedKey]);

  if (!selectedKey || path.length === 0) return null;

  return (
    <Breadcrumb className="mb-3 px-1">
      <BreadcrumbList>
        {path.map((n, idx) => {
          const isLast = idx === path.length - 1;
          const Icon = NODE_ICON[n.type] || BookOpen;
          const title = n?.titulo || '—';
          const tooltipText = `${NODE_LABEL[n.type] || 'Item'} • ${title}`;

          return (
            <BreadcrumbItem key={nodeKey(n)}>
              {idx > 0 ? <BreadcrumbSeparator /> : null}

              {isLast ? (
                <BreadcrumbPage>
                  <span 
                    className="inline-flex items-center gap-1.5 text-primary font-semibold" 
                    title={tooltipText}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span className="truncate max-w-[120px] sm:max-w-[180px]">{title}</span>
                  </span>
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink
                  onClick={() => onSelect?.(n)}
                  icon={<Icon className="h-4 w-4 text-primary/70" aria-hidden="true" />}
                  className="hover:text-primary transition-colors"
                >
                  <span 
                    className="truncate max-w-[100px] sm:max-w-[160px]" 
                    title={tooltipText}
                  >
                    {title}
                  </span>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}


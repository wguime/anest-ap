/**
 * ReorderableList.jsx
 * Componente reutilizável para listas reordenáveis com drag & drop
 * Usa Framer Motion Reorder API
 */

import { Reorder } from 'framer-motion';
import { GripVertical } from 'lucide-react';
import { cn } from '@/design-system/utils/tokens';

/**
 * ReorderableList - Lista com drag & drop para reordenação
 * 
 * @param {Array} items - Lista de itens (devem ter uma propriedade 'id')
 * @param {function} onReorder - Callback quando a ordem muda, recebe nova lista de IDs
 * @param {function} renderItem - Função para renderizar cada item
 * @param {string} className - Classes adicionais para o container
 * @param {string} itemClassName - Classes adicionais para cada item
 */
export function ReorderableList({
  items,
  onReorder,
  renderItem,
  className,
  itemClassName,
  axis = 'y',
}) {
  // Handler de reordenação
  const handleReorder = (newItems) => {
    // Extrair IDs na nova ordem
    const newIds = newItems.map(item => item.id);
    onReorder?.(newIds);
  };

  return (
    <Reorder.Group
      axis={axis}
      values={items}
      onReorder={handleReorder}
      className={cn("space-y-2", className)}
    >
      {items.map((item) => (
        <ReorderableItem
          key={item.id}
          item={item}
          renderItem={renderItem}
          className={itemClassName}
        />
      ))}
    </Reorder.Group>
  );
}

/**
 * ReorderableItem - Item individual reordenável
 */
function ReorderableItem({ item, renderItem, className }) {
  return (
    <Reorder.Item
      value={item}
      className={cn(
        "flex items-center gap-3 bg-card rounded-lg border border-border p-3",
        "cursor-grab active:cursor-grabbing",
        "shadow-sm hover:shadow-md transition-shadow",
        className
      )}
      whileDrag={{
        scale: 1.02,
        boxShadow: "0 10px 20px rgba(0,0,0,0.1)",
        zIndex: 50,
      }}
    >
      {/* Handle de arrasto */}
      <div className="flex-shrink-0 text-muted-foreground">
        <GripVertical className="w-5 h-5" />
      </div>
      
      {/* Conteúdo do item */}
      <div className="flex-1 min-w-0">
        {renderItem(item)}
      </div>
    </Reorder.Item>
  );
}

/**
 * ReorderableTable - Variante para tabelas
 */
export function ReorderableTableBody({
  items,
  onReorder,
  renderRow,
  className,
}) {
  const handleReorder = (newItems) => {
    const newIds = newItems.map(item => item.id);
    onReorder?.(newIds);
  };

  return (
    <Reorder.Group
      as="tbody"
      axis="y"
      values={items}
      onReorder={handleReorder}
      className={className}
    >
      {items.map((item) => (
        <Reorder.Item
          as="tr"
          key={item.id}
          value={item}
          className="cursor-grab active:cursor-grabbing bg-card"
          whileDrag={{
            scale: 1.01,
            boxShadow: "0 5px 15px rgba(0,0,0,0.1)",
            backgroundColor: "var(--muted)",
          }}
        >
          {renderRow(item)}
        </Reorder.Item>
      ))}
    </Reorder.Group>
  );
}

export default ReorderableList;

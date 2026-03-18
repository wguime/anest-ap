// Checklist.jsx
// Lista de verificação interativa
// Ideal para: checklists cirúrgicos, tarefas, protocolos

import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import { cn } from "@/design-system/utils/tokens"

/**
 * Checklist - Lista de verificação interativa
 *
 * Features:
 * - Items com checkbox
 * - Agrupamento por categorias
 * - Progresso visual
 * - Reordenação (drag & drop)
 * - Validação obrigatória
 * - Estado persistente
 *
 * @example
 * <Checklist
 *   title="Checklist Cirúrgico"
 *   items={[
 *     { id: '1', label: 'Identificação do paciente', required: true },
 *     { id: '2', label: 'Verificar alergias' },
 *   ]}
 *   onComplete={(items) => console.log(items)}
 * />
 */

// Ícones SVG
const CheckIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <path d="M20 6L9 17l-5-5" />
  </svg>
)

const GripIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="9" cy="6" r="1.5" />
    <circle cx="15" cy="6" r="1.5" />
    <circle cx="9" cy="12" r="1.5" />
    <circle cx="15" cy="12" r="1.5" />
    <circle cx="9" cy="18" r="1.5" />
    <circle cx="15" cy="18" r="1.5" />
  </svg>
)

const AlertIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
  </svg>
)

const TrashIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6" />
  </svg>
)

const PlusIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 5v14M5 12h14" />
  </svg>
)

// Item individual do checklist
function ChecklistItem({
  item,
  checked,
  onChange,
  onDelete,
  showDelete = false,
  disabled = false,
  draggable = false
}) {
  const handleToggle = () => {
    if (!disabled) {
      onChange?.(!checked)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg transition-colors group",
        checked
          ? "bg-muted dark:bg-[#16A085]/20 border border-border dark:border-transparent"
          : "bg-[#FFFFFF] dark:bg-[#27272A] hover:bg-background dark:hover:bg-[#3F3F46] border border-border dark:border-transparent",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {/* Drag handle */}
      {draggable && (
        <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-muted-foreground">
          <GripIcon className="w-5 h-5" />
        </div>
      )}

      {/* Checkbox */}
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={handleToggle}
        disabled={disabled}
        className={cn(
          "flex-shrink-0 w-6 h-6 rounded-md border-2 transition-all",
          "flex items-center justify-center",
          checked
            ? "bg-[#16A085] border-[#16A085]"
            : "border-border dark:border-[#52525B] hover:border-[#16A085]",
          !disabled && "cursor-pointer"
        )}
      >
        <AnimatePresence>
          {checked && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <CheckIcon className="w-4 h-4 text-white" />
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <span className={cn(
          "text-sm transition-all",
          checked
            ? "text-[#16A085] line-through"
            : "text-foreground dark:text-white"
        )}>
          {item.label}
        </span>

        {item.description && (
          <p className="text-xs text-muted-foreground dark:text-muted-foreground mt-0.5">
            {item.description}
          </p>
        )}
      </div>

      {/* Required indicator */}
      {item.required && !checked && (
        <span className="text-xs text-red-500 font-medium">
          Obrigatório
        </span>
      )}

      {/* Delete button */}
      {showDelete && (
        <button
          type="button"
          onClick={() => onDelete?.(item.id)}
          className={cn(
            "p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity",
            "text-muted-foreground hover:text-red-500",
            "hover:bg-red-100 dark:hover:bg-red-900/20"
          )}
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      )}
    </motion.div>
  )
}

// Componente principal
function Checklist({
  title,
  description,
  items = [],
  defaultChecked = {},
  showProgress = true,
  showAddItem = false,
  showDeleteItem = false,
  draggable = false,
  validateOnComplete = true,
  className,
  onChange,
  onComplete,
  onItemsChange,
  ...props
}) {
  const [checkedItems, setCheckedItems] = useState(defaultChecked)
  const [localItems, setLocalItems] = useState(items)
  const [newItemLabel, setNewItemLabel] = useState('')

  // Calculate progress
  const progress = useMemo(() => {
    const total = localItems.length
    const checked = Object.values(checkedItems).filter(Boolean).length
    const required = localItems.filter(i => i.required).length
    const requiredChecked = localItems.filter(i => i.required && checkedItems[i.id]).length

    return {
      total,
      checked,
      percentage: total > 0 ? Math.round((checked / total) * 100) : 0,
      required,
      requiredChecked,
      allRequiredComplete: requiredChecked === required
    }
  }, [localItems, checkedItems])

  // Handle item toggle
  const handleItemChange = useCallback((itemId, checked) => {
    const newChecked = { ...checkedItems, [itemId]: checked }
    setCheckedItems(newChecked)
    onChange?.(newChecked)

    // Check if all required items are complete
    const allComplete = localItems.every(item => !item.required || newChecked[item.id])
    if (allComplete && validateOnComplete) {
      onComplete?.(newChecked)
    }
  }, [checkedItems, localItems, onChange, onComplete, validateOnComplete])

  // Handle add item
  const handleAddItem = useCallback(() => {
    if (!newItemLabel.trim()) return

    const newItem = {
      id: `custom-${Date.now()}`,
      label: newItemLabel.trim(),
      required: false
    }

    const newItems = [...localItems, newItem]
    setLocalItems(newItems)
    setNewItemLabel('')
    onItemsChange?.(newItems)
  }, [newItemLabel, localItems, onItemsChange])

  // Handle delete item
  const handleDeleteItem = useCallback((itemId) => {
    const newItems = localItems.filter(item => item.id !== itemId)
    setLocalItems(newItems)

    const newChecked = { ...checkedItems }
    delete newChecked[itemId]
    setCheckedItems(newChecked)

    onItemsChange?.(newItems)
    onChange?.(newChecked)
  }, [localItems, checkedItems, onItemsChange, onChange])

  // Handle reorder
  const handleReorder = useCallback((newOrder) => {
    setLocalItems(newOrder)
    onItemsChange?.(newOrder)
  }, [onItemsChange])

  // Handle complete all
  const handleCompleteAll = useCallback(() => {
    const newChecked = {}
    localItems.forEach(item => {
      newChecked[item.id] = true
    })
    setCheckedItems(newChecked)
    onChange?.(newChecked)
    onComplete?.(newChecked)
  }, [localItems, onChange, onComplete])

  // Handle reset
  const handleReset = useCallback(() => {
    setCheckedItems({})
    onChange?.({})
  }, [onChange])

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups = {}

    localItems.forEach(item => {
      const category = item.category || 'default'
      if (!groups[category]) {
        groups[category] = []
      }
      groups[category].push(item)
    })

    return groups
  }, [localItems])

  const hasCategories = Object.keys(groupedItems).length > 1 || !groupedItems.default

  return (
    <div
      className={cn(
        "bg-gradient-to-b from-[#FFFFFF] to-[#F0FFF4] dark:bg-[#18181B] dark:from-[#18181B] dark:to-[#18181B]",
        "rounded-2xl overflow-hidden",
        "border border-border dark:border-[#27272A]",
        "shadow-sm",
        className
      )}
      {...props}
    >
      {/* Header */}
      {(title || showProgress) && (
        <div className="p-4 border-b border-border dark:border-[#27272A] bg-muted dark:bg-transparent">
          <div className="flex items-center justify-between mb-2">
            {title && (
              <h2 className="text-lg font-semibold text-foreground dark:text-white">
                {title}
              </h2>
            )}

            {/* Quick actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-muted-foreground hover:text-foreground dark:hover:text-white"
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={handleCompleteAll}
                className="text-xs text-[#16A085] hover:text-[#138D75]"
              >
                Marcar todos
              </button>
            </div>
          </div>

          {description && (
            <p className="text-sm text-muted-foreground dark:text-muted-foreground mb-3">
              {description}
            </p>
          )}

          {/* Progress bar */}
          {showProgress && (
            <div>
              <div className="flex justify-between text-xs text-muted-foreground dark:text-muted-foreground mb-1">
                <span>{progress.checked} de {progress.total} concluídos</span>
                <span>{progress.percentage}%</span>
              </div>
              <div className="h-2 bg-[#A5D6A7] dark:bg-[#27272A] rounded-full overflow-hidden">
                <motion.div
                  className={cn(
                    "h-full rounded-full",
                    progress.percentage === 100
                      ? "bg-gradient-to-r from-[#16A085] to-[#27AE60]"
                      : "bg-[#16A085]"
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${progress.percentage}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              {/* Required warning */}
              {!progress.allRequiredComplete && progress.required > 0 && (
                <div className="flex items-center gap-1 mt-2 text-xs text-amber-600 dark:text-amber-400">
                  <AlertIcon className="w-4 h-4" />
                  <span>
                    {progress.required - progress.requiredChecked} item(ns) obrigatório(s) pendente(s)
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Items */}
      <div className="p-4 space-y-4">
        {hasCategories ? (
          // Grouped by category
          Object.entries(groupedItems).map(([category, categoryItems]) => (
            <div key={category}>
              {category !== 'default' && (
                <h3 className="text-sm font-medium text-foreground dark:text-muted-foreground mb-2 uppercase tracking-wide">
                  {category}
                </h3>
              )}

              <div className="space-y-2">
                {categoryItems.map(item => (
                  <ChecklistItem
                    key={item.id}
                    item={item}
                    checked={!!checkedItems[item.id]}
                    onChange={(checked) => handleItemChange(item.id, checked)}
                    onDelete={handleDeleteItem}
                    showDelete={showDeleteItem}
                    draggable={draggable}
                  />
                ))}
              </div>
            </div>
          ))
        ) : draggable ? (
          // Reorderable list
          <Reorder.Group
            values={localItems}
            onReorder={handleReorder}
            className="space-y-2"
          >
            {localItems.map(item => (
              <Reorder.Item key={item.id} value={item}>
                <ChecklistItem
                  item={item}
                  checked={!!checkedItems[item.id]}
                  onChange={(checked) => handleItemChange(item.id, checked)}
                  onDelete={handleDeleteItem}
                  showDelete={showDeleteItem}
                  draggable={true}
                />
              </Reorder.Item>
            ))}
          </Reorder.Group>
        ) : (
          // Simple list
          <div className="space-y-2">
            <AnimatePresence>
              {localItems.map(item => (
                <ChecklistItem
                  key={item.id}
                  item={item}
                  checked={!!checkedItems[item.id]}
                  onChange={(checked) => handleItemChange(item.id, checked)}
                  onDelete={handleDeleteItem}
                  showDelete={showDeleteItem}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Add new item */}
        {showAddItem && (
          <div className="flex items-center gap-2 pt-2 border-t border-border dark:border-[#27272A]">
            <input
              type="text"
              value={newItemLabel}
              onChange={(e) => setNewItemLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
              placeholder="Adicionar item..."
              className={cn(
                "flex-1 px-3 py-2 text-sm rounded-lg",
                "bg-background dark:bg-[#27272A]",
                "border border-transparent focus:border-[#16A085]",
                "text-foreground dark:text-white",
                "placeholder:text-muted-foreground",
                "outline-none transition-colors"
              )}
            />
            <button
              type="button"
              onClick={handleAddItem}
              disabled={!newItemLabel.trim()}
              className={cn(
                "p-2 rounded-lg transition-colors",
                "bg-[#16A085] text-white",
                "hover:bg-[#138D75]",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              <PlusIcon className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Complete button */}
      {progress.percentage === 100 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 border-t border-border dark:border-[#27272A] bg-muted dark:bg-[#16A085]/10"
        >
          <div className="flex items-center justify-center gap-2 text-[#16A085]">
            <CheckIcon className="w-5 h-5" />
            <span className="font-medium">Checklist completo!</span>
          </div>
        </motion.div>
      )}
    </div>
  )
}

// Simple inline checklist
function ChecklistInline({
  items = [],
  onChange,
  className,
  ...props
}) {
  const [checked, setChecked] = useState({})

  const handleChange = (id, isChecked) => {
    const newChecked = { ...checked, [id]: isChecked }
    setChecked(newChecked)
    onChange?.(newChecked)
  }

  return (
    <div className={cn("space-y-2", className)} {...props}>
      {items.map(item => (
        <label
          key={item.id}
          className="flex items-center gap-2 cursor-pointer group"
        >
          <input
            type="checkbox"
            checked={!!checked[item.id]}
            onChange={(e) => handleChange(item.id, e.target.checked)}
            className="sr-only"
          />
          <div className={cn(
            "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
            checked[item.id]
              ? "bg-[#16A085] border-[#16A085]"
              : "border-border dark:border-[#52525B] group-hover:border-[#16A085]"
          )}>
            {checked[item.id] && (
              <CheckIcon className="w-3 h-3 text-white" />
            )}
          </div>
          <span className={cn(
            "text-sm",
            checked[item.id]
              ? "text-primary line-through"
              : "text-foreground"
          )}>
            {item.label}
          </span>
        </label>
      ))}
    </div>
  )
}

export { Checklist, ChecklistInline, ChecklistItem }
export default Checklist

import * as React from "react"
import { Check, Loader2, AlertCircle, Circle } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

import { cn } from "@/design-system/utils/tokens"
import { prefersReducedMotion } from "@/design-system/utils/motion"

/**
 * AutoSaveIndicator — T1.5.11
 *
 * Estados visuais discretos para uso no header de modais de form que usam
 * useAutoSave. Sem barra de progresso, sem alarme — só sinal claro do estado.
 *
 * Props:
 *  - status: 'idle' | 'dirty' | 'saving' | 'saved' | 'error'
 *  - lastSavedAt: Date | null (mostrado como hora no estado 'saved')
 *  - error: string | null (mostrado no estado 'error')
 */
export function AutoSaveIndicator({ status, lastSavedAt, error, className }) {
  const reduced = prefersReducedMotion()

  const config = {
    idle: {
      icon: Circle,
      label: "Sem alterações",
      color: "text-muted-foreground",
      iconCls: "fill-muted",
    },
    dirty: {
      icon: Circle,
      label: "Alteração pendente",
      color: "text-muted-foreground",
      iconCls: "fill-warning",
    },
    saving: {
      icon: Loader2,
      label: "Salvando…",
      color: "text-muted-foreground",
      iconCls: "animate-spin",
    },
    saved: {
      icon: Check,
      label: formatSavedLabel(lastSavedAt),
      color: "text-success",
      iconCls: "",
    },
    error: {
      icon: AlertCircle,
      label: error || "Erro ao salvar",
      color: "text-destructive",
      iconCls: "",
    },
  }

  const c = config[status] || config.idle
  const Icon = c.icon

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status}
        initial={reduced ? false : { opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={reduced ? { duration: 0 } : { duration: 0.15 }}
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-medium",
          c.color,
          className
        )}
        aria-live="polite"
      >
        <Icon className={cn("w-3.5 h-3.5", c.iconCls)} aria-hidden="true" />
        <span>{c.label}</span>
      </motion.div>
    </AnimatePresence>
  )
}

function formatSavedLabel(date) {
  if (!date) return "Salvo"
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return "Salvo"
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  return `Salvo às ${hh}:${mm}`
}

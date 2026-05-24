import * as React from "react"
import { Check, Play, Lock, ChevronDown } from "lucide-react"
import { motion } from "framer-motion"

import { cn } from "@/design-system/utils/tokens"
import { prefersReducedMotion } from "@/design-system/utils/motion"
import { Button } from "@/design-system"

/**
 * LearningPath — T1.5.1 + T1.5.2
 *
 * Caminho visual estilo Duolingo: nódulos em zig-zag vertical agrupados por módulo.
 * Tailwind + Framer Motion (sem React Flow).
 *
 * Estados de nódulo:
 *  - done    : bg-success + Check
 *  - current : bg-info + animate-pulse + ring (aula liberada agora)
 *  - next    : bg-muted (próxima da fila)
 *  - locked  : opacidade reduzida + Lock (pré-requisito não atendido)
 *
 * Floating "Voltar para atual" (T1.5.2): IntersectionObserver detecta se o
 * nódulo `current` saiu do viewport; quando fora, mostra botão bottom-right.
 *
 * @param {Array} items
 *   [{ id, title, status: 'done'|'current'|'next'|'locked',
 *      moduleLabel?: string, moduleId?: string, durationMinutes?: number }]
 * @param {function} onSelect callback(item) ao clicar no nódulo
 */
export function LearningPath({ items = [], onSelect, className }) {
  const reduced = prefersReducedMotion()
  const currentRef = React.useRef(null)
  const [currentInView, setCurrentInView] = React.useState(true)

  // T1.5.2 — observa o nódulo current
  React.useEffect(() => {
    const node = currentRef.current
    if (!node || typeof IntersectionObserver === "undefined") return
    const obs = new IntersectionObserver(
      ([entry]) => setCurrentInView(entry.isIntersecting),
      { threshold: 0.5, rootMargin: "-80px 0px -120px 0px" }
    )
    obs.observe(node)
    return () => obs.disconnect()
  }, [items])

  const scrollToCurrent = () => {
    currentRef.current?.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "center",
    })
  }

  // Agrupa items consecutivos pelo moduleId
  const groups = React.useMemo(() => {
    const out = []
    let last = null
    for (const it of items) {
      const key = it.moduleId ?? it.moduleLabel ?? "default"
      if (!last || last.key !== key) {
        last = { key, label: it.moduleLabel, items: [] }
        out.push(last)
      }
      last.items.push(it)
    }
    return out
  }, [items])

  // Offsets em zig-zag (6 posições, baseadas no índice GLOBAL do item)
  const OFFSETS = ["ml-0", "ml-12", "ml-24", "ml-32", "ml-24", "ml-12"]
  let globalIdx = 0

  return (
    <div className={cn("relative", className)}>
      <div className="space-y-6">
        {groups.map((g, gi) => (
          <div key={`group-${gi}`} className="space-y-3">
            {g.label && (
              <div className="flex items-center gap-3 py-2">
                <span className="h-px flex-1 bg-category-teal-bg" aria-hidden="true" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-category-teal-fg px-2">
                  {g.label}
                </span>
                <span className="h-px flex-1 bg-category-teal-bg" aria-hidden="true" />
              </div>
            )}
            <ul role="list" className="space-y-4">
              {g.items.map((item) => {
                const offset = OFFSETS[globalIdx % OFFSETS.length]
                globalIdx++
                return (
                  <li key={item.id} className={cn("flex items-center", offset)}>
                    <Node
                      item={item}
                      onClick={() => item.status !== "locked" && onSelect?.(item)}
                      attachRef={item.status === "current" ? currentRef : null}
                      reduced={reduced}
                    />
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* T1.5.2 — Floating "Voltar para atual" */}
      {!currentInView && items.some((i) => i.status === "current") && (
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={reduced ? { duration: 0 } : { duration: 0.2 }}
          className="fixed right-4 bottom-24 z-30"
        >
          <Button
            type="button"
            onClick={scrollToCurrent}
            variant="default"
            className="shadow-lg"
            aria-label="Voltar para a aula atual"
          >
            <ChevronDown className="w-4 h-4 mr-1.5" aria-hidden="true" />
            Voltar para atual
          </Button>
        </motion.div>
      )}
    </div>
  )
}

function Node({ item, onClick, attachRef, reduced }) {
  const isLocked = item.status === "locked"
  const isDone = item.status === "done"
  const isCurrent = item.status === "current"

  const sizeBase = "w-14 h-14"
  const tokenBg = isDone
    ? "bg-primary text-primary-foreground"
    : isCurrent
      ? "bg-primary/80 text-primary-foreground ring-4 ring-primary/25"
      : isLocked
        ? "bg-muted/60 text-muted-foreground"
        : "bg-muted text-muted-foreground"

  const Icon = isDone ? Check : isLocked ? Lock : Play

  const labelId = `path-node-label-${item.id}`

  return (
    <div ref={attachRef} className="flex items-center gap-3">
      <motion.button
        type="button"
        onClick={onClick}
        disabled={isLocked}
        aria-labelledby={labelId}
        animate={
          isCurrent && !reduced
            ? { scale: [1, 1.06, 1] }
            : { scale: 1 }
        }
        transition={
          isCurrent && !reduced
            ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0 }
        }
        className={cn(
          "relative inline-flex items-center justify-center rounded-full shrink-0",
          sizeBase,
          tokenBg,
          "shadow-md transition-all min-h-[44px] min-w-[44px]",
          !isLocked && "hover:scale-105 active:scale-95 cursor-pointer",
          isLocked && "cursor-not-allowed",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        )}
      >
        <Icon className="w-6 h-6" aria-hidden="true" />
      </motion.button>
      <div id={labelId} className="min-w-0">
        <p
          className={cn(
            "text-sm truncate",
            isCurrent ? "font-semibold text-foreground" : "font-medium text-foreground",
            isLocked && "text-muted-foreground"
          )}
        >
          {item.title}
        </p>
        <p className="text-xs text-muted-foreground">
          {isDone && "Concluída"}
          {isCurrent && "Continue agora"}
          {item.status === "next" && (item.durationMinutes ? `${item.durationMinutes} min` : "Próxima")}
          {isLocked && "Bloqueada"}
        </p>
      </div>
    </div>
  )
}

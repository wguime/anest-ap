import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"

import { prefersReducedMotion } from "@/design-system/utils/motion"

/**
 * <AnimatedList> — entrada coreografada de itens em lista (Magic UI tokenizado, Fase 4.2).
 *
 * Uso: feed de comunicados, notificações. Cada child entra com spring snappy
 * (DNA 400/30) e stagger por índice. `layout` reposiciona suavemente em add/remove.
 *
 * Respeita `prefers-reduced-motion`: renderiza os children sem animação.
 *
 * @param {number} [stagger=0.08] - atraso entre itens (s)
 */
export function AnimatedList({ children, className, stagger = 0.08, ...props }) {
  const reduce = prefersReducedMotion()
  const items = React.useMemo(() => React.Children.toArray(children), [children])

  if (reduce) {
    return (
      <div className={className} {...props}>
        {children}
      </div>
    )
  }

  return (
    <div className={className} {...props}>
      <AnimatePresence initial>
        {items.map((item, i) => (
          <motion.div
            key={item.key ?? i}
            layout
            initial={{ scale: 0.96, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30, delay: i * stagger }}
          >
            {item}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

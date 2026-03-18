import * as React from "react"

import { motion } from "framer-motion"
import { ChevronRight } from "lucide-react"

import { cn } from "@/design-system/utils/tokens"

/**
 * @typedef {Object} ComunicadosCardProps
 * @property {string=} label
 * @property {string=} title
 * @property {string=} badgeText
 * @property {string[]} items
 * @property {() => void=} onViewAll
 * @property {string=} className
 */

/**
 * @param {ComunicadosCardProps & React.ComponentPropsWithoutRef<"div">} props
 */
function ComunicadosCard({
  label = "ÚLTIMOS",
  title = "Comunicados",
  badgeText,
  items = [],
  onViewAll,
  className,
  ...props
}) {
  const isClickable = typeof onViewAll === "function"

  const activate = React.useCallback(() => {
    onViewAll?.()
  }, [onViewAll])

  return (
    <motion.div
      data-slot="anest-comunicados-card"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      whileTap={{ scale: 0.99 }}
      onClick={activate}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (!isClickable) return
        if (e.key === "Enter") activate()
        if (e.key === " ") {
          e.preventDefault()
          activate()
        }
      }}
      className={cn(
        "rounded-[20px] p-4 md:p-5",
        "bg-muted dark:border dark:border-border",
        "shadow-[0_2px_12px_rgba(0,66,37,0.08)] dark:shadow-none",
        "select-none",
        isClickable
          ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          : null,
        className
      )}
      {...props}
    >
      <header
        data-slot="anest-comunicados-card-header"
        className="flex items-start justify-between gap-4"
      >
        <div data-slot="anest-comunicados-card-header-left" className="min-w-0">
          <div
            data-slot="anest-comunicados-card-label"
            className="text-[12px] font-medium uppercase tracking-[0.5px] text-primary"
          >
            {label}
          </div>
          <h2
            data-slot="anest-comunicados-card-title"
            className="mt-0.5 text-[18px] md:text-[20px] font-bold leading-tight text-foreground dark:text-[#FFFFFF]"
          >
            {title}
          </h2>
        </div>

        {badgeText ? (
          <span
            data-slot="anest-comunicados-card-badge"
            className={cn(
              "inline-flex shrink-0 items-center justify-center rounded-[10px] px-[10px] py-[5px] text-[11px] font-semibold leading-none",
              "bg-primary text-white",
              "dark:bg-[linear-gradient(135deg,#2ECC71_0%,#1E8449_100%)] dark:text-foreground dark:shadow-[0_2px_10px_rgba(46,204,113,0.15)]"
            )}
          >
            {badgeText}
          </span>
        ) : null}
      </header>

      <ul data-slot="anest-comunicados-card-list" className="mt-4 grid gap-2">
        {items.map((item, idx) => (
          <li
            key={`${idx}-${item}`}
            data-slot="anest-comunicados-card-item"
            className="flex items-start gap-[10px]"
          >
            <span
              data-slot="anest-comunicados-card-bullet"
              aria-hidden="true"
              className="mt-[7px] inline-block h-[6px] w-[6px] shrink-0 rounded-full bg-primary dark:shadow-[0_0_6px_#2ECC71]"
            />
            <span
              data-slot="anest-comunicados-card-text"
              className="text-[14px] font-medium text-foreground dark:text-muted-foreground"
            >
              {item}
            </span>
          </li>
        ))}
      </ul>

      <footer data-slot="anest-comunicados-card-footer" className="mt-4">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onViewAll?.()
          }}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary transition-opacity hover:opacity-90 dark:text-primary min-h-[44px] px-2 -ml-2"
        >
          <span>Ver todos</span>
          <ChevronRight aria-hidden="true" size={16} />
        </button>
      </footer>
    </motion.div>
  )
}

export { ComunicadosCard }



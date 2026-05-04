import * as React from "react"

import { motion } from "framer-motion"

import { cn } from "@/design-system/utils/tokens"

/**
 * @typedef {Object} UptodateCardProps
 * @property {string=} label
 * @property {string=} title
 * @property {string=} badgeText
 * @property {string[]} items
 * @property {() => void=} onViewAll
 * @property {string=} className
 */

/**
 * UptodateCard — clone visual de ComunicadosCard.
 * Usa as mesmas tokens DS (bg-accent / dark:bg-card, rounded-[20px], p-4 md:p-5)
 * e os mesmos slots de label + title + badge + lista de bullets.
 *
 * @param {UptodateCardProps & React.ComponentPropsWithoutRef<"div">} props
 */
function UptodateCard({
  label = "ATUALIZAÇÕES",
  title = "UpToDate",
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
      data-slot="anest-uptodate-card"
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
        "bg-accent dark:bg-card dark:border dark:border-border",
        "shadow-[0_2px_12px_rgba(0,66,37,0.08)] dark:shadow-none",
        "select-none",
        isClickable
          ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          : null,
        className,
      )}
      {...props}
    >
      <header
        data-slot="anest-uptodate-card-header"
        className="flex items-start justify-between gap-4"
      >
        <div data-slot="anest-uptodate-card-header-left" className="min-w-0">
          <div
            data-slot="anest-uptodate-card-label"
            className="text-[12px] font-medium uppercase tracking-[0.5px] text-primary"
          >
            {label}
          </div>
          <h2
            data-slot="anest-uptodate-card-title"
            className="mt-0.5 text-[18px] md:text-[20px] font-bold leading-tight text-foreground"
          >
            {title}
          </h2>
        </div>

        {badgeText ? (
          <span
            data-slot="anest-uptodate-card-badge"
            className={cn(
              "inline-flex shrink-0 items-center justify-center rounded-[10px] px-[10px] py-[5px] text-[11px] font-semibold leading-none",
              "bg-primary text-white",
              "dark:bg-[linear-gradient(135deg,#2ECC71_0%,#1E8449_100%)] dark:text-foreground dark:shadow-[0_2px_10px_rgba(46,204,113,0.15)]",
            )}
          >
            {badgeText}
          </span>
        ) : null}
      </header>

      {items.length > 0 ? (
        <ul data-slot="anest-uptodate-card-list" className="mt-4 grid gap-2">
          {items.map((item, idx) => (
            <li
              key={`${idx}-${item}`}
              data-slot="anest-uptodate-card-item"
              className="flex items-start gap-[10px]"
            >
              <span
                data-slot="anest-uptodate-card-bullet"
                aria-hidden="true"
                className="mt-[7px] inline-block h-[6px] w-[6px] shrink-0 rounded-full bg-primary dark:shadow-[0_0_6px_#2ECC71]"
              />
              <span
                data-slot="anest-uptodate-card-text"
                className="text-[14px] font-medium text-foreground dark:text-muted-foreground line-clamp-1"
              >
                {item}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </motion.div>
  )
}

export { UptodateCard }

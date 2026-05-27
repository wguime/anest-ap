import * as React from "react"

import { Megaphone } from "lucide-react"
import { motion } from "framer-motion"

import { cn } from "@/design-system/utils/tokens"
import { Badge } from "@/design-system/components/ui"

const TIPO_BADGE = {
  Urgente: { variant: "destructive", badgeStyle: "subtle" },
  Importante: { variant: "warning", badgeStyle: "subtle" },
  Informativo: { variant: "info", badgeStyle: "subtle" },
  Evento: { variant: "default", badgeStyle: "subtle" },
  Geral: { variant: "secondary", badgeStyle: "subtle" },
}

function ComunicadosCard({
  // New API (Comunicados-specific)
  comunicados = [],
  unreadCount = 0,
  totalCount = 0,
  onItemClick,
  // Legacy API (generic section card usage)
  label,
  title,
  badgeText,
  items,
  // Shared
  onViewAll,
  className,
  ...props
}) {
  const isLegacy = Array.isArray(items) && items.length > 0
  const isClickable = typeof onViewAll === "function"

  const activate = React.useCallback(() => {
    onViewAll?.()
  }, [onViewAll])

  // Legacy mode: bullet-list section card (used by EducacaoPage, GestaoPage, etc.)
  if (isLegacy) {
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
          "bg-accent dark:bg-card dark:border dark:border-border",
          "shadow-[0_2px_12px_rgba(0,66,37,0.08)] dark:shadow-none",
          "select-none",
          isClickable
            ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            : null,
          className
        )}
        {...props}
      >
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {label ? (
              <div className="text-[12px] font-medium uppercase tracking-[0.5px] text-primary">
                {label}
              </div>
            ) : null}
            <h2 className="mt-0.5 text-[18px] md:text-[20px] font-bold leading-tight text-foreground">
              {title}
            </h2>
          </div>
          {badgeText ? (
            <span
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
        <ul className="mt-4 grid gap-2">
          {items.map((item, idx) => (
            <li key={`${idx}-${item}`} className="flex items-start gap-[10px]">
              <span
                aria-hidden="true"
                className="mt-[7px] inline-block h-[6px] w-[6px] shrink-0 rounded-full bg-primary dark:shadow-[0_0_6px_#2ECC71]"
              />
              <span className="text-[14px] font-medium text-foreground dark:text-muted-foreground">
                {item}
              </span>
            </li>
          ))}
        </ul>
      </motion.div>
    )
  }

  // New mode: iOS Mail compact comunicados feed
  return (
    <motion.div
      data-slot="anest-comunicados-card"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn(
        "rounded-[20px] overflow-hidden",
        "bg-accent dark:bg-card dark:border dark:border-border",
        "shadow-[0_2px_12px_rgba(0,66,37,0.08)] dark:shadow-none",
        className
      )}
      {...props}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 md:px-5 md:pt-5">
        <h2 className="text-[18px] md:text-[20px] font-bold leading-tight text-foreground">
          Comunicados
        </h2>
        {isClickable ? (
          <button
            type="button"
            onClick={onViewAll}
            className={cn(
              "inline-flex shrink-0 items-center justify-center rounded-[10px] px-[10px] py-[5px] text-[11px] font-semibold leading-none",
              "bg-primary text-white",
              "dark:bg-[linear-gradient(135deg,#2ECC71_0%,#1E8449_100%)] dark:text-foreground dark:shadow-[0_2px_10px_rgba(46,204,113,0.15)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            )}
          >
            Ver todos
          </button>
        ) : null}
      </div>

      {/* Items */}
      {comunicados.length > 0 ? (
        <div>
          {comunicados.map((item, idx) => {
            const tipoCfg = TIPO_BADGE[item.tipo] || TIPO_BADGE.Geral
            const itemClickable = typeof onItemClick === "function"

            return (
              <React.Fragment key={item.id}>
                {idx > 0 ? (
                  <div className="mx-4 md:mx-5 border-t border-border/50" />
                ) : null}
                <div
                  role={itemClickable ? "button" : undefined}
                  tabIndex={itemClickable ? 0 : undefined}
                  onClick={itemClickable ? () => onItemClick(item) : undefined}
                  onKeyDown={
                    itemClickable
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            onItemClick(item)
                          }
                        }
                      : undefined
                  }
                  className={cn(
                    "relative px-4 py-3 md:px-5",
                    itemClickable &&
                      "cursor-pointer hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors focus-visible:outline-none focus-visible:bg-primary/5"
                  )}
                >
                  {item.isUnread ? (
                    <span
                      className="absolute left-1.5 top-[18px] h-2 w-2 rounded-full bg-primary dark:shadow-[0_0_6px_#2ECC71]"
                      aria-label="Não lido"
                    />
                  ) : null}

                  {/* Row 1: author + tipo badge + timestamp */}
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className={cn(
                        "text-[13px] truncate",
                        item.isUnread
                          ? "font-semibold text-foreground"
                          : "font-medium text-foreground/70 dark:text-muted-foreground"
                      )}
                    >
                      {item.autorNome}
                    </span>
                    <Badge {...tipoCfg} className="shrink-0 text-[10px] px-1.5 py-0.5">
                      {item.tipo}
                    </Badge>
                    <span className="ml-auto shrink-0 text-[12px] text-muted-foreground">
                      {item.timeAgo}
                    </span>
                  </div>

                  {/* Row 2: title */}
                  <p
                    className={cn(
                      "text-[14px] truncate",
                      item.isUnread
                        ? "font-semibold text-foreground"
                        : "font-medium text-foreground"
                    )}
                  >
                    {item.titulo}
                  </p>

                  {/* Row 3: preview */}
                  {item.conteudo ? (
                    <p className="text-[13px] text-muted-foreground truncate">
                      {item.conteudo}
                    </p>
                  ) : null}
                </div>
              </React.Fragment>
            )
          })}
        </div>
      ) : (
        /* Empty state */
        <div className="px-4 py-6 md:px-5 flex flex-col items-center text-center">
          <Megaphone className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-[14px] font-medium text-muted-foreground">
            Nenhum comunicado
          </p>
          <p className="text-[12px] text-muted-foreground/70">
            Você está em dia!
          </p>
        </div>
      )}

    </motion.div>
  )
}

export { ComunicadosCard }

import * as React from "react"
import { Palmtree, ChevronRight, Calendar } from "lucide-react"
import { motion } from "framer-motion"

import { cn } from "@/design-system/utils/tokens"
import { Badge } from "@/design-system/components/ui"
import { FeriasListItem } from "./ferias-list-item"

/**
 * FeriasCard - Card de férias e licenças
 *
 * Wrapper card que contém lista de férias/licenças com:
 * - Título e subtítulo
 * - Badge de contagem
 * - Lista de FeriasListItem
 * - Ação para ver todos
 *
 * @example
 * <FeriasCard
 *   title="Férias Programadas"
 *   subtitle="EQUIPE"
 *   items={[
 *     { nome: "Dr. Carlos Silva", tipo: "férias", inicio: "20/12", fim: "05/01" },
 *     { nome: "Dra. Ana Costa", tipo: "licença", inicio: "23/12", fim: "10/01" },
 *   ]}
 *   onViewAll={() => navigate('/ferias')}
 * />
 */
function FeriasCard({
  title = "Férias Programadas",
  subtitle = "EQUIPE",
  items = [],
  maxItems = 3,
  badgeText,
  showBadge = true,
  onViewAll,
  onItemClick,
  variant = "default",
  className,
  ...props
}) {
  const displayItems = items.slice(0, maxItems)
  const hasMore = items.length > maxItems
  const count = badgeText || items.length.toString()

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      data-slot="ferias-card"
      data-variant={variant}
      className={cn(
        "rounded-[20px] overflow-hidden",
        // Light mode
        variant === "highlight"
          ? "bg-accent border border-[#A5D6A7]"
          : "bg-card border border-[#A5D6A7]",
        // Dark mode
        variant === "highlight"
          ? "dark:bg-[#243530] dark:border-[#2A3F36]"
          : "dark:bg-[#1A2420] dark:border-[#2A3F36]",
        // Shadow
        "shadow-[0_2px_12px_rgba(0,66,37,0.06)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3)]",
        className
      )}
      {...props}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 sm:gap-4 p-4 sm:p-5 pb-0">
        <div className="flex-1 min-w-0">
          {subtitle ? (
            <span
              data-slot="ferias-card-subtitle"
              className="block text-[11px] sm:text-[12px] font-medium uppercase tracking-wide text-[#006837] dark:text-[#2ECC71] mb-1"
            >
              {subtitle}
            </span>
          ) : null}
          <h3
            data-slot="ferias-card-title"
            className="text-[16px] sm:text-[18px] font-bold text-black dark:text-white truncate"
          >
            {title}
          </h3>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {showBadge && count ? (
            <Badge variant="default" badgeStyle="subtle">
              {count}
            </Badge>
          ) : null}

          {onViewAll ? (
            <button
              type="button"
              onClick={onViewAll}
              className={cn(
                "inline-flex items-center gap-1 text-[12px] sm:text-[13px] font-semibold",
                "text-[#006837] dark:text-[#2ECC71]",
                "hover:opacity-80 transition-opacity",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "min-h-[44px] px-2"
              )}
            >
              <span>Ver todos</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-5 pb-4 sm:pb-5">
        {displayItems.length > 0 ? (
          <div className="mt-2">
            {displayItems.map((item, index) => {
              // Format periodo from inicio/fim or use periodo directly
              const periodo = item.periodo ||
                (item.inicio && item.fim ? `${item.inicio} - ${item.fim}` : "");

              return (
                <FeriasListItem
                  key={`${item.nome}-${index}`}
                  nome={item.nome}
                  periodo={periodo}
                  showDivider={index < displayItems.length - 1}
                  onClick={onItemClick ? () => onItemClick(item, index) : undefined}
                />
              )
            })}
          </div>
        ) : (
          <div
            data-slot="ferias-card-empty"
            className="py-8 text-center text-[14px] text-[#9CA3AF] dark:text-[#6B8178]"
          >
            <Palmtree className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>Nenhuma férias programada</p>
          </div>
        )}

        {hasMore && !onViewAll ? (
          <p
            data-slot="ferias-card-more"
            className="mt-3 text-center text-[13px] text-[#9CA3AF] dark:text-[#6B8178]"
          >
            +{items.length - maxItems} pessoas
          </p>
        ) : null}
      </div>
    </motion.div>
  )
}

export { FeriasCard }

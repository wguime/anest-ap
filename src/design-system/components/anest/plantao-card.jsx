import * as React from "react"
import { Calendar, ChevronRight, ChevronDown, ChevronUp } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

import { cn } from "@/design-system/utils/tokens"
import { Badge } from "@/design-system/components/ui"
import { PlantaoListItem } from "./plantao-list-item"

/**
 * PlantaoCard - Card de plantões
 *
 * Wrapper card que contém lista de plantões com:
 * - Título e subtítulo
 * - Badge de contagem
 * - Lista de PlantaoListItem
 * - Ação para ver todos
 * - Suporte a expansão para fins de semana (P1-P11)
 * - Suporte a separadores de período (Manhã/Tarde)
 *
 * @example
 * <PlantaoCard
 *   title="Plantões"
 *   subtitle="PRÓXIMOS"
 *   items={[
 *     { hospital: "Hospital Santa Casa", data: "Segunda, 16 Dez", hora: "07:00" },
 *     { hospital: "Hospital São Lucas", data: "Terça, 17 Dez", hora: "19:00" },
 *   ]}
 *   onViewAll={() => navigate('/plantoes')}
 *   onItemClick={(item) => handleItemClick(item)}
 * />
 *
 * // Com expansão para fins de semana
 * <PlantaoCard
 *   title="Plantões"
 *   subtitle="SÁBADO"
 *   expandable={true}
 *   expanded={expanded}
 *   onToggleExpand={() => setExpanded(!expanded)}
 *   itemsManha={[...]}
 *   itemsTarde={[...]}
 * />
 */
function PlantaoCard({
  title = "Plantões",
  subtitle = "PRÓXIMOS",
  items = [],
  // Itens separados por período (para fins de semana)
  itemsManha = [],
  itemsTarde = [],
  maxItems = 4,
  badgeText,
  showBadge = true,
  onViewAll,
  onItemClick,
  variant = "default",
  // Props de expansão
  expandable = false,
  expanded = false,
  onToggleExpand,
  className,
  ...props
}) {
  // Verificar se tem itens separados por período
  const hasPeriodos = itemsManha.length > 0 || itemsTarde.length > 0

  // Se tiver itens separados por período, combinar para contagem
  const allItems = hasPeriodos ? [...itemsManha, ...itemsTarde] : items

  // Determinar quais itens mostrar
  const displayItems = expandable
    ? (expanded ? allItems : allItems.slice(0, maxItems))
    : allItems.slice(0, maxItems)

  const hasMore = allItems.length > maxItems
  const count = badgeText || allItems.length.toString()

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      data-slot="plantao-card"
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
              data-slot="plantao-card-subtitle"
              className="block text-[11px] sm:text-[12px] font-medium uppercase tracking-wide text-[#006837] dark:text-[#2ECC71] mb-1"
            >
              {subtitle}
            </span>
          ) : null}
          <h3
            data-slot="plantao-card-title"
            className="text-[16px] sm:text-[18px] font-bold text-black dark:text-white truncate"
          >
            {title}
          </h3>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {showBadge && count ? (
            <Badge variant="success" badgeStyle="solid">
              {count}
            </Badge>
          ) : null}

          {/* Botão expandir/recolher para fins de semana */}
          {expandable && hasMore ? (
            <button
              type="button"
              onClick={onToggleExpand}
              className={cn(
                "inline-flex items-center gap-1 text-[12px] sm:text-[13px] font-semibold",
                "text-[#006837] dark:text-[#2ECC71]",
                "hover:opacity-80 transition-opacity",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "min-h-[44px] px-2"
              )}
              aria-label={expanded ? "Recolher" : "Ver todos"}
              aria-expanded={expanded}
            >
              <span>{expanded ? 'Recolher' : 'Ver todos'}</span>
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          ) : null}

          {/* Ver todos - navegação (quando não é expandable) */}
          {!expandable && onViewAll ? (
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
        <AnimatePresence mode="wait">
          {allItems.length > 0 ? (
            <motion.div
              key={expanded ? "expanded" : "collapsed"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-2"
            >
              {/* Se tem períodos (manhã e tarde), mostrar com separadores */}
              {hasPeriodos && itemsManha.length > 0 && itemsTarde.length > 0 ? (
                <>
                  {/* Período Manhã */}
                  {itemsManha.length > 0 ? (
                    <div className="mb-4">
                      <div
                        className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF] dark:text-[#6B8178] mb-2 px-1"
                      >
                        Manhã
                      </div>
                      {itemsManha.map((item, index) => (
                        <PlantaoListItem
                          key={`manha-${item.setor || item.hospital}-${index}`}
                          hospital={item.hospital}
                          data={item.data}
                          hora={item.hora}
                          status={item.status}
                          index={index}
                          bgColor={item.bgColor}
                          isLast={index === itemsManha.length - 1}
                          showDivider={index < itemsManha.length - 1}
                          onClick={onItemClick ? () => onItemClick(item, index) : undefined}
                        />
                      ))}
                    </div>
                  ) : null}

                  {/* Período Tarde/Noturno */}
                  {itemsTarde.length > 0 ? (
                    <div>
                      <div
                        className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF] dark:text-[#6B8178] mb-2 px-1"
                      >
                        Noturno
                      </div>
                      {itemsTarde.map((item, index) => (
                        <PlantaoListItem
                          key={`tarde-${item.setor || item.hospital}-${index}`}
                          hospital={item.hospital}
                          data={item.data}
                          hora={item.hora}
                          status={item.status}
                          index={index + itemsManha.length}
                          bgColor={item.bgColor}
                          isLast={index === itemsTarde.length - 1}
                          showDivider={index < itemsTarde.length - 1}
                          onClick={onItemClick ? () => onItemClick(item, index) : undefined}
                        />
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                /* Exibição normal (compacta ou sem períodos) */
                displayItems.map((item, index) => (
                  <PlantaoListItem
                    key={`${item.setor || item.hospital}-${item.data}-${index}`}
                    hospital={item.hospital}
                    data={item.data}
                    hora={item.hora}
                    status={item.status}
                    index={index}
                    bgColor={item.bgColor}
                    isLast={index === displayItems.length - 1}
                    showDivider={index < displayItems.length - 1}
                    onClick={onItemClick ? () => onItemClick(item, index) : undefined}
                  />
                ))
              )}
            </motion.div>
          ) : (
            <div
              data-slot="plantao-card-empty"
              className="py-8 text-center text-[14px] text-[#9CA3AF] dark:text-[#6B8178]"
            >
              <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Nenhum plantão agendado</p>
            </div>
          )}
        </AnimatePresence>

        {/* Indicador de itens restantes (quando não expandido e não tem onViewAll) */}
        {hasMore && !expanded && !onViewAll ? (
          <p
            data-slot="plantao-card-more"
            className="mt-3 text-center text-[13px] text-[#9CA3AF] dark:text-[#6B8178]"
          >
            +{allItems.length - maxItems} plantões
          </p>
        ) : null}

        {/* Botão de recolher quando expandido */}
        {expandable && expanded && hasMore ? (
          <button
            type="button"
            onClick={onToggleExpand}
            className="mt-3 w-full py-2 text-center text-[13px] font-medium text-[#006837] dark:text-[#2ECC71] hover:bg-[#E8F5E9] dark:hover:bg-[#243530] rounded-lg transition-colors"
          >
            Recolher lista
          </button>
        ) : null}
      </div>
    </motion.div>
  )
}

export { PlantaoCard }

import * as React from "react"
import { Check, Circle, Clock, AlertCircle, X } from "lucide-react"
import { motion } from "framer-motion"

import { cn } from "@/design-system/utils/tokens"

/**
 * Timeline - Componente de linha do tempo
 *
 * Features:
 * - Orientação vertical/horizontal
 * - Status por item (completed, active, pending, error)
 * - Ícones customizáveis
 * - Conectores animados
 * - Timestamps
 *
 * @example
 * <Timeline
 *   items={[
 *     { title: 'Pedido recebido', description: 'Seu pedido foi confirmado', status: 'completed', timestamp: '10:00' },
 *     { title: 'Em preparação', status: 'active' },
 *     { title: 'Enviado', status: 'pending' },
 *   ]}
 *   orientation="vertical"
 * />
 */

const statusConfig = {
  completed: {
    icon: Check,
    iconClass: "text-white",
    bgClass: "bg-[#34C759] dark:bg-[#2ECC71]",
    lineClass: "bg-[#34C759] dark:bg-[#2ECC71]",
  },
  active: {
    icon: Circle,
    iconClass: "text-white",
    bgClass: "bg-[#006837] dark:bg-[#2ECC71]",
    lineClass: "bg-[#D1D5DB] dark:bg-[#4B5563]",
    pulse: true,
  },
  pending: {
    icon: Clock,
    iconClass: "text-[#9CA3AF] dark:text-[#6B8178]",
    bgClass: "bg-[#F3F4F6] dark:bg-[#243530]",
    lineClass: "bg-[#E5E7EB] dark:bg-[#2A3F36]",
  },
  error: {
    icon: X,
    iconClass: "text-white",
    bgClass: "bg-[#DC2626] dark:bg-[#E74C3C]",
    lineClass: "bg-[#DC2626] dark:bg-[#E74C3C]",
  },
  warning: {
    icon: AlertCircle,
    iconClass: "text-white",
    bgClass: "bg-[#F59E0B] dark:bg-[#F39C12]",
    lineClass: "bg-[#F59E0B] dark:bg-[#F39C12]",
  },
}

function Timeline({
  items = [],
  orientation = "vertical",
  size = "default",
  animated = true,
  className,
  ...props
}) {
  const isHorizontal = orientation === "horizontal"

  const sizeConfig = {
    sm: {
      icon: "h-6 w-6",
      iconInner: "h-3 w-3",
      title: "text-[13px]",
      description: "text-[12px]",
      timestamp: "text-[11px]",
      gap: "gap-3",
      line: isHorizontal ? "h-0.5" : "w-0.5",
    },
    default: {
      icon: "h-8 w-8",
      iconInner: "h-4 w-4",
      title: "text-[14px]",
      description: "text-[13px]",
      timestamp: "text-[12px]",
      gap: "gap-4",
      line: isHorizontal ? "h-0.5" : "w-0.5",
    },
    lg: {
      icon: "h-10 w-10",
      iconInner: "h-5 w-5",
      title: "text-[15px]",
      description: "text-[14px]",
      timestamp: "text-[13px]",
      gap: "gap-5",
      line: isHorizontal ? "h-1" : "w-1",
    },
  }

  const sizes = sizeConfig[size] || sizeConfig.default

  return (
    <div
      data-slot="timeline"
      data-orientation={orientation}
      className={cn(
        "relative",
        isHorizontal
          ? "flex items-start overflow-x-auto pb-4"
          : "flex flex-col",
        className
      )}
      {...props}
    >
      {items.map((item, index) => {
        const status = item.status || "pending"
        const config = statusConfig[status] || statusConfig.pending
        const IconComponent = item.icon || config.icon
        const isLast = index === items.length - 1

        return (
          <div
            key={item.id || index}
            data-slot="timeline-item"
            data-status={status}
            className={cn(
              "relative flex",
              isHorizontal
                ? "flex-col items-center min-w-[120px]"
                : "items-start",
              sizes.gap
            )}
          >
            {/* Icon */}
            <motion.div
              initial={animated ? { scale: 0 } : false}
              animate={{ scale: 1 }}
              transition={{ delay: index * 0.1, type: "spring" }}
              data-slot="timeline-icon"
              className={cn(
                "relative z-10 flex shrink-0 items-center justify-center rounded-full",
                sizes.icon,
                config.bgClass,
                config.pulse && "animate-pulse"
              )}
            >
              <IconComponent
                className={cn(sizes.iconInner, config.iconClass)}
              />
            </motion.div>

            {/* Connector line */}
            {!isLast ? (
              <motion.div
                initial={animated ? { scaleY: 0, scaleX: 0 } : false}
                animate={{ scaleY: 1, scaleX: 1 }}
                transition={{ delay: index * 0.1 + 0.1, duration: 0.3 }}
                data-slot="timeline-connector"
                className={cn(
                  "absolute",
                  isHorizontal
                    ? cn(
                        "top-4 left-1/2 right-0 translate-x-1/2",
                        sizes.line,
                        "origin-left"
                      )
                    : cn(
                        "left-4 top-8 bottom-0 -translate-x-1/2",
                        sizes.line,
                        "origin-top"
                      ),
                  config.lineClass
                )}
                style={
                  isHorizontal
                    ? { width: "calc(100% - 16px)" }
                    : { height: "calc(100% - 16px)" }
                }
              />
            ) : null}

            {/* Content */}
            <motion.div
              initial={animated ? { opacity: 0, y: 10 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 + 0.05 }}
              data-slot="timeline-content"
              className={cn(
                "flex-1 min-w-0",
                isHorizontal ? "text-center mt-3" : "pb-8"
              )}
            >
              {/* Timestamp */}
              {item.timestamp ? (
                <span
                  data-slot="timeline-timestamp"
                  className={cn(
                    "block font-medium text-[#9CA3AF] dark:text-[#6B8178]",
                    sizes.timestamp,
                    isHorizontal ? "mb-1" : "mb-0.5"
                  )}
                >
                  {item.timestamp}
                </span>
              ) : null}

              {/* Title */}
              <h4
                data-slot="timeline-title"
                className={cn(
                  "font-semibold text-black dark:text-white",
                  sizes.title
                )}
              >
                {item.title}
              </h4>

              {/* Description */}
              {item.description ? (
                <p
                  data-slot="timeline-description"
                  className={cn(
                    "mt-1 text-[#6B7280] dark:text-[#A3B8B0]",
                    sizes.description,
                    isHorizontal && "max-w-[150px] mx-auto"
                  )}
                >
                  {item.description}
                </p>
              ) : null}

              {/* Custom content */}
              {item.content ? (
                <div className="mt-2">{item.content}</div>
              ) : null}
            </motion.div>
          </div>
        )
      })}
    </div>
  )
}

// Individual timeline item for more control
function TimelineItem({
  title,
  description,
  timestamp,
  status = "pending",
  icon,
  content,
  isLast = false,
  size = "default",
  orientation = "vertical",
  animated = true,
  index = 0,
  className,
  ...props
}) {
  const isHorizontal = orientation === "horizontal"
  const config = statusConfig[status] || statusConfig.pending
  const IconComponent = icon || config.icon

  const sizeConfig = {
    sm: { icon: "h-6 w-6", iconInner: "h-3 w-3", line: isHorizontal ? "h-0.5" : "w-0.5" },
    default: { icon: "h-8 w-8", iconInner: "h-4 w-4", line: isHorizontal ? "h-0.5" : "w-0.5" },
    lg: { icon: "h-10 w-10", iconInner: "h-5 w-5", line: isHorizontal ? "h-1" : "w-1" },
  }
  const sizes = sizeConfig[size] || sizeConfig.default

  return (
    <div
      data-slot="timeline-item"
      data-status={status}
      className={cn(
        "relative flex gap-4",
        isHorizontal ? "flex-col items-center min-w-[120px]" : "items-start",
        className
      )}
      {...props}
    >
      <motion.div
        initial={animated ? { scale: 0 } : false}
        animate={{ scale: 1 }}
        transition={{ delay: index * 0.1, type: "spring" }}
        className={cn(
          "relative z-10 flex shrink-0 items-center justify-center rounded-full",
          sizes.icon,
          config.bgClass,
          config.pulse && "animate-pulse"
        )}
      >
        <IconComponent className={cn(sizes.iconInner, config.iconClass)} />
      </motion.div>

      {!isLast ? (
        <div
          className={cn(
            "absolute",
            isHorizontal
              ? "top-4 left-1/2 right-0 translate-x-1/2"
              : "left-4 top-8 bottom-0 -translate-x-1/2",
            sizes.line,
            config.lineClass
          )}
          style={
            isHorizontal
              ? { width: "calc(100% - 16px)" }
              : { height: "calc(100% - 16px)" }
          }
        />
      ) : null}

      <motion.div
        initial={animated ? { opacity: 0, y: 10 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 + 0.05 }}
        className={cn("flex-1 min-w-0", isHorizontal ? "text-center mt-3" : "pb-8")}
      >
        {timestamp ? (
          <span className="block text-[12px] font-medium text-[#9CA3AF] dark:text-[#6B8178] mb-0.5">
            {timestamp}
          </span>
        ) : null}
        <h4 className="text-[14px] font-semibold text-black dark:text-white">
          {title}
        </h4>
        {description ? (
          <p className="mt-1 text-[13px] text-[#6B7280] dark:text-[#A3B8B0]">
            {description}
          </p>
        ) : null}
        {content ? <div className="mt-2">{content}</div> : null}
      </motion.div>
    </div>
  )
}

export { Timeline, TimelineItem }

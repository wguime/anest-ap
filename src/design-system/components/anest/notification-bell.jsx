import * as React from "react"
import { Bell } from "lucide-react"
import { motion } from "framer-motion"

import { cn } from "@/design-system/utils/tokens"

/**
 * NotificationBell - Componente de sino de notificações
 *
 * Baseado em:
 * - AnestHomeFinalPreview.jsx (Light Mode)
 * - AnestHomeDark.jsx (Dark Mode)
 *
 * LIGHT MODE:
 *   - Container: bg #FFFFFF, shadow, sem border
 *   - Ícone: #004225
 *   - Badge: bg #DC2626 (vermelho)
 *
 * DARK MODE:
 *   - Container: bg #1A2420, border #2A3F36, shadow escura
 *   - Ícone: #2ECC71
 *   - Badge: bg #E74C3C (vermelho)
 */

function NotificationBell({
  count = 0,
  hasUrgent = false,
  onClick,
  size = "default",
  className,
  ...props
}) {
  const hasCount = typeof count === "number" && count > 0

  const sizeClasses = {
    sm: "h-9 w-9",
    default: "h-[44px] w-[44px]",
    lg: "h-12 w-12",
  }

  const iconSizeClasses = {
    sm: "h-4 w-4",
    default: "h-5 w-5",
    lg: "h-6 w-6",
  }

  const badgeSizeClasses = {
    sm: "h-4 min-w-[16px] text-[10px]",
    default: "h-[18px] min-w-[18px] text-[11px]",
    lg: "h-5 min-w-[20px] text-xs",
  }

  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={hasCount ? `Notificações (${count})` : "Notificações"}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      data-slot="notification-bell"
      data-size={size}
      data-has-notifications={hasCount ? "true" : undefined}
      data-has-urgent={hasUrgent ? "true" : undefined}
      className={cn(
        "relative inline-flex items-center justify-center rounded-full",
        sizeClasses[size] || sizeClasses.default,
        // Light mode
        "bg-white shadow-[0_2px_8px_rgba(0,66,37,0.1)]",
        // Dark mode
        "dark:bg-[#1A2420] dark:border dark:border-[#2A3F36] dark:shadow-[0_4px_12px_rgba(0,0,0,0.3)]",
        // Focus & active
        "transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
      {...props}
    >
      <Bell
        className={cn(
          iconSizeClasses[size] || iconSizeClasses.default,
          "text-[#004225] dark:text-[#2ECC71]"
        )}
        aria-hidden="true"
      />

      {hasCount ? (
        <motion.span
          key={count}
          initial={{ scale: 0.5 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 25 }}
          data-slot="notification-bell-badge"
          className={cn(
            "absolute -right-1 -top-1 inline-flex items-center justify-center rounded-full px-1 font-bold",
            badgeSizeClasses[size] || badgeSizeClasses.default,
            hasUrgent
              ? "bg-[#DC2626] text-white dark:bg-[#E74C3C] animate-pulse"
              : "bg-[#DC2626] text-white dark:bg-[#E74C3C]"
          )}
        >
          {count > 99 ? "99+" : count}
        </motion.span>
      ) : null}
    </motion.button>
  )
}

export { NotificationBell }

import * as React from "react"

import { motion } from "framer-motion"
import { Home, Shield, FileText, Menu, Calculator, GraduationCap, BarChart3, LayoutDashboard } from "lucide-react"

import { cn } from "@/design-system/utils/tokens"

const ICONS = {
  Home,
  Shield,
  FileText,
  Menu,
  Calculator,
  GraduationCap,
  BarChart3,
  LayoutDashboard,
}

function BottomNav({ items = [], onItemClick, className, ...props }) {
  return (
    <nav
      data-slot="anest-bottom-nav"
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 w-full",
        "pt-2.5 px-2 sm:px-6 pb-[max(0.625rem,env(safe-area-inset-bottom,0.625rem))]",
        // Liquid Glass (iOS 26 inspired)
        "bg-white/60 dark:bg-[#111916]/60",
        "backdrop-blur-[24px] backdrop-saturate-[180%]",
        "border-t border-white/20 dark:border-white/10",
        "shadow-[0_-8px_32px_rgba(0,66,37,0.08),inset_0_1px_0_rgba(255,255,255,0.25)] dark:shadow-[0_-8px_32px_rgba(0,0,0,0.35),inset_0_0.5px_0_rgba(255,255,255,0.08)]",
        "safe-area-inset-bottom",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {items.map((item, index) => {
          const isActive = Boolean(item.active)
          const iconName = typeof item.icon === "string" ? item.icon : null
          const activeIconName =
            typeof item.activeIcon === "string" ? item.activeIcon : iconName

          const Icon =
            (activeIconName && ICONS[activeIconName]) ||
            (iconName && ICONS[iconName]) ||
            null

          const key = `${item.href ?? "item"}-${iconName ?? "custom"}-${index}`
          const label = iconName ?? "Navigation"

          const commonClassName = cn(
            "relative flex items-center justify-center min-w-[44px] min-h-[40px] p-1.5 rounded-xl",
            "select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "transition-all duration-200 ease-in-out",
            "active:bg-[#006837]/10 dark:active:bg-[#2ECC71]/10",
            isActive
              ? "text-[#006837] dark:text-[#2ECC71]"
              : "text-[#6B7280] dark:text-[#6B8178]"
          )

          // GraduationCap tem design visualmente menor, aplica scale para compensar
          const isGraduationCap = iconName === "GraduationCap"
          const iconSizeClass = isGraduationCap
            ? "w-[26px] h-[26px]"
            : "w-6 h-6"
          const iconSize = isGraduationCap ? 26 : 24

          const content = (
            <>
              {isActive && (
                <motion.div
                  layoutId="active-nav-indicator"
                  className="absolute inset-0 rounded-xl bg-[#006837]/10 dark:bg-[#2ECC71]/10 ring-1 ring-inset ring-white/[0.12] dark:ring-white/[0.06]"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span
                aria-hidden="true"
                className="relative z-10 inline-flex"
              >
              {Icon ? (
                <Icon
                  width={iconSize}
                  height={iconSize}
                  className={iconSizeClass}
                  stroke="currentColor"
                  fill={isActive ? "currentColor" : "none"}
                />
              ) : (
                typeof item.icon === 'object' && React.isValidElement(item.icon)
                  ? React.cloneElement(item.icon, {
                      className: cn(
                        "w-6 h-6",
                        item.icon.props?.className
                      ),
                      fill: item.active ? "currentColor" : "none"
                    })
                  : item.icon
              )}
            </span>
            </>
          )

          if (item.href) {
            return (
              <motion.a
                key={key}
                href={item.href}
                onClick={(e) => {
                  if (typeof onItemClick === "function") {
                    e.preventDefault()
                    onItemClick(item)
                  }
                }}
                whileTap={{ scale: 0.85 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                className={commonClassName}
                aria-label={label}
                aria-current={isActive ? "page" : undefined}
              >
                {content}
              </motion.a>
            )
          }

          return (
            <motion.button
              key={key}
              type="button"
              onClick={() => {
                if (typeof onItemClick === "function") onItemClick(item)
              }}
              whileTap={{ scale: 0.85 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              className={commonClassName}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
            >
              {content}
            </motion.button>
          )
        })}
      </div>
    </nav>
  )
}

export { BottomNav }



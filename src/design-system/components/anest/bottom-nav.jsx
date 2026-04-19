import * as React from "react"

import { motion, useReducedMotion } from "framer-motion"
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

// Rótulos pt-BR por ícone — leitores de tela anunciam isso.
// Fallback se item.label não for fornecido explicitamente.
const DEFAULT_LABELS = {
  Home: "Início",
  Shield: "Gestão",
  FileText: "Documentos",
  Menu: "Menu",
  Calculator: "Calculadoras",
  GraduationCap: "Educação",
  BarChart3: "Dashboard",
  LayoutDashboard: "Dashboard",
}

function BottomNav({ items = [], onItemClick, className, ...props }) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <nav
      data-slot="anest-bottom-nav"
      aria-label="Navegação principal"
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 w-full",
        "pt-2.5 px-2 sm:px-6 pb-[max(0.625rem,env(safe-area-inset-bottom,0.625rem))]",
        // Liquid Glass (iOS 26 inspired)
        "bottom-nav-glass",
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
          // Labels em pt-BR: prioriza item.label (custom), fallback para DEFAULT_LABELS por ícone
          const label = item.label || (iconName && DEFAULT_LABELS[iconName]) || "Navegação"

          // Badge de notificações não-lidas (opcional). Número ou boolean (dot).
          const badgeValue = item.badge
          const hasBadge = badgeValue !== undefined && badgeValue !== null && badgeValue !== false && badgeValue !== 0
          const badgeCount = typeof badgeValue === "number" ? badgeValue : null
          const badgeDisplay = badgeCount !== null && badgeCount > 99 ? "99+" : badgeCount

          const commonClassName = cn(
            // Touch target 44x44 (WCAG 2.5.8 + regra ANEST)
            "relative flex items-center justify-center min-w-[44px] min-h-[44px] p-1.5 rounded-xl",
            "select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "transition-all duration-200 ease-in-out",
            "active:bg-primary/10 dark:active:bg-[#2ECC71]/10",
            isActive
              ? "text-primary"
              : "text-muted-foreground"
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
                  className="absolute inset-0 rounded-xl bg-primary/10 dark:bg-primary/10 ring-1 ring-inset ring-white/[0.12] dark:ring-white/[0.06]"
                  transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 30 }}
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
              {hasBadge && (
                <span
                  className={cn(
                    "absolute top-0.5 right-0.5 z-20 flex items-center justify-center",
                    "rounded-full bg-destructive text-destructive-foreground font-semibold",
                    badgeCount !== null
                      ? "min-w-[18px] h-[18px] px-1 text-[10px]"
                      : "w-2.5 h-2.5"
                  )}
                  aria-hidden="true"
                >
                  {badgeDisplay}
                </span>
              )}
              {hasBadge && (
                <span className="sr-only">
                  {badgeCount !== null
                    ? `${badgeCount} ${badgeCount === 1 ? "notificação não lida" : "notificações não lidas"}`
                    : "Há notificações não lidas"}
                </span>
              )}
            </>
          )

          const tapAnimation = shouldReduceMotion ? undefined : { scale: 0.85 }
          const tapTransition = shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 17 }

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
                whileTap={tapAnimation}
                transition={tapTransition}
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
              whileTap={tapAnimation}
              transition={tapTransition}
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

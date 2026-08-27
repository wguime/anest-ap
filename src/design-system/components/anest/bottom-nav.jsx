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
        // Celular DEITADO: a mesma barra vira faixa LATERAL (dono 26/08). Altura
        // é o que falta na horizontal — 72px embaixo custam 18% da tela —, e
        // largura é o que sobra. Não é componente novo: mesmos itens, mesmos
        // ícones, mesmos rótulos, mesma pintura; muda o eixo.
        "deitado:top-0 deitado:right-auto deitado:w-[76px] deitado:h-full",
        "deitado:pt-[max(0.625rem,env(safe-area-inset-top,0.625rem))] deitado:px-1",
        "deitado:pb-[max(0.625rem,env(safe-area-inset-bottom,0.625rem))]",
        "deitado:pl-[max(0.25rem,env(safe-area-inset-left,0.25rem))]",
        // Liquid Glass (iOS 26 inspired). O blur mora no CSS (`.bottom-nav-glass`,
        // anest-theme.css) e NÃO em utilitário Tailwind: no iOS o backdrop-filter
        // num elemento `position: fixed` faz a barra parecer escorregar com a
        // página, e lá o blur é desligado por @supports — utilitário Tailwind
        // vem depois no cascade e venceria o desligamento.
        "bottom-nav-glass",
        // border-border é o token de separador p/ navbars; a borda branca + o
        // realce inset branco liam como um filete claro sobre o fundo verde.
        "border-t border-border deitado:border-t-0 deitado:border-r",
        "shadow-[0_-8px_32px_rgba(0,66,37,0.08)] dark:shadow-[0_-8px_32px_rgba(0,0,0,0.35)]",
        "deitado:shadow-[8px_0_32px_rgba(0,66,37,0.08)] dark:deitado:shadow-[8px_0_32px_rgba(0,0,0,0.35)]",
        className
      )}
      {...props}
    >
      <div className={cn(
        "flex items-center justify-around max-w-lg mx-auto",
        // deitado: mesma fileira, outro eixo. `justify-around` é o MESMO
        // espaçamento do modo em pé — os quatro itens ficam simétricos entre si
        // e em relação às bordas (dono 26/08: "os ícones ficam amontoados no
        // topo"). Sem o teto de largura, que na vertical viraria teto de altura.
        "deitado:flex-col deitado:justify-around deitado:max-w-none deitado:h-full"
      )}>
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

          const commonClassName = cn(
            // Touch target 44x44 (WCAG 2.5.8 + regra ANEST)
            "relative flex items-center justify-center min-w-[44px] min-h-[44px] p-1.5 rounded-xl",
            "select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "transition-all duration-200 ease-in-out",
            "active:bg-primary/10 dark:active:bg-primary/10",
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

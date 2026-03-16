import * as React from "react"
import { motion } from "framer-motion"
import { ArrowLeft, ChevronLeft } from "lucide-react"
import { cn } from "@/design-system/utils/tokens"

/**
 * BackButton - Botão de navegação para retornar à tela anterior
 *
 * Migrado do legado: app.js goBack() + estilos .btn-back
 *
 * @example
 * // Icon only (padrão)
 * <BackButton onClick={() => navigate(-1)} />
 *
 * // Com texto
 * <BackButton onClick={handleBack} showLabel>Voltar</BackButton>
 *
 * // Variante chevron
 * <BackButton variant="chevron" onClick={handleBack} />
 */

const backButtonVariants = {
  arrow: ArrowLeft,
  chevron: ChevronLeft,
}

const sizeConfig = {
  sm: {
    button: "h-9 min-h-[36px] w-9 min-w-[36px]",
    buttonWithLabel: "h-9 min-h-[36px] px-3",
    icon: "h-4 w-4",
    text: "text-sm",
  },
  default: {
    button: "h-11 min-h-[44px] w-11 min-w-[44px]",
    buttonWithLabel: "h-11 min-h-[44px] px-4",
    icon: "h-5 w-5",
    text: "text-base",
  },
  lg: {
    button: "h-12 min-h-[48px] w-12 min-w-[48px]",
    buttonWithLabel: "h-12 min-h-[48px] px-5",
    icon: "h-6 w-6",
    text: "text-lg",
  },
}

function BackButton({
  variant = "arrow",
  size = "default",
  showLabel = false,
  className,
  children,
  onClick,
  disabled = false,
  ...props
}) {
  const IconComponent = backButtonVariants[variant] || ArrowLeft
  const config = sizeConfig[size] || sizeConfig.default

  const label = children || "Voltar"

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className={cn(
        // Base styles
        "inline-flex items-center justify-center gap-2 rounded-xl",
        "font-medium transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",

        // Light mode
        "bg-[#E8F5E9] text-[#004225] hover:bg-[#C8E6C9]",

        // Dark mode
        "dark:bg-[#1A2420] dark:text-[#2ECC71] dark:hover:bg-[#243530]",

        // Size
        showLabel ? config.buttonWithLabel : config.button,

        className
      )}
      aria-label={!showLabel ? label : undefined}
      {...props}
    >
      <IconComponent className={cn(config.icon, "shrink-0")} />
      {showLabel && (
        <span className={cn(config.text, "font-medium")}>{label}</span>
      )}
    </motion.button>
  )
}

export { BackButton }
export default BackButton

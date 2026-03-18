// ANEST Design System - Checkbox Component
// Checkbox customizado com suporte a light/dark mode e animações

import * as React from "react"
import { Check } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/design-system/utils/tokens"

// ============================================================================
// SIZE VARIANTS
// ============================================================================

const SIZES = {
  sm: {
    box: 16,
    iconSize: 12,
    labelSize: "14px",
    descSize: "12px",
  },
  md: {
    box: 20,
    iconSize: 14,
    labelSize: "15px",
    descSize: "13px",
  },
  lg: {
    box: 24,
    iconSize: 18,
    labelSize: "16px",
    descSize: "14px",
  },
}

// ============================================================================
// CHECKBOX COMPONENT
// ============================================================================

const Checkbox = React.forwardRef(
  (
    {
      checked = false,
      onChange,
      label,
      description,
      disabled = false,
      error,
      size = "md",
      compact = false,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const autoId = React.useId()
    const checkboxId = id ?? autoId
    const errorId = error ? `${checkboxId}-error` : undefined
    const descId = description ? `${checkboxId}-desc` : undefined

    const sizeStyles = SIZES[size] || SIZES.md
    const hasError = typeof error === "string" && error.trim().length > 0

    const handleChange = () => {
      if (!disabled) {
        onChange?.(!checked)
      }
    }

    const handleKeyDown = (e) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault()
        handleChange()
      }
    }

    return (
      <div data-slot="checkbox-field" className={cn("grid gap-1", className)}>
        <label
          htmlFor={checkboxId}
          className={cn(
            // Touch target mínimo + área clicável confortável
            "inline-flex min-h-[44px] items-start gap-3 cursor-pointer select-none py-2",
            compact && "min-h-0 py-0 items-center",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {/* Hidden native checkbox for accessibility */}
          <input
            ref={ref}
            type="checkbox"
            id={checkboxId}
            checked={checked}
            onChange={handleChange}
            disabled={disabled}
            aria-invalid={hasError ? true : undefined}
            aria-describedby={
              [descId, errorId].filter(Boolean).join(" ") || undefined
            }
            className="sr-only peer"
            {...props}
          />

          {/* Custom checkbox box */}
          <span
            role="presentation"
            tabIndex={-1}
            onKeyDown={handleKeyDown}
            className={cn(
              "shrink-0 inline-flex items-center justify-center rounded-[6px]",
              "border-2 transition-all duration-200",
              // Unchecked state
              !checked && "bg-transparent",
              !checked &&
                !hasError &&
                "border-border",
              // Checked state
              checked && "bg-primary border-transparent",
              // Error state
              hasError && !checked && "border-destructive dark:border-destructive",
              // Focus ring (applied via peer)
              "peer-focus:ring-2 peer-focus:ring-offset-2",
              "peer-focus:ring-primary/30 dark:peer-focus:ring-primary/30",
              "peer-focus:ring-offset-white dark:peer-focus:ring-offset-[#1A2420]",
              // Hover
              !disabled &&
                !checked &&
                "hover:border-primary dark:hover:border-primary"
            )}
            style={{
              width: sizeStyles.box,
              height: sizeStyles.box,
            }}
          >
            <AnimatePresence>
              {checked && (
                <motion.span
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 30,
                  }}
                  className="text-white dark:text-foreground"
                >
                  <Check size={sizeStyles.iconSize} strokeWidth={3} />
                </motion.span>
              )}
            </AnimatePresence>
          </span>

          {/* Label and description */}
          {(label || description) && (
            <span className={cn("flex flex-col pt-0.5", compact && "pt-0")}>
              {label && (
                <span
                  className={cn(
                    "font-medium text-black dark:text-white",
                    "leading-tight"
                  )}
                  style={{ fontSize: sizeStyles.labelSize }}
                >
                  {label}
                </span>
              )}
              {description && (
                <span
                  id={descId}
                  className="text-muted-foreground mt-0.5"
                  style={{ fontSize: sizeStyles.descSize }}
                >
                  {description}
                </span>
              )}
            </span>
          )}
        </label>

        {/* Error Message */}
        {hasError && (
          <p
            id={errorId}
            data-slot="checkbox-error"
            className="text-sm text-destructive ml-[calc(var(--box-size)+12px)]"
            style={{ "--box-size": `${sizeStyles.box}px` }}
          >
            {error}
          </p>
        )}
      </div>
    )
  }
)

Checkbox.displayName = "Checkbox"

export { Checkbox }


// ANEST Design System - Switch (Toggle) Component
// Toggle switch customizado com suporte a light/dark mode e animações

import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/design-system/utils/tokens"

// ============================================================================
// SIZE VARIANTS
// ============================================================================

const SIZES = {
  sm: {
    track: { width: 36, height: 20 },
    thumb: { size: 14 },
    padding: 3,
    labelSize: "14px",
    descSize: "12px",
  },
  md: {
    track: { width: 44, height: 24 },
    thumb: { size: 18 },
    padding: 3,
    labelSize: "15px",
    descSize: "13px",
  },
  lg: {
    track: { width: 52, height: 28 },
    thumb: { size: 22 },
    padding: 3,
    labelSize: "16px",
    descSize: "14px",
  },
}

// ============================================================================
// SWITCH COMPONENT
// ============================================================================

const Switch = React.forwardRef(
  (
    {
      checked = false,
      onChange,
      label,
      description,
      disabled = false,
      size = "md",
      className,
      id,
      ...props
    },
    ref
  ) => {
    const autoId = React.useId()
    const switchId = id ?? autoId
    const descId = description ? `${switchId}-desc` : undefined

    const sizeStyles = SIZES[size] || SIZES.md
    const { track, thumb, padding } = sizeStyles

    // Calculate thumb travel distance
    const thumbTravel = track.width - thumb.size - padding * 2

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
      <div data-slot="switch-field" className={cn("inline-flex", className)}>
        <label
          htmlFor={switchId}
          className={cn(
            // Touch target mínimo + área clicável confortável
            "inline-flex min-h-[44px] items-center gap-3 cursor-pointer select-none py-2",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {/* Hidden native checkbox for accessibility */}
          <input
            ref={ref}
            type="checkbox"
            role="switch"
            id={switchId}
            checked={checked}
            onChange={handleChange}
            disabled={disabled}
            aria-checked={checked}
            aria-describedby={descId}
            className="sr-only peer"
            {...props}
          />

          {/* Switch Track */}
          <span
            role="presentation"
            tabIndex={-1}
            onKeyDown={handleKeyDown}
            className={cn(
              "relative shrink-0 rounded-full transition-colors duration-200",
              "inline-flex items-center",
              // Track colors
              checked
                ? "bg-primary"
                : "bg-[#D1D5DB] dark:bg-muted",
              // Focus ring
              "peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2",
              "peer-focus-visible:ring-primary/50 dark:peer-focus-visible:ring-primary/50",
              "peer-focus-visible:ring-offset-white dark:peer-focus-visible:ring-offset-[#1A2420]"
            )}
            style={{
              width: track.width,
              height: track.height,
            }}
          >
            {/* Thumb */}
            <motion.span
              initial={false}
              animate={{
                x: checked ? thumbTravel : 0,
              }}
              transition={{
                type: "spring",
                stiffness: 500,
                damping: 30,
              }}
              className={cn(
                "rounded-full bg-white",
                "shadow-sm shadow-black/20"
              )}
              style={{
                width: thumb.size,
                height: thumb.size,
                marginLeft: padding,
              }}
            />
          </span>

          {/* Label and description */}
          {(label || description) && (
            <span className="flex flex-col">
              {label && (
                <span
                  className="font-medium text-black dark:text-white leading-tight"
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
      </div>
    )
  }
)

Switch.displayName = "Switch"

export { Switch }

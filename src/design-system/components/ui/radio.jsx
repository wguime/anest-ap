// ANEST Design System - Radio Group Component
// Radio buttons customizados com suporte a light/dark mode

import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/design-system/utils/tokens"

// ============================================================================
// RADIO ITEM (Internal Component)
// ============================================================================

const RadioItem = React.forwardRef(
  (
    {
      value,
      label,
      description,
      checked = false,
      onChange,
      disabled = false,
      name,
      className,
      ...props
    },
    ref
  ) => {
    const autoId = React.useId()
    const radioId = `${autoId}-${value}`
    const descId = description ? `${radioId}-desc` : undefined

    const handleClick = (e) => {
      // Previne comportamento padrão e propaga o onChange
      if (!disabled) {
        onChange?.()
      }
    }

    const handleInputChange = (e) => {
      // Handler para o input nativo
      if (!disabled) {
        onChange?.()
      }
    }

    return (
      <label
        htmlFor={radioId}
        onClick={handleClick}
        className={cn(
          // Touch target mínimo + área clicável confortável
          "inline-flex min-h-[44px] items-start gap-3 cursor-pointer select-none py-2",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none",
          className
        )}
      >
        {/* Hidden native radio for accessibility */}
        <input
          ref={ref}
          type="radio"
          id={radioId}
          name={name}
          value={value}
          checked={checked}
          onChange={handleInputChange}
          disabled={disabled}
          aria-describedby={descId}
          className="sr-only peer"
          {...props}
        />

        {/* Custom radio circle */}
        <span
          role="radio"
          aria-checked={checked}
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(e) => {
            if ((e.key === " " || e.key === "Enter") && !disabled) {
              e.preventDefault()
              onChange?.()
            }
          }}
          className={cn(
            "shrink-0 inline-flex items-center justify-center",
            "w-6 h-6 rounded-full border-2 transition-all duration-200",
            "mt-0.5", // Alinha melhor com o texto
            // Unchecked state
            !checked && "bg-transparent border-border",
            // Checked state
            checked && "border-primary",
            // Focus ring via peer
            "peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2",
            "peer-focus-visible:ring-primary/30 dark:peer-focus-visible:ring-primary/30",
            "peer-focus-visible:ring-offset-white dark:peer-focus-visible:ring-offset-[#1A2420]",
            // Hover
            !disabled && !checked && "hover:border-primary dark:hover:border-primary",
            // Focus próprio quando navegando por teclado
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
            "focus-visible:ring-primary/30 dark:focus-visible:ring-primary/30"
          )}
        >
          {/* Inner dot */}
          <motion.span
            initial={false}
            animate={{
              scale: checked ? 1 : 0,
              opacity: checked ? 1 : 0,
            }}
            transition={{
              type: "spring",
              stiffness: 500,
              damping: 30,
            }}
            className={cn(
              "w-3 h-3 rounded-full",
              "bg-primary"
            )}
          />
        </span>

        {/* Label and description */}
        {(label || description) && (
          <span className="flex flex-col">
            {label && (
              <span
                className={cn(
                  "font-medium text-[15px] text-black dark:text-white",
                  "leading-normal"
                )}
              >
                {label}
              </span>
            )}
            {description && (
              <span
                id={descId}
                className="text-[13px] text-muted-foreground mt-0.5"
              >
                {description}
              </span>
            )}
          </span>
        )}
      </label>
    )
  }
)

RadioItem.displayName = "RadioItem"

// ============================================================================
// RADIO GROUP
// ============================================================================

const RadioGroup = React.forwardRef(
  (
    {
      options = [],
      value,
      onChange,
      name,
      label,
      error,
      orientation = "vertical",
      className,
      ...props
    },
    ref
  ) => {
    const autoId = React.useId()
    const groupName = name ?? autoId
    const labelId = label ? `${groupName}-label` : undefined
    const errorId = error ? `${groupName}-error` : undefined

    const hasError = typeof error === "string" && error.trim().length > 0

    const handleItemChange = (optionValue) => {
      onChange?.(optionValue)
    }

    return (
      <div
        ref={ref}
        data-slot="radio-group"
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={hasError ? errorId : undefined}
        aria-invalid={hasError ? true : undefined}
        className={cn("grid gap-2", className)}
        {...props}
      >
        {/* Group Label */}
        {label && (
          <span
            id={labelId}
            className={cn(
              "text-sm font-semibold mb-1",
              "text-primary"
            )}
          >
            {label}
          </span>
        )}

        {/* Radio Options */}
        <div
          className={cn(
            "flex",
            orientation === "vertical" ? "flex-col gap-3" : "flex-row flex-wrap gap-6"
          )}
        >
          {options.map((option) => (
            <RadioItem
              key={option.value}
              value={option.value}
              label={option.label}
              description={option.description}
              checked={option.value === value}
              onChange={() => handleItemChange(option.value)}
              disabled={option.disabled}
              name={groupName}
            />
          ))}
        </div>

        {/* Error Message */}
        {hasError && (
          <p
            id={errorId}
            data-slot="radio-group-error"
            className="text-sm text-destructive"
          >
            {error}
          </p>
        )}
      </div>
    )
  }
)

RadioGroup.displayName = "RadioGroup"

export { RadioGroup, RadioItem }

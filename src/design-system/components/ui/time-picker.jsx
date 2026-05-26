// ANEST Design System - TimePicker Component
// Input de horário estilizado seguindo o DS, com ícone Clock e suporte light/dark

import * as React from "react"
import { Clock } from "lucide-react"
import { cn } from "@/design-system/utils/tokens"

// ============================================================================
// TIME PICKER COMPONENT
// ============================================================================

const TimePicker = React.forwardRef(
  (
    {
      value,
      onChange,
      placeholder = "Selecionar horário",
      label,
      error,
      disabled = false,
      minTime,
      maxTime,
      step = 15,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const autoId = React.useId()
    const timePickerId = id ?? autoId
    const errorId = error ? `${timePickerId}-error` : undefined

    const hasError = typeof error === "string" && error.trim().length > 0

    const handleChange = (e) => {
      onChange?.(e.target.value)
    }

    return (
      <div
        data-slot="time-picker-field"
        className={cn("relative grid gap-1.5", className)}
      >
        {/* Label */}
        {label && (
          <label
            data-slot="time-picker-label"
            htmlFor={timePickerId}
            className={cn(
              "text-sm font-semibold",
              "text-primary"
            )}
          >
            {label}
          </label>
        )}

        {/* Input Container */}
        <div
          className={cn(
            "relative flex items-center gap-3",
            "rounded-[16px] border py-4 px-[18px]",
            "bg-card dark:bg-card",
            "transition-all duration-200",
            // Border states
            !hasError && "border-border",
            !hasError && "focus-within:border-primary",
            !hasError && "focus-within:ring-2 focus-within:ring-primary/20 dark:focus-within:ring-primary/20",
            // Error state
            hasError && "border-destructive dark:border-destructive",
            hasError && "focus-within:ring-2 focus-within:ring-[#DC2626]/20 dark:focus-within:ring-[#E74C3C]/20",
            // Disabled
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {/* Clock Icon */}
          <Clock
            size={20}
            className="shrink-0 text-primary pointer-events-none"
            aria-hidden="true"
          />

          {/* Native time input */}
          <input
            ref={ref}
            type="time"
            id={timePickerId}
            value={value || ""}
            onChange={handleChange}
            disabled={disabled}
            min={minTime}
            max={maxTime}
            step={step * 60}
            aria-invalid={hasError ? true : undefined}
            aria-describedby={hasError ? errorId : undefined}
            aria-label={label || placeholder}
            placeholder={placeholder}
            className={cn(
              "flex-1 bg-transparent text-base outline-none",
              "min-h-[20px]",
              // Text color
              value
                ? "text-black dark:text-white"
                : "text-muted-foreground",
              // Disabled
              disabled && "cursor-not-allowed",
              // Reset native time input styles
              "[&::-webkit-calendar-picker-indicator]:opacity-0",
              "[&::-webkit-calendar-picker-indicator]:absolute",
              "[&::-webkit-calendar-picker-indicator]:inset-0",
              "[&::-webkit-calendar-picker-indicator]:w-full",
              "[&::-webkit-calendar-picker-indicator]:h-full",
              "[&::-webkit-calendar-picker-indicator]:cursor-pointer"
            )}
            {...props}
          />
        </div>

        {/* Error Message */}
        {hasError && (
          <p
            id={errorId}
            data-slot="time-picker-error"
            className="text-sm text-destructive"
          >
            {error}
          </p>
        )}
      </div>
    )
  }
)

TimePicker.displayName = "TimePicker"

export { TimePicker }

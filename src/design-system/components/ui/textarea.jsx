// ANEST Design System - Textarea Component
// Textarea customizado com suporte a light/dark mode e contador de caracteres

import * as React from "react"
import { cn } from "@/design-system/utils/tokens"

// ============================================================================
// TEXTAREA COMPONENT
// ============================================================================

const Textarea = React.forwardRef(
  (
    {
      value,
      onChange,
      placeholder,
      label,
      error,
      disabled = false,
      rows = 4,
      maxLength,
      showCount = false,
      resize = "vertical",
      className,
      id,
      ...props
    },
    ref
  ) => {
    const autoId = React.useId()
    const textareaId = id ?? autoId
    const errorId = error ? `${textareaId}-error` : undefined

    const hasError = typeof error === "string" && error.trim().length > 0
    const charCount = typeof value === "string" ? value.length : 0

    const handleChange = (e) => {
      const newValue = e.target.value
      // Respect maxLength if provided
      if (maxLength && newValue.length > maxLength) {
        return
      }
      onChange?.(newValue)
    }

    // Map resize prop to CSS values
    const resizeValue = {
      none: "none",
      vertical: "vertical",
      horizontal: "horizontal",
      both: "both",
    }[resize] || "vertical"

    return (
      <div
        data-slot="textarea-field"
        className={cn("grid gap-1.5", className)}
      >
        {/* Label */}
        {label && (
          <label
            data-slot="textarea-label"
            htmlFor={textareaId}
            className={cn(
              "text-sm font-semibold",
              "text-[#004225] dark:text-[#2ECC71]"
            )}
          >
            {label}
          </label>
        )}

        {/* Textarea Container */}
        <div className="relative">
          <textarea
            ref={ref}
            id={textareaId}
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            disabled={disabled}
            rows={rows}
            maxLength={maxLength}
            aria-invalid={hasError ? true : undefined}
            aria-describedby={hasError ? errorId : undefined}
            className={cn(
              "w-full rounded-[16px] border py-4 px-[18px]",
              "text-base text-black dark:text-white",
              "placeholder:text-[#9CA3AF] dark:placeholder:text-[#6B8178]",
              "bg-card dark:bg-[#1A2420]",
              "transition-all duration-200",
              "outline-none",
              // Default border
              !hasError && "border-[#C8E6C9] dark:border-[#2A3F36]",
              // Focus state
              !hasError && "focus:border-[#006837] dark:focus:border-[#2ECC71]",
              "focus:ring-2 focus:ring-[#006837]/20 dark:focus:ring-[#2ECC71]/20",
              // Error state
              hasError && "border-[#DC2626] dark:border-[#E74C3C]",
              hasError && "focus:border-[#DC2626] dark:focus:border-[#E74C3C]",
              hasError && "focus:ring-[#DC2626]/20 dark:focus:ring-[#E74C3C]/20",
              // Disabled
              disabled && "opacity-50 cursor-not-allowed",
              // Padding bottom for counter if shown
              showCount && "pb-8"
            )}
            style={{
              resize: resizeValue,
              minHeight: `${rows * 24 + 32}px`, // Approximate line height + padding
            }}
            {...props}
          />

          {/* Character Counter */}
          {showCount && (
            <span
              className={cn(
                "absolute bottom-3 right-4",
                "text-xs font-medium",
                maxLength && charCount >= maxLength
                  ? "text-[#DC2626] dark:text-[#E74C3C]"
                  : "text-[#9CA3AF] dark:text-[#6B8178]"
              )}
            >
              {maxLength ? `${charCount}/${maxLength}` : charCount}
            </span>
          )}
        </div>

        {/* Error Message */}
        {hasError && (
          <p
            id={errorId}
            data-slot="textarea-error"
            className="text-sm text-[#DC2626] dark:text-[#E74C3C]"
          >
            {error}
          </p>
        )}
      </div>
    )
  }
)

Textarea.displayName = "Textarea"

export { Textarea }


// ANEST Design System - DateTimePicker Component
// Compositor que combina DatePicker + TimePicker lado a lado (desktop) ou empilhado (mobile)

import * as React from "react"
import { cn } from "@/design-system/utils/tokens"
import { DatePicker } from "./date-picker"
import { TimePicker } from "./time-picker"

// ============================================================================
// DATE TIME PICKER COMPONENT
// ============================================================================

const DateTimePicker = React.forwardRef(
  (
    {
      // Date props
      dateValue,
      onDateChange,
      datePlaceholder = "Selecione uma data",
      minDate,
      maxDate,
      format = "dd/MM/yyyy",
      // Time props
      timeValue,
      onTimeChange,
      timePlaceholder = "Selecionar horário",
      minTime,
      maxTime,
      step = 15,
      // Shared props
      label,
      error,
      disabled = false,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const autoId = React.useId()
    const fieldId = id ?? autoId
    const errorId = error ? `${fieldId}-error` : undefined

    const hasError = typeof error === "string" && error.trim().length > 0

    return (
      <div
        ref={ref}
        data-slot="date-time-picker-field"
        className={cn("grid gap-1.5", className)}
        {...props}
      >
        {/* Shared Label */}
        {label && (
          <label
            data-slot="date-time-picker-label"
            className={cn(
              "text-sm font-semibold",
              "text-primary"
            )}
          >
            {label}
          </label>
        )}

        {/* Date + Time row */}
        <div className="flex flex-col md:flex-row gap-3">
          {/* DatePicker — 60% on desktop */}
          <div className="w-full md:w-[60%]">
            <DatePicker
              value={dateValue}
              onChange={onDateChange}
              placeholder={datePlaceholder}
              disabled={disabled}
              minDate={minDate}
              maxDate={maxDate}
              format={format}
              error={hasError ? " " : undefined}
              aria-describedby={hasError ? errorId : undefined}
            />
          </div>

          {/* TimePicker — 40% on desktop */}
          <div className="w-full md:w-[40%]">
            <TimePicker
              value={timeValue}
              onChange={onTimeChange}
              placeholder={timePlaceholder}
              disabled={disabled}
              minTime={minTime}
              maxTime={maxTime}
              step={step}
              error={hasError ? " " : undefined}
              aria-describedby={hasError ? errorId : undefined}
            />
          </div>
        </div>

        {/* Shared Error Message */}
        {hasError && (
          <p
            id={errorId}
            data-slot="date-time-picker-error"
            className="text-sm text-destructive"
          >
            {error}
          </p>
        )}
      </div>
    )
  }
)

DateTimePicker.displayName = "DateTimePicker"

export { DateTimePicker }

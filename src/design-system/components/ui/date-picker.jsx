// ANEST Design System - DatePicker Component
// DatePicker customizado com calendário próprio seguindo as cores do tema

import * as React from "react"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/design-system/utils/tokens"

// ============================================================================
// HELPERS
// ============================================================================

const DAYS_OF_WEEK = ["D", "S", "T", "Q", "Q", "S", "S"]
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
]

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay()
}

function isSameDay(date1, date2) {
  if (!date1 || !date2) return false
  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  )
}

function isToday(date) {
  return isSameDay(date, new Date())
}

function isDateDisabled(date, minDate, maxDate) {
  if (!date) return false
  if (minDate && date < minDate) return true
  if (maxDate && date > maxDate) return true
  return false
}

function formatDate(date, format = "dd/MM/yyyy") {
  if (!date) return ""
  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const year = date.getFullYear()
  
  return format
    .replace("dd", day)
    .replace("MM", month)
    .replace("yyyy", String(year))
    .replace("yy", String(year).slice(-2))
}

// ============================================================================
// CALENDAR COMPONENT
// ============================================================================

function Calendar({
  value,
  onChange,
  minDate,
  maxDate,
  onClose,
}) {
  const [viewDate, setViewDate] = React.useState(() => {
    return value || new Date()
  })

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)

  const prevMonth = () => {
    setViewDate(new Date(year, month - 1, 1))
  }

  const nextMonth = () => {
    setViewDate(new Date(year, month + 1, 1))
  }

  const handleSelectDay = (day) => {
    const selectedDate = new Date(year, month, day)
    if (!isDateDisabled(selectedDate, minDate, maxDate)) {
      onChange?.(selectedDate)
      onClose?.()
    }
  }

  const handleToday = () => {
    const today = new Date()
    if (!isDateDisabled(today, minDate, maxDate)) {
      onChange?.(today)
      onClose?.()
    }
  }

  const handleClear = () => {
    onChange?.(null)
    onClose?.()
  }

  // Generate calendar days
  const days = []
  
  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    days.push(null)
  }
  
  // Days of month
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day)
  }

  return (
    <div
      className={cn(
        "w-[280px] rounded-[16px] overflow-hidden",
        "bg-card dark:bg-card",
        "border border-border",
        "shadow-lg dark:shadow-none"
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between px-4 py-3",
          "border-b border-border"
        )}
      >
        <button
          type="button"
          onClick={prevMonth}
          className={cn(
            "p-1 rounded-lg transition-colors",
            "hover:bg-muted dark:hover:bg-muted",
            "text-primary"
          )}
        >
          <ChevronLeft size={20} />
        </button>
        
        <span
          className={cn(
            "font-semibold text-sm",
            "text-primary"
          )}
        >
          {MONTHS[month]} {year}
        </span>
        
        <button
          type="button"
          onClick={nextMonth}
          className={cn(
            "p-1 rounded-lg transition-colors",
            "hover:bg-muted dark:hover:bg-muted",
            "text-primary"
          )}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Days of week header */}
      <div className="grid grid-cols-7 px-2 py-2">
        {DAYS_OF_WEEK.map((day, index) => (
          <div
            key={index}
            className={cn(
              "text-center text-xs font-medium py-1",
              "text-muted-foreground"
            )}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 px-2 pb-2 gap-1">
        {days.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} className="h-9" />
          }

          const date = new Date(year, month, day)
          const isSelected = isSameDay(date, value)
          const isTodayDate = isToday(date)
          const isDisabled = isDateDisabled(date, minDate, maxDate)

          return (
            <button
              key={`day-${day}`}
              type="button"
              disabled={isDisabled}
              onClick={() => handleSelectDay(day)}
              className={cn(
                "h-9 w-full rounded-lg text-sm font-medium transition-all",
                "flex items-center justify-center",
                // Default state
                !isSelected && !isTodayDate && !isDisabled && [
                  "text-black dark:text-white",
                  "hover:bg-muted dark:hover:bg-muted",
                ],
                // Today (not selected)
                isTodayDate && !isSelected && !isDisabled && [
                  "text-primary",
                  "border border-primary",
                  "hover:bg-muted dark:hover:bg-muted",
                ],
                // Selected
                isSelected && [
                  "bg-primary",
                  "text-white dark:text-foreground",
                  "hover:bg-primary dark:hover:bg-[#27AE60]",
                ],
                // Disabled
                isDisabled && [
                  "text-[#D1D5DB] dark:text-[#3A4F46]",
                  "cursor-not-allowed",
                ]
              )}
            >
              {day}
            </button>
          )
        })}
      </div>

      {/* Footer */}
      <div
        className={cn(
          "flex items-center justify-between px-4 py-3",
          "border-t border-border"
        )}
      >
        <button
          type="button"
          onClick={handleClear}
          className={cn(
            "text-sm font-medium transition-colors",
            "text-primary",
            "hover:text-foreground dark:hover:text-[#27AE60]"
          )}
        >
          Limpar
        </button>
        <button
          type="button"
          onClick={handleToday}
          className={cn(
            "text-sm font-medium transition-colors",
            "text-primary",
            "hover:text-foreground dark:hover:text-[#27AE60]"
          )}
        >
          Hoje
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// DATE PICKER COMPONENT
// ============================================================================

const DatePicker = React.forwardRef(
  (
    {
      value,
      onChange,
      placeholder = "Selecione uma data",
      label,
      error,
      disabled = false,
      minDate,
      maxDate,
      format = "dd/MM/yyyy",
      className,
      id,
      ...props
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = React.useState(false)
    const containerRef = React.useRef(null)
    const autoId = React.useId()
    const datePickerId = id ?? autoId
    const errorId = error ? `${datePickerId}-error` : undefined

    const hasError = typeof error === "string" && error.trim().length > 0
    const displayValue = value ? formatDate(value, format) : ""

    // Close on click outside
    React.useEffect(() => {
      const handleClickOutside = (event) => {
        if (containerRef.current && !containerRef.current.contains(event.target)) {
          setIsOpen(false)
        }
      }

      if (isOpen) {
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
      }
    }, [isOpen])

    // Close on Escape
    React.useEffect(() => {
      const handleEscape = (event) => {
        if (event.key === "Escape") {
          setIsOpen(false)
        }
      }

      if (isOpen) {
        document.addEventListener("keydown", handleEscape)
        return () => document.removeEventListener("keydown", handleEscape)
      }
    }, [isOpen])

    const handleToggle = () => {
      if (!disabled) {
        setIsOpen(!isOpen)
      }
    }

    const handleChange = (date) => {
      onChange?.(date)
    }

    return (
      <div
        ref={containerRef}
        data-slot="date-picker-field"
        className={cn("relative grid gap-1.5", className)}
      >
        {/* Label */}
        {label && (
          <label
            data-slot="date-picker-label"
            htmlFor={datePickerId}
            className={cn(
              "text-sm font-semibold",
              "text-primary"
            )}
          >
            {label}
          </label>
        )}

        {/* Input Container */}
        <button
          ref={ref}
          type="button"
          id={datePickerId}
          onClick={handleToggle}
          disabled={disabled}
          aria-invalid={hasError ? true : undefined}
          aria-describedby={hasError ? errorId : undefined}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          className={cn(
            "flex items-center gap-3 text-left",
            "rounded-[16px] border py-4 px-[18px]",
            "bg-card dark:bg-card",
            "transition-all duration-200",
            // Border states
            !hasError && "border-border",
            !hasError && isOpen && "border-primary",
            !hasError && isOpen && "ring-2 ring-primary/20 dark:ring-primary/20",
            // Error state
            hasError && "border-destructive dark:border-destructive",
            hasError && isOpen && "ring-2 ring-[#DC2626]/20 dark:ring-[#E74C3C]/20",
            // Disabled
            disabled && "opacity-50 cursor-not-allowed",
            !disabled && "cursor-pointer"
          )}
          {...props}
        >
          {/* Calendar Icon */}
          <CalendarIcon
            size={20}
            className="shrink-0 text-primary"
          />

          {/* Display Value or Placeholder */}
          <span
            className={cn(
              "flex-1 text-base",
              displayValue
                ? "text-black dark:text-white"
                : "text-muted-foreground"
            )}
          >
            {displayValue || placeholder}
          </span>
        </button>

        {/* Dropdown Calendar */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className={cn(
                "absolute z-50 top-full left-0 mt-2"
              )}
            >
              <Calendar
                value={value}
                onChange={handleChange}
                minDate={minDate}
                maxDate={maxDate}
                onClose={() => setIsOpen(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Message */}
        {hasError && (
          <p
            id={errorId}
            data-slot="date-picker-error"
            className="text-sm text-destructive"
          >
            {error}
          </p>
        )}
      </div>
    )
  }
)

DatePicker.displayName = "DatePicker"

export { DatePicker, Calendar }

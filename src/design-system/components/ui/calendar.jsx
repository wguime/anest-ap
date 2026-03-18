import * as React from "react"
import { useState, useMemo } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

import { cn } from "@/design-system/utils/tokens"
import { Button } from "./button"

/**
 * Calendar - Componente de calendário
 *
 * Features:
 * - Navegação por mês/ano
 * - Seleção de data única ou range
 * - Marcação de eventos
 * - Dias desabilitados
 * - Dark/Light mode
 *
 * @example
 * <Calendar
 *   selected={selectedDate}
 *   onSelect={setSelectedDate}
 *   events={[
 *     { date: new Date(2025, 11, 25), label: 'Natal', color: 'red' }
 *   ]}
 * />
 */

const DAYS_OF_WEEK = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
]

function Calendar({
  selected,
  onSelect,
  rangeStart,
  rangeEnd,
  onRangeSelect,
  events = [],
  minDate,
  maxDate,
  disabledDates = [],
  disabledDaysOfWeek = [],
  showOutsideDays = true,
  weekStartsOn = 0, // 0 = Sunday, 1 = Monday
  locale = "pt-BR",
  className,
  ...props
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [viewDate, setViewDate] = useState(() => {
    if (selected) return new Date(selected)
    if (rangeStart) return new Date(rangeStart)
    return today
  })

  const [isSelectingRange, setIsSelectingRange] = useState(false)
  const [hoverDate, setHoverDate] = useState(null)

  // Get calendar days
  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()

    const firstDayOfMonth = new Date(year, month, 1)
    const lastDayOfMonth = new Date(year, month + 1, 0)

    const startDay = firstDayOfMonth.getDay()
    const daysInMonth = lastDayOfMonth.getDate()

    const days = []

    // Previous month days
    const adjustedStartDay = (startDay - weekStartsOn + 7) % 7
    if (showOutsideDays && adjustedStartDay > 0) {
      const prevMonthLastDay = new Date(year, month, 0).getDate()
      for (let i = adjustedStartDay - 1; i >= 0; i--) {
        days.push({
          date: new Date(year, month - 1, prevMonthLastDay - i),
          isOutside: true,
        })
      }
    } else {
      for (let i = 0; i < adjustedStartDay; i++) {
        days.push({ date: null, isOutside: true })
      }
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({
        date: new Date(year, month, day),
        isOutside: false,
      })
    }

    // Next month days
    const remainingDays = 42 - days.length // 6 rows * 7 days
    if (showOutsideDays) {
      for (let i = 1; i <= remainingDays; i++) {
        days.push({
          date: new Date(year, month + 1, i),
          isOutside: true,
        })
      }
    }

    return days
  }, [viewDate, showOutsideDays, weekStartsOn])

  // Navigate months
  const goToPreviousMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))
  }

  const goToToday = () => {
    setViewDate(new Date(today))
  }

  // Check if date is disabled
  const isDateDisabled = (date) => {
    if (!date) return true

    if (minDate && date < minDate) return true
    if (maxDate && date > maxDate) return true

    if (disabledDaysOfWeek.includes(date.getDay())) return true

    return disabledDates.some(
      (d) => d.getTime() === date.getTime()
    )
  }

  // Check if date is selected
  const isDateSelected = (date) => {
    if (!date) return false

    if (selected) {
      return date.getTime() === new Date(selected).setHours(0, 0, 0, 0)
    }

    if (rangeStart && rangeEnd) {
      const start = new Date(rangeStart).setHours(0, 0, 0, 0)
      const end = new Date(rangeEnd).setHours(0, 0, 0, 0)
      return date.getTime() >= start && date.getTime() <= end
    }

    if (rangeStart) {
      return date.getTime() === new Date(rangeStart).setHours(0, 0, 0, 0)
    }

    return false
  }

  // Check if date is in range preview
  const isInRangePreview = (date) => {
    if (!date || !rangeStart || !hoverDate || rangeEnd) return false

    const start = new Date(rangeStart).setHours(0, 0, 0, 0)
    const hover = new Date(hoverDate).setHours(0, 0, 0, 0)
    const dateTime = date.getTime()

    if (start < hover) {
      return dateTime > start && dateTime <= hover
    } else {
      return dateTime >= hover && dateTime < start
    }
  }

  // Check if date is range start or end
  const isRangeStart = (date) => {
    if (!date || !rangeStart) return false
    return date.getTime() === new Date(rangeStart).setHours(0, 0, 0, 0)
  }

  const isRangeEnd = (date) => {
    if (!date || !rangeEnd) return false
    return date.getTime() === new Date(rangeEnd).setHours(0, 0, 0, 0)
  }

  // Get events for date
  const getEventsForDate = (date) => {
    if (!date) return []
    return events.filter(
      (event) => new Date(event.date).setHours(0, 0, 0, 0) === date.getTime()
    )
  }

  // Handle date click
  const handleDateClick = (date) => {
    if (!date || isDateDisabled(date)) return

    if (onRangeSelect) {
      if (!rangeStart || (rangeStart && rangeEnd)) {
        onRangeSelect({ start: date, end: null })
      } else {
        const start = new Date(rangeStart)
        if (date < start) {
          onRangeSelect({ start: date, end: start })
        } else {
          onRangeSelect({ start: start, end: date })
        }
      }
    } else if (onSelect) {
      onSelect(date)
    }
  }

  // Get weekday headers
  const weekDays = useMemo(() => {
    const days = [...DAYS_OF_WEEK]
    const rotated = days.splice(0, weekStartsOn)
    return [...days, ...rotated]
  }, [weekStartsOn])

  return (
    <div
      data-slot="calendar"
      className={cn(
        "w-full max-w-[320px] p-4 rounded-[20px]",
        "bg-card dark:bg-card",
        "border border-border",
        "shadow-[0_2px_12px_rgba(0,66,37,0.06)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3)]",
        className
      )}
      {...props}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={goToPreviousMonth}
          aria-label="Mês anterior"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        <div className="flex flex-col items-center">
          <span className="text-[16px] font-bold text-black dark:text-white">
            {MONTHS[viewDate.getMonth()]}
          </span>
          <span className="text-[12px] text-muted-foreground">
            {viewDate.getFullYear()}
          </span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={goToNextMonth}
          aria-label="Próximo mês"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Today button */}
      <div className="flex justify-center mb-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={goToToday}
          className="text-[12px]"
        >
          Hoje
        </Button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((day, i) => (
          <div
            key={i}
            className="h-8 flex items-center justify-center text-[12px] font-semibold text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5 md:gap-1">
        {calendarDays.map((dayData, i) => {
          const { date, isOutside } = dayData
          const isDisabled = isDateDisabled(date)
          const isSelected = isDateSelected(date)
          const isToday = date && date.getTime() === today.getTime()
          const dayEvents = getEventsForDate(date)
          const inRangePreview = isInRangePreview(date)
          const isStart = isRangeStart(date)
          const isEnd = isRangeEnd(date)

          return (
            <motion.button
              key={i}
              type="button"
              disabled={isDisabled || !date}
              onClick={() => handleDateClick(date)}
              onMouseEnter={() => setHoverDate(date)}
              onMouseLeave={() => setHoverDate(null)}
              whileTap={!isDisabled && date ? { scale: 0.9 } : undefined}
              className={cn(
                "relative h-11 min-h-[44px] flex flex-col items-center justify-center rounded-[8px] md:rounded-[10px]",
                "text-[13px] md:text-[14px] font-medium",
                "transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-primary",
                // Default state
                !isSelected && !isOutside && !isDisabled && "text-black dark:text-white hover:bg-[#F3F4F6] dark:hover:bg-muted",
                // Outside days
                isOutside && "text-[#D1D5DB] dark:text-[#4B5563]",
                // Disabled
                isDisabled && "text-[#E5E7EB] dark:text-[#2A3F36] cursor-not-allowed",
                // Today
                isToday && !isSelected && "bg-[#F3F4F6] dark:bg-muted font-bold",
                // Selected
                isSelected && "bg-primary text-white",
                // Range start/end
                isStart && "rounded-r-none",
                isEnd && "rounded-l-none",
                // In range (not start or end)
                isSelected && !isStart && !isEnd && rangeEnd && "rounded-none bg-muted dark:bg-[#1E3A2F] text-black dark:text-white",
                // Range preview
                inRangePreview && "bg-muted/50 dark:bg-[#1E3A2F]/50"
              )}
            >
              <span>{date?.getDate()}</span>

              {/* Event indicators */}
              {dayEvents.length > 0 ? (
                <div className="absolute bottom-1 flex gap-0.5">
                  {dayEvents.slice(0, 3).map((event, j) => (
                    <span
                      key={j}
                      className="h-1 w-1 rounded-full"
                      style={{ backgroundColor: event.color || "#006837" }}
                      title={event.label}
                    />
                  ))}
                </div>
              ) : null}
            </motion.button>
          )
        })}
      </div>

      {/* Events list (optional) */}
      {events.length > 0 ? (
        <div className="mt-4 pt-4 border-t border-[#E5E7EB] dark:border-border">
          <h4 className="text-[12px] font-semibold text-muted-foreground mb-2">
            Eventos deste mês
          </h4>
          <div className="space-y-1 max-h-[120px] overflow-y-auto">
            {events
              .filter((e) => {
                const eventDate = new Date(e.date)
                return (
                  eventDate.getMonth() === viewDate.getMonth() &&
                  eventDate.getFullYear() === viewDate.getFullYear()
                )
              })
              .slice(0, 5)
              .map((event, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-[13px]"
                >
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: event.color || "#006837" }}
                  />
                  <span className="text-muted-foreground">
                    {new Date(event.date).getDate()}
                  </span>
                  <span className="text-black dark:text-white truncate">
                    {event.label}
                  </span>
                </div>
              ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export { Calendar }

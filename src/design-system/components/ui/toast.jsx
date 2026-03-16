import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { AlertTriangle, CheckCircle, Info, X, XCircle } from "lucide-react"

import { cn } from "@/design-system/utils/tokens"

const ToastContext = React.createContext(null)

function makeId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const VARIANT_STYLES = {
  success: {
    container:
      "bg-[#D1FAE5] border-[#34C759] text-[#166534] dark:bg-[#064E3B] dark:border-[#2ECC71] dark:text-[#D1FAE5]",
    icon: CheckCircle,
  },
  warning: {
    container:
      "bg-[#FEF3C7] border-[#F59E0B] text-[#92400E] dark:bg-[#78350F] dark:border-[#F39C12] dark:text-[#FEF3C7]",
    icon: AlertTriangle,
  },
  error: {
    container:
      "bg-[#FEE2E2] border-[#DC2626] text-[#991B1B] dark:bg-[#7F1D1D] dark:border-[#E74C3C] dark:text-[#FEE2E2]",
    icon: XCircle,
  },
  info: {
    container:
      "bg-[#DBEAFE] border-[#007AFF] text-[#1E40AF] dark:bg-[#1E3A8A] dark:border-[#3498DB] dark:text-[#DBEAFE]",
    icon: Info,
  },
  default: {
    container:
      "bg-card border-[#A5D6A7] text-[#004225] dark:bg-[#1A2420] dark:border-[#2A3F36] dark:text-[#FFFFFF]",
    icon: Info,
  },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = React.useState([])
  const timersRef = React.useRef(new Map())
  const timeTrackRef = React.useRef(new Map())

  const dismiss = React.useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timersRef.current.get(id)
    if (timer) {
      window.clearTimeout(timer)
      timersRef.current.delete(id)
    }
    timeTrackRef.current.delete(id)
  }, [])

  const dismissAll = React.useCallback(() => {
    setToasts([])
    for (const timer of timersRef.current.values()) {
      window.clearTimeout(timer)
    }
    timersRef.current.clear()
    timeTrackRef.current.clear()
  }, [])

  const startTimer = React.useCallback((id, duration) => {
    if (duration <= 0) return
    const timer = window.setTimeout(() => dismiss(id), duration)
    timersRef.current.set(id, timer)
    timeTrackRef.current.set(id, { remaining: duration, startedAt: Date.now() })
  }, [dismiss])

  const pause = React.useCallback((id) => {
    const timer = timersRef.current.get(id)
    if (timer) {
      window.clearTimeout(timer)
      timersRef.current.delete(id)
    }
    const track = timeTrackRef.current.get(id)
    if (track) {
      const elapsed = Date.now() - track.startedAt
      track.remaining = Math.max(0, track.remaining - elapsed)
    }
    setToasts((prev) => prev.map((t) => t.id === id ? { ...t, paused: true } : t))
  }, [])

  const resume = React.useCallback((id) => {
    const track = timeTrackRef.current.get(id)
    if (track && track.remaining > 0) {
      const timer = window.setTimeout(() => dismiss(id), track.remaining)
      timersRef.current.set(id, timer)
      track.startedAt = Date.now()
    }
    setToasts((prev) => prev.map((t) => t.id === id ? { ...t, paused: false } : t))
  }, [dismiss])

  const toast = React.useCallback(
    ({ variant = "default", title, description, duration = 5000, action }) => {
      const id = makeId()
      const next = { id, variant, title, description, duration, action, paused: false }
      setToasts((prev) => [next, ...prev])

      if (duration > 0) {
        startTimer(id, duration)
      }

      return id
    },
    [startTimer]
  )

  const value = React.useMemo(
    () => ({ toasts, toast, dismiss, dismissAll, pause, resume }),
    [toasts, toast, dismiss, dismissAll, pause, resume]
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} onPause={pause} onResume={resume} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = React.useContext(ToastContext)
  if (!ctx) {
    throw new Error(
      "[useToast] Hook chamado fora do ToastProvider. Envolva sua app com <ToastProvider>."
    )
  }
  return ctx
}

function ToastViewport({ toasts, onDismiss, onPause, onResume }) {
  return (
    <div
      className="pointer-events-none fixed right-6 z-[1300] flex w-[420px] max-w-[calc(100vw-48px)] flex-col gap-3"
      style={{ top: "calc(24px + var(--safe-area-top))" }}
      aria-live="polite"
      aria-relevant="additions removals"
      aria-atomic="false"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-auto"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            dragSnapToOrigin
            onDragEnd={(_, info) => {
              if (info.offset.x > 80) {
                onDismiss(t.id)
              }
            }}
          >
            <Toast
              {...t}
              onClose={() => onDismiss(t.id)}
              onMouseEnter={() => onPause(t.id)}
              onMouseLeave={() => onResume(t.id)}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export function Toast({
  variant = "default",
  title,
  description,
  duration = 5000,
  action,
  paused = false,
  onClose,
  onMouseEnter,
  onMouseLeave,
}) {
  const v = VARIANT_STYLES[variant] ?? VARIANT_STYLES.default
  const Icon = v.icon
  const isError = variant === "error"

  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      aria-atomic="true"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        "relative min-w-[320px] rounded-2xl border p-4 shadow-lg",
        v.container
      )}
    >
      <div className="flex gap-3">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="pr-10 text-[15px] font-semibold leading-5">
            {title}
          </div>
          {description ? (
            <div className="mt-1 pr-10 text-[14px] leading-5 opacity-90">
              {description}
            </div>
          ) : null}

          {action ? (
            <div className="mt-3">
              <button
                type="button"
                onClick={action.onClick}
                className={cn(
                  "inline-flex h-8 items-center justify-center rounded-md border px-3 text-xs font-semibold transition-colors",
                  "border-current/30 hover:bg-black/5 dark:hover:bg-white/10"
                )}
              >
                {action.label}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className={cn(
          "absolute right-1 top-1 inline-flex h-11 w-11 items-center justify-center rounded-xl",
          "text-current/70 hover:text-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        )}
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>

      {duration > 0 ? (
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
          <motion.div
            className="h-full w-full bg-current/60"
            initial={{ width: "100%" }}
            animate={{ width: paused ? undefined : "0%" }}
            transition={paused ? { duration: 0 } : { duration: duration / 1000, ease: [0.4, 0, 0.2, 1] }}
          />
        </div>
      ) : null}
    </div>
  )
}

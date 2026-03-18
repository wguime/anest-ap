import * as React from "react"
import {
  AlertTriangle,
  Bell,
  CheckCircle,
  Info,
  X,
  XCircle,
} from "lucide-react"

import { cn } from "@/design-system/utils/tokens"
import { Button } from "./button"

const VARIANT_STYLES = {
  success: {
    container:
      "bg-[#D1FAE5] border-success text-[#166534] dark:bg-[#064E3B] dark:border-primary dark:text-[#D1FAE5]",
    icon: CheckCircle,
  },
  warning: {
    container:
      "bg-[#FEF3C7] border-warning text-[#92400E] dark:bg-[#78350F] dark:border-warning dark:text-[#FEF3C7]",
    icon: AlertTriangle,
  },
  error: {
    container:
      "bg-[#FEE2E2] border-destructive text-[#991B1B] dark:bg-[#7F1D1D] dark:border-destructive dark:text-[#FEE2E2]",
    icon: XCircle,
  },
  info: {
    container:
      "bg-[#DBEAFE] border-[#007AFF] text-[#1E40AF] dark:bg-[#1E3A8A] dark:border-[#3498DB] dark:text-[#DBEAFE]",
    icon: Info,
  },
  default: {
    container:
      "bg-card border-border text-foreground dark:bg-card dark:border-border dark:text-[#FFFFFF]",
    icon: Bell,
  },
}

export function Alert({
  variant = "default",
  title,
  children,
  icon,
  dismissible = false,
  onDismiss,
  action,
  className,
}) {
  const v = VARIANT_STYLES[variant] ?? VARIANT_STYLES.default
  const DefaultIcon = v.icon
  const role = variant === "error" ? "alert" : "status"

  return (
    <div
      role={role}
      aria-atomic="true"
      className={cn(
        "relative rounded-lg border border-l-4 px-3 py-2 shadow-sm",
        v.container,
        className
      )}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center">
          {icon ? (
            <span className="h-5 w-5" aria-hidden="true">
              {icon}
            </span>
          ) : (
            <DefaultIcon className="h-5 w-5" aria-hidden="true" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          {title ? (
            <div className="text-sm font-semibold leading-5">{title}</div>
          ) : null}
          {children ? (
            <div className={cn("text-sm leading-5", title ? "mt-0.5" : "")}>
              {children}
            </div>
          ) : null}
        </div>

        {action ? (
          <Button
            variant="outline"
            size="sm"
            onClick={action.onClick}
            className="border-current/30 text-current shrink-0 h-7 px-2.5 text-xs"
          >
            {action.label}
          </Button>
        ) : null}
      </div>

      {dismissible ? (
        <button
          type="button"
          aria-label="Fechar"
          onClick={onDismiss}
          className={cn(
            "absolute right-1 top-1 inline-flex h-8 w-8 items-center justify-center rounded-lg",
            "text-current/70 hover:text-current",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          )}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}



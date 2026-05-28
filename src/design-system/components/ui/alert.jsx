import * as React from "react"
import { cva } from "class-variance-authority"
import { AlertTriangle, Bell, CheckCircle, Info, X, XCircle } from "lucide-react"

import { cn } from "@/design-system/utils/tokens"
import { Button } from "./button"

const alertVariants = cva(
  "relative rounded-lg border border-l-4 px-3 py-2 shadow-elevation-1",
  {
    variants: {
      variant: {
        default: "bg-card border-border text-foreground",
        success:
          "bg-success/10 border-success text-foreground dark:bg-success/15 dark:text-foreground",
        warning:
          "bg-warning/10 border-warning text-foreground dark:bg-warning/15 dark:text-foreground",
        error:
          "bg-destructive/10 border-destructive text-foreground dark:bg-destructive/15 dark:text-foreground",
        info:
          "bg-info/10 border-info text-foreground dark:bg-info/15 dark:text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const VARIANT_ICONS = {
  default: Bell,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
}

const Alert = React.forwardRef(({
  variant = "default",
  title,
  children,
  icon,
  dismissible = false,
  onDismiss,
  action,
  className,
  ...props
}, ref) => {
  const DefaultIcon = VARIANT_ICONS[variant] ?? VARIANT_ICONS.default
  const role = variant === "error" ? "alert" : "status"

  return (
    <div
      ref={ref}
      role={role}
      aria-atomic="true"
      data-slot="alert"
      data-variant={variant}
      className={cn(alertVariants({ variant }), className)}
      {...props}
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
})
Alert.displayName = "Alert"

export { Alert, alertVariants }

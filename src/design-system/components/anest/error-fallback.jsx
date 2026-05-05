import * as React from "react"
import { AlertCircle } from "lucide-react"
import { Button } from "@/design-system/components/ui/button"
import { Card, CardContent } from "@/design-system/components/ui/card"
import { cn } from "@/design-system/utils/tokens"

/**
 * ErrorFallback — UI reutilizável de fallback para ErrorBoundary global ou local.
 * Usa tokens DS (bg-card, text-foreground, etc) — sem hex hardcoded.
 *
 * @param {Error} [error]      - erro capturado (opcional, exibido em <details> em dev)
 * @param {string} [title]     - título principal
 * @param {string} [message]   - mensagem amigável
 * @param {function} [onRetry] - handler do botão "Tentar novamente"
 * @param {string}  [retryLabel]
 * @param {string}  [className]
 */
export function ErrorFallback({
  error,
  title = "Algo deu errado",
  message = "Algo deu errado. Recarregue a página.",
  onRetry,
  retryLabel = "Tentar novamente",
  className,
}) {
  const isDev = typeof import.meta !== "undefined" && import.meta?.env?.DEV

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "flex min-h-[100dvh] items-center justify-center bg-background p-4",
        className
      )}
    >
      <Card className="w-full max-w-md border border-border bg-card shadow-lg rounded-2xl">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div
            className={cn(
              "flex h-16 w-16 items-center justify-center rounded-2xl",
              "bg-destructive/10 text-destructive"
            )}
            aria-hidden="true"
          >
            <AlertCircle className="h-8 w-8" />
          </div>

          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>

          {isDev && error ? (
            <details className="w-full text-left">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                Detalhes técnicos (dev)
              </summary>
              <pre
                className={cn(
                  "mt-2 max-h-48 overflow-auto rounded-md p-3",
                  "bg-muted text-xs text-foreground/80 whitespace-pre-wrap"
                )}
              >
                {String(error?.stack || error?.message || error)}
              </pre>
            </details>
          ) : null}

          {onRetry ? (
            <Button onClick={onRetry} className="mt-2">
              {retryLabel}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

export default ErrorFallback

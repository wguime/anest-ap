import * as React from "react"
import { AlertTriangle, RefreshCcw, RotateCcw } from "lucide-react"
import { cn } from "@/design-system/utils/tokens"

/**
 * ErrorBoundary — captura erros em runtime de qualquer subtree React e exibe
 * fallback DS com opções de recuperação (recarregar página ou tentar de novo).
 *
 * Wave 4.4 hook: `onError(error, errorInfo)` permite plugar errorReporting/Sentry.
 *
 * Props:
 *   - children: ReactNode
 *   - onError?: (error, errorInfo) => void  — efeito colateral (telemetria)
 *   - fallback?: (error, retry) => ReactNode — render alternativo customizado
 *
 * @example
 * <ErrorBoundary key={currentPage} onError={reportError}>
 *   <Page />
 * </ErrorBoundary>
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, errorInfo)
    if (typeof this.props.onError === "function") {
      try {
        this.props.onError(error, errorInfo)
      } catch (cbErr) {
        // eslint-disable-next-line no-console
        console.error("[ErrorBoundary] onError callback threw", cbErr)
      }
    }
  }

  handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload()
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    const { hasError, error, errorInfo } = this.state
    const { children, fallback, className } = this.props

    if (!hasError) return children

    if (typeof fallback === "function") {
      return fallback(error, this.handleReset)
    }

    const message = error?.message || "Erro desconhecido"
    const stack = (error?.stack || "").slice(0, 500)
    const componentStack = (errorInfo?.componentStack || "").slice(0, 500)

    return (
      <div
        role="alert"
        aria-live="assertive"
        className={cn(
          "mx-auto my-6 max-w-2xl rounded-xl border border-border bg-card p-6 text-foreground shadow-md",
          className
        )}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle
            className="h-6 w-6 shrink-0 text-destructive"
            aria-hidden="true"
          />
          <div className="flex-1">
            <h2 className="text-lg font-bold text-foreground">
              Algo deu errado
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tentamos novamente, mas a página teve um problema. Recarregue ou
              volte ao início.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                Recarregar
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Tentar de novo
              </button>
            </div>

            <details className="mt-4 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer font-semibold text-foreground">
                Detalhes técnicos
              </summary>
              <div className="mt-2 space-y-2">
                <div>
                  <strong className="text-foreground">Mensagem:</strong>{" "}
                  <span className="break-words">{message}</span>
                </div>
                {stack && (
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-background p-2 text-[11px] leading-tight text-foreground">
                    {stack}
                  </pre>
                )}
                {componentStack && (
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-background p-2 text-[11px] leading-tight text-foreground">
                    {componentStack}
                  </pre>
                )}
              </div>
            </details>
          </div>
        </div>
      </div>
    )
  }
}

export { ErrorBoundary }
export default ErrorBoundary

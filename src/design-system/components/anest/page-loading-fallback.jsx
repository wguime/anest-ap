// PageLoadingFallback — usado como fallback de React.Suspense para rotas
// lazy-loaded (App.jsx). Centraliza o estado de loading entre splits de bundle
// usando apenas tokens do DS (bg-background, primary). Sem hex hardcoded.

import { Spinner } from "../ui/spinner"
import { cn } from "../../utils/tokens"

export function PageLoadingFallback({ className }) {
  return (
    <div
      className={cn(
        "min-h-dvh flex items-center justify-center bg-background",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Spinner size="lg" variant="primary" />
      <span className="sr-only">Carregando página…</span>
    </div>
  )
}

export default PageLoadingFallback

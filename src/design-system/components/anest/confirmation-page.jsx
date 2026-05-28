import * as React from "react"
import { CheckCircle2, Copy, Check } from "lucide-react"

import { cn } from "@/design-system/utils/tokens"

/**
 * ConfirmationPage — bloco de confirmação pós-submissão estilo NHS. Caso de uso
 * principal: pós-denúncia, exibindo o código de rastreio `ANEST-YYYY-XXXXXX`
 * proeminente (copiável) + próximos passos. É um bloco de CONTEÚDO, não um modal —
 * quem usa deve renderizá-lo dentro de PageShell/PageHeader.
 *
 * @example
 * <ConfirmationPage
 *   title="Denúncia registrada"
 *   code="ANEST-2026-004217"
 *   description="Guarde este código para acompanhar o andamento com segurança."
 *   nextSteps={[
 *     "Anote ou copie o código de acompanhamento.",
 *     "Use o código na página de consulta para ver atualizações.",
 *     "O comitê analisará em até 5 dias úteis.",
 *   ]}
 *   actions={<Button onClick={() => onNavigate("home")}>Voltar ao início</Button>}
 * />
 */
const ConfirmationPage = React.forwardRef(function ConfirmationPage(
  {
    title,
    code,
    description,
    nextSteps,
    actions,
    icon: Icon = CheckCircle2,
    className,
    ...props
  },
  ref
) {
  const [copied, setCopied] = React.useState(false)
  const copyTimeoutRef = React.useRef(null)

  React.useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    }
  }, [])

  const handleCopy = React.useCallback(async () => {
    if (!code) return
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(code)
      } else {
        return
      }
      setCopied(true)
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard indisponível ou bloqueado — falha silenciosa, sem feedback.
    }
  }, [code])

  const hasSteps = Array.isArray(nextSteps) && nextSteps.length > 0

  return (
    <div
      ref={ref}
      data-slot="anest-confirmation-page"
      className={cn("space-y-5", className)}
      {...props}
    >
      {/* 1. Painel de sucesso */}
      <div
        role="status"
        className="flex flex-col items-center gap-3 rounded-[20px] border border-success/30 bg-success/10 px-5 py-7 text-center"
      >
        <Icon aria-hidden="true" className="w-12 h-12 shrink-0 text-success" />
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>

      {/* 2. Caixa do código (copiável) */}
      {code ? (
        <div className="flex items-center justify-between gap-3 rounded-[20px] border border-border bg-muted px-4 py-4">
          <div className="min-w-0 flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Código de acompanhamento
            </span>
            <span className="text-xl font-mono font-bold tracking-wide text-foreground break-all">
              {code}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? "Código copiado" : "Copiar código de acompanhamento"}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 shrink-0 h-11 min-w-[44px] px-3 rounded-xl border border-border bg-card text-sm font-medium text-foreground transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              copied && "text-success border-success/40"
            )}
          >
            {copied ? (
              <Check aria-hidden="true" className="w-4 h-4" />
            ) : (
              <Copy aria-hidden="true" className="w-4 h-4" />
            )}
            <span>{copied ? "Copiado" : "Copiar"}</span>
          </button>
        </div>
      ) : null}

      {/* 3. Próximos passos */}
      {hasSteps ? (
        <div className="rounded-[20px] border border-border bg-card px-4 py-4 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">
            Próximos passos
          </h3>
          <ol className="space-y-2.5">
            {nextSteps.map((step, index) => (
              <li key={index} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="inline-flex items-center justify-center shrink-0 w-6 h-6 rounded-full bg-primary/10 text-xs font-semibold text-primary"
                >
                  {index + 1}
                </span>
                <span className="text-sm leading-relaxed text-foreground pt-0.5">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {/* 4. Ações no rodapé */}
      {actions ? (
        <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  )
})

export { ConfirmationPage }

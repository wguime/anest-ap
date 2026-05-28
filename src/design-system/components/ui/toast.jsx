import * as React from "react"
import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner"

import { useTheme } from "../../hooks/useTheme.jsx"
import { cn } from "@/design-system/utils/tokens"

/**
 * Sistema de toast do ANEST — engine migrado para Sonner (Fase 2.1 do plano DS).
 *
 * A API pública é mantida 100% compatível com a implementação anterior para não
 * quebrar os ~79 call sites:
 *   const { toast } = useToast()
 *   toast({ variant, title, description, duration, action })
 *
 * `ToastProvider` agora apenas monta o `<Toaster>` do Sonner (tematizado com os
 * tokens ANEST) e repassa os children. `Toast` é mantido como stub para compat
 * de imports antigos.
 */

// Mapeia { variant, title, description, duration, action } → Sonner.
function emit({ variant = "default", title, description, duration = 5000, action } = {}) {
  const opts = { description, duration }
  if (action && typeof action === "object" && action.label) {
    opts.action = { label: action.label, onClick: action.onClick }
  }

  switch (variant) {
    case "success":
      return sonnerToast.success(title, opts)
    case "warning":
      return sonnerToast.warning(title, opts)
    case "error":
    case "destructive":
      return sonnerToast.error(title, opts)
    case "info":
      return sonnerToast.info(title, opts)
    default:
      return sonnerToast(title, opts)
  }
}

/**
 * useToast — mantém a forma de retorno antiga.
 * `toasts`/`pause`/`resume` viram no-ops (o Sonner gerencia a fila internamente).
 */
export function useToast() {
  return React.useMemo(
    () => ({
      toast: emit,
      dismiss: (id) => sonnerToast.dismiss(id),
      dismissAll: () => sonnerToast.dismiss(),
      toasts: [],
      pause: () => {},
      resume: () => {},
    }),
    []
  )
}

/**
 * ToastProvider — monta o Toaster do Sonner tematizado com os tokens ANEST.
 * Continua aceitando children para não mudar a montagem em main.jsx.
 */
export function ToastProvider({ children }) {
  const { isDark } = useTheme()

  return (
    <>
      {children}
      <SonnerToaster
        theme={isDark ? "dark" : "light"}
        position="top-right"
        richColors
        closeButton
        gap={12}
        offset={{ top: "calc(16px + var(--safe-area-top, 0px))", right: 24 }}
        toastOptions={{
          duration: 5000,
          // Surfaces/cores ficam a cargo do theme + richColors do Sonner;
          // aqui ajustamos só raio e tipografia para a identidade ANEST.
          classNames: {
            toast: cn("rounded-2xl shadow-elevation-3"),
            title: "text-[15px] font-semibold leading-5",
            description: "text-sm leading-5",
            actionButton: "rounded-lg text-xs font-medium",
          },
        }}
      />
    </>
  )
}

/**
 * @deprecated O componente individual de Toast não é mais renderizado (o Sonner
 * cuida disso). Mantido como stub apenas para não quebrar imports legados.
 */
export function Toast() {
  return null
}

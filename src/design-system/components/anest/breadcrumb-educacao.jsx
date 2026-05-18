import * as React from "react"
import { GraduationCap } from "lucide-react"

import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator, BreadcrumbEllipsis } from "@/design-system/components/ui/breadcrumb"
import { useBreakpoint } from "@/design-system/hooks/useMediaQuery"
import { cn } from "@/design-system/utils/tokens"

/**
 * Breadcrumb hierárquico para Educação Continuada.
 * Mobile (<sm): mostra `Educação > … > último` se >2 níveis.
 * Desktop: expande tudo.
 *
 * @param {Array<{label, page, props}>} items
 *   Cada item: { label: 'Trilha X', page: 'trilha-detalhe', props: {trilhaId} }
 *   Último item NÃO recebe page → renderiza como current (aria-current=page).
 */
export function BreadcrumbEducacao({ items = [], onNavigate, className }) {
  const { isMobile } = useBreakpoint()

  if (!items || items.length === 0) return null

  // Prepend root "Educação" se não vier explícito
  const fullItems = items[0]?.page === "educacao-continuada"
    ? items
    : [
        { label: "Educação", page: "educacao-continuada", icon: <GraduationCap className="h-4 w-4" /> },
        ...items,
      ]

  // Mobile collapse: primeiro + … + último-1 + último (se >3)
  const shouldCollapse = isMobile && fullItems.length > 3
  const rendered = shouldCollapse
    ? [fullItems[0], { ellipsis: true }, fullItems[fullItems.length - 2], fullItems[fullItems.length - 1]]
    : fullItems

  return (
    <Breadcrumb className={cn("min-w-0", className)}>
      <BreadcrumbList>
        {rendered.map((item, idx) => {
          const isLast = idx === rendered.length - 1
          const key = item.ellipsis ? `ellipsis-${idx}` : `${item.page || "current"}-${idx}`

          return (
            <React.Fragment key={key}>
              <BreadcrumbItem className={cn(!isLast && isMobile && "max-w-[140px]")}>
                {item.ellipsis ? (
                  <BreadcrumbEllipsis />
                ) : isLast ? (
                  <BreadcrumbPage className="truncate max-w-[200px] md:max-w-none">
                    {item.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    onClick={() => onNavigate?.(item.page, item.props)}
                    icon={item.icon}
                    className="max-w-[140px] md:max-w-none"
                  >
                    {item.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </React.Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

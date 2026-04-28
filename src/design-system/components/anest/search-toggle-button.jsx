import * as React from "react"
import { Search } from "lucide-react"

import { cn } from "@/design-system/utils/tokens"

const SIZE_CLASSES = {
  lg: "h-[44px] w-[44px]",
  md: "h-[40px] w-[40px]",
  sm: "h-9 w-9",
}

const SearchToggleButton = React.forwardRef(function SearchToggleButton(
  {
    active = false,
    onClick,
    controlsId,
    size = "lg",
    className,
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={active ? "Fechar busca" : "Abrir busca"}
      aria-expanded={active}
      aria-controls={controlsId}
      data-slot="anest-search-toggle"
      className={cn(
        "relative inline-flex items-center justify-center rounded-full",
        "bg-card shadow-[0_2px_8px_rgba(0,66,37,0.1)]",
        "dark:bg-card dark:border dark:border-border dark:shadow-[0_4px_12px_rgba(0,0,0,0.3)]",
        active && "border border-primary",
        "transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        SIZE_CLASSES[size] || SIZE_CLASSES.lg,
        className
      )}
      {...props}
    >
      <Search className="h-5 w-5 text-primary" aria-hidden="true" />
    </button>
  )
})

export { SearchToggleButton }

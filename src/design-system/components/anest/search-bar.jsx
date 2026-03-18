import * as React from "react"

import { Search } from "lucide-react"

import { cn } from "@/design-system/utils/tokens"

function SearchBar({
  placeholder = "Buscar...",
  value,
  onChange,
  onSubmit,
  className,
  ...props
}) {
  return (
    <form
      data-slot="anest-search-bar"
      className={cn("mb-6", className)}
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit?.(e)
      }}
    >
      <div
        data-slot="anest-search-bar-control"
        className={cn(
          "flex items-center gap-2",
          "bg-card border border-border rounded-[14px] md:rounded-[16px]",
          "px-3 py-3 md:px-[18px] md:py-[16px] min-h-[48px]",
          "transition-colors duration-200 ease-in-out",
          "focus-within:border-primary",
          "dark:bg-card dark:border-border dark:focus-within:border-primary"
        )}
      >
        <span
          data-slot="anest-search-bar-icon"
          aria-hidden="true"
          className="inline-flex shrink-0 text-primary"
        >
          <Search className="h-5 w-5" />
        </span>

        <input
          type="search"
          enterKeyHint="search"
          data-slot="anest-search-bar-input"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={cn(
            "w-full bg-transparent outline-none",
            "text-base text-[#000000] dark:text-[#FFFFFF]",
            "placeholder:text-muted-foreground dark:placeholder:text-muted-foreground"
          )}
          {...props}
        />
      </div>
      <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
    </form>
  )
}

export { SearchBar }



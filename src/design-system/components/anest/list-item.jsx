import * as React from "react"

import { cn } from "@/design-system/utils/tokens"

function ListItem({
  icon,
  iconBg,
  iconColor,
  iconContainerClassName,
  iconClassName,
  title,
  subtitle,
  value,
  valueColor,
  showDivider = true,
  dividerClassName,
  onClick,
  className,
  ...props
}) {
  const isClickable = typeof onClick === "function"

  return (
    <div
      data-slot="anest-list-item"
      className={cn(
        "flex items-center gap-3 md:gap-[14px] py-3 md:py-[14px] min-h-[56px]",
        showDivider
          ? cn(
              "border-b border-[#F3F4F6] dark:border-[#2A3F36]",
              dividerClassName
            )
          : null,
        isClickable
          ? "cursor-pointer active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          : null,
        className
      )}
      onClick={onClick}
      role={props.role ?? (isClickable ? "button" : undefined)}
      tabIndex={props.tabIndex ?? (isClickable ? 0 : undefined)}
      onKeyDown={(e) => {
        props.onKeyDown?.(e)
        if (!isClickable || e.defaultPrevented) return
        if (e.key === "Enter") onClick(e)
        if (e.key === " ") {
          e.preventDefault()
          onClick(e)
        }
      }}
      {...props}
    >
      <div
        data-slot="anest-list-item-icon-container"
        className={cn(
          "flex h-11 w-11 md:h-12 md:w-12 shrink-0 items-center justify-center rounded-[10px] md:rounded-[12px]",
          iconBg ? null : "bg-[#F3F4F6] dark:bg-[#243530]",
          iconContainerClassName
        )}
        style={iconBg ? { backgroundColor: iconBg } : undefined}
      >
        <span
          data-slot="anest-list-item-icon"
          aria-hidden="true"
          className={cn(
            "inline-flex [&_svg]:h-6 [&_svg]:w-6 [&_svg]:stroke-[1.5]",
            iconColor ? null : "text-[#006837] dark:text-[#2ECC71]",
            iconClassName
          )}
          style={iconColor ? { color: iconColor } : undefined}
        >
          {icon}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div
          data-slot="anest-list-item-title"
          className="truncate text-[14px] md:text-[15px] font-semibold text-[#000000] dark:text-[#FFFFFF]"
        >
          {title}
        </div>
        {subtitle ? (
          <div
            data-slot="anest-list-item-subtitle"
            className="truncate text-[12px] md:text-[13px] text-[#9CA3AF] dark:text-[#6B8178]"
          >
            {subtitle}
          </div>
        ) : null}
      </div>

      {value ? (
        <div
          data-slot="anest-list-item-value"
          className={cn(
            "shrink-0 text-[15px] font-bold",
            valueColor
              ? null
              : "text-[#9BC53D] dark:text-[#2ECC71] dark:drop-shadow-[0_0_6px_rgba(46,204,113,0.35)]"
          )}
          style={valueColor ? { color: valueColor } : undefined}
        >
          {value}
        </div>
      ) : null}
    </div>
  )
}

export { ListItem }



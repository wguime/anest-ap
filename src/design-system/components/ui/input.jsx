import * as React from "react"
import { motion, useAnimation } from "framer-motion"
import { prefersReducedMotion } from "@/design-system/utils/motion"

import { cn } from "@/design-system/utils/tokens"

function DefaultSearchIcon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="size-5"
      {...props}
    >
      <path
        d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="m21 21-4.35-4.35"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

const Input = React.forwardRef(
  (
    {
      className,
      type = "text",
      variant = "default",
      error,
      leftIcon,
      rightIcon,
      label,
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const autoId = React.useId()
    const inputId = id ?? autoId
    const errorId = error ? `${inputId}-error` : undefined

    const computedLeftIcon =
      variant === "search" ? leftIcon ?? <DefaultSearchIcon /> : leftIcon

    const hasError = typeof error === "string" && error.trim().length > 0

    const prevErrorRef = React.useRef(false)
    const shakeControls = useAnimation()

    React.useEffect(() => {
      const wasError = prevErrorRef.current
      prevErrorRef.current = hasError
      if (!wasError && hasError && !prefersReducedMotion()) {
        shakeControls.start({
          x: [0, -6, 6, -4, 4, -2, 2, 0],
          transition: { duration: 0.4 },
        })
      }
    }, [hasError, shakeControls])

    return (
      <motion.div data-slot="input-field" animate={shakeControls} className={cn("grid gap-1.5", className)}>
        {label ? (
          <label
            data-slot="input-label"
            htmlFor={inputId}
            className="text-sm font-medium text-foreground"
          >
            {label}
          </label>
        ) : null}

        <div
          data-slot="input-control"
          data-variant={variant}
          data-state={
            disabled ? "disabled" : hasError ? "error" : "default"
          }
          className={cn(
            // Tokens/specs
            "[--ds-input-radius:16px] [--ds-input-py:16px] [--ds-input-px:18px]",
            // Light/dark via existing theme CSS variables (anest-theme.css)
            "[--ds-input-bg:hsl(var(--card))] [--ds-input-border:hsl(var(--input))]",
            "flex items-center gap-2 rounded-[var(--ds-input-radius)] bg-[var(--ds-input-bg)]",
            "border border-[color:var(--ds-input-border)]",
            "min-h-[44px]", // Touch target mínimo
            "py-[var(--ds-input-py)] px-[var(--ds-input-px)]",
            "transition-colors duration-200 ease-in-out",
            // Focus border (light: #006837 via --primary-hover; dark: #2ECC71 via --primary)
            "focus-within:border-[hsl(var(--primary-hover))] dark:focus-within:border-[hsl(var(--primary))]",
            // Disabled
            disabled ? "opacity-50 cursor-not-allowed" : null,
            // Error (border + message)
            hasError
              ? "border-[hsl(var(--destructive))] focus-within:border-[hsl(var(--destructive))]"
              : null
          )}
        >
          {computedLeftIcon ? (
            <span
              data-slot="input-left-icon"
              aria-hidden="true"
              className="inline-flex shrink-0 text-muted-foreground [&_svg]:shrink-0"
            >
              {computedLeftIcon}
            </span>
          ) : null}

          <input
            data-slot="input"
            id={inputId}
            type={type}
            disabled={disabled}
            aria-invalid={hasError ? true : undefined}
            aria-describedby={hasError ? errorId : undefined}
            ref={ref}
            className={cn(
              "w-full bg-transparent text-base text-foreground outline-none", // 16px (evita zoom iOS)
              "placeholder:text-muted-foreground dark:placeholder:text-[#6B7B74]",
              "disabled:cursor-not-allowed"
            )}
            {...props}
          />

          {rightIcon ? (
            <span
              data-slot="input-right-icon"
              aria-hidden="true"
              className="inline-flex shrink-0 text-muted-foreground [&_svg]:shrink-0"
            >
              {rightIcon}
            </span>
          ) : null}
        </div>

        {hasError ? (
          <p
            data-slot="input-error"
            id={errorId}
            className="text-sm text-[hsl(var(--destructive))]"
          >
            {error}
          </p>
        ) : null}
      </motion.div>
    )
  }
)
Input.displayName = "Input"

export { Input }

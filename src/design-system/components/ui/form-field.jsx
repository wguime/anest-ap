// ANEST Design System - FormField Wrapper Component
// Componente wrapper para padronizar estrutura de campos de formulário

import * as React from "react"
import { AlertCircle } from "lucide-react"
import { cn } from "@/design-system/utils/tokens"

// ============================================================================
// FORM FIELD COMPONENT
// ============================================================================

const FormField = React.forwardRef(
  (
    {
      label,
      required = false,
      error,
      hint,
      children,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const autoId = React.useId()
    const fieldId = id ?? autoId
    const labelId = label ? `${fieldId}-label` : undefined
    const errorId = error ? `${fieldId}-error` : undefined
    const hintId = hint ? `${fieldId}-hint` : undefined

    const hasError = typeof error === "string" && error.trim().length > 0

    // Clone children to inject aria attributes
    const enhancedChildren = React.useMemo(() => {
      return React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          const ariaProps = {}
          
          // Build aria-describedby from hint and error
          const describedByParts = []
          if (hintId) describedByParts.push(hintId)
          if (errorId && hasError) describedByParts.push(errorId)
          
          if (describedByParts.length > 0) {
            ariaProps["aria-describedby"] = describedByParts.join(" ")
          }
          
          if (hasError) {
            ariaProps["aria-invalid"] = true
          }

          return React.cloneElement(child, ariaProps)
        }
        return child
      })
    }, [children, hintId, errorId, hasError])

    return (
      <div
        ref={ref}
        data-slot="form-field"
        className={cn("grid gap-2", className)}
        {...props}
      >
        {/* Label */}
        {label && (
          <label
            id={labelId}
            data-slot="form-field-label"
            className={cn(
              "text-sm font-semibold",
              "text-[#004225] dark:text-[#2ECC71]"
            )}
          >
            {label}
            {required && (
              <span
                className="ml-0.5 text-[#DC2626] dark:text-[#E74C3C]"
                aria-hidden="true"
              >
                *
              </span>
            )}
            {required && (
              <span className="sr-only">(obrigatório)</span>
            )}
          </label>
        )}

        {/* Form Control (children) */}
        <div data-slot="form-field-control">
          {enhancedChildren}
        </div>

        {/* Hint Text */}
        {hint && !hasError && (
          <p
            id={hintId}
            data-slot="form-field-hint"
            className="text-[13px] text-[#9CA3AF] dark:text-[#6B8178]"
          >
            {hint}
          </p>
        )}

        {/* Error Message */}
        {hasError && (
          <p
            id={errorId}
            data-slot="form-field-error"
            className={cn(
              "flex items-center gap-1.5 text-[13px]",
              "text-[#DC2626] dark:text-[#E74C3C]"
            )}
          >
            <AlertCircle size={14} className="shrink-0" />
            {error}
          </p>
        )}
      </div>
    )
  }
)

FormField.displayName = "FormField"

export { FormField }


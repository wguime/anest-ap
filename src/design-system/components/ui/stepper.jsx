import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Check } from "lucide-react"

import { cn } from "@/design-system/utils/tokens"

function StepCircle({ state, index, icon }) {
  const baseClass = "flex h-10 w-10 md:h-8 md:w-8 shrink-0 items-center justify-center rounded-full border-2 border-primary"

  if (state === "completed") {
    return (
      <div className={cn(baseClass, "bg-primary text-primary-foreground")}>
        <AnimatePresence initial={false}>
          <motion.span
            key={`check-${index}`}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="inline-flex"
            aria-hidden="true"
          >
            <Check className="h-4 w-4" />
          </motion.span>
        </AnimatePresence>
      </div>
    )
  }

  if (state === "current") {
    return (
      <div className={cn(baseClass, "bg-primary/10 text-primary")}>
        <span className="text-[14px] font-semibold" aria-hidden="true">
          {icon ?? index + 1}
        </span>
      </div>
    )
  }

  return (
    <div className={cn(baseClass, "bg-transparent text-muted-foreground")}>
      <span className="text-[14px] font-semibold" aria-hidden="true">
        {icon ?? index + 1}
      </span>
    </div>
  )
}

export function Stepper({
  currentStep,
  steps,
  onStepClick,
  orientation = "horizontal",
  variant = "default",
  clickable = false,
  className,
}) {
  const isVertical = orientation === "vertical"
  const isSimple = variant === "simple"

  return (
    <div
      data-slot="stepper"
      data-orientation={orientation}
      data-variant={variant}
      className={cn(isVertical ? "flex flex-col gap-4" : "flex items-center", className)}
    >
      {steps.map((step, idx) => {
        const state = idx < currentStep ? "completed" : idx === currentStep ? "current" : "upcoming"
        const canClick = Boolean(onStepClick) && clickable && idx <= currentStep

        const connectorClass = cn(
          "bg-border",
          isVertical ? "w-0.5 flex-1 ml-[15px]" : "h-0.5 flex-1 min-w-[12px]"
        )

        const StepWrapper = canClick ? "button" : "div"

        return (
          <div
            key={`${step.label}-${idx}`}
            className={cn(isVertical ? "flex items-start gap-3" : "flex items-center flex-1")}
          >
            <StepWrapper
              type={canClick ? "button" : undefined}
              onClick={canClick ? () => onStepClick(idx) : undefined}
              className={cn(
                "flex items-center gap-3 text-left",
                canClick
                  ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-xl"
                  : ""
              )}
              aria-current={state === "current" ? "step" : undefined}
            >
              <StepCircle state={state} index={idx} icon={step.icon} />

              {!isSimple ? (
                <div className={cn(isVertical ? "min-w-0" : "hidden sm:block")}>
                  <div
                    className={cn(
                      "text-[14px] font-semibold",
                      state === "upcoming" ? "text-muted-foreground" : "text-foreground"
                    )}
                  >
                    {step.label}
                  </div>
                  {step.description ? (
                    <div className="mt-1 text-[12px] text-muted-foreground">{step.description}</div>
                  ) : null}
                </div>
              ) : null}
            </StepWrapper>

            {idx < steps.length - 1 ? (
              isVertical ? (
                <div className="flex flex-col">
                  <div className={connectorClass} />
                </div>
              ) : (
                <div className={cn(connectorClass, "mx-3")} aria-hidden="true" />
              )
            ) : null}
          </div>
        )
      })}
    </div>
  )
}



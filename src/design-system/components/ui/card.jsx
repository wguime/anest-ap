import * as React from "react"
import { cva } from "class-variance-authority"

import { cn } from "@/design-system/utils/tokens"

const cardVariants = cva(
  "rounded-lg border bg-card text-card-foreground transition-shadow",
  {
    variants: {
      variant: {
        default: "shadow-elevation-1",
        elevated: "shadow-elevation-2",
        flat: "shadow-none",
        outlined: "shadow-none border-border-strong",
        interactive:
          "shadow-elevation-1 hover:shadow-elevation-2 hover:-translate-y-px active:scale-[0.99] cursor-pointer",
      },
      padding: {
        none: "",
        sm: "p-3",
        md: "p-4",
        lg: "p-6",
      },
    },
    defaultVariants: {
      variant: "default",
      padding: "none",
    },
  }
)

const Card = React.forwardRef(
  ({ className, variant, padding, noPadding, ...props }, ref) => {
    const resolvedPadding = noPadding ? "none" : padding
    return (
      <div
        ref={ref}
        data-slot="card"
        data-variant={variant}
        className={cn(cardVariants({ variant, padding: resolvedPadding }), className)}
        {...props}
      />
    )
  }
)
Card.displayName = "Card"

const CardHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props} />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-2xl font-semibold leading-none tracking-tight", className)}
    {...props} />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props} />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props} />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, cardVariants }

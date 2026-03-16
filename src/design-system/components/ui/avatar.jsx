import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"
import { cva } from "class-variance-authority"
import { User } from "lucide-react"

import { cn } from "@/design-system/utils/tokens"

const avatarVariants = cva(
  "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-bold leading-none transition-[box-shadow] " +
    "bg-gradient-to-br from-[#004225] to-[#006837] text-white shadow-[0_4px_16px_rgba(0,66,37,0.3)] " +
    "dark:from-[#2ECC71] dark:to-[#1E8449] dark:text-[#111916] dark:shadow-[0_4px_16px_rgba(46,204,113,0.3)]",
  {
    variants: {
      size: {
        sm: "h-8 w-8 text-xs",
        md: "h-[44px] w-[44px] text-[16px]",
        lg: "h-[52px] w-[52px] text-[19px]",
        xl: "h-20 w-20 text-[28px]",
      },
    },
    defaultVariants: {
      size: "lg",
    },
  }
)

const avatarIconSize = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
  xl: "h-9 w-9",
}

const AvatarImage = React.forwardRef(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    data-slot="avatar-image"
    className={cn("aspect-square h-full w-full object-cover", className)}
    {...props}
  />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = React.forwardRef(
  ({ className, children, ...props }, ref) => (
    <AvatarPrimitive.Fallback
      ref={ref}
      data-slot="avatar-fallback"
      className={cn("flex h-full w-full items-center justify-center", className)}
      {...props}
    >
      {children}
    </AvatarPrimitive.Fallback>
  )
)
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

function Avatar({
  className,
  size = "lg",
  src,
  alt,
  initials,
  fallback,
  children,
  ...props
}) {
  const hasCustomChildren = children != null && children !== false
  const fallbackContent =
    fallback ??
    (initials ? (
      String(initials).trim().slice(0, 2).toUpperCase()
    ) : (
      <User className={cn("opacity-90", avatarIconSize[size] ?? avatarIconSize.lg)} />
    ))

  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(avatarVariants({ size }), className)}
      {...props}
    >
      {hasCustomChildren ? (
        children
      ) : (
        <>
          {src ? <AvatarImage src={src} alt={alt ?? ""} /> : null}
          <AvatarFallback>{fallbackContent}</AvatarFallback>
        </>
      )}
    </AvatarPrimitive.Root>
  )
}

export { Avatar, AvatarImage, AvatarFallback, avatarVariants }



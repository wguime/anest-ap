// Separator.jsx
// Divisor visual acessível
// Baseado em: Radix UI Separator

import { cn } from "@/design-system/utils/tokens"

/**
 * Separator - Divisor visual horizontal ou vertical
 *
 * Features:
 * - Semântico (role="separator")
 * - Horizontal e vertical
 * - Decorativo ou semântico
 * - Customizável
 *
 * @example
 * <Separator />
 * <Separator orientation="vertical" className="h-6" />
 */

function Separator({
  orientation = 'horizontal',
  decorative = false,
  className,
  ...props
}) {
  const semanticProps = decorative
    ? { 'aria-hidden': true }
    : { role: 'separator', 'aria-orientation': orientation }

  return (
    <div
      data-slot="separator"
      data-orientation={orientation}
      {...semanticProps}
      className={cn(
        "shrink-0",
        // ANEST tokens:
        // - light divider: colors.light.border.default (#C8E6C9)
        // - dark divider: colors.dark.border.default (#2A3F36)
        "bg-[#C8E6C9] dark:bg-[#2A3F36]",
        orientation === 'horizontal' ? "h-px w-full" : "h-full w-px",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
export default Separator

import * as React from "react"
import { motion } from "framer-motion"
import { staggerContainer, staggerItem, prefersReducedMotion } from "@/design-system/utils/motion"

/**
 * StaggerList - Container that staggers the entrance of its children.
 * Pair with <StaggerItem> for each child element.
 *
 * @example
 * <StaggerList>
 *   {items.map(item => (
 *     <StaggerItem key={item.id}>
 *       <MyCard {...item} />
 *     </StaggerItem>
 *   ))}
 * </StaggerList>
 */
export function StaggerList({
  children,
  stagger = 0.05,
  delayChildren = 0.1,
  className,
  ...props
}) {
  const reduced = prefersReducedMotion()
  const variants = React.useMemo(
    () => (reduced ? undefined : staggerContainer(stagger, delayChildren)),
    [stagger, delayChildren, reduced]
  )

  if (reduced) {
    return (
      <div className={className} {...props}>
        {children}
      </div>
    )
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={variants}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
}

/**
 * StaggerItem - Individual item inside a StaggerList.
 * Animates with opacity and y-slide.
 */
export function StaggerItem({ children, className, ...props }) {
  const reduced = prefersReducedMotion()

  if (reduced) {
    return (
      <div className={className} {...props}>
        {children}
      </div>
    )
  }

  return (
    <motion.div variants={staggerItem} className={className} {...props}>
      {children}
    </motion.div>
  )
}

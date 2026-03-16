import { motion } from "framer-motion"
import { durations, prefersReducedMotion } from "@/design-system/utils/motion"

/**
 * FadeIn - Wraps content with a smooth opacity transition.
 * Used for skeleton → content transitions and general entrance animations.
 *
 * @example
 * {isLoading ? <Skeleton /> : <FadeIn><Content /></FadeIn>}
 */
export function FadeIn({ children, duration = durations.slow, delay = 0, className }) {
  const reduced = prefersReducedMotion()
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={reduced ? { duration: 0 } : { duration, delay, ease: [0.4, 0, 0.2, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

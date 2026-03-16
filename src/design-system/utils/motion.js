// ANEST Design System - Motion Constants & Utilities
// Centralizes animation presets for consistency across the app

// ============================================================================
// SPRING PRESETS
// ============================================================================

export const springs = {
  /** Default interactive spring (buttons, taps) */
  default: { type: "spring", stiffness: 400, damping: 25 },
  /** Snappy spring for micro-interactions */
  snappy: { type: "spring", stiffness: 500, damping: 30 },
  /** Gentle spring for entrances */
  gentle: { type: "spring", stiffness: 300, damping: 24 },
  /** Bouncy spring for playful elements (badges, achievements) */
  bouncy: { type: "spring", stiffness: 500, damping: 15 },
}

// ============================================================================
// DURATION PRESETS (seconds)
// ============================================================================

export const durations = {
  fast: 0.15,
  normal: 0.2,
  slow: 0.3,
  entrance: 0.25,
}

// ============================================================================
// PAGE TRANSITION VARIANTS
// ============================================================================

export const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

export const pageTransition = {
  duration: durations.normal,
  ease: [0.4, 0, 0.2, 1],
}

// ============================================================================
// STAGGER UTILITIES
// ============================================================================

/**
 * Creates stagger container variants for orchestrating child animations.
 * @param {number} stagger - Delay between each child (seconds)
 * @param {number} delayChildren - Initial delay before first child (seconds)
 * @returns {object} Framer Motion variants for a parent container
 */
export function staggerContainer(stagger = 0.05, delayChildren = 0.1) {
  return {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: stagger,
        delayChildren,
      },
    },
  }
}

export const staggerItem = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: durations.entrance, ease: [0.4, 0, 0.2, 1] },
  },
}

// ============================================================================
// REDUCED MOTION UTILITY
// ============================================================================

/**
 * Returns a transition object that respects `prefers-reduced-motion`.
 * When reduced motion is active, duration is set to 0.
 * @param {object} transition - The desired transition config
 * @returns {object} The transition (unchanged if motion is OK, zeroed if reduced)
 */
export function safeTransition(transition) {
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return { duration: 0 }
  }
  return transition
}

/**
 * Hook-friendly check for prefers-reduced-motion.
 * Returns true when the user prefers reduced motion.
 */
export function prefersReducedMotion() {
  if (typeof window === "undefined") return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

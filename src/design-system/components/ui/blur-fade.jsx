import * as React from "react"
import { AnimatePresence, motion, useInView } from "framer-motion"

import { prefersReducedMotion } from "@/design-system/utils/motion"

/**
 * <BlurFade> — entrada com blur + fade + slide sutil (Magic UI tokenizado, Fase 4.2).
 *
 * Ideal para stagger de grids (ex.: as 73 calculadoras): envolva cada item e
 * passe `delay={i * 0.04}`. Por padrão anima no mount; passe `inView` para
 * disparar só ao entrar no viewport.
 *
 * Respeita `prefers-reduced-motion`: renderiza os children sem animação.
 *
 * @param {number} [delay=0] - atraso em segundos (use índice * 0.04 p/ stagger)
 * @param {number} [duration=0.4]
 * @param {number} [yOffset=6] - deslocamento vertical inicial (px)
 * @param {string} [blur='6px']
 * @param {boolean} [inView=false] - se true, anima ao entrar no viewport
 */
export function BlurFade({
  children,
  className,
  variant,
  duration = 0.4,
  delay = 0,
  yOffset = 6,
  blur = "6px",
  inView = false,
  inViewMargin = "-50px",
  ...props
}) {
  const ref = React.useRef(null)
  const reduce = prefersReducedMotion()
  const inViewResult = useInView(ref, { once: true, margin: inViewMargin })
  const isInView = !inView || inViewResult

  if (reduce) {
    return (
      <div ref={ref} className={className} {...props}>
        {children}
      </div>
    )
  }

  const defaultVariants = {
    hidden: { y: yOffset, opacity: 0, filter: `blur(${blur})` },
    visible: { y: 0, opacity: 1, filter: "blur(0px)" },
  }

  return (
    <AnimatePresence>
      <motion.div
        ref={ref}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
        exit="hidden"
        variants={variant || defaultVariants}
        transition={{ delay: 0.04 + delay, duration, ease: "easeOut" }}
        className={className}
        {...props}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

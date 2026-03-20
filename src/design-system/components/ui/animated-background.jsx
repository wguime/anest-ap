import * as React from "react"
import { motion, useReducedMotion } from "framer-motion"
import { cn } from "@/design-system/utils/tokens"

/**
 * AnimatedBackground - Fundo animado decorativo
 *
 * Migrado do legado: index.html (CSS circles-animation)
 *
 * @example
 * // Uso na tela de login
 * <AnimatedBackground variant="circles" />
 *
 * // Variante de dots flutuantes
 * <AnimatedBackground variant="dots" />
 *
 * // Variante de gradiente
 * <AnimatedBackground variant="gradient" />
 */

// Circle animation variants
const circleVariants = {
  initial: { scale: 1, opacity: 0.2 },
  animate: (custom) => ({
    scale: [1, 1.2, 1],
    opacity: [0.2, 0.35, 0.2],
    transition: {
      duration: custom.duration || 8,
      repeat: Infinity,
      ease: "easeInOut",
      delay: custom.delay || 0,
    },
  }),
}

// Dot floating variants
const dotVariants = {
  initial: { y: 0, x: 0, opacity: 0.4 },
  animate: (custom) => ({
    y: [0, -20, 0],
    x: [0, custom.xOffset || 10, 0],
    opacity: [0.4, 0.7, 0.4],
    transition: {
      duration: custom.duration || 4,
      repeat: Infinity,
      ease: "easeInOut",
      delay: custom.delay || 0,
    },
  }),
}

/**
 * CirclesAnimation - Círculos concêntricos animados
 * Posicionados diretamente no centro vertical configurável
 * @param {string} className - Classes adicionais
 * @param {string} centerY - Posição vertical do centro (default: "38%")
 */
function CirclesAnimation({ className, centerY = "38%" }) {
  const reducedMotion = useReducedMotion()
  const circles = [
    { size: 800, delay: 0, duration: 10 },
    { size: 600, delay: 0.5, duration: 8 },
    { size: 400, delay: 1, duration: 6 },
    { size: 250, delay: 1.5, duration: 5 },
    { size: 150, delay: 2, duration: 4 },
  ]

  return (
    <div
      className={cn(
        "absolute inset-0 overflow-hidden pointer-events-none",
        className
      )}
    >
      {circles.map((circle, index) => (
        <motion.div
          key={index}
          custom={{ delay: circle.delay, duration: circle.duration }}
          variants={reducedMotion ? undefined : circleVariants}
          initial={reducedMotion ? { scale: 1, opacity: 0.15 } : "initial"}
          animate={reducedMotion ? { scale: 1, opacity: 0.15 } : "animate"}
          className="absolute rounded-full border-2 border-[#2ECC71]/40"
          style={{
            width: circle.size,
            height: circle.size,
            top: centerY,
            left: "50%",
            marginLeft: -circle.size / 2,
            marginTop: -circle.size / 2,
            willChange: "transform, opacity",
          }}
        />
      ))}
    </div>
  )
}

/**
 * DotsAnimation - Pontos flutuantes animados
 */
function DotsAnimation({ count = 12, className }) {
  const reducedMotion = useReducedMotion()
  const dots = React.useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      size: Math.random() * 6 + 4,
      delay: Math.random() * 3,
      duration: Math.random() * 3 + 3,
      xOffset: (Math.random() - 0.5) * 40,
    }))
  }, [count])

  return (
    <div
      className={cn(
        "absolute inset-0 overflow-hidden pointer-events-none",
        className
      )}
    >
      {dots.map((dot) => (
        <motion.div
          key={dot.id}
          custom={{ delay: dot.delay, duration: dot.duration, xOffset: dot.xOffset }}
          variants={reducedMotion ? undefined : dotVariants}
          initial={reducedMotion ? { y: 0, x: 0, opacity: 0.4 } : "initial"}
          animate={reducedMotion ? { y: 0, x: 0, opacity: 0.4 } : "animate"}
          className="absolute rounded-full bg-[#2ECC71]/40"
          style={{
            left: dot.left,
            top: dot.top,
            width: dot.size,
            height: dot.size,
            willChange: "transform, opacity",
          }}
        />
      ))}
    </div>
  )
}

/**
 * GradientAnimation - Fundo com gradiente animado
 */
function GradientAnimation({ className }) {
  return (
    <motion.div
      className={cn(
        "absolute inset-0 pointer-events-none",
        className
      )}
      animate={{
        background: [
          "radial-gradient(circle at 20% 80%, rgba(46, 204, 113, 0.15) 0%, transparent 50%)",
          "radial-gradient(circle at 80% 20%, rgba(46, 204, 113, 0.15) 0%, transparent 50%)",
          "radial-gradient(circle at 50% 50%, rgba(46, 204, 113, 0.15) 0%, transparent 50%)",
          "radial-gradient(circle at 20% 80%, rgba(46, 204, 113, 0.15) 0%, transparent 50%)",
        ],
      }}
      transition={{
        duration: 15,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  )
}

/**
 * MeshAnimation - Mesh gradient animado
 */
function MeshAnimation({ className }) {
  return (
    <div
      className={cn(
        "absolute inset-0 pointer-events-none overflow-hidden",
        className
      )}
    >
      <motion.div
        className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%]"
        animate={{
          rotate: [0, 360],
        }}
        transition={{
          duration: 60,
          repeat: Infinity,
          ease: "linear",
        }}
        style={{
          background: `
            radial-gradient(circle at 30% 30%, rgba(46, 204, 113, 0.1) 0%, transparent 40%),
            radial-gradient(circle at 70% 70%, rgba(0, 66, 37, 0.1) 0%, transparent 40%),
            radial-gradient(circle at 50% 50%, rgba(155, 197, 61, 0.05) 0%, transparent 50%)
          `,
        }}
      />
    </div>
  )
}

/**
 * AnimatedBackground - Container principal
 */
function AnimatedBackground({
  variant = "circles",
  dotCount = 12,
  className,
  ...props
}) {
  return (
    <div
      className={cn(
        "absolute inset-0 overflow-hidden pointer-events-none z-0",
        // Base background color (sempre igual, sem dark mode)
        "bg-gradient-to-br from-[#006837] to-[#00894B]",
        className
      )}
      {...props}
    >
      {variant === "circles" && <CirclesAnimation />}
      {variant === "dots" && <DotsAnimation count={dotCount} />}
      {variant === "gradient" && <GradientAnimation />}
      {variant === "mesh" && <MeshAnimation />}

      {/* Combined variant with circles and dots */}
      {variant === "combined" && (
        <>
          <CirclesAnimation />
          <DotsAnimation count={dotCount} />
        </>
      )}
    </div>
  )
}

export {
  AnimatedBackground,
  CirclesAnimation,
  DotsAnimation,
  GradientAnimation,
  MeshAnimation,
}
export default AnimatedBackground

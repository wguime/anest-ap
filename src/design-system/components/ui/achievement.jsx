// Achievement.jsx
// Sistema de conquistas/badges gamificado
// Baseado em: Xbox Achievements, Steam badges

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from "@/design-system/utils/tokens"

/**
 * Achievement - Sistema de conquistas gamificado
 *
 * Features:
 * - Badges com níveis (bronze, prata, ouro, platina)
 * - Progresso parcial
 * - Animação de desbloqueio
 * - Grid e lista de conquistas
 * - Toast de notificação
 *
 * @example
 * <Achievement
 *   title="Primeira Vitória"
 *   description="Complete seu primeiro quiz"
 *   icon="🏆"
 *   unlocked={true}
 *   tier="gold"
 * />
 */

// Ícones SVG
const LockIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
  </svg>
)

const StarIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
  </svg>
)

const CheckIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <path d="M20 6L9 17l-5-5" />
  </svg>
)

// Configuração de tiers
const TIER_CONFIG = {
  bronze: {
    gradient: 'from-orange-400 to-orange-600',
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    border: 'border-orange-400',
    text: 'text-orange-600 dark:text-orange-400',
    glow: 'shadow-orange-400/50',
    label: 'Bronze'
  },
  silver: {
    gradient: 'from-gray-300 to-gray-500',
    bg: 'bg-gray-100 dark:bg-gray-800/50',
    border: 'border-gray-400',
    text: 'text-gray-600 dark:text-gray-400',
    glow: 'shadow-gray-400/50',
    label: 'Prata'
  },
  gold: {
    gradient: 'from-yellow-400 to-yellow-600',
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    border: 'border-yellow-400',
    text: 'text-yellow-600 dark:text-yellow-400',
    glow: 'shadow-yellow-400/50',
    label: 'Ouro'
  },
  platinum: {
    gradient: 'from-cyan-300 to-cyan-500',
    bg: 'bg-cyan-100 dark:bg-cyan-900/30',
    border: 'border-cyan-400',
    text: 'text-cyan-600 dark:text-cyan-400',
    glow: 'shadow-cyan-400/50',
    label: 'Platina'
  },
  diamond: {
    gradient: 'from-purple-400 to-pink-500',
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    border: 'border-purple-400',
    text: 'text-purple-600 dark:text-purple-400',
    glow: 'shadow-purple-400/50',
    label: 'Diamante'
  }
}

// Helper para verificar se é um elemento React
function isReactElement(element) {
  return element !== null && typeof element === 'object' && element.$$typeof !== undefined
}

// Badge individual
function Achievement({
  title,
  description,
  icon,
  tier = 'gold',
  unlocked = false,
  progress, // { current: 5, total: 10 }
  unlockedAt,
  points = 0,
  rarity, // 'common' | 'rare' | 'epic' | 'legendary'
  onClick,
  size = 'default', // 'small' | 'default' | 'large'
  className,
  ...props
}) {
  const config = TIER_CONFIG[tier] || TIER_CONFIG.gold

  const sizes = {
    small: {
      container: 'p-3',
      icon: 'w-10 h-10',
      iconInner: 'w-5 h-5',
      fontSize: 'text-2xl',
      title: 'text-sm',
      desc: 'text-xs'
    },
    default: {
      container: 'p-3 sm:p-4',
      icon: 'w-12 h-12 sm:w-14 sm:h-14',
      iconInner: 'w-6 h-6',
      fontSize: 'text-2xl sm:text-3xl',
      title: 'text-sm sm:text-base',
      desc: 'text-xs sm:text-sm'
    },
    large: {
      container: 'p-4 sm:p-6',
      icon: 'w-16 h-16 sm:w-20 sm:h-20',
      iconInner: 'w-8 h-8 sm:w-10 sm:h-10',
      fontSize: 'text-4xl sm:text-5xl',
      title: 'text-base sm:text-lg',
      desc: 'text-sm sm:text-base'
    }
  }

  const s = sizes[size]
  const hasProgress = progress && progress.total > 0
  const progressPercent = hasProgress ? (progress.current / progress.total) * 100 : 0

  // Verifica se o ícone é um elemento React (Lucide) ou string (emoji)
  const isLucideIcon = isReactElement(icon)

  return (
    <motion.div
      whileHover={{ scale: unlocked ? 1.02 : 1 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "relative rounded-xl overflow-hidden transition-all cursor-pointer",
        "border-2",
        unlocked
          ? cn(config.border, config.bg)
          : "border-[#E4E4E7] dark:border-[#27272A] bg-[#F4F4F5] dark:bg-[#27272A]",
        unlocked && `shadow-lg ${config.glow}`,
        s.container,
        className
      )}
      {...props}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        {/* Icon/Badge */}
        <div className="relative flex-shrink-0">
          <div className={cn(
            "rounded-full flex items-center justify-center",
            s.icon,
            !isLucideIcon && s.fontSize,
            unlocked
              ? `bg-gradient-to-br ${config.gradient}`
              : "bg-[#E4E4E7] dark:bg-[#3F3F46]"
          )}>
            {unlocked ? (
              isLucideIcon ? (
                <div className={cn("text-white filter drop-shadow-md", s.iconInner)}>
                  {icon}
                </div>
              ) : (
                <span className="filter drop-shadow-md">{icon}</span>
              )
            ) : (
              <LockIcon className="w-1/2 h-1/2 text-[#A1A1AA] dark:text-[#52525B]" />
            )}
          </div>

          {/* Progress ring */}
          {hasProgress && !unlocked && (
            <svg className="absolute inset-0 w-full h-full transform -rotate-90">
              <circle
                cx="50%"
                cy="50%"
                r="45%"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className="text-[#E4E4E7] dark:text-[#3F3F46]"
              />
              <circle
                cx="50%"
                cy="50%"
                r="45%"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${progressPercent * 2.83} 283`}
                className={config.text}
              />
            </svg>
          )}

          {/* Unlocked checkmark */}
          {unlocked && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={cn(
                "absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center",
                `bg-gradient-to-br ${config.gradient}`
              )}
            >
              <CheckIcon className="w-3 h-3 text-white" />
            </motion.div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className={cn(
            "font-semibold truncate",
            s.title,
            unlocked ? "text-[#18181B] dark:text-white" : "text-[#71717A] dark:text-[#A1A1AA]"
          )}>
            {title}
          </h3>

          {description && (
            <p className={cn(
              "mt-0.5 line-clamp-2",
              s.desc,
              "text-[#71717A] dark:text-[#A1A1AA]"
            )}>
              {description}
            </p>
          )}

          {/* Progress bar */}
          {hasProgress && !unlocked && (
            <div className="mt-1.5 sm:mt-2">
              <div className="flex justify-between text-[10px] sm:text-xs text-[#71717A] dark:text-[#A1A1AA] mb-1">
                <span>{progress.current}/{progress.total}</span>
                <span>{Math.round(progressPercent)}%</span>
              </div>
              <div className="h-1 sm:h-1.5 bg-[#E4E4E7] dark:bg-[#3F3F46] rounded-full overflow-hidden">
                <motion.div
                  className={`h-full bg-gradient-to-r ${config.gradient}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          )}

          {/* Meta info */}
          {(points > 0 || unlockedAt) && unlocked && (
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-[#71717A] dark:text-[#A1A1AA]">
              {points > 0 && (
                <span className="flex items-center gap-1">
                  <StarIcon className="w-3 h-3 text-yellow-500" />
                  {points} pts
                </span>
              )}
              {unlockedAt && (
                <span className="hidden sm:inline">
                  {new Date(unlockedAt).toLocaleDateString('pt-BR')}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Tier badge - hidden on very small screens */}
        {unlocked && (
          <div className={cn(
            "hidden xs:block px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium flex-shrink-0",
            config.bg,
            config.text
          )}>
            {config.label}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// Grid de conquistas
function AchievementGrid({
  achievements = [],
  columns = 2,
  showLocked = true,
  onAchievementClick,
  className,
  ...props
}) {
  const filtered = showLocked
    ? achievements
    : achievements.filter(a => a.unlocked)

  // Ordenar: desbloqueadas primeiro, depois por tier
  const sorted = [...filtered].sort((a, b) => {
    if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1
    const tierOrder = ['diamond', 'platinum', 'gold', 'silver', 'bronze']
    return tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier)
  })

  return (
    <div
      className={cn(
        "grid gap-3 sm:gap-4",
        columns === 1 && "grid-cols-1",
        columns === 2 && "grid-cols-1 sm:grid-cols-2",
        columns === 3 && "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3",
        columns === 4 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        className
      )}
      {...props}
    >
      {sorted.map((achievement) => (
        <Achievement
          key={achievement.id}
          {...achievement}
          onClick={() => onAchievementClick?.(achievement)}
        />
      ))}
    </div>
  )
}

// Toast de conquista desbloqueada
function AchievementToast({
  achievement,
  isVisible,
  onClose,
  duration = 5000,
  className,
  ...props
}) {
  const config = TIER_CONFIG[achievement?.tier] || TIER_CONFIG.gold

  // Auto-close
  useState(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(onClose, duration)
      return () => clearTimeout(timer)
    }
  }, [isVisible, duration, onClose])

  return (
    <AnimatePresence>
      {isVisible && achievement && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          className={cn(
            "fixed top-4 left-1/2 -translate-x-1/2 z-50",
            "max-w-sm w-full mx-4",
            className
          )}
          {...props}
        >
          <div className={cn(
            "p-4 rounded-2xl shadow-2xl",
            "bg-gradient-to-r",
            config.gradient,
            "border-2 border-white/20"
          )}>
            {/* Sparkle effects */}
            <div className="absolute inset-0 overflow-hidden rounded-2xl">
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-1 h-1 bg-white rounded-full"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{
                    opacity: [0, 1, 0],
                    scale: [0, 1.5, 0],
                    x: [0, Math.random() * 100 - 50],
                    y: [0, Math.random() * 60 - 30]
                  }}
                  transition={{
                    duration: 1,
                    delay: i * 0.15,
                    repeat: Infinity,
                    repeatDelay: 2
                  }}
                  style={{ left: `${20 + i * 12}%`, top: '50%' }}
                />
              ))}
            </div>

            <div className="relative flex items-center gap-4">
              {/* Icon */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', damping: 10, delay: 0.2 }}
                className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-4xl"
              >
                {achievement.icon}
              </motion.div>

              {/* Content */}
              <div className="flex-1 text-white">
                <p className="text-xs font-medium opacity-80 uppercase tracking-wide">
                  🎉 Conquista Desbloqueada!
                </p>
                <h3 className="font-bold text-lg">
                  {achievement.title}
                </h3>
                {achievement.points > 0 && (
                  <p className="text-sm opacity-90 flex items-center gap-1">
                    <StarIcon className="w-4 h-4" />
                    +{achievement.points} pontos
                  </p>
                )}
              </div>

              {/* Close button */}
              <button
                onClick={onClose}
                className="p-1 rounded-full hover:bg-white/20 transition-colors"
              >
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Resumo de conquistas
function AchievementSummary({
  total,
  unlocked,
  points,
  className,
  ...props
}) {
  const percent = total > 0 ? Math.round((unlocked / total) * 100) : 0

  return (
    <div
      className={cn(
        "p-4 rounded-xl bg-gradient-to-br from-[#16A085]/10 to-[#27AE60]/10",
        "dark:from-[#16A085]/20 dark:to-[#27AE60]/20",
        "border border-[#16A085]/20",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#16A085] to-[#27AE60] flex items-center justify-center">
          <StarIcon className="w-8 h-8 text-white" />
        </div>

        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-[#18181B] dark:text-white">
              {unlocked}
            </span>
            <span className="text-lg text-[#71717A] dark:text-[#A1A1AA]">
              / {total}
            </span>
          </div>
          <p className="text-sm text-[#71717A] dark:text-[#A1A1AA]">
            conquistas desbloqueadas
          </p>

          <div className="mt-2 h-2 bg-[#E4E4E7] dark:bg-[#27272A] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-[#16A085] to-[#27AE60]"
              initial={{ width: 0 }}
              animate={{ width: `${percent}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {points > 0 && (
          <div className="text-right">
            <p className="text-2xl font-bold text-[#F59E0B]">
              {points.toLocaleString()}
            </p>
            <p className="text-xs text-[#71717A] dark:text-[#A1A1AA]">
              pontos bônus
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export { Achievement, AchievementGrid, AchievementToast, AchievementSummary }
export default Achievement

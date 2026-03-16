// Leaderboard.jsx
// Ranking gamificado com animações
// Baseado em: Duolingo, Gaming leaderboards

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from "@/design-system/utils/tokens"

/**
 * Leaderboard - Ranking gamificado
 *
 * Features:
 * - Pódio animado (top 3)
 * - Lista de participantes
 * - Destaque do usuário atual
 * - Filtros por período
 * - Avatares e badges
 * - Animações de entrada
 *
 * @example
 * <Leaderboard
 *   entries={[
 *     { id: '1', name: 'João', score: 1250, avatar: '/avatar.jpg' },
 *     { id: '2', name: 'Maria', score: 1180 },
 *   ]}
 *   currentUserId="2"
 * />
 */

// Ícones SVG
const CrownIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
  </svg>
)

const TrophyIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
  </svg>
)

const MedalIcon = ({ className, place }) => {
  const colors = {
    1: '#FFD700', // Gold
    2: '#C0C0C0', // Silver
    3: '#CD7F32', // Bronze
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill={colors[place] || '#9CA3AF'}>
      <circle cx="12" cy="10" r="6" />
      <path d="M8 15l-2 7 6-3 6 3-2-7" fill={colors[place] || '#9CA3AF'} />
      <text x="12" y="12" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">{place}</text>
    </svg>
  )
}

const ArrowUpIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 14l5-5 5 5z" />
  </svg>
)

const ArrowDownIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 10l5 5 5-5z" />
  </svg>
)

// Formatar número com separador de milhares
function formatNumber(num) {
  return new Intl.NumberFormat('pt-BR').format(num)
}

function Leaderboard({
  entries = [],
  currentUserId,
  title = 'Ranking',
  showPodium = true,
  showTrend = true,
  maxVisible = 10,
  filters = [], // ['day', 'week', 'month', 'all']
  defaultFilter = 'all',
  onFilterChange,
  className,
  ...props
}) {
  const [activeFilter, setActiveFilter] = useState(defaultFilter)

  // Ordenar por pontuação
  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => b.score - a.score)
  }, [entries])

  // Top 3 para pódio
  const podium = sortedEntries.slice(0, 3)

  // Resto da lista
  const restOfList = sortedEntries.slice(showPodium ? 3 : 0, maxVisible)

  // Encontrar posição do usuário atual
  const currentUserPosition = sortedEntries.findIndex(e => e.id === currentUserId)
  const currentUserEntry = currentUserPosition >= 0 ? sortedEntries[currentUserPosition] : null

  const handleFilterChange = (filter) => {
    setActiveFilter(filter)
    onFilterChange?.(filter)
  }

  const filterLabels = {
    day: 'Hoje',
    week: 'Semana',
    month: 'Mês',
    all: 'Geral'
  }

  return (
    <div
      className={cn(
        "bg-card rounded-2xl shadow-lg overflow-hidden",
        "border border-border-strong",
        className
      )}
      {...props}
    >
      {/* Header */}
      <div className="p-3 sm:p-4 border-b border-border bg-muted">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <TrophyIcon className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-500" />
            <h2 className="text-base sm:text-lg font-semibold text-foreground">
              {title}
            </h2>
          </div>

          {/* Filters */}
          {filters.length > 0 && (
            <div className="flex items-center gap-0.5 sm:gap-1 bg-background rounded-lg p-0.5 sm:p-1 overflow-x-auto border border-border">
              {filters.map(filter => (
                <button
                  key={filter}
                  onClick={() => handleFilterChange(filter)}
                  className={cn(
                    "px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-medium rounded-md transition-all whitespace-nowrap min-h-[28px]",
                    activeFilter === filter
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {filterLabels[filter] || filter}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Podium */}
      {showPodium && podium.length >= 3 && (
        <div className="p-3 sm:p-4 lg:p-6 bg-gradient-to-b from-primary/5 to-transparent">
          <div className="flex items-end justify-center gap-2 sm:gap-3 lg:gap-4">
            {/* 2nd Place */}
            <PodiumPlace
              entry={podium[1]}
              place={2}
              isCurrentUser={podium[1]?.id === currentUserId}
            />

            {/* 1st Place */}
            <PodiumPlace
              entry={podium[0]}
              place={1}
              isCurrentUser={podium[0]?.id === currentUserId}
            />

            {/* 3rd Place */}
            <PodiumPlace
              entry={podium[2]}
              place={3}
              isCurrentUser={podium[2]?.id === currentUserId}
            />
          </div>
        </div>
      )}

      {/* List */}
      <div className="divide-y divide-border">
        {restOfList.map((entry, idx) => {
          const position = showPodium ? idx + 4 : idx + 1
          const isCurrentUser = entry.id === currentUserId

          return (
            <LeaderboardEntry
              key={entry.id}
              entry={entry}
              position={position}
              isCurrentUser={isCurrentUser}
              showTrend={showTrend}
            />
          )
        })}
      </div>

      {/* Current user (if not visible) */}
      {currentUserEntry && currentUserPosition >= maxVisible && (
        <div className="border-t-2 border-dashed border-border">
          <div className="px-4 py-2 text-center text-xs text-muted-foreground">
            ...
          </div>
          <LeaderboardEntry
            entry={currentUserEntry}
            position={currentUserPosition + 1}
            isCurrentUser={true}
            showTrend={showTrend}
          />
        </div>
      )}

      {/* Empty state */}
      {entries.length === 0 && (
        <div className="p-8 text-center">
          <TrophyIcon className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">
            Nenhum participante ainda
          </p>
        </div>
      )}
    </div>
  )
}

// Componente do pódio
function PodiumPlace({ entry, place, isCurrentUser }) {
  if (!entry) return null

  const heights = {
    1: 'h-20 sm:h-24 lg:h-28',
    2: 'h-14 sm:h-16 lg:h-20',
    3: 'h-10 sm:h-12 lg:h-16'
  }
  const sizes = {
    1: 'w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20',
    2: 'w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16',
    3: 'w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14'
  }
  const colors = {
    1: 'from-yellow-400 to-yellow-600',
    2: 'from-gray-300 to-gray-500',
    3: 'from-orange-400 to-orange-600'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: place === 1 ? 0.2 : place === 2 ? 0.1 : 0.3 }}
      className="flex flex-col items-center"
    >
      {/* Crown for 1st place */}
      {place === 1 && (
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.4, type: 'spring' }}
        >
          <CrownIcon className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 text-yellow-500 mb-0.5 sm:mb-1" />
        </motion.div>
      )}

      {/* Avatar com posição */}
      <div className={cn(
        "relative rounded-full overflow-hidden border-2 sm:border-4",
        sizes[place],
        place === 1 && "border-yellow-400",
        place === 2 && "border-gray-400",
        place === 3 && "border-orange-400",
        isCurrentUser && "ring-2 sm:ring-4 ring-primary/50"
      )}>
        <div className={cn(
          "w-full h-full flex items-center justify-center text-white font-bold",
          place === 1 ? "text-lg sm:text-xl lg:text-2xl" : "text-sm sm:text-base lg:text-lg",
          `bg-gradient-to-br ${colors[place]}`
        )}>
          {place}º
        </div>
      </div>

      {/* Name */}
      <p className={cn(
        "mt-1 sm:mt-2 text-[10px] sm:text-xs lg:text-sm font-medium truncate max-w-[60px] sm:max-w-[70px] lg:max-w-[80px]",
        isCurrentUser ? "text-primary" : "text-foreground"
      )}>
        {entry.name}
      </p>

      {/* Score */}
      <p className="text-[9px] sm:text-[10px] lg:text-xs text-muted-foreground">
        {formatNumber(entry.score)} pts
      </p>

      {/* Podium base */}
      <div className={cn(
        "w-14 sm:w-16 lg:w-20 mt-1 sm:mt-2 rounded-t-lg bg-gradient-to-b",
        heights[place],
        colors[place]
      )} />
    </motion.div>
  )
}

// Entrada da lista
function LeaderboardEntry({ entry, position, isCurrentUser, showTrend }) {
  const medalColors = {
    1: 'from-yellow-400 to-yellow-600 text-white',
    2: 'from-gray-300 to-gray-500 text-white',
    3: 'from-orange-400 to-orange-600 text-white',
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: position * 0.05 }}
      className={cn(
        "flex items-center gap-3 sm:gap-4 p-3 sm:p-4 transition-colors",
        isCurrentUser && "bg-primary/5"
      )}
    >
      {/* Position — medal for top 3, number for the rest */}
      {position <= 3 ? (
        <div className={cn(
          "w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-bold text-sm sm:text-base bg-gradient-to-br flex-shrink-0",
          medalColors[position]
        )}>
          {position}
        </div>
      ) : (
        <span className="w-8 sm:w-9 text-center font-bold text-sm text-muted-foreground flex-shrink-0">
          {position}
        </span>
      )}

      {/* Trend */}
      {showTrend && entry.trend !== undefined && (
        <div className="w-5 sm:w-6 flex-shrink-0">
          {entry.trend > 0 && (
            <span className="flex items-center text-green-500 text-[10px] sm:text-xs">
              <ArrowUpIcon className="w-3 h-3 sm:w-4 sm:h-4" />
              {entry.trend}
            </span>
          )}
          {entry.trend < 0 && (
            <span className="flex items-center text-red-500 text-[10px] sm:text-xs">
              <ArrowDownIcon className="w-3 h-3 sm:w-4 sm:h-4" />
              {Math.abs(entry.trend)}
            </span>
          )}
          {entry.trend === 0 && (
            <span className="text-muted-foreground/60 text-[10px] sm:text-xs">—</span>
          )}
        </div>
      )}

      {/* Name & badges */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <p className={cn(
            "font-semibold truncate text-sm sm:text-base",
            isCurrentUser ? "text-primary" : "text-foreground"
          )}>
            {entry.name}
          </p>
          {isCurrentUser && (
            <span className="text-[10px] sm:text-xs bg-primary/15 text-primary font-medium px-2 py-0.5 rounded-full flex-shrink-0 border border-primary/20">
              Você
            </span>
          )}
        </div>
        {entry.subtitle && (
          <p className="text-[10px] sm:text-xs text-muted-foreground truncate mt-0.5">
            {entry.subtitle}
          </p>
        )}
      </div>

      {/* Score */}
      <div className="text-right flex-shrink-0">
        <p className={cn(
          "font-bold text-base sm:text-lg",
          isCurrentUser ? "text-primary" : "text-foreground"
        )}>
          {formatNumber(entry.score)}
        </p>
        <p className="text-[10px] sm:text-xs text-muted-foreground">
          pontos
        </p>
      </div>
    </motion.div>
  )
}

// Mini leaderboard para sidebar - sem avatar com letra
function LeaderboardMini({ entries = [], currentUserId, className, ...props }) {
  const sorted = [...entries].sort((a, b) => b.score - a.score).slice(0, 5)

  return (
    <div className={cn("space-y-2", className)} {...props}>
      {sorted.map((entry, idx) => (
        <div
          key={entry.id}
          className={cn(
            "flex items-center gap-2 p-2 rounded-lg",
            entry.id === currentUserId && "bg-primary/5 border border-primary/20"
          )}
        >
          <span className="w-5 text-xs font-bold text-foreground">
            {idx + 1}
          </span>
          <span className={cn(
            "flex-1 text-sm truncate",
            entry.id === currentUserId ? "text-primary font-medium" : "text-foreground"
          )}>
            {entry.name}
          </span>
          <span className="text-xs font-medium text-primary">
            {formatNumber(entry.score)}
          </span>
        </div>
      ))}
    </div>
  )
}

export { Leaderboard, LeaderboardMini }
export default Leaderboard

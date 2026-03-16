// AudioPlayer.jsx
// Player de áudio acessível para podcasts e arquivos de áudio
// Baseado em: React Aria, Howler.js patterns

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from "@/design-system/utils/tokens"

/**
 * AudioPlayer - Player de áudio completo e acessível
 *
 * Features:
 * - Controles de play/pause
 * - Barra de progresso com seeking
 * - Controle de volume
 * - Velocidade de reprodução
 * - Keyboard navigation
 * - ARIA completo
 *
 * @example
 * <AudioPlayer
 *   src="/audio/podcast.mp3"
 *   title="Episódio 1: Introdução"
 *   artist="ANEST Podcast"
 *   artwork="/images/cover.jpg"
 * />
 */

// Ícones SVG inline para evitar dependências externas
const PlayIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
)

const PauseIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
)

const VolumeHighIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
  </svg>
)

const VolumeMuteIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
  </svg>
)

const SkipBackIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
  </svg>
)

const SkipForwardIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
  </svg>
)

const RewindIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" />
  </svg>
)

const ForwardIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
  </svg>
)

// Formatar tempo em mm:ss
function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Velocidades de reprodução disponíveis
const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

function AudioPlayer({
  src,
  title,
  artist,
  artwork,
  className,
  variant = 'default', // 'default' | 'minimal' | 'card'
  showArtwork = true,
  showTitle = true,
  showPlaybackSpeed = true,
  showVolumeControl = true,
  showSkipButtons = false,
  skipSeconds = 10,
  autoPlay = false,
  loop = false,
  initialTime,
  onPlay,
  onPause,
  onEnded,
  onTimeUpdate,
  onError,
  ...props
}) {
  const audioRef = useRef(null)
  const progressRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showVolumeSlider, setShowVolumeSlider] = useState(false)

  // Inicializar áudio
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleLoadedMetadata = () => {
      setDuration(audio.duration)
      setIsLoading(false)
      // Seek to saved position on first load
      if (initialTime > 0) {
        audio.currentTime = initialTime
      }
    }

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
      onTimeUpdate?.(audio.currentTime)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      onEnded?.()
    }

    const handleError = (e) => {
      setError('Erro ao carregar áudio')
      setIsLoading(false)
      onError?.(e)
    }

    const handleCanPlay = () => {
      setIsLoading(false)
      if (autoPlay) {
        audio.play().catch(() => {})
      }
    }

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)
    audio.addEventListener('canplay', handleCanPlay)

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
      audio.removeEventListener('canplay', handleCanPlay)
    }
  }, [src, autoPlay, onTimeUpdate, onEnded, onError])

  // Atualizar volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume
    }
  }, [volume, isMuted])

  // Atualizar velocidade
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate
    }
  }, [playbackRate])

  // Play/Pause
  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
      onPause?.()
    } else {
      audio.play().then(() => {
        setIsPlaying(true)
        onPlay?.()
      }).catch(() => {
        setError('Não foi possível reproduzir')
      })
    }
  }, [isPlaying, onPlay, onPause])

  // Seek
  const handleSeek = useCallback((e) => {
    const audio = audioRef.current
    const progress = progressRef.current
    if (!audio || !progress) return

    const rect = progress.getBoundingClientRect()
    const percent = (e.clientX - rect.left) / rect.width
    const newTime = percent * duration
    audio.currentTime = Math.max(0, Math.min(newTime, duration))
  }, [duration])

  // Skip forward/backward
  const skip = useCallback((seconds) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.max(0, Math.min(audio.currentTime + seconds, duration))
  }, [duration])

  // Toggle mute
  const toggleMute = useCallback(() => {
    setIsMuted(!isMuted)
  }, [isMuted])

  // Cycle playback speed
  const cyclePlaybackSpeed = useCallback(() => {
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackRate)
    const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length
    setPlaybackRate(PLAYBACK_SPEEDS[nextIndex])
  }, [playbackRate])

  // Keyboard controls
  const handleKeyDown = useCallback((e) => {
    switch (e.key) {
      case ' ':
      case 'Enter':
        e.preventDefault()
        togglePlay()
        break
      case 'ArrowLeft':
        e.preventDefault()
        skip(-skipSeconds)
        break
      case 'ArrowRight':
        e.preventDefault()
        skip(skipSeconds)
        break
      case 'ArrowUp':
        e.preventDefault()
        setVolume(v => Math.min(1, v + 0.1))
        break
      case 'ArrowDown':
        e.preventDefault()
        setVolume(v => Math.max(0, v - 0.1))
        break
      case 'm':
        e.preventDefault()
        toggleMute()
        break
    }
  }, [togglePlay, skip, skipSeconds, toggleMute])

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  // Variantes de estilo (mobile-first responsive)
  const variants = {
    default: "bg-[#FFFFFF] dark:bg-[#18181B] rounded-xl p-3 sm:p-4 shadow-sm border border-[#A5D6A7] dark:border-[#27272A]",
    minimal: "bg-transparent p-2",
    card: "bg-gradient-to-br from-[#F0FFF4] to-[#E8F5E9] dark:from-[#16A085]/20 dark:to-[#27AE60]/20 rounded-2xl p-4 sm:p-6 shadow-lg border border-[#A5D6A7]",
  }

  if (error) {
    return (
      <div className={cn(variants[variant], "text-center", className)} {...props}>
        <div className="text-red-500 dark:text-red-400 text-sm">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div
      role="group"
      aria-label={`Player de áudio: ${title || 'Áudio'}`}
      className={cn(variants[variant], className)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      {...props}
    >
      <audio
        ref={audioRef}
        src={src}
        loop={loop}
        preload="metadata"
      />

      <div className="flex items-center gap-3 sm:gap-4">
        {/* Artwork */}
        {showArtwork && artwork && variant !== 'minimal' && (
          <div className="flex-shrink-0 hidden sm:block">
            <motion.div
              className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg overflow-hidden shadow-md"
              animate={{ rotate: isPlaying ? 360 : 0 }}
              transition={{ duration: 3, repeat: isPlaying ? Infinity : 0, ease: "linear" }}
            >
              <img
                src={artwork}
                alt={title || 'Capa do áudio'}
                className="w-full h-full object-cover"
              />
            </motion.div>
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* Title & Artist */}
          {showTitle && (title || artist) && (
            <div className="mb-3">
              {title && (
                <h3 className="text-sm font-semibold text-[#004225] dark:text-white truncate">
                  {title}
                </h3>
              )}
              {artist && (
                <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] truncate">
                  {artist}
                </p>
              )}
            </div>
          )}

          {/* Progress Bar */}
          <div className="mb-2">
            <div
              ref={progressRef}
              role="slider"
              aria-label="Progresso do áudio"
              aria-valuemin={0}
              aria-valuemax={duration}
              aria-valuenow={currentTime}
              aria-valuetext={`${formatTime(currentTime)} de ${formatTime(duration)}`}
              tabIndex={0}
              onClick={handleSeek}
              className="relative h-2 bg-[#A5D6A7] dark:bg-[#27272A] rounded-full cursor-pointer group"
            >
              <motion.div
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#16A085] to-[#27AE60] rounded-full"
                style={{ width: `${progress}%` }}
              />
              <motion.div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white dark:bg-[#18181B] border-2 border-[#16A085] rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ left: `calc(${progress}% - 8px)` }}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-[#6B7280] dark:text-[#A1A1AA]">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-1 sm:gap-2">
            {/* Skip Back */}
            {showSkipButtons && (
              <button
                type="button"
                aria-label={`Voltar ${skipSeconds} segundos`}
                onClick={() => skip(-skipSeconds)}
                className="p-2 sm:p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#6B7280] hover:text-[#16A085] transition-colors"
              >
                <RewindIcon className="w-5 h-5" />
              </button>
            )}

            {/* Play/Pause */}
            <motion.button
              type="button"
              aria-label={isPlaying ? 'Pausar' : 'Reproduzir'}
              onClick={togglePlay}
              disabled={isLoading}
              whileTap={{ scale: 0.95 }}
              className={cn(
                "p-2.5 sm:p-3 rounded-full transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center",
                "bg-gradient-to-r from-[#16A085] to-[#27AE60] text-white shadow-md",
                "hover:from-[#138D75] hover:to-[#229954]",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <motion.div
                  className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-white border-t-transparent rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
              ) : isPlaying ? (
                <PauseIcon className="w-5 h-5 sm:w-6 sm:h-6" />
              ) : (
                <PlayIcon className="w-5 h-5 sm:w-6 sm:h-6" />
              )}
            </motion.button>

            {/* Skip Forward */}
            {showSkipButtons && (
              <button
                type="button"
                aria-label={`Avançar ${skipSeconds} segundos`}
                onClick={() => skip(skipSeconds)}
                className="p-2 sm:p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#6B7280] hover:text-[#16A085] transition-colors"
              >
                <ForwardIcon className="w-5 h-5" />
              </button>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Playback Speed */}
            {showPlaybackSpeed && (
              <button
                type="button"
                aria-label={`Velocidade: ${playbackRate}x. Clique para alterar`}
                onClick={cyclePlaybackSpeed}
                className={cn(
                  "px-2 py-1 text-xs font-medium rounded transition-colors min-h-[44px] flex items-center",
                  "text-[#6B7280] hover:text-[#16A085]",
                  "hover:bg-[#16A085]/10"
                )}
              >
                {playbackRate}x
              </button>
            )}

            {/* Volume - hidden on mobile, click on mobile to toggle mute */}
            {showVolumeControl && (
              <div className="relative">
                <button
                  type="button"
                  aria-label={isMuted ? 'Ativar som' : 'Silenciar'}
                  onClick={toggleMute}
                  onMouseEnter={() => setShowVolumeSlider(true)}
                  className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#6B7280] hover:text-[#16A085] transition-colors"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeMuteIcon className="w-5 h-5" />
                  ) : (
                    <VolumeHighIcon className="w-5 h-5" />
                  )}
                </button>

                <AnimatePresence>
                  {showVolumeSlider && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      onMouseLeave={() => setShowVolumeSlider(false)}
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-[#FFFFFF] dark:bg-[#27272A] rounded-lg shadow-lg border border-[#A5D6A7] dark:border-[#3F3F46]"
                    >
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={isMuted ? 0 : volume}
                        onChange={(e) => {
                          setVolume(parseFloat(e.target.value))
                          setIsMuted(false)
                        }}
                        aria-label="Volume"
                        className="w-24 h-2 appearance-none bg-[#A5D6A7] dark:bg-[#3F3F46] rounded-full cursor-pointer
                          [&::-webkit-slider-thumb]:appearance-none
                          [&::-webkit-slider-thumb]:w-3
                          [&::-webkit-slider-thumb]:h-3
                          [&::-webkit-slider-thumb]:bg-[#16A085]
                          [&::-webkit-slider-thumb]:rounded-full
                          [&::-webkit-slider-thumb]:cursor-pointer"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Mini player para listas
function AudioPlayerMini({ src, title, onPlay, className, ...props }) {
  return (
    <AudioPlayer
      src={src}
      title={title}
      variant="minimal"
      showArtwork={false}
      showPlaybackSpeed={false}
      showVolumeControl={false}
      onPlay={onPlay}
      className={className}
      {...props}
    />
  )
}

export { AudioPlayer, AudioPlayerMini }
export default AudioPlayer

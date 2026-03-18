// VideoPlayer.jsx
// Player de vídeo responsivo e acessível
// Suporta: vídeo local, YouTube, Vimeo

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from "@/design-system/utils/tokens"

/**
 * VideoPlayer - Player de vídeo completo e acessível
 *
 * Features:
 * - Suporte a vídeo local e embed (YouTube, Vimeo)
 * - Controles customizados
 * - Picture-in-Picture
 * - Fullscreen
 * - Keyboard navigation
 * - ARIA completo
 *
 * @example
 * <VideoPlayer
 *   src="/video/tutorial.mp4"
 *   poster="/images/thumbnail.jpg"
 *   title="Tutorial de Segurança"
 * />
 *
 * // YouTube embed
 * <VideoPlayer
 *   type="youtube"
 *   videoId="dQw4w9WgXcQ"
 *   title="Vídeo Tutorial"
 * />
 */

// Ícones SVG inline
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

const FullscreenIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
  </svg>
)

const ExitFullscreenIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
  </svg>
)

const PipIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z" />
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

const SettingsIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
  </svg>
)

// Formatar tempo em mm:ss ou hh:mm:ss
function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00'
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Componente de controle de volume
// Mobile: botão muta/desmuta (padrão YouTube). Desktop: slider horizontal + mute.
function VolumeControl({ volume, isMuted, onVolumeChange, onMuteToggle }) {
  return (
    <div className="relative flex items-center">
      {/* Botão de volume — clique sempre muta/desmuta */}
      <button
        type="button"
        aria-label={isMuted ? 'Ativar som' : 'Silenciar'}
        onClick={onMuteToggle}
        className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-white hover:text-[#16A085] transition-colors rounded-lg active:bg-white/10"
      >
        {isMuted || volume === 0 ? (
          <VolumeMuteIcon className="w-5 h-5" />
        ) : (
          <VolumeHighIcon className="w-5 h-5" />
        )}
      </button>

      {/* Slider horizontal (desktop only) */}
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={isMuted ? 0 : volume}
        onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
        className="hidden sm:block w-16 appearance-none h-1 bg-white/30 rounded-full cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-3
          [&::-webkit-slider-thumb]:h-3
          [&::-webkit-slider-thumb]:bg-white
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:cursor-pointer"
      />
    </div>
  )
}

// Extrair ID do YouTube
function getYouTubeId(url) {
  const match = url?.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)
  return match ? match[1] : url
}

// Extrair ID do Vimeo
function getVimeoId(url) {
  const match = url?.match(/(?:vimeo\.com\/)(\d+)/)
  return match ? match[1] : url
}

function VideoPlayer({
  src,
  type = 'video', // 'video' | 'youtube' | 'vimeo'
  videoId,
  poster,
  title,
  className,
  aspectRatio = '16/9',
  autoPlay = false,
  loop = false,
  muted = false,
  controls = true,
  showPip = true,
  showFullscreen = true,
  showPlaybackSpeed = true,
  preventFastForward = false,
  initialTime,
  onPlay,
  onPause,
  onEnded,
  onTimeUpdate,
  onDurationChange,
  onError,
  ...props
}) {
  const containerRef = useRef(null)
  const videoRef = useRef(null)
  const iframeRef = useRef(null)
  const progressRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(muted ? 0 : 1)
  const [isMuted, setIsMuted] = useState(muted)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [showSettings, setShowSettings] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [ffToast, setFfToast] = useState(false)
  const hideControlsTimeout = useRef(null)
  const isPlayingRef = useRef(false)
  const maxWatchedTimeRef = useRef(initialTime > 0 ? initialTime : 0)

  // Keep callback refs stable so the postMessage listener never tears down
  const callbacksRef = useRef({ onPlay, onPause, onEnded, onTimeUpdate, onDurationChange })
  useEffect(() => {
    callbacksRef.current = { onPlay, onPause, onEnded, onTimeUpdate, onDurationChange }
  })

  // Keep isPlayingRef in sync
  useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])

  // Mobile detection (touch device) — for bottom sheet UI
  const [isMobile, setIsMobile] = useState(false)
  const [portalTarget, setPortalTarget] = useState(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(hover: none) and (pointer: coarse)')
    setIsMobile(mql.matches)
    const handler = (e) => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return
    setPortalTarget(isFullscreen && containerRef.current ? containerRef.current : document.body)
  }, [isFullscreen])

  // Lock scroll when mobile bottom sheet is open
  useEffect(() => {
    if (!showSettings || !isMobile) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [showSettings, isMobile])


  // Embed URLs
  const resolvedYouTubeId = type === 'youtube' ? getYouTubeId(videoId || src) : null
  const resolvedVimeoId = type === 'vimeo' ? getVimeoId(videoId || src) : null
  const embedOrigin = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : ''
  const ytStartParam = type === 'youtube' && initialTime > 0 ? `&start=${Math.floor(initialTime)}` : ''
  const vimeoTimeFragment = type === 'vimeo' && initialTime > 0 ? `#t=${Math.floor(initialTime)}s` : ''
  const embedUrl = type === 'youtube' && resolvedYouTubeId
    ? `https://www.youtube.com/embed/${resolvedYouTubeId}?autoplay=${autoPlay ? 1 : 0}&controls=0&disablekb=1&rel=0&playsinline=1&fs=0&enablejsapi=1&iv_load_policy=3${embedOrigin ? `&origin=${embedOrigin}` : ''}${ytStartParam}`
    : type === 'vimeo' && resolvedVimeoId
    ? `https://player.vimeo.com/video/${resolvedVimeoId}?autoplay=${autoPlay ? 1 : 0}&controls=0&playsinline=1&dnt=1&title=0&byline=0&portrait=0&api=1${embedOrigin ? `&origin=${embedOrigin}` : ''}${vimeoTimeFragment}`
    : null

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current
    if (!video || type !== 'video') return

    const handleLoadedMetadata = () => {
      setDuration(video.duration)
      setIsLoading(false)
      onDurationChange?.(video.duration)
      // Seek to saved position on first load
      if (initialTime > 0) {
        video.currentTime = initialTime
      }
    }

    const handleTimeUpdate = () => {
      // Fast-forward prevention for native video
      if (preventFastForward && video.currentTime > maxWatchedTimeRef.current + 5) {
        video.currentTime = maxWatchedTimeRef.current
        setFfToast(true)
        return
      }
      if (video.currentTime > maxWatchedTimeRef.current) {
        maxWatchedTimeRef.current = video.currentTime
      }
      setCurrentTime(video.currentTime)
      onTimeUpdate?.(video.currentTime)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      onEnded?.()
    }

    const handleError = (e) => {
      setIsLoading(false)
      onError?.(e)
    }

    const handleCanPlay = () => {
      setIsLoading(false)
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('ended', handleEnded)
    video.addEventListener('error', handleError)
    video.addEventListener('canplay', handleCanPlay)

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('error', handleError)
      video.removeEventListener('canplay', handleCanPlay)
    }
  }, [src, type, onTimeUpdate, onEnded, onError])

  // YouTube postMessage API — listen for state changes and time updates
  useEffect(() => {
    if (type !== 'youtube' || !resolvedYouTubeId) return

    let ytDuration = 0
    let lastInfoTime = -1

    const sendListening = () => {
      const iframe = iframeRef.current
      if (!iframe?.contentWindow) return
      try {
        iframe.contentWindow.postMessage(
          JSON.stringify({ event: 'listening' }),
          'https://www.youtube.com'
        )
      } catch { /* iframe not ready yet */ }
    }

    const handleMessage = (event) => {
      if (!event.origin || !event.origin.includes('youtube.com')) return

      let data
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
      } catch { return }

      if (!data?.event) return

      if (data.event === 'onStateChange') {
        // States: 0=ENDED, 1=PLAYING, 2=PAUSED, 3=BUFFERING
        if (data.info === 1) {
          setIsPlaying(true); setIsLoading(false); callbacksRef.current.onPlay?.()
          // Restore pointer-events after iOS fallback
          if (iframeRef.current) iframeRef.current.style.pointerEvents = 'none'
        }
        else if (data.info === 2) { setIsPlaying(false); callbacksRef.current.onPause?.() }
        else if (data.info === 0) {
          setIsPlaying(false)
          // Send final time update at full duration before ending
          if (ytDuration > 0) { setCurrentTime(ytDuration); callbacksRef.current.onTimeUpdate?.(ytDuration) }
          callbacksRef.current.onEnded?.()
        }
        // Note: don't set isLoading on BUFFERING (3) — causes persistent spinner during playback
      }

      // iOS Safari fallback: autoplay blocked, let user tap iframe directly
      if (data.event === 'onAutoplayBlocked') {
        if (iframeRef.current) iframeRef.current.style.pointerEvents = 'auto'
        setIsLoading(false)
      }

      if (data.event === 'infoDelivery' && data.info) {
        if (data.info.duration > 0 && ytDuration === 0) {
          ytDuration = data.info.duration
          setDuration(data.info.duration)
          callbacksRef.current.onDurationChange?.(data.info.duration)
        } else if (data.info.duration > 0) {
          ytDuration = data.info.duration
          setDuration(data.info.duration)
        }

        // Sync playing state from infoDelivery playerState (robust fallback)
        if (typeof data.info.playerState === 'number') {
          if (data.info.playerState === 1 && !isPlayingRef.current) {
            setIsPlaying(true); setIsLoading(false); callbacksRef.current.onPlay?.()
          } else if ((data.info.playerState === 2 || data.info.playerState === 0) && isPlayingRef.current) {
            setIsPlaying(false)
            if (data.info.playerState === 0) callbacksRef.current.onEnded?.()
            else callbacksRef.current.onPause?.()
          }
        }

        if (typeof data.info.currentTime === 'number' && ytDuration > 0) {
          // Detect playing from advancing currentTime (ultimate fallback)
          if (lastInfoTime >= 0 && data.info.currentTime > lastInfoTime + 0.25 && !isPlayingRef.current) {
            setIsPlaying(true); setIsLoading(false); callbacksRef.current.onPlay?.()
          }
          lastInfoTime = data.info.currentTime

          setCurrentTime(data.info.currentTime)
          setIsLoading(false)
          if (data.info.currentTime > maxWatchedTimeRef.current) {
            maxWatchedTimeRef.current = data.info.currentTime
          }
          callbacksRef.current.onTimeUpdate?.(data.info.currentTime)
        }
      }
    }

    window.addEventListener('message', handleMessage)

    // Send "listening" when iframe loads, with retries for race conditions
    const iframe = iframeRef.current
    const retryTimers = []
    const handleLoad = () => {
      sendListening()
      retryTimers.push(
        setTimeout(sendListening, 500),
        setTimeout(sendListening, 1500),
        setTimeout(sendListening, 3000)
      )
    }
    iframe?.addEventListener('load', handleLoad)

    return () => {
      window.removeEventListener('message', handleMessage)
      iframe?.removeEventListener('load', handleLoad)
      retryTimers.forEach(clearTimeout)
    }
  }, [type, resolvedYouTubeId])

  // Vimeo postMessage API — listen for state changes and time updates
  useEffect(() => {
    if (type !== 'vimeo' || !resolvedVimeoId) return

    let vimeoDuration = 0

    const sendVimeoMethod = (method, value) => {
      const iframe = iframeRef.current
      if (!iframe?.contentWindow) return
      try {
        const msg = value !== undefined
          ? JSON.stringify({ method, value })
          : JSON.stringify({ method })
        iframe.contentWindow.postMessage(msg, 'https://player.vimeo.com')
      } catch { /* iframe not ready */ }
    }

    const handleMessage = (event) => {
      if (!event.origin || !event.origin.includes('vimeo.com')) return

      let data
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
      } catch { return }

      if (!data?.event) return

      if (data.event === 'ready') {
        // Subscribe to events
        sendVimeoMethod('addEventListener', 'playProgress')
        sendVimeoMethod('addEventListener', 'play')
        sendVimeoMethod('addEventListener', 'pause')
        sendVimeoMethod('addEventListener', 'finish')
        sendVimeoMethod('addEventListener', 'loadProgress')
        sendVimeoMethod('getDuration')
        setIsLoading(false)
      }

      if (data.event === 'play') {
        setIsPlaying(true); setIsLoading(false); callbacksRef.current.onPlay?.()
      }

      if (data.event === 'pause') {
        setIsPlaying(false); callbacksRef.current.onPause?.()
      }

      if (data.event === 'finish') {
        setIsPlaying(false)
        if (vimeoDuration > 0) { setCurrentTime(vimeoDuration); callbacksRef.current.onTimeUpdate?.(vimeoDuration) }
        callbacksRef.current.onEnded?.()
      }

      if (data.event === 'playProgress' && data.data) {
        const seconds = parseFloat(data.data.seconds)
        const dur = parseFloat(data.data.duration)
        if (dur > 0 && vimeoDuration === 0) {
          vimeoDuration = dur
          setDuration(dur)
          callbacksRef.current.onDurationChange?.(dur)
        } else if (dur > 0) {
          vimeoDuration = dur
          setDuration(dur)
        }
        if (!isNaN(seconds)) {
          if (seconds > maxWatchedTimeRef.current) {
            maxWatchedTimeRef.current = seconds
          }
          setCurrentTime(seconds)
          setIsLoading(false)
          callbacksRef.current.onTimeUpdate?.(seconds)
        }
      }

      // getDuration response
      if (data.method === 'getDuration' && data.value > 0 && vimeoDuration === 0) {
        vimeoDuration = data.value
        setDuration(data.value)
        callbacksRef.current.onDurationChange?.(data.value)
      }
    }

    window.addEventListener('message', handleMessage)

    const iframe = iframeRef.current
    const retryTimers = []
    const handleLoad = () => {
      // Vimeo sends 'ready' event automatically, but we retry getDuration just in case
      retryTimers.push(
        setTimeout(() => sendVimeoMethod('getDuration'), 1000),
        setTimeout(() => sendVimeoMethod('getDuration'), 3000)
      )
    }
    iframe?.addEventListener('load', handleLoad)

    return () => {
      window.removeEventListener('message', handleMessage)
      iframe?.removeEventListener('load', handleLoad)
      retryTimers.forEach(clearTimeout)
    }
  }, [type, resolvedVimeoId])

  // Send command to Vimeo iframe via postMessage
  const sendVimeoCommand = useCallback((method, value) => {
    const iframe = iframeRef.current
    if (!iframe?.contentWindow) return
    try {
      const msg = value !== undefined
        ? JSON.stringify({ method, value })
        : JSON.stringify({ method })
      iframe.contentWindow.postMessage(msg, 'https://player.vimeo.com')
    } catch { /* iframe not ready */ }
  }, [])

  // Send command to YouTube iframe via postMessage
  const sendYTCommand = useCallback((func, args) => {
    const iframe = iframeRef.current
    if (!iframe?.contentWindow) return
    try {
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func, args: args || [] }),
        'https://www.youtube.com'
      )
    } catch { /* iframe not ready */ }
  }, [])

  // Volume sync
  useEffect(() => {
    if (type === 'youtube') {
      if (isMuted) sendYTCommand('mute')
      else {
        sendYTCommand('unMute')
        sendYTCommand('setVolume', [Math.round(volume * 100)])
      }
    } else if (type === 'vimeo') {
      sendVimeoCommand('setVolume', isMuted ? 0 : volume)
    } else if (videoRef.current && type === 'video') {
      videoRef.current.volume = isMuted ? 0 : volume
    }
  }, [volume, isMuted, type, sendYTCommand, sendVimeoCommand])

  // Playback rate sync
  useEffect(() => {
    if (type === 'youtube') sendYTCommand('setPlaybackRate', [playbackRate])
    else if (type === 'vimeo') sendVimeoCommand('setPlaybackRate', playbackRate)
    else if (videoRef.current && type === 'video') videoRef.current.playbackRate = playbackRate
  }, [playbackRate, type, sendYTCommand, sendVimeoCommand])

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Auto-hide controls (ref-based to avoid stale closures)
  const scheduleHideControls = useCallback(() => {
    if (hideControlsTimeout.current) clearTimeout(hideControlsTimeout.current)
    setShowControls(true)
    hideControlsTimeout.current = setTimeout(() => {
      if (isPlayingRef.current) setShowControls(false)
    }, 3000)
  }, [])

  // Auto-hide when playback starts, show when paused
  useEffect(() => {
    if (isPlaying) {
      hideControlsTimeout.current = setTimeout(() => {
        setShowControls(false)
      }, 3000)
    } else {
      setShowControls(true)
      if (hideControlsTimeout.current) clearTimeout(hideControlsTimeout.current)
    }
    return () => { if (hideControlsTimeout.current) clearTimeout(hideControlsTimeout.current) }
  }, [isPlaying])

  // Auto-dismiss fast-forward toast
  useEffect(() => {
    if (!ffToast) return
    const timer = setTimeout(() => setFfToast(false), 3000)
    return () => clearTimeout(timer)
  }, [ffToast])

  // Play/Pause
  const togglePlay = useCallback(() => {
    if (type === 'youtube') {
      if (isPlaying) sendYTCommand('pauseVideo')
      else sendYTCommand('playVideo')
      return
    }

    if (type === 'vimeo') {
      if (isPlaying) sendVimeoCommand('pause')
      else sendVimeoCommand('play')
      return
    }

    const video = videoRef.current
    if (!video || type !== 'video') return

    if (isPlaying) {
      video.pause()
      setIsPlaying(false)
      onPause?.()
    } else {
      video.play().then(() => {
        setIsPlaying(true)
        onPlay?.()
      }).catch(() => {})
    }
  }, [isPlaying, type, onPlay, onPause, sendYTCommand, sendVimeoCommand])

  // Seek
  const handleSeek = useCallback((e) => {
    const progress = progressRef.current
    if (!progress) return

    const rect = progress.getBoundingClientRect()
    const clientX = e.touches?.[0]?.clientX ?? e.clientX
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    let newTime = percent * duration

    // Fast-forward prevention
    if (preventFastForward && newTime > maxWatchedTimeRef.current + 5) {
      newTime = maxWatchedTimeRef.current
      setFfToast(true)
    }

    if (type === 'youtube') {
      sendYTCommand('seekTo', [newTime, true])
      setCurrentTime(newTime)
      return
    }

    if (type === 'vimeo') {
      sendVimeoCommand('seekTo', newTime)
      setCurrentTime(newTime)
      return
    }

    const video = videoRef.current
    if (!video || type !== 'video') return
    video.currentTime = Math.max(0, Math.min(newTime, duration))
  }, [duration, type, preventFastForward, sendYTCommand, sendVimeoCommand])

  // Toggle fullscreen
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return

    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen()
    } else {
      await document.exitFullscreen()
    }
  }, [])

  // Toggle PiP
  const togglePip = useCallback(async () => {
    const video = videoRef.current
    if (!video || type !== 'video') return

    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture()
    } else if (document.pictureInPictureEnabled) {
      await video.requestPictureInPicture()
    }
  }, [type])

  // Keyboard controls
  const handleKeyDown = useCallback((e) => {
    if (type !== 'video' && type !== 'youtube' && type !== 'vimeo') return

    switch (e.key) {
      case ' ':
      case 'k':
        e.preventDefault()
        togglePlay()
        break
      case 'ArrowLeft':
        e.preventDefault()
        if (type === 'youtube') {
          const newTime = Math.max(0, currentTime - 10)
          sendYTCommand('seekTo', [newTime, true])
          setCurrentTime(newTime)
        } else if (type === 'vimeo') {
          const newTime = Math.max(0, currentTime - 10)
          sendVimeoCommand('seekTo', newTime)
          setCurrentTime(newTime)
        } else if (videoRef.current) {
          videoRef.current.currentTime -= 10
        }
        break
      case 'ArrowRight': {
        e.preventDefault()
        let newTime = Math.min(duration, currentTime + 10)
        if (preventFastForward && newTime > maxWatchedTimeRef.current + 5) {
          newTime = maxWatchedTimeRef.current
          setFfToast(true)
        }
        if (type === 'youtube') {
          sendYTCommand('seekTo', [newTime, true])
          setCurrentTime(newTime)
        } else if (type === 'vimeo') {
          sendVimeoCommand('seekTo', newTime)
          setCurrentTime(newTime)
        } else if (videoRef.current) {
          videoRef.current.currentTime = newTime
        }
        break
      }
      case 'ArrowUp':
        e.preventDefault()
        setVolume(v => Math.min(1, v + 0.1))
        break
      case 'ArrowDown':
        e.preventDefault()
        setVolume(v => Math.max(0, v - 0.1))
        break
      case 'f':
        e.preventDefault()
        toggleFullscreen()
        break
      case 'm':
        e.preventDefault()
        setIsMuted(m => !m)
        break
    }
  }, [type, togglePlay, toggleFullscreen, sendYTCommand, sendVimeoCommand, currentTime, duration, preventFastForward])

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  // --- Shared overlay elements (reused in native video and YouTube) ---

  const loadingSpinner = isLoading && (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 rounded-xl">
      <motion.div
        className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        style={{ willChange: "transform" }}
      />
    </div>
  )

  const controlsVisible = showControls || !isPlaying

  // Fast-forward prevention toast
  const renderFfToast = () => ffToast && (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2 bg-black/80 text-white text-sm rounded-lg whitespace-nowrap">
      Nao e permitido avancar. Assista o video na sequencia.
    </div>
  )

  // Inline controls overlay builder (CSS transition instead of AnimatePresence)
  const renderControlsOverlay = () => controls && (
    <div
      className="absolute bottom-0 left-0 right-0 z-20 px-3 pb-2 pt-8
                 bg-gradient-to-t from-black/80 to-transparent
                 rounded-b-xl transition-opacity duration-300"
      style={{ opacity: controlsVisible ? 1 : 0, pointerEvents: controlsVisible ? 'auto' : 'none' }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Progress bar */}
      <div
        ref={progressRef}
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progresso do video"
        onClick={handleSeek}
        onTouchStart={handleSeek}
        className="relative h-1 mb-2 bg-white/30 rounded-full cursor-pointer group/progress hover:h-2 transition-all"
      >
        <div
          className="absolute top-0 left-0 h-full bg-[#16A085] rounded-full"
          style={{ width: `${progress}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover/progress:opacity-100 transition-opacity"
          style={{ left: `calc(${progress}% - 6px)` }}
        />
      </div>

      <div className="flex items-center gap-1">
        {/* Play/Pause */}
        <button
          type="button"
          aria-label={isPlaying ? 'Pausar' : 'Reproduzir'}
          onClick={togglePlay}
          className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center text-white hover:text-[#16A085] transition-colors"
        >
          {isPlaying ? (
            <PauseIcon className="w-6 h-6" />
          ) : (
            <PlayIcon className="w-6 h-6" />
          )}
        </button>

        {/* Volume */}
        <VolumeControl
          volume={volume}
          isMuted={isMuted}
          onVolumeChange={(newVolume) => {
            setVolume(newVolume)
            setIsMuted(false)
          }}
          onMuteToggle={() => setIsMuted(!isMuted)}
        />

        {/* Time */}
        <span className="text-xs text-white/80 font-mono">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Settings */}
        {showPlaybackSpeed && (
          <div className="relative">
            <button
              type="button"
              aria-label="Configurações"
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center text-white hover:text-[#16A085] transition-colors"
            >
              <SettingsIcon className="w-5 h-5" />
            </button>

            {/* Desktop: inline dropdown */}
            {!isMobile && (
              <AnimatePresence>
                {showSettings && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-full right-0 mb-2 p-2 bg-black/90 rounded-lg min-w-[120px]"
                  >
                    <p className="text-xs text-white/60 mb-1 px-2">Velocidade</p>
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map(speed => (
                      <button
                        key={speed}
                        onClick={() => {
                          setPlaybackRate(speed)
                          setShowSettings(false)
                        }}
                        className={cn(
                          "block w-full text-left px-2 py-1 text-sm rounded transition-colors",
                          playbackRate === speed
                            ? "bg-[#16A085] text-white"
                            : "text-white/80 hover:bg-white/10"
                        )}
                      >
                        {speed === 1 ? 'Normal' : `${speed}x`}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            )}

            {/* Mobile: bottom sheet via portal (YouTube pattern) */}
            {isMobile && showSettings && portalTarget && createPortal(
              <AnimatePresence>
                <motion.div
                  key="settings-sheet-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="fixed inset-0 z-[1200] bg-black/60"
                  onClick={() => setShowSettings(false)}
                >
                  <motion.div
                    key="settings-sheet"
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                    className="absolute bottom-0 left-0 right-0 bg-[#1a1a1a] rounded-t-2xl pb-[env(safe-area-inset-bottom,8px)]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Handle bar */}
                    <div className="flex justify-center pt-3 pb-2">
                      <div className="w-10 h-1 bg-white/30 rounded-full" />
                    </div>

                    {/* Title */}
                    <div className="px-5 pb-3">
                      <h3 className="text-white text-base font-semibold">Velocidade de reprodução</h3>
                    </div>

                    {/* Speed pills (YouTube style) */}
                    <div className="px-5 pb-5 flex flex-wrap gap-2">
                      {[0.5, 0.75, 1, 1.25, 1.5, 2].map(speed => (
                        <button
                          key={speed}
                          onClick={() => {
                            setPlaybackRate(speed)
                            setShowSettings(false)
                          }}
                          className={cn(
                            "px-4 py-2.5 rounded-full text-sm font-medium transition-colors min-w-[56px]",
                            playbackRate === speed
                              ? "bg-[#16A085] text-white"
                              : "bg-white/10 text-white/80 active:bg-white/20"
                          )}
                        >
                          {speed === 1 ? 'Normal' : `${speed}x`}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </motion.div>
              </AnimatePresence>,
              portalTarget
            )}
          </div>
        )}

        {/* PiP — only for native video */}
        {type === 'video' && showPip && document.pictureInPictureEnabled && (
          <button
            type="button"
            aria-label="Picture in Picture"
            onClick={togglePip}
            className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center text-white hover:text-[#16A085] transition-colors"
          >
            <PipIcon className="w-5 h-5" />
          </button>
        )}

        {/* Fullscreen */}
        {showFullscreen && (
          <button
            type="button"
            aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            onClick={toggleFullscreen}
            className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center text-white hover:text-[#16A085] transition-colors"
          >
            {isFullscreen ? (
              <ExitFullscreenIcon className="w-5 h-5" />
            ) : (
              <FullscreenIcon className="w-5 h-5" />
            )}
          </button>
        )}
      </div>
    </div>
  )

  // Play overlay with CSS transition (replaces AnimatePresence)
  const renderPlayOverlay = () => !isLoading && (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center
                 bg-black/10 cursor-pointer rounded-xl transition-opacity duration-300"
      style={{ opacity: !isPlaying ? 1 : 0, pointerEvents: !isPlaying ? 'auto' : 'none' }}
      onClick={(e) => { e.stopPropagation(); togglePlay() }}
    >
      <div className="p-3 sm:p-4 rounded-full glass-surface shadow-lg">
        <PlayIcon className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 text-white/70 drop-shadow-lg" />
      </div>
    </div>
  )

  // --- Render: invalid embed URL ---
  if ((type === 'youtube' || type === 'vimeo') && !embedUrl) {
    return (
      <div
        className={cn("relative overflow-hidden bg-black flex items-center justify-center", className)}
        style={{ aspectRatio }}
      >
        <p className="text-white/70 text-sm text-center px-4">URL de vídeo inválida ou não encontrada.</p>
      </div>
    )
  }

  // --- Render: Vimeo (custom controls overlay, like YouTube) ---
  if (type === 'vimeo') {
    return (
      <div
        ref={containerRef}
        role="group"
        aria-label={`Player: ${title || 'Video'}`}
        className={cn(
          "relative rounded-xl bg-black group",
          isFullscreen && "fixed inset-0 z-50",
          className
        )}
        style={{ aspectRatio: isFullscreen ? undefined : aspectRatio }}
        onMouseMove={scheduleHideControls}
        onTouchStart={scheduleHideControls}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {/* Inner clip — rounds the iframe; popups live outside this */}
        <div className="absolute inset-0 overflow-hidden rounded-xl">
          <iframe
            ref={iframeRef}
            src={embedUrl}
            title={title || 'Video'}
            className="absolute inset-0 w-full h-full block"
            style={{ pointerEvents: 'none' }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            frameBorder="0"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>

        {/* Tap zone — captures taps to toggle play + show controls */}
        <div
          className="absolute inset-0 z-10 rounded-xl"
          onClick={() => { togglePlay(); scheduleHideControls() }}
        />

        {loadingSpinner}
        {renderFfToast()}
        {renderPlayOverlay()}
        {renderControlsOverlay()}
      </div>
    )
  }

  // --- Render: YouTube (custom controls overlay) ---
  if (type === 'youtube') {
    return (
      <div
        ref={containerRef}
        role="group"
        aria-label={`Player: ${title || 'Vídeo'}`}
        className={cn(
          "relative rounded-xl bg-black group",
          isFullscreen && "fixed inset-0 z-50",
          className
        )}
        style={{ aspectRatio: isFullscreen ? undefined : aspectRatio }}
        onMouseMove={scheduleHideControls}
        onTouchStart={scheduleHideControls}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {/* Inner clip — rounds the iframe; popups live outside this */}
        <div className="absolute inset-0 overflow-hidden rounded-xl">
          <iframe
            ref={iframeRef}
            src={embedUrl}
            title={title || 'Video'}
            className="absolute inset-0 w-full h-full block"
            style={{ pointerEvents: 'none' }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            frameBorder="0"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>

        {/* Tap zone — captures taps to toggle play + show controls */}
        <div
          className="absolute inset-0 z-10 rounded-xl"
          onClick={() => { togglePlay(); scheduleHideControls() }}
        />

        {loadingSpinner}
        {renderFfToast()}
        {renderPlayOverlay()}
        {renderControlsOverlay()}
      </div>
    )
  }

  // --- Render: native video ---
  return (
    <div
      ref={containerRef}
      role="group"
      aria-label={`Player de vídeo: ${title || 'Vídeo'}`}
      className={cn(
        "relative rounded-xl bg-black group",
        isFullscreen && "fixed inset-0 z-50",
        className
      )}
      style={{ aspectRatio: isFullscreen ? undefined : aspectRatio }}
      onMouseMove={scheduleHideControls}
      onTouchStart={scheduleHideControls}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      {...props}
    >
      {/* Inner clip — rounds the video; popups live outside this */}
      <div className="absolute inset-0 overflow-hidden rounded-xl">
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          loop={loop}
          muted={muted}
          autoPlay={autoPlay}
          playsInline
          onClick={togglePlay}
          className="w-full h-full object-contain"
        />
      </div>

      {loadingSpinner}
      {renderFfToast()}
      {renderPlayOverlay()}
      {renderControlsOverlay()}
    </div>
  )
}

export { VideoPlayer }
export default VideoPlayer

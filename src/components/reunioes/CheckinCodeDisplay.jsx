import { useState, useEffect, useCallback } from 'react'
import { ShieldCheck, XCircle } from 'lucide-react'
import { Button } from '@/design-system'
import {
  generateCheckinCode,
  getCurrentWindowIndex,
  getSecondsUntilNextWindow,
} from '@/utils/checkinCodeGenerator'

/**
 * CheckinCodeDisplay — Organizer view showing the rotating 4-digit code
 * with a circular countdown timer.
 */
export default function CheckinCodeDisplay({ seed, onDeactivate }) {
  const [code, setCode] = useState(() =>
    generateCheckinCode(seed, getCurrentWindowIndex())
  )
  const [secondsLeft, setSecondsLeft] = useState(() => getSecondsUntilNextWindow())

  const refresh = useCallback(() => {
    setCode(generateCheckinCode(seed, getCurrentWindowIndex()))
    setSecondsLeft(getSecondsUntilNextWindow())
  }, [seed])

  useEffect(() => {
    refresh()
    const id = setInterval(() => {
      const s = getSecondsUntilNextWindow()
      setSecondsLeft(s)
      // When the window flips, regenerate the code
      if (s >= 59) refresh()
    }, 1000)
    return () => clearInterval(id)
  }, [refresh])

  // SVG circular countdown
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const progress = (secondsLeft / 60) * circumference

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <ShieldCheck className="w-4 h-4" />
        Check-in Ativo
      </div>

      {/* Countdown ring + code */}
      <div className="relative flex items-center justify-center">
        <svg width="120" height="120" className="-rotate-90">
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-border"
            strokeWidth="6"
          />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-primary"
            strokeWidth="6"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tracking-[0.3em] text-foreground tabular-nums">
            {code}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">{secondsLeft}s</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center max-w-[240px]">
        Compartilhe este codigo com os participantes presentes. Ele muda a cada 60 segundos.
      </p>

      <Button variant="outline" size="sm" onClick={onDeactivate}>
        <XCircle className="w-4 h-4 mr-2" />
        Encerrar Check-in
      </Button>
    </div>
  )
}

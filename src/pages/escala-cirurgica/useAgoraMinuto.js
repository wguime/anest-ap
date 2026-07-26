/**
 * useAgoraMinuto — "agora" em minutos do dia (0–1439), atualizado a cada 30s.
 *
 * UM intervalo para a lista toda (granularidade de minuto), não 1 timer/card.
 * iOS/PWA SUSPENDE timers em segundo plano e pode nunca retomá-los depois do
 * resume (WebKit) — foi o que congelou os cronômetros da aba Liberações o dia
 * todo em produção (bug 2026-07-22). Por isso, voltar a ficar visível
 * (visibilitychange/pageshow/focus) recalcula NA HORA e re-arma o intervalo.
 */
import { useEffect, useState } from 'react'
import { agora } from '@/lib/devClock'

export const minutosDoDia = (d = agora()) => d.getHours() * 60 + d.getMinutes()

export default function useAgoraMinuto() {
  const [agoraMin, setAgoraMin] = useState(() => minutosDoDia())

  useEffect(() => {
    const atualizar = () => setAgoraMin(minutosDoDia())
    let id = setInterval(atualizar, 30_000)
    const retomar = () => {
      atualizar()
      clearInterval(id) // o intervalo pode ter morrido na suspensão — re-arma
      id = setInterval(atualizar, 30_000)
    }
    const onVisibilidade = () => { if (!document.hidden) retomar() }
    document.addEventListener('visibilitychange', onVisibilidade)
    window.addEventListener('pageshow', retomar)
    window.addEventListener('focus', retomar)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibilidade)
      window.removeEventListener('pageshow', retomar)
      window.removeEventListener('focus', retomar)
    }
  }, [])

  return agoraMin
}

/**
 * usePushPermission — React hook para gerenciar permissão e token FCM.
 *
 * Sprint 21 Wave 2.2.
 *
 * Encapsula:
 *   - leitura do estado de Notification.permission no mount
 *   - chamada idempotente para registrar token quando permission='granted'
 *   - auto-refresh do token após 7 dias (FCM_TOKEN_TTL_MS)
 *   - exposição de requestAndRegister + unsubscribe para a UI
 *
 * Por que isLoading? requestPermission + getFcmToken envolve I/O assíncrono
 * (prompt do browser + import dinâmico + write no Firestore). UI usa isLoading
 * para desabilitar botão / mostrar spinner.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { auth, db } from '../config/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { isSupported, requestPermission, getFcmToken, unsubscribe as svcUnsubscribe } from '../services/pushNotificationService'

const FCM_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 dias

export function usePushPermission() {
  const supported = isSupported()
  const [permission, setPermission] = useState(
    supported && typeof Notification !== 'undefined' ? Notification.permission : 'default',
  )
  const [token, setToken] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const refreshAttemptedRef = useRef(false)

  // Auto-registro/refresh no mount quando já há permissão granted.
  useEffect(() => {
    if (!supported) return
    if (permission !== 'granted') return
    if (refreshAttemptedRef.current) return
    refreshAttemptedRef.current = true

    let cancelled = false

    ;(async () => {
      const user = auth.currentUser
      if (!user) return

      try {
        const snap = await getDoc(doc(db, 'userProfiles', user.uid))
        const data = snap.exists() ? snap.data() : {}
        const existingToken = data.fcmToken
        const updatedAt = data.fcmTokenUpdatedAt
        const updatedAtMs = updatedAt?.toMillis ? updatedAt.toMillis() : 0
        const stale = !updatedAtMs || Date.now() - updatedAtMs > FCM_TOKEN_TTL_MS

        if (existingToken && !stale) {
          if (!cancelled) setToken(existingToken)
          return
        }

        // Sem token, ou token velho demais → re-registra.
        setIsLoading(true)
        const fresh = await getFcmToken()
        if (!cancelled) setToken(fresh)
      } catch (err) {
        console.warn('[usePushPermission] mount refresh falhou:', err?.message || err)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [supported, permission])

  /**
   * Pede permissão (se ainda 'default') e registra token. Retorna o token
   * obtido (string) ou null em falha/recusa.
   */
  const requestAndRegister = useCallback(async () => {
    if (!supported) return null
    setIsLoading(true)
    try {
      const result = await requestPermission()
      setPermission(result)
      if (result !== 'granted') return null
      const fresh = await getFcmToken()
      setToken(fresh)
      return fresh
    } finally {
      setIsLoading(false)
    }
  }, [supported])

  /**
   * Revoga token + limpa Firestore. Permissão do browser continua granted
   * até o usuário revogar manualmente nas configurações do site.
   */
  const unsubscribe = useCallback(async () => {
    if (!supported) return false
    setIsLoading(true)
    try {
      const ok = await svcUnsubscribe()
      if (ok) setToken(null)
      return ok
    } finally {
      setIsLoading(false)
    }
  }, [supported])

  return {
    permission,
    isSupported: supported,
    token,
    requestAndRegister,
    unsubscribe,
    isLoading,
  }
}

export default usePushPermission

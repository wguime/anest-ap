import { useEffect, useRef, useState } from 'react'
import {
  acquireEditLock,
  heartbeatEditLock,
  releaseEditLock,
  subscribeEditLock,
} from '@/services/educacaoService'

/**
 * useEditLock — T1.5.13
 *
 * Gerencia ciclo de vida do lock advisory para um recurso (trilha/curso/módulo/aula).
 * - Tenta adquirir ao montar (quando active=true).
 * - Renova a cada 60s via heartbeat enquanto montado.
 * - Libera ao desmontar OU em beforeunload da janela.
 * - Subscreve em tempo real para detectar lock externo.
 *
 * Retorna:
 *   {
 *     status: 'idle' | 'acquiring' | 'locked-by-me' | 'locked-by-other' | 'error',
 *     lockedByName: string | null,
 *     lockedSince: Date | null,
 *     forceAcquire: () => Promise<void>,
 *   }
 *
 * @param {string} resourceType 'trilha' | 'curso' | 'modulo' | 'aula' | etc.
 * @param {string|null} resourceId ID do recurso (null = no-op até existir)
 * @param {string|null} userId  Firebase UID
 * @param {string} userName Nome para display
 * @param {boolean} active Quando false desativa toda a lógica
 */
export function useEditLock({ resourceType, resourceId, userId, userName = '', active = true } = {}) {
  const [status, setStatus] = useState('idle')
  const [lockedByName, setLockedByName] = useState(null)
  const [lockedSince, setLockedSince] = useState(null)
  const heartbeatRef = useRef(null)

  // Subscrição realtime ao lock
  useEffect(() => {
    if (!active || !resourceType || !resourceId) return undefined
    const unsub = subscribeEditLock(resourceType, resourceId, (lock) => {
      if (!lock) {
        setLockedByName(null)
        setLockedSince(null)
        return
      }
      setLockedByName(lock.lockedByName)
      setLockedSince(lock.lockedAt)
      if (lock.lockedBy !== userId) setStatus('locked-by-other')
    })
    return unsub
  }, [active, resourceType, resourceId, userId])

  // Aquisição inicial + heartbeat
  useEffect(() => {
    if (!active || !resourceType || !resourceId || !userId) return undefined
    let cancelled = false

    setStatus('acquiring')
    acquireEditLock(resourceType, resourceId, userId, userName).then((res) => {
      if (cancelled) return
      if (res.acquired) {
        setStatus('locked-by-me')
        heartbeatRef.current = setInterval(() => {
          heartbeatEditLock(resourceType, resourceId, userId)
        }, 60_000)
      } else if (res.error) {
        setStatus('error')
      } else {
        setStatus('locked-by-other')
        setLockedByName(res.lockedByName || 'Outro usuário')
        setLockedSince(res.lockedAt || null)
      }
    })

    const beforeUnload = () => {
      releaseEditLock(resourceType, resourceId, userId).catch(() => {})
    }
    window.addEventListener('beforeunload', beforeUnload)

    return () => {
      cancelled = true
      window.removeEventListener('beforeunload', beforeUnload)
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
      releaseEditLock(resourceType, resourceId, userId).catch(() => {})
    }
  }, [active, resourceType, resourceId, userId, userName])

  const forceAcquire = async () => {
    if (!resourceType || !resourceId || !userId) return
    setStatus('acquiring')
    // Sobrescreve mesmo se houver lock de outro (advisory — não enforced)
    const res = await acquireEditLock(resourceType, resourceId, userId, userName)
    setStatus(res.acquired ? 'locked-by-me' : 'error')
  }

  return { status, lockedByName, lockedSince, forceAcquire }
}

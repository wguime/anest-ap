// Hook que dispara flush da offline queue ao reconectar.
// Sprint 10 / F6.2. Mountar UMA vez no App.
import { useEffect } from 'react'
import { flush } from '@/services/offlineQueueProcessor'

export function useOfflineQueueFlush() {
  useEffect(() => {
    let cancelled = false

    const safeFlush = async () => {
      try {
        const result = await flush()
        if (!cancelled && (result.processed || result.failed)) {
          // eslint-disable-next-line no-console
          console.log('[offline-queue] flush', result)
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[offline-queue] flush error', err?.message ?? err)
      }
    }

    if (typeof navigator === 'undefined' || navigator.onLine) {
      safeFlush()
    }

    const handleOnline = () => {
      safeFlush()
    }

    window.addEventListener('online', handleOnline)
    return () => {
      cancelled = true
      window.removeEventListener('online', handleOnline)
    }
  }, [])
}

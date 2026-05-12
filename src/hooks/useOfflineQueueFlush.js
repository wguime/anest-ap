// Hook que dispara flush da offline queue ao reconectar.
// Sprint 10 / F6.2 — montar UMA vez no App.
//
// Sprint 14b / F6.3 — wirea o `conflictHandler` no processor com o user
// context corrente. Quando o flush detecta 23505 / 409 no replay de uma
// op offline, ao invés de marcar como `failed` (+ backoff), encaminha a
// entry pra tabela `documento_conflict_queue` (admin resolve manualmente).
import { useEffect } from 'react'
import { useUser } from '@/contexts/UserContext'
import { flush, setConflictHandler } from '@/services/offlineQueueProcessor'
import { enqueueConflict } from '@/services/supabaseConflictQueueService'

export function useOfflineQueueFlush() {
  const { user, firebaseUser } = useUser()

  // Sprint 14b / F6.3 — registra o conflict handler com user context.
  // Re-registra sempre que user muda (login/logout).
  useEffect(() => {
    if (!user && !firebaseUser) {
      setConflictHandler(null)
      return
    }

    const uid = firebaseUser?.uid || user?.uid || user?.id
    const displayName =
      user?.displayName ||
      user?.nome ||
      firebaseUser?.displayName ||
      'Usuario'

    setConflictHandler(async (item, err) => {
      if (!uid) {
        // Sem uid: não dá pra satisfazer o RLS check (firebase_uid() = user_id).
        // Fallback: deixa o processor marcar como failed.
        throw new Error('conflictHandler: uid ausente, fallback markFailed')
      }
      await enqueueConflict({
        opId: String(item.id),
        opString: item.op,
        userId: uid,
        userName: displayName,
        payload: item.payload,
        // Sprint 14b/Wave 3 (B3) pode enriquecer com snapshot do servidor.
        // Por enquanto só anexamos o erro original (debug).
        serverState: err
          ? { code: err.code, status: err.status, message: err.message }
          : null,
      })
    })

    return () => {
      setConflictHandler(null)
    }
  }, [user, firebaseUser])

  useEffect(() => {
    let cancelled = false

    const safeFlush = async () => {
      try {
        const result = await flush()
        if (
          !cancelled &&
          (result.processed || result.failed || result.conflicts)
        ) {
          console.log('[offline-queue] flush', result)
        }
      } catch (err) {
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

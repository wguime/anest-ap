import { useEffect, useRef, useState, useCallback } from 'react'
import { useDebouncedCallback } from 'use-debounce'

/**
 * useAutoSave — T1.5.11
 *
 * Auto-save com debounce para formulários (AulaFormModal/CursoFormModal/TrilhaFormModal).
 *
 * Comportamento:
 *  - Marca `dirty` ao detectar mudança em `data` (após o primeiro snapshot).
 *  - Debounce (default 800ms) antes de chamar onSave.
 *  - Status: 'idle' | 'dirty' | 'saving' | 'saved' | 'error'.
 *  - localStorage opcional para draft (chave `draft:${storageKey}`) — restaurado
 *    via `restoreDraft()`; limpo em `clearDraft()` (chamar após save explícito).
 *
 * Uso:
 *   const { status, lastSavedAt, flush, clearDraft, restoreDraft } = useAutoSave({
 *     data: formData,
 *     onSave: async (snapshot) => api.upsert(snapshot),
 *     enabled: !!formData?.id, // só auto-save quando entidade existe (edit, não create)
 *     storageKey: `aula:${formData?.id}`,
 *     debounceMs: 800,
 *   })
 */
export function useAutoSave({
  data,
  onSave,
  enabled = true,
  debounceMs = 800,
  storageKey = null,
} = {}) {
  const [status, setStatus] = useState('idle')
  const [lastSavedAt, setLastSavedAt] = useState(null)
  const [error, setError] = useState(null)

  // Snapshot inicial para evitar dispatch no primeiro render
  const initialRef = useRef(null)
  const lastSavedRef = useRef(null)
  const mountedRef = useRef(false)

  // Cache do data atual para o flush
  const dataRef = useRef(data)
  useEffect(() => {
    dataRef.current = data
  }, [data])

  const performSave = useCallback(async (snapshot) => {
    if (!onSave) return
    setStatus('saving')
    setError(null)
    try {
      await onSave(snapshot)
      lastSavedRef.current = snapshot
      setStatus('saved')
      setLastSavedAt(new Date())
      // Limpa draft em localStorage após save bem-sucedido
      if (storageKey && typeof window !== 'undefined') {
        try {
          window.localStorage.removeItem(`draft:${storageKey}`)
        } catch (_e) {
          // Quota cheia ou storage indisponível — ignora
        }
      }
    } catch (err) {
      setError(err?.message || 'Erro ao salvar')
      setStatus('error')
    }
  }, [onSave, storageKey])

  const debouncedSave = useDebouncedCallback(performSave, debounceMs, {
    leading: false,
    trailing: true,
  })

  // Watcher principal
  useEffect(() => {
    if (!enabled) return
    if (!mountedRef.current) {
      // primeiro render: só registra snapshot
      mountedRef.current = true
      initialRef.current = data
      lastSavedRef.current = data
      return
    }

    // Sem mudança real? skip
    if (deepEqual(data, lastSavedRef.current)) return

    setStatus('dirty')

    // localStorage fallback (draft)
    if (storageKey && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(`draft:${storageKey}`, JSON.stringify(data))
      } catch (_e) {
        // Quota/storage — ignora silenciosamente
      }
    }

    debouncedSave(data)
  }, [data, enabled, debouncedSave, storageKey])

  // Cleanup: cancela debounce ao desmontar
  useEffect(() => () => debouncedSave.cancel(), [debouncedSave])

  const flush = useCallback(async () => {
    debouncedSave.cancel()
    await performSave(dataRef.current)
  }, [debouncedSave, performSave])

  const clearDraft = useCallback(() => {
    if (storageKey && typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(`draft:${storageKey}`)
      } catch (_e) { /* noop: best-effort cleanup — localStorage pode estar indisponível */ }
    }
  }, [storageKey])

  const restoreDraft = useCallback(() => {
    if (!storageKey || typeof window === 'undefined') return null
    try {
      const raw = window.localStorage.getItem(`draft:${storageKey}`)
      return raw ? JSON.parse(raw) : null
    } catch (_e) {
      return null
    }
  }, [storageKey])

  return { status, lastSavedAt, error, flush, clearDraft, restoreDraft }
}

// Comparação rasa-suficiente: serializa para JSON. Funciona pra forms simples.
// Para forms com Date/Files, caller deve passar dados serializáveis.
function deepEqual(a, b) {
  if (a === b) return true
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch (_e) {
    return false
  }
}

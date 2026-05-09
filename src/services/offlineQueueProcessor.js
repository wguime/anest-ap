// Processador de fila offline. Aceita registros de offlineQueue e despacha
// para handlers registrados por op. Sprint 10 / F6.2.
//
// Uso:
//   import { registerHandler, flush } from '@/services/offlineQueueProcessor'
//   registerHandler('comunicado.confirmLeitura', async (payload) => { ... })
//   await flush() // usualmente chamado pelo hook useOfflineQueueFlush

import { peekAll, remove, markFailed } from '@/utils/offlineQueue'

const handlers = new Map()
let inFlight = false

export function registerHandler(op, fn) {
  if (typeof fn !== 'function') {
    throw new Error(`handler para "${op}" precisa ser função`)
  }
  handlers.set(op, fn)
}

export function unregisterHandler(op) {
  handlers.delete(op)
}

export function listHandlers() {
  return [...handlers.keys()]
}

// Tenta drenar a fila. Itens pulados se nextRetryAt > now (backoff ativo).
// Retorna { processed, failed, skipped }.
export async function flush({ now = Date.now() } = {}) {
  if (inFlight) return { processed: 0, failed: 0, skipped: 0, busy: true }
  inFlight = true
  let processed = 0
  let failed = 0
  let skipped = 0

  try {
    const items = await peekAll()
    for (const item of items) {
      if (item.nextRetryAt && item.nextRetryAt > now) {
        skipped++
        continue
      }
      const handler = handlers.get(item.op)
      if (!handler) {
        // Sem handler registrado — pula (não falha).
        skipped++
        continue
      }
      try {
        await handler(item.payload)
        await remove(item.id)
        processed++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        await markFailed(item.id, msg)
        failed++
      }
    }
  } finally {
    inFlight = false
  }

  return { processed, failed, skipped }
}

// Para testes — limpa o estado em memória do processor (não toca IDB).
export function _resetForTests() {
  handlers.clear()
  inFlight = false
}

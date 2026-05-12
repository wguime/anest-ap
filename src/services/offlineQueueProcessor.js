// Processador de fila offline. Aceita registros de offlineQueue e despacha
// para handlers registrados por op. Sprint 10 / F6.2.
//
// Uso:
//   import { registerHandler, flush } from '@/services/offlineQueueProcessor'
//   registerHandler('comunicado.confirmLeitura', async (payload) => { ... })
//   await flush() // usualmente chamado pelo hook useOfflineQueueFlush
//
// Sprint 14b / F6.3 — detecção de conflito (23505 / 409):
//   Se o handler joga um erro com `code === '23505'` (unique violation Postgres)
//   ou `status === 409` (HTTP conflict), o item é encaminhado para o
//   `conflictHandler` (set via `setConflictHandler`) e removido da fila local.
//   Não é re-enfileirado nem marcado como `failed` — o admin resolve em
//   `documento_conflict_queue`.
//
//   O conflictHandler é wirado pelo hook `useOfflineQueueFlush` (que tem
//   acesso ao `user` context); o processor permanece sem dependência direta
//   no service Supabase (evita ciclo).

import { peekAll, remove, markFailed } from '@/utils/offlineQueue'

const handlers = new Map()
let conflictHandler = null
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

/**
 * Registra (ou desregistra) o handler de conflito. Recebido com
 * `(item, err) => Promise<void>` — onde `item` é a entry da fila local
 * e `err` é o erro original (com `code`/`status`).
 *
 * Sprint 14b / F6.3. Wirado por `useOfflineQueueFlush` com user context.
 */
export function setConflictHandler(fn) {
  if (fn !== null && typeof fn !== 'function') {
    throw new Error('conflictHandler precisa ser função ou null')
  }
  conflictHandler = fn
}

/**
 * Detecta se um erro indica conflito de estado no servidor (replay offline
 * que bateu 409 / unique violation).
 *
 * Conservador por design: APENAS códigos canônicos. Network errors genéricos
 * e business errors não-409 continuam pelo caminho `markFailed` + backoff.
 */
export function isConflictError(err) {
  if (!err || typeof err !== 'object') return false
  // Postgres unique violation via PostgREST
  if (err.code === '23505') return true
  // HTTP 409 (PostgREST mapeia conflicts para 409 em alguns casos;
  // também pega responses customizados de RPC/edge).
  if (err.status === 409) return true
  if (err.statusCode === 409) return true
  return false
}

// Tenta drenar a fila. Itens pulados se nextRetryAt > now (backoff ativo).
// Retorna { processed, failed, skipped, conflicts }.
export async function flush({ now = Date.now() } = {}) {
  if (inFlight) {
    return { processed: 0, failed: 0, skipped: 0, conflicts: 0, busy: true }
  }
  inFlight = true
  let processed = 0
  let failed = 0
  let skipped = 0
  let conflicts = 0

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
        if (isConflictError(err) && conflictHandler) {
          // F6.3 — encaminha pra documento_conflict_queue e remove local.
          try {
            await conflictHandler(item, err)
            await remove(item.id)
            conflicts++
          } catch (conflictErr) {
            // Conflict handler falhou: fallback pra comportamento legacy
            // (markFailed) para não perder a entry.
            console.warn(
              '[offline-queue] conflictHandler falhou, fallback markFailed:',
              conflictErr?.message ?? conflictErr
            )
            const msg = err instanceof Error ? err.message : String(err)
            await markFailed(item.id, msg)
            failed++
          }
        } else {
          const msg = err instanceof Error ? err.message : String(err)
          await markFailed(item.id, msg)
          failed++
        }
      }
    }
  } finally {
    inFlight = false
  }

  return { processed, failed, skipped, conflicts }
}

// Para testes — limpa o estado em memória do processor (não toca IDB).
export function _resetForTests() {
  handlers.clear()
  conflictHandler = null
  inFlight = false
}

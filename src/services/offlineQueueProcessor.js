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
 * Detecção de conflito tem 2 caminhos:
 *
 *  1. **Throw** com `error.code === '23505'` (Postgres unique violation) ou
 *     `error.status === 409` / `error.statusCode === 409` (HTTP conflict).
 *     Default para handlers DB-native — qualquer mutation que bater unique
 *     constraint ou PostgREST 409 cai automaticamente no conflict path.
 *
 *  2. **Opt-in shape**: handler resolve normalmente (sem jogar) com um valor
 *     `{ conflict: true, server_state?: any }`. Útil para:
 *     - RPCs que comparam `updated_at` lado servidor e devolvem snapshot
 *       fresco do estado (server_state) JS-side sem usar HTTP status code.
 *     - Business stale-state detection — ex.: handler verifica se o status
 *       mudou de 'pending' para 'cancelled' enquanto a op estava na fila,
 *       e quer enviar pra conflict queue sem exceções como controle de fluxo.
 *
 * Handlers existentes (que jogam) continuam funcionando — pattern 1 é o
 * default. Pattern 2 é 100% opcional; nenhum handler atual precisa mudar.
 *
 * `isConflictError` permanece focado APENAS no caminho throw (codes canônicos).
 * O caminho opt-in é checado no loop de `flush` inspecionando o valor de
 * retorno do handler.
 */

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

/**
 * Detecta se o **valor de retorno** de um handler indica conflito (opt-in).
 *
 * Handler resolve (sem jogar) com `{ conflict: true, server_state?: any }`.
 * `server_state` é opcional — quando presente, é encaminhado para
 * `conflictHandler` (e gravado no conflito no Supabase para debug).
 *
 * Qualquer outro valor de retorno é tratado como sucesso normal (drena fila).
 */
export function isConflictResult(result) {
  return Boolean(
    result && typeof result === 'object' && result.conflict === true
  )
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
      let result
      let handlerThrew = false
      let thrownErr = null
      try {
        result = await handler(item.payload)
      } catch (err) {
        handlerThrew = true
        thrownErr = err
      }

      if (handlerThrew) {
        // Caminho 1 (default): erro com 23505 / 409 → conflict queue.
        if (isConflictError(thrownErr) && conflictHandler) {
          // F6.3 — encaminha pra documento_conflict_queue e remove local.
          try {
            await conflictHandler(item, thrownErr)
            await remove(item.id)
            conflicts++
          } catch (conflictErr) {
            // Conflict handler falhou: fallback pra comportamento legacy
            // (markFailed) para não perder a entry.
            console.warn(
              '[offline-queue] conflictHandler falhou, fallback markFailed:',
              conflictErr?.message ?? conflictErr
            )
            const msg =
              thrownErr instanceof Error
                ? thrownErr.message
                : String(thrownErr)
            await markFailed(item.id, msg)
            failed++
          }
        } else {
          const msg =
            thrownErr instanceof Error ? thrownErr.message : String(thrownErr)
          await markFailed(item.id, msg)
          failed++
        }
        continue
      }

      // Caminho 2 (opt-in): handler retornou { conflict: true, server_state? }
      // sem jogar. Encaminhamos pra conflict queue com server_state preservado.
      if (isConflictResult(result) && conflictHandler) {
        const serverState =
          'server_state' in result ? result.server_state : null
        // Item enriquecido com server_state (conflictHandler é o wirer do hook
        // useOfflineQueueFlush; ele lê item.server_state ao chamar enqueue).
        const enrichedItem = { ...item, server_state: serverState }
        // Erro sintético para preservar contrato `(item, err)` — mensagem
        // documenta o caminho opt-in para o conflictHandler/logger.
        const syntheticErr = Object.assign(
          new Error('[offline-queue] opt-in conflict result'),
          { optInResult: true, server_state: serverState }
        )
        try {
          await conflictHandler(enrichedItem, syntheticErr)
          await remove(item.id)
          conflicts++
        } catch (conflictErr) {
          console.warn(
            '[offline-queue] conflictHandler falhou (opt-in), fallback markFailed:',
            conflictErr?.message ?? conflictErr
          )
          await markFailed(item.id, 'opt-in conflict result; handler falhou')
          failed++
        }
        continue
      }

      // Sucesso normal — drena fila.
      await remove(item.id)
      processed++
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

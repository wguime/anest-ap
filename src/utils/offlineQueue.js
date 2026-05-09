// IndexedDB queue para mutations offline. Vanilla IDB, sem dependências.
// Sprint 10 / F6.2 — persiste writes quando navigator.onLine === false.
//
// Schema do registro:
//   { id, op, payload, attempts, lastError, createdAt, nextRetryAt }
//
// `op` é uma string de identificação do handler registrado em
// offlineQueueProcessor (ex: 'comunicado.confirmLeitura').
//
// Para test rodar fora do browser, injete um IDB stub via setIDBFactory().

const DB_NAME = 'anest-offline-v1'
const STORE = 'mutations'
const VERSION = 1

let _idbFactory = typeof indexedDB !== 'undefined' ? indexedDB : null
let _dbPromise = null

export function setIDBFactory(factory) {
  _idbFactory = factory
  _dbPromise = null
}

function openDB() {
  if (_dbPromise) return _dbPromise
  if (!_idbFactory) {
    return Promise.reject(new Error('IndexedDB não disponível'))
  }
  _dbPromise = new Promise((resolve, reject) => {
    const req = _idbFactory.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
        store.createIndex('createdAt', 'createdAt', { unique: false })
        store.createIndex('nextRetryAt', 'nextRetryAt', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return _dbPromise
}

function tx(mode) {
  return openDB().then((db) => db.transaction(STORE, mode).objectStore(STORE))
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function enqueue({ op, payload }) {
  if (!op) throw new Error('enqueue requer "op"')
  const now = Date.now()
  const record = {
    op,
    payload: payload ?? null,
    attempts: 0,
    lastError: null,
    createdAt: now,
    nextRetryAt: now,
  }
  const store = await tx('readwrite')
  const id = await reqToPromise(store.add(record))
  return { id, ...record }
}

export async function peekAll() {
  const store = await tx('readonly')
  const all = await reqToPromise(store.getAll())
  return all.sort((a, b) => a.createdAt - b.createdAt)
}

export async function remove(id) {
  const store = await tx('readwrite')
  await reqToPromise(store.delete(id))
}

const MAX_BACKOFF_MS = 5 * 60 * 1000 // 5 min cap

export async function markFailed(id, errMessage) {
  const store = await tx('readwrite')
  const existing = await reqToPromise(store.get(id))
  if (!existing) return null
  const attempts = (existing.attempts ?? 0) + 1
  // Exponential backoff: 2^attempts * 1000ms, cap em 5min
  const backoff = Math.min(2 ** attempts * 1000, MAX_BACKOFF_MS)
  const updated = {
    ...existing,
    attempts,
    lastError: errMessage,
    nextRetryAt: Date.now() + backoff,
  }
  await reqToPromise(store.put(updated))
  return updated
}

export async function clearAll() {
  const store = await tx('readwrite')
  await reqToPromise(store.clear())
}

// Útil em tests para forçar reabrir a connection.
export function _resetForTests() {
  _dbPromise = null
}

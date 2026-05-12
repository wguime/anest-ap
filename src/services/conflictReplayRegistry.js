/**
 * Conflict Replay Registry — Sprint 15a / F6.3 closeout
 *
 * Mapa `op_string → async handler` usado por
 * `resolveLastWriteWinsWithReplay` (em `supabaseConflictQueueService.js`).
 * Permite re-executar a mutation original guardada em
 * `documento_conflict_queue.payload` antes de marcar o conflito como
 * resolvido — efetivamente aplicando "last-write-wins" do lado do user
 * que perdeu a corrida.
 *
 * Histórico do problema:
 *   Antes desta sprint, `resolveLastWriteWins` apenas marcava
 *   `status='resolved_last_write_wins'` na fila — a mutation original NUNCA
 *   era replayed, então a versão do user offline era descartada. Esta
 *   registry resolve isso roteando o `op_string` armazenado pra um handler
 *   conhecido (idempotente — upserts e DELETEs WHERE).
 *
 * Como adicionar um novo handler:
 *   1. Garanta que a função do service é EXPORTADA (handlers são
 *      tipicamente o `_doXxxUpsert` interno; em Sprint 15a alguns foram
 *      promovidos a export explícito justamente para isto).
 *   2. Chame `registerReplayHandler('namespace.op', handlerFn)` no MESMO
 *      arquivo do service (preferencialmente logo abaixo do
 *      `registerHandler` do `offlineQueueProcessor`, para manter os dois
 *      pareados — offline flush e conflict replay reusam a mesma função).
 *   3. Assinatura do handler: `async (payload, userInfo) => result`
 *      onde `userInfo = { uid, displayName?, email? }`. Joga em erro de DB
 *      ou network — `resolveLastWriteWinsWithReplay` empacota em
 *      `ReplayFailedError` para a UI distinguir.
 *
 * IMPORTANTE: handlers DEVEM ser idempotentes (upserts ou DELETE WHERE).
 * Se o replay falhar parcialmente e o admin retentar, não pode duplicar
 * audit rows críticos. logAction pode duplicar (aceito, ver
 * `_doRecordAcknowledgement`); inserts non-upsert não devem ser
 * registrados aqui sem proteção extra.
 */

// ============================================================================
// REGISTRY (estado de módulo)
// ============================================================================

const handlers = new Map()

/**
 * Registra um replay handler para um `op_string`.
 *
 * Sobrescreve silenciosamente se já houver um handler para o mesmo op
 * — útil em hot-reload (Vite) e em testes que re-importam o módulo.
 *
 * @param {string} opString    Identificador da op (ex.: 'documento.recordAcknowledgement').
 * @param {(payload: object, userInfo: { uid: string, displayName?: string, email?: string }) => Promise<any>} handler
 * @returns {void}
 * @throws {Error} Se opString não for string não-vazia ou handler não for função.
 */
export function registerReplayHandler(opString, handler) {
  if (typeof opString !== 'string' || opString.trim() === '') {
    throw new Error('[replay-registry] opString deve ser string não-vazia')
  }
  if (typeof handler !== 'function') {
    throw new Error(
      `[replay-registry] handler para "${opString}" precisa ser função`
    )
  }
  handlers.set(opString, handler)
}

/**
 * Retorna o handler registrado para `opString`, ou `undefined` se
 * nenhum estiver registrado.
 *
 * @param {string} opString
 * @returns {Function|undefined}
 */
export function getReplayHandler(opString) {
  return handlers.get(opString)
}

/**
 * Verifica se há handler registrado para `opString`.
 *
 * @param {string} opString
 * @returns {boolean}
 */
export function hasReplayHandler(opString) {
  return handlers.has(opString)
}

/**
 * Lista os op_strings com handlers registrados (debug / UI / admin tools).
 *
 * @returns {string[]}
 */
export function listReplayHandlers() {
  return [...handlers.keys()]
}

/**
 * Remove um handler. Usado em testes e em flows de teardown.
 *
 * @param {string} opString
 * @returns {boolean} `true` se um handler foi removido.
 */
export function unregisterReplayHandler(opString) {
  return handlers.delete(opString)
}

/**
 * Limpa todo o estado da registry. APENAS para testes.
 *
 * @returns {void}
 */
export function _resetReplayRegistryForTests() {
  handlers.clear()
}

// ============================================================================
// REGISTRO DOS HANDLERS CONHECIDOS
// ----------------------------------------------------------------------------
// Os handlers SE REGISTRAM via side-effect quando o service correspondente
// é importado — mesmo padrão do `offlineQueueProcessor`. Esta registry
// permanece SEM imports dos services para evitar ciclo (services importam
// a registry). A "garantia de registro" é responsabilidade do consumidor
// (`supabaseConflictQueueService` chama `ensureReplayHandlersRegistered`
// antes de fazer lookup).
//
// Op strings registradas:
//   `documento.recordAcknowledgement`  → supabaseDocumentService
//   `comunicado.confirmLeitura`        → supabaseComunicadosService
//   `comunicado.completarAcao`         → supabaseComunicadosService
//   `comunicado.desfazerAcao`          → supabaseComunicadosService
//   `planos-acao.advancePdcaPhase`     → supabasePlanosAcaoService (Sprint 16)
//   `planos-acao.evaluateEficacia`     → supabasePlanosAcaoService (Sprint 16)
//   `incidente.updateStatus`           → supabaseIncidentsService  (Sprint 16)
//
// Nota: `documento.completarAcao` mencionado em specs de sprint NÃO existe
// no codebase (apenas comunicado tem ações). Se vier a existir, basta
// registrar no service novo — nenhuma mudança aqui é necessária.
// ============================================================================


/**
 * Lógica da atualização do PWA — check ao voltar ao 1º plano + periódico + GUARDA DE
 * VERSÃO — separada do registro do service worker para ser testável (o `virtual:pwa-register`
 * só existe dentro do Vite). `src/pwaUpdate.js` registra o SW e chama `instalarAtualizacaoPwa`.
 *
 * Histórico que explica cada peça (integral em `src/pwaUpdate.js` até 04/09):
 *  - 22–23/07: aparelhos ficavam DIAS no bundle velho; daí o check em visibilitychange e a
 *    cada 15 min, mais a guarda de versão por `/version.json` (independe do ciclo do SW,
 *    que é o que falha no iOS).
 *  - 13/08 ("a Home abre, carrega e recarrega sozinha"): UM reload, quando o SW novo assume
 *    (controllerchange), com backstop às cegas aos 12 s, desistência aos 18 s e cooldown de
 *    60 s. SEM AVISO NA TELA — atualizar é bastidor.
 *  - 04/09 (Onda 2 da conferência): a atualização é ADIADA enquanto houver trabalho em
 *    andamento (`atualizacaoAdiada.js` — a conferência em lote segura ao abrir e libera ao
 *    fechar). Houve 3 a 5 deploys por dia na janela da escala da tarde, e cada um
 *    recarregava a página no meio da digitação. Quando o último motivo libera, o reload
 *    que ficou devendo acontece na hora.
 */
import { atualizacaoSegura, aoLiberar } from './atualizacaoAdiada'

export const CHAVE_RELOAD = 'anest-reload-versao'
export const COOLDOWN_MS = 60 * 1000
export const BACKSTOP_MS = 12000
export const DESISTE_MS = 18000
export const INTERVALO_MS = 15 * 60 * 1000
export const BOOT_MS = 800
export const RETORNO_MINIMO_MS = 5000

/**
 * @param {ServiceWorkerRegistration|null} registration
 * @param {Object} deps  injetáveis (todos com o padrão do navegador)
 */
export function instalarAtualizacaoPwa(registration, {
  buildId = null,
  fetchFn = (...a) => globalThis.fetch(...a),
  doc = globalThis.document,
  win = globalThis.window,
  sw = globalThis.navigator?.serviceWorker || null,
  storage = (() => { try { return globalThis.sessionStorage } catch { return null } })(),
  agora = () => Date.now(),
  setTimeoutFn = (fn, ms) => setTimeout(fn, ms),
  setIntervalFn = (fn, ms) => setInterval(fn, ms),
  reload = () => globalThis.window.location.reload(),
} = {}) {
  const carregadoEm = agora()

  /** Já recarregou agora há pouco? (anti-laço se o servidor devolver id velho) */
  function emCooldown() {
    try {
      const t = Number(storage?.getItem(CHAVE_RELOAD) || 0)
      return agora() - t < COOLDOWN_MS
    } catch { return false }
  }
  function marcarReload() {
    try { storage?.setItem(CHAVE_RELOAD, String(agora())) } catch { /* modo privado */ }
  }
  function recarregar() {
    marcarReload()
    reload()
  }

  async function versaoPublicadaMudou() {
    if (!buildId) return false
    try {
      const r = await fetchFn(`/version.json?t=${agora()}`, { cache: 'no-store' })
      if (!r.ok) return false
      const { buildId: publicado } = await r.json()
      return !!publicado && publicado !== buildId
    } catch {
      return false // offline: segue com o que tem
    }
  }

  // update() BYPASSA o cache HTTP do sw.js (register() sozinho não — spec); é o que garante
  // detectar o deploy já no boot mesmo se algum cache intermediário segurar o sw.js.
  // Com trabalho em andamento NÃO checa: instalar o SW novo faz o claim, e o claim é o
  // reload — adiar de verdade é não puxar o gatilho.
  const checarSW = () => {
    if (atualizacaoSegura()) return
    registration?.update?.().catch?.(() => { /* offline — tenta no próximo */ })
  }

  // O RELOAD BOM acontece AQUI: quando o SW novo assume a página (clients.claim →
  // controllerchange), o precache novo está pronto. Guarda `tinhaController`: no 1º acesso
  // da vida o claim inicial também dispara controllerchange e NÃO deve recarregar.
  const tinhaController = !!sw?.controller
  let recarregouPorClaim = false
  let reloadDevido = false // o claim veio com trabalho em andamento: recarrega ao liberar
  if (tinhaController && sw?.addEventListener) {
    sw.addEventListener('controllerchange', () => {
      if (recarregouPorClaim) return
      if (atualizacaoSegura()) { reloadDevido = true; return }
      recarregouPorClaim = true
      recarregar()
    })
  }

  let atualizando = false
  async function aplicarAtualizacaoSeDesatualizado() {
    if (atualizando || doc?.hidden || atualizacaoSegura()) return
    if (!(await versaoPublicadaMudou())) return
    if (atualizacaoSegura()) return // a conferência abriu enquanto a versão era consultada
    atualizando = true
    checarSW() // acelera o install do SW novo; o claim dele faz o reload
    setTimeoutFn(() => {
      // 12s sem claim: último recurso — reload às cegas (cooldown de 60s impede laço).
      // Cobre SW com ciclo quebrado mas CDN já atualizada. Com trabalho em andamento,
      // fica devendo.
      if (atualizando && !recarregouPorClaim && !emCooldown()) {
        if (atualizacaoSegura()) { reloadDevido = true; return }
        recarregar()
      }
    }, BACKSTOP_MS)
    // 18s sem trocar de versão (rede ruim, SW travado): desiste desta rodada. O app segue
    // utilizável no bundle atual e o próximo visibilitychange/intervalo tenta de novo.
    setTimeoutFn(() => { atualizando = false }, DESISTE_MS)
  }

  // Boot: se o deploy mudou desde a última visita, começa a buscar o bundle novo já — em
  // SILÊNCIO. 800ms: depois do 1º paint, sem atrasar o boot de quem já está atualizado.
  checarSW()
  setTimeoutFn(aplicarAtualizacaoSeDesatualizado, BOOT_MS)

  const aoVoltar = () => {
    if (doc?.hidden) return
    checarSW()
    // Só em RETORNO real do 2º plano — o pageshow inicial já é coberto pelo check de boot
    // acima (era ele que causava o reload duplo pós-deploy).
    if (agora() - carregadoEm > RETORNO_MINIMO_MS) aplicarAtualizacaoSeDesatualizado()
  }
  doc?.addEventListener?.('visibilitychange', aoVoltar)
  win?.addEventListener?.('pageshow', aoVoltar)
  setIntervalFn(() => { checarSW(); aplicarAtualizacaoSeDesatualizado() }, INTERVALO_MS)

  // O último trabalho liberou: o reload que ficou devendo acontece agora; senão, uma
  // rodada normal de verificação (a versão pode ter mudado enquanto a conferência durou).
  const cancelarOuvinte = aoLiberar(() => {
    if (reloadDevido && !emCooldown()) {
      reloadDevido = false
      recarregouPorClaim = true
      // fora da pilha de quem liberou: o flush do rascunho e os cleanups do React acabam antes
      setTimeoutFn(recarregar, 0)
      return
    }
    atualizando = false
    setTimeoutFn(aplicarAtualizacaoSeDesatualizado, 0)
  })

  return {
    aplicarAtualizacaoSeDesatualizado,
    desinstalar: () => {
      cancelarOuvinte()
      doc?.removeEventListener?.('visibilitychange', aoVoltar)
      win?.removeEventListener?.('pageshow', aoVoltar)
    },
  }
}

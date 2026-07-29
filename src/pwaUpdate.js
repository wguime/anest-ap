/**
 * Atualização do PWA — check ao voltar ao 1º plano + periódico + GUARDA DE VERSÃO.
 *
 * Bug sistêmico 22–23/07: aparelhos ficavam DIAS no bundle velho — correções
 * "não apareciam" (IOSC corrigido no banco e invisível na Completa) e clientes
 * antigos chegaram a corromper dados (rodapé com nomes de exibição). O
 * registerType 'autoUpdate' + skipWaiting recarrega quando o SW novo assume,
 * mas o CHECK de atualização só acontecia no load da página — iOS PWA retomado
 * do segundo plano nunca checava. Daí o check em visibilitychange e a cada 15 min.
 *
 * 29/07 provou que só isso não basta: às 10:56 um aparelho liberou um colega
 * FORA DA ORDEM na escala do HRO — o bloqueio existia desde 27/07 e estava em
 * produção, mas aquele app rodava JS anterior ao deploy das 08:46. Regra de
 * negócio nova não vale nada se o aparelho continua com o código antigo.
 *
 * Guarda de versão (independe do ciclo do service worker, que é justamente o que
 * falha no iOS): o build carimba `__BUILD_ID__` no bundle e publica o mesmo id em
 * /version.json. Ao voltar ao 1º plano o app compara os dois e se recarrega
 * quando estão diferentes. Recarrega só na volta do 2º plano — nunca no meio de
 * um toque — e no máximo 1× por minuto, para não virar laço se algo falhar.
 */
import { registerSW } from 'virtual:pwa-register'

const BUILD_ID = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : null
const CHAVE_RELOAD = 'anest-reload-versao'
const COOLDOWN_MS = 60 * 1000

/** Já recarregou agora há pouco? (anti-laço se o servidor devolver id velho) */
function emCooldown() {
  try {
    const t = Number(sessionStorage.getItem(CHAVE_RELOAD) || 0)
    return Date.now() - t < COOLDOWN_MS
  } catch { return false }
}

async function versaoPublicadaMudou() {
  if (!BUILD_ID) return false
  try {
    const r = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!r.ok) return false
    const { buildId } = await r.json()
    return !!buildId && buildId !== BUILD_ID
  } catch {
    return false // offline: segue com o que tem
  }
}

async function recarregarSeDesatualizado() {
  if (document.hidden || emCooldown()) return
  if (!(await versaoPublicadaMudou())) return
  try { sessionStorage.setItem(CHAVE_RELOAD, String(Date.now())) } catch { /* modo privado */ }
  window.location.reload()
}

registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    const checarSW = () => registration?.update().catch(() => { /* offline — tenta no próximo */ })
    const aoVoltar = () => {
      if (document.hidden) return
      checarSW()
      recarregarSeDesatualizado()
    }
    document.addEventListener('visibilitychange', aoVoltar)
    window.addEventListener('pageshow', aoVoltar)
    setInterval(() => { checarSW(); recarregarSeDesatualizado() }, 15 * 60 * 1000)
  },
})

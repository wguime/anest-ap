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
 * /version.json; o app compara os dois.
 *
 * REFORMA 13/08 (queixa do dono: "a Home abre, carrega e recarrega sozinha"):
 * na 1ª abertura pós-deploy o SW serve o shell VELHO, o pageshow inicial fazia
 * um location.reload() INÚTIL (o SW novo nem tinha instalado — voltava o mesmo
 * shell velho) e segundos depois o autoUpdate do plugin recarregava DE NOVO ao
 * assumir — o usuário via o app abrir, usar e sumir. Agora, versão publicada
 * diferente = OVERLAY "Atualizando" na hora (ninguém investe numa sessão
 * condenada) e UM reload quando o SW novo assume (o autoUpdate do plugin faz
 * isso via controllerchange); backstop de 6s p/ SW que já assumiu em 2º plano
 * e desistência aos 15s (app segue utilizável no bundle atual; o próximo ciclo
 * tenta de novo). Cooldown de 60s continua impedindo laço de reload.
 */
import { registerSW } from 'virtual:pwa-register'

const BUILD_ID = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : null
const CHAVE_RELOAD = 'anest-reload-versao'
const COOLDOWN_MS = 60 * 1000
const carregadoEm = Date.now()

/** Já recarregou agora há pouco? (anti-laço se o servidor devolver id velho) */
function emCooldown() {
  try {
    const t = Number(sessionStorage.getItem(CHAVE_RELOAD) || 0)
    return Date.now() - t < COOLDOWN_MS
  } catch { return false }
}

function marcarReload() {
  try { sessionStorage.setItem(CHAVE_RELOAD, String(Date.now())) } catch { /* modo privado */ }
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

// ── Overlay "Atualizando o ANEST…" — DOM puro, independe do React ────────────
let overlayEl = null

function mostrarOverlay() {
  if (overlayEl) return
  const dark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches
  overlayEl = document.createElement('div')
  overlayEl.id = 'anest-atualizando'
  overlayEl.setAttribute('role', 'status')
  overlayEl.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:2147483647',
    'display:flex', 'flex-direction:column', 'align-items:center',
    'justify-content:center', 'gap:14px',
    `background:${dark ? '#111916' : '#F0FFF4'}`,
    `color:${dark ? '#2ECC71' : '#004225'}`,
    'font:600 15px -apple-system,BlinkMacSystemFont,system-ui,sans-serif',
  ].join(';')
  overlayEl.innerHTML =
    '<div style="width:28px;height:28px;border:3px solid currentColor;border-top-color:transparent;border-radius:50%;animation:anest-spin .8s linear infinite"></div>' +
    '<div>Atualizando o ANEST…</div>' +
    '<style>@keyframes anest-spin{to{transform:rotate(360deg)}}</style>'
  document.body.appendChild(overlayEl)
}

function removerOverlay() {
  overlayEl?.remove()
  overlayEl = null
}

registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    // update() BYPASSA o cache HTTP do sw.js (register() sozinho não — spec);
    // é o que garante detectar o deploy já no boot mesmo se algum cache
    // intermediário segurar o sw.js.
    const checarSW = () => registration?.update().catch(() => { /* offline — tenta no próximo */ })

    // O RELOAD BOM acontece AQUI: quando o SW novo assume a página
    // (clients.claim → controllerchange), o precache novo está pronto e o
    // reload carrega o shell novo com certeza. Descoberta 13/08 lendo o bundle
    // gerado: o virtual:pwa-register em modo autoUpdate NÃO recarrega sozinho
    // (zero listeners de controllerchange) — a crença de 23/07 estava errada,
    // e quem recarregava era a guarda de versão ÀS CEGAS, às vezes cedo demais
    // (caía no shell velho) e de novo depois: o "abre, carrega e recarrega"
    // relatado pelo dono. Guarda `tinhaController`: no 1º acesso da vida o
    // claim inicial também dispara controllerchange e NÃO deve recarregar.
    const tinhaController = !!navigator.serviceWorker?.controller
    let recarregouPorClaim = false
    if (tinhaController) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (recarregouPorClaim) return
        recarregouPorClaim = true
        marcarReload()
        window.location.reload()
      })
    }

    let atualizando = false
    async function aplicarAtualizacaoSeDesatualizado() {
      if (atualizando || document.hidden) return
      if (!(await versaoPublicadaMudou())) return
      atualizando = true
      mostrarOverlay()
      checarSW() // acelera o install do SW novo; o claim dele faz o reload
      setTimeout(() => {
        // 12s sem claim: último recurso — reload às cegas (cooldown de 60s
        // impede laço). Cobre SW com ciclo quebrado mas CDN já atualizada.
        if (atualizando && !recarregouPorClaim && !emCooldown()) {
          marcarReload()
          window.location.reload()
        }
      }, 12000)
      setTimeout(() => {
        // 18s sem trocar de versão (rede ruim, SW travado): devolve o app —
        // utilizável no bundle atual é melhor que overlay eterno. O próximo
        // visibilitychange/intervalo tenta de novo.
        removerOverlay()
        atualizando = false
      }, 18000)
    }

    // Boot: se o deploy mudou desde a última visita, o shell atual (servido
    // pelo SW velho) já nasce condenado — overlay imediato em vez de deixar o
    // usuário começar a usar e ser recarregado no meio. 800ms: depois do 1º
    // paint, sem atrasar o boot de quem já está atualizado.
    checarSW()
    setTimeout(aplicarAtualizacaoSeDesatualizado, 800)

    const aoVoltar = () => {
      if (document.hidden) return
      checarSW()
      // Só em RETORNO real do 2º plano — o pageshow inicial já é coberto pelo
      // check de boot acima (era ele que causava o reload duplo pós-deploy).
      if (Date.now() - carregadoEm > 5000) aplicarAtualizacaoSeDesatualizado()
    }
    document.addEventListener('visibilitychange', aoVoltar)
    window.addEventListener('pageshow', aoVoltar)
    setInterval(() => { checarSW(); aplicarAtualizacaoSeDesatualizado() }, 15 * 60 * 1000)
  },
})

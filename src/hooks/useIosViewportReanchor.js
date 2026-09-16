/**
 * useIosViewportReanchor — re-ancora os elementos `position: fixed` no iOS.
 *
 * No iOS o teclado NÃO redimensiona o layout viewport: o WebKit "empurra" o
 * visual viewport para revelar o input focado (mesmo com o scroll lock de
 * overflow:hidden no body — o iOS ignora ele para esse pan). Ao fechar o
 * teclado esse deslocamento às vezes fica RESIDUAL (PWA standalone é o pior
 * caso) e tudo que é `position: fixed` — BottomNav, headers via createPortal —
 * fica ancorado no layout viewport deslocado: a barra aparece "flutuando" no
 * meio da página e o header some acima da tela. Rolar a lista NÃO conserta,
 * porque o scroll do usuário move o documento, não o offset (relatos do dono
 * 24/07, 29/07 e 30/07, sempre depois dos sheets com input da Escala
 * Cirúrgica). Um scroll PROGRAMÁTICO para `pageTop` reconcilia os dois
 * viewports: o conteúdo visível não se mexe e o offset zera.
 *
 * ⚠️ 16/09: o scrollTo SOZINHO não bastava (dono: "já solicitei a correção
 * outras vezes, mas o problema ainda persiste"). Ele só absorve o offset se o
 * documento tiver espaço para rolar `offsetTop` px além de onde está — e o
 * gatilho típico (abrir o sheet a partir de um card no FIM da lista) deixa a
 * página já no fim: o scrollTo clampava, o offset ficava e a barra seguia no
 * meio da tela. Agora o hook dá esse espaço ao documento (`min-height` no
 * <html>) só durante a reconciliação e devolve em seguida: o scroll clampa de
 * volta, o conteúdo desce os mesmos px e os dois viewports terminam
 * alinhados. E a reconciliação também roda quando a rolagem do usuário
 * assenta, não só ao soltar o dedo — um scrollTo no meio da inércia era
 * engolido e ninguém tentava de novo.
 *
 * A barra em si tem ainda uma segunda proteção, independente desta:
 * `useVisualViewportAnchor` (design-system/hooks), dentro da BottomNav.
 */
import { useEffect } from 'react'
import { ehIos } from '@/design-system/hooks/useVisualViewportAnchor'

// Tempo para o WebKit aplicar o scroll (no iOS o visual viewport vive no
// processo da UI e é atualizado de forma assíncrona) antes de conferir.
const ESPERA_APLICAR_MS = 80

const editandoTexto = () => {
  const el = document.activeElement
  return Boolean(
    el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
  )
}

export default function useIosViewportReanchor() {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv || !ehIos()) return

    const html = document.documentElement
    let timer = 0
    let timerAplicar = 0
    let toqueAtivo = false
    let minHeightAntes = null

    const darEspaco = (px) => {
      if (minHeightAntes === null) minHeightAntes = html.style.minHeight
      html.style.minHeight = `${html.scrollHeight + px}px`
    }
    const devolverEspaco = () => {
      if (minHeightAntes === null) return
      html.style.minHeight = minHeightAntes
      minHeightAntes = null
    }

    const reancorar = (tentativa = 0) => {
      // Com teclado aberto (input focado) o offset é legítimo; com pinch-zoom
      // (scale ≠ 1) também. Só reconciliamos o estado quebrado: parado, sem
      // teclado, e mesmo assim deslocado.
      if (editandoTexto() || toqueAtivo || Math.abs(vv.scale - 1) > 0.01) return
      const offset = vv.offsetTop
      if (offset < 2) return
      // Espaço para o scroll absorver o offset mesmo com a página no fim.
      darEspaco(Math.ceil(offset) + 1)
      window.scrollTo(window.scrollX, Math.max(0, Math.round(vv.pageTop)))
      clearTimeout(timerAplicar)
      timerAplicar = setTimeout(() => {
        devolverEspaco()
        if (vv.offsetTop < 2 || tentativa >= 2) return
        // O WebKit pode engolir o scrollTo "no-op" — 1px de jiggle força o reflow.
        window.scrollBy(0, 1)
        window.scrollBy(0, -1)
        reancorar(tentativa + 1)
      }, ESPERA_APLICAR_MS)
    }

    // Debounce: deixa a animação do teclado/sheet terminar (e o focus trap
    // devolver o overflow do body) antes de reconciliar.
    const agendar = () => {
      clearTimeout(timer)
      timer = setTimeout(reancorar, 250)
    }

    const onTouchStart = () => { toqueAtivo = true }
    const onTouchEnd = () => {
      toqueAtivo = false
      agendar()
    }

    vv.addEventListener('resize', agendar)
    vv.addEventListener('scroll', agendar)
    document.addEventListener('focusout', agendar, true)
    document.addEventListener('visibilitychange', agendar)
    window.addEventListener('pageshow', agendar)
    window.addEventListener('scroll', agendar, { passive: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('touchcancel', onTouchEnd, { passive: true })
    return () => {
      clearTimeout(timer)
      clearTimeout(timerAplicar)
      devolverEspaco()
      vv.removeEventListener('resize', agendar)
      vv.removeEventListener('scroll', agendar)
      document.removeEventListener('focusout', agendar, true)
      document.removeEventListener('visibilitychange', agendar)
      window.removeEventListener('pageshow', agendar)
      window.removeEventListener('scroll', agendar)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [])
}

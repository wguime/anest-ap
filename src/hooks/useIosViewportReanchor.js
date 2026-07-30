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
 */
import { useEffect } from 'react'

const editandoTexto = () => {
  const el = document.activeElement
  return Boolean(
    el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
  )
}

export default function useIosViewportReanchor() {
  useEffect(() => {
    const vv = window.visualViewport
    // `-webkit-touch-callout` só existe no iOS — mesma detecção do CSS da barra
    // (.bottom-nav-glass em anest-theme.css). Fora do iOS o bug não existe.
    if (!vv || typeof CSS === 'undefined' || !CSS.supports('-webkit-touch-callout: none')) return

    let timer = 0
    let toqueAtivo = false

    const reancorar = (tentativa = 0) => {
      // Com teclado aberto (input focado) o offset é legítimo; com pinch-zoom
      // (scale ≠ 1) também. Só reconciliamos o estado quebrado: parado, sem
      // teclado, e mesmo assim deslocado.
      if (editandoTexto() || toqueAtivo || Math.abs(vv.scale - 1) > 0.01) return
      if (vv.offsetTop < 2) return
      window.scrollTo(window.scrollX, Math.max(0, Math.round(vv.pageTop)))
      if (tentativa >= 2) return
      requestAnimationFrame(() => {
        if (vv.offsetTop >= 2) {
          // O WebKit pode engolir o scrollTo "no-op" — 1px de jiggle força o reflow.
          window.scrollBy(0, 1)
          window.scrollBy(0, -1)
          reancorar(tentativa + 1)
        }
      })
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
    window.addEventListener('pageshow', agendar)
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('touchcancel', onTouchEnd, { passive: true })
    return () => {
      clearTimeout(timer)
      vv.removeEventListener('resize', agendar)
      vv.removeEventListener('scroll', agendar)
      document.removeEventListener('focusout', agendar, true)
      window.removeEventListener('pageshow', agendar)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [])
}

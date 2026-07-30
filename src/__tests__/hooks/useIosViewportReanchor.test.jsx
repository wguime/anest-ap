/**
 * useIosViewportReanchor — BottomNav "flutuando" no meio da página (iOS).
 *
 * Cobre o bug de produção 30/07: fechar o teclado dos sheets da Escala
 * Cirúrgica deixa o visual viewport com offset residual e todo `position:
 * fixed` (BottomNav, headers) fica ancorado fora do lugar. O hook precisa:
 *  - reconciliar via scrollTo(pageTop) quando há offset SEM teclado aberto;
 *  - NÃO mexer em nada com input focado (offset legítimo do teclado);
 *  - NÃO mexer com pinch-zoom (scale ≠ 1) nem durante toque ativo;
 *  - não fazer nada fora do iOS (CSS.supports) ou sem visualViewport.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import useIosViewportReanchor from '../../hooks/useIosViewportReanchor'

// visualViewport fake — jsdom não implementa; EventTarget dá add/removeEventListener
function criarVisualViewport({ offsetTop = 0, pageTop = 0, scale = 1 } = {}) {
  const vv = new EventTarget()
  vv.offsetTop = offsetTop
  vv.pageTop = pageTop
  vv.scale = scale
  return vv
}

describe('useIosViewportReanchor', () => {
  let vv
  let scrollToSpy

  beforeEach(() => {
    vi.useFakeTimers()
    vv = criarVisualViewport()
    window.visualViewport = vv
    // happy-dom/jsdom não implementam CSS.supports — stub direto ("é iOS")
    CSS.supports = vi.fn().mockReturnValue(true)
    scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    delete window.visualViewport
    delete CSS.supports
  })

  const dispararResize = () => {
    act(() => {
      vv.dispatchEvent(new Event('resize'))
      vi.advanceTimersByTime(300)
    })
  }

  it('offset residual sem teclado → scrollTo(pageTop) reconcilia', () => {
    renderHook(() => useIosViewportReanchor())
    vv.offsetTop = 480
    vv.pageTop = 1730 // scrollY 1250 + offset 480
    dispararResize()
    expect(scrollToSpy).toHaveBeenCalledWith(window.scrollX, 1730)
  })

  it('offset zero → não faz nada (estado saudável)', () => {
    renderHook(() => useIosViewportReanchor())
    dispararResize()
    expect(scrollToSpy).not.toHaveBeenCalled()
  })

  it('input focado (teclado aberto) → offset é legítimo, não mexe', () => {
    renderHook(() => useIosViewportReanchor())
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    vv.offsetTop = 480
    vv.pageTop = 1730
    dispararResize()
    expect(scrollToSpy).not.toHaveBeenCalled()
    input.remove()
  })

  it('pinch-zoom (scale ≠ 1) → offset é legítimo, não mexe', () => {
    renderHook(() => useIosViewportReanchor())
    vv.offsetTop = 480
    vv.pageTop = 1730
    vv.scale = 2
    dispararResize()
    expect(scrollToSpy).not.toHaveBeenCalled()
  })

  it('dedo na tela → espera soltar; touchend re-agenda e reconcilia', () => {
    renderHook(() => useIosViewportReanchor())
    vv.offsetTop = 480
    vv.pageTop = 1730
    act(() => { window.dispatchEvent(new Event('touchstart')) })
    dispararResize()
    expect(scrollToSpy).not.toHaveBeenCalled()
    act(() => {
      window.dispatchEvent(new Event('touchend'))
      vi.advanceTimersByTime(300)
    })
    expect(scrollToSpy).toHaveBeenCalledWith(window.scrollX, 1730)
  })

  it('focusout (fechar sheet/teclado) também dispara a reconciliação', () => {
    renderHook(() => useIosViewportReanchor())
    vv.offsetTop = 480
    vv.pageTop = 1730
    act(() => {
      document.dispatchEvent(new Event('focusout'))
      vi.advanceTimersByTime(300)
    })
    expect(scrollToSpy).toHaveBeenCalledWith(window.scrollX, 1730)
  })

  it('fora do iOS (CSS.supports false) → nenhum listener age', () => {
    CSS.supports.mockReturnValue(false)
    renderHook(() => useIosViewportReanchor())
    vv.offsetTop = 480
    vv.pageTop = 1730
    dispararResize()
    expect(scrollToSpy).not.toHaveBeenCalled()
  })

  it('unmount remove listeners (evento depois não reconcilia)', () => {
    const { unmount } = renderHook(() => useIosViewportReanchor())
    unmount()
    vv.offsetTop = 480
    vv.pageTop = 1730
    dispararResize()
    expect(scrollToSpy).not.toHaveBeenCalled()
  })
})

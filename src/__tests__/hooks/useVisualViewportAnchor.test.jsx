/**
 * useVisualViewportAnchor — a BottomNav fica na borda do que se VÊ (iOS).
 *
 * Garantia para a barra "no meio da tela" (dono 24/07 → 16/09): com o visual
 * viewport deslocado do layout viewport, a barra `position: fixed` mede onde
 * está e compensa por transform até a borda visível. Precisa:
 *  - compensar o offset residual (sem teclado) e convergir em um passo;
 *  - ficar SEM transform no estado saudável;
 *  - não mexer com teclado aberto (altura do visual viewport encolhida) nem
 *    com pinch-zoom (scale ≠ 1) — e voltar a zero se estava compensando;
 *  - servir também à borda de cima (headers) e à faixa lateral (altura cheia);
 *  - não fazer nada fora do iOS; limpar o transform ao desmontar.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useVisualViewportAnchor } from '../../design-system/hooks/useVisualViewportAnchor'

const ALTURA_LAYOUT = 800

function criarVisualViewport({ offsetTop = 0, height = ALTURA_LAYOUT, scale = 1 } = {}) {
  const vv = new EventTarget()
  vv.offsetTop = offsetTop
  vv.height = height
  vv.scale = scale
  return vv
}

// Elemento `fixed` de verdade não existe no jsdom: o rect é derivado do
// transform aplicado, o que fecha a malha (a medição seguinte já inclui a
// compensação — exatamente o que o hook assume no browser).
function criarElemento({ top = ALTURA_LAYOUT - 72, bottom = ALTURA_LAYOUT } = {}) {
  const el = document.createElement('nav')
  document.body.appendChild(el)
  el.getBoundingClientRect = () => {
    const m = /translate3d\(0, (-?\d+)px, 0\)/.exec(el.style.transform)
    const dy = m ? Number(m[1]) : 0
    return { top: top + dy, bottom: bottom + dy, height: bottom - top }
  }
  return el
}

describe('useVisualViewportAnchor', () => {
  let vv
  let el
  let rafFila

  beforeEach(() => {
    vi.useFakeTimers()
    vv = criarVisualViewport()
    window.visualViewport = vv
    CSS.supports = vi.fn().mockReturnValue(true)
    Object.defineProperty(document.documentElement, 'clientHeight', {
      value: ALTURA_LAYOUT, configurable: true,
    })
    window.innerHeight = ALTURA_LAYOUT
    // rAF síncrono sob controle: a fila é drenada em `medir()`
    rafFila = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafFila.push(cb)
      return rafFila.length
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
    el = criarElemento()
  })

  afterEach(() => {
    el.remove()
    vi.useRealTimers()
    vi.restoreAllMocks()
    delete window.visualViewport
    delete CSS.supports
    delete document.documentElement.clientHeight
  })

  const medir = () => {
    act(() => {
      const fila = rafFila.splice(0)
      fila.forEach((cb) => cb())
    })
  }
  const montar = (opts) => {
    const ref = { current: el }
    const r = renderHook(() => useVisualViewportAnchor(ref, opts))
    medir()
    return r
  }
  const dispararResize = () => {
    act(() => { vv.dispatchEvent(new Event('resize')) })
    medir()
  }

  it('estado saudável → sem transform', () => {
    montar()
    expect(el.style.transform).toBe('')
  })

  it('offset residual sem teclado → desce a barra até a borda visível, em um passo', () => {
    montar()
    vv.offsetTop = 300
    dispararResize()
    expect(el.style.transform).toBe('translate3d(0, 300px, 0)')
    // já alinhada: nova medição não muda nada (malha fechada convergiu)
    dispararResize()
    expect(el.style.transform).toBe('translate3d(0, 300px, 0)')
  })

  it('offset zera (reconciliação do scroll) → transform volta a vazio', () => {
    montar()
    vv.offsetTop = 300
    dispararResize()
    vv.offsetTop = 0
    dispararResize()
    expect(el.style.transform).toBe('')
  })

  it('teclado aberto (visual viewport encolhido) → não compensa, fica sob o teclado', () => {
    montar()
    vv.offsetTop = 300
    vv.height = ALTURA_LAYOUT - 340
    dispararResize()
    expect(el.style.transform).toBe('')
  })

  it('tecla de recolher o teclado (input segue focado) → altura volta, compensa mesmo assim', () => {
    montar()
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    vv.offsetTop = 300
    vv.height = ALTURA_LAYOUT
    dispararResize()
    expect(el.style.transform).toBe('translate3d(0, 300px, 0)')
    input.remove()
  })

  it('pinch-zoom (scale ≠ 1) → comportamento padrão do Safari, transform zerado', () => {
    montar()
    vv.offsetTop = 300
    dispararResize()
    vv.scale = 2
    dispararResize()
    expect(el.style.transform).toBe('')
  })

  it('1px de diferença é arredondamento, não deslocamento', () => {
    montar()
    vv.offsetTop = 1
    dispararResize()
    expect(el.style.transform).toBe('')
  })

  it('borda de cima (edge: top) → header desce até o topo visível', () => {
    el.remove()
    el = criarElemento({ top: 0, bottom: 56 })
    montar({ edge: 'top' })
    vv.offsetTop = 300
    dispararResize()
    expect(el.style.transform).toBe('translate3d(0, 300px, 0)')
  })

  it('faixa lateral de altura cheia → mesma compensação pelas duas bordas', () => {
    el.remove()
    el = criarElemento({ top: 0, bottom: ALTURA_LAYOUT })
    montar()
    vv.offsetTop = 300
    dispararResize()
    expect(el.style.transform).toBe('translate3d(0, 300px, 0)')
  })

  it('soltar o dedo / focusout → mede de novo depois da animação (350ms)', () => {
    montar()
    vv.offsetTop = 300
    act(() => {
      window.dispatchEvent(new Event('touchend'))
      vi.advanceTimersByTime(400)
    })
    medir()
    expect(el.style.transform).toBe('translate3d(0, 300px, 0)')
  })

  it('fora do iOS (CSS.supports false) → nenhum listener age', () => {
    CSS.supports.mockReturnValue(false)
    montar()
    vv.offsetTop = 300
    dispararResize()
    expect(el.style.transform).toBe('')
  })

  it('unmount limpa o transform e para de ouvir', () => {
    const { unmount } = montar()
    vv.offsetTop = 300
    dispararResize()
    expect(el.style.transform).toBe('translate3d(0, 300px, 0)')
    unmount()
    expect(el.style.transform).toBe('')
    vv.offsetTop = 500
    dispararResize()
    expect(el.style.transform).toBe('')
  })
})

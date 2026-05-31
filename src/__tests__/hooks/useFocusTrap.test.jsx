import { describe, it, expect } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import * as React from 'react'
import { useFocusTrap } from '../../design-system/hooks/useFocusTrap.js'

// Dá tempo do requestAnimationFrame do focus-trap rodar (jsdom ~16ms)
const flushRaf = () => act(async () => { await new Promise((r) => setTimeout(r, 40)) })

/**
 * Reproduz a estrutura de um Modal DS: container com botão (primeiro focável)
 * seguido de um input controlado. `onEscape` é uma arrow inline — muda de
 * identidade a cada render, igual a `Modal.jsx` (`() => onClose?.()`).
 */
function Modalish() {
  const ref = React.useRef(null)
  const [val, setVal] = React.useState('')
  useFocusTrap({
    active: true,
    containerRef: ref,
    onEscape: () => {},
    lockScroll: false,
    returnFocus: false,
  })
  return (
    <div ref={ref}>
      <button type="button">Fechar</button>
      <input aria-label="campo" value={val} onChange={(e) => setVal(e.target.value)} />
    </div>
  )
}

describe('useFocusTrap — regressão "teclado some a cada tecla"', () => {
  it('não rouba o foco do input quando o modal re-renderiza ao digitar', async () => {
    const { getByLabelText } = render(<Modalish />)
    // Foco inicial vai pro primeiro focável (botão Fechar) — comportamento esperado
    await flushRaf()

    const input = getByLabelText('campo')
    act(() => input.focus())
    expect(document.activeElement).toBe(input)

    // Digitar uma letra → setState → re-render → onEscape muda de identidade.
    // Antes do fix: o efeito do focus-trap re-rodava e o rAF refocava o botão
    // Fechar (focusables[0]), fechando o teclado no mobile.
    fireEvent.change(input, { target: { value: 'N' } })
    await flushRaf()

    expect(document.activeElement).toBe(input)
  })
})

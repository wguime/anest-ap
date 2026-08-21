/**
 * UM RELÓGIO PARA O APP TODO (dono 21/08, ao pedir que as informações da escala
 * parem de ser desencontradas).
 *
 * Sete superfícies da escala usam `useAgoraMinuto` e, até 21/08, cada uma tinha o
 * próprio `setInterval` e o próprio `useState`: duas telas podiam ficar 30s
 * defasadas e discordar justamente nas fronteiras que decidem o que aparece —
 * 13h (turno), 19h (fase noturna), 15min da suspeita, 4h da cirurgia esquecida.
 *
 * ⚠️ Este arquivo NÃO usa fake timers: o que se trava aqui é a store ser
 * COMPARTILHADA (mesma leitura, mesma assinatura), não a cadência do tique — essa
 * é do `setInterval` e não vale a pena simular.
 */
import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import useAgoraMinuto, { minutosDoDia } from '@/pages/escala-cirurgica/useAgoraMinuto'

const Mostrador = ({ id }) => <span data-testid={id}>{useAgoraMinuto()}</span>

afterEach(cleanup)

describe('useAgoraMinuto — store única', () => {
  it('duas telas montadas juntas leem exatamente o mesmo minuto', () => {
    render(<><Mostrador id="faixa" /><Mostrador id="quadro" /></>)
    const a = screen.getByTestId('faixa').textContent
    const b = screen.getByTestId('quadro').textContent
    expect(a).toBe(b)
    expect(Number(a)).toBe(minutosDoDia())
  })

  it('uma tela montada DEPOIS entra no mesmo minuto (sem relógio próprio)', () => {
    const { rerender } = render(<Mostrador id="faixa" />)
    rerender(<><Mostrador id="faixa" /><Mostrador id="quadro" /></>)
    expect(screen.getByTestId('quadro').textContent).toBe(screen.getByTestId('faixa').textContent)
  })

  // O relógio só corre enquanto alguém olha: sem assinantes o intervalo é
  // desligado, senão o timer sobreviveria a cada navegação e o iOS acumularia
  // relógios órfãos ao longo do dia.
  it('desmontar tudo desliga o intervalo; remontar volta a funcionar', () => {
    const setInt = vi.spyOn(globalThis, 'setInterval')
    const clearInt = vi.spyOn(globalThis, 'clearInterval')
    const view = render(<Mostrador id="faixa" />)
    expect(setInt).toHaveBeenCalled()
    act(() => { view.unmount() })
    expect(clearInt).toHaveBeenCalled()
    setInt.mockClear()
    render(<Mostrador id="faixa" />)
    expect(setInt).toHaveBeenCalled()
    expect(screen.getByTestId('faixa').textContent).toBe(String(minutosDoDia()))
    setInt.mockRestore()
    clearInt.mockRestore()
  })

  // Vinte cards não podem render vinte relógios — era o custo do modelo antigo
  // em cada card da fila e de cada sala do quadro.
  it('N telas assinam UM intervalo só', () => {
    const setInt = vi.spyOn(globalThis, 'setInterval')
    setInt.mockClear()
    render(<>{Array.from({ length: 8 }, (_, i) => <Mostrador key={i} id={`t${i}`} />)}</>)
    expect(setInt).toHaveBeenCalledTimes(1)
    setInt.mockRestore()
  })
})

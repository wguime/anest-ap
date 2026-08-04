/**
 * FeriasCard.actionPill — pill "Extrato" no header + card inteiro clicável.
 * Sem a prop o card segue estático (zero mudança para os usos atuais).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FeriasCard } from '@/design-system/components/anest/ferias-card'

const items = [{ nome: 'Dr. Teste', periodo: '05/01 - 09/01', tipo: 'férias' }]

describe('FeriasCard actionPill', () => {
  it('sem actionPill: card não é botão e não há pill', () => {
    render(<FeriasCard title="Férias" items={items} showBadge={false} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('com actionPill: pill renderiza e o card inteiro dispara a ação', () => {
    const onClick = vi.fn()
    render(
      <FeriasCard title="Férias" items={items} showBadge={false} actionPill={{ label: 'Extrato', onClick }} />
    )
    const pill = screen.getByRole('button', { name: 'Extrato' })
    fireEvent.click(pill)
    expect(onClick).toHaveBeenCalledTimes(1)

    // card inteiro (role=button externo) também navega — clique fora do pill
    const card = screen.getAllByRole('button').find((el) => el !== pill)
    fireEvent.click(card)
    expect(onClick).toHaveBeenCalledTimes(2)

    // teclado: Enter ativa
    fireEvent.keyDown(card, { key: 'Enter' })
    expect(onClick).toHaveBeenCalledTimes(3)
  })
})

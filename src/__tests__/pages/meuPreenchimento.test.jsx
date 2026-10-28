import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const hook = vi.fn()
vi.mock('@/hooks/useAdesaoEscala', () => ({ useMeuPreenchimento: (...a) => hook(...a) }))

import MeuPreenchimento, { ID_MINHAS_PENDENCIAS } from '@/pages/escala-cirurgica/MeuPreenchimento'

describe('MeuPreenchimento — topo da aba Minhas (dono 14/10, modelo A)', () => {
  beforeEach(() => hook.mockReset())

  it('mostra a % própria, "N de M", a média dos melhores e a ação do dia', () => {
    hook.mockReturnValue({ dados: { casos: 13, completos: 8, pct: 61.5, top: 97.4, top_n: 5 } })
    const alvo = document.createElement('section')
    alvo.id = ID_MINHAS_PENDENCIAS
    alvo.scrollIntoView = vi.fn()
    document.body.appendChild(alvo)
    render(<MeuPreenchimento uid="u1" dia="2026-10-28" pendentesHoje={2} />)
    expect(hook).toHaveBeenCalledWith('u1', '2026-10-28', expect.any(Object))
    expect(screen.getByText('62%')).toBeInTheDocument()
    expect(screen.getByText('8 de 13')).toBeInTheDocument()
    expect(screen.getByText('97%')).toBeInTheDocument()
    expect(screen.getByText('2 cirurgias de hoje sem horário')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Preencher' }))
    expect(alvo.scrollIntoView).toHaveBeenCalled()
    alvo.remove()
  })

  it('na meta e sem pendência de hoje, não ocupa espaço', () => {
    hook.mockReturnValue({ dados: { casos: 10, completos: 9, pct: 90, top: 100, top_n: 5 } })
    const { container } = render(<MeuPreenchimento uid="u1" pendentesHoje={0} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('HOJE ENTRA NA CONTA (dono 28/10): 12 de 12 + 1 de hoje sem horário mostra 92%, "12 de 13"', () => {
    hook.mockReturnValue({ dados: { ate: '2026-10-26', casos: 12, completos: 12, pct: 100, top: 100, top_n: 5 }, recarregar: vi.fn() })
    render(<MeuPreenchimento uid="u1" dia="2026-10-27" pendentesHoje={1} doDia={{ data: '2026-10-27', casos: 1, completos: 0 }} />)
    expect(screen.getByText('92%')).toBeInTheDocument()
    expect(screen.getByText('12 de 13')).toBeInTheDocument()
    expect(screen.getByText('1 cirurgia de hoje sem horário')).toBeInTheDocument()
  })

  it('horário gravado num dia anterior: busca o número de novo na hora', () => {
    const recarregar = vi.fn()
    hook.mockReturnValue({ dados: { ate: '2026-10-27', casos: 13, completos: 8, pct: 61.5, top: 97.4, top_n: 5 }, recarregar })
    const { rerender } = render(<MeuPreenchimento uid="u1" dia="2026-10-28" versao={0} />)
    expect(recarregar).not.toHaveBeenCalled()
    rerender(<MeuPreenchimento uid="u1" dia="2026-10-28" versao={1} />)
    expect(recarregar).toHaveBeenCalledTimes(1)
  })

  it('abaixo da meta sem pendência: mostra o número, sem a linha da ação', () => {
    hook.mockReturnValue({ dados: { casos: 13, completos: 8, pct: 61.5, top: 97.4, top_n: 5 } })
    render(<MeuPreenchimento uid="u1" />)
    expect(screen.getByLabelText('Seu preenchimento')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Preencher' })).toBeNull()
  })
})

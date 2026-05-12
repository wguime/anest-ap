/**
 * Sprint 14b / F6.3 — ResolveModal tests
 *
 * Cobre:
 *  - render fechado: nada na tela
 *  - render aberto: notes vazio + sem radio → submit disabled
 *  - notes >= 10 chars + radio → submit enabled
 *  - submit chama onSubmit(strategy, notes) com valores corretos
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock DS para evitar transitive supabase import via showcase exports
vi.mock('@/design-system', async () => {
  const React = await import('react')
  return {
    Modal: ({ open, children, title, description, footer }) =>
      open
        ? React.createElement(
            'div',
            { role: 'dialog', 'aria-label': title },
            [
              React.createElement('h2', { key: 'title' }, title),
              description &&
                React.createElement('p', { key: 'desc' }, description),
              React.createElement('div', { key: 'body' }, children),
              footer && React.createElement('div', { key: 'footer' }, footer),
            ]
          )
        : null,
  }
})

import ResolveModal from '../../../../pages/management/conflicts/ResolveModal.jsx'

const conflict = {
  id: 'c-1',
  opId: 'op-abc-123',
  opString: 'comunicado.completarAcao',
  userId: 'u-1',
  userName: 'Maria Souza',
  payload: { x: 1, y: 'a' },
  serverState: { x: 2, y: 'b' },
  status: 'pending',
  createdAt: new Date().toISOString(),
}

describe('ResolveModal', () => {
  it('nao renderiza conteudo quando open=false', () => {
    render(
      <ResolveModal
        open={false}
        onClose={vi.fn()}
        conflict={conflict}
        onSubmit={vi.fn()}
      />
    )
    expect(screen.queryByText(/Resolver conflito/i)).not.toBeInTheDocument()
  })

  it('renderiza titulo e estrategias quando open=true', () => {
    render(
      <ResolveModal
        open
        onClose={vi.fn()}
        conflict={conflict}
        onSubmit={vi.fn()}
      />
    )
    expect(screen.getAllByText(/Resolver conflito/i).length).toBeGreaterThan(0)
    expect(screen.getByLabelText(/Manter vers.o do usuario/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Manter vers.o do servidor/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Apenas registrar/i)).toBeInTheDocument()
  })

  it('botao Salvar fica disabled inicialmente (notes vazio + sem radio)', () => {
    render(
      <ResolveModal
        open
        onClose={vi.fn()}
        conflict={conflict}
        onSubmit={vi.fn()}
      />
    )
    const submit = screen.getByRole('button', { name: /Salvar resolu/i })
    expect(submit).toBeDisabled()
  })

  it('botao Salvar continua disabled com notes < 10 chars', () => {
    render(
      <ResolveModal
        open
        onClose={vi.fn()}
        conflict={conflict}
        onSubmit={vi.fn()}
      />
    )
    const ta = screen.getByLabelText(/Notas da resolu/i)
    fireEvent.change(ta, { target: { value: 'curto' } })
    const submit = screen.getByRole('button', { name: /Salvar resolu/i })
    expect(submit).toBeDisabled()
  })

  it('botao Salvar continua disabled com notes >= 10 mas sem radio', () => {
    render(
      <ResolveModal
        open
        onClose={vi.fn()}
        conflict={conflict}
        onSubmit={vi.fn()}
      />
    )
    const ta = screen.getByLabelText(/Notas da resolu/i)
    fireEvent.change(ta, { target: { value: 'notas suficientemente longas aqui' } })
    const submit = screen.getByRole('button', { name: /Salvar resolu/i })
    expect(submit).toBeDisabled()
  })

  it('botao Salvar habilita com notes >= 10 chars E radio selecionado', () => {
    render(
      <ResolveModal
        open
        onClose={vi.fn()}
        conflict={conflict}
        onSubmit={vi.fn()}
      />
    )
    const ta = screen.getByLabelText(/Notas da resolu/i)
    fireEvent.change(ta, { target: { value: 'notas suficientemente longas aqui' } })
    fireEvent.click(screen.getByLabelText(/Manter vers.o do usuario/i))
    const submit = screen.getByRole('button', { name: /Salvar resolu/i })
    expect(submit).not.toBeDisabled()
  })

  it('submit chama onSubmit(strategy, notes) com os valores informados', async () => {
    const onSubmit = vi.fn().mockResolvedValue()
    render(
      <ResolveModal
        open
        onClose={vi.fn()}
        conflict={conflict}
        onSubmit={onSubmit}
      />
    )
    const noteText = 'estrategia LWW por ser doc nao critico'
    fireEvent.change(screen.getByLabelText(/Notas da resolu/i), {
      target: { value: noteText },
    })
    fireEvent.click(screen.getByLabelText(/Manter vers.o do usuario/i))
    fireEvent.click(screen.getByRole('button', { name: /Salvar resolu/i }))

    // O submit é async, mas a primeira chamada do mock acontece síncronamente.
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith('last_write_wins', noteText)
  })

  it('respeita o limite max de caracteres no input', () => {
    render(
      <ResolveModal
        open
        onClose={vi.fn()}
        conflict={conflict}
        onSubmit={vi.fn()}
      />
    )
    const ta = screen.getByLabelText(/Notas da resolu/i)
    const longText = 'x'.repeat(600)
    fireEvent.change(ta, { target: { value: longText } })
    // textarea trunca em 500
    expect(ta.value.length).toBeLessThanOrEqual(500)
  })
})

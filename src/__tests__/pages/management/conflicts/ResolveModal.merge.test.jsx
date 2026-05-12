/**
 * Sprint 16 / F6.3 Wave 2 — ResolveModal merge-manual tests
 *
 * Cobre o fluxo da 4ª estratégia "merge-manual":
 *  1. Selecionar merge-manual revela DiffViewer interativo com radio por linha.
 *  2. Mudar radio para "Versão servidor" altera o mergedPayload.
 *  3. Submit dispara `onSubmit('merge-manual', notes, mergedPayload)` com o
 *     payload resultante das escolhas.
 *
 * Não testa o service `resolveMerge` aqui — esse é coberto pelo arquivo
 * `supabaseConflictQueueService.merge.test.js` (commit 2). Aqui só
 * validamos a integração ResolveModal ↔ DiffViewer interativo.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock DS — mesma estratégia do ResolveModal.test.jsx para evitar pull
// transitivo do supabase via showcase exports.
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
  id: 'c-merge-1',
  opId: 'op-merge-001',
  opString: 'comunicado.completarAcao',
  userId: 'u-7',
  userName: 'Joao Pereira',
  // Dois campos: ambos divergentes para garantir 2 radio groups.
  payload: { titulo: 'Versao do usuario', prioridade: 'alta' },
  serverState: { titulo: 'Versao do servidor', prioridade: 'normal' },
  status: 'pending',
  createdAt: new Date().toISOString(),
}

describe('ResolveModal — merge-manual (Wave 2)', () => {
  it('lista a 4ª opção "Merge manual" nas estratégias', () => {
    render(
      <ResolveModal
        open
        onClose={vi.fn()}
        conflict={conflict}
        onSubmit={vi.fn()}
      />
    )
    expect(screen.getByLabelText(/Merge manual/i)).toBeInTheDocument()
  })

  it('ao selecionar merge-manual, exibe DiffViewer interativo com radios', () => {
    render(
      <ResolveModal
        open
        onClose={vi.fn()}
        conflict={conflict}
        onSubmit={vi.fn()}
      />
    )
    // Antes de selecionar: nenhum radio "Versão servidor" visível
    // (DiffViewer está fechado em modo accordion).
    expect(
      screen.queryByLabelText(/Versão servidor para campo titulo/i)
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText(/Merge manual/i))

    // Depois de selecionar merge-manual: radios visíveis por linha divergente.
    // Há 2 layouts (mobile + desktop) — usamos getAllByLabelText.
    const minhaTitulo = screen.getAllByLabelText(/Minha versão para campo titulo/i)
    const servidorTitulo = screen.getAllByLabelText(
      /Versão servidor para campo titulo/i
    )
    expect(minhaTitulo.length).toBeGreaterThan(0)
    expect(servidorTitulo.length).toBeGreaterThan(0)
    // Default: "Minha versão" deve estar marcado.
    expect(minhaTitulo[0]).toBeChecked()
    expect(servidorTitulo[0]).not.toBeChecked()
  })

  it('mudar radio para "Versão servidor" altera o estado do componente (radio reflete clique)', () => {
    render(
      <ResolveModal
        open
        onClose={vi.fn()}
        conflict={conflict}
        onSubmit={vi.fn()}
      />
    )
    fireEvent.click(screen.getByLabelText(/Merge manual/i))

    const servidorTitulo = screen.getAllByLabelText(
      /Versão servidor para campo titulo/i
    )
    fireEvent.click(servidorTitulo[0])

    // Re-query após o re-render: o radio "Versão servidor" deve estar checked.
    const refetched = screen.getAllByLabelText(
      /Versão servidor para campo titulo/i
    )
    expect(refetched[0]).toBeChecked()
  })

  it('submit dispara onSubmit("merge-manual", notes, mergedPayload) com escolhas aplicadas', async () => {
    const onSubmit = vi.fn().mockResolvedValue()
    render(
      <ResolveModal
        open
        onClose={vi.fn()}
        conflict={conflict}
        onSubmit={onSubmit}
      />
    )
    // Seleciona merge-manual
    fireEvent.click(screen.getByLabelText(/Merge manual/i))

    // Muda `titulo` para "Versão servidor"; deixa `prioridade` no default
    // (Minha versão = 'alta').
    fireEvent.click(
      screen.getAllByLabelText(/Versão servidor para campo titulo/i)[0]
    )

    // Notas válidas (>= 10 chars)
    fireEvent.change(screen.getByLabelText(/Notas da resolu/i), {
      target: { value: 'merge manual com titulo do servidor' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Salvar resolu/i }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const [strategyArg, notesArg, mergedArg] = onSubmit.mock.calls[0]
    expect(strategyArg).toBe('merge-manual')
    expect(notesArg).toBe('merge manual com titulo do servidor')
    // mergedPayload reflete escolhas:
    //   titulo  → servidor ('Versao do servidor')
    //   prioridade → minha versao ('alta')
    expect(mergedArg).toEqual({
      titulo: 'Versao do servidor',
      prioridade: 'alta',
    })
  })

  it('estratégias não-merge ainda chamam onSubmit com 2 args (compat backwards)', async () => {
    const onSubmit = vi.fn().mockResolvedValue()
    render(
      <ResolveModal
        open
        onClose={vi.fn()}
        conflict={conflict}
        onSubmit={onSubmit}
      />
    )
    fireEvent.click(screen.getByLabelText(/Manter vers.o do usuario/i))
    fireEvent.change(screen.getByLabelText(/Notas da resolu/i), {
      target: { value: 'notas suficientemente longas' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Salvar resolu/i }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    // Para estratégias não-merge, mergedPayload NÃO é passado (undefined).
    expect(onSubmit.mock.calls[0]).toHaveLength(2)
    expect(onSubmit.mock.calls[0][0]).toBe('last_write_wins')
  })
})

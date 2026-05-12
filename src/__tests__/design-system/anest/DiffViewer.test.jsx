/**
 * Sprint 16 / F6.3 polish — DiffViewer tests
 *
 * Cobre:
 *  - 4 estados visuais: only-left / only-right / diff / same
 *  - server_state === null (rota legacy) → header "Servidor não disponível"
 *  - aria-label da região + aria-label por linha
 *  - collapsible vs expandido
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import DiffViewer from '@/design-system/components/anest/DiffViewer.jsx'

describe('DiffViewer', () => {
  // Mock data com combinações:
  //  - 'titulo': only-left   (presente em left, ausente em right)
  //  - 'revisao': only-right (presente em right, ausente em left)
  //  - 'status': diff        (ambos presentes, valores diferentes)
  //  - 'autor': same         (ambos iguais)
  const left = { titulo: 'Novo doc', status: 'rascunho', autor: 'Maria' }
  const right = { revisao: 2, status: 'publicado', autor: 'Maria' }

  it('renderiza aria-label da região de comparação', () => {
    render(<DiffViewer left={left} right={right} collapsible={false} />)
    expect(
      screen.getByRole('region', {
        name: /comparação entre sua versão e versão do servidor/i,
      })
    ).toBeInTheDocument()
  })

  it('classifica only-left corretamente (chave em left apenas)', () => {
    const { container } = render(
      <DiffViewer left={left} right={right} collapsible={false} />
    )
    const row = container.querySelector('[data-diff-state="only-left"]')
    expect(row).toBeTruthy()
    expect(row.getAttribute('aria-label')).toMatch(/titulo.*apenas na sua versão/i)
  })

  it('classifica only-right corretamente (chave em right apenas)', () => {
    const { container } = render(
      <DiffViewer left={left} right={right} collapsible={false} />
    )
    const row = container.querySelector('[data-diff-state="only-right"]')
    expect(row).toBeTruthy()
    expect(row.getAttribute('aria-label')).toMatch(/revisao.*apenas no servidor/i)
  })

  it('classifica diff corretamente (valores diferentes)', () => {
    const { container } = render(
      <DiffViewer left={left} right={right} collapsible={false} />
    )
    const row = container.querySelector('[data-diff-state="diff"]')
    expect(row).toBeTruthy()
    expect(row.getAttribute('aria-label')).toMatch(/status.*divergente/i)
  })

  it('classifica same corretamente (valores iguais)', () => {
    const { container } = render(
      <DiffViewer left={left} right={right} collapsible={false} />
    )
    const row = container.querySelector('[data-diff-state="same"]')
    expect(row).toBeTruthy()
    expect(row.getAttribute('aria-label')).toMatch(/autor.*iguais/i)
  })

  it('aplica classes de token DS (success/warning/destructive) por estado', () => {
    const { container } = render(
      <DiffViewer left={left} right={right} collapsible={false} />
    )
    // only-left → success
    const onlyLeft = container.querySelector('[data-diff-state="only-left"]')
    expect(onlyLeft.innerHTML).toMatch(/bg-success\/10|text-success/)
    // only-right → destructive
    const onlyRight = container.querySelector('[data-diff-state="only-right"]')
    expect(onlyRight.innerHTML).toMatch(/bg-destructive\/10|text-destructive/)
    // diff → warning
    const diff = container.querySelector('[data-diff-state="diff"]')
    expect(diff.innerHTML).toMatch(/bg-warning\/10|text-warning/)
  })

  it('renderiza "Servidor não disponível" quando right === null', () => {
    const { container } = render(
      <DiffViewer left={left} right={null} collapsible={false} />
    )
    expect(screen.getAllByText(/servidor não disponível/i).length).toBeGreaterThan(0)
    // Todas as chaves devem ser only-left quando right é null
    const onlyLeftRows = container.querySelectorAll('[data-diff-state="only-left"]')
    expect(onlyLeftRows.length).toBe(Object.keys(left).length)
    // Não deve haver only-right / diff / same
    expect(container.querySelectorAll('[data-diff-state="only-right"]').length).toBe(0)
    expect(container.querySelectorAll('[data-diff-state="diff"]').length).toBe(0)
    expect(container.querySelectorAll('[data-diff-state="same"]').length).toBe(0)
  })

  it('renderiza "Servidor não disponível" quando right === undefined', () => {
    render(<DiffViewer left={left} collapsible={false} />)
    expect(screen.getAllByText(/servidor não disponível/i).length).toBeGreaterThan(0)
  })

  it('collapsible=true (default) envolve em <details>, fechado por padrão', () => {
    const { container } = render(<DiffViewer left={left} right={right} />)
    const details = container.querySelector('details')
    expect(details).toBeTruthy()
    expect(details.hasAttribute('open')).toBe(false)
    // O summary "Ver diff" deve estar visível
    expect(screen.getByText(/ver diff/i)).toBeInTheDocument()
  })

  it('collapsible=false não envolve em <details>', () => {
    const { container } = render(
      <DiffViewer left={left} right={right} collapsible={false} />
    )
    expect(container.querySelector('details')).toBeNull()
  })

  it('renderiza estado vazio quando left e right são objetos vazios', () => {
    render(<DiffViewer left={{}} right={{}} collapsible={false} />)
    expect(screen.getByText(/sem campos para comparar/i)).toBeInTheDocument()
  })

  it('formata valores não-string corretamente (number, null, object)', () => {
    const { container } = render(
      <DiffViewer
        left={{ count: 42, meta: { a: 1 }, empty: null }}
        right={{ count: 42, meta: { a: 1 }, empty: null }}
        collapsible={false}
      />
    )
    expect(container.textContent).toContain('42')
    expect(container.textContent).toContain('null')
    expect(container.textContent).toContain('{"a":1}')
  })
})

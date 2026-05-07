import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OcrStatusBadge } from '../../components/OcrStatusBadge.jsx'

describe('OcrStatusBadge', () => {
  it('renderiza done com confidence em %', () => {
    render(<OcrStatusBadge documento={{ ocrStatus: 'done', ocrConfidence: 0.87 }} />)
    expect(screen.getByText(/OCR concluído/i)).toBeInTheDocument()
    expect(screen.getByText('87%')).toBeInTheDocument()
  })

  it('confidence baixa muda para warning', () => {
    const { container } = render(
      <OcrStatusBadge documento={{ ocrStatus: 'done', ocrConfidence: 0.5 }} />
    )
    const badge = container.querySelector('[data-slot="badge"]')
    expect(badge).toHaveAttribute('data-variant', 'warning')
  })

  it('estado pending mostra label adequado', () => {
    render(<OcrStatusBadge status="pending" />)
    expect(screen.getByText(/OCR pendente/i)).toBeInTheDocument()
  })

  it('aria-label contém status legível', () => {
    render(<OcrStatusBadge status="failed" />)
    const el = screen.getByLabelText(/OCR falhou/i)
    expect(el).toBeInTheDocument()
  })

  it('not_needed renderiza label "PDF com texto"', () => {
    render(<OcrStatusBadge status="not_needed" />)
    expect(screen.getByText(/PDF com texto/i)).toBeInTheDocument()
  })

  it('short=true usa labels curtos', () => {
    render(<OcrStatusBadge status="processing" short />)
    expect(screen.getByText(/OCR…/)).toBeInTheDocument()
  })

  it('status desconhecido cai em "OCR não avaliado"', () => {
    render(<OcrStatusBadge status="alien-status" />)
    expect(screen.getByText(/OCR não avaliado/i)).toBeInTheDocument()
  })
})

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PdfaStatusBadge, PDFA_BADGE_STATUSES } from '@/components/PdfaStatusBadge'

describe('PdfaStatusBadge', () => {
  it('cobre os 6 status canônicos', () => {
    expect(PDFA_BADGE_STATUSES).toEqual(
      expect.arrayContaining(['pending', 'processing', 'done', 'failed', 'not_needed', 'none'])
    )
  })

  it('renderiza label completo quando status=pending', () => {
    render(<PdfaStatusBadge status="pending" />)
    expect(screen.getByText(/PDF\/A pendente/i)).toBeInTheDocument()
  })

  it('renderiza label curto quando short=true', () => {
    render(<PdfaStatusBadge status="processing" short />)
    expect(screen.getByText('PDF/A…')).toBeInTheDocument()
  })

  it('renderiza done com label "PDF/A disponível"', () => {
    render(<PdfaStatusBadge status="done" />)
    expect(screen.getByText(/PDF\/A disponível/i)).toBeInTheDocument()
  })

  it('renderiza failed com variant destructive (label PDF/A falhou)', () => {
    render(<PdfaStatusBadge status="failed" />)
    expect(screen.getByText(/PDF\/A falhou/i)).toBeInTheDocument()
  })

  it('renderiza not_needed corretamente', () => {
    render(<PdfaStatusBadge status="not_needed" />)
    expect(screen.getByText(/PDF\/A não necessário/i)).toBeInTheDocument()
  })

  it('aceita objeto documento com pdfaStatus', () => {
    render(<PdfaStatusBadge documento={{ pdfaStatus: 'done' }} />)
    expect(screen.getByText(/PDF\/A disponível/i)).toBeInTheDocument()
  })

  it('status desconhecido cai em "none"', () => {
    render(<PdfaStatusBadge status="invalid_status_xyz" />)
    expect(screen.getByText(/PDF\/A não avaliado/i)).toBeInTheDocument()
  })

  it('documento sem pdfaStatus cai em "none"', () => {
    render(<PdfaStatusBadge documento={{ id: 'd1' }} />)
    expect(screen.getByText(/PDF\/A não avaliado/i)).toBeInTheDocument()
  })

  it('aria-label corresponde ao label', () => {
    render(<PdfaStatusBadge status="done" />)
    const badge = screen.getByLabelText(/PDF\/A disponível/i)
    expect(badge).toBeInTheDocument()
  })
})

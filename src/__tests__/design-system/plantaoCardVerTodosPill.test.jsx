/**
 * Pills de header no modelo "Extrato" (dono 31/08): a palavra no lugar do
 * ícone/link. PlantaoCard ("Ver todos") e StaffScheduleCard (editLabel) trocam
 * o visual sem perder a ação — e sem editLabel o lápis das outras telas fica.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PlantaoCard } from '@/design-system/components/anest/plantao-card'
import { StaffScheduleCard } from '@/design-system/components/anest/staff-schedule-card'

const plantoes = (n) =>
  Array.from({ length: n }, (_, i) => ({ hospital: `Hospital ${i + 1}`, data: '01/09', hora: '19:00' }))

describe('PlantaoCard — "Ver todos" como pill', () => {
  it('navegação: dispara onViewAll', () => {
    const onViewAll = vi.fn()
    render(<PlantaoCard items={plantoes(2)} onViewAll={onViewAll} showBadge={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver todos' }))
    expect(onViewAll).toHaveBeenCalledTimes(1)
  })

  it('expandable (FDS): alterna Ver todos → Recolher e dispara onToggleExpand', () => {
    const onToggleExpand = vi.fn()
    const items = plantoes(6)
    const { rerender } = render(
      <PlantaoCard items={items} maxItems={4} expandable expanded={false} onToggleExpand={onToggleExpand} showBadge={false} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Ver todos' }))
    expect(onToggleExpand).toHaveBeenCalledTimes(1)

    rerender(
      <PlantaoCard items={items} maxItems={4} expandable expanded onToggleExpand={onToggleExpand} showBadge={false} />
    )
    expect(screen.getByRole('button', { name: 'Recolher' })).toBeTruthy()
  })
})

describe('StaffScheduleCard — editLabel', () => {
  it('com editLabel a palavra substitui o lápis e dispara onEdit', () => {
    const onEdit = vi.fn()
    render(<StaffScheduleCard sections={[]} canEdit onEdit={onEdit} editLabel="Editar" />)
    const pill = screen.getByRole('button', { name: 'Editar escala' })
    expect(pill.textContent).toBe('Editar')
    expect(pill.querySelector('svg')).toBeNull()
    fireEvent.click(pill)
    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  it('sem editLabel o lápis continua (telas fora da Home intactas)', () => {
    render(<StaffScheduleCard sections={[]} canEdit onEdit={() => {}} />)
    const btn = screen.getByRole('button', { name: 'Editar escala' })
    expect(btn.querySelector('svg')).toBeTruthy()
    expect(btn.textContent).toBe('')
  })
})

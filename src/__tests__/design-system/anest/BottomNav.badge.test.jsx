/**
 * BottomNav — badge dot test (Instagram-style notification)
 *
 * Verifica que o BottomNav renderiza o dot vermelho quando item.badge === true
 * (usado pelo App.jsx para alertar cateter peridural ativo no Menu icon).
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { BottomNav } from '@/design-system/components/anest/bottom-nav'

const baseItems = [
  { icon: 'Home', label: 'Início', active: false, id: 'home' },
  { icon: 'Menu', label: 'Menu', active: false, id: 'menu' },
]

describe('BottomNav badge dot', () => {
  it('NÃO renderiza dot quando badge=false', () => {
    const { container } = render(<BottomNav items={baseItems} />)
    const dots = container.querySelectorAll('.bg-destructive')
    expect(dots.length).toBe(0)
  })

  it('renderiza dot vermelho quando item.badge=true', () => {
    const itemsWithBadge = [
      baseItems[0],
      { ...baseItems[1], badge: true },
    ]
    const { container } = render(<BottomNav items={itemsWithBadge} />)
    const dots = container.querySelectorAll('.bg-destructive')
    expect(dots.length).toBe(1)
    const dot = dots[0]
    expect(dot.className).toContain('rounded-full')
    expect(dot.className).toContain('absolute')
    expect(dot.className).toContain('ring-background')
  })

  it('aria-label do botão com badge ganha sufixo de notificações pendentes', () => {
    const itemsWithBadge = [
      baseItems[0],
      { ...baseItems[1], badge: true },
    ]
    render(<BottomNav items={itemsWithBadge} />)
    expect(
      screen.getByRole('button', { name: /menu \(notificações pendentes\)/i })
    ).toBeInTheDocument()
  })

  it('aria-label do botão SEM badge usa label normal', () => {
    render(<BottomNav items={baseItems} />)
    expect(screen.getByRole('button', { name: /^menu$/i })).toBeInTheDocument()
  })
})

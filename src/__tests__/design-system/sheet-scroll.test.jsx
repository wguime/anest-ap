/**
 * Sheet — o corpo TEM de rolar.
 *
 * Regressão de 29/07: o painel do Sheet tem altura FIXA (`h-[85vh]` em
 * POSITION_CLASSES, não max-h) e `overflow-hidden`. Sem um container de scroll,
 * tudo que passa da altura é cortado SEM barra de rolagem e fica inalcançável —
 * o usuário não vê nem descobre que existe. No detalhe do caso da Escala
 * Cirúrgica isso escondeu os status Atrasada/Suspensa/Passa para tarde depois
 * que o sheet ganhou três blocos novos, e o dono relatou "informações
 * escondidas" com o centro cirúrgico em andamento.
 *
 * Três dos cinco sheets do app já contornavam com `overflow-y-auto` no
 * className; dois não, e nada avisava. Por isso o teste é no DS: garante que
 * qualquer sheet novo nasce rolando.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { ThemeProvider, Sheet, SheetContent, SheetHeader, SheetTitle } from '@/design-system'

const wrap = ({ children }) => <ThemeProvider>{children}</ThemeProvider>

const montar = (props = {}) => render(
  <Sheet open onOpenChange={vi.fn()}>
    <SheetContent side="bottom" {...props}>
      <SheetHeader><SheetTitle>Detalhe</SheetTitle></SheetHeader>
      <p>topo do conteúdo</p>
      <button type="button">Passa para tarde</button>
    </SheetContent>
  </Sheet>,
  { wrapper: wrap },
)

describe('Sheet — corpo rolável', () => {
  it('renderiza um corpo com scroll vertical', () => {
    montar()
    const corpo = document.querySelector('[data-slot="sheet-body"]')
    expect(corpo).toBeTruthy()
    expect(corpo.className).toContain('overflow-y-auto')
    // min-h-0 é o que permite o flex item encolher e de fato rolar; sem ele o
    // container cresce com o conteúdo e o corte volta, silenciosamente.
    expect(corpo.className).toContain('min-h-0')
  })

  it('põe o conteúdo DENTRO do corpo rolável — inclusive o que fica no fim', () => {
    montar()
    const corpo = document.querySelector('[data-slot="sheet-body"]')
    // o último controle é o que sumia da tela no relato do dono
    expect(corpo.contains(screen.getByRole('button', { name: 'Passa para tarde' }))).toBe(true)
    expect(corpo.contains(screen.getByText('topo do conteúdo'))).toBe(true)
  })

  it('mantém o ✕ FORA do corpo, para não rolar junto com o conteúdo', () => {
    montar()
    const corpo = document.querySelector('[data-slot="sheet-body"]')
    const fechar = screen.getByRole('button', { name: 'Fechar' })
    expect(corpo.contains(fechar)).toBe(false)
  })

  it('não perde o scroll quando a página passa className própria', () => {
    // as páginas passam max-h; o merge de classes não pode comer o overflow
    montar({ className: "max-h-[85vh]" })
    const corpo = document.querySelector('[data-slot="sheet-body"]')
    expect(corpo.className).toContain('overflow-y-auto')
  })
})

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

/**
 * CELULAR DEITADO — a folha de baixo vira PAINEL LATERAL (dono 27/08).
 *
 * Em pé ela ocupa 85% da altura e sobra tela por baixo; deitado os mesmos 85%
 * são 331px de 390 e ela cobre a página inteira, apagando o contexto de onde a
 * pessoa estava — que é justamente o que uma folha não deve fazer. Medido no app
 * depois da mudança: painel em x=424, 420 × 390px, com 424px de tela viva à
 * esquerda; em pé, o mesmo sheet segue em y=349, 390 × 495px.
 *
 * ⚠️ jsdom não avalia a media query da variante: o que se trava aqui é a REGRA
 * gravada nas classes, e sobretudo que ela seja PREFIXADA — uma classe de painel
 * lateral sem `deitado:` viraria o sheet do app inteiro no retrato.
 */
describe('Sheet — deitado a folha de baixo vira painel lateral', () => {
  const painel = () => document.querySelector('[data-slot="sheet-content"]')

  it('ancora à direita, em altura cheia, só deitado', () => {
    montar()
    const cls = painel().className
    for (const regra of [
      'deitado:right-0', 'deitado:left-auto', 'deitado:inset-y-0',
      'deitado:w-[420px]', 'deitado:!h-full', 'deitado:max-h-none',
      'deitado:rounded-l-[20px]',
    ]) {
      expect(cls).toContain(regra)
    }
  })

  it('INVARIANTE: o retrato continua sendo a folha de baixo', () => {
    montar()
    const cls = painel().className
    // as regras do modo em pé seguem sem prefixo e intactas
    expect(cls).toContain('inset-x-0')
    expect(cls).toContain('bottom-0')
    expect(cls).toContain('h-[85vh]')
    expect(cls).toContain('rounded-t-[20px]')
    // ⚠️ e NENHUMA regra de painel lateral pode existir sem a variante: sem este
    // laço, um `right-0` solto ancoraria o sheet à direita no celular em pé.
    for (const cls1 of cls.split(/\s+/)) {
      if (/^(right-0|left-auto|inset-y-0|w-\[420px\]|max-h-none|rounded-l-)/.test(cls1)) {
        throw new Error(`regra de painel lateral sem a variante deitado: "${cls1}"`)
      }
    }
  })

  it('o lado `right` do DS não é tocado — ele já é lateral', () => {
    render(
      <Sheet open onOpenChange={vi.fn()}>
        <SheetContent side="right"><SheetHeader><SheetTitle>x</SheetTitle></SheetHeader></SheetContent>
      </Sheet>,
      { wrapper: wrap },
    )
    const laterais = [...document.querySelectorAll('[data-slot="sheet-content"]')]
    const cls = laterais[laterais.length - 1].className
    expect(cls).toContain('sm:w-[420px]')
    expect(cls).not.toContain('deitado:')
  })
})

/**
 * A FRONTEIRA entre o horizontal do TOQUE e o do DESKTOP (dono 08/09).
 *
 * O modo horizontal nasceu para 844×390, onde ALTURA é o recurso caro: por isso
 * a navegação vira faixa lateral, o atalho da Gestão vira quadrado e o padding
 * aperta para 12px. Numa tela de 900px de altura essas mesmas decisões viram o
 * oposto do que resolviam — quatro ícones espalhados por 900px, atalho de 270px
 * de lado com o texto no topo, conteúdo colado na borda. O dono viu no notebook
 * e pediu: "no desktop (APENAS no desktop) deixe a bottom nav na parte inferior
 * da tela e não na lateral", "deixe os cards da página de gestão com a mesma
 * altura dos cards da página menu", "os vãos vazios me incomodam!!".
 *
 * Daí três variantes, e é a REGRA GRAVADA NAS CLASSES que este arquivo trava:
 *   `deitado:` → o que é igual nos dois (duas colunas, cabeçalho de 44px)
 *   `faixa:`   → só toque (nav lateral, quadrado, padding apertado)
 *   `desktop:` → só mouse (barra embaixo, 140px, Home em multi-coluna)
 *
 * ⚠️ Trocar `faixa:` de volta por `deitado:` é uma letra de diferença, passa em
 * build e em lint, e devolve ao notebook exatamente a tela que ele recusou.
 * jsdom não avalia media query: quem mede pixel são as fotos do app.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ler = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')

const TAILWIND = ler('tailwind.config.js')
const CSS = ler('src/index.css')
const NAV = ler('src/design-system/components/anest/bottom-nav.jsx')
const GESTAO = ler('src/pages/GestaoPage.jsx')
const HOME = ler('src/pages/HomePage.jsx')
const ESCALA = ler('src/pages/escala-cirurgica/EscalaCirurgicaPage.jsx')
const HEADER = ler('src/components/PageHeader.jsx')

describe('as três variantes do horizontal', () => {
  it('deitado é a horizontal inteira; faixa é o toque; desktop é o mouse', () => {
    expect(TAILWIND).toContain('deitado: { raw: "(orientation: landscape)" }')
    expect(TAILWIND).toContain('faixa: { raw: "(orientation: landscape) and (pointer: coarse)" }')
    expect(TAILWIND).toContain('desktop: { raw: "(orientation: landscape) and (pointer: fine)" }')
  })

  it('faixa e desktop vêm DEPOIS de deitado — o Tailwind resolve empate pela ordem', () => {
    expect(TAILWIND.indexOf('faixa: { raw')).toBeGreaterThan(TAILWIND.indexOf('deitado: { raw'))
    expect(TAILWIND.indexOf('desktop: { raw')).toBeGreaterThan(TAILWIND.indexOf('deitado: { raw'))
  })
})

describe('a navegação lateral é só do toque', () => {
  it('a barra vira faixa vertical sob `faixa:`, nunca sob `deitado:`', () => {
    expect(NAV).toContain('faixa:flex-col')
    expect(NAV).toContain('faixa:w-[var(--faixa-lateral)]')
    expect(NAV).not.toContain('deitado:flex-col')
    expect(NAV).not.toContain('deitado:w-[var(--faixa-lateral)]')
  })

  it('quem é fixo recua a faixa sob `faixa:` — no desktop não há o que recuar', () => {
    expect(HEADER).toContain('faixa:left-[var(--faixa-lateral)]')
    expect(HEADER).not.toContain('deitado:left-[var(--faixa-lateral)]')
  })

  it('o CSS que recua o body e zera o pb-* exige TOQUE — as duas metades casam', () => {
    // no desktop a barra é embaixo: sem a reserva do pb-*, o último card fica atrás dela
    expect(CSS).toContain('@media (orientation: landscape) and (pointer: coarse) {')
    const bloco = CSS.slice(CSS.indexOf('@media (orientation: landscape) and (pointer: coarse) {'))
    expect(bloco.slice(0, 900)).toContain('padding-left: var(--faixa-lateral)')
    expect(bloco.slice(0, 900)).toContain('.pb-28')
  })
})

describe('o que aperta a tela é do celular, não do desktop', () => {
  it('o padding de 12px das três páginas é `faixa:`', () => {
    expect(GESTAO).toContain('faixa:!px-3')
    expect(HOME).toContain('faixa:!px-3')
    expect(ESCALA).toContain('faixa:px-3')
    expect(GESTAO).not.toContain('deitado:!px-3')
    expect(HOME).not.toContain('deitado:!px-3')
    expect(ESCALA).not.toContain('deitado:px-3')
  })

  it('o atalho da Gestão só é QUADRADO no toque — no desktop vale o 140px do WidgetCard', () => {
    expect(GESTAO).toContain('faixa:aspect-square')
    expect(GESTAO).not.toContain('deitado:aspect-square')
    // as duas colunas da grade de 10 continuam valendo nos dois
    expect(GESTAO).toContain('deitado:col-span-2')
  })

  it('o cartão de Comunicados acompanha a fileira no desktop', () => {
    expect(GESTAO).toContain('desktop:h-[140px]')
  })
})

describe('a Home não deixa vão no desktop', () => {
  it('multi-coluna no desktop, grade no resto', () => {
    // multi-coluna não deixa buraco; a grade por linha deixava 140px entre
    // Escala e Férias, que foi a queixa do dono
    expect(HOME).toContain('desktop:columns-2')
    expect(HOME).toContain('deitado:grid-cols-2')
  })

  it('a multi-coluna NÃO vale no celular — lá Plantões sumiria da vista (26/08)', () => {
    expect(HOME).not.toContain('faixa:columns-2')
    expect(HOME).not.toMatch(/(?<!desktop:)\bdeitado:columns-2/)
  })

  it('os cartões empilhados recuperam a margem de baixo na multi-coluna', () => {
    // o `gap` da multi-coluna separa COLUNAS, não os cartões dentro de uma
    expect(HOME).toContain('[&>*]:desktop:mb-3')
  })
})

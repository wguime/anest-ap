/**
 * Card "Adesão à Escala Cirúrgica" no DESKTOP (dono 15/10/2026: "no desktop o card de 'Adesão
 * à escala cirúrgica' não vem com informações assim como está no mobile").
 *
 * O desktop conta como tela deitada, e deitado o card encolhia para 86 px e escondia os quatro
 * números — sobrava só o título. Escolhido por imagem o modelo B de
 * `.tmp/adesao-card-desktop.html`: no desktop (deitado + mouse) a linha de destaques da Home
 * volta aos 120 px do celular, com os números no card de adesão e o resumo nos artigos. Celular
 * ou tablet deitado continua com 86 px; as páginas de Notícias não mudam.
 *
 * jsdom não avalia media query: a trava é o contrato das classes (`desktop:` vem depois de
 * `deitado:` na lista do tailwind.config, então vence o empate).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@/design-system'

const { estado } = vi.hoisted(() => ({ estado: { dados: null, destaques: [] } }))
vi.mock('@/contexts/DeferredReadyContext', () => ({ useDeferredReady: () => true }))
vi.mock('@/hooks/useAdesaoEscala', () => ({ useAdesaoEscala: () => ({ dados: estado.dados }) }))
vi.mock('@/lib/escalaAdesao', async (importOriginal) => ({
  ...(await importOriginal()),
  resumoCard: (d) => d,
}))
vi.mock('@/contexts/NoticiasContext', () => ({
  useNoticias: () => ({ highlights: estado.destaques, highlightsLoaded: true, loadHighlights: () => {} }),
}))

import { AdesaoEscalaCard } from '@/components/noticias/AdesaoEscalaCard'
import { NoticiaCard } from '@/components/noticias/NoticiaCard'
import { NoticiasCarousel } from '@/components/noticias/NoticiasCarousel'

const temClasse = (el, c) => el.className.split(/\s+/).includes(c)
const NOTICIA = {
  id: 'n1', fonte: 'BJAN', articleType: 'Review', publicadoEm: '2026-10-08T12:00:00Z',
  tituloPt: 'Remoção do dispositivo de via aérea acordado versus em plano profundo',
  resumoPt: 'Revisão sistemática e metanálise.',
}

beforeEach(() => {
  estado.dados = { ini: 59, ter: 69, tot: 17, alertas: 35 }
  estado.destaques = [NOTICIA]
})

describe('card de adesão no desktop — modelo B (15/10/2026)', () => {
  it('no desktop o card volta aos 120 px e mostra os quatro números; deitado no toque segue 86 px sem eles', () => {
    render(<ThemeProvider><AdesaoEscalaCard onClick={() => {}} /></ThemeProvider>)
    const card = screen.getByRole('button', { name: /Adesão à Escala Cirúrgica/ })
    expect(temClasse(card, 'deitado:h-[86px]')).toBe(true)
    expect(temClasse(card, 'desktop:h-[120px]')).toBe(true)
    const numeros = screen.getByText('início').closest('div')
    expect(temClasse(numeros, 'deitado:hidden')).toBe(true)
    expect(temClasse(numeros, 'desktop:flex')).toBe(true)
    for (const rotulo of ['início', 'término', 'tempo total', 'com alerta']) {
      expect(screen.getByText(rotulo)).toBeTruthy()
    }
  })

  it('sem dado ainda: o card aparece sem os números, como sempre', () => {
    estado.dados = null
    render(<ThemeProvider><AdesaoEscalaCard onClick={() => {}} /></ThemeProvider>)
    expect(screen.queryByText('início')).toBeNull()
    expect(screen.getByText(/Por cargo e por pessoa/).className).toMatch(/desktop:line-clamp-1/)
  })

  it('o carrossel da Home liga a altura do celular nos artigos (linha da mesma altura)', () => {
    render(<ThemeProvider><NoticiasCarousel onNavigate={() => {}} /></ThemeProvider>)
    const artigo = screen.getByRole('button', { name: NOTICIA.tituloPt })
    expect(temClasse(artigo, 'desktop:h-[120px]')).toBe(true)
    expect(temClasse(screen.getByText(NOTICIA.resumoPt), 'desktop:line-clamp-1')).toBe(true)
  })

  it('fora da Home (Notícias, Categoria) o card de artigo não muda', () => {
    render(<ThemeProvider><NoticiaCard noticia={NOTICIA} variant="carousel" onClick={() => {}} /></ThemeProvider>)
    const artigo = screen.getByRole('button', { name: NOTICIA.tituloPt })
    expect(artigo.className).not.toMatch(/desktop:/)
    expect(screen.getByText(NOTICIA.resumoPt).className).not.toMatch(/desktop:/)
  })
})

/**
 * Card do infográfico "Evolução da adesão" na Home (dono 27/10/2026): à ESQUERDA do card de
 * adesão, publicado em 28/10 às 9h. O código vai antes (deploy com turno em andamento derruba
 * quem está com o app aberto) e o card só aparece na hora — inclusive na Home que já estava aberta.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from '@/design-system'

const { estado } = vi.hoisted(() => ({ estado: { ev: null } }))
vi.mock('@/contexts/DeferredReadyContext', () => ({ useDeferredReady: () => true }))
vi.mock('@/hooks/useAdesaoEscala', () => ({
  useAdesaoEscala: () => ({ dados: null }),
  useAdesaoSemanas: () => ({ dados: estado.ev ? {} : null }),
}))
vi.mock('@/lib/escalaAdesaoSemanal', async (importOriginal) => ({
  ...(await importOriginal()),
  montarEvolucao: () => estado.ev,
}))
vi.mock('@/contexts/NoticiasContext', () => ({
  useNoticias: () => ({ highlights: [], highlightsLoaded: true, loadHighlights: () => {} }),
}))

import { EVOLUCAO_ADESAO_DESDE, EvolucaoAdesaoCard } from '@/components/noticias/EvolucaoAdesaoCard'
import { NoticiasCarousel } from '@/components/noticias/NoticiasCarousel'

const INI = [54.6, 62.2, 65.8, 77.0, 86.3]
const EV = {
  serie: INI.map((ini, i) => ({ rotulo: ['21/09', '28/09', '05/10', '12/10', '19/10'][i], engajadosTotal: [8, 16, 18, 17, 22][i], ini, ter: [68, 74.3, 73, 77.8, 89.48][i] })),
}

beforeEach(() => { estado.ev = EV })
afterEach(() => { vi.useRealTimers() })

describe('card "Evolução da adesão"', () => {
  it('publicação marcada para 28/10/2026 às 9h de Brasília', () => {
    expect(new Date(EVOLUCAO_ADESAO_DESDE).toISOString()).toBe('2026-10-28T12:00:00.000Z')
  })

  it('antes das 9h a linha dos Destaques não muda; às 9h o card entra À ESQUERDA do de adesão, sem recarregar', () => {
    vi.useFakeTimers({ now: EVOLUCAO_ADESAO_DESDE - 10_000, toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    render(<ThemeProvider><NoticiasCarousel onNavigate={() => {}} /></ThemeProvider>)
    expect(screen.queryByText('Evolução da adesão à escala')).toBeNull()
    expect(screen.getByText('Adesão à Escala Cirúrgica')).toBeTruthy()

    act(() => { vi.advanceTimersByTime(11_000) })
    const novo = screen.getByText('Evolução da adesão à escala')
    const adesao = screen.getByText('Adesão à Escala Cirúrgica')
    // DOCUMENT_POSITION_FOLLOWING: o de adesão vem DEPOIS do novo
    expect(novo.compareDocumentPosition(adesao) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('os 4 números: engajados 8→22, início 86%, término 89%, aumento do início +15% por semana', () => {
    render(<ThemeProvider><EvolucaoAdesaoCard onClick={() => {}} /></ThemeProvider>)
    for (const t of ['8→22', '86%', '89%', '+15%', 'engajados', 'início/semana', 'sem. de 19/10']) expect(screen.getByText(t)).toBeTruthy()
  })

  it('mesma altura dos vizinhos (120 px; 86 px deitado no toque; 120 px no desktop)', () => {
    render(<ThemeProvider><EvolucaoAdesaoCard onClick={() => {}} /></ThemeProvider>)
    const classes = screen.getByRole('button', { name: /Evolução da adesão/ }).className.split(/\s+/)
    for (const c of ['h-[120px]', 'deitado:h-[86px]', 'desktop:h-[120px]']) expect(classes).toContain(c)
  })

  it('sem dado ainda: aparece sem os números; o toque abre o infográfico', () => {
    estado.ev = null
    const abrir = vi.fn()
    vi.useFakeTimers({ now: EVOLUCAO_ADESAO_DESDE + 1000, toFake: ['Date'] })
    render(<ThemeProvider><NoticiasCarousel onNavigate={abrir} /></ThemeProvider>)
    expect(screen.queryByText('8→22')).toBeNull()
    expect(screen.getByText(/Engajados, início e término semana a semana/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Evolução da adesão/ }))
    expect(abrir).toHaveBeenCalledWith('evolucaoAdesao')
  })
})

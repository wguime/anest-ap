/**
 * useTheme — a moldura do sistema acompanha o tema (16/09/2026).
 *
 * `<meta name="theme-color">` é o que o Android (barra de status/endereço) e o
 * Safari 15+ pintam por cima da página; era #004225 fixo e só o Android via —
 * uma das "tonalidades diferentes" entre aparelhos. Agora:
 *  - aplicar o tema escreve theme-color = fundo do tema e color-scheme
 *    (`only light` no claro, `dark` no escuro);
 *  - uma página pode SEGURAR outra cor enquanto montada (LoginPage, verde) via
 *    `dataset.themeColorHold`, e o tema não a atropela;
 *  - soltar o hold devolve a cor do tema em vigor.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, act, cleanup } from '@testing-library/react'
import { ThemeProvider, useTheme, THEME_COLOR, syncThemeMeta, currentThemeFromDocument } from '../../design-system/hooks/useTheme.jsx'

const meta = (name) => document.head.querySelector(`meta[name="${name}"]`)?.getAttribute('content')

let api
function Sonda() {
  api = useTheme()
  return null
}

beforeEach(() => {
  localStorage.clear()
  document.head.querySelectorAll('meta').forEach((m) => m.remove())
  document.documentElement.className = ''
  delete document.documentElement.dataset.themeColorHold
})
afterEach(() => cleanup())

describe('useTheme → meta theme-color / color-scheme', () => {
  it('tema claro: theme-color = fundo claro e color-scheme = only light (cria as metas se faltarem)', () => {
    localStorage.setItem('anest-theme', 'light')
    render(<ThemeProvider><Sonda /></ThemeProvider>)
    expect(meta('theme-color')).toBe(THEME_COLOR.light)
    expect(meta('color-scheme')).toBe('only light')
  })

  it('tema escuro: theme-color = fundo escuro e color-scheme = dark; alternar volta ao claro', () => {
    localStorage.setItem('anest-theme', 'dark')
    render(<ThemeProvider><Sonda /></ThemeProvider>)
    expect(meta('theme-color')).toBe(THEME_COLOR.dark)
    expect(meta('color-scheme')).toBe('dark')
    act(() => api.toggleTheme())
    expect(document.documentElement.classList.contains('light')).toBe(true)
    expect(meta('theme-color')).toBe(THEME_COLOR.light)
    expect(meta('color-scheme')).toBe('only light')
  })

  it('hold (LoginPage): a cor segurada vence o tema; soltar devolve a do tema em vigor', () => {
    localStorage.setItem('anest-theme', 'light')
    render(<ThemeProvider><Sonda /></ThemeProvider>)
    document.documentElement.dataset.themeColorHold = '#006837'
    syncThemeMeta(currentThemeFromDocument())
    expect(meta('theme-color')).toBe('#006837')
    // o tema muda com o hold ativo: a moldura continua segurada
    act(() => api.setTheme('dark'))
    expect(meta('theme-color')).toBe('#006837')
    expect(meta('color-scheme')).toBe('dark')
    delete document.documentElement.dataset.themeColorHold
    syncThemeMeta(currentThemeFromDocument())
    expect(meta('theme-color')).toBe(THEME_COLOR.dark)
  })
})

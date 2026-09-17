/**
 * anest-theme.css — travas do que "o DS no ar" é, iguais em todo aparelho.
 *
 * Origem (16/09/2026): o dono viu tonalidades diferentes fora do iPhone. A
 * investigação achou (a) 26 tokens cujo hex do comentário estava a ≥2 ΔE do que
 * o tripleto HSL renderizava — um "conserto" ingênuo mudaria a cor do app
 * inteiro; (b) a barra inferior com um ramo só para iOS (opaca) e outro para o
 * resto (blur + saturate), que mudava de tom conforme o conteúdo por baixo;
 * (c) `color-scheme: light` sem `only`, que deixa Chrome Android e Samsung
 * Internet escurecerem a página por conta própria; (d) `theme-color` fixo
 * (#004225) que só o Android mostrava, e diferente do manifest.
 *
 * Aqui:
 *  - todo token com hex no comentário renderiza aquele hex (ΔE < 2);
 *  - a barra inferior tem UMA regra, sem backdrop-filter e sem ramo por plataforma;
 *  - :root é `only light` e .dark é `dark`;
 *  - THEME_COLOR (moldura do sistema) é exatamente o fundo que o CSS renderiza,
 *    e index.html + manifest.json partem do mesmo valor.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { THEME_COLOR } from '../../design-system/hooks/useTheme.jsx'

const RAIZ = path.resolve(__dirname, '../../..')
const CSS = fs.readFileSync(path.join(RAIZ, 'src/styles/anest-theme.css'), 'utf8')
const INDEX_HTML = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8')
const MANIFEST = JSON.parse(fs.readFileSync(path.join(RAIZ, 'public/manifest.json'), 'utf8'))

// --- hsl() → sRGB 8 bits, como o browser (medido igual ao Chromium e ao WebKit) ---
function hslParaRgb(h, s, l) {
  s /= 100; l /= 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r, g, b
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return [r, g, b].map((v) => Math.round((v + m) * 255))
}
const paraHex = (rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()
const deHex = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
function lab([r, g, b]) {
  const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  const [R, G, B] = [f(r), f(g), f(b)]
  let X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047
  let Y = R * 0.2126 + G * 0.7152 + B * 0.0722
  let Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883
  const t = (v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116)
  ;[X, Y, Z] = [t(X), t(Y), t(Z)]
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)]
}
const deltaE = (a, b) => { const A = lab(a), B = lab(b); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]) }

/** Lê `--token: H S% L%; /* #HEX ... *\/` dos blocos :root e .dark, separados. */
function lerTokens() {
  const re = /(--[a-z0-9-]+):\s*(\d+)\s+(\d+)%\s+(\d+)%;\s*\/\*\s*(#[0-9A-Fa-f]{6})/g
  const out = { light: [], dark: [] }
  let escopo = 'light'
  for (const linha of CSS.split('\n')) {
    if (/^\s*\.dark\s*\{/.test(linha)) escopo = 'dark'
    let m
    re.lastIndex = 0
    while ((m = re.exec(linha))) {
      out[escopo].push({ token: m[1], hsl: [+m[2], +m[3], +m[4]], hex: m[5].toUpperCase() })
    }
  }
  return out
}

function bloco(seletor) {
  const i = CSS.indexOf(seletor)
  if (i < 0) return ''
  const fim = CSS.indexOf('}', i)
  return CSS.slice(i, fim)
}

describe('anest-theme.css — tokens', () => {
  const tokens = lerTokens()

  it('tem os dois temas com tokens', () => {
    expect(tokens.light.length).toBeGreaterThan(40)
    expect(tokens.dark.length).toBeGreaterThan(40)
  })

  it.each(['light', 'dark'])('%s: todo tripleto renderiza o hex do comentário (ΔE < 2)', (tema) => {
    const fora = tokens[tema]
      .map((t) => ({ ...t, servido: paraHex(hslParaRgb(...t.hsl)) }))
      .map((t) => ({ ...t, dE: deltaE(deHex(t.servido), deHex(t.hex)) }))
      .filter((t) => t.dE >= 2)
      .map((t) => `${t.token}: ${t.hsl.join(' ')} renderiza ${t.servido}, comentário diz ${t.hex} (ΔE ${t.dE.toFixed(1)})`)
    expect(fora).toEqual([])
  })
})

describe('anest-theme.css — igual em todo aparelho', () => {
  it('a barra inferior tem uma regra só, sem blur e sem ramo por plataforma', () => {
    expect(CSS).not.toMatch(/@supports\s*\(\s*-webkit-touch-callout/)
    const regras = [...CSS.matchAll(/\.bottom-nav-glass\s*\{[^}]*\}/g)].map((m) => m[0])
    expect(regras.length).toBeGreaterThanOrEqual(2) // light + .dark
    for (const r of regras) {
      expect(r).not.toMatch(/backdrop-filter/)
      expect(r).toMatch(/background-color:\s*hsl\(var\(--(muted|background)\) \/ 0\.97\)/)
    }
    // nenhum @supports que devolva outra cor à barra
    expect(CSS).not.toMatch(/@supports[^{]*\{[^}]*\.bottom-nav-glass/)
  })

  it(':root opta por `only light` (opt-out do escuro forçado) e .dark declara `dark`', () => {
    expect(bloco(':root {')).toMatch(/color-scheme:\s*only light;/)
    expect(bloco('.dark {')).toMatch(/color-scheme:\s*dark;/)
  })
})

describe('moldura do sistema (theme-color) = fundo da página', () => {
  const tokens = lerTokens()
  const fundo = (tema) => paraHex(hslParaRgb(...tokens[tema].find((t) => t.token === '--background').hsl))

  it('THEME_COLOR.light/dark é o que --background renderiza em cada tema', () => {
    expect(THEME_COLOR.light).toBe(fundo('light'))
    expect(THEME_COLOR.dark).toBe(fundo('dark'))
  })

  it('index.html parte do tema claro: theme-color = fundo claro, color-scheme = only light', () => {
    expect(INDEX_HTML).toMatch(new RegExp(`<meta name="theme-color" content="${THEME_COLOR.light}" />`))
    expect(INDEX_HTML).toMatch(/<meta name="color-scheme" content="only light" \/>/)
    // a ordem importa para o Chrome Android: color-scheme antes de theme-color
    expect(INDEX_HTML.indexOf('name="color-scheme"')).toBeLessThan(INDEX_HTML.indexOf('name="theme-color"'))
  })

  it('manifest.json usa o mesmo theme_color do index.html', () => {
    expect(MANIFEST.theme_color).toBe(THEME_COLOR.light)
  })
})

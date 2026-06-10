/**
 * Fundação F2 (Etapa A) — testes do mapa página ↔ slug de URL e do guard
 * paramétrico de permissões.
 *
 * Estes testes leem src/App.jsx como texto (fs) para extrair os cases reais
 * do switch e as chaves de PAGE_TO_CARD — assim o mapa de slugs e a lista de
 * páginas sem card NÃO driftam silenciosamente quando alguém adiciona um
 * case novo em renderAppPage().
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { PAGES, toKebab, pageToPath, pathToPage } from '../../navigation/pageSlugs'

const appSrc = fs.readFileSync(path.resolve(__dirname, '../../App.jsx'), 'utf8')

// Cases do switch de renderAppPage() (a partir de "switch (currentPage)" o
// switch do handleNavClick fica de fora porque vem antes no arquivo)
const switchSrc = appSrc.slice(appSrc.indexOf('switch (currentPage)'))
const switchCases = [...new Set([...switchSrc.matchAll(/case '([^']+)'/g)].map((m) => m[1]))]

// Chaves de PAGE_TO_CARD (bloco flat `'pagina': 'card'` / `pagina: 'card'`)
const ptcBlock = appSrc.slice(
  appSrc.indexOf('const PAGE_TO_CARD = {'),
  appSrc.indexOf('}', appSrc.indexOf('const PAGE_TO_CARD = {'))
)
const pageToCardKeys = new Set(
  [...ptcBlock.matchAll(/^\s*'?([\w-]+)'?\s*:/gm)].map((m) => m[1]).filter((k) => k !== 'const')
)

describe('pageSlugs — drift contra o switch de App.jsx', () => {
  it('todo case do switch está na lista canônica PAGES', () => {
    const missing = switchCases.filter((c) => !PAGES.includes(c))
    expect(missing).toEqual([])
  })

  it('toda página de PAGES existe como case no switch (sem entradas mortas)', () => {
    const dead = PAGES.filter((p) => !switchCases.includes(p))
    expect(dead).toEqual([])
  })
})

describe('pageSlugs — conversão página ↔ URL', () => {
  it("home é a raiz: pageToPath('home') === '/' e '/' resolve para home", () => {
    expect(pageToPath('home')).toBe('/')
    expect(pathToPage('/')).toBe('home')
    expect(pathToPage('/home')).toBe('home')
  })

  it('roundtrip: toda página navega para um path que resolve de volta (página ou alias do mesmo slug)', () => {
    for (const page of PAGES) {
      const resolved = pathToPage(pageToPath(page))
      expect(resolved, `pageToPath('${page}') → '${pageToPath(page)}' não resolveu`).not.toBeNull()
      // Alias (incidenteGestao → incidente-gestao): basta o slug coincidir —
      // os cases renderizam o mesmo componente
      expect(toKebab(resolved)).toBe(toKebab(page))
    }
  })

  it('slugs são kebab-case puros (URL nunca expõe camelCase)', () => {
    for (const page of PAGES) {
      const slug = pageToPath(page).slice(1) || 'home'
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    }
  })

  it('colisões de slug são apenas os pares alias conhecidos', () => {
    const bySlug = new Map()
    for (const page of PAGES) {
      const slug = toKebab(page)
      bySlug.set(slug, [...(bySlug.get(slug) ?? []), page])
    }
    const collisions = [...bySlug.entries()].filter(([, pages]) => pages.length > 1)
    expect(collisions.map(([slug]) => slug).sort()).toEqual(['denuncia-gestao', 'incidente-gestao'])
    // Reverse map prefere o nome canônico (igual ao slug)
    expect(pathToPage('/incidente-gestao')).toBe('incidente-gestao')
    expect(pathToPage('/denuncia-gestao')).toBe('denuncia-gestao')
  })

  it('slug desconhecido retorna null (App redireciona para home)', () => {
    expect(pathToPage('/nao-existe-xyz')).toBeNull()
    expect(pathToPage('/verificar')).toBeNull()
  })

  it('ignora segmentos extras do path (usa só o primeiro)', () => {
    expect(pathToPage('/biblioteca/qualquer-coisa')).toBe('biblioteca')
  })
})

describe('guard paramétrico — PAGE_TO_CARD cobre as páginas sensíveis', () => {
  // Páginas deliberadamente SEM card de permissão: hubs de navegação, páginas
  // pessoais e cases com guard interno próprio. Adicionar um case novo ao
  // switch sem entrada em PAGE_TO_CARD quebra este teste — adicione o card OU
  // adicione aqui COM justificativa.
  const PUBLIC_OR_INTERNALLY_GUARDED = new Set([
    'home', // hub raiz
    'gestao', // hub de navegação (cards internos têm seus próprios guards)
    'educacao', // hub de navegação
    'menu', // alias de menuPage
    'menuPage', // hub de navegação
    'dashboard', // alias de dashboardExecutivo (guard via case + visibilidade admin)
    'profile', // página pessoal do próprio usuário
    'personalizarAtalhos', // preferência pessoal
    'searchResults', // busca global (resultados já filtrados por permissão)
    'noticias', // conteúdo público interno
    'noticia-detalhe', // conteúdo público interno
    'categoria-noticias', // conteúdo público interno
    'messageDetail', // mensagens do próprio usuário (ownership no service/RLS)
    'documento-detalhe', // ownership/visibilidade validados na página + RLS
    'bulkImport', // guard interno: isBulkImportEnabled() + admin (App.jsx case)
    'centroGestao', // guard interno: canAccessCentroGestao (App.jsx case)
    'permissions', // guard interno: canAccessCentroGestao (App.jsx case)
  ])

  it('todo case do switch tem card em PAGE_TO_CARD ou está na lista justificada', () => {
    const uncovered = switchCases.filter(
      (c) => !pageToCardKeys.has(c) && !PUBLIC_OR_INTERNALLY_GUARDED.has(c)
    )
    expect(uncovered).toEqual([])
  })

  it('cases com guard interno realmente têm o guard no código', () => {
    // Regressão do fix 2026-06-10: /permissions renderizava CentroGestaoPage
    // sem canAccessCentroGestao
    // Slice ancorado em início de linha — comentários podem conter "case '..."
    const start = switchSrc.indexOf("case 'permissions'")
    const nextCase = switchSrc.slice(start + 1).search(/\n\s*case '/)
    const permissionsCase = switchSrc.slice(start, start + 1 + nextCase)
    expect(permissionsCase).toContain('canAccessCentroGestao')
  })
})

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
import { PAGES, PAGE_PARAM, toKebab, pageToPath, pathToPage, parsePath } from '../../navigation/pageSlugs'

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

describe('F2 Etapa B — params de path (PAGE_PARAM)', () => {
  it('toda página em PAGE_PARAM existe em PAGES e é canônica (nome === slug)', () => {
    for (const page of Object.keys(PAGE_PARAM)) {
      expect(PAGES, `'${page}' não está em PAGES`).toContain(page)
      expect(page, `'${page}' precisa ser o nome canônico (igual ao slug)`).toBe(toKebab(page))
    }
  })

  it('pageToPath inclui o param como segundo segmento', () => {
    expect(pageToPath('documento-detalhe', { documentoId: 'abc-123' })).toBe('/documento-detalhe/abc-123')
    expect(pageToPath('noticia-detalhe', { noticiaId: '42' })).toBe('/noticia-detalhe/42')
  })

  it('pageToPath sem params (ou sem o param da página) cai no path base', () => {
    expect(pageToPath('documento-detalhe')).toBe('/documento-detalhe')
    expect(pageToPath('documento-detalhe', null)).toBe('/documento-detalhe')
    expect(pageToPath('documento-detalhe', { returnTo: 'biblioteca' })).toBe('/documento-detalhe')
  })

  it('página sem PAGE_PARAM nunca ganha segmento, mesmo com params', () => {
    expect(pageToPath('biblioteca', { qualquer: '1' })).toBe('/biblioteca')
    expect(pageToPath('home', { x: 'y' })).toBe('/')
  })

  it('roundtrip com param: parsePath devolve { page, params } para todas as PAGE_PARAM', () => {
    for (const [page, paramKey] of Object.entries(PAGE_PARAM)) {
      const parsed = parsePath(pageToPath(page, { [paramKey]: 'id-xyz' }))
      expect(parsed.page).toBe(page)
      expect(parsed.params).toEqual({ [paramKey]: 'id-xyz' })
    }
  })

  it('id com caracteres especiais sobrevive ao roundtrip (encode/decode)', () => {
    const id = 'a/b c?&=#'
    const path = pageToPath('noticia-detalhe', { noticiaId: id })
    expect(path).not.toContain(' ')
    expect(parsePath(path).params).toEqual({ noticiaId: id })
  })

  it('id ausente na URL → params null, sem crash (página tolera)', () => {
    expect(parsePath('/documento-detalhe')).toEqual({ page: 'documento-detalhe', params: null })
    expect(parsePath('/documento-detalhe/')).toEqual({ page: 'documento-detalhe', params: null })
  })

  it('página sem PAGE_PARAM ignora segmento extra (params null)', () => {
    expect(parsePath('/biblioteca/qualquer-coisa')).toEqual({ page: 'biblioteca', params: null })
  })

  it('slug desconhecido → { page: null, params: null }', () => {
    expect(parsePath('/nao-existe-xyz/123')).toEqual({ page: null, params: null })
  })

  it("'/' resolve para home sem params", () => {
    expect(parsePath('/')).toEqual({ page: 'home', params: null })
    expect(parsePath('')).toEqual({ page: 'home', params: null })
  })

  it('%-sequência malformada no segmento não derruba o parse', () => {
    expect(parsePath('/documento-detalhe/100%')).toEqual({
      page: 'documento-detalhe',
      params: { documentoId: '100%' },
    })
  })

  it('compat Etapa A: pathToPage continua devolvendo só a página', () => {
    expect(pathToPage('/documento-detalhe/abc')).toBe('documento-detalhe')
    expect(pathToPage('/noticia-detalhe/42')).toBe('noticia-detalhe')
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

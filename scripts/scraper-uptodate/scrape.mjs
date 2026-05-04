/**
 * Scraper UpToDate — "What's New in Anesthesiology".
 *
 * Fluxo:
 *   1. Login em https://www.uptodate.com/login com credenciais de GitHub Secrets.
 *   2. Navega para /contents/whats-new-in-anesthesiology.
 *   3. Parseia até 50 entradas (h2/h3 + corpo HTML + last-updated + URL).
 *   4. Sanitiza HTML (remove <a>, <script>, on*, href, src etc).
 *   5. Envia em payload assinado HMAC para Edge Function ingest-uptodate.
 *
 * Volume / robustez:
 *   - 1×/semana, slowMo 250ms, viewport 1366x768, UA realista.
 *   - Timeout total: 8 minutos no GitHub Actions.
 *   - Falha rápida com mensagem clara se layout mudar.
 */
import crypto from 'node:crypto'
import { chromium } from 'playwright'
import { sanitizeUtdHtml, normalizeTitle, normalizeUrl, htmlToText } from './sanitize.mjs'
import { postIngest } from './ingest.mjs'

const LOGIN_URL = 'https://www.uptodate.com/login'
const WHATS_NEW = 'https://www.uptodate.com/contents/whats-new-in-anesthesiology'
const MAX_ITEMS = 50

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36'

function dedupHashOf(url, titleNorm) {
  return crypto
    .createHash('sha256')
    .update(`${normalizeUrl(url)}|${titleNorm}`, 'utf8')
    .digest('hex')
}

function parseDateMaybe(text) {
  if (!text) return null
  const t = text.trim()
  // "This topic last updated: Apr 28, 2026."
  const m = t.match(/([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})/)
  if (m) {
    const d = new Date(`${m[1]} ${m[2]}, ${m[3]} 00:00:00 UTC`)
    if (!isNaN(d.getTime())) return d.toISOString()
  }
  const iso = new Date(t)
  if (!isNaN(iso.getTime())) return iso.toISOString()
  return null
}

function topicIdFromUrl(url) {
  try {
    const u = new URL(url)
    const parts = u.pathname.split('/').filter(Boolean)
    return parts[parts.length - 1] || null
  } catch {
    return null
  }
}

async function main() {
  const email = process.env.UPTODATE_EMAIL
  const password = process.env.UPTODATE_PASSWORD
  if (!email || !password) {
    throw new Error('UPTODATE_EMAIL/UPTODATE_PASSWORD ausentes')
  }

  console.log('[uptodate] launching browser...')
  const browser = await chromium.launch({ headless: true, slowMo: 250 })
  const ctx = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1366, height: 768 },
    locale: 'pt-BR',
  })
  const page = await ctx.newPage()

  try {
    // 1) Login (UpToDate usa fluxo de 2 passos: username → next → password)
    console.log('[uptodate] going to login...')
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 })

    const userSelector = 'input[name="userName"], input[name="username"], input#userName, input[type="email"]'
    const passSelector = 'input[name="password"], input#password, input[type="password"]'
    const submitSelector = 'button[type="submit"], input[type="submit"]'

    // Passo 1: campo de usuário
    await page.waitForSelector(userSelector, { timeout: 30000 }).catch(() => {
      throw new Error('Selector de usuário não encontrado — layout do login UTD mudou')
    })
    await page.fill(userSelector, email)
    console.log('[uptodate] username preenchido')

    // Tenta submeter — fluxos de 2 passos avançam para a tela de senha;
    // fluxos de 1 passo já têm o campo de senha visível na mesma tela.
    const passVisibleNow = await page.locator(passSelector).first().isVisible().catch(() => false)
    if (!passVisibleNow) {
      console.log('[uptodate] login 2-step detectado, clicando next...')
      await page.click(submitSelector).catch(() => {})
    }

    // Passo 2: campo de senha (espera aparecer, com fallback diagnóstico)
    try {
      await page.waitForSelector(passSelector, { state: 'visible', timeout: 30000 })
    } catch (e) {
      const currentUrl = page.url()
      const visibleText = await page.evaluate(() => document.body?.innerText?.slice(0, 500) || '').catch(() => '')
      throw new Error(
        `Campo de senha não apareceu (URL: ${currentUrl}). ` +
        `Pode ser CAPTCHA, MFA ou layout mudou. Texto visível: ${visibleText.slice(0, 200)}`,
      )
    }
    await page.fill(passSelector, password)
    console.log('[uptodate] password preenchido')

    // Submit final — espera navegação fora de /login
    await Promise.all([
      page.waitForLoadState('networkidle', { timeout: 60000 }),
      page.click(submitSelector),
    ])

    const url = page.url()
    if (!url.includes('uptodate.com') || url.includes('/login')) {
      const errorText = await page.evaluate(() => {
        const errs = document.querySelectorAll('.error, [role="alert"], .alert')
        return Array.from(errs).map((e) => e.textContent?.trim()).filter(Boolean).join(' | ')
      }).catch(() => '')
      throw new Error(`Login UTD falhou. URL: ${url}. Erros visíveis: ${errorText || '(nenhum)'}`)
    }
    console.log('[uptodate] login OK')

    // 2) What's New in Anesthesiology
    console.log('[uptodate] going to whats-new...')
    await page.goto(WHATS_NEW, { waitUntil: 'networkidle', timeout: 60000 })

    // 3) Parse — extrai blocos h2/h3 + corpo
    // Estratégia conservadora: percorrer headings dentro do main e juntar
    // os irmãos até o próximo heading.
    const rawItems = await page.evaluate(({ canonicalUrl, max }) => {
      const main = document.querySelector('main, [role="main"], #topicContent, article') || document.body
      const headings = Array.from(main.querySelectorAll('h2, h3')).filter((h) => {
        const txt = (h.textContent || '').trim()
        return txt.length > 5 && !/^references$/i.test(txt) && !/^use of uptodate/i.test(txt)
      })

      const out = []
      for (const h of headings) {
        const titulo = (h.textContent || '').trim()
        let bodyHtml = ''
        let lastUpdated = ''
        let topicHref = ''

        let n = h.nextElementSibling
        while (n && !/^H[23]$/.test(n.tagName)) {
          if (n.tagName !== 'SCRIPT' && n.tagName !== 'STYLE') {
            bodyHtml += n.outerHTML
          }
          // Capturar primeiro link UTD (será removido na sanitização — apenas serve de referência)
          const a = n.querySelector?.('a[href*="/contents/"]')
          if (a && !topicHref) topicHref = a.getAttribute('href') || ''
          // Heurística de data
          const txt = (n.textContent || '')
          const m = txt.match(/last updated[:\s]+([A-Z][a-z]{2,9}\s+\d{1,2},\s*\d{4})/i)
          if (m && !lastUpdated) lastUpdated = m[1]
          n = n.nextElementSibling
        }

        let absHref = ''
        if (topicHref) {
          try { absHref = new URL(topicHref, location.href).toString() } catch {}
        }

        out.push({
          titulo,
          bodyHtml,
          lastUpdated,
          fonte_url: absHref || canonicalUrl,
        })
        if (out.length >= max) break
      }
      return out
    }, { canonicalUrl: WHATS_NEW, max: MAX_ITEMS })

    console.log(`[uptodate] parsed ${rawItems.length} raw items`)
    if (rawItems.length === 0) {
      throw new Error('Nenhum item parseado — selectors h2/h3 não encontraram blocos')
    }

    const now = new Date().toISOString()
    const seen = new Set()
    const items = []
    for (const r of rawItems) {
      if (!r.titulo) continue
      const tnorm = normalizeTitle(r.titulo)
      if (!tnorm) continue
      const url = r.fonte_url || WHATS_NEW
      const hash = dedupHashOf(url, tnorm)
      if (seen.has(hash)) continue
      seen.add(hash)

      const cleanHtml = sanitizeUtdHtml(r.bodyHtml || '')
      const txt = htmlToText(cleanHtml).slice(0, 2000)
      const publicado = parseDateMaybe(r.lastUpdated) || now

      items.push({
        titulo: r.titulo.slice(0, 500),
        resumo_html: cleanHtml,
        resumo_texto: txt,
        topic_id: topicIdFromUrl(url),
        fonte_url: url,
        categoria: 'anesthesiology',
        secao: "What's New in Anesthesiology",
        titulo_norm: tnorm,
        dedup_hash: hash,
        publicado_em: publicado,
      })
      if (items.length >= MAX_ITEMS) break
    }

    console.log(`[uptodate] sending ${items.length} items to ingest...`)
    const result = await postIngest(items)
    console.log('[uptodate] ingest result:', result)
  } finally {
    await ctx.close().catch(() => {})
    await browser.close().catch(() => {})
  }
}

main().catch((err) => {
  console.error('[uptodate] FAILED:', err)
  process.exit(1)
})

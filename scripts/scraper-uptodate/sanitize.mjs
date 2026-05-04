/**
 * Sanitização de HTML do UpToDate.
 *
 * Remove TODOS os elementos interativos / executáveis (script, iframe, object,
 * embed, form, input, button, style) e ATRIBUTOS de evento e referências
 * externas (href, src, on*, style). Substitui <a> por <span data-was-link>
 * preservando o texto.
 *
 * O viewer no app sanitiza novamente em runtime (defesa em profundidade).
 */
import DOMPurify from 'isomorphic-dompurify'

const ALLOWED_TAGS = [
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'strong', 'em', 'b', 'i', 'u', 'br', 'span',
  'sup', 'sub',
  'div', 'section', 'article',
  'table', 'thead', 'tbody', 'tr', 'td', 'th',
  'figure', 'figcaption', 'blockquote',
]

const FORBID_TAGS = ['a', 'script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'link', 'meta', 'video', 'audio', 'source', 'svg']

const ALLOWED_ATTR = ['class']

const FORBID_ATTR = ['href', 'src', 'srcset', 'style', 'target', 'rel', 'onclick', 'onerror', 'onload', 'onmouseover', 'onfocus', 'onblur', 'id']

// Hook: substitui <a> por <span data-was-link> preservando o conteúdo de texto.
DOMPurify.addHook('uponSanitizeElement', (node, data) => {
  if (data.tagName === 'a') {
    const span = node.ownerDocument.createElement('span')
    span.setAttribute('data-was-link', '1')
    while (node.firstChild) span.appendChild(node.firstChild)
    node.parentNode?.replaceChild(span, node)
  }
})

export function sanitizeUtdHtml(html) {
  if (typeof html !== 'string' || !html.trim()) return ''
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    FORBID_TAGS,
    ALLOWED_ATTR,
    FORBID_ATTR,
    KEEP_CONTENT: true,
    RETURN_TRUSTED_TYPE: false,
  })
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'of', 'in', 'for', 'and', 'or', 'on', 'to', 'with', 'by', 'is', 'are', 'as',
  'o', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'de', 'da', 'do', 'das', 'dos',
  'em', 'na', 'no', 'nas', 'nos', 'para', 'por', 'e', 'ou', 'com', 'sem',
])

export function normalizeTitle(raw) {
  if (!raw) return ''
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS.has(t))
    .sort()
    .join(' ')
}

export function normalizeUrl(raw) {
  if (!raw) return ''
  try {
    const u = new URL(raw)
    let host = u.host.toLowerCase()
    if (host.startsWith('www.')) host = host.slice(4)
    let pathname = u.pathname.replace(/\/+$/, '')
    if (pathname === '') pathname = '/'
    return `https://${host}${pathname}`.toLowerCase()
  } catch {
    return raw.trim().toLowerCase()
  }
}

export function htmlToText(html) {
  if (!html) return ''
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

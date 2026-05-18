import DOMPurify from 'dompurify';

const VIDEO_HOSTS = new Set([
  'www.youtube.com',
  'youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'player.vimeo.com',
]);

const RICH_HTML_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'hr',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'strong', 'b', 'em', 'i', 'u', 's', 'code', 'pre', 'sub', 'sup',
    'ul', 'ol', 'li',
    'blockquote',
    'a',
    'img',
    'table', 'thead', 'tbody', 'tr', 'td', 'th',
    'span', 'div',
    'iframe',
  ],
  ALLOWED_ATTR: [
    'href', 'target', 'rel', 'title',
    'src', 'alt', 'width', 'height', 'loading',
    'class', 'style',
    'allow', 'allowfullscreen', 'frameborder',
    'colspan', 'rowspan',
    'data-block-id', 'data-content-type',
  ],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  ADD_TAGS: [],
};

let hookInstalled = false;
function installIframeAllowlistHook() {
  if (hookInstalled) return;
  DOMPurify.addHook('uponSanitizeElement', (node, data) => {
    if (data.tagName !== 'iframe') return;
    const src = node.getAttribute('src') || '';
    let host = '';
    try {
      host = new URL(src).hostname;
    } catch {
      node.parentNode?.removeChild(node);
      return;
    }
    if (!VIDEO_HOSTS.has(host)) {
      node.parentNode?.removeChild(node);
    }
  });
  hookInstalled = true;
}

export function sanitizeRichHtml(html) {
  if (!html) return '';
  installIframeAllowlistHook();
  return DOMPurify.sanitize(String(html), RICH_HTML_CONFIG);
}

export function isAllowedEmbedUrl(url) {
  try {
    const host = new URL(url).hostname;
    return VIDEO_HOSTS.has(host);
  } catch {
    return false;
  }
}

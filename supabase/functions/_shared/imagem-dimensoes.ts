/**
 * Dimensões de uma imagem lendo SÓ o cabeçalho dos bytes (PNG/JPEG/WebP/GIF).
 *
 * Existe por causa da auditoria de 02/09: a edge da escala não registrava nada
 * sobre a imagem que mandava para a Vision, e a hipótese mais forte para o erro
 * de leitura — 70% das fotos chegam recomprimidas a 1280px pelo WhatsApp, com a
 * letra do rodapé em 8–10px — não podia ser confirmada nem refutada por medida
 * nenhuma. Sem largura e altura por leitura não dá para dizer se uma foto ruim
 * errou porque é ruim.
 *
 * Lê o cabeçalho, nunca o pixel: decodificar a imagem inteira na edge custaria
 * memória e tempo por leitura, e a resposta que interessa (quantos pixels tem)
 * está nos primeiros bytes de todo formato que a Vision aceita.
 *
 * Falha é `null`, nunca exceção: dimensão é telemetria — não pode derrubar a
 * leitura da escala por um formato exótico ou um cabeçalho truncado.
 */

export interface Dimensoes {
  largura: number
  altura: number
}

/**
 * Decodifica só o COMEÇO do base64 (o cabeçalho basta) em bytes.
 *
 * O corte cai num múltiplo de 4 porque base64 codifica 3 bytes a cada 4
 * caracteres — cortar no meio de um grupo faz `atob` estourar.
 */
export function bytesIniciais(base64: unknown, maxBytes = 131072): Uint8Array {
  const s = String(base64 ?? '').replace(/\s+/g, '')
  if (!s) return new Uint8Array(0)
  const maxChars = Math.ceil(maxBytes / 3) * 4
  const n = Math.min(s.length, maxChars)
  const corte = s.slice(0, n - (n % 4))
  if (!corte) return new Uint8Array(0)
  try {
    const bin = atob(corte)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return new Uint8Array(0)
  }
}

const be16 = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1]
const be32 = (b: Uint8Array, i: number) =>
  ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3]
const le16 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8)
const le24 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16)
const marca = (b: Uint8Array, i: number, texto: string) =>
  texto.split('').every((c, k) => b[i + k] === c.charCodeAt(0))

function dimensoesPng(b: Uint8Array): Dimensoes | null {
  // assinatura \x89PNG\r\n\x1a\n + IHDR: largura/altura são os 8 bytes após ele
  if (b.length < 24 || b[0] !== 0x89 || !marca(b, 1, 'PNG')) return null
  return { largura: be32(b, 16), altura: be32(b, 20) }
}

function dimensoesGif(b: Uint8Array): Dimensoes | null {
  if (b.length < 10 || !marca(b, 0, 'GIF8')) return null
  return { largura: le16(b, 6), altura: le16(b, 8) }
}

function dimensoesWebp(b: Uint8Array): Dimensoes | null {
  if (b.length < 30 || !marca(b, 0, 'RIFF') || !marca(b, 8, 'WEBP')) return null
  if (marca(b, 12, 'VP8X')) {
    return { largura: le24(b, 24) + 1, altura: le24(b, 27) + 1 }
  }
  if (marca(b, 12, 'VP8L')) {
    // 14 bits de largura-1 e 14 de altura-1 empacotados nos 4 bytes seguintes
    const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)
    return { largura: (bits & 0x3fff) + 1, altura: ((bits >> 14) & 0x3fff) + 1 }
  }
  if (marca(b, 12, 'VP8 ')) {
    // quadro-chave: tag de 3 bytes + start code 9d 01 2a, aí largura/altura
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null
    return { largura: le16(b, 26) & 0x3fff, altura: le16(b, 28) & 0x3fff }
  }
  return null
}

// Marcadores SOF (start of frame) que carregam as dimensões. DHT/DAC/RST e os
// marcadores de reinício ficam de fora de propósito: 0xC4/0xC8/0xCC não são SOF.
const SOF = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
  0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
])

function dimensoesJpeg(b: Uint8Array): Dimensoes | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null
  let i = 2
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue } // padding entre segmentos
    const m = b[i + 1]
    if (m === 0xff) { i++; continue }
    if (m === 0xd8 || m === 0xd9 || (m >= 0xd0 && m <= 0xd7) || m === 0x01) { i += 2; continue }
    const tam = be16(b, i + 2)
    if (tam < 2) return null
    if (SOF.has(m)) return { largura: be16(b, i + 7), altura: be16(b, i + 5) }
    if (m === 0xda) return null // começou o scan: não há mais cabeçalho para ler
    i += 2 + tam
  }
  return null
}

/**
 * Largura e altura, ou `null` quando o cabeçalho não permite dizer.
 * Zero em qualquer eixo também vira `null` — dimensão zero não é medida.
 */
export function dimensoesDaImagem(bytes: Uint8Array): Dimensoes | null {
  if (!bytes || bytes.length < 10) return null
  const d = dimensoesPng(bytes) || dimensoesGif(bytes) || dimensoesWebp(bytes) || dimensoesJpeg(bytes)
  if (!d || !(d.largura > 0) || !(d.altura > 0)) return null
  return d
}

/** Atalho para o caminho da edge: base64 → dimensões (sem decodificar tudo). */
export function dimensoesDeBase64(base64: unknown): Dimensoes | null {
  return dimensoesDaImagem(bytesIniciais(base64))
}

/** Bytes aproximados que o base64 representa (4 chars → 3 bytes, menos padding). */
export function bytesDeBase64(base64: unknown): number {
  const s = String(base64 ?? '').replace(/\s+/g, '')
  if (!s) return 0
  const padding = (s.match(/=+$/) || [''])[0].length
  return Math.max(0, Math.floor((s.length * 3) / 4) - padding)
}

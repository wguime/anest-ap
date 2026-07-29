/**
 * Preparo da imagem da escala antes de mandar para a Claude Vision.
 *
 * BUG DE PRODUÇÃO 29/07: o dono importava a escala e nada era extraído. Os logs
 * do servidor provam que só o preflight (`OPTIONS 200`) chegou — o POST com a
 * imagem NUNCA saiu do navegador, e a função não registrou erro nenhum. Ou seja:
 * não era a Vision, não era a ANTHROPIC_API_KEY e não era CORS. A imagem ia em
 * base64 do arquivo CRU (`FileReader.readAsDataURL`), e base64 infla ~33%: uma
 * foto de iPhone de 8–12 MP vira 4–7 MB de corpo, que estoura o limite do
 * gateway e a memória do Safari no iOS.
 *
 * Aqui a foto é reduzida e re-codificada como JPEG antes de sair. Dois ganhos:
 *   1. o corpo cai para algumas centenas de KB — a escala é TEXTO num mapa de
 *      sala, e 1600px no lado maior é mais do que a Vision precisa para ler;
 *   2. HEIC do iPhone deixa de ser problema: o Safari decodifica HEIC num
 *      `<img>` nativamente e o canvas exporta JPEG, então o que chega à API é
 *      sempre um formato que ela aceita. Antes, `readAsDataURL` só empacotava os
 *      bytes HEIC e mandava `image/heic`, que a Vision recusa.
 *
 * Toda falha vira `ErroImagem` com um `motivo` — a tela usa isso para dizer o
 * que fazer em vez de "Falha na extração", que não ajuda quem está no centro
 * cirúrgico com o mapa na mão.
 */

/** Lado maior da imagem enviada. Texto de mapa de sala é legível bem antes disso. */
export const MAX_LADO = 1600

/** Qualidade do JPEG de saída. */
export const QUALIDADE = 0.85

/**
 * Teto do corpo do POST, com folga sobre o limite do gateway. Serve para o
 * caminho de fallback (quando o canvas não está disponível): melhor recusar com
 * mensagem clara do que emitir um POST que morre no navegador em silêncio.
 */
export const LIMITE_BYTES = 3 * 1024 * 1024

/** Teto para a decodificação responder. Ver `decodificar`. */
export const TIMEOUT_DECODE_MS = 15000

export class ErroImagem extends Error {
  /**
   * @param {'vazio'|'nao-imagem'|'decodificar'|'codificar'|'grande'} motivo
   * @param {string} mensagem  texto pronto para a UI (diz o que fazer)
   */
  constructor(motivo, mensagem) {
    super(mensagem)
    this.name = 'ErroImagem'
    this.motivo = motivo
  }
}

/**
 * Dimensão de saída preservando a proporção. Nunca AUMENTA: print de tela já
 * pequeno seria só perda de nitidez re-amostrado para cima.
 *
 * @param {number} largura
 * @param {number} altura
 * @param {number} [maxLado]
 * @returns {{largura:number, altura:number}}
 */
export function dimensionarParaEnvio(largura, altura, maxLado = MAX_LADO) {
  const w = Math.max(0, Math.round(Number(largura) || 0))
  const h = Math.max(0, Math.round(Number(altura) || 0))
  if (!w || !h) return { largura: 0, altura: 0 }
  const maior = Math.max(w, h)
  if (maior <= maxLado) return { largura: w, altura: h }
  const fator = maxLado / maior
  // pelo menos 1px em cada eixo: proporção extrema não pode zerar um lado
  return {
    largura: Math.max(1, Math.round(w * fator)),
    altura: Math.max(1, Math.round(h * fator)),
  }
}

/** Bytes aproximados de uma string base64 (4 chars → 3 bytes, menos o padding). */
export function bytesDeBase64(base64) {
  const s = String(base64 || '')
  if (!s) return 0
  const padding = (s.match(/=+$/) || [''])[0].length
  return Math.max(0, Math.floor((s.length * 3) / 4) - padding)
}

/** Lê o arquivo como base64 puro (sem o prefixo data:). */
function lerBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] || '')
    r.onerror = () => reject(new ErroImagem('decodificar', 'Não foi possível ler o arquivo.'))
    r.readAsDataURL(file)
  })
}

/**
 * Decodifica o arquivo num elemento de imagem (é aqui que o Safari abre HEIC).
 *
 * Com TIMEOUT de propósito: se o navegador não dispara nem `onload` nem
 * `onerror` — acontece com arquivo corrompido e é o comportamento do jsdom — a
 * promise ficaria pendurada para sempre e a tela ficaria girando o spinner sem
 * nunca dizer nada. Falha muda é exatamente o que estamos consertando aqui.
 */
function decodificar(file, timeoutMs) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    let terminou = false
    const encerrar = (fn) => (arg) => {
      if (terminou) return
      terminou = true
      clearTimeout(timer)
      URL.revokeObjectURL(url)
      fn(arg)
    }
    const falhar = encerrar(reject)
    const timer = setTimeout(
      () => falhar(new ErroImagem('decodificar', 'A imagem demorou demais para abrir. Tente um print da tela em PNG.')),
      timeoutMs,
    )
    const concluir = encerrar(resolve)
    const img = new Image()
    img.onload = () => concluir(img)
    img.onerror = () => falhar(new ErroImagem(
      'decodificar',
      'Este navegador não conseguiu abrir a imagem. Tire um print da tela e envie o print, ou use um PNG/JPG.',
    ))
    img.src = url
  })
}

/**
 * Reduz e re-codifica a imagem para envio.
 *
 * @param {File|Blob} file
 * @param {{maxLado?:number, qualidade?:number, timeoutMs?:number}} [opts]
 * @returns {Promise<{base64:string, mimeType:string, bytes:number, largura:number, altura:number, reduzida:boolean}>}
 * @throws {ErroImagem}
 */
export async function prepararImagemParaVision(file, opts = {}) {
  const { maxLado = MAX_LADO, qualidade = QUALIDADE, timeoutMs = TIMEOUT_DECODE_MS } = opts
  if (!file || !file.size) {
    throw new ErroImagem('vazio', 'Arquivo vazio. Escolha a foto ou o print da escala.')
  }
  // PDF e afins não passam por aqui — a tela tem caminho próprio para Excel
  if (file.type && !/^image\//.test(file.type) && !/heic|heif/i.test(file.type)) {
    throw new ErroImagem('nao-imagem', 'Envie uma imagem (print da tela, foto do mapa) ou a planilha em Excel.')
  }

  let img
  try {
    img = await decodificar(file, timeoutMs)
  } catch (e) {
    // Sem decodificação não há como reduzir. Ainda tentamos mandar o arquivo
    // cru, MAS só se couber — o POST grande é justamente o que morria muda.
    const base64 = await lerBase64(file)
    const bytes = bytesDeBase64(base64)
    if (bytes > LIMITE_BYTES) throw e instanceof ErroImagem ? e : new ErroImagem('decodificar', e.message)
    return {
      base64,
      mimeType: file.type || 'image/jpeg',
      bytes,
      largura: 0,
      altura: 0,
      reduzida: false,
    }
  }

  const { largura, altura } = dimensionarParaEnvio(img.naturalWidth || img.width, img.naturalHeight || img.height, maxLado)
  if (!largura || !altura) {
    throw new ErroImagem('decodificar', 'A imagem chegou sem dimensão. Tente tirar um print da tela.')
  }

  let base64
  try {
    const canvas = document.createElement('canvas')
    canvas.width = largura
    canvas.height = altura
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('sem contexto 2d')
    // fundo branco: JPEG não tem alfa e PNG transparente viraria preto, o que
    // apaga texto escuro do mapa
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, largura, altura)
    ctx.drawImage(img, 0, 0, largura, altura)
    base64 = canvas.toDataURL('image/jpeg', qualidade).split(',')[1] || ''
  } catch {
    throw new ErroImagem('codificar', 'Não foi possível preparar a imagem neste navegador. Tente um print da tela em PNG.')
  }

  const bytes = bytesDeBase64(base64)
  if (!bytes) {
    throw new ErroImagem('codificar', 'A imagem preparada saiu vazia. Tente novamente ou envie um print da tela.')
  }
  if (bytes > LIMITE_BYTES) {
    throw new ErroImagem(
      'grande',
      'A imagem ficou grande demais mesmo depois de reduzida. Recorte só a parte da escala e envie de novo.',
    )
  }

  return { base64, mimeType: 'image/jpeg', bytes, largura, altura, reduzida: true }
}

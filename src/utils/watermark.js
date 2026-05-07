/**
 * watermark.js
 * Aplica watermark dinâmico em PDFs via pdf-lib (client-side).
 *
 * Uso típico (Onda 1-2 do roadmap ANEST):
 *   const stamped = await applyWatermark(pdfBytes, {
 *     text: 'CÓPIA NÃO CONTROLADA',
 *     subLines: buildWatermarkLines({ name, email, ip, timestamp }),
 *   });
 *
 * Não consome credenciais. Roda no browser do leitor — IP real,
 * quando necessário, é obtido via edge function `watermark-pdf`.
 */
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';

/**
 * Aplica watermark a todas as páginas do PDF.
 *
 * @param {ArrayBuffer | Uint8Array} pdfBytes  Conteúdo binário do PDF de entrada.
 * @param {object} opts
 * @param {string} opts.text                   Linha principal (ex.: "CÓPIA NÃO CONTROLADA").
 * @param {string[]} [opts.subLines]           Linhas adicionais (nome, email, ip, timestamp).
 * @param {number} [opts.opacity=0.18]         Opacidade do watermark (0-1).
 * @param {number} [opts.rotation=-30]         Rotação em graus.
 * @param {number} [opts.fontSize=48]          Tamanho da fonte da linha principal.
 * @returns {Promise<Uint8Array>}              PDF marcado.
 * @throws {Error}                             Se o PDF for inválido/corrupto.
 */
export async function applyWatermark(pdfBytes, opts = {}) {
  if (!pdfBytes) {
    throw new Error('applyWatermark: pdfBytes ausente');
  }
  if (!opts.text || typeof opts.text !== 'string') {
    throw new Error('applyWatermark: opts.text é obrigatório');
  }

  const {
    text,
    subLines = [],
    opacity = 0.18,
    rotation = -30,
    fontSize = 48,
  } = opts;

  let doc;
  try {
    doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`applyWatermark: PDF inválido ou corrupto (${msg})`);
  }

  let font;
  try {
    font = await doc.embedFont(StandardFonts.HelveticaBold);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`applyWatermark: falha ao embutir fonte (${msg})`);
  }

  const subFontSize = Math.max(8, Math.round(fontSize * 0.28));
  const lineGap = Math.round(subFontSize * 1.4);
  const color = rgb(0.5, 0.5, 0.5);
  const rotateBy = degrees(rotation);

  const pages = doc.getPages();
  for (const page of pages) {
    const { width, height } = page.getSize();

    // Texto principal — centralizado.
    const mainTextWidth = font.widthOfTextAtSize(text, fontSize);
    const mainX = width / 2 - mainTextWidth / 2;
    const mainY = height / 2;

    page.drawText(text, {
      x: mainX,
      y: mainY,
      size: fontSize,
      font,
      color,
      opacity,
      rotate: rotateBy,
    });

    // Sub-linhas — empilhadas abaixo da principal, mesma rotação.
    // Como a rotação é aplicada ao redor do ponto (x, y), aproximamos as
    // sub-linhas no eixo Y; deslocamento perfeito requer trig (omitido aqui
    // — já fica legível com -30°, suficiente para identificação forense).
    subLines.forEach((line, idx) => {
      if (!line) return;
      const lineWidth = font.widthOfTextAtSize(line, subFontSize);
      const lineX = width / 2 - lineWidth / 2;
      const lineY = mainY - lineGap * (idx + 1) - fontSize * 0.4;
      page.drawText(String(line), {
        x: lineX,
        y: lineY,
        size: subFontSize,
        font,
        color,
        opacity,
        rotate: rotateBy,
      });
    });
  }

  return doc.save();
}

/**
 * Conveniência: monta as sub-linhas padrão a partir da identidade do leitor.
 *
 * @param {object} info
 * @param {string} [info.name]
 * @param {string} [info.email]
 * @param {string} [info.ip]
 * @param {string|Date} [info.timestamp]
 * @returns {string[]}                          Lista de sub-linhas (sem entradas vazias).
 */
export function buildWatermarkLines({ name, email, ip, timestamp } = {}) {
  const lines = [];
  if (name) lines.push(String(name));
  if (email) lines.push(String(email));
  if (ip) lines.push(`IP/UA: ${ip}`);
  if (timestamp) {
    const ts = timestamp instanceof Date ? timestamp.toISOString() : String(timestamp);
    lines.push(ts);
  }
  return lines;
}

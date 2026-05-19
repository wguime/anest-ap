/**
 * certificateGenerator.js
 * Gerador de certificados em PDF usando jsPDF com logo ANEST
 *
 * Wave 1.9 cleanup:
 *   - Removidas: getCertificatePdfUrl, uploadCertificatePDF, downloadCertificate,
 *     openCertificate. Tudo era Firebase Storage legacy.
 *   - QR code agora aponta para `${origin}/verificar/${certId}` (rota pública
 *     estável servida por VerificarCertificadoPage.jsx + Edge
 *     verify-cert-uuid-public). Post bucket-delete (T1.9.9) a verificação
 *     continua funcionando porque NÃO depende mais do PDF no Firebase Storage.
 *   - generateCertificatePDF é mantido porque é chamado pela emitirCertificado
 *     (educacaoService) para upload direto ao Supabase Storage.
 */

import QRCode from 'qrcode';

/**
 * Formata data para exibicao no certificado
 */
const formatDataCertificado = (data) => {
  if (!data) return '-';
  // Suporta Firestore Timestamp (.toDate()), objeto com .seconds, Date e string
  const raw = typeof data?.toDate === 'function' ? data.toDate()
    : typeof data?.seconds === 'number' ? new Date(data.seconds * 1000)
    : data;
  const dateObj = raw instanceof Date ? raw : new Date(raw);
  if (isNaN(dateObj.getTime())) return '-';
  return dateObj.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
};

/**
 * Carrega uma imagem e converte para base64
 * @param {string} url - URL da imagem
 * @returns {Promise<string>} - Imagem em base64
 */
const loadImageAsBase64 = (url) => {
  return new Promise((resolve, _reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const dataURL = canvas.toDataURL('image/png');
      resolve(dataURL);
    };
    img.onerror = () => {
      // Se falhar ao carregar, retorna null (certificado sera gerado sem logo)
      resolve(null);
    };
    img.src = url;
  });
};

// Cache do logo ANEST para evitar recarregamento a cada certificado
let _cachedLogo = null;
let _logoPromise = null;

async function getLogoBase64() {
  if (_cachedLogo !== null) return _cachedLogo;
  if (_logoPromise) return _logoPromise;
  _logoPromise = loadImageAsBase64('/logo-anest.png').then((result) => {
    _cachedLogo = result;
    _logoPromise = null;
    return result;
  });
  return _logoPromise;
}

/**
 * Wave 1.9: gera URL pública de verificação (rota /verificar/:uuid servida
 * por VerificarCertificadoPage + Edge verify-cert-uuid-public).
 *
 * Por que NÃO apontar para o PDF direto?
 *   - Firebase Storage URL será deletada na Wave 1.9 (T1.9.9).
 *   - Signed URL Supabase tem TTL=300s — não serve para QR impresso.
 *   - /verificar é público, estável, com rate-limit + LGPD (mostra apenas
 *     iniciais G.G.G., não nome completo).
 */
function getVerifyUrl(certId) {
  // window.location.origin não está disponível em Node (SSR/jsdom), fallback
  // para production URL fixa.
  const origin = (typeof window !== 'undefined' && window.location?.origin)
    || 'https://anest-ap.web.app';
  return `${origin}/verificar/${encodeURIComponent(certId)}`;
}

/**
 * Gera o PDF do certificado com logo ANEST
 * Layout limpo e profissional inspirado em certificados Coursera/Harvard
 * @param {Object} certificado - Dados do certificado
 * @param {string} userName - Nome do usuario
 * @param {string|null} logoBase64 - Logo em base64 (opcional)
 * @param {string|null} qrDataUrl - QR code em data URL (opcional)
 * @returns {jsPDF} - Documento PDF
 */
async function generateCertificatePDFSync(certificado, userName, logoBase64 = null, qrDataUrl = null) {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 297;
  const pageHeight = 210;
  const marginX = 20;
  const cx = pageWidth / 2;

  // === PALETA (fiel ao modelo de referencia) ===
  const VERDE_ESCURO = [0, 66, 37];     // #004225 — camada de fundo topo
  const VERDE_MEDIO  = [0, 90, 50];     // #005A32 — camada frontal topo
  const DOURADO      = [191, 155, 48];   // #BF9B30 — faixas douradas
  const VERDE_CLARO  = [0, 104, 55];     // #006837 — subtitulos, nome curso
  const CINZA_CORPO  = [80, 80, 80];     // #505050 — corpo
  const CINZA_META   = [160, 160, 160];  // #A0A0A0 — metadata

  // === FUNDO BRANCO ===
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // =============================================
  // TOPO — Ondas full-width (clone exato do modelo)
  // Duas camadas de verde + faixa dourada, borda a borda
  // A borda inferior de cada camada e uma curva "vale"
  // que desce no centro, criando abertura para o conteudo
  // =============================================

  // --- Camada 1 (fundo): Verde escuro #004225 ---
  // Reduzida 25% vs original. Diagonal curvada borda a borda.
  doc.setFillColor(...VERDE_ESCURO);
  doc.lines(
    [
      [297, 0],                              // topo: (0,0) → (297,0)
      [0, 28],                               // desce: (297,0) → (297,28)
      [-97, -3, -197, -16, -297, -19]        // bezier: (297,28) → (0,9)
    ],
    0, 0, [1, 1], 'F', true                  // fecha: (0,9) → (0,0)
  );

  // --- Faixa dourada (3mm) entre as duas camadas ---
  doc.setDrawColor(...DOURADO);
  doc.setLineWidth(3);
  doc.lines(
    [[100, 3, 200, 16, 297, 19]],            // bezier: (0,11) → (297,30)
    0, 11, [1, 1], 'S', false
  );

  // --- Camada 2 (frente): Verde medio #005A32 ---
  // Base faz curva "vale" que desce ate Y~46 no centro
  doc.setFillColor(...VERDE_MEDIO);
  doc.lines(
    [
      [100, 3, 200, 16, 297, 19],            // bezier topo: (0,14) → (297,33)
      [0, 3],                                 // desce: (297,33) → (297,36)
      [-97, 15, -200, 15, -297, -2]           // bezier vale: (297,36) → (0,34)
    ],
    0, 14, [1, 1], 'F', true                  // fecha: (0,34) → (0,14)
  );

  // --- Accent dourado fino na borda do vale ---
  doc.setDrawColor(...DOURADO);
  doc.setLineWidth(1);
  doc.lines(
    [[97, 16, 200, 16, 297, 2]],              // bezier: (0,34) → (297,36)
    0, 34, [1, 1], 'S', false
  );

  // =============================================
  // BORDAS LATERAIS DOURADAS (linhas verticais finas)
  // =============================================
  doc.setDrawColor(...DOURADO);
  doc.setLineWidth(0.5);
  doc.line(12, 40, 12, 195);
  doc.line(285, 40, 285, 195);

  // (bordas inferiores limpas — fundo branco, sem ondas)

  // =============================================
  // CONTEUDO CENTRAL
  // =============================================

  // === LOGO ANEST (48mm, grande destaque, na area branca abaixo do vale) ===
  if (logoBase64) {
    try {
      const logoW = 48;
      const logoH = 48;
      const logoX = cx - logoW / 2;
      doc.addImage(logoBase64, 'PNG', logoX, 48, logoW, logoH);
    } catch (e) {
      if (import.meta.env.DEV) console.warn('Erro ao adicionar logo:', e);
    }
  }

  // === CERTIFICADO ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(...VERDE_ESCURO);
  doc.text('CERTIFICADO', cx, 104, { align: 'center' });

  // === de Conclusao de Curso ===
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...VERDE_CLARO);
  doc.text('de Conclusão de Curso', cx, 111, { align: 'center' });

  // === Linha decorativa dourada ===
  doc.setDrawColor(...DOURADO);
  doc.setLineWidth(0.5);
  doc.line(cx - 50, 116, cx + 50, 116);

  // === Este certificado e conferido a: ===
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...CINZA_CORPO);
  doc.text('Este certificado é conferido a:', cx, 124, { align: 'center' });

  // === NOME DO ALUNO ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...VERDE_ESCURO);
  const nomeUpper = userName.toUpperCase();
  doc.text(nomeUpper, cx, 136, { align: 'center' });

  // === concluiu com exito... ===
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...CINZA_CORPO);
  doc.text('concluiu com êxito o curso de educação continuada:', cx, 146, { align: 'center' });

  // === NOME DO CURSO (multi-line) ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...VERDE_CLARO);
  const cursoTitulo = certificado.cursoTitulo || 'Curso';
  const maxWidth = pageWidth - 100;
  const splitTitle = doc.splitTextToSize(cursoTitulo, maxWidth);
  let yPos = 155;
  splitTitle.forEach((line) => {
    doc.text(line, cx, yPos, { align: 'center' });
    yPos += 6;
  });

  // === CARGA HORARIA + DATA DE CONCLUSAO ===
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...CINZA_CORPO);
  const dataConclusaoFmt = formatDataCertificado(certificado.dataConclusao);
  const validoAteFmt = formatDataCertificado(certificado.validoAte);
  const infoLine = `Carga Horária: ${certificado.cargaHoraria || '-'}  ·  Concluído em: ${dataConclusaoFmt}`;
  doc.text(infoLine, cx, 167, { align: 'center' });

  // === VALIDADE ===
  if (certificado.validoAte) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...CINZA_META);
    doc.text(`Válido até: ${validoAteFmt}`, cx, 172, { align: 'center' });
  }

  // === ANEST — Servico de Anestesiologia ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...VERDE_ESCURO);
  doc.text('ANEST — Serviço de Anestesiologia', cx, 178, { align: 'center' });

  // === Excelencia em Seguranca do Paciente ===
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...CINZA_META);
  doc.text('Excelência em Segurança do Paciente', cx, 185, { align: 'center' });

  // === METADATA: ID (esquerda) + Data emissao (direita) ===
  doc.setFontSize(8);
  doc.setTextColor(...CINZA_META);
  doc.text(`ID: ${certificado.id || 'N/A'}`, marginX + 5, 193, { align: 'left' });
  const dataEmissao = new Date().toLocaleDateString('pt-BR');
  doc.text(`Emitido em: ${dataEmissao}`, pageWidth - marginX - 5, 193, { align: 'right' });

  // === QR CODE (canto inferior esquerdo, abaixo do ID) ===
  if (qrDataUrl) {
    try {
      const qrSize = 14;
      const qrX = marginX + 5;
      const qrY = 195;
      doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
      doc.setFontSize(5);
      doc.setTextColor(...CINZA_META);
      doc.text('Verificar autenticidade', qrX + qrSize / 2, qrY + qrSize + 2.5, { align: 'center' });
    } catch (e) {
      if (import.meta.env.DEV) console.warn('Erro ao adicionar QR code:', e);
    }
  }

  return doc;
}

/**
 * Gera o PDF do certificado (async para carregar logo e QR code)
 * @param {Object} certificado - Dados do certificado
 * @param {string} userName - Nome do usuario
 * @returns {Promise<jsPDF>} - Documento PDF
 */
export async function generateCertificatePDF(certificado, userName) {
  // Tentar carregar o logo ANEST (usa cache em memória)
  let logoBase64 = null;
  try {
    logoBase64 = await getLogoBase64();
  } catch (e) {
    if (import.meta.env.DEV) console.warn('Nao foi possivel carregar o logo:', e);
  }

  // Wave 1.9: QR code aponta para a rota pública /verificar/:uuid em vez do
  // PDF no Firebase Storage (que será deletado em T1.9.9). A rota pública é
  // estável, com rate-limit + LGPD (apenas iniciais), e funciona offline-print.
  let qrDataUrl = null;
  if (certificado.id) {
    try {
      const verifyUrl = getVerifyUrl(certificado.id);
      qrDataUrl = await QRCode.toDataURL(verifyUrl, {
        width: 200,
        margin: 1,
        errorCorrectionLevel: 'M',
      });
    } catch (e) {
      if (import.meta.env.DEV) console.warn('Nao foi possivel gerar QR code:', e);
    }
  }

  return generateCertificatePDFSync(certificado, userName, logoBase64, qrDataUrl);
}

export default {
  generateCertificatePDF,
};

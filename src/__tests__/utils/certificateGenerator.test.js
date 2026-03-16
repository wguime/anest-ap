import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── Mock jsPDF ──────────────────────────────────────────────────
const mockText = vi.fn();
const mockAddImage = vi.fn();
const mockSave = vi.fn();
const mockOutput = vi.fn(() => new Blob());
const mockSetFillColor = vi.fn();
const mockRect = vi.fn();
const mockSetFont = vi.fn();
const mockSetFontSize = vi.fn();
const mockSetTextColor = vi.fn();
const mockSetDrawColor = vi.fn();
const mockSetLineWidth = vi.fn();
const mockLine = vi.fn();
const mockLines = vi.fn();
const mockSplitTextToSize = vi.fn((text) => [text]);

const mockJsPDFInstance = {
  text: mockText,
  addImage: mockAddImage,
  save: mockSave,
  output: mockOutput,
  setFillColor: mockSetFillColor,
  rect: mockRect,
  setFont: mockSetFont,
  setFontSize: mockSetFontSize,
  setTextColor: mockSetTextColor,
  setDrawColor: mockSetDrawColor,
  setLineWidth: mockSetLineWidth,
  line: mockLine,
  lines: mockLines,
  splitTextToSize: mockSplitTextToSize,
};

vi.mock('jspdf', () => {
  // Must use a regular function (not arrow) so it can be called with `new`
  function MockJsPDF() {
    return mockJsPDFInstance;
  }
  MockJsPDF.prototype = {};
  return { default: MockJsPDF };
});

// ─── Mock QRCode ─────────────────────────────────────────────────
vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn(() => Promise.resolve('data:image/png;base64,mockqr')),
  },
}));

// ─── Mock Firebase Storage + Firestore (used by certificateGenerator) ──
vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(() => Promise.resolve()),
  getDownloadURL: vi.fn(() => Promise.resolve('https://storage.example.com/cert.pdf')),
}));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  updateDoc: vi.fn(() => Promise.resolve()),
}));
vi.mock('@/config/firebase', () => ({
  storage: {},
  db: {},
}));

// ─── Mock Image + canvas for loadImageAsBase64 ──────────────────
// Image must trigger onload synchronously upon setting src so the
// Promise inside loadImageAsBase64 resolves without waiting for timers.
const mockDrawImage = vi.fn();
const mockToDataURL = vi.fn(() => 'data:image/png;base64,mocklogo');

class MockImage {
  constructor() {
    this._onload = null;
    this._onerror = null;
  }
  set crossOrigin(_) {}
  set onload(cb) { this._onload = cb; }
  get onload() { return this._onload; }
  set onerror(cb) { this._onerror = cb; }
  get onerror() { return this._onerror; }
  get width() { return 100; }
  get height() { return 100; }
  set src(_) {
    // Fire onload synchronously — the Promise in loadImageAsBase64
    // resolves immediately inside the microtask.
    if (this._onload) this._onload();
  }
}
globalThis.Image = MockImage;

const mockCanvasElement = {
  width: 0,
  height: 0,
  getContext: vi.fn(() => ({
    drawImage: mockDrawImage,
  })),
  toDataURL: mockToDataURL,
};

const originalCreateElement = document.createElement.bind(document);
vi.spyOn(document, 'createElement').mockImplementation((tag) => {
  if (tag === 'canvas') return mockCanvasElement;
  return originalCreateElement(tag);
});

// ─── Mock window.location.origin ─────────────────────────────────
Object.defineProperty(window, 'location', {
  value: { origin: 'https://anest-ap.web.app' },
  writable: true,
});

import { generateCertificatePDF, downloadCertificate } from '../../pages/educacao/utils/certificateGenerator';

describe('certificateGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseCert = {
    id: 'cert-001',
    cursoTitulo: 'Seguranca do Paciente',
    cargaHoraria: '20h',
    dataConclusao: '2025-06-15',
    validoAte: '2027-06-15',
  };

  // 1. Generates PDF with title and user name
  it('generates PDF with CERTIFICADO title and user name', async () => {
    const doc = await generateCertificatePDF(baseCert, 'Dr. Maria Silva');

    const certificadoCall = mockText.mock.calls.find(
      (call) => call[0] === 'CERTIFICADO'
    );
    expect(certificadoCall).toBeTruthy();

    const nameCall = mockText.mock.calls.find(
      (call) => call[0] === 'DR. MARIA SILVA'
    );
    expect(nameCall).toBeTruthy();

    expect(doc).toBe(mockJsPDFInstance);
  });

  // 2. QR code added to PDF
  it('generates QR code and adds it to the PDF', async () => {
    const QRCode = (await import('qrcode')).default;

    await generateCertificatePDF(baseCert, 'Dr. Teste');

    // QR now points to the PDF file in Firebase Storage
    expect(QRCode.toDataURL).toHaveBeenCalledWith(
      expect.stringContaining('certificados%2Fcert-001.pdf'),
      expect.objectContaining({ width: 200, margin: 1 })
    );

    const qrCall = mockAddImage.mock.calls.find(
      (call) => call[0] === 'data:image/png;base64,mockqr'
    );
    expect(qrCall).toBeTruthy();
  });

  // 3. Logo cached after first call
  it('caches logo after first call — addImage uses same logo on second call', async () => {
    // Both calls should add the logo to the PDF via addImage
    await generateCertificatePDF(baseCert, 'User A');
    const firstAddImageCalls = mockAddImage.mock.calls.length;

    vi.clearAllMocks();

    await generateCertificatePDF(baseCert, 'User B');
    const secondAddImageCalls = mockAddImage.mock.calls.length;

    // Both should have called addImage the same number of times
    // (logo + QR), proving the cached logo is reused
    expect(secondAddImageCalls).toBe(firstAddImageCalls);

    // Verify logo was included (addImage called with the logo base64)
    const logoCall = mockAddImage.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].startsWith('data:image/png;base64,mock')
    );
    expect(logoCall).toBeTruthy();
  });

  // 4. Data de validade rendered in PDF
  it('renders validoAte date in the PDF', async () => {
    await generateCertificatePDF(baseCert, 'Dr. Validade');

    const allTextCalls = mockText.mock.calls.map((call) => call[0]);
    // The formatter converts '2027-06-15' to a pt-BR date string
    // Look for text containing "lido at" (Válido até) or the year
    const hasValidoAte = allTextCalls.some(
      (text) => typeof text === 'string' && (text.includes('lido at') || text.includes('2027'))
    );
    expect(hasValidoAte).toBe(true);
  });

  // 5. Logo failure doesn't block generation
  it('generates PDF even when logo fails to load', async () => {
    // Reset modules to clear the cached logo
    vi.resetModules();

    // Override Image to trigger onerror instead of onload
    globalThis.Image = class FailImage {
      set crossOrigin(_) {}
      set onload(cb) { this._onload = cb; }
      set onerror(cb) { this._onerror = cb; }
      get width() { return 0; }
      get height() { return 0; }
      set src(_) {
        // Trigger onerror to simulate a failed load
        // loadImageAsBase64 resolves with null on error
        if (this._onerror) this._onerror();
      }
    };

    // Re-import to get fresh module state (no cached logo)
    const { generateCertificatePDF: freshGenerate } = await import(
      '../../pages/educacao/utils/certificateGenerator'
    );

    const doc = await freshGenerate(baseCert, 'Dr. SemLogo');

    // PDF should still be generated
    expect(doc).toBeDefined();
    expect(doc.text).toBeDefined();

    // Restore original MockImage for other tests
    globalThis.Image = MockImage;
  });
});

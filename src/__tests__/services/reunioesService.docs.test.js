import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mocks — Firestore + Storage
// Sprint 20 Stream 1.2 — cobertura uploadDocumento, getDocumentos, uploadAta, aprovarAta
// ============================================================================

const mockAddDoc = vi.fn();
const mockUpdateDoc = vi.fn(() => Promise.resolve());
const mockDeleteDoc = vi.fn(() => Promise.resolve());
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockUploadBytes = vi.fn(() => Promise.resolve());
const mockGetDownloadURL = vi.fn(() => Promise.resolve('https://storage/mock-url'));
const mockDeleteObject = vi.fn(() => Promise.resolve());
const mockRef = vi.fn((_storage, path) => ({ __ref: true, path }));
const mockWhere = vi.fn((...args) => ({ __where: args }));
const mockOrderBy = vi.fn((...args) => ({ __orderBy: args }));
const mockQuery = vi.fn((...args) => ({ __query: args }));

const serverTimestampSentinel = { __sentinel: 'serverTimestamp' };

vi.mock('@/config/firebase', () => ({
  db: { __db: true },
  storage: { __storage: true },
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, name) => ({ __collection: name })),
  doc: vi.fn((_db, _col, id) => ({ __doc: true, id })),
  addDoc: (...args) => mockAddDoc(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
  deleteDoc: (...args) => mockDeleteDoc(...args),
  getDoc: (...args) => mockGetDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  query: (...args) => mockQuery(...args),
  where: (...args) => mockWhere(...args),
  orderBy: (...args) => mockOrderBy(...args),
  limit: vi.fn((n) => ({ __limit: n })),
  serverTimestamp: () => serverTimestampSentinel,
  Timestamp: { fromDate: (d) => ({ __ts: d.getTime() }) },
  onSnapshot: vi.fn(),
  arrayUnion: vi.fn((v) => ({ __arrayUnion: v })),
  arrayRemove: vi.fn((v) => ({ __arrayRemove: v })),
  deleteField: vi.fn(() => ({ __deleteField: true })),
}));

vi.mock('firebase/storage', () => ({
  ref: (...args) => mockRef(...args),
  uploadBytes: (...args) => mockUploadBytes(...args),
  getDownloadURL: (...args) => mockGetDownloadURL(...args),
  deleteObject: (...args) => mockDeleteObject(...args),
}));

vi.mock('@/utils/checkinCodeGenerator', () => ({
  generateCheckinCode: vi.fn(() => '1234'),
  getCurrentWindowIndex: vi.fn(() => 42),
  getSecondsUntilNextWindow: vi.fn(() => 30),
  generateRandomSeed: vi.fn(() => 'seed-fixed'),
}));

// Helpers
function mockSnap(data, id = 'r1') {
  return { exists: () => true, id, data: () => data };
}

function makeFakeFile({ name = 'doc.pdf', type = 'application/pdf', size = 1024 } = {}) {
  return { name, type, size };
}

// SUT
const svc = await import('../../services/reunioesService');

beforeEach(() => {
  mockAddDoc.mockReset();
  mockUpdateDoc.mockClear();
  mockDeleteDoc.mockClear();
  mockGetDoc.mockReset();
  mockGetDocs.mockReset();
  mockUploadBytes.mockClear();
  mockGetDownloadURL.mockClear();
  mockDeleteObject.mockClear();
  mockRef.mockClear();
});

// ============================================================================
// uploadDocumento — validações
// ============================================================================

describe('uploadDocumento', () => {
  it('rejeita arquivo não-PDF (type + extensão)', async () => {
    const badFile = makeFakeFile({ name: 'photo.jpg', type: 'image/jpeg' });
    await expect(
      svc.uploadDocumento('r1', badFile, 'subsidio', {}, { uid: 'u1' })
    ).rejects.toThrow(/Apenas arquivos PDF/);
  });

  it('aceita PDF mesmo quando type vazio mas extensão .pdf', async () => {
    const file = makeFakeFile({ name: 'subsidio.PDF', type: '', size: 2048 });
    mockAddDoc.mockResolvedValueOnce({ id: 'doc-x' });

    const result = await svc.uploadDocumento('r1', file, 'subsidio', { titulo: 'Sub X' }, { uid: 'u1' });
    expect(result.id).toBe('doc-x');
    expect(mockUploadBytes).toHaveBeenCalledTimes(1);
  });

  it('rejeita arquivo > 15MB', async () => {
    const huge = makeFakeFile({ size: 16 * 1024 * 1024 });
    await expect(
      svc.uploadDocumento('r1', huge, 'subsidio', {}, { uid: 'u1' })
    ).rejects.toThrow(/15MB/);
  });

  it('persiste metadata com uploader, tipo, storagePath e título default = filename', async () => {
    const file = makeFakeFile({ name: 'minha-pauta.pdf', size: 500 });
    mockAddDoc.mockResolvedValueOnce({ id: 'doc-1' });

    await svc.uploadDocumento('r1', file, 'pauta', {}, {
      uid: 'u1',
      displayName: 'Dr. Silva',
    });

    const refCall = mockRef.mock.calls[0][1];
    expect(refCall).toMatch(/^reunioes\/r1\/pauta\/pauta_/);
    expect(refCall).toContain('minha-pauta.pdf');

    const payload = mockAddDoc.mock.calls[0][1];
    expect(payload.reuniaoId).toBe('r1');
    expect(payload.tipoDocumento).toBe('pauta');
    expect(payload.titulo).toBe('minha-pauta.pdf'); // default
    expect(payload.uploadedBy).toBe('u1');
    expect(payload.uploadedByName).toBe('Dr. Silva');
    expect(payload.arquivoUrl).toBe('https://storage/mock-url');
    expect(payload.arquivoTamanho).toBe(500);
  });
});

// ============================================================================
// getDocumentos — filtros
// ============================================================================

describe('getDocumentos', () => {
  beforeEach(() => {
    mockGetDocs.mockResolvedValue({ docs: [] });
  });

  it('lista documentos sem filtro de tipo (apenas reuniaoId)', async () => {
    await svc.getDocumentos('r1');
    expect(mockWhere).toHaveBeenCalledWith('reuniaoId', '==', 'r1');
    expect(mockWhere).not.toHaveBeenCalledWith('tipoDocumento', '==', expect.anything());
  });

  it('aplica filtro tipoDocumento quando passado', async () => {
    await svc.getDocumentos('r1', 'ata');
    expect(mockWhere).toHaveBeenCalledWith('tipoDocumento', '==', 'ata');
  });

  it('mapeia docs retornando id + data', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'd1', data: () => ({ titulo: 'Doc A', tipoDocumento: 'subsidio' }) },
      ],
    });
    const result = await svc.getDocumentos('r1');
    expect(result).toEqual([{ id: 'd1', titulo: 'Doc A', tipoDocumento: 'subsidio' }]);
  });
});

// ============================================================================
// uploadAta — workflow completo
// ============================================================================

describe('uploadAta', () => {
  it('upload + marca statusAta="rascunho" sem auto-completar reunião', async () => {
    const file = makeFakeFile({ name: 'ata-jan.pdf' });
    mockAddDoc.mockResolvedValueOnce({ id: 'ata-1' });

    const result = await svc.uploadAta('r1', file, { titulo: 'Ata Jan/26' }, { uid: 'u1' });

    expect(result.id).toBe('ata-1');
    expect(result.statusAta).toBe('rascunho');

    // updateDoc é chamado para gravar statusAta
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ statusAta: 'rascunho' })
    );

    // markAsCompleted=false ⇒ updateStatus não é chamado
    // (não houve getDoc/getReuniaoById)
    expect(mockGetDoc).not.toHaveBeenCalled();
  });

  it('quando markAsCompleted=true, transiciona em_andamento → concluida', async () => {
    const file = makeFakeFile();
    mockAddDoc
      .mockResolvedValueOnce({ id: 'ata-2' }) // documento
      .mockResolvedValueOnce({ id: 'log-1' }); // status historico log

    // updateStatus chama getReuniaoById, então mock atual + final
    mockGetDoc
      .mockResolvedValueOnce(mockSnap({ status: 'em_andamento' }))
      .mockResolvedValueOnce(mockSnap({ status: 'concluida' }));

    const result = await svc.uploadAta('r1', file, {}, { uid: 'u1' }, true);
    expect(result.id).toBe('ata-2');
  });

  it('usa titulo default "Ata da Reunião" quando metadata.titulo ausente', async () => {
    const file = makeFakeFile();
    mockAddDoc.mockResolvedValueOnce({ id: 'ata-x' });
    await svc.uploadAta('r1', file, {}, { uid: 'u1' });

    const payload = mockAddDoc.mock.calls[0][1];
    expect(payload.titulo).toBe('Ata da Reunião');
  });
});

// ============================================================================
// aprovarAta — flow completo (organizer já está coberto no test base)
// ============================================================================

describe('aprovarAta — fluxo de admin e auto-conclusão', () => {
  it('admin aprova e força conclusão quando reunião ainda não concluída', async () => {
    // getReuniaoById dentro de aprovarAta — status diferente de concluida
    mockGetDoc.mockResolvedValueOnce(mockSnap({
      createdBy: 'organizer',
      status: 'em_andamento',
    }));
    // updateStatus chama getReuniaoById de novo + busca após update
    mockGetDoc.mockResolvedValueOnce(mockSnap({
      status: 'em_andamento',
    }));
    mockGetDoc.mockResolvedValueOnce(mockSnap({
      status: 'concluida',
    }));
    // updateStatus log
    mockAddDoc.mockResolvedValueOnce({ id: 'log-1' });
    // após updateStatus, lê documento de ata final
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'ata1',
      data: () => ({ statusAta: 'aprovada', aprovadoPor: 'admin1' }),
    });

    const result = await svc.aprovarAta('r1', 'ata1', { uid: 'admin1', isAdmin: true });
    expect(result.statusAta).toBe('aprovada');

    // Foi chamado update para a ata
    const ataUpdate = mockUpdateDoc.mock.calls.find(c => c[1].statusAta === 'aprovada');
    expect(ataUpdate).toBeDefined();
    expect(ataUpdate[1].aprovadoPor).toBe('admin1');
  });

  it('NÃO chama updateStatus quando reunião já está concluida', async () => {
    mockGetDoc.mockResolvedValueOnce(mockSnap({
      createdBy: 'organizer',
      status: 'concluida',
    }));
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'ata1',
      data: () => ({ statusAta: 'aprovada' }),
    });

    await svc.aprovarAta('r1', 'ata1', { uid: 'organizer' });

    // Não houve segunda chamada de getReuniaoById (updateStatus pularia)
    expect(mockGetDoc).toHaveBeenCalledTimes(2);
  });
});

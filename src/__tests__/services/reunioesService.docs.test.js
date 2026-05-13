import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mocks — Firestore + Supabase Storage (Sprint 21 — v5.0.0 storage migration)
// ============================================================================

const mockAddDoc = vi.fn();
const mockUpdateDoc = vi.fn(() => Promise.resolve());
const mockDeleteDoc = vi.fn(() => Promise.resolve());
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockUploadToSupabase = vi.fn(async (bucket, path) => ({
  bucket,
  path,
  url: `https://supabase.co/storage/v1/object/sign/${bucket}/${path}?token=mock`,
}));
const mockDeleteAnyStorageObject = vi.fn(async () => ({ provider: 'supabase', deleted: true }));
const mockWhere = vi.fn((...args) => ({ __where: args }));
const mockOrderBy = vi.fn((...args) => ({ __orderBy: args }));
const mockQuery = vi.fn((...args) => ({ __query: args }));

const serverTimestampSentinel = { __sentinel: 'serverTimestamp' };

vi.mock('@/config/firebase', () => ({
  db: { __db: true },
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

vi.mock('@/lib/storage', () => ({
  uploadToSupabase: (...args) => mockUploadToSupabase(...args),
  deleteAnyStorageObject: (...args) => mockDeleteAnyStorageObject(...args),
  STORAGE_BUCKETS: {
    DOCUMENTOS: 'documentos',
    PROFILE_PHOTOS: 'profile-photos',
    REUNIAO_DOCUMENTOS: 'reuniao-documentos',
    REUNIAO_ATAS: 'reuniao-atas',
  },
}));

vi.mock('@/utils/checkinCodeGenerator', () => ({
  generateCheckinCode: vi.fn(() => '1234'),
  getCurrentWindowIndex: vi.fn(() => 42),
  getSecondsUntilNextWindow: vi.fn(() => 30),
  generateRandomSeed: vi.fn(() => 'seed-fixed'),
}));

function mockSnap(data, id = 'r1') {
  return { exists: () => true, id, data: () => data };
}

function makeFakeFile({ name = 'doc.pdf', type = 'application/pdf', size = 1024 } = {}) {
  return { name, type, size };
}

const svc = await import('../../services/reunioesService');

beforeEach(() => {
  mockAddDoc.mockReset();
  mockUpdateDoc.mockClear();
  mockDeleteDoc.mockClear();
  mockGetDoc.mockReset();
  mockGetDocs.mockReset();
  mockUploadToSupabase.mockClear();
  mockUploadToSupabase.mockImplementation(async (bucket, path) => ({
    bucket,
    path,
    url: `https://supabase.co/storage/v1/object/sign/${bucket}/${path}?token=mock`,
  }));
  mockDeleteAnyStorageObject.mockClear();
  mockDeleteAnyStorageObject.mockImplementation(async () => ({ provider: 'supabase', deleted: true }));
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
    expect(mockUploadToSupabase).toHaveBeenCalledTimes(1);
    expect(mockUploadToSupabase.mock.calls[0][0]).toBe('reuniao-documentos');
  });

  it('rejeita arquivo > 15MB', async () => {
    const huge = makeFakeFile({ size: 16 * 1024 * 1024 });
    await expect(
      svc.uploadDocumento('r1', huge, 'subsidio', {}, { uid: 'u1' })
    ).rejects.toThrow(/15MB/);
  });

  it('upload "ata" tipo vai para bucket reuniao-atas com path {reuniaoId}/{filename}', async () => {
    const file = makeFakeFile({ name: 'ata-jan.pdf' });
    mockAddDoc.mockResolvedValueOnce({ id: 'doc-ata' });

    await svc.uploadDocumento('r1', file, 'ata', {}, { uid: 'u1' });
    const [bucket, path] = mockUploadToSupabase.mock.calls[0];
    expect(bucket).toBe('reuniao-atas');
    expect(path).toMatch(/^r1\/ata_\d+_ata-jan\.pdf$/);
  });

  it('upload non-ata vai para bucket reuniao-documentos com path {reuniaoId}/{tipo}/{filename}', async () => {
    const file = makeFakeFile({ name: 'minha-pauta.pdf', size: 500 });
    mockAddDoc.mockResolvedValueOnce({ id: 'doc-1' });

    await svc.uploadDocumento('r1', file, 'pauta', {}, {
      uid: 'u1',
      displayName: 'Dr. Silva',
    });

    const [bucket, path] = mockUploadToSupabase.mock.calls[0];
    expect(bucket).toBe('reuniao-documentos');
    expect(path).toMatch(/^r1\/pauta\/pauta_\d+_minha-pauta\.pdf$/);

    const payload = mockAddDoc.mock.calls[0][1];
    expect(payload.reuniaoId).toBe('r1');
    expect(payload.tipoDocumento).toBe('pauta');
    expect(payload.titulo).toBe('minha-pauta.pdf');
    expect(payload.uploadedBy).toBe('u1');
    expect(payload.uploadedByName).toBe('Dr. Silva');
    expect(payload.arquivoUrl).toMatch(/supabase\.co\/storage/);
    expect(payload.arquivoTamanho).toBe(500);
    expect(payload.storageProvider).toBe('supabase');
    expect(payload.storageBucket).toBe('reuniao-documentos');
  });

  it('sanitiza filename para path traversal / unicode', async () => {
    const file = makeFakeFile({ name: '../../etc/passwd já.pdf' });
    mockAddDoc.mockResolvedValueOnce({ id: 'doc-clean' });
    await svc.uploadDocumento('r1', file, 'outros', {}, { uid: 'u1' });
    const [, path] = mockUploadToSupabase.mock.calls[0];
    expect(path).not.toContain('..');
    expect(path).not.toContain('/etc/');
    expect(path).toMatch(/^r1\/outros\//);
  });
});

// ============================================================================
// getDocumentos — filtros (não muda com migration)
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
    expect(mockUploadToSupabase.mock.calls[0][0]).toBe('reuniao-atas');

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ statusAta: 'rascunho' })
    );

    expect(mockGetDoc).not.toHaveBeenCalled();
  });

  it('quando markAsCompleted=true, transiciona em_andamento → concluida', async () => {
    const file = makeFakeFile();
    mockAddDoc
      .mockResolvedValueOnce({ id: 'ata-2' })
      .mockResolvedValueOnce({ id: 'log-1' });

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
// aprovarAta — flow completo
// ============================================================================

describe('aprovarAta — fluxo de admin e auto-conclusão', () => {
  it('admin aprova e força conclusão quando reunião ainda não concluída', async () => {
    mockGetDoc.mockResolvedValueOnce(mockSnap({
      createdBy: 'organizer',
      status: 'em_andamento',
    }));
    mockGetDoc.mockResolvedValueOnce(mockSnap({
      status: 'em_andamento',
    }));
    mockGetDoc.mockResolvedValueOnce(mockSnap({
      status: 'concluida',
    }));
    mockAddDoc.mockResolvedValueOnce({ id: 'log-1' });
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'ata1',
      data: () => ({ statusAta: 'aprovada', aprovadoPor: 'admin1' }),
    });

    const result = await svc.aprovarAta('r1', 'ata1', { uid: 'admin1', isAdmin: true });
    expect(result.statusAta).toBe('aprovada');

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

    expect(mockGetDoc).toHaveBeenCalledTimes(2);
  });
});

// ============================================================================
// deleteDocumento — provider-aware delete (Sprint 21)
// ============================================================================

describe('deleteDocumento — provider-aware delete (Sprint 21)', () => {
  it('docs novos com storageProvider="supabase" chamam delete Supabase', async () => {
    mockGetDoc.mockResolvedValueOnce(mockSnap({
      uploadedBy: 'u1',
      arquivoUrl: 'https://x.supabase.co/storage/v1/object/sign/reuniao-documentos/r1/pauta/file.pdf',
      storagePath: 'r1/pauta/file.pdf',
      storageBucket: 'reuniao-documentos',
      storageProvider: 'supabase',
      tipoDocumento: 'pauta',
      reuniaoId: 'r1',
    }, 'd1'));
    // segundo getDoc para reuniao (organizer check)
    mockGetDoc.mockResolvedValueOnce(mockSnap({ createdBy: 'organizer' }, 'r1'));

    await svc.deleteDocumento('d1', { uid: 'u1' });

    expect(mockDeleteAnyStorageObject).toHaveBeenCalledTimes(1);
    const [url, opts] = mockDeleteAnyStorageObject.mock.calls[0];
    expect(url).toMatch(/supabase\.co\/storage/);
    expect(opts.supabaseBucket).toBe('reuniao-documentos');
    expect(opts.supabasePath).toBe('r1/pauta/file.pdf');
    expect(opts.firebasePath).toBeUndefined();
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
  });

  it('docs legacy sem storageProvider (Firebase) chamam delete Firebase via fallback', async () => {
    mockGetDoc.mockResolvedValueOnce(mockSnap({
      uploadedBy: 'u1',
      arquivoUrl: 'https://firebasestorage.googleapis.com/v0/b/anest-ap/o/reunioes%2Fr1%2Fpauta%2Ffoo.pdf?alt=media',
      storagePath: 'reunioes/r1/pauta/foo.pdf',
      // sem storageProvider → fallback firebase
      tipoDocumento: 'pauta',
      reuniaoId: 'r1',
    }, 'd2'));
    mockGetDoc.mockResolvedValueOnce(mockSnap({ createdBy: 'organizer' }, 'r1'));

    await svc.deleteDocumento('d2', { uid: 'u1' });

    expect(mockDeleteAnyStorageObject).toHaveBeenCalledTimes(1);
    const [, opts] = mockDeleteAnyStorageObject.mock.calls[0];
    expect(opts.firebasePath).toBe('reunioes/r1/pauta/foo.pdf');
    expect(opts.supabasePath).toBeUndefined();
  });

  it('idempotente quando documento não existe', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });
    const result = await svc.deleteDocumento('not-found', { uid: 'u1' });
    expect(result).toBe(true);
    expect(mockDeleteAnyStorageObject).not.toHaveBeenCalled();
    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });
});

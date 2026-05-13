import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Tests for src/lib/storage.js — Sprint 21 provider-aware helpers
// ============================================================================

const mockSupabaseUpload = vi.fn(async () => ({ data: { path: 'p' }, error: null }));
const mockSupabaseRemove = vi.fn(async () => ({ data: [], error: null }));
const mockSupabaseSignedUrl = vi.fn(async (path, expiresIn) => ({
  data: { signedUrl: `https://x.supabase.co/storage/v1/object/sign/test/${path}?token=mock&expires=${expiresIn}` },
  error: null,
}));
const mockSupabasePublicUrl = vi.fn((path) => ({
  data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/test/${path}` },
}));

vi.mock('@/config/supabase', () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        upload: mockSupabaseUpload,
        remove: mockSupabaseRemove,
        createSignedUrl: mockSupabaseSignedUrl,
        getPublicUrl: mockSupabasePublicUrl,
      })),
    },
  },
}));

const mockFbRef = vi.fn((_storage, path) => ({ __fbref: true, fullPath: path }));
const mockFbGetDownloadURL = vi.fn(async () => 'https://firebasestorage.googleapis.com/v0/b/x/o/y?alt=media');
const mockFbDeleteObject = vi.fn(async () => undefined);

vi.mock('firebase/storage', () => ({
  ref: (...args) => mockFbRef(...args),
  getDownloadURL: (...args) => mockFbGetDownloadURL(...args),
  deleteObject: (...args) => mockFbDeleteObject(...args),
}));

vi.mock('@/config/firebase', () => ({
  storage: { __fb_storage: true },
}));

const lib = await import('../../lib/storage');

beforeEach(() => {
  mockSupabaseUpload.mockClear();
  mockSupabaseUpload.mockResolvedValue({ data: { path: 'p' }, error: null });
  mockSupabaseRemove.mockClear();
  mockSupabaseRemove.mockResolvedValue({ data: [], error: null });
  mockSupabaseSignedUrl.mockClear();
  mockSupabaseSignedUrl.mockImplementation(async (path, expiresIn) => ({
    data: { signedUrl: `https://x.supabase.co/storage/v1/object/sign/test/${path}?token=mock&expires=${expiresIn}` },
    error: null,
  }));
  mockSupabasePublicUrl.mockClear();
  mockFbRef.mockClear();
  mockFbGetDownloadURL.mockClear();
  mockFbDeleteObject.mockClear();
  mockFbDeleteObject.mockResolvedValue(undefined);
});

// ----------------------------------------------------------------------------
// detectStorageProvider
// ----------------------------------------------------------------------------

describe('detectStorageProvider', () => {
  it('detecta Firebase URL classic', () => {
    expect(lib.detectStorageProvider('https://firebasestorage.googleapis.com/v0/b/x/o/y?alt=media'))
      .toBe('firebase');
  });

  it('detecta Firebase URL no formato storage.googleapis.com/v0', () => {
    expect(lib.detectStorageProvider('https://storage.googleapis.com/v0/b/x/o/y'))
      .toBe('firebase');
  });

  it('detecta Supabase URL (sign)', () => {
    expect(lib.detectStorageProvider(
      'https://abc.supabase.co/storage/v1/object/sign/profile-photos/u1/avatar.jpg?token=xyz'
    )).toBe('supabase');
  });

  it('detecta Supabase URL (public)', () => {
    expect(lib.detectStorageProvider(
      'https://abc.supabase.co/storage/v1/object/public/documentos/foo.pdf'
    )).toBe('supabase');
  });

  it('retorna null para URL vazia ou inválida', () => {
    expect(lib.detectStorageProvider(null)).toBe(null);
    expect(lib.detectStorageProvider('')).toBe(null);
    expect(lib.detectStorageProvider(undefined)).toBe(null);
    expect(lib.detectStorageProvider('https://random.com/file.pdf')).toBe(null);
  });

  it('retorna null para input não-string', () => {
    expect(lib.detectStorageProvider({ url: 'x' })).toBe(null);
    expect(lib.detectStorageProvider(42)).toBe(null);
  });
});

// ----------------------------------------------------------------------------
// parseSupabaseStorageUrl
// ----------------------------------------------------------------------------

describe('parseSupabaseStorageUrl', () => {
  it('parsea URL sign com bucket + path', () => {
    const r = lib.parseSupabaseStorageUrl(
      'https://abc.supabase.co/storage/v1/object/sign/profile-photos/u1/avatar.jpg?token=xyz'
    );
    expect(r).toEqual({ bucket: 'profile-photos', path: 'u1/avatar.jpg' });
  });

  it('parsea URL public', () => {
    const r = lib.parseSupabaseStorageUrl(
      'https://abc.supabase.co/storage/v1/object/public/documentos/biblioteca/d1/v1/x.pdf'
    );
    expect(r).toEqual({ bucket: 'documentos', path: 'biblioteca/d1/v1/x.pdf' });
  });

  it('parsea URL authenticated', () => {
    const r = lib.parseSupabaseStorageUrl(
      'https://abc.supabase.co/storage/v1/object/authenticated/reuniao-atas/r1/file.pdf'
    );
    expect(r).toEqual({ bucket: 'reuniao-atas', path: 'r1/file.pdf' });
  });

  it('decodeURIComponent no path', () => {
    const r = lib.parseSupabaseStorageUrl(
      'https://abc.supabase.co/storage/v1/object/sign/x/folder%20with%20space/file.pdf'
    );
    expect(r.path).toBe('folder with space/file.pdf');
  });

  it('retorna null para URL não-Supabase', () => {
    expect(lib.parseSupabaseStorageUrl(
      'https://firebasestorage.googleapis.com/v0/b/x/o/y'
    )).toBe(null);
    expect(lib.parseSupabaseStorageUrl('')).toBe(null);
    expect(lib.parseSupabaseStorageUrl(null)).toBe(null);
  });
});

// ----------------------------------------------------------------------------
// getSignedUrl + getPublicUrl
// ----------------------------------------------------------------------------

describe('getSignedUrl', () => {
  it('chama supabase.storage.from(bucket).createSignedUrl(path, expiresIn)', async () => {
    const url = await lib.getSignedUrl('profile-photos', 'u1/avatar.jpg', 1800);
    expect(mockSupabaseSignedUrl).toHaveBeenCalledWith('u1/avatar.jpg', 1800);
    expect(url).toContain('expires=1800');
  });

  it('default expiresIn=3600', async () => {
    await lib.getSignedUrl('x', 'y');
    expect(mockSupabaseSignedUrl).toHaveBeenCalledWith('y', 3600);
  });

  it('propaga error do Supabase', async () => {
    mockSupabaseSignedUrl.mockResolvedValueOnce({ data: null, error: new Error('boom') });
    await expect(lib.getSignedUrl('x', 'y')).rejects.toThrow('boom');
  });
});

describe('getPublicUrl', () => {
  it('retorna URL pública do bucket', () => {
    const url = lib.getPublicUrl('test', 'foo/bar.pdf');
    expect(url).toContain('/public/test/foo/bar.pdf');
  });
});

// ----------------------------------------------------------------------------
// uploadToSupabase
// ----------------------------------------------------------------------------

describe('uploadToSupabase', () => {
  it('chama upload com opts default + retorna URL signed', async () => {
    const fake = { name: 'a.pdf', type: 'application/pdf', size: 10 };
    const result = await lib.uploadToSupabase('documentos', 'x/y/z.pdf', fake);
    expect(mockSupabaseUpload).toHaveBeenCalled();
    const [path, file, opts] = mockSupabaseUpload.mock.calls[0];
    expect(path).toBe('x/y/z.pdf');
    expect(file).toBe(fake);
    expect(opts.upsert).toBe(false);
    expect(opts.cacheControl).toBe('3600');
    expect(result.path).toBe('x/y/z.pdf');
    expect(result.bucket).toBe('documentos');
    expect(result.url).toContain('supabase.co');
  });

  it('passa upsert+contentType custom', async () => {
    const fake = { type: 'image/jpeg' };
    await lib.uploadToSupabase('profile-photos', 'u1/avatar.jpg', fake, {
      upsert: true,
      cacheControl: '7200',
      contentType: 'image/png',
    });
    const opts = mockSupabaseUpload.mock.calls[0][2];
    expect(opts.upsert).toBe(true);
    expect(opts.cacheControl).toBe('7200');
    expect(opts.contentType).toBe('image/png');
  });

  it('throw quando upload retorna error', async () => {
    mockSupabaseUpload.mockResolvedValueOnce({ data: null, error: new Error('quota') });
    await expect(lib.uploadToSupabase('x', 'y', { type: 'application/pdf' }))
      .rejects.toThrow('quota');
  });
});

// ----------------------------------------------------------------------------
// deleteAnyStorageObject
// ----------------------------------------------------------------------------

describe('deleteAnyStorageObject', () => {
  it('URL Supabase → chama supabase.storage.remove', async () => {
    const url = 'https://x.supabase.co/storage/v1/object/sign/documentos/foo.pdf?token=t';
    const r = await lib.deleteAnyStorageObject(url);
    expect(r.provider).toBe('supabase');
    expect(r.deleted).toBe(true);
    expect(mockSupabaseRemove).toHaveBeenCalledWith(['foo.pdf']);
    expect(mockFbDeleteObject).not.toHaveBeenCalled();
  });

  it('URL Firebase → chama firebase deleteObject', async () => {
    const url = 'https://firebasestorage.googleapis.com/v0/b/x/o/avatars%2Fu1?alt=media';
    const r = await lib.deleteAnyStorageObject(url, { firebasePath: 'avatars/u1' });
    expect(r.provider).toBe('firebase');
    expect(r.deleted).toBe(true);
    expect(mockFbDeleteObject).toHaveBeenCalledTimes(1);
    expect(mockSupabaseRemove).not.toHaveBeenCalled();
  });

  it('URL Firebase sem opts.firebasePath → usa URL como path fallback', async () => {
    const url = 'https://firebasestorage.googleapis.com/v0/b/x/o/y';
    const r = await lib.deleteAnyStorageObject(url);
    expect(r.provider).toBe('firebase');
    expect(mockFbRef).toHaveBeenCalledWith({ __fb_storage: true }, url);
  });

  it('URL desconhecida com opts.supabaseBucket → usa fallback Supabase', async () => {
    const r = await lib.deleteAnyStorageObject(null, {
      supabaseBucket: 'profile-photos',
      supabasePath: 'u1/avatar.jpg',
    });
    expect(r.provider).toBe('supabase');
    expect(mockSupabaseRemove).toHaveBeenCalledWith(['u1/avatar.jpg']);
  });

  it('Firebase object-not-found NÃO lança (idempotente)', async () => {
    mockFbDeleteObject.mockRejectedValueOnce({ code: 'storage/object-not-found' });
    const r = await lib.deleteAnyStorageObject(null, { firebasePath: 'gone' });
    expect(r.provider).toBe('firebase');
    expect(r.deleted).toBe(false);
  });

  it('sem url + sem opts retorna provider null', async () => {
    const r = await lib.deleteAnyStorageObject(null);
    expect(r.provider).toBe(null);
    expect(r.deleted).toBe(false);
  });
});

// ----------------------------------------------------------------------------
// resolveUrl
// ----------------------------------------------------------------------------

describe('resolveUrl', () => {
  it('retorna Firebase URL como-is (sem fetch novo)', async () => {
    const url = 'https://firebasestorage.googleapis.com/v0/b/x/o/y';
    const r = await lib.resolveUrl(url);
    expect(r).toBe(url);
    expect(mockSupabaseSignedUrl).not.toHaveBeenCalled();
  });

  it('Supabase URL → renova signed URL via getSignedUrl', async () => {
    const url = 'https://x.supabase.co/storage/v1/object/sign/documentos/foo.pdf?token=old';
    const r = await lib.resolveUrl(url);
    expect(r).toContain('token=mock');
    expect(mockSupabaseSignedUrl).toHaveBeenCalledWith('foo.pdf', 3600);
  });

  it('opts.bucket+path força fresh signed URL', async () => {
    const r = await lib.resolveUrl(null, { bucket: 'x', path: 'y.pdf', expiresIn: 60 });
    expect(mockSupabaseSignedUrl).toHaveBeenCalledWith('y.pdf', 60);
    expect(r).toContain('expires=60');
  });

  it('sem url + sem opts retorna null', async () => {
    expect(await lib.resolveUrl(null)).toBe(null);
  });
});

// ----------------------------------------------------------------------------
// STORAGE_BUCKETS
// ----------------------------------------------------------------------------

describe('STORAGE_BUCKETS constants', () => {
  it('expõe 4 buckets pós-Sprint 21', () => {
    expect(lib.STORAGE_BUCKETS).toEqual({
      DOCUMENTOS: 'documentos',
      PROFILE_PHOTOS: 'profile-photos',
      REUNIAO_DOCUMENTOS: 'reuniao-documentos',
      REUNIAO_ATAS: 'reuniao-atas',
    });
  });
});

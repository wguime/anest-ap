import { describe, it, expect, vi, beforeEach } from 'vitest';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, _col, id) => ({ _id: id })),
  getDoc: vi.fn(),
  setDoc: vi.fn(() => Promise.resolve()),
  serverTimestamp: vi.fn(() => ({ _type: 'serverTimestamp' })),
}));

vi.mock('../../config/firebase', () => ({ db: {} }));

vi.mock('../../services/firestoreSubscriptionHelper', () => ({
  createFirestoreSubscription: vi.fn((ref, handlers, opts) => {
    // Capture handlers so tests can drive snapshots manually.
    globalThis._lastStaffSub = { ref, handlers, opts };
    return { cleanup: vi.fn(() => { globalThis._lastStaffSub = null; }) };
  }),
}));

import { getStaff, updateStaff, subscribeStaff, initializeStaffData } from '../../services/staffService';

beforeEach(() => {
  vi.clearAllMocks();
  globalThis._lastStaffSub = null;
});

describe('staffService', () => {
  describe('getStaff', () => {
    it('retorna staff em caso de doc existente', async () => {
      const fakeData = { hospitais: ['HU'], consultorio: { open: true } };
      getDoc.mockResolvedValueOnce({ exists: () => true, data: () => fakeData });

      const result = await getStaff();

      expect(result.error).toBeNull();
      expect(result.staff).toEqual(fakeData);
      expect(doc).toHaveBeenCalledWith({}, 'staff', 'schedule');
    });

    it('retorna { staff: null, error: null } quando doc não existe', async () => {
      getDoc.mockResolvedValueOnce({ exists: () => false });

      const result = await getStaff();

      expect(result.staff).toBeNull();
      expect(result.error).toBeNull();
    });

    it('retorna error quando getDoc lança', async () => {
      getDoc.mockRejectedValueOnce(new Error('Network offline'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await getStaff();

      expect(result.staff).toBeNull();
      expect(result.error).toBe('Network offline');
      consoleSpy.mockRestore();
    });
  });

  describe('updateStaff', () => {
    it('escreve doc com payload + audit fields', async () => {
      const payload = { hospitais: ['HU', 'HC'] };

      const result = await updateStaff(payload, 'user-42');

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(setDoc).toHaveBeenCalledTimes(1);
      const writtenData = setDoc.mock.calls[0][1];
      expect(writtenData.hospitais).toEqual(['HU', 'HC']);
      expect(writtenData.updatedBy).toBe('user-42');
      expect(writtenData.updatedAt).toEqual({ _type: 'serverTimestamp' });
    });

    it('retorna error quando setDoc lança', async () => {
      setDoc.mockRejectedValueOnce(new Error('Permission denied'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await updateStaff({ x: 1 }, 'user-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission denied');
      consoleSpy.mockRestore();
    });

    it('preserva campos arbitrários do payload', async () => {
      await updateStaff({ a: 1, b: 'x', c: [true] }, 'u');
      const data = setDoc.mock.calls[0][1];
      expect(data).toMatchObject({ a: 1, b: 'x', c: [true], updatedBy: 'u' });
    });
  });

  describe('subscribeStaff', () => {
    it('chama callback com staff quando snapshot existe', () => {
      const cb = vi.fn();
      const cleanup = subscribeStaff(cb);

      const fakeData = { hospitais: ['HU'] };
      globalThis._lastStaffSub.handlers.onData({
        exists: () => true,
        data: () => fakeData,
      });

      expect(cb).toHaveBeenCalledWith({ staff: fakeData, error: null });
      expect(typeof cleanup).toBe('function');
    });

    it('chama callback com null quando snapshot não existe', () => {
      const cb = vi.fn();
      subscribeStaff(cb);

      globalThis._lastStaffSub.handlers.onData({ exists: () => false });

      expect(cb).toHaveBeenCalledWith({ staff: null, error: null });
    });

    it('chama callback com error em caso de erro do listener', () => {
      const cb = vi.fn();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      subscribeStaff(cb);

      globalThis._lastStaffSub.handlers.onError(new Error('listener-fail'));

      expect(cb).toHaveBeenCalledWith({ staff: null, error: 'listener-fail' });
      consoleSpy.mockRestore();
    });

    it('repassa onStatusChange via options', () => {
      const onStatusChange = vi.fn();
      subscribeStaff(vi.fn(), { onStatusChange });

      expect(globalThis._lastStaffSub.opts.onStatusChange).toBe(onStatusChange);
    });
  });

  describe('initializeStaffData', () => {
    it('cria doc com mock quando ausente', async () => {
      getDoc.mockResolvedValueOnce({ exists: () => false });
      const mock = { hospitais: [], consultorio: null };

      const result = await initializeStaffData(mock, 'admin-1');

      expect(result.success).toBe(true);
      expect(setDoc).toHaveBeenCalledTimes(1);
      const written = setDoc.mock.calls[0][1];
      expect(written.updatedBy).toBe('admin-1');
      expect(written.hospitais).toEqual([]);
    });

    it('não escreve quando doc já existe (idempotente)', async () => {
      getDoc.mockResolvedValueOnce({ exists: () => true });

      const result = await initializeStaffData({ x: 1 }, 'u');

      expect(result.success).toBe(true);
      expect(setDoc).not.toHaveBeenCalled();
    });

    it('retorna error quando getDoc falha', async () => {
      getDoc.mockRejectedValueOnce(new Error('Read failure'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await initializeStaffData({}, 'u');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Read failure');
      consoleSpy.mockRestore();
    });
  });
});

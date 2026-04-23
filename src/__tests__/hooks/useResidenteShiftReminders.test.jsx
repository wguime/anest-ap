/**
 * Testes de integração para useResidenteShiftReminders.
 *
 * Notas:
 * - O hook usa um Set module-level (`processedSessions`) para dedup por
 *   sessão. Por isso cada teste usa uma data do sistema diferente
 *   (2026-03-04, 2026-03-05, ...) para gerar sessionKey único e evitar
 *   contaminação entre testes.
 * - Sem fake timers: o hook dispara uma async chain; usamos waitFor +
 *   timeouts reais.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const { mockCreate, mockGetPlantaoDiario, mockSupabase } = vi.hoisted(() => {
  const createFn = vi.fn(() => Promise.resolve({ id: 'notif-created' }));
  const getPlantaoDiarioFn = vi.fn(() => Promise.resolve({ data: null, error: null }));

  const profilesMaybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
  const notifIn = vi.fn(() => Promise.resolve({ data: [], error: null }));

  return {
    mockCreate: createFn,
    mockGetPlantaoDiario: getPlantaoDiarioFn,
    mockSupabase: {
      client: {
        from: vi.fn((table) => {
          if (table === 'profiles') {
            return {
              select: vi.fn().mockReturnThis(),
              ilike: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              maybeSingle: profilesMaybeSingle,
            };
          }
          if (table === 'notifications') {
            return {
              select: vi.fn().mockReturnThis(),
              in: notifIn,
            };
          }
          return { select: vi.fn().mockReturnThis() };
        }),
      },
      profilesMaybeSingle,
      notifIn,
    },
  };
});

const { mockUser } = vi.hoisted(() => ({ mockUser: { value: { id: 'admin-uid', isAdmin: true } } }));

vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: mockUser.value }),
}));

vi.mock('@/contexts/MessagesContext', () => ({
  useMessages: () => ({ createSystemNotification: mockCreate }),
}));

vi.mock('../../services/residenciaPlantaoDiarioService', () => ({
  getPlantaoDiario: mockGetPlantaoDiario,
}));

vi.mock('../../config/supabase', () => ({
  supabase: mockSupabase.client,
}));

// Helper: define hoje (Date) e retorna fn que resetModules + reimporta hook
async function importHook(today) {
  vi.setSystemTime(today);
  vi.resetModules();
  const mod = await import('../../hooks/useResidenteShiftReminders');
  return mod.useResidenteShiftReminders;
}

describe('useResidenteShiftReminders', () => {
  beforeEach(() => {
    mockCreate.mockClear().mockResolvedValue({ id: 'notif-created' });
    mockGetPlantaoDiario.mockClear().mockResolvedValue({ data: null, error: null });
    mockSupabase.profilesMaybeSingle.mockClear().mockResolvedValue({ data: null, error: null });
    mockSupabase.notifIn.mockClear().mockResolvedValue({ data: [], error: null });
    mockUser.value = { id: 'admin-uid', isAdmin: true };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('guard: não executa se user não é admin', async () => {
    vi.useFakeTimers({ now: new Date('2026-03-04T12:00:00').getTime() });
    mockUser.value = { id: 'u1', isAdmin: false };
    const hook = await importHook(new Date('2026-03-04T12:00:00'));

    renderHook(() => hook({ dataLoaded: true, usandoMock: false }));
    vi.useRealTimers();
    await new Promise((r) => setTimeout(r, 50));
    expect(mockGetPlantaoDiario).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('guard: não executa se usandoMock=true', async () => {
    vi.useFakeTimers({ now: new Date('2026-03-05T12:00:00').getTime() });
    const hook = await importHook(new Date('2026-03-05T12:00:00'));

    renderHook(() => hook({ dataLoaded: true, usandoMock: true }));
    vi.useRealTimers();
    await new Promise((r) => setTimeout(r, 50));
    expect(mockGetPlantaoDiario).not.toHaveBeenCalled();
  });

  it('cria lembrete D-1 quando amanhã tem residente escalado e profile existe', async () => {
    // Hoje=2026-03-06 → amanhã=2026-03-07 → r3-raffaela (email raffanehls@gmail.com)
    mockSupabase.profilesMaybeSingle.mockResolvedValue({
      data: { id: 'uid-raffaela', nome: 'Raffaela', email: 'raffanehls@gmail.com' },
      error: null,
    });
    vi.useFakeTimers({ now: new Date('2026-03-06T23:00:00').getTime() });
    const hook = await importHook(new Date('2026-03-06T23:00:00'));

    renderHook(() => hook({ dataLoaded: true, usandoMock: false }));
    vi.useRealTimers();

    await waitFor(() => expect(mockCreate).toHaveBeenCalled(), { timeout: 3000 });

    const d1Call = mockCreate.mock.calls.find((c) =>
      c[0]?.subject?.includes('amanhã')
    );
    expect(d1Call).toBeDefined();
    expect(d1Call[0].recipientId).toBe('uid-raffaela');
    expect(d1Call[0].relatedEntityType).toBe('plantao-residencia');
    expect(d1Call[0].actionUrl).toBe('residencia');
  });

  it('usa override Firestore com precedência sobre base estática', async () => {
    // Hoje=2026-03-07. Amanhã=2026-03-08 → base=r2-rodrigo.
    // Override → r3-wagner.
    mockGetPlantaoDiario.mockImplementation((dateKey) => {
      if (dateKey === '2026-03-08') {
        return Promise.resolve({
          data: { residenteOverride: 'r3-wagner', origem: 'troca', trocaId: 'tr-1' },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });
    mockSupabase.profilesMaybeSingle.mockResolvedValue({
      data: { id: 'uid-wagner', nome: 'Wagner', email: 'wagnermissio@hotmail.com' },
      error: null,
    });
    vi.useFakeTimers({ now: new Date('2026-03-07T23:00:00').getTime() });
    const hook = await importHook(new Date('2026-03-07T23:00:00'));

    renderHook(() => hook({ dataLoaded: true, usandoMock: false }));
    vi.useRealTimers();

    await waitFor(() => expect(mockCreate).toHaveBeenCalled(), { timeout: 3000 });
    const d1Call = mockCreate.mock.calls.find((c) => c[0]?.subject?.includes('amanhã'));
    expect(d1Call).toBeDefined();
    expect(d1Call[0].recipientId).toBe('uid-wagner');
  });

  it('dedup: não insere se related_entity_id já existe em notifications', async () => {
    mockSupabase.profilesMaybeSingle.mockResolvedValue({
      data: { id: 'uid-daniel', email: 'danielffk99@gmail.com', nome: 'Daniel' },
      error: null,
    });
    // Simula que JÁ foi notificado — any related_entity_id passado vem na resposta
    mockSupabase.notifIn.mockImplementation((_col, ids) =>
      Promise.resolve({
        data: ids.map((id) => ({ related_entity_id: id })),
        error: null,
      })
    );
    vi.useFakeTimers({ now: new Date('2026-03-08T23:00:00').getTime() });
    const hook = await importHook(new Date('2026-03-08T23:00:00'));

    renderHook(() => hook({ dataLoaded: true, usandoMock: false }));
    vi.useRealTimers();

    await waitFor(() => expect(mockSupabase.notifIn).toHaveBeenCalled(), { timeout: 3000 });
    // Aguarda flush do fluxo async
    await new Promise((r) => setTimeout(r, 100));
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('não cria lembrete se match de profile falha (email não cadastrado)', async () => {
    mockSupabase.profilesMaybeSingle.mockResolvedValue({ data: null, error: null });
    vi.useFakeTimers({ now: new Date('2026-03-09T23:00:00').getTime() });
    const hook = await importHook(new Date('2026-03-09T23:00:00'));

    renderHook(() => hook({ dataLoaded: true, usandoMock: false }));
    vi.useRealTimers();

    await new Promise((r) => setTimeout(r, 200));
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

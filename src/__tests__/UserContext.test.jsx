/**
 * Tests for UserContext — real-time profile listener via onSnapshot.
 *
 * Validates the fix: when an admin sets isAdmin=true for another user
 * in Centro de Gestao, the target user's context updates automatically
 * without requiring re-login.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { UserProvider, useUser } from '../contexts/UserContext';

// ─── Captured callbacks ──────────────────────────────────────────
let authChangeCallback = null;       // callback registered by onAuthChange
let snapshotCallback = null;         // callback registered by onSnapshot
const unsubAuth = vi.fn();
const unsubSnapshot = vi.fn();

// ─── Mock: firebase/firestore ────────────────────────────────────
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, collection, id) => ({ _collection: collection, _id: id })),
  updateDoc: vi.fn(() => Promise.resolve()),
  setDoc: vi.fn(() => Promise.resolve()),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  onSnapshot: vi.fn((ref, cb) => {
    snapshotCallback = cb;
    return unsubSnapshot;
  }),
}));

// ─── Mock: firebase/storage ──────────────────────────────────────
vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
  deleteObject: vi.fn(),
}));

// ─── Mock: config/firebase ───────────────────────────────────────
vi.mock('../config/firebase', () => ({
  db: { _type: 'mock-db' },
  storage: { _type: 'mock-storage' },
}));

// ─── Mock: authService ───────────────────────────────────────────
vi.mock('../services/authService', () => ({
  signIn: vi.fn(() => Promise.resolve({ user: { uid: 'u1' } })),
  signUp: vi.fn(() => Promise.resolve({ user: { uid: 'u1' } })),
  logOut: vi.fn(() => Promise.resolve({})),
  resetPassword: vi.fn(() => Promise.resolve({})),
  onAuthChange: vi.fn((cb) => {
    authChangeCallback = cb;
    return unsubAuth;
  }),
}));

// ─── Mock: supabaseUsersService ──────────────────────────────────
// IMPORTANT: keep this list in sync with UserContext.jsx imports.
// Adding `fetchMyIncidentSettings` because UserContext.jsx:105 calls it.
vi.mock('../services/supabaseUsersService', () => ({
  default: {
    recordAccess: vi.fn(() => Promise.resolve()),
    fetchMyIncidentSettings: vi.fn(() => Promise.resolve(null)),
    updateMyIncidentSettings: vi.fn(() => Promise.resolve()),
  },
}));

// ─── Mock: config/supabase (Supabase client) ────────────────────
// Inclui channel/removeChannel pois UserContext.jsx chama
// createReliableSubscription, que internamente faz supabase.channel(...).
// Sem isso, o callback do onSnapshot crashava antes de setIsLoading(false),
// fazendo testes 1 e 4 falharem (loading travado em true).
const mockSupabaseQuery = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
};
const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
  unsubscribe: vi.fn(() => Promise.resolve('ok')),
};
vi.mock('../config/supabase', () => ({
  supabase: {
    from: vi.fn(() => mockSupabaseQuery),
    channel: vi.fn(() => mockChannel),
    removeChannel: vi.fn(() => Promise.resolve('ok')),
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
  },
}));

// ─── Helper: snapshot document mock ──────────────────────────────
function makeSnap(data, id = 'u1') {
  if (data === null) {
    return { exists: () => false, id, data: () => null };
  }
  return { exists: () => true, id, data: () => data };
}

// ─── Helper: component that exposes context values ───────────────
function ContextReader() {
  const ctx = useUser();
  return (
    <div>
      <span data-testid="user">{ctx.user ? JSON.stringify(ctx.user) : 'null'}</span>
      <span data-testid="loading">{String(ctx.isLoading)}</span>
      <span data-testid="authenticated">{String(ctx.isAuthenticated)}</span>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <UserProvider>
      <ContextReader />
    </UserProvider>,
  );
}

// ─── Tests ───────────────────────────────────────────────────────
describe('UserContext real-time profile listener', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authChangeCallback = null;
    snapshotCallback = null;
  });

  // -----------------------------------------------------------
  // 1. Login loads profile via onSnapshot
  // -----------------------------------------------------------
  it('loads user profile from Firestore snapshot on login', async () => {
    renderWithProvider();

    // Initially loading
    expect(screen.getByTestId('loading').textContent).toBe('true');
    expect(screen.getByTestId('user').textContent).toBe('null');

    // Simulate Firebase auth change (user logs in)
    await act(async () => {
      await authChangeCallback({
        uid: 'u1',
        email: 'test@anest.com.br',
        displayName: 'Dr. Test',
      });
    });

    // onSnapshot should have been called
    const { onSnapshot } = await import('firebase/firestore');
    expect(onSnapshot).toHaveBeenCalledTimes(1);

    // Simulate Firestore delivering the profile snapshot
    await act(async () => {
      snapshotCallback(makeSnap({
        uid: 'u1',
        email: 'test@anest.com.br',
        displayName: 'Dr. Test',
        role: 'anestesiologista',
        isAdmin: false,
        isCoordenador: false,
      }));
    });

    // User should be set, loading done
    expect(screen.getByTestId('loading').textContent).toBe('false');
    expect(screen.getByTestId('authenticated').textContent).toBe('true');
    const user = JSON.parse(screen.getByTestId('user').textContent);
    expect(user.email).toBe('test@anest.com.br');
    expect(user.isAdmin).toBe(false);
    expect(user.role).toBe('anestesiologista');
  });

  // -----------------------------------------------------------
  // 2. Real-time update: isAdmin changes from false to true
  // -----------------------------------------------------------
  it('updates user in real-time when isAdmin changes in Firestore', async () => {
    renderWithProvider();

    // Login
    await act(async () => {
      await authChangeCallback({
        uid: 'u1',
        email: 'userb@anest.com.br',
        displayName: 'User B',
      });
    });

    // Initial snapshot: non-admin
    await act(async () => {
      snapshotCallback(makeSnap({
        uid: 'u1',
        email: 'userb@anest.com.br',
        displayName: 'User B',
        role: 'colaborador',
        isAdmin: false,
        isCoordenador: false,
      }));
    });

    let user = JSON.parse(screen.getByTestId('user').textContent);
    expect(user.isAdmin).toBe(false);

    // Admin A updates User B's profile in Firestore → onSnapshot fires again
    await act(async () => {
      snapshotCallback(makeSnap({
        uid: 'u1',
        email: 'userb@anest.com.br',
        displayName: 'User B',
        role: 'colaborador',
        isAdmin: true,
        isCoordenador: false,
      }));
    });

    // User B should now see isAdmin: true WITHOUT re-login
    user = JSON.parse(screen.getByTestId('user').textContent);
    expect(user.isAdmin).toBe(true);
  });

  // -----------------------------------------------------------
  // 3. Real-time update: isCoordenador changes
  // -----------------------------------------------------------
  it('updates user in real-time when isCoordenador changes in Firestore', async () => {
    renderWithProvider();

    await act(async () => {
      await authChangeCallback({
        uid: 'u1',
        email: 'userb@anest.com.br',
        displayName: 'User B',
      });
    });

    await act(async () => {
      snapshotCallback(makeSnap({
        uid: 'u1',
        email: 'userb@anest.com.br',
        role: 'enfermeiro',
        isAdmin: false,
        isCoordenador: false,
      }));
    });

    let user = JSON.parse(screen.getByTestId('user').textContent);
    expect(user.isCoordenador).toBe(false);

    // Promote to coordenador
    await act(async () => {
      snapshotCallback(makeSnap({
        uid: 'u1',
        email: 'userb@anest.com.br',
        role: 'enfermeiro',
        isAdmin: false,
        isCoordenador: true,
      }));
    });

    user = JSON.parse(screen.getByTestId('user').textContent);
    expect(user.isCoordenador).toBe(true);
  });

  // -----------------------------------------------------------
  // 4. Logout clears user and unsubscribes snapshot listener
  // -----------------------------------------------------------
  it('clears state and unsubscribes snapshot on logout', async () => {
    renderWithProvider();

    // Login
    await act(async () => {
      await authChangeCallback({
        uid: 'u1',
        email: 'test@anest.com.br',
        displayName: 'Dr. Test',
      });
    });

    // Deliver initial snapshot
    await act(async () => {
      snapshotCallback(makeSnap({
        uid: 'u1',
        email: 'test@anest.com.br',
        role: 'anestesiologista',
        isAdmin: false,
      }));
    });

    expect(screen.getByTestId('authenticated').textContent).toBe('true');

    // Logout: Firebase triggers onAuthChange with null
    await act(async () => {
      await authChangeCallback(null);
    });

    // Profile snapshot listener should be unsubscribed
    expect(unsubSnapshot).toHaveBeenCalled();

    // State should be cleared
    expect(screen.getByTestId('user').textContent).toBe('null');
    expect(screen.getByTestId('authenticated').textContent).toBe('false');
    expect(screen.getByTestId('loading').textContent).toBe('false');
  });

  // -----------------------------------------------------------
  // 5. New user: creates profile when document does not exist
  // -----------------------------------------------------------
  it('creates a new profile when Firestore document does not exist', async () => {
    renderWithProvider();

    await act(async () => {
      await authChangeCallback({
        uid: 'new-user',
        email: 'new@anest.com.br',
        displayName: 'New User',
      });
    });

    // Snapshot returns non-existent document
    await act(async () => {
      snapshotCallback(makeSnap(null, 'new-user'));
    });

    // setDoc should have been called to create the profile
    const { setDoc } = await import('firebase/firestore');
    expect(setDoc).toHaveBeenCalledTimes(1);
    const [, profileData] = setDoc.mock.calls[0];
    expect(profileData.uid).toBe('new-user');
    expect(profileData.email).toBe('new@anest.com.br');
    expect(profileData.role).toBe('colaborador');
    expect(profileData.isAdmin).toBe(false);

    // User state should be populated with new profile
    const user = JSON.parse(screen.getByTestId('user').textContent);
    expect(user.id).toBe('new-user');
    expect(user.role).toBe('colaborador');
  });

  // -----------------------------------------------------------
  // 5b. New user promoted in Supabase before first login
  // -----------------------------------------------------------
  it('applies admin flags from Supabase when creating a new profile', async () => {
    // Configure Supabase mock to return admin flags
    mockSupabaseQuery.maybeSingle.mockResolvedValueOnce({
      data: { is_admin: true, is_coordenador: false },
      error: null,
    });

    renderWithProvider();

    await act(async () => {
      await authChangeCallback({
        uid: 'promoted-user',
        email: 'promoted@anest.com.br',
        displayName: 'Promoted User',
      });
    });

    // Snapshot returns non-existent document (first login)
    await act(async () => {
      snapshotCallback(makeSnap(null, 'promoted-user'));
    });

    // setDoc should have been called with isAdmin: true from Supabase
    const { setDoc } = await import('firebase/firestore');
    const lastCall = setDoc.mock.calls[setDoc.mock.calls.length - 1];
    const [, profileData] = lastCall;
    expect(profileData.isAdmin).toBe(true);

    // User state should reflect admin status immediately
    const user = JSON.parse(screen.getByTestId('user').textContent);
    expect(user.isAdmin).toBe(true);
  });

  // -----------------------------------------------------------
  // 6. Re-login attaches a new snapshot listener
  // -----------------------------------------------------------
  it('creates a new snapshot listener on re-login (detaches old one)', async () => {
    renderWithProvider();

    // First login
    await act(async () => {
      await authChangeCallback({
        uid: 'u1',
        email: 'test@anest.com.br',
        displayName: 'Dr. Test',
      });
    });

    const firstSnapshotCb = snapshotCallback;

    await act(async () => {
      snapshotCallback(makeSnap({ uid: 'u1', role: 'colaborador', isAdmin: false }));
    });

    // Logout
    await act(async () => {
      await authChangeCallback(null);
    });

    expect(unsubSnapshot).toHaveBeenCalledTimes(1);

    // Second login
    await act(async () => {
      await authChangeCallback({
        uid: 'u1',
        email: 'test@anest.com.br',
        displayName: 'Dr. Test',
      });
    });

    // A new onSnapshot should have been called (total 2)
    const { onSnapshot } = await import('firebase/firestore');
    expect(onSnapshot).toHaveBeenCalledTimes(2);

    // The snapshot callback should be a new reference
    expect(snapshotCallback).not.toBe(firstSnapshotCb);
  });

  // -----------------------------------------------------------
  // 7. Cleanup on unmount unsubscribes both listeners
  // -----------------------------------------------------------
  it('unsubscribes auth and snapshot listeners on unmount', async () => {
    const { unmount } = renderWithProvider();

    // Login and get snapshot going
    await act(async () => {
      await authChangeCallback({
        uid: 'u1',
        email: 'test@anest.com.br',
        displayName: 'Dr. Test',
      });
    });

    await act(async () => {
      snapshotCallback(makeSnap({ uid: 'u1', role: 'colaborador', isAdmin: false }));
    });

    // Unmount the provider
    unmount();

    // Both unsubscribe functions should have been called
    expect(unsubAuth).toHaveBeenCalled();
    expect(unsubSnapshot).toHaveBeenCalled();
  });

  // -----------------------------------------------------------
  // 8. Role update in real-time
  // -----------------------------------------------------------
  it('reflects role changes in real-time', async () => {
    renderWithProvider();

    await act(async () => {
      await authChangeCallback({
        uid: 'u1',
        email: 'userb@anest.com.br',
        displayName: 'User B',
      });
    });

    // Initial: colaborador
    await act(async () => {
      snapshotCallback(makeSnap({
        uid: 'u1',
        role: 'colaborador',
        isAdmin: false,
      }));
    });

    let user = JSON.parse(screen.getByTestId('user').textContent);
    expect(user.role).toBe('colaborador');

    // Admin changes role to administrador
    await act(async () => {
      snapshotCallback(makeSnap({
        uid: 'u1',
        role: 'administrador',
        isAdmin: true,
      }));
    });

    user = JSON.parse(screen.getByTestId('user').textContent);
    expect(user.role).toBe('administrador');
    expect(user.isAdmin).toBe(true);
  });

  // -----------------------------------------------------------
  // 9. Permissions update in real-time
  // -----------------------------------------------------------
  it('reflects permission changes in real-time', async () => {
    renderWithProvider();

    await act(async () => {
      await authChangeCallback({
        uid: 'u1',
        email: 'userb@anest.com.br',
        displayName: 'User B',
      });
    });

    // Initial: limited permissions
    await act(async () => {
      snapshotCallback(makeSnap({
        uid: 'u1',
        role: 'colaborador',
        isAdmin: false,
        permissions: { 'doc-protocolos': true },
      }));
    });

    let user = JSON.parse(screen.getByTestId('user').textContent);
    expect(user.permissions['doc-protocolos']).toBe(true);
    expect(user.permissions['admin-panel']).toBeUndefined();

    // Admin grants admin-panel permission
    await act(async () => {
      snapshotCallback(makeSnap({
        uid: 'u1',
        role: 'colaborador',
        isAdmin: false,
        permissions: { 'doc-protocolos': true, 'admin-panel': true },
      }));
    });

    user = JSON.parse(screen.getByTestId('user').textContent);
    expect(user.permissions['admin-panel']).toBe(true);
  });

  // -----------------------------------------------------------
  // 10. Supabase recordAccess is called on login
  // -----------------------------------------------------------
  it('calls supabaseUsersService.recordAccess on login', async () => {
    renderWithProvider();

    await act(async () => {
      await authChangeCallback({
        uid: 'u1',
        email: 'test@anest.com.br',
        displayName: 'Dr. Test',
      });
    });

    const supabaseUsersService = (await import('../services/supabaseUsersService')).default;
    expect(supabaseUsersService.recordAccess).toHaveBeenCalledWith('u1');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Reconciliação Supabase→Firestore de campo de privilégio
//
// Caso Oscar Morais (2026-08-27): quem se cadastra sozinho ganha perfil
// Supabase com o papel de `authorized_emails` ('anestesiologista'), mas o
// perfil do Firestore nasce no molde sem privilégio ('colaborador') — e é
// esse que `podeVerEscalaCirurgica(user)` lê. A reconciliação corrigia em
// memória e tentava gravar de volta; firestore.rules recusa campo de
// privilégio do próprio dono do perfil, o SDK faz rollback da escrita
// otimista e o rollback reentrega o snapshot velho, realimentando tudo.
// O papel piscava e o card da Escala Cirúrgica aparecia e sumia.
// ═══════════════════════════════════════════════════════════════════
describe('UserContext — papel vindo do Supabase quando o Firestore está atrás', () => {
  const PADRAO_SUPABASE = { data: null, error: null };

  beforeEach(() => {
    vi.clearAllMocks();
    authChangeCallback = null;
    snapshotCallback = null;
    // mockImplementation (não mockResolvedValue): um teste troca a implementação
    // por uma promise pendente e clearAllMocks não desfaz isso.
    mockSupabaseQuery.maybeSingle.mockImplementation(() => Promise.resolve(PADRAO_SUPABASE));
  });

  afterEach(() => {
    // mockImplementation (não mockResolvedValue): um teste troca a implementação
    // por uma promise pendente e clearAllMocks não desfaz isso.
    mockSupabaseQuery.maybeSingle.mockImplementation(() => Promise.resolve(PADRAO_SUPABASE));
  });

  /** Firestore com o papel velho; Supabase com o papel autorizado de verdade. */
  const PERFIL_FIRESTORE_VELHO = {
    uid: 'u1',
    email: 'oscar@anest.com.br',
    role: 'colaborador',
    isAdmin: false,
    isCoordenador: false,
    permissions: { 'doc-protocolos': true },
  };
  const LINHA_SUPABASE = {
    role: 'anestesiologista',
    is_admin: false,
    is_coordenador: false,
    permissions: {},
    custom_permissions: false,
    ranking_opt_in: false,
  };

  async function logarComDrift(perfil = PERFIL_FIRESTORE_VELHO, linha = LINHA_SUPABASE) {
    mockSupabaseQuery.maybeSingle.mockResolvedValue({ data: linha, error: null });
    renderWithProvider();
    await act(async () => {
      await authChangeCallback({ uid: 'u1', email: perfil.email, displayName: 'Oscar' });
    });
    await act(async () => {
      snapshotCallback(makeSnap(perfil));
    });
  }

  it('adota o papel do Supabase mesmo com o Firestore em colaborador', async () => {
    await logarComDrift();

    const user = JSON.parse(screen.getByTestId('user').textContent);
    expect(user.role).toBe('anestesiologista');
  });

  it('não tenta gravar campo de privilégio no Firestore para quem não é admin', async () => {
    await logarComDrift();

    const { updateDoc } = await import('firebase/firestore');
    const camposGravados = updateDoc.mock.calls.flatMap(([, dados]) => Object.keys(dados));
    expect(camposGravados).not.toContain('role');
    expect(camposGravados).not.toContain('permissions');
    expect(camposGravados).not.toContain('customPermissions');
    expect(camposGravados).not.toContain('isAdmin');
  });

  it('grava rankingOptIn, que não é campo de privilégio', async () => {
    await logarComDrift();

    const { updateDoc } = await import('firebase/firestore');
    const camposGravados = updateDoc.mock.calls.flatMap(([, dados]) => Object.keys(dados));
    expect(camposGravados).toContain('rankingOptIn');
  });

  it('mantém o papel reconciliado quando outro snapshot reentrega o doc velho', async () => {
    // A consulta ao Supabase precisa ficar PENDENTE no segundo snapshot. Com um
    // mock que resolve na hora, a reconciliação recoloca o papel dentro do mesmo
    // act() e a piscada some do teste — foi assim que este caso passou contra o
    // código antigo antes de virar trava de verdade.
    const adiada = () => {
      let resolver;
      const promise = new Promise((r) => { resolver = r; });
      return { promise, resolver };
    };

    const primeira = adiada();
    mockSupabaseQuery.maybeSingle.mockImplementation(() => primeira.promise);

    renderWithProvider();
    await act(async () => {
      await authChangeCallback({ uid: 'u1', email: PERFIL_FIRESTORE_VELHO.email, displayName: 'Oscar' });
    });
    await act(async () => {
      snapshotCallback(makeSnap(PERFIL_FIRESTORE_VELHO));
    });

    // Supabase responde: o papel de verdade entra em memória.
    await act(async () => {
      primeira.resolver({ data: LINHA_SUPABASE, error: null });
    });
    expect(JSON.parse(screen.getByTestId('user').textContent).role).toBe('anestesiologista');

    // Agora uma escrita qualquer no doc (token de push, consentimento LGPD)
    // reentrega o snapshot com o papel velho, e a reconciliação seguinte fica
    // pendente. É exatamente a janela em que o gate da escala piscava.
    const segunda = adiada();
    mockSupabaseQuery.maybeSingle.mockImplementation(() => segunda.promise);
    await act(async () => {
      snapshotCallback(makeSnap({ ...PERFIL_FIRESTORE_VELHO, fcmToken: 'abc' }));
    });

    expect(JSON.parse(screen.getByTestId('user').textContent).role).toBe('anestesiologista');
  });

  it('persiste o papel no Firestore quando o perfil JÁ é admin', async () => {
    await logarComDrift(
      { ...PERFIL_FIRESTORE_VELHO, isAdmin: true },
      { ...LINHA_SUPABASE, role: 'secretaria', is_admin: true },
    );

    const { updateDoc } = await import('firebase/firestore');
    const camposGravados = updateDoc.mock.calls.flatMap(([, dados]) => Object.keys(dados));
    expect(camposGravados).toContain('role');
  });

  it('troca de login zera a reconciliação anterior', async () => {
    await logarComDrift();
    expect(JSON.parse(screen.getByTestId('user').textContent).role).toBe('anestesiologista');

    // Outro usuário entra: o papel do anterior não pode vazar para ele.
    mockSupabaseQuery.maybeSingle.mockResolvedValue(PADRAO_SUPABASE);
    await act(async () => {
      await authChangeCallback({ uid: 'u2', email: 'outro@anest.com.br', displayName: 'Outro' });
    });
    await act(async () => {
      snapshotCallback(makeSnap({ uid: 'u2', email: 'outro@anest.com.br', role: 'colaborador', isAdmin: false }, 'u2'));
    });

    expect(JSON.parse(screen.getByTestId('user').textContent).role).toBe('colaborador');
  });
});

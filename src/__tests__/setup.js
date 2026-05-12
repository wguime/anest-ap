import '@testing-library/jest-dom/vitest';
import { expect, vi } from 'vitest';
import { toHaveNoViolations } from 'vitest-axe/matchers';

// ============================================================================
// vitest-axe matcher (W2-5 — A11y testing)
// ============================================================================
expect.extend({ toHaveNoViolations });

// ============================================================================
// Global mock: @/config/supabase
// ----------------------------------------------------------------------------
// Sem isto, qualquer import do client real falha em jsdom com
// "supabaseUrl is required" (env vars não disponíveis em test). Além disso,
// services como supabaseSubscriptionHelper.js usam `supabase.channel(...)`,
// que precisa existir como função no mock. Tests individuais podem fazer
// `vi.mock('@/config/supabase', ...)` para sobrescrever este default.
// ============================================================================
function makeQueryBuilder() {
  const builder = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    is: vi.fn(() => builder),
    or: vi.fn(() => builder),
    match: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    range: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    then: (resolve) => Promise.resolve({ data: [], error: null }).then(resolve),
  };
  return builder;
}

function makeChannel() {
  const channel = {
    on: vi.fn(() => channel),
    subscribe: vi.fn(() => channel),
    unsubscribe: vi.fn(() => Promise.resolve('ok')),
  };
  return channel;
}

const supabaseMock = {
  from: vi.fn(() => makeQueryBuilder()),
  rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
  auth: {
    getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  },
  channel: vi.fn(() => makeChannel()),
  removeChannel: vi.fn(() => Promise.resolve('ok')),
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn(() => Promise.resolve({ data: null, error: null })),
      download: vi.fn(() => Promise.resolve({ data: null, error: null })),
      remove: vi.fn(() => Promise.resolve({ data: null, error: null })),
      createSignedUrl: vi.fn(() => Promise.resolve({ data: { signedUrl: '' }, error: null })),
      getPublicUrl: vi.fn(() => ({ data: { publicUrl: '' } })),
    })),
  },
};

vi.mock('@/config/supabase', () => ({
  supabase: supabaseMock,
  default: supabaseMock,
  getSupabaseToken: vi.fn(() => Promise.resolve('fake-jwt')),
}));

// ============================================================================
// crypto.subtle polyfill (needed for HMAC-SHA256 in certificateGenerator)
// ============================================================================
if (typeof globalThis.crypto === 'undefined') {
  const { webcrypto } = await import('node:crypto');
  globalThis.crypto = webcrypto;
} else if (!globalThis.crypto.subtle) {
  const { webcrypto } = await import('node:crypto');
  globalThis.crypto.subtle = webcrypto.subtle;
}

if (typeof globalThis.crypto.randomUUID !== 'function') {
  const { randomUUID } = await import('node:crypto');
  globalThis.crypto.randomUUID = randomUUID;
}

// ============================================================================
// window.matchMedia mock (needed for components with media queries)
// ============================================================================
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ============================================================================
// IntersectionObserver mock
// ============================================================================
class IntersectionObserverMock {
  constructor(callback) {
    this._callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.IntersectionObserver = IntersectionObserverMock;

// ============================================================================
// URL.createObjectURL / revokeObjectURL mock
// ============================================================================
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = vi.fn(() => 'blob:mock-url');
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = vi.fn();
}

// ============================================================================
// Suppress noisy console.error/warn in tests (optional)
// ============================================================================
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = (...args) => {
    // Allow @testing-library errors to pass through
    if (typeof args[0] === 'string' && args[0].includes('act(')) return;
    if (typeof args[0] === 'string' && args[0].includes('Warning:')) return;
    originalError.call(console, ...args);
  };
  console.warn = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('act(')) return;
    originalWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

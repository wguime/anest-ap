import '@testing-library/jest-dom/vitest';

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

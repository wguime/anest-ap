/**
 * errorReporting.test.js — Wave 4.4
 *
 * Smoke tests para o service de telemetria de exceções:
 * - sempre loga em console.error
 * - em DEV não envia ao Firebase Analytics
 * - em PROD tenta o lazy import de firebase/analytics (com mock)
 * - propaga shape do context (componentStack, route, fatal)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mocks para os imports dinâmicos usados em PROD path.
const logEventMock = vi.fn();
const getAnalyticsMock = vi.fn(() => ({ __mock: 'analytics' }));
const isSupportedMock = vi.fn(() => Promise.resolve(true));

vi.mock('firebase/analytics', () => ({
  getAnalytics: getAnalyticsMock,
  logEvent: logEventMock,
  isSupported: isSupportedMock,
}));

vi.mock('@/config/firebase', () => ({
  default: { __mock: 'app' },
}));

// Helper: aguarda microtasks pendentes (lazy import + isSupported chain).
// Promise.all([import, import]) → then(([a,b])) → ensureSupported.then(...) → logEvent
// usa vários ticks; combinamos setTimeout(0) + microtask drains.
async function flushPromises() {
  for (let i = 0; i < 20; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 0));
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
}

describe('errorReporting', () => {
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logEventMock.mockClear();
    getAnalyticsMock.mockClear();
    isSupportedMock.mockClear();
    // Reset import.meta.env entre testes (Vite expõe getters mutáveis).
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    vi.resetModules();
  });

  it('always logs to console.error with [errorReporting] tag', async () => {
    vi.stubEnv('PROD', false);
    const { reportError } = await import('@/services/errorReporting');
    const err = new Error('boom');
    reportError(err, { route: 'home' });
    expect(consoleErrorSpy).toHaveBeenCalled();
    const matched = consoleErrorSpy.mock.calls.some(
      (args) => args[0] === '[errorReporting]',
    );
    expect(matched).toBe(true);
  });

  it('in DEV (PROD=false) does NOT call Firebase Analytics', async () => {
    vi.stubEnv('PROD', false);
    const { reportError } = await import('@/services/errorReporting');
    reportError(new Error('dev-error'), { route: 'home' });
    await flushPromises();
    expect(logEventMock).not.toHaveBeenCalled();
    expect(getAnalyticsMock).not.toHaveBeenCalled();
  });

  it('in PROD (PROD=true) triggers lazy import path and logs app_exception', async () => {
    vi.stubEnv('PROD', true);
    const { reportError } = await import('@/services/errorReporting');
    const err = new Error('prod-error');
    reportError(err, {
      componentStack: '    at Foo\n    at Bar',
      route: 'incidentes',
      fatal: false,
    });
    // Aguarda o pipeline assíncrono do lazy import.
    await flushPromises();
    expect(logEventMock).toHaveBeenCalledTimes(1);
    const [analyticsArg, eventName, payload] = logEventMock.mock.calls[0];
    expect(analyticsArg).toBeTruthy();
    expect(eventName).toBe('app_exception');
    expect(payload).toMatchObject({
      description: 'prod-error',
      route: 'incidentes',
      fatal: false,
    });
    expect(payload.component_stack).toContain('Foo');
  });

  it('truncates description to 200 chars and component_stack to 500 chars', async () => {
    vi.stubEnv('PROD', true);
    const { reportError } = await import('@/services/errorReporting');
    const longMsg = 'x'.repeat(500);
    const longStack = 'y'.repeat(800);
    reportError(new Error(longMsg), {
      componentStack: longStack,
      route: 'foo',
    });
    await flushPromises();
    expect(logEventMock).toHaveBeenCalledTimes(1);
    const [, , payload] = logEventMock.mock.calls[0];
    expect(payload.description.length).toBe(200);
    expect(payload.component_stack.length).toBe(500);
  });

  it('handles missing context — defaults route=unknown, fatal=false', async () => {
    vi.stubEnv('PROD', true);
    const { reportError } = await import('@/services/errorReporting');
    reportError(new Error('no-ctx'));
    await flushPromises();
    expect(logEventMock).toHaveBeenCalledTimes(1);
    const [, , payload] = logEventMock.mock.calls[0];
    expect(payload.route).toBe('unknown');
    expect(payload.fatal).toBe(false);
    expect(payload.component_stack).toBe('');
  });

  it('handles error without message — description=unknown', async () => {
    vi.stubEnv('PROD', true);
    const { reportError } = await import('@/services/errorReporting');
    reportError(null);
    await flushPromises();
    // Quando error é null, ainda assim deve tentar logar com description=unknown.
    expect(logEventMock).toHaveBeenCalledTimes(1);
    const [, , payload] = logEventMock.mock.calls[0];
    expect(payload.description).toBe('unknown');
  });

  it('does not throw when analytics is unsupported', async () => {
    vi.stubEnv('PROD', true);
    isSupportedMock.mockImplementationOnce(() => Promise.resolve(false));
    const { reportError } = await import('@/services/errorReporting');
    reportError(new Error('unsupported'), { route: 'foo' });
    await flushPromises();
    expect(logEventMock).not.toHaveBeenCalled();
  });
});

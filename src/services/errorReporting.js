/**
 * errorReporting — Sprint 19 (observability real via Sentry)
 *
 * Wrapper de telemetria de exceções:
 * - DEV: console.error apenas (zero tráfego de rede)
 * - PROD com VITE_SENTRY_DSN: Sentry.captureException + tags/extras
 * - PROD sem DSN: fallback Firebase Analytics (compat v4.0.0)
 *
 * Sentry é inicializado em main.jsx quando VITE_SENTRY_DSN está presente.
 * Sem DSN, o cliente Sentry não é carregado (tree-shake completo).
 *
 * Free tier Sentry: 5k events/mês — suficiente para erro crítico real.
 * Setup: sentry.io → New project → React → copia DSN → setar
 * VITE_SENTRY_DSN em .env.local (dev) + GitHub Secret SENTRY_DSN (CI).
 */

/**
 * Reporta um erro capturado.
 *
 * @param {Error} error - O erro lançado.
 * @param {object} [context] - Contexto adicional.
 * @param {string} [context.componentStack] - Stack do React (errorInfo).
 * @param {string} [context.route] - Rota/página atual.
 * @param {string} [context.userId] - User ID quando disponível (opt-in / não-PII).
 * @param {boolean} [context.fatal] - Erro fatal (crash) vs erro tratado.
 */
export function reportError(error, context = {}) {
  // Console always — útil em DEV e como fallback se backend falhar.
  // eslint-disable-next-line no-console
  console.error('[errorReporting]', error?.message, context);

  if (
    typeof window === 'undefined' ||
    typeof import.meta === 'undefined' ||
    !import.meta.env ||
    !import.meta.env.PROD
  ) {
    return;
  }

  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
  if (sentryDsn) {
    import('@sentry/react')
      .then((Sentry) => {
        Sentry.captureException(error, {
          tags: {
            route: context.route || 'unknown',
            fatal: Boolean(context.fatal),
          },
          extra: {
            componentStack: (context.componentStack || '').slice(0, 1000),
            userId: context.userId || undefined,
          },
        });
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.warn('[errorReporting] Sentry import failed:', e);
      });
    return;
  }

  // Fallback: Firebase Analytics (compat v4.0.0). Mantido enquanto user
  // não configura Sentry DSN.
  try {
    Promise.all([
      import('@/config/firebase'),
      import('firebase/analytics'),
    ])
      .then(([firebaseMod, analyticsMod]) => {
        const app = firebaseMod?.default;
        if (!app) return;
        const { getAnalytics, logEvent, isSupported } = analyticsMod;
        const ensureSupported = typeof isSupported === 'function'
          ? isSupported()
          : Promise.resolve(true);
        ensureSupported
          .then((supported) => {
            if (!supported) return;
            const analytics = getAnalytics(app);
            if (!analytics) return;
            logEvent(analytics, 'app_exception', {
              description: (error?.message || 'unknown').slice(0, 200),
              component_stack: (context.componentStack || '').slice(0, 500),
              route: context.route || 'unknown',
              fatal: Boolean(context.fatal),
            });
          })
          .catch((e) => {
            // eslint-disable-next-line no-console
            console.warn('[errorReporting] Analytics not supported:', e);
          });
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.warn('[errorReporting] Failed to lazy-load analytics:', e);
      });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[errorReporting] Failed to report:', e);
  }
}

export default reportError;

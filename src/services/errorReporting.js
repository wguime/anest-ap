/**
 * errorReporting — Wave 4.4 (observability)
 *
 * Stub de telemetria de exceções para a aplicação. É invocado pelo
 * `ErrorBoundary` (via prop `onError`) e pode ser chamado manualmente
 * em catches críticos de services/contexts.
 *
 * Backend default: Firebase Analytics (`app_exception` custom event).
 * Em DEV apenas console.error — nenhum tráfego é enviado.
 *
 * Para trocar por Sentry/LogRocket/etc, basta reimplementar
 * `reportError` mantendo a assinatura.
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
  // Console always — útil em DEV e como fallback se Analytics falhar.
   
  console.error('[errorReporting]', error?.message, context);

  // Produção: log para Firebase Analytics como custom event.
  // Lazy import para evitar bundling de firebase/analytics no critical chunk
  // e permitir tree-shake em DEV.
  if (
    typeof window !== 'undefined' &&
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    import.meta.env.PROD
  ) {
    try {
      // Import dinâmico do app Firebase + analytics SDK.
      Promise.all([
        import('@/config/firebase'),
        import('firebase/analytics'),
      ])
        .then(([firebaseMod, analyticsMod]) => {
          const app = firebaseMod?.default;
          if (!app) return;
          const { getAnalytics, logEvent, isSupported } = analyticsMod;
          // Analytics não é suportado em todos os ambientes (SSR, browsers
          // antigos, modo privado). isSupported é assíncrono.
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
               
              console.warn('[errorReporting] Analytics not supported:', e);
            });
        })
        .catch((e) => {
           
          console.warn('[errorReporting] Failed to lazy-load analytics:', e);
        });
    } catch (e) {
       
      console.warn('[errorReporting] Failed to report:', e);
    }
  }
}

export default reportError;

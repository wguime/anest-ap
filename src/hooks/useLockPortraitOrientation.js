import { useEffect } from 'react';

/**
 * Tenta travar a orientação da tela em portrait via Screen Orientation API.
 *
 * Funciona em:
 * - Chrome/Edge Android quando instalado como PWA standalone (manifest define
 *   `orientation: portrait` e o lock é honrado)
 *
 * Não funciona em:
 * - iOS Safari (a API existe mas o lock é silenciosamente recusado em browser tab)
 * - Browser tabs em geral (lock só é permitido em fullscreen ou PWA standalone)
 *
 * Para esses casos, o fallback visual é o componente RotateDeviceOverlay,
 * que esconde o conteúdo via CSS quando o dispositivo entra em landscape.
 */
export function useLockPortraitOrientation() {
  useEffect(() => {
    const orientation = typeof screen !== 'undefined' ? screen.orientation : null;
    if (!orientation || typeof orientation.lock !== 'function') return;

    orientation.lock('portrait').catch(() => {
      // Esperado em iOS Safari e em qualquer browser fora de PWA standalone.
      // O fallback visual cobre esses casos.
    });
  }, []);
}

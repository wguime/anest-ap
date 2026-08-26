import { rotacaoCompensada } from '@/lib/orientacaoTela';

/**
 * Sobe a página ao topo — inclusive com o celular deitado.
 *
 * Com a tela contra-rotacionada (`src/lib/orientacaoTela.js`) o `<body>` é quem
 * rola, e `window.scrollTo` não alcança mais o conteúdo: sem isto, cada
 * navegação abriria a página nova no meio.
 */
export function rolarAoTopo(suave = false) {
  const opts = { top: 0, left: 0, behavior: suave ? 'smooth' : 'instant' };

  if (rotacaoCompensada() && typeof document !== 'undefined' && document.body) {
    if (typeof document.body.scrollTo === 'function') document.body.scrollTo(opts);
    else document.body.scrollTop = 0;
    return;
  }

  if (typeof window !== 'undefined') window.scrollTo(opts);
}

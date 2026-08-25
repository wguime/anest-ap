/**
 * Política de orientação da tela (dono 25/08).
 *
 * O app é RETRATO. A exceção é o conteúdo que nasce deitado — documento (PDF)
 * e vídeo —, onde girar é o que torna a leitura possível. Quem precisa da
 * exceção PEDE (`permitirLandscape()`) e DEVOLVE ao desmontar/fechar; enquanto
 * houver ao menos um pedido ativo o app gira, e ao devolver o último ele volta
 * a travar em retrato. Contador, não booleano: um PDF dentro de um modal sobre
 * uma página com vídeo devolveria a trava cedo demais.
 *
 * Duas camadas, porque nenhuma sozinha cobre os aparelhos da equipe:
 *  - **Screen Orientation API** — trava de verdade no Chrome/Edge Android com o
 *    app instalado (PWA standalone). Em aba de browser e no iOS o lock é
 *    recusado em silêncio.
 *  - **classe `landscape-liberado` no `<html>`** — liga/desliga o overlay
 *    "Gire seu dispositivo" do `index.css`, que é o que segura o iPhone, onde a
 *    API não funciona na prática. Por isso a classe é aplicada SEMPRE, mesmo
 *    quando o lock nativo foi aceito.
 *
 * ⚠️ liberar é `lock('any')`, NUNCA `unlock()`: `unlock()` devolve à orientação
 * PADRÃO, que o `manifest.json` fixa em `portrait` — em PWA Android ele não
 * libera nada. O `unlock()` fica só como fallback de quem não conhece 'any'.
 */

const CLASSE_LIBERADO = 'landscape-liberado';

let concessoes = 0;

function apiOrientacao() {
  if (typeof screen === 'undefined') return null;
  const o = screen.orientation;
  return o && typeof o.lock === 'function' ? o : null;
}

function aplicar() {
  const liberado = concessoes > 0;

  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.classList.toggle(CLASSE_LIBERADO, liberado);
  }

  const o = apiOrientacao();
  if (!o) return;
  try {
    Promise.resolve(o.lock(liberado ? 'any' : 'portrait')).catch(() => {
      if (liberado && typeof o.unlock === 'function') {
        try { o.unlock(); } catch { /* iOS/aba de browser: sem lock, vale o overlay */ }
      }
    });
  } catch {
    /* Safari antigo lança síncrono em vez de rejeitar. */
  }
}

/**
 * (Re)aplica a política ao estado atual: retrato se não há concessão, 'any' se
 * há. É o que o App chama no boot e o que quem sai da tela cheia deve chamar —
 * forçar `lock('portrait')` na mão ali viraria o aparelho de quem ainda está
 * deitado com o vídeo aberto.
 */
export function aplicarPoliticaOrientacao() {
  aplicar();
}

/**
 * Libera a rotação enquanto o pedido estiver de pé.
 * @returns {() => void} devolver — idempotente, seguro de chamar 2×.
 */
export function permitirLandscape() {
  concessoes += 1;
  if (concessoes === 1) aplicar();

  let devolvido = false;
  return function devolver() {
    if (devolvido) return;
    devolvido = true;
    concessoes = Math.max(0, concessoes - 1);
    if (concessoes === 0) aplicar();
  };
}

export function landscapePermitido() {
  return concessoes > 0;
}

/** Só para teste — zera o contador e reaplica a trava. */
export function _resetOrientacao() {
  concessoes = 0;
  aplicar();
}

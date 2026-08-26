/**
 * Trava de orientação (dono 25/08, reforçada no mesmo dia: "não deve rodar a
 * tela nunca!!").
 *
 * O app é RETRATO. A exceção é o conteúdo que nasce deitado — documento (PDF) e
 * vídeo —, onde girar é o que torna a leitura possível: quem precisa PEDE
 * (`permitirLandscape()`) e DEVOLVE ao desmontar. Contador, não booleano: um PDF
 * dentro de um modal sobre uma página com vídeo devolveria a trava cedo demais.
 *
 * ⚠️ **Não existe API que trave a rotação no iPhone.** `screen.orientation.lock`
 * só é honrado no Android com o app instalado, e o `orientation: portrait` do
 * manifest o iOS ignora. Por isso a trava tem duas camadas:
 *
 *  1. **lock nativo** — resolve sozinho no Android/PWA. ⚠️ liberar é
 *     `lock('any')`, NUNCA `unlock()`: `unlock()` devolve à orientação PADRÃO,
 *     que o manifest fixa em `portrait`.
 *  2. **compensação por CSS** — o que segura o iPhone: com o aparelho deitado,
 *     o `<body>` é girado de volta, e o app continua **em pé em relação ao
 *     aparelho**, exatamente como um app que não suporta paisagem. Substituiu o
 *     aviso "Gire seu dispositivo" (o dono não quer mensagem nenhuma).
 *
 * ⚠️ **QUEM DECIDE COMPENSAR É O CSS, não este módulo** (dono 26/08: "fica na
 * horizontal e retorna para vertical"). O `orientationchange` do iOS chega ANTES
 * de a viewport virar — lendo dali, ainda se vê "retrato" e não se compensa — e
 * a correção só vinha no `resize` seguinte, que em PWA standalone atrasa: dava
 * para VER o app deitar e voltar. A media query em `index.css` é reavaliada no
 * mesmo frame da mudança, sem depender de evento. Aqui fica só o **sentido**
 * (`.rot-cw` quando o topo do aparelho está à direita), e o padrão do CSS vale
 * enquanto este módulo não fala — no pior caso o app aparece em pé de cabeça
 * para baixo por um instante, nunca deitado.
 *
 * Por que o `<body>` e não o `#root`: TODO portal do DS (modal, sheet, select,
 * dropdown, toast, PDF em tela cheia) monta em `document.body` — girar o
 * `#root` deixaria essas camadas deitadas por cima do app em pé.
 *
 * ⚠️ Efeito colateral inevitável do transform: o `<body>` vira o containing
 * block dos `position: fixed` (é o que mantém header e BottomNav corretos na
 * tela virtual) **e passa a ser o elemento que rola** — daí `rolarAoTopo()` em
 * `src/utils/rolarAoTopo.js`, que `window.scrollTo` não alcança mais. Só vale
 * no celular deitado; em retrato nada disto liga.
 */

const CLASSE_LIBERADO = 'landscape-liberado'; // exceção ativa: a tela pode girar
const CLASSE_CW = 'rot-cw';                   // topo do aparelho à direita (angle 270)

// ⚠️ ESPELHA a media query de `index.css` — mudar uma exige mudar a outra.
// Só CELULAR (dono 26/08: "em ipads, tablets a tela pode girar"): `max-height`
// separa celular deitado de tablet, e `pointer: coarse` tira o desktop.
const CELULAR_DEITADO =
  'screen and (orientation: landscape) and (max-height: 500px) and (pointer: coarse)';

let concessoes = 0;
let instalado = false;

function apiOrientacao() {
  if (typeof screen === 'undefined') return null;
  const o = screen.orientation;
  return o && typeof o.lock === 'function' ? o : null;
}

/**
 * Quanto o SISTEMA girou o conteúdo em relação à orientação natural. Compensar
 * é aplicar `-angle`: o conteúdo volta a se alinhar ao corpo do aparelho.
 */
function anguloDaTela() {
  if (typeof screen !== 'undefined' && screen.orientation && typeof screen.orientation.angle === 'number') {
    return ((screen.orientation.angle % 360) + 360) % 360;
  }
  // iOS antigo: `window.orientation` (-90 | 0 | 90 | 180)
  if (typeof window !== 'undefined' && typeof window.orientation === 'number') {
    return ((window.orientation % 360) + 360) % 360;
  }
  return 0;
}

function celularDeitado() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(CELULAR_DEITADO).matches;
}

function aplicar() {
  const liberado = concessoes > 0;

  // --- camada 2: compensação por CSS (a que vale no iPhone) ---
  // Só duas coisas saem daqui: a EXCEÇÃO (documento/vídeo desligam tudo) e o
  // SENTIDO. O "quando" é da media query — ver o ⚠️ do cabeçalho.
  if (typeof document !== 'undefined' && document.documentElement) {
    const html = document.documentElement;
    html.classList.toggle(CLASSE_LIBERADO, liberado);
    html.classList.toggle(CLASSE_CW, anguloDaTela() === 270);
  }

  // --- camada 1: lock nativo (Android/PWA) ---
  const o = apiOrientacao();
  if (!o) return;
  try {
    Promise.resolve(o.lock(liberado ? 'any' : 'portrait')).catch(() => {
      if (liberado && typeof o.unlock === 'function') {
        try { o.unlock(); } catch { /* iOS/aba de browser: vale a compensação */ }
      }
    });
  } catch {
    /* Safari antigo lança síncrono em vez de rejeitar. */
  }
}

/**
 * (Re)aplica a política ao estado atual: compensa se o aparelho está deitado e
 * ninguém pediu exceção. É o que o app chama no boot e o que quem sai da tela
 * cheia deve chamar — forçar `lock('portrait')` na mão ali viraria o aparelho
 * de quem ainda está deitado com o vídeo aberto.
 */
export function aplicarPoliticaOrientacao() {
  aplicar();
}

/**
 * Liga os listeners que mantêm a compensação em dia. Idempotente.
 * @returns {() => void} desinstalar
 */
export function instalarTravaOrientacao() {
  aplicar();
  if (instalado || typeof window === 'undefined') return () => {};
  instalado = true;

  // Os três, de propósito: aqui só se atualiza o SENTIDO, e quanto mais cedo
  // melhor. `screen.orientation` é o que chega primeiro (iOS 16.4+) e já traz o
  // ângulo novo; `orientationchange` cobre o iOS antigo; `resize` é a rede.
  const o = typeof screen !== 'undefined' ? screen.orientation : null;
  if (o && typeof o.addEventListener === 'function') o.addEventListener('change', aplicar);
  window.addEventListener('orientationchange', aplicar);
  window.addEventListener('resize', aplicar);

  return () => {
    if (o && typeof o.removeEventListener === 'function') o.removeEventListener('change', aplicar);
    window.removeEventListener('orientationchange', aplicar);
    window.removeEventListener('resize', aplicar);
    instalado = false;
  };
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

/**
 * O app está com a tela contra-rotacionada agora? (quem rola é o `<body>`)
 * Calculado, não lido de classe: o CSS pode já estar compensando num frame em
 * que este módulo ainda não passou, e quem pergunta precisa da verdade de agora.
 */
export function rotacaoCompensada() {
  return concessoes === 0 && celularDeitado();
}

/** Só para teste — zera o contador e reaplica a política. */
export function _resetOrientacao() {
  concessoes = 0;
  aplicar();
}

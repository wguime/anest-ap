/**
 * useVisualViewportAnchor — mantém um elemento `position: fixed` na borda do
 * que o usuário VÊ (visual viewport), e não na borda do layout viewport.
 *
 * No iOS `position: fixed` ancora no LAYOUT viewport. Quando o visual viewport
 * fica deslocado em relação a ele — teclado dos sheets que fechou e deixou um
 * offset residual, o caso da BottomNav "no meio da tela" (dono 24/07, 29/07,
 * 30/07 e 16/09) — a borda do layout viewport deixa de ser a borda da tela e a
 * barra aparece onde não devia. `useIosViewportReanchor` (src/hooks) tenta
 * zerar esse offset rolando o documento; este hook é a GARANTIA para o
 * elemento em si: mede onde ele está (`getBoundingClientRect`, em coordenadas
 * do layout viewport), calcula onde a borda visível está (`offsetTop` +
 * `height` do visualViewport, mesmas coordenadas) e compensa a diferença com
 * `transform`. É uma malha fechada — a próxima medição já inclui o transform
 * aplicado —, então converge em um passo e não depende de saber a altura do
 * layout viewport (que o Safari muda com a barra de ferramentas).
 *
 * Estado saudável (offset zero) = transform vazio. Fora do iOS não faz nada.
 *
 * Não interfere onde o deslocamento é LEGÍTIMO:
 *  - teclado aberto: a barra fica sob o teclado, como o iOS faz nativamente
 *    (detectado pela altura — o layout viewport não encolhe com o teclado no
 *    iOS, o visual sim —, e não pelo input focado, porque a tecla de recolher
 *    o teclado esconde o teclado SEM tirar o foco do input);
 *  - pinch-zoom (scale ≠ 1): comportamento padrão do Safari.
 */
import { useEffect } from "react"

// `-webkit-touch-callout` só existe no iOS — mesma detecção do CSS da barra
// (`.bottom-nav-glass` em anest-theme.css) e do `useIosViewportReanchor`.
export const ehIos = () =>
  typeof CSS !== "undefined" &&
  typeof CSS.supports === "function" &&
  CSS.supports("-webkit-touch-callout: none")

// Abaixo disso é ruído de medição (barra de ferramentas do Safari, arredondamento).
const LIMIAR_TECLADO_PX = 100
// 1px de diferença entre rect e visualViewport é arredondamento, não deslocamento.
const LIMIAR_DESLOCAMENTO_PX = 2

export function useVisualViewportAnchor(ref, { edge = "bottom" } = {}) {
  useEffect(() => {
    const vv = window.visualViewport
    // O ref já está ligado quando o efeito roda (mesmo nó pela vida da barra).
    const el = ref.current
    if (!vv || !el || !ehIos()) return

    let raf = 0
    let timer = 0
    let translate = 0

    const aplicar = (y) => {
      translate = y
      el.style.transform = y ? `translate3d(0, ${y}px, 0)` : ""
    }

    const tecladoAberto = () => {
      const layout = Math.max(
        document.documentElement.clientHeight || 0,
        window.innerHeight || 0
      )
      return layout - vv.height > LIMIAR_TECLADO_PX
    }

    const alinhar = () => {
      raf = 0
      if (Math.abs(vv.scale - 1) > 0.01 || tecladoAberto()) {
        if (translate !== 0) aplicar(0)
        return
      }
      const rect = el.getBoundingClientRect()
      const atual = edge === "top" ? rect.top : rect.bottom
      const alvo = edge === "top" ? vv.offsetTop : vv.offsetTop + vv.height
      const desejado = Math.round(translate + (alvo - atual))
      const final = Math.abs(desejado) < LIMIAR_DESLOCAMENTO_PX ? 0 : desejado
      if (final !== translate) aplicar(final)
    }

    const agendar = () => {
      if (!raf) raf = requestAnimationFrame(alinhar)
    }
    // Depois de soltar o dedo ou tirar o foco: espera a animação do teclado/
    // sheet terminar antes de medir (o `resize` do visualViewport costuma
    // chegar antes; isto é a rede de segurança caso não chegue).
    const agendarTarde = () => {
      clearTimeout(timer)
      timer = setTimeout(agendar, 350)
    }

    vv.addEventListener("resize", agendar)
    vv.addEventListener("scroll", agendar)
    window.addEventListener("resize", agendar)
    window.addEventListener("orientationchange", agendarTarde)
    window.addEventListener("pageshow", agendarTarde)
    window.addEventListener("touchend", agendarTarde, { passive: true })
    window.addEventListener("touchcancel", agendarTarde, { passive: true })
    document.addEventListener("focusout", agendarTarde, true)
    document.addEventListener("visibilitychange", agendarTarde)
    agendar()

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
      vv.removeEventListener("resize", agendar)
      vv.removeEventListener("scroll", agendar)
      window.removeEventListener("resize", agendar)
      window.removeEventListener("orientationchange", agendarTarde)
      window.removeEventListener("pageshow", agendarTarde)
      window.removeEventListener("touchend", agendarTarde)
      window.removeEventListener("touchcancel", agendarTarde)
      document.removeEventListener("focusout", agendarTarde, true)
      document.removeEventListener("visibilitychange", agendarTarde)
      el.style.transform = ""
    }
  }, [ref, edge])
}

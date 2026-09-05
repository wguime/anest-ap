/**
 * "Voltar" do browser (e o gesto de voltar do iOS) com um overlay aberto (Onda 2; audit A7-iii).
 *
 * A conferência da escala é `fixed inset-0` DENTRO da página, não uma rota: o "voltar" do
 * browser saía da página inteira, levando a conferência junto, sem pergunta. Este hook
 * empilha UMA entrada de histórico com uma marca ao abrir o overlay; o "voltar" cai nela e
 * vira `aoVoltar()` — que na conferência é o mesmo Cancelar (com confirmação quando há
 * trabalho). Ao fechar por outro caminho, a entrada marcada é desempilhada.
 *
 * Convive com o react-router (declarative `BrowserRouter`): a entrada copia o estado da
 * entrada do router (`usr`, `key`, `idx`) e só acrescenta a marca, então o `popstate`
 * que volta para a entrada do router é a MESMA página com os mesmos params — o efeito de
 * location do App não faz nada. `popstate` que cai NUMA entrada marcada é ignorado (é o
 * StrictMode do dev montando duas vezes, ou o desempilhar do fechamento).
 */
import { useEffect, useRef } from 'react'

export const MARCA_OVERLAY = 'anestOverlay'

// O `history.back()` do desempilhar é assíncrono: o `popstate` dele chega DEPOIS, e pode
// chegar num overlay que acabou de abrir de novo (StrictMode do dev monta duas vezes).
// Esse popstate não é o usuário voltando: um ouvinte de uma vez só, registrado ANTES do
// ouvinte do overlay seguinte, o consome (`stopImmediatePropagation` — o router, que
// ouve desde o boot, ainda o recebe e não faz nada: é a mesma página). Se o popstate nunca
// vier (histórico vazio), o ouvinte sai sozinho depois de 1 s.
let ouvinteDesempilhar = null
let ouvinteTimer = null
function marcarDesempilhando() {
  if (ouvinteDesempilhar) window.removeEventListener('popstate', ouvinteDesempilhar)
  if (ouvinteTimer) clearTimeout(ouvinteTimer)
  const ouvinte = (e) => {
    e.stopImmediatePropagation()
    window.removeEventListener('popstate', ouvinte)
    ouvinteDesempilhar = null
  }
  ouvinteDesempilhar = ouvinte
  window.addEventListener('popstate', ouvinte)
  ouvinteTimer = setTimeout(() => {
    if (ouvinteDesempilhar === ouvinte) { window.removeEventListener('popstate', ouvinte); ouvinteDesempilhar = null }
  }, 1000)
}

export function useVoltarDoBrowser(aoVoltar, { ativo = true, marca = MARCA_OVERLAY } = {}) {
  const cb = useRef(aoVoltar)
  useEffect(() => { cb.current = aoVoltar }, [aoVoltar])
  useEffect(() => {
    if (!ativo || typeof window === 'undefined' || !window.history?.pushState) return undefined
    const h = window.history
    const empilhar = () => {
      try { h.pushState({ ...(h.state && typeof h.state === 'object' ? h.state : {}), [marca]: true }, '') } catch { /* sandbox */ }
    }
    if (!h.state?.[marca]) empilhar()
    const aoPop = (e) => {
      // caiu numa entrada marcada: não é o usuário voltando
      if (e.state?.[marca]) return
      // o usuário voltou: repõe a entrada (um segundo "voltar" precisa funcionar se a
      // saída for cancelada) e entrega a decisão a quem sabe se há trabalho pendente
      empilhar()
      cb.current?.()
    }
    window.addEventListener('popstate', aoPop)
    return () => {
      window.removeEventListener('popstate', aoPop)
      // fechou por outro caminho: desempilha a marca (assíncrono; o listener já saiu)
      if (h.state?.[marca]) { try { marcarDesempilhando(); h.back() } catch { /* nada */ } }
    }
  }, [ativo, marca])
}

export default useVoltarDoBrowser

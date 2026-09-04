/**
 * Registro de TRABALHO EM ANDAMENTO que segura a atualização do PWA (Onda 2; audit A7-ii).
 *
 * `pwaUpdate` recarrega a página sozinho quando há deploy — ao voltar do 2º plano e a cada
 * 15 min com a página visível — e houve 3 a 5 deploys por dia na janela em que a escala
 * da tarde é conferida. A conferência em lote agora tem rascunho durável, mas um reload no
 * meio da digitação continua sendo o pior momento possível: o campo aberto some, a foto
 * em leitura na Vision é perdida, e a percepção é "não persistiu".
 *
 * Quem tem trabalho aberto SEGURA (`segurarAtualizacao(motivo)`); ao terminar, LIBERA. O
 * `pwaUpdate` consulta `atualizacaoSegura()` antes de recarregar e, quando o último motivo
 * libera, tenta de novo na hora (`aoLiberar`). Módulo puro, sem React — testável e sem
 * depender de `virtual:pwa-register`.
 *
 * ⚠️ Segurar não mostra nada na tela (decisão do dono 13/08: atualizar é bastidor). O
 * aparelho fica no bundle anterior enquanto a conferência estiver aberta — no máximo a
 * duração dela; o one-shot de chunk em `errorReporting.js` continua cobrindo o resto.
 */

const motivos = new Set()
const ouvintes = new Set()

/** Segura a atualização em nome de `motivo` (string estável, ex.: 'escala-lote'). */
export function segurarAtualizacao(motivo) {
  if (!motivo) return
  motivos.add(String(motivo))
}

/** Libera o `motivo`; quando era o último, avisa quem espera para tentar atualizar. */
export function liberarAtualizacao(motivo) {
  if (!motivo || !motivos.has(String(motivo))) return
  motivos.delete(String(motivo))
  if (motivos.size === 0) {
    for (const cb of [...ouvintes]) {
      try { cb() } catch { /* ouvinte não pode derrubar o resto */ }
    }
  }
}

/** Há trabalho em andamento segurando a atualização? */
export function atualizacaoSegura() {
  return motivos.size > 0
}

/** Motivos ativos (diagnóstico). */
export function motivosAtivos() {
  return [...motivos]
}

/** Registra quem quer tentar atualizar assim que o último motivo liberar. Devolve o cancelamento. */
export function aoLiberar(cb) {
  if (typeof cb !== 'function') return () => {}
  ouvintes.add(cb)
  return () => { ouvintes.delete(cb) }
}

/** Só para testes: volta ao estado inicial. */
export function _reiniciarAtualizacaoAdiada() {
  motivos.clear()
  ouvintes.clear()
}

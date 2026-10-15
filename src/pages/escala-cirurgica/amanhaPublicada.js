/**
 * "A escala de amanhã já foi publicada?" — guardado por data (abertura da
 * escala, 15/10/2026).
 *
 * O atalho "Amanhã" só aparece com a escala de amanhã publicada (dono 24/07:
 * nunca leva a uma tela vazia). A tela só descobria isso DEPOIS de abrir: três
 * hospitais × (cabeçalho + casos + histórico) = 9 leituras, e quando estava
 * publicada o prefetch buscava tudo de novo (mais 9). A linha de cima da barra
 * chegava ~0,5–1 s depois e empurrava a escala inteira para baixo.
 *
 * Agora é uma leitura só (status por hospital, `fetchStatusDia`), e a resposta
 * fica guardada por data: a próxima abertura já nasce com o atalho certo, sem o
 * pulo. Vai para o disco só um booleano por data — nada de escala, caso ou
 * paciente.
 */

const CHAVE = 'anest-escala-amanha-publicada-v1'
const MAX_DATAS = 4

/** Sessão atual: sobrevive a sair e voltar da tela sem tocar no disco. */
const memoria = new Map()

function lerDisco() {
  try {
    const o = JSON.parse(globalThis.localStorage?.getItem(CHAVE) || '{}')
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {}
  } catch {
    return {}
  }
}

/** O que se sabe da data, antes de qualquer rede (`false` quando não se sabe). */
export function amanhaPublicadaGuardada(dia) {
  if (!dia) return false
  if (memoria.has(dia)) return memoria.get(dia)
  return lerDisco()[dia] === true
}

export function guardarAmanhaPublicada(dia, publicada) {
  if (!dia) return
  memoria.set(dia, !!publicada)
  try {
    const o = { ...lerDisco(), [dia]: !!publicada }
    const datas = Object.keys(o).sort().slice(-MAX_DATAS)
    globalThis.localStorage?.setItem(CHAVE, JSON.stringify(Object.fromEntries(datas.map((d) => [d, o[d]]))))
  } catch { /* storage bloqueado: fica só na memória da sessão */ }
}

/** Alguma das linhas do dia, entre os hospitais-alvo, está publicada. */
export function algumaPublicada(linhas, alvos) {
  const hospitais = new Set(alvos)
  return (linhas || []).some((e) => !!e && hospitais.has(e.hospital) && e.status === 'publicada')
}

/** Só para testes: esquece o que a sessão guardou em memória. */
export function _esquecerAmanhaPublicada() {
  memoria.clear()
}

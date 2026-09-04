/**
 * Posições do FIM DE SEMANA no Pega Plantão — a segunda fonte da fila do sábado/domingo.
 *
 * Dono (04/09): "a escala é vista no pega plantão (de P1 a P4 a ordem pode variar entre
 * esses 4 — verificação deve ser feita ao adicionar a escala de final de semana para saber
 * a ordem exata; de P5 a P12 a ordem está correta)".
 *
 * É o mesmo papel que a escala numérica faz no dia útil e a folha "FERIADOS" faz no
 * feriado: uma referência que NÃO passa pela leitura da foto. Sem ela, quando a Vision
 * troca dois nomes da tabela de posições, a fila do fim de semana inteiro nasce errada e
 * nada na tela sabe dizer.
 *
 * O Pega Plantão nomeia a posição no campo `Setor` ("1 - P1", "2- P2", "E10 - P10",
 * "E11- P11 HC") e registra as posições do SÁBADO; a tabela do documento vale o fim de
 * semana inteiro, então é contra o sábado que se compara.
 *
 * Puro: os registros e o casador de nome entram por parâmetro.
 */

const PN = /\bP\s?(\d{1,2})\b/i
const soData = (v) => String(v || '').slice(0, 10)

const tokens = (v) => String(v || '')
  .normalize('NFD').replace(/\p{M}/gu, '')
  .toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ')
  .split(/\s+/).filter(Boolean)

/**
 * O MESMO NOME ESCRITO COM ESPAÇOS DIFERENTES.
 *
 * O Pega Plantão escreve "Guilherme Xavier Di Domenico" e o documento escreve "GUILHERME
 * DIDOMENICO"; a Vision já produziu "GUILHERME M ELO" para "GUILHERME MELO". Comparar
 * token a token perde os três casos. Aqui cada token do nome mais curto pode consumir
 * tokens CONSECUTIVOS do mais longo, e o primeiro nome tem de bater — sem isso dois
 * sobrenomes iguais casariam pessoas diferentes.
 */
export function nomesCompativeis(a, b) {
  const [x, y] = [tokens(a), tokens(b)]
  if (!x.length || !y.length) return false
  const [curto, longo] = x.join('').length <= y.join('').length ? [x, y] : [y, x]
  if (curto[0] !== longo[0]) return false
  let j = 0
  for (const alvo of curto) {
    let achou = false
    while (j < longo.length && !achou) {
      let acc = ''
      let k = j
      while (k < longo.length && alvo.startsWith(acc + longo[k])) {
        acc += longo[k]; k += 1
        if (acc === alvo) break
      }
      if (acc === alvo) { j = k; achou = true } else { j += 1 }
    }
    if (!achou) return false
  }
  return true
}

/** `Setor` do Pega Plantão → "P7" (null quando o setor não é uma posição do FDS). */
export function pnDoSetor(setor) {
  const m = PN.exec(String(setor || ''))
  return m ? `P${Number(m[1])}` : null
}

/**
 * Pn → nome, do que o Pega Plantão registrou naquela data. Quando a mesma posição aparece
 * duas vezes (o P11 cobre 24h e atravessa o domingo), vale o primeiro registro do dia.
 */
export function posicoesDoPegaPlantao(registros, dataISO) {
  const out = {}
  for (const r of registros || []) {
    if (dataISO && soData(r?.Inicio) !== dataISO) continue
    const pn = pnDoSetor(r?.Setor)
    if (!pn || out[pn]) continue
    const nome = String(r?.ProfDePlantao || r?.ProfFixo || '').trim()
    if (nome) out[pn] = nome
  }
  return out
}

const num = (pn) => Number(String(pn).replace(/\D/g, '')) || 0
/** P1–P4 é um bloco: a ordem entre eles varia e só se confirma na conferência. */
export const ehBlocoInicial = (pn) => num(pn) >= 1 && num(pn) <= 4

/**
 * Compara a tabela de posições LIDA do documento com a do Pega Plantão.
 *
 * - **P5 em diante**: a posição é exata; nome diferente é divergência.
 * - **P1 a P4**: o conjunto é o que vale. Se as mesmas quatro pessoas estão lá em ordem
 *   diferente, isso NÃO é erro — é o aviso para confirmar a ordem na foto, que é
 *   exatamente o que o dono pede que se faça ao anexar. Pessoa que não está no bloco dos
 *   quatro do Pega Plantão é divergência de verdade.
 * - Posição que só existe de um lado entra em `faltando`/`sobrando`.
 *
 * `casar(nomeLido, nomeDoPegaPlantao)` decide identidade; sem ela, comparação por texto.
 */
export function compararPosicoesFds(lidas, doPegaPlantao, { casar } = {}) {
  const mesma = (a, b) => {
    if (!a || !b) return false
    if (typeof casar === 'function' && (casar(a, b) || casar(b, a))) return true
    return nomesCompativeis(a, b)
  }
  const pns = [...new Set([...Object.keys(lidas || {}), ...Object.keys(doPegaPlantao || {})])]
    .filter((pn) => num(pn) > 0)
    .sort((a, b) => num(a) - num(b))

  const divergentes = []
  const faltando = []
  const sobrando = []
  const conferirOrdem = []
  const blocoPP = pns.filter(ehBlocoInicial).map((pn) => doPegaPlantao?.[pn]).filter(Boolean)

  for (const pn of pns) {
    const lido = lidas?.[pn]
    const esperado = doPegaPlantao?.[pn]
    if (lido && !esperado) { sobrando.push({ pn, lido }); continue }
    if (!lido && esperado) { faltando.push({ pn, esperado }); continue }
    if (mesma(lido, esperado)) continue
    if (ehBlocoInicial(pn) && blocoPP.some((n) => mesma(lido, n))) {
      conferirOrdem.push({ pn, lido, esperado })
      continue
    }
    divergentes.push({ pn, lido, esperado })
  }
  return {
    iguais: !divergentes.length && !faltando.length && !sobrando.length && !conferirOrdem.length,
    divergentes, faltando, sobrando, conferirOrdem,
  }
}

/** Uma frase para a tela; string vazia quando não há o que dizer. */
export function textoComparacaoFds(c) {
  if (!c || c.iguais) return ''
  const partes = []
  if (c.divergentes.length) partes.push(`difere no Pega Plantão: ${c.divergentes.map((d) => `${d.pn} lido ${d.lido}, no Pega Plantão ${d.esperado}`).join(' · ')}`)
  if (c.conferirOrdem.length) partes.push(`confirme a ordem entre P1 e P4 (as mesmas pessoas, em posições trocadas: ${c.conferirOrdem.map((d) => d.pn).join(', ')})`)
  if (c.faltando.length) partes.push(`sem nome na leitura: ${c.faltando.map((d) => `${d.pn} (${d.esperado})`).join(' · ')}`)
  // `sobrando` fica no dado mas FORA da frase: posição que o Pega Plantão não cobre não é
  // prova de erro de leitura — ele pode simplesmente não ter aquela vaga registrada (no
  // sábado 05/09 ele ia até P11, e o documento chega a P12).
  if (!partes.length) return ''
  return `Tabela de posições — ${partes.join('; ')}.`
}

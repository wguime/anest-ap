/**
 * Trocas de FERIADO entre anestesistas — parte pura.
 *
 * Dois escopos, escolhidos por quem pede (dono 03/09):
 *   - `data`:    troca de feriado com um colega. Quem pede sai do feriado dele e assume o do
 *                colega; o colega faz o caminho inverso. As duas filas mudam.
 *   - `posicao`: os dois seguem no MESMO feriado e trocam de lugar na fila.
 *
 * A troca ACEITA é o fato: não existe coleção de override espelhando a fila. A tela lê as
 * trocas aceitas e as aplica sobre a fila impressa, o que evita a dupla escrita (e a
 * consequente divergência) dos módulos de plantão, cuja base é tabela estática.
 *
 * Aplicar sempre sobre a fila IMPRESSA (matutina). A tarde é a manhã invertida, e inverter
 * depois de aplicar mantém as duas coerentes — aplicar nas duas separadamente não manteria.
 */
import { ordemFeriado, casarNomeComLegenda, normNomeNumerica } from './escalaNumerica.js'

const nomesDe = (x) => String(x?.nome || '').split('/').map(normNomeNumerica).filter(Boolean)

/**
 * Mesma pessoa?
 *
 * O número da legenda NÃO basta: a entrada compartilhada ("05 HUMBERTO / ROBERTA") dá o
 * mesmo número a duas pessoas, e comparar só por ele faria HUMBERTO trocar consigo mesmo
 * ao escolher ROBERTA. Por isso o número tem de bater E os nomes têm de se cruzar — o
 * cruzamento também resolve o caso inverso, em que a fila imprime o PAR ("ROSE / ALINE") e
 * quem entrou é um dos dois.
 */
export function mesmaEntrada(a, b) {
  const na = nomesDe(a)
  const nb = nomesDe(b)
  if (a?.numero && b?.numero) {
    if (a.numero !== b.numero) return false
    if (!na.length || !nb.length) return true
    return na.some((n) => nb.includes(n))
  }
  return Boolean(na.length && nb.length && na.some((n) => nb.includes(n)))
}

/**
 * Nome completo (cadastro/login) → entrada da legenda. Entrada compartilhada
 * ("HUMBERTO / ROBERTA") casa pelo nome de quem entrou, não pelo par.
 *
 * ⚠️ AMBÍGUO É NULO, nunca "o primeiro que casar". Um primeiro nome sozinho casa com mais de
 * uma pessoa — "GUILHERME" bate em MELO (04), STAUB (13) e GUILHERME D (41) — e o primeiro
 * que aparece não é sequer estável: as chaves "10".."44" do JSON são numéricas e vêm ANTES
 * de "01".."09", então varrer a legenda devolvia STAUB para quem é MELO. Errar aqui deixaria
 * uma pessoa pedir troca do feriado de outra, então na dúvida ninguém é identificado.
 */
export function identificarNaLegenda(dados, nomeCompleto) {
  if (!nomeCompleto) return null
  const achados = []
  for (const [numero, e] of Object.entries(dados?.legenda || {})) {
    for (const n of String(e.nome).split('/').map((s) => s.trim()).filter(Boolean)) {
      if (casarNomeComLegenda(n, nomeCompleto)) achados.push({ numero, nome: normNomeNumerica(n) })
    }
  }
  return achados.length === 1 ? achados[0] : null
}

/** Fila impressa (matutina) de um feriado, já numerada. `null` quando o feriado não existe. */
export function filaImpressa(dados, data) {
  const r = ordemFeriado(dados, { data, turno: 'matutino' })
  if (!r) return null
  return r.posicoes.map((p, i) => ({ ...p, posicao: i + 1 }))
}

/**
 * Feriados em que a pessoa está escalada, com a posição dela.
 * É o que alimenta o "meu feriado para trocar" do formulário.
 */
export function feriadosDaPessoa(dados, pessoa, { aPartirDe = null } = {}) {
  if (!pessoa) return []
  const out = []
  for (const [data, f] of Object.entries(dados?.feriados?.dias || {})) {
    if (aPartirDe && data < aPartirDe) continue
    const fila = filaImpressa(dados, data)
    const eu = fila?.find((p) => mesmaEntrada(p, pessoa))
    if (eu) out.push({ data, nome: f.nome, posicao: eu.posicao, numero: eu.numero })
  }
  return out.sort((a, b) => a.data.localeCompare(b.data))
}

const trocaVale = (t) => t?.status === 'aceita'

/**
 * Aplica as trocas aceitas sobre a fila impressa de UM feriado.
 *
 * `data` (troca de feriado): quem sai é substituído por quem entra, NA MESMA POSIÇÃO — a
 * ordem do quadro é do posto, não da pessoa. `posicao`: os dois trocam de lugar.
 * Troca que não encontra a pessoa na fila é ignorada (o quadro mudou depois do aceite).
 */
export function aplicarTrocasNaFila(posicoes, data, trocas = []) {
  let fila = [...(posicoes || [])]
  const trocar = (a, b) => {
    const ia = fila.findIndex((p) => mesmaEntrada(p, a))
    const ib = fila.findIndex((p) => mesmaEntrada(p, b))
    if (ia < 0 || ib < 0) return
    const copia = [...fila]
    copia[ia] = { ...fila[ib], posicao: fila[ia].posicao, trocado: true }
    copia[ib] = { ...fila[ia], posicao: fila[ib].posicao, trocado: true }
    fila = copia
  }
  const substituir = (sai, entra) => {
    const i = fila.findIndex((p) => mesmaEntrada(p, sai))
    if (i < 0) return
    const copia = [...fila]
    copia[i] = { ...entra, posicao: fila[i].posicao, trocado: true }
    fila = copia
  }

  for (const t of trocas.filter(trocaVale)) {
    const solicitante = { numero: t.solicitanteNumero, nome: t.solicitanteNome }
    const destinatario = { numero: t.destinatarioNumero, nome: t.destinatarioNome }
    if (t.escopo === 'posicao') {
      if (t.feriadoData === data) trocar(solicitante, destinatario)
      continue
    }
    // escopo 'data': cada feriado recebe o outro
    if (t.feriadoData === data) substituir(solicitante, destinatario)
    if (t.feriadoDesejado === data) substituir(destinatario, solicitante)
  }
  return fila
}

/**
 * Fila do feriado nos dois turnos, com as trocas aceitas já aplicadas.
 * A tarde é a manhã invertida e renumerada — nunca calculada à parte.
 */
export function filasDoFeriado(dados, data, trocas = []) {
  const base = filaImpressa(dados, data)
  if (!base) return null
  const impressa = aplicarTrocasNaFila(base, data, trocas)
  return {
    matutino: impressa.map((p, i) => ({ ...p, posicao: i + 1 })),
    vespertino: [...impressa].reverse().map((p, i) => ({ ...p, posicao: i + 1 })),
  }
}

/**
 * Regras de quem pode pedir o quê. Devolve a mensagem do primeiro problema, ou `null`.
 * O serviço revalida antes de gravar — isto aqui é para o formulário não deixar pedir.
 */
export function validarPedido(dados, { escopo, solicitante, feriadoData, destinatario, feriadoDesejado }) {
  if (!solicitante?.numero && !solicitante?.nome) return 'Você não foi identificado na escala de feriados'
  if (!['data', 'posicao'].includes(escopo)) return 'Escolha o tipo de troca'
  if (!feriadoData) return 'Escolha o seu feriado'
  if (!destinatario) return 'Escolha o colega'
  if (mesmaEntrada(solicitante, destinatario)) return 'Você não pode trocar com você mesmo'

  const minhaFila = filaImpressa(dados, feriadoData)
  if (!minhaFila) return 'Feriado sem escala publicada'
  if (!minhaFila.some((p) => mesmaEntrada(p, solicitante))) return 'Você não está escalado neste feriado'

  if (escopo === 'posicao') {
    if (!minhaFila.some((p) => mesmaEntrada(p, destinatario))) return 'O colega não está escalado neste feriado'
    return null
  }

  if (!feriadoDesejado) return 'Escolha o feriado do colega'
  if (feriadoDesejado === feriadoData) return 'Para trocar de posição no mesmo feriado, use a troca de posição'
  const filaDele = filaImpressa(dados, feriadoDesejado)
  if (!filaDele) return 'Feriado sem escala publicada'
  if (!filaDele.some((p) => mesmaEntrada(p, destinatario))) return 'O colega não está escalado no feriado escolhido'
  if (filaDele.some((p) => mesmaEntrada(p, solicitante))) return 'Você já está escalado no feriado do colega'
  return null
}

/** Frase curta que descreve a troca — usada no card e na notificação. */
export function resumirTroca(t) {
  const br = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '')
  if (t.escopo === 'posicao') {
    return `${t.solicitanteNome} e ${t.destinatarioNome} trocam de posição no feriado de ${br(t.feriadoData)}`
  }
  return `${t.solicitanteNome} (${br(t.feriadoData)}) troca de feriado com ${t.destinatarioNome} (${br(t.feriadoDesejado)})`
}

/**
 * Pós-plantão na consulta da ordem de liberação (regra do dono, 03/09/2026).
 *
 * Quem fez o plantão NOTURNO da véspera — P1 no HRO e P2 na Unimed — na manhã seguinte
 * assume a **2ª posição do hospital em que plantonou** (abaixo do plantão da manhã), mesmo
 * que a escala numérica o traga em outro hospital: ele SAI da coluna original e entra ali.
 * Já na tarde ele não é escalado: fica na posição que a numérica lhe dá, marcado.
 *
 * Vale de segunda a sexta. A véspera de segunda é DOMINGO, e o plantão de domingo à noite
 * não existe no Pega Plantão (conferido em 23/08 e 30/08: só o P11 de 24h) — ele vem da
 * faixa `19-07` da grade do documento de fim de semana publicado no app. De terça a sexta a
 * véspera é dia útil e os P1/P2 vêm do Pega Plantão, lançados na data da véspera às 19h.
 *
 * Sexta à noite não gera pós-plantão: o sábado não tem escala numérica (a regra é de dia
 * útil, e o fim de semana tem escala própria).
 *
 * Puro: quem busca os dados é o chamador. Nada aqui grava.
 */
import { casarNomeComLegenda, normNomeNumerica } from './escalaNumerica.js'
import { identificarNaLegenda } from './trocasFeriado.js'

/** Hospital de cada posto do plantão noturno, e o caminho inverso. */
export const HOSPITAL_DO_POSTO = { P1: 'hro', P2: 'unimed' }
export const POSTO_DO_HOSPITAL = { hro: 'P1', unimed: 'P2' }

/** Véspera de `dataISO` em 'AAAA-MM-DD'. */
export function vesperaDe(dataISO) {
  const d = new Date(`${dataISO}T12:00:00`)
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Segunda a sexta. Sábado e domingo não têm escala numérica. */
export function ehDiaUtilNumerica(dataISO) {
  const wd = new Date(`${dataISO}T12:00:00`).getDay()
  return wd !== 0 && wd !== 6
}

/**
 * De onde sai o plantão noturno da véspera de `dataISO`:
 *   'pega-plantao' (véspera é dia útil) · 'documento-fds' (véspera é domingo) · null.
 */
export function fonteDoNoturno(dataISO) {
  if (!ehDiaUtilNumerica(dataISO)) return null
  const v = vesperaDe(dataISO)
  const wd = new Date(`${v}T12:00:00`).getDay()
  if (wd === 0) return 'documento-fds'
  if (wd === 6) return null // véspera sábado só aconteceria num domingo, já descartado
  return 'pega-plantao'
}

/**
 * Plantões do Pega Plantão da VÉSPERA → { hro, unimed } (nomes completos).
 * O plantão noturno é o que começa às 19h ou depois; o diurno do mesmo dia fica de fora.
 */
export function noturnosDoPegaPlantao(plantoes = []) {
  const out = { hro: null, unimed: null }
  for (const p of plantoes) {
    const posto = String(p?.setor || '').trim().toUpperCase()
    const hospital = HOSPITAL_DO_POSTO[posto]
    if (!hospital || out[hospital]) continue
    const hora = Number(String(p?.horario || '').slice(0, 2))
    if (!Number.isFinite(hora) || hora < 19) continue
    const nome = String(p?.nome || '').trim()
    if (nome) out[hospital] = nome
  }
  return out
}

/** Grade do documento de FDS (faixa 19-07) → { hro, unimed }. */
export function noturnosDoDocumentoFds(grade) {
  const linha = grade?.['19-07'] || {}
  return {
    hro: String(linha.hro || '').trim() || null,
    unimed: String(linha.unimed || '').trim() || null,
  }
}

/**
 * A entrada da grade é a pessoa que plantonou?
 *
 * O documento de FDS escreve a noite com o NOME CURTO da legenda ("GUSTAVO"), não com o
 * nome completo do Pega Plantão. Casamento aproximado com nome curto erra: o cadastro do
 * GARIM é "GUSTAVO ALMANSA GARIM", mesmo primeiro nome — e na manhã de 28/09 o Garim, que
 * vem antes na Unimed, levou o P2 do GUSTAVO (Biesdorf). Por isso: nome IGUAL a uma
 * entrada da legenda casa só com ela, e nome de uma palavra só nunca casa por aproximação
 * (identidade ambígua é nula).
 */
const partesDaEntrada = (entrada) => String(entrada?.nome || '').split('/').map((n) => n.trim()).filter(Boolean)
const ehAPessoa = (entrada, nomeCompleto, legendaExata = false) => {
  const alvo = normNomeNumerica(nomeCompleto)
  const partes = partesDaEntrada(entrada)
  if (partes.some((n) => normNomeNumerica(n) === alvo)) return true
  if (legendaExata || !alvo.includes(' ')) return false
  return partes.some((n) => casarNomeComLegenda(n, nomeCompleto))
}

/** O nome é, letra por letra, uma entrada da legenda (nome curto do documento de FDS)? */
const nomesDaLegendaNorm = (dados) => new Set(
  Object.values(dados?.legenda || {}).flatMap((e) => String(e.nome).split('/').map(normNomeNumerica).filter(Boolean)),
)

const renumerar = (lista) => lista.map((p, i) => ({ ...p, posicao: i + 1 }))

/**
 * MANHÃ: tira quem fez a noite de onde a numérica o pôs e o insere na 2ª posição do
 * hospital em que plantonou. Quem estava da 2ª para baixo desce uma casa.
 *
 * `blocos`: [{ hospital, lista }] · `consultorio`: entradas sem posição.
 * Quem não está na grade do dia entra assim mesmo, identificado pela legenda — plantonou,
 * então está no hospital. Sem identidade na legenda, não entra (não se inventa posição).
 */
export function aplicarPosPlantaoManha(dados, blocos, consultorio = [], noturnos = {}) {
  const alvos = ['hro', 'unimed'].filter((h) => noturnos[h])
  if (!alvos.length) return { blocos, consultorio, movidos: [] }

  const legenda = nomesDaLegendaNorm(dados)
  let listas = Object.fromEntries(blocos.map((b) => [b.hospital, [...b.lista]]))
  let cons = [...consultorio]
  const movidos = []
  const aInserir = []

  // 1) retirar de onde estiver — uma pessoa ocupa um lugar só
  for (const hospital of alvos) {
    const nomeCompleto = noturnos[hospital]
    const exata = legenda.has(normNomeNumerica(nomeCompleto))
    let entrada = null
    for (const h of Object.keys(listas)) {
      const i = listas[h].findIndex((p) => ehAPessoa(p, nomeCompleto, exata))
      if (i >= 0) { entrada = listas[h][i]; listas[h] = listas[h].filter((_, k) => k !== i) }
    }
    const ic = cons.findIndex((c) => ehAPessoa(c, nomeCompleto, exata))
    if (ic >= 0) { entrada = entrada || cons[ic]; cons = cons.filter((_, k) => k !== ic) }
    if (!entrada) {
      const numero = exata
        ? Object.keys(dados?.legenda || {}).find((n) => String(dados.legenda[n].nome).split('/').map(normNomeNumerica).includes(normNomeNumerica(nomeCompleto)))
        : null
      const naLegenda = numero
        ? { numero, nome: normNomeNumerica(nomeCompleto) }
        : (normNomeNumerica(nomeCompleto).includes(' ') ? identificarNaLegenda(dados, nomeCompleto) : null)
      if (!naLegenda) continue
      entrada = { numero: naLegenda.numero, nome: naLegenda.nome }
    }
    aInserir.push({ hospital, entrada })
  }

  // 2) inserir na 2ª posição do hospital do plantão (depois de todas as retiradas, para a
  //    posição não depender da ordem em que os dois foram processados)
  for (const { hospital, entrada } of aInserir) {
    if (!listas[hospital]) continue
    const idx = Math.min(1, listas[hospital].length)
    listas[hospital] = [
      ...listas[hospital].slice(0, idx),
      // `movidoPorPlantao` NÃO é a marca da tarde: de manhã eles trabalham, então não
      // podem aparecer esmaecidos nem rotulados "(pós plantão)" (dono: a marca é da tarde).
      // `postoPlantao` vai nos dois turnos — é ele que explica, entre parênteses, de qual
      // plantão a pessoa vem, e por que ela está na 2ª posição (dono 04/09).
      { ...entrada, movidoPorPlantao: true, postoPlantao: POSTO_DO_HOSPITAL[hospital] },
      ...listas[hospital].slice(idx),
    ]
    movidos.push({ hospital, nome: entrada.nome })
  }

  return {
    blocos: blocos.map((b) => ({ ...b, lista: renumerar(listas[b.hospital]) })),
    consultorio: cons,
    movidos,
  }
}

/**
 * TARDE, na CONFERÊNCIA do rodapé (publicação por foto, dono 21/09): quem fez a noite não é
 * escalado à tarde, então não pode ser cobrado como "faltando no rodapé". A tela de consulta
 * MARCA (abaixo); a conferência EXCLUI da lista esperada — "Nathalia e Tiago são pós plantão".
 */
export function excluirPosPlantaoTarde(lista, noturnos = {}) {
  const nomes = ['hro', 'unimed'].map((h) => noturnos?.[h]).filter(Boolean)
  if (!nomes.length) return { lista, excluidos: [] }
  const excluidos = []
  // nome idêntico na lista → só ele sai (ver ehAPessoa: "GUSTAVO" não pode tirar o GARIM)
  const exata = (n) => (lista || []).some((p) => partesDaEntrada(p).some((x) => normNomeNumerica(x) === normNomeNumerica(n)))
  const restante = (lista || []).filter((p) => {
    const bate = nomes.some((n) => ehAPessoa(p, n, exata(n)))
    if (bate) excluidos.push(p.nome)
    return !bate
  })
  return { lista: renumerar(restante), excluidos }
}

/**
 * TARDE: eles não são escalados, mas continuam na posição que a numérica lhes dá — só
 * ganham a marca (decisão do dono 03/09, mesma escolha das férias: marcar, não sumir).
 */
export function marcarPosPlantaoTarde(blocos, consultorio = [], noturnos = {}) {
  const postos = ['hro', 'unimed']
    .filter((h) => noturnos[h])
    .map((h) => ({ posto: POSTO_DO_HOSPITAL[h], nome: noturnos[h] }))
  if (!postos.length) return { blocos, consultorio, marcados: [] }
  // nome idêntico em algum lugar da grade → só ele leva a marca (ver ehAPessoa)
  const todas = [...blocos.flatMap((b) => b.lista), ...consultorio]
  for (const x of postos) {
    const alvo = normNomeNumerica(x.nome)
    x.exata = todas.some((e) => partesDaEntrada(e).some((n) => normNomeNumerica(n) === alvo))
  }
  const marcados = []
  const marcar = (entrada) => {
    const dele = postos.find((x) => ehAPessoa(entrada, x.nome, x.exata))
    if (!dele) return entrada
    marcados.push(normNomeNumerica(entrada.nome))
    return { ...entrada, posPlantao: true, postoPlantao: dele.posto }
  }
  return {
    blocos: blocos.map((b) => ({ ...b, lista: b.lista.map(marcar) })),
    consultorio: consultorio.map(marcar),
    marcados,
  }
}

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

/** Hospital de cada posto do plantão noturno. */
export const HOSPITAL_DO_POSTO = { P1: 'hro', P2: 'unimed' }

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

const ehAPessoa = (entrada, nomeCompleto) =>
  String(entrada?.nome || '').split(' / ').some((n) => casarNomeComLegenda(n, nomeCompleto))

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

  let listas = Object.fromEntries(blocos.map((b) => [b.hospital, [...b.lista]]))
  let cons = [...consultorio]
  const movidos = []
  const aInserir = []

  // 1) retirar de onde estiver — uma pessoa ocupa um lugar só
  for (const hospital of alvos) {
    const nomeCompleto = noturnos[hospital]
    let entrada = null
    for (const h of Object.keys(listas)) {
      const i = listas[h].findIndex((p) => ehAPessoa(p, nomeCompleto))
      if (i >= 0) { entrada = listas[h][i]; listas[h] = listas[h].filter((_, k) => k !== i) }
    }
    const ic = cons.findIndex((c) => ehAPessoa(c, nomeCompleto))
    if (ic >= 0) { entrada = entrada || cons[ic]; cons = cons.filter((_, k) => k !== ic) }
    if (!entrada) {
      const naLegenda = identificarNaLegenda(dados, nomeCompleto)
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
      // podem aparecer esmaecidos nem rotulados "(pós plantão)" (dono: a marca é da tarde)
      { ...entrada, movidoPorPlantao: true },
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
 * TARDE: eles não são escalados, mas continuam na posição que a numérica lhes dá — só
 * ganham a marca (decisão do dono 03/09, mesma escolha das férias: marcar, não sumir).
 */
export function marcarPosPlantaoTarde(blocos, consultorio = [], noturnos = {}) {
  const nomes = ['hro', 'unimed'].map((h) => noturnos[h]).filter(Boolean)
  if (!nomes.length) return { blocos, consultorio, marcados: [] }
  const marcados = []
  const marcar = (entrada) => {
    if (!nomes.some((n) => ehAPessoa(entrada, n))) return entrada
    marcados.push(normNomeNumerica(entrada.nome))
    return { ...entrada, posPlantao: true }
  }
  return {
    blocos: blocos.map((b) => ({ ...b, lista: b.lista.map(marcar) })),
    consultorio: consultorio.map(marcar),
    marcados,
  }
}

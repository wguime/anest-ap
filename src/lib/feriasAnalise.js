/**
 * Análise histórica de férias — mapa de calor e métricas de gestão.
 *
 * Insumo: registros MÍNIMOS {nome, data} por ano (a API do Pega Plantão
 * serve o histórico — sondado 03/08: 2023+ completos e 2027 já com
 * marcações). Tudo puro e determinístico: ano/hoje entram por parâmetro.
 *
 * Semântica: cada registro = 1 dia de férias de 1 pessoa; FDS é ignorado
 * (marcação suja). "Ocupação" de um dia = quantas pessoas marcaram —
 * comparável ao teto de 6 vagas diárias da regra do grupo.
 */

import { ehFimDeSemana } from './extratoFerias'

export const VAGAS_DIA = 6

// ============================================================================
// SEMANA ISO (comparável entre anos)
// ============================================================================

/** Número da semana ISO-8601 (1–53) + ano ISO da data. */
export function semanaISO(dataISO) {
  const d = new Date(`${dataISO}T12:00:00Z`)
  const dow = (d.getUTCDay() + 6) % 7 // 0=seg
  d.setUTCDate(d.getUTCDate() - dow + 3) // quinta da semana
  const anoISO = d.getUTCFullYear()
  const primeiraQuinta = new Date(Date.UTC(anoISO, 0, 4))
  const fd = (primeiraQuinta.getUTCDay() + 6) % 7
  primeiraQuinta.setUTCDate(primeiraQuinta.getUTCDate() - fd + 3)
  return { ano: anoISO, semana: 1 + Math.round((d - primeiraQuinta) / (7 * 864e5)) }
}

/** Segunda-feira (ISO) da semana N do ano — p/ rotular "13–17 jul". */
export function segundaDaSemanaISO(ano, semana) {
  const quatroJan = new Date(Date.UTC(ano, 0, 4))
  const fd = (quatroJan.getUTCDay() + 6) % 7
  quatroJan.setUTCDate(quatroJan.getUTCDate() - fd + (semana - 1) * 7)
  return quatroJan.toISOString().slice(0, 10)
}

const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** "13–17 jul" (seg–sex da semana ISO). */
export function labelSemana(ano, semana) {
  const seg = segundaDaSemanaISO(ano, semana)
  const d = new Date(`${seg}T12:00:00Z`)
  const sex = new Date(d)
  sex.setUTCDate(d.getUTCDate() + 4)
  const mesSeg = MES_CURTO[d.getUTCMonth()]
  const mesSex = MES_CURTO[sex.getUTCMonth()]
  const diaSeg = String(d.getUTCDate()).padStart(2, '0')
  const diaSex = String(sex.getUTCDate()).padStart(2, '0')
  return mesSeg === mesSex ? `${diaSeg}–${diaSex} ${mesSeg}` : `${diaSeg} ${mesSeg} – ${diaSex} ${mesSex}`
}

// ============================================================================
// OCUPAÇÃO
// ============================================================================

/** Map dataISO → nomes marcados (só dias úteis). */
export function ocupacaoPorDia(registrosMin = []) {
  const porDia = new Map()
  for (const r of registrosMin) {
    if (!r?.data || ehFimDeSemana(r.data)) continue
    if (!porDia.has(r.data)) porDia.set(r.data, [])
    porDia.get(r.data).push(r.nome)
  }
  return porDia
}

/**
 * Série semanal do ano: média e pico de ocupação por dia útil de cada
 * semana ISO. Semanas sem marcação entram com 0 (o vazio é informação).
 */
export function serieSemanal(porDia, ano) {
  const somaPorSemana = new Map() // semana → {soma, dias, max}
  for (const [data, nomes] of porDia) {
    const { ano: anoISO, semana } = semanaISO(data)
    if (anoISO !== ano) continue
    if (!somaPorSemana.has(semana)) somaPorSemana.set(semana, { soma: 0, dias: 0, max: 0 })
    const s = somaPorSemana.get(semana)
    s.soma += nomes.length
    s.dias += 1
    s.max = Math.max(s.max, nomes.length)
  }
  const ultimaSemana = semanaISO(`${ano}-12-28`).semana // 28/12 sempre está na última semana ISO
  const serie = []
  for (let semana = 1; semana <= ultimaSemana; semana++) {
    const s = somaPorSemana.get(semana)
    serie.push({
      semana,
      media: s ? s.soma / 5 : 0, // por dia útil da semana (5)
      max: s ? s.max : 0,
    })
  }
  return serie
}

/**
 * Semanas recorrentemente mais/menos procuradas entre os anos.
 * Recorrência conta em quantos anos a semana ficou no top/bottom quartil.
 */
export function rankingSemanas(seriesPorAno = {}, { top = 5 } = {}) {
  const anos = Object.keys(seriesPorAno).map(Number).sort()
  if (!anos.length) return { maisProcuradas: [], menosProcuradas: [] }

  const porSemana = new Map() // semana → {somaMedias, anos, anosNoTopo}
  for (const ano of anos) {
    const serie = seriesPorAno[ano]
    const ordenada = [...serie].sort((a, b) => b.media - a.media)
    const corteTopo = ordenada[Math.floor(serie.length / 4)]?.media ?? 0
    for (const { semana, media } of serie) {
      if (!porSemana.has(semana)) porSemana.set(semana, { somaMedias: 0, anos: 0, anosNoTopo: 0 })
      const s = porSemana.get(semana)
      s.somaMedias += media
      s.anos += 1
      if (media >= corteTopo && media > 0) s.anosNoTopo += 1
    }
  }

  const linhas = [...porSemana.entries()]
    .filter(([, s]) => s.anos === anos.length) // só semanas presentes em todos os anos
    .map(([semana, s]) => ({ semana, mediaAnos: s.somaMedias / s.anos, anosNoTopo: s.anosNoTopo }))

  const maisProcuradas = [...linhas].sort((a, b) => b.mediaAnos - a.mediaAnos).slice(0, top)
  const menosProcuradas = [...linhas]
    .filter((l) => {
      // Fim de ano fica de fora do "menos procuradas": recesso tem esquema próprio
      const seg = segundaDaSemanaISO(anos[anos.length - 1], l.semana)
      const mes = seg.slice(5, 7)
      return mes !== '12'
    })
    .sort((a, b) => a.mediaAnos - b.mediaAnos)
    .slice(0, top)

  return { maisProcuradas, menosProcuradas }
}

// ============================================================================
// ÚLTIMO A MARCAR (regra da 7ª vaga)
// ============================================================================

const LOTE_BASELINE_MS = 5 * 60 * 1000

/**
 * Quem foi o ÚLTIMO a marcar entre os códigos de um dia, pelo first-seen
 * registrado em ferias_marcacoes_vistas. A 1ª varredura (baseline) vê tudo
 * no mesmo lote → ordem DESCONHECIDA ({confiavel: false}); só é confiável
 * quando o último apareceu num lote posterior ao primeiro (>5min).
 * @param {string[]} codigosDoDia
 * @param {Map<string, {nome, firstSeenAt}>} vistas
 */
export function ultimoAMarcar(codigosDoDia = [], vistas = new Map()) {
  const entradas = codigosDoDia.map((c) => vistas.get(c)).filter(Boolean)
  if (!entradas.length || entradas.length < codigosDoDia.length) return null
  const ordenadas = [...entradas].sort((a, b) => String(a.firstSeenAt).localeCompare(String(b.firstSeenAt)))
  const primeiro = ordenadas[0]
  const ultimo = ordenadas[ordenadas.length - 1]
  if (new Date(ultimo.firstSeenAt) - new Date(primeiro.firstSeenAt) < LOTE_BASELINE_MS) {
    return { confiavel: false }
  }
  return { confiavel: true, nome: ultimo.nome, vistoEm: String(ultimo.firstSeenAt).slice(0, 10) }
}

// ============================================================================
// MÉTRICAS DE GESTÃO + SUGESTÕES
// ============================================================================

function diasUteisDoAno(ano) {
  let n = 0
  const d = new Date(Date.UTC(ano, 0, 1))
  while (d.getUTCFullYear() === ano) {
    const dow = d.getUTCDay()
    if (dow >= 1 && dow <= 5) n++
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return n
}

const PCT = (x) => Math.round(x * 100)

/**
 * Métricas anuais de gestão + sugestões em texto, derivadas do histórico.
 *
 * @param {Object.<number, Array>} registrosPorAno {ano: registrosMin}
 * @param {number} anoAtual
 * @returns {{porAno: Array, insights: string[]}}
 */
export function metricasGestao({ registrosPorAno = {}, anoAtual }) {
  const anos = Object.keys(registrosPorAno).map(Number).sort()
  const porAno = []

  for (const ano of anos) {
    const porDia = ocupacaoPorDia(registrosPorAno[ano])
    let diasPessoa = 0
    let diasNoTeto = 0
    let diasAcimaTeto = 0
    let diasNobres = 0
    let diasS1 = 0
    for (const [data, nomes] of porDia) {
      diasPessoa += nomes.length
      if (nomes.length === VAGAS_DIA) diasNoTeto++
      if (nomes.length > VAGAS_DIA) diasAcimaTeto++
      const mes = data.slice(5, 7)
      const dia = data.slice(8, 10)
      if (mes === '07' || (mes === '01' && dia <= '15') || (mes === '12' && dia >= '16')) diasNobres++
      if (data <= `${ano}-06-30`) diasS1 += nomes.length
    }
    const capacidade = diasUteisDoAno(ano) * VAGAS_DIA
    porAno.push({
      ano,
      diasPessoa,
      capacidade,
      utilizacaoPct: capacidade ? PCT(diasPessoa / capacidade) : 0,
      diasNoTeto,
      diasAcimaTeto,
      pctS1: diasPessoa ? PCT(diasS1 / diasPessoa) : 0,
      diasNobres,
    })
  }

  // ── Sugestões (texto pronto; só as que os dados sustentam) ────────────────
  const insights = []
  const atual = porAno.find((m) => m.ano === anoAtual)
  const passados = porAno.filter((m) => m.ano < anoAtual)
  const anterior = passados[passados.length - 1]

  if (atual && anterior) {
    const delta = atual.utilizacaoPct - anterior.utilizacaoPct
    if (Math.abs(delta) >= 3) {
      insights.push(
        `A utilização das vagas diárias ${delta > 0 ? 'subiu' : 'caiu'} de ${anterior.utilizacaoPct}% (${anterior.ano}) para ${atual.utilizacaoPct}% (${atual.ano}) — ${delta > 0 ? 'a folga para remarcações está diminuindo; vale antecipar a marcação das semanas cheias' : 'há mais folga que no ano passado para acomodar trocas'}.`
      )
    }
    if (atual.diasNoTeto > anterior.diasNoTeto) {
      insights.push(
        `Dias com as 6 vagas lotadas: ${atual.diasNoTeto} em ${atual.ano} contra ${anterior.diasNoTeto} em ${anterior.ano} — a disputa por datas está mais apertada; abrir a marcação do ano seguinte mais cedo distribui melhor.`
      )
    }
  }
  if (atual?.diasAcimaTeto > 0) {
    insights.push(
      `${atual.ano} tem ${atual.diasAcimaTeto} dia${atual.diasAcimaTeto !== 1 ? 's' : ''} com 7+ marcações (7ª vaga custa 3 dias pela regra) — conferir se foram autorizadas.`
    )
  }
  if (atual && atual.pctS1 < 40) {
    insights.push(
      `Só ${atual.pctS1}% dos dias de ${atual.ano} caem no 1º semestre — a regra da metade até jun/jul tende a apertar o 2º semestre; incentivar marcações no S1 equilibra a escala.`
    )
  }
  const proximo = porAno.find((m) => m.ano === anoAtual + 1)
  if (proximo && proximo.diasPessoa > 0) {
    insights.push(
      `${proximo.ano} já tem ${proximo.diasPessoa} dias de férias marcados — sinal de planejamento; o mapa do próximo ano já mostra onde a disputa vai começar.`
    )
  }

  return { porAno, insights }
}

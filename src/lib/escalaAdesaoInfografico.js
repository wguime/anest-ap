/**
 * escalaAdesaoInfografico — textos e números do infográfico "Evolução da adesão" (dono 27/10/2026,
 * exemplo 3 "Impacto" de `.tmp/adesao-infografico-exemplos.html`: blocos de cor inteira, um recado
 * por bloco, números gigantes).
 *
 * Função pura sobre `montarEvolucao` (lib/escalaAdesaoSemanal): a página só desenha. Os textos são
 * montados aqui para seguirem os dados ao vivo — a semana muda toda segunda-feira e a frase que
 * era verdade em 27/10 ("todos sobem", "Materno abaixo da meta") pode deixar de ser.
 *
 *  - percentuais arredondados para inteiro
 *  - INCLINAÇÃO EM % (dono 27/10: "mostre esse dado em aumento de % e não em pontos"): aumento por
 *    semana = inclinação da reta de mínimos quadrados ÷ o nível em que a reta começa (1ª semana).
 *    Início marcado 55% → 86%: +7,8 pontos/semana sobre ~54% = +15% por semana. É a mesma reta
 *    desenhada no gráfico, então o rótulo e a faixa contam a mesma história
 *  - "antes do relatório" só quando as semanas cinza são exatamente as de antes de 23/09
 *    (`marco.virada`); depois disso o texto vira "nas N semanas anteriores"
 *  - "o que falta": só o que está ABAIXO da meta na última semana (tempo total, término pelo
 *    próprio anestesiologista, o hospital com o pior término, o cargo de apoio com menos engajados)
 *  - a previsão de término NÃO entra: o app a apaga quando a cirurgia termina (achado de 27/10),
 *    então ela não pode ser medida depois
 */

import { META } from '@/lib/escalaAdesao'
import { numeroBr } from '@/lib/numeroBr'

const NOMES_HOSPITAL = { hro: 'HRO', unimed: 'Unimed', materno: 'Materno' }

export const LINHAS_EVOLUCAO = [
  { chave: 'ini', nome: 'Início marcado', inclinacao: 'ini' },
  { chave: 'ter', nome: 'Término marcado', inclinacao: 'ter' },
  { chave: 'terProprio', nome: 'Término pelo próprio', inclinacao: 'terProprio' },
  { chave: 'tot', nome: 'Tempo total do turno', inclinacao: 'tot' },
]

/** 86.3 → 86 · null → null */
export const pct = (v) => (v == null || !Number.isFinite(Number(v)) ? null : Math.round(Number(v)))

/** 7.82 → "+7,8" · -0.1 → "−0,1" · 0.02 → "0,0" · null → "—" */
export function decimal(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—'
  const r = Math.round(Number(v) * 10) / 10
  const txt = numeroBr(Math.abs(r), 1)
  if (r > 0) return `+${txt}`
  if (r < 0) return `−${txt}`
  return txt
}

/**
 * Aumento % por semana: inclinação da reta ÷ valor da reta na 1ª semana (×100). null com menos de
 * 2 pontos ou quando a reta começa em 0 ou abaixo (não há base para a porcentagem).
 */
export function crescimentoSemanal(valores) {
  const pts = (valores || []).map((y, x) => ({ x, y })).filter((p) => p.y != null && Number.isFinite(Number(p.y)))
  if (pts.length < 2) return null
  const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length
  const my = pts.reduce((s, p) => s + Number(p.y), 0) / pts.length
  const sxx = pts.reduce((s, p) => s + (p.x - mx) ** 2, 0)
  if (!sxx) return null
  const a = pts.reduce((s, p) => s + (p.x - mx) * (Number(p.y) - my), 0) / sxx
  const inicio = my - a * mx // valor da reta em x = 0 (a 1ª semana da lista)
  return inicio > 0 ? (100 * a) / inicio : null
}

/** 14.6 → "+15%" · 2.2 → "+2%" · 0.4 → "+0,4%" · -3 → "−3%" · null → "—" */
export function percentualSemana(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—'
  const x = Number(v)
  const abs = Math.abs(x)
  const txt = abs < 1 ? numeroBr(abs, 1) : numeroBr(Math.round(abs))
  if (txt === '0' || txt === '0,0') return '0%'
  return `${x < 0 ? '−' : '+'}${txt}%`
}

/** '2026-09-21' → '21/09' */
export const ddmm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '')

const pctFmt = (v) => (pct(v) == null ? '—' : `${pct(v)}%`)

function manchetesEvolucao(linhas) {
  const comValor = linhas.filter((l) => l.crescimento != null)
  if (!comValor.length) return 'Sem dados suficientes para a tendência'
  const sobem = comValor.filter((l) => l.crescimento >= 0.5)
  const maior = [...comValor].sort((a, b) => b.crescimento - a.crescimento)[0]
  if (sobem.length === comValor.length) return `Todos sobem — ${artigo(maior.nome)} ${maior.nome.toLowerCase()}, mais rápido`
  if (!sobem.length) return 'Nenhum indicador subiu nas últimas semanas'
  return `${sobem.length} de ${comValor.length} indicadores sobem — ${artigo(maior.nome)} ${maior.nome.toLowerCase()}, mais rápido`
}

// "o início marcado", "o término…", "o tempo total…" — todos masculinos hoje
const artigo = () => 'o'

/**
 * View-model do infográfico, ou null sem dados. `ev` = retorno de `montarEvolucao`.
 */
export function montarInfografico(ev) {
  if (!ev?.serie?.length) return null
  const s = ev.serie
  const primeira = s[0]
  const ultima = s[s.length - 1]
  const n = s.length
  const anteriores = ev.anteriores || []
  const virada = Boolean(ev.marco?.virada)
  const quando = anteriores.length
    ? (virada ? 'antes do relatório' : `nas ${anteriores.length} semanas anteriores`)
    : null

  // 1 · engajados
  const engAnteriores = anteriores.map((a) => a.engajadosTotal).filter((v) => v != null)
  const engajados = {
    agora: ultima.engajadosTotal,
    antes: primeira.engajadosTotal,
    inclinacao: ev.inclinacoes?.total ?? null,
    faixaAnterior: engAnteriores.length ? [Math.min(...engAnteriores), Math.max(...engAnteriores)] : null,
    quando,
    colunas: [
      ...anteriores.map((a) => ({ rotulo: a.rotulo, valor: a.engajadosTotal ?? 0, anterior: true })),
      ...s.map((x) => ({ rotulo: x.rotulo, valor: x.engajadosTotal ?? 0, anterior: false })),
    ],
  }

  // 2 · a inclinação (início marcado): antes × depois
  const iniAnteriores = anteriores.map((a) => a.ini)
  const iniSerie = s.map((x) => x.ini)
  const inclinacao = {
    valor: crescimentoSemanal(iniSerie),
    antes: anteriores.length ? crescimentoSemanal(iniAnteriores) : null,
    primeiro: pct(primeira.ini),
    ultimo: pct(ultima.ini),
    quando,
    anteriores: iniAnteriores,
    serie: iniSerie,
    rotulos: [...anteriores.map((a) => a.rotulo), ...s.map((x) => x.rotulo)],
    // o marco só vale como "virada" quando cai entre as cinzas e as coloridas
    marco: virada ? { rotulo: '23/09 · relatório no app' } : null,
    meta: META.ini,
  }

  // 3 · agora (última semana × primeira)
  const agora = [
    { valor: pctFmt(ultima.ini), rotulo: 'início marcado', antes: `eram ${pctFmt(primeira.ini)}` },
    { valor: pctFmt(ultima.ter), rotulo: 'término marcado', antes: `eram ${pctFmt(primeira.ter)}` },
    { valor: pctFmt(ultima.abre), rotulo: 'abriu a escala nos dias escalados', antes: `eram ${pctFmt(primeira.abre)}` },
  ]

  // 4 · evolução semana a semana
  const linhas = LINHAS_EVOLUCAO.map((l) => {
    const valores = s.map((x) => x[l.chave])
    return { chave: l.chave, nome: l.nome, valores, crescimento: crescimentoSemanal(valores) }
  })
  const evolucao = { manchete: manchetesEvolucao(linhas), linhas, rotulos: s.map((x) => x.rotulo), meta: 80 }

  // 5 · quem marca
  const qa = ev.quemMarca?.primeira?.pct
  const qb = ev.quemMarca?.ultima?.pct
  const quemMarca = qb
    ? {
        agora: qb.proprio + qb.colega,
        antes: qa ? qa.proprio + qa.colega : null,
        barras: [
          qa && { rotulo: primeira.rotulo, partes: [qa.proprio, qa.colega, qa.outros] },
          { rotulo: ultima.rotulo, partes: [qb.proprio, qb.colega, qb.outros] },
        ].filter(Boolean),
      }
    : null

  // 6 · por cargo e hospital
  const cargo = (nome, chaveSerie, chaveBase, cor) => {
    const a = primeira[chaveSerie] ?? 0
    const b = ultima[chaveSerie] ?? 0
    return { nome, agora: b, antes: a, base: ultima[chaveBase] ?? 0, cor, melhorou: b > a }
  }
  const cargos = [
    cargo(ultima.engajadosAnest === 1 ? 'anestesiologista engajado' : 'anestesiologistas engajados', 'engajadosAnest', 'baseAnest', 'anest'),
    cargo('da enfermagem', 'engajadosEnf', 'baseEnf', 'enf'),
    cargo(ultima.engajadosRes === 1 ? 'residente' : 'residentes', 'engajadosRes', 'baseRes', 'res'),
  ]
  const hU = ev.hospitais?.ultima || {}
  const hP = ev.hospitais?.primeira || {}
  const hospitais = Object.keys(NOMES_HOSPITAL)
    .filter((k) => (hU[k]?.casos ?? 0) > 0)
    .map((k) => ({
      chave: k,
      nome: NOMES_HOSPITAL[k],
      ter: pct(hU[k].ter),
      terAntes: pct(hP[k]?.ter),
      ini: pct(hU[k].ini),
      abaixo: pct(hU[k].ter) != null && pct(hU[k].ter) < META.ter,
    }))

  // 7 · o que falta (só o que está abaixo da meta)
  const falta = []
  if (pct(ultima.tot) != null && pct(ultima.tot) < META.tot) {
    const faltam = Math.round((100 - pct(ultima.tot)) / 10)
    falta.push({ valor: pctFmt(ultima.tot), rotulo: 'turnos com tempo total', detalhe: `meta ${META.tot}% · falta em ${faltam} de cada 10` })
  }
  if (pct(ultima.terProprio) != null && pct(ultima.terProprio) < META.ter) {
    falta.push({ valor: pctFmt(ultima.terProprio), rotulo: 'término pelo próprio anestesiologista', detalhe: `na sala chega a ${pctFmt(ultima.ter)}` })
  }
  const pior = hospitais.filter((h) => h.abaixo).sort((a, b) => a.ter - b.ter)[0]
  if (pior) {
    const outros = hospitais.filter((h) => h.chave !== pior.chave && h.ter != null)
    const faixa = outros.length
      ? `${outros.map((h) => h.nome).join(' e ')} em ${Math.min(...outros.map((h) => h.ter))}${outros.length > 1 ? `–${Math.max(...outros.map((h) => h.ter))}` : ''}%`
      : `meta ${META.ter}%`
    falta.push({ valor: `${pior.ter}%`, rotulo: `término no ${pior.nome}`, detalhe: faixa })
  }
  const apoio = [
    { nome: 'residentes engajados', r: ev.res?.ultima },
    { nome: 'da enfermagem engajadas', r: ev.enf?.ultima },
  ]
    .filter((x) => x.r && x.r.base > 0 && x.r.engajados / x.r.base < 0.5)
    .sort((a, b) => a.r.engajados / a.r.base - b.r.engajados / b.r.base)[0]
  if (apoio) {
    const semAbrir = apoio.r.base - apoio.r.abriram
    falta.push({
      valor: `${apoio.r.engajados}/${apoio.r.base}`,
      rotulo: apoio.nome,
      detalhe: semAbrir > 0 ? `${semAbrir} não ${semAbrir === 1 ? 'abriu' : 'abriram'} a escala na última semana` : 'abrem, mas marcam pouco',
    })
  }

  return {
    periodo: `${ddmm(primeira.de)} a ${ddmm(ultima.ate)}`,
    semanas: n,
    engajados,
    inclinacao,
    agora,
    evolucao,
    quemMarca,
    cargos,
    hospitais,
    falta: falta.slice(0, 4),
  }
}

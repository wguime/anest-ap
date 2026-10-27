/**
 * escalaAdesaoSemanal — EVOLUÇÃO SEMANAL da adesão à Escala Cirúrgica (página "Evolução da adesão",
 * dono 27/10/2026): as últimas 5 semanas completas, com anestesiologistas, enfermagem e residentes.
 *
 * Funções puras sobre o JSON de `public.escala_adesao_periodo(p_desde, p_ate)` (migration
 * 20260924180000), chamado UMA vez por semana (segunda → domingo). As regras de leitura:
 *
 *  - SEMANAS: as N últimas COMPLETAS, a última terminando no último domingo ≤ `gravado_ate` (o dia
 *    mais recente já gravado pelo cron). Datas como string 'YYYY-MM-DD' e conta em UTC — o
 *    resultado não depende do fuso do aparelho (a suíte roda em America/Sao_Paulo, o CI em UTC).
 *  - ANESTESIOLOGISTA: entra na base da semana quem teve cirurgia própria (casos > 0). Engajado =
 *    índice de uso (`indiceUso` de escalaAdesao.js, a mesma régua do relatório) ≥ `INDICE.ok`;
 *    "baixo" = índice < 30. Na semana, cada razão sem denominador vale 0 (não "não se aplica"):
 *    quem não abriu nenhum dia escalado não ganha o item.
 *  - ENFERMAGEM E RESIDENTES (sem cirurgia própria): base = todas as pessoas do cargo na lista.
 *    Engajado = abriu em ≥ 70% dos dias úteis da semana (arredondado para cima: 4 de 5) E fez 3+
 *    marcações de início/término (`ini_n` + `ter_n`, em qualquer cirurgia). Feriado conta como dia
 *    útil (a RPC conta seg–sex); semana sem dia útil gravado (`uteis` 0) não tem engajado.
 *  - HOSPITAIS: início/término = cirurgias com o horário marcado por QUALQUER um (o critério do
 *    quadro por hospital); tempo total = turnos com o término do turno informado.
 *  - QUEM MARCA: dos toques de início/término da semana, quantos o anestesista deu nas PRÓPRIAS
 *    cirurgias, quantos deu nas dos colegas e quantos vieram dos demais cargos (enfermagem,
 *    residência, secretaria, contas dos hospitais).
 *  - COMPARAÇÃO DE JANELAS: as 4 semanas antes da 1ª do gráfico contra as 4 últimas, só para quem
 *    operou nas duas (mesma chave `${cargo}|${nome}` de `montarPessoas`). Mudança de mais de 5
 *    pontos no índice = melhorou/piorou; até 5 = estável.
 *
 * Percentuais saem crus (0–100, com casas) e `null` quando não há denominador — a UI arredonda.
 */

import { INDICE, META, indiceUso, razao } from '@/lib/escalaAdesao'

/** Índice abaixo do qual o anestesiologista conta como "baixo" na semana. */
export const INDICE_BAIXO = 30
/** Marcações de início/término na semana para enfermagem/residente contar como engajado. */
export const MARCACOES_SEMANA = 3
/** Semanas de cada janela da comparação antes × depois. */
export const SEMANAS_JANELA = 4
/** Mudança no índice (pontos) a partir da qual a pessoa melhorou/piorou. */
export const LIMIAR_MUDANCA = 5

export const HOSPITAIS = ['total', 'hro', 'unimed', 'materno']

// ─── Datas (string 'YYYY-MM-DD', conta em UTC) ───────────────────────────────────────────────

const RE_DATA = /^\d{4}-\d{2}-\d{2}/
const DIA_MS = 864e5
const pad = (n) => String(n).padStart(2, '0')

function paraMs(data) {
  const [a, m, d] = data.slice(0, 10).split('-').map(Number)
  return Date.UTC(a, m - 1, d)
}

function deMs(ms) {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** '2026-10-25' + 1 → '2026-10-26' (negativo volta). */
export function somarDias(data, n) {
  return deMs(paraMs(data) + n * DIA_MS)
}

/** '2026-10-19' → '19/10' (rótulo da semana = a segunda-feira). */
export function rotuloSemana(de) {
  const s = String(de || '')
  return RE_DATA.test(s) ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : ''
}

/**
 * As `n` últimas semanas completas (segunda → domingo), da mais antiga para a mais recente; a
 * última termina no último domingo ≤ `gravadoAte` (o próprio, se for domingo). [] sem data válida.
 */
export function ultimasSemanasCompletas(n, gravadoAte) {
  const g = String(gravadoAte ?? '')
  if (!RE_DATA.test(g) || !(n > 0)) return []
  const diaSemana = new Date(paraMs(g)).getUTCDay() // 0 = domingo
  const domingo = somarDias(g, -diaSemana)
  const semanas = []
  for (let i = n - 1; i >= 0; i--) {
    const ate = somarDias(domingo, -7 * i)
    semanas.push({ de: somarDias(ate, -6), ate })
  }
  return semanas
}

/**
 * Janelas da comparação: `antes` = as `tamanho` semanas imediatamente anteriores à 1ª do gráfico;
 * `depois` = as `tamanho` últimas do gráfico (todas, se o gráfico tiver menos). null sem semanas.
 */
export function janelasComparacao(semanas, tamanho = SEMANAS_JANELA) {
  if (!semanas?.length) return null
  const primeira = semanas[0].de
  const inicioDepois = semanas[Math.max(0, semanas.length - tamanho)].de
  return {
    antes: { de: somarDias(primeira, -7 * tamanho), ate: somarDias(primeira, -1) },
    depois: { de: inicioDepois, ate: semanas[semanas.length - 1].ate },
  }
}

// ─── Uma semana ───────────────────────────────────────────────────────────────────────────────

const num = (v) => Number(v) || 0
/** Razão ×100 para o índice: sem denominador vale 0. */
const pct0 = (n, d) => (num(d) ? (num(n) / num(d)) * 100 : 0)
const soma = (lista, campo) => lista.reduce((s, p) => s + num(p[campo]), 0)
const marcacoes = (p) => num(p.ini_n) + num(p.ter_n)

/** Índice de uso do anestesiologista numa janela (linha de `escala_adesao_periodo`). */
export function indiceAnest(p) {
  return indiceUso({
    abre: pct0(p.dne, p.de),
    ini: pct0(p.ini_eu, p.casos),
    ter: pct0(p.ter_eu, p.casos),
    tp: pct0(p.tp_inf, p.casos),
    tot: pct0(p.tot_eu, p.turnos),
  })
}

/**
 * Porcentagens inteiras que somam 100 (método do maior resto; empate → a que vem antes).
 * null quando o total é 0.
 */
export function porcentagensInteiras(valores) {
  const v = valores.map(num)
  const total = v.reduce((s, x) => s + x, 0)
  if (!total) return null
  const brutos = v.map((x) => (x * 100) / total)
  const inteiros = brutos.map(Math.floor)
  let falta = 100 - inteiros.reduce((s, x) => s + x, 0)
  const ordem = brutos.map((b, i) => ({ i, resto: b - inteiros[i] })).sort((a, b) => b.resto - a.resto || a.i - b.i)
  for (let k = 0; falta > 0; k++, falta--) inteiros[ordem[k % ordem.length].i] += 1
  return inteiros
}

function resumoSemIndice(lista, uteis) {
  const minDias = Math.ceil((META.uso * uteis) / 100) // inteiro: 70% de 5 → 4
  const engajados = uteis > 0
    ? lista.filter((p) => num(p.dnu) >= minDias && marcacoes(p) >= MARCACOES_SEMANA).length
    : 0
  return {
    base: lista.length,
    engajados,
    abriram: lista.filter((p) => num(p.dn) > 0).length,
    diasAbertos: razao(soma(lista, 'dnu'), lista.length * uteis),
    marcacoes: lista.reduce((s, p) => s + marcacoes(p), 0),
    minDias,
  }
}

function linhaHospital(rel, chave) {
  const h = (rel?.hospitais || []).find((x) => x.hospital === chave)
  if (!h) return { casos: 0, ini: null, ter: null, tot: null }
  return {
    casos: num(h.casos),
    ini: razao(num(h.com_ini), num(h.casos)),
    ter: razao(num(h.com_ter), num(h.casos)),
    tot: razao(num(h.com_total), num(h.turnos)),
  }
}

/**
 * Resumo de UMA semana (JSON de `escala_adesao_periodo`):
 * `{ de, ate, uteis, anest, enf, res, engajados, hospitais, quemMarca }` — ver o cabeçalho.
 */
export function resumoSemana(rel) {
  const pessoas = rel?.pessoas || []
  const uteis = num(rel?.uteis)
  const doCargo = (c) => pessoas.filter((p) => p.cargo === c)

  const todosAnest = doCargo('anest')
  const baseAnest = todosAnest.filter((p) => num(p.casos) > 0)
  const indices = baseAnest.map(indiceAnest)
  const anest = {
    base: baseAnest.length,
    engajados: indices.filter((i) => i >= INDICE.ok).length,
    baixo: indices.filter((i) => i < INDICE_BAIXO).length,
    // agregado de quem operou: os mesmos anestesistas da base
    abre: razao(soma(baseAnest, 'dne'), soma(baseAnest, 'de')),
    iniProprio: razao(soma(baseAnest, 'ini_eu'), soma(baseAnest, 'casos')),
    terProprio: razao(soma(baseAnest, 'ter_eu'), soma(baseAnest, 'casos')),
  }
  const enf = resumoSemIndice(doCargo('enf'), uteis)
  const res = resumoSemIndice(doCargo('res'), uteis)

  const proprio = todosAnest.reduce((s, p) => s + num(p.ini_eu) + num(p.ter_eu), 0)
  const colega = Math.max(0, todosAnest.reduce((s, p) => s + marcacoes(p), 0) - proprio)
  const outros = pessoas.filter((p) => p.cargo !== 'anest').reduce((s, p) => s + marcacoes(p), 0)
  const pq = porcentagensInteiras([proprio, colega, outros])

  return {
    de: String(rel?.desde ?? '').slice(0, 10),
    ate: String(rel?.ate ?? '').slice(0, 10),
    uteis,
    anest,
    enf,
    res,
    engajados: {
      total: anest.engajados + enf.engajados + res.engajados,
      base: anest.base + enf.base + res.base,
    },
    hospitais: Object.fromEntries(HOSPITAIS.map((h) => [h, linhaHospital(rel, h)])),
    quemMarca: {
      proprio, colega, outros,
      total: proprio + colega + outros,
      pct: pq ? { proprio: pq[0], colega: pq[1], outros: pq[2] } : null,
    },
  }
}

// ─── Tendência e comparação ───────────────────────────────────────────────────────────────────

/**
 * Inclinação da reta de mínimos quadrados, em unidades por semana (x = posição na lista). Valores
 * null/ausentes ficam fora sem mudar a posição dos outros. null com menos de 2 pontos.
 */
export function inclinacao(valores) {
  const pts = (valores || [])
    .map((y, x) => ({ x, y }))
    .filter((p) => p.y != null && Number.isFinite(Number(p.y)))
    .map((p) => ({ x: p.x, y: Number(p.y) }))
  if (pts.length < 2) return null
  const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length
  const my = pts.reduce((s, p) => s + p.y, 0) / pts.length
  const sxy = pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0)
  const sxx = pts.reduce((s, p) => s + (p.x - mx) ** 2, 0)
  return sxx ? sxy / sxx : null
}

/**
 * Antes × depois por anestesiologista que operou nas duas janelas (casos > 0 em ambas):
 * `{ n, melhoraram, estaveis, pioraram, engajadosAntes, engajadosDepois, viraramEngajados,
 * mantiveram, deixaram }`.
 */
export function compararJanelas(relAntes, relDepois) {
  const chave = (p) => `${p.cargo}|${p.nome}`
  const operou = (p) => p.cargo === 'anest' && num(p.casos) > 0
  const depois = new Map((relDepois?.pessoas || []).filter(operou).map((p) => [chave(p), p]))
  const r = {
    n: 0, melhoraram: 0, estaveis: 0, pioraram: 0,
    engajadosAntes: 0, engajadosDepois: 0, viraramEngajados: 0, mantiveram: 0, deixaram: 0,
  }
  for (const a of (relAntes?.pessoas || []).filter(operou)) {
    const d = depois.get(chave(a))
    if (!d) continue
    const ia = indiceAnest(a)
    const id = indiceAnest(d)
    const engA = ia >= INDICE.ok
    const engD = id >= INDICE.ok
    r.n += 1
    if (id > ia + LIMIAR_MUDANCA) r.melhoraram += 1
    else if (id < ia - LIMIAR_MUDANCA) r.pioraram += 1
    else r.estaveis += 1
    if (engA) r.engajadosAntes += 1
    if (engD) r.engajadosDepois += 1
    if (!engA && engD) r.viraramEngajados += 1
    if (engA && engD) r.mantiveram += 1
    if (engA && !engD) r.deixaram += 1
  }
  return r
}

// ─── O objeto da página ───────────────────────────────────────────────────────────────────────

/** Campos de cada ponto da série (todos por semana). */
const CAMPOS_SERIE = {
  engajadosTotal: (r) => r.engajados.total,
  engajadosAnest: (r) => r.anest.engajados,
  engajadosEnf: (r) => r.enf.engajados,
  engajadosRes: (r) => r.res.engajados,
  baseTotal: (r) => r.engajados.base,
  baseAnest: (r) => r.anest.base,
  baseEnf: (r) => r.enf.base,
  baseRes: (r) => r.res.base,
  anestBaixo: (r) => r.anest.baixo,
  ini: (r) => r.hospitais.total.ini,
  ter: (r) => r.hospitais.total.ter,
  tot: (r) => r.hospitais.total.tot,
  casos: (r) => r.hospitais.total.casos,
  abre: (r) => r.anest.abre,
  iniProprio: (r) => r.anest.iniProprio,
  terProprio: (r) => r.anest.terProprio,
}

/** Séries com inclinação (engajados em pessoas/semana; o resto em pontos percentuais/semana). */
const CAMPOS_INCLINACAO = {
  total: 'engajadosTotal',
  anest: 'engajadosAnest',
  enf: 'engajadosEnf',
  res: 'engajadosRes',
  ini: 'ini',
  ter: 'ter',
  terProprio: 'terProprio',
  tot: 'tot',
  abre: 'abre',
}

/**
 * Tudo o que a página "Evolução da adesão" mostra. `semanas` = JSONs de `escala_adesao_periodo`
 * da mais antiga para a mais recente; `antes`/`depois` = as janelas de `janelasComparacao`.
 * null sem semanas. Formato no retorno (ver o relatório do commit / os testes).
 */
export function montarEvolucao({ semanas, antes, depois } = {}) {
  if (!semanas?.length) return null
  const resumos = semanas.map(resumoSemana)
  const serie = resumos.map((r) => ({
    de: r.de,
    ate: r.ate,
    rotulo: rotuloSemana(r.de),
    ...Object.fromEntries(Object.entries(CAMPOS_SERIE).map(([k, f]) => [k, f(r)])),
  }))
  const coluna = (campo) => serie.map((s) => s[campo])
  const primeira = resumos[0]
  const ultima = resumos[resumos.length - 1]
  const pontas = Object.fromEntries(Object.keys(CAMPOS_SERIE).map((campo) => {
    const p = serie[0][campo]
    const u = serie[serie.length - 1][campo]
    return [campo, { primeiro: p, ultimo: u, delta: p == null || u == null ? null : u - p }]
  }))
  const ponta = (f) => ({ primeira: f(primeira), ultima: f(ultima) })
  return {
    semanas: resumos,
    serie,
    inclinacoes: Object.fromEntries(Object.entries(CAMPOS_INCLINACAO).map(([k, campo]) => [k, inclinacao(coluna(campo))])),
    pontas,
    hospitais: ponta((r) => r.hospitais),
    quemMarca: ponta((r) => r.quemMarca),
    enf: ponta((r) => r.enf),
    res: ponta((r) => r.res),
    janelas: antes && depois ? compararJanelas(antes, depois) : null,
    cirurgias: resumos.reduce((s, r) => s + r.hospitais.total.casos, 0),
    periodo: { de: primeira.de, ate: ultima.ate },
  }
}

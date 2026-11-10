// faixa.mjs — previsão de duração COM FAIXA (P50/P80) e fim do bloco por SIMULAÇÃO (pesquisa 2026-W46, passos 1 e 2).
// Duração: encolhimento em log-minutos, peso n/(n+k), do nível mais geral ao par cirurgião × procedimento
// (hospital → cirurgião → procedimento → procedimento×hospital → cirurgião×procedimento). Onde o mapa traz tempo
// estimado, ele entra como centro com o viés medido por hospital × especialidade, misturado ao histórico (peso w).
// k, w e a largura da faixa (z80) são escolhidos por validação em semanas ANTERIORES à semana prevista.
import { min, med, q, familia, teMin } from './comum.mjs'
import { casos, paresLimpos, cirK, espDe } from './blocos.mjs'
import { girosTodos, giroValido, atrasosTodos, segunda } from './tempo.mjs'
const porId = new Map(casos.map((c) => [c.id, c]))
export const pares = paresLimpos.map((p) => { const c = porId.get(p.id); return { ...p, y: Math.log(p.dur), te: teMin(c.tempo_estimado), esp: espDe(c.procedimento) || '—', procedimento: c.procedimento, sem: segunda(p.data) } }).sort((a, b) => a.data < b.data ? -1 : 1)
const acc = () => ({ n: 0, s: 0, ss: 0 }); const add = (m, k, y) => { if (k == null || k === false) return; let a = m.get(k); if (!a) m.set(k, a = acc()); a.n++; a.s += y; a.ss += y * y }
const mv = (a) => ({ n: a.n, m: a.s / a.n, v: a.n >= 2 ? Math.max(0, (a.ss - a.s * a.s / a.n) / (a.n - 1)) : null })
const chaves = (it) => { const f = it.f ?? familia(it.procedimento); const ck = it.ck ?? it.cir ?? cirK(it.hospital, it.cirurgiao); return { H: it.hospital, C: ck && it.hospital + '|' + ck, F: f, FH: f + '|' + it.hospital, FC: ck && f + '|' + it.hospital + '|' + ck } }
// estatísticas suficientes de um conjunto de pares (independem de k e w)
export function estatisticas(tr) { const N = { H: new Map(), C: new Map(), F: new Map(), FH: new Map(), FC: new Map(), B: new Map(), BH: new Map() }; const G = acc()
  for (const p of tr) { const k = chaves(p); for (const l of ['H', 'C', 'F', 'FH', 'FC']) add(N[l], k[l], p.y); G.n++; G.s += p.y; G.ss += p.y * p.y; if (p.te) { const r = p.y - Math.log(p.te); add(N.B, p.hospital + '|' + p.esp, r); add(N.BH, p.hospital, r) } }
  return { N, G: G.n ? mv(G) : { n: 0, m: Math.log(80), v: 0.4 }, n: tr.length } }
export const NIVEL = { FC: 'cirurgião × procedimento', FH: 'procedimento × hospital', F: 'procedimento', C: 'cirurgião', H: 'hospital', M: 'tempo do mapa' }
export function preverFaixa(it, E, { k = 4, w = 0.5, z80 = 0.8416 } = {}) { const ks = chaves(it); let m = E.G.m, v = E.G.v ?? 0.4, nivel = 'H'
  const sobe = (l) => { const a = ks[l] ? E.N[l].get(ks[l]) : null; if (!a) return 0; const e = mv(a); m = (e.n * e.m + k * m) / (e.n + k); if (e.v != null) v = ((e.n - 1) * e.v + k * v) / (e.n - 1 + k); if (e.n >= 3) nivel = l; return e.n }
  sobe('H'); sobe('C'); sobe('F'); sobe('FH')
  const te = it.te ?? teMin(it.tempo_estimado); let usouMapa = false
  if (te && w > 0) { const b = E.N.B.get(it.hospital + '|' + (it.esp ?? espDe(it.procedimento) ?? '—')), bh = E.N.BH.get(it.hospital); if (bh && bh.n >= 20) { const eh = mv(bh); let vies = eh.m; if (b && b.n >= 1) { const eb = mv(b); vies = (eb.n * eb.m + 8 * eh.m) / (eb.n + 8) } m = w * (Math.log(te) + vies) + (1 - w) * m; v = w * (eh.v ?? v) + (1 - w) * v; usouMapa = true; if (nivel !== 'FH' || w >= 0.5) nivel = 'M' } }
  const nPar = sobe('FC'); const sd = Math.sqrt(Math.max(v, 0.01))
  return { m, sd, p50: Math.exp(m), p80: Math.exp(m + z80 * sd), sdEf: sd * z80 / 0.8416, nPar, nivel, usouMapa, baixa: nPar < 3 && !usouMapa && nivel !== 'FH' } }
// ---- validação rolante: cada semana prevista só com as anteriores, para toda a grade (k, w)
const KS = [1, 2, 4, 8, 16], WS = [0, 0.25, 0.5, 0.75, 1]; export const GRADE = KS.flatMap((k) => WS.map((w) => ({ k, w })))
const semanas = [...new Set(pares.map((p) => p.sem))].sort(); const estSem = new Map()
export const estAte = (corte) => { if (!estSem.has(corte)) estSem.set(corte, estatisticas(pares.filter((p) => p.data < corte))); return estSem.get(corte) }
let _rol = null
function rolante() { if (_rol) return _rol; _rol = new Map() // semana → [{p, pred[cfg]}]
  for (const s of semanas) { const E = estAte(s); if (E.n < 300) continue; _rol.set(s, pares.filter((p) => p.sem === s).map((p) => ({ p, pred: GRADE.map((g) => { const r = preverFaixa(p, E, g); return [r.m, r.sd] }) }))) } return _rol }
const cfgCache = new Map()
// configuração para prever a semana `corte`: a melhor nas semanas já previstas ANTES dela
export function configurar(corte) { if (cfgCache.has(corte)) return cfgCache.get(corte); const R = rolante(); const val = [...R].filter(([s]) => s < corte).flatMap(([, l]) => l)
  let cfg = { k: 4, w: 0.5, z80: 0.8416, nVal: val.length }
  if (val.length >= 150) { let best = Infinity, bi = 0; GRADE.forEach((g, i) => { const e = val.reduce((s, x) => s + Math.abs(x.p.y - x.pred[i][0]), 0) / val.length; if (e < best) { best = e; bi = i } }); const z = val.map((x) => (x.p.y - x.pred[bi][0]) / x.pred[bi][1]); cfg = { ...GRADE[bi], z80: q(z, 0.8), nVal: val.length, erroLog: best } }
  cfgCache.set(corte, cfg); return cfg }
const modCache = new Map()
export function modeloFaixa(data) { const corte = segunda(data); if (modCache.has(corte)) return modCache.get(corte); const E = estAte(corte), cfg = configurar(corte); const M = { corte, cfg, n: E.n, prever: (it) => preverFaixa(it, E, cfg) }; modCache.set(corte, M); return M }
// ---- fim do bloco por simulação: atraso do 1º caso + durações + giros, sorteados das distribuições medidas
const rng = (seed) => { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
const normal = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())
const distCache = new Map()
function distribuicoes(corte) { if (distCache.has(corte)) return distCache.get(corte); const g = {}, a = {}; for (const x of girosTodos) if (x.data < corte && giroValido(x)) { (g[x.hospital + '|' + (x.mesmoCir ? 'm' : 'o')] ||= []).push(x.gap); (g[x.hospital] ||= []).push(x.gap) } for (const x of atrasosTodos) if (x.data < corte) (a[x.hospital + '|' + x.turno] ||= []).push(x.atraso); const d = { g, a }; distCache.set(corte, d); return d }
export function simularTurno(t, { N = 1000, semente = 7 } = {}) { const M = modeloFaixa(t.data), D = distribuicoes(M.corte); const r = rng(semente + t.k.length * 131 + Number(t.data.replace(/-/g, '')) % 100000); const t1 = t.turno === 'matutino' ? 780 : 1140, t0 = t.turno === 'matutino' ? 420 : 780
  const pega = (arr, padrao) => arr && arr.length >= 5 ? arr[Math.floor(r() * arr.length)] : padrao; const atr = () => pega(D.a[t.hospital + '|' + t.turno], 15); const giro = (mesmo) => pega(D.g[t.hospital + '|' + (mesmo ? 'm' : 'o')] ?? D.g[t.hospital], 30)
  const out = new Map(); const seqs = []; const porSala = new Map()
  for (const b of t.blocos) { if (b.pos) { out.set(b, { p50: t1, p80: t1, fins: null, minP50: null, baixa: false, pos: true }); continue } const its = b.itens.map((it) => ({ it, b, pr: it.cont ? { m: Math.log(60), sdEf: 0.4, baixa: true, nPar: 0, nivel: 'H' } : M.prever(it), h: min(it.hora) }))
    out.set(b, { fins: new Float64Array(N), baixa: its.some((x) => x.pr.baixa), niveis: its.map((x) => x.pr.nivel), minP50: its.reduce((s, x) => s + Math.exp(x.pr.m), 0) })
    if (b.local === 'cc' || b.local === 'co' || b.local === 'emergencia') { if (!porSala.has(b.sala)) porSala.set(b.sala, []); porSala.get(b.sala).push(...its) } else seqs.push(its) }
  for (const l of porSala.values()) seqs.push(l)
  for (const l of seqs) l.sort((x, y) => (x.h ?? 9999) - (y.h ?? 9999))
  for (let d = 0; d < N; d++) { for (const l of seqs) { let fim = null, ant = null; for (const x of l) { const dur = Math.exp(x.pr.m + x.pr.sdEf * normal(r)); const h = x.h ?? t0; const ini = fim == null ? h + atr() : Math.max(h, fim + giro(x.it.cir && ant && x.it.cir === ant.cir)); fim = ini + dur; ant = x.it; const o = out.get(x.b).fins; if (fim > o[d]) o[d] = fim } } }
  for (const o of out.values()) if (o.fins) { const s = Float64Array.from(o.fins).sort(); o.p50 = s[Math.floor(N * 0.5)]; o.p80 = s[Math.floor(N * 0.8)]; o.p20 = s[Math.floor(N * 0.2)] }
  return out }

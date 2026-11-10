// tempo.mjs — o modelo de TEMPO que a escalação usa: duração por nível, giro de sala, atraso do 1º caso
// e fim previsto do bloco. Tudo calculado só com dado ANTERIOR ao corte pedido (fora da amostra).
import { min, med, q, familia, teMin, sa } from './comum.mjs'
import { casos, paresLimpos, cirK, salaDe } from './blocos.mjs'
const limpo = new Map(paresLimpos.map((p) => [p.id, p]))
const est = (a) => ({ n: a.length, med: med(a), p25: q(a, .25), p75: q(a, .75) })
const agrupa = (lista, kf, vf) => { const m = new Map(); for (const x of lista) { const k = kf(x); if (k == null || k === false) continue; if (!m.has(k)) m.set(k, []); m.get(k).push(vf(x)) } return new Map([...m].map(([k, a]) => [k, est(a)])) }
export const NIVEIS = ['cirurgião × procedimento', 'procedimento × hospital', 'procedimento', 'cirurgião', 'hospital']
export function tabelaTempos(pares) { return { n: pares.length,
  FC: agrupa(pares, (p) => p.ck && p.f + '|' + p.hospital + '|' + p.ck, (p) => p.dur), FH: agrupa(pares, (p) => p.f + '|' + p.hospital, (p) => p.dur), F: agrupa(pares, (p) => p.f, (p) => p.dur),
  C: agrupa(pares, (p) => p.ck && p.hospital + '|' + p.ck, (p) => p.dur), H: agrupa(pares, (p) => p.hospital, (p) => p.dur) } }
// devolve { v, nivel } — nivel 0..4 conforme NIVEIS; 5 = sem dado (80 min)
export function preverNivel(it, Tb, nmin = 3) { const f = familia(it.procedimento); const ck = it.cir ?? cirK(it.hospital, it.cirurgiao)
  const tenta = [[Tb.FC, ck && f + '|' + it.hospital + '|' + ck], [Tb.FH, f + '|' + it.hospital], [Tb.F, f], [Tb.C, ck && it.hospital + '|' + ck], [Tb.H, it.hospital]]
  for (let i = 0; i < tenta.length; i++) { const e = tenta[i][1] ? tenta[i][0].get(tenta[i][1]) : null; if (e && e.n >= (i === 4 ? 1 : nmin)) return { v: e.med, nivel: i, n: e.n } } return { v: 80, nivel: 5, n: 0 } }
// ---- giro de sala: fim real de uma cirurgia → início real da seguinte, mesma sala e dia
const SALA_UNICA = (c) => (c.bloco || 'normal') === 'normal' // CC/CO: uma equipe por vez; IOSC/Exames etc. têm salas paralelas sob o mesmo nome
export const girosTodos = (() => { const g = new Map(); for (const c of casos) { if (!limpo.has(c.id)) continue; const k = c.data + '|' + c.hospital + '|' + salaDe(c.hospital, c.sala); if (!g.has(k)) g.set(k, []); g.get(k).push(c) }
  const out = []; for (const [k, l] of g) { l.sort((a, b) => min(a.ini) - min(b.ini)); for (let i = 1; i < l.length; i++) { const a = l[i - 1], b = l[i]; const gap = min(b.ini) - min(a.ter); const [data, hospital, sala] = k.split('|'); const ca = cirK(hospital, a.cirurgiao), cb = cirK(hospital, b.cirurgiao)
    out.push({ data, hospital, sala, unica: SALA_UNICA(a) && SALA_UNICA(b), local: a.bloco || 'normal', gap, mesmoCir: !!ca && ca === cb, cir: cb, mesmoAnest: a.uid && a.uid === b.uid, turno: b.turno }) } } return out })()
export const giroValido = (x) => x.unica && x.gap >= 0 && x.gap <= 120
// ---- atraso do 1º caso da sala no turno em relação à hora do mapa
export const atrasosTodos = (() => { const g = new Map(); for (const c of casos) { if (!c.turno || min(c.hora) == null || c.cont) continue; const k = c.data + '|' + c.hospital + '|' + c.turno + '|' + salaDe(c.hospital, c.sala); if (!g.has(k) || min(c.hora) < min(g.get(k).hora)) g.set(k, c) }
  const out = []; for (const [k, c] of g) { if (!limpo.has(c.id)) continue; const [data, hospital, turno, sala] = k.split('|'); const at = min(c.ini) - min(c.hora); if (at < -60 || at > 240) continue; out.push({ data, hospital, turno, sala, unica: SALA_UNICA(c), atraso: at, cir: cirK(hospital, c.cirurgiao) }) } return out })()
// ---- parâmetros com dado anterior ao corte
const cacheP = new Map()
export function parametros(corte) { if (cacheP.has(corte)) return cacheP.get(corte); const Tb = tabelaTempos(paresLimpos.filter((p) => p.data < corte)); const gs = girosTodos.filter((x) => x.data < corte && giroValido(x)); const as = atrasosTodos.filter((x) => x.data < corte)
  const P = { corte, Tb, giro: { hosp: agrupa(gs, (x) => x.hospital, (x) => x.gap), hospCir: agrupa(gs, (x) => x.hospital + '|' + (x.mesmoCir ? 'mesmo' : 'outro'), (x) => x.gap), cir: agrupa(gs.filter((x) => x.mesmoCir), (x) => x.hospital + '|' + x.cir, (x) => x.gap) },
    atraso: { ht: agrupa(as, (x) => x.hospital + '|' + x.turno, (x) => x.atraso), cir: agrupa(as, (x) => x.hospital + '|' + x.cir, (x) => x.atraso) } }; cacheP.set(corte, P); return P }
export const segunda = (data) => { const d = new Date(data + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10) }
// ---- fim previsto do bloco: hora do mapa + atraso do 1º caso + durações + giro entre cirurgias
export function fimBloco(b, P, { usarAtraso = true, usarGiro = true, giroFixo = 20, modo = 'modelo' } = {}) { const t1 = b.turno === 'matutino' ? 780 : 1140, t0 = b.turno === 'matutino' ? 420 : 780; if (b.pos) return { fim: t1, min: null }
  const its = [...b.itens].sort((x, y) => (min(x.hora) ?? 9999) - (min(y.hora) ?? 9999)); const h0 = min(its[0].hora) ?? t0
  const at = usarAtraso ? (P.atraso.ht.get(b.hospital + '|' + b.turno)?.med ?? 0) : 0
  let soma = 0; for (let i = 0; i < its.length; i++) { const x = its[i]; const te = teMin(x.tempo_estimado); soma += x.cont ? 60 : modo === 'mapa' ? (te ?? preverNivel(x, P.Tb).v) : preverNivel(x, P.Tb).v
    if (i > 0) { const mesmo = x.cir && x.cir === its[i - 1].cir; const g = usarGiro ? ((mesmo && P.giro.cir.get(b.hospital + '|' + x.cir)?.n >= 5 ? P.giro.cir.get(b.hospital + '|' + x.cir).med : null) ?? P.giro.hospCir.get(b.hospital + '|' + (mesmo ? 'mesmo' : 'outro'))?.med ?? P.giro.hosp.get(b.hospital)?.med ?? giroFixo) : giroFixo; soma += g } }
  return { fim: h0 + at + soma, min: soma } }
// ---- fim dos blocos pela LINHA DO TEMPO DA SALA: em sala de CC/CO a cirurgia seguinte começa quando a
// anterior acaba (+ giro), não na hora impressa. Em local com salas paralelas (IOSC, Exames…) vale o bloco.
export function fimBlocosTurno(t, P, { modo = 'modelo' } = {}) { const out = new Map(); const t1 = t.turno === 'matutino' ? 780 : 1140, t0 = t.turno === 'matutino' ? 420 : 780
  const at = P.atraso.ht.get(t.hospital + '|' + t.turno)?.med ?? 0; const porSala = new Map()
  for (const b of t.blocos) { if (b.pos) { out.set(b, { fim: t1, min: null }); continue } if (b.local !== 'cc' && b.local !== 'co' && b.local !== 'emergencia') { out.set(b, fimBloco(b, P, { modo })); continue } if (!porSala.has(b.sala)) porSala.set(b.sala, []); for (const it of b.itens) porSala.get(b.sala).push({ it, b }) }
  for (const l of porSala.values()) { l.sort((x, y) => (min(x.it.hora) ?? 9999) - (min(y.it.hora) ?? 9999)); let fim = null, ant = null
    for (const { it, b } of l) { const te = teMin(it.tempo_estimado); const dur = it.cont ? 60 : modo === 'mapa' ? (te ?? preverNivel(it, P.Tb).v) : preverNivel(it, P.Tb).v; const h = min(it.hora) ?? t0; let ini
      if (fim == null) ini = h + at; else { const mesmo = it.cir && it.cir === ant.cir; const g = (mesmo && P.giro.cir.get(t.hospital + '|' + it.cir)?.n >= 5 ? P.giro.cir.get(t.hospital + '|' + it.cir).med : null) ?? P.giro.hospCir.get(t.hospital + '|' + (mesmo ? 'mesmo' : 'outro'))?.med ?? P.giro.hosp.get(t.hospital)?.med ?? 30; ini = Math.max(h, fim + g) }
      fim = ini + dur; ant = it; const o = out.get(b) ?? { fim: 0, min: 0 }; o.fim = Math.max(o.fim, fim); o.min += dur; out.set(b, o) } }
  return out }

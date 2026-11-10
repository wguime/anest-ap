import { ler, min, med, q, r1, familia, generica, tokCir, cirBruto, util, teMin, lotes, hmBRT, sa } from './comum.mjs'
const casos = ler('casos').filter((c) => c.hospital !== 'fds')
const ev = lotes(ler('eventos'))
const evPorCaso = new Map(); for (const e of ev) { if (!evPorCaso.has(e.caso_id)) evPorCaso.set(e.caso_id, []); evPorCaso.get(e.caso_id).push(e) }
const src = (c, para, hm) => { const l = (evPorCaso.get(c.id) || []).filter((e) => e.para === para); if (!l.length) return 'sem_evento'; if (l.some((e) => hmBRT(e.em) === hm && e.tam < 3)) return 'toque'; if (l.some((e) => hmBRT(e.em) === hm)) return 'toque_lote'; return 'mao' }
// ---- cirurgião: agrupamento por hospital (1º token igual e conjunto de tokens contido)
const grafias = new Map()
for (const c of casos) { const b = cirBruto(c.cirurgiao); if (!b) continue; const k = c.hospital + '|' + b; grafias.set(k, (grafias.get(k) || 0) + 1) }
const porHosp = {}
for (const [k, n] of grafias) { const [h, b] = k.split('|'); const t = tokCir(b); if (!t.length) continue; (porHosp[h] ||= []).push({ b, t, n }) }
const canon = new Map()
let nCl = 0
for (const h of Object.keys(porHosp)) {
  const arr = porHosp[h].sort((a, b) => b.t.length - a.t.length || b.n - a.n)
  const cls = []
  for (const g of arr) {
    // candidato: cluster cujo representante (mais tokens) contém todos os tokens de g e 1º token igual
    const cands = cls.filter((cl) => cl.t[0] === g.t[0] && g.t.every((x) => cl.t.includes(x)))
    if (cands.length === 1) { cands[0].m.push(g); cands[0].n += g.n } else if (cands.length === 0 || g.t.length >= 2 && cands.length === 0) cls.push({ t: g.t, m: [g], n: g.n })
    else { /* ambíguo (1º nome com 2+ donos): fica sozinho */ cls.push({ t: g.t, m: [g], n: g.n, amb: true }) }
  }
  for (const cl of cls) { nCl++; for (const g of cl.m) canon.set(h + '|' + g.b, h + '|' + cl.t.join(' ') + (cl.amb ? '?' : '')) }
}
const cirKey = (c) => { const b = cirBruto(c.cirurgiao); return b ? canon.get(c.hospital + '|' + b) || null : null }
console.log('CIRURGIAO grafias brutas (hospital|texto):', grafias.size, '| clusters:', nCl, '| ambiguos:', [...new Set([...canon.values()].filter((v) => v.endsWith('?')))].length)
{ const tot = [...grafias.values()].reduce((a, b) => a + b, 0); const cl = new Map(); for (const [k, n] of grafias) { const v = canon.get(k); if (v) cl.set(v, (cl.get(v) || 0) + n) }
  const s = [...cl.values()].sort((a, b) => b - a); let acc = 0, k80 = 0; for (const n of s) { acc += n; k80++; if (acc >= 0.8 * tot) break }
  console.log(' casos c/ cirurgião:', tot, '| clusters p/ 80% dos casos:', k80, '| clusters n>=10:', s.filter((x) => x >= 10).length, '| n>=30:', s.filter((x) => x >= 30).length) }
// ---- famílias
const fams = new Map(); const textos = new Set()
for (const c of casos) { textos.add(sa(c.procedimento)); const f = familia(c.procedimento); fams.set(f, (fams.get(f) || 0) + 1) }
console.log('PROCEDIMENTO textos distintos:', textos.size, '| familias:', fams.size, '| familias n>=10:', [...fams.values()].filter((x) => x >= 10).length, '| n>=30:', [...fams.values()].filter((x) => x >= 30).length)
// ---- pares
const pares = []
for (const c of casos) {
  if (c.data < '2026-10-02') continue
  const i = min(c.ini), t = min(c.ter); if (i == null || t == null) continue
  const dur = (t - i + 1440) % 1440; if (dur < 5 || dur > 720) continue
  if (c.cont) continue
  const f = familia(c.procedimento); if (generica(f)) continue
  const is = src(c, 'iniciada', c.ini), ts = src(c, 'terminada', c.ter)
  pares.push({ ...c, dur, f, ck: cirKey(c), is, ts, limpo: is !== 'toque_lote' && ts !== 'toque_lote', estrito: (is === 'toque' || is === 'mao') && (ts === 'toque' || ts === 'mao') && c.ini_por === c.uid && c.ter_por === c.uid, te: teMin(c.tempo_estimado) })
}
console.log('PARES 02/10-08/11 plausíveis, sem continuação/genéricas:', pares.length, '| limpos:', pares.filter((p) => p.limpo).length, '| estrito (os 2 pelo próprio anest.):', pares.filter((p) => p.estrito).length, '| com tempo_estimado do mapa:', pares.filter((p) => p.te != null).length)
const porHospLimpo = {}; for (const p of pares.filter((p) => p.limpo)) (porHospLimpo[p.hospital] ||= []).push(p.dur)
console.log(' mediana dur limpos por hospital:', Object.fromEntries(Object.entries(porHospLimpo).map(([h, a]) => [h, `${med(a)} (n=${a.length}, p25 ${q(a, .25)}, p75 ${q(a, .75)})`])))
// ---- backtest
function bt(conj, corte, rot, NMIN = 5) {
  const tr = conj.filter((p) => p.data < corte), te = conj.filter((p) => p.data >= corte)
  const g = (kf) => { const m = new Map(); for (const p of tr) { const k = kf(p); if (k == null) continue; if (!m.has(k)) m.set(k, []); m.get(k).push(p.dur) } const o = new Map(); for (const [k, a] of m) o.set(k, { med: med(a), n: a.length, p75: q(a, .75) }); return o }
  const H = g((p) => p.hospital), F = g((p) => p.f), FH = g((p) => p.f + '|' + p.hospital), C = g((p) => p.ck), FC = g((p) => p.ck ? p.f + '|' + p.ck : null), SL = g((p) => p.hospital + '|' + sa(p.sala))
  const ok = (m, k) => { const v = k == null ? null : m.get(k); return v && v.n >= NMIN ? v.med : null }
  const prs = { hosp: [], fam: [], famh: [], cir: [], famcir: [], sala: [], mapa: [], best: [] }
  let cobF = 0, cobFC = 0, cobC = 0
  const errFam = []
  for (const p of te) {
    const h = H.get(p.hospital)?.med ?? med(tr.map((x) => x.dur))
    const f = ok(F, p.f), fh = ok(FH, p.f + '|' + p.hospital), c = ok(C, p.ck), fc = ok(FC, p.ck ? p.f + '|' + p.ck : null), sl = ok(SL, p.hospital + '|' + sa(p.sala))
    if (f != null) cobF++; if (fc != null) cobFC++; if (c != null) cobC++
    prs.hosp.push(Math.abs(p.dur - h)); prs.fam.push(Math.abs(p.dur - (f ?? c ?? h))); prs.famh.push(Math.abs(p.dur - (fh ?? f ?? c ?? h)))
    prs.cir.push(Math.abs(p.dur - (c ?? h))); prs.famcir.push(Math.abs(p.dur - (fc ?? fh ?? f ?? c ?? h))); prs.sala.push(Math.abs(p.dur - (sl ?? h)))
    prs.mapa.push(Math.abs(p.dur - (p.te ?? h)))
    prs.best.push(Math.abs(p.dur - (fc ?? fh ?? f ?? c ?? sl ?? h)))
    p._pred = fc ?? fh ?? f ?? c ?? sl ?? h
  }
  const linha = (a) => `${r1(med(a))} (≤30min ${(100 * a.filter((x) => x <= 30).length / a.length).toFixed(0)}%, média ${r1(a.reduce((x, y) => x + y, 0) / a.length)})`
  console.log(`\n[${rot}] treino<${corte} n=${tr.length} | teste n=${te.length} | mediana real teste ${med(te.map((p) => p.dur))}`)
  for (const k of Object.keys(prs)) console.log('  MdAE', k.padEnd(7), linha(prs[k]))
  console.log(`  cobertura no teste: família n>=${NMIN} ${(100 * cobF / te.length).toFixed(0)}% · cirurgião ${(100 * cobC / te.length).toFixed(0)}% · fam×cir ${(100 * cobFC / te.length).toFixed(0)}%`)
  // subconjuntos
  const sub = (nome, fn) => { const a = te.filter(fn); if (a.length < 20) return; const e1 = a.map((p) => Math.abs(p.dur - p._pred)), e0 = a.map((p) => Math.abs(p.dur - (H.get(p.hospital)?.med))); console.log(`   · ${nome}: n=${a.length} MdAE cascata ${r1(med(e1))} vs hosp ${r1(med(e0))}`) }
  sub('com fam×cir n>=5', (p) => ok(FC, p.ck ? p.f + '|' + p.ck : null) != null); sub('unimed', (p) => p.hospital === 'unimed'); sub('hro', (p) => p.hospital === 'hro'); sub('dur real<=60', (p) => p.dur <= 60); sub('dur real 61-150', (p) => p.dur > 60 && p.dur <= 150); sub('dur real>150', (p) => p.dur > 150)
  sub('com tempo_estimado mapa', (p) => p.te != null)
  { const a = te.filter((p) => p.te != null); if (a.length >= 20) console.log(`   · mapa (só onde existe) n=${a.length}: MdAE mapa ${r1(med(a.map((p) => Math.abs(p.dur - p.te))))} vs cascata ${r1(med(a.map((p) => Math.abs(p.dur - p._pred))))}`) }
  return te
}
bt(pares, '2026-10-26', 'A todos os pares')
const teB = bt(pares.filter((p) => p.limpo), '2026-10-26', 'B limpos (sem ponta em lote)')
bt(pares.filter((p) => p.estrito), '2026-10-26', 'C estrito (os dois horários pelo próprio anestesista)')
bt(pares.filter((p) => p.limpo), '2026-11-02', 'B limpos, teste só última semana')
bt(pares.filter((p) => p.limpo), '2026-10-26', 'B limpos NMIN=3', 3)
// erro agregado por PESSOA-turno (o que a alocação usa): soma prevista × soma real dos casos da pessoa no turno
{ const g = new Map(); for (const p of teB) { if (!p.uid) continue; const k = p.data + '|' + p.hospital + '|' + p.turno + '|' + p.uid; if (!g.has(k)) g.set(k, []); g.get(k).push(p) }
  const e = [], rel = []; for (const a of g.values()) { const real = a.reduce((s, p) => s + p.dur, 0), pr = a.reduce((s, p) => s + p._pred, 0); e.push(Math.abs(real - pr)); rel.push(Math.abs(real - pr) / real) }
  console.log(`\nSOMA por pessoa-turno (teste B): n=${e.length} MdAE ${r1(med(e))} min | p75 ${r1(q(e, .75))} | erro relativo mediano ${(100 * med(rel)).toFixed(0)}%`) }
// top famílias (limpos)
{ const m = new Map(); for (const p of pares.filter((p) => p.limpo)) { if (!m.has(p.f)) m.set(p.f, []); m.get(p.f).push(p.dur) }
  const top = [...m].filter(([, a]) => a.length >= 20).sort((a, b) => b[1].length - a[1].length).slice(0, 25)
  console.log('\nFamílias com n>=20 limpos:', [...m].filter(([, a]) => a.length >= 20).length, '| n>=10:', [...m].filter(([, a]) => a.length >= 10).length, '| n>=5:', [...m].filter(([, a]) => a.length >= 5).length, 'de', m.size)
  for (const [f, a] of top) console.log('  ', f.padEnd(34), 'n', String(a.length).padStart(3), 'p25', q(a, .25), 'med', med(a), 'p75', q(a, .75), 'IQR/med', r1((q(a, .75) - q(a, .25)) / med(a))) }

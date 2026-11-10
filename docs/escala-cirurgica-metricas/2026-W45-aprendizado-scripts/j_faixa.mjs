// j_faixa.mjs — modelo atual × modelo com faixa (erro e calibração) e fim do bloco: soma × simulação.
import { med, q, r1, min } from './comum.mjs'
import { turnos, spearman } from './blocos.mjs'
import { parametros, segunda, preverNivel, fimBlocosTurno } from './tempo.mjs'
import { pares, modeloFaixa, simularTurno, configurar, NIVEL } from './faixa.mjs'
const INI = process.env.TESTE_INI || '2026-10-19', FIM = process.env.TESTE_FIM || '2099-01-01'; const pc = (a, b) => b ? (100 * a / b).toFixed(0) + '%' : '—'; const media = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null
export function relatorioFaixa({ silencioso = false } = {}) { const out = []; const log = (s) => { out.push(s); if (!silencioso) console.log(s) }
  const te = pares.filter((p) => p.data >= INI && p.data <= FIM); const L = { atual: [], novo: [], cob: [], cobH: {}, porNivel: {}, larg: [] }
  for (const p of te) { const M = modeloFaixa(p.data); if (M.n < 300) continue; const a = preverNivel({ procedimento: p.procedimento, hospital: p.hospital, cir: p.ck }, parametros(segunda(p.data)).Tb).v; const n = M.prever(p)
    L.atual.push(Math.abs(p.dur - a)); L.novo.push(Math.abs(p.dur - n.p50)); const ok = p.dur <= n.p80 ? 1 : 0; L.cob.push(ok); (L.cobH[p.hospital] ||= []).push(ok); const k = n.nivel; (L.porNivel[k] ||= { e: [], c: [], a: [] }); L.porNivel[k].e.push(Math.abs(p.dur - n.p50)); L.porNivel[k].c.push(ok); L.porNivel[k].a.push(Math.abs(p.dur - a)); L.larg.push(n.p80 - n.p50) }
  const cfgs = [...new Set(te.map((p) => segunda(p.data)))].sort().map((s) => { const c = configurar(s); return `${s}: k=${c.k}, peso do mapa=${c.w}, z80=${r1(c.z80 * 100) / 100} (validação n=${c.nVal})` })
  log(`===== DURAÇÃO: modelo atual (mediana com recuo) × modelo com faixa (encolhimento lognormal) — ${INI} em diante, ${L.novo.length} pares limpos, mesmos casos =====`)
  log(' parâmetros escolhidos por semana, só com semanas anteriores: ' + cfgs.join(' | '))
  const lin = (nome, e) => ` ${nome.padEnd(34)} erro mediano ${r1(med(e))} min | erro médio ${r1(media(e))} | até 30 min ${pc(e.filter((x) => x <= 30).length, e.length)}`
  log(lin('modelo atual', L.atual)); log(lin('modelo com faixa (P50)', L.novo))
  log(` CALIBRAÇÃO do P80 (meta 75–85%): geral ${pc(L.cob.reduce((a, b) => a + b, 0), L.cob.length)} | ${Object.entries(L.cobH).map(([h, a]) => `${h} ${pc(a.reduce((x, y) => x + y, 0), a.length)} (n=${a.length})`).join(' · ')} | largura mediana P50→P80: ${r1(med(L.larg))} min`)
  log(' por nível que decidiu o centro (novo): nível | casos | erro novo | erro atual nos mesmos | cobertura do P80')
  for (const [k, o] of Object.entries(L.porNivel).sort((a, b) => b[1].e.length - a[1].e.length)) log(`   ${NIVEL[k].padEnd(26)} | ${pc(o.e.length, L.novo.length).padStart(4)} | ${r1(med(o.e))} | ${r1(med(o.a))} | ${pc(o.c.reduce((a, b) => a + b, 0), o.c.length)}`)
  // ---- fim do bloco
  const ts = turnos.filter((t) => t.hospital !== 'materno' && t.data >= INI && t.data <= FIM); const B = { soma: { e: [], v: [], rho: [] }, sim: { e: [], v: [], rho: [], cob: [], cobH: {}, larg: [] } }; let ultPrev = [0, 0]
  for (const t of ts) { const M = modeloFaixa(t.data); if (M.n < 300) continue; const P = parametros(segunda(t.data)); const fm = fimBlocosTurno(t, P, { modo: 'mapa' }); const S = simularTurno(t); const bs = t.blocos.filter((b) => !b.pos && b.realFim != null && b.donos.length <= 1); if (!bs.length) continue
    for (const b of bs) { const a = fm.get(b).fim, s = S.get(b); B.soma.e.push(Math.abs(a - b.realFim)); B.soma.v.push(a - b.realFim); B.sim.e.push(Math.abs(s.p50 - b.realFim)); B.sim.v.push(s.p50 - b.realFim); const ok = b.realFim <= s.p80 ? 1 : 0; B.sim.cob.push(ok); (B.sim.cobH[t.hospital] ||= []).push(ok); B.sim.larg.push(s.p80 - s.p50) }
    if (bs.length >= 5) { const r1_ = spearman(bs.map((b) => fm.get(b).fim), bs.map((b) => b.realFim)), r2 = spearman(bs.map((b) => S.get(b).p50), bs.map((b) => b.realFim)); if (r1_ != null) B.soma.rho.push(r1_); if (r2 != null) B.sim.rho.push(r2) }
    const todos = t.blocos.filter((b) => !b.pos && b.donos.length <= 1); if (todos.length >= 6 && bs.length >= 0.8 * todos.length) { ultPrev[1]++; const prev = bs.reduce((a, c) => S.get(c).p50 > S.get(a).p50 ? c : a), real = bs.reduce((a, c) => c.realFim > a.realFim ? c : a); if (prev === real) ultPrev[0]++ } }
  log(`\n===== FIM DO BLOCO: soma (v3) × simulação (1.000 sorteios) — ${B.sim.e.length} blocos com fim real =====`)
  const lb = (nome, o) => ` ${nome.padEnd(30)} erro mediano ${r1(med(o.e))} min | viés ${r1(med(o.v))} | até 30 min ${pc(o.e.filter((x) => x <= 30).length, o.e.length)} | ordem prevista × real (ρ mediano) ${r1(med(o.rho) * 100) / 100} (${o.rho.length} turnos)`
  log(lb('soma (v3, linha do tempo da sala)', B.soma)); log(lb('simulação (P50)', B.sim))
  log(` CALIBRAÇÃO do P80 do fim do bloco (meta 75–85%): geral ${pc(B.sim.cob.reduce((a, b) => a + b, 0), B.sim.cob.length)} | ${Object.entries(B.sim.cobH).map(([h, a]) => `${h} ${pc(a.reduce((x, y) => x + y, 0), a.length)} (n=${a.length})`).join(' · ')} | largura mediana P50→P80: ${r1(med(B.sim.larg))} min`)
  log(` o bloco previsto para terminar por último foi de fato o último em ${ultPrev[0]} de ${ultPrev[1]} turnos (${pc(ultPrev[0], ultPrev[1])}) — só turnos com 80%+ dos blocos com fim real`)
  const cob = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null
  return { texto: out.join('\n'), dur: { atual: med(L.atual), novo: med(L.novo), cobP80: cob(L.cob), cobH: Object.fromEntries(Object.entries(L.cobH).map(([h, a]) => [h, cob(a)])), n: L.novo.length }, bloco: { soma: med(B.soma.e), sim: med(B.sim.e), rhoSoma: med(B.soma.rho), rhoSim: med(B.sim.rho), cobP80: cob(B.sim.cob), cobH: Object.fromEntries(Object.entries(B.sim.cobH).map(([h, a]) => [h, cob(a)])), n: B.sim.e.length, ultimo: ultPrev } } }
if (process.argv[1] && process.argv[1].endsWith('j_faixa.mjs')) relatorioFaixa()

// g_simulador.mjs — entrada: blocos do mapa (sem nomes) + rodapé do turno; saída: bloco → pessoa.
// Camadas: (a) rodapé dado; (b) preferências/exclusões aprendidas; (c) escada da posição (quem sai antes
// recebe o bloco que termina antes, com os degraus aprendidos). Atribuição ótima (húngaro).
// Aprende até 18/10; testa 19/10–06/11 nos turnos com plano publicado capturado.
import { med, q, r1 } from './comum.mjs'
import { turnos, nomeP, hhmm, afinidades, DIMS, embaralha } from './blocos.mjs'
const T = turnos.filter((t) => t.hospital !== 'materno')
const pc = (x) => x == null ? '—' : (100 * x).toFixed(0) + '%'
const hungaro = (C) => { const n = C.length, m = C[0].length; const u = Array(n + 1).fill(0), v = Array(m + 1).fill(0), p = Array(m + 1).fill(0), way = Array(m + 1).fill(0)
  for (let i = 1; i <= n; i++) { p[0] = i; let j0 = 0; const minv = Array(m + 1).fill(Infinity), used = Array(m + 1).fill(false)
    do { used[j0] = true; const i0 = p[j0]; let delta = Infinity, j1 = 0; for (let j = 1; j <= m; j++) if (!used[j]) { const cur = C[i0 - 1][j - 1] - u[i0] - v[j]; if (cur < minv[j]) { minv[j] = cur; way[j] = j0 } if (minv[j] < delta) { delta = minv[j]; j1 = j } } for (let j = 0; j <= m; j++) if (used[j]) { u[p[j]] += delta; v[j] -= delta } else minv[j] -= delta; j0 = j1 } while (p[j0] !== 0)
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1 } while (j0) }
  const r = Array(n).fill(-1); for (let j = 1; j <= m; j++) if (p[j]) r[p[j] - 1] = j - 1; return r }
const degrau = (p) => p.papel || (p.idx === 1 ? '2º' : 'Q' + Math.min(5, Math.floor(p.pct * 6)))
const dk = (t, p) => t.hospital + t.turno + degrau(p)
const fimDe = (b, ant) => ant ? (b.prevFimAnt ?? b.prevFim) : b.prevFim
const endPct = (t, ant) => { const bs = t.blocos.filter((b) => b.donos.length === 1); const s = [...bs].sort((a, b) => fimDe(a, ant) - fimDe(b, ant)); const m = new Map(); s.forEach((b, i) => m.set(b, s.length > 1 ? i / (s.length - 1) : 0.5)); return m }
function aprender(ts) {
  const af = afinidades(ts, { perms: 300 }); const ll = new Map(), excl = new Set(), prefs = []
  for (const p of af.pares) { if (p.EF >= 1 || p.O >= 3) ll.set(p.k, Math.log((p.O + 2) / (p.EF + 2))); if (p.EF >= 5 && p.O === 0 && p.pExclF <= 0.005) excl.add(p.k); if (p.O >= 6 && p.O / p.EF >= 2 && p.pPrefF <= 0.004) prefs.push(p) }
  const sem = {}, alvo = {}, rs = {}, sl = {}
  for (const t of ts) { const ep = endPct(t, false); const nB = t.blocos.filter((b) => b.donos.length === 1).length
    for (const p of t.P) { if (!p.uid) continue; const k = dk(t, p); (sem[k] ||= [0, 0])[1]++; if (!p.blocos.length) sem[k][0]++; for (const b of p.blocos) { if (b.donos.length !== 1) continue; (alvo[k] ||= []).push(ep.get(b)); const rk = degrau(p) + '|' + b.salaK; rs[rk] = (rs[rk] || 0) + 1 } }
    for (const b of t.blocos) if (b.donos.length === 1) sl[b.salaK] = (sl[b.salaK] || 0) + 1 }
  const totB = Object.values(sl).reduce((a, b) => a + b, 0); const totR = {}; for (const [k, v] of Object.entries(rs)) { const d = k.split('|')[0]; totR[d] = (totR[d] || 0) + v }
  const llRole = (d, salaK) => Math.log(((rs[d + '|' + salaK] || 0) + 2) / ((totR[d] || 0) * (sl[salaK] || 0) / totB + 2))
  // salas que costumam ir para a MESMA pessoa
  const co = {}; for (const t of ts) { const bs = t.blocos.filter((b) => b.donos.length === 1); for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const k = [bs[i].salaK, bs[j].salaK].sort().join('||'); (co[k] ||= [0, 0])[1]++; if (bs[i].donos[0] === bs[j].donos[0]) co[k][0]++ } }
  const junta = new Set(Object.entries(co).filter(([, [a, b]]) => b >= 8 && a / b >= 0.5).map(([k]) => k))
  const taxa = (a, b) => { const c = co[[a, b].sort().join('||')]; return c && c[1] >= 5 ? c[0] / c[1] : 0 }
  return { taxa, ll, excl, prefs, pSem: (k) => { const s = sem[k]; return s ? (s[0] + 1) / (s[1] + 2) : 0.15 }, alvo: (k, pct) => alvo[k]?.length >= 8 ? alvo[k].reduce((a, b) => a + b, 0) / alvo[k].length : Math.max(0, Math.min(1, pct)), llRole, junta }
}
const feats = (b) => Object.entries(DIMS).map(([d, f]) => { const v = f(b); return v ? d + '|' + v : null }).filter(Boolean)
function simular(t, L, w, { ant = true, usarExcl = true } = {}) {
  const pessoas = t.P.filter((p) => p.uid); const ep = endPct(t, ant)
  let grupos = t.blocos.filter((b) => b.donos.length === 1).map((b) => [b])
  // junta salas que historicamente vão para a mesma pessoa
  let mudou = true; while (mudou) { mudou = false; outer: for (let i = 0; i < grupos.length; i++) for (let j = i + 1; j < grupos.length; j++) if (grupos[i].some((a) => grupos[j].some((b) => L.junta.has([a.salaK, b.salaK].sort().join('||'))))) { grupos[i] = grupos[i].concat(grupos[j]); grupos.splice(j, 1); mudou = true; break outer } }
  // sobram blocos: junta primeiro o par de salas que mais vezes foi para a mesma pessoa; sem histórico, os dois que acabam mais cedo
  while (grupos.length > pessoas.length) { let bi = -1, bj = -1, bt = 0; for (let i = 0; i < grupos.length; i++) for (let j = i + 1; j < grupos.length; j++) { let tx = 0; for (const a of grupos[i]) for (const b of grupos[j]) tx = Math.max(tx, L.taxa ? L.taxa(a.salaK, b.salaK) : 0); if (tx > bt) { bt = tx; bi = i; bj = j } }
    if (bi < 0) { grupos.sort((a, b) => Math.max(...a.map((x) => fimDe(x, ant))) - Math.max(...b.map((x) => fimDe(x, ant)))); bi = 0; bj = 1 }
    grupos[bi] = grupos[bi].concat(grupos[bj]); grupos.splice(bj, 1) }
  const nD = pessoas.length - grupos.length
  const C = pessoas.map((p) => { const k = dk(t, p); const ps = L.pSem(k); const alvo = L.alvo(k, p.pct)
    const linha = grupos.map((g) => { let c = w.d * -Math.log(1 - ps + 0.02); const e = Math.max(...g.map((b) => ep.get(b))); c += w.a * (alvo - e) ** 2; for (const b of g) { for (const f of feats(b)) { const kk = p.uid + '|' + f; c -= w.b * (L.ll.get(kk) || 0); if (usarExcl && L.excl.has(kk)) c += 1000 } c -= w.r * L.llRole(degrau(p), b.salaK) } return c })
    for (let i = 0; i < nD; i++) linha.push(w.d * -Math.log(ps + 0.02)); return linha })
  const r = hungaro(C); const dono = new Map(); pessoas.forEach((p, i) => { const g = grupos[r[i]]; if (g) for (const b of g) dono.set(b, p.uid) })
  return dono
}
const inv = (t, donoDe) => { const fim = new Map(); const ruim = new Set(); for (const b of t.blocos) { if (b.pos || b.donos.length !== 1) continue; const u = donoDe(b); if (!u) continue; if (b.realFim == null) { ruim.add(u); continue } fim.set(u, Math.max(fim.get(u) ?? -1, b.realFim)) } const ps = t.P.filter((p) => p.noRodape && p.uid && fim.has(p.uid) && !ruim.has(p.uid)); let n = 0, tot = 0; for (const a of ps) for (const b of ps) if (a.saida < b.saida) { tot++; if (fim.get(a.uid) > fim.get(b.uid) + 30) n++ } return [n, tot] }
function avaliar(ts, L, w, opt) { const R = { exato: [0, 0], exatoFinal: [0, 0], faixa: [0, 0], semOk: [0, 0], viol: 0, inv: [0, 0] }; const porT = []
  for (const t of ts) { const dono = simular(t, L, w, opt); let ex = 0, nb = 0
    for (const b of t.blocos) { if (b.donos.length !== 1) continue; const s = dono.get(b); nb++; R.exato[1]++; if (s === b.donos[0]) { R.exato[0]++; ex++ } if (b.donoFinal) { R.exatoFinal[1]++; if (s === b.donoFinal) R.exatoFinal[0]++ } const ps = t.porUid.get(s), pp = t.porUid.get(b.donos[0]); R.faixa[1]++; if (ps && pp && Math.abs(ps.saida - pp.saida) <= 1) R.faixa[0]++; for (const f of feats(b)) if (L.excl.has(s + '|' + f)) R.viol++ }
    const comB = new Set(dono.values()); for (const p of t.P.filter((x) => x.uid && x.noRodape)) { R.semOk[1]++; if (comB.has(p.uid) === (p.blocos.length > 0)) R.semOk[0]++ }
    const [a, b2] = inv(t, (b) => dono.get(b)); R.inv[0] += a; R.inv[1] += b2; porT.push({ t, ex: nb ? ex / nb : 0, dono, inv: a }) }
  return { R, porT } }
// ---------- ajuste dos pesos: aprende até 27/09, valida 28/09–18/10 ----------
const pub = T.filter((t) => t.fonte === 'publicado')
const L0 = aprender(T.filter((t) => t.data <= '2026-09-27')); const val = pub.filter((t) => t.data <= '2026-10-18')
let melhor = null; for (const a of [4, 8, 16, 32]) for (const b of [0, 0.5, 1, 2]) for (const r of [0, 0.5, 1]) for (const d of [0.5, 1, 2]) { const { R } = avaliar(val, L0, { a, b, r, d }, { ant: false }); const s = R.exato[0] / R.exato[1]; if (!melhor || s > melhor.s) melhor = { s, w: { a, b, r, d } } }
console.log(`PESOS escolhidos na validação (28/09–18/10, ${val.length} turnos): escada ${melhor.w.a} · afinidade ${melhor.w.b} · papel×sala ${melhor.w.r} · sem-bloco ${melhor.w.d} → concordância exata ${pc(melhor.s)}`)
// ---------- teste ----------
const L = aprender(T.filter((t) => t.data <= '2026-10-18')); const te = pub.filter((t) => t.data >= '2026-10-19')
console.log(`APRENDIDO até 18/10 (${T.filter((t) => t.data <= '2026-10-18').length} turnos): ${L.prefs.length} preferências fortes, ${L.excl.size} exclusões duras, ${L.junta.size} pares de salas que vão juntas`)
console.log(` salas que vão juntas: ${[...L.junta].map((k) => k.replace(/\|\|/g, ' + ')).join(' ; ') || 'nenhuma'}`)
console.log(`\nPLACAR NO TESTE (19/10–06/11, ${te.length} turnos, ${te.reduce((s, t) => s + t.blocos.filter((b) => b.donos.length === 1).length, 0)} blocos)`)
const linha = (nome, R) => console.log(`  ${nome.padEnd(44)} exato×publicado ${pc(R.exato[0] / R.exato[1])} | exato×final ${pc(R.exatoFinal[0] / R.exatoFinal[1])} | mesma faixa (±1) ${pc(R.faixa[0] / R.faixa[1])} | com/sem bloco certo ${pc(R.semOk[0] / R.semOk[1])} | inversões >30min ${pc(R.inv[0] / R.inv[1])} (${R.inv[0]}/${R.inv[1]}) | violações ${R.viol}`)
const w = melhor.w
const cheio = avaliar(te, L, w)
linha('(c) só a escada linear, sem degraus', avaliar(te, { ...L, alvo: (k, pct) => Math.max(0, Math.min(1, pct)), pSem: () => 0.15 }, { a: w.a, b: 0, r: 0, d: 0 }, { usarExcl: false }).R)
linha('(c) escada com degraus + quem fica sem bloco', avaliar(te, L, { ...w, b: 0, r: 0 }, { usarExcl: false }).R)
linha('(c) + papel×sala', avaliar(te, L, { ...w, b: 0 }, { usarExcl: false }).R)
linha('(c) + (b) afinidades, sem exclusão dura', avaliar(te, L, w, { usarExcl: false }).R)
linha('(a)+(b)+(c) completo', cheio.R)
// referências
{ const R = { inv: [0, 0], invF: [0, 0], viol: 0, ex: [0, 0] }; let al = [0, 0], alEx = [0, 0], alFx = [0, 0]
  for (const t of te) { const [a, b] = inv(t, (x) => x.donos[0]); R.inv[0] += a; R.inv[1] += b; const [c, d] = inv(t, (x) => x.donoFinal); R.invF[0] += c; R.invF[1] += d
    for (const b2 of t.blocos) { if (b2.donos.length !== 1) continue; for (const f of feats(b2)) if (L.excl.has(b2.donos[0] + '|' + f)) R.viol++; if (b2.donoFinal) { R.ex[1]++; if (b2.donoFinal === b2.donos[0]) R.ex[0]++ } }
    const bs = t.blocos.filter((x) => x.donos.length === 1); for (let r = 0; r < 100; r++) { const us = embaralha(bs.map((x) => x.donos[0])); const m = new Map(bs.map((x, i) => [x, us[i]])); const [e, f] = inv(t, (x) => m.get(x)); al[0] += e / 100; al[1] += f / 100; bs.forEach((x, i) => { alEx[1]++; if (us[i] === x.donos[0]) alEx[0]++; alFx[1]++; const p1 = t.porUid.get(us[i]), p2 = t.porUid.get(x.donos[0]); if (Math.abs(p1.saida - p2.saida) <= 1) alFx[0]++ }) } }
  console.log(`  ${'PUBLICADO pelo coordenador'.padEnd(44)} exato×final ${pc(R.ex[0] / R.ex[1])} | inversões >30min ${pc(R.inv[0] / R.inv[1])} (${R.inv[0]}/${R.inv[1]}) | violações das exclusões aprendidas: ${R.viol}`)
  console.log(`  ${'FINAL (depois das trocas do dia)'.padEnd(44)} inversões >30min ${pc(R.invF[0] / R.invF[1])} (${R.invF[0]}/${R.invF[1]})`)
  console.log(`  ${'ACASO (mesmos donos embaralhados nos blocos)'.padEnd(44)} exato×publicado ${pc(alEx[0] / alEx[1])} | mesma faixa ${pc(alFx[0] / alFx[1])} | inversões >30min ${pc(al[0] / al[1])}`) }
// por hospital × turno e distribuição por turno
for (const [h, tu] of [['unimed', 'matutino'], ['unimed', 'vespertino'], ['hro', 'matutino'], ['hro', 'vespertino']]) { const ts = te.filter((t) => t.hospital === h && t.turno === tu); linha(`  completo — ${h} ${tu} (${ts.length}t)`, avaliar(ts, L, w).R) }
{ const e = cheio.porT.map((x) => x.ex); console.log(`  concordância exata por turno: mín ${pc(Math.min(...e))} | p25 ${pc(q(e, .25))} | mediana ${pc(med(e))} | p75 ${pc(q(e, .75))} | máx ${pc(Math.max(...e))}`) }
// onde erra: por degrau do dono publicado e por local
{ const g = {}, gl = {}; for (const { t, dono } of cheio.porT) for (const b of t.blocos) { if (b.donos.length !== 1) continue; const p = t.porUid.get(b.donos[0]); const k = degrau(p).replace(/^Q[01]$/, 'sai cedo').replace(/^Q[23]$/, 'meio').replace(/^Q[45]$/, 'sai tarde'); (g[k] ||= [0, 0])[1]++; if (dono.get(b) === b.donos[0]) g[k][0]++; const kl = b.local; (gl[kl] ||= [0, 0])[1]++; if (dono.get(b) === b.donos[0]) gl[kl][0]++ }
  console.log(`  acerto por degrau de quem o coordenador escalou: ${Object.entries(g).map(([k, [a, b]]) => `${k} ${pc(a / b)} (n${b})`).join(' · ')}`)
  console.log(`  acerto por local do bloco: ${Object.entries(gl).filter(([, [, b]]) => b >= 15).sort((a, b) => b[1][0] / b[1][1] - a[1][0] / a[1][1]).map(([k, [a, b]]) => `${k} ${pc(a / b)} (n${b})`).join(' · ')}`)
  // distância em posições entre sugerido e publicado
  const dist = []; for (const { t, dono } of cheio.porT) for (const b of t.blocos) { if (b.donos.length !== 1) continue; const a = t.porUid.get(dono.get(b)), c = t.porUid.get(b.donos[0]); if (a && c) dist.push(Math.abs(a.saida - c.saida)) } console.log(`  distância em posições de saída entre sugerido e publicado: mediana ${med(dist)} | ≤1: ${pc(dist.filter((x) => x <= 1).length / dist.length)} | ≤2: ${pc(dist.filter((x) => x <= 2).length / dist.length)} | ≤3: ${pc(dist.filter((x) => x <= 3).length / dist.length)} | >5: ${pc(dist.filter((x) => x > 5).length / dist.length)}`) }
// 3 turnos lado a lado: melhor, mediano, pior
{ const s = [...cheio.porT].sort((a, b) => a.ex - b.ex); const escolhe = [s[s.length - 1], s[Math.floor(s.length / 2)], s[0]]
  for (const { t, dono, ex } of escolhe) { console.log(`\n--- ${t.data} ${t.hospital.toUpperCase()} ${t.turno} — concordância exata ${pc(ex)} — (nº = ordem de saída; 1 = sai primeiro) ---`); const pos = (u) => { const p = t.porUid.get(u); return p ? `${nomeP(u)} (${p.noRodape ? p.saida + 1 : 'ajuda'})` : '—' }
    console.log('  bloco | cirurgião | cirurgias | fim previsto | fim real | PUBLICADO | SUGERIDO | FINAL')
    for (const b of [...t.blocos].filter((x) => x.donos.length === 1).sort((a, c) => (a.prevFimAnt ?? a.prevFim) - (c.prevFimAnt ?? c.prevFim))) console.log(`  ${b.sala.padEnd(18)} | ${(b.cir || b.esp || b.local).slice(0, 20).padEnd(20)} | ${b.n} | ${hhmm(b.prevFimAnt ?? b.prevFim)} | ${hhmm(b.realFim)} | ${pos(b.donos[0]).padEnd(24)} | ${pos(dono.get(b)).padEnd(24)} ${dono.get(b) === b.donos[0] ? '=' : ' '} | ${b.donoFinal && b.donoFinal !== b.donos[0] ? pos(b.donoFinal) : 'igual'}`)
    const semP = t.P.filter((p) => p.noRodape && p.uid && !p.blocos.length).map((p) => `${nomeP(p.uid)} (${p.saida + 1})`), semS = t.P.filter((p) => p.noRodape && p.uid && ![...dono.values()].includes(p.uid)).map((p) => `${nomeP(p.uid)} (${p.saida + 1})`); console.log(`  sem bloco — publicado: ${semP.join(', ') || 'ninguém'} | sugerido: ${semS.join(', ') || 'ninguém'}`) } }
// tabela (b) aprendida com TODOS os dados (para o relatório)
console.log('\nTABELA (b) — aprendida com todos os turnos (22/07–08/11)')
{ const A = afinidades(T, { perms: 1000 }); const nm = (p) => `${nomeP(p.uid)} | ${p.dim} | ${p.x}`
  const pref = A.pares.filter((p) => p.O >= 6 && p.O / p.EF >= 2 && p.pPrefF <= 0.002).sort((a, b) => b.O / b.EF - a.O / a.EF); const ex = A.pares.filter((p) => p.EF >= 5 && p.O <= 1 && p.pExclF <= 0.005).sort((a, b) => b.EF - a.EF)
  for (const p of pref) console.log(`  PREF | ${nm(p)} | obs ${p.O} | esp ${r1(p.EF)} | x${r1(p.O / p.EF)} | turnos ${p.op} | p ${Math.max(p.pPrefF, 0.001)}`)
  for (const p of ex) console.log(`  EXCL | ${nm(p)} | obs ${p.O} | esp ${r1(p.EF)} | turnos ${p.op} | p ${Math.max(p.pExclF, 0.001)}`) }

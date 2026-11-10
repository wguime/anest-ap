// Plano PUBLICADO (captura alocacao:pub, última publicação antes do início do turno) × real × simulado
import { ler, min, med, q, r1, familia, generica, tokCir, cirBruto, util, teMin, lotes, hmBRT, sa } from './comum.mjs'
const casos = ler('casos').filter((c) => c.hospital !== 'fds'); const escalas = ler('escalas'); const alias = ler('alias'); const cap = ler('captura')
const ev = lotes(ler('eventos')); const evPorCaso = new Map(); for (const e of ev) { if (!evPorCaso.has(e.caso_id)) evPorCaso.set(e.caso_id, []); evPorCaso.get(e.caso_id).push(e) }
const A = new Map(alias.map((a) => [sa(a.apelido), a.user_id]))
const limpaNome = (s) => sa(String(s || '').replace(/\([^)]*\)\s*$/, ''))
const uidDe = (nome) => { const k = limpaNome(nome); if (A.has(k)) return A.get(k); const c = [...A].filter(([a]) => a.startsWith(k + ' ') || k.startsWith(a + ' ')); const us = new Set(c.map((x) => x[1])); return us.size === 1 ? [...us][0] : null }
const escPor = new Map(escalas.map((e) => [e.data + '|' + e.hospital, e]))
const ck = (c) => { const t = tokCir(cirBruto(c.cirurgiao) || ''); return t.length ? c.hospital + '|' + t[0] + (t.length > 1 ? ' ' + t[t.length - 1] : '') : null }
const salaK = (c) => { const s = sa(c.sala); const m = /^SALA \d+/.exec(s); return c.hospital + '|' + (m ? m[0] : s) }
const chave = (x) => [sa(x.sala), (x.hora || '').trim(), sa(x.cirurgiao), sa(x.procedimento)].join('|')
// modelo walk-forward
const pares = casos.filter((c) => c.data >= '2026-10-02' && !c.cont).map((c) => { const i = min(c.ini), t = min(c.ter); if (i == null || t == null) return null; const dur = (t - i + 1440) % 1440; if (dur < 5 || dur > 720) return null; const f = familia(c.procedimento); if (generica(f)) return null; const l = evPorCaso.get(c.id) || []; const lote = l.some((e) => e.tam >= 3 && ((e.para === 'iniciada' && hmBRT(e.em) === c.ini) || (e.para === 'terminada' && hmBRT(e.em) === c.ter))); return lote ? null : { data: c.data, hospital: c.hospital, f, ck: ck(c), dur } }).filter(Boolean)
const modelos = new Map()
const modelo = (data) => { const d = new Date(data + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); const seg = d.toISOString().slice(0, 10); if (modelos.has(seg)) return modelos.get(seg); const tr = pares.filter((p) => p.data < seg); const g = (kf) => { const m = new Map(); for (const p of tr) { const k = kf(p); if (!k) continue; if (!m.has(k)) m.set(k, []); m.get(k).push(p.dur) } return new Map([...m].filter(([, a]) => a.length >= 3).map(([k, a]) => [k, med(a)])) }; const M = { n: tr.length, H: g((p) => p.hospital), F: g((p) => p.f), FH: g((p) => p.f + '|' + p.hospital), C: g((p) => p.ck), FC: g((p) => p.ck && p.f + '|' + p.ck) }; modelos.set(seg, M); return M }
const prever = (c, M) => { const f = familia(c.procedimento); const k = ck(c); return M.FC.get(k && f + '|' + k) ?? M.FH.get(f + '|' + c.hospital) ?? M.F.get(f) ?? teMin(c.tempo_estimado) ?? M.C.get(k) ?? M.H.get(c.hospital) ?? 80 }
// plano publicado por turno
const al = cap.filter((r) => r.tipo === 'alocacao' && r.detalhe?.publicacao && ['unimed', 'hro'].includes(r.hospital) && util(r.data) && r.data >= '2026-10-05')
const porTurno = new Map(); for (const r of al) { const k = r.data + '|' + r.hospital + '|' + r.turno; if (!porTurno.has(k)) porTurno.set(k, []); porTurno.get(k).push(r) }
const finais = new Map(); for (const c of casos) { const k = c.data + '|' + c.hospital + '|' + c.turno; if (!finais.has(k)) finais.set(k, []); finais.get(k).push(c) }
const inv = (saida, fins, margem = 30) => { let n = 0, tot = 0; for (let i = 0; i < saida.length; i++) for (let j = 0; j < saida.length; j++) if (saida[i] < saida[j]) { tot++; if (fins[i] > fins[j] + margem) n++ } return [n, tot] }
const histSala = new Map() // sala|turno → [pct de saída] (acumulado, walk-forward por ordem de data)
const T = []
for (const k of [...porTurno.keys()].sort()) { const [data, hospital, turno] = k.split('|'); const rows = porTurno.get(k)
  const ini = Date.parse(`${data}T${turno === 'matutino' ? '07:00' : '13:00'}:00-03:00`)
  const lotesPub = [...new Set(rows.map((r) => r.em))].sort(); const antes = lotesPub.filter((e) => Date.parse(e) <= ini + 30 * 60e3); const escolhido = antes.length ? antes[antes.length - 1] : lotesPub[0]
  const plano = rows.filter((r) => r.em === escolhido); const fin = finais.get(k) || []
  const porCh = new Map(); for (const c of fin) { const ch = chave(c); if (!porCh.has(ch)) porCh.set(ch, []); porCh.get(ch).push(c) }
  const e = escPor.get(data + '|' + hospital); const o = e?.ordem_liberacao; const rod = (Array.isArray(o) ? (turno === 'matutino' ? o : []) : o?.[turno] || []); if (rod.length < 4) continue
  const rodU = rod.map(uidDe); const n = rod.length
  const P = new Map(); let casados = 0, mudou = 0
  for (const r of plano) { if (!r.uid || r.detalhe?.extra === 'suspensa') continue; const l = porCh.get(chave(r)); const c = l?.length ? l.shift() : null; if (c) { casados++; if (c.uid !== r.uid) mudou++ } if (!P.has(r.uid)) P.set(r.uid, []); P.get(r.uid).push({ r, c }) }
  T.push({ k, data, hospital, turno, plano: plano.length, casados, mudou, nLotes: lotesPub.length, P, rodU, n })
}
{ const tp = T.reduce((s, t) => s + t.plano, 0), tc = T.reduce((s, t) => s + t.casados, 0), tm = T.reduce((s, t) => s + t.mudou, 0)
  console.log(`turnos com plano publicado capturado (05/10–06/11): ${T.length} | casos no plano: ${tp} | casados com o caso final: ${tc} (${(100 * tc / tp).toFixed(0)}%) | dos casados, anestesista final ≠ publicado: ${tm} (${(100 * tm / tc).toFixed(1)}%)`)
  console.log(`publicações por turno: mediana ${med(T.map((t) => t.nLotes))} | turnos republicados: ${T.filter((t) => t.nLotes > 1).length}`) }
const res = { plano_humano: [0, 0], final_humano: [0, 0], sim_prev: [0, 0], sim_hist: [0, 0], sim_combo: [0, 0], aleat: [0, 0] }; const igual = { sim_prev: [0, 0], sim_hist: [0, 0], sim_combo: [0, 0] }; const cmp = []; let nT = 0, nP = 0
const esp = { plano_humano: [], sim_prev: [], sim_combo: [] }
const rank = (a) => { const s = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]); const r = Array(a.length); s.forEach(([, i], k) => r[i] = k); return r }
for (const t of T) { const M = modelo(t.data); const ps = []
  for (const [uid, l] of t.P) { const idx = t.rodU.indexOf(uid); if (idx < 0) continue; const saida = t.n - 1 - idx
    // fim real do PACOTE publicado (quem quer que tenha feito)
    let ok = l.every((x) => x.c && x.c.st === 'terminada' && min(x.c.ter) != null && x.c.ex !== 'passa_tarde'); const real = ok ? Math.max(...l.map((x) => { let v = min(x.c.ter); const i = min(x.c.ini); if (i != null && v < i) v += 1440; return v })) : null
    // fim previsto do pacote
    const porSala = new Map(); for (const x of l) { const s = sa(x.r.sala); if (!porSala.has(s)) porSala.set(s, []); porSala.get(s).push(x.r) }
    let prev = 0; const t0 = t.turno === 'matutino' ? 420 : 780; for (const ls of porSala.values()) { const hs = ls.map((r) => min(r.hora)).filter((x) => x != null); const i0 = hs.length ? Math.min(...hs) : t0; prev = Math.max(prev, i0 + ls.reduce((s, r) => s + (r.detalhe?.continuacao ? 60 : prever({ ...r, hospital: t.hospital }, M)), 0) + 20 * (ls.length - 1)) }
    // prior histórico da sala (percentil de saída médio de quem a recebeu antes)
    const hs = l.map((x) => histSala.get(salaK({ ...x.r, hospital: t.hospital }) + '|' + t.turno)).filter((a) => a && a.length >= 5).map((a) => a.reduce((x, y) => x + y, 0) / a.length); const hist = hs.length ? Math.max(...hs) : null
    ps.push({ uid, saida, pct: saida / (t.n - 1), real, prev, hist, l }) }
  // sim só com quem tem tudo
  const us = ps.filter((p) => p.real != null && p.hist != null)
  if (us.length >= 4 && M.n >= 300 && t.data >= '2026-10-19') { nT++; nP += us.length
    const saida = us.map((p) => p.saida), real = us.map((p) => p.real); const ordPess = us.map((_, i) => i).sort((a, b) => saida[a] - saida[b])
    const sim = (score) => { const ordPac = us.map((_, i) => i).sort((a, b) => score[a] - score[b]); const fins = Array(us.length), quem = Array(us.length); ordPess.forEach((pi, k) => { fins[pi] = real[ordPac[k]]; quem[pi] = ordPac[k] }); return { fins, quem } }
    const add = (k, fins) => { const [a, b] = inv(saida, fins); res[k][0] += a; res[k][1] += b; return a }
    const h = add('plano_humano', real)
    const rp = rank(us.map((p) => p.prev)), rh = rank(us.map((p) => p.hist))
    const s1 = sim(us.map((p) => p.prev)), s2 = sim(us.map((p) => p.hist)), s3 = sim(us.map((_, i) => rp[i] + rh[i]))
    const a1 = add('sim_prev', s1.fins); add('sim_hist', s2.fins); const a3 = add('sim_combo', s3.fins)
    for (const [k, s] of [['sim_prev', s1], ['sim_hist', s2], ['sim_combo', s3]]) { igual[k][0] += s.quem.filter((x, i) => x === i).length; igual[k][1] += us.length }
    let ra = 0; for (let r = 0; r < 200; r++) { const perm = us.map((_, i) => i).sort(() => Math.random() - 0.5); ra += inv(saida, perm.map((i) => real[i]))[0] } res.aleat[0] += ra / 200; res.aleat[1] += inv(saida, real)[1]
    cmp.push([h, a1, a3])
    const espera = (fins) => { let mx = -1, tot = 0; for (const pi of ordPess) { mx = Math.max(mx, fins[pi]); tot += mx - fins[pi] } return tot / us.length }
    esp.plano_humano.push(espera(real)); esp.sim_prev.push(espera(s1.fins)); esp.sim_combo.push(espera(s3.fins)) }
  // atualiza o histórico DEPOIS de usar (walk-forward)
  for (const p of ps) for (const x of p.l) { const k = salaK({ ...x.r, hospital: t.hospital }) + '|' + t.turno; if (!histSala.has(k)) histSala.set(k, []); histSala.get(k).push(p.pct) } }
console.log(`\nSIMULADOR sobre o PLANO PUBLICADO (19/10–06/11): turnos ${nT} | pessoas ${nP}`)
for (const [k, [a, b]] of Object.entries(res)) if (b) console.log(`  ${k.padEnd(13)} pares invertidos >30min: ${r1(a)} de ${b} (${(100 * a / b).toFixed(1)}%)`)
for (const [k, [a, b]] of Object.entries(igual)) console.log(`  ${k}: mesma pessoa no mesmo pacote do plano humano: ${(100 * a / b).toFixed(0)}%`)
console.log(`  por turno — sim_prev melhor/igual/pior que o plano humano: ${cmp.filter((x) => x[1] < x[0]).length}/${cmp.filter((x) => x[1] === x[0]).length}/${cmp.filter((x) => x[1] > x[0]).length} | sim_combo: ${cmp.filter((x) => x[2] < x[0]).length}/${cmp.filter((x) => x[2] === x[0]).length}/${cmp.filter((x) => x[2] > x[0]).length}`)
console.log(`  espera por pessoa atrás da ordem (mediana dos turnos, min): plano humano ${r1(med(esp.plano_humano))} | sim_prev ${r1(med(esp.sim_prev))} | sim_combo ${r1(med(esp.sim_combo))}`)
// bootstrap por turno da diferença (sim_combo − humano) em taxa de inversão
{ const B = 2000; const d = []; for (let b = 0; b < B; b++) { let h = 0, s = 0; for (let i = 0; i < cmp.length; i++) { const x = cmp[Math.floor(Math.random() * cmp.length)]; h += x[0]; s += x[2] } d.push((s - h) / (res.plano_humano[1] / cmp.length * cmp.length)) } console.log(`  diferença sim_combo − humano em pontos percentuais de pares invertidos: IC95% bootstrap por turno [${(100 * q(d, .025)).toFixed(1)}; ${(100 * q(d, .975)).toFixed(1)}]`) }

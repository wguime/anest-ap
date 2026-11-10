import fs from 'fs'
import { ler, R, min, med, q, r1, familia, generica, tokCir, cirBruto, util, teMin, lotes, hmBRT, sa } from './comum.mjs'
const N = await import(`${R}/src/lib/escalaNumerica.js`)
const dados = JSON.parse(fs.readFileSync(`${R}/src/data/escalaNumerica.json`, 'utf8'))
const casos = ler('casos').filter((c) => c.hospital !== 'fds'); const escalas = ler('escalas'); const alias = ler('alias')
const ev = lotes(ler('eventos'))
const evPorCaso = new Map(); for (const e of ev) { if (!evPorCaso.has(e.caso_id)) evPorCaso.set(e.caso_id, []); evPorCaso.get(e.caso_id).push(e) }
const A = new Map(alias.map((a) => [sa(a.apelido), a.user_id]))
const limpaNome = (s) => sa(String(s || '').replace(/\([^)]*\)\s*$/, ''))
const uidDe = (nome) => { const k = limpaNome(nome); if (A.has(k)) return A.get(k); const c = [...A].filter(([a]) => a.startsWith(k + ' ') || k.startsWith(a + ' ')); const us = new Set(c.map((x) => x[1])); return us.size === 1 ? [...us][0] : null }
const spearman = (x, y) => { const rk = (a) => { const s = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]); const r = Array(a.length); let i = 0; while (i < s.length) { let j = i; while (j + 1 < s.length && s[j + 1][0] === s[i][0]) j++; for (let k = i; k <= j; k++) r[s[k][1]] = (i + j) / 2; i = j + 1 } return r }; const a = rk(x), b = rk(y); const n = a.length; const ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n; let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2 } return saa && sbb ? sab / Math.sqrt(saa * sbb) : null }
const escPor = new Map(escalas.map((e) => [e.data + '|' + e.hospital, e]))
const casosPor = new Map(); for (const c of casos) { const k = c.data + '|' + c.hospital + '|' + c.turno; if (!casosPor.has(k)) casosPor.set(k, []); casosPor.get(k).push(c) }
const rodape = (e, turno) => { const o = e?.ordem_liberacao; if (!o) return []; if (Array.isArray(o)) return turno === 'matutino' ? o : []; return o[turno] || [] }
const ajudas = (e, turno) => { const o = e?.ajuda_externa; if (!o) return []; if (Array.isArray(o)) return turno === 'matutino' ? o : []; return (o[turno] || []) }

// ================= PARTE 1: rodapé × numérica =================
{ let turnos = 0, slots = 0, comuns = 0, foraOrdem = 0, sobram = 0, faltam = 0, iguais = 0, soOrdemOk = 0, naoRes = 0
  const cls = { ajuda_marcada: 0, outro_hospital_no_dia: 0, consultorio_no_dia: 0, fora_da_grade_do_dia: 0 }
  let trocaDecl = 0, assum = 0
  for (const e of escalas) { if (!['unimed', 'hro'].includes(e.hospital) || !util(e.data) || e.data < '2026-08-03') continue
    for (const turno of ['matutino', 'vespertino']) { const rod = rodape(e, turno).map(limpaNome).filter(Boolean); if (rod.length < 4) continue
      let b = N.ordemBase(dados, { data: e.data, hospital: e.hospital, turno }); if (!b.ok || !b.posicoes || b.motivo) continue
      const il = N.inserirLouise(dados, { data: e.data, hospital: e.hospital, turno }, b.posicoes)
      const r = N.compararComRodape(il.posicoes, rod)
      turnos++; slots += rod.length; sobram += r.sobramNoRodape.length; faltam += r.faltamNoRodape.length; foraOrdem += r.foraDeOrdem.length; comuns += rod.length - r.sobramNoRodape.length
      if (r.iguais) iguais++; if (!r.foraDeOrdem.length) soOrdemOk++
      const aj = ajudas(e, turno).map(limpaNome)
      const outros = N.HOSPITAIS_NUMERICA.filter((h) => h !== e.hospital).flatMap((h) => (N.ordemBase(dados, { data: e.data, hospital: h, turno }).posicoes || []))
      const cons = b.consultorio || []
      const casa = (lista, nome) => lista.some((p) => String(p.nome).split(' / ').some((n) => N.normNomeNumerica(n) === nome || N.casarNomeComLegenda(n, nome) || N.casarNomeComLegenda(nome, n)))
      for (const s of r.sobramNoRodape) { if (aj.includes(s)) cls.ajuda_marcada++; else if (casa(outros, s)) cls.outro_hospital_no_dia++; else if (casa(cons, s)) cls.consultorio_no_dia++; else cls.fora_da_grade_do_dia++ }
      const lo = e.linha_overrides || {}; for (const [k, v] of Object.entries(lo)) if (k.startsWith(turno + ':')) { if (v?.trocaCom) trocaDecl++; if (v?.assumidaPor) assum++ }
    } }
  console.log('=== RODAPÉ × NUMÉRICA (dia útil, Unimed+HRO, 03/08–06/11, sem férias/pós-plantão — offline) ===')
  console.log(`turnos: ${turnos} | posições no rodapé: ${slots} | na grade do hospital no dia: ${comuns} (${(100 * comuns / slots).toFixed(1)}%) | dessas, fora da ordem relativa: ${foraOrdem} (${(100 * foraOrdem / comuns).toFixed(1)}%)`)
  console.log(`turnos com ordem relativa 100% igual à numérica (entre os comuns): ${soOrdemOk} (${(100 * soOrdemOk / turnos).toFixed(0)}%) | idênticos (sem falta nem sobra): ${iguais}`)
  console.log(`sobram no rodapé (não estão na grade do hospital): ${sobram} (${(sobram / turnos).toFixed(1)}/turno):`, cls)
  console.log(`faltam no rodapé (grade prevê, não veio): ${faltam} (${(faltam / turnos).toFixed(1)}/turno) — férias/licença/pós-plantão/troca, não separável offline`)
  console.log(`overrides no período: trocaCom ${trocaDecl} | assumidaPor ${assum}`) }

// ================= PARTE 2: unidades de alocação =================
// cirurgião canônico simples: 1º + último token
const ck = (c) => { const t = tokCir(cirBruto(c.cirurgiao) || ''); return t.length ? c.hospital + '|' + t[0] + (t.length > 1 ? ' ' + t[t.length - 1] : '') : null }
const salaK = (c) => c.hospital + '|' + sa(c.sala).replace(/\s*-\s*.*/, '')
const turnosU = []
for (const [k, cs] of casosPor) { const [data, hospital, turno] = k.split('|'); if (!['unimed', 'hro'].includes(hospital) || !util(data) || !turno) continue
  const e = escPor.get(data + '|' + hospital); const rod = rodape(e, turno); if (rod.length < 4) continue
  const rodU = rod.map(uidDe); const n = rod.length
  const pess = new Map()
  for (const c of cs) { if (!c.uid || c.ex === 'suspensa') continue; if (!pess.has(c.uid)) pess.set(c.uid, []); pess.get(c.uid).push(c) }
  const P = []
  for (const [uid, l] of pess) { const idx = rodU.indexOf(uid); P.push({ uid, casos: l, idx, saida: idx < 0 ? null : n - 1 - idx /* 0 = 1º a sair */, pct: idx < 0 ? null : (n - 1 - idx) / (n - 1) }) }
  turnosU.push({ data, hospital, turno, e, rod, rodU, P, n })
}
{ const tot = turnosU.reduce((s, t) => s + t.rod.length, 0), res = turnosU.reduce((s, t) => s + t.rodU.filter(Boolean).length, 0); const pc = turnosU.reduce((s, t) => s + t.P.length, 0), pcr = turnosU.reduce((s, t) => s + t.P.filter((p) => p.idx >= 0).length, 0)
  console.log(`\n=== UNIDADES === turnos ${turnosU.length} | nomes de rodapé resolvidos p/ uid: ${(100 * res / tot).toFixed(1)}% | pessoas com caso: ${pc}, das quais no rodapé: ${(100 * pcr / pc).toFixed(1)}%`)
  const semC = turnosU.reduce((s, t) => s + t.rodU.filter((u) => u && !t.P.some((p) => p.uid === u)).length, 0); console.log(`posições do rodapé sem nenhum caso no turno: ${semC} (${(100 * semC / res).toFixed(1)}%)`) }

// ---- 2a. o que a posição de saída acompanha (mapa publicado), por turno
const corr = (nome, f, filtro = () => true) => { const rs = []; for (const t of turnosU.filter(filtro)) { const ps = t.P.filter((p) => p.saida != null && f(p, t) != null); if (ps.length < 4) continue; const r = spearman(ps.map((p) => p.saida), ps.map((p) => f(p, t))); if (r != null) rs.push(r) } console.log(`  ρ(saída × ${nome}): turnos ${rs.length} | mediana ${r1(med(rs) * 10) / 10} | p25 ${r1(q(rs, .25) * 10) / 10} p75 ${r1(q(rs, .75) * 10) / 10} | ρ>0 ${rs.filter((x) => x > 0).length} / ρ<0 ${rs.filter((x) => x < 0).length}`); return rs }
console.log('\n=== 2a. A ORDEM DE SAÍDA ACOMPANHA O QUÊ? (ρ>0 = quem sai antes tem MENOS/termina antes) ===')
const ultHora = (p) => { const h = p.casos.map((c) => min(c.hora)).filter((x) => x != null); return h.length ? Math.max(...h) : null }
const somaTE = (p) => { const h = p.casos.map((c) => teMin(c.tempo_estimado)); return h.every((x) => x != null) && h.length ? h.reduce((a, b) => a + b, 0) : null }
corr('nº de casos', (p) => p.casos.length)
corr('hora agendada do último caso', ultHora)
corr('soma do tempo do mapa', somaTE)
// predição walk-forward por semana
const pares = casos.filter((c) => c.data >= '2026-10-02' && !c.cont).map((c) => { const i = min(c.ini), t = min(c.ter); if (i == null || t == null) return null; const dur = (t - i + 1440) % 1440; if (dur < 5 || dur > 720) return null; const f = familia(c.procedimento); if (generica(f)) return null; const l = evPorCaso.get(c.id) || []; const lote = l.some((e) => e.tam >= 3 && ((e.para === 'iniciada' && hmBRT(e.em) === c.ini) || (e.para === 'terminada' && hmBRT(e.em) === c.ter))); return lote ? null : { data: c.data, hospital: c.hospital, f, ck: ck(c), dur } }).filter(Boolean)
const modelos = new Map()
const modelo = (data) => { const d = new Date(data + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); const seg = d.toISOString().slice(0, 10); if (modelos.has(seg)) return modelos.get(seg); const tr = pares.filter((p) => p.data < seg); const g = (kf) => { const m = new Map(); for (const p of tr) { const k = kf(p); if (!k) continue; if (!m.has(k)) m.set(k, []); m.get(k).push(p.dur) } return new Map([...m].filter(([, a]) => a.length >= 3).map(([k, a]) => [k, med(a)])) }; const M = { n: tr.length, H: g((p) => p.hospital), F: g((p) => p.f), FH: g((p) => p.f + '|' + p.hospital), C: g((p) => p.ck), FC: g((p) => p.ck && p.f + '|' + p.ck) }; modelos.set(seg, M); return M }
const prever = (c, M) => { const f = familia(c.procedimento); const k = ck(c); return M.FC.get(k && f + '|' + k) ?? M.FH.get(f + '|' + c.hospital) ?? M.F.get(f) ?? teMin(c.tempo_estimado) ?? M.C.get(k) ?? M.H.get(c.hospital) ?? 80 }
const fimPrev = (p, t, usarMapa = false) => { const M = modelo(t.data); if (M.n < 300) return null; const porSala = new Map(); for (const c of p.casos) { const s = sa(c.sala); if (!porSala.has(s)) porSala.set(s, []); porSala.get(s).push(c) } let fim = 0; const t0 = t.turno === 'matutino' ? 420 : 780; for (const l of porSala.values()) { const hs = l.map((c) => min(c.hora)).filter((x) => x != null); const ini = hs.length ? Math.min(...hs) : t0; const soma = l.reduce((s, c) => s + (c.cont ? 60 : (usarMapa ? (teMin(c.tempo_estimado) ?? prever(c, M)) : prever(c, M))), 0) + 20 * (l.length - 1); fim = Math.max(fim, ini + soma) } return fim }
const fimReal = (p) => { if (p.casos.some((c) => c.st !== 'terminada' || min(c.ter) == null || c.ex === 'passa_tarde')) return null; const v = p.casos.map((c) => { let x = min(c.ter); const i = min(c.ini); if (i != null && x < i) x += 1440; return x }); return Math.max(...v) }
const libMin = (p, t) => { const l = t.e?.liberacoes?.[t.turno + ':' + p.uid]?.liberadoEm; if (!l) return null; const d = new Date(Date.parse(l) - 3 * 3600e3); return d.getUTCHours() * 60 + d.getUTCMinutes() }
const fimRealLimpo = (p, t) => { const f = fimReal(p); if (f == null) return null; const lb = libMin(p, t); if (lb != null && Math.abs((f % 1440) - lb) <= 2) return null; return f }
const d0510 = (t) => t.data >= '2026-10-05', d1910 = (t) => t.data >= '2026-10-19'
corr('fim PREVISTO (família→mapa→cirurgião, só dado anterior)', (p, t) => fimPrev(p, t), d1910)
corr('fim REAL (último término real da pessoa), 05/10+', fimReal, d0510)
corr('fim REAL, só término NÃO colado (±2min) na liberação', fimRealLimpo, d0510)
corr('fim REAL — Unimed', fimReal, (t) => d0510(t) && t.hospital === 'unimed'); corr('fim REAL — HRO', fimReal, (t) => d0510(t) && t.hospital === 'hro')
corr('fim REAL — manhã', fimReal, (t) => d0510(t) && t.turno === 'matutino'); corr('fim REAL — tarde', fimReal, (t) => d0510(t) && t.turno === 'vespertino')

// ---- 2c. inversões: humano × simulado
console.log('\n=== 2c. SIMULADOR OFFLINE (19/10–06/11): redistribuir os pacotes do turno entre as MESMAS pessoas ===')
const inv = (ordSaida, fins, margem = 30) => { let n = 0, tot = 0; for (let i = 0; i < ordSaida.length; i++) for (let j = 0; j < ordSaida.length; j++) if (ordSaida[i] < ordSaida[j]) { tot++; if (fins[i] > fins[j] + margem) n++ } return [n, tot] }
const res = { humano: [0, 0], sim_prev: [0, 0], sim_mapa: [0, 0], sim_ncasos: [0, 0], sim_ulthora: [0, 0], aleat: [0, 0] }; const igual = { sim_prev: [0, 0], sim_mapa: [0, 0], sim_ulthora: [0, 0] }; let nT = 0, nP = 0; const porTurno = []
const atraso = { humano: [], sim_prev: [], sim_ulthora: [] }
for (const t of turnosU.filter(d1910)) { const ps = t.P.filter((p) => p.saida != null && fimReal(p) != null && fimPrev(p, t) != null); if (ps.length < 4) continue; nT++; nP += ps.length
  const saida = ps.map((p) => p.saida), real = ps.map(fimReal)
  const ordPess = ps.map((_, i) => i).sort((a, b) => saida[a] - saida[b])
  const sim = (score) => { const ordPac = ps.map((_, i) => i).sort((a, b) => score[a] - score[b]); const fins = Array(ps.length), quem = Array(ps.length); ordPess.forEach((pi, k) => { fins[pi] = real[ordPac[k]]; quem[pi] = ordPac[k] }); return { fins, quem } }
  const add = (k, fins) => { const [a, b] = inv(saida, fins); res[k][0] += a; res[k][1] += b; return a }
  const h = add('humano', real)
  const s1 = sim(ps.map((p) => fimPrev(p, t))), s2 = sim(ps.map((p) => fimPrev(p, t, true))), s3 = sim(ps.map((p) => p.casos.length)), s4 = sim(ps.map((p) => ultHora(p) ?? 0))
  const a1 = add('sim_prev', s1.fins); add('sim_mapa', s2.fins); add('sim_ncasos', s3.fins); add('sim_ulthora', s4.fins)
  for (const [k, s] of [['sim_prev', s1], ['sim_mapa', s2], ['sim_ulthora', s4]]) { igual[k][0] += s.quem.filter((x, i) => x === i).length; igual[k][1] += ps.length }
  let ra = 0; for (let r = 0; r < 200; r++) { const perm = ps.map((_, i) => i).sort(() => Math.random() - 0.5); ra += inv(saida, perm.map((i) => real[i]))[0] } res.aleat[0] += ra / 200; res.aleat[1] += inv(saida, real)[1]
  porTurno.push([h, a1])
  // "espera": quanto a fila fica travada — soma, sobre as pessoas, de max(0, fim da pessoa − fim de quem sai depois dela mais cedo)... métrica simples: hora em que cada um PODE sair = max dos fins de quem sai antes ou junto
  const espera = (fins) => { let acc = 0, mx = -1, tot = 0; for (const pi of ordPess) { mx = Math.max(mx, fins[pi]); tot += mx - fins[pi] } return tot / ps.length }
  atraso.humano.push(espera(real)); atraso.sim_prev.push(espera(s1.fins)); atraso.sim_ulthora.push(espera(s4.fins))
}
console.log(`turnos ${nT} | pessoas ${nP}`)
for (const [k, [a, b]] of Object.entries(res)) console.log(`  ${k.padEnd(12)} pares invertidos >30min: ${r1(a)} de ${b} (${(100 * a / b).toFixed(1)}%)`)
for (const [k, [a, b]] of Object.entries(igual)) console.log(`  ${k}: mesma pessoa no mesmo pacote que o humano: ${(100 * a / b).toFixed(0)}%`)
console.log(`  turnos em que sim_prev < humano: ${porTurno.filter(([h, s]) => s < h).length} | igual: ${porTurno.filter(([h, s]) => s === h).length} | pior: ${porTurno.filter(([h, s]) => s > h).length}`)
console.log(`  espera média por pessoa travada atrás da ordem (min): humano ${r1(med(atraso.humano))} | sim_prev ${r1(med(atraso.sim_prev))} | sim_ulthora ${r1(med(atraso.sim_ulthora))} (medianas por turno)`)

// ---- 2b. afinidades (22/07–08/11): cirurgião×anestesista, sala×anestesista, sala×posição de saída
console.log('\n=== 2b. PADRÕES DA ESCOLHA LIVRE (permutação dentro do turno, 300×) ===')
const unid = [] // (turno, sala) → anest dominante, cirurgião dominante
turnosU.forEach((t, ti) => { const g = new Map(); for (const p of t.P) for (const c of p.casos) { const k = salaK(c) + '|' + p.uid; if (!g.has(k)) g.set(k, { ti, uid: p.uid, sala: salaK(c), cirs: [], pct: p.pct, res: 0, n: 0 }); const u = g.get(k); u.cirs.push(ck(c)); u.n++; if (c.res) u.res++ } for (const u of g.values()) { const f = {}; for (const c of u.cirs) if (c) f[c] = (f[c] || 0) + 1; u.cir = Object.entries(f).sort((a, b) => b[1] - a[1])[0]?.[0] || null; unid.push(u) } })
const topShare = (chave, uidDeU) => { const m = new Map(); unid.forEach((u, i) => { const k = chave(u); if (!k) return; if (!m.has(k)) m.set(k, {}); const o = m.get(k); const a = uidDeU[i]; o[a] = (o[a] || 0) + 1 }); const v = []; for (const o of m.values()) { const n = Object.values(o).reduce((a, b) => a + b, 0); if (n >= 10) v.push(Math.max(...Object.values(o)) / n) } return v }
const real = unid.map((u) => u.uid)
const perm = () => { const out = Array(unid.length); const porT = new Map(); unid.forEach((u, i) => { if (!porT.has(u.ti)) porT.set(u.ti, []); porT.get(u.ti).push(i) }); for (const idx of porT.values()) { const us = idx.map((i) => unid[i].uid).sort(() => Math.random() - 0.5); idx.forEach((i, k) => out[i] = us[k]) } return out }
for (const [nome, chave] of [['cirurgião × anestesista', (u) => u.cir], ['sala × anestesista', (u) => u.sala], ['sala×turno × anestesista', (u) => u.sala + '|' + turnosU[u.ti].turno]]) { const obs = topShare(chave, real); const nulo = []; for (let r = 0; r < 300; r++) nulo.push(...topShare(chave, perm())); const mo = obs.reduce((a, b) => a + b, 0) / obs.length, mn = nulo.reduce((a, b) => a + b, 0) / nulo.length; const p95 = q(nulo, .95)
  console.log(`  ${nome}: grupos n>=10: ${obs.length} | participação do anestesista mais frequente: observado ${(100 * mo).toFixed(0)}% × acaso ${(100 * mn).toFixed(0)}% | grupos acima do p95 do acaso (${(100 * p95).toFixed(0)}%): ${obs.filter((x) => x > p95).length}`) }
// sala → percentil de saída (η²)
{ const us = unid.filter((u) => u.pct != null); const g = new Map(); for (const u of us) { const k = u.sala + '|' + turnosU[u.ti].turno; if (!g.has(k)) g.set(k, []); g.get(k).push(u.pct) } const m = us.reduce((s, u) => s + u.pct, 0) / us.length; let sst = 0, ssb = 0; for (const u of us) sst += (u.pct - m) ** 2; for (const a of g.values()) { const ma = a.reduce((x, y) => x + y, 0) / a.length; ssb += a.length * (ma - m) ** 2 }
  // nulo de η² por permutação do pct dentro do turno
  const k = g.size, n = us.length; const eta = ssb / sst; const etaAdj = 1 - (1 - eta) * (n - 1) / (n - k)
  console.log(`  sala×turno → posição de saída de quem a recebe: η² ${(100 * eta).toFixed(0)}% (ajustado ${(100 * etaAdj).toFixed(0)}%) com ${k} salas, n=${n}`)
  const ex = [...g].filter(([, a]) => a.length >= 25).map(([k, a]) => [k.replace(/^[^|]+\|/, '').slice(0, 26), a.length, r1(a.reduce((x, y) => x + y, 0) / a.length * 100)]).sort((a, b) => a[2] - b[2]); console.log('   salas (n>=25) por percentil médio de saída (0 = 1º a sair, 100 = último):'); console.log('    mais cedo:', ex.slice(0, 5).map((x) => `${x[0]} ${x[2]}% (n${x[1]})`).join(' · ')); console.log('    mais tarde:', ex.slice(-5).map((x) => `${x[0]} ${x[2]}% (n${x[1]})`).join(' · ')) }
{ const us = unid.filter((u) => u.pct != null && u.cir); const g = new Map(); for (const u of us) { if (!g.has(u.cir)) g.set(u.cir, []); g.get(u.cir).push(u.pct) } const m = us.reduce((s, u) => s + u.pct, 0) / us.length; let sst = 0, ssb = 0; for (const u of us) sst += (u.pct - m) ** 2; for (const a of g.values()) { const ma = a.reduce((x, y) => x + y, 0) / a.length; ssb += a.length * (ma - m) ** 2 } const eta = ssb / sst, n = us.length, k = g.size
  console.log(`  cirurgião → posição de saída: η² ${(100 * eta).toFixed(0)}% (ajustado ${(100 * (1 - (1 - eta) * (n - 1) / (n - k))).toFixed(0)}%) com ${k} cirurgiões, n=${n}`) }
// plantonista (1º do rodapé com caso) e contraturno (último): concentração de sala
for (const [nome, sel] of [['1º do rodapé (plantonista)', (t) => t.rodU[0]], ['último do rodapé (contraturno)', (t) => t.rodU[t.rodU.length - 1]]]) { const f = {}; let n = 0, sem = 0; turnosU.forEach((t, ti) => { const u = sel(t); const us = unid.filter((x) => x.ti === ti && x.uid === u); if (!us.length) { sem++; return } for (const x of us) { const k = x.sala.replace(/^[^|]+\|/, t.hospital + ':'); f[k] = (f[k] || 0) + 1; n++ } }); const top = Object.entries(f).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k.slice(0, 22)} ${(100 * v / n).toFixed(0)}%`); console.log(`  ${nome}: sem caso em ${sem} de ${turnosU.length} turnos | salas mais frequentes: ${top.join(' · ')}`) }
// residente
{ const c2 = casos.filter((c) => util(c.data) && c.uid); const comRes = c2.filter((c) => c.res); console.log(`  residente: ${comRes.length} de ${c2.length} casos (${(100 * comRes.length / c2.length).toFixed(1)}%) têm residente registrado`) }
// pessoas por turno / pacotes multi-sala
{ const np = turnosU.map((t) => t.P.length); const multi = turnosU.reduce((s, t) => s + t.P.filter((p) => new Set(p.casos.map((c) => sa(c.sala))).size > 1).length, 0), tp = np.reduce((a, b) => a + b, 0); console.log(`  pessoas com caso por turno: mediana ${med(np)} | pacotes com 2+ salas: ${(100 * multi / tp).toFixed(0)}%`) }

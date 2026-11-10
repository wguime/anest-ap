// f_relacoes.mjs — todas as relações da escalação, medidas contra o acaso (permutação dentro do turno)
import { med, q, r1, sa, min } from './comum.mjs'
import { turnos, cap, casos, nomeP, hhmm, spearman, afinidades, uidDe, embaralha } from './blocos.mjs'
const T = turnos.filter((t) => t.hospital !== 'materno')
const media = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null
const pc = (x) => x == null ? '—' : (100 * x).toFixed(0) + '%'
console.log(`TURNOS (dia útil, com rodapé): ${turnos.length} | Unimed ${turnos.filter((t) => t.hospital === 'unimed').length} · HRO ${turnos.filter((t) => t.hospital === 'hro').length} · Materno ${turnos.filter((t) => t.hospital === 'materno').length} | plano publicado capturado: ${turnos.filter((t) => t.fonte === 'publicado').length} · reconstruído do final: ${turnos.filter((t) => t.fonte === 'final').length}`)
{ const bs = T.flatMap((t) => t.blocos); const cir = bs.filter((b) => !b.pos)
  console.log(`BLOCOS (Unimed+HRO): ${bs.length} | por turno: mediana ${med(T.map((t) => t.blocos.length))} | posições (SRPA/consultório): ${bs.filter((b) => b.pos).length} | sem anestesista: ${bs.filter((b) => !b.donos.length).length} | dupla A+B: ${bs.filter((b) => b.donos.length > 1).length}`)
  console.log(` cirurgias por bloco: mediana ${med(cir.map((b) => b.n))} (p25 ${q(cir.map((b) => b.n), .25)}, p75 ${q(cir.map((b) => b.n), .75)}) | com soma do mapa: ${pc(cir.filter((b) => b.somaMapa != null).length / cir.length)} | com fim real: ${cir.filter((b) => b.realFim != null).length} | com minutos reais limpos: ${cir.filter((b) => b.realMin != null).length} | pediátrico: ${pc(cir.filter((b) => b.ped).length / cir.length)} | urgência: ${pc(cir.filter((b) => b.urg).length / cir.length)} | atravessa o turno: ${pc(cir.filter((b) => b.atravessa).length / cir.length)} | especialidade identificada: ${pc(cir.filter((b) => b.esp).length / cir.length)} | cirurgião identificado: ${pc(cir.filter((b) => b.cir).length / cir.length)}`)
  const ps = T.flatMap((t) => t.P.filter((p) => p.noRodape)); console.log(` pessoas-turno no rodapé: ${ps.length} | sem bloco: ${pc(ps.filter((p) => !p.blocos.length).length / ps.length)} | 1 bloco: ${pc(ps.filter((p) => p.blocos.length === 1).length / ps.length)} | 2+: ${pc(ps.filter((p) => p.blocos.length > 1).length / ps.length)}`) }

// ===== R1. escada da posição =====
console.log('\n===== R1. POSIÇÃO NO RODAPÉ × CARGA (perfil por degrau) =====')
const degrau = (p) => p.papel || (p.idx === 1 ? '2º do rodapé' : p.pct < 0.25 ? 'sai cedo (Q1)' : p.pct < 0.5 ? 'Q2' : p.pct < 0.75 ? 'Q3' : 'sai tarde (Q4)')
const ORD = ['fora do rodapé', 'ajuda (azul)', 'último (contraturno)', 'sai cedo (Q1)', 'Q2', 'Q3', 'sai tarde (Q4)', '2º do rodapé', 'plantonista (1º)']
const fimP = (p, campo) => { const v = p.blocos.filter((b) => !b.pos).map((b) => b[campo]); return v.length && v.every((x) => x != null) ? Math.max(...v) : null }
const minP = (p, campo) => { const v = p.blocos.filter((b) => !b.pos).map((b) => b[campo]); return v.length && v.every((x) => x != null) ? v.reduce((a, b) => a + b, 0) : null }
for (const [h, tu] of [['unimed', 'matutino'], ['unimed', 'vespertino'], ['hro', 'matutino'], ['hro', 'vespertino']]) { const ts = T.filter((t) => t.hospital === h && t.turno === tu); const g = {}; for (const t of ts) for (const p of t.P) (g[degrau(p)] ||= []).push(p)
  console.log(`\n ${h.toUpperCase()} ${tu} (${ts.length} turnos) — degrau | n | sem bloco | cirurgias (média) | minutos previstos (mediana) | soma mapa (mediana) | fim previsto | fim real (n) | minutos reais`)
  for (const d of ORD) { const a = g[d] || []; if (a.length < 10) continue; const com = a.filter((p) => p.blocos.length); const fr = com.map((p) => fimP(p, 'realFim')).filter((x) => x != null)
    console.log(`  ${d.padEnd(22)} | ${String(a.length).padStart(4)} | ${pc(1 - com.length / a.length).padStart(4)} | ${r1(media(com.map((p) => p.nCasos)))} | ${r1(med(com.map((p) => minP(p, 'prevMin')).filter((x) => x != null)))} | ${r1(med(com.map((p) => minP(p, 'somaMapa')).filter((x) => x != null))) ?? '—'} | ${hhmm(med(com.map((p) => fimP(p, 'prevFim')).filter((x) => x != null)))} | ${hhmm(med(fr))} (${fr.length}) | ${r1(med(com.map((p) => minP(p, 'realMin')).filter((x) => x != null))) ?? '—'}`) } }
// Spearman por turno, vários alvos, por hospital×turno
const rho = (ts, f) => { const rs = []; for (const t of ts) { const ps = t.P.filter((p) => p.noRodape && p.blocos.length && f(p) != null); if (ps.length < 4) continue; const r = spearman(ps.map((p) => p.saida), ps.map(f)); if (r != null) rs.push(r) } return rs.length ? `${r1(med(rs) * 10) / 10} (${rs.length}t, ${rs.filter((x) => x > 0).length}+/${rs.filter((x) => x < 0).length}-)` : '—' }
console.log('\n ρ de Spearman por turno (saída × alvo; mediana, nº de turnos, sinais) — só quem tem bloco')
for (const [nome, ts] of [['Todos', T], ['Unimed manhã', T.filter((t) => t.hospital === 'unimed' && t.turno === 'matutino')], ['Unimed tarde', T.filter((t) => t.hospital === 'unimed' && t.turno === 'vespertino')], ['HRO manhã', T.filter((t) => t.hospital === 'hro' && t.turno === 'matutino')], ['HRO tarde', T.filter((t) => t.hospital === 'hro' && t.turno === 'vespertino')], ['Materno', turnos.filter((t) => t.hospital === 'materno')]])
  console.log(`  ${nome.padEnd(13)} nº cirurgias ${rho(ts, (p) => p.nCasos)} | minutos previstos ${rho(ts, (p) => minP(p, 'prevMin'))} | soma mapa ${rho(ts, (p) => minP(p, 'somaMapa'))} | fim previsto ${rho(ts, (p) => fimP(p, 'prevFim'))} | fim real ${rho(ts, (p) => fimP(p, 'realFim'))} | minutos reais ${rho(ts, (p) => minP(p, 'realMin'))}`)
// monotonia: sem os degraus (tira plantonista, 2º, último, ajuda)
console.log(`  Só o MEIO da fila (sem plantonista, 2º, último, ajuda): nº cirurgias ${rho(T.map((t) => ({ ...t, P: t.P.filter((p) => !p.papel && p.idx !== 1) })), (p) => p.nCasos)} | fim previsto ${rho(T.map((t) => ({ ...t, P: t.P.filter((p) => !p.papel && p.idx !== 1) })), (p) => fimP(p, 'prevFim'))} | fim real ${rho(T.map((t) => ({ ...t, P: t.P.filter((p) => !p.papel && p.idx !== 1) })), (p) => fimP(p, 'realFim'))}`)
// plantonista × local
{ const f = {}; let n = 0; for (const t of T) { const p = t.P.find((x) => x.plant); if (!p) continue; for (const b of p.blocos) { const k = t.hospital + ':' + (b.local === 'cc' ? b.sala : b.local); f[k] = (f[k] || 0) + 1; n++ } } console.log('  blocos do plantonista:', Object.entries(f).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k} ${pc(v / n)}`).join(' · ')) }
{ const f = {}; let n = 0; for (const t of T) for (const p of t.P.filter((x) => x.papel === 'ajuda (azul)' || x.papel === 'fora do rodapé')) for (const b of p.blocos) { const k = t.hospital + ':' + (b.local === 'cc' ? 'cc' : b.local); f[k] = (f[k] || 0) + 1; n++ } console.log('  blocos de ajuda/fora do rodapé:', Object.entries(f).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${pc(v / n)}`).join(' · '), `(n=${n})`) }
{ const f = {}; let n = 0; for (const t of T) for (const p of t.P.filter((x) => x.noRodape && x.nota)) { f[p.nota] = (f[p.nota] || 0) + 1; n++ } console.log('  notas entre parênteses no rodapé:', Object.entries(f).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${v}`).join(' · ')) }

// ===== R2. afinidades =====
console.log('\n===== R2. AFINIDADES (blocos de dono único; 1000 permutações; nulo LIVRE e nulo por FAIXA de saída em terços) =====')
const NOMES = { cir: 'cirurgião', esp: 'especialidade', sala: 'sala', local: 'local', ped: 'pediatria' }
const af = afinidades(T, { perms: 1000 })
console.log(` blocos usados: ${af.nBlocos}`)
for (const g of af.global) console.log(`  concentração global anestesista × ${NOMES[g.dim].padEnd(13)}: z = ${r1(g.zLivre)} (nulo livre) | z = ${r1(g.zFaixa)} (mesma faixa de saída)`)
const rot = (p) => `${nomeP(p.uid)} × ${p.x.replace(/^(unimed|hro)[:|]/, (m) => m.slice(0, -1).toUpperCase() + ' ')}`
for (const d of Object.keys(NOMES)) { const ps = af.pares.filter((p) => p.dim === d)
  const testPref = ps.filter((p) => p.O >= 6), testEx = ps.filter((p) => p.EF >= 5)
  const pref = testPref.filter((p) => p.pPrefF <= 0.001 && p.O / p.EF >= 2).sort((a, b) => b.O / b.EF - a.O / a.EF)
  const ex = testEx.filter((p) => p.O <= 1 && p.pExclF <= 0.005).sort((a, b) => b.EF - a.EF)
  console.log(`\n ANESTESISTA × ${NOMES[d].toUpperCase()} — pares testados p/ preferência (O>=6): ${testPref.length}, falsos positivos esperados a p<=0,001: ${r1(testPref.length * 0.001)} | achados: ${pref.length}`)
  for (const p of pref.slice(0, 14)) console.log(`   + ${rot(p).padEnd(46)} ${p.O}× observado, ${r1(p.EF)} esperado (×${r1(p.O / p.EF)}) em ${p.op} turnos juntos | p<=${Math.max(p.pPrefF, 0.001)}`)
  console.log(`  exclusões — pares testados (esperado>=5): ${testEx.length}, falsos positivos esperados a p<=0,005: ${r1(testEx.length * 0.005)} | achados (0 ou 1 vez): ${ex.length}`)
  for (const p of ex.slice(0, 14)) console.log(`   − ${rot(p).padEnd(46)} ${p.O}× observado, ${r1(p.EF)} esperado em ${p.op} turnos juntos | p<=${Math.max(p.pExclF, 0.001)}`) }
// subgrupos: especialidades/locais que só um subgrupo faz
console.log('\n QUEM FAZ O QUÊ — concentração por especialidade/local (blocos de dono único)')
{ const g = {}; for (const t of T) for (const b of t.blocos) { if (b.donos.length !== 1) continue; for (const [d, v] of [['esp', b.esp], ['local', b.local !== 'cc' ? t.hospital + ':' + b.local : null], ['ped', b.ped && !b.pos ? 'pediátrico' : null]]) { if (!v) continue; ((g[d + '|' + v] ||= {})[b.donos[0]] ||= 0); g[d + '|' + v][b.donos[0]]++ } }
  const todos = new Set(T.flatMap((t) => t.P.filter((p) => p.uid).map((p) => p.uid))).size
  for (const [k, o] of Object.entries(g).sort((a, b) => Object.values(b[1]).reduce((x, y) => x + y, 0) - Object.values(a[1]).reduce((x, y) => x + y, 0))) { const n = Object.values(o).reduce((x, y) => x + y, 0); if (n < 40) continue; const s = Object.entries(o).sort((a, b) => b[1] - a[1]); let acc = 0, k80 = 0; for (const [, v] of s) { acc += v; k80++; if (acc >= 0.8 * n) break }
    console.log(`  ${k.split('|')[1].padEnd(22)} n=${String(n).padStart(4)} | pessoas que fizeram: ${String(s.length).padStart(2)} de ${todos} | 80% dos blocos com ${k80} pessoas | 3 mais: ${s.slice(0, 3).map(([u, v]) => `${nomeP(u)} ${pc(v / n)}`).join(', ')}`) } }
// anestesista × hospital
{ const g = {}; for (const t of T) for (const p of t.P.filter((x) => x.noRodape && x.uid && !x.ajuda)) { (g[p.uid] ||= { unimed: 0, hro: 0 })[t.hospital]++ } const v = Object.entries(g).filter(([, o]) => o.unimed + o.hro >= 30).map(([u, o]) => [u, o.unimed / (o.unimed + o.hro), o.unimed + o.hro]).sort((a, b) => a[1] - b[1]); console.log(`\n ANESTESISTA × HOSPITAL (rodapé, sem azul): ${v.length} pessoas com 30+ turnos | fração Unimed: mín ${pc(v[0][1])} (${nomeP(v[0][0])}), mediana ${pc(med(v.map((x) => x[1])))}, máx ${pc(v[v.length - 1][1])} (${nomeP(v[v.length - 1][0])}) | fora de 35–65%: ${v.filter((x) => x[1] < 0.35 || x[1] > 0.65).map((x) => `${nomeP(x[0])} ${pc(x[1])} (n${x[2]})`).join(', ') || 'ninguém'}`) }

// ===== R3. anestesista × anestesista =====
console.log('\n===== R3. ANESTESISTA × ANESTESISTA =====')
{ const f = {}; let n = 0; for (const t of turnos) for (const b of t.blocos) if (b.donos.length > 1) { const k = b.donos.map(nomeP).sort().join(' + ') + ' @ ' + t.hospital + ' ' + b.sala; f[k] = (f[k] || 0) + 1; n++ } console.log(` blocos em dupla "A + B": ${n} |`, Object.entries(f).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${v}×`).join(' · ')) }

// ===== R6. trocas do dia =====
console.log('\n===== R6. O QUE AS TROCAS DEPOIS DA PUBLICAÇÃO ENSINAM (captura realocacao, 28/09–08/11, dia útil, Unimed+HRO) =====')
{ const porK = new Map(T.map((t) => [t.k, t])); const re = cap.filter((r) => r.tipo === 'realocacao' && !r.detalhe?.publicacao && r.turno && porK.has(r.data + '|' + r.hospital + '|' + r.turno))
  const tot = re.length; const fill = re.filter((r) => !r.detalhe?.deUid && r.detalhe?.paraUid); const limpa = re.filter((r) => r.detalhe?.deUid && !r.detalhe?.paraUid); const tr = re.filter((r) => r.detalhe?.deUid && r.detalhe?.paraUid && r.detalhe.deUid !== r.detalhe.paraUid)
  console.log(` movimentos: ${tot} | preenche caso sem anestesista: ${fill.length} | esvazia: ${limpa.length} | passa de A para B: ${tr.length}`)
  // trocas simétricas no mesmo instante (swap executado)
  const porEm = new Map(); for (const r of tr) { const k = r.em.slice(0, 19) + '|' + r.data + r.hospital; if (!porEm.has(k)) porEm.set(k, []); porEm.get(k).push(r) }
  let swap = 0; for (const l of porEm.values()) { const s = new Set(l.map((r) => r.detalhe.deUid + '>' + r.detalhe.paraUid)); for (const r of l) if (s.has(r.detalhe.paraUid + '>' + r.detalhe.deUid)) swap++ }
  console.log(` dentro de A→B: parte de troca simétrica no mesmo segundo (swap executado): ${swap} (${pc(swap / tr.length)}) | repasse de mão única: ${tr.length - swap}`)
  const ini = (r) => Date.parse(`${r.data}T${r.turno === 'matutino' ? '07:00' : '13:00'}:00-03:00`)
  const antes = tr.filter((r) => Date.parse(r.em) < ini(r)), durante = tr.filter((r) => Date.parse(r.em) >= ini(r))
  console.log(` quando: antes do turno começar ${antes.length} (${pc(antes.length / tr.length)}) | durante/depois ${durante.length} | status do caso no momento: ${JSON.stringify(tr.reduce((o, r) => { o[r.detalhe?.status || '-'] = (o[r.detalhe?.status || '-'] || 0) + 1; return o }, {}))}`)
  const dir = { depois: 0, antes: 0, igual: 0, foraRod: 0 }; const dpct = []; const carga = []; const libDepois = []; const pares = {}; const quemDa = {}, quemRecebe = {}
  for (const r of tr) { const t = porK.get(r.data + '|' + r.hospital + '|' + r.turno); const a = t.porUid.get(r.detalhe.deUid), b = t.porUid.get(r.detalhe.paraUid)
    const kk = [nomeP(r.detalhe.deUid), nomeP(r.detalhe.paraUid)].join(' → '); pares[kk] = (pares[kk] || new Set()).add(r.data + r.turno + r.hospital)
    quemDa[r.detalhe.deUid] = (quemDa[r.detalhe.deUid] || new Set()).add(r.data + r.turno); quemRecebe[r.detalhe.paraUid] = (quemRecebe[r.detalhe.paraUid] || new Set()).add(r.data + r.turno)
    if (!a?.noRodape || !b?.noRodape) { dir.foraRod++; continue } if (b.saida > a.saida) dir.depois++; else if (b.saida < a.saida) dir.antes++; else dir.igual++; dpct.push(b.pct - a.pct); carga.push(b.nCasos - a.nCasos)
    const lib = t.e?.liberacoes?.[t.turno + ':' + a.uid]?.liberadoEm; if (lib) libDepois.push((Date.parse(lib) - Date.parse(r.em)) / 60e3) }
  const nd = dir.depois + dir.antes
  console.log(` DIREÇÃO (os dois no rodapé, n=${nd}): quem recebe sai DEPOIS de quem passa em ${dir.depois} (${pc(dir.depois / nd)}) × sai antes em ${dir.antes} | um dos dois fora do rodapé (ajuda/outro hospital): ${dir.foraRod}`)
  console.log(`   diferença mediana de posição (recebe − passa): ${r1(med(dpct) * 100)} pontos percentuais da fila | quem recebe tinha no plano ${r1(media(carga))} cirurgias a mais que quem passou (mediana ${med(carga)})`)
  console.log(`   quem passou o caso foi liberado depois disso em ${libDepois.filter((x) => x >= 0).length} de ${tr.length - dir.foraRod} | em até 30 min: ${libDepois.filter((x) => x >= 0 && x <= 30).length} | mediana ${r1(med(libDepois.filter((x) => x >= 0)))} min`)
  // só durante o turno, mão única
  { let d = 0, a2 = 0; for (const r of durante) { const t = porK.get(r.data + '|' + r.hospital + '|' + r.turno); const a = t.porUid.get(r.detalhe.deUid), b = t.porUid.get(r.detalhe.paraUid); if (!a?.noRodape || !b?.noRodape) continue; if (b.saida > a.saida) d++; else if (b.saida < a.saida) a2++ } console.log(`   só DURANTE o turno: recebe sai depois ${d} × antes ${a2} (${pc(d / (d + a2))})`) }
  { let d = 0, a2 = 0; for (const r of antes) { const t = porK.get(r.data + '|' + r.hospital + '|' + r.turno); const a = t.porUid.get(r.detalhe.deUid), b = t.porUid.get(r.detalhe.paraUid); if (!a?.noRodape || !b?.noRodape) continue; if (b.saida > a.saida) d++; else if (b.saida < a.saida) a2++ } console.log(`   só ANTES do turno: recebe sai depois ${d} × antes ${a2} (${pc(d / (d + a2))})`) }
  const top = Object.entries(pares).map(([k, s]) => [k, s.size]).sort((a, b) => b[1] - a[1]); console.log(` pares que mais repetem (em turnos distintos): ${top.slice(0, 10).map(([k, v]) => `${k} ${v}`).join(' · ')} | pares distintos: ${top.length}, com 3+ turnos: ${top.filter((x) => x[1] >= 3).length}`)
  const rk = (o) => Object.entries(o).map(([u, s]) => [nomeP(u), s.size]).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${v}`).join(' · '); console.log(` quem mais PASSA (turnos): ${rk(quemDa)}`); console.log(` quem mais RECEBE (turnos): ${rk(quemRecebe)}`)
  // o que muda: tipo de bloco
  const loc = {}; for (const r of tr) { const k = sa(r.sala).replace(/^CC - /, '').replace(/\d+/g, 'n').slice(0, 14); loc[k] = (loc[k] || 0) + 1 } console.log(` onde: ${Object.entries(loc).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${v}`).join(' · ')}`)
  // por turno publicado: % de blocos cujo dono final ≠ publicado
  const pub = T.filter((t) => t.fonte === 'publicado'); let nb = 0, mud = 0; for (const t of pub) for (const b of t.blocos) { if (b.donos.length !== 1 || !b.donoFinal) continue; nb++; if (b.donoFinal !== b.donos[0]) mud++ } console.log(` BLOCOS com dono final ≠ publicado: ${mud} de ${nb} (${pc(mud / nb)}) em ${pub.length} turnos`)
  // a troca melhora a ordem? inversões plano × final por turno já medido em d_pub (20,8% → 13,2%)
}

// ===== R5. carga =====
console.log('\n===== R5. CARGA: repartição e equalização =====')
{ const lin = []; for (const t of T) { const ps = t.P.filter((p) => p.noRodape && p.uid); for (const p of ps) lin.push({ t, p, uid: p.uid, data: t.data, deg: t.hospital + t.turno + degrau(p), n: p.nCasos, m: p.blocos.reduce((s, b) => s + (b.prevMin || 0), 0) }) }
  const mg = {}; for (const l of lin) (mg[l.deg] ||= []).push(l); for (const a of Object.values(mg)) { const mn = media(a.map((x) => x.n)), mm = media(a.map((x) => x.m)); for (const x of a) { x.rn = x.n - mn; x.rm = x.m - mm } }
  console.log(` minutos previstos por pessoa-turno (quem está no rodapé): mediana ${med(lin.map((l) => l.m))} | p25 ${q(lin.map((l) => l.m), .25)} | p75 ${q(lin.map((l) => l.m), .75)} | p90 ${q(lin.map((l) => l.m), .9)} | zero: ${pc(lin.filter((l) => !l.m).length / lin.length)}`)
  // efeito-pessoa (resíduo depois do degrau)
  const pp = {}; for (const l of lin) (pp[l.uid] ||= []).push(l.rm); const ef = Object.entries(pp).filter(([, a]) => a.length >= 40).map(([u, a]) => { const m = media(a); const sd = Math.sqrt(media(a.map((x) => (x - m) ** 2))); return [nomeP(u), m, sd / Math.sqrt(a.length), a.length] }).sort((a, b) => b[1] - a[1])
  console.log(` EFEITO-PESSOA (minutos previstos acima/abaixo do que o degrau explica; 40+ turnos; ± erro-padrão): ${ef.length} pessoas | |t|>3: ${ef.filter((x) => Math.abs(x[1] / x[2]) > 3).length} (ao acaso ~${r1(ef.length * 0.003)})`)
  console.log(`   recebem MAIS: ${ef.slice(0, 6).map((x) => `${x[0]} +${r1(x[1])}±${r1(x[2])} (n${x[3]})`).join(' · ')}`)
  console.log(`   recebem MENOS: ${ef.slice(-6).reverse().map((x) => `${x[0]} ${r1(x[1])}±${r1(x[2])} (n${x[3]})`).join(' · ')}`)
  // equalização: resíduo de hoje × resíduo do dia útil anterior e × soma dos 5 dias anteriores
  const porPD = new Map(); for (const l of lin) { const k = l.uid + '|' + l.data; porPD.set(k, (porPD.get(k) || 0) + l.rm) }
  const dias = [...new Set(lin.map((l) => l.data))].sort(); const idxD = new Map(dias.map((d, i) => [d, i]))
  const xs = [], ys = [], xs5 = [], ys5 = []; for (const [k, v] of porPD) { const [u, d] = k.split('|'); const i = idxD.get(d); if (i > 0) { const a = porPD.get(u + '|' + dias[i - 1]); if (a != null) { xs.push(a); ys.push(v) } } if (i >= 5) { let s = 0, c = 0; for (let j = 1; j <= 5; j++) { const a = porPD.get(u + '|' + dias[i - j]); if (a != null) { s += a; c++ } } if (c >= 3) { xs5.push(s / c); ys5.push(v) } } }
  console.log(` EQUALIZAÇÃO: correlação (Spearman) entre a carga-resíduo de hoje e a do dia útil anterior, mesma pessoa: ${r1(spearman(xs, ys) * 100) / 100} (n=${xs.length}) | × média dos 5 dias anteriores: ${r1(spearman(xs5, ys5) * 100) / 100} (n=${xs5.length})  [negativo = quem pegou mais ontem pega menos hoje]`)
  // plantonista ontem
  const plantOntem = new Set(); for (const t of T) { const p = t.P.find((x) => x.plant); if (p?.uid) plantOntem.add(p.uid + '|' + t.data) }
  const a = [], b = []; for (const l of lin) { const i = idxD.get(l.data); if (i < 1) continue; if (l.p.plant) continue; (plantOntem.has(l.uid + '|' + dias[i - 1]) ? a : b).push(l.rm) }
  const se = (v) => { const m = media(v); return Math.sqrt(media(v.map((x) => (x - m) ** 2)) / v.length) }
  console.log(` quem foi PLANTONISTA do rodapé no dia útil anterior: resíduo médio ${r1(media(a))} ± ${r1(se(a))} min (n=${a.length}) × demais ${r1(media(b))} ± ${r1(se(b))} (n=${b.length})`)
  // desigualdade dentro do turno
  const gini = (v) => { const s = [...v].sort((x, y) => x - y); const n = s.length; const tot = s.reduce((x, y) => x + y, 0); if (!tot) return null; let c = 0; s.forEach((x, i) => c += (2 * (i + 1) - n - 1) * x); return c / (n * tot) }
  const gs = T.map((t) => gini(t.P.filter((p) => p.noRodape && p.blocos.length).map((p) => p.blocos.reduce((s, b2) => s + (b2.prevMin || 0), 0)))).filter((x) => x != null)
  const gsA = []; for (const t of T) { const v = t.P.filter((p) => p.noRodape && p.blocos.length).map((p) => p.blocos.reduce((s, b2) => s + (b2.prevMin || 0), 0)); if (v.length < 4) continue; let s = 0; for (let r = 0; r < 20; r++) { const todos = t.blocos.filter((b2) => b2.donos.length === 1 && !b2.pos).map((b2) => b2.prevMin || 0); const n = v.length; const cg = Array(n).fill(0); embaralha(todos).forEach((m, i) => cg[i % n] += m); s += gini(cg) || 0 } gsA.push(s / 20) }
  console.log(` desigualdade de minutos entre quem tem bloco (Gini por turno): observado ${r1(med(gs) * 100) / 100} × blocos repartidos ao acaso em rodízio ${r1(med(gsA) * 100) / 100}`) }

// ===== R4. residente =====
console.log('\n===== R4. RESIDENTE =====')
{ const cs = casos.filter((c) => c.res && c.uid); const pa = {}, pe = {}, pr = {}; const { espDe } = await import('./blocos.mjs'); for (const c of cs) { pa[nomeP(c.uid)] = (pa[nomeP(c.uid)] || 0) + 1; const e = espDe(c.procedimento) || 'não identificada'; pe[e] = (pe[e] || 0) + 1; pr[nomeP(c.res)] = (pr[nomeP(c.res)] || 0) + 1 }
  const tp = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${v}`).join(' · '); console.log(` casos com residente registrado: ${cs.length} | por anestesista: ${tp(pa)} | por especialidade: ${tp(pe)} | por residente: ${tp(pr)}`) }

// ===== R7. dia da semana e deriva =====
console.log('\n===== R7. DIA DA SEMANA E MUDANÇA NO TEMPO =====')
{ const D = ['', 'seg', 'ter', 'qua', 'qui', 'sex']; for (let d = 1; d <= 5; d++) { const ts = T.filter((t) => new Date(t.data + 'T12:00:00').getDay() === d); console.log(`  ${D[d]}: turnos ${ts.length} | blocos/turno ${r1(media(ts.map((t) => t.blocos.length)))} | pessoas no rodapé ${r1(media(ts.map((t) => t.n)))} | sem bloco ${pc(media(ts.map((t) => t.P.filter((p) => p.noRodape && !p.blocos.length).length / t.n)))} | ρ saída×nº cirurgias ${rho(ts, (p) => p.nCasos)} | ρ saída×fim previsto ${rho(ts, (p) => fimP(p, 'prevFim'))}`) }
  for (const m of ['2026-07', '2026-08', '2026-09', '2026-10', '2026-11']) { const ts = T.filter((t) => t.data.startsWith(m)); if (!ts.length) continue; console.log(`  ${m}: turnos ${ts.length} | blocos/turno ${r1(media(ts.map((t) => t.blocos.length)))} | sem bloco ${pc(media(ts.map((t) => t.P.filter((p) => p.noRodape && !p.blocos.length).length / t.n)))} | 2+ blocos ${pc(media(ts.map((t) => t.P.filter((p) => p.blocos.length > 1).length / t.P.length)))} | ρ saída×nº cirurgias ${rho(ts, (p) => p.nCasos)} | ρ saída×fim previsto ${rho(ts, (p) => fimP(p, 'prevFim'))} | ajudas/turno ${r1(media(ts.map((t) => t.P.filter((p) => p.ajuda).length)))}`) }
  // estabilidade das afinidades: aprender até 18/10, conferir depois
  const tr = T.filter((t) => t.data <= '2026-10-18'), te = T.filter((t) => t.data > '2026-10-18'); const a1 = afinidades(tr, { perms: 600 }), a2 = afinidades(te, { perms: 1 }); const m2 = new Map(a2.pares.map((p) => [p.k, p]))
  for (const d of ['cir', 'esp', 'sala', 'local', 'ped']) { const pref = a1.pares.filter((p) => p.dim === d && p.O >= 6 && p.pPrefF <= 0.002 && p.O / p.EF >= 2); const ex = a1.pares.filter((p) => p.dim === d && p.EF >= 5 && p.O <= 1 && p.pExclF <= 0.005)
    const s = (l) => { let o = 0, e = 0, n = 0; for (const p of l) { const x = m2.get(p.k); if (!x) continue; o += x.O; e += x.E; n++ } return `${n} pares reencontrados: observado ${o} × esperado ${r1(e)}${e ? ` (×${r1(o / e)})` : ''}` }
    console.log(`  estabilidade ${NOMES[d]}: preferências aprendidas até 18/10 = ${pref.length} → de 19/10 a 06/11, ${s(pref)} | exclusões aprendidas = ${ex.length} → ${s(ex)}`) } }

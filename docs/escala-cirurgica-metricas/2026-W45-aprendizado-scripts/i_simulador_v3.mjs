// i_simulador_v3.mjs — simulador com as REGRAS DO DONO (../regras-escalacao.json) e o modelo de tempo (tempo.mjs).
// Entrada: blocos do mapa (sem nomes) + rodapé. Saída: bloco → pessoa. Teste fora da amostra: TESTE_INI..TESTE_FIM
// (o modelo de tempo de cada semana usa só as semanas anteriores; a lista do consultório, só o que houve antes do teste).
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { med, q, r1, sa } from './comum.mjs'
import { turnos, casos, nomeP, hhmm, embaralha } from './blocos.mjs'
import { parametros, segunda, fimBlocosTurno } from './tempo.mjs'
import { simularTurno } from './faixa.mjs'
const INI = process.env.TESTE_INI || '2026-10-19', FIM = process.env.TESTE_FIM || '2099-01-01'
const REGRAS = JSON.parse(fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'regras-escalacao.json'), 'utf8'))
const pc = (x) => x == null || Number.isNaN(x) ? '—' : (100 * x).toFixed(0) + '%'
const T = turnos.filter((t) => t.hospital !== 'materno')
const hungaro = (C) => { const n = C.length, m = C[0].length; const u = Array(n + 1).fill(0), v = Array(m + 1).fill(0), p = Array(m + 1).fill(0), way = Array(m + 1).fill(0)
  for (let i = 1; i <= n; i++) { p[0] = i; let j0 = 0; const minv = Array(m + 1).fill(Infinity), used = Array(m + 1).fill(false)
    do { used[j0] = true; const i0 = p[j0]; let delta = Infinity, j1 = 0; for (let j = 1; j <= m; j++) if (!used[j]) { const cur = C[i0 - 1][j - 1] - u[i0] - v[j]; if (cur < minv[j]) { minv[j] = cur; way[j] = j0 } if (minv[j] < delta) { delta = minv[j]; j1 = j } } for (let j = 0; j <= m; j++) if (used[j]) { u[p[j]] += delta; v[j] -= delta } else minv[j] -= delta; j0 = j1 } while (p[j0] !== 0)
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1 } while (j0) }
  const r = Array(n).fill(-1); for (let j = 1; j <= m; j++) if (p[j]) r[p[j] - 1] = j - 1; return r }
// ---- restrições do arquivo de regras → por uid
const alvoBate = (r, b) => r.alvoTipo === 'local' ? b.hospital + ':' + b.local === r.alvo : r.alvoTipo === 'especialidade' ? b.esp === r.alvo : r.alvoTipo === 'sala' ? b.salaK === r.alvo : r.alvoTipo === 'cirurgiao' ? b.cir && sa(b.cir) === sa(r.alvo) : false
const RESTR = REGRAS.restricoes.map((r) => ({ ...r, uid: r.anestesistaUid })).filter((r) => r.uid)
const proibido = (uid, b) => RESTR.some((r) => r.regra === 'nunca' && r.uid === uid && alvoBate(r, b))
const preferido = (uid, b) => RESTR.some((r) => r.regra === 'preferir' && r.uid === uid && alvoBate(r, b))
// ---- quem já esteve no consultório ANTES do teste (lista provável de cooperados, sem olhar o teste)
const jaFoiCons = new Set(); for (const t of T) { if (t.data >= INI) continue; for (const p of t.P) if (p.uid && p.nota && /^CONS/.test(p.nota)) jaFoiCons.add(p.uid); for (const b of t.blocos) if (b.local === 'consultorio') { b.donos.forEach((u) => jaFoiCons.add(u)); if (b.donoFinal) jaFoiCons.add(b.donoFinal) } }
for (const c of casos) if (c.bloco === 'consultorio' && c.uid && c.data < INI) jaFoiCons.add(c.uid)
const TODAS = { semBloco: true, plant: true, plantOrto: true, pos: true, cons: true, restr: true, dois: true, tempoV3: true, srpa: true }
// v4 = v3 + FAIXA: fim do bloco por simulação (P50/P80) e emparelhamento por custo ESPERADO sobre os sorteios
export const V4 = { ...TODAS, faixa: true }
function simular(t, F = TODAS) { const P = parametros(segunda(t.data)); const fimV3 = fimBlocosTurno(t, P, { modo: 'mapa' }); const S = F.faixa ? simularTurno(t) : null
  const fim = (b) => F.oraculo && b.realFim != null ? b.realFim : F.faixa ? S.get(b).p50 : F.tempoV3 ? fimV3.get(b).fim : (b.prevFimAnt ?? b.prevFim); const mins = (b) => b.pos ? 9999 : F.faixa ? S.get(b).minP50 : (fimV3.get(b).min ?? b.prevMin ?? 0)
  const blocos = t.blocos.filter((b) => b.donos.length === 1); let livresB = new Set(blocos); let livresP = t.P.filter((p) => p.uid); const dono = new Map(); const porRegra = new Map()
  const dar = (b, p, regra) => { dono.set(b, p.uid); livresB.delete(b); porRegra.set(b, regra) }; const tira = (p) => { livresP = livresP.filter((x) => x !== p) }
  // consultório: quem vem com a nota (CONSULT) no rodapé fica com ele
  if (F.cons) for (const b of [...livresB].filter((x) => x.local === 'consultorio')) { const p = livresP.find((x) => x.nota && /^CONS/.test(x.nota)); if (p) { dar(b, p, 'consultório (nota do rodapé)'); tira(p) } }
  // consultório sem nota no rodapé: fica SEM sugestão — a lista de cooperados ainda não chegou (dono 10/11)
  for (const b of [...livresB].filter((x) => x.local === 'consultorio')) { livresB.delete(b); porRegra.set(b, 'consultório (sem sugestão)') }
  // plantonista: HRO = ortopedia/urgência mesmo que termine cedo; demais = o bloco que termina por último
  if (F.plant) { const p = livresP.find((x) => x.plant); const cand = [...livresB].filter((b) => !b.pos && !proibido(p?.uid, b)); if (p && cand.length) { let esc = cand; if (F.plantOrto && t.hospital === 'hro') { const o = cand.filter((b) => b.esp === 'Ortopedia' || b.local === 'emergencia' || b.urg); if (o.length) esc = o } const curto = F.plantCurto === 'todos' || (F.plantCurto === 'fora-hro' && t.hospital !== 'hro'); const b = curto ? cand.reduce((a, c) => fim(c) < fim(a) ? c : a) : esc.reduce((a, c) => fim(c) > fim(a) ? c : a); dar(b, p, curto ? 'plantonista (bloco curto)' : 'plantonista'); tira(p) } }
  // pós-plantão (2º do rodapé, Unimed, manhã): o bloco mais curto
  if (F.pos && t.hospital === 'unimed' && t.turno === 'matutino') { const p = livresP.find((x) => x.noRodape && x.idx === 1 && !x.ajuda); const cand = [...livresB].filter((b) => !b.pos && !proibido(p?.uid, b)); if (p && cand.length) { const b = cand.reduce((a, c) => mins(c) < mins(a) ? c : a); dar(b, p, 'pós-plantão'); tira(p) } }
  // SRPA da Unimed (dono 10/11): manhã = pós-plantão (2º do rodapé), depois do bloco curto, até 13h; tarde = 4º do rodapé
  if (F.srpa && t.hospital === 'unimed') { const b = [...livresB].find((x) => x.local === 'srpa'); if (b) { if (t.turno === 'matutino') { const p = t.P.find((x) => x.noRodape && x.idx === 1 && !x.ajuda); if (p) dar(b, p, 'SRPA (pós-plantão)') } else { const p = livresP.find((x) => x.noRodape && x.idx === 3); if (p) { dar(b, p, 'SRPA (4º do rodapé)'); tira(p) } } } }
  // o resto: pacotes × pessoas
  let pac = [...livresB].map((b) => [b]); const fimPac = (g) => Math.max(...g.map(fim)), iniPac = (g) => Math.min(...g.map((b) => b.ini))
  let rec = [...livresP].sort((a, b) => a.saida - b.saida)
  if (pac.length < rec.length) { // sobra gente: sai o último do rodapé, depois quem sai mais cedo (ajuda de fora nunca fica sem)
    const ordemCorte = F.semBloco ? [...rec.filter((p) => p.ultimo), ...rec.filter((p) => p.noRodape && !p.ultimo)] : embaralha(rec.filter((p) => p.noRodape))
    while (pac.length < rec.length && ordemCorte.length) { const x = ordemCorte.shift(); rec = rec.filter((p) => p !== x) } }
  while (pac.length > rec.length && pac.length > 1) { // sobram blocos: junta dois que cabem em sequência, começando pelos que acabam mais cedo
    let bi = -1, bj = -1, best = Infinity
    if (F.dois) for (let i = 0; i < pac.length; i++) for (let j = 0; j < pac.length; j++) { if (i === j) continue; if (pac[i].some((b) => b.pos) || pac[j].some((b) => b.pos)) continue; if (iniPac(pac[j]) >= fimPac(pac[i]) - 15 && fimPac(pac[j]) < best) { best = fimPac(pac[j]); bi = i; bj = j } }
    if (bi < 0) { const s = pac.map((g, i) => [fimPac(g), i]).sort((a, b) => a[0] - b[0]); bi = s[0][1]; bj = s[1][1] }
    pac[bi] = pac[bi].concat(pac[bj]); pac.splice(bj, 1) }
  if (rec.length && pac.length) { const ordP = [...pac].sort((a, b) => fimPac(a) - fimPac(b)); const rkB = new Map(ordP.map((g, i) => [g, ordP.length > 1 ? i / (ordP.length - 1) : 0.5]))
    const n = rec.length; const ND = 250; const t1 = t.turno === 'matutino' ? 780 : 1140
    // custo esperado (v4): cada posição de saída tem um horário-alvo (o fim P50 do pacote daquela posição na fila de pacotes);
    // o custo de dar o pacote g à pessoa i é o atraso esperado além do alvo (peso 1) + a folga esperada antes dele (peso 0,25)
    const fimSorteio = (g, d) => { let m = 0; for (const b of g) { const o = S.get(b); const v = o.fins ? o.fins[d] : t1; if (v > m) m = v } return m }
    const alvos = F.faixa && !F.custoPonto ? rec.map((_, i) => fimPac(ordP[Math.round((n > 1 ? i / (n - 1) : 0.5) * (ordP.length - 1))])) : null
    const C = rec.map((p, i) => { const rp = n > 1 ? i / (n - 1) : 0.5; const linha = pac.map((g) => { let c
      if (alvos) { let ac = 0; for (let d = 0; d < ND; d++) { const e = fimSorteio(g, d) - alvos[i]; ac += e > 0 ? e : -0.25 * e } c = ac / ND / 60 } else c = (rp - rkB.get(g)) ** 2
      for (const b of g) { if (F.restr && proibido(p.uid, b)) c += 1e6; if (F.restr && preferido(p.uid, b)) c -= alvos ? 0.3 : 0.05 } return c }); while (linha.length < n) linha.push(alvos ? 2 : 0.5); return linha })
    const r = hungaro(C); rec.forEach((p, i) => { const g = pac[r[i]]; if (g) for (const b of g) { dono.set(b, p.uid); porRegra.set(b, g.length > 1 ? 'ordem (dois blocos)' : 'ordem') } }) }
  return { dono, porRegra, fim, S } }
// atraso ponderado pela ordem: para as pessoas com fim real, quanto cada uma termina DEPOIS do horário que teria se os mesmos
// fins estivessem na ordem de saída (o i-ésimo a sair com o i-ésimo fim); peso maior para quem sai primeiro.
const atrasoPond = (t, donoDe) => { const fimP = new Map(); const ruim = new Set(); for (const b of t.blocos) { if (b.pos || b.donos.length !== 1) continue; const u = donoDe(b); if (!u) continue; if (b.realFim == null) { ruim.add(u); continue } fimP.set(u, Math.max(fimP.get(u) ?? -1, b.realFim)) } const ps = t.P.filter((p) => p.noRodape && p.uid && fimP.has(p.uid) && !ruim.has(p.uid)).sort((a, b) => a.saida - b.saida); const n = ps.length; if (n < 4) return [0, 0]; const ideal = ps.map((p) => fimP.get(p.uid)).sort((a, b) => a - b); let s = 0, w = 0; ps.forEach((p, i) => { const peso = (n - i) / n; s += peso * Math.max(0, fimP.get(p.uid) - ideal[i]); w += peso }); return [s, w] }
const inv = (t, donoDe, semPos = false) => { const fimP = new Map(); const ruim = new Set(); for (const b of t.blocos) { if (b.pos || b.donos.length !== 1) continue; const u = donoDe(b); if (!u) continue; if (b.realFim == null) { ruim.add(u); continue } fimP.set(u, Math.max(fimP.get(u) ?? -1, b.realFim)) } const ehPos = (p) => t.hospital === 'unimed' && t.turno === 'matutino' && p.idx === 1 && !p.ajuda; const ps = t.P.filter((p) => p.noRodape && p.uid && fimP.has(p.uid) && !ruim.has(p.uid) && !(semPos && ehPos(p))); let n = 0, tot = 0; for (const a of ps) for (const b of ps) if (a.saida < b.saida) { tot++; if (fimP.get(a.uid) > fimP.get(b.uid) + 30) n++ } return [n, tot] }
const violaDura = (uid, b) => (proibido(uid, b) ? 1 : 0)
function avaliar(ts, F) { const R = { exato: [0, 0], exatoFinal: [0, 0], faixa: [0, 0], semOk: [0, 0], viol: 0, inv: [0, 0], inv2: [0, 0], ap: [0, 0], p80: [0, 0], regra: {} }; const porT = []
  for (const t of ts) { const { dono, porRegra, fim, S } = simular(t, F); let ex = 0, nb = 0
    { const [x, y] = atrasoPond(t, (b) => dono.get(b)); R.ap[0] += x; R.ap[1] += y } if (S) for (const b of t.blocos) if (!b.pos && b.realFim != null && b.donos.length <= 1) { R.p80[1]++; if (b.realFim <= S.get(b).p80) R.p80[0]++ }
    for (const b of t.blocos) { if (b.donos.length !== 1) continue; const s = dono.get(b); nb++; R.exato[1]++; const ok = s === b.donos[0]; if (ok) { R.exato[0]++; ex++ } if (b.donoFinal) { R.exatoFinal[1]++; if (s === b.donoFinal) R.exatoFinal[0]++ } const ps = t.porUid.get(s), pp = t.porUid.get(b.donos[0]); R.faixa[1]++; if (ps && pp && Math.abs(ps.saida - pp.saida) <= 1) R.faixa[0]++; if (s) R.viol += violaDura(s, b); const k = porRegra.get(b) || '—'; (R.regra[k] ||= [0, 0])[1]++; if (ok) R.regra[k][0]++ }
    const comB = new Set(dono.values()); for (const p of t.P.filter((x) => x.uid && x.noRodape)) { R.semOk[1]++; if (comB.has(p.uid) === (p.blocos.length > 0)) R.semOk[0]++ }
    const [a, b2] = inv(t, (b) => dono.get(b)); R.inv[0] += a; R.inv[1] += b2; { const [c2, d2] = inv(t, (b) => dono.get(b), true); R.inv2[0] += c2; R.inv2[1] += d2 } porT.push({ t, ex: nb ? ex / nb : 0, dono, porRegra, fim, S, inv: a, invTot: b2 }) }
  return { R, porT } }
export function placar({ silencioso = false } = {}) { const te = T.filter((t) => t.fonte === 'publicado' && t.data >= INI && t.data <= FIM); const out = []; const log = (s) => { out.push(s); if (!silencioso) console.log(s) }
  log(`PLACAR v3/v4 — teste ${INI} a ${FIM}: ${te.length} turnos, ${te.reduce((s, t) => s + t.blocos.filter((b) => b.donos.length === 1).length, 0)} blocos | regras: ${REGRAS.versao} | consultório: só pela nota do rodapé (lista de cooperados pendente) | restrições do dono lidas: ${RESTR.length}`)
  const linha = (nome, R) => log(`  ${nome.padEnd(46)} mesma pessoa×publicado ${pc(R.exato[0] / R.exato[1])} | ×final ${pc(R.exatoFinal[0] / R.exatoFinal[1])} | mesma faixa (±1) ${pc(R.faixa[0] / R.faixa[1])} | com/sem bloco certo ${pc(R.semOk[0] / R.semOk[1])} | inversões >30min ${(100 * R.inv[0] / R.inv[1]).toFixed(1)}% (${R.inv[0]}/${R.inv[1]}) | sem contar o pós-plantão ${(100 * R.inv2[0] / R.inv2[1]).toFixed(1)}% | atraso ponderado pela ordem ${(R.ap[0] / R.ap[1]).toFixed(1)} min${R.p80[1] ? ` | P80 do fim do bloco cobre ${pc(R.p80[0] / R.p80[1])}` : ''} | violações de regra dura ${R.viol}`)
  const cheio = avaliar(te, TODAS); linha('v3 — todas as regras do dono', cheio.R)
  const v4 = avaliar(te, V4); linha('v4 — faixa + custo esperado', v4.R)
  linha('v4 só ordenando pelo P50 (sem custo esperado)', avaliar(te, { ...V4, custoPonto: true }).R)
  log('  tirando UMA regra de cada vez (o que cada uma vale):')
  for (const [k, nome] of [['tempoV3', 'sem o modelo de tempo novo (usa o da 2ª rodada)'], ['semBloco', 'sem "último fica sem bloco" (corte ao acaso)'], ['plant', 'sem "plantonista termina por último"'], ['plantOrto', 'sem "plantonista do HRO em ortopedia/urgência"'], ['pos', 'sem "pós-plantão com o bloco mais curto"'], ['srpa', 'sem a regra da SRPA da Unimed'], ['restr', 'sem as restrições do A40'], ['dois', 'sem "dois blocos pelo tempo"']]) { let acc = null; const reps = k === 'semBloco' ? 5 : 1; for (let r = 0; r < reps; r++) { const { R } = avaliar(te, { ...TODAS, [k]: false }); if (!acc) acc = R; else for (const f of ['exato', 'exatoFinal', 'faixa', 'semOk', 'inv', 'inv2']) { acc[f][0] += R[f][0]; acc[f][1] += R[f][1] } } linha('   ' + nome, acc) }
  linha('v3 se o fim real de cada bloco fosse conhecido', avaliar(te, { ...TODAS, oraculo: true }).R)
  linha('só a ordem, se o fim real fosse conhecido', avaliar(te, { ...TODAS, oraculo: true, plant: false, plantOrto: false, pos: false, cons: false, restr: false }).R)
  linha('só a ordem (nenhuma regra de papel, tempo v3)', avaliar(te, { ...TODAS, plant: false, plantOrto: false, pos: false, cons: false, restr: false }).R)
  { const R = { inv: [0, 0], invF: [0, 0], viol: 0, ex: [0, 0] }; const al = [0, 0], alEx = [0, 0]
    for (const t of te) { const [a, b] = inv(t, (x) => x.donos[0]); R.inv[0] += a; R.inv[1] += b; const [c, d] = inv(t, (x) => x.donoFinal); R.invF[0] += c; R.invF[1] += d; const bs = t.blocos.filter((x) => x.donos.length === 1)
      for (const b2 of bs) { R.viol += violaDura(b2.donos[0], b2); if (b2.donoFinal) { R.ex[1]++; if (b2.donoFinal === b2.donos[0]) R.ex[0]++ } }
      for (let r = 0; r < 100; r++) { const us = embaralha(bs.map((x) => x.donos[0])); const m = new Map(bs.map((x, i) => [x, us[i]])); const [e, f] = inv(t, (x) => m.get(x)); al[0] += e / 100; al[1] += f / 100; bs.forEach((x, i) => { alEx[1]++; if (us[i] === x.donos[0]) alEx[0]++ }) } }
    { let c = 0, d = 0, e2 = 0, f2 = 0; for (const t of te) { const [x, y] = inv(t, (b) => b.donos[0], true); c += x; d += y; const [x2, y2] = inv(t, (b) => b.donoFinal, true); e2 += x2; f2 += y2 } R.inv2 = [c, d]; R.invF2 = [e2, f2] }
    log(`  ${'PUBLICADO pelo coordenador'.padEnd(46)} igual ao final ${pc(R.ex[0] / R.ex[1])} | inversões >30min ${(100 * R.inv[0] / R.inv[1]).toFixed(1)}% (${R.inv[0]}/${R.inv[1]}) | sem contar o pós-plantão ${(100 * R.inv2[0] / R.inv2[1]).toFixed(1)}% | violações de regra dura ${R.viol}`)
    { const f = (dd) => { let a = 0, b = 0; for (const t of te) { const [x, y] = atrasoPond(t, dd); a += x; b += y } return (a / b).toFixed(1) }; log(`  atraso ponderado pela ordem (min): publicado ${f((b) => b.donos[0])} | final ${f((b) => b.donoFinal)}`) }
    log(`  ${'FINAL (depois das trocas do dia)'.padEnd(46)} inversões >30min ${(100 * R.invF[0] / R.invF[1]).toFixed(1)}% (${R.invF[0]}/${R.invF[1]}) | sem contar o pós-plantão ${(100 * R.invF2[0] / R.invF2[1]).toFixed(1)}%`)
    log(`  ${'ACASO'.padEnd(46)} mesma pessoa ${pc(alEx[0] / alEx[1])} | inversões >30min ${(100 * al[0] / al[1]).toFixed(1)}%`) }
  log('  acerto (mesma pessoa que o publicado) por regra que decidiu o bloco: ' + Object.entries(cheio.R.regra).sort((a, b) => b[1][1] - a[1][1]).map(([k, [a, b]]) => `${k} ${pc(a / b)} (n${b})`).join(' · '))
  { // o que o coordenador PRATICA em relação às regras que declarou (todos os turnos, plano publicado/reconstruído)
    const c = { plantUlt: [0, 0], plantUltReal: [0, 0], plantPct: [], posCurto: [0, 0], posPct: [], hroOrto: [0, 0], ult: [0, 0], srpa: {} }
    for (const t of T) { const P = parametros(segunda(t.data)); const fm = fimBlocosTurno(t, P, { modo: 'mapa' }); const bs = t.blocos.filter((b) => b.donos.length === 1 && !b.pos); if (bs.length < 5) continue; const ord = [...bs].sort((a, b) => fm.get(a).fim - fm.get(b).fim)
      const pl = t.P.find((p) => p.plant); const bp = pl ? bs.filter((b) => b.donos[0] === pl.uid) : []; if (bp.length) { const mx = Math.max(...bp.map((b) => ord.indexOf(b))); c.plantUlt[1]++; if (mx >= ord.length - 2) c.plantUlt[0]++; c.plantPct.push(mx / (ord.length - 1)); if (t.hospital === 'hro') { c.hroOrto[1]++; if (bp.some((b) => b.esp === 'Ortopedia' || b.local === 'emergencia' || b.urg)) c.hroOrto[0]++ }
        const comReal = bs.filter((b) => b.realFim != null); if (comReal.length >= 8 && bp.every((b) => b.realFim != null)) { const m = Math.max(...bp.map((b) => b.realFim)); c.plantUltReal[1]++; if (comReal.filter((b) => b.realFim > m).length <= 1) c.plantUltReal[0]++ } }
      if (t.hospital === 'unimed' && t.turno === 'matutino') { const pp = t.P.find((p) => p.noRodape && p.idx === 1 && !p.ajuda); const bq = pp ? bs.filter((b) => b.donos[0] === pp.uid) : []; if (bq.length) { const om = [...bs].sort((a, b) => (fm.get(a).min ?? 0) - (fm.get(b).min ?? 0)); const i = Math.min(...bq.map((b) => om.indexOf(b))); c.posCurto[1]++; if (i <= 1) c.posCurto[0]++; c.posPct.push(i / (om.length - 1)) } }
      const u = t.P.find((p) => p.ultimo && p.noRodape); if (u) { c.ult[1]++; if (!u.blocos.length) c.ult[0]++ }
      for (const b of t.blocos) if (b.local === 'srpa' && b.donos.length === 1) { const p = t.porUid.get(b.donos[0]); const k = t.hospital + ' ' + t.turno + ': ' + (p.plant ? 'plantonista' : p.idx === 1 ? '2º do rodapé' : p.pct >= 0.5 ? 'metade que sai tarde' : 'metade que sai cedo'); c.srpa[k] = (c.srpa[k] || 0) + 1 } }
    log('  REGRA DECLARADA × PRATICADA no plano do coordenador (todos os turnos):')
    log(`   plantonista com o bloco que termina por último (ou penúltimo), pelo fim PREVISTO: ${c.plantUlt[0]} de ${c.plantUlt[1]} (${pc(c.plantUlt[0] / c.plantUlt[1])}); posição mediana do bloco dele: ${pc(med(c.plantPct))} da fila de blocos | pelo fim REAL: ${c.plantUltReal[0]} de ${c.plantUltReal[1]} (${pc(c.plantUltReal[0] / c.plantUltReal[1])})`)
    log(`   plantonista do HRO com bloco de ortopedia/urgência: ${c.hroOrto[0]} de ${c.hroOrto[1]} (${pc(c.hroOrto[0] / c.hroOrto[1])})`)
    log(`   pós-plantão (Unimed manhã) com o bloco mais curto ou o 2º mais curto: ${c.posCurto[0]} de ${c.posCurto[1]} (${pc(c.posCurto[0] / c.posCurto[1])}); posição mediana: ${pc(med(c.posPct))} da fila de blocos por minutos`)
    log(`   último do rodapé sem bloco: ${c.ult[0]} de ${c.ult[1]} (${pc(c.ult[0] / c.ult[1])})`)
    { let n4 = 0, nt = 0, n2 = 0, nm = 0; const dist = {}; for (const t of T) for (const b of t.blocos) if (b.local === 'srpa' && b.donos.length === 1 && t.hospital === 'unimed') { const p = t.porUid.get(b.donos[0]); if (t.turno === 'vespertino') { nt++; if (p.idx === 3) n4++; const k = p.noRodape ? (p.idx + 1) + 'º' : 'fora'; dist[k] = (dist[k] || 0) + 1 } else { nm++; if (p.idx === 1) n2++ } } log(`   SRPA da Unimed — manhã com o 2º do rodapé: ${n2} de ${nm} (${pc(n2 / nm)}) | tarde com exatamente o 4º do rodapé: ${n4} de ${nt} (${pc(n4 / nt)}); posição no rodapé à tarde: ${Object.entries(dist).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(' · ')}`) }
    log('   SRPA — quem recebe: ' + Object.entries(c.srpa).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')) }
  for (const [h, tu] of [['unimed', 'matutino'], ['unimed', 'vespertino'], ['hro', 'matutino'], ['hro', 'vespertino']]) { const ts = te.filter((t) => t.hospital === h && t.turno === tu); if (ts.length) linha(`  v3 — ${h} ${tu} (${ts.length}t)`, avaliar(ts, TODAS).R) }
  { const melhor = cheio.porT.filter((x) => x.invTot); const pub = melhor.map((x) => inv(x.t, (b) => b.donos[0])[0]); log(`  por turno, v3 × publicado em inversões: melhor ${melhor.filter((x, i) => x.inv < pub[i]).length} · igual ${melhor.filter((x, i) => x.inv === pub[i]).length} · pior ${melhor.filter((x, i) => x.inv > pub[i]).length}`) }
  return { texto: out.join('\n'), cheio, v4, R: cheio.R, R4: v4.R, turnos: te.length, te } }
// ---- TESTE da regra de Dexter 2019 × regra do dono para o plantonista (não muda regra nenhuma; é pergunta para o dono).
// A = dono: plantonista com o bloco previsto para terminar por último (HRO: ortopedia/urgência).
// B = bloco curto: plantonista começa no bloco previsto para terminar mais cedo e, ao terminar, assume o bloco que DE FATO
//     ainda vai mais longe (decisão do dia). Para comparar com justiça, A+ = regra do dono + a mesma rendição ao terminar.
// Desfecho: minutos de quem NÃO é plantonista além do fim do turno (13h / 19h). Fim real do bloco; sem fim real, o P50.
export function testeBlocoCurto(te, { silencioso = false } = {}) { const out = []; const log = (x) => { out.push(x); if (!silencioso) console.log(x) }
  const roda = (t, F, render) => { const { dono, S } = simular(t, F); const T1 = t.turno === 'matutino' ? 780 : 1140; const pl = t.P.find((p) => p.plant); if (!pl) return null; const real = (b) => b.realFim ?? S.get(b).p50
    const bs = t.blocos.filter((b) => b.donos.length === 1 && !b.pos && dono.get(b)); const fimDe = new Map(); for (const b of bs) fimDe.set(dono.get(b), Math.max(fimDe.get(dono.get(b)) ?? 0, real(b))); let rendeu = 0; const livre = fimDe.get(pl.uid); if (livre == null) return null
    if (render) { const cand = bs.filter((b) => dono.get(b) !== pl.uid && real(b) > livre + 15).sort((a, b) => real(b) - real(a))[0]; if (cand) { const x = dono.get(cand); const resto = bs.filter((b) => dono.get(b) === x && b !== cand).map(real); fimDe.set(x, Math.max(livre, ...resto, 0)); fimDe.set(pl.uid, real(cand)); rendeu = 1 } }
    let extra = 0, tarde = 0, ult = 0; for (const [u, f] of fimDe) { if (u === pl.uid) continue; extra += Math.max(0, f - T1); if (f > T1 + 30) tarde++; if (f > ult) ult = f } return { extra, tarde, ult, plant: fimDe.get(pl.uid), rendeu, comReal: bs.filter((b) => b.realFim != null).length / bs.length } }
  log('TESTE — plantonista: regra do dono × regra do bloco curto (Dexter 2019). Desfecho = minutos de quem NÃO é plantonista além do fim do turno')
  for (const [nome, ts, alc] of [['Unimed (regra do dono: bloco que termina por último)', te.filter((t) => t.hospital === 'unimed'), 'todos'], ['HRO (regra do dono: ortopedia/urgência)', te.filter((t) => t.hospital === 'hro'), 'todos']]) { const ag = { A: [], Ap: [], B: [] }
    for (const t of ts) { const a = roda(t, V4, false), ap = roda(t, V4, true), b = roda(t, { ...V4, plantCurto: alc }, true); if (!a || !ap || !b || a.comReal < 0.6) continue; ag.A.push(a); ag.Ap.push(ap); ag.B.push(b) }
    const m = (l, f) => l.length ? (l.reduce((s, x) => s + f(x), 0) / l.length) : 0; const li = (rot, l) => `    ${rot.padEnd(52)} ${m(l, (x) => x.extra).toFixed(0)} min por turno | turnos com alguém >30 min além: ${pc(m(l, (x) => x.tarde > 0 ? 1 : 0))} | fim mediano do plantonista ${hhmm(med(l.map((x) => x.plant)))} | rendição usada em ${pc(m(l, (x) => x.rendeu))}`
    log(`  ${nome} — ${ag.A.length} turnos com 60%+ dos blocos com fim real`); log(li('A  regra do dono, sem rendição', ag.A)); log(li('A+ regra do dono + plantonista rende ao terminar', ag.Ap)); log(li('B  bloco curto + rende o que de fato vai mais longe', ag.B)) }
  return out.join('\n') }
// ---- exemplo do que a TELA de sugestão precisa mostrar (um turno, em códigos)
import { lerTabela, codigoDe } from './codigos.mjs'
const TAB = lerTabela()
export function exemploTela(k) { const t = T.find((x) => x.k === k); const { dono, porRegra, S } = simular(t, V4); const linhas = []
  for (const b of [...t.blocos].filter((x) => x.donos.length === 1).sort((a, c) => S.get(a).p50 - S.get(c).p50)) { const o = S.get(b); const u = dono.get(b); const p = u ? t.porUid.get(u) : null; const n = t.P.filter((x) => x.noRodape).length
    const expl = !u ? 'Sem sugestão: consultório depende da lista de cooperados.' : porRegra.get(b).startsWith('plantonista') ? (t.hospital === 'hro' ? 'Plantonista: ortopedia/urgência.' : 'Plantonista: bloco previsto para terminar por último.') : porRegra.get(b).startsWith('pós') ? 'Pós-plantão: bloco mais curto do turno.' : porRegra.get(b).startsWith('SRPA') ? 'SRPA: ' + porRegra.get(b).replace(/SRPA \(|\)/g, '') + '.' : `${p.noRodape ? p.saida + 1 + 'º a sair de ' + n : 'Ajuda de fora'}; bloco é o ${[...t.blocos].filter((x) => x.donos.length === 1 && !x.pos).sort((a, c) => S.get(a).p50 - S.get(c).p50).indexOf(b) + 1}º a terminar.`
    linhas.push({ bloco: b.sala, cirurgias: b.n, cirurgiao: b.cir ? (TAB.cirurgioes[b.hospital + '|' + b.cir]?.codigo ?? 'C???') : null, fimP50: b.pos ? null : hhmm(o.p50), fimP80: b.pos ? null : hhmm(o.p80), baixaConfianca: !!o.baixa || (!b.pos && o.p80 - o.p50 > 90), sugerido: u ? (codigoDe(u) ?? 'A??') : null, ordemSaida: p?.noRodape ? p.saida + 1 : null, regra: porRegra.get(b), explicacao: expl }) }
  return { turno: { data: t.data, hospital: t.hospital, turno: t.turno, pessoasNoRodape: t.P.filter((x) => x.noRodape).length, blocos: linhas.length }, semBloco: t.P.filter((p) => p.noRodape && p.uid && ![...dono.values()].includes(p.uid)).map((p) => ({ pessoa: codigoDe(p.uid) ?? 'A??', ordemSaida: p.saida + 1 })), linhas } }

if (process.argv[1] && process.argv[1].endsWith('i_simulador_v3.mjs')) { const { cheio, te } = placar(); console.log(''); testeBlocoCurto(te); if (process.env.EXEMPLO) console.log(JSON.stringify(exemploTela(process.env.EXEMPLO), null, 1))
  for (const k of ['2026-10-27|unimed|vespertino', '2026-10-20|unimed|matutino', '2026-10-19|unimed|vespertino']) { const x = cheio.porT.find((y) => y.t.k === k); if (!x) continue; const { t, dono, porRegra, fim, ex } = x; console.log(`\n--- ${t.data} ${t.hospital.toUpperCase()} ${t.turno} — mesma pessoa em ${pc(ex)} — (nº = ordem de saída; 1 sai primeiro) ---`); const pos = (u) => { const p = t.porUid.get(u); return p ? `${nomeP(u)} (${p.noRodape ? p.saida + 1 : 'ajuda'})` : '—' }
    console.log('  bloco | cirurgias | fim previsto v3 | fim real | PUBLICADO | SUGERIDO v3 | regra')
    for (const b of [...t.blocos].filter((y) => y.donos.length === 1).sort((a, c) => fim(a) - fim(c))) console.log(`  ${b.sala.padEnd(16)} | ${b.n} | ${hhmm(fim(b))} | ${hhmm(b.realFim)} | ${pos(b.donos[0]).padEnd(24)} | ${pos(dono.get(b)).padEnd(24)}${dono.get(b) === b.donos[0] ? ' =' : '  '} | ${porRegra.get(b) || '—'}`)
    const semP = t.P.filter((p) => p.noRodape && p.uid && !p.blocos.length).map((p) => `${nomeP(p.uid)} (${p.saida + 1})`), semS = t.P.filter((p) => p.noRodape && p.uid && ![...dono.values()].includes(p.uid)).map((p) => `${nomeP(p.uid)} (${p.saida + 1})`); console.log(`  sem bloco — publicado: ${semP.join(', ') || 'ninguém'} | sugerido: ${semS.join(', ') || 'ninguém'}`) } }

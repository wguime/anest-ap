// blocos.mjs — reconstrói, para cada turno publicado, o RODAPÉ (pessoas, posição, papel) e os BLOCOS
// (sala × anestesista) do plano COMO PUBLICADO (captura alocacao:pub; antes de 28/09, o caso final).
import { ler, min, med, q, familia, generica, tokCir, cirBruto, util, teMin, lotes, hmBRT, sa } from './comum.mjs'
export const casos = ler('casos').filter((c) => c.hospital !== 'fds')
export const escalas = ler('escalas'); export const cap = ler('captura'); const alias = ler('alias')
const pedInfo = new Map(ler('ped').map((p) => [p.id, p])); for (const c of casos) { const p = pedInfo.get(c.id); c.ped = p?.ped ?? null }
const perfis = new Map(ler('perfis').map((p) => [p.id, p]))
const ev = lotes(ler('eventos')); const evPorCaso = new Map(); for (const e of ev) { if (!evPorCaso.has(e.caso_id)) evPorCaso.set(e.caso_id, []); evPorCaso.get(e.caso_id).push(e) }
const tc = (s) => String(s || '').toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase())
export const nomeP = (uid) => { const n = perfis.get(uid)?.nome; if (!n) return uid ? uid.slice(0, 6) : '—'; const t = n.trim().split(/\s+/); return tc(t.length > 1 ? t[0] + ' ' + t[t.length - 1] : t[0]) }
// nomes curtos ambíguos ganham o nome do meio
{ const cont = {}; for (const u of perfis.keys()) { const n = nomeP(u); cont[n] = (cont[n] || 0) + 1 } }
const A = new Map(alias.map((a) => [sa(a.apelido), a.user_id]))
export const limpaNome = (s) => sa(String(s || '').replace(/\([^)]*\)\s*$/, ''))
export const notaNome = (s) => { const m = /\(([^)]*)\)\s*$/.exec(String(s || '')); return m ? sa(m[1]) : null }
export const uidDe = (nome) => { const k = limpaNome(nome); if (!k) return null; if (A.has(k)) return A.get(k); const c = [...A].filter(([a]) => a.startsWith(k + ' ') || k.startsWith(a + ' ')); const us = new Set(c.map((x) => x[1])); return us.size === 1 ? [...us][0] : null }
// ---- cirurgião: grupos de grafia por hospital (1º nome igual e tokens contidos)
const grafias = new Map(); for (const c of casos) { const b = cirBruto(c.cirurgiao); if (!b) continue; const k = c.hospital + '|' + b; grafias.set(k, (grafias.get(k) || 0) + 1) }
const porHosp = {}; for (const [k, n] of grafias) { const [h, b] = k.split('|'); const t = tokCir(b); if (!t.length) continue; (porHosp[h] ||= []).push({ b, t, n }) }
const canon = new Map()
for (const h of Object.keys(porHosp)) { const arr = porHosp[h].sort((a, b) => b.t.length - a.t.length || b.n - a.n); const cls = []
  for (const g of arr) { const cands = cls.filter((cl) => cl.t[0] === g.t[0] && g.t.every((x) => cl.t.includes(x))); if (cands.length === 1) cands[0].m.push(g); else cls.push({ t: g.t, m: [g], amb: cands.length > 1 }) }
  for (const cl of cls) for (const g of cl.m) canon.set(h + '|' + g.b, tc(cl.t.length > 2 ? cl.t[0] + ' ' + cl.t[cl.t.length - 1] : cl.t.join(' ')) + (cl.amb ? '?' : '')) }
export const cirK = (hospital, txt) => { const b = cirBruto(txt); return b ? canon.get(hospital + '|' + b) || tc(tokCir(b).join(' ')) || null : null }
// ---- especialidade (aproximação por regex sobre o procedimento; a ordem decide)
const ESP = [
  ['Oftalmo', /FACO|VITRECTOMIA|CATARATA|PTERIGIO|ESTRABISMO|RETINA|GLAUCOMA|INTRAVITREA|CROSSLINK|CORNEA|DACRIO/],
  ['Obstetrícia', /CESAR|PARTO|CERCLAGEM|CURETAGEM|AMIU/],
  ['Endoscopia', /\bEDA\b|COLONO|\bCOLO\b|ENDOSCOPIA|CPRE|BRONCOSCOPIA|ECOENDOSCOPIA/],
  ['Imagem', /\bRM\b|\bRNM\b|RESSONANCIA|\bTC\b|TOMOGRAFIA/],
  ['Hemodinâmica', /CATETERISMO|ANGIOPLASTIA|ARTERIOGRAFIA|EMBOLIZACAO|ABLACAO|MARCAPASSO|ELETROFISIOLOG|\bTAVI\b|ANGIOGRAFIA|\bCAT\b/],
  ['Cardíaca', /REVASCULARIZACAO|TROCA VALVAR|\bCEC\b|CARDIAC|VALV|ESTERNOTOMIA/],
  ['Neuro/coluna', /CRANIO|ARTRODESE|COLUNA|DISCO|DISCECTOMIA|\bDVP\b|ANEURISMA CEREBRAL|MICROCIRURGIA|LAMINECTOMIA|DENERVACAO|RIZOTOMIA|INFILTRACAO|HEMATOMA SUBDURAL|TUMOR CEREBRAL|BLOQUEIO/],
  ['Otorrino', /AMIGDAL|ADENOID|SEPTOPLASTIA|TURBIN|SINUS|TIMPANO|LARINGO|NASAL|TUBO DE VENTILACAO|MASTOIDECTOMIA/],
  ['Ortopedia', /FRATURA|ARTROPLASTIA|ARTROSCOPIA|MENISCO|\bLCA\b|MANGUITO|OSTEOSSINTESE|TUNEL DO CARPO|FIXADOR|RETIRADA DE (MATERIAL|SINTESE)|HALUX|TENORRAFIA|TENDAO|LIGAMENT|ORTOP|GATILHO|AMPUTACAO|OSTEOTOMIA|JOELHO|OMBRO|QUADRIL|PUNHO|TORNOZELO|PSEUDOARTROSE/],
  ['Urologia', /PROSTAT|\bRTU\b|URETERO|NEFRO|CISTOSCOPIA|CISTOLITO|POSTECTOMIA|VASECTOMIA|ORQUI|HIDROCELE|VARICOCELE|LITOTRIP|DUPLO J|PIELO|URETRO|FIMOSE|CISTECTOMIA|PENIANA/],
  ['Mastologia', /\bMAMA\b|MASTECTOMIA|SETORECTOMIA|QUADRANTECTOMIA|LINFONODO SENTINELA/],
  ['Plástica', /MAMOPLASTIA|ABDOMINOPLASTIA|LIPO(ASPIRACAO|ESCULTURA)|BLEFAROPLASTIA|RINOPLASTIA|PROTESE DE MAMA|RITIDOPLASTIA|ENXERTO|RETALHO|OTOPLASTIA/],
  ['Ginecologia', /HISTERECTOMIA|HISTEROSCOPIA|LAQUEADURA|OOFOR|MIOMECTOMIA|PERINEO|COLPO|CONIZACAO|ENDOMETRIOSE|SALPING|BARTHOLIN/],
  ['Vascular', /VARIZES|SAFENECTOMIA|FISTULA ARTERIOVENOSA|\bFAV\b|ENDARTERECTOMIA|TROMBECTOMIA|DEBRIDAMENTO/],
  ['Torácica', /TORACO|LOBECTOMIA|PLEUR|MEDIASTINO|SIMPATECTOMIA/],
  ['Cabeça e pescoço', /TIREOID|PAROTID|TRAQUEOSTOMIA|CERVICAL|CERVICOTOMIA/],
  ['Buco/odonto', /BUCO|ODONTO|DENT|MAXIL|MANDIBUL|SISO|EXODONTIA/],
  ['Geral', /COLECIST|HERNI|APENDIC|LAPAROTOMIA|GASTRECTOMIA|BARIATRICA|BYPASS|SLEEVE|COLECTOMIA|HEMORROID|FISTULECTOMIA|FISSUR|RETOSSIGMOID|ESPLENECTOMIA|HEPATECTOMIA|PANCREAT|GASTROPLASTIA|PILONIDAL|LIPOMA|EXERESE|LAPAROSCOPIA|ESOFAG|FUNDOPLICATURA|HIATO/],
]
export const espDe = (proc) => { const s = sa(proc); for (const [n, re] of ESP) if (re.test(s)) return n; return null }
export const convDe = (c) => { const s = sa(c); if (!s) return null; if (/^SU[SA]/.test(s)) return 'SUS'; if (/^PART/.test(s)) return 'Particular'; if (/^UNI|INTERCAM/.test(s)) return 'Unimed'; return 'Outros convênios' }
export const salaDe = (hospital, sala) => { let s = sa(sala).replace(/\bSALA 0(\d)\b/, 'SALA $1'); let m = /^(SALA \d+)/.exec(s); if (hospital === 'hro' && m) return m[1]; m = /^(BLOCO [AM])/.exec(s); if (m) return m[1]; if (hospital === 'unimed' && /^SALA \d+$/.test(s)) return 'CC - ' + s; if (/^AMBULAT/.test(s)) return 'AMBULATORIAL'; return s.replace(/ ROBOTICA$/, '') }
// ---- pares limpos e modelo de duração
export const paresLimpos = casos.filter((c) => c.data >= '2026-10-02' && !c.cont).map((c) => { const i = min(c.ini), t = min(c.ter); if (i == null || t == null) return null; const dur = (t - i + 1440) % 1440; if (dur < 5 || dur > 720) return null; const f = familia(c.procedimento); if (generica(f)) return null; const l = evPorCaso.get(c.id) || []; const lote = l.some((e) => e.tam >= 3 && ((e.para === 'iniciada' && hmBRT(e.em) === c.ini) || (e.para === 'terminada' && hmBRT(e.em) === c.ter))); return lote ? null : { id: c.id, data: c.data, hospital: c.hospital, f, ck: cirK(c.hospital, c.cirurgiao), dur } }).filter(Boolean)
const durLimpa = new Map(paresLimpos.map((p) => [p.id, p.dur]))
const segunda = (data) => { const d = new Date(data + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10) }
const cacheM = new Map()
// modo 'anterior' = só pares de semanas anteriores (simulador); 'fora' = todas as semanas menos a do turno (descritivo)
export const modelo = (data, modo = 'anterior') => { const seg = segunda(data); const k = modo + seg; if (cacheM.has(k)) return cacheM.get(k); const tr = paresLimpos.filter((p) => modo === 'anterior' ? p.data < seg : segunda(p.data) !== seg); const g = (kf) => { const m = new Map(); for (const p of tr) { const kk = kf(p); if (!kk) continue; if (!m.has(kk)) m.set(kk, []); m.get(kk).push(p.dur) } return new Map([...m].filter(([, a]) => a.length >= 3).map(([kk, a]) => [kk, med(a)])) }; const M = { n: tr.length, H: g((p) => p.hospital), F: g((p) => p.f), FH: g((p) => p.f + '|' + p.hospital), C: g((p) => p.ck && p.hospital + '|' + p.ck), FC: g((p) => p.ck && p.f + '|' + p.hospital + '|' + p.ck) }; cacheM.set(k, M); return M }
export const prever = (it, M) => { const f = familia(it.procedimento); const k = it.cir && it.hospital + '|' + it.cir; return M.FC.get(k && f + '|' + k) ?? M.FH.get(f + '|' + it.hospital) ?? M.F.get(f) ?? teMin(it.tempo_estimado) ?? M.C.get(k) ?? M.H.get(it.hospital) ?? 80 }
// ---- turnos
const escPor = new Map(escalas.map((e) => [e.data + '|' + e.hospital, e]))
const arr = (o, turno) => !o ? [] : Array.isArray(o) ? (turno === 'matutino' ? o : []) : (o[turno] || [])
const finais = new Map(); for (const c of casos) { if (!c.turno) continue; const k = c.data + '|' + c.hospital + '|' + c.turno; if (!finais.has(k)) finais.set(k, []); finais.get(k).push(c) }
const pubPor = new Map(); for (const r of cap) { if (r.tipo !== 'alocacao' || !r.detalhe?.publicacao || !r.turno) continue; const k = r.data + '|' + r.hospital + '|' + r.turno; if (!pubPor.has(k)) pubPor.set(k, []); pubPor.get(k).push(r) }
const chave = (x) => [sa(x.sala), (x.hora || '').trim(), sa(x.cirurgiao), sa(x.procedimento)].join('|')
const POS = new Set(['srpa', 'consultorio'])
export const turnos = []
for (const [k, fin] of [...finais].sort((a, b) => a[0] < b[0] ? -1 : 1)) { const [data, hospital, turno] = k.split('|'); if (!util(data)) continue
  const e = escPor.get(data + '|' + hospital); const rod = arr(e?.ordem_liberacao, turno); if (rod.length < (hospital === 'materno' ? 2 : 4)) continue
  const aj = new Set(arr(e?.ajuda_externa, turno).map(limpaNome))
  // plano
  let itens, fonte
  const pub = pubPor.get(k)
  if (pub) { const ini = Date.parse(`${data}T${turno === 'matutino' ? '07:00' : '13:00'}:00-03:00`); const lts = [...new Set(pub.map((r) => r.em))].sort(); const antes = lts.filter((x) => Date.parse(x) <= ini + 30 * 60e3); const esc = antes.length ? antes[antes.length - 1] : lts[0]
    const porCh = new Map(); for (const c of fin) { const ch = chave(c); if (!porCh.has(ch)) porCh.set(ch, []); porCh.get(ch).push(c) }
    itens = pub.filter((r) => r.em === esc).map((r) => { const l = porCh.get(chave(r)); const c = l?.length ? l.shift() : null; return { sala: r.sala, hora: r.hora, cirurgiao: r.cirurgiao, procedimento: r.procedimento, convenio: r.convenio, tipo: r.tipo_caso, tempo_estimado: r.tempo_estimado, anest: r.anestesista, uid: r.uid, cont: !!r.detalhe?.continuacao, bloco: r.detalhe?.bloco || c?.bloco || 'normal', susp: r.detalhe?.extra === 'suspensa', c } }); fonte = 'publicado' }
  else { itens = fin.filter((c) => c.origem !== 'manual').map((c) => ({ sala: c.sala, hora: c.hora, cirurgiao: c.cirurgiao, procedimento: c.procedimento, convenio: c.convenio, tipo: c.tipo, tempo_estimado: c.tempo_estimado, anest: c.anestesista, uid: c.uid, cont: c.cont, bloco: c.bloco || 'normal', susp: false, c })); fonte = 'final' }
  const Mdesc = modelo(data, 'fora'), Mant = modelo(data, 'anterior'); const t0 = turno === 'matutino' ? 420 : 780, t1 = turno === 'matutino' ? 780 : 1140
  const B = new Map()
  for (const it of itens) { if (it.susp) continue; it.hospital = hospital; it.cir = cirK(hospital, it.cirurgiao)
    let donos = it.uid ? [it.uid] : /\+/.test(it.anest || '') ? it.anest.split('+').map(uidDe).filter(Boolean) : []
    const sala = salaDe(hospital, it.sala); const kb = sala + '|' + (donos.length ? [...donos].sort().join('+') : 'SEM')
    if (!B.has(kb)) B.set(kb, { sala, salaK: hospital + '|' + sala, donos, itens: [], hospital, turno, data }); B.get(kb).itens.push(it) }
  const blocos = [...B.values()].map((b, i) => { const its = b.itens; const pos = its.every((x) => POS.has(x.bloco)); const cir = (() => { const f = {}; for (const x of its) if (x.cir) f[x.cir] = (f[x.cir] || 0) + 1; return Object.entries(f).sort((a, b) => b[1] - a[1])[0]?.[0] || null })()
    const esp = (() => { const f = {}; for (const x of its) { const e2 = espDe(x.procedimento); if (e2) f[e2] = (f[e2] || 0) + 1 } return Object.entries(f).sort((a, b) => b[1] - a[1])[0]?.[0] || null })()
    const conv = (() => { const f = {}; for (const x of its) { const e2 = convDe(x.convenio); if (e2) f[e2] = (f[e2] || 0) + 1 } return Object.entries(f).sort((a, b) => b[1] - a[1])[0]?.[0] || null })()
    const hs = its.map((x) => min(x.hora)).filter((x) => x != null); const ini = hs.length ? Math.min(...hs) : t0
    const tes = its.map((x) => teMin(x.tempo_estimado)); const somaMapa = !pos && tes.length && tes.every((x) => x != null) ? tes.reduce((a, c) => a + c, 0) : null
    const soma = (M) => its.reduce((s, x) => s + (x.cont ? 60 : prever(x, M)), 0) + 20 * (its.length - 1)
    const prevMin = pos ? null : soma(Mdesc); const prevFim = pos ? t1 : ini + soma(Mdesc); const prevFimAnt = pos ? t1 : Mant.n >= 300 ? ini + soma(Mant) : null
    const cs = its.map((x) => x.c)
    const okReal = !pos && cs.every((c) => c && c.st === 'terminada' && min(c.ter) != null && c.ex !== 'passa_tarde'); const realFim = okReal ? Math.max(...cs.map((c) => { let v = min(c.ter); const i0 = min(c.ini); if (i0 != null && v < i0) v += 1440; return v })) : null
    const realMin = !pos && cs.every((c) => c && durLimpa.has(c.id)) ? cs.reduce((s, c) => s + durLimpa.get(c.id), 0) : null
    const fu = {}; for (const c of cs) if (c?.uid) fu[c.uid] = (fu[c.uid] || 0) + 1; const donoFinal = Object.entries(fu).sort((a, b) => b[1] - a[1])[0]?.[0] || null
    const local = pos ? its[0].bloco : its[0].bloco !== 'normal' ? its[0].bloco : /^CO /.test(b.sala) ? 'co' : /EMERG/.test(sa(its[0].sala)) ? 'emergencia' : 'cc'
    return { id: i, ...b, pos, n: pos ? 0 : its.length, cir, esp, conv, local, ini, somaMapa, prevMin, prevFim, prevFimAnt, realFim, realMin, donoFinal, ped: its.some((x) => x.c?.ped === true), urg: its.some((x) => x.tipo && x.tipo !== 'eletiva'), atravessa: its.some((x) => x.cont || x.c?.ex === 'passa_tarde'), res: cs.filter((c) => c?.res).map((c) => c.res) } })
  // pessoas
  const outros = ['unimed', 'hro', 'materno'].filter((h) => h !== hospital).flatMap((h) => arr(escPor.get(data + '|' + h)?.ordem_liberacao, turno).map(uidDe))
  const n = rod.length; let plantIdx = rod.findIndex((nm) => !aj.has(limpaNome(nm))); if (plantIdx < 0) plantIdx = 0
  const P = rod.map((nm, idx) => { const uid = uidDe(nm); return { uid, nome: nm, idx, saida: n - 1 - idx, pct: n > 1 ? (n - 1 - idx) / (n - 1) : 0, plant: idx === plantIdx, ultimo: idx === n - 1, ajuda: aj.has(limpaNome(nm)), outroHosp: !!uid && outros.includes(uid), nota: notaNome(nm), noRodape: true } })
  const porUid = new Map(P.filter((p) => p.uid).map((p) => [p.uid, p]))
  for (const b of blocos) for (const u of b.donos) if (!porUid.has(u)) { const p = { uid: u, nome: nomeP(u), idx: -1, saida: -1, pct: -0.05, plant: false, ultimo: false, ajuda: true, outroHosp: outros.includes(u), nota: null, noRodape: false }; P.push(p); porUid.set(u, p) }
  for (const p of P) { p.blocos = blocos.filter((b) => b.donos.includes(p.uid)); p.nCasos = p.blocos.reduce((s, b) => s + b.n, 0)
    p.papel = !p.noRodape ? 'fora do rodapé' : p.plant ? 'plantonista (1º)' : p.ultimo ? 'último (contraturno)' : p.ajuda ? 'ajuda (azul)' : null }
  turnos.push({ k, data, hospital, turno, fonte, e, rod, P, porUid, blocos, n })
}
export const hhmm = (m) => { if (m == null) return '—'; const t = Math.round(m) % 1440; return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0') }
export const spearman = (x, y) => { const rk = (a) => { const s = a.map((v, i) => [v, i]).sort((p, q2) => p[0] - q2[0]); const r = Array(a.length); let i = 0; while (i < s.length) { let j = i; while (j + 1 < s.length && s[j + 1][0] === s[i][0]) j++; for (let k = i; k <= j; k++) r[s[k][1]] = (i + j) / 2; i = j + 1 } return r }; const a = rk(x), b = rk(y); const n = a.length; const ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n; let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2 } return saa && sbb ? sab / Math.sqrt(saa * sbb) : null }
export const embaralha = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]] } return a }
// ---- afinidades: O, E e p por permutação dentro do turno (nulo livre e nulo por FAIXA de saída)
export const DIMS = { cir: (b) => b.cir && b.hospital + ':' + b.cir, esp: (b) => b.esp, sala: (b) => b.salaK, local: (b) => b.hospital + ':' + b.local, ped: (b) => b.pos ? null : b.ped ? 'pediátrico' : null }
export function afinidades(ts, { perms = 1000, faixas = 3 } = {}) {
  const linhas = [] // {ti, uid, faixa, b}
  ts.forEach((t, ti) => { for (const b of t.blocos) { if (b.donos.length !== 1) continue; const p = t.porUid.get(b.donos[0]); const fx = !p || !p.noRodape ? -1 : Math.min(faixas - 1, Math.floor(p.pct * faixas)); linhas.push({ ti, uid: b.donos[0], fx, b }) } })
  const feats = linhas.map((l) => Object.entries(DIMS).map(([d, f]) => { const v = f(l.b); return v ? d + '|' + v : null }).filter(Boolean))
  const conta = (uids) => { const m = new Map(); for (let i = 0; i < linhas.length; i++) for (const f of feats[i]) { const k = uids[i] + '|' + f; m.set(k, (m.get(k) || 0) + 1) } return m }
  const real = linhas.map((l) => l.uid); const O = conta(real)
  // oportunidades e candidatos: todo par (a, x) em que a trabalha num turno onde x aparece
  const porT = new Map(); linhas.forEach((l, i) => { if (!porT.has(l.ti)) porT.set(l.ti, []); porT.get(l.ti).push(i) })
  const E = new Map(), OP = new Map()
  for (const idx of porT.values()) { const N = idx.length; const na = {}; const nx = {}; for (const i of idx) { na[real[i]] = (na[real[i]] || 0) + 1; for (const f of feats[i]) nx[f] = (nx[f] || 0) + 1 } for (const a of Object.keys(na)) for (const f of Object.keys(nx)) { const k = a + '|' + f; E.set(k, (E.get(k) || 0) + nx[f] * na[a] / N); OP.set(k, (OP.get(k) || 0) + 1) } }
  const st = new Map(); for (const k of E.keys()) st.set(k, { geL: 0, leL: 0, geF: 0, leF: 0, sF: 0 })
  const grupos = (porFaixa) => { const g = []; for (const idx of porT.values()) { if (!porFaixa) { g.push(idx); continue } const m = {}; for (const i of idx) (m[linhas[i].fx] ||= []).push(i); g.push(...Object.values(m)) } return g }
  const gL = grupos(false), gF = grupos(true)
  const conc = { real: 0, L: [], F: [] }; const concDim = {}
  const somaQ = (m) => { const o = {}; for (const [k, v] of m) { const d = k.split('|')[1]; o[d] = (o[d] || 0) + v * v } return o }
  const qReal = somaQ(O)
  const qL = {}, qF = {}
  for (let r = 0; r < perms; r++) { for (const [modo, gs] of [['L', gL], ['F', gF]]) { const u = real.slice(); for (const g of gs) { const us = embaralha(g.map((i) => real[i])); g.forEach((i, j) => u[i] = us[j]) } const m = conta(u); for (const [k, s] of st) { const v = m.get(k) || 0, o = O.get(k) || 0; if (modo === 'L') { if (v >= o) s.geL++; if (v <= o) s.leL++ } else { if (v >= o) s.geF++; if (v <= o) s.leF++; s.sF += v } } const qq = somaQ(m); for (const d of Object.keys(qReal)) ((modo === 'L' ? qL : qF)[d] ||= []).push(qq[d] || 0) } }
  const pares = [...st].map(([k, s]) => { const [uid, dim, ...r] = k.split('|'); return { k, uid, dim, x: r.join('|'), O: O.get(k) || 0, E: E.get(k), EF: s.sF / perms, op: OP.get(k), pPrefL: s.geL / perms, pExclL: s.leL / perms, pPrefF: s.geF / perms, pExclF: s.leF / perms } })
  const global = Object.keys(qReal).map((d) => { const z = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length; const sd = Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); return (qReal[d] - m) / sd }; return { dim: d, zLivre: z(qL[d]), zFaixa: z(qF[d]) } })
  return { pares, global, nBlocos: linhas.length }
}

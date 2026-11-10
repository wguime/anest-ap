import { ler, min, med, q, r1, sa } from './comum.mjs'
const casos = ler('casos'); const cap = ler('captura')
const porId = new Map(casos.map((c) => [c.id, c]))
const chave = (x) => [x.data, x.hospital, sa(x.sala), (x.hora || '').trim(), sa(x.cirurgiao), sa(x.procedimento)].join('|')
const porChave = new Map(); for (const c of casos) { const k = chave(c); porChave.set(k, porChave.has(k) ? null : c) }
const tipos = {}; for (const r of cap) { const k = r.tipo + (r.detalhe?.publicacao ? ':pub' : ''); tipos[k] = (tipos[k] || 0) + 1 }
console.log('captura por tipo:', tipos)
const est = cap.filter((r) => r.tipo === 'estimativa')
console.log('estimativas:', est.length, '| com valor_para:', est.filter((r) => r.valor_para).length, '| zeradas (valor_para null):', est.filter((r) => !r.valor_para).length, '| status no momento:', est.reduce((o, r) => { const k = (r.detalhe?.statusDe || '-') + '>' + (r.detalhe?.status || '-'); o[k] = (o[k] || 0) + 1; return o }, {}))
// por caso: 1ª estimativa informada com a cirurgia NÃO terminada, e a última antes do fim
const g = new Map(); let orf = 0, relig = 0
for (const r of est) { let c = porId.get(r.caso_id); if (!c) { c = porChave.get(chave(r)); if (c) relig++; else { orf++; continue } } if (!g.has(c.id)) g.set(c.id, { c, l: [] }); g.get(c.id).l.push(r) }
console.log('casos com estimativa:', g.size, '| estimativas órfãs (caso apagado, sem religar):', orf, '| religadas por chave:', relig)
const e1 = [], eU = [], ant = [], vies = [], proprio = []
let semReal = 0
for (const { c, l } of g.values()) {
  const tr = min(c.ter), ti = min(c.ini); if (tr == null) { semReal++; continue }
  l.sort((a, b) => a.seq - b.seq)
  const inf = l.filter((r) => r.valor_para && r.detalhe?.status !== 'terminada')
  if (!inf.length) continue
  const d = (a, b) => { let x = a - b; if (x > 720) x -= 1440; if (x < -720) x += 1440; return x }
  const p = inf[0], u = inf[inf.length - 1]
  const emMin = (iso) => { const t = new Date(Date.parse(iso) - 3 * 3600e3); return t.getUTCHours() * 60 + t.getUTCMinutes() }
  const err1 = d(min(p.valor_para), tr); if (Math.abs(err1) > 600) continue
  e1.push(Math.abs(err1)); vies.push(err1); eU.push(Math.abs(d(min(u.valor_para), tr)))
  ant.push(d(tr, emMin(p.em)))   // antecedência: quanto antes do fim real a 1ª estimativa foi dada
  proprio.push(p.por === c.uid ? 1 : 0)
}
console.log(`casos com estimativa e término real: n=${e1.length} (sem término real: ${semReal})`)
console.log(` erro |1ª estimativa − término real|: MdAE ${med(e1)} | p75 ${q(e1, .75)} | ≤15min ${(100 * e1.filter((x) => x <= 15).length / e1.length).toFixed(0)}% | viés mediano ${med(vies)} (negativo = otimista)`)
console.log(` erro |última estimativa − real|: MdAE ${med(eU)}`)
console.log(` antecedência da 1ª estimativa em relação ao fim real: mediana ${med(ant)} min | p25 ${q(ant, .25)} | p75 ${q(ant, .75)} | dadas >=60 min antes: ${(100 * ant.filter((x) => x >= 60).length / ant.length).toFixed(0)}% | dadas DEPOIS do fim: ${(100 * ant.filter((x) => x <= 0).length / ant.length).toFixed(0)}%`)
console.log(` pelo próprio anestesista: ${(100 * proprio.reduce((a, b) => a + b, 0) / proprio.length).toFixed(0)}%`)
// erro por antecedência
for (const [lo, hi] of [[-999, 0], [1, 30], [31, 60], [61, 120], [121, 999]]) { const idx = ant.map((a, i) => a >= lo && a <= hi ? i : -1).filter((i) => i >= 0); if (idx.length) console.log(`   antecedência ${lo}..${hi}: n=${idx.length} MdAE ${med(idx.map((i) => e1[i]))}`) }
// cobertura: % dos casos terminados (02/10+) que tiveram estimativa antes do fim
const term = casos.filter((c) => c.hospital !== 'fds' && c.data >= '2026-10-02' && c.st === 'terminada')
console.log('cobertura: casos terminados 02/10+:', term.length, '| com alguma estimativa capturada:', term.filter((c) => g.has(c.id)).length)
// estimativa_total
const et = cap.filter((r) => r.tipo === 'estimativa_total'); console.log('estimativa_total:', et.length, '| com valor:', et.filter((r) => r.valor_para).length, '| pessoas-turno distintas:', new Set(et.map((r) => r.escala_id + '|' + r.anestesista)).size)
// realocacao
const re = cap.filter((r) => r.tipo === 'realocacao'); const cs = new Set(re.map((r) => r.caso_id))
console.log('realocacao:', re.length, '| casos distintos:', cs.size, '| com status terminada no momento:', re.filter((r) => r.detalhe?.status === 'terminada').length, '| de sem-anestesista p/ alguém:', re.filter((r) => r.detalhe?.semAnestesistaDe && !r.detalhe?.semAnestesistaPara).length)
const al = cap.filter((r) => r.tipo === 'alocacao'); console.log('alocacao:', al.length, '| publicacao:', al.filter((r) => r.detalhe?.publicacao).length, '| manual:', al.filter((r) => r.detalhe?.origem === 'manual').length, '| sem uid:', al.filter((r) => !r.uid).length, '| semAnestesista:', al.filter((r) => r.detalhe?.semAnestesista).length)
const od = cap.filter((r) => r.tipo === 'ordem'); console.log('ordem:', od.length, '| por hospital:', od.reduce((o, r) => { o[r.hospital] = (o[r.hospital] || 0) + 1; return o }, {}), '| não-publicação:', od.filter((r) => !r.detalhe?.publicacao).length)

import { describe, it, expect } from 'vitest'
import {
  tituloNome, razao, faixa, formatarPct, classificarSituacao, montarPessoas, ordenarPessoas,
  resumirCargos, indicadoresGrupo, melhores10, proximoPasso, resumoCard, mediana,
  rotuloMes, mesAnterior, limitesMes, montarVista, serieEvolucao, tendencia, tamanhoTopo, indiceUso,
} from '@/lib/escalaAdesao'

const linha = (over = {}) => ({
  cargo: 'anest', role: 'anestesiologista', nome: 'FULANO DE TAL',
  d7: 5, dn: 20, aberturas: 100, acoes: 50, trocas: 0, ini_n: 10, ter_n: 10,
  de: 20, de7: 5, dne: 16, d7e: 5, dnu: 16, d7u: 5,
  casos: 40, ini_eu: 20, ter_eu: 24, ini_qq: 30, ter_qq: 36, tp_inf: 4, turnos: 20, tot_eu: 10, nunca: false,
  ...over,
})

const rel = (pessoas, hospitais = []) => ({ dias: 30, desde: '2026-08-24', ate: '2026-09-22', uteis: 20, uteis7: 5, pessoas, hospitais })

describe('escalaAdesao — formatação', () => {
  it('nome em caixa alta vira título com partículas minúsculas', () => {
    expect(tituloNome('JOÃO HENRIQUE SALVÃO VANNI')).toBe('João Henrique Salvão Vanni')
    expect(tituloNome('ELISETE DOS SANTOS')).toBe('Elisete dos Santos')
    expect(tituloNome('DA SILVA')).toBe('Da Silva') // 1ª palavra sempre maiúscula
  })

  it('razão sem denominador é null (não se aplica), não zero', () => {
    expect(razao(0, 0)).toBeNull()
    expect(razao(1, 4)).toBe(25)
    expect(formatarPct(null)).toBe('—')
    expect(formatarPct(59.4)).toBe('59%')
  })

  it('faixas: zero, abaixo da metade, metade ou mais, meta, não se aplica', () => {
    expect(faixa(null, 80)).toBe('na')
    expect(faixa(0, 80)).toBe('crit')
    expect(faixa(39.9, 80)).toBe('low')
    expect(faixa(40, 80)).toBe('mid')
    expect(faixa(80, 80)).toBe('ok')
  })

  it('mediana ignora null e média dos dois do meio em lista par', () => {
    expect(mediana([3, null, 1, 2])).toBe(2)
    expect(mediana([1, 2, 3, 4])).toBe(2.5)
    expect(mediana([null])).toBeNull()
  })
})

describe('escalaAdesao — situação (janela de 30 dias)', () => {
  const base = { nunca: false, d7: 5, base7: 5, abre7: 100, abre30: 80, anest: true, uso30: 60, ter30: 60, iniN30: 0, terN30: 0 }

  it('anestesista: nunca > sem uso na semana > baixo acesso (abre < 40%) > não marca (término próprio < 20%)', () => {
    expect(classificarSituacao({ ...base, nunca: true, d7: 0 })).toBe('nun')
    expect(classificarSituacao({ ...base, d7: 0 })).toBe('sem')
    expect(classificarSituacao({ ...base, abre30: 39, d7: 1, abre7: 20, ter30: 10 })).toBe('bx')
    expect(classificarSituacao({ ...base, uso30: 45, ter30: 19 })).toBe('nm')
  })

  it('"baixo acesso" mede só acesso: abre quase todo dia com índice baixo NÃO é baixo acesso (dono 24/09)', () => {
    expect(classificarSituacao({ ...base, abre30: 84, uso30: 23, ter30: 0 })).toBe('nm')
    expect(classificarSituacao({ ...base, abre30: 67, uso30: 29, ter30: 26 })).toBe('mid')
    expect(classificarSituacao({ ...base, abre30: 35, d7: 4, abre7: 80, uso30: 60 })).toBe('ok') // semana forte
  })

  it('anestesista: engajado com índice 50+ (dono 24/09), pode melhorar abaixo', () => {
    expect(classificarSituacao({ ...base, uso30: 50 })).toBe('ok')
    expect(classificarSituacao({ ...base, uso30: 49 })).toBe('mid')
    expect(classificarSituacao({ ...base, uso30: 30 })).toBe('mid')
  })

  it('semana sem nenhum dia na escala (férias, consultório) não vira "sem uso na semana"', () => {
    expect(classificarSituacao({ ...base, d7: 0, base7: 0, abre7: null })).toBe('ok')
  })

  it('quem não tem cirurgia própria: abrir a escala + marcações (10+)', () => {
    const outro = { ...base, anest: false, uso30: 80, ter30: null }
    expect(classificarSituacao({ ...outro, iniN30: 6, terN30: 4 })).toBe('ok')
    expect(classificarSituacao({ ...outro, iniN30: 5, terN30: 4 })).toBe('mid')
    expect(classificarSituacao({ ...outro, abre30: 35, d7: 2, abre7: 40 })).toBe('bx')
    expect(classificarSituacao({ ...outro, abre30: 35, d7: 4, abre7: 80, iniN30: 6, terN30: 4 })).toBe('ok') // semana forte
  })
})

describe('escalaAdesao — montarPessoas', () => {
  it('abre a escala = dias em que abriu ÷ dias em que estava na escala', () => {
    const [p] = montarPessoas(rel([linha({ de: 9, dne: 7, de7: 2, d7e: 0 })]), null)
    expect(p.base30).toBe(9)
    expect(p.d30).toBe(7)
    expect(Math.round(p.abre30)).toBe(78)
    expect(p.base7).toBe(2)
  })

  it('demais cargos: base = dias úteis da janela (feriado conta) e o uso é o próprio "abre"', () => {
    const [p] = montarPessoas(rel([linha({ cargo: 'enf', role: 'tec-enfermagem', casos: 0, dnu: 15, d7u: 4 })]), null)
    expect(p.base30).toBe(20)
    expect(p.abre30).toBe(75)
    expect(p.uso30).toBe(75)
    expect(p.abre7).toBe(80)
  })

  it('índice de uso = média dos 5 itens contra a meta, cada um limitado a 100', () => {
    expect(indiceUso({ abre: 100, ini: 100, ter: 100, tp: 100, tot: 100 })).toBe(100)
    expect(indiceUso({ abre: 0, ini: null, ter: 0, tp: 0, tot: 0 })).toBe(0)
    // abre 80 (≥ meta 70 → 100) · ini 50/80 · ter 60/80 · tp 10/50 · tot 50/80
    const [p] = montarPessoas(rel([linha()]), null)
    expect(p.uso30).toBeCloseTo((100 + 62.5 + 75 + 20 + 62.5) / 5)
    expect(p.situacao).toBe('ok')
  })

  it('início/término contam o que a PRÓPRIA pessoa marcou; a sala (qualquer um) fica ao lado', () => {
    const [p] = montarPessoas(rel([linha()]), rel([linha({ dn: 35, casos: 80, ter_eu: 40, ter_qq: 60 })]))
    expect(p.nome).toBe('Fulano de Tal')
    expect(p.ini30).toBe(50)
    expect(p.iniSala30).toBe(75)
    expect(p.ter30).toBe(60)
    expect(p.terSala30).toBe(90)
    expect(p.ter60).toBe(50)
    expect(p.terSala60).toBe(75)
    expect(p.tot30).toBe(50)
  })

  it('só abrir o app não basta: abre 100% sem marcar nada tem índice 20 e fica em "não marca"', () => {
    const [p] = montarPessoas(rel([linha({ dne: 20, ini_eu: 0, ter_eu: 0, tp_inf: 0, tot_eu: 0 })]), null)
    expect(p.abre30).toBe(100)
    expect(p.uso30).toBe(20)
    expect(p.situacao).toBe('nm')
  })

  it('quem não trabalhou nenhum dia no período sai da lista (sem rótulo de férias — dono 24/09)', () => {
    const lista = montarPessoas(rel([linha({ nome: 'FERIAS', de: 0, de7: 0, dne: 0, d7e: 0, casos: 0, nunca: true }), linha()]), null)
    expect(lista.map((p) => p.nome)).toEqual(['Fulano de Tal'])
  })

  it('nome curto = primeiro + último, como na escala; sobrenome composto inteiro', () => {
    const [a, b] = montarPessoas(rel([linha({ nome: 'MATHEUS LEMOS VIEIRA DA CUNHA' }), linha({ nome: 'ADRIANO DALL MAGRO' })]), null)
    expect(a.nomeCurto).toBe('Matheus Cunha')
    expect(a.primeiro).toBe('Matheus')
    expect(b.nomeCurto).toBe('Adriano Dall Magro')
  })

  it('JSON antigo (cache de antes de 24/09) cai nos dias corridos e no "próprio"', () => {
    const velho = linha()
    for (const k of ['de', 'de7', 'dne', 'd7e', 'dnu', 'd7u', 'ini_qq', 'ter_qq']) delete velho[k]
    const [p] = montarPessoas({ dias: 30, pessoas: [{ ...velho, d7: 8 }], hospitais: [] }, null)
    expect(p.base30).toBe(30)
    expect(p.d30).toBe(20)
    expect(p.d7).toBe(7) // a janela de 7×24h pode cruzar 8 datas
    expect(p.ter30).toBe(60)
  })

  it('anestesista sem nenhuma cirurgia no período não é tratado como "0%"', () => {
    const [p] = montarPessoas(rel([linha({ casos: 0, turnos: 0, ini_eu: 0, ter_eu: 0, ini_qq: 0, ter_qq: 0, tot_eu: 0 })]), null)
    expect(p.anest).toBe(false)
    expect(p.ter30).toBeNull()
  })

  it('conta de hospital mantém o nome como está e ganha subtítulo', () => {
    const [p] = montarPessoas(rel([linha({ cargo: 'hosp', role: 'func-unimed', nome: 'UNIMED', casos: 0 })]), null)
    expect(p.nome).toBe('UNIMED')
    expect(p.sub).toBe('conta do hospital')
  })

  it('sem a janela de 60 dias, os campos de 60 repetem os de 30', () => {
    const [p] = montarPessoas(rel([linha()]), null)
    expect(p.d60).toBe(p.d30)
    expect(p.uso60).toBe(p.uso30)
    expect(p.ter60).toBe(p.ter30)
  })
})

describe('escalaAdesao — ordem, cargos, grupo, ficha e card', () => {
  const pessoas = montarPessoas(rel([
    linha({ nome: 'ANA', ter_eu: 36 }),               // ok
    linha({ nome: 'BRUNO', ter_eu: 2 }),              // nm (índice ~50, término próprio 5%)
    linha({ nome: 'CARLA', d7e: 0 }),                 // sem
    linha({ cargo: 'enf', role: 'tec-enfermagem', nome: 'DORA', casos: 0, ini_n: 30, ter_n: 30 }), // ok
    linha({ cargo: 'sec', role: 'secretaria', nome: 'EVA', d7: 0, dn: 0, dnu: 0, d7u: 0, aberturas: 0, casos: 0, ini_n: 0, ter_n: 0, nunca: true }),
  ]), null)

  it('alertas primeiro: nunca/sem uso antes de não marca, engajados por último', () => {
    const anest = ordenarPessoas(pessoas.filter((p) => p.cargo === 'anest'), 'sit').map((p) => p.nome)
    expect(anest).toEqual(['Carla', 'Bruno', 'Ana'])
  })

  it('resumo por cargo conta alertas e omite cargos vazios', () => {
    const r = resumirCargos(pessoas)
    expect(r.map((c) => c.cargo)).toEqual(['anest', 'enf', 'sec'])
    expect(r[0].alertas).toBe(2)
    expect(r[2].situacoes.nun).toBe(1)
    expect(r[1].ter30).toBeNull() // mediana de término só para anestesistas
  })

  it('indicadores do grupo vêm da linha total dos hospitais', () => {
    const g = indicadoresGrupo(rel([], [{ hospital: 'total', casos: 200, com_ini: 90, com_ter: 120, com_tp: 10, turnos: 100, com_total: 16 }]))
    expect(g.ini).toBe(45)
    expect(g.ter).toBe(60)
    expect(g.tp).toBe(5)
    expect(g.tot).toBe(16)
    expect(indicadoresGrupo(rel([]))).toBeNull()
  })

  it('média top N = média dos 10% de anestesistas com o valor mais alto (não a média do grupo)', () => {
    const lista = Array.from({ length: 20 }, (_, i) => ({ anest: true, ter30: i * 5 }))
    expect(tamanhoTopo(lista)).toBe(2)
    expect(tamanhoTopo(Array.from({ length: 46 }, () => ({ anest: true })))).toBe(5)
    expect(melhores10(lista, 'ter30')).toBe(92.5) // 2 melhores: 95 e 90
    expect(melhores10([{ anest: false, ter30: 10 }], 'ter30')).toBeNull()
  })

  it('próximo passo aponta a MAIOR lacuna e uma ação só', () => {
    const bruno = pessoas.find((p) => p.nome === 'Bruno')
    expect(proximoPasso(bruno).passo).toMatch(/Terminada/)
    const eva = pessoas.find((p) => p.nome === 'Eva')
    expect(proximoPasso(eva).texto).toMatch(/Ainda não abriu/)
    const carla = pessoas.find((p) => p.nome === 'Carla')
    expect(proximoPasso(carla).texto).toMatch(/nesta semana/)
  })

  it('card: 4 mini-indicadores e contagem de alertas', () => {
    const r = rel([linha({ ter_eu: 2 }), linha({ nome: 'OUTRO' })], [{ hospital: 'total', casos: 10, com_ini: 5, com_ter: 6, com_tp: 0, turnos: 5, com_total: 1 }])
    expect(resumoCard(r)).toEqual({ ini: 50, ter: 60, tot: 20, alertas: 1 })
    expect(resumoCard(null)).toBeNull()
  })
})

describe('escalaAdesao — abas por mês e evolução', () => {
  it('rótulo e mês anterior, inclusive na virada do ano', () => {
    expect(rotuloMes('2026-09')).toBe('set/26')
    expect(rotuloMes('2027-01')).toBe('jan/27')
    expect(mesAnterior('2026-09')).toBe('2026-08')
    expect(mesAnterior('2027-01')).toBe('2026-12')
  })

  it('mês fechado vai do dia 1 ao último; mês corrente para em ONTEM', () => {
    const hoje = new Date(2026, 8, 23) // 23/09/2026
    expect(limitesMes('2026-08', hoje)).toEqual({ desde: '2026-08-01', ate: '2026-08-31', dias: 31, parcial: false })
    expect(limitesMes('2026-09', hoje)).toEqual({ desde: '2026-09-01', ate: '2026-09-22', dias: 22, parcial: true })
    expect(limitesMes('2026-02', hoje).ate).toBe('2026-02-28')
  })

  it('mês corrente vai até HOJE quando o dia já foi gravado à noite (escala de amanhã publicada)', () => {
    const hoje = new Date(2026, 8, 23, 21, 0)
    expect(limitesMes('2026-09', hoje, '2026-09-23').ate).toBe('2026-09-23')
    expect(limitesMes('2026-09', hoje, '2026-09-22').ate).toBe('2026-09-22')
    expect(limitesMes('2026-09', hoje, '2026-09-30').ate).toBe('2026-09-22') // futuro é ignorado
    expect(montarVista('2026-09', { hoje, gravadoAte: '2026-09-23' }).rotA).toBe('set/26 (até 23/09)')
  })

  it('vista: 30/60 comparam entre si; mês compara com o anterior; corte do índice é 50 em toda aba', () => {
    const hoje = new Date(2026, 8, 23)
    const v30 = montarVista('30', { r30: 'A', r60: 'B', hoje })
    expect([v30.relA, v30.relB, v30.metaUso, v30.curtoB]).toEqual(['A', 'B', 50, '60d'])
    const v60 = montarVista('60', { r30: 'A', r60: 'B', hoje })
    expect([v60.relA, v60.relB, v60.metaUso, v60.situacaoDe30]).toEqual(['B', 'A', 50, true])
    const vset = montarVista('2026-09', { mesA: 'M', mesB: 'N', hoje })
    expect(vset.relA).toBe('M')
    expect(vset.rotA).toBe('set/26 (até 22/09)')
    expect(vset.curtoB).toBe('ago/26')
    expect(vset.metaUso).toBe(50)
  })

  it('série semanal em % e semana completa = o domingo dela já passou', () => {
    const hoje = new Date(2026, 8, 23)
    const [s] = serieEvolucao([{ semana: '2026-09-14', de: '2026-09-14', ate: '2026-09-18', casos: 200, com_ini: 100, com_ter: 150, com_tp: 10, turnos: 100, com_total: 20, ter_eu: 40, casos_anest: 190, pessoas: 50, anest: 40, enf: 5, res: 3, outros: 2 }], hoje)
    expect([s.ini, s.ter, s.tot, s.tp]).toEqual([50, 75, 20, 5])
    expect(Math.round(s.terAnest)).toBe(21)
    expect(s.completa).toBe(true) // terminou na sexta (sem escala no FDS) e é completa
    const [p] = serieEvolucao([{ semana: '2026-09-21', de: '2026-09-21', ate: '2026-09-22', casos: 1, com_ini: 0, com_ter: 0, com_tp: 0, turnos: 1, com_total: 0 }], hoje)
    expect(p.completa).toBe(false)
  })

  it('tendência: última semana completa contra 4 semanas antes; semana parcial não conta', () => {
    const serie = [10, 20, 30, 40, 50, 60].map((ter, i) => ({ semana: `s${i}`, ter, completa: true }))
    serie.push({ semana: 'parcial', ter: 99, completa: false })
    expect(tendencia(serie, 'ter')).toEqual({ atual: 60, antes: 20, delta: 40, desde: 's1' })
    expect(tendencia([{ ter: 5, completa: true }], 'ter')).toBeNull()
  })
})

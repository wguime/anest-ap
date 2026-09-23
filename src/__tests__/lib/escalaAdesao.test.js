import { describe, it, expect } from 'vitest'
import {
  tituloNome, razao, faixa, formatarPct, classificarSituacao, montarPessoas, ordenarPessoas,
  resumirCargos, indicadoresGrupo, melhores10, proximoPasso, resumoCard, mediana,
} from '@/lib/escalaAdesao'

const linha = (over = {}) => ({
  cargo: 'anest', role: 'anestesiologista', nome: 'FULANO DE TAL',
  d7: 5, dn: 20, aberturas: 100, acoes: 50, trocas: 0, ini_n: 10, ter_n: 10,
  casos: 40, ini_eu: 20, ter_eu: 24, tp_inf: 4, turnos: 20, tot_eu: 10, nunca: false,
  ...over,
})

const rel = (pessoas, hospitais = []) => ({ dias: 30, desde: '2026-08-24', ate: '2026-09-22', pessoas, hospitais })

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
  const base = { nunca: false, d7: 5, d30: 20, anest: true, ter30: 60, iniN30: 0, terN30: 0 }

  it('ordem de precedência: nunca > sem uso na semana > baixo uso > não marca término', () => {
    expect(classificarSituacao({ ...base, nunca: true, d7: 0 })).toBe('nun')
    expect(classificarSituacao({ ...base, d7: 0 })).toBe('sem')
    expect(classificarSituacao({ ...base, d7: 3, d30: 7 })).toBe('bx')
    expect(classificarSituacao({ ...base, ter30: 19 })).toBe('nm')
  })

  it('baixo uso exige menos de 8 dias no mês E menos de 5 na semana', () => {
    expect(classificarSituacao({ ...base, d7: 5, d30: 7 })).toBe('ok')
    expect(classificarSituacao({ ...base, d7: 4, d30: 8, ter30: 60 })).toBe('mid') // não é frequente
  })

  it('engajado: frequente (15+ no mês ou 5+ na semana) e término ≥ 50%', () => {
    expect(classificarSituacao({ ...base, d7: 2, d30: 15, ter30: 50 })).toBe('ok')
    expect(classificarSituacao({ ...base, d7: 2, d30: 15, ter30: 49 })).toBe('mid')
  })

  it('quem não tem cirurgia própria é julgado pelas marcações (10+)', () => {
    const outro = { ...base, anest: false, ter30: null }
    expect(classificarSituacao({ ...outro, iniN30: 6, terN30: 4 })).toBe('ok')
    expect(classificarSituacao({ ...outro, iniN30: 5, terN30: 4 })).toBe('mid')
  })
})

describe('escalaAdesao — montarPessoas', () => {
  it('junta 30 e 60 dias por cargo+nome e calcula as porcentagens da própria pessoa', () => {
    const [p] = montarPessoas(rel([linha()]), rel([linha({ dn: 35, casos: 80, ter_eu: 40 })]))
    expect(p.nome).toBe('Fulano de Tal')
    expect(p.d30).toBe(20)
    expect(p.d60).toBe(35)
    expect(p.ter30).toBe(60)
    expect(p.ter60).toBe(50)
    expect(p.tot30).toBe(50)
    expect(p.aberturasPorDia).toBe(5)
    expect(p.situacao).toBe('ok')
  })

  it('d7 é limitado a 7 (a janela de 7×24h pode cruzar 8 datas)', () => {
    const [p] = montarPessoas(rel([linha({ d7: 8 })]), null)
    expect(p.d7).toBe(7)
  })

  it('anestesista sem nenhuma cirurgia no período não é tratado como "0%"', () => {
    const [p] = montarPessoas(rel([linha({ casos: 0, turnos: 0, ini_eu: 0, ter_eu: 0, tot_eu: 0 })]), null)
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
    expect(p.ter60).toBe(p.ter30)
  })
})

describe('escalaAdesao — ordem, cargos, grupo, ficha e card', () => {
  const pessoas = montarPessoas(rel([
    linha({ nome: 'ANA', ter_eu: 36 }),               // ok (90%)
    linha({ nome: 'BRUNO', ter_eu: 2 }),              // nm
    linha({ nome: 'CARLA', d7: 0 }),                  // sem
    linha({ cargo: 'enf', role: 'tec-enfermagem', nome: 'DORA', casos: 0, ini_n: 30, ter_n: 30 }), // ok
    linha({ cargo: 'sec', role: 'secretaria', nome: 'EVA', d7: 0, dn: 0, aberturas: 0, casos: 0, ini_n: 0, ter_n: 0, nunca: true }),
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

  it('melhores 10% = média do decil superior dos anestesistas (não a média do grupo)', () => {
    const lista = Array.from({ length: 20 }, (_, i) => ({ anest: true, ter30: i * 5 }))
    expect(melhores10(lista, 'ter30')).toBe(92.5) // 2 melhores: 95 e 90
    expect(melhores10([{ anest: false, ter30: 10 }], 'ter30')).toBeNull()
  })

  it('próximo passo aponta a MAIOR lacuna e uma ação só', () => {
    const bruno = pessoas.find((p) => p.nome === 'Bruno')
    expect(proximoPasso(bruno).passo).toMatch(/Terminada/)
    const eva = pessoas.find((p) => p.nome === 'Eva')
    expect(proximoPasso(eva).texto).toMatch(/Ainda não abriu/)
    const carla = pessoas.find((p) => p.nome === 'Carla')
    expect(proximoPasso(carla).texto).toMatch(/7 dias/)
  })

  it('card: 4 mini-indicadores e contagem de alertas', () => {
    const r = rel([linha({ ter_eu: 2 }), linha({ nome: 'OUTRO' })], [{ hospital: 'total', casos: 10, com_ini: 5, com_ter: 6, com_tp: 0, turnos: 5, com_total: 1 }])
    expect(resumoCard(r)).toEqual({ ini: 50, ter: 60, tot: 20, alertas: 1 })
    expect(resumoCard(null)).toBeNull()
  })
})

/**
 * API externa (edge api-v1) — residentes e escala das funcionárias.
 *
 * A edge não pode importar src/, então tem a própria composição base + ajuste
 * (supabase/functions/api-v1/_pessoas-escalas-compor.ts) e uma base gerada
 * (_dados-gerados.ts). O que estes testes seguram:
 *   1. a base gerada é IGUAL a src/data/* (falha = rode `node scripts/gerar-dados-api-v1.mjs`);
 *   2. a base gerada não carrega e-mail nem cargo (LGPD);
 *   3. a composição dá o MESMO resultado que as funções do app, e o ajuste do dia
 *      substitui o slot inteiro — com a hipótese contrária (sem ajuste → base).
 */
import { afterEach, describe, expect, it } from 'vitest'
import * as gerados from '../../../supabase/functions/api-v1/_dados-gerados.ts'
import {
  comporBaseFuncionarias,
  comporEscalaFuncionarias,
  comporEstagiosResidencia,
  comporPlantoesResidencia,
  comporRoster,
  listarDias,
  normalizarOrigem,
} from '../../../supabase/functions/api-v1/_pessoas-escalas-compor.ts'
import { RESIDENTES_2026, ROTACOES_2026, getEstagiosParaData } from '../../data/residencia2026'
import { PLANTOES_2026, FERIADOS_2026, getResidenteEfetivo } from '../../data/plantao2026'
import {
  FUNCIONARIAS_SOBREAVISO,
  SOBREAVISO_MATERNO_2026,
  setSobreavisoBaseDinamica,
} from '../../data/sobreavisoMaterno2026'
import {
  FUNCIONARIAS_HOSPITAIS,
  HOSPITAIS_2026,
  getHospitaisEfetivos,
  setHospitaisBaseDinamica,
} from '../../data/hospitaisTecnicas2026'

afterEach(() => {
  setSobreavisoBaseDinamica({})
  setHospitaisBaseDinamica({})
})

const ROSTER = comporRoster(null)

describe('base gerada (_dados-gerados.ts)', () => {
  it('bate com src/data — senão rode node scripts/gerar-dados-api-v1.mjs', () => {
    expect(gerados.PLANTOES_RESIDENCIA).toEqual(PLANTOES_2026)
    expect(Object.keys(gerados.FERIADOS_RESIDENCIA).sort()).toEqual([...FERIADOS_2026].sort())
    expect(gerados.RESIDENTES).toEqual(RESIDENTES_2026.map(({ id, nome, ano }) => ({ id, nome, ano })))
    expect(gerados.ROTACOES.map((q) => [q.inicio, q.fim])).toEqual(ROTACOES_2026.map((q) => [q.inicio, q.fim]))
    expect(gerados.SOBREAVISO_BASE_ESTATICA).toEqual(SOBREAVISO_MATERNO_2026)
    expect(Object.keys(gerados.HOSPITAIS_BASE_ESTATICA).sort()).toEqual(Object.keys(HOSPITAIS_2026).sort())
    expect(gerados.FUNCIONARIAS_SOBREAVISO).toEqual(FUNCIONARIAS_SOBREAVISO.map(({ id, nome }) => ({ id, nome })))
    expect(gerados.FUNCIONARIAS_HOSPITAIS).toEqual(FUNCIONARIAS_HOSPITAIS.map(({ id, nome }) => ({ id, nome })))
  })

  it('não carrega e-mail nem cargo', () => {
    const texto = JSON.stringify(gerados)
    expect(texto).not.toMatch(/@/)
    expect(texto).not.toMatch(/email|cargo|Enfermeira/i)
  })
})

describe('listarDias', () => {
  it('inclusivo e sem fuso (atravessa a virada do horário/mês)', () => {
    expect(listarDias('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
    expect(listarDias('2026-11-12', '2026-11-12')).toEqual(['2026-11-12'])
  })
})

describe('residentes — plantões', () => {
  const dias = listarDias('2026-07-15', '2026-07-25')

  it('sem ajuste = base, igual ao getResidenteEfetivo do app', () => {
    const r = comporPlantoesResidencia(dias, {}, ROSTER)
    for (const linha of r) {
      expect(linha.residente?.id).toBe(getResidenteEfetivo(linha.data, {}))
      expect(linha.origem).toBe('base')
    }
  })

  it('ajuste do dia vence a base e diz de onde veio', () => {
    const outro = RESIDENTES_2026.find((x) => x.id !== PLANTOES_2026['2026-07-20']).id
    const ajustes = {
      '2026-07-20': { residenteOverride: outro, origem: 'troca', updatedBy: 'uid-x', trocaId: 't1' },
      '2026-07-21': { residenteOverride: PLANTOES_2026['2026-07-20'], origem: 'manual' },
      '2026-07-22': { origem: 'manual' }, // doc sem override é ignorado (useOverridesDiario)
    }
    const r = Object.fromEntries(comporPlantoesResidencia(dias, ajustes, ROSTER).map((l) => [l.data, l]))
    const overridesApp = { '2026-07-20': outro, '2026-07-21': PLANTOES_2026['2026-07-20'] }
    for (const d of dias) expect(r[d].residente?.id).toBe(getResidenteEfetivo(d, overridesApp))
    expect(r['2026-07-20'].origem).toBe('troca')
    expect(r['2026-07-21'].origem).toBe('ajuste')
    expect(r['2026-07-22'].origem).toBe('base')
    // whitelist: nada do doc de ajuste vaza
    expect(Object.keys(r['2026-07-20']).sort()).toEqual(['data', 'duracaoHoras', 'feriado', 'fim', 'inicio', 'origem', 'residente'])
    expect(Object.keys(r['2026-07-20'].residente).sort()).toEqual(['ano', 'id', 'nome'])
  })

  it('horário: 24h no fim de semana e feriado, 12h no dia útil', () => {
    const [sab, seg, finados] = comporPlantoesResidencia(['2026-11-07', '2026-11-09', '2026-11-02'], {}, ROSTER)
    expect(sab).toMatchObject({ inicio: '07:00', duracaoHoras: 24, feriado: null })
    expect(seg).toMatchObject({ inicio: '19:00', duracaoHoras: 12 })
    expect(finados).toMatchObject({ duracaoHoras: 24, feriado: 'Finados (Dia dos Mortos)' })
  })

  it('fora da tabela = sem residente', () => {
    expect(comporPlantoesResidencia(['2027-03-01'], {}, ROSTER)[0].residente).toBeNull()
  })
})

describe('residentes — cadastro', () => {
  it('roster do Firestore vence a tabela; vazio cai na tabela; e-mail não sai', () => {
    const fs = [{ id: 'r1-novo', nome: ' Nova ', ano: 'R1', email: 'x@y.com' }, { id: 'sem-nome', nome: '' }]
    expect(comporRoster(fs)).toEqual([{ id: 'r1-novo', nome: 'Nova', ano: 'R1' }])
    expect(comporRoster([])).toHaveLength(RESIDENTES_2026.length)
  })
})

describe('residentes — estágios', () => {
  it('sem ajuste = getEstagiosParaData do app; só dias úteis', () => {
    const dias = listarDias('2026-11-13', '2026-11-16') // sex, sáb, dom, seg
    const r = comporEstagiosResidencia(dias, {}, ROSTER)
    expect(r.map((x) => x.data)).toEqual(['2026-11-13', '2026-11-16'])
    for (const dia of r) {
      const app = getEstagiosParaData(new Date(`${dia.data}T12:00:00`))
      for (const t of dia.turnos) {
        expect(t.residentes.map((x) => x.estagio)).toEqual(app.map((x) => x.estagio))
      }
    }
  })

  it('ajuste vale só no turno dele; cirurgião não sai', () => {
    const slots = { '2026-11-13-tarde': { estagiosOverride: { 'r3-wagner': 'UTI' }, cirurgiaos: { 'r3-wagner': 'Dr. X' } } }
    const [dia] = comporEstagiosResidencia(['2026-11-13'], slots, ROSTER)
    const manha = dia.turnos[0].residentes.find((x) => x.id === 'r3-wagner')
    const tarde = dia.turnos[1].residentes.find((x) => x.id === 'r3-wagner')
    expect(manha).toMatchObject({ estagio: 'Neuro', origem: 'base' })
    expect(tarde).toMatchObject({ estagio: 'UTI', origem: 'ajuste' })
    expect(JSON.stringify(dia)).not.toMatch(/Dr\. X|cirurgi/)
  })
})

describe('funcionárias — escala', () => {
  it('sem mês publicado nem ajuste = base estática (igual ao app)', () => {
    const dias = listarDias('2026-04-03', '2026-04-05')
    const base = comporBaseFuncionarias({})
    const r = comporEscalaFuncionarias(dias, base, {}, {})
    for (const linha of r) {
      expect(linha.sobreavisoMaterno.funcionaria.id).toBe(SOBREAVISO_MATERNO_2026[linha.data])
      const app = getHospitaisEfetivos(new Date(`${linha.data}T12:00:00`), {})
      const porLocal = Object.fromEntries(linha.hospitais.map((h) => [h.local, h.funcionaria.nome]))
      expect(porLocal.HRO ?? null).toBe(app.hro)
      expect(porLocal.UNIMED ?? null).toBe(app.unimed)
      expect(porLocal['Plantão Pago'] ?? null).toBe(app.plantaoPago)
    }
    // domingo não tem UNIMED
    expect(r[2].hospitais.map((h) => h.local)).toEqual(['HRO', 'Plantão Pago'])
    expect(r[0].feriado).toBe('Sexta-Feira Santa')
  })

  it('mês publicado substitui o mês INTEIRO do estático', () => {
    const meses = {
      '2026-04': {
        sobreaviso: { '2026-04-02': 'mari' },
        hospitais: { '2026-04-04': { hro: 'Marta', unimed: null, plantaoPago: 'Elisete', label: null } },
      },
    }
    const base = comporBaseFuncionarias(meses)
    setSobreavisoBaseDinamica({ '2026-04': meses['2026-04'].sobreaviso })
    setHospitaisBaseDinamica({ '2026-04': meses['2026-04'].hospitais })
    const r = Object.fromEntries(
      comporEscalaFuncionarias(['2026-04-01', '2026-04-02', '2026-04-03', '2026-04-04'], base, {}, {}).map((l) => [l.data, l]),
    )
    expect(r['2026-04-01'].sobreavisoMaterno).toBeNull() // estava no estático, o mês publicado não tem
    expect(r['2026-04-02'].sobreavisoMaterno.funcionaria).toEqual({ id: 'mari', nome: 'Mari' })
    expect(r['2026-04-03'].hospitais).toEqual([]) // feriado do estático sumiu junto com o mês
    const app = getHospitaisEfetivos(new Date('2026-04-04T12:00:00'), {})
    expect(r['2026-04-04'].hospitais.map((h) => [h.local, h.funcionaria.nome])).toEqual([
      ['HRO', app.hro],
      ['Plantão Pago', app.plantaoPago],
    ])
  })

  it('ajuste do dia substitui o slot inteiro e só vale em dia com base', () => {
    const base = comporBaseFuncionarias({})
    const ajustesS = { '2026-04-04': { funcionariaOverride: 'marta', origem: 'troca' } }
    const ajustesH = {
      '2026-04-04_hro_manha': { funcionariaOverride: 'saionara', origem: 'troca' },
      '2026-04-04_plantao_pago_tarde': { funcionariaOverride: 'id-desconhecido', origem: 'manual' },
      '2026-04-06_hro_manha': { funcionariaOverride: 'marta', origem: 'troca' }, // segunda sem base
    }
    const r = Object.fromEntries(
      comporEscalaFuncionarias(['2026-04-04', '2026-04-06'], base, ajustesS, ajustesH).map((l) => [l.data, l]),
    )
    expect(r['2026-04-04'].sobreavisoMaterno).toMatchObject({ funcionaria: { id: 'marta', nome: 'Marta' }, origem: 'troca' })
    const app = getHospitaisEfetivos(new Date('2026-04-04T12:00:00'), {
      '2026-04-04_hro_manha': 'saionara',
      '2026-04-04_plantao_pago_tarde': 'id-desconhecido',
    })
    const hro = r['2026-04-04'].hospitais.find((h) => h.local === 'HRO')
    const pago = r['2026-04-04'].hospitais.find((h) => h.local === 'Plantão Pago')
    expect(hro).toMatchObject({ funcionaria: { id: 'saionara', nome: app.hro }, origem: 'troca', turno: 'manha', inicio: '07:00', fim: '15:00' })
    expect(pago).toMatchObject({ funcionaria: { nome: app.plantaoPago }, origem: 'base' }) // id desconhecido mantém a base
    expect(r['2026-04-06'].hospitais).toEqual([])
    expect(Object.keys(hro).sort()).toEqual(['fim', 'funcionaria', 'inicio', 'local', 'origem', 'turno'])
  })
})

describe('normalizarOrigem', () => {
  it('troca vs ajuste', () => {
    expect(normalizarOrigem('troca')).toBe('troca')
    expect(normalizarOrigem('manual')).toBe('ajuste')
    expect(normalizarOrigem(undefined)).toBe('ajuste')
  })
})

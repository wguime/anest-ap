/**
 * api-v1 — GET /v1/escala-cirurgica/plantoes (nov/2026).
 *
 * Segura: (1) a mesma regra do app (dia útil = só P1–P4 noturnos, ≥19h;
 * FDS = todas as Pn; Férias fora), (2) hospital pela ORDEM_NOTURNA + P4 pela
 * marcação do dia, (3) identidade nunca adivinhada, (4) whitelist — nenhum
 * campo cru do Pega Plantão sai.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../supabase/functions/api-v1/_pegaplantao.ts', () => {
  class PegaPlantaoErro extends Error {
    constructor(etapa, status) { super(`pegaplantao_${etapa}${status ? `_${status}` : ''}`) }
  }
  return { getPlantoes: vi.fn(), PegaPlantaoErro }
})

import * as pp from '../../../supabase/functions/api-v1/_pegaplantao.ts'
import {
  comporPlantoes,
  criarResolvedor,
  paredeSP,
  parseIntervalo,
  rotaEscalaPlantoes,
} from '../../../supabase/functions/api-v1/_plantoes.ts'

const sp = (q) => new URLSearchParams(q)

const PESSOAS = [
  { id: 'uid-staub', nome: 'GUILHERME STAUB', apelidos: ['STAUB'], ativo: true },
  { id: 'uid-joao', nome: 'JOÃO RICARDO MOREIRA', apelidos: ['JOAO RICARDO'], ativo: true },
  { id: 'uid-aschmidt', nome: 'ALEXANDRE SCHMIDT', apelidos: [], ativo: true },
  { id: 'uid-eschmidt', nome: 'EDUARDO SCHMIDT SAVOLDI', apelidos: [], ativo: true },
  { id: 'uid-cris', nome: 'CRISTINA BARBOSA', apelidos: ['CRISTINA'], ativo: true },
]

const reg = (Setor, Inicio, Fim, ProfDePlantao, extra = {}) => ({
  CodigoPlantao: 'X1', Setor, Inicio, Fim, ProfDePlantao, ProfFixo: 'Fixo Qualquer',
  Local: 'ANESTESIA', Tipo: 'Normal', Valor: 1234.5, Telefone: '49999999999',
  Email: 'a@b.c', Observacao: 'obs', ...extra,
})

// 2026-11-16 = segunda; 2026-11-14 = sábado
const REGISTROS = [
  reg('ANESTESIA - 1 - P1', '2026-11-16T19:00:00', '2026-11-17T07:00:00', 'G. Staub'),
  reg('2- P2', '2026-11-16T19:00:00', '2026-11-17T07:00:00', 'João Ricardo Moreira'),
  reg('3 - P3', '2026-11-16T19:00:00', '2026-11-17T07:00:00', 'Schmidt'),
  reg('4 - P4', '2026-11-16T19:00:00', '2026-11-17T07:00:00', 'Fulano Desconhecido'),
  reg('5 - P5', '2026-11-16T19:00:00', '2026-11-17T07:00:00', 'Cristina Barbosa'), // P5 em dia útil: fora
  reg('1 - P1', '2026-11-16T07:00:00', '2026-11-16T19:00:00', 'Cristina Barbosa'), // diurno em dia útil: fora
  reg('Férias', '2026-11-16T00:00:00', '2026-11-20T23:59:00', 'Cristina Barbosa'),
  reg('Sobreaviso', '2026-11-16T19:00:00', '2026-11-17T07:00:00', 'Cristina Barbosa'), // sem Pn: fora
  reg('E10 - P10', '2026-11-14T07:00:00', '2026-11-14T13:00:00', 'Cristina Barbosa'),
  reg('1 - P1', '2026-11-14T07:00:00', '2026-11-14T19:00:00', 'A. Schmidt'),
  reg('2 - P2', '2026-11-14T07:00:00', '2026-11-14T19:00:00', '', { ProfFixo: '' }),
]

function chavesProfundas(obj, acc = new Set()) {
  if (Array.isArray(obj)) obj.forEach((o) => chavesProfundas(o, acc))
  else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) { acc.add(k); chavesProfundas(v, acc) }
  }
  return acc
}

describe('parseIntervalo', () => {
  it('data única', () => {
    expect(parseIntervalo(sp('data=2026-11-16'))).toEqual({ ok: true, inicio: '2026-11-16', fim: '2026-11-16' })
  })
  it('recusa data inválida, mistura, falta, inversão e intervalo > 62 dias', () => {
    for (const q of ['data=2026-02-30', 'data=2026-11-16&inicio=2026-11-01', '', 'inicio=2026-11-01',
      'inicio=2026-11-10&fim=2026-11-01', 'inicio=2026-01-01&fim=2026-03-05']) {
      const r = parseIntervalo(sp(q))
      expect(r.ok, q).toBe(false)
      expect(r.erro.status).toBe(400)
    }
    expect(parseIntervalo(sp('inicio=2026-01-01&fim=2026-03-04')).ok).toBe(true) // 62 dias
  })
})

describe('paredeSP', () => {
  it('mantém hora local sem fuso e converte Z para -03:00', () => {
    expect(paredeSP('2026-11-16T19:00:00')).toBe('2026-11-16T19:00:00')
    expect(paredeSP('2026-11-16T19:00')).toBe('2026-11-16T19:00:00')
    expect(paredeSP('2026-11-16T22:00:00Z')).toBe('2026-11-16T19:00:00')
    expect(paredeSP('lixo')).toBeNull()
  })
})

describe('criarResolvedor — nunca adivinha', () => {
  const r = criarResolvedor(PESSOAS)
  it('inicial + sobrenome único, apelido de prefixo, nome completo', () => {
    expect(r('G. Staub')).toBe('uid-staub')
    expect(r('João Ricardo Moreira')).toBe('uid-joao')
    expect(r('Dr. Guilherme Staub')).toBe('uid-staub')
    expect(r('A. Schmidt')).toBe('uid-aschmidt')
  })
  it('sobrenome com dois donos ou nome desconhecido → null', () => {
    expect(r('Schmidt')).toBeNull()
    expect(r('S. Schmidt')).toBeNull()
    expect(r('Fulano Desconhecido')).toBeNull()
  })
  it('nome completo idêntico a dois cadastros → null', () => {
    const dup = criarResolvedor([...PESSOAS, { id: 'uid-x', nome: 'Guilherme Staub', apelidos: [], ativo: true }])
    expect(dup('Guilherme Staub')).toBeNull()
  })
})

describe('comporPlantoes', () => {
  const dias = comporPlantoes({
    registros: REGISTROS,
    pessoas: PESSOAS,
    p4PorData: new Map([['2026-11-17', 'materno']]),
    inicio: '2026-11-14',
    fim: '2026-11-16',
  })

  it('um item por dia do intervalo, inclusive dia vazio', () => {
    expect(dias.map((d) => [d.data, d.fim_de_semana, d.plantoes.length]))
      .toEqual([['2026-11-14', true, 3], ['2026-11-15', true, 0], ['2026-11-16', false, 4]])
  })

  it('dia útil: só P1–P4 noturnos, hospital da ORDEM_NOTURNA, P4 sem marcação = null', () => {
    const seg = dias[2].plantoes
    expect(seg.map((p) => [p.posicao, p.hospital, p.papel, p.anestesista?.id ?? null])).toEqual([
      ['P1', 'hro', 'plantonista', 'uid-staub'],
      ['P2', 'unimed', 'plantonista', 'uid-joao'],
      ['P3', 'unimed', 'plantao_noturno', null], // "Schmidt" ambíguo
      ['P4', null, 'coringa', null],
    ])
    expect(seg[0]).toEqual({
      posicao: 'P1', hospital: 'hro', papel: 'plantonista',
      inicio: '2026-11-16T19:00:00-03:00', fim: '2026-11-17T07:00:00-03:00',
      anestesista: { id: 'uid-staub', nome: 'GUILHERME STAUB' },
    })
    expect(seg[3].anestesista).toEqual({ id: null, nome: 'Fulano Desconhecido' })
  })

  it('P4 marcado na data vai para o hospital marcado', () => {
    const [d] = comporPlantoes({
      registros: [reg('4 - P4', '2026-11-17T19:00:00', '2026-11-18T07:00:00', 'Cristina Barbosa')],
      pessoas: PESSOAS, p4PorData: new Map([['2026-11-17', 'materno']]),
      inicio: '2026-11-17', fim: '2026-11-17',
    })
    expect(d.plantoes[0]).toMatchObject({ posicao: 'P4', hospital: 'materno', anestesista: { id: 'uid-cris' } })
  })

  it('FDS: todas as Pn do dia, sem hospital; vaga sem nome = anestesista null', () => {
    const sab = dias[0].plantoes
    expect(sab.map((p) => [p.posicao, p.hospital, p.papel, p.anestesista])).toEqual([
      ['P1', null, null, { id: 'uid-aschmidt', nome: 'ALEXANDRE SCHMIDT' }],
      ['P2', null, null, null],
      ['P10', null, null, { id: 'uid-cris', nome: 'CRISTINA BARBOSA' }],
    ])
  })

  it('whitelist: nenhum campo cru do Pega Plantão', () => {
    const chaves = chavesProfundas(dias)
    for (const k of ['CodigoPlantao', 'Setor', 'Local', 'Tipo', 'Valor', 'Telefone', 'Email',
      'Observacao', 'ProfFixo', 'ProfDePlantao', 'setor', 'valor', 'telefone', 'email']) {
      expect(chaves.has(k), k).toBe(false)
    }
    expect([...chavesProfundas(dias[2].plantoes)].sort()).toEqual(
      ['anestesista', 'fim', 'hospital', 'id', 'inicio', 'nome', 'papel', 'posicao'],
    )
  })
})

// ── rota (supabase fake + PP mockado) ───────────────────────────────────────
function fakeSupabase({ roster = PESSOAS, p4 = [], erro = null } = {}) {
  const chamadas = []
  const builder = (tabela) => {
    const q = {
      filtros: [],
      select() { return q },
      gte(c, v) { q.filtros.push(['gte', c, v]); return q },
      lte(c, v) { q.filtros.push(['lte', c, v]); return q },
      then(res, rej) {
        chamadas.push({ tabela, filtros: q.filtros })
        const data = tabela === 'vw_api_anestesistas' ? roster : p4
        return Promise.resolve({ data: erro ? null : data, error: erro }).then(res, rej)
      },
    }
    return q
  }
  return { from: builder, chamadas }
}

describe('rotaEscalaPlantoes', () => {
  beforeEach(() => vi.mocked(pp.getPlantoes).mockReset())

  it('compõe PP + roster + P4 e consulta o PP pelo intervalo do dia inteiro', async () => {
    vi.mocked(pp.getPlantoes).mockResolvedValue(REGISTROS)
    const supabase = fakeSupabase({ p4: [{ data: '2026-11-16', hospital: 'unimed' }] })
    const r = await rotaEscalaPlantoes({
      supabase, url: new URL('https://x/v1/escala-cirurgica/plantoes?data=2026-11-16'), pathname: '/v1/escala-cirurgica/plantoes',
    })
    expect(r.status).toBe(200)
    expect(pp.getPlantoes).toHaveBeenCalledWith('2026-11-16T00:00:00', '2026-11-16T23:59:59')
    expect(r.body.meta).toEqual({ inicio: '2026-11-16', fim: '2026-11-16', fonte: 'pega_plantao', total_dias: 1, total_plantoes: 4 })
    expect(r.body.data[0].plantoes.find((p) => p.posicao === 'P4').hospital).toBe('unimed')
    expect(supabase.chamadas.find((c) => c.tabela === 'escala_plantao_p4_diario').filtros)
      .toEqual([['gte', 'data', '2026-11-16'], ['lte', 'data', '2026-11-16']])
  })

  it('400 sem consultar nada; 502 sem vazar o upstream; 500 em erro de banco', async () => {
    const r400 = await rotaEscalaPlantoes({ supabase: fakeSupabase(), url: new URL('https://x/?data=ontem'), pathname: '' })
    expect(r400.status).toBe(400)
    expect(pp.getPlantoes).not.toHaveBeenCalled()

    vi.mocked(pp.getPlantoes).mockRejectedValue(new pp.PegaPlantaoErro('auth', 401))
    const r502 = await rotaEscalaPlantoes({ supabase: fakeSupabase(), url: new URL('https://x/?data=2026-10-01'), pathname: '' })
    expect(r502).toEqual({ status: 502, body: { error: 'upstream_unavailable', detail: 'pegaplantao_auth_401' } })

    vi.mocked(pp.getPlantoes).mockResolvedValue([])
    const r500 = await rotaEscalaPlantoes({ supabase: fakeSupabase({ erro: { message: 'boom' } }), url: new URL('https://x/?data=2026-10-02'), pathname: '' })
    expect(r500.status).toBe(500)
    expect(JSON.stringify(r500.body)).not.toContain('boom')
  })
})

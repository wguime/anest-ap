/**
 * fetchEscala em UMA ida ao servidor (15/10/2026).
 *
 * Eram duas em sequência — o cabeçalho e, com o id dele, casos + histórico — e a
 * escala aberta logo depois do app ficava 1,1–2,5 s em "Carregando…" (medido em
 * produção). Agora: cabeçalho com os casos EMBUTIDOS (FK caso→escala) e o histórico
 * de trocas em PARALELO pela data+hospital. Conferido contra produção: mesmas escalas,
 * mesmos casos na mesma ordem, mesmo conjunto de eventos, ~2× mais rápido.
 *
 * Trava: as duas leituras saem juntas; o formato devolvido é o de sempre (casos em
 * camelCase, nenhuma chave do embed, histórico sem `escala_id`); evento de outra
 * escala não entra; falha do histórico não esconde a escala.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { estado } = vi.hoisted(() => ({ estado: { chamadas: [], respostas: {} } }))

vi.mock('@/config/supabase', () => {
  const builder = (tabela) => {
    const reg = { tabela, select: null, eq: [], order: [], limit: null }
    estado.chamadas.push(reg)
    const resposta = () => {
      const r = estado.respostas[tabela]
      return typeof r === 'function' ? r() : Promise.resolve(r ?? { data: null, error: null })
    }
    const q = {
      select: (s) => { reg.select = s; return q },
      eq: (c, v) => { reg.eq.push([c, v]); return q },
      order: (c, o) => { reg.order.push([c, o]); return q },
      limit: (n) => { reg.limit = n; return q },
      maybeSingle: () => resposta(),
      then: (res, rej) => resposta().then(res, rej),
    }
    return q
  }
  return { supabase: { from: vi.fn(builder) } }
})

import svc from '@/services/supabaseEscalaCirurgicaService'

const CABECALHO = {
  id: 'esc-1', data: '2026-10-15', hospital: 'unimed', status: 'publicada',
  ordem_liberacao: { matutino: ['ANA'] }, linha_overrides: {},
  escala_cirurgica_caso: [
    { id: 'c1', escala_id: 'esc-1', sala: 'CC - Sala 1', ordem: 0, paciente_iniciais: 'J.P.', anestesista_user_id: 'u1' },
    { id: 'c2', escala_id: 'esc-1', sala: 'CC - Sala 1', ordem: 1, paciente_iniciais: 'M.S.', anestesista_user_id: 'u1' },
  ],
}
const EVENTOS = [
  { escala_id: 'esc-1', anestesista: 'ANA', detalhe: { trocaCom: 'BIA' }, status_para: 'troca_declarada', em: '2026-10-15T10:00:00Z', tipo: 'troca' },
  // evento de uma escala ANTIGA da mesma data/hospital (apagada e refeita): fica de fora
  { escala_id: 'esc-velha', anestesista: 'CAIO', detalhe: {}, status_para: 'troca_declarada', em: '2026-10-15T09:00:00Z', tipo: 'troca' },
]

beforeEach(() => {
  estado.chamadas = []
  estado.respostas = {
    escala_cirurgica: { data: CABECALHO, error: null },
    escala_cirurgica_evento: { data: EVENTOS, error: null },
  }
})

const da = (tabela) => estado.chamadas.find((c) => c.tabela === tabela)

describe('fetchEscala — uma ida ao servidor', () => {
  it('cabeçalho e histórico saem JUNTOS (nada espera o id do cabeçalho)', async () => {
    let soltar
    estado.respostas.escala_cirurgica = () => new Promise((r) => { soltar = () => r({ data: CABECALHO, error: null }) })
    const p = svc.fetchEscala('2026-10-15', 'unimed')
    await Promise.resolve()
    // com o cabeçalho ainda pendente, o histórico já foi pedido — pela data+hospital
    expect(da('escala_cirurgica_evento')).toBeTruthy()
    expect(da('escala_cirurgica_evento').eq).toEqual([['data', '2026-10-15'], ['hospital', 'unimed'], ['tipo', 'troca']])
    expect(estado.chamadas.map((c) => c.tabela)).not.toContain('escala_cirurgica_caso')
    soltar()
    await p
  })

  it('os casos vêm embutidos no cabeçalho, em ordem de sala e ordem', async () => {
    await svc.fetchEscala('2026-10-15', 'unimed')
    const cab = da('escala_cirurgica')
    expect(cab.select).toBe('*, escala_cirurgica_caso(*)')
    expect(cab.order).toEqual([
      ['sala', { ascending: true, referencedTable: 'escala_cirurgica_caso' }],
      ['ordem', { ascending: true, referencedTable: 'escala_cirurgica_caso' }],
    ])
  })

  it('devolve o formato de sempre: casos em camelCase e nenhuma chave do embed', async () => {
    const e = await svc.fetchEscala('2026-10-15', 'unimed')
    expect(e.id).toBe('esc-1')
    expect(e.ordemLiberacao).toEqual({ matutino: ['ANA'] })
    expect(e.casos.map((c) => c.id)).toEqual(['c1', 'c2'])
    expect(e.casos[0].pacienteIniciais).toBe('J.P.')
    expect(e.casos[0].anestesistaUserId).toBe('u1')
    expect(e).not.toHaveProperty('escala_cirurgica_caso')
    expect(e).not.toHaveProperty('escalaCirurgicaCaso')
  })

  it('histórico: só os eventos desta escala, sem o escala_id, mais recente primeiro', async () => {
    const e = await svc.fetchEscala('2026-10-15', 'unimed')
    expect(e.trocasHistorico).toEqual([
      { anestesista: 'ANA', detalhe: { trocaCom: 'BIA' }, statusPara: 'troca_declarada', em: '2026-10-15T10:00:00Z', tipo: 'troca' },
    ])
    expect(da('escala_cirurgica_evento').order).toEqual([['em', { ascending: false }]])
    expect(da('escala_cirurgica_evento').limit).toBe(60)
  })

  it('falha do histórico não esconde a escala', async () => {
    estado.respostas.escala_cirurgica_evento = () => Promise.reject(new Error('timeout'))
    const e = await svc.fetchEscala('2026-10-15', 'unimed')
    expect(e.casos).toHaveLength(2)
    expect(e.trocasHistorico).toEqual([])
  })

  it('sem escala na data → null; erro do cabeçalho → lança (o contexto distingue falha de "não publicada")', async () => {
    estado.respostas.escala_cirurgica = { data: null, error: null }
    await expect(svc.fetchEscala('2026-10-15', 'unimed')).resolves.toBeNull()

    estado.respostas.escala_cirurgica = { data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } }
    await expect(svc.fetchEscala('2026-10-15', 'unimed')).rejects.toThrow(/fetchEscala:header/)
  })
})

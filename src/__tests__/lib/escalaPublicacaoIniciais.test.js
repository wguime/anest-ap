/**
 * A fronteira do service não deixa passar paciente fora da forma do CHECK.
 *
 * Trava do incidente 02/09: `salvarEscalaTurno` (RPC `rpc_publicar_escala_turno`)
 * recebia o `pacienteIniciais` cru da conferência e um "01 EDA" derrubava a
 * publicação da Unimed inteira. Agora `casoToRow` sanitiza — para a publicação
 * por turno, a legada e o caso manual.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => {
  const state = { rpcCalls: [], rpcResult: { data: { header: {}, casos: [] }, error: null }, inserted: [] }
  function makeChain() {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      insert: vi.fn((row) => { state.inserted.push(row); return chain }),
      single: vi.fn(() => Promise.resolve({ data: state.inserted[state.inserted.length - 1] || null, error: null })),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
      then: (resolve) => resolve({ data: [], error: null }),
    }
    return chain
  }
  return {
    state,
    supabase: {
      from: vi.fn(() => makeChain()),
      rpc: vi.fn((fn, args) => { state.rpcCalls.push({ fn, args }); return Promise.resolve(state.rpcResult) }),
      functions: { invoke: vi.fn() },
    },
  }
})

vi.mock('@/config/supabase', () => ({ supabase: mocks.supabase }))

import svc from '@/services/supabaseEscalaCirurgicaService'

const CHECK = (s) => s == null || s === '' || (s.length <= 12 && !/\p{L}{3,}/u.test(s))

beforeEach(() => {
  mocks.state.rpcCalls = []
  mocks.state.inserted = []
  vi.clearAllMocks()
})

describe('salvarEscalaTurno — paciente_iniciais sempre na forma do CHECK', () => {
  it('sanitiza o que a Vision/conferência mandou cru e preserva o que já está em iniciais', async () => {
    await svc.salvarEscalaTurno({
      data: '2026-09-03', hospital: 'unimed', turno: 'matutino',
      casos: [
        { sala: 'EXAMES', hora: '08:00', pacienteIniciais: '01 EDA', procedimento: '', anestesista: 'MARILIO' },
        { sala: 'C.O - CESAREA', hora: '07:30', pacienteIniciais: 'TAILISE LECARDELLI FROZZA', anestesista: 'ALEXANDRE S' },
        { sala: 'CC - Sala 1', hora: '07:30', pacienteIniciais: 'G.S.L.', anestesista: 'TIAGO' },
        { sala: 'SRPA', hora: '09:00', pacienteIniciais: '', anestesista: 'TIAGO' },
      ],
    }, { userId: 'u1', userName: 'Secretária' })

    expect(mocks.state.rpcCalls).toHaveLength(1)
    const { fn, args } = mocks.state.rpcCalls[0]
    expect(fn).toBe('rpc_publicar_escala_turno')
    const iniciais = args.p_casos.map((c) => c.paciente_iniciais)
    expect(iniciais).toEqual(['E.', 'T.L.F.', 'G.S.L.', ''])
    for (const v of iniciais) expect(CHECK(v), `paciente_iniciais ${JSON.stringify(v)}`).toBe(true)
  })

  it('a publicação legada (rpc_salvar_escala_cirurgica) passa pela mesma fronteira', async () => {
    await svc.salvarEscala({
      data: '2026-09-03', hospital: 'hro',
      casos: [{ sala: 'Sala 1', hora: '07:00', pacienteIniciais: 'Valdecir Waldhauer', anestesista: 'ADRIANO' }],
    }, { userName: 'Secretária' })
    const { fn, args } = mocks.state.rpcCalls[0]
    expect(fn).toBe('rpc_salvar_escala_cirurgica')
    expect(args.p_casos[0].paciente_iniciais).toBe('V.W.')
  })
})

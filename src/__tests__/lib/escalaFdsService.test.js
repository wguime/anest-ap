/**
 * escalaFds — plumbing do service (F0 do modo fim de semana).
 *
 * Trava as duas pegadinhas que fariam o modo FDS "não ligar" em silêncio:
 * - `fds_meta` fora do CAMEL_TO_SNAKE (caso ultima_avaliacao_at): a leitura
 *   chegaria como `fds_meta` e todo leitor de `escala.fdsMeta` veria undefined;
 * - `salvarEscalaTurno` sem repassar o fdsMeta ao p_header da RPC: a publicação
 *   da conferência FDS gravaria a fila sem grade/posições (sem badge Pn, sem
 *   fase noturna).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => {
  const state = { queue: [], rpcCalls: [], rpcResult: { data: null, error: null } }
  function makeChain() {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      maybeSingle: vi.fn(() => Promise.resolve(state.queue.shift() ?? { data: null, error: null })),
      then: (resolve) => resolve(state.queue.shift() ?? { data: [], error: null }),
    }
    return chain
  }
  return {
    state,
    supabase: {
      from: vi.fn(() => makeChain()),
      rpc: vi.fn((fn, args) => {
        state.rpcCalls.push({ fn, args })
        return Promise.resolve(state.rpcResult)
      }),
      functions: { invoke: vi.fn() },
    },
  }
})

vi.mock('@/config/supabase', () => ({ supabase: mocks.supabase }))

import svc from '@/services/supabaseEscalaCirurgicaService'

const FDS_META = {
  grade: { '7-13': { unimed: 'GUILHERME DIDOMENICO', hro: 'JOAO HENRIQUE', ret1: 'CRISTINA', ret2: 'MATHEUS' } },
  posicoes: { P1: 'GUILHERME DIDOMENICO' },
  escalacao: { matutino: ['P5'] },
  ordemFonte: { matutino: 'documento' },
}

beforeEach(() => {
  mocks.state.queue = []
  mocks.state.rpcCalls = []
  mocks.state.rpcResult = { data: null, error: null }
  vi.clearAllMocks()
})

describe('fetchEscala — linha fds', () => {
  it('mapeia fds_meta → fdsMeta (snake→camel) na leitura', async () => {
    mocks.state.queue = [
      { data: { id: 'e1', data: '2026-08-15', hospital: 'fds', fds_meta: FDS_META, ordem_liberacao: { matutino: ['A'] } }, error: null },
      { data: [], error: null }, // casos
      { data: [], error: null }, // trocasHistorico
    ]
    const escala = await svc.fetchEscala('2026-08-15', 'fds')
    expect(escala.fdsMeta).toEqual(FDS_META)
    expect(escala.fds_meta).toBeUndefined()
    expect(escala.ordemLiberacao).toEqual({ matutino: ['A'] })
  })
})

describe('salvarEscalaTurno — publicação da linha fds', () => {
  it('repassa fds_meta no p_header da RPC junto com hospital=fds e casos vazios', async () => {
    mocks.state.rpcResult = { data: { header: { id: 'e1', hospital: 'fds', fds_meta: FDS_META }, casos: [] }, error: null }
    const saved = await svc.salvarEscalaTurno({
      data: '2026-08-15', hospital: 'fds', turno: 'matutino',
      casos: [], ordemLiberacao: ['GUILHERME DIDOMENICO', 'JOAO HENRIQUE'], ajudaExterna: [],
      fdsMeta: FDS_META,
    }, { userName: 'Secretária' })
    expect(mocks.state.rpcCalls).toHaveLength(1)
    const { fn, args } = mocks.state.rpcCalls[0]
    expect(fn).toBe('rpc_publicar_escala_turno')
    expect(args.p_hospital).toBe('fds')
    expect(args.p_turno).toBe('matutino')
    expect(args.p_casos).toEqual([])
    expect(args.p_header.fds_meta).toEqual(FDS_META)
    expect(args.p_header.ordem_liberacao).toEqual(['GUILHERME DIDOMENICO', 'JOAO HENRIQUE'])
    expect(saved.fdsMeta).toEqual(FDS_META)
  })
  it('publicação sem fdsMeta (hospitais reais) NÃO envia a chave — a RPC preserva o valor atual', async () => {
    mocks.state.rpcResult = { data: { header: { id: 'e2', hospital: 'unimed' }, casos: [] }, error: null }
    await svc.salvarEscalaTurno({
      data: '2026-08-15', hospital: 'unimed', turno: 'matutino', casos: [], ordemLiberacao: [], ajudaExterna: [],
    })
    expect('fds_meta' in mocks.state.rpcCalls[0].args.p_header).toBe(false)
  })
})

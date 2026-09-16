/**
 * REALTIME DA ESCALA — recarga coalescida e filtrada (incidente 16/09/2026).
 *
 * O banco (plano free, compute Nano) saturou às 11h15 da troca de turno: cada
 * evento realtime virava UMA recarga completa em cada cliente — 3 hospitais ×
 * (header + casos + eventos) + P4 ≈ 10 requisições — e um toque de liberação
 * emite 2–3 eventos, com ~45 clientes conectados. iPhones sozinhos fizeram
 * 1.000 requisições em 90 min, 60–75 % delas em timeout.
 *
 * Regras que este teste trava:
 *   1. rajada de eventos → UMA recarga (janela REALTIME_COALESCE_MS, trailing);
 *   2. evento de OUTRA escala/data não recarrega nada;
 *   3. as 3 reconexões (onRefetch, uma por tabela) também viram uma recarga só;
 *   4. evento sem payload (DELETE só com a PK) continua recarregando — não se
 *      arrisca perder mudança.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'
import { ThemeProvider, ToastProvider } from '@/design-system'
import { ehDataFilaUnica } from '@/lib/escalaFds'

const { svcMock, subs } = vi.hoisted(() => ({
  svcMock: {
    fetchEscala: vi.fn(),
    fetchP4Hospital: vi.fn(async () => null),
  },
  // assinaturas capturadas por tabela: { table, callback, onRefetch }
  subs: [],
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))
vi.mock('@/services/supabaseSubscriptionHelper', () => ({
  createReliableSubscription: (opts) => {
    subs.push(opts)
    return { cleanup: () => {} }
  },
}))

import {
  EscalaCirurgicaProvider, useEscalaCirurgica, hojeISO, HOSPITAIS, REALTIME_COALESCE_MS,
} from '@/contexts/EscalaCirurgicaContext'

const HOJE = hojeISO()
// dia útil: 3 hospitais; sáb/dom o context busca também a linha 'fds'
const POR_RECARGA = HOSPITAIS.length + (ehDataFilaUnica(HOJE) ? 1 : 0)

const escalaUnimed = () => ({
  id: 'esc-uni', hospital: 'unimed', data: HOJE, status: 'publicada',
  ordemLiberacao: { matutino: ['STAUB'] }, liberacoes: {}, linhaOverrides: {}, ajudaExterna: {},
  casos: [{ id: 'c1', sala: 'S1', ordem: 0, anestesista: 'STAUB', turno: 'matutino', tipo: 'eletiva', statusCirurgia: 'agendada' }],
})

let estado
function Grab() {
  estado = useEscalaCirurgica()
  return null
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms))
const janela = () => dormir(REALTIME_COALESCE_MS + 250)

const emitir = (table, ev) => {
  act(() => { subs.filter((s) => s.table === table).forEach((s) => s.callback(ev)) })
}

const montar = async () => {
  render(
    <ThemeProvider><ToastProvider>
      <EscalaCirurgicaProvider><Grab /></EscalaCirurgicaProvider>
    </ToastProvider></ThemeProvider>
  )
  await waitFor(() => expect(estado?.escalas?.unimed?.id).toBe('esc-uni'))
  // deixa a carga inicial assentar antes de zerar o contador
  await dormir(50)
  svcMock.fetchEscala.mockClear()
}

beforeEach(() => {
  subs.length = 0
  svcMock.fetchEscala.mockReset()
  svcMock.fetchEscala.mockImplementation(async (dia, h) => (h === 'unimed' ? escalaUnimed() : null))
})

describe('realtime da escala — recarga coalescida e filtrada', () => {
  it('assina as 3 tabelas uma única vez', async () => {
    await montar()
    expect(subs.map((s) => s.table).sort()).toEqual(
      ['escala_cirurgica', 'escala_cirurgica_caso', 'escala_plantao_p4_diario']
    )
  })

  it('rajada de eventos da escala carregada vira UMA recarga', async () => {
    await montar()
    for (let i = 0; i < 5; i++) {
      emitir('escala_cirurgica_caso', { eventType: 'UPDATE', new: { id: `c${i}`, escala_id: 'esc-uni' }, old: null })
    }
    emitir('escala_cirurgica', { eventType: 'UPDATE', new: { id: 'esc-uni', hospital: 'unimed', data: HOJE }, old: null })
    // dentro da janela nada foi buscado ainda (trailing)
    expect(svcMock.fetchEscala).not.toHaveBeenCalled()
    await janela()
    expect(svcMock.fetchEscala).toHaveBeenCalledTimes(POR_RECARGA)
  })

  it('evento de OUTRA escala ou de OUTRA data não recarrega nada', async () => {
    await montar()
    emitir('escala_cirurgica_caso', { eventType: 'INSERT', new: { id: 'cx', escala_id: 'esc-de-ontem' }, old: null })
    emitir('escala_cirurgica', { eventType: 'UPDATE', new: { id: 'esc-hro-amanha', hospital: 'hro', data: '2099-01-01' }, old: null })
    emitir('escala_plantao_p4_diario', { eventType: 'INSERT', new: { data: '2099-01-01', hospital: 'hro' }, old: null })
    await janela()
    expect(svcMock.fetchEscala).not.toHaveBeenCalled()
  })

  it('evento da data na tela em outro hospital recarrega (escala nova do dia)', async () => {
    await montar()
    emitir('escala_cirurgica', { eventType: 'INSERT', new: { id: 'esc-hro-novo', hospital: 'hro', data: HOJE }, old: null })
    await janela()
    expect(svcMock.fetchEscala).toHaveBeenCalledTimes(POR_RECARGA)
  })

  it('DELETE só com a PK (sem escala_id) continua recarregando', async () => {
    await montar()
    emitir('escala_cirurgica_caso', { eventType: 'DELETE', new: {}, old: { id: 'c1' } })
    await janela()
    expect(svcMock.fetchEscala).toHaveBeenCalledTimes(POR_RECARGA)
  })

  it('as 3 reconexões (onRefetch) viram uma recarga só', async () => {
    await montar()
    act(() => { subs.forEach((s) => s.onRefetch()) })
    await janela()
    expect(svcMock.fetchEscala).toHaveBeenCalledTimes(POR_RECARGA)
  })
})

/**
 * CONTA DE HOSPITAL SEMPRE ATUALIZADA (dono 15/10/2026: "esses usuários ficam abertos nos
 * desktops dos hospitais e com frequência a página fica desatualizada").
 *
 * Nos logs de 14/10 a conta do HRO passou 13:00–17:15 sem buscar a escala com a página
 * viva (só o `profiles` de 30 em 30 min), enquanto 12 a 18 colegas a recarregavam: o tempo
 * real tinha caído e nada o trazia de volta — a tela do computador nunca fica oculta, e a
 * recarga do `visibilitychange` é a do celular. Trava:
 *  1. conta de hospital com a tela visível e sem carga há CONTA_HOSPITAL_IDADE_MAX_MS:
 *     recarrega sozinha, e segue recarregando enquanto nada chegar;
 *  2. carga recente (o tempo real funcionando) adia a próxima — o vigia não dobra o tráfego;
 *  3. conta comum não ganha recarga periódica (o celular tem o visibilitychange);
 *  4. tela oculta não recarrega;
 *  5. a rede voltou (`online`) → recarrega na hora.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'
import { ThemeProvider, ToastProvider } from '@/design-system'
import { ehDataFilaUnica } from '@/lib/escalaFds'
import { UserContext } from '@/contexts/userContextObject'

const { svcMock, subs } = vi.hoisted(() => ({
  svcMock: {
    fetchEscala: vi.fn(),
    fetchP4Hospital: vi.fn(async () => null),
  },
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
  EscalaCirurgicaProvider, useEscalaCirurgica, diaOperacionalISO, HOSPITAIS, REALTIME_COALESCE_MS,
  CONTA_HOSPITAL_IDADE_MAX_MS, CONTA_HOSPITAL_VIGIA_MS,
} from '@/contexts/EscalaCirurgicaContext'

const HOJE = diaOperacionalISO()
const POR_RECARGA = HOSPITAIS.length + (ehDataFilaUnica(HOJE) ? 1 : 0)

const escalaHro = () => ({
  id: 'esc-hro', hospital: 'hro', data: HOJE, status: 'publicada',
  ordemLiberacao: { matutino: ['STAUB'] }, liberacoes: {}, linhaOverrides: {}, ajudaExterna: {},
  casos: [{ id: 'c1', sala: 'S1', ordem: 0, anestesista: 'STAUB', turno: 'matutino', tipo: 'eletiva', statusCirurgia: 'agendada' }],
})

let estado
function Grab() {
  estado = useEscalaCirurgica()
  return null
}

const HRO = { uid: 'u-hro', role: 'func-hro', displayName: 'HRO' }
const ANESTESISTA = { uid: 'u-x', role: 'anestesiologista', displayName: 'X' }

const montar = async (user) => {
  render(
    <ThemeProvider><ToastProvider>
      <UserContext.Provider value={{ user }}>
        <EscalaCirurgicaProvider><Grab /></EscalaCirurgicaProvider>
      </UserContext.Provider>
    </ToastProvider></ThemeProvider>
  )
  await waitFor(() => expect(estado?.escalas?.hro?.id).toBe('esc-hro'))
  await act(async () => { await Promise.resolve() })
  svcMock.fetchEscala.mockClear()
}

// relógio falso que também anda com o tempo real: o waitFor e o coalescer seguem andando
const passar = async (ms) => { await act(async () => { vi.advanceTimersByTime(ms) }) }
const recargas = () => svcMock.fetchEscala.mock.calls.length / POR_RECARGA
const visibilidade = (v) => {
  Object.defineProperty(document, 'visibilityState', { value: v, configurable: true })
  Object.defineProperty(document, 'hidden', { value: v === 'hidden', configurable: true })
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  subs.length = 0
  svcMock.fetchEscala.mockReset()
  svcMock.fetchEscala.mockImplementation(async (dia, h) => (h === 'hro' ? escalaHro() : null))
  visibilidade('visible')
})
afterEach(() => {
  visibilidade('visible')
  vi.useRealTimers()
})

describe('conta de hospital sempre atualizada (dono 15/10/2026)', () => {
  it('tela visível e nada chegou há 2 min → recarrega sozinha, e segue recarregando', async () => {
    await montar(HRO)
    await passar(CONTA_HOSPITAL_IDADE_MAX_MS - CONTA_HOSPITAL_VIGIA_MS)
    expect(svcMock.fetchEscala).not.toHaveBeenCalled()

    await passar(CONTA_HOSPITAL_VIGIA_MS + 1000)
    await waitFor(() => expect(recargas()).toBe(1))

    await passar(CONTA_HOSPITAL_IDADE_MAX_MS + CONTA_HOSPITAL_VIGIA_MS)
    await waitFor(() => expect(recargas()).toBe(2))
  })

  it('carga recente pelo tempo real adia a próxima: o vigia não dobra o tráfego', async () => {
    await montar(HRO)
    await passar(CONTA_HOSPITAL_IDADE_MAX_MS - 20_000)
    // um sinal do tempo real recarrega agora
    act(() => { subs.filter((s) => s.table === 'escala_cirurgica_caso').forEach((s) => s.callback({ eventType: 'UPDATE', new: { id: 'c1', escala_id: 'esc-hro' }, old: null })) })
    await new Promise((r) => setTimeout(r, REALTIME_COALESCE_MS + 250))
    await waitFor(() => expect(recargas()).toBe(1))

    // 1 min e meio depois dessa carga: ainda fresca, nada de recarga extra
    await passar(90_000)
    await act(async () => { await Promise.resolve() })
    expect(recargas()).toBe(1)
  })

  it('conta comum não ganha recarga periódica', async () => {
    await montar(ANESTESISTA)
    await passar(10 * 60_000)
    await act(async () => { await Promise.resolve() })
    expect(svcMock.fetchEscala).not.toHaveBeenCalled()
  })

  it('tela oculta não recarrega', async () => {
    await montar(HRO)
    visibilidade('hidden')
    await passar(10 * 60_000)
    await act(async () => { await Promise.resolve() })
    expect(svcMock.fetchEscala).not.toHaveBeenCalled()
  })

  it('a rede voltou → recarrega na hora', async () => {
    await montar(HRO)
    await act(async () => { window.dispatchEvent(new Event('online')) })
    await waitFor(() => expect(recargas()).toBe(1))
  })
})

/**
 * Turno acompanha o RELÓGIO (dono 15/08: "a ordem de liberações deve mudar
 * automaticamente às 7h, 13h e às 19h conforme escala").
 *
 * Trava:
 *  1. vendo a escala de HOJE, a virada das 13h troca matutino→vespertino
 *     sozinha (sem toque no seletor);
 *  2. escolha MANUAL de um turno divergente NÃO é desfeita sob o dedo — vale
 *     enquanto a faixa do relógio durar.
 * (As viradas 19h/23h são da fase noturna, derivada do relógio dentro da view
 * — cobertas em plantaoNoturno.test.js/liberacoesFdsUnificada.test.jsx; a das
 * 7h é a virada do dia, já coberta pelo comportamento existente.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'

const hojeLocalISO = (base) => {
  const d = base instanceof Date ? base : new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const { estado, svcMock } = vi.hoisted(() => ({
  estado: { ctx: null },
  svcMock: { fetchEscala: vi.fn(async () => null), fetchLocaisHospital: vi.fn(async () => []) },
}))

vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))
vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgica: () => estado.ctx,
  hojeISO: (d) => hojeLocalISO(d),
  HOSPITAIS: ['unimed', 'hro', 'materno'],
  HOSPITAL_LABEL: { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' },
  OBSERVACAO_MAX: 120,
}))
vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: { uid: 'u-x', role: 'anestesiologista', displayName: 'X' } }),
}))
vi.mock('@/hooks/usePegaPlantao', () => ({ useEscalaDia: () => ({ plantoes: [] }) }))
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    roster: [], rosterByUid: new Map(), aliases: [], options: [],
    resolver: () => null, loading: false, pronto: true,
    refresh: vi.fn(), upsertAlias: vi.fn(), removeAlias: vi.fn(),
  }),
}))

import EscalaCirurgicaPage from '@/pages/escala-cirurgica/EscalaCirurgicaPage'

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

const acoes = () => ({
  setData: vi.fn(), toggleLiberacao: vi.fn(), toggleEscalado: vi.fn(), setLinhaOverride: vi.fn(),
  adicionarAjuda: vi.fn(), removerAjuda: vi.fn(), reordenarAjuda: vi.fn(), definirP4Hospital: vi.fn(),
  setAnestesistaCasos: vi.fn(), marcarTroca: vi.fn(), executarSubstituicao: vi.fn(), desfazerSubstituicao: vi.fn(),
})

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})
afterEach(() => vi.useRealTimers())

const montarHoje = () => {
  const hoje = hojeLocalISO()
  estado.ctx = {
    escalas: { unimed: null, hro: null, materno: null, fds: null },
    p4Hospital: null, data: hoje, hoje, loading: false, ...acoes(),
  }
  return render(<EscalaCirurgicaPage onNavigate={() => {}} goBack={() => {}} />, { wrapper: wrap })
}

describe('turno acompanha o relógio (dono 15/08)', () => {
  it('às 13h a tela vira sozinha do matutino para o vespertino', async () => {
    vi.setSystemTime(new Date('2026-08-15T12:59:00-03:00'))
    montarHoje()
    expect(screen.getByText(/· Matutino/)).toBeTruthy()
    // 12:59 → 13:01 — o tick do relógio (30s) dispara a virada, sem toque
    await act(async () => { vi.advanceTimersByTime(2 * 60_000) })
    expect(screen.getByText(/· Vespertino/)).toBeTruthy()
  })

  it('escolha manual divergente NÃO é desfeita pelo relógio na mesma faixa', async () => {
    vi.setSystemTime(new Date('2026-08-15T14:00:00-03:00')) // tarde
    montarHoje()
    expect(screen.getByText(/· Vespertino/)).toBeTruthy()
    // usuário consulta a manhã de propósito…
    fireEvent.click(screen.getByRole('tab', { name: 'Matutino' }))
    expect(screen.getByText(/· Matutino/)).toBeTruthy()
    // …e os ticks seguintes não roubam a tela de volta
    await act(async () => { vi.advanceTimersByTime(5 * 60_000) })
    expect(screen.getByText(/· Matutino/)).toBeTruthy()
  })
})

/**
 * CONTA DE HOSPITAL VOLTA AO PADRÃO QUANDO A TELA FICA PARADA (dono 15/10/2026: "esses
 * usuários ficam abertos nos desktops dos hospitais e com frequência a página fica
 * desatualizada").
 *
 * O computador do centro cirúrgico fica com a escala aberta o dia inteiro. Quem consulta
 * outra data, outro hospital ou o outro turno deixa a tela lá para quem vem depois. Parada
 * por CONTA_HOSPITAL_VOLTA_MS, ela volta a hoje, ao turno em curso e ao hospital da conta.
 * Trava:
 *  1. hospital trocado e tela parada → volta ao hospital da conta; uso recente segura;
 *  2. outra data → volta a hoje;
 *  3. folha aberta (alguém no meio de algo) segura a volta;
 *  4. conta comum não volta sozinha (é o celular de quem opera, não um posto).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { ThemeProvider, ToastProvider } from '@/design-system'

const hojeLocalISO = (base) => {
  const d = base instanceof Date ? base : new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const { estado, svcMock } = vi.hoisted(() => ({
  estado: { ctx: null, user: null },
  svcMock: {
    fetchEscala: vi.fn(async () => null),
    fetchStatusDia: vi.fn(async () => []),
    fetchLocaisHospital: vi.fn(async () => []),
  },
}))

vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))
vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgica: () => estado.ctx,
  useEscalaCirurgicaActions: () => estado.ctx,
  hojeISO: (d) => hojeLocalISO(d),
  diaOperacionalISO: (d) => hojeLocalISO(d),
  HOSPITAIS: ['unimed', 'hro', 'materno'],
  HOSPITAL_LABEL: { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' },
  OBSERVACAO_MAX: 120,
}))
vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: estado.user }),
}))
vi.mock('@/hooks/usePegaPlantao', () => ({ useEscalaDia: () => ({ plantoes: [] }) }))
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    roster: [], rosterByUid: new Map(), aliases: [], options: [],
    resolver: () => null, loading: false, pronto: true,
    refresh: vi.fn(), upsertAlias: vi.fn(), removeAlias: vi.fn(),
  }),
}))

import EscalaCirurgicaPage, { CONTA_HOSPITAL_VOLTA_MS } from '@/pages/escala-cirurgica/EscalaCirurgicaPage'

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

// quarta-feira útil, 10h
const AGORA = new Date('2026-10-14T10:00:00-03:00')
const HOJE = '2026-10-14'
const AMANHA = '2026-10-15'

const montar = ({ data = HOJE } = {}) => {
  estado.ctx = {
    escalas: { unimed: null, hro: null, materno: null, fds: null },
    p4Hospital: null, data, hoje: HOJE, loading: false,
    setData: vi.fn(), toggleLiberacao: vi.fn(), toggleEscalado: vi.fn(), setLinhaOverride: vi.fn(),
    adicionarAjuda: vi.fn(), removerAjuda: vi.fn(), reordenarAjuda: vi.fn(), definirP4Hospital: vi.fn(),
    setAnestesistaCasos: vi.fn(), marcarTroca: vi.fn(), executarSubstituicao: vi.fn(), desfazerSubstituicao: vi.fn(),
    prefetch: vi.fn(async () => {}),
  }
  return render(<EscalaCirurgicaPage onNavigate={() => {}} goBack={() => {}} />, { wrapper: wrap })
}

const hospitalSelecionado = () => ['Unimed', 'HRO', 'Materno']
  .find((n) => screen.queryByRole('tab', { name: n })?.getAttribute('aria-selected') === 'true') || null
// toque de verdade: o ponteiro desce antes do clique
const tocar = (nome) => {
  const alvo = screen.getByRole('tab', { name: nome })
  fireEvent.pointerDown(alvo)
  fireEvent.click(alvo)
}
const passar = async (ms) => { await act(async () => { vi.advanceTimersByTime(ms) }) }

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(AGORA)
  estado.user = { uid: 'u-hro', role: 'func-hro', displayName: 'HRO' }
  localStorage.clear()
  svcMock.fetchStatusDia.mockReset()
  svcMock.fetchStatusDia.mockImplementation(async () => [])
})
afterEach(() => {
  document.querySelectorAll('[data-teste-folha]').forEach((n) => n.remove())
  vi.useRealTimers()
})

describe('conta de hospital volta ao padrão quando a tela fica parada (15/10/2026)', () => {
  it('hospital trocado e tela parada → volta ao hospital da conta; uso recente segura', async () => {
    montar()
    expect(hospitalSelecionado()).toBe('HRO')
    tocar('Unimed')
    expect(hospitalSelecionado()).toBe('Unimed')

    await passar(CONTA_HOSPITAL_VOLTA_MS - 60_000)
    expect(hospitalSelecionado()).toBe('Unimed')

    // mexeu o mouse: o relógio da parada recomeça
    fireEvent.pointerMove(window)
    await passar(CONTA_HOSPITAL_VOLTA_MS - 60_000)
    expect(hospitalSelecionado()).toBe('Unimed')

    await passar(2 * 60_000)
    expect(hospitalSelecionado()).toBe('HRO')
  })

  it('vendo outra data → volta a hoje', async () => {
    montar({ data: AMANHA })
    await passar(CONTA_HOSPITAL_VOLTA_MS + 60_000)
    expect(estado.ctx.setData).toHaveBeenCalledWith(HOJE)
  })

  it('folha aberta segura a volta (alguém está no meio de algo)', async () => {
    montar()
    tocar('Unimed')
    const folha = document.createElement('div')
    folha.setAttribute('role', 'dialog')
    folha.setAttribute('data-teste-folha', '')
    document.body.appendChild(folha)

    await passar(CONTA_HOSPITAL_VOLTA_MS + 2 * 60_000)
    expect(hospitalSelecionado()).toBe('Unimed')

    folha.remove()
    await passar(60_000)
    expect(hospitalSelecionado()).toBe('HRO')
  })

  it('conta comum não volta sozinha', async () => {
    estado.user = { uid: 'u-x', role: 'anestesiologista', displayName: 'X' }
    montar({ data: AMANHA })
    tocar('Completa')
    tocar('HRO')
    expect(hospitalSelecionado()).toBe('HRO')

    await passar(CONTA_HOSPITAL_VOLTA_MS + 5 * 60_000)
    expect(hospitalSelecionado()).toBe('HRO')
    expect(estado.ctx.setData).not.toHaveBeenCalledWith(HOJE)
  })
})

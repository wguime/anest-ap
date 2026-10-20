/**
 * Selo "Plantão da manhã (Materno)" só pela ESCALA NUMÉRICA (dono 20/10).
 *
 * "use apenas o badge de plantão quando estiver informado na escala numérica" — foto do card
 * do Rômulo na Unimed, tarde de 20/10, com "Plantão da manhã (Materno)". O rodapé publicado do
 * Materno era só [ROMULO] (mapa HC assinado por ele), e a página fazia do último nome de cada
 * rodapé o plantão do contraturno de lá. A numérica não traz o Rômulo no Materno: o plantão da
 * manhã de 21/10 é o GUSTAVO.
 *
 * ⚠️ Trava de PÁGINA: a lib (`plantaoMaternoContraturno`) tem teste próprio; o defeito estava no
 * fio que monta `contraturnoOutros`, e é ele que precisa de teste. O JSON da numérica entra por
 * import dinâmico — `findBy` espera ele chegar.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'

const { estado, svcMock } = vi.hoisted(() => ({
  estado: { ctx: null },
  svcMock: {
    fetchEscala: vi.fn(async () => null),
    fetchLocaisHospital: vi.fn(async () => []),
    reservarAvisoTempo: vi.fn(async () => false),
  },
}))

vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))
vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgica: () => estado.ctx,
  hojeISO: () => '2026-10-20',
  diaOperacionalISO: () => '2026-10-20',
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

const caso = (id, sala, anestesista, hora = '13:30') => ({
  id, sala, ordem: 0, hora, anestesista, cirurgiao: 'Cirurgião', turno: 'vespertino',
  bloco: 'normal', isContinuacao: false, semAnestesista: false,
})

const acoes = () => ({
  setData: vi.fn(), toggleLiberacao: vi.fn(), toggleEscalado: vi.fn(), setLinhaOverride: vi.fn(),
  adicionarAjuda: vi.fn(), removerAjuda: vi.fn(), reordenarAjuda: vi.fn(), definirP4Hospital: vi.fn(),
  setAnestesistaCasos: vi.fn(), marcarTroca: vi.fn(), executarSubstituicao: vi.fn(),
  desfazerSubstituicao: vi.fn(), salvarEscalaTurno: vi.fn(), atualizarCaso: vi.fn(),
  definirOrigemLinha: vi.fn(),
  setStatusCirurgia: vi.fn(), adicionarCaso: vi.fn(), definirSalasUrgencia: vi.fn(),
})

// Unimed da tarde de 20/10 (recorte): Rômulo no meio do rodapé com a linha MATERNO; Gustavo
// com caso aqui — é ele o plantão da manhã de 21/10 no Materno pela numérica.
const UNIMED = {
  id: 'u1', hospital: 'unimed', data: '2026-10-20',
  ordemLiberacao: { vespertino: ['DIEGO', 'ROMULO', 'GUSTAVO', 'MARILIO'] },
  ajudaExterna: { vespertino: [] },
  liberacoes: {}, linhaOverrides: {},
  casos: [
    caso('c1', 'CC - Sala 1', 'DIEGO'),
    caso('c2', 'MATERNO', 'ROMULO'),
    caso('c3', 'CC - Sala 2', 'GUSTAVO'),
  ],
}
// Materno publicado como em 20/10: rodapé de um nome só, quem assinou o mapa.
const MATERNO = {
  id: 'm1', hospital: 'materno', data: '2026-10-20',
  ordemLiberacao: { vespertino: ['ROMULO'] },
  ajudaExterna: { vespertino: [] },
  liberacoes: {}, linhaOverrides: {},
  casos: [caso('m-c1', 'Sala 2 HC', 'ROMULO')],
}

const montar = () => {
  estado.ctx = {
    escalas: { unimed: UNIMED, hro: null, materno: MATERNO, fds: null },
    p4Hospital: null, data: '2026-10-20', hoje: '2026-10-20', loading: false, ...acoes(),
  }
  render(<EscalaCirurgicaPage onNavigate={() => {}} goBack={() => {}} />, { wrapper: wrap })
  fireEvent.click(screen.getByRole('tab', { name: 'Liberações' }))
}

const cardDe = (nome) => screen.getByLabelText(`Editar local/cirurgião de ${nome}`).closest('[data-linha]')

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-10-20T14:00:00-03:00')) // terça, turno vespertino
})
afterEach(() => vi.useRealTimers())

describe('selo de plantão do Materno só pela numérica (dono 20/10)', () => {
  it('quem está no Materno pela NUMÉRICA leva "Plantão da manhã (Materno)"', async () => {
    montar()
    // o JSON chega por import dinâmico: o selo aparece depois dele
    const selo = await screen.findByText(/Plantão da manhã \(Materno\)/, {}, { timeout: 4000 })
    expect(cardDe('Gustavo')?.textContent).toContain('Plantão da manhã (Materno)')
    expect(selo).toBeTruthy()
  })

  it('o último (e único) nome do rodapé do Materno NÃO vira plantão de lá — Rômulo fica sem selo', async () => {
    montar()
    await screen.findByText(/Plantão da manhã \(Materno\)/, {}, { timeout: 4000 })
    expect(screen.getAllByText(/Plantão da manhã \(Materno\)/)).toHaveLength(1)
    expect(cardDe('Rômulo')?.textContent || '').not.toContain('(Materno)')
  })
})

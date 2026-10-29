/**
 * Selo "Plantão da manhã (Materno)" só pela ESCALA NUMÉRICA (dono 20/10).
 *
 * "use apenas o badge de plantão quando estiver informado na escala numérica" — foto do card
 * do Rômulo na Unimed, tarde de 20/10, com "Plantão da manhã (Materno)". O rodapé publicado do
 * Materno era só [ROMULO] (mapa HC assinado por ele), e a página fazia do último nome de cada
 * rodapé o plantão do contraturno de lá. A numérica não traz o Rômulo no Materno: o plantão da
 * manhã de 21/10 é o GUSTAVO.
 *
 * REPETIU em 21/10 (foto do card do Klisman no HRO da tarde): a lib levava a tarde para a manhã
 * do dia SEGUINTE, e o Klisman é o 1º do Materno na manhã de 22/10. Dono: "hoje é 21.10, a escala
 * de hoje à tarde não corresponde ao dia 22". O contraturno é do MESMO dia — à tarde de 21/10, o
 * plantão da manhã do Materno é o GUSTAVO (1º azul da manhã de 21/10). O recorte abaixo é a tarde
 * de 21/10 com os dois na fila: só o Gustavo leva o selo.
 *
 * REVOGADO À TARDE em 29/10 (foto do card do Tiago no IOSC do HRO, "Plantão da manhã (Materno)"):
 * "Tiago não é o plantão da tarde no materno, o plantão da tarde é Eduardo". O 1º da manhã já
 * terminou o plantão; à tarde a fila não leva selo de contraturno do Materno. De manhã segue:
 * "Plantão da tarde (Materno)" = 1º azul da tarde do mesmo dia (21/10: JANAINA).
 *
 * ⚠️ Trava de PÁGINA: a lib (`plantaoMaternoContraturno`) tem teste próprio; o defeito estava no
 * fio que monta `contraturnoOutros`, e é ele que precisa de teste. O JSON da numérica entra por
 * import dinâmico — `findBy` espera ele chegar.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

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
  hojeISO: () => '2026-10-21',
  diaOperacionalISO: () => '2026-10-21',
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

const caso = (id, sala, anestesista, turno, hora) => ({
  id, sala, ordem: 0, hora, anestesista, cirurgiao: 'Cirurgião', turno,
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

// 21/10 pela numérica do Materno: manhã 1º GUSTAVO · tarde 1º JANAINA, 2º GUSTAVO.
// Rômulo no meio do rodapé com a linha MATERNO (assinou o mapa); Klisman é o 1º da manhã de 22/10.
const escalas = (turno) => {
  const hora = turno === 'matutino' ? '07:30' : '13:30'
  return {
    unimed: {
      id: 'u1', hospital: 'unimed', data: '2026-10-21',
      ordemLiberacao: { [turno]: ['DIEGO', 'ROMULO', 'KLISMAN', 'GUSTAVO', 'JANAINA', 'MARILIO'] },
      ajudaExterna: { [turno]: [] },
      liberacoes: {}, linhaOverrides: {},
      casos: [
        caso('c1', 'CC - Sala 1', 'DIEGO', turno, hora),
        caso('c2', 'MATERNO', 'ROMULO', turno, hora),
        caso('c4', 'CC - Sala 3', 'KLISMAN', turno, hora),
        caso('c3', 'CC - Sala 2', 'GUSTAVO', turno, hora),
        caso('c5', 'CC - Sala 4', 'JANAINA', turno, hora),
      ],
    },
    hro: null,
    materno: {
      id: 'm1', hospital: 'materno', data: '2026-10-21',
      ordemLiberacao: { [turno]: ['ROMULO'] },
      ajudaExterna: { [turno]: [] },
      liberacoes: {}, linhaOverrides: {},
      casos: [caso('m-c1', 'Sala 2 HC', 'ROMULO', turno, hora)],
    },
    fds: null,
  }
}

const montar = async (turno) => {
  vi.setSystemTime(new Date(turno === 'matutino' ? '2026-10-21T09:00:00-03:00' : '2026-10-21T14:00:00-03:00'))
  estado.ctx = {
    escalas: escalas(turno),
    p4Hospital: null, data: '2026-10-21', hoje: '2026-10-21', loading: false, ...acoes(),
  }
  render(<EscalaCirurgicaPage onNavigate={() => {}} goBack={() => {}} />, { wrapper: wrap })
  fireEvent.click(screen.getByRole('tab', { name: 'Liberações' }))
}

const cardDe = (nome) => screen.getByLabelText(`Editar local/cirurgião de ${nome}`).closest('[data-linha]')

beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }) })
afterEach(() => vi.useRealTimers())

describe('selo de plantão do Materno só pela numérica, só de manhã (dono 20/10, 21/10, 29/10)', () => {
  it('manhã: o 1º da TARDE do mesmo dia pela numérica leva "Plantão da tarde (Materno)"', async () => {
    await montar('matutino')
    // o JSON chega por import dinâmico: o selo aparece depois dele
    await screen.findByText(/Plantão da tarde \(Materno\)/, {}, { timeout: 4000 })
    expect(screen.getAllByText(/Plantão da tarde \(Materno\)/)).toHaveLength(1)
    expect(cardDe('Janaína')?.textContent).toContain('Plantão da tarde (Materno)')
    // o último (e único) nome do rodapé do Materno NÃO vira plantão de lá (20/10)
    expect(cardDe('Rômulo')?.textContent || '').not.toContain('(Materno)')
  })

  it('tarde: ninguém leva selo de plantão do Materno — nem o 1º da manhã (Gustavo), nem o da manhã seguinte (Klisman)', async () => {
    await montar('vespertino')
    // espera a numérica chegar: o mesmo módulo que a página importa, já em cache depois disto
    await import('@/data/escalaNumerica.json')
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    expect(screen.queryByText(/\(Materno\)/)).toBeNull()
    expect(cardDe('Gustavo')?.textContent || '').not.toContain('Plantão')
    expect(cardDe('Klisman')?.textContent || '').not.toContain('(Materno)')
  })
})

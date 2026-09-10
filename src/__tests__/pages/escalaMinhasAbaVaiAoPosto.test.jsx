/**
 * A aba "Minhas" move o cabeçalho para o meu posto (dono 2026-09-09).
 *
 * Relato: "se o usuário está escalado na unimed, e clica em minhas estando o HRO
 * marcado, nada aparece. quero que ao clicar em minhas apareçam as cirurgias e
 * as marcações no cabeçalho fiquem marcadas de forma automática onde o usuário
 * está, sem mudar nada do layout que já existe".
 *
 * Aqui a trava é a LIGAÇÃO: `localizarMeuPosto` tem teste próprio
 * (escalaMinhasVaiOndeEstou.test.js) e é puro; o que se prova neste arquivo é
 * que o toque na aba realmente move os trilhos de hospital e de turno — e que
 * as contas de hospital não têm essa aba.
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
  estado: { ctx: null, user: null },
  svcMock: { fetchEscala: vi.fn(async () => null), fetchLocaisHospital: vi.fn(async () => []) },
}))

vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: svcMock }))
vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgica: () => estado.ctx,
  // a aba Completa monta a FaixaUrgencias, que consome o context de AÇÕES
  useEscalaCirurgicaActions: () => ({
    setStatusCirurgia: vi.fn(), atualizarCaso: vi.fn(), adicionarCaso: vi.fn(),
    excluirCaso: vi.fn(), definirSalasUrgencia: vi.fn(), setAnestesistaCasos: vi.fn(),
    executarSubstituicao: vi.fn(), adicionarAjuda: vi.fn(), removerAjuda: vi.fn(),
    setLinhaOverride: vi.fn(),
  }),
  hojeISO: (d) => hojeLocalISO(d),
  HOSPITAIS: ['unimed', 'hro', 'materno'],
  HOSPITAL_LABEL: { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' },
  OBSERVACAO_MAX: 120,
}))
vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ user: estado.user }) }))
vi.mock('@/hooks/usePegaPlantao', () => ({ useEscalaDia: () => ({ plantoes: [] }) }))
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    roster: [], rosterByUid: new Map(), aliases: [], options: [],
    resolver: () => null, loading: false, pronto: true,
    refresh: vi.fn(), upsertAlias: vi.fn(), removeAlias: vi.fn(),
  }),
}))
vi.mock('@/hooks/useRosterResidentes', () => ({
  default: () => ({ residentes: [], options: [], loading: false }),
}))

import EscalaCirurgicaPage from '@/pages/escala-cirurgica/EscalaCirurgicaPage'

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

const acoes = () => ({
  setData: vi.fn(), toggleLiberacao: vi.fn(), toggleEscalado: vi.fn(), setLinhaOverride: vi.fn(),
  adicionarAjuda: vi.fn(), removerAjuda: vi.fn(), reordenarAjuda: vi.fn(), definirOrigemLinha: vi.fn(),
  definirP4Hospital: vi.fn(), setAnestesistaCasos: vi.fn(), marcarTroca: vi.fn(),
  executarSubstituicao: vi.fn(), desfazerSubstituicao: vi.fn(), salvarEscalaTurno: vi.fn(),
  prefetch: vi.fn(),
})

const EU = { uid: 'uid-guilherme', role: 'anestesiologista', displayName: 'Guilherme Melo' }

const marcado = (...nomes) => nomes
  .find((n) => screen.queryByRole('tab', { name: n })?.getAttribute('aria-selected') === 'true') || null
const hospitalMarcado = () => marcado('Unimed', 'HRO', 'Materno')
const turnoMarcado = () => marcado('Manhã', 'Tarde', 'Noite')
const abaMarcada = () => marcado('Minhas', 'Completa', 'Liberações')

const escalaCom = (hospital, casos) => ({
  id: `e-${hospital}`, hospital, status: 'publicada', data: hojeLocalISO(),
  ordemLiberacao: { matutino: [], vespertino: [] }, ajudaExterna: {},
  liberacoes: {}, linhaOverrides: {}, casos,
})
const meuCaso = (turno) => ({
  id: `c-${turno}`, sala: 'CC - Sala 1', turno,
  anestesista: 'GUILHERME', anestesistaUserId: EU.uid,
  procedimento: 'Colecistectomia', cirurgiao: 'Dr. A', pacienteIniciais: 'M.A.S.',
})
const casoDeOutro = (turno) => ({
  id: `o-${turno}`, sala: 'CC - Sala 2', turno,
  anestesista: 'OUTRO', anestesistaUserId: 'uid-outro',
  procedimento: 'Hérnia', cirurgiao: 'Dr. B', pacienteIniciais: 'J.P.L.',
})

const montar = ({ user = EU, escalas } = {}) => {
  const hoje = hojeLocalISO()
  estado.user = user
  estado.ctx = {
    escalas: { unimed: null, hro: null, materno: null, fds: null, ...escalas },
    p4Hospital: null, data: hoje, hoje, loading: false, ...acoes(),
  }
  return render(<EscalaCirurgicaPage onNavigate={() => {}} goBack={() => {}} />, { wrapper: wrap })
}

beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }) })
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

describe('aba "Minhas" leva ao meu posto', () => {
  it('tocar em Minhas marca o hospital onde estou, sem mexer no layout', async () => {
    // 10h — turno em curso é a manhã; estou escalado no HRO
    vi.setSystemTime(new Date('2026-09-09T10:00:00-03:00'))
    montar({
      escalas: {
        unimed: escalaCom('unimed', [casoDeOutro('matutino')]),
        hro: escalaCom('hro', [meuCaso('matutino')]),
      },
    })
    // a abertura já usa a mesma varredura (a aba que abre É a Minhas)
    expect(hospitalMarcado()).toBe('HRO')

    // vou olhar a Unimed de propósito e volto para Minhas
    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'Unimed' })) })
    expect(hospitalMarcado()).toBe('Unimed')
    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'Completa' })) })
    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'Minhas' })) })

    expect(abaMarcada()).toBe('Minhas')
    expect(hospitalMarcado()).toBe('HRO')
    expect(screen.queryByText('Você não está escalado aqui')).toBeNull()
  })

  it('o turno também é marcado — e o turno EM CURSO tem preferência sobre a ordem dos hospitais', async () => {
    // 14h: manhã na Unimed, tarde no HRO. O posto de agora é o do HRO.
    vi.setSystemTime(new Date('2026-09-09T14:00:00-03:00'))
    montar({
      escalas: {
        unimed: escalaCom('unimed', [meuCaso('matutino')]),
        hro: escalaCom('hro', [meuCaso('vespertino')]),
      },
    })
    expect(turnoMarcado()).toBe('Tarde')
    expect(hospitalMarcado()).toBe('HRO')
  })

  it('sem nada no turno em curso, a aba leva ao outro turno em vez de deixar a tela vazia', async () => {
    vi.setSystemTime(new Date('2026-09-09T14:00:00-03:00')) // tarde
    montar({ escalas: { unimed: escalaCom('unimed', [meuCaso('matutino')]) } })
    expect(turnoMarcado()).toBe('Manhã')
    expect(hospitalMarcado()).toBe('Unimed')
  })

  it('quem não está escalado em lugar nenhum não tem o cabeçalho mexido', async () => {
    vi.setSystemTime(new Date('2026-09-09T10:00:00-03:00'))
    montar({
      escalas: {
        unimed: escalaCom('unimed', [casoDeOutro('matutino')]),
        hro: escalaCom('hro', [casoDeOutro('matutino')]),
      },
    })
    expect(hospitalMarcado()).toBe('Unimed') // padrão, intocado
    expect(turnoMarcado()).toBe('Manhã')
    expect(screen.getByText('Você não está escalado aqui')).toBeTruthy()
  })
})

// ── Contas de hospital (dono 2026-09-09) ────────────────────────────────────
// "Na escala das funcionárias da Unimed (não há necessidade de mostrar a aba
// 'minhas' já que elas não assumirão nenhuma sala)" + "HRO abre no HRO, Unimed
// na Unimed".
describe('contas de hospital na escala', () => {
  it.each([
    ['func-unimed', 'Unimed'],
    ['func-hro', 'HRO'],
  ])('%s abre na Completa, no hospital dela, sem a aba Minhas', async (role, hospital) => {
    vi.setSystemTime(new Date('2026-09-09T10:00:00-03:00'))
    montar({
      user: { uid: `uid-${role}`, role, displayName: hospital },
      escalas: { unimed: escalaCom('unimed', [casoDeOutro('matutino')]) },
    })
    expect(screen.queryByRole('tab', { name: 'Minhas' })).toBeNull()
    expect(screen.getByRole('tab', { name: 'Completa' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Liberações' })).toBeTruthy()
    expect(abaMarcada()).toBe('Completa')
    expect(hospitalMarcado()).toBe(hospital)
  })

  it('a equipe continua com as três abas e a Minhas na frente', async () => {
    vi.setSystemTime(new Date('2026-09-09T10:00:00-03:00'))
    montar({ escalas: { unimed: escalaCom('unimed', [meuCaso('matutino')]) } })
    expect(screen.getByRole('tab', { name: 'Minhas' })).toBeTruthy()
    expect(abaMarcada()).toBe('Minhas')
  })

  it('conta de hospital não publica — o pill "Importar" não aparece para ela', async () => {
    vi.setSystemTime(new Date('2026-09-09T10:00:00-03:00'))
    montar({ user: { uid: 'uid-hro', role: 'func-hro', displayName: 'HRO' }, escalas: {} })
    expect(screen.queryByLabelText('Importar escala')).toBeNull()
  })
})

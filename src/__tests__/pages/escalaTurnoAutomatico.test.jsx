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

/** Turno selecionado, lido do próprio seletor (o subtítulo virou a data). */
const turnoAtivo = () => ['Manhã', 'Tarde', 'Noite']
  .find((n) => screen.queryByRole('tab', { name: n })?.getAttribute('aria-selected') === 'true') || null

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
    expect(turnoAtivo()).toBe('Manhã')
    // 12:59 → 13:01 — o tick do relógio (30s) dispara a virada, sem toque
    await act(async () => { vi.advanceTimersByTime(2 * 60_000) })
    expect(turnoAtivo()).toBe('Tarde')
  })

  it('FDS: às 19h o turno vira NOTURNO (3 turnos no seletor: 7h/13h/19h)', async () => {
    vi.setSystemTime(new Date('2026-08-15T18:59:00-03:00')) // sábado, fim da tarde
    const hoje = hojeLocalISO()
    estado.ctx = {
      escalas: {
        unimed: null, hro: null, materno: null,
        fds: {
          id: 'fds-1', hospital: 'fds', status: 'publicada', data: hoje,
          ordemLiberacao: { matutino: ['A'], vespertino: ['B'] }, ajudaExterna: {},
          liberacoes: {}, linhaOverrides: {}, casos: [],
          fdsMeta: { grade: { '19-07': { unimed: 'JOAO HENRIQUE', hro: 'GUILHERME DIDOMENICO', ret1: 'MATHEUS', ret2: 'CRISTINA' } }, posicoes: {} },
        },
      },
      p4Hospital: null, data: hoje, hoje, loading: false, ...acoes(),
    }
    render(<EscalaCirurgicaPage onNavigate={() => {}} goBack={() => {}} />, { wrapper: wrap })
    // seletor tem os 3 turnos do fim de semana, com rótulos CURTOS (dono 16/08:
    // Manhã/Tarde/Noite cabem ao lado do 'Hoje' a 375px)
    expect(screen.getByRole('tab', { name: 'Noite' })).toBeTruthy()
    // ⚠️ a comparação com o trilho de HOSPITAL saiu em 24/08: no fim de semana ele
    // não existe mais (tela única). O que este teste cobre é a VIRADA do turno —
    // a separação dos trilhos segue coberta no dia útil, logo abaixo.
    expect(turnoAtivo()).toBe('Tarde')
    // 18:59 → 19:01: a virada das 19h leva a tela para o noturno sozinha
    await act(async () => { vi.advanceTimersByTime(2 * 60_000) })
    expect(turnoAtivo()).toBe('Noite')
  })

  // ⚠️ ESTE TESTE MUDOU DE LADO EM 24/08, e o porquê fica aqui em vez de o teste
  // sumir: em 16/08 o dono quis os três hospitais visíveis no fim de semana; em
  // 24/08 ele decidiu que sáb/dom têm UMA TELA SÓ — a fila já cobre os três, e o
  // seletor não filtrava nada. O que a trava protege continua sendo o mesmo:
  // que a tela do fim de semana não volte a pedir "qual hospital?" quando a fila
  // é única. Só o sentido da asserção inverteu, por decisão do dono.
  it('FDS: NÃO há seletor de hospital nem abas — a fila única é a tela (dono 24/08)', () => {
    vi.setSystemTime(new Date('2026-08-15T10:00:00-03:00'))
    const hoje = hojeLocalISO()
    estado.ctx = {
      escalas: {
        unimed: null, hro: null, materno: null,
        fds: {
          id: 'fds-1', hospital: 'fds', status: 'publicada', data: hoje,
          ordemLiberacao: { matutino: ['A'] }, ajudaExterna: {}, liberacoes: {}, linhaOverrides: {}, casos: [],
          fdsMeta: { grade: {}, posicoes: {} },
        },
      },
      p4Hospital: null, data: hoje, hoje, loading: false, ...acoes(),
    }
    render(<EscalaCirurgicaPage onNavigate={() => {}} goBack={() => {}} />, { wrapper: wrap })
    // sem aba para clicar: a fila já é o que está na tela
    expect(screen.queryByRole('tab', { name: 'Liberações' })).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Completa' })).toBeNull()
    for (const h of ['Unimed', 'HRO', 'Materno']) {
      expect(screen.queryByRole('tab', { name: h })).toBeNull()
    }
    // o TURNO continua: é o único eixo que sobra no fim de semana
    expect(screen.getByRole('tab', { name: 'Manhã' })).toBeTruthy()
  })

  it('o atalho de VÍNCULOS saiu do header (dono 16/08)', () => {
    vi.setSystemTime(new Date('2026-08-17T10:00:00-03:00'))
    montarHoje()
    expect(screen.queryByLabelText(/Vínculos de nomes/)).toBeNull()
    expect(screen.getByLabelText('Importar escala')).toBeTruthy()
  })

  // Histórico: em 24/08 o outline sem ícone do protótipo de FDS vazou pro dia
  // útil e o dono recusou ("não altere a escala de dias úteis") — o ghost com
  // ícone voltou e este teste o travava. Em 31/08 veio o pedido PRÓPRIO para o
  // dia a dia: "Importar" no pill modelo "Extrato", igual nos dois modos.
  it('DIA ÚTIL: o "Importar" é o pill do Extrato, sem ícone (dono 31/08)', () => {
    vi.setSystemTime(new Date('2026-08-17T10:00:00-03:00'))
    montarHoje()
    const btn = screen.getByLabelText('Importar escala')
    expect(btn.querySelector('svg')).toBeNull()
    expect(btn.textContent.trim()).toBe('Importar')
  })

  it('o calendário livre "Outra data" SAIU da tela (dono 16/08)', () => {
    vi.setSystemTime(new Date('2026-08-17T10:00:00-03:00'))
    montarHoje()
    expect(screen.queryByText(/Outra data/)).toBeNull()
    // "Hoje" sozinho também saiu (dono 16/08): sem escala de amanhã publicada
    // não há escolha de data, e a data mora no subtítulo do cabeçalho
    expect(screen.queryByRole('tab', { name: 'Hoje' })).toBeNull()
  })

  it('FDS: os 3 turnos aparecem no PRIMEIRO render, sem esperar a fila carregar', () => {
    // defeito 16/08 ("pisca com informações antigas"): a barra abria com
    // "Manhã | Tarde" e virava 3 turnos ~3s depois, quando a linha 'fds'
    // chegava do banco. Sábado/domingo é do calendário — não espera rede.
    vi.setSystemTime(new Date('2026-08-15T20:00:00-03:00')) // sábado, 20h
    const hoje = hojeLocalISO()
    estado.ctx = {
      // NENHUMA escala carregada ainda (é o instante do primeiro render)
      escalas: { unimed: null, hro: null, materno: null, fds: null },
      p4Hospital: null, data: hoje, hoje, loading: true, ...acoes(),
    }
    render(<EscalaCirurgicaPage onNavigate={() => {}} goBack={() => {}} />, { wrapper: wrap })
    expect(screen.getByRole('tab', { name: 'Manhã' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Tarde' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Noite' })).toBeTruthy()
    // e já abre no turno certo do relógio (20h = noite), sem trocar depois
    expect(turnoAtivo()).toBe('Noite')
  })

  it('dia útil NÃO tem turno Noturno (é conceito do fim de semana)', () => {
    vi.setSystemTime(new Date('2026-08-17T10:00:00-03:00')) // segunda
    montarHoje()
    expect(screen.queryByRole('tab', { name: 'Noite' })).toBeNull()
    expect(screen.getByRole('tab', { name: 'Manhã' })).toBeTruthy()
  })

  it('escolha manual divergente NÃO é desfeita pelo relógio na mesma faixa', async () => {
    vi.setSystemTime(new Date('2026-08-15T14:00:00-03:00')) // tarde
    montarHoje()
    expect(turnoAtivo()).toBe('Tarde')
    // usuário consulta a manhã de propósito…
    fireEvent.click(screen.getByRole('tab', { name: 'Manhã' }))
    expect(turnoAtivo()).toBe('Manhã')
    // …e os ticks seguintes não roubam a tela de volta
    await act(async () => { vi.advanceTimersByTime(5 * 60_000) })
    expect(turnoAtivo()).toBe('Manhã')
  })
})

/**
 * CABEÇALHO SEM OSCILAR (dono 29/08): "o cabeçalho de final de semana alterna
 * com o cabeçalho de dias úteis (mostrando abas: minhas, completa e liberações)
 * — verifique e corrija para que a informação não oscile entre dias úteis,
 * finais de semana e feriados".
 *
 * É o mesmo defeito do seletor de turno de 16/08, no outro eixo: `modoFds`
 * depende do FETCH da linha 'fds' e o contexto ZERA `escalas` ao trocar de data
 * sem cache. Nessa janela a tela de sábado abria com as abas e o seletor de
 * hospital do dia útil e trocava sozinha ~1s depois. O remédio é o mesmo:
 * sáb/dom/feriado é dado do CALENDÁRIO e decide os EIXOS sem esperar rede.
 */
describe('cabeçalho não oscila entre dia útil e fim de semana (dono 29/08)', () => {
  const montar = (iso, extra = {}) => {
    estado.ctx = {
      escalas: { unimed: null, hro: null, materno: null, fds: null },
      p4Hospital: null, data: iso, hoje: iso, loading: false, ...acoes(), ...extra,
    }
    return render(<EscalaCirurgicaPage onNavigate={() => {}} goBack={() => {}} />, { wrapper: wrap })
  }

  it('SÁBADO carregando: já abre sem as abas e sem o seletor de hospital', () => {
    vi.setSystemTime(new Date('2026-08-29T10:00:00-03:00')) // sábado
    montar('2026-08-29', { loading: true })
    expect(screen.queryByRole('tab', { name: 'Completa' })).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Minhas' })).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Unimed' })).toBeNull()
    // o eixo que existe no fim de semana continua lá desde o 1º render
    expect(screen.getByRole('tab', { name: 'Noite' })).toBeTruthy()
  })

  it('FERIADO carregando: idem — a fila única também vale nele', () => {
    vi.setSystemTime(new Date('2026-08-25T10:00:00-03:00')) // terça, feriado
    montar('2026-08-25', { loading: true })
    expect(screen.queryByRole('tab', { name: 'Completa' })).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Unimed' })).toBeNull()
  })

  it('DIA ÚTIL carregando: abas e hospital continuam desde o 1º render', () => {
    vi.setSystemTime(new Date('2026-08-27T10:00:00-03:00')) // quinta
    montar('2026-08-27', { loading: true })
    expect(screen.getByRole('tab', { name: 'Completa' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Unimed' })).toBeTruthy()
  })

  it('sábado SEM fila publicada, depois de carregar, cai no modo por hospital', () => {
    // rollout seguro: sem a linha 'fds' a tela volta a ser por hospital — uma
    // transição só, no caso raro, em vez de uma a cada abertura
    vi.setSystemTime(new Date('2026-08-29T10:00:00-03:00'))
    montar('2026-08-29', { loading: false })
    expect(screen.getByRole('tab', { name: 'Unimed' })).toBeTruthy()
  })
})

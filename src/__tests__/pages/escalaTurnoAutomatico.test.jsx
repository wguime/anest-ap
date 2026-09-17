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
 *
 * 16/09 — O SELETOR DE TURNO SÓ EXISTE COM ESCOLHA (dono): "não quero mais que
 * apareçam as opções de turno para clicar, quero apenas que apareça o turno em
 * curso. Ao adicionar uma nova escala ela deve aparecer como opção para clicar
 * no turno… na virada de turno a escala anterior sai, exceto na transição do
 * turno vespertino para noturno." O turno exibido passou ao SUBTÍTULO do
 * cabeçalho ("Hoje · Quarta, 16/09 · Tarde"); o trilho volta só quando a tela
 * oferece mais de um turno (em curso + seguinte publicado; tarde + noite).
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

/** Turno selecionado no TRILHO (só existe quando há mais de um para escolher). */
const turnoAtivo = () => ['Manhã', 'Tarde', 'Noite']
  .find((n) => screen.queryByRole('tab', { name: n })?.getAttribute('aria-selected') === 'true') || null
/** Turno EXIBIDO, lido do subtítulo do cabeçalho ("Hoje · Sábado, 15/08 · Tarde"). */
const turnoNoTitulo = () => (screen.getByText(/^(Hoje|Amanhã) · /).textContent.match(/· (Manhã|Tarde|Noite)$/) || [])[1] || null
const trilhoDeTurno = () => ['Manhã', 'Tarde', 'Noite'].filter((n) => screen.queryByRole('tab', { name: n }))

/** Escala de um hospital com casos carimbados nos turnos dados (= turnos publicados). */
const escalaComTurnos = (hospital, turnos) => ({
  id: `e-${hospital}`, hospital, status: 'publicada', data: hojeLocalISO(),
  ordemLiberacao: { matutino: [], vespertino: [] }, ajudaExterna: {}, liberacoes: {}, linhaOverrides: {},
  casos: turnos.map((t, i) => ({
    id: `c-${hospital}-${t}-${i}`, sala: 'CC - Sala 1', turno: t, hora: t === 'matutino' ? '08:00' : '14:00',
    anestesista: 'OUTRO', anestesistaUserId: 'uid-outro', procedimento: 'Hérnia', cirurgiao: 'Dr. B', pacienteIniciais: 'J.P.L.',
  })),
})

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
    vi.setSystemTime(new Date('2026-08-17T12:59:00-03:00')) // segunda
    montarHoje()
    expect(turnoNoTitulo()).toBe('Manhã')
    // 12:59 → 13:01 — o tick do relógio (30s) dispara a virada, sem toque
    await act(async () => { vi.advanceTimersByTime(2 * 60_000) })
    expect(turnoNoTitulo()).toBe('Tarde')
  })

  // ── 16/09: o trilho só existe com escolha ─────────────────────────────────
  it('dia útil, SÓ a manhã publicada: nenhum trilho de turno; o subtítulo diz "Manhã"', () => {
    vi.setSystemTime(new Date('2026-08-17T10:00:00-03:00'))
    const hoje = hojeLocalISO()
    estado.ctx = {
      escalas: { unimed: escalaComTurnos('unimed', ['matutino']), hro: null, materno: null, fds: null },
      p4Hospital: null, data: hoje, hoje, loading: false, ...acoes(),
    }
    render(<EscalaCirurgicaPage onNavigate={() => {}} goBack={() => {}} />, { wrapper: wrap })
    expect(trilhoDeTurno()).toEqual([])
    expect(turnoNoTitulo()).toBe('Manhã')
  })

  it('a escala da TARDE publicada durante a manhã vira opção: "Manhã | Tarde"; às 13h a manhã sai', async () => {
    vi.setSystemTime(new Date('2026-08-17T12:59:00-03:00'))
    const hoje = hojeLocalISO()
    estado.ctx = {
      escalas: { unimed: escalaComTurnos('unimed', ['matutino', 'vespertino']), hro: null, materno: null, fds: null },
      p4Hospital: null, data: hoje, hoje, loading: false, ...acoes(),
    }
    render(<EscalaCirurgicaPage onNavigate={() => {}} goBack={() => {}} />, { wrapper: wrap })
    expect(trilhoDeTurno()).toEqual(['Manhã', 'Tarde'])
    expect(turnoAtivo()).toBe('Manhã')
    expect(turnoNoTitulo()).toBe('Manhã')
    // espiar a tarde de propósito: o subtítulo acompanha o exibido
    fireEvent.click(screen.getByRole('tab', { name: 'Tarde' }))
    expect(turnoNoTitulo()).toBe('Tarde')
    // virada das 13h: a manhã SAI da tela — sobra a tarde, sem trilho
    await act(async () => { vi.advanceTimersByTime(2 * 60_000) })
    expect(trilhoDeTurno()).toEqual([])
    expect(turnoNoTitulo()).toBe('Tarde')
  })

  it('dia útil às 20h: a escala da tarde FICA (exceção vespertino→noturno) e o subtítulo diz "Noite"', () => {
    vi.setSystemTime(new Date('2026-08-17T20:00:00-03:00'))
    const hoje = hojeLocalISO()
    estado.ctx = {
      escalas: { unimed: escalaComTurnos('unimed', ['matutino', 'vespertino']), hro: null, materno: null, fds: null },
      p4Hospital: null, data: hoje, hoje, loading: false, ...acoes(),
    }
    render(<EscalaCirurgicaPage onNavigate={() => {}} goBack={() => {}} />, { wrapper: wrap })
    expect(trilhoDeTurno()).toEqual([]) // nem manhã (saiu às 13h) nem noite (é fase da aba)
    expect(turnoNoTitulo()).toBe('Noite')
    // e as cirurgias da tarde seguem na tela
    expect(screen.queryByText('Nenhum caso neste turno')).toBeNull()
  })

  it('FDS às 20h: "Tarde | Noite" — a tarde fica quando a noite entra, a manhã já saiu', () => {
    vi.setSystemTime(new Date('2026-08-15T20:00:00-03:00')) // sábado
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
    expect(trilhoDeTurno()).toEqual(['Tarde', 'Noite'])
    expect(turnoAtivo()).toBe('Noite')
    expect(turnoNoTitulo()).toBe('Noite')
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
    // seletor tem a tarde (em curso) e a noite (publicada — o documento do FDS
    // cobre o dia inteiro), com rótulos CURTOS (dono 16/08: Manhã/Tarde/Noite
    // cabem ao lado do 'Hoje' a 375px). A manhã já saiu na virada das 13h (16/09).
    expect(screen.getByRole('tab', { name: 'Noite' })).toBeTruthy()
    expect(screen.queryByRole('tab', { name: 'Manhã' })).toBeNull()
    // ⚠️ a comparação com o trilho de HOSPITAL saiu em 24/08: no fim de semana ele
    // não existe mais (tela única). O que este teste cobre é a VIRADA do turno —
    // a separação dos trilhos segue coberta no dia útil, logo abaixo.
    expect(turnoAtivo()).toBe('Tarde')
    // 18:59 → 19:01: a virada das 19h leva a tela para o noturno sozinha — e a
    // tarde FICA como opção (exceção vespertino→noturno, dono 16/09)
    await act(async () => { vi.advanceTimersByTime(2 * 60_000) })
    expect(turnoAtivo()).toBe('Noite')
    expect(screen.getByRole('tab', { name: 'Tarde' })).toBeTruthy()
  })

  // ⚠️ ESTE TESTE JÁ MUDOU DE LADO DUAS VEZES, e o porquê fica aqui em vez de o
  // teste sumir. 16/08: o dono quis os três hospitais no fim de semana. 24/08:
  // sáb/dom viraram UMA TELA SÓ (sem abas, sem hospital — a fila cobre os três).
  // 13/09: "quero que mostre a escala completa (dividida por hospitais) como é
  // mostrado em dias úteis, mas mantenha a liberação única" — as abas voltam,
  // Minhas/Completa filtram por hospital, e o seletor de hospital some SÓ na aba
  // Liberações, onde a fila é única e ele não filtraria nada (B1, escolhido em
  // protótipo contra "hospital sempre"). O que a trava protege segue o mesmo:
  // a tela não pede "qual hospital?" onde a fila é única.
  it('FDS: as abas de dia útil existem; o hospital some SÓ nas Liberações (dono 13/09)', () => {
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
    // as três abas, como num dia útil
    for (const a of ['Minhas', 'Completa', 'Liberações']) expect(screen.getByRole('tab', { name: a })).toBeTruthy()
    // abre na Minhas: o hospital filtra, então está na tela
    for (const h of ['Unimed', 'HRO', 'Materno']) expect(screen.getByRole('tab', { name: h })).toBeTruthy()
    // nas Liberações a fila é única: o seletor de hospital some, o turno fica
    fireEvent.click(screen.getByRole('tab', { name: 'Liberações' }))
    for (const h of ['Unimed', 'HRO', 'Materno']) expect(screen.queryByRole('tab', { name: h })).toBeNull()
    expect(screen.getByRole('tab', { name: 'Manhã' })).toBeTruthy()
    // e volta na Completa, que é por hospital
    fireEvent.click(screen.getByRole('tab', { name: 'Completa' }))
    expect(screen.getByRole('tab', { name: 'Unimed' })).toBeTruthy()
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
    // 16/09: a manhã já SAIU (virada das 13h); ficam a tarde (exceção
    // vespertino→noturno) e a noite — e isso vem do CALENDÁRIO, sem esperar rede
    expect(screen.queryByRole('tab', { name: 'Manhã' })).toBeNull()
    expect(screen.getByRole('tab', { name: 'Tarde' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Noite' })).toBeTruthy()
    // e já abre no turno certo do relógio (20h = noite), sem trocar depois
    expect(turnoAtivo()).toBe('Noite')
  })

  it('dia útil NÃO tem turno Noturno no seletor (é conceito do fim de semana)', () => {
    vi.setSystemTime(new Date('2026-08-17T10:00:00-03:00')) // segunda
    const hoje = hojeLocalISO()
    estado.ctx = {
      escalas: { unimed: escalaComTurnos('unimed', ['matutino', 'vespertino']), hro: null, materno: null, fds: null },
      p4Hospital: null, data: hoje, hoje, loading: false, ...acoes(),
    }
    render(<EscalaCirurgicaPage onNavigate={() => {}} goBack={() => {}} />, { wrapper: wrap })
    expect(screen.queryByRole('tab', { name: 'Noite' })).toBeNull()
    expect(screen.getByRole('tab', { name: 'Manhã' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Tarde' })).toBeTruthy()
  })

  it('escolha manual divergente NÃO é desfeita pelo relógio na mesma faixa', async () => {
    vi.setSystemTime(new Date('2026-08-17T11:00:00-03:00')) // manhã, tarde já publicada
    const hoje = hojeLocalISO()
    estado.ctx = {
      escalas: { unimed: escalaComTurnos('unimed', ['matutino', 'vespertino']), hro: null, materno: null, fds: null },
      p4Hospital: null, data: hoje, hoje, loading: false, ...acoes(),
    }
    render(<EscalaCirurgicaPage onNavigate={() => {}} goBack={() => {}} />, { wrapper: wrap })
    expect(turnoAtivo()).toBe('Manhã')
    // usuário consulta a tarde de propósito…
    fireEvent.click(screen.getByRole('tab', { name: 'Tarde' }))
    expect(turnoAtivo()).toBe('Tarde')
    // …e os ticks seguintes não roubam a tela de volta
    await act(async () => { vi.advanceTimersByTime(5 * 60_000) })
    expect(turnoAtivo()).toBe('Tarde')
    expect(turnoNoTitulo()).toBe('Tarde')
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

  // ⚠️ MUDOU DE LADO em 13/09: as abas voltaram ao fim de semana. O que não
  // oscila continua sendo decidido pelo CALENDÁRIO + aba: desde o 1º render o
  // sábado abre com as três abas e os três turnos; o hospital só some quando a
  // aba é Liberações — e isso não depende de rede.
  it('SÁBADO carregando: já abre com as abas, o hospital e os 3 turnos', () => {
    vi.setSystemTime(new Date('2026-08-29T10:00:00-03:00')) // sábado
    montar('2026-08-29', { loading: true })
    expect(screen.getByRole('tab', { name: 'Completa' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Minhas' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Unimed' })).toBeTruthy()
    // o eixo que só existe no fim de semana está lá desde o 1º render
    expect(screen.getByRole('tab', { name: 'Noite' })).toBeTruthy()
    // e, ainda carregando, as Liberações já escondem o hospital — sem esperar a
    // linha 'fds' chegar (é isso que o cabeçalho não oscilar quer dizer)
    fireEvent.click(screen.getByRole('tab', { name: 'Liberações' }))
    expect(screen.queryByRole('tab', { name: 'Unimed' })).toBeNull()
  })

  it('FERIADO carregando: idem — a fila única também vale nele', () => {
    vi.setSystemTime(new Date('2026-08-25T10:00:00-03:00')) // terça, feriado
    montar('2026-08-25', { loading: true })
    expect(screen.getByRole('tab', { name: 'Completa' })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Liberações' }))
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

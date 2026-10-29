/**
 * OS TURNOS DO DIA FICAM ABERTOS (dono 28/10/2026, modelos em `.tmp/popup-horarios/turnos.html`).
 *
 * "As escalas da manhã, da tarde e da noite do MESMO DIA continuam abertas, para quem esqueceu
 * corrigir o horário." Até aqui a manhã saía do seletor às 13h (regra de 16/09) e só quem operou
 * alcançava a cirurgia dela, pela caixa vermelha. Escolhas do dono: Tela 1 = A (o trilho de
 * sempre + a faixa âmbar com "Voltar à tarde"), Tela 2 = A+ (horário e quem fez), Tela 3 = A
 * (aviso no lugar da fila de um turno encerrado).
 *
 * Travas:
 *  · a regra pura: quais turnos o seletor oferece e quando um turno já acabou;
 *  · na tela: a manhã fica no trilho à tarde; tocada, a faixa âmbar diz que ela encerrou e leva
 *    de volta à tarde; nas Liberações, o aviso no lugar da fila; na Completa, sem "Adicionar
 *    caso";
 *  · o que tinha de continuar valendo: a tela abre no turno em curso, ENTRAR volta a hoje, e
 *    voltar depois de 2 min fora sai do turno encerrado.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import { fraseTurnoEncerrado, turnoJaEncerrou, turnosOferecidos, voltarAoTurno } from '@/pages/escala-cirurgica/utils'
import { _zerarAnteriores } from '@/pages/escala-cirurgica/pendenciasAnteriores'

const hojeLocalISO = (base) => {
  const d = base instanceof Date ? base : new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const { estado, svcMock } = vi.hoisted(() => ({
  estado: { ctx: null, user: null },
  svcMock: {
    fetchEscala: vi.fn(async () => null),
    fetchLocaisHospital: vi.fn(async () => []),
    fetchStatusDia: vi.fn(async () => []),
    fetchCasosDaPessoa: vi.fn(async () => []),
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
vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ user: estado.user }) }))
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
  setData: vi.fn(), prefetch: vi.fn(async () => {}), toggleLiberacao: vi.fn(), toggleEscalado: vi.fn(), setLinhaOverride: vi.fn(),
  adicionarAjuda: vi.fn(), removerAjuda: vi.fn(), reordenarAjuda: vi.fn(), definirP4Hospital: vi.fn(),
  setAnestesistaCasos: vi.fn(), marcarTroca: vi.fn(), executarSubstituicao: vi.fn(), desfazerSubstituicao: vi.fn(),
  setStatusCirurgia: vi.fn(async () => {}), atualizarCaso: vi.fn(async () => {}),
})

// quarta-feira útil
const HOJE = '2026-10-28'
const escalaDoDia = (hospital = 'unimed') => ({
  id: `e-${hospital}`, hospital, status: 'publicada', data: HOJE,
  ordemLiberacao: { matutino: ['ANA'], vespertino: ['BRUNO'] }, ajudaExterna: {}, liberacoes: {}, linhaOverrides: {},
  casos: [
    { id: 'm1', sala: 'CC - Sala 1', turno: 'matutino', hora: '08:00', anestesista: 'OUTRO', anestesistaUserId: 'uid-outro', procedimento: 'Hérnia', cirurgiao: 'Dr. B', statusCirurgia: 'terminada', inicioReal: '08:05', terminoReal: '09:00' },
    { id: 't1', sala: 'CC - Sala 2', turno: 'vespertino', hora: '14:00', anestesista: 'OUTRO', anestesistaUserId: 'uid-outro', procedimento: 'Colecistectomia', cirurgiao: 'Dr. C', statusCirurgia: 'iniciada', inicioReal: '14:05' },
  ],
})

const montar = ({ data = HOJE, escalas = { unimed: escalaDoDia() } } = {}) => {
  estado.ctx = {
    escalas: { unimed: null, hro: null, materno: null, fds: null, ...escalas },
    p4Hospital: null, data, hoje: HOJE, loading: false, ...acoes(),
  }
  return render(<EscalaCirurgicaPage onNavigate={() => {}} goBack={() => {}} />, { wrapper: wrap })
}

const turnoAtivo = () => ['Manhã', 'Tarde', 'Noite']
  .find((n) => screen.queryByRole('tab', { name: n })?.getAttribute('aria-selected') === 'true') || null
const trilhoDeTurno = () => ['Manhã', 'Tarde', 'Noite'].filter((n) => screen.queryByRole('tab', { name: n }))
const turnoNoTitulo = () => (screen.getByText(/^(Hoje|Amanhã) · /).textContent.match(/· (Manhã|Tarde|Noite)$/) || [])[1] || null
const faixaAmbar = () => document.querySelector('[role="status"][data-turno-encerrado]')
const aba = (nome) => fireEvent.click(screen.getByRole('tab', { name: nome }))

let visivel = 'visible'
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(`${HOJE}T15:00:00-03:00`))
  estado.user = { uid: 'u-x', role: 'anestesiologista', displayName: 'X' }
  localStorage.clear()
  _zerarAnteriores()
  visivel = 'visible'
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visivel })
})
afterEach(() => vi.useRealTimers())

describe('regra pura: os turnos que o seletor oferece (28/10)', () => {
  const DIA_UTIL = [{ value: 'matutino', label: 'Manhã' }, { value: 'vespertino', label: 'Tarde' }]
  const FDS = [...DIA_UTIL, { value: 'noturno', label: 'Noite' }]
  const valores = (l) => l.map((o) => o.value)

  it('hoje, à tarde: a manhã publicada FICA (antes de 28/10 ela saía às 13h)', () => {
    expect(valores(turnosOferecidos({ todas: DIA_UTIL, emCurso: 'vespertino', publicados: new Set(['matutino', 'vespertino']), ehHoje: true })))
      .toEqual(['matutino', 'vespertino'])
  })

  it('turno que não foi publicado não aparece; o em curso aparece sempre', () => {
    expect(valores(turnosOferecidos({ todas: DIA_UTIL, emCurso: 'vespertino', publicados: new Set(['vespertino']), ehHoje: true })))
      .toEqual(['vespertino'])
    expect(valores(turnosOferecidos({ todas: DIA_UTIL, emCurso: 'vespertino', publicados: new Set(), ehHoje: true })))
      .toEqual(['vespertino'])
  })

  it('FDS à noite: os três turnos do dia', () => {
    expect(valores(turnosOferecidos({ todas: FDS, emCurso: 'noturno', publicados: new Set(['matutino', 'vespertino', 'noturno']), ehHoje: true })))
      .toEqual(['matutino', 'vespertino', 'noturno'])
  })

  it('outra data: o que está publicado; nada publicado → o primeiro', () => {
    expect(valores(turnosOferecidos({ todas: DIA_UTIL, emCurso: 'matutino', publicados: new Set(['vespertino']), ehHoje: false })))
      .toEqual(['vespertino'])
    expect(valores(turnosOferecidos({ todas: DIA_UTIL, emCurso: 'matutino', publicados: new Set(), ehHoje: false })))
      .toEqual(['matutino'])
  })

  it('um turno acabou quando o relógio já está num turno seguinte — e só hoje', () => {
    expect(turnoJaEncerrou({ turno: 'matutino', emCurso: 'vespertino', ehHoje: true })).toBe(true)
    expect(turnoJaEncerrou({ turno: 'vespertino', emCurso: 'vespertino', ehHoje: true })).toBe(false)
    // FDS: a tarde acaba quando a noite (turno próprio) entra
    expect(turnoJaEncerrou({ turno: 'vespertino', emCurso: 'noturno', ehHoje: true })).toBe(true)
    // turno seguinte não é "encerrado"
    expect(turnoJaEncerrou({ turno: 'vespertino', emCurso: 'matutino', ehHoje: true })).toBe(false)
    // outra data nunca
    expect(turnoJaEncerrou({ turno: 'matutino', emCurso: 'vespertino', ehHoje: false })).toBe(false)
  })

  it('as frases da faixa: "Manhã encerrada às 13h" e "Voltar à tarde"', () => {
    expect(fraseTurnoEncerrado('matutino')).toBe('Manhã encerrada às 13h')
    expect(fraseTurnoEncerrado('vespertino')).toBe('Tarde encerrada às 19h')
    expect(voltarAoTurno('vespertino')).toBe('Voltar à tarde')
    expect(voltarAoTurno('noturno')).toBe('Voltar à noite')
  })
})

describe('na tela, às 15h de um dia útil (28/10)', () => {
  it('a tela abre na TARDE (turno em curso) e a manhã fica no trilho, sem faixa âmbar', () => {
    montar()
    expect(trilhoDeTurno()).toEqual(['Manhã', 'Tarde'])
    expect(turnoAtivo()).toBe('Tarde')
    expect(turnoNoTitulo()).toBe('Tarde')
    expect(faixaAmbar()).toBeNull()
  })

  it('tocar na manhã: a faixa âmbar diz que ela encerrou às 13h, e "Voltar à tarde" volta', () => {
    montar()
    aba('Manhã')
    expect(turnoNoTitulo()).toBe('Manhã')
    expect(faixaAmbar()?.textContent).toMatch(/Manhã encerrada às 13h/)
    fireEvent.click(screen.getByRole('button', { name: 'Voltar à tarde' }))
    expect(turnoAtivo()).toBe('Tarde')
    expect(faixaAmbar()).toBeNull()
  })

  it('Liberações da manhã: o aviso no lugar da fila, com a saída para a fila da tarde', () => {
    montar()
    aba('Liberações')
    // na tarde, a fila de sempre: os cards com o círculo de liberar e as ações do topo
    expect(screen.getAllByRole('button', { name: /^Marcar .* liberado$/ }).length).toBeGreaterThan(0)
    aba('Manhã')
    expect(screen.getByText('A fila da manhã encerrou às 13h')).toBeTruthy()
    // nada da fila: sem cards (ninguém é liberado), sem ajuda, sem recado
    expect(screen.queryAllByRole('button', { name: /^Marcar .* liberado$/ })).toHaveLength(0)
    expect(screen.queryByRole('button', { name: /Adicionar anestesista \(ajuda\)/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Histórico de mensagens/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Ver a fila da tarde' }))
    expect(turnoAtivo()).toBe('Tarde')
    expect(screen.queryByText('A fila da manhã encerrou às 13h')).toBeNull()
    expect(screen.getAllByRole('button', { name: /^Marcar .* liberado$/ }).length).toBeGreaterThan(0)
  })

  it('Completa da manhã: só conserto — sem "Adicionar caso"; a da tarde segue com ele', () => {
    montar()
    aba('Completa')
    expect(screen.getByRole('button', { name: /Adicionar caso/ })).toBeTruthy()
    aba('Manhã')
    expect(screen.getByText('Hérnia')).toBeTruthy() // o quadro da manhã está na tela
    expect(screen.queryByRole('button', { name: /Adicionar caso/ })).toBeNull()
  })

  it('ENTRAR na escala volta a hoje (quem saiu vendo "Amanhã" voltava em "Amanhã")', () => {
    montar({ data: '2026-10-29' })
    expect(estado.ctx.setData).toHaveBeenCalledWith(HOJE)
  })

  it('voltar depois de 2 min fora sai do turno encerrado (abrir de novo = turno em curso)', async () => {
    montar()
    aba('Manhã')
    expect(turnoNoTitulo()).toBe('Manhã')
    visivel = 'hidden'
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    await act(async () => { vi.advanceTimersByTime(3 * 60_000) })
    visivel = 'visible'
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(turnoNoTitulo()).toBe('Tarde')
    expect(faixaAmbar()).toBeNull()
  })

  it('troca rápida de app (menos de 2 min) não tira da manhã — a consulta continua', async () => {
    montar()
    aba('Manhã')
    visivel = 'hidden'
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    await act(async () => { vi.advanceTimersByTime(30_000) })
    visivel = 'visible'
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(turnoNoTitulo()).toBe('Manhã')
  })
})

describe('fim de semana à noite (28/10)', () => {
  it('"Manhã | Tarde | Noite" na Noite; a tarde tocada aparece encerrada às 19h', () => {
    vi.setSystemTime(new Date('2026-10-31T20:00:00-03:00')) // sábado
    estado.ctx = {
      escalas: {
        unimed: null, hro: null, materno: null,
        fds: {
          id: 'fds-1', hospital: 'fds', status: 'publicada', data: '2026-10-31',
          ordemLiberacao: { matutino: ['A'], vespertino: ['B'] }, ajudaExterna: {}, liberacoes: {}, linhaOverrides: {}, casos: [],
          fdsMeta: { grade: { '19-07': { unimed: 'JOAO', hro: 'GUILHERME', ret1: 'MATHEUS', ret2: 'CRISTINA' } }, posicoes: {} },
        },
      },
      p4Hospital: null, data: '2026-10-31', hoje: '2026-10-31', loading: false, ...acoes(),
    }
    render(<EscalaCirurgicaPage onNavigate={() => {}} goBack={() => {}} />, { wrapper: wrap })
    expect(trilhoDeTurno()).toEqual(['Manhã', 'Tarde', 'Noite'])
    expect(turnoAtivo()).toBe('Noite')
    aba('Tarde')
    expect(faixaAmbar()?.textContent).toMatch(/Tarde encerrada às 19h/)
    expect(screen.getByRole('button', { name: 'Voltar à noite' })).toBeTruthy()
  })
})

/**
 * EscalaCirurgicaHomeCard — SEM PISCAR (dono 13/08).
 *
 * O card mostrava o texto cru do rodapé ("DIDO") e trocava pelo nome completo
 * quando o cadastro (Tier 2, +2s) chegava. Regra travada aqui: enquanto o
 * roster não tem como resolver apelido→nome (nem cache, nem dados vivos), o
 * card fica no SKELETON — o apelido nunca é renderizado. Escape de 8s cobre
 * falha de rede do cadastro (apelido é melhor que skeleton eterno).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'

const estado = {
  ctx: null,
  roster: null,
}

const hojeLocalISO = (base) => {
  const d = base instanceof Date ? base : new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgica: () => estado.ctx,
  hojeISO: (d) => hojeLocalISO(d),
  HOSPITAIS: ['unimed', 'hro', 'materno'],
  HOSPITAL_LABEL: { unimed: 'UNIMED', hro: 'HRO', materno: 'MATERNO' },
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({
  default: { fetchEscala: vi.fn(async () => null) },
}))
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => estado.roster,
}))

import { EscalaCirurgicaHomeCard } from '@/components/escala-cirurgica/EscalaCirurgicaHomeCard'

// escala publicada com o apelido "DIDO" no rodapé (array legado = vale p/ os 2 turnos)
const escalasComDido = {
  unimed: { status: 'publicada', ordemLiberacao: ['DIDO'], casos: [] },
  hro: null,
  materno: null,
}

const rosterVazio = (pronto) => ({
  resolver: () => null,
  rosterByUid: new Map(),
  pronto,
})

const rosterComDido = () => ({
  resolver: (nome) => (String(nome).trim().toUpperCase() === 'DIDO' ? 'uid-gustavo' : null),
  rosterByUid: new Map([['uid-gustavo', { uid: 'uid-gustavo', nome: 'GUSTAVO BIESDORF' }]]),
  pronto: true,
})

describe('EscalaCirurgicaHomeCard — sem piscar apelido→nome', () => {
  beforeEach(() => {
    estado.ctx = { escalas: escalasComDido, data: hojeLocalISO(), loading: false }
    estado.roster = rosterVazio(false)
  })
  afterEach(() => vi.useRealTimers())

  it('roster SEM condição de resolver → skeleton, e o apelido NUNCA aparece', () => {
    render(<EscalaCirurgicaHomeCard />)
    expect(screen.queryByText('Dido')).toBeNull()
    expect(screen.queryByText(/DIDO/i)).toBeNull()
    // segue em carregamento (sem a lista e sem o estado "sem escala")
    expect(screen.queryByText('Sem escala publicada hoje')).toBeNull()
    expect(screen.queryByText('UNIMED')).toBeNull()
  })

  it('roster pronto (cache ou vivo) → nome COMPLETO direto', () => {
    estado.roster = rosterComDido()
    render(<EscalaCirurgicaHomeCard />)
    expect(screen.getByText('Gustavo Biesdorf')).toBeTruthy()
    expect(screen.queryByText('Dido')).toBeNull()
  })

  it('escape de 8s: cadastro nunca chegou → mostra o texto do rodapé', () => {
    vi.useFakeTimers()
    render(<EscalaCirurgicaHomeCard />)
    expect(screen.queryByText('Dido')).toBeNull()
    act(() => { vi.advanceTimersByTime(8100) })
    expect(screen.getByText('Dido')).toBeTruthy()
  })

  it('sem escala publicada → estado vazio, independente do roster', () => {
    estado.ctx = { escalas: { unimed: null, hro: null, materno: null }, data: hojeLocalISO(), loading: false }
    render(<EscalaCirurgicaHomeCard />)
    expect(screen.getByText('Sem escala publicada hoje')).toBeTruthy()
  })
})

describe('modo FDS — plantões físicos da faixa da grade (dono 15/08)', () => {
  afterEach(() => vi.useRealTimers())

  it('fila única publicada no sábado → Unimed/HRO da faixa 7-13, não o 1º do rodapé', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-15T10:00:00-03:00')) // sábado, faixa 7-13
    estado.roster = rosterComDido()
    estado.ctx = {
      data: '2026-08-15', loading: false,
      escalas: {
        unimed: null, hro: null, materno: null,
        fds: {
          status: 'publicada', hospital: 'fds',
          // rodapé da fila única: o 1º é quem SAI POR ÚLTIMO, não "o plantonista
          // da Unimed" — o card não pode derivar plantonista dele no FDS
          ordemLiberacao: { matutino: ['DIDO'] }, casos: [],
          fdsMeta: {
            grade: { '7-13': { unimed: 'GUILHERME DIDOMENICO', hro: 'JOAO HENRIQUE', ret1: 'CRISTINA', ret2: 'MATHEUS' } },
            posicoes: {},
          },
        },
      },
    }
    render(<EscalaCirurgicaHomeCard />)
    expect(screen.getByText('Plantão · 7–13h')).toBeTruthy()
    expect(screen.getByText('Guilherme Didomenico')).toBeTruthy()
    expect(screen.getByText('Joao Henrique')).toBeTruthy()
    expect(screen.queryByText('Gustavo Biesdorf')).toBeNull()
  })

  /**
   * FERIADO (dono 25/08: "os nomes dos plantonistas no card na página home está
   * errado"). Sem grade P1–P4, o card caía no plantonista POR HOSPITAL derivado
   * da ORDEM DOS CASOS — quem aparece primeiro na lista de cirurgias, que não
   * tem relação com quem está de plantão. Os plantonistas são os dois primeiros
   * da folha; o hospital de cada um vem das cirurgias do dia.
   */
  describe('feriado — os dois primeiros da folha, com o hospital dos casos', () => {
    const rosterFeriado = () => ({
      resolver: (n) => ({ FERNANDA: 'uid-fe', DANIELA: 'uid-da', MARILIO: 'uid-ma' })[String(n).trim().toUpperCase()] || null,
      rosterByUid: new Map([
        ['uid-fe', { uid: 'uid-fe', nome: 'FERNANDA GUOLLO' }],
        ['uid-da', { uid: 'uid-da', nome: 'DANIELA KLEIN REIS' }],
        ['uid-ma', { uid: 'uid-ma', nome: 'MARILIO FLACH' }],
      ]),
      pronto: true,
    })
    const ctxFeriado = (fdsMeta) => ({
      data: '2026-08-25', loading: false,
      escalas: {
        // MARILIO é o 1º caso da Unimed: era ele que o card mostrava antes
        unimed: { status: 'publicada', ordemLiberacao: [], casos: [
          { id: 'u1', anestesista: 'MARILIO', anestesistaUserId: 'uid-ma', turno: 'matutino' },
          { id: 'u2', anestesista: 'FERNANDA', anestesistaUserId: 'uid-fe', turno: 'matutino' },
        ] },
        hro: { status: 'publicada', ordemLiberacao: [], casos: [
          { id: 'h1', anestesista: 'DANIELA', anestesistaUserId: 'uid-da', turno: 'matutino' },
        ] },
        materno: null,
        fds: { status: 'publicada', ordemLiberacao: {}, casos: [], fdsMeta },
      },
    })

    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-25T10:00:00-03:00'))
      estado.roster = rosterFeriado()
    })

    it('mostra FERNANDA e DANIELA, não o primeiro nome da lista de casos', () => {
      estado.ctx = ctxFeriado({ tipo: 'feriado', grade: {}, posicoes: {}, listaFonte: ['FERNANDA', 'DANIELA', 'MARILIO'] })
      render(<EscalaCirurgicaHomeCard />)
      expect(screen.getByText('Fernanda Guollo')).toBeTruthy()
      expect(screen.getByText('Daniela Reis')).toBeTruthy()
      expect(screen.queryByText('Marilio Flach')).toBeNull()   // era o nome errado
    })

    it('o rótulo é "Feriado", não a faixa da grade — o plantão é 07h→07h', () => {
      estado.ctx = ctxFeriado({ tipo: 'feriado', grade: {}, posicoes: {}, listaFonte: ['FERNANDA', 'DANIELA'] })
      render(<EscalaCirurgicaHomeCard />)
      expect(screen.getByText('Plantão · Feriado')).toBeTruthy()
      expect(screen.queryByText(/Plantão · 7–13h/)).toBeNull()
    })

    it('sem a folha no meta, cai no comportamento por hospital em vez de chutar', () => {
      estado.ctx = ctxFeriado({ tipo: 'feriado', grade: {}, posicoes: {} })
      render(<EscalaCirurgicaHomeCard />)
      expect(screen.queryByText(/Plantão · /)).toBeNull()
      expect(screen.getByText(/Plantonista · /)).toBeTruthy()
    })
  })

  it('sábado SEM fila única publicada → comportamento por hospital preservado', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-15T10:00:00-03:00'))
    estado.roster = rosterComDido()
    estado.ctx = {
      data: '2026-08-15', loading: false,
      escalas: { ...escalasComDido, fds: null },
    }
    render(<EscalaCirurgicaHomeCard />)
    expect(screen.getByText('Gustavo Biesdorf')).toBeTruthy()
    expect(screen.queryByText(/Plantão · /)).toBeNull()
  })
})

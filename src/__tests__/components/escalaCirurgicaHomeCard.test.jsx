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

import { EscalaCirurgicaHomeCard, HOME_CARD_SNAPSHOT_KEY } from '@/components/escala-cirurgica/EscalaCirurgicaHomeCard'
import { turnoAtual } from '@/pages/escala-cirurgica/utils'

// o snapshot do card (16/09) persiste em localStorage entre testes do mesmo
// arquivo: cada caso parte sem snapshot, salvo quando o próprio caso o grava
beforeEach(() => { localStorage.clear() })
afterEach(() => { localStorage.clear() })

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
    // RELÓGIO CONGELADO: o setup calcula "hoje" uma vez e o componente calcula
    // de novo no render. Na virada da meia-noite os dois caem em DIAS
    // diferentes, o card entra no ramo de "a data do context não é hoje" e o
    // nome nunca aparece. Foi assim que este arquivo derrubou o CI em 28/08 às
    // 03:00 UTC (= 00:00 em America/Sao_Paulo, o fuso da suíte): passa o dia
    // inteiro e falha numa janela de segundos.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-20T10:00:00-03:00'))
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
    expect(screen.getByText('João Henrique')).toBeTruthy()
    expect(screen.queryByText('Gustavo Biesdorf')).toBeNull()
  })

  /**
   * FERIADO (dono 25/08: "os nomes dos plantonistas no card na página home está
   * errado"). Sem grade P1–P4, o card caía no plantonista POR HOSPITAL derivado
   * da ORDEM DOS CASOS — quem aparece primeiro na lista de cirurgias, que não
   * tem relação com quem está de plantão. Plantão são os dois que FECHAM a fila
   * do turno (posições 1 e 2 da ordem publicada); o hospital de cada um vem das
   * cirurgias do dia.
   *
   * ⚠️ A fonte é a ORDEM DO TURNO, não a folha — mesma correção do selo na fila
   * (dono 25/08, à tarde). A folha não vira; a ordem sim, e às 13h ela inverte.
   * Preso à folha, o card nomearia na Home quem a fila já mostra indo embora.
   */
  describe('feriado — os dois que fecham a fila do turno, com o hospital dos casos', () => {
    const rosterFeriado = () => ({
      resolver: (n) => ({ FERNANDA: 'uid-fe', DANIELA: 'uid-da', MARILIO: 'uid-ma' })[String(n).trim().toUpperCase()] || null,
      rosterByUid: new Map([
        ['uid-fe', { uid: 'uid-fe', nome: 'FERNANDA GUOLLO' }],
        ['uid-da', { uid: 'uid-da', nome: 'DANIELA KLEIN REIS' }],
        ['uid-ma', { uid: 'uid-ma', nome: 'MARILIO FLACH' }],
      ]),
      pronto: true,
    })
    // a tarde é a folha DE TRÁS PARA FRENTE (é o que a publicação grava)
    const ORDEM_FOLHA = ['FERNANDA', 'DANIELA', 'MARILIO']
    const ORDEM = { matutino: ORDEM_FOLHA, vespertino: [...ORDEM_FOLHA].reverse() }
    const ctxFeriado = (fdsMeta, ordemLiberacao = ORDEM) => ({
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
        fds: { status: 'publicada', ordemLiberacao, casos: [], fdsMeta },
      },
    })

    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-08-25T10:00:00-03:00'))
      estado.roster = rosterFeriado()
    })

    it('de manhã mostra FERNANDA e DANIELA, não o primeiro nome da lista de casos', () => {
      estado.ctx = ctxFeriado({ tipo: 'feriado', grade: {}, posicoes: {} })
      render(<EscalaCirurgicaHomeCard />)
      expect(screen.getByText('Fernanda Guollo')).toBeTruthy()
      expect(screen.getByText('Daniela Reis')).toBeTruthy()
      expect(screen.queryByText('Marílio Flach')).toBeNull()   // era o nome errado
    })

    it('às 13h o card VIRA junto com a fila — Home e escala não divergem', () => {
      // a mesma correção do selo: à tarde a ordem inverte, MARILIO passa a fechar
      // a fila e a FERNANDA, que fechava de manhã, é das primeiras a ir embora
      vi.setSystemTime(new Date('2026-08-25T14:00:00-03:00'))
      estado.ctx = ctxFeriado({ tipo: 'feriado', grade: {}, posicoes: {} })
      render(<EscalaCirurgicaHomeCard />)
      expect(screen.getByText('Marílio Flach')).toBeTruthy()
      expect(screen.getByText('Daniela Reis')).toBeTruthy()
      expect(screen.queryByText('Fernanda Guollo')).toBeNull()
    })

    it('o rótulo é "Feriado" — o feriado não tem as faixas da grade do FDS', () => {
      estado.ctx = ctxFeriado({ tipo: 'feriado', grade: {}, posicoes: {} })
      render(<EscalaCirurgicaHomeCard />)
      expect(screen.getByText('Plantão · Feriado')).toBeTruthy()
      expect(screen.queryByText(/Plantão · 7–13h/)).toBeNull()
    })

    it('sem ordem publicada, cai no comportamento por hospital em vez de chutar', () => {
      estado.ctx = ctxFeriado({ tipo: 'feriado', grade: {}, posicoes: {} }, {})
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

// ════════════════════════════════════════════════════════════════════════════
// SNAPSHOT DO CARD (dono 16/09/2026): "demora a mostrar os nomes; quando a
// escala é publicada os plantões serão os mesmos — que fique sempre visível e
// na memória". O card guarda em localStorage só o que exibe (hospital + nome
// resolvido + rótulo), por dia+turno, e mostra isso enquanto o dado vivo não
// chega; o vivo sempre vence e regrava. Nunca caso, nunca paciente.
// ════════════════════════════════════════════════════════════════════════════
describe('snapshot do card — nomes na hora, sem esperar o fetch', () => {
  const chaveHoje = () => `${hojeLocalISO()}:${turnoAtual()}`
  const gravar = (chave, linhas) => localStorage.setItem(HOME_CARD_SNAPSHOT_KEY, JSON.stringify({ chave, rotulo: 'Plantonista · Teste', linhas }))

  beforeEach(() => {
    // ⚠️ DIA ÚTIL FIXO: o snapshot é do card de dia útil; no sáb/dom o card lê a linha
    // 'fds' e a chave é outra. Sem relógio fixo este describe passava de segunda a sexta
    // e quebrou o CI no sábado 19/09 (3 testes, sem mudança de código).
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-20T10:00:00-03:00')) // quinta, manhã
    localStorage.clear()
    estado.roster = rosterVazio(false)
  })
  afterEach(() => { localStorage.clear(); vi.useRealTimers() })

  it('context ainda carregando + snapshot deste turno → nomes na hora, sem skeleton', () => {
    gravar(chaveHoje(), [{ hospital: 'UNIMED', nome: 'Gustavo Biesdorf' }])
    estado.ctx = { escalas: { unimed: null, hro: null, materno: null }, data: hojeLocalISO(), loading: true }
    const { container } = render(<EscalaCirurgicaHomeCard />)
    expect(screen.getByText('Gustavo Biesdorf')).toBeInTheDocument()
    expect(screen.getByText('Plantonista · Teste')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-slot="skeleton"], .animate-pulse').length).toBe(0)
  })

  it('snapshot de OUTRO turno/dia é ignorado → skeleton normal', () => {
    gravar(`${hojeLocalISO()}:outro-turno`, [{ hospital: 'UNIMED', nome: 'Gustavo Biesdorf' }])
    estado.ctx = { escalas: { unimed: null, hro: null, materno: null }, data: hojeLocalISO(), loading: true }
    render(<EscalaCirurgicaHomeCard />)
    expect(screen.queryByText('Gustavo Biesdorf')).not.toBeInTheDocument()
  })

  it('dado vivo chega → vence o snapshot e regrava a chave deste turno', () => {
    gravar(chaveHoje(), [{ hospital: 'UNIMED', nome: 'Nome Antigo' }])
    estado.roster = rosterComDido()
    estado.ctx = { escalas: escalasComDido, data: hojeLocalISO(), loading: false }
    render(<EscalaCirurgicaHomeCard />)
    expect(screen.getByText('Gustavo Biesdorf')).toBeInTheDocument()
    expect(screen.queryByText('Nome Antigo')).not.toBeInTheDocument()
    const gravado = JSON.parse(localStorage.getItem(HOME_CARD_SNAPSHOT_KEY))
    expect(gravado.chave).toBe(chaveHoje())
    expect(gravado.linhas).toEqual([{ hospital: 'UNIMED', nome: 'Gustavo Biesdorf' }])
    expect(JSON.stringify(gravado)).not.toMatch(/paciente|casos/)
  })

  it('fetch vazio/falho no meio do turno com snapshot → mantém os nomes (escala publicada não some)', () => {
    gravar(chaveHoje(), [{ hospital: 'HRO', nome: 'Raul Perizzolo' }])
    estado.roster = rosterComDido()
    estado.ctx = { escalas: { unimed: null, hro: null, materno: null }, data: hojeLocalISO(), loading: false }
    render(<EscalaCirurgicaHomeCard />)
    expect(screen.getByText('Raul Perizzolo')).toBeInTheDocument()
    expect(screen.queryByText('Sem escala publicada hoje')).not.toBeInTheDocument()
  })

  it('sem snapshot e sem escala → estado vazio como antes', () => {
    estado.roster = rosterComDido()
    estado.ctx = { escalas: { unimed: null, hro: null, materno: null }, data: hojeLocalISO(), loading: false }
    render(<EscalaCirurgicaHomeCard />)
    expect(screen.getByText('Sem escala publicada hoje')).toBeInTheDocument()
  })
})

describe('plantonista da Home = o da fila de liberação (revisão 23/09)', () => {
  const rosterDois = () => ({
    resolver: (nome) => ({ DIDO: 'uid-gustavo', PAULO: 'uid-paulo', 'PAULO TONINI': 'uid-paulo' })[String(nome).trim().toUpperCase()] || null,
    rosterByUid: new Map([
      ['uid-gustavo', { uid: 'uid-gustavo', nome: 'GUSTAVO BIESDORF' }],
      ['uid-paulo', { uid: 'uid-paulo', nome: 'PAULO TONINI' }],
    ]),
    pronto: true,
  })
  const caso = (anest, hora = '08:00', turno = 'matutino') => ({ sala: 'Sala 1', hora, anestesista: anest, turno, statusCirurgia: 'agendada' })
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-20T10:00:00-03:00'))
    estado.roster = rosterDois()
  })
  afterEach(() => vi.useRealTimers())

  it('troca executada: quem ASSUMIU a posição do plantonista aparece, não o dono antigo', () => {
    estado.ctx = {
      data: hojeLocalISO(), loading: false,
      escalas: {
        unimed: {
          status: 'publicada', hospital: 'unimed',
          ordemLiberacao: { matutino: ['DIDO', 'PAULO'] },
          linhaOverrides: { 'matutino:uid-gustavo': { assumidaPor: { uid: 'uid-paulo', nome: 'PAULO TONINI' } } },
          casos: [caso('PAULO TONINI')],
        },
        hro: null, materno: null,
      },
    }
    render(<EscalaCirurgicaHomeCard />)
    expect(screen.getByText('Paulo Tonini')).toBeTruthy()
    expect(screen.queryByText('Gustavo Biesdorf')).toBeNull()
  })

  it('às 13h o card troca para o plantonista da TARDE sem esperar a escala mudar', () => {
    vi.setSystemTime(new Date('2026-08-20T12:58:00-03:00'))
    estado.ctx = {
      data: hojeLocalISO(), loading: false,
      escalas: {
        unimed: {
          status: 'publicada', hospital: 'unimed',
          ordemLiberacao: { matutino: ['DIDO'], vespertino: ['PAULO'] },
          casos: [caso('DIDO'), caso('PAULO', '14:00', 'vespertino')],
        },
        hro: null, materno: null,
      },
    }
    render(<EscalaCirurgicaHomeCard />)
    expect(screen.getByText('Gustavo Biesdorf')).toBeTruthy()
    act(() => { vi.advanceTimersByTime(3 * 60_000) })
    expect(screen.getByText('Paulo Tonini')).toBeTruthy()
    expect(screen.queryByText('Gustavo Biesdorf')).toBeNull()
  })
})

/**
 * DAS 19h ÀS 7h o card mostra o PLANTONISTA DA NOITE (dono 11/2026, opção A do modelo).
 *
 * Às 22h04 de 09/11 o card ainda dizia "Plantonista · Vespertino" com os nomes da tarde,
 * e o card Plantões, logo abaixo, já listava P1–P4. O dono decidiu: à noite, um
 * plantonista por hospital — HRO P1 · Unimed P2 · Materno P4 —, com o selo, na mesma
 * altura do card. A regra é a da fila de Liberações à noite (`faseLiberacoes` +
 * `ORDEM_NOTURNA`), e a grade de DEMONSTRAÇÃO do Pega Plantão não vira plantonista.
 */
describe('noite (19h–7h) — plantonista da noite por hospital', () => {
  const roster = () => ({
    resolver: (nome) => ({ DIDO: 'uid-gustavo', 'DIEGO ESTEVES': 'uid-diego' })[String(nome).trim().toUpperCase()] || null,
    rosterByUid: new Map([
      ['uid-gustavo', { uid: 'uid-gustavo', nome: 'GUSTAVO BIESDORF' }],
      ['uid-diego', { uid: 'uid-diego', nome: 'DIEGO ESTEVES' }],
      ['uid-livia', { uid: 'uid-livia', nome: 'LIVIA MORAES' }],
    ]),
    roster: [{ uid: 'uid-livia', nome: 'LIVIA MORAES' }],
    pronto: true,
  })
  const plantoes = [
    { setor: 'P1', nome: 'Diego Esteves' }, { setor: 'P2', nome: 'L. Moraes' },
    { setor: 'P3', nome: 'Nina Oliveira' }, { setor: 'P4', nome: 'Otávio Prates' },
  ]
  const montar = (iso, extra = {}, props = {}) => {
    vi.setSystemTime(new Date(iso))
    const d = new Date(iso)
    if (d.getHours() < 7) d.setDate(d.getDate() - 1) // context no dia OPERACIONAL
    estado.ctx = { escalas: escalasComDido, data: hojeLocalISO(d), loading: false, ...extra }
    estado.roster = roster()
    return render(<EscalaCirurgicaHomeCard plantoes={plantoes} {...props} />)
  }
  const linhas = () => [...document.querySelectorAll('li')].map((li) => li.textContent)
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

  it('22h de quinta: HRO P1 · Unimed P2 · Materno P4, sob "Plantão da noite"', () => {
    montar('2026-08-20T22:00:00-03:00')
    expect(screen.getByText('Plantão da noite')).toBeTruthy()
    // "L. Moraes" casa pelo cadastro (inicial + sobrenome), como na fila
    expect(linhas()).toEqual(['HROP1Diego Esteves', 'UNIMEDP2Livia Moraes', 'MATERNOP4Otávio Prates'])
    // o plantonista da TARDE (rodapé da escala) saiu do card
    expect(screen.queryByText('Gustavo Biesdorf')).toBeNull()
  })

  it('01h da madrugada continua na noite que começou na véspera', () => {
    montar('2026-08-21T01:00:00-03:00')
    expect(screen.getByText('Plantão da noite')).toBeTruthy()
    expect(linhas()[0]).toBe('HROP1Diego Esteves')
  })

  it('P4 marcado em outro hospital: o Materno fica sem linha (ninguém assume o posto)', () => {
    montar('2026-08-20T22:00:00-03:00', { p4Hospital: 'hro' })
    expect(linhas()).toEqual(['HROP1Diego Esteves', 'UNIMEDP2Livia Moraes'])
  })

  it('18h59 ainda é a tarde: plantonista da escala, sem selo', () => {
    montar('2026-08-20T18:59:00-03:00')
    expect(screen.getByText('Plantonista · Tarde')).toBeTruthy()
    expect(linhas()).toEqual(['UNIMEDGustavo Biesdorf'])
  })

  it('sábado à noite sem fila única: a regra da noite não se aplica', () => {
    montar('2026-08-22T22:00:00-03:00')
    expect(screen.queryByText('Plantão da noite')).toBeNull()
  })

  it('grade de DEMONSTRAÇÃO em produção: o card segue como de dia, sem nome fictício', () => {
    vi.stubEnv('DEV', false)
    montar('2026-08-20T22:00:00-03:00', {}, { plantoesDeDemonstracao: true })
    expect(screen.queryByText('Plantão da noite')).toBeNull()
    expect(screen.queryByText('Diego Esteves')).toBeNull()
    expect(screen.getByText('Gustavo Biesdorf')).toBeTruthy()
  })

  it('sem plantões carregados à noite: mostra o que tinha (a escala), não um card vazio', () => {
    montar('2026-08-20T22:00:00-03:00', {}, { plantoes: [] })
    expect(screen.queryByText('Plantão da noite')).toBeNull()
    expect(screen.getByText('Gustavo Biesdorf')).toBeTruthy()
  })
})

describe('rótulo do turno — Manhã/Tarde, como no seletor da escala (dono 11/2026)', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => vi.useRealTimers())
  it('o card não diz mais Matutino/Vespertino', () => {
    vi.setSystemTime(new Date('2026-08-20T10:00:00-03:00'))
    estado.ctx = { escalas: escalasComDido, data: hojeLocalISO(), loading: false }
    estado.roster = rosterComDido()
    render(<EscalaCirurgicaHomeCard />)
    expect(screen.getByText('Plantonista · Manhã')).toBeTruthy()
    expect(screen.queryByText(/Matutino|Vespertino/)).toBeNull()
  })
})

/**
 * SINCRONIA ENTRE A FAIXA DE URGÊNCIAS E O QUADRO (dono 21/08).
 *
 * Relato: *"ao finalizar uma cirurgia de urgência ela não está sincronizada com as
 * informações no topo — Raul ao finalizar cirurgia no card da escala Completa não
 * finalizou no mostrador de urgências, e vice-versa"*.
 *
 * A causa não era escrita: os dois caminhos gravam pela mesma action, no mesmo
 * `escala.casos`. Era ESCOPO. A faixa lê o DIA INTEIRO — regra do contrato,
 * "ocupação é do relógio": urgência da manhã ainda aberta ocupa o plantonista da
 * tarde — e o quadro lê só o turno. Medido em produção em 21/08 às 15h: das 5
 * urgências abertas do HRO, QUATRO eram do turno da manhã. Na aba Tarde o quadro
 * mostrava UMA. As outras quatro não tinham card para tocar — era impossível
 * marcá-las Terminada por ali, e terminar qualquer outra coisa não mexia na faixa.
 *
 * Este arquivo monta as DUAS superfícies sobre o MESMO provider — é o único jeito
 * de afirmar que elas concordam — e trava o invariante que impede a volta: tudo
 * que a faixa conta está alcançável no quadro, e nada aparece duas vezes.
 *
 * ⚠️ O tema "isolar por turno" já regrediu três vezes neste módulo (é o motivo do
 * gate de CI existir). O que protege aqui é o INVARIANTE do último describe, não
 * a persona — persona morre junto com o comportamento quando alguém reverte.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import BoardView from '@/pages/escala-cirurgica/BoardView'
import FaixaUrgencias from '@/pages/escala-cirurgica/FaixaUrgencias'
import { casosHerdados, estadoUrgenciasDaEscala } from '@/lib/escalaCirurgicaUrgencias'
import { filtrarPorTurno } from '@/pages/escala-cirurgica/utils'

const HOJE = '2026-08-21'

const { setStatusCirurgia, definirSalasUrgencia } = vi.hoisted(() => ({
  setStatusCirurgia: vi.fn(async () => {}),
  definirSalasUrgencia: vi.fn(async () => {}),
}))
vi.mock('@/contexts/EscalaCirurgicaContext', () => ({
  useEscalaCirurgicaActions: () => ({
    setStatusCirurgia,
    definirSalasUrgencia,
    atualizarCaso: vi.fn(async () => {}),
    setAnestesistaCasos: vi.fn(async () => {}),
    adicionarAjuda: vi.fn(async () => {}),
    removerAjuda: vi.fn(async () => {}),
  }),
  useEscalaCirurgica: () => ({ hoje: HOJE, escalas: {}, data: HOJE, loading: false }),
  HOSPITAL_LABEL: { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' },
}))
vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: { uid: 'u-eu', role: 'anestesiologista', displayName: 'Eu' } }),
}))
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    roster: [], rosterByUid: new Map(), aliases: [], options: [],
    resolver: () => null, loading: false, refresh: vi.fn(), upsertAlias: vi.fn(), removeAlias: vi.fn(),
  }),
}))
vi.mock('@/hooks/useRosterResidentes', () => ({
  default: () => ({ options: [], residenteByUid: new Map(), loading: false }),
}))
// Relógio congelado às 15h — o instante do relato (tarde em curso).
vi.mock('@/pages/escala-cirurgica/useAgoraMinuto', () => ({
  default: () => 15 * 60,
  minutosDoDia: () => 15 * 60,
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

/** Recorte real do HRO em 21/08: urgências da MANHÃ ainda abertas à tarde. */
const caso = (id, extra = {}) => ({
  id, sala: 'Sala 9', ordem: 0, turno: 'matutino', tipo: 'urgencia', gravidade: 'urgente',
  statusCirurgia: 'agendada', statusExtra: null, hora: null, procedimento: 'DESBRIDAMENTO MSE',
  convenio: 'SUS', anestesista: 'RAUL', anestesistaUserId: 'u-raul',
  created_at: `${HOJE}T10:00:00`, ...extra,
})

const escalaBase = {
  id: 'e1', hospital: 'hro', data: HOJE, status: 'publicada',
  liberacoes: {}, linhaOverrides: {}, ordemLiberacao: { matutino: [], vespertino: [] },
  casos: [
    caso('m1', { statusCirurgia: 'iniciada', statusAtualizadoEm: `${HOJE}T13:30:00` }),
    caso('m2', { ordem: 1, procedimento: 'RTU' }),
    // a única do turno da tarde — é o que o quadro mostrava sozinho
    caso('v1', { sala: 'Sala 5', turno: 'vespertino', hora: '13:30', procedimento: 'HÉRNIA ENCARCERADA' }),
  ],
}

const montarQuadro = (escala = escalaBase) =>
  render(<BoardView escala={escala} meuAlias="" meuUid="u-eu" turno="vespertino" />, { wrapper: wrap })

const montarFaixa = (escala = escalaBase) =>
  render(<FaixaUrgencias escala={escala} hospital="hro" turno="vespertino" />, { wrapper: wrap })

afterEach(cleanup)
beforeEach(() => setStatusCirurgia.mockClear())

// ════════════════════════════════════════════════════════════════════════════
describe('o quadro da tarde alcança a urgência que atravessou o turno', () => {
  it('exibe as abertas da manhã num grupo próprio, no fim', async () => {
    const { container } = montarQuadro()
    expect(await screen.findByText('Ainda abertas')).toBeTruthy()
    expect(screen.getByText('Manhã')).toBeTruthy()
    // as duas da manhã têm card AQUI (antes: "Nenhum caso neste turno")
    expect(screen.getByText(/Desbridamento mse/i)).toBeTruthy()
    expect(screen.getByText(/Rtu/i)).toBeTruthy()
    // e o grupo é o ÚLTIMO do quadro — o turno continua sendo o assunto
    const cabecalhos = [...container.querySelectorAll('button[aria-expanded]')]
    expect(cabecalhos.at(-1).textContent).toContain('Ainda abertas')
  })

  it('tocar numa delas abre o detalhe — é o que faltava para marcar Terminada', async () => {
    montarQuadro()
    fireEvent.click(screen.getByText(/Desbridamento mse/i).closest('button'))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy())
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Terminada' })).toBeTruthy()
  })

  // O turno sem caso nenhum é EXATAMENTE quando a urgência herdada precisa ser
  // vista — o EmptyState escondia justamente isso.
  it('turno vazio não engole as herdadas', async () => {
    const soManha = { ...escalaBase, casos: escalaBase.casos.filter((c) => c.turno === 'matutino') }
    montarQuadro(soManha)
    expect(await screen.findByText('Ainda abertas')).toBeTruthy()
    expect(screen.queryByText('Nenhum caso neste turno')).toBeNull()
  })

  it('sem nada herdado o quadro fica exatamente como era', () => {
    const soTarde = { ...escalaBase, casos: escalaBase.casos.filter((c) => c.turno === 'vespertino') }
    montarQuadro(soTarde)
    expect(screen.queryByText('Ainda abertas')).toBeNull()
  })

  it('fora do HRO nada muda — o contrato é do HRO', () => {
    montarQuadro({ ...escalaBase, hospital: 'unimed' })
    expect(screen.queryByText('Ainda abertas')).toBeNull()
  })
})

// ════════════════════════════════════════════════════════════════════════════
describe('as duas superfícies contam a MESMA cirurgia', () => {
  it('a faixa conta as abertas da manhã e o quadro as exibe', async () => {
    montarFaixa()
    // 2 vagas do contrato ocupadas pelas urgências abertas do dia
    expect(await screen.findByText(/de 2 salas/)).toBeTruthy()
    cleanup()
    montarQuadro()
    expect(await screen.findByText('Ainda abertas')).toBeTruthy()
  })

  it('terminar pelo QUADRO tira a cirurgia da conta da faixa', () => {
    const derivar = (esc) => estadoUrgenciasDaEscala(esc, {
      hospital: 'hro', turno: 'vespertino', agoraMin: 15 * 60, hojeIso: HOJE,
    })
    const contadas = (est) => est.ocupacoes.flatMap((o) => o.casos.map((i) => i.caso.id))

    const antes = derivar(escalaBase)
    expect(contadas(antes)).toContain('m1')

    // o mesmo `escala.casos` que o toque patcha — a faixa deriva daqui
    const depois = derivar({
      ...escalaBase,
      casos: escalaBase.casos.map((c) => (c.id === 'm1' ? { ...c, statusCirurgia: 'terminada' } : c)),
    })
    expect(contadas(depois)).not.toContain('m1')
    // a Sala 9 continua ocupada pela OUTRA cirurgia do Raul — uma pessoa, uma vaga
    expect(contadas(depois)).toContain('m2')
    // e o quadro deixa de listá-la no mesmo ato
    expect(casosHerdados(depois, 'vespertino').map((c) => c.id)).not.toContain('m1')
  })

  it('terminar pela FAIXA some do quadro', () => {
    montarQuadro()
    expect(screen.getByText(/Desbridamento mse/i)).toBeTruthy()
    cleanup()
    const depois = {
      ...escalaBase,
      casos: escalaBase.casos.map((c) => (c.id === 'm1' ? { ...c, statusCirurgia: 'terminada' } : c)),
    }
    montarQuadro(depois)
    expect(screen.queryByText(/Desbridamento mse/i)).toBeNull()
  })
})

// ════════════════════════════════════════════════════════════════════════════
// INVARIANTE — é isto que impede a regressão, não os testes acima.
// ════════════════════════════════════════════════════════════════════════════
describe('INVARIANTE: nada que a faixa conta fica inalcançável no quadro', () => {
  const cenarios = [
    ['tarde com abertas da manhã', escalaBase, 'vespertino'],
    ['manhã com abertas da tarde', escalaBase, 'matutino'],
    ['sala dedicada (CO de manhã)', {
      ...escalaBase,
      casos: [caso('co1', { sala: 'Sala 7', procedimento: 'CESARIANA' }), caso('co2', { sala: 'Sala 7', ordem: 1, procedimento: 'CURETAGEM' })],
    }, 'vespertino'],
    ['fila com mais gente que vaga', {
      ...escalaBase,
      casos: [
        caso('a', { sala: 'Sala 1', anestesistaUserId: 'u-a' }),
        caso('b', { sala: 'Sala 2', anestesistaUserId: 'u-b' }),
        caso('c', { sala: 'Sala 3', anestesistaUserId: 'u-c' }),
      ],
    }, 'vespertino'],
  ]

  it.each(cenarios)('%s — tudo contado está visível, e nada duas vezes', (_nome, escala, turno) => {
    const estado = estadoUrgenciasDaEscala(escala, {
      hospital: 'hro', turno, agoraMin: 15 * 60, hojeIso: HOJE,
    })
    const noTurno = filtrarPorTurno(escala.casos, turno).map((c) => c.id)
    const herdados = casosHerdados(estado, turno).map((c) => c.id)

    // 1. nenhuma cirurgia aparece nas duas listas
    expect(herdados.filter((id) => noTurno.includes(id))).toEqual([])

    // 2. tudo que a faixa CONTA está numa das duas
    const contados = [
      ...estado.ocupacoes.flatMap((o) => o.casos.map((i) => i.caso.id)),
      ...estado.dedicados.flatMap((d) => (d.item?.casos || []).map((i) => i.caso.id)),
      ...estado.fila.map((f) => f.caso.id),
      ...estado.aConfirmar.map((f) => f.caso.id),
    ]
    const alcancaveis = new Set([...noTurno, ...herdados])
    expect(contados.filter((id) => !alcancaveis.has(id))).toEqual([])
  })

  it('cirurgia CONCLUÍDA não vira herdada — não há o que fazer com ela', () => {
    const fim = {
      ...escalaBase,
      casos: escalaBase.casos.map((c) => (c.turno === 'matutino' ? { ...c, statusCirurgia: 'terminada' } : c)),
    }
    const estado = estadoUrgenciasDaEscala(fim, {
      hospital: 'hro', turno: 'vespertino', agoraMin: 15 * 60, hojeIso: HOJE,
    })
    expect(casosHerdados(estado, 'vespertino')).toEqual([])
  })
})

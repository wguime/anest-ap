/**
 * DE ONDE A AJUDA SAIU manda na ordem da cauda (dono 27/08).
 *
 * "sempre os primeiros a irem embora são os plantões do contraturno, após os
 * anestesistas que estariam escalados no materno e após os anestesistas de outro
 * hospital, sempre respeitando a ordem de liberação do hospital de origem."
 *
 * A regra existe na lib desde 31/07, mas a PÁGINA parou de alimentá-la em 04/08
 * (`ebfa726` trocou `presencaOutros` por `[]` para matar um falso badge de
 * "Ajuda" que vinha da metade derivada dos CASOS). Desde então a cauda da fila
 * ordenava por ordem de ENCONTRO dos casos. Caso real que originou a trava —
 * Unimed, tarde de 27/08: GUSTAVO e ALEXANDRE S ajudando vindos do HRO, onde o
 * rodapé da tarde tem ALEXANDRE S em 6º e GUSTAVO em 10º; a Unimed liberava o
 * Alexandre primeiro, quando quem sai antes é o Gustavo.
 *
 * ⚠️ Esta trava é de PÁGINA de propósito. A ordenação em si já tem teste de lib
 * (`colunaLiberacao.test.js`) e ele passava o tempo todo com o defeito em pé —
 * o que quebrou foi o fio entre as duas, e é o fio que precisa de teste.
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
  hojeISO: () => '2026-08-27',
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
  id, sala, ordem: 0, hora, anestesista, cirurgiao: 'Cirurgião',
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

// Unimed da tarde: Gabriela (plantonista) · Marilio · Oscar (fecha o rodapé =
// plantão do contraturno). Gustavo, Alexandre S e Rômulo têm caso aqui e não
// estão neste rodapé — entram na cauda.
const UNIMED = {
  id: 'u1', hospital: 'unimed', data: '2026-08-27',
  ordemLiberacao: { vespertino: ['GABRIELA', 'MARILIO', 'OSCAR'] },
  ajudaExterna: { vespertino: [] },
  liberacoes: {}, linhaOverrides: {},
  casos: [
    caso('c1', 'CC - Sala 2', 'MARILIO'),
    caso('c2', 'CC - Sala 3', 'GABRIELA'),
    caso('c3', 'CO - Cesárea', 'GUSTAVO'),
    caso('c4', 'Exames', 'ROMULO'),
    caso('c5', 'Imagem', 'ALEXANDRE S', '13:00'),
    caso('c6', 'CC - Sala 5', 'OSCAR'),
  ],
}
// HRO da tarde: Alexandre S em 6º, Gustavo em 10º (recorte do rodapé real).
const HRO = {
  id: 'h1', hospital: 'hro', data: '2026-08-27',
  ordemLiberacao: {
    vespertino: ['THAYNA', 'LOUISE', 'ALEXANDRE D', 'DANIELA', 'RAFAEL', 'ALEXANDRE S',
      'NATHALIA', 'EDUARDO', 'JANAINA', 'GUSTAVO', 'MAURICIO', 'ROSE'],
  },
  ajudaExterna: { vespertino: ['ALEXANDRE S', 'GUSTAVO'] },
  liberacoes: {}, linhaOverrides: {}, casos: [],
}

const montar = (escalas) => {
  estado.ctx = {
    escalas: { unimed: null, hro: null, materno: null, fds: null, ...escalas },
    p4Hospital: null, data: '2026-08-27', hoje: '2026-08-27', loading: false, ...acoes(),
  }
  const r = render(<EscalaCirurgicaPage onNavigate={() => {}} goBack={() => {}} />, { wrapper: wrap })
  fireEvent.click(screen.getByRole('tab', { name: 'Liberações' }))
  return r
}

/** Nomes da fila, de cima para baixo. O ÚLTIMO é o PRIMEIRO a ir embora. */
const fila = () => screen.queryAllByLabelText(/^Editar local\/cirurgião de /)
  .map((b) => b.getAttribute('aria-label').replace('Editar local/cirurgião de ', ''))

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-08-27T14:00:00-03:00')) // quinta, turno vespertino
})
afterEach(() => vi.useRealTimers())

describe('ajuda libera na ordem do hospital de ORIGEM (dono 27/08)', () => {
  it('com a escala do HRO carregada, Gustavo (10º lá) sai antes de Alexandre (6º lá)', () => {
    montar({ unimed: UNIMED, hro: HRO })
    const nomes = fila()
    // ⚠️ MUDOU DE LADO em 30/08: Oscar fecha o rodapé daqui (plantão do
    // contraturno) e ERA o último da tela. O dono corrigiu no caso
    // Oscar⇄Guilherme Xavier — a AJUDA sai antes do plantão do contraturno,
    // porque ela é de outro hospital e tem plantão e fila próprios para voltar.
    // Ele continua na fila, só não mais atrás das ajudas.
    expect(nomes.indexOf('Oscar')).toBeLessThan(nomes.indexOf('Alexandre S'))
    // o que este teste mede não mudou: entre as AJUDAS, a ordem é a do hospital
    // de ORIGEM — índice MAIOR no rodapé de lá = sai antes lá = mais embaixo aqui
    expect(nomes.indexOf('Gustavo')).toBeGreaterThan(nomes.indexOf('Alexandre S'))
  })

  it('o card diz de ONDE a ajuda veio', () => {
    montar({ unimed: UNIMED, hro: HRO })
    expect(screen.getAllByText('Ajuda (HRO)').length).toBeGreaterThanOrEqual(2)
  })

  it('o painel “Veio de” existe na ajuda e grava o hospital escolhido', () => {
    montar({ unimed: UNIMED, hro: HRO })
    fireEvent.click(screen.getByLabelText('Editar local/cirurgião de Romulo'))
    fireEvent.click(screen.getByRole('button', { name: /^Veio de/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Materno' }))
    expect(estado.ctx.setLinhaOverride).not.toHaveBeenCalled() // não é o editor de exibição
    expect(estado.ctx.definirOrigemLinha).toHaveBeenCalledTimes(1)
    const [, linha, origem, , turno] = estado.ctx.definirOrigemLinha.mock.calls[0]
    expect(linha.anestesista).toBe('Romulo')
    expect(origem).toBe('materno')
    expect(turno).toBe('vespertino')
  })

  it('“Veio de” não oferece o hospital em que a fila já está', () => {
    montar({ unimed: UNIMED, hro: HRO })
    fireEvent.click(screen.getByLabelText('Editar local/cirurgião de Romulo'))
    fireEvent.click(screen.getByRole('button', { name: /^Veio de/ }))
    expect(screen.getByRole('button', { name: 'Materno' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'HRO' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Unimed' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Não informar' })).toBeTruthy()
  })

  it('quem é do rodapé daqui não tem “Veio de” — não há pergunta a fazer', () => {
    montar({ unimed: UNIMED, hro: HRO })
    fireEvent.click(screen.getByLabelText('Editar local/cirurgião de Marilio'))
    expect(screen.queryByRole('button', { name: /^Veio de/ })).toBeNull()
  })

  it('marcado como Materno, o Rômulo passa a sair antes das ajudas do HRO', () => {
    const marcado = {
      ...UNIMED,
      linhaOverrides: { 'vespertino:ROMULO': { origem: 'materno', por: 'u-x', em: '2026-08-27T17:00:00Z' } },
    }
    montar({ unimed: marcado, hro: HRO })
    const nomes = fila()
    // Oscar (plantão do contraturno) subiu em 30/08; a ordem ENTRE as ajudas,
    // que é o assunto deste teste, seguiu igual
    expect(nomes.slice(-4)).toEqual(['Oscar', 'Alexandre S', 'Gustavo', 'Romulo'])
    expect(screen.getByText('Ajuda (Materno)')).toBeTruthy()
  })

  it('sem a escala do outro hospital, a cauda não inventa ordem nenhuma', () => {
    montar({ unimed: UNIMED })
    // ninguém tem origem conhecida: a fila não quebra, as ajudas seguem no fim
    // (desde 30/08 elas fecham a lista, à frente do plantão do contraturno) e
    // nenhuma delas ganha rótulo de origem
    const nomes = fila()
    expect(nomes).toContain('Oscar')
    expect(nomes.indexOf('Oscar')).toBeLessThan(nomes.indexOf('Alexandre S'))
    expect(screen.queryByText('Ajuda (HRO)')).toBeNull()
  })
})

// ── AJUDA EM OUTRO HOSPITAL, VISTA DA ESCALA DELE (dono 30–31/08) ───────────
// "Oscar deve permanecer na lista de liberações da Unimed, ser marcado como
// ajuda e conter no card local/cirurgia/cirurgião onde ele está."
//
// Aqui o Oscar fecha o rodapé da Unimed SEM cirurgia lá, e tem uma no IOSC do
// HRO. É a página que precisa cruzar as escalas: a view sozinha não tem como
// saber. `presencaOutros` passa a carregar os CASOS de lá, com sala e cirurgião.
describe('quem está de ajuda em outro hospital, na escala DELE', () => {
  const UNIMED_SEM_OSCAR = {
    ...UNIMED,
    casos: UNIMED.casos.filter((c) => c.anestesista !== 'OSCAR'),
  }
  const HRO_COM_OSCAR = {
    ...HRO,
    casos: [{
      id: 'h9', sala: 'IOSC', ordem: 0, hora: '13:30', anestesista: 'OSCAR',
      cirurgiao: 'Mauricio Fabiani', bloco: 'iosc', isContinuacao: false, semAnestesista: false,
    }],
  }

  it('não nasce Liberado: sem caso AQUI porque está operando LÁ', () => {
    montar({ unimed: UNIMED_SEM_OSCAR, hro: HRO_COM_OSCAR })
    const card = screen.getByLabelText('Editar local/cirurgião de Oscar').closest('[data-linha]')
    expect(card.textContent).not.toMatch(/Liberado/)
  })

  it('ganha o badge de Ajuda e o card diz local, hospital e cirurgião', () => {
    montar({ unimed: UNIMED_SEM_OSCAR, hro: HRO_COM_OSCAR })
    const card = screen.getByLabelText('Editar local/cirurgião de Oscar').closest('[data-linha]')
    expect(card.textContent).toMatch(/Ajuda IOSC\/HRO/)
    expect(card.textContent).toMatch(/Mauricio Fabiani/)
  })

  it('quem opera nos DOIS hospitais NÃO vira ajuda', () => {
    // recorte que faltava no cálculo revertido em 04/08 por "falso emprestado":
    // presença nas duas escalas COM cirurgia nas duas é trabalho nas duas
    montar({ unimed: UNIMED, hro: HRO_COM_OSCAR })
    const card = screen.getByLabelText('Editar local/cirurgião de Oscar').closest('[data-linha]')
    expect(card.textContent).not.toMatch(/Ajuda IOSC/)
  })
})

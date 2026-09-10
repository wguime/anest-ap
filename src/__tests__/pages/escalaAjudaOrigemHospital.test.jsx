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
    // Oscar fecha o rodapé daqui → plantão do contraturno, o último. As ajudas
    // (Alexandre S e Gustavo) NÃO fecham rodapé de hospital nenhum, então a
    // exceção de 31/08 não as alcança: seguem saindo depois dele.
    expect(nomes[nomes.length - 1]).toBe('Oscar')
    // índice MAIOR no rodapé de origem = sai antes lá = mais embaixo aqui
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
    expect(nomes.slice(-4)).toEqual(['Alexandre S', 'Gustavo', 'Romulo', 'Oscar'])
    expect(screen.getByText('Ajuda (Materno)')).toBeTruthy()
  })

  it('sem a escala do outro hospital, a cauda não inventa ordem nenhuma', () => {
    montar({ unimed: UNIMED })
    // ninguém tem origem conhecida: a fila não quebra e o contraturno segue no fim
    const nomes = fila()
    expect(nomes[nomes.length - 1]).toBe('Oscar')
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

// ── ORDEM INFORMADA vence a DERIVADA (dono 09/09) ───────────────────────────
// "você não seguiu a ordem de liberação, corrija (mantendo a ordem de liberações
// conforme informado)". Caso real, 10/09 de manhã na Unimed: o dono numerou
// "3º Rafael – Unimed, 4º Alexandre – Unimed", o lote gravou o array na ordem
// certa (o último sai primeiro) e a fila publicou ao contrário — Alexandre está
// em 10º no rodapé do HRO e a regra de 27/08 o punha embaixo. E como quem tem
// origem derivada perdia o `ajudaIdx`, as setas sumiam justamente nele: não
// havia conserto manual na tela.
//
// ⚠️ De PÁGINA pelo mesmo motivo de 27/08: a lib já sabia ordenar; o que falta
// provar é que a página LÊ a marca e a entrega à lib.
describe('ordem informada da ajuda vence a derivada (dono 09/09)', () => {
  const UNIMED_MANHA = {
    id: 'u2', hospital: 'unimed', data: '2026-08-27',
    ordemLiberacao: { matutino: ['GIOVANA', 'CRISTINA'] },
    ajudaExterna: { matutino: ['ALEXANDRE D', 'RAFAEL'] },
    liberacoes: {}, linhaOverrides: {},
    casos: [
      caso('m1', 'CC - Sala 1', 'GIOVANA', '07:30'),
      caso('m2', 'CC - Sala 2', 'CRISTINA', '07:30'),
      caso('m3', 'Exames', 'ALEXANDRE D', '08:00'),
      caso('m4', 'Exames', 'RAFAEL', '09:00'),
    ],
  }
  const HRO_MANHA = {
    id: 'h2', hospital: 'hro', data: '2026-08-27',
    ordemLiberacao: {
      // rodapé real do HRO em 10/09: Alexandre D em 11º e mais SEIS nomes depois —
      // ele NÃO fecha o rodapé de lá, então a exceção de 31/08 (plantão do
      // contraturno de outro hospital sai antes de todos) não o alcança.
      matutino: ['MAURICIO', 'EDUARDO', 'COSTA', 'STAUB', 'GUSTAVO', 'JANAINA',
        'FERNANDO', 'TIAGO', 'NATHALIA', 'DANIELA', 'ALEXANDRE D',
        'MATHEUS (CONSULT)', 'GUILHERME DIDOMENICO', 'VICENTE', 'RAUL', 'HUMBERTO', 'ALINE'],
    },
    ajudaExterna: { matutino: [] }, liberacoes: {}, linhaOverrides: {}, casos: [],
  }
  const comMarca = {
    ...UNIMED_MANHA,
    ajudaExterna: { matutino: ['ALEXANDRE D', 'RAFAEL'], ordemInformada: { matutino: true } },
  }

  // mesma data do arquivo (o contexto mockado é dela); o que muda é o RELÓGIO,
  // que põe a tela no turno da manhã.
  beforeEach(() => vi.setSystemTime(new Date('2026-08-27T08:00:00-03:00')))

  // Cristina fecha o rodapé daqui = plantão do contraturno, e sai antes de todo
  // mundo (29/07). A disputa é entre as duas AJUDAS, logo acima dela.
  it('sem a marca, a derivação de 27/08 segue mandando — Alexandre sai antes do Rafael', () => {
    montar({ unimed: UNIMED_MANHA, hro: HRO_MANHA })
    const nomes = fila()
    expect(nomes[nomes.length - 1]).toBe('Cristina')
    expect(nomes.indexOf('Alexandre D')).toBeGreaterThan(nomes.indexOf('Rafael'))
  })

  it('com a marca, a fila sai na ordem que o dono informou — Rafael antes de Alexandre', () => {
    montar({ unimed: comMarca, hro: HRO_MANHA })
    const nomes = fila()
    expect(nomes[nomes.length - 1]).toBe('Cristina')
    expect(nomes.indexOf('Rafael')).toBeGreaterThan(nomes.indexOf('Alexandre D'))
  })

  it('com a marca, as setas voltam para quem tem origem — o dono conserta na tela', () => {
    montar({ unimed: comMarca, hro: HRO_MANHA })
    expect(screen.getByLabelText('Descer Alexandre D na ordem das ajudas')).toBeTruthy()
    expect(screen.getByLabelText('Subir Rafael na ordem das ajudas')).toBeTruthy()
  })

  it('sem a marca, quem tem origem continua sem setas (o array não manda ali)', () => {
    montar({ unimed: UNIMED_MANHA, hro: HRO_MANHA })
    expect(screen.queryByLabelText('Descer Alexandre D na ordem das ajudas')).toBeNull()
  })

  it('a marca mexe na ORDEM, não no card: o badge segue sendo o mesmo "Ajuda"', () => {
    montar({ unimed: comMarca, hro: HRO_MANHA })
    const card = screen.getByLabelText('Editar local/cirurgião de Alexandre D').closest('[data-linha]')
    expect(card.textContent).toMatch(/Ajuda/)
    expect(card.textContent).not.toMatch(/Ajuda \(HRO\)/) // ajuda declarada não duplica o rótulo
  })
})

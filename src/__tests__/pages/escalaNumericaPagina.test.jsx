/**
 * Escala Numérica e Feriados — as duas telas de CONSULTA da ordem de liberação (dono 03/09).
 *
 * O que estas telas precisam garantir, e que teste de lib nenhum pega:
 * - férias MARCAM e não excluem: a fila do quadro continua inteira, na mesma numeração;
 * - a tarde vem invertida da lib e a tela NÃO inverte de novo (o bug clássico deste módulo);
 * - o consultório fica fora da fila;
 * - o feriado é fila única e sai em duas colunas, manhã e tarde.
 *
 * As férias vêm do Pega Plantão mockado: a fixture põe KARINE de férias em 03/09, que é
 * exatamente o que a API devolveu no dia em que a tela foi feita.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'

const { getFeriasDoAno, invalidarFeriasDoAno } = vi.hoisted(() => {
  const registro = (nome, data, codigo) => ({
    CodigoPlantao: codigo,
    Setor: 'Férias',
    Inicio: `${data}T08:00:00`,
    Fim: `${data}T18:00:00`,
    ProfDePlantao: nome,
    DataCriacao: '2026-01-10T09:00:00',
  })
  return {
    getFeriasDoAno: vi.fn(async () => [
      registro('Karine Bedin', '2026-09-03', 901),
      registro('Gabriel Juan Kettenhuber Costa', '2026-09-03', 902),
      registro('João Ricardo Moreira', '2026-09-03', 903),
      // fora do dia consultado: não pode marcar ninguém em 03/09
      registro('Thayná Regina Santos', '2026-10-12', 904),
    ]),
    invalidarFeriasDoAno: vi.fn(),
  }
})

/**
 * Plantões do sábado 05/09 como o Pega Plantão devolveu de verdade: P1–P4 das 7h às 19h,
 * P5–P10 só de manhã e P11 de 24h. A fixture inclui P10 fora de ordem de propósito — a fila
 * ordena pelo NÚMERO, e ordenar como texto poria P10 antes de P2.
 */
const { getPlantoesPorData } = vi.hoisted(() => ({
  getPlantoesPorData: vi.fn(async () => ({
    ferias: [],
    plantoes: [
      { nome: 'Erlei Perini', setor: 'P3', horario: '07:00', horarioFim: '19:00' },
      { nome: 'Gustavo Biesdorf', setor: 'P10', horario: '07:00', horarioFim: '13:00' },
      { nome: 'Joao Henrique Salvao Vanni', setor: 'P1', horario: '07:00', horarioFim: '19:00' },
      { nome: 'A. Danieli', setor: 'P11', horario: '07:00', horarioFim: '07:00' },
      { nome: 'Romulo Santos Roxo', setor: 'P2', horario: '07:00', horarioFim: '19:00' },
      // sem Pn no setor: fica fora da fila
      { nome: 'Alguem Do Consultorio', setor: 'Consultório', horario: '08:00', horarioFim: '12:00' },
    ],
  })),
}))

vi.mock('@/services/pegaPlantaoApi', () => ({ getFeriasDoAno, invalidarFeriasDoAno, getPlantoesPorData }))

import { ThemeProvider } from '@/design-system'
import EscalaNumericaPage from '@/pages/escala-numerica/EscalaNumericaPage'
import FeriadosPage from '@/pages/escala-numerica/FeriadosPage'

const wrap = ({ children }) => <ThemeProvider>{children}</ThemeProvider>

/** Nomes de um bloco, na ordem em que estão na tela (só as linhas da fila). */
const nomesEm = (raiz) => [...raiz.querySelectorAll('[data-slot="ordem-nome"]')].map((el) => el.textContent)
const nomesDoBloco = (rotulo) => nomesEm(screen.getByRole('heading', { name: rotulo }).closest('section'))
const pns = () => [...document.querySelectorAll('[data-slot="fds-linha"]')].map((el) => el.firstElementChild.textContent)
const nomesFds = () => [...document.querySelectorAll('[data-slot="fds-nome"]')].map((el) => el.textContent)

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-09-03T10:00:00-03:00')) // quinta
})
afterEach(() => vi.useRealTimers())

describe('Escala Numérica — quinta 03/09/2026', () => {
  it('consulta as férias NA HORA: invalida o cache antes de buscar', async () => {
    render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(getFeriasDoAno).toHaveBeenCalled())
    expect(invalidarFeriasDoAno).toHaveBeenCalledWith(2026)
    // invalidar tem de vir ANTES do fetch, senão a tela mostra o agregado velho
    expect(invalidarFeriasDoAno.mock.invocationCallOrder[0])
      .toBeLessThan(getFeriasDoAno.mock.invocationCallOrder[0])
  })

  it('mostra os três hospitais e o consultório à parte, com a fila do quadro inteira', async () => {
    render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'HRO' })).toBeInTheDocument())

    expect(screen.getByRole('heading', { name: 'Unimed' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Materno' })).toBeInTheDocument()
    // 20 no HRO: ninguém sai por férias
    const hro = screen.getByRole('heading', { name: 'HRO' }).closest('section')
    expect(within(hro).getByText('20 nomes')).toBeInTheDocument()
    // consultório fora da fila, sem numeração de posição
    const cons = screen.getByRole('heading', { name: 'Consultório' }).closest('section')
    expect(within(cons).getByText('fora da fila')).toBeInTheDocument()
    for (const n of ['EDUARDO', 'ERLEI', 'NATHALIA']) {
      expect(within(cons).getByText(n)).toBeInTheDocument()
    }
  })

  it('quem está de férias FICA na posição, marcado — não é excluído', async () => {
    render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(screen.getAllByText('(férias)').length).toBeGreaterThan(0))

    // os 3 do dia: JOAO RICARDO (06), GABRIEL (10), KARINE (18) — todos no HRO
    expect(screen.getAllByText('(férias)')).toHaveLength(3)
    const linhaKarine = screen.getByText('KARINE').closest('div')
    expect(linhaKarine.textContent).toContain('(férias)')
    expect(linhaKarine.textContent).toContain('18')
    // a posição do quadro é preservada: KARINE é a 8ª da manhã do HRO
    expect(nomesDoBloco('HRO')[7]).toBe('KARINE')
    expect(nomesDoBloco('HRO')).toHaveLength(20)
  })

  it('THAYNA está de férias em outro dia e NÃO é marcada em 03/09', async () => {
    render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(screen.getAllByText('(férias)').length).toBe(3))
    const linhaThayna = screen.getByText('THAYNA').closest('div')
    expect(linhaThayna.textContent).not.toContain('(férias)')
  })

  it('a tarde já vem invertida da lib — a tela NÃO inverte de novo', async () => {
    render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'HRO' })).toBeInTheDocument())
    expect(nomesDoBloco('HRO')[0]).toBe('MELO')

    fireEvent.click(screen.getByRole('tab', { name: 'Tarde' }))
    await waitFor(() => expect(nomesDoBloco('HRO')[0]).toBe('LEANDRO'))
    expect(nomesDoBloco('HRO').at(-1)).toBe('MELO')
    // e a Louise entra na 1ª posição da tarde da Unimed, pelo quadro dela
    expect(nomesDoBloco('Unimed')[0]).toBe('LOUISE')
  })

  it('sem resposta do Pega Plantão a lista continua inteira, sem marca, e a tela avisa', async () => {
    getFeriasDoAno.mockRejectedValueOnce(new Error('proxy 502'))
    render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(screen.getByText(/Férias NÃO conferidas/i)).toBeInTheDocument())
    expect(screen.queryByText('(férias)')).not.toBeInTheDocument()
    expect(nomesDoBloco('HRO')).toHaveLength(20)
  })
})

describe('Escala Numérica — fim de semana (P1..P12 do Pega Plantão)', () => {
  it('sábado troca a numérica pela fila dos plantonistas, na ordem do Pn', async () => {
    vi.setSystemTime(new Date('2026-09-05T10:00:00-03:00'))
    render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Plantonistas do fim de semana' })).toBeInTheDocument()
    )
    expect(screen.queryByRole('heading', { name: 'HRO' })).not.toBeInTheDocument()
    // a ordem é pelo NÚMERO do posto: P2 antes de P10, nunca alfabética
    expect(pns()).toEqual(['P1', 'P2', 'P3', 'P10', 'P11'])
    expect(nomesFds()[0]).toBe('Joao Henrique Salvao Vanni')
    // e a tela diz de onde vem
    expect(screen.getByText(/NÃO faz parte da escala numérica/i)).toBeInTheDocument()
    // turno não escolhe nada no fim de semana
    expect(screen.queryByRole('tab', { name: 'Tarde' })).not.toBeInTheDocument()
  })

  it('domingo ancora no sábado — o plantão das 48h é lançado uma vez só', async () => {
    vi.setSystemTime(new Date('2026-09-06T10:00:00-03:00'))
    render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(pns().length).toBeGreaterThan(1))
    expect(getPlantoesPorData).toHaveBeenCalledWith('2026-09-05')
    expect(screen.getByText(/lançado no sábado \(05\/09\)/i)).toBeInTheDocument()
  })

  it('Pega Plantão fora do ar no fim de semana: a tela diz, e não inventa fila', async () => {
    vi.setSystemTime(new Date('2026-09-05T10:00:00-03:00'))
    getPlantoesPorData.mockRejectedValueOnce(new Error('proxy 502'))
    render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() =>
      expect(screen.getByText(/Não foi possível consultar o Pega Plantão/i)).toBeInTheDocument()
    )
    expect(pns()).toEqual([])
  })

  it('data fora da edição publicada explica o porquê', async () => {
    vi.setSystemTime(new Date('2027-01-05T10:00:00-03:00'))
    render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(screen.getByText(/Fora da edição vigente/i)).toBeInTheDocument())
  })
})

describe('Escala Numérica — feriado', () => {
  it('07/09 sai como fila única, e não como três hospitais', async () => {
    vi.setSystemTime(new Date('2026-09-07T10:00:00-03:00'))
    render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'INDEPENDENCIA' })).toBeInTheDocument())
    expect(screen.getByText(/feriado · fila única · 20 nomes/)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'HRO' })).not.toBeInTheDocument()
    expect(nomesDoBloco('INDEPENDENCIA')[0]).toBe('GIOVANA')
  })
})

describe('Feriados — lista e ordem do feriado', () => {
  it('lista os feriados do ano e marca o próximo', async () => {
    render(<FeriadosPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(screen.getByText('CARNAVAL')).toBeInTheDocument())
    expect(screen.getByText('INDEPENDENCIA')).toBeInTheDocument()
    // 03/09: o próximo feriado é 07/09
    const proximo = screen.getByText('próximo').closest('button')
    expect(proximo.textContent).toContain('INDEPENDENCIA')
    expect(proximo.textContent).toContain('07/09')
  })

  it('tocar num feriado abre manhã e tarde lado a lado, com a tarde invertida', async () => {
    render(<FeriadosPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(screen.getByText('INDEPENDENCIA')).toBeInTheDocument())
    fireEvent.click(screen.getByText('INDEPENDENCIA').closest('button'))

    await waitFor(() => expect(screen.getByText('Manhã')).toBeInTheDocument())
    expect(screen.getByText('Tarde')).toBeInTheDocument()
    expect(screen.getByText(/Fila única do feriado: todos os hospitais, 20 nomes/)).toBeInTheDocument()
    // GIOVANA abre a manhã e fecha a tarde — a tarde é a manhã de trás para frente
    const manha = nomesEm(screen.getByText('Manhã').parentElement)
    const tarde = nomesEm(screen.getByText('Tarde').parentElement)
    expect(manha).toHaveLength(20)
    expect(manha[0]).toBe('GIOVANA')
    expect(tarde.at(-1)).toBe('GIOVANA')
    expect(tarde).toEqual([...manha].reverse())
  })

  it('feriado fora da vigência da grade continua consultável (CARNAVAL, fevereiro)', async () => {
    render(<FeriadosPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(screen.getByText('CARNAVAL')).toBeInTheDocument())
    fireEvent.click(screen.getByText('CARNAVAL').closest('button'))
    await waitFor(() =>
      expect(screen.getByText(/Fila única do feriado: todos os hospitais, 20 nomes/)).toBeInTheDocument()
    )
    // uma vez em cada turno — o CARNAVAL é fila única de 20 nomes nos dois
    expect(screen.getAllByText('JANAINA')).toHaveLength(2)
  })
})

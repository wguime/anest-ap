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
      // Materno (24 CURY) e consultório (25 ERLEI): a marca não é só do HRO
      registro('Marcos Tadeu Cury', '2026-09-03', 905),
      registro('Erlei Perini', '2026-09-03', 906),
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
const { getPlantoesPorData, fetchEscala } = vi.hoisted(() => {
  const FDS = [
    { nome: 'Erlei Perini', setor: 'P3', horario: '07:00', horarioFim: '19:00' },
    { nome: 'Gustavo Biesdorf', setor: 'P10', horario: '07:00', horarioFim: '13:00' },
    { nome: 'Joao Henrique Salvao Vanni', setor: 'P1', horario: '07:00', horarioFim: '19:00' },
    { nome: 'A. Danieli', setor: 'P11', horario: '07:00', horarioFim: '07:00' },
    { nome: 'Romulo Santos Roxo', setor: 'P2', horario: '07:00', horarioFim: '19:00' },
    // sem Pn no setor: fica fora da fila
    { nome: 'Alguem Do Consultorio', setor: 'Consultório', horario: '08:00', horarioFim: '12:00' },
  ]
  // noite de 03/09 (véspera de sexta 04/09): P1 no HRO e P2 na Unimed
  const NOITE_03 = [
    { nome: 'Romulo Santos Roxo', setor: 'P1', horario: '19:00', horarioFim: '07:00' },
    { nome: 'Klisman Drescher Hilleshein', setor: 'P2', horario: '19:00', horarioFim: '07:00' },
    { nome: 'Marcos Cardoso Costa', setor: 'P3', horario: '19:00', horarioFim: '23:00' },
  ]
  return {
    getPlantoesPorData: vi.fn(async (data) => ({
      ferias: [],
      plantoes: data === '2026-09-03' ? NOITE_03 : FDS,
    })),
    fetchEscala: vi.fn(async () => ({ fdsMeta: { grade: { '19-07': { hro: 'MATHEUS', unimed: 'JOAO RICARDO' } } } })),
  }
})

vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: { fetchEscala } }))

vi.mock('@/services/pegaPlantaoApi', () => ({ getFeriasDoAno, invalidarFeriasDoAno, getPlantoesPorData }))

/**
 * A página de Feriados também mostra as trocas, então precisa de identidade (quem sou na
 * legenda), do roster (apelido → uid) e do Firestore. Aqui o usuário logado é a GIOVANA, que
 * é a 1ª do feriado de 07/09 — é o que permite testar o pedido de troca de verdade.
 */
const { assinantes, criarTroca, notificar } = vi.hoisted(() => ({
  assinantes: [], criarTroca: vi.fn(), notificar: vi.fn(async () => {}),
}))

vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: { uid: 'uid-giovana', nome: 'Giovana Gomes Noll', email: 'g@x.com' } }),
}))
vi.mock('@/contexts/MessagesContext', () => ({
  useMessages: () => ({ createSystemNotification: notificar }),
}))
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    roster: [{ uid: 'uid-giovana', nome: 'Giovana Gomes Noll', apelidos: ['GIOVANA'] },
             { uid: 'uid-marilio', nome: 'Marilio Jose Flach', apelidos: ['MARILIO'] }],
    options: [], resolver: (a) => (String(a).toUpperCase() === 'MARILIO' ? 'uid-marilio' : null),
    upsertAlias: vi.fn(), refresh: vi.fn(),
  }),
}))
vi.mock('@/services/trocaFeriadoService', () => ({
  createTradeRequest: criarTroca,
  acceptTrade: vi.fn(async () => ({ success: true, trade: {} })),
  rejectTrade: vi.fn(async () => ({ success: true, trade: {} })),
  cancelTrade: vi.fn(async () => ({ success: true, trade: {} })),
  subscribeTrocas: (uid, getNumero, cb) => { assinantes.push(cb); cb(estadoTrocas); return () => {} },
}))

let estadoTrocas = { todas: [], aceitas: [], minhas: [], pendentesParaMim: [], erro: null }
const publicarTrocas = (estado) => { estadoTrocas = estado; assinantes.forEach((cb) => cb(estado)) }

import { ThemeProvider, ToastProvider } from '@/design-system'
import EscalaNumericaPage from '@/pages/escala-numerica/EscalaNumericaPage'
import FeriadosPage from '@/pages/escala-numerica/FeriadosPage'

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

/** Nomes de um bloco, na ordem em que estão na tela (só as linhas da fila). */
const nomesEm = (raiz) => [...raiz.querySelectorAll('[data-slot="ordem-nome"]')].map((el) => el.textContent)
const nomesDoBloco = (rotulo) => nomesEm(screen.getByRole('heading', { name: rotulo }).closest('section'))
const pns = () => [...document.querySelectorAll('[data-slot="fds-linha"]')].map((el) => el.firstElementChild.textContent)
// o rótulo é partido em spans (abaixo de 400px vira só "(pós)") e o title leva o posto,
// então casa pelo prefixo do title
const posPlantao = () => [...document.querySelectorAll('[title^="Pós plantão"]')]
const nomesFds = () => [...document.querySelectorAll('[data-slot="fds-nome"]')].map((el) => el.textContent)

beforeEach(() => {
  vi.clearAllMocks()
  assinantes.length = 0
  estadoTrocas = { todas: [], aceitas: [], minhas: [], pendentesParaMim: [], erro: null }
  criarTroca.mockResolvedValue({ trade: { codigo: 'FR000001' }, error: null })
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

    // 3 no HRO + 1 no Materno + 1 no consultório
    expect(screen.getAllByText('(férias)')).toHaveLength(5)
    const linhaKarine = screen.getByText('KARINE').closest('div')
    expect(linhaKarine.textContent).toContain('(férias)')
    expect(linhaKarine.textContent).toContain('18')
    // a posição do quadro é preservada: KARINE é a 8ª da manhã do HRO
    expect(nomesDoBloco('HRO')[7]).toBe('KARINE')
    expect(nomesDoBloco('HRO')).toHaveLength(20)
  })

  it('a marca vale para o MATERNO e para o CONSULTÓRIO, não só para os hospitais da fila', async () => {
    render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(screen.getAllByText('(férias)').length).toBe(5))

    // Materno: CURY (24) fica na posição dele, marcado
    const materno = screen.getByRole('heading', { name: 'Materno' }).closest('section')
    expect(within(materno).getByText('CURY').closest('div').textContent).toContain('(férias)')
    expect(nomesDoBloco('Materno')).toEqual(['CURY', 'RAQUEL'])

    // Consultório: fica fora da fila, mas ERLEI (25) também aparece marcado
    const cons = screen.getByRole('heading', { name: 'Consultório' }).closest('section')
    const chips = [...cons.querySelectorAll('[data-slot="consultorio-chip"]')].map((c) => c.textContent)
    expect(chips).toHaveLength(3)
    expect(chips.find((t) => t.includes('ERLEI'))).toContain('(férias)')
    expect(chips.find((t) => t.includes('EDUARDO'))).not.toContain('(férias)')
  })

  it('THAYNA está de férias em outro dia e NÃO é marcada em 03/09', async () => {
    render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(screen.getAllByText('(férias)').length).toBe(5))
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
    expect(document.querySelectorAll('[data-slot="consultorio-chip"]')).toHaveLength(3)
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
    // e a tela diz até onde a ordem vale (regra do dono 03/09): de P5 em diante a ordem do
    // Pega Plantão é a real; em P1–P4 os nomes estão certos mas a ordem sai com a escala
    expect(screen.getByText(/NÃO faz parte da escala numérica/i)).toBeInTheDocument()
    expect(screen.getByText(/De P5 em diante a ordem é\s+exatamente a do Pega Plantão/i)).toBeInTheDocument()
    expect(screen.getByText(/Em P1 a P4 os nomes estão certos, mas a ordem não/i)).toBeInTheDocument()
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

  /**
   * "Nos feriados não há pós plantão, siga a lista conforme enviado" (dono 04/09). A fila do
   * feriado é a publicada, ponto — não há coluna por hospital para ter 2ª posição, e ninguém
   * é reordenado nem marcado. 07/09 é segunda, então a véspera É consultada; o que não pode é
   * a resposta mexer na lista.
   */
  it('feriado NÃO tem pós-plantão: a fila publicada sai intacta nos dois turnos', async () => {
    vi.setSystemTime(new Date('2026-09-07T10:00:00-03:00'))
    render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'INDEPENDENCIA' })).toBeInTheDocument())

    // o mock do documento de FDS põe MATHEUS e JOAO RICARDO na noite; nenhum dos dois pode
    // saltar para a 2ª posição da fila do feriado
    const manha = nomesDoBloco('INDEPENDENCIA')
    expect(manha.slice(0, 3)).toEqual(['GIOVANA', 'EDUARDO', 'JANAINA'])
    expect(manha).toHaveLength(20)
    expect(posPlantao()).toHaveLength(0)
    expect(screen.queryByText('(P1)')).not.toBeInTheDocument()
    expect(screen.queryByText('(P2)')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Tarde' }))
    await waitFor(() => expect(nomesDoBloco('INDEPENDENCIA')[0]).toBe('STAUB'))
    expect(nomesDoBloco('INDEPENDENCIA')).toEqual([...manha].reverse())
    expect(posPlantao()).toHaveLength(0)
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

/**
 * Trocas de feriado na tela (dono 03/09: com aceite, e a troca aceita muda a fila).
 * O usuário logado é a GIOVANA (08), 1ª de 07/09.
 */
describe('Feriados — trocas', () => {
  it('quem está na escala vê o botão de pedir troca', async () => {
    render(<FeriadosPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Trocas de feriado' })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /pedir troca/i })).toBeInTheDocument()
    expect(screen.getByText(/Nenhuma troca sua no momento/i)).toBeInTheDocument()
  })

  it('a troca ACEITA muda a fila do feriado, e a pendente não', async () => {
    const troca = {
      id: 't1', codigo: 'FR111111', status: 'pendente', escopo: 'data',
      feriadoData: '2026-09-07', feriadoDesejado: '2026-10-12',
      solicitanteUid: 'uid-giovana', solicitanteNumero: '08', solicitanteNome: 'GIOVANA',
      destinatarioUid: 'uid-marilio', destinatarioNumero: '36', destinatarioNome: 'MARILIO',
      descricao: 'viagem',
    }
    estadoTrocas = { todas: [troca], aceitas: [], minhas: [troca], pendentesParaMim: [], erro: null }
    render(<FeriadosPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(screen.getByText('INDEPENDENCIA')).toBeInTheDocument())
    fireEvent.click(screen.getByText('INDEPENDENCIA').closest('button'))
    await waitFor(() => expect(screen.getByText('Manhã')).toBeInTheDocument())
    // pendente: a fila segue com a GIOVANA na 1ª
    expect(nomesEm(screen.getByText('Manhã').parentElement)[0]).toBe('GIOVANA')

    publicarTrocas({ todas: [{ ...troca, status: 'aceita' }], aceitas: [{ ...troca, status: 'aceita' }], minhas: [{ ...troca, status: 'aceita' }], pendentesParaMim: [], erro: null })
    await waitFor(() =>
      expect(nomesEm(screen.getByText('Manhã').parentElement)[0]).toBe('MARILIO')
    )
    // e a tarde continua sendo a manhã invertida
    const manha = nomesEm(screen.getByText('Manhã').parentElement)
    expect(nomesEm(screen.getByText('Tarde').parentElement)).toEqual([...manha].reverse())
  })

  it('pedido pendente para mim mostra Aceitar e Recusar; o meu, Cancelar', async () => {
    const paraMim = {
      id: 't2', codigo: 'FR222222', status: 'pendente', escopo: 'posicao',
      feriadoData: '2026-09-07', solicitanteUid: 'uid-marilio', solicitanteNumero: '36',
      solicitanteNome: 'MARILIO', destinatarioUid: 'uid-giovana', destinatarioNumero: '08',
      destinatarioNome: 'GIOVANA', descricao: 'consulta',
    }
    estadoTrocas = { todas: [paraMim], aceitas: [], minhas: [], pendentesParaMim: [paraMim], erro: null }
    render(<FeriadosPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Aceitar' })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Recusar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cancelar pedido/i })).not.toBeInTheDocument()
    expect(screen.getByText(/MARILIO e GIOVANA trocam de posição no feriado de 07\/09/)).toBeInTheDocument()
  })

  it('o formulário só oferece feriados em que EU estou, e recusa pedido sem motivo', async () => {
    render(<FeriadosPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(screen.getByRole('button', { name: /pedir troca/i })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /pedir troca/i }))
    await waitFor(() => expect(screen.getByText('Pedir troca de feriado')).toBeInTheDocument())
    // sem escolher nada, o pedido não sai e a tela diz o que falta
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /enviar pedido/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Escolha o seu feriado/i))
    expect(criarTroca).not.toHaveBeenCalled()
  })
})

/**
 * Pós-plantão (dono 03/09): quem fez a noite P1/P2 da véspera assume a 2ª posição do
 * hospital em que plantonou na manhã seguinte, e à tarde fica na posição da numérica,
 * marcado. A fixture usa a noite REAL de 03/09 — Romulo P1 (HRO) e Klisman P2 (Unimed) —
 * e o dia observado é a sexta 04/09, em que a numérica traz os dois na Unimed.
 */
describe('Escala Numérica — pós-plantão', () => {
  it('manhã: o P1 da noite atravessa para a 2ª do HRO e o P2 sobe na Unimed', async () => {
    vi.setSystemTime(new Date('2026-09-04T10:00:00-03:00'))
    render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(nomesDoBloco('HRO')[1]).toBe('ROMULO'))

    // busca o plantão da VÉSPERA, não o do dia
    expect(getPlantoesPorData).toHaveBeenCalledWith('2026-09-03')
    expect(nomesDoBloco('Unimed')[1]).toBe('KLISMAN')
    // o 1º de cada hospital não se mexe — a 2ª posição é abaixo do plantão da manhã
    expect(nomesDoBloco('HRO')[0]).toBe('HUMBERTO / ROBERTA')
    expect(nomesDoBloco('Unimed')[0]).toBe('MELO')
    // e o Romulo sai da coluna da Unimed: uma pessoa, um lugar
    expect(nomesDoBloco('Unimed')).not.toContain('ROMULO')
    // de manhã eles trabalham: nada de marca de pós plantão nem nome esmaecido…
    expect(posPlantao()).toHaveLength(0)
    // …mas o POSTO entre parênteses fica, para a 2ª posição não parecer arbitrária
    expect(screen.getByText('ROMULO').closest('div').textContent).toContain('(P1)')
    expect(screen.getByText('KLISMAN').closest('div').textContent).toContain('(P2)')
  })

  it('tarde: os dois ficam na posição da numérica, marcados como pós plantão', async () => {
    vi.setSystemTime(new Date('2026-09-04T10:00:00-03:00'))
    render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Unimed' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('tab', { name: 'Tarde' }))

    await waitFor(() => expect(posPlantao()).toHaveLength(2))
    const uni = nomesDoBloco('Unimed')
    expect(uni[11]).toBe('ROMULO')
    expect(uni[13]).toBe('KLISMAN')
    expect(screen.getByText('ROMULO').closest('div').textContent).toMatch(/\(pós.*P1\)/)
    expect(screen.getByText('KLISMAN').closest('div').textContent).toMatch(/\(pós.*P2\)/)
    // ninguém foi tirado da fila da tarde
    expect(uni).toHaveLength(20)
  })

  it('na segunda a fonte é o documento do fim de semana, não o Pega Plantão', async () => {
    vi.setSystemTime(new Date('2026-08-31T10:00:00-03:00')) // segunda
    render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(fetchEscala).toHaveBeenCalledWith('2026-08-30', 'fds'))
    // domingo 30/08 não é consultado no Pega Plantão para o plantão noturno
    expect(getPlantoesPorData).not.toHaveBeenCalledWith('2026-08-30')
    await waitFor(() => expect(nomesDoBloco('HRO')[1]).toBe('MATHEUS'))
    expect(nomesDoBloco('Unimed')[1]).toBe('JOAO RICARDO')
  })

  it('no fim de semana a regra não roda — a véspera nem é consultada', async () => {
    vi.setSystemTime(new Date('2026-09-05T10:00:00-03:00')) // sábado
    render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Plantonistas do fim de semana' })).toBeInTheDocument()
    )
    expect(getPlantoesPorData).not.toHaveBeenCalledWith('2026-09-04')
    expect(fetchEscala).not.toHaveBeenCalled()
  })
})

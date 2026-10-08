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

const { getFeriasDoAno, invalidarFeriasDoAno, getLicencasDoAno } = vi.hoisted(() => {
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
    // licenças REAIS do Pega Plantão (setor "LICENÇA SAÚDE"): a tela mostra só "ausente"
    getLicencasDoAno: vi.fn(async () => [
      { ...registro('Raquel Schneider', '2026-09-03', 951), Setor: 'LICENÇA SAÚDE' },
      { ...registro('Giovana Gomes Noll', '2026-09-18', 952), Setor: 'LICENÇA SAÚDE' },
    ]),
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
    { nome: 'João Henrique Salvão Vanni', setor: 'P1', horario: '07:00', horarioFim: '19:00' },
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
  // noite de 07/10 (véspera de 08/10), do Pega Plantão de verdade: o P2 é o JOAO RICARDO, que a
  // numérica de 08/10 põe como 1º do MATERNO — o exemplo do dono para o lugar vago (07/10)
  const NOITE_07_10 = [
    { nome: 'Gabriel Juan Kettenhuber Costa', setor: 'P1', horario: '19:00', horarioFim: '07:00' },
    { nome: 'João Ricardo Moreira', setor: 'P2', horario: '19:00', horarioFim: '07:00' },
  ]
  return {
    getPlantoesPorData: vi.fn(async (data) => ({
      ferias: [],
      plantoes: data === '2026-09-03' ? NOITE_03 : data === '2026-10-07' ? NOITE_07_10 : FDS,
    })),
    fetchEscala: vi.fn(async () => ({ fdsMeta: { grade: { '19-07': { hro: 'MATHEUS', unimed: 'JOAO RICARDO' } } } })),
  }
})

vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({ default: { fetchEscala } }))

vi.mock('@/services/pegaPlantaoApi', () => ({ getFeriasDoAno, invalidarFeriasDoAno, getLicencasDoAno, getPlantoesPorData }))

/**
 * A página de Feriados também mostra as trocas, então precisa de identidade (quem sou na
 * legenda), do roster (apelido → uid) e do Firestore. Aqui o usuário logado é a GIOVANA, que
 * é a 1ª do feriado de 07/09 — é o que permite testar o pedido de troca de verdade.
 */
const { assinantes, criarTroca, notificar } = vi.hoisted(() => ({
  assinantes: [], criarTroca: vi.fn(), notificar: vi.fn(async () => {}),
}))

// GIOVANA sem papel = só LÊ as observações (dono 08/10: escreve quem opera a escala)
const GIOVANA = { uid: 'uid-giovana', nome: 'Giovana Gomes Noll', email: 'g@x.com' }
const { usuario, bancoObs, listarObservacoes, salvarObservacao } = vi.hoisted(() => {
  const bancoObs = { linhas: [] }
  return {
    usuario: { atual: null },
    bancoObs,
    // o "banco" das observações: o que se grava volta na releitura, como no Supabase
    listarObservacoes: vi.fn(async () => bancoObs.linhas.filter((l) => l.texto)),
    salvarObservacao: vi.fn(async ({ turno, hospital, texto }) => {
      const limpo = String(texto).trim()
      bancoObs.linhas = [...bancoObs.linhas.filter((l) => !(l.turno === turno && l.hospital === hospital)),
        { turno, hospital, texto: limpo, autorNome: 'GUILHERME SOUZA MELO', atualizadoEm: new Date().toISOString() }]
      return limpo
    }),
  }
})
vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ user: usuario.atual }),
}))
vi.mock('@/services/escalaNumericaObservacaoService', () => ({ listarObservacoes, salvarObservacao, OBSERVACAO_MAX: 300 }))
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
// a ordem se confere pelo nome da LEGENDA (data-legenda); a tela mostra primeiro + último
const nomesEm = (raiz) => [...raiz.querySelectorAll('[data-slot="ordem-nome"]')].map((el) => el.dataset.legenda)
const nomesDoBloco = (rotulo) => nomesEm(screen.getByRole('heading', { name: rotulo }).closest('section'))
const pns = () => [...document.querySelectorAll('[data-slot="fds-linha"]')].map((el) => el.firstElementChild.textContent)
// o rótulo é partido em spans (abaixo de 400px vira só "(pós)") e o title leva o posto,
// então casa pelo prefixo do title
const posPlantao = () => [...document.querySelectorAll('[title^="Pós plantão"]')]
const nomesFds = () => [...document.querySelectorAll('[data-slot="fds-nome"]')].map((el) => el.textContent)
// marca da linha (dono 07/10): linha pintada + selo escrito — a situação vai em data-situacao
const deFerias = () => [...document.querySelectorAll('[data-situacao="ferias"]')]
// só a linha REAL da fila — quem subiu para o P1/P2 aparece também como lugar vago no card de origem
const linhaDe = (nome) => [...document.querySelectorAll('[data-slot="ordem-linha"] [data-slot="ordem-nome"]')]
  .find((el) => el.textContent === nome).closest('[data-slot="ordem-linha"]')
const seloDe = (linha) => linha.querySelector('[data-slot="ordem-selo"]')?.textContent
const trabalhando = (rotulo) =>
  screen.getByRole('heading', { name: rotulo }).closest('section').querySelector('[data-slot="trabalhando-total"]')?.textContent

beforeEach(() => {
  vi.clearAllMocks()
  usuario.atual = GIOVANA
  bancoObs.linhas = []
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
    for (const n of ['Eduardo Savoldi', 'Erlei Perini', 'Nathalia Fernandes']) {
      expect(within(cons).getByText(n)).toBeInTheDocument()
    }
  })

  it('a tela mostra primeiro + último do cadastro, como a escala cirúrgica (dono 26/09)', async () => {
    render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(nomesDoBloco('HRO').length).toBe(20))
    const exibido = (legenda) =>
      [...document.querySelectorAll('[data-slot="ordem-nome"]')].find((el) => el.dataset.legenda === legenda)?.textContent
    // a legenda impressa traz só um nome — "COSTA" e "GABRIEL" (Gabriel Costa) confundiam
    expect(exibido('COSTA')).toBe('Marcos Costa')
    expect(exibido('MELO')).toBe('Guilherme Melo')
    expect(exibido('GUILHERME D')).toBe('Guilherme Xavier')
    // dupla: só o primeiro nome de cada um (dono 27/09) — com sobrenome cortava a 430px
    expect(exibido('HUMBERTO / ROBERTA')).toBe('Humberto / Roberta')
    // acento na tela, embora a legenda e o cadastro venham sem (dono 27/09)
    expect(exibido('JOAO RICARDO')).toBe('João Moreira')
    expect(exibido('MAURICIO')).toBe('Maurício Bastos')
  })

  it('quem está de férias FICA na posição, marcado — não é excluído', async () => {
    render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(deFerias().length).toBeGreaterThan(0))

    // 3 no HRO + 1 no Materno + 1 no consultório
    expect(deFerias()).toHaveLength(5)
    const linhaKarine = linhaDe('Karine Bedin')
    expect(linhaKarine.dataset.situacao).toBe('ferias')
    expect(seloDe(linhaKarine)).toBe('férias')
    expect(linhaKarine.textContent).toContain('18')
    // a posição do quadro é preservada: KARINE é a 8ª da manhã do HRO
    expect(nomesDoBloco('HRO')[7]).toBe('KARINE')
    expect(nomesDoBloco('HRO')).toHaveLength(20)
  })

  it('a marca vale para o MATERNO e para o CONSULTÓRIO, não só para os hospitais da fila', async () => {
    render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(deFerias()).toHaveLength(5))

    // Materno: CURY (24) fica na posição dele, marcado
    const materno = screen.getByRole('heading', { name: 'Materno' }).closest('section')
    expect(within(materno).getByText('Marcos Cury').closest('[data-slot="ordem-linha"]').dataset.situacao).toBe('ferias')
    expect(nomesDoBloco('Materno')).toEqual(['CURY', 'RAQUEL'])

    // Consultório: fica fora da fila, mas ERLEI (25) também aparece marcado
    const cons = screen.getByRole('heading', { name: 'Consultório' }).closest('section')
    const chips = [...cons.querySelectorAll('[data-slot="consultorio-chip"]')]
    expect(chips).toHaveLength(3)
    const chip = (nome) => chips.find((c) => c.textContent.includes(nome))
    expect(chip('Erlei Perini').dataset.situacao).toBe('ferias')
    expect(chip('Erlei Perini').textContent).toContain('férias')
    expect(chip('Eduardo Savoldi').dataset.situacao).toBeUndefined()
  })

  it('THAYNA está de férias em outro dia e NÃO é marcada em 03/09', async () => {
    render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(deFerias()).toHaveLength(5))
    const linhaThayna = linhaDe('Thayna Santos')
    expect(linhaThayna.dataset.situacao).toBeUndefined()
    expect(seloDe(linhaThayna)).toBeUndefined()
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
    expect(deFerias()).toHaveLength(0)
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
    expect(nomesFds()[0]).toBe('João Henrique Salvão Vanni')
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
    expect(document.querySelectorAll('[data-situacao="noite"], [data-situacao="pos"]')).toHaveLength(0)

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
    expect(screen.getAllByText('Janaína Favorito')).toHaveLength(2)
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
    // …mas o POSTO fica no selo, para a 2ª posição não parecer arbitrária — e a linha NÃO é
    // pintada, porque eles trabalham (dono 07/10: pintada = fora do turno)
    expect(linhaDe('Rômulo Roxo').dataset.situacao).toBe('noite')
    expect(seloDe(linhaDe('Rômulo Roxo'))).toBe('P1')
    expect(seloDe(linhaDe('Klisman Hilleshein'))).toBe('P2')
    expect(linhaDe('Rômulo Roxo').className).not.toMatch(/bg-category/)
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
    expect(linhaDe('Rômulo Roxo').dataset.situacao).toBe('pos')
    expect(seloDe(linhaDe('Rômulo Roxo'))).toBe('pós P1')
    expect(seloDe(linhaDe('Klisman Hilleshein'))).toBe('pós P2')
    expect(linhaDe('Klisman Hilleshein').className).toMatch(/bg-category-indigo-bg/)
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

describe('Escala Numérica — imprimir (dono 25/09: o turno ou o dia)', () => {
  const folha = () => document.querySelector('.folha-numerica')
  const turnosDaFolha = () => [...folha().querySelectorAll('h3')].map((h) => h.textContent)
  const abrirMenu = () => fireEvent.click(screen.getByRole('button', { name: 'Imprimir a escala numérica' }))

  beforeEach(() => {
    vi.setSystemTime(new Date('2026-09-04T10:00:00-03:00')) // sexta, com pós-plantão da noite de 03/09
    window.print = vi.fn()
  })

  it('"O dia inteiro" põe manhã e tarde na mesma folha, com as marcas da tela, e abre a impressão', async () => {
    render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(nomesDoBloco('HRO')[1]).toBe('ROMULO'))
    expect(folha()).toBeNull() // a folha só existe enquanto imprime

    abrirMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: /O dia inteiro/ }))
    await waitFor(() => expect(window.print).toHaveBeenCalledTimes(1))

    expect(turnosDaFolha()).toEqual(['Manhã', 'Tarde'])
    const [manha, tarde] = folha().querySelectorAll('.fn-turno')
    const linha = (turno, nome) => [...turno.querySelectorAll('.fn-linha')].find((l) => l.querySelector('.fn-nome').textContent === nome)
    // manhã: o Romulo na 2ª do HRO com o posto; tarde: marcado como pós plantão. Folha = nome
    // da tela (dono 27/09); no dia inteiro o selo é o curto, porque a folha é deitada (07/10)
    const romuloManha = linha(manha, 'Rômulo Roxo')
    expect(romuloManha.querySelector('.fn-posicao').textContent).toBe('2')
    expect(romuloManha.classList.contains('fn-noite')).toBe(true)
    expect(romuloManha.querySelector('.fn-selo').textContent).toBe('P1 · noite')
    expect(linha(tarde, 'Rômulo Roxo').classList.contains('fn-pos-plantao')).toBe(true)
    expect(linha(tarde, 'Rômulo Roxo').querySelector('.fn-selo').textContent).toBe('pós P1')
    expect(linha(tarde, 'Klisman Hilleshein').querySelector('.fn-selo').textContent).toBe('pós P2')
    // sem quadro de "quem está fora" no topo (dono 07/10: "não quero esse resumo")
    expect(folha().querySelector('.fn-resumo')).toBeNull()
    expect(folha().textContent).not.toMatch(/plantão da noite · \d/)

    // fechou o diálogo: a folha sai do DOM
    window.dispatchEvent(new Event('afterprint'))
    await waitFor(() => expect(folha()).toBeNull())
  })

  it('"Só a tarde" imprime o turno que está na tela, e o rótulo acompanha o seletor', async () => {
    render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Unimed' })).toBeInTheDocument())
    abrirMenu()
    expect(screen.getByRole('menuitem', { name: /Só a manhã/ })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })

    fireEvent.click(screen.getByRole('tab', { name: 'Tarde' }))
    await waitFor(() => expect(posPlantao()).toHaveLength(2))
    abrirMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: /Só a tarde/ }))
    await waitFor(() => expect(window.print).toHaveBeenCalled())
    expect(turnosDaFolha()).toEqual(['Tarde'])
    // HRO · Unimed · Materno + Consultório
    expect([...folha().querySelectorAll('h4')].map((h) => h.firstChild.textContent.trim()))
      .toEqual(['HRO', 'Unimed', 'Materno', 'Consultório'])
  })

  it('no fim de semana não há o que imprimir da numérica — o botão não aparece', async () => {
    vi.setSystemTime(new Date('2026-09-05T10:00:00-03:00'))
    render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(pns().length).toBeGreaterThan(0))
    expect(screen.queryByRole('button', { name: 'Imprimir a escala numérica' })).toBeNull()
  })
})

describe('Escala Numérica — folha impressa sem "fora da fila" (dono 25/09)', () => {
  it('o Consultório sai só com o título na folha', async () => {
    vi.setSystemTime(new Date('2026-09-04T10:00:00-03:00'))
    window.print = vi.fn()
    render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Unimed' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir a escala numérica' }))
    fireEvent.click(screen.getByRole('menuitem', { name: /O dia inteiro/ }))
    await waitFor(() => expect(window.print).toHaveBeenCalled())
    const folha = document.querySelector('.folha-numerica')
    expect([...folha.querySelectorAll('h4')].some((h) => h.textContent.trim() === 'Consultório')).toBe(true)
    expect(folha.textContent).not.toContain('fora da fila')
  })
})

/**
 * Dono 07/10: "abaixo das listas do HRO e Unimed quero a quantidade de pessoas trabalhando
 * naquele hospital naquele turno (excluir: pessoas em férias, pós plantão)". A conta é a das
 * linhas pintadas — a mesma regra (`situacao.js`) pinta e conta.
 */
describe('Escala Numérica — quantos trabalham no turno (dono 07/10)', () => {
  const pintadasEm = (rotulo) =>
    screen.getByRole('heading', { name: rotulo }).closest('section')
      .querySelectorAll('[data-slot="ordem-linha"][data-situacao="ferias"], [data-slot="ordem-linha"][data-situacao="pos"]').length

  it('manhã de 03/09: HRO 20 na lista com 3 de férias = 17 trabalhando; o Materno não conta', async () => {
    render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(deFerias()).toHaveLength(5))
    expect(trabalhando('HRO')).toBe('17')
    expect(trabalhando('Unimed')).toBe(String(nomesDoBloco('Unimed').length - pintadasEm('Unimed')))
    expect(trabalhando('Materno')).toBeUndefined()
  })

  it('tarde de 04/09: o pós-plantão sai da conta; de manhã, quem veio da noite ENTRA nela', async () => {
    vi.setSystemTime(new Date('2026-09-04T10:00:00-03:00'))
    render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(nomesDoBloco('HRO')[1]).toBe('ROMULO'))
    // manhã: Romulo (P1) trabalha na 2ª do HRO — não é pintado e conta
    expect(trabalhando('HRO')).toBe(String(nomesDoBloco('HRO').length - pintadasEm('HRO')))
    expect(linhaDe('Rômulo Roxo').dataset.situacao).toBe('noite')

    fireEvent.click(screen.getByRole('tab', { name: 'Tarde' }))
    await waitFor(() => expect(posPlantao()).toHaveLength(2))
    // à tarde os dois estão na Unimed, pintados e fora da conta
    const uni = nomesDoBloco('Unimed')
    expect(pintadasEm('Unimed')).toBeGreaterThanOrEqual(2)
    expect(trabalhando('Unimed')).toBe(String(uni.length - pintadasEm('Unimed')))
    const rodape = screen.getByRole('heading', { name: 'Unimed' }).closest('section').querySelector('[data-slot="trabalhando"]')
    expect(rodape.textContent).toContain('Trabalhando à tarde')
    expect(rodape.textContent).toContain('pós-plantão')
  })
})

describe('Escala Numérica — folha A4 colorida (dono 07/10)', () => {
  const folha = () => document.querySelector('.folha-numerica')
  const imprimir = async (item) => {
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir a escala numérica' }))
    fireEvent.click(screen.getByRole('menuitem', { name: item }))
    await waitFor(() => expect(window.print).toHaveBeenCalled())
  }
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-09-04T10:00:00-03:00'))
    window.print = vi.fn()
  })
  afterEach(() => window.dispatchEvent(new Event('afterprint')))

  it('o dia inteiro sai numa A4 DEITADA, e cada turno leva Materno e Consultório com título', async () => {
    render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(nomesDoBloco('HRO')[1]).toBe('ROMULO'))
    await imprimir(/O dia inteiro/)
    expect(folha().classList.contains('fn-dia')).toBe(true)
    expect(folha().querySelector('style').textContent).toMatch(/size: A4 landscape/)
    for (const turno of folha().querySelectorAll('.fn-turno')) {
      const titulos = [...turno.querySelectorAll('h4')].map((h) => h.firstChild.textContent.trim())
      expect(titulos).toEqual(['HRO', 'Unimed', 'Materno', 'Consultório'])
      // "trabalhando" só abaixo do HRO e da Unimed
      expect(turno.querySelectorAll('.fn-trabalhando')).toHaveLength(2)
    }
    expect(folha().textContent).toContain('sexta, 04/09/2026') // papel guardado leva o ano
  })

  it('um turno sai numa A4 em pé, com a mesma conta da tela', async () => {
    render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(nomesDoBloco('HRO')[1]).toBe('ROMULO'))
    const naTela = trabalhando('HRO')
    await imprimir(/Só a manhã/)
    expect(folha().classList.contains('fn-um-turno')).toBe(true)
    expect(folha().querySelector('style').textContent).toMatch(/size: A4 portrait/)
    const hro = [...folha().querySelectorAll('.fn-coluna')].find((s) => s.querySelector('h4').firstChild.textContent === 'HRO')
    expect(hro.querySelector('.fn-trabalhando b').textContent).toBe(naTela)
  })
})

/**
 * Dono 07/10: "João Moreira é [da manhã] no Materno, mas está como 2º da manhã na Unimed por ser
 * o P2 — quero que informe que a posição original seria no Materno no card do Materno (para
 * evitar confusão)". O card de onde a pessoa saiu mostra o LUGAR VAGO onde ela estaria, sem
 * número e fora da conta.
 */
describe('Escala Numérica — lugar vago de quem subiu para o P1/P2 (dono 07/10)', () => {
  const vagas = (rotulo) => [...screen.getByRole('heading', { name: rotulo }).closest('section').querySelectorAll('[data-slot="ordem-vaga"]')]
  const ordemComVagas = (rotulo) => [...screen.getByRole('heading', { name: rotulo }).closest('section')
    .querySelectorAll('[data-slot="ordem-linha"] [data-slot="ordem-nome"], [data-slot="ordem-vaga"]')].map((el) => el.dataset.legenda)

  it('08/10: o JOAO RICARDO sai do Materno para a 2ª da Unimed — o Materno mostra o lugar dele', async () => {
    vi.setSystemTime(new Date('2026-10-08T10:00:00-03:00'))
    render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(nomesDoBloco('Unimed')[1]).toBe('JOAO RICARDO'))

    // no Materno: a Giovana na fila, e o lugar do João Ricardo onde a numérica o põe (1º)
    expect(nomesDoBloco('Materno')).toEqual(['GIOVANA'])
    expect(ordemComVagas('Materno')).toEqual(['JOAO RICARDO', 'GIOVANA'])
    const [vaga] = vagas('Materno')
    expect(vaga.textContent).toContain('João Moreira')
    expect(vaga.textContent).toContain('P2')
    expect(vaga.title).toContain('Unimed') // o hospital vai por extenso no title
    // o cabeçalho conta só quem está na lista
    const materno = screen.getByRole('heading', { name: 'Materno' }).closest('section')
    expect(within(materno).getByText('1 nome')).toBeInTheDocument()

    // o P1 (Gabriel Costa) saiu da Unimed para o HRO: a Unimed mostra o lugar dele, e a conta
    // de quem trabalha na Unimed não inclui esse lugar
    expect(nomesDoBloco('HRO')[1]).toBe('GABRIEL')
    expect(vagas('Unimed').map((v) => v.dataset.legenda)).toEqual(['GABRIEL'])
    expect(vagas('HRO')).toHaveLength(0) // quem chegou não deixa vaga onde chegou
    expect(trabalhando('Unimed')).toBe(String(nomesDoBloco('Unimed').length - deFerias().filter((l) => l.closest('section') === screen.getByRole('heading', { name: 'Unimed' }).closest('section')).length))
  })

  it('04/09: quem sobe DENTRO do próprio hospital não deixa lugar vago (o Klisman segue à vista no card)', async () => {
    vi.setSystemTime(new Date('2026-09-04T10:00:00-03:00'))
    render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(nomesDoBloco('HRO')[1]).toBe('ROMULO'))
    // Romulo saiu da Unimed (era o 9º) para o HRO: um lugar vago na Unimed, o dele
    expect(vagas('Unimed').map((v) => v.dataset.legenda)).toEqual(['ROMULO'])
    expect(ordemComVagas('Unimed').indexOf('ROMULO')).toBe(8)
    // e à tarde ninguém sobe: nenhum lugar vago
    fireEvent.click(screen.getByRole('tab', { name: 'Tarde' }))
    await waitFor(() => expect(posPlantao()).toHaveLength(2))
    expect(document.querySelectorAll('[data-slot="ordem-vaga"]')).toHaveLength(0)
  })

  it('a folha impressa mostra o mesmo lugar vago, fora da conta', async () => {
    vi.setSystemTime(new Date('2026-10-08T10:00:00-03:00'))
    window.print = vi.fn()
    render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(nomesDoBloco('Unimed')[1]).toBe('JOAO RICARDO'))
    const naTela = trabalhando('Unimed')
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir a escala numérica' }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Só a manhã/ }))
    await waitFor(() => expect(window.print).toHaveBeenCalled())
    const folha = document.querySelector('.folha-numerica')
    const coluna = (t) => [...folha.querySelectorAll('.fn-coluna')].find((s) => s.querySelector('h4').firstChild.textContent === t)
    const materno = coluna('Materno')
    expect(materno.querySelector('h4').textContent).toContain('1 nome')
    expect(materno.querySelector('h4').textContent).not.toContain('1 nomes')
    expect(materno.querySelector('.fn-vaga').textContent).toContain('João Moreira')
    expect(materno.querySelector('.fn-vaga').textContent).toContain('Unimed P2')
    expect(coluna('Unimed').querySelector('.fn-trabalhando b').textContent).toBe(naTela)
    window.dispatchEvent(new Event('afterprint'))
  })
})

/**
 * Dono 07/10: licença no Pega Plantão ("LICENÇA SAÚDE") sai da conta de quem trabalha e aparece
 * como "ausente" — nunca o motivo, que é dado de saúde (LGPD). Casos reais: Raquel Schneider em
 * 03/09 (Materno) e Giovana Noll em 18/09 (17ª da Unimed de manhã).
 */
describe('Escala Numérica — licença aparece como "ausente" e sai da conta (dono 07/10)', () => {
  const linhaPorLegenda = (legenda) => document.querySelector(`[data-slot="ordem-linha"] [data-slot="ordem-nome"][data-legenda="${legenda}"]`)?.closest('[data-slot="ordem-linha"]')

  it('18/09: Giovana de licença fica na posição, marcada "ausente", e a Unimed conta um a menos', async () => {
    vi.setSystemTime(new Date('2026-09-18T10:00:00-03:00'))
    render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(linhaPorLegenda('GIOVANA')?.dataset.situacao).toBe('ausente'))
    const giovana = linhaPorLegenda('GIOVANA')
    expect(seloDe(giovana)).toBe('ausente')
    expect(nomesDoBloco('Unimed')[16]).toBe('GIOVANA') // continua na 17ª
    const uni = screen.getByRole('heading', { name: 'Unimed' }).closest('section')
    const fora = uni.querySelectorAll('[data-slot="ordem-linha"][data-situacao="ferias"], [data-slot="ordem-linha"][data-situacao="ausente"], [data-slot="ordem-linha"][data-situacao="pos"]').length
    expect(fora).toBeGreaterThanOrEqual(1)
    expect(trabalhando('Unimed')).toBe(String(nomesDoBloco('Unimed').length - fora))
    expect(uni.querySelector('[data-slot="trabalhando"]').textContent).toContain('1 ausente')
    // LGPD: o motivo nunca aparece
    expect(document.body.textContent).not.toMatch(/licen[çc]a|sa[úu]de/i)
  })

  it('03/09: a licença marca também no Materno, sem mexer nas férias do dia', async () => {
    render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(deFerias()).toHaveLength(5))
    expect(linhaPorLegenda('RAQUEL').dataset.situacao).toBe('ausente')
    expect(linhaPorLegenda('CURY').dataset.situacao).toBe('ferias')
  })
})

describe('Escala Numérica — observações embaixo de cada card (dono 08/10)', () => {
  const ESCRITOR = { uid: 'uid-gui', displayName: 'Guilherme Melo', role: 'anestesiologista' }
  const card = (rotulo) => screen.getByRole('heading', { name: rotulo }).closest('section')
  const nota = (turno, hospital, texto) => ({ turno, hospital, texto, autorNome: 'GUILHERME SOUZA MELO', atualizadoEm: '2026-10-08T13:42:00Z' })
  beforeEach(() => vi.setSystemTime(new Date('2026-10-08T10:00:00-03:00')))

  it('quem só lê vê a anotação do turno com autor e hora, sem botão; card sem anotação fica como era', async () => {
    bancoObs.linhas = [nota('matutino', 'hro', 'Sala 5 bloqueada até as 10h.')]
    render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(within(card('HRO')).getByText('Sala 5 bloqueada até as 10h.')).toBeInTheDocument())
    expect(listarObservacoes).toHaveBeenCalledWith('2026-10-08')
    expect(within(card('HRO')).getByText('Guilherme Melo · 10:42')).toBeInTheDocument()
    expect(document.querySelectorAll('[data-slot="observacao"]')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /observação:/ })).toBeNull()
  })

  it('é POR TURNO: a da manhã não aparece à tarde, e a da tarde só à tarde', async () => {
    bancoObs.linhas = [nota('matutino', 'hro', 'Só de manhã.'), nota('vespertino', 'consultorio', 'Só à tarde.')]
    render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(screen.getByText('Só de manhã.')).toBeInTheDocument())
    expect(screen.queryByText('Só à tarde.')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Tarde' }))
    await waitFor(() => expect(within(card('Consultório')).getByText('Só à tarde.')).toBeInTheDocument())
    expect(screen.queryByText('Só de manhã.')).toBeNull()
    expect(listarObservacoes).toHaveBeenCalledTimes(1) // um dia = uma leitura, os dois turnos
  })

  it('quem opera a escala escreve: o campo avisa que todo o grupo vê e que vai para o papel', async () => {
    usuario.atual = ESCRITOR
    render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
    fireEvent.click(await screen.findByRole('button', { name: 'Escrever observação: Materno' }))
    const campo = screen.getByRole('textbox', { name: 'Observações: Materno' })
    // LGPD (revisão 08/10): o aviso é a única barreira contra motivo de afastamento no texto livre
    expect(card('Materno').textContent).toMatch(/Todo o grupo vê, e sai na folha impressa/)
    expect(card('Materno').textContent).toMatch(/sem motivo de afastamento nem dado de paciente/)
    fireEvent.change(campo, { target: { value: '  Giovana sai às 11h.  ' } })
    fireEvent.click(within(card('Materno')).getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(within(card('Materno')).getByText('Giovana sai às 11h.')).toBeInTheDocument())
    expect(salvarObservacao).toHaveBeenCalledWith(
      { turno: 'matutino', hospital: 'materno', texto: '  Giovana sai às 11h.  ', data: '2026-10-08' },
      expect.objectContaining({ userId: 'uid-gui' })
    )
    await waitFor(() => expect(listarObservacoes.mock.calls.length).toBeGreaterThanOrEqual(2)) // relê: o autor vem do banco
    expect(within(card('Materno')).getByRole('button', { name: 'Editar observação: Materno' })).toBeInTheDocument()
    // os outros cards seguem só com o "+ Observação"
    for (const rotulo of ['HRO', 'Unimed', 'Consultório']) {
      expect(within(card(rotulo)).getByRole('button', { name: `Escrever observação: ${rotulo}` })).toBeInTheDocument()
    }
  })

  it('apagar é salvar vazio: o card volta ao "+ Observação"', async () => {
    usuario.atual = ESCRITOR
    bancoObs.linhas = [nota('matutino', 'unimed', 'Vai sumir.')]
    render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
    fireEvent.click(await screen.findByRole('button', { name: 'Editar observação: Unimed' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Observações: Unimed' }), { target: { value: '' } })
    fireEvent.click(within(card('Unimed')).getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(within(card('Unimed')).getByRole('button', { name: 'Escrever observação: Unimed' })).toBeInTheDocument())
    expect(salvarObservacao).toHaveBeenCalledWith(expect.objectContaining({ hospital: 'unimed', texto: '' }), expect.anything())
    expect(screen.queryByText('Vai sumir.')).toBeNull()
  })

  it('falha ao gravar: avisa e o campo continua aberto com o que foi digitado', async () => {
    usuario.atual = ESCRITOR
    salvarObservacao.mockRejectedValueOnce(new Error('rede'))
    render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
    fireEvent.click(await screen.findByRole('button', { name: 'Escrever observação: HRO' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Observações: HRO' }), { target: { value: 'Não perder.' } })
    fireEvent.click(within(card('HRO')).getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(screen.getByText(/Não foi possível salvar a observação/)).toBeInTheDocument())
    expect(screen.getByRole('textbox', { name: 'Observações: HRO' }).value).toBe('Não perder.')
  })

  it('leitura falhou: ninguém escreve às cegas (apagaria a anotação de outro) e a tela avisa', async () => {
    usuario.atual = ESCRITOR
    listarObservacoes.mockRejectedValueOnce(new Error('rede'))
    render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
    await waitFor(() => expect(screen.getByText(/Não foi possível carregar as observações/)).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /Escrever observação/ })).toBeNull()
  })

  describe('folha impressa', () => {
    const folha = () => document.querySelector('.folha-numerica')
    const imprimir = async (item) => {
      fireEvent.click(screen.getByRole('button', { name: 'Imprimir a escala numérica' }))
      fireEvent.click(screen.getByRole('menuitem', { name: item }))
      await waitFor(() => expect(window.print).toHaveBeenCalled())
    }
    const colunaDe = (turno, titulo) => [...turno.querySelectorAll('.fn-coluna')]
      .find((c) => c.querySelector('h4').firstChild.textContent.trim() === titulo)
    beforeEach(() => { window.print = vi.fn() })
    afterEach(() => window.dispatchEvent(new Event('afterprint')))

    it('a anotação sai embaixo da coluna dela, em cada turno; a folha aperta as linhas para seguir em 1 página', async () => {
      bancoObs.linhas = [nota('matutino', 'hro', 'Sala 5 bloqueada.'), nota('vespertino', 'consultorio', 'Sem consultório à tarde.')]
      render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
      await waitFor(() => expect(screen.getByText('Sala 5 bloqueada.')).toBeInTheDocument())
      await imprimir(/O dia inteiro/)
      const [manha, tarde] = folha().querySelectorAll('.fn-turno')
      expect(colunaDe(manha, 'HRO').querySelector('.fn-obs').textContent).toBe('ObservaçõesSala 5 bloqueada.')
      expect(colunaDe(tarde, 'Consultório').querySelector('.fn-obs p').textContent).toBe('Sem consultório à tarde.')
      expect(folha().querySelectorAll('.fn-obs')).toHaveLength(2) // só onde há texto
      expect(folha().classList.contains('fn-aperto-1')).toBe(true)
      expect(folha().textContent).not.toContain('Melo · ') // o papel não leva o autor
    })

    it('sem observação a folha sai igual à de antes; com 300 caracteres em todo card, o aperto máximo', async () => {
      render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
      await waitFor(() => expect(screen.getAllByText(/Linha pintada/).length).toBeGreaterThan(0))
      await imprimir(/Só a manhã/)
      expect(folha().querySelector('.fn-obs')).toBeNull()
      expect(folha().className).not.toMatch(/fn-aperto/)
    })

    it('com 300 caracteres em todos os cards, o aperto máximo (conferido em PDF: 1 página)', async () => {
      const longo = 'x'.repeat(300)
      bancoObs.linhas = ['hro', 'unimed', 'materno', 'consultorio'].map((h) => nota('matutino', h, longo))
      render(<EscalaNumericaPage goBack={() => {}} />, { wrapper: wrap })
      await waitFor(() => expect(document.querySelectorAll('[data-slot="observacao-texto"]')).toHaveLength(4))
      await imprimir(/Só a manhã/)
      expect(folha().classList.contains('fn-aperto-3')).toBe(true)
      expect(folha().querySelectorAll('.fn-obs')).toHaveLength(4)
    })
  })
})

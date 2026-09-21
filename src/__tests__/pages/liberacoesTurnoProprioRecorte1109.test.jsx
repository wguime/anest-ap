/**
 * RECORTE REAL — HRO, tarde de 11/09/2026, 18h09 (a foto que o dono mandou duas
 * vezes: "próximo a ser liberado está errado na escala, corrija" e, dois dias
 * depois, "verifique e corrija o motivo dessa inconsistência").
 *
 * O que a tela mostrava: 5º–15º liberados, Louise (4ª) em sala com "Turno até
 * 19:00 · sai fora da ordem", e o cartão amarelo "Próximo a ser liberado" no 3º
 * do rodapé (Guilherme Melo, IOSC, 22 min de tempo total). A marca de turno
 * próprio da manhã tirava a Louise da fila inteira (`naFila` → false), e "sair
 * fora da ordem" tinha virado "ser pulada": o 3º passava na frente da 4ª.
 *
 * Este arquivo monta a `LiberacoesView` com a escala PUBLICADA daquele turno
 * (ordem, casos com os status das 18h09, liberações, overrides) e trava as duas
 * metades da regra corrigida em ef988341:
 *   1. ela SEGUE na ordem — quando a fila chega nela, o amarelo é dela e quem
 *      está acima é recusado ("Libere Louise Warnava primeiro");
 *   2. ela PODE sair fora da ordem — com os de baixo ainda em sala, o toque
 *      nela passa, e só nela.
 *
 * ⚠️ Reproduzido com dados reais antes de afirmar o conserto (regra da casa):
 * o painel de 3 nomes prova a mecânica; este recorte prova a tela que o dono viu.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import LiberacoesView from '@/pages/escala-cirurgica/LiberacoesView'

// os 15 do rodapé da tarde + a Raquel (assumiu as cirurgias do Staub no IOSC)
const ROSTER = [
  ['u-giovana', 'GIOVANA NOLL', ['GIOVANA']],
  ['u-joaor', 'JOÃO RICARDO MOREIRA', ['JOAO RICARDO']],
  ['u-melo', 'GUILHERME MELO', ['GUILHERME MELO', 'MELO']],
  ['u-louise', 'LOUISE WARNAVA', ['LOUISE']],
  ['u-cristina', 'CRISTINA BERTOL BARBOSA MARCON', ['CRISTINA']],
  ['u-gabriela', 'GABRIELA VEDANA', ['GABRIELA']],
  ['u-leo', 'LEONARDO FERRAZZO', ['LEONARDO']],
  ['u-rafael', 'RAFAEL PELISSARO', ['RAFAEL', 'PELISSARO']],
  ['u-fernanda', 'FERNANDA CADILLO', ['FERNANDA']],
  ['u-rodnei', 'RODNEI GOMES', ['RODNEI']],
  ['u-staub', 'GUILHERME JONCK STAUB', ['STAUB']],
  ['u-adriano', 'ADRIANO SILVA', ['ADRIANO']],
  ['u-klisman', 'KLISMAN SOUZA', ['KLISMAN']],
  ['u-paulo', 'PAULO TONINI', ['PAULO']],
  ['u-joaoh', 'JOÃO HENRIQUE LIMA', ['JOAO HENRIQUE']],
  ['u-raquel', 'RAQUEL SCHNEIDER FELICIANI', ['RAQUEL']],
].map(([uid, nome, apelidos]) => ({ uid, nome, apelidos }))
const APELIDO_UID = Object.fromEntries(ROSTER.flatMap((r) => r.apelidos.map((a) => [a, r.uid])))

vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    roster: ROSTER,
    rosterByUid: new Map(ROSTER.map((r) => [r.uid, r])),
    options: ROSTER.map((r) => ({ value: r.uid, label: r.nome })),
    aliases: [], loading: false,
    resolver: (nome) => APELIDO_UID[String(nome || '').trim().toUpperCase()] || null,
    upsertAlias: vi.fn(), refresh: vi.fn(), removeAlias: vi.fn(),
  }),
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({
  default: { reservarAvisoTempo: vi.fn(async () => false), fetchLocaisHospital: vi.fn(async () => []) },
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>

let seq = 0
const caso = (sala, hora, anestesista, cirurgiao, statusCirurgia, extra = {}) => ({
  id: `c${++seq}`, sala, ordem: seq, hora, anestesista, cirurgiao, statusCirurgia,
  turno: 'vespertino', tipo: 'eletiva', bloco: 'normal', isContinuacao: false, semAnestesista: false, ...extra,
})

// ordem publicada da tarde (rodapé do HRO, 11/09) — Giovana plantonista, João Henrique contraturno
const ORDEM = ['GIOVANA', 'JOAO RICARDO', 'GUILHERME MELO', 'LOUISE', 'CRISTINA', 'GABRIELA', 'LEONARDO',
  'RAFAEL', 'FERNANDA', 'RODNEI', 'STAUB', 'ADRIANO', 'KLISMAN', 'PAULO', 'JOAO HENRIQUE']

// os casos como estavam às 18h09 (a última do Melo só terminou às 18h09m39)
const CASOS = [
  caso('Sala 1', '13:00', 'CRISTINA', 'Mateus Baptistella', 'terminada'),
  caso('Sala 1', 'AS', 'CRISTINA', 'Mateus Baptistella', 'terminada'),
  caso('Sala 1', 'AS', 'CRISTINA', 'Mateus Baptistella', 'agendada'),
  caso('Sala 2', '13:00', 'KLISMAN', 'Mauricio Sanagiotto', 'iniciada'),
  caso('Sala 3', '13:00', 'LEONARDO', 'Eduardo Martinelli', 'terminada'),
  caso('Sala 4', '13:00', 'GIOVANA', 'Gracieli Paludo', 'terminada'),
  caso('Sala 4', 'AS', 'GIOVANA', 'Gracieli Paludo', 'agendada'),
  caso('Sala 4', 'AS', 'GIOVANA', 'Gracieli Paludo', 'agendada'),
  caso('Sala 4', 'AS', 'GIOVANA', 'Gracieli Paludo', 'agendada'),
  caso('Sala 6', '13:00', 'LOUISE', 'Amauri Biazi', 'terminada'),
  caso('Sala 6', 'AS', 'LOUISE', 'Amauri Biazi', 'iniciada'),
  caso('Sala 6', 'AS', 'LOUISE', 'Amauri Biazi', 'agendada'),
  caso('Sala 6', 'AS', 'LOUISE', 'Amauri Biazi', 'agendada'),
  caso('Sala 6', 'AS', 'LOUISE', 'Amauri Biazi', 'agendada'),
  caso('Sala 8', '13:00', 'GABRIELA', 'Carlos Fogaca', 'terminada'),
  caso('Sala 8', 'AS', 'GABRIELA', 'Carlos Fogaca', 'agendada'),
  caso('Sala 9', '13:00', 'ADRIANO', 'Samuel Banaszeski', 'terminada'),
  caso('Sala 9', 'AS', 'ADRIANO', 'Samuel Banaszeski', 'iniciada'),
  caso('Sala 5', '13:00', 'LEONARDO', 'Jamile/ Jorge P.', 'terminada', { tipo: 'urgencia' }),
  caso('Sala 7', '13:00', 'PAULO', 'Plantão CO', 'agendada', { tipo: 'urgencia' }),
  caso('Exames', '13:30', 'PELISSARO', 'Fernanda', 'agendada'),
  caso('IOSC', '13:30', 'RAQUEL', 'Rafael Tirapelle', 'terminada', { bloco: 'iosc' }),
  caso('IOSC', 'AS', 'RAQUEL', 'Guilherme Dalul', 'terminada', { bloco: 'iosc' }),
  caso('IOSC', '13:30', 'JOAO RICARDO', 'Tainara Schulhan', 'iniciada', { bloco: 'iosc' }),
  caso('IOSC', '13:00', 'MELO', 'Mauricio Fabiani', 'terminada', { bloco: 'iosc' }),
  caso('IOSC', 'AS', 'MELO', 'Marcelo Pozzo', 'terminada', { bloco: 'iosc' }),
  caso('IOSC', 'AS', 'MELO', 'Marcelo Pozzo', 'iniciada', { bloco: 'iosc' }),
  caso('Hospital de Olhos', '16:00', 'RODNEI', 'Joao Artur', 'agendada', { bloco: 'ho' }),
  caso('Consultório', '13:30', 'FERNANDA', 'CONSULTORIO – AJUDA', 'agendada'),
]

const lib = (...uids) => Object.fromEntries(uids.map((u) => [`vespertino:${u}`, { liberadoEm: '2026-09-11T21:03:00Z' }]))
const OVERRIDES = {
  'vespertino:u-louise': { turnoProprio: { ate: '19:00' } },
  'vespertino:u-melo': { termino: '18:30' },
  // a Raquel assumiu o posto do Staub ("Definir anestesista", modo posições, às
  // 15h07): o slot 11 troca de identidade e ela NÃO vira linha extra no fim —
  // sem isto ela, com dois casos terminados no IOSC, roubaria o amarelo
  'vespertino:u-staub': {
    assumidaPor: {
      de: { uid: 'u-staub', nome: 'GUILHERME JONCK STAUB' }, uid: 'u-raquel', nome: 'RAQUEL SCHNEIDER FELICIANI',
      tipo: 'posicoes', casoIds: ['c22', 'c23'],
    },
  },
}
const escalaDe = (liberacoes) => ({
  id: 'c9830c61', hospital: 'hro', data: '2026-09-11',
  ordemLiberacao: { matutino: [], vespertino: ORDEM },
  ajudaExterna: { matutino: [], vespertino: [] },
  liberacoes, linhaOverrides: OVERRIDES, casos: CASOS,
})
// 18h09: os 10 liberados pelo toque (Klisman e Paulo às 15h24, Adriano 16h15,
// Staub 17h12, e seis de uma vez às 18h03); João Henrique fecha o rodapé sem
// cirurgia e nasce liberado pela cauda
const AS_18H09 = escalaDe(lib('u-klisman', 'u-paulo', 'u-adriano', 'u-staub', 'u-rodnei', 'u-fernanda',
  'u-rafael', 'u-leo', 'u-gabriela', 'u-cristina'))
// mais cedo na tarde: só o 10º–15º fora — Cristina, Gabriela, Leonardo, Rafael e Fernanda em sala
const MAIS_CEDO = escalaDe(lib('u-klisman', 'u-paulo', 'u-adriano', 'u-staub', 'u-rodnei'))

const montar = (escala, props = {}) => render(
  <LiberacoesView escala={escala} hospital="hro" hospitalLabel="HRO" turno="vespertino"
    canEdit onToggle={() => {}} onSetOverride={() => {}} presencaOutros={[]} {...props} />,
  { wrapper: wrap }
)
const card = (uid) => document.querySelector(`[data-linha="${uid}"]`)

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-09-11T18:09:00-03:00'))
})
afterAll(() => vi.useRealTimers())
beforeEach(() => vi.clearAllMocks())

describe('HRO 11/09 18h09 — a fila chegou na Louise (turno próprio, 4ª de 15)', () => {
  it('a tela é a da foto: 1º–4º em sala, 5º–15º liberados, João Henrique pela cauda', () => {
    montar(AS_18H09)
    const chaves = Array.from(document.querySelectorAll('[data-linha]')).map((e) => e.getAttribute('data-linha'))
    expect(chaves.slice(0, 4)).toEqual(['u-giovana', 'u-joaor', 'u-melo', 'u-louise'])
    for (const uid of ['u-cristina', 'u-gabriela', 'u-leo', 'u-rafael', 'u-fernanda', 'u-joaoh']) {
      expect(within(card(uid)).getByText('Liberado')).toBeTruthy()
    }
    for (const uid of ['u-giovana', 'u-joaor', 'u-melo', 'u-louise']) {
      expect(within(card(uid)).queryByText('Liberado')).toBeNull()
    }
  })

  it('o cartão amarelo é da LOUISE — não do 3º, que era o que a foto mostrava', () => {
    montar(AS_18H09)
    expect(within(card('u-louise')).getByText('Próximo a ser liberado')).toBeTruthy()
    expect(within(card('u-louise')).getByText(/Turno encerra às 19:00h/)).toBeTruthy()
    expect(within(card('u-melo')).queryByText('Próximo a ser liberado')).toBeNull()
    expect(screen.getAllByText('Próximo a ser liberado')).toHaveLength(1)
  })

  it('o 3º espera por ela: liberar Guilherme Melo com a Louise em sala é recusado', async () => {
    const onToggle = vi.fn()
    montar(AS_18H09, { onToggle })
    fireEvent.click(screen.getByLabelText('Marcar Guilherme Melo liberado'))
    expect(await screen.findByText('Libere Louise Warnava primeiro')).toBeTruthy()
    expect(await screen.findByText(/Falta 1 anestesista antes de Guilherme Melo/)).toBeTruthy()
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('e a Louise sai — o toque nela passa', async () => {
    const onToggle = vi.fn()
    montar(AS_18H09, { onToggle })
    fireEvent.click(screen.getByLabelText('Marcar Louise Warnava liberado'))
    await waitFor(() => expect(onToggle).toHaveBeenCalledTimes(1))
  })
})

describe('HRO 11/09 mais cedo — a fila ainda não chegou nela (5º–9º em sala)', () => {
  // ⚠️ MUDOU EM 21/09 (dono): "podem ser liberados a partir desses horários mesmo que
  // estejam no meio da lista". Às 18h09, antes das 19h, ela espera a vez como todo
  // mundo; o aviso diz a partir de quando o toque passa.
  it('antes das 19h o toque nela é recusado como para todo mundo — e o aviso diz a hora', async () => {
    const onToggle = vi.fn()
    montar(MAIS_CEDO, { onToggle })
    fireEvent.click(screen.getByLabelText('Marcar Louise Warnava liberado'))
    expect(await screen.findByText('Libere Fernanda Cadillo primeiro')).toBeTruthy()
    expect(await screen.findByText(/A partir das 19:00 Louise Warnava pode sair fora da ordem/)).toBeTruthy()
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('às 19h ela PODE sair fora da ordem: o toque nela passa mesmo com cinco abaixo em sala', async () => {
    vi.setSystemTime(new Date('2026-09-11T19:00:00-03:00'))
    try {
      const onToggle = vi.fn()
      montar(MAIS_CEDO, { onToggle })
      fireEvent.click(screen.getByLabelText('Marcar Louise Warnava liberado'))
      await waitFor(() => expect(onToggle).toHaveBeenCalledTimes(1))
    } finally {
      vi.setSystemTime(new Date('2026-09-11T18:09:00-03:00'))
    }
  })

  it('saiu às 19h com cinco em sala: o card dela desce para logo abaixo do "próximo", ainda como 4ª (dono 21/09)', () => {
    vi.setSystemTime(new Date('2026-09-11T19:02:00-03:00'))
    try {
      montar(escalaDe(lib('u-klisman', 'u-paulo', 'u-adriano', 'u-staub', 'u-rodnei', 'u-louise')))
      const chaves = Array.from(document.querySelectorAll('[data-linha]')).map((e) => e.getAttribute('data-linha'))
      // verdes até a Fernanda (próximo), Louise logo abaixo (vermelha), depois o bloco vermelho
      expect(chaves.indexOf('u-louise')).toBe(chaves.indexOf('u-fernanda') + 1)
      expect(chaves.slice(0, 3)).toEqual(['u-giovana', 'u-joaor', 'u-melo'])
      expect(within(card('u-fernanda')).getByText('Próximo a ser liberado')).toBeTruthy()
      expect(within(card('u-louise')).getByText('Liberado')).toBeTruthy()
      expect(within(card('u-louise')).getByText('4')).toBeTruthy()
      // ninguém verde abaixo dela: o padrão verde → amarelo → vermelho fica inteiro
      const depois = chaves.slice(chaves.indexOf('u-louise') + 1)
      for (const uid of depois) expect(within(card(uid)).getByText('Liberado')).toBeTruthy()
    } finally {
      vi.setSystemTime(new Date('2026-09-11T18:09:00-03:00'))
    }
  })

  it('só ela: o 3º continua preso à ordem, e o amarelo é de quem fecha a fila de verdade', async () => {
    const onToggle = vi.fn()
    montar(MAIS_CEDO, { onToggle })
    expect(within(card('u-louise')).queryByText('Próximo a ser liberado')).toBeNull()
    expect(within(card('u-fernanda')).getByText('Próximo a ser liberado')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Marcar Guilherme Melo liberado'))
    expect(await screen.findByText('Libere Fernanda Cadillo primeiro')).toBeTruthy()
    // a Louise CONTA na espera dele: Louise + Cristina + Gabriela + Leonardo + Rafael + Fernanda
    expect(await screen.findByText(/Faltam 6 anestesistas antes de Guilherme Melo/)).toBeTruthy()
    expect(onToggle).not.toHaveBeenCalled()
  })
})

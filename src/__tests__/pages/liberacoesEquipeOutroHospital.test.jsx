/**
 * EQUIPE DE OUTRO HOSPITAL — selo "Equipe até 13h/19h" (dono 21/09/2026).
 *
 * Recado do plantonista: "@Guilherme e @Cury Anest na equipe da Unimed no período
 * vespertino". Pela regra de 17/09 os dois entram no rodapé da Unimed como da casa
 * (não é ajuda, não é troca, não é turnoProprio — "até as 19h" é o FIM DO TURNO).
 * O que faltava era o card DIZER isso: "quando houver a informação que o anestesista
 * está em outro hospital no período da manhã ou vespertino quero que contenha o
 * badge: até as 13h (matutino) e até as 19h (vespertino)".
 *
 * A marca mora em `linha_overrides[<turno>:<chave>].naEquipe = { ate }` (gravada pela
 * publicação a partir do lote `{ tipo: 'equipe' }`, preservada na republicação). O
 * que estas travas protegem: o selo aparece com a hora do turno, só em quem tem a
 * marca, some no card enxuto do liberado, e a FILA não muda por causa dele (a pessoa
 * segue na ordem — o selo é informação, não regra).
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import LiberacoesView from '@/pages/escala-cirurgica/LiberacoesView'

const ROSTER = [
  ['u-staub', 'GUILHERME JONCK STAUB', ['STAUB']],
  ['u-louise', 'LOUISE WARNAVA', ['LOUISE']],
  ['u-costa', 'MARCOS COSTA', ['COSTA']],
  ['u-melo', 'GUILHERME MELO', ['GUILHERME MELO', 'MELO']],
  ['u-cury', 'MARCOS TADEU CURY', ['CURY']],
  ['u-gustavo', 'GUSTAVO BIESDORF', ['GUSTAVO']],
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
const caso = (sala, hora, anestesista, cirurgiao, statusCirurgia, turno = 'vespertino') => ({
  id: `c${++seq}`, sala, ordem: seq, hora, anestesista, cirurgiao, statusCirurgia,
  turno, tipo: 'eletiva', bloco: 'normal', isContinuacao: false, semAnestesista: false,
})

// rodapé da Unimed em 21/09 (recorte): Staub plantonista, Gustavo fecha (plantão da manhã)
const ORDEM = ['STAUB', 'LOUISE', 'COSTA', 'GUILHERME MELO', 'CURY', 'GUSTAVO']
const CASOS_TARDE = [
  caso('CC - Sala 10', '15:15', 'STAUB', 'Claudiomar Oliveira', 'iniciada'),
  caso('CC - Sala 5', '13:30', 'LOUISE', 'Marcelo Moreno', 'iniciada'),
  caso('Imagem', '13:00', 'COSTA', 'Continuação', 'iniciada'),
  caso('CO - Sala 3', '16:15', 'MELO', 'Tiago Peliser', 'agendada'),
  caso('CC - Sala 2', '14:00', 'CURY', 'Fulano', 'agendada'),
]

const escalaDe = ({ turno = 'vespertino', overrides = {}, liberacoes = {}, casos = CASOS_TARDE } = {}) => ({
  id: 'ce5efea6', hospital: 'unimed', data: '2026-09-21',
  ordemLiberacao: { matutino: turno === 'matutino' ? ORDEM : [], vespertino: turno === 'vespertino' ? ORDEM : [] },
  ajudaExterna: { matutino: [], vespertino: [] },
  liberacoes, linhaOverrides: overrides, casos,
})

const montar = (escala, turno = 'vespertino', props = {}) => render(
  <LiberacoesView escala={escala} hospital="unimed" hospitalLabel="Unimed" turno={turno}
    canEdit onToggle={() => {}} onSetOverride={() => {}} presencaOutros={[]} {...props} />,
  { wrapper: wrap }
)
const card = (uid) => document.querySelector(`[data-linha="${uid}"]`)

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-09-21T15:30:00-03:00'))
})
afterAll(() => vi.useRealTimers())
// cada teste recomeça às 15h30 de 21/09 — os de "hora de saída" mexem no relógio
beforeEach(() => vi.setSystemTime(new Date('2026-09-21T15:30:00-03:00')))

describe('selo "Equipe até 19h" — Unimed 21/09 à tarde', () => {
  const OVERRIDES = {
    'vespertino:u-melo': { naEquipe: { ate: '19:00' } },
    'vespertino:u-cury': { naEquipe: { ate: '19:00' } },
  }

  it('aparece só em quem tem a marca, com a hora do fim da tarde', () => {
    montar(escalaDe({ overrides: OVERRIDES }))
    expect(within(card('u-melo')).getByText('Equipe até 19h')).toBeTruthy()
    expect(within(card('u-cury')).getByText('Equipe até 19h')).toBeTruthy()
    expect(screen.getAllByText(/^Equipe até/)).toHaveLength(2)
    for (const uid of ['u-staub', 'u-louise', 'u-costa', 'u-gustavo']) {
      expect(within(card(uid)).queryByText(/^Equipe até/)).toBeNull()
    }
  })

  it('a fila NÃO muda por causa do selo: a ordem publicada continua a mesma', () => {
    montar(escalaDe({ overrides: OVERRIDES }))
    const chaves = Array.from(document.querySelectorAll('[data-linha]')).map((e) => e.getAttribute('data-linha'))
    expect(chaves.slice(0, 5)).toEqual(['u-staub', 'u-louise', 'u-costa', 'u-melo', 'u-cury'])
    // e não vira ajuda nem troca
    expect(within(card('u-melo')).queryByText('Ajuda')).toBeNull()
    expect(within(card('u-melo')).queryByText('Troca')).toBeNull()
  })

  it('some no card enxuto do liberado, como Plantonista e Ajuda', () => {
    montar(escalaDe({
      overrides: OVERRIDES,
      liberacoes: { 'vespertino:u-cury': { liberadoEm: '2026-09-21T18:20:00Z' } },
    }))
    expect(within(card('u-cury')).getByText('Liberado')).toBeTruthy()
    expect(within(card('u-cury')).queryByText(/^Equipe até/)).toBeNull()
    expect(within(card('u-melo')).getByText('Equipe até 19h')).toBeTruthy()
  })

  it('marca sem hora legível não rende selo (nunca chutar)', () => {
    montar(escalaDe({ overrides: { 'vespertino:u-melo': { naEquipe: { ate: 'tarde' } } } }))
    expect(screen.queryByText(/^Equipe até/)).toBeNull()
  })

  it('a marca é do turno: a mesma chave na manhã não pinta a tarde', () => {
    montar(escalaDe({ overrides: { 'matutino:u-melo': { naEquipe: { ate: '13:00' } } } }))
    expect(screen.queryByText(/^Equipe até/)).toBeNull()
  })
})

describe('hora de saída — "podem ser liberados a partir desses horários mesmo que estejam no meio da lista" (dono 21/09)', () => {
  const OVERRIDES = { 'vespertino:u-melo': { naEquipe: { ate: '19:00' } } }
  const montarCom = (extra = {}) => {
    const onToggle = vi.fn()
    montar(escalaDe({ overrides: OVERRIDES, ...extra }), 'vespertino', { onToggle })
    return onToggle
  }

  it('antes das 19h o Melo (4º de 6, com os de baixo em sala) é recusado como todo mundo, e o aviso diz a hora', async () => {
    vi.setSystemTime(new Date('2026-09-21T18:40:00-03:00'))
    const onToggle = montarCom()
    fireEvent.click(screen.getByLabelText('Marcar Guilherme Melo liberado'))
    expect(await screen.findByText('Libere Marcos Cury primeiro')).toBeTruthy()
    expect(await screen.findByText(/A partir das 19:00 Guilherme Melo pode sair fora da ordem/)).toBeTruthy()
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('às 19h o toque nele passa, com o Cury (abaixo) ainda em sala', async () => {
    vi.setSystemTime(new Date('2026-09-21T19:00:00-03:00'))
    const onToggle = montarCom()
    fireEvent.click(screen.getByLabelText('Marcar Guilherme Melo liberado'))
    await waitFor(() => expect(onToggle).toHaveBeenCalledTimes(1))
  })

  it('a marca não libera sozinha às 19h: ele segue trabalhando até o toque', () => {
    vi.setSystemTime(new Date('2026-09-21T19:10:00-03:00'))
    montarCom()
    expect(within(card('u-melo')).queryByText('Liberado')).toBeNull()
  })

  it('liberado fora da vez, o card desce para logo abaixo do "próximo" (Cury), com o número 4 — o padrão de cores fica inteiro', () => {
    vi.setSystemTime(new Date('2026-09-21T19:05:00-03:00'))
    montarCom({ liberacoes: { 'vespertino:u-melo': { liberadoEm: '2026-09-21T22:03:00Z' } } })
    const chaves = Array.from(document.querySelectorAll('[data-linha]')).map((e) => e.getAttribute('data-linha'))
    expect(chaves.indexOf('u-melo')).toBe(chaves.indexOf('u-cury') + 1)
    expect(chaves.slice(0, 3)).toEqual(['u-staub', 'u-louise', 'u-costa'])
    expect(within(card('u-cury')).getByText('Próximo a ser liberado')).toBeTruthy()
    expect(within(card('u-melo')).getByText('Liberado')).toBeTruthy()
    expect(within(card('u-melo')).getByText('4')).toBeTruthy()
    expect(within(card('u-cury')).getByText('5')).toBeTruthy() // ninguém é renumerado
    // e ele NÃO vira o "próximo a convocar" de ninguém: convocar o Gustavo (plantão da manhã) segue livre
  })

  it('a hora é do DIA da escala: escala de ontem já passou, de amanhã ainda não', async () => {
    vi.setSystemTime(new Date('2026-09-22T10:00:00-03:00')) // consultando a tarde de ontem
    let onToggle = montarCom()
    fireEvent.click(screen.getByLabelText('Marcar Guilherme Melo liberado'))
    await waitFor(() => expect(onToggle).toHaveBeenCalledTimes(1))
    document.body.innerHTML = ''
    vi.setSystemTime(new Date('2026-09-20T23:00:00-03:00')) // véspera, às 23h
    onToggle = montarCom()
    fireEvent.click(screen.getByLabelText('Marcar Guilherme Melo liberado'))
    expect(await screen.findByText('Libere Marcos Cury primeiro')).toBeTruthy()
    expect(onToggle).not.toHaveBeenCalled()
  })
})

describe('selo "Equipe até 13h" — de manhã', () => {
  it('a hora é a do fim da manhã', () => {
    vi.setSystemTime(new Date('2026-09-21T09:30:00-03:00'))
    const casos = CASOS_TARDE.map((c) => ({ ...c, turno: 'matutino', hora: '07:30' }))
    montar(escalaDe({ turno: 'matutino', casos, overrides: { 'matutino:u-cury': { naEquipe: { ate: '13:00' } } } }), 'matutino')
    expect(within(card('u-cury')).getByText('Equipe até 13h')).toBeTruthy()
    expect(screen.getAllByText(/^Equipe até/)).toHaveLength(1)
  })
})

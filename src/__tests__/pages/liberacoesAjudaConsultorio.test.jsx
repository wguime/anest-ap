/**
 * AJUDA NO CONSULTÓRIO — selo "Ajuda" pela linha do mapa (dono 21/09/2026).
 *
 * Foto do card do Alexandre S (8º no rodapé do HRO, caso "CONSULTORIO - AJUDA" 07:45):
 * "não saiu com o badge de ajuda". A linha do mapa já diz que a pessoa está ajudando —
 * o selo sai dela, sem ninguém marcar ajuda_externa. O que estas travas protegem: o selo
 * aparece em quem tem caso de consultório com "AJUDA" no texto; o consultório comum não
 * ganha selo; a FILA não muda (a pessoa segue na posição do rodapé); a declaração
 * `semAjuda` do painel esconde; o card enxuto do liberado não mostra.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { render, within } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import LiberacoesView from '@/pages/escala-cirurgica/LiberacoesView'

const ROSTER = [
  ['u-janaina', 'JANAINA SILVA', ['JANAINA']],
  ['u-karine', 'KARINE SOUZA', ['KARINE']],
  ['u-alex-s', 'ALEXANDRE SCHMIDT', ['ALEXANDRE S', 'ALEXANDRE SCHMIDT']],
  ['u-raul', 'RAUL LIMA', ['RAUL']],
  ['u-joao-r', 'JOAO RICARDO MOREIRA', ['JOAO RICARDO']],
  ['u-cris', 'CRISTINA MARCON', ['CRISTINA']],
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
const caso = (sala, hora, anestesista, procedimento, cirurgiao = '', statusCirurgia = 'agendada') => ({
  id: `c${++seq}`, sala, ordem: seq, hora, anestesista, procedimento, cirurgiao, statusCirurgia,
  turno: 'matutino', tipo: 'eletiva', bloco: 'normal', isContinuacao: false, semAnestesista: false,
})

// recorte do HRO de 22/09 de manhã: Alexandre S em 3º, com "CONSULTORIO - AJUDA"; João Ricardo em consultório comum
const ORDEM = ['JANAINA', 'KARINE', 'ALEXANDRE S', 'RAUL', 'JOAO RICARDO']
const CASOS = [
  caso('Sala 4', '07:00', 'JANAINA', 'TRATAMENTO CIRÚRGICO DE FRATURA DA DIÁFISE DO ÚMERO', 'Robson Chiesa', 'iniciada'),
  caso('Sala 7', '07:00', 'KARINE', 'CESARIANA', 'Leonor Seben', 'iniciada'),
  caso('Consultório', '07:45', 'ALEXANDRE S', 'CONSULTORIO - AJUDA'),
  caso('Sala 1', '07:00', 'RAUL', 'HÉRNIA DE DISCO + LAMINECTOMIA', 'Guilherme Martins', 'iniciada'),
  caso('Consultório', '07:45', 'JOAO RICARDO', 'CONSULTORIO'),
]

const escalaDe = ({ overrides = {}, liberacoes = {}, casos = CASOS } = {}) => ({
  id: 'hro-2209', hospital: 'hro', data: '2026-09-22',
  ordemLiberacao: { matutino: ORDEM, vespertino: [] },
  ajudaExterna: { matutino: [], vespertino: [] },
  liberacoes, linhaOverrides: overrides, casos,
})

const montar = (escala, props = {}) => render(
  <LiberacoesView escala={escala} hospital="hro" hospitalLabel="HRO" turno="matutino"
    canEdit onToggle={() => {}} onSetOverride={() => {}} presencaOutros={[]} {...props} />,
  { wrapper: wrap }
)
const card = (uid) => document.querySelector(`[data-linha="${uid}"]`)

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-09-22T09:00:00-03:00'))
})
afterAll(() => vi.useRealTimers())

describe('nota de local no rodapé — "CRISTINA (CONSULT)" (dono 22/09)', () => {
  // a nota faz a pessoa OCUPAR a posição mesmo sem cirurgia (04/09); o card dizia
  // "…" (cirurgião desconhecido) em cima do "Consultório" e parecia incompleto
  const COM_NOTA = ['JANAINA', 'CRISTINA (CONSULT)', 'RAUL']
  const escalaNota = () => ({
    id: 'hro-nota', hospital: 'hro', data: '2026-09-22',
    ordemLiberacao: { matutino: COM_NOTA, vespertino: [] },
    ajudaExterna: { matutino: [], vespertino: [] }, liberacoes: {}, linhaOverrides: {},
    casos: [
      caso('Sala 4', '07:00', 'JANAINA', 'FRATURA DA DIÁFISE DO ÚMERO', 'Robson Chiesa', 'iniciada'),
      caso('Sala 1', '07:00', 'RAUL', 'HÉRNIA DE DISCO', 'Guilherme Martins', 'iniciada'),
    ],
  })

  it('diz o local e NÃO mostra o traço de cirurgião desconhecido', () => {
    montar(escalaNota())
    const alvo = card('u-cris')
    expect(within(alvo).getByText('Consultório')).toBeTruthy()
    expect(alvo.textContent).not.toContain('…')
    // quem tem cirurgia segue com o cirurgião, e o traço continua para quem não tem local
    expect(within(card('u-janaina')).getByText(/Robson/)).toBeTruthy()
  })

  it('a posição é dela: fica na ordem publicada e não nasce liberada', () => {
    montar(escalaNota())
    const chaves = Array.from(document.querySelectorAll('[data-linha]')).map((e) => e.getAttribute('data-linha'))
    expect(chaves).toEqual(['u-janaina', 'u-cris', 'u-raul'])
    expect(within(card('u-cris')).queryByText('Liberado')).toBeNull()
  })
})

describe('selo "Ajuda" pela linha "CONSULTORIO - AJUDA" do mapa (dono 21/09)', () => {
  it('aparece no card de quem tem a linha, e só nele — o consultório comum não ganha selo', () => {
    montar(escalaDe())
    expect(within(card('u-alex-s')).getByText('Ajuda')).toBeTruthy()
    for (const uid of ['u-janaina', 'u-karine', 'u-raul', 'u-joao-r']) {
      expect(within(card(uid)).queryByText('Ajuda')).toBeNull()
    }
  })

  it('a fila NÃO muda por causa do selo: a pessoa segue na posição do rodapé', () => {
    montar(escalaDe())
    const chaves = Array.from(document.querySelectorAll('[data-linha]')).map((e) => e.getAttribute('data-linha'))
    expect(chaves.slice(0, 5)).toEqual(['u-janaina', 'u-karine', 'u-alex-s', 'u-raul', 'u-joao-r'])
  })

  it('a declaração "não é ajuda" do painel esconde o selo, como no badge derivado', () => {
    montar(escalaDe({ overrides: { 'matutino:u-alex-s': { semAjuda: true } } }))
    expect(within(card('u-alex-s')).queryByText('Ajuda')).toBeNull()
  })

  it('some no card enxuto do liberado', () => {
    montar(escalaDe({ liberacoes: { 'matutino:u-alex-s': { liberadoEm: '2026-09-22T11:20:00Z' } } }))
    expect(within(card('u-alex-s')).getByText('Liberado')).toBeTruthy()
    expect(within(card('u-alex-s')).queryByText('Ajuda')).toBeNull()
  })
})

/**
 * Fila de Liberações — três pedidos do dono em 16/09/2026 (fotos da fila):
 *
 *  1. "cor do badge de plantonista deve manter cor do DS" — o selo Plantonista
 *     era `secondary` (cinza); passa ao verde institucional (`bg-primary`), o
 *     mesmo dos selos P1–P4 e do plantão do turno seguinte.
 *  2. "troque a frase para: Turno encerra as 19:00h" — a linha do turno próprio
 *     deixa de dizer "Turno até 19:00 · pode sair fora da ordem".
 *  3. "quando o plantão da manhã for plantão noturno, não quero que mantenha o
 *     badge de plantão da manhã" — quem fecha o rodapé da TARDE leva o rótulo
 *     "Plantão da manhã"; se a mesma pessoa já carrega o selo P1–P4 (entra no
 *     plantão noturno hoje), o rótulo sai e fica só o selo. Só o badge some:
 *     posição e mecânica de saída não mudam.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { render, screen } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import LiberacoesView from '@/pages/escala-cirurgica/LiberacoesView'

const ROSTER = [
  { uid: 'uid-leo', nome: 'LEONARDO FERRAZZO', apelidos: ['LEONARDO'] },
  { uid: 'uid-mar', nome: 'MARILIO JOSE FLACH', apelidos: ['MARILIO'] },
  { uid: 'uid-kar', nome: 'KARINE BEDIN', apelidos: ['KARINE'] },
]
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

const caso = (sala, ordem, anestesista, cirurgiao, hora, extra = {}) => ({
  id: `${sala}-${ordem}`, sala, ordem, hora, anestesista, cirurgiao, turno: 'vespertino',
  bloco: 'normal', isContinuacao: false, semAnestesista: false, ...extra,
})

// TARDE de um dia útil (quarta 29/07): LEONARDO abre o rodapé (Plantonista) ·
// KARINE fecha (= "Plantão da manhã", o plantão do turno seguinte)
const escalaBase = (linhaOverrides = {}) => ({
  id: 'e1', hospital: 'hro', data: '2026-07-29',
  ordemLiberacao: { vespertino: ['LEONARDO', 'MARILIO', 'KARINE'] },
  ajudaExterna: {}, liberacoes: {}, linhaOverrides,
  casos: [
    caso('Sala 1', 0, 'LEONARDO', 'Liana W', '13:30'),
    caso('Sala 2', 0, 'MARILIO', 'Taciana A', '13:30'),
    caso('Sala 3', 0, 'KARINE', 'Farret G', '13:30'),
  ],
})

const montar = (props = {}, e = escalaBase()) => render(
  <LiberacoesView escala={e} hospital="hro" hospitalLabel="HRO" turno="vespertino"
    canEdit onToggle={() => {}} onSetOverride={() => {}} {...props} />,
  { wrapper: wrap }
)

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-07-29T15:00:00-03:00'))
})
afterAll(() => vi.useRealTimers())

const cardDe = (nome) => screen.getByLabelText(`Editar local/cirurgião de ${nome}`).closest('[data-linha]')
const linhaDoNome = (card) => card.querySelector('p.flex.items-center')
const selosDe = (card) => [...linhaDoNome(card).querySelectorAll('[data-slot="badge"]')]

describe('badge Plantonista — verde do DS', () => {
  it('o selo do plantonista é bg-primary (não o cinza de `secondary`)', () => {
    montar()
    const selo = selosDe(cardDe('Leonardo Ferrazzo')).find((b) => b.textContent.trim() === 'Plantonista')
    expect(selo).toBeTruthy()
    expect(selo.className).toContain('bg-primary')
    expect(selo.className).not.toContain('secondary')
  })
})

describe('frase do turno próprio', () => {
  it('"Turno encerra às 19:00h", sem o "pode sair fora da ordem"', () => {
    montar({}, escalaBase({ 'vespertino:uid-leo': { turnoProprio: { ate: '19:00' } } }))
    expect(screen.getByText('Turno encerra às 19:00h')).toBeInTheDocument()
    expect(screen.queryByText(/pode sair fora da ordem/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Turno até/)).not.toBeInTheDocument()
  })
})

describe('"Plantão da manhã" × selo noturno', () => {
  it('sem selo: quem fecha o rodapé da tarde leva "Plantão da manhã"', () => {
    montar()
    const textos = selosDe(cardDe('Karine Bedin')).map((b) => b.textContent.trim())
    expect(textos).toContain('Plantão da manhã')
  })

  it('com selo P1–P4 de hoje na mesma pessoa, o rótulo "Plantão da manhã" sai e fica só o selo', () => {
    vi.setSystemTime(new Date('2026-07-29T15:00:00-03:00'))
    // o selo P2 só entra quando a escala é de HOJE (avisarSelos): congela hoje = 29/07
    montar({ plantoes: [{ setor: 'P2', nome: 'Karine Bedin', horario: '19:00' }] })
    const textos = selosDe(cardDe('Karine Bedin')).map((b) => b.textContent.trim())
    expect(textos).toContain('P2')
    expect(textos).not.toContain('Plantão da manhã')
    // o plantonista da tarde segue com o seu selo
    expect(selosDe(cardDe('Leonardo Ferrazzo')).map((b) => b.textContent.trim())).toContain('Plantonista')
  })
})

describe('opção B (dono 16/09, modelo .tmp/fila-alinhamento-430.html)', () => {
  it('bolinha Ø24 dentro do botão de toque 36×44, e o nome nasce a 13px para centrar com ela', () => {
    montar()
    const card = cardDe('Leonardo Ferrazzo')
    const bolinha = card.querySelector('button span.rounded-full')
    expect(bolinha.className).toContain('h-6 w-6')
    expect(bolinha.closest('button').className).toContain('h-11 w-9')
    const corpo = linhaDoNome(card).parentElement
    expect(corpo.className).toContain('pt-[13px]')
    // fileira mais perto da bolinha (dono 16/09, 2ª foto): mt-1, não mt-2
    const fileira = card.querySelector('div.-ml-14')
    expect(fileira.className).toContain('mt-1')
    expect(fileira.className).not.toContain('mt-2')
  })

})

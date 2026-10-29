/**
 * A FASE DA NOITE É DA TARDE (dono 28/10/2026, com os turnos do dia abertos).
 *
 * `faseLiberacoes` olha só o relógio e a data. Antes de 28/10 a fila da manhã não era alcançável
 * depois das 13h, e isso nunca apareceu; com o turno que já passou de volta ao seletor, a fila da
 * MANHÃ vista às 20h ganharia os P1–P4 por cima e zeraria às 23h. A página mostra um aviso no
 * lugar da fila de um turno encerrado (escalaTurnosDoDiaAbertos); esta trava garante a regra
 * também na própria fila: "conferir a fila da manhã às 21h mostra a manhã como publicada".
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'

import { ThemeProvider, ToastProvider } from '@/design-system'
import LiberacoesView from '@/pages/escala-cirurgica/LiberacoesView'

vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    roster: [], rosterByUid: new Map(), options: [], aliases: [], loading: false,
    resolver: () => null, upsertAlias: vi.fn(), refresh: vi.fn(), removeAlias: vi.fn(),
  }),
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({
  default: { reservarAvisoTempo: vi.fn(async () => false), fetchLocaisHospital: vi.fn(async () => []) },
}))

const wrap = ({ children }) => <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>
const cardDe = (nome) => document.querySelector(`[data-nome="${nome}"]`)
const plantoes = [
  { setor: 'P1', nome: 'Ana Paula' }, { setor: 'P2', nome: 'Bruno Costa' },
  { setor: 'P3', nome: 'Carla Dias' }, { setor: 'P4', nome: 'Davi Rocha' },
]
// quinta-feira útil, Unimed: a noite entra com P2 → P3 → P4 (ORDEM_NOTURNA; o P1 é do HRO).
// Os nomes saem acentuados na tela ("Marílio") — acentos só na exibição (27/09).
const escala = {
  id: 'e1', hospital: 'unimed', data: '2026-07-23',
  ordemLiberacao: { matutino: ['MARILIO', 'OSCAR'], vespertino: ['MARILIO', 'OSCAR'] },
  ajudaExterna: {}, linhaOverrides: {}, liberacoes: {},
  casos: [
    { id: 'm1', sala: 'S1', ordem: 0, hora: '08:00', anestesista: 'MARILIO', cirurgiao: 'Cir A', turno: 'matutino' },
    { id: 't1', sala: 'S2', ordem: 0, hora: '14:00', anestesista: 'OSCAR', cirurgiao: 'Cir B', turno: 'vespertino' },
  ],
}
const montar = (turno) => render(
  <LiberacoesView escala={escala} hospital="unimed" hospitalLabel="Unimed" turno={turno} canEdit plantoes={plantoes}
    onToggle={() => {}} onSetOverride={() => {}} />,
  { wrapper: wrap },
)
const agora = (h) => { vi.useFakeTimers({ shouldAdvanceTime: true }); vi.setSystemTime(new Date(2026, 6, 23, h, 0, 0)) }

afterEach(() => vi.useRealTimers())

describe('a fase da noite vale só para a tarde', () => {
  it('às 20h a fila da TARDE ganha os P1–P4 (controle — a regra de 23/07 segue)', () => {
    agora(20)
    montar('vespertino')
    expect(cardDe('Bruno Costa')).toBeTruthy()
  })

  it('às 20h a fila da MANHÃ continua a manhã: sem P1–P4 por cima', () => {
    agora(20)
    montar('matutino')
    expect(cardDe('Bruno Costa')).toBeNull()
    expect(cardDe('Marílio')).toBeTruthy()
  })

  it('às 23h a fila da manhã não zera', () => {
    agora(23)
    montar('matutino')
    expect(cardDe('Marílio')).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/Liberações do dia encerradas/)
  })
})

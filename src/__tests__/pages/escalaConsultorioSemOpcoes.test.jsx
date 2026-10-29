/**
 * Consultório não abre opções (dono 29/10/2026, print da Completa com "Consultório" e
 * "Consultório – ajuda"): "ao clicar em consultório não devem aparecer opções, já que o
 * consultório o horário é fixo, manhã das 07:45 às 11:30 e à tarde das 13:30 às 17:00".
 * A linha fica só de leitura; cirurgia comum continua abrindo o detalhe.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeProvider, ToastProvider } from '@/design-system'
import { CasoCard } from '@/pages/escala-cirurgica/BoardView'
import LiberacoesView from '@/pages/escala-cirurgica/LiberacoesView'

const ROSTER = [
  { uid: 'uid-raq', nome: 'RAQUEL FELICIANI', apelidos: ['RAQUEL'] },
  { uid: 'uid-rod', nome: 'RODNEI LIMA', apelidos: ['RODNEI'] },
  { uid: 'uid-mar', nome: 'MARILIO JOSE FLACH', apelidos: ['MARILIO'] },
]
const APELIDO_UID = Object.fromEntries(ROSTER.flatMap((r) => r.apelidos.map((a) => [a, r.uid])))
vi.mock('@/hooks/useRosterAnestesistas', () => ({
  default: () => ({
    roster: ROSTER, rosterByUid: new Map(ROSTER.map((r) => [r.uid, r])),
    options: ROSTER.map((r) => ({ value: r.uid, label: r.nome })), aliases: [], loading: false,
    resolver: (nome) => APELIDO_UID[String(nome || '').trim().toUpperCase()] || null,
    upsertAlias: vi.fn(), refresh: vi.fn(), removeAlias: vi.fn(),
  }),
}))
vi.mock('@/services/supabaseEscalaCirurgicaService', () => ({
  default: { reservarAvisoTempo: vi.fn(async () => false), fetchLocaisHospital: vi.fn(async () => []) },
}))

const caso = (id, procedimento, sala = 'Consultório') => ({
  id, sala, ordem: 0, hora: '07:45', procedimento, anestesista: 'RAQUEL', cirurgiao: '',
  turno: 'matutino', bloco: 'normal', tipo: 'eletiva', statusCirurgia: 'agendada',
  isContinuacao: false, semAnestesista: false,
})

describe('consultório na Completa/Minhas: toque não abre nada (dono 29/10)', () => {
  it.each(['CONSULTORIO', 'CONSULTORIO – AJUDA'])('"%s" não é botão e o toque não chama onClick', (proc) => {
    const onClick = vi.fn()
    const { container } = render(<CasoCard caso={caso('c1', proc)} onClick={onClick} moldura="linha" />)
    expect(screen.queryByRole('button')).toBeNull()
    fireEvent.click(container.firstChild)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('cirurgia comum continua abrindo o detalhe', () => {
    const onClick = vi.fn()
    render(<CasoCard caso={caso('c2', 'COLECISTECTOMIA', 'Sala 2')} onClick={onClick} moldura="linha" />)
    fireEvent.click(screen.getByRole('button', { name: /Detalhes do caso/ }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('consultório nas Liberações: sem "+ Tempo total" (dono 29/10)', () => {
  beforeAll(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-07-29T10:00:00-03:00'))
  })
  afterAll(() => vi.useRealTimers())

  it('quem só tem consultório não tem o que tocar; quem opera segue com o botão', () => {
    const escala = {
      id: 'e1', hospital: 'hro', data: '2026-07-29',
      ordemLiberacao: { matutino: ['MARILIO', 'RAQUEL', 'RODNEI'] },
      ajudaExterna: { matutino: [] }, liberacoes: {}, linhaOverrides: {},
      casos: [
        { ...caso('s1', 'COLECISTECTOMIA', 'Sala 2'), anestesista: 'MARILIO', hora: '07:00' },
        { ...caso('c1', 'CONSULTORIO'), anestesista: 'RAQUEL' },
        { ...caso('c2', 'CONSULTORIO – AJUDA'), anestesista: 'RODNEI' },
      ],
    }
    render(
      <ThemeProvider><ToastProvider>
        <LiberacoesView escala={escala} hospital="hro" hospitalLabel="HRO" turno="matutino" canEdit onToggle={() => {}} onSetOverride={() => {}} />
      </ToastProvider></ThemeProvider>,
    )
    expect(screen.getByLabelText(/Definir tempo faltante de Marílio/)).toBeTruthy()
    expect(screen.queryByLabelText(/Definir tempo faltante de Raquel/)).toBeNull()
    expect(screen.queryByLabelText(/Definir tempo faltante de Rodnei/)).toBeNull()
  })
})
